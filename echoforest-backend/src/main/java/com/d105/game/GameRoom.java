package com.d105.game;

import com.d105.dto.GameMessageDto;
import com.d105.game.constant.CurseType;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedQueue;

@Slf4j
public class GameRoom implements Runnable {

    // Tick Duration (33ms = ~30 TPS)
    // 50ms (20 TPS) -> 33ms (30 TPS) for smoother movement
    private static final long TICK_DURATION = 33;
    private static final long RECONNECT_TIMEOUT_MS = 3 * 60 * 1000; // 3분

    public enum GameState {
        RUNNING, PAUSED
    }

    private GameState state = GameState.RUNNING;
    // 브로드캐스트 빈도 (20 TPS - 네트워크 최적화)
    private static final double BROADCAST_INTERVAL = 1.0 / 20.0;
    @Getter
    private final String roomId;
    private final ObjectMapper objectMapper;
    // 타일맵 충돌 처리 매니저
    private final TileCollisionManager collisionManager;
    // 세션 관리 및 플레이어 상태 관리
    private final Map<String, WebSocketSession> sessions = new ConcurrentHashMap<>();
    private final Map<String, PlayerState> players = new ConcurrentHashMap<>();
    // 입력 큐 (Thread-Safe)
    private final Queue<InputEvent> inputQueue = new ConcurrentLinkedQueue<>();
    private volatile boolean isRunning = true;
    private double broadcastAccumulator = 0;

    // 방장 닉네임 (방장은 AFK 자동 퇴장 제외)
    @Getter
    private String hostUsername;

    // [NEW] 슬롯 점유 상태 관리 (최대 4명) -- session ID 저장
    private final String[] slots = new String[4];

    // [NEW] 팀 공용 저주 스택 (Max 10)
    @Getter
    private int teamCurseStack = 0;
    private static final int MAX_CURSE_STACK = 10;

    /**
     * GameRoom 생성자
     *
     * @param roomId       방 ID
     * @param objectMapper JSON 직렬화용
     * @param mapData      타일맵 데이터 (null이면 기본 맵 사용)
     */
    public GameRoom(String roomId, ObjectMapper objectMapper, Map<String, Object> mapData) {
        this.roomId = roomId;
        this.objectMapper = objectMapper;

        // 맵 데이터가 있으면 TileCollisionManager 생성, 없으면 기본 맵 사용
        if (mapData != null) {
            this.collisionManager = new TileCollisionManager(mapData);
        } else {
            // 기본 맵 데이터 생성 (15x20 맵, 바닥만 있음)
            this.collisionManager = createDefaultCollisionManager();
        }
    }

    /**
     * 기본 충돌 매니저 생성 (테스트/폴백용)
     */
    private TileCollisionManager createDefaultCollisionManager() {
        Map<String, Object> defaultMapData = new java.util.HashMap<>();
        defaultMapData.put("tileSize", 40);

        // 15행 x 20열 맵 생성 (마지막 행만 벽)
        java.util.List<java.util.List<Integer>> tiles = new java.util.ArrayList<>();
        for (int row = 0; row < 15; row++) {
            java.util.List<Integer> rowData = new java.util.ArrayList<>();
            for (int col = 0; col < 20; col++) {
                if (row == 14) {
                    rowData.add(1); // 바닥 (벽)
                } else {
                    rowData.add(0); // 빈 공간
                }
            }
            tiles.add(rowData);
        }
        defaultMapData.put("tiles", tiles);

        return new TileCollisionManager(defaultMapData);
    }

    // --- removePlayer 메소드 구현 ---
    public void removePlayer(WebSocketSession session) {
        String sessionId = session.getId();
        PlayerState p = players.get(sessionId);

        if (p == null) {
            sessions.remove(sessionId);
            return;
        }

        // 방장이 나가면 방 폭파 (기존 로직 유지)
        if (p.getUsername().equals(hostUsername)) {
            log.info("Host {} left. Closing room {}", hostUsername, roomId);
            // 방장 퇴장 알림
            GameMessageDto leaveMsg = new GameMessageDto();
            leaveMsg.setType("PLAYER_LEFT");
            leaveMsg.setRoomId(roomId);
            leaveMsg.setUsername(p.getUsername());
            leaveMsg.setContent("Host left.");
            broadcast(leaveMsg, null);

            this.isRunning = false;
            sessions.remove(sessionId);
            players.clear();
            return;
        }

        // 게스트의 경우: 완전 삭제가 아닌 Disconnect 상태로 전환 (재접속 대기)
        log.info("Player {} disconnected. Waiting for reconnect...", p.getUsername());
        p.setDisconnected(true);
        p.setDisconnectTime(System.currentTimeMillis());

        // 세션 관리에서만 제거 (메시지 전송 불가)
        sessions.remove(sessionId);

        // Disconnect 알림 전송 for Client UI update (e.g. grey out)
        GameMessageDto discMsg = new GameMessageDto();
        discMsg.setType("PLAYER_DISCONNECTED");
        discMsg.setRoomId(roomId);
        discMsg.setUsername(p.getUsername());
        broadcast(discMsg, null);

        // 방에 활성 세션이 하나도 없으면 루프 종료 고민?
        // -> 아니오, 방장이 남아있거나 재접속 대기중일 수 있으므로 유지.
        // 다만 방장도 없고 모두 나갔다면 종료.
        if (sessions.isEmpty()) {
            this.isRunning = false;
        }
    }

    /**
     * 닉네임으로 플레이어 제거 (재접속 시 사용)
     * 
     * @return 제거된 플레이어가 있으면 true (재접속)
     */
    /**
     * 닉네임으로 플레이어 찾아서 강제 퇴장 (Kick 등) - 필요 시 구현
     * 현재는 재접속 로직이 addPlayer로 이동했으므로 단순화
     */
    public boolean removePlayerByUsername(String username) {
        // 더 이상 재접속을 위해 미리 지우지 않음.
        // addPlayer에서 처리하므로 여기서는 아무것도 하지 않거나 false 리턴.
        return false;
    }

    /**
     * 현재 방의 플레이어 수 반환
     */
    public int getPlayerCount() {
        return players.size();
    }

    /**
     * 해당 닉네임의 플레이어가 존재하는지 확인 (연결/비연결 불문)
     */
    public boolean hasPlayer(String username) {
        for (PlayerState p : players.values()) {
            if (p.getUsername().equals(username)) {
                return true;
            }
        }
        return false;
    }

    public void addPlayer(WebSocketSession session, String username) {
        // [NEW] 재접속 체크
        String oldSessionId = null;
        PlayerState existingPlayer = null;

        for (Map.Entry<String, PlayerState> entry : players.entrySet()) {
            PlayerState p = entry.getValue();
            if (p.getUsername().equals(username) && p.isDisconnected()) {
                oldSessionId = entry.getKey();
                existingPlayer = p;
                break;
            }
        }

        // 재접속 처리
        if (existingPlayer != null && oldSessionId != null) {
            log.info("Player {} reconnected! Restoring state...", username);

            // 1. Map Key 교체 (Old Session ID -> New Session ID)
            players.remove(oldSessionId);
            players.put(session.getId(), existingPlayer);
            sessions.put(session.getId(), session);

            // 2. 상태 복구
            existingPlayer.setDisconnected(false);
            existingPlayer.setDisconnectTime(0);

            // 3. 슬롯 정보 업데이트
            for (int i = 0; i < 4; i++) {
                if (oldSessionId.equals(slots[i])) {
                    slots[i] = session.getId();
                    break;
                }
            }

            // 4. 재접속 알림 (JOIN 대신 다른 메시지 사용 가능하나, 프론트 처리를 위해 일단 JOIN/UPDATE로 커버)
            // 프론트엔드에서 '자신의 캐릭터'를 다시 인식하려면 JOIN 메시지 필요할 수 있음.
            // JOIN 메시지는 GameService에서 보냄.

            return;
        }

        // [신규 입장]
        // 1. 빈 슬롯 찾기 (0번부터 순차 탐색)
        int assignedSlot = -1;
        for (int i = 0; i < 4; i++) {
            if (slots[i] == null) {
                slots[i] = session.getId();
                assignedSlot = i;
                break;
            }
        }

        if (assignedSlot == -1) {
            log.warn("Room {} is full, cannot add player {}", roomId, username);
            return;
        }

        sessions.put(session.getId(), session);
        // 초기 시작 위치 (100, 100)
        PlayerState newPlayer = new PlayerState(username, 100, 100);
        newPlayer.setColorIndex(assignedSlot); // [NEW] 슬롯 번호 할당
        players.put(session.getId(), newPlayer);

        // 첫 번째 플레이어가 방장
        if (hostUsername == null) {
            hostUsername = username;
            log.info("Host set to {} in room {}", username, roomId);
        }
    } // 현재 명세에는 없으므로 패스, 혹은 가장 오래된 유저에게 부여 등.

    /**
     * 강제 퇴장 (방장이 특정 유저를 내보냄)
     */
    public void kickPlayer(String username) {
        // username으로 세션 찾기
        String targetSessionId = findSessionIdByUsername(username);
        if (targetSessionId == null) {
            return;
        }

        WebSocketSession targetSession = sessions.get(targetSessionId);

        // 퇴장 처리
        sessions.remove(targetSessionId);
        players.remove(targetSessionId);

        // 강퇴된 유저에게 알림
        if (targetSession != null && targetSession.isOpen()) {
            try {
                GameMessageDto kickedMsg = new GameMessageDto();
                kickedMsg.setType("KICKED");
                kickedMsg.setRoomId(roomId);
                kickedMsg.setContent("You have been kicked from the room");
                targetSession.sendMessage(new TextMessage(objectMapper.writeValueAsString(kickedMsg)));
            } catch (Exception e) {
                log.error("Failed to send kick message to {}", username, e);
            }
        }

        // 다른 플레이어들에게 알림
        GameMessageDto leaveMsg = new GameMessageDto();
        leaveMsg.setType("PLAYER_LEFT");
        leaveMsg.setRoomId(roomId);
        leaveMsg.setUsername(username);
        leaveMsg.setContent("Kicked by host");
        broadcast(leaveMsg, null);

        log.info("Player {} kicked from room {}", username, roomId);
    }

    /**
     * 플레이어 위치 업데이트 (Client-Authoritative)
     * 클라이언트가 보낸 좌표를 그대로 신뢰하고 저장
     */
    public void updatePlayerPosition(String sessionId, Double x, Double y, Double vx, Double vy, String anim) {
        PlayerState player = players.get(sessionId);
        if (player == null)
            return;

        // 마지막 업데이트 시간 갱신 (AFK 감지용)
        player.touch();

        player.setX(x);
        player.setY(y);
        if (vx != null)
            player.setVx(vx);
        if (vy != null)
            player.setVy(vy);
        if (anim != null)
            player.setAnim(anim);

        // [NEW] 물리적 Idle 방지를 위해 입력 시간 갱신 (패킷이 들어왔으므로 입력이 있는 것)
        player.updateInputTimestamp();
    }

    /**
     * 방 내의 참가자들에게 메시지를 전송하는 기능 (Broadcasting)
     * Service 계층에서 세션 목록을 직접 순회하지 않도록 캡슐화함.
     * * @param message 전송할 메시지 객체
     *
     * @param excludeSessionId 전송에서 제외할 세션 ID (본인 등) - null이면 전원 전송
     */
    public void broadcast(GameMessageDto message, String excludeSessionId) {
        try {
            TextMessage textMsg = new TextMessage(objectMapper.writeValueAsString(message));
            for (WebSocketSession s : sessions.values()) {
                if (s.isOpen()) {
                    // 제외 대상이 아니거나, 제외 대상이 없으면 전송
                    if (excludeSessionId == null || !s.getId().equals(excludeSessionId)) {
                        s.sendMessage(textMsg);
                    }
                }
            }
        } catch (Exception e) {
            log.error("Broadcast Error in Room {}", roomId, e);
        }
    }

    /**
     * 방 폭파 알림 (방장 퇴장 시)
     */
    public void broadcastRoomClosed() {
        try {
            GameMessageDto closeMsg = new GameMessageDto();
            closeMsg.setType("ROOM_CLOSED");
            closeMsg.setRoomId(roomId);
            closeMsg.setContent("Host left the room");

            TextMessage textMsg = new TextMessage(objectMapper.writeValueAsString(closeMsg));
            for (WebSocketSession s : sessions.values()) {
                if (s.isOpen()) {
                    s.sendMessage(textMsg);
                }
            }

            // 게임 루프 종료
            this.isRunning = false;
        } catch (Exception e) {
            log.error("Broadcast Room Closed Error in Room {}", roomId, e);
        }
    }

    // 입력 처리
    public void handleInput(WebSocketSession session, String inputType) {
        if (!players.containsKey(session.getId()))
            return;
        inputQueue.offer(new InputEvent(session.getId(), inputType));
    }

    // --- 닉네임으로 세션 ID 찾기 ---
    public String findSessionIdByUsername(String username) {
        for (Map.Entry<String, PlayerState> entry : players.entrySet()) {
            if (entry.getValue().getUsername().equals(username)) {
                return entry.getKey(); // Session ID 반환
            }
        }
        return null;
    }

    // --- 랜덤 플레이어 세션 ID 찾기 ---
    public String getRandomPlayerSessionId() {
        if (players.isEmpty())
            return null;

        List<String> keys = new ArrayList<>(players.keySet());
        Random random = new Random();
        return keys.get(random.nextInt(keys.size()));
    }

    // 저주 이벤트 트리거
    public void triggerCurseEvent(String targetSessionId, boolean isPositive) {
        PlayerState p = players.get(targetSessionId);
        if (p == null)
            return;

        if (isPositive) {
            // 긍정적인 말: 모든 저주 해제
            p.clearCurses();
            // 시스템 메시지 전송 (선택 사항)
            // broadcastSystemMessage(p.getUsername() + "님이 긍정의 힘으로 저주를 풀었습니다!");
        } else {
            // 부정적인 말: 랜덤 저주 적용
            CurseType[] curses = CurseType.values();
            CurseType randomCurse = curses[new Random().nextInt(curses.length)];
            p.addCurse(randomCurse);
            // broadcastSystemMessage(p.getUsername() + "님이 부정적인 말로 저주에 걸렸습니다: " +
            // randomCurse);
        }
    }

    @Override
    public void run() {
        log.info("🚀 Game Loop Started (Relay Mode): {}", roomId);

        while (isRunning) {
            try {
                // 1. AFK 체크 및 처리
                checkAfkPlayers();

                // 2. 자동 퇴장 처리 (10초 이상 업데이트 없음)
                checkDisconnectedPlayers();

                // [REVERTED] 3. 물리 업데이트 제거 (Client-Authoritative 충돌 방지)
                // updatePhysics(0.05);

                // 4. 브로드캐스트 (20 TPS)
                broadcastState();

                // 33ms 대기 (약 30 TPS)
                Thread.sleep(33);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                break;
            }
        }
        log.info("🏁 Game Loop Ended: {}", roomId);
    }

    /**
     * AFK 플레이어 체크 및 처리 (속도 0, 중력 적용)
     */
    private void checkAfkPlayers() {
        for (PlayerState player : players.values()) {
            player.checkAfkStatus();
        }
    }

    /**
     * 자동 퇴장 처리 (방장 제외)
     * 방장은 AFK 상태여도 자동 퇴장하지 않음 (최소화/백그라운드 허용)
     */
    private void checkDisconnectedPlayers() {
        long now = System.currentTimeMillis();
        List<String> toRemove = new ArrayList<>();

        for (Map.Entry<String, PlayerState> entry : players.entrySet()) {
            String sid = entry.getKey();
            PlayerState p = entry.getValue();

            // 방장은 예외? -> 방장도 연결 끊기면 처리해야 함.
            // 단, 방장의 removePlayer 로직에서 이미 방 폭파가 처리되므로 여기까진 안 올 수 있음.
            // 하지만 'Timeout'으로 인한 연결 끊김 처리는 여기서 수행.

            if (p.isDisconnected()) {
                // 이미 Disconnected 상태인 경우 -> 3분 체크
                if (now - p.getDisconnectTime() > RECONNECT_TIMEOUT_MS) {
                    toRemove.add(sid);
                    log.info("Player {} removed due to reconnect timeout (3min)", p.getUsername());
                }
            } else {
                // 활성 상태인데 업데이트가 너무 오래 없는 경우 (Network Failure)
                // shouldDisconnect -> 10초 이상 업데이트 없음
                if (p.shouldDisconnect()) {
                    // Soft Disconnect 처리
                    p.setDisconnected(true);
                    p.setDisconnectTime(now);

                    // 세션 맵에서 제거 (물리적 연결 끊김 간주)
                    WebSocketSession s = sessions.remove(sid);
                    if (s != null && s.isOpen()) {
                        try {
                            s.close();
                        } catch (Exception ignore) {
                        }
                    }

                    log.info("Player {} soft-disconnected due to inactivity (timeout)", p.getUsername());

                    GameMessageDto discMsg = new GameMessageDto();
                    discMsg.setType("PLAYER_DISCONNECTED");
                    discMsg.setRoomId(roomId);
                    discMsg.setUsername(p.getUsername());
                    // broadcast 대상에서 본인은 이미 제외됨 (sessions에서 제거됨)
                    broadcast(discMsg, null);
                }
            }
        }

        // 진짜 삭제 (3분 경과)
        for (String sessionId : toRemove) {
            PlayerState removed = players.remove(sessionId);

            // 슬롯 정리
            for (int i = 0; i < 4; i++) {
                if (sessionId.equals(slots[i])) {
                    slots[i] = null;
                    break;
                }
            }

            if (removed != null) {
                // 완전히 나감 -> PLAYER_LEFT
                GameMessageDto leaveMsg = new GameMessageDto();
                leaveMsg.setType("PLAYER_LEFT");
                leaveMsg.setRoomId(roomId);
                leaveMsg.setUsername(removed.getUsername());
                leaveMsg.setContent("Disconnected timeout");
                broadcast(leaveMsg, null);
            }
        }

        // 방에 아무도 없으면 (Disconnected 포함? 아니면 활성 세션 기준?)
        // 재접속 기다리는 플레이어가 있으면 방 유지? -> 네, 유지.
        // 단, players 맵이 비면 종료.
        if (players.isEmpty()) {
            this.isRunning = false;
        }
    }

    // --- Pause / Resume Implementations ---

    public void pause(String requestUser) {
        if (!requestUser.equals(hostUsername))
            return;

        this.state = GameState.PAUSED;
        log.info("Room {} Paused by {}", roomId, requestUser);

        GameMessageDto msg = new GameMessageDto();
        msg.setType("GAME_PAUSED");
        msg.setRoomId(roomId);
        broadcast(msg, null);
    }

    public void resume(String requestUser) {
        if (!requestUser.equals(hostUsername))
            return;

        this.state = GameState.RUNNING;
        log.info("Room {} Resumed by {}", roomId, requestUser);

        GameMessageDto msg = new GameMessageDto();
        msg.setType("GAME_RESUMED");
        msg.setRoomId(roomId);
        broadcast(msg, null);
    }

    private void processInputs() {
        while (!inputQueue.isEmpty()) {
            InputEvent event = inputQueue.poll();
            PlayerState p = players.get(event.sessionId);
            if (p == null)
                continue;

            switch (event.inputType) {
                case "LEFT_DOWN" -> p.setInputX(-1);
                case "RIGHT_DOWN" -> p.setInputX(1);
                case "LEFT_UP", "RIGHT_UP" -> p.setInputX(0);
                case "JUMP" -> p.setInputJump(true); // 점프 예약
            }

            // [NEW] 입력 시간 갱신 (물리적 Idle 방지)
            p.updateInputTimestamp();
        }
    }

    private void updatePhysics(double dt) {
        for (PlayerState player : players.values()) {
            // 1. 물리 연산 (저주 효과, 이동, 중력 적용)
            player.update(dt);

            // 2. 타일맵 충돌 해결
            collisionManager.resolveCollision(player);
        }
        // TODO: 게임 클리어/실패 조건 체크 로직 추가 가능
    }

    private void broadcastState() {
        try {
            // 전체 플레이어 상태를 리스트로 변환 (slots 순서대로)
            List<Object> stateList = new ArrayList<>();

            for (int i = 0; i < 4; i++) {
                String sid = slots[i];
                if (sid == null)
                    continue;
                PlayerState p = players.get(sid);
                if (p == null)
                    continue;

                Map<String, Object> pData = new HashMap<>();
                pData.put("serverTick", System.currentTimeMillis());
                pData.put("id", p.getUsername());
                // 소수점 2자리 반올림 (대역폭 절약)
                pData.put("x", Math.round(p.getX() * 100) / 100.0);
                pData.put("y", Math.round(p.getY() * 100) / 100.0);
                pData.put("vx", p.getVx());
                pData.put("vy", p.getVy());
                pData.put("anim", p.getAnim()); // 애니메이션 상태 추가

                // [NEW] 핵심 데이터 추가
                pData.put("colorIndex", p.getColorIndex());
                pData.put("isHost", p.getUsername().equals(this.hostUsername));

                // 저주로 크기 변경 시 클라이언트에 전달
                pData.put("width", p.getWidth());
                pData.put("height", p.getHeight());
                pData.put("hp", p.getHp());
                pData.put("isDead", p.isDead());
                pData.put("isAfk", p.isAfk()); // AFK 상태 추가
                pData.put("curses", p.getActiveCurses().keySet());
                stateList.add(pData);
            }

            GameMessageDto msg = new GameMessageDto();
            msg.setType("UPDATE");
            msg.setRoomId(roomId);
            // [NEW] 팀 저주 스택 추가 (브로드캐스트에 포함)
            msg.setContent(objectMapper.writeValueAsString(stateList));
            // 별도 필드가 없으므로 content에 넣거나, DTO 확장이 필요할 수 있음.
            // 하지만 Client는 UPDATE 메시지의 content(Player List) 외에 Room State도 필요함.
            // 일단 GameMessageDto에 필드가 제한적이므로, 별도 메시지로 스택 업데이트를 보내거나
            // UPDATE 메시지의 구조를 변경해야 함.
            // 여기서는 안전하게 별도로 가거나, content 내부에 포함시킴.
            // 하지만 content는 String(JSON)이므로, 구조를 바꾸면 프론트 파싱이 깨질 수 있음.
            // 따라서 33ms마다 보내는 UPDATE에는 Player 정보만 넣고,
            // 스택 변경 시에만 별도 메시지 전송 로직(addCurseStack)을 사용함.
            // 다만, 중간 중간 싱크를 위해 가끔 보내는 것도 좋음.
            // 일단 여기서는 Player List만 보냄.

            TextMessage textMsg = new TextMessage(objectMapper.writeValueAsString(msg));

            // 모든 세션에 전송
            for (WebSocketSession s : sessions.values()) {
                if (s.isOpen())
                    s.sendMessage(textMsg);
            }
        } catch (Exception e) {
            log.error("Broadcast Error in Room {}", roomId, e);
        }
    }

    /**
     * 팀 저주 스택 증가
     * 
     * @param delta 증가량 (1, 3, 5 등)
     */
    public void addCurseStack(int delta) {
        this.teamCurseStack += delta;
        // Max 제한 없음? 아니면 10 넘으면 발동?
        // 발동 조건: 10 이상
        log.info("Curse Stack Added: +{} -> {}", delta, teamCurseStack);

        if (this.teamCurseStack >= MAX_CURSE_STACK) {
            triggerRandomCurse();
            this.teamCurseStack = 0; // 리셋
        }

        // 스택 업데이트 브로드캐스트
        broadcastStackUpdate();
    }

    private void broadcastStackUpdate() {
        GameMessageDto msg = new GameMessageDto();
        msg.setType("CURSE_STACK_UPDATE");
        msg.setRoomId(roomId);
        msg.setContent(String.valueOf(teamCurseStack)); // Content에 현재 스택 담아 전송
        broadcast(msg, null);
    }

    private void triggerRandomCurse() {
        // 살아있는(연결된) 플레이어 중 랜덤 1명
        List<String> activePlayers = new ArrayList<>();
        for (String sessId : sessions.keySet()) {
            if (players.containsKey(sessId)) {
                activePlayers.add(sessId);
            }
        }

        if (activePlayers.isEmpty())
            return;

        Random random = new Random();
        String victimSessionId = activePlayers.get(random.nextInt(activePlayers.size()));
        PlayerState victim = players.get(victimSessionId);

        if (victim != null) {
            log.info("Curses triggered on {}!", victim.getUsername());
            // 저주 효과 적용 (PlayerState에 저주 추가)
            // 예: "SIZE_UP", "FOG", "STUN" 등 타입 필요.
            // 임시로 "TEST_CURSE" 또는 기존 로직 사용.
            // 기존 triggerCurseEvent 호출?
            applyCurseEffect(victim);

            // 알림
            GameMessageDto msg = new GameMessageDto();
            msg.setType("CURSE_TRIGGERED");
            msg.setRoomId(roomId);
            msg.setUsername(victim.getUsername());
            msg.setContent("Random Curse Activated!");
            broadcast(msg, null);
        }
    }

    /**
     * 실제 저주 효과 적용
     */
    private void applyCurseEffect(PlayerState p) {
        // 임시: 랜덤 저주 하나 선택
        CurseType[] types = CurseType.values();
        // None 제외
        CurseType selected = types[new Random().nextInt(types.length)];

        // 명세: "저주 해제: 버튼 + 긍정어" -> 즉, 시간제한이 아니라 '조건부 해제'일 가능성 큼.
        // 따라서 Duration은 무시하고 Enum 타입으로 추가함.
        p.addCurse(selected);
    }

    /**
     * 저주 해제 시도 (버튼 + 긍정어)
     */
    public void attemptCurseLift(String username) {
        String sessionId = findSessionIdByUsername(username);
        if (sessionId == null)
            return;

        PlayerState p = players.get(sessionId);
        if (p == null)
            return;

        // 모든 저주 해제
        if (!p.getActiveCurses().isEmpty()) {
            p.getActiveCurses().clear();
            log.info("Curse Lifted for {}", username);

            GameMessageDto msg = new GameMessageDto();
            msg.setType("CURSE_LIFTED");
            msg.setRoomId(roomId);
            msg.setUsername(username);
            msg.setContent("All curses lifted by positive speech!");
            broadcast(msg, null);
        }
    }

    // 내부 레코드 (InputEvent)
    private record InputEvent(String sessionId, String inputType) {
    }
}