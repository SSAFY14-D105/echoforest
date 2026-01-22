package com.d105.service;

import com.d105.config.AiProperties;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.*;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayInputStream;
import java.net.URI;
import java.util.Base64;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class AiGenerationService {

    private static final String BASE_STYLE_PROMPT = "high quality, detailed, fantasy art style, ";
    private final AiProperties aiProperties;
    private final ImageService imageService;
    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper;

    public void generateAndSaveImage(List<String> sourceImages, String userPrompt, String roomId, Long userId) {
        log.info("Requesting AI Image generation for user: {}", userId);
        try {
            // 0. 프롬프트 가공
            String finalPrompt = userPrompt + ", " + BASE_STYLE_PROMPT;

            // 1. 요청 헤더
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("Authorization", "Bearer " + aiProperties.getApiKey());

            // 2. 요청 바디
            Map<String, Object> body = new java.util.HashMap<>();
            body.put("model", "gpt-image-1.5"); // provided model name
            body.put("prompt", finalPrompt);
            body.put("n", 1);
            body.put("size", "1024x1024");

            // [FIX] response_format 파라미터 제거 (API가 지원하지 않음)
            // body.put("response_format", "b64_json");

            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);

            // 3. API 호출
            String genUrl = aiProperties.getUrl();
            if (genUrl.contains("/edits")) {
                genUrl = genUrl.replace("/edits", "/generations");
            }

            ResponseEntity<String> response = restTemplate.exchange(
                    URI.create(genUrl),
                    HttpMethod.POST,
                    entity,
                    String.class
            );

            // 4. 응답 파싱
            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                JsonNode root = objectMapper.readTree(response.getBody());
                JsonNode dataNode = root.path("data");

                if (dataNode.isArray() && !dataNode.isEmpty()) {
                    byte[] imageBytes;

                    // [FIX] b64_json 대신 url을 추출하여 이미지 다운로드
                    if (dataNode.get(0).has("url")) {
                        String imageUrl = dataNode.get(0).path("url").asText();
                        log.info("Image generated at URL: {}", imageUrl);
                        // URL에서 이미지 바이트 다운로드
                        imageBytes = restTemplate.getForObject(new URI(imageUrl), byte[].class);
                    } else if (dataNode.get(0).has("b64_json")) {
                        // 만약 API가 b64_json을 준다면 기존 로직 사용 (fallback)
                        String base64Image = dataNode.get(0).path("b64_json").asText();
                        imageBytes = Base64.getDecoder().decode(base64Image);
                    } else {
                        throw new RuntimeException("No image data found in response");
                    }

                    if (imageBytes == null) {
                        throw new RuntimeException("Failed to download image from URL");
                    }

                    // 6. 이미지 포맷 자동 감지
                    String extension = detectExtension(imageBytes);
                    String mimeType = ".jpg".equals(extension) ? "image/jpeg" : "image/png";

                    // 7. MultipartFile 생성
                    MultipartFile multipartFile = new MockMultipartFile(
                            "ai_generated" + extension,
                            "ai_generated" + extension,
                            mimeType,
                            new ByteArrayInputStream(imageBytes)
                    );

                    // 8. ImageService 저장
                    imageService.uploadImage(multipartFile, userId, null, null, null, roomId, "RESULT");
                    log.info("AI Image generated and saved successfully.");
                }
            } else {
                log.error("AI API Error: {}", response.getStatusCode());
                // 상세 에러 로그 추가
                log.error("Response Body: {}", response.getBody());
            }

        } catch (Exception e) {
            log.error("Failed to generate AI image", e);
            throw new RuntimeException("AI 이미지 생성 실패: " + e.getMessage(), e);
        }
    }

    private String detectExtension(byte[] data) {
        if (data == null || data.length < 4) return ".png";
        if (data[0] == (byte) 0xFF && data[1] == (byte) 0xD8 && data[2] == (byte) 0xFF) return ".jpg";
        if (data[0] == (byte) 0x89 && data[1] == (byte) 0x50 && data[2] == (byte) 0x4E && data[3] == (byte) 0x47)
            return ".png";
        return ".png";
    }
}