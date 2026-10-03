import sys
from pathlib import Path

def main():
    if len(sys.argv) != 3:
        raise SystemExit("Usage: pdf_to_word.py input.pdf output.docx")
    src, dst = sys.argv[1], sys.argv[2]
    try:
        from pdf2docx import Converter
    except Exception as e:
        raise SystemExit("pdf2docx is not installed. Install with: python -m pip install pdf2docx")
    cv = Converter(src)
    try:
        cv.convert(dst, start=0, end=None, multi_processing=True)
    finally:
        cv.close()
    if not Path(dst).exists():
        raise SystemExit("pdf2docx did not create the DOCX file.")

if __name__ == "__main__":
    main()
