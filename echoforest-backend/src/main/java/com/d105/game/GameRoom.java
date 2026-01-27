package com.d105.game;

import com.d105.dto.GameMessageDto;
import com.d105.dto.PlayerUpdateDto;
import com.d105.game.constant.CurseType;
import com.d105.game.manager.CurseManager;
import com.d105.game.manager.RoomSessionManager;
import com.d105.game.network.GameBroadcaster;
import com.d105.game.physics.PlayerPhysicsEngine;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.socket.WebSocketSession;

import java.util.*;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.stream.Collectors;

@Slf4j
public class GameRoom implements Runnable {

    // Constants
    private static final long RECONNECT_TIMEOUT_MS = 3 * 60 * 1000; // 3분

    // Managers
    private final RoomSessionManager sessionManager;
    private final CurseManager curseManager;
    private final GameBroadcaster broadcaster;
    private final PlayerPhysicsEngine physicsEngine;
    // CollisionManager removed
    private final ObjectMapper objectMapper;

    // Game State
    @Getter
    private final String roomId;
    private volatile boolean isRunning = true;

    public enum GameState {
        RUNNING, PAUSED
    }

    private GameState state = GameState.RUNNING;

    // Input Queue
    private final Queue<InputEvent> inputQueue = new ConcurrentLinkedQueue<>();

    // Host Info
    @Getter
    private String hostUsername;
    @Getter
    private int currentMapId = 1;

    public GameRoom(String roomId, ObjectMapper objectMapper, Map<String, Object> mapData) {
        this.roomId = roomId;
        this.objectMapper = objectMapper;

        // Initialize Managers
        this.sessionManager = new RoomSessionManager(roomId);
        this.curseManager = new CurseManager(roomId);
        this.broadcaster = new GameBroadcaster(objectMapper, roomId);
        this.physicsEngine = new PlayerPhysicsEngine();

        // Physics & Collision removed (Client-Authoritative)
    }

    // --- Player Management (Delegated to SessionManager) ---

    public void addPlayer(WebSocketSession session, String username) {
        // 재접속 여부 확인
        String existingSessionId = sessionManager.findSessionIdByUsername(username);

        if (existingSessionId != null) {
            // [재접속]
            PlayerState existingPlayer = sessionManager.getPlayer(existingSessionId);
            if (existingPlayer != null && existingPlayer.isDisconnected()) {
                log.info("Player {} reconnected!", username);

                // 세션 교체 + 상태 복구
                sessionManager.removeSession(existingSessionId);
                sessionManager.addSession(session, existingPlayer);

                existingPlayer.setDisconnected(false);
                existingPlayer.setDisconnectTime(0);

                // 슬롯 갱신
                sessionManager.assignSlot(existingPlayer.getColorIndex(), session.getId());
                return;
            }
        }

        // [신규 입장]
        int emptySlot = sessionManager.findEmptySlot();
        if (emptySlot == -1) {
            log.warn("Room {} full.", roomId);
            return;
        }

        PlayerState newPlayer = new PlayerState(username, 100, 100);
        newPlayer.setColorIndex(emptySlot);
        sessionManager.addSession(session, newPlayer);

        if (hostUsername == null) {
            hostUsername = username;
        }
    }

    public void removePlayer(WebSocketSession session) {
        String sessionId = session.getId();
        PlayerState p = sessionManager.getPlayer(sessionId);

        if (p == null) {
            sessionManager.removeSession(sessionId);
            return;
        }

        // 방장이 나가면 방 폭파
        if (p.getUsername().equals(hostUsername)) {
            broadcastSystemMessage("PLAYER_LEFT", p.getUsername(), "Host left.");
            this.isRunning = false;
            // Clear All
            // sessionManager logic to clear
            return;
        }

        // 일반 유저: Soft Disconnect
        log.info("Player {} disconnected (waiting reconnect).", p.getUsername());
        p.setDisconnected(true);
        p.setDisconnectTime(System.currentTimeMillis());
        sessionManager.removeSession(sessionId); // 맵에서만 제거 (PlayerState는 유지 필요? -> RoomSessionManager 구조상 분리가 까다로움)
        // [FIX] RoomSessionManager에서 removeSession은 players에서도 제거함.
        // 재접속 지원을 위해서는 players에는 남겨둬야 함.
        // RoomSessionManager를 수정하거나, 여기서 로직을 조정해야 함.
        // 현재 RoomSessionManager.removeSession은 sessions 만 제거하고 players는 두는 것으로 가정.
        // (실제 코드 확인 필요 -> 위에서 sessions.remove, players 언급 주석 있음)

        broadcastSystemMessage("PLAYER_DISCONNECTED", p.getUsername(), null);

        if (sessionManager.isEmpty()) { // players도 비었는지 확인 필요. sessions가 비어도 재접속 대기자가 있으면 유지.
            // 활성 세션이 없으면 종료 고려, 하지만 재접속 대기 시간(3분) 동안은 유지.
            // 다만 players 맵이 완전히 비면 종료.
        }
    }

    // Wrapper for broadcast
    public void kickPlayer(String username) {
        String sessionId = sessionManager.findSessionIdByUsername(username);
        if (sessionId == null)
            return;

        WebSocketSession session = sessionManager.getSession(sessionId);

        // Remove from manager
        sessionManager.removeSession(sessionId);

        if (session != null && session.isOpen()) {
            try {
                GameMessageDto msg = new GameMessageDto();
                msg.setType("KICKED");
                msg.setRoomId(roomId);
                msg.setContent("You have been kicked.");
                broadcaster.sendToSingleSession(session, msg);
                session.close();
            } catch (Exception e) {
            }
        }

        broadcastSystemMessage("PLAYER_LEFT", username, "Kicked by host");
    }

    private void broadcastSystemMessage(String type, String username, String content) {
        GameMessageDto msg = new GameMessageDto();
        msg.setType(type);
        msg.setRoomId(roomId);
        msg.setUsername(username);
        msg.setContent(content);
        broadcast(msg, null);
    }

    public void broadcast(GameMessageDto message, String excludeSessionId) {
        broadcaster.broadcast(sessionManager.getAllSessions(), message, excludeSessionId);
    }

    // --- Game Loop ---

    @Override
    public void run() {
        log.info("🚀 Game Loop Started: {}", roomId);
        while (isRunning) {
            try {
                // 1. Logic Update
                updateGameLogic();

                // 2. Broadcast State
                broadcastState();

                // 3. Sleep
                Thread.sleep(33);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                break;
            }
        }
    }

    private void updateGameLogic() {
        long now = System.currentTimeMillis();

        // Input Processing
        while (!inputQueue.isEmpty()) {
            InputEvent event = inputQueue.poll();
            PlayerState p = sessionManager.getPlayer(event.sessionId);
            if (p != null) {
                applyInput(p, event);
            }
        }

        // Player Updates
        Iterator<Map.Entry<String, PlayerState>> it = sessionManager.getPlayers().entrySet().iterator();
        while (it.hasNext()) {
            Map.Entry<String, PlayerState> entry = it.next();
            PlayerState p = entry.getValue();

            // AFK Check
            p.checkAfkStatus();

            // Timeout Check
            if (p.isDisconnected()) {
                if (now - p.getDisconnectTime() > RECONNECT_TIMEOUT_MS) {
                    it.remove(); // 진짜 퇴장
                    sessionManager.clearSlot(entry.getKey());
                    broadcastSystemMessage("PLAYER_LEFT", p.getUsername(), "Timeout");
                }
            } else if (p.shouldDisconnect()) {
                // Soft Disconnect Logic (timeout while connected)
                p.setDisconnected(true);
                p.setDisconnectTime(now);
                WebSocketSession s = sessionManager.getSession(entry.getKey());
                if (s != null)
                    try {
                        s.close();
                    } catch (Exception e) {
                    }
                sessionManager.removeSession(entry.getKey());
                broadcastSystemMessage("PLAYER_DISCONNECTED", p.getUsername(), "Inactivity");
            }

            // Physics (Optional based on requirements, currenly Client-Authoritative
            // mostly)
            // But we can enable simple gravity for AFK or specific states
            if (p.isAfk()) {
                physicsEngine.applyAfkGravity(p);
            }

            // Curse Effects (Time Bomb etc)
            // Can be moved to CurseManager.applyTick(p, dt)
        }

        if (sessionManager.getPlayers().isEmpty()) {
            isRunning = false;
        }
    }

    private void applyInput(PlayerState p, InputEvent event) {
        // Input logic
        p.updateInputTimestamp();
        switch (event.inputType) {
            case "LEFT_DOWN" -> p.setInputX(-1);
            case "RIGHT_DOWN" -> p.setInputX(1);
            case "LEFT_UP", "RIGHT_UP" -> p.setInputX(0);
            case "JUMP" -> p.setInputJump(true);
        }
    }

    private void broadcastState() {
        List<PlayerUpdateDto> updates = new ArrayList<>();
        String[] slots = sessionManager.getSlots();

        for (String sid : slots) {
            if (sid == null)
                continue;
            PlayerState p = sessionManager.getPlayer(sid);
            if (p == null)
                continue;

            // DTO Mapping
            Set<String> activeCurses = p.getActiveCurses().keySet().stream()
                    .map(Enum::name)
                    .collect(Collectors.toSet());

            PlayerUpdateDto dto = PlayerUpdateDto.builder()
                    .serverTick(System.currentTimeMillis())
                    .id(p.getUsername())
                    .x(Math.round(p.getX() * 100) / 100.0)
                    .y(Math.round(p.getY() * 100) / 100.0)
                    .vx(p.getVx())
                    .vy(p.getVy())
                    .anim(p.getAnim())
                    .colorIndex(p.getColorIndex())
                    .isHost(p.getUsername().equals(this.hostUsername))
                    .width(p.getWidth())
                    .height(p.getHeight())
                    .hp(p.getHp())
                    .isDead(p.isDead())
                    .isAfk(p.isAfk())
                    .curses(activeCurses)
                    .build();
            updates.add(dto);
        }

        GameMessageDto msg = new GameMessageDto();
        msg.setType("UPDATE");
        msg.setRoomId(roomId);
        try {
            msg.setContent(objectMapper.writeValueAsString(updates));
            // Note: broadcasting list of objects as content string
        } catch (Exception e) {
            log.error("Error error", e);
        }

        broadcaster.broadcast(sessionManager.getAllSessions(), msg, null);
    }

    // --- Public Methods (External API) ---

    public int getPlayerCount() {
        return sessionManager.getServerPlayerCount();
    }

    public boolean hasPlayer(String username) {
        return sessionManager.findSessionIdByUsername(username) != null;
    }

    public void updatePlayerPosition(String sessionId, Double x, Double y, Double vx, Double vy, String anim) {
        PlayerState p = sessionManager.getPlayer(sessionId);
        if (p != null) {
            p.touch();
            if (x != null)
                p.setX(x);
            if (y != null)
                p.setY(y);
            if (vx != null)
                p.setVx(vx);
            if (vy != null)
                p.setVy(vy);
            if (anim != null)
                p.setAnim(anim);
            p.updateInputTimestamp();
        }
    }

    public void handleInput(WebSocketSession session, String inputType) {
        inputQueue.offer(new InputEvent(session.getId(), inputType));
    }

    // Delegate to CurseManager
    public boolean addCurseStack(int delta) {
        return curseManager.addCurseStack(delta);
    }

    public int getCurseStack() {
        return curseManager.getCurseStack();
    }

    public void resetCurseStack() {
        curseManager.resetCurseStack();
    }

    public void addTeamCurseStack(int delta) {
        if (curseManager.addTeamCurseStack(delta)) {
            String victim = curseManager.triggerRandomCurse(sessionManager.getPlayers());
            if (victim != null)
                broadcastSystemMessage("CURSE_TRIGGERED", victim, "Random Curse!");
        }
        broadcastStackUpdate();
    }

    private void broadcastStackUpdate() {
        GameMessageDto msg = new GameMessageDto();
        msg.setType("CURSE_STACK_UPDATE");
        msg.setRoomId(roomId);
        msg.setContent(String.valueOf(curseManager.getTeamCurseStack()));
        broadcast(msg, null);
    }

    public void attemptCurseLift(String username) {
        String sid = sessionManager.findSessionIdByUsername(username);
        if (sid == null)
            return;
        PlayerState p = sessionManager.getPlayer(sid);
        if (p != null && !p.getActiveCurses().isEmpty()) {
            p.clearCurses();
            broadcastSystemMessage("CURSE_LIFTED", username, "Curses Lifted");
        }
    }

    public void pause(String username) {
        this.state = GameState.PAUSED;
        broadcastSystemMessage("GAME_PAUSED", username, null);
    }

    public void resume(String username) {
        this.state = GameState.RUNNING;
        broadcastSystemMessage("GAME_RESUMED", username, null);
    }

    public void broadcastRoomClosed() {
        broadcastSystemMessage("ROOM_CLOSED", null, "Host left");
        this.isRunning = false;
    }

    // Additional methods...
    public void triggerCurseEvent(String targetSessionId, boolean isPositive) {
        PlayerState p = sessionManager.getPlayer(targetSessionId);
        if (p != null)
            curseManager.triggerCurseEvent(p, isPositive);
    }

    public String findSessionIdByUsername(String username) {
        return sessionManager.findSessionIdByUsername(username);
    }

    public String getRandomPlayerUsername() {
        // Implement using session Manager keys
        List<String> keys = new ArrayList<>(sessionManager.getPlayers().keySet());
        if (keys.isEmpty())
            return null;
        String key = keys.get(new Random().nextInt(keys.size()));
        return sessionManager.getPlayer(key).getUsername();
    }

    public void setCurrentMapId(int id) {
        this.currentMapId = id;
    }

    private record InputEvent(String sessionId, String inputType) {
    }
}