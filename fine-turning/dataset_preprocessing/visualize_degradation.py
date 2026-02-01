"""
텍스트 손실 시각화 도구
손실 패턴을 색상으로 표시하여 확인
"""
from korean_phonetics import KoreanPhoneticReplacer


class DegradationVisualizer:
    """텍스트 손실 시각화"""

    # ANSI 색상 코드
    COLORS = {
        'red': '\033[91m',
        'green': '\033[92m',
        'yellow': '\033[93m',
        'blue': '\033[94m',
        'magenta': '\033[95m',
        'cyan': '\033[96m',
        'reset': '\033[0m',
        'bold': '\033[1m',
        'underline': '\033[4m'
    }

    def __init__(self):
        self.replacer = KoreanPhoneticReplacer()

    def highlight_diff(self, original: str, degraded: str) -> str:
        """
        원본과 손실 텍스트 차이 강조

        Returns:
            색상 코드가 포함된 문자열
        """
        # 단순 비교 (더 정교한 diff 알고리즘도 가능)
        orig_words = original.split()
        deg_words = degraded.split()

        result = []
        for i, (o, d) in enumerate(zip(orig_words, deg_words)):
            if o != d:
                result.append(f"{self.COLORS['red']}{d}{self.COLORS['reset']}")
            else:
                result.append(d)

        # 길이 차이 처리
        if len(orig_words) > len(deg_words):
            result.append(f"{self.COLORS['yellow']}[...누락됨]{self.COLORS['reset']}")
        elif len(deg_words) > len(orig_words):
            result.extend(deg_words[len(orig_words):])

        return ' '.join(result)

    def visualize_samples(self, num_samples: int = 10, error_rate: float = 0.8):
        """
        샘플 텍스트에 손실 적용 및 시각화

        Args:
            num_samples: 생성할 샘플 수
            error_rate: 손실 확률 (높게 설정하여 테스트)
        """
        test_sentences = [
            "안녕하세요 반갑습니다",
            "오늘은 날씨가 정말 좋네요",
            "저는 대학생입니다",
            "네 맞아요 그렇습니다",
            "죄송합니다만 그건 어려울 것 같아요",
            "정말 감사합니다 도움이 되었어요",
            "이것은 중요한 문제입니다",
            "어제는 친구를 만났어요",
            "내일은 시험이 있습니다",
            "항상 최선을 다하겠습니다",
            "좋은 하루 보내세요",
            "프로젝트를 완료했습니다",
            "회의는 오후 3시입니다",
            "문의사항이 있으시면 연락주세요",
            "새로운 기능을 추가했어요",
        ]

        print("\n" + "=" * 80)
        print(f"{self.COLORS['bold']}🔊 한국어 STT 손실 시뮬레이션 시각화{self.COLORS['reset']}")
        print("=" * 80)
        print(f"\n{self.COLORS['cyan']}범례:{self.COLORS['reset']}")
        print(f"  {self.COLORS['green']}● 원본 텍스트{self.COLORS['reset']}")
        print(f"  {self.COLORS['red']}● 변경된 부분{self.COLORS['reset']}")
        print(f"  {self.COLORS['yellow']}● 누락된 부분{self.COLORS['reset']}")
        print(f"\n{self.COLORS['cyan']}설정:{self.COLORS['reset']} 손실 확률 {error_rate*100}% (테스트용)")
        print("=" * 80 + "\n")

        for i in range(num_samples):
            original = test_sentences[i % len(test_sentences)]
            degraded, operations = self.replacer.apply_stt_errors(original, error_rate=error_rate)

            print(f"{self.COLORS['bold']}Sample {i+1}:{self.COLORS['reset']}")
            print(f"  {self.COLORS['green']}원본:{self.COLORS['reset']}  {original}")

            if operations:
                highlighted = self.highlight_diff(original, degraded)
                print(f"  {self.COLORS['red']}손실:{self.COLORS['reset']}  {highlighted}")
                print(f"  {self.COLORS['cyan']}작업:{self.COLORS['reset']}  {', '.join(operations)}")

                # 변화율 표시
                change_rate = abs(len(original) - len(degraded)) / len(original) * 100
                print(f"  {self.COLORS['magenta']}변화:{self.COLORS['reset']}  {change_rate:.1f}% "
                      f"({len(original)} → {len(degraded)} 글자)")
            else:
                print(f"  {self.COLORS['green']}손실:{self.COLORS['reset']}  (변형 없음)")

            print()

        print("=" * 80)

    def compare_strategies(self):
        """다양한 손실 전략 비교"""
        test_text = "안녕하세요 오늘은 날씨가 정말 좋습니다"

        print("\n" + "=" * 80)
        print(f"{self.COLORS['bold']}📊 손실 전략 비교{self.COLORS['reset']}")
        print("=" * 80 + "\n")

        strategies = [
            ("조사 삭제", lambda: self.replacer.delete_particles(test_text, 1.0)),
            ("어미 손실", lambda: self.replacer.delete_endings(test_text, 1.0)),
            ("음성학적 대체", lambda: self.replacer.phonetic_substitute(test_text, 0.5)),
        ]

        print(f"{self.COLORS['green']}원본:{self.COLORS['reset']} {test_text}\n")

        for name, func in strategies:
            result = func()
            print(f"{self.COLORS['cyan']}{name}:{self.COLORS['reset']}")
            print(f"  {self.highlight_diff(test_text, result)}")
            print()

        print("=" * 80)


def main():
    """메인 함수"""
    import argparse

    parser = argparse.ArgumentParser(description="텍스트 손실 시각화")
    parser.add_argument(
        "--samples",
        type=int,
        default=10,
        help="생성할 샘플 수 (기본 10)"
    )
    parser.add_argument(
        "--error_rate",
        type=float,
        default=0.8,
        help="손실 확률 (기본 80%%, 시각화용)"
    )
    parser.add_argument(
        "--compare",
        action="store_true",
        help="손실 전략 비교 모드"
    )

    args = parser.parse_args()

    visualizer = DegradationVisualizer()

    if args.compare:
        visualizer.compare_strategies()
    else:
        visualizer.visualize_samples(args.samples, args.error_rate)


if __name__ == "__main__":
    main()
