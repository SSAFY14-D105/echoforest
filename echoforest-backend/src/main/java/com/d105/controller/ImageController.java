package com.d105.controller;

import com.d105.dto.image.ImageResponseDto;
import com.d105.entity.Image;
import com.d105.service.ImageService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@Tag(name = "Image", description = "이미지 업로드/조회 API")
@RestController
@RequestMapping("/api/images")
@RequiredArgsConstructor
public class ImageController {

    private final ImageService imageService;
    private final com.d105.service.EmailService emailService;
    private final com.d105.repository.UserRepository userRepository;

    /**
     * 이미지 업로드 (파일 + DB 저장)
     */
    @Operation(summary = "이미지 업로드", description = "이미지 파일을 업로드하고 DB에 저장합니다. participantUserIds는 함께 찍은 유저 ID 목록 (최대 3명)")
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> uploadImage(
            @RequestParam("file") MultipartFile file,
            @RequestParam Long userId,
            @RequestParam(required = false) Long mapId,
            @RequestParam(required = false) Integer stageNumber,
            @RequestParam(required = false) List<Long> participantUserIds,
            @RequestParam(required = false) String roomCode,
            @RequestParam(required = false, defaultValue = "MOTION") String imageType) {

        try {
            Image image = imageService.uploadImage(
                    file, userId, mapId, stageNumber, participantUserIds, roomCode, imageType);

            return ResponseEntity.ok(ImageResponseDto.from(image));

        } catch (IOException e) {
            log.error("Image upload failed", e);
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "이미지 업로드 실패"));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * 내 이미지 목록 조회
     */
    @Operation(summary = "내 이미지 목록", description = "내가 업로드한 이미지 목록을 조회합니다.")
    @GetMapping("/my")
    public ResponseEntity<?> getMyImages(@RequestParam Long userId) {
        try {
            List<Image> images = imageService.getMyImages(userId);
            List<ImageResponseDto> response = images.stream()
                    .map(ImageResponseDto::from)
                    .collect(Collectors.toList());
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * 특정 방의 이미지 목록 조회
     */
    @Operation(summary = "방 이미지 목록", description = "특정 방에서 찍힌 이미지 목록을 조회합니다.")
    @GetMapping("/room/{roomCode}")
    public ResponseEntity<List<ImageResponseDto>> getRoomImages(@PathVariable String roomCode) {
        List<Image> images = imageService.getRoomImages(roomCode);
        List<ImageResponseDto> response = images.stream()
                .map(ImageResponseDto::from)
                .collect(Collectors.toList());
        return ResponseEntity.ok(response);
    }

    /**
     * 이미지 삭제
     */
    @Operation(summary = "이미지 삭제", description = "본인의 이미지를 삭제합니다.")
    @DeleteMapping("/{imageId}")
    public ResponseEntity<?> deleteImage(
            @PathVariable Long imageId,
            @RequestParam Long userId) {
        try {
            imageService.deleteImage(imageId, userId);
            return ResponseEntity.ok(Map.of("message", "이미지 삭제 완료"));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * 이미지 다운로드
     */
    @Operation(summary = "이미지 다운로드", description = "imageId로 이미지를 다운로드합니다.")
    @GetMapping("/download/{imageId}")
    public ResponseEntity<Resource> downloadImage(@PathVariable Long imageId) {
        Resource resource = imageService.downloadImage(imageId);

        // 파일명 추출 (URL 인코딩 처리 등은 생략, 기본 ASCII 혹은 브라우저 자동처리 의존)
        String fileName = resource.getFilename();
        if (fileName == null)
            fileName = "image.png";

        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + fileName + "\"")
                .body(resource);
    }

    /**
     * 이미지 이메일 전송 (다중 선택)
     */
    @Operation(summary = "이미지 이메일 전송", description = "선택한 이미지들을 이메일로 전송합니다.")
    @PostMapping("/email")
    public ResponseEntity<?> sendImagesToEmail(@RequestBody com.d105.dto.image.EmailImagesReqDto req) {
        try {
            Long userId = req.getUserId();
            List<Long> imageIds = req.getImageIds();

            if (userId == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "유저 ID가 필요합니다."));
            }

            // 유저 조회 및 이메일 가져오기
            com.d105.entity.User user = userRepository.findById(userId)
                    .orElseThrow(() -> new IllegalArgumentException("User not found"));
            String email = user.getEmail();

            if (email == null || email.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("error", "등록된 이메일이 없습니다."));
            }

            if (imageIds == null || imageIds.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("error", "이미지를 선택해주세요."));
            }

            List<Image> images = imageService.getImagesByIds(imageIds, userId);
            if (images.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("error", "전송할 유효한 이미지가 없습니다."));
            }

            Map<String, byte[]> attachments = new java.util.HashMap<>();
            for (Image img : images) {
                try {
                    Resource resource = imageService.downloadImage(img.getId());
                    if (resource != null && resource.exists()) {
                        attachments.put(img.getFileName(), resource.getContentAsByteArray());
                    }
                } catch (Exception e) {
                    log.error("Failed to read image file: {}", img.getFileName(), e);
                    // 실패한 이미지는 제외하고 계속 진행
                }
            }

            if (attachments.isEmpty()) {
                return ResponseEntity.internalServerError().body(Map.of("error", "이미지 파일을 읽을 수 없습니다."));
            }

            String subject = "[메아리의 숲] 추억이 도착했습니다 🌲";
            String text = "<h1>메아리의 숲에서 보낸 추억들</h1><p>당신의 소중한 순간들을 첨부파일로 보내드립니다.</p>";

            emailService.sendEmailWithImages(email, subject, text, attachments);

            return ResponseEntity.ok(Map.of("message", "이메일이 발송되었습니다. (총 " + attachments.size() + "장)"));

        } catch (Exception e) {
            log.error("Failed to send email", e);
            return ResponseEntity.internalServerError().body(Map.of("error", "이메일 전송 중 오류가 발생했습니다: " + e.getMessage()));
        }
    }
}