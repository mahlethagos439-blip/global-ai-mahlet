/* Global AI Mahlet — frontend replacement
   Preserves the existing /api/chat and /api/search Worker endpoints. */
(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const KEY = 'gam_chats_v5', COLORKEY = 'gam_accent_v1';
  let chats = [], active = null, temp = false, temporaryMessages = [];
  let pendingFiles = [], pendingImageFile = null, pendingPreviewUrls = [], thinkHarder = false;
  let listening = false, recognition = null, sending = false, voiceMode = false, voiceSpeaking = false, voiceRestartTimer = null;
  const feedback = {};
  try { chats = JSON.parse(localStorage.getItem(KEY) || '[]'); if (!Array.isArray(chats)) chats = []; } catch { chats = []; }
  chats = chats.map(c => { const oldTitle=String(c.title||'New Chat'); const brokenTitle=/(?:```|\b(?:import|export|function|const|let|var|def|return)\s+[\w*$]+|infer_conversation_title|[{};]{2,})/i.test(oldTitle); return { ...c, title: brokenTitle ? 'New Chat' : oldTitle, titleAuto: brokenTitle ? true : Boolean(c.titleAuto), m: Array.isArray(c.m) ? c.m : [], t: Number(c.t) || Date.now(), pinned: Boolean(c.pinned) }; });

  const capabilities = ['My Projects','Deep Research','Web Search','Images','Voice','Files','Data Analysis','Coding','Canvas/Workspace','AI Agents','Apps & Integrations','Tasks & Automations','Custom AI Assistants','Collaboration','Developer/API','Languages','Appearance','Accent Color','Privacy & Security','Safety','Feedback','Help'];
  const langs = ['System Default','English','Amharic','Tigrinya','Afaan Oromo','Somali','Afar','Arabic','French','Spanish','Portuguese','German','Italian','Dutch','Swahili','Chinese (Simplified)','Chinese (Traditional)','Japanese','Korean','Hindi','Urdu','Russian','Turkish','Hebrew','Persian','Bengali','Thai','Vietnamese','Indonesian','Filipino','Yoruba','Hausa','Zulu','Afrikaans','Esperanto','Latin','Catalan','Armenian','Georgian'];
  const colors = [['Ocean Blue','#49a7ff'],['Royal Purple','#9b6cff'],['Rose Pink','#f472b6'],['Cyan','#22d3ee'],['Emerald','#34d399'],['Yellow','#facc15'],['Orange','#fb923c'],['Red','#f87171'],['Violet','#8b5cf6'],['Indigo','#6366f1'],['Teal','#2dd4bf'],['Gold','#eab308'],['Sky','#38bdf8'],['Lavender','#c4b5fd'],['Turquoise','#06b6d4']];

  function save() { try { localStorage.setItem(KEY, JSON.stringify(chats)); } catch { toast('This browser cannot save more chat history.'); } fetch('/api/chats/sync',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chats})}).catch(()=>{}); }
  function toast(text) { const el = $('#toast'); if (!el) return; el.textContent = text; el.classList.remove('hidden'); clearTimeout(window.gamToastTimer); window.gamToastTimer = setTimeout(() => el.classList.add('hidden'), 2600); }
  function esc(value) { return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
  function closeMenus() { ['lp','rp'].forEach(id => { const p = $('#'+id); if (p) { p.classList.remove('open'); p.setAttribute('aria-hidden','true'); } }); const shade = $('#shade'); if (shade) { shade.classList.add('hidden'); shade.setAttribute('aria-hidden','true'); } $$('.chat-menu').forEach(m => m.classList.add('hidden')); }
  function openMenu(side) { const panel = $('#'+(side === 'left' ? 'lp' : 'rp')), shade = $('#shade'); if (!panel || !shade) return; if (panel.classList.contains('open')) return closeMenus(); closeMenus(); panel.classList.add('open'); panel.setAttribute('aria-hidden','false'); shade.classList.remove('hidden'); shade.setAttribute('aria-hidden','false'); if (side === 'left') renderRecent(); else renderCaps(); }
  $('#left')?.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); openMenu('left'); });
  $('#right')?.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); openMenu('right'); });
  $('#lx')?.addEventListener('click', closeMenus); $('#rx')?.addEventListener('click', closeMenus); $('#shade')?.addEventListener('click', closeMenus);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeMenus(); $('#modal')?.classList.add('hidden'); $('#plusMenu')?.classList.add('hidden'); } });

  function getCurrentMessages() { if (temp) return temporaryMessages; return chats.find(c => c.id === active)?.m || []; }
  function currentChat() { return chats.find(c => c.id === active); }
  function genericGreeting(text) { return /^(hi+|hey+|hello+|hii+|good morning|good afternoon|good evening|how are you\??|what's up\??|yo+|እንደምን አለህ|ሰላም)[!.?\s]*$/i.test(String(text).trim()); }
  function isVagueStarter(text) { const s=String(text||'').trim(); return !s || genericGreeting(s) || /^(i have (one )?(a )?problem( today)?|i need help|can you help me|help me|i want to ask (you )?(a )?question|i have a question|something happened|are you there)[.!?\s]*$/i.test(s) || s.length < 12; }
  async function maybeGenerateTitle() {
    if (temp) return;
    const c = currentChat();
    // Auto-title exactly once from the opening user message. Later topics stay in this chat.
    if (!c || c.title !== 'New Chat') return;
    const firstUserMessage = c.m.find(m => m.r === 'u');
    if (!firstUserMessage) return;
    const source = String(firstUserMessage.c || '').trim().slice(0, 1000);
    try {
      const res = await fetch('/api/title', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({message:source, language:localStorage.getItem('gam_language')||'System Default'})});
      const data = await res.json();
      const title = String(data.title || '').trim();
      if (!res.ok || !title || /^new chat$/i.test(title)) return;
      const latest = currentChat();
      if (latest && latest.id === c.id && latest.title === 'New Chat') {
        latest.title = title.slice(0, 70); latest.titleAuto = true; save(); renderRecent($('#recentSearch')?.value || '');
        if ($('#title')) $('#title').textContent = latest.title;
      }
    } catch {}
  }
  function clearPendingPreviewUrls() { pendingPreviewUrls.forEach(url => { try { URL.revokeObjectURL(url); } catch {} }); pendingPreviewUrls = []; }
  function newChat() { active = null; temp = false; temporaryMessages = []; pendingFiles = []; pendingImageFile = null; clearPendingPreviewUrls(); $('#chat')?.classList.add('hidden'); $('#home')?.classList.remove('chatting'); if ($('#prompt')) $('#prompt').value = ''; $('#attachmentPreview')?.classList.add('hidden'); if ($('#attachmentPreview')) $('#attachmentPreview').innerHTML = ''; if ($('#messages')) $('#messages').innerHTML = ''; updateTemp(); closeMenus(); }
  function ensureChat() { let c = currentChat(); if (temp) return null; if (!c) { c = { id: String(Date.now()) + Math.random().toString(16).slice(2,7), title: 'New Chat', pinned:false, t:Date.now(), m:[] }; chats.unshift(c); active = c.id; } return c; }
  function addMessage(role, content, extra = {}) { const m = { r:role, c:String(content ?? ''), ...extra }; if (temp) { temporaryMessages.push(m); renderMessages(temporaryMessages); return; } const c = ensureChat(); if (!c) return; c.m.push(m); c.t = Date.now(); save(); renderMessages(c.m); renderRecent(); if ($('#title')) $('#title').textContent = c.title; }
  function safeUrl(url) { try { const u = new URL(url, location.href); return ['http:','https:','mailto:'].includes(u.protocol) ? u.href : ''; } catch { return ''; } }
  function inlineMarkdown(text) {
    let s = esc(text);
    s = s.replace(/`([^`\n]+)`/g, '<code>$1</code>');
    s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/__([^_\n]+)__/g, '<strong>$1</strong>');
    s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
    s = s.replace(/(^|[^_])_([^_\n]+)_/g, '$1<em>$2</em>');
    s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (all, label, url) => { const href = safeUrl(url); return href ? `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${label}</a>` : label; });
    return s;
  }
  function markdown(text) {
    const blocks = String(text ?? '').replace(/\r\n?/g,'\n').split(/```/);
    return blocks.map((block, i) => {
      if (i % 2 === 1) { const nl = block.indexOf('\n'); const lang = nl >= 0 ? block.slice(0,nl).trim() : ''; const code = nl >= 0 ? block.slice(nl+1) : block; return `<pre><code${lang ? ` class="language-${esc(lang)}"` : ''}>${esc(code.replace(/\n$/,''))}</code></pre>`; }
      const lines = block.split('\n'); let out = [], list = null;
      const closeList = () => { if (list) { out.push(`</${list}>`); list = null; } };
      for (const line of lines) {
        const h = line.match(/^(#{1,6})\s+(.+)$/);
        const ul = line.match(/^\s*[-*+]\s+(.+)$/);
        const ol = line.match(/^\s*\d+[.)]\s+(.+)$/);
        if (h) { closeList(); const n=h[1].length; out.push(`<h${n}>${inlineMarkdown(h[2])}</h${n}>`); }
        else if (ul || ol) { const kind = ul ? 'ul' : 'ol'; if (list !== kind) { closeList(); list=kind; out.push(`<${kind}>`); } out.push(`<li>${inlineMarkdown((ul||ol)[1])}</li>`); }
        else if (/^\s*[-*_]{3,}\s*$/.test(line)) { closeList(); out.push('<hr>'); }
        else if (!line.trim()) { closeList(); }
        else { closeList(); out.push(`<p>${inlineMarkdown(line)}</p>`); }
      }
      closeList(); return out.join('');
    }).join('');
  }
  function renderMessages(messages) {
    const box = $('#messages'); if (!box) return;
    box.innerHTML = messages.map((m,i) => m.r === 'u'
      ? `<div class="message user"><div class="bubble">${m.imageData ? `<div class="user-image-preview"><img src="${esc(m.imageData)}" alt="Photo you attached" loading="lazy"></div>` : ''}${m.c ? `<div class="user-message-text">${esc(m.c).replace(/\n/g,'<br>')}</div>` : ''}${m.fileNames?.filter(n=>!m.imageData || !/\.(?:png|jpe?g|gif|webp|bmp|heic)$/i.test(n)).length ? `<div class="file-tags">📎 ${esc(m.fileNames.filter(n=>!m.imageData || !/\.(?:png|jpe?g|gif|webp|bmp|heic)$/i.test(n)).join(', '))}</div>` : ''}</div></div>`
      : `<div class="message assistant" data-message-index="${i}"><div class="who">Assistant</div><div class="answer">${markdown(m.c)}</div><div class="actions"><button data-act="copy" data-i="${i}" aria-label="Copy" title="Copy"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></svg><span>Copy</span></button><button data-act="like" data-i="${i}" aria-label="Like" title="Like"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10v11H3V10h4Zm0 10h10a2 2 0 0 0 2-1.6l2-8A2 2 0 0 0 19 8h-6l1-4a2 2 0 0 0-2-2l-5 8"/></svg><span>Like</span></button><button data-act="dislike" data-i="${i}" aria-label="Dislike" title="Dislike"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 14V3H3v11h4Zm0-10h10a2 2 0 0 1 2 1.6l2 8A2 2 0 0 1 19 16h-6l1 4a2 2 0 0 1-2 2l-5-8"/></svg><span>Dislike</span></button><button data-act="speak" data-i="${i}" aria-label="Speaker" title="Speaker"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15 9a5 5 0 0 1 0 6M18 5a10 10 0 0 1 0 14"/></svg><span>Speaker</span></button><button data-act="share" data-i="${i}" aria-label="Share" title="Share"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.7 10.7 6.6-4.4M8.7 13.3l6.6 4.4"/></svg><span>Share</span></button><button data-act="more" data-i="${i}" aria-label="More options" title="More options"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg></button></div></div>`).join('');
    // Render each answer's visual and source cards inside that answer so they survive rerenders.
    messages.forEach((m, i) => {
      if (m.r !== 'a') return;
      const target = box.querySelector(`[data-message-index="${i}"]`);
      if (!target) return;
      if (Array.isArray(m.visuals) && m.visuals.length) {
        const wrap = document.createElement('div'); wrap.className = 'visual-results';
        wrap.innerHTML = m.visuals.slice(0, 6).map(item => { const src=safeUrl(item.imageUrl||item.image||item.thumbnail||''); const href=safeUrl(item.pageUrl||item.url||''); if(!src)return ''; return `<a href="${esc(href||src)}" target="_blank" rel="noopener noreferrer"><img src="${esc(src)}" alt="${esc(item.title||'Relevant image')}" loading="lazy"><span>${esc(item.title||'Open image source')}</span></a>`; }).join('');
        if(wrap.querySelector('a')) target.append(wrap);
      }
      if (Array.isArray(m.sources) && m.sources.length) {
        const wrap = document.createElement('div'); wrap.className='source-results';
        wrap.innerHTML='<strong class="sources-heading"><span class="source-stack" aria-hidden="true">◎</span> Sources</strong>'+m.sources.slice(0,8).map(item=>{const href=safeUrl(item.url||item.link||'');if(!href)return '';let host='';try{host=new URL(href).hostname.replace(/^www\./,'')}catch{}const icon=host?`https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`:'';return `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${icon?`<img class="source-icon" src="${esc(icon)}" alt="" loading="lazy">`:''}<span>${esc(item.title||item.name||host||href)}</span></a>`;}).join('');
        if(wrap.querySelector('a')) target.append(wrap);
      }
    });
    box.querySelectorAll('[data-act]').forEach(b => b.onclick = () => action(b.dataset.act, Number(b.dataset.i), messages, b));
    box.querySelectorAll('a').forEach(a => { a.rel = 'noopener noreferrer'; });
    box.scrollTop = box.scrollHeight;
  }
  async function copyText(text) { if (navigator.clipboard?.writeText) { try { await navigator.clipboard.writeText(text); toast('Copied.'); return; } catch {} } const ta = document.createElement('textarea'); ta.value = text; ta.style.position='fixed'; ta.style.opacity='0'; document.body.appendChild(ta); ta.select(); try { const ok=document.execCommand('copy'); toast(ok ? 'Copied.' : 'Copy is blocked by this browser.'); } catch { toast('Copy is blocked by this browser.'); } ta.remove(); }
  function action(kind, index, messages, button) { const m = messages[index]; if (!m) return; if (kind === 'more') { showModal('Response options', `<button class=\"modal-action\" id=\"moreCopy\">Copy response</button><button class=\"modal-action\" id=\"moreShare\">Share response</button>`); $('#moreCopy')?.addEventListener('click',()=>{copyText(m.c);$('#modal')?.classList.add('hidden');}); $('#moreShare')?.addEventListener('click',()=>{if(navigator.share)navigator.share({title:'Global AI Mahlet',text:m.c}).catch(()=>{});else copyText(m.c);$('#modal')?.classList.add('hidden');}); return; } if (kind === 'copy') return copyText(m.c); if (kind === 'speak') return speak(m.c); if (kind === 'share') { if (navigator.share) navigator.share({title:'Global AI Mahlet', text:m.c}).then(()=>toast('Shared.')).catch(()=>{}); else copyText(m.c); return; } if (kind === 'like' || kind === 'dislike') { const key = `${active || 'temporary'}:${index}`; feedback[key] = kind; const parent = button.closest('.actions'); parent?.querySelectorAll('[data-act="like"],[data-act="dislike"]').forEach(b=>b.classList.toggle('active',b.dataset.act===kind)); toast('Thanks for your feedback.'); } }
  function renderRecent(query = '') {
    const box = $('#recent'); if (!box) return;
    const q = String(query || '').toLowerCase();
    const list = chats.filter(c => String(c.title || 'New Chat').toLowerCase().includes(q)).sort((a,b)=>Number(b.pinned)-Number(a.pinned)||(b.t-a.t));
    box.innerHTML = list.length ? list.map(c=>`<div class="recent-row" data-chat-row="${esc(c.id)}"><button class="recent-chat" data-open-chat="${esc(c.id)}"><span class="recent-chat-title">${esc(c.title || 'New Chat')}</span>${c.pinned?'<span class="pin-mark">⚑</span>':''}</button><button class="chat-menu-toggle" data-toggle-chat-menu="${esc(c.id)}" aria-label="Chat options">⋯</button><div class="chat-menu hidden" data-chat-menu="${esc(c.id)}"><button data-chat-action="rename" data-chat-id="${esc(c.id)}">✎ Rename</button><button data-chat-action="pin" data-chat-id="${esc(c.id)}">${c.pinned?'⚑ Unpin':'⚑ Pin'}</button><button data-chat-action="delete" data-chat-id="${esc(c.id)}">Delete</button></div></div>`).join('') : '<small style="padding:10px;color:#91a5c0">No recent chats</small>';
    box.querySelectorAll('[data-open-chat]').forEach(b=>b.onclick=()=>loadChat(b.dataset.openChat));
    box.querySelectorAll('[data-toggle-chat-menu]').forEach(b=>b.onclick=e=>{e.stopPropagation();const id=b.dataset.toggleChatMenu;const menu=box.querySelector(`[data-chat-menu="${CSS.escape(id)}"]`);box.querySelectorAll('.chat-menu').forEach(m=>{if(m!==menu)m.classList.add('hidden')});menu?.classList.toggle('hidden');});
    box.querySelectorAll('[data-chat-action]').forEach(b=>b.onclick=e=>{e.stopPropagation();handleChatAction(b.dataset.chatId,b.dataset.chatAction);});
  }
  function handleChatAction(id, actionName) { const c=chats.find(x=>x.id===id); if(!c)return;
    if(actionName==='rename'){const n=prompt('Rename this chat:',c.title||'New Chat');if(n?.trim()){c.title=n.trim().slice(0,100);c.titleAuto=false;save();renderRecent($('#recentSearch')?.value||'');if(active===id&&$('#title'))$('#title').textContent=c.title;toast('Chat renamed.');}}
    else if(actionName==='pin'){c.pinned=!c.pinned;save();renderRecent($('#recentSearch')?.value||'');toast(c.pinned?'Chat pinned.':'Chat unpinned.');}
    else if(actionName==='delete'){showModal('Delete this conversation?',`<div class="delete-confirm"><p>Are you sure you want to delete this chat?</p><p class="delete-chat-title">${esc(c.title||'New Chat')}</p><p class="delete-warning">This conversation will be permanently removed from your recent chats. This action cannot be undone.</p><div class="delete-actions"><button class="modal-action" id="keepChat">No, keep chat</button><button class="modal-action danger-button" id="confirmDeleteChat">Yes, delete chat</button></div></div>`);$('#keepChat')?.addEventListener('click',()=>$('#modal')?.classList.add('hidden'));$('#confirmDeleteChat')?.addEventListener('click',()=>{chats=chats.filter(x=>x.id!==id);save();if(active===id)newChat();renderRecent($('#recentSearch')?.value||'');$('#modal')?.classList.add('hidden');toast('Chat deleted.');});}
  }
  function loadChat(id){const c=chats.find(x=>x.id===id);if(!c)return;active=id;temp=false;temporaryMessages=[];$('#chat')?.classList.remove('hidden');$('#home')?.classList.add('chatting');if($('#title'))$('#title').textContent=c.title||'New Chat';renderMessages(c.m);updateTemp();closeMenus();}
  function updateTemp(){ $('#toggle')?.classList.toggle('on',temp); $('#temp')?.classList.toggle('hidden',!temp); }
  $('#new')?.addEventListener('click',newChat); $('#clearView')?.addEventListener('click',newChat);
  $('#temporary')?.addEventListener('click',()=>{temp=!temp;active=null;temporaryMessages=[];$('#chat')?.classList.toggle('hidden',!temp);if(temp){$('#home')?.classList.add('chatting');if($('#title'))$('#title').textContent='Temporary Chat';}else $('#home')?.classList.remove('chatting');updateTemp();closeMenus();toast(temp?'Temporary Chat is on':'Temporary Chat is off');});
  $('#off')?.addEventListener('click',()=>$('#temporary')?.click());
  $('#srch')?.addEventListener('click',()=>{const s=$('#recentSearch');s?.classList.toggle('hidden');if(s&&!s.classList.contains('hidden'))s.focus();});
  $('#recentSearch')?.addEventListener('input',e=>renderRecent(e.target.value));

  function showModal(title, html){if(!$('#modal'))return;$('#modalTitle').textContent=title;$('#modalBody').innerHTML=html;$('#modal').classList.remove('hidden');}
  $('#modalClose')?.addEventListener('click',()=>$('#modal')?.classList.add('hidden'));
  function settingsModal(){showModal('Settings',`<div class="setting-row"><label>Account</label><p id="accountStatus">Check sign-in status to access synced chats and feedback.</p><button class="modal-action" id="googleSignIn">Continue with Google</button><button class="modal-action" id="ownerFeedback">Private owner feedback dashboard</button><button class="modal-action danger-button" id="deleteAccount">Delete account</button></div><div class="setting-row"><label>Profile</label><label for="profileAge">Age</label><input id="profileAge" type="number" min="1" max="120" placeholder="Age (optional)" style="width:100%;padding:10px;border-radius:8px"><label for="profileEmail">Email</label><input id="profileEmail" type="email" placeholder="Available after sign-in" disabled style="width:100%;padding:10px;border-radius:8px"><label for="profileCountry">Country</label><input id="profileCountry" type="text" maxlength="100" placeholder="Your country (for feedback)" style="width:100%;padding:10px;border-radius:8px"><label><input id="notifications" type="checkbox"> Notifications (saved on this device)</label></div><div class="setting-row"><label>Preferred response language</label><select id="language">${langs.map(x=>`<option>${esc(x)}</option>`).join('')}</select><p class="muted">The AI service's language support may vary.</p></div><div class="setting-row"><label>Appearance</label><select id="appearance"><option value="dark">Dark</option><option value="system">System Default</option><option value="light">Light</option></select></div><div class="setting-row"><label>Accent Color</label><div class="swatches">${colors.map(([n,c])=>`<button class="swatch" data-color="${c}" title="${n}"><i style="background:${c}"></i>${n}</button>`).join('')}</div></div><div class="setting-row"><label>Privacy & Security</label><p>Chats are saved on this device. Sign in to sync them to your account.</p><button class="modal-action" id="clearHistory">Clear local chat history</button></div><div class="setting-row"><label>Help & Feedback</label><button class="modal-action" id="feedbackBtn">Send feedback</button></div>`);
    $('#language').value=localStorage.getItem('gam_language')||'System Default';$('#language').onchange=e=>{localStorage.setItem('gam_language',e.target.value);toast('Preferred language saved.');};
    $('#profileAge').value=localStorage.getItem('gam_age')||'';$('#profileAge').onchange=e=>localStorage.setItem('gam_age',e.target.value);$('#profileCountry').value=localStorage.getItem('gam_country')||'';$('#profileCountry').onchange=e=>localStorage.setItem('gam_country',e.target.value);$('#notifications').checked=localStorage.getItem('gam_notifications')==='on';$('#notifications').onchange=e=>localStorage.setItem('gam_notifications',e.target.checked?'on':'off');
    const savedAppearance=localStorage.getItem('gam_appearance')||'dark';$('#appearance').value=savedAppearance;applyAppearance(savedAppearance);$('#appearance').onchange=e=>{localStorage.setItem('gam_appearance',e.target.value);applyAppearance(e.target.value);toast('Appearance updated.');};
    $$('[data-color]').forEach(b=>b.onclick=()=>setColor(b.dataset.color));
    fetch('/api/auth/session').then(r=>r.json()).then(d=>{if(d.authenticated&&d.user){$('#accountStatus').textContent='Signed in as '+d.user.name;$('#profileEmail').value=d.user.email;}}).catch(()=>{});
    $('#googleSignIn').onclick=()=>location.href='/api/auth/google';
    $('#ownerFeedback').onclick=async()=>{try{const r=await fetch('/api/owner/feedback');const d=await r.json();if(!r.ok)throw new Error(d.error||'Could not open dashboard');const rows=d.feedback||[];showModal('Private Feedback Dashboard',rows.length?rows.map(x=>`<article class="setting-row"><b>${esc(x.user_name)} · ${esc(x.country)}</b><p>${esc(x.user_email)} · ${new Date(x.created_at*1000).toLocaleString()}</p><p style="white-space:pre-wrap">${esc(x.message)}</p></article>`).join(''):'<p>No feedback submissions yet.</p>');}catch(e){toast(e.message||'Sign in as the configured owner first.');}};
    $('#deleteAccount').onclick=async()=>{if(!confirm('Permanently delete your account and its server-saved chats and feedback?'))return;try{const r=await fetch('/api/auth/delete',{method:'POST'});const d=await r.json();if(!r.ok)throw new Error(d.error||'Delete failed');localStorage.removeItem(KEY);chats=[];newChat();renderRecent();$('#modal').classList.add('hidden');toast('Account deleted.');}catch(e){toast(e.message||'Please sign in first.');}};
    $('#clearHistory').onclick=()=>{if(confirm('Clear all saved chats from this browser?')){chats=[];save();newChat();renderRecent();toast('Chat history cleared.');}};
    $('#feedbackBtn').onclick=()=>{showModal('Send Feedback',`<p>Your name and email come from your signed-in Google account.</p><label for="feedbackCountry">Country</label><input id="feedbackCountry" value="${esc(localStorage.getItem('gam_country')||'')}" maxlength="100" placeholder="Your country" style="width:100%;padding:10px;border-radius:8px"><label for="feedbackText">Feedback message</label><textarea id="feedbackText" rows="4" maxlength="5000" style="width:100%;background:var(--field,#10243c);border:1px solid #294763;border-radius:9px;padding:10px;color:inherit"></textarea><button class="modal-action" id="sendFeedback">Submit feedback privately</button>`);$('#sendFeedback').onclick=async()=>{const country=$('#feedbackCountry').value.trim(),message=$('#feedbackText').value.trim();localStorage.setItem('gam_country',country);try{const r=await fetch('/api/feedback',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({country,message})});const d=await r.json();if(!r.ok)throw new Error(d.error||'Feedback could not be saved');$('#modal').classList.add('hidden');toast('Feedback saved privately. Thank you.');}catch(e){toast(e.message||'Could not save feedback. Sign in and try again.');}};};
  }
  function applyAppearance(mode){document.body.classList.toggle('light',mode==='light'||(mode==='system'&&window.matchMedia?.('(prefers-color-scheme: light)').matches));}
  function setColor(c,notify=true){document.documentElement.style.setProperty('--accent',c);document.documentElement.style.setProperty('--bubble',`color-mix(in srgb, ${c} 23%, #10223b)`);try{localStorage.setItem(COLORKEY,c);}catch{}if(notify)toast('Accent color applied.');}
  try{setColor(localStorage.getItem(COLORKEY)||'#49a7ff',false);}catch{}applyAppearance(localStorage.getItem('gam_appearance')||'dark');
  fetch('/api/chats/sync').then(r=>r.ok?r.json():null).then(d=>{if(d&&Array.isArray(d.chats)&&d.chats.length){if(!chats.length){chats=d.chats;try{localStorage.setItem(KEY,JSON.stringify(chats));}catch{}renderRecent();}else{fetch('/api/chats/sync',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chats})}).catch(()=>{});}}}).catch(()=>{});
  $('#settings')?.addEventListener('click',()=>{closeMenus();settingsModal();});$('#profile')?.addEventListener('click',()=>{closeMenus();settingsModal();});

  function renderCaps(q=''){const box=$('#capList');if(!box)return;const filtered=capabilities.filter(x=>x.toLowerCase().includes(String(q).toLowerCase()));box.innerHTML=filtered.map(x=>`<button class="cap-item" data-cap="${esc(x)}">${esc(x)} <span>›</span></button>`).join('');box.querySelectorAll('[data-cap]').forEach(b=>b.onclick=()=>capability(b.dataset.cap));}
  $('#capSearch')?.addEventListener('input',e=>renderCaps(e.target.value));
  function capability(x){closeMenus();if(['Accent Color','Appearance','Languages','Privacy & Security','Feedback','Help'].includes(x)){settingsModal();return;}if(x==='Voice'){startVoice();return;}if(x==='Files'){chooseFiles();return;}const prompts={'Web Search':'Search the web for ','Deep Research':'Do deep research on ','Data Analysis':'Analyze this data: ','Coding':'Help me code ','Canvas/Workspace':'Create a workspace for ','AI Agents':'Help me plan an AI agent for ','My Projects':'Show my projects','Tasks & Automations':'Help me design an automation for ','Custom AI Assistants':'Help me design a custom AI assistant for ','Apps & Integrations':'Help me plan an app integration for ','AI Marketplace':'Explain how to design an AI marketplace','Collaboration':'Help me plan a collaboration workflow','Developer/API':'Help me design an API for ','Safety':'Explain the safety considerations for ','Images':'Find real photos of '};if($('#prompt')){$('#prompt').value=prompts[x]||`Help me with ${x}: `;$('#prompt').focus();}}
  $('#plus')?.addEventListener('click',e=>{e.stopPropagation();$('#plusMenu')?.classList.toggle('hidden');});
  document.addEventListener('click',e=>{if(!e.target.closest('#plusMenu')&&!e.target.closest('#plus'))$('#plusMenu')?.classList.add('hidden');});
  $('#plusMenu')?.addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(!b)return;$('#plusMenu').classList.add('hidden');if(b.dataset.action==='photo')$('#photoInput')?.click();if(b.dataset.action==='camera')$('#cameraInput')?.click();if(b.dataset.action==='file')$('#fileInput')?.click();if(b.dataset.action==='think'){thinkHarder=!thinkHarder;toast(thinkHarder?'Think harder is on for the next message.':'Think harder is off.');}});
  $('#attach')?.addEventListener('click',()=>$('#fileInput')?.click());function chooseFiles(){$('#fileInput')?.click();}
  function renderAttachmentPreview() {
    const box = $('#attachmentPreview'); if (!box) return;
    if (!pendingFiles.length) { box.classList.add('hidden'); box.innerHTML = ''; return; }
    box.classList.remove('hidden');
    const cards = pendingFiles.map(file => {
      if (file.type?.startsWith('image/')) {
        let url = pendingPreviewUrls[pendingFiles.indexOf(file)];
        if (!url) { url = URL.createObjectURL(file); pendingPreviewUrls[pendingFiles.indexOf(file)] = url; }
        return `<div class="attachment-item image-attachment"><img class="composer-image-preview" src="${esc(url)}" alt="Photo ready to send"><span>${esc(file.name)}</span></div>`;
      }
      return `<div class="attachment-item"><span class="attachment-file-icon">📎</span><span>${esc(file.name)} <small>${Math.max(1,Math.round(file.size/1024))} KB</small></span></div>`;
    }).join('');
    box.innerHTML = `<div class="attachment-items">${cards}</div><button id="clearFiles" type="button">Remove</button>`;
    $('#clearFiles').onclick = () => { pendingFiles=[]; pendingImageFile=null; clearPendingPreviewUrls(); renderAttachmentPreview(); };
  }
  function fileChanged(e) { const files=[...(e.target.files||[])]; if(!files.length)return; for(const file of files){pendingFiles.push(file);if(file.type?.startsWith('image/')){pendingImageFile=file;pendingPreviewUrls.push(URL.createObjectURL(file));}else pendingPreviewUrls.push('');} renderAttachmentPreview(); toast('Photo preview ready. Add your message and tap Send.'); e.target.value=''; }
  async function readTextAttachment(file){const name=String(file.name||'').toLowerCase();const supported=/\.(txt|md|csv|json|html|htm|css|js|ts|xml|yaml|yml|log)$/i.test(name)||/^text\//i.test(file.type||'')||/json/i.test(file.type||'');if(!supported)return '';if(file.size>120000)return `\n\n[${file.name}: text file is too large to include in full; please attach a smaller version.]`;try{return `\n\n--- BEGIN ATTACHED FILE: ${file.name} ---\n${(await file.text()).slice(0,80000)}\n--- END ATTACHED FILE ---\n`;}catch{return `\n\n[Could not read ${file.name} in this browser.]`;}}
  async function imageToDataUrl(file){const original=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result||''));reader.onerror=reject;reader.readAsDataURL(file);});try{const img=new Image();img.src=original;await img.decode();const scale=Math.min(1,1400/Math.max(img.naturalWidth,img.naturalHeight));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);return canvas.toDataURL('image/jpeg',0.78);}catch{return original;}}
  ['fileInput','photoInput','cameraInput'].forEach(id=>$('#'+id)?.addEventListener('change',fileChanged));
  $('#search')?.addEventListener('click',()=>{if($('#prompt')){$('#prompt').value='Search the web for ';$('#prompt').focus();}});$('#create')?.addEventListener('click',()=>{if($('#prompt')){$('#prompt').value='Help me create ';$('#prompt').focus();}});
  const voiceGreetings = [
    "Hi! I'm here with you. What would you like to talk about?",
    "Hello! Take your time—I'm listening. What's on your mind?",
    "Hey there! We can talk through a question or idea together. Where shall we start?",
    "Hi again! I'm ready to listen and help. What would you like to explore?",
    "Hello! You can speak naturally, just as you would in a conversation. I'm listening.",
    "Hey! What has been on your mind today? Let's talk about it.",
    "Hi! Whether you have a question or just want to think aloud, I'm here to help.",
    "Hello there! Tell me what you'd like help with, and we'll work through it together.",
    "Hi! I'm ready when you are. What shall we discuss today?",
    "Hey there! Let's have a conversation. What would you like to start with?"
  ];
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(SR){
    recognition=new SR(); recognition.continuous=false; recognition.interimResults=false; recognition.lang=localStorage.getItem('gam_voice_language')||'en-US';
    recognition.onstart=()=>{listening=true;$('#mic')?.classList.add('voice-active');if($('#voice'))$('#voice').textContent='◉ Listening…';};
    recognition.onresult=e=>{const t=[...e.results].map(r=>r[0]?.transcript||'').join(' ').trim();if(t){if(voiceMode){if($('#prompt'))$('#prompt').value=t;send(t);}else if($('#prompt')){$('#prompt').value=t;$('#prompt').focus();}}};
    recognition.onerror=e=>{if(e.error!=='no-speech'&&e.error!=='aborted')toast('Voice input could not start. Check microphone permission.');};
    recognition.onend=()=>{listening=false;$('#mic')?.classList.remove('voice-active');if($('#voice'))$('#voice').textContent=voiceMode?'◉ Voice On':'◉ Voice';if(voiceMode&&!voiceSpeaking&&!sending){clearTimeout(voiceRestartTimer);voiceRestartTimer=setTimeout(()=>startListeningForConversation(),450);}};
  }
  function startListeningForConversation(){if(!voiceMode||!recognition||voiceSpeaking||sending)return;try{recognition.lang=localStorage.getItem('gam_voice_language')||'en-US';recognition.start();}catch{}}
  function stopVoiceMode(){voiceMode=false;voiceSpeaking=false;clearTimeout(voiceRestartTimer);if(recognition&&listening){try{recognition.stop()}catch{}}if('speechSynthesis'in window)speechSynthesis.cancel();$('#voiceOn')?.classList.remove('selected');$('#voiceOff')?.classList.add('selected');$('#mic')?.classList.remove('voice-active');if($('#voice'))$('#voice').textContent='◉ Voice';toast('Voice conversation is off.');}
  function speak(text,continueConversation=false){if(!('speechSynthesis'in window)){toast('Voice output is not supported in this browser.');return;}speechSynthesis.cancel();if(recognition&&listening){try{recognition.stop()}catch{}}const clean=String(text||'').replace(/https?:\/\/\S+/g,'').replace(/\[[^\]]*\]/g,'').trim();const u=new SpeechSynthesisUtterance(clean);u.lang=localStorage.getItem('gam_voice_language')||'en-US';u.rate=0.98;u.onstart=()=>{voiceSpeaking=true;};u.onend=()=>{voiceSpeaking=false;if(voiceMode)startListeningForConversation();};u.onerror=()=>{voiceSpeaking=false;if(voiceMode)startListeningForConversation();};speechSynthesis.speak(u);}
  function startVoice(){if(voiceMode){stopVoiceMode();return;}if(!recognition)return toast('Continuous voice needs a browser that supports speech recognition, such as Chrome, and microphone permission.');voiceMode=true;$('#voiceOn')?.classList.add('selected');$('#voiceOff')?.classList.remove('selected');if($('#voice'))$('#voice').textContent='◉ Voice On';const greeting=voiceGreetings[Math.floor(Math.random()*voiceGreetings.length)];speak(greeting,true);toast('Voice conversation is on. Speak after the greeting.');}
  $('#mic')?.addEventListener('click',()=>{if(voiceMode){stopVoiceMode();return;}if(!recognition)return toast('Voice input is not supported in this browser. Try Chrome and allow microphone access.');startListeningForConversation();});
  $('#voice')?.addEventListener('click',startVoice);$('#voiceOn')?.addEventListener('click',()=>{if(!voiceMode)startVoice();});$('#voiceOff')?.addEventListener('click',stopVoiceMode);
  function typing(on){$('#typing')?.remove();if(on&&$('#messages')){const d=document.createElement('div');d.id='typing';d.className='typing';d.setAttribute('role','status');d.setAttribute('aria-label','Assistant is responding');d.innerHTML='<span></span><span></span><span></span>';$('#messages').append(d);}}
  async function send(text){text=String(text||'').trim();if(sending)return;if(!text&&!pendingFiles.length)return;sending=true;const sendButton=$('#send');if(sendButton)sendButton.disabled=true;const attached=[...pendingFiles];const fileNames=attached.map(f=>f.name);const imageFile=pendingImageFile;const originalText=text;const useThinkHarder=thinkHarder;thinkHarder=false;
    if($('#prompt'))$('#prompt').value='';$('#chat')?.classList.remove('hidden');$('#home')?.classList.add('chatting');typing(true);
    try{
      let imageData='';if(imageFile)imageData=await imageToDataUrl(imageFile);
      let fileContents='';for(const file of attached){if(file!==imageFile)fileContents+=await readTextAttachment(file);}
      const unsupported=attached.filter(f=>f!==imageFile&&!/\.(txt|md|csv|json|html?|css|js|ts|xml|ya?ml|log)$/i.test(f.name||'')&&!/^text\//i.test(f.type||'')&&!/json/i.test(f.type||''));
      const outgoing=(useThinkHarder?'Please think carefully and provide a well-checked answer. ':'')+text+(fileContents?`\n\nPlease read the attached file content and answer based on it.\n${fileContents}`:'')+(unsupported.length?`\n\nAttached file(s) not text-extracted by this version: ${unsupported.map(f=>f.name).join(', ')}. Do not pretend to have read their contents; explain this limitation briefly if needed.`:'');
      addMessage('u',originalText|| (imageFile?'':fileNames.length?'Please review the attached file(s).':''),{fileNames,imageData});
      // Keep the three animated dots visible after addMessage() redraws the message list.
      typing(true);
      if($('#attachmentPreview'))$('#attachmentPreview').classList.add('hidden');
      const history=getCurrentMessages().filter(m=>m.r==='u'||m.r==='a').map(m=>({role:m.r==='u'?'user':'assistant',content:m.c}));
      if(!navigator.onLine)throw new Error('OFFLINE_NETWORK');
      const endpoint=/^\s*(search the web|search online|look up online|find current|latest news|current weather)\b/i.test(text)?'/api/search':'/api/chat';
      const res=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:outgoing,messages:history,image:imageData,webSearch:endpoint==='/api/search'||undefined,language:localStorage.getItem('gam_language')||'System Default'})});
      const data=await res.json().catch(()=>({}));typing(false);if(!res.ok&&!data.text&&!data.response&&!data.result)throw new Error(data.error||`Request failed (${res.status}).`);
      const answer=data.text||data.response||data.result||data.message||data.error||'I could not complete that request.';
      const extras={};
      if(Array.isArray(data.visuals)&&data.visuals.length&&isExplicitVisualRequest(originalText))extras.visuals=data.visuals;
      if(Array.isArray(data.sources)&&data.sources.length&&data.webSearchUsed===true)extras.sources=data.sources;
      addMessage('a',answer,extras);if(voiceMode)speak(answer,true);pendingFiles=[];pendingImageFile=null;clearPendingPreviewUrls();renderAttachmentPreview();
      await maybeGenerateTitle();
    }catch(err){typing(false);const message=String(err?.message||err);if(message==='OFFLINE_NETWORK'||(!navigator.onLine)||err instanceof TypeError){addMessage('a','There is no internet connection. Please connect to the internet and try again.');}else if(/web search|search provider|search service/i.test(message)){addMessage('a','Web search is temporarily unavailable. Please try again in a moment.');}else{addMessage('a',`I couldn't complete that request right now. Please try again.\n\nDetails: ${message}`);}} finally {sending=false;if(sendButton)sendButton.disabled=false;} }
  function isExplicitVisualRequest(text){return /\b(show me|give me|find me|send me|display|fetch|search for|real photos? of|images? of|pictures? of|photographs? of|illustration of|diagram of)\b/i.test(String(text||''));}
  function renderVisuals(items){const box=$('#messages');if(!box)return;const wrap=document.createElement('div');wrap.className='visual-results';wrap.innerHTML=items.slice(0,6).map(item=>{const src=safeUrl(item.imageUrl||item.image||item.thumbnail||'');const href=safeUrl(item.pageUrl||item.url||'');if(!src)return '';return `<a href="${esc(href||src)}" target="_blank" rel="noopener noreferrer"><img src="${esc(src)}" alt="${esc(item.title||'Relevant image')}" loading="lazy"><span>${esc(item.title||'Open image source')}</span></a>`;}).join('');if(wrap.innerHTML)box.append(wrap);}
  function renderSources(items){const box=$('#messages');if(!box)return;const wrap=document.createElement('div');wrap.className='source-results';wrap.innerHTML='<strong class="sources-heading"><span class="source-stack" aria-hidden="true">◎</span> Sources</strong>'+items.slice(0,8).map(item=>{const href=safeUrl(item.url||item.link||'');if(!href)return '';let host='';try{host=new URL(href).hostname.replace(/^www\./,'')}catch{}const icon=host?`https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`:'';return `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${icon?`<img class="source-icon" src="${esc(icon)}" alt="" loading="lazy">`:''}<span>${esc(item.title||item.name||host||href)}</span></a>`;}).join('');if(wrap.querySelector('a'))box.append(wrap);}
  $('#send')?.addEventListener('click',()=>send($('#prompt')?.value||''));$('#prompt')?.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send(e.target.value);}});$('#prompt')?.addEventListener('input',()=>{const el=$('#prompt');el.style.height='auto';el.style.height=Math.min(el.scrollHeight,180)+'px';});$$('.cards button').forEach(b=>b.addEventListener('click',()=>{if($('#prompt')){$('#prompt').value=b.dataset.p||'';$('#prompt').focus();}}));
  renderCaps();renderRecent();updateTemp();closeMenus();
})();
