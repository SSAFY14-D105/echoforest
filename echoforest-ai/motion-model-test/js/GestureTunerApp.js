import { FilesetResolver, HandLandmarker, FaceLandmarker } from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest';
import HeartGesture from './gestures/HeartGesture.js';
import Kiss from './gestures/Kiss.js';
import LeftPokeGesture from './gestures/LeftPokeGesture.js';
import RightPokeGesture from './gestures/RightPokeGesture.js';
import VSign from './gestures/VSign.js';
import LGesture from './gestures/LGesture.js';
import OKGesture from './gestures/OKGesture.js';
import FistGesture from './gestures/FistGesture.js';
import TalmoBeamGesture from './gestures/TalmoBeamGesture.js';
import CameraSection from './ui/CameraSection.js';

import ThresholdPanel from './ui/ThresholdPanel.js';
import MetricsPanel from './ui/MetricsPanel.js';
import FingerStatusPanel from './ui/FingerStatusPanel.js';
import DistanceMeasurementPanel from './ui/DistanceMeasurementPanel.js';
import DualHandPanel from './ui/DualHandPanel.js';
import LipStatusPanel from './ui/LipStatusPanel.js';
import CheekPokePanel from './ui/CheekPokePanel.js';
import LandmarkRawDataPanel from './ui/LandmarkRawDataPanel.js';
import MatrixPanel from './ui/MatrixPanel.js';
import FingertipMatrixPanel from './ui/FingertipMatrixPanel.js';
import CapturePanel from './ui/CapturePanel.js';
import LogPanel from './ui/LogPanel.js';

import { distance, distanceAR, isFingerExtended, calculateDistances } from './utils/gesture-helpers.js';

// 제스처 인스턴스
const heartGesture = new HeartGesture();
const kissGesture = new Kiss();
const leftPokeGesture = new LeftPokeGesture();
const rightPokeGesture = new RightPokeGesture();
const vSign = new VSign();
const lGesture = new LGesture();
const okGesture = new OKGesture();
const fistGesture = new FistGesture();
const talmoBeamGesture = new TalmoBeamGesture();

// 설정값
// 설정값은 ThresholdPanel에서 관리됨

// UI Manager
const cameraSection = new CameraSection('camera-section');
const video = cameraSection.video;
const canvas = cameraSection.canvas;
const ctx = canvas.getContext('2d');

let handLandmarker = null;
let faceLandmarker = null;
let isRunning = false;
let lastTime = 0;
let frameCount = 0;

// 패널 초기화 (Components)
const thresholdPanel = new ThresholdPanel('threshold-panel-container');
const thresholds = thresholdPanel.thresholds; // 패널 값 공유 (참조)
const metricsPanel = new MetricsPanel('metrics-panel-container');
const fingerStatusPanel = new FingerStatusPanel('finger-status-panel-container');
const distancePanel = new DistanceMeasurementPanel('distance-panel-container');
const dualHandPanel = new DualHandPanel('dual-hand-panel-container');
const lipStatusPanel = new LipStatusPanel('lip-status-panel-container');
const cheekPokePanel = new CheekPokePanel('cheek-poke-panel-container');
const landmarkRawPanel = new LandmarkRawDataPanel('landmark-raw-panel-container');
const matrixPanel = new MatrixPanel('matrix-panel-container');
const fingertipMatrixPanel = new FingertipMatrixPanel('fingertip-matrix-panel-container');
const capturePanel = new CapturePanel('capture-panel-container');
const logPanel = new LogPanel('log-panel-container');

// 전역 로그 함수 재정의
window.log = (msg) => logPanel.log(msg);

function isFingerClosed(landmarks, tipIdx, mcpIdx) {
    const wrist = landmarks[0];
    return distance(landmarks[tipIdx], wrist) < distance(landmarks[mcpIdx], wrist) * thresholds.fist;
}

// detectGesture 시그니처 변경: context 객체 수신
function detectGesture(landmarks, context = {}) {
    const allHands = context.allHands || null;
    const faceLandmarks = context.faceLandmarks || null;

    // 손바닥 크기 (정규화용)
    const palmSize = distance(landmarks[0], landmarks[9]);

    // 엄지 특수 처리
    const thumbTipToIndexMcp = distance(landmarks[4], landmarks[5]) / palmSize;
    const thumbTipToWrist = distance(landmarks[4], landmarks[0]) / palmSize;
    const thumbReallyExtended = isFingerExtended(landmarks, 4, 3) &&
        (thumbTipToIndexMcp > 0.5 || thumbTipToWrist > 1.2);

    // 거리 계산 (Helper 사용)
    const calcRes = calculateDistances(landmarks, palmSize);

    // 추가 정보 병합
    calcRes.fingers.thumb.extended = thumbReallyExtended;
    // closed 상태 추가 계산
    calcRes.fingers.thumb.closed = isFingerClosed(landmarks, 4, 2);
    calcRes.fingers.index.closed = isFingerClosed(landmarks, 8, 5);
    calcRes.fingers.middle.closed = isFingerClosed(landmarks, 12, 9);
    calcRes.fingers.ring.closed = isFingerClosed(landmarks, 16, 13);
    calcRes.fingers.pinky.closed = isFingerClosed(landmarks, 20, 17);

    // 엄지 기준 거리 패널 업데이트
    matrixPanel.update(calcRes.thumbDistances);

    // 5x5 매트릭스 패널 업데이트
    const matrix = fingertipMatrixPanel.update(landmarks, palmSize, allHands);

    // 펴진 손가락 개수
    const extendedCount = Object.values(calcRes.fingers).filter(f => f.extended).length;
    const closedCount = Object.values(calcRes.fingers).filter(f => f.closed).length;

    // Metric 패널용 데이터
    const thumbIndexDist = distance(landmarks[4], landmarks[8]);
    const normalizedDist = thumbIndexDist / palmSize;
    const metrics = {
        thumbIndex: thumbIndexDist.toFixed(3),
        palm: palmSize.toFixed(3),
        norm: normalizedDist.toFixed(3),
        closed: closedCount + '/5'
    };

    // 데이터 패키징 (UI 업데이트용)
    const analysisData = {
        thumbDistances: calcRes.thumbDistances,
        matrix: matrix,
        fingers: calcRes.fingers,
        extendedCount,
        metrics
    };

    // 캡처용 데이터 전달
    capturePanel.update(analysisData);

    // 선택된 랜드마크 UI (Legacy support)
    const lmSelect = document.getElementById('landmarkSelect');
    if (lmSelect) {
        const lmIdx = parseInt(lmSelect.value);
        const lm = landmarks[lmIdx];
        document.getElementById('lmX').textContent = lm.x.toFixed(3);
        document.getElementById('lmY').textContent = lm.y.toFixed(3);
        document.getElementById('lmZ').textContent = (lm.z || 0).toFixed(3);
    }

    // 제스처 판정: 경쟁 방식 (Highest Score Wins)
    // 메타데이터 구성 (얼굴 정보 포함)
    const metadata = {
        palmSize,
        fingers: calcRes.fingers,
        thresholds: thresholdPanel.thresholds,
        allHands,
        faceLandmarks
    };

    let gestureResult = { type: 'none', score: 0, emoji: '🤚', label: '인식 안됨' };

    // 제스처 판정: 순차적 검사 (손가락 모양이 상호 배타적이므로 순서대로 확인 후 종료)

    // 1. 주먹 (모두 접힘)
    const fistRes = fistGesture.check(landmarks, metadata);
    if (fistRes.detected) {
        gestureResult = fistRes;
    }
    // 2. OK (검지-엄지 원, 나머지 펴짐)
    else {
        const okRes = okGesture.check(landmarks, metadata);
        if (okRes.detected) {
            gestureResult = okRes;
        }
        // 3. V (검지, 중지 펴짐)
        else {
            const vRes = vSign.check(landmarks, metadata);
            if (vRes.detected) {
                gestureResult = vRes;
            }
            // 4. L (엄지, 검지 펴짐 + 중지 등 접힘)
            else {
                const lRes = lGesture.check(landmarks, metadata);
                if (lRes.detected) {
                    gestureResult = lRes;
                }
            }
        }
    }

    return { ...gestureResult, analysisData };
}

function drawLandmarks(landmarks, lineColor = '#667eea', handIndex = 0) {
    const connections = [
        [0, 1], [1, 2], [2, 3], [3, 4], // 엄지
        [0, 5], [5, 6], [6, 7], [7, 8], // 검지
        [0, 9], [9, 10], [10, 11], [11, 12], // 중지
        [0, 13], [13, 14], [14, 15], [15, 16], // 약지
        [0, 17], [17, 18], [18, 19], [19, 20], // 새끼
        [5, 9], [9, 13], [13, 17] // 손바닥
    ];

    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2;
    connections.forEach(([a, b]) => {
        const p1 = landmarks[a];
        const p2 = landmarks[b];
        ctx.beginPath();
        ctx.moveTo(p1.x * canvas.width, p1.y * canvas.height);
        ctx.lineTo(p2.x * canvas.width, p2.y * canvas.height);
        ctx.stroke();
    });

    // 점 및 번호 그리기
    ctx.font = '10px Arial';
    landmarks.forEach((lm, i) => {
        const x = lm.x * canvas.width;
        const y = lm.y * canvas.height;
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, 2 * Math.PI);
        ctx.fillStyle = [0, 4, 8, 12, 16, 20].includes(i) ? '#ff6b9d' : '#4ade80';
        ctx.fill();

        // 번호 (거울모드 해제: 텍스트 뒤집기)
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(-1, 1);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(i, -10, -6); // 좌표 조정
        ctx.restore();
    });

    // 손 인덱스 라벨 (거울모드 해제)
    const wrist = landmarks[0];
    const wx = wrist.x * canvas.width;
    const wy = wrist.y * canvas.height;
    ctx.save();
    ctx.translate(wx, wy);
    ctx.scale(-1, 1);
    ctx.fillStyle = lineColor;
    ctx.font = 'bold 14px Arial';
    ctx.fillText(`Hand ${handIndex}`, 20, 20); // 오프셋 조정
    ctx.restore();

    // 거리 시각화 (엄지-검지)
    const thumb = landmarks[4];
    const index = landmarks[8];
    const middleMcp = landmarks[9];

    // Palm Size 직접 계산 (helper 함수 의존성 줄임)
    const palmDist = Math.sqrt(Math.pow(wrist.x - middleMcp.x, 2) + Math.pow(wrist.y - middleMcp.y, 2));
    const dist = Math.sqrt(Math.pow(thumb.x - index.x, 2) + Math.pow(thumb.y - index.y, 2));
    const normalizedDist = dist / palmDist;

    // 선 그리기 (점선)
    const tx = thumb.x * canvas.width;
    const ty = thumb.y * canvas.height;
    const ix = index.x * canvas.width;
    const iy = index.y * canvas.height;

    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(ix, iy);
    ctx.setLineDash([5, 5]); // 점선
    ctx.strokeStyle = '#ffff00';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.setLineDash([]); // 복구

    // 텍스트 (중간 지점)
    const mx = (tx + ix) / 2;
    const my = (ty + iy) / 2;

    // 거울모드 해제 (텍스트)
    ctx.save();
    ctx.translate(mx, my);
    ctx.scale(-1, 1);

    // 배경 박스
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(-17, -20, 34, 16); // Centered box

    ctx.fillStyle = '#ffff00';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(normalizedDist.toFixed(2), 0, -8);
    ctx.restore();
}

function drawLips(face) {
    const lipPoints = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146];
    ctx.strokeStyle = '#ff6b9d';
    ctx.lineWidth = 2;
    ctx.beginPath();
    lipPoints.forEach((idx, i) => {
        const p = face[idx];
        const x = p.x * canvas.width;
        const y = p.y * canvas.height;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.stroke();
}

let lastVideoTime = -1;

function detectFrame() {
    if (!isRunning) return;

    const now = performance.now();

    // Throttling: 50ms (FPS 20) 제한
    if (now - lastTime < 50) {
        requestAnimationFrame(detectFrame);
        return;
    }
    if (video.currentTime === lastVideoTime) {
        requestAnimationFrame(detectFrame);
        return;
    }
    lastVideoTime = video.currentTime;
    lastTime = now;

    const handResults = handLandmarker.detectForVideo(video, now);
    const faceResults = faceLandmarker.detectForVideo(video, now);

    // FPS
    frameCount++;
    if (now - lastTime >= 1000) {
        const fpsEl = document.getElementById('fps');
        if (fpsEl) fpsEl.textContent = frameCount + ' FPS';
        frameCount = 0;
        lastTime = now;
    }

    let gesture = { type: 'none', score: 0, emoji: '🤚', label: '대기' };

    // 캔버스 초기화
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 손 처리
    let currentAnalysisData = null;

    if (handResults.landmarks?.length > 0) {
        // 모든 손 그리기
        handResults.landmarks.forEach((landmarks, handIdx) => {
            const color = handIdx === 0 ? '#667eea' : '#ff6b9d';
            drawLandmarks(landmarks, color, handIdx);
        });

        // 첫 번째 손으로 제스처 감지
        const landmarks = handResults.landmarks[0];

        // 얼굴 정보 미리 추출
        const face = faceResults.faceLandmarks?.length > 0 ? faceResults.faceLandmarks[0] : null;

        // detectGesture에서 데이터 분석 및 결과 반환 (얼굴 정보 포함 전달)
        const detectionResult = detectGesture(landmarks, { allHands: handResults.landmarks, faceLandmarks: face });

        // 제스처 정보 추출 (UI 표시용)
        gesture = {
            type: detectionResult.type,
            score: detectionResult.score,
            emoji: detectionResult.emoji,
            label: detectionResult.label
        };

        currentAnalysisData = detectionResult.analysisData;

        // 두 번째 손 상태 분석
        let hand2Data = null;
        if (handResults.landmarks.length >= 2) {
            const lm2 = handResults.landmarks[1];
            // 간단 분석 (상세 분석은 detectGesture가 추후 지원 가능)
            const palmSize2 = distance(lm2[0], lm2[9]);
            const calc2 = calculateDistances(lm2, palmSize2);

            // 엄지 확장 여부 보정
            const thumb2Ext = isFingerExtended(lm2, 4, 3) &&
                (distance(lm2[4], lm2[5]) / palmSize2 > 0.5 || distance(lm2[4], lm2[0]) / palmSize2 > 1.2);
            calc2.fingers.thumb.extended = thumb2Ext;

            const extendedCount2 = Object.values(calc2.fingers).filter(f => f.extended).length;
            hand2Data = { fingers: calc2.fingers, extendedCount: extendedCount2 };
        }

        // Metrics 및 FingerStatus 패널 업데이트 (데이터 소스: detectGesture 결과)
        if (currentAnalysisData) {
            if (currentAnalysisData.metrics) {
                metricsPanel.update(currentAnalysisData.metrics);
            }
            fingerStatusPanel.update(
                { fingers: currentAnalysisData.fingers, extendedCount: currentAnalysisData.extendedCount },
                hand2Data
            );
        }

        // 거리 패널
        const ar = video.videoWidth / video.videoHeight;
        const worldLandmarks = handResults.worldLandmarks ? handResults.worldLandmarks[0] : null;
        distancePanel.update(handResults.landmarks[0], ar, worldLandmarks);

        // 양손 제스처 (탈모빔 등)
        if (handResults.landmarks.length >= 2) {
            // 양손 정보 그리기 (엄지-엄지 거리)
            try {
                drawDualHandInfo(handResults.landmarks[0], handResults.landmarks[1], ar);
            } catch (e) {
                // 에러 발생 시 로그 출력 후 계속 진행
                // console.error(e);
            }

            const panelRes = dualHandPanel.update(handResults.landmarks, null, ar);
            const avgPalm = panelRes.avgPalm;
            const hand1 = handResults.landmarks[0];
            const hand2 = handResults.landmarks[1];

            // 1. 탈모빔 체크 (양손 제스처 - 최우선)
            const talmoResult = talmoBeamGesture.check(handResults.landmarks, {
                allHands: handResults.landmarks,
                palmSize: avgPalm,
                aspectRatio: ar
            });

            if (talmoResult.detected) {
                // 탈모빔 감지 시
                dualHandPanel.update(handResults.landmarks, '<span style="color:#ff6b9d;font-size:22px">⚡ 탈모빔! ⚡</span>', ar);
                gesture = talmoResult;
                window.talmoBeamActive = true;
            } else {
                // 2. 손하트 체크
                const heartResult = heartGesture.check(handResults.landmarks, { palmSize: avgPalm });
                if (heartResult.detected) {
                    dualHandPanel.update(handResults.landmarks, '<span style="color:#ff6b9d;font-size:22px">💕 손하트! 💕</span>', ar);
                    gesture = { type: 'handHeart', score: 0.95, emoji: '💕', label: '손하트!' };
                }
            }
        } else {
            dualHandPanel.update([]);
        }
    } else {
        distancePanel.update([]);
        dualHandPanel.update([]);
    }

    // 얼굴/입술/볼콕 처리
    if (faceResults.faceLandmarks?.length > 0) {
        const face = faceResults.faceLandmarks[0];
        const mFace = document.getElementById('metricFace');
        if (mFace) mFace.textContent = '✅';

        // 키스 감지
        const kissResult = kissGesture.detectWithThresholds(faceResults.faceLandmarks, {
            ratioHigh: thresholds.kiss,
            ratioMedium: thresholds.kiss * 0.7,
            horizontalHigh: thresholds.kissMinSize,
            horizontalMedium: thresholds.kissMinSize * 1.25
        });

        if (kissResult.detected && kissResult.score > gesture.score) {
            gesture = { type: 'kiss', score: kissResult.score, emoji: '💋', label: '뽀뽀!' };
        }
        lipStatusPanel.update(kissResult);
        drawLips(face);

        // 🎯 탈모빔 효과: 대머리 오버레이!
        if (window.talmoBeamActive) {
            drawTalmoBeamEffect(face);
            window.talmoBeamActive = false;
        }

        // 볼콕 감지 (손+얼굴)
        if (handResults.landmarks?.length > 0) {
            const handLandmarks = handResults.landmarks[0];
            const faceTop = face[10];
            const faceBottom = face[152];
            const faceSize = distance(faceTop, faceBottom);
            const palmSize = distance(handLandmarks[0], handLandmarks[9]);

            const lRes = leftPokeGesture.check(handResults.landmarks, { faceSize, palmSize }, face);
            const rRes = rightPokeGesture.check(handResults.landmarks, { faceSize, palmSize }, face);

            const { isLeft, isRight, isBoth } = cheekPokePanel.update(lRes, rRes, faceSize);
            landmarkRawPanel.update(handLandmarks);

            if (isBoth) {
                gesture = { type: 'bothCheekPoke', score: 0.95, emoji: '💕', label: '양볼콕!' };
            } else if (isRight && gesture.score < rRes.score) {
                gesture = { type: 'cheekPoke', score: rRes.score, emoji: rRes.emoji, label: rRes.label };
            } else if (isLeft && gesture.score < lRes.score) {
                gesture = { type: 'cheekPoke', score: lRes.score, emoji: lRes.emoji, label: lRes.label };
            }

            // 볼콕 시각화
            drawCheekPokePoints(face, handLandmarks[8], isLeft, isRight, isBoth);
        } else {
            cheekPokePanel.clear();
        }

    } else {
        lipStatusPanel.clear();
        const mFace = document.getElementById('metricFace');
        if (mFace) mFace.textContent = '-';
        document.getElementById('metricLeftCheek').textContent = '-';
        document.getElementById('metricRightCheek').textContent = '-';
    }

    // 결과 표시
    updateGestureUI(gesture);

    requestAnimationFrame(detectFrame);
}

function drawTalmoBeamEffect(face) {
    const glabella = face[9];
    const leftTemple = face[70];
    const rightTemple = face[300];
    const fx = glabella.x * canvas.width;
    const fy = glabella.y * canvas.height;
    const faceWidth = Math.abs((rightTemple.x - leftTemple.x) * canvas.width);

    // 피부색 샘플링 (간소화 - 고정값 사용)
    const skinColor = '#e8c4a0';

    ctx.save();
    const baldGrad = ctx.createRadialGradient(
        fx, fy - faceWidth * 0.3, 0,
        fx, fy - faceWidth * 0.3, faceWidth * 1.0
    );
    baldGrad.addColorStop(0, skinColor);
    baldGrad.addColorStop(0.7, skinColor);
    baldGrad.addColorStop(1, 'rgba(0,0,0,0)');

    ctx.beginPath();
    ctx.ellipse(fx, fy, faceWidth * 1, faceWidth * 0.9, 0, Math.PI, 0);
    ctx.fillStyle = baldGrad;
    ctx.fill();
    ctx.restore();
}

function drawCheekPokePoints(face, indexTip, isLeft, isRight, isBoth) {
    // 좌표 계산 및 그리기
    // Left/Right Swap applied as requested
    const leftCheekPoints = [411, 376, 345, 352, 280].map(i => face[i]);
    const rightCheekPoints = [187, 147, 116, 123, 50].map(i => face[i]);

    const findClosest = (points) => points.reduce((closest, p) =>
        distance(indexTip, p) < distance(indexTip, closest) ? p : closest
    );

    const leftCheek = findClosest(leftCheekPoints);
    const rightCheek = findClosest(rightCheekPoints);

    const drawPoint = (pt, active) => {
        const x = pt.x * canvas.width;
        const y = pt.y * canvas.height;
        ctx.beginPath();
        ctx.arc(x, y, active ? 15 : 8, 0, 2 * Math.PI);
        ctx.fillStyle = isBoth ? '#ff6b9d' : (active ? '#4ade80' : '#ff6b9d');
        ctx.fill();
    };

    drawPoint(leftCheek, isLeft);
    drawPoint(rightCheek, isRight);
}

function drawDualHandInfo(hand1, hand2, ar) {
    if (!hand1 || !hand2 || !hand1[4] || !hand2[4]) return;

    const t1 = hand1[4]; // 엄지
    const t2 = hand2[4]; // 엄지

    // 거리 계산 (Normalized)
    const palm1 = distanceAR(hand1[0], hand1[9], ar);
    const palm2 = distanceAR(hand2[0], hand2[9], ar);
    const avgPalm = (palm1 + palm2) / 2 || 1; // 0 방지
    const dist = distanceAR(t1, t2, ar);
    const normDist = dist / avgPalm;

    if (isNaN(normDist)) return;

    // 선 그리기
    const x1 = t1.x * canvas.width;
    const y1 = t1.y * canvas.height;
    const x2 = t2.x * canvas.width;
    const y2 = t2.y * canvas.height;

    if (isNaN(x1) || isNaN(y1) || isNaN(x2) || isNaN(y2)) return;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.setLineDash([10, 5]);
    ctx.strokeStyle = '#00ffff'; // 시안색 (눈에 잘 띄게)
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.setLineDash([]);

    // 텍스트 표시
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;

    ctx.translate(mx, my);
    ctx.scale(-1, 1); // 거울모드 해제 대응

    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(-25, -12, 50, 24);

    ctx.fillStyle = '#00ffff';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(normDist.toFixed(2), 0, 0);

    ctx.restore();
}

function updateGestureUI(gesture) {
    if (gesture.score > 0.6) {
        document.getElementById('emoji').textContent = gesture.emoji;
        document.getElementById('label').textContent = gesture.label;
        document.getElementById('score').textContent = `신뢰도: ${(gesture.score * 100).toFixed(0)}%`;

        if (gesture.type !== 'none' && gesture.score > 0.8) {
            const logContainer = document.getElementById('log');
            const lastLog = logContainer.firstChild;
            if (!lastLog || lastLog.textContent.indexOf(gesture.label) === -1 || frameCount % 60 === 0) {
                log(`${gesture.emoji} ${gesture.label} (${(gesture.score * 100).toFixed(0)}%)`);
            }
        }
    } else {
        if (frameCount % 10 === 0) {
            document.getElementById('emoji').textContent = '🤚';
            document.getElementById('label').textContent = '대기...';
            document.getElementById('score').textContent = '-';
        }
    }
}

// 이벤트 바인딩
cameraSection.bindEvents({
    onInit: async () => {
        log('초기화 중... (Modules Loading)');
        const vision = await FilesetResolver.forVisionTasks(
            'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        );
        handLandmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
                delegate: 'GPU'
            },
            runningMode: 'VIDEO',
            numHands: 2
        });
        log('✅ Hand OK');

        faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
                delegate: 'GPU'
            },
            runningMode: 'VIDEO',
            numFaces: 1
        });
        log('✅ Face OK');
    },
    onCameraReady: () => {
        log('✅ 카메라 시작');
    },
    onStart: () => {
        isRunning = true;
        log('🎯 감지 시작');
        detectFrame();
    }
});
