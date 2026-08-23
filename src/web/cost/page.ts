import {
  renderBackOfficeNav,
  renderNavigationStyles,
  renderSystemNav
} from "../shared/navigation.js";

export function renderCostBackOffice(): string {
  return `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>成本中心 | 荒島 ROS 後台</title>
  <style>
    ${renderNavigationStyles()}
    :root{font-family:Arial,"Noto Sans TC",sans-serif;color:#17343b;background:#f3f0e9;--green:#0e6d63;--deep:#1f4650;--orange:#d45f3f;--line:#d8d0c3;--paper:#fffdf9;--soft:#e8f2ee;--muted:#66787c;--danger:#a63825}
    *{box-sizing:border-box}body{margin:0;background:linear-gradient(145deg,#f3f0e9 0,#e7efeb 100%);min-height:100vh}main{max-width:1380px;margin:0 auto;padding:20px}.hero{display:grid;grid-template-columns:1.3fr .7fr;gap:16px;align-items:end;border-bottom:3px solid var(--orange);padding:12px 0 18px}.eyebrow{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--orange);font-weight:900}.hero h1{font-size:clamp(30px,5vw,52px);line-height:1;margin:8px 0}.hero p{margin:0;color:var(--muted);line-height:1.6}.hero-stat{background:var(--deep);color:#fff;padding:18px;border-radius:10px}.hero-stat strong{display:block;font-size:30px;margin-top:4px}.notice{min-height:26px;margin:12px 0;font-weight:900;color:#17653f}.notice.error{color:var(--danger)}.steps{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin:14px 0}.step{border:1px solid var(--line);background:rgba(255,255,255,.7);border-radius:8px;padding:10px;font-size:13px}.step b{display:block;color:var(--green);font-size:18px}.layout{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.card{background:var(--paper);border:1px solid var(--line);border-radius:10px;padding:16px;box-shadow:0 7px 24px rgba(32,57,57,.06)}.card.wide{grid-column:1/-1}.card h2{margin:0 0 4px;font-size:21px}.hint{margin:0 0 14px;color:var(--muted);font-size:13px;line-height:1.5}.stack{display:grid;gap:11px}.row{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.row.three{grid-template-columns:repeat(3,minmax(0,1fr))}label{display:grid;gap:5px;color:#40555b;font-size:12px;font-weight:900}input,select,button{font:inherit}input,select{width:100%;border:1px solid #afbfbb;background:#fff;border-radius:6px;padding:10px;color:#17343b}button{border:0;background:var(--green);color:#fff;border-radius:6px;padding:11px 14px;font-weight:900;cursor:pointer}button:hover{filter:brightness(.95)}button:disabled{opacity:.45;cursor:not-allowed}.secondary{background:var(--deep)}.summary{margin-top:13px;border-top:1px dashed var(--line);padding-top:12px}.chip{display:inline-flex;padding:4px 8px;border-radius:999px;background:var(--soft);color:var(--green);font-weight:900;font-size:12px;margin:2px}.empty{color:var(--muted);font-size:13px}.result{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:12px}.metric{background:#17343b;color:#fff;border-radius:8px;padding:16px}.metric small{display:block;color:#bcd2cf}.metric strong{display:block;font-size:27px;margin-top:6px;word-break:break-all}.trace{margin-top:12px;border-collapse:collapse;width:100%;font-size:13px}.trace th,.trace td{text-align:left;border-bottom:1px solid var(--line);padding:8px}.failure{padding:12px;border-left:4px solid var(--danger);background:#f9e9e5;color:#762818}.exact-note{background:#fff4d7;border-radius:6px;padding:9px;font-size:12px;color:#6d5515}@media(max-width:900px){main{padding:12px}.hero,.layout,.result{grid-template-columns:1fr}.steps{grid-template-columns:1fr 1fr}.row,.row.three{grid-template-columns:1fr}.card.wide{grid-column:auto}}@media(max-width:520px){.steps{grid-template-columns:1fr}}
  </style>
</head>
<body>
  ${renderSystemNav("admin")}
  <main>
    <section class="hero">
      <div><div class="eyebrow">Cost Back Office · VAL-1</div><h1>成本中心</h1><p>從正式食材、量測設定、已發布配方與採購報價，產生可追溯的精確成本。所有數值以字串與分數保存，不在瀏覽器偷偷四捨五入。</p></div>
      <div class="hero-stat"><span>目前資料</span><strong id="record-count">0 項</strong><small id="record-breakdown">正在載入…</small></div>
    </section>
    ${renderBackOfficeNav("cost")}
    <p id="notice" class="notice" role="status" aria-live="polite"></p>
    <div class="steps"><div class="step"><b>01</b>建立正式食材</div><div class="step"><b>02</b>指定量測基準</div><div class="step"><b>03</b>發布正式配方</div><div class="step"><b>04</b>記錄有效報價</div><div class="step"><b>05</b>執行成本評估</div></div>
    <div class="layout">
      <section class="card">
        <h2>1. 正式食材</h2><p class="hint">食材名稱是主檔資料；品牌、供應商與包裝不在這裡建立。</p>
        <form id="ingredient-form" class="stack"><div class="row"><label>食材名稱<input id="ingredient-name" required placeholder="例如：豬五花"></label><label>分類<select id="ingredient-category"><option value="meat">肉類</option><option value="seafood">海鮮</option><option value="vegetable">蔬菜</option><option value="seasoning">調味料</option><option value="sauce">醬料</option><option value="dry_goods">乾貨</option><option value="frozen">冷凍</option><option value="beverage">飲料</option><option value="packaging">包材</option><option value="other">其他</option></select></label></div><button type="submit">建立正式食材</button></form>
        <div id="ingredient-list" class="summary"></div>
      </section>
      <section class="card">
        <h2>2. 量測設定</h2><p class="hint">每個量綱只有一個基準單位：重量 g、容量 ml、數量 each。</p>
        <form id="profile-form" class="stack"><label>食材<select id="profile-ingredient" required></select></label><div class="row three"><label>量綱<select id="profile-dimension"><option value="mass">重量</option><option value="volume">容量</option><option value="count">數量</option></select></label><label>基準單位<input id="profile-canonical" value="g" readonly></label><label>允許單位<input id="profile-units" value="g,kg,tw_catty" required></label></div><button type="submit">啟用量測設定</button></form>
        <div id="profile-list" class="summary"></div>
      </section>
      <section class="card wide">
        <h2>3. 發布配方</h2><p class="hint">此版本提供單一食材的快速建檔；後端契約已支援多行食材。產品需先在商品目錄發布。</p>
        <form id="recipe-form" class="stack">
          <div class="row"><label>配方名稱<input id="recipe-name" required placeholder="例如：滷肉飯標準配方"></label><label>對應已發布產品<select id="recipe-product" required></select></label></div>
          <div class="row three"><label>食材<select id="recipe-ingredient" required></select></label><label>配方用量係數<input id="recipe-quantity" required value="100" inputmode="numeric"></label><label>配方單位<input id="recipe-unit" required value="g"></label></div>
          <div class="row three"><label>配方量綱<select id="recipe-dimension"><option value="mass">重量</option><option value="volume">容量</option><option value="count">數量</option></select></label><label>標準產出係數<input id="recipe-output" value="1" required inputmode="numeric"></label><label>標準產出單位<input id="recipe-output-unit" value="each" required></label></div>
          <div class="row three"><label>標準產出量綱<select id="recipe-output-dimension"><option value="count">數量</option><option value="mass">重量</option><option value="volume">容量</option></select></label><label>標準份數<input id="recipe-yield" value="1" required inputmode="numeric"></label><label>份數單位<input id="recipe-yield-unit" value="each" required></label></div>
          <button type="submit">建立並發布配方 v1</button>
        </form>
        <div id="recipe-list" class="summary"></div>
      </section>
      <section class="card">
        <h2>4. 採購報價</h2><p class="hint">金額與採購量都使用精確係數；例如 300 元／1 kg。</p>
        <form id="quote-form" class="stack"><label>食材<select id="quote-ingredient" required></select></label><div class="row three"><label>金額係數<input id="quote-amount" required value="300" inputmode="numeric"></label><label>採購量係數<input id="quote-quantity" required value="1" inputmode="numeric"></label><label>採購單位<input id="quote-unit" required value="kg"></label></div><label>生效時間（UTC）<input id="quote-effective" required></label><button type="submit">記錄正式報價</button></form>
        <form id="quote-replacement-form" class="stack summary"><label>取代既有報價<select id="quote-replacement-old" required></select></label><div class="row three"><label>新金額係數<input id="quote-replacement-amount" required value="450" inputmode="numeric"></label><label>新採購量係數<input id="quote-replacement-quantity" required value="1" inputmode="numeric"></label><label>新採購單位<input id="quote-replacement-unit" required value="kg"></label></div><label>切換時間（UTC）<input id="quote-replacement-at" required></label><button type="submit" class="secondary">正式取代報價</button></form>
        <div id="quote-list" class="summary"></div>
      </section>
      <section class="card">
        <h2>5. 正式成本評估</h2><p class="hint">評估只讀取同一份資料庫快照，不改配方、不改報價，也不建立 Cost Snapshot。</p>
        <form id="evaluation-form" class="stack"><label>已發布配方<select id="evaluation-recipe" required></select></label><label>評估時間（UTC）<input id="evaluation-time" required></label><button type="submit" class="secondary">計算正式成本</button></form>
        <div class="exact-note">顯示格式：分子 / 分母（TWD）。這是正式精確值，畫面不自行轉成浮點小數。</div><div id="evaluation-result"></div>
      </section>
    </div>
  </main>
<script>
const state={ingredients:[],profiles:[],recipes:[],products:[],quotes:[]};
const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const now=()=>new Date().toISOString();
const api=async(path,options={})=>{const response=await fetch(path,{headers:{'content-type':'application/json'},...options});const body=await response.json();if(!response.ok)throw new Error(body.error?.message||'Request failed');return body.data};
function notify(message,error=false){$('notice').textContent=message;$('notice').className='notice'+(error?' error':'')}
function actorTime(){return{actor:'owner',occurredAt:now()}}
function options(items,value,label,empty='請選擇'){return '<option value="">'+empty+'</option>'+items.map(item=>'<option value="'+esc(value(item))+'">'+esc(label(item))+'</option>').join('')}
function render(){
  $('record-count').textContent=(state.ingredients.length+state.profiles.length+state.recipes.length)+' 項';$('record-breakdown').textContent=state.ingredients.length+' 食材 · '+state.profiles.length+' 量測設定 · '+state.recipes.length+' 配方';
  $('ingredient-list').innerHTML=state.ingredients.map(item=>'<span class="chip">'+esc(item.name)+'</span>').join('')||'<span class="empty">尚無正式食材</span>';
  $('profile-list').innerHTML=state.profiles.map(item=>{const version=item.versions.find(v=>v.state==='Active');const ingredient=state.ingredients.find(i=>i.ingredientId===item.ingredientId);return '<span class="chip">'+esc(ingredient?.name||item.ingredientId)+' · '+esc(version?.dimension||'未啟用')+' → '+esc(version?.canonicalUnitCode||'—')+'</span>'}).join('')||'<span class="empty">尚無量測設定</span>';
  $('recipe-list').innerHTML=state.recipes.map(item=>'<span class="chip">'+esc(item.name)+' · '+esc(item.state)+' · v'+esc(item.versionNumber||'—')+'</span>').join('')||'<span class="empty">尚無已發布配方</span>';
  const ingredientOptions=options(state.ingredients,i=>i.ingredientId,i=>i.name);['profile-ingredient','recipe-ingredient','quote-ingredient'].forEach(id=>{const selected=$(id).value;$(id).innerHTML=ingredientOptions;$(id).value=selected});
  const recipeOptions=options(state.recipes.filter(r=>r.state==='Published'),r=>r.recipeId,r=>r.name+' · v'+r.versionNumber);const selectedRecipe=$('evaluation-recipe').value;$('evaluation-recipe').innerHTML=recipeOptions;$('evaluation-recipe').value=selectedRecipe;
  const publishedProducts=state.products.flatMap(product=>(product.versions||[]).map(version=>({productId:product.productId,productVersionId:version.productVersionId,label:(version.displayName||product.internalName)+' · v'+version.versionNumber})));const selectedProduct=$('recipe-product').value;$('recipe-product').innerHTML=options(publishedProducts,p=>p.productId+'|'+p.productVersionId,p=>p.label,'請先到商品目錄發布產品');$('recipe-product').value=selectedProduct;
}
async function load(){const [setup,products]=await Promise.all([api('/api/admin/cost/setup'),api('/api/admin/products')]);Object.assign(state,setup,{products});render()}
async function submit(path,body){const data=await api(path,{method:'POST',body:JSON.stringify(body)});await load();return data}
$('profile-dimension').addEventListener('change',()=>{const value=$('profile-dimension').value;const settings=value==='mass'?['g','g,kg,tw_catty']:value==='volume'?['ml','ml,l,cc']:['each','each,dozen'];$('profile-canonical').value=settings[0];$('profile-units').value=settings[1]});
$('ingredient-form').addEventListener('submit',async event=>{event.preventDefault();try{await submit('/api/admin/cost/ingredients',{name:$('ingredient-name').value,categoryCode:$('ingredient-category').value,...actorTime()});$('ingredient-name').value='';notify('正式食材已建立。')}catch(error){notify(error.message,true)}});
$('profile-form').addEventListener('submit',async event=>{event.preventDefault();try{await submit('/api/admin/cost/profiles',{ingredientId:$('profile-ingredient').value,dimension:$('profile-dimension').value,canonicalUnitCode:$('profile-canonical').value,allowedUnitCodes:$('profile-units').value.split(',').map(v=>v.trim()).filter(Boolean),...actorTime()});notify('量測設定已啟用。')}catch(error){notify(error.message,true)}});
$('recipe-form').addEventListener('submit',async event=>{event.preventDefault();try{const [productId,productVersionId]=$('recipe-product').value.split('|');await submit('/api/admin/cost/recipes',{name:$('recipe-name').value,productId,productVersionId,lines:[{ingredientId:$('recipe-ingredient').value,coefficient:$('recipe-quantity').value,scale:0,unitCode:$('recipe-unit').value,dimension:$('recipe-dimension').value}],standardOutput:{coefficient:$('recipe-output').value,scale:0,unitCode:$('recipe-output-unit').value,dimension:$('recipe-output-dimension').value},standardYield:{coefficient:$('recipe-yield').value,scale:0,unitCode:$('recipe-yield-unit').value,dimension:'count'},...actorTime()});notify('配方 v1 已正式發布。')}catch(error){notify(error.message,true)}});
$('quote-form').addEventListener('submit',async event=>{event.preventDefault();try{await submit('/api/admin/cost/quotes',{ingredientId:$('quote-ingredient').value,amountCoefficient:$('quote-amount').value,amountScale:0,quantityCoefficient:$('quote-quantity').value,quantityScale:0,unitCode:$('quote-unit').value,effectiveFrom:$('quote-effective').value,recordedAt:now(),actor:'owner',sourceReferenceId:'cost-back-office'});await loadQuotes();notify('正式報價已記錄。')}catch(error){notify(error.message,true)}});
async function loadQuotes(){const ingredientId=$('quote-ingredient').value;if(!ingredientId){state.quotes=[];$('quote-replacement-old').innerHTML=options([],q=>q.quoteId,q=>q.quoteId,'目前沒有可取代的報價');$('quote-list').innerHTML='<span class="empty">選擇食材後顯示報價</span>';return}const quotes=await api('/api/admin/cost/quotes?ingredientId='+encodeURIComponent(ingredientId));state.quotes=quotes;const active=quotes.filter(q=>q.state==='Recorded');const selected=$('quote-replacement-old').value;$('quote-replacement-old').innerHTML=options(active,q=>q.quoteId,q=>q.quoteId+' · v'+q.aggregateVersion,'目前沒有可取代的報價');$('quote-replacement-old').value=selected;$('quote-list').innerHTML=quotes.map(q=>'<div class="chip" data-quote-id="'+esc(q.quoteId)+'">'+esc(q.quoteId)+' · '+esc(q.amount.coefficient)+' ×10^-'+esc(q.amount.scale)+' TWD / '+esc(q.purchaseQuantity.coefficient)+' '+esc(q.purchaseQuantity.unitCode)+' · '+esc(q.state)+'</div>').join('')||'<span class="empty">此食材尚無報價</span>'}
$('quote-replacement-form').addEventListener('submit',async event=>{event.preventDefault();try{const oldQuote=state.quotes.find(q=>q.quoteId===$('quote-replacement-old').value);if(!oldQuote)throw new Error('請選擇仍有效的正式報價。');const supersededAt=$('quote-replacement-at').value;await submit('/api/admin/cost/quotes/'+encodeURIComponent(oldQuote.quoteId)+'/replacements',{ingredientId:oldQuote.ingredientId,expectedVersion:oldQuote.aggregateVersion,amountCoefficient:$('quote-replacement-amount').value,amountScale:0,quantityCoefficient:$('quote-replacement-quantity').value,quantityScale:0,unitCode:$('quote-replacement-unit').value,supersededAt,recordedAt:now(),actor:'owner',sourceReferenceId:'cost-back-office-replacement'});await loadQuotes();notify('正式報價已完成取代。')}catch(error){notify(error.message,true)}});
$('quote-ingredient').addEventListener('change',()=>loadQuotes().catch(error=>notify(error.message,true)));
$('evaluation-form').addEventListener('submit',async event=>{event.preventDefault();try{const outcome=await api('/api/admin/cost/evaluations',{method:'POST',body:JSON.stringify({recipeId:$('evaluation-recipe').value,evaluatedAt:$('evaluation-time').value})});if(outcome.status!=='evaluated'){$('evaluation-result').innerHTML='<div class="failure"><strong>'+esc(outcome.failure.code)+'</strong><br>'+esc(outcome.failure.message)+'</div>';return}const result=outcome.result;const source=line=>line.selectedSource.sourceType==='ActualPurchase'?'實際採購 · '+line.selectedSource.acceptedPurchaseId:'預期報價 · '+line.selectedSource.quoteNormalizationEvidence.quoteId;$('evaluation-result').innerHTML='<div class="result"><div class="metric"><small>標準批次成本 · '+esc(result.currencyCode)+'</small><strong>'+esc(result.exactStandardBatchCost.numerator)+' / '+esc(result.exactStandardBatchCost.denominator)+'</strong></div><div class="metric"><small>每標準份成本 · '+esc(result.currencyCode)+'</small><strong>'+esc(result.exactPerStandardYieldCost.numerator)+' / '+esc(result.exactPerStandardYieldCost.denominator)+'</strong></div></div><table class="trace"><thead><tr><th>行</th><th>食材</th><th>來源</th><th>精確行成本</th></tr></thead><tbody>'+result.lines.map(line=>'<tr><td>'+esc(line.linePosition+1)+'</td><td>'+esc(state.ingredients.find(i=>i.ingredientId===line.ingredientId)?.name||line.ingredientId)+'</td><td>'+esc(source(line))+'</td><td>'+esc(line.exactLineCost.numerator)+' / '+esc(line.exactLineCost.denominator)+'</td></tr>').join('')+'</tbody></table>';notify('成本評估完成。')}catch(error){notify(error.message,true)}});
$('quote-effective').value=now();$('quote-replacement-at').value=$('quote-effective').value;$('evaluation-time').value=$('quote-effective').value;
load().catch(error=>notify(error.message,true));
</script>
</body>
</html>`;
}
