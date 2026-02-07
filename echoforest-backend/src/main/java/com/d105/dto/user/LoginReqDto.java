package com.d105.dto.user;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

@Data
public class LoginReqDto {
    @Schema(example = "ssafy123")
    private String username;
    @Schema(example = "password123!")
    private String password;
}