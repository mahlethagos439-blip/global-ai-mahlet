(() => {
"use strict";

// ============================================================
// GLOBAL AI MAHLET
// Frontend controller for the website
// ============================================================

const $ = (id) => document.getElementById(id);

const input = $("user-input");
const sendButton = $("send-button");
const chat = $("chat-messages");
const welcome = $("welcome");
const typing = $("typing-indicator");

const photoButton = $("photo-button");
const photoInput = $("photo-input");

const fileButton = $("file-button");
const fileInput = $("file-input");

const cameraButton = $("camera-button");
const cameraInput = $("camera-input");

const voiceButton = $("voice-button");
const temporaryChatButton = $("temporary-chat-button");

const newChatButton = $("new-chat-button");
const recentSearch = $("recent-search");
const recentChats = $("recent-chats");
const languageSelect = $("language-select");
const menuButton = $("menu-button");
const sidebar = $("sidebar");
const fileName = $("file-name");

const CHAT_STORAGE_KEY = "global_ai_mahlet_chats_v1";
const LANGUAGE_STORAGE_KEY = "global_ai_mahlet_language_v1";

let messages = [];
let temporaryChat = false;
let selectedFile = null;
let recognition = null;
let isListening = false;

// ------------------------------------------------------------
// Basic safety check
// ------------------------------------------------------------

const requiredElements = [
input,
sendButton,
chat,
welcome,
typing,
photoButton,
photoInput,
fileButton,
fileInput,
cameraButton,
cameraInput,
voiceButton,
temporaryChatButton,
newChatButton,
recentSearch,
recentChats,
languageSelect,
menuButton,
sidebar,
fileName
];

if (requiredElements.some((element) => !element)) {
console.error("Global AI Mahlet: one or more HTML elements are missing.");
return;
}

// ------------------------------------------------------------
// Storage
// ------------------------------------------------------------

function loadSavedChats() {
try {
const saved = localStorage.getItem(CHAT_STORAGE_KEY);
if (!saved) return [];

  const parsed = JSON.parse(saved);
  return Array.isArray(parsed) ? parsed : [];
} catch (error) {
  console.error("Could not load saved chats:", error);
  return [];
}

}

function saveChat() {
if (temporaryChat || messages.length === 0) return;

try {
  const savedChats = loadSavedChats();

  const firstUserMessage = messages.find(
    (message) => message.role === "user"
  );

  const title = firstUserMessage
    ? firstUserMessage.content.slice(0, 60)
    : "New chat";

  const chatRecord = {
    id: Date.now().toString(),
    title,
    messages: messages.map((message) => ({
      role: message.role,
      content: message.content
    })),
    createdAt: new Date().toISOString()
  };

  savedChats.unshift(chatRecord);

  const limitedChats = savedChats.slice(0, 50);

  localStorage.setItem(
    CHAT_STORAGE_KEY,
    JSON.stringify(limitedChats)
  );

  renderRecentChats();
} catch (error) {
  console.error("Could not save chat:", error);
}

}

function renderRecentChats(filter = "") {
recentChats.innerHTML = "";

const savedChats = loadSavedChats();

const filtered = savedChats.filter((item) =>
  String(item.title || "")
    .toLowerCase()
    .includes(filter.toLowerCase())
);

if (filtered.length === 0) {
  const empty = document.createElement("div");
  empty.style.padding = "10px";
  empty.style.color = "#777";
  empty.style.fontSize = "13px";
  empty.textContent = "No recent chats";
  recentChats.appendChild(empty);
  return;
}

filtered.forEach((item) => {
  const button = document.createElement("div");
  button.className = "recent-chat";
  button.textContent = item.title || "New chat";
  button.title = item.title || "New chat";

  button.addEventListener("click", () => {
    loadChat(item);
    sidebar.classList.remove("open");
  });

  recentChats.appendChild(button);
});

}

function loadChat(savedChat) {
messages = Array.isArray(savedChat.messages)
? savedChat.messages.map((message) => ({
role: message.role,
content: message.content
}))
: [];

chat.innerHTML = "";

if (messages.length === 0) {
  showWelcome();
  return;
}

welcome.style.display = "none";

messages.forEach((message) => {
  if (message.role === "user") {
    addMessageToScreen("You", message.content, true);
  } else if (message.role === "assistant") {
    addMessageToScreen("Global AI Mahlet", message.content, false);
  }
});

scrollToBottom();

}

// ------------------------------------------------------------
// Screen helpers
// ------------------------------------------------------------

function showWelcome() {
chat.innerHTML = "";

const welcomeClone = welcome.cloneNode(true);
welcomeClone.style.display = "block";
welcomeClone.id = "welcome";

chat.appendChild(welcomeClone);

chat.appendChild(typing);
typing.style.display = "none";

}

function addMessageToScreen(name, text, isUser) {
const message = document.createElement("div");
message.className = isUser
? "message user-message"
: "message assistant-message";

const avatar = document.createElement("div");
avatar.className = "avatar";
avatar.textContent = isUser ? "👤" : "🤖";

const content = document.createElement("div");
content.className = "message-content";

const messageName = document.createElement("div");
messageName.className = "message-name";
messageName.textContent = name;

const messageText = document.createElement("div");
messageText.className = "message-text";
messageText.textContent = text;

content.appendChild(messageName);
content.appendChild(messageText);

message.appendChild(avatar);
message.appendChild(content);

chat.appendChild(message);

return messageText;

}

function scrollToBottom() {
chat.scrollTop = chat.scrollHeight;
}

function setTyping(show) {
typing.style.display = show ? "block" : "none";
scrollToBottom();
}

function setSending(disabled) {
sendButton.disabled = disabled;
sendButton.style.opacity = disabled ? "0.6" : "1";
}

// ------------------------------------------------------------
// New chat
// ------------------------------------------------------------

function startNewChat() {
messages = [];
selectedFile = null;

input.value = "";
fileName.textContent = "";

showWelcome();

sidebar.classList.remove("open");
input.focus();

}

newChatButton.addEventListener("click", startNewChat);

// ------------------------------------------------------------
// Language
// ------------------------------------------------------------

try {
const savedLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY);

if (
  savedLanguage &&
  Array.from(languageSelect.options).some(
    (option) => option.value === savedLanguage
  )
) {
  languageSelect.value = savedLanguage;
}

} catch (error) {
console.error("Language loading error:", error);
}

languageSelect.addEventListener("change", () => {
try {
localStorage.setItem(
LANGUAGE_STORAGE_KEY,
languageSelect.value
);
} catch (error) {
console.error("Language saving error:", error);
}
});

// ------------------------------------------------------------
// Recent chat search
// ------------------------------------------------------------

recentSearch.addEventListener("input", () => {
renderRecentChats(recentSearch.value);
});

renderRecentChats();

// ------------------------------------------------------------
// Temporary chat
// ------------------------------------------------------------

temporaryChatButton.addEventListener("click", () => {
temporaryChat = !temporaryChat;

temporaryChatButton.classList.toggle(
  "active",
  temporaryChat
);

temporaryChatButton.title = temporaryChat
  ? "Temporary chat is ON"
  : "Temporary chat is OFF";

if (temporaryChat) {
  fileName.textContent = "Temporary chat";
} else if (!selectedFile) {
  fileName.textContent = "";
}

});

// ------------------------------------------------------------
// Mobile menu
// ------------------------------------------------------------

menuButton.addEventListener("click", () => {
sidebar.classList.toggle("open");
});

// ------------------------------------------------------------
// Text input
// ------------------------------------------------------------

input.addEventListener("input", () => {
input.style.height = "auto";
input.style.height =
Math.min(input.scrollHeight, 150) + "px";
});

input.addEventListener("keydown", (event) => {
if (event.key === "Enter" && !event.shiftKey) {
event.preventDefault();
sendMessage();
}
});

sendButton.addEventListener("click", sendMessage);

// ------------------------------------------------------------
// Create a user message
// ------------------------------------------------------------

function addUserMessage(text) {
messages.push({
role: "user",
content: text
});

welcome.style.display = "none";
addMessageToScreen("You", text, true);
scrollToBottom();

}

// ------------------------------------------------------------
// Real text AI
// ------------------------------------------------------------

async function sendMessage() {
const text = input.value.trim();

if (!text || sendButton.disabled) return;

input.value = "";
input.style.height = "auto";

addUserMessage(text);

const language = languageSelect.value || "English";

const conversationForAI = messages.map((message) => ({
  role: message.role,
  content: message.content
}));

conversationForAI.unshift({
  role: "system",
  content:
    "Respond in " +
    language +
    ". You are Global AI Mahlet, a helpful multilingual AI assistant and study tutor. " +
    "Explain difficult concepts step by step. Help with Mathematics, Physics, Chemistry, Biology, Computer Science, programming, writing, summaries, study plans, and general questions. " +
    "Be accurate, clear, respectful, and adapt to the user's level."
});

setTyping(true);
setSending(true);

const assistantMessage = createEmptyAssistantMessage();

try {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      messages: conversationForAI
    })
  });

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(
      "AI server error (" +
        response.status +
        "): " +
        errorText.slice(0, 300)
    );
  }

  if (!response.body) {
    throw new Error("The AI server returned no response body.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  let fullAnswer = "";
  let buffer = "";

  while (true) {
    const result = await reader.read();

    if (result.done) break;

    buffer += decoder.decode(result.value, {
      stream: true
    });

    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const parsedText = parseAIStreamLine(line);

      if (parsedText) {
        fullAnswer += parsedText;
        updateAssistantMessage(
          assistantMessage,
          fullAnswer
        );
      }
    }

    scrollToBottom();
  }

  buffer += decoder.decode();

  if (buffer.trim()) {
    const remainingLines = buffer.split("\n");

    for (const line of remainingLines) {
      const parsedText = parseAIStreamLine(line);

      if (parsedText) {
        fullAnswer += parsedText;
        updateAssistantMessage(
          assistantMessage,
          fullAnswer
        );
      }
    }
  }

  if (!fullAnswer.trim()) {
    throw new Error("The AI returned an empty answer.");
  }

  messages.push({
    role: "assistant",
    content: fullAnswer
  });

  if (!temporaryChat) {
    saveChat();
  }
} catch (error) {
  console.error("Global AI Mahlet chat error:", error);

  const errorMessage =
    "I couldn't connect to Global AI Mahlet right now. " +
    "Please try again.";

  updateAssistantMessage(
    assistantMessage,
    errorMessage
  );
} finally {
  setTyping(false);
  setSending(false);
  scrollToBottom();
}

}

// ------------------------------------------------------------
// Parse Cloudflare AI streaming responses
// ------------------------------------------------------------

function parseAIStreamLine(line) {
const trimmed = line.trim();

if (!trimmed) return "";

if (trimmed.startsWith(":")) {
  return "";
}

let data = trimmed;

if (data.startsWith("data:")) {
  data = data.slice(5).trim();
}

if (!data || data === "[DONE]") {
  return "";
}

try {
  const parsed = JSON.parse(data);

  if (typeof parsed === "string") {
    return parsed;
  }

  if (parsed.response !== undefined) {
    return String(parsed.response);
  }

  if (parsed.text !== undefined) {
    return String(parsed.text);
  }

  if (parsed.content !== undefined) {
    return String(parsed.content);
  }

  if (
    parsed.choices &&
    parsed.choices[0] &&
    parsed.choices[0].delta &&
    parsed.choices[0].delta.content
  ) {
    return String(
      parsed.choices[0].delta.content
    );
  }

  return "";
} catch {
  return "";
}

}

// ------------------------------------------------------------
// Empty assistant message for streaming
// ------------------------------------------------------------

function createEmptyAssistantMessage() {
welcome.style.display = "none";

const message = document.createElement("div");
message.className = "message assistant-message";

const avatar = document.createElement("div");
avatar.className = "avatar";
avatar.textContent = "🤖";

const content = document.createElement("div");
content.className = "message-content";

const name = document.createElement("div");
name.className = "message-name";
name.textContent = "Global AI Mahlet";

const text = document.createElement("div");
text.className = "message-text";

content.appendChild(name);
content.appendChild(text);

message.appendChild(avatar);
message.appendChild(content);

chat.appendChild(message);

return text;

}

function updateAssistantMessage(element, text) {
element.textContent = text;
scrollToBottom();
}

// ------------------------------------------------------------
// Photo understanding
// ------------------------------------------------------------

photoButton.addEventListener("click", () => {
photoInput.click();
});

photoInput.addEventListener("change", () => {
if (photoInput.files && photoInput.files[0]) {
handleImage(photoInput.files[0]);
}

photoInput.value = "";

});

// ------------------------------------------------------------
// Camera
// ------------------------------------------------------------

cameraButton.addEventListener("click", () => {
cameraInput.click();
});

cameraInput.addEventListener("change", () => {
if (cameraInput.files && cameraInput.files[0]) {
handleImage(cameraInput.files[0]);
}

cameraInput.value = "";

});

async function handleImage(file) {
if (!file.type.startsWith("image/")) {
alert("Please select an image.");
return;
}

const question =
  input.value.trim() ||
  "Please analyze this image carefully. If it contains a school question, solve it step by step.";

input.value = "";

addUserMessage(
  "📷 Image: " + file.name + "\n" + question
);

setTyping(true);
setSending(true);

const assistantMessage =
  createEmptyAssistantMessage();

try {
  const imageData = await fileToDataURL(file);

  const response = await fetch("/api/vision", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      image: imageData,
      prompt:
        question +
        "\n\nRespond in " +
        (languageSelect.value || "English") +
        "."
    })
  });

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(
      "Vision server error (" +
        response.status +
        "): " +
        errorText.slice(0, 300)
    );
  }

  const data = await response.json();

  const answer = extractVisionAnswer(data);

  if (!answer) {
    throw new Error(
      "The vision AI returned an empty answer."
    );
  }

  updateAssistantMessage(
    assistantMessage,
    answer
  );

  messages.push({
    role: "assistant",
    content: answer
  });

  if (!temporaryChat) {
    saveChat();
  }
} catch (error) {
  console.error(
    "Global AI Mahlet vision error:",
    error
  );

  updateAssistantMessage(
    assistantMessage,
    "I couldn't understand that image. Please try another image."
  );
} finally {
  setTyping(false);
  setSending(false);
}

}

function extractVisionAnswer(data) {
if (!data) return "";

if (typeof data === "string") {
  return data;
}

if (data.response !== undefined) {
  return String(data.response);
}

if (data.text !== undefined) {
  return String(data.text);
}

if (data.content !== undefined) {
  return String(data.content);
}

if (
  data.result &&
  typeof data.result === "object"
) {
  if (data.result.response !== undefined) {
    return String(data.result.response);
  }

  if (data.result.text !== undefined) {
    return String(data.result.text);
  }
}

return "";

}

function fileToDataURL(file) {
return new Promise((resolve, reject) => {
const reader = new FileReader();

  reader.onload = () => {
    resolve(String(reader.result));
  };

  reader.onerror = () => {
    reject(
      new Error("Could not read the image.")
    );
  };

  reader.readAsDataURL(file);
});

}

// ------------------------------------------------------------
// File upload
// ------------------------------------------------------------

fileButton.addEventListener("click", () => {
fileInput.click();
});

fileInput.addEventListener("change", async () => {
if (!fileInput.files || !fileInput.files[0]) {
return;
}

selectedFile = fileInput.files[0];

fileName.textContent = selectedFile.name;

await processFile(selectedFile);

fileInput.value = "";

});

async function processFile(file) {
const textTypes = [
"text/plain",
"text/csv",
"application/json"
];

if (
  textTypes.includes(file.type) ||
  /\.(txt|csv|json)$/i.test(file.name)
) {
  try {
    const text = await file.text();

    const preview =
      text.length > 12000
        ? text.slice(0, 12000) +
          "\n\n[File was shortened for processing.]"
        : text;

    input.value =
      "I uploaded this file: " +
      file.name +
      "\n\nPlease analyze and explain it:\n\n" +
      preview;

    input.focus();
  } catch (error) {
    console.error(
      "Text file reading error:",
      error
    );

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
    "The PDF is attached for reference, but direct PDF text extraction is not enabled in this first version."
  );

  return;
}

input.value =
  "I uploaded a file named \"" +
  file.name +
  "\". Please tell me how I can work with this file.";

input.focus();

}

// ------------------------------------------------------------
// Voice mode
// ------------------------------------------------------------

const SpeechRecognition =
window.SpeechRecognition ||
window.webkitSpeechRecognition;

if (SpeechRecognition) {
recognition = new SpeechRecognition();

recognition.continuous = false;
recognition.interimResults = false;

recognition.onstart = () => {
  isListening = true;
  voiceButton.classList.add("active");
  voiceButton.textContent = "🔴";
  voiceButton.title = "Listening...";
};

recognition.onresult = (event) => {
  const result =
    event.results &&
    event.results[0] &&
    event.results[0][0];

  if (result) {
    input.value = result.transcript;
    input.dispatchEvent(new Event("input"));
  }
};

recognition.onerror = (event) => {
  console.error(
    "Voice recognition error:",
    event.error
  );
};

recognition.onend = () => {
  isListening = false;
  voiceButton.classList.remove("active");
  voiceButton.textContent = "🎤";
  voiceButton.title = "Voice mode";
};

voiceButton.addEventListener("click", () => {
  if (isListening) {
    recognition.stop();
    return;
  }

  try {
    recognition.lang = getSpeechLanguage(
      languageSelect.value
    );

    recognition.start();
  } catch (error) {
    console.error(
    
