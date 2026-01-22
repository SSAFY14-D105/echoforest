package com.d105.service;

import com.d105.dto.user.LoginReqDto;
import com.d105.dto.user.SignUpReqDto;
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
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;

    // 회원가입
    @Transactional
    public Long signUp(SignUpReqDto req) {
        if (userRepository.existsByUsername(req.getUsername())) {
            throw new IllegalArgumentException("이미 사용 중인 아이디입니다.");
        }
        if (userRepository.existsByNickname(req.getNickname())) {
            throw new IllegalArgumentException("이미 사용 중인 닉네임입니다.");
        }

        String encodedPassword = passwordEncoder.encode(req.getPassword());

        User user = User.builder()
                .username(req.getUsername())
                .password(encodedPassword)
                .nickname(req.getNickname())
                .email(req.getEmail())
                .build();

        return userRepository.save(user).getId();
    }

    // 로그인
    public Map<String, String> login(LoginReqDto req) {
        // 1. 아이디로 유저 조회
        User user = userRepository.findByUsername(req.getUsername())
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 아이디입니다."));

        // 2. 비밀번호 검증
        if (!passwordEncoder.matches(req.getPassword(), user.getPassword())) {
            throw new IllegalArgumentException("비밀번호가 일치하지 않습니다.");
        }

        // 3. 토큰 생성
        String token = jwtUtil.createToken(user.getId(), user.getUsername());

        // 4. 토큰과 닉네임을 Map에 담아서 반환
        return Map.of(
                "token", token,
                "nickname", user.getNickname());
    }

    // 아이디 중복 확인
    public boolean checkIdDuplicate(String username) {
        return userRepository.existsByUsername(username);
    }

    // 닉네임 중복 확인
    public boolean checkNicknameDuplicate(String nickname) {
        return userRepository.existsByNickname(nickname);
    }


    // 닉네임 수정
    @Transactional
    public void updateNickname(Long userId, String newNickname) {
        // 1. 유저 조회
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 유저입니다."));

        // 2. 닉네임 중복 검사 (본인의 현재 닉네임과 같다면 통과)
        if (!user.getNickname().equals(newNickname) && userRepository.existsByNickname(newNickname)) {
            throw new IllegalArgumentException("이미 사용 중인 닉네임입니다.");
        }

        // 3. 변경 적용
        user.changeNickname(newNickname);
    }
}