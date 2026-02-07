package com.d105.repository;

import com.d105.game.GameRoom;
import org.springframework.stereotype.Repository;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 게임 방(GameRoom) 인스턴스를 관리하는 저장소
 * - 방 생성/조회/삭제
 * - 나중에 Redis로 교체하기 좋은 위치
 */
@Repository
public class GameRepository {

    // 활성 게임 방 (roomId -> GameRoom)
    private final Map<String, GameRoom> rooms = new ConcurrentHashMap<>();

    /**
     * 방 존재 여부 확인
     */
    public boolean roomExists(String roomId) {
        return rooms.containsKey(roomId);
    }

    /**
     * 방 조회 (없으면 null)
     */
    public GameRoom getRoom(String roomId) {
        return rooms.get(roomId);
    }

    /**
     * 방 등록
     */
    public void addRoom(String roomId, GameRoom room) {
        rooms.put(roomId, room);
    }

    /**
     * 방 삭제
     */
    public void removeRoom(String roomId) {
        rooms.remove(roomId);
    }

    /**
     * 방의 현재 플레이어 수 조회
     */
    public int getPlayerCount(String roomId) {
        GameRoom room = rooms.get(roomId);
        return room == null ? 0 : room.getPlayerCount();
    }

    /**
     * 활성 방 개수
     */
    public int getActiveRoomCount() {
        return rooms.size();
    }

    /**
     * 모든 방 조회 (Zombie Check용)
     */
    public java.util.Collection<GameRoom> getAllRooms() {
        return rooms.values();
    }
}