console.log("[Content Script] Password Manager content script loaded");function l(){document.querySelectorAll("form").forEach(e=>{let n=e.querySelectorAll('input[type="password"]'),t=e.querySelectorAll('input[type="text"], input[type="email"]');n.length>0&&t.length>0&&(console.log("[Content Script] Login form detected"),u(e,t[0],n[0]))})}function u(o,e,n){if(o.querySelector(".pm-autofill-btn"))return;let t=document.createElement("button");t.type="button",t.className="pm-autofill-btn",t.textContent="\u{1F510} Autofill",t.style.cssText=`
    position: absolute;
    top: -30px;
    right: 0;
    padding: 6px 12px;
    background: #6366f1;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    z-index: 10000;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  `,t.addEventListener("click",async()=>{let r=window.location.href;chrome.runtime.sendMessage({type:"REQUEST_AUTOFILL",url:r},i=>{i&&i.success&&i.entry?(e&&(e.value=i.entry.username),n&&(n.value=i.entry.password),e&&e.dispatchEvent(new Event("input",{bubbles:!0})),n&&n.dispatchEvent(new Event("input",{bubbles:!0})),t.textContent="\u2713 Filled",setTimeout(()=>{t.textContent="\u{1F510} Autofill"},2e3)):(t.textContent="\u274C Not found",setTimeout(()=>{t.textContent="\u{1F510} Autofill"},2e3))})}),o.getBoundingClientRect().top>40&&(o.style.position="relative",o.appendChild(t))}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",l):l();var c=new MutationObserver(()=>{l()});document.body&&c.observe(document.body,{childList:!0,subtree:!0});
//# sourceMappingURL=content.js.map
