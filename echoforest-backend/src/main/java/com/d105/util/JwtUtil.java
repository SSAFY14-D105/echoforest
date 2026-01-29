package com.d105.util;

import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.Date;

@Component
public class JwtUtil {

    // Jenkins 환경변수에서 주입 (application.properties 경유)
    @Value("${jwt.secret-key}")
    private String secretKey;

    @Value("${jwt.access-token-validity:86400000}")
    private long accessTokenValidity; // 기본값: 24시간 (밀리초)

    // 토큰 생성 (로그인 성공 시)
    public String createToken(Long userId, String username) {
        return JWT.create()
                .withSubject(username) // 토큰 제목 (아이디)
                .withClaim("userId", userId) // PK값도 넣어둠
                .withExpiresAt(new Date(System.currentTimeMillis() + accessTokenValidity)) // 만료 시간
                .sign(Algorithm.HMAC256(secretKey)); // 서명
    }

    // 1. 토큰에서 아이디(Claim) 꺼내기
    public String getUsername(String token) {
        return JWT.require(Algorithm.HMAC256(secretKey))
                .build().verify(token)
                .getSubject();
    }

    // 2. 토큰에서 userId(PK) 꺼내기
    public Long getUserId(String token) {
        return JWT.require(Algorithm.HMAC256(secretKey))
                .build().verify(token)
                .getClaim("userId").asLong();
    }

    // 2. 토큰이 유효한지 검사하기 (위조 여부, 만료 여부)
    public boolean validateToken(String token) {
        try {
            JWT.require(Algorithm.HMAC256(secretKey)).build().verify(token);
            return true;
        } catch (Exception e) {
            return false; // 유효하지 않음
        }
    }
}