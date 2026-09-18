/* =========================================================
   GLOBAL AI MAHLET — COMPLETE CHAT.JS
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
let isListening = false;
let recognition = null;
let voicePanel = null;

let currentAvatar =
	localStorage.getItem("globalAIAvatar") || "🤖";

const AVATARS = [
	"🤖",
	"👩‍💻",
	"👨‍💻",
	"🧑‍🚀",
	"👩‍🔬",
	"🧑‍🏫",
	"🧑‍💡",
];

const VOICE_GREETINGS = [
	"Welcome to Global AI Mahlet. What would you like to explore today?",
	"Hi! I'm ready to listen. What would you like to talk about?",
	"Hello! Voice mode is ready. Tell me what you need help with.",
	"Welcome back! What shall we learn or explore together?",
	"Hi there! I'm listening. You can start speaking whenever you're ready.",
	"Hello! Let's have a conversation. What is on your mind?",
	"Great to hear from you! Tell me what you'd like to learn today.",
];

let chatHistory = [
	{
		role: "assistant",
		content:
			"Hello! I'm Global AI Mahlet. I can help you learn, solve problems, explain concepts, practice questions, and much more. 🌍",
	},
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
	.sidebar {
		position: relative;
	}

	.sidebar-close-button {
		position: absolute;
		top: 12px;
		right: 12px;
		z-index: 20;
		border: none;
		background: transparent;
		font-size: 22px;
		cursor: pointer;
		padding: 5px;
	}

	.temporary-control {
		margin: 10px 0 14px;
		padding: 10px;
		border-radius: 12px;
		background: rgba(127,127,127,.08);
		display: flex;
		align-items: center;
		gap: 10px;
		cursor: pointer;
		user-select: none;
	}

	.temporary-circle {
		width: 18px;
		height: 18px;
		min-width: 18px;
		border-radius: 50%;
		border: 2px solid currentColor;
		display: inline-block;
	}

	.temporary-circle.active {
		background: currentColor;
	}

	.avatar-area {
		margin-bottom: 12px;
	}

	.avatar-picker {
		display: flex;
		flex-wrap: wrap;
		gap: 7px;
		margin-top: 8px;
	}

	.avatar-choice {
		font-size: 24px;
		border: 1px solid transparent;
		background: transparent;
		cursor: pointer;
		border-radius: 8px;
		padding: 3px 6px;
	}

	.avatar-choice:hover {
		background: rgba(127,127,127,.12);
	}

	.avatar-choice.selected {
		border-color: currentColor;
	}

	.recent-chat-row {
		display: flex;
		align-items: center;
		gap: 4px;
		margin-bottom: 5px;
	}

	.recent-chat-main {
		flex: 1;
		text-align: left;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}

	.recent-chat-actions {
		display: flex;
		gap: 2px;
	}

	.recent-chat-action {
		border: none;
		background: transparent;
		cursor: pointer;
		padding: 5px;
	}

	.recent-chat-action:hover {
		background: rgba(127,127,127,.12);
		border-radius: 6px;
	}

	.pinned-chat {
		font-weight: 600;
	}

	.message-actions {
		display: flex;
		gap: 5px;
		margin-top: 7px;
	}

	.message-action {
		border: none;
		background: transparent;
		cursor: pointer;
		font-size: 15px;
		padding: 3px 6px;
		border-radius: 6px;
	}

	.message-action:hover {
		background: rgba(127,127,127,.12);
	}

	.voice-avatar-panel {
		position: fixed;
		left: 50%;
		bottom: 90px;
		transform: translateX(-50%);
		z-index: 9999;
		padding: 16px 22px;
		border-radius: 20px;
		background: rgba(20,20,20,.94);
		color: white;
		text-align: center;
		box-shadow: 0 8px 30px rgba(0,0,0,.3);
		min-width: 190px;
	}

	.voice-avatar-face {
		font-size: 70px;
		line-height: 1.1;
		transition: transform .15s ease;
	}

	.voice-avatar-face.talking {
		transform: scale(1.12);
	}

	.voice-stop-button {
		margin-top: 10px;
		border: none;
		border-radius: 10px;
		padding: 7px 14px;
		cursor: pointer;
	}

	.gai-error {
		margin-top: 8px;
		padding: 8px;
		border-radius: 8px;
		background: rgba(220,38,38,.08);
	}

	.gai-retry {
		margin-top: 6px;
		border: none;
		border-radius: 7px;
		padding: 6px 10px;
		cursor: pointer;
	}
`;

document.head.appendChild(style);

/* =========================================================
   SIDEBAR CLOSE BUTTON
   ========================================================= */

if (sidebar) {
	const closeButton = document.createElement("button");

	closeButton.className = "sidebar-close-button";
	closeButton.textContent = "✕";
	closeButton.title = "Close sidebar";
	closeButton.setAttribute("aria-label", "Close sidebar");

	closeButton.addEventListener("click", () => {
		sidebar.classList.remove("open");
	});

	sidebar.appendChild(closeButton);
}

/* =========================================================
   TEMPORARY CHAT
   ========================================================= */

const temporaryControl = document.createElement("div");

temporaryControl.className = "temporary-control";

temporaryControl.innerHTML = `
	<span class="temporary-circle"></span>
	<span>
		<strong>Temporary Chat</strong><br>
		<small>Don't save this conversation</small>
	</span>
`;

if (sidebar && recentChats) {
	sidebar.insertBefore(temporaryControl, recentChats);
}

function updateTemporaryUI() {
	const circle =
		temporaryControl.querySelector(".temporary-circle");

	if (circle) {
		circle.classList.toggle("active", temporaryChat);
	}

	if (temporaryChatButton) {
		temporaryChatButton.textContent =
			temporaryChat ? "🗑️✓" : "🗑️";
	}
}

temporaryControl.addEventListener("click", () => {
	temporaryChat = !temporaryChat;
	updateTemporaryUI();
});

if (temporaryChatButton) {
	temporaryChatButton.addEventListener("click", () => {
		temporaryChat = !temporaryChat;
		updateTemporaryUI();
	});
}

/* =========================================================
   AVATAR PICKER
   ========================================================= */

const avatarArea = document.createElement("div");

avatarArea.className = "avatar-area";

avatarArea.innerHTML = `
	<div style="font-size:13px;">
		<strong>Choose AI Avatar</strong>
	</div>
	<div class="avatar-picker"></div>
`;

if (sidebar && recentChats) {
	sidebar.insertBefore(avatarArea, recentChats);
}

const avatarPicker =
	avatarArea.querySelector(".avatar-picker");

function renderAvatarPicker() {
	if (!avatarPicker) return;

	avatarPicker.innerHTML = "";

	AVATARS.forEach((avatar) => {
		const button = document.createElement("button");

		button.className = "avatar-choice";
		button.textContent = avatar;
		button.title = "Choose this avatar";

		if (avatar === currentAvatar) {
			button.classList.add("selected");
		}

		button.addEventListener("click", () => {
			currentAvatar = avatar;

			localStorage.setItem(
				"globalAIAvatar",
				currentAvatar
			);

			renderAvatarPicker();

			if (voicePanel) {
				updateVoiceAvatar(false, "Voice mode is ON");
			}
		});

		avatarPicker.appendChild(button);
	});
}

renderAvatarPicker();

/* =========================================================
   CHAT STORAGE
   ========================================================= */

function saveChats() {
	if (temporaryChat) return;

	try {
		localStorage.setItem(
			"globalAIChats",
			JSON.stringify(savedChats)
		);
	} catch (error) {
		console.error("Could not save chats:", error);
	}
}

function getConversationTitle(messages) {
	const firstUser = messages.find(
		(message) => message.role === "user"
	);

	if (!firstUser) {
		return "New Conversation";
	}

	const text = String(firstUser.content || "").trim();

	if (!text) {
		return "New Conversation";
	}

	const lower = text.toLowerCase();

	if (
		/^(hi|hello|hey|hii|helo|good morning|good afternoon|good evening)\b/.test(
			lower
		)
	) {
		return "Greeting Conversation";
	}

	if (lower.includes("math")) return "Mathematics";
	if (lower.includes("physics")) return "Physics Study";
	if (lower.includes("chemistry")) return "Chemistry Study";
	if (lower.includes("biology")) return "Biology Study";

	if (
		lower.includes("code") ||
		lower.includes("coding") ||
		lower.includes("program")
	) {
		return "Coding & Computer Science";
	}

	if (
		lower.includes("ai") ||
		lower.includes("artificial intelligence")
	) {
		return "AI Discussion";
	}

	if (
		lower.includes("university") ||
		lower.includes("college") ||
		lower.includes("scholarship")
	) {
		return "University & Scholarship";
	}

	if (text.length <= 42) {
		return text;
	}

	return text.substring(0, 42) + "...";
}

function saveCurrentChat() {
	if (temporaryChat) return;

	const userMessages = chatHistory.filter(
		(message) => message.role === "user"
	);

	if (userMessages.length === 0) return;

	const title = getConversationTitle(chatHistory);

	if (activeChatId !== null) {
		const index = savedChats.findIndex(
			(chat) => chat.id === activeChatId
		);

		if (index !== -1) {
			savedChats[index].messages = [...chatHistory];
			savedChats[index].title = title;
			savedChats[index].updatedAt = Date.now();

			saveChats();
			renderRecentChats();
			return;
		}
	}

	const newChat = {
		id: Date.now(),
		title,
		messages: [...chatHistory],
		pinned: false,
		updatedAt: Date.now(),
	};

	activeChatId = newChat.id;

	savedChats.unshift(newChat);
	savedChats = savedChats.slice(0, 100);

	saveChats();
	renderRecentChats();
}

/* =========================================================
   RECENT CHATS
   ========================================================= */

function renderRecentChats(filter = "") {
	if (!recentChats) return;

	recentChats.innerHTML = "";

	const searchText = String(filter || "").toLowerCase();

	const filtered = savedChats
		.filter((chat) =>
			String(chat.title || "")
				.toLowerCase()
				.includes(searchText)
		)
		.sort((a, b) => {
			if (a.pinned && !b.pinned) return -1;
			if (!a.pinned && b.pinned) return 1;

			return (
				(b.updatedAt || b.id || 0) -
				(a.updatedAt || a.id || 0)
			);
		});

	if (filtered.length === 0) {
		const empty = document.createElement("div");

		empty.style.padding = "10px";
		empty.style.color = "#6b7280";
		empty.style.fontSize = "13px";
		empty.textContent = "No recent chats";

		recentChats.appendChild(empty);

		return;
	}

	filtered.forEach((chat) => {
		const row = document.createElement("div");

		row.className = "recent-chat-row";

		const main = document.createElement("button");

		main.className = "recent-chat recent-chat-main";

		main.textContent =
			(chat.pinned ? "📌 " : "") +
			(chat.title || "Conversation");

		main.addEventListener("click", () => {
			activeChatId = chat.id;

			chatHistory = Array.isArray(chat.messages)
				? [...chat.messages]
				: [];

			displayHistory();

			if (sidebar) {
				sidebar.classList.remove("open");
			}
		});

		const actions = document.createElement("div");

		actions.className = "recent-chat-actions";

		const pin = document.createElement("button");

		pin.className = "recent-chat-action";
		pin.textContent = chat.pinned ? "📌" : "📍";
		pin.title = chat.pinned ? "Unpin" : "Pin";

		pin.addEventListener("click", (event) => {
			event.stopPropagation();

			chat.pinned = !chat.pinned;
			chat.updatedAt = Date.now();

			saveChats();

			renderRecentChats(
				recentSearch ? recentSearch.value : ""
			);
		});

		const rename = document.createElement("button");

		rename.className = "recent-chat-action";
		rename.textContent = "✏️";
		rename.title = "Rename";

		rename.addEventListener("click", (event) => {
			event.stopPropagation();

			const newTitle = prompt(
				"Rename this chat:",
				chat.title
			);

			if (newTitle && newTitle.trim()) {
				chat.title = newTitle.trim();
				chat.updatedAt = Date.now();

				saveChats();

				renderRecentChats(
					recentSearch ? recentSearch.value : ""
				);
			}
		});

		const remove = document.createElement("button");

		remove.className = "recent-chat-action";
		remove.textContent = "🗑️";
		remove.title = "Delete";

		remove.addEventListener("click", (event) => {
			event.stopPropagation();

			if (!confirm("Delete this conversation?")) {
				return;
			}

			savedChats = savedChats.filter(
				(item) => item.id !== chat.id
			);

			if (activeChatId === chat.id) {
				activeChatId = null;
			}

			saveChats();

			renderRecentChats(
				recentSearch ? recentSearch.value : ""
			);
		});

		actions.appendChild(pin);
		actions.appendChild(rename);
		actions.appendChild(remove);

		row.appendChild(main);
		row.appendChild(actions);

		recentChats.appendChild(row);
	});
}

/* =========================================================
   DISPLAY CHAT
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

	chatMessages.scrollTop =
		chatMessages.scrollHeight;
}

function startNewChat() {
	if (!temporaryChat) {
		saveCurrentChat();
	}

	activeChatId = null;
	temporaryChat = false;

	chatHistory = [
		{
			role: "assistant",
			content:
				"Hello! I'm Global AI Mahlet. What would you like to learn or explore?",
		},
	];

	updateTemporaryUI();
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

if (menuButton && sidebar) {
	menuButton.addEventListener("click", () => {
		sidebar.classList.toggle("open");
	});
}

if (recentSearch) {
	recentSearch.addEventListener("input", () => {
		renderRecentChats(recentSearch.value);
	});
}

if (languageSelect) {
	languageSelect.addEventListener("change", () => {
		const language = languageSelect.value;

		if (userInput) {
			userInput.placeholder =
				`Message Global AI Mahlet in ${language}...`;
		}
	});
}

/* =========================================================
   INPUT
   ========================================================= */

if (userInput) {
	userInput.addEventListener("input", function () {
		this.style.height = "auto";

		this.style.height =
			Math.min(this.scrollHeight, 180) + "px";
	});

	userInput.addEventListener("keydown", (event) => {
		if (
			event.key === "Enter" &&
			!event.shiftKey
		) {
			event.preventDefault();

			if (!isProcessing) {
				sendMessage(false);
			}
		}
	});
}

if (sendButton) {
	sendButton.addEventListener("click", () => {
		if (!isProcessing) {
			sendMessage(false);
		}
	});
}

/* =========================================================
   PHOTO / FILE / CAMERA
   ========================================================= */

if (photoButton && photoInput) {
	photoButton.addEventListener("click", () => {
		photoInput.click();
	});

	photoInput.addEventListener("change", () => {
		if (!photoInput.files?.length) return;

		const file = photoInput.files[0];

		addMessageToChat(
			"user",
			`🖼️ Photo selected: ${file.name}\n\nPhoto understanding is not connected to the AI vision backend yet.`
		);

		photoInput.value = "";
	});
}

if (fileButton && fileInput) {
	fileButton.addEventListener("click", () => {
		fileInput.click();
	});

	fileInput.addEventListener("change", () => {
		if (!fileInput.files?.length) return;

		const file = fileInput.files[0];

		addMessageToChat(
			"user",
			`📎 File selected: ${file.name}\n\nFile understanding is not connected to the document backend yet.`
		);

		fileInput.value = "";
	});
}

if (cameraButton && cameraInput) {
	cameraButton.addEventListener("click", () => {
		cameraInput.click();
	});

	cameraInput.addEventListener("change", () => {
		if (!cameraInput.files?.length) return;

		const file = cameraInput.files[0];

		addMessageToChat(
			"user",
			`📸 Camera image selected: ${file.name}\n\nCamera image understanding is not connected to the AI vision backend yet.`
		);

		cameraInput.value = "";
	});
}

/* =========================================================
   MESSAGE ACTIONS
   ========================================================= */

function createMessageActions(messageText) {
	const actions = document.createElement("div");

	actions.className = "message-actions";

	const copy = document.createElement("button");

	copy.className = "message-action";
	copy.textContent = "📋";
	copy.title = "Copy";

	copy.addEventListener("click", async () => {
		try {
			await navigator.clipboard.writeText(messageText);

			copy.textContent = "✅";

			setTimeout(() => {
				copy.textContent = "📋";
			}, 1200);
		} catch {
			copy.textContent = "❌";

			setTimeout(() => {
				copy.textContent = "📋";
			}, 1200);
		}
	});

	const like = document.createElement("button");

	like.className = "message-action";
	like.textContent = "👍";
	like.title = "Like";

	like.addEventListener("click", () => {
		like.textContent =
			like.textContent === "👍"
				? "👍🏻"
				: "👍";
	});

	const dislike = document.createElement("button");

	dislike.className = "message-action";
	dislike.textContent = "👎";
	dislike.title = "Dislike";

	dislike.addEventListener("click", () => {
		dislike.textContent =
			dislike.textContent === "👎"
				? "👎🏻"
				: "👎";
	});

	const share = document.createElement("button");

	share.className = "message-action";
	share.textContent = "↗️";
	share.title = "Share";

	share.addEventListener("click", async () => {
		try {
			if (navigator.share) {
				await navigator.share({
					title: "Global AI Mahlet",
					text: messageText,
					url: window.location.href,
				});
			} else {
				await navigator.clipboard.writeText(
					messageText
				);

				share.textContent = "✅";

				setTimeout(() => {
					share.textContent = "↗️";
				}, 1200);
			}
		} catch {
			// User cancelled sharing.
		}
	});

	actions.appendChild(copy);
	actions.appendChild(like);
	actions.appendChild(dislike);
	actions.appendChild(share);

	return actions;
}

function addMessageToChat(role, content) {
	if (!chatMessages) return null;

	const messageEl = document.createElement("div");

	messageEl.className =
		`message ${role}-message`;

	const avatarEl = document.createElement("div");

	avatarEl.className = "avatar";

	avatarEl.textContent =
		role === "user"
			? "👤"
			: currentAvatar;

	const contentBox = document.createElement("div");

	contentBox.className = "message-content";

	const nameEl = document.createElement("div");

	nameEl.className = "message-name";

	nameEl.textContent =
		role === "user"
			? "You"
			: "Global AI Mahlet";

	const textEl = document.createElement("div");

	textEl.className = "message-text";

	textEl.textContent = String(content ?? "");

	contentBox.appendChild(nameEl);
	contentBox.appendChild(textEl);

	if (role === "assistant") {
		contentBox.appendChild(
			createMessageActions(
				String(content ?? "")
			)
		);
	}

	messageEl.ap
