package com.d105.service;

import com.d105.dto.user.LoginReqDto;
import com.d105.entity.User;
import com.d105.repository.UserRepository;
import com.d105.util.JwtUtil;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private JwtUtil jwtUtil;

    @Mock
    private SessionService sessionService;

    @InjectMocks
    private UserService userService;

    @Test
    @DisplayName("로그인 성공 시 토큰, 닉네임이 반환되어야 한다")
    void login_Success() {
        // given
        String username = "testuser";
        String password = "password";
        String nickname = "testnick";
        Long userId = 100L;
        String token = "access-token";

        User user = User.builder()
                .username(username)
                .password("encodedPassword")
                .nickname(nickname)
                .email("test@example.com")
                .build();

        // Reflection to set ID since it's generated
        try {
            java.lang.reflect.Field idField = User.class.getDeclaredField("id");
            idField.setAccessible(true);
            idField.set(user, userId);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }

        given(userRepository.findByUsername(username)).willReturn(Optional.of(user));
        given(passwordEncoder.matches(password, user.getPassword())).willReturn(true);
        given(jwtUtil.createToken(userId, username)).willReturn(token);

        // Mocking DTO fields
        LoginReqDto loginReq = new LoginReqDto();
        try {
            java.lang.reflect.Field uField = LoginReqDto.class.getDeclaredField("username");
            uField.setAccessible(true);
            uField.set(loginReq, username);

            java.lang.reflect.Field pField = LoginReqDto.class.getDeclaredField("password");
            pField.setAccessible(true);
            pField.set(loginReq, password);
        } catch (Exception e) {
            // ignore
        }

        // when
        Map<String, String> result = userService.login(loginReq);

        // then
        assertThat(result).containsEntry("token", token);
        assertThat(result).containsEntry("nickname", nickname);
        // userId는 반환 Map에 없음 (프론트엔드 요구사항 변경 가능성)

        // sessionService.saveSession(username, token) 호출 검증
        verify(sessionService).saveSession(username, token);
    }

    @Test
    @DisplayName("닉네임 변경 성공")
    void updateNickname_Success() {
        // given
        String username = "testuser";
        String currentNickname = "oldNick";
        String newNickname = "newNick";

        User user = User.builder()
                .username(username)
                .nickname(currentNickname)
                .build();

        given(userRepository.findByUsername(username)).willReturn(Optional.of(user));
        given(userRepository.existsByNickname(newNickname)).willReturn(false);

        // when
        userService.updateNickname(username, newNickname);

        // then
        assertThat(user.getNickname()).isEqualTo(newNickname);
    }

    @Test
    @DisplayName("닉네임 변경 실패 - 중복된 닉네임")
    void updateNickname_Duplicate() {
        // given
        String username = "testuser";
        String currentNickname = "oldNick";
        String newNickname = "duplicateNick";

        User user = User.builder()
                .username(username)
                .nickname(currentNickname)
                .build();

        given(userRepository.findByUsername(username)).willReturn(Optional.of(user));
        // 내 닉네임이 아닌데 이미 존재하면 중복
        given(userRepository.existsByNickname(newNickname)).willReturn(true);

        // when & then
        org.junit.jupiter.api.Assertions.assertThrows(IllegalArgumentException.class, () -> {
            userService.updateNickname(username, newNickname);
        });
    }

    @Test
    @DisplayName("닉네임 변경 실패 - 존재하지 않는 유저")
    void updateNickname_UserNotFound() {
        // given
        String username = "unknownUser";
        given(userRepository.findByUsername(username)).willReturn(Optional.empty());

        // when & then
        org.junit.jupiter.api.Assertions.assertThrows(IllegalArgumentException.class, () -> {
            userService.updateNickname(username, "anyNick");
        });
    }
}
