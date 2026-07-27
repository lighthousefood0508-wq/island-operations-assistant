import { renderBackOfficeNav, renderNavigationStyles, renderSystemNav } from "../shared/navigation.js";

export function renderCatalogAdmin(): string {
  return `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>商品目錄 | 荒島 ROS 後台</title>
  <style>
    ${renderNavigationStyles()}
    :root{font-family:Arial,"Noto Sans TC",sans-serif;color:#183238;background:#f4f1eb;--green:#0f7668;--deep:#2f4858;--line:#d8cec0;--muted:#607176;--paper:#fff;--warn:#b84933;--soft:#eef4f1;--gold:#fff2d1}
    *{box-sizing:border-box}body{margin:0}main{max-width:1280px;margin:0 auto;padding:18px}header{border-bottom:2px solid var(--green);padding-bottom:12px}h1{margin:0;font-size:30px}h2{font-size:22px;margin:0 0 12px}.subtitle,.meta{margin:4px 0 0;color:var(--muted);font-size:13px}.notice{min-height:22px;color:#13643b;font-weight:900}.notice.error{color:#a52e1b}.grid{display:grid;grid-template-columns:minmax(320px,.85fr) minmax(560px,1.35fr);gap:14px}.card{background:#fff;border:1px solid var(--line);border-radius:7px;padding:14px}.product-editor{scroll-margin-top:16px}.stack{display:grid;gap:12px}.row{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}label{display:grid;gap:6px;color:#40545a;font-size:13px;font-weight:800}input,select,textarea,button{font:inherit}input,select,textarea{width:100%;border:1px solid #aebfbc;border-radius:5px;background:#fff;padding:9px}textarea{min-height:70px;resize:vertical}button{border:0;background:var(--green);color:#fff;border-radius:5px;padding:10px 12px;font-weight:900;cursor:pointer}button.secondary{background:#617477}button.warn,button.publish{background:var(--warn)}button.ghost{background:#eef4f1;color:#244b50;border:1px solid #c4d3cf}button:disabled,input:disabled,select:disabled,textarea:disabled{opacity:.58;cursor:not-allowed}.status{display:inline-flex;padding:3px 8px;border-radius:999px;font-size:12px;font-weight:900;background:#eef1ef}.status.published,.status.ok{background:#dff2e7;color:#13643b}.status.draft,.status.unknown{background:var(--gold);color:#7a5613}.status.inactive,.status.warn{background:#f4e1dc;color:#8a321c}.category-list,.product-list{display:grid;gap:8px;margin-top:12px}.item{border:1px solid #d8e1df;border-radius:6px;padding:10px;display:flex;justify-content:space-between;gap:12px;align-items:center;background:#fff}.item.selected{border-color:var(--green);box-shadow:0 0 0 2px rgba(15,118,104,.12)}.channels{display:flex;gap:12px;flex-wrap:wrap;align-items:center}.channels label{display:flex;align-items:center;gap:5px}.channels input{width:auto}.form-title{display:flex;justify-content:space-between;gap:10px;align-items:center}.actions{display:flex;gap:8px;flex-wrap:wrap}.product-row strong{font-size:18px}.product-row .name-line{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.versions{margin:8px 0 0;padding-left:18px;font-size:12px;color:#516467}.readonly-note{font-weight:900;color:#8a4a16;margin:8px 0 0}.empty{color:var(--muted);padding:12px}.placeholder{background:#f6f8f6;border:1px dashed #c4d3cf;border-radius:6px;padding:10px;color:#607176}@media(max-width:900px){main{padding:12px}.grid,.row{grid-template-columns:1fr}.item{align-items:flex-start;flex-direction:column}}
  </style>
</head>
<body>
  ${renderSystemNav("admin")}
  <main>
    <header>
      <h1>商品目錄</h1>
      <p class="subtitle">商品目錄是長期主檔：分類、名稱、POS 短名、售價、通路與正式發布。今日備貨與剩餘請到「場次與備貨」。</p>
      <p id="notice" class="notice"></p>
    </header>
    ${renderBackOfficeNav("catalog")}
    <div class="grid">
      <section class="card">
        <h2>品相分類</h2>
        <form id="category-form" class="stack">
          <input id="category-id" type="hidden">
          <label>系統代碼<input id="category-code-display" disabled placeholder="儲存後由系統產生 CAT-0001"></label>
          <label>分類名稱<input id="category-name" required placeholder="例如 荒島飯盒"></label>
          <div class="row">
            <label>排序<input id="category-sort" type="number" min="0" value="0" required></label>
            <label>狀態<select id="category-active"><option value="true">啟用</option><option value="false">停用</option></select></label>
          </div>
          <div class="actions">
            <button type="submit">儲存分類</button>
            <button id="clear-category" class="ghost" type="button">清空分類表單</button>
          </div>
        </form>
        <div id="categories" class="category-list"></div>
      </section>
      <section id="product-editor" class="card product-editor">
        <div class="form-title">
          <h2 id="product-form-title">新增品項</h2>
          <button id="clear-product" class="ghost" type="button">清空商品表單</button>
        </div>
        <form id="product-form" class="stack">
          <input id="product-id" type="hidden">
          <div class="row">
            <label>內部名稱<input id="internal-name" required placeholder="例如 一曲東坡肉"></label>
            <label>分類<select id="product-category" required><option value="">選擇分類</option></select></label>
          </div>
          <div class="row">
            <label>客人完整名稱<input id="display-name" placeholder="例如 一曲東坡肉飯盒"></label>
            <label>POS 短名<input id="pos-name" placeholder="例如 東坡"></label>
          </div>
          <div class="row">
            <label>售價<input id="selling-price" type="number" min="0" placeholder="180"></label>
            <label>狀態<select id="product-status"><option value="draft">草稿</option><option value="published">Published</option><option value="inactive">停用</option></select></label>
          </div>
          <label>客人介紹／品項內容<textarea id="description" placeholder="給客人看的簡短介紹或品項細項"></textarea></label>
          <div class="placeholder">成本與 BOM 由 Cost Domain 正式接管後保存；本頁目前只顯示主檔欄位。</div>
          <div class="channels">
            <label><input type="checkbox" value="pos"> POS</label>
            <label><input type="checkbox" value="kiosk"> Kiosk</label>
            <label><input type="checkbox" value="preorder"> Preorder</label>
          </div>
          <p id="publication-status" class="readonly-note">請先建立並儲存商品草稿</p>
          <div class="row">
            <button id="save-product" type="submit">儲存草稿</button>
            <button id="publish" class="publish" type="button">正式發布</button>
          </div>
        </form>
        <div id="products" class="product-list"></div>
      </section>
    </div>
  </main>
  <script>
const state={categories:[],products:[],selectedProductId:null};
const $=id=>document.querySelector('#'+id);
const notice=$('notice');
const esc=value=>String(value??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const api=async(path,options={})=>{const response=await fetch(path,{headers:{'content-type':'application/json'},...options});const body=await response.json();if(!response.ok)throw new Error(body.error?.message||'Request failed');return body.data};
function message(text,error=false){notice.textContent=text;notice.className='notice'+(error?' error':'');setTimeout(()=>{if(notice.textContent===text)notice.textContent=''},3800)}
function latestVersion(product){return product?.versions?.reduce((latest,version)=>!latest||version.versionNumber>latest.versionNumber?version:latest,null)}
function selectedProduct(){return state.products.find(product=>product.productId===state.selectedProductId)}
function activeCategories(){return state.categories.filter(category=>category.isActive).sort((a,b)=>a.sortOrder-b.sortOrder||a.displayName.localeCompare(b.displayName))}
function resetCategory(){for(const id of ['category-id','category-code-display','category-name'])$(id).value='';$('category-sort').value='0';$('category-active').value='true'}
function renderProductEditor(){const product=selectedProduct();$('product-form-title').textContent=product?'編輯品項：'+product.internalName:'新增品項';$('save-product').textContent=product?'儲存修改':'儲存草稿';$('clear-product').textContent=product?'取消編輯':'清空商品表單'}
function resetProduct(){state.selectedProductId=null;$('product-id').value='';$('internal-name').value='';$('product-category').value='';$('display-name').value='';$('pos-name').value='';$('selling-price').value='';$('description').value='';$('product-status').value='draft';document.querySelectorAll('.channels input').forEach(input=>input.checked=false);renderPublicationStatus();renderProductEditor();renderProducts()}
function renderCategories(){const options='<option value="">選擇分類</option>'+activeCategories().map(category=>'<option value="'+category.categoryId+'">'+esc(category.displayName)+'</option>').join('');$('product-category').innerHTML=options;const product=selectedProduct();if(product)$('product-category').value=product.categoryId;$('categories').innerHTML=state.categories.map(category=>'<div class="item"><div><strong>'+esc(category.displayName)+'</strong> <span class="status '+(category.isActive?'ok':'inactive')+'">'+(category.isActive?'啟用':'停用')+'</span><div class="meta">'+esc(category.code)+' · 排序 '+category.sortOrder+'</div></div><button class="secondary" data-category="'+category.categoryId+'">編輯</button></div>').join('')||'<div class="empty">目前沒有分類</div>'}
function renderPublicationStatus(){const product=selectedProduct();if(!product){$('publication-status').textContent='請先建立並儲存商品草稿';return}const version=latestVersion(product);if(version)$('publication-status').textContent='已發布 v'+version.versionNumber;else $('publication-status').textContent='尚未發布'}
function productSummary(product){const category=state.categories.find(item=>item.categoryId===product.categoryId);const version=latestVersion(product);const draft=product.draft||{};const channels=(version?.channels||draft.channels||[]).join(', ')||'未選通路';const name=version?.displayName||draft.displayName||'未填顯示名稱';const pos=version?.posName||draft.posName||'未填';const price=Number.isInteger(version?.sellingPrice)?'NT$'+version.sellingPrice:Number.isInteger(draft.sellingPrice)?'NT$'+draft.sellingPrice:'未填售價';return '<div><div class="name-line"><strong>'+esc(product.internalName)+'</strong><span class="status '+product.status+'">'+product.status+'</span>'+(version?'<span class="status ok">v'+version.versionNumber+'</span>':'<span class="status unknown">尚未發布</span>')+'</div><div class="meta">'+esc(name)+' · POS短名 '+esc(pos)+' · '+price+' · '+esc(category?.displayName||'未選分類')+' · '+esc(channels)+'</div>'+(version?'<ul class="versions"><li>v'+version.versionNumber+' · '+esc(version.displayName)+' · '+esc(version.posName)+' · NT$'+version.sellingPrice+'</li></ul>':'<p class="meta">尚未加入場次備貨</p>')+'</div>'}
function renderProducts(){$('products').innerHTML=state.products.map(product=>{const unpublished=!product.versions.length;const statusAction=product.status==='inactive'?'<button data-restore-product="'+product.productId+'">恢復啟用</button>':'<button class="warn" data-deactivate-product="'+product.productId+'">停用</button>';const deleteAction=unpublished?'<button class="warn" data-delete-product="'+product.productId+'">永久刪除</button>':'';return '<div class="item product-row '+(product.productId===state.selectedProductId?'selected':'')+'">'+productSummary(product)+'<div class="actions"><button class="secondary" data-product="'+product.productId+'">編輯</button>'+statusAction+deleteAction+'</div></div>'}).join('')||'<div class="empty">目前沒有商品</div>'}
function fillProductForm(product,focus=false){state.selectedProductId=product.productId;$('product-id').value=product.productId;$('internal-name').value=product.internalName;$('product-category').value=product.categoryId;$('display-name').value=product.draft.displayName||'';$('pos-name').value=product.draft.posName||'';$('selling-price').value=Number.isInteger(product.draft.sellingPrice)?String(product.draft.sellingPrice):'';$('description').value=product.draft.description||'';$('product-status').value=product.status;document.querySelectorAll('.channels input').forEach(input=>input.checked=product.draft.channels.includes(input.value));renderPublicationStatus();renderProductEditor();renderProducts();if(focus)requestAnimationFrame(()=>{$('product-editor').scrollIntoView({behavior:'smooth',block:'start'});$('internal-name').focus({preventScroll:true})})}
function productPayload(){const product=selectedProduct();const channels=[...document.querySelectorAll('.channels input:checked')].map(input=>input.value);const wantedStatus=$('product-status').value;const hasVersion=!!latestVersion(product);return {internalName:$('internal-name').value,categoryId:$('product-category').value,status:wantedStatus==='published'&&!hasVersion?'draft':wantedStatus,displayName:$('display-name').value,posName:$('pos-name').value,sellingPrice:$('selling-price').value===''?undefined:Number($('selling-price').value),description:$('description').value,channels}}
async function load(){[state.categories,state.products]=await Promise.all([api('/api/admin/categories'),api('/api/admin/products')]);renderCategories();const product=selectedProduct();if(state.selectedProductId&&!product)resetProduct();else if(product)fillProductForm(product);else{renderPublicationStatus();renderProductEditor()}renderProducts()}
$('category-form').addEventListener('submit',async event=>{event.preventDefault();try{const id=$('category-id').value;const body={displayName:$('category-name').value,sortOrder:Number($('category-sort').value),isActive:$('category-active').value==='true'};const result=await api(id?'/api/admin/categories/'+id:'/api/admin/categories',{method:id?'PATCH':'POST',body:JSON.stringify(body)});$('category-id').value=result.categoryId;$('category-code-display').value=result.code;await load();message('品相分類已儲存')}catch(error){message(error.message,true)}});
$('product-form').addEventListener('submit',async event=>{event.preventDefault();try{const id=state.selectedProductId;const result=await api(id?'/api/admin/products/'+id:'/api/admin/products',{method:id?'PATCH':'POST',body:JSON.stringify(productPayload())});state.selectedProductId=result.productId;await load();message($('product-status').value==='published'&&!latestVersion(result)?'草稿已儲存，請使用正式發布建立 published version':'商品草稿已儲存')}catch(error){message(error.message,true)}});
$('publish').addEventListener('click',async()=>{const id=state.selectedProductId;if(!id)return message('請先建立並儲存商品草稿',true);try{const result=await api('/api/admin/products/'+id+'/publish',{method:'POST',body:'{}'});await load();message('已發布 v'+result.version.versionNumber)}catch(error){message(error.message,true)}});
$('clear-category').addEventListener('click',()=>resetCategory());
$('clear-product').addEventListener('click',()=>resetProduct());
document.addEventListener('click',async event=>{const target=event.target;if(!(target instanceof HTMLElement))return;const categoryButton=target.closest('[data-category]');const productButton=target.closest('[data-product]');const deactivateButton=target.closest('[data-deactivate-product]');const restoreButton=target.closest('[data-restore-product]');const deleteButton=target.closest('[data-delete-product]');try{if(categoryButton){const category=state.categories.find(item=>item.categoryId===categoryButton.dataset.category);if(!category)return;$('category-id').value=category.categoryId;$('category-code-display').value=category.code;$('category-name').value=category.displayName;$('category-sort').value=String(category.sortOrder);$('category-active').value=String(category.isActive);return}if(productButton){const product=state.products.find(item=>item.productId===productButton.dataset.product);if(product)fillProductForm(product,true);return}if(deactivateButton){const product=state.products.find(item=>item.productId===deactivateButton.dataset.deactivateProduct);if(!product)return;if(!confirm('停用 '+product.internalName+'？已發布版本會保留歷史，新場次不再使用此商品。'))return;await api('/api/admin/products/'+product.productId,{method:'PATCH',body:JSON.stringify({status:'inactive'})});await load();message('商品已停用');return}if(restoreButton){const product=state.products.find(item=>item.productId===restoreButton.dataset.restoreProduct);if(!product)return;await api('/api/admin/products/'+product.productId,{method:'PATCH',body:JSON.stringify({status:product.versions.length?'published':'draft'})});await load();message('商品已恢復啟用');return}if(deleteButton){const product=state.products.find(item=>item.productId===deleteButton.dataset.deleteProduct);if(!product)return;if(!confirm('永久刪除 '+product.internalName+'？此動作無法復原。'))return;await api('/api/admin/products/'+product.productId,{method:'DELETE'});if(state.selectedProductId===product.productId)resetProduct();await load();message('未發布商品已永久刪除')}}catch(error){message(error.message,true)}});
load().catch(error=>message(error.message,true));
  </script>
</body>
</html>`;
}
