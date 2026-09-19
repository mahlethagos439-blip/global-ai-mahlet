/* Global AI Mahlet — chat.js */
(() => {
  "use strict";

  const KEY = "global_ai_mahlet_chats_v1";
  const LANG_KEY = "global_ai_mahlet_language_v1";

  const LANGUAGES = [
    ["English","en"],["Amharic","am"],["Tigrigna (Tigrinya)","ti"],["Afaan Oromo","om"],
    ["Somali","so"],["Arabic","ar"],["French","fr"],["Spanish","es"],["Portuguese","pt"],
    ["German","de"],["Italian","it"],["Dutch","nl"],["Russian","ru"],["Ukrainian","uk"],
    ["Polish","pl"],["Czech","cs"],["Slovak","sk"],["Romanian","ro"],["Hungarian","hu"],
    ["Greek","el"],["Turkish","tr"],["Hebrew","he"],["Persian","fa"],["Urdu","ur"],
    ["Hindi","hi"],["Bengali","bn"],["Punjabi","pa"],["Gujarati","gu"],["Marathi","mr"],
    ["Tamil","ta"],["Telugu","te"],["Kannada","kn"],["Malayalam","ml"],["Sinhala","si"],
    ["Nepali","ne"],["Chinese","zh"],["Japanese","ja"],["Korean","ko"],["Vietnamese","vi"],
    ["Thai","th"],["Indonesian","id"],["Malay","ms"],["Filipino","tl"],["Burmese","my"],
    ["Khmer","km"],["Lao","lo"],["Mongolian","mn"],["Kazakh","kk"],["Uzbek","uz"],
    ["Azerbaijani","az"],["Armenian","hy"],["Georgian","ka"],["Albanian","sq"],
    ["Serbian","sr"],["Croatian","hr"],["Slovenian","sl"],["Bulgarian","bg"],
    ["Macedonian","mk"],["Bosnian","bs"],["Lithuanian","lt"],["Latvian","lv"],
    ["Estonian","et"],["Finnish","fi"],["Swedish","sv"],["Norwegian","no"],
    ["Danish","da"],["Icelandic","is"],["Irish","ga"],["Welsh","cy"],["Swahili","sw"],
    ["Zulu","zu"],["Xhosa","xh"],["Afrikaans","af"],["Hausa","ha"],["Yoruba","yo"],
    ["Igbo","ig"],["Malagasy","mg"],["Kinyarwanda","rw"],["Shona","sn"],["Sesotho","st"]
  ];

  const state = {
    chats: loadChats(),
    activeId: null,
    temporary: false,
    voiceMode: false,
    listening: false,
    language: localStorage.getItem(LANG_KEY) || "en",
    selectedFiles: [],
    recognition: null
  };

  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2,8);
  }

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
    }[c]));
  }

  function loadChats() {
    try {
      return JSON.parse(localStorage.getItem(KEY)) || [];
    } catch {
      return [];
    }
  }

  function saveChats() {
    if (!state.temporary) {
      localStorage.setItem(KEY, JSON.stringify(state.chats));
    }
  }

  function activeChat() {
    return state.chats.find(c => c.id === state.activeId) || null;
  }

  function newChat(save = true) {
    const chat = {
      id: uid(),
      title: "New Chat",
      created: Date.now(),
      updated: Date.now(),
      pinned: false,
      messages: []
    };

    if (state.temporary) {
      state.activeId = chat.id;
      state.tempChat = chat;
    } else {
      state.chats.unshift(chat);
      state.activeId = chat.id;
      if (save) saveChats();
    }

    render();
    return chat;
  }

  function getChat() {
    if (state.temporary) {
      if (!state.tempChat) {
        state.tempChat = {
          id: uid(),
          title: "Temporary Chat",
          created: Date.now(),
          updated: Date.now(),
          pinned: false,
          messages: []
        };
      }
      return state.tempChat;
    }

    let chat = activeChat();
    if (!chat) chat = newChat(false);
    return chat;
  }

  function addMessage(role, text, extra = {}) {
    const chat = getChat();

    chat.messages.push({
      id: uid(),
      role,
      text: String(text || ""),
      time: Date.now(),
      ...extra
    });

    chat.updated = Date.now();

    if (role === "user" && chat.title === "New Chat") {
      const clean = String(text).trim().replace(/\s+/g, " ");
      chat.title = clean.slice(0, 42) || "New Chat";
    }

    saveChats();
    renderMessages();
    renderRecents();
  }

  function languageName(code) {
    return (LANGUAGES.find(x => x[1] === code) || ["English","en"])[0];
  }

  function renderMessages() {
    const box = $("#messages") || $(".messages") || $("#chatMessages");
    if (!box) return;

    const chat = getChat();
    if (!chat.messages.length) {
      box.innerHTML = `
        <div class="empty-chat">
          <div class="empty-icon">✨</div>
          <h2>Hello, Mahlet ✨</h2>
          <p>I'm Global AI Mahlet — your smart assistant.<br>
          Ask me anything, anytime. I'm here to help you learn, create, solve, and grow! 💙</p>
        </div>`;
      return;
    }

    box.innerHTML = chat.messages.map(m => {
      const isAI = m.role === "assistant";
      return `
        <div class="message ${isAI ? "ai-message" : "user-message"}" data-id="${m.id}">
          <div class="message-bubble">${formatText(m.text)}</div>
          ${isAI ? `
            <div class="message-actions">
              <button data-speak="${m.id}" title="Speak">🔊</button>
              <button data-share="${m.id}" title="Share">↗</button>
            </div>` : ""}
        </div>`;
    }).join("");

    box.scrollTop = box.scrollHeight;
  }

  function formatText(text) {
    return esc(text)
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\n/g, "<br>");
  }

  function renderRecents(filter = "") {
    const box = $("#recentChats") || $(".recent-chats") || $("#recents");
    if (!box) return;

    if (state.temporary) {
      box.innerHTML = `<div class="recent-empty">Temporary Chat is not saved.</div>`;
      return;
    }

    let chats = [...state.chats].sort((a,b) =>
      Number(b.pinned) - Number(a.pinned) || b.updated - a.updated
    );

    if (filter) {
      const q = filter.toLowerCase();
      chats = chats.filter(c =>
        c.title.toLowerCase().includes(q) ||
        c.messages.some(m => m.text.toLowerCase().includes(q))
      );
    }

    if (!chats.length) {
      box.innerHTML = `<div class="recent-empty">No recent chats yet.</div>`;
      return;
    }

    box.innerHTML = chats.map(c => `
      <div class="recent-chat ${c.id === state.activeId ? "active" : ""}" data-chat="${c.id}">
        <button class="recent-open" data-open="${c.id}">
          <span>${c.pinned ? "📌 " : ""}${esc(c.title)}</span>
        </button>
        <button class="recent-more" data-more="${c.id}">⋮</button>
      </div>
    `).join("");
  }

  function render() {
    renderMessages();
    renderRecents();
    updateLanguageUI();
    updateVoiceUI();
    updateTemporaryUI();
  }

  function updateLanguageUI() {
    $$("[data-language-label]").forEach(el => {
      el.textContent = state.language.toUpperCase();
    });

    $$("select[data-language]").forEach(select => {
      if (!select.options.length) {
        select.innerHTML = LANGUAGES.map(([name,code]) =>
          `<option value="${code}">${name}</option>`
        ).join("");
      }
      select.value = state.language;
    });
  }

  function updateVoiceUI() {
    $$("[data-voice-mode]").forEach(btn => {
      btn.classList.toggle("active", state.voiceMode);
      btn.setAttribute("aria-pressed", String(state.voiceMode));
    });

    $$("[data-mic]").forEach(btn => {
      btn.classList.toggle("active", state.listening);
    });
  }

  function updateTemporaryUI() {
    $$("[data-temporary]").forEach(el => {
      if (el.matches("input")) el.checked = state.temporary;
      el.classList.toggle("active", state.temporary);
    });
  }

  function inputBox() {
    return $("#messageInput") || $("textarea") || $("input[name='message']");
  }

  function sendButton() {
    return $("[data-send]") || $("#sendButton") || $(".send-button");
  }

  async function sendMessage() {
    const input = inputBox();
    if (!input) return;

    const text = input.value.trim();
    if (!text && !state.selectedFiles.length) return;

    const files = await prepareFiles();

    input.value = "";
    addMessage("user", text || "Please analyze the attached file/image.", {files});

    const chat = getChat();

    showTyping(true);

    try {
      const result = await requestAI({
        message: text,
        language: state.language,
        chat: chat,
        files: files
      });

      const answer = result?.text || result?.response ||
        "I received your message. The AI connection is ready to be connected to your Cloudflare Workers AI backend.";

      addMessage("assistant", answer);

      if (state.voiceMode) speak(answer);
    } catch (error) {
      console.error(error);
      addMessage(
        "assistant",
        "I couldn't connect to the AI server right now. Please check the Cloudflare AI connection."
      );
    } finally {
      showTyping(false);
      state.selectedFiles = [];
      updateFilePreview();
    }
  }

  async function requestAI(payload) {
    /*
      IMPORTANT:
      This function intentionally does not invent a Cloudflare endpoint.
      Your actual Worker backend must be connected here after we inspect
      your current Cloudflare Worker configuration.
    */

    const endpoint =
      document.body.dataset.aiEndpoint ||
      window.GLOBAL_AI_ENDPOINT ||
      "/api/chat";

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({
        message: payload.message,
        language: payload.language,
        messages: payload.chat?.messages || [],
        files: payload.files || []
      })
    });

    if (!response.ok) {
      throw new Error("AI request failed: " + response.status);
    }

    const type = response.headers.get("content-type") || "";

    if (type.includes("application/json")) {
      return await response.json();
    }

    return {text: await response.text()};
  }

  function showTyping(show) {
    const box = $("#messages") || $(".messages") || $("#chatMessages");
    if (!box) return;

    const old = box.querySelector(".typing");
    if (old) old.remove();

    if (show) {
      box.insertAdjacentHTML("beforeend", `
        <div class="message ai-message typing">
          <div class="message-bubble">Thinking<span>.</span><span>.</span><span>.</span></div>
        </div>`);
      box.scrollTop = box.scrollHeight;
    }
  }

  async function prepareFiles() {
    const out = [];

    for (const file of state.selectedFiles) {
      const item = {
        name: file.name,
        type: file.type,
        size: file.size
      };

      if (file.type.startsWith("image/")) {
        item.preview = await fileToDataURL(file);
      }

      out.push(item);
    }

    return out;
  }

  function fileToDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function addFiles(files) {
    state.selectedFiles.push(...[...files]);
    updateFilePreview();
  }

  function updateFilePreview() {
    const box = $("#filePreview") || $(".file-preview");
    if (!box) return;

    box.innerHTML = state.selectedFiles.map((f,i) => `
      <div class="file-chip">
        <span>${f.type.startsWith("image/") ? "🖼️" : "📎"} ${esc(f.name)}</span>
        <button data-remove-file="${i}">×</button>
      </div>
    `).join("");
  }

  function speak(text) {
    if (!("speechSynthesis" in window)) return;

    speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = state.language;
    utterance.rate = 1;
    utterance.pitch = 1;

    speechSynthesis.speak(utterance);
  }

  function setupRecognition() {
    const Recognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!Recognition) return null;

    const r = new Recognition();
    r.lang = state.language;
    r.continuous = state.voiceMode;
    r.interimResults = false;

    r.onstart = () => {
      state.listening = true;
      updateVoiceUI();
    };

    r.onend = () => {
      state.listening = false;
      updateVoiceUI();

      if (state.voiceMode) {
        try { r.start(); } catch {}
      }
    };

    r.onerror = e => {
      console.warn("Speech recognition:", e.error);
      state.listening = false;
      updateVoiceUI();
    };

    r.onresult = e => {
      const transcript = [...e.results]
        .map(r => r[0].transcript)
        .join(" ");

      const input = inputBox();
      if (input) input.value = transcript;

      if (state.voiceMode) sendMessage();
    };

    return r;
  }

  function toggleVoiceMode() {
    state.voiceMode = !state.voiceMode;

    if (state.voiceMode) {
      state.recognition = setupRecognition();

      if (state.recognition) {
        try { state.recognition.start(); } catch {}
      }

      addMessage(
        "assistant",
        "Voice mode is on 🎙️. You can speak naturally, and I'll respond by voice. You can interrupt me at any time."
      );
    } else {
      if (state.recognition) {
        try { state.recognition.stop(); } catch {}
      }
      speechSynthesis?.cancel();
      state.listening = false;
    }

    updateVoiceUI();
  }

  function toggleMic() {
    if (!state.recognition) state.recognition = setupRecognition();
    if (!state.recognition) {
      alert("Voice input is not supported by this browser.");
      return;
    }

    if (state.listening) {
      try { state.recognition.stop(); } catch {}
    } else {
      state.recognition.lang = state.language;
      try { state.recognition.start(); } catch {}
    }
  }

  function setupLanguage() {
    $$("select[data-language]").forEach(select => {
      select.addEventListener("change", () => {
        state.language = select.value;
        localStorage.setItem(LANG_KEY, state.language);

        if (state.recognition) {
          state.recognition.lang = state.language;
        }

        updateLanguageUI();
      });
    });
  }

  function setupInput() {
    const input = inputBox();
    if (!input) return;

    input.addEventListener("keydown", e => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    input.addEventListener("input", () => {
      input.style.height = "auto";
      input.style.height = Math.min(input.scrollHeight, 160) + "px";
    });
  }

  function setupActions() {
    document.addEventListener("click", async e => {
      const t = e.target.closest("button,[data-open],[data-more]");
      if (!t) return;

      if (t.matches("[data-send]") || t.id === "sendButton" ||
          t.classList.contains("send-button")) {
        e.preventDefault();
        sendMessage();
        return;
      }

      if (t.matches("[data-new-chat]")) {
        e.preventDefault();
        newChat();
        return;
      }

      if (t.matches("[data-voice-mode]")) {
        e.preventDefault();
        toggleVoiceMode();
        return;
      }

      if (t.matches("[data-mic]")) {
        e.preventDefault();
        toggleMic();
        return;
      }

      if (t.matches("[data-speak]")) {
        const chat = getChat();
        const m = chat.messages.find(x => x.id === t.dataset.speak);
        if (m) speak(m.text);
        return;
      }

      if (t.matches("[data-share]")) {
        const chat = getChat();
        const m = chat.messages.find(x => x.id === t.dataset.share);
        if (!m) return;

        if (navigator.share) {
          navigator.share({title:"Global AI Mahlet",text:m.text}).catch(()=>{});
        } else if (navigator.clipboard) {
          await navigator.clipboard.writeText(m.text);
          alert("Message copied.");
        }
        return;
      }

      if (t.matches("[data-open]")) {
        state.activeId = t.dataset.open;
        render();
        return;
      }

      if (t.matches("[data-more]")) {
        recentMenu(t.dataset.more);
        return;
      }

      if (t.matches("[data-remove-file]")) {
        state.selectedFiles.splice(Number(t.dataset.removeFile),1);
        updateFilePreview();
      }
    });

    document.addEventListener("change", e => {
      const el = e.target;

      if (el.matches("[data-temporary]")) {
        state.temporary = el.checked;

        if (state.temporary) {
          state.tempChat = null;
          state.activeId = null;
        } else {
          state.tempChat = null;
          if (!state.chats.length) newChat();
          else state.activeId = state.chats[0].id;
        }

        render();
      }

      if (el.matches("input[type=file]")) {
        addFiles(el.files);
        el.value = "";
      }
    });
  }

  function recentMenu(id) {
    const chat = state.chats.find(c => c.id === id);
    if (!chat) return;

    const action = prompt(
      "Choose an action:\n1 = Rename\n2 = Pin/Unpin\n3 = Delete"
    );

    if (action === "1") {
      const name = prompt("New chat name:", chat.title);
      if (name?.trim()) chat.title = name.trim().slice(0,60);
    }

    if (action === "2") {
      chat.pinned = !chat.pinned;
    }

    if (action === "3") {
      if (confirm("Delete this chat?")) {
        state.chats = state.chats.filter(c => c.id !== id);

        if (state.activeId === id) {
          state.activeId = state.chats[0]?.id || null;
        }
      }
    }

    saveChats();
    render();
  }

  function setupSearch() {
    $$("[data-search-chats]").forEach(input => {
      input.addEventListener("input", () => renderRecents(input.value));
    });
  }

  function setupFileInputs() {
    $$("[data-file-input]").forEach(input => {
      input.addEventListener("change", () => {
        addFiles(input.files);
        input.value = "";
      });
    });

    $$("[data-camera]").forEach(btn => {
      btn.addEventListener("click", () => {
        const input = document.querySelector(
          'input[type="file"][capture="environment"]'
        );
        if (input) input.click();
      });
    });

    $$("[data-attach]").forEach(btn => {
      btn.addEventListener("click", () => {
        const input = document.querySelector(
          'input[type="file"]:not([capture])'
        );
        if (input) input.click();
      });
    });
  }

  function start() {
    if (!state.chats.length && !state.temporary) newChat();

    setupLanguage();
    setupInput();
    setupActions();
    setupSearch();
    setupFileInputs();
    render();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }

  window.GlobalAIMahlet = {
    state,
    sendMessage,
    newChat,
    speak,
    toggleVoiceMode
  };
})();
