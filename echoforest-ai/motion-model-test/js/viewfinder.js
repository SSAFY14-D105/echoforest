export default class Viewfinder {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
    }

    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    draw(multiHandLandmarks, faceLandmarks) {
        this.clear();

        // 얼굴 그리기
        if (faceLandmarks && faceLandmarks.length > 0) {
            this.drawFace(faceLandmarks[0]);
        }

        // 손 그리기
        if (multiHandLandmarks) {
            multiHandLandmarks.forEach((landmarks, index) => {
                const color = index === 0 ? '#00FF00' : '#FF00FF';
                this.drawHand(landmarks, color);
            });
        }
    }

    drawFace(face) {
        // [복구] gesture-tuner와 동일하게 '오른볼 콕'은 화면상 오른쪽(데이터상 왼쪽 187...)을 의미함
        // 187, 147... -> 노란색 (타겟)
        const targetCheekIndices = [187, 147, 116, 123, 50];

        this.ctx.fillStyle = "yellow"; // 여기가 타겟!
        targetCheekIndices.forEach(idx => {
            const p = face[idx];
            this.ctx.beginPath();
            this.ctx.arc(p.x * this.canvas.width, p.y * this.canvas.height, 5, 0, 2 * Math.PI);
            this.ctx.fill();
        });

        // 반대쪽 (데이터상 오른쪽 411...) -> 빨간색 (아님)
        const otherCheekIndices = [411, 376, 345, 352, 280];
        this.ctx.fillStyle = "rgba(255, 0, 0, 0.3)"; // 흐릿한 빨강
        otherCheekIndices.forEach(idx => {
            const p = face[idx];
            this.ctx.beginPath();
            this.ctx.arc(p.x * this.canvas.width, p.y * this.canvas.height, 3, 0, 2 * Math.PI);
            this.ctx.fill();
        });
    }

    drawHand(landmarks, color) {
        const ctx = this.ctx;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.fillStyle = color;

        const connections = [
            [0, 1, 2, 3, 4], [0, 5, 6, 7, 8], [5, 9, 10, 11, 12],
            [9, 13, 14, 15, 16], [13, 17, 18, 19, 20], [0, 17]
        ];

        connections.forEach(path => {
            ctx.beginPath();
            path.forEach((idx, i) => {
                const p = landmarks[idx];
                const x = p.x * this.canvas.width;
                const y = p.y * this.canvas.height;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });
            ctx.stroke();
        });

        landmarks.forEach(p => {
            ctx.beginPath();
            ctx.arc(p.x * this.canvas.width, p.y * this.canvas.height, 3, 0, 2 * Math.PI);
            ctx.fill();
        });
    }
}
