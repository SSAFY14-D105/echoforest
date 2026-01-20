import { useEffect, useState } from 'react';
import {
  LiveKitRoom,
  VideoConference,
} from '@livekit/components-react';
import '@livekit/components-styles'; // 기본 스타일 적용

// 백엔드 API 주소 (환경변수로 관리 추천)
const API_URL = "http://localhost:9001/api/livekit/token";
const LIVEKIT_URL = "ws://localhost:7880";

type Props = {
  roomId: string;
  username: string;
};

export default function LiveKitOverlay({ roomId, username }: Props) {
  const [token, setToken] = useState("");

  useEffect(() => {
    // 1. 백엔드에게 입장권(토큰) 요청
    const fetchToken = async () => {
      try {
        const userId = "user_" + Math.floor(Math.random() * 10000); // 임시 ID
        const response = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomId, userId, username }),
        });

        const data = await response.json();
        setToken(data.token); // 백엔드에서 준 토큰 저장
      } catch (e) {
        console.error("토큰 발급 실패:", e);
      }
    };
    fetchToken();
  }, [roomId, username]);

  if (!token) return null; // 토큰 없으면 아무것도 안 그림

  return (
    <div style={{
      position: 'absolute', // 게임 화면 위에 둥둥 띄우기
      top: 0,
      right: 0,
      width: '300px', // 오른쪽 사이드바처럼 배치
      height: '100vh',
      zIndex: 999, // 게임보다 위에 있어야 함
      background: 'rgba(0,0,0,0.5)' // 반투명 배경 (선택사항)
    }}>
      <LiveKitRoom
        video={true}
        audio={true}
        token={token}
        serverUrl={LIVEKIT_URL}
        data-lk-theme="default"
      >
        {/* 기본 화상 UI (커스텀 가능) */}
        <VideoConference />
      </LiveKitRoom>
    </div>
  );
}
