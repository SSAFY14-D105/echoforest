import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import MainScene from './scenes/MainScene';

export default function PhaserGame() {
    const gameRef = useRef<Phaser.Game | null>(null);
    const parentRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (gameRef.current || !parentRef.current) return;

        const config: Phaser.Types.Core.GameConfig = {
            type: Phaser.AUTO,
            parent: parentRef.current,
            width: window.innerWidth,
            height: window.innerHeight - 160, // 카메라 영역 제외
            backgroundColor: '#2c3e50',
            physics: {
                default: 'matter',
                matter: {
                    gravity: { x: 0, y: 1 },
                    debug: true // 개발 중에는 true
                }
            },
            scene: [MainScene],
            scale: {
                mode: Phaser.Scale.RESIZE, // 반응형
                autoCenter: Phaser.Scale.CENTER_BOTH
            }
        };

        gameRef.current = new Phaser.Game(config);

        // 창 크기 변경 시 Phaser 리사이즈
        const handleResize = () => {
            if (gameRef.current) {
                gameRef.current.scale.resize(window.innerWidth, window.innerHeight - 160);
            }
        };

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            gameRef.current?.destroy(true);
            gameRef.current = null;
        };
    }, []);

    return <div ref={parentRef} style={{ width: '100%', height: '100%' }}></div>;
}
