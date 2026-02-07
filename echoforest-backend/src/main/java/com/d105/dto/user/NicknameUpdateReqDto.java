package com.d105.dto.user;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class NicknameUpdateReqDto {
    @Schema(description = "유저 ID (PK)", example = "1")
    @NotNull(message = "유저 ID는 필수입니다.")
    private Long userId;

    @Schema(description = "변경할 새 닉네임", example = "새로운닉네임")
    @NotBlank(message = "변경할 닉네임은 필수입니다.")
    private String newNickname;
}