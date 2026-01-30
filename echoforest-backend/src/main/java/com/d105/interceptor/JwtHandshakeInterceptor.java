package com.d105.interceptor;

import com.d105.util.JwtUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class JwtHandshakeInterceptor implements HandshakeInterceptor {

    private final JwtUtil jwtUtil;
    private final com.d105.service.SessionService sessionService; // [FIX] Redis 세션 검증 추가

    /**
     * 웹소켓 연결 전(Before Handshake)에 실행됩니다.
     * return true -> 연결 허용
     * return false -> 연결 거부 (401 Unauthorized 등)
     */
    @Override
    public boolean beforeHandshake(ServerHttpRequest request, ServerHttpResponse response,
            WebSocketHandler wsHandler, Map<String, Object> attributes) throws Exception {

        // 1. 토큰 추출 (헤더 또는 쿼리 파라미터)
        String token = extractToken(request);

        // 2. 토큰이 없거나 유효하지 않으면 거부
        if (token == null || !jwtUtil.validateToken(token)) {
            log.warn("[WebSocket Handshake Failed] Invalid or missing token");
            response.setStatusCode(HttpStatus.UNAUTHORIZED);
            return false;
        }

        // 3. 토큰에서 유저 정보(ID) 추출
        Long userId = jwtUtil.getUserId(token);
        String username = jwtUtil.getUsername(token);

        // 4. [FIX] Redis 세션 검증 (로그아웃된 토큰 거부)
        if (!sessionService.isValidSession(userId, token)) {
            log.warn("[WebSocket Handshake Failed] Session invalid or logged out for user: {}", username);
            response.setStatusCode(HttpStatus.UNAUTHORIZED);
            return false;
        }

        // 5. 웹소켓 세션(attributes)에 저장
        attributes.put("username", username);

        log.info("[WebSocket Handshake Success] User: {}", username);
        return true;
    }

    @Override
    public void afterHandshake(ServerHttpRequest request, ServerHttpResponse response,
            WebSocketHandler wsHandler, Exception exception) {
        // 핸드셰이크 이후 로직 (필요 없음)
    }

    // 토큰 추출 헬퍼 메서드
    private String extractToken(ServerHttpRequest request) {
        // 1. Authorization 헤더 확인 (Bearer Token)
        // Postman이나 백엔드 간 통신에서는 헤더 사용 가능
        String authHeader = request.getHeaders().getFirst("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            return authHeader.substring(7);
        }

        // 2. 쿼리 파라미터 확인 (ws://...?token=xyz)
        // 브라우저 기본 WebSocket 객체는 헤더 변경이 불가능하므로, 쿼리 파라미터를 많이 사용함
        if (request instanceof ServletServerHttpRequest servletRequest) {
            String queryToken = servletRequest.getServletRequest().getParameter("token");
            if (queryToken != null && !queryToken.isEmpty()) {
                return queryToken;
            }
        }

        return null;
    }
}
