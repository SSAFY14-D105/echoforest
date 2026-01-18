# 🐍 AI 서버 구축 가이드 (FastAPI + Conda)

이 가이드는 **Miniforge**를 사용하여 **`ai-server`** 가상환경을 구축하고 FastAPI를 실행하는 방법을 설명합니다.

---

## 1. 가상환경 구축 (Conda/Miniforge)

터미널(또는 Miniforge Prompt)에서 아래 명령어를 순서대로 입력하세요.

### ① 환경 생성
```bash
# ai-server라는 이름의 python 3.10 환경 생성
conda create -n ai-server python=3.10 -y
```

### ② 환경 활성화
```bash
conda activate ai-server
```

### ③ 필수 패키지 설치
```bash
# numpy 2.0 버전 이슈 방지 (torch 충돌)
pip install "numpy<2.0"

# FastAPI 및 서버 구동 패키지
pip install fastapi uvicorn pydantic

# AI 모델 관련 패키지 (PyTorch + Transformers)
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
pip install transformers
```

---

## 2. FastAPI 기본 구조 (Sample)

`main.py` 파일을 생성하고 아래 코드를 작성합니다.

```python
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

class TextRequest(BaseModel):
    text: str

@app.post("/analyze")
async def analyze_sentiment(request: TextRequest):
    # TODO: Unsmile 모델 로직 연결
    print(f"Received text: {request.text}")
    return {
        "label": "clean",
        "score": 0.99
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

---

## 3. 실행 방법
```bash
python main.py
```
이제 `http://localhost:8000/docs`에 접속하면 Swagger 문서가 나타납니다.

---

### 💡 다음 단계
- `ai-server` 환경이 준비되면, **Unsmile 모델**을 Load하는 클래스를 구현할 예정입니다.
