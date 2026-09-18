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

let chatHistory = [
	{
		role: "assistant",
		content:
			"Hello! I'm Global AI Mahlet. I can help you learn, solve problems, explain concepts, practice questions, and much more. 🌍",
	},
];

let savedChats = JSON.parse(localStorage.getItem("globalAIChats") || "[]");

function saveChats() {
	if (temporaryChat) return;

	localStorage.setItem("globalAIChats", JSON.stringify(savedChats));
}

function saveCurrentChat() {
	if (temporaryChat) return;
	if (chatHistory.length <= 1) return;

	const firstUserMessage = chatHistory.find(
		(message) => message.role === "user",
	);

	if (!firstUserMessage) return;

	const title =
		firstUserMessage.content.length > 45
			? firstUserMessage.content.substring(0, 45) + "..."
			: firstUserMessage.content;

	savedChats.unshift({
		id: Date.now(),
		title,
		messages: [...chatHistory],
	});

	savedChats = savedChats.slice(0, 50);
	saveChats();
	renderRecentChats();
}

function renderRecentChats(filter = "") {
	recentChats.innerHTML = "";

	const filtered = savedChats.filter((chat) =>
		chat.title.toLowerCase().includes(filter.toLowerCase()),
	);

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
		const button = document.createElement("button");
		button.className = "recent-chat";
		button.textContent = chat.title;

		button.addEventListener("click", () => {
			chatHistory = [...chat.messages];
			displayHistory();
			sidebar.classList.remove("open");
		});

		recentChats.appendChild(button);
	});
}

function displayHistory() {
	chatMessages.innerHTML = "";

	chatHistory.forEach((message) => {
		addMessageToChat(message.role, message.content);
	});

	chatMessages.scrollTop = chatMessages.scrollHeight;
}

function startNewChat() {
	if (!temporaryChat) {
		saveCurrentChat();
	}

	chatHistory = [
		{
			role: "assistant",
			content:
				"Hello! I'm Global AI Mahlet. What would you like to learn or explore?",
		},
	];

	temporaryChat = false;
	temporaryChatButton.textContent = "🗑️";

	displayHistory();
	userInput.value = "";
	userInput.focus();
}

newChatButton.addEventListener("click", startNewChat);

menuButton.addEventListener("click", () => {
	sidebar.classList.toggle("open");
});

recentSearch.addEventListener("input", () => {
	renderRecentChats(recentSearch.value);
});

temporaryChatButton.addEventListener("click", () => {
	temporaryChat = !temporaryChat;

	if (temporaryChat) {
		temporaryChatButton.textContent = "🗑️✓";
		temporaryChatButton.title = "Temporary chat ON";
	} else {
		temporaryChatButton.textContent = "🗑️";
		temporaryChatButton.title = "Temporary chat OFF";
	}
});

languageSelect.addEventListener("change", () => {
	const language = languageSelect.value;

	userInput.placeholder = `Message Global AI Mahlet in ${language}...`;
});

userInput.addEventListener("input", function () {
	this.style.height = "auto";
	this.style.height = Math.min(this.scrollHeight, 180) + "px";
});

userInput.addEventListener("keydown", function (event) {
	if (event.key === "Enter" && !event.shiftKey) {
		event.preventDefault();
		sendMessage();
	}
});

sendButton.addEventListener("click", sendMessage);

/* PHOTO */

photoButton.addEventListener("click", () => {
	photoInput.click();
});

photoInput.addEventListener("change", () => {
	if (photoInput.files.length > 0) {
		const file = photoInput.files[0];

		addMessageToChat(
			"user",
			`🖼️ Photo selected: ${file.name}\n\nPhoto understanding will be connected to the AI backend next.`,
		);

		photoInput.value = "";
	}
});

/* FILE */

fileButton.addEventListener("click", () => {
	fileInput.click();
});

fileInput.addEventListener("change", async () => {
	if (fileInput.files.length === 0) return;

	const file = fileInput.files[0];

	addMessageToChat(
		"user",
		`📎 File selected: ${file.name}\n\nFile processing will be connected to the AI backend next.`,
	);

	fileInput.value = "";
});

/* CAMERA */

cameraButton.addEventListener("click", () => {
	cameraInput.click();
});

cameraInput.addEventListener("change", () => {
	if (cameraInput.files.length > 0) {
		const file = cameraInput.files[0];

		addMessageToChat(
			"user",
			`📸 Camera image selected: ${file.name}\n\nCamera image understanding will be connected to the AI backend next.`,
		);

		cameraInput.value = "";
	}
});

/* VOICE */

let recognition = null;

const SpeechRecognition =
	window.SpeechRecognition || window.webkitSpeechRecognition;

if (SpeechRecognition) {
	recognition = new SpeechRecognition();
	recognition.continuous = false;
	recognition.interimResults = false;

	recognition.onstart = () => {
		voiceButton.textContent = "🔴";
		voiceButton.title = "Listening...";
	};

	recognition.onend = () => {
		voiceButton.textContent = "🎤";
		voiceButton.title = "Voice input";
	};

	recognition.onresult = (event) => {
		const transcript = event.results[0][0].transcript;

		userInput.value +=
			(userInput.value ? " " : "") + transcript;

		userInput.dispatchEvent(new Event("input"));
	};
}

voiceButton.addEventListener("click", () => {
	if (!recognition) {
		alert(
			"Voice input is not supported by this browser. Please try a browser that supports speech recognition.",
		);
		return;
	}

	recognition.lang = getSpeechLanguage(languageSelect.value);

	try {
		recognition.start();
	} catch (error) {
		console.log("Voice recognition:", error);
	}
});

function getSpeechLanguage(language) {
	const languages = {
		English: "en-US",
		Amharic: "am-ET",
		Arabic: "ar-SA",
		Chinese: "zh-CN",
		Spanish: "es-ES",
		French: "fr-FR",
		Portuguese: "pt-BR",
		Russian: "ru-RU",
		German: "de-DE",
		Italian: "it-IT",
		Japanese: "ja-JP",
		Korean: "ko-KR",
		Hindi: "hi-IN",
		Urdu: "ur-PK",
		Bengali: "bn-BD",
		Turkish: "tr-TR",
		Swahili: "sw-KE",
		Somali: "so-SO",
		Oromo: "om-ET",
		Tigrinya: "ti-ET",
	};

	return languages[language] || "en-US";
}

/* SEND MESSAGE */

async function sendMessage() {
	const message = userInput.value.trim();

	if (message === "" || isProcessing) return;

	isProcessing = true;
	userInput.disabled = true;
	sendButton.disabled = true;

	addMessageToChat("user", message);

	userInput.value = "";
	userInput.style.height = "auto";

	typingIndicator.classList.add("visible");

	chatHistory.push({
		role: "user",
		content: message,
	});

	try {
		const assistantMessageEl = document.createElement("div");
		assistantMessageEl.className = "message assistant-message";

		assistantMessageEl.innerHTML = `
			<div class="avatar">🤖</div>
			<div class="message-content">
				<div class="message-name">Global AI Mahlet</div>
				<div class="message-text"></div>
			</div>
		`;

		chatMessages.appendChild(assistantMessageEl);

		const assistantTextEl =
			assistantMessageEl.querySelector(".message-text");

		const language = languageSelect.value;

		const messagesForAI = [
			{
				role: "system",
				content: `You are Global AI Mahlet, a helpful AI assistant and study tutor. Answer clearly and accurately. Help with Mathematics, Physics, Chemistry, Biology, Computer Science, coding, learning, explanations, summaries, and practice questions. When appropriate, teach the concept instead of only giving the answer. Respond in ${language} unless the user requests another language.`,
			},
			...chatHistory,
		];

		const response = await fetch("/api/chat", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				messages: messagesForAI,
			}),
		});

		if (!response.ok) {
			throw new Error("Failed to get response from AI");
		}

		if (!response.body) {
			throw new Error("Response body is empty");
		}

		const reader = response.body.getReader();
		const decoder = new TextDecoder();

		let responseText = "";
		let buffer = "";

		while (true) {
			const { done, value } = await reader.read();

			if (done) break;

			buffer += decoder.decode(value, {
				stream: true,
			});

			const parsed = consumeSseEvents(buffer);

			buffer = parsed.buffer;

			for (const data of parsed.events) {
				if (data === "[DONE]") continue;

				try {
					const jsonData = JSON.parse(data);

					let content = "";

					if (typeof jsonData.response === "string") {
						content = jsonData.response;
					} else if (
						jsonData.choices?.[0]?.delta?.content
					) {
						content =
							jsonData.choices[0].delta.content;
					}

					if (content) {
						responseText += content;
						assistantTextEl.textContent = responseText;

						chatMessages.scrollTop =
							chatMessages.scrollHeight;
					}
				} catch (error) {
					console.log("SSE parsing:", error);
				}
			}
		}

		if (responseText) {
			chatHistory.push({
				role: "assistant",
				content: responseText,
			});
		}
	} catch (error) {
		console.error(error);

		addMessageToChat(
			"assistant",
			"Sorry, I couldn't process that request. Please try again.",
		);
	} finally {
		typingIndicator.classList.remove("visible");

		isProcessing = false;
		userInput.disabled = false;
		sendButton.disabled = false;

		userInput.focus();
	}
}

function addMessageToChat(role, content) {
	const messageEl = document.createElement("div");

	messageEl.className = `message ${role}-message`;

	const avatar = role === "user" ? "👤" : "🤖";
	const name = role === "user" ? "You" : "Global AI Mahlet";

	messageEl.innerHTML = `
		<div class="avatar">${avatar}</div>
		<div class="message-content">
			<div class="message-name">${name}</div>
			<div class="message-text"></div>
		</div>
	`;

	const textElement =
		messageEl.querySelector(".message-text");

	textElement.textContent = content;

	chatMessages.appendChild(messageEl);

	chatMessages.scrollTop = chatMessages.scrollHeight;
}

function consumeSseEvents(buffer) {
	const normalized = buffer.replace(/\r/g, "");

	const events = [];
	let remaining = normalized;
	let eventEndIndex;

	while (
		(eventEndIndex = remaining.indexOf("\n\n")) !== -1
	) {
		const rawEvent = remaining.slice(0, eventEndIndex);

		remaining = remaining.slice(eventEndIndex + 2);

		const lines = rawEvent.split("\n");
		const dataLines = [];

		for (const line of lines) {
			if (line.startsWith("data:")) {
				dataLines.push(
					line.slice("data:".length).trimStart(),
				);
			}
		}

		if (dataLines.length > 0) {
			events.push(dataLines.join("\n"));
		}
	}

	return {
		events,
		buffer: remaining,
	};
}

renderRecentChats();
