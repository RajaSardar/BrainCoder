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
];

const guideBySlug = new Map(GUIDES.map((g) => [g.slug, g]));

export function getGuide(slug: string): Guide | undefined {
  return guideBySlug.get(slug);
}

export function getGuidesByTool(toolSlug: string): Guide[] {
  return GUIDES.filter((g) => g.toolSlug === toolSlug);
}