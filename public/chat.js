(()=>{"use strict";
const $=i=>document.getElementById(i),I=$("user-input"),S=$("send-button"),C=$("chat-messages"),W=$("welcome"),T=$("typing-indicator"),V=$("voice-button"),OT=$("temporary-chat-button"),L=$("language-select"),R=$("recent-chats"),P=$("photo-button"),PI=$("photo-input"),CA=$("camera-button"),CI=$("camera-input"),F=$("file-button"),FI=$("file-input"),N=$("new-chat-button"),M=$("menu-button"),SB=$("sidebar"),Q=$("recent-search"),FN=$("file-name");
let ms=[],tmp=false,vm=false,listening=false,rec=null,cid=Date.now()+"",img=null;
const LG={
English:"en-US",Amharic:"am-ET",Arabic:"ar-SA",Chinese:"zh-CN",Spanish:"es-ES",French:"fr-FR",Portuguese:"pt-BR",Russian:"ru-RU",German:"de-DE",Italian:"it-IT",Japanese:"ja-JP",Korean:"ko-KR",Hindi:"hi-IN",Urdu:"ur-PK",Bengali:"bn-BD",Turkish:"tr-TR",Dutch:"nl-NL",Swedish:"sv-SE",Norwegian:"no-NO",Danish:"da-DK",Finnish:"fi-FI",Polish:"pl-PL",Ukrainian:"uk-UA",Greek:"el-GR",Hebrew:"he-IL",Persian:"fa-IR",Swahili:"sw-KE",Hausa:"ha-NG",Yoruba:"yo-NG",Igbo:"ig-NG",Somali:"so-SO",Oromo:"om-ET",Tigrigna:"ti-ET",Vietnamese:"vi-VN",Thai:"th-TH",Indonesian:"id-ID",Malay:"ms-MY",Filipino:"fil-PH",Romanian:"ro-RO",Czech:"cs-CZ",Slovak:"sk-SK",Hungarian:"hu-HU",Bulgarian:"bg-BG",Serbian:"sr-RS",Croatian:"hr-HR",Slovenian:"sl-SI",Lithuanian:"lt-LT",Latvian:"lv-LV",Estonian:"et-EE",Icelandic:"is-IS",Afrikaans:"af-ZA",Albanian:"sq-AL",Armenian:"hy-AM",Azerbaijani:"az-AZ",Basque:"eu-ES",Belarusian:"be-BY",Bosnian:"bs-BA",Catalan:"ca-ES",Georgian:"ka-GE",Gujarati:"gu-IN",Kannada:"kn-IN",Kazakh:"kk-KZ",Khmer:"km-KH",Kyrgyz:"ky-KG",Lao:"lo-LA",Macedonian:"mk-MK",Malayalam:"ml-IN",Marathi:"mr-IN",Mongolian:"mn-MN",Nepali:"ne-NP",Pashto:"ps-AF",Punjabi:"pa-IN",Sinhala:"si-LK",Tamil:"ta-IN",Telugu:"te-IN",Uzbek:"uz-UZ",Welsh:"cy-GB",Zulu:"zu-ZA",Burmese:"my-MM",Galician:"gl-ES"
};
function setupLang(){let old=L.value;L.innerHTML="";Object.keys(LG).forEach(x=>{let o=document.createElement("option");o.value=x;o.textContent=x;L.append(o)});L.value=LG[old]?old:"English"}
function rd(){return JSON.parse(localStorage.getItem("gai_recent")||"[]")}
function sr(a){localStorage.setItem("gai_recent",JSON.stringify(a))}
function save(){
 if(tmp)return;
 localStorage.setItem("gai_"+cid,JSON.stringify(ms));
 let a=rd(),o=a.find(x=>x.id===cid);a=a.filter(x=>x.id!==cid);
 a.unshift({id:cid,title:(ms.find(x=>x.role==="user")?.content||"New Chat").replace(/^📷 .*?\n/,"").slice(0,45)||"New Chat",pinned:o?.pinned||false});
 sr(a.slice(0,30));render()
}
function render(f=""){
 R.innerHTML="";
 rd().filter(x=>x.title.toLowerCase().includes(f.toLowerCase())).sort((a,b)=>+b.pinned-+a.pinned).forEach(x=>{
  let d=document.createElement("div");d.className="recent-chat"+(x.id===cid?" active":"");
  d.style.cssText="position:relative;display:flex;align-items:center;gap:5px;padding:9px;border-radius:10px";
  let t=document.createElement("span");t.textContent=(x.pinned?"📌 ":"")+x.title;t.style.cssText="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap";
  let b=document.createElement("button");b.textContent="⋮";b.style.cssText="border:0;background:none;font-size:21px";
  b.onclick=e=>{e.stopPropagation();document.querySelectorAll(".chat-actions").forEach(z=>z.remove());let q=document.createElement("div");q.className="chat-actions";q.style.cssText="position:absolute;right:4px;top:42px;z-index:99;background:white;border:1px solid #ddd;border-radius:12px;padding:5px;box-shadow:0 10px 30px #0002";
   [["📌",x.pinned?"Unpin":"Pin",()=>{x.pinned=!x.pinned;sr(rd().map(z=>z.id===x.id?x:z));render(Q.value)}],["✏️","Rename",()=>{let n=prompt("Rename chat:",x.title);if(n?.trim()){x.title=n.trim();sr(rd().map(z=>z.id===x.id?x:z));render(Q.value)}}],["🗑️","Delete",()=>{localStorage.removeItem("gai_"+x.id);sr(rd().filter(z=>z.id!==x.id));x.id===cid?newChat():render(Q.value)}]].forEach(v=>{let z=document.createElement("button");z.textContent=v[0]+" "+v[1];z.style.cssText="display:block;width:130px;text-align:left;border:0;background:none;padding:9px";z.onclick=e=>{e.stopPropagation();v[2]();q.remove()};q.append(z)});d.append(q)};
  d.onclick=()=>load(x.id);d.append(t,b);R.append(d)
 })
}
function load(id){stopV();cid=id;ms=JSON.parse(localStorage.getItem("gai_"+id)||"[]");C.querySelectorAll(".message").forEach(x=>x.remove());W.style.display=ms.length?"none":"block";ms.forEach(x=>add(x.role,x.content));render(Q.value);SB.classList.remove("open")}
function add(role,text){
 W.style.display="none";
 let r=document.createElement("div");r.className="message "+(role==="user"?"user-message":"assistant-message");
 r.innerHTML='<div class="avatar">'+(role==="user"?"👤":"🤖")+'</div><div class="message-content"><div class="message-name">'+(role==="user"?"You":"Global AI Mahlet")+'</div><div class="message-text"></div></div>';
 r.querySelector(".message-text").textContent=text;
 if(role!=="user"){
  let bar=document.createElement("div");bar.style.cssText="display:flex;gap:8px;margin-top:9px";
  let sp=document.createElement("button"),sh=document.createElement("button");sp.textContent="🔊 Speaker";sh.textContent="🔗 Share";
  [sp,sh].forEach(x=>x.style.cssText="border:1px solid #d9deea;border-radius:10px;padding:6px 10px;background:#fff");
  sp.onclick=()=>{speechSynthesis.cancel();let u=new SpeechSynthesisUtterance(text);u.lang=LG[L.value]||"en-US";speechSynthesis.speak(u)};
  sh.onclick=async()=>{try{await navigator.share({title:"Global AI Mahlet",text})}catch(e){try{await navigator.clipboard.writeText(text);alert("Answer copied. You can share it now.")}catch(e){alert("Sharing is not available here.")}}};
  bar.append(sp,sh);r.querySelector(".message-content").append(bar)
 }
 C.querySelector(".chat-inner").append(r);C.scrollTop=C.scrollHeight
}
function speak(text){if(!vm)return;speechSynthesis.cancel();let u=new SpeechSynthesisUtterance(text);u.lang=LG[L.value]||"en-US";u.onend=()=>vm&&setTimeout(listen,250);speechSynthesis.speak(u)}
function listen(){
 if(!vm||listening)return;
 let SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR){alert("Voice recognition is not supported by this browser.");return}
 if(!rec){rec=new SR();rec.continuous=false;rec.interimResults=false;rec.onstart=()=>{listening=true;V.classList.add("active")};rec.onresult=e=>{let t=e.results[e.results.length-1][0].transcript.trim();if(t){I.value=t;sendMsg()}};rec.onend=()=>{listening=false;vm&&setTimeout(listen,400)};rec.onerror=e=>{listening=false;vm&&e.error!=="not-allowed"&&setTimeout(listen,700)}}
 rec.lang=LG[L.value]||"en-US";try{rec.start()}catch(e){}
}
function stopV(){vm=false;listening=false;V.classList.remove("active");try{rec?.stop()}catch(e){}speechSynthesis.cancel()}
V.onclick=()=>{if(vm){stopV();return}let SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR){alert("Voice recognition is not supported by this browser.");return}vm=true;speak("Voice mode is on.");setTimeout(listen,900)};
async function sendMsg(){
 let text=I.value.trim();if(!text&&!img)return;
 let im=img;img=null;I.value="";FN.textContent="";
 let shown=(im?"📷 "+im.name+"\n":"")+text;add("user",shown);ms.push({role:"user",content:shown});save();T.style.display="block";S.disabled=true;
 try{
  let endpoint=im?"/api/vision":"/api/chat",body=im?{image:im.data,prompt:text||"Describe and understand this image.",language:L.value}:{messages:ms.map(x=>({role:x.role,content:x.content})),language:L.value};
  let res=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}),raw=await res.text(),data;
  try{data=JSON.parse(raw)}catch(e){throw Error(raw||"Empty server response")}
  if(!res.ok)throw Error(data.error||"AI request failed");
  let ans=data.response||data.text||data.result||"I could not generate a response.";add("assistant",ans);ms.push({role:"assistant",content:ans});save();speak(ans)
 }catch(e){let err="AI connection error: "+e.message;add("assistant",err);vm&&speak(err)}
 finally{T.style.display="none";S.disabled=false;I.focus()}
}
function pick(f){
 if(!f)return;
 let rd=new FileReader();rd.onload=()=>{
  img={name:f.name,data:rd.result};
  FN.innerHTML="📷 <b>"+f.name+"</b> — ready to send";FN.style.display="block";
  let p=document.getElementById("gai-preview");if(p)p.remove();
  p=document.createElement("div");p.id="gai-preview";p.style.cssText="display:flex;align-items:center;gap:8px;margin:6px 0";
  let im=document.createElement("img");im.src=rd.result;im.style.cssText="width:55px;height:55px;object-fit:cover;border-radius:10px";p.append(im,FN);FN.parentElement?.insertBefore(p,FN)
 };rd.readAsDataURL(f)
}
P.onclick=()=>PI.click();CA.onclick=()=>CI.click();PI.onchange=()=>pick(PI.files[0]);CI.onchange=()=>pick(CI.files[0]);
F.onclick=()=>FI.click();FI.onchange=()=>{let f=FI.files[0];if(f){FN.textContent="📎 "+f.name;I.value="Please help me with this file: "+f.name;I.focus()}};
function tempMenu(){
 if(OT)OT.style.display="none";if(document.getElementById("temp-chat-menu"))return;
 let b=document.createElement("button");b.id="temp-chat-menu";b.innerHTML='<span style="font-size:22px">◯</span><span><b>Temporary Chat</b><small style="display:block;opacity:.6">Messages are not saved</small></span><span class="sw"><i></i></span>';
 b.style.cssText="width:100%;display:flex;align-items:center;gap:10px;padding:13px;border:0;border-radius:13px;background:linear-gradient(135deg,#eef4ff,#fff0fa);margin-top:12px;text-align:left";
 b.onclick=()=>{tmp=!tmp;let s=b.querySelector(".sw"),i=b.querySelector("i");s.style.background=tmp?"#172033":"#aaa";i.style.left=tmp?"18px":"2px"};
 let st=document.createElement("style");st.textContent=".sw{margin-left:auto;width:38px;height:22px;border-radius:20px;background:#aaa;position:relative}.sw i{position:absolute;left:2px;top:2px;width:18px;height:18px;border-radius:50%;background:#fff;transition:.2s}";document.head.append(st);SB.append(b)
}
function newChat(){stopV();tmp=false;cid=Date.now()+"";ms=[];img=null;C.querySelectorAll(".message").forEach(x=>x.remove());W.style.display="block";render();I.value="";FN.textContent="";SB.classList.remove("open")}
M.onclick=()=>{SB.classList.toggle("open");tempMenu()};N.onclick=newChat;Q.oninput=()=>render(Q.value);L.onchange=()=>rec&&(rec.lang=LG[L.value]||"en-US");
S.onclick=sendMsg;I.addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMsg()}});
I.addEventListener("input",()=>{I.style.height="auto";I.style.height=Math.min(I.scrollHeight,150)+"px"});
function fix(){
 document.documentElement.style.height="100%";document.body.style.cssText+=";height:100%;overflow:hidden";
 C.style.cssText+=";min-height:0;overflow-y:auto";
 let m=C.closest(".main");if(m)m.style.cssText+=";height:100%;min-height:0;display:flex;flex-direction:column";
 let co=I.closest(".composer")||I.parentElement?.parentElement;if(co)co.style.cssText+=";position:sticky;bottom:0;z-index:30;padding-bottom:calc(10px + env(safe-area-inset-bottom));background:rgba(255,255,255,.96);backdrop-filter:blur(12px)"
}
setupLang();tempMenu();fix();render();W.style.display="block";
})();
