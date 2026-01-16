package com.d105.service;

import com.d105.dto.auth.LoginReqDto;
import com.d105.dto.auth.SignUpReqDto;
import com.d105.entity.Member;
import com.d105.repository.MemberRepository;
import com.d105.util.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AuthService {

    private final MemberRepository memberRepository;
    private final PasswordEncoder passwordEncoder; // 암호화
    private final JwtUtil jwtUtil; // 토큰 발급기

    // 회원가입
    @Transactional
    public Long signUp(SignUpReqDto req) {
        // 1. 중복 검사
        if (memberRepository.existsByLoginId(req.getLoginId())) {
            throw new IllegalArgumentException("이미 사용 중인 아이디입니다.");
        }
        if (memberRepository.existsByNickname(req.getNickname())) {
            throw new IllegalArgumentException("이미 사용 중인 닉네임입니다.");
        }

        // 2. 비밀번호 암호화
        String encodedPassword = passwordEncoder.encode(req.getPassword());

        // 3. 저장
        Member member = Member.builder()
                .loginId(req.getLoginId())
                .password(encodedPassword)
                .nickname(req.getNickname())
                .email(req.getEmail())
                .build();

        return memberRepository.save(member).getId();
    }

    // 로그인
    public String login(LoginReqDto req) {
        // 1. 아이디 조회
        Member member = memberRepository.findByLoginId(req.getLoginId())
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 아이디입니다."));

        // 2. 비밀번호 일치 확인 (암호화된 것끼리 비교)
        if (!passwordEncoder.matches(req.getPassword(), member.getPassword())) {
            throw new IllegalArgumentException("비밀번호가 일치하지 않습니다.");
        }

        // 3. 토큰 발급 후 반환
        return jwtUtil.createToken(member.getId(), member.getLoginId());
    }

    // 아이디 중복 확인
    public boolean checkIdDuplicate(String loginId) {
        return memberRepository.existsByLoginId(loginId);
    }
}