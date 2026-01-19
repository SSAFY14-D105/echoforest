package com.d105.service;

import com.d105.dto.auth.LoginReqDto;
import com.d105.dto.auth.SignUpReqDto;
import com.d105.entity.User;
import com.d105.repository.UserRepository;
import com.d105.util.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;

    // 회원가입
    @Transactional
    public Long signUp(SignUpReqDto req) {
        if (userRepository.existsByLoginId(req.getLoginId())) {
            throw new IllegalArgumentException("이미 사용 중인 아이디입니다.");
        }
        if (userRepository.existsByNickname(req.getNickname())) {
            throw new IllegalArgumentException("이미 사용 중인 닉네임입니다.");
        }

        String encodedPassword = passwordEncoder.encode(req.getPassword());

        User user = User.builder()
                .loginId(req.getLoginId())
                .password(encodedPassword)
                .nickname(req.getNickname())
                .email(req.getEmail())
                .build();

        return userRepository.save(user).getId();
    }

    // 로그인
    public Map<String, String> login(LoginReqDto req) {
        User user = userRepository.findByLoginId(req.getLoginId())
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 아이디입니다."));

        if (!passwordEncoder.matches(req.getPassword(), user.getPassword())) {
            throw new IllegalArgumentException("비밀번호가 일치하지 않습니다.");
        }

        String token = jwtUtil.createToken(user.getId(), user.getLoginId());

        return Map.of(
                "token", token,
                "nickname", user.getNickname()
        );
    }

    // 아이디 중복 확인
    public boolean checkIdDuplicate(String loginId) {
        return userRepository.existsByLoginId(loginId);
    }
}