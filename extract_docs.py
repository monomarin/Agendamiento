import pdfplumber
import docx
import os
import sys

# Force UTF-8 output
sys.stdout.reconfigure(encoding='utf-8')

base = r"d:\agendamiento"

pdf_files = [
    "Agendamiento modulo 1.pdf",
    "agendamiento modulo 2.pdf",
    "agendamiento modulo 3.pdf",
    "agendamiento modulo 4.pdf",
    "agendamiento modulo 5.pdf",
]

docx_files = [
    "correciones_Modulo1_Documentacion.docx",
    "correciones_Modulo2_Documentacion.docx",
]

def extract_pdf(path):
    text = ""
    try:
        with pdfplumber.open(path) as pdf:
            for i, page in enumerate(pdf.pages):
                t = page.extract_text()
                if t:
                    text += f"\n--- Page {i+1} ---\n{t}"
                if i >= 79:
                    text += "\n[... truncated at 80 pages ...]"
                    break
    except Exception as e:
        text = f"ERROR: {e}"
    return text

def extract_docx(path):
    text = ""
    try:
        doc = docx.Document(path)
        for para in doc.paragraphs:
            text += para.text + "\n"
    except Exception as e:
        text = f"ERROR: {e}"
    return text

output_path = os.path.join(base, "extracted_docs.txt")
with open(output_path, "w", encoding="utf-8") as out:
    for f in pdf_files:
        path = os.path.join(base, f)
        out.write(f"\n{'='*80}\n")
        out.write(f"FILE: {f}\n")
        out.write('='*80 + "\n")
        out.write(extract_pdf(path))
        out.write("\n")
        print(f"Done: {f}")

    for f in docx_files:
        path = os.path.join(base, f)
        out.write(f"\n{'='*80}\n")
        out.write(f"FILE: {f}\n")
        out.write('='*80 + "\n")
        out.write(extract_docx(path))
        out.write("\n")
        print(f"Done: {f}")

print(f"\nAll extracted to: {output_path}")
