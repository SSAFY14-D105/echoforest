
import sys
import os

print(f"Python executable: {sys.executable}")
print("-" * 20)

try:
    import torch
    print(f"Torch Version: {torch.__version__}")
    print(f"Torch CUDA Available: {torch.cuda.is_available()}")
    print(f"Torch Vision CUDA: {torch.version.cuda}")
    if torch.cuda.is_available():
        print(f"Current Device: {torch.cuda.get_device_name(0)}")
except ImportError:
    print("Torch not installed")
except Exception as e:
    print(f"Torch Error: {e}")

print("-" * 20)

try:
    import ctranslate2
    print(f"CTranslate2 Version: {ctranslate2.__version__}")
    print(f"CTranslate2 CUDA Device Count: {ctranslate2.get_cuda_device_count()}")
except ImportError:
    print("CTranslate2 not installed")
except Exception as e:
    print(f"CTranslate2 Error: {e}")

print("-" * 20)
try:
    import nvidia
    print(f"nvidia package path: {nvidia.__path__}")
    import nvidia.cublas.lib
    print(f"cublas lib: {nvidia.cublas.lib.__file__}")
    import nvidia.cudnn.lib
    print(f"cudnn lib: {nvidia.cudnn.lib.__file__}")
except ImportError:
    print("nvidia headers/libs not fully installed via pip")
except Exception as e:
    print(f"NVIDIA Import Error: {e}")
