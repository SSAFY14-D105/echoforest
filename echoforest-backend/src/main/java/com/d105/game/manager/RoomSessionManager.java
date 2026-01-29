package com.d105.game.manager;

import com.d105.game.PlayerState;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.socket.WebSocketSession;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
public class RoomSessionManager {

    private final String roomId;

    // 세션 관리 및 플레이어 상태 관리
    @Getter
    private final Map<String, WebSocketSession> sessions = new ConcurrentHashMap<>();
    @Getter
    private final Map<String, PlayerState> players = new ConcurrentHashMap<>();

    // 슬롯 점유 상태 관리 (최대 4명)
    @Getter
    private final String[] slots = new String[4];

    public RoomSessionManager(String roomId) {
        this.roomId = roomId;
    }

    public void addSession(WebSocketSession session, PlayerState player) {
        sessions.put(session.getId(), session);
        players.put(session.getId(), player);

        // 슬롯 할당 (이미 할당된 경우 패스 - 재접속 시)
        if (player.getColorIndex() >= 0 && player.getColorIndex() < 4) {
            slots[player.getColorIndex()] = session.getId();
        }
    }

    public void removeSession(String sessionId) {
        sessions.remove(sessionId);
        // players는 남겨둘 수도 있음 (재접속 대기).
        // GameRoom 로직에 따라 다르지만, 여기서는 순수 Map 관리만 제공.
    }

    /**
     * 세션과 플레이어 상태를 모두 제거 (완전 퇴장 또는 재접속 시 구 세션 정리용)
     */
    public void removeSessionAndPlayer(String sessionId) {
        sessions.remove(sessionId);
        players.remove(sessionId);
    }

    public PlayerState getPlayer(String sessionId) {
        return players.get(sessionId);
    }

    public WebSocketSession getSession(String sessionId) {
        return sessions.get(sessionId);
    }

    public int getServerPlayerCount() {
        return players.size();
    }

    public boolean isEmpty() {
        return players.isEmpty() && sessions.isEmpty();
    }

    public void assignSlot(int slotIndex, String sessionId) {
        if (slotIndex >= 0 && slotIndex < 4) {
            slots[slotIndex] = sessionId;
        }
    }

    public void clearSlot(String sessionId) {
        for (int i = 0; i < 4; i++) {
            if (sessionId.equals(slots[i])) {
                slots[i] = null;
                break;
            }
        }
    }

    public int findEmptySlot() {
        for (int i = 0; i < 4; i++) {
            if (slots[i] == null) {
                return i;
            }
        }
        return -1;
    }

    public String findSessionIdByUsername(String username) {
        for (Map.Entry<String, PlayerState> entry : players.entrySet()) {
            if (entry.getValue().getUsername().equals(username)) {
                return entry.getKey();
            }
        }
        return null;
    }

    public List<String> getAllSessionIds() {
        return new ArrayList<>(sessions.keySet());
    }

    public List<WebSocketSession> getAllSessions() {
        return new ArrayList<>(sessions.values());
    }
}
