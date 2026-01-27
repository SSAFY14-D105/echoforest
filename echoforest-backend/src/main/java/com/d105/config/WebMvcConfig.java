package com.d105.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebMvcConfig implements WebMvcConfigurer {

    // 나중에 application.properties에서 경로를 바꿀 수 있게 변수화
    // 기본값: 운영체제별 임시 폴더가 아닌, 프로젝트 실행 위치 기준 'uploads' 폴더
    @Value("${file.upload-dir:./uploads/}")
    private String uploadDir;

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        // 1. 접근 URL 패턴: /images/** 로 들어오는 요청을 잡음
        // 2. 실제 파일 경로: 로컬 디스크의 uploadDir 위치로 연결
        registry.addResourceHandler("/images/**")
                .addResourceLocations("file:" + uploadDir);
    }
}