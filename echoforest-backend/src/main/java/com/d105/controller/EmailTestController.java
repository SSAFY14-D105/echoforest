package com.d105.controller;

import com.d105.service.EmailService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@Tag(name = "Email Test", description = "이메일 발송 테스트 API")
@RestController
@RequestMapping("/api/test/email")
@RequiredArgsConstructor
public class EmailTestController {

    private final EmailService emailService;

    @Operation(summary = "테스트 이메일 발송", description = "지정된 이메일 주소로 테스트 메일을 발송합니다.")
    @PostMapping("/send")
    public ResponseEntity<Map<String, String>> sendTestEmail(
            @Parameter(description = "수신자 이메일 주소", required = true, example = "test@example.com") @RequestParam String toEmail) {
        String subject = "[EchoForest] 테스트 이메일입니다.";
        String body = """
                <html>
                <body>
                    <h3>테스트 이메일</h3>
                    <p>이 메일은 EchoForest 이메일 발송 기능 테스트를 위해 발송되었습니다.</p>
                    <p>정상적으로 수신되셨다면 이메일 기능이 정상 작동 중입니다! 🎉</p>
                </body>
                </html>
                """;

        // 비동기로 이메일 발송 (별도 스레드에서 실행)
        emailService.sendEmailWithImage(toEmail, subject, body, null, null);

        return ResponseEntity.ok(Map.of(
                "status", "ACCEPTED",
                "message", "이메일 발송 요청이 접수되었습니다. 비동기로 처리됩니다.",
                "toEmail", toEmail));
    }
}
