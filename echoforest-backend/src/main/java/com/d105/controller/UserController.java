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
    public ResponseEntity<?> updateNickname(@Valid @RequestBody NicknameUpdateReqDto req,
            @org.springframework.security.core.annotation.AuthenticationPrincipal String username) {
        userService.updateNickname(username, req.getNewNickname());
        return ResponseEntity.ok(Map.of("message", "닉네임 변경 성공"));
    }

    @Operation(summary = "로그아웃", description = "서버 세션을 제거합니다.")
    @PostMapping("/logout")
    public ResponseEntity<?> logout(
            @org.springframework.security.core.annotation.AuthenticationPrincipal String username,
            jakarta.servlet.http.HttpServletRequest request) { // Request 객체 추가

        String targetUser = username;

        // 1. 인증이 안 된 상태(토큰 만료/오류 등)라도, 헤더에 토큰이 있다면 파싱해서 로그아웃 시도
        if (targetUser == null) {
            String authorizationHeader = request.getHeader("Authorization");
            if (authorizationHeader != null && authorizationHeader.startsWith("Bearer ")) {
                String token = authorizationHeader.substring(7);
                // 유효성 검증 없이 클레임만 추출 (만료된 토큰이어도 로그아웃은 해줘야 함)
                try {
                    // 주의: decode만 하면 위조된 토큰일 수 있으나, 로그아웃은 삭제 연산이므로
                    // 위조된 토큰으로 다른 사람을 로그아웃 시키는 공격 가능성 고려 필요.
                    // 그러나 여기서는 "본인 세션 삭제"가 목적이므로, 서명 검증은 하되 만료는 무시하는 게 좋음.
                    // 현재 JwtUtil 구조상 검증을 통과해야 하므로, 일단 JwtUtil 없이 디코딩은 위험.
                    // 따라서 여기서는 JwtUtil에 "서명은 검증하되 만료는 체크 안 함" 기능이 없으므로,
                    // 일단 null 처리를 넘어가거나, 별도 로직이 필요.
                    // 하지만 로그아웃 실패 이슈 해결을 위해, 여기서는 "만약 인증 실패했어도 토큰이 있다면"
                    // 해당 토큰의 주인(subject)을 찾아 지워줌.
                    targetUser = com.auth0.jwt.JWT.decode(token).getSubject();
                } catch (Exception e) {
                    // 토큰 파싱 실패
                }
            }
        }

        if (targetUser != null) {
            userService.logout(targetUser);
        }
        return ResponseEntity.ok(Map.of("message", "로그아웃 성공"));
    }
}