import fitz
import os

pdf_path = "docs/UserGuide/Covid-CCM.pdf"
output_folder = "docs/assets/Covid-CCM"

os.makedirs(output_folder, exist_ok=True)

doc = fitz.open(pdf_path)

count = 1

for page_num in range(len(doc)):
    page = doc.load_page(page_num)

    images = page.get_images(full=True)

    for img_index, img in enumerate(images):
        xref = img[0]
        pix = fitz.Pixmap(doc, xref)

        if pix.n < 5:
            pix.save(f"{output_folder}/page_{page_num+1}_img_{count}.png")
        else:
            rgb = fitz.Pixmap(fitz.csRGB, pix)
            rgb.save(f"{output_folder}/page_{page_num+1}_img_{count}.png")
            rgb = None

        pix = None
        count += 1

print(f"Done! {count-1} images extracted.")