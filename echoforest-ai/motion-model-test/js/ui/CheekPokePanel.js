export default class CheekPokePanel {
    constructor(containerId, initialThreshold = 0.25) {
        this.containerId = containerId;
        this.threshold = initialThreshold;
        this.render();
        this.cacheElements();
        this.bindEvents();
    }

    render() {
        const container = document.getElementById(this.containerId);
        if (!container) return;

        container.innerHTML = `
            <div class="panel">
                <h3>👆😊 볼콕 감지</h3>
                <div style="display:flex;gap:10px;margin-bottom:10px">
                    <select id="pokeFingerSelect" style="flex:1;padding:5px">
                        <option value="4">4: THUMB_TIP (엄지)</option>
                        <option value="8" selected>8: INDEX_TIP (검지)</option>
                        <option value="12">12: MIDDLE_TIP (중지)</option>
                        <option value="16">16: RING_TIP (약지)</option>
                        <option value="20">20: PINKY_TIP (새끼)</option>
                    </select>
                </div>
                <div class="metrics-grid">
                    <div class="metric">
                        <div class="metric-label">왼볼 거리</div>
                        <div class="metric-value" id="metricLeftCheek">-</div>
                    </div>
                    <div class="metric">
                        <div class="metric-label">오른볼 거리</div>
                        <div class="metric-value" id="metricRightCheek">-</div>
                    </div>
                    <div class="metric">
                        <div class="metric-label">얼굴 크기</div>
                        <div class="metric-value" id="metricFaceSize">-</div>
                    </div>
                    <div class="metric">
                        <div class="metric-label">정규화 거리</div>
                        <div class="metric-value" id="metricCheekNorm">-</div>
                    </div>
                </div>
                <div class="slider-group" style="margin-top:10px">
                    <div class="slider-label">
                        <span>볼콕 임계값</span>
                        <span id="valCheekThresh">${this.threshold.toFixed(2)}</span>
                    </div>
                    <input type="range" id="sliderCheekThresh" min="0.1" max="0.5" step="0.01" value="${this.threshold}">
                </div>
                <div style="text-align:center;margin-top:10px;padding:12px;background:rgba(0,0,0,0.3);border-radius:4px">
                    <span id="cheekPokeResult" style="font-size:20px">👆😊 대기중...</span>
                </div>
            </div>
        `;
    }

    cacheElements() {
        this.elLeft = document.getElementById('metricLeftCheek');
        this.elRight = document.getElementById('metricRightCheek');
        this.elFaceSize = document.getElementById('metricFaceSize');
        this.elNorm = document.getElementById('metricCheekNorm');
        this.elResult = document.getElementById('cheekPokeResult');
        this.elSlider = document.getElementById('sliderCheekThresh');
        this.elValThresh = document.getElementById('valCheekThresh');
    }

    bindEvents() {
        if (this.elSlider) {
            this.elSlider.addEventListener('input', e => {
                this.threshold = parseFloat(e.target.value);
                if (this.elValThresh) this.elValThresh.textContent = this.threshold.toFixed(2);
            });
        }
    }

    // 외부에서 lRes, rRes, faceSize 등을 받아서 UI 업데이트
    update(lRes, rRes, faceSize) {
        // 거리 수치 업데이트
        if (this.elLeft) this.elLeft.textContent = lRes.details?.minDist ? lRes.details.minDist : '-';
        if (this.elRight) this.elRight.textContent = rRes.details?.minDist ? rRes.details.minDist : '-';
        if (this.elFaceSize) this.elFaceSize.textContent = faceSize ? faceSize.toFixed(4) : '-';

        const minNorm = Math.min(
            parseFloat(lRes.details?.minDist || 999),
            parseFloat(rRes.details?.minDist || 999)
        );
        if (this.elNorm) this.elNorm.textContent = minNorm === 999 ? '-' : minNorm.toFixed(4);

        // 결과 텍스트 및 이모지
        const isLeft = lRes.detected;
        const isRight = rRes.detected;
        const isBoth = isLeft && isRight;

        if (this.elResult) {
            if (isBoth) {
                this.elResult.innerHTML = `<span style="color:#ff6b9d;font-size:24px">💕 양볼콕! 💕</span>`;
            } else if (isRight) {
                this.elResult.innerHTML = `<span style="color:#4ade80">✅ ${rRes.label} (${rRes.details.minDist})</span>`;
            } else if (isLeft) {
                this.elResult.innerHTML = `<span style="color:#4ade80">✅ ${lRes.label} (${lRes.details.minDist})</span>`;
            } else {
                this.elResult.innerHTML = `<span style="color:#888">❌ 대기중</span>`;
            }
        }

        return { isLeft, isRight, isBoth };
    }

    clear() {
        if (this.elLeft) this.elLeft.textContent = '-';
        if (this.elRight) this.elRight.textContent = '-';
        if (this.elFaceSize) this.elFaceSize.textContent = '-';
        if (this.elNorm) this.elNorm.textContent = '-';
        if (this.elResult) this.elResult.innerHTML = '👆😊 손 필요';
    }
}
