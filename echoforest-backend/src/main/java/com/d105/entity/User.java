package com.d105.entity;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.ColumnDefault;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@EntityListeners(AuditingEntityListener.class)
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 50)
    private String username; // 로그인 아이디 (login_id → username)

    @Column(nullable = false)
    private String password;

    @Column(nullable = false, unique = true, length = 20)
    private String nickname;

    @Column(nullable = false, length = 100)
    private String email;

    // 게임 통계
    @Column(name = "kiss_count")
    @ColumnDefault("0")
    private Integer kissCount;

    @Column(name = "curse_count")
    @ColumnDefault("0")
    private Integer curseCount;

    @Column(name = "manner_score", precision = 4, scale = 1)
    @ColumnDefault("36.5")
    private BigDecimal mannerScore;

    @CreatedDate
    @Column(updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate
    private LocalDateTime updatedAt;

    @Builder
    public User(String username, String password, String nickname, String email) {
        this.username = username;
        this.password = password;
        this.nickname = nickname;
        this.email = email;
        // 기본값 설정
        this.kissCount = 0;
        this.curseCount = 0;
        this.mannerScore = new BigDecimal("36.5");
    }

    /**
     * 닉네임 변경
     */
    public void changeNickname(String newNickname) {
        this.nickname = newNickname;
    }
}