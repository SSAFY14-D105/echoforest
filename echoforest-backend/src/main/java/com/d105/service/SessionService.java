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
     * - [변경] Redis Set 구조를 사용하여 다중 로그인 허용
     * - 기존 토큰도 유지됨 (로그아웃되지 않음)
     * 
     * @param userId 사용자 ID (PK)
     * @param token  JWT 토큰
     */
    public void saveSession(Long userId, String token) {
        String key = SESSION_KEY_PREFIX + userId;
        // 1. Set에 토큰 추가
        redisTemplate.opsForSet().add(key, token);
        // 2. 만료 시간 갱신 (키 전체에 대해 적용)
        redisTemplate.expire(key, SESSION_TTL_HOURS, TimeUnit.HOURS);

        log.info("Session added for user {}. (Multiple login allowed)", userId);
    }

    /**
     * 현재 저장된 토큰 조회 (단일 조회 불가 -> 삭제됨)
     * 다중 세션 환경에서는 특정 토큰만 조회하는 것이 의미가 없으므로 제거하거나
     * 필요하다면 모든 토큰을 반환하도록 변경해야 함.
     * 현재 로직상 isValidSession만 중요하므로 제거함.
     */

    /**
     * 토큰 유효성 검증
     * - [변경] Redis Set에 해당 토큰이 존재하는지 확인
     * 
     * @param userId 사용자 ID (PK)
     * @param token  검증할 토큰
     * @return true = 유효(존재함), false = 무효(없음)
     */
    public boolean isValidSession(Long userId, String token) {
        String key = SESSION_KEY_PREFIX + userId;
        // Set에 멤버로 존재하는지 확인
        Boolean isMember = redisTemplate.opsForSet().isMember(key, token);

        if (Boolean.FALSE.equals(isMember)) {
            log.debug("Session invalid or expired for user {} (Token not found in active set)", userId);
            return false;
        }
        return true;
    }

    /**
     * 세션 삭제 (로그아웃 시)
     * - 해당 유저의 모든 세션(기기)을 로그아웃 처리
     * 
     * @param userId 사용자 ID (PK)
     */
    public void removeSession(Long userId) {
        String key = SESSION_KEY_PREFIX + userId;
        redisTemplate.delete(key);
        log.info("All sessions removed for user {} (Logout)", userId);
    }

    /**
     * (선택적) 특정 토큰만 로그아웃 하고 싶을 때 사용
     */
    public void removeSpecificToken(Long userId, String token) {
        String key = SESSION_KEY_PREFIX + userId;
        redisTemplate.opsForSet().remove(key, token);
    }
}
