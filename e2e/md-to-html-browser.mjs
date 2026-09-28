/**
 * Production-Chrome harness for the Markdown to HTML tool.
 * Mirrors e2e/pdf-redact-browser.mjs conventions: playwright chromium via the
 * installed `chrome` channel, hydration + pageerror collectors, [role=status]
 * hasText filters, alert() filtered on /\S/.
 *
 *   BASE_URL=http://localhost:3801 node e2e/md-to-html-browser.mjs
 *
 * Not run by the implementer — the orchestrator owns the server and the run.
 */
import { chromium } from "playwright-core";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";

const BASE_URL = process.env.BASE_URL || "http://localhost:3801";
const PAGE = `${BASE_URL}/use/md-to-html`;
const TOOL_PAGE = `${BASE_URL}/tools/md-to-html`;
const GUIDE = `${BASE_URL}/guides/how-to-convert-markdown-to-html`;
const DL = "/tmp/mdtohtml";
rmSync(DL, { recursive: true, force: true });
mkdirSync(DL, { recursive: true });

const MAX_INPUT_CHARS = 200_000;

// ---- fixtures ----
// The expected HTML is the same string audit/check-md-to-html.mjs asserts, so
// the browser and the Node mirror must agree byte for byte. The fixture has no
// "&", so the pane's textContent is an exact comparison.
const FIXTURE_MD = [
  "# Release",
  "",
  "Plain *em*, **strong**, `code`, [link](https://example.com).",
  "",
  "- a",
  "- b",
  "",
  "| A | B |",
  "| - | - |",
  "| 1 | 2 |",
  "",
  "> quote",
  "",
  "![alt](img.png)",
  "",
  "```js",
  "const a = 1;",
  "```",
  "",
  "<script>alert(1)</script>",
  "",
  "<img src=x onerror=alert(1)>",
  "",
  "[bad](javascript:alert(1))",
  "",
].join("\n");

const FIXTURE_HTML = [
  "<h1>Release</h1>",
  '<p>Plain <em>em</em>, <strong>strong</strong>, <code>code</code>, <a href="https://example.com">link</a>.</p>',
  "<ul>",
  "<li>a</li>",
  "<li>b</li>",
  "</ul>",
  "<table>",
  "<thead>",
  "<tr>",
  "<th>A</th>",
  "<th>B</th>",
  "</tr>",
  "</thead>",
  "<tbody><tr>",
  "<td>1</td>",
  "<td>2</td>",
  "</tr>",
  "</tbody></table>",
  "<blockquote>",
  "<p>quote</p>",
  "</blockquote>",
  '<p><img src="img.png" alt="alt"></p>',
  '<pre><code class="language-js">const a = 1;</code></pre>',
  '<img src="x"><p><a>bad</a></p>',
  "",
].join("\n");

writeFileSync(`${DL}/notes.md`, "# Notes\n\nOne line of **bold** text.\n");
writeFileSync(`${DL}/oversize.md`, "x".repeat(MAX_INPUT_CHARS + 1));

const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  acceptDownloads: true,
});
await context.addInitScript(() => {
  // Clipboard stub: the copy assertion reads the exact string written.
  window.__clipboard = "";
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: async (t) => {
        window.__clipboard = t;
      },
      readText: async () => window.__clipboard,
    },
  });
  // XSS canary: a payload that executed would flip this to 1.
  window.__xss = 0;
});
const page = await context.newPage();
page.on("dialog", (d) => d.dismiss());

let passed = 0;
let failed = 0;
function check(ok, label) {
  if (ok) {
    passed++;
    console.log(`ok  ${label}`);
  } else {
    failed++;
    console.error(`NOT OK  ${label}`);
  }
}

const consoleIssues = [];
const pageErrors = [];
page.on("console", (m) => {
  const t = m.text();
  if (/hydrat|didn't match|occurred during hydration|Server Components render/i.test(t))
    consoleIssues.push(t);
});
page.on("pageerror", (e) => pageErrors.push(String(e)));

const status = (t) => page.locator("[role='status']", { hasText: t });
const alert = (t) => page.locator("[role='alert']", { hasText: t });
const liveAlerts = () => page.locator("[role='alert']").filter({ hasText: /\S/ });
const editor = () => page.getByLabel("Markdown", { exact: true });
const out = () => page.locator("pre[aria-label='Generated HTML']");
const preview = () => page.locator("[role='region'][aria-label='Rendered preview']");
const htmlBtn = () => page.getByRole("button", { name: "HTML", exact: true });
const previewBtn = () => page.getByRole("button", { name: "Preview", exact: true });
const copyBtn = () => page.getByRole("button", { name: "Copy the generated HTML" });
const fileInput = () => page.locator("input[type='file']");
const outText = () => out().textContent();

/** Poll until `fn` returns something truthy (useDeferredValue lags a keystroke). */
async function waitFor(fn, label, timeout = 20000) {
  const start = Date.now();
  let last;
  while (Date.now() - start < timeout) {
    try {
      last = await fn();
      if (last) return last;
    } catch (err) {
      last = String(err);
    }
    await page.waitForTimeout(100);
  }
  throw new Error(`timeout waiting for ${label} (last=${String(last).slice(0, 200)})`);
}

async function captureDownload(button, saveAs, timeout = 30000) {
  const [dl] = await Promise.all([
    page.waitForEvent("download", { timeout }),
    button.click(),
  ]);
  await dl.saveAs(`${DL}/${saveAs}`);
  return { name: dl.suggestedFilename(), text: readFileSync(`${DL}/${saveAs}`, "utf8") };
}

try {
  // ---------- boot: the tool mounts with the sample ready ----------
  const res = await page.goto(PAGE, { waitUntil: "networkidle" });
  check(res.ok(), "tool route 200s");
  await editor().waitFor({ state: "visible", timeout: 15000 });
  await out().waitFor({ state: "visible", timeout: 15000 });
  check((await editor().isVisible()) && (await out().isVisible()), "editor and output pane are both visible");

  check(
    (await fileInput().getAttribute("accept"))?.includes(".md") === true,
    "file input accepts markdown",
  );
  {
    const forAttr = await page.locator("label", { hasText: "Open .md file" }).getAttribute("for");
    check(
      !!forAttr && forAttr === (await fileInput().getAttribute("id")),
      "file opener label is associated with the hidden input",
    );
  }
  check(
    (await page.locator("text=characters of HTML out").count()) === 1,
    "counters report characters in and characters of HTML out",
  );
  check((await page.getByText(/\d+ headings/).count()) === 1, "counters report the heading count");
  check((await out().getAttribute("aria-label")) === "Generated HTML", "the output pane is named");
  check(
    (await page.locator("[role='group'][aria-label='Output view']").count()) === 1,
    "the view switch is a labelled group",
  );

  const sampleHtml = await outText();
  check(sampleHtml.includes("<h1>Release notes"), "sample heading renders");
  check(sampleHtml.includes("<table>"), "sample table renders");
  check(
    sampleHtml.includes('<input checked="" disabled="" type="checkbox">'),
    "sample task list renders",
  );
  check(sampleHtml.includes('<code class="language-js">'), "sample fenced code keeps its language class");
  check(sampleHtml.includes("</mark>"), "allowlisted inline HTML (mark) survives in the sample");
  check(!/<script/i.test(sampleHtml), "the sample's inline <script> is already gone from the output");
  check((await liveAlerts().count()) === 0, "the sample raises no error");

  // ---------- preview view renders the same HTML ----------
  await previewBtn().click();
  await preview().waitFor({ state: "visible", timeout: 10000 });
  check(
    (await previewBtn().getAttribute("aria-pressed")) === "true",
    "preview view is marked pressed",
  );
  check((await preview().locator("h1").textContent()).startsWith("Release notes"), "preview renders the h1");
  check((await preview().locator("table th").count()) === 2, "preview renders the table headers");
  check((await preview().locator("input[type='checkbox']").count()) === 3, "preview renders the task list");
  check((await preview().locator("pre code.language-js").textContent()) === 'const { html } = convert("# Hello");', "preview renders the fenced code");
  check((await preview().locator("mark").count()) === 1, "preview keeps allowlisted inline HTML");
  check((await preview().locator("script").count()) === 0, "no script element exists in the preview");
  check((await page.evaluate(() => window.__xss)) === 0, "the sample's payload never executed");

  // keyboard: the view switch is a real button, not a styled div
  await htmlBtn().focus();
  await page.keyboard.press("Enter");
  check(
    (await waitFor(async () => ((await preview().count()) === 0 ? true : null), "the output view to take over")) === true,
    "the output view switch is operable from the keyboard",
  );
  check((await htmlBtn().getAttribute("aria-pressed")) === "true", "the output view is marked pressed");

  // ---------- empty input: friendly, idle, nothing enabled ----------
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  check(
    (await waitFor(async () => ((await page.getByText("Paste Markdown on the left").count()) === 1 ? true : null), "the empty state")) === true,
    "empty input shows a friendly empty state",
  );
  check((await copyBtn().isDisabled()) === true, "copy is disabled while there is no output");
  check(
    (await page.getByRole("button", { name: /Download markdown\.html/ }).isDisabled()) === true,
    "download is disabled while there is no output",
  );
  check((await out().count()) === 0, "the empty input mounts no output pane");
  check((await liveAlerts().count()) === 0, "empty input is not an error");
  check((await status(/nothing is uploaded/).count()) === 1, "the idle status states nothing is uploaded");
  await page.getByRole("button", { name: "Reset sample", exact: true }).click();
  check(
    await waitFor(async () => ((await outText()).includes("Release notes") ? true : null), "the sample to come back"),
    "Reset sample restores the sample",
  );

  // ---------- paste: the output must equal the expected HTML exactly ----------
  await editor().fill(FIXTURE_MD);
  const rendered = await waitFor(
    async () => ((await outText()) === FIXTURE_HTML ? FIXTURE_HTML : null),
    "the pasted fixture to render the expected HTML",
  );
  check(rendered === FIXTURE_HTML, "pasted markdown renders the exact expected HTML");
  check((await out().getAttribute("tabindex")) === "0", "the output pane is keyboard focusable for scrolling");
  check(!/script/i.test(rendered), "no script survives in the output");
  check(!/onerror/i.test(rendered), "no event handler survives in the output");
  check(rendered.includes("<a>bad</a>"), "an unsafe href is stripped but the link text stays");
  check((await liveAlerts().count()) === 0, "valid markdown raises no error");

  // ---------- the preview holds exactly the tags in the HTML pane ----------
  await previewBtn().click();
  await preview().waitFor({ state: "visible", timeout: 10000 });
  {
    const paneTags = [...new Set((rendered.match(/<\/?([a-z][a-z0-9]*)/g) ?? []).map((t) => t.replace(/^<\/?/, "")))].sort();
    const domTags = await preview()
      .evaluate((el) => [...new Set([...el.querySelectorAll("*")].map((n) => n.tagName.toLowerCase()))].sort());
    check(
      JSON.stringify(paneTags) === JSON.stringify(domTags),
      `preview DOM holds exactly the pane's tags (${paneTags.join(",")} vs ${domTags.join(",")})`,
    );
  }
  check((await preview().locator("h1").textContent()) === "Release", "preview renders the h1");
  check((await preview().locator("table th").count()) === 2, "preview renders the table headers");
  check((await preview().locator("ul li").count()) === 2, "preview renders the list items");
  check((await preview().locator("img[alt='alt']").count()) === 1, "preview renders the image with alt text");
  check((await preview().locator("a[href='https://example.com']").count()) === 1, "preview keeps the safe link");
  check((await preview().locator("blockquote p").textContent()) === "quote", "preview renders the blockquote");
  check((await preview().locator("script").count()) === 0, "no script element exists in the preview");
  check((await preview().locator("[onerror]").count()) === 0, "no element in the preview carries onerror");
  check((await page.evaluate(() => window.__xss)) === 0, "the injected payload never executed");
  await htmlBtn().click();
  await out().waitFor({ state: "visible", timeout: 10000 });

  // ---------- a real keystroke paste path (input events, not just fill) ----------
  await editor().fill("");
  await editor().click();
  await page.keyboard.insertText("# Pasted\n\nby insertText");
  check(
    await waitFor(async () => ((await outText()).includes("<h1>Pasted</h1>") ? true : null), "the typed paste to render"),
    "a pasted keystroke stream converts like any other input",
  );
  await editor().fill(FIXTURE_MD);
  await waitFor(async () => ((await outText()) === FIXTURE_HTML ? true : null), "the fixture to come back");

  // ---------- one-click copy writes the exact string ----------
  await copyBtn().click();
  const copied = await waitFor(
    async () => {
      const announced = (await page.locator("[role='status']", { hasText: "Copied to clipboard" }).count()) === 1;
      const clip = await page.evaluate(() => window.__clipboard);
      return announced && clip ? { clip, announced } : null;
    },
    "the copy confirmation and the clipboard value",
  );
  check(copied.clip === FIXTURE_HTML, "copy writes exactly the HTML shown in the pane");
  check(copied.announced, "copy is announced to assistive tech");

  // ---------- download: placeholder name, standalone document, no scripts ----------
  const first = await captureDownload(
    page.getByRole("button", { name: /Download markdown\.html/ }),
    "out1.html",
  );
  check(first.name === "markdown.html", "default download uses the disclosed placeholder name");
  check(first.text.startsWith("<!DOCTYPE html>"), "download starts with a doctype");
  check(first.text.includes('<meta charset="utf-8">'), "download declares a charset");
  check(first.text.includes(FIXTURE_HTML), "download body contains the rendered fragment");
  check(!/<script/i.test(first.text), "downloaded file carries no script");
  check((await status(/Downloaded markdown\.html/).count()) === 1, "the download is announced with its filename");

  // ---------- open a .md file: the download is named from the source ----------
  await fileInput().setInputFiles(`${DL}/notes.md`);
  await status(/Loaded notes\.md/).waitFor({ timeout: 20000 });
  check(
    (await status(/Loaded notes\.md/).first().textContent()).includes("notes.html"),
    "loading a file names the download from the source file",
  );
  check((await page.getByLabel("Download name").inputValue()) === "notes", "the download name field follows the source file");
  const notesHtml = await waitFor(
    async () => ((await outText()).includes("One line of") ? await outText() : null),
    "the loaded file to render",
  );
  check(notesHtml.includes("<strong>bold</strong>"), "the loaded file converts");
  const second = await captureDownload(
    page.getByRole("button", { name: /Download notes\.html/ }),
    "out2.html",
  );
  check(second.name === "notes.html", "download is named <source>.html");
  check(second.text.includes(notesHtml), "the second download contains that fragment");

  // ---------- an editable name is honoured and sanitized ----------
  await page.getByLabel("Download name").fill("../evil name");
  check(
    (await page.getByRole("button", { name: /Download -evil name\.html/ }).count()) === 1,
    "a hostile download name is neutralized",
  );
  await page.getByLabel("Download name").fill("report");
  const third = await captureDownload(
    page.getByRole("button", { name: /Download report\.html/ }),
    "out3.html",
  );
  check(third.name === "report.html", "a typed download name is honoured");

  // ---------- highlight tokens: off by default, on adds spans, off restores ----------
  // The tokens live in the output HTML (and therefore in the preview), not in the
  // read-only pane: the pane always shows the source text, escaped.
  const toggle = page.getByRole("checkbox");
  check((await toggle.isChecked()) === false, "highlight tokens are off by default");
  await editor().fill("```js\nconst a = 1; // note\n```\n");
  const plainPane = await waitFor(
    async () => ((await outText()).includes("const a = 1; // note") ? await outText() : null),
    "the fenced code block to render",
  );
  check(
    !plainPane.includes("tok tok-keyword"),
    "with tokens off the output keeps the code block plain",
  );
  await previewBtn().click();
  check(
    (await waitFor(
      async () => ((await preview().locator(".tok-keyword").count()) === 0 ? true : null),
      "the tokenless preview",
    )) === true,
    "the preview renders no token spans while tokens are off",
  );
  await htmlBtn().click();
  await toggle.check();
  const tokPane = await waitFor(
    async () => ((await outText()).includes("tok tok-keyword") ? await outText() : null),
    "the tokenized output",
  );
  check(
    tokPane.includes('<span class="tok tok-keyword">const</span>'),
    "turning tokens on wraps the fenced code in token spans",
  );
  check(
    tokPane.includes('<span class="tok tok-comment">// note</span>'),
    "tokens cover comments as well as keywords",
  );
  check(
    tokPane.replace(/<span class="tok [a-z-]+">/g, "").replace(/<\/span>/g, "") === plainPane,
    "token spans change only the markup, not the code text",
  );
  await previewBtn().click();
  check(
    (await waitFor(
      async () => ((await preview().locator("pre code .tok-keyword").count()) === 1 ? true : null),
      "the preview to render the token spans",
    )) === true,
    "the preview renders the token spans as real elements",
  );
  {
    const colors = await preview().evaluate((el) => ({
      base: getComputedStyle(el.querySelector("pre")).color,
      kw: getComputedStyle(el.querySelector(".tok-keyword")).color,
    }));
    check(
      colors.base !== colors.kw,
      `token spans are colored on the preview's dark code background (${colors.base} vs ${colors.kw})`,
    );
  }
  await htmlBtn().click();
  await toggle.uncheck();
  check(
    (await waitFor(
      async () => ((await outText()) === plainPane ? true : null),
      "the code block to return to plain text",
    )) === true,
    "turning tokens off restores clean HTML",
  );

  // ---------- the disclosed input cap ----------
  check(
    (await editor().getAttribute("maxlength")) === String(MAX_INPUT_CHARS),
    "the editor declares the 200,000 character cap",
  );
  await page.getByLabel("Download name").fill("");
  check(
    (await page.getByText("placeholder, this is a paste tool with no file").count()) === 1,
    "emptying the name discloses that the default is a placeholder",
  );
  check(
    (await page.getByRole("button", { name: /Download markdown\.html/ }).count()) === 1,
    "an empty name falls back to the disclosed placeholder filename",
  );
  await page.getByLabel("Download name").fill("report");
  await editor().fill("y".repeat(MAX_INPUT_CHARS));
  check(
    await waitFor(
      async () => ((await page.getByText("capped at 200,000 characters").count()) === 1 ? true : null),
      "the cap notice",
    ),
    "reaching the cap discloses it",
  );
  const bigHtml = await outText();
  check(bigHtml.length > MAX_INPUT_CHARS, "a document at the cap still converts");
  check((await out().locator(".tok-tag").count()) === 0, "past the pane cap the same text is shown uncolored");
  await fileInput().setInputFiles(`${DL}/oversize.md`);
  await alert(/at most 200,000 characters/).waitFor({ timeout: 20000 });
  check(
    (await alert(/at most 200,000 characters/).count()) === 1,
    "an oversized file is refused with the cap stated",
  );
  await page.getByRole("button", { name: "Reset sample", exact: true }).click();

  // ---------- accessibility surface ----------
  {
    const labels = await page.locator("label[for]").allTextContents();
    check(
      labels.some((t) => t.includes("Markdown")) && labels.some((t) => t.includes("Download name")),
      "inputs have visible <label> associations",
    );
  }
  check((await preview().count()) === 0, "the preview region exists only in preview view");
  check((await fileInput().getAttribute("tabindex")) !== "-1", "the file input stays keyboard reachable behind its label");
  check((await page.getByLabel("Download name").getAttribute("maxlength")) === "60", "the download name field is bounded");
  await previewBtn().click();
  check((await preview().getAttribute("role")) === "region", "the preview is a labelled region");
  await htmlBtn().click();
  check((await out().count()) === 1, "switching back restores the pane");
  check(
    (await page.locator("button:has(svg)").first().isVisible()) === true,
    "toolbar controls render icons inside real buttons",
  );

  check(consoleIssues.length === 0, `no hydration errors (got ${consoleIssues.length})`);
  check(pageErrors.length === 0, `no page errors (got ${pageErrors.length})`);

  // ---------- honest marketing copy ----------
  const copyRes = await page.request.get(TOOL_PAGE);
  const html = copyRes.ok() ? await copyRes.text() : "";
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ");
  const lower = html.toLowerCase();
  check(copyRes.ok() && html.length > 100, "tool marketing page renders");
  check(/sanitiz/i.test(text), "copy explains the output is sanitized");
  check(/inline html/i.test(text) && /(unwrap|unwrapped)/i.test(text), "copy states the inline-HTML policy");
  check(/event handler/i.test(text), "copy names what is stripped");
  check(/regex-based/i.test(text) && /not a full parser/i.test(text), "copy is honest about the highlighter");
  check(text.includes("200,000"), "copy states the input cap");
  check(/(never uploaded|nothing is uploaded|no upload)/i.test(text), "copy states the privacy model");
  check(/standalone/i.test(text), "copy describes the downloaded document");
  check(!/shiki|highlight\.js|prism/i.test(lower), "copy does not name a highlighting engine we do not ship");
  check(!/(unlimited|no limit|infinitely large)/i.test(lower), "no hidden-limit overclaim");
  check(!/(ai[- ]powered|uses ai|llm)/i.test(lower), "no AI claim");
  check(
    !/(syntax[- ]highlighted html|professional highlighting|fully highlighted)/i.test(lower),
    "no overclaim that the output itself is a highlighted document",
  );

  const guideRes = await page.request.get(GUIDE);
  const guide = guideRes.ok() ? await guideRes.text() : "";
  check(guideRes.status() === 200, "the markdown-to-html guide renders");
  check(/sanitiz/i.test(guide), "guide keeps the sanitization disclosure");
  check(/200,000|200 000/.test(guide), "guide states the cap");
  check(!/shiki|highlight\.js/i.test(guide.toLowerCase()), "guide does not overclaim the highlighter");

  const sitemap = await (await page.request.get(`${BASE_URL}/sitemap.xml`)).text();
  check(sitemap.includes("/tools/md-to-html"), "sitemap lists the tool page");
  check(sitemap.includes("/guides/how-to-convert-markdown-to-html"), "sitemap lists the guide");
} catch (e) {
  failed++;
  check(false, `harness exception: ${String(e?.message ?? e).slice(0, 400)}`);
} finally {
  await browser.close();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
