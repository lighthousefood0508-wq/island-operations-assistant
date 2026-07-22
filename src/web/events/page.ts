import { renderBackOfficeNav, renderNavigationStyles, renderSystemNav } from "../shared/navigation.js";

export function renderEventsAdmin(): string {
  return `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>場次與備貨 | 荒島 ROS 後台</title>
  <style>
    ${renderNavigationStyles()}
    :root{font-family:Arial,"Noto Sans TC",sans-serif;color:#183238;background:#f4f1eb;--green:#0f7668;--deep:#2f4858;--line:#d8cec0;--muted:#607176;--paper:#fff;--warn:#b84933;--soft:#eef4f1;--gold:#fff2d1}
    *{box-sizing:border-box}body{margin:0}main{max-width:1400px;margin:0 auto;padding:18px}header{border-bottom:2px solid var(--green);padding-bottom:12px}h1{margin:0;font-size:30px}h2{font-size:22px;margin:0 0 12px}.subtitle,.meta{margin:4px 0 0;color:var(--muted);font-size:13px}.notice{min-height:22px;color:#13643b;font-weight:900}.notice.error{color:#a52e1b}.grid{display:grid;grid-template-columns:minmax(320px,.9fr) minmax(560px,1.45fr);gap:14px}.card{background:#fff;border:1px solid var(--line);border-radius:7px;padding:14px}.stack{display:grid;gap:12px}.row{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}label{display:grid;gap:6px;color:#40545a;font-size:13px;font-weight:800}input,select,button{font:inherit}input,select{width:100%;border:1px solid #aebfbc;border-radius:5px;background:#fff;padding:9px}button{border:0;background:var(--green);color:#fff;border-radius:5px;padding:10px 12px;font-weight:900;cursor:pointer}button.secondary{background:#617477}button.warn{background:var(--warn)}button.ghost{background:#eef4f1;color:#244b50;border:1px solid #c4d3cf}button:disabled,input:disabled,select:disabled{opacity:.58;cursor:not-allowed}.status{display:inline-flex;padding:3px 8px;border-radius:999px;font-size:12px;font-weight:900;background:#eef1ef}.status.open{background:#dff2e7;color:#13643b}.status.draft,.status.unknown{background:var(--gold);color:#7a5613}.status.closed,.status.archived{background:#f4e1dc;color:#8a321c}.event-list{display:grid;gap:8px;margin-top:12px;max-height:330px;overflow:auto}.event-card{border:1px solid #d8e1df;border-radius:6px;padding:10px;display:flex;justify-content:space-between;gap:12px;align-items:center;background:#fff}.event-card.active{border-color:var(--green);box-shadow:0 0 0 2px rgba(15,118,104,.12)}.section-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-end}.helper{border-left:4px solid #d7cec2;padding-left:10px;color:#607176}.actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.add-inventory{display:grid;grid-template-columns:minmax(240px,1.4fr) 130px 130px auto;gap:8px;align-items:end;margin-top:12px}.table-wrap{overflow:auto;border:1px solid var(--line);border-radius:7px;background:#fff}table{border-collapse:collapse;width:100%;min-width:1120px}th{background:var(--deep);color:#fff;text-align:left;font-size:13px;padding:10px 9px;white-space:nowrap}td{border-top:1px solid #e5ddd1;padding:9px;vertical-align:middle}.item-name strong{font-size:18px}.item-name span{display:block}.inline-input{max-width:105px}.number{font-weight:900}.soldout{color:#9b2d1d}.safe{color:#8a4a16}.empty{color:var(--muted);padding:12px}.hidden{display:none!important}@media(max-width:960px){main{padding:12px}.grid,.row,.add-inventory{grid-template-columns:1fr}.section-head{align-items:flex-start;flex-direction:column}.event-card{align-items:flex-start;flex-direction:column}.table-wrap{border:0}table{min-width:0}thead{display:none}tr{display:block;border:1px solid var(--line);border-radius:7px;margin:10px 0;background:#fff}td{display:grid;grid-template-columns:124px 1fr;border-top:1px solid #eee5d9}td::before{content:attr(data-label);font-weight:900;color:#607176}}
  </style>
</head>
<body>
  ${renderSystemNav("admin")}
  <main>
    <header>
      <h1>場次與備貨</h1>
      <p class="subtitle">每天先建立或選擇場次，再加入本場販售商品並設定備貨。場次代碼由系統依日期產生，例如 20260726-01。</p>
      <p id="notice" class="notice"></p>
    </header>
    ${renderBackOfficeNav("events")}
    <div class="grid">
      <section class="card">
        <h2>建立／選擇場次</h2>
        <form id="event-form" class="stack">
          <input id="event-id" type="hidden">
          <input id="event-code" type="hidden">
          <label>出車日期<input id="event-date" type="date" required></label>
          <label>場次名稱<input id="event-name" required placeholder="例如 平鎮、勇仔、土城"></label>
          <div class="row">
            <label>開始時間<input id="event-start" type="time" required></label>
            <label>結束時間<input id="event-end" type="time" required></label>
          </div>
          <button type="submit">儲存場次</button>
        </form>
        <div id="events" class="event-list"></div>
      </section>
      <section class="card">
        <div class="section-head">
          <div>
            <h2>本場販售商品</h2>
            <p id="event-summary" class="meta">請先建立或選擇場次。</p>
          </div>
          <div id="event-actions" class="actions hidden">
            <button id="open-event" type="button">開場</button>
            <button id="close-event" type="button" class="warn">關場</button>
            <button id="archive-event" type="button" class="secondary">封存</button>
          </div>
        </div>
        <p id="inventory-hint" class="helper">選擇草稿場次後，可從已發布商品加入本場，並設定備貨與安全預留。</p>
        <form id="inventory-form" class="add-inventory hidden">
          <label>已發布商品<select id="inventory-product" required></select></label>
          <label>備貨<input id="planned-quantity" type="number" min="0" required></label>
          <label>安全預留<input id="safety-buffer-quantity" type="number" min="0" value="0" required></label>
          <button type="submit">加入本場</button>
        </form>
      </section>
    </div>
    <section class="card" style="margin-top:14px">
      <div class="section-head">
        <h2>今日備貨與剩餘</h2>
        <button id="reload" class="ghost" type="button">重新讀取</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>品項</th><th>分類</th><th>售價</th><th>通路</th><th>版本</th><th>備貨</th><th>安全預留</th><th>客人可訂</th><th>預約</th><th>現場售出</th><th>目前訂單</th><th>剩餘</th><th>操作</th></tr></thead>
          <tbody id="inventory"></tbody>
        </table>
      </div>
    </section>
  </main>
  <script>
const state={events:[],products:[],inventory:[],orders:[],selected:null};
const $=id=>document.querySelector('#'+id);
const notice=$('notice');
const esc=value=>String(value??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const api=async(path,options={})=>{const response=await fetch(path,{headers:{'content-type':'application/json'},...options});const body=await response.json();if(!response.ok)throw new Error(body.error?.message||'Request failed');return body.data};
function message(text,error=false){notice.textContent=text;notice.className='notice'+(error?' error':'');setTimeout(()=>{if(notice.textContent===text)notice.textContent=''},3800)}
function selectedEvent(){return state.events.find(event=>event.eventId===state.selected)}
function canEditInventory(){const event=selectedEvent();return !!event&&event.status==='draft'}
function eventTitle(event){return event?event.displayName+' · '+event.eventCode+' · '+event.date+' '+event.startTime+'-'+event.endTime:'請先建立或選擇場次。'}
function activeQuantity(productVersionId){return state.orders.filter(order=>order.orderStatus==='confirmed'&&order.productionStatus!=='served').flatMap(order=>order.items||[]).filter(item=>item.productVersionId===productVersionId).reduce((sum,item)=>sum+item.quantity,0)}
function setBusy(busy){document.querySelectorAll('#inventory-form button,#event-actions button,#event-form button').forEach(button=>button.disabled=busy)}
function renderEvents(){$('events').innerHTML=state.events.map(event=>'<div class="event-card '+(event.eventId===state.selected?'active':'')+'"><div><strong>'+esc(event.displayName)+'</strong> <span class="status '+event.status+'">'+event.status+'</span><div class="meta">'+esc(event.eventCode)+' · '+esc(event.date)+' '+esc(event.startTime)+'-'+esc(event.endTime)+'</div></div><button class="secondary" data-event="'+event.eventId+'">選取</button></div>').join('')||'<div class="empty">目前沒有場次</div>'}
function renderControls(){const event=selectedEvent(),editable=canEditInventory();$('event-summary').textContent=eventTitle(event);$('inventory-form').classList.toggle('hidden',!editable);$('event-actions').classList.toggle('hidden',!event);$('inventory-hint').classList.toggle('hidden',editable);if(event&&!editable)$('inventory-hint').textContent='目前場次不是草稿，依現有規則不可修改備貨。';else $('inventory-hint').textContent='選擇草稿場次後，可從已發布商品加入本場，並設定備貨與安全預留。';$('open-event').classList.toggle('hidden',!event||event.status!=='draft');$('close-event').classList.toggle('hidden',!event||event.status!=='open');$('archive-event').classList.toggle('hidden',!event||!['draft','closed'].includes(event.status));const used=new Set(state.inventory.map(item=>item.productVersionId));$('inventory-product').innerHTML='<option value="">選擇商品</option>'+state.products.filter(product=>!used.has(product.productVersionId)).map(product=>'<option value="'+product.productVersionId+'">'+esc(product.displayCategoryName)+' · '+esc(product.posName)+' · NT$'+product.sellingPrice+'</option>').join('')}
function renderInventory(){const target=$('inventory'),editable=canEditInventory();if(!state.selected){target.innerHTML='<tr><td colspan="13" class="empty">請先選取場次。</td></tr>';return}target.innerHTML=state.inventory.map(item=>{const current=activeQuantity(item.productVersionId),planned=item.plannedQuantity||0,safety=item.safetyBufferQuantity||0,customer=item.customerAvailableQuantity||0,remaining=item.remainingQuantity||0,disabled=editable?'':'disabled';return '<tr><td data-label="品項" class="item-name"><strong>'+esc(item.posName||item.displayName||item.productVersionId)+'</strong><span class="meta">'+esc(item.displayName||'')+'</span></td><td data-label="分類">'+esc(item.displayCategoryName||'未分類')+'</td><td data-label="售價" class="number">NT$'+esc(item.sellingPrice??'-')+'</td><td data-label="通路">'+esc((item.channels||[]).join(', '))+'</td><td data-label="版本">v'+esc(item.contractVersion||'')+'</td><td data-label="備貨"><input class="inline-input" data-field="planned" type="number" min="0" value="'+planned+'" '+disabled+'></td><td data-label="安全預留"><input class="inline-input" data-field="safety" type="number" min="0" value="'+safety+'" '+disabled+'></td><td data-label="客人可訂" class="number '+(customer===0&&remaining>0?'safe':'')+'">'+customer+'</td><td data-label="預約" class="number">'+item.reservedQuantity+'</td><td data-label="現場售出" class="number">'+item.soldQuantity+'</td><td data-label="目前訂單" class="number">'+current+'</td><td data-label="剩餘" class="number '+(remaining===0?'soldout':'')+'">'+remaining+'</td><td data-label="操作"><div class="actions"><button data-save="'+esc(item.productVersionId)+'" '+disabled+'>儲存</button><button class="warn" data-stop="'+esc(item.productVersionId)+'" '+disabled+'>本場停用</button></div></td></tr>'}).join('')||'<tr><td colspan="13" class="empty">本場尚未加入販售商品。</td></tr>'}
function render(){renderEvents();renderControls();renderInventory()}
async function load(){[state.events,state.products]=await Promise.all([api('/api/admin/events'),api('/api/catalog/products/published')]);if(state.selected&&!state.events.some(event=>event.eventId===state.selected))state.selected=null;render();if(state.selected)await loadInventory()}
async function loadInventory(){if(!state.selected){state.inventory=[];state.orders=[];render();return}const event=selectedEvent();const [inventory,orders]=await Promise.all([api('/api/admin/events/'+state.selected+'/sellable-inventory'),event&&event.status==='open'?api('/api/events/'+state.selected+'/orders'):Promise.resolve([])]);state.inventory=inventory;state.orders=orders;render()}
async function saveInventory(productVersionId,plannedQuantity,safetyBufferQuantity){if(!state.selected)throw new Error('尚未選擇場次');if(safetyBufferQuantity>plannedQuantity)throw new Error('安全預留不可大於備貨');setBusy(true);try{await api('/api/admin/events/'+state.selected+'/sellable-inventory',{method:'PUT',body:JSON.stringify({productVersionId,plannedQuantity,safetyBufferQuantity})});await loadInventory();message('備貨已儲存')}finally{setBusy(false);renderControls()}}
function fillEventForm(event){state.selected=event.eventId;$('event-id').value=event.eventId;$('event-code').value=event.eventCode;$('event-name').value=event.displayName;$('event-date').value=event.date;$('event-start').value=event.startTime;$('event-end').value=event.endTime}
$('event-form').addEventListener('submit',async event=>{event.preventDefault();try{const id=$('event-id').value;const body={displayName:$('event-name').value,date:$('event-date').value,startTime:$('event-start').value,endTime:$('event-end').value};const result=await api(id?'/api/admin/events/'+id:'/api/admin/events',{method:id?'PATCH':'POST',body:JSON.stringify(body)});fillEventForm(result);await load();message('場次已儲存，系統代碼：'+result.eventCode)}catch(error){message(error.message,true)}});
$('inventory-form').addEventListener('submit',async event=>{event.preventDefault();try{const versionId=$('inventory-product').value;if(!versionId)throw new Error('請選擇商品');await saveInventory(versionId,Number($('planned-quantity').value),Number($('safety-buffer-quantity').value))}catch(error){message(error.message,true)}});
$('reload').addEventListener('click',()=>load().catch(error=>message(error.message,true)));
document.addEventListener('click',async event=>{const target=event.target;if(!(target instanceof HTMLElement))return;const eventButton=target.closest('[data-event]');const save=target.closest('[data-save]');const stop=target.closest('[data-stop]');try{if(eventButton){const chosen=state.events.find(item=>item.eventId===eventButton.dataset.event);if(!chosen)return;fillEventForm(chosen);await loadInventory();return}if(save){const row=save.closest('tr');await saveInventory(save.dataset.save,Number(row.querySelector('[data-field="planned"]').value),Number(row.querySelector('[data-field="safety"]').value));return}if(stop){await saveInventory(stop.dataset.stop,0,0)}}catch(error){message(error.message,true)}});
for(const [id,action,label] of [['open-event','open','場次已開啟'],['close-event','close','場次已關閉'],['archive-event','archive','場次已封存']]){$(id).addEventListener('click',async()=>{if(!state.selected)return;try{setBusy(true);const result=await api('/api/admin/events/'+state.selected+'/'+action,{method:'POST',body:'{}'});fillEventForm(result);await load();message(label)}catch(error){message(error.message,true)}finally{setBusy(false);renderControls()}})}
load().catch(error=>message(error.message,true));
  </script>
</body>
</html>`;
}
