package com.d105.service;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class EmailService {

    private final JavaMailSender javaMailSender;

    /**
     * 이미지를 첨부하여 이메일 발송
     *
     * @param toEmail    수신자 이메일
     * @param subject    제목
     * @param text       본문
     * @param imageBytes 이미지 데이터 (byte[])
     * @param fileName   첨부파일 이름
     */
    @Async
    public void sendEmailWithImage(String toEmail, String subject, String text, byte[] imageBytes, String fileName) {
        // 단일 이미지 발송 (하위 호환 유지)
        java.util.Map<String, byte[]> images = new java.util.HashMap<>();
        if (fileName != null && imageBytes != null) {
            images.put(fileName, imageBytes);
        }
        sendEmailWithImages(toEmail, subject, text, images);
    }

    /**
     * 여러 이미지를 첨부하여 이메일 발송
     *
     * @param toEmail 수신자 이메일
     * @param subject 제목
     * @param text    본문
     * @param images  이미지 파일명과 데이터 (Map<FileName, Byte[]>)
     */
    @Async
    public void sendEmailWithImages(String toEmail, String subject, String text, java.util.Map<String, byte[]> images) {
        log.info("Sending email with {} images to: {}", (images != null ? images.size() : 0), toEmail);
        try {
            MimeMessage message = javaMailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            helper.setTo(toEmail);
            helper.setSubject(subject);
            helper.setText(text, true);

            if (images != null && !images.isEmpty()) {
                for (java.util.Map.Entry<String, byte[]> entry : images.entrySet()) {
                    if (entry.getValue() != null && entry.getValue().length > 0) {
                        helper.addAttachment(entry.getKey(), new ByteArrayResource(entry.getValue()));
                    }
                }
            }

            javaMailSender.send(message);
            log.info("Email sent successfully to {}", toEmail);

        } catch (MessagingException e) {
            log.error("Failed to send email to {}", toEmail, e);
        }
    }
}