export default class ThresholdPanel {
    constructor(containerId, initialThresholds = {}) {
        this.containerId = containerId;
        this.thresholds = {
            fist: 1.1,
            ok: 0.18,
            v: 1.05,
            conf: 0.7,
            kiss: 0.6,
            kissMinSize: 0.12,
            // ... any other defaults
            ...initialThresholds
        };
        this.render();
        this.bindEvents();
    }

    render() {
        const container = document.getElementById(this.containerId);
        if (!container) return;

        container.innerHTML = `
            <div class="panel">
                <h3>🎚️ 임계값 조정</h3>

                <div class="slider-group">
                    <div class="slider-label">
                        <span>✊ 주먹 (손가락 접힘 배율)</span>
                        <span id="valFist">${this.thresholds.fist.toFixed(2)}</span>
                    </div>
                    <input type="range" id="sliderFist" min="1.0" max="1.5" step="0.05" value="${this.thresholds.fist}">
                </div>

                <div class="slider-group">
                    <div class="slider-label">
                        <span>👌 OK (거리 임계값)</span>
                        <span id="valOK">${this.thresholds.ok.toFixed(2)}</span>
                    </div>
                    <input type="range" id="sliderOK" min="0.1" max="0.4" step="0.02" value="${this.thresholds.ok}">
                </div>

                <div class="slider-group">
                    <div class="slider-label">
                        <span>✌️ V (펴짐 배율)</span>
                        <span id="valV">${this.thresholds.v.toFixed(2)}</span>
                    </div>
                    <input type="range" id="sliderV" min="1.0" max="1.3" step="0.05" value="${this.thresholds.v}">
                </div>

                <div class="slider-group">
                    <div class="slider-label">
                        <span>🎯 최소 신뢰도</span>
                        <span id="valConf">${this.thresholds.conf.toFixed(2)}</span>
                    </div>
                    <input type="range" id="sliderConf" min="0.5" max="0.95" step="0.05" value="${this.thresholds.conf}">
                </div>

                <div class="slider-group">
                    <div class="slider-label">
                        <span>💋 뽀뽀 (입술 비율 임계값)</span>
                        <span id="valKiss">${this.thresholds.kiss.toFixed(2)}</span>
                    </div>
                    <input type="range" id="sliderKiss" min="0.08" max="1.0" step="0.01" value="${this.thresholds.kiss}">
                </div>

                <div class="slider-group">
                    <div class="slider-label">
                        <span>👄 입술 최소 크기</span>
                        <span id="valKissSize">${this.thresholds.kissMinSize.toFixed(2)}</span>
                    </div>
                    <input type="range" id="sliderKissSize" min="0.02" max="0.5" step="0.01" value="${this.thresholds.kissMinSize}">
                </div>
            </div>
        `;
    }

    bindEvents() {
        const bindSlider = (id, key) => {
            const slider = document.getElementById(id);
            const valSpan = document.getElementById(id.replace('slider', 'val')); // e.g. sliderFist -> valFist
            if (slider && valSpan) {
                slider.addEventListener('input', (e) => {
                    const val = parseFloat(e.target.value);
                    this.thresholds[key] = val;
                    valSpan.textContent = val.toFixed(2);
                    // No callback needed if we read from this.thresholds directly in main loop, 
                    // or we could emit an event. For now, updating state is enough if main loop references this.thresholds.
                });
            }
        };

        bindSlider('sliderFist', 'fist');
        bindSlider('sliderOK', 'ok');
        bindSlider('sliderV', 'v');
        bindSlider('sliderConf', 'conf');
        bindSlider('sliderKiss', 'kiss');
        bindSlider('sliderKissSize', 'kissMinSize');
    }

    // Accessor for current values
    getValues() {
        return this.thresholds;
    }
}
