package com.d105;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;

@SpringBootApplication
@EnableJpaAuditing
public class EchoforestApplication {
    public static void main(String[] args) {
        SpringApplication.run(EchoforestApplication.class, args);
    }
}
