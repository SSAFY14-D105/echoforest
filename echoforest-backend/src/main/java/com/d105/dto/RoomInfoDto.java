package com.d105.dto;

import lombok.Builder;
import lombok.Data;

import java.util.Set;

/**
 * 방 정보 조회 응답 DTO
 */
@Data
@Builder
public class RoomInfoDto {
    private String roomId;
    private String hostId;
    private String status;
    private int playerCount;
    private int maxPlayers;
    private Set<String> players;
    private Set<String> readyPlayers;
    private int currentStage;
}
