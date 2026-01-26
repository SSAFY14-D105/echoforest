package com.d105.service;

import com.d105.config.AiProperties;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.net.URI;
import java.util.List;
import java.util.Map;

/**
 * AI 서버 감정 분석 서비스
 * * AI 서버의 /analyze/batch 엔드포인트를 호출하여
 * 부정어 분석 및 저주 스택 증가량을 계산합니다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AiSentimentService {

    // private final AiProperties aiProperties; // 제거 또는 이미지 생성시에만 사용
    private final ObjectMapper objectMapper;
    private final RestTemplate restTemplate = new RestTemplate();

    /**
     * docker-compose의 SENTIMENT_AI_URL 값을 가져옵니다.
     * 값 예시: http://ai-server:8000
     * application.properties의 키 이름(ai.sentiment.url)과 일치해야 합니다.
     */
    @Value("${ai.sentiment.url}")
    private String sentimentAiUrl;

    /**
     * 배치 텍스트 분석
     * * @param texts 분석할 텍스트 목록
     * @return 총 스택 증가량 (total_stack_delta)
     */
    public int analyzeBatch(List<String> texts) {
        if (texts == null || texts.isEmpty()) {
            return 0;
        }

        try {
            // 1. 요청 헤더 설정
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            // 2. 요청 바디 생성
            Map<String, Object> body = Map.of("texts", texts);
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);

            // 3. AI 서버 URL 구성
            // 기존 aiProperties.getUrl() 대신 주입받은 sentimentAiUrl 사용
            String aiUrl = sentimentAiUrl;

            if (aiUrl == null || aiUrl.isEmpty()) {
                log.warn("AI 서버 URL(ai.sentiment.url)이 설정되지 않았습니다. 스택 증가 없이 진행합니다.");
                return 0;
            }

            // URL이 base URL만 있는 경우 엔드포인트 추가
            // http://ai-server:8000 -> http://ai-server:8000/api/v1/analyze/batch
            if (!aiUrl.contains("/analyze/batch")) {
                // 슬래시 중복 방지 처리
                String baseUrl = aiUrl.endsWith("/") ? aiUrl.substring(0, aiUrl.length() - 1) : aiUrl;
                aiUrl = baseUrl + "/api/v1/analyze/batch";
            }

            log.debug("AI 서버 호출: {} with {} texts", aiUrl, texts.size());

            // 4. API 호출
            ResponseEntity<String> response = restTemplate.exchange(
                    URI.create(aiUrl),
                    HttpMethod.POST,
                    entity,
                    String.class
            );

            // 5. 응답 파싱
            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                JsonNode root = objectMapper.readTree(response.getBody());
                int totalStackDelta = root.path("total_stack_delta").asInt(0);
                int negativeCount = root.path("negative_count").asInt(0);

                log.info("AI 분석 완료: {} 개 부정어 감지, 스택 증가량: {}", negativeCount, totalStackDelta);
                return totalStackDelta;
            } else {
                log.error("AI 서버 응답 오류: {}", response.getStatusCode());
                return 0;
            }

        } catch (Exception e) {
            log.error("AI 서버 호출 실패: {}", e.getMessage());
            // AI 서버 실패 시에도 게임은 계속 진행되도록 0 반환
            return 0;
        }
    }
}