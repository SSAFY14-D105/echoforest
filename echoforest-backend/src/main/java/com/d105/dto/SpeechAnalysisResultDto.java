package com.d105.dto;

import lombok.Data;

@Data
public class SpeechAnalysisResultDto {
    private String roomId;
    private String username;
    private int stackDelta; // 스택 증가량 (예: 5, 3, 1)
    private String sentiment; // "NEGATIVE", "POSITIVE" (참고용)
}
