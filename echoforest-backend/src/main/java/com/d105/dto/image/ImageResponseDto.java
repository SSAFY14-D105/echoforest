package com.d105.dto.image;

import com.d105.entity.Image;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

/**
 * 이미지 응답 DTO
 */
@Data
@Builder
public class ImageResponseDto {
    private Long imageId;
    private String fileName;
    private String url;
    private Long userId;
    private String userNickname;
    private Long mapId;
    private Integer stageNumber;
    private String roomCode;
    private String imageType;
    private List<ParticipantDto> participants; // 함께 찍은 유저들
    private LocalDateTime createdAt;

    public static ImageResponseDto from(Image image) {
        List<ParticipantDto> participantDtos = image.getParticipants().stream()
                .map(ip -> ParticipantDto.builder()
                        .userId(ip.getUser().getId())
                        .nickname(ip.getUser().getNickname())
                        .build())
                .collect(Collectors.toList());

        return ImageResponseDto.builder()
                .imageId(image.getId())
                .fileName(image.getFileName())
                .url("/images/" + image.getFileName())
                .userId(image.getUser().getId())
                .userNickname(image.getUser().getNickname())
                .mapId(image.getMap() != null ? image.getMap().getId() : null)
                .stageNumber(image.getStageNumber())
                .roomCode(image.getRoomCode())
                .imageType(image.getImageType())
                .participants(participantDtos)
                .createdAt(image.getCreatedAt())
                .build();
    }

    @Data
    @Builder
    public static class ParticipantDto {
        private Long userId;
        private String nickname;
    }
}
