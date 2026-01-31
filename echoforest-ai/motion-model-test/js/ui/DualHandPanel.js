import { distanceAR } from '../utils/gesture-helpers.js';

export default class DualHandPanel {
    constructor(containerId) {
        this.containerId = containerId;
        this.threshold = 0.15;
        this.render();
        this.cacheElements();
        this.bindEvents();
    }

    render() {
        const container = document.getElementById(this.containerId);
        if (!container) return;

        container.innerHTML = `
            <div class="panel">
                <h3>🤝 양손 간 거리 측정</h3>
                <div style="font-size:11px;color:#888;margin-bottom:8px">손1의 점 ↔ 손2의 점 거리</div>

                <!-- 프리셋 버튼 -->
                <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:10px">
                    <button class="preset-btn cross-preset" data-a="4" data-b="4">엄지↔엄지 (탈모빔)</button>
                    <button class="preset-btn cross-preset" data-a="8" data-b="8">검지↔검지</button>
                    <button class="preset-btn cross-preset" data-a="4" data-b="8">엄지↔검지 (하트)</button>
                    <button class="preset-btn cross-preset" data-a="12" data-b="12">중지↔중지</button>
                    <button class="preset-btn cross-preset" data-a="8" data-b="4">검지↔엄지 (하트)</button>
                </div>

                <div style="display:flex;gap:10px;align-items:center;margin-bottom:10px">
                    <div style="flex:1;text-align:center">
                        <div style="font-size:10px;color:#667eea;margin-bottom:4px">손1 🫲</div>
                        <select id="crossPointA" style="width:100%;padding:5px">
                            <option value="4" selected>4: THUMB_TIP</option>
                            <option value="8">8: INDEX_TIP</option>
                            <option value="12">12: MIDDLE_TIP</option>
                            <option value="16">16: RING_TIP</option>
                            <option value="20">20: PINKY_TIP</option>
                            <option value="0">0: WRIST</option>
                        </select>
                    </div>
                    <span style="color:#888">↔</span>
                    <div style="flex:1;text-align:center">
                        <div style="font-size:10px;color:#ff6b9d;margin-bottom:4px">손2 🫱</div>
                        <select id="crossPointB" style="width:100%;padding:5px">
                            <option value="4" selected>4: THUMB_TIP</option>
                            <option value="8">8: INDEX_TIP</option>
                            <option value="12">12: MIDDLE_TIP</option>
                            <option value="16">16: RING_TIP</option>
                            <option value="20">20: PINKY_TIP</option>
                            <option value="0">0: WRIST</option>
                        </select>
                    </div>
                </div>

                <div class="metrics-grid">
                    <div class="metric">
                        <div class="metric-label">거리 (raw)</div>
                        <div class="metric-value" id="crossDistRaw">-</div>
                    </div>
                    <div class="metric">
                        <div class="metric-label">정규화</div>
                        <div class="metric-value" id="crossDistNorm">-</div>
                    </div>
                </div>

                <div class="slider-group" style="margin-top:10px">
                    <div class="slider-label">
                        <span>임계값</span>
                        <span id="valCrossThresh">0.15</span>
                    </div>
                    <input type="range" id="sliderCrossThresh" min="0.05" max="0.4" step="0.01" value="0.15">
                </div>

                <div style="text-align:center;margin-top:10px;padding:12px;background:rgba(0,0,0,0.3);border-radius:4px">
                    <span id="crossResult" style="font-size:18px">🤝 양손 필요</span>
                </div>
            </div>
        `;
    }

    cacheElements() {
        this.els = {
            selectA: document.getElementById('crossPointA'),
            selectB: document.getElementById('crossPointB'),
            distRaw: document.getElementById('crossDistRaw'),
            distNorm: document.getElementById('crossDistNorm'),
            slider: document.getElementById('sliderCrossThresh'),
            valThresh: document.getElementById('valCrossThresh'),
            result: document.getElementById('crossResult'),
            presets: document.querySelectorAll('#' + this.containerId + ' .cross-preset')
        };
    }

    bindEvents() {
        if (this.els.slider) {
            this.els.slider.addEventListener('input', e => {
                this.threshold = parseFloat(e.target.value);
                if (this.els.valThresh) this.els.valThresh.textContent = this.threshold.toFixed(2);
            });
        }

        this.els.presets.forEach(btn => {
            btn.addEventListener('click', () => {
                if (this.els.selectA) this.els.selectA.value = btn.dataset.a;
                if (this.els.selectB) this.els.selectB.value = btn.dataset.b;
            });
        });
    }

    update(allHands, overrideMessage = null, aspectRatio = 1.0) {
        if (!allHands || allHands.length < 2) {
            this.clear();
            return;
        }

        if (overrideMessage) {
            // Update values even if overridden? Yes, useful debug info.
            // But let's proceed with calc first.
        }

        const hand1 = allHands[0];
        const hand2 = allHands[1];

        const idxA = parseInt(this.els.selectA.value);
        const idxB = parseInt(this.els.selectB.value);

        const p1 = hand1[idxA];
        const p2 = hand2[idxB];

        const rawDist = this.calculateDistance(p1, p2, aspectRatio);

        // Normalize using average palm size
        const palm1 = this.calculateDistance(hand1[0], hand1[9], aspectRatio);
        const palm2 = this.calculateDistance(hand2[0], hand2[9], aspectRatio);
        const avgPalm = (palm1 + palm2) / 2;
        const normDist = rawDist / avgPalm;

        // UI Update
        if (this.els.distRaw) this.els.distRaw.textContent = rawDist.toFixed(4);
        if (this.els.distNorm) this.els.distNorm.textContent = normDist.toFixed(4);

        if (overrideMessage) {
            this.els.result.innerHTML = overrideMessage;
        } else {
            const isClose = normDist < this.threshold;
            if (isClose) {
                this.els.result.innerHTML = `<span style="color:#4ade80">✅ 가까움! (${normDist.toFixed(3)})</span>`;
            } else {
                this.els.result.innerHTML = `<span style="color:#888">❌ 거리: ${normDist.toFixed(3)}</span>`;
            }
        }

        return { rawDist, normDist, avgPalm, isClose: normDist < this.threshold };
    }

    clear() {
        if (this.els.distRaw) this.els.distRaw.textContent = '-';
        if (this.els.distNorm) this.els.distNorm.textContent = '-';
        if (this.els.result) this.els.result.innerHTML = '🤝 양손 필요';
    }

    calculateDistance(p1, p2, aspectRatio = 1.0) {
        return distanceAR(p1, p2, aspectRatio);
    }
}
