# collected_game_chat — 손수 수집·분류한 게임 채팅 데이터

**두 소스**의 실제 게임 음성채팅이 모두 들어 있습니다:
1. 사람들이 **〈메아리의 숲〉(우리 게임)을 플레이하는 걸 녹화 → STT**
2. **YouTube 협동게임 STT**

이 둘에서 손수 골라 정상(clean) / 악플·욕설(negative)로 분류해 모았습니다. (`scripts/`의 자동 YouTube 수집 파이프라인은 이 데이터를 *더 늘리기 위한* 별도 작업)

> 예전 이름 `keywords` → "자동 키워드 매칭"으로 오해돼서 rename.

## 파일
| 파일 | 내용 |
| :--- | :--- |
| `collected_game_chat.json` | 수집한 문장. `clean_sentences`(정상) / `negative_sentences`(악플·욕설)로 구분 |
| `build_train_collected.py` | json → unSmile 10라벨 tsv 변환 → `../datasets/train_collected.tsv`(518) |
| `README.md` | 이 문서 |

## 라벨링 방식 — 악플/욕설 vs clean 이진으로 충분
`clean_sentences` → `clean=1`, `negative_sentences` → `악플/욕설=1` (나머지 8개 혐오 라벨은 0). unSmile 10라벨 포맷을 그대로 쓰되, 게임 맥락에선 **"부정 발언 탐지"** 만 필요하고 혐오 대상(여성/남성/지역/종교…) 세분류는 거의 안 나오기 때문입니다.

| 관점 | 설명 |
| :--- | :--- |
| 게임 컨텍스트 | 필요한 건 "부정적 발언 탐지"이지 혐오 대상 구분이 아님 |
| 10개 카테고리 | 여성/남성/성소수자/인종/연령/지역/종교는 특정 집단 혐오용 → 게임엔 거의 안 나옴 |
| 모델 동작 | unSmile은 multi-label → 라벨 독립 예측. 악플/욕설만 보면 됨 |
| 기획서 | 핵심 목표가 "악플/욕설 Recall 개선" |

> unSmile은 multi-label이라 10개 다 예측하지만, 우리는 **악플/욕설·clean** 만 봅니다.
> 실행: `python build_train_collected.py` → `../datasets/train_collected.tsv`(518) 갱신.
