//package com.d105.config;
//
//import com.d105.util.JwtUtil;
//import jakarta.servlet.FilterChain;
//import jakarta.servlet.ServletException;
//import jakarta.servlet.http.HttpServletRequest;
//import jakarta.servlet.http.HttpServletResponse;
//import lombok.RequiredArgsConstructor;
//import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
//import org.springframework.security.core.Authentication;
//import org.springframework.security.core.context.SecurityContextHolder;
//import org.springframework.stereotype.Component;
//import org.springframework.web.filter.OncePerRequestFilter;
//
//import java.io.IOException;
//import java.util.Collections;
//
//@Component
//@RequiredArgsConstructor
//public class JwtAuthenticationFilter extends OncePerRequestFilter {
//
//    private final JwtUtil jwtUtil;
//
//    @Override
//    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain) throws ServletException, IOException {
//
//        // 1. 헤더에서 토큰 추출
//        String authorizationHeader = request.getHeader("Authorization");
//
//        // 2. 토큰이 있고, "Bearer "로 시작하는지 확인
//        if (authorizationHeader != null && authorizationHeader.startsWith("Bearer ")) {
//            String token = authorizationHeader.substring(7); // "Bearer " 제거
//
//            // 3. 토큰 유효성 검사
//            if (jwtUtil.validateToken(token)) {
//                String loginId = jwtUtil.getLoginId(token);
//
//                // 4. 통과! (임시 인증 객체 생성)
//                // 실제로는 DB에서 권한을 조회해야 하지만, 일단 단순하게 처리
//                Authentication user = new UsernamePasswordAuthenticationToken(loginId, null, Collections.emptyList());
//
//                // 5. 시큐리티 관제센터(Context)에 "이 사람 로그인함" 도장 찍기
//                SecurityContextHolder.getContext().setAuthentication(user);
//            }
//        }
//
//        // 6. 다음 필터로 넘기기
//        filterChain.doFilter(request, response);
//    }
//}