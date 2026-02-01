
import os
import csv
import sys
import re

# Try importing kiwipiepy (faster to install than KSS)
try:
    from kiwipiepy import Kiwi
    kiwi = Kiwi()
    use_kiwi = True
except ImportError:
    print("Warning: 'kiwipiepy' not found. Falling back to simple regex splitting (may be less accurate).")
    print("To improve accuracy, run: pip install kiwipiepy")
    use_kiwi = False

# Paths
base_dir = r"C:\Users\SSAFY\Desktop\SSAFY\02_second_semester\05_Project\01_공통프로젝트\03_S14P11D105_ai\fine-turning\data_collection"
input_path = os.path.join(base_dir, "raw_data_preprocessing2", "dataset.tsv")
output_dir = os.path.join(base_dir, "raw_data_preprocessing3")
output_path = os.path.join(output_dir, "dataset.tsv")

# Ensure output directory exists
os.makedirs(output_dir, exist_ok=True)

print("Starting Sentence Splitting...")
print(f"Input: {input_path}")
print(f"Output: {output_path}")

processed_count = 0
split_count = 0

def simple_split(text):
    # Fallback: Split by assumed ending particles (very rough) or just length
    # STT text often lacks punctuation.
    # We will split by '요 ' or '다 ' or '죠 ' if possible, else keep logical chunks
    # This is a naive heuristic typical for unpunctuated text without ML
    splits = re.sub(r'(요|다|죠|까|네)(?=\s)', r'\1\n', text).split('\n')
    return [s.strip() for s in splits if s.strip()]

try:
    with open(input_path, 'r', encoding='utf-8') as infile, \
         open(output_path, 'w', encoding='utf-8', newline='') as outfile:
        
        reader = csv.reader(infile, delimiter='\t')
        writer = csv.writer(outfile, delimiter='\t')
        
        header = next(reader, None)
        writer.writerow(['sentence']) # Write Header
        
        for row in reader:
            if not row: continue
            original_line = row[0]
            
            if use_kiwi:
                try:
                    # Kiwi sentence splitting
                    sentences = [s.text for s in kiwi.split_into_sents(original_line)]
                except Exception as e:
                    sentences = [original_line]
            else:
                sentences = simple_split(original_line)

            for sent in sentences:
                sent = sent.strip()
                if len(sent) > 1: # Minimal length check
                    writer.writerow([sent])
                    split_count += 1
            
            processed_count += 1
            if processed_count % 100 == 0:
                print(f"Processed {processed_count} lines...", end='\r')

    print(f"\nDone!")
    print(f"Original lines read: {processed_count}")
    print(f"Total sentences generated: {split_count}")
    print(f"Saved to: {output_path}")

except FileNotFoundError:
    print(f"Error: Input file not found at {input_path}")
except Exception as e:
    print(f"An error occurred: {e}")
