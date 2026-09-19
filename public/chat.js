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
    tempChat: null,
    voiceMode: false,
    listening: false,
    language: localStorage.getItem(LANG_KEY) || "en",
    selectedFiles: [],
    recognition: null
  };

  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[char]));
  }

  function loadChats() {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY));
      return Array.isArray(saved) ? saved : [];
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
    return state.chats.find(chat => chat.id === state.activeId) || null;
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

      if (save) {
        saveChats();
      }
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

    if (!chat) {
      chat = newChat(false);
    }

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
      const clean = String(text)
        .trim()
        .replace(/\s+/g, " ");

      chat.title = clean.slice(0, 42) || "New Chat";
    }

    saveChats();
    renderMessages();
    renderRecents();
  }

  function renderMessages() {
    const box =
      $("#messages") ||
      $(".messages") ||
      $("#chatMessages");

    if (!box) return;

    const chat = getChat();

    if (!chat.messages.length) {
      box.innerHTML = `
        <div class="empty-chat">
          <div class="empty-icon">✨</div>
          <h2>Hello, Mahlet ✨</h2>
          <p>
            I'm Global AI Mahlet — your smart assistant.<br>
            Ask me anything, anytime. I'm here to help you learn,
            create, solve, and grow! 💙
          </p>
        </div>
      `;
      return;
    }

    box.innerHTML = chat.messages.map(message => {
      const isAI = message.role === "assistant";

      return `
        <div class="message ${isAI ? "ai-message" : "user-message"}"
             data-id="${message.id}">

          <div class="message-bubble">
            ${formatText(message.text)}
          </div>

          ${isAI ? `
            <div class="message-actions">
              <button
                type="button"
                data-speak="${message.id}"
                title="Speak">
                🔊
              </button>

              <button
                type="button"
                data-share="${message.id}"
                title="Share">
                ↗
              </button>
            </div>
          ` : ""}
        </div>
      `;
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
    const box =
      $("#recentChats") ||
      $(".recent-chats") ||
      $("#recents");

    if (!box) return;

    if (state.temporary) {
      box.innerHTML =
        `<div class="recent-empty">Temporary Chat is not saved.</div>`;
      return;
    }

    let chats = [...state.chats].sort(
      (a, b) =>
        Number(b.pinned) - Number(a.pinned) ||
        b.updated - a.updated
    );

    if (filter) {
      const query = filter.toLowerCase();

      chats = chats.filter(chat =>
        chat.title.toLowerCase().includes(query) ||
        chat.messages.some(message =>
          message.text.toLowerCase().includes(query)
        )
      );
    }

    if (!chats.length) {
      box.innerHTML =
        `<div class="recent-empty">No recent chats yet.</div>`;
      return;
    }

    box.innerHTML = chats.map(chat => `
      <div
        class="recent-chat ${chat.id === state.activeId ? "active" : ""}"
        data-chat="${chat.id}">

        <button
          type="button"
          class="recent-open"
          data-open="${chat.id}">
          <span>
            ${chat.pinned ? "📌 " : ""}
            ${esc(chat.title)}
          </span>
        </button>

        <button
          type="button"
          class="recent-more"
          data-more="${chat.id}">
          ⋮
        </button>

      </div>
    `).join("");
  }

  function render() {
    renderMessages();
    renderRecents();
    updateLanguageUI();
    updateVoiceUI();
    updateTemporaryUI();
    updateFilePreview();
  }

  function updateLanguageUI() {
    $$("[data-language-label]").forEach(element => {
      element.textContent = state.language.toUpperCase();
    });

    $$("select[data-language]").forEach(select => {
      if (!select.options.length) {
        select.innerHTML = LANGUAGES.map(([name, code]) =>
          `<option value="${code}">${name}</option>`
        ).join("");
      }

      select.value = state.language;
    });
  }

  function updateVoiceUI() {
    $$("[data-voice-mode]").forEach(button => {
      button.classList.toggle("active", state.voiceMode);
      button.setAttribute(
        "aria-pressed",
        String(state.voiceMode)
      );
    });

    const mic = $("#micButton");

    if (mic) {
      mic.classList.toggle("active", state.listening);
    }

    $$("[data-mic]").forEach(button => {
      button.classList.toggle("active", state.listening);
    });
  }

  function updateTemporaryUI() {
    const checkbox = $("#temporaryChat");

    if (checkbox) {
      checkbox.checked = state.temporary;
    }

    $$("[data-temporary]").forEach(element => {
      if (element.matches("input")) {
        element.checked = state.temporary;
      }

      element.classList.toggle(
        "active",
        state.temporary
      );
    });
  }

  function inputBox() {
    return (
      $("#messageInput") ||
      $("textarea") ||
      $("input[name='message']")
    );
  }

  function sendButton() {
    return (
      $("[data-send]") ||
      $("#sendButton") ||
      $(".send-button")
    );
  }

  async function sendMessage() {
    const input = inputBox();

    if (!input) return;

    const text = input.value.trim();

    if (!text && !state.selectedFiles.length) {
      return;
    }

    const files = await prepareFiles();

    input.value = "";
    input.style.height = "auto";

    addMessage(
      "user",
      text || "Please analyze the attached file/image.",
      { files }
    );

    const chat = getChat();

    showTyping(true);

    try {
      const result = await requestAI({
        message: text,
        language: state.language,
        chat,
        files
      });

      const answer =
        result?.text ||
        result?.response ||
        result?.message ||
        "I received your message.";

      addMessage("assistant", answer);

      if (state.voiceMode) {
        speak(answer);
      }

    } catch (error) {
      console.error("Global AI Mahlet:", error);

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
      The frontend intentionally does NOT invent
      a Cloudflare Workers AI endpoint.

      We will connect this function to your actual
      Cloudflare Worker after the backend is created.
    */

    const endpoint =
      document.body.dataset.aiEndpoint ||
      window.GLOBAL_AI_ENDPOINT ||
      "/api/chat";

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: payload.message,
        language: payload.language,
        messages: payload.chat?.messages || [],
        files: payload.files || []
      })
    });

    if (!response.ok) {
      throw new Error(
        "AI request failed: " + response.status
      );
    }

    const contentType =
      response.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      return await response.json();
    }

    return {
      text: await response.text()
    };
  }

  function showTyping(show) {
    const box =
      $("#messages") ||
      $(".messages") ||
      $("#chatMessages");

    if (!box) return;

    const old = box.querySelector(".typing");

    if (old) {
      old.remove();
    }

    if (show) {
      box.insertAdjacentHTML(
        "beforeend",
        `
        <div class="message ai-message typing">
          <div class="message-bubble">
            Thinking<span>.</span><span>.</span><span>.</span>
          </div>
        </div>
        `
      );

      box.scrollTop = box.scrollHeight;
    }
  }

  async function prepareFiles() {
    const output = [];

    for (const file of state.selectedFiles) {
      const item = {
        name: file.name,
        type: file.type,
        size: file.size
      };

      if (file.type.startsWith("image/")) {
        item.preview = await fileToDataURL(file);
      }

      output.push(item);
    }

    return output;
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
    if (!files) return;

    const incoming = [...files];

    state.selectedFiles.push(...incoming);

    updateFilePreview();
  }

  function updateFilePreview() {
    const box =
      $("#filePreview") ||
      $(".file-preview");

    if (!box) return;

    box.innerHTML = state.selectedFiles.map((file, index) => `
      <div class="file-chip">
        <span>
          ${file.type.startsWith("image/") ? "🖼️" : "📎"}
          ${esc(file.name)}
        </span>

        <button
          type="button"
          data-remove-file="${index}">
          ×
        </button>
      </div>
    `).join("");
  }

  function speak(text) {
    if (!("speechSynthesis" in window)) {
      return;
    }

    speechSynthesis.cancel();

    const utterance =
      new SpeechSynthesisUtterance(text);

    utterance.lang = state.language;
    utterance.rate = 1;
    utterance.pitch = 1;

    speechSynthesis.speak(utterance);
  }

  function setupRecognition() {
    const Recognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    if (!Recognition) {
      return null;
    }

    const recognition = new Recognition();

    recognition.lang = state.language;
    recognition.continuous = state.voiceMode;
    recognition.interimResults = false;

    recognition.onstart = () => {
      state.listening = true;
      updateVoiceUI();
    };

    recognition.onend = () => {
      state.listening = false;
      updateVoiceUI();

      if (state.voiceMode) {
        try {
          recognition.start();
        } catch {}
      }
    };

    recognition.onerror = event => {
      console.warn(
        "Speech recognition:",
        event.error
      );

      state.listening = false;
      updateVoiceUI();
    };

    recognition.onresult = event => {
      const transcript = [...event.results]
        .map(result => result[0].transcript)
        .join(" ");

      const input = inputBox();

      if (input) {
        input.value = transcript;
      }

      if (state.voiceMode) {
        sendMessage();
      }
    };

    return recognition;
  }

  function toggleVoiceMode() {
    state.voiceMode = !state.voiceMode;

    if (state.voiceMode) {
      state.recognition = setupRecognition();

      if (state.recognition) {
        try {
          state.recognition.start();
        } catch {}
      }

      addMessage(
        "assistant",
        "Voice mode is on 🎙️. You can speak naturally, and I'll respond by voice. You can interrupt me at any time."
      );

    } else {
      if (state.recognition) {
        try {
          state.recognition.stop();
        } catch {}
      }

      if ("speechSynthesis" in window) {
        speechSynthesis.cancel();
      }

      state.listening = false;

      updateVoiceUI();
    }
  }

  function toggleMic() {
    if (!state.recognition) {
      state.recognition = setupRecognition();
    }

    if (!state.recognition) {
      alert(
        "Voice input is not supported by this browser."
      );
      return;
    }

    if (state.listening) {
      try {
        state.recognition.stop();
      } catch {}

    } else {
      state.recognition.lang = state.language;

      try {
        state.recognition.start();
      } catch {}
    }
  }

  function setupLanguage() {
    $$("select[data-language]").forEach(select => {
      select.addEventListener("change", () => {
        state.language = select.value;

        localStorage.setItem(
          LANG_KEY,
          state.language
        );

        if (state.recognition) {
          state.recognition.lang =
            state.language;
        }

        updateLanguageUI();
      });
    });
  }

  function setupInput() {
    const input = inputBox();

    if (!input) return;

    input.addEventListener("keydown", event => {
      if (
        event.key === "Enter" &&
        !event.shiftKey
      ) {
        event.preventDefault();
        sendMessage();
      }
    });

    input.addEventListener("input", () => {
      input.style.height = "auto";

      input.style.height =
        Math.min(
          input.scrollHeight,
          160
        ) + "px";
    });
  }

  function setupActions() {
    /*
      One global click handler for dynamically created
      chat controls.
    */

    document.addEventListener(
      "click",
      async event => {

        const target =
          event.target.closest(
            "button,[data-open],[data-more]"
          );

        if (!target) return;

        /* SEND */
        if (
          target.matches("[data-send]") ||
          target.id === "sendButton" ||
          target.classList.contains("send-button")
        ) {
          event.preventDefault();
          await sendMessage();
          return;
        }

        /* MICROPHONE */
        if (
          target.matches("[data-mic]") ||
          target.id === "micButton"
        ) {
          event.preventDefault();
          toggleMic();
          return;
        }

        /* SPEAKER */
        if (target.matches("[data-speak]")) {
          const chat = getChat();

          const message =
            chat.messages.find(
              item =>
                item.id ===
                target.dataset.speak
            );

          if (message) {
            speak(message.text);
          }

          return;
        }

        /* SHARE */
        if (target.matches("[data-share]")) {
          const chat = getChat();

          const message =
            chat.messages.find(
              item =>
                item.id ===
                target.dataset.share
            );

          if (!message) return;

          if (navigator.share) {
            try {
              await navigator.share({
                title: "Global AI Mahlet",
                text: message.text
              });
            } catch {}
          } else if (
            navigator.clipboard
          ) {
            try {
              await navigator.clipboard.writeText(
                message.text
              );

              if (window.showToast) {
                window.showToast(
                  "Message copied."
                );
              } else {
                alert("Message copied.");
              }
            } catch {}
          }

          return;
        }

        /* OPEN RECENT CHAT */
        if (target.matches("[data-open]")) {
          event.preventDefault();

          const id =
            target.dataset.open;

          const chat =
            state.chats.find(
              item => item.id === id
            );

          if (!chat) return;

          state.activeId = id;

          render();

          return;
        }

        /* RECENT CHAT MENU */
        if (target.matches("[data-more]")) {
          event.preventDefault();

          recentMenu(
            target.dataset.more
          );

          return;
        }

        /* REMOVE SELECTED FILE */
        if (
          target.matches(
            "[data-remove-file]"
          )
        ) {
          event.preventDefault();

          const index =
            Number(
              target.dataset.removeFile
            );

          state.selectedFiles.splice(
            index,
            1
          );

          updateFilePreview();

          return;
        }
      }
    );

    /* CHECKBOXES ONLY */
    document.addEventListener(
      "change",
      event => {
        const element =
          event.target;

        if (
          element.id ===
            "temporaryChat" ||
          element.matches(
            "[data-temporary]"
          )
        ) {
          state.temporary =
            element.checked;

          if (state.temporary) {
            state.tempChat = null;
            state.activ
