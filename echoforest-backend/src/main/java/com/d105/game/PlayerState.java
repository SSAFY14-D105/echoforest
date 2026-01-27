package com.d105.game;

import com.d105.game.constant.CurseType;
import lombok.Data;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Data
public class PlayerState {
    private String username;

    // 1. 위치 및 물리 변수 (클라이언트 전달용)
    private double x;
    private double y;
    private double vx = 0; // X축 속도
    private double vy = 0; // Y축 속도
    private boolean isGrounded = false; // 클라이언트에서 받아옴

    // 2. 캐릭터 스탯
    private double width = 40.0;
    private double height = 40.0; // 커짐 저주용
    private int hp = 100; // 저주용 HP
    private boolean isDead = false;
    private String anim = "idle_down";

    // 슬롯 번호 (0: 초록, 1: 파랑, 2: 노랑, 3: 보라)
    private int colorIndex;

    // 마지막 입력 시간 (Idle 처리를 위해 필요)
    private long lastInputTime = System.currentTimeMillis();

    // 3. AFK(잠수) 감지용
    private long lastUpdateTime = System.currentTimeMillis();
    private boolean isAfk = false;
    private static final long AFK_THRESHOLD_MS = 1500; // 1.5초간 업데이트 없으면 AFK 간주
    private static final long DISCONNECT_THRESHOLD_MS = 300000; // 5분간 업데이트 없으면 퇴장

    // 4. 입력 상태 (단순 저장)
    private volatile int inputX = 0;
    private volatile boolean inputJump = false;

    // 5. 저주 상태 관리
    private Map<CurseType, Long> activeCurses = new ConcurrentHashMap<>();

    // 6. 재접속 관리
    private boolean isDisconnected = false;
    private long disconnectTime = 0;

    public PlayerState(String username, double startX, double startY) {
        this.username = username;
        this.x = startX;
        this.y = startY;
        this.lastUpdateTime = System.currentTimeMillis();
    }

    public void touch() {
        this.lastUpdateTime = System.currentTimeMillis();
        this.isAfk = false;
    }

    public void updateInputTimestamp() {
        this.lastInputTime = System.currentTimeMillis();
    }

    public void checkAfkStatus() {
        long now = System.currentTimeMillis();
        if (now - lastUpdateTime > AFK_THRESHOLD_MS) {
            isAfk = true;
            // AFK 상태라 해도 속도를 강제로 0으로 만들지 않음 (클라이언트 신뢰)
            // 다만 클라이언트가 멈췄다면 vx=0 패킷이 올 것임.
        } else {
            isAfk = false;
        }
    }

    public boolean shouldDisconnect() {
        return (System.currentTimeMillis() - lastUpdateTime) > DISCONNECT_THRESHOLD_MS;
    }

    public void addCurse(CurseType type) {
        activeCurses.put(type, System.currentTimeMillis());
    }

    public void clearCurses() {
        activeCurses.clear();
    }
}