#!/bin/sh
# LiveKit 설정 파일 동적 생성 스크립트
# 환경 변수를 사용하여 livekit.yaml 생성

cat > /tmp/livekit.yaml << EOF
port: 7880
rtc:
  port_range_start: 60000
  port_range_end: 60200
  use_external_ip: true
keys:
  ${LIVEKIT_API_KEY}: ${LIVEKIT_API_SECRET}
EOF

exec /livekit-server --config /tmp/livekit.yaml
