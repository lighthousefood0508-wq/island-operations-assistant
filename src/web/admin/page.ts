import { renderBackOfficeNav, renderNavigationStyles, renderSystemNav } from "../shared/navigation.js";

export function renderAdmin(): string {
  return `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>後台管理 | 荒島 ROS</title>
  <style>
    ${renderNavigationStyles()}
    :root{font-family:Arial,"Noto Sans TC",sans-serif;color:#183238;background:#f4f1eb;--green:#0f7668;--deep:#2f4858;--line:#d8cec0;--muted:#607176;--paper:#fff;--warn:#b84933;--soft:#eef4f1;--disabled:#edf0ee}*{box-sizing:border-box}body{margin:0}main{max-width:1500px;margin:0 auto;padding:16px}header{display:flex;justify-content:space-between;gap:14px;align-items:flex-end;border-bottom:2px solid var(--green);padding-bottom:12px}h1{margin:0;font-size:30px}h2{font-size:21px;margin:0 0 12px}h3{font-size:16px;margin:0 0 8px}.subtitle,.meta{margin:4px 0 0;color:var(--muted);font-size:13px}.page-grid{display:grid;grid-template-columns:minmax(330px,.82fr) minmax(560px,1.35fr);gap:14px;margin-top:14px}.card,section{background:#fff;border:1px solid var(--line);border-radius:7px;padding:14px}.stack{display:grid;gap:14px}.row{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.row-3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px}.category-list,.product-list{display:grid;gap:8px;margin-top:12px}.item{border:1px solid #d8e1df;border-radius:6px;padding:10px;display:flex;justify-content:space-between;gap:12px;align-items:center;background:#fff}.item.inactive,.product-row.inactive{background:#f7f5f1;color:#617176}.versions{margin:8px 0 0;padding-left:18px;font-size:12px;color:#516467}.status{display:inline-flex;padding:3px 8px;border-radius:999px;font-size:12px;font-weight:900;background:#eef1ef}.status.published,.status.open,.status.ok{background:#dff2e7;color:#13643b}.status.draft,.status.unknown{background:#fff2d1;color:#7a5613}.status.inactive,.status.closed,.status.archived,.status.warn{background:#f4e1dc;color:#8a321c}label{display:grid;gap:6px;color:#40545a;font-size:13px;font-weight:800}input,select,textarea,button{font:inherit}input,select,textarea{width:100%;border:1px solid #aebfbc;border-radius:5px;background:#fff;padding:9px}textarea{min-height:68px;resize:vertical}button{border:0;background:var(--green);color:#fff;border-radius:5px;padding:10px 12px;font-weight:900;cursor:pointer}button.secondary{background:#617477}button.warn,button.publish{background:var(--warn)}button.ghost{background:#eef4f1;color:#244b50;border:1px solid #c4d3cf}button:disabled,input:disabled,select:disabled,textarea:disabled{opacity:.58;cursor:not-allowed}.channels{display:flex;gap:12px;flex-wrap:wrap}.channels label{display:flex;align-items:center;gap:5px;font-weight:800}.channels input{width:auto}.actions{display:flex;gap:8px;flex-wrap:wrap}.notice{min-height:22px;color:#13643b;font-weight:900}.notice.error{color:#a52e1b}.daily-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-end;margin-bottom:10px}.event-summary{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.table-wrap{overflow:auto;border:1px solid var(--line);border-radius:7px;background:#fff}table{border-collapse:collapse;width:100%;min-width:1160px}th{background:var(--deep);color:#fff;text-align:left;font-size:13px;padding:10px 9px;white-space:nowrap}td{border-top:1px solid #e5ddd1;padding:9px;vertical-align:top}.product-row strong{font-size:18px}.product-row .name-line{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.inline-input{max-width:105px}.number{font-weight:900}.soldout{color:#9b2d1d}.safe{color:#8a4a16}.details{display:none;background:#fbfdfc}.details.open{display:table-row}.details-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px}.empty{color:var(--muted);padding:12px 0}.helper{border-left:4px solid #d7cec2;padding-left:10px;color:#607176}.toolbar{display:flex;gap:8px;flex-wrap:wrap}.collapsed-list{border-top:1px solid #e5ddd1;margin-top:14px;padding-top:12px}.form-title{display:flex;justify-content:space-between;gap:10px;align-items:center}.form-title button{padding:7px 10px}.quick-inventory{display:grid;grid-template-columns:minmax(220px,1.2fr) repeat(3,110px) auto;gap:8px;align-items:end;margin-top:12px;padding:12px;background:#fbfdfc;border:1px solid #e0d8ce;border-radius:7px}.readonly-note{font-weight:900;color:#8a4a16;margin:8px 0 0}@media(max-width:1050px){main{padding:12px}.page-grid,.row,.row-3,.details-grid,.quick-inventory{grid-template-columns:1fr}header,.daily-head{align-items:flex-start;flex-direction:column}.table-wrap{border:0}table{min-width:0}thead{display:none}tr{display:block;border:1px solid var(--line);border-radius:7px;margin:10px 0;background:#fff}td{display:grid;grid-template-columns:122px 1fr;border-top:1px solid #eee5d9}td::before{content:attr(data-label);font-weight:900;color:#607176}.details.open{display:block}.details td{display:block}.item{align-items:flex-start;flex-direction:column}}
  </style>
</head>
<body>
  ${renderSystemNav("admin")}
  <main>
    <header>
      <div>
        <h1>後台管理</h1>
        <p class="subtitle">商品、分類、發布、今日備貨與安全預留集中在這裡；POS 只保留點餐速度。</p>
      </div>
      <span id="notice" class="notice"></span>
    </header>
    ${renderBackOfficeNav("catalog")}

    <div class="page-grid">
      <div class="stack">
        <section>
          <h2>商品分類</h2>
          <form id="category-form">
            <input id="category-id" type="hidden">
            <label>分類代碼<input id="category-code" required pattern="[a-z0-9_-]+" placeholder="bento"></label>
            <label>分類名稱<input id="category-name" required placeholder="荒島飯盒"></label>
            <div class="row">
              <label>排序<input id="category-sort" type="number" min="0" value="0"></label>
              <label>狀態<select id="category-active"><option value="true">啟用</option><option value="false">停用</option></select></label>
            </div>
            <button type="submit">儲存分類</button>
          </form>
          <div id="categories" class="category-list"></div>
        </section>

        <section>
          <h2>今日場次</h2>
          <div id="event-summary" class="event-summary"></div>
          <p id="inventory-note" class="helper"></p>
          <form id="daily-add-form" class="quick-inventory">
            <label>加入已發布品項<select id="daily-product" required></select></label>
            <label>備貨<input id="daily-planned" type="number" min="0" value="0" required></label>
            <label>安全預留<input id="daily-safety" type="number" min="0" value="0" required></label>
            <label>客人可訂<input id="daily-preview" type="text" readonly value="0"></label>
            <button type="submit">加入備貨</button>
          </form>
          <p class="meta">OPEN 場次依目前規則鎖定備貨；若要調整，需先由 Architecture Owner 核准是否允許營業中變更。</p>
        </section>
      </div>

      <section>
        <div class="form-title">
          <h2>新增品項</h2>
          <button id="new-product" class="ghost" type="button">清空表單</button>
        </div>
        <form id="product-form">
          <input id="product-id" type="hidden">
          <div class="row">
            <label>內部名稱<input id="internal-name" required placeholder="一曲東坡肉"></label>
            <label>分類<select id="product-category" required></select></label>
          </div>
          <div class="row">
            <label>客人完整名稱<input id="display-name" placeholder="一曲東坡肉飯盒"></label>
            <label>POS 短名<input id="pos-name" placeholder="東坡"></label>
          </div>
          <div class="row-3">
            <label>售價<input id="selling-price" type="number" min="0" placeholder="180"></label>
            <label>狀態<select id="product-status"><option value="draft">草稿</option><option value="published">Published</option><option value="inactive">停用</option></select></label>
            <label>成本（尚未啟用）<input id="product-cost" type="number" min="0" placeholder="等待 Cost Domain" disabled></label>
          </div>
          <label>客人介紹 / 品項內容<textarea id="description" placeholder="給客人看的短介紹或品項細項"></textarea></label>
          <label>食材明細 / BOM（尚未啟用）<textarea id="product-bom" placeholder="成本與 BOM 需由 Cost Domain 正式接管後才保存" disabled></textarea></label>
          <div class="channels">
            <label><input type="checkbox" value="pos"> POS</label>
            <label><input type="checkbox" value="kiosk"> Kiosk</label>
            <label><input type="checkbox" value="preorder"> Preorder</label>
          </div>
          <p id="publication-status" class="meta">請先建立並儲存商品草稿</p>
          <div class="row">
            <button type="submit">儲存草稿</button>
            <button id="publish" type="button" class="publish">正式發布</button>
          </div>
        </form>
      </section>
    </div>

    <section style="margin-top:14px">
      <div class="daily-head">
        <div>
          <h2>今日備貨與剩餘</h2>
          <p class="meta">品項主檔與今日備貨放在同一頁查看；售價與名稱改動仍需正式發布，已開場的商品快照不會被偷改。</p>
        </div>
        <div class="toolbar">
          <button id="refresh-daily" type="button" class="ghost">重新讀取</button>
          <a href="/admin/events"><button type="button" class="secondary">場次設定</button></a>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>品項</th><th>分類</th><th>售價</th><th>通路</th><th>版本</th><th>備貨</th><th>安全預留</th><th>客人可訂</th><th>現場售出</th><th>目前訂單</th><th>剩餘</th><th>操作</th>
            </tr>
          </thead>
          <tbody id="daily-inventory"></tbody>
        </table>
      </div>
      <div id="products" class="product-list"></div>
    </section>
  </main>
  <script>
const state={categories:[],products:[],published:[],events:[],currentEvent:null,selectedEvent:null,inventory:[],orders:[],selectedProductId:null,expanded:new Set()};
const $=id=>document.querySelector('#'+id),notice=$('notice');
const esc=value=>String(value??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const api=async(path,options={})=>{const response=await fetch(path,{headers:{'content-type':'application/json'},...options});const body=await response.json();if(!response.ok)throw Error(body.error?.message||'請求失敗');return body.data};
function message(text,error=false){notice.textContent=text;notice.className='notice'+(error?' error':'');setTimeout(()=>{if(notice.textContent===text)notice.textContent=''},3600)}
function categoryById(id){return state.categories.find(category=>category.categoryId===id)}
function activeCategories(){return state.categories.filter(category=>category.isActive)}
function latestVersion(product){return product.versions&&product.versions.length?product.versions[0]:null}
function selectedProduct(){return state.products.find(product=>product.productId===state.selectedProductId)||null}
function selectedChannels(){return [...document.querySelectorAll('.channels input:checked')].map(input=>input.value)}
function setChannels(values=[]){document.querySelectorAll('.channels input').forEach(input=>input.checked=values.includes(input.value))}
function money(value){return Number.isInteger(value)?'NT$'+value:'-'}
function chooseEvent(){if(state.currentEvent)return state.currentEvent;if(state.selectedEvent&&state.events.some(event=>event.eventId===state.selectedEvent.eventId))return state.selectedEvent;return state.events.find(event=>event.status==='draft')||state.events[0]||null}
function editableInventory(){return state.selectedEvent&&state.selectedEvent.status==='draft'}
function activeQuantity(productVersionId){return state.orders.filter(order=>order.orderStatus==='confirmed'&&order.productionStatus!=='served').flatMap(order=>order.items||[]).filter(item=>item.productVersionId===productVersionId).reduce((sum,item)=>sum+item.quantity,0)}
function inventoryFor(product){const version=latestVersion(product);return version?state.inventory.find(item=>item.productVersionId===version.productVersionId):null}
function resetCategory(){$('category-form').reset();$('category-id').value='';$('category-sort').value='0';$('category-active').value='true'}
function resetProduct(){state.selectedProductId=null;$('product-form').reset();$('product-id').value='';$('product-status').value='draft';setChannels([]);$('publication-status').textContent='請先建立並儲存商品草稿'}
function fillProductForm(product){state.selectedProductId=product.productId;$('product-id').value=product.productId;$('internal-name').value=product.internalName;$('product-category').value=product.categoryId;$('display-name').value=product.draft.displayName||'';$('pos-name').value=product.draft.posName||'';$('selling-price').value=product.draft.sellingPrice??'';$('description').value=product.draft.description||'';$('product-status').value=product.status;setChannels(product.draft.channels);const version=latestVersion(product);$('publication-status').textContent=version?'已發布 v'+version.versionNumber:'尚未發布'}
function renderCategories(){const target=$('categories');target.innerHTML=state.categories.map(category=>'<div class="item '+(category.isActive?'':'inactive')+'"><div><strong>'+esc(category.displayName)+'</strong> <span class="status '+(category.isActive?'ok':'inactive')+'">'+(category.isActive?'啟用':'停用')+'</span><div class="meta">'+esc(category.code)+' · 排序 '+category.sortOrder+'</div></div><button class="secondary" data-category="'+category.categoryId+'">編輯</button></div>').join('')||'<div class="empty">目前沒有分類</div>';$('product-category').innerHTML='<option value="">選擇分類</option>'+activeCategories().map(category=>'<option value="'+category.categoryId+'">'+esc(category.displayName)+'</option>').join('')}
function renderDailyControls(){const event=state.selectedEvent,editable=editableInventory();$('event-summary').innerHTML=event?'<strong>'+esc(event.displayName)+'</strong><span>'+esc(event.eventCode)+'</span><span class="status '+event.status+'">'+event.status.toUpperCase()+'</span><span>'+esc(event.date)+' '+esc(event.startTime)+'-'+esc(event.endTime)+'</span>':'<span class="status unknown">尚未建立場次</span>';$('inventory-note').textContent=event?(editable?'草稿場次可以修改今日備貨與安全預留。':'目前場次不是草稿，依現有規則不可修改備貨。'):'請先建立場次後再設定備貨。';$('daily-add-form').style.display=editable?'grid':'none';$('daily-product').innerHTML='<option value="">選擇已發布商品</option>'+state.published.map(product=>'<option value="'+product.productVersionId+'">'+esc(product.displayCategoryName)+' · '+esc(product.displayName)+'（'+esc(product.posName)+'）</option>').join('')}
function renderProducts(){const target=$('products'),main=state.products.filter(product=>product.status==='published'&&categoryById(product.categoryId)?.isActive),others=state.products.filter(product=>!main.includes(product));const productRow=product=>{const version=latestVersion(product),category=categoryById(product.categoryId),inv=inventoryFor(product),open=state.expanded.has(product.productId),channels=(product.draft.channels||[]).join(', ')||'未選通路';return '<div class="item product-row '+product.status+'"><div><div class="name-line"><strong>'+esc(product.internalName)+'</strong><span class="status '+product.status+'">'+product.status+'</span>'+(version?'<span class="status published">v'+version.versionNumber+'</span>':'<span class="status draft">尚未發布</span>')+'</div><div class="meta">'+esc(product.draft.displayName||'未填顯示名稱')+' · POS短名 '+esc(product.draft.posName||'未填')+' · '+money(product.draft.sellingPrice)+' · '+esc(category?.displayName||'未分類')+' · '+esc(channels)+'</div><ul class="versions">'+(product.versions||[]).map(item=>'<li>v'+item.versionNumber+' · '+esc(item.displayName)+' · '+esc(item.posName)+' · '+money(item.sellingPrice)+'</li>').join('')+'</ul>'+(inv?'<div class="meta">今日：備貨 '+inv.plannedQuantity+' · 安全 '+inv.safetyBufferQuantity+' · 客人可訂 '+inv.customerAvailableQuantity+' · 剩餘 '+inv.remainingQuantity+'</div>':'<div class="meta">尚未加入今日備貨</div>')+'</div><div class="actions"><button class="secondary" data-product="'+product.productId+'">編輯</button><button class="ghost" data-details="'+product.productId+'">'+(open?'收起':'細項')+'</button><button class="warn" data-deactivate-product="'+product.productId+'">停用</button></div></div>'+(open?'<div class="item"><div><strong>細項內容</strong><div class="meta">'+esc(product.draft.description||'尚未填寫客人介紹 / 品項內容')+'</div><div class="readonly-note">成本與 BOM 目前尚未接入 Catalog 商品頁，避免誤寫 Cost Domain。未來核准後再正式保存。</div></div></div>':'')};
target.innerHTML='<div class="collapsed-list"><h3>正式品項</h3>'+((main.map(productRow).join(''))||'<div class="empty">目前沒有正式啟用的商品。</div>')+'</div><div class="collapsed-list"><h3>草稿 / 停用 / 測試資料</h3>'+((others.map(productRow).join(''))||'<div class="empty">沒有草稿或停用資料。</div>')+'</div>'}
function renderDailyInventory(){const target=$('daily-inventory'),editable=editableInventory();if(!state.selectedEvent){target.innerHTML='<tr><td colspan="12" class="empty">尚未選取場次。</td></tr>';return}target.innerHTML=state.inventory.map(item=>{const product=state.products.find(candidate=>latestVersion(candidate)?.productVersionId===item.productVersionId),version=product?latestVersion(product):null,current=activeQuantity(item.productVersionId),remaining=item.remainingQuantity||0,customer=item.customerAvailableQuantity||0,safe=item.safetyBufferQuantity||0,disabled=editable?'':'disabled';return '<tr data-version="'+esc(item.productVersionId)+'"><td data-label="品項"><strong>'+esc(item.posName||item.displayName)+'</strong><div class="meta">'+esc(item.displayName||'')+'</div></td><td data-label="分類">'+esc(item.displayCategoryName||'未分類')+'</td><td data-label="售價">'+money(item.sellingPrice)+'</td><td data-label="通路">'+esc((item.channels||[]).join(', '))+'</td><td data-label="版本">'+(version?'v'+version.versionNumber:'快照')+'</td><td data-label="備貨"><input class="inline-input" data-field="planned" type="number" min="0" value="'+item.plannedQuantity+'" '+disabled+'></td><td data-label="安全預留"><input class="inline-input" data-field="safety" type="number" min="0" value="'+safe+'" '+disabled+'></td><td data-label="客人可訂" class="number '+(customer===0&&remaining>0?'safe':'')+'">'+customer+'</td><td data-label="現場售出" class="number">'+item.soldQuantity+'</td><td data-label="目前訂單" class="number">'+current+'</td><td data-label="剩餘" class="number '+(remaining===0?'soldout':'')+'">'+remaining+'</td><td data-label="操作"><div class="actions"><button data-save-inventory="'+esc(item.productVersionId)+'" '+disabled+'>儲存</button><button class="warn" data-disable-inventory="'+esc(item.productVersionId)+'" '+disabled+'>本場停用</button></div></td></tr>'}).join('')||'<tr><td colspan="12" class="empty">尚未設定今日備貨。</td></tr>'}
function renderDaily(){renderDailyControls();renderDailyInventory();updatePreview()}
function updatePreview(){const planned=Number($('daily-planned').value)||0,safe=Number($('daily-safety').value)||0;$('daily-preview').value=String(Math.max(0,planned-safe))}
async function loadDailyInventory(){state.selectedEvent=chooseEvent();if(!state.selectedEvent){state.inventory=[];state.orders=[];renderDaily();return}const event=state.selectedEvent;const [inventory,orders]=await Promise.all([api('/api/admin/events/'+event.eventId+'/sellable-inventory'),event.status==='open'?api('/api/events/'+event.eventId+'/orders'):Promise.resolve([])]);state.inventory=inventory;state.orders=orders;renderDaily()}
async function load(){[state.categories,state.products,state.published,state.events,state.currentEvent]=await Promise.all([api('/api/admin/categories'),api('/api/admin/products'),api('/api/catalog/products/published'),api('/api/admin/events'),api('/api/events/current')]);renderCategories();const product=selectedProduct();if(state.selectedProductId&&!product)resetProduct();else if(product)fillProductForm(product);await loadDailyInventory();renderProducts()}
async function saveInventory(productVersionId,plannedQuantity,safetyBufferQuantity){if(!state.selectedEvent)throw Error('尚未建立今日場次');if(safetyBufferQuantity>plannedQuantity)throw Error('安全預留不可大於備貨');await api('/api/admin/events/'+state.selectedEvent.eventId+'/sellable-inventory',{method:'PUT',body:JSON.stringify({productVersionId,plannedQuantity,safetyBufferQuantity})});await loadDailyInventory();renderProducts();message('今日備貨已儲存')}
function productPayload(){const product=selectedProduct(),requestedStatus=$('product-status').value,forceDraft=requestedStatus==='published'&&(!product||product.versions.length===0);return {body:{internalName:$('internal-name').value,categoryId:$('product-category').value,displayName:$('display-name').value,posName:$('pos-name').value,sellingPrice:$('selling-price').value===''?undefined:Number($('selling-price').value),description:$('description').value||null,channels:selectedChannels(),status:forceDraft?'draft':requestedStatus},forceDraft}}
$('category-form').addEventListener('submit',async event=>{event.preventDefault();try{const id=$('category-id').value,body={code:$('category-code').value,displayName:$('category-name').value,sortOrder:Number($('category-sort').value),isActive:$('category-active').value==='true'};await api(id?'/api/admin/categories/'+id:'/api/admin/categories',{method:id?'PATCH':'POST',body:JSON.stringify(body)});resetCategory();await load();message('分類已儲存')}catch(error){message(error.message,true)}});
$('product-form').addEventListener('submit',async event=>{event.preventDefault();try{const id=state.selectedProductId,{body,forceDraft}=productPayload(),result=await api(id?'/api/admin/products/'+id:'/api/admin/products',{method:id?'PATCH':'POST',body:JSON.stringify(body)});state.selectedProductId=id||result.productId;await load();message(forceDraft?'草稿已儲存，請使用正式發布建立 published version':'商品草稿已儲存')}catch(error){message(error.message,true)}});
$('publish').addEventListener('click',async()=>{const id=state.selectedProductId;if(!id)return message('請先建立並儲存商品草稿',true);try{const result=await api('/api/admin/products/'+id+'/publish',{method:'POST',body:'{}'});await load();message('已發布 v'+result.version.versionNumber)}catch(error){message(error.message,true)}});
$('daily-add-form').addEventListener('submit',async event=>{event.preventDefault();try{const versionId=$('daily-product').value;if(!state.published.find(product=>product.productVersionId===versionId))throw Error('請選擇已發布商品');await saveInventory(versionId,Number($('daily-planned').value),Number($('daily-safety').value))}catch(error){message(error.message,true)}});
$('refresh-daily').addEventListener('click',()=>load().catch(error=>message(error.message,true)));
$('daily-planned').addEventListener('input',updatePreview);$('daily-safety').addEventListener('input',updatePreview);$('new-product').addEventListener('click',resetProduct);
document.addEventListener('click',async event=>{const target=event.target;if(!(target instanceof HTMLElement))return;const categoryButton=target.closest('[data-category]'),productButton=target.closest('[data-product]'),detailsButton=target.closest('[data-details]'),deactivateButton=target.closest('[data-deactivate-product]'),saveButton=target.closest('[data-save-inventory]'),disableButton=target.closest('[data-disable-inventory]');try{if(categoryButton){const category=state.categories.find(item=>item.categoryId===categoryButton.dataset.category);if(!category)return;$('category-id').value=category.categoryId;$('category-code').value=category.code;$('category-name').value=category.displayName;$('category-sort').value=String(category.sortOrder);$('category-active').value=String(category.isActive);return}if(productButton){const product=state.products.find(item=>item.productId===productButton.dataset.product);if(product)fillProductForm(product);return}if(detailsButton){const id=detailsButton.dataset.details;if(state.expanded.has(id))state.expanded.delete(id);else state.expanded.add(id);renderProducts();return}if(deactivateButton){const id=deactivateButton.dataset.deactivateProduct;const product=state.products.find(item=>item.productId===id);if(!product)return;if(!confirm('停用 '+product.internalName+'？已發布版本會保留歷史，POS 新場次不再使用此商品。'))return;await api('/api/admin/products/'+id,{method:'PATCH',body:JSON.stringify({status:'inactive'})});await load();message('商品已停用');return}if(saveButton){const row=saveButton.closest('tr'),planned=Number(row.querySelector('[data-field="planned"]').value),safety=Number(row.querySelector('[data-field="safety"]').value);await saveInventory(saveButton.dataset.saveInventory,planned,safety);return}if(disableButton){await saveInventory(disableButton.dataset.disableInventory,0,0)}}catch(error){message(error.message,true)}});
load().catch(error=>message(error.message,true));
  </script>
</body>
</html>`;
}
