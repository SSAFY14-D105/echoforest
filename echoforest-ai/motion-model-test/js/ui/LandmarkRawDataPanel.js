export default class LandmarkRawDataPanel {
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
                <h3>📍 랜드마크 원시 데이터</h3>
                <div style="font-family:monospace;font-size:12px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:5px;">
                    <div>idx</div><div>x</div><div>y</div>
                    <div>4(엄지)</div><div id="lm4x">-</div><div id="lm4y">-</div>
                    <div>8(검지)</div><div id="lm8x">-</div><div id="lm8y">-</div>
                    <div>12(중지)</div><div id="lm12x">-</div><div id="lm12y">-</div>
                    <div>16(약지)</div><div id="lm16x">-</div><div id="lm16y">-</div>
                    <div>20(새끼)</div><div id="lm20x">-</div><div id="lm20y">-</div>
                </div>
            </div>
        `;
    }

    cacheElements() {
        this.els = {};
        [4, 8, 12, 16, 20].forEach(idx => {
            this.els[`${idx}x`] = document.getElementById(`lm${idx}x`);
            this.els[`${idx}y`] = document.getElementById(`lm${idx}y`);
        });
    }

    update(landmarks) {
        if (!landmarks || landmarks.length === 0) {
            this.clear();
            return;
        }

        [4, 8, 12, 16, 20].forEach(idx => {
            const p = landmarks[idx];
            if (this.els[`${idx}x`]) this.els[`${idx}x`].textContent = p.x.toFixed(3);
            if (this.els[`${idx}y`]) this.els[`${idx}y`].textContent = p.y.toFixed(3);
        });
    }

    clear() {
        [4, 8, 12, 16, 20].forEach(idx => {
            if (this.els[`${idx}x`]) this.els[`${idx}x`].textContent = '-';
            if (this.els[`${idx}y`]) this.els[`${idx}y`].textContent = '-';
        });
    }
}
