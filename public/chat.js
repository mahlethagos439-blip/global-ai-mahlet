/* =========================================================
   GLOBAL AI MAHLET — CHAT ENGINE
   Frontend application logic
   ========================================================= */

(() => {
  "use strict";

  const APP_NAME = "Global AI Mahlet";
  const STORAGE_KEY = "global_ai_mahlet_chats_v1";
  const ACTIVE_KEY = "global_ai_mahlet_active_v1";
  const TEMP_KEY = "global_ai_mahlet_temporary_v1";
  const LANG_KEY = "global_ai_mahlet_language_v1";

  /* -------------------------------------------------------
     80 SUPPORTED UI LANGUAGES
     ------------------------------------------------------- */

  const LANGUAGES = [
    ["English", "en"],
    ["Amharic", "am"],
    ["Tigrigna (Tigrinya)", "ti"],
    ["Afaan Oromo", "om"],
    ["Somali", "so"],
    ["Arabic", "ar"],
    ["French", "fr"],
    ["Spanish", "es"],
    ["Portuguese", "pt"],
    ["German", "de"],
    ["Italian", "it"],
    ["Dutch", "nl"],
    ["Russian", "ru"],
    ["Ukrainian", "uk"],
    ["Polish", "pl"],
    ["Czech", "cs"],
    ["Slovak", "sk"],
    ["Romanian", "ro"],
    ["Hungarian", "hu"],
    ["Greek", "el"],
    ["Turkish", "tr"],
    ["Hebrew", "he"],
    ["Persian", "fa"],
    ["Urdu", "ur"],
    ["Hindi", "hi"],
    ["Bengali", "bn"],
    ["Punjabi", "pa"],
    ["Gujarati", "gu"],
    ["Marathi", "mr"],
    ["Tamil", "ta"],
    ["Telugu", "te"],
    ["Kannada", "kn"],
    ["Malayalam", "ml"],
    ["Sinhala", "si"],
    ["Nepali", "ne"],
    ["Chinese", "zh"],
    ["Japanese", "ja"],
    ["Korean", "ko"],
    ["Vietnamese", "vi"],
    ["Thai", "th"],
    ["Indonesian", "id"],
    ["Malay", "ms"],
    ["Filipino", "tl"],
    ["Burmese", "my"],
    ["Khmer", "km"],
    ["Lao", "lo"],
    ["Mongolian", "mn"],
    ["Kazakh", "kk"],
    ["Uzbek", "uz"],
    ["Azerbaijani", "az"],
    ["Armenian", "hy"],
    ["Georgian", "ka"],
    ["Albanian", "sq"],
    ["Serbian", "sr"],
    ["Croatian", "hr"],
    ["Slovenian", "sl"],
    ["Bulgarian", "bg"],
    ["Macedonian", "mk"],
    ["Bosnian", "bs"],
    ["Lithuanian", "lt"],
    ["Latvian", "lv"],
    ["Estonian", "et"],
    ["Finnish", "fi"],
    ["Swedish", "sv"],
    ["Norwegian", "no"],
    ["Danish", "da"],
    ["Icelandic", "is"],
    ["Irish", "ga"],
    ["Welsh", "cy"],
    ["Swahili", "sw"],
    ["Zulu", "zu"],
    ["Xhosa", "xh"],
    ["Afrikaans", "af"],
    ["Hausa", "ha"],
    ["Yoruba", "yo"],
    ["Igbo", "ig"],
    ["Malagasy", "mg"],
    ["Kinyarwanda", "rw"],
    ["Shona", "sn"],
    ["Sesotho", "st"]
  ];

  /* -------------------------------------------------------
     STATE
     ------------------------------------------------------- */

  const state = {
    chats: loadChats(),
    activeChatId: localStorage.getItem(ACTIVE_KEY) || null,
    temporary: localStorage.getItem(TEMP_KEY) === "true",
    language: localStorage.getItem(LANG_KEY) || "en",
    voiceMode: false,
    listening: false,
    speaking: false,
    recognition: null,
    selectedFiles: [],
    cameraStream: null
  };

  /* -------------------------------------------------------
     BASIC HELPERS
     ------------------------------------------------------- */

  function $(selector, root = document) {
    return root.querySelector(selector);
  }

  function $all(selector, root = document) {
    return Array.from(root.querySelectorAll(selector));
  }

  function uid(prefix = "id") {
    return (
      prefix +
      "_" +
      Date.now().toString(36) +
      "_" +
      Math.random().toString(36).slice(2, 9)
    );
  }

  function escapeHTML(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatText(value) {
    return escapeHTML(value)
      .replace(/\n/g, "<br>")
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/`([^`]+)`/g, "<code>$1</code>");
  }

  function now() {
    return new Date().toISOString();
  }

  function languageName(code) {
    const found = LANGUAGES.find(item => item[1] === code);
    return found ? found[0] : "English";
  }

  /* -------------------------------------------------------
     CHAT STORAGE
     One conversation = ONE recent chat.
     A new recent chat is created ONLY after New Chat.
     ------------------------------------------------------- */

  function loadChats() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveChats() {
    if (state.temporary) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.chats));
  }

  function createChat() {
    const chat = {
      id: uid("chat"),
      title: "New conversation",
      createdAt: now(),
      updatedAt: now(),
      pinned: false,
      messages: []
    };

    state.chats.unshift(chat);
    state.activeChatId = chat.id;

    localStorage.setItem(ACTIVE_KEY, chat.id);

    if (!state.temporary) {
      saveChats();
    }

    return chat;
  }

  function getActiveChat() {
    return state.chats.find(chat => chat.id === state.activeChatId);
  }

  function ensureActiveChat() {
    let chat = getActiveChat();

    if (!chat) {
      chat = createChat();
    }

    return chat;
  }

  function updateChat(chat) {
    chat.updatedAt = now();

    if (!state.temporary) {
      saveChats();
    }
  }

  function addMessage(role, text, extra = {}) {
    const chat = ensureActiveChat();

    const message = {
      id: uid("msg"),
      role,
      text: String(text ?? ""),
      time: now(),
      ...extra
    };

    chat.messages.push(message);

    if (
      role === "user" &&
      chat.messages.filter(item => item.role === "user").length === 1
    ) {
      chat.title = makeTitle(text);
    }

    updateChat(chat);
    return message;
  }

  function makeTitle(text) {
    const clean = String(text || "")
      .replace(/\s+/g, " ")
      .trim();

    if (!clean) return "New conversation";

    return clean.length > 42
      ? clean.slice(0, 42).trim() + "…"
      : clean;
  }

  /* -------------------------------------------------------
     DOM DISCOVERY
     ------------------------------------------------------- */

  function findInput() {
    return (
      $("#messageInput") ||
      $("#chatInput") ||
      $('textarea[name="message"]') ||
      $('textarea[placeholder*="Message"]') ||
      $('input[placeholder*="Message"]') ||
      $("textarea")
    );
  }

  function findSendButton() {
    return (
      $("#sendButton") ||
      $("#sendBtn") ||
      $('[data-action="send"]') ||
      $('button[aria-label*="Send" i]')
    );
  }

  function findMessagesContainer() {
    return (
      $("#messages") ||
      $("#chatMessages") ||
      $("#messagesContainer") ||
      $(".messages") ||
      $(".chat-messages")
    );
  }

  function findRecentsContainer() {
    return (
      $("#recentChats") ||
      $("#recents") ||
      $(".recent-chats") ||
      $('[data-role="recents"]')
    );
  }

  function findLanguageSelect() {
    return (
      $("#languageSelect") ||
      $("#language") ||
      $('select[name="language"]')
    );
  }

  /* -------------------------------------------------------
     MESSAGE RENDERING
     ------------------------------------------------------- */

  function renderMessages() {
    const container = findMessagesContainer();
    if (!container) return;

    const chat = getActiveChat();

    if (!chat || chat.messages.length === 0) {
      renderEmptyState(container);
      return;
    }

    container.innerHTML = "";

    chat.messages.forEach(message => {
      const element = createMessageElement(message);
      container.appendChild(element);
    });

    scrollMessages();
  }

  function renderEmptyState(container) {
    container.innerHTML = `
      <div class="gam-empty-state">
        <div class="gam-empty-icon">✨</div>
        <h3>How can I help you?</h3>
        <p>Ask Global AI Mahlet anything. Learn, create, solve and grow.</p>
      </div>
    `;
  }

  function createMessageElement(message) {
    const wrapper = document.createElement("div");

    wrapper.className =
      "gam-message " +
      (message.role === "user" ? "gam-user-message" : "gam-ai-message");

    wrapper.dataset.messageId = message.id;

    const label =
      message.role === "user"
        ? "You"
        : "Global AI Mahlet";

    const attachmentHTML = renderAttachments(message.attachments);

    wrapper.innerHTML = `
      <div class="gam-message-label">${label}</div>
      <div class="gam-message-bubble">
        <div class="gam-message-text">${formatText(message.text)}</div>
        ${attachmentHTML}
      </div>
      ${
        message.role === "assistant"
          ? `
            <div class="gam-message-actions">
              <button type="button"
                data-message-action="speak"
                data-message-id="${message.id}"
                aria-label="Speak message">🔊</button>
              <button type="button"
                data-message-action="share"
                data-message-id="${message.id}"
                aria-label="Share message">↗</button>
            </div>
          `
          : ""
      }
    `;

    return wrapper;
  }

  function renderAttachments(attachments) {
    if (!Array.isArray(attachments) || attachments.length === 0) {
      return "";
    }

    return `
      <div class="gam-attachments">
        ${attachments
          .map(file => {
            if (file.type && file.type.startsWith("image/") && file.data) {
              return `
                <div class="gam-image-preview">
                  <img src="${file.data}" alt="${escapeHTML(file.name)}">
                  <span>${escapeHTML(file.name)}</span>
                </div>
              `;
            }

            return `
              <div class="gam-file-preview">
                📎 ${escapeHTML(file.name)}
              </div>
            `;
          })
          .join("")}
      </div>
    `;
  }

  function scrollMessages() {
    const container = findMessagesContainer();
    if (!container) return;

    requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight;
    });
  }

  /* -------------------------------------------------------
     RECENT CHATS
     ------------------------------------------------------- */

  function renderRecents(searchTerm = "") {
    const container = findRecentsContainer();
    if (!container) return;

    const term = String(searchTerm || "").toLowerCase().trim();

    let chats = [...state.chats];

    chats.sort((a, b) => {
      if (a.pinned !== b.pinned) {
        return a.pinned ? -1 : 1;
      }

      return new Date(b.updatedAt) - new Date(a.updatedAt);
    });

    if (term) {
      chats = chats.filter(chat => {
        const titleMatch = chat.title.toLowerCase().includes(term);

        const messageMatch = chat.messages.some(message =>
          message.text.toLowerCase().includes(term)
        );

        return titleMatch || messageMatch;
      });
    }

    if (chats.length === 0) {
      container.innerHTML = `
        <div class="gam-no-recents">
          No recent chats found.
        </div>
      `;
      return;
    }

    container.innerHTML = chats
      .map(chat => {
        const active = chat.id === state.activeChatId;

        return `
          <div
            class="gam-recent-item ${active ? "active" : ""}"
            data-chat-id="${chat.id}"
          >
            <button
              class="gam-recent-main"
              type="button"
              data-chat-open="${chat.id}"
            >
              <span class="gam-recent-icon">💬</span>
              <span class="gam-recent-title">
                ${escapeHTML(chat.title)}
              </span>
              ${chat.pinned ? `<span class="gam-pin">📌</span>` : ""}
            </button>

            <button
              type="button"
              class="gam-recent-menu"
              data-chat-menu="${chat.id}"
              aria-label="Chat options"
            >⋮</button>

            <div
              class="gam-chat-options"
              data-chat-options="${chat.id}"
              hidden
            >
              <button type="button" data-chat-action="rename"
                data-chat-id="${chat.id}">✏️ Rename</button>

              <button type="button" data-chat-action="pin"
                data-chat-id="${chat.id}">
                ${chat.pinned ? "📌 Unpin" : "📌 Pin"}
              </button>

              <button type="button" data-chat-action="delete"
                data-chat-id="${chat.id}">🗑️ Delete</button>
            </div>
          </div>
        `;
      })
      .join("");
  }

  function openChat(chatId) {
    const chat = state.chats.find(item => item.id === chatId);
    if (!chat) return;

    state.activeChatId = chatId;
    localStorage.setItem(ACTIVE_KEY, chatId);

    renderMessages();
    renderRecents();
    closeSidebars();
  }

  function newChat() {
    createChat();
    renderMessages();
    renderRecents();
    closeSidebars();

    const input = findInput();
    if (input) {
      input.value = "";
      input.focus();
    }
  }

  function deleteChat(chatId) {
    const index = state.chats.findIndex(chat => chat.id === chatId);
    if (index === -1) return;

    state.chats.splice(index, 1);

    if (state.activeChatId === chatId) {
      state.activeChatId =
        state.chats.length > 0 ? state.chats[0].id : null;

      if (state.activeChatId) {
        localStorage.setItem(ACTIVE_KEY, state.activeChatId);
      } else {
        localStorage.removeItem(ACTIVE_KEY);
      }
    }

    saveChats();

    if (!state.activeChatId) {
      createChat();
    }

    renderMessages();
    renderRecents();
  }

  function renameChat(chatId) {
    const chat = state.chats.find(item => item.id === chatId);
    if (!chat) return;

    const newName = window.prompt(
      "Enter a new name for this chat:",
      chat.title
    );

    if (newName === null) return;

    const clean = newName.trim();

    if (!clean) return;

    chat.title = clean.slice(0, 80);
    updateChat(chat);

    renderRecents();
  }

  function togglePin(chatId) {
    const chat = state.chats.find(item => item.id === chatId);
    if (!chat) return;

    chat.pinned = !chat.pinned;
    updateChat(chat);

    renderRecents();
  }

  /* -------------------------------------------------------
     SEND MESSAGE
     ------------------------------------------------------- */

  async function sendMessage() {
    const input = findInput();
    if (!input) return;

    const text = input.value.trim();

    if (!text && state.selectedFiles.length === 0) {
      return;
    }

    const attachments = await prepareSelectedFiles();

    input.value = "";
    state.selectedFiles = [];

    const userMessage = addMessage(
      "user",
      text || "Please analyze the attached file.",
      { attachments }
    );

    renderMessages();
    renderRecents();

    setTyping(true);

    /*
      IMPORTANT:
      This frontend does NOT invent a fake Cloudflare API URL.

      The real Workers AI connection should be connected to the
      existing Cloudflare Worker/backend after we inspect the
      repository's src/index.ts and wrangler.jsonc.

      Until that backend is connected, the interface reports
      the connection status instead of pretending a fake AI
      response came from Workers AI.
    */

    try {
      const result = await requestAI({
        message: userMessage.text,
        language: state.language,
        chat
      });

      if (result && result.text) {
        addMessage("assistant", result.text);
      } else {
        addMessage(
          "assistant",
          "Your message was received. The Workers AI connection still needs to be connected to this chat interface."
        );
      }
    } catch (error) {
      console.error("Global AI request error:", error);

      addMessage(
        "assistant",
        "I received your message, but the AI server connection needs to be configured. The chat interface is working."
      );
    }

    setTyping(false);
    renderMessages();
    renderRecents();

    if (state.voiceMode) {
      const chat = getActiveChat();
      const last = chat?.messages?.[chat.messages.length - 1];

      if (last && last.role === "assistant") {
        speakText(last.text);
      }
    }
  }

  /* -------------------------------------------------------
     AI REQUEST
     ------------------------------------------------------- */

  async function requestAI(payload) {
    /*
      The actual endpoint is deliberately not fabricated.

      When the Cloudflare Worker route is available, this function
      can call it using:

      fetch("/api/chat", {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify(payload)
      })

      We only use it when an endpoint is explicitly configured.
    */

    const endpoint =
      window.GLOBAL_AI_ENDPOINT ||
      document.body?.dataset?.aiEndpoint ||
      "";

    if (!endpoint) {
      return {
        text:
          "I’m ready to help. The user interface is connected, but the real Cloudflare Workers AI backend still needs to be linked."
      };
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`AI server returned ${response.status}`);
    }

    const data = await response.json();

    return {
      text:
        data.text ||
        data.response ||
        data.message ||
        data.result ||
        ""
    };
  }

  /* -------------------------------------------------------
     TYPING INDICATOR
     ------------------------------------------------------- */

  function setTyping(active) {
    const container = findMessagesContainer();
    if (!container) return;

    const old = container.querySelector(".gam-typing");

    if (active) {
      if (old) return;

      const typing = document.createElement("div");
      typing.className = "gam-typing";
      typing.innerHTML = `
        <div class="gam-message-label">Global AI Mahlet</div>
        <div class="gam-typing-bubble">
          <span></span>
          <span></span>
          <span></span>
        </div>
      `;

      container.appendChild(typing);
      scrollMessages();
    } else if (old) {
      old.remove();
    }
  }

  /* -------------------------------------------------------
     FILES / IMAGES
     ------------------------------------------------------- */

  function handleFiles(fileList) {
    const files = Array.from(fileList || []);

    if (!files.length) return;

    state.selectedFiles.push(...files);

    showSelectedFiles();
  }

  function showSelectedFiles() {
    let area =
      $("#selectedFiles") ||
      $(".selected-files") ||
      $('[data-role="selected-files"]');

    if (!area) {
      area = document.createElement("div");
      area.id = "selectedFiles";
      area.className = "gam-selected-files";

      const composer =
        $(".composer") ||
        $(".chat-composer") ||
        findInput()?.parentElement;

      if (composer) {
        composer.prepend(area);
      } else {
        document.body.appendChild(area);
      }
    }

    area.innerHTML = state.selectedFiles
      .map(
        (file, index) => `
        <div class="gam-selected-file">
          <span>📎 ${escapeHTML(file.name)}</span>
          <button type="button"
            data-remove-file="${index}"
            aria-label="Remove file">×</button>
        </div>
      `
      )
      .join("");
  }

  async function prepareSelectedFiles() {
    const results = [];

    for (const file of state.selectedFiles) {
      const item = {
   
