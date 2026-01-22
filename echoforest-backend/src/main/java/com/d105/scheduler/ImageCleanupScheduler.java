package com.d105.scheduler;

import com.d105.service.ImageService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class ImageCleanupScheduler {

    private final ImageService imageService;

    /**
     * 매일 새벽 3시에 실행
     * 7일 지난 이미지 파일을 자동으로 삭제합니다.
     * Cron 표현식: 초 분 시 일 월 요일
     */
    @Scheduled(cron = "0 0 3 * * *")
    public void cleanupOldImages() {
        log.info("🧹 Start cleanup of old images...");

        try {
            int count = imageService.deleteOldImages();
            log.info("✨ Cleanup finished. Deleted {} old images.", count);
        } catch (Exception e) {
            log.error("❌ Cleanup failed", e);
        }
    }
}