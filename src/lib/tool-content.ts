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
    "longDescription": "<p>Image to PDF is a free, browser-based converter that transforms JPG, PNG, WebP, and other image formats into professional PDF documents. Perfect for combining multiple photos into a single presentation, creating portfolios, or preparing scanned documents for submission, this tool handles the conversion entirely in your browser. No server uploads, no watermarks, and no registration required—just fast, reliable image-to-PDF conversion whenever you need it.</p><p>Our tool supports custom page sizes, orientation settings, and image ordering, giving you full control over the final PDF output. Whether you're a student turning in a photo assignment, a professional assembling a visual report, or anyone who needs to package images as a PDF, Image to PDF delivers clean, high-quality results in seconds. The client-side processing ensures your images remain private and secure throughout the entire conversion.</p>",
    "features": [
      "Convert JPG, PNG, WebP, BMP, and GIF images to PDF",
      "Combine multiple images into a single multi-page PDF",
      "Custom page sizes: A4, Letter, custom dimensions",
      "Adjustable page orientation (portrait or landscape)",
      "Drag-and-drop reordering of images before conversion",
      "100% client-side processing with no file uploads"
    ],
    "howTo": [
      {
        "step": "Add Images",
        "description": "Click the upload button or drag and drop one or more image files into the tool."
      },
      {
        "step": "Arrange Order",
        "description": "Drag and drop images to reorder them as they will appear in the PDF."
      },
      {
        "step": "Configure Settings",
        "description": "Choose page size, orientation, and margin options for your PDF."
      },
      {
        "step": "Generate PDF",
        "description": "Click convert and download your new PDF file instantly."
      }
    ],
    "faq": [
      {
        "question": "What image formats are supported?",
        "answer": "The tool supports all major image formats including JPG, JPEG, PNG, WebP, BMP, and animated GIF files."
      },
      {
        "question": "Can I combine images of different sizes into one PDF?",
        "answer": "Yes. Each image will be automatically scaled to fit the selected page size while maintaining its aspect ratio."
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
    "longDescription": "<p>PDF to Image is a fast, client-side tool that converts each page of a PDF document into high-resolution image files. Export your PDF as JPG or PNG images with customizable DPI settings, making it ideal for sharing individual pages on social media, extracting visual content for presentations, or creating image archives of important documents. The entire rendering process runs in your browser—no uploads, no waiting, no privacy concerns.</p><p>Whether you need to convert a single page or an entire multi-page document, PDF to Image handles it with precision and speed. Adjust output resolution from 72 DPI for web use to 300 DPI for print-quality output. Perfect for designers, educators, content creators, and anyone who needs to transform PDF content into versatile, shareable image formats without installing any software.</p>",
    "features": [
      "Render PDF pages as JPG or PNG images",
      "Adjustable DPI resolution from 72 to 300",
      "Batch export all pages at once or select specific pages",
      "High-fidelity rendering preserves text clarity and graphics",
      "100% browser-based with no file uploads",
      "Download individual pages or a ZIP of all converted images"
    ],
    "howTo": [
      {
        "step": "Upload PDF",
        "description": "Drag and drop your PDF file or click to browse and select it from your device."
      },
      {
        "step": "Select Output Format",
        "description": "Choose between JPG and PNG output, and set your desired DPI resolution."
      },
      {
        "step": "Choose Pages",
        "description": "Select to convert all pages or specify a range of pages to export."
      },
      {
        "step": "Convert and Download",
        "description": "Click convert, then download your images individually or as a ZIP archive."
      }
    ],
    "faq": [
      {
        "question": "What's the difference between JPG and PNG output?",
        "answer": "JPG is best for photographs and complex images with smaller file sizes. PNG is ideal for graphics with sharp lines and text, offering lossless quality at larger file sizes."
      },
      {
        "question": "Can I convert just one page from a multi-page PDF?",
        "answer": "Yes. You can specify a page range or select individual pages to convert rather than exporting the entire document."
      },
      {
        "question": "What DPI should I use?",
        "answer": "72 DPI is sufficient for web and screen use. 150 DPI works well for presentations. Use 300 DPI for print-quality output."
      },
      {
        "question": "Does this work with encrypted PDFs?",
        "answer": "If the PDF is password-protected, you'll need to unlock it first using our PDF Unlock tool before converting to images."
      }
    ],
    "relatedSlugs": [
      "image-to-pdf",
      "pdf-to-text",
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
    "longDescription": "<p>BrainCoder's Word to PDF converter transforms .docx files into downloadable PDF documents — entirely in your browser. Powered by the mammoth.js library for accurate .docx parsing, this tool preserves your document's formatting, headings, lists, tables, images, and styling during conversion. Upload your Word document, preview the converted output, and download a clean PDF without any server uploads.</p>\n<p>This is essential for anyone who needs to share documents in a universally readable format. PDFs preserve formatting across all devices and platforms, making them ideal for sharing resumes, reports, contracts, and academic papers. BrainCoder's converter produces professional-quality PDFs that look identical to the original Word document.</p>\n<p>All conversion happens locally in your browser using client-side JavaScript. Your Word documents — which may contain sensitive business data, personal information, or proprietary content — never leave your device. It's the safest, fastest way to convert Word documents to PDF without cloud services or email attachments to third parties.</p>",
    "features": [
      "Convert .docx files to PDF entirely in your browser",
      "Preserves headings, formatting, tables, images, and lists",
      "Powered by mammoth.js for accurate document parsing",
      "Preview converted content before downloading",
      "No server uploads — complete document privacy",
      "No watermarks, no accounts, no file size limits"
    ],
    "howTo": [
      {
        "step": "Upload Your Word Document",
        "description": "Click the upload button or drag and drop your .docx file. The tool parses the document using mammoth.js and displays a preview."
      },
      {
        "step": "Preview the Conversion",
        "description": "Review the parsed content to ensure headings, formatting, and content have been correctly interpreted. Make note of any formatting that may need adjustment."
      },
      {
        "step": "Download the PDF",
        "description": "Click 'Convert to PDF' to generate the document. Download the resulting PDF file to your device for sharing, printing, or archiving."
      }
    ],
    "faq": [
      {
        "question": "Does it preserve all Word formatting?",
        "answer": "The mammoth.js parser handles most common formatting including headings, bold/italic text, lists, tables, and images. Very complex layouts or advanced Word features may have minor differences in the PDF output."
      },
      {
        "question": "Can it handle large Word documents?",
        "answer": "Yes. The tool can process documents of significant length. Very large files with many images may take slightly longer to parse and convert."
      },
      {
        "question": "Is my Word document uploaded to a server?",
        "answer": "No. The entire conversion — parsing the .docx file and generating the PDF — happens in your browser. Your document never leaves your device."
      }
    ],
    "relatedSlugs": [
      "text-to-pdf",
      "html-to-pdf",
      "md-to-html",
      "notepad",
      "word-counter"
    ]
  },
  "pdf-to-text": {
    "longDescription": "<p>PDF to Text is a fast, efficient tool that extracts plain text from any PDF document and converts it into a clean, copyable text file. Perfect for researchers extracting content from papers, developers processing document data, or anyone who needs to pull text from a PDF without the hassle of manual copying, this tool works entirely in your browser for instant results. It handles both native digital PDFs and documents with embedded text layers, delivering accurate extraction every time.</p><p>The extracted text preserves the logical reading order and paragraph structure of the original document, making it ready for use in word processors, code editors, or any text-based workflow. Since all processing is client-side, your confidential documents—legal contracts, financial reports, medical records—remain completely private. No accounts, no uploads, no limits. Just paste, extract, and use your text.</p>",
    "features": [
      "Extract plain text from any PDF document",
      "Preserves reading order and paragraph structure",
      "Supports multi-page documents with batch extraction",
      "Copy text to clipboard or download as .txt file",
      "100% browser-based with no server uploads",
      "Works with both digital and text-layer PDFs"
    ],
    "howTo": [
      {
        "step": "Upload PDF",
        "description": "Drag and drop your PDF file or click to select it from your device."
      },
      {
        "step": "Extract Text",
        "description": "Click the extract button and wait for the tool to pull text from every page."
      },
      {
        "step": "Review Output",
        "description": "Scroll through the extracted text to verify completeness and accuracy."
      },
      {
        "step": "Copy or Download",
        "description": "Copy the text to your clipboard or download it as a plain text file."
      }
    ],
    "faq": [
      {
        "question": "Does it work with scanned PDFs?",
        "answer": "Scanned PDFs contain images, not text. For those, use our OCR PDF tool to recognize and extract the text first."
      },
      {
        "question": "Will the text formatting be preserved?",
        "answer": "The tool extracts plain text while preserving reading order and paragraph breaks. It does not preserve bold, italic, or font styling—use PDF to Word for formatted output."
      },
      {
        "question": "How accurate is the extraction?",
        "answer": "For digital PDFs with text layers, extraction is virtually 100% accurate. The tool reads the embedded text data directly from the PDF structure."
      },
      {
        "question": "Can I extract text from specific pages only?",
        "answer": "Yes, you can specify a page range to extract text from only certain pages of the document."
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
    "longDescription": "<p>BrainCoder's text to PDF converter transforms any plain text into a downloadable PDF document — instantly and privately. Whether you need to create a PDF from meeting notes, convert a text-based report, or generate a simple document for sharing or printing, this tool produces clean, well-formatted PDFs without uploading your content to any server.</p>\n<p>The converter lets you customize basic formatting options like font size, page margins, and line spacing before generating the PDF. This gives you control over the final appearance without needing a word processor. The output is a standard PDF file that can be opened, printed, and shared on any device.</p>\n<p>All text processing happens in your browser, ensuring your notes, drafts, and sensitive content never leave your device. It's the fastest way to turn raw text into a professional-looking PDF — no software installation, no account creation, and no privacy concerns.</p>",
    "features": [
      "Convert plain text to PDF in one click",
      "Customize font size, margins, and line spacing",
      "Supports long text with automatic page breaks",
      "Download as a standard PDF file",
      "No uploads — all processing happens in your browser",
      "No watermarks, no accounts, no usage limits"
    ],
    "howTo": [
      {
        "step": "Paste Your Text",
        "description": "Enter or paste the text you want to convert into the input area. This can be any plain text content — notes, reports, letters, or code."
      },
      {
        "step": "Adjust Formatting",
        "description": "Optionally adjust font size, page margins, and line spacing to control the appearance of your PDF document."
      },
      {
        "step": "Generate and Download",
        "description": "Click 'Convert to PDF' and the tool generates the document. Download the PDF file directly to your device."
      }
    ],
    "faq": [
      {
        "question": "Can I add headings or formatting to the text?",
        "answer": "The tool works with plain text. For rich formatting (headings, bold, lists), consider using the Markdown to HTML converter first, then the HTML to PDF tool for more control."
      },
      {
        "question": "Does it support different page sizes?",
        "answer": "The tool uses standard A4 or Letter page sizes by default. Text is automatically paginated based on the selected font size and margins."
      },
      {
        "question": "Is my text uploaded to generate the PDF?",
        "answer": "No. The entire PDF generation process happens locally in your browser. Your text never leaves your device."
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
    "longDescription": "<p>PDF to PPT is a specialized converter that transforms PDF documents into editable Microsoft PowerPoint presentations. Instead of manually recreating slides from PDF content, this tool automatically splits and converts each page into a slide, preserving layouts, images, and text for easy editing. It's ideal for repurposing research papers into lecture slides, turning reports into presentations, or converting design mockups into editable PPTX files—all from your browser without any uploads.</p><p>The tool intelligently analyzes each PDF page and maps its content onto PowerPoint slide elements, maintaining the visual hierarchy and structure of your original document. Whether you're an educator building course materials, a consultant adapting a report for a client meeting, or a student preparing a presentation, PDF to PPT saves hours of manual work. The client-side processing ensures your work remains confidential from start to finish.</p>",
    "features": [
      "Convert PDF pages to editable PowerPoint slides",
      "Preserves images, text boxes, and layout structure",
      "Supports multi-page PDFs of any length",
      "Export as .pptx files compatible with PowerPoint and Google Slides",
      "100% client-side conversion with no data uploads",
      "Free to use without registration or watermarks"
    ],
    "howTo": [
      {
        "step": "Upload PDF",
        "description": "Drag and drop your PDF presentation or document into the converter tool."
      },
      {
        "step": "Select Slide Options",
        "description": "Choose whether each PDF page becomes one slide and set your preferred slide dimensions."
      },
      {
        "step": "Convert to PPT",
        "description": "Click the convert button and let the tool process your document into slides."
      },
      {
        "step": "Download Presentation",
        "description": "Download the .pptx file and open it in PowerPoint or Google Slides for editing."
      }
    ],
    "faq": [
      {
        "question": "Will I be able to edit the slides after conversion?",
        "answer": "Yes. The output is a standard .pptx file with editable text boxes and images that you can modify in PowerPoint, Google Slides, or Keynote."
      },
      {
        "question": "How accurate is the layout conversion?",
        "answer": "The tool preserves the general layout and content positioning. Complex multi-column layouts may need some manual adjustment for optimal slide appearance."
      },
      {
        "question": "Can I convert specific pages only?",
        "answer": "Yes, you can specify a page range to convert only the pages you need into slides."
      },
      {
        "question": "Does it preserve animations and transitions?",
        "answer": "PDFs don't contain animation or transition data, so those won't be converted. You can add them manually in PowerPoint after conversion."
      }
    ],
    "relatedSlugs": [
      "pdf-to-image",
      "pdf-to-word",
      "pdf-to-markdown",
      "pdf-merge",
      "pdf-page-numbers"
    ]
  },
  "pdf-rotate": {
    "longDescription": "<p>PDF Rotator is a quick, straightforward tool that lets you rotate individual pages or entire PDF documents to the correct orientation. Whether you've received a sideways scan, need to flip upside-down pages, or want to adjust the orientation of specific pages in a mixed-orientation document, this tool handles it with ease. Rotate pages 90°, 180°, or 270° in either direction with a single click—all processed securely in your browser.</p><p>Mixed-orientation PDFs are a common headache when combining scanned documents from different sources. PDF Rotator lets you fix orientation on a per-page basis, ensuring your final document reads correctly from start to finish. The tool preserves all existing content, formatting, and quality while making the rotation adjustments. No uploads, no quality loss, no hassle—just clean, correctly oriented PDFs ready for printing or sharing.</p>",
    "features": [
      "Rotate PDF pages by 90°, 180°, or 270° in either direction",
      "Rotate individual pages or the entire document at once",
      "Fix mixed-orientation PDFs on a per-page basis",
      "Preserve all content, formatting, and image quality",
      "100% client-side processing with no uploads",
      "Free with no file size limits or watermarks"
    ],
    "howTo": [
      {
        "step": "Upload PDF",
        "description": "Drag and drop your PDF file or click to select it from your device."
      },
      {
        "step": "Select Pages to Rotate",
        "description": "Click on individual pages to rotate them or use the rotate-all option for the entire document."
      },
      {
        "step": "Choose Rotation Angle",
        "description": "Select 90° clockwise, 90° counter-clockwise, or 180° for each page or the whole document."
      },
      {
        "step": "Download Rotated PDF",
        "description": "Preview the corrected orientation and download the rotated PDF."
      }
    ],
    "faq": [
      {
        "question": "Will rotating reduce the quality of my PDF?",
        "answer": "No. Rotation is a lossless operation that simply changes the page orientation metadata. No content or quality is affected."
      },
      {
        "question": "Can I rotate just one page in a 50-page document?",
        "answer": "Yes. The tool allows per-page rotation, so you can fix individual pages without affecting the rest of the document."
      },
      {
        "question": "Does this work with scanned PDFs?",
        "answer": "Yes. The tool works with any PDF regardless of its content type—digital text, scanned images, or a mix of both."
      },
      {
        "question": "Can I rotate pages in different directions?",
        "answer": "Absolutely. Each page can be rotated independently in any direction, which is perfect for fixing mixed-orientation documents."
      }
    ],
    "relatedSlugs": [
      "pdf-crop",
      "pdf-remove-pages",
      "pdf-merge",
      "pdf-split",
      "pdf-editor"
    ]
  },
  "pdf-remove-pages": {
    "longDescription": "<p>PDF Remove Pages is a precise, easy-to-use tool that lets you delete unwanted pages from any PDF document. Whether you need to strip out blank pages, remove confidential sections, trim excess content, or extract only the relevant portions of a lengthy document, this tool gives you granular control over what stays and what goes. The entire process runs in your browser, ensuring your sensitive documents never leave your device.</p><p>Simply upload your PDF, select the pages you want to remove by clicking on their thumbnails, and download the resulting clean document. The tool preserves all remaining content, formatting, and hyperlinks exactly as they were. It's the fastest way to clean up bloated PDFs, prepare documents for distribution, or create customized versions of longer reports—all without installing software or risking data exposure.</p>",
    "features": [
      "Remove individual pages or page ranges from PDFs",
      "Visual thumbnail preview for easy page selection",
      "Preserve all content, formatting, and links in remaining pages",
      "Support PDFs of any size and page count",
      "100% browser-based with no server uploads",
      "Free to use with no registration required"
    ],
    "howTo": [
      {
        "step": "Upload PDF",
        "description": "Drag and drop your PDF or click to browse and select it from your device."
      },
      {
        "step": "Preview Pages",
        "description": "View thumbnails of all pages in the document to identify which ones to remove."
      },
      {
        "step": "Select Pages to Delete",
        "description": "Click on pages to mark them for removal, or enter specific page numbers in the input field."
      },
      {
        "step": "Remove and Download",
        "description": "Confirm the deletion and download the resulting PDF with the selected pages removed."
      }
    ],
    "faq": [
      {
        "question": "Can I undo the page removal?",
        "answer": "The original file is not modified. Always keep a backup of your original PDF before removing pages, as the operation is applied to the downloaded result."
      },
      {
        "question": "Will removing pages affect the PDF structure?",
        "answer": "The tool cleanly removes selected pages while maintaining the integrity of the remaining document structure, including bookmarks and links."
      },
      {
        "question": "How many pages can I remove at once?",
        "answer": "You can select and remove as many pages as you want in a single operation, whether it's one page or hundreds."
      },
      {
        "question": "Does this work with encrypted PDFs?",
        "answer": "Password-protected PDFs need to be unlocked first using our PDF Unlock tool before you can remove pages."
      }
    ],
    "relatedSlugs": [
      "pdf-split",
      "pdf-merge",
      "pdf-crop",
      "pdf-rotate",
      "pdf-editor"
    ]
  },
  "pdf-watermark": {
    "longDescription": "<p>PDF Watermark is a versatile tool that adds custom text watermarks to every page of your PDF documents. Whether you need to stamp 'CONFIDENTIAL' on sensitive files, mark drafts with 'DRAFT' watermarks, brand documents with your company name, or add copyright notices, this tool lets you create professional watermarks with full control over text, font, size, color, opacity, and positioning. All watermarking is performed client-side in your browser for complete privacy.</p><p>Customize your watermark placement with options for centered, diagonal, or corner positioning, and adjust transparency to ensure the watermark is visible without obscuring content. The tool processes your PDF in seconds, applying consistent watermarks across all pages with pixel-perfect accuracy. From business professionals protecting proprietary documents to educators marking course materials, PDF Watermark delivers a quick, free, and secure solution for all your watermarking needs.</p>",
    "features": [
      "Add custom text watermarks to all PDF pages",
      "Adjustable font, size, color, and opacity settings",
      "Multiple placement options: center, diagonal, corners",
      "Apply watermarks consistently across all pages",
      "100% client-side processing with no data uploads",
      "Free with no sign-up, watermarks, or file limits"
    ],
    "howTo": [
      {
        "step": "Upload PDF",
        "description": "Drag and drop your PDF file into the watermark tool or click to select it."
      },
      {
        "step": "Enter Watermark Text",
        "description": "Type your watermark text and customize the font, size, color, and transparency."
      },
      {
        "step": "Choose Position and Rotation",
        "description": "Select where the watermark appears on each page—center, diagonal, or specific corners."
      },
      {
        "step": "Apply and Download",
        "description": "Click apply to add the watermark to all pages, then download your watermarked PDF."
      }
    ],
    "faq": [
      {
        "question": "Can I add different watermarks to different pages?",
        "answer": "The standard tool applies the same watermark to all pages. For page-specific watermarks, use our PDF Editor tool which offers more granular control."
      },
      {
        "question": "Will the watermark prevent text selection or copying?",
        "answer": "Text watermarks are overlaid on the PDF content. They don't prevent text selection but serve as a visual deterrent and branding element."
      },
      {
        "question": "Can I adjust the watermark opacity?",
        "answer": "Yes. You can set the opacity from fully transparent to fully opaque, allowing you to create subtle watermarks that don't obscure content."
      },
      {
        "question": "Does this work with all PDF types?",
        "answer": "Yes. The tool works with any PDF regardless of its content—digital text, scanned images, or mixed content."
      }
    ],
    "relatedSlugs": [
      "pdf-page-numbers",
      "pdf-protect",
      "pdf-editor",
      "pdf-creator",
      "pdf-merge"
    ]
  },
  "pdf-page-numbers": {
    "longDescription": "<p>Add Page Numbers to PDF is a practical tool that automatically inserts page numbers into every page of your PDF document. Essential for multi-page documents that need professional organization, this tool lets you customize the number format, position, font style, and starting number. Whether you're preparing a legal brief, academic thesis, business report, or any lengthy document, page numbers make navigation and referencing effortless.</p><p>Choose from multiple positioning options—top-left, top-center, top-right, bottom-left, bottom-center, or bottom-right—and select from formats like plain numbers, 'Page X of Y', Roman numerals, and more. The tool applies numbers consistently across all pages while preserving your existing content and formatting. All processing happens locally in your browser, keeping your documents completely private.</p>",
    "features": [
      "Add page numbers to all pages in a PDF",
      "Multiple position options: top, bottom, left, center, right",
      "Customizable number formats: numeric, Roman, 'Page X of Y'",
      "Adjustable font, size, color, and starting number",
      "Preserve existing content and formatting",
      "100% client-side with no uploads or sign-ups"
    ],
    "howTo": [
      {
        "step": "Upload PDF",
        "description": "Drag and drop your PDF document or click to select it from your device."
      },
      {
        "step": "Configure Number Format",
        "description": "Choose number style (numeric, Roman, 'Page X of Y'), starting number, and font settings."
      },
      {
        "step": "Select Position",
        "description": "Pick where page numbers appear: top or bottom, left, center, or right alignment."
      },
      {
        "step": "Apply and Download",
        "description": "Add the page numbers and download your numbered PDF document."
      }
    ],
    "faq": [
      {
        "question": "Can I use Roman numeral page numbering?",
        "answer": "Yes. The tool supports standard Arabic numerals (1, 2, 3), Roman numerals (I, II, III), and the 'Page X of Y' format."
      },
      {
        "question": "Will page numbers overlap with existing content?",
        "answer": "The tool places numbers in the page margins. If your content extends to the edges, you may want to use our PDF Cropper tool first to create margin space."
      },
      {
        "question": "Can I skip numbering the first page?",
        "answer": "You can set the starting number to begin numbering from any page, effectively skipping the title page or cover."
      },
      {
        "question": "Does this work with landscape and portrait pages?",
        "answer": "Yes. The tool correctly places page numbers regardless of individual page orientations within the document."
      }
    ],
    "relatedSlugs": [
      "pdf-watermark",
      "pdf-merge",
      "pdf-split",
      "pdf-page-numbers",
      "pdf-editor"
    ]
  },
  "pdf-crop": {
    "longDescription": "<p>PDF Cropper is a precision tool that lets you trim and adjust the margins of PDF pages. Whether you need to remove white space around scanned documents, crop out unwanted borders, resize page content for printing, or standardize margins across a document, this tool provides intuitive visual controls for exact cropping. The interactive crop interface lets you drag handles to define the exact area you want to keep, with real-time preview of the result.</p><p>Unlike basic cropping tools, PDF Cropper lets you apply different crop settings to individual pages or apply uniform cropping across the entire document. It's perfect for cleaning up scanned documents, preparing figures for publication, standardizing page dimensions, or removing scanner artifacts from page edges. All processing happens in your browser, so your documents remain completely private and secure.</p>",
    "features": [
      "Visually crop PDF pages with drag-and-drop handles",
      "Apply uniform cropping across all pages or per-page adjustments",
      "Remove white space, borders, and scanner artifacts",
      "Set precise crop dimensions in inches, millimeters, or pixels",
      "Real-time preview of cropped results",
      "100% client-side processing with no file uploads"
    ],
    "howTo": [
      {
        "step": "Upload PDF",
        "description": "Drag and drop your PDF file or click to select it from your device."
      },
      {
        "step": "Adjust Crop Area",
        "description": "Use the visual crop handles to define the area you want to keep, or enter exact dimensions."
      },
      {
        "step": "Apply to Pages",
        "description": "Choose to apply the crop to all pages or customize cropping for individual pages."
      },
      {
        "step": "Download Cropped PDF",
        "description": "Preview the result and download your cropped PDF document."
      }
    ],
    "faq": [
      {
        "question": "Does cropping permanently remove content?",
        "answer": "Cropping adjusts the visible area of the page. The hidden content may still exist in the PDF data. For permanent removal, use the trim option which removes cropped content entirely."
      },
      {
        "question": "Can I crop pages differently within the same document?",
        "answer": "Yes. The per-page cropping option lets you set different crop boundaries for each page, which is useful for documents with mixed content sizes."
      },
      {
        "question": "Will cropping affect text quality?",
        "answer": "No. Cropping only changes the visible boundaries of the page. Text and image quality remain completely unaffected."
      },
      {
        "question": "Can I set crop dimensions in specific units?",
        "answer": "Yes. You can specify crop dimensions in inches, millimeters, or pixels depending on your needs."
      }
    ],
    "relatedSlugs": [
      "pdf-rotate",
      "pdf-remove-pages",
      "pdf-to-image",
      "pdf-page-numbers",
      "pdf-editor"
    ]
  },
  "pdf-protect": {
    "longDescription": "<p>PDF Protect is a security-focused tool that adds password encryption to your PDF documents. Safeguard sensitive information by setting an owner password that prevents unauthorized opening, or add a permissions password that restricts printing, copying, and editing while still allowing viewing. The encryption happens entirely in your browser using industry-standard AES encryption—your password and document are never transmitted anywhere.</p><p>In a world where data breaches and unauthorized access are constant concerns, PDF Protect gives you control over who can access and modify your documents. Whether you're protecting financial reports, legal contracts, personal records, or proprietary business information, our tool applies robust encryption in seconds. It's the fastest, safest way to secure your PDFs without relying on third-party services or expensive software.</p>",
    "features": [
      "Encrypt PDFs with owner and user passwords",
      "AES-256 encryption for maximum security",
      "Restrict printing, copying, editing, and content extraction",
      "Support for both open and permissions passwords",
      "100% client-side encryption—passwords never leave your browser",
      "Free with no registration or file size limits"
    ],
    "howTo": [
      {
        "step": "Upload PDF",
        "description": "Drag and drop the PDF you want to protect or click to browse your device."
      },
      {
        "step": "Set Passwords",
        "description": "Enter an owner password for full access control and optionally a user password to restrict opening."
      },
      {
        "step": "Configure Permissions",
        "description": "Choose which actions to restrict: printing, copying text, editing, or content extraction."
      },
      {
        "step": "Apply Encryption",
        "description": "Click protect to encrypt the PDF and download the secured document."
      }
    ],
    "faq": [
      {
        "question": "What's the difference between owner and user passwords?",
        "answer": "A user password is required to open the PDF. An owner password controls permissions like printing and editing but doesn't prevent viewing unless set."
      },
      {
        "question": "How strong is the encryption?",
        "answer": "The tool uses AES-256 encryption, which is the industry standard for document security and is virtually unbreakable with current technology."
      },
      {
        "question": "Can I remove the password later?",
        "answer": "Yes, use our PDF Unlock tool to remove password protection from a PDF if you have the password."
      },
      {
        "question": "Will protected PDFs open in all readers?",
        "answer": "Yes. The encryption follows the standard PDF specification and is compatible with Adobe Acrobat, Preview, Chrome, and all major PDF readers."
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
    "longDescription": "<p>PDF Unlock is a utility tool that removes password protection from encrypted PDF documents. If you've forgotten a password, need to edit a restricted PDF, or want to remove printing and copying restrictions from a document you own, this tool provides a straightforward solution. Simply upload your locked PDF, enter the correct password, and the tool will produce an unlocked version free of all restrictions—entirely within your browser.</p><p>The tool handles both types of PDF passwords: user passwords (required to open the document) and owner passwords (that restrict editing, printing, and copying). Once unlocked, your PDF becomes fully accessible and editable, compatible with any PDF reader or editor without restrictions. All decryption happens client-side, ensuring your password-protected documents and their passwords remain completely private.</p>",
    "features": [
      "Remove user and owner passwords from PDFs",
      "Eliminate printing, copying, and editing restrictions",
      "Support for AES and RC4 encryption methods",
      "Instant unlocking with no file size limits",
      "100% client-side decryption with no data uploads",
      "Free with no sign-up or watermarks"
    ],
    "howTo": [
      {
        "step": "Upload Locked PDF",
        "description": "Drag and drop your password-protected PDF or click to select it from your device."
      },
      {
        "step": "Enter Password",
        "description": "Type the known password that protects the PDF document."
      },
      {
        "step": "Unlock Document",
        "description": "Click the unlock button to remove all password protection and restrictions."
      },
      {
        "step": "Download Unlocked PDF",
        "description": "Download the unlocked PDF that can now be opened, edited, and printed without restrictions."
      }
    ],
    "faq": [
      {
        "question": "What if I don't know the password?",
        "answer": "You must know the password to unlock a PDF. This tool removes protection given the correct password—it cannot crack or guess forgotten passwords."
      },
      {
        "question": "Can I unlock a PDF without the user password?",
        "answer": "No. The user password is required to decrypt and unlock the document. You need the password that was set when the PDF was protected."
      },
      {
        "question": "Will unlocking affect the document content?",
        "answer": "No. Unlocking only removes password protection and restrictions. All content, formatting, and quality remain exactly the same."
      },
      {
        "question": "Does this work with all PDF encryption?",
        "answer": "The tool supports standard PDF encryption methods including AES-256, AES-128, and RC4. Very rare or custom encryption schemes may not be supported."
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
    "longDescription": "<p>PDF Metadata Viewer is a diagnostic tool that inspects and displays the hidden metadata embedded in PDF documents. Every PDF contains metadata fields like author name, creation date, modification date, title, subject, keywords, and software used to create it. This tool reveals all of that information in a clean, readable format, giving you complete visibility into a PDF's background information and history.</p><p>Understanding PDF metadata is valuable for document forensics, verifying file authenticity, identifying original creators, checking modification timestamps, and managing document libraries. Whether you're an IT professional auditing document workflows, a legal expert establishing document provenance, or simply curious about a PDF's hidden details, PDF Metadata Viewer provides instant, comprehensive results. The inspection happens entirely in your browser—your PDF is never uploaded or stored anywhere.</p>",
    "features": [
      "View complete PDF metadata: author, title, subject, keywords",
      "Display creation and modification timestamps",
      "Identify the software used to create or modify the PDF",
      "View PDF version and encryption status",
      "100% client-side inspection with no file uploads",
      "Free with no registration or limits"
    ],
    "howTo": [
      {
        "step": "Upload PDF",
        "description": "Drag and drop your PDF file or click to select it from your device."
      },
      {
        "step": "View Metadata",
        "description": "The tool instantly displays all embedded metadata fields in an organized layout."
      },
      {
        "step": "Review Details",
        "description": "Examine author information, dates, keywords, PDF version, and creation software."
      },
      {
        "step": "Copy or Export",
        "description": "Copy specific metadata fields or export the complete metadata report."
      }
    ],
    "faq": [
      {
        "question": "Can I edit metadata with this tool?",
        "answer": "This is a viewer tool designed for inspection only. To modify metadata, use our PDF Editor tool which supports metadata editing."
      },
      {
        "question": "What if a PDF has no metadata?",
        "answer": "Some PDFs have minimal or no embedded metadata. The tool will show which fields are empty or missing from the document."
      },
      {
        "question": "Can metadata reveal who created a PDF?",
        "answer": "Yes. The author and creator fields often contain the name of the person or software that generated the PDF, depending on how it was created."
      },
      {
        "question": "Does this work with encrypted PDFs?",
        "answer": "Basic metadata can often be read even from encrypted PDFs. For fully encrypted files, you may need to unlock them first."
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
    "longDescription": "<p>PDF to Excel is a powerful data extraction tool that identifies and converts tables within PDF documents into editable Microsoft Excel spreadsheets. Whether you're pulling financial data from reports, extracting statistical tables from research papers, or converting invoice tables into editable formats, this tool uses intelligent table detection to map PDF content into structured Excel cells with rows and columns preserved.</p><p>The tool analyzes each page of your PDF, identifies tabular data structures, and exports them as .xlsx files ready for use in Excel, Google Sheets, or any spreadsheet application. Unlike simple text extraction, PDF to Excel maintains the relationship between cells, columns, and rows so your data is immediately usable for analysis, calculations, and reporting. All processing is client-side, ensuring your sensitive financial or business data stays completely private.</p>",
    "features": [
      "Extract tables from PDF into editable Excel spreadsheets",
      "Intelligent table detection for complex layouts",
      "Preserve row and column structure in output",
      "Support multi-page documents with multiple tables",
      "Export as .xlsx files compatible with Excel and Google Sheets",
      "100% client-side processing with no data uploads"
    ],
    "howTo": [
      {
        "step": "Upload PDF",
        "description": "Drag and drop your PDF containing tables or click to select it from your device."
      },
      {
        "step": "Detect Tables",
        "description": "The tool scans your PDF and identifies all table structures on each page."
      },
      {
        "step": "Review and Select",
        "description": "Preview the detected tables and select which ones to extract if needed."
      },
      {
        "step": "Download Excel File",
        "description": "Download the .xlsx file with your extracted table data ready for spreadsheet use."
      }
    ],
    "faq": [
      {
        "question": "How accurate is the table extraction?",
        "answer": "Accuracy depends on how clearly the tables are defined in the PDF. Well-structured tables with clear borders and alignment extract with very high accuracy."
      },
      {
        "question": "Can it handle merged cells?",
        "answer": "The tool attempts to handle merged cells and complex table structures, though very complex layouts may require some manual adjustment in Excel."
      },
      {
        "question": "Does it work with scanned PDFs?",
        "answer": "For scanned PDFs, use our OCR PDF tool first to add a text layer, then convert the resulting PDF to Excel for best results."
      },
      {
        "question": "Can I extract multiple tables at once?",
        "answer": "Yes. The tool detects and can extract all tables from all pages in a single operation."
      }
    ],
    "relatedSlugs": [
      "pdf-to-text",
      "pdf-to-word",
      "pdf-ocr",
      "pdf-to-markdown",
      "pdf-to-image"
    ]
  },
  "pdf-to-markdown": {
    "longDescription": "<p>PDF to Markdown is a conversion tool that transforms PDF documents into clean, structured Markdown or HTML format. Ideal for developers, technical writers, and content creators who need to repurpose PDF content for websites, documentation platforms, or GitHub repos, this tool extracts text while preserving headings, lists, code blocks, tables, and other structural elements in Markdown syntax.</p><p>Markdown is the universal format for documentation, README files, blogs, and wikis. Converting PDF to Markdown lets you reuse existing documents in modern content workflows without manual reformatting. The tool handles headings, bold and italic text, bulleted and numbered lists, blockquotes, links, and table structures. All conversion happens client-side in your browser, keeping your source material completely private and secure.</p>",
    "features": [
      "Convert PDF content to clean Markdown syntax",
      "Preserve headings, lists, tables, and text formatting",
      "Output as .md or .html files",
      "Maintain document structure and reading order",
      "Support for bold, italic, links, and blockquotes",
      "100% client-side conversion with no uploads"
    ],
    "howTo": [
      {
        "step": "Upload PDF",
        "description": "Drag and drop your PDF document or click to select it from your device."
      },
      {
        "step": "Choose Output Format",
        "description": "Select Markdown (.md) or HTML (.html) as your desired output format."
      },
      {
        "step": "Convert Document",
        "description": "Click the convert button and let the tool extract and format the content."
      },
      {
        "step": "Download Output",
        "description": "Copy the generated Markdown to your clipboard or download it as a file."
      }
    ],
    "faq": [
      {
        "question": "How well does it handle tables in PDF?",
        "answer": "The tool converts tables to Markdown table syntax with proper alignment. Complex tables with merged cells may need minor manual cleanup."
      },
      {
        "question": "Will images from the PDF be included?",
        "answer": "The tool extracts text and structural formatting. Images in the PDF are referenced but not embedded in the Markdown output."
      },
      {
        "question": "Is this useful for GitHub READMEs?",
        "answer": "Absolutely. If you have documentation in PDF format, this tool converts it to Markdown suitable for GitHub repos, wikis, and documentation sites."
      },
      {
        "question": "Does it preserve code blocks?",
        "answer": "The tool attempts to detect and preserve code-like content in code block formatting, though it works best with clearly formatted source material."
      }
    ],
    "relatedSlugs": [
      "pdf-to-text",
      "pdf-to-word",
      "text-to-pdf",
      "pdf-to-excel",
      "pdf-to-ppt"
    ]
  },
  "pdf-ocr": {
    "longDescription": "<p>PDF OCR is an advanced optical character recognition tool that extracts text from scanned PDFs, photographed documents, and image-based PDFs. If you've ever struggled with a PDF where you can't select, copy, or search the text because it's just a scanned image, PDF OCR transforms it into a fully searchable, selectable, and editable document. The OCR processing runs in your browser, keeping your sensitive documents completely private.</p><p>The tool analyzes each page image, recognizes characters and words using advanced OCR algorithms, and adds an invisible text layer to the PDF. The result is a document that looks identical to the original but now supports text selection, copy-paste, search, and compatibility with text extraction tools. From digitizing archived paper records to making scanned contracts searchable, PDF OCR is essential for anyone working with image-based documents.</p>",
    "features": [
      "Extract text from scanned PDFs and image-based documents",
      "Add searchable text layer to scanned PDFs",
      "Support for multiple languages in OCR recognition",
      "Maintain original layout and formatting of scanned pages",
      "100% client-side OCR processing with no uploads",
      "Free with no registration, watermarks, or file limits"
    ],
    "howTo": [
      {
        "step": "Upload Scanned PDF",
        "description": "Drag and drop your scanned or image-based PDF into the OCR tool."
      },
      {
        "step": "Select Language",
        "description": "Choose the primary language of the document for optimal character recognition accuracy."
      },
      {
        "step": "Run OCR",
        "description": "Click the OCR button and wait as the tool processes each page to recognize text."
      },
      {
        "step": "Download Result",
        "description": "Download the OCR-processed PDF with selectable, searchable text or extract to plain text."
      }
    ],
    "faq": [
      {
        "question": "How accurate is the OCR?",
        "answer": "Accuracy depends on scan quality. Clear, well-scanned documents with standard fonts typically achieve 95-99% accuracy. Low-resolution or handwritten documents may have lower accuracy."
      },
      {
        "question": "What languages are supported?",
        "answer": "The tool supports major world languages including English, Spanish, French, German, Chinese, Japanese, Korean, and many more."
      },
      {
        "question": "Will OCR change how my PDF looks?",
        "answer": "No. The OCR adds an invisible text layer underneath the existing page images. The visual appearance remains exactly the same."
      },
      {
        "question": "Can OCR handle multi-column layouts?",
        "answer": "Yes. The tool is designed to recognize text in complex layouts including multi-column pages, sidebars, and mixed text-image content."
      }
    ],
    "relatedSlugs": [
      "pdf-to-text",
      "pdf-to-excel",
      "pdf-to-word",
      "pdf-to-image",
      "image-to-pdf"
    ]
  },
  "pdf-compare": {
    "longDescription": "<p>PDF Compare is a side-by-side document comparison tool that highlights the differences between two PDF files. Essential for legal professionals reviewing contract revisions, editors checking document changes, or anyone who needs to identify what's different between two versions of a PDF, this tool provides a clear, visual diff that shows additions, deletions, and modifications between documents.</p><p>The tool performs a detailed comparison of both text content and visual layout, presenting changes in an easy-to-read format with highlighted differences. Whether you're verifying that only intended changes were made, checking for unauthorized modifications, or simply need to see what changed between document versions, PDF Compare delivers accurate, comprehensive results entirely within your browser. No sensitive documents are ever uploaded to external servers.</p>",
    "features": [
      "Compare two PDFs and highlight all differences",
      "Detect text changes: additions, deletions, and modifications",
      "Visual layout comparison for formatting changes",
      "Side-by-side and overlay comparison views",
      "Generate a summary report of all changes found",
      "100% client-side comparison with no file uploads"
    ],
    "howTo": [
      {
        "step": "Upload Original PDF",
        "description": "Drag and drop the original or base version of your PDF document."
      },
      {
        "step": "Upload Modified PDF",
        "description": "Upload the second version of the PDF that you want to compare against the original."
      },
      {
        "step": "Run Comparison",
        "description": "Click compare to analyze both documents and identify all differences."
      },
      {
        "step": "Review Changes",
        "description": "Examine the highlighted differences in the side-by-side comparison view."
      }
    ],
    "faq": [
      {
        "question": "Can I compare PDFs with different page counts?",
        "answer": "Yes. The tool handles PDFs of different lengths and will highlight pages that exist in one document but not the other."
      },
      {
        "question": "Does it detect image changes?",
        "answer": "The tool primarily compares text content and layout structure. Significant image changes may be flagged based on positional and size differences."
      },
      {
        "question": "How does it handle formatting changes?",
        "answer": "Text formatting changes like font size or style modifications are detected and highlighted alongside content changes."
      },
      {
        "question": "Can I export the comparison results?",
        "answer": "Yes. You can generate a summary report of all differences found between the two documents."
      }
    ],
    "relatedSlugs": [
      "pdf-redact",
      "pdf-metadata",
      "pdf-to-text",
      "pdf-merge",
      "pdf-editor"
    ]
  },
  "pdf-redact": {
    "longDescription": "<p>PDF Redact is a security-focused tool that permanently removes sensitive content from PDF documents by blacking out selected areas. Unlike simply covering content with a black rectangle—which can often be removed to reveal the underlying text—true redaction permanently deletes the redacted content from the PDF file, making it unrecoverable. This is essential for compliance with privacy regulations like GDPR, HIPAA, and FOIA requirements.</p><p>Whether you need to hide personal information like names and Social Security numbers, obscure financial figures, remove confidential business data, or censor portions of documents before public release, PDF Redact provides precise control over what gets permanently removed. Draw redaction boxes over any content, preview the result, and download a clean PDF where the redacted information is completely and irreversibly eliminated from the file structure.</p>",
    "features": [
      "Permanently remove sensitive content from PDFs",
      "Draw redaction areas over text, images, and any content",
      "True redaction that removes underlying data (not just overlays)",
      "Black out or white out redaction styles",
      "Preview redacted document before finalizing",
      "100% client-side redaction with no data uploads"
    ],
    "howTo": [
      {
        "step": "Upload PDF",
        "description": "Drag and drop the PDF containing sensitive information you need to redact."
      },
      {
        "step": "Mark Redaction Areas",
        "description": "Draw boxes over the content you want to permanently remove—text, images, or specific regions."
      },
      {
        "step": "Preview Result",
        "description": "Review the redacted document to ensure all sensitive content is properly covered."
      },
      {
        "step": "Download Redacted PDF",
        "description": "Apply the redactions permanently and download the cleaned PDF file."
      }
    ],
    "faq": [
      {
        "question": "Is the redaction truly permanent?",
        "answer": "Yes. Unlike overlaying a black box, this tool removes the underlying content data from the PDF structure, making redacted information unrecoverable."
      },
      {
        "question": "Can I redact specific words within a paragraph?",
        "answer": "You can draw precise redaction boxes at any position, allowing you to target specific words, numbers, or regions within text blocks."
      },
      {
        "question": "Will redaction affect the rest of the document?",
        "answer": "No. Redaction only removes the content within the marked areas. All other content, formatting, and page structure remain intact."
      },
      {
        "question": "Is this suitable for legal or compliance purposes?",
        "answer": "PDF Redact performs true content removal suitable for compliance with GDPR, HIPAA, and other regulations. However, always verify with your compliance team for specific legal requirements."
      }
    ],
    "relatedSlugs": [
      "pdf-protect",
      "pdf-unlock",
      "pdf-metadata",
      "pdf-watermark",
      "pdf-editor"
    ]
  },
  "pdf-auto-redact": {
    "longDescription": "<p>Auto-Redact PDF is a privacy tool that finds and permanently blackens every occurrence of a word or phrase across a PDF document in one click. Instead of scanning pages by eye, type a name, account number, email address, or any sensitive term and the tool instantly highlights every matching occurrence—then exports a PDF where each match is covered with a solid black box. This is ideal for scrubbing personal data from large documents: names in contracts, email addresses in shared reports, payment details in invoices, or regulated identifiers that must not be exposed.</p><p>The search runs directly on the document's text layer using precise word positioning, so matches are detected on every page, even inside dense paragraphs. Redaction boxes are padded slightly around each match to fully cover the glyphs. Because all detection and processing happens in your browser, your documents and the sensitive terms you search for never leave your device.</p>",
    "features": [
      "Search for a word or phrase and redact every match automatically",
      "Multi-word phrase matching with exact word boundary detection",
      "Redaction boxes padded around each occurrence for full coverage",
      "Per-page match counts with a visual preview of detected areas",
      "Run multiple searches and exclude pages when needed",
      "100% client-side processing with no uploads"
    ],
    "howTo": [
      {
        "step": "Upload PDF",
        "description": "Open the PDF document containing sensitive text you want to remove."
      },
      {
        "step": "Enter Search Term",
        "description": "Type a name, number, email, or phrase and click Find matches. Every occurrence is highlighted across all pages."
      },
      {
        "step": "Review Matches",
        "description": "Browse page previews to confirm the highlighted areas cover exactly what you want redacted."
      },
      {
        "step": "Download Redacted PDF",
        "description": "Export the PDF with every matching occurrence covered by a black redaction box."
      }
    ],
    "faq": [
      {
        "question": "How does auto-redaction find words on a page?",
        "answer": "The tool reads the PDF's embedded text layer, builds positioned word boxes, and matches your search phrase against them—so matches are found even inside dense paragraphs."
      },
      {
        "question": "Can I restrict redaction to certain pages?",
        "answer": "Yes. After searching, you can exclude specific pages whose matches you want to keep, then export the rest."
      },
      {
        "question": "Is the redaction reversible?",
        "answer": "No. Redaction draws solid boxes directly into the document structure, permanently covering the matched content in the exported file."
      },
      {
        "question": "Does it work on scanned documents?",
        "answer": "The matching relies on the text layer. Scanned PDFs without OCR text may need to be converted with our OCR tool first."
      }
    ],
    "relatedSlugs": [
      "pdf-redact",
      "pdf-protect",
      "pdf-unlock",
      "pdf-watermark",
      "pdf-editor"
    ]
  },
  "pdf-remove-blank-pages": {
    "longDescription": "<p>Remove Blank Pages is a cleanup tool that automatically finds and deletes empty pages from PDF documents. Blank pages commonly appear after scanning double-sided originals, exporting messy documents, or merging and splitting files—and removing them by hand is tedious when they're buried in a long document. This tool analyzes every page's ink coverage in your browser, flags pages that contain no visible content, and preselects them for removal so you can clean up the document in seconds.</p><p>You stay in control: blank pages are highlighted for review, and you can toggle any page on or off before exporting. The result is a compact PDF containing only pages with actual content—perfect for preparing documents for printing, archiving, or sharing.</p>",
    "features": [
      "Automatically detect blank pages by analyzing ink coverage",
      "Blank pages preselected for removal with a clear visual badge",
      "Fine-tune the selection by tapping any page before exporting",
      "Works on scans, exports, and just about any PDF source",
      "Preserves the layout and quality of remaining pages",
      "100% client-side detection with no uploads"
    ],
    "howTo": [
      {
        "step": "Upload PDF",
        "description": "Open the PDF you want to clean up. Every page is previewed as a thumbnail."
      },
      {
        "step": "Review Blank Detection",
        "description": "Pages with no meaningful content are marked blank and preselected for deletion."
      },
      {
        "step": "Adjust Selection",
        "description": "Tap any page to include or exclude it from the removal, and use Select all blank to reselect the detected pages."
      },
      {
        "step": "Download Clean PDF",
        "description": "Export the document with the selected blank pages removed."
      }
    ],
    "faq": [
      {
        "question": "How does the tool decide a page is blank?",
        "answer": "Each page is rendered and analyzed for ink coverage. Pages with almost no non-white pixels are classified as blank."
      },
      {
        "question": "Will pages with small content be deleted?",
        "answer": "Only pages with negligible ink are flagged. Pages containing real content stay safe and are never automatically removed—you must select pages to delete them."
      },
      {
        "question": "Do remaining pages keep their quality?",
        "answer": "Yes. Removal is lossless; the pages that remain keep their original content and formatting exactly as they were."
      },
      {
        "question": "Can I undo a mistaken selection?",
        "answer": "Yes. Tap a selected page again to keep it, or use Select all blank to restore the automatic detection."
      }
    ],
    "relatedSlugs": [
      "pdf-remove-pages",
      "pdf-merge",
      "pdf-split",
      "pdf-editor",
      "pdf-compressor"
    ]
  },
  "pdf-overlay": {
    "longDescription": "<p>PDF Overlay lets you stamp one PDF on top of another, compositing content from two documents into a single file. It's perfect for watermarking pages with a logo or confidentiality label, adding a letterhead or footer to every sheet, placing a signature page onto a contract, or affixing approved-stamp overlays to templates. You choose a base PDF and an overlay PDF, then control exactly how the overlay is placed: stretched to fill the page, or fitted and positioned at the center, corners, or edges—with adjustable opacity so the stamping blends naturally with the underlying document.</p><p>Overlay pages can be mapped to your base document in two ways: paired to matching page numbers, or repeated cyclically across every page. The result is a standard PDF that opens in any reader, produced entirely within your browser for complete privacy.</p>",
    "features": [
      "Stamp one PDF onto another page-by-page",
      "Eight placement modes: stretch, center, corners, and edges",
      "Adjustable opacity from 5% to 100%",
      "Pair overlay pages by number or repeat them across the document",
      "Compatible with watermarks, letterheads, signatures, and badges",
      "100% client-side composition with no uploads"
    ],
    "howTo": [
      {
        "step": "Choose Base PDF",
        "description": "Select the PDF that receives the overlay—the document your pages are drawn onto."
      },
      {
        "step": "Choose Overlay PDF",
        "description": "Select the PDF that gets stamped on top, such as a watermark or letterhead."
      },
      {
        "step": "Configure Placement",
        "description": "Pick a position, set the opacity, and choose whether overlay pages repeat or pair with base pages."
      },
      {
        "step": "Download Overlaid PDF",
        "description": "Export the composited document with the overlay applied to every page."
      }
    ],
    "faq": [
      {
        "question": "Can I use the overlay as a watermark?",
        "answer": "Yes. Set a low opacity and pick a position like Center or Top center to stamp a translucent logo or label over each page."
      },
      {
        "question": "What if the overlay has fewer pages than the base?",
        "answer": "Enable Repeat overlay pages to cycle the overlay across the base document, or leave it off to pair by page number."
      },
      {
        "question": "Is the output a standard PDF?",
        "answer": "Yes. The result is a normal PDF with the overlay drawn into each page's content, viewable and printable in any reader."
      },
      {
        "question": "Does overlay change the base content?",
        "answer": "No. The base pages keep all their content; the overlay is composited on top at the position and opacity you choose."
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
    "longDescription": "<p>Flatten PDF converts a vector PDF into a fully flattened document where every page becomes a single raster image. After flattening, text can no longer be selected, copied, or edited; form fields, layers, and interactive elements become part of the page's picture. This is extremely useful for locking a document's appearance before distribution: sharing a filled contract where recipients shouldn't alter or copy text, preparing files for printing services that want a single image per page, or removing hidden layers and metadata that could reveal edit history. Because the output is simply an image per page, it renders identically on every device and viewer.</p><p>The tool renders each page in your browser at a quality you choose — Draft, Normal, or High — and re-embeds the result at the original page size, so the flattened PDF keeps the same dimensions as the source. Choose the lowest quality that still looks sharp to keep your file size down.</p>",
    "features": [
      "Convert every page into a single image layer",
      "Text becomes non-selectable and non-editable",
      "Strip hidden layers, fields, and interactive content",
      "Three output qualities to balance size and sharpness",
      "Output keeps the original page size",
      "100% client-side rendering with no uploads"
    ],
    "howTo": [
      {
        "step": "Upload PDF",
        "description": "Open the PDF you want to flatten into static image pages."
      },
      {
        "step": "Choose Quality",
        "description": "Pick Draft, Normal, or High rendering: lower options produce smaller files."
      },
      {
        "step": "Flatten Document",
        "description": "Click flatten and the tool renders every page into a single image layer."
      },
      {
        "step": "Download Flattened PDF",
        "description": "Download the flattened PDF with the same page dimensions as the original."
      }
    ],
    "faq": [
      {
        "question": "What does flattening actually remove?",
        "answer": "Flattening rasterizes each page, so selectable text, form fields, comments, layers, and interactive elements become part of the static image."
      },
      {
        "question": "Will the output be larger than the original?",
        "answer": "It can be, since images are less efficient than vector text. Use Draft or Normal quality for smaller files or only flatten when the trade-off is worth it."
      },
      {
        "question": "Does flattening reduce quality?",
        "answer": "High quality renders pages at 2× their display size, keeping text sharp. Very small font sizes may look less crisp than the vector original."
      },
      {
        "question": "Can I still search the flattened document?",
        "answer": "No. Once text is part of an image it can't be searched or copied — that's the point of flattening for locked documents."
      }
    ],
    "relatedSlugs": [
      "pdf-to-image",
      "pdf-editor",
      "pdf-scale-pages",
      "pdf-compressor",
      "pdf-redact"
    ]
  },
  "pdf-remove-annotations": {
    "longDescription": "<p>Remove Annotations cleans the markup layer off a PDF while keeping the document content exactly as it is. PDFs often accumulate comments, highlights, underlines, stamps, sticky notes, and hyperlinks during review cycles — clutter that isn't appropriate for the final version shared with clients, printed, or archived. This tool removes every annotation from the document in one pass, producing a clean copy with the page content, layout, and quality untouched.</p><p>The tool reports how many annotations it found and on which pages before you remove them, so you know exactly what's being stripped. Because processing happens entirely in your browser, marked-up documents and the notes inside them never leave your device.</p>",
    "features": [
      "Remove comments, highlights, stamps, sticky notes, and links",
      "Per-page annotation counts shown before removal",
      "Page content and layout remain completely untouched",
      "Removes the form (AcroForm) entry for a fully clean file",
      "Works on annotated PDFs from any source",
      "100% client-side processing with no uploads"
    ],
    "howTo": [
      {
        "step": "Upload PDF",
        "description": "Open the annotated PDF you want to clean up."
      },
      {
        "step": "Review Annotation Count",
        "description": "The tool shows how many annotations exist and on which pages."
      },
      {
        "step": "Remove Annotations",
        "description": "Click the remove button to strip all annotations from the document."
      },
      {
        "step": "Download Clean PDF",
        "description": "Download the cleaned PDF with page content fully preserved."
      }
    ],
    "faq": [
      {
        "question": "Does removing annotations delete any page content?",
        "answer": "No. Only the annotation layer is removed. All text, images, and layout are preserved exactly as they were."
      },
      {
        "question": "Are links removed too?",
        "answer": "Yes. Links are implemented as annotations in PDF, so hyperlinks are removed along with comments and highlights."
      },
      {
        "question": "Will form fields be affected?",
        "answer": "The form structure is removed, so interactive fields become plain content. Filled-in visible values remain part of the page."
      },
      {
        "question": "Can I undo the removal?",
        "answer": "No undo is available after download. Keep the original file if you may need the annotations later."
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
    "longDescription": "<p>Scale Pages resizes every page of a PDF by a percentage, scaling both the page size and its content together in perfect proportion. Whether you're shrinking a poster for sharing, enlarging a document for print, producing consistent page sizes from mixed sources, or fitting content into a specific dimension range, this tool gives you a uniform vector resize. Set a scale from 25% to 300% and the tool applies it to every page simultaneously, then downloads the resized PDF.</p><p>Unlike cropping, scaling keeps the full content in view — it simply makes the whole page larger or smaller. Because pdf-lib scales the underlying vector content (and annotations) rather than re-rendering, text stays crisp at every size. Everything is processed locally in your browser, so your documents never leave your device.</p>",
    "features": [
      "Scale all pages together from 25% to 300%",
      "Page size and content scale in perfect proportion",
      "Vector content stays crisp at any scale",
      "Applies uniformly to every page in the document",
      "Live page-size preview before you export",
      "100% client-side processing with no uploads"
    ],
    "howTo": [
      {
        "step": "Upload PDF",
        "description": "Open the PDF you want to resize. The first page's current size is shown."
      },
      {
        "step": "Set Scale",
        "description": "Drag the slider to the desired percentage — the resulting page size updates live."
      },
      {
        "step": "Scale Document",
        "description": "Click scale and every page is resized by the chosen factor."
      },
      {
        "step": "Download Scaled PDF",
        "description": "Download the resized PDF with all pages scaled uniformly."
      }
    ],
    "faq": [
      {
        "question": "Is content scaled or cropped?",
        "answer": "Scaled. Every page is resized along with its content, so nothing is cut off and proportions are preserved."
      },
      {
        "question": "Will text stay sharp after scaling?",
        "answer": "Yes. The vector content itself is scaled rather than re-rendered, so text and lines remain crisp at any size."
      },
      {
        "question": "Does the tool support different X and Y scales?",
        "answer": "Currently scaling is uniform, keeping the aspect ratio intact so no distortion occurs. Use page resizing features for non-uniform layouts."
      },
      {
        "question": "Can I preview the result before exporting?",
        "answer": "Yes. The tool shows the first page's current dimensions and the exact resulting size for your chosen percentage."
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
    "longDescription": "<p>The BrainCoder Gzip Compress & Decompress tool lets you shrink text data using the gzip algorithm directly in your browser. Gzip is the most widely used compression format on the web — every HTTP server uses it to reduce payload sizes and speed up page loads. Now you can compress and decompress text, JSON, HTML, and other string data yourself without installing anything.</p>\n<p>Compression can dramatically reduce the size of repetitive or verbose text. A 10 KB JSON payload might compress to under 2 KB, saving bandwidth and storage. Our tool uses the browser's built-in Compression Streams API, which means the compression happens at near-native speed with no server round-trips. Decompress any gzip-encoded string or data URI you encounter in your work.</p>\n<p>This is particularly useful for developers debugging API responses, inspecting compressed assets, preparing payloads for bandwidth-constrained environments, or learning how compression works. Everything runs locally — your data is never uploaded anywhere.",
    "features": [
      "Gzip compress and decompress in the browser",
      "Uses the native Compression Streams API for speed",
      "Works with text, JSON, HTML, CSS, and JavaScript",
      "Shows compression ratio and original vs compressed size",
      "Copy compressed output as base64 or raw bytes",
      "No server calls — fully offline capable"
    ],
    "howTo": [
      {
        "step": "Paste or type text into the input area",
        "description": "Enter the text content you want to compress — this could be a JSON response, HTML snippet, or any other string data."
      },
      {
        "step": "Click Compress",
        "description": "The tool applies gzip compression to your input and displays the compressed output along with the compression ratio showing how much space was saved."
      },
      {
        "step": "Copy or export the result",
        "description": "Copy the compressed data as a raw byte string or as a Base64-encoded string depending on your use case."
      },
      {
        "step": "To decompress, paste gzip data and click Decompress",
        "description": "If you have a gzip-encoded string or Base64-encoded gzip data, paste it in and click 'Decompress' to restore the original text."
      }
    ],
    "faq": [
      {
        "question": "What is gzip compression?",
        "answer": "Gzip is a lossless data compression algorithm that uses a combination of LZ77 and Huffman coding. It's the standard compression method used in HTTP to reduce the size of web responses, typically achieving 60-80% size reduction for text data."
      },
      {
        "question": "Is gzip compression lossless?",
        "answer": "Yes. Gzip is lossless — the decompressed output is identical to the original input, byte for byte. No data is lost during compression, making it safe for all types of data."
      },
      {
        "question": "Can I decompress data from a server response?",
        "answer": "Yes. If you have a gzip-encoded response body (often indicated by the Content-Encoding: gzip header), you can paste it here to decompress and inspect the original content."
      }
    ],
    "relatedSlugs": [
      "base64",
      "checksum-calculator",
      "url-encoder"
    ]
  },
  "hash-generator": {
    "longDescription": "<p>The BrainCoder Hash Generator computes cryptographic hashes from any text input using popular algorithms including MD5, SHA-1, SHA-256, SHA-384, and SHA-512. Hashing is a one-way process that converts data into a fixed-size string that serves as a digital fingerprint — useful for verifying file integrity, storing passwords securely, and creating unique identifiers.</p>\n<p>Our hash generator runs entirely in your browser using the Web Crypto API, the same cryptographic engine used by modern browsers for HTTPS and authentication. This means your input is processed locally and the original data is never transmitted to any server. You can hash passwords (for non-security research purposes), compare file checksums, verify download integrity, or generate deterministic identifiers from arbitrary text.</p>\n<p>The tool supports all major hash algorithms and displays results in multiple formats. Whether you're a developer debugging an authentication flow, a security researcher comparing hashes, or a system administrator verifying a file download, this tool provides instant, accurate results without any external dependencies.",
    "features": [
      "Supports MD5, SHA-1, SHA-256, SHA-384, and SHA-512",
      "Powered by the browser's native Web Crypto API",
      "Displays hash output in hexadecimal format",
      "Compute multiple algorithms simultaneously",
      "One-click copy for each hash output",
      "Zero data transmission — everything stays on your device"
    ],
    "howTo": [
      {
        "step": "Enter text to hash",
        "description": "Type or paste the string you want to compute a hash for into the input field. This can be a password, a file name, a URL, or any text."
      },
      {
        "step": "Select hash algorithms",
        "description": "Choose one or more algorithms from the available options (MD5, SHA-1, SHA-256, SHA-384, SHA-512). You can select multiple to compare outputs."
      },
      {
        "step": "View the generated hashes",
        "description": "The tool instantly computes and displays the hash values in hexadecimal format for each selected algorithm."
      },
      {
        "step": "Copy and use the hash",
        "description": "Click the copy button next to any hash to place it on your clipboard for use in configuration files, databases, or verification scripts."
      }
    ],
    "faq": [
      {
        "question": "What hash algorithm should I use?",
        "answer": "For general integrity checking, SHA-256 is the recommended standard. MD5 and SHA-1 are faster but have known collision vulnerabilities and should not be used for security purposes. SHA-512 offers the highest security but produces longer output."
      },
      {
        "question": "Can two different inputs produce the same hash?",
        "answer": "In theory, yes — this is called a hash collision. However, for modern algorithms like SHA-256, the probability is astronomically low (practically zero). MD5 and SHA-1 have known collision attacks, making them unsuitable for security-critical applications."
      },
      {
        "question": "Is this tool suitable for password hashing?",
        "answer": "For research and testing purposes, yes. For production password storage, use a dedicated password hashing function like bcrypt, scrypt, or Argon2 which add salting and key stretching — features a simple hash generator doesn't provide."
      },
      {
        "question": "Why does the same input always produce the same hash?",
        "answer": "That's a fundamental property of hashing — it's deterministic. The same input will always produce the exact same output. This is what makes hashes useful for verifying data integrity."
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
    "longDescription": "<p>The BrainCoder Strong Password Generator creates cryptographically random passwords instantly. Configure the length, character types (uppercase, lowercase, digits, symbols), and exclusion rules to generate passwords that meet any requirement — from simple Wi-Fi passwords to complex enterprise credential policies.</p>\n<p>The generator uses the browser's Crypto.getRandomValues() API, which provides cryptographically secure randomness sourced from the operating system's entropy pool. This is vastly superior to Math.random()-based generators, which produce predictable sequences that attackers can exploit. Each password is unique, unpredictable, and statistically resistant to brute-force attacks.</p>\n<p>Your generated passwords are never stored, transmitted, or logged. They exist only on your screen and nowhere else. The tool also calculates password entropy and estimated crack time so you can make informed decisions about password strength. This is the safest way to generate passwords — entirely offline, zero trust required.",
    "features": [
      "Cryptographically secure random generation",
      "Configurable length from 4 to 128 characters",
      "Toggle uppercase, lowercase, digits, and symbols",
      "Exclude ambiguous characters (0, O, l, 1, I)",
      "Password entropy and strength indicator",
      "Generate multiple passwords at once"
    ],
    "howTo": [
      {
        "step": "Set password length",
        "description": "Use the slider or input to set your desired password length. Longer passwords are exponentially harder to crack — 16+ characters is recommended."
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
        "description": "Click 'Generate' to create a new random password. Review the entropy score and crack time estimate, then click 'Copy' to grab it."
      }
    ],
    "faq": [
      {
        "question": "How long should a password be?",
        "answer": "For most accounts, 16-20 characters with mixed character types is excellent. For critical systems (banking, admin), 24+ characters is recommended. Each additional character exponentially increases the time needed for a brute-force attack."
      },
      {
        "question": "Are generated passwords stored anywhere?",
        "answer": "No. Generated passwords exist only in your browser's memory and on your screen. They are never sent to any server, stored in cookies, or logged. Once you close the page, the password exists only where you saved it."
      },
      {
        "question": "Why not just use a memorable phrase?",
        "answer": "Memorable phrases work but are vulnerable to dictionary attacks. A truly random 16-character password with mixed types has billions of times more entropy than a 4-word phrase, making it far more resistant to computational cracking."
      },
      {
        "question": "What is password entropy?",
        "answer": "Entropy measures password strength in bits. A password with 80 bits of entropy would take roughly 10^24 years to brute-force. Each bit doubles the search space. Our tool displays entropy and estimated crack time for your generated passwords."
      }
    ],
    "relatedSlugs": [
      "hash-generator",
      "aes-encryption",
      "uuid-generator"
    ]
  },
  "uuid-generator": {
    "longDescription": "<p>The BrainCoder UUID Generator creates Universally Unique Identifiers (UUIDs) also known as GUIDs (Globally Unique Identifiers). UUIDs are 128-bit values that are practically guaranteed to be unique across all devices and all time — the probability of a collision is lower than being struck by lightning twice. This tool generates UUID v4 (random) identifiers with one click.</p>\n<p>UUID v4 is the most commonly used version for database primary keys, session identifiers, transaction IDs, API request tracking, and distributed systems where coordination between nodes is impractical. Each UUID is a 36-character string in the standard format: 8-4-4-4-12 (e.g., 550e8400-e29b-41d4-a716-446655440000).</p>\n<p>Our generator uses the browser's cryptographic random number generator to ensure each UUID is truly random and unpredictable. You can generate single UUIDs or batch-generate up to 100 at once. No UUIDs are stored or transmitted — they're created and displayed locally.",
    "features": [
      "UUID v4 generation using cryptographic randomness",
      "Generate single UUIDs or batch up to 100",
      "Standard 8-4-4-4-12 format output",
      "One-click copy for individual UUIDs",
      "Copy all generated UUIDs at once",
      "Zero server interaction — fully client-side"
    ],
    "howTo": [
      {
        "step": "Click Generate",
        "description": "Click the 'Generate' button to create a new UUID v4. A unique 36-character identifier will appear instantly."
      },
      {
        "step": "Generate batch if needed",
        "description": "If you need multiple UUIDs, set the quantity (1-100) and click 'Generate Batch' to create them all at once."
      },
      {
        "step": "Copy the UUID",
        "description": "Click the copy button next to any UUID to grab it for use as a database ID, session token, or unique identifier in your application."
      },
      {
        "step": "Clear and regenerate",
        "description": "Click 'Clear' to remove generated UUIDs and start fresh. Each generation produces completely new, unique identifiers."
      }
    ],
    "faq": [
      {
        "question": "What version of UUID does this generate?",
        "answer": "This tool generates UUID v4, which uses cryptographically random numbers for all 128 bits (with 6 bits reserved for version and variant). UUID v4 is the most widely used version for general-purpose unique identification."
      },
      {
        "question": "Can two UUIDs ever be the same?",
        "answer": "Theoretically yes, but the probability is approximately 1 in 2^122 (about 5.3 × 10^36). You would need to generate 2^61 UUIDs to have a 50% chance of a single collision — a number so large it's effectively impossible."
      },
      {
        "question": "What are UUIDs used for?",
        "answer": "UUIDs are used as primary keys in databases, session identifiers, transaction IDs, API request tracking, device identifiers, and anywhere you need a unique value without coordinating with a central authority."
      }
    ],
    "relatedSlugs": [
      "password-generator",
      "hash-generator",
      "random-number-generator"
    ]
  },
  "lorem-ipsum": {
    "longDescription": "<p>The BrainCoder Lorem Ipsum Generator produces classic placeholder text for design mockups, wireframes, and layout testing. Lorem Ipsum is the industry-standard dummy text used since the 1500s when an unknown printer scrambled a type specimen book to create a type specimen. It remains the go-to choice for filling layouts with realistic-looking text without distracting from the design.</p>\n<p>Our generator creates paragraphs, sentences, or words of Lorem Ipsum text with configurable quantity. Whether you're building a website mockup, testing a CMS layout, filling a design prototype, or demonstrating typography, this tool provides instantly generated placeholder content. You can choose between classic Lorem Ipsum, shuffled words for a more natural look, or pure random text.</p>\n<p>All generation happens in your browser — no text is stored or transmitted. The tool is free, requires no signup, and provides one-click copy for the generated content. It's the fastest way to fill any layout with realistic placeholder text.",
    "features": [
      "Generate by paragraphs, sentences, or words",
      "Classic Lorem Ipsum text based on Cicero's writings",
      "Option to shuffle words for more natural-looking text",
      "Configurable quantity from 1 to 50 units",
      "One-click copy for generated text",
      "No data stored or transmitted"
    ],
    "howTo": [
      {
        "step": "Choose generation unit",
        "description": "Select whether you want to generate text by paragraphs, sentences, or individual words depending on how much content you need."
      },
      {
        "step": "Set the quantity",
        "description": "Use the slider or input to specify how many paragraphs, sentences, or words you want to generate."
      },
      {
        "step": "Click Generate",
        "description": "The tool instantly produces the requested amount of Lorem Ipsum text. Toggle 'shuffle words' for a more randomized, natural-looking output."
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
        "answer": "Lorem Ipsum has varied word lengths, punctuation, and letter distributions that more closely resemble real English text. This makes it better for evaluating typography, line spacing, and layout aesthetics in designs."
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
    "longDescription": "<p>The BrainCoder QR Code Generator turns any text or URL into a scannable QR code directly in your browser — no account, no uploads, and no server round-trip. Choose foreground and background colors, set the download size from 100 to 1000 px, and pick an error correction level (L, M, Q, or H) to balance how much data fits against how well the code survives damage.</p>\n<p>Download the result as a PNG for screens and documents, or as an SVG vector that scales to any size without losing sharpness for print. Higher error correction keeps the code scannable even when it is partially obscured — handy for stickers, business cards, and packaging.</p>\n<p>Everything is generated locally using a client-side library, so encoding a Wi-Fi password or a private link never sends it anywhere. Free, no sign-up, no tracking.",
    "features": [
      "Generate QR codes instantly as you type",
      "Customizable foreground and background colors",
      "Error correction levels: L, M, Q, and H",
      "Download as PNG or infinitely scalable SVG",
      "Download size from 100px to 1000px",
      "Fully client-side — nothing leaves your device"
    ],
    "howTo": [
      {
        "step": "Enter your content",
        "description": "Type or paste any text, URL, email address, phone number, or Wi-Fi configuration string (WIFI:T:WPA;S:Name;P:Pass;;) into the input box. The QR code updates live as you type — there is no Generate button."
      },
      {
        "step": "Customize appearance",
        "description": "Pick foreground and background colors, choose an error correction level, and set the download size. The on-screen preview stays the same size; your choices carry into the downloaded file."
      },
      {
        "step": "Verify before you print",
        "description": "Scan the preview with your phone's camera to confirm it opens the right link or shows the right text, especially before printing in bulk."
      },
      {
        "step": "Download your QR code",
        "description": "Click 'Download PNG' for a raster image or 'Download SVG' for a vector file that scales to any resolution without quality loss."
      }
    ],
    "faq": [
      {
        "question": "What can I encode in a QR code?",
        "answer": "Any text at all: URLs, plain notes, email addresses, phone numbers, and standard formatted strings such as Wi-Fi credentials (WIFI:T:WPA;S:Name;P:Pass;;) or vCards. The tool encodes exactly what you type, so a QR for a Wi-Fi network must use that WIFI: format for phones to recognize it."
      },
      {
        "question": "How much data can a QR code hold?",
        "answer": "Up to 4,296 alphanumeric characters or 7,089 numeric digits at the lowest error correction level. URLs and short text are ideal. Very long text will produce dense QR codes that are harder to scan."
      },
      {
        "question": "What error correction level should I use?",
        "answer": "Level M (15% recovery) is the best balance for most use cases. Level H (30% recovery) is best for printed materials that might get damaged. Level L is for maximum data density when the QR code won't be physically handled."
      },
      {
        "question": "Can I make the QR code match my brand colors?",
        "answer": "Yes. You can customize both the foreground (dark) and background (light) colors. Just ensure sufficient contrast — the scanner needs to distinguish between light and dark modules. A contrast ratio of at least 4:1 is recommended, and the tool warns if you pick colors too close together."
      },
      {
        "question": "Why won't my QR code scan?",
        "answer": "Three things usually cause scan failures: low contrast between the foreground and background — aim for at least a 4:1 ratio and avoid near-identical colors; output size too small — download at 300 px or larger for reliable phone scanning; and very long text at a low error correction level, which produces a dense code — try raising the error correction to M or H, or shorten the text."
      },
      {
        "question": "Is my data private? Does anything leave my browser?",
        "answer": "Yes, your data is private. QR codes are generated entirely in your browser with a client-side library — no network requests are made and nothing is uploaded. This is especially important for codes containing Wi-Fi passwords or private URLs. Once the page has loaded, the tool even works offline."
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
    "longDescription": "<p>The BrainCoder Timestamp Converter converts between Unix timestamps (epoch seconds) and human-readable dates and times. Unix time counts the number of seconds since January 1, 1970 (the Unix epoch) and is the standard time format used in APIs, databases, logging systems, and distributed computing.</p>\n<p>This tool lets you convert a timestamp like 1694678400 into a readable date, or convert a date back into a Unix timestamp. It supports both seconds and milliseconds precision, handles timezone offsets, and displays the result in multiple formats including ISO 8601, RFC 2822, and locale-specific formats. You can also see the current live Unix timestamp updating in real time.</p>\n<p>Whether you're debugging an API response that returns epoch time, calculating time differences, converting database timestamps, or building a time-based feature, this tool provides instant, accurate conversions. Everything happens in your browser — no timestamps are sent to any server.",
    "features": [
      "Unix timestamp (seconds) to human-readable date",
      "Human-readable date to Unix timestamp",
      "Supports both seconds and milliseconds",
      "Timezone offset configuration",
      "ISO 8601, RFC 2822, and locale formats",
      "Live current timestamp display"
    ],
    "howTo": [
      {
        "step": "Choose conversion direction",
        "description": "Select 'Timestamp to Date' to convert an epoch value to a readable date, or 'Date to Timestamp' to convert a date to epoch seconds."
      },
      {
        "step": "Enter your value",
        "description": "For timestamp-to-date, paste a Unix timestamp (e.g., 1694678400). For date-to-timestamp, pick a date and time from the inputs."
      },
      {
        "step": "Configure timezone",
        "description": "Select your timezone offset or use UTC. The tool will adjust all displayed times accordingly."
      },
      {
        "step": "Copy the result",
        "description": "Copy the converted value in your preferred format — Unix timestamp, ISO 8601 string, or any other format shown."
      }
    ],
    "faq": [
      {
        "question": "What is a Unix timestamp?",
        "answer": "A Unix timestamp (also called Unix time or epoch time) is the number of seconds that have elapsed since January 1, 1970, 00:00:00 UTC. It's a simple, timezone-independent way to represent points in time."
      },
      {
        "question": "Why are some timestamps 13 digits instead of 10?",
        "answer": "10-digit timestamps represent seconds since the epoch. 13-digit timestamps represent milliseconds since the epoch. Millisecond timestamps are common in JavaScript (Date.now()) and some APIs. This tool handles both."
      },
      {
        "question": "Will the Year 2038 problem affect this tool?",
        "answer": "The Year 2038 problem affects 32-bit signed integer Unix timestamps, which overflow on January 19, 2038. Our tool uses 64-bit integers in JavaScript, so it handles dates well beyond 2038 without issues."
      }
    ],
    "relatedSlugs": [
      "url-encoder",
      "case-converter",
      "number-base"
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
    "longDescription": "<p>The Regex Tester is a powerful live正则表达式 testing environment that highlights matches in real time as you type your pattern and input string. It eliminates the guesswork from regular expressions by visually showing exactly which substrings match your regex, making it indispensable for validating email patterns, scraping rules, input sanitization logic, and log parsing workflows.</p><p>Supporting full JavaScript regex syntax including lookahead, lookbehind, named capture groups, and all standard flags (g, i, m, s, u, d), this tool displays match results, group captures, and index positions instantly. The live highlighting overlay on the input text gives you immediate visual feedback — no need to click a \"test\" button or wait for processing.</p><p>Every character of your input stays in your browser. There's no server processing, no account creation, and no waiting — just a fast, precise regex development environment for developers, data engineers, and security professionals.</p>",
    "features": [
      "Live match highlighting as you type the pattern",
      "Full JavaScript regex engine with all flags (g, i, m, s, u, d)",
      "Named and numbered capture group results with index positions",
      "Supports lookahead, lookbehind, and advanced pattern constructs",
      "Client-side only — regex patterns and test strings never leave your browser",
      "Quick-reference panel for common regex tokens and shortcuts"
    ],
    "howTo": [
      {
        "step": "Enter Your Regex Pattern",
        "description": "Type your regular expression into the pattern field. Slashes are added automatically."
      },
      {
        "step": "Set Flags",
        "description": "Toggle flags like global (g), case-insensitive (i), multiline (m), and dotAll (s) using the provided checkboxes."
      },
      {
        "step": "Provide Test Input",
        "description": "Paste or type your test string into the input area. Matches are highlighted live as you type."
      },
      {
        "step": "Review Match Details",
        "description": "Inspect the match results panel for full match text, capture groups, and character index positions."
      }
    ],
    "faq": [
      {
        "question": "Which regex flavor does this tool support?",
        "answer": "It uses the full JavaScript (ECMAScript) regex engine, including modern features like named groups, lookbehind assertions, and the dotAll flag."
      },
      {
        "question": "Can I use this to test patterns for other languages?",
        "answer": "JavaScript regex is very similar to PCRE and Python's re module. Most patterns transfer directly, though a few edge cases may differ."
      },
      {
        "question": "Is my regex or input data stored anywhere?",
        "answer": "No. All processing is client-side. Nothing is transmitted to or stored on any server."
      }
    ],
    "relatedSlugs": [
      "json-formatter",
      "url-parser",
      "html-formatter",
      "sql-formatter",
      "csv-formatter"
    ]
  },
  "markdown-preview": {
    "longDescription": "<p>The Markdown Preview Editor is a dual-pane writing environment that renders your Markdown in real time, giving you a live preview alongside the source as you type. It's the fastest way to compose README files, documentation, blog posts, and changelogs with confidence — seeing exactly how the final rendered output will look without switching between editors and browsers.</p><p>Supporting the full CommonMark specification plus GitHub Flavored Markdown (GFM) extensions — including tables, task lists, fenced code blocks with syntax highlighting, and automatic link detection — this editor handles everything from simple inline formatting to complex multi-column layouts. The synchronized scrolling between editor and preview keeps your cursor position in context at all times.</p><p>Your drafts are saved locally in your browser's storage, so you never lose work between sessions. No cloud accounts, no sync fees, and no risk of your proprietary documentation being uploaded anywhere. Just fast, distraction-free Markdown authoring.</p>",
    "features": [
      "Real-time split-pane Markdown preview with synchronized scrolling",
      "Full CommonMark and GitHub Flavored Markdown (GFM) support",
      "Fenced code blocks with syntax highlighting for popular languages",
      "Tables, task lists, footnotes, and automatic URL linking",
      "Local browser storage for draft persistence across sessions",
      "Export to HTML with a single click for sharing or embedding"
    ],
    "howTo": [
      {
        "step": "Write Markdown",
        "description": "Type your Markdown in the left editor pane using standard syntax — headings, lists, links, images, code blocks, and more."
      },
      {
        "step": "Preview Live",
        "description": "The right pane instantly renders your Markdown. Scroll in sync or independently to compare source and output."
      },
      {
        "step": "Use GFM Extensions",
        "description": "Take advantage of GitHub Flavored Markdown features like tables, task checkboxes, and fenced code blocks for richer content."
      },
      {
        "step": "Export or Copy",
        "description": "Click export to download the rendered HTML file, or copy the HTML source for embedding in your project."
      }
    ],
    "faq": [
      {
        "question": "Does it support GitHub Flavored Markdown?",
        "answer": "Yes. Full GFM support includes tables, task lists, autolinks, strikethrough, and fenced code blocks with language-annotated syntax highlighting."
      },
      {
        "question": "Are my drafts saved between sessions?",
        "answer": "Yes. The editor auto-saves your work to your browser's local storage. No cloud account is needed."
      },
      {
        "question": "Can I export the rendered output?",
        "answer": "Yes. You can export the fully rendered content as an HTML file or copy the HTML source to your clipboard."
      }
    ],
    "relatedSlugs": [
      "html-markdown",
      "html-formatter",
      "json-formatter",
      "toml-json",
      "html-minifier"
    ]
  },
  "html-minifier": {
    "longDescription": "<p>The HTML Minifier compresses your HTML files by stripping unnecessary whitespace, removing redundant attributes, shortening boolean attributes, and optimizing tag structures — reducing file sizes by 10–40% without altering the rendered output. It's the go-to tool for front-end developers preparing HTML for production deployment where every kilobyte impacts load time and Core Web Vitals scores.</p><p>Beyond simple whitespace removal, this minifier intelligently collapses optional tags, removes comments (with an option to preserve critical ones), shortens class and ID names when safe, and optimizes attribute ordering for minimal output size. The tool provides a clear before/after comparison showing exact byte savings and compression percentage so you can quantify the impact.</p><p>All processing happens in your browser with zero server uploads. Sensitive HTML containing embedded API keys, internal URLs, or proprietary markup never leaves your machine — a critical requirement for enterprise teams and security-conscious organizations.</p>",
    "features": [
      "Intelligent whitespace and comment removal with configurable options",
      "Boolean attribute shortening (e.g., disabled=\"disabled\" to disabled)",
      "Optional tag collapsing and redundant attribute stripping",
      "Real-time before/after size comparison with compression percentage",
      "Option to preserve critical comments and conditional comments",
      "Fully client-side — HTML never uploaded to any server"
    ],
    "howTo": [
      {
        "step": "Paste or Upload HTML",
        "description": "Input your HTML source code by pasting it into the editor or dragging a file onto the drop zone."
      },
      {
        "step": "Configure Options",
        "description": "Toggle settings like comment removal, whitespace collapsing, and boolean attribute shortening to match your project's needs."
      },
      {
        "step": "Minify",
        "description": "Click the minify button to produce the compressed output. The tool shows the original and minified sizes with savings."
      },
      {
        "step": "Copy or Download",
        "description": "Copy the minified HTML to your clipboard or download it as a .html file ready for production deployment."
      }
    ],
    "faq": [
      {
        "question": "Will minification break my HTML layout?",
        "answer": "No. The minifier only removes characters that are whitespace or comments in the HTML spec. The rendered output remains identical."
      },
      {
        "question": "Can I preserve certain HTML comments?",
        "answer": "Yes. You can configure the tool to preserve comments containing specific patterns or conditional comments used for legacy browser support."
      },
      {
        "question": "How much file size reduction can I expect?",
        "answer": "Typically 10–40% depending on how much whitespace and how many comments your source HTML contains. Well-indented, comment-heavy files see the largest reductions."
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
    "longDescription": "<p>The JWT Decoder instantly parses JSON Web Tokens (JWTs) into their three constituent parts — header, payload, and signature — displaying each in a readable, formatted view. It's an essential debugging tool for backend developers, API integrators, and security engineers who need to inspect token contents, verify claims, check expiration times, and understand token structure without installing CLI tools or writing code.</p><p>Paste any valid JWT and the decoder immediately shows the algorithm and key ID from the header, all standard and custom claims in the payload (including exp, iat, iss, sub, aud, and any custom data), and the raw signature. The tool automatically calculates human-readable timestamps for exp and nbf claims, so you can instantly see if a token is expired or not yet valid — critical for debugging authentication flows.</p><p>This is a decode-only tool: it reads and displays token contents but never attempts to verify the signature against a secret or public key. This means it's safe for inspecting third-party tokens, and your tokens are never sent anywhere. All decoding is pure client-side base64url parsing.</p>",
    "features": [
      "Instant three-part JWT parsing (header, payload, signature)",
      "Formatted JSON display with syntax highlighting for each section",
      "Automatic timestamp conversion for exp, nbf, iat, and custom date claims",
      "Support for both HS256/384/512 and RS256/384/512 algorithm families",
      "Copy individual sections (header, payload) to clipboard",
      "Zero server transmission — tokens never leave your browser"
    ],
    "howTo": [
      {
        "step": "Paste Your JWT",
        "description": "Copy a JWT from your browser's Authorization header, API response, or storage and paste it into the input field."
      },
      {
        "step": "View Decoded Sections",
        "description": "The header, payload, and signature are instantly decoded and displayed in formatted JSON with syntax highlighting."
      },
      {
        "step": "Inspect Claims",
        "description": "Review standard claims like exp, iat, iss, sub, and aud. Timestamps are automatically converted to human-readable dates."
      },
      {
        "step": "Copy Sections",
        "description": "Use the copy button on any section to grab the header or payload JSON for use in documentation or debugging."
      }
    ],
    "faq": [
      {
        "question": "Does this tool verify the JWT signature?",
        "answer": "No. This is a decode-only tool. It displays the signature but does not cryptographically verify it. This is by design for safe inspection of any token."
      },
      {
        "question": "What JWT formats are supported?",
        "answer": "All standard JWS compact serialization tokens (three base64url-encoded parts separated by dots) with both HMAC (HS256/384/512) and RSA/ECDSA (RS256/384/512) algorithm headers."
      },
      {
        "question": "Is my token data safe?",
        "answer": "Yes. Decoding is performed entirely in your browser using base64url decoding. No token data is ever transmitted to any server."
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
    "longDescription": "<p>The CSV ↔ JSON Converter is a bidirectional format translation tool that transforms tabular CSV data into structured JSON objects and vice versa, making it indispensable for developers integrating spreadsheet data with APIs, databases, and modern JavaScript applications. It bridges the gap between the spreadsheet world (where business users live) and the API world (where developers work).</p><p>When converting CSV to JSON, the tool uses the first row as object keys (or allows custom header specification), infers data types (numbers, booleans, strings), handles quoted fields with embedded commas and newlines, and supports both array-of-objects and column-oriented output formats. The reverse conversion takes JSON arrays of objects and produces clean CSV with proper quoting and delimiter selection.</p><p>For data engineers building ETL pipelines, frontend developers consuming spreadsheet exports, and teams migrating data between systems, this converter handles the full spectrum of CSV-to-JSON transformation challenges. All processing is client-side — your data, which may contain personal records, financial data, or proprietary information, never leaves your browser.</p><p>For teams working on data integration projects, building API ingestion layers, or simply need to convert spreadsheet data into a format their applications can consume, this tool provides instant, reliable conversion without requiring server-side processing or custom scripts.</p>",
    "features": [
      "Bidirectional: CSV → JSON and JSON → CSV conversion",
      "Auto-detection of headers, delimiters, and data types",
      "Support for quoted fields with embedded commas and newlines",
      "Output as array-of-objects or column-oriented format",
      "Configurable delimiter, quote character, and output formatting",
      "Fully client-side — no data transmitted to external servers"
    ],
    "howTo": [
      {
        "step": "Select Direction",
        "description": "Choose whether to convert CSV to JSON or JSON to CSV."
      },
      {
        "step": "Paste Source Data",
        "description": "Insert your CSV or JSON data into the input area."
      },
      {
        "step": "Configure Mapping",
        "description": "Set header row, delimiter, data type inference, and output format preferences."
      },
      {
        "step": "Convert and Copy",
        "description": "Click convert and copy the result to clipboard or download as a file for your application or database."
      }
    ],
    "faq": [
      {
        "question": "Does it handle CSV files with no header row?",
        "answer": "Yes. You can specify custom headers or the tool will auto-generate column names (col_0, col_1, etc.) when no header is detected."
      },
      {
        "question": "Can it handle large CSV files?",
        "answer": "The tool processes data in the browser, so very large files (100MB+) may be limited by available memory. For most common CSV files, performance is excellent."
      },
      {
        "question": "Is my data uploaded during conversion?",
        "answer": "No. All conversion happens entirely in your browser. No data is ever transmitted to any server."
      }
    ],
    "relatedSlugs": [
      "csv-formatter",
      "csv-to-sql",
      "json-formatter",
      "json-viewer",
      "json-to-typescript"
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
    "longDescription": "<p>BrainCoder's free online notepad is a lightweight, browser-based text editor designed for quick note-taking without the hassle of installing software or creating accounts. Whether you're jotting down meeting notes, drafting an email, or writing a to-do list, this notepad is always ready when you need it. Everything stays right in your browser — your notes are never uploaded to any server, giving you complete privacy and peace of mind.</p>\n<p>Unlike traditional notepad applications that require downloads or subscriptions, BrainCoder's notepad works instantly on any device with a web browser. It supports essential editing features like undo/redo, word wrap, and a clean distraction-free interface. You can copy your notes to the clipboard with a single click or download them as a plain text file for offline access.</p>\n<p>This online notepad is ideal for developers who need a quick place to paste code snippets, writers looking for a minimalist writing space, or anyone who wants a reliable digital scratchpad. It loads fast, works offline once opened, and respects your privacy by keeping all data local to your device. No registration, no tracking, no nonsense — just a clean notepad that works.</p>",
    "features": [
      "Zero-install browser-based notepad — no downloads or sign-ups required",
      "All data stays local in your browser for complete privacy",
      "Undo and redo support for effortless editing",
      "One-click copy to clipboard and download as .txt file",
      "Word wrap toggle for comfortable reading and writing",
      "Fast-loading minimalist interface with no distractions"
    ],
    "howTo": [
      {
        "step": "Open the Notepad",
        "description": "Navigate to the free online notepad tool on BrainCoder. The editor loads instantly with a blank canvas ready for your text."
      },
      {
        "step": "Start Writing",
        "description": "Click inside the text area and begin typing your notes, code snippets, or any text. Use the toolbar buttons to toggle word wrap or clear the notepad."
      },
      {
        "step": "Copy or Download",
        "description": "When you're done, click 'Copy' to send everything to your clipboard, or click 'Download' to save your notes as a plain text file on your device."
      }
    ],
    "faq": [
      {
        "question": "Are my notes stored on a server?",
        "answer": "No. Everything you type stays in your browser's local storage. No data is ever sent to BrainCoder's servers, so your notes remain completely private."
      },
      {
        "question": "Can I use this notepad offline?",
        "answer": "Yes. Once the page is loaded in your browser, the notepad works entirely offline. Your notes persist in your browser until you clear them or download them."
      },
      {
        "question": "Is there a character limit?",
        "answer": "The notepad can handle very large amounts of text. However, extremely large documents may affect browser performance depending on your device's memory."
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
    "longDescription": "<p>BrainCoder's text diff checker is a powerful online tool that compares two pieces of text side by side and highlights every difference between them. Whether you're reviewing code changes, proofreading a document, or verifying that a translation is accurate, this diff tool makes it effortless to spot additions, deletions, and modifications at a glance. It's an essential utility for developers, writers, and anyone who works with text on a regular basis.</p>\n<p>The diff checker processes everything locally in your browser, so sensitive documents, confidential code, and proprietary content never leave your device. There's no need to upload files to a third-party server — just paste your original and modified text, and the tool instantly shows you a color-coded comparison. It works with plain text, code snippets, configuration files, and more.</p>\n<p>With its clean side-by-side layout and inline highlighting, BrainCoder's diff tool helps you understand exactly what changed between two versions of any text. Whether you're merging pull requests, tracking document revisions, or simply comparing two versions of a paragraph, this tool delivers fast, accurate, and private text comparison right in your browser.</p>",
    "features": [
      "Side-by-side text comparison with color-coded differences",
      "Highlights additions, deletions, and modifications clearly",
      "Works with plain text, code, configs, and any text format",
      "Fully client-side — no data ever leaves your browser",
      "Line-by-line and word-level diff detection",
      "Copy diff results for sharing or documentation"
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
        "description": "Click the 'Compare' button. The tool highlights differences in green (additions), red (deletions), and yellow (modifications) so you can instantly see what changed."
      },
      {
        "step": "Copy or Export Results",
        "description": "Review the diff output and copy the results to your clipboard for documentation, code review notes, or sharing with your team."
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
        "answer": "The tool can handle moderately large texts. For very large files (hundreds of thousands of lines), performance may vary depending on your browser and device capabilities."
      }
    ],
    "relatedSlugs": [
      "notepad",
      "word-counter",
      "text-cleaner",
      "md-to-html",
      "html-to-pdf"
    ]
  },
  "word-counter": {
    "longDescription": "<p>BrainCoder's word and character counter is a fast, accurate online tool that instantly tallies the number of words, characters, sentences, and paragraphs in any text. Whether you're meeting a word count requirement for an essay, optimizing content for SEO, or checking the length of a social media post, this counter gives you precise statistics in real time. Just paste your text and watch the numbers update as you type.</p>\n<p>This tool is invaluable for writers, students, marketers, and content creators who need to track text length without the overhead of a full word processor. It counts words, characters (with and without spaces), sentences, and paragraphs — giving you a comprehensive overview of your text's structure. It's also useful for developers checking string lengths or validating input fields.</p>\n<p>Like all BrainCoder tools, the word counter runs entirely in your browser. Your text is never uploaded or stored anywhere, so you can safely use it for confidential documents, personal writing, or proprietary content. It's free, instant, and requires no registration — just paste and count.</p>",
    "features": [
      "Real-time word, character, sentence, and paragraph counting",
      "Characters counted with and without spaces",
      "Instant updates as you type or paste text",
      "100% private — all counting happens in your browser",
      "Works with any language and text format",
      "Simple one-field interface for quick results"
    ],
    "howTo": [
      {
        "step": "Open the Counter",
        "description": "Navigate to the word and character counter tool on BrainCoder. You'll see a large text input area ready for your content."
      },
      {
        "step": "Paste or Type Your Text",
        "description": "Paste your text into the input field or start typing directly. The counters update in real time as content is added or removed."
      },
      {
        "step": "Review Statistics",
        "description": "Check the displayed counts for words, characters (with and without spaces), sentences, and paragraphs. Use these stats for SEO optimization, assignment requirements, or content planning."
      }
    ],
    "faq": [
      {
        "question": "Does it count words correctly in other languages?",
        "answer": "Yes. The word counter handles multi-byte characters and works with most languages, including Chinese, Japanese, Korean, Arabic, and other non-Latin scripts."
      },
      {
        "question": "Is my text stored anywhere?",
        "answer": "No. All counting is performed locally in your browser. Your text is never transmitted to any server or stored beyond the current page session."
      },
      {
        "question": "Can I count characters without spaces?",
        "answer": "Yes. The tool provides both character counts — with spaces and without spaces — so you can use whichever metric fits your needs."
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
      "md-to-html"
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
    "longDescription": "<p>BrainCoder's photo editor is a browser-based image editing tool that lets you crop, rotate, flip, adjust brightness and contrast, and apply filters to your photos — all without uploading anything to a server. It's the perfect quick-edit tool for when you don't want to fire up a full desktop application or subscribe to an expensive design platform. Open it in your browser, make your edits, and download the result.</p>\n<p>The editor supports essential photo editing operations: crop to focus on the subject, rotate and flip for proper orientation, adjust brightness, contrast, and saturation for visual polish, and apply popular filters like grayscale, sepia, and blur. These are the most commonly needed edits for social media posts, profile pictures, document illustrations, and everyday photo adjustments.</p>\n<p>All editing happens locally in your browser, ensuring your personal photos and proprietary images never leave your device. There's no account required, no watermarks added, and no usage limits. BrainCoder's photo editor gives you the essential editing tools you need with the privacy and convenience you deserve.</p>",
    "features": [
      "Crop images to any aspect ratio or custom dimensions",
      "Rotate 90° increments and flip horizontally or vertically",
      "Adjust brightness, contrast, and saturation with sliders",
      "Apply filters: grayscale, sepia, blur, sharpen, and more",
      "Preview edits in real time before downloading",
      "No uploads, no accounts, no watermarks — fully private"
    ],
    "howTo": [
      {
        "step": "Upload Your Photo",
        "description": "Drag and drop your image or click the upload button. The photo loads in the editor canvas with editing tools available in the toolbar."
      },
      {
        "step": "Make Your Edits",
        "description": "Use the toolbar to crop, rotate, flip, or adjust visual properties. Apply filters from the filter menu. All changes preview in real time on the canvas."
      },
      {
        "step": "Download the Result",
        "description": "When you're happy with the edits, click 'Download' to save the edited image. Choose your preferred format (JPG or PNG) and the file saves directly to your device."
      }
    ],
    "faq": [
      {
        "question": "Is this a replacement for Photoshop?",
        "answer": "No — it's designed for quick, essential edits. For complex design work, layer editing, or advanced retouching, a full-featured editor like Photoshop is recommended. This tool covers the most common everyday needs."
      },
      {
        "question": "Does it add watermarks to edited images?",
        "answer": "No. Your edited images are downloaded clean with no watermarks, branding, or metadata added by the tool."
      },
      {
        "question": "Can I undo edits?",
        "answer": "Yes. The editor supports undo and redo, so you can step back through your changes at any point during the editing session."
      }
    ],
    "relatedSlugs": [
      "image-compressor",
      "image-resizer",
      "image-filters",
      "image-format-converter",
      "image-ocr"
    ]
  },
  "image-ocr": {
    "longDescription": "<p>BrainCoder's image OCR tool extracts text from images using optical character recognition — right in your browser. Upload a photo of a document, screenshot, receipt, or any image containing text, and the tool will identify and extract all readable text for you to copy and use. It's perfect for digitizing printed documents, extracting text from screenshots, grabbing text from photos of whiteboards, and converting image-based content into editable text.</p>\n<p>The OCR processing happens entirely on your device, so sensitive documents like contracts, medical records, financial statements, and identification cards never leave your browser. This makes BrainCoder's OCR tool a privacy-first alternative to online OCR services that require uploading your documents to external servers.</p>\n<p>Supporting multiple languages and common fonts, this tool delivers reliable text extraction for most standard documents and images. Whether you're a student digitizing lecture notes, a professional extracting data from scanned forms, or anyone who needs text from an image, this tool provides fast, private, and accurate OCR processing.</p>",
    "features": [
      "Extract text from photos, screenshots, and scanned documents",
      "Supports multiple languages and common font families",
      "Works with JPG, PNG, WebP, and BMP image formats",
      "Copy extracted text to clipboard with one click",
      "Entirely client-side — documents never leave your device",
      "No account required, no upload limits"
    ],
    "howTo": [
      {
        "step": "Upload an Image",
        "description": "Click the upload button or drag and drop an image containing text. Supported formats include JPG, PNG, WebP, and BMP."
      },
      {
        "step": "Start Text Extraction",
        "description": "The tool processes the image and extracts all recognizable text. This may take a few seconds depending on the image size and complexity."
      },
      {
        "step": "Copy the Extracted Text",
        "description": "Review the extracted text in the output area. Click 'Copy' to send it to your clipboard, or download it as a text file."
      }
    ],
    "faq": [
      {
        "question": "How accurate is the OCR?",
        "answer": "Accuracy depends on image quality, text clarity, font type, and language. Clear, high-resolution images with standard fonts produce the best results. Handwriting and unusual fonts may be less accurate."
      },
      {
        "question": "Does it support languages other than English?",
        "answer": "Yes. The OCR engine supports multiple languages including Spanish, French, German, Chinese, Japanese, and many others."
      },
      {
        "question": "Is my document uploaded to a server?",
        "answer": "No. All OCR processing happens locally in your browser. Your images and extracted text never leave your device."
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
    "longDescription": "<p>BrainCoder's Markdown to HTML converter instantly transforms Markdown text into clean, ready-to-use HTML code. Whether you're building a blog post, documentation page, email template, or any web content, this tool generates proper HTML with correct semantic tags, lists, links, images, and code blocks. Just paste your Markdown on the left and see the HTML output on the right — live and in real time.</p>\n<p>The converter supports the full Markdown syntax including headings, bold and italic text, ordered and unordered lists, blockquotes, code blocks with syntax hints, links, images, tables, and horizontal rules. It outputs clean, standards-compliant HTML that you can embed directly into web pages, content management systems, or email builders.</p>\n<p>All conversion happens in your browser, so your content stays private. There's no need to send your blog drafts, documentation, or proprietary content to external services. BrainCoder's converter is fast, accurate, and produces well-formatted HTML every time — making it an essential tool for developers, writers, and content creators.</p>",
    "features": [
      "Real-time Markdown to HTML conversion as you type",
      "Supports headings, lists, links, images, code blocks, and tables",
      "Outputs clean, standards-compliant HTML",
      "Copy HTML to clipboard or download as .html file",
      "Live preview of rendered Markdown alongside HTML output",
      "Fully client-side with no content uploaded"
    ],
    "howTo": [
      {
        "step": "Write or Paste Markdown",
        "description": "Enter your Markdown text in the left panel. You can type it directly or paste it from your editor, documentation, or notes."
      },
      {
        "step": "View Generated HTML",
        "description": "The HTML output updates in real time in the right panel. A rendered preview may also be available to show how the final content will look."
      },
      {
        "step": "Copy or Download HTML",
        "description": "Click 'Copy HTML' to grab the code for pasting into your project, or download it as an .html file for later use."
      }
    ],
    "faq": [
      {
        "question": "Does it support GitHub Flavored Markdown?",
        "answer": "Yes. The converter handles GFM extensions including fenced code blocks, tables, task lists, and strikethrough text in addition to standard Markdown syntax."
      },
      {
        "question": "Can I use the HTML in email templates?",
        "answer": "Yes. The generated HTML can be embedded in email templates. However, note that email clients have varying HTML support, so you may need to inline styles for best compatibility."
      },
      {
        "question": "Is my content uploaded?",
        "answer": "No. All conversion happens entirely in your browser using JavaScript. Your Markdown and the generated HTML never leave your device."
      }
    ],
    "relatedSlugs": [
      "html-to-pdf",
      "html-to-image",
      "notepad",
      "text-to-pdf",
      "word-to-pdf"
    ]
  },
  "html-to-pdf": {
    "longDescription": "<p>BrainCoder's HTML to PDF converter transforms any HTML content into a downloadable PDF document — entirely in your browser. Whether you have a web page you want to save as PDF, an HTML email you need to archive, or generated HTML reports you want to distribute, this tool produces clean, well-formatted PDFs without sending your content to any server.</p>\n<p>The converter preserves the layout, styling, images, and formatting of your HTML content, producing professional-quality PDFs suitable for printing, sharing, or archiving. Simply paste your HTML code, preview the result, and click download to get your PDF. It handles complex layouts including tables, images, custom CSS, and multi-page content.</p>\n<p>This tool is invaluable for web developers generating reports, content creators archiving web content, businesses converting HTML invoices or receipts to PDF, and anyone who needs a quick HTML-to-PDF conversion without installing desktop software. All processing happens client-side for complete privacy.</p>",
    "features": [
      "Convert any HTML code to a downloadable PDF file",
      "Preserves CSS styling, images, tables, and layouts",
      "Supports inline CSS and linked styles for accurate rendering",
      "Handles multi-page content with proper page breaks",
      "Preview HTML before converting to PDF",
      "100% client-side — HTML content never leaves your browser"
    ],
    "howTo": [
      {
        "step": "Paste Your HTML",
        "description": "Enter your HTML code in the input area. This can be a full HTML document or a fragment with inline styles."
      },
      {
        "step": "Preview the Output",
        "description": "The tool renders your HTML so you can preview exactly how the PDF will look. Adjust your HTML if needed."
      },
      {
        "step": "Download the PDF",
        "description": "Click the 'Convert to PDF' button. The tool generates the PDF and triggers a download to your device."
      }
    ],
    "faq": [
      {
        "question": "Does it support CSS styling in the HTML?",
        "answer": "Yes. The converter renders CSS including inline styles, embedded styles, and some external styles. For best results, use inline or embedded CSS."
      },
      {
        "question": "Can it handle multi-page HTML content?",
        "answer": "Yes. The tool automatically handles page breaks for content that exceeds a single page, producing a properly paginated PDF."
      },
      {
        "question": "Is my HTML content uploaded to a server?",
        "answer": "No. The entire conversion process runs in your browser. Your HTML content and the resulting PDF never leave your device."
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
    "longDescription": "<p>BrainCoder's HTML to image tool captures screenshots of HTML pages or elements, converting them into downloadable PNG or JPG images. Whether you need to capture a styled component, a full web page layout, a dashboard mockup, or an email template preview, this tool renders your HTML and captures it as a high-quality image — all within your browser.</p>\n<p>This is incredibly useful for designers sharing mockups with clients, developers documenting UI components, QA teams capturing bug reproductions, and content creators generating visual assets from HTML templates. The tool renders your HTML with full CSS support including fonts, colors, gradients, shadows, and responsive layouts, then captures the result as a crisp image.</p>\n<p>No server uploads are involved — the HTML rendering and image capture both happen locally in your browser. This means proprietary designs, confidential dashboards, and sensitive content stay on your device. It's a fast, private alternative to browser developer tools or third-party screenshot services.</p>",
    "features": [
      "Capture HTML/CSS as PNG or JPG images",
      "Full CSS support including gradients, shadows, and custom fonts",
      "Adjustable output resolution for crisp, high-quality captures",
      "Capture specific elements or full-page layouts",
      "Preview the rendered HTML before downloading",
      "Entirely client-side — no content leaves your browser"
    ],
    "howTo": [
      {
        "step": "Enter HTML Code",
        "description": "Paste your HTML code (optionally with embedded CSS) into the input area. You can include a full document or just a component fragment."
      },
      {
        "step": "Preview and Adjust",
        "description": "The tool renders your HTML in a preview pane. Adjust the code as needed to get the exact layout you want to capture."
      },
      {
        "step": "Capture and Download",
        "description": "Click the capture button, choose your preferred format (PNG or JPG), and download the image to your device."
      }
    ],
    "faq": [
      {
        "question": "Does it support custom fonts and CSS?",
        "answer": "Yes. The tool renders embedded CSS and commonly available system fonts. For custom web fonts, include them via @import or inline font declarations in your HTML."
      },
      {
        "question": "What image formats are supported?",
        "answer": "The tool supports PNG (lossless, best for screenshots) and JPG (compressed, best for photos). Choose the format that fits your use case."
      },
      {
        "question": "Is my HTML content uploaded?",
        "answer": "No. Both the HTML rendering and image capture happen entirely in your browser. Nothing is sent to any external server."
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
    "longDescription": "<p>Color Converter is a fast, browser-based tool that converts colors between HEX, RGB, and HSL formats with a live color preview. Whether you are porting a design from a hex code, tweaking hue and saturation for a gradient, or matching brand colors across different stylesheets, this tool translates values instantly and accurately. Everything runs locally in your browser, so no code ever leaves your device.</p><p>The converter supports all common CSS color notations, including 3- and 6-digit hex, rgba, and hsl, with clamping for values outside valid ranges. A live swatch updates as you type, and one click copies the converted value in your preferred format. Perfect for developers, designers, and anyone working with CSS, canvas, or SVG colors.</p>",
    "features": [
      "Convert between HEX, RGB, and HSL with instant results",
      "Live color preview swatch as you type",
      "Supports 3- and 6-digit hex, rgba, and hsla notations",
      "Automatic clamping of out-of-range values",
      "One-click copy in your preferred color format",
      "100% client-side processing with no uploads"
    ],
    "howTo": [
      {
        "step": "Enter a Color",
        "description": "Type or paste a color in HEX, RGB, or HSL format into the input field."
      },
      {
        "step": "Preview Live",
        "description": "Watch the real-time swatch update as you modify the color value."
      },
      {
        "step": "Choose Output Format",
        "description": "Select the target format you want to convert to."
      },
      {
        "step": "Copy the Result",
        "description": "Click copy to place the converted value on your clipboard."
      }
    ],
    "faq": [
      {
        "question": "Which color formats are supported?",
        "answer": "The tool converts between HEX (3- and 6-digit), RGB/RGBA, and HSL/HSLA. CSS color names are not currently supported."
      },
      {
        "question": "Is the conversion accurate?",
        "answer": "Yes. Conversions use exact color-space math with standard CSS rounding, and out-of-range values are clamped so output stays valid CSS."
      },
      {
        "question": "Do I need an account or upload?",
        "answer": "No. Conversion happens entirely in your browser. There is no upload, no account, and no data sent to any server."
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
    "longDescription": "<p>CSS Cursor Generator lets you preview every CSS cursor value on an interactive target and copy the exact CSS snippet you need. Hover behavior matters — a well-chosen cursor tells users whether something is clickable, draggable, resizable, or busy. This tool shows each keyword cursor live so you can pick the right one for your UI in seconds.</p><p>Beyond the standard keywords, the generator supports custom cursor URLs so you can test your own icon cursors before shipping them. The generated snippet is clean, copy-ready, and works in any stylesheet. Because everything runs in your browser, no files or data are ever uploaded.</p>",
    "features": [
      "Live preview of every CSS cursor keyword",
      "Interactive hover/press target to test behavior",
      "Custom cursor URL support with fallback keyword",
      "One-click copy-ready CSS snippet",
      "Covers default, pointer, grab, resize, progress, and more",
      "100% client-side, no uploads or account required"
    ],
    "howTo": [
      {
        "step": "Select a Cursor",
        "description": "Click any cursor keyword in the list to preview it on the interactive target."
      },
      {
        "step": "Test Behavior",
        "description": "Hover, click, and drag the target to see the cursor in action."
      },
      {
        "step": "Add a Custom URL",
        "description": "Optionally paste a cursor image URL and set a fallback keyword."
      },
      {
        "step": "Copy the CSS",
        "description": "Click copy to grab the generated cursor CSS snippet."
      }
    ],
    "faq": [
      {
        "question": "What cursor keywords are supported?",
        "answer": "All standard CSS keywords are covered: pointer, move, grab, grabbing, text, wait, progress, help, plus all resize, crosshair, cell, copy, zoom, not-allowed, and more."
      },
      {
        "question": "Can I use a custom cursor image?",
        "answer": "Yes. Paste a cursor image URL (PNG/CUR) and choose a fallback keyword. The tool generates a valid multi-value cursor CSS declaration."
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
