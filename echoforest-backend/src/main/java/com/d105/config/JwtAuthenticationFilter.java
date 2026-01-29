package com.d105.config;

import com.d105.service.SessionService;
import com.d105.util.JwtUtil;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Collections;

/**
 * JWT 인증 필터
 * - 모든 요청에서 JWT 토큰 검증
 * - Redis 세션과 비교하여 중복 로그인 감지
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtUtil jwtUtil;
    private final SessionService sessionService;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        // 1. 헤더에서 토큰 추출
        String authorizationHeader = request.getHeader("Authorization");

        // 2. 토큰이 있고, "Bearer "로 시작하는지 확인
        if (authorizationHeader != null && authorizationHeader.startsWith("Bearer ")) {
            String token = authorizationHeader.substring(7); // "Bearer " 제거

            try {
                // 3. 토큰 유효성 검사 (서명, 만료)
                if (jwtUtil.validateToken(token)) {
                    Long userId = jwtUtil.getUserId(token);
                    String username = jwtUtil.getUsername(token);

                    // 4. Redis 세션 검증 (중복 로그인 체크)
                    if (!sessionService.isValidSession(userId, token)) {
                        // 다른 기기에서 로그인됨 → 401 반환
                        log.warn("Session invalidated for user {} - logged in from another device. Request URI: {}",
                                username, request.getRequestURI());
                        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                        response.setContentType("application/json;charset=UTF-8");
                        response.getWriter().write("{\"error\":\"SESSION_EXPIRED\",\"message\":\"다른 기기에서 로그인되었습니다.\"}");
                        return;
                    }

                    // 5. 인증 성공 - SecurityContext에 등록
                    Authentication auth = new UsernamePasswordAuthenticationToken(username, null,
                            Collections.emptyList());
                    SecurityContextHolder.getContext().setAuthentication(auth);
                }
            } catch (Exception e) {
                log.debug("Token validation failed: {}", e.getMessage());
                // 토큰 파싱 오류 시 그냥 통과 (permitAll 엔드포인트 처리용)
            }
        }

        // 6. 다음 필터로 넘기기
        filterChain.doFilter(request, response);
    }
}