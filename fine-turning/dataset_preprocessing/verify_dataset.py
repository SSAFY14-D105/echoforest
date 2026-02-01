"""
WebSpeech 데이터셋 검증 및 샘플 확인
"""
import json
from pathlib import Path
from collections import Counter
import random


def load_jsonl(file_path: str):
    """JSONL 파일 로드"""
    data = []
    with open(file_path, 'r', encoding='utf-8') as f:
        for line in f:
            data.append(json.loads(line))
    return data


def verify_dataset(dataset_dir: str):
    """데이터셋 검증"""
    dataset_dir = Path(dataset_dir)

    print("=" * 70)
    print("🔍 WebSpeech Dataset Verification")
    print("=" * 70 + "\n")

    # 1. 파일 존재 확인
    print("📁 File checks:")
    required_files = ['train.jsonl', 'test.jsonl', 'dataset_info.json', 'stats.json']
    for file in required_files:
        file_path = dataset_dir / file
        exists = "✅" if file_path.exists() else "❌"
        print(f"   {exists} {file}")

    print()

    # 2. 데이터 로드
    train_data = load_jsonl(dataset_dir / 'train.jsonl')
    test_data = load_jsonl(dataset_dir / 'test.jsonl')

    print("📊 Dataset statistics:")
    print(f"   Train samples: {len(train_data)}")
    print(f"   Test samples:  {len(test_data)}")
    print(f"   Total:         {len(train_data) + len(test_data)}\n")

    # 3. Degradation 통계
    degraded_count = sum(1 for s in train_data + test_data if s['metadata']['is_degraded'])
    degradation_rate = degraded_count / (len(train_data) + len(test_data)) * 100

    print(f"🔧 Degradation statistics:")
    print(f"   Degraded samples: {degraded_count} ({degradation_rate:.2f}%)")

    # 작업 타입 통계
    all_ops = []
    for sample in train_data + test_data:
        all_ops.extend(sample['metadata']['operations'])

    if all_ops:
        op_counter = Counter(all_ops)
        print(f"\n   Operation breakdown:")
        for op, count in op_counter.most_common():
            print(f"      • {op}: {count}")

    print()

    # 4. 샘플 검증
    print("🔬 Sample validation:")
    sample = random.choice(train_data)

    required_keys = ['audio', 'text', 'text_clean', 'confidence', 'metadata']
    valid = all(key in sample for key in required_keys)
    print(f"   Schema valid: {'✅' if valid else '❌'}")

    metadata_keys = ['speaker_id', 'duration', 'is_degraded', 'operations']
    metadata_valid = all(key in sample['metadata'] for key in metadata_keys)
    print(f"   Metadata valid: {'✅' if metadata_valid else '❌'}")

    print()

    # 5. 랜덤 샘플 출력
    print("=" * 70)
    print("📝 Random degraded samples (showing changes):")
    print("=" * 70 + "\n")

    degraded_samples = [s for s in train_data if s['metadata']['is_degraded']]

    for i, sample in enumerate(random.sample(degraded_samples, min(5, len(degraded_samples))), 1):
        print(f"{i}. Speaker: {sample['metadata']['speaker_id']} | "
              f"Duration: {sample['metadata']['duration']}s | "
              f"Confidence: {sample['confidence']}")
        print(f"   Original:  {sample['text_clean']}")
        print(f"   Degraded:  {sample['text']}")
        print(f"   Operations: {', '.join(sample['metadata']['operations'])}")
        print()

    # 6. 변화 없는 샘플도 확인
    clean_samples = [s for s in train_data if not s['metadata']['is_degraded']]
    if clean_samples:
        print("=" * 70)
        print("✨ Clean samples (no degradation):")
        print("=" * 70 + "\n")

        for i, sample in enumerate(random.sample(clean_samples, min(3, len(clean_samples))), 1):
            print(f"{i}. {sample['text']}")
            print(f"   Confidence: {sample['confidence']}\n")

    print("=" * 70)
    print("✅ Verification complete!")
    print("=" * 70)


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Verify WebSpeech dataset")
    parser.add_argument(
        "--dataset_dir",
        type=str,
        default="./data/webspeech_dataset",
        help="WebSpeech dataset directory"
    )

    args = parser.parse_args()

    verify_dataset(args.dataset_dir)
