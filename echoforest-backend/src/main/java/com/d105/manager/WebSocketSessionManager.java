package com.d105.manager;

import com.d105.dto.GameMessageDto;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 전역 WebSocket 세션 관리자
 * - 로비, 게임방 구분 없이 현재 접속 중인 모든 사용자의 WebSocket 세션을 관리합니다.
 * - 중복 로그인 처리를 위해 사용됩니다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class WebSocketSessionManager {

    private final ObjectMapper objectMapper;

    // Username -> WebSocketSession
    private final Map<String, WebSocketSession> sessions = new ConcurrentHashMap<>();

    /**
     * 세션 등록
     * 
     * @param username 사용자명
     * @param session  WebSocket 세션
     */
    public void addSession(String username, WebSocketSession session) {
        sessions.put(username, session);
        log.info("Registered global session for user: {}", username);
    }

    /**
     * 세션 제거 (Safe)
     * 저장된 세션이 요청된 세션과 일치할 때만 제거합니다.
     * 
     * @param username 사용자명
     * @param session  제거 대상 세션
     */
    public void removeSession(String username, WebSocketSession session) {
        sessions.computeIfPresent(username, (key, existingSession) -> {
            if (existingSession.getId().equals(session.getId())) {
                log.info("Removed global session for user: {} (Session ID: {})", username, session.getId());
                return null; // 제거
            }
            return existingSession; // 유지
        });
    }

    /**
     * 세션 제거 (Unsafe - Force)
     * 
     * @param username 사용자명
     */
    public void removeSession(String username) {
        sessions.remove(username);
        log.info("Removed global session for user: {} (Force)", username);
    }

    /**
     * 세션 조회
     * 
     * @param username 사용자명
     * @return WebSocketSession or null
     */
    public WebSocketSession getSession(String username) {
        return sessions.get(username);
    }

    /**
     * 특정 사용자 강제 퇴장 (중복 로그인 등)
     * 
     * @param username 타겟 사용자명
     * @param reason   퇴장 사유
     */
    public void kickSession(String username, String reason) {
        WebSocketSession session = sessions.get(username);
        if (session != null && session.isOpen()) {
            try {
                log.info("Kicking session {} for user {} due to: {}", session.getId(), username, reason);

                // 알림 메시지 전송
                GameMessageDto msg = new GameMessageDto();
                msg.setType("DUPLICATE_LOGIN");
                msg.setContent("다른 기기에서 로그인하여 접속이 종료됩니다.");

                synchronized (session) {
                    session.sendMessage(new TextMessage(objectMapper.writeValueAsString(msg)));
                    
                    // [FIX] 메시지 전송 보장을 위해 잠시 대기
                    try {
                        Thread.sleep(200);
                    } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                    }

                    session.close(org.springframework.web.socket.CloseStatus.POLICY_VIOLATION.withReason(reason));
                }
            } catch (IOException e) {
                log.error("Failed to kick user {}", username, e);
            } finally {
                // 여기서 removeSession(username, session)을 호출하면 좋겠지만,
                // afterConnectionClosed가 닫힘 이벤트를 받아 처리할 것이므로 중복 제거 방지
                // 다만 명시적으로 제거하고 싶다면:
                removeSession(username, session);
            }
        }
    }
}
