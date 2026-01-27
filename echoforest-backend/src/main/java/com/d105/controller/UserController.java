package com.d105.controller;

import com.d105.dto.user.LoginReqDto;
import com.d105.dto.user.NicknameUpdateReqDto;
import com.d105.dto.user.SignUpReqDto;
import com.d105.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@Tag(name = "User", description = "회원 인증 API (회원가입, 로그인, 아이디 확인)")
@RestController
@RequestMapping("/api/user")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @Operation(summary = "회원가입")
    @PostMapping("/signup")
    public ResponseEntity<?> signUp(@Valid @RequestBody SignUpReqDto req) {
        userService.signUp(req);
        return ResponseEntity.ok(Map.of("message", "회원가입 성공"));
    }

    @Operation(summary = "로그인 (JWT 토큰 + 닉네임 반환)")
    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginReqDto req) {
        // AuthService에서 Map<String, String> 형태로 반환받음
        Map<String, String> result = userService.login(req);

        // 프론트엔드로 전송: {"token": "...", "nickname": "..."}
        return ResponseEntity.ok(result);
    }

    @Operation(summary = "아이디 중복 확인 (true: 중복, false: 사용 가능)")
    @GetMapping("/check-id")
    public ResponseEntity<?> checkId(@RequestParam String username) {
        boolean exists = userService.checkIdDuplicate(username);
        return ResponseEntity.ok(Map.of("isDuplicate", exists));
    }

    @Operation(summary = "닉네임 중복 확인 (true: 중복, false: 사용 가능)")
    @GetMapping("/check-nickname")
    public ResponseEntity<?> checkNickname(@RequestParam String nickname) {
        boolean exists = userService.checkNicknameDuplicate(nickname);
        return ResponseEntity.ok(Map.of("isDuplicate", exists));
    }

    @Operation(summary = "닉네임 수정", description = "로그인한 유저의 닉네임을 변경합니다.")
    @PutMapping("/nickname")
    public ResponseEntity<?> updateNickname(@Valid @RequestBody NicknameUpdateReqDto req) {
        userService.updateNickname(req.getUserId(), req.getNewNickname());
        return ResponseEntity.ok(Map.of("message", "닉네임 변경 성공"));
    }
}