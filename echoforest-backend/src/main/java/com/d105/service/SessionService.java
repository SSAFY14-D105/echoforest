package com.d105.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.util.concurrent.TimeUnit;

/**
 * 세션 관리 서비스
 * - 사용자별 활성 토큰을 Redis에 저장
 * - 중복 로그인 방지 (새 로그인 시 기존 토큰 무효화)
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class SessionService {

    private final RedisTemplate<String, String> redisTemplate;

    // Redis 키 접두사
    private static final String SESSION_KEY_PREFIX = "user:session:";

    // 세션 유효 시간 (24시간 - JWT 만료 시간과 일치)
    private static final long SESSION_TTL_HOURS = 24;

    /**
     * 사용자 세션(토큰) 저장
     * - 기존 토큰이 있으면 덮어씀 (기존 세션 자동 무효화)
     * 
     * @param userId 사용자 ID (PK)
     * @param token  JWT 토큰
     */
    public void saveSession(Long userId, String token) {
        String key = SESSION_KEY_PREFIX + userId;
        redisTemplate.opsForValue().set(key, token, SESSION_TTL_HOURS, TimeUnit.HOURS);
        log.info("Session saved for user {}", userId);
    }

    /**
     * 현재 저장된 토큰 조회
     * 
     * @param userId 사용자 ID (PK)
     * @return 저장된 토큰, 없으면 null
     */
    public String getActiveToken(Long userId) {
        String key = SESSION_KEY_PREFIX + userId;
        return redisTemplate.opsForValue().get(key);
    }

    /**
     * 토큰 유효성 검증
     * - Redis에 저장된 토큰과 일치하는지 확인
     * 
     * @param userId 사용자 ID (PK)
     * @param token  검증할 토큰
     * @return true = 유효(일치), false = 무효(불일치 또는 없음)
     */
    public boolean isValidSession(Long userId, String token) {
        String activeToken = getActiveToken(userId);
        if (activeToken == null) {
            log.debug("No active session for user {}", userId);
            return false;
        }
        boolean isValid = activeToken.equals(token);
        if (!isValid) {
            log.info("Session invalidated for user {} (token mismatch)", userId);
        }
        return isValid;
    }

    /**
     * 세션 삭제 (로그아웃 시)
     * 
     * @param userId 사용자 ID (PK)
     */
    public void removeSession(Long userId) {
        String key = SESSION_KEY_PREFIX + userId;
        redisTemplate.delete(key);
        log.info("Session removed for user {}", userId);
    }
}
