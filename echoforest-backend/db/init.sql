-- ==========================================
-- 0. Database 생성 및 선택
-- ==========================================
CREATE DATABASE IF NOT EXISTS echoforest DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE echoforest;

-- Users
CREATE TABLE users (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE COMMENT '로그인 아이디',
    password VARCHAR(255) NOT NULL,
    nickname VARCHAR(20) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL,

    -- 게임 통계
    kiss_count INT DEFAULT 0 COMMENT '누적 뽀뽀 횟수',
    curse_count INT DEFAULT 0 COMMENT '누적 저주 횟수',
    manner_score DECIMAL(4,1) DEFAULT 36.5 COMMENT '매너점수 = 36.5 + (kiss * 0.1) - (curse * 0.2)',

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Maps
CREATE TABLE maps (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    map_name VARCHAR(100) NOT NULL,
    tile_data JSON NOT NULL,
    bgm_path VARCHAR(100),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Images (모션 인식 캡처 사진)
CREATE TABLE images (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL COMMENT '사진을 찍은 유저 (업로더)',
    file_name VARCHAR(100) NOT NULL,
    
    -- 확장 필드
    map_id BIGINT NULL COMMENT '어느 맵에서 찍었는지',
    stage_number INT NULL COMMENT '몇 번째 스테이지에서 찍었는지',
    room_code VARCHAR(10) NULL COMMENT '어느 방에서 찍었는지',
    image_type VARCHAR(20) DEFAULT 'MOTION' COMMENT 'MOTION(모션인식), RESULT(결과화면) 등',
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (map_id) REFERENCES maps(id) ON DELETE SET NULL
);

-- Image Participants (함께 찍은 유저들, 최대 3명)
CREATE TABLE image_participants (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    image_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (image_id) REFERENCES images(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 인덱스 설정 (조회 성능 최적화)
CREATE INDEX idx_users_nickname ON users(nickname);
CREATE INDEX idx_images_user ON images(user_id);
CREATE INDEX idx_images_room ON images(room_code);
CREATE INDEX idx_participants_image ON image_participants(image_id);

-- ==========================================
-- 더미 데이터 (개발/테스트용)
-- ==========================================

-- 유저 (비밀번호: BCrypt 해시된 'password123')
INSERT INTO users (username, password, nickname, email, kiss_count, curse_count, manner_score) VALUES
('user1', '$2a$10$N.0cmPzwJMpSjGxUjN8vXOBjNLqMCz1pJzVwLq7FnOVTPJxLH0kfC', '에코뽀왕', 'user1@test.com', 15, 3, 37.9),
('user2', '$2a$10$N.0cmPzwJMpSjGxUjN8vXOBjNLqMCz1pJzVwLq7FnOVTPJxLH0kfC', '숲속탐험가', 'user2@test.com', 8, 5, 36.3),
('user3', '$2a$10$N.0cmPzwJMpSjGxUjN8vXOBjNLqMCz1pJzVwLq7FnOVTPJxLH0kfC', '저주마스터', 'user3@test.com', 2, 20, 32.7),
('user4', '$2a$10$N.0cmPzwJMpSjGxUjN8vXOBjNLqMCz1pJzVwLq7FnOVTPJxLH0kfC', '뉴비개구리', 'user4@test.com', 0, 0, 36.5);

-- 맵
INSERT INTO maps (map_name, tile_data, bgm_path) VALUES
('에코숲', '{"width": 20, "height": 15, "tiles": []}', '/audio/bgm/echo_forest.mp3'),
('미로정원', '{"width": 25, "height": 20, "tiles": []}', '/audio/bgm/maze_garden.mp3'),
('크리스탈동굴', '{"width": 30, "height": 18, "tiles": []}', '/audio/bgm/crystal_cave.mp3');

-- 이미지 샘플 (4명이 함께 찍은 사진)
INSERT INTO images (user_id, file_name, map_id, stage_number, room_code, image_type) VALUES
(1, 'motion_20260121_001.webp', 1, 2, 'ABC123', 'MOTION'),
(1, 'result_20260121_001.webp', 1, NULL, 'ABC123', 'RESULT');

-- 함께 찍은 유저들 (이미지 1번에 user2, user3, user4)
INSERT INTO image_participants (image_id, user_id) VALUES
(1, 2), (1, 3), (1, 4);