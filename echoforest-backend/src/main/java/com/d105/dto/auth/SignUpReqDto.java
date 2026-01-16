package com.d105.dto.auth;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class SignUpReqDto {

    @Schema(description = "로그인 아이디 (영문, 숫자 4~20자)", example = "ssafy123")
    @NotBlank(message = "아이디는 필수입니다.")
    @Size(min = 4, max = 20, message = "아이디는 4~20자여야 합니다.")
    @Pattern(regexp = "^[a-zA-Z0-9]*$", message = "아이디는 영문과 숫자만 가능합니다.")
    private String loginId;

    @Schema(description = "비밀번호 (8자 이상)", example = "password123!")
    @NotBlank(message = "비밀번호는 필수입니다.")
    @Size(min = 8, message = "비밀번호는 최소 8자 이상이어야 합니다.")
    private String password;

    @Schema(description = "닉네임", example = "김싸피")
    @NotBlank(message = "닉네임은 필수입니다.")
    private String nickname;

    @Schema(description = "이메일", example = "ssafy@ssafy.com")
    @NotBlank(message = "이메일은 필수입니다.")
    @Email(message = "올바른 이메일 형식이 아닙니다.")
    private String email;
}