export default class CapturePanel {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.captures = [];
        this.currentData = null; // 현재 프레임의 데이터 임시 저장

        this.init();
        this.bindEvents();
    }

    init() {
        if (!this.container) return;

        // HTML 구조 생성 (기존 HTML을 가져와서 JS로 렌더링)
        this.container.innerHTML = `
            <div class="panel">
                <h3>📸 스냅샷 캡처</h3>
                <div style="display:flex;gap:8px;margin-bottom:10px">
                    <input type="text" id="cp_captureLabel" placeholder="라벨 (예: V사인, 하트)" 
                        style="flex:1;padding:8px;border:1px solid #444;border-radius:4px;background:#222;color:#fff">
                    <button class="btn" id="cp_btnCapture">📸 캡처 (Space)</button>
                </div>
                <div style="font-size:10px;color:#888;margin-bottom:8px">💡 팁: 스페이스바를 눌러 캡처하세요 (팔꿈치로 누르기 쉬움)</div>
                <div style="display:flex;gap:8px;margin-bottom:10px">
                    <button class="btn" id="cp_btnDownloadCSV" style="flex:1;background:#4ade80">📥 CSV 다운로드</button>
                    <button class="btn" id="cp_btnClearCaptures" style="flex:1;background:#ff6b6b">🗑️ 초기화</button>
                </div>
                <div style="font-size:11px;color:#888;margin-bottom:6px">캡처 히스토리 (<span id="cp_captureCount">0</span>개)</div>
                <div id="cp_captureHistory" 
                    style="max-height:150px;overflow-y:auto;font-size:10px;background:#111;padding:8px;border-radius:4px">
                    <div style="color:#666">캡처된 데이터 없음</div>
                </div>
            </div>
        `;

        // 요소 참조 저장
        this.labelInput = this.container.querySelector('#cp_captureLabel');
        this.historyContainer = this.container.querySelector('#cp_captureHistory');
        this.countSpan = this.container.querySelector('#cp_captureCount');
        this.captureBtn = this.container.querySelector('#cp_btnCapture');
    }

    bindEvents() {
        if (!this.container) return;

        this.container.querySelector('#cp_btnCapture').addEventListener('click', () => this.capture());
        this.container.querySelector('#cp_btnDownloadCSV').addEventListener('click', () => this.downloadCSV());
        this.container.querySelector('#cp_btnClearCaptures').addEventListener('click', () => this.clear());

        // 스페이스바 단축키 (전역 리스너)
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && e.target.tagName !== 'INPUT') {
                e.preventDefault();
                this.capture();

                // 버튼 눌림 효과 (시각적 피드백)
                if (this.captureBtn) {
                    this.captureBtn.style.transform = 'scale(0.95)';
                    setTimeout(() => this.captureBtn.style.transform = 'scale(1)', 100);
                }
            }
        });
    }

    // 매 프레임마다 최신 데이터를 업데이트 받음
    update(data) {
        this.currentData = data;
    }

    capture() {
        if (!this.currentData) {
            alert('손을 감지한 후 캡처해주세요!');
            return;
        }

        const label = this.labelInput.value || '미지정';
        const timestamp = new Date().toLocaleTimeString();

        // 데이터 깊은 복사
        const snapshot = {
            label,
            timestamp,
            thumbDistances: { ...this.currentData.thumbDistances },
            matrix: { ...this.currentData.matrix },
            fingers: { ...this.currentData.fingers }
        };

        this.captures.push(snapshot);
        this.updateHistory();

        if (window.log) window.log(`📸 캡처: ${label}`);
    }

    updateHistory() {
        this.countSpan.textContent = this.captures.length;

        if (this.captures.length === 0) {
            this.historyContainer.innerHTML = '<div style="color:#666">캡처된 데이터 없음</div>';
            return;
        }

        // 최신순 정렬하여 표시
        this.historyContainer.innerHTML = this.captures.map((c, i) => `
            <div style="padding:4px;border-bottom:1px solid #333;display:flex;justify-content:space-between">
                <span style="color:#667eea">[${i + 1}] ${c.label}</span>
                <span style="color:#888">${c.timestamp}</span>
            </div>
        `).reverse().join('');
    }

    clear() {
        this.captures = [];
        this.updateHistory();
        if (window.log) window.log('🗑️ 캡처 초기화');
    }

    downloadCSV() {
        if (this.captures.length === 0) {
            alert('캡처된 데이터가 없습니다!');
            return;
        }

        // CSV 헤더 정의
        const tips = [4, 8, 12, 16, 20];
        const thumbTargets = [5, 8, 12, 15, 16, 19, 20];
        let headers = ['label', 'timestamp'];

        // 엄지 거리 컬럼
        thumbTargets.forEach(t => headers.push(`d4to${t}`));

        // 5x5 매트릭스 컬럼
        tips.forEach(a => {
            tips.forEach(b => {
                if (a !== b) headers.push(`m${a}_${b}`);
            });
        });

        // 손가락 상태 컬럼
        headers.push('thumb_ext', 'index_ext', 'middle_ext', 'ring_ext', 'pinky_ext');

        // CSV 행 생성
        const rows = this.captures.map(c => {
            let row = [c.label, c.timestamp];

            thumbTargets.forEach(t => row.push(c.thumbDistances[t]?.toFixed(4) || ''));

            tips.forEach(a => {
                tips.forEach(b => {
                    if (a !== b) row.push(c.matrix[`${a}_${b}`]?.toFixed(4) || '');
                });
            });

            row.push(
                c.fingers?.thumb?.extended ? 1 : 0,
                c.fingers?.index?.extended ? 1 : 0,
                c.fingers?.middle?.extended ? 1 : 0,
                c.fingers?.ring?.extended ? 1 : 0,
                c.fingers?.pinky?.extended ? 1 : 0
            );

            return row;
        });

        // CSV 생성 (UTF-8 BOM 추가)
        const BOM = '\uFEFF';
        let csv = BOM + headers.join(',') + '\n';
        rows.forEach(r => csv += r.join(',') + '\n');

        // 다운로드 실행
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `gesture_captures_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        if (window.log) window.log(`📥 CSV 다운로드: ${this.captures.length}개`);
    }
}
