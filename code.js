// ====== Settings (edit here) ======
const APP_PASS = '1234';                 // 🔒 Passcode for the password wall
const DISCORD_WEBHOOK = '';                  // 🔔 Put your Discord webhook URL here. If empty, backups are skipped.
const STORAGE_KEY = 'orderbook_cakeshop_v2'; // 🗄️ Local storage key

// ====== Utilities ======
const pad = n => String(n).padStart(2,'0');
const fmtLabel = (d) => new Intl.DateTimeFormat(undefined,{ weekday:'long', month:'long', day:'numeric'}).format(d);
const fmtForKey = (d) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const $ = sel => document.querySelector(sel);

// Auto-resize for textareas
function autoresize(el){ el.style.height='auto'; el.style.height = (el.scrollHeight+2)+'px' }

// ====== Persistence + Backup ======
const load = () => { try{ return JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]') }catch{ return [] } };
const save = (orders, reason='update') => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
//   if(DISCORD_WEBHOOK){
//     try{
//       fetch(DISCORD_WEBHOOK,{
//         method:'POST',
//         headers:{'Content-Type':'application/json'},
//         body: JSON.stringify({
//           content: 'OrderBook backup ('+reason+')' + "\n```json\n"
//                    + JSON.stringify({ts:new Date().toISOString(), orders}, null, 2)
//                    + "\n```"
//         })
//       });
//     }catch(e){ console.warn('Backup failed (ignored)', e) }
//   }
};

// ====== State ======
const state = { today:new Date(), cursor:new Date(), selected:null, orders: load() };

// Minimal seed if empty
if(state.orders.length===0){
  const d=fmtForKey(new Date());
  state.orders.push({id:1, createdAt:Date.now(), date:d, name:'Walk-in', phone:'0500000000', desc:'Chocolate cupcake box', paid:false});
  save(state.orders,'seed');
}

// ====== Password gate (Enter supported) ======
const gate = $('#gate'), app = $('#app');
$('#gateForm').addEventListener('submit', (e)=>{
  e.preventDefault();
  const ok = $('#gatePass').value === APP_PASS;
  if(ok){ gate.classList.remove('visible'); app.hidden=false; } else { $('#gateHint').textContent = 'Wrong passcode'; }
});

// ====== Calendar ======
const gridEl = $('#grid'), dowEl = $('#dow'), monthLabel = $('#monthLabel');
function renderDOW(){
  const fmt=new Intl.DateTimeFormat(undefined,{weekday:'short'}); const ref=new Date(2024,7,4);
  dowEl.innerHTML = Array.from({length:7},(_,i)=>{ const d=new Date(ref); d.setDate(ref.getDate()+i); return `<div style="text-align:center">${fmt.format(d)}</div>` }).join('');
}
function updateTopLabel(){ const d = state.selected? new Date(state.selected) : new Date(state.cursor); monthLabel.textContent = fmtLabel(d) }
function cellHTML(date, muted){ const key=fmtForKey(date); const isToday=fmtForKey(state.today)===key; return `<div class="cell ${muted?'muted':''} ${isToday?'today':''}" data-key="${key}">${date.getDate()}</div>` }
function renderCalendar(){
  const y=state.cursor.getFullYear(), m=state.cursor.getMonth(); const start=new Date(y,m,1);
  const startDay=(start.getDay()+7)%7, days=new Date(y,m+1,0).getDate(), prevDays=new Date(y,m,0).getDate();
  const cells=[]; for(let i=startDay-1;i>=0;i--){ cells.push(cellHTML(new Date(y,m-1,prevDays-i),true)) }
  for(let i=1;i<=days;i++){ cells.push(cellHTML(new Date(y,m,i),false)) }
  const spill=Math.max(0,42-cells.length); for(let i=1;i<=spill;i++){ cells.push(cellHTML(new Date(y,m+1,i),true)) }
  gridEl.innerHTML=cells.join(''); updateTopLabel();
  gridEl.querySelectorAll('.cell').forEach(el=> el.addEventListener('click',()=>{
    state.selected=el.dataset.key; updateTopLabel(); filterAndRender();
    gridEl.querySelectorAll('.cell').forEach(c=>c.classList.toggle('selected', c.dataset.key===state.selected))
  }));
  if(state.selected){ const sel=gridEl.querySelector(`.cell[data-key="${state.selected}"]`); sel && sel.classList.add('selected') }
}

// ====== Orders ======
const listEl = $('#ordersList');
function perDayIndex(order){
  const same = state.orders
    .filter(o=>o.date===order.date)
    .sort((a,b)=>(a.createdAt||0)-(b.createdAt||0)||a.id-b.id);
  const i=same.findIndex(o=>o===order);
  return i>=0? i+1:1;
}
function renderOrders(rows){
  if(!rows.length){ listEl.innerHTML = `<div class="empty">No orders for this selection.</div>`; return }
  listEl.innerHTML = rows.map(row=>{
    const n = perDayIndex(row);
    const safe = (row.desc||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    return `
    <article class="order" data-id="${row.id}">
      <div class="left-rail ${row.paid?'paid-rail':''}"></div>
      <div class="bullet">i</div>
      <div>
        <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap">
          <div class="phone">${row.phone}</div>
          <span class="tag">${row.name}</span>
          ${row.paid? '<span class="tag paid">Paid</span>':''}
          <span class="tag">${row.date}</span>
        </div>
        <textarea class="desc" placeholder="Cake details / notes" rows="1">${safe}</textarea>
        ${row.image
          ? `<div style="margin-top:8px; display:flex; gap:8px; align-items:center"><img class="thumb" src="${row.image}" alt="receipt" /><button class="attach" data-action="replace-img">Replace</button></div>`
          : `<button class="attach" data-action="attach-img">Attach receipt</button>`}
      </div>
      <div class="right">
        <div class="order-number">#${n}</div>
        <button class="nav-btn" data-action="toggle-paid">${row.paid? 'Unmark Paid':'Mark Paid'}</button>
      </div>
    </article>`
  }).join('');

  // Paid toggle with confirmation & save
  listEl.querySelectorAll('[data-action="toggle-paid"]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const id = +btn.closest('.order').dataset.id; const row = state.orders.find(o=>o.id===id);
      if(confirm(`${row.paid? 'Unmark':'Mark'} order as paid?`)){
        row.paid = !row.paid; save(state.orders,'toggle-paid'); filterAndRender();
      }
    })
  })

  // Description edits (autosave + autoresize)
  listEl.querySelectorAll('.order .desc').forEach(textarea=>{
    autoresize(textarea);
    textarea.addEventListener('input', ()=> autoresize(textarea));
    textarea.addEventListener('change', ()=>{
      const id=+textarea.closest('.order').dataset.id;
      const row=state.orders.find(o=>o.id===id);
      row.desc = textarea.value; save(state.orders,'desc-edit');
    });
  })

  // Attach/replace image (base64 to localStorage)
  listEl.querySelectorAll('[data-action="attach-img"],[data-action="replace-img"]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const id = +btn.closest('.order').dataset.id; const row = state.orders.find(o=>o.id===id);
      const picker = document.createElement('input'); picker.type='file'; picker.accept='image/*';
      picker.onchange = () => {
        const f=picker.files[0]; if(!f) return;
        const r=new FileReader();
        r.onload = () => { row.image = r.result; save(state.orders,'attach-image'); filterAndRender(); };
        r.readAsDataURL(f)
      };
      picker.click();
    })
  })
}

function filterAndRender(){
  const q = $('#search').value.trim().toLowerCase();
  const byDate = state.selected; let rows = [...state.orders];
  if(byDate) rows = rows.filter(r=> r.date===byDate);
  if(q) rows = rows.filter(r=> (r.name+" "+r.phone+" "+(r.desc||'')+" "+r.date).toLowerCase().includes(q));
  rows.sort((a,b)=> (a.paid===b.paid?0:(a.paid?1:-1)) || (a.createdAt||0)-(b.createdAt||0) || a.id-b.id);
  renderOrders(rows);
}

// ====== Add Order ======
const form = $('#addOrderForm');
const imgInput = $('#orderImage');
$('#orderDesc').addEventListener('input', e=>autoresize(e.target));
form.addEventListener('submit', async e=>{
  e.preventDefault();
  const name = $('#orderName').value.trim();
  const phone = $('#orderPhone').value.trim();
  const desc  = $('#orderDesc').value.trim();
  if(!name||!phone) return;
  const dateKey = state.selected || fmtForKey(state.today);
  const nextId = state.orders.reduce((m,o)=>Math.max(m,o.id),0)+1;
  const createdAt = Date.now();
  let image = null;
  if(imgInput.files && imgInput.files[0]){
    image = await new Promise(res=>{
      const r=new FileReader(); r.onload=()=>res(r.result); r.readAsDataURL(imgInput.files[0])
    })
  }
  const order = { id: nextId, createdAt, date: dateKey, name, phone, desc, paid:false, image };
  state.orders.push(order);
  save(state.orders,'add');
  form.reset(); autoresize($('#orderDesc'));
  state.selected = dateKey; renderCalendar(); filterAndRender();
});

// ====== Navigation & Init ======
$('#prevMonth').addEventListener('click', ()=>{ state.cursor.setMonth(state.cursor.getMonth()-1); renderCalendar() })
$('#nextMonth').addEventListener('click', ()=>{ state.cursor.setMonth(state.cursor.getMonth()+1); renderCalendar() })
$('#btnToday').addEventListener('click', ()=>{ state.cursor=new Date(state.today); state.selected=fmtForKey(state.today); renderCalendar(); filterAndRender() })
$('#search').addEventListener('input', filterAndRender)

renderDOW(); state.selected = fmtForKey(state.today); renderCalendar(); filterAndRender();
