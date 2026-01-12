import { pipeline } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.14.0';

const statusEl = document.getElementById('status');
const outputEl = document.getElementById('output');

let transcriber = null;

async function init() {
    try {
        statusEl.innerText = "Loading Whisper model (tiny)...";
        // v1: Local Browser AI
        transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny');
        statusEl.innerText = "Ready (v1 - Local)";
    } catch (err) {
        statusEl.innerText = "Error loading model: " + err.message;
    }
}

init();

// Simple simulation of v1 behavior logic (reconstructed)
// In v1 we used a full audio recording loop and sent blob to transcriber
console.log("v1 Logic loaded");
