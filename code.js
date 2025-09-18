// ===== Utilities & Persistence =====
const pad = n => String(n).padStart(2,'0')
const fmtLabel = (d) => new Intl.DateTimeFormat(undefined,{ weekday:'long', month:'long', day:'numeric'}).format(d)
const fmtForKey = (d) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
const STORAGE_KEY = 'tablet_orders_v3'
const save = (orders) => localStorage.setItem(STORAGE_KEY, JSON.stringify(orders))
const load = () => { try{ return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') }catch{ return [] } }


// ===== State =====
const state = { today:new Date(), cursor:new Date(), selected:null, orders: load() }


// Seed if empty
if(state.orders.length===0){
const base = new Date();
const sample = (d,i)=>({ id: i, createdAt: Date.now()+i, date: fmtForKey(d), name: `Guest ${i}`, phone:`05${Math.floor(10000000+Math.random()*89999999)}`, desc:'', paid:false })
for(let i=1;i<=4;i++){ const d=new Date(base); d.setDate(base.getDate()+i%2); state.orders.push(sample(d,i)) }
save(state.orders)
}


// ===== Elements =====
const gridEl = document.getElementById('grid')
const dowEl = document.getElementById('dow')
const monthLabel = document.getElementById('monthLabel')
const listEl = document.getElementById('ordersList')
const searchEl = document.getElementById('search')


// ===== Calendar =====
const renderDOW = () => {
const fmt = new Intl.DateTimeFormat(undefined,{ weekday:'short'})
const ref = new Date(2024,7,4) // Sunday
dowEl.innerHTML = Array.from({length:7}).map((_,i)=>{ const d=new Date(ref); d.setDate(ref.getDate()+i); return `<div style="text-align:center">${fmt.format(d)}</div>` }).join('')
}


function updateTopLabel(){
const d = state.selected? new Date(state.selected) : new Date(state.cursor)
monthLabel.textContent = fmtLabel(d)
}


function renderCalendar(){
const y = state.cursor.getFullYear();
const m = state.cursor.getMonth();
const start = new Date(y,m,1)
const startDay = (start.getDay()+7)%7
const daysInMonth = new Date(y, m+1, 0).getDate()
const prevMonthDays = new Date(y, m, 0).getDate()


const cells = []
for(let i=startDay-1; i>=0; i--){ const d=new Date(y,m-1,prevMonthDays-i); cells.push(cellHTML(d,true)) }
for(let i=1;i<=daysInMonth;i++){ const d=new Date(y,m,i); cells.push(cellHTML(d,false)) }
const spill = Math.max(0, 42 - cells.length)
for(let i=1;i<=spill;i++){ const d=new Date(y,m+1,i); cells.push(cellHTML(d,true)) }


gridEl.innerHTML = cells.join('')
updateTopLabel()


gridEl.querySelectorAll('.cell').forEach(el=>{
el.addEventListener('click',()=>{
state.selected = el.dataset.key
updateTopLabel()
filterAndRender()
gridEl.querySelectorAll('.cell').forEach(c=>c.classList.toggle('selected', c.dataset.key===state.selected))
})
})


if(state.selected){ const sel = gridEl.querySelector(`.cell[data-key="${state.selected}"]`); sel && sel.classList.add('selected') }
}


function cellHTML(date, muted){
const key = fmtForKey(date)
const isToday = fmtForKey(state.today)===key
return `<div class="cell ${muted?'muted':''} ${isToday?'today':''}" data-key="${key}" aria-label="${date.toDateString()}">${date.getDate()}</div>`
}


// ===== Orders =====
function perDayIndex(order){
const sameDay = state.orders.filter(o=>o.date===order.date).sort((a,b)=> (a.createdAt||0)-(b.createdAt||0) || a.id-b.id)
const idx = sameDay.findIndex(o=>o===order)
return idx>=0? idx+1 : 1
}


function renderOrders(rows){
if(!rows.length){ listEl.innerHTML = `<div class="empty">No orders for this selection.</div>`; return }
listEl.innerHTML = rows.map(row=>{
const n = perDayIndex(row)
return `
<article class="order" data-id="${row.id}">
<div class="left-rail ${row.paid? 'paid-rail':''}"></div>
<div class="bullet">i</div>
<div>
<div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap">
<div class="phone">${row.phone}</div>
<span class="tag">${row.name}</span>
${row.paid? '<span class="tag paid">Paid</span>':''}
<span class="tag">${row.date}</span>
</div>
<input class="desc" placeholder="Description" value="${(row.desc||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}" />
</div>
<div class="right">
<div class="order-number">#${n}</div>
<button class="nav-btn" data-action="toggle-paid">${row.paid? 'Unmark Paid':'Mark Paid'}</button>
</div>
</article>`
}).join('')


// Toggle paid
listEl.querySelectorAll('[data-action="toggle-paid"]').forEach(btn=>{
btn.addEventListener('click',()=>{
const id = +btn.closest('.order').dataset.id
const row = state.orders.find(o=>o.id===id)
row.paid = !row.paid
save(state.orders)
filterAndRender()
})
})


// Description edits (debounced save)
listEl.querySelectorAll('.order .desc').forEach(input=>{
input.addEventListener('change', ()=>{
const id = +input.closest('.order').dataset.id
const row = state.orders.find(o=>o.id===id)
row.desc = input.value
save(state.orders)
// no re-render to keep cursor, but numbers may be same
})
})
}


function filterAndRender(){
const q = searchEl.value.trim().toLowerCase()
const byDate = state.selected
let rows = [...state.orders]
if(byDate){ rows = rows.filter(r=> r.date===byDate) }
if(q){ rows = rows.filter(r=> (r.name+" "+r.phone+" "+(r.desc||'')+" "+r.date).toLowerCase().includes(q)) }
rows.sort((a,b)=> (a.paid===b.paid?0:(a.paid?1:-1)) || (a.createdAt||0)-(b.createdAt||0) || a.id-b.id)
renderOrders(rows)
}


// ===== Add Order =====
document.getElementById('addOrderForm').addEventListener('submit', e=>{
e.preventDefault()
const name = document.getElementById('orderName').value.trim()
const phone = document.getElementById('orderPhone').value.trim()
const desc = document.getElementById('orderDesc').value.trim()
if(!name || !phone) return
const dateKey = state.selected || fmtForKey(state.today)
const nextId = state.orders.reduce((m,o)=>Math.max(m,o.id),0)+1
const createdAt = Date.now()
const order = { id: nextId, createdAt, date: dateKey, name, phone, desc, paid:false }
state.orders.push(order)
save(state.orders)
// clear inputs
document.getElementById('orderName').value = ''
document.getElementById('orderPhone').value = ''
document.getElementById('orderDesc').value = ''
// ensure we are looking at that day
state.selected = dateKey
renderCalendar(); filterAndRender()
})


// ===== Backup to Discord =====
document.getElementById('backupBtn').addEventListener('click', async ()=>{
const url = document.getElementById('webhookUrl').value.trim()
if(!url){ alert('Please paste a Discord webhook URL'); return }
const snapshot = { savedAt: new Date().toISOString(), orders: state.orders }
try{
const res = await fetch(url, {
method: 'POST', headers: { 'Content-Type':'application/json' },
body: JSON.stringify({ content: 'Orders backup (localStorage)\n```json\n'+JSON.stringify(snapshot, null, 2)+'\n```' })
})
if(!res.ok) throw new Error('HTTP '+res.status)
alert('Backup sent to Discord ✅')
}catch(err){
console.error(err)
alert('Backup failed. See console. (Your browser may block cross-origin POSTs)')
}
})


// ===== Navigation & Init =====
document.getElementById('prevMonth').addEventListener('click', ()=>{ state.cursor.setMonth(state.cursor.getMonth()-1); renderCalendar() })
document.getElementById('nextMonth').addEventListener('click', ()=>{ state.cursor.setMonth(state.cursor.getMonth()+1); renderCalendar() })
document.getElementById('btnToday').addEventListener('click', ()=>{ state.cursor=new Date(state.today); state.selected=fmtForKey(state.today); renderCalendar(); filterAndRender() })
searchEl.addEventListener('input', filterAndRender)


renderDOW(); state.selected = fmtForKey(state.today); renderCalendar(); filterAndRender();