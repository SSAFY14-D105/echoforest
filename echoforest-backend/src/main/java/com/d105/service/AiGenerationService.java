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
    // 1024x1024 템플릿 기준 수정값 (350 -> 260으로 축소 및 중앙 정렬)
    private static final int[][] SLOT_COORDINATES = {
            { 145, 145, 260, 260 }, // Slot 1 (Top-Left)
            { 619, 145, 260, 260 }, // Slot 2 (Top-Right)
            { 145, 619, 260, 260 }, // Slot 3 (Bottom-Left)
            { 619, 619, 260, 260 } // Slot 4 (Bottom-Right)
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
    public ImageResponseDto generateAndSaveImage(List<String> sourceImages, String roomId, Long userId) {
        log.info("Requesting Local Image Composition for user: {}, Room: {}", userId, roomId);
        try {
            // 1. 이미지 선별
            List<String> selectedImagePaths = selectOneImagePerUser(roomId);
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
            return composeImageLocal(base64Images, roomId, userId);

        } catch (Exception e) {
            log.error("Failed to generate combined image", e);
            throw new RuntimeException("이미지 합성 실패: " + e.getMessage(), e);
        }
    }

    /**
     * [테스트용] 사용자가 직접 업로드한 파일 4개를 사용하여 로컬 이미지 합성
     */
    @Transactional
    public ImageResponseDto generateTestImage(List<MultipartFile> files, Long userId) {
        log.info("Requesting TEST Local Image Composition for user: {}", userId);
        try {
            if (files == null || files.isEmpty()) {
                throw new IllegalArgumentException("테스트할 이미지가 없습니다.");
            }
            List<String> base64Images = new ArrayList<>();
            for (MultipartFile file : files) {
                base64Images.add(Base64.getEncoder().encodeToString(file.getBytes()));
            }
            return composeImageLocal(base64Images, "TEST_ROOM", userId);
        } catch (Exception e) {
            log.error("Failed to generate TEST combined image", e);
            throw new RuntimeException("테스트 이미지 합성 실패: " + e.getMessage(), e);
        }
    }

    /**
     * Java Graphics2D를 사용한 로컬 이미지 합성
     */
    private ImageResponseDto composeImageLocal(List<String> base64Images, String roomId, Long userId)
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
                multipartFile, userId, null, null, participants, roomId, "RESULT");

        log.info("Composed Image saved successfully: {} (Type: RESULT)", savedImage.getId());

        sendEmailToUser(userId, resultBytes, savedImage.getFileName());

        return ImageResponseDto.from(savedImage);
    }

    private void sendEmailToUser(Long userId, byte[] imageBytes, String fileName) {
        // 유저 정보 조회
        userRepository.findById(userId).ifPresent(user -> {
            String email = user.getEmail();
            if (email != null && !email.isEmpty()) {
                String subject = "[EchoForest] 당신의 멋진 게임 결과 이미지가 도착했습니다!";
                String body = """
                        <html>
                        <body>
                            <h3>안녕하세요, %s님!</h3>
                            <p>"메아리의 숲"에서의 소중한 추억을 이미지를 보내드립니다.</p>
                            <p>친구 혹은 가족들과 함께한 오늘의 추억을 간직하세요! 🥰</p>
                            <br/>
                            <p>감사합니다.</p>
                            <p>-메아리의 숲 일동.</p>
                        </body>
                        </html>
                        """.formatted(user.getNickname());

                // 이메일 서비스 호출 (비동기 처리를 고려할 수도 있음)
                emailService.sendEmailWithImage(email, subject, body, imageBytes, fileName);
            }
        });
    }

    private List<String> selectOneImagePerUser(String roomId) {
        List<Image> roomImages = imageRepository.findByRoomCodeAndDeletedAtIsNullOrderByCreatedAtDesc(roomId);
        if (roomImages.isEmpty())
            return Collections.emptyList();

        Map<Long, List<Image>> imagesByUser = roomImages.stream()
                .collect(Collectors.groupingBy(img -> img.getUser().getId()));

        List<String> selectedPaths = new ArrayList<>();
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