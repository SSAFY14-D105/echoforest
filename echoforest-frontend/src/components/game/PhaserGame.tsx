import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import LobbyScene from './scenes/LobbyScene';
import SoloScene from './scenes/SoloScene';
import Stage1Scene from './scenes/Stage1Scene';
import Stage2Scene from './scenes/Stage2Scene';
import Stage3Scene from './scenes/Stage3Scene';

interface PhaserGameProps {
    startScene?: string;  // 시작할 씬 지정 (기본: LobbyScene)
}

export default function PhaserGame({ startScene = 'LobbyScene' }: PhaserGameProps) {
    const gameRef = useRef<Phaser.Game | null>(null);
    const parentRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // 부모 컴포넌트나 엘리먼트가 없으면 중단
        if (!parentRef.current) return;

        // 1. 게임 인스턴스가 없으면 생성
        if (!gameRef.current) {
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
                scene: [], // 씬은 수동으로 추가
                scale: {
                    mode: Phaser.Scale.RESIZE,
                    autoCenter: Phaser.Scale.CENTER_BOTH
                }
            };

            gameRef.current = new Phaser.Game(config);

            // 모든 씬 등록
            gameRef.current.scene.add('LobbyScene', LobbyScene, false);
            gameRef.current.scene.add('SoloScene', SoloScene, false);
            gameRef.current.scene.add('Stage1Scene', Stage1Scene, false);
            gameRef.current.scene.add('Stage2Scene', Stage2Scene, false);
            gameRef.current.scene.add('Stage3Scene', Stage3Scene, false);

            const handleResize = () => {
                if (gameRef.current && parentRef.current) {
                    const newWidth = parentRef.current.clientWidth;
                    const newHeight = parentRef.current.clientHeight;
                    gameRef.current.scale.resize(newWidth, newHeight);
                }
            };

            window.addEventListener('resize', handleResize);
        }

        // 2. 현재 실행 중인 씬과 요청된 startScene이 다르면 전환
        const currentGame = gameRef.current;
        if (currentGame) {
            // 현재 실행 중인 모든 씬 중지
            currentGame.scene.getScenes(true).forEach(scene => {
                if (scene.scene.key !== startScene) {
                    scene.scene.stop();
                }
            });

            // 원하는 씬이 실행 중이 아니면 시작
            if (!currentGame.scene.isActive(startScene)) {
                currentGame.scene.start(startScene);
            }
        }

        return () => {
            // 전체 게임 중지 (컴포넌트 언마운트 시에만)
            // 주의: dependencies에 startScene이 있으므로 여기서 destroy하면 안 됨
            // 하지만 React 18+ strict mode 등에서는 문제가 될 수 있으므로 세심한 관리가 필요
        };
    }, [startScene]);

    // 언마운트 시에만 게임 완전 제거를 위한 별도 useEffect
    useEffect(() => {
        return () => {
            if (gameRef.current) {
                gameRef.current.destroy(true);
                gameRef.current = null;
            }
        };
    }, []);

    return <div ref={parentRef} style={{ width: '100%', height: '100%' }}></div>;
}
