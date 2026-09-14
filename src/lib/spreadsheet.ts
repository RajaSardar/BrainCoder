import { unzipSync, zipSync, type Zippable } from "fflate";

export interface SheetData {
  name: string;
  rows: (string | number)[][];
}

export function colLetter(n: number): string {
  let s = "";
  let v = n;
  while (v >= 0) {
    s = String.fromCharCode(65 + (v % 26)) + s;
    v = Math.floor(v / 26) - 1;
  }
  return s;
}

export function xmlEsc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function sheetNameSafe(name: string, idx: number): string {
  const clean = name.replace(/[\/\\\?\*\[\]:]/g, " ").trim().slice(0, 31);
  return clean || `Sheet${idx + 1}`;
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQuotes = false;
  const src = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQuotes = false;
      } else cur += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") {
      row.push(cur);
      cur = "";
    } else if (ch === "\n") {
      row.push(cur);
      rows.push(row);
      row = [];
      cur = "";
    } else cur += ch;
  }
  if (cur || row.length) {
    row.push(cur);
    rows.push(row);
  }
  return rows;
}

export function toCsv(rows: (string | number)[][]): string {
  return rows
    .map((r) =>
      r
        .map((c) => {
          const s = String(c);
          if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
          return s;
        })
        .join(","),
    )
    .join("\n");
}

// ---------------------------------------------------------------- XLSX reader

interface WorksheetRef {
  name: string;
  path: string;
}

function cellValue(
  c: Element,
  shared: string[],
): string | number {
  const type = c.getAttribute("t");
  if (type === "inlineStr") {
    const ts = c.getElementsByTagName("t");
    let out = "";
    for (let i = 0; i < ts.length; i++) out += ts[i].textContent ?? "";
    return out;
  }
  const vs = c.getElementsByTagName("v");
  const v = vs.length > 0 ? (vs[0].textContent ?? "") : "";
  if (type === "s") {
    const idx = parseInt(v, 10);
    if (!Number.isNaN(idx) && shared[idx] !== undefined) return shared[idx];
    return "";
  }
  if (type === "str" || type === "b" || type === "e") {
    return v;
  }
  if (v === "") return "";
  const num = Number(v);
  return Number.isNaN(num) ? v : num;
}

function parseSheetRows(
  xml: string,
  shared: string[],
): (string | number)[][] {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const rows: (string | number)[][] = [];
  const rowEls = doc.getElementsByTagName("row");
  for (let i = 0; i < rowEls.length; i++) {
    const cells = rowEls[i].getElementsByTagName("c");
    const row: (string | number)[] = [];
    let lastCol = -1;
    for (let j = 0; j < cells.length; j++) {
      const c = cells[j];
      const ref = c.getAttribute("r");
      let colIndex = -1;
      if (ref) {
        const m = ref.match(/^([A-Z]+)/);
        if (m) {
          let n = 0;
          for (const ch of m[1]) n = n * 26 + (ch.charCodeAt(0) - 64);
          colIndex = n - 1;
        }
      }
      if (colIndex < 0) colIndex = lastCol + 1;
      while (row.length < colIndex) row.push("");
      row.push(cellValue(c, shared));
      lastCol = colIndex;
    }
    rows.push(row);
  }
  return rows;
}

export async function parseXlsx(
  data: ArrayBuffer,
): Promise<SheetData[]> {
  const files = unzipSync(new Uint8Array(data));

  const shared: string[] = [];
  const sharedFile = files["xl/sharedStrings.xml"];
  if (sharedFile) {
    const doc = new DOMParser().parseFromString(
      new TextDecoder().decode(files["xl/sharedStrings.xml"]),
      "application/xml",
    );
    const sis = doc.getElementsByTagName("si");
    for (let i = 0; i < sis.length; i++) {
      let text = "";
      for (const t of sis[i].getElementsByTagName("t")) {
        text += t.textContent ?? "";
      }
      shared.push(text);
    }
  }

  const sheets: WorksheetRef[] = [];
  const wbFile = files["xl/workbook.xml"];
  if (wbFile) {
    const doc = new DOMParser().parseFromString(
      new TextDecoder().decode(wbFile),
      "application/xml",
    );
    const relsDoc = new DOMParser().parseFromString(
      new TextDecoder().decode(files["xl/_rels/workbook.xml.rels"] ?? new Uint8Array()),
      "application/xml",
    );
    const relMap: Record<string, string> = {};
    const rEls = relsDoc.getElementsByTagName("Relationship");
    for (let i = 0; i < rEls.length; i++) {
      relMap[rEls[i].getAttribute("Id") ?? ""] =
        rEls[i].getAttribute("Target") ?? "";
    }
    const sheetEls = doc.getElementsByTagName("sheet");
    for (let i = 0; i < sheetEls.length; i++) {
      const name = sheetEls[i].getAttribute("name") ?? `Sheet${i + 1}`;
      const rid = sheetEls[i].getAttribute("r:id") ?? "";
      let target = relMap[rid] || `worksheets/sheet${i + 1}.xml`;
      if (!target.includes("/")) target = `xl/${target}`;
      else if (target.startsWith("/")) target = target.slice(1);
      else if (!target.startsWith("xl/")) target = `xl/${target}`;
      target = target.replace(/^\//, "");
      sheets.push({ name, path: target });
    }
  }

  const out: SheetData[] = [];
  const decoder = new TextDecoder();
  for (const s of sheets) {
    const raw = files[s.path] ?? files[`xl/${s.path}`] ?? files[`/${s.path}`];
    if (!raw) continue;
    const xml = decoder.decode(raw);
    out.push({ name: s.name, rows: parseSheetRows(xml, shared) });
  }
  if (out.length === 0) {
    for (const key of Object.keys(files)) {
      if (/^xl\/worksheets\/sheet\d+\.xml$/.test(key)) {
        out.push({
          name: `Sheet${out.length + 1}`,
          rows: parseSheetRows(decoder.decode(files[key]), shared),
        });
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------- XLSX writer

export function buildXlsx(sheets: SheetData[]): Uint8Array {
  const safe = sheets.map((s, i) => ({ ...s, name: sheetNameSafe(s.name, i) }));

  const overrides = safe
    .map(
      (s, i) =>
        `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
    )
    .join("");
  const contentTypes =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    overrides +
    "</Types>";

  const rels =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
    "</Relationships>";

  const sheetsXml = safe
    .map(
      (s, i) =>
        `<sheet name="${xmlEsc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`,
    )
    .join("");

  const wbRels = safe
    .map(
      (_, i) =>
        `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
    )
    .join("");

  const parts: Zippable = {
    "[Content_Types].xml": new TextEncoder().encode(contentTypes),
    "_rels/.rels": new TextEncoder().encode(rels),
    "xl/workbook.xml": new TextEncoder().encode(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
        `<sheets>${sheetsXml}</sheets></workbook>`,
    ),
    "xl/_rels/workbook.xml.rels": new TextEncoder().encode(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        wbRels +
        "</Relationships>",
    ),
  };

  safe.forEach((s, i) => {
    const sheetRows = s.rows.length;
    const sheetCols = s.rows.reduce((m, r) => Math.max(m, r.length), 0);
    const rowsXml = s.rows
      .map((r, ri) => {
        const cells = r
          .map((c, ci) => {
            const ref = `${colLetter(ci)}${ri + 1}`;
            if (typeof c === "number") {
              return `<c r="${ref}"><v>${c}</v></c>`;
            }
            return `<c r="${ref}" t="inlineStr"><is><t>${xmlEsc(c)}</t></is></c>`;
          })
          .join("");
        return `<row r="${ri + 1}">${cells}</row>`;
      })
      .join("");
    const sheet =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><dimension ref="A1:${colLetter(Math.max(sheetCols, 1) - 1)}${Math.max(sheetRows, 1)}"/><sheetViews><sheetView workbookViewId="0"/></sheetViews><sheetFormatPr defaultRowHeight="15"/><sheetData>${rowsXml}</sheetData></worksheet>`;
    parts[`xl/worksheets/sheet${i + 1}.xml`] = new TextEncoder().encode(sheet);
  });

  return zipSync(parts, { level: 6 });
}