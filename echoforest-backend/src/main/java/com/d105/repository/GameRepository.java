package com.d105.repository;

import org.springframework.stereotype.Repository;
import org.springframework.web.socket.WebSocketSession;

import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 게임 방과 세션 정보를 저장하는 인메모리 저장소
 * 나중에 Redis로 교체하기 좋은 위치입니다.
 */
@Repository
public class GameRepository {

    // key: roomId, value: 세션 목록
    private final Map<String, Set<WebSocketSession>> rooms = new ConcurrentHashMap<>();

    /**
     * 방 존재 여부 확인
     * - CREATE: 중복 방지용
     * - JOIN: 입장 가능 여부 확인용
     */
    public boolean roomExists(String roomId) {
        return rooms.containsKey(roomId);
    }

    public Set<WebSocketSession> getSessions(String roomId) {
        return rooms.getOrDefault(roomId, Set.of());
    }

    public void addSession(String roomId, WebSocketSession session) {
        rooms.computeIfAbsent(roomId, k -> ConcurrentHashMap.newKeySet()).add(session);
    }

    public void removeSession(String roomId, WebSocketSession session) {
        Set<WebSocketSession> sessions = rooms.get(roomId);
        if (sessions != null) {
            sessions.remove(session);
            if (sessions.isEmpty()) {
                rooms.remove(roomId);
            }
        }
    }

    public int getRoomSize(String roomId) {
        Set<WebSocketSession> sessions = rooms.get(roomId);
        return sessions == null ? 0 : sessions.size();
    }
}