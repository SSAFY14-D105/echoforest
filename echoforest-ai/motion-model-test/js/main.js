import { HandLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0";
import Viewfinder from './viewfinder.js';
import GestureManager from './gesture-manager.js';
import HeartGesture from './gestures/HeartGesture.js';

let handLandmarker;
let runningMode = "VIDEO";
let lastVideoTime = -1;

const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const logEntries = document.getElementById('log');
const btnInit = document.getElementById('btnInit');
const btnCamera = document.getElementById('btnCamera');
const btnStart = document.getElementById('btnStart');

const emojiEl = document.getElementById('emoji');
const labelEl = document.getElementById('label');
const scoreEl = document.getElementById('score');
const debugEl = document.getElementById('debugInfo');

const viewfinder = new Viewfinder(canvas);
const manager = new GestureManager();
manager.register(new HeartGesture());

function log(msg) {
    const p = document.createElement('p');
    p.textContent = `> ${msg}`;
    logEntries.appendChild(p);
    logEntries.scrollTop = logEntries.scrollHeight;
}

// 1. 모델 초기화
btnInit.addEventListener('click', async () => {
    log('⌛ 모델 로딩 중...');
    try {
        const vision = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
        );
        handLandmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
                delegate: "GPU"
            },
            runningMode: runningMode,
            numHands: 2
        });
        log('✅ 모델 로드 완료');
        btnInit.disabled = true;
        btnCamera.disabled = false;
    } catch (e) {
        log('❌ 모델 로드 실패: ' + e.message);
    }
});

// 2. 카메라 시작
btnCamera.addEventListener('click', async () => {
    try {
        log('🎥 카메라 요청 중...');
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }
        });
        video.srcObject = stream;
        video.onloadedmetadata = () => {
            video.play();
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            log(`✅ 카메라 시작됨 (${video.videoWidth}x${video.videoHeight})`);
            btnCamera.disabled = true;
            btnStart.disabled = false;
        };
    } catch (e) {
        log('❌ 카메라 에러: ' + e.message);
    }
});

// 3. 루프 시작
btnStart.addEventListener('click', () => {
    log('🚀 감지 시작');
    btnStart.disabled = true;
    predictWebcam();
});

async function predictWebcam() {
    if (lastVideoTime !== video.currentTime) {
        lastVideoTime = video.currentTime;
        const results = handLandmarker.detectForVideo(video, performance.now());

        viewfinder.draw(results.landmarks);

        const result = manager.detectAll(results.landmarks);
        updateUI(result);
    }
    requestAnimationFrame(predictWebcam);
}

function updateUI(result) {
    emojiEl.textContent = result.emoji || '🤚';
    labelEl.textContent = result.label || '대기중';
    scoreEl.textContent = result.score ? result.score.toFixed(2) : '-';

    if (result.details) {
        debugEl.textContent = `T-Dist: ${result.details.thumbDist.toFixed(2)}, I-Dist: ${result.details.indexDist.toFixed(2)}`;
    } else {
        debugEl.textContent = '';
    }
}
