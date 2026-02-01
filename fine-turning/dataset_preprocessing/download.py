"""
Zeroth-Korean 데이터셋 다운로드
OpenSLR에서 자동 다운로드 및 압축 해제
"""
import os
import urllib.request
import tarfile
from pathlib import Path
from tqdm import tqdm


class DownloadProgressBar(tqdm):
    """다운로드 진행률 표시"""
    def update_to(self, b=1, bsize=1, tsize=None):
        if tsize is not None:
            self.total = tsize
        self.update(b * bsize - self.n)


def download_url(url, output_path):
    """파일 다운로드 with progress bar"""
    with DownloadProgressBar(unit='B', unit_scale=True,
                             miniters=1, desc=url.split('/')[-1]) as t:
        urllib.request.urlretrieve(url, filename=output_path, reporthook=t.update_to)


def download_zeroth_korean(output_dir="./data/zeroth_korean"):
    """
    Zeroth-Korean 데이터셋 다운로드

    Args:
        output_dir: 데이터셋 저장 경로
    """
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    # OpenSLR Zeroth-Korean URLs
    urls = {
        "train_data_01": "https://www.openslr.org/resources/40/zeroth_korean.tar.gz",
    }

    print("=" * 60)
    print("🎤 Zeroth-Korean Dataset Downloader")
    print("=" * 60)
    print(f"📁 Download directory: {output_dir.absolute()}")
    print(f"📊 Total size: ~3.5GB (compressed)")
    print(f"⏱️  Estimated time: 5-15 minutes (depends on connection)")
    print("=" * 60 + "\n")

    for name, url in urls.items():
        filename = url.split('/')[-1]
        output_path = output_dir / filename
        extract_dir = output_dir / name

        # 다운로드
        if not output_path.exists():
            print(f"⬇️  Downloading {filename}...")
            download_url(url, output_path)
            print(f"✅ Downloaded: {output_path}\n")
        else:
            print(f"⏭️  Already exists: {output_path}\n")

        # 압축 해제
        if not extract_dir.exists():
            print(f"📦 Extracting {filename}...")
            with tarfile.open(output_path, 'r:gz') as tar:
                tar.extractall(path=output_dir)
            print(f"✅ Extracted to: {extract_dir}\n")
        else:
            print(f"⏭️  Already extracted: {extract_dir}\n")

    print("=" * 60)
    print("🎉 Download complete!")
    print("=" * 60)
    print(f"\n📂 Dataset structure:")
    print(f"   {output_dir}/")
    print(f"   └── zeroth_korean/")
    print(f"       ├── train_data_01/")
    print(f"       │   ├── *.wav")
    print(f"       │   └── *.txt")
    print(f"       └── test_data_01/")

    return output_dir


if __name__ == "__main__":
    download_zeroth_korean()
