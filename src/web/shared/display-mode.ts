export function renderDisplayModeStyles(): string {
  return `.display-mode-action{box-sizing:border-box;width:100%;min-height:44px;border:1px solid #c4d3cf;border-radius:6px;background:#fff;color:#244b50;padding:10px 12px;font:700 14px Arial,"Noto Sans TC",sans-serif;text-align:left;cursor:pointer}.display-mode-action:hover{background:#e5f1ed}.display-mode-action:focus-visible,.display-url-dialog button:focus-visible,.display-url-dialog input:focus-visible{outline:3px solid #d98332;outline-offset:2px}.display-mode-notice{max-width:240px;margin:0;padding:2px 4px;color:#9b3b2b;font-size:12px;line-height:1.45}.display-mode-notice:empty{display:none}.display-url-dialog{box-sizing:border-box;width:min(520px,calc(100vw - 28px));border:1px solid #9eb8b1;border-radius:10px;padding:0;background:#fff;color:#173238;box-shadow:0 18px 48px rgba(18,45,43,.28)}.display-url-dialog::backdrop{background:rgba(15,34,37,.6)}.display-url-card{display:grid;gap:12px;margin:0;padding:20px}.display-url-card h2{margin:0;font-size:22px}.display-url-card p{margin:0;color:#587075;line-height:1.5}.display-url-card input{box-sizing:border-box;width:100%;min-height:46px;border:1px solid #b8cbc4;border-radius:6px;padding:10px;font:14px/1.4 ui-monospace,SFMono-Regular,Consolas,monospace;color:#173238;background:#f7faf8}.display-url-actions{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap}.display-url-actions button{min-height:44px;border:1px solid #b8cbc4;border-radius:6px;background:#eef4f1;color:#244b50;padding:10px 14px;font:700 14px Arial,"Noto Sans TC",sans-serif;cursor:pointer}.display-url-actions [data-display-url-copy]{border-color:#0d796d;background:#0d796d;color:#fff}@media(max-width:680px){.display-url-card{padding:16px}.display-url-actions button{flex:1 1 auto}}`;
}

export function renderDisplayModeControls(): string {
  return `<button class="display-mode-action" type="button" data-display-mode-toggle>進入全螢幕</button>
<button class="display-mode-action" type="button" data-display-url-open>顯示目前網址</button>
<p class="display-mode-notice" data-display-mode-notice role="status" aria-live="polite"></p>
<dialog class="display-url-dialog" data-display-url-dialog aria-labelledby="display-url-title">
  <form class="display-url-card" method="dialog">
    <h2 id="display-url-title">目前網頁網址</h2>
    <p>可長按選取或按下複製，網址變更時請以最新通知信為準。</p>
    <input data-display-url-value aria-label="目前網頁網址" readonly>
    <div class="display-url-actions">
      <button type="button" data-display-url-copy>複製網址</button>
      <button type="submit">關閉</button>
    </div>
  </form>
</dialog>`;
}

export function renderDisplayModeRuntime(): string {
  return `<script>(()=>{
const toggle=document.querySelector('[data-display-mode-toggle]'),openUrl=document.querySelector('[data-display-url-open]'),dialog=document.querySelector('[data-display-url-dialog]'),urlValue=document.querySelector('[data-display-url-value]'),copyUrl=document.querySelector('[data-display-url-copy]'),notice=document.querySelector('[data-display-mode-notice]');
if(!toggle||!openUrl||!dialog||!urlValue||!copyUrl||!notice)return;
const fullscreenElement=()=>document.fullscreenElement||document.webkitFullscreenElement||null;
const requestFullscreen=()=>{const target=document.documentElement,request=target.requestFullscreen||target.webkitRequestFullscreen;return request?request.call(target):Promise.reject(new Error('unsupported'))};
const exitFullscreen=()=>{const exit=document.exitFullscreen||document.webkitExitFullscreen;return exit?exit.call(document):Promise.reject(new Error('unsupported'))};
const message=text=>{notice.textContent=text};
const update=()=>{toggle.textContent=fullscreenElement()?'退出全螢幕':'進入全螢幕';toggle.setAttribute('aria-pressed',String(Boolean(fullscreenElement())))};
toggle.addEventListener('click',async()=>{message('');try{if(fullscreenElement())await exitFullscreen();else await requestFullscreen()}catch{message('此平板瀏覽器不支援網頁全螢幕，請使用瀏覽器本身的全螢幕功能。')}finally{update()}});
openUrl.addEventListener('click',()=>{urlValue.value=location.href;if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');setTimeout(()=>urlValue.focus(),0)});
copyUrl.addEventListener('click',async()=>{urlValue.value=location.href;try{if(navigator.clipboard&&window.isSecureContext)await navigator.clipboard.writeText(urlValue.value);else{urlValue.select();if(!document.execCommand('copy'))throw new Error('copy failed')}copyUrl.textContent='已複製';setTimeout(()=>{copyUrl.textContent='複製網址'},1500)}catch{urlValue.select();message('無法自動複製，請長按網址後選擇複製。')}});
document.addEventListener('fullscreenchange',update);document.addEventListener('webkitfullscreenchange',update);update();
})()</script>`;
}
