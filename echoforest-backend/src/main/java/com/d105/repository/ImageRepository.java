package com.d105.repository;

import com.d105.entity.Image;
import com.d105.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ImageRepository extends JpaRepository<Image, Long> {

    // 특정 유저의 이미지 목록
    List<Image> findByUserOrderByCreatedAtDesc(User user);

    // 특정 방에서 찍은 이미지 목록
    List<Image> findByRoomCodeOrderByCreatedAtDesc(String roomCode);

    // 특정 유저의 이미지 개수
    long countByUser(User user);
}
