export default class FingerStatusPanel {
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
                <h3>🖐️ 손가락 상태 (양손)</h3>

                <!-- 손 1 -->
                <div style="margin-bottom:8px;font-size:12px;color:#888">🫲 손1 (첫번째)</div>
                <div class="fingers-status">
                    ${this.renderFingers('finger')}
                    <div class="finger" style="border-left:1px solid #333;padding-left:8px">
                        <div class="finger-icon" id="hand1Count" style="font-size:20px;opacity:1">0</div>
                        <div class="finger-name">개</div>
                    </div>
                </div>

                <!-- 손 2 -->
                <div style="margin-top:12px;margin-bottom:8px;font-size:12px;color:#888">🫱 손2 (두번째)</div>
                <div class="fingers-status">
                    ${this.renderFingers('finger2')}
                   <div class="finger" style="border-left:1px solid #333;padding-left:8px">
                        <div class="finger-icon" id="hand2Count" style="font-size:20px;opacity:1">0</div>
                        <div class="finger-name">개</div>
                    </div>
                </div>

                <!-- 합계 -->
                <div style="margin-top:15px;text-align:center;padding:12px;background:linear-gradient(135deg,#667eea22,#764ba222);border-radius:8px">
                    <div style="font-size:12px;color:#888;margin-bottom:4px">🎯 양손 합계 (이심전심!)</div>
                    <div id="totalFingers" style="font-size:32px;font-weight:bold;color:#4ade80">0</div>
                </div>
            </div>
        `;
    }

    renderFingers(prefix) {
        const fingers = [
            { id: 'Thumb', label: '엄지', icon: '👍' },
            { id: 'Index', label: '검지', icon: '☝️' },
            { id: 'Middle', label: '중지', icon: '🖕' },
            { id: 'Ring', label: '약지', icon: '💍' },
            { id: 'Pinky', label: '새끼', icon: '🤙' }
        ];

        return fingers.map(f => `
            <div class="finger">
                <div class="finger-icon" id="${prefix}${f.id}">${f.icon}</div>
                <div class="finger-name">${f.label}</div>
            </div>
        `).join('');
    }

    cacheElements() {
        this.hand1 = {
            thumb: document.getElementById('fingerThumb'),
            index: document.getElementById('fingerIndex'),
            middle: document.getElementById('fingerMiddle'),
            ring: document.getElementById('fingerRing'),
            pinky: document.getElementById('fingerPinky'),
            count: document.getElementById('hand1Count')
        };
        this.hand2 = {
            thumb: document.getElementById('finger2Thumb'),
            index: document.getElementById('finger2Index'),
            middle: document.getElementById('finger2Middle'),
            ring: document.getElementById('finger2Ring'),
            pinky: document.getElementById('finger2Pinky'),
            count: document.getElementById('hand2Count')
        };
        this.total = document.getElementById('totalFingers');
    }

    update(hand1Data, hand2Data) {
        // Hand 1 Update
        if (hand1Data) {
            this.updateHand(this.hand1, hand1Data);
        } else {
            this.clearHand(this.hand1);
        }

        // Hand 2 Update
        if (hand2Data) {
            this.updateHand(this.hand2, hand2Data);
        } else {
            this.clearHand(this.hand2);
        }

        // Total
        const c1 = hand1Data ? hand1Data.extendedCount : 0;
        const c2 = hand2Data ? hand2Data.extendedCount : 0;
        this.total.textContent = c1 + c2;
    }

    updateHand(els, data) {
        els.thumb.classList.toggle('extended', data.fingers.thumb.extended);
        els.index.classList.toggle('extended', data.fingers.index.extended);
        els.middle.classList.toggle('extended', data.fingers.middle.extended);
        els.ring.classList.toggle('extended', data.fingers.ring.extended);
        els.pinky.classList.toggle('extended', data.fingers.pinky.extended);
        els.count.textContent = data.extendedCount;
    }

    clearHand(els) {
        Object.values(els).forEach(el => {
            if (el && el.classList) el.classList.remove('extended');
        });
        if (els.count) els.count.textContent = '0';
    }
}
