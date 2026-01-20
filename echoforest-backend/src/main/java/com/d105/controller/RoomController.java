package com.d105.controller;

import com.d105.dto.RoomInfoDto;
import com.d105.game.GameRoom;
import com.d105.repository.GameRepository;
import com.d105.service.RedisRoomService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Set;

/**
 * 방 관리 REST API
 */
@Slf4j
@RestController
@RequestMapping("/api/rooms")
@RequiredArgsConstructor
@Tag(name = "Room", description = "게임 방 관리 API")
public class RoomController {

    private static final int MAX_PLAYERS = 4;

    private final RedisRoomService redisRoomService;
    private final GameRepository gameRepository;

    /**
     * 방 정보 조회
     * - 입장 전 인원 수 확인 용
     */
    @GetMapping("/{roomId}")
    @Operation(summary = "방 정보 조회", description = "방 코드로 방 정보를 조회합니다 (인원 수, 상태 등)")
    public ResponseEntity<RoomInfoDto> getRoomInfo(@PathVariable String roomId) {
        // 방 존재 여부 확인
        if (!redisRoomService.roomExists(roomId)) {
            return ResponseEntity.notFound().build();
        }

        // 방 정보 조회
        RoomInfoDto roomInfo = redisRoomService.getRoomInfo(roomId);
        roomInfo.setMaxPlayers(MAX_PLAYERS);

        return ResponseEntity.ok(roomInfo);
    }

    /**
     * 내가 참가 중인 방 조회
     * - 재접속 시 기존 방으로 복귀 용
     */
    @GetMapping("/my")
    @Operation(summary = "내 방 조회", description = "현재 참가 중인 방 정보를 조회합니다 (재접속용)")
    public ResponseEntity<Map<String, Object>> getMyRoom(@RequestParam String userId) {
        String roomId = redisRoomService.getUserRoom(userId);

        if (roomId == null || !redisRoomService.roomExists(roomId)) {
            return ResponseEntity.ok(Map.of(
                    "inRoom", false,
                    "roomId", ""));
        }

        return ResponseEntity.ok(Map.of(
                "inRoom", true,
                "roomId", roomId));
    }

    /**
     * 강제 퇴장 (방장 전용)
     * - 방장이 특정 유저를 내보내기
     */
    @PostMapping("/{roomId}/kick")
    @Operation(summary = "강제 퇴장", description = "방장이 특정 유저를 방에서 내보냅니다")
    public ResponseEntity<Map<String, Object>> kickPlayer(
            @PathVariable String roomId,
            @RequestParam String hostId,
            @RequestParam String targetUserId) {

        // 방 존재 여부 확인
        if (!redisRoomService.roomExists(roomId)) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "message", "Room not found"));
        }

        // 방장 확인
        String actualHostId = redisRoomService.getHostId(roomId);
        if (actualHostId == null || !actualHostId.equals(hostId)) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "message", "Only host can kick players"));
        }

        // 자기 자신은 강퇴 불가
        if (hostId.equals(targetUserId)) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "message", "Cannot kick yourself"));
        }

        // 해당 유저가 방에 있는지 확인
        Set<String> players = redisRoomService.getPlayers(roomId);
        if (players == null || !players.contains(targetUserId)) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "message", "User not in room"));
        }

        // 강제 퇴장 처리
        redisRoomService.kickPlayer(roomId, targetUserId);

        // GameRoom에서도 제거하고 알림 전송
        GameRoom room = gameRepository.getRoom(roomId);
        if (room != null) {
            room.kickPlayer(targetUserId);
        }

        log.info("User {} kicked from room {} by host {}", targetUserId, roomId, hostId);

        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "User kicked successfully"));
    }
}
