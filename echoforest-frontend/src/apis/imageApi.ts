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

    console.log('[imageApi] Uploading image:', {
        url: `${API_BASE_URL}/images`,
        userId,
        stageNumber,
        roomCode,
        imageType,
        hasToken: !!token,
        fileSize: file.size,
        fileType: file.type
    });

    const response = await fetch(`${API_BASE_URL}/images`, {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        body: formData
    });

    console.log('[imageApi] Response status:', response.status, response.statusText);

    if (!response.ok) {
        const errorText = await response.text();
        console.error('[imageApi] Upload failed:', response.status, errorText);
        throw new Error(`이미지 업로드 실패: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log('[imageApi] Upload success:', result);
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
