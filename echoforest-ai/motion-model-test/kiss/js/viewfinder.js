/**
 * Viewfinder - 카메라 뷰파인더 클래스
 * MediaPipe FaceLandmarker 초기화 및 카메라 관리
 */
export class Viewfinder {
    constructor(videoElement, canvasElement) {
        this.video = videoElement;
        this.canvas = canvasElement;
        this.ctx = canvasElement?.getContext('2d');
        this.faceLandmarker = null;
        this.isRunning = false;
        this.frameCallback = null;
        this.animationFrameId = null;

        // FPS 계산용
        this.frameCount = 0;
        this.lastFpsTime = performance.now();
        this.currentFps = 0;
    }

    /**
     * MediaPipe FaceLandmarker 초기화
     */
    async initialize() {
        console.log('[Viewfinder] Initializing FaceLandmarker...');

        const { FilesetResolver, FaceLandmarker } = await import(
            'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest'
        );

        const vision = await FilesetResolver.forVisionTasks(
            'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        );

        this.faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
                delegate: 'GPU'
            },
            runningMode: 'VIDEO',
            numFaces: 1
        });

        // 캔버스 크기 설정
        if (this.canvas) {
            this.canvas.width = 640;
            this.canvas.height = 480;
        }

        console.log('[Viewfinder] FaceLandmarker initialized');
        return true;
    }

    /**
     * 카메라 시작
     */
    async startCamera() {
        console.log('[Viewfinder] Starting camera...');

        const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 480, facingMode: 'user' }
        });

        this.video.srcObject = stream;
        await this.video.play();

        console.log('[Viewfinder] Camera started');
        return true;
    }

    /**
     * 감지 루프 시작
     */
    startDetection(callback) {
        if (!this.faceLandmarker) {
            throw new Error('FaceLandmarker not initialized');
        }

        this.frameCallback = callback;
        this.isRunning = true;
        this.detectFrame();

        console.log('[Viewfinder] Detection started');
    }

    /**
     * 프레임별 감지 수행
     */
    detectFrame() {
        if (!this.isRunning) return;

        const now = performance.now();

        // FPS 계산
        this.frameCount++;
        if (now - this.lastFpsTime >= 1000) {
            this.currentFps = this.frameCount;
            this.frameCount = 0;
            this.lastFpsTime = now;
        }

        // 얼굴 감지
        const results = this.faceLandmarker.detectForVideo(this.video, now);

        // 콜백 호출
        if (this.frameCallback) {
            this.frameCallback({
                faceLandmarks: results.faceLandmarks,
                timestamp: now,
                fps: this.currentFps
            });
        }

        // 다음 프레임 예약
        this.animationFrameId = requestAnimationFrame(() => this.detectFrame());
    }

    /**
     * 감지 중지
     */
    stop() {
        this.isRunning = false;

        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }

        // 카메라 정리
        if (this.video?.srcObject) {
            const tracks = this.video.srcObject.getTracks();
            tracks.forEach(track => track.stop());
            this.video.srcObject = null;
        }

        console.log('[Viewfinder] Stopped');
    }

    /**
     * 입술 랜드마크 시각화
     */
    drawLipLandmarks(faceLandmarks) {
        if (!this.ctx || !faceLandmarks || faceLandmarks.length === 0) return;

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        const face = faceLandmarks[0];
        if (!face) return;

        // 입술 관련 랜드마크 인덱스
        const lipIndices = [13, 14, 61, 291, 0, 17, 37, 39, 40, 267, 269, 270];

        this.ctx.fillStyle = '#ff6b9d';
        lipIndices.forEach(idx => {
            if (face[idx]) {
                const x = face[idx].x * this.canvas.width;
                const y = face[idx].y * this.canvas.height;
                this.ctx.beginPath();
                this.ctx.arc(x, y, 3, 0, Math.PI * 2);
                this.ctx.fill();
            }
        });
    }

    /**
     * 현재 FPS 조회
     */
    getFps() {
        return this.currentFps;
    }
}
