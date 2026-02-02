import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import LobbyScene from './scenes/LobbyScene';
import Solo1Scene from './scenes/Solo1Scene';
import Stage1Scene from './scenes/Stage1Scene';
import Stage2Scene from './scenes/Stage2Scene';
import Stage3Scene from './scenes/Stage3Scene';
import Solo2Scene from './scenes/Solo2Scene';
import Solo3Scene from './scenes/Solo3Scene';
import Solo4Scene from './scenes/Solo4Scene';
import Solo5Scene from './scenes/Solo5Scene';

interface PhaserGameProps {
    startScene?: string;  // 시작할 씬 지정 (기본: LobbyScene)
    onSendState?: (x: number, y: number, vx: number, vy: number, anim: string, isDead: boolean, curses: string[], isHidden?: boolean) => void;
    isSoloMode?: boolean;
    roomId?: string; // [FIX] Added roomId
}

export default function PhaserGame({ startScene = 'LobbyScene', onSendState, isSoloMode = false, roomId }: PhaserGameProps) {
    const gameRef = useRef<Phaser.Game | null>(null);
    const parentRef = useRef<HTMLDivElement>(null);

    // Props 변경 시 씬에 전달
    useEffect(() => {
        const game = gameRef.current;
        if (game) {
            // 현재 실행 중인 씬 찾기
            const scene = game.scene.getScene(startScene);
            if (scene && 'setSendStateCallback' in scene) {
                // BaseGameScene으로 캐스팅 대신 메서드 존재 여부 확인 후 호출 (덕 타이핑)
                (scene as any).setSendStateCallback(onSendState || null);
            }
            if (scene && 'setIsSoloMode' in scene) {
                (scene as any).setIsSoloMode(isSoloMode);
            }
            if (scene && 'setRoomId' in scene) {
                (scene as any).setRoomId(roomId || null);
            }
        }
    }, [startScene, onSendState, isSoloMode, roomId]);

    useEffect(() => {
        // 부모 컴포넌트나 엘리먼트가 없으면 중단
        if (!parentRef.current) return;

        // 1. 게임 인스턴스가 없으면 생성
        if (!gameRef.current) {
            const parent = parentRef.current;

            // [FIX] User Request: Eliminate letterboxing and fill the container
            // Use RESIZE mode to adapt to parent size dynamically without stretching
            const config: Phaser.Types.Core.GameConfig = {
                type: Phaser.AUTO,
                parent: parent,
                width: '100%',
                height: '100%',
                scale: {
                    mode: Phaser.Scale.RESIZE,
                    autoCenter: Phaser.Scale.NO_CENTER
                },
                backgroundColor: '#2c3e50',
                render: {
                    pixelArt: true,
                    antialias: false
                },
                // @ts-ignore - Phaser 3 config property
                disableVisibilityChange: true, // 탭 전환/최소화 시에도 게임 루프 계속 실행
                physics: {
                    default: 'matter',
                    matter: {
                        autoUpdate: false, // [CRITICAL] 수동 업데이트로 전환하여 탭 복귀 시 물리 폭주(Physics Explosion) 방지
                        gravity: { x: 0, y: 1 },
                        debug: true
                    }
                },
                scene: [], // 씬은 수동으로 추가
            };

            gameRef.current = new Phaser.Game(config);

            // 모든 씬 등록
            gameRef.current.scene.add('LobbyScene', LobbyScene, false);
            gameRef.current.scene.add('Solo1Scene', Solo1Scene, false);
            gameRef.current.scene.add('Stage1Scene', Stage1Scene, false);
            gameRef.current.scene.add('Stage2Scene', Stage2Scene, false);
            gameRef.current.scene.add('Stage3Scene', Stage3Scene, false);
            gameRef.current.scene.add('Solo2Scene', Solo2Scene, false);
            gameRef.current.scene.add('Solo3Scene', Solo3Scene, false);
            gameRef.current.scene.add('Solo4Scene', Solo4Scene, false);
            gameRef.current.scene.add('Solo5Scene', Solo5Scene, false);
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
                // 씬 시작 직후에도 props 전달 시도 (비동기 초기화 대응)
                setTimeout(() => {
                    const scene = currentGame.scene.getScene(startScene);
                    if (scene) {
                        if ('setSendStateCallback' in scene) (scene as any).setSendStateCallback(onSendState || null);
                        if ('setIsSoloMode' in scene) (scene as any).setIsSoloMode(isSoloMode);
                        if ('setRoomId' in scene) (scene as any).setRoomId(roomId || null);
                    }
                }, 100);
            }
        }

        return () => {
            // Cleanup
        };
    }, []); // 시작 시 한 번만 실행 (게임 인스턴스 생성)

    // startScene 변경 감지 및 씬 전환
    useEffect(() => {
        const game = gameRef.current;
        if (game) {
            // 현재 실행 중인 모든 씬 중지 (Lobby 등 중복 실행 방지)
            game.scene.getScenes(true).forEach(scene => {
                if (scene.scene.key !== startScene) {
                    scene.scene.stop();
                }
            });

            // 원하는 씬이 실행 중이 아니면 시작
            if (!game.scene.isActive(startScene)) {
                game.scene.start(startScene);

                // 씬 시작 직후 props 전달 (비동기 초기화 대응)
                setTimeout(() => {
                    const scene = game.scene.getScene(startScene);
                    if (scene) {
                        if ('setSendStateCallback' in scene) (scene as any).setSendStateCallback(onSendState || null);
                        if ('setIsSoloMode' in scene) (scene as any).setIsSoloMode(isSoloMode);
                        if ('setRoomId' in scene) (scene as any).setRoomId(roomId || null);
                    }
                }, 100);
            }
        }
    }, [startScene, onSendState, isSoloMode]);

    // 언마운트 시 게임 완전 제거
    useEffect(() => {
        return () => {
            // console.log('[PhaserGame] Component Unmounted - Destroying Game Instance');
            if (gameRef.current) {
                gameRef.current.destroy(true);
                gameRef.current = null;
            }
        };
    }, []);

    return <div ref={parentRef} style={{ width: '100%', height: '100%', overflow: 'hidden' }}></div>;
}
