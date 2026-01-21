package com.d105.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;

@Entity
@Getter
@NoArgsConstructor
@EntityListeners(AuditingEntityListener.class)
@Table(name = "maps")
public class Map {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String mapName;

    // JSON 데이터를 Map이나 List 형태로 매핑 (Hibernate 6.x)
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "json")
    private java.util.Map<String, Object> tileData;

    @Column(length = 100)
    private String bgmPath;

    @CreatedDate
    @Column(updatable = false)
    private LocalDateTime createdAt;
}