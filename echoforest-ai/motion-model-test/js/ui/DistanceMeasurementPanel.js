import { distanceAR, distance } from '../utils/gesture-helpers.js';

export default class DistanceMeasurementPanel {
    constructor(containerId) {
        this.containerId = containerId;
        this.render();
        this.cacheElements();
        this.bindEvents();
        this.threshold = 0.20;
    }

    render() {
        const container = document.getElementById(this.containerId);
        if (!container) return;

        container.innerHTML = `
            <div class="panel">
                <h3>📏 손 랜드마크 거리 측정</h3>
                
                <!-- 빠른 프리셋 버튼 -->
                <div style="margin-bottom:12px">
                    <div style="font-size:11px;color:#888;margin-bottom:6px">🎯 빠른 측정</div>
                    <div style="display:flex;flex-wrap:wrap;gap:4px">
                        <button class="preset-btn" data-a="4" data-b="8">👍↔☝️</button>
                        <button class="preset-btn" data-a="4" data-b="12">👍↔🖕</button>
                        <button class="preset-btn" data-a="4" data-b="16">👍↔💍</button>
                        <button class="preset-btn" data-a="4" data-b="20">👍↔🤙</button>
                        <button class="preset-btn" data-a="8" data-b="12">☝️↔🖕</button>
                        <button class="preset-btn" data-a="12" data-b="16">🖕↔💍</button>
                        <button class="preset-btn" data-a="16" data-b="20">💍↔🤙</button>
                    </div>
                    <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px">
                        <button class="preset-btn" data-a="0" data-b="9">손바닥</button>
                        <button class="preset-btn" data-a="0" data-b="4">손목↔엄지</button>
                        <button class="preset-btn" data-a="0" data-b="8">손목↔검지</button>
                        <button class="preset-btn" data-a="0" data-b="12">손목↔중지</button>
                        <button class="preset-btn" data-a="5" data-b="8">검지펴짐</button>
                        <button class="preset-btn" data-a="9" data-b="12">중지펴짐</button>
                    </div>
                </div>

                <div style="display:flex;gap:10px;margin-bottom:10px">
                    <select id="pointA" style="flex:1;padding:5px">
                        <option value="0">0: WRIST</option>
                        <option value="1">1: THUMB_CMC</option>
                        <option value="2">2: THUMB_MCP</option>
                        <option value="3">3: THUMB_IP</option>
                        <option value="4" selected>4: THUMB_TIP</option>
                        <option value="5">5: INDEX_MCP</option>
                        <option value="6">6: INDEX_PIP</option>
                        <option value="7">7: INDEX_DIP</option>
                        <option value="8">8: INDEX_TIP</option>
                        <option value="9">9: MIDDLE_MCP</option>
                        <option value="10">10: MIDDLE_PIP</option>
                        <option value="11">11: MIDDLE_DIP</option>
                        <option value="12">12: MIDDLE_TIP</option>
                        <option value="13">13: RING_MCP</option>
                        <option value="14">14: RING_PIP</option>
                        <option value="15">15: RING_DIP</option>
                        <option value="16">16: RING_TIP</option>
                        <option value="17">17: PINKY_MCP</option>
                        <option value="18">18: PINKY_PIP</option>
                        <option value="19">19: PINKY_DIP</option>
                        <option value="20">20: PINKY_TIP</option>
                    </select>
                    <span style="color:#888">↔</span>
                    <select id="pointB" style="flex:1;padding:5px">
                        <option value="0">0: WRIST</option>
                        <option value="4">4: THUMB_TIP</option>
                        <option value="5">5: INDEX_MCP</option>
                        <option value="8" selected>8: INDEX_TIP</option>
                        <option value="9">9: MIDDLE_MCP</option>
                        <option value="12">12: MIDDLE_TIP</option>
                        <option value="17">17: PINKY_MCP</option>
                        <option value="20">20: PINKY_TIP</option>
                    </select>
                </div>

                <div class="metrics-grid">
                    <div class="metric">
                        <div class="metric-label">거리 (raw)</div>
                        <div class="metric-value" id="customDistRaw">-</div>
                    </div>
                    <div class="metric">
                        <div class="metric-label">정규화 거리</div>
                        <div class="metric-value" id="customDistNorm">-</div>
                    </div>
                </div>
                <div class="slider-group" style="margin-top:10px">
                    <div class="slider-label">
                        <span>임계값</span>
                        <span id="valCustomThresh">0.20</span>
                    </div>
                    <input type="range" id="sliderCustomThresh" min="0.05" max="0.5" step="0.01" value="0.2">
                </div>
                <div style="text-align:center;margin-top:10px;padding:8px;background:rgba(0,0,0,0.3);border-radius:4px">
                    <span id="customResult">거리 < 임계값: ❓</span>
                </div>
                
                <!-- 손 스켈레톤 미리보기 -->
                <div style="margin-top:10px;text-align:center">
                    <canvas id="skeletonPreview" width="200" height="150" 
                    style="background:#111;border-radius:8px; width:100%"></canvas>
                    <div style="font-size:10px;color:#888;margin-top:4px">선택한 점 연결선 표시</div>
                </div>
            </div>
        `;
    }

    cacheElements() {
        this.els = {
            pointA: document.getElementById('pointA'),
            pointB: document.getElementById('pointB'),
            distRaw: document.getElementById('customDistRaw'),
            distNorm: document.getElementById('customDistNorm'),
            valThresh: document.getElementById('valCustomThresh'),
            sliderThresh: document.getElementById('sliderCustomThresh'),
            result: document.getElementById('customResult'),
            canvas: document.getElementById('skeletonPreview'),
            presetBtns: document.querySelectorAll('.preset-btn') // Note: this might select cross presets too if not careful
        };
        this.ctx = this.els.canvas ? this.els.canvas.getContext('2d') : null;
    }

    bindEvents() {
        // Presets
        const buttons = document.querySelectorAll('#' + this.containerId + ' .preset-btn');
        buttons.forEach(btn => {
            btn.addEventListener('click', () => {
                const a = btn.dataset.a;
                const b = btn.dataset.b;
                if (this.els.pointA) this.els.pointA.value = a;
                if (this.els.pointB) this.els.pointB.value = b;
            });
        });

        // Threshold Slider
        if (this.els.sliderThresh) {
            this.els.sliderThresh.addEventListener('input', e => {
                this.threshold = parseFloat(e.target.value);
                if (this.els.valThresh) this.els.valThresh.textContent = this.threshold.toFixed(2);
            });
        }
    }

    update(landmarks, aspectRatio = 1.0) {
        if (!landmarks || landmarks.length === 0) {
            this.clear();
            return;
        }

        const aIdx = parseInt(this.els.pointA.value);
        const bIdx = parseInt(this.els.pointB.value);

        const p1 = landmarks[aIdx];
        const p2 = landmarks[bIdx];

        // Distance (Aspect Ratio Adjusted) - 2D Only for stability
        const dist = this.calculateDistance(p1, p2, aspectRatio);

        // Normalize (using Palm size 0-9)
        const palmSize = this.calculateDistance(landmarks[0], landmarks[9], aspectRatio);
        const normDist = dist / palmSize;

        // Update UI
        if (this.els.distRaw) this.els.distRaw.textContent = dist.toFixed(4);
        if (this.els.distNorm) this.els.distNorm.textContent = normDist.toFixed(4);

        if (normDist < this.threshold) {
            this.els.result.textContent = `거리 < 임계값: ✅ (가까움)`;
            this.els.result.style.color = '#4ade80';
        } else {
            this.els.result.textContent = `거리 < 임계값: ❌ (멀음)`;
            this.els.result.style.color = '#ff6b6b';
        }

        this.drawSkeletonPreview(landmarks, aIdx, bIdx, normDist < this.threshold);
    }

    clear() {
        if (this.els.distRaw) this.els.distRaw.textContent = '-';
        if (this.els.distNorm) this.els.distNorm.textContent = '-';
        if (this.els.result) {
            this.els.result.textContent = '거리 < 임계값: ❓';
            this.els.result.style.color = '';
        }
        if (this.ctx) {
            this.ctx.clearRect(0, 0, this.els.canvas.width, this.els.canvas.height);
        }
    }

    calculateDistance(p1, p2, aspectRatio = 1.0) {
        return distanceAR(p1, p2, aspectRatio);
    }

    drawSkeletonPreview(landmarks, aIdx, bIdx, isClose) {
        if (!this.ctx) return;
        const w = this.els.canvas.width;
        const h = this.els.canvas.height;
        const ctx = this.ctx;

        ctx.clearRect(0, 0, w, h);

        // Center on palm
        const cx = (landmarks[0].x + landmarks[9].x) / 2;
        const cy = (landmarks[0].y + landmarks[9].y) / 2;
        const scale = 1.0; // Adjust as needed, landmarks are 0-1

        // Coordinate transform: map [0,1] to canvas, centering cx,cy
        // But landmarks might be effectively close to each other.
        // Let's use simple scaling like before. 
        // Original code used: x = w - (w/2 + (lm.x - cx)*w*scale) ...
        // Since we are decoupling, let's copy the logic.

        const toCanvas = (lm) => ({
            x: w - (w / 2 + (lm.x - cx) * w * scale), // Mirror horizontally?
            y: h / 2 + (lm.y - cy) * h * scale
        });

        // Draw connections (skeleton)
        const connections = [
            [0, 1], [1, 2], [2, 3], [3, 4],
            [0, 5], [5, 6], [6, 7], [7, 8],
            [0, 9], [9, 10], [10, 11], [11, 12],
            [0, 13], [13, 14], [14, 15], [15, 16],
            [0, 17], [17, 18], [18, 19], [19, 20],
            [5, 9], [9, 13], [13, 17], [0, 17]
        ];

        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.beginPath();
        connections.forEach(([s, e]) => {
            const pS = toCanvas(landmarks[s]);
            const pE = toCanvas(landmarks[e]);
            ctx.moveTo(pS.x, pS.y);
            ctx.lineTo(pE.x, pE.y);
        });
        ctx.stroke();

        // Draw Points
        const p1 = toCanvas(landmarks[aIdx]);
        const p2 = toCanvas(landmarks[bIdx]);

        ctx.beginPath();
        ctx.arc(p1.x, p1.y, 4, 0, 2 * Math.PI);
        ctx.fillStyle = '#667eea';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(p2.x, p2.y, 4, 0, 2 * Math.PI);
        ctx.fillStyle = '#ff6b9d';
        ctx.fill();

        // Line between points
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.strokeStyle = isClose ? '#4ade80' : '#ff6b6b';
        ctx.lineWidth = 2;
        ctx.stroke();
    }
}
