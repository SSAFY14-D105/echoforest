package com.d105.service;

import com.d105.game.constant.RoomStatus;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.Set;
import java.util.UUID;

/**
 * Redis 기반 방 관리 서비스
 * - 방 생성/삭제
 * - 플레이어 입장/퇴장
 * - Ready 상태 관리
 * - 게임 내 통계 (뽀뽀/저주)
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RedisRoomService {

    // Redis 키 접두사
    private static final String ROOM_KEY = "room:";
    private static final String PLAYERS_SUFFIX = ":players";
    private static final String READY_SUFFIX = ":ready";
    private static final String KISS_SUFFIX = ":kiss";
    private static final String CURSE_SUFFIX = ":curse";
    private static final String USER_ROOM_KEY = "user:";
    // TTL 설정 (좀비 방 방지)
    private static final Duration ROOM_TTL = Duration.ofHours(2); // 대기 방 2시간
    private static final Duration GAME_TTL = Duration.ofHours(4); // 게임 중 4시간
    private static final Duration USER_ROOM_TTL = Duration.ofHours(2); // 유저-방 매핑 2시간

    private final UserService userService;
    private final RedisTemplate<String, String> redisTemplate;

    // =========================================================
    // 방 생성/삭제
    // =========================================================

    /**
     * 방 생성 (6자리 코드 반환)
     */
    public String createRoom(String hostId) {
        String roomId = generateRoomCode();

        // 방 정보 저장 (Hash)
        String roomKey = ROOM_KEY + roomId;
        redisTemplate.opsForHash().put(roomKey, "hostId", hostId);
        redisTemplate.opsForHash().put(roomKey, "status", RoomStatus.WAITING.name());
        redisTemplate.opsForHash().put(roomKey, "currentStage", "0");
        redisTemplate.opsForHash().put(roomKey, "createdAt", String.valueOf(System.currentTimeMillis()));

        // 방장을 players에 추가 (Ready는 하지 않음)
        String playersKey = ROOM_KEY + roomId + PLAYERS_SUFFIX;
        redisTemplate.opsForSet().add(playersKey, hostId);

        // 유저-방 매핑
        String userRoomKey = USER_ROOM_KEY + hostId + ":room";
        redisTemplate.opsForValue().set(userRoomKey, roomId);

        // TTL 설정 (좀비 방 방지)
        redisTemplate.expire(roomKey, ROOM_TTL);
        redisTemplate.expire(playersKey, ROOM_TTL);
        redisTemplate.expire(userRoomKey, USER_ROOM_TTL);

        log.info("Room created: {} by host: {} (TTL: {})", roomId, hostId, ROOM_TTL);
        return roomId;
    }

    /**
     * 방 삭제 (모든 관련 키 제거)
     */
    public void deleteRoom(String roomId) {
        redisTemplate.delete(ROOM_KEY + roomId);
        redisTemplate.delete(ROOM_KEY + roomId + PLAYERS_SUFFIX);
        redisTemplate.delete(ROOM_KEY + roomId + READY_SUFFIX);
        redisTemplate.delete(ROOM_KEY + roomId + KISS_SUFFIX);
        redisTemplate.delete(ROOM_KEY + roomId + CURSE_SUFFIX);
        log.info("Room deleted: {}", roomId);
    }

    /**
     * 방 존재 여부 확인
     */
    public boolean roomExists(String roomId) {
        return Boolean.TRUE.equals(redisTemplate.hasKey(ROOM_KEY + roomId));
    }

    /**
     * 6자리 대문자 방 코드 생성
     */
    private String generateRoomCode() {
        return UUID.randomUUID().toString().substring(0, 6).toUpperCase();
    }

    // =========================================================
    // 플레이어 입장/퇴장
    // =========================================================

    /**
     * 방 참가
     */
    public boolean joinRoom(String roomId, String userName) {
        if (!roomExists(roomId)) {
            return false;
        }

        // players에 추가
        redisTemplate.opsForSet().add(ROOM_KEY + roomId + PLAYERS_SUFFIX, userName);

        // 유저-방 매핑 (TTL 포함)
        String userRoomKey = USER_ROOM_KEY + userName + ":room";
        redisTemplate.opsForValue().set(userRoomKey, roomId);
        redisTemplate.expire(userRoomKey, USER_ROOM_TTL);

        log.info("User {} joined room {}", userName, roomId);
        return true;
    }

    /**
     * 방 나가기
     *
     * @return true: 방이 폭파됨 (방장 퇴장), false: 일반 퇴장
     */
    public boolean leaveRoom(String roomId, String userName) {
        // 방장인지 확인
        String hostId = getHostId(roomId);

        // players에서 제거
        redisTemplate.opsForSet().remove(ROOM_KEY + roomId + PLAYERS_SUFFIX, userName);

        // ready에서 제거
        redisTemplate.opsForSet().remove(ROOM_KEY + roomId + READY_SUFFIX, userName);

        // 유저-방 매핑 제거
        redisTemplate.delete(USER_ROOM_KEY + userName + ":room");

        // 방장이 나가면 방 폭파
        if (hostId != null && hostId.equals(userName)) {
            saveRoomStatsToDB(roomId);

            // 남은 플레이어들의 유저-방 매핑도 제거
            Set<String> remainingPlayers = getPlayers(roomId);
            for (String playerName : remainingPlayers) {
                redisTemplate.delete(USER_ROOM_KEY + playerName + ":room");
            }
            deleteRoom(roomId);
            log.info("Room {} destroyed (host left)", roomId);
            return true;
        }

        log.info("User {} left room {}", userName, roomId);
        return false;
    }

    /**
     * 방 내 플레이어 목록
     */
    public Set<String> getPlayers(String roomId) {
        return redisTemplate.opsForSet().members(ROOM_KEY + roomId + PLAYERS_SUFFIX);
    }

    /**
     * 플레이어 수
     */
    public long getPlayerCount(String roomId) {
        Long count = redisTemplate.opsForSet().size(ROOM_KEY + roomId + PLAYERS_SUFFIX);
        return count != null ? count : 0;
    }

    // =========================================================
    // Ready 상태 관리
    // =========================================================

    /**
     * Ready 상태 설정
     */
    public void setReady(String roomId, String userName, boolean isReady) {
        String readyKey = ROOM_KEY + roomId + READY_SUFFIX;
        if (isReady) {
            redisTemplate.opsForSet().add(readyKey, userName);
        } else {
            redisTemplate.opsForSet().remove(readyKey, userName);
        }
        log.info("User {} ready status: {} in room {}", userName, isReady, roomId);
    }

    /**
     * Ready 플레이어 목록
     */
    public Set<String> getReadyPlayers(String roomId) {
        return redisTemplate.opsForSet().members(ROOM_KEY + roomId + READY_SUFFIX);
    }

    /**
     * 방장 제외 전원 Ready 확인
     */
    public boolean isAllReady(String roomId) {
        long playerCount = getPlayerCount(roomId);
        Long readyCount = redisTemplate.opsForSet().size(ROOM_KEY + roomId + READY_SUFFIX);

        if (readyCount == null)
            readyCount = 0L;

        // 방장 제외한 인원 = 전체 - 1
        // 방장 제외 전원이 Ready여야 함
        return playerCount > 1 && readyCount == (playerCount - 1);
    }

    // =========================================================
    // 방 정보 조회
    // =========================================================

    /**
     * 방장 ID 조회
     */
    public String getHostId(String roomId) {
        Object hostId = redisTemplate.opsForHash().get(ROOM_KEY + roomId, "hostId");
        return hostId != null ? hostId.toString() : null;
    }

    /**
     * 방 상태 조회
     */
    public RoomStatus getStatus(String roomId) {
        Object status = redisTemplate.opsForHash().get(ROOM_KEY + roomId, "status");
        return status != null ? RoomStatus.valueOf(status.toString()) : null;
    }

    /**
     * 현재 스테이지 조회
     */
    public int getCurrentStage(String roomId) {
        Object stage = redisTemplate.opsForHash().get(ROOM_KEY + roomId, "currentStage");
        return stage != null ? Integer.parseInt(stage.toString()) : 0;
    }

    // =========================================================
    // 게임 시작/진행
    // =========================================================

    /**
     * 게임 시작 (방장만 호출 가능)
     *
     * @return true: 시작 성공, false: 조건 미충족
     */
    public boolean startGame(String roomId, String userName) {
        // 방장 확인
        String hostId = getHostId(roomId);
        if (hostId == null || !hostId.equals(userName)) {
            log.warn("Non-host {} tried to start game in room {}", userName, roomId);
            return false;
        }

        // 전원 Ready 확인 (방장 제외)
        if (!isAllReady(roomId)) {
            log.warn("Not all players ready in room {}", roomId);
            return false;
        }

        // 상태 변경
        String roomKey = ROOM_KEY + roomId;
        redisTemplate.opsForHash().put(roomKey, "status", RoomStatus.PLAYING.name());
        redisTemplate.opsForHash().put(roomKey, "currentStage", "1");

        // 게임 시작 시 TTL 연장 (4시간)
        redisTemplate.expire(roomKey, GAME_TTL);
        redisTemplate.expire(ROOM_KEY + roomId + PLAYERS_SUFFIX, GAME_TTL);
        redisTemplate.expire(ROOM_KEY + roomId + READY_SUFFIX, GAME_TTL);
        redisTemplate.expire(ROOM_KEY + roomId + KISS_SUFFIX, GAME_TTL);
        redisTemplate.expire(ROOM_KEY + roomId + CURSE_SUFFIX, GAME_TTL);

        log.info("Game started in room {} (TTL extended to {})", roomId, GAME_TTL);
        return true;
    }

    /**
     * 다음 스테이지로 이동
     */
    public int nextStage(String roomId) {
        int currentStage = getCurrentStage(roomId);
        int nextStage = currentStage + 1;
        redisTemplate.opsForHash().put(ROOM_KEY + roomId, "currentStage", String.valueOf(nextStage));
        log.info("Room {} moved to stage {}", roomId, nextStage);
        return nextStage;
    }

    /**
     * 게임 종료
     */
    public void endGame(String roomId) {
        redisTemplate.opsForHash().put(ROOM_KEY + roomId, "status", RoomStatus.ENDED.name());
        log.info("Game ended in room {}", roomId);
    }

    // =========================================================
    // 게임 내 통계 (뽀뽀왕)
    // =========================================================

    /**
     * 뽀뽀 횟수 증가
     */
    public void incrementKiss(String roomId, String userName) {
        redisTemplate.opsForHash().increment(ROOM_KEY + roomId + KISS_SUFFIX, userName, 1);
    }

    /**
     * 저주 횟수 증가
     */
    public void incrementCurse(String roomId, String userName) {
        redisTemplate.opsForHash().increment(ROOM_KEY + roomId + CURSE_SUFFIX, userName, 1);
    }

    /**
     * 뽀뽀 횟수 조회
     */
    public int getKissCount(String roomId, String userName) {
        Object count = redisTemplate.opsForHash().get(ROOM_KEY + roomId + KISS_SUFFIX, userName);
        return count != null ? Integer.parseInt(count.toString()) : 0;
    }

    /**
     * 저주 횟수 조회
     */
    public int getCurseCount(String roomId, String userName) {
        Object count = redisTemplate.opsForHash().get(ROOM_KEY + roomId + CURSE_SUFFIX, userName);
        return count != null ? Integer.parseInt(count.toString()) : 0;
    }

    // =========================================================
    // REST API 지원 메서드
    // =========================================================

    /**
     * 방 정보 조회 (DTO 반환)
     */
    public com.d105.dto.RoomInfoDto getRoomInfo(String roomId) {
        return com.d105.dto.RoomInfoDto.builder()
                .roomId(roomId)
                .hostId(getHostId(roomId))
                .status(getStatus(roomId) != null ? getStatus(roomId).name() : null)
                .playerCount((int) getPlayerCount(roomId))
                .players(getPlayers(roomId))
                .readyPlayers(getReadyPlayers(roomId))
                .currentStage(getCurrentStage(roomId))
                .build();
    }

    /**
     * 유저가 현재 참가 중인 방 조회
     */
    public String getUserRoom(String userName) {
        return redisTemplate.opsForValue().get(USER_ROOM_KEY + userName + ":room");
    }

    /**
     * 강제 퇴장 (Redis에서 제거)
     */
    public void kickPlayer(String roomId, String userName) {
        // players에서 제거
        redisTemplate.opsForSet().remove(ROOM_KEY + roomId + PLAYERS_SUFFIX, userName);

        // ready에서 제거
        redisTemplate.opsForSet().remove(ROOM_KEY + roomId + READY_SUFFIX, userName);

        // 유저-방 매핑 제거
        redisTemplate.delete(USER_ROOM_KEY + userName + ":room");

        log.info("User {} kicked from room {}", userName, roomId);
    }

    /**
     * 방의 모든 플레이어 통계를 DB로 이관하는 헬퍼 메서드
     *
     * @param roomId
     */
    private void saveRoomStatsToDB(String roomId) {
        try {
            // 1. 방에 기록된 모든 플레이어 조회 (이미 나간 유저도 통계가 남아있을 수 있으므로 KISS/CURSE 키 기준 조회 권장하나,
            // 현재 구조상 플레이어 목록(Set)에 있는 사람 혹은 통계 키를 순회해야 함.
            // 간단하게 현재 방에 남아있는 사람 + 방금 나간 방장(이미 Set에선 빠짐)을 처리해야 하지만,
            // Redis의 Hash Key(KISS_SUFFIX)의 모든 Key(유저ID)를 가져오는 것이 가장 정확함.

            Set<Object> userNamesWithKiss = redisTemplate.opsForHash().keys(ROOM_KEY + roomId + KISS_SUFFIX);
            Set<Object> userNamesWithCurse = redisTemplate.opsForHash().keys(ROOM_KEY + roomId + CURSE_SUFFIX);

            // 두 집합 합치기 (통계가 존재하는 모든 유저)
            Set<Object> allUserNames = new java.util.HashSet<>();
            allUserNames.addAll(userNamesWithKiss);
            allUserNames.addAll(userNamesWithCurse);

            for (Object userNameObj : allUserNames) {
                String username = userNameObj.toString();

                int kissCount = getKissCount(roomId, username);
                int curseCount = getCurseCount(roomId, username);

                // DB 저장 호출
                userService.saveGameStats(username, kissCount, curseCount);
            }
            log.info("Saved stats for {} users in room {}", allUserNames.size(), roomId);

        } catch (Exception e) {
            log.error("Failed to save room stats to DB for room {}", roomId, e);
        }
    }
}
