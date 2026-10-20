(()=>{
const STORAGE="blusheaBeautyAdvisorV2";
const state={history:[]};
try{state.history=JSON.parse(sessionStorage.getItem(STORAGE)||"[]").slice(-12)}catch{}

const root=document.createElement("div");
root.className="beauty-ai-root";
root.innerHTML=`
<button class="beauty-assistant-launcher" type="button" aria-label="Abrir asesora virtual" aria-expanded="false">
  <span class="beauty-assistant-icon">✦</span><span class="beauty-assistant-label">¿Te ayudo a elegir?</span>
</button>
<aside class="beauty-assistant" aria-hidden="true">
  <header class="beauty-assistant-header">
    <div><span class="beauty-assistant-status">● ASESORÍA 24/7</span><h2>Tu asesora de belleza</h2><small>Maquillaje · Skincare · Compras</small></div>
    <button class="beauty-assistant-close" type="button" aria-label="Cerrar">×</button>
  </header>
  <div class="beauty-assistant-messages">
    <div class="beauty-message beauty-message-bot">¡Holaaa, hermosa! 💕✨ Soy tu asesora virtual de belleza. Puedo ayudarte a elegir maquillaje, construir una rutina de skincare o encontrar opciones según tu presupuesto. ¿Qué te gustaría descubrir hoy?</div>
    <div class="beauty-quick-actions">
      <button type="button" data-q="Quiero encontrar mi tono de base">Quiero encontrar mi tono de base 💄</button>
      <button type="button" data-q="Necesito una rutina de skincare">Necesito una rutina de skincare 🌸</button>
      <button type="button" data-q="Recomiéndame maquillaje según mi presupuesto">Maquillaje según mi presupuesto 💗</button>
    </div>
  </div>
  <div class="beauty-ai-thinking" hidden><span></span><span></span><span></span> Pensando en ti…</div>
  <form class="beauty-assistant-form">
    <input type="text" maxlength="600" autocomplete="off" placeholder="Cuéntame qué estás buscando…" aria-label="Escribe tu consulta">
    <button type="submit" aria-label="Enviar">➜</button>
  </form>
  <p class="beauty-ai-note">Recomendaciones cosméticas. Para problemas médicos de piel, consulta a un profesional de salud.</p>
</aside>`;
document.body.appendChild(root);

const launcher=root.querySelector(".beauty-assistant-launcher");
const panel=root.querySelector(".beauty-assistant");
const close=root.querySelector(".beauty-assistant-close");
const messages=root.querySelector(".beauty-assistant-messages");
const form=root.querySelector(".beauty-assistant-form");
const input=form.querySelector("input");
const thinking=root.querySelector(".beauty-ai-thinking");

function toggle(open){panel.classList.toggle("is-open",open);panel.setAttribute("aria-hidden",String(!open));launcher.setAttribute("aria-expanded",String(open));if(open)setTimeout(()=>input.focus(),150)}
function save(){try{sessionStorage.setItem(STORAGE,JSON.stringify(state.history.slice(-12)))}catch{}}
function add(text,role){const el=document.createElement("div");el.className="beauty-message beauty-message-"+(role==="user"?"user":"bot");el.textContent=text;messages.appendChild(el);messages.scrollTop=messages.scrollHeight}
function money(n){return "$"+Number(n||0).toLocaleString("es-CO")}
function products(items){
  if(!Array.isArray(items)||!items.length)return;
  const wrap=document.createElement("div");wrap.className="beauty-ai-products";
  items.forEach(p=>{
    const a=document.createElement("a");a.className="beauty-result";a.href=p.url;
    const tones=Array.isArray(p.tonos)&&p.tonos.length?" · "+p.tonos.slice(0,3).join(" · "):"";
    a.innerHTML="<strong></strong><span></span><small></small>";
    a.querySelector("strong").textContent=p.nombre;
    a.querySelector("span").textContent=money(p.precio)+tones;
    a.querySelector("small").textContent=p.disponibleCompraReal===false?"Ver producto de demostración →":"Ver producto →";
    wrap.appendChild(a);
  });
  messages.appendChild(wrap);messages.scrollTop=messages.scrollHeight;
}
async function ask(q){
  add(q,"user");
  const prior=state.history.slice(-10);
  state.history.push({role:"user",content:q});save();
  input.value="";input.disabled=true;thinking.hidden=false;
  try{
    const r=await fetch("/api/asesora-belleza",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({mensaje:q,historial:prior})});
    const data=await r.json();
    if(!r.ok)throw new Error(data.mensaje||"No pude responder");
    const answer=[data.respuesta,data.pregunta].filter(Boolean).join("\n\n");
    add(answer,"assistant");products(data.productos);
    state.history.push({role:"assistant",content:answer});save();
  }catch(e){add("Se me cruzó un problemita técnico 💗. Inténtalo otra vez en un momento o escríbenos por WhatsApp.","assistant")}
  finally{thinking.hidden=true;input.disabled=false;input.focus()}
}
launcher.addEventListener("click",()=>toggle(!panel.classList.contains("is-open")));
close.addEventListener("click",()=>toggle(false));
form.addEventListener("submit",e=>{e.preventDefault();const q=input.value.trim();if(q)ask(q)});
root.querySelectorAll("[data-q]").forEach(b=>b.addEventListener("click",()=>ask(b.dataset.q)));
})();