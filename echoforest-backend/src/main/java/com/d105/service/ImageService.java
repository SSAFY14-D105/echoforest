package com.d105.service;

import com.d105.entity.Image;
import com.d105.entity.Map;
import com.d105.entity.User;
import com.d105.repository.ImageRepository;
import com.d105.repository.MapRepository;
import com.d105.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.DirectoryStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Stream;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ImageService {

    private final ImageRepository imageRepository;
    private final UserRepository userRepository;
    private final MapRepository mapRepository;

    @Value("${file.upload-dir:./uploads/}")
    private String uploadDir;

    /**
     * 이미지 업로드 (날짜별 폴더링 + DB 저장)
     */
    @Transactional
    public Image uploadImage(MultipartFile file, Long userId, Long mapId,
            Integer stageNumber, List<Long> participantUserIds,
            String roomCode, String imageType) throws IOException {

        // 1. 유저 조회
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));

        // 2. 날짜별 폴더 생성 (예: ./uploads/2024-05-20/)
        String dateFolder = LocalDate.now().toString(); // YYYY-MM-DD
        Path uploadPath = Paths.get(uploadDir, dateFolder);

        if (!Files.exists(uploadPath)) {
            Files.createDirectories(uploadPath);
        }

        // 3. 파일명 생성 (UUID + 확장자)
        String originalFilename = file.getOriginalFilename();
        String extension = originalFilename != null && originalFilename.contains(".")
                ? originalFilename.substring(originalFilename.lastIndexOf("."))
                : ".webp";
        String uuidFileName = UUID.randomUUID() + extension;

        // DB에 저장될 파일 경로 (날짜/파일명)
        String savedFileName = dateFolder + "/" + uuidFileName;

        // 4. 파일 저장
        Path filePath = uploadPath.resolve(uuidFileName);
        Files.write(filePath, file.getBytes());

        // 5. 관련 엔티티 조회 (선택적)
        Map map = mapId != null ? mapRepository.findById(mapId).orElse(null) : null;

        // 6. Image 엔티티 생성
        Image image = Image.builder()
                .user(user)
                .fileName(savedFileName)
                .map(map)
                .stageNumber(stageNumber)
                .roomCode(roomCode)
                .imageType(imageType != null ? imageType : "MOTION")
                .build();

        // 7. 함께 찍은 유저들 추가
        if (participantUserIds != null && !participantUserIds.isEmpty()) {
            for (Long participantId : participantUserIds) {
                if (!participantId.equals(userId)) {
                    userRepository.findById(participantId).ifPresent(image::addParticipant);
                }
            }
        }

        // 8. 저장
        Image savedImage = imageRepository.save(image);
        log.info("Image uploaded: {} by user {}", savedFileName, userId);

        return savedImage;
    }

    /**
     * 내 이미지 목록 조회 (삭제 안 된 것만)
     */
    public List<Image> getMyImages(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));
        // deletedAt이 NULL인 데이터만 조회
        return imageRepository.findByUserAndDeletedAtIsNullOrderByCreatedAtDesc(user);
    }

    /**
     * 특정 방의 이미지 목록 조회 (삭제 안 된 것만)
     */
    public List<Image> getRoomImages(String roomCode) {
        // deletedAt이 NULL인 데이터만 조회
        return imageRepository.findByRoomCodeAndDeletedAtIsNullOrderByCreatedAtDesc(roomCode);
    }

    /**
     * 이미지 삭제 (Soft Delete - 사용자 요청)
     * - 파일 유지
     * - DB 컬럼 업데이트 (deletedAt = now)
     */
    @Transactional
    public void deleteImage(Long imageId, Long userId) {
        Image image = imageRepository.findById(imageId)
                .orElseThrow(() -> new IllegalArgumentException("Image not found: " + imageId));

        if (!image.getUser().getId().equals(userId)) {
            throw new IllegalArgumentException("Cannot delete other user's image");
        }

        // 실제 파일 삭제 및 DB 삭제를 하지 않고, 플래그만 변경
        image.softDelete();

        // (JPA Dirty Checking으로 인해 save 호출 없이도 트랜잭션 종료 시 update 쿼리 실행됨)
        log.info("Image soft-deleted by user: {}", imageId);
    }

    /**
     * 오래된 이미지 일괄 삭제 (Hard Delete - 스케줄러)
     * - 7일 지난 이미지는 Soft Delete 여부와 상관없이 완전히 삭제 (용량 확보)
     */
    @Transactional
    public int deleteOldImages() {
        // 1. 기준 시간 설정 (현재로부터 7일 전)
        LocalDateTime cutoffDate = LocalDateTime.now().minusDays(7);

        // 2. 삭제 대상 이미지 조회 (createdAt 기준)
        // Soft Delete된 이미지도 7일 지났으면 여기서 조회되어 영구 삭제됨
        List<Image> oldImages = imageRepository.findByCreatedAtBefore(cutoffDate);
        int deletedCount = 0;

        for (Image image : oldImages) {
            // 파일 삭제 (Hard Delete)
            deletePhysicalFile(image.getFileName());
            // DB 데이터 삭제 (Hard Delete)
            imageRepository.delete(image);
            deletedCount++;
        }

        // 3. 비어있는 폴더 정리
        cleanupEmptyFolders();

        return deletedCount;
    }

    // 파일 삭제 헬퍼 메서드
    private void deletePhysicalFile(String fileName) {
        try {
            Path filePath = Paths.get(uploadDir, fileName);
            Files.deleteIfExists(filePath);
        } catch (IOException e) {
            log.warn("Failed to delete file: {}", fileName, e);
        }
    }

    /**
     * 비어있는 폴더 정리
     */
    private void cleanupEmptyFolders() {
        try (Stream<Path> paths = Files.walk(Paths.get(uploadDir), 1)) {
            paths.filter(Files::isDirectory)
                    .filter(path -> !path.equals(Paths.get(uploadDir)))
                    .forEach(this::deleteFolderIfEmpty);
        } catch (IOException e) {
            log.warn("Failed to scan folders for cleanup", e);
        }
    }

    private void deleteFolderIfEmpty(Path folderPath) {
        try (DirectoryStream<Path> dirStream = Files.newDirectoryStream(folderPath)) {
            if (!dirStream.iterator().hasNext()) {
                Files.delete(folderPath);
                log.info("Deleted empty folder: {}", folderPath);
            }
        } catch (IOException e) {
            log.warn("Failed to delete folder: {}", folderPath, e);
        }
    }

    /**
     * 이미지 파일 다운로드 (Resource 반환)
     */
    public Resource downloadImage(Long imageId) {
        Image image = imageRepository.findById(imageId)
                .orElseThrow(() -> new IllegalArgumentException("Image not found: " + imageId));

        try {
            Path filePath = Paths.get(uploadDir, image.getFileName());
            Resource resource = new UrlResource(filePath.toUri());

            if (resource.exists() || resource.isReadable()) {
                return resource;
            } else {
                throw new RuntimeException("Could not read file: " + image.getFileName());
            }
        } catch (Exception e) {
            throw new RuntimeException("Could not read file: " + image.getFileName(), e);
        }
    }
}