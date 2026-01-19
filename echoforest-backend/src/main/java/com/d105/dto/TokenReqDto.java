package com.d105.dto;

import com.fasterxml.jackson.annotation.JsonProperty; // 추가 필요
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class TokenReqDto {

    // 프론트엔드가 "roomName"으로 보내더라도 자바의 "roomId"에 매핑되도록 설정
    @Schema(description = "입장할 게임 방 번호", example = "room_1")
    @JsonProperty("roomName")
    private String roomId;

    @Schema(description = "유저 고유 ID", example = "user_1234")
    private String userId;

    @Schema(description = "닉네임", example = "철수")
    private String username;
}