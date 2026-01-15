package com.d105.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class TokenReqDto {
    // 입장할 방 이름 (예: "game-room-1")
    private String roomName;

    // 유저 고유 ID (DB의 PK 또는 UUID)
    private String userId;

    // 게임에서 표시될 닉네임
    private String username;
}