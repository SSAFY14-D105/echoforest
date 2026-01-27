package com.d105.dto;

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
    private boolean isHost;

    // Status
    private double width;
    private double height;
    private int hp;
    private boolean isDead;
    private boolean isAfk;

    // Active Curses
    private Set<String> curses;
}
