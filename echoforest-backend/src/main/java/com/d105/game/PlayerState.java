package com.d105.game;

import com.d105.game.constant.CurseType;
import lombok.Data;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Data
public class PlayerState {
    private String username;

    // 1. 위치 및 물리 변수
    private double x;
    private double y;
    private double vx = 0; // X축 속도
    private double vy = 0; // Y축 속도 (중력 적용)

    // 2. 캐릭터 스탯
    private double width = 40.0; // 기본 크기
    private double height = 40.0;
    private int hp = 100; // 체력 (저주용)
    private boolean isDead = false;
    private boolean isGrounded = false; // 바닥에 닿았는지 여부
    private String anim = "idle_down"; // 현재 애니메이션 상태

    // [NEW] 슬롯 번호 (0: 초록, 1: 파랑, 2: 노랑, 3: 보라)
    private int colorIndex;

    // [NEW] 마지막 입력 시간 (Idle 처리를 위해 필요)
    private long lastInputTime = System.currentTimeMillis();

    // 3. AFK(잠수) 감지용
    private long lastUpdateTime = System.currentTimeMillis();
    private boolean isAfk = false;
    private static final long AFK_THRESHOLD_MS = 500; // 1초간 업데이트 없으면 AFK
    private static final long DISCONNECT_THRESHOLD_MS = 300000; // 5분간 업데이트 없으면 퇴장 대상
    private static final double GROUND_Y = 560.0; // 바닥 Y 좌표 (맵에 맞게 조정)

    // 4. 물리 상수 (튜닝 필요)
    private static final double MOVE_SPEED = 300.0;
    private static final double JUMP_FORCE = -600.0; // Y축 위로 점프 (음수)
    private static final double GRAVITY = 50.0; // AFK 시 적용할 간단한 중력
    private static final double TERMINAL_VELOCITY = 800.0; // 낙하 최대 속도

    // 5. 입력 상태
    private volatile int inputX = 0; // -1, 0, 1
    private volatile boolean inputJump = false; // 점프 키 입력 여부

    // 6. 저주 상태 관리
    private Map<CurseType, Long> activeCurses = new ConcurrentHashMap<>();

    // 7. 재접속 관리
    private boolean isDisconnected = false;
    private long disconnectTime = 0;

    // 7. TIME_BOMB 저주용 누적 데미지
    private double accumulatedDamage = 0;

    public PlayerState(String username, double startX, double startY) {
        this.username = username;
        this.x = startX;
        this.y = startY;
        this.lastUpdateTime = System.currentTimeMillis();
    }

    /**
     * AFK 상태 체크 및 처리
     */
    public void checkAfkStatus() {
        long now = System.currentTimeMillis();
        long elapsed = now - lastUpdateTime;

        if (elapsed > AFK_THRESHOLD_MS) {
            isAfk = true;
            // AFK 시 속도 강제 0
            vx = 0;

            // 공중에 떠있으면 중력 적용 (간단한 낙하)
            if (!isGrounded && y < GROUND_Y) {
                y += GRAVITY; // 간단한 중력 적용
                if (y >= GROUND_Y) {
                    y = GROUND_Y;
                    isGrounded = true;
                    vy = 0;
                }
            }
        } else {
            isAfk = false;
        }
    }

    /**
     * 퇴장 대상인지 확인 (10초 이상 업데이트 없음)
     */
    public boolean shouldDisconnect() {
        return (System.currentTimeMillis() - lastUpdateTime) > DISCONNECT_THRESHOLD_MS;
    }

    /**
     * 업데이트 시간 갱신
     */
    public void touch() {
        this.lastUpdateTime = System.currentTimeMillis();
        this.isAfk = false;
    }

    // [NEW] 입력 시간 갱신
    public void updateInputTimestamp() {
        this.lastInputTime = System.currentTimeMillis();
    }

    /**
     * 물리 업데이트 (Tick Loop에서 호출)
     * 충돌 처리는 TileCollisionManager에서 별도로 수행
     * 
     * @param dt 델타 타임 (초 단위, 예: 1/60 = 0.0167)
     */
    public void update(double dt) {
        long now = System.currentTimeMillis();

        // [NEW] 1초 이상 입력 패킷이 없으면 이동 입력을 0으로 초기화 (물리적 Idle)
        if (now - this.lastInputTime > 1000) {
            this.inputX = 0;
            this.inputJump = false;
            // 단, 중력은 아래에서 계속 적용됨 (자연스러운 낙하)
        }

        if (isDead)
            return;

        // --- 1. 저주 효과 적용 ---
        applyCurseEffects(dt);

        // --- 2. 물리 연산 (X축: 이동) ---
        // 저주(INVERT) 적용된 입력값 계산
        int finalInputX = inputX;
        if (activeCurses.containsKey(CurseType.INVERT_CONTROL)) {
            finalInputX = -finalInputX; // 입력 반전
        }

        // 저주(BIG_AND_SLOW) 적용된 속도 계산
        double currentSpeed = MOVE_SPEED;
        if (activeCurses.containsKey(CurseType.BIG_AND_SLOW)) {
            currentSpeed *= 0.5; // 속도 반감
        }

        this.vx = finalInputX * currentSpeed;
        this.x += this.vx * dt;

        // --- 3. 물리 연산 (Y축: 중력 & 점프) ---
        // 점프 시도 (바닥에 있을 때만)
        if (inputJump && isGrounded) {
            this.vy = JUMP_FORCE;
            this.isGrounded = false;
            this.inputJump = false; // 점프 트리거 해제
        }

        // 중력 적용
        this.vy += GRAVITY * dt;
        if (this.vy > TERMINAL_VELOCITY)
            this.vy = TERMINAL_VELOCITY;

        // 위치 적용
        this.y += this.vy * dt;
    }

    private void applyCurseEffects(double dt) {
        long now = System.currentTimeMillis();

        // [저주 1] TIME_BOMB: 일정 시간마다 HP 감소 (dt 기반 누적 데미지)
        if (activeCurses.containsKey(CurseType.TIME_BOMB)) {
            double damagePerSecond = 10.0;
            accumulatedDamage += damagePerSecond * dt;

            // 누적 데미지가 1 이상이면 HP 감소
            if (accumulatedDamage >= 1.0) {
                int damage = (int) accumulatedDamage;
                this.hp -= damage;
                accumulatedDamage -= damage;
            }

            if (this.hp <= 0) {
                this.hp = 0;
                this.isDead = true;
            }
        } else {
            // TIME_BOMB 저주가 없으면 누적 데미지 초기화
            accumulatedDamage = 0;
        }

        // [저주 2] BIG_AND_SLOW: 크기 변화
        if (activeCurses.containsKey(CurseType.BIG_AND_SLOW)) {
            this.width = 80.0; // 2배 커짐
            this.height = 80.0;
        } else {
            this.width = 40.0; // 원상 복구
            this.height = 40.0;
        }
    }

    // 저주 추가
    public void addCurse(CurseType type) {
        activeCurses.put(type, System.currentTimeMillis());
    }

    // 저주 해제 (긍정적인 말 감지 시 호출)
    public void removeCurse(CurseType type) {
        activeCurses.remove(type);
    }

    // 모든 저주 해제
    public void clearCurses() {
        activeCurses.clear();
    }
}