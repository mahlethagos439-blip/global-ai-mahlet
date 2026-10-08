const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const K="gam_chats_v4"; let chats=JSON.parse(localStorage.getItem(K)||"[]"),active=null,temp=false,tm=[];
const save=()=>localStorage.setItem(K,JSON.stringify(chats));
function toast(t){const x=$("#toast");if(!x)return;x.textContent=t;x.classList.remove("hidden");clearTimeout(window.__gamToast);window.__gamToast=setTimeout(()=>x.classList.add("hidden"),2200)}
function escapeHTML(s){return String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}

/* ================= MENUS ================= */
const leftBtn=$("#left"),rightBtn=$("#right"),lp=$("#lp"),rp=$("#rp"),shade=$("#shade");
function closeMenus(){lp.classList.remove("open");rp.classList.remove("open");lp.setAttribute("aria-hidden","true");rp.setAttribute("aria-hidden","true");shade.classList.add("hidden");shade.setAttribute("aria-hidden","true");shade.style.pointerEvents="none"}
function openMenu(side){lp.classList.remove("open");rp.classList.remove("open");lp.setAttribute("aria-hidden","true");rp.setAttribute("aria-hidden","true");const panel=side==="left"?lp:rp;panel.classList.add("open");panel.setAttribute("aria-hidden","false");shade.classList.remove("hidden");shade.setAttribute("aria-hidden","false");shade.style.pointerEvents="auto"}
leftBtn.addEventListener("click",e=>{e.preventDefault();e.stopImmediatePropagation();openMenu(lp.classList.contains("open")?"none":"left")},true);
rightBtn.addEventListener("click",e=>{e.preventDefault();e.stopImmediatePropagation();openMenu(rp.classList.contains("open")?"none":"right")},true);
$("#lx").addEventListener("click",e=>{e.preventDefault();e.stopImmediatePropagation();closeMenus()},true);
$("#rx").addEventListener("click",e=>{e.preventDefault();e.stopImmediatePropagation();closeMenus()},true);
shade.addEventListener("click",e=>{e.preventDefault();e.stopImmediatePropagation();closeMenus()},true);
document.addEventListener("keydown",e=>{if(e.key==="Escape")closeMenus()});

/* ================= CHATS ================= */
function render(q=""){const a=chats.filter(c=>!q||c.title.toLowerCase().includes(q.toLowerCase())).sort((a,b)=>Number(b.pinned)-Number(a.pinned)||b.t-a.t);$("#recent").innerHTML=a.length?a.map(c=>`<button type="button" data-id="${c.id}">○ ${escapeHTML(c.title)}${c.pinned?"　⚑":""}</button>`).join(""):"<small style='padding:10px;color:#7087a3'>No recent chats</small>";$$('#recent button').forEach(b=>b.addEventListener('click',()=>loadChat(b.dataset.id)))}
function messages(a){$("#messages").innerHTML=a.map(m=>`<div class="message"><small>${m.r==="u"?"You":"Global AI Mahlet"}</small><div>${escapeHTML(m.c)}</div>${m.r!=="u"?'<button class="speak" type="button" title="Read aloud">🔊</button>':""}</div>`).join("");$$('.speak').forEach((b,i)=>b.onclick=()=>{const m=a.filter(x=>x.r!=="u")[i];if(m)speak(m.c)})}
function loadChat(id){const c=chats.find(x=>x.id===id);if(!c)return;active=id;temp=false;update();$("#chat").classList.remove("hidden");$("#title").textContent=c.title;messages(c.m);closeMenus()}
function newChat(){active=null;tm=[];$("#chat").classList.add("hidden");$("#prompt").value="";closeMenus()}
function add(r,c){if(temp){tm.push({r,c});messages(tm);return}let x=chats.find(c=>c.id===active);if(!x){x={id:Date.now().toString(),title:c.slice(0,40)||"New Chat",pinned:false,t:Date.now(),m:[]};chats.unshift(x);active=x.id}x.m.push({r,c});x.t=Date.now();save();messages(x.m);render()}
async function send(t){t=t.trim();if(!t)return;$("#prompt").value="";$("#chat").classList.remove("hidden");add("u",t);try{const h=temp?tm:(chats.find(c=>c.id===active)?.m||[]);const r=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({messages:h})});const d=await r.json();add("a",d.response||d.result||d.message||d.error||"I couldn't complete that request.")}catch(e){add("a","The chat service could not be reached right now. Please check the Worker/API configuration.")}}
$("#send").onclick=()=>send($("#prompt").value);$("#prompt").onkeydown=e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send(e.target.value)}};
$$('.cards button').forEach(b=>b.onclick=()=>{$("#prompt").value=b.dataset.p||"";$("#prompt").focus()});

/* ================= TEMPORARY ================= */
$("#new").onclick=newChat;$("#temporary").onclick=()=>{temp=!temp;active=null;tm=[];$("#chat").classList.toggle("hidden",!temp);if(temp)$("#title").textContent="Temporary Chat";update();toast(temp?"Temporary Chat is on":"Temporary Chat is off")};$("#off").onclick=()=>$("#temporary").click();function update(){$("#toggle").classList.toggle("on",temp);$("#temp").classList.toggle("hidden",!temp)}
$("#srch").onclick=()=>{$("#recentSearch").classList.toggle("hidden");if(!$("#recentSearch").classList.contains("hidden"))$("#recentSearch").focus()};$("#recentSearch").oninput=e=>render(e.target.value);
$("#rename").onclick=()=>{const c=chats.find(x=>x.id===active);if(!c)return toast("Open a recent chat first.");const n=window.prompt("Rename this chat:",c.title);if(n){c.title=n;save();render();$("#title").textContent=n}};
$("#pin").onclick=()=>{const c=chats.find(x=>x.id===active);if(!c)return toast("Open a recent chat first.");c.pinned=!c.pinned;save();render();toast(c.pinned?"Chat pinned.":"Chat unpinned.")};
$("#del").onclick=()=>{if(!active)return toast("Open a recent chat first.");chats=chats.filter(c=>c.id!==active);save();newChat();render();toast("Chat deleted.")};
$("#settings").onclick=()=>toast("Settings interface ready for account integration.");$("#attach").onclick=()=>toast("Attachment interface is ready.");$("#search").onclick=()=>{$("#prompt").value="Search the web for ";$("#prompt").focus()};$("#create").onclick=()=>{$("#prompt").value="Create ";$("#prompt").focus()};

/* ================= REAL BROWSER VOICE ================= */
let recognition=null,listening=false;const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
if(SR){recognition=new SR();recognition.continuous=false;recognition.interimResults=false;recognition.lang=navigator.language||"en-US";recognition.onstart=()=>{listening=true;$("#voice").textContent="◉ Listening…";$("#voice").classList.add("voice-active")};recognition.onresult=e=>{const text=Array.from(e.results).map(r=>r[0]?.transcript||"").join(" ").trim();if(text){$("#prompt").value=text;$("#prompt").dispatchEvent(new Event("input",{bubbles:true}));$("#prompt").focus()}};recognition.onerror=e=>{if(e.error!=="no-speech"&&e.error!=="aborted")toast("Voice input could not start.");};recognition.onend=()=>{listening=false;$("#voice").textContent="◉ Voice";$("#voice").classList.remove("voice-active")}}
$("#voice").addEventListener("click",e=>{e.preventDefault();e.stopImmediatePropagation();if(!recognition)return toast("Voice input is not supported here. Try Chrome on Android.");try{if(listening)recognition.stop();else recognition.start()}catch(_){}},true);
function speak(text){if(!('speechSynthesis' in window))return toast("Voice output is not supported by this browser.");speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(String(text).replace(/<[^>]*>/g,""));u.lang=navigator.language||"en-US";speechSynthesis.speak(u)}

/* ================= CAPABILITY SEARCH ================= */
$("#capSearch").oninput=e=>{$$(".caps").forEach(g=>g.style.display=g.textContent.toLowerCase().includes(e.target.value.toLowerCase())?"grid":"none")};
$$('.caps').forEach(g=>{g.innerHTML=g.textContent.split("|").map(x=>`<button type="button" class="cap-item">${escapeHTML(x)}<span style="float:right">›</span></button>`).join("")});
$$('.cap-item').forEach(b=>b.onclick=()=>toast(b.textContent.trim()+" is part of the Global AI Mahlet workspace."));
render();update();closeMenus();
