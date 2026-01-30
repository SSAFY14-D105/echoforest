export default class MetricsPanel {
    constructor(containerId) {
        this.containerId = containerId;
        this.render();
        // Cache elements for updates
        this.els = {
            thumbIndex: document.getElementById('metricThumbIndex'),
            palm: document.getElementById('metricPalm'),
            norm: document.getElementById('metricNorm'),
            closed: document.getElementById('metricClosed')
        };
    }

    render() {
        const container = document.getElementById(this.containerId);
        if (!container) return;

        container.innerHTML = `
            <div class="panel">
                <h3>📊 실시간 수치</h3>
                <div class="metrics-grid">
                    <div class="metric">
                        <div class="metric-label">엄지-검지 거리</div>
                        <div class="metric-value" id="metricThumbIndex">-</div>
                    </div>
                    <div class="metric">
                        <div class="metric-label">손바닥 크기</div>
                        <div class="metric-value" id="metricPalm">-</div>
                    </div>
                    <div class="metric">
                        <div class="metric-label">정규화 거리</div>
                        <div class="metric-value" id="metricNorm">-</div>
                    </div>
                    <div class="metric">
                        <div class="metric-label">접힌 손가락</div>
                        <div class="metric-value" id="metricClosed">-</div>
                    </div>
                </div>
            </div>
        `;
    }

    update(metrics) {
        if (this.els.thumbIndex) this.els.thumbIndex.textContent = metrics.thumbIndex || '-';
        if (this.els.palm) this.els.palm.textContent = metrics.palm || '-';
        if (this.els.norm) this.els.norm.textContent = metrics.norm || '-';
        if (this.els.closed) this.els.closed.textContent = metrics.closed || '-';
    }
}
