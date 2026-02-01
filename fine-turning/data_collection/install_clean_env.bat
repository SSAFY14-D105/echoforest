@echo off
echo ========================================================
echo   [Clean Whisper Environment Setup]
echo   Setting up a robust environment for Faster-Whisper on Windows
echo ========================================================

echo.
echo 1. Creating new Conda environment: clean_whisper (Python 3.10)
call conda create -n clean_whisper python=3.10 -y
if errorlevel 1 goto :error

echo.
echo 2. Activating environment...
call conda activate clean_whisper
if errorlevel 1 (
    echo [Warning] 'conda activate' failed in script. Trying direct activation...
    call source activate clean_whisper
)

echo.
echo 3. Installing CUDA Toolkit (This fixes DLL issues!)
echo    This may take a while...
call conda install -c nvidia cuda-toolkit -y
if errorlevel 1 goto :error

echo.
echo 4. Installing PyTorch (CUDA 12.4 version)
call pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu124
if errorlevel 1 goto :error

echo.
echo 5. Installing Faster-Whisper, KiwiPiePy, CTranslate2
call pip install faster-whisper kiwipiepy ctranslate2
if errorlevel 1 goto :error

echo.
echo ========================================================
echo   Setup Complete!
echo   To usage:
echo     conda activate clean_whisper
echo     python 02_whisper_transcriber.py
echo ========================================================
pause
exit /b 0

:error
echo.
echo [ERROR] Setup failed. Please check the error messages above.
pause
exit /b 1
