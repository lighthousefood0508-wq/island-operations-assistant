import { renderBackOfficeNav, renderNavigationStyles, renderSystemNav } from "../shared/navigation.js";

export function renderHealthDashboard(): string {
  return `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>系統狀態 | 荒島 ROS 後台</title>
  <style>
    ${renderNavigationStyles()}
    :root{font-family:Arial,"Noto Sans TC",sans-serif;color:#1e2d35;background:#f4f7f5}body{margin:0}main{max-width:980px;margin:auto;padding:24px}.page-head{border-bottom:2px solid #1e5960;padding-bottom:12px;margin-bottom:14px}.page-head h1{margin:0;font-size:30px}.page-head p{margin:6px 0 0;color:#607176}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.card{background:#fff;border:1px solid #ccd8d5;border-radius:6px;padding:16px}.status{display:inline-block;padding:4px 8px;border-radius:999px;font-size:13px;font-weight:700}.ok{background:#dff2e7;color:#13643b}.unknown{background:#fff2d1;color:#7a5613}.error{background:#f4e1dc;color:#8a321c}.share-list{display:grid;gap:9px}.share-row{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center}.share-row code{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;background:#eef4f1;padding:8px;border-radius:4px}button{font:inherit;border:0;background:#1e5960;color:#fff;padding:9px 12px;border-radius:4px;cursor:pointer}.meta{font-size:13px;color:#607176}a{color:#0f5c59;font-weight:700}@media(max-width:700px){main{padding:14px}.grid,.share-row{grid-template-columns:1fr}}
  </style>
</head>
<body>
  ${renderSystemNav("admin")}
  <main>
    <header class="page-head">
      <h1>系統狀態</h1>
      <p>資料庫、外部入口、API 與即時同步集中放在後台；POS 與 Kitchen 不顯示這些工程資訊。</p>
    </header>
    ${renderBackOfficeNav("health")}
    <section class="grid" id="cards"></section>
    <section class="card">
      <h2>系統入口</h2>
      <div id="links" class="share-list"></div>
      <p id="notice" class="meta"></p>
    </section>
  </main>
  <script>
const $=id=>document.querySelector('#'+id),esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
function badge(state,text){return '<span class="status '+state+'">'+text+'</span>'}
function card(title,state,body,label){return '<article class="card"><h2>'+title+'</h2>'+badge(state,label||(state==='ok'?'已確認正常':state==='error'?'異常':'無法確認'))+'<p class="meta">'+body+'</p></article>'}
async function json(path){const response=await fetch(path,{cache:'no-store'}),body=await response.json();if(!response.ok)throw Error(body.error?.message||'Request failed');return body.data}
async function load(){const cards=[];let healthOk=false;try{const health=await json('/health');healthOk=true;cards.push(card('ROS Server','ok','service='+esc(health.service)+' · server time='+esc(health.now)));cards.push(card('SQLite 資料庫','ok','database='+esc(health.database)+' · 中央資料來源'))}catch(error){cards.push(card('ROS Server','error',esc(error.message)));cards.push(card('SQLite 資料庫','error','/health 無法確認'))}try{const event=await json('/api/events/current');cards.push(card('目前場次',event?'ok':'unknown',event?esc(event.displayName)+' · '+esc(event.eventCode)+' · '+esc(event.status):'目前沒有 OPEN Event'))}catch(error){cards.push(card('目前場次','error',esc(error.message)))}try{await fetch('/events?device=HealthDashboard&page=Health',{headers:{accept:'text/event-stream'}});cards.push(card('即時同步 SSE','ok','/events 可建立連線。裝置明細請看 <a href="/admin/devices">裝置連線</a>。'))}catch(error){cards.push(card('即時同步 SSE','error',esc(error.message)))}cards.push(card('API 健康檢查',healthOk?'ok':'error','/health、/api/events/current 由本頁即時檢查'));cards.push(card('Cloudflare／外部入口',healthOk?'ok':'unknown','目前 origin：'+esc(location.origin)+'。瀏覽器無法直接確認 cloudflared process 或上次成功時間；但本頁與 /health 可讀取代表目前入口可用。',healthOk?'目前入口可用':'無法確認'));cards.push(card('最後檢查','ok',new Date().toLocaleString()));$('cards').innerHTML=cards.join('')}
function renderLinks(){const origin=location.origin,links=[['ROS Base','/'],['POS 點餐','/pos'],['廚房系統','/kitchen'],['後台管理','/admin'],['商品目錄','/admin/catalog'],['場次','/admin'],['成本總覽','/admin/cost'],['今日統計','/admin/statistics'],['系統狀態','/admin/health'],['裝置連線','/admin/devices']];$('links').innerHTML=links.map(([label,path])=>'<div class="share-row"><code>'+origin+path+'</code><button type="button" data-copy="'+origin+path+'">複製 '+label+'</button></div>').join('')}
document.addEventListener('click',event=>{const copy=event.target.dataset.copy;if(copy)navigator.clipboard.writeText(copy).then(()=>{$('notice').textContent='已複製：'+copy})});
renderLinks();load();
  </script>
</body>
</html>`;
}
