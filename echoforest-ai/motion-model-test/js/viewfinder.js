/**
 * 뷰파인더 (캔버스 그리기 유틸리티)
 */
export default class Viewfinder {
    constructor(canvasElement) {
        this.canvas = canvasElement;
        this.ctx = this.canvas.getContext('2d');
    }

    draw(landmarks) {
        if (!landmarks) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            return;
        }

        // 연결선 정의 (손)
        const connections = [
            [0, 1], [1, 2], [2, 3], [3, 4], // 엄지
            [0, 5], [5, 6], [6, 7], [7, 8], // 검지
            [0, 9], [9, 10], [10, 11], [11, 12], // 중지
            [0, 13], [13, 14], [14, 15], [15, 16], // 약지
            [0, 17], [17, 18], [18, 19], [19, 20], // 새끼
            [5, 9], [9, 13], [13, 17] // 손바닥
        ];

        // 그리기
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // 선 그리기
        this.ctx.strokeStyle = '#667eea';
        this.ctx.lineWidth = 3;
        connections.forEach(([a, b]) => {
            const p1 = landmarks[a];
            const p2 = landmarks[b];
            this.ctx.beginPath();
            this.ctx.moveTo(p1.x * this.canvas.width, p1.y * this.canvas.height);
            this.ctx.lineTo(p2.x * this.canvas.width, p2.y * this.canvas.height);
            this.ctx.stroke();
        });

        // 점 그리기
        landmarks.forEach((lm, i) => {
            const x = lm.x * this.canvas.width;
            const y = lm.y * this.canvas.height;

            this.ctx.beginPath();
            this.ctx.arc(x, y, i % 4 === 0 ? 6 : 4, 0, 2 * Math.PI);
            // 손끝(4,8,12,16,20)은 핑크색, 나머지는 초록색
            this.ctx.fillStyle = [4, 8, 12, 16, 20].includes(i) ? '#ff6b9d' : '#4ade80';
            this.ctx.fill();
        });
    }
}
