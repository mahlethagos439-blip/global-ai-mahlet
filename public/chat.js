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
let currentAvatar = "🤖";

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

let savedChats = JSON.parse(
	localStorage.getItem("globalAIChats") || "[]",
);

/* =========================================================
   STYLES ADDED FOR THE NEW FEATURES
========================================================= */

const style = document.createElement("style");

style.textContent = `
	.sidebar-close-button {
		position: absolute;
		top: 12px;
		right: 12px;
		border: none;
		background: transparent;
		font-size: 24px;
		cursor: pointer;
	}

	.sidebar {
		position: relative;
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
	}

	.temporary-circle {
		width: 20px;
		height: 20px;
		border-radius: 50%;
		border: 2px solid currentColor;
		display: inline-block;
	}

	.temporary-circle.active {
		background: currentColor;
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
		z-index: 1000;
		padding: 16px 22px;
		border-radius: 20px;
		background: rgba(20,20,20,.92);
		color: white;
		text-align: center;
		box-shadow: 0 8px 30px rgba(0,0,0,.3);
	}

	.voice-avatar-face {
		font-size: 70px;
		line-height: 1.1;
	}

	.voice-avatar-face.talking {
		transform: scale(1.08);
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
		padding: 3px;
	}

	.avatar-choice.selected {
		border-color: currentColor;
	}

	.pinned-chat {
		font-weight: 600;
	}
`;

document.head.appendChild(style);

/* =========================================================
   SIDEBAR CLOSE BUTTON
========================================================= */

const closeSidebarButton = document.createElement("button");
closeSidebarButton.className = "sidebar-close-button";
closeSidebarButton.textContent = "✕";
closeSidebarButton.title = "Close";
closeSidebarButton.addEventListener("click", () => {
	sidebar.classList.remove("open");
});

sidebar.appendChild(closeSidebarButton);

/* =========================================================
   TEMPORARY CHAT CONTROL
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

sidebar.insertBefore(
	temporaryControl,
	recentChats,
);

function updateTemporaryUI() {
	const circle = temporaryControl.querySelector(
		".temporary-circle",
	);

	circle.classList.toggle("active", temporaryChat);

	if (temporaryChat) {
		temporaryControl.title = "Temporary Chat is ON";
	} else {
		temporaryControl.title = "Temporary Chat is OFF";
	}

	temporaryChatButton.textContent = temporaryChat
		? "🗑️✓"
		: "🗑️";
}

temporaryControl.addEventListener("click", () => {
	temporaryChat = !temporaryChat;
	updateTemporaryUI();
});

/* Keep the old button working too. */
temporaryChatButton.addEventListener("click", () => {
	temporaryChat = !temporaryChat;
	updateTemporaryUI();
});

/* =========================================================
   AVATAR PICKER
========================================================= */

const avatarArea = document.createElement("div");
avatarArea.innerHTML = `
	<div style="margin-top:12px;font-size:13px;">
		<strong>Choose AI Avatar</strong>
	</div>
	<div class="avatar-picker"></div>
`;

sidebar.insertBefore(avatarArea, recentChats);

const avatarPicker = avatarArea.querySelector(".avatar-picker");

function renderAvatarPicker() {
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
				currentAvatar,
			);
			renderAvatarPicker();
		});

		avatarPicker.appendChild(button);
	});
}

currentAvatar =
	localStorage.getItem("globalAIAvatar") || "🤖";

renderAvatarPicker();

/* =========================================================
   CHAT STORAGE
========================================================= */

function saveChats() {
	if (temporaryChat) return;

	localStorage.setItem(
		"globalAIChats",
		JSON.stringify(savedChats),
	);
}

/*
  One conversation stays ONE recent chat.
  New messages update that conversation instead of creating
  another recent item.
*/

function getConversationTitle(messages) {
	const firstUser = messages.find(
		(message) => message.role === "user",
	);

	if (!firstUser) {
		return "New Conversation";
	}

	const text = firstUser.content.trim();

	const lower = text.toLowerCase();

	if (
		lower.match(
			/^(hi|hello|hey|hii|helo|good morning|good afternoon|good evening)\b/,
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
		(message) => message.role === "user",
	);

	if (userMessages.length === 0) return;

	const title = getConversationTitle(chatHistory);

	if (activeChatId !== null) {
		const existingIndex = savedChats.findIndex(
			(chat) => chat.id === activeChatId,
		);

		if (existingIndex !== -1) {
			savedChats[existingIndex].messages = [
				...chatHistory,
			];

			savedChats[existingIndex].title = title;

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
	};

	activeChatId = newChat.id;

	savedChats.unshift(newChat);

	savedChats = savedChats.slice(0, 100);

	saveChats();
	renderRecentChats();
}

/* =========================================================
   RECENT CHAT LIST
========================================================= */

function renderRecentChats(filter = "") {
	recentChats.innerHTML = "";

	const searchText = filter.toLowerCase();

	const filtered = savedChats
		.filter((chat) =>
			chat.title
				.toLowerCase()
				.includes(searchText),
		)
		.sort((a, b) => {
			if (a.pinned && !b.pinned) return -1;
			if (!a.pinned && b.pinned) return 1;
			return b.id - a.id;
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

		if (chat.pinned) {
			main.classList.add("pinned-chat");
		}

		main.textContent =
			(chat.pinned ? "📌 " : "") +
			chat.title;

		main.addEventListener("click", () => {
			activeChatId = chat.id;
			chatHistory = [...chat.messages];

			displayHistory();

			sidebar.classList.remove("open");
		});

		const actions =
			document.createElement("div");

		actions.className = "recent-chat-actions";

		/* PIN */

		const pin = document.createElement("button");

		pin.className = "recent-chat-action";
		pin.textContent = chat.pinned ? "📌" : "📍";
		pin.title = chat.pinned
			? "Unpin"
			: "Pin";

		pin.addEventListener("click", (event) => {
			event.stopPropagation();

			chat.pinned = !chat.pinned;

			saveChats();
			renderRecentChats(
				recentSearch.value,
			);
		});

		/* RENAME */

		const rename =
			document.createElement("button");

		rename.className = "recent-chat-action";
		rename.textContent = "✏️";
		rename.title = "Rename";

		rename.addEventListener("click", (event) => {
			event.stopPropagation();

			const newTitle = prompt(
				"Rename this chat:",
				chat.title,
			);

			if (
				newTitle &&
				newTitle.trim()
			) {
				chat.title =
					newTitle.trim();

				saveChats();
				renderRecentChats(
					recentSearch.value,
				);
			}
		});

		/* DELETE */

		const remove =
			document.createElement("button");

		remove.className =
			"recent-chat-action";

		remove.textContent = "🗑️";
		remove.title = "Delete";

		remove.addEventListener(
			"click",
			(event) => {
				event.stopPropagation();

				const confirmed =
					confirm(
						"Delete this conversation?",
					);

				if (!confirmed) return;

				savedChats =
					savedChats.filter(
						(item) =>
							item.id !==
							chat.id,
					);

				if (
					activeChatId ===
					chat.id
				) {
					activeChatId = null;
				}

				saveChats();
				renderRecentChats(
					recentSearch.value,
				);
			},
		);

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
	chatMessages.innerHTML = "";

	chatHistory.forEach((message) => {
		addMessageToChat(
			message.role,
			message.content,
		);
	});

	chatMessages.scrollTop =
		chatMessages.scrollHeight;
}

/* =========================================================
   NEW CHAT
========================================================= */

function startNewChat() {
	if (!temporaryChat) {
		saveCurrentChat();
	}

	activeChatId = null;

	chatHistory = [
		{
			role: "assistant",
			content:
				"Hello! I'm Global AI Mahlet. What would you like to learn or explore?",
		},
	];

	temporaryChat = false;

	updateTemporaryUI();

	displayHistory();

	userInput.value = "";
	userInput.focus();
}

newChatButton.addEventListener(
	"click",
	startNewChat,
);

/* =========================================================
   MENU
========================================================= */

menuButton.addEventListener("click", () => {
	sidebar.classList.toggle("open");
});

recentSearch.addEventListener(
	"input",
	() => {
		renderRecentChats(
			recentSearch.value,
		);
	},
);

languageSelect.addEventListener(
	"change",
	() => {
		const language =
			languageSelect.value;

		userInput.placeholder =
			`Message Global AI Mahlet in ${language}...`;
	},
);

/* =========================================================
   TEXT INPUT
========================================================= */

userInput.addEventListener(
	"input",
	function () {
		this.style.height = "auto";

		this.style.height =
			Math.min(
				this.scrollHeight,
				180,
			) + "px";
	},
);

userInput.addEventListener(
	"keydown",
	(event) => {
		if (
			event.key === "Enter" &&
			!event.shiftKey
		) {
			event.preventDefault();
			sendMessage(false);
		}
	},
);

sendButton.addEventListener(
	"click",
	() => sendMessage(false),
);

/* =========================================================
   PHOTO
========================================================= */

photoButton.addEventListener(
	"click",
	() => {
		photoInput.click();
	},
);

photoInput.addEventListener(
	"change",
	() => {
		if (!photoInput.files.length)
			return;

		const file =
			photoInput.files[0];

		addMessageToChat(
			"user",
			`🖼️ Photo selected: ${file.name}\n\nPhoto understanding will be connected to the AI vision backend next.`,
		);

		photoInput.value = "";
	},
);

/* =========================================================
   FILE
========================================================= */

fileButton.addEventListener(
	"click",
	() => {
		fileInput.click();
	},
);

fileInput.addEventListener(
	"change",
	() => {
		if (!fileInput.files.length)
			return;

		const file =
			fileInput.files[0];

		addMessageToChat(
			"user",
			`📎 File selected: ${file.name}\n\nFile understanding will be connected to the document backend next.`,
		);

		fileInput.value = "";
	},
);

/* =========================================================
   CAMERA
========================================================= */

cameraButton.addEventListener(
	"click",
	() => {
		cameraInput.click();
	},
);

cameraInput.addEventListener(
	"change",
	() => {
		if (!cameraInput.files.length)
			return;

		const file =
			cameraInput.files[0];

		addMessageToChat(
			"user",
			`📸 Camera image selected: ${file.name}\n\nCamera image understanding will be connected to the AI vision backend next.`,
		);

		cameraInput.value = "";
	},
);

/* =========================================================
   MESSAGE ACTIONS
========================================================= */

function createMessageActions(
	messageText,
) {
	const actions =
		document.createElement("div");

	actions.className =
		"message-actions";

	/* COPY */

	const copy =
		document.createElement("button");

	copy.className = "message-action";
	copy.textContent = "📋";
	copy.title = "Copy";

	copy.addEventListener(
		"click",
		async () => {
			try {
				await navigator.clipboard.writeText(
					messageText,
				);

				copy.textContent = "✅";
			} catch {
				copy.textContent = "❌";
			}

			setTimeout(() => {
				copy.textContent = "📋";
			}, 1200);
		},
	);

	/* LIKE */

	const like =
		document.createElement("button");

	like.className = "message-action";
	like.textContent = "👍";
	like.title = "Like";

	like.addEventListener(
		"click",
		() => {
			like.textContent =
				like.textContent === "👍"
					? "👍🏻"
					: "👍";
		},
	);

	/* DISLIKE */

	const dislike =
		document.createElement("button");

	dislike.className =
		"message-action";

	dislike.textContent = "👎";
	dislike.title = "Dislike";

	dislike.addEventListener(
		"click",
		() => {
			dislike.textContent =
				dislike.textContent === "👎"
					? "👎🏻"
					: "👎";
		},
	);

	/* SHARE */

	const share =
		document.createElement("button");

	share.className =
		"message-action";

	share.textContent = "↗️";
	share.title = "Share";

	share.addEventListener(
		"click",
		async () => {
			if (navigator.share) {
				try {
					await navigator.share({
						title:
							"Global AI Mahlet",
						text: messageText,
						url:
							window.location.href,
					});
				} catch {}
			} else {
				try {
					await navigator.clipboard.writeText(
						messageText,
					);

					share.textContent =
						"✅";

					setTimeout(
						() => {
							share.textContent =
								"↗️";
						},
						1200,
					);
				} catch {}
			}
		},
	);

	actions.appendChild(copy);
	actions.appendChild(like);
	actions.appendChild(dislike);
	actions.appendChild(share);

	return actions;
}

/* =========================================================
   ADD MESSAGE
========================================================= */

function addMessageToChat(
	role,
	content,
) {
	const messageEl =
		document.createElement("div");

	messageEl.className =
		`message ${role}-message`;

	const avatar =
		role === "user"
			? "👤"
			: currentAvatar;

	const name =
		role === "user"
			? "You"
			: "Global AI Mahlet";

	messageEl.innerHTML = `
		<div class="avatar">${avatar}</div>
		<div class="message-content">
			<div class="message-name">${name}</div>
			<div class="message-text"></div>
		</div>
	`;

	const textElement =
		messageEl.querySelector(
			".message-text",
		);

	textElement.textContent =
		content;

	if (role === "assistant") {
		const contentBox =
			messageEl.querySelector(
				".message-content",
			);

		contentBox.appendChild(
			createMessageActions(content),
		);
	}

	chatMessages.appendChild(
		messageEl,
	);

	chatMessages.scrollTop =
		chatMessages.scrollHeight;

	return messageEl;
}

/* =========================================================
   VOICE AVATAR
========================================================= */

let voicePanel = null;

function createVoicePanel() {
	if (voicePanel) return;

	voicePanel =
		document.createElement("div");

	voicePanel.className =
		"voice-avatar-panel";

	voicePanel.innerHTML = `
		<div class="voice-avatar-face">${currentAvatar}</div>
		<div class="voice-status">
			Voice mode is ON
		</div>
	`;

	document.body.appendChild(
		voicePanel,
	);
}

function updateVoiceAvatar(
	talking,
	status,
) {
	if (!voicePanel) return;

	const face =
		voicePanel.querySelector(
			".voice-avatar-face",
		);

	const statusText =
		voicePanel.querySelector(
			".voice-status",
		);

	face.textContent =
		talking
			? "🗣️"
			: currentAvatar;

	face.classList.toggle(
		"talking",
		
