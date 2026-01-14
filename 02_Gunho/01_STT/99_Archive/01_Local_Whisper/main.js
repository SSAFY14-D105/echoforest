import { pipeline } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.14.0';

const statusEl = document.getElementById('status');
const outputEl = document.getElementById('output');
const btnRec = document.getElementById('btnRec');
const volumeBar = document.getElementById('volume-bar');

let transcriber = null;
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;

async function init() {
    try {
        statusEl.innerText = "Loading Whisper model (tiny)... (Ignore Warnings)";
        transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny');

        statusEl.innerText = "Ready (v1 - Manual Mode)";
        btnRec.disabled = false;
        btnRec.innerText = "🎙️ Start Recording";
        btnRec.onclick = toggleRecording;

    } catch (err) {
        statusEl.innerText = "Error loading model: " + err.message;
        console.error(err);
    }
}

async function toggleRecording() {
    if (!isRecording) {
        await startRecording();
    } else {
        await stopRecording();
    }
}

async function startRecording() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];

    mediaRecorder.ondataavailable = event => audioChunks.push(event.data);
    mediaRecorder.onstop = processAudio;

    mediaRecorder.start();
    isRecording = true;

    // UI Updates
    btnRec.innerText = "🛑 Stop Recording";
    btnRec.classList.add("recording"); // Red button
    statusEl.innerText = "Category: Recording... (Speak now)";
    if (volumeBar) volumeBar.classList.add('active');
}

async function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
    }
    isRecording = false;

    // UI Updates
    btnRec.innerText = "⏳ Processing...";
    btnRec.disabled = true; // Prevent double click
    btnRec.classList.remove("recording");
    if (volumeBar) volumeBar.classList.remove('active');
}

async function processAudio() {
    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
    const audioUrl = URL.createObjectURL(audioBlob);

    statusEl.innerText = "Category: Transcribing... (Local CPU)";

    const start = performance.now();
    try {
        const result = await transcriber(audioUrl, {
            language: 'ko',
            task: 'transcribe'
        });

        const end = performance.now();
        const latency = (end - start).toFixed(0);

        outputEl.innerHTML += `
            <div class="log-item">
                <span class="timestamp">[${new Date().toLocaleTimeString()}]</span>
                <span class="text">${result.text}</span>
                <span class="latency warning">Latency: ${latency}ms (Client CPU)</span>
            </div>
        `;
        outputEl.scrollTop = outputEl.scrollHeight;

        // Game Logic Check
        checkKeywords(result.text);

        statusEl.innerText = "Ready";

    } catch (err) {
        outputEl.innerText = "Error: " + err.message;
    } finally {
        btnRec.disabled = false;
        btnRec.innerText = "🎙️ Start Recording";
    }
}

// --- Game Logic (Shared) ---
let lastTriggerTime = 0;

function checkKeywords(text) {
    if (!text) return;
    const t = text.trim();
    const now = Date.now();
    if (now - lastTriggerTime < 1000) return;

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
        padding: '1rem 2rem', background: 'rgba(255, 82, 82, 0.9)', color: 'white', // Red Theme for v1
        borderRadius: '50px', fontSize: '1.5rem', fontWeight: 'bold', zIndex: '9999',
        boxShadow: '0 0 20px rgba(255, 82, 82, 0.5)'
    });
    toast.innerText = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
}

init();
