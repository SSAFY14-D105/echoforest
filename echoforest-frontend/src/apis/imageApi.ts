/**
 * 이미지 업로드 API
 * 엔딩 미션 캡처 이미지를 서버로 전송
 */

import { API_BASE_URL } from '../config';

export interface ImageResponseDto {
    imageId: number;
    fileName: string;
    stageNumber: number | null;
    roomCode: string | null;
    imageType: string;
    participants: ParticipantDto[];
}

interface ParticipantDto {
    userId: number;
    nickname: string;
}

/**
 * 엔딩 미션 캡처 이미지 업로드
 * @param file 캡처 이미지 파일
 * @param userId 업로더 유저 ID
 * @param stageNumber 스테이지 번호
 * @param participantUserIds 함께 찍은 유저 ID 목록
 * @param roomCode 방 코드
 * @param imageType 이미지 타입 (기본값: 'ENDING')
 */
export async function uploadEndingCapture(
    file: Blob,
    userId: number,
    stageNumber: number,
    participantUserIds: number[],
    roomCode: string,
    imageType: string = 'ENDING'
): Promise<ImageResponseDto> {
    const token = localStorage.getItem('token');

    const formData = new FormData();
    formData.append('file', file, `capture_${Date.now()}.webp`);
    formData.append('userId', userId.toString());
    formData.append('stageNumber', stageNumber.toString());
    formData.append('roomCode', roomCode);
    formData.append('imageType', imageType);

    // 참가자 ID 목록 추가
    participantUserIds.forEach(id => {
        formData.append('participantUserIds', id.toString());
    });

    //     console.log('[imageApi] Uploading image:', {
    //     url: `${API_BASE_URL}/images`,
    //         userId,
    //         stageNumber,
    //         roomCode,
    //         imageType,
    //         hasToken: !!token,
    //             fileSize: file.size,
    //                 fileType: file.type
    // });

    const response = await fetch(`${API_BASE_URL}/images`, {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        body: formData
    });

    // console.log('[imageApi] Response status:', response.status, response.statusText);

    if (!response.ok) {
        const errorText = await response.text();
        console.error('[imageApi] Upload failed:', response.status, errorText);
        throw new Error(`이미지 업로드 실패: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    // console.log('[imageApi] Upload success:', result);
    return result;
}

/**
 * 여러 이미지를 순차적으로 업로드
 * @param files 캡처 이미지 Blob 배열
 * @param userId 업로더 유저 ID
 * @param stageNumber 스테이지 번호
 * @param participantUserIds 함께 찍은 유저 ID 목록
 * @param roomCode 방 코드
 */
export async function uploadAllEndingCaptures(
    files: Blob[],
    userId: number,
    stageNumber: number,
    participantUserIds: number[],
    roomCode: string
): Promise<ImageResponseDto[]> {
    const results: ImageResponseDto[] = [];

    for (const file of files) {
        try {
            const result = await uploadEndingCapture(
                file,
                userId,
                stageNumber,
                participantUserIds,
                roomCode
            );
            results.push(result);
        } catch (error) {
            console.error('[imageApi] Failed to upload capture:', error);
        }
    }

    return results;
}

/**
 * 내 이미지 목록 조회
 * @param userId 유저 ID
 */
export async function getMyImages(userId: number): Promise<ImageResponseDto[]> {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE_URL}/images/my?userId=${userId}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    });

    if (!response.ok) {
        throw new Error('이미지 목록 조회 실패');
    }

    return response.json();
}

/**
 * 선택한 이미지 이메일 전송 (내 메일)
 * @param userId 유저 ID
 * @param imageIds 이미지 ID 목록
 */
export async function sendImagesToEmail(
    userId: number,
    imageIds: number[]
): Promise<void> {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE_URL}/images/email`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ userId, imageIds })
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '이메일 전송 실패');
    }
}

/**
 * AI 합성 이미지 생성 요청 (로컬 합성)
 * @param files 캡처 이미지 파일들
 * @param userId 요청 유저 ID
 * @param roomId 방 코드 (선택)
 * @param stageNumber 스테이지 번호 (선택)
 */
export async function generateAiImage(
    files: Blob[],
    userId: number,
    roomId?: string,
    stageNumber?: number
): Promise<ImageResponseDto> {
    const token = localStorage.getItem('token');
    const formData = new FormData();
    files.forEach(file => {
        formData.append('files', file);
    });
    // query param 전달
    let url = `${API_BASE_URL}/ai/test/generate?userId=${userId}`;
    if (roomId) url += `&roomId=${roomId}`;
    if (stageNumber) url += `&stageNumber=${stageNumber}`;

    const response = await fetch(url, {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        body: formData
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`이미지 합성 실패: ${response.status} - ${errorText}`);
    }

    return response.json();
}

/**
 * [HOST Only] 서버에 DB 이미지를 사용한 합성 요청 (동기화 완료 후 호출)
 */
export async function generateCompositeImage(
    roomId: string,
    userId: number,
    stageNumber: number
): Promise<ImageResponseDto> {
    const token = localStorage.getItem('token');

    // AiGenerationReqDto 스펙에 맞춤 (sourceImages 필수이므로 dummy 전달, 실제로 DB 이미지 있으면 무시됨)
    const body = {
        sourceImages: ["dummy"],
        roomId,
        userId,
        stageNumber
    };

    const response = await fetch(`${API_BASE_URL}/ai/generate`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`이미지 합성 실패 (Composite): ${response.status} - ${errorText}`);
    }

    return response.json();
}

/**
 * 방의 합성된 이미지 목록 조회 (RESULT 타입)
 * @param roomCode 방 코드
 */
export async function getRoomGeneratedImages(roomCode: string): Promise<ImageResponseDto[]> {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE_URL}/ai/room/${roomCode}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    });

    if (!response.ok) {
        throw new Error('합성 이미지 목록 조회 실패');
    }

    return response.json();
}

export interface PlayerGameStats {
    username: string;
    kissCount: number;
    curseCount: number;
}

export interface FinishResponseDto {
    message: string;
    stats?: PlayerGameStats[];
}

/**
 * 최종 결과 이메일 발송 요청
 * @param roomId 방 코드/ID
 */
export async function sendFinishEmail(roomId: string): Promise<FinishResponseDto> {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE_URL}/ai/finish/${roomId}`, {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    });

    if (!response.ok) {
        throw new Error('이메일 발송 요청 실패');
    }
    return response.json();
}
