# ========================================================
# 1. 빌드 단계 (Builder)
# ========================================================
FROM gradle:8.5-jdk21 AS builder

WORKDIR /app

# 프로젝트 소스 전체 복사
COPY . .

# ./gradlew 스크립트 대신, 이미 설치된 'gradle' 명령어를 직접 사용합니다.
# 이렇게 하면 윈도우 줄바꿈(CRLF) 문제나 권한(Permission) 문제가 원천적으로 발생하지 않습니다.
RUN gradle clean build -x test --no-daemon

# ========================================================
# 2. 실행 단계 (Runtime)
# ========================================================
FROM bellsoft/liberica-openjdk-alpine:21

WORKDIR /app

# 빌드 결과물(JAR) 복사
COPY --from=builder /app/build/libs/*.jar app.jar

EXPOSE 9001

ENTRYPOINT ["java", "-jar", "app.jar"]