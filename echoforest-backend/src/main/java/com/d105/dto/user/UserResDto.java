package com.d105.dto.user;

import com.d105.entity.User;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserResDto {
    private Long id;
    private String username;
    private String nickname;
    private String email;
    private Integer kissCount;
    private Integer curseCount;
    private BigDecimal mannerScore;

    public static UserResDto from(User user) {
        return UserResDto.builder()
                .id(user.getId())
                .username(user.getUsername())
                .nickname(user.getNickname())
                .email(user.getEmail())
                .kissCount(user.getKissCount())
                .curseCount(user.getCurseCount())
                .mannerScore(user.getMannerScore())
                .build();
    }
}
