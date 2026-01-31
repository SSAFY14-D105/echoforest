package com.d105.config;

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
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtUtil jwtUtil;
    private final com.d105.service.SessionService sessionService; // Inject

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
                    String username = jwtUtil.getUsername(token);

                    // [추가] Redis에 저장된 최신 토큰과 일치하는지 확인 (중복 로그인 방지)
                    String storedToken = sessionService.getSessionToken(username);
                    if (storedToken != null && storedToken.equals(token)) {
                        // 4. 인증 성공 - SecurityContext에 등록
                        Authentication auth = new UsernamePasswordAuthenticationToken(username, null,
                                Collections.emptyList());
                        SecurityContextHolder.getContext().setAuthentication(auth);
                    } else {
                        log.warn("Token mismatch or session expired for user: {}", username);
                        // 토큰은 유효하지만 Redis 세션과 다르면(오래된 토큰) 인증 안 해줌 -> 401/403
                    }
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