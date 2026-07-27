import { renderRealtimeDebug } from "../shared/realtime-debug.js";
import { renderVoiceRuntime } from "../shared/voice.js";

export function renderKitchen(): string {
  return `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>荒島餐車 Kitchen</title>
  <style>
    :root{font-family:Arial,"Noto Sans TC",sans-serif;color:#173237;background:#f3f0ea;--green:#0f7668;--blue:#294357;--red:#ba3b2f;--line:#d8cec0;--muted:#64727a;--paper:#fff;--soft:#f8f5ef;--ready:#dff2e7;--hot:#fff0d8;--shadow:0 6px 18px rgba(24,55,50,.07)}
    *{box-sizing:border-box}body{margin:0}button{font:inherit}main{max-width:1600px;margin:auto;padding:10px 12px 22px}
    .top{display:grid;grid-template-columns:minmax(260px,1fr) auto auto;gap:14px;align-items:start;margin-bottom:8px}.brand{color:#00796b;font-size:13px;font-weight:800}.top h1{font-size:30px;margin:3px 0 0}.event{color:var(--muted);font-weight:800;margin:5px 0 0}.event-status{display:inline-flex;margin-left:7px;border-radius:999px;padding:3px 8px;background:#e9fbf7;color:#08796b;font-size:12px}.event-status.paused{background:#fff0d8;color:#8a5b00}.event-status.closed{background:#f5e1de;color:#a52d1f}
    .system-menu{position:relative;z-index:20}.system-menu summary{list-style:none;border:1px solid #a9d8d2;background:#e9fbf7;color:#00796b;border-radius:999px;padding:10px 14px;font-weight:900;cursor:pointer}.system-menu summary::-webkit-details-marker{display:none}.system-links{position:absolute;right:0;top:44px;min-width:190px;display:grid;gap:6px;background:#fff;border:1px solid var(--line);border-radius:8px;padding:8px;box-shadow:0 12px 28px rgba(30,45,35,.16)}.system-links a,.system-links span{text-decoration:none;color:#24484b;border-radius:6px;padding:10px 12px;font-weight:900}.system-links a:hover{background:#edf5f1}.system-links .current{background:#eef3f0;color:#72817e;cursor:not-allowed}
    .sync-debug-toggle,.sync-debug{display:none!important}.sync-status{display:inline-flex!important;align-items:center;gap:6px;font-weight:900;margin:8px 0}.sync-status[data-state="connected"]{color:#08796b}.sync-status[data-state="reconnecting"]{color:#9a6700}.sync-status[data-state="offline"]{color:#ba3b2f}.sync-device-label{display:none}
    .metrics{display:grid;grid-template-columns:repeat(3,minmax(120px,1fr));gap:8px;margin:10px 0}.metric{border:1px solid var(--line);background:#fff;border-radius:6px;padding:9px 12px}.metric span{display:block;color:var(--muted);font-size:12px;font-weight:800}.metric strong{font-size:23px}
    .voice-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:10px 0}.voice-button{min-height:44px;border:1px solid #a9d8d2;border-radius:6px;background:#e9fbf7;color:#075f57;font-weight:900;cursor:pointer}.voice-button:active{background:#d4eee8}.voice-button:disabled{opacity:.55;cursor:not-allowed}
    .page-state{min-height:22px;margin:8px 0;font-weight:900;color:var(--muted)}.page-state.error{color:#a52d1f}.page-state.reconnecting{color:#9a6700}
    .lane-tabs{display:none}.board{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;align-items:start}.lane{background:#fff;border:1px solid var(--line);border-radius:7px;min-height:430px;padding:12px;box-shadow:var(--shadow)}.lane-head{display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:10px}.lane h2{font-size:21px;margin:0}.pill{display:inline-flex;align-items:center;justify-content:center;min-width:34px;border:1px solid #a9d8d2;background:#e9fbf7;color:#00796b;border-radius:999px;padding:6px 10px;font-size:13px;font-weight:900}
    .order-list{display:grid;gap:10px}.card{border:1px solid #d9e4e0;border-radius:7px;background:#fbfdfc;padding:14px}.card.preparing{background:var(--hot);border-color:#e7cd9f}.card.ready,.card.served{background:var(--ready);border-color:#b9dec9}.card-top{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.order-no{font-size:31px;font-weight:900;color:#123f45}.timing{font-size:14px;color:#a33d25;font-weight:900;text-align:right}.customer{font-size:17px;font-weight:900;margin-top:5px}.items{font-size:25px;font-weight:900;margin:11px 0}.items div{margin:7px 0}.item-quantity{color:#a52d1f;font-size:1.12em}.meta{display:flex;flex-wrap:wrap;gap:7px;margin:8px 0}.tag{font-size:13px;background:#eef3f0;border-radius:999px;padding:5px 8px;color:#36575b;font-weight:800}.note{color:#7a4b16;font-weight:800;border-left:3px solid #d7a14a;padding-left:8px}.actions{margin-top:12px}.actions button{width:100%;min-height:48px;border:0;border-radius:5px;background:#0f7668;color:#fff;font-weight:900;font-size:18px;cursor:pointer}.actions button:disabled{opacity:.55;cursor:not-allowed}.empty{color:var(--muted);font-weight:800;padding:12px 2px}
    .served-section{background:#fff;border:1px solid var(--line);border-radius:7px;margin-top:12px;padding:0 14px;box-shadow:var(--shadow)}.served-section summary{cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 0;font-size:20px;font-weight:900;list-style:none}.served-section summary::-webkit-details-marker{display:none}.served-section .order-list{grid-template-columns:repeat(auto-fill,minmax(300px,1fr));padding-bottom:14px}
    @media(max-width:900px){
      main{padding:9px}.top{grid-template-columns:minmax(0,1fr) auto;gap:8px}.top h1{font-size:27px}.top>.sync-status{grid-column:1/-1;grid-row:2}.metrics{grid-template-columns:repeat(3,minmax(0,1fr))}.metric{padding:8px}.metric strong{font-size:20px}.voice-grid{grid-template-columns:1fr 1fr 1fr}.voice-button{padding:9px 4px;font-size:14px}
      .lane-tabs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:5px;position:sticky;top:0;z-index:10;background:#f3f0ea;padding:5px 0 8px}.lane-tab{border:1px solid var(--line);border-radius:5px;background:#fff;color:#294b50;padding:11px 4px;font-weight:900;cursor:pointer}.lane-tab[aria-selected="true"]{background:var(--green);border-color:var(--green);color:#fff}
      .board{display:block}.lane{display:none;min-height:360px}.lane[data-active="true"]{display:block}.order-no{font-size:33px}.items{font-size:26px}.served-section{display:none}.served-section[data-active="true"]{display:block}.served-section summary{pointer-events:none}.served-section[open] .order-list{grid-template-columns:1fr}
    }
    @media(min-width:901px) and (max-width:1180px){.order-no{font-size:27px}.items{font-size:22px}.card{padding:11px}}
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

    <section class="voice-grid" aria-label="手動語音播報">
      <button id="voice-remaining" class="voice-button" type="button">剩餘播報</button>
      <button id="voice-reservations" class="voice-button" type="button">預約播報</button>
      <button id="voice-work" class="voice-button" type="button">工作播報</button>
    </section>

    <section class="metrics" aria-label="廚房工作摘要">
      <div class="metric"><span>待製作</span><strong id="pending-count">0</strong></div>
      <div class="metric"><span>製作中</span><strong id="preparing-count">0</strong></div>
      <div class="metric"><span>待取餐</span><strong id="ready-count">0</strong></div>
    </section>
    <p id="page-state" class="page-state">正在讀取中央訂單…</p>

    <nav class="lane-tabs" aria-label="廚房工作分頁">
      <button type="button" class="lane-tab" data-kitchen-tab="pending" aria-selected="true">待製作</button>
      <button type="button" class="lane-tab" data-kitchen-tab="preparing" aria-selected="false">製作中</button>
      <button type="button" class="lane-tab" data-kitchen-tab="ready" aria-selected="false">待取餐</button>
      <button type="button" class="lane-tab" data-kitchen-tab="served" aria-selected="false">已出餐</button>
    </nav>

    <section class="board" aria-label="廚房製作流程">
      <section id="pending-lane" class="lane" data-lane="pending" data-active="true">
        <div class="lane-head"><h2>待製作</h2><span id="pending-lane-count" class="pill">0</span></div>
        <div id="pending" class="order-list"></div>
      </section>
      <section id="preparing-lane" class="lane" data-lane="preparing" data-active="false">
        <div class="lane-head"><h2>製作中</h2><span id="preparing-lane-count" class="pill">0</span></div>
        <div id="preparing" class="order-list"></div>
      </section>
      <section id="ready-lane" class="lane" data-lane="ready" data-active="false">
        <div class="lane-head"><h2>待取餐</h2><span id="ready-lane-count" class="pill">0</span></div>
        <div id="ready" class="order-list"></div>
      </section>
    </section>

    <details id="served-section" class="served-section" data-lane="served" data-active="false" open>
      <summary><span>最近已出餐</span><span id="served-count" class="pill">0</span></summary>
      <div id="served" class="order-list"></div>
    </details>
  </main>
  ${renderVoiceRuntime()}
  <script>
    const sync=window.__rosRealtime,$=id=>document.getElementById(id);
    const state={event:null,orders:[],products:[],activeTab:'pending'};
    const api=async(p,o={})=>{try{const r=await fetch(p,{headers:{'content-type':'application/json'},...o}),b=await r.json();if(!r.ok)throw Error(b.error?.message||'Request failed');sync.recordApiSuccess();return b.data}catch(e){sync.recordApiFailure();throw e}};
    function esc(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
    function waitMinutes(createdAt){return Math.max(0,Math.floor((Date.now()-new Date(createdAt).getTime())/60000))}
    function timeLabel(value){return value?new Date(value).toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit'}):null}
    function sortWork(left,right){return new Date(left.scheduledPickupAt||left.createdAt).getTime()-new Date(right.scheduledPickupAt||right.createdAt).getTime()}
    function activeOrders(){return state.orders.filter(order=>order.orderStatus==='confirmed'&&!['served'].includes(order.productionStatus))}
    function reservationOrders(){const now=Date.now(),limit=now+30*60000;return activeOrders().filter(order=>{const pickup=new Date(order.scheduledPickupAt||0).getTime();return pickup>=now&&pickup<=limit}).sort(sortWork)}
    function speak(text){if(!window.__rosVoice.speak(text)){$('page-state').textContent='此瀏覽器不支援語音播報。';$('page-state').className='page-state error'}}
    function orderVoice(order){const pickup=order.scheduledPickupAt?'取餐時間 '+timeLabel(order.scheduledPickupAt)+'，':'',name=order.customerName||'現場客',tail=order.customerPhoneTail?'，電話尾碼 '+window.__rosVoice.digits(order.customerPhoneTail):'';return pickup+name+tail+'，'+window.__rosVoice.itemText(order.items)}
    function speakRemaining(){const products=state.products.filter(product=>Array.isArray(product.channels)&&product.channels.includes('pos'));speak(products.length?products.map(product=>product.posName+'可訂 '+product.customerAvailableQuantity+' 份').join('，'):'目前沒有可播報的剩餘商品。')}
    function speakReservations(){const orders=reservationOrders();speak(orders.length?'三十分鐘內預約，'+orders.map(orderVoice).join('。'):'目前三十分鐘內沒有未出餐預約。')}
    function speakWork(){const orders=activeOrders().sort(sortWork);speak(orders.length?'目前需要工作的訂單，'+orders.map(orderVoice).join('。'):'目前沒有待處理訂單。')}
    function orderItems(order){return (order.items||[]).map(item=>'<div>'+esc(item.posName)+' <span class="item-quantity">×'+item.quantity+'</span>'+(item.notes?' <span class="note">('+esc(item.notes)+')</span>':'')+'</div>').join('')||'<div>沒有品項</div>'}
    function workCard(order){const pickup=timeLabel(order.scheduledPickupAt),timing=pickup?'預約 '+esc(pickup):'等待 '+waitMinutes(order.createdAt)+' 分鐘';let action='';if(order.productionStatus==='not_started'||order.productionStatus==='queued')action='<button data-id="'+order.orderId+'" data-status="preparing">開始製作</button>';if(order.productionStatus==='preparing')action='<button data-id="'+order.orderId+'" data-status="ready">完成製作</button>';if(order.productionStatus==='ready')action='<button data-id="'+order.orderId+'" data-status="served">完成出餐</button>';return '<article class="card '+esc(order.productionStatus)+'" data-order-id="'+order.orderId+'"><div class="card-top"><div><div class="order-no">'+esc(order.orderNumber)+'</div><div class="customer">'+(order.customerName?esc(order.customerName):'現場客')+(order.customerPhoneTail?' · 尾碼 '+esc(order.customerPhoneTail):'')+'</div></div><div class="timing">'+timing+'</div></div><div class="items">'+orderItems(order)+'</div>'+(order.notes?'<div class="note">訂單備註：'+esc(order.notes)+'</div>':'')+'<div class="actions">'+action+'</div></article>'}
    function servedCard(order){const servedAt=timeLabel(order.servedAt),canRevert=order.orderStatus==='confirmed'&&order.productionStatus==='served';return '<article class="card served" data-order-id="'+order.orderId+'"><div class="card-top"><div><div class="order-no">'+esc(order.orderNumber)+'</div><div class="customer">'+(order.customerName?esc(order.customerName):'現場客')+(order.customerPhoneTail?' · 尾碼 '+esc(order.customerPhoneTail):'')+'</div></div><div class="timing">'+(servedAt?'出餐 '+esc(servedAt):'已出餐')+'</div></div><div class="items">'+orderItems(order)+'</div>'+(canRevert?'<div class="actions"><button type="button" data-revert-production="'+order.orderId+'">退回上一步</button></div>':'')+'</article>'}
    function groups(){const confirmed=state.orders.filter(order=>order.orderStatus==='confirmed'),pending=confirmed.filter(order=>order.productionStatus==='not_started'||order.productionStatus==='queued').sort(sortWork),preparing=confirmed.filter(order=>order.productionStatus==='preparing').sort(sortWork),ready=confirmed.filter(order=>order.productionStatus==='ready').sort(sortWork),served=state.orders.filter(order=>order.productionStatus==='served').sort((a,b)=>new Date(b.servedAt||b.createdAt).getTime()-new Date(a.servedAt||a.createdAt).getTime());return{pending,preparing,ready,served}}
    function renderTabs(){document.querySelectorAll('[data-kitchen-tab]').forEach(tab=>tab.setAttribute('aria-selected',String(tab.dataset.kitchenTab===state.activeTab)));document.querySelectorAll('[data-lane]').forEach(lane=>lane.dataset.active=String(lane.dataset.lane===state.activeTab))}
    function render(){const work=groups(),empty={pending:'目前沒有待製作訂單。',preparing:'目前沒有製作中訂單。',ready:'目前沒有待取餐訂單。'};for(const name of ['pending','preparing','ready']){$(name).innerHTML=work[name].map(workCard).join('')||'<p class="empty">'+empty[name]+'</p>';$(name+'-count').textContent=String(work[name].length);$(name+'-lane-count').textContent=String(work[name].length)}$('served').innerHTML=work.served.map(servedCard).join('')||'<p class="empty">目前沒有最近已出餐訂單。</p>';$('served-count').textContent=String(work.served.length);renderTabs()}
    function clearForNoEvent(){state.event=null;state.orders=[];state.products=[];$('event').textContent='目前沒有營業中的場次';$('page-state').textContent='請先至後台開啟場次，Kitchen 才會顯示中央訂單。';$('page-state').className='page-state';render()}
    async function load(){try{const event=await api('/api/events/current');sync.setEventId(event?.eventId);if(!event){clearForNoEvent();return}const [orders,products]=await Promise.all([api('/api/events/'+event.eventId+'/orders'),api('/api/events/current/products')]);state.event=event;state.orders=orders;state.products=products;const status=String(event.status||'').toUpperCase();$('event').innerHTML=esc(event.displayName)+' · '+esc(event.eventCode)+' <span class="event-status '+esc(event.status)+'">'+esc(status)+'</span>';$('page-state').textContent=event.status==='paused'?'場次暫停中，Kitchen 僅處理現有訂單。':'中央訂單已同步。';$('page-state').className='page-state';render()}catch(error){$('page-state').textContent=(navigator.onLine?'中央資料讀取失敗：':'目前離線，無法讀取中央訂單：')+(error?.message||'未知錯誤');$('page-state').className='page-state error';throw error}}
    async function updateStatus(button){button.disabled=true;try{await api('/api/orders/'+button.dataset.id+'/status',{method:'PATCH',body:JSON.stringify({status:button.dataset.status,operator:'kitchen'})});await load()}catch(error){$('page-state').textContent=(navigator.onLine?'狀態更新失敗：':'目前離線，狀態未送達中央：')+(error?.message||'未知錯誤');$('page-state').className='page-state error'}finally{button.disabled=false}}
    async function revertCompletion(button){if(!confirm('確定將此訂單退回前一個製作狀態？\\n此操作不會取消訂單、退款或修改庫存。'))return;button.disabled=true;try{const deviceId=new URLSearchParams(location.search).get('device')||'Kitchen';const order=await api('/api/orders/'+button.dataset.revertProduction+'/production/revert-completion',{method:'POST',body:JSON.stringify({confirmed:true,reason:'accidental_completion',operator:'kitchen',deviceId})});$('page-state').textContent='訂單已退回'+(order.productionStatus==='ready'?'待取餐':'前一個製作狀態')+'。';$('page-state').className='page-state';await load()}catch(error){$('page-state').textContent=(navigator.onLine?'退回失敗：':'目前離線，退回操作未送達中央：')+(error?.message||'未知錯誤');$('page-state').className='page-state error'}finally{button.disabled=false}}
    document.addEventListener('click',event=>{if(event.target.closest('#voice-remaining')){speakRemaining();return}if(event.target.closest('#voice-reservations')){speakReservations();return}if(event.target.closest('#voice-work')){speakWork();return}const tab=event.target.closest('[data-kitchen-tab]');if(tab){state.activeTab=tab.dataset.kitchenTab;renderTabs();return}const revert=event.target.closest('[data-revert-production]');if(revert){void revertCompletion(revert);return}const status=event.target.closest('[data-status]');if(status)void updateStatus(status)});
    sync.registerLoad(load);
  </script>
</body>
</html>`;
}
