package com.d105.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    // 비밀번호 암호화 기계 (BCrypt)
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                .csrf(AbstractHttpConfigurer::disable) // JWT 쓸 때는 CSRF 필요 없음
                .cors(AbstractHttpConfigurer::disable) // 일단 CORS 모두 허용 (개발 편의)
                .formLogin(AbstractHttpConfigurer::disable) // 기본 로그인 폼 끄기
                .httpBasic(AbstractHttpConfigurer::disable) // HTTP Basic 인증 끄기
                .authorizeHttpRequests(auth -> auth
                        // 로그인, 회원가입, Swagger는 누구나 접근 가능
                        .requestMatchers("/api/auth/**", "/swagger-ui/**", "/v3/api-docs/**", "/ws/**", "/error").permitAll()
                        // 그 외 모든 요청은 인증 필요 (나중에 JWT 필터 추가 예정)
                        .anyRequest().permitAll() // ⚠️ 개발 단계라 일단 모두 허용 (추후 .authenticated()로 변경)
                );

        return http.build();
    }
}


/*
 ============================================================================
 [미래의 SecurityConfig] JWT 필터 구현 후, 위 코드를 지우고 아래 주석을 해제하여 사용하세요.
 ============================================================================

package com.d105.config;

// [IMPORT 주의] JwtAuthenticationFilter를 만든 후 경로에 맞게 임포트해야 합니다.
// import com.d105.jwt.JwtAuthenticationFilter;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableWebSecurity
@RequiredArgsConstructor // [변경됨] final 필드(JwtFilter) 주입을 위해 필요
public class SecurityConfig {

    // [추가됨] 나중에 만들 JwtAuthenticationFilter 주입
    // private final JwtAuthenticationFilter jwtAuthenticationFilter;

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                .csrf(AbstractHttpConfigurer::disable)
                .cors(AbstractHttpConfigurer::disable)
                .formLogin(AbstractHttpConfigurer::disable)
                .httpBasic(AbstractHttpConfigurer::disable)

                // [추가됨] 중요: JWT는 세션을 안 쓰므로 STATELESS로 설정해야 함
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))

                .authorizeHttpRequests(auth -> auth
                        // 1. 허용할 경로들 (로그인, 회원가입, Swagger, 웹소켓 등)
                        .requestMatchers(
                                "/api/auth/**",
                                "/swagger-ui/**",
                                "/v3/api-docs/**",
                                "/ws/**",
                                "/error"
                        ).permitAll()

                        // 2. [변경됨] 나머지 모든 요청은 인증된(Token 가진) 사람만 접근 가능
                        .anyRequest().authenticated()
                );

        // [추가됨] JWT 필터를 "ID/PW 검사 필터" 앞에 끼워 넣기
        // http.addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
}
*/