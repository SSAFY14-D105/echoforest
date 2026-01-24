import Phaser from 'phaser';

/**
 * UI 피드백 헬퍼 유틸리티
 */

/**
 * 화면에 떠오르는 텍스트 피드백을 표시합니다.
 * @param scene - Phaser Scene
 * @param x - X 좌표
 * @param y - Y 좌표
 * @param message - 표시할 메시지
 * @param color - 텍스트 색상 (0xRRGGBB 형식)
 */
export function showFloatingText(
    scene: Phaser.Scene,
    x: number,
    y: number,
    message: string,
    color: number = 0xffffff
): void {
    const text = scene.add.text(x, y, message, {
        fontSize: '18px',
        color: `#${color.toString(16).padStart(6, '0')}`,
        stroke: '#000000',
        strokeThickness: 3,
        fontStyle: 'bold'
    }).setOrigin(0.5);

    scene.tweens.add({
        targets: text,
        y: y - 50,
        alpha: 0,
        duration: 1500,
        ease: 'Cubic.easeOut',
        onComplete: () => text.destroy()
    });
}
