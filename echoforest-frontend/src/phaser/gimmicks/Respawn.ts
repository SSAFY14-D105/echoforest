import Phaser from 'phaser';

/**
 * Respawn - 플레이어 스폰 및 리스폰 지점을 정의하는 기믹 객체
 * (변경) 시각적 확인을 위해 Sprite를 상속받아 게임 내에 표시됩니다.
 */
export class Respawn extends Phaser.GameObjects.Sprite {
    public readonly playerIndex?: number;
    public readonly isDefault: boolean;
    public readonly id: string;

    constructor(scene: Phaser.Scene, x: number, y: number, id: string, playerIndex?: number, isDefault: boolean = false, texture: string = 'tiles_tileset', frame: number | string = 0) {
        super(scene, x, y, texture, frame);
        this.id = id;
        this.playerIndex = playerIndex;
        this.isDefault = isDefault;

        // 씬에 추가하여 렌더링
        this.scene.add.existing(this);
        // Tiled 좌표계는 좌상단 기준, Phaser Sprite는 중심 기준이 기본이지만
        // 여기서는 Tiled Object 배치와 일치시키기 위해 MapManager에서 계산된 centerX, centerY를 사용하므로
        // Origin을 0.5로 유지하거나 상황에 맞게 조정. 보통 기믹은 0.5
        this.setOrigin(0.5);
    }

    /**
     * 해당 스폰 지점이 특정 플레이어 인덱스에 적합한지 확인합니다.
     */
    public isMatch(playerIndex: number): boolean {
        // 인덱스가 일치하거나, 인덱스 지정이 없으면서 기본값인 경우
        return this.playerIndex === playerIndex || (this.playerIndex === undefined && this.isDefault);
    }
}
