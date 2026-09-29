'use strict';
const KEY='kanban.v2',$=s=>document.querySelector(s);
const uid=()=>Math.random().toString(36).slice(2,10);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const today=()=>new Date().toISOString().slice(0,10);
const mkCard=(o={})=>({id:uid(),title:'',desc:'',prio:'med',due:'',tags:[],check:[],who:'',created:today(),...o});
const mkCol=(title,o={})=>({id:uid(),title,color:'',wip:0,collapsed:false,cards:[],...o});
const seed=()=>{const b={id:uid(),name:'Dự án của tôi',archive:[],cols:[mkCol('Cần làm',{color:'#6366f1'}),mkCol('Đang làm',{color:'#f59e0b',wip:3}),mkCol('Xong',{color:'#22c55e'})]};
  b.cols[0].cards=[mkCard({title:'Chào mừng đến Kanban Pro 👋',desc:'Kéo thả thẻ & cột. Nhấn **Ctrl+K** mở bảng lệnh, **?** xem phím tắt.',tags:['hướng dẫn'],check:[{t:'Thử kéo thẻ',d:false},{t:'Mở thống kê 📊',d:false}]}),
    mkCard({title:'Thiết kế trang chủ',prio:'high',due:today(),tags:['design'],who:'Phong'})];
  return {boards:[b],cur:b.id,accent:'#6366f1'}};
function load(){try{const s=JSON.parse(localStorage.getItem(KEY));if(s?.boards?.length)return s;
  const old=JSON.parse(localStorage.getItem('kanban.v1'));if(old?.cols){const b={id:uid(),name:'Bảng 1',archive:[],cols:old.cols.map(c=>mkCol(c.title,{cards:c.cards.map(k=>mkCard(k))}))};return{boards:[b],cur:b.id}}}catch{}return seed()}
let S=load(),undo=[],redo=[],q='',fp='',fl='',drag=null,editing=null,cdraft=[];
const B=()=>S.boards.find(b=>b.id===S.cur)||S.boards[0];
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(S))}catch{}};
function mutate(fn,msg){undo.push(JSON.stringify(S));if(undo.length>100)undo.shift();redo=[];fn();save();render();if(msg)toast(msg,true)}
function restore(str){S=JSON.parse(str);save();render()}
function doUndo(){if(!undo.length)return;redo.push(JSON.stringify(S));restore(undo.pop())}
function doRedo(){if(!redo.length)return;undo.push(JSON.stringify(S));restore(redo.pop())}
function toast(m,canUndo){const t=document.createElement('div');t.className='toast';t.innerHTML=`<span>${esc(m)}</span>`;
  if(canUndo){const b=document.createElement('button');b.textContent='Hoàn tác';b.onclick=()=>{doUndo();t.remove()};t.append(b)}
  $('#toasts').append(t);setTimeout(()=>t.remove(),4000)}
const hue=s=>{let h=0;for(const c of s)h=(h*31+c.charCodeAt(0))%360;return `hsl(${h} 60% 45%)`};
const md=s=>esc(s).replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').replace(/\*(.+?)\*/g,'<i>$1</i>').replace(/`(.+?)`/g,'<code>$1</code>').replace(/(https?:\/\/[^\s<]+)/g,'<a href="$1" target="_blank" rel="noopener">$1</a>').replace(/\n/g,'<br>');
const match=c=>(!fp||c.prio===fp)&&(!fl||c.tags.includes(fl))&&(!q||(c.title+' '+c.desc+' '+c.tags.join(' ')+' '+c.who).toLowerCase().includes(q));
const filtering=()=>q||fp||fl;

function render(){
  document.documentElement.style.setProperty('--accent',S.accent||'#6366f1');
  const b=B();
  $('#boardSel').innerHTML=S.boards.map(x=>`<option value="${x.id}"${x.id===b.id?' selected':''}>${esc(x.name)}</option>`).join('');
  const labels=[...new Set(b.cols.flatMap(c=>c.cards.flatMap(k=>k.tags)))].sort();
  $('#fLabel').innerHTML='<option value="">Nhãn</option>'+labels.map(l=>`<option${l===fl?' selected':''}>${esc(l)}</option>`).join('');
  $('#undoBtn').disabled=!undo.length;$('#redoBtn').disabled=!redo.length;
  const board=$('#board');board.innerHTML='';
  const last=b.cols.at(-1);
  b.cols.forEach(col=>{
    const el=document.createElement('section');el.className='column'+(col.collapsed?' collapsed':'');el.dataset.id=col.id;
    if(col.color)el.style.setProperty('--ccol',col.color);
    const vis=col.cards.filter(match),full=col.wip&&col.cards.length>col.wip;
    el.innerHTML=`<div class="col-head" draggable="true"><h3>${esc(col.title)}</h3><span class="count${full?' full':''}" title="${col.wip?'Giới hạn WIP '+col.wip:''}">${vis.length}${col.wip?'/'+col.wip:''}</span><button data-a="fold" title="Thu gọn">${col.collapsed?'▸':'▾'}</button><button data-a="menu" title="Cài đặt cột">⋯</button></div><div class="cards"></div><button class="add-card">+ Thêm thẻ</button>`;
    const list=el.querySelector('.cards');
    vis.forEach(c=>list.append(cardEl(c,col===last)));
    el.querySelector('.col-head').ondragstart=e=>{drag={type:'col',id:col.id};e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain','c')};
    el.ondragover=e=>{if(!drag)return;e.preventDefault();el.classList.add('over')};
    el.ondragleave=e=>{if(!el.contains(e.relatedTarget))el.classList.remove('over')};
    el.ondrop=e=>{e.preventDefault();el.classList.remove('over');if(!drag)return;
      if(drag.type==='card')moveCard(drag.id,col.id,dropIdx(list,e.clientY));else moveCol(drag.id,col.id)};
    el.querySelector('[data-a=fold]').onclick=()=>mutate(()=>col.collapsed=!col.collapsed);
    el.querySelector('[data-a=menu]').onclick=()=>colMenu(col);
    el.querySelector('.add-card').onclick=ev=>quickAdd(el,col,ev.target);
    board.append(el);
  });
}
function cardEl(c,isLast){
  const d=document.createElement('article');d.className='card';d.draggable=true;d.dataset.id=c.id;d.dataset.prio=c.prio;
  const od=c.due&&!isLast&&c.due<today(),soon=c.due&&!od&&!isLast&&c.due===today();
  const done=c.check.filter(x=>x.d).length,pct=c.check.length?Math.round(done/c.check.length*100):0;
  d.innerHTML=`<h4>${esc(c.title)}</h4>${c.desc?`<div class="d">${md(c.desc)}</div>`:''}${c.check.length?`<div class="bar"><i style="width:${pct}%"></i></div>`:''}<div class="meta">${c.tags.map(t=>`<span class="tag" style="background:${hue(t)}">${esc(t)}</span>`).join('')}${c.check.length?`<span>☑ ${done}/${c.check.length}</span>`:''}${c.due?`<span class="${od?'overdue':soon?'soon':''}">📅 ${c.due}</span>`:''}${c.who?`<span class="av" title="${esc(c.who)}">${esc(c.who.trim().slice(0,2).toUpperCase())}</span>`:''}</div>`;
  d.onclick=e=>{if(e.target.tagName!=='A')openCard(c)};
  d.tabIndex=0;d.onkeydown=e=>{if(e.key==='Enter')openCard(c)};
  d.ondragstart=e=>{drag={type:'card',id:c.id};d.classList.add('dragging');e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain','k');e.stopPropagation()};
  d.ondragend=()=>{drag=null;d.classList.remove('dragging');document.querySelectorAll('.over').forEach(x=>x.classList.remove('over'))};
  return d;
}
function dropIdx(list,y){const items=[...list.querySelectorAll('.card:not(.dragging)')];
  const i=items.findIndex(n=>{const r=n.getBoundingClientRect();return y<r.top+r.height/2});return i<0?items.length:i}
function moveCard(id,toCol,idx){
  mutate(()=>{const b=B();let card;b.cols.forEach(c=>{const i=c.cards.findIndex(x=>x.id===id);if(i>=0)card=c.cards.splice(i,1)[0]});
    const dest=b.cols.find(c=>c.id===toCol);
    let at=dest.cards.length;
    if(!filtering()){at=idx}else{const vis=dest.cards.filter(match);const ref=vis[idx];at=ref?dest.cards.indexOf(ref):dest.cards.length}
    dest.cards.splice(at,0,card);
    if(dest.wip&&dest.cards.length>dest.wip)setTimeout(()=>toast(`Cột "${dest.title}" vượt giới hạn WIP (${dest.wip})`),0)});
}
function moveCol(id,target){if(id===target)return;mutate(()=>{const cs=B().cols,i=cs.findIndex(c=>c.id===id),[c]=cs.splice(i,1);cs.splice(cs.findIndex(c=>c.id===target)+(i<cs.findIndex(c=>c.id===target)+1?1:0),0,c)})}
function quickAdd(el,col,btn){
  const w=document.createElement('div');w.className='quick';w.innerHTML='<textarea rows="2" placeholder="Tiêu đề… Enter để thêm, Esc để đóng"></textarea>';
  btn.replaceWith(w);const ta=w.firstChild;ta.focus();
  ta.onkeydown=e=>{if(e.key==='Escape')render();else if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();const t=ta.value.trim();if(!t)return render();
    mutate(()=>col.cards.push(mkCard({title:t})));const nc=document.querySelector(`[data-id="${col.id}"] .add-card`);nc?.click()}};
  ta.onblur=()=>setTimeout(()=>{if(document.body.contains(w))render()},100);
}
function colMenu(col){
  const a=prompt(`Cột "${col.title}"\n  r = đổi tên\n  w = đặt giới hạn WIP (hiện ${col.wip||'không'})\n  c = đổi màu\n  s = sắp xếp theo hạn/ưu tiên\n  x = xoá cột`,'r');
  if(!a)return;
  ({r:()=>{const t=prompt('Tên cột',col.title);if(t?.trim())mutate(()=>col.title=t.trim())},
    w:()=>{const n=parseInt(prompt('Giới hạn WIP (0 = không giới hạn)',col.wip),10);if(n>=0)mutate(()=>col.wip=n)},
    c:()=>{const c=prompt('Màu (vd #ef4444, để trống = bỏ)',col.color||'');if(c!==null)mutate(()=>col.color=c.trim())},
    s:()=>mutate(()=>{const p={high:0,med:1,low:2};col.cards.sort((x,y)=>(x.due||'9')<(y.due||'9')?-1:(x.due||'9')>(y.due||'9')?1:p[x.prio]-p[y.prio])},'Đã sắp xếp'),
    x:()=>{if(confirm(`Xoá cột "${col.title}" cùng ${col.cards.length} thẻ?`))mutate(()=>B().cols=B().cols.filter(c=>c!==col),'Đã xoá cột')}}[a.trim().toLowerCase()]||(()=>{}))();
}
/* ---- card dialog ---- */
const dlg=$('#dlg'),form=$('#cardForm');
function openCard(card,colId){
  editing={card,colId};const b=B();
  const cur=card?b.cols.find(c=>c.cards.includes(card)):b.cols.find(c=>c.id===colId);
  $('#dlgTitle').textContent=card?'Sửa thẻ':'Thẻ mới';
  ['delCard','dupCard','arcCard'].forEach(i=>$('#'+i).style.display=card?'':'none');
  form.title.value=card?.title||'';form.desc.value=card?.desc||'';form.prio.value=card?.prio||'med';form.due.value=card?.due||'';
  form.who.value=card?.who||'';form.tags.value=card?.tags.join(', ')||'';
  form.col.innerHTML=b.cols.map(c=>`<option value="${c.id}"${c===cur?' selected':''}>${esc(c.title)}</option>`).join('');
  cdraft=(card?.check||[]).map(x=>({...x}));drawCheck();dlg.showModal();form.title.focus();
}
function drawCheck(){
  const L=$('#checkList');L.innerHTML='';
  cdraft.forEach((x,i)=>{const r=document.createElement('div');r.className='ci'+(x.d?' done':'');
    r.innerHTML=`<input type="checkbox"${x.d?' checked':''}><span>${esc(x.t)}</span><button type="button" class="x">✕</button>`;
    r.querySelector('input').onchange=e=>{x.d=e.target.checked;drawCheck()};r.querySelector('.x').onclick=()=>{cdraft.splice(i,1);drawCheck()};L.append(r)});
  $('#checkPct').textContent=cdraft.length?`(${Math.round(cdraft.filter(x=>x.d).length/cdraft.length*100)}%)`:'';
}
$('#checkNew').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();const t=e.target.value.trim();if(t){cdraft.push({t,d:false});e.target.value='';drawCheck()}}};
form.onsubmit=()=>{
  const data={title:form.title.value.trim(),desc:form.desc.value.trim(),prio:form.prio.value,due:form.due.value,who:form.who.value.trim(),
    tags:[...new Set(form.tags.value.split(',').map(t=>t.trim()).filter(Boolean))],check:cdraft};
  if(!data.title)return;const to=form.col.value;
  mutate(()=>{const b=B();
    if(editing.card){Object.assign(editing.card,data);const from=b.cols.find(c=>c.cards.includes(editing.card));
      if(from.id!==to){from.cards.splice(from.cards.indexOf(editing.card),1);b.cols.find(c=>c.id===to).cards.push(editing.card)}}
    else b.cols.find(c=>c.id===to).cards.push(mkCard(data))});
};
const owner=()=>B().cols.find(c=>c.cards.includes(editing.card));
$('#cancel').onclick=()=>dlg.close();
$('#delCard').onclick=()=>{dlg.close();mutate(()=>{const o=owner();o.cards.splice(o.cards.indexOf(editing.card),1)},'Đã xoá thẻ')};
$('#dupCard').onclick=()=>{dlg.close();mutate(()=>{const o=owner();o.cards.splice(o.cards.indexOf(editing.card)+1,0,mkCard({...JSON.parse(JSON.stringify(editing.card)),id:uid(),title:editing.card.title+' (bản sao)'}))},'Đã nhân bản')};
$('#arcCard').onclick=()=>{dlg.close();mutate(()=>{const o=owner();o.cards.splice(o.cards.indexOf(editing.card),1);(B().archive??=[]).push({...editing.card,from:o.title})},'Đã lưu trữ')};
/* ---- boards ---- */
$('#boardSel').onchange=e=>{S.cur=e.target.value;save();render()};
function boardMenu(){
  const a=prompt('Bảng hiện tại: '+B().name+'\n  n = bảng mới\n  r = đổi tên\n  d = xoá bảng\n  a = xem lưu trữ\n  e = xuất JSON\n  i = nhập JSON\n  t = đổi màu chủ đạo','n');
  ({n:newBoard,r:()=>{const t=prompt('Tên bảng',B().name);if(t?.trim())mutate(()=>B().name=t.trim())},
    d:()=>{if(S.boards.length<2)return toast('Cần giữ ít nhất một bảng');if(confirm(`Xoá bảng "${B().name}"?`))mutate(()=>{S.boards=S.boards.filter(b=>b!==B());S.cur=S.boards[0].id},'Đã xoá bảng')},
    a:showArchive,e:exportJSON,i:()=>$('#importFile').click(),
    t:()=>{const c=prompt('Màu chủ đạo (vd #10b981)',S.accent);if(c)mutate(()=>S.accent=c.trim())}}[(a||'').trim().toLowerCase()]||(()=>{}))();
}
function newBoard(){const n=prompt('Tên bảng mới');if(!n?.trim())return;
  mutate(()=>{const b={id:uid(),name:n.trim(),archive:[],cols:[mkCol('Cần làm'),mkCol('Đang làm'),mkCol('Xong')]};S.boards.push(b);S.cur=b.id})}
$('#boardMenu').onclick=boardMenu;
function exportJSON(){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(S,null,2)],{type:'application/json'}));a.download='kanban-'+today()+'.json';a.click();URL.revokeObjectURL(a.href)}
$('#importFile').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;
  try{const d=JSON.parse(await f.text());if(!d.boards?.length)throw 0;if(confirm('Thay thế toàn bộ dữ liệu hiện tại bằng file này?'))mutate(()=>S=d,'Đã nhập dữ liệu')}catch{toast('File không hợp lệ')}};
/* ---- info dialogs ---- */
const info=$('#info');function showInfo(html){$('#infoBody').innerHTML=html;info.showModal()}
function showArchive(){const b=B(),a=b.archive||[];
  showInfo(`<h2>Lưu trữ (${a.length})</h2>`+(a.length?a.map((c,i)=>`<div class="arc"><span>${esc(c.title)} <small>· ${esc(c.from||'')}</small></span><button class="btn ghost" data-r="${i}">Khôi phục</button></div>`).join(''):'<p>Trống.</p>'));
  $('#infoBody').onclick=e=>{const i=e.target.dataset.r;if(i==null)return;info.close();
    mutate(()=>{const [c]=b.archive.splice(+i,1);delete c.from;(b.cols.find(x=>x.title===a[i]?.from)||b.cols[0]).cards.push(c)},'Đã khôi phục')}}
function showStats(){
  const b=B(),all=b.cols.flatMap(c=>c.cards),last=b.cols.at(-1).cards.length;
  const od=b.cols.slice(0,-1).flatMap(c=>c.cards).filter(c=>c.due&&c.due<today()).length;
  const items=all.flatMap(c=>c.check),ck=items.filter(x=>x.d).length,mx=Math.max(1,...b.cols.map(c=>c.cards.length));
  showInfo(`<h2>Thống kê · ${esc(b.name)}</h2><div class="stat-grid">
   <div class="stat"><b>${all.length}</b><span>Tổng thẻ</span></div>
   <div class="stat"><b>${all.length?Math.round(last/all.length*100):0}%</b><span>Hoàn thành</span></div>
   <div class="stat"><b>${od}</b><span>Quá hạn</span></div>
   <div class="stat"><b>${all.filter(c=>c.prio==='high').length}</b><span>Ưu tiên cao</span></div>
   <div class="stat"><b>${items.length?ck+'/'+items.length:'–'}</b><span>Việc con</span></div></div>`+
   b.cols.map(c=>`<div class="hb"><span>${esc(c.title)}</span><i style="width:${c.cards.length/mx*60}%;min-width:2px;background:${c.color||'var(--accent)'}"></i><span>${c.cards.length}</span></div>`).join(''))}
$('#statsBtn').onclick=showStats;
function showHelp(){showInfo(`<h2>Phím tắt</h2><p><kbd>n</kbd> thẻ mới · <kbd>/</kbd> tìm kiếm · <kbd>Ctrl</kbd>+<kbd>K</kbd> bảng lệnh · <kbd>Ctrl</kbd>+<kbd>Z</kbd> hoàn tác · <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Z</kbd> làm lại · <kbd>?</kbd> trợ giúp · <kbd>Esc</kbd> đóng</p><p>Kéo tiêu đề cột để đổi thứ tự cột. Nhấn Enter trên thẻ để mở.</p>`)}
/* ---- command palette ---- */
const pal=$('#pal'),palIn=$('#palIn'),palList=$('#palList');let cmds=[],sel=0;
function commands(){return[
 ['Thẻ mới',()=>openCard(null,B().cols[0].id)],['Cột mới',addCol],['Bảng mới',newBoard],['Thống kê',showStats],['Lưu trữ',showArchive],
 ['Hoàn tác',doUndo],['Làm lại',doRedo],['Đổi giao diện sáng/tối',toggleTheme],['Xuất JSON',exportJSON],['Nhập JSON',()=>$('#importFile').click()],['Phím tắt',showHelp],
 ...S.boards.map(b=>['Chuyển sang bảng: '+b.name,()=>{S.cur=b.id;save();render()}]),
 ...B().cols.flatMap(c=>c.cards.map(k=>['Thẻ: '+k.title+' ('+c.title+')',()=>openCard(k)]))]}
function palDraw(){const t=palIn.value.toLowerCase();cmds=commands().filter(c=>c[0].toLowerCase().includes(t)).slice(0,30);sel=Math.min(sel,Math.max(0,cmds.length-1));
  palList.innerHTML=cmds.map((c,i)=>`<li class="${i===sel?'sel':''}" data-i="${i}">${esc(c[0])}</li>`).join('')}
function palRun(i){const c=cmds[i];pal.close();c&&setTimeout(c[1],0)}
function openPal(){palIn.value='';sel=0;palDraw();pal.showModal();palIn.focus()}
palIn.oninput=()=>{sel=0;palDraw()};
palIn.onkeydown=e=>{if(e.key==='ArrowDown'){sel=Math.min(sel+1,cmds.length-1);palDraw();e.preventDefault()}else if(e.key==='ArrowUp'){sel=Math.max(sel-1,0);palDraw();e.preventDefault()}else if(e.key==='Enter')palRun(sel)};
palList.onclick=e=>{const i=e.target.dataset.i;if(i!=null)palRun(+i)};
pal.addEventListener('click',e=>{if(e.target===pal)pal.close()});
$('#cmdBtn').onclick=openPal;
/* ---- misc ---- */
function addCol(){const t=prompt('Tên cột mới');if(t?.trim())mutate(()=>B().cols.push(mkCol(t.trim())))}
$('#addCol').onclick=addCol;$('#undoBtn').onclick=doUndo;$('#redoBtn').onclick=doRedo;
$('#search').oninput=e=>{q=e.target.value.toLowerCase();render()};
$('#fPrio').onchange=e=>{fp=e.target.value;render()};$('#fLabel').onchange=e=>{fl=e.target.value;render()};
const inField=()=>/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
document.addEventListener('keydown',e=>{
  const mod=e.ctrlKey||e.metaKey;
  if(mod&&e.key.toLowerCase()==='k'){e.preventDefault();openPal();return}
  if(mod&&e.key.toLowerCase()==='z'&&!inField()){e.preventDefault();e.shiftKey?doRedo():doUndo();return}
  if(inField()||mod||document.querySelector('dialog[open]'))return;
  if(e.key==='/'){e.preventDefault();$('#search').focus()}else if(e.key==='n'){e.preventDefault();openCard(null,B().cols[0].id)}else if(e.key==='?')showHelp()});
const setTheme=t=>{document.documentElement.dataset.theme=t;try{localStorage.setItem('kanban.theme',t)}catch{}};
const toggleTheme=()=>setTheme(document.documentElement.dataset.theme==='dark'?'light':'dark');
$('#themeBtn').onclick=toggleTheme;
setTheme((()=>{try{return localStorage.getItem('kanban.theme')}catch{}})()||(matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light'));
addEventListener('storage',e=>{if(e.key===KEY&&e.newValue){S=JSON.parse(e.newValue);render()}});
render();
