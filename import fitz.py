import fitz
import os

pdf_path = "docs/UserGuide/Covid-CCM.pdf"
output_folder = "docs/assets/Covid-CCM"

os.makedirs(output_folder, exist_ok=True)

doc = fitz.open(pdf_path)

count = 0

for page_num in range(len(doc)):
    page = doc.load_page(page_num)

    images = page.get_images(full=True)

    for img_index, img in enumerate(images):
        xref = img[0]
        pix = fitz.Pixmap(doc, xref)

        if pix.alpha:
            pix = fitz.Pixmap(fitz.csRGB, pix)

        filename = os.path.join(
            output_folder,
            f"page_{page_num+1}_image_{img_index+1}.png"
        )

        pix.save(filename)
        pix = None

        count += 1

print(f"{count} images extracted.")