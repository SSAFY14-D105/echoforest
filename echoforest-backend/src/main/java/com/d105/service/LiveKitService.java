package com.d105.service;

import com.d105.config.LiveKitProperties;
import io.livekit.server.AccessToken;
import io.livekit.server.RoomJoin;
import io.livekit.server.RoomName;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class LiveKitService {

    private final LiveKitProperties livekitProperties;

    /**
     * LiveKit SDK 0.9.0+ 기준 토큰 생성
     */
    public String createToken(String roomId, String userId, String username) {
        // 1. 액세스 토큰 생성 (API Key, Secret 사용)
        AccessToken token = new AccessToken(
                livekitProperties.getApiKey(),
                livekitProperties.getApiSecret()
        );

        // 2. 유저 정보 세팅
        token.setName(username);
        token.setIdentity(userId);

        // 3. 권한 설정
        // VideoGrant 객체를 통째로 만드는 것이 아니라, 필요한 권한 객체(RoomJoin, RoomName 등)를 추가합니다.
        token.addGrants(new RoomJoin(true));   // 방 입장 허용
        token.addGrants(new RoomName(roomId));  // 입장할 방 이름 설정

        // (선택) 만약 발언 권한 등을 명시적으로 제어해야 한다면 아래와 같은 클래스가 있는지 확인 후 추가 가능
        // token.addGrants(new CanPublish(true));
        // 기본적으로 RoomJoin(true) 상태면 대부분의 권한이 열려있습니다.

        // 4. JWT 변환
        return token.toJwt();
    }
}