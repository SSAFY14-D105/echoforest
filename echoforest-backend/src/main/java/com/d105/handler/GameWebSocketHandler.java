package com.d105.handler;

import com.d105.dto.GameMessageDto;
import com.d105.service.GameService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

@Slf4j
@Component
@RequiredArgsConstructor
public class GameWebSocketHandler extends TextWebSocketHandler {

    private final GameService gameService;
    private final ObjectMapper objectMapper;

    @Override
    public void handleTextMessage(WebSocketSession session, TextMessage message) {
        String payload = message.getPayload();

        if (payload == null || payload.trim().isEmpty()) {
            return;
        }

        try {
            GameMessageDto messageDto = objectMapper.readValue(payload, GameMessageDto.class);

            switch (messageDto.getType()) {
                case "CREATE": // 방 생성
                    gameService.handleCreate(session, messageDto);
                    break;
                case "JOIN":   // 방 참가 (없으면 에러)
                    gameService.handleJoin(session, messageDto);
                    break;
                case "MOVE":
                    gameService.handleMove(session, messageDto);
                    break;
                case "PING":
                    gameService.handlePing(session, messageDto);
                    break;
                default:
                    log.warn("Unknown message type: {}", messageDto.getType());
            }

        } catch (JsonProcessingException e) {
            log.error("JSON Error: {}", payload);
        } catch (Exception e) {
            log.error("Handler Error", e);
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        gameService.handleLeave(session);
    }
}