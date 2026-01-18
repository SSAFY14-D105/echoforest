/**
 * 모션 인식 타입 정의
 */

/** MediaPipe 손 랜드마크 결과 */
export interface HandLandmark {
  x: number;
  y: number;
  z: number;
}

/** 감지된 포즈 종류 */
export type PoseType = 'hand_heart' | 'cheek_heart' | 'fist' | 'ok_sign' | 'none';

/** 포즈 감지 결과 */
export interface PoseDetectionResult {
  type: PoseType;
  confidence: number;
  timestamp: number;
}

/** 모션 서비스 상태 */
export interface MotionServiceState {
  isInitialized: boolean;
  isRunning: boolean;
  lastPose: PoseDetectionResult | null;
  error: string | null;
}

/** WebSocket MOTION_REPORT 패킷 */
export interface MotionReportPacket {
  type: 'MOTION_REPORT';
  subtype: 'HEART_DETECTION';
  payload: {
    label: PoseType;
    score: number;
  };
}
