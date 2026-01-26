import Phaser from 'phaser';

/**
 * 플레이어 애니메이션 생성 유틸리티
 * BaseGameScene에서 분리된 애니메이션 생성 로직
 */
export function createPlayerAnimations(scene: Phaser.Scene): void {
    const colors = ['green', 'blue', 'orange', 'purple'];

    colors.forEach((color) => {
        // Idle (standing 이미지 사용)
        const idleKey = `player_idle_${color}`;
        if (!scene.anims.exists(idleKey)) {
            scene.anims.create({
                key: idleKey,
                frames: [{ key: `player_${color}_standing` }],
                frameRate: 1
            });
        }

        // Walk 애니메이션 (다이나믹 슬라이싱)
        const walkKey = `player_walk_${color}`;
        if (!scene.anims.exists(walkKey)) {
            let walkFrames: Phaser.Types.Animations.AnimationFrame[] = [];
            const walkingTex = scene.textures.get(`player_${color}_walking_raw`);

            // 이미지가 정상적으로 로드되었는지 확인
            if (walkingTex && walkingTex.key !== '__MISSING' && walkingTex.getSourceImage()) {
                const width = walkingTex.getSourceImage().width;
                const height = walkingTex.getSourceImage().height;

                // 2프레임으로 쪼개기 (홀수 너비일 경우 1px 간격이 있다고 가정)
                const frameWidth = Math.floor(width / 2);
                const spacer = width % 2;

                // 프레임이 이미 정의되어 있지 않은 경우에만 추가
                if (!walkingTex.has('frame0')) {
                    walkingTex.add('frame0', 0, 0, 0, frameWidth, height);
                }
                if (!walkingTex.has('frame1')) {
                    walkingTex.add('frame1', 0, frameWidth + spacer, 0, frameWidth, height);
                }

                walkFrames = [
                    { key: `player_${color}_walking_raw`, frame: 'frame0' },
                    { key: `player_${color}_walking_raw`, frame: 'frame1' }
                ];
            } else {
                // 이미지 로드 실패 시 standing 이미지로 대체
                walkFrames = [{ key: `player_${color}_standing` }];
            }

            scene.anims.create({
                key: walkKey,
                frames: walkFrames,
                frameRate: 6,
                repeat: -1
            });
        }

        // Jump (jump 이미지 사용)
        const jumpKey = `player_jump_${color}`;
        if (!scene.anims.exists(jumpKey)) {
            scene.anims.create({
                key: jumpKey,
                frames: [{ key: `player_${color}_jump` }],
                frameRate: 1
            });
        }

        // Dead (death 이미지 사용)
        const deadKey = `player_dead_${color}`;
        if (!scene.anims.exists(deadKey)) {
            scene.anims.create({
                key: deadKey,
                frames: [{ key: `player_${color}_death` }],
                frameRate: 1
            });
        }
    });
}

/**
 * 플레이어 스프라이트 리소스 로드 유틸리티
 */
export function preloadPlayerAssets(scene: Phaser.Scene): void {
    const colors = ['green', 'blue', 'orange', 'purple'];
    colors.forEach(color => {
        const folder = color; // 폴더명이 색상명과 동일함
        scene.load.image(`player_${color}_standing`, `assets/sprites/${folder}/${color}_standing.png`);
        scene.load.image(`player_${color}_jump`, `assets/sprites/${folder}/${color}_jump.png`);

        // purple의 경우 death 이미지가 여러 개이므로 256을 기본으로 사용
        const deathFile = color === 'purple' ? `${color}_death256.png` : `${color}_death.png`;
        scene.load.image(`player_${color}_death`, `assets/sprites/${folder}/${deathFile}`);

        scene.load.image(`player_${color}_walking_raw`, `assets/sprites/${folder}/${color}_walking.png`);
    });
}
