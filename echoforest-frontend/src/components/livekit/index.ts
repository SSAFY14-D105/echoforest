/**
 * LiveKit 컴포넌트 모듈
 * 
 * 사용법:
 * ```tsx
 * import { LiveKitProvider, SidebarVideoLayout, FourSplitLayout } from '@/components/livekit';
 * 
 * // Map 진행 중 (사이드바)
 * <LiveKitProvider roomId="room_1" username="철수">
 *   <SidebarVideoLayout />
 * </LiveKitProvider>
 * 
 * // 인증샷 화면 (4분할)
 * <LiveKitProvider roomId="room_1" username="철수">
 *   <FourSplitLayout centerOverlay={<FingerRoulette />} />
 * </LiveKitProvider>
 * ```
 */

// Provider
export { LiveKitProvider } from './LiveKitProvider';

// 레이아웃 컴포넌트
export { SidebarVideoLayout } from './SidebarVideoLayout';
export { FourSplitLayout } from './FourSplitLayout';

// 훅 (필요시 직접 사용)
export { useLiveKit } from '../../hooks/useLiveKit';
