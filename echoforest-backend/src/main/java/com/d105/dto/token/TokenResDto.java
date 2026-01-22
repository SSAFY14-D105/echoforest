package com.d105.dto.token;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class TokenResDto {
    // 생성된 LiveKit 접속용 JWT 토큰
    private String token;
}