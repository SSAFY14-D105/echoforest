"""
한국어 음성학적 대체 규칙
실제 STT 오인식 패턴을 시뮬레이션
"""
import random
import re
from typing import List, Tuple


class KoreanPhoneticReplacer:
    """한국어 음성학적 오류 시뮬레이션"""

    def __init__(self):
        # 초성 대체 규칙 (유사 발음)
        self.initial_replacements = {
            'ㄱ': ['ㄲ', 'ㅋ'],
            'ㄷ': ['ㄸ', 'ㅌ'],
            'ㅂ': ['ㅃ', 'ㅍ'],
            'ㅅ': ['ㅆ', 'ㅈ'],
            'ㅈ': ['ㅉ', 'ㅊ', 'ㅅ'],
        }

        # 종성 탈락/혼동
        self.final_replacements = {
            'ㄱ': ['ㄲ', 'ㅋ', ''],  # 종성 탈락 포함
            'ㄴ': ['ㄹ', ''],
            'ㄷ': ['ㅌ', 'ㅅ', ''],
            'ㄹ': ['ㄴ', ''],
            'ㅁ': [''],
            'ㅂ': ['ㅍ', ''],
            'ㅇ': [''],
        }

        # 모음 대체 (유사 발음)
        self.vowel_replacements = {
            'ㅐ': ['ㅔ', 'ㅏ'],
            'ㅔ': ['ㅐ', 'ㅓ'],
            'ㅚ': ['ㅙ', 'ㅞ', 'ㅟ'],
            'ㅙ': ['ㅚ', 'ㅞ'],
            'ㅞ': ['ㅚ', 'ㅙ', 'ㅟ'],
            'ㅟ': ['ㅞ', 'ㅚ'],
            'ㅢ': ['ㅣ', 'ㅡ'],
        }

        # 자주 틀리는 단어 패턴 (일반)
        self.word_replacements = {
            '있어요': ['이써요', '이서요', '있요'],
            '없어요': ['업서요', '업써요', '없요'],
            '했어요': ['했요', '해써요', '핸요'],
            '했습니다': ['했슴다', '핸니다'],
            '합니다': ['함니다', '합다'],
            '입니다': ['임니다', '입다'],
            '습니다': ['슴다', '슴니다'],
            '지만': ['짐만', '진만'],
            '그런데': ['근데', '그렇데'],
            '그렇지': ['그러치', '그렇치'],
        }
        
        # 🎮 게임 특화 STT 오류 패턴 (강건성 향상)
        self.game_word_replacements = {
            # 게임 용어
            '아이템': ['아템', '아잍템', '아이텀'],
            '캐릭터': ['캐릭', '케릭터', '캐맄터'],
            '스킬': ['스키루', '스킬르', '스킾'],
            '포션': ['포숀', '포션ㄴ', '포쎤'],
            '몬스터': ['몹', '몬스타', '몬쓰터'],
            '파티': ['파팅', '팥이', '파띠'],
            '던전': ['던젼', '던죤', '던즌'],
            '보스': ['봇스', '보쓰', '버스'],
            
            # 게임 중 빠른 발화
            '죽었어': ['줘거', '주거써', '죽써'],
            '도와줘': ['도와쥬', '도아줘', '도와저'],
            '뒤에': ['뒤예', '뒤이에', '두에'],
            '앞에': ['아페', '압에', '앞애'],
            '조심해': ['조심해', '조시매', '조심애'],
            '빨리': ['빠리', '빨르', '빨리이'],
            '기다려': ['기다랴', '기다료', '기달려'],
            '같이': ['가치', '가티', '같치'],
            
            # 감탄/반응
            '대박': ['대바', '댑박', '대밬'],
            '진짜': ['진자', '진짜아', '짐짜'],
            '완전': ['완죤', '완젼', '완전ㄴ'],
            '레전드': ['레전듀', '레젼드', '레전더'],
            
            # 부정적 표현 (욕설 아닌 것들 - 팀사기 저해)
            '못해': ['모태', '못혜', '못해애'],
            '왜그래': ['왜그레', '웨그래', '왜그랴'],
            '이상해': ['이상혜', '이상해애', '이상에'],
        }
        
        # 두 딕셔너리 합치기
        self.word_replacements.update(self.game_word_replacements)

        # 조사/어미 (종종 누락됨)
        self.particles = ['을', '를', '이', '가', '은', '는', '에', '의', '도', '만']

    def replace_jamo(self, char: str, jamo_type: str) -> str:
        """
        자모 단위 대체

        Args:
            char: 한글 음절
            jamo_type: 'initial', 'vowel', 'final'
        """
        if not ('가' <= char <= '힣'):
            return char

        # 유니코드 분해
        base = ord(char) - 0xAC00
        initial = base // (21 * 28)
        vowel = (base // 28) % 21
        final = base % 28

        if jamo_type == 'initial' and initial in [0, 3, 7]:  # ㄱ, ㄷ, ㅂ
            initial_map = {0: [1, 2], 3: [4, 5], 7: [8, 9]}  # ㄱ→ㄲ/ㅋ, ㄷ→ㄸ/ㅌ, ㅂ→ㅃ/ㅍ
            if initial in initial_map:
                initial = random.choice(initial_map[initial])

        elif jamo_type == 'vowel':
            # 애/에 혼동
            if vowel in [2, 4]:  # ㅐ, ㅔ
                vowel = random.choice([2, 4])

        elif jamo_type == 'final' and final > 0:
            # 종성 탈락 또는 변형
            if random.random() < 0.3:  # 30% 탈락
                final = 0
            elif final in [1, 4, 8]:  # ㄱ, ㄴ, ㄹ
                final_map = {1: [2, 0], 4: [8, 0], 8: [4, 0]}
                final = random.choice(final_map.get(final, [final]))

        # 유니코드 재조합
        new_code = 0xAC00 + (initial * 21 * 28) + (vowel * 28) + final
        return chr(new_code)

    def phonetic_substitute(self, text: str, probability: float = 0.3) -> str:
        """
        음성학적 대체 수행

        Args:
            text: 원본 텍스트
            probability: 대체 확률 (0.0~1.0)

        Returns:
            대체된 텍스트
        """
        # 1. 단어 단위 대체 (우선순위 높음)
        for original, replacements in self.word_replacements.items():
            if original in text and random.random() < probability:
                text = text.replace(original, random.choice(replacements))

        # 2. 자모 단위 대체
        result = []
        for char in text:
            if '가' <= char <= '힣' and random.random() < probability * 0.3:  # 더 낮은 확률
                jamo_type = random.choice(['initial', 'vowel', 'final'])
                result.append(self.replace_jamo(char, jamo_type))
            else:
                result.append(char)

        return ''.join(result)

    def delete_particles(self, text: str, probability: float = 0.2) -> str:
        """조사 삭제 (STT에서 자주 누락)"""
        words = text.split()
        result = []

        for word in words:
            # 마지막 글자가 조사인지 확인
            if len(word) > 1 and word[-1] in ['을', '를', '이', '가', '은', '는', '에', '도']:
                if random.random() < probability:
                    result.append(word[:-1])  # 조사 제거
                    continue
            result.append(word)

        return ' '.join(result)

    def delete_endings(self, text: str, probability: float = 0.15) -> str:
        """어미 손실 (문장 끝 불안정)"""
        endings = ['습니다', '합니다', '입니다', '어요', '아요', '예요', '네요', '죠', '요']

        for ending in endings:
            if text.endswith(ending) and random.random() < probability:
                # 어미 일부만 삭제 (전체 삭제는 부자연스러움)
                if len(ending) > 2:
                    text = text[:-1] + random.choice(['', ending[-1]])
                break

        return text

    def apply_stt_errors(self, text: str, error_rate: float = 0.05) -> Tuple[str, List[str]]:
        """
        STT 오류 시뮬레이션 (삭제 70% + 음성학적 대체 30%)

        Args:
            text: 원본 텍스트
            error_rate: 전체 오류율 (기본 5%)

        Returns:
            (변형된 텍스트, 적용된 변형 리스트)
        """
        operations = []
        modified_text = text

        if random.random() < error_rate:
            # 70%: 삭제 계열
            if random.random() < 0.7:
                choice = random.choice(['particle', 'ending', 'word'])

                if choice == 'particle':
                    modified_text = self.delete_particles(modified_text, probability=0.5)
                    operations.append('조사 삭제')

                elif choice == 'ending':
                    modified_text = self.delete_endings(modified_text, probability=0.5)
                    operations.append('어미 손실')

                elif choice == 'word':
                    # 단어 삭제 (문장 시작/끝 우선)
                    words = modified_text.split()
                    if len(words) > 2:
                        del_pos = random.choice([0, -1, random.randint(0, len(words)-1)])
                        deleted_word = words.pop(del_pos)
                        modified_text = ' '.join(words)
                        operations.append(f'단어 삭제: {deleted_word}')

            # 30%: 음성학적 대체
            else:
                modified_text = self.phonetic_substitute(modified_text, probability=0.3)
                operations.append('음성학적 대체')

        return modified_text, operations


# 테스트
if __name__ == "__main__":
    replacer = KoreanPhoneticReplacer()

    test_sentences = [
        "안녕하세요 반갑습니다",
        "오늘 날씨가 정말 좋네요",
        "저는 학생입니다",
        "네 맞아요 그렇습니다",
        "죄송합니다만 그건 어려울 것 같아요",
    ]

    print("🔊 한국어 STT 오류 시뮬레이션 테스트\n")
    print("=" * 70)

    for original in test_sentences:
        print(f"\n원본: {original}")
        for i in range(3):
            modified, ops = replacer.apply_stt_errors(original, error_rate=0.8)  # 높은 확률로 테스트
            if ops:
                print(f"  {i+1}. {modified}")
                print(f"     → {', '.join(ops)}")
            else:
                print(f"  {i+1}. {modified} (변형 없음)")

    print("\n" + "=" * 70)
