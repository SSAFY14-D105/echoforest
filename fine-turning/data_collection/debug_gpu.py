
import os
import sys
import site
import torch
import ctranslate2

print(f"Python executable: {sys.executable}")
print(f"Conda prefix: {os.environ.get('CONDA_PREFIX', 'Not set')}")

print("\n--- Package Locations ---")
try:
    import nvidia.cublas.lib
    print(f"nvidia.cublas.lib: {os.path.dirname(nvidia.cublas.lib.__file__)}")
except ImportError as e:
    print(f"nvidia.cublas.lib import failed: {e}")

try:
    import nvidia.cudnn.lib
    print(f"nvidia.cudnn.lib: {os.path.dirname(nvidia.cudnn.lib.__file__)}")
except ImportError as e:
    print(f"nvidia.cudnn.lib import failed: {e}")

print("\n--- Site Packages Scan ---")
for site_pkg in site.getsitepackages():
    print(f"Scanning: {site_pkg}")
    nvidia_dir = os.path.join(site_pkg, 'nvidia')
    if os.path.exists(nvidia_dir):
        print(f"  Found nvidia dir: {nvidia_dir}")
        for root, dirs, files in os.walk(nvidia_dir):
            if 'bin' in dirs or 'lib' in dirs:
                print(f"    Sub-dir with bin/lib: {root}")
                if 'bin' in dirs: print(f"      -> {os.path.join(root, 'bin')}")
                if 'lib' in dirs: print(f"      -> {os.path.join(root, 'lib')}")

print("\n--- Torch Libs ---")
torch_lib = os.path.join(os.path.dirname(torch.__file__), 'lib')
print(f"Torch lib: {torch_lib}")
if os.path.exists(torch_lib):
    print("  (Exists)")
else:
    print("  (Does not exist)")

print("\n--- Test CTranslate2 ---")
try:
    # Try adding paths manually to see if it helps for this test
    # Replicating the logic from the script roughly to see what happens
    pass
except:
    pass

print(f"CTranslate2 CUDA devices: {ctranslate2.get_cuda_device_count()}")

print("\n--- Test Faster Whisper Load ---")
from faster_whisper import WhisperModel
try:
    # Use small model needed? No just try construct to trigger load
    # But wait, construction might not trigger DLL load until transcribe?
    # Usually it triggers at init.
    print("Attempting to load 'tiny' model on CUDA...")
    model = WhisperModel("tiny", device="cuda", compute_type="float16")
    print("Success loading model!")
except Exception as e:
    print(f"Error loading model: {e}")
