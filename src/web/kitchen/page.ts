import { renderRealtimeDebug } from "../shared/realtime-debug.js";
import { renderVoiceRuntime } from "../shared/voice.js";
import { renderDisplayModeControls, renderDisplayModeRuntime, renderDisplayModeStyles } from "../shared/display-mode.js";

export function renderKitchen(): string {
  return `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>荒島餐車 Kitchen</title>
  <style>
    :root{font-family:Arial,"Noto Sans TC",sans-serif;color:#173237;background:#f3f0ea;--green:#13806e;--blue:#344b5f;--red:#bd4337;--line:#d8cec0;--muted:#64727a;--paper:#fff;--soft:#f8f5ef;--ready:#dff2e7;--hot:#fff0d8;--shadow:0 6px 18px rgba(24,55,50,.07)}
    *{box-sizing:border-box}body{margin:0}button{font:inherit}main{max-width:1600px;margin:auto;padding:10px 12px 22px}
    .top{display:grid;grid-template-columns:minmax(240px,1fr) auto auto auto;gap:8px;align-items:start;border-bottom:1px solid var(--line);padding-bottom:7px}.brand{color:#00796b;font-size:13px;font-weight:800}.top h1{font-size:27px;margin:2px 0 0}.event{color:var(--muted);font-weight:800;margin:3px 0 0}.event-status{display:inline-flex;margin-left:7px;border-radius:999px;padding:3px 8px;background:#e9fbf7;color:#08796b;font-size:12px}.event-status.paused{background:#fff0d8;color:#8a5b00}.event-status.closed{background:#f5e1de;color:#a52d1f}
    .system-menu{position:relative;z-index:20}.system-menu summary{list-style:none;border:1px solid #a9d8d2;background:#e9fbf7;color:#00796b;border-radius:999px;padding:10px 14px;font-weight:900;cursor:pointer}.system-menu summary::-webkit-details-marker{display:none}.system-links{position:absolute;right:0;top:44px;min-width:190px;display:grid;gap:6px;background:#fff;border:1px solid var(--line);border-radius:8px;padding:8px;box-shadow:0 12px 28px rgba(30,45,35,.16)}.system-links a,.system-links span{text-decoration:none;color:#24484b;border-radius:6px;padding:10px 12px;font-weight:900}.system-links a:hover{background:#edf5f1}.system-links .current{background:#eef3f0;color:#72817e;cursor:not-allowed}
    .voice-settings{position:relative;z-index:21}.voice-settings summary{list-style:none;width:44px;height:42px;display:grid;place-items:center;border:1px solid #a9d8d2;background:#fff;border-radius:999px;font-size:20px;cursor:pointer}.voice-settings summary::-webkit-details-marker{display:none}.voice-settings-panel{position:absolute;right:0;top:48px;width:min(310px,calc(100vw - 20px));background:#fff;border:1px solid var(--line);border-radius:7px;padding:13px;box-shadow:0 12px 28px rgba(30,45,35,.18)}.voice-settings-panel h2{font-size:18px;margin:0 0 9px}.voice-setting{display:flex;gap:8px;align-items:center;padding:7px 0;font-weight:800}.lead-options{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin:7px 0 10px}.lead-options label{display:flex;align-items:center;justify-content:center;gap:4px;border:1px solid var(--line);border-radius:5px;padding:8px 4px}.voice-test{width:100%;border:1px solid #a9d8d2;border-radius:5px;background:#e9fbf7;color:#075f57;padding:10px;font-weight:900;cursor:pointer}.voice-support{font-size:12px;color:var(--muted);margin:8px 0 0}
    .sync-status{display:inline-flex!important;align-items:center;gap:6px;font-weight:900;margin:6px 0}.sync-status #connection-status[data-state="connected"]{color:#08796b}.sync-status #connection-status[data-state="reconnecting"]{color:#9a6700}.sync-status #connection-status[data-state="offline"]{color:#ba3b2f}.sync-device-label{display:none}.sync-debug-toggle{border-radius:5px!important}.top>.sync-debug{grid-column:1/-1}.sync-debug[hidden]{display:none!important}
    .clock{display:flex;align-items:center;justify-content:center;height:68px;border:1px solid var(--line);border-radius:6px;background:var(--paper);font-size:40px;font-weight:900;letter-spacing:0;margin:9px 0}
    .voice-grid{display:grid;grid-template-columns:1fr;gap:7px;margin:0}.voice-button{min-height:62px;border:0;border-radius:6px;color:#fff;padding:10px 15px;text-align:left;font-weight:900;cursor:pointer}.voice-button strong,.voice-button span{display:block}.voice-button span{font-size:13px;font-weight:700;margin-top:5px;opacity:.9}.voice-button.remaining{background:var(--green)}.voice-button.reservations{background:var(--blue)}.voice-button.work{background:var(--red)}.voice-button:active{filter:brightness(.92)}.voice-button:disabled{opacity:.55;cursor:not-allowed}
    .page-state{min-height:22px;margin:8px 0;font-weight:900;color:var(--muted)}.page-state.error{color:#a52d1f}.page-state.reconnecting{color:#9a6700}
    .page-state.synced{height:0;min-height:0;margin:0;overflow:hidden}.production-summary{border:1px solid var(--line);border-radius:6px;background:var(--paper);overflow:hidden;margin-top:9px}.summary-head{display:flex;align-items:center;justify-content:space-between;gap:8px;background:#f0ece6;padding:9px 12px}.summary-head h2{font-size:18px;margin:0}.pill{display:inline-flex;align-items:center;justify-content:center;min-width:34px;border:1px solid #a9d8d2;background:#e9fbf7;color:#00796b;border-radius:999px;padding:5px 9px;font-size:13px;font-weight:900}.production-totals{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}.total-item{display:flex;align-items:center;justify-content:space-between;gap:8px;border-bottom:1px solid var(--line);padding:9px 12px;font-weight:800}.total-item:nth-child(odd){border-right:1px solid var(--line)}.total-item strong{font-size:18px}.total-empty{grid-column:1/-1;color:var(--muted);padding:12px;font-weight:800}
    .detail-tabs{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin:12px 0 9px}.detail-tab{border:1px solid var(--line);border-radius:5px;background:#fff;color:#294b50;padding:11px 5px;font-weight:900;cursor:pointer}.detail-tab[aria-selected="true"]{background:var(--green);border-color:var(--green);color:#fff}.detail-panel{display:none}.detail-panel[data-active="true"]{display:block}.detail-panel-title{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:9px}.detail-panel-title h2{font-size:21px;margin:0}.upcoming-list{display:grid;gap:10px}.upcoming-list>.order-list{display:contents}
    .order-list{display:grid;gap:10px}.card{border:1px solid #d9e4e0;border-radius:7px;background:#fbfdfc;padding:14px}.card.preparing{background:var(--hot);border-color:#e7cd9f}.card.ready,.card.served{background:var(--ready);border-color:#b9dec9}.card-top{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.order-no{font-size:31px;font-weight:900;color:#123f45}.timing{font-size:14px;color:#a33d25;font-weight:900;text-align:right}.customer{font-size:17px;font-weight:900;margin-top:5px}.items{font-size:25px;font-weight:900;margin:11px 0}.items div{margin:7px 0}.item-quantity{color:#a52d1f;font-size:1.12em}.meta{display:flex;flex-wrap:wrap;gap:7px;margin:8px 0}.tag{font-size:13px;background:#eef3f0;border-radius:999px;padding:5px 8px;color:#36575b;font-weight:800}.note{color:#7a4b16;font-weight:800;border-left:3px solid #d7a14a;padding-left:8px}.actions{margin-top:12px}.actions button{width:100%;min-height:48px;border:0;border-radius:5px;background:#0f7668;color:#fff;font-weight:900;font-size:18px;cursor:pointer}.actions button:disabled{opacity:.55;cursor:not-allowed}.empty{color:var(--muted);font-weight:800;padding:12px 2px}
    .served-list{grid-template-columns:repeat(auto-fill,minmax(300px,1fr))}
    @media(max-width:900px){
      main{padding:7px 8px 18px}.top{grid-template-columns:minmax(0,1fr) auto auto;gap:6px}.brand{font-size:15px}.top h1{font-size:29px;line-height:1.05;margin-top:4px}.event{font-size:18px;line-height:1.2;margin-top:7px}.event-status{font-size:14px;padding:4px 9px}.top>.sync-status{grid-column:1/-1;grid-row:2;margin:0}.clock{height:72px;font-size:52px;margin:8px 0}.voice-button{min-height:56px;padding:8px 13px}.voice-button span{margin-top:3px}.production-summary{margin-top:7px}.summary-head{padding:7px 10px}.production-totals{grid-template-columns:repeat(2,minmax(0,1fr))}.total-item{padding:7px 10px}.detail-tabs{position:sticky;top:0;z-index:10;background:#f3f0ea;padding-top:7px}.order-no{font-size:33px}.items{font-size:26px}.served-list{grid-template-columns:1fr}
    }
    @media(min-width:600px) and (max-width:900px){
      .brand{font-size:18px}.top h1{font-size:36px}.event{font-size:22px}.event-status{font-size:16px}.sync-status{font-size:17px}.clock{height:86px;font-size:66px}
    }
    @media(min-width:901px){.voice-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.voice-button{min-height:82px}.production-totals{grid-template-columns:repeat(4,minmax(0,1fr))}.total-item{border-right:1px solid var(--line)}.upcoming-list{grid-template-columns:repeat(3,minmax(0,1fr));align-items:start}.upcoming-list>.order-list{display:grid}.card{padding:12px}.order-no{font-size:27px}.items{font-size:22px}}
    ${renderDisplayModeStyles()}
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
      <details class="voice-settings">
        <summary aria-label="語音設定" title="語音設定">🔊</summary>
        <div class="voice-settings-panel">
          <h2>語音設定</h2>
          <label class="voice-setting"><input id="voice-enabled" type="checkbox">啟用自動語音</label>
          <label class="voice-setting"><input id="new-order-voice-enabled" type="checkbox">新訂單提醒</label>
          <label class="voice-setting"><input id="due-reminder-enabled" type="checkbox">預約提醒</label>
          <strong>提前提醒</strong>
          <div class="lead-options">
            <label><input type="radio" name="reminder-lead" value="5">5 分鐘</label>
            <label><input type="radio" name="reminder-lead" value="10">10 分鐘</label>
            <label><input type="radio" name="reminder-lead" value="15">15 分鐘</label>
          </div>
          <button id="voice-test" class="voice-test" type="button">測試語音</button>
          <p id="voice-support" class="voice-support"></p>
        </div>
      </details>
      <details class="system-menu">
        <summary>系統</summary>
        <nav class="system-links" aria-label="系統連結">
          <a href="/pos">POS 點餐</a>
          <span class="current" aria-disabled="true">廚房系統</span>
          <a href="/admin">後台管理</a>
          ${renderDisplayModeControls()}
        </nav>
      </details>
    </header>

    <div id="clock" class="clock" aria-label="目前時間">--:--</div>

    <section class="voice-grid" aria-label="手動語音播報">
      <button id="voice-remaining" class="voice-button remaining" type="button"><strong>剩餘語音</strong><span>目前客人可訂數量</span></button>
      <button id="voice-reservations" class="voice-button reservations" type="button"><strong>預約語音</strong><span>只念時間、姓名與品項</span></button>
      <button id="voice-work" class="voice-button work" type="button"><strong>待出餐語音</strong><span>現在有哪些餐點要出</span></button>
    </section>

    <p id="page-state" class="page-state">正在讀取中央訂單…</p>

    <section class="production-summary" aria-label="三十分鐘內總製作數量">
      <div class="summary-head">
        <h2>30 分鐘內總製作數量</h2>
        <span id="window-order-count" class="pill">0 張單</span>
      </div>
      <div id="production-totals" class="production-totals"></div>
    </section>

    <nav class="detail-tabs" aria-label="廚房訂單明細">
      <button type="button" class="detail-tab" data-kitchen-tab="upcoming" aria-selected="true">30 分鐘內的單</button>
      <button type="button" class="detail-tab" data-kitchen-tab="served" aria-selected="false">已出完的單</button>
    </nav>

    <section class="detail-panel" data-detail-panel="upcoming" data-active="true" aria-label="三十分鐘內的訂單">
      <div class="detail-panel-title"><h2>30 分鐘內的單</h2><span id="upcoming-count" class="pill">0</span></div>
      <div class="upcoming-list">
        <div id="pending" class="order-list"></div>
        <div id="preparing" class="order-list"></div>
        <div id="ready" class="order-list"></div>
      </div>
    </section>

    <section class="detail-panel" data-detail-panel="served" data-active="false" aria-label="已出完的訂單">
      <div class="detail-panel-title"><h2>已出完的單</h2><span id="served-count" class="pill">0</span></div>
      <div id="served" class="order-list served-list"></div>
    </section>
  </main>
  ${renderDisplayModeRuntime()}
  ${renderVoiceRuntime()}
  <script>
    const sync=window.__rosRealtime,$=id=>document.getElementById(id);
    const VOICE_SETTINGS_KEY='ros.kitchen.voice.settings.v1',REMINDER_LEDGER_KEY='ros.kitchen.voice.reminders.v1';
    const defaultVoiceSettings={voiceEnabled:true,reminderLeadMinutes:10,newOrderVoiceEnabled:true,dueReminderEnabled:true};
    const state={event:null,orders:[],products:[],activeTab:'upcoming',baselineEventId:null,renderFingerprint:null,windowFingerprint:null,voiceSettings:readVoiceSettings(),reminderLedger:readReminderLedger()};
    const api=async(p,o={})=>{try{const r=await fetch(p,{headers:{'content-type':'application/json'},...o}),b=await r.json();if(!r.ok)throw Error(b.error?.message||'Request failed');sync.recordApiSuccess();return b.data}catch(e){sync.recordApiFailure();throw e}};
    function esc(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
    function waitMinutes(createdAt){return Math.max(0,Math.floor((Date.now()-new Date(createdAt).getTime())/60000))}
    function timeLabel(value){return value?new Date(value).toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit'}):null}
    function updateClock(){$('clock').textContent=new Date().toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit',hourCycle:'h23'})}
    function sortWork(left,right){return new Date(left.scheduledPickupAt||left.createdAt).getTime()-new Date(right.scheduledPickupAt||right.createdAt).getTime()}
    function readVoiceSettings(){try{const saved=JSON.parse(localStorage.getItem(VOICE_SETTINGS_KEY)||'null');return{...defaultVoiceSettings,...saved,reminderLeadMinutes:[5,10,15].includes(Number(saved?.reminderLeadMinutes))?Number(saved.reminderLeadMinutes):10}}catch{return{...defaultVoiceSettings}}}
    function saveVoiceSettings(){localStorage.setItem(VOICE_SETTINGS_KEY,JSON.stringify(state.voiceSettings))}
    function readReminderLedger(){try{const saved=JSON.parse(localStorage.getItem(REMINDER_LEDGER_KEY)||'[]');return Array.isArray(saved)?saved.filter(item=>item&&typeof item.eventId==='string'&&typeof item.orderId==='string'&&typeof item.stage==='string').map(item=>({eventId:item.eventId,orderId:item.orderId,scheduledPickupAt:item.scheduledPickupAt||null,stage:item.stage})):[]}catch{return[]}}
    function saveReminderLedger(){state.reminderLedger=state.reminderLedger.slice(-500);localStorage.setItem(REMINDER_LEDGER_KEY,JSON.stringify(state.reminderLedger))}
    function ledgerHas(order,stage){return state.reminderLedger.some(item=>item.eventId===state.event?.eventId&&item.orderId===order.orderId&&item.scheduledPickupAt===(order.scheduledPickupAt||null)&&item.stage===stage)}
    function ledgerAdd(order,stage){if(ledgerHas(order,stage))return;state.reminderLedger.push({eventId:state.event.eventId,orderId:order.orderId,scheduledPickupAt:order.scheduledPickupAt||null,stage});saveReminderLedger()}
    function activeOrders(){return state.orders.filter(order=>order.orderStatus==='confirmed'&&!['served'].includes(order.productionStatus))}
    function workWindowOrders(){const limit=Date.now()+30*60000;return activeOrders().filter(order=>!order.scheduledPickupAt||new Date(order.scheduledPickupAt).getTime()<=limit).sort(sortWork)}
    function reservationOrders(){const now=Date.now(),limit=now+30*60000;return activeOrders().filter(order=>{const pickup=new Date(order.scheduledPickupAt||0).getTime();return pickup>=now&&pickup<=limit}).sort(sortWork)}
    function productionTotals(orders){const totals=new Map();for(const order of orders){for(const item of order.items||[]){const key=item.productId||item.posName;const current=totals.get(key)||{name:item.posName,quantity:0};current.quantity+=Number(item.quantity)||0;totals.set(key,current)}}return Array.from(totals.values())}
    function speak(text){if(!window.__rosVoice.speak(text)){$('page-state').textContent='此瀏覽器不支援語音播報。';$('page-state').className='page-state error'}}
    function orderVoice(order){const pickup=order.scheduledPickupAt?'取餐時間 '+timeLabel(order.scheduledPickupAt)+'，':'',name=order.customerName||'現場客',tail=order.customerPhoneTail?'，電話尾碼 '+window.__rosVoice.digits(order.customerPhoneTail):'';return '叫號 '+order.orderNumber+'，'+pickup+name+tail+'，'+window.__rosVoice.itemText(order.items)}
    function speakRemaining(){const products=state.products.filter(product=>Array.isArray(product.channels)&&product.channels.includes('pos'));speak(products.length?products.map(product=>product.posName+'可訂 '+product.customerAvailableQuantity+' 份').join('，'):'目前沒有可播報的剩餘商品。')}
    function speakReservations(){const orders=reservationOrders();speak(orders.length?'三十分鐘內預約，'+orders.map(orderVoice).join('。'):'目前三十分鐘內沒有未出餐預約。')}
    function speakWork(){const totals=productionTotals(workWindowOrders());speak(totals.length?'三十分鐘內需要製作，'+totals.map(item=>item.name+' '+item.quantity+' 份').join('，'):'目前三十分鐘內沒有待處理訂單。')}
    function reminderEligible(order){return order.orderStatus==='confirmed'&&!['served'].includes(order.productionStatus)&&!['cancelled','no_show','completed'].includes(order.orderStatus)&&Boolean(order.scheduledPickupAt)}
    function processAutomaticVoice(isBaseline=false){if(!state.event)return;const messages=[],now=Date.now(),lead=state.voiceSettings.reminderLeadMinutes*60000;for(const order of state.orders){const isActive=order.orderStatus==='confirmed'&&order.productionStatus!=='served';if(!ledgerHas(order,'new')){ledgerAdd(order,'new');if(!isBaseline&&isActive&&state.voiceSettings.voiceEnabled&&state.voiceSettings.newOrderVoiceEnabled)messages.push('新訂單，'+orderVoice(order))}if(!reminderEligible(order))continue;const pickup=new Date(order.scheduledPickupAt).getTime(),remaining=pickup-now;if(remaining>0&&remaining<=lead&&!ledgerHas(order,'before')){ledgerAdd(order,'before');if(!isBaseline&&state.voiceSettings.voiceEnabled&&state.voiceSettings.dueReminderEnabled)messages.push('預約提前提醒，'+orderVoice(order))}if(remaining<=0&&remaining>=-5*60000&&!ledgerHas(order,'due')){ledgerAdd(order,'due');if(!isBaseline&&state.voiceSettings.voiceEnabled&&state.voiceSettings.dueReminderEnabled)messages.push('預約到點提醒，'+orderVoice(order))}}if(messages.length)speak(messages.join('。'))}
    function renderVoiceSettings(){$('voice-enabled').checked=state.voiceSettings.voiceEnabled;$('new-order-voice-enabled').checked=state.voiceSettings.newOrderVoiceEnabled;$('due-reminder-enabled').checked=state.voiceSettings.dueReminderEnabled;document.querySelectorAll('input[name="reminder-lead"]').forEach(input=>input.checked=Number(input.value)===state.voiceSettings.reminderLeadMinutes);$('voice-support').textContent=window.__rosVoice.supported?'語音由此 Kitchen 裝置播放。':'此瀏覽器不支援語音播報。'}
    function orderItems(order){return (order.items||[]).map(item=>'<div>'+esc(item.posName)+' <span class="item-quantity">×'+item.quantity+'</span>'+(item.notes?' <span class="note">('+esc(item.notes)+')</span>':'')+'</div>').join('')||'<div>沒有品項</div>'}
    function workCard(order){const pickup=timeLabel(order.scheduledPickupAt),timing=pickup?'預約 '+esc(pickup):'等待 '+waitMinutes(order.createdAt)+' 分鐘';let action='';if(order.productionStatus==='not_started'||order.productionStatus==='queued')action='<button data-id="'+order.orderId+'" data-status="preparing">開始製作</button>';if(order.productionStatus==='preparing')action='<button data-id="'+order.orderId+'" data-status="ready">完成製作</button>';if(order.productionStatus==='ready')action='<button data-id="'+order.orderId+'" data-status="served">完成出餐</button>';return '<article class="card '+esc(order.productionStatus)+'" data-order-id="'+order.orderId+'"><div class="card-top"><div><div class="order-no">'+esc(order.orderNumber)+'</div><div class="customer">'+(order.customerName?esc(order.customerName):'現場客')+(order.customerPhoneTail?' · 尾碼 '+esc(order.customerPhoneTail):'')+'</div></div><div class="timing" data-created-at="'+esc(order.createdAt)+'" data-scheduled-pickup-at="'+esc(order.scheduledPickupAt||'')+'">'+timing+'</div></div><div class="items">'+orderItems(order)+'</div>'+(order.notes?'<div class="note">訂單備註：'+esc(order.notes)+'</div>':'')+'<div class="actions">'+action+'</div></article>'}
    function servedCard(order){const servedAt=timeLabel(order.servedAt),canRevert=order.orderStatus==='confirmed'&&order.productionStatus==='served';return '<article class="card served" data-order-id="'+order.orderId+'"><div class="card-top"><div><div class="order-no">'+esc(order.orderNumber)+'</div><div class="customer">'+(order.customerName?esc(order.customerName):'現場客')+(order.customerPhoneTail?' · 尾碼 '+esc(order.customerPhoneTail):'')+'</div></div><div class="timing">'+(servedAt?'出餐 '+esc(servedAt):'已出餐')+'</div></div><div class="items">'+orderItems(order)+'</div>'+(canRevert?'<div class="actions"><button type="button" data-revert-production="'+order.orderId+'">退回上一步</button></div>':'')+'</article>'}
    function groups(){const windowOrders=workWindowOrders(),pending=windowOrders.filter(order=>order.productionStatus==='not_started'||order.productionStatus==='queued'),preparing=windowOrders.filter(order=>order.productionStatus==='preparing'),ready=windowOrders.filter(order=>order.productionStatus==='ready'),served=state.orders.filter(order=>order.productionStatus==='served').sort((a,b)=>new Date(b.servedAt||b.createdAt).getTime()-new Date(a.servedAt||a.createdAt).getTime());return{windowOrders,pending,preparing,ready,served}}
    function currentWindowFingerprint(){return JSON.stringify(workWindowOrders().map(order=>[order.orderId,order.productionStatus,order.scheduledPickupAt,order.items]))}
    function renderTabs(){document.querySelectorAll('[data-kitchen-tab]').forEach(tab=>tab.setAttribute('aria-selected',String(tab.dataset.kitchenTab===state.activeTab)));document.querySelectorAll('[data-detail-panel]').forEach(panel=>panel.dataset.active=String(panel.dataset.detailPanel===state.activeTab))}
    function render(){const work=groups(),totals=productionTotals(work.windowOrders);$('pending').innerHTML=work.pending.map(workCard).join('')||(!work.windowOrders.length?'<p class="empty">目前三十分鐘內沒有待處理訂單。</p>':'');$('preparing').innerHTML=work.preparing.map(workCard).join('');$('ready').innerHTML=work.ready.map(workCard).join('');$('upcoming-count').textContent=String(work.windowOrders.length);$('window-order-count').textContent=work.windowOrders.length+' 張單';$('production-totals').innerHTML=totals.length?totals.map(item=>'<div class="total-item"><span>'+esc(item.name)+'</span><strong>'+item.quantity+' 份</strong></div>').join(''):'<p class="total-empty">目前三十分鐘內沒有需要製作的餐點。</p>';$('served').innerHTML=work.served.map(servedCard).join('')||'<p class="empty">目前沒有已出完的訂單。</p>';$('served-count').textContent=String(work.served.length);state.windowFingerprint=currentWindowFingerprint();renderTabs()}
    function renderFingerprint(event,orders,products){return JSON.stringify([event.eventId,event.status,orders,products.map(product=>[product.productId,product.productVersionId,product.customerAvailableQuantity,product.remainingQuantity])])}
    function updateTimingLabels(){document.querySelectorAll('.timing[data-created-at]').forEach(target=>{const pickup=target.dataset.scheduledPickupAt;target.textContent=pickup?'預約 '+timeLabel(pickup):'等待 '+waitMinutes(target.dataset.createdAt)+' 分鐘'})}
    function refreshWindow(){const fingerprint=currentWindowFingerprint();if(fingerprint!==state.windowFingerprint)render();else updateTimingLabels()}
    function clearForNoEvent(){const changed=state.renderFingerprint!=='no-event';state.event=null;state.orders=[];state.products=[];state.baselineEventId=null;state.renderFingerprint='no-event';state.windowFingerprint=null;$('event').textContent='目前沒有營業中的場次';$('page-state').textContent='請先至後台開啟場次，Kitchen 才會顯示中央訂單。';$('page-state').className='page-state';if(changed)render()}
    async function load(){try{const event=await api('/api/events/current');sync.setEventId(event?.eventId);if(!event){clearForNoEvent();return}const [orders,products]=await Promise.all([api('/api/events/'+event.eventId+'/orders'),api('/api/events/current/products')]),isBaseline=state.baselineEventId!==event.eventId,fingerprint=renderFingerprint(event,orders,products),changed=fingerprint!==state.renderFingerprint;state.event=event;state.orders=orders;state.products=products;state.baselineEventId=event.eventId;state.renderFingerprint=fingerprint;const status=String(event.status||'').toUpperCase();$('event').innerHTML=esc(event.displayName)+' · '+esc(event.eventCode)+' <span class="event-status '+esc(event.status)+'">'+esc(status)+'</span>';$('page-state').textContent=event.status==='paused'?'場次暫停中，Kitchen 僅處理現有訂單。':'中央訂單已同步。';$('page-state').className=event.status==='paused'?'page-state':'page-state synced';if(changed)render();else refreshWindow();processAutomaticVoice(isBaseline)}catch(error){$('page-state').textContent=(navigator.onLine?'中央資料讀取失敗：':'目前離線，無法讀取中央訂單：')+(error?.message||'未知錯誤');$('page-state').className='page-state error';throw error}}
    async function updateStatus(button){button.disabled=true;try{await api('/api/orders/'+button.dataset.id+'/status',{method:'PATCH',body:JSON.stringify({status:button.dataset.status,operator:'kitchen'})});await load()}catch(error){$('page-state').textContent=(navigator.onLine?'狀態更新失敗：':'目前離線，狀態未送達中央：')+(error?.message||'未知錯誤');$('page-state').className='page-state error'}finally{button.disabled=false}}
    async function revertCompletion(button){if(!confirm('確定將此訂單退回前一個製作狀態？\\n此操作不會取消訂單、退款或修改庫存。'))return;button.disabled=true;try{const deviceId=new URLSearchParams(location.search).get('device')||'Kitchen';const order=await api('/api/orders/'+button.dataset.revertProduction+'/production/revert-completion',{method:'POST',body:JSON.stringify({confirmed:true,reason:'accidental_completion',operator:'kitchen',deviceId})});$('page-state').textContent='訂單已退回'+(order.productionStatus==='ready'?'待取餐':'前一個製作狀態')+'。';$('page-state').className='page-state';await load()}catch(error){$('page-state').textContent=(navigator.onLine?'退回失敗：':'目前離線，退回操作未送達中央：')+(error?.message||'未知錯誤');$('page-state').className='page-state error'}finally{button.disabled=false}}
    document.addEventListener('click',event=>{if(event.target.closest('#voice-test')){speak('荒島餐車語音測試，聲音清楚。');return}if(event.target.closest('#voice-remaining')){speakRemaining();return}if(event.target.closest('#voice-reservations')){speakReservations();return}if(event.target.closest('#voice-work')){speakWork();return}const tab=event.target.closest('[data-kitchen-tab]');if(tab){state.activeTab=tab.dataset.kitchenTab;renderTabs();return}const revert=event.target.closest('[data-revert-production]');if(revert){void revertCompletion(revert);return}const status=event.target.closest('[data-status]');if(status)void updateStatus(status)});
    document.addEventListener('change',event=>{const input=event.target;if(input.id==='voice-enabled')state.voiceSettings.voiceEnabled=input.checked;if(input.id==='new-order-voice-enabled')state.voiceSettings.newOrderVoiceEnabled=input.checked;if(input.id==='due-reminder-enabled')state.voiceSettings.dueReminderEnabled=input.checked;if(input.name==='reminder-lead')state.voiceSettings.reminderLeadMinutes=Number(input.value);saveVoiceSettings();renderVoiceSettings();processAutomaticVoice(false)});
    sync.registerLoad(load);renderVoiceSettings();updateClock();setInterval(()=>{updateClock();refreshWindow();processAutomaticVoice(false)},30000);
  </script>
</body>
</html>`;
}
