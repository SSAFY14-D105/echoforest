# 한국어 온라인 혐오 표현 탐지 고도화 연구 및 가이드

본 문서는 스마일게이트 AI의 **UnSmile Dataset**과 **KcELECTRA** 모델을 활용하여, 온라인상의 혐오 표현 및 내재적 부정 언행을 효과적으로 탐지하기 위한 연구 전략과 실행 가이드를 정리한 것입니다.

---

## 1. 프로젝트 개요
### 배경 및 목표
- **현황**: 익명성 기반 온라인 커뮤니티의 혐오 표현 심화 및 지능형 악플(비꼬기, 돌려까기 등 내재적 혐오) 증가.
- **목표**: 단순 욕설 탐지를 넘어, 문맥에 숨겨진 혐오를 포착하는 **다중 라벨(Multi-label) 분류 모델** 구축.
- **핵심 모델**: `beomi/KcELECTRA-v2022` (네이버 뉴스 댓글 1.1억 개 학습, 구어체/신조어 특화).

### 모델 비교
| 모델 | 파라미터 | 용량 | 특징 | 추천 용도 |
|------|----------|------|------|-----------|
| **KcELECTRA-base** | 1.1억 개 | 475MB | 정밀한 문맥 이해 | **고성능** 서버용, 앙상블 메인 |
| **KcELECTRA-small** | 1,400만 개 | 53MB | 빠른 추론 속도 | **실시간** 서비스, 모바일/엣지 |

---

## 2. 5대 학습 시나리오 (전략)
성능과 자원 효율성을 고려하여 다음 5가지 시나리오를 검토합니다.

1.  **데이터 고도화**: 기존 UnSmile 라벨 외에 **'비꼬기(Sarcasm)', '무례함' 등 내재적 혐오 라벨 추가**. KOLD(Korean Offensive Language Dataset) 계층 구조 참조.
2.  **신조어 대응 증강**: 최신 밈(Meme), 변칙적 신조어가 포함된 데이터를 K/DA 파이프라인 등으로 증강하여 학습.
3.  **Base 모델 표준 학습**: 가장 안정적인 성능 확보를 위한 기본 파이프라인. 시그모이드(Sigmoid) 활성화 함수 사용.
4.  **경량화 (지식 증류)**: Base 모델(Teacher)의 정보를 Small 모델(Student)에 전수하여, **97% 성능 유지 & 1/8 크기** 달성.
5.  **앙상블 (Ensemble)**: KcBERT(MLM 방식)와 KcELECTRA(RTD 방식)를 함께 학습시켜 보팅(Voting)하여 정확도 극대화.

---

## 3. 성능 향상 방법론 (Advanced)
단순 Fine-tuning 이상의 정확도를 확보하기 위한 기술입니다.

-   **GAN 기반 데이터 증강**: `HateGAN`, `GranulGAN`을 활용해 적대적 예제(Adversarial examples)를 생성, 모델의 견고성(Robustness) 강화.
-   **다중 라벨 대조 학습 (MulSupCon)**: 라벨 간의 상관관계를 학습하여, '성차별'이면서 동시에 '인격모독'인 복합적 혐오를 더 잘 구분.
-   **적응형 임계값 (Threshold Optimization)**: 모든 라벨에 0.5를 적용하는 대신, `CS-Cut` 등을 통해 각 라벨(카테고리)별 최적의 임계값을 설정.

---

## 4. 단계별 실행 가이드 (Implementation)

### [단계 1] 데이터 준비 및 전처리
다중 라벨 분류를 위해 데이터를 이진 벡터 포맷으로 변환합니다.
-   **도구**: `scikit-learn`의 `MultiLabelBinarizer`
-   **형식**: `['여성/가족', '욕설']` → `[1, 0, 1, 0, ...]`

### [단계 2] 모델 구성
-   **아키텍처**: KcELECTRA-base-v2022
-   **출력층**: `Sigmoid` (Softmax 아님)
-   **Loss Function**: `BCEWithLogitsLoss`
    -   *팁*: 데이터 불균형 해소를 위해 희소 라벨에 `pos_weight`를 부여하거나, **Asymmetric Loss** 사용 고려.

### [단계 3] 학습 및 최적화
-   **Fine-tuning**: 기본 학습 진행.
-   **Knowledge Distillation**: 실시간 처리가 중요하다면 학습된 Base 모델을 Teacher로 하여 Small 모델 재학습.
-   **Thresholding**: 검증 데이터(Validation Set) 기준으로 F1-score가 최대가 되는 임계값 탐색.

---

## 5. 참고 리소스
프로젝트 구현 시 유용한 참조 자료입니다.

-   **블로그 (Strongly Recommended)**:
    -   [Velog (kkaram) - KcELECTRA Multi-Label Classification](https://velog.io/) (실무 관점의 A-Z 가이드)
    -   [Tistory - Smilegate Unsmile AI 사용법](https://tistory.com/) (빠른 파이프라인 테스트)
-   **GitHub**:
    -   [Beomi/KcBERT-Finetune](https://github.com/Beomi/KcBERT-finetune): KcELECTRA 제작자의 공식 학습 코드.
    -   Unsmile AI Dataset: 스마일게이트 공식 데이터셋.