export interface ToolContent {
  longDescription: string;
  features: string[];
  howTo: { step: string; description: string }[];
  faq: { question: string; answer: string }[];
  relatedSlugs: string[];
}

export const TOOL_CONTENT: Record<string, ToolContent> = {
  "pdf-compressor": {
    "longDescription": "<p>PDF Compressor processes one PDF up to 100 MiB locally in a JavaScript worker, without uploading the document or using WebAssembly. Light, Balanced, and Strong presets use lossy JPEG recompression and may downsize supported embedded images. Text, fonts, page layout, and metadata are preserved; pages are not rasterized.</p><p>Unsupported images are left unchanged. Savings depend on the document, so text-heavy or already optimized PDFs may not shrink. If the output would be equal in size or larger, the tool returns your original PDF unchanged. There is no target-size guarantee. Encrypted PDFs and documents with populated digital signatures are rejected. Compression is not metadata removal or document sanitization.</p>",
    "features": [
      "Light, Balanced, and Strong lossy image-compression presets",
      "Local JavaScript worker processing for one PDF up to 100 MiB",
      "Preserves text and metadata; skips unsupported images",
      "Returns the original PDF if no smaller output is produced",
      "Compare output size and image counts, then download or adjust compression"
    ],
    "howTo": [
      {
        "step": "Choose Your PDF",
        "description": "Open the tool and choose or drop one non-empty PDF no larger than 100 MiB. Use an unencrypted, unsigned copy you are authorized to edit."
      },
      {
        "step": "Choose Compression Level",
        "description": "Choose Light for less image-quality loss, Balanced for a middle setting, or Strong for more aggressive image compression. All three presets are lossy."
      },
      {
        "step": "Compress the File",
        "description": "Click Compress PDF to process supported images locally. Processing time depends on the document and device; you can cancel while it runs."
      },
      {
        "step": "Review and Download",
        "description": "Check the sizes and counts of optimized and unchanged images, then download. If no smaller output was produced, the download is your original PDF. Use Adjust compression to try another preset, and inspect the downloaded PDF before sharing."
      }
    ],
    "faq": [
      {
        "question": "Does compressing a PDF reduce its quality?",
        "answer": "Yes. Light, Balanced, and Strong all use lossy JPEG recompression on supported images and may reduce their dimensions. Light retains more image detail; Strong is more aggressive. Text and pages are not rasterized, so existing selectable text stays text. Scans remain images; this tool does not add OCR."
      },
      {
        "question": "Is there a file size limit?",
        "answer": "Yes. Select one non-empty PDF up to 100 MiB (104,857,600 bytes). Files within that limit can still exceed browser resources or time out; processing stops after 60 seconds. Try a smaller PDF if that happens."
      },
      {
        "question": "Are my files uploaded to a server?",
        "answer": "No. PDF processing runs locally in a JavaScript worker, not WebAssembly. The compressor does not upload your PDF. Local processing does not remove sensitive content or metadata from the downloaded file."
      },
      {
        "question": "Can I compress multiple PDFs at once?",
        "answer": "No. The tool processes one PDF at a time. After downloading, choose New file to process another document."
      },
      {
        "question": "Why did some images or the file size stay unchanged?",
        "answer": "Images with unsupported encodings, color profiles, or masks are skipped, as are images that exceed safety limits, fail to decode, or do not get smaller. The PDF structure may still be saved more compactly. If the complete output is not smaller, the original file is returned byte for byte. No reduction percentage or target size, such as 1 MB, is guaranteed."
      },
      {
        "question": "Can I compress encrypted or digitally signed PDFs?",
        "answer": "Encrypted PDFs, including files with permission restrictions, are rejected. Documents with populated digital signatures are also rejected because rewriting them would invalidate their signatures. Use an unencrypted, unsigned copy you are authorized to edit. Empty signature fields alone do not trigger rejection; the tool does not validate signature authenticity."
      },
      {
        "question": "Does compression remove metadata or sanitize the document?",
        "answer": "No. Document metadata is preserved, along with text, fonts, page geometry, and form appearances. Compression is not redaction or sanitization. Review sensitive content and metadata separately before sharing."
      }
    ],
    "relatedSlugs": [
      "pdf-merge",
      "pdf-split",
      "pdf-to-image",
      "pdf-watermark",
      "pdf-protect"
    ]
  },
  "image-to-pdf": {
    "longDescription": "<p>Image to PDF is a free, browser-based converter that transforms JPG, PNG, WebP, BMP, and GIF images into professional PDF documents. Perfect for combining multiple photos into a single presentation, creating portfolios, or preparing scanned documents for submission, this tool handles the conversion entirely in your browser. No server uploads, no watermarks, and no registration required—just fast, reliable image-to-PDF conversion whenever you need it.</p><p>Add images by browsing or by dragging and dropping them straight onto the tool, then reorder them before converting and choose between fit-to-image pages or A4 and Letter with a custom margin. The client-side processing ensures your images remain private and secure throughout the entire conversion.</p>",
    "features": [
      "Combine JPG, PNG, WebP, BMP and GIF images into one PDF",
      "Add images by browsing or by dragging and dropping",
      "Reorder images before conversion with the move buttons",
      "Fit-to-image pages, or A4 and Letter with a custom margin",
      "100% client-side processing with no file uploads",
      "Free, fast, and no registration required"
    ],
    "howTo": [
      {
        "step": "Add Images",
        "description": "Click Add images to browse your device, or drag and drop image files straight onto the tool."
      },
      {
        "step": "Arrange Order",
        "description": "Use the up and down buttons on each card to reorder images as they will appear in the PDF."
      },
      {
        "step": "Configure Settings",
        "description": "Choose fit-to-image, A4 or Letter, and adjust the margin when using a fixed page size."
      },
      {
        "step": "Build the PDF",
        "description": "Click Download PDF to combine the images and save the resulting file instantly."
      }
    ],
    "faq": [
      {
        "question": "What image formats are supported?",
        "answer": "JPG, JPEG, PNG, WebP, BMP and GIF are supported. Animated GIF files are added as their static first frame."
      },
      {
        "question": "Can I combine images of different sizes into one PDF?",
        "answer": "Yes. With A4 or Letter pages, each image is scaled to fit the selected page and its margin while keeping its aspect ratio. Fit-to-image mode gives each image its own page at its natural size."
      },
      {
        "question": "Is there a limit to how many images I can add?",
        "answer": "There's no hard limit, but processing very large numbers of high-resolution images may slow down depending on your device's memory and browser capabilities."
      },
      {
        "question": "Does this tool upload my images?",
        "answer": "No. All conversion happens locally in your browser. Your images are never sent to any server."
      }
    ],
    "relatedSlugs": [
      "pdf-to-image",
      "pdf-crop",
      "pdf-merge",
      "pdf-watermark",
      "pdf-page-numbers"
    ]
  },
  "pdf-to-image": {
    "longDescription": "<p>PDF to Image renders the pages of a PDF into PNG or JPEG images entirely in your browser. Pick the pages you need — a range like 1-3,5 or the whole document — choose a format and quality scale, and export single pages or a ZIP archive of all of them. Nothing is uploaded; the file never leaves your device.</p><p>Use the output-scale slider to control resolution: at 1x a US-Letter page comes out at roughly 72 PPI, at 4x around 288 PPI — plenty for web use and most print-adjacent needs. Perfect for sharing a slide, archiving a receipt, or pulling any page out of a multi-page document without installing software.</p>",
    "features": [
      "Render PDF pages as PNG or JPEG images",
      "Output scale from 1x to 4x (about 72–288 PPI at US Letter)",
      "Convert a page range like 1-3,5, or the entire document",
      "Preview the first 12 pages, then save a single page",
      "Download all selected pages as a ZIP archive",
      "100% browser-based — no uploads"
    ],
    "howTo": [
      {
        "step": "Upload PDF",
        "description": "Drag and drop your PDF file, or click to browse and select it from your device."
      },
      {
        "step": "Set Format and Scale",
        "description": "Choose PNG or JPEG output, then pick a quality scale from 1x to 4x (about 72–288 PPI at US Letter size)."
      },
      {
        "step": "Choose Pages",
        "description": "Leave the Pages box empty to convert everything, or enter a range such as 1-3,5 to convert only those pages."
      },
      {
        "step": "Convert and Download",
        "description": "Conversion starts automatically. Save a single page, or download all the selected pages as a ZIP archive."
      }
    ],
    "faq": [
      {
        "question": "What's the difference between PNG and JPEG output?",
        "answer": "JPEG is best for photographs and complex images with smaller file sizes. PNG is ideal for graphics with sharp lines and text, offering lossless quality at larger file sizes."
      },
      {
        "question": "Can I convert just some pages of a multi-page PDF?",
        "answer": "Yes. Enter a page range in the Pages box (for example 2-4 or 1,3,5) to limit the conversion, or leave it empty for all pages."
      },
      {
        "question": "What DPI do the images come out at?",
        "answer": "The Output scale slider sets the resolution: scale 1x is about 72 PPI and scale 4x about 288 PPI when measured at US-Letter size. The exported images don't carry DPI metadata, so choose the scale for where the images will be used — 1–2x for the screen, up to 4x when you need more pixels."
      },
      {
        "question": "Does this work with encrypted PDFs?",
        "answer": "Password-protected PDFs can't be read here. Unlock the file first with our PDF Unlock tool, then convert the unlocked version."
      },
      {
        "question": "What does the ZIP contain?",
        "answer": "Download ZIP re-renders your selected pages at the current format and scale and bundles them into a single archive."
      },
      {
        "question": "Are there size limits?",
        "answer": "This tool handles PDFs up to 100 MB and up to 200 pages per run. For larger documents, split them with PDF Split first."
      }
    ],
    "relatedSlugs": [
      "image-to-pdf",
      "pdf-to-text",
      "pdf-to-ppt",
      "pdf-rotate",
      "pdf-ocr",
      "pdf-crop",
      "pdf-split"
    ]
  },
  "pdf-to-word": {
    "longDescription": "<p>PDF to Word is a smart, browser-based converter that transforms PDF documents into fully editable Microsoft Word (.docx) files. Unlike basic converters that flatten your content into images, our tool preserves text, formatting, tables, images, and layout structure so you can edit the document as if it were originally created in Word. The conversion runs entirely client-side, meaning your sensitive documents never leave your computer.</p><p>Whether you need to edit a contract, update a resume, modify a report, or extract content from a locked-down PDF, our converter delivers accurate, high-fidelity results. It handles complex multi-column layouts, embedded graphics, and tables with impressive accuracy. Best of all, it's completely free with no watermarks, no sign-ups, and no file size restrictions—making professional-quality PDF-to-Word conversion accessible to everyone.</p>",
    "features": [
      "Convert PDF to fully editable .docx files",
      "Preserves text formatting, fonts, and paragraph structure",
      "Maintains tables, images, and column layouts",
      "Supports multi-page documents of any length",
      "100% client-side conversion for maximum privacy",
      "No watermarks, registration, or file size limits"
    ],
    "howTo": [
      {
        "step": "Upload PDF",
        "description": "Drag and drop your PDF file into the converter or click to select it from your device."
      },
      {
        "step": "Start Conversion",
        "description": "Click the convert button and let the tool analyze and transform your document."
      },
      {
        "step": "Preview and Adjust",
        "description": "Review the conversion output to ensure formatting and content are preserved correctly."
      },
      {
        "step": "Download Word File",
        "description": "Download the generated .docx file ready for editing in Microsoft Word or Google Docs."
      }
    ],
    "faq": [
      {
        "question": "Will the formatting be preserved perfectly?",
        "answer": "Our tool preserves most formatting including text styles, tables, images, and layout. However, very complex layouts with overlapping elements may require minor manual adjustments in Word."
      },
      {
        "question": "Does it work with scanned PDFs?",
        "answer": "Scanned PDFs contain images rather than text. For those, use our OCR PDF tool first to extract the text, then convert to Word."
      },
      {
        "question": "Is my document kept private?",
        "answer": "Absolutely. The entire conversion process happens in your browser. Your files are never uploaded to any server."
      },
      {
        "question": "Can it handle password-protected PDFs?",
        "answer": "You'll need to unlock the PDF first using our PDF Unlock tool, then convert the unlocked version to Word."
      }
    ],
    "relatedSlugs": [
      "word-to-pdf",
      "pdf-to-text",
      "pdf-to-excel",
      "pdf-ocr",
      "pdf-to-markdown"
    ]
  },
  "word-to-pdf": {
    "longDescription": "<p>BrainCoder's Word to PDF renders your .docx document into a PDF right in your browser. The document is parsed locally with mammoth, you review the extracted content in a preview, then the pages are rendered and packed into a paginated A4 PDF that you download. No file is uploaded to any server.</p><p>The PDF is a high-resolution visual snapshot of the document — headings, tables, images, and lists come across as they appear. Because it preserves the look of the page rather than an editable text layer, the copy in the PDF isn't selectable, and elements Word draws outside the page flow (headers, footers, page numbers, separate page sizes) aren't carried over. Use it when you need a reliable, printable copy of exactly what's on the page.</p><p>Everything runs client-side on your device — resumes, contracts, reports, and other sensitive documents never leave your computer.</p>",
    "features": [
      "Convert .docx files to PDF entirely in your browser",
      "Preview the parsed content before converting",
      "Headings, tables, images, and lists rendered onto A4 pages",
      "Drag-and-drop or file-browser upload",
      "No server uploads — complete document privacy",
      "Documents up to 25 MB"
    ],
    "howTo": [
      {
        "step": "Choose Your File",
        "description": "Click the button or drag and drop a .docx file. It's parsed locally and a preview of the content appears."
      },
      {
        "step": "Review the Preview",
        "description": "Check the parsed content — this is exactly what the rendered pages will show."
      },
      {
        "step": "Convert to PDF",
        "description": "Click Convert to PDF to render the pages in your browser."
      },
      {
        "step": "Download",
        "description": "Download the finished PDF and open it anywhere — it's already on your device."
      }
    ],
    "faq": [
      {
        "question": "Does it preserve all Word formatting?",
        "answer": "It preserves how the content looks on the page: headings, bold and italic text, lists, tables, and images are all rendered. Because the output is a visual snapshot, the text inside the PDF isn't selectable."
      },
      {
        "question": "What about headers, footers, and page numbers?",
        "answer": "Those are drawn by Word outside the body content, so they aren't carried over into this rendering — and pagination may differ slightly from Word's own page breaks."
      },
      {
        "question": "Can it handle large Word documents?",
        "answer": "Yes, up to 25 MB. Very long documents are capped at 300 pages; split them into smaller files for anything longer."
      },
      {
        "question": "Is my Word document uploaded to a server?",
        "answer": "No. Parsing and rendering happen entirely in your browser — your document never leaves your device."
      },
      {
        "question": "Can it open .doc files?",
        "answer": "No. Only .docx (Office Open XML) is supported. Save legacy .doc files as .docx first, then convert that."
      }
    ],
    "relatedSlugs": [
      "pdf-to-word",
      "image-to-pdf",
      "excel-to-pdf",
      "html-to-pdf",
      "text-to-pdf"
    ]
  },
  "pdf-to-text": {
    "longDescription": "<p>PDF to Text pulls the text layer out of a PDF and gives it to you as clean, copyable plain text — entirely in your browser. Choose a page range or extract the whole document, then copy the result or download it as a .txt file. Nothing is uploaded; your documents stay on your device.</p><p>The extractor reads the embedded text directly from the PDF and reconstructs paragraphs in reading order, so quotes, reports, and paper content come out ready to paste into a document or code editor. It works on PDFs that contain real text; PDFs that are just scans or photos have no text layer and need OCR instead.</p>",
    "features": [
      "Extract the embedded text from PDF pages",
      "Choose a page range like 1-3, or the whole document",
      "Reconstructs reading order and paragraph breaks",
      "Copy to clipboard or download as .txt",
      "100% browser-based with no server uploads",
      "PDFs up to 100 MB"
    ],
    "howTo": [
      {
        "step": "Upload PDF",
        "description": "Drag and drop your PDF file, or click to browse and select it from your device."
      },
      {
        "step": "Choose Pages (Optional)",
        "description": "To extract only some pages, enter a range in the Pages box such as 1-3 or 1,3,5; leave it empty to extract the whole document."
      },
      {
        "step": "Review Output",
        "description": "Extraction starts automatically and the text appears in the preview box in reading order."
      },
      {
        "step": "Copy or Download",
        "description": "Copy the text to your clipboard or download it as a plain text file."
      }
    ],
    "faq": [
      {
        "question": "Does it work with scanned PDFs?",
        "answer": "No — scanned PDFs store images, not text. Use our PDF OCR tool to read the text from the page images first."
      },
      {
        "question": "Will the text formatting be preserved?",
        "answer": "The output is plain text: reading order and paragraph breaks are kept, but bold, italic, and font styling are not. Use PDF to Word for a formatted, image-based document."
      },
      {
        "question": "How accurate is the extraction?",
        "answer": "For text-based PDFs the extraction reads the embedded text directly, so it's as accurate as the PDF's own text layer. Complex multi-column layouts can reorder when read as straight text."
      },
      {
        "question": "Can I extract text from specific pages only?",
        "answer": "Yes. Put a range like 1-3 (or pages such as 1,3,5) in the Pages box before extracting."
      },
      {
        "question": "What if no text comes out?",
        "answer": "Then the PDF has no text layer — it's a scanned document. The tool shows a hint and you can switch straight to PDF OCR to read the pages."
      }
    ],
    "relatedSlugs": [
      "pdf-ocr",
      "pdf-to-word",
      "pdf-to-markdown",
      "text-to-pdf",
      "pdf-to-excel"
    ]
  },
  "text-to-pdf": {
    "longDescription": "<p>BrainCoder's Text to PDF converter turns plain text into a downloadable A4 PDF — instantly and privately. Paste meeting notes, a letter, a report, or even source code into the box, pick a font size, and download a clean, word-wrapped document with automatic page breaks.</p><p>The converter word-wraps your text to the page width and splits long documents across pages automatically, so multi-page notes come out as a tidy, readable file. It embeds basic Latin text — the encoding used by the PDF's built-in font — so text containing non-Latin scripts such as CJK, Cyrillic, Greek, Arabic, or emoji can't be rendered, and the tool tells you exactly which characters to remove or replace before it builds the PDF.</p><p>All processing happens in your browser: your text is laid out and rendered into the PDF locally and is never uploaded to any server. No software installation, no account creation, nothing to sign up for.</p>",
    "features": [
      "Paste plain text and download a clean, word-wrapped PDF",
      "Choose a font size from 10–24 pt to suit the document",
      "Automatic page breaks for long documents",
      "Download as a standard PDF file",
      "100% browser-based — nothing is uploaded",
      "No watermarks, no accounts"
    ],
    "howTo": [
      {
        "step": "Paste Your Text",
        "description": "Enter or paste the text you want to convert — notes, reports, letters, or code. The box accepts up to 500,000 characters and wraps text to the page width automatically."
      },
      {
        "step": "Choose a Font Size",
        "description": "Use the font-size slider to pick 10–24 pt type (13 pt by default). Line spacing and the A4 page layout follow the size you choose."
      },
      {
        "step": "Download the PDF",
        "description": "Press Download PDF and the file saves to your device as text.pdf. Open it in any PDF viewer."
      }
    ],
    "faq": [
      {
        "question": "Can I add headings, bold, or other rich formatting?",
        "answer": "No — the tool embeds plain text only. Your line breaks, paragraphs, bullets, and basic punctuation are preserved as text. For rich formatting (headings, bold, lists), use Markdown to HTML first and then HTML to PDF for more control."
      },
      {
        "question": "Does it support Chinese, Arabic, Cyrillic, or emoji?",
        "answer": "No. The PDF's built-in font encodes basic Latin (WinAnsi) characters only, which covers English and most Western European languages. If your text contains non-Latin characters, the tool lists the exact characters you need to remove or replace before building the PDF."
      },
      {
        "question": "What page size and margins does it use?",
        "answer": "A4, with a page margin built into the layout. Text is wrapped to the page width and breaks to a new page automatically whenever the next line would cross the bottom margin."
      },
      {
        "question": "How much text can I convert at once?",
        "answer": "Up to 500,000 characters. A live counter below the text box shows your current length and flags the cap."
      },
      {
        "question": "Is my text uploaded to generate the PDF?",
        "answer": "No. The entire PDF generation process happens locally in your browser — your text never leaves your device."
      }
    ],
    "relatedSlugs": [
      "html-to-pdf",
      "word-to-pdf",
      "md-to-html",
      "notepad",
      "text-cleaner"
    ]
  },
  "pdf-to-ppt": {
    "longDescription": "<p>PDF to PPT turns each page of a PDF into its own slide in a 16:9 PowerPoint file — entirely in your browser. Every page is rendered as a high-resolution snapshot image placed on a full slide, so the finished deck looks exactly like your original document. Nothing is uploaded and no account is needed.</p><p>Use the Pages box to convert just the slice you need (for example 1-3,5), and set the image-quality slider to control sharpness: 1x keeps file sizes small, 3x renders crisper slides for projection. Preview up to the first 12 slides before you download. The exported slides are pictures, not editable text — if you need selectable or editable content instead, use PDF to Text or PDF to Markdown. Files can be up to 100 MB and 200 pages per run (PDF files generate one slide per page, so processing time grows with length).</p>",
    "features": [
      "Convert each PDF page into a full-slide snapshot image in a 16:9 .pptx",
      "Convert a page range like 1-3,5, or the entire document",
      "Slide image quality from 1x to 3x",
      "Preview the first 12 rendered slides before you download",
      "Exports .pptx files compatible with PowerPoint and Google Slides",
      "Handles PDFs up to 100 MB and 200 pages per run",
      "100% client-side conversion with no data uploads"
    ],
    "howTo": [
      {
        "step": "Upload PDF",
        "description": "Drag and drop your PDF into the converter, or click to browse and select it from your device."
      },
      {
        "step": "Choose Pages and Quality",
        "description": "Set the image-quality slider (1x to 3x) and, optionally, enter a page range such as 1-3,5. The slides render automatically."
      },
      {
        "step": "Review the Previews",
        "description": "Check the slide previews. If they look right, adjust the range or quality — the deck re-renders as you go."
      },
      {
        "step": "Download Presentation",
        "description": "Click Download .pptx to save the deck. It opens in PowerPoint or Google Slides ready to present."
      }
    ],
    "faq": [
      {
        "question": "Can I edit the text on the slides after conversion?",
        "answer": "No — each slide is a flat snapshot image, so the text cannot be selected or edited. If you need editable content, use PDF to Text or PDF to Markdown instead, which extract the wording you can paste into any presentation."
      },
      {
        "question": "Will the slides look like my original pages?",
        "answer": "Yes. Every page is rendered as a clear image and fitted neatly inside a 16:9 slide, so the deck mirrors your document page for page."
      },
      {
        "question": "Can I convert specific pages only?",
        "answer": "Yes. Enter a page range in the Pages box (for example 2-4 or 1,3,5) to convert only those pages, or leave it empty for the whole document."
      },
      {
        "question": "How can I make sharper slides?",
        "answer": "Raise the image-quality slider toward 3x. Higher settings produce crisper slides for projection but larger file sizes and slower rendering."
      },
      {
        "question": "Are there size limits?",
        "answer": "This tool handles PDFs up to 100 MB and up to 200 pages per run. For larger documents, split them with PDF Split first."
      },
      {
        "question": "Does it preserve animations and transitions?",
        "answer": "PDFs don't contain animation or transition data, and the slides are static images, so none are carried over. You can add them manually in PowerPoint after conversion."
      }
    ],
    "relatedSlugs": [
      "pdf-to-image",
      "pdf-to-text",
      "pdf-to-markdown",
      "pptx-creator",
      "pdf-to-word"
    ]
  },
  "pdf-rotate": {
    "longDescription": "<p>PDF Rotator turns a sideways PDF the right way in one click. Load a document whose pages are rotated by 90° or 180°, pick a direction, and every page is rotated together—no per-page clicking and no preview needed. The result downloads instantly.</p><p>Rotation is a metadata-level operation: page content is not re-encoded, so text, images, and quality are preserved. Everything runs in your browser, and files never leave your device. If you need to reorient only some pages of a mixed-orientation document, PDF Editor shows page previews and lets you change individual pages instead.</p>",
    "features": [
      "Rotate every page of a PDF 90° clockwise, 90° counter-clockwise, or 180° in one click",
      "Chained rotations continue from the current orientation (three 90° turns reach 270°)",
      "Lossless, metadata-only rotation that preserves text, images, and quality",
      "Each result downloads instantly with a fresh filename",
      "Works with scanned and digital PDFs alike",
      "100% in your browser — no uploads (PDFs up to 100 MB)"
    ],
    "howTo": [
      {
        "step": "Open PDF",
        "description": "Click Open PDF and choose the document from your device."
      },
      {
        "step": "Choose a Rotation Direction",
        "description": "Select 90° clockwise, 90° counter-clockwise, or 180°. Every page is rotated together."
      },
      {
        "step": "Download Rotated PDF",
        "description": "The rotated PDF downloads instantly. To reorient further, pick another direction — each result continues from the current orientation."
      }
    ],
    "faq": [
      {
        "question": "Will rotating reduce the quality of my PDF?",
        "answer": "No. Rotation only changes each page's orientation, so the page content itself is not re-encoded and quality is preserved. The tool rewrites the file with its own encoder to apply the change."
      },
      {
        "question": "Can I rotate just one page in a 50-page document?",
        "answer": "This tool always rotates the whole document together. To rotate individual pages, use PDF Editor, which shows page previews and lets you change one page at a time."
      },
      {
        "question": "Does this work with scanned PDFs?",
        "answer": "Yes. Scanned pages are rotated exactly like any other, because the orientation change applies to the page itself rather than the text inside it."
      },
      {
        "question": "Can I reach a 270° rotation?",
        "answer": "Yes. The three buttons produce 90°, 180°, and 270° out of the original orientation — for example, three 90° clockwise turns, or one 90° counter-clockwise turn, both end at 270°."
      },
      {
        "question": "Are there size limits?",
        "answer": "This tool handles PDFs up to 100 MB. Password-protected files can't be read directly — unlock them with PDF Unlock first."
      }
    ],
    "relatedSlugs": [
      "pdf-to-image",
      "pdf-crop",
      "pdf-remove-pages",
      "pdf-merge",
      "pdf-split",
      "pdf-editor"
    ]
  },
  "pdf-remove-pages": {
    "longDescription": "<p>PDF Delete Pages trims a document down to only the pages you want. Every page is rendered as a thumbnail, you tap the ones to delete, and the tool rebuilds the file from the pages you kept. Nothing is uploaded — the whole operation runs in your browser.</p><p>The output is a standard PDF built from your kept pages, so on-page content, links and layout are preserved. Because the file is rebuilt rather than edited in place, document-level bookmarks and metadata may not survive, and password-protected files should be unlocked first. It handles PDFs up to 100 MB and 200 pages per run.</p>",
    "features": [
      "Preview every page as a thumbnail and tap the ones to delete",
      "Rebuild the PDF from just the pages you keep",
      "Keep remaining page content, links and layout intact",
      "Works with PDFs up to 100 MB and 200 pages",
      "100% browser-based with no server uploads",
      "Free to use with no registration required"
    ],
    "howTo": [
      {
        "step": "Open PDF",
        "description": "Open the PDF you want to trim. Thumbnails of every page appear as they render."
      },
      {
        "step": "Mark pages",
        "description": "Tap any thumbnail to mark that page for deletion. Marked pages get a red border — tap again to keep a page."
      },
      {
        "step": "Delete and download",
        "description": "Choose Delete pages to rebuild the PDF from the remaining pages. The result downloads instantly."
      }
    ],
    "faq": [
      {
        "question": "Can I undo the page removal?",
        "answer": "The original file is never modified. Keep a backup before removing pages, since the operation is applied to the downloaded result."
      },
      {
        "question": "Will removing pages affect the PDF structure?",
        "answer": "On-page content, links and layout are kept. Because the file is rebuilt from your kept pages, document-level bookmarks and metadata such as author info may not be preserved."
      },
      {
        "question": "How many pages can I remove at once?",
        "answer": "Select as many as you like in a single run, up to 200 pages and 100 MB. Larger documents can be split with PDF Split first."
      },
      {
        "question": "Does this work with encrypted PDFs?",
        "answer": "Password-protected PDFs need to be unlocked first using our PDF Unlock tool before you can remove pages."
      },
      {
        "question": "Can it detect blank pages?",
        "answer": "Use Remove Blank Pages to auto-detect near-empty pages, instead of hunting through a long document manually."
      }
    ],
    "relatedSlugs": [
      "pdf-split",
      "pdf-merge",
      "pdf-crop",
      "pdf-rotate",
      "pdf-remove-blank-pages",
      "pdf-unlock",
      "pdf-editor"
    ]
  },
  "pdf-watermark": {
    "longDescription": "<p>PDF Watermark stamps the same text watermark on every page of a PDF. Open a file, type up to 80 characters, tune the size, opacity and angle, and download a watermarked copy — the whole operation runs in your browser with nothing uploaded.</p><p>Watermarks use a fixed bold Helvetica in dark grey so the output stays predictable: labels like CONFIDENTIAL, DRAFT or © Copyright render cleanly at any size from 12 to 120 pt. The text is centered on each page and auto-shrinks to stay within the page width. A watermark is a visual deterrent, not redaction — to permanently remove content, use PDF Redact. Password-protected files should be unlocked with PDF Unlock first, and the output isn't re-protected.</p>",
    "features": [
      "Stamp the same text watermark on every page",
      "Tune size (12–120 pt), opacity (1–100%) and angle (−90° to 90°)",
      "Fixed bold Helvetica in dark grey for predictable output",
      "Page-orientation aware — watermarks match rotated pages and stay centered",
      "Runs entirely in your browser; handles PDFs up to 100 MB",
      "Free, with no account or sign-up"
    ],
    "howTo": [
      {
        "step": "Open PDF",
        "description": "Open the PDF to watermark. The page count is read instantly."
      },
      {
        "step": "Write the text",
        "description": "Type up to 80 characters. Latin letters, numbers and common punctuation render cleanly in the built-in bold Helvetica font."
      },
      {
        "step": "Tune the look",
        "description": "Pick the font size, opacity and angle with the sliders."
      },
      {
        "step": "Stamp and download",
        "description": "Choose Add watermark → download. Every page gets the same stamp and the file downloads instantly."
      }
    ],
    "faq": [
      {
        "question": "Can I add different watermarks to different pages?",
        "answer": "This tool applies one watermark to every page. For page-specific watermarks and custom colors or placement, use our PDF Editor tool."
      },
      {
        "question": "Does the watermark prevent copying or selecting text?",
        "answer": "No. A text watermark is a visual marking, not redaction. Use PDF Redact to permanently remove content from a PDF."
      },
      {
        "question": "What opacity range is available?",
        "answer": "You can set the opacity anywhere from 1% (nearly invisible) to 100% (fully opaque)."
      },
      {
        "question": "Which characters can I use?",
        "answer": "The watermark uses a built-in bold Helvetica font, which covers Latin letters, numbers and common punctuation. Emoji, symbols and non-Latin scripts (like Chinese or Arabic) can't be encoded — the tool will tell you if your text uses unsupported characters."
      },
      {
        "question": "Does this work with password-protected PDFs?",
        "answer": "Unlock the file with PDF Unlock first and load the unlocked copy here. Note that the watermarked result is not re-protected — use PDF Protect afterwards if you need encryption."
      }
    ],
    "relatedSlugs": [
      "pdf-unlock",
      "pdf-redact",
      "pdf-editor",
      "pdf-protect",
      "pdf-page-numbers",
      "pdf-merge"
    ]
  },
  "pdf-page-numbers": {
    "longDescription": "<p>Add Page Numbers to PDF inserts a label into every page of your document, so multi-page files stay easy to navigate whether they're used as an internal draft, submitted, or printed. Choose a corner (bottom center is the default), a font size between 8 and 24 points, whether to show a plain number or an “n / total” count, and an optional starting offset — the document's first page can read as 5 instead of 1, for example, without skipping any pages.</p><p>Labels are drawn as fixed dark-grey Helvetica in the edges of every page, and placement adjusts for each page's orientation, so portrait and landscape pages in the same document stay aligned and readable. Everything runs locally in your browser: nothing is uploaded, and files up to 100 MB with up to 200 pages are supported. There is no preview, so download and review the numbered file to confirm placement before distributing it.</p>",
    "features": [
      "Add a page number to every page of a PDF",
      "Six corner positions: top or bottom, left, center, or right",
      "Plain Arabic numerals or “n / total” labels",
      "Adjustable font size (8–24 points) and starting number",
      "Placement follows each page's rotation for aligned, readable numbers",
      "100% client-side with no uploads or sign-ups"
    ],
    "howTo": [
      {
        "step": "Open PDF",
        "description": "Select a PDF up to 100 MB that you want to number. The page count is shown before you continue."
      },
      {
        "step": "Set Position and Labels",
        "description": "Choose a position, font size, “n / total” toggle, and an optional starting number. Every page is still numbered — the offset only changes what the labels read."
      },
      {
        "step": "Add Numbers",
        "description": "Click “Add page numbers” and the labels are drawn into the edges of every page."
      },
      {
        "step": "Download",
        "description": "The numbered PDF downloads automatically, ready to review."
      }
    ],
    "faq": [
      {
        "question": "Can I start page numbers on page 2, skipping a cover page?",
        "answer": "Yes — set “Start numbering at” to 0, or to 2 if you want to preserve a manuscript count. The page that is physically first will reuse the label 0, or will show 2 on the second page. Every page is still numbered; there is no “skip this page” option, so a cover page will carry a number."
      },
      {
        "question": "Do page numbers overlap with existing content?",
        "answer": "Numbers are placed in the outermost edges of each page, in the smallest practical margin. If your own content already extends to the very edge of the page, a number may sit on top of it — the tool can't create margin space where none exists. Consider trimming crowded pages with PDF Cropper first, then numbering the result."
      },
      {
        "question": "Does this work with landscape and portrait pages mixed together?",
        "answer": "Yes. Placement is computed from each page's own rotation, so on a 90° or 270° landscape page the number still sits in the same visual corner and reads upright, matching every other page."
      },
      {
        "question": "Can I use Roman numerals, colors, or fonts other than Helvetica?",
        "answer": "No. Labels are always fixed dark-grey Helvetica in Arabic numerals. “Start numbering at” is the only formatting adjustment beyond position and size."
      },
      {
        "question": "Why can't I open an encrypted PDF?",
        "answer": "PDFs protected with a password aren't supported — the tool deliberately refuses to read them rather than risk corrupting them. Unlock the file with PDF Unlock first, then load the unlocked copy here."
      }
    ],
    "relatedSlugs": [
      "pdf-watermark",
      "pdf-merge",
      "pdf-split",
      "pdf-editor",
      "pdf-crop"
    ]
  },
  "pdf-crop": {
    "longDescription": "<p>PDF Cropper trims the top, right, bottom, and left margins of your PDF by percentage. Four sliders cut anywhere from 0–45% off each edge, a live overlay on a page-1 preview shows exactly what will be kept, and one click applies the same cut to every page in the document. It's built for the common cleanups: white space around scanned pages, wide borders, or scanner debris at the edges.</p><p>Cropping works per page, so a document with rotated or mixed-size pages keeps the intended visual margins everywhere: placement is computed from each page's own rotation. Everything runs in your browser — nothing is uploaded, and the cropped file downloads directly to your device. Cropping changes each page's visible boundary: content outside the new edge is clipped from view, not deleted from the file, so the file size stays roughly the same.</p>",
    "features": [
      "Cut top, bottom, left, and right margins by 0–45% per edge",
      "Live preview of the kept area on page 1",
      "The same percentages are applied to every page",
      "Placement follows each page's rotation for consistent visual margins",
      "Works on scanned documents, borders, and white space",
      "100% client-side with no uploads or sign-ups"
    ],
    "howTo": [
      {
        "step": "Open PDF",
        "description": "Click the Open PDF button to select a file up to 100 MB from your device."
      },
      {
        "step": "Set Margins",
        "description": "Use the four sliders to set how much to cut from the top, bottom, left, and right edges."
      },
      {
        "step": "Check the Preview",
        "description": "Page 1 shows which area will remain. The same percentages are applied to every page."
      },
      {
        "step": "Crop and Download",
        "description": "Click “Crop all pages” and the cropped PDF downloads automatically."
      }
    ],
    "faq": [
      {
        "question": "Does cropping permanently remove content?",
        "answer": "No. Cropping changes each page's visible boundary (the crop box). Anything outside it stops displaying, but the underlying PDF content can still be inside the file and may be recoverable by removing the crop or re-extracting content. This tool trims how the page looks, not the data behind it — the file size stays roughly the same. If you need to permanently remove content, use PDF Redact instead."
      },
      {
        "question": "Can I crop pages differently within the same document?",
        "answer": "No — every page gets the same percentage cut. That's deliberate: margin trimming is almost always uniform, and it keeps the output consistent. A preview of page 1 shows the kept area; if your pages are similarly proportioned, page 1 is representative, so download and spot-check a couple of later pages."
      },
      {
        "question": "Does cropping work on rotated or landscape pages?",
        "answer": "Yes. The crop is computed from each page's own rotation, so the same percentage of each displayed edge is removed even when a document mixes portrait and landscape pages."
      },
      {
        "question": "Why can't I open an encrypted PDF?",
        "answer": "PDFs protected with a password aren't supported — the tool deliberately refuses to read them rather than risk corrupting them. Unlock the file with PDF Unlock first, then load the unlocked copy here."
      },
      {
        "question": "Will my file be uploaded?",
        "answer": "No. The PDF is read, cropped, and rebuilt entirely in your browser; the file never leaves your device."
      }
    ],
    "relatedSlugs": [
      "pdf-rotate",
      "pdf-page-numbers",
      "pdf-scale-pages",
      "pdf-remove-pages",
      "pdf-editor"
    ]
  },
  "pdf-protect": {
    "longDescription": "<p>PDF Protect locks a PDF with a password so it can only be opened by people who know it. Pick a password, optionally restrict what recipients can do (printing, copying, editing or annotating), and download the encrypted copy. The encryption uses AES-256, the same standard Adobe Acrobat applies to protected documents, and everything happens in your browser — the file and your password never leave your device.</p><p>Use it for documents you own or are authorized to protect: quotes, statements, contracts, offer letters and anything where the recipient is known but the channel isn't private. Restrictions like blocking printing are honored by Adobe Acrobat and most desktop readers; some minimal or browser-based viewers ignore them, so treat them as a convenience rather than a hard guarantee.</p>",
    "features": [
      "Require a password to open a PDF, encrypted locally with AES-256",
      "Optional restrictions: block printing, copying, editing or annotating",
      "Runs entirely in your browser — the file and password never leave your device",
      "Free, no account — files up to 100 MB and 200 pages"
    ],
    "howTo": [
      {
        "step": "Open PDF",
        "description": "Select the PDF you want to protect from your device."
      },
      {
        "step": "Set a password",
        "description": "Choose a password (at least 5 characters; 8+ recommended for anything sensitive) and confirm it."
      },
      {
        "step": "Pick restrictions (optional)",
        "description": "Block printing, copying, editing or annotating — or leave them all open so recipients can do anything the document allows."
      },
      {
        "step": "Protect & download",
        "description": "Click “Protect PDF” and download the encrypted copy. It now opens only with your password."
      }
    ],
    "faq": [
      {
        "question": "What kind of password does this add?",
        "answer": "One password that must be entered to open the file. There's no separate 'permissions password' — the same password opens it, and the optional restrictions apply to everyone once they're in."
      },
      {
        "question": "How strong is the encryption?",
        "answer": "AES-256 — the industry-standard encryption Adobe Acrobat uses for protected PDFs. As always, the weak point is a short or predictable password, so use something strong and don't share it in the same message as the file."
      },
      {
        "question": "Can I remove the password later?",
        "answer": "Yes. If you know the password, use our Unlock PDF tool to download a copy with the password removed."
      },
      {
        "question": "Do printing and copying restrictions work in every reader?",
        "answer": "Adobe Acrobat and most desktop readers enforce them. Some minimal or browser-based viewers ignore restrictions, so don't rely on them alone when distributing sensitive documents — a password is the stronger layer."
      },
      {
        "question": "Will protected PDFs open in every viewer?",
        "answer": "The encryption follows the PDF specification (AES-256, revision 6), so Adobe Acrobat and desktop apps like Preview and Foxit open it with the password. Chrome and Firefox's built-in PDF viewers don't accept passwords — open the file in a dedicated reader instead."
      }
    ],
    "relatedSlugs": [
      "pdf-unlock",
      "pdf-redact",
      "pdf-metadata",
      "pdf-editor",
      "pdf-merge"
    ]
  },
  "pdf-unlock": {
    "longDescription": "<p>PDF Unlock removes the password from a PDF you know the password to. Enter the password the file was locked with, and the tool writes an unlocked copy you can open, print and edit anywhere without re-authenticating. The open (user) password and the owner password both work, and files that only restrict printing or copying — rather than opening — can often be unlocked by leaving the password blank.</p><p>Decryption happens entirely on your device using the standard PDF algorithms (AES-256 and RC4). The file and password never leave your browser. If the PDF uses an encryption this tool doesn't support yet, like AES-128, you'll be told so honestly — open that one in Adobe Acrobat or Preview with the password instead.</p>",
    "features": [
      "Remove a password you know from a PDF and download an unlocked copy",
      "Accepts either the open (user) password or the owner password",
      "Also strips permission restrictions (printing, editing, copying) in the same pass",
      "Supports AES-256 (revision 6) and standard RC4 encryption",
      "Runs entirely in your browser — nothing is uploaded",
      "Free, no account — files up to 100 MB"
    ],
    "howTo": [
      {
        "step": "Open Locked PDF",
        "description": "Select the password-protected PDF from your device."
      },
      {
        "step": "Enter the password",
        "description": "Type the password the file was locked with — the open password or the owner password both work. If it's restricted but opens without a password, leave the field empty."
      },
      {
        "step": "Unlock",
        "description": "The tool decrypts the file locally and verifies the result is a valid unlocked PDF."
      },
      {
        "step": "Download",
        "description": "Save the unlocked copy — it now opens, prints and edits without a password."
      }
    ],
    "faq": [
      {
        "question": "What if I don't know the password?",
        "answer": "You must know the password to unlock a PDF. This tool removes protection given the correct password — it cannot crack or recover forgotten passwords, and any tool that claims to should be treated with suspicion."
      },
      {
        "question": "Which password should I enter?",
        "answer": "Either the open (user) password or the owner password unlocks the file. Files that only restrict printing/copying/editing — with no open password — can often be unlocked by leaving the password field empty."
      },
      {
        "question": "Does unlocking change the document?",
        "answer": "No. Unlocking only removes the password protection and any permission restrictions. Content, layout and quality remain exactly the same."
      },
      {
        "question": "Which encryption methods are supported?",
        "answer": "AES-256 (revision 6) and standard RC4. AES-128 and rare custom schemes aren't supported by this tool yet — open those in Adobe Acrobat or Preview with the password instead."
      }
    ],
    "relatedSlugs": [
      "pdf-protect",
      "pdf-redact",
      "pdf-to-word",
      "pdf-editor",
      "pdf-metadata"
    ]
  },
  "pdf-metadata": {
    "longDescription": "<p>PDF Metadata Viewer reads the metadata a PDF actually stores — the page count, plus title, author, subject, keywords, creator, producer and creation/modification dates when the document records them. It reads the standard Info dictionary, the common XMP fields, and any extra or custom entries, and lists exactly what it finds. Nothing is invented: fields a file doesn't store are skipped rather than shown as empty.</p><p>The inspection runs entirely in your browser using the same PDF engine that powers the page renderer — the file is never uploaded. This is a read-only viewer: it's for checking the provenance of documents you receive, auditing workflows, or simply spotting what creators a file claims.</p>",
    "features": [
      "Page count, title, author, subject, keywords, creator and producer",
      "Creation and modification dates (PDF-standard and XMP)",
      "Common XMP fields when the Info dictionary lacks them",
      "Extra and custom Info-dict entries, listed in one place",
      "PDF format version when the file records it",
      "Runs entirely in your browser — free, nothing uploaded (files up to 100 MB)"
    ],
    "howTo": [
      {
        "step": "Open PDF",
        "description": "Select a PDF from your device."
      },
      {
        "step": "View metadata",
        "description": "The viewer lists the fields the file actually stores, starting with the page count."
      },
      {
        "step": "Review details",
        "description": "Check the title, author, creation and modification dates, and any custom entries. Fields the file doesn't store simply aren't listed."
      }
    ],
    "faq": [
      {
        "question": "Can I edit metadata with this tool?",
        "answer": "No — this is a read-only viewer. Editing embedded metadata isn't offered anywhere on this site yet, so use dedicated desktop tools if you need to change or remove it."
      },
      {
        "question": "What if a PDF has no metadata?",
        "answer": "The viewer shows what exists — at minimum the page count — and notes when no title, author or date fields were found. Empty fields are skipped rather than shown, so the list is what's really in the file."
      },
      {
        "question": "Can metadata reveal who created a PDF?",
        "answer": "Often, yes. The author and creator fields usually name the person or software that produced the file, depending on how it was made — though they can be blank, generic or set to anything."
      },
      {
        "question": "Does this work with protected PDFs?",
        "answer": "Files that only limit permissions (with no open password) can be inspected directly. Files locked with an open password must be opened with the password first, or unlocked with our Unlock PDF tool."
      }
    ],
    "relatedSlugs": [
      "pdf-protect",
      "pdf-unlock",
      "pdf-redact",
      "pdf-to-text",
      "pdf-editor"
    ]
  },
  "pdf-to-excel": {
    "longDescription": "<p>PDF to Excel reads the text layer of a PDF and reconstructs its lines into spreadsheet cells. It groups words into lines by their position on the page, then splits each line into columns wherever a large horizontal gap separates words — so simple tabular layouts like financial reports, product lists or data sheets come out as rows and columns you can open in Excel, Google Sheets or any spreadsheet app. Output can be downloaded as .xlsx or .csv.</p><p>It works from the PDF's embedded text layer — text-based PDFs (created by Word, Excel, browsers or invoice software) convert well; scanned or photographed PDFs have no text layer and need our PDF OCR tool first. The layout rules are best-effort: uniform column tables convert cleanly, but merged cells, spanning rows, and tight multi-column pages may need manual cleanup in the spreadsheet. Every cell is exported as text, so numbers arrive as labels rather than formulas. All processing is client-side — nothing is uploaded.</p>",
    "features": [
      "Reconstruct a PDF's text lines into spreadsheet rows and columns",
      "Split cells at column gaps on the page (best-effort layout rules)",
      "Export as .xlsx or .csv, up to 200 pages and 100 MB",
      "Runs entirely in the browser — nothing is uploaded",
      "Preview the extracted grid before downloading",
      "Cells are exported as text (safe to open, never formulas)"
    ],
    "howTo": [
      {
        "step": "Open PDF",
        "description": "Choose a text-based PDF that contains a table you want as a spreadsheet."
      },
      {
        "step": "Review the grid",
        "description": "The extracted rows and columns appear in a preview. Split cells at large horizontal gaps; tight columns may merge."
      },
      {
        "step": "Download",
        "description": "Download the result as .xlsx or .csv. Cells are text, so sums may need a conversion step."
      }
    ],
    "faq": [
      {
        "question": "Does it work on scanned PDFs?",
        "answer": "No — a scanned PDF has no text layer, so nothing can be read. Use our PDF OCR tool first to recognize the text, then convert the result here."
      },
      {
        "question": "How well does it extract tables?",
        "answer": "Well-structured tables with a clean text layer — like reports, invoices and price lists — come out close to the original. Merged cells and spanning rows are not reproduced: each text line becomes one spreadsheet row, and each large horizontal gap starts a new column."
      },
      {
        "question": "Will my numbers be usable for calculations?",
        "answer": "Every cell is exported as text, so a '1,200' cell is a label, not a numeric value. In Excel you can convert columns to numbers in one step."
      },
      {
        "question": "Can it handle multiple tables or pages?",
        "answer": "Every page's text lines are extracted into the same sheet, separated by a blank row. There is no table-by-table selection."
      },
      {
        "question": "Is my data uploaded?",
        "answer": "No. The PDF is read entirely in your browser and never leaves your device."
      }
    ],
    "relatedSlugs": [
      "pdf-ocr",
      "pdf-to-text",
      "pdf-to-markdown",
      "pdf-to-word",
      "pdf-to-ppt"
    ]
  },
  "pdf-to-markdown": {
    "longDescription": "<p>PDF to Markdown extracts the text layer of a PDF into Markdown (.md), with an .html rendering of the same text. It groups the extracted words into lines using their position on the page, keeps paragraph breaks, and makes best-effort guesses at headings and bullet lists. It is a fast way to get the prose of a well-structured document (reports, papers, documentation) into a Markdown-based workflow — READMEs, wikis, AI prompts, note tools.</p><p>The extraction is honest about what it is: a text-layer reader with layout heuristics, not a visual replica. It does not reproduce tables, bold/italic styling, links, images or code blocks, and multi-column or rotated pages may come out scrambled. Scanned PDFs have no text layer and need our PDF OCR tool first; password-protected files need PDF Unlock. All conversion happens in your browser — nothing is uploaded.</p>",
    "features": [
      "Extract a PDF's text layer into Markdown and .html",
      "Best-effort headings and bullet lists, paragraph breaks preserved",
      "Rotation-aware reading order for straight documents",
      "Up to 200 pages and 100 MB, entirely in the browser",
      "No uploads — nothing leaves your device"
    ],
    "howTo": [
      {
        "step": "Open PDF",
        "description": "Choose a text-based PDF with a readable text layer."
      },
      {
        "step": "Convert",
        "description": "The text layer is re-flowed into Markdown with heading and list heuristics. Review the preview."
      },
      {
        "step": "Download",
        "description": "Download the .md file, or the .html rendering of the same text."
      }
    ],
    "faq": [
      {
        "question": "Does it preserve tables, styling, images or code?",
        "answer": "No. Markdown output contains the extracted text with best-effort headings and bullet lists. Bold/italic, links, images, tables and code blocks are not reproduced — treat the output as text, not a visual copy."
      },
      {
        "question": "What if my PDF looks scrambled?",
        "answer": "Multi-column layouts and rotated pages are the weak point: text from different columns can interleave. A single-column document with a clean text layer converts most reliably."
      },
      {
        "question": "Does it work with scanned PDFs?",
        "answer": "No — a scan has no text layer. Use our PDF OCR tool first to recognize the text, then convert again here or use its .txt output."
      },
      {
        "question": "Is the .html a copy of the original page?",
        "answer": "No — it renders the extracted Markdown as a simple web page. It is a reading aid, not a visual replica of the PDF."
      }
    ],
    "relatedSlugs": [
      "pdf-to-text",
      "pdf-to-excel",
      "pdf-ocr",
      "pdf-unlock",
      "text-to-pdf"
    ]
  },
  "pdf-ocr": {
    "longDescription": "<p>PDF OCR recognizes text in scanned and image-based PDFs. Each page is rendered as an image and run through Tesseract (client-side), and the recognized text is delivered as a .txt file you can copy or download. It is the right first step for a document that has no selectable text at all — a scan, a photo, a fax.</p><p>OCR is not perfect: clarity, fonts and scan quality all matter, so skim the result before relying on it. Text-based PDFs already have a readable text layer and are better served by our PDF to Text tool, which is faster and nearly exact. The first use of each language downloads its model (~1.5–3 MB) into your browser from this site; models are cached afterward. Your file is never uploaded, and everything runs locally.</p>",
    "features": [
      "Recognize text from scanned and image-based PDF pages into .txt",
      "12 languages: English, Spanish, French, German, Italian, Portuguese, Russian, Hindi, Arabic, Chinese, Japanese, Korean",
      "Per-page progress, copy or download the result",
      "Up to 100 MB and 200 pages",
      "Model downloads from this site (cached after first use) — your file never leaves your browser"
    ],
    "howTo": [
      {
        "step": "Open PDF",
        "description": "Choose a scanned or image-based PDF — one where you currently cannot select any text."
      },
      {
        "step": "Pick the language",
        "description": "Choose the document's main language. The model downloads on first use (~1.5–3 MB) and is cached afterward."
      },
      {
        "step": "OCR",
        "description": "Each page is rendered and recognized. Progress shows per page."
      },
      {
        "step": "Copy or download",
        "description": "Skim the recognized text, then copy it or download the .txt file."
      }
    ],
    "faq": [
      {
        "question": "How accurate is the OCR?",
        "answer": "Good scans of printed documents with standard fonts usually recognize almost everything. Blurred, low-resolution or handwritten pages will have errors — always skim the result."
      },
      {
        "question": "What languages are supported?",
        "answer": "English, Spanish, French, German, Italian, Portuguese, Russian, Hindi, Arabic, Chinese (simplified), Japanese and Korean."
      },
      {
        "question": "Does OCR change my PDF?",
        "answer": "Your original file is never modified. The recognized text is offered as a separate .txt download or copy — no text layer is written back into the PDF."
      },
      {
        "question": "My PDF already has selectable text — is this the right tool?",
        "answer": "No. If you can already select the words, use PDF to Text instead: it is much faster and essentially exact. OCR is for pages with no text layer (scans and photos)."
      },
      {
        "question": "Is my document uploaded anywhere?",
        "answer": "No. OCR runs entirely in your browser. On first use of a language it downloads that language's recognition model (~1.5–3 MB) from this site so it can run locally; your file never leaves your device."
      }
    ],
    "relatedSlugs": [
      "pdf-to-text",
      "pdf-to-excel",
      "pdf-to-markdown",
      "pdf-to-word",
      "image-to-pdf"
    ]
  },
  "pdf-compare": {
    "longDescription": "<p>PDF Compare lets you check what changed between versions of a PDF by comparing their embedded text layers page by page. Add two to five PDFs, mark which one is the original, and the tool lines each other file up page by page against it, highlighting lines that were added (green) and removed (red) with a side-by-side view.</p><p>This is a text-layer comparison, not a visual or pixel diff. It reads the actual words stored in each PDF and compares them, so it is ideal for verifying that a contract, report or spec changed only in the intended places. Layout shifts, font or color changes, and swapped images are not reported because they are not text. Scanned, image-only pages contain no selectable text, so they are shown as empty and unchanged. Pages are matched on the shortest shared page count — pages that exist in only one file are not compared.</p><p>Comparison runs entirely in your browser. Files up to 100 MB and 200 pages each are supported, and the honest limit holds: matching is line-based, extra spaces are already collapsed when lines are read, and reordering a paragraph counts as removing and re-adding its lines. A downloadable .txt report summarises every change against each revision.</p>",
    "features": [
      "Compare 2–5 PDFs at once, page by page, against the file you mark as original",
      "Added and removed lines highlighted in a side-by-side view",
      "Optional ignore-case and ignore-whitespace matching, plus a show-changes-only filter",
      "Download a .txt diff report named after the original file",
      "Encrypted or damaged PDFs are rejected up front with clear guidance — unlock with the Unlock PDF tool first",
      "Nothing is uploaded — files up to 100 MB and 200 pages each"
    ],
    "howTo": [
      {
        "step": "Add the original PDF",
        "description": "Use Add PDF and choose the base version of your document. Files up to 100 MB and 200 pages each are accepted."
      },
      {
        "step": "Add the revised PDFs",
        "description": "Add the other versions you want to check, up to five PDFs in total. An encrypted or damaged file is rejected the moment you add it."
      },
      {
        "step": "Mark the original",
        "description": "Select Original on whichever PDF is the base. Every other file is compared against it, page by page."
      },
      {
        "step": "Compare and review",
        "description": "Click Compare PDFs. Page through each result to see removed and added lines, or download a .txt report of every change."
      }
    ],
    "faq": [
      {
        "question": "Does it compare layouts, images or fonts?",
        "answer": "No. PDF Compare reads and compares the embedded text layer of each page only. A reformatted text block, a changed font, or a replaced image is not reported unless its words changed too."
      },
      {
        "question": "What if the PDFs have different page counts?",
        "answer": "Only the shortest shared page count is compared. The tool tells you how many pages each file has and shows a note when they differ; pages that exist in only one file are not compared by design."
      },
      {
        "question": "My PDF is a scan — will it compare?",
        "answer": "Scanned or photographed pages have no text layer, so there is nothing to read or compare; they appear empty and unchanged. If you need the words, run PDF OCR first to recognize text, then compare the recognized file."
      },
      {
        "question": "How accurate is the diff?",
        "answer": "It is exact for the text that was extracted: a line is added, removed, or unchanged based on the words the PDF stores. Reordered lines count as removed plus added, extra spaces are collapsed, and matching is per page with optional ignore-case and ignore-whitespace toggles."
      }
    ],
    "relatedSlugs": [
      "pdf-to-text",
      "pdf-metadata",
      "pdf-redact",
      "pdf-merge",
      "diff-checker"
    ]
  },
  "pdf-redact": {
    "longDescription": "<p>Redact PDF covers private content by physically stamping a solid black rectangle into each page — the box is part of the page, not an overlay a reader can click away. Covered text can no longer be seen, selected, searched, or copy-pasted, which makes a real difference versus drawing a shape on top of the document.</p><p>Be honest about the limits: redaction blackens the area but does not delete the underlying text from the file, and anything outside the boxes you draw is left untouched. Metadata, form field values, annotations, and text elsewhere on a page all survive. So redaction is permanent for practical purposes — not a forensic guarantee — and you should re-open the downloaded file in a desktop reader and confirm every box covers its target before sharing. Password-protected PDFs should be unlocked with PDF Unlock first. Everything runs in your browser: nothing is uploaded, files up to 100 MB are supported, and region editing works on up to 200 pages.</p>",
    "features": [
      "Draw one or more black regions on any page, or add them by exact page, x, y, width and height in points",
      "Redaction is physically stamped into the page — covered text can't be selected, searched, or copy-pasted",
      "Per-page region list with remove and clear-page actions, and a live region count",
      "States the honest limits: text stays in the file under the box, and content outside boxes is not removed",
      "PDFs up to 100 MB, with region editing on up to 200 pages per file",
      "100% client-side — the file never leaves your device"
    ],
    "howTo": [
      {
        "step": "Open PDF",
        "description": "Choose the PDF containing the information you need to hide. Files up to 100 MB are supported; password-protected files should be unlocked with the Unlock PDF tool first."
      },
      {
        "step": "Mark redaction regions",
        "description": "On each page, drag a rectangle over the sensitive content, or add a region by exact numbers — page, X, Y, width and height in points from the page's top-left corner."
      },
      {
        "step": "Redact and download",
        "description": "Click Redact to physically stamp the black rectangles into the page, then download the <source>-redacted.pdf file with the number of boxes applied."
      },
      {
        "step": "Re-check before sharing",
        "description": "Open the downloaded file in a desktop reader and confirm every box covers its target. Content outside the boxes — metadata, form values, hidden text — is not removed, and this tool does not delete the covered text from the file."
      }
    ],
    "faq": [
      {
        "question": "Does this tool delete the covered text from the file?",
        "answer": "No. Redaction stamps a solid black rectangle into the page, so the covered area can no longer be seen, selected, searched, or copy-pasted in a normal reader — but the underlying text stays in the file. Blanks drawn with presentation tools are removable; these boxes are part of the page. If you need certified removal of glyph data, use dedicated desktop redaction software."
      },
      {
        "question": "Is the redaction permanent?",
        "answer": "For practical purposes in everyday viewers, yes — once downloaded, normal tools can't lift the box. It is not a forensic guarantee: specialized software could in principle recover the underlying bytes. Treat it as strong visual redaction, not cryptographic erasure."
      },
      {
        "question": "Can I redact without a mouse?",
        "answer": "Yes. Add any region with the number fields — page, X, Y, width and height in points, measured from the top-left corner of the page. The file picker, region list, and export are also fully keyboard-operable."
      },
      {
        "question": "What is not removed by redaction?",
        "answer": "Anything your rectangles don't cover: document metadata, annotations, form field values, and text elsewhere on a page. The tool only blackens the regions you define. Re-open the output in a desktop reader and check each box before sharing."
      },
      {
        "question": "My PDF is password-protected — will this work?",
        "answer": "No. Redact PDF can't open encrypted files. If you know the password, remove it with the Unlock PDF tool first, then redact the unlocked copy."
      }
    ],
    "relatedSlugs": [
      "pdf-auto-redact",
      "pdf-protect",
      "pdf-unlock",
      "pdf-metadata",
      "pdf-to-text"
    ]
  },
  "pdf-auto-redact": {
    "longDescription": "<p>Auto-Redact PDF finds every occurrence of a name, account number, email address or phrase in a PDF and covers each one with a solid black box, so you don't have to hunt through pages by eye. Type one word, phrase or regex, skip the page previews with red highlights, confirm what will be covered, and download a new PDF with black boxes drawn over every match.</p><p>Matching reads the PDF's text layer. It is case-insensitive by default (turn on Case-sensitive if you need exact case), and you can require whole words or switch to regex. A match anywhere in a text chunk is covered with one box over the whole chunk, padded around the glyphs. Everything runs in your browser: the PDF and the terms you search for never leave your device.</p><p>Be clear about what this does and doesn't do. The boxes hide matched text from view and from normal select, copy and search — but the covered words still exist below the boxes in the file, and any metadata is untouched. This is not a forensically sanitized erasure, only matching finds text layer content, so scanned pages, text drawn as outlines, or phrases split across text runs can be missed. Verify the output before you share it.</p>",
    "features": [
      "Type a word, phrase, or regex and cover every match with a black box",
      "Case-insensitive by default, with optional case-sensitive and whole-word matching",
      "Per-page match counts and a preview showing exactly what will be covered",
      "A confirm step — nothing is drawn until you approve the match list",
      "Runs entirely in your browser with no uploads",
      "Handles PDFs up to 100 MB and 200 pages"
    ],
    "howTo": [
      {
        "step": "Open a PDF",
        "description": "Choose a PDF up to 100 MB and 200 pages. Encrypted files are rejected — unlock them with PDF Unlock first."
      },
      {
        "step": "Enter a term",
        "description": "Type a word, phrase, or regular expression. Matching is case-insensitive unless you turn Case-sensitive on."
      },
      {
        "step": "Review every match",
        "description": "Page previews highlight each match in red, with a count per page. Confirm before anything is drawn."
      },
      {
        "step": "Download the redacted copy",
        "description": "A new PDF is saved as <source>-redacted.pdf with solid black boxes over every confirmed match. Your original file is never modified."
      }
    ],
    "faq": [
      {
        "question": "Does Auto-Redact delete the matched text from the file?",
        "answer": "No. It draws solid black boxes over each match, so the text can't be seen, selected, copied or searched in a PDF viewer — but the covered words still exist below the boxes in the file, and document metadata such as author or dates is untouched. For text that must be truly destroyed, keep using a redaction workflow that erases the underlying content, and verify the result."
      },
      {
        "question": "What will the search miss?",
        "answer": "Matching reads the PDF's text layer only. Scanned pages without an OCR text layer won't be searched (see PDF OCR first), text that a font draws as outlines or images can't be matched, and some PDF exports split a phrase across multiple text runs and could miss it. That's why the red preview and per-page counts exist — check them before confirming."
      },
      {
        "question": "Is matching case-insensitive?",
        "answer": "Yes, by default. A search for 'john smith' also finds 'John Smith' and 'JOHN SMITH'. Turn on Case-sensitive for exact-case matching, or Whole word only to ignore partial hits such as '48' inside '48102'."
      },
      {
        "question": "One box per match or one per word?",
        "answer": "When a term matches anywhere inside a text chunk, the whole chunk is covered by one padded box. The box is deliberately larger than the match, which is safer but means a little extra text may be covered too."
      },
      {
        "question": "Does it work on scanned documents?",
        "answer": "Only pages with a text layer can be searched. A scanned PDF stores words as images, so there is nothing to match — run PDF OCR on it first, then auto-redact the recognized copy."
      }
    ],
    "relatedSlugs": [
      "pdf-redact",
      "pdf-unlock",
      "pdf-metadata",
      "pdf-protect",
      "pdf-ocr"
    ]
  },
  "pdf-remove-blank-pages": {
    "longDescription": "<p>Remove Blank Pages finds near-empty pages in a PDF and flags them so you can delete them in one pass. Blank pages commonly appear after scanning double-sided originals, exporting messy documents, or merging and splitting files — this tool analyzes every page's ink coverage in your browser, badges pages with negligible content, and preselects them for removal.</p><p>You stay in control: detection is a heuristic, so pages are only flagged — never removed without your click — and you can toggle any page on or off before deleting. The output is a rebuilt PDF with the selected pages gone; remaining content is kept as-is, though document-level bookmarks and metadata may not survive the rebuild. Password-protected files should be unlocked with PDF Unlock first. Handles PDFs up to 100 MB and 200 pages.</p>",
    "features": [
      "Detect near-empty pages by ink coverage and badge them blank",
      "Blank pages are preselected — you review and toggle any page before deleting",
      "Manual deletions work too: mark any page, blank or not",
      "Runs entirely in your browser with no uploads",
      "Works with PDFs up to 100 MB and 200 pages per run",
      "Free, with no account or sign-up"
    ],
    "howTo": [
      {
        "step": "Open PDF",
        "description": "Open the PDF to clean up. Every page renders as a thumbnail."
      },
      {
        "step": "Review detection",
        "description": "Pages with negligible ink get a blank badge and are preselected. Detection is a heuristic — skim the badges before deleting anything."
      },
      {
        "step": "Adjust the selection",
        "description": "Tap any page to toggle it, or choose Select all blank pages to reselect the detected ones."
      },
      {
        "step": "Delete and download",
        "description": "Delete downloads a rebuilt PDF with the selected pages removed. At least one page must remain."
      }
    ],
    "faq": [
      {
        "question": "How does the tool decide a page is blank?",
        "answer": "Each page is rendered in your browser and its ink coverage is measured. Pages with fewer than a fraction of a percent of dark pixels — and no extractable text — are flagged blank. The check is a heuristic, not OCR."
      },
      {
        "question": "Will pages with small content be deleted?",
        "answer": "Only pages with negligible ink are flagged, and nothing is removed until you click Delete. Faint content like page numbers can influence the heuristic, so review the badges and toggle any page on or off before deleting."
      },
      {
        "question": "Are the remaining pages preserved exactly?",
        "answer": "The kept pages keep their content, layout and links. Because the output is a rebuilt file, document-level bookmarks and metadata such as author info may not survive."
      },
      {
        "question": "Can I undo a mistaken selection?",
        "answer": "Tap a selected page again to keep it. The original file is never modified, and each run downloads a new file — keep the original if you might need it back."
      },
      {
        "question": "Does this work with protected PDFs?",
        "answer": "Password-protected PDFs need to be unlocked with PDF Unlock first before blank pages can be detected and removed."
      }
    ],
    "relatedSlugs": [
      "pdf-remove-pages",
      "pdf-merge",
      "pdf-split",
      "pdf-editor",
      "pdf-compressor",
      "pdf-unlock"
    ]
  },
  "pdf-overlay": {
    "longDescription": "<p>PDF Overlay stamps one PDF on top of another. Open the base document that receives the stamp, open the stamp document — a logo, letterhead, confidentiality label, footer or an approved stamp page — and choose where it lands: stretched across the whole page, or fitted and anchored to the centre, top or bottom, left or right. Every preset except stretch scales the stamp to fit the page with its aspect ratio kept, so a small stamp grows to fill the sheet; the X and Y offsets then nudge it in PDF points, positive right and up, and opacity runs from a faint 5% watermark to solid 100%.</p><p>You choose which pages get stamped — the whole document or a range like 1-3,7 — and whether the stamp's pages cycle (base page 1 takes stamp page 1, page 2 takes stamp page 2, and so on, wrapping around) or whether its first page is repeated everywhere. A live preview shows the first page you are about to stamp, with the stamp drawn at the exact size, position and transparency it will get in the download, and a live readout gives the geometry in PDF points. If an offset would push the stamp completely off the page, the run is refused and names the page; if it only hangs over an edge, the preview says so before you export. A page that carries its own page rotation is stamped in that page's own coordinates, so the stamp turns with the page exactly as the page's text does.</p><p>Be clear about what the output is. The stamp page is embedded into each target page and drawn above the base content, so an ordinary reader cannot lift it off — but it is a real stamp, not a flattened picture. It is not a merge: nothing is renumbered or joined into one reading flow, and the base keeps its page count, text, links, annotations and form fields. If the stamp itself is built from real PDF text, that text is embedded as page content and stays visible, extractable and searchable in most readers. It is also not a way to hide content — the page underneath is completely unchanged, so this is the wrong tool for redaction; use PDF Redact for that. Because the result is a re-saved file, a digital signature on the base document does not survive the export. Both files are processed in your browser and neither is uploaded. Each file can be up to 100 MB and 200 pages, and password-protected files must be unlocked with PDF Unlock first.</p>",
    "features": [
      "Two-file workflow: open the base PDF, then open the stamp PDF that goes on top",
      "Eight position presets — stretch, centre, and the six top/bottom left/centre/right corners",
      "X and Y offsets in PDF points, plus opacity from 5% to 100%",
      "Stamp every page or just a range such as 1-3,7, with the selection validated as you type",
      "Cycle the stamp's pages or repeat its first page on every target page",
      "Stamped in each page's own coordinates, so a page with a 90 or 270 degree rotation turns its stamp too",
      "Re-saving the file means a digital signature on the base document does not survive the export",
      "Live preview of the first stamped page with a readout of the real geometry in PDF points",
      "Up to 100 MB and 200 pages per file, 100% client-side — neither file is ever uploaded"
    ],
    "howTo": [
      {
        "step": "Open base PDF",
        "description": "Choose the PDF that receives the stamp. Page 1 renders as a live preview once a stamp is open too. Files up to 100 MB and 200 pages are supported; password-protected files should be unlocked with PDF Unlock first."
      },
      {
        "step": "Open stamp PDF",
        "description": "Choose the PDF placed on top — a logo, letterhead, confidentiality label, footer or an approved stamp page. Its page size sets the stamp's proportions."
      },
      {
        "step": "Place the stamp",
        "description": "Pick a position preset, then nudge it with the X and Y offsets and set opacity. Presets other than stretch scale the stamp to fit the page with its aspect ratio kept. The preview and the geometry readout update as you go, and a stamp that would fall completely off the page is refused before anything is drawn."
      },
      {
        "step": "Choose the pages",
        "description": "Stamp every page, or switch to a page range such as 1-3,7 and see exactly which pages were selected. Choose whether the stamp's pages cycle across the base or whether its first page repeats everywhere."
      },
      {
        "step": "Overlay and download",
        "description": "Click Overlay. The <base>-overlaid.pdf downloads with the stamp composited into each chosen page — base page count, text, links, annotations and form fields intact."
      }
    ],
    "faq": [
      {
        "question": "Can I use the stamp as a watermark?",
        "answer": "Yes. Drop the opacity to around 5-15% and pick centre or a corner. Remember the presets fit the stamp to the page, so a small logo is scaled up first — that is what makes it read as a page-wide watermark."
      },
      {
        "question": "The stamp has fewer pages than the base. What happens?",
        "answer": "In cycle mode the stamp's pages wrap around: base page 1 takes stamp page 1, base page 2 takes stamp page 2, and once the stamp runs out it starts again from page 1. Choose the first-page-only option to repeat one stamp on every target page instead."
      },
      {
        "question": "Does the stamp hide anything underneath?",
        "answer": "No. It is not a way to hide content: the base page underneath is unchanged and every base text layer, link, annotation and form field survives. It is also not a merge — the two documents are not joined into one reading flow and the base keeps its page count. If you need to conceal text, use PDF Redact or PDF Flatten instead."
      },
      {
        "question": "Can someone remove the stamp or read its text?",
        "answer": "An ordinary reader cannot simply lift the stamp off, because it is drawn into the page above the base content. But this is a real stamp, not a picture of one: if the stamp PDF contains real text, that text is embedded as page content and stays visible, extractable and searchable in most readers. Anything determined to remove embedded objects would also be able to alter your document, so treat this as a working mark, not a forensic seal."
      },
      {
        "question": "Why did my stamp get bigger than I expected?",
        "answer": "There is no size slider, and that is deliberate: every preset except Stretch to page always fits the stamp to the page — the shorter side sits flush and the aspect ratio is kept — so a small logo is enlarged to fill the sheet. If you need a specific stamp size, pre-size it in the stamp PDF itself, so the page you choose already has the proportions you want; Stretch to page is the other option, and it fills the page edge to edge while ignoring the stamp's proportions."
      },
      {
        "question": "What happens if the stamp hangs off the page edge?",
        "answer": "Partly off the page is allowed: the preview warns that the stamp will be cropped and the run still exports. Pushed completely off, the run is refused before anything is drawn and the message names the page, so you never get a silently blank result."
      },
      {
        "question": "Can I stamp only some pages?",
        "answer": "Yes. Switch from All pages to a page range and type numbers and ranges such as 1-3,7. The tool validates as you type, shows you exactly which pages were selected, and refuses a page that is past the end of the document."
      },
      {
        "question": "Does this work with protected PDFs?",
        "answer": "Password-protected PDFs must be unlocked with PDF Unlock first — the tool will not try to guess or bypass a password, and will point you to the unlock tool instead."
      }
    ],
    "relatedSlugs": [
      "pdf-merge",
      "pdf-watermark",
      "pdf-editor",
      "pdf-protect",
      "pdf-redact"
    ]
  },
  "pdf-flatten": {
    "longDescription": "<p>Flatten PDF rasterizes a document: every page is rendered to a picture at the resolution you choose, and a new PDF is rebuilt with that single image on each page. The picture is all there is, so text can no longer be selected, searched, copied, edited or re-flowed — and for the same reason links, form fields, comments, annotations, layers and hidden text are gone. That is what makes a flattened copy a fixed record of what the page looked like at the moment you flattened it, which is what you want when the recipient must not be able to alter or extract the content.</p><p>Because each page becomes an image, the output is normally much larger than the source. Three raster settings control that trade-off: Screen renders at 96 DPI as JPEG for the smallest file, Balanced at 150 DPI JPEG for everyday viewing and email, and Print at 200 DPI as lossless PNG for the sharpest result. Screen and Balanced are lossy, so very small type can show compression artifacts when zoomed in; Print is lossless and the largest file. Page size is preserved and a rotated page comes out in the orientation you see, with the rotation baked into the picture — but the rebuilt file carries none of the source's bookmarks, link targets, form structure or document metadata, and no OCR text layer is added back. Very large pages are rendered below the chosen DPI instead of failing, and the tool tells you when that happens. Files up to 100 MB and 200 pages are supported and everything runs in your browser: your PDF never leaves your device.</p>",
    "features": [
      "Every page is rendered to one image, so text stops being selectable, searchable and copyable",
      "Three disclosed raster settings: 96 DPI JPEG, 150 DPI JPEG, or 200 DPI lossless PNG",
      "Output size and the change against the original are reported after every run",
      "Original page size preserved, and a rotated page is flattened in the orientation you see",
      "Links, form fields, comments, annotations, layers and source document metadata do not carry over",
      "Up to 100 MB and 200 pages per file, 100% client-side — the file is never uploaded"
    ],
    "howTo": [
      {
        "step": "Open PDF",
        "description": "Choose the PDF you want flattened into static image pages. Files up to 100 MB and 200 pages are supported; password-protected files should be unlocked with the PDF Unlock tool first."
      },
      {
        "step": "Choose Raster Quality",
        "description": "Pick Screen (96 DPI JPEG, smallest file), Balanced (150 DPI JPEG, the default) or Print (200 DPI lossless PNG, sharpest and largest). Lower DPI makes small print look softer; JPEG is lossy."
      },
      {
        "step": "Flatten Pages",
        "description": "Click Flatten. Each page is rasterized in your browser and a new PDF is built with one image per page. Very large pages are rendered below the chosen DPI and reported afterwards rather than failing."
      },
      {
        "step": "Download the Flattened Copy",
        "description": "The <source>-flattened.pdf downloads automatically, with the output size and the change against the original shown next to it. Open it and confirm nothing on the page still needs to be read or copied as text before you share it."
      }
    ],
    "faq": [
      {
        "question": "What does flattening actually do to my text?",
        "answer": "Each page is rasterized to an image, so its text is no longer text in the file. It can no longer be selected, searched, copied, edited or re-flowed, and the page no longer carries selectable content at all. This is the intended effect — it is the reason to flatten a document. No OCR text layer is added back afterwards."
      },
      {
        "question": "Why is the flattened file bigger than the original?",
        "answer": "Vector text and shapes are compact; a rendered picture is not. A page that was a few kilobytes of text can become hundreds of kilobytes of JPEG, so a flattened copy of a long document is commonly several times larger. Choose Screen for the smallest file, and only flatten when losing the text layer is worth the size."
      },
      {
        "question": "Which raster quality should I choose?",
        "answer": "Balanced (150 DPI JPEG) suits on-screen reading and email. Screen (96 DPI JPEG) is the smallest but softens small print. Print (200 DPI lossless PNG) is the sharpest and the largest. Screen and Balanced are lossy JPEG, so very small type can show compression artifacts when zoomed in."
      },
      {
        "question": "What else is lost besides text?",
        "answer": "Links, form fields, filled-in values, comments, highlights, stamps, annotations, layers and hidden text all become part of the picture. The rebuilt file also carries none of the source document's bookmarks or metadata such as author and title. If you need any of that, keep the original."
      },
      {
        "question": "Are rotated and mixed-size pages handled correctly?",
        "answer": "Yes. Each page is flattened in the orientation it is displayed, so a rotated page comes out upright as a reader would show it, and every page keeps its own dimensions. An unusually large page is rendered below the chosen DPI to stay inside the browser's canvas limit, and the result says how many pages were affected."
      },
      {
        "question": "My PDF is password-protected — will this work?",
        "answer": "No. Flatten PDF cannot open an encrypted file. If you know the password, remove it with the PDF Unlock tool first, then flatten the unlocked copy. Your original is never modified: every run produces a new download named <source>-flattened.pdf."
      }
    ],
    "relatedSlugs": [
      "pdf-to-image",
      "pdf-ocr",
      "pdf-remove-annotations",
      "pdf-compressor",
      "pdf-redact"
    ]
  },
  "pdf-remove-annotations": {
    "longDescription": "<p>Remove Annotations cleans the markup layer off a PDF while keeping the document content exactly as it is. PDFs accumulate comments, highlights, underlines, stamps, sticky notes and hyperlinks during review cycles — clutter that is not appropriate for the final version shared with a client, printed, or archived. In a PDF, all of that lives in a separate annotation layer, and so do the form fields. This tool removes that layer in one pass, producing a clean copy whose page text, images and layout are untouched.</p><p>The tool reports the total it found plus a per-page breakdown before you confirm, so you know exactly what is about to be stripped, and it flags the cases that surprise people: a hyperlink is an annotation, so it goes too, and a filled form field usually keeps its value inside the field rather than on the page. If you only want the review markup gone and the fields still fillable, tick the keep-form-fields box and only the comments, highlights, stamps and links are removed. It is not a redaction tool — page content is left alone, so anything you need to hide is PDF Redact's job — and a digitally signed file comes out no longer signed. Everything runs in your browser, so a marked-up document and the notes inside it never leave your device.</p>",
    "features": [
      "Remove comments, highlights, stamps, sticky notes, popups, and links",
      "Form fields are annotations too, so they go unless you keep them",
      "Per-page annotation counts shown before removal",
      "Removed annotation objects are pruned from the file, not just unlinked",
      "Page text, images and layout remain completely untouched",
      "Bookmarks, file attachments and source metadata are left alone",
      "100 MB and 200 page limits, disclosed before anything runs",
      "100% client-side processing with no uploads"
    ],
    "howTo": [
      {
        "step": "Open PDF",
        "description": "Choose the marked-up PDF you want to clean up, up to 100 MB and 200 pages."
      },
      {
        "step": "Review the counts",
        "description": "The tool shows the total it found, a per-page breakdown, and how many of each kind: markup, links, stamps and form fields."
      },
      {
        "step": "Keep the form fields if you need them",
        "description": "Tick the keep-form-fields box to remove only the review markup and leave the fields fillable. Left unticked, the fields are removed as well."
      },
      {
        "step": "Confirm the removal",
        "description": "Press the remove button. The button states how many annotations it is about to strip, and the download only happens after you do."
      },
      {
        "step": "Download the clean PDF",
        "description": "You get <source-name>-no-annotations.pdf with the page content preserved, and a result panel you can download from again. There is no undo, so keep the original if the comments matter."
      }
    ],
    "faq": [
      {
        "question": "Does removing annotations delete any page content?",
        "answer": "No. Only the annotation layer is removed. Page content streams are not modified, so all text, images, and layout are preserved exactly as they were, and metadata, bookmarks and attachments are left alone."
      },
      {
        "question": "Are links removed too?",
        "answer": "Yes. Links are implemented as annotations in PDF, so hyperlinks are removed along with comments and highlights. There is no way to keep the link text itself, because that text is ordinary page content."
      },
      {
        "question": "What happens to form fields and their values?",
        "answer": "Interactive fields are widget annotations, so the default removes them and the AcroForm entry goes with them. A filled-in value normally lives inside the field, not on the page, so it disappears with the field. If the value was already flattened into the page content, it stays visible. Tick the keep-form-fields box to remove only the markup and keep the fields fillable."
      },
      {
        "question": "What happens to a dynamic (XFA) form?",
        "answer": "An XFA or JavaScript-driven form stores its field data and its fill-in behaviour in the same AcroForm entry the fields live in. Removing the fields removes that entry too, so the document stops behaving like a fillable form. Flatten such a document first, or read the values out, before you strip it."
      },
      {
        "question": "Can I undo the removal?",
        "answer": "No undo is available after download. Keep the original file if you may need the annotations later."
      },
      {
        "question": "Does this help with redacting sensitive information?",
        "answer": "No. This tool empties the annotation layer and leaves page content alone, so it is the right tool for cleaning up a marked-up review copy and the wrong one for removing private data. Text already drawn on the page, or hidden inside one, is untouched. Use PDF Redact for that, and re-check the output in a reader before you share it."
      },
      {
        "question": "Is a digitally signed PDF still signed afterwards?",
        "answer": "No. A signature covers the exact bytes that were signed, and removing annotations changes those bytes, so a signed PDF comes out of this tool no longer signed — even when only a single comment was deleted."
      },
      {
        "question": "Are the annotations really gone, or just hidden?",
        "answer": "The annotation objects are dropped from the document structure rather than merely hidden, so no reader shows them, and the objects they owned — comment popups, reply threads and appearance streams — are pruned from the file as well. A small amount of unreferenced data can survive in the file bytes; no conforming reader will display it."
      },
      {
        "question": "What are the limits?",
        "answer": "Files up to 100 MB and 200 pages. Password-protected PDFs are not handled here, so remove the password with PDF Unlock first. Nothing is uploaded — the work happens in your browser."
      }
    ],
    "relatedSlugs": [
      "pdf-editor",
      "pdf-redact",
      "pdf-watermark",
      "pdf-flatten",
      "pdf-metadata"
    ]
  },
  "pdf-scale-pages": {
    "longDescription": "<p>Scale Pages resizes every page of a PDF by one percentage, from 10% to 400%. The page is a coordinate system rather than a picture, so the tool scales the parts together: the page boxes a page defines (media, crop, bleed, trim and art), the content stream, and the geometry of annotations such as link boxes, comment boxes, ink strokes and form-field rectangles. That is why a scaled page is still a real page — nothing is cut off, nothing is stretched, and every page in the file gets the same factor at once.</p><p>The content is scaled, never re-rendered as a picture, so text stays real text: it remains selectable, searchable and copyable, and images and vector art are resampled by the same factor rather than being re-encoded. The same factor is applied to width and height, so the aspect ratio is preserved — 50% of an A4 page is the same shape at half the size. That also means this is not a page-size converter: to turn a page into A4 or Letter, or to change width and height independently, use a page-size or crop tool instead. Files up to 100 MB and 200 pages are supported, a password-protected file cannot be opened here, and because pages are scaled in place the output is the same document with its pages resized — bookmarks, links, form fields and document metadata come along, while a digital signature does not survive the re-save. Everything runs in your browser; nothing is uploaded.</p>",
    "features": [
      "Scale every page together from 10% to 400%",
      "Media, crop, bleed, trim and art boxes scale with the content, so nothing is cropped or stretched",
      "Content is scaled, not rasterized — text stays selectable, searchable and copyable",
      "Link boxes, comment boxes, ink strokes and form-field rectangles follow the page",
      "Live before/after page-size preview in points and inches, with a real paper-size name when the size matches one",
      "100% client-side processing with no uploads"
    ],
    "howTo": [
      {
        "step": "Open PDF",
        "description": "Open the PDF you want to resize. Its page count, file size and the first page's current size are shown."
      },
      {
        "step": "Set Scale",
        "description": "Type a percentage from 10% to 400% or drag the slider — the resulting page size updates live."
      },
      {
        "step": "Scale Document",
        "description": "Click scale and every page is resized by that one factor, with its page boxes and annotations moved to match."
      },
      {
        "step": "Download Scaled PDF",
        "description": "The scaled copy downloads as <source>-scaled-<percent>pct.pdf, and the result panel reports the new page size and output size."
      }
    ],
    "faq": [
      {
        "question": "Is the page scaled or cropped?",
        "answer": "Scaled. Every page is resized along with its content and its page boxes, so nothing is cut off and the proportions are preserved. This tool does not crop and does not change the paper size."
      },
      {
        "question": "Will my text still be selectable after scaling?",
        "answer": "Yes. The page content is scaled rather than re-rendered as an image, so text stays selectable, searchable and copyable — the opposite of flattening a PDF. Fonts, images and vector art are resampled by the same factor, and existing form fields keep their values."
      },
      {
        "question": "Can I scale width and height differently, or convert a page to A4?",
        "answer": "No. One uniform factor is applied to both axes, which is what keeps the aspect ratio intact and stops anything from distorting. If you need a different paper size or a non-uniform change, use a page-size or crop tool instead."
      },
      {
        "question": "What happens to bookmarks, links, signatures and form fields?",
        "answer": "Pages are scaled in place, so the document keeps its bookmarks, link targets, form fields and metadata. Two honest caveats: a digital signature covers the original bytes and does not survive a re-save, and an existing form field's appearance is scaled with its box rather than re-rendered for the new size."
      }
    ],
    "relatedSlugs": [
      "pdf-crop",
      "pdf-rotate",
      "pdf-flatten",
      "pdf-compressor",
      "pdf-page-numbers"
    ]
  },
  "pdf-merge": {
    "longDescription": "<p>PDF Merge is a fast, intuitive tool that combines multiple PDF documents into a single, unified file. Whether you're consolidating separate chapters of a report, combining invoices and receipts, merging signed and unsigned document versions, or assembling a complete document from multiple sources, this tool makes the process effortless. Simply upload your PDFs, arrange them in your desired order, and download the merged result—all from your browser with zero uploads to external servers.</p><p>The tool preserves the quality, formatting, and structure of every input document in the final merged PDF. It handles PDFs of any size and number, supports drag-and-drop reordering, and maintains bookmarks and internal links where possible. From students combining assignment sections to professionals assembling complete document packages, PDF Merge is the quickest way to bring multiple PDFs together into one cohesive file.</p>",
    "features": [
      "Combine multiple PDFs into a single document",
      "Drag-and-drop reordering of files before merging",
      "Preserve quality, formatting, and page structure",
      "Support unlimited number of PDFs per merge",
      "100% client-side processing with no file uploads",
      "Free with no watermarks, sign-ups, or file limits"
    ],
    "howTo": [
      {
        "step": "Add PDF Files",
        "description": "Click to select multiple PDFs or drag and drop them into the merge tool."
      },
      {
        "step": "Arrange Order",
        "description": "Drag and drop files to reorder them in the sequence you want them merged."
      },
      {
        "step": "Merge Documents",
        "description": "Click the merge button and wait a moment while the tool combines your PDFs."
      },
      {
        "step": "Download Merged PDF",
        "description": "Download the single merged PDF file containing all your documents in order."
      }
    ],
    "faq": [
      {
        "question": "Is there a limit to how many PDFs I can merge?",
        "answer": "There's no hard limit. You can merge as many PDFs as needed, though processing very large numbers of files may take slightly longer."
      },
      {
        "question": "Will the quality of my PDFs be affected?",
        "answer": "No. Merging is a lossless operation. Each page is included in the output exactly as it appears in the original document."
      },
      {
        "question": "Can I merge PDFs of different sizes?",
        "answer": "Yes. The tool handles PDFs with different page sizes. Each page retains its original dimensions in the merged output."
      },
      {
        "question": "Does it preserve bookmarks and links?",
        "answer": "The tool attempts to preserve internal bookmarks and hyperlinks, though very complex bookmark structures may need manual adjustment."
      }
    ],
    "relatedSlugs": [
      "pdf-split",
      "pdf-remove-pages",
      "pdf-remove-blank-pages",
      "pdf-page-numbers",
      "pdf-watermark",
      "pdf-crop"
    ]
  },
  "pdf-split": {
    "longDescription": "<p>PDF Split is a versatile tool that separates a PDF document into multiple smaller files. Whether you need to extract specific chapters, divide a large document into manageable sections, pull out individual pages, or create separate PDFs from different sections of a report, this tool gives you precise control over how your document is split. Extract by page range, split every N pages, or pull out individual pages—all processed securely in your browser.</p><p>The tool offers multiple splitting modes to fit your needs: extract a range of pages, split the document at specific points, separate every page into its own file, or pull out odd/even pages separately. Each output file maintains the full quality and formatting of the original. Perfect for document management, archiving, and sharing specific sections without distributing the entire file.</p>",
    "features": [
      "Split PDF by page ranges or specific pages",
      "Extract every page as an individual PDF file",
      "Split document at custom breakpoints",
      "Separate odd and even pages independently",
      "Preserve quality and formatting in all output files",
      "100% client-side splitting with no uploads"
    ],
    "howTo": [
      {
        "step": "Upload PDF",
        "description": "Drag and drop the PDF you want to split or click to select it from your device."
      },
      {
        "step": "Choose Split Mode",
        "description": "Select how to split: by page range, every N pages, individual pages, or at specific points."
      },
      {
        "step": "Specify Pages",
        "description": "Enter the page numbers or ranges you want to extract or the intervals at which to split."
      },
      {
        "step": "Download Split Files",
        "description": "Download the resulting PDF files individually or as a ZIP archive."
      }
    ],
    "faq": [
      {
        "question": "Can I split a PDF into individual pages?",
        "answer": "Yes. The split-every-page option creates a separate PDF file for each page of the original document."
      },
      {
        "question": "Will splitting reduce quality?",
        "answer": "No. Splitting is a lossless operation. Each extracted section maintains the exact quality and formatting of the original."
      },
      {
        "question": "Can I extract non-consecutive pages?",
        "answer": "Yes. You can specify individual pages like 1, 5, 12 to extract specific non-consecutive pages into a single output PDF."
      },
      {
        "question": "Does this work with large PDFs?",
        "answer": "Yes. The tool handles PDFs of any size, though very large files with hundreds of pages may take slightly longer to process."
      }
    ],
    "relatedSlugs": [
      "pdf-merge",
      "pdf-remove-pages",
      "pdf-remove-blank-pages",
      "pdf-to-image",
      "pdf-to-text",
      "pdf-crop"
    ]
  },
  "pdf-editor": {
    "longDescription": "<p>PDF Editor is a comprehensive, browser-based tool that lets you annotate, markup, and make basic edits to PDF documents without any software installation. Add text annotations, draw freehand, highlight important sections, add shapes and arrows, insert sticky notes, and fill in form fields—all with intuitive point-and-click controls. It's the all-in-one solution for reviewing, marking up, and collaborating on PDF documents.</p><p>Whether you're a teacher grading student work, a project manager reviewing proposals, a designer providing feedback on mockups, or anyone who needs to annotate PDFs without expensive software, PDF Editor delivers a complete set of markup tools in a clean, easy-to-use interface. The editor supports multiple annotation types, customizable colors and sizes, and undo functionality for easy corrections. All editing happens client-side, ensuring your documents remain completely private.</p>",
    "features": [
      "Add text annotations and comments to PDF pages",
      "Highlight, underline, and strikethrough text",
      "Draw freehand with customizable colors and thickness",
      "Add shapes: rectangles, circles, arrows, and lines",
      "Fill in interactive PDF form fields",
      "100% client-side editing with no file uploads"
    ],
    "howTo": [
      {
        "step": "Upload PDF",
        "description": "Drag and drop your PDF file or click to select it from your device."
      },
      {
        "step": "Select Annotation Tool",
        "description": "Choose from text, highlight, draw, shapes, or form-filling tools from the toolbar."
      },
      {
        "step": "Annotate Document",
        "description": "Click and drag on the PDF to add your annotations, markings, or form entries."
      },
      {
        "step": "Save and Download",
        "description": "Save your edits and download the annotated PDF with all markups preserved."
      }
    ],
    "faq": [
      {
        "question": "Can I edit existing text in the PDF?",
        "answer": "PDF Editor focuses on annotation and markup rather than text editing. For text-level changes, convert to Word using PDF to Word, edit, then convert back."
      },
      {
        "question": "Are annotations visible in other PDF readers?",
        "answer": "Yes. All annotations use standard PDF markup features and will be visible in Adobe Acrobat, Preview, and other major PDF readers."
      },
      {
        "question": "Can I remove annotations after adding them?",
        "answer": "Yes. You can select and delete individual annotations, or use undo to revert recent changes during your editing session."
      },
      {
        "question": "Does this support interactive PDF forms?",
        "answer": "Yes. The editor can fill in existing PDF form fields including text fields, checkboxes, and dropdown menus."
      }
    ],
    "relatedSlugs": [
      "pdf-redact",
      "pdf-watermark",
      "pdf-rotate",
      "pdf-crop",
      "pdf-page-numbers"
    ]
  },
  "pdf-creator": {
    "longDescription": "<p>PDF Creator is a flexible, browser-based tool that builds professional PDF documents from scratch. Using a rich text editor with formatting controls, you can create polished PDFs with custom text, styled headings, paragraphs, lists, and structured content—no word processor or design software needed. It's perfect for creating quick documents, forms, certificates, letters, and any PDF content you need to generate from zero.</p><p>The editor provides real-time preview of your PDF as you build it, with controls for page size, margins, fonts, text styling, and layout. Whether you're drafting a formal letter, creating a simple certificate, building a text-based report, or generating any document that needs to be in PDF format, PDF Creator delivers a streamlined creation experience. The final PDF is generated entirely in your browser, ensuring your content remains private until you're ready to share it.</p>",
    "features": [
      "Create PDFs from scratch with a rich text editor",
      "Customizable page sizes: A4, Letter, Legal, custom",
      "Text formatting: bold, italic, headings, lists, alignment",
      "Adjustable margins, fonts, and spacing",
      "Real-time PDF preview as you create",
      "100% client-side creation with no uploads"
    ],
    "howTo": [
      {
        "step": "Set Page Options",
        "description": "Choose page size, orientation, margins, and font for your new PDF document."
      },
      {
        "step": "Write and Format Content",
        "description": "Use the text editor to add content with headings, paragraphs, lists, and text formatting."
      },
      {
        "step": "Preview PDF",
        "description": "View the live preview of your PDF to check layout and formatting before finalizing."
      },
      {
        "step": "Generate and Download",
        "description": "Click create to generate the final PDF and download it to your device."
      }
    ],
    "faq": [
      {
        "question": "Can I add images to the PDF?",
        "answer": "PDF Creator focuses on text-based content creation. For PDFs with images, consider using Image to PDF or combining created content with existing documents using PDF Merge."
      },
      {
        "question": "What formatting options are available?",
        "answer": "You can use bold, italic, underline, headings (H1-H3), bullet lists, numbered lists, text alignment, and custom fonts."
      },
      {
        "question": "Can I create multi-page documents?",
        "answer": "Yes. The editor supports page breaks so you can create documents with multiple pages of content."
      },
      {
        "question": "Is this suitable for creating forms?",
        "answer": "For simple text-based forms, yes. For interactive forms with fillable fields, consider using our PDF Editor tool which supports form filling."
      }
    ],
    "relatedSlugs": [
      "text-to-pdf",
      "word-to-pdf",
      "image-to-pdf",
      "pdf-watermark",
      "pdf-protect"
    ]
  },
  "url-encoder": {
    "longDescription": "<p>The BrainCoder URL Encoder & Decoder percent-encodes and decodes URL strings live in your browser, for free, with zero server round-trips. Encoding replaces unsafe characters — spaces, punctuation, and anything non-ASCII — with their %hex equivalents so a value can travel safely inside a URL. Paste your string and the result updates as you type.</p><p>Two encoding modes cover the two real jobs. Component-level encoding uses JavaScript's native encodeURIComponent, escaping everything except the unreserved characters that browsers safely allow, so it is ideal for a single query value. Whole-URL encoding uses encodeURI, which lets the structure of a full link survive — reserved characters like :, /, ?, & and = stay intact while unsafe characters are escaped. Decoding reverses percent-encoded strings back to their original form.</p><p>Everything runs entirely in your browser under the same rules your own code would use, so there is nothing to install, no signup, and no data leaving your machine. The tool also works offline once the page has loaded.</p>",
    "features": [
      "Live percent-encoding and decoding as you type — nothing to click",
      "Component-level (encodeURIComponent) or whole-URL (encodeURI) encoding modes",
      "Decode reverses percent-encoded strings with the strict component decoder",
      "Handles full URLs, query strings, and individual characters",
      "Supports Unicode and non-ASCII characters",
      "100% client-side — no data leaves your browser; works offline once loaded"
    ],
    "howTo": [
      {
        "step": "Paste your URL or URL fragment",
        "description": "Enter the full URL, query string, or individual characters you want to encode or decode into the input area."
      },
      {
        "step": "Choose Encode or Decode mode",
        "description": "The output updates live as you type — there is no button to press. Switch direction with the Encode/Decode toggle. In Encode mode, keep Component-level checked to percent-encode a single value, or uncheck it to preserve a full URL's structure (reserved characters like :, /, ?, & and = stay intact)."
      },
      {
        "step": "Copy the result",
        "description": "The output panel shows the result and its character count as you type. Grab the text with your own copy shortcut, or use 'Use result as input' to feed it back for a decode/encode round trip."
      },
      {
        "step": "Verify in your application",
        "description": "Paste the result into your browser address bar, API request, or code editor to confirm it works as expected. Use 'Use result as input' to flip direction and check the round trip reproduces your original text."
      }
    ],
    "faq": [
      {
        "question": "What characters does URL encoding escape?",
        "answer": "In component-level mode (the default), every character except A–Z, a–z, 0–9 and - _ . ! ~ * ' ( ) is percent-encoded: a space becomes %20, & becomes %26, and non-ASCII characters like accented letters and emoji become UTF-8 %hex sequences. In whole-URL mode (Component-level unchecked), reserved characters such as :, /, ?, & and = are left intact and only unsafe characters are escaped."
      },
      {
        "question": "Can I encode an entire URL including the protocol?",
        "answer": "Yes, and the mode decides what happens. With Component-level checked, the whole string — protocol, slashes and query delimiters included — is percent-encoded (https:// becomes https%3A%2F%2F). To keep a full URL readable while still escaping unsafe characters, uncheck Component-level. Use component mode for a single query value and whole-URL mode for a complete link."
      },
      {
        "question": "Is this the same as URL slug encoding?",
        "answer": "No. URL slug encoding (like converting 'My Page' to 'my-page') is different from percent-encoding, which converts characters to their %hex representation. Use the slug generator for human-readable slugs."
      },
      {
        "question": "What happens if I try to decode invalid input?",
        "answer": "If the string is not valid percent-encoding — for example a % not followed by two hex digits — decoding cannot proceed and a red error notice is shown instead of guessing. The output stays empty until you fix the input."
      },
      {
        "question": "Does this work offline?",
        "answer": "Yes. Once the page is loaded, all encoding and decoding happens locally in your browser. No network requests are made during the conversion process."
      }
    ],
    "relatedSlugs": [
      "url-parser",
      "html-entities",
      "utf8-converter",
      "base64"
    ]
  },
  "base64": {
    "longDescription": "<p>The BrainCoder Base64 Encoder &amp; Decoder converts text to Base64 and back the moment you type — no buttons, no reloads. Encoding maps binary data onto a safe ASCII alphabet (A-Z, a-z, 0-9, +, /) so it can travel through JSON fields, HTTP headers, email attachments (MIME), and text-only database columns. Everything runs in your browser with zero server interaction — your data never leaves your machine.</p>\n<p>Standard Base64 pads short groups with = characters. The URL-safe variant (base64url) swaps + and / for - and _, which is the format used inside JWT payloads, query strings, and data URIs — this tool detects those characters automatically when decoding.</p>\n<p>Decoding restores the original bytes and interprets them as UTF-8 text, so plain text, JSON, and emoji round-trip exactly. If the source was a binary file such as an image or archive, the decoded bytes aren't valid UTF-8 and the tool reports that instead of printing garbage. Free, no account, works on any modern browser.</p>",
    "features": [
      "Standard Base64 encoding and decoding",
      "URL-safe base64url output (uses “-” and “_”, no padding)",
      "Real-time conversion as you type — no button to press",
      "Unicode and multi-byte text round-trips exactly",
      "One-click copy for encoded output",
      "Fully client-side — nothing is transmitted"
    ],
    "howTo": [
      {
        "step": "Enter or paste your text",
        "description": "Type or paste plain text, JSON, or a JWT into the input field. The Base64 output updates instantly as you type — there is no Encode button to press."
      },
      {
        "step": "Choose an output format",
        "description": "Standard Base64 is the default. Tick URL-safe output (uses “-” and “_”, no padding) when the string will live in a URL, query parameter, or JWT."
      },
      {
        "step": "Copy the Base64 string",
        "description": "Click the copy button to grab the output and paste it into an HTTP header, database field, or config file."
      },
      {
        "step": "Switch to Decode and paste",
        "description": "Toggle Decode from Base64, then paste a Base64 string. The original text appears immediately; URL-safe strings are detected automatically. If the bytes aren't valid UTF-8 text, an error explains why."
      }
    ],
    "faq": [
      {
        "question": "What is Base64 used for?",
        "answer": "Base64 is used to encode binary data as text for safe transmission over text-based protocols. Common uses include embedding images in HTML/CSS (data URIs), encoding JWT tokens, email attachments, and API authentication headers."
      },
      {
        "question": "Is Base64 encoding the same as encryption?",
        "answer": "No. Base64 is encoding, not encryption. Anyone can decode a Base64 string without a key. It's designed for data transport, not security. Use AES encryption if you need actual security."
      },
      {
        "question": "Does Base64 increase the size of my data?",
        "answer": "Yes, Base64 encoding increases data size by approximately 33% because every 3 bytes of input becomes 4 bytes of output. This is an inherent trade-off for making binary data text-safe."
      },
      {
        "question": "Why are there = signs at the end of Base64 strings?",
        "answer": "The = characters are padding. Base64 works in groups of 3 bytes producing 4 characters. If your input isn't a multiple of 3 bytes, padding characters (=) are added to make the output length a multiple of 4."
      },
      {
        "question": "What is the difference between standard and URL-safe Base64?",
        "answer": "Standard Base64 uses +, /, and = padding, which are reserved or awkward inside URLs and JWTs. URL-safe Base64 (base64url) replaces + with - and / with _ and drops the = padding. Use it for JWT payloads, query parameters, and anywhere the string ends up inside a URL — this tool outputs it when you tick URL-safe and auto-detects it when decoding."
      },
      {
        "question": "Why do I see an error decoding Base64 for an image or file?",
        "answer": "That Base64 decodes to raw binary bytes, and this tool renders text. When the bytes aren't valid UTF-8, the browser can't show them and the tool reports an error instead of printing replacement characters. For images and archives, use a dedicated binary tool — here, text, JSON, and tokens always decode exactly."
      },
      {
        "question": "Can I decode a JWT here?",
        "answer": "Yes, a JWT payload decodes just like any Base64 — and that's the point of caution: decoding reveals the payload as plain text (subject, expiry, claims), and this tool does not verify the signature, so treat decoded claims as untrusted. Base64 is encoding, not encryption, and never a security mechanism."
      }
    ],
    "relatedSlugs": [
      "binary-text",
      "image-base64",
      "utf8-converter",
      "url-encoder",
      "qr-code-generator"
    ]
  },
  "gzip-tool": {
    "longDescription": "<p>The BrainCoder Gzip Compress & Decompress tool lets you shrink text data using the gzip, deflate or deflate-raw algorithms directly in your browser. Gzip is one of the most widely used compression formats on the web — every HTTP server uses it to reduce payload sizes and speed up page loads. Now you can compress and decompress text, JSON, HTML, and other string data yourself without installing anything.</p>\n<p>Compression can dramatically reduce the size of repetitive or verbose text. A 10 KB JSON payload might compress to under 2 KB, saving bandwidth and storage. Our tool uses the browser's built-in Compression Streams API, which means the compression happens at near-native speed with no server round-trips. Decompress gzip, deflate or deflate-raw data you encounter in your work — output is auto-detected across all three formats and fancy JSON results are pretty-printed.</p>\n<p>This is particularly useful for developers debugging API responses, inspecting compressed assets, preparing payloads for bandwidth-constrained environments, or learning how compression works. Everything runs locally — your data is never uploaded anywhere.",
    "features": [
      "Gzip, deflate and deflate-raw compress and decompress in the browser",
      "Uses the native Compression Streams API for speed",
      "Works with text, JSON, HTML, CSS, and JavaScript",
      "Shows compression ratio and original vs compressed size",
      "Copy compressed output as Base64 or as a JSON payload with your own key",
      "No server calls — fully offline capable"
    ],
    "howTo": [
      {
        "step": "Paste or type text into the input area",
        "description": "Enter the text content you want to compress — this could be a JSON response, HTML snippet, or any other string data."
      },
      {
        "step": "Choose a format and click Compress",
        "description": "Pick gzip, deflate or deflate-raw, then compress to a Base64 string or to a JSON payload. The ratio shows how much space was saved."
      },
      {
        "step": "Copy or export the result",
        "description": "Copy the Base64 string, or download the compressed file. A JSON payload can also be downloaded as the raw compressed bytes if you need that exact file."
      },
      {
        "step": "To decompress, paste compressed data and click Decompress",
        "description": "Paste Base64-encoded data, a JSON payload, or raw bytes and click Decompress. gzip, deflate and deflate-raw are tried automatically."
      }
    ],
    "faq": [
      {
        "question": "What is gzip compression?",
        "answer": "Gzip is a lossless data compression algorithm that uses a combination of LZ77 and Huffman coding. It's the standard compression method used in HTTP to reduce the size of web responses, typically achieving 60-80% size reduction for text data."
      },
      {
        "question": "Is gzip compression lossless?",
        "answer": "Yes. Deflate and gzip are lossless — the decompressed output is identical to the original input, byte for byte. No data is lost during compression, making it safe for all types of data."
      },
      {
        "question": "Can I decompress data from a server response?",
        "answer": "Yes. If you have a gzip- or deflate-encoded response body (often indicated by a Content-Encoding header), you can paste it here to decompress and inspect the original content. All three formats are detected automatically."
      }
    ],
    "relatedSlugs": [
      "base64",
      "checksum-calculator",
      "url-encoder"
    ]
  },
  "hash-generator": {
    "longDescription": "<p>The BrainCoder Hash Generator computes cryptographic hashes of your text with SHA-1, SHA-256, SHA-384 and SHA-512, showing all four results instantly as you type. Hashing is a one-way process that turns any input into a fixed-length string, which makes it useful for verifying file integrity, comparing checksums, and generating deterministic identifiers.</p>\n<p>Everything runs in your browser using the Web Crypto API — the same cryptographic engine browsers use to secure HTTPS connections. Your input is hashed locally and never sent to a server, so you can safely run hashes over private text, API keys or proprietary data. Results are printed as lowercase hexadecimal, the format used by shasum, Git and most tooling.</p>\n<p>Each algorithm gets its own copy button, and a copy-all option grabs the full set at once. Hashing is intentionally debounced so the page stays responsive even with large pastes. In practice, SHA-256 is a safe default for integrity checks, SHA-1 still matches many legacy checksums, and SHA-384/SHA-512 produce longer digests when you want them.</p>",
    "features": [
      "SHA-1, SHA-256, SHA-384 and SHA-512 in one view",
      "Powered by the browser's native Web Crypto API",
      "Lowercase hexadecimal output — the format used by shasum",
      "Debounced live hashing as you type",
      "One-click copy per hash plus copy-all",
      "Zero data transmission — everything stays on your device"
    ],
    "howTo": [
      {
        "step": "Enter text to hash",
        "description": "Type or paste the string you want to hash into the textarea. This can be a password (for research only), a checksum to compare, or any arbitrary text."
      },
      {
        "step": "Review the hashes",
        "description": "SHA-1, SHA-256, SHA-384 and SHA-512 results appear automatically and update as you type, all in lowercase hexadecimal."
      },
      {
        "step": "Copy a hash",
        "description": "Click the copy button next to one algorithm, or use copy all to grab the complete set for comparing against another tool."
      }
    ],
    "faq": [
      {
        "question": "Which algorithms are supported?",
        "answer": "SHA-1, SHA-256, SHA-384 and SHA-512. MD5 is not included — it is not part of the Web Crypto API and is no longer recommended anywhere. For MD5 or CRC checksums, try the Checksum Calculator tool."
      },
      {
        "question": "Why does the same input always produce the same hash?",
        "answer": "Hashing is deterministic: the same input always hashes to the exact same output. This is what makes hashes useful for verifying that data hasn't changed."
      },
      {
        "question": "Which algorithm should I use for integrity checks?",
        "answer": "SHA-256 is the recommended default — good balance of speed and 256-bit output. Choose SHA-512 for a larger digest (a 128-character hex string), or SHA-1 when you need to match a legacy checksum."
      },
      {
        "question": "Is this suitable for password hashing?",
        "answer": "For research and testing, yes. For production password storage, use a dedicated function like bcrypt, scrypt or Argon2, which add salting and are designed to resist brute force."
      }
    ],
    "relatedSlugs": [
      "checksum-calculator",
      "aes-encryption",
      "password-generator"
    ]
  },
  "html-entities": {
    "longDescription": "<p>The BrainCoder HTML Entities Encoder & Decoder converts special characters to their HTML entity equivalents and back. When writing HTML, certain characters like angle brackets, ampersands, and quotes have special meaning. To display these characters literally on a webpage, they must be encoded as entities — for example, < becomes &lt; and & becomes &amp;. This tool automates that process.</p>\n<p>This is essential for anyone working with HTML, whether you're building a CMS, sanitizing user input, writing blog posts with code snippets, or debugging a web page that's rendering markup as plain text. The encoder handles both named entities (like &amp;nbsp;) and numeric entities (like &#x20;), and the decoder reverses both formats back to the original characters.</p>\n<p>Everything happens in your browser — no HTML is sent to any server. This makes it safe to use with sensitive content, private data, or proprietary markup. The tool is free, requires no account, and works on any device.",
    "features": [
      "Encode to named HTML entities (&lt; &gt; &amp; etc.)",
      "Encode to numeric HTML entities (&#60; &#x3C; etc.)",
      "Decode named and numeric entities back to characters",
      "Handles all standard HTML special characters",
      "Supports extended Unicode entities",
      "Instant conversion with copy-to-clipboard"
    ],
    "howTo": [
      {
        "step": "Enter your text",
        "description": "Paste or type the text containing characters you need to encode or decode. This could be raw HTML, user-submitted content, or a string with special characters."
      },
      {
        "step": "Choose Encode or Decode",
        "description": "Click 'Encode' to convert special characters to HTML entities, or 'Decode' to convert entities back to readable characters."
      },
      {
        "step": "Select entity format",
        "description": "Choose between named entities (recommended for readability) or numeric entities (recommended for maximum compatibility)."
      },
      {
        "step": "Copy the result",
        "description": "Click the copy button to grab the encoded or decoded output and use it in your HTML, template, or code."
      }
    ],
    "faq": [
      {
        "question": "What are HTML entities?",
        "answer": "HTML entities are special character codes that represent reserved HTML characters. For example, &amp; represents the ampersand (&), &lt; represents the less-than sign (<), and &gt; represents the greater-than sign (>)."
      },
      {
        "question": "Why do I need to encode HTML entities?",
        "answer": "If you display raw < or & characters in HTML content (like user comments or CMS output), the browser may interpret them as HTML markup, breaking your page layout or creating security vulnerabilities like XSS attacks."
      },
      {
        "question": "Which format should I use — named or numeric?",
        "answer": "Named entities like &amp; are more readable and commonly used. Numeric entities like &#38; are more universal and work for any Unicode character. Use named entities for common characters and numeric for rare or emoji characters."
      }
    ],
    "relatedSlugs": [
      "url-encoder",
      "utf8-converter",
      "html-entities"
    ]
  },
  "image-base64": {
    "longDescription": "<p>The BrainCoder Image to Base64 tool converts any image file (PNG, JPG, GIF, WebP, SVG, and more) into a Base64-encoded data URI string — entirely in your browser. No image is uploaded to any server. This is invaluable for embedding images directly in HTML, CSS, or JSON without needing a separate file host or CDN.</p>\n<p>Base64-encoded images (also called data URIs) inline the image data right into your markup. While this increases file size by about 33%, it eliminates extra HTTP requests, which can improve performance for small icons and logos. It's also the only way to embed images in environments that don't support file uploads — like some email templates, markdown documents, or single-page applications.</p>\n<p>Our tool displays the encoded output along with the original and encoded file sizes so you can make an informed decision about whether inlining is appropriate. Simply drag and drop an image or click to browse — the conversion happens instantly and locally.",
    "features": [
      "Supports PNG, JPG, GIF, WebP, SVG, BMP, and ICO formats",
      "Generates data URI strings for direct HTML embedding",
      "Shows original vs encoded file size comparison",
      "Drag-and-drop or click-to-browse file selection",
      "Copy output as data URI or raw Base64",
      "Zero uploads — conversion happens 100% in your browser"
    ],
    "howTo": [
      {
        "step": "Select an image",
        "description": "Drag and drop an image file onto the tool area, or click the browse button to select a file from your computer. Supported formats include PNG, JPG, GIF, WebP, SVG, BMP, and ICO."
      },
      {
        "step": "View the conversion",
        "description": "The tool instantly reads the image file and converts it to a Base64-encoded data URI string. You'll see a size comparison showing original vs encoded size."
      },
      {
        "step": "Choose output format",
        "description": "Copy the result as a complete data URI (with the data:image/png;base64, prefix) for HTML embedding, or as raw Base64 for other use cases."
      },
      {
        "step": "Embed in your project",
        "description": "Paste the data URI into an HTML img src attribute, a CSS background-image value, or any other place you need inline image data."
      }
    ],
    "faq": [
      {
        "question": "When should I use Base64-encoded images?",
        "answer": "Base64 images are best for small images like icons, logos, and UI elements under 10KB. They eliminate extra HTTP requests and are useful in email templates, single-file HTML pages, and environments without file hosting."
      },
      {
        "question": "Will Base64 encoding change the image quality?",
        "answer": "No. Base64 encoding is lossless — it's a text encoding of the binary data, not a compression format. The decoded image is identical to the original. However, if your source image is a JPEG, it already has lossy compression."
      },
      {
        "question": "Why is the encoded string larger?",
        "answer": "Base64 encoding converts every 3 bytes of binary data into 4 ASCII characters, resulting in approximately 33% size increase. This is the trade-off for being able to store binary data as text."
      },
      {
        "question": "Can I decode a Base64 image string back to an image file?",
        "answer": "Yes. You can paste a Base64 data URI into a decoder tool or use the browser's atob() function and create a Blob to save the decoded image as a file."
      }
    ],
    "relatedSlugs": [
      "base64",
      "qr-code-generator",
      "image-base64"
    ]
  },
  "binary-text": {
    "longDescription": "<p>The BrainCoder Binary to Text tool converts between binary representations and readable text. Each character in the ASCII and Unicode tables has a binary equivalent — for example, the letter 'A' is 01000001 in binary. This tool lets you convert text to its binary representation and back, useful for understanding how computers store data, educational purposes, and debugging low-level data encoding issues.</p>\n<p>Beyond simple ASCII, this converter supports full Unicode, meaning it can handle accented characters, non-Latin scripts, emoji, and any character in the Universal Character Set. The binary output can be formatted with or without spaces, with or without the 0b prefix, and in 7-bit or 8-bit groupings to suit your needs.</p>\n<p>This tool runs entirely in your browser. Whether you're a computer science student learning about number systems, a developer debugging a binary protocol, or just curious about how text becomes ones and zeros, this converter provides clear, accurate results without any server dependency.",
    "features": [
      "Text to binary and binary to text conversion",
      "Full Unicode support including emoji and CJK characters",
      "Configurable output: spaces between bytes, 0b prefix, 7-bit or 8-bit",
      "Instant bidirectional conversion",
      "Handles large text inputs efficiently",
      "Fully client-side with no data uploads"
    ],
    "howTo": [
      {
        "step": "Choose conversion direction",
        "description": "Select whether you want to convert text to binary or binary to text. The tool defaults to text-to-binary mode."
      },
      {
        "step": "Enter your input",
        "description": "For text-to-binary, type or paste any text including letters, numbers, symbols, and Unicode characters. For binary-to-text, enter a string of 0s and 1s."
      },
      {
        "step": "Adjust formatting options",
        "description": "Toggle options like adding spaces between 8-bit groups, including the 0b prefix, or using 7-bit grouping for ASCII-only text."
      },
      {
        "step": "Copy the output",
        "description": "Click the copy button to grab the converted result and use it in your project, homework, or debugging session."
      }
    ],
    "faq": [
      {
        "question": "What is the difference between 7-bit and 8-bit binary?",
        "answer": "7-bit binary represents the original ASCII character set (128 characters). 8-bit binary (a full byte) extends this to 256 characters and is the standard for modern text encoding including UTF-8."
      },
      {
        "question": "Can I convert emoji to binary?",
        "answer": "Yes. Emoji are Unicode characters and this tool supports the full Unicode range. An emoji like 😊 would be converted to its UTF-8 binary representation which may span multiple bytes."
      },
      {
        "question": "Why does my binary output have different lengths for different letters?",
        "answer": "In UTF-8 encoding, ASCII characters use 1 byte (8 bits) while characters outside the basic Latin set use 2-4 bytes. So 'A' becomes 8 bits while 'ñ' becomes 16 bits and '日' becomes 24 bits."
      }
    ],
    "relatedSlugs": [
      "base64",
      "utf8-converter",
      "number-base"
    ]
  },
  "rot13": {
    "longDescription": "<p>The BrainCoder ROT13 & Caesar Cipher tool applies classic letter substitution ciphers to any text. ROT13 shifts every letter by 13 positions in the alphabet — so A becomes N, B becomes O, and so on. Apply it twice and you get back the original text, making it its own inverse. The Caesar cipher extends this concept with configurable shift values from 1 to 25.</p>\n<p>While these ciphers are not secure by modern standards, they remain useful for hiding spoilers in forum posts, obfuscating text in puzzles and games, teaching the fundamentals of cryptography, and quick text scrambling. Our tool lets you adjust the shift value dynamically and supports both uppercase and lowercase letters while preserving numbers, spaces, and punctuation.</p>\n<p>This is a fun, educational tool that runs entirely in your browser. No data is transmitted — just enter your text, pick a shift value, and see the result instantly. It's a great starting point for anyone learning about encryption and decryption.",
    "features": [
      "ROT13 with one-click toggle",
      "Caesar cipher with configurable shift (1-25)",
      "Preserves case, numbers, punctuation, and whitespace",
      "Real-time conversion as you type or adjust shift",
      "One-click copy for output text",
      "Client-side processing — no data leaves your browser"
    ],
    "howTo": [
      {
        "step": "Enter your text",
        "description": "Type or paste the text you want to encrypt or decrypt into the input area. Any text works — letters, numbers, symbols, and spaces."
      },
      {
        "step": "Select cipher mode",
        "description": "Choose ROT13 for the classic 13-position shift, or select the Caesar cipher and adjust the shift value slider to your desired offset (1-25)."
      },
      {
        "step": "View the result",
        "description": "The output updates in real time showing the encrypted (or decrypted) text. Letters are shifted; all other characters remain unchanged."
      },
      {
        "step": "Copy the output",
        "description": "Click the copy button to grab the ciphered text and share it in a forum post, puzzle, or educational exercise."
      }
    ],
    "faq": [
      {
        "question": "Is ROT13 secure encryption?",
        "answer": "No. ROT13 is a trivially reversible substitution cipher with only 12 possible rotations. It's used for spoiler hiding and puzzles, not data security. For real encryption, use the AES encryption tool."
      },
      {
        "question": "How do I decrypt ROT13?",
        "answer": "Simply apply ROT13 again. Since 13 + 13 = 26 (the full alphabet), applying ROT13 twice returns the original text. Alternatively, set the Caesar cipher shift to the same value to reverse it."
      },
      {
        "question": "What is a Caesar cipher?",
        "answer": "A Caesar cipher is a substitution cipher where each letter is shifted by a fixed number of positions in the alphabet. It's named after Julius Caesar, who reportedly used a shift of 3 to encode military messages."
      },
      {
        "question": "Does it preserve numbers and punctuation?",
        "answer": "Yes. Only letters (A-Z, a-z) are shifted. Numbers, spaces, punctuation marks, and all other characters remain in their original positions unchanged."
      }
    ],
    "relatedSlugs": [
      "morse-code",
      "aes-encryption",
      "hash-generator"
    ]
  },
  "morse-code": {
    "longDescription": "<p>The BrainCoder Morse Code Translator converts between text and International Morse Code in real time. Morse code represents letters and numbers as sequences of dots (.) and dashes (-), historically used in telegraph and radio communication. This tool lets you translate any English text into Morse code or decode Morse code back into readable text.</p>\n<p>Each character is separated by a standard gap, and words are separated by a larger space or pipe character, following international conventions. The translator handles the full alphabet (A-Z) and digits (0-9), with correct timing representations. This is useful for hobbyists, amateur radio operators, history enthusiasts, educators teaching communication history, and anyone building escape rooms or puzzles.</p>\n<p>The entire translation process happens in your browser. No Morse code data is sent to any server, and the tool works offline once loaded. It's a quick, accurate, and free way to encode or decode Morse messages.",
    "features": [
      "Text to Morse code translation",
      "Morse code to text translation",
      "Supports A-Z letters and 0-9 digits",
      "Standard international Morse code timing",
      "Clear visual separation between letters and words",
      "Copy-to-clipboard for easy sharing"
    ],
    "howTo": [
      {
        "step": "Enter text or Morse code",
        "description": "Type English text to translate to Morse, or enter a Morse code string (using dots, dashes, and spaces) to translate back to text."
      },
      {
        "step": "The translation appears instantly",
        "description": "The tool detects whether your input is text or Morse code and translates it automatically. Morse output uses dots (.) and dashes (-) with standard spacing."
      },
      {
        "step": "Copy the result",
        "description": "Click the copy button to grab the translated output for use in a project, puzzle, or communication exercise."
      }
    ],
    "faq": [
      {
        "question": "What is Morse code?",
        "answer": "Morse code is a method of encoding text characters as sequences of dots (short signals) and dashes (long signals). It was developed in the 1830s-1840s for telegraph communication and remains in use by amateur radio operators today."
      },
      {
        "question": "Does this support prosigns or special Morse characters?",
        "answer": "This tool supports the standard International Morse Code alphabet (A-Z) and digits (0-9). It does not currently support procedural signals (prosigns) or extended punctuation, but may in a future update."
      },
      {
        "question": "How are words separated in Morse code?",
        "answer": "In standard Morse code, letters are separated by 3 units of time, and words are separated by 7 units. This tool represents letter gaps as a single space and word gaps as a triple space or pipe (|) for clarity."
      }
    ],
    "relatedSlugs": [
      "rot13",
      "binary-text",
      "number-base"
    ]
  },
  "utf8-converter": {
    "longDescription": "<p>The BrainCoder UTF-8 & Unicode Converter works with character encodings at the byte level. It converts text to its UTF-8 byte representation, displays Unicode code points, and shows HEX, DEC, and OCT values for each character. This is essential for developers working with internationalization, character encoding issues, or low-level text processing.</p>\n<p>UTF-8 is the dominant character encoding on the web, used by over 98% of websites. Understanding how characters map to bytes is critical for debugging encoding errors, building multi-language applications, and working with APIs that require specific character encodings. This tool breaks down any text into its constituent bytes and code points with clear, readable output.</p>\n<p>Whether you're troubleshooting a mojibake issue (garbled text from encoding mismatches), verifying how emoji are encoded, or teaching character encoding concepts, this tool provides comprehensive visual output. Everything is processed locally in your browser — no text is ever sent to a server.",
    "features": [
      "UTF-8 byte breakdown with HEX, DEC, and OCT values",
      "Unicode code point display (U+ notation)",
      "Supports full Unicode range including emoji and CJK",
      "Shows byte length and character count",
      "Hex dump style formatted output",
      "Fully client-side — no data transmission"
    ],
    "howTo": [
      {
        "step": "Enter text to analyze",
        "description": "Type or paste any text into the input field — including non-Latin characters, emoji, or special symbols you want to examine at the byte level."
      },
      {
        "step": "Review the byte breakdown",
        "description": "The tool displays each character's UTF-8 byte sequence in HEX, DEC, and OCT formats, along with its Unicode code point (e.g., U+0041 for 'A')."
      },
      {
        "step": "Check encoding details",
        "description": "View the total byte length, character count, and see which characters use single-byte vs multi-byte encoding."
      },
      {
        "step": "Copy specific values",
        "description": "Click any byte value or code point to copy it for use in your code, documentation, or debugging notes."
      }
    ],
    "faq": [
      {
        "question": "What is the difference between UTF-8 and Unicode?",
        "answer": "Unicode is the character set that assigns a unique number (code point) to every character. UTF-8 is one of several encodings that translates those code points into byte sequences for storage and transmission. UTF-8 is variable-length (1-4 bytes per character)."
      },
      {
        "question": "Why do some characters use multiple bytes?",
        "answer": "UTF-8 uses variable-length encoding. Basic Latin characters (A-Z, 0-9) use 1 byte. Characters with diacritics like é use 2 bytes. CJK characters use 3 bytes, and emoji typically use 4 bytes. This efficient encoding is why UTF-8 is so popular."
      },
      {
        "question": "How do I fix garbled text (mojibake)?",
        "answer": "Mojibake occurs when text encoded in one format is decoded as another. Use this tool to inspect the actual byte values of your garbled text, then determine what encoding was originally intended and re-decode it correctly."
      }
    ],
    "relatedSlugs": [
      "binary-text",
      "base64",
      "number-base"
    ]
  },
  "base32": {
    "longDescription": "<p>The BrainCoder Base32 Encoder & Decoder converts text to Base32 and back. Base32 uses 32 uppercase letters (A-Z) and digits (2-7) to encode binary data as text. It's commonly used in TOTP (Time-based One-Time Password) secret keys, DNS zone transfers, and applications where case-insensitive encoding is needed.</p>\n<p>Compared to Base64, Base32 uses only uppercase letters and a small set of digits, making it safer for transcription by hand, case-insensitive systems, and environments where special characters (+, /) might be problematic. The trade-off is a larger output — Base32 produces about 60% more characters than the original data.</p>\n<p>Our tool follows the RFC 4648 standard for Base32 encoding. It handles padding correctly, supports both standard and hex (RFC 4648 extended) alphabets, and processes your data entirely in the browser. No Base32 strings are sent to any server.",
    "features": [
      "RFC 4648 compliant Base32 encoding and decoding",
      "Standard alphabet (A-Z, 2-7) support",
      "Hex/Base32 extended alphabet option",
      "Correct padding handling",
      "One-click copy for output",
      "100% client-side processing"
    ],
    "howTo": [
      {
        "step": "Enter text to encode",
        "description": "Type or paste the text you want to convert to Base32. This could be a TOTP secret key, a binary string, or any other data."
      },
      {
        "step": "Click Encode or Decode",
        "description": "Choose 'Encode' to convert text to Base32, or 'Decode' to convert a Base32 string back to the original text."
      },
      {
        "step": "Copy the result",
        "description": "Click the copy button to grab the Base32 output for use as a TOTP secret, in a configuration file, or wherever Base32 is required."
      }
    ],
    "faq": [
      {
        "question": "When should I use Base32 instead of Base64?",
        "answer": "Use Base32 when you need case-insensitive encoding, when the encoded string will be transcribed by hand (like TOTP keys), or when the transport medium is case-insensitive (like DNS or case-insensitive file systems)."
      },
      {
        "question": "What is Base32 used for in TOTP?",
        "answer": "TOTP authenticator apps (like Google Authenticator) use Base32-encoded secret keys. When you scan a QR code for 2FA setup, the secret is typically encoded in Base32. This tool can decode those keys for inspection."
      },
      {
        "question": "What are the valid Base32 characters?",
        "answer": "Standard Base32 uses uppercase letters A-Z and digits 2-7 (32 characters total). The hex variant uses 0-9 instead of 2-7. Both are supported by this tool."
      }
    ],
    "relatedSlugs": [
      "base64",
      "password-generator",
      "uuid-generator"
    ]
  },
  "aes-encryption": {
    "longDescription": "<p>The BrainCoder AES Encrypt & Decrypt tool provides symmetric encryption using the Advanced Encryption Standard (AES) — the same algorithm protecting everything from HTTPS connections to government classified data. Enter your plaintext, provide a passphrase, and the tool encrypts your data into an unreadable ciphertext using AES-GCM with PBKDF2 key derivation.</p>\n<p>Security is handled properly: your passphrase is stretched through thousands of PBKDF2 iterations to derive a secure encryption key, and a unique initialization vector (IV) is generated for each encryption operation. This means even encrypting the same text with the same password produces different ciphertext, which is a hallmark of secure encryption. The tool uses the Web Crypto API — the same cryptographic engine in your browser.</p>\n<p>All encryption and decryption happens locally. Your plaintext, passphrase, and ciphertext never leave your browser. This makes it suitable for encrypting sensitive notes, passwords, API keys, or any data you want to protect before storing it in a file, email, or cloud service.",
    "features": [
      "AES-256-GCM encryption (military-grade security)",
      "PBKDF2 key derivation with configurable iterations",
      "Unique IV generated for each encryption operation",
      "Compatible with other AES-GCM implementations",
      "Outputs ciphertext as Base64 for easy storage",
      "Zero data transmission — entirely in-browser"
    ],
    "howTo": [
      {
        "step": "Enter plaintext",
        "description": "Type or paste the text you want to encrypt into the plaintext field. This could be a password, API key, private note, or any sensitive data."
      },
      {
        "step": "Provide a strong passphrase",
        "description": "Enter a passphrase that will be used to derive the encryption key. Use a strong, unique passphrase — the security of your encrypted data depends on it."
      },
      {
        "step": "Click Encrypt",
        "description": "The tool derives an AES-256 key from your passphrase using PBKDF2, generates a random IV, and produces an encrypted ciphertext output."
      },
      {
        "step": "Copy and store the ciphertext",
        "description": "Copy the Base64-encoded ciphertext and store it safely. To decrypt later, paste the ciphertext, enter the same passphrase, and click Decrypt."
      }
    ],
    "faq": [
      {
        "question": "How strong is AES-256 encryption?",
        "answer": "AES-256 is considered quantum-resistant and is approved by the NSA for TOP SECRET classified information. Brute-forcing AES-256 would require more energy than exists in the known universe. Your data is safe from computational attacks."
      },
      {
        "question": "What if I forget my passphrase?",
        "answer": "There is no recovery mechanism. AES encryption with PBKDF2 key derivation is designed to be irrecoverable without the passphrase. If you forget it, the encrypted data is permanently inaccessible. Store your passphrase securely."
      },
      {
        "question": "Is the encrypted output compatible with other tools?",
        "answer": "Yes. This tool uses standard AES-256-GCM with PBKDF2 and standard key derivation parameters. The output includes all necessary metadata (salt, IV, iterations) in the ciphertext, making it compatible with other standard AES-GCM implementations."
      },
      {
        "question": "What is the difference between encryption and encoding?",
        "answer": "Encoding (like Base64) just transforms data to a different format and can be reversed by anyone. Encryption requires a key or passphrase to reverse, making the data unreadable to anyone without the credentials."
      }
    ],
    "relatedSlugs": [
      "hash-generator",
      "password-generator",
      "base64"
    ]
  },
  "checksum-calculator": {
    "longDescription": "<p>The BrainCoder Checksum & HMAC Calculator computes cryptographic and non-cryptographic checksums for any text input. It supports popular algorithms including CRC32, Adler32, MD5, SHA-1, SHA-256, and HMAC variants with custom keys. Checksums verify data integrity — if even a single bit changes, the checksum changes completely.</p>\n<p>HMAC (Hash-based Message Authentication Code) adds a secret key to the hash computation, creating a tamper-evident seal. If you share data along with its HMAC, the recipient can verify the data hasn't been modified by recomputing the HMAC with the same key. This is fundamental to API authentication, webhook verification, and secure communication protocols.</p>\n<p>Non-cryptographic checksums like CRC32 are faster and used for error detection in file transfers, network packets, and storage systems. Our tool covers both use cases in a single interface. All computation happens in your browser — no text, keys, or hashes are sent anywhere.",
    "features": [
      "CRC32 and Adler32 non-cryptographic checksums",
      "MD5, SHA-1, SHA-256 cryptographic hashes",
      "HMAC with MD5, SHA-256, and SHA-512",
      "Custom HMAC key input",
      "Multiple algorithms computed simultaneously",
      "Fully client-side with no external dependencies"
    ],
    "howTo": [
      {
        "step": "Enter text to checksum",
        "description": "Type or paste the data you want to compute a checksum or HMAC for into the input field."
      },
      {
        "step": "Select algorithm",
        "description": "Choose from CRC32, MD5, SHA-1, SHA-256, or HMAC variants. For HMAC, enter your secret key in the key field."
      },
      {
        "step": "View results",
        "description": "The tool computes and displays the checksum/hash value. Select multiple algorithms to see all values at once."
      },
      {
        "step": "Copy the checksum",
        "description": "Click the copy button next to any result to grab the checksum value for use in integrity verification, API authentication, or logging."
      }
    ],
    "faq": [
      {
        "question": "What is the difference between a checksum and an HMAC?",
        "answer": "A checksum is a hash of the data alone. An HMAC combines the data with a secret key before hashing, providing both integrity (data hasn't changed) and authenticity (data was created by someone with the key)."
      },
      {
        "question": "When should I use CRC32 vs SHA-256?",
        "answer": "Use CRC32 for fast error detection in file transfers, network packets, or storage where accidental corruption is the concern. Use SHA-256 when you need cryptographic security against intentional tampering."
      },
      {
        "question": "How do I verify a checksum?",
        "answer": "Compute the same checksum/hash on the received data and compare it to the checksum provided by the sender. If they match, the data is intact. If they differ, the data was corrupted or modified."
      }
    ],
    "relatedSlugs": [
      "hash-generator",
      "aes-encryption",
      "checksum-calculator"
    ]
  },
  "password-generator": {
    "longDescription": "<p>The BrainCoder Strong Password Generator creates cryptographically random passwords in your browser. Pick a length from 6 to 64 characters, toggle character types (uppercase, lowercase, digits, symbols), and optionally exclude hard-to-distinguish characters such as 0/O and l/1/I before copying your password with one click.</p>\n<p>The generator uses the browser's Crypto.getRandomValues() API, which draws cryptographically secure randomness from the operating system's entropy pool — the same source native password managers rely on. This is vastly superior to Math.random()-based generators, whose predictable sequences attackers can exploit. Every password is effectively unpredictable and statistically resistant to brute-force attacks.</p>\n<p>Your passwords are never stored, uploaded, or logged — they exist only on your screen and in your clipboard until you overwrite them. Everything runs locally in your browser, free and with no account required. A live entropy readout shows approximate bits along with a Weak / Good / Strong rating, and regenerating with the same settings produces an entirely new password every time.</p>",
    "features": [
      "Cryptographically secure random generation (Crypto.getRandomValues)",
      "Configurable length from 6 to 64 characters",
      "Toggle uppercase, lowercase, digits, and symbols",
      "Exclude ambiguous characters (I, l, 1, O, 0, o) for easier reading",
      "Live strength and entropy indicator (≈ bits plus Weak / Good / Strong)",
      "One-click copy and instant regeneration"
    ],
    "howTo": [
      {
        "step": "Set password length",
        "description": "Drag the slider to set your password length from 6 to 64 characters. Longer passwords are exponentially harder to crack — 16+ characters is recommended."
      },
      {
        "step": "Choose character types",
        "description": "Toggle on the character types you want: uppercase letters, lowercase letters, digits, and symbols. Include all four for maximum security."
      },
      {
        "step": "Configure exclusion rules",
        "description": "Optionally exclude ambiguous characters that look similar (like 0/O or l/1/I) to make passwords easier to read and type."
      },
      {
        "step": "Generate and copy",
        "description": "Click 'Regenerate' to create a new random password (the field also refreshes automatically when you change settings). Review the strength readout, then click 'Copy' to grab it."
      }
    ],
    "faq": [
      {
        "question": "How long should a password be?",
        "answer": "For most accounts, 16-20 characters with mixed character types is excellent. For critical systems (banking, admin), 24+ characters is recommended. Each additional character exponentially increases the time needed for a brute-force attack."
      },
      {
        "question": "Are generated passwords stored anywhere?",
        "answer": "No. Generated passwords exist only in your browser's memory and on your screen. They are never sent to any server, stored in cookies, or logged. A generated password stays in your clipboard until it is overwritten, so clear or overwrite it if you are sharing a device."
      },
      {
        "question": "Why not just use a memorable phrase?",
        "answer": "Memorable phrases still work but are vulnerable to dictionary attacks. A random 16-character password drawn from all four character types carries roughly 100 bits of entropy — about a quadrillion times more than a common four-word phrase — so a generated password resists guessing far better than even clever-sounding phrases."
      },
      {
        "question": "What is password entropy?",
        "answer": "Entropy measures password strength in bits; each extra bit doubles the search space. A random 16-character password using all four character types carries roughly 100 bits, which would take millennia to brute-force even at billions of guesses per second. The tool shows your current password's approximate bit count and a Weak / Good / Strong rating directly under the bar."
      },
      {
        "question": "Is it safe to use an online password generator?",
        "answer": "Yes, when generation happens locally. This tool uses the browser's crypto.getRandomValues() API — the same cryptographically secure source behind secure connections — and nothing you generate is uploaded or logged. Each password is created on your device and exists only on your screen until you save it."
      },
      {
        "question": "Can I generate passwords offline?",
        "answer": "Yes. Once the page has loaded, generation runs entirely in your browser with no server call, so it works offline and the password never travels over a network."
      }
    ],
    "relatedSlugs": [
      "hash-generator",
      "aes-encryption",
      "uuid-generator"
    ]
  },
  "uuid-generator": {
    "longDescription": "<p>The BrainCoder UUID Generator creates UUID v4 (random) identifiers in your browser. UUIDs — sometimes called GUIDs — are 128-bit identifiers with 122 random bits, and the chance any two v4 UUIDs collide is about 1 in 2^122, so generated values are practically unique without any central coordination. That makes them ideal for database primary keys, session and transaction IDs, API request tracing, and distributed systems.</p>\n<p>Each UUID follows the standard 8-4-4-4-12 format (36 characters, e.g. <code>550e8400-e29b-41d4-a716-446655440000</code>). Use the Count slider to generate 1 to 100 at once, and switch to Uppercase or No hyphens (32 characters) variants if your system expects them. The list updates the moment you change any option; <strong>Generate</strong> re-rolls a fresh batch, and <strong>Clear</strong> empties the list.</p>\n<p>Values are produced with the browser's cryptographic random source (Web Crypto) and never leave your device — nothing is uploaded or stored by the tool.</p>",
    "features": [
      "UUID v4 generation using the browser's cryptographic random source",
      "Count slider generates 1 to 100 UUIDs per batch",
      "Standard 8-4-4-4-12 format, with Uppercase and No hyphens variants",
      "One-click copy for individual UUIDs",
      "Copy all generated UUIDs at once",
      "Zero server interaction — fully client-side, nothing uploaded"
    ],
    "howTo": [
      {
        "step": "Choose a count",
        "description": "Drag the Count slider (1–100) to set the batch size. The list regenerates immediately, so the number of UUIDs shown always matches the slider."
      },
      {
        "step": "Apply variants",
        "description": "Toggle Uppercase or No hyphens to reformat the output (36-character hyphenated form, or 32 uppercase hex digits with both options on)."
      },
      {
        "step": "Generate or re-roll",
        "description": "Click 'Generate' to replace the list with a fresh random batch. Every click produces completely new identifiers."
      },
      {
        "step": "Copy the UUIDs",
        "description": "Click the copy button next to any UUID for a single value, or 'Copy all' to copy the whole batch as one value per line. Use 'Clear' to empty the list."
      }
    ],
    "faq": [
      {
        "question": "What version of UUID does this generate?",
        "answer": "UUID v4 — 122 random bits plus 6 fixed bits reserving the version (4) and variant fields. It is the most widely used version for general-purpose unique identification."
      },
      {
        "question": "Can two UUIDs ever be the same?",
        "answer": "Theoretically yes, but the probability any two v4 UUIDs collide is about 1 in 2^122 (5.3 × 10^36). By the birthday bound you would need to generate around 2^61 UUIDs for a 50% chance of any collision — far more than any real workload."
      },
      {
        "question": "Why are there Uppercase and No hyphens options?",
        "answer": "Some systems and schemas expect uppercase hex or store compact 32-character identifiers without dashes. Toggling either option re-renders the current batch in that form — both are the same 122-bit value, just a different textual representation."
      },
      {
        "question": "Are generated UUIDs stored or sent anywhere?",
        "answer": "No. Values are produced locally with Web Crypto, kept in the page's memory while you work, and cleared when you leave or press Clear. Nothing is uploaded, and no UUID you generate is persisted by the tool."
      }
    ],
    "relatedSlugs": [
      "password-generator",
      "hash-generator",
      "random-number-generator",
      "slug-generator"
    ]
  },
  "lorem-ipsum": {
    "longDescription": "<p>The BrainCoder Lorem Ipsum Generator produces classic placeholder text for design mockups, wireframes, and layout testing. Lorem Ipsum is the industry-standard dummy text — scrambled from Cicero's 'De Finibus Bonorum et Malorum' (45 BC) and in printing use since the 1500s — because its varied word lengths and letter distribution resemble real text without distracting from the layout.</p>\n<p>Generate paragraphs, sentences, or words, from 1 to 50 units at a time. Each batch opens with the classic 'Lorem ipsum dolor sit amet' opener, draws only from the authentic Cicero-based vocabulary, and avoids repeating the same word twice in a row. Changing the unit type or quantity regenerates the text immediately, and Generate re-rolls a fresh batch on demand.</p>\n<p>Everything happens in your browser — no generated text is stored or transmitted anywhere.</p>",
    "features": [
      "Generate paragraphs, sentences, or words, from 1 to 50 units",
      "Every batch opens with the classic 'Lorem ipsum dolor sit amet' opener",
      "Classic vocabulary drawn from Cicero's De Finibus",
      "No adjacent word repeats for natural-looking output",
      "Auto-regenerates when you change unit or quantity, plus a one-click Generate re-roll",
      "One-click copy — generated text never leaves your browser"
    ],
    "howTo": [
      {
        "step": "Choose the generation unit",
        "description": "Select paragraphs, sentences, or words depending on how much content and which shape of placeholder you need."
      },
      {
        "step": "Set the quantity",
        "description": "Drag the Count slider from 1 to 50 to choose how many paragraphs, sentences, or words to generate. The text updates as soon as you move it."
      },
      {
        "step": "Generate or re-roll",
        "description": "Click Generate to replace the output with a fresh random batch. Changing the unit or quantity regenerates automatically."
      },
      {
        "step": "Copy the output",
        "description": "Click the copy button to grab the generated placeholder text and paste it into your design tool, HTML, or CMS."
      }
    ],
    "faq": [
      {
        "question": "What is Lorem Ipsum?",
        "answer": "Lorem Ipsum is dummy text derived from Cicero's 'De Finibus Bonorum et Malorum' (45 BC). It's been used as placeholder text since the 1500s and remains the standard for filling design layouts without meaningful content distraction."
      },
      {
        "question": "Why not just use 'test test test'?",
        "answer": "Lorem Ipsum has varied word lengths, punctuation, and letter distributions that more closely resemble real English text, so it's better for evaluating typography, line spacing, and layout aesthetics in designs."
      },
      {
        "question": "Why does every batch start with 'Lorem ipsum dolor sit amet'?",
        "answer": "That five-word run is the canonical starting phrase of the original passage, and it's what most people expect from a lorem ipsum generator — it signals instantly that the text is placeholder content."
      },
      {
        "question": "Can I use Lorem Ipsum in a production website?",
        "answer": "While technically possible, placeholder text should always be replaced with real content before launch. Leaving Lorem Ipsum on a live site looks unprofessional and can confuse visitors."
      }
    ],
    "relatedSlugs": [
      "random-name-picker",
      "text-repeater",
      "slug-generator"
    ]
  },
  "qr-code-generator": {
    "longDescription": "<p>The BrainCoder QR Code Generator turns text or a URL into a QR code entirely inside your browser. There is no Generate button and no server round-trip: the code is rebuilt as you type, and the text never leaves your device.</p>\n<p>Encoding is written from scratch in TypeScript rather than delegated to a third-party library, and it covers the whole standard — versions 1 to 40 and all four error correction levels, with Reed-Solomon error correction and ISO penalty scoring for mask selection. Pick foreground and background colours, choose an error correction level, and set the PNG width.</p>\n<p>Download a PNG for screens and documents, or an SVG when the code is going to print: the SVG is vector, so it scales without resampling, while the PNG is a raster image that is only sharp at the pixel size you exported.</p>\n<p>The tool is deliberately candid about its limits. Error correction recovers damaged modules, not glare or blur; printing needs each module to stay at least 0.5 mm; the four-module quiet zone is part of the image and must not be cropped; and a single mode is used for the whole string, so mixed or non-ASCII text holds fewer characters than the headline figure.</p>",
    "features": [
      "Encodes in the browser from scratch — no library, no uploads",
      "Full standard support: versions 1 to 40 and levels L, M, Q, H",
      "Reed-Solomon error correction with ISO penalty-based mask selection",
      "Two outputs: PNG raster at an exact integer module scale, and SVG vector",
      "Live warnings for low contrast, print size, and dense versions",
      "Shows the version, size, mode, and mask it actually chose",
      "Nothing leaves your device, so it keeps working offline"
    ],
    "howTo": [
      {
        "step": "Enter your content",
        "description": "Type or paste any text, URL, email address, phone number, or Wi-Fi configuration string (WIFI:T:WPA;S:Name;P:Pass;;). The code updates as you type. The box starts empty on purpose, so what you see is what you encoded."
      },
      {
        "step": "Choose an error correction level",
        "description": "L (7%), M (15%), Q (25%), and H (30%) trade capacity against tolerance for damage. M suits most uses; Q and H are worth the extra density for stickers and packaging; L holds the most text but survives the least."
      },
      {
        "step": "Check the warnings before you commit",
        "description": "The panel warns when your colours have poor contrast, when the code is dense enough that screens and cheap printers lose modules, and when the chosen version will be too fine to print. Fixing these is usually easier than upgrading your scanner."
      },
      {
        "step": "Scan it with your own phone",
        "description": "Before printing in bulk, scan the preview with the phone you expect to be used. This is the only test that matches your actual camera, screen brightness, and viewing distance."
      },
      {
        "step": "Download",
        "description": "Use the PNG for screens, chat, and documents. Use the SVG for anything that will be printed or resized, since it stays sharp at any size and any resolution."
      }
    ],
    "faq": [
      {
        "question": "What can I encode in a QR code?",
        "answer": "Any text: URLs, notes, email addresses, phone numbers, and formatted strings such as Wi-Fi credentials (WIFI:T:WPA;S:Name;P:Pass;;) or vCards. The tool encodes exactly what you type, so a Wi-Fi code must use that WIFI: format for phones to recognise it."
      },
      {
        "question": "How much data can a QR code hold?",
        "answer": "At level L the largest code, version 40, holds 7,089 digits or 4,296 uppercase alphanumeric characters or 2,953 bytes. Digits are the cheapest, lowercase letters are the most expensive, so a realistic URL uses a fraction of the headline number. Raising the error correction level reduces every one of those figures."
      },
      {
        "question": "Why use one mode for the whole string?",
        "answer": "A single mode keeps the output small, fast, and easy to audit. The trade-off is capacity: the tool picks the densest mode the entire string fits, so a single lowercase letter in an otherwise uppercase string forces the whole thing into byte mode. Splitting a string across modes would squeeze in more characters, at the cost of a longer, denser code that is harder to scan."
      },
      {
        "question": "Will non-Latin text work?",
        "answer": "Usually. Text outside ASCII is encoded as UTF-8 bytes with no ECI header, which is what most readers assume. A minority of scanners interpret those bytes using a different encoding and show mojibake instead. If that matters to you, keep the content to ASCII or test on the specific readers you need to support."
      },
      {
        "question": "What error correction level should I use?",
        "answer": "M (15%) is the best balance for most uses. Q (25%) and H (30%) are worth the extra density for printed items that get handled, since a higher level recovers more damaged modules at the cost of a finer code. L (7%) holds the most text and survives the least. Higher error correction repairs damage to the modules themselves — it cannot rescue glare, motion blur, or a code printed too small to resolve."
      },
      {
        "question": "Can I invert the colours, light on dark?",
        "answer": "You can, and the tool will let you, but treat it as a risk. A light-on-dark code reads on many modern phones and fails on plenty of others, especially older readers and some built-in cameras. If you need inverted colours, scan it on every device you care about before committing to print."
      },
      {
        "question": "How large should I print it?",
        "answer": "Judge it by module size rather than overall width: keep each module at 0.5 mm or larger, which is roughly what a phone camera needs to resolve. A version 40 code needs about 83 mm across at that module size, while a version 4 code needs only about 40 mm. The tool warns when a code at a given width would fall below this, and printing larger is always the easier fix."
      },
      {
        "question": "Why does my QR code not scan?",
        "answer": "In order of likelihood: the module size is too small on screen or in print; the contrast between foreground and background is under 4:1; glare or a curved surface is distorting the modules; the code is a dense high version; or the quiet zone around it was cropped. Raise contrast, make it bigger, flatten the surface, and keep the border. No QR code is guaranteed to scan in every condition, so always test on the device you intend to use."
      },
      {
        "question": "What is the quiet zone and why is it there?",
        "answer": "It is the four-module-wide blank margin the specification requires on every side of the code. Scanners use it to find the code's edges and to judge where the dark area starts. It is included in both the PNG and the SVG, and cropping it is one of the most common reasons an otherwise perfect code will not read."
      },
      {
        "question": "Does anything leave my browser?",
        "answer": "No. The encoder is pure TypeScript running on your device, so the text is never sent anywhere and is never logged. This matters for codes carrying Wi-Fi passwords or private links. Once the page has loaded, the tool works offline."
      }
    ],
    "relatedSlugs": [
      "base64",
      "url-encoder",
      "image-base64",
      "uuid-generator"
    ]
  },
  "random-number-generator": {
    "longDescription": "<p>The BrainCoder Random Number Generator produces cryptographically secure random numbers within any specified range. Whether you need a single random integer, a set of unique lottery numbers, or a floating-point value between two decimals, this tool provides truly random results using your browser's Crypto API.</p>\n<p>Unlike Math.random() which uses a predictable pseudorandom algorithm, our generator uses crypto.getRandomValues() which sources entropy from the operating system's hardware events, mouse movements, and other unpredictable sources. This makes the results suitable for security-sensitive applications like token generation, sampling, and games where fairness matters.</p>\n<p>Configure the minimum and maximum range, choose between integers and decimals, and generate as many numbers as you need in a single batch. All numbers are generated locally and never transmitted. The tool also prevents duplicates if you need unique values within a range.",
    "features": [
      "Cryptographically secure random generation",
      "Integer and decimal number modes",
      "Configurable min/max range",
      "Batch generation up to 100 numbers",
      "Unique-only mode to prevent duplicates",
      "Uses crypto.getRandomValues() for true randomness"
    ],
    "howTo": [
      {
        "step": "Set the range",
        "description": "Enter minimum and maximum values to define the range for your random numbers. Integers or decimals are both supported."
      },
      {
        "step": "Choose number type",
        "description": "Select 'Integer' for whole numbers or 'Decimal' for floating-point values with configurable decimal places."
      },
      {
        "step": "Set quantity",
        "description": "Specify how many random numbers you want to generate. Toggle 'Unique only' if you need non-repeating values."
      },
      {
        "step": "Generate and copy",
        "description": "Click 'Generate' to produce the random numbers. Copy individual values or all results at once."
      }
    ],
    "faq": [
      {
        "question": "Is this truly random or pseudorandom?",
        "answer": "This tool uses the browser's crypto.getRandomValues() API, which sources entropy from hardware and OS-level events. While technically it's cryptographically secure pseudorandom (CSPRNG), the output is indistinguishable from true randomness for all practical purposes."
      },
      {
        "question": "Can I use this for lottery numbers?",
        "answer": "Yes. Set the range to match your lottery's number pool (e.g., 1-49), enable 'Unique only', and generate the required number of picks. The cryptographic randomness ensures fair, unbiased selection."
      },
      {
        "question": "How many numbers can I generate at once?",
        "answer": "You can generate up to 100 numbers in a single batch. For larger quantities, run the generator multiple times."
      }
    ],
    "relatedSlugs": [
      "uuid-generator",
      "password-generator",
      "random-name-picker"
    ]
  },
  "random-name-picker": {
    "longDescription": "<p>The BrainCoder Random Name Picker selects one or more random names from a custom list you provide. It's perfect for team assignments, giveaway drawings, classroom activities, icebreaker games, raffle winners, and any situation where you need to pick fairly from a group of names.</p>\n<p>Simply enter one name per line (or separated by commas), set how many names to pick, and click the button. The tool uses cryptographic randomness to ensure fair, unbiased selection. You can exclude previously picked names from future rounds, enabling multi-round drawings without repeats.</p>\n<p>All processing happens in your browser — no names are stored, transmitted, or shared with any third party. This makes it safe to use with real participant names for contests, lotteries, or classroom activities. The tool is free, requires no signup, and works on any device.",
    "features": [
      "Pick 1 or more random names from a list",
      "Enter names via text input (line or comma separated)",
      "Cryptographically fair selection",
      "Exclude previously picked names",
      "Visual spin animation for dramatic reveals",
      "No data stored or transmitted"
    ],
    "howTo": [
      {
        "step": "Enter your list of names",
        "description": "Type or paste names into the input area, one per line or separated by commas. Any number of names works — from 2 to 1000+."
      },
      {
        "step": "Set how many to pick",
        "description": "Choose how many names you want to randomly select. Leave it at 1 for a single winner, or increase for team assignments."
      },
      {
        "step": "Click Pick Names",
        "description": "The tool randomly selects the specified number of names from your list with a visual animation. Selected names are highlighted."
      },
      {
        "step": "Repeat or export",
        "description": "Click again to pick more names. Toggle 'Exclude picked' to prevent the same name from being selected twice in multi-round drawings."
      }
    ],
    "faq": [
      {
        "question": "Is the selection truly random?",
        "answer": "Yes. The tool uses cryptographic randomness via crypto.getRandomValues(), which is the same quality of randomness used in security applications. Every name has an equal probability of being selected."
      },
      {
        "question": "Can I use this for classroom activities?",
        "answer": "Absolutely. It's great for assigning students to groups, picking presentation order, selecting who goes first in games, or any classroom randomization need. Names stay private in your browser."
      },
      {
        "question": "How many names can I enter?",
        "answer": "There's no practical limit. You can enter anywhere from 2 names to over 1,000. The tool handles large lists efficiently."
      }
    ],
    "relatedSlugs": [
      "random-number-generator",
      "coin-dice-roller",
      "lorem-ipsum"
    ]
  },
  "coin-dice-roller": {
    "longDescription": "<p>The BrainCoder Coin Flip & Dice Roller simulates fair coin flips and dice rolls using cryptographic randomness. Flip a virtual coin (heads or tails), roll a standard 6-sided die, or use polyhedral dice (d4, d8, d10, d12, d20) for tabletop gaming. Every outcome is generated with provably fair randomness.</p>\n<p>This tool is ideal for tabletop RPGs (D&D, Pathfinder), board games, quick decisions, classroom activities, and any situation where you need a fair random outcome without physical dice. The visual animations make it fun and engaging, while the cryptographic backend ensures the results are as unbiased as rolling a physical die.</p>\n<p>Keep a history of your rolls and flips within the session. The tool tracks every result so you can review past outcomes. All randomness is generated locally — no results are stored on any server. It's the most convenient and fairest way to make random decisions.",
    "features": [
      "Fair coin flip (heads/tails)",
      "Standard d6 dice roll",
      "Polyhedral dice: d4, d8, d10, d12, d20",
      "Visual flip and roll animations",
      "Roll history tracking within session",
      "Cryptographically secure randomness"
    ],
    "howTo": [
      {
        "step": "Choose your randomizer",
        "description": "Select a coin flip, standard d6 die, or polyhedral die (d4, d8, d10, d12, d20) depending on your needs."
      },
      {
        "step": "Click Flip or Roll",
        "description": "Click the corresponding button to trigger the animation. The result will be displayed after the animation completes."
      },
      {
        "step": "Review the result",
        "description": "The outcome is shown with the numerical value (for dice) or side name (for coins). The result is added to your roll history."
      },
      {
        "step": "Keep rolling",
        "description": "Click again for another flip or roll. Your history is maintained throughout the session so you can track all outcomes."
      }
    ],
    "faq": [
      {
        "question": "Is this fair compared to physical dice?",
        "answer": "Yes, arguably fairer. Physical dice can have manufacturing defects that bias outcomes. This tool uses cryptographic randomness which is provably unbiased. The only difference is you can't feel the physical roll."
      },
      {
        "question": "What are polyhedral dice used for?",
        "answer": "Polyhedral dice are used in tabletop RPGs like Dungeons & Dragons. A d20 is used for attack rolls, a d8 for damage on some weapons, a d4 for others, and so on. This tool supports all common RPG dice types."
      },
      {
        "question": "Can I use this for serious decision-making?",
        "answer": "Yes. The cryptographic randomness makes it suitable for any fair decision — from choosing a restaurant to resolving disputes. Just remember that the fairness of any random tool depends on how honestly the inputs were defined."
      }
    ],
    "relatedSlugs": [
      "random-number-generator",
      "random-name-picker",
      "uuid-generator"
    ]
  },
  "timestamp-converter": {
    "longDescription": "<p>The BrainCoder Timestamp Converter converts between Unix timestamps (epoch seconds) and human-readable dates and times. Unix time counts the number of seconds since January 1, 1970 (the Unix epoch) and is the standard time format used in APIs, databases, logging systems, and distributed computing.</p>\n<p>Paste a timestamp like 1725000000 or 1725000000000 and read it instantly as your local time, UTC, ISO 8601, or an HTTP date (RFC 2822). Convert the other way by typing or editing a date and time directly — the timestamp updates as you type. Values of 10 and 13 digits are auto-detected as seconds and milliseconds respectively, with a manual override checkbox when you need either interpretation.</p>\n<p>Local times show your browser's timezone name and current UTC offset, a live 'Current Unix time' line ticks next to the Now button, and every result has a one-click copy button. Everything runs entirely in your browser — no timestamp is ever sent to a server.",
    "features": [
      "Unix timestamp (seconds or milliseconds) to readable date",
      "Local date and time to Unix timestamp, converting as you type",
      "Auto-detects 10-digit seconds vs 13-digit milliseconds",
      "Local time (with timezone name and offset), UTC, ISO 8601, and HTTP date outputs",
      "Live current Unix time display with a one-click Now button",
      "One-click copy on every result, entirely in your browser"
    ],
    "howTo": [
      {
        "step": "Enter a Unix timestamp",
        "description": "Paste or type a timestamp such as 1725000000 (seconds) or 1725000000000 (milliseconds). 13-digit values are auto-detected as milliseconds; use the checkbox to switch interpretation."
      },
      {
        "step": "Convert the other way",
        "description": "Type or edit a date and time in the 'Date & time (local)' field, e.g. 2024-01-05 14:30:00. The Unix timestamp updates as soon as a complete valid date is entered."
      },
      {
        "step": "Read the results",
        "description": "Four cards show the value as local time (with your timezone name and offset), UTC time, an ISO 8601 string, and an HTTP date (RFC 2822)."
      },
      {
        "step": "Copy any result",
        "description": "Click the copy button on the card you need. For the current time, click Now — a live Unix time counter is also displayed."
      }
    ],
    "faq": [
      {
        "question": "What is a Unix timestamp?",
        "answer": "A Unix timestamp (also called Unix time or epoch time) is the number of seconds that have elapsed since January 1, 1970, 00:00:00 UTC. It's a simple, timezone-independent way to represent points in time."
      },
      {
        "question": "Why are some timestamps 13 digits instead of 10?",
        "answer": "10-digit timestamps represent seconds since the epoch. 13-digit timestamps represent milliseconds since the epoch. Millisecond timestamps are common in JavaScript (Date.now()) and some APIs. This tool auto-detects 13-digit values as milliseconds, and the checkbox lets you override that."
      },
      {
        "question": "Will the Year 2038 problem affect this tool?",
        "answer": "The Year 2038 problem affects systems that store times as signed 32-bit integers, which overflow on January 19, 2038. This tool uses JavaScript's double-precision arithmetic, which represents timestamps correctly up to about the year 275,760 — so dates far beyond 2038 convert here without issue."
      },
      {
        "question": "How is the 'Date & time (local)' field interpreted?",
        "answer": "Values are parsed strictly against the YYYY-MM-DD HH:MM:SS shape in your browser's local timezone. A date with no time, such as 2024-01-05, is treated as local midnight. This matches the local time shown in the results, so conversions round-trip consistently."
      }
    ],
    "relatedSlugs": [
      "json-formatter",
      "cron-parser",
      "http-status",
      "jwt-decoder",
      "uuid-generator"
    ]
  },
  "case-converter": {
    "longDescription": "<p>The BrainCoder Text Case Converter transforms text between different capitalization styles instantly. Whether you need UPPERSNAKE_CASE for constants, camelCase for JavaScript variables, PascalCase for class names, kebab-case for CSS classes, or Sentence case for readable text — this tool handles all common naming conventions and text formatting styles.</p>\n<p>Case conversion is essential for developers following naming conventions in different programming languages, content writers formatting headings and titles, data analysts normalizing text data, and anyone who needs to quickly reformat text. The tool processes your input in real time, showing all case variations simultaneously so you can pick the one you need.</p>\n<p>All conversion happens in your browser with no data transmitted. The tool also preserves or strips special characters based on the target case style, handles Unicode characters correctly, and provides one-click copy for each format.",
    "features": [
      "UPPERCASE, lowercase, and Sentence case",
      "camelCase and PascalCase for programming",
      "kebab-case and snake_case for file/URL names",
      "UPPER_SNAKE_CASE for constants",
      "Real-time conversion showing all formats at once",
      "Handles Unicode, accented characters, and emoji"
    ],
    "howTo": [
      {
        "step": "Enter your text",
        "description": "Type or paste any text into the input field. It can be a single word, a sentence, or a block of text in any original case."
      },
      {
        "step": "See all case options",
        "description": "The tool instantly displays your text converted to every supported case style — uppercase, lowercase, camelCase, PascalCase, kebab-case, snake_case, and more."
      },
      {
        "step": "Select the format you need",
        "description": "Browse the output options and find the exact case style required by your programming language, style guide, or data format."
      },
      {
        "step": "Copy the result",
        "description": "Click the copy button next to any case style to grab the formatted text for use in your code, document, or data."
      }
    ],
    "faq": [
      {
        "question": "What is camelCase?",
        "answer": "camelCase starts with a lowercase letter and capitalizes the first letter of each subsequent word. Examples: 'myVariableName', 'getElementById'. It's the standard naming convention for JavaScript variables and function names."
      },
      {
        "question": "What is the difference between camelCase and PascalCase?",
        "answer": "camelCase starts with a lowercase letter (myVariable), while PascalCase starts with an uppercase letter (MyVariable). PascalCase is used for class names in JavaScript/TypeScript and most object-oriented languages."
      },
      {
        "question": "Does this handle non-English characters?",
        "answer": "Yes. The converter handles accented characters (é, ñ, ü), Cyrillic, CJK characters, and other Unicode scripts correctly. Case conversion is applied using Unicode's case mapping rules."
      }
    ],
    "relatedSlugs": [
      "slug-generator",
      "text-repeater",
      "url-encoder"
    ]
  },
  "number-base": {
    "longDescription": "<p>The BrainCoder Number Base Converter transforms numbers between binary (base 2), octal (base 8), decimal (base 10), hexadecimal (base 16), and any custom base from 2 to 64. This is essential for programmers, computer scientists, and anyone working with different number systems.</p>\n<p>Understanding number bases is fundamental to computing. Binary represents data at the hardware level, hexadecimal provides a compact human-readable form of binary, and decimal is the base we use in everyday life. This tool converts between all of them instantly, showing all representations simultaneously so you can see how the same value appears in different bases.</p>\n<p>The converter also handles fractional numbers (like 3.14 in different bases), signed integers (two's complement), and large numbers. It displays the bit-length and provides grouping options for readability. All conversions happen locally in your browser — no data is transmitted.",
    "features": [
      "Convert between binary, octal, decimal, and hex",
      "Custom base support (2-64)",
      "Fractional number conversion",
      "Signed integer (two's complement) display",
      "Bit-length and grouping information",
      "All conversions client-side"
    ],
    "howTo": [
      {
        "step": "Enter a number",
        "description": "Type a number in any base — the tool auto-detects binary (0s and 1s), octal (0-7), decimal, or hex (0-9, A-F) based on the input."
      },
      {
        "step": "Select source base if needed",
        "description": "If the auto-detection is incorrect, manually select the base your number is in using the base selector."
      },
      {
        "step": "View all representations",
        "description": "The tool instantly shows your number in binary, octal, decimal, hexadecimal, and any custom base you specify."
      },
      {
        "step": "Copy any representation",
        "description": "Click the copy button next to any base representation to grab it for use in your code, calculations, or documentation."
      }
    ],
    "faq": [
      {
        "question": "Why do programmers use hexadecimal?",
        "answer": "Hexadecimal (base 16) provides a compact representation of binary data. Each hex digit represents exactly 4 bits, making it easy to convert between hex and binary. 'FF' in hex is '11111111' in binary — much shorter to read and write."
      },
      {
        "question": "What is two's complement?",
        "answer": "Two's complement is the standard way to represent negative integers in binary. To negate a number, you flip all bits and add 1. For example, -1 in 8-bit two's complement is 11111111. This tool can show signed representations."
      },
      {
        "question": "Can I convert fractional numbers?",
        "answer": "Yes. Enter a decimal number with a fractional part (like 3.14) and see how it's represented in binary, hex, and other bases. Note that some fractions that are exact in decimal become repeating fractions in binary (like 0.1)."
      }
    ],
    "relatedSlugs": [
      "binary-text",
      "utf8-converter",
      "hash-generator"
    ]
  },
  "slug-generator": {
    "longDescription": "<p>The BrainCoder URL Slug Generator converts any text into a clean, URL-friendly slug. Slugs are the human-readable part of a URL — for example, \"my-blog-post-title\" from \"My Blog Post Title: A Complete Guide\". They're essential for SEO, readability, and creating permanent links that don't break when content is updated.</p>\n<p>A good slug is lowercase, uses hyphens instead of spaces, strips special characters, and optionally removes common stop words for cleaner URLs. Our generator handles all of these transformations automatically, with options to customize the behavior. It supports transliteration for non-Latin scripts (e.g., converting Cyrillic or CJK characters to their Latin equivalents) and can truncate long slugs to a specified length.</p>\n<p>This tool is invaluable for bloggers, CMS administrators, SEO specialists, and web developers. Generate slugs for blog posts, product pages, documentation sections, or any content that needs a clean URL. All processing happens in your browser — no text is sent to any server.",
    "features": [
      "Converts any text to URL-friendly slugs",
      "Lowercase, hyphen-separated, no special characters",
      "Optional stop word removal (a, the, and, etc.)",
      "Configurable maximum slug length",
      "Transliteration for non-Latin characters",
      "One-click copy for the generated slug"
    ],
    "howTo": [
      {
        "step": "Enter your text",
        "description": "Type or paste the title, heading, or phrase you want to convert into a URL slug."
      },
      {
        "step": "Configure options",
        "description": "Toggle stop word removal, set maximum length, and choose whether to transliterate non-Latin characters to ASCII."
      },
      {
        "step": "Generate the slug",
        "description": "The tool instantly converts your text to a clean, lowercase, hyphen-separated slug that's ready for use in a URL."
      },
      {
        "step": "Copy and use",
        "description": "Click the copy button to grab the slug and use it in your CMS, router configuration, or file name."
      }
    ],
    "faq": [
      {
        "question": "What is a URL slug?",
        "answer": "A URL slug is the readable part of a URL that identifies a specific page. For example, in https://example.com/blog/my-post, 'my-post' is the slug. Good slugs are short, descriptive, and keyword-rich for SEO."
      },
      {
        "question": "Should I remove stop words from slugs?",
        "answer": "It depends. Removing stop words (a, the, is, in) makes slugs shorter and cleaner, which is better for SEO. However, sometimes stop words are needed for clarity — 'man-eating-shark' reads differently from 'man-eating-shark' vs 'man-eating-shark'."
      },
      {
        "question": "How long should a URL slug be?",
        "answer": "Keep slugs under 5-6 words (about 50-60 characters) for optimal SEO. Google displays about 50-60 characters of a URL in search results. Shorter slugs are also easier to share and remember."
      }
    ],
    "relatedSlugs": [
      "url-encoder",
      "case-converter",
      "text-repeater"
    ]
  },
  "text-repeater": {
    "longDescription": "<p>The BrainCoder Text Repeater takes any text string and repeats it a specified number of times with configurable separators. Need \"hello\" repeated 100 times? Want to generate a line of dashes 50 characters long? Or create a pattern of repeated phrases for testing? This tool handles it all instantly.</p>\n<p>Text repetition is surprisingly useful in development and content creation. Developers use it for generating test data, filling databases with sample records, creating placeholder content, testing string handling code, and building visual patterns. Content creators use it for decorative elements, dividers, and formatted text blocks.</p>\n<p>Configure the text to repeat, the number of repetitions, and the separator (newlines, spaces, commas, or custom characters). The tool displays the output length and character count so you know exactly how much text you're generating. Everything happens in your browser — no data is stored or transmitted.",
    "features": [
      "Repeat text N times with configurable count",
      "Custom separators: newline, space, comma, or custom",
      "Preview of output with character/line count",
      "Generate lines of repeated characters",
      "One-click copy for generated output",
      "Client-side processing — no data uploads"
    ],
    "howTo": [
      {
        "step": "Enter the text to repeat",
        "description": "Type or paste the text string you want to repeat. This could be a word, a phrase, a symbol, or any text."
      },
      {
        "step": "Set repetition count",
        "description": "Enter how many times you want the text repeated using the number input or slider."
      },
      {
        "step": "Choose separator",
        "description": "Select how repeated instances should be separated: newlines, spaces, commas, or a custom separator string."
      },
      {
        "step": "Copy the result",
        "description": "Click the copy button to grab the repeated text output for use in your project, test data, or content."
      }
    ],
    "faq": [
      {
        "question": "Is there a limit to how many times I can repeat text?",
        "answer": "The practical limit depends on your browser's memory, but you can repeat text thousands of times without issues. The tool displays the total character count so you can monitor output size."
      },
      {
        "question": "Can I use this to generate test data?",
        "answer": "Yes. Repeating text is a quick way to generate large volumes of test data for database insertion, load testing, string handling tests, or UI stress testing."
      },
      {
        "question": "Can I repeat multiple lines at once?",
        "answer": "Currently, the tool repeats a single text string. For multi-line patterns, generate each line separately or use the tool in combination with other text processing."
      }
    ],
    "relatedSlugs": [
      "text-repeater",
      "lorem-ipsum",
      "case-converter"
    ]
  },
  "json-formatter": {
    "longDescription": "<p>The JSON Formatter is a free, client-side utility for formatting, validating, and minifying JSON directly in your browser. Paste any raw or minified JSON and it is indented instantly as you type, so you can read API responses, configuration files, and log dumps without leaving the page.</p><p>Every keystroke is validated live: valid input shows a green badge, and invalid input shows a red badge with an error message pointing to the line and column where parsing stopped. Format with 2 or 4 space indentation, then copy either the readable version or a compact minified payload with one click.</p><p>All processing runs in your browser with zero server round-trips, so sensitive data — API keys, tokens, personal records — never leaves your machine. The tool also works offline once the app has loaded.</p>",
    "features": [
      "Real-time JSON formatting with 2 or 4 space indentation",
      "Live Valid JSON / Invalid JSON badge on every keystroke",
      "Parse errors report the line and column where parsing stopped",
      "One-click copy of the formatted output or the minified version",
      "Full client-side processing — JSON never leaves your browser",
      "Works offline after the app has loaded once, with no signup required"
    ],
    "howTo": [
      {
        "step": "Paste Your JSON",
        "description": "Copy raw or minified JSON from your clipboard, terminal, or an API response and paste it into the input area. Formatting starts as you type."
      },
      {
        "step": "Auto-Format",
        "description": "The tool indents the JSON automatically. Choose 2 or 4 spaces with the buttons above the input."
      },
      {
        "step": "Check Validity",
        "description": "A green badge confirms valid JSON. Invalid input shows a red badge and an error message with the line and column where parsing stopped."
      },
      {
        "step": "Copy or Minify",
        "description": "Copy the formatted output with Copy formatted, or grab the compact minified payload with Copy minified below the results."
      }
    ],
    "faq": [
      {
        "question": "Is my data sent to a server when I format JSON?",
        "answer": "No. The entire formatting process runs in JavaScript on your device. Your data is never transmitted — so it is safe for API keys, tokens, and personal information."
      },
      {
        "question": "How are parse errors reported?",
        "answer": "Invalid input shows a red badge and an error message. When the browser reports a position, the tool converts it to the line and column where parsing stopped so you can find the problem quickly."
      },
      {
        "question": "Will formatting change my data?",
        "answer": "Layout only. Indentation and whitespace are normalized, numbers may be reformatted (for example 1e2 becomes 100), integers beyond 2^53 may lose precision, and duplicate keys keep the last value. Nothing is added or removed beyond that."
      },
      {
        "question": "Can I use this tool offline?",
        "answer": "Yes. Once the page has loaded, the tool works offline with no server dependencies."
      }
    ],
    "relatedSlugs": [
      "json-viewer",
      "json-to-typescript",
      "json-xml",
      "json-yaml",
      "xml-formatter"
    ]
  },
  "regex-tester": {
    "longDescription": "<p>The Regex Tester is a live environment for writing and debugging JavaScript regular expressions. As you type, it highlights every match directly in your test text and lists match details, capture groups, and index positions instantly — no test button, no round trips.</p><p>It runs the full JavaScript (ECMAScript) regex engine, including named capturing groups, lookahead and lookbehind assertions, the dotAll (s), unicode (u), and indices (d) flags, and Unicode property escapes like \\p{L}. Catastrophic-backtracking patterns — the kind that can bring a regex engine to its knees — are detected and paused behind an explicit confirmation, so the tool never freezes your browser without warning.</p><p>Flag toggles, a quick-reference panel for common tokens, and per-match capture group breakdowns make it easy to debug even the most tangled patterns. Everything stays in your browser — patterns and test strings are never sent to a server.</p>",
    "features": [
      "Live match highlighting as you type the pattern",
      "Full JavaScript regex engine with all flags (g, i, m, s, u, d, y)",
      "Numbered and named capture group results with index positions",
      "Supports lookahead, lookbehind, Unicode properties, and advanced constructs",
      "Client-side only — patterns and test strings never leave your browser",
      "Quick-reference panel for common regex tokens and shortcuts",
      "Catastrophic-backtracking guard that pauses suspicious patterns before they can freeze the page"
    ],
    "howTo": [
      {
        "step": "Enter Your Regex Pattern",
        "description": "Type your regular expression into the pattern field. Surrounding slashes are optional — add them only if you prefer, and the pattern inside is used automatically."
      },
      {
        "step": "Set Flags",
        "description": "Toggle flags with the checkboxes: global (g), case-insensitive (i), multiline (m), dotAll (s), unicode (u), indices (d), and sticky (y)."
      },
      {
        "step": "Provide Test Input",
        "description": "Paste or type your test string into the input area. Matches are highlighted live as you type."
      },
      {
        "step": "Review Match Details",
        "description": "Inspect the match results table for full match text, numbered or named capture groups, and character index positions. Use the token quick-reference panel to look up any syntax you need."
      }
    ],
    "faq": [
      {
        "question": "Which regex flavor does this tool support?",
        "answer": "It uses the full JavaScript (ECMAScript) regex engine, including modern features like named groups, lookbehind assertions, the dotAll flag, and Unicode property escapes."
      },
      {
        "question": "Can I use this to test patterns for other languages?",
        "answer": "JavaScript regex is very similar to PCRE and Python's re module. Most patterns transfer directly, though a few edges differ — for example, backreferences inside lookbehind are unsupported and some atomic-like constructs don't exist."
      },
      {
        "question": "What happens if my pattern is very slow to evaluate?",
        "answer": "Patterns with nested or repeated quantifiers — like (a+)+ against a long failing string — are detected up front and paused behind an explicit \"run anyway\" confirmation instead of freezing the page. You can still run them, but only after acknowledging the risk."
      },
      {
        "question": "Is my regex or input data stored anywhere?",
        "answer": "No. All processing is client-side. Nothing is transmitted to or stored on any server."
      }
    ],
    "relatedSlugs": [
      "text-cleaner",
      "text-lines",
      "word-counter",
      "html-entities",
      "checksum-calculator"
    ]
  },
  "markdown-preview": {
    "longDescription": "<p>The Markdown Preview tool is a dual-pane editor that renders your Markdown to HTML the moment you type it. Keep the source on the left, see the rendered result on the right — a fast way to compose README files, documentation, blog posts and changelogs without switching between an editor and a browser tab.</p><p>It ships with the core CommonMark specification plus GitHub Flavored Markdown extensions: tables, task lists, strikethrough, automatic links and fenced code blocks with language labels. Because the rendered output is sanitized before display, pasting raw HTML into your document can't run scripts — event handlers, embedded media and unsafe URLs are stripped.</p><p>Your draft is auto-saved to this browser's local storage, so reopening the page picks up where you left off. Copy the rendered HTML, download it as a standalone file, or keep writing — everything stays on your device, and nothing is ever uploaded.</p>",
    "features": [
      "Live split-pane preview that updates as you type",
      "CommonMark plus GitHub Flavored Markdown: tables, task lists, strikethrough, auto links and fenced code blocks",
      "Rendered HTML is sanitized — pasted scripts and event handlers are stripped",
      "Copy the HTML or download it as a standalone .html file",
      "Drafts auto-saved in your browser across sessions",
      "Character, word and reading-time counts — zero uploads"
    ],
    "howTo": [
      {
        "step": "Write Markdown",
        "description": "Type in the left editor using standard Markdown syntax — headings, lists, links, images, code fences and more."
      },
      {
        "step": "Watch it render",
        "description": "The right pane updates live. Tables, task lists and strikethrough use GitHub Flavored Markdown semantics."
      },
      {
        "step": "Keep or restore your draft",
        "description": "Your document is auto-saved locally. Use Clear to start fresh, or Reset sample to reload the example."
      },
      {
        "step": "Copy or download",
        "description": "Copy the rendered HTML to the clipboard, or download it as a standalone HTML file."
      }
    ],
    "faq": [
      {
        "question": "Which Markdown features are supported?",
        "answer": "CommonMark plus GitHub Flavored Markdown: tables, task lists, strikethrough, automatic links and fenced code blocks with language labels. Footnotes are not included."
      },
      {
        "question": "Can I paste raw HTML?",
        "answer": "Yes — inline HTML is rendered as HTML. For safety, the output is sanitized first: scripts, event handlers, and unsafe URLs are stripped, and disallowed tags like iframe or embed are removed."
      },
      {
        "question": "Are my drafts saved between sessions?",
        "answer": "Yes. The editor auto-saves your draft to this browser's local storage. Nothing is uploaded — the data stays in your browser."
      },
      {
        "question": "Can I export the rendered output?",
        "answer": "Yes. Copy the rendered HTML to your clipboard, or download it as a standalone .html file with built-in styles."
      }
    ],
    "relatedSlugs": [
      "md-to-html",
      "html-markdown",
      "html-formatter",
      "html-minifier",
      "json-formatter"
    ]
  },
  "html-minifier": {
    "longDescription": "<p>The HTML Minifier shrinks HTML by removing comments and collapsing whitespace that browsers ignore, producing a smaller file without touching the content that matters. Whitespace inside <code>&lt;pre&gt;</code> and <code>&lt;textarea&gt;</code> is preserved, JavaScript and CSS inside <code>&lt;script&gt;</code> and <code>&lt;style&gt;</code> passes through untouched, and values inside attributes are never rewritten — so minifying real-world markup stays safe.</p><p>Switch to pretty-print mode to reformat messy markup into clean indented structure, keep conditional comments like <code>&lt;!--[if IE]&gt;</code> when you need them, open a local .html file to process, and download the result when you're done. The header shows exact sizes in bytes and characters with the savings percentage, so you can see what you actually gained.</p><p>All processing happens in your browser with zero server uploads. Sensitive HTML containing API keys or internal URLs never leaves your machine.</p>",
    "features": [
      "Removes comments and collapses non-essential whitespace in one pass",
      "Preserves whitespace in pre, textarea, script and style, plus quoted attribute values",
      "Option to keep conditional comments (e.g. <!--[if IE]>)",
      "Pretty-print mode reformats messy markup into indented structure",
      "Live byte and character sizes with savings percentage",
      "Open local .html files and download the result — fully client-side"
    ],
    "howTo": [
      {
        "step": "Paste or open HTML",
        "description": "Paste markup into the editor, or use Open .html to load a local file into the tool."
      },
      {
        "step": "Choose Minify or Pretty-print",
        "description": "Minify strips comments and collapses non-essential whitespace. Pretty-print reindents the markup instead."
      },
      {
        "step": "Keep conditional comments (optional)",
        "description": "In Minify mode, tick Keep conditional comments to preserve constructs like <!--[if IE]>...<![endif]-->."
      },
      {
        "step": "Copy or download",
        "description": "Copy the result to your clipboard, or download it as a .html file."
      }
    ],
    "faq": [
      {
        "question": "Will minification break my HTML?",
        "answer": "No. The tool only removes whitespace and comments that the browser already collapses: text inside pre and textarea is preserved, script and style content is preserved, and quoted attribute values are never rewritten."
      },
      {
        "question": "Does it strip attributes or rewrite tags?",
        "answer": "No. Unlike aggressive minifiers, this tool never removes or renames attributes, shortens boolean attributes, or collapses optional tags. It only removes comments and non-essential whitespace."
      },
      {
        "question": "Can I keep some comments?",
        "answer": "Yes. Enable Keep conditional comments to preserve conditional comments such as <!--[if IE]>. Standard HTML comments are removed."
      },
      {
        "question": "How much can I save?",
        "answer": "It depends on how much whitespace and how many comments your source contains. The tool shows the exact byte and character savings, so you can measure your actual file rather than rely on a rule of thumb."
      }
    ],
    "relatedSlugs": [
      "html-formatter",
      "css-formatter",
      "javascript-formatter",
      "svg-formatter",
      "markdown-preview"
    ]
  },
  "jwt-decoder": {
    "longDescription": "<p>The JWT Decoder splits a JSON Web Token into its dot-separated segments and shows you exactly what is there: which segments decoded, which did not, and why. The header and payload are decoded with a real base64url decoder — the URL-safe alphabet, no <code>=</code> padding, and a character outside the alphabet is named with its position instead of being quietly dropped — then parsed as JSON. Anything that is not a signed compact token is refused with a reason instead of half-decoded.</p><p>Claims are listed with their real values. <code>exp</code>, <code>nbf</code>, <code>iat</code> and <code>auth_time</code> are NumericDate seconds, so each one is shown as an absolute UTC date and time and as a reading you can act on: expires in 2 hours, expired 3 days ago, not valid for another 30 minutes. Registered claims that are missing are listed as missing rather than implied. The header, the payload and the raw token each have their own copy button, and a payload that is a JSON array or a scalar is shown as what it is rather than treated as a broken object.</p><p><strong>Decoded, not verified.</strong> This page has no key, no issuer and no way to check a signature, so it never tells you whether a token is authentic or whether a claim is true. It does not fetch a JWKS endpoint, and it makes no network request of any kind: the token is read in the tab and never leaves it. Treat every claim as untrusted data. Input is capped at 262,144 characters (256 KB) and anything larger is refused before a single byte is decoded.</p>",
    "features": [
      "Decoded, not verified: the signature is never checked and no key, issuer or JWKS endpoint is contacted",
      "Real base64url handling — URL-safe alphabet, missing padding tolerated, and a character outside the alphabet refused with its exact position",
      "Structure report naming every dot-separated segment, its encoded length, its decoded byte length and whether it decoded",
      "Non-JWT input refused with a reason: wrong segment count, a five-segment JWE, an empty header, a payload that is not JSON",
      "exp, nbf, iat and auth_time rendered as absolute UTC dates plus \"expires in\" / \"expired\" readings that keep counting",
      "Registered claims (iss, sub, aud, exp, nbf, iat, jti) surfaced first, with the missing ones listed as missing",
      "Payloads that are a JSON array or a scalar are decoded and described instead of treated as a broken claims object",
      "Separate copy buttons for the raw token, the decoded header and the decoded payload",
      "262,144 character (256 KB) input cap, refused before any decoding work happens",
      "No network request is ever made — the token is decoded in the tab and never uploaded"
    ],
    "howTo": [
      {
        "step": "Paste the token",
        "description": "Paste a JWT you are entitled to read. A leading \"Bearer \" and surrounding whitespace are removed and reported; anything above 262,144 characters is refused before it is decoded."
      },
      {
        "step": "Read the structure report",
        "description": "Each dot-separated segment is listed with its encoded length, its decoded byte length and whether it decoded. A token that is not a signed compact JWT is refused here with the reason, not half-decoded."
      },
      {
        "step": "Read the claims and their dates",
        "description": "Registered claims come first. exp, nbf, iat and auth_time show an absolute UTC date and time plus a live reading — expires in 2 hours, expired 3 days ago, not valid for another 30 minutes. Claims that are not present are listed as not present."
      },
      {
        "step": "Copy what you need, and remember what this did not do",
        "description": "Copy the raw token, the decoded header or the decoded payload. Nothing was verified: a decoded token proves only that someone wrote those claims, never that they are true. To validate a token, present it to the service that issued it."
      }
    ],
    "faq": [
      {
        "question": "Does this tool verify the JWT signature?",
        "answer": "No, and it cannot. There is no secret, no public key, no issuer and no JWKS endpoint here, so no HMAC or RSA signature is ever computed or checked. This page decodes: the header and payload of a signed JWT are readable by anyone who holds the token. Decoded, not verified."
      },
      {
        "question": "Is it safe to paste a token here?",
        "answer": "The token is decoded in your browser and no request is made with it — there is no upload and no third-party call. That is a statement about this page only: a JWT is a credential, so treat yours as a password and do not paste a token you found in a log, a screenshot or someone else's session into anything that might store it."
      },
      {
        "question": "What formats are supported?",
        "answer": "The signed compact form (JWS): exactly three base64url segments, for any algorithm — HS*, RS*, ES*, PS*, EdDSA and unsecured \"none\" alike, since the algorithm is only ever read, never used. A five-segment JWE is an encrypted token and is refused with a reason: decoding cannot read it without the decryption key."
      },
      {
        "question": "Why was my token refused instead of decoded?",
        "answer": "Almost always one specific thing, and the message says which: a character outside the base64url alphabet (standard Base64 \"+\" and \"/\", or \"=\" padding, are named with their position), a segment count that is not three, a header that is not a JSON object (RFC 7515 requires one), or a segment that decodes to bytes that are not valid UTF-8 or not valid JSON. Nothing is guessed and nothing is half-decoded."
      },
      {
        "question": "What does the decoded payload actually prove?",
        "answer": "Only that someone wrote those claims. Every field is attacker-controlled: anyone can mint a token that says \"admin\": true. Expiry shown here is what the token claims about itself, which is not the same as a server accepting it. Trust decisions belong to the service that verifies the signature."
      },
      {
        "question": "Can the payload be something other than an object?",
        "answer": "Yes. RFC 7519 does not require the payload to be a JSON object, so a payload that is an array or a scalar is decoded and shown as exactly what it is, with a note that it has no named claims to read dates out of. Only the header is required to be an object."
      }
    ],
    "relatedSlugs": [
      "json-formatter",
      "url-parser",
      "base64",
      "http-status",
      "json-viewer"
    ]
  },
  "json-to-typescript": {
    "longDescription": "<p>The JSON to TypeScript Interface converter automatically generates strongly-typed TypeScript interface definitions from any JSON structure. Instead of manually writing interface files for API responses, configuration objects, or database records, paste your JSON and get production-ready TypeScript code with proper nesting, optional markers, union types, and JSDoc-ready comments in seconds.</p><p>The converter intelligently infers types from actual values — strings become string, numbers become number, booleans become boolean, arrays derive their element type, and nested objects become sub-interfaces with proper naming. When a field has multiple types across array elements or is null, the tool generates accurate union types (string | number) or optional (?) modifiers, ensuring your generated types are correct on the first pass.</p><p>Whether you're scaffolding types for a new API integration, generating configuration schemas, or building a type-safe layer over an existing REST API, this tool eliminates hours of manual type definition work. All processing is client-side, so proprietary JSON payloads never leave your browser.</p>",
    "features": [
      "Automatic interface generation with proper nesting and naming conventions",
      "Intelligent type inference: string, number, boolean, null, arrays, and unions",
      "Optional (?) field markers for nullable or missing properties",
      "Array element type detection with proper generic syntax",
      "Configurable output: interfaces vs types, export keywords, naming style",
      "Entirely client-side — no JSON data transmitted to external servers"
    ],
    "howTo": [
      {
        "step": "Paste JSON Data",
        "description": "Insert your JSON object, array, or API response into the input area."
      },
      {
        "step": "Generate Interfaces",
        "description": "Click convert to produce TypeScript interface definitions with properly inferred types and nesting."
      },
      {
        "step": "Configure Output",
        "description": "Toggle options like export keyword, interface vs type alias, and prefix/suffix for generated names."
      },
      {
        "step": "Copy to Clipboard",
        "description": "One-click copy the generated TypeScript code to paste directly into your .ts files."
      }
    ],
    "faq": [
      {
        "question": "Does it handle nested objects?",
        "answer": "Yes. Deeply nested JSON objects generate a hierarchy of named interfaces, with proper references between them."
      },
      {
        "question": "What if a field has multiple possible types?",
        "answer": "The tool generates TypeScript union types (e.g., string | number) for fields that contain different types across array elements or have null values."
      },
      {
        "question": "Can I generate type aliases instead of interfaces?",
        "answer": "Yes. There's an option to output type aliases instead of interface declarations, depending on your project's conventions."
      }
    ],
    "relatedSlugs": [
      "json-formatter",
      "json-viewer",
      "json-xml",
      "json-yaml",
      "toml-json"
    ]
  },
  "sql-formatter": {
    "longDescription": "<p>The SQL Formatter is a precision code beautifier that takes messy, minified, or inconsistently formatted SQL queries and transforms them into clean, readable, properly indented code. It supports all major SQL dialects — PostgreSQL, MySQL, SQL Server, Oracle, and SQLite — correctly handling dialect-specific syntax like backtick quoting, bracket identifiers, and proprietary functions.</p><p>Paste a long query from a log file, a tool output, or ORM-generated code and the formatter applies consistent capitalization of keywords, logical indentation of JOIN and subquery clauses, aligned comma-separated lists, and proper line breaks. The result is SQL that any team member can read and understand in seconds, reducing code review friction and debugging time.</p><p>The formatter runs entirely in your browser, which is especially important when working with production SQL that may contain table names, column names, or data samples that are sensitive. No query content is ever sent to an external server.</p>",
    "features": [
      "Support for PostgreSQL, MySQL, SQL Server, Oracle, and SQLite dialects",
      "Consistent keyword capitalization (upper, lower, or preserved)",
      "Proper indentation of JOINs, subqueries, CTEs, and CASE expressions",
      "Comma-aligned column lists for improved readability",
      "One-click copy to clipboard for pasting into your editor or IDE",
      "Fully client-side processing with zero server transmission"
    ],
    "howTo": [
      {
        "step": "Paste SQL Query",
        "description": "Insert your minified, log-exported, or ORM-generated SQL into the input area."
      },
      {
        "step": "Select Dialect",
        "description": "Choose your target SQL dialect to ensure correct handling of dialect-specific syntax and quoting."
      },
      {
        "step": "Format",
        "description": "The query is instantly beautified with consistent casing, indentation, and line breaks."
      },
      {
        "step": "Copy Output",
        "description": "Use the copy button to grab the formatted SQL for use in your editor, migration files, or documentation."
      }
    ],
    "faq": [
      {
        "question": "Which SQL dialects are supported?",
        "answer": "PostgreSQL, MySQL, SQL Server, Oracle, and SQLite. Each dialect handles its specific syntax quirks like identifier quoting and proprietary functions correctly."
      },
      {
        "question": "Does it handle complex queries with CTEs and subqueries?",
        "answer": "Yes. Common Table Expressions, nested subqueries, correlated subqueries, and complex JOIN chains are all formatted with proper indentation."
      },
      {
        "question": "Is my query data sent to a server?",
        "answer": "No. All SQL formatting happens in your browser. Query text, table names, and column names never leave your device."
      }
    ],
    "relatedSlugs": [
      "json-formatter",
      "csv-formatter",
      "xml-formatter",
      "sqlite-viewer",
      "csv-to-sql"
    ]
  },
  "xml-formatter": {
    "longDescription": "<p>The XML Formatter transforms unstructured, minified, or inconsistently indented XML documents into clean, properly structured, human-readable markup. Whether you're working with SOAP responses, SVG files, configuration manifests (Maven pom.xml, Android layouts), or data interchange feeds, this tool applies consistent indentation, corrects self-closing tags, and normalizes attribute formatting for maximum readability.</p><p>The formatter handles all XML constructs correctly: processing instructions, CDATA sections, namespaces with prefix declarations, comments, and mixed content nodes. It validates the XML structure simultaneously, catching unclosed tags, mismatched namespace prefixes, and malformed entities with precise error reporting that pinpoints the exact location of the issue.</p><p>XML documents frequently contain business-critical data, internal system identifiers, and proprietary schemas. This tool processes everything in the browser with zero network transmission, ensuring your XML content remains private and secure at all times.</p>",
    "features": [
      "Configurable indentation (tabs or 2/4/8-space widths)",
      "Proper handling of namespaces, CDATA, processing instructions, and comments",
      "Self-closing tag normalization and attribute formatting",
      "Real-time XML validation with precise error location reporting",
      "Minification mode for producing compact XML output",
      "Full client-side processing — XML content never leaves your browser"
    ],
    "howTo": [
      {
        "step": "Paste XML Content",
        "description": "Insert your raw, minified, or malformed XML into the editor area."
      },
      {
        "step": "Configure Formatting",
        "description": "Set your preferred indentation width (spaces or tabs), and whether to preserve or strip comments."
      },
      {
        "step": "Format or Validate",
        "description": "Click format to beautify the XML. If there's a parse error, the tool highlights the exact position."
      },
      {
        "step": "Copy or Download",
        "description": "Copy the formatted XML to clipboard or download it as a properly encoded .xml file."
      }
    ],
    "faq": [
      {
        "question": "Does it support XML namespaces?",
        "answer": "Yes. The formatter correctly handles namespace declarations, prefixed elements, and default namespaces without altering or stripping them."
      },
      {
        "question": "Can I validate XML while formatting?",
        "answer": "Yes. The tool validates the XML structure and reports the exact line and column of any parse errors, making debugging fast."
      },
      {
        "question": "Does it handle SOAP and SVG XML?",
        "answer": "Yes. Any well-formed XML document — including SOAP envelopes, SVG graphics, and configuration files — is formatted correctly."
      }
    ],
    "relatedSlugs": [
      "json-xml",
      "html-formatter",
      "svg-formatter",
      "json-formatter",
      "csv-formatter"
    ]
  },
  "cron-parser": {
    "longDescription": "<p>The Cron Expression Parser is a developer and sysadmin essential that takes a cron expression and produces a human-readable explanation of exactly when the job will run — including the next 5 scheduled execution times. It bridges the gap between cryptic five-field cron syntax and the practical understanding you need to verify that a scheduled task will fire at the intended moments.</p><p>Supporting standard 5-field cron (minute, hour, day-of-month, month, day-of-week), extended 6-field cron with seconds, and special expressions like @yearly, @monthly, @weekly, @daily, and @hourly, the parser correctly interprets ranges (1-5), steps (*/5, 1-10/2), lists (1,3,5), and named day/month abbreviations. It handles edge cases like February 30th gracefully, reporting invalid expressions clearly.</p><p>For DevOps engineers, SREs, and backend developers managing cron jobs across servers, this tool eliminates the need to mentally decode expressions or install CLI utilities. Everything runs client-side — your cron schedules and server configuration details stay on your machine.</p>",
    "features": [
      "Standard 5-field and extended 6-field (with seconds) cron parsing",
      "Special expressions: @yearly, @monthly, @weekly, @daily, @hourly",
      "Support for ranges, steps, lists, and named day/month abbreviations",
      "Next 5 execution times computed from the current moment",
      "Clear human-readable description of each cron field",
      "Client-side processing with zero server calls"
    ],
    "howTo": [
      {
        "step": "Enter Cron Expression",
        "description": "Type or paste your cron expression (e.g., 0 2 * * 1-5 or @weekly) into the input field."
      },
      {
        "step": "View Description",
        "description": "The tool instantly shows a plain-English description of what the expression means in each field."
      },
      {
        "step": "See Next Executions",
        "description": "A list of the next 5 dates and times the cron job will run is displayed, computed from the current time."
      },
      {
        "step": "Fix Invalid Expressions",
        "description": "If the expression is syntactically invalid, a clear error message explains what's wrong and suggests a correction."
      }
    ],
    "faq": [
      {
        "question": "Does it support seconds in cron expressions?",
        "answer": "Yes. Standard 5-field cron and extended 6-field cron with a leading seconds field are both supported."
      },
      {
        "question": "How are the next execution times calculated?",
        "answer": "The tool uses the current browser time as the starting point and computes the next 5 future execution moments based on the cron expression."
      },
      {
        "question": "What happens with invalid cron expressions?",
        "answer": "The parser detects syntax errors and displays a clear message identifying the problem field and suggesting how to fix it."
      }
    ],
    "relatedSlugs": [
      "http-status",
      "chmod-calculator",
      "url-parser",
      "bitwise-calculator",
      "ipv4-converter"
    ]
  },
  "chmod-calculator": {
    "longDescription": "<p>The chmod Permission Calculator is an indispensable utility for Linux, macOS, and Unix developers who need to convert between symbolic permission notation (rwxr-xr-x) and numeric octal notation (755) quickly and accurately. It eliminates the mental math and potential errors when setting file and directory permissions via the command line, preventing the common mistakes that lead to \"permission denied\" errors or dangerous over-permissioning.</p><p>Select individual permissions (read, write, execute) for owner, group, and others by clicking toggle buttons, and see both the symbolic string and octal number update in real time. The tool also provides the exact chmod command to apply, handles special modes like setuid, setgid, and sticky bit, and shows recommended permission values for common use cases like web server directories, SSH keys, and configuration files.</p><p>This is a pure calculator with no server interaction. Your file paths and server configuration details remain entirely on your machine — critical for security teams auditing permissions in sensitive environments.</p>",
    "features": [
      "Interactive permission grid with clickable read/write/execute toggles",
      "Real-time symbolic (rwxr-xr-x) and octal (755) notation output",
      "setuid, setgid, and sticky bit support with warnings for dangerous combinations",
      "Ready-to-copy chmod command generated automatically",
      "Recommended permissions for common scenarios (web roots, SSH keys, cron files)",
      "Client-side only — no permission data transmitted anywhere"
    ],
    "howTo": [
      {
        "step": "Toggle Permissions",
        "description": "Click the read, write, and execute boxes for owner, group, and others to set the desired permissions."
      },
      {
        "step": "View Octal and Symbolic",
        "description": "The numeric octal value (e.g., 755) and symbolic string (e.g., rwxr-xr-x) update instantly as you change selections."
      },
      {
        "step": "Review Special Bits",
        "description": "Optionally enable setuid, setgid, or sticky bit, with contextual warnings about security implications."
      },
      {
        "step": "Copy the Command",
        "description": "Click copy to get the ready-to-paste chmod command (e.g., chmod 755 script.sh) for your terminal."
      }
    ],
    "faq": [
      {
        "question": "What is the difference between symbolic and octal chmod notation?",
        "answer": "Symbolic notation uses letters (rwx) to describe permissions per category. Octal uses numbers (0-7) where each digit is a sum of read (4), write (2), and execute (1)."
      },
      {
        "question": "Should I be careful with setuid and setgid?",
        "answer": "Yes. setuid and setgid on executables grant elevated privileges. The tool warns you when these bits are enabled to prevent accidental security risks."
      },
      {
        "question": "Does it support recursive chmod commands?",
        "answer": "The tool generates the chmod command with your selected permissions. You can add -R for recursive application yourself, but the calculator focuses on per-file permission values."
      }
    ],
    "relatedSlugs": [
      "cron-parser",
      "http-status",
      "bitwise-calculator",
      "cidr-calculator",
      "ipv4-converter"
    ]
  },
  "px-rem": {
    "longDescription": "<p>The px to rem Converter is a precision front-end development utility that instantly converts between pixels (px) and rem units with configurable root font-size support. It's essential for responsive CSS development where rem-based sizing is required for accessibility compliance (WCAG), consistent scaling across user font preferences, and maintaining design system proportions across breakpoints.</p><p>Enter any pixel value and get the equivalent in rem, or enter a rem value to get the pixel equivalent — all calculated against your project's root font-size (defaulting to 16px, the browser standard). The tool also supports em units, calculates viewport-relative conversions, and handles fractional values with precision, so you never have to rely on imprecise mental math or wait for your CSS preprocessor to recompile.</p><p>For design-to-development handoff, this converter bridges the gap between design tools that output pixels and production CSS that requires relative units. All calculations are instant and client-side, with no uploads of your design specifications or CSS files.</p>",
    "features": [
      "Bidirectional px ↔ rem conversion with configurable root font-size",
      "Support for em, vw, vh, and other CSS unit conversions",
      "Fractional value precision (e.g., 14.5px → 0.90625rem)",
      "Batch conversion mode for multiple values at once",
      "Quick-copy individual results or entire conversion tables",
      "Client-side calculations — no data transmitted"
    ],
    "howTo": [
      {
        "step": "Set Root Font Size",
        "description": "Enter your project's root font-size (default is 16px). This is the base value all rem calculations use."
      },
      {
        "step": "Enter Pixel Value",
        "description": "Type any pixel value to instantly see the rem equivalent, or enter a rem value to convert the other direction."
      },
      {
        "step": "Batch Convert",
        "description": "Switch to batch mode and paste multiple pixel values (one per line or comma-separated) to convert them all at once."
      },
      {
        "step": "Copy Results",
        "description": "Click copy on any individual result or the entire batch table to paste directly into your CSS."
      }
    ],
    "faq": [
      {
        "question": "Why use rem instead of pixels?",
        "answer": "Rem units scale relative to the root font-size, which improves accessibility (users can change their browser's base font size) and makes responsive design more maintainable."
      },
      {
        "question": "What is the default root font-size?",
        "answer": "16px, which is the browser default. Most CSS frameworks and design systems use 16px as the base, but you can configure it to match your project."
      },
      {
        "question": "Does it support viewport units like vw and vh?",
        "answer": "Yes. The tool also converts between pixels and viewport-relative units (vw, vh, vmin, vmax) for responsive sizing."
      }
    ],
    "relatedSlugs": [
      "css-unit-converter",
      "css-formatter",
      "html-formatter",
      "html-minifier",
      "markdown-preview"
    ]
  },
  "http-status": {
    "longDescription": "<p>The HTTP Status Code Lookup is a comprehensive reference tool that provides instant access to every HTTP response status code — from 1xx informational to 5xx server errors — along with their official descriptions, common use cases, and practical implementation guidance. It's the go-to reference for backend developers, API designers, and frontend engineers building robust error handling logic.</p><p>Search by numeric code (200, 404, 503), keyword (timeout, redirect, rate-limit), or browse the full categorized list. Each entry includes the official RFC name, a plain-English description of when the status is appropriate, common causes, and whether the response is cacheable. The tool also covers the full WebDAV extension status codes (207 Multi-Status, 422 Unprocessable Entity) and newer additions like 425 Too Early and 451 Unavailable for Legal Reasons.</p><p>Whether you're debugging a failing API integration, designing a REST API's error contract, or building a retry strategy in your client code, this reference gives you the precise information you need without hunting through RFCs. Everything loads client-side — no tracking, no accounts, no data submission.</p>",
    "features": [
      "Complete HTTP status code reference (1xx through 5xx) with official descriptions",
      "Search by code number, keyword, or category",
      "Cacheability information for each status code",
      "Common causes and practical usage guidance per status",
      "Includes WebDAV and newer status codes (425, 451, etc.)",
      "Client-side — no data transmitted, loads instantly"
    ],
    "howTo": [
      {
        "step": "Search by Code or Keyword",
        "description": "Type a status code number (e.g., 429) or a keyword (e.g., redirect) to filter the list instantly."
      },
      {
        "step": "Browse by Category",
        "description": "Click a category header (1xx, 2xx, 3xx, 4xx, 5xx) to see all status codes in that class."
      },
      {
        "step": "View Details",
        "description": "Click any status code to see its full description, common causes, cacheability, and RFC reference."
      },
      {
        "step": "Copy for Documentation",
        "description": "Use the copy button to grab a formatted status code entry for your API documentation or error handling code."
      }
    ],
    "faq": [
      {
        "question": "Does this include WebDAV and non-standard status codes?",
        "answer": "Yes. The reference includes all standard HTTP status codes plus common WebDAV extensions and newer codes like 425 Too Early and 451 Unavailable for Legal Reasons."
      },
      {
        "question": "How do I know if a response is cacheable?",
        "answer": "Each status code entry includes cacheability information — whether the response can be cached by default, requires validation, or must not be cached."
      },
      {
        "question": "Can I use this as an API design reference?",
        "answer": "Absolutely. The tool provides guidance on when to use each status code, helping you design consistent and correct REST API error contracts."
      }
    ],
    "relatedSlugs": [
      "url-parser",
      "jwt-decoder",
      "json-formatter",
      "html-formatter",
      "cron-parser"
    ]
  },
  "url-parser": {
    "longDescription": "<p>The URL Parser decomposes any URL into its individual components — scheme, authority, hostname, port, path, query parameters, and fragment — displaying each in a structured, editable format. It's invaluable for developers debugging API endpoints, analyzing tracking parameters, understanding complex redirect chains, or building URL manipulation utilities.</p><p>Paste any URL — from simple homepage links to complex API endpoints with multiple query parameters, encoded characters, and nested paths — and the parser instantly breaks it down into clearly labeled fields. Query parameters are extracted into a key-value table, URL encoding is decoded for readability, and port numbers, authentication credentials (when present), and fragment identifiers are all properly identified and displayed.</p><p>For security analysts inspecting suspicious links, SEO professionals auditing canonical URLs, and backend developers constructing precise API calls, this tool provides instant clarity on URL structure. All parsing is client-side — URLs are never transmitted to any server, preserving the confidentiality of internal endpoints and authentication tokens.</p>",
    "features": [
      "Instant decomposition into scheme, host, port, path, query, and fragment",
      "Query parameter extraction into an editable key-value table",
      "URL decoding of percent-encoded characters for readability",
      "Support for complex URLs with authentication, ports, and nested paths",
      "Rebuild edited components back into a valid URL",
      "Entirely client-side — no URL data transmitted to any server"
    ],
    "howTo": [
      {
        "step": "Paste URL",
        "description": "Insert any URL into the input field — simple links, API endpoints, or complex multi-parameter URLs."
      },
      {
        "step": "View Components",
        "description": "The URL is instantly decomposed into scheme, authority, hostname, port, path, query parameters, and fragment."
      },
      {
        "step": "Inspect Query Parameters",
        "description": "Query strings are extracted into a table with decoded keys and values, making it easy to find and understand each parameter."
      },
      {
        "step": "Edit and Rebuild",
        "description": "Modify any component and click rebuild to generate a corrected URL, or copy individual components for use elsewhere."
      }
    ],
    "faq": [
      {
        "question": "Does it handle encoded characters?",
        "answer": "Yes. Percent-encoded characters (e.g., %20 for space) are decoded for display and can be re-encoded when rebuilding the URL."
      },
      {
        "question": "Can I extract just the query parameters?",
        "answer": "Yes. Query parameters are extracted into a separate key-value table, so you can copy them individually or as a complete set."
      },
      {
        "question": "Is my URL data safe?",
        "answer": "All parsing happens in your browser. No URL — including internal endpoints, tokens, or credentials — is ever sent to any server."
      }
    ],
    "relatedSlugs": [
      "http-status",
      "jwt-decoder",
      "json-formatter",
      "regex-tester",
      "csv-json"
    ]
  },
  "html-formatter": {
    "longDescription": "<p>The HTML Formatter (Beautifier) restructures raw, minified, or poorly formatted HTML into clean, consistently indented, and highly readable code. It's essential for developers working with generated HTML (email templates, CMS outputs, HTML-to-PDF conversions), hand-coded markup, or code extracted from design tools where formatting is mangled or compressed.</p><p>The formatter applies intelligent indentation based on HTML nesting depth, aligns attributes consistently, and wraps long lines for readability. It correctly handles self-closing tags, void elements, inline vs block display assumptions, embedded CSS and script blocks, and template syntax — producing output that aligns with standard HTML coding conventions used in professional codebases.</p><p>Whether you're cleaning up markup before a code review, normalizing output from an HTML generator, or preparing HTML for documentation, this tool saves significant manual reformatting time. All processing is client-side, ensuring your HTML — which may contain internal data, proprietary templates, or embedded credentials — never leaves your browser.</p>",
    "features": [
      "Intelligent indentation based on HTML nesting depth",
      "Consistent attribute alignment and line wrapping",
      "Correct handling of self-closing tags, void elements, and inline styles",
      "Embedded <style> and <script> block formatting",
      "Configurable indentation width (tabs or 2/4 spaces)",
      "Full client-side processing with zero server uploads"
    ],
    "howTo": [
      {
        "step": "Paste HTML",
        "description": "Insert your raw, minified, or poorly formatted HTML into the input area."
      },
      {
        "step": "Configure Options",
        "description": "Set indentation width, attribute alignment preference, and whether to format embedded style/script blocks."
      },
      {
        "step": "Format",
        "description": "Click the format button to produce consistently indented, readable HTML output."
      },
      {
        "step": "Copy or Compare",
        "description": "Copy the formatted HTML to clipboard or compare the before/after output to verify correctness."
      }
    ],
    "faq": [
      {
        "question": "Does it handle embedded CSS and JavaScript?",
        "answer": "Yes. Content within <style> and <script> tags is formatted according to its own rules, and the HTML structure around it is properly indented."
      },
      {
        "question": "Will it change my HTML's rendering behavior?",
        "answer": "No. The formatter only adjusts whitespace (indentation, line breaks). The rendered output remains identical."
      },
      {
        "question": "Can I use it on generated HTML from email templates?",
        "answer": "Yes. HTML generators often produce minified or inconsistently formatted output, and this tool normalizes it into clean, reviewable code."
      }
    ],
    "relatedSlugs": [
      "html-minifier",
      "css-formatter",
      "javascript-formatter",
      "markdown-preview",
      "svg-formatter"
    ]
  },
  "css-formatter": {
    "longDescription": "<p>The CSS Formatter is a precision code beautifier that takes minified, compressed, or inconsistently written CSS and transforms it into clean, properly indented, and consistently organized code. It's a daily-use tool for front-end developers, CSS architects, and UI engineers who need to maintain readable stylesheets across teams and projects.</p><p>The formatter applies standard CSS coding conventions: one property per line, consistent indentation, logical spacing around colons and semicolons, and organized selector formatting. It handles modern CSS features including custom properties (CSS variables), @media queries, @supports rules, nested selectors (CSS Nesting spec), and complex selector chains, producing output that matches professional coding standards.</p><p>Beyond beautification, the tool can minify CSS for production (removing whitespace and comments to reduce file size) and provides a quick side-by-side comparison of before/after with byte savings. All processing runs in your browser — your stylesheets, which may contain proprietary design system tokens and class naming conventions, never leave your machine.</p>",
    "features": [
      "One-property-per-line formatting with consistent indentation",
      "Handles CSS variables (@custom-property), @media, @supports, and nested selectors",
      "Selector formatting with proper spacing and line breaks",
      "Minification mode for production-ready compact CSS",
      "Before/after size comparison showing byte savings",
      "Fully client-side — CSS content never transmitted to any server"
    ],
    "howTo": [
      {
        "step": "Paste CSS Code",
        "description": "Insert your minified, compressed, or inconsistently formatted CSS into the input area."
      },
      {
        "step": "Configure Style",
        "description": "Choose indentation width (tabs or spaces), property ordering preference, and whether to preserve or remove comments."
      },
      {
        "step": "Format",
        "description": "Click the format button to produce clean, consistently formatted CSS ready for code review or development."
      },
      {
        "step": "Minify or Copy",
        "description": "Toggle to minify mode for production output, or copy the formatted CSS to your clipboard."
      }
    ],
    "faq": [
      {
        "question": "Does it support modern CSS features?",
        "answer": "Yes. CSS custom properties, @container queries, @layer, nested selectors, and other modern syntax are all formatted correctly."
      },
      {
        "question": "Can I use this to minify CSS for production?",
        "answer": "Yes. The minification mode strips whitespace and comments, producing compact CSS that reduces file size significantly."
      },
      {
        "question": "Will it change how my CSS renders?",
        "answer": "No. Only whitespace is modified. The actual CSS rules and their specificity remain unchanged."
      }
    ],
    "relatedSlugs": [
      "css-unit-converter",
      "html-formatter",
      "javascript-formatter",
      "html-minifier",
      "svg-formatter"
    ]
  },
  "javascript-formatter": {
    "longDescription": "<p>The JavaScript Formatter (Beautifier) restructures minified, compressed, or poorly formatted JavaScript and TypeScript code into clean, consistently indented, and highly readable source. It's an essential tool for debugging minified production bundles, cleaning up auto-generated code, and maintaining consistent formatting across team codebases without requiring a full IDE setup.</p><p>The formatter applies professional coding conventions: proper indentation, consistent brace placement, logical line breaks around control structures, chained method formatting, and template literal handling. It correctly processes modern JavaScript features including optional chaining (?.), nullish coalescing (??), async/await, generators, destructuring, and ES module syntax.</p><p>Whether you're inspecting a webpack bundle, debugging a CDN-hosted script, or normalizing code from multiple contributors, this tool produces output that reads like well-maintained source code. All formatting is client-side — your code, which may contain proprietary algorithms, API keys in strings, or business logic, never leaves your browser.</p>",
    "features": [
      "Consistent indentation and brace placement for modern JavaScript/TypeScript",
      "Handles ES2024+ syntax: optional chaining, nullish coalescing, async/await",
      "Chained method formatting with proper alignment",
      "Minification mode for producing compact output",
      "Preserves string contents and template literals without modification",
      "Entirely client-side — code never transmitted to external servers"
    ],
    "howTo": [
      {
        "step": "Paste JavaScript/TypeScript",
        "description": "Insert your minified, compressed, or inconsistently formatted JS/TS code into the input area."
      },
      {
        "step": "Configure Formatting",
        "description": "Set indentation width, brace style (same-line vs next-line), and whether to preserve or strip comments."
      },
      {
        "step": "Format",
        "description": "Click format to produce clean, consistently indented code ready for reading or code review."
      },
      {
        "step": "Minify or Copy",
        "description": "Toggle minification for production output, or copy the formatted code to your clipboard."
      }
    ],
    "faq": [
      {
        "question": "Does it handle TypeScript as well as JavaScript?",
        "answer": "Yes. TypeScript syntax including type annotations, interfaces, enums, and generics is formatted correctly alongside standard JavaScript."
      },
      {
        "question": "Will it modify my code's behavior?",
        "answer": "No. Only whitespace and formatting are changed. All code logic, string contents, and execution flow remain identical."
      },
      {
        "question": "Can I use this on minified production bundles?",
        "answer": "Yes. Paste minified code and the formatter will produce readable output, making it much easier to debug production issues."
      }
    ],
    "relatedSlugs": [
      "json-formatter",
      "html-formatter",
      "css-formatter",
      "html-minifier",
      "json-to-typescript"
    ]
  },
  "json-viewer": {
    "longDescription": "<p>The JSON Tree Viewer is an interactive explorer that renders JSON data as a collapsible, navigable tree structure — transforming deeply nested, overwhelming JSON dumps into an organized hierarchy you can expand, collapse, and search through intuitively. It's the fastest way to understand the structure and content of complex JSON responses without scrolling through pages of formatted text.</p><p>Click nodes to expand or collapse branches, see data types labeled alongside values, and use the built-in search to instantly locate specific keys or values across the entire tree. Array indices are clearly labeled, object keys are displayed prominently, and the visual hierarchy makes parent-child relationships immediately obvious — even in JSON structures nested ten levels deep.</p><p>For developers working with API responses, configuration files, or data exports, this viewer provides the structural clarity that flat text formatting cannot. All rendering is client-side — your JSON data, which may contain user records, credentials, or proprietary data, is never uploaded or transmitted anywhere.</p>",
    "features": [
      "Collapsible tree view with expand/collapse all functionality",
      "Data type labels (string, number, boolean, null, array, object) on each node",
      "Built-in search across all keys and values in the JSON tree",
      "Array index display and object key highlighting",
      "Copy value of any individual node or subtree to clipboard",
      "Full client-side rendering — JSON data never leaves your browser"
    ],
    "howTo": [
      {
        "step": "Paste JSON Data",
        "description": "Insert your JSON string into the input area — it can be minified or already formatted."
      },
      {
        "step": "View Tree Structure",
        "description": "The JSON is instantly rendered as an interactive tree. Click any node to expand or collapse its children."
      },
      {
        "step": "Search and Navigate",
        "description": "Use the search bar to find specific keys or values. The matching nodes are highlighted in the tree."
      },
      {
        "step": "Copy Subtrees",
        "description": "Right-click or use the copy button on any node to copy just that subtree's JSON to your clipboard."
      }
    ],
    "faq": [
      {
        "question": "Does it handle very large JSON files?",
        "answer": "Yes. The tree view loads lazily for very large structures, and collapse/expand-all controls let you manage navigation efficiently."
      },
      {
        "question": "Can I search for specific values?",
        "answer": "Yes. The built-in search highlights all matching keys and values across the entire tree, making it fast to locate specific data."
      },
      {
        "question": "Is my JSON data uploaded?",
        "answer": "No. The tree is rendered entirely in your browser. No JSON data is ever sent to any server."
      }
    ],
    "relatedSlugs": [
      "json-formatter",
      "json-to-typescript",
      "json-xml",
      "json-yaml",
      "toml-json"
    ]
  },
  "bitwise-calculator": {
    "longDescription": "<p>The Bitwise Calculator is a developer-focused arithmetic tool that performs AND, OR, XOR, NOT, left shift, and right shift operations on integers, displaying results in binary, hexadecimal, and decimal simultaneously. It's essential for systems programmers, embedded developers, network engineers, and anyone working with bitmasks, flags, hardware registers, or low-level data manipulation.</p><p>Enter two integer values and select the bitwise operation to see the result rendered in all three number bases at once. The binary representation is aligned bit-by-bit with visual highlighting of which bits are set, making it easy to understand exactly how each operation transforms the input values. The tool handles both unsigned and signed (two's complement) representations.</p><p>Whether you're debugging a flag combination in a permissions system, verifying a subnet mask, working with binary protocols, or teaching bitwise logic, this calculator provides immediate, precise results. All computation runs client-side — no data is transmitted anywhere.</p>",
    "features": [
      "All six bitwise operations: AND, OR, XOR, NOT, left shift, right shift",
      "Results displayed simultaneously in binary, hexadecimal, and decimal",
      "Visual bit-level highlighting showing which bits are set",
      "Support for both unsigned and signed (two's complement) integers",
      "Configurable bit width (8, 16, 32, 64 bits)",
      "Client-side computation — no data leaves your browser"
    ],
    "howTo": [
      {
        "step": "Enter Values",
        "description": "Input two integer values in decimal, hexadecimal (0x prefix), or binary (0b prefix) format."
      },
      {
        "step": "Select Operation",
        "description": "Click the bitwise operation button (AND, OR, XOR, NOT, <<, >>) to compute the result."
      },
      {
        "step": "View Results",
        "description": "The result is displayed in binary, hex, and decimal with visual bit alignment showing exactly which bits differ."
      },
      {
        "step": "Adjust Bit Width",
        "description": "Toggle between 8, 16, 32, or 64-bit width to match your target system's integer size."
      }
    ],
    "faq": [
      {
        "question": "What number formats can I input?",
        "answer": "Decimal (no prefix), hexadecimal (0x prefix), and binary (0b prefix) are all accepted. Results are always shown in all three formats."
      },
      {
        "question": "Does it handle signed integers?",
        "answer": "Yes. Two's complement signed representation is supported, and you can toggle between signed and unsigned display modes."
      },
      {
        "question": "Can I use this to understand permission bitmasks?",
        "answer": "Absolutely. The binary view with bit highlighting makes it easy to see exactly which permission flags are set in a bitmask value."
      }
    ],
    "relatedSlugs": [
      "ipv4-converter",
      "cidr-calculator",
      "chmod-calculator",
      "number-base",
      "base64"
    ]
  },
  "ipv4-converter": {
    "longDescription": "<p>The IPv4 Converter is a network utility that translates IPv4 addresses between their four-octet dotted-decimal representation (192.168.1.1) and equivalent integer, hexadecimal, and binary formats instantly. It's essential for network engineers, security analysts, and backend developers working with firewall rules, IP-based access control, subnet calculations, and log analysis where IP addresses appear in different formats.</p><p>Enter any valid IPv4 address and the converter displays its decimal integer value (used in databases and CIDR calculations), hexadecimal representation (common in network headers), and full 32-bit binary form (for subnet mask analysis). The conversion is bidirectional — enter an integer, hex value, or binary string to get the corresponding dotted-decimal address.</p><p>For security teams correlating IP logs across systems, developers building IP-based access control lists, and network engineers analyzing packet captures, this tool provides instant format conversion without CLI tools or custom scripts. All conversions are client-side — your IP addresses and network topology details remain on your machine.</p>",
    "features": [
      "Bidirectional conversion: dotted-decimal ↔ integer ↔ hex ↔ binary",
      "Instant results with all four formats displayed simultaneously",
      "Input validation with clear error messages for invalid addresses",
      "Binary display with octet separation for easy subnet mask analysis",
      "Support for compressed notation (e.g., 10.0.1 → 10.0.0.1)",
      "Client-side processing — IP addresses never leave your browser"
    ],
    "howTo": [
      {
        "step": "Enter IP Address",
        "description": "Type a dotted-decimal IPv4 address (e.g., 192.168.1.1), integer, hex (0x), or binary (0b) value."
      },
      {
        "step": "View All Formats",
        "description": "The address is instantly shown in dotted-decimal, 32-bit integer, hexadecimal, and full binary representations."
      },
      {
        "step": "Convert from Other Formats",
        "description": "Enter a decimal integer, hex value, or binary string to see the corresponding IPv4 address."
      },
      {
        "step": "Copy Any Format",
        "description": "Click copy on any format to grab it for use in firewall rules, database queries, or documentation."
      }
    ],
    "faq": [
      {
        "question": "Does it validate IP addresses?",
        "answer": "Yes. Invalid addresses (octets > 255, wrong number of octets, invalid characters) are rejected with a clear error message."
      },
      {
        "question": "What is the integer representation used for?",
        "answer": "IP addresses as integers are used in databases for efficient range queries, in CIDR calculations, and in IP-based access control systems."
      },
      {
        "question": "Is this tool only for IPv4?",
        "answer": "Yes, this tool focuses on IPv4. IPv6 has a different structure requiring separate conversion tools."
      }
    ],
    "relatedSlugs": [
      "cidr-calculator",
      "bitwise-calculator",
      "http-status",
      "url-parser",
      "csv-formatter"
    ]
  },
  "cidr-calculator": {
    "longDescription": "<p>The CIDR and Subnet Calculator computes network and broadcast addresses, host ranges, subnet masks, and the number of available hosts for any CIDR notation (e.g., 192.168.1.0/24). It's an essential tool for network engineers, DevOps professionals, and cloud architects designing VPCs, allocating IP ranges, and planning subnet strategies for Kubernetes clusters and cloud infrastructure.</p><p>Enter any CIDR block and the calculator instantly shows the network address, first usable host, last usable host, broadcast address, wildcard mask, and total available hosts. It supports supernetting (CIDR aggregation) and subnetting (breaking a block into smaller subnets), displaying the resulting subnets in a clean table with their ranges — critical for AWS VPC planning, Kubernetes pod network allocation, and on-premise VLAN design.</p><p>The tool also includes a reverse lookup: enter a host IP address and a target subnet mask to determine which CIDR block it belongs to. All calculations are instant and client-side — your network topology and IP allocation data never leave your browser.</p>",
    "features": [
      "Full CIDR block analysis: network, broadcast, host range, and available hosts",
      "Subnet calculator: divide a block into smaller subnets with clear output",
      "Supernetting: aggregate multiple CIDR blocks into a summary route",
      "Reverse lookup: find the CIDR block for any IP address",
      "Wildcard mask and subnet mask display in multiple formats",
      "Client-side — network topology data never transmitted"
    ],
    "howTo": [
      {
        "step": "Enter CIDR Block",
        "description": "Type any CIDR notation (e.g., 10.0.0.0/8 or 192.168.1.0/24) into the input field."
      },
      {
        "step": "View Network Details",
        "description": "See the network address, first/last host, broadcast address, wildcard mask, and total available hosts instantly."
      },
      {
        "step": "Calculate Subnets",
        "description": "Enter a desired new prefix length (e.g., split /24 into /26) to see all resulting subnets with their ranges."
      },
      {
        "step": "Copy Results",
        "description": "Copy the subnet table or individual values for use in network configuration files, Terraform, or documentation."
      }
    ],
    "faq": [
      {
        "question": "What is the maximum CIDR prefix length supported?",
        "answer": "The tool supports /1 through /32 for IPv4. /32 represents a single host address, and /1 represents half the IPv4 address space."
      },
      {
        "question": "Does it handle private IP ranges?",
        "answer": "Yes. All IPv4 CIDR blocks are calculated correctly, including private ranges (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)."
      },
      {
        "question": "Can I use this for Kubernetes network planning?",
        "answer": "Absolutely. The subnet calculator is ideal for planning pod CIDR ranges, service CIDR blocks, and VPC subnet allocation in Kubernetes environments."
      }
    ],
    "relatedSlugs": [
      "ipv4-converter",
      "bitwise-calculator",
      "http-status",
      "url-parser",
      "chmod-calculator"
    ]
  },
  "csv-formatter": {
    "longDescription": "<p>The CSV Formatter takes raw, inconsistent, or minified Comma-Separated Values data and transforms it into clean, properly aligned, and consistently structured tabular output. It's essential for developers, data analysts, and anyone working with spreadsheet exports, database dumps, or API data where CSV formatting is mangled by copy-paste operations, log aggregation, or data pipeline processing.</p><p>The formatter detects and handles common CSV issues: inconsistent delimiters (commas vs semicolons vs tabs), mismatched quoting, embedded newlines within fields, and UTF-8 encoding problems. It normalizes column alignment, ensures proper quoting of fields containing special characters, and can add or remove headers for clean tabular display. The result is well-structured CSV that opens correctly in Excel, Google Sheets, or any data tool.</p><p>For teams migrating data between systems, cleaning up exports from legacy applications, or preparing datasets for import, this tool ensures CSV integrity without spreadsheets or custom scripts. All processing is client-side — your data, which may contain personal records, financial data, or proprietary information, never leaves your browser.</p>",
    "features": [
      "Auto-detection of delimiters (comma, semicolon, tab) and quoting styles",
      "Column alignment and consistent quoting for special characters",
      "Handles embedded newlines and escaped quotes within fields",
      "Configurable output delimiter and quote character",
      "Header row detection, addition, or removal",
      "Entirely client-side — CSV data never transmitted to any server"
    ],
    "howTo": [
      {
        "step": "Paste CSV Data",
        "description": "Insert raw CSV from a log, clipboard, or export into the input area."
      },
      {
        "step": "Review Auto-Detection",
        "description": "The tool detects the delimiter, quoting style, and encoding. Adjust if the auto-detection doesn't match your expectations."
      },
      {
        "step": "Format",
        "description": "Click format to produce consistently structured, properly aligned, and correctly quoted CSV output."
      },
      {
        "step": "Copy or Download",
        "description": "Copy the formatted CSV to clipboard or download as a .csv file ready for import into any spreadsheet or data tool."
      }
    ],
    "faq": [
      {
        "question": "Does it handle different CSV delimiters?",
        "answer": "Yes. It auto-detects commas, semicolons, and tabs as delimiters, and you can manually override to match any format."
      },
      {
        "question": "Can it handle CSV with embedded newlines in fields?",
        "answer": "Yes. Properly quoted fields containing newlines are preserved and correctly formatted in the output."
      },
      {
        "question": "Is my data safe?",
        "answer": "All formatting happens in your browser. No CSV data — including personal, financial, or proprietary records — is ever sent to any server."
      }
    ],
    "relatedSlugs": [
      "csv-json",
      "csv-to-sql",
      "json-formatter",
      "sql-formatter",
      "json-viewer"
    ]
  },
  "css-unit-converter": {
    "longDescription": "<p>The CSS Unit Converter is a comprehensive front-end development tool that converts between all CSS measurement units — pixels (px), rem, em, viewport widths (vw), viewport heights (vh), and point (pt) — with configurable base values for accurate, project-specific conversions. It's indispensable for responsive design, accessibility-focused development, and design-to-code handoff where different unit types are required at different stages.</p><p>Set your project's root font-size, viewport dimensions, and convert any value between units instantly. The tool supports fractional precision, batch conversion of multiple values at once, and provides a side-by-side comparison table so you can see how a design specification translates across unit systems. This is especially critical when converting print designs (which use pt) to screen layouts (which use px or rem), or when implementing a responsive design system that uses vw for fluid typography.</p><p>For front-end developers, UI engineers, and designers bridging the gap between design files and production CSS, this converter provides the precision and speed that mental math and online calculators with limited unit support cannot match. All processing is client-side — your design specifications never leave your browser.</p>",
    "features": [
      "Convert between px, rem, em, vw, vh, vmin, vmax, and pt units",
      "Configurable root font-size, viewport width, and viewport height",
      "Fractional precision with configurable decimal places",
      "Batch conversion mode for multiple values simultaneously",
      "Side-by-side conversion table for design-to-development comparison",
      "Client-side processing — design specifications never leave your browser"
    ],
    "howTo": [
      {
        "step": "Set Base Values",
        "description": "Configure your root font-size (default 16px) and viewport dimensions to match your project's design context."
      },
      {
        "step": "Enter Source Value",
        "description": "Type any CSS unit value (e.g., 24px, 1.5rem, 50vw) into the input field."
      },
      {
        "step": "View All Equivalents",
        "description": "See the converted value in every supported CSS unit displayed in a clear comparison table."
      },
      {
        "step": "Batch Convert",
        "description": "Switch to batch mode and paste multiple values to convert them all at once for bulk CSS refactoring."
      }
    ],
    "faq": [
      {
        "question": "What is the difference between rem and em?",
        "answer": "rem is relative to the root (<html>) font-size, making it consistent across the document. em is relative to the parent element's font-size, causing values to compound in nested elements."
      },
      {
        "question": "How do viewport units (vw, vh) work?",
        "answer": "vw is 1% of the viewport width, vh is 1% of the viewport height. These units scale fluidly with the browser window, making them ideal for responsive layouts."
      },
      {
        "question": "Can I use this for print CSS conversion?",
        "answer": "Yes. The pt (point) unit conversion is included for print CSS, where 1pt equals 1/72 of an inch."
      }
    ],
    "relatedSlugs": [
      "px-rem",
      "css-formatter",
      "html-formatter",
      "html-minifier",
      "markdown-preview"
    ]
  },
  "json-xml": {
    "longDescription": "<p>The JSON ↔ XML Converter is a bidirectional format translation tool that transforms JSON data into well-formed XML documents and vice versa, preserving structure, data types, and nesting relationships. It's essential for developers integrating systems that communicate in different data formats — REST APIs returning JSON consuming SOAP services expecting XML, or legacy XML databases feeding modern JSON-based frontends.</p><p>The converter intelligently maps between the two formats: JSON arrays become repeated XML elements, nested objects become child elements, and JSON values become text content or attributes depending on your configuration. You can control whether values are represented as XML attributes or child elements, how arrays are handled (repeated elements vs. wrapper elements), and the root element naming convention for the XML output.</p><p>For data migration projects, API integration work, and legacy system modernization, this tool eliminates the need for custom conversion scripts. All processing is client-side — your data, which may contain business records, configuration, or personal information, never leaves your browser.</p>",
    "features": [
      "Bidirectional: JSON → XML and XML → JSON in one tool",
      "Configurable: values as attributes vs. child elements",
      "Array handling options: repeated elements or wrapper elements",
      "Proper XML namespace and declaration generation",
      "Preserves nesting depth and data type semantics",
      "Fully client-side — no data transmitted to external servers"
    ],
    "howTo": [
      {
        "step": "Choose Direction",
        "description": "Select whether you're converting JSON to XML or XML to JSON."
      },
      {
        "step": "Paste Source Data",
        "description": "Insert your JSON or XML data into the input area."
      },
      {
        "step": "Configure Mapping",
        "description": "Set options like attribute vs. element mapping for values, array handling, and root element naming."
      },
      {
        "step": "Convert and Copy",
        "description": "Click convert to produce the output in the target format. Copy the result to clipboard or download as a file."
      }
    ],
    "faq": [
      {
        "question": "Does it handle deeply nested structures?",
        "answer": "Yes. Complex nested JSON objects and XML elements are mapped correctly, preserving the full hierarchy in the target format."
      },
      {
        "question": "Can I control whether JSON values become XML attributes or elements?",
        "answer": "Yes. The converter offers configuration to map values as XML attributes (compact) or child elements (verbose), depending on your target schema requirements."
      },
      {
        "question": "Is my data safe during conversion?",
        "answer": "All conversion happens in your browser. No data is transmitted to any server, making it safe for sensitive business data."
      }
    ],
    "relatedSlugs": [
      "json-yaml",
      "toml-json",
      "json-formatter",
      "xml-formatter",
      "json-to-typescript"
    ]
  },
  "json-yaml": {
    "longDescription": "<p>The JSON ↔ YAML Converter is a bidirectional format translation tool that transforms JSON data into human-friendly YAML and vice versa, preserving structure and semantics while adapting to each format's strengths. It's essential for developers working with Kubernetes manifests, Docker Compose files, CI/CD configurations, and infrastructure-as-code where YAML is the standard but data often arrives as JSON from APIs.</p><p>The converter handles all YAML features including anchors (&) and aliases (*), multi-line strings (literal | and folded >), nested mappings, sequences, and proper type inference (strings, numbers, booleans, null). When converting from JSON, it produces clean YAML with logical key ordering and appropriate quoting. When converting from YAML, it accurately parses even complex constructs back into valid JSON.</p><p>For DevOps engineers managing Kubernetes deployments, developers working with API specifications (OpenAPI/Swagger uses YAML), and anyone bridging the gap between JSON APIs and YAML configuration files, this converter provides instant, accurate bidirectional translation. All processing is client-side — your configuration data never leaves your browser.</p>",
    "features": [
      "Bidirectional: JSON → YAML and YAML → JSON conversion",
      "Supports YAML anchors (&), aliases (*), multi-line strings, and blocks",
      "Proper type inference: strings, numbers, booleans, and null",
      "Configurable output: indentation width, quoting style, key ordering",
      "Validates both JSON and YAML syntax with clear error messages",
      "Client-side processing — configuration data never transmitted"
    ],
    "howTo": [
      {
        "step": "Select Direction",
        "description": "Choose whether to convert from JSON to YAML or YAML to JSON."
      },
      {
        "step": "Paste Source Data",
        "description": "Insert your JSON or YAML data into the input area."
      },
      {
        "step": "Configure Output",
        "description": "Set indentation width, quoting preference, and key ordering for the output format."
      },
      {
        "step": "Convert and Copy",
        "description": "Click convert and copy the result to clipboard for pasting into your configuration files."
      }
    ],
    "faq": [
      {
        "question": "Does it handle YAML anchors and aliases?",
        "answer": "Yes. YAML anchors (&) and aliases (*) are preserved correctly during YAML → JSON conversion and generated where applicable in JSON → YAML conversion."
      },
      {
        "question": "Is this useful for Kubernetes manifests?",
        "answer": "Absolutely. Kubernetes YAML files can be converted to JSON for programmatic manipulation, and JSON API responses can be converted to YAML for configuration files."
      },
      {
        "question": "Does it validate the input syntax?",
        "answer": "Yes. Both JSON and YAML inputs are validated with clear error messages indicating the exact location and nature of any syntax issues."
      }
    ],
    "relatedSlugs": [
      "toml-json",
      "json-xml",
      "json-formatter",
      "json-viewer",
      "json-to-typescript"
    ]
  },
  "toml-json": {
    "longDescription": "<p>The TOML ↔ JSON Converter is a bidirectional format translation tool that converts between Tom's Obvious Minimal Language (TOML) configuration files and JSON data. It's essential for Rust, Python, and Go developers who work with Cargo.toml, pyproject.toml, and other TOML-based configuration files but need to interoperate with JSON-based tools, APIs, and data pipelines.</p><p>TOML's strengths — explicit type declarations, date/time support, dotted key notation, and table arrays — map naturally to JSON structures, and this converter handles all mappings correctly: TOML tables become JSON objects, arrays become arrays, dates become ISO 8601 strings, and dotted keys are expanded into nested objects. The reverse direction ensures that JSON data is formatted as clean, idiomatic TOML with proper section headers and type-appropriate values.</p><p>For developers migrating configuration systems, integrating TOML configs with JSON APIs, or building tooling that needs to read TOML files programmatically through a JSON intermediate format, this converter provides instant, accurate translation. All processing is client-side — your configuration files and their contents never leave your browser.</p>",
    "features": [
      "Bidirectional: TOML → JSON and JSON → TOML conversion",
      "Full TOML spec support: tables, arrays, dotted keys, inline tables, dates",
      "Proper type mapping: TOML dates to ISO 8601, integers, floats, booleans, strings",
      "Idiomatic output formatting for both formats",
      "Clear error messages for invalid TOML or JSON syntax",
      "Client-side — configuration data never transmitted to any server"
    ],
    "howTo": [
      {
        "step": "Choose Direction",
        "description": "Select whether to convert TOML to JSON or JSON to TOML."
      },
      {
        "step": "Paste Source Data",
        "description": "Insert your TOML configuration or JSON data into the input area."
      },
      {
        "step": "Convert",
        "description": "Click convert to produce the output in the target format, with proper type mappings and formatting."
      },
      {
        "step": "Copy or Download",
        "description": "Copy the converted output to clipboard or download as a file for use in your project."
      }
    ],
    "faq": [
      {
        "question": "Does it handle TOML dotted key notation?",
        "answer": "Yes. Dotted keys like database.host = localhost are correctly expanded into nested JSON objects ({ database: { host: 'localhost' } })."
      },
      {
        "question": "Are TOML dates preserved correctly?",
        "answer": "Yes. TOML date-time values are converted to ISO 8601 formatted strings in JSON, preserving the full precision of the original timestamp."
      },
      {
        "question": "Can I use this to read Cargo.toml files?",
        "answer": "Yes. Paste your Cargo.toml content and convert it to JSON for programmatic processing, or convert JSON back to TOML for configuration generation."
      }
    ],
    "relatedSlugs": [
      "json-yaml",
      "json-xml",
      "json-formatter",
      "json-viewer",
      "markdown-preview"
    ]
  },
  "html-markdown": {
    "longDescription": "<p>The HTML ↔ Markdown Converter is a bidirectional format translation tool that transforms HTML markup into clean, readable Markdown and vice versa, preserving content structure, links, images, tables, and formatting semantics. It's essential for content teams, documentation engineers, and developers migrating between CMS platforms, generating README files from web content, or embedding Markdown-rendered HTML back into a Markdown-first workflow.</p><p>When converting HTML to Markdown, the tool strips unnecessary presentational tags, converts heading levels correctly, transforms HTML tables into GFM Markdown table syntax, preserves link URLs and image alt text, and handles complex nested lists with proper indentation. The reverse conversion takes Markdown and produces semantic HTML with correct heading tags, properly rendered tables, and blockquote elements.</p><p>For developers moving documentation between platforms (Confluence to GitHub, Notion to static site generators, or web pages to Markdown blogs), this converter eliminates hours of manual reformatting. All processing is client-side — your content never leaves your browser.</p>",
    "features": [
      "Bidirectional: HTML → Markdown and Markdown → HTML conversion",
      "Preserves headings, links, images, tables, lists, and blockquotes",
      "GFM Markdown table syntax for HTML table conversion",
      "Handles nested lists, inline formatting, and code blocks",
      "Configurable output: inline HTML vs. pure Markdown",
      "Client-side — content never transmitted to any server"
    ],
    "howTo": [
      {
        "step": "Select Direction",
        "description": "Choose whether to convert HTML to Markdown or Markdown to HTML."
      },
      {
        "step": "Paste Source Content",
        "description": "Insert your HTML or Markdown content into the input area."
      },
      {
        "step": "Configure Options",
        "description": "Set preferences like whether to preserve inline HTML, how to handle images, and list formatting style."
      },
      {
        "step": "Convert and Copy",
        "description": "Click convert to produce the output. Copy the result to your clipboard or download as a file."
      }
    ],
    "faq": [
      {
        "question": "Does it handle HTML tables correctly?",
        "answer": "Yes. HTML tables are converted to GitHub Flavored Markdown (GFM) table syntax with proper header separators and alignment."
      },
      {
        "question": "Will it preserve all my links and images?",
        "answer": "Yes. Link URLs, image sources, and alt text are all preserved during HTML → Markdown conversion."
      },
      {
        "question": "Can I use this for CMS migration?",
        "answer": "Absolutely. It's ideal for migrating content between HTML-based CMS platforms and Markdown-based static site generators like Hugo, Jekyll, or MkDocs."
      }
    ],
    "relatedSlugs": [
      "markdown-preview",
      "html-formatter",
      "html-minifier",
      "json-xml",
      "csv-json"
    ]
  },
  "csv-json": {
    "longDescription": "<p>CSV to JSON is a small job that a naive one-liner gets wrong in a dozen ways, so this page is built around a real RFC 4180 parser written out by hand. A quoted cell that contains commas, a cell with a line break in the middle of it, a doubled quote inside a quoted cell, a file that ends CRLF, a file that ends with a bare CR, a UTF-8 byte order mark on the front, a trailing line ending, and a header row whose names are not unique are all handled as cases with names — not as things that happen to work.</p><p>The parser is deliberately honest about the parts that are guesses. A double quote in the middle of an unquoted field is reported as an anomaly with its record, field and character position instead of being swallowed, because that is exactly how a converter loses a column. A row with fewer fields than the header has its missing cells written as JSON null rather than as an empty string, since an empty cell is something the CSV said and a missing cell is something it did not. A row with more fields keeps its extra values in a named array rather than dropping them. Duplicate header names are renamed deterministically and every rename is listed on screen.</p><p>No type is inferred. Every value in the output is a JSON string, so 00123 keeps its leading zeros, TRUE stays TRUE rather than becoming true, and a date in whatever format the export wrote stays in that format. That is a decision, not a limitation being hidden: a spreadsheet guesses types on open and this page does not, and it says so in the same font as the rest of the copy.</p><p>Input is capped before any parsing work begins — 5,242,880 characters of pasted text, 5 MB of opened file, 20,000 rows, 512 columns per row and 100,000 characters in a single cell — and each cap is refused with the real numbers rather than silently truncating. Your CSV is read in this tab. Nothing is uploaded, and no request is made with your data at all.</p>",
    "features": [
      "A real RFC 4180 parser, not split(","): quoted cells with embedded delimiters, embedded line breaks, doubled quotes, CRLF, LF, a bare CR, a UTF-8 BOM and a trailing newline",
      "A quote in the middle of an unquoted field is reported as an anomaly with its record, field and character position — never silently accepted",
      "Every value stays a JSON string: no type inference, so leading zeros, TRUE/FALSE and spreadsheet dates survive exactly as written",
      "Ragged rows are surfaced, not smoothed over: a short row's missing cells become JSON null, a long row's surplus values are kept in a _surplus array, and the count of both is reported",
      "Duplicate header names are de-duplicated deterministically as name (2), name (3) and every rename is listed",
      "Delimiter detection for comma, semicolon, tab and pipe that reports its own confidence, with a manual override",
      "Header-row toggle: keys come from the first row, or are generated as column1, column2 … with the column count taken from the widest record",
      "2- or 4-space JSON indentation and a live row, column and byte count measured on the exact text that is copied and downloaded",
      "Copy and download the JSON; re-parsing the downloaded file gives back the same document",
      "Caps of 5,242,880 characters, 5 MB per file, 20,000 rows, 512 columns per row and 100,000 characters per cell, each refused with its real numbers before any parsing work starts",
      "Cell values are rendered as escaped text only, in a bounded preview that says it is a preview",
      "Runs entirely in this tab — your CSV is never uploaded and no request is made with it"
    ],
    "howTo": [
      {
        "step": "Paste the CSV or open a file",
        "description": "Paste into the input box or use Open CSV file. Nothing is pre-filled. An opened file is decoded as UTF-8; a non-UTF-8 file shows U+FFFD characters and the page says how many."
      },
      {
        "step": "Check the delimiter and the header row",
        "description": "Auto-detect reports how confident it is and why — read the sentence under Delimiter. If it is not confident, or the header row above does not line up, pick the delimiter yourself."
      },
      {
        "step": "Read what was decided",
        "description": "The What was decided panel lists blank lines skipped, duplicate keys renamed, rows padded with null, surplus values kept, the byte order mark, and the line endings found — before you copy anything."
      },
      {
        "step": "Copy or download the JSON",
        "description": "Copy puts the exact indented document on the clipboard; Download writes the same bytes to a file named for its source and its row and column count. Both give you every row, not the preview."
      }
    ],
    "faq": [
      {
        "question": "Is the conversion lossless?",
        "answer": "No, and the page lists every change. Preserved: each cell's text character for character, row order, column order. Changed on purpose: no type is inferred (all values are JSON strings), header cells are trimmed to make keys, empty header cells become columnN, duplicate header names become name (2), short rows get JSON null in the missing cells, long rows keep surplus values in a _surplus array, and blank lines are skipped. What a spreadsheet does and this does not: no Excel serial dates, no locale-aware numbers, no #N/A, no leading-apostrophe stripping, no formula evaluation, and no encoding sniffing."
      },
      {
        "question": "Why are all my numbers strings?",
        "answer": "Because a CSV has no types. If this page guessed, 00123 would become 123 and a UK postcode, a phone number and an order id would all lose their leading zeros. Every value is a JSON string, and the only null values in the output are the cells a short row never had. Convert the field where you need a number."
      },
      {
        "question": "Why does my short row have null values?",
        "answer": "Because the row had fewer fields than the header has keys. Padding silently with an empty string would make a missing cell indistinguishable from a cell the CSV says is empty, so missing cells are JSON null instead. The count of short rows and of padded cells is reported."
      },
      {
        "question": "My CSV is semicolon- or tab-separated. Does it work?",
        "answer": "Yes. Comma, semicolon, tab and pipe are all detected automatically, and the page tells you how confident it is: high when one delimiter appears in every sampled record and no other candidate appears at all, medium when it is the only one present, and low when another delimiter also appears — which is the case where you should choose the delimiter yourself."
      },
      {
        "question": "What happens to quoted cells with commas or line breaks in them?",
        "answer": "They are parsed properly. A quoted cell keeps its delimiters and its line breaks, a doubled quote becomes a single quote, and CRLF, LF and a bare CR all end a record without a trailing newline creating an empty row. What is refused is a quote in the middle of an unquoted field: that is reported as an anomaly with its position rather than accepted, because accepting it silently is how a column goes missing."
      },
      {
        "question": "Is there a size limit, and what happens when I hit it?",
        "answer": "5,242,880 characters of pasted text, 5 MB per opened file, 20,000 rows, 512 columns per row and 100,000 characters in one cell. Each cap is checked before any parsing work starts and is refused with the real numbers, so nothing is half-converted and nothing is silently truncated."
      },
      {
        "question": "Is my CSV uploaded anywhere?",
        "answer": "No. The file is read with the browser's own file API and parsed in this tab. No request is made with your data, and no network call of any kind happens while you use the tool."
      },
      {
        "question": "Can it convert JSON back to CSV?",
        "answer": "No. This tool converts CSV to JSON only. Its old JSON-to-CSV mode was removed rather than left half-implemented, because a round trip that changes types on the way out is worse than no round trip."
      }
    ],
    "relatedSlugs": [
      "csv-formatter",
      "csv-to-sql",
      "excel-to-json",
      "json-formatter",
      "json-viewer"
    ]
  },
  "csv-to-sql": {
    "longDescription": "<p>The CSV to SQL INSERT Generator takes Comma-Separated Values data and produces valid, ready-to-execute SQL INSERT statements for immediate use with any relational database. It's essential for data analysts, backend developers, and database administrators who need to load spreadsheet exports, data migration files, or CSV-formatted API responses into PostgreSQL, MySQL, SQLite, or SQL Server databases quickly and accurately.</p><p>The tool intelligently infers column data types (INT, FLOAT, VARCHAR, TEXT, BOOLEAN, DATE) from the actual values in each column, generates properly escaped SQL with correct quoting, and handles edge cases like NULL values (empty cells), strings containing single quotes, and binary data. You can customize the target table name, choose between individual INSERT statements or a single bulk INSERT, and select the target SQL dialect for syntax compatibility.</p><p>For database seeding, data migration, and ETL workflows, this tool eliminates the need to write custom import scripts or use database-specific bulk loading utilities. All processing is client-side — your data, which may contain sensitive business records or personal information, never leaves your browser.</p>",
    "features": [
      "Automatic data type inference (INT, FLOAT, VARCHAR, TEXT, BOOLEAN, DATE)",
      "Proper SQL escaping for strings with quotes and special characters",
      "NULL handling for empty cells with configurable NULL representation",
      "Dialect support: PostgreSQL, MySQL, SQLite, and SQL Server syntax",
      "Individual INSERT statements or single bulk INSERT output",
      "Entirely client-side — CSV data never transmitted to any server"
    ],
    "howTo": [
      {
        "step": "Paste CSV Data",
        "description": "Insert your CSV data into the input area. The first row is treated as column headers by default."
      },
      {
        "step": "Set Table Name",
        "description": "Enter the target database table name for the generated INSERT statements."
      },
      {
        "step": "Configure Output",
        "description": "Choose SQL dialect, INSERT style (individual or bulk), and data type override if needed."
      },
      {
        "step": "Generate and Copy",
        "description": "Click generate to produce the SQL. Copy the INSERT statements to your database client or migration file."
      }
    ],
    "faq": [
      {
        "question": "Does it handle NULL values in the CSV?",
        "answer": "Yes. Empty cells are converted to SQL NULL by default, with an option to specify a different representation (e.g., empty string or 'N/A')."
      },
      {
        "question": "Will the SQL work with my specific database?",
        "answer": "The tool supports PostgreSQL, MySQL, SQLite, and SQL Server dialects. Select your target database for correct syntax, quoting, and type handling."
      },
      {
        "question": "How does it handle strings with single quotes?",
        "answer": "Single quotes in string values are properly escaped (doubled) in the output SQL to prevent syntax errors and SQL injection."
      }
    ],
    "relatedSlugs": [
      "csv-formatter",
      "csv-json",
      "sql-formatter",
      "json-formatter",
      "sqlite-viewer"
    ]
  },
  "sqlite-viewer": {
    "longDescription": "<p>The SQLite Database Viewer is a browser-based tool that loads and explores .sqlite and .db files entirely on the client side, providing a read-only interface to browse tables, view schemas, inspect row data, and run SELECT queries — all without uploading your database to any server. It's essential for developers debugging embedded databases, data analysts inspecting SQLite exports, and anyone who needs quick access to SQLite data without installing desktop tools.</p><p>Drag and drop your SQLite file and the tool loads it directly in your browser using WebAssembly-powered SQLite. Browse the list of tables, view column definitions and data types, paginate through row data, and run custom SQL queries against the loaded database. The query editor supports full SQLite syntax including JOINs, subqueries, window functions, and CTEs.</p><p>SQLite databases frequently contain sensitive data — user records, financial transactions, application state, and personal information. This tool ensures your data never leaves your device, as all parsing and querying happens in the browser's WebAssembly sandbox. No cloud sync, no account required, and no data retention.</p>",
    "features": [
      "Browser-based SQLite engine using WebAssembly (no server required)",
      "Table browser with schema, column types, and row counts",
      "Paginated data viewer with sortable columns",
      "Full SQL query editor with syntax support for JOINs, CTEs, and window functions",
      "Support for .sqlite, .db, and .sqlite3 file formats",
      "Zero-upload architecture — database files never leave your browser"
    ],
    "howTo": [
      {
        "step": "Load Database",
        "description": "Drag and drop your .sqlite, .db, or .sqlite3 file onto the tool, or use the file picker to select it."
      },
      {
        "step": "Browse Tables",
        "description": "The sidebar lists all tables with their row counts. Click any table to view its schema and data."
      },
      {
        "step": "View Data",
        "description": "Browse table data with pagination, or use the query editor to run custom SELECT statements."
      },
      {
        "step": "Run Queries",
        "description": "Write SQL in the query editor and click execute. Results are displayed in a sortable, scrollable table."
      }
    ],
    "faq": [
      {
        "question": "Is my database file uploaded to a server?",
        "answer": "No. The file is loaded entirely in your browser using WebAssembly. No data is ever transmitted to any external server."
      },
      {
        "question": "Can I modify or delete data?",
        "answer": "The viewer is read-only by design. This prevents accidental data modification and ensures the tool is safe for inspecting production databases."
      },
      {
        "question": "What SQLite features are supported?",
        "answer": "Full SQLite syntax is supported including JSON functions, window functions, CTEs, virtual tables, and most extensions available in the WASM build."
      }
    ],
    "relatedSlugs": [
      "csv-to-sql",
      "sql-formatter",
      "json-viewer",
      "csv-json",
      "json-formatter"
    ]
  },
  "svg-formatter": {
    "longDescription": "<p>The SVG Formatter (Optimizer) restructures raw, compressed, or poorly formatted SVG code into clean, readable, properly indented markup — while also providing optimization options that strip unnecessary metadata, reduce path data precision, and remove editor-specific attributes to produce leaner SVG files for web deployment. It's essential for front-end developers, UI designers, and icon system architects who work with SVG graphics daily.</p><p>The formatter applies consistent indentation based on SVG nesting depth, formats attribute ordering logically, and handles SVG-specific elements correctly: paths with their complex d attributes, gradients, patterns, masks, clipPaths, and foreignObject elements. The optimization mode removes Inkscape/Illustrator metadata, unused definitions, comments, and reduces numeric precision in path data — typically achieving 20–60% file size reduction without visual changes.</p><p>For icon system pipelines, inline SVG in HTML components, and SVG asset optimization in build processes, this tool provides both human-readable formatting for development and compact output for production. All processing is client-side — your SVG assets never leave your browser.</p>",
    "features": [
      "Consistent indentation and attribute formatting for SVG code",
      "Strip editor metadata (Inkscope, Illustrator, Sketch attributes)",
      "Path data precision reduction for smaller file sizes",
      "Remove unused <defs>, comments, and empty groups",
      "Side-by-side before/after with byte savings comparison",
      "Fully client-side — SVG content never transmitted to any server"
    ],
    "howTo": [
      {
        "step": "Paste or Drop SVG",
        "description": "Insert raw SVG code into the editor or drag and drop an .svg file onto the tool."
      },
      {
        "step": "Choose Mode",
        "description": "Select format mode for readable code or optimize mode for production-ready compact SVG output."
      },
      {
        "step": "Configure Options",
        "description": "Toggle metadata removal, path precision, comment stripping, and unused definition cleanup."
      },
      {
        "step": "Copy or Download",
        "description": "Copy the formatted/optimized SVG to clipboard or download as an .svg file."
      }
    ],
    "faq": [
      {
        "question": "Will optimization change how my SVG looks?",
        "answer": "No. Optimization only removes invisible metadata and reduces numeric precision. The rendered visual output remains identical."
      },
      {
        "question": "Does it handle complex SVG features?",
        "answer": "Yes. Paths, gradients, patterns, masks, clipPaths, animations, and foreignObject elements are all handled correctly."
      },
      {
        "question": "Can I use this for icon system pipelines?",
        "answer": "Absolutely. The optimizer is ideal for standardizing SVG icons from multiple sources and reducing their file size for web font or inline SVG systems."
      }
    ],
    "relatedSlugs": [
      "svg-to-png",
      "html-formatter",
      "css-formatter",
      "html-minifier",
      "json-formatter"
    ]
  },
  "svg-to-png": {
    "longDescription": "<p>The SVG to PNG Converter transforms vector SVG graphics into rasterized PNG images at any specified resolution, directly in your browser. It's essential for generating pixel-perfect PNG assets from SVG source files for use in contexts that don't support SVG — social media uploads, email signatures, favicon generation, app store screenshots, and legacy application integrations.</p><p>Specify the exact output dimensions (width × height) or a scale factor (1x, 2x, 3x for retina displays) and the tool renders the SVG at that resolution using the browser's native SVG rendering engine. The result is a crisp, correctly scaled PNG with optional transparency preserved. You can preview the output before downloading and generate multiple sizes from a single SVG upload in batch mode.</p><p>Unlike server-side converters, this tool keeps your SVG source files entirely on your machine. There's no upload, no processing on external servers, and no waiting in a queue — just instant, private SVG-to-PNG conversion at whatever resolution your project requires.</p>",
    "features": [
      "Browser-based SVG rendering using native SVG engine (Canvas API)",
      "Custom output dimensions (width × height) or scale factor presets",
      "Retina-ready output at 2x and 3x scale factors",
      "Transparency (alpha channel) preservation in PNG output",
      "Batch conversion: generate multiple sizes from one SVG",
      "Zero-upload — SVG files never leave your browser"
    ],
    "howTo": [
      {
        "step": "Load SVG",
        "description": "Drag and drop an .svg file or paste SVG code into the tool. The graphic renders in the preview area."
      },
      {
        "step": "Set Output Size",
        "description": "Enter custom pixel dimensions or select a scale factor (1x, 2x, 3x) for the target PNG."
      },
      {
        "step": "Preview",
        "description": "See a live preview of the PNG output at the specified size before committing to the conversion."
      },
      {
        "step": "Download PNG",
        "description": "Click download to save the rasterized PNG file to your device, or batch-generate multiple sizes."
      }
    ],
    "faq": [
      {
        "question": "Does it preserve transparency?",
        "answer": "Yes. The alpha channel from the SVG is preserved in the PNG output, making it ideal for icons and graphics with transparent backgrounds."
      },
      {
        "question": "What's the maximum resolution I can export?",
        "answer": "The maximum is limited by your browser's canvas memory. For most modern browsers, you can export up to 16384×16384 pixels."
      },
      {
        "question": "Is my SVG file uploaded anywhere?",
        "answer": "No. The conversion uses the browser's Canvas API to render the SVG locally. No file data is ever transmitted to any server."
      }
    ],
    "relatedSlugs": [
      "svg-formatter",
      "html-formatter",
      "html-minifier",
      "image-compressor",
      "css-unit-converter"
    ]
  },
  "notepad": {
    "longDescription": "<p>BrainCoder's online notepad is a private, zero-install scratchpad that auto-saves as you type. Whatever you write is stored in this browser's local storage and is still there when you come back — a closed tab, a restart, or an accidental click away never costs you a note. Nothing is uploaded to any server, and there is no account to create.</p>\n<p>A note lives on this one device and in this one browser: clearing your site data, switching browsers, or using a private window removes it, so use the Save button to download anything important as a .txt file. A live word and character count keeps you oriented, long lines wrap automatically, and you can open an existing .txt or .md file and keep typing from where you left off.</p>\n<p>This notepad suits meeting minutes, to-do lists, and quick scratch work where a full editor would be overkill. Notes up to about 2 million characters auto-save without issues; for anything larger, download the file with Save and continue in a new note. Works offline once opened, and there is no sign-up to gate any of it.</p>",
    "features": [
      "Auto-saves as you type — your notes are stored in this browser only",
      "Nothing uploaded to a server, no account or sign-up required",
      "Live word and character count as you write",
      "One-click copy to clipboard and save as a .txt file",
      "Open existing .txt or .md files and keep writing",
      "Long lines wrap automatically in a clean, distraction-free editor"
    ],
    "howTo": [
      {
        "step": "Open the notepad",
        "description": "Navigate to the free online notepad tool on BrainCoder. The editor is ready with a blank canvas — just start typing."
      },
      {
        "step": "Write and let it save",
        "description": "Type your notes and the notepad auto-saves them in this browser as you go. The word count and a 'saved at' time in the corner confirm what has been stored — there is no Save button to click for this."
      },
      {
        "step": "Copy, download, or open a file",
        "description": "Click Copy to put the note on your clipboard, or click Save to download it as a .txt file with today's date in the filename. Use Open to bring an existing .txt or .md file back into the editor."
      }
    ],
    "faq": [
      {
        "question": "Are my notes stored on a server?",
        "answer": "No. Everything you type is saved to this browser's local storage only. Nothing is sent to BrainCoder's servers and no account is needed."
      },
      {
        "question": "Can I use this notepad offline?",
        "answer": "Yes on a device that has opened the page before. Once the notepad has loaded in your browser, the tool and your auto-saved notes work offline — typing, copying, and downloading are all local to your device."
      },
      {
        "question": "Is there a size limit?",
        "answer": "Notes are stored in this browser's local storage, which is typically capped around 5 MB. This notepad also limits a single note to about 2 million characters; past that point typing may slow down or the note may fail to save, so download it with Save and continue in a new note."
      },
      {
        "question": "Can I recover a note I cleared?",
        "answer": "No. Clear permanently deletes the local copy — there is no undo, sync, or trash. Copy or download anything important before clearing."
      },
      {
        "question": "Can someone else on this device see my notes?",
        "answer": "Yes. Notes are saved in this browser with no password protection, so anyone using the same browser profile on the same device can open this tool and read them. Use Clear when you are done on a shared device."
      }
    ],
    "relatedSlugs": [
      "word-counter",
      "text-lines",
      "text-cleaner",
      "text-to-pdf",
      "md-to-html"
    ]
  },
  "diff-checker": {
    "longDescription": "<p>BrainCoder's text diff checker is a powerful online tool that compares two pieces of text side by side and highlights every difference between them. Whether you're reviewing code changes, proofreading a document, or verifying that a translation is accurate, this tool makes it effortless to spot additions, deletions, and modifications at a glance. It's an essential utility for developers, writers, and anyone who works with text on a regular basis.</p>\n<p>The diff checker processes everything locally in your browser, so sensitive documents, confidential code, and proprietary content never leave your device. There's no need to upload files to a third-party server — just paste your original and modified text, and the tool instantly shows you a color-coded comparison. It works with plain text, code snippets, configuration files, and more.</p>\n<p>With its clean side-by-side layout and inline highlighting, BrainCoder's comparison tool helps you understand exactly what changed between two versions of any text. Whether you're merging pull requests, tracking document revisions, or simply comparing two versions of a paragraph, this tool delivers fast, accurate, and private text comparison right in your browser.</p>",
    "features": [
      "Side-by-side text comparison with color-coded differences",
      "Highlights additions, deletions, and modifications clearly",
      "Works with plain text, code, configs, and any text format",
      "Fully client-side — no data ever leaves your browser",
      "Line-by-line and word-level diff detection",
      "Copy results as a unified diff for sharing or documentation"
    ],
    "howTo": [
      {
        "step": "Paste Original Text",
        "description": "Copy your original text and paste it into the left panel of the diff checker. This is the baseline version you want to compare against."
      },
      {
        "step": "Paste Modified Text",
        "description": "Copy the modified or updated version of the text and paste it into the right panel."
      },
      {
        "step": "Compare and Review",
        "description": "Click the 'Compare' button. The tool shows the result side by side or as a single-file diff: added lines are highlighted in green, removed lines in red, and modified lines appear as a red/green pair with inline word- or character-level highlighting. The summary badge counts how many lines are unchanged, added, removed, and modified."
      },
      {
        "step": "Review and Copy the Diff",
        "description": "Review the comparison, then use 'Copy as unified diff' to copy the result to your clipboard for documentation, code review notes, or sharing with your team."
      }
    ],
    "faq": [
      {
        "question": "Is my text uploaded to any server?",
        "answer": "No. All text comparison happens entirely in your browser using JavaScript. Your text never leaves your device, making it safe for confidential or sensitive content."
      },
      {
        "question": "Can I compare code files?",
        "answer": "Yes. The diff checker works with any text, including source code, configuration files, JSON, YAML, and more. It compares the raw text regardless of format."
      },
      {
        "question": "How large can the texts be?",
        "answer": "Diffing runs entirely in your browser, so the practical limit is the memory of one browser tab. Texts up to a few thousand lines compare instantly; heavily rewritten files or hundreds of thousands of lines can run slowly or freeze the tab, so chunk very large inputs before comparing."
      }
    ],
    "relatedSlugs": [
      "notepad",
      "word-counter",
      "text-cleaner",
      "text-lines",
      "markdown-preview"
    ]
  },
  "word-counter": {
    "longDescription": "<p>BrainCoder's word and character counter tallies words, characters, sentences, paragraphs, lines, unique words, and reading and speaking time for any text. Counts update as you type or paste — useful for essays with a word limit, SEO content length checks, social posts, or simply measuring a document.</p>\n<p>Word and sentence counts are built on whitespace and punctuation tokenization, which is most accurate for space-delimited languages like English. Character counts, by contrast, count every character regardless of script, so they stay accurate for Chinese, Japanese, Korean, Arabic and any other writing system. Decimals and common abbreviations (Mr., e.g., 3.14) no longer inflate the sentence count.</p>\n<p>Like all BrainCoder tools this runs entirely in your browser with a 1,000,000-character limit — your text is never uploaded to a server, so it's safe for confidential writing.</p>",
    "features": [
      "Real-time word, character, sentence, paragraph and line counts",
      "Character counts with and without spaces — accurate for any script",
      "Unique word count, and reading and speaking time estimates",
      "Sentence counting that ignores decimals and common abbreviations",
      "1,000,000-character input limit keeps paste-heavy use fast",
      "100% private — all counting happens in your browser, nothing uploaded"
    ],
    "howTo": [
      {
        "step": "Type or paste your text",
        "description": "Add any text; the counters update in real time as content is added or removed."
      },
      {
        "step": "Review the statistics",
        "description": "Check words, characters (with and without spaces), sentences, paragraphs, lines, unique words and estimated reading/speaking time."
      },
      {
        "step": "Clear to start fresh",
        "description": "Press Clear to blank the input (disabled when already empty) before counting the next document."
      }
    ],
    "faq": [
      {
        "question": "What counts as a word?",
        "answer": "A word is any run of letters or digits, including contractions and hyphenated terms (don't, state-of-the-art) and decimal numbers such as 3.14. Standalone punctuation like '.' or '-' is not counted as a word."
      },
      {
        "question": "Does it count Chinese, Japanese or Korean words?",
        "answer": "Character counts are accurate for every script including CJK. Word counts are based on whitespace tokens, which is the natural definition for space-delimited languages like English — for unspaced scripts such as Japanese or Chinese, use the character count instead."
      },
      {
        "question": "How are sentences counted?",
        "answer": "A sentence is a group of text ending in '.', '!', '?', '。', '！' or '？'. Periods inside decimals (3.14) and common abbreviations (Mr., Dr., e.g., etc.) are ignored so those don't split a sentence."
      },
      {
        "question": "Is there an input limit?",
        "answer": "Yes — the counter covers the first 1,000,000 characters."
      },
      {
        "question": "Is my text stored anywhere?",
        "answer": "No. All counting is performed locally in your browser. Your text is never transmitted to a server or saved beyond the current page session."
      }
    ],
    "relatedSlugs": [
      "notepad",
      "text-lines",
      "text-cleaner",
      "diff-checker",
      "unicode-styles"
    ]
  },
  "text-lines": {
    "longDescription": "<p>BrainCoder's text line tools let you manipulate lines of text with ease — add line numbers, remove blank lines, trim whitespace, sort lines, remove duplicates, and more. Whether you're cleaning up a list of data, preparing input for a script, or formatting text for a document, these line manipulation tools save you from tedious manual editing. Everything happens in your browser for instant, private results.</p>\n<p>Working with lines of text is a daily task for developers, data analysts, and content creators. BrainCoder streamlines this with a suite of line-focused utilities: add sequential line numbers, strip empty lines from messy paste output, trim leading and trailing spaces from every line, sort alphabetically or numerically, and deduplicate entries. Each operation is one click away, with no need for command-line tools or complex text editors.</p>\n<p>All processing happens client-side, so your data never leaves your device. This makes the tool ideal for working with sensitive data like API keys, configuration entries, server logs, or any text you don't want to upload. It's fast, free, and works on any device with a modern browser.</p>",
    "features": [
      "Add sequential line numbers to any text instantly",
      "Remove blank and empty lines from pasted content",
      "Trim leading and trailing whitespace from every line",
      "Sort lines alphabetically, numerically, or in reverse order",
      "Remove duplicate lines with one click",
      "All processing runs locally in your browser"
    ],
    "howTo": [
      {
        "step": "Paste Your Text",
        "description": "Copy the lines of text you want to manipulate and paste them into the text area. This can be a list, code, log output, or any multi-line content."
      },
      {
        "step": "Choose a Line Tool",
        "description": "Select the operation you need from the toolbar — add line numbers, remove blank lines, trim whitespace, sort lines, or remove duplicates."
      },
      {
        "step": "Get Results Instantly",
        "description": "The tool applies the selected operation immediately. Copy the processed text to your clipboard or download it as a file."
      }
    ],
    "faq": [
      {
        "question": "Can I combine multiple operations?",
        "answer": "Yes. You can apply operations sequentially — for example, first remove blank lines, then trim whitespace, then sort the remaining lines. Each operation works on the current state of the text."
      },
      {
        "question": "Is this tool good for cleaning CSV data?",
        "answer": "Absolutely. Removing blank lines, trimming whitespace, and deduplicating are common tasks when preparing CSV data. This tool handles all of those efficiently."
      },
      {
        "question": "Does it preserve the original line order?",
        "answer": "Most operations preserve order. The sort function reorders lines, but adding line numbers, trimming, and removing duplicates maintain the original sequence."
      }
    ],
    "relatedSlugs": [
      "word-counter",
      "text-cleaner",
      "notepad",
      "diff-checker",
      "csv-json"
    ]
  },
  "text-size-calculator": {
    "longDescription": "<p>The Text Size Calculator measures any text — plain prose, code, JSON, logs, config files, or pasted clipboard content — in UTF-8 bytes, UTF-16 bytes, characters, words and lines, updating live as you type or paste. Sizes are shown in human-readable B, KB and MB units, so you can instantly answer questions like &quot;how big is this string in bytes?&quot; or &quot;does this JSON payload fit an API limit?&quot;.</p><p>Toggle &quot;Exclude whitespace&quot; to see the same metrics with spaces, tabs and line breaks removed — ideal for estimating minified payload size or storage budgets. When the input is valid JSON, the tool offers minify and beautify actions with copy buttons and a size reduction percentage. For non-JSON text it provides a whitespace-collapse preview and clearly notes that full minify and beautify require valid JSON. An optional file picker measures any text file&apos;s real on-disk byte count and loads its contents for full metrics.</p><p>All counting happens in your browser with the native TextEncoder API — nothing is uploaded, stored, or shared. This makes it safe for API keys, tokens, and any sensitive text.</p>",
    "features": [
      "Live UTF-8 and UTF-16 byte counts with human-readable B, KB and MB units",
      "Character, word, line and whitespace counts for all types of text",
      "Exclude-whitespace mode for minified-size and storage estimates",
      "Minify and beautify valid JSON with copy buttons and size reduction",
      "Whitespace-collapse preview for non-JSON text (honestly labeled)",
      "Open any text file to read its exact on-disk byte size",
      "100% client-side with the native TextEncoder API — nothing leaves your browser"
    ],
    "howTo": [
      {
        "step": "Type or Paste Your Text",
        "description": "Enter any text — code, logs, JSON, or copy — into the input. Byte and character metrics update live as you type."
      },
      {
        "step": "Toggle Whitespace Exclusion",
        "description": "Enable &quot;Exclude whitespace from size&quot; to see bytes and characters counted without spaces, tabs and newlines."
      },
      {
        "step": "Measure a File",
        "description": "Click &quot;Open file&quot; to read a text file&apos;s exact on-disk byte count and load its contents for full metrics."
      },
      {
        "step": "Minify or Beautify JSON",
        "description": "For valid JSON, copy a beautified or minified version with its byte size and reduction percentage. Non-JSON text gets an honest whitespace-collapse preview instead."
      }
    ],
    "faq": [
      {
        "question": "How is size measured without whitespace?",
        "answer": "The tool makes a temporary copy of your text with spaces, tabs and line breaks removed, then recomputes byte and character counts from that copy. It also shows how many bytes and characters were excluded. The original input is never modified."
      },
      {
        "question": "Which formats support minify and beautify?",
        "answer": "Only valid JSON gets full minify and beautify. If the input parses as JSON you get compact minified and pretty-printed outputs with copy buttons and character counts. Any other text — CSS, logs, or plain prose — reports metrics only, with a whitespace-collapse preview that is clearly labeled as an approximation."
      },
      {
        "question": "Why does emoji affect the byte count?",
        "answer": "Emoji and other supplementary-plane characters are encoded as multiple bytes: 4 bytes in UTF-8 and 4 bytes (two UTF-16 code units) in UTF-16. This tool counts characters as Unicode code points, so one emoji counts as a single character while still reporting its full byte weight."
      },
      {
        "question": "Is my data uploaded when I use this tool?",
        "answer": "No. All counting, minifying and formatting run entirely in JavaScript on your device using the native TextEncoder API. Nothing is transmitted or stored on any server."
      }
    ],
    "relatedSlugs": [
      "word-counter",
      "json-formatter",
      "text-cleaner",
      "text-lines",
      "gzip-tool"
    ]
  },
  "unicode-styles": {
    "longDescription": "<p>BrainCoder's unicode text styles tool lets you transform plain text into stylish Unicode variations — bold, italic, cursive, monospace, strikethrough, small caps, and more. These styled texts use Unicode characters rather than HTML or Markdown formatting, so they work everywhere: social media bios, chat messages, usernames, Discord nicknames, Instagram captions, and anywhere that doesn't support rich text formatting.</p>\n<p>Simply type or paste your text, choose a style from the available options, and copy the result. The tool generates multiple style variations instantly, including combinations like bold-italic, bold-cursive, and double-struck. This is perfect for personalizing your online presence, creating eye-catching headers, or adding visual emphasis to plain text environments.</p>\n<p>All text generation happens in your browser — nothing is uploaded or stored. The tool uses standard Unicode character mappings, so the styled text renders correctly on most modern devices and platforms. Whether you want a fancy username or a distinctive social media profile, this tool makes it effortless.</p>",
    "features": [
      "Generate bold, italic, cursive, monospace, and strikethrough text",
      "Combine styles like bold-italic and double-struck for unique looks",
      "Works on social media, chat apps, and anywhere plain text is used",
      "One-click copy for each generated style",
      "Uses Unicode characters — no HTML or Markdown needed",
      "Fully client-side with no data collection"
    ],
    "howTo": [
      {
        "step": "Enter Your Text",
        "description": "Type or paste the text you want to stylize into the input field. This could be your name, a username, a caption, or any short text."
      },
      {
        "step": "Browse Style Options",
        "description": "Scroll through the generated style variations — bold, italic, cursive, monospace, small caps, strikethrough, and more. Multiple combinations are shown for maximum variety."
      },
      {
        "step": "Copy and Use",
        "description": "Click the copy icon next to any style to copy it to your clipboard. Paste it wherever you want — social media bios, chat messages, email signatures, or documents."
      }
    ],
    "faq": [
      {
        "question": "Will styled text display correctly on all platforms?",
        "answer": "Most modern browsers, phones, and social media platforms support Unicode styled text. However, some older systems or very specific fonts may not render every character perfectly."
      },
      {
        "question": "Can I use this for my Instagram or TikTok bio?",
        "answer": "Yes. Unicode styled text is widely supported on Instagram, TikTok, Twitter/X, Discord, and many other platforms. Just copy and paste the styled text into your bio field."
      },
      {
        "question": "Is this different from HTML bold/italic?",
        "answer": "Yes. HTML formatting only works in web pages. Unicode styled text uses special characters that look like bold or italic but are actually plain text — so they work everywhere, including apps and platforms that don't support HTML."
      }
    ],
    "relatedSlugs": [
      "upside-down-text",
      "text-cleaner",
      "word-counter",
      "notepad",
      "diff-checker"
    ]
  },
  "upside-down-text": {
    "longDescription": "<p>BrainCoder's upside down text generator flips your text 180 degrees using Unicode characters, creating fun inverted text that you can use in social media posts, usernames, messages, and more. Simply type your text and watch it transform into its upside-down mirror image. The result is plain text (not an image), so it can be copied and pasted anywhere that accepts text input.</p>\n<p>This playful tool is perfect for adding humor to your online presence, creating unique social media bios, pranking friends in group chats, or making your Discord username stand out. The generated upside-down text uses Unicode characters that are universally supported, so it displays correctly on virtually all modern devices and platforms.</p>\n<p>Everything runs locally in your browser with no server involved. Your text is never transmitted or stored, so you can generate upside-down text with complete confidence in your privacy. It's free, instant, and endlessly entertaining.</p>",
    "features": [
      "Instantly flips text 180 degrees using Unicode characters",
      "Generates plain text that works everywhere — no images needed",
      "Perfect for social media bios, usernames, and chat messages",
      "One-click copy to clipboard for easy pasting",
      "Supports letters, numbers, and common punctuation",
      "Fully client-side with zero data collection"
    ],
    "howTo": [
      {
        "step": "Type Your Text",
        "description": "Enter any text into the input field — your name, a phrase, a joke, or anything you want to flip upside down."
      },
      {
        "step": "See the Flipped Result",
        "description": "The tool instantly generates the upside-down version of your text. Preview it to make sure it looks right."
      },
      {
        "step": "Copy and Share",
        "description": "Click the copy button to grab the flipped text. Paste it into your social media bio, chat messages, or anywhere you want to surprise people with upside-down writing."
      }
    ],
    "faq": [
      {
        "question": "How does upside-down text work?",
        "answer": "It uses Unicode characters that visually appear as inverted versions of Latin letters and numbers. These are real characters, not images, so they can be copied and pasted as plain text."
      },
      {
        "question": "Will it work on Instagram or Twitter?",
        "answer": "Yes. Upside-down text is widely supported on most social media platforms, messaging apps, and websites. It renders as plain text on virtually all modern systems."
      },
      {
        "question": "Does it support all characters?",
        "answer": "Most common Latin letters, numbers, and basic punctuation are supported. Some special characters or symbols may not have upside-down equivalents."
      }
    ],
    "relatedSlugs": [
      "unicode-styles",
      "text-cleaner",
      "word-counter",
      "notepad",
      "image-format-converter"
    ]
  },
  "text-cleaner": {
    "longDescription": "<p>BrainCoder's text cleaner removes extra spaces, line breaks, tabs, and other unwanted formatting from any text. Whether you've copied text from a PDF, a website, a Word document, or an email, it often comes with hidden formatting issues — extra whitespace, inconsistent line breaks, and stray characters. This tool cleans all of that up in one click, giving you pristine, ready-to-use text.</p>\n<p>The text cleaner is invaluable for developers cleaning up copied code, writers preparing text for publishing, data analysts normalizing messy input, and anyone who regularly pastes text between applications. It removes leading and trailing spaces, collapses multiple spaces into one, strips extra line breaks, and can optionally remove all non-ASCII characters or HTML tags.</p>\n<p>All text processing happens in your browser — your cleaned text is never uploaded or stored. It's a fast, private, and free solution for one of the most common everyday text frustrations. Clean your text in seconds without installing any software or signing up for any service.</p>",
    "features": [
      "Remove extra spaces, tabs, and blank lines in one click",
      "Strip HTML tags from copied web content",
      "Collapse multiple whitespace characters into single spaces",
      "Remove leading and trailing whitespace from every line",
      "Optionally remove all non-ASCII characters",
      "100% client-side processing for complete privacy"
    ],
    "howTo": [
      {
        "step": "Paste Your Messy Text",
        "description": "Copy text from any source — a PDF, email, website, or document — and paste it into the text cleaner's input area."
      },
      {
        "step": "Select Cleaning Options",
        "description": "Choose which cleaning operations to apply: remove extra spaces, strip line breaks, remove HTML tags, trim whitespace, or remove non-ASCII characters."
      },
      {
        "step": "Clean and Copy",
        "description": "Click the 'Clean' button and the tool applies your selected operations. Copy the cleaned text to your clipboard for immediate use."
      }
    ],
    "faq": [
      {
        "question": "Can it remove HTML tags from copied web text?",
        "answer": "Yes. One of the cleaning options strips all HTML tags, leaving only the plain text content. This is especially useful when copying content from web pages."
      },
      {
        "question": "Will it change the meaning of my text?",
        "answer": "The cleaner only removes whitespace and formatting characters — it doesn't alter the actual words or content of your text. Your meaning is always preserved."
      },
      {
        "question": "Can I clean text from PDFs?",
        "answer": "Yes. PDFs often introduce extra spaces, line breaks, and special characters when text is copied. The text cleaner handles all of these issues effectively."
      }
    ],
    "relatedSlugs": [
      "diff-checker",
      "word-counter",
      "text-lines",
      "notepad",
      "md-to-html",
      "text-to-pdf"
    ]
  },
  "image-compressor": {
    "longDescription": "<p>BrainCoder's image compressor shrinks a single image up to 50 MB in your browser. Pick a compression preset — Light, Balanced, or Strong — to balance file size and visual quality, optionally choose an output format (Auto prefers WebP or AVIF where your browser supports it, otherwise JPEG, PNG or WebP), and optionally resize to a 1920 or 1280 px longest edge that never upscales.</p>\n<p>Compression and resizing run entirely in a Web Worker on your device — nothing is uploaded to any server. The tool shows you a before-and-after size comparison along with the exact file size reduction percentage. If compressing would make the result bigger, your original is returned unchanged byte for byte, so the output is never larger than the upload.</p>\n<p>BrainCoder's image compressor is useful for web developers optimizing page load times, writers shrinking image attachments, and anyone who regularly works with images and wants fast, free, private compression with an honest guarantee.</p>",
    "features": [
      "Three compression presets — Light, Balanced, Strong",
      "Smart output format — Auto (WebP/AVIF where supported), JPEG, PNG or WebP",
      "Optional resizing to 1920 or 1280 px (never upscales)",
      "Your original is returned if compressing would make it larger",
      "Single image up to 50 MB, processed in your browser",
      "Shows the exact file size reduction percentage"
    ],
    "howTo": [
      {
        "step": "Upload One Image",
        "description": "Click or drag a single image up to 50 MB into the tool. The tool compresses one image at a time — there is no batch mode."
      },
      {
        "step": "Choose Compression, Format and Size",
        "description": "Pick Light, Balanced, or Strong, optionally choose an output format and a resize option, then click Compress Image. Your image stays on your device while it compresses."
      },
      {
        "step": "Download the Result",
        "description": "Review the size comparison and exact reduction percentage. Use Adjust settings to retry with another preset or format, download the result, or choose New image to start over."
      }
    ],
    "faq": [
      {
        "question": "How much can image file sizes be reduced?",
        "answer": "It depends on the image and the preset. Photos converting to WebP often shrink by a large margin; JPEG and PNG files that are already optimized may barely shrink or come back unchanged. There is no target size."
      },
      {
        "question": "Are my images uploaded to a server?",
        "answer": "No. All compression happens locally in your browser using JavaScript and Canvas APIs. Your images never leave your device."
      },
      {
        "question": "Can I compress multiple images at once?",
        "answer": "No — the tool compresses one image at a time. Run it again for the next image."
      },
      {
        "question": "Why is my result identical to the upload?",
        "answer": "If compressing would make the file bigger, the tool keeps your original byte for byte — the output is never larger. Choose a different preset or resize to get a smaller file."
      }
    ],
    "relatedSlugs": [
      "image-resizer",
      "image-format-converter",
      "image-filters",
      "image-editor",
      "image-splitter",
      "pdf-compressor"
    ]
  },
  "image-resizer": {
    "longDescription": "<p>BrainCoder's image resizer lets you quickly resize images to any custom dimensions — perfect for social media profiles, website banners, email headers, document inserts, and more. Just upload your image, enter the desired width and height, and download the resized version in seconds. You can lock the aspect ratio to prevent distortion or unlock it for custom dimensions.</p>\n<p>This tool is essential for anyone who works with images regularly. Social media platforms have specific image size requirements, websites need optimized dimensions for fast loading, and documents often require images at particular sizes. BrainCoder's resizer handles all these use cases with a simple, intuitive interface that requires no design software or technical expertise.</p>\n<p>Like all BrainCoder tools, the image resizer processes everything locally in your browser. Your photos and graphics never leave your device, making it safe to use for personal photos, proprietary designs, confidential documents, and any images you don't want uploaded to external servers. It's fast, free, and respects your privacy.</p>",
    "features": [
      "Resize to any custom width and height in pixels",
      "Popular preset sizes for social posts and screens",
      "Lock aspect ratio to prevent stretching or distortion",
      "Export the result as JPG, PNG, or WebP",
      "Preview the resized image and its file size before downloading",
      "Entirely client-side — nothing is uploaded"
    ],
    "howTo": [
      {
        "step": "Upload Your Image",
        "description": "Click the upload area or drop an image to load it. The image loads and shows its original width and height."
      },
      {
        "step": "Set Target Dimensions",
        "description": "Enter a target width and height or choose a common preset. Keep the aspect-ratio lock on to stay in proportion, or turn it off for free-form dimensions."
      },
      {
        "step": "Preview and Download",
        "description": "Click 'Resize image', preview the result, then click 'Download' to save it. The new dimensions and file size are shown."
      }
    ],
    "faq": [
      {
        "question": "Will resizing distort my image?",
        "answer": "If you keep the aspect ratio lock enabled, proportions are maintained and no distortion occurs. If you unlock it and enter non-proportional dimensions, the image will stretch to fit. Target sizes are capped at 8,192 px per side for safety."
      },
      {
        "question": "What's the maximum size I can resize to?",
        "answer": "Target dimensions are capped at 8,192 pixels per side, and files larger than 50 MB are rejected. Browsers also impose their own canvas and memory limits, so very large enlargements may still fail — try a smaller target size."
      },
      {
        "question": "Does resizing reduce image quality?",
        "answer": "Enlarging a small image will reduce quality because pixels need to be interpolated. Shrinking images typically maintains or improves perceived quality. The tool uses high-quality resampling algorithms."
      },
      {
        "question": "Do resized images keep my metadata (EXIF/GPS)?",
        "answer": "No — the resized copy is re-encoded in your browser and does not carry over EXIF, GPS, or other metadata. Animated images are exported as their first frame."
      }
    ],
    "relatedSlugs": [
      "image-compressor",
      "image-format-converter",
      "image-filters",
      "image-editor",
      "image-splitter"
    ]
  },
  "image-editor": {
    "longDescription": "<p>BrainCoder's image editor is a canvas editor that runs entirely in this browser tab. Open a PNG, JPEG, GIF, WebP or BMP file and you can crop it, rotate it in 90&deg; steps, mirror it, resize it by a uniform percentage, adjust brightness, contrast and saturation, apply a filter, draw on it, and download the result as PNG, JPEG or WebP. The image is decoded and edited on your device and is never uploaded, so a passport photo, a client deliverable or a screenshot of something private stays on your machine.</p><p>The operations are exact rather than approximate. Rotation, mirroring and cropping move pixels: nothing is resampled, nothing softens, and a crop you set is stored in the image's own coordinates so it survives a later rotation or mirror. Resizing is the one operation that resamples, and it is the browser's own resampler &mdash; enlarging interpolates between the pixels you already have and cannot invent detail. That is not an AI upscaler, and this tool does not pretend to be one. One scale is applied to both axes, so an image is never stretched or squashed by a resize.</p><p>Adjustments and filters are computed per pixel in this tab, after the resize and before the annotations, and are baked into the downloaded file rather than being a view-only effect. Annotations &mdash; brush, line, rectangle, arrow and text &mdash; are recorded in the image's own coordinates, so a stroke you draw now is still in the same place after a later crop, rotation or resize, and it is stored in the file's output pixels so a thin stroke exports thin. They are also baked into the same single canvas the file is written from, so there is nothing to re-order, re-select or move afterwards, and no PSD to save.</p><p>The caps are stated rather than hidden, and every one of them refuses instead of quietly adjusting your image: 25 MB per input file, 16 megapixels and 8192 px per side on the output, an 8 px minimum on a side, and a 10%&ndash;400% scale range. An export that would not fit is refused with the largest scale that would, and the file you get back is the file that was measured. The format is read from the file's own header bytes, so a file that only <em>claims</em> to be a PNG is rejected before a decoder is handed it.</p><p>What this editor is not, in full: there are no layers, no PSD, no selection or healing tools, no AI, and no HEIC, AVIF or RAW support. Every download is encoded again from the pixels on screen, so re-exporting an untouched JPEG is a second lossy generation &mdash; PNG is the only lossless choice here. JPEG has no transparency, so transparent pixels are composited on white. The browser applies a photo's EXIF orientation flag on the way in and nothing else is carried out, so no camera, GPS, timestamp or ICC profile survives, and a wide-gamut photo can shift slightly in untagged sRGB. GIF and animated WebP arrive as their first frame only, and an animated file loses every frame after it.</p>",
    "features": [
      "Runs in this tab on a canvas: the image is decoded, edited and encoded on your device and is never uploaded",
      "PNG, JPEG, GIF, WebP and BMP, identified from the file's real header bytes rather than its name or extension",
      "Exact 90&deg; rotation, horizontal and vertical mirroring, and cropping &mdash; pixels move, nothing is resampled",
      "A crop stored in the image's own coordinates, so it survives a later rotation or mirror",
      "Uniform 10%&ndash;400% resize that applies one scale to both axes, so nothing is stretched",
      "Brightness, contrast and saturation plus grayscale, sepia, invert, cool and warm filters, computed per pixel and baked into the export",
      "Brush, line, rectangle, arrow and text annotations, recorded in the image's own coordinates and in output pixels",
      "A 30-step undo, plus a reset that returns the image to exactly how it was opened",
      "PNG, JPEG and WebP export, with the encoder's own 0.30&ndash;1.00 quality argument on the two lossy formats and no quality slider on PNG",
      "A file name that says what is in it: real size, rotation, mirror, crop, scale, filter and whether it was adjusted or annotated",
      "A crop you can type as well as drag, so every operation is reachable with a keyboard alone",
      "Caps with real numbers, refused rather than adjusted: 25 MB in, 16 MP and 8192 px per side out, 8 px minimum per side"
    ],
    "howTo": [
      {
        "step": "Open an image",
        "description": "Click Open image and choose a PNG, JPEG, GIF, WebP or BMP file. The format is confirmed from the file's header bytes before it is decoded, so a file that only pretends to be an image is refused up front. The file may be up to 25 MB, 16 megapixels and 8192 px on the long side, and an image past any of those is rejected with its real numbers rather than cropped or downsampled."
      },
      {
        "step": "Crop, rotate, mirror and resize",
        "description": "Rotation and mirroring are exact &mdash; press 90&deg;, 180&deg; or 270&deg;, or mirror left&ndash;right or top&ndash;bottom, and pixels move without being resampled. Press Crop to see the whole frame, then drag a rectangle on it, or type X, Y, width and height and press Enter; a crop is at least 8 × 8 px, is clamped inside the image, and is kept in the image's own coordinates so a later rotation carries it. Set a scale from 10% to 400% with the slider, the field or a preset: one scale is applied to both axes, so the aspect ratio never changes."
      },
      {
        "step": "Adjust, filter and annotate",
        "description": "Brightness, contrast and saturation run from &minus;100% to +100%, and the filters are grayscale, sepia, invert, cool and warm. Both are computed per pixel in this tab and baked into the download, not shown as a view-only effect. Choose Brush, Line, Rectangle, Arrow or Text and draw on the image; a stroke is simplified to at most 400 points, and a text stamp keeps the font and size it was placed with and is limited to 120 characters. Annotations are recorded in the image's own coordinates, so they travel through any later crop, rotation or resize."
      },
      {
        "step": "Download, and check what you are getting",
        "description": "Pick PNG, JPEG or WebP and press Download. The file is named for what it actually contains &mdash; for example photo-800x600-crop400x300-grayscale-annotated.png &mdash; so two different edits never collide. The result panel shows the exact file you downloaded, rendered from the same bytes, and any further edit clears it so a stale export cannot be saved again. PNG is lossless; JPEG and WebP are encoded at the quality you set, JPEG composites transparency on white, and if your browser has no WebP encoder you get PNG and the file is named for the bytes you actually received."
      }
    ],
    "faq": [
      {
        "question": "Is my image uploaded to a server?",
        "answer": "No. The file is read with the browser's own file API, decoded to a canvas in this tab, edited, and encoded back to a file in memory. There is no request for your image, no account, and nothing to install. Refresh the page and the pixels are gone."
      },
      {
        "question": "Does rotating, mirroring or cropping lose quality?",
        "answer": "No. Those three operations move pixels: a rotation by 90&deg; or a mirror is an exact rearrangement, and a crop discards the pixels outside the rectangle. None of them resamples, so none of them softens the image. Resizing is the only operation that resamples, and enlarging it interpolates between the pixels you have &mdash; it cannot invent detail, and it is not an AI upscaler."
      },
      {
        "question": "Why was my download refused instead of just being made smaller?",
        "answer": "Because you asked for a specific image and a different one is not what you asked for. The output is capped at 16 megapixels and 8192 px per side, with a minimum of 8 px per side. Rather than quietly shrinking the file, the editor refuses it and tells you the largest scale that would fit, or the crop to make first. The last render that did fit stays on screen while it is refused."
      },
      {
        "question": "Can I undo an edit?",
        "answer": "Yes &mdash; up to 30 changes, including a crop drag, which counts as one change rather than one per mouse movement. Reset edits returns everything at once: the rotation, the mirror, the crop, the scale, the adjustments, the filter and the annotations. There is no redo; undo is a step backwards through your own history for the image that is open right now."
      },
      {
        "question": "What happens to my photo's metadata, colour profile and animation?",
        "answer": "They do not survive. The browser decodes the pixels, and everything that is not pixels is dropped on the way in: no EXIF, no camera, no GPS, no timestamps, and no ICC profile. Output is untagged sRGB, so a wide-gamut photo can shift slightly. The one EXIF field that changes what you see is the orientation flag, and the browser applies it on the way in, so a sideways phone photo arrives upright. GIF and animated WebP are flattened to their first frame, and every frame after it is lost."
      },
      {
        "question": "Does the export always match the preview?",
        "answer": "It matches, with two disclosed differences. The on-screen canvas is capped at 1200 px on the long side so a large image still repaints, while the download is always rendered at the full output size &mdash; below that cap the two are the same pixels. And the encoder is a real one: re-exporting an untouched JPEG is a second lossy generation, so PNG is the only lossless choice here. The result panel shows the downloaded file itself, from the same bytes, so you can see which one you got."
      },
      {
        "question": "Is this a replacement for Photoshop or GIMP?",
        "answer": "No. It covers the everyday edits &mdash; crop, rotate, mirror, resize, adjust, filter, annotate, export &mdash; and does them locally with nothing installed. There are no layers, no PSD, no selection tools, no healing, no content-aware fill and no AI. For compositing, layer work or retouching, use a full editor."
      }
    ],
    "relatedSlugs": [
      "image-resizer",
      "image-compressor",
      "image-format-converter",
      "image-filters",
      "image-splitter"
    ]
  },
  "image-ocr": {
    "longDescription": "<p>BrainCoder's image OCR tool guesses the printed text in a picture and hands it back as plain text you can copy or download. Open a PNG, JPEG, GIF, WebP or BMP file, pick the language the text is written in, and press Extract — the recognizer runs as a WebAssembly build of Tesseract in your browser tab. Nothing is uploaded: the image, the recognizer and the language model are all read locally or served from this site's own origin, so a contract, a payslip, an ID or a whiteboard photo never reaches a server.</p><p>Twelve languages ship with the tool, each with its own model downloaded on that language's first use and then cached by your browser: English, Spanish, French, German, Portuguese, Italian, Russian, Hindi, Arabic, Chinese (simplified), Japanese and Korean. They are separate models, one per run — you cannot read a Danish page and its English header in a single pass, and each model is a real download you can see the size of before you start (English is about 3.0 MB gzipped, French about 0.7 MB, Japanese about 2.0 MB).</p><p>The limits are stated rather than hidden, and a file over any of them is refused with its actual numbers instead of being quietly cropped or shrunk: 25 MB per file, 16 megapixels per image and 8192 px on the long side. The format is confirmed from the file's own header bytes before the image is decoded, so a file that only <em>claims</em> to be a PNG is rejected instead of failing somewhere inside the recognizer. Output is cleaned up before you see it — CRLF and form-feed line breaks become plain newlines, runs of trailing spaces are trimmed and runs of blank lines are collapsed — and it is offered as clipboard text and as a <code>.txt</code> file named after your image.</p><p>What OCR is: a guess. Tesseract scores its own output, and this tool shows you that score with a plain description of what it means, because a number on its own tells you nothing. The engine is reliable on clean, straight, evenly lit printed text and it is unreliable on handwriting, stylised fonts, skew, shadows and low-contrast photographs. Two things happen to a very large photo that this tool does not control: the engine downsamples it before recognising, and the file's EXIF rotation flag is not applied, so a phone photo shot sideways comes out sideways. Scans at roughly 300 DPI and deskewed, evenly lit crops are the input this engine was built for — read every result over before you rely on it.</p>",
    "features": [
      "Runs Tesseract as WebAssembly in this tab — the image is decoded and read on your device and is never uploaded",
      "12 languages: English, Spanish, French, German, Portuguese, Italian, Russian, Hindi, Arabic, Chinese (simplified), Japanese and Korean, one model per run",
      "Each language model is served from this site's own origin — not a third-party CDN — downloaded on that language's first use and cached by the browser afterwards, with its size shown before you start",
      "PNG, JPEG, GIF, WebP and BMP, confirmed from the file's real header bytes before the image is decoded",
      "Disclosed caps with real numbers on refusal: 25 MB per file, 16 megapixels per image, 8192 px on the long side — no silent cropping or downsampling",
      "Live progress from the engine's five own stages, with a Cancel button that actually stops the run",
      "The engine's own confidence score is reported with a plain description of what it means, not as a claim of accuracy",
      "Copy the cleaned text in one click, or download a .txt named <image>-ocr-<language>.txt",
      "Fully client-side, no account, and nothing to install"
    ],
    "howTo": [
      {
        "step": "Open an image",
        "description": "Click Open image and choose a PNG, JPEG, GIF, WebP or BMP file of a page, screenshot, receipt, invoice or photo of printed text. The format is read from the file's header bytes, so a file that only pretends to be an image is refused up front. The file may be up to 25 MB, 16 megapixels and 8192 px on the long side; an image past any of those is rejected with its real numbers."
      },
      {
        "step": "Pick the language of the text",
        "description": "Choose from 12 models — English, Spanish, French, German, Portuguese, Italian, Russian, Hindi, Arabic, Chinese (simplified), Japanese or Korean. One model runs per pass, and the panel shows how large that model's download is before you commit. It is fetched from this site's own origin on that language's first use and cached by the browser afterwards."
      },
      {
        "step": "Extract, and watch the real stages",
        "description": "Press Extract text. The panel reports the recognizer's own stages — loading the engine, initializing it, downloading the language model, starting the API, recognizing text — with a percentage, and Cancel stops the run instead of leaving a WebAssembly thread working in the background. A large photo takes noticeably longer than a cropped scan."
      },
      {
        "step": "Read the result over before you trust it",
        "description": "The text is shown with character, word and line counts, the elapsed time, and the engine's confidence score with a description of what that score means — it is the recognizer's opinion of its own guesses, not a measurement of how much of your text is correct. Copy puts the cleaned text on your clipboard, and Download writes the same text to <image>-ocr-<language>.txt. Empty text is reported as a result too, with the fixes that usually help: a larger, straighter, better-lit scan of the same page."
      }
    ],
    "faq": [
      {
        "question": "How accurate is this?",
        "answer": "It is a guess, and the tool says so. Tesseract is strong on clean, straight, evenly lit printed text and weak on handwriting, stylised fonts, skew, shadows and low-contrast photographs. A scan at roughly 300 DPI beats a 12-megapixel phone photo, and the confidence score shown with each result is the recognizer's assessment of its own output, not a guarantee. Always read the extracted text over before relying on it."
      },
      {
        "question": "Which languages are supported, and can it read more than one at once?",
        "answer": "Twelve, one model per run: English, Spanish, French, German, Portuguese, Italian, Russian, Hindi, Arabic, Chinese (simplified), Japanese and Korean. A single pass uses a single model, so a page with a Danish body and an English header needs two runs, and the model has to match the script of the text you want. The panel shows the download size of whichever model you pick."
      },
      {
        "question": "Is my image uploaded anywhere?",
        "answer": "No. The image is decoded and recognized in your tab. The engine, its WebAssembly core and the language model are all served from this site's own origin rather than a third-party CDN, and the model is downloaded to your browser and cached there. The image bytes themselves never leave the device — refresh the page and they are gone."
      },
      {
        "question": "Why was my image refused?",
        "answer": "Three caps, all reported with your real numbers: 25 MB per file, 16 megapixels per image, and 8192 px on the long side. Separately, the file has to actually be a PNG, JPEG, GIF, WebP or BMP according to its header bytes — a renamed .txt or a corrupt file is rejected with that reason instead of failing later. This tool refuses rather than cropping or downsampling, so the file you get back is the file that was read."
      },
      {
        "question": "Why is the text wrong, missing or sideways?",
        "answer": "Three separate things. OCR quality follows the input: heavy skew, shadows, stylised fonts and handwriting are where it breaks. The engine downsamples a very large image before recognizing it, which is usually why a 12-megapixel phone photo does worse than a cropped scan. And EXIF rotation is not applied, so a photo shot sideways stays sideways — rotate it first and re-run."
      }
    ],
    "relatedSlugs": [
      "image-format-converter",
      "image-compressor",
      "image-resizer",
      "image-editor",
      "text-cleaner"
    ]
  },
  "md-to-html": {
    "longDescription": "<p>BrainCoder's Markdown to HTML converter turns Markdown into an HTML fragment you can paste straight into a page, an email, a CMS field or a component. It parses CommonMark plus the GitHub extensions — headings, ordered and unordered lists, tables, fenced code with a language class, task lists, strikethrough, blockquotes, links and images with alt text — and the HTML pane updates as you type. A Preview tab renders exactly the same HTML, so the string you copy is the string you looked at.</p>\n<p>The output is sanitized before it is shown, copied or downloaded. Raw inline HTML inside your Markdown is rendered as HTML, then the whole document is filtered against an allowlist: <code>&lt;script&gt;</code>, event handlers such as <code>onclick</code>, unsafe URLs like <code>javascript:</code>, iframes, <code>&lt;style&gt;</code>, embedded SVG and form controls are removed, tags outside the allowlist are unwrapped (their text survives, the tag does not), an <code>&lt;a&gt;</code> that loses an unsafe URL keeps its text but loses the <code>href</code>, and HTML comments are dropped.</p>\n<p>There is an optional highlight step for reading code quickly: the checkbox wraps fenced code in <code>&lt;span class=\"tok tok-keyword\"&gt;</code> markup. It comes from a small built-in highlighter for JavaScript, TypeScript, JSON, HTML, CSS, Python, shell, SQL, YAML and Markdown — it is regex-based, not a full parser, so unusual syntax can be mis-marked. It is off by default, so the HTML you normally copy stays clean.</p>\n<p>Everything runs in this tab. The Markdown, the generated HTML and any file you open are read locally and nothing is uploaded. The input is capped at 200,000 characters — the editor stops accepting input at the cap and a larger file is refused with the limit stated. Copy writes the exact sanitized fragment; Download writes a standalone HTML document (a doctype, a charset tag, one inline stylesheet and no scripts) named after the file you opened, or after the name you type, with <code>markdown.html</code> as the disclosed placeholder when you are pasting.</p>",
    "features": [
      "CommonMark and GitHub-flavored output: headings, lists, tables, fenced code, task lists, strikethrough, quotes, links and images",
      "Every fragment is sanitized against an allowlist before you copy, preview or download it",
      "HTML pane for the source and a Preview tab that renders exactly that same HTML",
      "One-click copy of the exact sanitized fragment to your clipboard",
      "Download a standalone .html file — doctype, charset, inline stylesheet, no scripts — named from the file you opened or an editable name",
      "Optional, off-by-default highlight tokens for fenced code, from a small regex-based built-in highlighter",
      "Fully client-side with nothing uploaded, and a disclosed 200,000 character cap"
    ],
    "howTo": [
      {
        "step": "Paste or open your Markdown",
        "description": "Type or paste Markdown on the left, or use Open .md file to load a .md, .markdown, .mdown or .txt file from disk. The file is read inside the tab and the download name follows the file name. Input is capped at 200,000 characters."
      },
      {
        "step": "Read the HTML",
        "description": "The HTML pane shows the sanitized fragment as you type. Switch to Preview to render exactly that HTML — both views are built from one string, so what you copy is what you saw."
      },
      {
        "step": "Know what the sanitizer removed",
        "description": "Raw inline HTML in your Markdown is kept as HTML, then filtered: scripts, event handlers such as onclick, unsafe URLs, iframes, styles, embedded SVG and form controls are removed, and tags outside the allowlist are unwrapped. The note under the panes repeats this list in the tool."
      },
      {
        "step": "Copy or download",
        "description": "Copy HTML puts the exact sanitized fragment on your clipboard. Download writes a standalone page around that same fragment, named from the source file or from the Download name field, whose default of markdown.html is a placeholder — this is a paste tool, so there is no file of its own."
      }
    ],
    "faq": [
      {
        "question": "Is the output safe to paste into a page?",
        "answer": "The fragment is filtered through an allowlist before it is shown, copied or downloaded: scripts, event handlers, unsafe URLs, iframes, styles, embedded SVG and form controls do not survive, and anything outside the allowlist is unwrapped. It is still HTML you wrote, so read the preview before publishing, and do not treat the sanitizer as a replacement for a Content-Security-Policy."
      },
      {
        "question": "What happens to raw HTML written inside my Markdown?",
        "answer": "Inline HTML is rendered as HTML first, then the allowlist filter runs over the whole document. Allowlisted tags such as <mark>, <sub> or <kbd> stay as they are, comments and doctypes are dropped, and every other tag is unwrapped so its text survives without the tag. A <a> that loses an unsafe URL keeps its text but loses the href."
      },
      {
        "question": "Does it support GitHub Flavored Markdown?",
        "answer": "Yes. GFM tables, task lists, strikethrough, autolinks and fenced code blocks with a language class work on top of CommonMark. It adds no extensions of its own, and it is a converter rather than a static site generator: it emits an HTML fragment, not a site."
      },
      {
        "question": "Is the code highlighting real?",
        "answer": "There is a small built-in highlighter and it is honest about its limits: it is regex-based rather than a full parser, it covers JavaScript, TypeScript, JSON, HTML, CSS, Python, shell, SQL, YAML and Markdown, it can mis-mark unusual syntax, and it is off by default. Turn it on only when you want to read code in the pane — the tokens travel into the copied and downloaded HTML when you do."
      },
      {
        "question": "Is my Markdown uploaded to a server?",
        "answer": "No. Parsing, sanitizing, highlighting and reading the file all run in the tab, and nothing is uploaded. The 200,000 character cap is the only size limit."
      },
      {
        "question": "Why is the download called markdown.html?",
        "answer": "Because there is no source file when you paste — markdown.html is a placeholder and the tool says so under the name field. Open a file and the download becomes <source>.html (notes.md becomes notes.html), and you can edit the name at any time; path separators and other unsafe characters are replaced."
      }
    ],
    "relatedSlugs": [
      "markdown-preview",
      "html-minifier",
      "html-to-pdf",
      "html-to-image",
      "notepad"
    ]
  },
  "html-to-pdf": {
    "longDescription": "<p>BrainCoder's HTML to PDF converter turns pasted HTML into a downloadable, paginated A4 PDF — entirely in your browser. It reads your markup directly as text: headings, paragraphs, ordered and unordered lists, tables, blockquotes, preformatted code, horizontal rules, bold, italic, code spans and line breaks all become real, selectable text in the PDF. Nothing is sent to a server.</p>\n<p>This is a document converter, not a screenshot tool. Each run lays your content out across A4 pages with sensible margins, wraps long words, keeps headings with the text that follows them, and repeats table headers on every page a table spans. If your HTML has no <code>&lt;h1&gt;</code>, the document title you set is used as one.</p>\n<p>It is built for invoices, reports, specs, changelogs, generated documentation and archived HTML emails. Because it works on text rather than pixels, advanced CSS and layout are simplified rather than reproduced: colours, custom fonts, borders, backgrounds, images, floats, grids, flexbox, positioning and inline styling are not carried over. Script and style blocks are removed, so the PDF never contains them. Each conversion is capped at 200 KB of input and 200 pages of output, and both limits are reported in the interface.</p>",
    "features": [
      "Convert HTML code to a paginated A4 PDF with real, selectable text",
      "Understands headings, paragraphs, lists, tables, blockquotes, preformatted code and rules",
      "Honours bold, italic and monospace spans, plus inline text-align on table cells",
      "Keeps headings with the text below them and repeats table headers across pages",
      "Shows the laid-out first page as text before you rely on the download",
      "Reports dropped elements, replaced characters and the page cap instead of hiding them",
      "Up to 200 KB of HTML and 200 pages per conversion",
      "100% client-side — your HTML and the resulting PDF never leave your browser"
    ],
    "howTo": [
      {
        "step": "Paste or open your HTML",
        "description": "Type or paste markup into the source box, or open a .html file from disk. The input area shows how much of the 200 KB limit you have used."
      },
      {
        "step": "Set the document title",
        "description": "Give the file a title. It becomes the PDF title metadata and, if your markup has no <h1>, the document's first heading."
      },
      {
        "step": "Convert and check the report",
        "description": "Click 'Convert to PDF'. The page count, the file name and the first page as it was laid out appear underneath, along with any warnings about skipped elements, characters that had to be replaced, or hitting the 200-page cap."
      },
      {
        "step": "Download or re-download",
        "description": "The PDF is generated and downloaded automatically. If you tweak the source and convert again, 'Download again' re-saves the last build."
      }
    ],
    "faq": [
      {
        "question": "Is the PDF a screenshot or real text?",
        "answer": "Real text. The PDF is drawn with the standard PDF fonts, so you can search, select, copy and read it aloud. Nothing is rasterized and no image is embedded."
      },
      {
        "question": "Will it keep my CSS?",
        "answer": "No. CSS is not applied, and that is deliberate. Structure and inline emphasis are converted; colours, fonts, borders, backgrounds, positioning, floats, grids and flexbox are not reproduced. If you need a pixel-perfect copy of a rendered page, print that page to PDF from your browser instead."
      },
      {
        "question": "What happens to images, scripts and styles?",
        "answer": "Script and style blocks, images, embedded media, SVG and form controls are dropped, and the count is reported after each conversion. An image with alt text leaves an '[image omitted: ...]' line so you can see what was there."
      },
      {
        "question": "Can it handle multi-page HTML content?",
        "answer": "Yes. Content flows onto additional A4 pages automatically, table headers repeat on each page a table spans, and output stops at 200 pages with a clear notice when the cap is reached."
      },
      {
        "question": "Which characters are supported?",
        "answer": "The standard PDF fonts cover WinAnsi. Characters outside that set, and characters that break nesting such as a stray < or &, are replaced with '?' and counted in the report rather than being dropped silently."
      },
      {
        "question": "Is my HTML content uploaded to a server?",
        "answer": "No. Parsing, layout and PDF generation all run in your browser, and your HTML is never rendered or executed as a page. Your content and the resulting PDF never leave your device."
      }
    ],
    "relatedSlugs": [
      "text-to-pdf",
      "word-to-pdf",
      "md-to-html",
      "html-to-image",
      "notepad"
    ]
  },
  
"html-to-image": {
    "longDescription": "<p>BrainCoder's HTML to image tool paints a live preview of your markup on this page and re-draws it into a PNG, JPEG or WebP file that is saved straight to your device. You choose a capture width, a scale between 1x and 4x, and a format; the file is written from the same bytes you can copy to the clipboard or download again from the result panel.</p>\n<p>The scale is the honest part of this tool. It is the device-pixel multiplier, not a vague quality slider: at 2x, a 480 px wide box becomes a 960 px wide image, because every CSS pixel is painted as two image pixels. The preview shows the measured box before you commit, the projected output size is printed next to the control, and if the requested scale would exceed the 16 MP / 8192 px capture budget the tool lowers the scale — never below 1x — and tells you the number it actually used. It will not quietly render a smaller image and label it as the size you asked for.</p>\n<p>This is a re-draw, not a screen photograph. The renderer reads each element's computed style and repaints it with the canvas 2D API, which is why browsers can load your web fonts and lay out your flex and grid exactly as they already do, and why a handful of effects are missing: <code>filter</code>, <code>backdrop-filter</code>, <code>mix-blend-mode</code>, conic and repeating gradients, and <code>object-fit</code> are not painted. It does not use an SVG <code>foreignObject</code> either. Output is composited on white, cropped to the capture box, and an image served without CORS headers is left out rather than drawn blank.</p>\n<p>Your markup never leaves the browser. There is no upload, no request for your HTML, and no server-side rendering step — scripts, frames, form controls and inline SVG are removed before anything is drawn, and what the preview shows is exactly what the capture paints.</p>",
    "features": [
      "Live capture-box preview that measures the real layout before you commit",
      "PNG, JPEG and WebP output, with the lossless and lossy trade-offs spelled out",
      "1x to 4x scale in half steps, projected to an exact pixel size before capture",
      "Automatic download, plus a copy-to-clipboard and a re-download of the identical bytes",
      "Pixel budget and single-side limit enforced with the effective scale always disclosed",
      "Scripts, frames, form controls, inline SVG and unsafe URLs removed before rendering"
    ],
    "howTo": [
      {
        "step": "Paste or open your HTML",
        "description": "Paste markup into the source editor, open a .html file, or load the sample to see how the capture box behaves. Input is capped at 200 KB."
      },
      {
        "step": "Set the width, scale and format",
        "description": "Pick a capture width between 240 and 1200 px and a scale from 1x to 4x. The measured box and the exact output size in pixels are shown as you type, and content wider than the box is refused instead of being cropped."
      },
      {
        "step": "Capture and use the file",
        "description": "The image is re-drawn, saved automatically, and offered again from the result panel. Copy it to the clipboard, or download the same bytes again under the same name."
      }
    ],
    "faq": [
      {
        "question": "What does the scale actually do?",
        "answer": "It is the device-pixel multiplier. Every CSS pixel becomes that many image pixels, so a 480 px wide box at 2x produces a 960 px wide image. If the requested scale would break the 16 MP budget or the 8192 px single-side limit, the tool lowers it to the largest scale that fits and tells you which one it used. It never goes below 1x."
      },
      {
        "question": "Will the image match my browser exactly?",
        "answer": "It matches the layout, fonts, flexbox and grid that your browser has already resolved, because the tool repaints the same computed styles. It is not a photograph of the screen, and it does not paint filter, backdrop-filter, mix-blend-mode, conic or repeating gradients, or object-fit. Anything using those will come out different, so check the preview before shipping."
      },
      {
        "question": "Is my HTML uploaded anywhere?",
        "answer": "No. The render and the capture both happen in this page, and no request is made for your markup. Note that a remote image or CSS url() in your HTML is fetched by your browser exactly as any page would fetch it, and an image without CORS headers is left out of the capture."
      }
    ],
    "relatedSlugs": [
      "html-to-pdf",
      "md-to-html",
      "image-compressor",
      "image-resizer",
      "image-format-converter"
    ]
  },
  "box-shadow-generator": {
    "longDescription": "<p>BrainCoder's CSS box-shadow generator helps you create beautiful, custom box-shadow effects for any web element — with a live visual preview. Instead of guessing shadow values or copying generic code, this tool lets you adjust blur, spread, offset, color, and inset options through an intuitive interface, then copy the exact CSS code you need. It's the fastest way to get pixel-perfect shadows for your web projects.</p>\n<p>The generator produces valid CSS box-shadow properties that you can paste directly into your stylesheets. It supports multiple shadows on a single element, inset shadows for inner depth effects, and precise color selection with opacity control. Whether you're designing cards, buttons, modals, or any UI component, this tool helps you nail the perfect shadow every time.</p>\n<p>All generation happens in your browser — there's nothing to install and no accounts to create. It's a developer-friendly tool that saves time and eliminates the trial-and-error of manual CSS shadow coding. Perfect for both beginners learning CSS and experienced developers who want to speed up their workflow.</p>",
    "features": [
      "Live visual preview of box-shadow as you adjust settings",
      "Control offset X/Y, blur radius, spread radius, and color",
      "Support for inset shadows and multiple shadow layers",
      "Color picker with opacity/alpha channel support",
      "Copy generated CSS with one click",
      "No registration, no uploads, works entirely in your browser"
    ],
    "howTo": [
      {
        "step": "Adjust Shadow Properties",
        "description": "Use the sliders and controls to set the horizontal offset, vertical offset, blur radius, and spread radius. Watch the live preview update in real time."
      },
      {
        "step": "Choose Shadow Color",
        "description": "Use the color picker to select the shadow color and adjust its opacity. You can also enter hex, RGB, or HSL values directly."
      },
      {
        "step": "Copy the CSS",
        "description": "Click the copy button to grab the generated CSS box-shadow property. Paste it into your stylesheet or inline styles."
      }
    ],
    "faq": [
      {
        "question": "Can I create multiple shadows on one element?",
        "answer": "Yes. The tool supports adding multiple shadow layers to a single element, which are combined into a single CSS property separated by commas."
      },
      {
        "question": "What's an inset shadow?",
        "answer": "An inset shadow appears inside the element's border instead of outside. It creates a pressed or凹ed effect, commonly used for input fields and buttons."
      },
      {
        "question": "Is the generated CSS compatible with all browsers?",
        "answer": "Box-shadow is supported in all modern browsers. The tool generates standard CSS3 syntax that works in Chrome, Firefox, Safari, Edge, and more."
      }
    ],
    "relatedSlugs": [
      "border-radius-generator",
      "cubic-bezier-editor",
      "gradient-generator",
      "html-to-image",
      "html-to-pdf"
    ]
  },
  "border-radius-generator": {
    "longDescription": "<p>BrainCoder's CSS border-radius generator lets you create custom rounded corners for any web element with a visual, interactive interface. Instead of manually calculating radius values, simply drag the corners or adjust the sliders to see your shape take form in real time. The tool generates the exact CSS code you need for smooth, consistent border-radius effects on cards, buttons, images, and any UI component.</p>\n<p>The generator supports individual corner control (top-left, top-right, bottom-right, bottom-left) as well as elliptical radii for more complex shapes. It handles the shorthand CSS syntax automatically, producing clean code that you can paste directly into your project. Whether you're going for subtle rounding or dramatic pill shapes, this tool makes it effortless.</p>\n<p>Everything runs in your browser with no server involved. It's a quick, developer-friendly utility that eliminates the guesswork from border-radius CSS. Perfect for designers prototyping UI elements and developers building polished interfaces.</p>",
    "features": [
      "Visual interactive controls for all four corners",
      "Support for elliptical border-radius (horizontal and vertical radii)",
      "Live preview of the element with current radius settings",
      "Generates clean CSS shorthand or individual corner properties",
      "Pixel and percentage values supported",
      "One-click copy of generated CSS code"
    ],
    "howTo": [
      {
        "step": "Adjust Corner Radii",
        "description": "Use the visual controls or sliders to set the border-radius for each corner. Lock all corners together for uniform rounding or adjust them individually."
      },
      {
        "step": "Preview the Shape",
        "description": "Watch the live preview update as you make changes. See exactly how the rounded corners will look on a sample element."
      },
      {
        "step": "Copy the CSS",
        "description": "Click 'Copy CSS' to grab the generated border-radius property. Paste it into your stylesheet to apply the effect."
      }
    ],
    "faq": [
      {
        "question": "Can I set different radii for each corner?",
        "answer": "Yes. You can independently control the top-left, top-right, bottom-right, and bottom-left corners to create asymmetric shapes."
      },
      {
        "question": "What's the difference between pixel and percentage values?",
        "answer": "Pixel values create fixed-size corners regardless of element size. Percentage values create corners that scale relative to the element's width and height, maintaining proportions when resized."
      },
      {
        "question": "Does this work with images?",
        "answer": "Yes. Apply the generated border-radius CSS to any element including images to create circular or rounded image frames."
      }
    ],
    "relatedSlugs": [
      "box-shadow-generator",
      "gradient-generator",
      "cubic-bezier-editor",
      "image-resizer",
      "image-editor"
    ]
  },
  "cubic-bezier-editor": {
    "longDescription": "<p>BrainCoder's cubic-bezier timing function editor gives you a visual, hands-on way to create custom CSS animation curves. Instead of memorizing cubic-bezier syntax or guessing at timing values, drag the control points on a curve graph to sculpt the exact easing effect you want. The tool generates the CSS code in real time, so you can preview the animation feel and copy the code in one smooth workflow.</p>\n<p>The editor displays the standard cubic-bezier curve with two control points that you can drag freely. See how your curve affects animation timing — from ease-in and ease-out to bouncy overshoot effects and smooth deceleration. The tool also includes preset curves for common easing patterns, so you can start with a known curve and fine-tune from there.</p>\n<p>This is an essential tool for frontend developers, UI designers, and anyone creating CSS animations or transitions. It eliminates the trial-and-error of manual cubic-bezier values and helps you create more polished, professional-feeling animations. All editing happens in your browser with no server dependency.</p>",
    "features": [
      "Drag control points on an interactive curve graph",
      "Real-time preview of the animation timing effect",
      "Common preset curves (ease-in, ease-out, bounce, etc.)",
      "Generates valid CSS cubic-bezier() function code",
      "Copy generated code with one click",
      "Works entirely in your browser — no installations needed"
    ],
    "howTo": [
      {
        "step": "Open the Editor",
        "description": "Navigate to the cubic-bezier editor. You'll see a graph with a default linear curve and two draggable control points."
      },
      {
        "step": "Drag the Control Points",
        "description": "Click and drag each control point to shape the easing curve. The preview animation updates in real time to show how your curve affects timing."
      },
      {
        "step": "Copy the CSS Code",
        "description": "Once you've found the perfect curve, click 'Copy' to grab the cubic-bezier() CSS value. Paste it into your transition or animation property."
      }
    ],
    "faq": [
      {
        "question": "What is a cubic-bezier curve?",
        "answer": "A cubic-bezier curve defines the speed profile of a CSS animation or transition. It maps elapsed time to progress using a mathematical curve, controlling how fast or slow the animation moves at different points."
      },
      {
        "question": "Can I use this for CSS transitions too?",
        "answer": "Yes. The cubic-bezier() value works for both CSS transitions and CSS animations. Copy the value and use it in either the transition-timing-function or animation-timing-function property."
      },
      {
        "question": "Are there preset curves I can start from?",
        "answer": "Yes. The editor includes common presets like ease-in, ease-out, ease-in-out, and custom curves. Select a preset to load it, then fine-tune the control points to your liking."
      }
    ],
    "relatedSlugs": [
      "box-shadow-generator",
      "border-radius-generator",
      "gradient-generator",
      "html-to-image",
      "md-to-html"
    ]
  },
  "gradient-generator": {
    "longDescription": "<p>BrainCoder's CSS gradient generator lets you create stunning linear, radial, and conic gradients with a visual editor — no CSS expertise required. Pick your colors, adjust the angle or direction, add color stops, and see the gradient come to life in real time. When you're satisfied, copy the generated CSS code and paste it directly into your project.</p>\n<p>The generator supports all CSS gradient types: linear gradients for smooth directional flows, radial gradients for circular or elliptical patterns, and conic gradients for pie-chart-like effects. You can add multiple color stops at precise positions, create hard-edge color bands, and adjust the gradient angle with a visual rotation control. It's the fastest way to produce professional-quality gradients for backgrounds, buttons, overlays, and any UI element.</p>\n<p>Like all BrainCoder tools, the gradient generator runs entirely in your browser. Your design work is never uploaded or stored. It's a free, instant, and private utility for developers and designers who want beautiful gradients without the hassle of manual CSS coding.</p>",
    "features": [
      "Create linear, radial, and conic CSS gradients",
      "Visual color picker with multiple color stops",
      "Adjustable angle, direction, and gradient shape",
      "Live preview on sample elements and custom backgrounds",
      "Copy valid CSS gradient code with one click",
      "Supports CSS3 syntax for all modern browsers"
    ],
    "howTo": [
      {
        "step": "Choose Gradient Type",
        "description": "Select linear, radial, or conic gradient from the options. Each type offers different visual effects and controls."
      },
      {
        "step": "Set Colors and Stops",
        "description": "Add color stops using the color picker. Drag stops along the gradient bar to control where colors transition. Add as many stops as needed."
      },
      {
        "step": "Adjust Direction or Angle",
        "description": "For linear gradients, set the angle using the rotation control. For radial gradients, choose the shape (circle or ellipse). For conic gradients, set the starting angle."
      },
      {
        "step": "Copy the CSS",
        "description": "Preview the final gradient and click 'Copy CSS' to grab the gradient code. Paste it into any CSS background property."
      }
    ],
    "faq": [
      {
        "question": "Can I create gradients with more than two colors?",
        "answer": "Yes. You can add as many color stops as you want, creating rich, multi-color gradients with smooth transitions between each color."
      },
      {
        "question": "What's the difference between linear, radial, and conic?",
        "answer": "Linear gradients flow in a straight line (like a sunset). Radial gradients radiate outward from a center point (like a spotlight). Conic gradients sweep around a center point (like a color wheel)."
      },
      {
        "question": "Will the gradients work in all browsers?",
        "answer": "CSS gradients are supported in all modern browsers. The tool generates standard CSS3 syntax compatible with Chrome, Firefox, Safari, Edge, and more."
      }
    ],
    "relatedSlugs": [
      "box-shadow-generator",
      "border-radius-generator",
      "cubic-bezier-editor",
      "image-filters",
      "image-editor"
    ]
  },
  "image-format-converter": {
    "longDescription": "<p>BrainCoder's image format converter transforms images between PNG, JPG, WebP, BMP, and GIF formats — entirely in your browser. Whether you need to convert a PNG to JPG for smaller file sizes, transform a JPG to WebP for modern web optimization, or convert a screenshot to a universally compatible format, this tool delivers instant, high-quality format conversion without uploading your images anywhere.</p>\n<p>Format conversion is essential for web development (WebP for performance), social media (JPG for compatibility), printing (PNG for transparency), and general file management. The converter preserves image quality while providing format-specific options like quality settings for JPG compression and transparency handling for PNG output.</p>\n<p>All conversion happens locally in your browser, ensuring your photos, screenshots, and proprietary images never leave your device. There's no file size limit imposed by servers, no watermarks, and no accounts required. It's the simplest, most private way to convert image formats.</p>",
    "features": [
      "Convert between PNG, JPG, WebP, BMP, and GIF formats",
      "Adjustable quality settings for lossy formats (JPG, WebP)",
      "Preserves transparency when converting to PNG",
      "Batch conversion for multiple images",
      "Instant conversion with no server uploads",
      "Download converted images directly to your device"
    ],
    "howTo": [
      {
        "step": "Upload Your Image",
        "description": "Drag and drop your image or click to upload. The tool accepts PNG, JPG, WebP, BMP, GIF, and other common formats."
      },
      {
        "step": "Choose Output Format",
        "description": "Select the target format from the dropdown — PNG, JPG, WebP, etc. Adjust quality settings if applicable."
      },
      {
        "step": "Convert and Download",
        "description": "Click 'Convert' and the tool processes the image instantly. Download the converted file to your device."
      }
    ],
    "faq": [
      {
        "question": "Which format should I use for web images?",
        "answer": "WebP offers the best compression and quality for web use. JPG is ideal for photographs. PNG is best when you need transparency or lossless quality."
      },
      {
        "question": "Does converting JPG to PNG improve quality?",
        "answer": "No. Converting from a lossy format (JPG) to a lossless format (PNG) doesn't recover lost data. The quality stays at the JPG level, but the file size increases."
      },
      {
        "question": "Is my image uploaded during conversion?",
        "answer": "No. All format conversion happens locally in your browser using Canvas APIs. Your image data never leaves your device."
      }
    ],
    "relatedSlugs": [
      "image-compressor",
      "image-resizer",
      "image-filters",
      "image-editor",
      "image-splitter"
    ]
  },
  "image-filters": {
    "longDescription": "<p>BrainCoder's image filters tool applies stunning visual effects to your images — blur, sharpen, sepia, grayscale, brightness, contrast, hue rotation, and more. Upload any photo and instantly transform it with professional-quality CSS filter effects, all previewed live in your browser. It's the quickest way to add artistic flair to your images without complex photo editing software.</p>\n<p>The tool supports the full range of CSS filter functions: blur for depth-of-field effects, brightness and contrast for lighting adjustments, grayscale and sepia for vintage looks, hue-rotate for creative color shifts, and saturate for vivid or muted tones. You can stack multiple filters and adjust each one's intensity with sliders, seeing the result update in real time.</p>\n<p>Like all BrainCoder tools, everything happens locally — your images are never uploaded to any server. Download the filtered image in your preferred format, or copy the CSS filter code to apply the same effect in your web project. It's both a practical image editing tool and a CSS filter playground.</p>",
    "features": [
      "Apply blur, grayscale, sepia, brightness, contrast, and more",
      "Stack multiple filters and adjust each one's intensity",
      "Live preview of all filter effects on your image",
      "Download the filtered image as PNG or JPG",
      "Copy the CSS filter() code for use in web projects",
      "100% client-side — images never leave your browser"
    ],
    "howTo": [
      {
        "step": "Upload Your Image",
        "description": "Click upload or drag and drop your image into the tool. The image displays with the default (no filter) state."
      },
      {
        "step": "Apply and Adjust Filters",
        "description": "Select filters from the available options and adjust their intensity using sliders. Stack multiple filters for complex effects. Preview changes in real time."
      },
      {
        "step": "Download or Copy CSS",
        "description": "Download the filtered image in your preferred format, or copy the CSS filter property to apply the same effect in your stylesheet."
      }
    ],
    "faq": [
      {
        "question": "Can I apply multiple filters at once?",
        "answer": "Yes. You can stack as many filters as you want — for example, combine blur with grayscale and reduced brightness for a moody, atmospheric effect."
      },
      {
        "question": "Can I get the CSS code for my filter combination?",
        "answer": "Yes. The tool generates the equivalent CSS filter() property for your current filter settings, which you can copy and paste into any stylesheet."
      },
      {
        "question": "What image formats can I download?",
        "answer": "You can download the filtered image as PNG (lossless, supports transparency) or JPG (compressed, smaller file size)."
      }
    ],
    "relatedSlugs": [
      "image-compressor",
      "image-resizer",
      "image-editor",
      "image-format-converter",
      "gradient-generator"
    ]
  },
  "image-splitter": {
    "longDescription": "<p>BrainCoder's image splitter divides any image into a grid of smaller tiles — perfect for creating Instagram grid posts, puzzle effects, tileable patterns, or breaking large images into manageable pieces. Set your desired number of rows and columns, preview the grid overlay, and download all the tiles at once. It's the fastest way to split an image for social media, printing, or web design.</p>\n<p>The tool is especially popular for creating Instagram grid layouts where a single large image is split into multiple posts that form a cohesive visual when viewed on your profile. It's also useful for creating image puzzles, dividing screenshots into sections for documentation, or generating tile sets for game development.</p>\n<p>All processing happens in your browser — your image never leaves your device. Download individual tiles or grab them all as a batch ZIP file. The splitter preserves the original image quality, ensuring each tile is a crisp, high-resolution segment of the original.</p>",
    "features": [
      "Split images into any grid configuration (rows x columns)",
      "Preview the grid overlay before splitting",
      "Download individual tiles or all tiles as a batch",
      "Maintains original image quality in each tile",
      "Perfect for Instagram grid posts and puzzle effects",
      "Client-side processing — no image uploads"
    ],
    "howTo": [
      {
        "step": "Upload Your Image",
        "description": "Click upload or drag and drop the image you want to split. The tool displays the image with a default grid overlay."
      },
      {
        "step": "Set Grid Dimensions",
        "description": "Adjust the number of rows and columns to define your grid. The overlay preview updates to show exactly where the image will be cut."
      },
      {
        "step": "Download Tiles",
        "description": "Click 'Split' to generate the tiles, then download them individually or as a batch ZIP file."
      }
    ],
    "faq": [
      {
        "question": "How do I create an Instagram grid post?",
        "answer": "Upload your image, set the grid to 3 columns and the desired number of rows (e.g., 3x3 for 9 posts). Download all tiles and upload them to Instagram in reverse order (bottom-right first) to form the complete image on your profile."
      },
      {
        "question": "Can I set custom tile sizes instead of a grid?",
        "answer": "The tool works with a row-and-column grid system. For custom tile sizes, first resize your image using the image resizer to match your desired tile dimensions times the grid size."
      },
      {
        "question": "Are the tiles the same quality as the original?",
        "answer": "Yes. Each tile is a direct crop of the original image at full resolution. No quality loss occurs during the splitting process."
      }
    ],
    "relatedSlugs": [
      "image-resizer",
      "image-compressor",
      "image-format-converter",
      "image-editor",
      "image-filters"
    ]
  },
  "unit-converter": {
    "longDescription": "<p>BrainCoder's unit converter is a universal conversion tool that handles length, weight, temperature, volume, area, speed, and more — all in one place. Whether you're converting inches to centimeters, Fahrenheit to Celsius, pounds to kilograms, or miles to kilometers, this tool delivers instant, accurate results. It's the only unit converter you'll need, and it works entirely in your browser with no server dependency.</p>\n<p>The converter supports a comprehensive range of measurement categories and units, making it useful for students, engineers, scientists, cooks, travelers, and anyone who regularly works with different measurement systems. Switch between units with a single click, see real-time results as you type, and convert in both directions without re-entering values.</p>\n<p>All calculations happen locally, so your data is never transmitted anywhere. It's a fast, private, and reliable conversion tool that replaces the need for multiple apps, browser extensions, or lookup tables. Bookmark it for quick access whenever you need to convert anything.</p>",
    "features": [
      "Convert length, weight, temperature, volume, area, and speed",
      "Supports metric, imperial, and common measurement systems",
      "Real-time conversion as you type",
      "Bidirectional — swap input and output units instantly",
      "Comprehensive unit library covering everyday and technical units",
      "No data uploads, no accounts, works entirely offline"
    ],
    "howTo": [
      {
        "step": "Select a Category",
        "description": "Choose the type of conversion you need — length, weight, temperature, volume, area, or speed. Each category has its own set of supported units."
      },
      {
        "step": "Enter Your Value",
        "description": "Type the number you want to convert in the input field. Select the source unit and the target unit from the dropdown menus."
      },
      {
        "step": "Get Instant Results",
        "description": "The converted value appears immediately. Use the swap button to reverse the conversion direction, or change units to perform a new conversion."
      }
    ],
    "faq": [
      {
        "question": "Can I convert between metric and imperial?",
        "answer": "Yes. The tool supports both metric and imperial units across all categories, making it easy to convert between systems like Celsius to Fahrenheit or kilograms to pounds."
      },
      {
        "question": "Does it work offline?",
        "answer": "Once the page is loaded, all conversions are performed locally in your browser. No internet connection is needed for the actual calculations."
      },
      {
        "question": "How accurate are the conversions?",
        "answer": "The converter uses precise mathematical conversion factors. Results are accurate to many decimal places, suitable for both everyday and technical use."
      }
    ],
    "relatedSlugs": [
      "notepad",
      "word-counter",
      "text-cleaner",
      "image-compressor",
      "md-to-html"
    ]
  },
  "color-converter": {
    "longDescription": "<p>BrainCoder's Color Converter converts between HEX, RGB, and HSL color formats instantly. Type a hex value like #7C3AED, an RGB value like rgb(124, 58, 237), or an HSL value like hsl(262, 83%, 58%) and watch all three formats update in real time, with a live preview swatch.</p>\n<p>It understands the full CSS color syntax: short hex (#f00), long hex (#7C3AED), RGBA with alpha (#7C3AEDFF and rgba(124, 58, 237, 1)), and HSLA. Channel values are clamped automatically — entering rgb(300, 0, 0) corrects to 255 with no errors. Reading a brand color from CSS or Figma and converting it to every format is a two-second job, and every result carries its own one-click copy button.</p>\n<p>Validation is forgiving about in-progress input: partially typed values like #7C or hsl(2 simply wait for more characters; only genuinely invalid values such as 'red' or '#ggg' show an error, and the preview swatch always keeps the last valid color on screen. All conversion happens locally in your browser.</p>",
    "features": [
      "Convert between HEX, RGB, RGBA, HSL and HSLA in real time",
      "Accepts hex (#7C3AED, #f00), rgb()/rgba() and hsl()/hsla() input",
      "RGBA/HSLA alpha channel support with #RRGGBBAA (8-digit hex)",
      "Out-of-range channels clamped automatically (e.g. 300 → 255)",
      "Live color swatch that keeps the last valid color on invalid input",
      "One-click copy for each output format — 100% in-browser"
    ],
    "howTo": [
      {
        "step": "Type or pick a color",
        "description": "Enter any hex, rgb(), or hsl() value, or use the color picker to choose one visually. Invalid values show an error; partially typed values wait for completion."
      },
      {
        "step": "Read the conversions",
        "description": "The HEX, RGB, and HSL cards show the same color in every format, with alpha included when present."
      },
      {
        "step": "Copy what you need",
        "description": "Use the copy button on any card to grab that format for CSS, design tools, or code."
      }
    ],
    "faq": [
      {
        "question": "What color formats are supported?",
        "answer": "HEX (3, 4, 6 and 8-digit — including #RRGGBBAA alpha), RGB/RGBA and HSL/HSLA. CSS color names like 'red' or 'rebeccapurple' are not supported."
      },
      {
        "question": "What happens if I enter a value out of range?",
        "answer": "Channels are clamped to the valid range. rgb(300, 0, 0) is converted as rgb(255, 0, 0), and hsl hue values wrap around the 360° circle."
      },
      {
        "question": "How is alpha handled?",
        "answer": "Inputs with alpha — rgba(), hsla(), 4 or 8-digit hex — carry their alpha through to every output format. A color without alpha keeps no alpha in the outputs."
      },
      {
        "question": "Does the converter store my colors?",
        "answer": "No. Conversion runs entirely in your browser and nothing you enter is transmitted or stored."
      }
    ],
    "relatedSlugs": [
      "css-formatter",
      "px-rem",
      "gradient-generator",
      "box-shadow-generator",
      "image-editor"
    ]
  },
  "css-cursor": {
    "longDescription": "<p>CSS Cursor Generator lets you preview every CSS cursor keyword on an interactive target and copy the exact declaration you need. Hover behavior matters — a well-chosen cursor tells users whether something is clickable, draggable, resizable, or busy. This tool shows each keyword cursor live on a real hover target so you can pick the right one for your UI in seconds.</p><p>Browsers only allow same-origin or data URLs for custom cursor images, so the tool reads a PNG or CUR file straight from your device — nothing is ever uploaded. The generated snippet is a clean, copy-ready CSS declaration that works in any stylesheet.</p>",
    "features": [
      "Live preview of every CSS cursor keyword",
      "Interactive hover/press target to test behavior",
      "Custom cursor image from a local PNG or CUR file",
      "One-click copy-ready CSS declaration",
      "Covers default, pointer, grab, resize, progress, and more",
      "100% client-side, no uploads or account required"
    ],
    "howTo": [
      {
        "step": "Pick a Cursor",
        "description": "Click any keyword in the grid to preview it on the interactive pane above."
      },
      {
        "step": "Test It Out",
        "description": "Hover and press the pane to feel the cursor in action."
      },
      {
        "step": "Add a Custom Image",
        "description": "Optionally load a PNG or CUR cursor image from your device; it is applied with a fallback keyword."
      },
      {
        "step": "Copy the CSS",
        "description": "Click copy to grab the generated cursor declaration and paste it into your stylesheet."
      }
    ],
    "faq": [
      {
        "question": "What cursor keywords are supported?",
        "answer": "All standard CSS keywords are covered: default, pointer, move, grab, grabbing, text, wait, progress, help, plus all resize, crosshair, cell, copy, zoom, no-drop, not-allowed, and more."
      },
      {
        "question": "Can I use a custom cursor image?",
        "answer": "Yes. Load a PNG or CUR file from your device and the tool generates a multi-value cursor declaration with a fallback keyword. Browsers block remote URLs for cursor images, so only local files (or data URLs) work reliably."
      },
      {
        "question": "Are my files uploaded?",
        "answer": "No. Previews and snippet generation happen entirely in your browser with no server uploads."
      }
    ],
    "relatedSlugs": [
      "css-formatter",
      "box-shadow-generator",
      "border-radius-generator",
      "gradient-generator",
      "css-unit-converter"
    ]
  },
  "roman-numerals": {
    "longDescription": "<p>Roman Numerals Converter converts decimal numbers to Roman numerals and back, covering the full 1–3999 range with strict subtractive-notation validation. It is handy for dated documents, clock faces, outline numbering, chapter headers, or just decoding an ancient inscription.</p><p>The converter enforces proper Roman grammar — IV instead of IIII, CM instead of DCCCC — and rejects malformed input like VX or IIX. Results update instantly as you type, switching direction based on what you enter. Everything is processed in your browser, so input is never transmitted anywhere.</p>",
    "features": [
      "Two-way conversion between decimal and Roman numerals",
      "Full 1–3999 range with strict subtractive notation",
      "Rejects invalid sequences (e.g. IIII, VX, IIX)",
      "Instant result as you type",
      "History of recent conversions",
      "100% client-side and private"
    ],
    "howTo": [
      {
        "step": "Enter a Number",
        "description": "Type a decimal number (1–3999) or a Roman numeral like MMXXIV."
      },
      {
        "step": "Read the Result",
        "description": "The converted value updates instantly in the opposite format."
      },
      {
        "step": "Review the Breakdown",
        "description": "Check the step-by-step expansion showing how the numeral is built."
      },
      {
        "step": "Copy the Value",
        "description": "Click copy to use the result anywhere."
      }
    ],
    "faq": [
      {
        "question": "What is the supported range?",
        "answer": "Conversion works for decimal values from 1 to 3999, the standard range for Roman numerals without extension bars."
      },
      {
        "question": "Why does my numeral get rejected?",
        "answer": "The tool enforces strict subtractive notation. Sequences like IIII, VX, or IIX are invalid in conventional Roman numerals."
      },
      {
        "question": "Is input sent to a server?",
        "answer": "No. All conversion happens locally in your browser for complete privacy."
      }
    ],
    "relatedSlugs": [
      "number-base",
      "timestamp-converter",
      "word-counter",
      "case-converter",
      "utf8-converter"
    ]
  },
  "word-to-text": {
    "longDescription": "<p>Word to Text extracts the plain text from a Word (.docx) document, stripping away formatting, images, and layout so you are left with clean, editable content. It is built on the same engine developers trust for server-side conversion — but runs 100% in your browser, which means your document never leaves your device.</p><p>Use it to pull text into a notes app, prepare content for a script or subtitles, reflow text for publishing, or strip boilerplate before another step in your workflow. The result opens in a live editor so you can tidy it up before downloading the .txt file.</p>",
    "features": [
      "Extract plain text from .docx and .doc files",
      "Removes formatting, images, and layout clutter",
      "Live preview in an editable textarea",
      "Download the result as a .txt file",
      "Handles headers, footers, and multi-page documents",
      "100% client-side with no file uploads"
    ],
    "howTo": [
      {
        "step": "Choose a Word document",
        "description": "Click the upload button and pick a .docx file, or drag one to the tool."
      },
      {
        "step": "Wait for extraction",
        "description": "The document is parsed in your browser and its text is extracted in seconds."
      },
      {
        "step": "Tidy the preview",
        "description": "Edit the extracted text directly in the editable preview if you like."
      },
      {
        "step": "Download .txt",
        "description": "Click download to save the plain text to your device."
      }
    ],
    "faq": [
      {
        "question": "Does it keep formatting?",
        "answer": "No. The tool intentionally removes formatting to give you clean plain text. For formatted output, use Word to Markdown or Word to PDF instead."
      },
      {
        "question": "Can it read .doc files?",
        "answer": "Mammoth-based extraction handles the legacy .doc format in most cases. For the best results, prefer .docx."
      },
      {
        "question": "Are my documents uploaded?",
        "answer": "No. The entire conversion happens locally in your browser using client-side JavaScript."
      }
    ],
    "relatedSlugs": [
      "word-to-markdown",
      "word-viewer",
      "word-creator",
      "text-to-pdf",
      "pdf-to-word"
    ]
  },
  "word-to-markdown": {
    "longDescription": "<p>Word to Markdown converts a Word (.docx) document into clean Markdown — with headings, lists, tables, and links mapped to the correct Markdown syntax. It is perfect for moving legacy documents into content systems, static sites, GitHub repos, or documentation tools.</p><p>The conversion pipeline runs entirely in your browser: your document is parsed locally and rendered to Markdown with the Turndown library. You get a live Markdown view plus a rendered HTML preview toggle, and the .md file downloads with one click.</p>",
    "features": [
      "Convert Word documents to Markdown with correct syntax",
      "Headings, lists, tables, and links preserved",
      "Live Markdown editor with rendered preview toggle",
      "Download the result as a .md file",
      "Clean output ready for static sites and docs tools",
      "No uploads — everything happens client-side"
    ],
    "howTo": [
      {
        "step": "Pick a document",
        "description": "Open a .docx file with the upload button."
      },
      {
        "step": "Review the Markdown",
        "description": "Check the generated Markdown in the built-in editor."
      },
      {
        "step": "Toggle preview",
        "description": "Switch to Preview to see how the Markdown renders."
      },
      {
        "step": "Download .md",
        "description": "Save the finished Markdown file to your device."
      }
    ],
    "faq": [
      {
        "question": "Which Markdown dialect is used?",
        "answer": "Output uses GitHub-style ATX headings with fenced code blocks, so it renders correctly on GitHub, VS Code, and most static site generators."
      },
      {
        "question": "Are tables converted?",
        "answer": "Yes. Tables in the Word document are converted to pipe-table Markdown syntax."
      },
      {
        "question": "Is this private?",
        "answer": "Completely. All conversion runs locally in your browser and nothing is sent to any server."
      }
    ],
    "relatedSlugs": [
      "word-to-text",
      "markdown-preview",
      "md-to-html",
      "word-viewer",
      "html-markdown"
    ]
  },
  "word-viewer": {
    "longDescription": "<p>Word Document Viewer lets you open a Word (.docx) file and preview it as rendered content directly in your browser — no Microsoft Office, Google Docs, or other apps required. Headings, paragraphs, bullet lists, and tables are reconstructed and shown as readable HTML.</p><p>Because parsing happens entirely client-side with the mammoth engine, viewing a document is fully private and works offline once the page has loaded. You can also copy the underlying HTML to paste into emails, editors, or web pages.</p>",
    "features": [
      "Preview .docx documents in the browser",
      "Renders headings, lists, tables, and emphasis",
      "Copy the generated HTML with one click",
      "No Office install or third-party service needed",
      "Private — documents never leave your device",
      "Works for quickly checking any Word file"
    ],
    "howTo": [
      {
        "step": "Open a document",
        "description": "Pick a .docx file with the upload button."
      },
      {
        "step": "Read the preview",
        "description": "Scroll the rendered document exactly as formatted content."
      },
      {
        "step": "Copy the HTML",
        "description": "Use Copy HTML to grab the cleaned-up markup for reuse."
      }
    ],
    "faq": [
      {
        "question": "Does the viewer edit documents?",
        "answer": "No. It is a read-only preview. Use Word Document Creator or Word to PDF if you need to produce or convert files."
      },
      {
        "question": "Will images show?",
        "answer": "Basic embedded images are rendered when formats are supported by the browser. Text content, headings, and tables preview reliably."
      },
      {
        "question": "Is it safe to open unknown files here?",
        "answer": "It is safer than most viewers since nothing is uploaded and no external code executes — documents are parsed and rendered purely client-side."
      }
    ],
    "relatedSlugs": [
      "word-to-text",
      "word-to-markdown",
      "word-to-pdf",
      "excel-viewer",
      "word-creator"
    ]
  },
  "word-creator": {
    "longDescription": "<p>Word Document Creator is a free online way to write and generate .docx files without installing any desktop software. Draft your content in the simple editor, use lightweight formatting markers (# headings, **bold**, *italic*, lists, and --- page breaks), and download a genuine Word document generated locally.</p><p>Everything is built in your browser using the same Open XML packaging Office uses, so the resulting file opens seamlessly in Microsoft Word, Google Docs, LibreOffice, and Apple Pages. There are no accounts, no uploads, and no watermarks.</p>",
    "features": [
      "Write and download real .docx documents free",
      "Simple markers for headings, bold, italic, and lists",
      "Insert page breaks with ---",
      "Built-in sample document to get started",
      "Output opens in Word, Google Docs, and LibreOffice",
      "Fully client-side generation — nothing uploaded"
    ],
    "howTo": [
      {
        "step": "Write your content",
        "description": "Type in the editor using # for headings, ** bold **, and - for bullets."
      },
      {
        "step": "Preview the markers",
        "description": "Review the quick format reference above the editor at any time."
      },
      {
        "step": "Generate .docx",
        "description": "Click Generate .docx and the file is built instantly in your browser."
      },
      {
        "step": "Open in Word",
        "description": "Download and open the document in your favorite office suite."
      }
    ],
    "faq": [
      {
        "question": "What formatting markers are supported?",
        "answer": "# Heading 1, ## Heading 2, ### Heading 3, - bullets, **bold**, *italic*, and --- page breaks. The first heading becomes the title."
      },
      {
        "question": "Does the file open in Microsoft Word?",
        "answer": "Yes. The tool produces a standard .docx package (Open XML), so it opens in Word, Google Docs, LibreOffice, and Pages."
      },
      {
        "question": "Are images supported?",
        "answer": "This creator focuses on text documents. For image-based workbooks or PDFs, check Excel View or Image to PDF."
      }
    ],
    "relatedSlugs": [
      "word-to-text",
      "word-to-markdown",
      "word-viewer",
      "text-to-pdf",
      "pdf-creator"
    ]
  },
  "csv-to-excel": {
    "longDescription": "<p>CSV to Excel converts comma-separated value files into a real Excel workbook (.xlsx). Upload one or more CSV files and each becomes a named sheet — perfect for bundling exports, consolidating weekly reports, or preparing data for pivot tables and charts.</p><p>The converter parses CSV robustly (quoted fields, commas inside quotes, escaped quotes) and detects numeric values so numbers stay numbers when the workbook opens. Generation is fully client-side: your data, which can be sensitive business records, never leaves your browser.</p>",
    "features": [
      "Convert one or more CSV files to .xlsx",
      "Each CSV becomes its own named sheet",
      "Numeric values detected and stored as numbers",
      "Handles quoted fields and commas within quotes",
      "Multiple files bundle into a single workbook",
      "100% client-side — no data upload"
    ],
    "howTo": [
      {
        "step": "Add CSV files",
        "description": "Click Add CSV file(s) and select one or more .csv files."
      },
      {
        "step": "Check the sheets",
        "description": "Review the pending files — each one becomes a sheet named after the file."
      },
      {
        "step": "Convert",
        "description": "Click Convert to .xlsx and the workbook is built in your browser."
      },
      {
        "step": "Download",
        "description": "Save the .xlsx and open it in Excel or any spreadsheet app."
      }
    ],
    "faq": [
      {
        "question": "Do numbers stay numeric?",
        "answer": "Yes. Plain numeric values are recognized and stored as numbers, so you can sum them in Excel. Values with currency symbols remain text."
      },
      {
        "question": "Can I combine several CSV files?",
        "answer": "Yes. Add multiple files and each becomes a sheet in one downloaded workbook."
      },
      {
        "question": "Is my data uploaded?",
        "answer": "No. Building the workbook happens locally with no network transfer of your data."
      }
    ],
    "relatedSlugs": [
      "excel-viewer",
      "excel-to-csv",
      "excel-to-json",
      "csv-json",
      "excel-merge"
    ]
  },
  "excel-viewer": {
    "longDescription": "<p>Excel Viewer is a free, browser-based way to open and browse Excel workbooks (.xlsx) without installing spreadsheet software. Upload a file and every sheet is listed as a tab you can click through, with cell contents shown in a clean grid.</p><p>The workbook is parsed on your device from the Open XML package — no server, no account, no upload. It is ideal for quickly checking a vendor's export, auditing a report before processing, or reading spreadsheets on a device without Office apps.</p>",
    "features": [
      "Open .xlsx workbooks online without Office",
      "Browse every sheet via tab navigation",
      "Rows and cells rendered as a readable grid",
      "First row highlighted to spot headers",
      "Parsed locally — nothing uploaded",
      "Great for reports, exports, and audits"
    ],
    "howTo": [
      {
        "step": "Open a workbook",
        "description": "Pick an .xlsx file with the upload button."
      },
      {
        "step": "Select a sheet",
        "description": "Click any sheet tab to view its contents."
      },
      {
        "step": "Scroll the grid",
        "description": "Review up to 300 rows of cells with headers highlighted."
      }
    ],
    "faq": [
      {
        "question": "Which formats are supported?",
        "answer": "Modern .xlsx files. Legacy .xls binary files are not supported yet."
      },
      {
        "question": "Can it edit cells?",
        "answer": "No, the viewer is read-only. Use CSV to Excel, Excel to PDF, or Excel Merge for editing workflows."
      },
      {
        "question": "Are formulas calculated?",
        "answer": "Only static values stored in the sheet are shown; formula results must be saved by the originating app for them to appear."
      }
    ],
    "relatedSlugs": [
      "excel-to-csv",
      "excel-to-json",
      "csv-to-excel",
      "excel-to-pdf",
      "word-viewer"
    ]
  },
  "excel-to-csv": {
    "longDescription": "<p>Excel to CSV exports the sheets of an Excel workbook as clean comma-separated values — one CSV file per sheet. It is the fastest way to move spreadsheet data into databases, data pipelines, analytics tools, and scripts that expect plain text input.</p><p>Cell values are preserved with the exact text stored in the workbook, and the CSV encoding follows the classic RFC-4180 conventions so it imports cleanly anywhere. Everything runs locally in your browser, keeping sensitive data private.</p>",
    "features": [
      "Convert Excel worksheets to CSV",
      "One CSV file per sheet, downloaded individually",
      "Download every sheet at once",
      "RFC-4180 compliant escaping",
      "Values preserved exactly as stored",
      "Client-side processing — no uploads"
    ],
    "howTo": [
      {
        "step": "Open a workbook",
        "description": "Upload an .xlsx file with the upload button."
      },
      {
        "step": "Review the sheets",
        "description": "Each sheet is listed with its row count."
      },
      {
        "step": "Download",
        "description": "Download individual sheets or grab all of them as CSV files."
      }
    ],
    "faq": [
      {
        "question": "What about text that contains commas?",
        "answer": "Such fields are quoted and inner quotes escaped per RFC-4180, so the CSV remains valid."
      },
      {
        "question": "Can I get all sheets at once?",
        "answer": "Yes. Click Download all sheets (.csv) and every sheet is saved as its own file."
      },
      {
        "question": "Is this suitable for databases?",
        "answer": "Absolutely. The clean CSV output is ideal for importing into SQL databases, Python/R, and ETL pipelines."
      }
    ],
    "relatedSlugs": [
      "excel-viewer",
      "csv-to-excel",
      "csv-to-sql",
      "excel-to-json",
      "csv-formatter"
    ]
  },
  "excel-to-json": {
    "longDescription": "<p>Excel to JSON converts the sheets of an Excel workbook into JavaScript Object Notation. With the header-row option, each sheet becomes an object whose keys come from the first row — ready for API payloads, frontend config, or any tooling that consumes JSON.</p><p>Multi-sheet workbooks produce a clean structure with one object per sheet, and you can toggle between raw JSON and a grid preview of your data. Since all parsing happens in the browser, spreadsheets with sensitive content never leave your machine.</p>",
    "features": [
      "Convert Excel sheets to JSON objects",
      "First-row-as-header mapping, toggleable",
      "One object per sheet in multi-sheet workbooks",
      "Empty cells omitted for compact output",
      "Live JSON preview and a grid view",
      "100% client-side conversion"
    ],
    "howTo": [
      {
        "step": "Open the workbook",
        "description": "Upload an .xlsx file with the upload button."
      },
      {
        "step": "Set the header option",
        "description": "Keep First row is header enabled to use row 1 as object keys."
      },
      {
        "step": "Inspect the JSON",
        "description": "Browse the generated JSON or flip to the grid view."
      },
      {
        "step": "Download .json",
        "description": "Save the JSON file to use in your project."
      }
    ],
    "faq": [
      {
        "question": "How are sheets mapped to JSON?",
        "answer": "Each sheet produces a top-level object: { \"sheet\": \"<name>\", \"data\": [ ... ] }. With headers on, every row becomes an object keyed by the first row's values."
      },
      {
        "question": "What happens to empty cells?",
        "answer": "Empty cells are omitted from the generated objects to keep the JSON compact and clean."
      },
      {
        "question": "Can I disable headers?",
        "answer": "Yes. Uncheck First row is header to emit each row as its own array of values instead."
      }
    ],
    "relatedSlugs": [
      "excel-viewer",
      "excel-to-csv",
      "json-viewer",
      "csv-json",
      "json-to-typescript"
    ]
  },
  "excel-merge": {
    "longDescription": "<p>Excel Merge combines two or more Excel workbooks into a single .xlsx file. Every sheet from every uploaded workbook is preserved in the merged output, with duplicate sheet names automatically suffixed (e.g. Sales (1)) so nothing is overwritten.</p><p>It is the quick answer to consolidating monthly reports, combining data from multiple teams, or joining workbooks before further processing. The merge runs entirely in your browser, so confidential spreadsheets never transit a server.</p>",
    "features": [
      "Merge multiple .xlsx workbooks into one file",
      "All sheets preserved, nothing dropped",
      "Duplicate sheet names auto-suffixed",
      "Works with merge then convert workflows",
      "Sheet order follows upload order",
      "Fully client-side — data never uploaded"
    ],
    "howTo": [
      {
        "step": "Add workbooks",
        "description": "Click Add workbook(s) and select two or more .xlsx files."
      },
      {
        "step": "Review the merge",
        "description": "Confirm the files and their sheets are listed as expected."
      },
      {
        "step": "Merge",
        "description": "Click Merge into one .xlsx to build a single combined workbook."
      },
      {
        "step": "Download",
        "description": "Save merged.xlsx — every sheet is inside, rename-safe."
      }
    ],
    "faq": [
      {
        "question": "What if two sheets have the same name?",
        "answer": "The second occurrence is renamed with a suffix such as (1) so both sheets survive in the merged workbook."
      },
      {
        "question": "Is content edited during merge?",
        "answer": "No. Cell values are copied as-is; styling and formulas held as values are preserved where possible."
      },
      {
        "question": "Does anything get uploaded?",
        "answer": "No. Merging is performed completely in your browser."
      }
    ],
    "relatedSlugs": [
      "csv-to-excel",
      "excel-viewer",
      "excel-to-csv",
      "excel-to-json",
      "pdf-merge"
    ]
  },
  "excel-to-pdf": {
    "longDescription": "<p>Excel to PDF renders a spreadsheet sheet into a paginated, print-ready PDF — perfect for sharing budgets, reports, and data tables with people who do not use spreadsheet tools. Pick the sheet you want and the tool pages its rows and columns across A4-size pages automatically.</p><p>Rendering happens locally: the grid is drawn with the browser's canvas engine and assembled into a real PDF with the same library used by professional converters, so your data never leaves your device. Headers are kept bold and readable in the output.</p>",
    "features": [
      "Convert a selected sheet to a paginated PDF",
      "Rows and columns laid out across A4 pages",
      "Header row highlighted in the output",
      "Choose the target sheet before converting",
      "Print-friendly black on white",
      "Client-side only — no uploads"
    ],
    "howTo": [
      {
        "step": "Open the workbook",
        "description": "Upload an .xlsx file with the upload button."
      },
      {
        "step": "Pick a sheet",
        "description": "Click the sheet tab you want to print."
      },
      {
        "step": "Convert to PDF",
        "description": "Click Convert to PDF for the active sheet."
      },
      {
        "step": "Download",
        "description": "Save the generated PDF and share or print it."
      }
    ],
    "faq": [
      {
        "question": "How many rows are converted?",
        "answer": "The first 300 rows (up to 20 columns) are rendered so the PDF builds quickly; large sheets can be split at the source first."
      },
      {
        "question": "Can I convert all sheets in one PDF?",
        "answer": "Not yet — the tool renders the active sheet. Convert each sheet individually and merge the resulting PDFs with PDF Merge if needed."
      },
      {
        "question": "Is the output resolution good enough to print?",
        "answer": "Yes. Pages are rendered at 2× scale, then embedded as crisp images on A4 pages."
      }
    ],
    "relatedSlugs": [
      "excel-viewer",
      "pdf-to-excel",
      "html-to-pdf",
      "excel-to-csv",
      "pdf-merge"
    ]
  },
  "pptx-creator": {
    "longDescription": "<p>PowerPoint Creator builds real .pptx presentations entirely in your browser. Compose slides with a title and bullet points, add as many slides as you need, reorder them, and download a presentation that opens in Microsoft PowerPoint, Google Slides, LibreOffice, or Keynote.</p><p>It uses the same Open Packaging Conventions as native PowerPoint files, generated locally with no account, upload, or watermark. Bullet-heavy slides, talk outlines, and one-pagers are the sweet spot — build them here and refine in your desktop app.</p>",
    "features": [
      "Build .pptx presentations from scratch online",
      "Title and bullet slides, as many as you like",
      "Reorder slides with up/down controls",
      "Bold any bullet by wrapping it in **",
      "Output opens in PowerPoint, Google Slides, and more",
      "No uploads — generated client-side"
    ],
    "howTo": [
      {
        "step": "Add slide content",
        "description": "Type a title and one bullet (or line) per row in the body box."
      },
      {
        "step": "Reorder slides",
        "description": "Use the up/down arrows on each slide card to arrange the deck."
      },
      {
        "step": "Add more slides",
        "description": "Click Add slide to grow the presentation."
      },
      {
        "step": "Generate .pptx",
        "description": "Click Generate .pptx and download your deck."
      }
    ],
    "faq": [
      {
        "question": "Does it create real PowerPoint files?",
        "answer": "Yes. The output is a standard .pptx package using Open XML, so it opens natively in PowerPoint, Google Slides, LibreOffice, and Keynote."
      },
      {
        "question": "Can I include images?",
        "answer": "This creator makes text and bullet slides. For image-based decks, convert PDF pages to PPT with the PDF to PPT tool."
      },
      {
        "question": "Is 16:9 or 4:3 used?",
        "answer": "Slides are generated in widescreen 16:9 format."
      }
    ],
    "relatedSlugs": [
      "pdf-to-ppt",
      "word-creator",
      "markdown-preview",
      "word-to-markdown",
      "pdf-creator"
    ]
  }
};
