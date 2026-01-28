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
                case "JOIN": // 방 참가
                    gameService.handleJoin(session, messageDto);
                    break;
                case "MOVE":
                    gameService.handleMove(session, messageDto);
                    break;
                case "PAUSE_GAME":
                    gameService.handlePause(session, messageDto);
                    break;
                case "RESUME_GAME":
                    gameService.handleResume(session, messageDto);
                    break;
                case "LIFT_CURSE_REQUEST":
                    gameService.handleLiftCurseRequest(session, messageDto);
                    break;
                case "PING":
                    gameService.handlePing(session, messageDto);
                    break;
                case "READY": // Ready 상태 변경
                    gameService.handleReady(session, messageDto);
                    break;
                case "START_GAME": // 게임 시작 (방장)
                    gameService.handleStartGame(session, messageDto);
                    break;
                case "NEXT_STAGE": // 다음 스테이지 (방장)
                    gameService.handleNextStage(session, messageDto);
                    break;
                case "GAME_RESET": // 게임 리셋 (협동 실패)
                    gameService.handleGameReset(session, messageDto);
                    break;
                case "STAGE_CLEAR": // 스테이지 클리어 (개별 인원)
                    gameService.handleStageClear(session, messageDto);
                    break;
                // ===== STT 저주 시스템 =====
                case "SPEECH_BATCH": // 발화 배치 분석
                    gameService.handleSpeechBatch(session, messageDto);
                    break;
                case "CURSE_RELEASE": // 저주 해제 요청
                    gameService.handleCurseRelease(session, messageDto);
                    break;
                // ===== Map Object Sync (Hybrid Authority) =====
                case "GIMMICK_UPDATE": // 엘리베이터 등 자동 기믹 동기화 (Host -> Clients)
                    gameService.handleGimmickUpdate(session, messageDto);
                    break;
                case "BLOCK_UPDATE": // 미는 박스 동기화 (Interactor -> Clients)
                    gameService.handleBlockUpdate(session, messageDto);
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