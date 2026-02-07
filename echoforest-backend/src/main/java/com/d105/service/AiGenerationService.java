package com.d105.service;

import com.d105.dto.image.ImageResponseDto;
import com.d105.entity.Image;
import com.d105.repository.ImageRepository;
import com.d105.repository.UserRepository;
import com.d105.util.ByteArrayMultipartFile;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import javax.imageio.ImageIO;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class AiGenerationService {

    // AI 생성 프롬프트 (템플릿 기반 이미지 합성)
    // [좌표 설정] 템플릿의 하얀 네모칸 위치 (X, Y, Width, Height)
    // 1024x1024 템플릿 기준 수정값 (300x200, 가로 1.5배 확대, 1행 -10px/2행 -5px 상향 조정)
    private static final int[][] SLOT_COORDINATES = {
            { 202, 312, 300, 200 }, // Slot 1 (Top-Left)
            { 522, 312, 300, 200 }, // Slot 2 (Top-Right)
            { 202, 537, 300, 200 }, // Slot 3 (Bottom-Left)
            { 522, 537, 300, 200 } // Slot 4 (Bottom-Right)
    };

    private final ImageService imageService;
    private final ImageRepository imageRepository;
    private final UserRepository userRepository; // 이메일 조회용
    private final EmailService emailService; // 이메일 발송용

    @Value("${file.upload-dir:./uploads/}")
    private String uploadDir;

    /**
     * [메인 로직] DB에 저장된 방 이미지를 사용하여 로컬 이미지 합성
     */
    @Transactional
    public ImageResponseDto generateAndSaveImage(List<String> sourceImages, String roomId, Long userId,
            Integer stageNumber) {
        log.info("Requesting Local Image Composition for user: {}, Room: {}", userId, roomId);
        try {
            // 1. 이미지 선별
            List<String> selectedImagePaths = selectOneImagePerUser(roomId, stageNumber);
            if (selectedImagePaths.isEmpty()) {
                if (sourceImages != null && !sourceImages.isEmpty()) {
                    selectedImagePaths = sourceImages;
                } else {
                    throw new IllegalArgumentException("합성에 사용할 이미지가 없습니다.");
                }
            }
            // 2. 합성 로직 호출 (Base64 변환 없이 파일 경로 사용 가능하지만, 통일성을 위해 Base64 처리하거나 스트림 사용)
            List<String> base64Images = new ArrayList<>();
            for (String imagePath : selectedImagePaths) {
                Path path = Paths.get(uploadDir, imagePath);
                if (Files.exists(path)) {
                    byte[] bytes = Files.readAllBytes(path);
                    base64Images.add(Base64.getEncoder().encodeToString(bytes));
                }
            }
            return composeImageLocal(base64Images, roomId, userId, stageNumber);

        } catch (Exception e) {
            log.error("Failed to generate combined image", e);
            throw new RuntimeException("이미지 합성 실패: " + e.getMessage(), e);
        }
    }

    /**
     * [테스트용/직접 업로드용] 사용자가 직접 업로드한 파일 4개를 사용하여 로컬 이미지 합성
     */
    @Transactional
    public ImageResponseDto generateTestImage(List<MultipartFile> files, Long userId, String roomId,
            Integer stageNumber) {
        log.info("Requesting Direct Image Composition for user: {}, Room: {}", userId, roomId);
        try {
            if (files == null || files.isEmpty()) {
                throw new IllegalArgumentException("테스트할 이미지가 없습니다.");
            }
            List<String> base64Images = new ArrayList<>();
            for (MultipartFile file : files) {
                base64Images.add(Base64.getEncoder().encodeToString(file.getBytes()));
            }
            return composeImageLocal(base64Images, roomId != null ? roomId : "TEST_ROOM", userId, stageNumber);
        } catch (Exception e) {
            log.error("Failed to generate combined image", e);
            throw new RuntimeException("이미지 합성 실패: " + e.getMessage(), e);
        }
    }

    /**
     * Java Graphics2D를 사용한 로컬 이미지 합성
     */
    private ImageResponseDto composeImageLocal(List<String> base64Images, String roomId, Long userId,
            Integer stageNumber)
            throws IOException {
        log.info("Starting local image composition. Images count: {}", base64Images.size());

        // 1. 템플릿 이미지 로드
        BufferedImage templateImage;
        try {
            // 리소스 폴더에서 읽기 (배포 환경 고려하여 getResourceAsStream 사용 권장)
            // 우선 개발 환경 경로 시도 후 실패시 리소스 스트림 시도
            File templateFile = new File("src/main/resources/assets/image_grid_view.png");
            if (templateFile.exists()) {
                templateImage = ImageIO.read(templateFile);
            } else {
                // Fallback to classpath resource
                templateImage = ImageIO.read(getClass().getResourceAsStream("/assets/image_grid_view.png"));
            }
        } catch (Exception e) {
            log.error("Failed to load template image", e);
            throw new RuntimeException("템플릿 이미지를 불러올 수 없습니다.");
        }

        if (templateImage == null) {
            throw new RuntimeException("템플릿 이미지가 null입니다.");
        }

        Graphics2D g2d = templateImage.createGraphics();
        // 안티앨리어싱 설정 (품질 향상)
        g2d.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);

        // 2. 유저 이미지 오버레이
        int maxSlots = Math.min(base64Images.size(), SLOT_COORDINATES.length);

        for (int i = 0; i < maxSlots; i++) {
            String base64 = base64Images.get(i);
            byte[] imageBytes = Base64.getDecoder().decode(base64);
            ByteArrayInputStream bis = new ByteArrayInputStream(imageBytes);
            BufferedImage userImage = ImageIO.read(bis);

            if (userImage != null) {
                int[] coords = SLOT_COORDINATES[i];
                int x = coords[0];
                int y = coords[1];
                int width = coords[2];
                int height = coords[3];

                // 이미지 그리기 (리사이징 자동 처리)
                g2d.drawImage(userImage, x, y, width, height, null);
                log.info("Drew image {} at ({}, {}) with size {}x{}", i, x, y, width, height);
            } else {
                log.warn("Failed to decode user image index {}", i);
            }
        }

        g2d.dispose();

        // 3. 결과물 저장
        ByteArrayOutputStream bos = new ByteArrayOutputStream();
        ImageIO.write(templateImage, "png", bos);
        byte[] resultBytes = bos.toByteArray();

        // 4. DB 저장 및 이메일 전송
        String extension = ".png";
        String mimeType = "image/png";

        MultipartFile multipartFile = new ByteArrayMultipartFile(
                "params_result" + extension,
                "params_result" + extension,
                mimeType,
                resultBytes);

        List<Long> participants = getRoomUserIds(roomId);
        Image savedImage = imageService.uploadImage(
                multipartFile, userId, null, stageNumber, participants, roomId, "RESULT");

        log.info("Composed Image saved successfully: {} (Type: RESULT)", savedImage.getId());

        // sendEmailToUser(userId, resultBytes, savedImage.getFileName()); // 개별 발송 제거

        return ImageResponseDto.from(savedImage);
    }

    /**
     * [게임 종료 로직] 방의 모든 결과 이미지를 모아서 참가자 전원에게 이메일 발송
     */
    @Transactional(readOnly = true)
    public void sendGameSummaryEmail(String roomId) {
        log.info("Preparing summary email for room: {}", roomId);

        // 1. 해당 방의 RESULT 타입 이미지 조회
        List<Image> resultImages = imageRepository
                .findByRoomCodeAndImageTypeAndDeletedAtIsNullOrderByCreatedAtDesc(roomId, "RESULT");
        if (resultImages.isEmpty()) {
            log.warn("No result images found for room: {}", roomId);
            return;
        }

        // 2. 이미지 파일 로드 (Map<FileName, byte[]>)
        Map<String, byte[]> attachments = new java.util.HashMap<>();
        for (Image img : resultImages) {
            try {
                Path path = Paths.get(uploadDir, img.getFileName());
                if (Files.exists(path)) {
                    byte[] bytes = Files.readAllBytes(path);
                    attachments.put(img.getFileName(), bytes);
                }
            } catch (IOException e) {
                log.error("Failed to read image file: {}", img.getFileName(), e);
            }
        }

        if (attachments.isEmpty()) {
            log.warn("No image files could be loaded.");
            return;
        }

        // 3. 방에 참여했던 모든 유저 식별 (이미지 업로더 기준)
        List<Long> userIds = getRoomUserIds(roomId);

        // 4. 각 유저에게 이메일 발송
        for (Long uid : userIds) {
            userRepository.findById(uid).ifPresent(user -> {
                String email = user.getEmail();
                if (email != null && !email.isEmpty()) {
                    String subject = "[EchoForest] 메아리의 숲 여정이 끝났습니다!";
                    String body = """
                            <html>
                            <body>
                                <h3>안녕하세요, %s님!</h3>
                                <p>모든 스테이지를 클리어하신 것을 축하합니다! 🎉</p>
                                <p>각 스테이지에서 촬영된 소중한 추억들을 첨부파일로 보내드립니다.</p>
                                <p>즐거운 시간이 되셨기를 바랍니다.</p>
                                <br/>
                                <p>- 메아리의 숲 일동 드림</p>
                            </body>
                            </html>
                            """.formatted(user.getNickname());

                    emailService.sendEmailWithImages(email, subject, body, attachments);
                }
            });
        }
        log.info("Sent summary emails to {} users.", userIds.size());
    }

    private List<String> selectOneImagePerUser(String roomId, Integer stageNumber) {
        List<Image> roomImages;
        if (stageNumber != null) {
            // [FIX] 특정 스테이지의 사진으로만 합성하도록 필터링
            roomImages = imageRepository.findByRoomCodeAndStageNumberAndDeletedAtIsNullOrderByCreatedAtDesc(roomId,
                    stageNumber);
        } else {
            // 스테이지 지정 없으면 전체 방 사진 중 랜덤 (기존 로직 유지)
            roomImages = imageRepository.findByRoomCodeAndDeletedAtIsNullOrderByCreatedAtDesc(roomId);
        }

        if (roomImages.isEmpty())
            return Collections.emptyList();

        Map<Long, List<Image>> imagesByUser = roomImages.stream()
                .collect(Collectors.groupingBy(img -> img.getUser().getId()));

        List<String> selectedPaths = new ArrayList<>();
        // 랜덤 대신 최신순으로 정렬되었으므로 첫 번째(가장 최근) 사진 선택하는 것이 더 자연스러움
        // 다만 "랜덤 포즈" 게임이므로 랜덤이 나을 수도 있음. 기존 로직 유지 (랜덤).
        Random random = new Random();

        for (List<Image> userPhotos : imagesByUser.values()) {
            if (!userPhotos.isEmpty()) {
                Image randomPick = userPhotos.get(random.nextInt(userPhotos.size()));
                selectedPaths.add(randomPick.getFileName());
            }
        }
        return selectedPaths;
    }

    private List<Long> getRoomUserIds(String roomId) {
        List<Image> roomImages = imageRepository.findByRoomCodeAndDeletedAtIsNullOrderByCreatedAtDesc(roomId);
        if (roomImages.isEmpty())
            return Collections.emptyList();

        return roomImages.stream()
                .map(img -> img.getUser().getId())
                .distinct()
                .collect(Collectors.toList());
    }

}