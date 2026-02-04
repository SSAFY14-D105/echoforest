package com.d105.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
@Schema(description = "게임 웹소켓 통신용 메시지 규격")
public class GameMessageDto {
    @Schema(description = "메시지 타입", example = "JOIN", allowableValues = { "CREATE", "JOIN", "MOVE", "PING", "ERROR",
            "ROOM_CREATED", "PAUSE_GAME", "GAME_PAUSED", "RESUME_GAME", "GAME_RESUMED", "PLAYER_DISCONNECTED",
            "CURSE_STACK_UPDATE", "CURSE_TRIGGERED", "LIFT_CURSE_REQUEST", "CURSE_LIFTED", "ITEM_COLLECTED",
            "ITEM_REMOVED" })
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

    // ===== STT 저주 시스템용 필드 =====

    @Schema(description = "SPEECH_BATCH: 발화 텍스트 목록")
    private List<String> texts;

    @Schema(description = "CURSE_RELEASE: 긍정어 (뽀뽀/사랑해/좋아해)")
    private String word;

    @Schema(description = "STACK_UPDATED: 현재 저주 스택 값", example = "7")
    private Integer stack;

    @Schema(description = "STACK_UPDATED: 스택 변화량", example = "3")
    private Integer delta;

    @Schema(description = "STACK_UPDATED: 변화 사유", example = "negative_word")
    private String reason;

    @Schema(description = "CURSE_TRIGGERED: 저주 대상 플레이어", example = "UserB")
    private String cursedPlayerId;

    @Schema(description = "CURSE_RELEASED: 저주 해제된 플레이어")
    private String releasedPlayerId;

    @Schema(description = "CURSE_TRIGGERED: 현재 맵 ID", example = "1")
    private Integer mapId;

    // ===== Player State Sync (Client-Authoritative) =====
    @Schema(description = "플레이어 사망 여부")
    private Boolean isDead;

    @Schema(description = "플레이어 숨김 여부 (골인 등)")
    private Boolean isHidden; // [NEW] 필드 추가

    @Schema(description = "현재 적용된 저주 목록 (Visual Sync)")
    private List<String> curses;

    @Schema(description = "아이템 ID (Mushroom 등)", example = "1")
    private String itemId; // [NEW] 아이템 동기화용

    // ===== 독버섯 저주용 필드 =====
    @Schema(description = "MUSHROOM_CURSE: 저주 대상 플레이어 ID")
    private String playerId;

    @Schema(description = "MUSHROOM_CURSE: 저주 종류 (giant/drain/reverse)", example = "giant")
    private String curseId;
}