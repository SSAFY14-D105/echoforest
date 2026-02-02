package com.d105.dto.image;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;

@Data
public class AiGenerationReqDto {

    @Schema(description = "합성할 원본 이미지 파일 경로 리스트 (예: 2024-05-20/abc.webp)", requiredMode = Schema.RequiredMode.REQUIRED)
    @NotEmpty(message = "원본 이미지는 최소 1장 이상이어야 합니다.")
    private List<String> sourceImages;

    @Schema(description = "저장될 방 코드", example = "ABC1234")
    @NotBlank(message = "방 코드는 필수입니다.")
    private String roomId;

    @Schema(description = "요청한 유저 ID", example = "1")
    @NotNull(message = "유저 ID는 필수입니다.")
    private Long userId;

    @Schema(description = "스테이지 번호 (선택)", example = "4")
    private Integer stageNumber;
}