import { useEffect, useRef } from 'react';
import { useAudioStore } from '../../store/useAudioStore';

export default function BackgroundMusic() {
    const { isPlaying, isMuted, volume, currentTrack } = useAudioStore();
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // 오디오 객체 초기화
    useEffect(() => {
        const audio = new Audio();
        audio.loop = true;
        audioRef.current = audio;

        return () => {
            audio.pause();
            audioRef.current = null;
        };
    }, []);

    // 트랙 변경 감지
    useEffect(() => {
        if (!audioRef.current || !currentTrack) return;

        // 같은 트랙이면 리턴? (필요시 구현)
        // 여기서는 단순하게 경로 변경 시 로드
        if (audioRef.current.src !== window.location.origin + currentTrack) {
            audioRef.current.src = currentTrack;
            // 트랙이 바뀌면 자동 재생 시도 (상태가 Playing이라면)
            if (isPlaying) {
                const playPromise = audioRef.current.play();
                if (playPromise !== undefined) {
                    playPromise.catch((error) => {
                        // console.warn("BGM Auto-play blocked:", error);
                    });
                }
            }
        }
    }, [currentTrack]);

    // 상태 동기화 (재생/일시정지/볼륨/음소거)
    useEffect(() => {
        if (!audioRef.current) return;

        audioRef.current.volume = volume;
        audioRef.current.muted = isMuted;

        if (isPlaying && audioRef.current.paused && audioRef.current.readyState >= 2) {
            // 준비된 상태에서만 재생 시도
            const playPromise = audioRef.current.play();
            if (playPromise !== undefined) {
                playPromise.catch((error) => {
                    // console.warn("BGM Play prevented:", error);
                    // 브라우저 정책으로 막힌 경우, 사용자 상호작용 후 재생되도록 유도 가능
                });
            }
        } else if (!isPlaying && !audioRef.current.paused) {
            audioRef.current.pause();
        }
    }, [isPlaying, isMuted, volume]);

    // 사용자 첫 상호작용 감지 (Auto-play 정책 대응)
    useEffect(() => {
        const handleUserInteraction = () => {
            if (audioRef.current && isPlaying && audioRef.current.paused) {
                audioRef.current.play().catch(e => console.warn("Still blocked:", e));
            }
        };

        window.addEventListener('click', handleUserInteraction);
        window.addEventListener('keydown', handleUserInteraction);

        return () => {
            window.removeEventListener('click', handleUserInteraction);
            window.removeEventListener('keydown', handleUserInteraction);
        };
    }, [isPlaying]);

    return null; // UI 없음 (전역 오디오 컨트롤러)
}
