(()=>{"use strict";

const $=id=>document.getElementById(id);

const I=$("user-input"),S=$("send-button"),C=$("chat-messages"),
W=$("welcome"),T=$("typing-indicator"),V=$("voice-button"),
OT=$("temporary-chat-button"),L=$("language-select"),R=$("recent-chats"),
P=$("photo-button"),PI=$("photo-input"),CA=$("camera-button"),
CI=$("camera-input"),F=$("file-button"),FI=$("file-input"),
N=$("new-chat-button"),M=$("menu-button"),SB=$("sidebar"),
Q=$("recent-search"),FN=$("file-name");

let ms=[],tmp=false,vm=false,listening=false,rec=null;
let cid=Date.now()+"",img=null;

const LG={
English:"en-US",Amharic:"am-ET",Arabic:"ar-SA",Chinese:"zh-CN",
Spanish:"es-ES",French:"fr-FR",Portuguese:"pt-BR",Russian:"ru-RU",
German:"de-DE",Italian:"it-IT",Japanese:"ja-JP",Korean:"ko-KR",
Hindi:"hi-IN",Urdu:"ur-PK",Bengali:"bn-BD",Turkish:"tr-TR",
Dutch:"nl-NL",Swedish:"sv-SE",Norwegian:"no-NO",Danish:"da-DK",
Finnish:"fi-FI",Polish:"pl-PL",Ukrainian:"uk-UA",Greek:"el-GR",
Hebrew:"he-IL",Persian:"fa-IR",Swahili:"sw-KE",Hausa:"ha-NG",
Yoruba:"yo-NG",Igbo:"ig-NG",Somali:"so-SO",Oromo:"om-ET",
Tigrigna:"ti-ET",Vietnamese:"vi-VN",Thai:"th-TH",Indonesian:"id-ID",
Malay:"ms-MY",Filipino:"fil-PH",Romanian:"ro-RO",Czech:"cs-CZ",
Slovak:"sk-SK",Hungarian:"hu-HU",Bulgarian:"bg-BG",Serbian:"sr-RS",
Croatian:"hr-HR",Slovenian:"sl-SI",Lithuanian:"lt-LT",Latvian:"lv-LV",
Estonian:"et-EE",Icelandic:"is-IS",Afrikaans:"af-ZA",Albanian:"sq-AL",
Armenian:"hy-AM",Azerbaijani:"az-AZ",Basque:"eu-ES",Belarusian:"be-BY",
Bosnian:"bs-BA",Catalan:"ca-ES",Georgian:"ka-GE",Gujarati:"gu-IN",
Kannada:"kn-IN",Kazakh:"kk-KZ",Khmer:"km-KH",Kyrgyz:"ky-KG",
Lao:"lo-LA",Macedonian:"mk-MK",Malayalam:"ml-IN",Marathi:"mr-IN",
Mongolian:"mn-MN",Nepali:"ne-NP",Pashto:"ps-AF",Punjabi:"pa-IN",
Sinhala:"si-LK",Tamil:"ta-IN",Telugu:"te-IN",Uzbek:"uz-UZ",
Welsh:"cy-GB",Zulu:"zu-ZA",Burmese:"my-MM",Galician:"gl-ES"
};

function setupLang(){
 if(!L)return;
 let old=L.value;
 L.innerHTML="";
 Object.keys(LG).forEach(x=>{
  let o=document.createElement("option");
  o.value=x;o.textContent=x;L.append(o);
 });
 L.value=LG[old]?old:"English";
}

function recent(){
 try{return JSON.parse(localStorage.getItem("gai_recent")||"[]")}
 catch(e){return[]}
}

function setRecent(a){
 localStorage.setItem("gai_recent",JSON.stringify(a));
}

function chatTitle(){
 let x=ms.find(m=>m.role==="user");
 return (x?.content||"New Chat")
  .replace(/^📷 .*?\n/,"")
  .slice(0,45)||"New Chat";
}

function save(){
 if(tmp)return;

 localStorage.setItem("gai_"+cid,JSON.stringify(ms));

 let a=recent(),old=a.find(x=>x.id===cid);
 a=a.filter(x=>x.id!==cid);

 a.unshift({
  id:cid,
  title:chatTitle(),
  pinned:old?.pinned||false
 });

 setRecent(a.slice(0,30));
 renderRecent(Q?.value||"");
}

function renderRecent(filter=""){
 if(!R)return;

 R.innerHTML="";

 recent()
 .filter(x=>x.title.toLowerCase().includes(filter.toLowerCase()))
 .sort((a,b)=>Number(b.pinned)-Number(a.pinned))
 .forEach(x=>{

  let d=document.createElement("div");
  d.className="recent-chat"+(x.id===cid?" active":"");

  d.style.cssText=
  "position:relative;display:flex;align-items:center;gap:6px;padding:10px;border-radius:11px;min-height:44px";

  let t=document.createElement("span");
  t.textContent=(x.pinned?"📌 ":"")+x.title;
  t.style.cssText=
  "flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap";

  let b=document.createElement("button");
  b.textContent="⋮";
  b.style.cssText=
  "border:0;background:none;font-size:22px;min-width:38px;min-height:38px";

  b.onclick=e=>{
   e.stopPropagation();

   document.querySelectorAll(".chat-actions")
   .forEach(z=>z.remove());

   let q=document.createElement("div");
   q.className="chat-actions";

   q.style.cssText=
   "position:absolute;right:4px;top:44px;z-index:9999;background:white;border:1px solid #ddd;border-radius:13px;padding:5px;box-shadow:0 10px 30px #0002";

   [
    ["📌",x.pinned?"Unpin":"Pin",()=>{
     x.pinned=!x.pinned;
     setRecent(recent().map(z=>z.id===x.id?x:z));
     renderRecent(Q?.value||"");
    }],
    ["✏️","Rename",()=>{
     let n=prompt("Rename chat:",x.title);
     if(n?.trim()){
      x.title=n.trim();
      setRecent(recent().map(z=>z.id===x.id?x:z));
      renderRecent(Q?.value||"");
     }
    }],
    ["🗑️","Delete",()=>{
     localStorage.removeItem("gai_"+x.id);
     setRecent(recent().filter(z=>z.id!==x.id));

     if(x.id===cid)newChat();
     else renderRecent(Q?.value||"");
    }]
   ].forEach(v=>{
    let z=document.createElement("button");

    z.textContent=v[0]+" "+v[1];

    z.style.cssText=
    "display:block;width:135px;text-align:left;border:0;background:none;padding:10px;border-radius:8px";

    z.onclick=e=>{
     e.stopPropagation();
     v[2]();
     q.remove();
    };

    q.append(z);
   });

   d.append(q);
  };

  d.onclick=()=>loadChat(x.id);

  d.append(t,b);
  R.append(d);
 });
}

function clearMessages(){
 if(!C)return;
 C.querySelectorAll(".message").forEach(x=>x.remove());
}

function loadChat(id){
 stopVoice();

 cid=id;
 ms=JSON.parse(localStorage.getItem("gai_"+id)||"[]");

 img=null;
 window.__gaiImage=null;

 if(FN)FN.textContent="";

 document.getElementById("gai-preview")?.remove();

 clearMessages();

 W.style.display=ms.length?"none":"block";

 ms.forEach(x=>addMessage(x.role,x.content));

 renderRecent(Q?.value||"");

 SB?.classList.remove("open");
}

function safeText(text){
 return String(text)
 .replace(/&/g,"&amp;")
 .replace(/</g,"&lt;")
 .replace(/>/g,"&gt;");
}

function makeText(text){
 let box=document.createElement("div");
 box.className="message-text";

 let lines=String(text).split("\n");

 lines.forEach(line=>{

  let row=document.createElement("div");

  if(/^#{1,3}\s/.test(line)){
   let strong=document.createElement("strong");
   strong.textContent=line.replace(/^#{1,3}\s/,"");
   row.append(strong);

  }else if(/^[-*]\s/.test(line)){
   row.textContent="• "+line.replace(/^[-*]\s/,"");

  }else{
   row.textContent=line;
  }

  box.append(row);
 });

 return box;
}

function addMessage(role,text){
 W.style.display="none";

 let r=document.createElement("div");

 r.className=
 "message "+(role==="user"?"user-message":"assistant-message");

 r.innerHTML=
 '<div class="avatar">'+
 (role==="user"?"👤":"🤖")+
 '</div>'+
 '<div class="message-content">'+
 '<div class="message-name">'+
 (role==="user"?"You":"Global AI Mahlet")+
 '</div>'+
 '</div>';

 let content=r.querySelector(".message-content");

 content.append(makeText(text));

 if(role!=="user"){

  let bar=document.createElement("div");

  bar.style.cssText=
  "display:flex;gap:8px;margin-top:10px;flex-wrap:wrap";

  let sp=document.createElement("button");
  let sh=document.createElement("button");

  sp.textContent="🔊 Speaker";
  sh.textContent="🔗 Share";

  [sp,sh].forEach(x=>{
   x.style.cssText=
   "min-height:38px;border:1px solid #d9deea;border-radius:11px;padding:7px 12px;background:#fff;font-weight:600";
  });

  sp.onclick=()=>speakNow(text);

  sh.onclick=async()=>{
   try{
    if(navigator.share){
     await navigator.share({
      title:"Global AI Mahlet",
      text:String(text)
     });
    }else if(navigator.clipboard){
     await navigator.clipboard.writeText(String(text));
     alert("Answer copied. You can share it now.");
    }else{
     alert("Sharing is not available here.");
    }
   }catch(e){}
  };

  bar.append(sp,sh);
  content.append(bar);
 }

 let inner=C.querySelector(".chat-inner");

 if(inner)inner.append(r);
 else C.append(r);

 C.scrollTop=C.scrollHeight;

 return r;
}

function speakNow(text){
 if(!("speechSynthesis" in window))return;

 speechSynthesis.cancel();

 let u=new SpeechSynthesisUtterance(String(text));

 u.lang=LG[L.value]||"en-US";

 speechSynthesis.speak(u);
}

function speak(text){
 if(!vm)return;
 speakNow(text);
}

function listen(){
 if(!vm||listening)return;

 let SR=
 window.SpeechRecognition||
 window.webkitSpeechRecognition;

 if(!SR){
  alert("Voice recognition is not supported by this browser.");
  return;
 }

 if(!rec){

  rec=new SR();

  rec.continuous=false;
  rec.interimResults=false;

  rec.onstart=()=>{
   listening=true;
   V?.classList.add("active");
  };

  rec.onresult=e=>{
   let t=
   e.results[e.results.length-1][0].transcript.trim();

   if(t){
    I.value=t;
    sendMessage();
   }
  };

  rec.onend=()=>{
   listening=false;
   V?.classList.remove("active");

   if(vm)setTimeout(listen,500);
  };

  rec.onerror=e=>{
   listening=false;
   V?.classList.remove("active");

   if(vm&&e.error!=="not-allowed")
    setTimeout(listen,800);
  };
 }

 rec.lang=LG[L.value]||"en-US";

 try{rec.start()}catch(e){}
}

function stopVoice(){
 vm=false;
 listening=false;

 V?.classList.remove("active");

 try{rec?.stop()}catch(e){}

 if("speechSynthesis" in window)
  speechSynthesis.cancel();
}

V.onclick=()=>{

 if(vm){
  stopVoice();
  return;
 }

 let SR=
 window.SpeechRecognition||
 window.webkitSpeechRecognition;

 if(!SR){
  alert("Voice recognition is not supported by this browser.");
  return;
 }

 vm=true;

 speakNow("Voice mode is on.");

 setTimeout(listen,900);
};

async function sendMessage(){

 let text=I.value.trim();

 if(!text&&!img)return;

 let im=img;

 img=null;

 I.value="";

 if(FN)FN.textContent="";

 document.getElementById("gai-preview")?.remove();

 let shown=
 (im?"📷 "+im.name+"\n":"")+
 text;

 addMessage("user",shown);

 ms.push({
  role:"user",
  content:shown
 });

 save();

 await requestAI(text,im);
}

async function requestAI(text,im){

 T.style.display="block";
 S.disabled=true;

 try{

  let endpoint=im?"/api/vision":"/api/chat";

  let body=im
   ?{
      image:im.data,
      prompt:text||"Describe and understand this image.",
      language:L.value
    }
   :{
      messages:ms.map(x=>({
       role:x.role,
       content:x.content
      })),
      language:L.value
    };

  let res=await fetch(endpoint,{
   method:"POST",
   headers:{
    "Content-Type":"application/json"
   },
   body:JSON.stringify(body)
  });

  let raw=await res.text();

  let data;

  try{
   data=JSON.parse(raw);
  }catch(e){
   throw Error(raw||"Empty server response");
  }

  if(!res.ok)
   throw Error(data.error||"AI request failed");

  let ans=
   data.response||
   data.text||
   data.result||
   "I could not generate a response.";

  addMessage("assistant",ans);

  ms.push({
   role:"assistant",
   content:ans
  });

  save();

  speak(ans);

 }catch(e){

  let err=
  "AI connection error: "+
  (e.message||"Unknown error.");

  addMessage("assistant",err);

  if(vm)speak(err);

 }finally{

  T.style.display="none";
  S.disabled=false;

  I.focus();
 }
}

function pick(f){

 if(!f)return;

 if(!f.type.startsWith("image/")){
  alert("Please select an image.");
  return;
 }

 let reader=new FileReader();

 reader.onload=()=>{

  img={
   name:f.name,
   data:reader.result
  };

  window.__gaiImage=img;

  document.getElementById("gai-preview")?.remove();

  let p=document.createElement("div");

  p.id="gai-preview";

  p.style.cssText=
  "display:flex;align-items:center;gap:9px;margin:6px 0;padding:8px;border-radius:13px;background:#f1f5ff;border:1px solid #dbe3ff";

  let im=document.createElement("img");

  im.src=reader.result;

  im.style.cssText=
  "width:58px;height:58px;object-fit:cover;border-radius:10px";

  let tx=document.createElement("span");

  tx.textContent=
  "📷 "+f.name+" — ready to send";

  tx.style.cssText=
  "font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis";

  p.append(im,tx);

  let parent=
   I.closest(".composer")||
   I.parentElement;

  if(parent)parent.insertBefore(p,I);

 };

 reader.readAsDataURL(f);
}

if(P)P.onclick=()=>PI.click();
if(CA)CA.onclick=()=>CI.click();

if(PI)
 PI.onchange=()=>pick(PI.files[0]);

if(CI)
 CI.onchange=()=>pick(CI.files[0]);

if(F)
 F.onclick=()=>FI.click();

if(FI)
 FI.onchange=()=>{

  let f=FI.files[0];

  if(!f)return;

  FN.textContent="📎 "+f.name;

  I.value=
  "Please help me with this file: "+
  f.name;

  I.focus();
 };

function updateTempUI(){

 let b=document.getElementById("temp-chat-menu");

 if(!b)return;

 let sw=b.querySelector(".sw");
 let dot=b.querySelector(".sw i");

 if(sw)
  sw.style.background=tmp?"#172033":"#aaa";

 if(dot)
  dot.style.left=tmp?"18px":"2px";
}

function tempMenu(){

 if(OT)
  OT.style.display="none";

 if(!SB)
  return;

 if(document.getElementById("temp-chat-menu"))
  return;

 let b=document.createElement("button");

 b.id="temp-chat-menu";

 b.type="button";

 b.innerHTML=
 '<span style="font-size:22px">◯</span>'+
 '<span><b>Temporary Chat</b>'+
 '<small style="display:block;opacity:.65">'+
 'Messages are not saved</small></span>'+
 '<span class="sw"><i></i></span>';

 b.style.cssText=
 "width:100%;display:flex;align-items:center;gap:10px;padding:14px;border:0;border-radius:13px;background:linear-gradient(135deg,#eef4ff,#fff0fa);margin-top:14px;text-align:left;min-height:60px";

 b.onclick=()=>{
  tmp=!tmp;
  updateTempUI();
 };

 let st=document.createElement("style");

 st.textContent=
 ".sw{margin-left:auto;width:40px;height:23px;border-radius:20px;background:#aaa;position:relative;flex-shrink:0}.sw i{position:absolute;left:2px;top:2px;width:19px;height:19px;border-radius:50%;background:#fff;transition:.2s}";

 document.head.append(st);

 SB.append(b);

 updateTempUI();
}

function addSidebarClose(){

 if(!SB||
 document.getElementById("gai-sidebar-close"))
  return;

 SB.style.position="relative";

 let x=document.createElement("button");

 x.id="gai-sidebar-close";

 x.type="button";

 x.textContent="✕";

 x.setAttribute("aria-label","Close menu");

 x.style.cssText=
 "position:absolute!important;top:10px!important;right:10px!important;width:44px!important;height:44px!important;min-width:44px!important;min-height:44px!important;border:1px solid #d8deea!important;border-radius:12px!important;background:#fff!important;color:#172033!important;font-size:25px!important;font-weight:700!important;display:flex!important;align-items:center!important;justify-content:center!important;z-index:10000!important;box-shadow:0 3px 12px rgba(0,0,0,.08)!important";

 x.onclick=()=>{
  SB.classList.remove("open");
 };

 SB.appendChild(x);
}

function newChat(){

 stopVoice();

 tmp=false;

 updateTempUI();

 cid=Date.now()+"";

 ms=[];

 img=null;

 window.__gaiImage=null;

 clearMessages();

 W.style.display="block";

 renderRecent();

 I.value="";

 if(FN)
  FN.textContent="";

 document.getElementById("gai-preview")?.remove();

 SB?.classList.remove("open");
}

function mobileFix(){

 document.documentElement.style.height="100%";

 document.body.style.cssText+=
 ";height:100%;overflow:hidden";

 if(C){
  C.style.cssText+=
  ";min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch";
 }

 let main=C?.closest(".main");

 if(main){
  main.style.cssText+=
  ";height:100%;min-height:0;display:flex;flex-direction:column";
 }

 let co=
 I?.closest(".composer")||
 I?.parentElement?.parentElement;

 if(co){

  co.style.cssText+=`
   position:fixed!important;
   left:0!important;
   right:0!important;
   bottom:0!important;
   z-index:9999!important;
   width:100%!important;
   box-sizing:border-box!important;
   padding:9px 8px calc(14px + env(safe-area-inset-bottom,0px))!important;
   background:rgba(255,255,255,.98)!important;
   border-top:1px solid #dfe5f0!important;
   box-shadow:0 -6px 22px rgba(0,0,0,.10)!important;
  `;

  let buttons=co.querySelectorAll("button");

  buttons.forEach(b=>{

   b.style.cssText+=`
    min-width:46px!important;
    width:auto!important;
    min-height:46px!important;
    height:46px!important;
    display:inline-flex!important;
    align-items:center!important;
    justify-content:center!important;
    visibility:visible!important;
    opacity:1!important;
    flex-shrink:0!important;
    border-radius:13px!important;
    font-size:21px!important;
    padding:6px!important;
    touch-action:manipulation!important;
   `;

  });

  if(S){

   S.style.cssText+=`
    min-width:54px!important;
    width:54px!important;
    min-height:46px!important;
    height:46px!important;
    font-size:22px!important;
    font-weight:800!important;
   `;
  }

  if(I){

   I.style.cssText+=`
    min-height:44px!important;
    max-height:110px!important;
    box-sizing:border-box!important;
   `;
  }
 }

 let st=document.createElement("style");

 st.textContent=`

 #chat-messages{
   padding-bottom:135px!important;
 }

 #photo-button,
 #camera-button,
 #file-button,
 #voice-button,
 #send-button{
   visibility:visible!important;
   opacity:1!important;
 }

 #voice-button.active{
   transform:scale(1.05);
   box-shadow:0 0 0 4px rgba(90,110,255,.16)!important;
 }

 @media(max-width:700px){

   .composer{
     position:fixed!important;
     left:0!important;
     right:0!important;
     bottom:0!important;
     width:100%!important;
     box-sizing:border-box!important;
     padding:
       9px 7px
       calc(14px + env(safe-area-inset-bottom,0px))
       !important;
   }

   .composer button{
     min-width:46px!important;
     min-height:46px!important;
     height:46px!important;
   }

   #send-button{
     min-width:54px!important;
     width:54px!important;
   }
 }

 `;

 document.head.appendChild(st);
}

M.onclick=()=>{
 SB?.classList.toggle("open");
 tempMenu();
};

if(N)N.onclick=newChat;

if(Q)
 Q.oninput=()=>renderRecent(Q.value);

if(L)
 L.onchange=()=>{
  if(rec)
   rec.lang=LG[L.value]||"en-US";
 };

if(S)
 S.onclick=sendMessage;

if(I){

 I.addEventListener("keydown",e=>{

  if(e.key==="Enter"&&!e.shiftKey){

   e.preventDefault();

   sendMessage();
  }

 });

 I.addEventListener("input",()=>{

  I.style.height="auto";

  I.style.height=
   Math.min(I.scrollHeight,150)+"px";

 });
}

setupLang();
tempMenu();
addSidebarClose();
mobileFix();
renderRecent();

W.style.display="block";

})();
