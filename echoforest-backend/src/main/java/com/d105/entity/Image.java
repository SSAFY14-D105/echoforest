package com.d105.entity;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * 이미지 엔티티 (모션 인식 캡처 사진)
 */
@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@EntityListeners(AuditingEntityListener.class)
@Table(name = "images")
public class Image {

    // 함께 찍은 유저들 (최대 3명)
    @OneToMany(mappedBy = "image", cascade = CascadeType.ALL, orphanRemoval = true)
    private final List<ImageParticipant> participants = new ArrayList<>();
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    // 사진을 찍은 유저 (업로더)
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    // === 확장 필드 ===
    @Column(nullable = false, length = 100)
    private String fileName;
    // 어느 맵에서 찍었는지
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "map_id")
    private Map map;
    // 몇 번째 스테이지에서 찍었는지
    @Column(name = "stage_number")
    private Integer stageNumber;
    // 어느 방에서 찍었는지
    @Column(name = "room_code", length = 10)
    private String roomCode;
    // 이미지 타입 (MOTION, RESULT 등)
    @Column(name = "image_type", length = 20)
    private String imageType;
    @CreatedDate
    @Column(updatable = false)
    private LocalDateTime createdAt;

    // Soft Delete용 플래그 (삭제된 시간)
    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;

    @Builder
    public Image(User user, String fileName, Map map, Integer stageNumber,
                 String roomCode, String imageType) {
        this.user = user;
        this.fileName = fileName;
        this.map = map;
        this.stageNumber = stageNumber;
        this.roomCode = roomCode;
        this.imageType = imageType != null ? imageType : "MOTION";
    }

    // 참여자 추가
    public void addParticipant(User participant) {
        ImageParticipant ip = new ImageParticipant(this, participant);
        this.participants.add(ip);
    }

    // 논리적 삭제 (Soft Delete)
    public void softDelete() {
        this.deletedAt = LocalDateTime.now();
    }
}
