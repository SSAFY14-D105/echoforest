package com.d105.repository;

import com.d105.entity.Image;
import com.d105.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;

public interface ImageRepository extends JpaRepository<Image, Long> {

    // 특정 유저의 이미지 목록 (삭제되지 않은 것만)
    List<Image> findByUserAndDeletedAtIsNullOrderByCreatedAtDesc(User user);

    // 특정 방에서 찍은 이미지 목록 (삭제되지 않은 것만)
    List<Image> findByRoomCodeAndDeletedAtIsNullOrderByCreatedAtDesc(String roomCode);

    // 특정 방의 특정 타입 이미지 목록 (예: RESULT)
    List<Image> findByRoomCodeAndImageTypeAndDeletedAtIsNullOrderByCreatedAtDesc(String roomCode, String imageType);

    // 기준 날짜보다 이전에 생성된 이미지 목록 조회 (스케줄러용 - 삭제 여부 상관없이 조회)
    List<Image> findByCreatedAtBefore(LocalDateTime cutoffDate);
}
