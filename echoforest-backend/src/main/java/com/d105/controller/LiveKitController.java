package com.d105.controller;

import com.d105.dto.TokenReqDto;
import com.d105.dto.TokenResDto;
import com.d105.service.LiveKitService;
import io.swagger.v3.oas.annotations.Operation;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/livekit")
@RequiredArgsConstructor
public class LiveKitController {

    private final LiveKitService liveKitService;

    /**
     * 클라이언트의 토큰 요청 처리
     */
    @Operation(summary = "LiveKit 토큰 발급", description = "게임 방 번호(roomId)를 기반으로 화상 채팅 접속 토큰을 생성합니다.")
    @PostMapping("/token")
    public ResponseEntity<TokenResDto> getToken(@RequestBody TokenReqDto request) {

        String token = liveKitService.createToken(
                request.getRoomId(),
                request.getUserId(),
                request.getUsername()
        );

        // TokenResDto를 사용하여 응답 반환
        return ResponseEntity.ok(new TokenResDto(token));
    }
}