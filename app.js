'use strict';
const KEY='kanban.v2',$=s=>document.querySelector(s);
const {uid,esc,today,mkCard,mkCol,mkBoard,hue,md,UndoHistory}=KanbanLogic,L=KanbanLogic;
function load(){try{const s=L.normalize(JSON.parse(localStorage.getItem(KEY)));if(s)return s}catch{}
  try{const m=L.migrateV1(JSON.parse(localStorage.getItem('kanban.v1')));if(m)return m}catch{}return L.seed()}
let S=load(),H=new UndoHistory(),q='',fp='',fl='',drag=null,editing=null,cdraft=[];
const B=()=>S.boards.find(b=>b.id===S.cur)||S.boards[0];
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(S))}catch{}};
function mutate(fn,msg){H.push(JSON.stringify(S));fn();save();render();if(msg)toast(msg,true)}
function restore(str){S=JSON.parse(str);save();render()}
function doUndo(){const p=H.undo(JSON.stringify(S));if(p)restore(p)}
function doRedo(){const p=H.redo(JSON.stringify(S));if(p)restore(p)}
function toast(m,canUndo){const t=document.createElement('div');t.className='toast';t.innerHTML=`<span>${esc(m)}</span>`;
  if(canUndo){const b=document.createElement('button');b.textContent='Hoàn tác';b.onclick=()=>{doUndo();t.remove()};t.append(b)}
  $('#toasts').append(t);setTimeout(()=>t.remove(),4000)}
const F=()=>({q,fp,fl});
const match=c=>L.matches(c,F());

function render(){
  document.documentElement.style.setProperty('--accent',S.accent||'#4f46e5');
  const b=B();
  $('#boardSel').innerHTML=S.boards.map(x=>`<option value="${esc(x.id)}"${x.id===b.id?' selected':''}>${esc(x.name)}</option>`).join('');
  const labels=[...new Set(b.cols.flatMap(c=>c.cards.flatMap(k=>k.tags)))].sort();
  $('#fLabel').innerHTML='<option value="">Nhãn</option>'+labels.map(l=>`<option${l===fl?' selected':''}>${esc(l)}</option>`).join('');
  $('#undoBtn').disabled=!H.canUndo;$('#redoBtn').disabled=!H.canRedo;
  const board=$('#board');board.innerHTML='';
  const last=b.cols.at(-1);
  b.cols.forEach(col=>{
    const el=document.createElement('section');el.className='column'+(col.collapsed?' collapsed':'');el.dataset.id=col.id;
    if(col.color)el.style.setProperty('--ccol',col.color);
    const vis=col.cards.filter(match),full=col.wip&&col.cards.length>col.wip;
    el.innerHTML=`<div class="col-head" draggable="true"><h3>${esc(col.title)}</h3><span class="count${full?' full':''}" title="${col.wip?'Giới hạn WIP '+Number(col.wip):''}">${vis.length}${col.wip?'/'+Number(col.wip):''}</span><button data-a="fold" title="Thu gọn">${col.collapsed?'▸':'▾'}</button><button data-a="menu" title="Cài đặt cột">⋯</button></div><div class="cards"></div><button class="add-card">+ Thêm thẻ</button>`;
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
  const od=L.isOverdue(c,isLast),soon=L.isDueToday(c,isLast),{done,pct}=L.checkProgress(c);
  d.innerHTML=`<h4>${esc(c.title)}</h4>${c.desc?`<div class="d">${md(c.desc)}</div>`:''}${c.check.length?`<div class="bar"><i style="width:${pct}%"></i></div>`:''}<div class="meta">${c.tags.map(t=>`<span class="tag" style="background:${hue(t)}">${esc(t)}</span>`).join('')}${c.check.length?`<span>☑ ${done}/${c.check.length}</span>`:''}${c.due?`<span class="${od?'overdue':soon?'soon':''}">📅 ${esc(c.due)}</span>`:''}${c.who?`<span class="av" title="${esc(c.who)}">${esc(c.who.trim().slice(0,2).toUpperCase())}</span>`:''}</div>`;
  d.onclick=e=>{if(e.target.tagName!=='A')openCard(c)};
  d.tabIndex=0;d.onkeydown=e=>{if(e.key==='Enter'&&e.target===d){e.preventDefault();openCard(c)}};
  d.ondragstart=e=>{drag={type:'card',id:c.id};d.classList.add('dragging');e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain','k');e.stopPropagation()};
  d.ondragend=()=>{drag=null;d.classList.remove('dragging');document.querySelectorAll('.over').forEach(x=>x.classList.remove('over'))};
  return d;
}
function dropIdx(list,y){const items=[...list.querySelectorAll('.card:not(.dragging)')];
  const i=items.findIndex(n=>{const r=n.getBoundingClientRect();return y<r.top+r.height/2});return i<0?items.length:i}
function moveCard(id,toCol,idx){
  mutate(()=>{const dest=L.moveCard(B(),id,toCol,idx,F());
    if(dest&&dest.wip&&dest.cards.length>dest.wip)setTimeout(()=>toast(`Cột "${dest.title}" vượt giới hạn WIP (${dest.wip})`),0)});
}
function moveCol(id,target){if(id!==target)mutate(()=>L.moveCol(B().cols,id,target))}
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
    c:()=>{const c=prompt('Màu hex (vd #ef4444, để trống = bỏ)',col.color||'');if(c===null)return;if(c.trim()&&!/^#[0-9a-f]{3,8}$/i.test(c.trim()))return toast('Màu phải dạng #rrggbb');mutate(()=>col.color=c.trim())},
    s:()=>mutate(()=>L.sortCards(col.cards),'Đã sắp xếp'),
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
  form.col.innerHTML=b.cols.map(c=>`<option value="${esc(c.id)}"${c===cur?' selected':''}>${esc(c.title)}</option>`).join('');
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
    t:()=>{const c=prompt('Màu chủ đạo (vd #10b981)',S.accent);if(!c)return;if(!/^#[0-9a-f]{3,8}$/i.test(c.trim()))return toast('Màu phải dạng #rrggbb');mutate(()=>S.accent=c.trim())}}[(a||'').trim().toLowerCase()]||(()=>{}))();
}
function newBoard(){const n=prompt('Tên bảng mới');if(!n?.trim())return;
  mutate(()=>{const b=mkBoard(n.trim());S.boards.push(b);S.cur=b.id})}
$('#boardMenu').onclick=boardMenu;
function exportJSON(){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(S,null,2)],{type:'application/json'}));a.download='kanban-'+today()+'.json';a.click();URL.revokeObjectURL(a.href)}
$('#importFile').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;
  try{const d=JSON.parse(await f.text());if(!d.boards?.length)throw 0;if(confirm('Thay thế toàn bộ dữ liệu hiện tại bằng file này?')){const n=L.normalize(d);if(!n)throw 0;mutate(()=>S=n,'Đã nhập dữ liệu')}}catch{toast('File không hợp lệ')}};
/* ---- info dialogs ---- */
const info=$('#info');function showInfo(html){$('#infoBody').innerHTML=html;info.showModal()}
function showArchive(){const b=B(),a=b.archive||[];
  showInfo(`<h2>Lưu trữ (${a.length})</h2>`+(a.length?a.map((c,i)=>`<div class="arc"><span>${esc(c.title)} <small>· ${esc(c.from||'')}</small></span><button class="btn ghost" data-r="${Number(i)}">Khôi phục</button></div>`).join(''):'<p>Trống.</p>'));
  $('#infoBody').onclick=e=>{const i=e.target.dataset.r;if(i==null)return;info.close();
    mutate(()=>{const [c]=b.archive.splice(+i,1);delete c.from;(b.cols.find(x=>x.title===a[i]?.from)||b.cols[0]).cards.push(c)},'Đã khôi phục')}}
function showStats(){
  const b=B(),st=L.stats(b),mx=Math.max(1,...st.perCol.map(c=>c.n));
  showInfo(`<h2>Thống kê · ${esc(b.name)}</h2><div class="stat-grid">
   <div class="stat"><b>${st.total}</b><span>Tổng thẻ</span></div>
   <div class="stat"><b>${st.donePct}%</b><span>Hoàn thành</span></div>
   <div class="stat"><b>${st.overdue}</b><span>Quá hạn</span></div>
   <div class="stat"><b>${st.high}</b><span>Ưu tiên cao</span></div>
   <div class="stat"><b>${st.checkTotal?st.checkDone+'/'+st.checkTotal:'–'}</b><span>Việc con</span></div></div>`+
   b.cols.map((c,i)=>`<div class="hb"><span>${esc(c.title)}</span><i style="width:${st.perCol[i].n/mx*60}%;min-width:2px;background:${c.color?esc(c.color):'var(--accent)'}"></i><span>${st.perCol[i].n}</span></div>`).join(''))}
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
  palList.innerHTML=cmds.map((c,i)=>`<li role="option" aria-selected="${i===sel}" class="${i===sel?'sel':''}" data-i="${i}">${esc(c[0])}</li>`).join('')}
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
addEventListener('storage',e=>{if(e.key===KEY&&e.newValue){const n=L.normalize(JSON.parse(e.newValue));if(n){S=n;render()}}});
render();
