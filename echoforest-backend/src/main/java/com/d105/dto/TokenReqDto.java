package com.d105.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class TokenReqDto {

    @Schema(description = "입장할 게임 방 번호 (LiveKit 방 이름으로 사용됨)", example = "room_1")
    private String roomId;

    @Schema(description = "유저 고유 ID", example = "user_1234")
    private String userId;

    @Schema(description = "닉네임", example = "철수")
    private String username;
}