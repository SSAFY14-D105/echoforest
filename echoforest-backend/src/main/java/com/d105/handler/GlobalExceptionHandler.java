package com.d105.handler;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    // "이미 사용 중인 닉네임입니다" 같은 에러를 잡아서
    // 500 대신 400(Bad Request)으로 바꿔주는 장치
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> handleIllegalArgumentException(IllegalArgumentException e) {
        return ResponseEntity
                .badRequest() // 400 에러 코드
                .body(Map.of("error", e.getMessage())); // 에러 메시지 그대로 전송
    }
}