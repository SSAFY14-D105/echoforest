package com.d105.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Getter
@Setter
@Configuration
@ConfigurationProperties(prefix = "ai.model")
public class AiProperties {
    private String url;    // AI 모델 API 엔드포인트
    private String apiKey; // API Key
}