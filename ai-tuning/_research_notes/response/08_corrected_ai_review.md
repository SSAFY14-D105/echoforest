# 📉 AI 기술 심층 피드백 및 수정 제안 v2 (최종 수정본)

팀원님의 피드백을 반영하여 **자음 전면 삭제** 및 **Web Speech API 스타일 노이즈 주입(Augmentation)** 전략으로 최종 확정한 리뷰입니다.

---

## 1. 자음 처리: 완전 삭제 (Full Removal)

### 결정 배경 (Why?)
- **현실성**: Web Speech API는 `ㅋㅋ`, `ㅎㅎ` 같은 자음을 텍스트로 출력하지 않습니다. 따라서 학습 데이터에 자음이 남아 있으면 모델이 실전 환경과 다른 데이터 분포를 배우게 됩니다.
- **전략**: Unsmile 데이터셋(및 수집된 데이터)에서 모든 한글 자음(`ㄱ-ㅎ`)을 정규식으로 **깨끗이 지웁니다.**
- **품질 관리**: 자음을 지운 후 남은 텍스트 길이가 극단적으로 짧아지거나(예: 1글자), 의미가 사라진 데이터는 학습에서 **제외(Drop)**합니다.

### ✅ 구현 전략
```python
class TextNormalizer:
    def normalize(self, text):
        # 1. 자음 완전 제거 (ㄱ-ㅎ) -> STT 환경 모방
        text = re.sub(r'[ㄱ-ㅎ]+', '', text)
        
        # 2. 다중 공백 제거
        text = re.sub(r'\s+', ' ', text).strip()
        return text

    # 전처리 후 길이가 너무 짧으면(예: 1글자 이하) 데이터셋에서 Drop
```

---

## 2. 데이터 증강: Web Speech API 스타일 노이즈 (Noise Injection)

### 결정 배경 (Why?)
- **현실성**: Web Speech API(구글 STT)는 실시간 스트리밍 특성상 문장의 **끝부분이 잘리거나**, **앞부분을 놓치거나**, 중간 단어를 **건너뛰는** 오류가 빈번합니다.
- **전략**: Python으로 깨끗하게 수집된 데이터(YouTube STT)를 일부러 **망가뜨려(Augmentation)** 모델이 이런 불완전한 문장에도 강건하게 대응하도록 만듭니다.

### ✅ 구현 전략 (30% 비율 적용)
```python
def web_speech_augment(text):
    words = text.split()
    if len(words) < 2: return text
    
    rand = random.random()
    
    # 1. 문장 끝 생략 (가장 빈번) - 60% 확률
    if rand < 0.6:
        # 마지막 1~2 단어 삭제 ("왜 저렇게 플레이해" -> "왜 저렇게")
        return ' '.join(words[:-random.randint(1, 2)])
        
    # 2. 중간 생략 (발음 뭉개짐) - 30% 확률
    elif rand < 0.9: 
        # 중간 임의 단어 삭제 ("아 진짜 답답하다" -> "아 답답하다")
        idx = random.randint(1, len(words)-2)
        return ' '.join(words[:idx] + words[idx+1:])
        
    # 3. 앞부분 생략 (인식 늦음) - 10% 확률
    else:
        # 첫 단어 삭제 ("야 너 뭐하냐" -> "너 뭐하냐")
        return ' '.join(words[1:])
```
이 증강 기법은 전체 학습 데이터의 약 **30%**에 적용하여 원본(깨끗한 데이터)과 노이즈(실전 데이터)를 모두 학습하게 합니다.

---

## 3. VAD 도구 확인: Silero VAD
- **역할**: YouTube 오디오 전처리용 (Windows 호환성 최우수).
- **확정**: `silero-vad`를 사용하여 오디오 데이터를 전처리합니다.

---

## 4. 학습 데이터셋 구축 전략 (Data Leakage 방지 필수)

**반드시 지켜야 할 순서**:
1. **Split**: 먼저 Train / Val / Test로 데이터를 나눈다.
2. **Oversampling**: 오직 **Train Set**에 대해서만 `negative_morale` 데이터를 5배 복제한다.
3. **Augmentation**: 오버샘플링된 Train Set에 위에서 정의한 노이즈를 주입한다.

이 순서만 지키면 데이터 누수 없이 완벽한 학습 셋이 구축됩니다.

---

## 📝 최종 결론
이전 버전(`06_adjusted...`)에서 **자음 처리 부분만 수정**하고 나머지는 그대로 진행합니다.

1. **데이터 전처리 Key**: 자음 싹 지우기 + Web Speech 노이즈 섞기 (30%).
2. **모델**: Unsmile (`klue/roberta-base`) Base + New Head.
3. **환경**: Conda + Silero VAD (Windows OK).

이 계획대로라면 실전(인게임)에서 가장 강력한 성능을 낼 것입니다. Good to go! 🚀
