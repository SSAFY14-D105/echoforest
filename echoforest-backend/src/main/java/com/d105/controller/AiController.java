package com.d105.controller;

import com.d105.dto.image.AiGenerationReqDto;
import com.d105.service.AiGenerationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@Slf4j
@Tag(name = "AI", description = "AI 이미지 생성 API")
@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
public class AiController {

    private final AiGenerationService aiGenerationService;

    @Operation(summary = "AI 이미지 생성", description = "여러 장의 이미지를 기반으로 AI가 새로운 이미지를 생성하여 저장합니다.")
    @PostMapping("/generate")
    public ResponseEntity<?> generateImage(@Valid @RequestBody AiGenerationReqDto req) {
        try {
            // Service 호출 (프롬프트는 사용자가 입력한 값을 그대로 전달하거나, 내부에서 가공)
            aiGenerationService.generateAndSaveImage(
                    req.getSourceImages(),
                    req.getPrompt(),
                    req.getRoomId(),
                    req.getUserId()
            );

            return ResponseEntity.ok(Map.of("message", "AI 이미지 생성 요청 성공"));

        } catch (Exception e) {
            log.error("AI Generation Error", e);
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "AI 이미지 생성 중 오류가 발생했습니다: " + e.getMessage()));
        }
    }
}