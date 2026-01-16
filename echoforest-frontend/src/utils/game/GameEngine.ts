// src/game-core/GameEngine.ts
export class GameEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private loopId: number | null = null;
  
  private player = { x: 100, y: 0, w: 32, h: 32, vx: 0, vy: 0, onGround: false, color: '#76c442' };
  private keys: { [code: string]: boolean } = {};

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.resize();
    this.bindEvents();
    this.player.y = this.canvas.height - 100;
  }

  public resize() {
    if (this.canvas.parentElement) {
      this.canvas.width = this.canvas.parentElement.clientWidth;
      this.canvas.height = this.canvas.parentElement.clientHeight;
    }
  }

  private bindEvents() {
    window.addEventListener('keydown', e => this.keys[e.code] = true);
    window.addEventListener('keyup', e => this.keys[e.code] = false);
  }

  private update() {
    // 간단한 물리 로직
    if (this.keys['ArrowLeft']) this.player.vx -= 0.5;
    if (this.keys['ArrowRight']) this.player.vx += 0.5;
    if (this.keys['Space'] && this.player.onGround) {
      this.player.vy = -12;
      this.player.onGround = false;
    }

    this.player.vx *= 0.85;
    this.player.vy += 0.35; // 중력
    this.player.x += this.player.vx;
    this.player.y += this.player.vy;

    // 바닥 충돌
    const floorY = this.canvas.height - 50;
    if (this.player.y + this.player.h > floorY) {
      this.player.y = floorY - this.player.h;
      this.player.vy = 0;
      this.player.onGround = true;
    }
    if (this.player.x < 0) this.player.x = 0;
  }

  private render() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // 바닥
    this.ctx.fillStyle = '#8d6e63';
    this.ctx.fillRect(0, this.canvas.height - 50, this.canvas.width, 50);

    // 플레이어 (개구리)
    this.ctx.fillStyle = this.player.color;
    this.ctx.fillRect(this.player.x, this.player.y, this.player.w, this.player.h);
    
    // 눈
    this.ctx.fillStyle = 'white';
    this.ctx.fillRect(this.player.x + 6, this.player.y + 6, 6, 6);
    this.ctx.fillRect(this.player.x + 20, this.player.y + 6, 6, 6);
  }

  public start() {
    const loop = () => {
      this.update();
      this.render();
      this.loopId = requestAnimationFrame(loop);
    };
    loop();
  }

  public stop() {
    if (this.loopId) cancelAnimationFrame(this.loopId);
  }
}