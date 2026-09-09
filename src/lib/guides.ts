export interface GuideSection {
  heading: string;
  paragraphs: string[];
}

export interface Guide {
  slug: string;
  title: string;
  description: string;
  keywords: string[];
  toolSlug: string;
  published: string;
  updated: string;
  readMinutes: number;
  sections: GuideSection[];
}

export const GUIDES: Guide[] = [
  {
    slug: "how-to-compress-pdf-online",
    title: "How to Compress a PDF Online for Free (No Sign-Up)",
    description:
      "Reduce your PDF file size in seconds — entirely in your browser, no uploads, no sign-up. Free, fast and private.",
    keywords: [
      "compress pdf online",
      "reduce pdf file size",
      "shrink pdf",
      "pdf compressor free",
      "make pdf smaller",
    ],
    toolSlug: "pdf-compressor",
    published: "2026-09-09",
    updated: "2026-09-09",
    readMinutes: 3,
    sections: [
      {
        heading: "Why PDFs get so large",
        paragraphs: [
          "PDFs balloon in size when they embed high-resolution images, multiple font subsets, or uncompressed metadata. A single scan at 600 DPI can easily top 50 MB, even though the printed page is only a few hundred KB of real content.",
          "Email providers and upload forms typically cap attachments at 20–25 MB, which is why 'compress pdf online' is one of the most common developer and office searches there is.",
        ],
      },
      {
        heading: "The quickest way to compress a PDF",
        paragraphs: [
          "The fastest method never uploads your file anywhere. Open the PDF Compressor, drop your file in, and the compression runs locally in your browser using WebAssembly.",
          "This is a two-step process: the tool re-encodes the document using efficient object streams and strips redundant image data, then hands the smaller file straight back to you as a download — usually in a few seconds.",
          "Compression is lossless where possible; the tool only discards data that was never displayed in the first place.",
        ],
      },
      {
        heading: "When to use a server-side compressor instead",
        paragraphs: [
          "Heavy-duty PDFs — hundreds of pages or extremely high-DPI scans — can occasionally compress faster on a server, since you can throw more CPU at them.",
          "But that convenience comes with a privacy trade-off: the file leaves your device. For documents containing personal or business data, the in-browser option is almost always the right call since nothing is ever transmitted.",
        ],
      },
      {
        heading: "Tips to keep PDFs small in the first place",
        paragraphs: [
          "Save scans as 300 DPI rather than 600 DPI. Compress images to JPEG/WebP before embedding them. Remove unused fonts and metadata in your editor.",
          "A well-prepared source file often makes later compression unnecessary — but when you do need it, the PDF Compressor handles it in one step.",
        ],
      },
    ],
  },
  {
    slug: "how-to-merge-pdf-files-online",
    title: "How to Merge PDF Files into One Document Online",
    description:
      "Combine multiple PDFs into a single file for free — reorder pages, then download. Runs 100% in your browser.",
    keywords: [
      "merge pdf online",
      "combine pdf files",
      "merge pdf free",
      "join pdf documents",
      "combine pdf pages",
    ],
    toolSlug: "pdf-merge",
    published: "2026-09-09",
    updated: "2026-09-09",
    readMinutes: 3,
    sections: [
      {
        heading: "Why you need to merge PDFs",
        paragraphs: [
          "Almost every workflow ends up with a handful of separate PDFs that should be one: a contract and its signature page, several invoice files for an expense report, or multiple scanned pages that came out as individual files.",
          "Sending many attachments instead of one combines awkwardly and looks unprofessional. Merging them into a single PDF is the clean fix.",
        ],
      },
      {
        heading: "Merging PDFs without uploading",
        paragraphs: [
          "The PDF Merger combines files locally in your browser using pdf-lib, a battle-tested JavaScript library. After you drop your files in, reorder them by drag-and-drop, and hit merge, the combined document is assembled on your device and offered as a download.",
          "Because nothing is uploaded, it works in a couple of seconds even for large sets — and it's completely safe for confidential documents.",
        ],
      },
      {
        heading: "Ordering matters",
        paragraphs: [
          "Before merging, double-check page order. Merging concatenates documents end-to-end, so the sequence you add files in is the sequence that appears in the result.",
          "Some tools only support simple concatenation. The PDF Merger lets you drag each file into the exact position you need before combining.",
        ],
      },
    ],
  },
  {
    slug: "how-to-split-pdf-online",
    title: "How to Split a PDF File into Separate Pages Online",
    description:
      "Extract single pages or ranges from a PDF for free, right in your browser. Preview thumbnails, pick pages, download.",
    keywords: [
      "split pdf online",
      "separate pdf pages",
      "extract pages from pdf",
      "split pdf by page",
      "pdf page extractor",
    ],
    toolSlug: "pdf-split",
    published: "2026-09-09",
    updated: "2026-09-09",
    readMinutes: 3,
    sections: [
      {
        heading: "When splitting a PDF helps",
        paragraphs: [
          "You often need just one page from a long document — a single signature page, a receipt in a 40-page report, or the cover sheet of a submission. Splitting gives you a precise, smaller file to send or archive.",
          "Splitting is also the tool of choice for breaking one large document into its logical chapters or turns.",
        ],
      },
      {
        heading: "Choosing pages to extract",
        paragraphs: [
          "The PDF Splitter renders thumbnails of every page so you can see exactly what you're extracting before you commit. Select individual pages by clicking, or use a range to pull a contiguous block.",
          "Each selection becomes its own download — or you can keep the original page order to piece reports back together later.",
        ],
      },
      {
        heading: "Privacy-safe page extraction",
        paragraphs: [
          "Like every tool here, page extraction happens entirely in your browser. The file is never uploaded, so sensitive pages never leave your machine.",
          "That makes the PDF Splitter a dependable choice for extracting pages from personal documents without leaking them to a remote server.",
        ],
      },
    ],
  },
{
        slug: "how-to-annotate-a-pdf-online",
        title: "How to Edit and Annotate a PDF Online for Free",
        description:
          "Add text, draw, highlight and box a PDF right in your browser — then download it. No upload, no sign-up, entirely private.",
        keywords: [
          "edit pdf online",
          "annotate pdf free",
          "add text to pdf",
          "highlight pdf pages",
          "draw on pdf",
          "pdf editor online",
        ],
        toolSlug: "pdf-editor",
        published: "2026-09-09",
        updated: "2026-09-09",
        readMinutes: 4,
        sections: [
          {
            heading: "What 'editing' a PDF actually means",
            paragraphs: [
              "PDFs are a fixed-layout format: pages are rendered, then locked. You can't easily change the words a PDF contains the way you would a Word document. What you can do is mark it up — add text, draw, highlight, and box important areas — and save that as a new file.",
              "That covers the vast majority of real use: signing approvals, annotating feedback on a design, marking up a scan of a contract, or highlighting key passages to send to a colleague.",
            ],
          },
          {
            heading: "Annotating without uploading your file",
            paragraphs: [
              "The PDF Editor runs entirely in your browser. It renders your document with the pdf.js engine and stores every annotation you add as resolution-independent page coordinates, so your marks stay crisp no matter how much you zoom.",
              "Choose a tool from the toolbar — text, pen, box, or highlighter — pick a color and stroke width, then click or drag on the page. Because nothing is uploaded, the tool stays fast and is safe to use with confidential documents.",
            ],
          },
          {
            heading: "Saving your edited PDF",
            paragraphs: [
              "When you're done, hit Save PDF. The editor flattens every annotation onto the page at a high export resolution and embeds it into a fresh PDF matched to your original page size.",
              "The result is a normal, shareable PDF that opens in any viewer — the text, highlights, and drawings are baked in as part of the page, not separate attachments that can mis-sync.",
            ],
          },
          {
            heading: "Undo, redo and precision",
            paragraphs: [
              "Mistakes happen. The editor keeps a full undo/redo history per page, and the select tool lets you click any annotation and delete it, so you can refine a mark-up until it's exactly right before saving.",
              "You can also control font size for text and stroke width for drawing — the two controls people reach for most when polishing an annotation.",
            ],
          },
        ],
      },
      {
        slug: "how-to-convert-images-to-pdf",
        title: "How to Convert Images to PDF Online (JPG, PNG, WebP)",
        description:
          "Turn one or more photos or scans into a single PDF for free — choose page size, orientation and fit, all in your browser.",
        keywords: [
          "jpg to pdf",
          "png to pdf",
          "image to pdf online",
          "convert images to pdf",
          "combine images into pdf",
        ],
        toolSlug: "image-to-pdf",
        published: "2026-09-09",
        updated: "2026-09-09",
        readMinutes: 3,
        sections: [
          {
            heading: "Why convert images to PDF",
            paragraphs: [
              "PDF is the standard for sending and archiving documents that shouldn't be accidentally edited. Converting a set of photos, scans or screenshots into one PDF is the classic way to submit an application, an expense report, or a photo portfolio as a single clean file.",
              "Unlike a zip folder, a PDF opens on every device without extra software, and the pages keep a predictable order.",
            ],
          },
          {
            heading: "Converting without uploading",
            paragraphs: [
              "The Image to PDF tool combines your images locally in the browser and lays each one out on its own page. Pick a page size (like A4 or Letter), choose how the image fits, and hit convert to download a single merged PDF.",
              "Because everything runs on your device, converting scanned documents never sends them to a server — useful for confidential paperwork.",
            ],
          },
          {
            heading: "Order and page size matter",
            paragraphs: [
              "Images are processed in the order you add them, so add pages the way you want them to appear. Each image becomes one page, keeping the layout predictable.",
              "If your images are large, the page fit settings keep edges from being cut off — choose 'fit' to scale the whole image onto the page.",
            ],
          },
        ],
      },
      {
        slug: "how-to-convert-pdf-to-image",
        title: "How to Convert a PDF to Images Online for Free",
        description:
          "Render PDF pages as high-quality JPG or PNG images right in your browser. Pick the scale, choose the format, download.",
        keywords: [
          "pdf to jpg",
          "pdf to png",
          "convert pdf to image",
          "pdf to image online",
          "extract image from pdf",
        ],
        toolSlug: "pdf-to-image",
        published: "2026-09-09",
        updated: "2026-09-09",
        readMinutes: 3,
        sections: [
          {
            heading: "When PDF-to-image conversion is useful",
            paragraphs: [
              "Sometimes you need a PDF page as an image: sharing a single slide on social media, embedding a chart in a web page, attaching a readable preview to an email, or pulling content out of a document into a design tool.",
              "Images are also easier to watermark, crop, or edit with filters than locked PDF pages.",
            ],
          },
          {
            heading: "Choosing quality and format",
            paragraphs: [
              "The PDF to Image tool renders each page at a scale you choose — higher scale means sharper output at the cost of a larger file. JPG gives the smallest files, while PNG is the pick when you need crisp text or transparency.",
              "Each page is exported with the same settings, so a multi-page document becomes a consistent set of images you can show or archive side by side.",
            ],
          },
          {
            heading: "Private conversion in the browser",
            paragraphs: [
              "The pages are rendered locally with the pdf.js engine — your PDF never leaves the browser. That's a real advantage for documents you don't want floating around on a third-party server.",
              "Download the pages you need, or grab the full set at once, and the originals are never stored anywhere.",
            ],
          },
        ],
      },
      {
        slug: "how-to-convert-html-to-pdf",
        title: "How to Convert HTML to PDF Online for Free",
        description:
          "Turn pasted HTML into a clean, paginated A4 PDF right in your browser — perfect for reports, docs and printable pages.",
        keywords: [
          "html to pdf",
          "convert html to pdf",
          "html to pdf converter",
          "web page to pdf",
          "print page as pdf",
        ],
        toolSlug: "html-to-pdf",
        published: "2026-09-09",
        updated: "2026-09-09",
        readMinutes: 3,
        sections: [
          {
            heading: "Why convert HTML to PDF",
            paragraphs: [
              "PDF gives you a fixed, print-ready snapshot of content that stays identical on every device. Generating a PDF from HTML is a common way to produce invoices, reports, manuals, and documentation from markup that already exists.",
              "HTML renders natively in the browser, so what you see while editing is very close to what lands in the final PDF.",
            ],
          },
          {
            heading: "Converting locally, without a server",
            paragraphs: [
              "The HTML to PDF tool renders your markup inside a hidden page that's sized to A4, applies normal CSS, and paginates the result before exporting it as a downloadable PDF.",
              "This runs entirely in your browser, which keeps the conversion instant and private — nothing is sent to an external printing service.",
            ],
          },
          {
            heading: "Tips for clean page breaks",
            paragraphs: [
              "Print pagination divides long content across A4 pages automatically. For the most predictable output, keep your markup simple and avoid fixed-height containers that force content off-page.",
              "The exported file is a standard PDF, so it opens in any viewer and prints at the size you styled for.",
            ],
          },
        ],
      },
    ];

const guideBySlug = new Map(GUIDES.map((g) => [g.slug, g]));

export function getGuide(slug: string): Guide | undefined {
  return guideBySlug.get(slug);
}

export function getGuidesByTool(toolSlug: string): Guide[] {
  return GUIDES.filter((g) => g.toolSlug === toolSlug);
}