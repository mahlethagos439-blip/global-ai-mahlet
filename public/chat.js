<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Chat - Global AI Mahlet</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <script src="https://unpkg.com/lucide@latest"></script>
    <style>
        body { font-family: 'Inter', sans-serif; background: #f8fafc; color: #1e293b; }
        .glass-card { background: rgba(255, 255, 255, 0.9); backdrop-filter: blur(12px); border: 1px solid rgba(226, 232, 240, 0.8); }
    </style>
</head>
<body class="min-h-screen flex flex-col justify-between">
    <!-- Header -->
    <header class="flex items-center justify-between px-6 py-4 glass-card border-b sticky top-0 z-20">
        <div class="flex items-center space-x-3">
            <button onclick="window.location.href='/'" class="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 hover:bg-slate-200 transition">
                <i data-lucide="arrow-left" style="width:18px;height:18px;"></i>
            </button>
            <div class="w-9 h-9 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold">M</div>
            <div>
                <h1 class="text-sm font-bold text-slate-800">Global AI Mahlet</h1>
                <p class="text-[10px] text-emerald-600 font-medium">● Online & Ready</p>
            </div>
        </div>
        <button onclick="location.reload()" class="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 hover:bg-slate-200 transition" title="New Chat">
            <i data-lucide="rotate-ccw" style="width:16px;height:16px;"></i>
        </button>
    </header>

    <!-- Chat Messages Stream -->
    <main id="chatContainer" class="max-w-3xl mx-auto w-full px-4 py-6 flex-1 space-y-4 overflow-y-auto">
        <!-- Dynamic messages load here -->
    </main>

    <!-- Input Box -->
    <div class="max-w-3xl mx-auto w-full p-4">
        <div class="glass-card p-3 rounded-3xl shadow-lg flex items-center space-x-3">
            <input type="text" id="chatInput" placeholder="Reply to Global AI Mahlet..." class="w-full bg-transparent text-sm text-slate-800 focus:outline-none px-2">
            <button id="sendChatBtn" class="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-md hover:bg-indigo-700 transition">
                <i data-lucide="send" style="width:16px;height:16px;"></i>
            </button>
        </div>
    </div>

    <script>
        window.addEventListener('DOMContentLoaded', () => {
            if (typeof lucide !== 'undefined') lucide.createIcons();

            const urlParams = new URLSearchParams(window.location.search);
            const query = urlParams.get('q') || "Hello! How can you help me today?";
            const chatContainer = document.getElementById('chatContainer');

            function appendMessage(sender, text) {
                const isUser = sender === 'user';
                const div = document.createElement('div');
                div.className = `flex ${isUser ? 'justify-end' : 'justify-start'}`;
                div.innerHTML = `
                    <div class="max-w-[80%] rounded-2xl px-4 py-3 text-sm shadow-sm ${isUser ? 'bg-indigo-600 text-white rounded-br-none' : 'glass-card text-slate-800 rounded-bl-none'}">
                        <p class="font-medium text-xs opacity-80 mb-1">${isUser ? 'You' : 'Global AI Mahlet'}</p>
                        <p class="leading-relaxed">${text}</p>
                    </div>
                `;
                chatContainer.appendChild(div);
                chatContainer.scrollTop = chatContainer.scrollHeight;
            }

            // User prompt
            appendMessage('user', query);

            // AI Response simulation
            setTimeout(() => {
                appendMessage('ai', `I've received your request about "${query}". As Global AI Mahlet, I am fully prepared to guide you through this with customized insights and intelligent support! 💜`);
            }, 600);

            const handleSend = () => {
                const input = document.getElementById('chatInput');
                if (input.value.trim()) {
                    const text = input.value;
                    appendMessage('user', text);
                    input.value = '';
                    setTimeout(() => {
                        appendMessage('ai', `That's a great follow-up regarding "${text}". Let me help you break that down step-by-step.`);
                    }, 600);
                }
            };

            document.getElementById('sendChatBtn').addEventListener('click', handleSend);
            document.getElementById('chatInput').addEventListener('keypress', (e) => { if(e.key === 'Enter') handleSend(); });
        });
    </script>
</body>
</html>
      
