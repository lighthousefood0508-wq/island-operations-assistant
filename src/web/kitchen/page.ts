import { renderRealtimeDebug } from "../shared/realtime-debug.js";

export function renderKitchen(): string {
  return `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>荒島餐車 Kitchen</title>
  <style>
    :root{font-family:Arial,"Noto Sans TC",sans-serif;color:#173237;background:#f3f0ea;--green:#0f7668;--blue:#294357;--red:#ba3b2f;--line:#d8cec0;--muted:#64727a;--paper:#fff;--soft:#f8f5ef;--ready:#dff2e7;--hot:#fff0d8}*{box-sizing:border-box}body{margin:0}main{padding:10px 12px 18px}.top{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:10px}.brand{color:#00796b;font-size:13px;font-weight:800}.top h1{font-size:28px;margin:3px 0 0}.event{color:var(--muted);font-weight:800;margin:5px 0 0}.system-menu{position:relative;z-index:20}.system-menu summary{list-style:none;border:1px solid #a9d8d2;background:#e9fbf7;color:#00796b;border-radius:999px;padding:9px 13px;font-weight:900;cursor:pointer}.system-menu summary::-webkit-details-marker{display:none}.system-links{position:absolute;right:0;top:42px;min-width:190px;display:grid;gap:6px;background:#fff;border:1px solid var(--line);border-radius:8px;padding:8px;box-shadow:0 12px 28px rgba(30,45,35,.16)}.system-links a,.system-links span{text-decoration:none;color:#24484b;border-radius:6px;padding:10px 12px;font-weight:900}.system-links a:hover{background:#edf5f1}.system-links .current,.system-links .disabled{background:#eef3f0;color:#72817e;cursor:not-allowed}.sync-debug-toggle,.sync-debug{display:none!important}.sync-status{display:inline-flex!important;align-items:center;gap:6px;font-weight:900;margin:6px 0}.sync-status[data-state="connected"]{color:#08796b}.sync-status[data-state="reconnecting"]{color:#9a6700}.sync-status[data-state="offline"]{color:#ba3b2f}.page-state{min-height:22px;margin:8px 0;font-weight:900;color:var(--muted)}.page-state.error{color:#a52d1f}.section{background:#fff;border:1px solid var(--line);border-radius:6px;margin-top:12px;padding:16px}.section-head{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:10px}.section h2{font-size:21px;margin:0}.pill{display:inline-flex;align-items:center;border:1px solid #a9d8d2;background:#e9fbf7;color:#00796b;border-radius:999px;padding:7px 12px;font-size:13px;font-weight:900}.order-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:10px}.card{border:1px solid #d9e4e0;border-radius:7px;background:#fbfdfc;padding:14px}.card.preparing{background:var(--hot);border-color:#e7cd9f}.card.ready,.card.served{background:var(--ready);border-color:#b9dec9}.order-no{font-size:32px;font-weight:900;color:#123f45}.items{font-size:25px;font-weight:900;margin:10px 0}.items div{margin:7px 0}.item-quantity{color:#a52d1f}.meta{display:flex;flex-wrap:wrap;gap:7px;margin:8px 0}.tag{font-size:13px;background:#eef3f0;border-radius:999px;padding:5px 8px;color:#36575b;font-weight:800}.wait{color:#a33d25}.note{color:#7a4b16;font-weight:800}.actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:12px}.actions button{min-width:150px}button{padding:12px 15px;border:0;border-radius:5px;background:#0f7668;color:#fff;font:900 17px Arial,sans-serif;cursor:pointer}button:disabled{opacity:.55;cursor:not-allowed}.prep-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}.prep-item{border:1px solid #e2dbcf;border-radius:6px;padding:12px;background:#fdfbf7}.prep-item strong{display:block;font-size:22px}.summary{font-size:18px;color:#40545a;font-weight:900}.empty{color:var(--muted);font-weight:800;padding:8px 0}@media(max-width:900px){main{padding:10px}.top{align-items:stretch;flex-wrap:wrap}.section{padding:13px}.order-list{grid-template-columns:1fr}.order-no{font-size:34px}.items{font-size:26px}.actions button{width:100%;font-size:19px}}@media(min-width:901px) and (max-width:1180px){.items{font-size:23px}}
  </style>
</head>
<body>
  <main>
    <header class="top">
      <div>
        <div class="brand">荒島餐車</div>
        <h1>廚房出餐</h1>
        <p id="event" class="event">讀取場次中...</p>
      </div>
      ${renderRealtimeDebug("Kitchen")}
      <details class="system-menu">
        <summary>系統</summary>
        <nav class="system-links" aria-label="系統連結">
          <a href="/pos">POS 點餐</a>
          <span class="current" aria-disabled="true">廚房系統</span>
          <a href="/admin">後台管理</a>
        </nav>
      </details>
    </header>

    <p id="page-state" class="page-state">正在讀取中央訂單…</p>

    <section class="section">
      <div class="section-head"><h2>目前要出的單</h2><span class="pill">30 分鐘內</span></div>
      <div id="pending" class="order-list"></div>
    </section>

    <section class="section">
      <div class="section-head"><h2>總製作份數</h2><span class="pill">自動更新</span></div>
      <div id="preparing" class="prep-list"></div>
    </section>

    <section class="section">
      <div class="section-head"><h2>最近已出餐</h2><span id="ready-count" class="pill">0</span></div>
      <p id="summary" class="summary">讀取中...</p>
      <div id="ready" class="order-list"></div>
      <span id="pending-count" hidden>0</span><span id="preparing-count" hidden>0</span>
    </section>
  </main>
  <script>
    const sync=window.__rosRealtime,$=id=>document.querySelector(id);
    const api=async(p,o={})=>{try{const r=await fetch(p,{headers:{'content-type':'application/json'},...o}),b=await r.json();if(!r.ok)throw Error(b.error?.message||'Request failed');sync.recordApiSuccess();return b.data}catch(e){sync.recordApiFailure();throw e}};
    function esc(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
    function paymentMethodLabel(value){if(value==='CASH')return '現金';if(value==='LINE_PAY')return 'LINE Pay';return '未填'}
    function waitMinutes(createdAt){return Math.max(0,Math.floor((Date.now()-new Date(createdAt).getTime())/60000))}
    function pickupLabel(value){return value?new Date(value).toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit'}):null}
    function card(o){const items=(o.items||[]).map(i=>'<div>'+esc(i.posName)+' <span class="item-quantity">x'+i.quantity+'</span>'+(i.notes?' <span class="note">('+esc(i.notes)+')</span>':'')+'</div>').join('')||'<div>沒有品項</div>',pickup=pickupLabel(o.scheduledPickupAt);let actions='';if(o.productionStatus==='not_started'||o.productionStatus==='queued')actions='<button data-id="'+o.orderId+'" data-status="preparing">開始製作</button>';if(o.productionStatus==='preparing')actions='<button data-id="'+o.orderId+'" data-status="ready">完成製作</button>';if(o.productionStatus==='ready')actions='<button data-id="'+o.orderId+'" data-status="served">已出餐</button>';return '<article class="card '+esc(o.productionStatus)+'"><div class="order-no">'+esc(o.orderNumber)+(o.customerName?' · '+esc(o.customerName):'')+'</div><div class="items">'+items+'</div><div class="meta">'+(pickup?'<span class="tag wait">預約 '+esc(pickup)+' 取餐</span>':'<span class="tag wait">等待 '+waitMinutes(o.createdAt)+' 分</span>')+(o.customerPhoneTail?'<span class="tag">電話尾碼 '+esc(o.customerPhoneTail)+'</span>':'')+'<span class="tag">付款 '+paymentMethodLabel(o.paymentMethod)+'</span><span class="tag">狀態 '+esc(o.productionStatus)+'</span></div>'+(o.notes?'<div class="note">訂單備註：'+esc(o.notes)+'</div>':'')+'<div class="actions">'+actions+'</div></article>'}
    function prepSummary(orders){const totals=new Map();for(const order of orders){for(const item of order.items||[]){totals.set(item.posName,(totals.get(item.posName)||0)+item.quantity)}}return [...totals.entries()].map(([name,quantity])=>'<article class="prep-item"><strong>'+esc(name)+' x'+quantity+'</strong><span>目前要製作</span></article>').join('')||'<p class="empty">目前 30 分鐘內沒有需要製作的餐點。</p>'}
    function servedSummary(orders){return orders.map(o=>'<article class="card served"><div class="order-no">'+esc(o.orderNumber)+(o.customerName?' · '+esc(o.customerName):'')+'</div><div class="items">'+((o.items||[]).map(i=>'<div>'+esc(i.posName)+' <span class="item-quantity">x'+i.quantity+'</span></div>').join('')||'<div>沒有品項</div>')+'</div><div class="meta"><span class="tag">已出餐</span>'+(o.servedAt?'<span class="tag">'+esc(new Date(o.servedAt).toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit'}))+'</span>':'')+'</div><div class="actions"><button type="button" data-revert-production="'+o.orderId+'">退回上一步</button></div></article>').join('')||'<p class="empty">目前沒有可退回的已出餐訂單。</p>'}
    async function load(){try{const e=await api('/api/events/current');sync.setEventId(e?.eventId);if(!e){$('#event').textContent='目前沒有營業中的場次';$('#page-state').textContent='請先至後台開啟場次，Kitchen 才會顯示中央訂單。';$('#page-state').className='page-state';$('#pending').innerHTML='<p class="empty">目前沒有要出的單。</p>';$('#preparing').innerHTML='<p class="empty">目前沒有需要製作的餐點。</p>';$('#ready').innerHTML='<p class="empty">目前沒有可退回的已出餐訂單。</p>';$('#summary').textContent='沒有開啟中的場次';$('#pending-count').textContent='0';$('#preparing-count').textContent='0';$('#ready-count').textContent='0';return}const orders=await api('/api/events/'+e.eventId+'/orders'),active=orders.filter(o=>o.orderStatus==='confirmed'&&o.productionStatus!=='served').sort((a,b)=>new Date(a.scheduledPickupAt||a.createdAt).getTime()-new Date(b.scheduledPickupAt||b.createdAt).getTime()),scheduled=active.filter(o=>o.scheduledPickupAt),served=orders.filter(o=>o.orderStatus==='confirmed'&&o.productionStatus==='served').sort((a,b)=>new Date(b.servedAt||b.createdAt).getTime()-new Date(a.servedAt||a.createdAt).getTime());$('#event').textContent=e.displayName+' · '+e.eventCode;$('#page-state').textContent=active.length?'中央訂單已同步。':'中央訂單已同步，目前沒有待製作訂單。';$('#page-state').className='page-state';$('#pending').innerHTML=active.map(card).join('')||'<p class="empty">目前沒有要出的單。</p>';$('#preparing').innerHTML=prepSummary(active);$('#ready').innerHTML=servedSummary(served);$('#pending-count').textContent=String(active.length);$('#preparing-count').textContent=String(active.reduce((sum,order)=>sum+(order.items||[]).reduce((itemSum,item)=>itemSum+item.quantity,0),0));$('#ready-count').textContent=String(served.length);$('#summary').textContent='目前要出的單 '+active.length+'，其中預約 '+scheduled.length+'；最近已出餐 '+served.length}catch(error){$('#page-state').textContent=(navigator.onLine?'中央資料讀取失敗：':'目前離線，無法讀取中央訂單：')+(error?.message||'未知錯誤');$('#page-state').className='page-state error';throw error}}
    document.addEventListener('click',async e=>{const revert=e.target.closest('button[data-revert-production]');if(revert){if(!confirm('確定將此訂單退回前一個製作狀態？\\n此操作不會取消訂單、退款或修改庫存。'))return;revert.disabled=true;try{const deviceId=new URLSearchParams(location.search).get('device')||'Kitchen';const order=await api('/api/orders/'+revert.dataset.revertProduction+'/production/revert-completion',{method:'POST',body:JSON.stringify({confirmed:true,reason:'accidental_completion',operator:'kitchen',deviceId})});$('#page-state').textContent='訂單已退回'+(order.productionStatus==='ready'?'待取餐':'前一個製作狀態')+'。';$('#page-state').className='page-state';await load()}catch(err){$('#page-state').textContent=(navigator.onLine?'退回失敗：':'目前離線，退回操作未送達中央：')+(err?.message||'未知錯誤');$('#page-state').className='page-state error'}finally{revert.disabled=false}return}const b=e.target.closest('button[data-status]');if(!b)return;b.disabled=true;try{await api('/api/orders/'+b.dataset.id+'/status',{method:'PATCH',body:JSON.stringify({status:b.dataset.status,operator:'kitchen'})});await load()}catch(err){$('#page-state').textContent=(navigator.onLine?'狀態更新失敗：':'目前離線，狀態未送達中央：')+(err?.message||'未知錯誤');$('#page-state').className='page-state error'}finally{b.disabled=false}});
    async function loadWithPauseNotice(){await load();try{const event=await api('/api/events/current');if(event?.status==='paused')$('#event').textContent+=' · 場次暫停中，僅處理現有訂單'}catch{}}
    sync.registerLoad(loadWithPauseNotice);
  </script>
</body>
</html>`;
}
