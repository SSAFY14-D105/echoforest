//package com.d105.service;
//
//import jakarta.mail.MessagingException;
//import jakarta.mail.internet.MimeMessage;
//import lombok.RequiredArgsConstructor;
//import lombok.extern.slf4j.Slf4j;
//import org.springframework.core.io.ByteArrayResource;
//import org.springframework.mail.javamail.JavaMailSender;
//import org.springframework.mail.javamail.MimeMessageHelper;
//import org.springframework.stereotype.Service;
//
//@Slf4j
//@Service
//@RequiredArgsConstructor
//public class EmailService {
//
//    private final JavaMailSender javaMailSender;
//
//    /**
//     * 이미지를 첨부하여 이메일 발송
//     *
//     * @param toEmail   수신자 이메일
//     * @param subject   제목
//     * @param text      본문
//     * @param imageBytes 이미지 데이터 (byte[])
//     * @param fileName  첨부파일 이름
//     */
//    public void sendEmailWithImage(String toEmail, String subject, String text, byte[] imageBytes, String fileName) {
//        log.info("Sending email to: {}", toEmail);
//        try {
//            MimeMessage message = javaMailSender.createMimeMessage();
//            // multipart: true (첨부파일 허용)
//            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
//
//            helper.setTo(toEmail);
//            helper.setSubject(subject);
//            helper.setText(text, true); // html 허용
//
//            // 이미지 첨부
//            if (imageBytes != null && imageBytes.length > 0) {
//                helper.addAttachment(fileName, new ByteArrayResource(imageBytes));
//            }
//
//            javaMailSender.send(message);
//            log.info("Email sent successfully to {}", toEmail);
//
//        } catch (MessagingException e) {
//            log.error("Failed to send email to {}", toEmail, e);
//            // 이메일 발송 실패가 게임 로직(이미지 저장 등)을 롤백시키지 않도록 예외를 삼키거나 커스텀 예외 처리
//            // 여기서는 로그만 남김
//        }
//    }
//}