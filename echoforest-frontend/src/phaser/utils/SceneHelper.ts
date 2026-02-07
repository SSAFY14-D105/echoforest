import Phaser from 'phaser';

/**
 * 씬 설정 헬퍼 유틸리티
 */

/**
 * 배경 이미지를 맵 전체 너비에 걸쳐 타일링합니다.
 * 본 사진 > 좌우 반전 > 본 사진 > 좌우 반전 패턴으로 Seamless 연결
 * @param scene - Phaser Scene
 * @param textureKey - 배경 이미지 키
 * @param worldWidth - 월드 너비
 * @param worldHeight - 월드 높이
 * @param scrollFactor - 시차 효과 (0: 고정, 1: 맵과 동일 속도)
 */
export function setupTiledBackground(
    scene: Phaser.Scene,
    textureKey: string,
    worldWidth: number,
    worldHeight: number,
    scrollFactor: number = 0.5
): void {
    const texture = scene.textures.get(textureKey);
    if (!texture || texture.key === '__MISSING') {
        // console.warn(`[SceneHelper] Background texture '${textureKey}' not found.`);
        return;
    }

    // 0 또는 NaN 체크 (첫 프레임 씬 로딩 시 예외 방지)
    if (!worldWidth || !worldHeight || isNaN(worldWidth) || isNaN(worldHeight)) {
        // console.warn(`[SceneHelper] Invalid world dimensions: ${worldWidth}x${worldHeight}`);
        return;
    }

    const bgSource = texture.getSourceImage() as HTMLImageElement;

    // 배경 이미지의 원본 비율 유지하며 맵 높이에 맞춤
    const scale = worldHeight / bgSource.height;
    const scaledWidth = bgSource.width * scale;

    // [DEBUG] Texture Info
    // console.log(`[SceneHelper] Texture '${textureKey}': Source(${bgSource.width}x${bgSource.height})`);

    // [DEBUG] Background Debug Layer (Magenta)
    // If you see Magenta, it means the background images are missing or transparent.
    const debugBg = scene.add.rectangle(worldWidth / 2, worldHeight / 2, worldWidth * 10, worldHeight * 10, 0xff00ff);
    debugBg.setDepth(-101); // Behind images (-100), in front of camera bg
    debugBg.setScrollFactor(scrollFactor);

    // 필요한 타일 개수 계산 (여유있게 +1)
    const numTiles = Math.ceil(worldWidth / scaledWidth) + 1;

    // [중요] 세로 방향 시차 효과 보정 (Bottom-up 방식)
    // 카메라가 하단(scrollY = worldHeight - screenHeight)에 있을 때 배경이 정확히 보이도록 보정
    const screenHeight = scene.scale.height;
    const startCameraY = Math.max(0, worldHeight - screenHeight);
    const bgY = (screenHeight / 2) + (startCameraY * scrollFactor);

    // [FIX] 타일 간 틈새(Gap) 방지를 위해 2px 정도 겹치게 배치
    const overlap = 2;
    const effectiveWidth = scaledWidth - overlap;

    // [DEBUG] Tiling Info
    // console.log(`[SceneHelper] Setup BG: World(${worldWidth}x${worldHeight}), ScreenH(${screenHeight}), Scale(${scale.toFixed(4)}), ScaledW(${scaledWidth.toFixed(1)}), NumTiles(${numTiles})`);

    // [FIX] 앞뒤로 여유 타일을 두어 끊김 현상 방지 (-10 ~ numTiles + 10)
    // -10부터 시작하여 왼쪽 공백(초반부) 완벽 커버
    // numTiles + 10까지 생성하여 오른쪽 끝부분 완벽 커버 (와이드 모니터 등 대비)
    for (let i = -10; i < numTiles + 10; i++) {
        // 중심 좌표 계산: (인덱스 * 유효너비) + (실제너비 / 2)
        // 겹치는 만큼 왼쪽으로 당겨짐
        const x = i * effectiveWidth + (scaledWidth / 2);
        const bg = scene.add.image(x, bgY, textureKey);

        bg.setScale(scale);
        bg.setDepth(-100); // 모든 오브젝트 뒤에 배치
        bg.setScrollFactor(scrollFactor);

        // 홀수 번째 타일은 좌우 반전 (index 1, 3, 5... and -1, -3...)
        // Math.abs()를 사용하여 음수 인덱스도 정상 처리
        if (Math.abs(i) % 2 === 1) {
            bg.setFlipX(true);
        }
    }

    // console.log(`[SceneHelper] Tiled background setup: ${numTiles} tiles, scale ${scale.toFixed(2)}`);
}
