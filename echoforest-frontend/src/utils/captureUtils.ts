/**
 * 이미지 캡처 유틸리티
 * 비디오 프레임을 이미지로 캡처하는 함수들
 */

/**
 * 비디오 엘리먼트에서 현재 프레임을 캡처하여 Blob으로 반환
 * @param videoElement 캡처할 비디오 엘리먼트
 * @param format 이미지 포맷 (기본값: 'image/webp')
 * @param quality 이미지 품질 0-1 (기본값: 0.9)
 */
export async function captureVideoFrame(
    videoElement: HTMLVideoElement,
    format: 'image/webp' | 'image/png' | 'image/jpeg' = 'image/webp',
    quality: number = 0.9
): Promise<Blob> {
    return new Promise((resolve, reject) => {
        try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            if (!ctx) {
                throw new Error('Failed to get canvas context');
            }

            // 비디오 크기에 맞게 캔버스 설정
            canvas.width = videoElement.videoWidth || 640;
            canvas.height = videoElement.videoHeight || 480;

            // 비디오 프레임을 캔버스에 그리기
            ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

            // 캔버스를 Blob으로 변환
            canvas.toBlob(
                (blob) => {
                    if (blob) {
                        resolve(blob);
                    } else {
                        reject(new Error('Failed to create blob from canvas'));
                    }
                },
                format,
                quality
            );
        } catch (error) {
            reject(error);
        }
    });
}

/**
 * 여러 비디오 엘리먼트에서 동시에 프레임 캡처
 * @param videoElements 캡처할 비디오 엘리먼트 배열 (로컬 + 리모트)
 */
export async function captureAllParticipants(
    videoElements: (HTMLVideoElement | null)[]
): Promise<Blob[]> {
    const validElements = videoElements.filter((el): el is HTMLVideoElement =>
        el !== null && el.videoWidth > 0 && el.videoHeight > 0
    );

    const capturePromises = validElements.map(el => captureVideoFrame(el));

    return Promise.all(capturePromises);
}

/**
 * Blob을 File 객체로 변환 (FormData 업로드용)
 * @param blob 변환할 Blob
 * @param filename 파일명
 */
export function blobToFile(blob: Blob, filename: string): File {
    return new File([blob], filename, { type: blob.type });
}
