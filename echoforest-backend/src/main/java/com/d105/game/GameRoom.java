package com.d105.game;

import com.d105.dto.GameMessageDto;
import com.d105.dto.PlayerUpdateDto;
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

    public void addPlayer(WebSocketSession session, String rawUsername) {
        String username = rawUsername.trim();
        // 재접속 여부 확인
        log.info("Attempting to add player '{}' to room '{}'", username, roomId);
        log.info("Current players in room: {}",
                sessionManager.getPlayers().values().stream().map(PlayerState::getUsername).toList());

        String existingSessionId = sessionManager.findSessionIdByUsername(username);
        log.info("Found existing session for '{}': {}", username, existingSessionId);

        if (existingSessionId != null) {
            // [재접속] 또는 [Session Hijack]
            // 기존 세션 ID가 지금 들어온 세션 ID와 같다면 무시(이미 처리됨)
            if (existingSessionId.equals(session.getId())) {
                return;
            }

            PlayerState existingPlayer = sessionManager.getPlayer(existingSessionId);
            if (existingPlayer != null) {
                log.info("Player {} reconnected/hijacked! Old Session: {}, New Session: {}", username,
                        existingSessionId, session.getId());

                // 1. 기존 세션 정보 제거 (Map에서만 제거하고 객체는 유지)
                sessionManager.removeSessionAndPlayer(existingSessionId);

                // 2. 새 세션으로 매핑 추가
                sessionManager.addSession(session, existingPlayer);

                // 3. 상태 복구
                existingPlayer.setDisconnected(false);
                existingPlayer.setDisconnectTime(0);

                // 4. 슬롯 갱신
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

            // [FIX] Disconnected player also broadcasted (Ghost prevention)
            // if (p.isDisconnected()) { continue; }

            // [DEBUG] Check detailed player state
            if (updates.isEmpty() && Math.random() < 0.01) {
                // log.info("[Broadcast Debug] Processing player: {}, Disconnected: {}",
                // p.getUsername(), p.isDisconnected());
            }

            // DTO Mapping
            // Use Client-Reported Visual Curses for synchronization
            Set<String> activeCurses = p.getVisibleCurses();
            // If empty, maybe fallback to server state?
            // For now, trust client. If client sends empty list, it means no curses.
            if (activeCurses.isEmpty() && !p.getActiveCurses().isEmpty()) {
                // Fallback to server state if client hasn't sent anything yet?
                // But client sends every few ms. Let's stick to visibleCurses.
            }

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
                    .isHidden(p.isHidden()) // [NEW] 필드 추가
                    .isAfk(p.isAfk())
                    .isDisconnected(p.isDisconnected()) // [NEW] 연결 끊김 상태 전송
                    .curses(activeCurses)
                    .build();
            updates.add(dto);
        }

        GameMessageDto msg = new GameMessageDto();
        msg.setType("UPDATE");
        msg.setRoomId(roomId);
        try {
            msg.setContent(objectMapper.writeValueAsString(updates));

            // [DEBUG] Log packet size periodically
            if (Math.random() < 0.05) { // 5% chance
                log.info("[Broadcast] Room {} sending UPDATE to {} players. Packet size: {} players", roomId,
                        sessionManager.getServerPlayerCount(), updates.size());
                if (updates.size() < sessionManager.getServerPlayerCount()) {
                    log.warn("[Broadcast Warning] Discrepancy! Server Count: {}, Update Count: {}",
                            sessionManager.getServerPlayerCount(), updates.size());
                }
            }
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

    public void updatePlayerPosition(String sessionId, Double x, Double y, Double vx, Double vy, String anim,
            Boolean isDead, List<String> curses, Boolean isHidden) {
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
            if (isDead != null)
                p.setDead(isDead);
            if (isHidden != null)
                p.setHidden(isHidden);
            if (curses != null)
                p.setVisibleCurses(curses);

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

    /**
     * 특정 사용자 강제 퇴장 (중복 로그인 등)
     */
    public void kickUser(String sessionId, String reason) {
        PlayerState p = sessionManager.getPlayer(sessionId);
        if (p == null)
            return;

        WebSocketSession session = sessionManager.getSession(sessionId);
        if (session != null && session.isOpen()) {
            try {
                com.d105.dto.GameMessageDto msg = new com.d105.dto.GameMessageDto();
                msg.setType("DUPLICATE_LOGIN");
                msg.setContent("다른 기기에서 로그인하여 접속이 종료됩니다.");

                synchronized (session) {
                    session.sendMessage(
                            new org.springframework.web.socket.TextMessage(objectMapper.writeValueAsString(msg)));

                    // [FIX] 메시지 전송 보장을 위해 잠시 대기
                    Thread.sleep(200);

                    // 메시지 전송 후 즉시 종료보다는 약간의 텀을 두거나, 클라이언트가 끊게 유도
                    // 하지만 보안상 서버가 끊는 게 확실함. 메시지 전송은 동기적이므로 보내고 바로 닫아도 됨.
                    session.close(org.springframework.web.socket.CloseStatus.POLICY_VIOLATION.withReason(reason));
                }
            } catch (Exception e) {
                log.error("Failed to kick user {}", p.getUsername(), e);
            }
        }
        // 세션/플레이어 제거
        removePlayer(session);
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

    public PlayerState getPlayerBySessionId(String sessionId) {
        return sessionManager.getPlayer(sessionId);
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

    // --- Multi-Sage Transition Logic ---

    public void handleStageClear(String username) {
        String sid = sessionManager.findSessionIdByUsername(username);
        if (sid == null)
            return;

        PlayerState player = sessionManager.getPlayer(sid);
        if (player == null)
            return;

        // 1. 해당 플레이어 완료 처리
        if (!player.isFinished()) {
            player.setFinished(true);
            log.info("Player {} finished stage {}", username, currentMapId);
            // 필요 시 "XX님이 도착했습니다" 시스템 메시지 브로드캐스트 가능
        }

        // 2. 모든 플레이어가 완료했는지 확인
        checkStageCompletion();
    }

    public void handleStageExit(String username) {
        String sid = sessionManager.findSessionIdByUsername(username);
        if (sid == null)
            return;

        PlayerState player = sessionManager.getPlayer(sid);
        if (player == null)
            return;

        if (player.isFinished()) {
            player.setFinished(false);
            log.info("Player {} left goal (unfinished) stage {}", username, currentMapId);
        }
    }

    private void checkStageCompletion() {
        log.info("[DEBUG] Checking Stage Completion...");
        boolean allFinished = true;
        int activePlayerCount = 0;
        int finishedPlayerCount = 0;

        for (PlayerState p : sessionManager.getPlayers().values()) {
            if (!p.isDisconnected()) {
                activePlayerCount++;
                if (p.isFinished()) {
                    finishedPlayerCount++;
                } else {
                    allFinished = false;
                }
                log.info("[DEBUG] Player '{}': Finished={}, Disconnected={}, AFK={}",
                        p.getUsername(), p.isFinished(), p.isDisconnected(), p.isAfk());
            } else {
                log.info("[DEBUG] Player '{}' is DISCONNECTED (Ignoring)", p.getUsername());
            }
        }

        log.info("[DEBUG] Result: Active={}, Finished={}. All Finished? {}", activePlayerCount, finishedPlayerCount,
                allFinished);

        if (allFinished && activePlayerCount > 0) {
            log.info("All players finished stage {}. Starting Ending Mission.", currentMapId);
            broadcastEndingMissionStart();
        }
    }

    /**
     * 엔딩 미션 시작 브로드캐스트
     */
    private void broadcastEndingMissionStart() {
        GameMessageDto msg = new GameMessageDto();
        msg.setType("ENDING_MISSION_START");
        msg.setRoomId(roomId);
        broadcast(msg, null);
        log.info("🎉 Room {}: ENDING_MISSION_START broadcasted", roomId);
    }

    /**
     * 엔딩 미션 완료 처리 (각 플레이어가 개별적으로 전송)
     */
    public void handleEndingMissionComplete(String username) {
        String sid = sessionManager.findSessionIdByUsername(username);
        if (sid == null)
            return;

        PlayerState player = sessionManager.getPlayer(sid);
        if (player == null)
            return;

        if (!player.isEndingMissionComplete()) {
            player.setEndingMissionComplete(true);
            log.info("📸 Room {}: Player {} completed ending mission", roomId, username);
        }

        // 모든 플레이어 완료 체크
        checkEndingMissionCompletion();
    }

    /**
     * 모든 플레이어 엔딩 미션 완료 체크
     */
    private void checkEndingMissionCompletion() {
        boolean allComplete = true;
        int activeCount = 0;
        int completeCount = 0;

        for (PlayerState p : sessionManager.getPlayers().values()) {
            if (!p.isDisconnected()) {
                activeCount++;
                if (p.isEndingMissionComplete()) {
                    completeCount++;
                } else {
                    allComplete = false;
                }
            }
        }

        log.info("[DEBUG] Ending Mission Check: Active={}, Complete={}, AllDone={}",
                activeCount, completeCount, allComplete);

        if (allComplete && activeCount > 0) {
            log.info("🏁 Room {}: All players completed ending mission. Transitioning...", roomId);

            // ENDING_MISSION_END 브로드캐스트 (모든 클라이언트 오버레이 닫기)
            GameMessageDto endMsg = new GameMessageDto();
            endMsg.setType("ENDING_MISSION_END");
            endMsg.setRoomId(roomId);
            broadcast(endMsg, null);

            transitionToNextStage();
        }
    }

    private void transitionToNextStage() {
        // 1. 다음 스테이지 ID 계산
        this.currentMapId++;

        // 2. 모든 플레이어 상태 리셋 (위치, 완료 상태 등)
        sessionManager.getPlayers().values().forEach(p -> {
            p.setFinished(false);
            p.setDead(false);
            p.setHp(100);
            p.clearCurses();
            p.setEndingMissionComplete(false); // 엔딩 미션 완료 상태 리셋
            // 위치는 클라이언트가 새 맵 로드 시 스폰 포인트로 이동하므로 초기화하지 않음 (혹은 안전하게 0,0으로?)
            // p.setX(0); p.setY(0);
        });

        // 3. 기믹/저주 상태 리셋
        curseManager.resetCurseStack();
        // [FIX] Removed frontend reference (BaseGameScene)
        // 백엔드에서는 저주 스택만 초기화하면 됨.

        // 4. 전환 메시지 브로드캐스트 (클라이언트가 씬을 바꾸도록)
        GameMessageDto msg = new GameMessageDto();
        msg.setType("STAGE_TRANSITION");
        msg.setRoomId(roomId);
        // "MULTI_" 접두사 붙여서 전송 (프론트 규격)
        msg.setContent("MULTI_" + currentMapId);
        broadcast(msg, null);
    }

    private record InputEvent(String sessionId, String inputType) {
    }
}