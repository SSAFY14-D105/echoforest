package com.d105.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
@Schema(description = "게임 웹소켓 통신용 메시지 규격")
public class GameMessageDto {
    @Schema(description = "메시지 타입", example = "JOIN", allowableValues = { "CREATE", "JOIN", "MOVE", "PING", "ERROR",
            "ROOM_CREATED", "PAUSE_GAME", "GAME_PAUSED", "RESUME_GAME", "GAME_RESUMED", "PLAYER_DISCONNECTED",
            "CURSE_STACK_UPDATE", "CURSE_TRIGGERED", "LIFT_CURSE_REQUEST", "CURSE_LIFTED" })
    private String type;

    @Schema(description = "방 번호 (JOIN/MOVE 필수, CREATE는 선택)", example = "room_1")
    private String roomId;

    @Schema(description = "플레이어 이름", example = "UserA")
    private String username;

    @Schema(description = "X 좌표", example = "100.5")
    private Double x;

    @Schema(description = "Y 좌표", example = "200.0")
    private Double y;

    @Schema(description = "X축 속도", example = "2.5")
    private Double vx;

    @Schema(description = "Y축 속도", example = "-1.2")
    private Double vy;

    @Schema(description = "캐릭터 애니메이션 상태", example = "walk_down")
    private String anim;

    @Schema(description = "방장 여부", example = "true")
    private Boolean isHost;

    @Schema(description = "플레이어 슬롯 번호 (색상)", example = "0")
    private Integer colorIndex;

    @Schema(description = "시스템 메시지 내용 (생성된 방 번호, 에러 메시지 등)", example = "8F3A21")
    private String content;
}