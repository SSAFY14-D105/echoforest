package com.d105.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;

@Service
@RequiredArgsConstructor
@Slf4j
public class SessionService {

    private final RedisTemplate<String, String> redisTemplate;

    // 세션 만료 시간 (예: 30분) - JWT 만료 시간과 맞추거나 적절히 설정
    private static final Duration SESSION_TTL = Duration.ofMinutes(1440);
    private static final String SESSION_PREFIX = "login_session:";

    /**
     * 로그인 세션 저장 (이미 로그인 중이면 false 반환이 아니라, 비즈니스 로직에서 먼저 체크 후 호출됨)
     */
    public void saveSession(String username, String token) {
        String key = SESSION_PREFIX + username;
        redisTemplate.opsForValue().set(key, token, SESSION_TTL);
        log.info("Session saved for user: {}", username);
    }

    /**
     * 로그인 여부 확인
     */
    public boolean isLoggedIn(String username) {
        String key = SESSION_PREFIX + username;
        return Boolean.TRUE.equals(redisTemplate.hasKey(key));
    }

    /**
     * 저장된 토큰 조회
     */
    public String getSessionToken(String username) {
        String key = SESSION_PREFIX + username;
        return redisTemplate.opsForValue().get(key);
    }

    /**
     * 세션 삭제 (로그아웃)
     */
    public void removeSession(String username) {
        String key = SESSION_PREFIX + username;
        redisTemplate.delete(key);
        log.info("Session removed for user: {}", username);
    }
}
