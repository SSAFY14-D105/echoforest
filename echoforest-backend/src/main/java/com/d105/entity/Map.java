package com.d105.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Getter
@NoArgsConstructor
@Table(name = "maps")
public class Map {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String mapName;

    // JSON 데이터를 Map이나 List 형태로 매핑 (Hibernate 6.x)
    // 예시 데이터: {"tiles": [[0,0,0],[1,1,1]...], "width": 100, "tileSize": 40}
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "json")
    private java.util.Map<String, Object> tileData;
}