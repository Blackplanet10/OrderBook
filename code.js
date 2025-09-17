// ===== Utilities =====


function renderOrders(rows){
if(!rows.length){ listEl.innerHTML = `<div class="empty">No orders for this selection.</div>`; return }
listEl.innerHTML = rows.map(row=>`
<article class="order ${row.paid? 'paid-row':''}" data-id="${row.id}">
<div class="left-rail"></div>
<div class="bullet">i</div>
<div>
<div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap">
<div class="phone">${row.phone}</div>
<span class="tag">${row.name}</span>
${row.paid? '<span class="tag paid">Paid</span>':''}
</div>
<div class="meta">
<span class="tag">Time taken: ${row.timeTaken}</span>
<span class="tag">Date: ${row.date}</span>
</div>
</div>
<div class="right">
<div class="order-number">${row.orderNo}</div>
<button class="nav-btn" data-action="toggle-paid">${row.paid? 'Unmark Paid':'Mark Paid'}</button>
</div>
</article>
`).join('')


// interactions
listEl.querySelectorAll('[data-action="toggle-paid"]').forEach(btn=>{
btn.addEventListener('click', ()=>{
const id = +btn.closest('.order').dataset.id
const row = state.orders.find(o=>o.id===id)
row.paid = !row.paid
filterAndRender()
})
})
}


function filterAndRender(){
const q = document.getElementById('search').value.trim().toLowerCase()
const byDate = state.selected
let rows = [...state.orders]
if(byDate){ rows = rows.filter(r=> r.date===byDate) }
if(q){
if(q==='today'){ rows = rows.filter(r=> r.date===fmtForKey(state.today)) }
else {
rows = rows.filter(r=> (r.name+" "+r.orderNo+" "+r.phone+" "+r.date).toLowerCase().includes(q))
}
}
// sort (organized) – paid last, then by order number
rows.sort((a,b)=> (a.paid===b.paid? 0 : a.paid? 1:-1) || a.id-b.id)
renderOrders(rows)
}


// ===== Wire up nav/search =====
document.getElementById('prevMonth').addEventListener('click', ()=>{ state.cursor.setMonth(state.cursor.getMonth()-1); renderCalendar() })
document.getElementById('nextMonth').addEventListener('click', ()=>{ state.cursor.setMonth(state.cursor.getMonth()+1); renderCalendar() })
document.getElementById('btnToday').addEventListener('click', ()=>{ state.cursor = new Date(state.today); state.selected = fmtForKey(state.today); renderCalendar(); filterAndRender() })
document.getElementById('search').addEventListener('input', filterAndRender)


// ===== Init =====
renderDOW();
state.selected = fmtForKey(state.today)
renderCalendar();
filterAndRender();