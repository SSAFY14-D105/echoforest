export default class LipStatusPanel {
    constructor(containerId) {
        this.containerId = containerId;
        this.render();
        this.cacheElements();
    }

    render() {
        const container = document.getElementById(this.containerId);
        if (!container) return;

        container.innerHTML = `
            <div class="panel">
                <h3>💋 입술 수치</h3>
                <div class="metrics-grid">
                    <div class="metric">
                        <div class="metric-label">입술 세로</div>
                        <div class="metric-value" id="metricLipV">-</div>
                    </div>
                    <div class="metric">
                        <div class="metric-label">입술 가로</div>
                        <div class="metric-value" id="metricLipH">-</div>
                    </div>
                    <div class="metric">
                        <div class="metric-label">세로/가로 비율</div>
                        <div class="metric-value" id="metricLipRatio">-</div>
                    </div>
                    <div class="metric">
                        <div class="metric-label">얼굴 감지</div>
                        <div class="metric-value" id="metricFace">❌</div>
                    </div>
                </div>
            </div>
        `;
    }

    cacheElements() {
        this.elV = document.getElementById('metricLipV');
        this.elH = document.getElementById('metricLipH');
        this.elRatio = document.getElementById('metricLipRatio');
        this.elFace = document.getElementById('metricFace');
    }

    update(kissResult) {
        // kissResult가 감지 여부와 상관없이 계산된 데이터를 포함하고 있다고 가정
        // Kiss.js의 detect 반환 구조: { detected, score, data: { faceDetected, verticalDist, ... } }

        const data = kissResult.data || {};
        const faceDetected = data.faceDetected;

        if (faceDetected) {
            if (this.elFace) this.elFace.textContent = '✅';

            // 데이터가 있으면 표시, 없으면 (landmark insufficient etc) '-'
            if (data.lipLandmarksFound) {
                if (this.elV) this.elV.textContent = (data.verticalDist || 0).toFixed(4);
                if (this.elH) this.elH.textContent = (data.horizontalDist || 0).toFixed(4);
                if (this.elRatio) this.elRatio.textContent = (data.ratio || 0).toFixed(4);
            } else {
                this.clearMetrics();
            }
        } else {
            this.clear();
        }
    }

    clear() {
        if (this.elFace) this.elFace.textContent = '❌';
        this.clearMetrics();
    }

    clearMetrics() {
        if (this.elV) this.elV.textContent = '-';
        if (this.elH) this.elH.textContent = '-';
        if (this.elRatio) this.elRatio.textContent = '-';
    }
}
