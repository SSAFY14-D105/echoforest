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
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.UUID;

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
     * 이미지 업로드 (파일 저장 + DB 저장)
     * 
     * @param participantUserIds 함께 찍은 유저 ID 목록 (최대 3명)
     */
    @Transactional
    public Image uploadImage(MultipartFile file, Long userId, Long mapId,
            Integer stageNumber, List<Long> participantUserIds,
            String roomCode, String imageType) throws IOException {

        // 1. 유저 조회
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));

        // 2. 저장 폴더 생성
        File directory = new File(uploadDir);
        if (!directory.exists()) {
            directory.mkdirs();
        }

        // 3. 파일명 생성 (UUID + 확장자)
        String originalFilename = file.getOriginalFilename();
        String extension = originalFilename != null && originalFilename.contains(".")
                ? originalFilename.substring(originalFilename.lastIndexOf("."))
                : ".webp";
        String savedFileName = UUID.randomUUID() + extension;

        // 4. 파일 저장
        Path filePath = Paths.get(uploadDir + savedFileName);
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

        // 7. 함께 찍은 유저들 추가 (최대 3명)
        if (participantUserIds != null && !participantUserIds.isEmpty()) {
            for (Long participantId : participantUserIds) {
                if (!participantId.equals(userId)) { // 본인 제외
                    userRepository.findById(participantId).ifPresent(image::addParticipant);
                }
            }
        }

        // 8. 저장
        Image savedImage = imageRepository.save(image);
        log.info("Image uploaded: {} by user {} with {} participants",
                savedFileName, userId, image.getParticipants().size());

        return savedImage;
    }

    /**
     * 내 이미지 목록 조회
     */
    public List<Image> getMyImages(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));
        return imageRepository.findByUserOrderByCreatedAtDesc(user);
    }

    /**
     * 특정 방의 이미지 목록 조회
     */
    public List<Image> getRoomImages(String roomCode) {
        return imageRepository.findByRoomCodeOrderByCreatedAtDesc(roomCode);
    }

    /**
     * 이미지 삭제
     */
    @Transactional
    public void deleteImage(Long imageId, Long userId) {
        Image image = imageRepository.findById(imageId)
                .orElseThrow(() -> new IllegalArgumentException("Image not found: " + imageId));

        // 본인 이미지만 삭제 가능
        if (!image.getUser().getId().equals(userId)) {
            throw new IllegalArgumentException("Cannot delete other user's image");
        }

        // 파일 삭제
        try {
            Path filePath = Paths.get(uploadDir + image.getFileName());
            Files.deleteIfExists(filePath);
        } catch (IOException e) {
            log.warn("Failed to delete file: {}", image.getFileName(), e);
        }

        // DB 삭제
        imageRepository.delete(image);
        log.info("Image deleted: {}", imageId);
    }
}
