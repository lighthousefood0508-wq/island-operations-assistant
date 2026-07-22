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
    ${renderNavigationStyles()}:root{font-family:Arial,"Noto Sans TC",sans-serif;color:#173237;background:#eef3f0;--green:#145c57;--line:#c8d6d1;--muted:#617477;--paper:#fff;--ready:#dff2e7;--hot:#fff0d8}*{box-sizing:border-box}body{margin:0}main{max-width:1220px;margin:auto;padding:16px}.top{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center;margin-bottom:14px}h1{margin:0;font-size:28px}#event{margin:4px 0 0;color:var(--muted)}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.column{background:#fff;border:1px solid var(--line);border-radius:7px;padding:12px;min-height:320px}.column h2{margin:0 0 10px;font-size:20px}.card{border:1px solid #d9e4e0;border-radius:7px;background:#fff;padding:12px;margin-bottom:10px}.card.preparing{background:var(--hot)}.card.ready,.card.served{background:var(--ready)}.order-no{font-size:24px;font-weight:900;line-height:1}.items{font-size:18px;font-weight:800;margin:10px 0}.items div{margin:4px 0}.note{color:#7a4b16;font-weight:700}.meta{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}.pill{font-size:12px;background:#edf3f0;border-radius:999px;padding:4px 8px;color:#36575b}.wait{font-weight:900;color:#a33d25}.actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}button{padding:11px 12px;border:0;border-radius:5px;background:var(--green);color:#fff;font:800 15px Arial,sans-serif;cursor:pointer}button:disabled{opacity:.55;cursor:not-allowed}.empty{color:var(--muted);padding:10px 0}@media(max-width:900px){main{padding:12px}.grid{grid-template-columns:1fr}.top{grid-template-columns:1fr}.card{padding:14px}.order-no{font-size:28px}.items{font-size:20px}button{width:100%;font-size:17px}}@media(min-width:901px) and (max-width:1180px){.grid{gap:8px}.column{padding:10px}.order-no{font-size:21px}.items{font-size:17px}}
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
    function waitMinutes(createdAt){return Math.max(0,Math.floor((Date.now()-new Date(createdAt).getTime())/60000))}
    function card(o){const items=(o.items||[]).map(i=>'<div>'+esc(i.posName)+' x'+i.quantity+(i.notes?' <span class="note">('+esc(i.notes)+')</span>':'')+'</div>').join('')||'<div>No items</div>';let actions='';if(o.productionStatus==='not_started'||o.productionStatus==='queued')actions='<button data-id="'+o.orderId+'" data-status="preparing">開始製作</button>';if(o.productionStatus==='preparing')actions='<button data-id="'+o.orderId+'" data-status="ready">完成製作</button>';if(o.productionStatus==='ready')actions='<button data-id="'+o.orderId+'" data-status="served">已出餐</button>';return '<article class="card '+esc(o.productionStatus)+'"><div class="order-no">'+esc(o.orderNumber)+(o.customerName?' · '+esc(o.customerName):'')+'</div><div class="meta"><span class="pill wait">等待 '+waitMinutes(o.createdAt)+' 分</span>'+(o.customerPhoneTail?'<span class="pill">末四碼 '+esc(o.customerPhoneTail)+'</span>':'')+'<span class="pill">付款 '+paymentMethodLabel(o.paymentMethod)+'</span><span class="pill">狀態 '+esc(o.productionStatus)+'</span></div><div class="items">'+items+'</div>'+(o.notes?'<div class="note">訂單備註：'+esc(o.notes)+'</div>':'')+'<div class="actions">'+actions+'</div></article>'}
    async function load(){const e=await api('/api/events/current');sync.setEventId(e?.eventId);if(!e){$('#event').textContent='目前沒有 OPEN Event';for(const id of ['pending','preparing','ready'])$('#'+id).innerHTML='';return}const orders=await api('/api/events/'+e.eventId+'/orders'),columns={pending:[],preparing:[],ready:[]};orders.filter(o=>o.orderStatus==='confirmed').forEach(o=>{const id=['not_started','queued'].includes(o.productionStatus)?'pending':o.productionStatus==='preparing'?'preparing':'ready';columns[id].push(card(o))});$('#event').textContent=e.displayName+' · '+e.eventCode;for(const id of ['pending','preparing','ready'])$('#'+id).innerHTML=columns[id].join('')||'<p class="empty">目前沒有訂單</p>'}
    document.addEventListener('click',async e=>{const b=e.target.closest('button[data-status]');if(!b)return;b.disabled=true;try{await api('/api/orders/'+b.dataset.id+'/status',{method:'PATCH',body:JSON.stringify({status:b.dataset.status,operator:'kitchen'})});await load()}catch(err){alert(err instanceof TypeError?'無法連線，請確認中央服務':err.message)}finally{b.disabled=false}});
    sync.registerLoad(load);
  </script>
</body>
</html>`;
}
