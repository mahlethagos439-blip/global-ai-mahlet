const $ = id => document.getElementById(id);

const input = $("user-input");
const send = $("send-button");
const chat = $("chat-messages");

const photo = $("photo-button");
const photoIn = $("photo-input");

const file = $("file-button");
const fileIn = $("file-input");

const camera = $("camera-button");
const cameraIn = $("camera-input");

const voice = $("voice-button");
const temp = $("temporary-chat-button");

const newChat = $("new-chat-button");
const menu = $("menu-button");

const sidebar = $("sidebar");
const search = $("recent-search");
const recent = $("recent-chats");

const lang = $("language-select");
const welcome = $("welcome");
const typing = $("typing-indicator");

let messages = [];
let busy = false;
let tempChat = false;
let voiceMode = false;
let recognition = null;

let language = localStorage.getItem("globalLanguage") || "English";

let chats = [];

try {
  chats = JSON.parse(localStorage.getItem("globalChats") || "[]");
  if (!Array.isArray(chats)) chats = [];
} catch {
  chats = [];
}


/* =========================
   LANGUAGE
========================= */

if (lang) {
  lang.value = language;

  if (lang.value !== language) {
    language = lang.options[0]?.value || "English";
    lang.value = language;
  }

  lang.addEventListener("change", () => {
    language = lang.value;
    localStorage.setItem("globalLanguage", language);

    if (recognition) {
      recognition.lang = getSpeechLanguage();
    }
  });
}


/* =========================
   SAFE HTML
========================= */

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, character => {
    const map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };

    return map[character];
  });
}


/* =========================
   DISPLAY MESSAGES
========================= */

function addMessage(role, text) {
  const message = document.createElement("div");

  message.className =
    "message " +
    (role === "user" ? "user-message" : "assistant-message");

  if (role === "assistant") {
    message.innerHTML = `
      <div class="avatar">🤖</div>
      <div class="message-content">
        <div class="message-name">Global AI Mahlet</div>
        <div class="message-text"></div>
      </div>
    `;

    message.querySelector(".message-text").textContent = text;
  } else {
    message.innerHTML = `
      <div class="message-content">
        <div class="message-name">You</div>
        <div class="message-text"></div>
      </div>
    `;

    message.querySelector(".message-text").textContent = text;
  }

  chat?.appendChild(message);

  if (chat) {
    chat.scrollTop = chat.scrollHeight;
  }

  return message;
}


/* =========================
   NEW CHAT
========================= */

function clearChat() {
  messages = [];

  if (chat) {
    chat.innerHTML = "";
  }

  const newWelcome = document.createElement("div");

  newWelcome.className = "welcome";
  newWelcome.id = "welcome";

  newWelcome.innerHTML = `
    <div class="welcome-icon">🤖</div>
    <h1>Welcome to Global AI Mahlet</h1>
    <p>Ask questions, learn, practice, create, code, and explore.</p>
  `;

  chat?.appendChild(newWelcome);

  input.value = "";
  input.style.height = "auto";
  input.focus();

  if (sidebar) {
    sidebar.classList.remove("open");
  }
}


/* =========================
   CHAT TITLE
========================= */

function getChatTitle() {
  const firstUserMessage = messages.find(
    message => message.role === "user"
  );

  if (!firstUserMessage) {
    return "New Chat";
  }

  let title = firstUserMessage.content
    .replace(/\s+/g, " ")
    .trim();

  if (!title) {
    return "New Chat";
  }

  return title.slice(0, 45);
}


/* =========================
   SAVE CHAT
========================= */

function saveChat() {
  if (tempChat || messages.length === 0) {
    return;
  }

  const title = getChatTitle();

  const item = {
    title: title,
    messages: messages
  };

  const existingIndex = chats.findIndex(
    chatItem => chatItem.title === title
  );

  if (existingIndex >= 0) {
    chats[existingIndex] = item;
  } else {
    chats.unshift(item);
  }

  chats = chats.slice(0, 30);

  localStorage.setItem(
    "globalChats",
    JSON.stringify(chats)
  );

  displayRecentChats();
}


/* =========================
   RECENT CHATS
========================= */

function displayRecentChats(filter = "") {
  if (!recent) {
    return;
  }

  recent.innerHTML = "";

  const searchText = String(filter).toLowerCase();

  chats
    .filter(item =>
      String(item.title).toLowerCase().includes(searchText)
    )
    .forEach(item => {
      const button = document.createElement("button");

      button.type = "button";
      button.className = "recent-chat";
      button.textContent = item.title;

      button.addEventListener("click", () => {
        messages = Array.isArray(item.messages)
          ? item.messages
          : [];

        chat.innerHTML = "";

        messages.forEach(message => {
          addMessage(message.role, message.content);
        });

        sidebar?.classList.remove("open");
      });

      recent.appendChild(button);
    });
}


/* =========================
   RECENT CHAT SEARCH
========================= */

search?.addEventListener("input", () => {
  displayRecentChats(search.value);
});


/* =========================
   NEW CHAT BUTTON
========================= */

newChat?.addEventListener("click", clearChat);


/* =========================
   MOBILE MENU
========================= */

menu?.addEventListener("click", () => {
  sidebar?.classList.add("open");
});


/* =========================
   TEMPORARY CHAT
========================= */

temp?.addEventListener("click", () => {
  tempChat = !tempChat;

  temp.classList.toggle("active", tempChat);

  if (tempChat) {
    temp.title = "Temporary Chat ON";
  } else {
    temp.title = "Temporary Chat";
  }
});


/* =========================
   TEXT AI
========================= */

async function sendMessage(text) {
  if (!text || busy) {
    return;
  }

  busy = true;

  input.disabled = true;
  send.disabled = true;

  messages.push({
    role: "user",
    content: text
  });

  addMessage("user", text);

  typing?.classList.add("visible");

  const assistantElement = addMessage(
    "assistant",
    "AI is thinking..."
  );

  const textElement =
    assistantElement.querySelector(".message-text");

  let answer = "";

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messages: [
          {
            role: "system",
            content:
              "You are Global AI Mahlet, a helpful multilingual AI assistant and study tutor. " +
              "Help students with Mathematics, Physics, Chemistry, Biology, Computer Science, " +
              "coding, study plans, writing, general questions, and learning. " +
              "Explain difficult ideas clearly and step by step. " +
              "Help users understand their mistakes instead of only giving answers. " +
              "Be accurate, respectful, encouraging, and practical. " +
              "Reply in " +
              language +
              "."
          },
          ...messages
        ]
      })
    });

    if (!response.ok) {
      throw new Error("AI request failed");
    }

    if (!response.body) {
      throw new Error("AI response has no body");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    let buffer = "";

    while (true) {
      const result = await reader.read();

      if (result.done) {
        break;
      }

      buffer += decoder.decode(result.value, {
        stream: true
      });

      const lines = buffer.split("\n");

      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();

        if (!trimmed.startsWith("data:")) {
          continue;
        }

        const raw = trimmed.slice(5).trim();

        if (!raw || raw === "[DONE]") {
          continue;
        }

        try {
          const data = JSON.parse(raw);

          const part =
            data.response ||
            data.text ||
            data.content ||
            data.result ||
            "";

          if (typeof part === "string") {
            answer += part;
          }
        } catch {
          // Ignore incomplete streaming chunks.
        }
      }

      if (textElement) {
        textElement.textContent =
          answer || "AI is thinking...";
      }

      if (chat) {
        chat.scrollTop = chat.scrollHeight;
      }
    }

    if (!answer.trim()) {
      answer =
        "I couldn't generate a response. Please try again.";
    }

  } catch (error) {
    console.error("Global AI Mahlet chat error:", error);

    answer =
      "Sorry, I couldn't connect to the AI. Please try again.";
  }

  if (textElement) {
    textElement.textContent = answer;
  }

  messages.push({
    role: "assistant",
    content: answer
  });

  saveChat();

  typing?.classList.remove("visible");

  busy = false;
  input.disabled = false;
  send.disabled = false;

  input.focus();

  if (voiceMode && answer) {
    speak(answer, listen);
  }
}


/* =========================
   SEND BUTTON
========================= */

send?.addEventListener("click", () => {
  const text = input.value.trim();

  if (!text || busy) {
    return;
  }

  input.value = "";
  input.style.height = "auto";

  sendMessage(text);
});


/* =========================
   ENTER TO SEND
========================= */

input?.addEventListener("keydown", event => {
  if (
    event.key === "Enter" &&
    !event.shiftKey
  ) {
    event.preventDefault();
    send.click();
  }
});


/* =========================
   AUTO RESIZE INPUT
========================= */

input?.addEventListener("input", () => {
  input.style.height = "auto";

  input.style.height =
    Math.min(input.scrollHeight, 180) + "px";
});


/* =========================
   IMAGE READER
========================= */

function readImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      resolve(reader.result);
    };

    reader.onerror = () => {
      reject(new Error("Could not read image"));
    };

    reader.readAsDataURL(file);
  });
}


/* =========================
   REAL IMAGE / VISION AI
========================= */

async function analyzeImage(file, type) {
  if (!file || busy) {
    return;
  }

  busy = true;

  const label =
    type === "camera"
      ? "📸 Camera image"
      : "🖼️ Photo";

  addMessage(
    "user",
    label + ": " + file.name
  );

  typing?.classList.add("visible");

  const assistantElement = addMessage(
    "assistant",
    "Analyzing image..."
  );

  const textElement =
    assistantElement.querySelector(".message-text");

  try {
    const imageData = await readImage(file);

    const response = await fetch("/api/vision", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        image: imageData,
        prompt:
          "Analyze this image carefully. " +
          "Read visible text accurately. " +
          "If it contains a school question, solve it step by step. " +
          "If it contains mathematics, physics, chemistry, biology, " +
          "or another educational problem, explain the solution clearly. " +
          "Do not invent information that is not visible. " +
          "Reply in " +
          language +
          "."
      })
    });

    if (!response.ok) {
      throw new Error("Vision request failed");
    }

    const data = await response.json();

    const answer =
      data.response ||
      data.text ||
      data.content ||
      data.result ||
      "I couldn't understand this image.";

    textElement.textContent = answer;

    messages.push({
      role: "user",
      content: "[" + type + " image: " + file.name + "]"
    });

    messages.push({
      role: "assistant",
      content: answer
    });

    saveChat();

  } catch (error) {
    console.error(
      "Global AI Mahlet vision error:",
      error
    );

    textElement.textContent =
      "I couldn't understand that image. Please try another image.";
  }

  typing?.classList.remove("visible");

  busy = false;

  input.disabled = false;
  send.disabled = false;

  input.focus();
}


/* =========================
   PHOTO BUTTON
========================= */

photo?.addEventListener("click", () => {
  photoIn?.click();
});

photoIn?.addEventListener("change", () => {
  const selectedFile = photoIn.files?.[0];

  if (selectedFile) {
    analyzeImage(selectedFile, "photo");
  }

  photoIn.value = "";
});


/* =========================
   CAMERA BUTTON
========================= */

camera?.addEventListener("click", () => {
  if (cameraIn) {
    cameraIn.setAttribute(
      "capture",
      "environment"
    );

    cameraIn.click();
  }
});

cameraIn?.addEventListener("change", () => {
  const selectedFile = cameraIn.files?.[0];

  if (selectedFile) {
    analyzeImage(selectedFile, "camera");
  }

  cameraIn.value = "";
});


/* =========================
   FILE BUTTON
========================= */

file?.addEventListener("click", () => {
  fileIn?.click();
});


/* =========================
   TEXT FILE SUPPORT
========================= */

fileIn?.addEventListener("change", async () => {
  const selectedFile = fileIn.files?.[0];

  if (!selectedFile) {
    return;
  }

  const name = selectedFile.name.toLowerCase();

  const isTextFile =
    selectedFile.type.startsWith("text/") ||
    /\.(txt|csv|json|md)$/i.test(name);

  if (isTextFile) {
    try {
      const text = await selectedFile.text();

      input.value =
        "Please analyze this file:\n\n" +
        text.slice(0, 12000);

      input.focus();

    } catch {
      addMessage(
        "assistant",
        "I couldn't read that file."
      );
    }

  } else {
    addMessage(
      "user",
      "📎 File selected: " +
      selectedFile.name
    );

    addMessage(
      "assistant",
      "I received the file. Full PDF/DOCX document analysis is not connected yet. Please use a text file, or send an image of the document."
    );
  }

  fileIn.value = "";
});


/* =========================
   SPEECH LANGUAGE
========================= */

function getSpeechLanguage() {
  const speechLanguages = {
    English: "en-US",
    Amharic: "am-ET",
    Arabic: "ar-SA",
    French: "fr-FR",
    Spanish: "es-ES",
    Portuguese: "pt-BR",
    German: "de-DE",
    Italian: "it-IT",
    Russian: "ru-RU",
    Chinese: "zh-CN",
    Japanese: "ja-JP",
    Korean: "ko-KR",
    Hindi: "hi-IN",
    Urdu: "ur-PK",
    Bengali: "bn-BD",
    Turkish: "tr-TR",
    Dutch: "nl-NL",
    Swahili: "sw-KE",
    Somali: "so-SO",
    Oromo: "om-ET",
    Tigrinya: "ti-ET"
  };

  return speechLanguages[language] || "en-US";
}


/* =========================
   TEXT TO SPEECH
========================= */

function speak(text, whenFinished) {
  if (!("speechSynthesis" in window)) {
    whenFinished?.();
    return;
  }

  speechSynthesis.cancel();

  const utterance =
    new SpeechSynthesisUtterance(
      String(text).slice(0, 5000)
    );

  utterance.lang = getSpeechLanguage();

  utterance.onend = () => {
    whenFinished?.();
  };

  speechSynthesis.speak(utterance);
}


/* =========================
   VOICE LISTENING
========================= */

function listen() {
  if (
    !voiceMode ||
    busy ||
    !recognition
  ) {
    return;
  }

  try {
    recognition.start();
  } catch {
    // Recognition may already be running.
  }
}


/* =========================
   START VOICE MODE
========================= */

function startVoice() {
  const SpeechRecognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    alert(
      "Voice recognition is not supported by this browser."
    );
    return;
  }

  if (!recognition) {
    recognition = new SpeechRecognition();

    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.lang = getSpeechLanguage();

    recognition.onresult = event => {
      const spokenText =
        event.results[0][0].transcript;

      if (spokenText) {
        sendMessage(spokenText);
      }
    };

    recognition.onerror = event => {
      console.log(
        "Voice recognition:",
        event.error
      );
    };

    recognition.onend = () => {
      if (
        voiceMode &&
        !busy
      ) {
        setTimeout(listen, 600);
      }
    };
  }

  recognition.lang = getSpeechLanguage();

  voiceMode = true;

  voice?.classList.add("active");

  const greetings = [
    "Hello! I'm ready. What would you like to learn today?",
    "Hi! I'm listening. What can I help you with?",
    "Hello! Ask me anything and let's learn together.",
    "Hi! Tell me what you would like help with.",
    "Hello! Your Global AI Mahlet assistant is ready."
  ];

  const randomGreeting =
    greetings[
      Math.floor(
        Math.random() * greetings.length
      )
    ];

  speak(randomGreeting, listen);
}


/* =========================
   STOP VOICE MODE
========================= */

function stopVoice() {
  voiceMode = false;

  voice?.classList.remove("active");

  try {
    recognition?.stop();
  } catch {}

  if ("speechSynthesis" in window) {
    speechSynthesis.cancel();
  }
}


/* =========================
   VOICE BUTTON
========================= */

voice?.addEventListener("click", () => {
  if (voiceMode) {
    stopVoice();
  } else {
    startVoice();
  }
});


/* =========================
   STARTUP
========================= */

displayRecentChats();

console.log(
  "Global AI Mahlet loaded successfully."
);
