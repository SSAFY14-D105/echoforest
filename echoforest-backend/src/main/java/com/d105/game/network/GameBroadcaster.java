package com.d105.game.network;

import com.d105.dto.GameMessageDto;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.io.IOException;
import java.util.Collection;

@Slf4j
@RequiredArgsConstructor
public class GameBroadcaster {
    private final ObjectMapper objectMapper;
    private final String roomId;

    /**
     * 특정 세션들에게 메시지 전송
     * 
     * @param sessions         대상 세션 목록
     * @param message          전송할 DTO
     * @param excludeSessionId 제외할 세션 ID (없으면 null)
     */
    public void broadcast(Collection<WebSocketSession> sessions, GameMessageDto message, String excludeSessionId) {
        try {
            TextMessage textMsg = new TextMessage(objectMapper.writeValueAsString(message));
            for (WebSocketSession s : sessions) {
                if (s.isOpen()) {
                    if (excludeSessionId == null || !s.getId().equals(excludeSessionId)) {
                        synchronized (s) {
                            try {
                                s.sendMessage(textMsg);
                            } catch (IOException e) {
                                log.warn("Failed to send message to session {}", s.getId(), e);
                            }
                        }
                    }
                }
            }
        } catch (JsonProcessingException e) {
            log.error("Failed to serialize message for room {}", roomId, e);
        }
    }

    public void sendToSingleSession(WebSocketSession session, GameMessageDto message) {
        if (session != null && session.isOpen()) {
            try {
                synchronized (session) {
                    session.sendMessage(new TextMessage(objectMapper.writeValueAsString(message)));
                }
            } catch (IOException e) {
                log.error("Failed to send message to session {}", session.getId(), e);
            }
        }
    }
}
