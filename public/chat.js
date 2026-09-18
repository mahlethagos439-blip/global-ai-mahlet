/* =========================================================
   GLOBAL AI MAHLET — CHAT.JS
   ========================================================= */

const chatMessages = document.getElementById("chat-messages");
const userInput = document.getElementById("user-input");
const sendButton = document.getElementById("send-button");
const typingIndicator = document.getElementById("typing-indicator");

const newChatButton = document.getElementById("new-chat-button");
const menuButton = document.getElementById("menu-button");
const sidebar = document.getElementById("sidebar");
const recentChats = document.getElementById("recent-chats");
const recentSearch = document.getElementById("recent-search");
const languageSelect = document.getElementById("language-select");

const photoButton = document.getElementById("photo-button");
const photoInput = document.getElementById("photo-input");
const fileButton = document.getElementById("file-button");
const fileInput = document.getElementById("file-input");
const cameraButton = document.getElementById("camera-button");
const cameraInput = document.getElementById("camera-input");
const voiceButton = document.getElementById("voice-button");
const temporaryChatButton =
    document.getElementById("temporary-chat-button");

let isProcessing = false;
let temporaryChat = false;
let activeChatId = null;
let voiceMode = false;
let recognition = null;
let speaking = false;

const currentAvatar = "🤖";

/* =========================================================
   50 LANGUAGES
   ========================================================= */

const LANGUAGES = [
    "English",
    "Amharic",
    "Arabic",
    "French",
    "Spanish",
    "Portuguese",
    "German",
    "Italian",
    "Dutch",
    "Russian",
    "Ukrainian",
    "Polish",
    "Turkish",
    "Greek",
    "Hebrew",
    "Persian",
    "Hindi",
    "Bengali",
    "Urdu",
    "Punjabi",
    "Gujarati",
    "Marathi",
    "Tamil",
    "Telugu",
    "Kannada",
    "Malayalam",
    "Nepali",
    "Sinhala",
    "Thai",
    "Vietnamese",
    "Indonesian",
    "Malay",
    "Filipino",
    "Swahili",
    "Somali",
    "Hausa",
    "Yoruba",
    "Zulu",
    "Afrikaans",
    "Oromo",
    "Tigrinya",
    "Chinese",
    "Japanese",
    "Korean",
    "Romanian",
    "Czech",
    "Hungarian",
    "Swedish",
    "Danish",
    "Finnish"
];

/* =========================================================
   CHAT HISTORY
   ========================================================= */

let chatHistory = [
    {
        role: "assistant",
        content:
            "Hello! I'm Global AI Mahlet. I can help you learn, solve problems, explain concepts, practice questions, and much more. 🌍"
    }
];

let savedChats = [];

try {
    savedChats = JSON.parse(
        localStorage.getItem("globalAIChats") || "[]"
    );

    if (!Array.isArray(savedChats)) {
        savedChats = [];
    }
} catch {
    savedChats = [];
}

/* =========================================================
   STYLES
   ========================================================= */

const style = document.createElement("style");

style.textContent = `
.bottom-tools {
    display:flex !important;
    flex-direction:row !important;
    align-items:center !important;
    justify-content:space-between !important;
    width:100%;
}

.tool-group {
    display:flex !important;
    flex-direction:row !important;
    align-items:center !important;
    flex-wrap:nowrap !important;
    gap:3px;
}

.composer-area {
    z-index:100 !important;
    pointer-events:auto !important;
}

.composer,
.composer button,
.composer textarea {
    pointer-events:auto !important;
}

.sidebar-close-button {
    position:absolute;
    top:10px;
    right:10px;
    border:0;
    background:transparent;
    font-size:22px;
    cursor:pointer;
}

.message-actions {
    display:flex;
    gap:5px;
    margin-top:7px;
}

.message-action {
    border:0;
    background:transparent;
    cursor:pointer;
    padding:4px 6px;
}

.voice-panel {
    position:fixed;
    left:50%;
    bottom:100px;
    transform:translateX(-50%);
    z-index:10000;
    background:#111827;
    color:white;
    padding:20px 25px;
    border-radius:20px;
    text-align:center;
    min-width:230px;
    box-shadow:0 8px 30px rgba(0,0,0,.3);
}

.voice-face {
    font-size:65px;
    animation: globalVoicePulse 1.2s infinite;
}

@keyframes globalVoicePulse {
    0% { transform:scale(1); }
    50% { transform:scale(1.12); }
    100% { transform:scale(1); }
}

.voice-status {
    margin-top:7px;
    font-size:14px;
}

.voice-stop {
    margin-top:12px;
    padding:8px 15px;
    border:0;
    border-radius:8px;
    cursor:pointer;
}
`;

document.head.appendChild(style);

/* =========================================================
   50 LANGUAGE SELECT
   ========================================================= */

function setupLanguages() {
    if (!languageSelect) return;

    languageSelect.innerHTML = "";

    LANGUAGES.forEach((language) => {
        const option = document.createElement("option");

        option.value = language;
        option.textContent = language;

        if (language === "English") {
            option.selected = true;
        }

        languageSelect.appendChild(option);
    });
}

setupLanguages();

/* =========================================================
   SIDEBAR CLOSE BUTTON
   ========================================================= */

if (sidebar) {
    const close = document.createElement("button");

    close.className = "sidebar-close-button";
    close.textContent = "✕";
    close.title = "Close sidebar";
    close.type = "button";

    close.addEventListener("click", () => {
        sidebar.classList.remove("open");
    });

    sidebar.appendChild(close);
}

/* =========================================================
   TEMPORARY CHAT
   ========================================================= */

function updateTemporaryButton() {
    if (!temporaryChatButton) return;

    temporaryChatButton.textContent =
        temporaryChat ? "🗑️✓" : "🗑️";

    temporaryChatButton.title =
        temporaryChat
            ? "Temporary Chat is ON"
            : "Temporary Chat is OFF";
}

if (temporaryChatButton) {
    temporaryChatButton.addEventListener("click", () => {
        temporaryChat = !temporaryChat;

        if (temporaryChat) {
            activeChatId = null;
        }

        updateTemporaryButton();
    });
}

/* =========================================================
   SAVE NORMAL CHAT
   ========================================================= */

function saveCurrentChat() {
    if (temporaryChat) return;

    const usefulMessages = chatHistory.filter(
        (message) =>
            message.content &&
            String(message.content).trim()
    );

    if (usefulMessages.length < 2) return;

    const firstUserMessage =
        usefulMessages.find(
            (message) => message.role === "user"
        );

    const title =
        firstUserMessage
            ? String(firstUserMessage.content)
                  .replace(/\s+/g, " ")
                  .slice(0, 45)
            : "New Chat";

    if (!activeChatId) {
        activeChatId =
            Date.now().toString();
    }

    const chat = {
        id: activeChatId,
        title,
        messages: chatHistory
    };

    const existingIndex =
        savedChats.findIndex(
            (item) => item.id === activeChatId
        );

    if (existingIndex >= 0) {
        savedChats[existingIndex] = chat;
    } else {
        savedChats.unshift(chat);
    }

    try {
        localStorage.setItem(
            "globalAIChats",
            JSON.stringify(savedChats)
        );
    } catch {
        console.warn("Could not save chat.");
    }

    displayRecentChats();
}

/* =========================================================
   RECENT CHATS
   ========================================================= */

function displayRecentChats() {
    if (!recentChats) return;

    recentChats.innerHTML = "";

    savedChats.forEach((chat) => {
        const button =
            document.createElement("button");

        button.type = "button";
        button.style.display = "block";
        button.style.width = "100%";
        button.style.textAlign = "left";
        button.style.padding = "8px";
        button.style.marginBottom = "4px";
        button.style.border = "0";
        button.style.borderRadius = "8px";
        button.style.background = "transparent";
        button.style.cursor = "pointer";

        button.textContent =
            chat.title || "Chat";

        button.addEventListener("click", () => {
            activeChatId = chat.id;

            chatHistory =
                Array.isArray(chat.messages)
                    ? chat.messages
                    : [];

            temporaryChat = false;

            updateTemporaryButton();
            displayHistory();

            if (sidebar) {
                sidebar.classList.remove("open");
            }
        });

        recentChats.appendChild(button);
    });
}

/* =========================================================
   NEW CHAT
   ========================================================= */

function startNewChat() {
    activeChatId = null;
    temporaryChat = false;

    chatHistory = [
        {
            role: "assistant",
            content:
                "Hello! I'm Global AI Mahlet. What would you like to learn or explore?"
        }
    ];

    updateTemporaryButton();
    displayHistory();

    if (userInput) {
        userInput.value = "";
        userInput.style.height = "auto";
        userInput.focus();
    }
}

if (newChatButton) {
    newChatButton.addEventListener(
        "click",
        startNewChat
    );
}

/* =========================================================
   MENU
   ========================================================= */

if (menuButton && sidebar) {
    menuButton.addEventListener("click", () => {
        sidebar.classList.toggle("open");
    });
}

/* =========================================================
   RECENT SEARCH
   ========================================================= */

if (recentSearch) {
    recentSearch.addEventListener(
        "input",
        () => {
            const query =
                recentSearch.value
                    .toLowerCase()
                    .trim();

            const buttons =
                recentChats?.querySelectorAll(
                    "button"
                ) || [];

            buttons.forEach((button) => {
                button.style.display =
                    !query ||
                    button.textContent
                        .toLowerCase()
                        .includes(query)
                        ? "block"
                        : "none";
            });
        }
    );
}

/* =========================================================
   LANGUAGE
   ========================================================= */

if (languageSelect && userInput) {
    languageSelect.addEventListener(
        "change",
        () => {
            userInput.placeholder =
                `Message Global AI Mahlet in ${languageSelect.value}...`;
        }
    );
}

/* =========================================================
   INPUT
   ========================================================= */

if (userInput) {
    userInput.addEventListener(
        "input",
        () => {
            userInput.style.height = "auto";

            userInput.style.height =
                Math.min(
                    userInput.scrollHeight,
                    180
                ) + "px";
        }
    );

    userInput.addEventListener(
        "keydown",
        (event) => {
            if (
                event.key === "Enter" &&
                !event.shiftKey
            ) {
                event.preventDefault();

                if (!isProcessing) {
                    sendMessage();
                }
            }
        }
    );
}

if (sendButton) {
    sendButton.addEventListener(
        "click",
        () => {
            if (!isProcessing) {
                sendMessage();
            }
        }
    );
}

/* =========================================================
   IMAGE → BASE64
   ========================================================= */

function fileToBase64(file) {
    return new Promise(
        (resolve, reject) => {
            const reader =
                new FileReader();

            reader.onload = () => {
                const result =
                    String(
                        reader.result || ""
                    );

                resolve(result);
            };

            reader.onerror = () => {
                reject(
                    new Error(
                        "Could not read image."
                    )
                );
            };

            reader.readAsDataURL(file);
        }
    );
}

/* =========================================================
   PHOTO + CAMERA AI VISION
   ========================================================= */

async function analyzeImage(
    file,
    source = "photo"
) {
    if (!file) return;

    const label =
        source === "camera"
            ? "📸 Camera image"
            : "🖼️ Photo";

    addMessageToChat(
        "user",
        `${label}: ${file.name}`
    );

    const assistantMessage =
        addMessageToChat(
            "assistant",
            "🔎 I'm analyzing the image..."
        );

    const textElement =
        assistantMessage?.querySelector(
            ".message-text"
        );

    try {
        const base64 =
            await fileToBase64(file);

        const response =
            await fetch(
                "/api/vision",
                {
                    method: "POST",
                    headers: {
                        "Content-Type":
                            "application/json"
                    },
                    body: JSON.stringify({
                        image: base64,
                        prompt:
                            `Analyze this image carefully.
If it contains a school question, solve it step by step.
If it contains text, read and explain it.
If it contains a diagram, chart, object, or other visual information, explain what is visible.
Do not invent information that cannot be seen.
Answer in ${languageSelect?.value || "English"}.`
                    })
                }
            );

        const result =
            await response.json();

        if (!response.ok) {
            throw new Error(
                result.error ||
                "Vision request failed."
            );
        }

        const answer =
            result.response ||
            result.description ||
            result.text ||
            result.content ||
            "I could not understand the image.";

        if (textElement) {
            textElement.textContent =
                answer;
        }

        chatHistory.push({
            role: "assistant",
            content: answer
        });

        speakText(answer);

        saveCurrentChat();

    } catch (error) {
        console.error(
            "Vision error:",
            error
        );

        const message =
            "Sorry, I could not understand that image. Please try another photo.";

        if (textElement) {
            textElement.textContent =
                message;
        }
    }
}

if (photoButton && photoInput) {
    photoButton.addEventListener(
        "click",
        () => {
            photoInput.click();
        }
    );

    photoInput.addEventListener(
        "change",
        async () => {
            if (!photoInput.files.length) {
                return;
            }

            const file =
                photoInput.files[0];

            await analyzeImage(
                file,
                "photo"
            );

            photoInput.value = "";
        }
    );
}

if (cameraButton && cameraInput) {
    cameraButton.addEventListener(
        "click",
        () => {
            cameraInput.click();
        }
    );

    cameraInput.addEventListener(
        "change",
        async () => {
            if (!cameraInput.files.length) {
                return;
            }

            const file =
                cameraInput.files[0];

            await analyzeImage(
                file,
                "camera"
            );

            cameraInput.value = "";
        }
    );
}

/* =========================================================
   FILE
   ========================================================= */

if (fileButton && fileInput) {
    fileButton.addEventListener(
        "click",
        () => {
            fileInput.click();
        }
    );

    fileInput.addEventListener(
        "change",
        () => {
            if (!fileInput.files.length) {
                return;
            }

            const file =
                fileInput.files[0];

            addMessageToChat(
                "user",
                `📎 File selected: ${file.name}`
            );

            addMessageToChat(
                "assistant",
                "I received your file. Full document understanding will be added separately."
            );

            fileInput.value = "";
        }
    );
}

/* =========================================================
   ADD MESSAGE
   ========================================================= */

function addMessageToChat(
    role,
    content
) {
    if (!chatMessages) return null;

    const message =
        document.createElement("div");

    message.className =
        `message ${role}-message`;

    const avatar =
        document.createElement("div");

    avatar.className = "avatar";

    avatar.textContent =
        role === "user"
            ? "👤"
            : currentAvatar;

    const contentBox =
        document.createElement("div");

    contentBox.className =
        "message-content";

    const name =
        document.createElement("div");

    name.className =
        "message-name";

    name.textContent =
        role === "user"
            ? "You"
            : "Global AI Mahlet";

    const text =
        document.createElement("div");

    text.className =
        "message-text";

    text.textContent =
        String(content || "");

    contentBox.appendChild(name);
    contentBox.appendChild(text);

    if (role === "assistant") {
        const actions =
            document.createElement("div");

        actions.className =
            "message-actions";

        ["📋", "👍", "👎", "↗️"]
            .forEach((icon) => {
                const button =
                    document.createElement(
                        "button"
                    );

                button.type = "button";
                button.className =
                    "message-action";
                button.textContent = icon;

                button.addEventListener(
                    "click",
                    async () => {
                        if (
                            icon === "📋"
                        ) {
                            try {
                                await navigator.clipboard.writeText(
                                    String(
                                        content ||
                                        text.textContent ||
                                        ""
                                    )
                                );

                                button.textContent =
                                    "✅";
                            } catch {}
                        }

                        if (
                            icon === "👍" ||
                            icon === "👎"
                        ) {
                            button.textContent =
                                "✓";
                        }

                        if (
 
