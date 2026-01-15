package com.d105.controller;

import com.d105.dto.TokenReqDto;
import com.d105.dto.TokenResDto;
import com.d105.service.LiveKitService;
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
    @PostMapping("/token")
    public ResponseEntity<TokenResDto> getToken(@RequestBody TokenReqDto request) {

        // Service의 메서드 이름이 'createToken'인지 확인해주세요.
        String token = liveKitService.createToken(
                request.getRoomName(),
                request.getUserId(),
                request.getUsername()
        );

        // TokenResDto를 사용하여 응답 반환 (Map 대신 사용 권장)
        return ResponseEntity.ok(new TokenResDto(token));
    }
}