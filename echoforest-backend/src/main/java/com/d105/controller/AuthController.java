package com.d105.controller;

import com.d105.dto.auth.LoginReqDto;
import com.d105.dto.auth.SignUpReqDto;
import com.d105.service.AuthService;
import io.swagger.v3.oas.annotations.Operation;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @Operation(summary = "회원가입")
    @PostMapping("/signup")
    public ResponseEntity<?> signUp(@Valid @RequestBody SignUpReqDto req) {
        authService.signUp(req);
        return ResponseEntity.ok(Map.of("message", "회원가입 성공"));
    }

    @Operation(summary = "로그인 (JWT 토큰 + 닉네임 반환)")
    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginReqDto req) {
        // AuthService가 Map을 반환하도록 수정했다고 가정
        Map<String, String> result = authService.login(req);
        return ResponseEntity.ok(result);
    }

    @Operation(summary = "아이디 중복 확인 (true: 중복, false: 사용 가능)")
    @GetMapping("/check-id")
    public ResponseEntity<?> checkId(@RequestParam String loginId) {
        boolean exists = authService.checkIdDuplicate(loginId);
        return ResponseEntity.ok(Map.of("isDuplicate", exists));
    }
}