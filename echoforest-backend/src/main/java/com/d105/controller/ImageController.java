package com.d105.controller;

import com.d105.dto.ImageResponseDto;
import com.d105.entity.Image;
import com.d105.service.ImageService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
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
}