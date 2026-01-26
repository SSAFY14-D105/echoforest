# 1. 파이썬 버전 선택
FROM python:3.12.12

# 2. 작업 폴더 설정
WORKDIR /code

# 3. 필수 패키지 설치를 위해 requirements.txt 복사
# (이 파일이 release-ai 브랜치에 Dockerfile과 같은 위치에 있어야 합니다)
COPY requirements.txt /code/requirements.txt

# 4. 라이브러리 설치 (캐시 없이 가볍게)
RUN pip install --no-cache-dir --upgrade -r /code/requirements.txt

# 5. 소스 코드 전체 복사
COPY . /code

# 6. 캐시 폴더 생성 (AI 모델 저장용, 권한 설정)
RUN mkdir -p /code/model_cache && chmod 777 /code/model_cache

# 7. 실행 명령어
# (FastAPI의 경우 uvicorn, Flask의 경우 python app.py 등 상황에 맞게 수정)
# 예시: main.py 파일 안에 app 객체가 있는 경우
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]