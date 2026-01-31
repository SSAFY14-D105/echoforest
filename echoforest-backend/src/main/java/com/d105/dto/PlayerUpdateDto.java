package com.d105.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.Set;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PlayerUpdateDto {
    private long serverTick;
    private String id;
    private double x;
    private double y;
    private double vx;
    private double vy;
    private String anim;

    // Core Data
    private int colorIndex;
    @JsonProperty("isHost")
    private boolean isHost;

    // Status
    private double width;
    private double height;
    private int hp;
    @JsonProperty("isDead")
    private boolean isDead;
    @JsonProperty("isHidden")
    private boolean isHidden; // [NEW] 숨김 상태 (골인 등)
    @JsonProperty("isAfk")
    private boolean isAfk;
    @JsonProperty("isDisconnected")
    private boolean isDisconnected;

    // Active Curses
    private Set<String> curses;
}
