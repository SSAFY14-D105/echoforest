export default class CameraSection {
    constructor(containerId) {
        this.containerId = containerId;
        this.render();

        this.video = document.getElementById('video');
        this.canvas = document.getElementById('canvas'); // Keep for legacy
        this.btnInit = document.getElementById('btnInit');
        this.btnCamera = document.getElementById('btnCamera');
        this.btnStart = document.getElementById('btnStart');

        // Output elements
        this.emojiEl = document.getElementById('emoji');
        this.labelEl = document.getElementById('label');
        this.scoreEl = document.getElementById('score');

        this.initialized = false;
        this.stream = null;
    }

    render() {
        const container = document.getElementById(this.containerId);
        if (!container) return;

        container.innerHTML = `
            <div class="camera-wrapper">
                <video id="video" autoplay playsinline muted></video>
                <canvas id="canvas"></canvas>
            </div>

            <div class="controls-bar">
                <button class="btn" id="btnInit">1️⃣ 초기화</button>
                <button class="btn" id="btnCamera" disabled>2️⃣ 카메라</button>
                <button class="btn" id="btnStart" disabled>3️⃣ 시작</button>
                <span id="fps" style="margin-left:auto;color:#888">0 FPS</span>
            </div>

            <div class="detection-result">
                <div class="detection-emoji" id="emoji">🤚</div>
                <div class="detection-label" id="label">대기중</div>
                <div class="detection-score" id="score">-</div>
            </div>
        `;

        if (!container.classList.contains('camera-section')) {
            container.classList.add('camera-section');
        }
    }

    // Attach event listeners to buttons
    bindEvents(callbacks = {}) {
        if (this.btnInit) {
            this.btnInit.addEventListener('click', async () => {
                this.btnInit.disabled = true;
                if (callbacks.onInit) await callbacks.onInit();
                // Enable camera button on success (usually handled by caller, but here for convenience)
                if (this.btnCamera) this.btnCamera.disabled = false;
            });
        }

        if (this.btnCamera) {
            this.btnCamera.addEventListener('click', async () => {
                const success = await this.startCamera();
                if (success) {
                    this.btnCamera.disabled = true;
                    if (this.btnStart) this.btnStart.disabled = false;
                    if (callbacks.onCameraReady) callbacks.onCameraReady();
                }
            });
        }

        if (this.btnStart) {
            this.btnStart.addEventListener('click', () => {
                this.btnStart.disabled = true;
                if (callbacks.onStart) callbacks.onStart();
            });
        }
    }

    async startCamera() {
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    facingMode: 'user'
                }
            });

            this.video.srcObject = this.stream;

            return new Promise((resolve) => {
                this.video.onloadedmetadata = () => {
                    this.video.play();
                    this.canvas.width = this.video.videoWidth;
                    this.canvas.height = this.video.videoHeight;
                    resolve(true);
                };
            });
        } catch (e) {
            console.error('Camera error:', e);
            alert('카메라 시작 실패: ' + e.message);
            return false;
        }
    }

    updateResult(gesture) {
        if (this.emojiEl) this.emojiEl.textContent = gesture.emoji;
        if (this.labelEl) this.labelEl.textContent = gesture.label;
        if (this.scoreEl) {
            this.scoreEl.textContent = gesture.score > 0 ?
                `신뢰도: ${(gesture.score * 100).toFixed(0)}%` : '-';
        }
    }
}
