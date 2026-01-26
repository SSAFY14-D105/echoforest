/**
 * Respawn - 플레이어 스폰 및 리스폰 지점을 정의하는 기믹 객체
 * 시각적 스프라이트가 없는 데이터 전용 객체입니다.
 */
export class Respawn {
    public readonly x: number;
    public readonly y: number;
    public readonly playerIndex?: number;
    public readonly isDefault: boolean;
    public readonly id: string;

    constructor(x: number, y: number, id: string, playerIndex?: number, isDefault: boolean = false) {
        this.x = x;
        this.y = y;
        this.id = id;
        this.playerIndex = playerIndex;
        this.isDefault = isDefault;
    }

    /**
     * 해당 스폰 지점이 특정 플레이어 인덱스에 적합한지 확인합니다.
     */
    public isMatch(playerIndex: number): boolean {
        // 인덱스가 일치하거나, 인덱스 지정이 없으면서 기본값인 경우
        return this.playerIndex === playerIndex || (this.playerIndex === undefined && this.isDefault);
    }
}
