export default {
  async fetch(request: Request): Promise<Response> {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Global AI Mahlet</title>
    <!-- Tailwind CSS CDN -->
    <script src="https://cdn.tailwindcss.com"></script>
    <!-- Google Fonts: Inter -->
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <!-- Lucide Icons -->
    <script src="https://unpkg.com/lucide@latest"></script>
    <style>
        body {
            font-family: 'Inter', sans-serif;
            background: linear-gradient(135deg, #f5f7ff 0%, #fdfcff 50%, #f4f8ff 100%);
            color: #1e293b;
        }
        .glass-card {
            background: rgba(255, 255, 255, 0.85);
            backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.6);
        }
    </style>
</head>
<body class="min-h-screen flex flex-col justify-between relative overflow-x-hidden pb-6">

    <!-- Top Background Decorative Gradient Glows -->
    <div class="absolute top-0 left-0 w-full h-72 bg-gradient-to-r from-blue-100/40 via-purple-100/40 to-pink-100/20 -z-10 rounded-b-[40px]"></div>

    <!-- Hidden File Inputs -->
    <input type="file" id="cameraInput" accept="image/*" capture="environment" class="hidden">
    <input type="file" id="fileInput" class="hidden">
    <input type="file" id="galleryInput" accept="image/*" class="hidden">

    <!-- Main Container -->
    <div class="max-w-4xl mx-auto w-full px-4 pt-6 flex-1 flex flex-col justify-between">
        
        <div>
            <!-- Header -->
            <header class="flex items-center justify-between mb-8">
                <div class="flex items-center space-x-3">
                    <div class="w-12 h-12 rounded-full overflow-hidden shadow-md shadow-indigo-200 bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center text-white">
                        <i data-lucide="bot" style="width:24px;height:24px;"></i>
                    </div>
                    <div>
                        <h1 class="text-xl font-bold bg-gradient-to-r from-blue-700 to-purple-600 bg-clip-text text-transparent">Global AI Mahlet</h1>
                        <p class="text-xs text-slate-500 font-medium">Your AI Partner for a Smarter Future</p>
                    </div>
                </div>
                <button id="menuBtn" class="w-11 h-11 rounded-full glass-card flex items-center justify-center text-slate-700 shadow-sm border border-slate-200/65 active:scale-95 transition cursor-pointer">
                    <i data-lucide="menu" style="width:20px;height:20px;"></i>
                </button>
            </header>

            <!-- Greeting Section -->
            <section class="text-center mb-8 px-2 max-w-xl mx-auto">
                <h2 class="text-3xl font-extrabold tracking-tight text-slate-900 mb-2">
                    Hello, <span class="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">Mahlet</span> ✨
                </h2>
                <p class="text-sm text-slate-500 leading-relaxed font-normal">
                    I'm Global AI Mahlet — your smart assistant. Ask me anything, anytime. I'm here to help you learn, create, solve, and grow! <span class="text-indigo-500">💜</span>
                </p>
            </section>

            <!-- Feature Cards Grid (3 columns matching your exact image layout) -->
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                <!-- 1. Study Help -->
                <div data-feature="Study Help" class="feature-card glass-card p-4 rounded-3xl shadow-sm hover:shadow-md transition cursor-pointer flex flex-col justify-between border border-blue-100/60 bg-gradient-to-br from-blue-50/50 to-white">
                    <div>
                        <div class="w-10 h-10 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center mb-3"><i data-lucide="graduation-cap" style="width:20px;height:20px;"></i></div>
                        <h3 class="text-sm font-semibold text-slate-800 mb-0.5">Study Help</h3>
                        <p class="text-[11px] text-slate-500 leading-tight">Learn faster & better</p>
                    </div>
                    <div class="mt-4 flex justify-end"><div class="w-7 h-7 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center"><i data-lucide="arrow-right" style="width:14px;height:14px;"></i></div></div>
                </div>

                <!-- 2. Coding & Tech -->
                <div data-feature="Coding & Tech" class="feature-card glass-card p-4 rounded-3xl shadow-sm hover:shadow-md transition cursor-pointer flex flex-col justify-between border border-purple-100/60 bg-gradient-to-br from-purple-50/50 to-white">
                    <div>
                        <div class="w-10 h-10 rounded-2xl bg-purple-100 text-purple-600 flex items-center justify-center mb-3"><i data-lucide="code" style="width:20px;height:20px;"></i></div>
                        <h3 class="text-sm font-semibold text-slate-800 mb-0.5">Coding & Tech</h3>
                        <p class="text-[11px] text-slate-500 leading-tight">Build your skills</p>
                    </div>
                    <div class="mt-4 flex justify-end"><div class="w-7 h-7 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center"><i data-lucide="arrow-right" style="width:14px;height:14px;"></i></div></div>
                </div>

                <!-- 3. Ideas & Creativity -->
                <div data-feature="Ideas & Creativity" class="feature-card glass-card p-4 rounded-3xl shadow-sm hover:shadow-md transition cursor-pointer flex flex-col justify-between border border-emerald-100/60 bg-gradient-to-br from-emerald-50/50 to-white">
                    <div>
                        <div class="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-3"><i data-lucide="lightbulb" style="width:20px;height:20px;"></i></div>
                        <h3 class="text-sm font-semibold text-slate-800 mb-0.5">Ideas & Creativity</h3>
                        <p class="text-[11px] text-slate-500 leading-tight">Turn ideas into reality</p>
                    </div>
                    <div class="mt-4 flex justify-end"><div class="w-7 h-7 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center"><i data-lucide="arrow-right" style="width:14px;height:14px;"></i></div></div>
                </div>

                <!-- 4. Write & Improve -->
                <div data-feature="Write & Improve" class="feature-card glass-card p-4 rounded-3xl shadow-sm hover:shadow-md transition cursor-pointer flex flex-col justify-between border border-amber-100/60 bg-gradient-to-br from-amber-50/50 to-white">
                    <div>
                        <div class="w-10 h-10 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mb-3"><i data-lucide="file-text" style="width:20px;height:20px;"></i></div>
                        <h3 class="text-sm font-semibold text-slate-800 mb-0.5">Write & Improve</h3>
                        <p class="text-[11px] text-slate-500 leading-tight">Better writing, clearer</p>
                    </div>
                    <div class="mt-4 flex justify-end"><div class="w-7 h-7 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center"><i data-lucide="arrow-right" style="width:14px;height:14px;"></i></div></div>
                </div>

                <!-- 5. Global Information -->
                <div data-feature="Global Information" class="feature-card glass-card p-4 rounded-3xl shadow-sm hover:shadow-md transition cursor-pointer flex flex-col justify-between border border-rose-100/60 bg-gradient-to-br from-rose-50/50 to-white">
                    <div>
                        <div class="w-10 h-10 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mb-3"><i data-lucide="globe" style="width:20px;height:20px;"></i></div>
                        <h3 class="text-sm font-semibold text-slate-800 mb-0.5">Global Information</h3>
                        <p class="text-[11px] text-slate-500 leading-tight">Explore the world</p>
                    </div>
                    <div class="mt-4 flex justify-end"><div class="w-7 h-7 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center"><i data-lucide="arrow-right" style="width:14px;height:14px;"></i></div></div>
                </div>

                <!-- 6. Your Goals -->
                <div data-feature="Your Goals" class="feature-card glass-card p-4 rounded-3xl shadow-sm hover:shadow-md transition cursor-pointer flex flex-col justify-between border border-sky-100/60 bg-gradient-to-br from-sky-50/50 to-white">
                    <div>
                        <div class="w-10 h-10 rounded-2xl bg-sky-100 text-sky-600 flex items-center justify-center mb-3"><i data-lucide="target" style="width:20px;height:20px;"></i></div>
                        <h3 class="text-sm font-semibold text-slate-800 mb-0.5">Your Goals</h3>
                        <p class="text-[11px] text-slate-500 leading-tight">Plan. Learn. Achieve.</p>
                    </div>
                    <div class="mt-4 flex justify-end"><div class="w-7 h-7 rounded-full bg-sky-50 text-sky-600 flex items-center justify-center"><i data-lucide="arrow-right" style="width:14px;height:14px;"></i></div></div>
                </div>
            </div>
        </div>

        <!-- Bottom Input & Navigation Bar (Exact match to screenshot) -->
        <div class="w-full max-w-2xl mx-auto">
            <div class="glass-card p-4 rounded-3xl shadow-xl shadow-indigo-100/50 border border-white">
                
                <!-- Input Box Row -->
                <div class="flex items-center justify-between mb-4 px-2">
                    <div class="flex items-center space-x-3 flex-1">
                        <span class="text-indigo-500 flex items-center"><i data-lucide="sparkles" style="width:18px;height:18px;"></i></span>
                        <input type="text" id="userInput" placeholder="Message Global AI Mahlet..." class="w-full bg-transparent text-sm text-slate-800 placeholder-slate-400 focus:outline-none">
                    </div>
                    <button id="sendBtn" class="w-11 h-11 rounded-full bg-gradient-to-r from-indigo-500 to-blue-600 text-white flex items-center justify-center shadow-md shadow-indigo-200 active:scale-95 transition cursor-pointer">
                        <i data-lucide="send" style="width:18px;height:18px;"></i>
                    </button>
                </div>

                <!-- Action Tools Row (Exact circular light-blue buttons) -->
                <div class="flex items-center justify-between pt-3 border-t border-slate-100/80 relative">
                    <div class="flex items-center space-x-2">
                        <button id="cameraBtn" class="w-10 h-10 rounded-full bg-blue-50/80 hover:bg-blue-100 flex items-center justify-center text-blue-600 transition cursor-pointer shadow-sm" title="Take Photo">
                            <i data-lucide="camera" style="width:18px;height:18px;"></i>
                        </button>
                        <button id="fileBtn" class="w-10 h-10 rounded-full bg-blue-50/80 hover:bg-blue-100 flex items-center justify-center text-blue-600 transition cursor-pointer shadow-sm" title="Attach File">
                            <i data-lucide="paperclip" style="width:18px;height:18px;"></i>
                        </button>
                        <button id="galleryBtn" class="w-10 h-10 rounded-full bg-blue-50/80 hover:bg-blue-100 flex items-center justify-center text-blue-600 transition cursor-pointer shadow-sm" title="Upload Image">
                            <i data-lucide="image" style="width:18px;height:18px;"></i>
                        </button>
                        <button id="micBtn" class="w-10 h-10 rounded-full bg-blue-50/80 hover:bg-blue-100 flex items-center justify-center text-blue-600 transition cursor-pointer shadow-sm" title="Voice Message">
                            <i data-lucide="mic" style="width:18px;height:18px;"></i>
                        </button>
                    </div>

                    <!-- Language Selector -->
                    <div class="relative">
                        <button id="langBtn" class="flex items-center space-x-1.5 px-3.5 py-2 rounded-full bg-slate-100/80 hover:bg-slate-200 text-xs font-medium text-slate-700 transition cursor-pointer">
                            <i data-lucide="globe" style="width:14px;height:14px;"></i>
                            <span id="currentLangLabel">EN</span>
                            <i data-lucide="chevron-down" style="width:12px;height:12px;" class="text-slate-500"></i>
                        </button>

                        <!-- Dropdown List with Languages -->
                        <div id="langDropdown" class="hidden absolute bottom-12 right-0 w-52 max-h-60 overflow-y-auto bg-white rounded-2xl shadow-xl border border-slate-100 p-1 z-50 text-xs">
                            <div data-lang="en" data-label="EN" class="lang-option px-3 py-2 hover:bg-indigo-50 rounded-xl cursor-pointer font-medium text-slate-700">English (EN)</div>
                            <div data-lang="ti" data-label="ትግርኛ" class="lang-option px-3 py-2 hover:bg-indigo-50 rounded-xl cursor-pointer font-medium text-slate-700">Tigrigna (ትግርኛ)</div>
                            <div data-lang="am" data-label="አማርኛ" class="lang-option px-3 py-2 hover:bg-indigo-50 rounded-xl cursor-pointer font-medium text-slate-700">Amharic (አማርኛ)</div>
                            <div data-lang="ar" data-label="العربية" class="lang-option px-3 py-2 hover:bg-indigo-50 rounded-xl cursor-pointer font-medium text-slate-700">Arabic (العربية)</div>
                            <div data-lang="es" data-label="Español" class="lang-option px-3 py-2 hover:bg-indigo-50 rounded-xl cursor-pointer font-medium text-slate-700">Spanish (Español)</div>
                            <div data-lang="fr" data-label="Français" class="lang-option px-3 py-2 hover:bg-indigo-50 rounded-xl cursor-pointer font-medium text-slate-700">French (Français)</div>
                            <div data-lang="zh" data-label="中文" class="lang-option px-3 py-2 hover:bg-indigo-50 rounded-xl cursor-pointer font-medium text-slate-700">Chinese (中文)</div>
                            <div data-lang="de" data-label="Deutsch" class="lang-option px-3 py-2 hover:bg-indigo-50 rounded-xl cursor-pointer font-medium text-slate-700">German (Deutsch)</div>
                            <div data-lang="ja" data-label="日本語" class="lang-option px-3 py-2 hover:bg-indigo-50 rounded-xl cursor-pointer font-medium text-slate-700">Japanese (日本語)</div>
                            <div data-lang="sw" data-label="Kiswahili" class="lang-option px-3 py-2 hover:bg-indigo-50 rounded-xl cursor-pointer font-medium text-slate-700">Swahili (Kiswahili)</div>
                        </div>
                    </div>
                </div>

            </div>

            <!-- Footer Credit -->
            <div class="text-center mt-4">
                <p class="text-[11px] text-slate-400 tracking-wide flex items-center justify-center space-x-1">
                    <span>—</span>
                    <span class="text-rose-400">♥</span>
                    <span>Made for a better tomorrow</span>
                    <span>—</span>
                </p>
            </div>
        </div>

    </div>

    <!-- Script to render icons and handle all button clicks -->
    <script>
        window.addEventListener('DOMContentLoaded', () => {
            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }

            const cameraBtn = document.getElementById('cameraBtn');
            const cameraInput = document.getElementById('cameraInput');
            if (cameraBtn && cameraInput) cameraBtn.addEventListener('click', () => cameraInput.click());

            const fileBtn = document.getElementById('fileBtn');
            const fileInput = document.getElementById('fileInput');
            if (fileBtn && fileInput) fileBtn.addEventListener('click', () => fileInput.click());

            const galleryBtn = document.getElementById('galleryBtn');
            const galleryInput = document.getElementById('galleryInput');
            if (galleryBtn && galleryInput) galleryBtn.addEventListener('click', () => galleryInput.click());

            const micBtn = document.getElementById('micBtn');
            if (micBtn) {
                micBtn.addEventListener('click', () => {
                    micBtn.classList.toggle('bg-red-100');
                    micBtn.classList.toggle('text-red-600');
                    alert(micBtn.classList.contains('bg-red-100') ? "Voice recording started..." : "Voice recording stopped.");
                });
            }

            const langBtn = document.getElementById('langBtn');
            const langDropdown = document.getElementById('langDropdown');
            if (langBtn && langDropdown) {
                langBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    langDropdown.classList.toggle('hidden');
                });
                document.querySelectorAll('.lang-option').forEach(option => {
                    option.addEventListener('click', () => {
                        document.getElementById('currentLangLabel').innerText = option.getAttribute('data-label');
                        langDropdown.classList.add('hidden');
                    });
                });
            }

            window.addEventListener('click', () => { if (langDropdown) langDropdown.classList.add('hidden'); });

            const menuBtn = document.getElementById('menuBtn');
            if (menuBtn) menuBtn.addEventListener('click', () => alert("Menu opened!"));

            document.querySelectorAll('.feature-card').forEach(card => {
                card.addEventListener('click', () => {
                    const val = document.getElementById('userInput');
                    if (val) {
                        val.value = "Tell me about " + card.getAttribute('data-feature');
                        val.focus();
                    }
                });
            });

            const sendBtn = document.getElementById('sendBtn');
            if (sendBtn) {
                sendBtn.addEventListener('click', () => {
                    const val = document.getElementById('userInput');
                    if (val && val.value.trim() !== "") {
                        alert("Sending: " + val.value);
                        val.value = "";
                    } else {
                        alert("Please type a message first!");
                    }
                });
            }
        });
    </script>
</body>
</html>`;

    return new Response(html, {
      headers: { "Content-Type": "text/html;charset=UTF-8" },
    });
  },
};
