#!/bin/sh
# LiveKit 설정 파일 동적 생성 스크립트
# 환경 변수를 사용하여 livekit.yaml 생성

set -e

# YAML 파일 생성 (탭 대신 스페이스 사용)
cat > /tmp/livekit.yaml << EOFCONFIG
port: 7880
rtc:
  port_range_start: 60000
  port_range_end: 60200
  use_external_ip: true
keys:
  ${LIVEKIT_API_KEY}: ${LIVEKIT_API_SECRET}
EOFCONFIG

echo "Generated LiveKit config:"
cat /tmp/livekit.yaml

exec /livekit-server --config /tmp/livekit.yaml
