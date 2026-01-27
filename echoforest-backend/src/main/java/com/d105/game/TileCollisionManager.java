package com.d105.game;

import java.util.List;
import java.util.Map;

public class TileCollisionManager {
    private final int tileSize;
    private final int rows;
    private final int cols;
    private final List<List<Integer>> mapData; // 0: 빈공간, 1: 벽(충돌)

    @SuppressWarnings("unchecked")
    public TileCollisionManager(Map<String, Object> tileDataJson) {
        // JSON 파싱 (예외처리 생략, 데이터 구조에 맞춰 조정 필요)
        this.tileSize = (int) tileDataJson.getOrDefault("tileSize", 40);
        this.mapData = (List<List<Integer>>) tileDataJson.get("tiles");
        this.rows = mapData.size();
        this.cols = mapData.get(0).size();
    }

    /**
     * AABB 충돌 체크 및 보정
     * 플레이어의 다음 위치(nextX, nextY)가 벽과 겹치는지 확인하고, 겹친다면 이동 가능한 최대 위치를 반환
     */
    public void resolveCollision(PlayerState player) {
        // 1. X축 이동 시도
        double nextX = player.getX() + player.getVx() * 0.016; // 단순 예측
        if (checkOverlap(nextX, player.getY(), player.getWidth(), player.getHeight())) {
            player.setVx(0); // 벽에 부딪히면 속도 0
            // (정밀하게 하려면 벽면에 딱 붙이는 보정 로직 필요)
        }

        // 2. Y축 이동 시도 (중력 포함)
        double nextY = player.getY() + player.getVy() * 0.016;
        if (checkOverlap(player.getX(), nextY, player.getWidth(), player.getHeight())) {
            if (player.getVy() > 0) { // 아래로 떨어지다가 부딪힘 (바닥 착지)
                player.setGrounded(true);
                // 타일 위에 안착시키기 (Snap to Grid)
                int tileY = (int) ((nextY + player.getHeight()) / tileSize);
                player.setY(tileY * tileSize - player.getHeight() - 0.01);
            } else {
                // 위로 점프하다 천장에 부딪힘
                int tileY = (int) (nextY / tileSize);
                player.setY((tileY + 1) * tileSize + 0.01);
            }
            player.setVy(0);
        } else {
            // 공중 상태
            player.setGrounded(false);
        }
    }

    // 사각형(플레이어)이 벽 타일과 겹치는지 검사
    private boolean checkOverlap(double x, double y, double w, double h) {
        int leftTile = (int) (x / tileSize);
        int rightTile = (int) ((x + w - 0.01) / tileSize);
        int topTile = (int) (y / tileSize);
        int bottomTile = (int) ((y + h - 0.01) / tileSize);

        for (int r = topTile; r <= bottomTile; r++) {
            for (int c = leftTile; c <= rightTile; c++) {
                if (isSolid(r, c)) return true;
            }
        }
        return false;
    }

    private boolean isSolid(int r, int c) {
        if (r < 0 || r >= rows || c < 0 || c >= cols) return true; // 맵 밖은 벽으로 처리
        return mapData.get(r).get(c) == 1; // 1이면 벽
    }
}