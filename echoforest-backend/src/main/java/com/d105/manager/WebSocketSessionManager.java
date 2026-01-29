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
     * 세션 제거
     * 
     * @param username 사용자명
     */
    public void removeSession(String username) {
        sessions.remove(username);
        log.info("Removed global session for user: {}", username);
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
                // 알림 메시지 전송
                GameMessageDto msg = new GameMessageDto();
                msg.setType("DUPLICATE_LOGIN");
                msg.setContent("다른 기기에서 로그인하여 접속이 종료됩니다.");

                synchronized (session) {
                    session.sendMessage(new TextMessage(objectMapper.writeValueAsString(msg)));
                    session.close(org.springframework.web.socket.CloseStatus.POLICY_VIOLATION.withReason(reason));
                }
                log.info("Kicked user {} due to: {}", username, reason);
            } catch (IOException e) {
                log.error("Failed to kick user {}", username, e);
            } finally {
                removeSession(username);
            }
        }
    }
}
