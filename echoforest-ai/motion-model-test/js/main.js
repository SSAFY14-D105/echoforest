import { FilesetResolver, HandLandmarker } from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest';
import Viewfinder from './viewfinder.js';
import GestureManager from './gesture-manager.js';
import VSign from './gestures/VSign.js';

// DOM 요소
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const btnInit = document.getElementById('btnInit');
const btnCamera = document.getElementById('btnCamera');
const btnStart = document.getElementById('btnStart');
const logEl = document.getElementById('log');

// 모듈 초기화
const viewfinder = new Viewfinder(canvas);
const manager = new GestureManager();

// V-Sign 등록 (설정값 조절 가능)
const vSignGesture = new VSign({
    vAngleMin: 15, // 최소 각도
    fingerFold: 1.1 // 접힘 민감도
});
manager.register(vSignGesture);

let handLandmarker = null;
let isRunning = false;
let lastTime = 0;

// 로그 유틸
function log(msg) {
    const p = document.createElement('p');
    p.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    logEl.insertBefore(p, logEl.firstChild);
    if (logEl.children.length > 20) logEl.lastChild.remove();
}

// 1. 초기화 (모델 로드)
btnInit.addEventListener('click', async () => {
    btnInit.disabled = true;
    log('⏳ 모델 로딩 중...');

    try {
        const vision = await FilesetResolver.forVisionTasks(
            'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        );
        handLandmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
                delegate: 'GPU'
            },
            runningMode: 'VIDEO',
            numHands: 1
        });
        log('✅ 모델 로드 완료!');
        btnCamera.disabled = false;
    } catch (e) {
        log('❌ 모델 로드 실패: ' + e);
        btnInit.disabled = false;
    }
});

// 2. 카메라 시작
btnCamera.addEventListener('click', async () => {
    try {
        log('🎥 카메라 요청 중...');
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 640 },
                height: { ideal: 480 },
                facingMode: 'user'
            }
        });

        video.srcObject = stream;

        // 메타데이터가 로드될 때까지 대기
        video.onloadedmetadata = () => {
            video.play();
            log('✅ 카메라 연결됨 (' + video.videoWidth + 'x' + video.videoHeight + ')');

            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;

            btnCamera.disabled = true;
            btnStart.disabled = false;
        };
    } catch (e) {
        log('❌ 카메라 에러: ' + e.message);
        console.error(e);
    }
});

// 3. 감지 루프 시작
btnStart.addEventListener('click', () => {
    isRunning = true;
    btnStart.disabled = true;
    log('🚀 감지 시작!');
    requestAnimationFrame(loop);
});

// 메인 루프
function loop(time) {
    if (!isRunning) return;

    if (lastTime !== video.currentTime) {
        lastTime = video.currentTime;

        // 1. 랜드마크 추출
        const results = handLandmarker.detectForVideo(video, performance.now());

        // 2. 그리기 & 분석
        viewfinder.ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (results.landmarks.length > 0) {
            const landmarks = results.landmarks[0];

            // 시각화
            viewfinder.draw(landmarks);

            // 제스처 감지
            const result = manager.detectAll(landmarks);

            // 결과 표시
            updateUI(result);
        } else {
            updateUI({ emoji: '🤚', label: '손 없음', score: 0 });
        }
    }

    requestAnimationFrame(loop);
}

function updateUI(result) {
    document.getElementById('emoji').textContent = result.emoji;
    document.getElementById('label').textContent = result.label;

    const scoreText = result.score > 0 ? `${(result.score * 100).toFixed(0)}%` : '-';
    document.getElementById('score').textContent = scoreText;

    // 상세 디버그 정보
    if (result.details) {
        let text = '';
        for (const [key, val] of Object.entries(result.details)) {
            text += `${key}: ${val}  `;
        }
        document.getElementById('debugInfo').textContent = text;
    } else {
        document.getElementById('debugInfo').textContent = '';
    }

    // 로그 (감지될 때만)
    if (result.type !== 'none' && result.score > 0.8) {
        // 너무 자주 찍히지 않게 조절 필요하지만 일단 심플하게
        // log(`${result.emoji} ${result.label}`); 
    }
}
