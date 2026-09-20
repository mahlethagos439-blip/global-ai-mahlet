/* Global AI Mahlet — chat.js */
(() => {
  "use strict";

  const CHAT_KEY = "global_ai_mahlet_chats_v1";
  const LANG_KEY = "global_ai_mahlet_language_v1";

  /* 100 languages */
  const LANGUAGES = [
    ["English", "en"],
    ["Amharic", "am"],
    ["Arabic", "ar"],
    ["Spanish", "es"],
    ["French", "fr"],
    ["German", "de"],
    ["Italian", "it"],
    ["Portuguese", "pt"],
    ["Russian", "ru"],
    ["Chinese", "zh"],
    ["Japanese", "ja"],
    ["Korean", "ko"],
    ["Hindi", "hi"],
    ["Bengali", "bn"],
    ["Urdu", "ur"],
    ["Turkish", "tr"],
    ["Persian", "fa"],
    ["Swahili", "sw"],
    ["Somali", "so"],
    ["Oromo", "om"],
    ["Tigrinya", "ti"],
    ["Hausa", "ha"],
    ["Yoruba", "yo"],
    ["Igbo", "ig"],
    ["Zulu", "zu"],
    ["Xhosa", "xh"],
    ["Afrikaans", "af"],
    ["Dutch", "nl"],
    ["Greek", "el"],
    ["Hebrew", "he"],
    ["Thai", "th"],
    ["Vietnamese", "vi"],
    ["Indonesian", "id"],
    ["Malay", "ms"],
    ["Filipino", "fil"],
    ["Tamil", "ta"],
    ["Telugu", "te"],
    ["Marathi", "mr"],
    ["Gujarati", "gu"],
    ["Punjabi", "pa"],
    ["Kannada", "kn"],
    ["Malayalam", "ml"],
    ["Nepali", "ne"],
    ["Sinhala", "si"],
    ["Burmese", "my"],
    ["Khmer", "km"],
    ["Lao", "lo"],
    ["Mongolian", "mn"],
    ["Kazakh", "kk"],
    ["Uzbek", "uz"],
    ["Azerbaijani", "az"],
    ["Georgian", "ka"],
    ["Armenian", "hy"],
    ["Albanian", "sq"],
    ["Serbian", "sr"],
    ["Croatian", "hr"],
    ["Bosnian", "bs"],
    ["Bulgarian", "bg"],
    ["Romanian", "ro"],
    ["Hungarian", "hu"],
    ["Czech", "cs"],
    ["Slovak", "sk"],
    ["Slovenian", "sl"],
    ["Polish", "pl"],
    ["Ukrainian", "uk"],
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
    ["Catalan", "ca"],
    ["Basque", "eu"],
    ["Galician", "gl"],
    ["Macedonian", "mk"],
    ["Maltese", "mt"],
    ["Pashto", "ps"],
    ["Kurdish", "ku"],
    ["Samoan", "sm"],
    ["Tongan", "to"],
    ["Maori", "mi"],
    ["Haitian Creole", "ht"],
    ["Latin", "la"],
    ["Esperanto", "eo"],
    ["Luxembourgish", "lb"],
    ["Belarusian", "be"],
    ["Tajik", "tg"],
    ["Turkmen", "tk"],
    ["Kyrgyz", "ky"],
    ["Sundanese", "su"],
    ["Filipino", "fil"],
    ["Fijian", "fj"],
    ["Malagasy", "mg"],
    ["Yiddish", "yi"],
    ["Aramaic", "arc"],
    ["Lingala", "ln"],
    ["Kinyarwanda", "rw"],
    ["Chichewa", "ny"],
    ["Sesotho", "st"],
    ["Tswana", "tn"],
    ["Shona", "sn"],
    ["Amharic", "am"]
  ];

  const $ = selector =>
    document.querySelector(selector);

  const $$ = selector =>
    [...document.querySelectorAll(selector)];

  const state = {
    chats: loadChats(),
    activeId: null,
    temporary: false,
    tempChat: null,
    language:
      localStorage.getItem(LANG_KEY) || "en",
    selectedFiles: [],
    recognition: null,
    listening: false
  };

  /* =========================
     STORAGE
  ========================= */

  function loadChats() {
    try {
      const saved =
        localStorage.getItem(CHAT_KEY);

      if (!saved) {
        return [];
      }

      const data = JSON.parse(saved);

      return Array.isArray(data)
        ? data
        : [];
    } catch (error) {
      console.warn(
        "Could not load chats:",
        error
      );

      return [];
    }
  }

  function saveChats() {
    try {
      localStorage.setItem(
        CHAT_KEY,
        JSON.stringify(state.chats)
      );
    } catch (error) {
      console.warn(
        "Could not save chats:",
        error
      );
    }
  }

  function makeId() {
    return (
      Date.now().toString(36) +
      Math.random()
        .toString(36)
        .slice(2)
    );
  }

  /* =========================
     DOM HELPERS
  ========================= */

  function getInput() {
    return (
      $("#messageInput") ||
      $("#message") ||
      $("textarea") ||
      $("input[type='text']")
    );
  }

  function getMessagesBox() {
    return (
      $("#messages") ||
      $("#chatMessages") ||
      $(".messages") ||
      $(".chat-messages")
    );
  }

  function getFileInput() {
    return (
      $("#fileInput") ||
      $("#imageInput") ||
      $("input[type='file']")
    );
  }

  /* =========================
     CHAT MANAGEMENT
  ========================= */

  function getActiveChat() {
    if (state.temporary) {
      return state.tempChat;
    }

    return (
      state.chats.find(
        chat =>
          chat.id === state.activeId
      ) || null
    );
  }

  function newChat() {
    const chat = {
      id: makeId(),
      title: "New chat",
      messages: [],
      createdAt: Date.now()
    };

    if (state.temporary) {
      state.tempChat = chat;
    } else {
      state.chats.unshift(chat);
      saveChats();
    }

    state.activeId = chat.id;

    render();
  }

  /* =========================
     RENDER
  ========================= */

  function render() {
    renderMessages();
    renderRecentChats();
  }

  function renderMessages() {
    const box = getMessagesBox();

    if (!box) {
      return;
    }

    const chat = getActiveChat();

    if (!chat) {
      return;
    }

    box.innerHTML = "";

    chat.messages.forEach(message => {
      const wrapper =
        document.createElement("div");

      wrapper.className =
        message.role === "user"
          ? "message user-message"
          : "message ai-message";

      const content =
        document.createElement("div");

      content.className =
        "message-content";

      content.textContent =
        message.content || "";

      wrapper.appendChild(content);

      if (
        message.role === "assistant"
      ) {
        const actions =
          document.createElement("div");

        actions.className =
          "message-actions";

        /* Speaker */
        const speaker =
          document.createElement("button");

        speaker.type = "button";
        speaker.textContent = "🔊";
        speaker.title = "Speaker";
        speaker.setAttribute(
          "aria-label",
          "Speaker"
        );

        speaker.addEventListener(
          "click",
          () => {
            speak(
              message.content || ""
            );
          }
        );

        /* Share */
        const share =
          document.createElement("button");

        share.type = "button";
        share.textContent = "↗";
        share.title = "Share";
        share.setAttribute(
          "aria-label",
          "Share"
        );

        share.addEventListener(
          "click",
          () => {
            shareText(
              message.content || ""
            );
          }
        );

        actions.appendChild(speaker);
        actions.appendChild(share);

        wrapper.appendChild(actions);
      }

      box.appendChild(wrapper);
    });

    box.scrollTop = box.scrollHeight;
  }

  function renderRecentChats() {
    const box =
      $("#recentChats") ||
      $(".recent-chats");

    if (!box) {
      return;
    }

    box.innerHTML = "";

    state.chats.forEach(chat => {
      const button =
        document.createElement("button");

      button.type = "button";

      button.textContent =
        chat.title || "New chat";

      button.dataset.chatId =
        chat.id;

      button.addEventListener(
        "click",
        () => {
          state.activeId = chat.id;
          render();
        }
      );

      box.appendChild(button);
    });
  }

  /* =========================
     SEND
  ========================= */

  async function send() {
    const field = getInput();

    if (!field) {
      return;
    }

    const message =
      String(field.value || "").trim();

    if (
      !message &&
      state.selectedFiles.length === 0
    ) {
      return;
    }

    let chat = getActiveChat();

    if (!chat) {
      newChat();
      chat = getActiveChat();
    }

    if (!chat) {
      return;
    }

    const files =
      await prepareFiles();

    /*
      IMPORTANT:

      The user's text and image are stored
      together in the same request.
    */

    chat.messages.push({
      role: "user",
      content:
        message ||
        "Please analyze this image.",
      files: files
    });

    if (
      chat.title === "New chat" &&
      message
    ) {
      chat.title =
        message.length > 40
          ? message.slice(0, 40) + "..."
          : message;
    }

    saveChats();
    renderMessages();

    field.value = "";
    field.style.height = "110px";

    state.selectedFiles = [];

    clearFilePreview();

    try {
      const result =
        await requestAI({
          message: message,
          language: state.language,
          chat: chat,
          files: files
        });

      const answer =
        result?.text ||
        result?.response ||
        "I couldn't generate a response.";

      chat.messages.push({
        role: "assistant",
        content: String(answer)
      });

      saveChats();
      renderMessages();

    } catch (error) {
      console.error(
        "Global AI request error:",
        error
      );

      chat.messages.push({
        role: "assistant",
        content:
          "Sorry, I couldn't connect to the AI right now. Please try again."
      });

      saveChats();
      renderMessages();
    }
  }

  /* =========================
     AI REQUEST
  ========================= */

  async function requestAI(params) {
    const endpoint =
      document.body.dataset.aiEndpoint ||
      window.GLOBAL_AI_ENDPOINT ||
      "/api/chat";

    /*
      Find the first selected image.
    */
    const firstImage =
      (params.files || []).find(
        file =>
          file &&
          typeof file.type === "string" &&
          file.type.startsWith("image/") &&
          typeof file.preview === "string"
      );

    const image =
      firstImage?.preview || "";

    /*
      This is the important part:

      message = user's written question
      image   = user's selected image
    */

    const payload = {
      message:
        params.message || "",

      language:
        params.language || "en",

      messages:
        params.chat?.messages || [],

      files:
        params.files || []
    };

    if (image) {
      payload.image = image;
    }

    const response =
      await fetch(
        endpoint,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify(payload)
        }
      );

    if (!response.ok) {
      throw new Error(
        "AI request failed: " +
        response.status
      );
    }

    const contentType =
      response.headers.get(
        "content-type"
      ) || "";

    if (
      contentType.includes(
        "application/json"
      )
    ) {
      return await response.json();
    }

    return {
      text: await response.text()
    };
  }

  /* =========================
     IMAGE DATA
  ========================= */

  function fileToDataURL(file) {
    return new Promise(
      (resolve, reject) => {
        const reader =
          new FileReader();

        reader.onload = () => {
          resolve(reader.result);
        };

        reader.onerror = error => {
          reject(error);
        };

        reader.readAsDataURL(file);
      }
    );
  }

  async function prepareFiles() {
    const output = [];

    for (
      const file of state.selectedFiles
    ) {
      const item = {
        name: file.name,
        type: file.type,
        size: file.size
      };

      if (
        file.type &&
        file.type.startsWith("image/")
      ) {
        item.preview =
          await fileToDataURL(file);
      }

      output.push(item);
    }

    return output;
  }

  /* =========================
     FILE UPLOAD
  ========================= */

  function setupFiles() {
    const fileInput =
      getFileInput();

    if (!fileInput) {
      return;
    }

    fileInput.addEventListener(
      "change",
      () => {
        state.selectedFiles =
          [...fileInput.files];

        showFilePreview();
      }
    );
  }

  function showFilePreview() {
    const area =
      $("#filePreview") ||
      $(".file-preview");

    if (!area) {
      return;
    }

    area.innerHTML = "";

    state.selectedFiles.forEach(
      file => {
        const item =
          document.createElement("div");

        item.className =
          "selected-file";

        item.textContent =
          file.name;

        area.appendChild(item);
      }
    );
  }

  function clearFilePreview() {
    const area =
      $("#filePreview") ||
      $(".file-preview");

    if (area) {
      area.innerHTML = "";
    }
  }

  function setupFileRemove() {
    document.addEventListener(
      "click",
      event => {
        const button =
          event.target.closest(
            "[data-remove-file], .remove-file"
          );

        if (!button) {
          return;
        }

        state.selectedFiles = [];

        clearFilePreview();

        const fileInput =
          getFileInput();

        if (fileInput) {
          fileInput.value = "";
        }
      }
    );
  }

  /* =========================
     LARGE MESSAGE BOX
  ========================= */

  function setupInput() {
    const field = getInput();

    if (!field) {
      return;
    }

    if (
      field.tagName === "TEXTAREA"
    ) {
      field.style.minHeight =
        "110px";

      field.style.maxHeight =
        "320px";

      field.style.overflowY =
        "auto";

      field.style.resize =
        "vertical";
    }

    field.addEventListener(
      "keydown",
      event => {
        if (
          event.key === "Enter" &&
          !event.shiftKey
        ) {
          event.preventDefault();
          send();
        }
      }
    );

    field.addEventListener(
      "input",
      () => {
        field.style.height =
          "auto";

        field.style.height =
          Math.min(
            field.scrollHeight,
            320
          ) + "px";
      }
    );
  }

  /* =========================
     LANGUAGE
  ========================= */

  function setupLanguage() {
    const selector =
      $("#languageSelect");

    if (!selector) {
      return;
    }

    /*
      Only add options if the HTML
      does not already contain them.
    */

    if (
      selector.options.length === 0
    ) {
      LANGUAGES.forEach(
        ([name, code]) => {
          const option =
            document.createElement(
              "option"
            );

          option.value = code;
          option.textContent = name;

          selector.appendChild(
            option
          );
        }
      );
    }

    selector.value =
      state.language;

    selector.addEventListener(
      "change",
      () => {
        state.language =
          selector.value;

        localStorage.setItem(
          LANG_KEY,
          state.language
        );
      }
    );
  }

  /* =========================
     BUTTONS
  ========================= */

  function setupButtons() {
    const sendButton =
      $("#sendButton") ||
      $("#sendBtn") ||
      $("[data-action='send']");

    if (sendButton) {
      sendButton.addEventListener(
        "click",
        send
      );
    }

    const newButton =
      $("#newChat") ||
      $("#newChatButton") ||
      $("[data-action='new-chat']");

    if (newButton) {
      newButton.addEventListener(
        "click",
        newChat
      );
    }
  }

  function setupNewChat() {
    /*
      Extra support for buttons that
      use data-action.
    */
    document.addEventListener(
      "click",
      event => {
        const button =
          event.target.closest(
            "[data-action='new-chat']"
          );

        if (!button) {
          return;
        }

        newChat();
      }
    );
  }

  /* =========================
     SPEAKER
  ========================= */

  function speak(text) {
    if (
      !("speechSynthesis" in window)
    ) {
      return;
    }

    window.speechSynthesis.cancel();

    const utterance =
      new SpeechSynthesisUtterance(
        text
      );

    utterance.lang =
      state.language === "am"
        ? "am-ET"
        : state.language;

    window.speechSynthesis.speak(
      utterance
    );
  }

  /* =========================
     SHARE
  ========================= */

  async function shareText(text) {
    try {
      if (
        navigator.share
      ) {
        await navigator.share({
          text: text
        });

        return;
      }

      if (
        navigator.clipboard
      ) {
        await navigator.clipboard.writeText(
          text
        );

        alert(
          "AI response copied."
        );
      }
    } catch (error) {
      console.log(
        "Share cancelled:",
        error
      );
    }
  }

  /* =========================
     VOICE
  ========================= */

  function setupVoice() {
    const voiceButton =
      $("#voiceButton") ||
      $("#micButton") ||
      $("[data-action='voice']");

    if (!voiceButton) {
      return;
    }

    const Recognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    if (!Recognition) {
      return;
    }

    const recognition =
      new Recognition();

    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.lang =
      state.language === "am"
        ? "am-ET"
        : state.language;

    recognition.onstart = () => {
      state.listening = true;
    };

    recognition.onend = () => {
      state.listening = false;
    };

    recognition.onresult =
      event => {
        const transcript =
          event.results[0][0]
            .transcript;

        const field =
          getInput();

        if (field) {
          field.value =
            transcript;

          field.dispatchEvent(
            new Event("input")
          );
        }
      };

    voiceButton.addEventListener(
      "click",
      () => {
        try {
          if (
            state.listening
          ) {
            recognition.stop();
          } else {
            recognition.lang =
              state.language === "am"
                ? "am-ET"
                : state.language;

            recognition.start();
          }
        } catch (error) {
          console.log(error);
        }
      }
    );

    state.recognition =
      recognition;
  }

  /* =========================
     RECENT CHATS
  ========================= */

  function setupRecentChats() {
    document.addEventListener(
      "click",
      event => {
        const item =
          event.target.closest(
            "[data-chat-id]"
          );

        if (!item) {
          return;
        }

        const id =
          item.dataset.chatId;

        const chat =
          state.chats.find(
            item => item.id === id
          );

        if (!chat) {
          return;
        }

        state.activeId =
          chat.id;

        render();
      }
    );
  }

  /* =========================
     TEMPORARY CHAT
  ========================= */

  function setupTemporaryChat() {
    const checkbox =
      $("#temporaryChat");

    if (!checkbox) {
      return;
    }

    checkbox.addEventListener(
      "change",
      () => {
        state.temporary =
          checkbox.checked;

        if (
          state.temporary
        ) {
          state.tempChat = null;
          state.activeId = null;

          newChat();
        } else {
          state.tempChat = null;

          if (
            !state.chats.length
          ) {
            newChat();
          } else {
            state.activeId =
              state.chats[0].id;

            render();
         
