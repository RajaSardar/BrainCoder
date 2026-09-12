import { zipSync, type Zippable } from "fflate";

const MAX_EMU_W = 6.5 * 914400; // 6.5 inch usable width in EMU
const PX_TO_EMU = 9525; // 1 CSS px at 96dpi

export interface PageImage {
  url: string;
  width: number;
  height: number;
}

let workerReady = false;
function ensureWorker(pdfjs: typeof import("pdfjs-dist")) {
  if (workerReady) return;
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();
  workerReady = true;
}

export async function renderPdfPages(
  data: ArrayBuffer,
  scale = 2,
): Promise<PageImage[]> {
  const pdfjs = await import("pdfjs-dist");
  ensureWorker(pdfjs);
  const doc = await pdfjs.getDocument({ data: data.slice(0) }).promise;
  const out: PageImage[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;
    await page.render({ canvas, viewport }).promise;
    out.push({
      url: canvas.toDataURL("image/png"),
      width: canvas.width,
      height: canvas.height,
    });
  }
  return out;
}

export async function extractPdfText(data: ArrayBuffer): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  ensureWorker(pdfjs);
  const doc = await pdfjs.getDocument({ data: data.slice(0) }).promise;
  const pages: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    let line = "";
    const parts: string[] = [];
    const items = (content.items ?? []) as Array<{
      str?: string;
      hasEOL?: boolean;
    }>;
    for (const item of items) {
      if (typeof item.str === "string" && item.str) {
        line += item.str;
        if (item.hasEOL) {
          parts.push(line.replace(/\s+$/, ""));
          line = "";
        }
      }
    }
    if (line.trim()) parts.push(line);
    pages.push(
      parts
        .map((s) => s.trim())
        .filter(Boolean)
        .join("\n"),
    );
  }
  return pages.join("\n\n");
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const idx = dataUrl.indexOf(",");
  const b64 = idx >= 0 ? dataUrl.slice(idx + 1) : dataUrl;
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function fitEmu(w: number, h: number): { cx: number; cy: number } {
  let cx = Math.round(w * PX_TO_EMU);
  let cy = Math.round(h * PX_TO_EMU);
  if (cx > MAX_EMU_W) {
    const k = MAX_EMU_W / cx;
    cx = MAX_EMU_W;
    cy = Math.round(cy * k);
  }
  return { cx, cy };
}

// ---------------------------------------------------------------- DOCX

export function buildDocx(images: PageImage[]): Uint8Array {
  const parts: Zippable = {};

  parts["[Content_Types].xml"] = new TextEncoder()
    .encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`);

  parts["_rels/.rels"] = new TextEncoder()
    .encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);

  const rels: string[] = [];
  const drawings: string[] = [];
  images.forEach((img, i) => {
    const rId = `rId${i + 1}`;
    rels.push(
      `<Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image${i + 1}.png"/>`,
    );
    const { cx, cy } = fitEmu(img.width, img.height);
    drawings.push(`<w:p><w:pPr><w:jc w:val="center"/><w:contextualSpacing/></w:pPr><w:r><w:drawing>
<wp:inline xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" distT="0" distB="0" distL="0" distR="0">
<wp:extent cx="${cx}" cy="${cy}"/>
<wp:effectExtent l="0" t="0" r="0" b="0"/>
<wp:docPr id="${i + 1}" name="Page ${i + 1}"/>
<wp:cNvGraphicFramePr/>
<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
<pic:nvPicPr><pic:cNvPr id="${i + 1}" name="Page ${i + 1}"/><pic:cNvPicPr/></pic:nvPicPr>
<pic:blipFill><a:blip r:embed="${rId}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>
<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>
</pic:pic>
</a:graphicData>
</a:graphic>
</wp:inline>
</w:drawing></w:r></w:p>`);
    parts[`word/media/image${i + 1}.png`] = dataUrlToBytes(img.url);
  });

  parts["word/_rels/document.xml.rels"] = new TextEncoder()
    .encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${rels.join("\n")}
</Relationships>`);

  parts["word/document.xml"] = new TextEncoder()
    .encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>
${drawings.join("\n")}
<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr>
</w:body>
</w:document>`);

  return zipSync(parts, { level: 6 });
}

// ---------------------------------------------------------------- PPTX

const SLIDE_W = 12192000; // 16:9
const SLIDE_H = 6858000;
const MARGIN = 72000;

const theRel =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const prRel = "http://schemas.openxmlformats.org/package/2006/relationships";

export function buildPptx(images: PageImage[]): Uint8Array {
  const parts: Zippable = {};

  parts["[Content_Types].xml"] = new TextEncoder()
    .encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
  <Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
  <Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>
  ${images.map((_, i) => `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join("\n  ")}
</Types>`);

  parts["_rels/.rels"] = new TextEncoder()
    .encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="${prRel}">
  <Relationship Id="rId1" Type="${theRel}/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`);

  parts["ppt/theme/theme1.xml"] = new TextEncoder()
    .encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Office">
<a:themeElements>
<a:clrScheme name="Office">
<a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1>
<a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1>
<a:dk2><a:srgbClr val="1F497D"/></a:dk2>
<a:lt2><a:srgbClr val="EEECE1"/></a:lt2>
<a:accent1><a:srgbClr val="4F81BD"/></a:accent1>
<a:accent2><a:srgbClr val="C0504D"/></a:accent2>
<a:accent3><a:srgbClr val="9BBB59"/></a:accent3>
<a:accent4><a:srgbClr val="8064A2"/></a:accent4>
<a:accent5><a:srgbClr val="4BACC6"/></a:accent5>
<a:accent6><a:srgbClr val="F79646"/></a:accent6>
<a:hlink><a:srgbClr val="0000FF"/></a:hlink>
<a:folHlink><a:srgbClr val="800080"/></a:folHlink>
</a:clrScheme>
<a:fontScheme name="Office">
<a:majorFont><a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont>
<a:minorFont><a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont>
</a:fontScheme>
<a:fmtScheme name="Office">
<a:fillStyleLst>
<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>
<a:gradFill rotWithShape="1"><a:gsLst><a:gs pos="0"><a:schemeClr val="phClr"><a:tint val="50000"/><a:satMod val="300000"/></a:schemeClr></a:gs><a:gs pos="35000"><a:schemeClr val="phClr"><a:tint val="37000"/><a:satMod val="300000"/></a:schemeClr></a:gs><a:gs pos="100000"><a:schemeClr val="phClr"><a:tint val="15000"/><a:satMod val="350000"/></a:schemeClr></a:gs></a:gsLst><a:lin ang="16200000" scaled="1"/></a:gradFill>
</a:fillStyleLst>
<a:lnStyleLst>
<a:ln w="9525" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln>
</a:lnStyleLst>
<a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst>
<a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst>
</a:fmtScheme>
</a:themeElements>
</a:theme>`);

  parts["ppt/slideMasters/slideMaster1.xml"] = new TextEncoder()
    .encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="${theRel}">
<p:cSld><p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef></p:bg><p:spTree>
<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
</p:spTree></p:cSld>
<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>
<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>
<p:txStyles>
<p:titleStyle><a:lvl1pPr algn="ctr"><a:defRPr sz="2800"/></a:lvl1pPr></p:titleStyle>
<p:bodyStyle><a:lvl1pPr><a:defRPr sz="1400"/></a:lvl1pPr></p:bodyStyle>
<p:otherStyle><a:lvl1pPr><a:defRPr sz="1200"/></a:lvl1pPr></p:otherStyle>
</p:txStyles>
</p:sldMaster>`);

  parts["ppt/slideMasters/_rels/slideMaster1.xml.rels"] = new TextEncoder()
    .encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="${prRel}">
  <Relationship Id="rId1" Type="${theRel}/layout" Target="../slideLayouts/slideLayout1.xml"/>
  <Relationship Id="rId2" Type="${theRel}/theme" Target="../theme/theme1.xml"/>
</Relationships>`);

  parts["ppt/slideLayouts/slideLayout1.xml"] = new TextEncoder()
    .encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" type="blank" preserve="1">
<p:cSld name="Blank"><p:spTree>
<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
</p:spTree></p:cSld>
<p:clrMapOvr><a:overrideClrMapping bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/></p:clrMapOvr>
</p:sldLayout>`);

  parts["ppt/slideLayouts/_rels/slideLayout1.xml.rels"] = new TextEncoder()
    .encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="${prRel}">
  <Relationship Id="rId1" Type="${theRel}/slideMaster" Target="../slideMasters/slideMaster1.xml"/>
</Relationships>`);

  const sldIds: string[] = [];
  const sldRels: string[] = [];
  images.forEach((img, i) => {
    const num = i + 1;
    parts[`ppt/media/image${num}.png`] = dataUrlToBytes(img.url);
    const availW = SLIDE_W - MARGIN * 2;
    const availH = SLIDE_H - MARGIN * 2;
    const k = Math.min(availW / img.width, availH / img.height);
    const cx = Math.round(img.width * k);
    const cy = Math.round(img.height * k);
    const offX = Math.round((SLIDE_W - cx) / 2);
    const offY = Math.round((SLIDE_H - cy) / 2);
    parts[`ppt/slides/_rels/slide${num}.xml.rels`] = new TextEncoder()
      .encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="${prRel}">
  <Relationship Id="rId1" Type="${theRel}/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
  <Relationship Id="rId2" Type="${theRel}/image" Target="../media/image${num}.png"/>
</Relationships>`);
    parts[`ppt/slides/slide${num}.xml`] = new TextEncoder()
      .encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="${theRel}">
<p:cSld><p:spTree>
<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${SLIDE_W}" cy="${SLIDE_H}"/><a:chOff x="0" y="0"/><a:chExt cx="${SLIDE_W}" cy="${SLIDE_H}"/></a:xfrm></p:grpSpPr>
<p:pic>
<p:nvPicPr><p:cNvPr id="2" name="Page ${num}"/><p:cNvPicPr/></p:nvPicPr>
<p:blipFill><a:blip r:embed="rId2"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>
<p:spPr><a:xfrm><a:off x="${offX}" y="${offY}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>
</p:pic>
</p:spTree></p:cSld>
<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sld>`);
    sldIds.push(`<p:sldId id="${256 + i}" r:id="rId${i + 2}"/>`);
    sldRels.push(
      `<Relationship Id="rId${i + 2}" Type="${theRel}/slide" Target="slides/slide${num}.xml"/>`,
    );
  });

  parts["ppt/_rels/presentation.xml.rels"] = new TextEncoder()
    .encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="${prRel}">
  <Relationship Id="rId1" Type="${theRel}/slideMaster" Target="slideMasters/slideMaster1.xml"/>
${sldRels.join("\n")}
</Relationships>`);

  parts["ppt/presentation.xml"] = new TextEncoder()
    .encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="${theRel}">
<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>
<p:sldIdLst>${sldIds.join("")}</p:sldIdLst>
<p:sldSz cx="${SLIDE_W}" cy="${SLIDE_H}"/>
<p:notesSz cx="6858000" cy="9144000"/>
<p:defaultTextStyle>
<a:lvl1pPr algn="l"><a:defRPr sz="1800"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill></a:defRPr><a:spcBef lines="200"/><a:spcAft lines="200"/></a:lvl1pPr>
<a:lvl2pPr algn="l"><a:defRPr sz="1600"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill></a:defRPr><a:spcBef lines="200"/><a:spcAft lines="200"/></a:lvl2pPr>
</p:defaultTextStyle>
</p:presentation>`);

  return zipSync(parts, { level: 6 });
}

// ---------------------------------------------------------------- Word -> HTML (mammoth)

export async function docxToHtml(data: ArrayBuffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.convertToHtml({ arrayBuffer: data });
  return result.value;
}

// ---------------------------------------------------------------- Text -> PDF (pdf-lib)

export async function buildTextPdf(
  text: string,
  opts: { fontSize?: number } = {},
): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontSize = opts.fontSize ?? 13;
  const lineHeight = Math.round(fontSize * 1.4);
  const pageW = 595.28;
  const pageH = 841.89;
  const margin = 56.7;
  const maxW = pageW - margin * 2;

  function splitLines(paragraph: string): string[] {
    const words = paragraph.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let cur = "";
    for (const w of words) {
      const test = cur ? `${cur} ${w}` : w;
      if (font.widthOfTextAtSize(test, fontSize) <= maxW || !cur) cur = test;
      else {
        lines.push(cur);
        if (font.widthOfTextAtSize(w, fontSize) > maxW) {
          let chunk = w;
          while (chunk.length) {
            let n = chunk.length;
            while (
              n > 1 &&
              font.widthOfTextAtSize(chunk.slice(0, n), fontSize) > maxW
            )
              n--;
            lines.push(chunk.slice(0, n));
            chunk = chunk.slice(n);
          }
        } else cur = w;
      }
    }
    if (cur) lines.push(cur);
    return lines;
  }

  let page = doc.addPage([pageW, pageH]);
  let y = pageH - margin;

  for (const para of text.split(/\r?\n/).map((s) => s.replace(/\t/g, "    "))) {
    if (!para.trim()) {
      y -= lineHeight;
    } else {
      for (const ln of splitLines(para)) {
        if (y < margin + lineHeight) {
          page = doc.addPage([pageW, pageH]);
          y = pageH - margin;
        }
        page.drawText(ln, {
          x: margin,
          y,
          size: fontSize,
          font,
          color: rgb(0.05, 0.06, 0.09),
        });
        y -= lineHeight;
      }
    }
    y -= lineHeight * 0.35; // paragraph gap
  }

  return doc.save();
}
