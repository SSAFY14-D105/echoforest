package com.d105.controller;

import com.d105.dto.image.AiGenerationReqDto;
import com.d105.dto.image.ImageResponseDto;
import com.d105.service.AiGenerationService;
import com.d105.service.ImageService;
import com.d105.entity.Image;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@Tag(name = "AI", description = "AI 이미지 생성 및 조회 API")
@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
public class AiController {

    private final AiGenerationService aiGenerationService;
    private final ImageService imageService;

    @Operation(summary = "AI 이미지 생성 (실제 게임용)", description = "DB에 저장된 유저별 사진을 사용하여 AI 합성 이미지를 생성하고 이메일로 전송합니다.")
    @PostMapping("/generate")
    public ResponseEntity<?> generateImage(@Valid @RequestBody AiGenerationReqDto req) {
        try {
            ImageResponseDto generatedImage = aiGenerationService.generateAndSaveImage(
                    req.getSourceImages(),
                    req.getPrompt(),
                    req.getRoomId(),
                    req.getUserId()
            );
            return ResponseEntity.ok(generatedImage);
        } catch (Exception e) {
            log.error("AI Generation Error", e);
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "AI 이미지 생성 중 오류: " + e.getMessage()));
        }
    }

    @Operation(summary = "AI 이미지 생성 테스트 (파일 직접 업로드)",
            description = "이미지 4개를 직접 업로드하여 합성을 테스트합니다. 결과는 'RESULT' 타입으로 저장되고 이메일로 전송됩니다.")
    @PostMapping(value = "/test/generate", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> testGenerateImage(
            @Parameter(description = "합성할 이미지 파일들 (최대 4개)")
            @RequestPart("files") List<MultipartFile> files,

            @Parameter(description = "추가 프롬프트")
            @RequestParam(value = "prompt", required = false) String prompt,

            @Parameter(description = "요청 유저 ID (이메일 전송 대상)")
            @RequestParam("userId") Long userId
    ) {
        try {
            if (files.size() > 4) {
                return ResponseEntity.badRequest().body(Map.of("error", "파일은 최대 4개까지만 업로드 가능합니다."));
            }

            ImageResponseDto generatedImage = aiGenerationService.generateTestImage(
                    files,
                    prompt,
                    userId
            );
            return ResponseEntity.ok(generatedImage);

        } catch (Exception e) {
            log.error("Test Generation Error", e);
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "테스트 생성 중 오류: " + e.getMessage()));
        }
    }

    @Operation(summary = "AI 생성 이미지 목록 조회", description = "특정 방에서 생성된 AI 합성 이미지(RESULT 타입) 목록을 조회합니다.")
    @GetMapping("/room/{roomCode}")
    public ResponseEntity<List<ImageResponseDto>> getGeneratedImages(@PathVariable String roomCode) {
        List<Image> allImages = imageService.getRoomImages(roomCode);

        List<ImageResponseDto> resultImages = allImages.stream()
                .filter(img -> "RESULT".equals(img.getImageType())) // MOTION과 구분
                .map(ImageResponseDto::from)
                .collect(Collectors.toList());

        return ResponseEntity.ok(resultImages);
    }
}