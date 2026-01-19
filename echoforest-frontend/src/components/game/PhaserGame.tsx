import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import MainScene from './scenes/MainScene';

export default function PhaserGame() {
    const gameRef = useRef<Phaser.Game | null>(null);
    const parentRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (gameRef.current || !parentRef.current) return;

        // 부모 컨테이너의 실제 크기 사용
        const parent = parentRef.current;
        const parentWidth = parent.clientWidth;
        const parentHeight = parent.clientHeight;

        const config: Phaser.Types.Core.GameConfig = {
            type: Phaser.AUTO,
            parent: parent,
            width: parentWidth,
            height: parentHeight,
            backgroundColor: '#2c3e50',
            physics: {
                default: 'matter',
                matter: {
                    gravity: { x: 0, y: 1 },
                    debug: true
                }
            },
            scene: [MainScene],
            scale: {
                mode: Phaser.Scale.RESIZE,
                autoCenter: Phaser.Scale.CENTER_BOTH
            }
        };

        gameRef.current = new Phaser.Game(config);

        // 창 크기 변경 시 부모 컨테이너 크기에 맞춰 리사이즈
        const handleResize = () => {
            if (gameRef.current && parentRef.current) {
                const newWidth = parentRef.current.clientWidth;
                const newHeight = parentRef.current.clientHeight;
                gameRef.current.scale.resize(newWidth, newHeight);
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
