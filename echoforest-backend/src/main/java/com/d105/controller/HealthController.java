package com.d105.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.sql.DataSource;
import java.sql.Connection;
import java.util.HashMap;
import java.util.Map;

@Tag(name = "Health Check", description = "서버 상태 점검 API")
@RestController
@RequestMapping("/api/health")
@RequiredArgsConstructor
public class HealthController {

    private final DataSource dataSource;
    private final StringRedisTemplate redisTemplate;

    @Operation(summary = "인프라 연결 상태 확인", description = "MySQL, Redis 연결 상태를 반환합니다.")
    @GetMapping
    public ResponseEntity<Map<String, String>> checkHealth() {
        Map<String, String> status = new HashMap<>();
        status.put("server", "UP");

        // 1. MySQL 연결 확인
        try (Connection connection = dataSource.getConnection()) {
            if (connection.isValid(1)) {
                status.put("database", "UP");
            } else {
                status.put("database", "DOWN (Timeout)");
            }
        } catch (Exception e) {
            status.put("database", "DOWN (" + e.getMessage() + ")");
        }

        // 2. Redis 연결 확인
        try {
            redisTemplate.opsForValue().set("health_check", "ok");
            String value = redisTemplate.opsForValue().get("health_check");
            if ("ok".equals(value)) {
                status.put("redis", "UP");
            } else {
                status.put("redis", "DOWN (Value mismatch)");
            }
        } catch (Exception e) {
            status.put("redis", "DOWN (" + e.getMessage() + ")");
        }

        return ResponseEntity.ok(status);
    }
}