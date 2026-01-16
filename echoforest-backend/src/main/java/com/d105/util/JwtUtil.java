package com.d105.util;

import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;
import org.springframework.stereotype.Component;

import java.util.Date;

@Component
public class JwtUtil {
    // 실제로는 application.properties에서 관리해야 함
    private static final String SECRET_KEY = "my_super_secret_key_echo_forest";
    private static final long ACCESS_TIME = 60 * 60 * 1000L; // 1시간

    // 토큰 생성 (로그인 성공 시)
    public String createToken(Long userId, String loginId) {
        return JWT.create()
                .withSubject(loginId) // 토큰 제목 (아이디)
                .withClaim("userId", userId) // PK값도 넣어둠
                .withExpiresAt(new Date(System.currentTimeMillis() + ACCESS_TIME)) // 만료 시간
                .sign(Algorithm.HMAC256(SECRET_KEY)); // 서명
    }

    ///  추후 검증 로직 추가시 주석 해제
    // 1. 토큰에서 아이디(Claim) 꺼내기
    public String getLoginId(String token) {
        return JWT.require(Algorithm.HMAC256(SECRET_KEY))
                .build().verify(token)
                .getSubject();
    }

    // 2. 토큰이 유효한지 검사하기 (위조 여부, 만료 여부)
    public boolean validateToken(String token) {
        try {
            JWT.require(Algorithm.HMAC256(SECRET_KEY)).build().verify(token);
            return true;
        } catch (Exception e) {
            return false; // 유효하지 않음
        }
    }
}