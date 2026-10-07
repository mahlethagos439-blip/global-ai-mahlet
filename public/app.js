const $=s=>document.querySelector(s);
const caps=[
["🧠","Core AI","Conversation, reasoning, writing, translation and planning."],
["🌐","Web","Current information, search and citations when a provider is connected."],
["🔬","Deep Research","Multi-source research and synthesis."],["👁️","Vision","Images, screenshots, charts and documents."],
["🎨","Images","Generation and editing with a connected image model."],["🎙️","Voice","Speech-to-text and text-to-speech with connected services."],
["📁","Files","PDF, DOCX, PPTX, XLSX, CSV, TXT and images."],["📊","Data Analysis","Tables, statistics, calculations and charts."],
["💻","Coding","Generation, debugging, review and development help."],["📝","Canvas","Long-form writing and iterative workspace."],
["🧠","Memory","Preferences and project context."],["📚","Projects","Chats, files, instructions, research and sources."],
["🤖","Agents","Multi-step tasks with tools and approvals."],["🔌","Integrations","Authorized external apps and APIs."],
["⏰","Automation","Scheduled tasks and monitoring."],["🛠️","Custom AIs","Specialized assistants."],
["🏪","Marketplace","Discover and publish specialized assistants."],["👥","Collaboration","Shared projects and teamwork."],
["🏢","Enterprise","Organizations, permissions and administration."],["👨‍💻","Developer API","Build with Global AI Mahlet."],
["🌍","80+ Languages","Global multilingual support including Amharic and Tigrinya."],["📱","Cross-platform","Responsive mobile and desktop foundation."],
["✨","Premium UX","Responsive, accessible interface."],["🔐","Security","Privacy, permissions, secrets and protection."],
["🛡️","Safety","Safety safeguards and uncertainty handling."],["📈","Feedback","Like, dislike, report and evaluation."],
["🏗️","AI Architecture","Orchestration, model routing and tool routing."],["🇪🇹","Global + Ethiopian/African","Global-first with strong Ethiopian/African specialization."]
];
let history=[];
document.querySelector("#app").innerHTML=`<div class="shell"><aside><div class="brand"><span class="logo">✦</span>Global AI Mahlet</div><nav>${["Home","New Chat","Search","Deep Research","Agents","Files","Vision & Images","Voice","Data Analysis","Code","Canvas","Memory & Projects","Integrations","Automation","Custom AIs","Marketplace","Collaboration","Enterprise","API & Developers","Languages","Security","Settings"].map(x=>`<button>${x}</button>`).join("")}</nav></aside><main class="main"><div class="top"><div class="search">⌕ <input placeholder="Search anything..."></div><button class="pill" id="language">🌍 English</button><button class="pill">☾</button></div><section class="hero"><h1>Global AI Mahlet</h1><p><b>Your AI Partner for a Smarter Future.</b><br>Built for the world, with exceptional Ethiopian & African intelligence. Learn, create, research, code and work across languages and tools.</p><div class="status" id="status">● Ready</div></section><div class="grid">${caps.slice(0,8).map(c=>`<button class="card" data-c="${c[1]}"><div style="font-size:25px">${c[0]}</div><b>${c[1]}</b><br><span>${c[2]}</span></button>`).join("")}</div><section class="chat"><div id="messages" class="messages"><div class="msg ai">Hello! I'm Global AI Mahlet. Ask me anything. I’m global-first, with strong Ethiopian and African context.</div></div><div class="actions"><button id="file">＋ Attach</button><button id="web">🌐 Search</button><button id="voice">🎙 Voice</button><button id="image">🖼 Image</button><button id="all">☷ All capabilities</button></div><div class="composer"><textarea id="input" placeholder="Ask me anything..."></textarea><button class="send" id="send">Send</button></div></section><section class="capabilities" id="capabilities"><h2>All planned capabilities</h2><div class="features">${caps.map((c,i)=>`<div class="feature"><b>${i+1}. ${c[0]} ${c[1]}</b><div class="muted">${c[2]}</div></div>`).join("")}<div class="feature"><b>27. 💰 Business model / pricing</b><div class="muted">Excluded by your product decision.</div></div></div></section></main></div>`;
function add(role,text){const d=document.createElement("div");d.className="msg "+(role==="user"?"user":"ai");d.textContent=text;$("#messages").appendChild(d);$("#messages").scrollTop=$("#messages").scrollHeight}
async function send(){let t=$("#input").value.trim();if(!t)return;add("user",t);history.push({role:"user",content:t});$("#input").value="";$("#status").textContent="● Processing…";try{let r=await fetch("/api/chat",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({messages:history})}),d=await r.json();if(!r.ok)throw Error(d.error||"Request failed");add("assistant",d.text);history.push({role:"assistant",content:d.text});$("#status").textContent="● Ready"}catch(e){add("assistant","I can't complete that request yet: "+e.message);$("#status").textContent="● Configuration needed"}}
$("#send").onclick=send;$("#input").onkeydown=e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send()}};
$("#all").onclick=()=>$("#capabilities").style.display=$("#capabilities").style.display==="none"?"block":"none";
$("#web").onclick=()=>$("#status").textContent="● Web mode selected — a real search provider must be connected for live results.";
$("#voice").onclick=()=>$("#status").textContent="● Voice selected — speech services must be connected.";
$("#image").onclick=()=>$("#status").textContent="● Image mode selected — an image model must be connected.";
$("#file").onclick=()=>$("#status").textContent="● File mode selected — production parsing/storage must be connected.";
$("#language").onclick=()=>$("#status").textContent="● Global multilingual mode — 80+ language architecture; actual model coverage varies.";
document.querySelectorAll("[data-c]").forEach(x=>x.onclick=()=>{$("#input").value="Help me with "+x.dataset.c;$("#input").focus()});