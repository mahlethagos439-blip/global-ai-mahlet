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
const temporaryChatButton = document.getElementById("temporary-chat-button");

let isProcessing = false;
let temporaryChat = false;
let activeChatId = null;
let voiceMode = false;
let recognition = null;

let currentAvatar =
    localStorage.getItem("globalAIAvatar") || "🤖";

const AVATARS = ["🤖", "👩‍💻", "👨‍💻", "🧑‍🚀", "👩‍🔬", "🧑‍🏫", "🧑‍💡"];

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

    if (!Array.isArray(savedChats)) savedChats = [];
} catch {
    savedChats = [];
}

/* =========================================================
   FIX BUTTON LAYOUT
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

.avatar-picker {
    display:flex;
    flex-wrap:wrap;
    gap:5px;
    margin:8px 0 12px;
}

.avatar-choice {
    border:1px solid transparent;
    background:transparent;
    font-size:23px;
    padding:4px;
    border-radius:8px;
    cursor:pointer;
}

.avatar-choice.selected {
    border-color:#111827;
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
    padding:18px 25px;
    border-radius:20px;
    text-align:center;
    min-width:210px;
    box-shadow:0 8px 30px rgba(0,0,0,.3);
}

.voice-face {
    font-size:65px;
}

.voice-stop {
    margin-top:10px;
    padding:7px 14px;
    border:0;
    border-radius:8px;
    cursor:pointer;
}
`;

document.head.appendChild(style);

/* =========================================================
   SIDEBAR CLOSE BUTTON
   ========================================================= */

if (sidebar) {
    const close = document.createElement("button");

    close.className = "sidebar-close-button";
    close.textContent = "✕";
    close.title = "Close sidebar";

    close.addEventListener("click", () => {
        sidebar.classList.remove("open");
    });

    sidebar.appendChild(close);
}

/* =========================================================
   AVATAR PICKER
   ========================================================= */

if (sidebar && recentChats) {
    const avatarArea = document.createElement("div");

    avatarArea.innerHTML = `
        <div style="font-size:13px;font-weight:700;margin:8px;">
            🤖 AI Avatar
        </div>
        <div class="avatar-picker"></div>
    `;

    sidebar.insertBefore(avatarArea, recentChats);

    const picker = avatarArea.querySelector(".avatar-picker");

    AVATARS.forEach((avatar) => {
        const button = document.createElement("button");

        button.type = "button";
        button.className = "avatar-choice";
        button.textContent = avatar;

        if (avatar === currentAvatar) {
            button.classList.add("selected");
        }

        button.addEventListener("click", () => {
            currentAvatar = avatar;

            localStorage.setItem(
                "globalAIAvatar",
                currentAvatar
            );

            picker.querySelectorAll(".avatar-choice")
                .forEach((b) => b.classList.remove("selected"));

            button.classList.add("selected");
        });

        picker.appendChild(button);
    });
}

/* =========================================================
   TEMPORARY CHAT
   ========================================================= */

function updateTemporaryButton() {
    if (!temporaryChatButton) return;

    temporaryChatButton.textContent =
        temporaryChat ? "🗑️✓" : "🗑️";
}

if (temporaryChatButton) {
    temporaryChatButton.addEventListener("click", () => {
        temporaryChat = !temporaryChat;
        updateTemporaryButton();
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
    newChatButton.addEventListener("click", startNewChat);
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
   LANGUAGE
   ========================================================= */

if (languageSelect && userInput) {
    languageSelect.addEventListener("change", () => {
        userInput.placeholder =
            `Message Global AI Mahlet in ${languageSelect.value}...`;
    });
}

/* =========================================================
   INPUT
   ========================================================= */

if (userInput) {
    userInput.addEventListener("input", () => {
        userInput.style.height = "auto";
        userInput.style.height =
            Math.min(userInput.scrollHeight, 180) + "px";
    });

    userInput.addEventListener("keydown", (event) => {
        if (
            event.key === "Enter" &&
            !event.shiftKey
        ) {
            event.preventDefault();

            if (!isProcessing) {
                sendMessage();
            }
        }
    });
}

if (sendButton) {
    sendButton.addEventListener("click", () => {
        if (!isProcessing) {
            sendMessage();
        }
    });
}

/* =========================================================
   PHOTO
   ========================================================= */

if (photoButton && photoInput) {
    photoButton.addEventListener("click", () => {
        photoInput.click();
    });

    photoInput.addEventListener("change", () => {
        if (!photoInput.files.length) return;

        const file = photoInput.files[0];

        addMessageToChat(
            "user",
            `🖼️ Photo selected: ${file.name}

Photo understanding will be connected to the AI vision system later.`
        );

        photoInput.value = "";
    });
}

/* =========================================================
   FILE
   ========================================================= */

if (fileButton && fileInput) {
    fileButton.addEventListener("click", () => {
        fileInput.click();
    });

    fileInput.addEventListener("change", () => {
        if (!fileInput.files.length) return;

        const file = fileInput.files[0];

        addMessageToChat(
            "user",
            `📎 File selected: ${file.name}

File understanding will be connected to the document system later.`
        );

        fileInput.value = "";
    });
}

/* =========================================================
   CAMERA
   ========================================================= */

if (cameraButton && cameraInput) {
    cameraButton.addEventListener("click", () => {
        cameraInput.click();
    });

    cameraInput.addEventListener("change", () => {
        if (!cameraInput.files.length) return;

        const file = cameraInput.files[0];

        addMessageToChat(
            "user",
            `📸 Camera image selected: ${file.name}

Camera image understanding will be connected later.`
        );

        cameraInput.value = "";
    });
}

/* =========================================================
   ADD MESSAGE
   ========================================================= */

function addMessageToChat(role, content) {
    if (!chatMessages) return null;

    const message = document.createElement("div");

    message.className =
        `message ${role}-message`;

    const avatar = document.createElement("div");

    avatar.className = "avatar";

    avatar.textContent =
        role === "user" ? "👤" : currentAvatar;

    const contentBox = document.createElement("div");

    contentBox.className = "message-content";

    const name = document.createElement("div");

    name.className = "message-name";

    name.textContent =
        role === "user"
            ? "You"
            : "Global AI Mahlet";

    const text = document.createElement("div");

    text.className = "message-text";

    text.textContent = String(content || "");

    contentBox.appendChild(name);
    contentBox.appendChild(text);

    if (role === "assistant") {
        const actions = document.createElement("div");

        actions.className = "message-actions";

        ["📋", "👍", "👎", "↗️"].forEach((icon) => {
            const button = document.createElement("button");

            button.type = "button";
            button.className = "message-action";
            button.textContent = icon;

            button.addEventListener("click", async () => {
                if (icon === "📋") {
                    try {
                        await navigator.clipboard.writeText(
                            String(content || "")
                        );
                        button.textContent = "✅";
                    } catch {}
                }

                if (icon === "↗️" && navigator.share) {
                    try {
                        await navigator.share({
                            title: "Global AI Mahlet",
                            text: String(content || ""),
                            url: location.href
                        });
                    } catch {}
                }
            });

            actions.appendChild(button);
        });

        contentBox.appendChild(actions);
    }

    message.appendChild(avatar);
    message.appendChild(contentBox);

    chatMessages.appendChild(message);

    chatMessages.scrollTop =
        chatMessages.scrollHeight;

    return message;
}

/* =========================================================
   DISPLAY HISTORY
   ========================================================= */

function displayHistory() {
    if (!chatMessages) return;

    chatMessages.innerHTML = "";

    chatHistory.forEach((message) => {
        addMessageToChat(
            message.role,
            message.content
        );
    });
}

/* =========================================================
   AI RESPONSE
   ========================================================= */

async function sendMessage() {
    if (!userInput || !chatMessages) return;

    const text = userInput.value.trim();

    if (!text || isProcessing) return;

    isProcessing = true;

    sendButton.disabled = true;
    userInput.disabled = true;

    userInput.value = "";
    userInput.style.height = "auto";

    const welcome = document.getElementById("welcome");

    if (welcome) {
        welcome.remove();
    }

    chatHistory.push({
        role: "user",
        content: text
    });

    addMessageToChat("user", text);

    if (typingIndicator) {
        typingIndicator.classList.add("visible");
    }

    const assistantMessage =
        addMessageToChat("assistant", "");

    const textElement =
        assistantMessage?.querySelector(".message-text");

    try {
        const response = await fetch("/api/chat", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                messages: chatHistory
            })
        });

        if (!response.ok) {
            throw new Error(
                `AI request failed: ${response.status}`
            );
        }

        if (!response.body) {
            throw new Error("No AI response stream.");
        }

        const reader =
            response.body.getReader();

        const decoder =
            new TextDecoder();

        let fullText = "";

        while (true) {
            const { value, done } =
                await reader.read();

            if (done) break;

            const chunk =
                decoder.decode(value, {
                    stream: true
                });

            const lines =
                chunk.split("\n");

            for (const line of lines) {
                if (!line.startsWith("data:")) {
                    continue;
                }

                const data =
                    line.substring(5).trim();

                if (!data || data === "[DONE]") {
                    continue;
                }

                try {
                    const parsed =
                        JSON.parse(data);

                    const piece =
                        parsed.response ||
                        parsed.text ||
                        parsed.content ||
                        "";

                    if (piece) {
                        fullText += piece;

                        if (textElement) {
                            textElement.textContent =
                                fullText;
                        }

                        chatMessages.scrollTop =
                            chatMessages.scrollHeight;
                    }
                } catch {
                    /* Ignore non-JSON SSE lines */
                }
            }
        }

        if (!fullText.trim()) {
            fullText =
                "I received your message, but I could not generate a response.";
        }

        if (textElement) {
            textElement.textContent = fullText;
        }

        chatHistory.push({
            role: "assistant",
            content: fullText
        });

    } catch (error) {
        console.error(error);

        if (textElement) {
            textElement.textContent =
                "Sorry, I could not connect to the AI right now. Please try again.";
        }

    } finally {
        if (typingIndicator) {
            typingIndicator.classList.remove("visible");
        }

        isProcessing = false;

        sendButton.disabled = false;
        userInput.disabled = false;

        userInput.focus();
    }
}

/* =========================================================
   VOICE MODE
   ========================================================= */

function createVoicePanel() {
    if (document.querySelector(".voice-panel")) return;

    const panel =
        document.createElement("div");

    panel.className = "voice-panel";

    panel.innerHTML = `
        <div class="voice-face">${currentAvatar}</div>
        <div>Voice mode is ON</div>
        <button class="voice-stop">Turn Off</button>
    `;

    panel.querySelector(".voice-stop")
        .addEventListener("click", stopVoiceMode);

    document.body.appendChild(panel);
}

function stopVoiceMode() {
    voiceMode = false;

    if (recognition) {
        try {
            recognition.stop();
        } catch {}
    }

    const panel =
        document.querySelector(".voice-panel");

    if (panel) panel.remove();

    if (voiceButton) {
        voiceButton.textContent = "🎤";
    }
}

function startVoiceMode() {
    const SpeechRecognition =
        window.SpeechRecognition ||
        window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
        alert(
            "Voice recognition is not supported by this browser."
        );
        return;
    }

    voiceMode = true;

    createVoicePanel();

    if (voiceButton) {
        voiceButton.textContent = "🔴";
    }

    recognition =
        new SpeechRecognition();

    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event) => {
        const spoken =
            event.results[0][0].transcript;

        if (userInput) {
            userInput.value = spoken;
            sendMessage();
        }
    };

    recognition.onend = () => {
        if (voiceMode) {
            try {
                recognition.start();
            } catch {}
        }
    };

    try {
        recognition.start();
    } catch {}
}

if (voiceButton) {
    voiceButton.addEventListener("click", () => {
        if (voiceMode) {
            stopVoiceMode();
        } else {
            startVoiceMode();
        }
    });
}

/* =========================================================
   STARTUP
   ========================================================= */

updateTemporaryButton();
displayHistory();

console.log("Global AI Mahlet chat.js loaded successfully.");
