import { buildPptx } from "/Users/rajasardar/repos/BrainCoder/src/features/pdf-office/support.ts";
import { unzipSync } from "/Users/rajasardar/repos/BrainCoder/node_modules/fflate/esm/browser.js";

let passed = 0, failed = 0;
const check = (ok, label) => {
  if (ok) { passed++; console.log("PASS", label); }
  else { failed++; console.log("FAIL", label); }
};

const pngHead = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

// helper: build a fake slide
const fakeSlide = (page, w, h, seed) => {
  const bytes = new Uint8Array([...pngHead, seed & 0xff, (seed >> 8) & 0xff, 0, 0, 0, 0]);
  return { page, bytes, width: w, height: h };
};

// --- 1. 3-slide deck structure ---
{
  const slots = [fakeSlide(1, 1000, 800, 1), fakeSlide(2, 500, 1000, 2), fakeSlide(3, 1200, 900, 3)];
  const pptx = buildPptx(slots);
  const unz = unzipSync(pptx);
  check(unz["[Content_Types].xml"], "zip has [Content_Types].xml");
  check(unz["ppt/presentation.xml"], "zip has presentation.xml");
  check(unz["ppt/slides/slide3.xml"], "zip has slide3.xml");
  check(unz["ppt/slides/_rels/slide3.xml.rels"], "zip has slide3 rels");
  check(unz["ppt/media/image3.png"]?.length === 14, "media bytes embedded intact (len 14)");
  check(Object.keys(unz).some((k) => k.startsWith("ppt/media/image")), "media parts present");

  const ct = new TextDecoder().decode(unz["[Content_Types].xml"]);
  const pres = new TextDecoder().decode(unz["ppt/presentation.xml"]);
  check((ct.match(/slide\d+\.xml"/g) || []).length === 3, "[Content_Types] lists 3 slides");
  check((pres.match(/<p:sldId /g) || []).length === 3, "presentation lists 3 slides");
  const sldIds = (pres.match(/<p:sldId id="(\d+)"/g) || []).map((s) => s.match(/\d+/)[0]);
  check(new Set(sldIds).size === 3, "slide ids unique");

  const slide3 = new TextDecoder().decode(unz["ppt/slides/slide3.xml"]);
  check(/r:embed="rId2"/.test(slide3), "slide3 embeds its image via rId2");
  check(slide3.includes("a:off x="), "slide has xfrm offsets");
  const rels3 = new TextDecoder().decode(unz["ppt/slides/_rels/slide3.xml.rels"]);
  check(rels3.includes('Target="../media/image3.png"'), "slide3 rel → image3.png");
  check(rels3.includes('Target="../slideLayouts/slideLayout1.xml"'), "slide3 rel → layout1");
}

// --- 2. NaN/Infinity guard: zero-area and absurd slides ---
{
  const bad = [
    fakeSlide(1, 0, 0, 11),
    fakeSlide(2, -5, 3, 12),
    fakeSlide(3, 1e12, 1e12, 13),
  ];
  const pptx = buildPptx(bad);
  const unz = unzipSync(pptx);
  let ok = true;
  for (const k of ["ppt/slides/slide1.xml", "ppt/slides/slide2.xml", "ppt/slides/slide3.xml"]) {
    const xml = new TextDecoder().decode(unz[k]);
    if (/NaN|Infinity|-?\d+\.\d+e/i.test(xml)) ok = false;
    const nums = xml.match(/(?:cx|cy)="(-?\d+)"/g);
    if (!nums || nums.some((n) => /-1/.test(n))) ok = false;
  }
  check(ok, "zero/negative/huge slides → finite integer coords, no NaN/Infinity");
  const s1 = new TextDecoder().decode(unz["ppt/slides/slide1.xml"]);
  const cx = /\bcx="(\d+)"/.exec(s1)?.[1];
  check(parseInt(cx, 10) > 0, `zero-area slide falls back to finite ext (cx=${cx})`);
}

// --- 3. single slide + bytes round-trip ---
{
  const pptx = buildPptx([fakeSlide(1, 640, 480, 202)]);
  const unz = unzipSync(pptx);
  const media = unz["ppt/media/image1.png"];
  check(media[0] === pngHead[0] && media[1] === pngHead[1], "png signature preserved");
  check(media[8] === 202, "payload byte round-trips intact");
  check(pptx instanceof Uint8Array, "buildPptx returns Uint8Array");
}

console.log(`RESULT: ${passed} passed, ${failed} failed`);