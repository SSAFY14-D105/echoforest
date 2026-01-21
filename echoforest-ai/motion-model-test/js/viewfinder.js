export default class Viewfinder {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
    }

    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    draw(multiHandLandmarks) {
        this.clear();
        if (!multiHandLandmarks) return;

        multiHandLandmarks.forEach((landmarks, index) => {
            const color = index === 0 ? '#00FF00' : '#FF00FF'; // Green for 1st hand, Purple for 2nd
            this.drawHand(landmarks, color);
        });
    }

    drawHand(landmarks, color) {
        const ctx = this.ctx;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.fillStyle = color;

        // Draw connections
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

        // Draw points
        landmarks.forEach(p => {
            ctx.beginPath();
            ctx.arc(p.x * this.canvas.width, p.y * this.canvas.height, 3, 0, 2 * Math.PI);
            ctx.fill();
        });
    }
}
