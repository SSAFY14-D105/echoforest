-- ==========================================
-- 0. Database 생성 및 선택
-- ==========================================
CREATE DATABASE IF NOT EXISTS echoforest DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE echoforest;

-- ==========================================
-- 1. Users (기존 Member 엔티티 확장)
-- 담당: 회원 정보 및 기본 스탯
-- ==========================================
CREATE TABLE users (
                       id BIGINT AUTO_INCREMENT PRIMARY KEY,
                       login_id VARCHAR(50) NOT NULL UNIQUE COMMENT '로그인 아이디',
                       password VARCHAR(255) NOT NULL COMMENT '암호화된 비밀번호',
                       nickname VARCHAR(20) NOT NULL UNIQUE COMMENT '닉네임',
                       email VARCHAR(100) NOT NULL COMMENT '이메일',

    -- 추가된 게임 데이터
                       level INT DEFAULT 1 COMMENT '유저 레벨',
                       manner_score DECIMAL(4,1) DEFAULT 36.5 COMMENT '매너 점수 (기본 36.5)',
                       kiss_count INT DEFAULT 0 COMMENT '뽀뽀 횟수 (성공 횟수)',

                       created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                       updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==========================================
-- 2. Maps (맵 데이터)
-- 담당: 맵 메타데이터 및 타일 정보 (JSON)
-- ==========================================
CREATE TABLE maps (
                      id BIGINT AUTO_INCREMENT PRIMARY KEY,
                      map_name VARCHAR(100) NOT NULL COMMENT '맵 이름',
                      creator_id BIGINT COMMENT '맵 제작자 ID (User FK)',

    -- 맵 데이터는 구조가 복잡하므로 JSON 타입 권장
                      tile_data JSON NOT NULL COMMENT '타일 배치 데이터 (2차원 배열 or 객체)',

    -- 이미지는 URL(경로)만 저장
                      thumbnail_url VARCHAR(255) COMMENT '맵 썸네일 이미지 경로',

                      is_official BOOLEAN DEFAULT FALSE COMMENT '공식 맵 여부',
                      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

                      FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE SET NULL
);

-- ==========================================
-- 3. Gimmicks (기믹 정보)
-- 담당: 맵 내 상호작용 요소 (함정, 포탈 등)
-- ==========================================
CREATE TABLE gimmicks (
                          id BIGINT AUTO_INCREMENT PRIMARY KEY,
                          map_id BIGINT NOT NULL,

                          gimmick_type VARCHAR(50) NOT NULL COMMENT 'TRAP, PORTAL, NPC, ITEM',

    -- 위치 정보 (그리드 좌표 또는 실수 좌표)
                          pos_x DECIMAL(10,2) NOT NULL,
                          pos_y DECIMAL(10,2) NOT NULL,

    -- 트리거 조건 및 추가 속성 (JSON으로 유연하게 저장)
    -- 예: { "damage": 10, "target_map_id": 5 }
                          attributes JSON COMMENT '기믹별 상세 속성 및 트리거 조건',

                          FOREIGN KEY (map_id) REFERENCES maps(id) ON DELETE CASCADE
);

-- ==========================================
-- 4. GameSessions (게임 기록)
-- 담당: 종료된 게임의 로그 저장 (실시간 상태는 Redis 권장)
-- ==========================================
CREATE TABLE game_sessions (
                               id BIGINT AUTO_INCREMENT PRIMARY KEY,
                               room_id VARCHAR(50) NOT NULL COMMENT 'UUID 또는 방 코드',
                               map_id BIGINT,

    -- 참여자 목록을 JSON 배열로 저장 (예: [1, 5, 8])
                               player_ids JSON COMMENT '참여한 유저 ID 목록',

                               status VARCHAR(20) DEFAULT 'ENDED' COMMENT 'PLAYING, ENDED, ABORTED',
                               started_at DATETIME,
                               ended_at DATETIME,

                               FOREIGN KEY (map_id) REFERENCES maps(id) ON DELETE SET NULL
);

-- ==========================================
-- 5. CringeStats (오글거림/욕설 통계)
-- 담당: 유저별 상호작용 카운트 로그
-- ==========================================
CREATE TABLE cringe_stats (
                              id BIGINT AUTO_INCREMENT PRIMARY KEY,
                              user_id BIGINT NOT NULL,
                              session_id BIGINT COMMENT '어떤 게임에서 발생했는지 (선택)',

                              stat_type VARCHAR(20) NOT NULL COMMENT 'AFFECTION(애정표현), CURSE(욕설)',
                              count_value INT DEFAULT 1 COMMENT '발생 횟수',

                              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

                              FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                              FOREIGN KEY (session_id) REFERENCES game_sessions(id) ON DELETE SET NULL
);

-- 인덱스 설정 (조회 성능 최적화)
CREATE INDEX idx_users_nickname ON users(nickname);
CREATE INDEX idx_cringe_user ON cringe_stats(user_id, stat_type);