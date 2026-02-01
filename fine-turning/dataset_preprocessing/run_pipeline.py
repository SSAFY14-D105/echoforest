"""
전체 파이프라인 실행 스크립트
다운로드 → 전처리 → 검증을 한 번에 수행
"""
import argparse
import sys
from pathlib import Path

from download import download_zeroth_korean
from preprocess import WebSpeechDatasetBuilder
from verify_dataset import verify_dataset


def main():
    parser = argparse.ArgumentParser(
        description="Zeroth-Korean 전체 파이프라인 (다운로드 → 전처리 → 검증)"
    )
    parser.add_argument(
        "--skip_download",
        action="store_true",
        help="다운로드 건너뛰기 (이미 다운로드된 경우)"
    )
    parser.add_argument(
        "--data_dir",
        type=str,
        default="./data/zeroth_korean",
        help="Zeroth-Korean 데이터 디렉토리"
    )
    parser.add_argument(
        "--output_dir",
        type=str,
        default="./data/webspeech_dataset",
        help="WebSpeech 출력 디렉토리"
    )
    parser.add_argument(
        "--error_rate",
        type=float,
        default=0.05,
        help="텍스트 손실 비율 (기본 5%%)"
    )
    parser.add_argument(
        "--copy_audio",
        action="store_true",
        help="오디오 파일 복사 (기본: 원본 경로 참조)"
    )

    args = parser.parse_args()

    print("\n" + "=" * 70)
    print("🚀 Zeroth-Korean → WebSpeech 전체 파이프라인")
    print("=" * 70)
    print(f"📂 Data directory: {args.data_dir}")
    print(f"📤 Output directory: {args.output_dir}")
    print(f"⚙️  Error rate: {args.error_rate*100}%")
    print("=" * 70 + "\n")

    try:
        # 1. 다운로드
        if not args.skip_download:
            print("STEP 1/3: 데이터셋 다운로드\n")
            download_zeroth_korean(args.data_dir)
            print()
        else:
            print("STEP 1/3: 다운로드 건너뛰기 ⏭️\n")
            if not Path(args.data_dir).exists():
                print(f"❌ Error: {args.data_dir} 디렉토리가 존재하지 않습니다!")
                print("   --skip_download 없이 다시 실행하세요.")
                sys.exit(1)

        # 2. 전처리
        print("\nSTEP 2/3: WebSpeech 형식으로 전처리\n")
        builder = WebSpeechDatasetBuilder(error_rate=args.error_rate)

        samples = builder.parse_zeroth_korean(args.data_dir)
        if not samples:
            print("❌ Error: 샘플을 찾을 수 없습니다!")
            sys.exit(1)

        stats = builder.convert_to_webspeech_format(
            samples,
            args.output_dir,
            copy_audio=args.copy_audio
        )

        builder.create_dataset_info(args.output_dir, stats)

        # 3. 검증
        print("\n\nSTEP 3/3: 데이터셋 검증\n")
        verify_dataset(args.output_dir)

        print("\n" + "=" * 70)
        print("🎉 전체 파이프라인 완료!")
        print("=" * 70)
        print(f"\n✅ 데이터셋 위치: {Path(args.output_dir).absolute()}")
        print("\n📖 사용 예제:")
        print("   python")
        print("   >>> import json")
        print(f"   >>> with open('{args.output_dir}/train.jsonl') as f:")
        print("   ...     data = [json.loads(line) for line in f]")
        print("   >>> print(data[0])")

    except KeyboardInterrupt:
        print("\n\n⚠️  사용자에 의해 중단되었습니다.")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n❌ 오류 발생: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
