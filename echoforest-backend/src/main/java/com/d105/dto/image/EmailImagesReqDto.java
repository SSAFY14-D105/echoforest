package com.d105.dto.image;

import lombok.Getter;
import lombok.NoArgsConstructor;
import java.util.List;

@Getter
@NoArgsConstructor
public class EmailImagesReqDto {
    private Long userId;
    private List<Long> imageIds;
}
