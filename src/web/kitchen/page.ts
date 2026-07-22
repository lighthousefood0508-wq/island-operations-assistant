import { renderRealtimeDebug } from "../shared/realtime-debug.js";

export function renderKitchen(): string {
  return `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>荒島餐車 Kitchen</title>
  <style>
    :root{font-family:Arial,"Noto Sans TC",sans-serif;color:#173237;background:#f3f0ea;--green:#0f7668;--blue:#294357;--red:#ba3b2f;--line:#d8cec0;--muted:#64727a;--paper:#fff;--soft:#f8f5ef;--ready:#dff2e7;--hot:#fff0d8}*{box-sizing:border-box}body{margin:0}main{padding:10px 12px 18px}.top{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:10px}.brand{color:#00796b;font-size:13px;font-weight:800}.top h1{font-size:28px;margin:3px 0 0}.event{color:var(--muted);font-weight:800;margin:5px 0 0}.system-menu{position:relative;z-index:20}.system-menu summary{list-style:none;border:1px solid #a9d8d2;background:#e9fbf7;color:#00796b;border-radius:999px;padding:9px 13px;font-weight:900;cursor:pointer}.system-menu summary::-webkit-details-marker{display:none}.system-links{position:absolute;right:0;top:42px;min-width:190px;display:grid;gap:6px;background:#fff;border:1px solid var(--line);border-radius:8px;padding:8px;box-shadow:0 12px 28px rgba(30,45,35,.16)}.system-links a,.system-links span{text-decoration:none;color:#24484b;border-radius:6px;padding:10px 12px;font-weight:900}.system-links a:hover{background:#edf5f1}.system-links .current,.system-links .disabled{background:#eef3f0;color:#72817e;cursor:not-allowed}.sync-status,.sync-debug-toggle,.sync-debug{display:none!important}.voice-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:14px 0}.voice-card{border:0;border-radius:5px;min-height:176px;padding:24px 22px;color:#fff;text-align:left;display:flex;flex-direction:column;justify-content:space-between}.voice-card strong{font-size:30px;line-height:1.1}.voice-card span{font-size:15px;font-weight:900}.voice-remaining{background:var(--green)}.voice-reservation{background:var(--blue)}.voice-pending{background:var(--red)}.section{background:#fff;border:1px solid var(--line);border-radius:6px;margin-top:12px;padding:16px}.section-head{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:10px}.section h2{font-size:21px;margin:0}.pill{display:inline-flex;align-items:center;border:1px solid #a9d8d2;background:#e9fbf7;color:#00796b;border-radius:999px;padding:7px 12px;font-size:13px;font-weight:900}.order-list{display:grid;gap:10px}.card{border:1px solid #d9e4e0;border-radius:7px;background:#fbfdfc;padding:12px}.card.preparing{background:var(--hot);border-color:#e7cd9f}.card.ready,.card.served{background:var(--ready);border-color:#b9dec9}.order-no{font-size:28px;font-weight:900;color:#123f45}.items{font-size:22px;font-weight:900;margin:10px 0}.items div{margin:5px 0}.meta{display:flex;flex-wrap:wrap;gap:7px;margin:8px 0}.tag{font-size:13px;background:#eef3f0;border-radius:999px;padding:5px 8px;color:#36575b;font-weight:800}.wait{color:#a33d25}.note{color:#7a4b16;font-weight:800}.actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:9px}button{padding:12px 15px;border:0;border-radius:5px;background:#0f7668;color:#fff;font:900 16px Arial,sans-serif;cursor:pointer}button:disabled{opacity:.55;cursor:not-allowed}.prep-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}.prep-item{border:1px solid #e2dbcf;border-radius:6px;padding:12px;background:#fdfbf7}.prep-item strong{display:block;font-size:22px}.summary{font-size:18px;color:#40545a;font-weight:900}.empty{color:var(--muted);font-weight:800;padding:8px 0}@media(max-width:900px){main{padding:10px}.top{align-items:stretch}.voice-grid{grid-template-columns:1fr}.voice-card{min-height:128px}.section{padding:13px}.order-no{font-size:30px}.items{font-size:23px}.actions button{width:100%;font-size:18px}}@media(min-width:901px) and (max-width:1180px){.voice-card{min-height:150px}.voice-card strong{font-size:26px}.items{font-size:20px}}
  </style>
</head>
<body>
  <main>
    <header class="top">
      <div>
        <div class="brand">荒島餐車</div>
        <h1>廚房語音系統</h1>
        <p id="event" class="event">讀取場次中...</p>
      </div>
      ${renderRealtimeDebug("Kitchen")}
      <details class="system-menu">
        <summary>系統</summary>
        <nav class="system-links" aria-label="系統連結">
          <a href="/pos">POS 點餐</a>
          <span class="current" aria-disabled="true">廚房系統</span>
          <a href="/admin">後台管理</a>
          <a href="/admin/devices">裝置連線</a>
        </nav>
      </details>
    </header>

    <section class="voice-grid" aria-label="廚房語音快捷">
      <button class="voice-card voice-remaining" type="button" disabled><strong>剩餘語音</strong><span>目前剩餘主餐與小菜</span></button>
      <button class="voice-card voice-reservation" type="button" disabled><strong>預訂語音</strong><span>只念數量、時間、客人</span></button>
      <button class="voice-card voice-pending" type="button" disabled><strong>待出餐語音</strong><span>現在有哪些單要出</span></button>
    </section>

    <section class="section">
      <div class="section-head"><h2>目前要出的單</h2><span class="pill">30 分鐘內</span></div>
      <div id="pending" class="order-list"></div>
    </section>

    <section class="section">
      <div class="section-head"><h2>總製作份數</h2><span class="pill">自動更新</span></div>
      <div id="preparing" class="prep-list"></div>
    </section>

    <section class="section">
      <div class="section-head"><h2>目前同步狀態</h2><span id="ready-count" class="pill">0</span></div>
      <p id="summary" class="summary">讀取中...</p>
      <div id="ready" hidden></div>
      <span id="pending-count" hidden>0</span><span id="preparing-count" hidden>0</span>
    </section>
  </main>
  <script>
    const sync=window.__rosRealtime,$=id=>document.querySelector(id);
    const api=async(p,o={})=>{try{const r=await fetch(p,{headers:{'content-type':'application/json'},...o}),b=await r.json();if(!r.ok)throw Error(b.error?.message||'Request failed');sync.recordApiSuccess();return b.data}catch(e){sync.recordApiFailure();throw e}};
    function esc(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
    function paymentMethodLabel(value){if(value==='CASH')return '現金';if(value==='LINE_PAY')return 'LINE Pay';return '未填'}
    function waitMinutes(createdAt){return Math.max(0,Math.floor((Date.now()-new Date(createdAt).getTime())/60000))}
    function card(o){const items=(o.items||[]).map(i=>'<div>'+esc(i.posName)+' x'+i.quantity+(i.notes?' <span class="note">('+esc(i.notes)+')</span>':'')+'</div>').join('')||'<div>沒有品項</div>';let actions='';if(o.productionStatus==='not_started'||o.productionStatus==='queued')actions='<button data-id="'+o.orderId+'" data-status="preparing">開始製作</button>';if(o.productionStatus==='preparing')actions='<button data-id="'+o.orderId+'" data-status="ready">完成製作</button>';if(o.productionStatus==='ready')actions='<button data-id="'+o.orderId+'" data-status="served">已出餐</button>';return '<article class="card '+esc(o.productionStatus)+'"><div class="order-no">'+esc(o.orderNumber)+(o.customerName?' · '+esc(o.customerName):'')+'</div><div class="meta"><span class="tag wait">等待 '+waitMinutes(o.createdAt)+' 分</span>'+(o.customerPhoneTail?'<span class="tag">末四碼 '+esc(o.customerPhoneTail)+'</span>':'')+'<span class="tag">付款 '+paymentMethodLabel(o.paymentMethod)+'</span><span class="tag">狀態 '+esc(o.productionStatus)+'</span></div><div class="items">'+items+'</div>'+(o.notes?'<div class="note">訂單備註：'+esc(o.notes)+'</div>':'')+'<div class="actions">'+actions+'</div></article>'}
    function prepSummary(orders){const totals=new Map();for(const order of orders){for(const item of order.items||[]){totals.set(item.posName,(totals.get(item.posName)||0)+item.quantity)}}return [...totals.entries()].map(([name,quantity])=>'<article class="prep-item"><strong>'+esc(name)+' x'+quantity+'</strong><span>目前要製作</span></article>').join('')||'<p class="empty">目前 30 分鐘內沒有需要製作的餐點。</p>'}
    function hiddenReadySummary(orders){return orders.map(o=>'<article class="card '+esc(o.productionStatus)+'"><div class="order-no">'+esc(o.orderNumber)+'</div><div class="items">'+((o.items||[]).map(i=>'<div>'+esc(i.posName)+' x'+i.quantity+'</div>').join('')||'<div>沒有品項</div>')+'</div><span class="tag">狀態 '+esc(o.productionStatus)+'</span></article>').join('')}
    async function load(){const e=await api('/api/events/current');sync.setEventId(e?.eventId);if(!e){$('#event').textContent='目前沒有 OPEN Event';$('#pending').innerHTML='<p class="empty">目前沒有要出的單。</p>';$('#preparing').innerHTML='<p class="empty">目前沒有需要製作的餐點。</p>';$('#summary').textContent='沒有開啟中的場次';$('#pending-count').textContent='0';$('#preparing-count').textContent='0';$('#ready-count').textContent='0';return}const orders=await api('/api/events/'+e.eventId+'/orders'),active=orders.filter(o=>o.orderStatus==='confirmed'&&o.productionStatus!=='served'),ready=orders.filter(o=>['ready','served'].includes(o.productionStatus));$('#event').textContent=e.displayName+' · '+e.eventCode;$('#pending').innerHTML=active.map(card).join('')||'<p class="empty">目前 30 分鐘內沒有要出的單。</p>';$('#preparing').innerHTML=prepSummary(active);$('#ready').innerHTML=hiddenReadySummary(ready);$('#pending-count').textContent=String(active.length);$('#preparing-count').textContent=String(active.reduce((sum,order)=>sum+(order.items||[]).reduce((itemSum,item)=>itemSum+item.quantity,0),0));$('#ready-count').textContent=String(ready.length);$('#summary').textContent='剩餘總份數由 POS 顯示；目前要出的單 '+active.length+'，可取餐／已出餐 '+ready.length}
    document.addEventListener('click',async e=>{const b=e.target.closest('button[data-status]');if(!b)return;b.disabled=true;try{await api('/api/orders/'+b.dataset.id+'/status',{method:'PATCH',body:JSON.stringify({status:b.dataset.status,operator:'kitchen'})});await load()}catch(err){alert(err instanceof TypeError?'無法連線，請確認中央服務':err.message)}finally{b.disabled=false}});
    sync.registerLoad(load);
  </script>
</body>
</html>`;
}
