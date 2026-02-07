package com.d105.game.physics;

import com.d105.game.PlayerState;

/**
 * 물리 엔진 (제거됨)
 * 현재 클라이언트 주도(Client-Authoritative) 방식이므로
 * 서버측 물리 연산은 수행하지 않음.
 * 필요 시 검증 로직(Validation)만 추가 가능.
 */
public class PlayerPhysicsEngine {

    private static final double GROUND_Y = 560.0;

    /**
     * 물리 업데이트 (Empty)
     */
    public void update(PlayerState p, double dt) {
        // No-op: 클라이언트 좌표 신뢰
    }

    /**
     * AFK 유저 처리 (최소한의 중력)
     * 완전히 공중에 멈춰있는 것을 방지하기 위함
     */
    public void applyAfkGravity(PlayerState p) {
        if (!p.isGrounded() && p.getY() < GROUND_Y) {
            p.setY(Math.min(p.getY() + 10.0, GROUND_Y));
            if (p.getY() >= GROUND_Y) {
                p.setY(GROUND_Y);
                p.setGrounded(true);
            }
        }
    }
}
