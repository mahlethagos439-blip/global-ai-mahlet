(()=>{"use strict";

const $=id=>document.getElementById(id);
const input=$("user-input"),send=$("send-button"),chat=$("chat-messages");
const welcome=$("welcome"),typing=$("typing-indicator");
const voiceBtn=$("voice-button"),tempBtn=$("temporary-chat-button");
const lang=$("language-select"),recent=$("recent-chats");
const photoBtn=$("photo-button"),photoIn=$("photo-input");
const cameraBtn=$("camera-button"),cameraIn=$("camera-input");
const fileBtn=$("file-button"),fileIn=$("file-input");
const newBtn=$("new-chat-button"),menuBtn=$("menu-button"),sidebar=$("sidebar");
const search=$("recent-search"),fileName=$("file-name");

let messages=[],temporary=false,voiceMode=false,listening=false;
let recognition=null,currentChatId=Date.now().toString();

const LANGS={
English:"en-US",Amharic:"am-ET",Arabic:"ar-SA",Chinese:"zh-CN",
Spanish:"es-ES",French:"fr-FR",Portuguese:"pt-BR",Russian:"ru-RU",
German:"de-DE",Italian:"it-IT",Japanese:"ja-JP",Korean:"ko-KR",
Hindi:"hi-IN",Urdu:"ur-PK",Bengali:"bn-BD",Turkish:"tr-TR",
Dutch:"nl-NL",Swedish:"sv-SE",Norwegian:"no-NO",Danish:"da-DK",
Finnish:"fi-FI",Polish:"pl-PL",Ukrainian:"uk-UA",Greek:"el-GR",
Hebrew:"he-IL",Persian:"fa-IR",Swahili:"sw-KE",Hausa:"ha-NG",
Yoruba:"yo-NG",Igbo:"ig-NG",Somali:"so-SO",Oromo:"om-ET",
Tigrinya:"ti-ET",Vietnamese:"vi-VN",Thai:"th-TH",Indonesian:"id-ID",
Malay:"ms-MY",Filipino:"fil-PH",Romanian:"ro-RO",Czech:"cs-CZ",
Slovak:"sk-SK",Hungarian:"hu-HU",Bulgarian:"bg-BG",Serbian:"sr-RS",
Croatian:"hr-HR",Slovenian:"sl-SI",Lithuanian:"lt-LT",Latvian:"lv-LV",
Estonian:"et-EE",Icelandic:"is-IS"
};

function save(){
 if(temporary)return;
 localStorage.setItem("gai_"+currentChatId,JSON.stringify(messages));
 let ids=JSON.parse(localStorage.getItem("gai_recent")||"[]");
 ids=ids.filter(x=>x.id!==currentChatId);
 ids.unshift({id:currentChatId,title:messages.find(x=>x.role==="user")?.content?.slice(0,45)||"New Chat"});
 ids=ids.slice(0,30);
 localStorage.setItem("gai_recent",JSON.stringify(ids));
 renderRecent();
}

function renderRecent(filter=""){
 recent.innerHTML="";
 let ids=JSON.parse(localStorage.getItem("gai_recent")||"[]");
 ids.filter(x=>x.title.toLowerCase().includes(filter.toLowerCase())).forEach(x=>{
  let b=document.createElement("div");
  b.className="recent-chat"+(x.id===currentChatId?" active":"");
  b.textContent=x.title;
  b.onclick=()=>loadChat(x.id);
  recent.appendChild(b);
 });
}

function loadChat(id){
 stopVoice();
 currentChatId=id;
 messages=JSON.parse(localStorage.getItem("gai_"+id)||"[]");
 welcome.style.display=messages.length?"none":"block";
 chat.querySelectorAll(".message").forEach(x=>x.remove());
 messages.forEach(m=>addMessage(m.role,m.content));
 renderRecent(search.value);
 sidebar.classList.remove("open");
}

function showWelcome(){
 chat.querySelectorAll(".message").forEach(x=>x.remove());
 welcome.style.display="block";
}

function addMessage(role,text){
 welcome.style.display="none";
 let row=document.createElement("div");
 row.className="message "+(role==="user"?"user-message":"assistant-message");
 row.innerHTML='<div class="avatar">'+(role==="user"?"👤":"🤖")+
 '</div><div class="message-content"><div class="message-name">'+
 (role==="user"?"You":"Global AI Mahlet")+
 '</div><div class="message-text"></div></div>';
 row.querySelector(".message-text").textContent=text;
 chat.querySelector(".chat-inner").appendChild(row);
 chat.scrollTop=chat.scrollHeight;
}

function setTyping(v){typing.style.display=v?"block":"none";chat.scrollTop=chat.scrollHeight}

function speak(text){
 if(!voiceMode||!("speechSynthesis" in window))return;
 speechSynthesis.cancel();
 let u=new SpeechSynthesisUtterance(text);
 u.lang=LANGS[lang.value]||"en-US";
 u.onend=()=>{if(voiceMode)setTimeout(listenAgain,250)};
 speechSynthesis.speak(u);
}

function setupVoice(){
 const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
 if(!SR){alert("Voice recognition is not supported by this browser.");return false}
 if(recognition)return true;
 recognition=new SR();
 recognition.continuous=false;
 recognition.interimResults=false;
 recognition.lang=LANGS[lang.value]||"en-US";

 recognition.onstart=()=>{listening=true;voiceBtn.classList.add("active")};
 recognition.onresult=e=>{
  let t=e.results[e.results.length-1][0].transcript.trim();
  if(t){input.value=t;sendMessage()}
 };
 recognition.onend=()=>{
  listening=false;
  if(voiceMode)setTimeout(listenAgain,300);
 };
 recognition.onerror=e=>{
  listening=false;
  if(voiceMode&&e.error!=="not-allowed")setTimeout(listenAgain,700);
 };
 return true;
}

function listenAgain(){
 if(!voiceMode||listening)return;
 if(!setupVoice())return;
 try{
  recognition.lang=LANGS[lang.value]||"en-US";
  recognition.start();
 }catch(e){}
}

function stopVoice(){
 voiceMode=false;
 listening=false;
 voiceBtn.classList.remove("active");
 if(recognition)try{recognition.stop()}catch(e){}
 if("speechSynthesis"in window)speechSynthesis.cancel();
}

voiceBtn.onclick=()=>{
 if(voiceMode){stopVoice();return}
 if(!setupVoice())return;
 voiceMode=true;
 voiceBtn.classList.add("active");
 speak("Voice mode is on. You can speak to Global AI Mahlet.");
 setTimeout(listenAgain,900);
};

lang.onchange=()=>{
 if(recognition)recognition.lang=LANGS[lang.value]||"en-US";
};

async function sendMessage(){
 let text=input.value.trim();
 if(!text)return;
 input.value="";
 addMessage("user",text);
 messages.push({role:"user",content:text});
 save();
 setTyping(true);
 send.disabled=true;

 try{
  let res=await fetch("/api/chat",{
   method:"POST",
   headers:{"Content-Type":"application/json"},
   body:JSON.stringify({
    messages:messages.map(x=>({role:x.role,content:x.content})),
    language:lang.value
   })
  });

  let raw=await res.text(),data;
  try{data=JSON.parse(raw)}catch(e){throw new Error(raw||"Empty server response")}
  if(!res.ok)throw new Error(data.error||"AI request failed");

  let answer=data.response||data.text||data.result||"I could not generate a response.";
  addMessage("assistant",answer);
  messages.push({role:"assistant",content:answer});
  save();
  speak(answer);
 }catch(e){
  let err="AI connection error: "+e.message;
  addMessage("assistant",err);
  if(voiceMode)speak(err);
 }finally{
  setTyping(false);
  send.disabled=false;
  input.focus();
 }
}

async function handleImage(file){
 if(!file)return;
 fileName.textContent=file.name;
 let question=input.value.trim()||"Describe and understand this image.";
 input.value="";
 addMessage("user","📷 "+file.name+"\n"+question);
 messages.push({role:"user",content:"📷 "+file.name+"\n"+question});
 save();
 setTyping(true);
 try{
  let base64=await new Promise((resolve,reject)=>{
   let r=new FileReader();
   r.onload=()=>resolve(r.result);
   r.onerror=reject;
   r.readAsDataURL(file);
  });
  let res=await fetch("/api/vision",{
   method:"POST",
   headers:{"Content-Type":"application/json"},
   body:JSON.stringify({image:base64,prompt:question,language:lang.value})
  });
  let raw=await res.text(),data;
  try{data=JSON.parse(raw)}catch(e){throw new Error(raw||"Empty server response")}
  if(!res.ok)throw new Error(data.error||"Vision request failed");
  let answer=data.response||data.text||data.result||"I could not understand the image.";
  addMessage("assistant",answer);
  messages.push({role:"assistant",content:answer});
  save();
  speak(answer);
 }catch(e){
  let err="Image AI error: "+e.message;
  addMessage("assistant",err);
  if(voiceMode)speak(err);
 }finally{setTyping(false)}
}

send.onclick=sendMessage;
input.addEventListener("keydown",e=>{
 if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMessage()}
});
input.addEventListener("input",()=>{input.style.height="auto";input.style.height=Math.min(input.scrollHeight,150)+"px"});

photoBtn.onclick=()=>photoIn.click();
cameraBtn.onclick=()=>cameraIn.click();
fileBtn.onclick=()=>fileIn.click();

photoIn.onchange=()=>handleImage(photoIn.files[0]);
cameraIn.onchange=()=>handleImage(cameraIn.files[0]);

fileIn.onchange=()=>{
 let f=fileIn.files[0];
 if(!f)return;
 fileName.textContent=f.name;
 input.value="Please help me with this file: "+f.name;
 input.focus();
};

tempBtn.onclick=()=>{
 temporary=!temporary;
 tempBtn.classList.toggle("active",temporary);
 tempBtn.title=temporary?"Temporary chat ON":"Temporary chat";
};

newBtn.onclick=()=>{
 stopVoice();
 temporary=false;
 tempBtn.classList.remove("active");
 currentChatId=Date.now().toString();
 messages=[];
 showWelcome();
 renderRecent();
 input.value="";
 fileName.textContent="";
 sidebar.classList.remove("open");
};

menuBtn.onclick=()=>{
 sidebar.classList.toggle("open");
 if(!sidebar.querySelector(".mobile-close")){
  let x=document.createElement("button");
  x.className="mobile-close tool-button";
  x.textContent="✕";
  x.style.position="absolute";
  x.style.right="12px";
  x.style.top="12px";
  x.onclick=()=>sidebar.classList.remove("open");
  sidebar.appendChild(x);
 }
};

search.oninput=()=>renderRecent(search.value);

renderRecent();
showWelcome();
console.log("Global AI Mahlet loaded.");

})();
