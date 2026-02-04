package com.d105.game.manager;

import com.d105.game.PlayerState;
import com.d105.game.constant.CurseType;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;

import java.util.ArrayList;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.Queue;
import java.util.Random;

@Slf4j
public class CurseManager {

    private final String roomId;
    private static final int MAX_CURSE_STACK = 10;

    // 팀 공용 저주 스택
    @Getter
    private int teamCurseStack = 0;

    // STT 저주 스택 (별도 관리)
    @Getter
    private int curseStack = 0;

    // 저주 걸린 플레이어 큐 (FIFO)
    private final Queue<String> cursedPlayersQueue = new LinkedList<>();

    private final Random random = new Random();

    public CurseManager(String roomId) {
        this.roomId = roomId;
    }

    /**
     * STT 저주 스택 증가
     * 
     * @return 저주 발동 여부 (스택 >= 10 시 true)
     */
    public boolean addCurseStack(int delta) {
        if (delta <= 0)
            return false;

        this.curseStack += delta;
        log.info("🔮 Room {}: Curse Stack +{} (Current: {}/{})", roomId, delta, curseStack, MAX_CURSE_STACK);

        if (this.curseStack >= MAX_CURSE_STACK) {
            log.info("💀 Room {}: Curse Triggered! (Stack: {})", roomId, curseStack);
            return true;
        }
        return false;
    }

    /**
     * 팀 저주 스택 증가
     * 
     * @return 저주 발동 여부
     */
    public boolean addTeamCurseStack(int delta) {
        this.teamCurseStack += delta;
        log.info("Team Curse Stack Added: +{} -> {}", delta, teamCurseStack);

        if (this.teamCurseStack >= MAX_CURSE_STACK) {
            this.teamCurseStack = 0; // 리셋
            return true;
        }
        return false;
    }

    public void resetCurseStack() {
        this.curseStack = 0;
        log.info("🔮 Room {}: Curse stack reset", roomId);
    }

    /**
     * 저주 큐 초기화 (스테이지 변경 시)
     */
    public void clearCurseQueue() {
        int size = cursedPlayersQueue.size();
        cursedPlayersQueue.clear();
        log.info("🔮 Room {}: 저주 큐 초기화 (기존 {} 명 해제)", roomId, size);
    }

    /**
     * 스택과 큐 모두 초기화 (스테이지 변경 시 통합 호출)
     */
    public void resetAll() {
        resetCurseStack();
        clearCurseQueue();
    }

    /**
     * 저주 큐에 플레이어 추가 (스택 10 도달 시)
     *
     * @param username 저주 걸린 플레이어
     */
    public void addToCurseQueue(String username) {
        if (username == null) {
            log.warn("🔮 Room {}: null 플레이어는 저주 큐에 추가할 수 없음", roomId);
            return;
        }

        // [방어적 프로그래밍] 이론상 발생하지 않아야 하지만 중복 체크
        if (cursedPlayersQueue.contains(username)) {
            log.error("🔮 Room {}: {} 이미 저주 큐에 있음! (이론상 발생 불가, 버그 가능성)", roomId, username);
            return;
        }

        cursedPlayersQueue.add(username);
        log.info("💀 Room {}: {} 저주 큐에 추가 (큐 크기: {})", roomId, username, cursedPlayersQueue.size());
    }

    /**
     * 저주 큐에서 FIFO로 플레이어 해제
     *
     * @return 해제된 플레이어 Username (큐가 비어있으면 null)
     */
    public String releaseFromCurseQueue() {
        String released = cursedPlayersQueue.poll();
        if (released != null) {
            log.info("✨ Room {}: {} 저주 큐에서 해제 (남은 큐 크기: {})", roomId, released, cursedPlayersQueue.size());
        }
        return released;
    }

    /**
     * 저주 큐에 플레이어가 있는지 확인
     */
    public boolean isPlayerCursed(String username) {
        return cursedPlayersQueue.contains(username);
    }

    /**
     * 저주 큐가 비어있는지 확인
     */
    public boolean isCurseQueueEmpty() {
        return cursedPlayersQueue.isEmpty();
    }

    /**
     * 저주 큐 크기 반환
     */
    public int getCurseQueueSize() {
        return cursedPlayersQueue.size();
    }

    /**
     * 랜덤 플레이어에게 저주 적용
     * 
     * @param players 현재 플레이어 맵
     * @return 저주에 걸린 플레이어의 Username (없으면 null)
     */
    public String triggerRandomCurse(Map<String, PlayerState> players) {
        List<PlayerState> activePlayers = new ArrayList<>(players.values());
        // [TODO] 연결 끊긴 플레이어 제외 로직 추가 가능

        if (activePlayers.isEmpty())
            return null;

        PlayerState victim = activePlayers.get(random.nextInt(activePlayers.size()));
        applyRandomCurseEffect(victim);

        return victim.getUsername();
    }

    private void applyRandomCurseEffect(PlayerState p) {
        CurseType[] types = CurseType.values();
        // None check logic if needed, assuming all enums are valid curses
        CurseType selected = types[random.nextInt(types.length)];

        p.addCurse(selected);
        log.info("Player {} cursed with {}", p.getUsername(), selected);
    }

    /**
     * 특정 플레이어에게 저주 적용/해제 (이벤트 트리거용)
     */
    public void triggerCurseEvent(PlayerState p, boolean isPositive) {
        if (isPositive) {
            p.clearCurses();
        } else {
            applyRandomCurseEffect(p);
        }
    }
}
