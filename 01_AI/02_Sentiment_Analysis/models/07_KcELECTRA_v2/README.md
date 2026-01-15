# KcELECTRA v2 (2022 최신)

한국어 댓글 데이터로 학습된 최신 ELECTRA 모델입니다.

## 모델 정보

| 항목 | 내용 |
|------|------|
| **Hugging Face** | `beomi/KcELECTRA-base-v2022` |
| **개발자** | beomi (이준범) |
| **학습 데이터** | 네이버 뉴스 댓글 ~1억개 |
| **버전** | 2022년 업데이트 |
| **크기** | ~400MB |

## 벤치마크 결과

> 테스트 후 업데이트 예정

## 특징

- **댓글 특화**: 온라인 댓글로 학습 → 비속어, 신조어에 강함
- **최신 버전**: 2022년 업데이트로 더 많은 데이터 학습
- **게임 적합**: 게임 채팅과 유사한 데이터

## v1 vs v2

| 버전 | 학습 데이터 | 특징 |
|------|-------------|------|
| v1 (2020) | ~4천만개 | 구버전 |
| **v2 (2022)** | **~1억개** | 최신, 더 정확 |

## 주의사항

⚠️ 이 모델은 **base 모델**입니다.  
감정 분류를 위해서는 fine-tuning이 필요할 수 있습니다.

## 사용 예시

```python
from transformers import pipeline

# text-classification으로 사용
classifier = pipeline("text-classification", model="beomi/KcELECTRA-base-v2022")
result = classifier("테스트 문장")
print(result)
```

## 링크

- [Hugging Face 페이지](https://huggingface.co/beomi/KcELECTRA-base-v2022)
- [GitHub](https://github.com/Beomi/KcELECTRA)
