const KEY='kanban.v1';
const uid=()=>Math.random().toString(36).slice(2,10);
const seed=()=>({cols:[
 {id:uid(),title:'Cần làm',cards:[{id:uid(),title:'Chào mừng đến Kanban 👋',desc:'Kéo thả thẻ giữa các cột, bấm vào thẻ để sửa.',prio:'med',due:'',tags:['hướng dẫn']}]},
 {id:uid(),title:'Đang làm',cards:[]},
 {id:uid(),title:'Hoàn thành',cards:[]}]});
let state;
try{state=JSON.parse(localStorage.getItem(KEY))}catch{}
state=state&&state.cols?state:seed();
const save=()=>localStorage.setItem(KEY,JSON.stringify(state));
const $=s=>document.querySelector(s);
const board=$('#board'),dlg=$('#dlg'),form=$('#cardForm');
let drag=null,editing=null,q='',fp='';
const esc=s=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function render(){
  board.innerHTML='';
  state.cols.forEach(col=>{
    const el=document.createElement('section');el.className='column';el.dataset.id=col.id;
    const vis=col.cards.filter(c=>(!fp||c.prio===fp)&&(!q||(c.title+c.desc+c.tags.join(' ')).toLowerCase().includes(q)));
    el.innerHTML=`<div class="col-head"><h3 title="Bấm đúp để đổi tên">${esc(col.title)}</h3><span class="count">${vis.length}</span><button data-a="delcol" title="Xoá cột">✕</button></div><div class="cards"></div><button class="add-card">+ Thêm thẻ</button>`;
    const list=el.querySelector('.cards');
    vis.forEach(c=>{
      const d=document.createElement('article');d.className='card';d.draggable=true;d.dataset.id=c.id;d.dataset.prio=c.prio;
      const od=c.due&&c.due<new Date().toISOString().slice(0,10)&&col!==state.cols.at(-1);
      d.innerHTML=`<h4>${esc(c.title)}</h4>${c.desc?`<p>${esc(c.desc)}</p>`:''}<div class="meta">${c.tags.map(t=>`<span class="tag">${esc(t)}</span>`).join('')}${c.due?`<span class="${od?'overdue':''}">📅 ${c.due}</span>`:''}</div>`;
      d.onclick=()=>openCard(col.id,c);
      d.ondragstart=e=>{drag=c.id;d.classList.add('dragging');e.dataTransfer.effectAllowed='move'};
      d.ondragend=()=>{d.classList.remove('dragging');document.querySelectorAll('.over').forEach(x=>x.classList.remove('over'))};
      list.append(d);
    });
    el.ondragover=e=>{e.preventDefault();el.classList.add('over')};
    el.ondragleave=e=>{if(!el.contains(e.relatedTarget))el.classList.remove('over')};
    el.ondrop=e=>{e.preventDefault();move(drag,col.id,dropIndex(list,e.clientY))};
    el.querySelector('.add-card').onclick=()=>openCard(col.id,null);
    el.querySelector('h3').ondblclick=()=>{const t=prompt('Tên cột',col.title);if(t?.trim()){col.title=t.trim();save();render()}};
    el.querySelector('[data-a=delcol]').onclick=()=>{if(confirm(`Xoá cột "${col.title}" và ${col.cards.length} thẻ?`)){state.cols=state.cols.filter(c=>c!==col);save();render()}};
    board.append(el);
  });
}
function dropIndex(list,y){
  const items=[...list.querySelectorAll('.card:not(.dragging)')];
  const i=items.findIndex(n=>{const r=n.getBoundingClientRect();return y<r.top+r.height/2});
  return i<0?items.length:i;
}
function move(id,toCol,idx){
  let card;
  state.cols.forEach(c=>{const i=c.cards.findIndex(x=>x.id===id);if(i>=0)card=c.cards.splice(i,1)[0]});
  if(!card)return;
  const dest=state.cols.find(c=>c.id===toCol);
  // idx is relative to visible cards; with filters active, append to end
  dest.cards.splice(q||fp?dest.cards.length:idx,0,card);
  save();render();
}
function openCard(colId,card){
  editing={colId,card};
  $('#dlgTitle').textContent=card?'Sửa thẻ':'Thẻ mới';
  $('#delCard').style.display=card?'':'none';
  form.title.value=card?.title||'';form.desc.value=card?.desc||'';
  form.prio.value=card?.prio||'med';form.due.value=card?.due||'';form.tags.value=card?.tags.join(', ')||'';
  dlg.showModal();form.title.focus();
}
form.onsubmit=()=>{
  const data={title:form.title.value.trim(),desc:form.desc.value.trim(),prio:form.prio.value,due:form.due.value,
    tags:form.tags.value.split(',').map(t=>t.trim()).filter(Boolean)};
  if(!data.title)return;
  if(editing.card)Object.assign(editing.card,data);
  else state.cols.find(c=>c.id===editing.colId).cards.push({id:uid(),...data});
  save();render();
};
$('#cancel').onclick=()=>dlg.close();
$('#delCard').onclick=()=>{
  state.cols.forEach(c=>c.cards=c.cards.filter(x=>x!==editing.card));
  dlg.close();save();render();
};
$('#addCol').onclick=()=>{const t=prompt('Tên cột mới');if(t?.trim()){state.cols.push({id:uid(),title:t.trim(),cards:[]});save();render()}};
$('#search').oninput=e=>{q=e.target.value.toLowerCase();render()};
$('#filterPrio').onchange=e=>{fp=e.target.value;render()};
document.addEventListener('keydown',e=>{if(e.key==='/'&&!/INPUT|TEXTAREA/.test(document.activeElement.tagName)){e.preventDefault();$('#search').focus()}});
const setTheme=t=>{document.documentElement.dataset.theme=t;localStorage.setItem('kanban.theme',t)};
setTheme(localStorage.getItem('kanban.theme')||(matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light'));
$('#themeBtn').onclick=()=>setTheme(document.documentElement.dataset.theme==='dark'?'light':'dark');
render();
