(() => {
  "use strict";

  const $ = id => document.getElementById(id);

  const input = $("user-input");
  const send = $("send-button");
  const chat = $("chat-messages");
  const welcome = $("welcome");
  const typing = $("typing-indicator");
  const photoBtn = $("photo-button");
  const photoInput = $("photo-input");
  const fileBtn = $("file-button");
  const fileInput = $("file-input");
  const cameraBtn = $("camera-button");
  const cameraInput = $("camera-input");
  const voiceBtn = $("voice-button");
  const tempBtn = $("temporary-chat-button");
  const newChatBtn = $("new-chat-button");
  const search = $("recent-search");
  const recent = $("recent-chats");
  const language = $("language-select");
  const menu = $("menu-button");
  const sidebar = $("sidebar");
  const fileName = $("file-name");

  const CHAT_KEY = "global_ai_mahlet_chats_v1";
  const LANG_KEY = "global_ai_mahlet_language_v1";

  let messages = [];
  let temporary = false;
  let selectedFile = null;
  let recognition = null;
  let listening = false;

  const languages = {
    English:"en-US", Amharic:"am-ET", Arabic:"ar-SA",
    Chinese:"zh-CN", Spanish:"es-ES", French:"fr-FR",
    Portuguese:"pt-PT", Russian:"ru-RU", German:"de-DE",
    Italian:"it-IT", Japanese:"ja-JP", Korean:"ko-KR",
    Hindi:"hi-IN", Urdu:"ur-PK", Bengali:"bn-BD",
    Turkish:"tr-TR", Dutch:"nl-NL", Swedish:"sv-SE",
    Norwegian:"no-NO", Danish:"da-DK", Finnish:"fi-FI",
    Polish:"pl-PL", Ukrainian:"uk-UA", Greek:"el-GR",
    Hebrew:"he-IL", Persian:"fa-IR", Swahili:"sw-KE",
    Hausa:"ha-NG", Yoruba:"yo-NG", Igbo:"ig-NG",
    Somali:"so-SO", Oromo:"om-ET", Tigrinya:"ti-ET",
    Vietnamese:"vi-VN", Thai:"th-TH", Indonesian:"id-ID",
    Malay:"ms-MY", Filipino:"fil-PH", Romanian:"ro-RO",
    Czech:"cs-CZ", Slovak:"sk-SK", Hungarian:"hu-HU",
    Bulgarian:"bg-BG", Serbian:"sr-RS", Croatian:"hr-HR",
    Slovenian:"sl-SI", Lithuanian:"lt-LT", Latvian:"lv-LV",
    Estonian:"et-EE", Icelandic:"is-IS"
  };

  function getChats() {
    try {
      return JSON.parse(localStorage.getItem(CHAT_KEY)) || [];
    } catch {
      return [];
    }
  }

  function saveCurrentChat() {
    if (temporary || !messages.length) return;

    try {
      const chats = getChats();
      const first = messages.find(m => m.role === "user");
      const title = first
        ? first.content.replace(/\s+/g, " ").slice(0, 60)
        : "New chat";

      chats.unshift({
        id: Date.now().toString(),
        title,
        messages: messages.map(m => ({
          role: m.role,
          content: m.content
        })),
        createdAt: new Date().toISOString()
      });

      localStorage.setItem(
        CHAT_KEY,
        JSON.stringify(chats.slice(0, 50))
      );

      renderRecent();
    } catch (e) {
      console.error(e);
    }
  }

  function renderRecent(filter = "") {
    recent.innerHTML = "";

    const chats = getChats().filter(c =>
      String(c.title || "")
        .toLowerCase()
        .includes(filter.toLowerCase())
    );

    if (!chats.length) {
      const empty = document.createElement("div");
      empty.textContent = "No recent chats";
      empty.style.cssText =
        "padding:10px;color:#777;font-size:13px";
      recent.appendChild(empty);
      return;
    }

    chats.forEach(item => {
      const el = document.createElement("div");
      el.className = "recent-chat";
      el.textContent = item.title || "New chat";
      el.title = el.textContent;

      el.onclick = () => {
        loadChat(item);
        sidebar.classList.remove("open");
      };

      recent.appendChild(el);
    });
  }

  function loadChat(item) {
    messages = Array.isArray(item.messages)
      ? item.messages.map(m => ({
          role: m.role,
          content: m.content
        }))
      : [];

    chat.innerHTML = "";

    if (!messages.length) {
      showWelcome();
      return;
    }

    welcome.style.display = "none";

    messages.forEach(m => {
      addMessage(
        m.role === "user" ? "You" : "Global AI Mahlet",
        m.content,
        m.role === "user"
      );
    });

    bottom();
  }

  function showWelcome() {
    chat.innerHTML = "";
    welcome.style.display = "block";
    chat.appendChild(welcome);
    chat.appendChild(typing);
    typing.style.display = "none";
  }

  function addMessage(name, text, user) {
    const box = document.createElement("div");
    box.className =
      "message " +
      (user ? "user-message" : "assistant-message");

    const avatar = document.createElement("div");
    avatar.className = "avatar";
    avatar.textContent = user ? "👤" : "🤖";

    const content = document.createElement("div");
    content.className = "message-content";

    const title = document.createElement("div");
    title.className = "message-name";
    title.textContent = name;

    const body = document.createElement("div");
    body.className = "message-text";
    body.textContent = text;

    content.append(title, body);
    box.append(avatar, content);
    chat.appendChild(box);

    return body;
  }

  function createAssistant() {
    welcome.style.display = "none";

    const box = document.createElement("div");
    box.className = "message assistant-message";

    const avatar = document.createElement("div");
    avatar.className = "avatar";
    avatar.textContent = "🤖";

    const content = document.createElement("div");
    content.className = "message-content";

    const title = document.createElement("div");
    title.className = "message-name";
    title.textContent = "Global AI Mahlet";

    const body = document.createElement("div");
    body.className = "message-text";

    content.append(title, body);
    box.append(avatar, content);
    chat.appendChild(box);

    return body;
  }

  function bottom() {
    chat.scrollTop = chat.scrollHeight;
  }

  function busy(value) {
    send.disabled = value;
    send.style.opacity = value ? ".6" : "1";
    typing.style.display = value ? "block" : "none";
    bottom();
  }

  function addUser(text) {
    messages.push({
      role: "user",
      content: text
    });

    welcome.style.display = "none";
    addMessage("You", text, true);
    bottom();
  }

  async function sendMessage() {
    const text = input.value.trim();

    if (!text || send.disabled) return;

    input.value = "";
    input.style.height = "auto";

    addUser(text);

    const selectedLanguage =
      language.value || "English";

    const aiMessages = [
      {
        role: "system",
        content:
          "You are Global AI Mahlet, a helpful multilingual AI assistant and study tutor. " +
          "Respond in " + selectedLanguage + ". " +
          "Help with Mathematics, Physics, Chemistry, Biology, Computer Science, programming, writing, study plans and general questions. " +
          "Explain difficult concepts clearly and step by step. " +
          "Be accurate, respectful and suitable for the user's level."
      },
      ...messages
    ];

    busy(true);

    const answerBox = createAssistant();

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          messages: aiMessages
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(
          "Server error " +
          response.status +
          ": " +
          error.slice(0, 200)
        );
      }

      if (!response.body) {
        throw new Error("No AI response body.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let answer = "";
      let buffer = "";

      while (true) {
        const result = await reader.read();

        if (result.done) break;

        buffer += decoder.decode(
          result.value,
          { stream: true }
        );

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const part = parseStream(line);

          if (part) {
            answer += part;
            answerBox.textContent = answer;
            bottom();
          }
        }
      }

      buffer += decoder.decode();

      for (const line of buffer.split("\n")) {
        const part = parseStream(line);

        if (part) {
          answer += part;
          answerBox.textContent = answer;
        }
      }

      if (!answer.trim()) {
        throw new Error("Empty AI response.");
      }

      messages.push({
        role: "assistant",
        content: answer
      });

      saveCurrentChat();

    } catch (error) {
      console.error(
        "Global AI Mahlet error:",
        error
      );

      answerBox.textContent =
        "I couldn't connect to Global AI Mahlet right now. Please try again.";
    } finally {
      busy(false);
      bottom();
    }
  }

  function parseStream(line) {
    let data = line.trim();

    if (!data || data.startsWith(":")) return "";
    if (data.startsWith("data:")) {
      data = data.slice(5).trim();
    }

    if (!data || data === "[DONE]") return "";

    try {
      const value = JSON.parse(data);

      if (typeof value === "string") {
        return value;
      }

      if (value.response != null) {
        return String(value.response);
      }

      if (value.text != null) {
        return String(value.text);
      }

      if (value.content != null) {
        return String(value.content);
      }

      if (
        value.choices &&
        value.choices[0] &&
        value.choices[0].delta &&
        value.choices[0].delta.content
      ) {
        return String(
          value.choices[0].delta.content
        );
      }
    } catch {}

    return "";
  }

  newChatBtn.onclick = () => {
    messages = [];
    selectedFile = null;
    input.value = "";
    fileName.textContent = "";
    showWelcome();
    sidebar.classList.remove("open");
    input.focus();
  };

  menu.onclick = () => {
    sidebar.classList.toggle("open");
  };

  search.oninput = () => {
    renderRecent(search.value);
  };

  language.onchange = () => {
    try {
      localStorage.setItem(
        LANG_KEY,
        language.value
      );
    } catch {}
  };

  try {
    const savedLanguage =
      localStorage.getItem(LANG_KEY);

    if (
      savedLanguage &&
      [...language.options].some(
        o => o.value === savedLanguage
      )
    ) {
      language.value = savedLanguage;
    }
  } catch {}

  tempBtn.onclick = () => {
    temporary = !temporary;

    tempBtn.classList.toggle(
      "active",
      temporary
    );

    tempBtn.title = temporary
      ? "Temporary chat is ON"
      : "Temporary chat is OFF";

    fileName.textContent =
      temporary
        ? "Temporary chat"
        : selectedFile
          ? selectedFile.name
          : "";
  };

  input.oninput = () => {
    input.style.height = "auto";
    input.style.height =
      Math.min(input.scrollHeight, 150) + "px";
  };

  input.onkeydown = event => {
    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault();
      sendMessage();
    }
  };

  send.onclick = sendMessage;

  photoBtn.onclick = () => {
    photoInput.click();
  };

  photoInput.onchange = () => {
    const file = photoInput.files?.[0];

    if (file) handleImage(file);

    photoInput.value = "";
  };

  cameraBtn.onclick = () => {
    cameraInput.click();
  };

  cameraInput.onchange = () => {
    const file = cameraInput.files?.[0];

    if (file) handleImage(file);

    cameraInput.value = "";
  };

  async function handleImage(file) {
    if (!file.type.startsWith("image/")) {
      alert("Please select an image.");
      return;
    }

    const question =
      input.value.trim() ||
      "Analyze this image carefully. If it contains a school question, solve it step by step.";

    input.value = "";

    addUser(
      "📷 Image: " +
      file.name +
      "\n" +
      question
    );

    busy(true);

    const answerBox = createAssistant();

    try {
      const image = await readFile(file);

      const response = await fetch(
        "/api/vision",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            image,
            prompt:
              question +
              "\n\nRespond in " +
              (language.value || "English") +
              "."
          })
        }
      );

      if (!response.ok) {
        const error = await response.text();

        throw new Error(
          "Vision error " +
          response.status +
          ": " +
          error.slice(0, 200)
        );
      }

      const data = await response.json();
      const answer = getVisionText(data);

      if (!answer) {
        throw new Error("Empty vision response.");
      }

      answerBox.textContent = answer;

      messages.push({
        role: "assistant",
        content: answer
      });

      saveCurrentChat();

    } catch (error) {
      console.error(
        "Vision error:",
        error
      );

      answerBox.textContent =
        "I couldn't understand that image. Please try another image.";
    } finally {
      busy(false);
      bottom();
    }
  }

  function getVisionText(data) {
    if (!data) return "";

    if (typeof data === "string") {
      return data;
    }

    if (data.response != null) {
      return String(data.response);
    }

    if (data.text != null) {
      return String(data.text);
    }

    if (data.content != null) {
      return String(data.content);
    }

    if (
      data.result &&
      typeof data.result === "object"
    ) {
      if (data.result.response != null) {
        return String(data.result.response);
      }

      if (data.result.text != null) {
        return String(data.result.text);
      }

      if (data.result.content != null) {
        return String(data.result.content);
      }
    }

    return "";
  }

  function readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        resolve(String(reader.result));
      };

      reader.onerror = () => {
        reject(
          new Error("Could not read image.")
        );
      };

      reader.readAsDataURL(file);
    });
  }

  fileBtn.onclick = () => {
    fileInput.click();
  };

  fileInput.onchange = async () => {
    const file = fileInput.files?.[0];

    if (!file) return;

    selectedFile = file;
    fileName.textContent = file.name;

    await processFile(file);

    fileInput.value = "";
  };

  async function processFile(file) {
    const isText =
      file.type === "text/plain" ||
      file.type === "text/csv" ||
      file.type === "application/json" ||
      /\.(txt|csv|json)$/i.test(file.name);

    if (isText) {
      try {
        let text = await file.text();

        if (text.length > 12000) {
          text =
            text.slice(0, 12000) +
            "\n\n[File shortened for processing.]";
        }

        input.value =
          "I uploaded " +
          file.name +
          ". Please analyze this file:\n\n" +
          text;

        input.focus();

      } catch {
        alert("I couldn't read that file.");
      }

      return;
    }

    if (/\.pdf$/i.test(file.name)) {
      input.value =
        "I uploaded a PDF named \"" +
        file.name +
        "\". Please help me analyze it.";

      input.focus();

      alert(
        "PDF text extraction will be added to a later version."
      );

      return;
    }

    input.value =
      "I uploaded a file named \"" +
      file.name +
      "\". Please tell me how to work with it.";

    input.focus();
  }

  const SpeechRecognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;

  if (SpeechRecognition) {
    recognition =
      new SpeechRecognition();

    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      listening = true;
      voiceBtn.classList.add("active");
      voiceBtn.textContent = "🔴";
      voiceBtn.title = "Listening...";
    };

    recognition.onresult = event => {
      const result =
        event.results?.[0]?.[0];

      if (result) {
        input.value = result.transcript;
        input.dispatchEvent(
          new Event("input")
        );
      }
    };

    recognition.onerror = event => {
      console.error(
        "Voice error:",
        event.error
      );
    };

    recognition.onend = () => {
      listening = false;
      voiceBtn.classList.remove("active");
      voiceBtn.textContent = "🎤";
      voiceBtn.title = "Voice mode";
    };

    voiceBtn.onclick = () => {
      if (listening) {
        recognition.stop();
        return;
      }

      try {
        recognition.lang =
          languages[language.value] ||
          "en-US";

        recognition.start();

      } catch (error) {
        console.error(error);
      }
    };

  } else {
    voiceBtn.onclick = () => {
      alert(
        "Voice input is not supported by this browser."
      );
    };
  }

  window.globalAIMahletSpeak =
    text => {
      if (
        !("speechSynthesis" in window)
      ) {
        return;
      }

      speechSynthesis.cancel();

      const voice =
        new SpeechSynthesisUtterance(text);

      voice.lang =
        languages[language.value] ||
        "en-US";

      speechSynthesis.speak(voice);
    };

  showWelcome();
  renderRecent();

  console.log(
    "Global AI Mahlet frontend loaded."
  );
})();
