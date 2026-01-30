/**
 * Main - 뽀뽀 제스처 인식 테스트 메인 스크립트
 */
import { Viewfinder } from './viewfinder.js';
import { GestureManager } from './gesture-manager.js';

// DOM 요소
const video = document.getElementById('video');
const canvas = document.getElementById('overlay');
const poseOverlay = document.getElementById('poseOverlay');
const poseIcon = document.getElementById('poseIcon');
const poseLabel = document.getElementById('poseLabel');
const kissCountEl = document.getElementById('kissCount');
const statusText = document.getElementById('statusText');
const fpsEl = document.getElementById('fps');
const logEl = document.getElementById('log');

// 수치 표시 요소
const metricLipV = document.getElementById('metricLipV');
const metricLipH = document.getElementById('metricLipH');
const metricRatio = document.getElementById('metricRatio');
const metricFace = document.getElementById('metricFace');

// 슬라이더 요소
const sliderRatio = document.getElementById('sliderRatio');
const sliderHorizontal = document.getElementById('sliderHorizontal');
const sliderConf = document.getElementById('sliderConf');
const valRatio = document.getElementById('valRatio');
const valHorizontal = document.getElementById('valHorizontal');
const valConf = document.getElementById('valConf');

// 상태 변수
let viewfinder = null;
let gestureManager = null;
let kissCount = 0;
let lastKissTime = 0;
const DEBOUNCE_MS = 500;

// 임계값
const thresholds = {
    ratioMedium: 0.15,
    horizontalMedium: 0.18,
    minConfidence: 0.7
};

/**
 * 로그 출력
 */
function log(msg) {
    const p = document.createElement('p');
    p.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    logEl.insertBefore(p, logEl.firstChild);
    if (logEl.children.length > 10) logEl.lastChild.remove();
}

/**
 * 슬라이더 이벤트 설정
 */
function setupSliders() {
    sliderRatio?.addEventListener('input', (e) => {
        thresholds.ratioMedium = parseFloat(e.target.value);
        valRatio.textContent = thresholds.ratioMedium.toFixed(2);
        updateGestureThresholds();
    });

    sliderHorizontal?.addEventListener('input', (e) => {
        thresholds.horizontalMedium = parseFloat(e.target.value);
        valHorizontal.textContent = thresholds.horizontalMedium.toFixed(2);
        updateGestureThresholds();
    });

    sliderConf?.addEventListener('input', (e) => {
        thresholds.minConfidence = parseFloat(e.target.value);
        valConf.textContent = thresholds.minConfidence.toFixed(2);
    });
}

/**
 * 제스처 임계값 업데이트
 */
function updateGestureThresholds() {
    const kissGesture = gestureManager?.getGesture('kiss');
    if (kissGesture) {
        kissGesture.setThreshold('ratioMedium', thresholds.ratioMedium);
        kissGesture.setThreshold('ratioHigh', thresholds.ratioMedium * 0.8);
        kissGesture.setThreshold('horizontalMedium', thresholds.horizontalMedium);
        kissGesture.setThreshold('horizontalHigh', thresholds.horizontalMedium * 0.83);
    }
}

/**
 * 프레임 처리 콜백
 */
function onFrame(data) {
    const { faceLandmarks, fps } = data;
    const now = performance.now();

    // FPS 업데이트
    fpsEl.textContent = fps;

    // 얼굴 랜드마크 시각화
    viewfinder.drawLipLandmarks(faceLandmarks);

    // 제스처 감지
    const detected = gestureManager.detectOne('kiss', faceLandmarks, thresholds.minConfidence);

    // 수치 업데이트
    if (faceLandmarks && faceLandmarks.length > 0) {
        metricFace.textContent = '✅';

        const kissGesture = gestureManager.getGesture('kiss');
        const result = kissGesture.detect(faceLandmarks);

        if (result.data.lipLandmarksFound) {
            metricLipV.textContent = result.data.verticalDist.toFixed(4);
            metricLipH.textContent = result.data.horizontalDist.toFixed(4);
            metricRatio.textContent = result.data.ratio.toFixed(4);
        }
    } else {
        metricFace.textContent = '❌';
    }

    // 뽀뽀 감지 처리
    if (detected && (now - lastKissTime > DEBOUNCE_MS)) {
        poseOverlay.classList.add('show');
        poseIcon.textContent = detected.icon;
        poseLabel.textContent = '뽀뽀!';

        kissCount++;
        kissCountEl.textContent = kissCount;
        log(`💋 뽀뽀 감지! (${kissCount}번째, ${(detected.score * 100).toFixed(0)}%)`);
        lastKissTime = now;
    } else if (!detected) {
        poseOverlay.classList.remove('show');
    }
}

/**
 * 초기화 버튼 핸들러
 */
async function handleInit() {
    log('FaceLandmarker 초기화 중...');
    statusText.textContent = '초기화 중...';

    try {
        viewfinder = new Viewfinder(video, canvas);
        await viewfinder.initialize();

        gestureManager = new GestureManager();
        updateGestureThresholds();

        log('✅ 초기화 완료');
        statusText.textContent = '준비됨';

        document.getElementById('btnInit').disabled = true;
        document.getElementById('btnInit').textContent = '✅';
        document.getElementById('btnCamera').disabled = false;
    } catch (e) {
        log('❌ 초기화 실패: ' + e.message);
        statusText.textContent = '오류';
    }
}

/**
 * 카메라 버튼 핸들러
 */
async function handleCamera() {
    try {
        await viewfinder.startCamera();
        log('✅ 카메라 ON');

        document.getElementById('btnCamera').disabled = true;
        document.getElementById('btnCamera').textContent = '✅';
        document.getElementById('btnDetect').disabled = false;
    } catch (e) {
        log('❌ 카메라 실패: ' + e.message);
    }
}

/**
 * 시작 버튼 핸들러
 */
function handleStart() {
    viewfinder.startDetection(onFrame);
    statusText.textContent = '감지 중';
    log('🎯 뽀뽀 감지 시작!');

    document.getElementById('btnDetect').disabled = true;
    document.getElementById('btnDetect').textContent = '🔴';
}

/**
 * 리셋 버튼 핸들러
 */
function handleReset() {
    kissCount = 0;
    kissCountEl.textContent = '0';
    log('🔄 카운트 리셋');
}

/**
 * 이벤트 리스너 등록
 */
function setupEventListeners() {
    document.getElementById('btnInit')?.addEventListener('click', handleInit);
    document.getElementById('btnCamera')?.addEventListener('click', handleCamera);
    document.getElementById('btnDetect')?.addEventListener('click', handleStart);
    document.getElementById('btnReset')?.addEventListener('click', handleReset);

    setupSliders();
}

// 페이지 로드 시 이벤트 리스너 등록
document.addEventListener('DOMContentLoaded', setupEventListeners);
