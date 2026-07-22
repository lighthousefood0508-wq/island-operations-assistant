import { renderNavigationStyles, renderSystemNav } from "../shared/navigation.js";
import { renderRealtimeDebug } from "../shared/realtime-debug.js";

export function renderKitchen(): string {
  return `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>ROS Kitchen</title>
  <style>
    ${renderNavigationStyles()}body{font:16px Arial;margin:0;background:#f2f5f3;color:#173237}main{max-width:1100px;margin:auto;padding:18px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.column{background:#fff;border:1px solid #c9d7d2;padding:12px;min-height:260px}.card{border-bottom:1px solid #dce6e1;padding:10px 0}button{padding:8px;border:0;background:#165b59;color:#fff;margin:3px;cursor:pointer}button:disabled{opacity:.55;cursor:not-allowed}small{color:#617477;font-size:13px}.top{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.meta{display:flex;flex-wrap:wrap;gap:6px;margin:5px 0}.pill{font-size:12px;background:#edf3f0;border-radius:999px;padding:3px 7px;color:#36575b}@media(max-width:700px){.grid{grid-template-columns:1fr}.top{display:block}}
  </style>
</head>
<body>
  ${renderSystemNav("kitchen")}
  <main>
    <div class="top"><div><h1>Kitchen</h1><p id="event">Loading...</p></div>${renderRealtimeDebug("Kitchen")}</div>
    <div class="grid">
      <section class="column"><h2>待製作</h2><div id="pending"></div></section>
      <section class="column"><h2>製作中</h2><div id="preparing"></div></section>
      <section class="column"><h2>可取餐／已出餐</h2><div id="ready"></div></section>
    </div>
  </main>
  <script>
    const sync=window.__rosRealtime,$=id=>document.querySelector(id);
    const api=async(p,o={})=>{try{const r=await fetch(p,{headers:{'content-type':'application/json'},...o}),b=await r.json();if(!r.ok)throw Error(b.error?.message||'Request failed');sync.recordApiSuccess();return b.data}catch(e){sync.recordApiFailure();throw e}};
    function esc(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
    function paymentMethodLabel(value){if(value==='CASH')return '現金';if(value==='LINE_PAY')return 'LINE Pay';return '未填'}
    function card(o){const items=(o.items||[]).map(i=>esc(i.posName)+' x'+i.quantity+(i.notes?' ('+esc(i.notes)+')':'')).join(', ')||'No items';let actions='';if(o.productionStatus==='not_started'||o.productionStatus==='queued')actions='<button data-id="'+o.orderId+'" data-status="preparing">開始製作</button>';if(o.productionStatus==='preparing')actions='<button data-id="'+o.orderId+'" data-status="ready">完成製作</button>';if(o.productionStatus==='ready')actions='<button data-id="'+o.orderId+'" data-status="served">已出餐</button>';return '<article class="card"><strong>'+esc(o.orderNumber)+(o.customerName?' · '+esc(o.customerName):'')+'</strong><br><small>'+new Date(o.createdAt).toLocaleTimeString()+' · '+esc(o.source)+'</small><div class="meta">'+(o.customerPhoneTail?'<span class="pill">末四碼 '+esc(o.customerPhoneTail)+'</span>':'')+'<span class="pill">付款方式 '+paymentMethodLabel(o.paymentMethod)+'</span><span class="pill">製作 '+esc(o.productionStatus)+'</span></div><p>'+items+'</p>'+(o.notes?'<small>訂單備註：'+esc(o.notes)+'</small>':'')+'<div>'+actions+'</div></article>'}
    async function load(){const e=await api('/api/events/current');sync.setEventId(e?.eventId);if(!e){$('#event').textContent='目前沒有 OPEN Event';for(const id of ['pending','preparing','ready'])$('#'+id).innerHTML='';return}const orders=await api('/api/events/'+e.eventId+'/orders'),columns={pending:[],preparing:[],ready:[]};orders.filter(o=>o.orderStatus==='confirmed').forEach(o=>{const id=['not_started','queued'].includes(o.productionStatus)?'pending':o.productionStatus==='preparing'?'preparing':'ready';columns[id].push(card(o))});$('#event').textContent=e.displayName+' · '+e.eventCode;for(const id of ['pending','preparing','ready'])$('#'+id).innerHTML=columns[id].join('')||'<p>目前沒有訂單</p>'}
    document.addEventListener('click',async e=>{const b=e.target.closest('button[data-status]');if(!b)return;b.disabled=true;try{await api('/api/orders/'+b.dataset.id+'/status',{method:'PATCH',body:JSON.stringify({status:b.dataset.status,operator:'kitchen'})});await load()}catch(err){alert(err instanceof TypeError?'無法連線，請確認中央服務':err.message)}finally{b.disabled=false}});
    sync.registerLoad(load);
  </script>
</body>
</html>`;
}
