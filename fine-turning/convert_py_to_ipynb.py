import nbformat as nbf
import os

# 원본 파이썬 스크립트 경로
py_file_path = r"C:\Users\SSAFY\Desktop\SSAFY\02_second_semester\05_Project\03_파인튜닝\unsmile_colab_guide.py"
# 생성할 노트북 파일 이름
ipynb_file_path = r"C:\Users\SSAFY\Desktop\SSAFY\02_second_semester\05_Project\03_파인튜닝\unsmile_finetuning.ipynb"

# 노트북 객체 생성
nb = nbf.v4.new_notebook()

# .py 파일 읽기
with open(py_file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# [Cell X] 패턴을 기준으로 코드 분리
cells = []
current_cell_content = []
current_cell_type = 'code' # 기본은 코드 셀

lines = content.split('\n')

for line in lines:
    # 새로운 셀의 시작인지 확인 ([Cell 1], [Cell 2] ...)
    if line.strip().startswith('# [Cell'):
        # 이전 셀 내용이 있으면 저장
        if current_cell_content:
            source = '\n'.join(current_cell_content).strip()
            if source:
                new_cell = nbf.v4.new_code_cell(source)
                cells.append(new_cell)
        
        # 새로운 셀 시작 (주석 라인도 포함)
        current_cell_content = [line] 
    else:
        current_cell_content.append(line)

# 마지막 셀 추가
if current_cell_content:
    source = '\n'.join(current_cell_content).strip()
    if source:
        new_cell = nbf.v4.new_code_cell(source)
        cells.append(new_cell)

nb['cells'] = cells

# 노트북 파일로 저장
with open(ipynb_file_path, 'w', encoding='utf-8') as f:
    nbf.write(nb, f)

print(f"변환 완료! 생성된 파일: {ipynb_file_path}")
print("이 .ipynb 파일을 구글 드라이브에 업로드하면 바로 코랩에서 열립니다.")
