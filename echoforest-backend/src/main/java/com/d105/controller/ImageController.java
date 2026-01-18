package com.d105.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Tag(name = "Image Upload", description = "이미지 업로드 API")
@RestController
@RequestMapping("/api/images")
public class ImageController {

    @Value("${file.upload-dir:./uploads/}")
    private String uploadDir;

    @Operation(summary = "이미지 업로드", description = "이미지 파일을 업로드하고 접근 가능한 URL을 반환합니다.")
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, String>> uploadImage(@RequestParam("file") MultipartFile file) {
        try {
            // 1. 저장할 폴더가 없으면 생성
            File directory = new File(uploadDir);
            if (!directory.exists()) {
                directory.mkdirs();
            }

            // 2. 파일명 중복 방지를 위한 UUID 생성
            String originalFilename = file.getOriginalFilename();
            String extension = originalFilename != null && originalFilename.contains(".")
                    ? originalFilename.substring(originalFilename.lastIndexOf("."))
                    : ".png"; // 확장자가 없으면 기본 .png

            String savedFileName = UUID.randomUUID() + extension;
            Path filePath = Paths.get(uploadDir + savedFileName);

            // 3. 파일 저장
            Files.write(filePath, file.getBytes());

            // 4. 접근 URL 생성 (WebMvcConfig에서 매핑한 경로)
            // 예: /images/550e8400-e29b-41d4-a716-446655440000.png
            String fileUrl = "/images/" + savedFileName;

            log.info("Image uploaded successfully: {}", savedFileName);

            Map<String, String> response = new HashMap<>();
            response.put("url", fileUrl);

            return ResponseEntity.ok(response);

        } catch (IOException e) {
            log.error("Image upload failed", e);
            return ResponseEntity.internalServerError().body(Map.of("error", "이미지 업로드 실패"));
        }
    }
}