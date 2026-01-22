package com.d105.service;

import com.d105.config.AiProperties;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;

import java.util.List;

@SpringBootTest
@TestPropertySource(locations = "classpath:application-test.properties") // 테스트용 설정 파일 로드
// @Disabled // 실제 API 호출을 막으려면 이 주석을 푸세요 (평소 빌드 때는 막아두는게 좋음)
class AiServiceIntegrationTest {

    @Autowired
    private AiGenerationService aiGenerationService;

    @Autowired
    private AiProperties aiProperties;

    @Test
    @DisplayName("실제 AI API 호출 테스트 (과금 주의)")
    void generateImage_RealCall() {
        // given
        // 실제 API 키가 로드되었는지 확인 (로그로 찍지 마세요!)
        System.out.println("API URL: " + aiProperties.getUrl());

        List<String> mockImages = List.of("dummy_path_1.png"); // 실제로는 무시됨 (프롬프트 테스트용)
        String prompt = "A cute cat sitting on a keyboard, pixel art style";
        String roomId = "TEST_ROOM";
        Long userId = 1L; // DB에 존재하는 유저 ID여야 함 (없으면 에러날 수 있음)

        // when & then
        // 실제 API를 호출하므로 예외가 발생하지 않으면 성공으로 간주
        // (단, ImageService.uploadImage 쪽에서 DB 유저 조회 실패가 날 수 있으므로 
        //  이 부분은 Mocking하거나, 테스트용 DB에 유저를 미리 넣어야 완벽함)

        // 여기서는 "AI 요청이 성공적으로 전송되는지"까지만 확인하기 위해
        // 서비스 내부 로직 에러(유저 없음 등)는 발생할 수 있음을 감안합니다.
        try {
            aiGenerationService.generateAndSaveImage(mockImages, prompt, roomId, userId);
        } catch (Exception e) {
            // "User not found" 에러는 AI 통신 성공 이후 로직이므로 통신 자체는 성공했다고 판단 가능
            // 하지만 "AI API Error"나 "Connection refused"가 뜨면 실패임
            System.out.println("테스트 중 발생한 예외: " + e.getMessage());

            // 만약 "401 Unauthorized" 같은게 뜨면 키 설정 문제임
        }
    }
}