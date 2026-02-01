"""
WebSpeech API 스타일 데이터셋 전처리
- Zeroth-Korean → WebSpeech 형식 변환
- 5% 텍스트 손실 시뮬레이션 (삭제 70% + 음성학적 대체 30%)
"""
import json
import os
import shutil
from pathlib import Path
from typing import Dict, List, Tuple
from tqdm import tqdm
import random

from korean_phonetics import KoreanPhoneticReplacer


class WebSpeechDatasetBuilder:
    """WebSpeech API 스타일 데이터셋 생성기"""

    def __init__(self, error_rate: float = 0.05):
        """
        Args:
            error_rate: 텍스트 손실 시뮬레이션 비율 (기본 5%)
        """
        self.error_rate = error_rate
        self.phonetic_replacer = KoreanPhoneticReplacer()

    def parse_zeroth_korean(self, data_dir: str) -> List[Dict]:
        """
        Zeroth-Korean 데이터셋 파싱

        Args:
            data_dir: Zeroth 데이터 디렉토리

        Returns:
            [{
                'audio_path': 'path/to/audio.wav',
                'text': '전사 텍스트',
                'speaker_id': 'spk_001',
                'duration': 3.5
            }, ...]
        """
        data_dir = Path(data_dir)
        samples = []

        # Zeroth 구조: train_data_01, test_data_01
        for split_dir in data_dir.glob("*_data_*"):
            if not split_dir.is_dir():
                continue

            print(f"📂 Processing: {split_dir.name}")

            # 각 화자 디렉토리 순회
            for speaker_dir in tqdm(list(split_dir.glob("*")), desc=f"  Parsing {split_dir.name}"):
                if not speaker_dir.is_dir():
                    continue

                speaker_id = speaker_dir.name

                # WAV 파일 찾기
                for audio_file in speaker_dir.glob("*.wav"):
                    transcript_file = audio_file.with_suffix('.txt')

                    if transcript_file.exists():
                        with open(transcript_file, 'r', encoding='utf-8') as f:
                            text = f.read().strip()

                        # 오디오 길이 추정 (파일 크기 기반)
                        file_size = audio_file.stat().st_size
                        duration = file_size / (16000 * 2)  # 16kHz, 16bit

                        samples.append({
                            'audio_path': str(audio_file),
                            'text': text,
                            'speaker_id': speaker_id,
                            'duration': round(duration, 2),
                            'split': 'test' if 'test' in split_dir.name else 'train'
                        })

        print(f"✅ Parsed {len(samples)} samples\n")
        return samples

    def apply_text_degradation(self, text: str) -> Tuple[str, str, Dict]:
        """
        텍스트 손실 시뮬레이션

        Args:
            text: 원본 텍스트

        Returns:
            (clean_text, degraded_text, metadata)
        """
        degraded_text, operations = self.phonetic_replacer.apply_stt_errors(
            text, error_rate=self.error_rate
        )

        metadata = {
            'is_degraded': text != degraded_text,
            'operations': operations,
            'original_length': len(text),
            'degraded_length': len(degraded_text)
        }

        return text, degraded_text, metadata

    def convert_to_webspeech_format(
        self,
        samples: List[Dict],
        output_dir: str,
        copy_audio: bool = False
    ) -> Dict:
        """
        WebSpeech API 형식으로 변환

        WebSpeech 형식:
        {
            "audio": "audio/sample_001.wav",
            "text": "인식된 텍스트 (손실 시뮬레이션 적용)",
            "text_clean": "원본 텍스트",
            "confidence": 0.95,
            "metadata": {
                "speaker_id": "spk_001",
                "duration": 3.5,
                "is_degraded": true,
                "operations": ["조사 삭제"]
            }
        }

        Args:
            samples: 파싱된 샘플 리스트
            output_dir: 출력 디렉토리
            copy_audio: 오디오 파일 복사 여부 (False면 원본 경로 참조)

        Returns:
            통계 정보
        """
        output_dir = Path(output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)

        audio_dir = output_dir / "audio"
        if copy_audio:
            audio_dir.mkdir(exist_ok=True)

        webspeech_data = []
        stats = {
            'total': len(samples),
            'degraded': 0,
            'train': 0,
            'test': 0,
            'operations': {}
        }

        print(f"🔄 Converting to WebSpeech format (error_rate={self.error_rate*100}%)\n")

        for idx, sample in enumerate(tqdm(samples, desc="  Converting")):
            # 텍스트 손실 시뮬레이션
            clean_text, degraded_text, degradation_meta = self.apply_text_degradation(
                sample['text']
            )

            # 오디오 경로 처리
            if copy_audio:
                audio_filename = f"{sample['split']}_{idx:06d}.wav"
                audio_path = audio_dir / audio_filename
                shutil.copy2(sample['audio_path'], audio_path)
                audio_ref = str(audio_path.relative_to(output_dir))
            else:
                audio_ref = sample['audio_path']

            # Confidence 시뮬레이션 (손실된 경우 낮은 confidence)
            confidence = 0.85 if degradation_meta['is_degraded'] else random.uniform(0.92, 0.98)

            # WebSpeech 형식 데이터
            webspeech_sample = {
                'audio': audio_ref,
                'text': degraded_text,  # STT 출력 (손실 반영)
                'text_clean': clean_text,  # 원본 (비교용)
                'confidence': round(confidence, 3),
                'metadata': {
                    'speaker_id': sample['speaker_id'],
                    'duration': sample['duration'],
                    'split': sample['split'],
                    **degradation_meta
                }
            }

            webspeech_data.append(webspeech_sample)

            # 통계 수집
            if degradation_meta['is_degraded']:
                stats['degraded'] += 1
                for op in degradation_meta['operations']:
                    stats['operations'][op] = stats['operations'].get(op, 0) + 1

            stats[sample['split']] += 1

        # 분할 저장
        train_data = [s for s in webspeech_data if s['metadata']['split'] == 'train']
        test_data = [s for s in webspeech_data if s['metadata']['split'] == 'test']

        self._save_jsonl(train_data, output_dir / "train.jsonl")
        self._save_jsonl(test_data, output_dir / "test.jsonl")
        self._save_jsonl(webspeech_data, output_dir / "all.jsonl")

        # 통계 저장
        stats['degradation_rate'] = round(stats['degraded'] / stats['total'] * 100, 2)
        with open(output_dir / "stats.json", 'w', encoding='utf-8') as f:
            json.dump(stats, f, ensure_ascii=False, indent=2)

        print(f"\n✅ Conversion complete!")
        print(f"   📊 Total: {stats['total']} samples")
        print(f"   🔧 Degraded: {stats['degraded']} ({stats['degradation_rate']}%)")
        print(f"   📈 Train: {stats['train']}, Test: {stats['test']}")
        print(f"\n💾 Saved to: {output_dir.absolute()}")

        return stats

    def _save_jsonl(self, data: List[Dict], output_path: Path):
        """JSONL 형식으로 저장"""
        with open(output_path, 'w', encoding='utf-8') as f:
            for item in data:
                f.write(json.dumps(item, ensure_ascii=False) + '\n')

    def create_dataset_info(self, output_dir: str, stats: Dict):
        """데이터셋 정보 파일 생성"""
        output_dir = Path(output_dir)

        info = {
            "name": "Zeroth-Korean WebSpeech Format",
            "version": "1.0",
            "description": "Zeroth-Korean dataset preprocessed for WebSpeech API style with 5% text degradation",
            "license": "CC BY 4.0",
            "format": "JSONL (JSON Lines)",
            "degradation": {
                "error_rate": self.error_rate,
                "strategy": "70% deletion + 30% phonetic substitution",
                "operations": list(stats['operations'].keys())
            },
            "statistics": stats,
            "files": {
                "train.jsonl": "Training set",
                "test.jsonl": "Test set",
                "all.jsonl": "Complete dataset"
            },
            "schema": {
                "audio": "Path to audio file (WAV, 16kHz)",
                "text": "Degraded transcript (simulated STT output)",
                "text_clean": "Clean transcript (ground truth)",
                "confidence": "Simulated confidence score (0.0-1.0)",
                "metadata": {
                    "speaker_id": "Speaker identifier",
                    "duration": "Audio duration in seconds",
                    "split": "train or test",
                    "is_degraded": "Whether degradation was applied",
                    "operations": "List of degradation operations applied"
                }
            }
        }

        with open(output_dir / "dataset_info.json", 'w', encoding='utf-8') as f:
            json.dump(info, f, ensure_ascii=False, indent=2)

        print(f"📄 Dataset info saved: dataset_info.json")


def main():
    """메인 파이프라인"""
    import argparse

    parser = argparse.ArgumentParser(description="Zeroth-Korean → WebSpeech format conversion")
    parser.add_argument(
        "--input_dir",
        type=str,
        default="./data/zeroth_korean",
        help="Zeroth-Korean data directory"
    )
    parser.add_argument(
        "--output_dir",
        type=str,
        default="./data/webspeech_dataset",
        help="Output directory for WebSpeech format"
    )
    parser.add_argument(
        "--error_rate",
        type=float,
        default=0.05,
        help="Text degradation error rate (default: 0.05 = 5%%)"
    )
    parser.add_argument(
        "--copy_audio",
        action="store_true",
        help="Copy audio files to output directory (default: reference original paths)"
    )

    args = parser.parse_args()

    print("=" * 70)
    print("🎙️  Zeroth-Korean → WebSpeech Preprocessor")
    print("=" * 70)
    print(f"📥 Input:  {args.input_dir}")
    print(f"📤 Output: {args.output_dir}")
    print(f"⚙️  Error rate: {args.error_rate*100}%")
    print(f"📁 Copy audio: {args.copy_audio}")
    print("=" * 70 + "\n")

    # 데이터셋 빌더 생성
    builder = WebSpeechDatasetBuilder(error_rate=args.error_rate)

    # 1. Zeroth-Korean 파싱
    samples = builder.parse_zeroth_korean(args.input_dir)

    if not samples:
        print("❌ No samples found! Check input directory.")
        return

    # 2. WebSpeech 형식으로 변환
    stats = builder.convert_to_webspeech_format(
        samples,
        args.output_dir,
        copy_audio=args.copy_audio
    )

    # 3. 데이터셋 정보 생성
    builder.create_dataset_info(args.output_dir, stats)

    print("\n" + "=" * 70)
    print("🎉 Preprocessing complete!")
    print("=" * 70)
    print("\n📖 Next steps:")
    print("   1. Verify the output: python verify_dataset.py")
    print("   2. Load in training: ")
    print("      import json")
    print("      with open('data/webspeech_dataset/train.jsonl') as f:")
    print("          data = [json.loads(line) for line in f]")


if __name__ == "__main__":
    main()
