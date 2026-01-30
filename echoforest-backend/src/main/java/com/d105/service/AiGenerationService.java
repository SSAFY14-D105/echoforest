package com.d105.service;

import com.d105.config.AiProperties;
import com.d105.dto.image.ImageResponseDto;
import com.d105.entity.Image;
import com.d105.repository.ImageRepository;
import com.d105.repository.UserRepository;
import com.d105.util.ByteArrayMultipartFile;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@Slf4j
@Service
@RequiredArgsConstructor
public class AiGenerationService {

    // B급 감성 프롬프트
    // AI 생성 프롬프트 (유저 요청 반영: B급 감성 제외, 얼굴 유지, 게임 캐릭터 장식)
    private static final String B_GRADE_STYLE_PROMPT = "Create a fun and cute commemorative photo collage of these people. "
            +
            "IMPORTANT: Use ONLY the faces from the provided source images. Do NOT generate new human faces. " +
            "Theme: A happy memory of playing a game together. " +
            "Decoration: Decorate the background and borders with cute forest spirit characters and magical elements (stars, leaves). "
            +
            "Style: Bright, cheerful, and heartwarming. Keep the people realistic but the decorations cartoonish/fantasy. ";

    private final AiProperties aiProperties;
    private final ImageService imageService;
    private final ImageRepository imageRepository;
    private final UserRepository userRepository; // 이메일 조회용
    private final EmailService emailService; // 이메일 발송용
    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper;

    @Value("${file.upload-dir:./uploads/}")
    private String uploadDir;

    /**
     * [메인 로직] DB에 저장된 방 이미지를 사용하여 AI 합성
     */
    @Transactional
    public ImageResponseDto generateAndSaveImage(List<String> sourceImages, String roomId, Long userId) {
        log.info("Requesting AI Image generation for user: {}, Room: {}", userId, roomId);
        try {
            // 1. 이미지 선별 (DB에서 가져오기)
            List<String> selectedImagePaths = selectOneImagePerUser(roomId);

            if (selectedImagePaths.isEmpty()) {
                if (sourceImages != null && !sourceImages.isEmpty()) {
                    selectedImagePaths = sourceImages;
                } else {
                    throw new IllegalArgumentException("합성에 사용할 이미지가 없습니다.");
                }
            }

            // 2. 파일 읽기 및 Base64 변환
            List<String> base64Images = new ArrayList<>();
            for (String imagePath : selectedImagePaths) {
                Path path = Paths.get(uploadDir, imagePath);
                if (Files.exists(path)) {
                    byte[] bytes = Files.readAllBytes(path);
                    base64Images.add(Base64.getEncoder().encodeToString(bytes));
                }
            }

            // 2.5 캐릭터 에셋 추가 (resources/assets/characters)
            List<String> characterImages = loadCharacterAssets();
            base64Images.addAll(characterImages);
            log.info("Added {} character assets", characterImages.size());

            // 3. API 호출 및 저장/전송
            return callAiApiAndSave(base64Images, roomId, userId);

        } catch (Exception e) {
            log.error("Failed to generate AI image", e);
            throw new RuntimeException("AI 이미지 생성 실패: " + e.getMessage(), e);
        }
    }

    /**
     * [테스트용] 사용자가 직접 업로드한 파일 4개를 사용하여 AI 합성
     */
    @Transactional
    public ImageResponseDto generateTestImage(List<MultipartFile> files, Long userId) {
        log.info("Requesting TEST AI Image generation for user: {}", userId);
        try {
            if (files == null || files.isEmpty()) {
                throw new IllegalArgumentException("테스트할 이미지가 없습니다.");
            }

            // 1. MultipartFile -> Base64 변환
            List<String> base64Images = new ArrayList<>();
            for (MultipartFile file : files) {
                base64Images.add(Base64.getEncoder().encodeToString(file.getBytes()));
            }

            // 2. API 호출 및 저장/전송 (방 번호는 TEST_ROOM 고정)
            return callAiApiAndSave(base64Images, "TEST_ROOM", userId);

        } catch (Exception e) {
            log.error("Failed to generate TEST AI image", e);
            throw new RuntimeException("테스트 이미지 생성 실패: " + e.getMessage(), e);
        }
    }

    /**
     * AI API 호출 공통 로직
     */
    /**
     * AI API 호출 공통 로직 (Google Vertex AI - Imagen)
     */
    private ImageResponseDto callAiApiAndSave(List<String> base64Images, String roomId, Long userId) {
        // 프롬프트 결합 (기본 프롬프트 고정)
        String finalPrompt = B_GRADE_STYLE_PROMPT;
        log.info("Final Prompt: {}", finalPrompt);

        // API 요청 헤더
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        // Google AI Studio API는 Authorization: Bearer 대신 x-goog-api-key 헤더 사용
        headers.set("x-goog-api-key", aiProperties.getApiKey());

        // Google Vertex AI (Imagen) 요청 바디 구성
        // {
        // "instances": [ { "prompt": "..." } ],
        // "parameters": { "sampleCount": 1, "aspectRatio": "1:1" }
        // }
        Map<String, Object> instance = new HashMap<>();
        instance.put("prompt", finalPrompt);

        // 이미지 데이터 추가 (첫 번째 이미지를 base_image로 사용 - Imagen API 제약 고려)
        // 여러 장을 합성하려면 별도 전처리나 멀티모달 모델(Gemini) 사용이 필요하지만,
        // 여기서는 첫 번째 이미지를 대표 이미지로 전송 시도.
        if (!base64Images.isEmpty()) {
            Map<String, String> imageMap = new HashMap<>();
            imageMap.put("bytesBase64Encoded", base64Images.get(0));
            // "image" 필드 사용 (Subject to API spec)
            instance.put("image", imageMap);
        }

        Map<String, Object> parameters = new HashMap<>();
        parameters.put("sampleCount", 1);
        parameters.put("aspectRatio", "1:1"); // 인스타그램/포스터용 1:1 비율

        Map<String, Object> body = new HashMap<>();
        body.put("instances", Collections.singletonList(instance));
        body.put("parameters", parameters);

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);

        // API URL 설정 (aiProperties.getUrl()에 GMS Vertex AI URL이 있어야 함)
        String genUrl = aiProperties.getUrl();
        log.info("Calling AI URL: {}", genUrl);

        // 호출
        ResponseEntity<String> response = restTemplate.exchange(
                URI.create(genUrl),
                HttpMethod.POST,
                entity,
                String.class);

        return processResponseAndSave(response, roomId, userId);
    }

    /**
     * 응답 처리 + 저장(RESULT 타입) + 이메일 전송 (Google Vertex AI Format)
     */
    private ImageResponseDto processResponseAndSave(ResponseEntity<String> response, String roomId, Long userId) {
        try {
            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                log.info("AI API Response Body: {}", response.getBody()); // 디버깅용 로그 추가
                JsonNode root = objectMapper.readTree(response.getBody());

                // Google Vertex AI 응답: { "predictions": [ { "bytesBase64Encoded": "...",
                // "mimeType": "..." } ] }
                JsonNode predictions = root.path("predictions");

                if (predictions.isArray() && !predictions.isEmpty()) {
                    byte[] imageBytes = null;
                    String extension = ".png";

                    // 1. 이미지 데이터 추출
                    if (predictions.get(0).has("bytesBase64Encoded")) {
                        String base64Image = predictions.get(0).path("bytesBase64Encoded").asText();
                        imageBytes = Base64.getDecoder().decode(base64Image);

                        // MimeType 확인 (선택)
                        if (predictions.get(0).has("mimeType")) {
                            String mime = predictions.get(0).path("mimeType").asText();
                            if ("image/jpeg".equals(mime))
                                extension = ".jpg";
                        }
                    }

                    if (imageBytes == null) {
                        // 혹시 OpenAI 포맷으로 올 경우를 대비한 폴백 (GMS 특성 고려)
                        // predictions가 비어있거나 bytesBase64Encoded가 없는 경우
                        JsonNode dataNode = root.path("data");
                        if (dataNode.isArray() && !dataNode.isEmpty()) {
                            if (dataNode.get(0).has("url")) {
                                String imageUrl = dataNode.get(0).path("url").asText();
                                imageBytes = restTemplate.getForObject(new URI(imageUrl), byte[].class);
                            } else if (dataNode.get(0).has("b64_json")) {
                                String base64Image = dataNode.get(0).path("b64_json").asText();
                                imageBytes = Base64.getDecoder().decode(base64Image);
                            }
                        }
                    }

                    if (imageBytes == null) {
                        throw new RuntimeException("이미지 데이터를 찾을 수 없습니다. (응답 포맷 불일치)");
                    }

                    // 확장자 재확인
                    if (".png".equals(extension)) {
                        extension = detectExtension(imageBytes);
                    }
                    String mimeType = ".jpg".equals(extension) ? "image/jpeg" : "image/png";

                    // 2. MultipartFile로 변환
                    MultipartFile multipartFile = new ByteArrayMultipartFile(
                            "ai_result" + extension,
                            "ai_result" + extension,
                            mimeType,
                            imageBytes);

                    // 3. DB 및 파일 저장 (imageType = "RESULT" 지정, 참여자 전체 포함)
                    List<Long> participants = getRoomUserIds(roomId);
                    Image savedImage = imageService.uploadImage(
                            multipartFile, userId, null, null, participants, roomId, "RESULT");
                    log.info("AI Image saved successfully: {} (Type: RESULT)", savedImage.getId());

                    // 4. [이메일 전송 로직]
                    sendEmailToUser(userId, imageBytes, savedImage.getFileName());

                    return ImageResponseDto.from(savedImage);
                }
            }
            throw new RuntimeException("AI API 응답 오류: " + response.getStatusCode());
        } catch (Exception e) {
            log.error("Error processing AI response", e);
            throw new RuntimeException("결과 처리 중 오류 발생: " + e.getMessage(), e);
        }
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

    private String detectExtension(byte[] data) {
        if (data == null || data.length < 4)
            return ".png";
        if (data[0] == (byte) 0xFF && data[1] == (byte) 0xD8 && data[2] == (byte) 0xFF)
            return ".jpg";
        return ".png";
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

    private List<String> loadCharacterAssets() {
        List<String> assets = new ArrayList<>();
        try {
            // Spring ResourceLoader 등을 사용하는 것이 좋으나, 여기서는 ClassLoader로 접근
            // JAR 배포 시에는 getResourceAsStream 등을 써야 함.
            // 개발 환경(FileSystem)과 배포 환경(JAR) 호환을 위해 ResourcePatternResolver 사용 권장하지만,
            // 간단하게 File 접근 시도해보고 안되면 리턴.

            // 주의: JAR 내부 파일은 File 객체로 읽을 수 없음. InputStream으로 읽어야 함.
            // 여기서는 개발 환경(c:\SSAFY...) 절대경로가 있으니 일단 물리 경로 체크.

            // 사용자가 만든 물리 경로: src/main/resources/assets/characters
            // 실행 시점(target/classes...)과는 다를 수 있음.
            // 일단 물리적 소스 경로를 하드코딩해서 읽거나(개발용), classpath 리소스를 읽어야 함.

            // 개발 편의를 위해 소스 디렉토리에서 읽기 시도 (사용자가 방금 mkdir 했으므로)
            Path assetDir = Paths.get("src/main/resources/assets/characters");
            if (Files.exists(assetDir) && Files.isDirectory(assetDir)) {
                try (Stream<Path> stream = Files.list(assetDir)) {
                    stream.filter(Files::isRegularFile)
                            .forEach(p -> {
                                try {
                                    byte[] b = Files.readAllBytes(p);
                                    assets.add(Base64.getEncoder().encodeToString(b));
                                } catch (Exception e) {
                                    log.warn("Failed to read asset: {}", p, e);
                                }
                            });
                }
            } else {
                log.warn("Character asset directory not found: {}", assetDir.toAbsolutePath());
            }
        } catch (Exception e) {
            log.warn("Error loading character assets", e);
        }
        return assets;
    }
}