(()=>{"use strict";
const $=id=>document.getElementById(id);
const I=$("user-input"),S=$("send-button"),C=$("chat-messages"),W=$("welcome"),T=$("typing-indicator"),V=$("voice-button"),OT=$("temporary-chat-button"),L=$("language-select"),R=$("recent-chats"),P=$("photo-button"),PI=$("photo-input"),CA=$("camera-button"),CI=$("camera-input"),F=$("file-button"),FI=$("file-input"),N=$("new-chat-button"),M=$("menu-button"),SB=$("sidebar"),Q=$("recent-search"),FN=$("file-name");

let ms=[],tmp=false,vm=false,listening=false,rec=null,cid=Date.now()+"",img=null,lastAnswer="";

const LG={
English:"en-US",Amharic:"am-ET",Arabic:"ar-SA",Chinese:"zh-CN",Spanish:"es-ES",French:"fr-FR",Portuguese:"pt-BR",Russian:"ru-RU",German:"de-DE",Italian:"it-IT",Japanese:"ja-JP",Korean:"ko-KR",Hindi:"hi-IN",Urdu:"ur-PK",Bengali:"bn-BD",Turkish:"tr-TR",Dutch:"nl-NL",Swedish:"sv-SE",Norwegian:"no-NO",Danish:"da-DK",Finnish:"fi-FI",Polish:"pl-PL",Ukrainian:"uk-UA",Greek:"el-GR",Hebrew:"he-IL",Persian:"fa-IR",Swahili:"sw-KE",Hausa:"ha-NG",Yoruba:"yo-NG",Igbo:"ig-NG",Somali:"so-SO",Oromo:"om-ET",Tigrigna:"ti-ET",Vietnamese:"vi-VN",Thai:"th-TH",Indonesian:"id-ID",Malay:"ms-MY",Filipino:"fil-PH",Romanian:"ro-RO",Czech:"cs-CZ",Slovak:"sk-SK",Hungarian:"hu-HU",Bulgarian:"bg-BG",Serbian:"sr-RS",Croatian:"hr-HR",Slovenian:"sl-SI",Lithuanian:"lt-LT",Latvian:"lv-LV",Estonian:"et-EE",Icelandic:"is-IS",Afrikaans:"af-ZA",Albanian:"sq-AL",Armenian:"hy-AM",Azerbaijani:"az-AZ",Basque:"eu-ES",Belarusian:"be-BY",Bosnian:"bs-BA",Catalan:"ca-ES",Georgian:"ka-GE",Gujarati:"gu-IN",Kannada:"kn-IN",Kazakh:"kk-KZ",Khmer:"km-KH",Kyrgyz:"ky-KG",Lao:"lo-LA",Macedonian:"mk-MK",Malayalam:"ml-IN",Marathi:"mr-IN",Mongolian:"mn-MN",Nepali:"ne-NP",Pashto:"ps-AF",Punjabi:"pa-IN",Sinhala:"si-LK",Tamil:"ta-IN",Telugu:"te-IN",Uzbek:"uz-UZ",Welsh:"cy-GB",Zulu:"zu-ZA",Burmese:"my-MM",Galician:"gl-ES"
};

function setupLang(){
 let old=L.value;
 L.innerHTML="";
 Object.keys(LG).forEach(x=>{
  let o=document.createElement("option");
  o.value=x;o.textContent=x;L.append(o);
 });
 L.value=LG[old]?old:"English";
}

function recent(){return JSON.parse(localStorage.getItem("gai_recent")||"[]")}
function setRecent(a){localStorage.setItem("gai_recent",JSON.stringify(a))}
function title(){
 let x=ms.find(m=>m.role==="user");
 return (x?.content||"New Chat").replace(/^📷 .*?\n/,"").slice(0,45)||"New Chat";
}

function save(){
 if(tmp)return;
 localStorage.setItem("gai_"+cid,JSON.stringify(ms));
 let a=recent(),old=a.find(x=>x.id===cid);
 a=a.filter(x=>x.id!==cid);
 a.unshift({id:cid,title:title(),pinned:old?.pinned||false});
 setRecent(a.slice(0,30));renderRecent(Q?.value||"");
}

function renderRecent(filter=""){
 if(!R)return;
 R.innerHTML="";
 recent().filter(x=>x.title.toLowerCase().includes(filter.toLowerCase()))
 .sort((a,b)=>Number(b.pinned)-Number(a.pinned))
 .forEach(x=>{
  let d=document.createElement("div");
  d.className="recent-chat"+(x.id===cid?" active":"");
  d.style.cssText="position:relative;display:flex;align-items:center;gap:5px;padding:9px;border-radius:10px";
  let t=document.createElement("span");
  t.textContent=(x.pinned?"📌 ":"")+x.title;
  t.style.cssText="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap";
  let b=document.createElement("button");
  b.textContent="⋮";
  b.style.cssText="border:0;background:none;font-size:21px";
  b.onclick=e=>{
   e.stopPropagation();
   document.querySelectorAll(".chat-actions").forEach(z=>z.remove());
   let q=document.createElement("div");
   q.className="chat-actions";
   q.style.cssText="position:absolute;right:4px;top:42px;z-index:99;background:white;border:1px solid #ddd;border-radius:12px;padding:5px;box-shadow:0 10px 30px #0002";
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
     if(x.id===cid)newChat();else renderRecent(Q?.value||"");
    }]
   ].forEach(v=>{
    let z=document.createElement("button");
    z.textContent=v[0]+" "+v[1];
    z.style.cssText="display:block;width:130px;text-align:left;border:0;background:none;padding:9px";
    z.onclick=e=>{e.stopPropagation();v[2]();q.remove()};
    q.append(z);
   });
   d.append(q);
  };
  d.onclick=()=>loadChat(x.id);
  d.append(t,b);R.append(d);
 });
}

function clearMessages(){
 C?.querySelectorAll(".message").forEach(x=>x.remove());
}

function loadChat(id){
 stopVoice();
 cid=id;
 ms=JSON.parse(localStorage.getItem("gai_"+id)||"[]");
 img=null;
 if(FN)FN.textContent="";
 clearMessages();
 W.style.display=ms.length?"none":"block";
 ms.forEach(x=>addMessage(x.role,x.content));
 renderRecent(Q?.value||"");
 SB?.classList.remove("open");
}

function formatText(text){
 let box=document.createElement("div");
 box.className="message-text";
 let lines=text.split("\n"),out="";
 lines.forEach(line=>{
  if(/^```/.test(line)){out+="";return}
  if(/^#{1,3}\s/.test(line)){
   out+="<strong>"+line.replace(/^#{1,3}\s/,"")+"</strong><br>";
  }else if(/^[-*]\s/.test(line)){
   out+="• "+line.replace(/^[-*]\s/,"")+"<br>";
  }else{
   out+=line?line.replace(/</g,"&lt;").replace(/>/g,"&gt;")+"<br>":"<br>";
  }
 });
 box.innerHTML=out;
 return box;
}

function addMessage(role,text){
 W.style.display="none";
 let r=document.createElement("div");
 r.className="message "+(role==="user"?"user-message":"assistant-message");
 r.innerHTML='<div class="avatar">'+(role==="user"?"👤":"🤖")+'</div><div class="message-content"><div class="message-name">'+(role==="user"?"You":"Global AI Mahlet")+'</div></div>';
 let content=r.querySelector(".message-content");
 content.append(formatText(text));

 if(role!=="user"){
  let bar=document.createElement("div");
  bar.style.cssText="display:flex;gap:8px;margin-top:9px;flex-wrap:wrap";

  let sp=document.createElement("button"),sh=document.createElement("button"),rg=document.createElement("button");
  sp.textContent="🔊 Speaker";
  sh.textContent="🔗 Share";
  rg.textContent="🔄 Regenerate";

  [sp,sh,rg].forEach(x=>x.style.cssText="border:1px solid #d9deea;border-radius:10px;padding:6px 10px;background:#fff");

  sp.onclick=()=>speakNow(text);

  sh.onclick=async()=>{
   try{
    if(navigator.share)await navigator.share({title:"Global AI Mahlet",text:text});
    else{
     await navigator.clipboard.writeText(text);
     alert("Answer copied. You can share it now.");
    }
   }catch(e){}
  };

  rg.onclick=()=>regenerate();

  bar.append(sp,sh,rg);
  content.append(bar);
 }
 C.querySelector(".chat-inner").append(r);
 C.scrollTop=C.scrollHeight;
 return r;
}

function speakNow(text){
 if(!("speechSynthesis" in window))return;
 speechSynthesis.cancel();
 let u=new SpeechSynthesisUtterance(text);
 u.lang=LG[L.value]||"en-US";
 speechSynthesis.speak(u);
}

function speak(text){
 if(!vm)return;
 speakNow(text);
 let u=speechSynthesis;
}

function listen(){
 if(!vm||listening)return;
 let SR=window.SpeechRecognition||window.webkitSpeechRecognition;
 if(!SR){alert("Voice recognition is not supported by this browser.");return}

 if(!rec){
  rec=new SR();
  rec.continuous=false;
  rec.interimResults=false;
  rec.onstart=()=>{listening=true;V.classList.add("active")};
  rec.onresult=e=>{
   let t=e.results[e.results.length-1][0].transcript.trim();
   if(t){I.value=t;sendMessage()}
  };
  rec.onend=()=>{
   listening=false;
   V.classList.remove("active");
   if(vm)setTimeout(listen,500);
  };
  rec.onerror=e=>{
   listening=false;
   V.classList.remove("active");
   if(vm&&e.error!=="not-allowed")setTimeout(listen,800);
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
 if("speechSynthesis" in window)speechSynthesis.cancel();
}

V.onclick=()=>{
 if(vm){stopVoice();return}
 let SR=window.SpeechRecognition||window.webkitSpeechRecognition;
 if(!SR){alert("Voice recognition is not supported by this browser.");return}
 vm=true;
 speakNow("Voice mode is on.");
 setTimeout(listen,900);
};

async function regenerate(){
 let last=ms[ms.length-1];
 if(!last||last.role!=="assistant")return;
 ms.pop();
 let user=ms[ms.length-1];
 if(!user||user.role!=="user")return;
 C.querySelector(".assistant-message:last-of-type")?.remove();
 I.value="";
 await requestAI(user.content,false,true);
}

async function sendMessage(){
 let text=I.value.trim();
 if(!text&&!img)return;

 let im=img;
 img=null;
 I.value="";
 if(FN)FN.textContent="";
 document.getElementById("gai-preview")?.remove();

 let shown=(im?"📷 "+im.name+"\n":"")+text;
 addMessage("user",shown);
 ms.push({role:"user",content:shown});
 save();
 await requestAI(text,!!im,false);
}

async function requestAI(text,hasImage,regenerateMode){
 T.style.display="block";
 S.disabled=true;

 try{
  let endpoint=hasImage?"/api/vision":"/api/chat";
  let body=hasImage
   ?{image:window.__gaiImage?.data,prompt:text||"Describe and understand this image.",language:L.value}
   :{messages:ms.map(x=>({role:x.role,content:x.content})),language:L.value};

  if(hasImage)window.__gaiImage=null;

  let res=await fetch(endpoint,{
   method:"POST",
   headers:{"Content-Type":"application/json"},
   body:JSON.stringify(body)
  });

  let raw=await res.text(),data;
  try{data=JSON.parse(raw)}catch(e){throw Error(raw||"Empty server response")}

  if(!res.ok)throw Error(data.error||"AI request failed");

  let ans=data.response||data.text||data.result||"I could not generate a response.";
  lastAnswer=ans;
  addMessage("assistant",ans);
  ms.push({role:"assistant",content:ans});
  save();
  speak(ans);

 }catch(e){
  let err="AI connection error: "+e.message;
  addMessage("assistant",err);
  if(vm)speak(err);
 }finally{
  T.style.display="none";
  S.disabled=false;
  I.focus();
 }
}

function pick(f){
 if(!f||!f.type.startsWith("image/"))return;

 let reader=new FileReader();
 reader.onload=()=>{
  img={name:f.name,data:reader.result};
  window.__gaiImage=img;

  document.getElementById("gai-preview")?.remove();

  let p=document.createElement("div");
  p.id="gai-preview";
  p.style.cssText="display:flex;align-items:center;gap:8px;margin:6px 0;padding:7px;border-radius:12px;background:#f4f7ff";

  let im=document.createElement("img");
  im.src=reader.result;
  im.style.cssText="width:58px;height:58px;object-fit:cover;border-radius:10px";

  let tx=document.createElement("span");
  tx.textContent="📷 "+f.name+" — ready";
  tx.style.cssText="font-size:13px;overflow:hidden;text-overflow:ellipsis";

  p.append(im,tx);

  let parent=I.closest(".composer")||I.parentElement;
  parent?.insertBefore(p,I);
 };
 reader.readAsDataURL(f);
}

P.onclick=()=>PI.click();
CA.onclick=()=>CI.click();
PI.onchange=()=>pick(PI.files[0]);
CI.onchange=()=>pick(CI.files[0]);

F.onclick=()=>FI.click();
FI.onchange=()=>{
 let f=FI.files[0];
 if(!f)return;
 FN.textContent="📎 "+f.name;
 I.value="Please help me with this file: "+f.name;
 I.focus();
};

function tempMenu(){
 if(OT)OT.style.display="none";
 if(document.getElementById("temp-chat-menu"))return;

 let b=document.createElement("button");
 b.id="temp-chat-menu";
 b.innerHTML='<span style="font-size:22px">◯</span><span><b>Temporary Chat</b><small style="display:block;opacity:.6">Messages are not saved</small></span><span class="sw"><i></i></span>';
 b.style.cssText="width:100%;display:flex;align-items:center;gap:10px;padding:13px;border:0;border-radius:13px;background:linear-gradient(135deg,#eef4ff,#fff0fa);margin-top:12px;text-align:left";

 b.onclick=()=>{
  tmp=!tmp;
  updateTempUI();
 };

 let st=document.createElement("style");
 st.textContent=".sw{margin-left:auto;width:38px;height:22px;border-radius:20px;background:#aaa;position:relative}.sw i{position:absolute;left:2px;top:2px;width:18px;height:18px;border-radius:50%;background:#fff;transition:.2s}";
 document.head.append(st);
 SB.append(b);
 updateTempUI();
}

function updateTempUI(){
 let b=document.getElementById("temp-chat-menu");
 if(!b)return;
 let s=b.querySelector(".sw"),i=b.querySelector(".sw i");
 s.style.background=tmp?"#172033":"#aaa";
 i.style.left=tmp?"18px":"2px";
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
 if(FN)FN.textContent="";
 document.getElementById("gai-preview")?.remove();
 SB?.classList.remove("open");
}

M.onclick=()=>{
 SB.classList.toggle("open");
 tempMenu();
};

N.onclick=newChat;
Q.oninput=()=>renderRecent(Q.value);
L.onchange=()=>{if(rec)rec.lang=LG[L.value]||"en-US"};

S.onclick=sendMessage;

I.addEventListener("keydown",e=>{
 if(e.key==="Enter"&&!e.shiftKey){
  e.preventDefault();
  sendMessage();
 }
});

I.addEventListener("input",()=>{
 I.style.height="auto";
 I.style.height=Math.min(I.scrollHeight,150)+"px";
});

function fixMobile(){
 document.documentElement.style.height="100%";
 document.body.style.cssText+=";height:100%;overflow:hidden";
 C.style.cssText+=";min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch";
 let main=C.closest(".main");
 if(main)main.style.cssText+=";height:100%;min-height:0;display:flex;flex-direction:column";
 let co=I.closest(".composer")||I.parentElement?.parentElement;
 if(co)co.style.cssText+=";position:sticky;bottom:0;z-index:30;padding-bottom:calc(10px + env(safe-area-inset-bottom));background:rgba(255,255,255,.96);backdrop-filter:blur(12px)";
}

setupLang();
tempMenu();
fixMobile();
renderRecent();
W.style.display="block";
})();
