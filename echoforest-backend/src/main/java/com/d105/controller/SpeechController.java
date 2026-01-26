package com.d105.controller;

import com.d105.dto.SpeechAnalysisResultDto;
import com.d105.service.GameService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@Slf4j
@Tag(name = "Speech", description = "음성 분석 결과 수신 API")
@RestController
@RequestMapping("/api/speech")
@RequiredArgsConstructor
public class SpeechController {

    private final GameService gameService;

    @Operation(summary = "부정어 분석 결과 수신", description = "AI 서버로부터 분석된 부정어 스택 증가량을 수신합니다.")
    @PostMapping("/analysis")
    public ResponseEntity<?> receiveAnalysisResult(@RequestBody SpeechAnalysisResultDto dto) {
        log.info("Received Speech Analysis: {}", dto);
        try {
            gameService.handleSpeechAnalysis(dto);
            return ResponseEntity.ok(Map.of("message", "Success"));
        } catch (Exception e) {
            log.error("Speech Analysis Handling Error", e);
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }
}
