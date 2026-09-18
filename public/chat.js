const $=id=>document.getElementById(id);
const input=$("user-input"),send=$("send-button"),chat=$("chat-container");
const photo=$("photo-button"),photoIn=$("photo-input");
const file=$("file-button"),fileIn=$("file-input");
const camera=$("camera-button"),cameraIn=$("camera-input");
const voice=$("voice-button"),temp=$("temporary-chat-button");
const newChat=$("new-chat-button"),menu=$("menu-button");
const sidebar=$("sidebar"),closeSide=$("close-sidebar");
let messages=[],busy=false,tempChat=false,voiceMode=false,recognition=null;

const LANGUAGES=[
"English","Amharic","Arabic","French","Spanish","Portuguese","German","Italian",
"Dutch","Russian","Ukrainian","Polish","Turkish","Greek","Hebrew","Persian",
"Hindi","Bengali","Urdu","Punjabi","Gujarati","Marathi","Tamil","Telugu",
"Kannada","Malayalam","Nepali","Sinhala","Thai","Vietnamese","Indonesian",
"Malay","Filipino","Swahili","Somali","Hausa","Yoruba","Zulu","Afrikaans",
"Oromo","Tigrinya","Chinese","Japanese","Korean","Romanian","Czech","Hungarian",
"Swedish","Danish","Finnish"
];

let language=localStorage.getItem("globalLanguage")||"English";
let history=JSON.parse(localStorage.getItem("globalChats")||"[]");

function esc(s){
 return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
}
function add(role,text){
 const d=document.createElement("div");
 d.className="message "+role;
 d.innerHTML=role==="assistant"
  ? '<div class="avatar">🤖</div><div class="message-content">'+esc(text).replace(/\n/g,"<br>")+"</div>"
  : '<div class="message-content">'+esc(text).replace(/\n/g,"<br>")+"</div>";
 chat?.appendChild(d);
 chat?.scrollTo(0,chat.scrollHeight);
 return d;
}
function clearChat(){
 messages=[]; if(chat)chat.innerHTML="";
 input.value=""; input.focus();
}
function title(){
 return (messages.find(x=>x.role==="user")?.content||"New Chat")
  .replace(/\s+/g," ").slice(0,42);
}
function save(){
 if(tempChat||!messages.length)return;
 const t=title(), old=history.findIndex(x=>x.title===t);
 const item={title:t,messages};
 if(old>=0)history[old]=item; else history.unshift(item);
 history=history.slice(0,30);
 localStorage.setItem("globalChats",JSON.stringify(history));
 displayHistory();
}
function displayHistory(){
 const box=$("recent-chats"); if(!box)return;
 box.innerHTML="";
 history.forEach((x,i)=>{
  const b=document.createElement("button");
  b.className="recent-chat";
  b.textContent=x.title;
  b.onclick=()=>{
   messages=x.messages||[]; if(chat)chat.innerHTML="";
   messages.forEach(m=>add(m.role,m.content));
   sidebar?.classList.remove("open");
  };
  box.appendChild(b);
 });
}
function setTemp(){
 tempChat=!tempChat;
 if(temp)temp.classList.toggle("active",tempChat);
}
async function sendMessage(text){
 if(!text||busy)return;
 busy=true; input.disabled=true;
 messages.push({role:"user",content:text});
 add("user",text);
 const el=add("assistant","...");
 let answer="";
 try{
  const r=await fetch("/api/chat",{
   method:"POST",headers:{"content-type":"application/json"},
   body:JSON.stringify({messages:[
    {role:"system",content:
     "You are Global AI Mahlet. Help with Math, Physics, Chemistry, Biology, Computer Science, coding, study plans and general questions. Explain clearly and step by step. Reply in "+language+"."},
    ...messages
   ]})
  });
  if(!r.ok)throw Error("AI request failed");
  const reader=r.body.getReader(),dec=new TextDecoder();
  let buf="";
  while(true){
   const {value,done}=await reader.read(); if(done)break;
   buf+=dec.decode(value,{stream:true});
   const lines=buf.split("\n"); buf=lines.pop()||"";
   for(const line of lines){
    if(!line.startsWith("data:"))continue;
    const raw=line.slice(5).trim(); if(!raw||raw==="[DONE]")continue;
    try{
     const j=JSON.parse(raw);
     const part=j.response||j.text||j.content||"";
     if(part)answer+=part;
    }catch{}
   }
   el.querySelector(".message-content").innerHTML=esc(answer).replace(/\n/g,"<br>");
   chat?.scrollTo(0,chat.scrollHeight);
  }
  if(!answer)answer="I couldn't generate a response. Please try again.";
 }catch(e){
  answer="Sorry, I couldn't connect to the AI. Please try again.";
  el.querySelector(".message-content").textContent=answer;
 }
 messages.push({role:"assistant",content:answer});
 save();
 busy=false; input.disabled=false; input.focus();
 if(voiceMode&&answer)speak(answer,listen);
}
send?.addEventListener("click",()=>{const t=input.value.trim();input.value="";sendMessage(t)});
input?.addEventListener("keydown",e=>{
 if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send.click()}
});
newChat?.addEventListener("click",clearChat);
temp?.addEventListener("click",setTemp);
menu?.addEventListener("click",()=>sidebar?.classList.add("open"));
closeSide?.addEventListener("click",()=>sidebar?.classList.remove("open"));

function imageData(f){
 return new Promise((res,rej)=>{
  const r=new FileReader();
  r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(f);
 });
}
async function vision(f,kind){
 if(!f)return;
 add("user",(kind==="camera"?"📸 ":"🖼️ ")+f.name);
 const el=add("assistant","Analyzing image...");
 try{
  const data=await imageData(f);
  const r=await fetch("/api/vision",{
   method:"POST",headers:{"content-type":"application/json"},
   body:JSON.stringify({
    image:data,
    prompt:"Analyze this image carefully. If it contains a school question, read it and solve it step by step. Reply in "+language+"."
   })
  });
  const j=await r.json();
  const answer=j.response||j.text||j.content||j.result||"I couldn't understand this image.";
  el.querySelector(".message-content").innerHTML=esc(answer).replace(/\n/g,"<br>");
  messages.push({role:"user",content:"["+kind+" image: "+f.name+"]"});
  messages.push({role:"assistant",content:answer});
  save();
 }catch(e){
  el.querySelector(".message-content").textContent="I couldn't understand that image. Please try another image.";
 }
}
photo?.addEventListener("click",()=>photoIn?.click());
photoIn?.addEventListener("change",()=>vision(photoIn.files[0],"photo"));
camera?.addEventListener("click",()=>{
 if(cameraIn)cameraIn.setAttribute("capture","environment");
 cameraIn?.click();
});
cameraIn?.addEventListener("change",()=>vision(cameraIn.files[0],"camera"));

file?.addEventListener("click",()=>fileIn?.click());
fileIn?.addEventListener("change",async()=>{
 const f=fileIn.files[0];if(!f)return;
 if(f.type.startsWith("text/")||/\.(txt|csv|json)$/i.test(f.name)){
  const text=await f.text();
  input.value="Please analyze this file:\n\n"+text.slice(0,12000);
  input.focus();
 }else add("user","📎 File selected: "+f.name);
});

function speak(text,done){
 if(!("speechSynthesis"in window)){done?.();return}
 speechSynthesis.cancel();
 const u=new SpeechSynthesisUtterance(text.slice(0,5000));
 u.lang=language==="Amharic"?"am-ET":language==="English"?"en-US":"en-US";
 u.onend=()=>done?.();
 speechSynthesis.speak(u);
}
function listen(){
 if(!voiceMode||busy||!recognition)return;
 try{recognition.start()}catch{}
}
function startVoice(){
 const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
 if(!SR){alert("Voice recognition is not supported by this browser.");return}
 if(!recognition){
  recognition=new SR();
  recognition.continuous=false;recognition.interimResults=false;
  recognition.lang=language==="Amharic"?"am-ET":"en-US";
  recognition.onresult=e=>{
   const t=e.results[0][0].transcript;
   if(t)sendMessage(t);
  };
  recognition.onend=()=>{if(voiceMode&&!busy)setTimeout(listen,400)};
 }
 voiceMode=true;voice?.classList.add("active");
 const greetings=[
  "Hello! I'm ready. What would you like to learn today?",
  "Hi! I'm listening. What can I help you with?",
  "Hello! Ask me anything and let's learn together.",
  "Hi! Tell me what you would like help with."
 ];
 speak(greetings[Math.floor(Math.random()*greetings.length)],listen);
}
function stopVoice(){
 voiceMode=false;voice?.classList.remove("active");
 try{recognition?.stop()}catch{}
 speechSynthesis?.cancel();
}
voice?.addEventListener("click",()=>voiceMode?stopVoice():startVoice());

function addLanguageSelector(){
 let select=document.getElementById("language-select");
 if(!select){
  select=document.createElement("select");select.id="language-select";
  LANGUAGES.forEach(x=>{
   const o=document.createElement("option");o.value=x;o.textContent=x;
   select.appendChild(o);
  });
  select.value=language;
  select.addEventListener("change",()=>{
   language=select.value;localStorage.setItem("globalLanguage",language);
  });
  const target=document.querySelector(".sidebar")||document.body;
  target.prepend(select);
 }
}
addLanguageSelector();
displayHistory();
console.log("Global AI Mahlet loaded.");
