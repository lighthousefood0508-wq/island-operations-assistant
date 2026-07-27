import { renderBackOfficeNav, renderNavigationStyles, renderSystemNav } from "../shared/navigation.js";
import { renderRealtimeDebug } from "../shared/realtime-debug.js";

export function renderStatistics(): string {
  return `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>今日統計 | 荒島餐車 ROS</title>
  <style>
    ${renderNavigationStyles()}
    :root{font-family:Arial,"Noto Sans TC",sans-serif;color:#18363b;background:#f6f3ed;--green:#08796b;--deep:#294a5d;--line:#d9d0c2;--paper:#fff;--muted:#617478;--warn:#bd4830;--soft:#edf5f1}*{box-sizing:border-box}body{margin:0}main{max-width:1180px;margin:auto;padding:18px}h1,h2{margin:0}.meta{color:var(--muted);font-size:13px}.notice{min-height:24px;padding:7px 0;font-weight:800;color:#12633d}.notice.error{color:#a02e1b}.sync-debug-toggle,.sync-debug{display:none!important}.sync-status{display:inline-flex!important;align-items:center;gap:6px;font-weight:900;margin:8px 0}.sync-status[data-state="connected"]{color:var(--green)}.sync-status[data-state="reconnecting"]{color:#9a6700}.sync-status[data-state="offline"]{color:var(--warn)}.summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;margin:14px 0}.metric,.panel{background:var(--paper);border:1px solid var(--line);border-radius:7px;padding:13px}.metric span{display:block;color:var(--muted);font-size:12px;font-weight:800}.metric strong{display:block;font-size:23px;margin-top:4px}.panel{margin-top:14px}.panel-head{display:flex;justify-content:space-between;gap:10px;align-items:end;margin-bottom:10px}.reconcile-total{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin:12px 0}.reconcile-total div{background:var(--soft);padding:11px;border-radius:6px}.reconcile-total span{display:block;color:var(--muted);font-size:12px;font-weight:800}.reconcile-total strong{font-size:21px}table{width:100%;border-collapse:collapse}th{background:var(--deep);color:#fff;text-align:left;padding:9px;font-size:13px}td{border-top:1px solid #e9e1d6;padding:9px}input,textarea,button{font:inherit}input,textarea{width:100%;padding:9px;border:1px solid #aec0bd;border-radius:5px}textarea{min-height:65px;resize:vertical}button{padding:10px 12px;border:0;border-radius:5px;background:var(--green);color:#fff;font-weight:900;cursor:pointer}button:disabled{opacity:.55;cursor:not-allowed}.warn{background:var(--warn)}.row{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}.label{display:grid;gap:5px;font-size:13px;font-weight:800;color:#36545a}.empty{color:var(--muted);padding:14px 0}.actions{display:flex;gap:8px;flex-wrap:wrap}@media(max-width:900px){main{padding:12px}.summary{grid-template-columns:repeat(2,minmax(0,1fr))}.row,.reconcile-total{grid-template-columns:1fr}.panel-head{align-items:flex-start;flex-direction:column}table{min-width:560px}.table-wrap{overflow:auto}}@media(max-width:520px){.summary{grid-template-columns:1fr 1fr}.metric strong{font-size:20px}}
  </style>
</head>
<body>
  ${renderSystemNav("admin")}
  <main>
    <header>
      <h1>今日統計與收攤核對</h1>
      <p id="event" class="meta">正在讀取目前場次…</p>
      <p id="notice" class="notice">正在同步中央資料…</p>
    </header>
    ${renderBackOfficeNav("statistics")}
    ${renderRealtimeDebug("Statistics")}

    <section id="summary" class="summary" aria-label="本場統計摘要">
      <article class="metric"><span>狀態</span><strong>讀取中</strong></article>
    </section>
    <p class="meta">本場預約單包含本場全部預約訂單，包含已出餐。</p>

    <section class="panel">
      <div class="panel-head">
        <div>
          <h2>本場銷售摘要</h2>
          <p class="meta">中央 SQLite 的訂單與本場庫存快照。</p>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>品項</th><th>已售數量</th><th>目前剩餘</th></tr></thead>
          <tbody id="product-summary"><tr><td colspan="3" class="empty">正在讀取銷售資料…</td></tr></tbody>
        </table>
      </div>
    </section>

    <section class="panel">
      <div class="panel-head">
        <div>
          <h2>收攤／報廢確認</h2>
          <p class="meta">逐品項確認剩餘、報廢與保留後，才能正式結束今日販售。</p>
        </div>
        <div class="actions"><button id="save" type="button">儲存收攤核對</button></div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>品項</th><th>剩餘</th><th>報廢</th><th>保留</th></tr></thead>
          <tbody id="closeout-items"><tr><td colspan="4" class="empty">正在讀取本場品項…</td></tr></tbody>
        </table>
      </div>
      <div class="row" style="margin-top:12px">
        <label class="label">現金實收<input id="cash" type="number" min="0" value="0"></label>
        <label class="label">LINE Pay 實收<input id="line" type="number" min="0" value="0"></label>
        <label class="label">其他實收<input id="other" type="number" min="0" value="0"></label>
      </div>
      <div class="reconcile-total">
        <div><span>帳面總額</span><strong id="ledger-total">NT$0</strong></div>
        <div><span>實收合計</span><strong id="received-total">NT$0</strong></div>
        <div><span>實收差額</span><strong id="received-difference">NT$0</strong></div>
      </div>
      <label class="label">核對備註<textarea id="notes" maxlength="1000" placeholder="可空白"></textarea></label>
      <p class="meta">成本與毛利尚未啟用；報廢數量保存在 Operations 收攤紀錄。</p>
      <button id="close" class="warn" type="button">確認結束今日販售</button>
    </section>
  </main>
  <script>
    const sync=window.__rosRealtime;
    const $=id=>document.getElementById(id);
    let eventId=null;
    let latest=null,closeError=null;
    const n=value=>Number(value||0);
    const money=value=>'NT$'+n(value);
    const idOf=item=>item?.productId??item?.product_id??null;
    const esc=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
    const api=async(path,options={})=>{
      try{
        const response=await fetch(path,{headers:{'content-type':'application/json'},...options});
        const body=await response.json();
        if(!response.ok){
          const error=Error(body.error?.message||'請求失敗');
          error.code=body.error?.code;
          error.details=body.error?.details;
          error.status=response.status;
          throw error;
        }
        sync.recordApiSuccess();
        return body.data;
      }catch(error){
        sync.recordApiFailure();
        throw error;
      }
    };
    function notice(text,error=false){
      $('notice').textContent=text;
      $('notice').className='notice'+(error?' error':'');
    }
    function closeoutMap(){
      return new Map((latest?.closeoutItems||[]).map(item=>[item.productVersionId,item]));
    }
    function updateReconciliation(){
      const ledger=n(latest?.ledgerAmount);
      const received=n($('cash').value)+n($('line').value)+n($('other').value);
      $('ledger-total').textContent=money(ledger);
      $('received-total').textContent=money(received);
      $('received-difference').textContent=money(received-ledger);
    }
    function render(data){
      latest=data;
      const event=data.event||{};
      eventId=event.event_id||event.eventId||null;
      sync.setEventId(eventId);
      $('event').textContent=(event.display_name||event.displayName||'未命名場次')+' · '+(event.date||'')+' '+(event.start_time||event.startTime||'')+'-'+(event.end_time||event.endTime||'')+' · '+(event.status||'');

      const closeout=data.closeout||{};
      $('cash').value=closeout.cashReceived??0;
      $('line').value=closeout.linePayReceived??0;
      $('other').value=closeout.otherReceived??0;
      $('notes').value=closeout.notes??'';
      const received=n(closeout.cashReceived)+n(closeout.linePayReceived)+n(closeout.otherReceived);
      const metrics=[
        ['中央訂單',data.orderCount??0],
        ['本場預約單',data.scheduledOrderCount??0],
        ['帳面總額',money(data.ledgerAmount)],
        ['未完成',data.unresolvedCount??0],
        ['取消',data.cancelledCount??0],
        ['No-show',data.noShowCount??0],
        ['實收合計',money(received)],
        ['實收差額',money(received-n(data.ledgerAmount))]
      ];
      $('summary').innerHTML=metrics.map(item=>'<article class="metric"><span>'+item[0]+'</span><strong>'+item[1]+'</strong></article>').join('');

      const sold=new Map((data.products||[]).map(item=>[idOf(item),n(item.quantity)]));
      const closeouts=closeoutMap();
      $('product-summary').innerHTML=(data.inventory||[]).map(item=>{
        const productId=idOf(item);
        return '<tr><td>'+esc(item.posName||productId)+'</td><td>'+n(sold.get(productId))+'</td><td>'+n(item.remainingQuantity)+'</td></tr>';
      }).join('')||'<tr><td colspan="3" class="empty">本場尚無銷售品項。</td></tr>';
      $('closeout-items').innerHTML=(data.inventory||[]).map(item=>{
        const old=closeouts.get(item.productVersionId);
        const remaining=n(item.remainingQuantity);
        const waste=n(old?.wasteQuantity);
        return '<tr data-version="'+esc(item.productVersionId)+'"><td>'+esc(item.posName||idOf(item))+'</td><td data-remaining="'+remaining+'">'+remaining+'</td><td><input class="waste" type="number" min="0" max="'+remaining+'" value="'+waste+'"></td><td class="retained">'+Math.max(0,remaining-waste)+'</td></tr>';
      }).join('')||'<tr><td colspan="4" class="empty">本場沒有品項需要收攤確認。</td></tr>';
      updateReconciliation();
      if(closeError)notice(closeError,true);
      else notice('中央統計已同步。');
    }
    function items(){
      return [...document.querySelectorAll('#closeout-items tr[data-version]')].map(row=>{
        const remaining=n(row.querySelector('[data-remaining]').dataset.remaining);
        const waste=n(row.querySelector('.waste').value);
        if(!Number.isInteger(waste)||waste<0||waste>remaining)throw Error('報廢數量必須介於 0 與剩餘數量之間。');
        return {productVersionId:row.dataset.version,wasteQuantity:waste};
      });
    }
    function closeoutPayload(){
      return {
        cashReceived:n($('cash').value),
        linePayReceived:n($('line').value),
        otherReceived:n($('other').value),
        wasteAmount:0,
        notes:$('notes').value,
        operator:'Owner',
        items:items()
      };
    }
    async function save(){
      if(!eventId)throw Error('請先選擇營業中或暫停中的場次。');
      render(await api('/api/events/'+eventId+'/closeout',{method:'PUT',body:JSON.stringify(closeoutPayload())}));
      notice('收攤／報廢確認已儲存。');
    }
    document.addEventListener('input',event=>{
      const input=event.target;
      if(input?.id==='cash'||input?.id==='line'||input?.id==='other')updateReconciliation();
      if(!(input instanceof HTMLInputElement)||!input.classList.contains('waste'))return;
      const row=input.closest('tr');
      const remaining=n(row.querySelector('[data-remaining]').dataset.remaining);
      row.querySelector('.retained').textContent=String(Math.max(0,remaining-n(input.value)));
    });
    $('save').onclick=()=>save().catch(error=>notice((navigator.onLine?'儲存失敗：':'目前離線，核對資料未送達中央：')+error.message,true));
    $('close').onclick=async()=>{
      closeError=null;
      try{
        await save();
        const result=await api('/api/events/'+eventId+'/close',{method:'POST',body:JSON.stringify({confirmed:true,operator:'Owner'})});
        closeError=null;
        notice(result.replayed?'此場次已完成結束。':'場次已正式結束，日結快照已建立。');
        await load();
      }catch(error){
        const unresolved=error?.details?.unresolved;
        closeError=(navigator.onLine?'關場失敗：':'目前離線，關場操作未送達中央：')+(error?.message||'未知錯誤')+(unresolved?' 未完成訂單：'+unresolved+' 筆。':'');
        notice(closeError,true);
      }
    };
    async function load(){
      try{
        notice('正在同步中央統計…');
        const requested=new URLSearchParams(location.search).get('eventId');
        let id=requested;
        if(!id){
          const event=await api('/api/events/current');
          id=event?.eventId||null;
        }
        if(!id){
          eventId=null;
          sync.setEventId(null);
          $('event').textContent='目前沒有營業中或暫停中的場次。';
          $('summary').innerHTML='<article class="metric"><span>目前狀態</span><strong>尚無場次</strong></article>';
          $('product-summary').innerHTML='<tr><td colspan="3" class="empty">請先至後台建立並開啟場次。</td></tr>';
          $('closeout-items').innerHTML='<tr><td colspan="4" class="empty">目前沒有品項需要收攤確認。</td></tr>';
          notice('目前沒有可顯示的場次。');
          return;
        }
        render(await api('/api/events/'+id+'/statistics'));
      }catch(error){
        notice((navigator.onLine?'中央統計讀取失敗：':'目前離線，無法讀取中央統計：')+(error?.message||'未知錯誤'),true);
        throw error;
      }
    }
    sync.registerLoad(load);
  </script>
</body>
</html>`;
}
