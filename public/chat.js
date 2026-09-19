/* Global AI Mahlet — chat.js */
(()=>{"use strict";
const KEY="global_ai_mahlet_chats_v1",LANG_KEY="global_ai_mahlet_language_v1";
const LANGUAGES=[
["English","en"],["Amharic","am"],["Tigrigna (Tigrinya)","ti"],["Afaan Oromo","om"],["Somali","so"],["Arabic","ar"],["French","fr"],["Spanish","es"],["Portuguese","pt"],["German","de"],["Italian","it"],["Dutch","nl"],["Russian","ru"],["Ukrainian","uk"],["Polish","pl"],["Czech","cs"],["Slovak","sk"],["Romanian","ro"],["Hungarian","hu"],["Greek","el"],["Turkish","tr"],["Hebrew","he"],["Persian","fa"],["Urdu","ur"],["Hindi","hi"],["Bengali","bn"],["Punjabi","pa"],["Gujarati","gu"],["Marathi","mr"],["Tamil","ta"],["Telugu","te"],["Kannada","kn"],["Malayalam","ml"],["Sinhala","si"],["Nepali","ne"],["Chinese","zh"],["Japanese","ja"],["Korean","ko"],["Vietnamese","vi"],["Thai","th"],["Indonesian","id"],["Malay","ms"],["Filipino","tl"],["Burmese","my"],["Khmer","km"],["Lao","lo"],["Mongolian","mn"],["Kazakh","kk"],["Uzbek","uz"],["Azerbaijani","az"],["Armenian","hy"],["Georgian","ka"],["Albanian","sq"],["Serbian","sr"],["Croatian","hr"],["Slovenian","sl"],["Bulgarian","bg"],["Macedonian","mk"],["Bosnian","bs"],["Lithuanian","lt"],["Latvian","lv"],["Estonian","et"],["Finnish","fi"],["Swedish","sv"],["Norwegian","no"],["Danish","da"],["Icelandic","is"],["Irish","ga"],["Welsh","cy"],["Swahili","sw"],["Zulu","zu"],["Xhosa","xh"],["Afrikaans","af"],["Hausa","ha"],["Yoruba","yo"],["Igbo","ig"],["Malagasy","mg"],["Kinyarwanda","rw"],["Shona","sn"],["Sesotho","st"]
];
const state={chats:load(),activeId:null,temporary:false,tempChat:null,voiceMode:false,listening:false,language:localStorage.getItem(LANG_KEY)||"en",selectedFiles:[],recognition:null};
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,8)}
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
function load(){try{const x=JSON.parse(localStorage.getItem(KEY));return Array.isArray(x)?x:[]}catch{return[]}}
function save(){if(!state.temporary)localStorage.setItem(KEY,JSON.stringify(state.chats))}
function active(){return state.chats.find(c=>c.id===state.activeId)||null}
function newChat(saveIt=true){
 const chat={id:uid(),title:"New Chat",created:Date.now(),updated:Date.now(),pinned:false,messages:[]};
 if(state.temporary){state.activeId=chat.id;state.tempChat=chat}
 else{state.chats.unshift(chat);state.activeId=chat.id;if(saveIt)save()}
 render();return chat
}
function chat(){
 if(state.temporary){
  if(!state.tempChat)state.tempChat={id:uid(),title:"Temporary Chat",created:Date.now(),updated:Date.now(),pinned:false,messages:[]};
  return state.tempChat
 }
 return active()||newChat(false)
}
function add(role,text,extra={}){
 const c=chat();
 c.messages.push({id:uid(),role,text:String(text||""),time:Date.now(),...extra});
 c.updated=Date.now();
 if(role==="user"&&c.title==="New Chat"){
  const t=String(text).trim().replace(/\s+/g," ");c.title=t.slice(0,42)||"New Chat"
 }
 save();renderMessages();renderRecents()
}
function renderMessages(){
 const box=$("#messages")||$(".messages")||$("#chatMessages");if(!box)return;
 const c=chat();
 if(!c.messages.length){
  box.innerHTML=`<div class="empty-chat"><div class="empty-icon">✨</div><h2>Hello, Mahlet ✨</h2><p>I'm Global AI Mahlet — your smart assistant.<br>Ask me anything, anytime. I'm here to help you learn, create, solve, and grow! 💙</p></div>`;return
 }
 box.innerHTML=c.messages.map(m=>`
 <div class="message ${m.role==="assistant"?"ai-message":"user-message"}" data-id="${m.id}">
  <div class="message-bubble">${fmt(m.text)}</div>
  ${m.role==="assistant"?`<div class="message-actions"><button type="button" data-speak="${m.id}" title="Speak">🔊</button><button type="button" data-share="${m.id}" title="Share">↗</button></div>`:""}
 </div>`).join("");
 box.scrollTop=box.scrollHeight
}
function fmt(t){return esc(t).replace(/\*\*(.*?)\*\*/g,"<strong>$1</strong>").replace(/`([^`]+)`/g,"<code>$1</code>").replace(/\n/g,"<br>")}
function renderRecents(filter=""){
 const box=$("#recentChats")||$(".recent-chats")||$("#recents");if(!box)return;
 if(state.temporary){box.innerHTML=`<div class="recent-empty">Temporary Chat is not saved.</div>`;return}
 let cs=[...state.chats].sort((a,b)=>Number(b.pinned)-Number(a.pinned)||b.updated-a.updated);
 if(filter){
  const q=filter.toLowerCase();
  cs=cs.filter(c=>c.title.toLowerCase().includes(q)||c.messages.some(m=>m.text.toLowerCase().includes(q)))
 }
 if(!cs.length){box.innerHTML=`<div class="recent-empty">No recent chats yet.</div>`;return}
 box.innerHTML=cs.map(c=>`
 <div class="recent-chat ${c.id===state.activeId?"active":""}" data-chat="${c.id}">
  <button type="button" class="recent-open" data-open="${c.id}"><span>${c.pinned?"📌 ":""}${esc(c.title)}</span></button>
  <button type="button" class="recent-more" data-more="${c.id}">⋮</button>
 </div>`).join("")
}
function render(){renderMessages();renderRecents();languageUI();voiceUI();temporaryUI();filePreview()}
function languageUI(){
 $$("[data-language-label]").forEach(e=>e.textContent=state.language.toUpperCase());
 $$("select[data-language]").forEach(s=>{
  if(!s.options.length)s.innerHTML=LANGUAGES.map(([n,c])=>`<option value="${c}">${n}</option>`).join("");
  s.value=state.language
 })
}
function voiceUI(){
 $$("[data-voice-mode]").forEach(b=>{b.classList.toggle("active",state.voiceMode);b.setAttribute("aria-pressed",String(state.voiceMode))});
 const m=$("#micButton");if(m)m.classList.toggle("active",state.listening);
 $$("[data-mic]").forEach(b=>b.classList.toggle("active",state.listening))
}
function temporaryUI(){
 const x=$("#temporaryChat");if(x)x.checked=state.temporary;
 $$("[data-temporary]").forEach(e=>{if(e.matches("input"))e.checked=state.temporary;e.classList.toggle("active",state.temporary)})
}
function input(){return $("#messageInput")||$("textarea")||$("input[name='message']")}
async function send(){
 const i=input();if(!i)return;
 const text=i.value.trim();if(!text&&!state.selectedFiles.length)return;
 const files=await prepare();
 i.value="";i.style.height="auto";
 add("user",text||"Please analyze the attached file/image.",{files});
 const c=chat();typing(true);
 try{
  const r=await requestAI({message:text,language:state.language,chat:c,files});
  add("assistant",r?.text||r?.response||r?.message||"I received your message.");
  if(state.voiceMode)speak(r?.text||r?.response||r?.message||"I received your message.")
 }catch(e){
  console.error("Global AI Mahlet:",e);
  add("assistant","I couldn't connect to the AI server right now. Please check the Cloudflare AI connection.")
 }finally{typing(false);state.selectedFiles=[];filePreview()}
}
async function requestAI(p){
 const endpoint=document.body.dataset.aiEndpoint||window.GLOBAL_AI_ENDPOINT||"/api/chat";
 const r=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:p.message,language:p.language,messages:p.chat?.messages||[],files:p.files||[]})});
 if(!r.ok)throw Error("AI request failed: "+r.status);
 const type=r.headers.get("content-type")||"";
 return type.includes("application/json")?await r.json():{text:await r.text()}
}
function typing(show){
 const box=$("#messages")||$(".messages")||$("#chatMessages");if(!box)return;
 const old=box.querySelector(".typing");if(old)old.remove();
 if(show){box.insertAdjacentHTML("beforeend",`<div class="message ai-message typing"><div class="message-bubble">Thinking<span>.</span><span>.</span><span>.</span></div></div>`);box.scrollTop=box.scrollHeight}
}
async function prepare(){
 const out=[];
 for(const f of state.selectedFiles){
  const x={name:f.name,type:f.type,size:f.size};
  if(f.type.startsWith("image/"))x.preview=await dataURL(f);
  out.push(x)
 }
 return out
}
function dataURL(f){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(f)})}
function addFiles(files){if(files)state.selectedFiles.push(...[...files]);filePreview()}
function filePreview(){
 const box=$("#filePreview")||$(".file-preview");if(!box)return;
 box.innerHTML=state.selectedFiles.map((f,i)=>`<div class="file-chip"><span>${f.type.startsWith("image/")?"🖼️":"📎"} ${esc(f.name)}</span><button type="button" data-remove-file="${i}">×</button></div>`).join("")
}
function speak(text){
 if(!("speechSynthesis"in window))return;
 speechSynthesis.cancel();
 const u=new SpeechSynthesisUtterance(text);u.lang=state.language;u.rate=1;u.pitch=1;speechSynthesis.speak(u)
}
function recognition(){
 const R=window.SpeechRecognition||window.webkitSpeechRecognition;if(!R)return null;
 const r=new R();r.lang=state.language;r.continuous=state.voiceMode;r.interimResults=false;
 r.onstart=()=>{state.listening=true;voiceUI()};
 r.onend=()=>{state.listening=false;voiceUI();if(state.voiceMode)try{r.start()}catch{}};
 r.onerror=e=>{console.warn("Speech recognition:",e.error);state.listening=false;voiceUI()};
 r.onresult=e=>{
  const text=[...e.results].map(x=>x[0].transcript).join(" "),i=input();
  if(i)i.value=text;if(state.voiceMode)send()
 };
 return r
}
function toggleVoice(){
 state.voiceMode=!state.voiceMode;
 if(state.voiceMode){
  state.recognition=recognition();
  if(state.recognition)try{state.recognition.start()}catch{}
  add("assistant","Voice mode is on 🎙️. You can speak naturally, and I'll respond by voice. You can interrupt me at any time.")
 }else{
  if(state.recognition)try{state.recognition.stop()}catch{}
  if("speechSynthesis"in window)speechSynthesis.cancel();
  state.listening=false;voiceUI()
 }
}
function mic(){
 if(!state.recognition)state.recognition=recognition();
 if(!state.recognition){alert("Voice input is not supported by this browser.");return}
 if(state.listening){try{state.recognition.stop()}catch{}}
 else{state.recognition.lang=state.language;try{state.recognition.start()}catch{}}
}
function setupLanguage(){
 $$("select[data-language]").forEach(s=>s.addEventListener("change",()=>{
  state.language=s.value;localStorage.setItem(LANG_KEY,state.language);
  if(state.recognition)state.recognition.lang=state.language;
  languageUI()
 }))
}
function setupInput(){
 const i=input();if(!i)return;
 i.addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send()}});
 i.addEventListener("input",()=>{i.style.height="auto";i.style.height=Math.min(i.scrollHeight,160)+"px"})
}
function recentMenu(id){
 const c=state.chats.find(x=>x.id===id);if(!c)return;
 const a=prompt("Choose an action:\n\n1 = Rename\n2 = Pin / Unpin\n3 = Delete");
 if(a==="1"){const n=prompt("New chat name:",c.title);if(n?.trim()){c.title=n.trim().slice(0,60);c.updated=Date.now()}}
 if(a==="2"){c.pinned=!c.pinned;c.updated=Date.now()}
 if(a==="3"&&confirm("Delete this chat?")){
  state.chats=state.chats.filter(x=>x.id!==id);
  if(state.activeId===id)state.activeId=state.chats[0]?.id||null
 }
 save();render()
}
function setupActions(){
 document.addEventListener("click",async e=>{
  const t=e.target.closest("button,[data-open],[data-more]");if(!t)return;
  if(t.id==="sendButton"||t.matches("[data-send]")||t.classList.contains("send-button")){e.preventDefault();send();return}
  if(t.id==="micButton"||t.matches("[data-mic]")){e.preventDefault();mic();return}
  if(t.matches("[data-speak]")){const m=chat().messages.find(x=>x.id===t.dataset.speak);if(m)speak(m.text);return}
  if(t.matches("[data-share]")){
   const m=chat().messages.find(x=>x.id===t.dataset.share);if(!m)return;
   if(navigator.share){try{await navigator.share({title:"Global AI Mahlet",text:m.text})}catch{}}
   else if(navigator.clipboard){try{await navigator.clipboard.writeText(m.text);window.showToast?window.showToast("Message copied."):alert("Message copied.")}catch{}}
   return
  }
  if(t.matches("[data-open]")){e.preventDefault();state.activeId=t.dataset.open;render();return}
  if(t.matches("[data-more]")){e.preventDefault();recentMenu(t.dataset.more);return}
  if(t.matches("[data-remove-file]")){e.preventDefault();state.selectedFiles.splice(Number(t.dataset.removeFile),1);filePreview();return}
 });
 document.addEventListener("change",e=>{
  const x=e.target;
  if(x.id==="temporaryChat"||x.matches("[data-temporary]")){
   state.temporary=x.checked;
   if(state.temporary){state.tempChat=null;state.activeId=null}
   else{state.tempChat=null;if(!state.chats.length)newChat();else state.activeId=state.chats[0].id}
   render()
  }
 })
}
function setupSearch(){
 const a=[...$$("[data-search-chats]")];const r=$("#recentSearch");if(r)a.push(r);
 [...new Set(a)].forEach(i=>i.addEventListener("input",()=>renderRecents(i.value)))
}
function setupFiles(){
 $$("[data-file-input]").forEach(i=>i.addEventListener("change",()=>{addFiles(i.files);i.value=""}));
 $$("[data-camera]").forEach(b=>b.addEventListener("click",e=>{e.preventDefault();const i=document.querySelector('input[type="file"][capture="environment"]');if(i)i.click()}));
 $$("[data-attach]").forEach(b=>b.addEventListener("click",e=>{e.preventDefault();const i=document.querySelector('input[type="file"][data-file-input]');if(i)i.click()}));
}
function setupFeatures(){
 const prompts=[
 "I need help studying. Please teach me step by step and explain the concepts clearly.",
 "I need help with coding and technology. Please help me understand and build it step by step.",
 "Help me develop a creative idea and turn it into something useful.",
 "Help me write and improve my text. Make it clearer, stronger, and easier to understand.",
 "I want to learn about the world. Please give me useful and understandable information.",
 "Help me plan my goals step by step and create a practical plan I can follow."
 ];
 $$(".feature").forEach((card,i)=>{
  card.style.cursor="pointer";card.setAttribute("role","button");card.setAttribute("tabindex","0");
  const open=()=>{
   const x=input();if(!x)return;
   x.value=prompts[i]||"";x.focus();x.style.height="auto";x.style.height=Math.min(x.scrollHeight,160)+"px";
   $("#messages")?.scrollIntoView({behavior:"smooth",block:"center"})
  };
  card.addEventListener("click",open);
  card.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();open()}})
 })
}
function start(){
 if(!state.chats.length&&!state.temporary)newChat();
 setupLanguage();setupInput();setupActions();setupSearch();setupFiles();setupFeatures();render()
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start);else start();
window.GlobalAIMahlet={state,sendMessage:send,newChat,speak,toggleVoiceMode:toggleVoice,toggleMic:mic};
})();
