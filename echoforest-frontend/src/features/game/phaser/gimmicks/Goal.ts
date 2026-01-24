import Phaser from 'phaser';

/**
 * Goal 기믹 - 모든 플레이어가 입장해야 스테이지 클리어
 * 피코파크 스타일: ↑ 키로 입장/퇴장
 */
export class Goal {
    private scene: Phaser.Scene;
    private body: MatterJS.BodyType;
    private sprite?: Phaser.GameObjects.Sprite;
    private graphics?: Phaser.GameObjects.Graphics;

    // Goal 영역 근처에 있는 플레이어 (충돌 감지)
    private playersNearGoal: Set<string> = new Set();
    // Goal에 입장한 플레이어 (사라진 상태)
    private playersEnteredGoal: Set<string> = new Set();

    public readonly id: string;
    public readonly requiredPlayers: number;
    private readonly x: number;
    private readonly y: number;

    constructor(scene: Phaser.Scene, x: number, y: number, id: string, requiredPlayers: number = 1, width: number = 48, height: number = 64, texture?: string, frame?: string | number, angle: number = 0) {
        this.scene = scene;
        this.id = id;
        this.requiredPlayers = requiredPlayers;
        this.x = x;
        this.y = y;

        // 골인 영역 물리 바디 (센서)
        this.body = this.scene.matter.add.rectangle(x, y, width, height, {
            isSensor: true,
            isStatic: true,
            label: `goal-${id}`,
            angle: Phaser.Math.DegToRad(angle)
        });

        if (texture) {
            this.sprite = this.scene.add.sprite(x, y, texture, frame);
            this.sprite.setDisplaySize(width, height);
            this.sprite.setAngle(angle);
            this.sprite.setDepth(5); // 플레이어(10)보다 낮은 depth 설정
        } else {
            // 골인 그래픽
            this.graphics = this.scene.add.graphics();
            this.drawGoal();
            this.graphics.setPosition(x, y);
            this.graphics.setAngle(angle);
            this.graphics.setDepth(5); // 플레이어(10)보다 낮은 depth 설정
        }
    }

    private drawGoal(): void {
        if (!this.graphics) return;
        this.graphics.clear();
        // 파란색 골인 영역 (반투명)
        this.graphics.fillStyle(0x3498DB, 0.5);
        this.graphics.fillRect(-24, -32, 48, 64);
        // 테두리
        this.graphics.lineStyle(3, 0x2980B9, 1);
        this.graphics.strokeRect(-24, -32, 48, 64);
        // 깃발 아이콘
        this.graphics.fillStyle(0xFFFFFF, 1);
        this.graphics.fillTriangle(-5, -20, -5, 0, 10, -10);

        // 입장한 플레이어 수 표시
        this.updateEnteredCount();
    }

    private updateEnteredCount(): void {
        // TODO: 입장 인원 표시 텍스트 (나중에 구현)
    }

    // 플레이어가 Goal 영역 근처에 들어옴 (충돌 시작)
    public playerNear(playerId: string): void {
        this.playersNearGoal.add(playerId);
        console.log(`[Goal] Player near: ${playerId}`);
    }

    // 플레이어가 Goal 영역에서 벗어남 (충돌 종료)
    public playerAway(playerId: string): void {
        this.playersNearGoal.delete(playerId);
        console.log(`[Goal] Player away: ${playerId}`);
    }

    // 플레이어가 Goal 근처에 있는지 확인
    public isPlayerNear(playerId: string): boolean {
        return this.playersNearGoal.has(playerId);
    }

    // 플레이어가 Goal에 입장 (↑ 키 누름)
    public enterGoal(playerId: string): boolean {
        if (!this.playersNearGoal.has(playerId)) {
            return false; // 근처에 없으면 입장 불가
        }
        if (this.playersEnteredGoal.has(playerId)) {
            return false; // 이미 입장한 상태
        }

        this.playersEnteredGoal.add(playerId);
        console.log(`[Goal] Player entered goal: ${playerId}, entered: ${this.playersEnteredGoal.size}/${this.requiredPlayers}`);
        return true;
    }

    // 플레이어가 Goal에서 퇴장 (↑ 키 다시 누름)
    public exitGoal(playerId: string): boolean {
        if (!this.playersEnteredGoal.has(playerId)) {
            return false; // 입장하지 않은 상태
        }

        this.playersEnteredGoal.delete(playerId);
        console.log(`[Goal] Player exited goal: ${playerId}, entered: ${this.playersEnteredGoal.size}/${this.requiredPlayers}`);
        return true;
    }

    // 플레이어가 입장 상태인지 확인
    public isPlayerEntered(playerId: string): boolean {
        return this.playersEnteredGoal.has(playerId);
    }

    // 스테이지 클리어 조건 체크 (모든 플레이어가 입장)
    public isComplete(): boolean {
        return this.playersEnteredGoal.size >= this.requiredPlayers;
    }

    public getEnteredCount(): number {
        return this.playersEnteredGoal.size;
    }

    public getPosition(): { x: number; y: number } {
        return { x: this.x, y: this.y };
    }

    public getBody(): MatterJS.BodyType {
        return this.body;
    }

    public setVisible(visible: boolean): void {
        this.graphics?.setVisible(visible);
        this.sprite?.setVisible(visible);
    }

    public destroy(): void {
        this.scene.matter.world.remove(this.body);
        this.graphics?.destroy();
        this.sprite?.destroy();
    }
}
