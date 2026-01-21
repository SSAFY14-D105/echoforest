# ========================================================
# 1. 빌드 단계 (Builder)
# - Gradle과 Java 21이 설치된 환경에서 소스를 빌드합니다.
# ========================================================
FROM gradle:8.5-jdk21 AS builder

# 작업 폴더 생성
WORKDIR /app

# 프로젝트 소스 전체를 도커 안으로 복사
COPY . .

# 윈도우 줄바꿈 문자(\r) 제거
RUN gradle clean build -x test --no-daemon

# Gradle 빌드 실행 (테스트 생략, 권한 부여)
RUN chmod +x ./gradlew
RUN ./gradlew clean build -x test --no-daemon

# ========================================================
# 2. 실행 단계 (Runtime)
# - 사용자가 선택한 Liberica JDK 21 (Alpine Linux 기반) 사용
# ========================================================
# bellsoft/liberica-openjdk-alpine:21 은 매우 가볍고 안정적입니다.
FROM bellsoft/liberica-openjdk-alpine:21

# 작업 폴더 생성
WORKDIR /app

# 1단계(builder)에서 만든 JAR 파일만 가져옵니다.
COPY --from=builder /app/build/libs/*.jar app.jar

# 서버 포트 9001번 열기
EXPOSE 9001

# 서버 실행 명령어
ENTRYPOINT ["java", "-jar", "app.jar"]