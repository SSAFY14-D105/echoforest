package com.d105.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import java.util.List;

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
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .formLogin(AbstractHttpConfigurer::disable) // 기본 로그인 폼 끄기
                .httpBasic(AbstractHttpConfigurer::disable) // HTTP Basic 인증 끄기
                .authorizeHttpRequests(auth -> auth
                        // 로그인, 회원가입, Swagger는 누구나 접근 가능
                        .requestMatchers("/api/auth/**", "/swagger-ui/**", "/v3/api-docs/**", "/ws/**", "/api/rooms/**",
                                "/api/images/**", "/error")
                        .permitAll()
                        // 그 외 모든 요청은 인증 필요 (나중에 JWT 필터 추가 예정)
                        .anyRequest().permitAll() // ⚠️ 개발 단계라 일단 모두 허용 (추후 .authenticated()로 변경)
                );

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();

        // 1. 허용할 도메인 목록 (개발용 + 배포용 미리 추가)
        configuration.setAllowedOrigins(List.of(
                "http://localhost:5173", // 프론트엔드 로컬
                "http://localhost:5174", // 프론트엔드 로컬 (포트 바뀔 경우 대비)
                "https://i14d105.p.ssafy.io", // ⭐ 실제 배포 도메인 (HTTPS)
                "http://i14d105.p.ssafy.io" // (혹시 모를 HTTP)
        ));

        // 2. 허용할 메서드 (OPTIONS 필수)
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));

        // 3. 허용할 헤더
        configuration.setAllowedHeaders(List.of("*"));

        // 4. 자격 증명 허용 (로그인 시 쿠키/헤더 전송을 위해 필수)
        configuration.setAllowCredentials(true);

        // 5. 설정 적용 경로
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }
}

/*
 * ============================================================================
 * [미래의 SecurityConfig] JWT 필터 구현 후, 위 코드를 지우고 아래 주석을 해제하여 사용하세요.
 * ============================================================================
 * 
 * package com.d105.config;
 * 
 * // [IMPORT 주의] JwtAuthenticationFsilter를 만든 후 경로에 맞게 임포트해야 합니다.
 * // import com.d105.jwt.JwtAuthenticationFilter;
 * import lombok.RequiredArgsConstructor;
 * import org.springframework.context.annotation.Bean;
 * import org.springframework.context.annotation.Configuration;
 * import
 * org.springframework.security.config.annotation.web.builders.HttpSecurity;
 * import org.springframework.security.config.annotation.web.configuration.
 * EnableWebSecurity;
 * import org.springframework.security.config.annotation.web.configurers.
 * AbstractHttpConfigurer;
 * import org.springframework.security.config.http.SessionCreationPolicy;
 * import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
 * import org.springframework.security.crypto.password.PasswordEncoder;
 * import org.springframework.security.web.SecurityFilterChain;
 * import org.springframework.security.web.authentication.
 * UsernamePasswordAuthenticationFilter;
 * 
 * @Configuration
 * 
 * @EnableWebSecurity
 * 
 * @RequiredArgsConstructor // [변경됨] final 필드(JwtFilter) 주입을 위해 필요
 * public class SecurityConfig {
 * 
 * // [추가됨] 나중에 만들 JwtAuthenticationFilter 주입
 * // private final JwtAuthenticationFilter jwtAuthenticationFilter;
 * 
 * @Bean
 * public PasswordEncoder passwordEncoder() {
 * return new BCryptPasswordEncoder();
 * }
 * 
 * @Bean
 * public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
 * http
 * .csrf(AbstractHttpConfigurer::disable)
 * .cors(AbstractHttpConfigurer::disable)
 * .formLogin(AbstractHttpConfigurer::disable)
 * .httpBasic(AbstractHttpConfigurer::disable)
 * 
 * // [추가됨] 중요: JWT는 세션을 안 쓰므로 STATELESS로 설정해야 함
 * .sessionManagement(session ->
 * session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
 * 
 * .authorizeHttpRequests(auth -> auth
 * // 1. 허용할 경로들 (로그인, 회원가입, Swagger, 웹소켓 등)
 * .requestMatchers(
 * "/api/auth/**",
 * "/swagger-ui/**",
 * "/v3/api-docs/**",
 * "/ws/**",
 * "/error"
 * ).permitAll()
 * 
 * // 2. [변경됨] 나머지 모든 요청은 인증된(Token 가진) 사람만 접근 가능
 * .anyRequest().authenticated()
 * );
 * 
 * // [추가됨] JWT 필터를 "ID/PW 검사 필터" 앞에 끼워 넣기
 * // http.addFilterBefore(jwtAuthenticationFilter,
 * UsernamePasswordAuthenticationFilter.class);
 * 
 * return http.build();
 * }
 * }
 */