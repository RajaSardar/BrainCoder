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
      "Compress one PDF up to 100 MiB in your browser. Learn which lossy preset to choose, what stays unchanged, and why file-size savings vary.",
    keywords: [
      "compress pdf online",
      "reduce pdf file size",
      "shrink pdf",
      "pdf compressor free",
      "make pdf smaller",
    ],
    toolSlug: "pdf-compressor",
    published: "2026-09-09",
    updated: "2026-09-16",
    readMinutes: 3,
    sections: [
      {
        heading: "What this compressor changes",
        paragraphs: [
          "Large embedded images can account for much of a PDF's size. PDF Compressor tries to shrink supported images with lossy JPEG recompression and downsizing, then saves the document using compact object streams. It runs locally in a JavaScript worker, not WebAssembly, and does not upload your PDF.",
          "Text, fonts, page layout, and document metadata are preserved. Pages are not rasterized: existing selectable text stays text, while scanned text remains part of an image. Compression does not add OCR, remove metadata, or sanitize sensitive content.",
        ],
      },
      {
        heading: "1. Choose one PDF",
        paragraphs: [
          "Open PDF Compressor using the button below, then choose or drop one non-empty PDF up to 100 MiB (104,857,600 bytes). There is no batch mode. Keep your source file so you can compare the result.",
          "Encrypted PDFs, including permission-restricted files, are rejected. Documents with populated digital signatures are also rejected because compression would invalidate those signatures. Use an unencrypted, unsigned copy you are authorized to edit. Empty signature fields alone do not trigger rejection; signature authenticity is not checked.",
        ],
      },
      {
        heading: "2. Choose a compression preset",
        paragraphs: [
          "Start with Balanced, the default. Choose Light to retain more image detail, or Strong for more aggressive compression. All three presets are lossy: they can change visible image detail and color, even though text is preserved.",
          "The presets use JPEG quality settings of 85%, 65%, and 40%, with maximum image dimensions of 2,000, 1,600, and 1,200 pixels respectively. These settings are not promised file-size reductions, and Strong is not guaranteed to reach an email or upload limit.",
        ],
      },
      {
        heading: "3. Run compression",
        paragraphs: [
          "Click Compress PDF and wait for the result. Processing time and memory use depend on the document and your device, even below the 100 MiB cap. You can cancel; the source stays selected. A job that takes longer than 60 seconds times out, so try a smaller PDF if needed.",
          "Unsupported images are left unchanged rather than approximated. This includes many images with color profiles, masks, or complex encodings. Images may also be skipped because of safety limits, decoding errors, or a lack of size savings.",
        ],
      },
      {
        heading: "4. Review and download",
        paragraphs: [
          "Compare the original and output sizes and the counts of optimized and unchanged images, then download. If the complete output would be equal in size or larger, the tool returns your original PDF byte for byte. Text-heavy and already optimized documents may not shrink at all; there is no target-size guarantee.",
          "Open the downloaded PDF and inspect images and small details before sharing. Use Adjust compression to retry with another preset, or New file to process another PDF. If the result still exceeds your destination's limit, consider re-exporting from the source with smaller images or splitting the document where permitted. Review sensitive content and metadata separately: compression leaves them in place.",
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
              "Choose a tool from the toolbar — text, pen, box, highlight, or arrow — pick a color, stroke width, and font size, then click or drag on the page. Because nothing is uploaded, the tool stays fast and is safe to use with confidential documents.",
              "Marks you place aren't permanent. Switch to the Select tool to click any annotation and edit, move, or resize it: text reopens for changes, drag moves it, and rect/highlight handles resize it. Keyboard shortcuts keep editing fast — Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z for undo/redo, and the Delete key to remove the selected mark.",
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
    slug: "how-to-convert-pdf-to-powerpoint",
    title: "How to Convert a PDF to PowerPoint (PPT/PPTX) Online",
    description:
      "Turn every PDF page into its own 16:9 PowerPoint slide as a snapshot image. Pick a page range and image quality, preview, download.",
    keywords: [
      "pdf to ppt",
      "pdf to powerpoint",
      "convert pdf to pptx",
      "pdf to slides",
      "pdf to powerpoint online",
    ],
    toolSlug: "pdf-to-ppt",
    published: "2026-09-22",
    updated: "2026-09-22",
    readMinutes: 3,
    sections: [
      {
        heading: "What a PDF-to-PPT conversion actually gives you",
        paragraphs: [
          "PDF to PPT renders every page of your PDF as a full-slide snapshot image inside a 16:9 PowerPoint deck. Color, layout, fonts, and images are all preserved exactly as they appear — but the slides are pictures, not live text, so the words inside them can't be selected or edited later.",
          "That makes the tool ideal when you want to re-present an existing document (a report, a research paper, a set of mockups) as a deck without rebuilding every slide by hand. If you genuinely need editable text, a cleaner path is PDF to Text or PDF to Markdown to extract the wording, then paste it into PowerPoint yourself.",
        ],
      },
      {
        heading: "Keeping it sharp and fast",
        paragraphs: [
          "The image-quality slider controls how crisply each page is rendered: 1x keeps downloads small, while 3x produces sharper slides for projectors and large screens at the cost of bigger files and slower rendering.",
          "You can also convert only part of the document by entering a page range such as 1-3,5, which is handy when a paper is 40 pages but the talk only needs its core slides.",
        ],
      },
      {
        heading: "Private conversion, never uploaded",
        paragraphs: [
          "Rendering happens locally in your browser with the pdf.js engine, and the .pptx is built right on your device — your file never touches a server. For password-protected documents, unlock them with PDF Unlock first, since protected files can't be read here.",
        ],
      },
    ],
  },
{
    slug: "how-to-rotate-a-pdf",
    title: "How to Rotate a PDF: Turn a Sideways PDF the Right Way Online",
    description:
      "Rotate every page of a PDF 90° clockwise, 90° counter-clockwise, or 180° in one click. Lossless, fully in your browser, no uploads.",
    keywords: [
      "rotate pdf",
      "pdf rotator",
      "rotate pdf 90 degrees",
      "rotate pdf pages online",
      "rotate pdf 180 degrees",
    ],
    toolSlug: "pdf-rotate",
    published: "2026-09-22",
    updated: "2026-09-22",
    readMinutes: 3,
    sections: [
      {
        heading: "What this tool rotates",
        paragraphs: [
          "PDF Rotator reorients an entire document in one step. When you upload a PDF whose pages are sideways or upside down, clicking a direction rotates every page together — there's no per-page clicking and no preview. That makes it the fastest fix for a whole scan that came out rotated.",
          "If you only need to fix some pages of a mixed-orientation document instead of all of them, PDF Editor shows page previews and lets you change individual pages. For whole-document fixes, this tool is the quickest option.",
        ],
      },
      {
        heading: "Choosing a direction",
        paragraphs: [
          "Three buttons cover every need: 90° clockwise, 90° counter-clockwise, and 180°. Each click downloads the result instantly, and subsequent clicks continue from the current orientation — so three 90° clockwise turns reach 270°, and one 90° counter-clockwise turn also lands at 270°.",
          "Rotation is handled as page metadata, so the page content itself is not re-encoded: text, images, and quality are preserved, and files are processed locally in your browser with nothing uploaded.",
        ],
      },
      {
        heading: "Limits and edge cases",
        paragraphs: [
          "The tool accepts PDFs up to 100 MB. Password-protected documents can't be read directly — unlock them with PDF Unlock before loading them here. Scanned PDFs rotate exactly like any other, since the orientation change applies to the page itself rather than the text inside it.",
        ],
      },
    ],
  },
{
    slug: "how-to-convert-html-to-pdf",
    title: "How to Convert HTML to PDF Online for Free",
    description:
      "Turn pasted HTML into a paginated A4 PDF with real, selectable text — what the converter keeps, what it drops, and how to write markup that converts cleanly.",
    keywords: [
      "html to pdf",
      "convert html to pdf",
      "html to pdf converter",
      "html markup to pdf",
      "selectable text pdf",
    ],
    toolSlug: "html-to-pdf",
    published: "2026-09-09",
    updated: "2026-09-09",
    readMinutes: 4,
    sections: [
      {
        heading: "What kind of HTML to PDF this is",
        paragraphs: [
          "There are two ways to turn a web page into a PDF. The first renders the page and captures it, which reproduces CSS but leaves you with a picture of text. The second reads the markup and writes the text into the PDF itself. BrainCoder does the second: the output is a text-based, searchable A4 document built with the standard PDF fonts, so it is smaller, accessible to screen readers, and usable for invoices, reports, specs and archived HTML emails.",
          "Because it works on content rather than pixels, the conversion is predictable. Headings, paragraphs, lists, tables, blockquotes, preformatted code and horizontal rules are laid out across A4 pages, and bold, italic and monospace spans keep their emphasis.",
        ],
      },
      {
        heading: "What it does not reproduce",
        paragraphs: [
          "Advanced CSS and layout are simplified, not replicated. Colours, custom fonts, borders, background images, floats, grids, flexbox, positioning and inline styling are not carried into the PDF. Script and style blocks, images, embedded media, SVG and form controls are dropped, and the interface tells you how many elements were skipped so nothing disappears silently.",
          "If you genuinely need a pixel-perfect copy of a rendered page, print to PDF from your browser instead — that path uses the browser's own layout engine. This tool is for the other case: taking markup that is already structured as a document and turning it into a clean, selectable PDF.",
        ],
      },
      {
        heading: "Converting locally, without a server",
        paragraphs: [
          "Parsing, layout and PDF generation all run in your browser. The HTML is treated as text and is never rendered or executed as a page, so no script in it can run, and your content never leaves your device.",
          "Each conversion accepts up to 200 KB of HTML and produces up to 200 pages. If the page cap is reached, the tool says so and stops rather than silently dropping the rest of your document.",
        ],
      },
      {
        heading: "Tips for clean page breaks",
        paragraphs: [
          "Use real heading elements instead of styled paragraphs — the converter sizes them, bolds them and keeps them on the same page as the text that follows, so a heading never sits alone at the foot of a page.",
          "Keep table cells short where you can. Columns are sized from their widest unbreakable content, and long cells wrap inside the column. Cells with inline text-align right are right-aligned, which is handy for amounts.",
          "Expect a document title to become an H1 when your markup has none, and prefer text that fits the standard PDF fonts. Characters outside that set, and stray angle brackets that break nesting, are replaced with a question mark and counted in the report.",
        ],
      },
    ],
  },
  {
    slug: "how-to-convert-pdf-to-word",
    title: "How to Convert a PDF to a Word Document Online for Free",
    description:
      "Turn PDF pages into an editable .docx in your browser — no uploads, no sign-up. Private and free for any file size.",
    keywords: [
      "convert pdf to word",
      "pdf to docx",
      "pdf to word online",
      "edit pdf as word",
      "pdf to editable text",
    ],
    toolSlug: "pdf-to-word",
    published: "2026-09-15",
    updated: "2026-09-15",
    readMinutes: 3,
    sections: [
      {
        heading: "Why convert PDF to Word at all",
        paragraphs: [
          "PDFs are great for sharing finished documents, but they're hard to edit — the layout is fixed at export time. When you need to rewrite a paragraph, adjust spacing, or reuse the text in a report, a .docx gives you back full control.",
          "Recruiters, editors and reviewers routinely ask for documents they can comment on, which makes 'convert pdf to word' one of the most-requested conversions there is.",
        ],
      },
      {
        heading: "Converting privately, straight in the browser",
        paragraphs: [
          "The PDF to Word tool parses your PDF locally and reconstructs the text and structure as an editable .docx. Headings, paragraphs and tables are mapped where possible, so you don't start from a blank page.",
          "Because the whole conversion runs in your browser, the file never touches a server — ideal for contracts, resumes and anything with personal data.",
        ],
      },
      {
        heading: "What to expect from the result",
        paragraphs: [
          "Text-heavy documents convert cleanly. Complex layouts — multi-column pages, unusual fonts or layered graphics — can come through with spacing that needs a light polish pass.",
          "Even so, converting beats retyping by a wide margin: you keep the text and most of the structure, then fix the details in Word.",
        ],
      },
    ],
  },
  {
    slug: "how-to-password-protect-a-pdf",
    title: "How to Password Protect a PDF Online for Free",
    description:
      "Lock any PDF with a password so only people you choose can open it. Runs entirely in your browser — nothing is ever uploaded.",
    keywords: [
      "password protect pdf",
      "lock pdf with password",
      "add password to pdf",
      "secure pdf online",
      "encrypt pdf free",
    ],
    toolSlug: "pdf-protect",
    published: "2026-09-15",
    updated: "2026-09-15",
    readMinutes: 3,
    sections: [
      {
        heading: "When a password-protected PDF makes sense",
        paragraphs: [
          "Sending a confidential file through email or a shared drive means the file can be opened by anyone who receives it. Adding a password restricts who can actually view the contents.",
          "It's the standard for sharing quotes, bank statements, tax documents, employment offers and NDAs — anytime the recipient is known but the channel is not private.",
        ],
      },
      {
        heading: "Locking a PDF without uploading it",
        paragraphs: [
          "The Protect PDF tool encrypts your file locally in the browser. You pick a password, and the tool re-writes the PDF with encryption applied and all existing features still intact for the right people.",
          "Nothing is uploaded, which matters here especially: the point of protecting a file is keeping it out of the wrong hands, and a lock should never require sending the unlocked original to a server first.",
        ],
      },
      {
        heading: "Choosing a strong password",
        paragraphs: [
          "Use a phrase or a password from a generator rather than a word. The lock is only as strong as the password, and modern tools can brute-force short passwords in seconds.",
          "Share the password on a separate channel from the file — an email with the PDF and a different message with the password — so intercepting one doesn't unlock the other.",
        ],
      },
    ],
  },
  {
    slug: "how-to-unlock-a-password-protected-pdf",
    title: "How to Unlock a Password-Protected PDF Online for Free",
    description:
      "Remove a password you know from a PDF in seconds — right in your browser. The unlocked copy is created locally, so it's private by design.",
    keywords: [
      "unlock pdf",
      "remove pdf password",
      "remove password from pdf",
      "unlock pdf online",
      "decrypt pdf free",
    ],
    toolSlug: "pdf-unlock",
    published: "2026-09-15",
    updated: "2026-09-15",
    readMinutes: 3,
    sections: [
      {
        heading: "Why you'd unlock a PDF you own",
        paragraphs: [
          "Personnel leave and files get shared across teams, so it's normal to end up with a password-protected PDF you legitimately need to open — the password was saved somewhere or the person who set it is gone.",
          "Removing the password lets you edit, print, search and re-distribute the document without the friction of re-authenticating every time.",
        ],
      },
      {
        heading: "Removing the password locally",
        paragraphs: [
          "The Unlock PDF tool asks for the current password, verifies it, and writes a new unprotected copy — all inside your browser using pdf-lib. The original file is never uploaded.",
          "That privacy detail is more than a nicety: you're handling a document someone chose to lock, and the whole point is keeping its contents off third-party servers.",
        ],
      },
      {
        heading: "What if you don't know the password?",
        paragraphs: [
          "If the password was set to restrict access (not just permissions), no in-browser tool can recover the content — that's the encryption working as intended.",
          "In that case the right move is to ask the person who created the file, or check your password manager, rather than chasing tools that claim to 'crack' PDFs. The Unlock PDF tool is for passwords you already have.",
        ],
      },
    ],
  },
  {
    slug: "how-to-view-pdf-metadata",
    title: "How to View a PDF's Metadata Online for Free",
    description:
      "Inspect what a PDF actually records — title, author, creator, producer and creation/modification dates. Runs entirely in your browser; nothing is uploaded.",
    keywords: [
      "view pdf metadata",
      "check pdf metadata",
      "pdf properties",
      "pdf creator software",
      "when was a pdf created",
    ],
    toolSlug: "pdf-metadata",
    published: "2026-09-24",
    updated: "2026-09-24",
    readMinutes: 3,
    sections: [
      {
        heading: "What PDF metadata contains",
        paragraphs: [
          "Most PDFs carry a small amount of embedded bookkeeping beyond the visible pages: a title, an author, the software that created the file (creator/producer), keywords, and creation and modification timestamps. Part lives in the Info dictionary, part in XMP metadata, and PDFs from different tools store different subsets.",
          "That's useful for provenance: confirming who made a file, when, and with what tool — handy when auditing documents you've received or keeping track of files your own systems generate.",
        ],
      },
      {
        heading: "What the viewer shows",
        paragraphs: [
          "The PDF Metadata Viewer lists the page count first, then the title, author, subject, keywords, creator and producer whenever the file records them, followed by creation/modification dates (read from the Info dictionary or XMP) and any extra or custom entries it finds.",
          "Fields the file doesn't store are skipped rather than shown as empty, and no values are invented — the list is exactly what's embedded in the PDF. If a file has no title, author or date metadata at all, the viewer says so.",
        ],
      },
      {
        heading: "Protected and permission-restricted PDFs",
        paragraphs: [
          "PDFs that only restrict printing or editing (no open password) can be inspected directly. Files locked with an open password must be opened with the password first — or unlocked with the Unlock PDF tool — before their metadata can be read.",
          "All inspection happens in your browser: the file is never uploaded, which matters when you're auditing a document you didn't create.",
        ],
      },
      {
        heading: "What metadata won't tell you",
        paragraphs: [
          "Metadata records what the file's creator chose to write down. It won't reveal hidden layers or image EXIF, and author/creator fields can be blank, generic, or set to anything. Treat it as evidence of provenance, not proof of it.",
          "The viewer is read-only — it doesn't edit or strip metadata. If you need to change embedded metadata, use dedicated desktop software that supports it.",
        ],
      },
    ],
  },
  {
    slug: "how-to-redact-a-pdf",
    title: "How to Redact a PDF Online for Free (Permanently Cover Text)",
    description:
      "Black-out names, numbers and sensitive lines in a PDF so they can't be seen or copied — boxes are stamped into the page, not removable overlays. Runs 100% in your browser.",
    keywords: [
      "redact pdf",
      "black out text in pdf",
      "remove sensitive information from pdf",
      "redact pdf online free",
      "hide text in pdf",
    ],
    toolSlug: "pdf-redact",
    published: "2026-09-15",
    updated: "2026-09-25",
    readMinutes: 4,
    sections: [
      {
        heading: "Redacting is stamped in, not drawn over",
        paragraphs: [
          "A real redaction blackens a region so thoroughly that the text can no longer be seen, selected, searched, or copy-pasted in a normal reader. The box is physically part of the page's content — an overlay drawn with a presentation tool, by contrast, can be selected and deleted to reveal the text underneath.",
          "The Redact PDF tool burns each redaction rectangle into the page content stream. That's permanent for practical purposes: once downloaded, everyday viewers can't lift the box to recover what's under it. Be precise about what this means though — the covered text is not removed from the file; it still exists beneath the rectangle. Redaction here is visual erasure, not deletion of the glyph data, so this is not a certified, forensically guaranteed process, and anything outside the boxes you draw is left untouched.",
        ],
      },
      {
        heading: "Controlling the redaction areas",
        paragraphs: [
          "Open the PDF and each page renders as a preview. Drag a rectangle over the sensitive content on any page — you can draw several boxes on one page and across many pages. For exact placement, or if you're using a keyboard instead of a mouse, add a region by entering the page number and the X, Y, width, and height in points, measured from the page's top-left corner.",
          "The tool lists every region on the current page with its coordinates, lets you remove individual boxes or clear the whole page, and shows the total count before you export. Files up to 100 MB are supported and region editing works on up to 200 pages. Everything runs locally — the file never leaves your device.",
        ],
      },
      {
        heading: "What redaction doesn't remove",
        paragraphs: [
          "Redaction only covers the rectangles you define. Text, images, annotations, form field values, and document metadata that sit outside those boxes are left exactly as they are — including invisible or watermarked text in other areas of the page.",
          "The sensitive words are overwritten visually, not deleted: a sidecar text-layer for the covered area may still be readable by specialized tools, and PDF metadata such as author and title is untouched. Use the Auto-Redact PDF tool when the same term appears many times and you want every occurrence blackened in one pass, and always do a second check in a desktop reader that displays redaction areas before sharing the file.",
        ],
      },
      {
        heading: "Check before you share",
        paragraphs: [
          "After redacting, open the downloaded PDF in a desktop reader and confirm you can no longer select or search the covered text, and that every box sits exactly over its target. Shared documents should also be checked for metadata you don't want to expose.",
          "Redacting a copy is the safe pattern: keep your original intact and share the redacted version only. For regulated disclosures where the standard is certified removal of the underlying data, use dedicated desktop redaction software and follow your organization's process.",
        ],
      },
    ],
  },
  {
    slug: "how-to-remove-pages-from-a-pdf",
    title: "How to Remove Pages from a PDF Online for Free",
    description:
      "Delete unwanted, blank or duplicate pages from any PDF — quickly, in your browser, with live page previews.",
    keywords: [
      "delete pages from pdf",
      "remove pages from pdf",
      "pdf delete pages online",
      "delete blank pages from pdf",
      "remove page from pdf free",
    ],
    toolSlug: "pdf-remove-pages",
    published: "2026-09-15",
    updated: "2026-09-15",
    readMinutes: 3,
    sections: [
      {
        heading: "When you need to remove pages",
        paragraphs: [
          "Scans pull in blank pages, submissions include outdated cover pages, and downloaded reports come with an unwanted appendix. Deleting those pages produces a cleaner, smaller file that's ready to send.",
          "It's also safer than re-saving a whole document: the finished file simply no longer contains the pages you removed.",
        ],
      },
      {
        heading: "Removing pages with a live preview",
        paragraphs: [
          "The PDF Delete Pages tool renders a thumbnail of every page so you can see exactly what you're removing. Tap the pages you no longer need, then hit Delete pages — the tool rebuilds the PDF from the pages you kept and downloads it instantly.",
          "Marked pages get a red border; tap one again to keep it. The rebuilt file keeps the content, links and layout of the pages that remain, though document-level bookmarks and metadata may not carry over. Files up to 100 MB and 200 pages are supported in one run.",
        ],
      },
      {
        heading: "Getting rid of blank pages too",
        paragraphs: [
          "Blank pages often slip in from double-sided scans or mis-configured exports. The Remove Blank Pages tool detects near-empty pages automatically and strips them out.",
          "Run that first if you're not sure which pages are blank — it keeps the result clean without you hunting through the document manually.",
        ],
      },
      {
        heading: "Private, like everything here",
        paragraphs: [
          "Page deletion runs entirely in your browser: pages are rendered with pdf.js for the previews, then the kept pages are reassembled by the in-app Rust/WASM core (with a JavaScript fallback). The pages you remove and the pages you keep never leave your device, so even sensitive documents can be trimmed safely.",
        ],
      },
    ],
  },
  {
    slug: "how-to-remove-blank-pages-from-pdf",
    title: "How to Remove Blank Pages from a PDF",
    description:
      "Find and delete near-empty pages in a PDF — a heuristic ink-coverage scan flags blanks, you review the selection, and one click rebuilds a cleaner file. Fully in your browser.",
    keywords: [
      "remove blank pages from pdf",
      "delete empty pages from pdf",
      "remove blank pages pdf online",
      "delete blank pages in pdf",
      "clean blank pages from pdf",
    ],
    toolSlug: "pdf-remove-blank-pages",
    published: "2026-09-22",
    updated: "2026-09-22",
    readMinutes: 3,
    sections: [
      {
        heading: "Where blank pages come from",
        paragraphs: [
          "Double-sided scans land with a stray empty sheet. Exports from design tools and emails leave trailing blank pages. Merging files can sprinkle extras in the middle. By hand, checking a long document page by page is tedious — an automatic scan that flags empties for you is much faster.",
        ],
      },
      {
        heading: "How blank detection works",
        paragraphs: [
          "Remove Blank Pages renders each page in your browser and measures its ink coverage. Pages with fewer than a fraction of a percent of dark pixels, and no extractable text, get a blank badge and are preselected for deletion.",
          "It's a heuristic, not OCR: a page that's truly empty is caught easily, but light watermarks or a single tiny page number can influence the result. That's why nothing is ever removed without your click — you review the badges and toggle any page on or off before deleting.",
        ],
      },
      {
        heading: "Running a clean in one pass",
        paragraphs: [
          "Open the PDF, skim the flagged thumbnails, adjust the selection if needed, then hit Delete. The tool rebuilds the file from the pages you kept and downloads it instantly — the pages that remain keep their content, links and layout.",
          "Because the output is a rebuilt file, document-level bookmarks and metadata may not carry over, so keep the original if you might need it. Files up to 100 MB and 200 pages are supported; larger documents can be split with PDF Split first.",
        ],
      },
    ],
  },
  {
    slug: "how-to-add-a-text-watermark-to-a-pdf",
    title: "How to Add a Text Watermark to a PDF",
    description:
      "Stamp CONFIDENTIAL, DRAFT or copyright text on every page of a PDF — centered, at whatever size, opacity and angle you choose, entirely in your browser.",
    keywords: [
      "add watermark to pdf",
      "pdf watermark",
      "stamp text on pdf",
      "confidential watermark pdf",
      "watermark pdf online",
    ],
    toolSlug: "pdf-watermark",
    published: "2026-09-22",
    updated: "2026-09-22",
    readMinutes: 3,
    sections: [
      {
        heading: "When a text watermark makes sense",
        paragraphs: [
          "A visible label tells readers a file is confidential, a draft, or under copyright before they get to the contents. Stamping the same text across every page covers your document even when someone jumps to the middle or sends just a few pages onward.",
          "A watermark is a visual marking, not redaction: it doesn't stop text from being copied or selected. If you need to permanently remove content rather than overlay a label, redaction is the right tool.",
        ],
      },
      {
        heading: "Setting the stamp",
        paragraphs: [
          "PDF Watermark reads the page count the moment you open a file and gives you three controls: font size (12–120 pt), opacity (1–100%) and angle (−90° to 90°). The text is centered on every page and auto-shrinks to stay within the page width.",
          "Watermarks use a fixed bold Helvetica in dark grey, so the output is predictable. The font covers Latin letters, numbers and common punctuation up to 80 characters; emoji and non-Latin scripts can't be encoded and will be flagged rather than silently mangled.",
        ],
      },
      {
        heading: "Stamping and downloading",
        paragraphs: [
          "Choose Add watermark → download and a watermarked copy of your file downloads instantly. Every page gets the same stamp, and rotated pages are handled correctly — the watermark picks up each page's rotation internally so it lands at the angle you asked for.",
          "Password-protected files should be unlocked first, and the watermarked result isn't re-protected — add PDF Protect afterwards if you need encryption. Want color or per-page placement instead? PDF Editor offers custom colors and six positions.",
        ],
      },
    ],
  },
  {
    slug: "how-to-add-page-numbers-to-a-pdf",
    title: "How to Add Page Numbers to a PDF",
    description:
      "Add a page number to every page of a PDF in one of six corner positions — with an “n / total” count, a starting offset, and placement that follows rotated pages, entirely in your browser.",
    keywords: [
      "add page numbers to pdf",
      "pdf page numbers",
      "number pages in pdf",
      "add page numbers to pdf online",
      "start page numbers on page 2",
    ],
    toolSlug: "pdf-page-numbers",
    published: "2026-09-23",
    updated: "2026-09-23",
    readMinutes: 3,
    sections: [
      {
        heading: "Why PDFs need page numbers",
        paragraphs: [
          "Long documents lose their way without page references. Adding page numbers makes contracts, reports, theses and meeting packs navigable, and lets readers say 'see page 14' with confidence.",
          "Page numbers on a PDF are a form of editing, so you'll usually want them on a working copy: keep the original file as-is and number a duplicate for distribution.",
        ],
      },
      {
        heading: "Choosing a position and label",
        paragraphs: [
          "The tool offers six corner positions — bottom and top, each with left, center and right alignment. Bottom center is the default and suits most documents, while top corners are common for landscape or bound files.",
          "Labels can be a plain number (1, 2, 3) or an “n / total” pair like 3 / 12, which helps readers know how much of the document is left. The font size runs from 8 to 24 points, and labels are drawn in fixed dark-grey Helvetica so output stays consistent.",
        ],
      },
      {
        heading: "Starting offsets and rotated pages",
        paragraphs: [
          "“Start numbering at” changes what the first label reads — set it to 0 for an unnumbered-looking cover, or to 2 if you want the physical second page to read 2. Every page is still numbered; there is no skip-one-page option.",
          "Placement follows each page's own rotation, so a mixed document with portrait and landscape pages gets numbers that sit in the same visual corner and read upright everywhere. There is no preview, so download and review the file before sharing it.",
          "Password-protected PDFs need unlocking first, and a numbered file can be protected afterwards with PDF Protect if you need encryption.",
        ],
      },
    ],
  },
  {
    slug: "how-to-crop-a-pdf",
    title: "How to Crop a PDF Online (and What Cropping Actually Does)",
    description:
      "Trim unwanted margins from a PDF by percentage in your browser — a live page-1 preview, rotated pages handled automatically, and an honest look at why cropping keeps your file size roughly the same.",
    keywords: [
      "how to crop a pdf",
      "crop pdf online",
      "trim pdf margins",
      "remove white space from pdf",
      "cut pdf pages",
      "crop pdf pages free",
    ],
    toolSlug: "pdf-crop",
    published: "2026-09-23",
    updated: "2026-09-23",
    readMinutes: 3,
    sections: [
      {
        heading: "The two ways to 'crop' a PDF",
        paragraphs: [
          "There are two different operations people call cropping. The first changes how a page displays by shrinking its visible boundary — content outside the edge stops showing but still exists inside the file, so the file size barely changes. The second permanently deletes content and rebuilds the PDF smaller. They have very different results.",
          "The margin trimmer here does the first kind: it adjusts each page's crop box. That's almost always what people want when they say 'crop this PDF' — cutting the scanner's black border, tightening a wide margin, or removing white space around a scanned page without touching the text.",
        ],
      },
      {
        heading: "Setting margins by percentage",
        paragraphs: [
          "Four sliders cut the top, right, bottom and left edges by 0–45% each. A live overlay on the page-1 preview highlights exactly the area that will remain, so a 10% bottom cut shows as a pale band across the bottom of the preview.",
          "The same percentages are applied to every page, which is deliberate: margin trimming is almost always uniform, and it keeps multi-page documents consistent. Because placement is computed from each page's own rotation, a document mixing portrait and landscape pages still keeps its intended visual margins everywhere.",
        ],
      },
      {
        heading: "Working with the result",
        paragraphs: [
          "A cropped PDF downloads as a new file — your original stays untouched, so you can compare or start over. Files up to 100 MB are supported, and password-protected PDFs need to be unlocked with the PDF Unlock tool first.",
          "If content outside the crop matters to you, remember it's clipped, not deleted: view the original or restore the crop box to see it again. For genuinely removing sensitive material, use the PDF Redact tool instead, since cropping only changes what's visible.",
        ],
      },
    ],
  },
  {
    slug: "how-to-convert-csv-to-json",
    title: "How to Convert CSV to JSON Online (Without Losing a Column)",
    description:
      "Convert CSV to JSON in your browser with a real RFC 4180 parser: quoted commas, embedded newlines, doubled quotes, CRLF, CR and LF, a UTF-8 BOM, honest delimiter detection, and every decision the converter made listed on screen.",
    keywords: [
      "csv to json",
      "convert csv to json online",
      "csv json converter",
      "csv parser online",
      "spreadsheet to json",
    ],
    toolSlug: "csv-json",
    published: "2026-09-15",
    updated: "2026-10-01",
    readMinutes: 5,
    sections: [
      {
        heading: "Why a one-line CSV to JSON converter gets it wrong",
        paragraphs: [
          "The reason people paste CSV into a converter and get back something subtly broken is almost never the JSON side. It is the CSV side. A cell that contains a comma has to be quoted; a quoted cell can contain a line break; a quote inside a quoted cell is written as two quotes; some exporters use semicolons or tabs because the data itself contains commas; some files start with a byte order mark; and Windows tools write CRLF while old Mac tools wrote a bare CR. Split the text on a comma and each of those turns a column into fragments or loses a row entirely.",
          "So the first question when you choose one is not what it outputs but what it does with the awkward cases. This page writes the parser out by hand for exactly that reason, and the test below is whether it tells you what it found.",
        ],
      },
      {
        heading: "Paste it, and read the delimiter decision first",
        paragraphs: [
          "Paste the CSV or open a file - there is no sample data loaded on the page, so nothing you see can be confused with your own. Then read the delimiter line before you read anything else, because the wrong delimiter produces output that looks plausible and is completely wrong. Auto-detect scores comma, semicolon, tab and pipe over the first two dozen records and reports its confidence: high means the chosen delimiter appears in every sampled record and no other candidate appears at all, medium means it is the only candidate present but not in every record, and low means another delimiter also appears in the data - which usually means one of them is inside cell text. The header row is rendered above the output, so the fastest check is whether those keys look like your columns.",
          "A file that is semicolon-separated or tab-separated converts the same way once you pick it by hand. Single-column files need no delimiter at all and the page says so rather than pretending to detect something.",
        ],
      },
      {
        heading: "What RFC 4180 actually promises, and where this one stops",
        paragraphs: [
          "RFC 4180 is specific: fields separated by commas, records ended by CRLF, optional double quotes around any field, a doubled quote meaning one literal quote, and a line break allowed inside a quoted field. This parser does all of that, and it treats LF and a bare CR as record endings too, which is an extension rather than part of the specification.",
          "There are three more extensions, all disclosed on the page: a leading UTF-8 byte order mark is skipped, a blank line is skipped rather than becoming an empty row, and a trailing line ending does not create an empty record. Each of those is what a spreadsheet does, which is why they are the defaults - but they are choices, and on a single-column file an empty line cannot be told apart from a row holding one empty cell.",
          "One case is refused rather than guessed: a double quote in the middle of a field that was never quoted is not legal CSV, and accepting it quietly is how a delimiter inside a cell gets mistaken for a column break. The text is kept and the position is reported - record, field and character number - so you can go and look at the file rather than wondering what the tool did.",
        ],
      },
      {
        heading: "Every value is a string, and that is the point",
        paragraphs: [
          "The most consequential decision on the page is the one it refuses to make. No type is inferred. The string 00123 stays 00123, so a UK postcode, a phone number, a product code and a zero-padded identifier all survive. TRUE stays the five characters TRUE rather than becoming the boolean true. A date written 3/4/26 stays 3/4/26 instead of being rewritten as an ISO date in the wrong order. A number written with a thousands separator stays as it was written rather than becoming a number that means something different.",
          "The only null values in the output are the cells a short row never had, and that is a different thing from an empty cell: an empty cell is something the CSV said, a missing cell is something it did not. If you want numbers, convert them where you consume the JSON, in code, where you can see the rule.",
        ],
      },
      {
        heading: "When rows and headers disagree",
        paragraphs: [
          "Real exports are messy, so the two common failures are handled in the open rather than smoothed over. A row with fewer fields than the header has keys gets JSON null in the missing cells, and a row with more fields keeps its extra values in an array under a name you can see in the output rather than dropping them. Both counts are reported, and the first affected row number is given so you can find it in your file.",
          "Duplicate column names are the other one. Two columns called amount cannot both be amount in a JSON object - the second would silently overwrite the first - so the second becomes amount (2), the third amount (3), and if that would collide with a name already in use the counter keeps going. Every rename is listed on the page. The first occurrence always keeps the original name, which keeps the common case working the way your other exports do.",
          "An empty header cell has no name to use, so it becomes columnN for its position. Surrounding whitespace on a header cell is trimmed before it becomes a key; the cell values themselves are never touched.",
        ],
      },
      {
        heading: "Caps, previews, and what the page will not do for you",
        paragraphs: [
          "Four caps are checked before any parsing work starts: 5,242,880 characters of pasted text, 5 MB per opened file, 20,000 rows, and 512 columns in a single row, plus 100,000 characters in one cell. Each is refused with its real numbers rather than truncated, because a truncated CSV converts into JSON that is wrong in a way nobody can see. The cell-length cap is the one people hit by accident - a CSV with a whole log file or a base64 blob in one cell.",
          "Both panels on the page are labelled as previews and are deliberately bounded: a data table showing the first twenty rows and eight columns, and a JSON pane showing the first 20,000 characters. Copy and Download give you the complete document, and the byte count on screen is measured on that exact text, so what the number says is what the file contains. Re-parsing the downloaded file gives back the same document.",
          "What it does not do is worth knowing before you rely on it: no Excel serial dates, no locale-aware numbers or currencies, no #N/A or other error values, no stripping of the leading apostrophe that marks a cell as text, no formula evaluation - =SUM(A1:A9) stays that literal string - and no encoding sniffing, so a Windows-1252 export arrives with U+FFFD characters and the page tells you how many it counted. It also does not convert JSON back to CSV; its old reverse mode was removed rather than left half-implemented, because a round trip that changes types on the way out is worse than no round trip.",
        ],
      },
      {
        heading: "Privacy",
        paragraphs: [
          "Your CSV is read with the browser's own file API and parsed in the tab. No request is made with your data, and nothing is uploaded - which matters more here than on most pages, because a CSV export is usually customer records, orders or an internal report. Same-origin static assets are all this page loads.",
          "One thing to keep in mind as a general habit rather than a bug in this tool: a CSV cell can contain markup, and this page renders every cell as escaped text, so a cell holding a script tag shows you a script tag. That is the right behaviour, but it means the value of any converter you use - including this one - is exactly the value of its output.",
        ],
      },
    ],
  },
  {
    slug: "how-to-generate-a-strong-password",
    title: "How to Generate a Strong Password Online",
    description:
      "Create secure, random passwords in your browser — fully offline, no logging, no uploads. Tunable length, character sets and similar-letter exclusion.",
    keywords: [
      "how to create a strong password",
      "strong random password online",
      "secure password generator",
      "generate strong password no sign up",
      "password generator offline",
    ],
    toolSlug: "password-generator",
    published: "2026-09-15",
    updated: "2026-09-16",
    readMinutes: 3,
    sections: [
      {
        heading: "What makes a password strong",
        paragraphs: [
          "A password's strength comes from unpredictability, not cleverness. Long, random passwords — 16 characters or more, drawn from a wide set of symbols, numbers and case — resist both guessing and automated attacks.",
          "Dictionary words, personal dates and reused phrases fail because attackers try those first. An offline generator sidesteps the problem entirely with true randomness.",
        ],
      },
      {
        heading: "Generating passwords that never leave your device",
        paragraphs: [
          "The Password Generator uses the browser's cryptographically secure random number generator to build each password on the spot — nothing is generated on, or sent to, a server.",
          "That matters for credentials: a 'random' password from a hosted tool is only as private as that tool's logging, so generation that happens entirely in your browser is the safer pattern.",
        ],
      },
      {
        heading: "Length over complexity",
        paragraphs: [
          "When choosing settings, prioritize length. A 20-character password beats a 12-character one with more symbol types, simply because the search space is far larger.",
          "Practical tip: store the generated password in a password manager and let it autofill. For anything you must type by hand, prefer a longer random password over a phrase built from dictionary words — passphrases are only as strong as the word list behind them.",
        ],
      },
    ],
  },
  {
    slug: "how-to-create-a-qr-code",
    title: "How to Create a QR Code for Free (URL, Text, Email)",
    description:
      "Generate a clean, scannable QR code for any link or text, right in your browser — download as PNG or SVG, no sign-up, no tracking.",
    keywords: [
      "qr code generator",
      "create qr code free",
      "generate qr code online",
      "qr code for url",
      "make a qr code",
    ],
    toolSlug: "qr-code-generator",
    published: "2026-09-15",
    updated: "2026-10-01",
    readMinutes: 7,
    sections: [
      {
        heading: "What a QR code is for",
        paragraphs: [
          "A QR code packs text — usually a URL — into a pattern a phone camera can read instantly. It's the fastest way to move someone from the physical world to a link: menus, business cards, posters, packaging and event invites all use them.",
          "Because a QR code is just encoded text, creating one needs no account and no personal data — and that includes whatever you choose to encode.",
        ],
      },
      {
        heading: "How the standard actually works",
        paragraphs: [
          "The specification, ISO/IEC 18004, defines 40 versions. Version 1 is a 21×21 grid of modules and each step up adds four modules per side, so version 40 is 177×177 — 40 versions in total. A symbol also carries one of four error correction levels: L recovers about 7% of the codewords, M about 15%, Q about 25% and H about 30%.",
          "The payload is split into blocks, each block gets Reed-Solomon error correction codewords appended, and the blocks are interleaved so that a scratch crossing several blocks damages them evenly rather than destroying one. On top of that sit the function patterns — the three finder squares, the timing lines, the alignment grid and the dark module — and finally eight candidate data masks are generated and scored so the least visually confusing one wins.",
        ],
      },
      {
        heading: "Generating one in your browser",
        paragraphs: [
          "The QR Code Generator encodes from scratch in TypeScript rather than delegating to a third-party package, and the whole thing runs on your device. Nothing about the code is sent anywhere, so a Wi-Fi password or a private link stays private.",
          "One deliberate simplification: the tool picks a single mode for the whole string. Digits are cheapest, then uppercase alphanumeric, then UTF-8 bytes. A single lowercase letter in an otherwise uppercase string therefore pushes everything into byte mode and cuts capacity. Splitting a string across modes would fit more characters at the price of a denser, harder-to-scan code.",
          "Text outside ASCII is written as UTF-8 bytes with no ECI header, which is the assumption most readers make. Some scanners decode those bytes differently and show garbled characters instead — worth testing if non-Latin text matters to you.",
        ],
      },
      {
        heading: "Capacity, and why your URL fits less than you expect",
        paragraphs: [
          "At error correction level L, version 40 holds 7,089 digits, 4,296 uppercase alphanumeric characters, or 2,953 bytes. A typical https:// URL is mostly lowercase, so it lands in byte mode and its real ceiling is closer to the byte figure. Raising the error correction level shrinks every one of these numbers.",
        ],
      },
      {
        heading: "Designing codes that scan",
        paragraphs: [
          "High contrast between the modules and the background matters most: aim for at least a 4:1 ratio, which means near-black on white rather than a pale tint. Keep the four-module quiet zone around the code — the tool includes it, and cropping it is one of the most common causes of a failure.",
          "For print, judge the size by module rather than overall width. Each module needs about 0.5 mm or more for a phone camera to resolve it, which is roughly 83 mm across for a version 40 code and 40 mm for a version 4. Print at 300 dpi or better.",
          "Use the SVG for print and for anything that will be resized: it is vector, so it scales without resampling. The PNG is a raster image and only looks sharp at the pixel size you exported.",
          "Avoid inverting the colours. A light-on-dark code reads on many modern phones and fails on plenty of others, so treat it as a risk you have tested rather than a free stylistic choice.",
        ],
      },
      {
        heading: "Error correction and file format",
        paragraphs: [
          "Error correction balances data density against damage resilience: L reserves the least space for recovery, M is a safe all-round default, and H is worth the extra density for stickers and packaging that get scratched or handled.",
          "Higher error correction repairs damage to the modules themselves. It cannot rescue glare, motion blur, a curved surface, or a code printed too small to resolve — those are optical problems, not data problems, and no level setting fixes them.",
        ],
      },
      {
        heading: "Testing before you print in bulk",
        paragraphs: [
          "Scan the finished code with the phone you expect to be used, under the lighting and at the distance it will actually be read. No generator can guarantee a code scans in every condition, and one test is worth a hundred reprinted signs.",
        ],
      },
    ],
  },
  {
    slug: "how-to-compress-an-image-online",
    title: "How to Compress an Image Online for Free (JPG, PNG, WebP)",
    description:
      "Compress one image up to 50 MB in your browser with presets, optional format and resize. Learn what stays unchanged and why the output is never larger.",
    keywords: [
      "compress image online",
      "reduce image file size",
      "compress jpg",
      "compress png",
      "compress webp online",
      "make image smaller",
      "image compressor free",
    ],
    toolSlug: "image-compressor",
    published: "2026-09-16",
    updated: "2026-09-16",
    readMinutes: 3,
    sections: [
      {
        heading: "What this compressor does",
        paragraphs: [
          "Image Compressor re-encodes one image in a Web Worker inside your browser — nothing is uploaded. The source image is decoded, drawn to a canvas, and encoded again with the settings you chose. Because the file is rebuilt this way, any EXIF, GPS or ICC metadata is stripped and the pixels are converted to sRGB 8-bit.",
          "Animated GIFs and animated WebP files are not played back; only their first frame is kept. HEIC and HEIF images are not supported — convert those to JPG or PNG first. These are honest trade-offs of in-browser canvas compression, not bugs.",
        ],
      },
      {
        heading: "1. Choose one image",
        paragraphs: [
          "Click or drag a single image up to 50 MB into the tool. JPG, PNG, WebP, AVIF and GIF files are accepted. There is no batch mode — each run processes the one image you load.",
          "Images larger than 40 megapixels are rejected with a clear message before any processing starts, because decoding them would use too much memory. Reduce the resolution in another tool first.",
        ],
      },
      {
        heading: "2. Pick a preset, format and resize",
        paragraphs: [
          "The presets are lossy JPEG quality levels: Light is 85%, Balanced is 70%, and Strong is 45%. Lower quality means a smaller file with more visible compression. If you pick PNG, the output is lossless and the quality value is ignored, so presets mostly affect file size only through the other settings.",
          "The output format can be Auto, which prefers WebP and uses AVIF where your browser can encode it — otherwise it falls back to WebP or JPEG cleanly. You can also choose JPEG, PNG or WebP explicitly. Optional resizing to a 1920 or 1280 px longest edge never upscales smaller images.",
        ],
      },
      {
        heading: "3. Compress, review, download",
        paragraphs: [
          "Click Compress Image and review the size comparison and exact reduction percentage. If the output would be larger than the upload, the tool returns your original byte for byte — the result is never bigger, so choose a different preset or a resize to get a smaller file.",
          "Use Adjust settings to retry with another preset, format or size without re-uploading. Jobs on very large images time out after 2 minutes with a message suggesting a smaller file. Remember that compression does not preserve metadata: the downloaded result is a fresh, metadata-free image.",
        ],
      },
    ],
  },
  {
    slug: "how-to-resize-an-image-online",
    title: "How to Resize an Image Online for Free (JPG, PNG, WebP)",
    description:
      "Resize one image to any pixel dimensions in your browser — pick a common preset, lock or unlock the aspect ratio, choose JPG, PNG, or WebP output, and download. Nothing is uploaded.",
    keywords: [
      "resize image online",
      "resize photo to 1920x1080",
      "change image dimensions",
      "resize jpg and png online",
      "image resizer free",
    ],
    toolSlug: "image-resizer",
    published: "2026-09-16",
    updated: "2026-09-16",
    readMinutes: 3,
    sections: [
      {
        heading: "What this resizer does",
        paragraphs: [
          "Image Resizer re-encodes your image to an exact target size on a canvas in your browser — nothing is uploaded. Set any pixel dimensions, keep or release the aspect ratio, choose JPG, PNG or WebP output, and download the result in seconds.",
          "JPG output fills transparent areas with white, while PNG and WebP preserve transparency, so they suit logos and graphics. Shrinking keeps perceived quality high because pixels are simply removed; enlarging has to interpolate new pixels, so the result looks softer. Like any canvas re-encode, the output does not preserve EXIF, GPS or other metadata.",
        ],
      },
      {
        heading: "1. Choose an image",
        paragraphs: [
          "Click the upload area or drop a file (up to 50 MB) into the tool. The original width and height are shown as soon as the image loads, along with its file size.",
          "Files that can't be decoded show a clear error instead of silently failing — dismiss it and try another image. You can load a new file at any time by using the upload area again.",
        ],
      },
      {
        heading: "2. Set the target size",
        paragraphs: [
          "The width and height inputs clamp to the 1–8,192 px range, so extreme values can never reach the canvas. The aspect-ratio lock is on by default and keeps the two sides in proportion automatically; turn it off for free-form dimensions.",
          "The preset chips — 256×256, 640×360, 1080×1080, 1280×720 and 1920×1080 — set exact sizes for common social posts and screens with one click.",
        ],
      },
      {
        heading: "3. Pick the output format and resize",
        paragraphs: [
          "PNG is the default output and suits graphics, while JPEG flattens transparency onto a white background and WebP often produces the smallest result for photos.",
          "The resize runs locally in your browser and is almost instant for normal sizes, with a live status message while the image is being re-encoded. Target sizes are capped at about 40 megapixels to stay inside safe canvas limits.",
        ],
      },
      {
        heading: "4. Download and verify",
        paragraphs: [
          "The resized image appears in the preview with its new dimensions and file size, so you can check the result before saving it.",
          "Click Download to save the file as resized- plus your original name. Use Reset to start over with the same image, or drop a new file to begin again.",
        ],
      },
    ],
  },
  {
    slug: "how-to-format-json-online",
    title: "How to Format JSON Online (Pretty Print and Validate)",
    description:
      "Pretty-print or minify JSON right in your browser with 2 or 4 space indentation, get a live validity check, and pinpoint parse errors by line and column. Nothing is uploaded.",
    keywords: [
      "format json online",
      "json pretty print",
      "validate json online",
      "json formatter free",
      "json minify online",
    ],
    toolSlug: "json-formatter",
    published: "2026-09-16",
    updated: "2026-09-16",
    readMinutes: 2,
    sections: [
      {
        heading: "What this formatter does",
        paragraphs: [
          "JSON Formatter pretty-prints JSON with 2 or 4 space indentation, updates as you type, and flags invalid input with the line and column where parsing stopped. A green badge confirms valid JSON; a red badge with an error message points to the first problem.",
          "Everything runs locally in your browser — your JSON never leaves your device, and the tool keeps working offline after the page has loaded once.",
        ],
      },
      {
        heading: "1. Paste your JSON",
        paragraphs: [
          "Copy raw or minified JSON from your clipboard, a terminal, or an API response and paste it into the input area. Formatting starts immediately, so there is no button to click.",
        ],
      },
      {
        heading: "2. Choose an indent size",
        paragraphs: [
          "Use the 2 spaces or 4 spaces buttons to switch indentation. The formatted output and character count update immediately, and the minified version stays available below it.",
        ],
      },
      {
        heading: "3. Check validity",
        paragraphs: [
          "Valid JSON is confirmed with a green badge. For invalid input the badge turns red and you get an error message with the line and column where parsing stopped — useful for spotting a stray comma, a missing quote, or a truncated paste.",
        ],
      },
      {
        heading: "4. Copy the result",
        paragraphs: [
          "Copy the readable formatted output with Copy formatted, or grab the compact single-line version with Copy minified. Both clipboard buttons work in any recent browser without extra permissions.",
        ],
      },
    ],
  },
  {
    slug: "how-to-encode-a-url",
    title: "How to Encode a URL or URL Component Online",
    description:
      "Turn any URL or query value into safe %hex form — or decode it back — right in your browser. Learn when to encode only the component and when to keep a whole URL intact.",
    keywords: [
      "how to encode a url",
      "encode url online",
      "url percent encoder",
      "encode url component online",
      "decode percent encoded url",
    ],
    toolSlug: "url-encoder",
    published: "2026-09-16",
    updated: "2026-09-16",
    readMinutes: 3,
    sections: [
      {
        heading: "What percent-encoding is for",
        paragraphs: [
          "URLs can only safely contain a narrow set of characters. Spaces, ampersands, question marks and non-ASCII text are ambiguous inside a URL — a space can be mistaken for a separator and an & for a query delimiter. Percent-encoding replaces each unsafe character with a % followed by two hex digits (so a space becomes %20) so the value survives parsing intact.",
          "This tool applies percent-encoding instantly as you type, entirely in your browser, so nothing is uploaded.",
        ],
      },
      {
        heading: "Component-level vs whole-URL encoding",
        paragraphs: [
          "There are two distinct jobs. Encoding a query value — say the user input in ?q= — should escape everything except the unreserved characters, using the same rules as JavaScript's encodeURIComponent: A–Z, a–z, 0–9 and - _ . ! ~ * ' ( ) stay unescaped, everything else becomes %hex. This is the default component-level mode.",
          "Encoding a full URL is different: you want the structure to survive, so reserved characters like :, /, ?, & and = should stay intact. That is whole-URL mode (encodeURI). Uncheck Component-level to switch to it.",
        ],
      },
      {
        heading: "Encoding and copying",
        paragraphs: [
          "Paste your string into the input area and the output appears immediately — there is nothing to click. Switch the Encode/Decode toggle to flip direction and use 'Use result as input' to re-encode or decode in one step.",
        ],
      },
      {
        heading: "Decoding back and avoiding double-encoding",
        paragraphs: [
          "To reverse an encoded string, switch to Decode. If the input contains a bare % that is not part of a valid %hex pair, decoding fails and a red error notice is shown instead of guessing.",
          "Don't re-encode an already encoded value: %20 encoded again becomes %2520, and you have to decode twice to get your original text back. Encode once, at the point of use.",
        ],
      },
    ],
  },
  {
    slug: "how-to-encode-and-decode-base64",
    title: "How to Encode and Decode Base64 Online",
    description:
      "Turn any text into Base64 and back — right in your browser. Learn when URL-safe Base64 (base64url) is required, how = padding works, and why decoded binary data isn't always readable as text.",
    keywords: [
      "how to encode base64",
      "base64 encode decode online",
      "base64 to text",
      "base64url",
      "decode base64 string",
    ],
    toolSlug: "base64",
    published: "2026-09-16",
    updated: "2026-09-16",
    readMinutes: 3,
    sections: [
      {
        heading: "What Base64 is for",
        paragraphs: [
          "Base64 maps bytes onto a safe ASCII alphabet of 64 characters — A–Z, a–z, 0–9, plus + and /. Text-only channels such as JSON fields, HTTP headers, API tokens, email attachments (MIME), and text-only database columns can't carry raw binary, but they can carry this alphabet, which is why encodings like these exist.",
          "This tool runs entirely in your browser: your text is encoded and decoded locally, and nothing is uploaded anywhere.",
        ],
      },
      {
        heading: "Padding and the URL-safe variant",
        paragraphs: [
          "Base64 works in groups of 3 bytes and produces 4 characters per group. When the input isn't a multiple of 3 bytes, = padding characters are appended so the encoded length stays a multiple of 4 — that's where the trailing = signs on some strings come from.",
          "The URL-safe variant (base64url) swaps + for - and / for _, and drops the = padding entirely. It's the format used inside JWT payloads and query strings. This tool outputs it when you tick URL-safe, and detects the - and _ characters automatically when decoding.",
        ],
      },
      {
        heading: "Decoding text vs binary",
        paragraphs: [
          "Decoding restores the original bytes and then interprets them as UTF-8 text. Plain text, JSON, and emoji round-trip exactly because they are valid UTF-8.",
          "Binary sources such as images and archives decode to bytes that aren't valid UTF-8, so no text renderer can show them meaningfully. Instead of printing replacement characters, this tool reports an error explaining that the bytes aren't text — for those files, use a dedicated binary tool like the image-to-Base64 converter.",
        ],
      },
    ],
  },
  {
    slug: "how-to-use-a-free-online-notepad",
    title: "How to Use a Free Online Notepad (Auto-Save, Private Notes)",
    description:
      "Write notes that auto-save in your browser — no sign-up, nothing uploaded. Learn the storage limits, how to export as .txt, and what happens if you clear your browser data.",
    keywords: [
      "online notepad",
      "notepad online",
      "auto save notes",
      "notes saved in browser",
      "keep private notes online",
    ],
    toolSlug: "notepad",
    published: "2026-09-16",
    updated: "2026-09-16",
    readMinutes: 3,
    sections: [
      {
        heading: "What auto-save actually means",
        paragraphs: [
          "Every keystroke is written to this browser's local storage on a short delay, so closing the tab or losing power doesn't lose your note. The note stays on this device and in this browser only — it is never uploaded and never syncs to another device.",
          "You'll see the confirmation in the corner of the editor: a live word and character count plus a 'saved at' time that updates as you type.",
        ],
      },
      {
        heading: "Making your notes portable",
        paragraphs: [
          "Click Copy to send the whole note to your clipboard in one step. Click Save to download it as a plain-text file with today's date in the filename — keep that file anywhere, or open it later.",
          "Open lets you load an existing .txt or .md file back into the notepad, so you can keep editing something you started elsewhere.",
        ],
      },
      {
        heading: "Limits and clearing data",
        paragraphs: [
          "Local storage is typically capped around 5 MB per site, and a single note is limited to about 2 million characters. Past that limit the auto-save can stop working, so download a .txt backup of anything important.",
          "Clearing your site data — or switching browsers, devices, or to a private window — removes your notes, and selecting Clear in the toolbar permanently deletes the local copy with no undo. Download important notes first.",
        ],
      },
    ],
  },
  {
    slug: "how-to-convert-text-to-pdf",
    title: "How to Convert Text to PDF (Free, No Uploads)",
    description:
      "Turn plain text into a word-wrapped A4 PDF in your browser. Learn what's preserved, how pagination works, and what this tool doesn't do.",
    keywords: [
      "convert text to pdf",
      "insert text into pdf",
      "txt to pdf",
      "make a pdf from text",
      "text to pdf converter free",
    ],
    toolSlug: "text-to-pdf",
    published: "2026-09-21",
    updated: "2026-09-21",
    readMinutes: 3,
    sections: [
      {
        heading: "What stays preserved",
        paragraphs: [
          "Paste your notes, letter, report, or code into Text to PDF and the tool word-wraps every paragraph to the page width. Each newline starts a fresh paragraph, bullets and basic punctuation like em-dashes and accented Latin letters are kept, and the document is laid out onto A4 pages with built-in margins.",
          "The PDF embeds basic Latin (WinAnsi) text only, which covers English and most Western European languages. If your text contains non-Latin characters — CJK, Cyrillic, Greek, Arabic, or emoji — the tool lists the exact characters you need to remove or replace before it builds the PDF, rather than silently dropping them.",
          "Plain paragraphs are re-flowed to fit the page width, so runs of spaces or tabs are normalized as the text wraps. For rich formatting like headings, bold, or lists, convert Markdown to HTML first, then use HTML to PDF for the styled result.",
        ],
      },
      {
        heading: "Choose a font size",
        paragraphs: [
          "Use the font-size slider to set type between 10 and 24 points (13 points by default). Line spacing and text width follow the size you pick, and the preview count below the box updates live as you type.",
          "Input is capped at 500,000 characters. The counter below the text box shows your current length and flags the cap so a very long paste is rarely a surprise.",
        ],
      },
      {
        heading: "Download and open",
        paragraphs: [
          "Press Download PDF and the file saves to your device as text.pdf. It opens in any PDF viewer and prints cleanly because the output is a standard PDF built at exact A4 page geometry.",
          "Everything runs locally: your text is laid out and rendered into the PDF in your browser and is never uploaded to a server.",
        ],
      },
    ],
  },
  {
    slug: "how-to-convert-pdf-to-excel",
    title: "How to Convert a PDF Table to Excel (XLSX or CSV)",
    description:
      "Turn a text-based PDF's tables into a spreadsheet. Learn which PDFs convert cleanly, how the column detection works, and when to run OCR first.",
    keywords: [
      "pdf to excel",
      "convert pdf to excel",
      "pdf to xlsx",
      "pdf to csv",
      "extract table from pdf",
    ],
    toolSlug: "pdf-to-excel",
    published: "2026-09-25",
    updated: "2026-09-25",
    readMinutes: 3,
    sections: [
      {
        heading: "Text-based PDFs only",
        paragraphs: [
          "PDF to Excel reads the embedded text layer of a PDF — the actual words a PDF editor put on the page. Documents created by Word, Excel, a browser's Print to PDF, or invoice and report software have such a text layer. Scanned or photographed pages do not: they are pictures, so there is nothing to read.",
          "If you select a scanned PDF, the tool tells you and points to PDF OCR. Run OCR there first, then convert the recognized text file to spreadsheets here, or simply reuse the OCR tool's .txt output.",
        ],
      },
      {
        heading: "How the columns are detected",
        paragraphs: [
          "The tool groups the page's words into lines by their vertical position, using the exact text coordinates the PDF stores rather than the visible table rules. Because gridlines themselves are ignored, it is this positioning that defines the table.",
          "A large horizontal gap between words — more than about 24 points, roughly a third of an inch — starts a new column. Uniform tables with clearly separated columns convert cleanly. Columns that butt against each other, spanning cells, or rows that merge across columns come out differently than the visual layout and usually need a quick cleanup in Excel.",
        ],
      },
      {
        heading: "Download, then check the data",
        paragraphs: [
          "Every extracted cell is exported as text: a cell that looks like a number is a label, not a numeric value, so sums and charts may need a one-step conversion in Excel (select the column, then convert text to numbers). This is deliberate — values are never interpreted as formulas, so a pasted dashboard formula from the PDF cannot run unexpectedly on open.",
          "Preview the grid on the page first; the preview shows the first 200 rows. Large documents are capped at 100 MB and 200 pages, keeping the conversion fast and the tab responsive. Nothing is uploaded — the whole conversion runs in your browser.",
        ],
      },
      {
        heading: "When the extraction looks wrong",
        paragraphs: [
          "Two common causes: the PDF uses a multi-column page layout where side-by-side columns interleave into one line, or the source PDF was generated in a way that made its text coordinates unreliable. For tightly designed layouts, consider running OCR first for a flatter text stream, then converting that text here.",
        ],
      },
    ],
  },
  {
    slug: "how-to-convert-pdf-to-markdown",
    title: "How to Convert a PDF to Markdown (.md)",
    description:
      "Extract a PDF's text layer into Markdown for docs, wikis, READMEs and LLM prompts. Learn what the tool preserves, when to run OCR first, and how to avoid scrambled layouts.",
    keywords: [
      "pdf to markdown",
      "convert pdf to markdown",
      "pdf to md",
      "pdf to text online",
      "extract markdown from pdf",
    ],
    toolSlug: "pdf-to-markdown",
    published: "2026-09-25",
    updated: "2026-09-25",
    readMinutes: 3,
    sections: [
      {
        heading: "A text extractor, not a visual replica",
        paragraphs: [
          "PDF to Markdown reads the embedded text layer of a PDF and re-flows it into Markdown: words are grouped into lines by their on-page position, blanks are kept as paragraph breaks, and short lines are offered as headings or bullets where the pattern justifies it. It is best suited to reports, papers, specs and documentation that already have a clean text layer.",
          "Because headings and lists are guesses, the tool says so — the .md is a text document you can edit, not a substitute for the original layout. Bold, italic, links, images, tables and code blocks are not preserved. For a closer visual match, convert to PDF to Word instead.",
        ],
      },
      {
        heading: "Pick a text-based PDF",
        paragraphs: [
          "Choose a file whose words you can already select and copy — that is the text layer doing the work. Password-protected files must be unlocked first with PDF Unlock. If you can't select any text on the page, it is a scan: there is no text layer, the pages are marked as having no text, and the tool links to PDF OCR to recognize the content first.",
          "Single-column documents convert most reliably. Two-column layouts and rotated pages can interleave or mirror the reading order despite the tool's rotation-aware sorting. When ordering matters and the layout is complex, review the preview before trusting the file.",
        ],
      },
      {
        heading: "Use the output",
        paragraphs: [
          "Download the .md for READMEs, wikis, note apps or to feed into an AI tool, or download the .html rendering of the same extract for quick reading. A page separator (---) marks where each PDF page ended, and pages with no extractable text are skipped with a note in the UI.",
          "Nothing is uploaded. The PDF is parsed and re-flowed entirely in your browser, within a 100 MB and 200-page cap.",
        ],
      },
    ],
  },
  {
    slug: "how-to-ocr-a-pdf",
    title: "How to OCR a PDF (Turn Scans into Text)",
    description:
      "Recognize printed text in scanned PDFs with browser-based Tesseract OCR in 12 languages. Learn what OCR can and can't do, and when PDF to Text is the better tool.",
    keywords: [
      "ocr pdf",
      "ocr pdf online",
      "scan pdf to text",
      "extract text from scanned pdf",
      "tesseract ocr",
    ],
    toolSlug: "pdf-ocr",
    published: "2026-09-25",
    updated: "2026-09-25",
    readMinutes: 3,
    sections: [
      {
        heading: "Is OCR the right tool?",
        paragraphs: [
          "OCR recognizes text in pages that have no readable text layer — scans, photographs, and faxes. The test is simple: if you cannot select or copy the words on the page, the text is trapped inside images and OCR is the right tool.",
          "If you can already select the words, the PDF has a text layer and PDF to Text will convert it exactly and instantly. OCR of a text-based PDF would slow things down and introduce recognition errors for no benefit — the tool even notices and suggests the faster route.",
        ],
      },
      {
        heading: "What OCR can and cannot do",
        paragraphs: [
          "OCR turns each page image into text via Tesseract. Printed documents at a decent scan resolution (150–300 DPI) usually recognize almost everything. Blurred pages, unusual fonts, handwriting, and low-resolution scans will have errors, so always skim the result before relying on it.",
          "The output is a plain-text result you copy or download as .txt. Your original PDF is never modified, and the tool does not embed a text layer back into it. If you need the text inside a new PDF, paste the recognized text into Text to PDF, or open it in a word processor and export a fresh PDF.",
        ],
      },
      {
        heading: "Choose the language",
        paragraphs: [
          "Pick the document's main language from the 12 supported: English, Spanish, French, German, Italian, Portuguese, Russian, Hindi, Arabic, Chinese (simplified), Japanese and Korean. The first run of a language downloads that language's recognition model (~1.5–3 MB) into your browser from this site and caches it, so later runs are instant.",
          "OCR is fully client-side: your PDF is rendered and recognized in your browser and never uploaded. Files up to 100 MB and 200 pages are supported; the model download on first use needs an internet connection.",
        ],
      },
      {
        heading: "After OCR",
        paragraphs: [
          "Skim the per-page result, fix obvious misreads, then copy or download. Because each page is recognized independently, a page marker (--- Page N ---) keeps the reading order clear in the .txt. Multi-column pages may read across both columns in each line; if the layout is complex, editing order in the text is usually faster than re-rendering.",
        ],
      },
    ],
  },
  {
    slug: "how-to-compare-pdfs-online",
    title: "How to Compare Two PDF Files for Changes",
    description:
      "Find out what changed between versions of a PDF by comparing their text layers page by page, in your browser. Learn what a text diff catches, what it misses, and how to read the results.",
    keywords: [
      "compare pdf online",
      "pdf diff",
      "compare two pdf files",
      "what changed between pdfs",
      "pdf comparison",
    ],
    toolSlug: "pdf-compare",
    published: "2026-09-25",
    updated: "2026-09-25",
    readMinutes: 3,
    sections: [
      {
        heading: "What a text diff actually compares",
        paragraphs: [
          "PDF Compare reads the embedded text layer of each PDF — the words a PDF editor actually stored on the page — and checks them line by line against the original you select. Lines found only in the original are marked removed (red); lines found only in the revised file are marked added (green). Everything is matched page by page, on the shortest shared page count.",
          "Because the comparison is text-based, it is not a visual diff. A paragraph that changed font or color, an image that was swapped, a margin that was nudged, or a table's gridlines are not reported unless their words changed too. Scanned pages have no text layer at all, so they compare as empty and unchanged. That is by design: the tool only claims to compare words, not pixels.",
        ],
      },
      {
        heading: "Add the files and pick the original",
        paragraphs: [
          "Use Add PDF to choose two to five PDFs, up to 100 MB and 200 pages each. The first file you add becomes the original, but you can select Original on any file in the list before comparing. Every other file is then compared against it.",
          "Encrypted or password-protected PDFs are rejected the moment you add them — unlock such files with PDF Unlock first. A file that is not a real PDF, or one with more than 200 pages, is also rejected up front so you are never left wondering why comparison failed.",
        ],
      },
      {
        heading: "Compare and read the results",
        paragraphs: [
          "Click Compare PDFs. Each revised file gets its own result card with a page-by-page view. Green lines are additions, red lines are removals, and unchanged lines stay neutral. Flip the page numbers to move through the document, turn on Only show changed lines to skip the noise, and use the ignore-case or ignore-whitespace options when drafts differ only in capitals or spacing.",
          "Reordered text is reported as removed plus added: line matching is position-aware, so a paragraph that moved pages shows up as a removal on one page and an addition on another. If one file has more pages than the other, only the shortest shared page count is compared, and the tool says so.",
        ],
      },
{
        heading: "Download the report and check the rest",
        paragraphs: [
          "Download diff report (.txt) saves every change against every revised file, named after the original, for sharing or an audit trail. Because covers and empty pages can shift matches, skim the marked lines before relying on them, and re-check anything the comparison cannot see — images, fonts and layout — visually in the two PDFs.",
        ],
      },
    ],
  },
  {
    slug: "how-to-auto-redact-pdf-online",
    title: "How to Auto-Redact a Name or Number Everywhere in a PDF Online",
    description:
      "Find every occurrence of a name, account number, email or phrase across a PDF and cover each match with a black box — case-insensitive by default, with a preview and confirm step before anything is drawn.",
    keywords: [
      "auto redact pdf",
      "automatically redact a pdf",
      "black out words in a pdf",
      "redact names in a pdf",
      "cover sensitive text in a pdf",
      "pdf redaction online",
    ],
    toolSlug: "pdf-auto-redact",
    published: "2026-09-25",
    updated: "2026-09-25",
    readMinutes: 4,
    sections: [
      {
        heading: "What auto-redaction actually does",
        paragraphs: [
          "Auto-Redact PDF searches a document's text for a word, phrase or regex and draws a solid black box over every match. The boxes keep text from being seen, selected, copied or searched in a normal PDF viewer, which is exactly what you want when a client name or invoice number appears ten times across a long contract.",
          "Be clear about the boundary: the boxes sit on top of the text. The covered words still exist below them in the file, and document metadata such as author, title and creation date is not touched. This is a visual cover, not a forensic erasure. If content must be truly destroyed rather than just hidden, the Redact PDF tool and a proper review workflow are the right choice — and verify the output either way.",
        ],
      },
      {
        heading: "What the search can and can't see",
        paragraphs: [
          "Matching reads the PDF's text layer, so it can only find words the file actually stores as text. Scanned pages keep words as images and can't be searched — run PDF OCR first and auto-redact the recognized copy. Some fonts draw characters as outlines rather than text, and a few PDF exports split a phrase across several text runs; those cases can be missed. Check the red preview before confirming.",
          "Search is case-insensitive by default: 'john smith' finds 'John Smith' too. Turn on Case-sensitive for exact case, Whole word only to ignore partial hits like '48' inside '48102', or switch to regex mode for patterns such as account-number shape.",
        ],
      },
      {
        heading: "Search, review, then confirm",
        paragraphs: [
          "Open a PDF up to 100 MB and 200 pages, type your term, and click Find matches. Pages with hits are shown with a red highlight over each match plus a per-page count, so you can flip through and see exactly what would be covered before anything is drawn.",
          "A match anywhere inside a text chunk covers the whole chunk with one padded box. That is deliberately conservative — coverage is slightly larger than the match — but it means a box can cover a few nearby words too. When the match list looks right, click the confirm button and download a new file named <source>-redacted.pdf. Your original is never modified.",
        ],
      },
      {
        heading: "Budget, privacy, and the verify step",
        paragraphs: [
          "Each run is capped at 100 MB, 200 pages and 100 matches, and the confirm step stops you from blacking out the wrong page by accident. If more than 100 matches exist, only the first 100 are listed — narrow your term or regex, and the tool says so before you confirm.",
          "Everything runs in your browser; the PDF and the terms you search for never leave your device. Keep your original untouched, share only the redacted copy, and before you send it, open the downloaded file and confirm the covered text can't be selected or searched.",
        ],
      },
    ],
  },
  {
    slug: "how-to-flatten-a-pdf",
    title: "How to Flatten a PDF Online (What You Lose, and the File Size)",
    description:
      "Flatten a PDF by turning every page into one image — the text stops being selectable, searchable or editable, and the file usually gets bigger. Picks the right DPI first.",
    keywords: [
      "flatten pdf",
      "flatten pdf online",
      "rasterize pdf",
      "how to flatten a pdf",
      "make pdf non editable",
    ],
    toolSlug: "pdf-flatten",
    published: "2026-09-26",
    updated: "2026-09-26",
    readMinutes: 4,
    sections: [
      {
        heading: "Flattening means rasterizing, not hiding",
        paragraphs: [
          "Flattening a PDF means rendering every page to a picture and building a new file in which that picture is the whole page. Nothing is hidden behind an overlay and nothing is left selectable: the text is drawn into the image, so it can no longer be selected, searched, copied, edited or re-flowed in any reader. That is the honest promise of flattening — a fixed record of what the page looked like when you flattened it.",
          "The same thing happens to everything else that lives on the page. Links, form fields and their filled-in values, comments, highlights, stamps, annotations, optional-content layers and hidden text all become part of the picture. The rebuilt file is also a new document, so the source's bookmarks and its metadata — author, title, producer, creation date — are not carried over. If you need any of that afterwards, keep the original: flattening cannot be undone from the output.",
        ],
      },
      {
        heading: "Why the file gets bigger, and which DPI to pick",
        paragraphs: [
          "Vector text is extremely compact; a rendered picture is not. A page that weighed a few kilobytes of text can become several hundred kilobytes of image, so a flattened copy of a long document is regularly several times the size of the original. That cost buys the loss of the text layer, so it is only worth paying when you specifically need a picture-only file.",
          "Three raster settings are offered, and each one is a real trade-off. Screen renders at 96 DPI as JPEG for the smallest file, fine for reading on a screen but soft on small print. Balanced, the default, renders at 150 DPI as JPEG and suits everyday viewing and email. Print renders at 200 DPI as lossless PNG — the sharpest and by far the largest. Screen and Balanced are lossy JPEG, so very small type can show compression artifacts when you zoom in; only Print is lossless. An unusually large page is rendered below the chosen DPI to stay inside the browser's canvas limit, and the tool reports how many pages were affected instead of failing.",
        ],
      },
      {
        heading: "Flattening the document",
        paragraphs: [
          "Open the PDF in the tool and it reports the page count. Files up to 100 MB and 200 pages are supported; a password-protected file cannot be opened here, so remove the password with the PDF Unlock tool first and flatten the unlocked copy. Choose a raster setting, then click Flatten: each page is rendered on your device and the new PDF is assembled with one image per page, so you can watch it work page by page.",
          "Everything happens in your browser. The PDF is never uploaded, and your original file is not modified — every run produces a separate download named <source>-flattened.pdf. A rotated page is flattened in the orientation you see it, and every page keeps its own dimensions, so the output reads the same as the input even though the underlying content is gone.",
        ],
      },
      {
        heading: "Download, then check before you send it",
        paragraphs: [
          "After the run you get the output size and how it compares with the original — check that first, because a much larger file is the normal outcome rather than a fault. Open the flattened copy in a desktop reader and confirm the text can no longer be selected or searched, and that the pages still look right at the zoom level you need. This tool does not add an OCR text layer back, so if you need searchable text as well, keep the original and run PDF OCR on it instead.",
          "Share only the flattened copy, and keep the original file if you might still need to read, copy or edit the text. Flattening is irreversible from the output, and the absence of a text layer also means screen readers and copy-paste workflows no longer work on that file — a real accessibility cost worth weighing before you lock a document down.",
        ],
      },
    ],
  },
  {
    slug: "how-to-remove-annotations-from-a-pdf",
    title: "How to Remove Annotations, Comments and Form Fields from a PDF",
    description:
      "Strip the markup layer off a PDF in your browser — comments, highlights, stamps, links and form fields — with the honest catch about filled form values.",
    keywords: [
      "remove annotations from pdf",
      "delete pdf comments",
      "remove highlights from pdf",
      "remove pdf form fields",
      "remove pdf hyperlinks",
    ],
    toolSlug: "pdf-remove-annotations",
    published: "2026-09-26",
    updated: "2026-09-26",
    readMinutes: 4,
    sections: [
      {
        heading: "What counts as an annotation",
        paragraphs: [
          "In a PDF, review markup is not part of the page. Comments, highlights, underlines, strikeouts, sticky notes, stamps, popups and hyperlinks all live in a separate annotation layer, and interactive form fields sit in that same layer as widget annotations. Removing annotations therefore means emptying that layer, which is why one button can clear all of those things at once — and why form fields are affected unless you ask for them to be kept.",
          "The page itself is a separate content stream. This tool does not touch it, so the text, images, layout, fonts, bookmarks, file attachments and document metadata all survive unchanged. It is not a re-render and not a rasterization: the output is the same PDF with a cleaner structure.",
        ],
      },
      {
        heading: "Check what is in the file first",
        paragraphs: [
          "Open the PDF and read the report before you remove anything. You get the total annotation count, a per-page breakdown showing which pages are marked up, and a split by kind — markup, links, stamps and form fields. That split is the part worth pausing on, because it is where surprises show up.",
          "If the tool reports 40 annotations and 3 of them are form fields, the default run removes all 40 of them, not just the 37 comments and links, because the fields are annotations too. If the file is filled in and you need those fields to stay usable, tick the keep-form-fields box first; only the review markup goes, and the fields remain fillable. If every annotation in the file is a form field, keeping them means there is nothing left to remove, and the tool says so instead of handing you an unchanged copy.",
        ],
      },
      {
        heading: "The filled-in value catch",
        paragraphs: [
          "This is the one behaviour that surprises people, so it is worth being precise about. When someone types a value into a form field, the value is usually stored inside the field, and the visible text you see on the page is generated from it as an appearance stream that belongs to the field. Remove the field and both go: the stored value and the drawn text.",
          "If the form was flattened before you got the file — the value had already been painted into the page content — then the value is ordinary page text and it stays put, because the page was never modified. So a filled field keeps its value only when that value was already drawn onto the page. If you need the values preserved, either keep the form fields, flatten the form first with PDF Flatten, or read the values out with a form-field tool before removing anything.",
        ],
      },
      {
        heading: "Run it and download the clean copy",
        paragraphs: [
          "Press the remove button. It states the exact number of annotations it is about to strip, and the download happens only after you confirm, so nothing is removed by surprise. The output is named after your source file with -no-annotations.pdf appended, and the result panel reports how many objects were found, how many were removed, how many form fields stayed, the output size and how that compares with the original. If the download is lost, the same file can be fetched again from that panel without re-running the tool.",
          "The annotation objects are dropped from the document structure rather than merely hidden, so no reader will display them again, and the objects those annotations owned — popups, reply threads, appearance streams — are pruned from the file as well. A small amount of unreferenced data can still survive in the raw bytes of any rewrite; no conforming reader shows it, but it is the reason this tool does not promise a forensic scrub. There is no undo after the download, so keep the original if the comments may matter later.",
        ],
      },
      {
        heading: "What this tool does not do",
        paragraphs: [
          "It is not a redaction tool. It empties the annotation layer and leaves the page content alone, which is the right job for cleaning up a review copy and the wrong job for removing sensitive information: text that was already drawn on the page, or hidden inside a page, is not touched at all. Use PDF Redact for that, and re-check the result in a reader before you share it.",
          "It cannot be undone, and it is not signature-preserving. Deleting a single comment changes the file, so a digitally signed PDF comes out of this tool no longer signed — the signature covered the bytes that were there before, and those bytes are gone. A dynamic (XFA or JavaScript) form is the other special case: its field data and its fill-in behaviour live in the same AcroForm entry the fields live in, so removing the fields removes that entry and the form stops behaving like a form. Flatten such a document first, or read the values out before stripping it.",
        ],
      },
      {
        heading: "Limits, and what to do about them",
        paragraphs: [
          "The tool accepts files up to 100 MB and 200 pages, and it says so before it starts rather than failing halfway through. Password-protected PDFs are outside its scope: remove the password with PDF Unlock, then strip the annotations. Documents that are scanned images carry no annotations to remove, and nothing is added to them — if you are looking for text in a scan, that is PDF OCR's job.",
          "All of the work happens in your browser. The PDF, including every comment inside it, stays on your machine and nothing is uploaded, which matters most for exactly the documents people most want cleaned up: contracts under review, internal drafts and anything with a comment thread you would rather not send to a third-party server.",
        ],
      },
    ],
  },
  {
    slug: "how-to-ocr-an-image",
    title: "How to OCR an Image (and What It Gets Wrong)",
    description:
      "Read the printed text out of a photo, screenshot or scan in your browser. Learn what OCR actually does, why a big phone photo loses characters, and what to fix before you trust a result.",
    keywords: [
      "how to ocr an image",
      "ocr an image online",
      "how to extract text from an image",
      "image to text converter",
      "why is my ocr wrong",
    ],
    toolSlug: "image-ocr",
    published: "2026-09-28",
    updated: "2026-09-28",
    readMinutes: 5,
    sections: [
      {
        heading: "What OCR is, in one paragraph",
        paragraphs: [
          "Optical character recognition does not read. It guesses. The engine looks at shapes of dark pixels on a light background, compares each one against a model of how thousands of printed characters are shaped, and returns whichever characters it thinks it saw, along with a score for how sure it is about its own guesses. There is no understanding of your document, no dictionary of your company's names, and no second pass that notices a total is wrong. That is why every OCR tool on the market, including this one, needs you to read the result over.",
          "Image OCR runs Tesseract as a WebAssembly build inside your browser tab. The image is decoded and recognized on your own device and is never uploaded, and the engine, its WebAssembly core and the language model are all served from this site's own origin rather than a third-party CDN. The model for the language you pick is downloaded the first time you use that language and cached by your browser afterwards.",
        ],
      },
      {
        heading: "What the tool does before it reads a single character",
        paragraphs: [
          "It checks three things, and each of them saves you a confusing failure later. The format is confirmed from the file's own header bytes rather than its name, so a .png that is really a text file or a truncated download is refused immediately with that reason instead of dying somewhere inside the recognizer. The file size is compared against a 25 MB cap. And the dimensions are read from the header and checked against a 16-megapixel budget and an 8192 px limit on the long side.",
          "All three caps are refusals, not adjustments. A 20-megapixel photo is rejected with its real numbers, not quietly shrunk to fit — which means the file that gets read is the file you chose, at the size it actually is. If you hit a cap, the fix is on your side: crop to the text you want, or downscale a very large photo, and re-open it.",
        ],
      },
      {
        heading: "Why a 12-megapixel photo reads worse than a cropped scan",
        paragraphs: [
          "The single biggest cause of bad OCR is not a bad engine, it is a big input. Tesseract works on a page image scaled to roughly 300 DPI. Hand it a 4000-by-3000 photo of a page and it downsamples to its working size before it looks at anything — which throws away exactly the fine detail that distinguishes a comma from a full stop, a 1 from a 7, or an O from a 0. The characters that survive the downsample are the ones that were large to begin with; small print in a footer is the first thing to go.",
          "So the ranking of inputs, best first, is: a scan or export at about 300 DPI, cropped to the text; a flatbed or phone-scanner scan at that resolution; a screenshot taken at native resolution; a phone photo of a printed page, which is fine if it is square-on and evenly lit and poor if it is not. The engine also assumes the text is horizontal, dark on light and not rotated — deskew a scan and it gets noticeably better.",
        ],
      },
      {
        heading: "The five things that reliably break it",
        paragraphs: [
          "Skew and perspective: a page photographed at an angle is the most common failure, because the engine models a flat, straight baseline. Shadows and uneven lighting produce gradients across the page, and a gradient is a character as far as the recognizer is concerned. Low contrast — grey text, a faded photocopy, a screenshot with light-grey helper text. Stylised and decorative fonts, where the recognizer has never seen the shapes in training. And handwriting, which is a different problem entirely: the models shipped here are trained on printed text, and cursive or joined-up writing is not what they are looking for.",
          "One more that is not the image's fault: EXIF rotation is not applied. A photo taken in portrait and stored with a rotation flag is handed to the recognizer sideways, and it will return sideways text. Rotate the image before you open it, or accept that the output needs turning.",
        ],
      },
      {
        heading: "Reading the result, including the confidence number",
        paragraphs: [
          "Every run reports the engine's own confidence score alongside the text, with a plain description of what the band means. Read that number for what it is: the recognizer's opinion of how plausible its guesses were, averaged over the page. It is not a percentage of characters that are correct, and there is no OCR tool anywhere that can give you that, because the engine has no idea which of its guesses were wrong. A high score on a page with unusual words is not a guarantee, and a middling score on a very clean page often still reads perfectly.",
          "The result panel gives you character, word and line counts and the elapsed time, and the text is cleaned up before you see it — Windows and form-feed line breaks become plain newlines, trailing spaces are trimmed and runs of blank lines collapse. Copy puts that text on your clipboard; Download writes the same bytes to a file named <image>-ocr-<language>.txt. If the result comes back empty, that is reported as a result rather than a silent failure, with the fixes that usually help: a larger, straighter, better-lit scan of the same page.",
        ],
      },
      {
        heading: "What this is not",
        paragraphs: [
          "It is not a document scanner, a form filler or a data extractor. It does not find invoice totals, read a table into columns, sort the lines into reading order for a multi-column page, or tell you which of two candidate readings is the right one — Tesseract is LSTM-based here, so it produces one guess per line, not a confidence-ranked list. It does not do handwriting. It does not OCR inside a PDF (that is a separate job, because a PDF needs its pages rasterized first), and it does not accept HEIC, AVIF, TIFF or SVG, which are not in the five supported formats.",
          "All of the work happens in your browser. The image is read locally, recognized locally and saved locally, which matters most for exactly the documents people most want scanned: contracts, payslips, medical letters, ID cards and anything under review before it goes out. If you need higher fidelity than a single offline pass can give you — archival scanning, batch processing, layout-aware extraction — that is a different tool, and this one will not pretend otherwise.",
        ],
      },
    ],
  },
  {
    slug: "how-to-scale-pdf-pages",
    title: "How to Scale PDF Page Size Without Cropping or Blurry Text",
    description:
      "Scale every page of a PDF by one percentage in your browser. Learn what a page scale really changes — page boxes, content and annotations — and what it does not do.",
    keywords: [
      "scale pdf",
      "scale pdf pages",
      "resize pdf pages",
      "change pdf page size",
      "make pdf page smaller",
    ],
    toolSlug: "pdf-scale-pages",
    published: "2026-09-27",
    updated: "2026-09-27",
    readMinutes: 4,
    sections: [
      {
        heading: "What a page scale actually changes",
        paragraphs: [
          "A page in a PDF is not one object. It is a coordinate system holding several page boxes, a content stream of drawing operators, and an annotation layer — and a reader only shows you what those three agree on. Scaling a page therefore means moving all three by the same factor, and the tool does exactly that: every box a page defines (media, crop, bleed, trim and art) is multiplied by the factor, the content stream is scaled, and annotation geometry — link rectangles, comment boxes, ink strokes, form-field widgets — is scaled with it.",
          "This is why the result is a genuine page rather than a stretched picture. Nothing is cropped, the proportions are untouched, and because the content is scaled rather than re-rendered as an image, the text stays real text: selectable, searchable and copyable afterwards. A page rotation (the 90 or 270 degree flag a scanner or an exported file carries) is left exactly as it was, and it is honoured when the before/after sizes are reported, so a landscape-looking page is measured the way you see it.",
        ],
      },
      {
        heading: "Uniform means uniform: it is not a page-size converter",
        paragraphs: [
          "One uniform factor is applied to width and height together, from 10% to 400%. That is deliberate: a single factor cannot distort anything, so the aspect ratio of every page is preserved — half an A4 page is still the same shape as A4, just smaller. The preview shows the real before and after size in PDF points and inches, and names the paper size when the result lands on one, so you can see whether 50% of your page is worth choosing before you download anything.",
          "What this is not is a paper-size converter. Turning a Letter page into A4 changes the proportions of the sheet, and that is a different job: use a page-size or crop tool for it. The same goes for shrinking one axis only, which would stretch the layout. If your goal is a different aspect ratio — a wide page for a screen, a narrower column for a booklet — a uniform scale will not get you there.",
        ],
      },
      {
        heading: "Running the scale and downloading",
        paragraphs: [
          "Open the PDF and the tool reports the page count, the file size and the first page's dimensions. Type a percentage or drag the slider — 50%, 75%, 150% and 200% are one click away — and the resulting page size updates live before anything is written. Press scale and the file is processed on your device: files up to 100 MB and 200 pages are supported, and a password-protected file is refused with a pointer to PDF Unlock rather than being written out in a broken state.",
          "The download is named <source>-scaled-<percent>pct.pdf, and the result panel reports the new size of page 1, the output size and how it compares with the original. If the document mixes page sizes — a cover in Letter and a wide appendix — every page still gets the same factor, and the panel says so instead of implying a single uniform result. If the download is lost, the same file can be fetched again from that panel without re-running the tool.",
        ],
      },
      {
        heading: "Limits, and what to check afterwards",
        paragraphs: [
          "Two honest caveats. First, a digital signature covers the exact bytes that were signed, so re-saving a page invalidates it — if the file is signed, expect to sign the scaled copy again. Second, an interactive form field is kept with its value, but its appearance is scaled along with its box rather than re-rendered for the new size, which is what makes a filled field shrink with the page. Neither is a data loss, but both are worth knowing before you re-issue a signed or heavily filled document.",
          "Open the scaled copy in a desktop reader and check a text page, a table and any form before you send it — very small percentages (under about 25%) make body text hard to read even though it is still perfectly sharp, and percentages above roughly 200% produce a page larger than most printers can print. Keep the original if you may need the old page size, because scaling is not reversible from the output. All of the work happens in your browser: the file is read, scaled and saved on your device, and nothing is uploaded.",
        ],
      },
    ],
  },
  {
    slug: "how-to-overlay-pdfs-online",
    title: "How to Overlay One PDF on Another (Stamp, Letterhead, Watermark)",
    description:
      "Stamp a PDF onto another in your browser — every page or a range, with position presets, PDF-point offsets and opacity. Learn what an overlay really does, and what it does not do.",
    keywords: [
      "overlay pdf",
      "overlay pdf online",
      "stamp pdf onto another pdf",
      "add letterhead to pdf",
      "watermark pdf with another pdf",
    ],
    toolSlug: "pdf-overlay",
    published: "2026-09-26",
    updated: "2026-09-26",
    readMinutes: 4,
    sections: [
      {
        heading: "What overlaying actually does",
        paragraphs: [
          "An overlay takes one PDF page and draws it on top of a page in another document. In PDF Overlay the stamp page is embedded into each target page as a form object and painted above the base page's content, so it travels with the page: an ordinary reader cannot select the stamp and delete it to reveal what is underneath, the way they can with an annotation added by an editor.",
          "It is not a merge. The two documents are not joined into a single reading flow, nothing is renumbered, and the base keeps its page count, text, links, annotations and form fields exactly as they were. The stamp sits above the base content; the base content itself is untouched. If you want pages combined into one long document, that is PDF Merge's job.",
        ],
      },
      {
        heading: "Position, offsets and opacity",
        paragraphs: [
          "Eight presets cover the usual cases: stretch the stamp across the whole page, or fit it to the page and anchor it centre, or to the top or bottom of the left, centre or right. Every preset except stretch scales the stamp to fit the page with its aspect ratio kept, so the shorter side sits flush with the page edge — which means a small logo is enlarged to fill the sheet. That is usually what you want for a watermark or a letterhead, and it is worth knowing before you wonder why a 200-point logo came out page-sized.",
          "The X and Y offsets nudge the anchored stamp in PDF points, positive right and up, and opacity runs from a faint 5% watermark to solid 100%. Opacity is one constant transparency applied to the whole stamp, not a fade across the page, and it never makes the content underneath translucent. The first page you are about to stamp renders as a live preview with a readout of the real geometry in points, so you can see the result before exporting. If a stamp would hang over an edge the preview says it will be cropped; if it would fall completely off the page the run is refused and names the page, so you never download a silently blank result.",
        ],
      },
      {
        heading: "Stamping every page, or just some",
        paragraphs: [
          "The default is every page. Switch to a page range and type numbers and ranges — 1-3,7 stamps pages 1, 2, 3 and 7 — and the tool validates as you type, showing you exactly which pages were selected and refusing a page past the end of the document. This is how you stamp an approved mark on the signature page of a contract, or a confidentiality footer on everything except the annexes.",
          "For a multi-page stamp, cycle mode pairs base page 1 with stamp page 1, base page 2 with stamp page 2, and wraps around when the stamp runs out, so a two-page stamp alternates across the base. First-page-only mode repeats one stamp everywhere. Every target page is measured against its own visible box, so a document that mixes portrait and landscape pages keeps each page's own proportions, and a page with a non-zero CropBox origin is stamped relative to the part of the page a reader actually sees. Placement is written in the page's own unrotated coordinates, which means a scanned page carrying a 90 or 270 degree page rotation turns its stamp along with the text on it — the stamp behaves like the page's own content rather than fighting it.",
        ],
      },
      {
        heading: "The honest limit: stamp text stays readable",
        paragraphs: [
          "An overlay is a real stamp, not a picture of one. If the stamp PDF contains real text — a typed DRAFT or a letterhead drawn in your word processor rather than exported as an image — that text is embedded as page content and stays visible, extractable and searchable in most readers. You can usually select it, copy it, and find it with in-document search. That is correct behaviour for a stamp, and it is exactly why an overlay is the wrong tool for concealing information.",
          "It is not a way to hide content. The base page underneath is completely unchanged, so anything the stamp covers is still there to be read, selected or found by search. To conceal text, use PDF Redact to stamp black boxes into the page, or PDF Flatten to rasterize every page into an image. And because an overlay is a working mark rather than a forensic seal, treat it as a visible, accountable mark on a page — not as tamper protection.",
        ],
      },
      {
        heading: "Limits, and what to do about them",
        paragraphs: [
          "Each file can be up to 100 MB and 200 pages, and the tool checks both before it starts rather than failing halfway through. Password-protected PDFs are outside its scope: remove the password with PDF Unlock, then stamp. A stamp that is itself a scanned image works fine — it is just placed as a picture rather than as text. One more limit worth knowing: the result is a re-saved file, so a digital signature on the base document does not survive the export. If the base is signed, expect to sign the overlaid copy again.",
          "All of the work happens in your browser. Both files are read locally, composited locally and saved locally; neither is uploaded, which matters most for the documents people most want stamped: unsigned contracts, internal drafts and anything under review before it goes out.",
        ],
      },
    ],
  },
  {
    slug: "how-to-edit-an-image-online",
    title: "How to Edit an Image Online (and What Changes Your Pixels)",
    description:
      "Crop, rotate, mirror, resize, adjust, filter and annotate an image in your browser. Learn which edits are exact, what a resize really does to detail, and what your file loses on the way out.",
    keywords: [
      "how to edit an image online",
      "image editor online",
      "crop an image in browser",
      "rotate image without losing quality",
      "resize image without uploading",
      "add text to an image online",
      "why did my exported image lose metadata",
    ],
    toolSlug: "image-editor",
    published: "2026-09-29",
    updated: "2026-09-29",
    readMinutes: 5,
    sections: [
      {
        heading: "What this editor does, in one paragraph",
        paragraphs: [
          "You open a PNG, JPEG, GIF, WebP or BMP file, and the browser decodes it into a canvas in this tab. From there you can crop it, rotate it in 90-degree steps, mirror it, resize it by a uniform percentage between 10% and 400%, adjust brightness, contrast and saturation, apply a filter, draw on it with a brush, line, rectangle, arrow or text tool, and download the result as PNG, JPEG or WebP. The image is decoded, edited and encoded on your own device. There is no request for your file, no account, and nothing to install.",
          "The format is confirmed from the file's own header bytes before the pixels are decoded, so a file that only claims to be a PNG is refused with that reason rather than failing somewhere inside a decoder. Inputs are capped at 25 MB, 16 megapixels (16 MP) and 8192 px on the long side, and every one of those is a refusal with your real numbers, not a silent crop or downsample.",
        ],
      },
      {
        heading: "Which edits are exact, and which one is not",
        paragraphs: [
          "Three of the operations move pixels and are therefore exact. Rotating by 90, 180 or 270 degrees is an exact rearrangement of the pixel grid. Mirroring is a flip of that grid. Cropping discards the pixels outside the rectangle you chose. None of the three resamples, so none of them softens the image, and none of them loses a single pixel that stays in the frame. A quarter turn swaps the sides, which is why a rotated landscape photo exports as a portrait file with the dimensions swapped rather than being squeezed.",
          "Resizing is the fourth operation, and it is the one that does resample. The tool uses the browser's own resampler, and enlarging an image means interpolating between the pixels you already have. You get a larger file with the same information in it, interpolated. That is not an AI upscaler, and no in-browser resampler is: a generative model would be guessing at detail that was never recorded. If you enlarge a photo and it looks soft, that is the honest result of the operation rather than a bug, and the number to watch is how far you push it.",
          "One scale is applied to both axes. A tool that let you set width and height independently could stretch a face or bend a straight wall, and this one does not offer those controls, so the aspect ratio of the frame survives every resize down to the last pixel.",
        ],
      },
      {
        heading: "A crop you set is kept, wherever you rotate afterwards",
        paragraphs: [
          "A crop is stored in the image's own pixel coordinates, not in screen coordinates, and the same is true of every annotation. That is the detail most editors get wrong in a way you only notice later: crop a photo, then rotate it, and a crop stored against the screen moves to a different part of the picture. Here the crop rectangle is carried through the rotation and mirror as a geometric transform of its four corners, so a quarter turn moves the crop with the pixels it was cutting out.",
          "Annotations behave the same way. A stroke, an arrow or a text stamp is recorded as coordinates in the image, so it is still in the same place after a later crop, rotation, mirror or resize, and it is stored in the file's output pixels so a thin line exports thin instead of fatter than it looked on screen. There is no separate layer for it either: annotations are baked into the same single canvas, which is why there is nothing to re-order and no PSD to save.",
        ],
      },
      {
        heading: "Why an over-budget export is refused instead of shrunk",
        paragraphs: [
          "If you ask for 400% on a frame that would come out at 48 megapixels, you have asked for a specific image. Silently handing back a smaller one is not a smaller version of the same request, it is a different file from the one you asked for, and a surprising one at that. So the output is capped at 16 megapixels and 8192 px per side, with a minimum of 8 px per side, and an export that does not fit is refused with the largest scale that would fit or the crop to make first. The last render that did fit stays on screen while the refusal is on it, and the download button stays clickable so it can repeat the reason in an alert rather than sitting there disabled and unexplained.",
          "This is the same philosophy as the input caps: the file that comes back is the file that was measured. If you need a specific large output, the honest route is to crop to the part you need and then scale, or to downscale in two steps of a known factor each.",
        ],
      },
      {
        heading: "What your file loses on the way out",
        paragraphs: [
          "Three things, all of which are invisible until someone opens the file in a different program. First, every download is encoded again from the pixels on screen. That is unavoidable in a browser editor, and it has one consequence worth stating plainly: re-exporting an untouched JPEG is a second lossy generation, and the file will drift a little further from the original each time. PNG is the only lossless choice here, and for a photo you intend to keep editing, exporting PNG between stages is the way to stop the drift accumulating.",
          "Second, nothing that is not pixels survives. The browser decodes the image, and the metadata goes at that moment: no EXIF, no camera, no GPS, no capture timestamp, and no ICC colour profile. The output is untagged sRGB, so a photo shot in a wide-gamut space can shift slightly in colour, and that shift is a conversion rather than a mistake. The one EXIF field that changes what you see is the orientation flag, and the browser does apply it on the way in, so a sideways phone photo arrives upright rather than needing a manual rotation.",
          "Third, animation is not carried through. A GIF or an animated WebP is decoded to its first frame, so an animated file becomes a still image of frame one and every later frame is lost. There is no frame picker, because there is no frame selection in a single canvas. If you need a specific frame, extract it first and open that instead.",
        ],
      },
      {
        heading: "Choosing a format, and the quality slider that only sometimes matters",
        paragraphs: [
          "PNG is lossless and keeps transparency, and it is the largest of the three. JPEG is lossy, has no transparency channel, and composites transparent pixels on white, so a cut-out PNG saved as JPEG gets a white background rather than a black one or a hole. WebP is lossy at the quality you set, usually smaller than JPEG at the same perceived quality, and it keeps transparency, so it is usually the better choice for the web.",
          "The quality slider is the encoder's own 0-to-1 argument, which is why it is disabled for PNG: there is nothing to lose, so a quality number would have no meaning. On the two lossy formats, 1.00 is the encoder's best effort and 0.30 is visibly soft. One more real detail: a canvas can refuse the format you asked for and hand back another. A browser without a WebP encoder returns a PNG from a WebP request, and rather than naming that file .webp this editor names it from the bytes that actually came back, and tells you the substitution happened.",
        ],
      },
      {
        heading: "What this editor is not",
        paragraphs: [
          "There are no layers, no PSD, no selection tools, no healing or content-aware fill, no clone stamping, and no AI of any kind. There is also no HEIC, AVIF or RAW support, so a photo straight out of an iPhone in HEIC has to be converted before it can be opened here, and a camera RAW needs its own converter first. The tool covers the everyday edits and does them locally, with nothing installed; for compositing, layer work or retouching, a full editor is the right tool.",
          "Everything here happens in your browser. The file is read locally, decoded locally, edited locally and saved locally. That matters most for the images people most want to edit privately: an unredacted contract, an internal mockup, a screenshot of something that has not been announced, or a passport photograph.",
        ],
      },
    ],
  },
  {
    slug: "how-to-convert-markdown-to-html",
    title: "How to Convert Markdown to HTML Online (Sanitized, Copy-Ready)",
    description:
      "Convert Markdown to HTML in your browser: CommonMark and GFM output, an allowlist sanitizer that runs before you copy, a preview of the exact same HTML, and a standalone .html download.",
    keywords: [
      "markdown to html",
      "convert md to html online",
      "markdown to html converter",
      "markdown converter online",
      "convert markdown to html",
      "markdown to html with preview",
    ],
    toolSlug: "md-to-html",
    published: "2026-09-28",
    updated: "2026-09-28",
    readMinutes: 4,
    sections: [
      {
        heading: "What the converter actually does",
        paragraphs: [
          "Markdown is a compact way to write a document; HTML is what a browser reads. Markdown to HTML puts a Markdown pane on the left and the generated HTML on the right, and it updates as you type. The parser is CommonMark plus the GitHub extensions, so you get headings, paragraphs, ordered and unordered lists, tables with header rows, fenced code blocks that keep their language as a class, task lists, strikethrough, blockquotes, links and images with alt text — the constructs that appear in a README, a changelog or a documentation page.",
          "The output is an HTML fragment, not a whole site: no <html>, <head> or <body>, and no stylesheet of its own. That is what you want when you are pasting into a CMS field, an email template, a JSX component or an existing page, because the fragment inherits the styles of whatever you drop it into. When you do want a file you can open on its own, the download button wraps the same fragment in a minimal standalone page.",
        ],
      },
      {
        heading: "The HTML is sanitized, and here is what that means",
        paragraphs: [
          "Markdown lets you write raw HTML, and that HTML is a real hole in a converter: a line of <script> in a README someone sent you would otherwise end up in your page. So the tool filters the whole result through an allowlist before it is displayed, copied or downloaded. Scripts, event handlers such as onclick, unsafe URLs including javascript: and data: values, iframes, <style> blocks, embedded SVG and form controls do not survive, and any tag outside the allowlist is unwrapped — its text stays, the tag goes. An <a> whose href was rejected keeps its words and loses the link. HTML comments and doctypes are dropped.",
          "Allowlisted inline HTML is kept, because plenty of legitimate Markdown uses it: <mark>, <sub>, <sup>, <kbd>, <abbr> and <del> all pass through unchanged. A <mark> in a tutorial or a <kbd> in a keyboard-shortcut table is exactly why you wanted a converter rather than a regex. What does not pass is anything that can execute or phone home, and the tool says so on the page rather than leaving you to trust it.",
          "Read the preview before you publish. A sanitizer is a filter over the HTML you wrote, not a guarantee about the page you are building: it cannot tell whether a heading level is right, whether a link points where you meant, or whether the fragment is safe in the specific place you are pasting it. A Content-Security-Policy is still the right defence for the page itself.",
        ],
      },
      {
        heading: "Copy, preview, and the standalone .html download",
        paragraphs: [
          "The HTML pane and the Preview tab are built from one string, so what you see rendered is exactly what you copy. That matters more than it sounds: converters that render from a different pass than they export regularly drift, and you end up debugging markup you never actually copied. Here, the same sanitized fragment feeds the pane, the preview, the clipboard and the file.",
          "Copy puts that fragment on your clipboard. Download writes it into a standalone document — a doctype, a charset tag, one inline stylesheet for readable tables, quotes, code and images, and no scripts at all — which you can open, hand to a colleague or drop into a static host. The filename comes from the file you opened if you opened one, so notes.md becomes notes.html, and the name field is editable. When you are pasting rather than opening a file there is no source name at all, so the default is the placeholder markdown.html and the tool labels it as one. Path separators and other characters that are unsafe in a filename are replaced.",
        ],
      },
      {
        heading: "The optional highlight tokens, described accurately",
        paragraphs: [
          "Reading a code block in a wall of raw HTML is unpleasant, so there is a checkbox that wraps fenced code in span elements such as <span class=\"tok tok-keyword\">. It is off by default, and that default is the honest choice: leave it off and the HTML you copy and download is clean, and turn it on when you are scanning a long snippet and want the keywords, strings, numbers and comments to stand out.",
          "The highlighter behind it is a small one built into the tool, not a full parser. It is regex-based and covers JavaScript, TypeScript, JSON, HTML, CSS, Python, shell, SQL, YAML and Markdown. On ordinary code it is genuinely useful; on unusual or deliberately obfuscated syntax it can mark something as a keyword that is not one, which is why it is opt-in and why the tokens are described as decoration rather than correctness. If you need exact, parser-grade highlighting for a language the tool does not know, keep it off and highlight in your editor.",
        ],
      },
      {
        heading: "Limits: the 200,000 character cap, and privacy",
        paragraphs: [
          "Input is capped at 200,000 characters. The editor stops accepting input at the cap and says so, and a file larger than that is refused with the limit spelled out rather than being silently truncated — a large specification or a whole documentation tree belongs in an editor with real file handling, not in a browser pane. The counters above the panes show characters in, words, characters of HTML out, the size of that HTML in bytes, and the heading count, so you can see what a conversion actually cost before you ship it.",
          "Everything runs in this tab. The Markdown, the generated HTML and any file you open with Open .md file are read locally and never uploaded; there is no server-side conversion step to leak anything to. A genuinely unparsable input — an unclosed fence, pathological nesting — surfaces as a plain message asking you to look at the structure rather than a blank pane or a stack trace, and empty input is simply an empty state, not an error.",
        ],
      },
    ],
  },
  {
    slug: "how-to-convert-html-to-image",
    title: "How to Convert HTML to an Image (PNG, JPEG, WebP) in Your Browser",
    description:
      "Render HTML to a PNG, JPEG or WebP at an exact 1x-4x device-pixel scale: a measured capture-box preview, a disclosed pixel budget, a 200 KB cap, and an honest account of what a canvas 2D re-draw does not reproduce.",
    keywords: [
      "html to image",
      "convert html to png online",
      "html to jpg converter",
      "html to webp converter",
      "capture div as image",
      "html snippet to image",
    ],
    toolSlug: "html-to-image",
    published: "2026-09-28",
    updated: "2026-09-28",
    readMinutes: 5,
    sections: [
      {
        heading: "What this converter actually does",
        paragraphs: [
          "You paste markup, choose a capture width, a scale and a format, and the tool re-draws that markup into an image and saves it. The capture width (240 to 1200 px) fixes the width of the box your content is laid out in, exactly as a container element would. The scale is the device-pixel multiplier, and it is the part most tools describe vaguely: at 2x, every CSS pixel is painted as two image pixels, so a 480 px wide box becomes a 960 px wide file. That is the same relationship between CSS pixels and device pixels that a retina display has, which is why 2x is the useful default for mockups, docs and anything with small text.",
          "Because that arithmetic is exact, the tool can show it to you before you commit. The projection under the scale control prints the output size in pixels, and it is calculated the way the renderer calculates it - floor(css size x scale) - so the number you read is the number the canvas is allocated. There is no separate vague quality slider and no hidden resampling step that quietly produces a different size from the one you asked for.",
        ],
      },
      {
        heading: "The pixel budget, and why the scale moves on its own",
        paragraphs: [
          "There is a ceiling on the canvas the browser will allocate, and this tool fixes it at 16 megapixels total and 8192 pixels on any single side. Those two numbers handle different failures: the pixel budget is what the browser refuses to allocate, and the side limit is what some canvas implementations cap independently. When your requested scale would break either one, the tool does not refuse the capture and it does not pretend. It lowers the scale to the largest value that fits, tells you the scale you asked for and the scale actually used, and still writes the file.",
          "Two things it will not do. It will never go below 1x, because rendering under 1x softens text to fake a size you did not request, and a smaller image quietly presented as the one you asked for is worse than an honest reduction. And if the content cannot fit the budget even at 1x, the capture is refused with the limit named, because at that point there is no honest scale left to offer. There is also a hard refusal for content wider than the capture box: the image is cropped to the box rather than reflowed, so the tool tells you the width you need instead of cropping a card in half.",
        ],
      },
      {
        heading: "Format, files, and the copy you get",
        paragraphs: [
          "PNG is lossless and the largest file, which makes it the right choice for UI, code, diagrams and flat colour. JPEG is lossy at quality 0.92 and has no transparency channel, so it suits photographs and gradients. WebP is lossy at the same quality, usually smaller than JPEG, and keeps transparency - but not every browser can encode it. If yours cannot, the canvas returns PNG instead; the tool says so, and the file is named after the bytes you actually received rather than the format you clicked, so the extension never lies about the contents.",
          "The file is saved automatically when the capture finishes, and the result panel then offers the same bytes two more ways: copy to clipboard, and download again. Re-downloading is not a second render - it writes the identical buffer under the identical name, so the file you attach to an issue is provably the file in the panel. The name comes from the file you opened, so invoice.html becomes invoice-2x.png; pasted markup has no source name and is called capture-2x.png. Anything a filename cannot contain is replaced rather than passed through.",
        ],
      },
      {
        heading: "What a re-draw reproduces, and what it does not",
        paragraphs: [
          "This is a re-draw, not a photograph of your screen. The renderer copies the page into an offscreen iframe, reads each element's computed style and repaints it with the canvas 2D API. That is why the layout is right: flexbox and grid are painted the way your browser already resolved them, inline styles and class rules apply, a <style> block is honoured, borders, box-shadow, text-shadow, linear and radial gradients, tables, list markers and ::before/::after all come through, along with any web font the page has already loaded.",
          "The same mechanism has real gaps, and they are listed on the tool itself rather than discovered afterwards. filter, backdrop-filter, mix-blend-mode, conic-gradient, the repeating gradients and object-fit are not painted. It does not use an SVG foreignObject, so content that depends on one will not survive. The output is composited on white, so a transparent PNG source still lands on white. An image served without CORS headers is left out of the capture rather than drawn blank, and a remote <img src> or CSS url() is fetched by your browser exactly as any page would fetch it. Finally, vw, vh and position: fixed resolve against the browser window rather than the capture width, so a layout that looks right in a full viewport can be cropped differently here.",
        ],
      },
      {
        heading: "What is removed before anything is drawn",
        paragraphs: [
          "Pasted markup is rebuilt from an allowlist before it is displayed or painted. Scripts, iframes, objects, embedded SVG, MathML, form controls and <canvas> elements are removed with their contents, every on* handler is stripped, and javascript: and vbscript: URLs are rejected in any URL attribute - including entity-encoded and whitespace-obfuscated spellings of the same thing. A <style> block is deliberately kept, because a class-based mockup is most of what people want to capture, and so are data: and aria- attributes. The id attribute is removed: it could collide with this page's own ids and hijack a label or a :target rule. Executable CSS constructs - expression(), -moz-binding, behavior: and @import - are scrubbed from both inline styles and kept style blocks.",
          "The important part is that there is only one markup string. The preview and the capture both render the exact same sanitized output, so what you see on screen is what ends up in the file, and the one-line disclosure under the editor reports the real counts of what was removed. Input is capped at 200 KB.",
        ],
      },
      {
        heading: "Privacy, and when to reach for something else",
        paragraphs: [
          "Nothing is uploaded. Your markup is read in this tab, laid out in this tab, repainted in this tab and written to your downloads from this tab, and no request is made for your HTML. The one network traffic that can happen is whatever your own markup points at - a remote image or stylesheet - which your browser fetches as it would on any page.",
          "If you need a full scrolling page, or a capture of something that is not currently in the DOM, or a renderer that reproduces filter and blend modes, use a headless browser screenshot or the browser's own capture instead: this tool is built for a bounded, self-contained box, and it is honest about that boundary rather than pretending otherwise.",
        ],
      },
    ],
  },
  {
    slug: "how-to-decode-a-jwt",
    title: "How to Decode a JWT (and Why Decoding Is Not Verifying)",
    description:
      "Split a JSON Web Token into header, payload and signature in your browser, read exp, nbf and iat as real dates, and see exactly where the line between decoding and verifying sits.",
    keywords: [
      "decode jwt",
      "jwt decoder online",
      "how to read a jwt payload",
      "jwt expiration check",
      "jwt claims online",
    ],
    toolSlug: "jwt-decoder",
    published: "2026-09-30",
    updated: "2026-09-30",
    readMinutes: 4,
    sections: [
      {
        heading: "Decoding is not verifying",
        paragraphs: [
          "A JWT is three base64url strings joined by dots: header, payload, signature. Encoding is not encryption, so the first two are readable by anyone holding the token - there is no key involved in reading them and no secret to obtain. That is the whole of what decoding gives you: the text somebody wrote into the token.",
          "Verifying is a different operation with a different input. Verification takes the signature, the header and the payload, plus a key the issuer published (a shared secret for HMAC, a public key for RSA or ECDSA), and recomputes the cryptographic check. A token that decodes tells you nothing about whether that check would pass, because the signature segment is deliberately opaque to a decoder and the token's author chooses its contents freely. Anyone can mint a token whose payload reads {\"sub\":\"admin\",\"admin\":true}. So the honest label is decoded, not verified, and this page puts that on screen, in the structure report and in every answer here.",
          "It also means this tool cannot confirm whether a token is expired for the service that issued it, whether the audience matches, or whether the issuer is who it claims to be. It shows what the token says about those things, which is useful for debugging, and it stops there. If you need a real answer, send the token to the service that issued it and let it run its own verification.",
        ],
      },
      {
        heading: "Paste it, and read the structure report",
        paragraphs: [
          "Paste a token into the field. Surrounding whitespace is removed, and a leading Bearer is stripped so that a header copied out of a request works as pasted; when either happens the page says so rather than quietly tidying your input. Input is capped at 262,144 characters (256 KB) and anything longer is refused with its real length and that limit, before a single byte is decoded.",
          "The structure report lists every dot-separated segment with its encoded length, its decoded byte length and whether it decoded. That panel is where a bad token explains itself. A character outside the base64url alphabet is refused by name and position, which covers the three mistakes that account for nearly every failure: standard Base64 + and / where base64url expects - and _, an = padding character that base64url never uses, and a stray character pasted in from a log. The decoder also refuses a length that no base64 string can produce and a final character whose unused bits are not zero, rather than rounding them off. Segments that decode to bytes which are not valid UTF-8, or to text that is not valid JSON, are refused with that reason instead of printing replacement characters or a blank panel.",
          "A five-segment input is recognised as a JWE - an encrypted token - and refused: decoding cannot open it without the decryption key. Anything that is not exactly three segments is refused with its real segment count. Nothing is guessed and nothing is half-decoded.",
        ],
      },
      {
        heading: "Reading the claims, and the dates that matter",
        paragraphs: [
          "The registered claims come first: iss, sub, aud, exp, nbf, iat and jti, then any private claims sorted by name. Claims the token does not carry are listed as not present, because an absent exp is very different from an exp nobody looked at.",
          "The four NumericDate claims - exp, nbf, iat and auth_time - are seconds since the epoch, so each is shown twice: as an absolute UTC date and time, and as a reading. exp becomes expires in 2 hours or expired 3 days ago, with the countdown live rather than frozen at the moment you pasted; nbf becomes not valid for another 30 minutes or valid since 2 hours ago; iat tells you when the token was issued. If a claim arrives as a JSON string rather than a number, or as something that is not a date at all, or as a number no browser can turn into a date, the row says so instead of quietly printing a plausible-looking wrong date.",
          "A long claim is truncated for display with its real character count and the instruction to use the copy button for all of it, and the payload being a JSON array or a bare scalar is described as what it is rather than treated as a broken claims object. None of this makes the values trustworthy: they are text from the token, and a token's author wrote every one of them.",
        ],
      },
      {
        heading: "Privacy, and the honest limits",
        paragraphs: [
          "Nothing is uploaded and no request is made with your token: decoding happens in your tab, and the page makes no network call of any kind. That is a statement about this page only. A JWT is a bearer credential - whoever holds it can present it as you - so do not paste a live token into anything, including this one, unless you are entitled to read it, and do not paste a token out of a production log.",
          "What this tool cannot do is the list worth reading before you trust a claim: it does not verify signatures, it does not fetch a JWKS endpoint, it does not check an issuer or an audience, it cannot decrypt a JWE, and it does not follow a nested JWT inside a claim. It cannot tell you whether a token is authentic, only what it says.",
        ],
      },
    ],
  },
  {
    slug: "how-to-convert-json-to-typescript-types",
    title: "How to Turn JSON into TypeScript Types Without Guessing",
    description:
      "Generate TypeScript interfaces from one JSON sample: how array elements are merged, why a null field stays required, when a key becomes optional, and what the page refuses to invent.",
    keywords: [
      "json to typescript",
      "json to ts interface",
      "generate typescript types from json",
      "typescript interface from json",
      "json to ts union types",
    ],
    toolSlug: "json-to-typescript",
    published: "2026-10-05",
    updated: "2026-10-05",
    readMinutes: 3,
    sections: [
      {
        heading: "What one sample can tell you, and what it cannot",
        paragraphs: [
          "A JSON document carries values, not types. It says this key held the string 2024-01-01, and that string might be a date, an account code, a version, or a sentence. It says this key held 42, and 42 might be a count, an age, a price in cents or an identifier. Nothing inside the document distinguishes those, so any tool that writes date: Date or id: number has decided something for you on the strength of the shape of the value, and then presents it as though the data had said so.",
          "That is why the right expectation for this page is a first draft. It reads the one sample you paste and describes that sample faithfully: which keys are present, which are numbers, which are strings, which are null, and how the nesting runs. It does not know your schema, your database or your API, and the fields your sample happens not to contain are not marked optional, because a sample cannot tell an absent key from a key the endpoint sometimes omits.",
        ],
      },
      {
        heading: "Paste the sample, name the root, read what it decided",
        paragraphs: [
          "Open the tool and paste one object, array or value. Nothing is pre-filled, so nothing on screen can be confused with your own data; Load sample puts a small example in the box when you want one. A single response from a single endpoint is a sample. If the fields you care about are missing, the types will be missing too, and the cheapest fix is a wider sample rather than a cleverer tool.",
          "The root name box names the type the document itself becomes. A name that cannot be used as written is replaced rather than mangled: a TypeScript keyword such as class, or a built-in type such as Record that an interface declaration would shadow, becomes Root, and the page says which name it used and why instead of substituting silently. Renaming re-emits the declarations immediately, without re-reading the JSON, and the panel under the output gives you the interface count, the field count and the character count of exactly the text Copy and Download hand over.",
        ],
      },
      {
        heading: "The rules the output follows",
        paragraphs: [
          "The root object becomes one export interface, and every object nested inside it gets its own named interface, named for the path that reached it: User, then UserProfile, then UserProfileAddress. You get a flat list of declarations to read top to bottom rather than a wall of inline nested types, and no declaration that refers to a name the output does not define — the emitted names are checked for duplicates and for resolution before the result is allowed to say Generated.",
          "An array of objects is merged into a single element shape. A key that was missing from at least one element is the only thing that becomes optional, and that is the only place in the whole conversion where a question mark can appear. Keys whose shapes disagree become a union of what was really seen, in parentheses when they sit inside an array, so a mixed array reads as (string | number)[] rather than any[]. A JSON null is a value rather than a hole: the field is required and its type includes null, because the sample has that key and that value, and dropping it would claim something your data does not say. An empty object becomes Record<string, never> and an empty array becomes unknown[], since an interface with no members would accept every object you could hand it.",
          "Keys that are not legal identifiers are sanitized and written as quoted members, so a b becomes a_b and a leading digit gains an underscore, and two keys that clean to the same name are separated deterministically as a_b and a_b_2 rather than silently becoming one. What the output never contains is worth the same attention: no JSDoc, because a comment guessed from one value is a comment that will be wrong; no enums, no generics, no converters, and no type-alias mode, whatever an older version of this page may have claimed.",
        ],
      },
      {
        heading: "Caps, privacy, and what to do with the draft",
        paragraphs: [
          "Four caps are checked before any parsing or emission work starts: 200,000 characters of pasted text, 64 nesting levels, 200,000 values in the document, and 400,000 characters of generated code, which an array of objects can reach without the input ever being that long. Each is refused with its real numbers rather than truncated, because a truncated document produces types that look complete and are not. Your JSON is parsed and read in this tab: nothing is uploaded and no request is made with your data, which is the point when the payload is an API response containing someone else's records.",
          "So use it for what it is. Paste a response, take the draft, then spend the saved time on the parts only you know: add the fields this one sample did not contain, narrow the strings that are really dates, UUIDs or enums, decide which numbers are amounts, and delete the interfaces for branches your code never handles. The copy compiles as written — that is checked, not promised, because the names in it are checked before it is called Generated — and the rest is editing you were always going to do.",
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
