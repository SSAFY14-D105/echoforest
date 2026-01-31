import { distance } from '../utils/gesture-helpers.js';

export default class FingertipMatrixPanel {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.tips = [4, 8, 12, 16, 20];
        this.tipNames = { 4: 'Thumb', 8: 'Index', 12: 'Mid', 16: 'Ring', 20: 'Pinky' };

        this.init();
    }

    init() {
        if (!this.container) return;

        // 스타일 추가
        const style = document.createElement('style');
        style.textContent = `
            .fingertip-matrix-table {
                width: 100%;
                border-collapse: collapse;
                font-size: 12px;
                text-align: center;
                background: #1a202c;
                color: #fff;
            }
            .fingertip-matrix-table th, .fingertip-matrix-table td {
                border: 1px solid #444;
                padding: 4px;
                width: 16%;
            }
            .fingertip-matrix-table th {
                background: #2d3748;
                font-weight: bold;
                color: #a0aec0;
            }
        `;
        this.container.appendChild(style);

        // 테이블 생성
        const table = document.createElement('table');
        table.className = 'fingertip-matrix-table';

        // 헤더 생성
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        headerRow.appendChild(document.createElement('th')); // 빈 코너
        this.tips.forEach(tip => {
            const th = document.createElement('th');
            th.textContent = this.tipNames[tip];
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);

        // 바디 생성 (각 셀에 ID 부여)
        const tbody = document.createElement('tbody');
        this.tips.forEach(rowTip => {
            const tr = document.createElement('tr');

            // 행 헤더
            const th = document.createElement('th');
            th.textContent = this.tipNames[rowTip];
            tr.appendChild(th);

            this.tips.forEach(colTip => {
                const td = document.createElement('td');
                td.id = `panel_m_${rowTip}_${colTip}`; // 고유 ID

                if (rowTip === colTip) {
                    td.textContent = '-';
                    td.style.background = '#333';
                } else {
                    td.textContent = '0.00';
                }
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        this.container.appendChild(table);
    }

    update(landmarks, palmSize, allHands = null) {
        const matrix = {};
        const isTwoHands = allHands && allHands.length >= 2;

        let crossHandPalmSize = palmSize;
        if (isTwoHands) {
            // 두 번째 손 크기 평균
            const palm2 = distance(allHands[1][0], allHands[1][9]);
            crossHandPalmSize = (palmSize + palm2) / 2;
        }

        this.tips.forEach(a => {
            this.tips.forEach(b => {
                const el = document.getElementById(`panel_m_${a}_${b}`);
                if (!el) return;

                if (a === b) return; // 대각선 무시

                // 대칭 위치 끄기 (선택사항, 일단 다 표시)

                // 1. 양손 간 거리 (한쪽은 왼손, 한쪽은 오른손 랜드마크인 경우)
                // 현재 로직: landmarks는 '첫 번째 손' 기준임.
                // 5x5 매트릭스가 '단일 손 내부 거리'를 보여주는지, '양손 간 거리'를 보여주는지 기존 로직 확인 필요.
                // 기존 로직: tips array는 [4,8,12,16,20] index.
                // landmarks[a] 와 landmarks[b] 사이 거리.
                // 특수 케이스: 엄지(4)와 다른손 엄지(4)?
                // 기존 로직을 보면:
                /* 
                   if (isTwoHands && ((a === 4 && b === 4) || (a === 8 && b === 8))) {
                       // 같은 손가락끼리는 '양손 간 거리' 측정 
                   }
                */

                // 여기서는 기존 로직을 최대한 보존합니다.
                let d = 0;
                let isCrossHand = false;

                if (isTwoHands && a === b) {
                    // 같은 번호(예: 엄지-엄지) -> 양손 간 거리 측정
                    const h1 = allHands[0][a];
                    const h2 = allHands[1][b]; // b==a
                    d = distance(h1, h2) / crossHandPalmSize;
                    isCrossHand = true;
                } else if (isTwoHands && ((a === 4 && b === 8) || (a === 8 && b === 4))) {
                    // 엄지-검지 교차 (손1엄지 - 손2검지 or 손1검지 - 손2엄지)
                    // 기존에는 대칭으로 처리했으나 여기선 단순화
                    // "손하트" 등을 위해 필요할 수 있음. 
                    // 기존 로직 복잡성을 고려, 우선 '교차 손' 체크는 a==b인 경우만(엄지-엄지, 검지-검지 등) 처리하거나
                    // 사용자가 원했던 '엄지-검지' 관계만 처리.

                    // 기존 로직: a==4 && b==8 -> 손1(4) - 손2(8) ?? 아님. 
                    // 기존코드는 landmarks[a], landmarks[b] 였으므로 '한 손 안에서의 거리' 였음.
                    // 단, isTwoHands일때 특정 ID 셀을 덮어쓰기 했었음.

                    // **중요**: 기존 로직은 "한 손 내부 거리"를 기본으로 하되,
                    // UI 테이블의 대각선(4-4, 8-8) 자리에 "양손 거리"를 끼워넣었음.
                    d = distance(landmarks[a], landmarks[b]) / palmSize;
                } else {
                    d = distance(landmarks[a], landmarks[b]) / palmSize;
                }

                // 대각선(같은 번호) 처리
                if (a === b) {
                    if (isTwoHands) {
                        // 양손 간 거리 (엄지끼리, 검지끼리...)
                        matrix[`${a}_${b}`] = d;
                        el.textContent = d.toFixed(2);

                        // 색상 로직 (가까우면 초록)
                        if (d < 0.2) {
                            el.style.background = 'hsla(120, 70%, 30%, 0.7)';
                            el.style.color = '#4ade80';
                            el.style.fontWeight = 'bold';
                        } else {
                            el.style.background = 'hsla(0, 0%, 20%, 0.5)';
                            el.style.color = '#888';
                            el.style.fontWeight = 'normal';
                        }
                    } else {
                        // 단일 손: 손가락 길이 (Wrist -> Tip)
                        const length = distance(landmarks[0], landmarks[a]) / palmSize;
                        matrix[`${a}_${b}`] = length;
                        el.textContent = length.toFixed(2);
                        el.style.background = '#2b6cb0'; // 다른 색상 (파랑 계열)
                        el.style.color = '#fff';
                        el.style.fontWeight = 'normal';
                    }
                    return;
                }

                // 일반 거리 (한 손 내부)
                matrix[`${a}_${b}`] = d;
                el.textContent = d.toFixed(2);

                // 색상 (가까우면 초록)
                const hue = Math.max(0, Math.min(120, (1 - d) * 120));
                el.style.background = `hsla(${hue}, 70%, 30%, 0.5)`;
                el.style.color = '#fff';
                el.style.fontWeight = 'normal';
            });
        });

        return matrix;
    }
}
