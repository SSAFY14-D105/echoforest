export default class MatrixPanel {
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
                <h3>📏 엄지(4) 기준 거리 매트릭스 (정규화됨)</h3>
                <div class="matrix-grid">
                    <div>Target</div><div>Dist</div>
                    <div>5(검지뿌)</div><div id="d4_5">-</div>
                    <div>8(검지끝)</div><div id="d4_8">-</div>
                    <div>12(중지끝)</div><div id="d4_12">-</div>
                    <div>16(약지끝)</div><div id="d4_16">-</div>
                    <div>20(새끼끝)</div><div id="d4_20">-</div>
                </div>
                <div style="font-size:12px;color:#aaa;margin-top:5px">
                    * Palm Size로 나눈 값.<br>
                    * <span style="color:#ef4444">빨강</span>: 매우 가까움 (0.2)<br>
                    * <span style="color:#eab308">노랑</span>: 가까움 (0.4)
                </div>
            </div>
        `;
    }

    cacheElements() {
        this.els = {
            '5': document.getElementById('d4_5'),
            '8': document.getElementById('d4_8'),
            '12': document.getElementById('d4_12'),
            '16': document.getElementById('d4_16'),
            '20': document.getElementById('d4_20')
        };
    }

    update(distances) {
        if (!distances) {
            this.clear();
            return;
        }

        const updateCell = (idx, val) => {
            const el = this.els[idx];
            if (el) {
                el.textContent = val.toFixed(2);
                el.className = '';
                if (val < 0.2) el.classList.add('highlight-red');
                else if (val < 0.4) el.classList.add('highlight-yellow');
            }
        };

        const targets = [5, 8, 12, 16, 20];
        targets.forEach(t => {
            const val = distances[t];
            if (val !== undefined) updateCell(t, val);
        });
    }

    clear() {
        const targets = [5, 8, 12, 16, 20];
        targets.forEach(t => {
            if (this.els[t]) {
                this.els[t].textContent = '-';
                this.els[t].className = '';
            }
        });
    }
}
