// Web Speech API Configuration
const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
recognition.lang = 'ko-KR';
recognition.continuous = true;
recognition.interimResults = true; // [CRITICAL] Enable Interim Detection

// DOM Elements
const statusEl = document.getElementById('status');
const outputEl = document.getElementById('output');
const btnRec = document.getElementById('btnRec');

let isRecording = false;
let lastTriggerTime = 0; // Debounce

// Initialize
function init() {
    if (!recognition) {
        statusEl.innerText = "❌ Web Speech API Not Supported";
        btnRec.disabled = true;
        return;
    }
    statusEl.innerText = "Ready (v2 - Web Speech API)";
    btnRec.onclick = toggleRecording;
}

function toggleRecording() {
    if (!isRecording) {
        startRecording();
    } else {
        stopRecording();
    }
}

function startRecording() {
    recognition.start();
    isRecording = true;

    btnRec.innerText = "🛑 Stop Recording";
    btnRec.classList.add("recording");
    btnRec.style.background = "#ff9800";
    statusEl.innerText = "Recording... (Streaming)";
}

function stopRecording() {
    recognition.stop();
    isRecording = false;

    btnRec.innerText = "⏳ Stopping...";
    btnRec.disabled = true;
}

// Logic
recognition.onresult = (event) => {
    let interimTranscript = '';
    let finalTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; ++i) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
            finalTranscript += transcript;
            // Log Final Result
            const now = new Date().toLocaleTimeString();
            outputEl.innerHTML += `
                <div class="log-item">
                    <span class="timestamp">[${now}]</span>
                    <span class="text">${transcript}</span>
                    <span class="latency warning">Confidence: ${(event.results[i][0].confidence * 100).toFixed(0)}%</span>
                </div>
            `;
            outputEl.scrollTop = outputEl.scrollHeight;
        } else {
            interimTranscript += transcript;
        }
    }

    // [CRITICAL] Check Keywords IMMEDIATELLY on Interim Results
    // This gives the "VOD-free" / "Zero Latency" feel
    const checkText = finalTranscript + interimTranscript;
    checkKeywords(checkText);
};

recognition.onend = () => {
    isRecording = false;
    btnRec.innerText = "🎙️ Start Recording";
    btnRec.disabled = false;
    btnRec.classList.remove("recording");
    statusEl.innerText = "Ready";
};

recognition.onerror = (event) => {
    statusEl.innerText = "❌ Error: " + event.error;
    isRecording = false;
    btnRec.innerText = "🎙️ Start Recording";
    btnRec.disabled = false;
};

// --- Game Logic (Shared across versions) ---
function checkKeywords(text) {
    const t = text.trim();
    const now = Date.now();
    if (now - lastTriggerTime < 1000) return; // 1s Cooltime

    if (t.includes("뽀뽀") || t.includes("최고")) {
        highlightEffect("💖 힐링 버프 발동! (Healing)");
        lastTriggerTime = now;
    } else if (t.includes("사랑")) {
        highlightEffect("🚀 더블 점프! (Double Jump)");
        lastTriggerTime = now;
    } else if (t.includes("바보") || t.includes("멍청") || t.includes("망해")) {
        highlightEffect("⚡ 페널티! (Damage)");
        lastTriggerTime = now;
    }
}

function highlightEffect(msg) {
    console.log(msg);
    const toast = document.createElement('div');
    Object.assign(toast.style, {
        position: 'fixed', top: '20%', left: '50%', transform: 'translate(-50%, -50%)',
        padding: '1rem 2rem', background: 'rgba(255, 177, 66, 0.9)', color: 'black', // Orange Theme for v2
        borderRadius: '50px', fontSize: '1.5rem', fontWeight: 'bold', zIndex: '9999',
        boxShadow: '0 0 20px rgba(255, 177, 66, 0.5)'
    });
    toast.innerText = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
}

init();
