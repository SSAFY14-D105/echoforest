package com.d105.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GameUpdateDto {
    private String roomId;
    private List<PlayerUpdateDto> players;
    private int teamCurseStack;
}
