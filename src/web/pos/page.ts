import { renderNavigationStyles, renderSystemNav } from "../shared/navigation.js";
import { renderRealtimeDebug } from "../shared/realtime-debug.js";

export function renderPos(): string {
  return `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>荒島餐車 POS</title>
  <style>
    :root{font-family:Arial,"Noto Sans TC",sans-serif;color:#173237;background:#eef3f0;--green:#145c57;--ink:#173237;--muted:#587075;--line:#c7d5d0;--paper:#fff;--warn:#b13f2e;--soft:#e5eee9}*{box-sizing:border-box}body{margin:0}${renderNavigationStyles()}main{max-width:1480px;margin:auto;padding:12px}.topbar{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center;padding:10px 2px 12px}.topbar h1{font-size:26px;margin:0;letter-spacing:0}.event{margin:4px 0 0;color:var(--muted);font-size:14px}.tabs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-bottom:10px}.tab{border:1px solid var(--line);background:#f8fbf9;color:#294b50;border-radius:6px;padding:12px 10px;font:700 16px Arial,sans-serif;cursor:pointer}.tab[aria-selected="true"]{background:var(--green);border-color:var(--green);color:#fff}.pane[hidden],#sync-debug[hidden]{display:none}.stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-bottom:10px}.stat{background:#fff;border:1px solid var(--line);border-radius:6px;padding:10px 12px}.stat span{display:block;color:var(--muted);font-size:12px;font-weight:700}.stat strong{display:block;font-size:22px;margin-top:2px}.layout{display:grid;grid-template-columns:minmax(0,1fr) 390px;gap:12px;align-items:start}.panel,.product,.order{background:var(--paper);border:1px solid var(--line);border-radius:6px}.panel{padding:12px}.panel h2,.panel h3{margin:0 0 10px}.panel h2{font-size:19px}.category-tabs{display:flex;gap:8px;overflow-x:auto;margin-bottom:10px;padding-bottom:2px}.category-tab{background:#fff;border:1px solid var(--line);color:#294b50;border-radius:999px;padding:9px 14px;font:700 15px Arial,sans-serif;white-space:nowrap;cursor:pointer}.category-tab[aria-pressed="true"]{background:#d6ebe4;border-color:var(--green);color:#123c3a}.products{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:10px}.product{min-height:172px;padding:13px;display:flex;flex-direction:column;box-shadow:0 1px 0 rgba(20,60,54,.04)}.product.sold-out{background:#edf0ee;border-color:#d8dfdc;color:#71817e}.product-name{font-weight:800;font-size:22px;line-height:1.1}.product-meta{color:var(--muted);font-size:13px;margin-top:4px}.product-price{font-weight:900;font-size:23px;margin:12px 0 4px}.soldout{color:var(--warn);font-weight:900}.product button{margin-top:auto;width:100%;font-weight:800;font-size:16px}.cart{position:sticky;top:58px;align-self:start;border-color:#9ebbb2;box-shadow:0 8px 22px rgba(20,60,54,.08)}.cart h2{font-size:21px}.cart-items{display:grid;gap:8px;max-height:34vh;overflow:auto}.cart-line{border:1px solid #dce5e1;border-radius:6px;padding:9px;background:#fbfdfc}.cart-main{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:7px;align-items:center}.line-total{font-weight:900}.quantity{display:flex;align-items:center;gap:4px}.quantity span{min-width:28px;text-align:center;font-weight:900}.quantity button,.icon-button{min-width:34px;padding:7px 8px}.field{display:block;margin-top:9px;color:#3e5d61;font-size:13px;font-weight:700}.field input,.field select,.field textarea{display:block;width:100%;font:inherit;border:1px solid #b9cbc4;border-radius:5px;padding:9px;margin-top:4px;background:#fff}.field textarea{min-height:54px;resize:vertical}.cart-fields{display:grid;grid-template-columns:1fr 108px;gap:8px}.cart-fields .wide{grid-column:1/-1}.cart-footer{border-top:1px solid var(--line);margin-top:12px;padding-top:12px}.total-row{display:flex;align-items:center;justify-content:space-between;font-size:20px;font-weight:900;margin:10px 0}.primary,button{font:inherit;border:0;border-radius:5px;background:var(--green);color:#fff;padding:10px 13px;cursor:pointer}.primary{width:100%;font-size:18px;font-weight:900;padding:13px}.secondary{background:#617477}.danger{background:var(--warn)}button:disabled{cursor:not-allowed;opacity:.52}.notice{min-height:28px;margin:10px 0 0;color:var(--warn);display:flex;gap:8px;align-items:center;font-weight:800}.notice button{padding:5px 8px;background:#617477}.order-list{display:grid;gap:8px}.served-section{margin-top:18px;padding-top:14px;border-top:1px solid #dce5e1}.order{padding:11px}.order-top{display:flex;justify-content:space-between;gap:10px}.order-number{font-weight:900;font-size:18px}.order-meta,.order-items{font-size:13px;color:var(--muted);margin-top:5px}.status-list{display:flex;gap:5px;flex-wrap:wrap;margin-top:7px}.status{font-size:12px;padding:4px 7px;border-radius:999px;background:#edf3f0;color:#36575b}.empty{color:var(--muted);padding:12px 0}.unavailable{max-width:680px;color:var(--muted)}@media(max-width:980px){main{padding:10px}.layout{grid-template-columns:1fr}.cart{position:static}.products{grid-template-columns:repeat(auto-fill,minmax(150px,1fr))}.cart-items{max-height:none}.topbar{grid-template-columns:1fr}.tabs{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:620px){.stats{grid-template-columns:repeat(2,minmax(0,1fr))}.cart-fields{grid-template-columns:1fr}.product{min-height:158px}.product-name{font-size:20px}.product-price{font-size:21px}.tab{font-size:15px;padding:11px 8px}}
  </style>
</head>
<body>
  ${renderSystemNav("pos")}
  <main>
    <header class="topbar">
      <div><h1>荒島餐車 POS</h1><p id="event" class="event">讀取場次...</p></div>
      ${renderRealtimeDebug("POS")}
    </header>
    <nav class="tabs" aria-label="POS 分頁">
      <button class="tab" data-tab="onsite" aria-selected="true">現場點餐</button>
      <button class="tab" data-tab="pending" aria-selected="false">待出餐</button>
      <button class="tab" data-tab="preorder" aria-selected="false">預約單</button>
      <button class="tab" data-tab="customer" aria-selected="false">客人訂單</button>
    </nav>

    <section class="pane" data-pane="onsite">
      <section class="stats" aria-label="現場摘要">
        <article class="stat"><span>剩餘主餐</span><strong id="remaining">0</strong></article>
        <article class="stat"><span>待出餐</span><strong id="pending">0</strong></article>
        <article class="stat"><span>預約出餐</span><strong id="preorder-count">尚未啟用</strong></article>
        <article class="stat"><span>場次狀態</span><strong id="event-status">-</strong></article>
      </section>
      <div class="layout">
        <section class="panel">
          <h2>商品</h2>
          <div id="empty" class="empty"></div>
          <div id="category-tabs" class="category-tabs" aria-label="商品分類"></div>
          <div id="products" class="products"></div>
        </section>
        <aside class="panel cart">
          <h2>本筆訂單</h2>
          <div id="cart-items" class="cart-items"></div>
          <div class="cart-fields">
            <label class="field">稱呼<input id="customer-name" maxlength="80" autocomplete="off" placeholder="可不填"></label>
            <label class="field">末四碼<input id="customer-phone-tail" maxlength="4" inputmode="numeric" autocomplete="off" placeholder="1234"></label>
            <label class="field wide">付款方式<select id="payment-method"><option value="">請選擇付款方式</option><option value="CASH">現金</option><option value="LINE_PAY">LINE Pay</option></select></label>
            <label class="field wide">訂單備註<textarea id="order-notes" maxlength="500" placeholder="可不填"></textarea></label>
          </div>
          <div class="cart-footer">
            <button class="secondary" id="clear-cart" type="button">清空</button>
            <div class="total-row"><span>總計</span><strong id="total">NT$0</strong></div>
            <button id="create-order" class="primary">送出訂單</button>
            <p id="notice" class="notice" role="status" aria-live="polite"></p>
          </div>
        </aside>
      </div>
    </section>

    <section class="pane" data-pane="pending" hidden>
      <section class="panel">
        <h2>待出餐</h2>
        <div id="orders" class="order-list"></div>
        <div class="served-section"><h3>今日已出餐</h3><div id="served-orders" class="order-list"></div></div>
      </section>
    </section>
    <section class="pane" data-pane="preorder" hidden><section class="panel unavailable"><h2>預約單</h2><p>尚未啟用。預約單將在 LINE Preorder 階段開放，目前不建立假資料。</p></section></section>
    <section class="pane" data-pane="customer" hidden><section class="panel unavailable"><h2>客人訂單</h2><p>尚未啟用。客人 Kiosk／Preorder 尚未納入本階段。</p></section></section>
  </main>
  <script>
    const sync=window.__rosRealtime;
    const s={event:null,products:[],orders:[],cart:new Map(),busy:false,notice:null,activeTab:'onsite',activeCategory:null};
    const $=id=>document.querySelector('#'+id);
    const api=async(path,options={})=>{try{const response=await fetch(path,{headers:{'content-type':'application/json'},...options}),body=await response.json();if(!response.ok){const error=Error(body.error?.message||'請求失敗');error.code=body.error?.code;throw error}sync.recordApiSuccess();return body.data}catch(error){sync.recordApiFailure();throw error}};
    const money=value=>'NT$'+value;
    const key=()=>crypto.randomUUID();
    const escape=value=>String(value??'').replace(/[&<>'"]/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[character]));
    const setNotice=text=>{s.notice=text||null};
    const clearNotice=()=>{s.notice=null};
    function productGroups(){const groups=new Map();for(const product of s.products){const name=product.displayCategoryName||'未分類';if(!groups.has(name))groups.set(name,[]);groups.get(name).push(product)}return [...groups.entries()].sort((left,right)=>(left[1][0]?.displayCategorySortOrder??0)-(right[1][0]?.displayCategorySortOrder??0))}
    function displayStatus(order){if(order.orderStatus==='cancelled')return '已取消';if(order.orderStatus==='completed')return '已完成';if(order.productionStatus==='served')return '已出餐';if(order.productionStatus==='ready')return '可取餐';if(order.productionStatus==='preparing')return '製作中';return '待製作'}
    function paymentMethodLabel(value){if(value==='CASH')return '現金';if(value==='LINE_PAY')return 'LINE Pay';return '未填'}
    function renderNotice(){const notice=$('notice');notice.hidden=!s.notice;notice.innerHTML=s.notice?'<span>'+escape(s.notice)+'</span><button type="button" data-dismiss-notice>關閉</button>':''}
    function renderCart(){const total=[...s.cart.values()].reduce((sum,item)=>sum+item.sellingPrice*item.quantity,0);$('total').textContent=money(total);$('cart-items').innerHTML=[...s.cart.values()].map(item=>'<article class="cart-line"><div class="cart-main"><strong>'+escape(item.posName)+'</strong><div class="quantity"><button type="button" data-adjust="-1" data-product-id="'+item.productId+'">-</button><span>'+item.quantity+'</span><button type="button" data-adjust="1" data-product-id="'+item.productId+'" '+(item.quantity>=item.remainingQuantity?'disabled':'')+'>+</button></div><strong class="line-total">'+money(item.quantity*item.sellingPrice)+'</strong><button type="button" class="danger icon-button" data-cart="'+item.productId+'" aria-label="刪除 '+escape(item.posName)+'">刪除</button></div><label class="field">品項備註<input data-note="'+item.productId+'" maxlength="250" value="'+escape(item.note||'')+'" placeholder="可不填"></label></article>').join('')||'<p class="empty">點商品即可加入訂單</p>';$('create-order').disabled=s.busy||!s.cart.size;$('clear-cart').disabled=s.busy||!s.cart.size}
    function renderProducts(){const groups=productGroups();if(s.activeCategory&&!groups.some(([name])=>name===s.activeCategory))s.activeCategory=null;$('category-tabs').innerHTML=groups.map(([name])=>'<button type="button" class="category-tab" data-category="'+escape(name)+'" aria-pressed="'+(s.activeCategory===name)+'">'+escape(name)+'</button>').join('');const visible=s.activeCategory?groups.filter(([name])=>name===s.activeCategory):groups;$('products').innerHTML=visible.flatMap(([,items])=>items).map(product=>{const cartQuantity=s.cart.get(product.productId)?.quantity||0,soldOut=product.remainingQuantity<1;return '<article class="product '+(soldOut?'sold-out':'')+'" data-product-id="'+product.productId+'"><div class="product-name">'+escape(product.posName)+'</div><div class="product-meta">'+escape(product.displayName||product.posName)+'</div><div class="product-price">'+money(product.sellingPrice)+'</div><div class="product-meta '+(soldOut?'soldout':'')+'">'+(soldOut?'售完':'剩 '+product.remainingQuantity+' 份')+'</div><div class="product-meta">本單 '+cartQuantity+' 份</div><button type="button" data-add="'+product.productId+'" data-action="add" data-product-id="'+product.productId+'" '+(soldOut?'disabled':'')+'>'+ (soldOut?'售完':'加入')+'</button></article>'}).join('');$('remaining').textContent=s.products.reduce((sum,product)=>sum+product.remainingQuantity,0);$('empty').textContent=s.products.length?'':'目前沒有可販售商品'}
    function orderCard(order){return '<article class="order"><div class="order-top"><div><div class="order-number">'+escape(order.orderNumber)+'</div><div class="order-meta">'+escape(new Date(order.createdAt).toLocaleString())+(order.customerName?' · '+escape(order.customerName):'')+(order.customerPhoneTail?' · 末四碼 '+escape(order.customerPhoneTail):'')+' · '+escape(order.source)+'</div></div><strong>'+displayStatus(order)+'</strong></div><div class="order-items">'+order.items.map(item=>escape(item.posName)+' x'+item.quantity+(item.notes?'（'+escape(item.notes)+'）':'')).join('、')+'</div><div class="order-meta">'+money(order.grandTotal)+' · 付款方式 '+paymentMethodLabel(order.paymentMethod)+(order.servedAt?' · 出餐 '+escape(new Date(order.servedAt).toLocaleTimeString()):'')+(order.notes?' · 備註：'+escape(order.notes):'')+'</div><div class="status-list"><span class="status">訂單：'+escape(order.orderStatus)+'</span><span class="status">付款：'+escape(order.paymentStatus)+'</span><span class="status">付款方式：'+paymentMethodLabel(order.paymentMethod)+'</span><span class="status">製作：'+escape(order.productionStatus)+'</span></div></article>'}
    function renderOrders(){const activeOrders=s.orders.filter(order=>order.orderStatus==='confirmed'&&order.productionStatus!=='served'),servedOrders=s.orders.filter(order=>order.productionStatus==='served');$('pending').textContent=activeOrders.length;$('orders').innerHTML=activeOrders.map(orderCard).join('')||'<p class="empty">目前沒有待出餐訂單</p>';$('served-orders').innerHTML=servedOrders.map(orderCard).join('')||'<p class="empty">今日尚無已出餐訂單</p>'}
    function render(){renderCart();renderProducts();renderOrders();renderNotice()}
    function renderTab(){document.querySelectorAll('[data-pane]').forEach(pane=>{pane.hidden=pane.dataset.pane!==s.activeTab});document.querySelectorAll('[data-tab]').forEach(tab=>tab.setAttribute('aria-selected',String(tab.dataset.tab===s.activeTab)))}
    async function load(){const event=await api('/api/events/current');s.event=event;sync.setEventId(event?.eventId);$('event-status').textContent=event?.status?.toUpperCase()||'CLOSED';if(!event){s.products=[];s.orders=[];$('event').textContent='目前沒有 OPEN Event';render();return}const [products,orders]=await Promise.all([api('/api/events/current/products'),api('/api/events/'+event.eventId+'/orders')]);s.products=products.filter(product=>product.channels.includes('pos'));s.orders=orders;$('event').textContent=event.displayName+' · '+event.eventCode+' · OPEN';let cartReconciled=false;for(const [productId,item] of s.cart){const product=s.products.find(candidate=>candidate.productId===productId);if(!product||product.remainingQuantity<1){s.cart.delete(productId);cartReconciled=true;continue}const quantity=Math.min(item.quantity,product.remainingQuantity);if(quantity!==item.quantity)cartReconciled=true;s.cart.set(productId,{...item,...product,quantity})}if(cartReconciled)setNotice('商品已售完或剩餘數量不足');render()}
    document.addEventListener('click',event=>{const target=event.target;const tab=target.closest('[data-tab]');if(tab){s.activeTab=tab.dataset.tab;renderTab();return}const category=target.closest('[data-category]');if(category){s.activeCategory=s.activeCategory===category.dataset.category?null:category.dataset.category;renderProducts();return}if(target.closest('[data-dismiss-notice]')){clearNotice();renderNotice();return}if(target.closest('#clear-cart')){s.cart.clear();renderCart();return}const add=target.closest('[data-add]'),remove=target.closest('[data-cart]'),adjust=target.closest('[data-adjust]');if(add){const product=s.products.find(item=>item.productId===add.dataset.add),existing=s.cart.get(product.productId);if(!existing||existing.quantity<product.remainingQuantity)s.cart.set(product.productId,{...product,quantity:(existing?.quantity||0)+1,note:existing?.note||''});renderCart()}if(remove){s.cart.delete(remove.dataset.cart);renderCart()}if(adjust){const item=s.cart.get(adjust.dataset.productId),product=s.products.find(candidate=>candidate.productId===adjust.dataset.productId);if(!item||!product)return;const quantity=item.quantity+Number(adjust.dataset.adjust);if(quantity<1)s.cart.delete(item.productId);else if(quantity<=product.remainingQuantity)s.cart.set(item.productId,{...item,...product,quantity});renderCart()}});
    document.addEventListener('click',event=>{const link=event.target.closest('.system-nav a');if(!link||!s.cart.size)return;if(!confirm('購物車尚未送出，離開會清空購物車。確定離開嗎？'))event.preventDefault()});
    document.addEventListener('input',event=>{const input=event.target;if(input.id==='customer-phone-tail')input.value=input.value.replace(/\\D/g,'').slice(0,4);if(!input.dataset.note)return;const item=s.cart.get(input.dataset.note);if(item){item.note=input.value;s.cart.set(item.productId,item)}});
    $('create-order').onclick=async()=>{if(s.busy||!s.event||!s.cart.size)return;clearNotice();const phoneTail=$('customer-phone-tail').value.trim(),paymentMethod=$('payment-method').value;if(phoneTail&&!/^\\d{4}$/.test(phoneTail)){setNotice('電話末四碼需為 4 位數字');renderNotice();return}if(!paymentMethod){setNotice('請先選擇付款方式');renderNotice();return}s.busy=true;renderCart();try{const order=await api('/api/orders',{method:'POST',body:JSON.stringify({source:'pos',eventId:s.event.eventId,idempotencyKey:key(),items:[...s.cart.values()].map(item=>({productId:item.productId,productVersionId:item.productVersionId,quantity:item.quantity,notes:item.note||null})),customerName:$('customer-name').value.trim()||null,customerPhoneTail:phoneTail||null,paymentMethod,notes:$('order-notes').value.trim()||null})});s.cart.clear();$('customer-name').value='';$('customer-phone-tail').value='';$('payment-method').value='';$('order-notes').value='';setNotice('訂單 '+order.orderNumber+' 建立成功');await load()}catch(error){setNotice(error instanceof TypeError?'無法連線，請確認中央服務':error.code==='INSUFFICIENT_QUANTITY'?'商品已售完或剩餘數量不足':error.code==='EVENT_NOT_OPEN'?'場次已關閉':error.message)}finally{s.busy=false;renderCart();renderNotice()}};
    if(new URLSearchParams(location.search).get('debug')!=='1')$('sync-debug-toggle').hidden=true;
    sync.registerLoad(load);renderTab();
  </script>
</body>
</html>`;
}
