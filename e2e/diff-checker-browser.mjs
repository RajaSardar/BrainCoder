import { chromium } from "playwright-core";
import { writeFileSync, unlinkSync } from "node:fs";

const BASE_URL = process.env.BASE_URL || "http://localhost:3788";
const PAGE = `${BASE_URL}/use/diff-checker`;

const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({
  permissions: ["clipboard-read", "clipboard-write"],
  viewport: { width: 1280, height: 900 },
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

const leftArea = () => page.getByPlaceholder("Paste the original text…");
const rightArea = () => page.getByPlaceholder("Paste the changed text…");
const compare = () => page.getByRole("button", { name: "Compare" });
const copyBtn = () => page.getByRole("button", { name: "Copy as unified diff" });

async function fill(left, right) {
  await leftArea().fill(left);
  await rightArea().fill(right);
  await compare().click();
  await page.waitForTimeout(200);
}

async function clipboardText() {
  return await page.evaluate(() => navigator.clipboard.readText());
}

await page.goto(PAGE, { waitUntil: "networkidle" });
await page.waitForTimeout(300);

const crlfFile = "/tmp/dc-crlf-left.txt";
writeFileSync(crlfFile, "a\r\nb\r\n");

try {
  check((await leftArea().inputValue()) === "", "SSR textarea ships empty");
  check(
    (await page.locator("tbody tr").count()) === 0,
    "no result table before Compare (memos gated on compared)"
  );

  await compare().click();
  check(
    (await page.getByText("No lines to compare").count()) === 1,
    "empty compare shows one message"
  );
  check(
    (await page.getByText("No differences found").count()) === 0,
    "empty compare does not also claim no differences"
  );

  await fill("abc", "abc");
  check(
    (await page.getByText("No differences found").count()) >= 1,
    "identical texts show No differences found"
  );
  check((await copyBtn().count()) === 0, "copy hidden when nothing differs");

  await page.getByRole("checkbox", { name: "Ignore case" }).check();
  await fill("Hello\nend", "hello\nother");
  const sameRow = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll("tbody tr"));
    return rows
      .filter((r) => r.children[2].textContent.trim() === "Hello")
      .map((r) => ({
        left: r.children[2].textContent.trim(),
        right: r.children[5].textContent.trim(),
      }));
  });
  check(
    sameRow.length === 1 && sameRow[0].right === "hello",
    "same row shows user's right-side spelling (was left text)"
  );
  await copyBtn().click();
  const clip1 = await clipboardText();
  check(
    clip1.includes(" Hello\n-end\n+other"),
    "copied unified diff uses git-style left-side context with +other"
  );
  check((await page.getByText("Copied").count()) === 1, "copy shows Copied");
  await page.getByRole("checkbox", { name: "Ignore case" }).uncheck();

  await fill("a\nb\nc", "a\nx\nc");
  check((await page.getByText("2 unchanged").count()) === 1, "a/x/c shows 2 unchanged");
  await copyBtn().click();
  const clip2 = await clipboardText();
  check(
    clip2 === "--- Original\n+++ Changed\n@@ -1,3 +1,3 @@\n a\n-b\n+x\n c",
    "copied unified diff is byte-exact"
  );

  const viewTablist = page.locator('[role="tablist"][aria-label="View"]');
  const ui = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll("tbody tr"));
    const heads = Array.from(document.querySelectorAll("thead th")).map((th) =>
      th.textContent.trim()
    );
    const markers = rows.reduce(
      (acc, tr) => {
        const cells = Array.from(tr.querySelectorAll("td"));
        if (cells[0].textContent.trim() === "−") acc.left++;
        if (cells[3].textContent.trim() === "+") acc.right++;
        return acc;
      },
      { left: 0, right: 0 }
    );
    return {
      heads,
      markers,
      legend: document.body.textContent.includes("Red = removed or modified"),
      live: document.querySelectorAll('[role="status"]').length,
    };
  });
  check(ui.markers.left >= 1 && ui.markers.right >= 1, "split view has - and + text markers");
  check(
    ui.heads.includes("Original") && ui.heads.includes("Changed"),
    "split table has th headers"
  );
  check(ui.legend, "legend explains red/green colors");
  check(ui.live > 0, "role=status live region present");
  check(
    (await viewTablist.getByRole("tab", { selected: true }).count()) === 1,
    "one selected role=tab in the View group"
  );

  const splitTab = viewTablist.getByRole("tab", { name: "Split" });
  const unifiedTab = viewTablist.getByRole("tab", { name: "Single file" });
  check(
    (await splitTab.getAttribute("aria-selected")) === "true",
    "Split tab starts selected"
  );
  await unifiedTab.focus();
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(150);
  check(
    (await splitTab.getAttribute("aria-selected")) === "true",
    "arrow key cycles tab focus with selection"
  );
  await unifiedTab.click();
  await page.waitForTimeout(150);
  check(
    (await page.getByText(/@@ -1,3 \+1,3 @@/).count()) === 1,
    "Single file view shows hunk header"
  );

  await page.locator('input[aria-label="Load original file"]').setInputFiles(crlfFile);
  await rightArea().fill("a\nb");
  await compare().click();
  await page.waitForTimeout(200);
  check(
    (await page.getByText("No differences found").count()) === 1,
    "CRLF upload vs LF paste compares equal (r stripped)"
  );
  unlinkSync(crlfFile);

  await page.getByRole("tab", { name: "Split" }).click();
  await fill("foo   bar", "foo bar");
  check(
    (await page.getByText("1 modified").count()) === 1,
    "default: internal space change is a modification"
  );
  await page.getByRole("checkbox", { name: "Ignore whitespace (git -w)" }).check();
  await page.waitForTimeout(150);
  check(
    (await page.getByText("No differences found").count()) === 1,
    "ignore whitespace (git -w) equalizes internal spaces"
  );
  await page.getByRole("checkbox", { name: "Ignore whitespace (git -w)" }).uncheck();

  await fill("hello ", "hello");
  await page.getByRole("checkbox", { name: "Ignore trailing spaces" }).check();
  await page.waitForTimeout(150);
  check(
    (await page.getByText("No differences found").count()) === 1,
    "ignore trailing spaces equalizes trailing space"
  );
  await page.getByRole("checkbox", { name: "Ignore trailing spaces" }).uncheck();

  await fill("\u4f60\u597d\u4e16\u754c", "\u4f60\u597d\uff0c\u4e16\u754c");
  const cjkHighlight = await page.evaluate(() => {
    const spans = Array.from(
      document.querySelectorAll("tbody tr td span.bg-green-100")
    );
    return spans.map((s) => s.textContent);
  });
  check(
    cjkHighlight.length === 1 && cjkHighlight[0] === "\uff0c",
    "CJK word diff highlights only the added fullwidth comma"
  );

  await fill("pre \ud83d\ude00 post", "pre \ud83d\ude42 post");
  await page.getByRole("tab", { name: "Characters" }).click();
  await compare().click();
  await page.waitForTimeout(200);
  const emojiOk = await page.evaluate(() => {
    const cells = Array.from(document.querySelectorAll("tbody tr td"));
    const text = cells.map((c) => c.textContent).join("|");
    return { hasReplacement: text.includes("\ufffd"), hasSmiley: text.includes("\ud83d\ude42") };
  });
  check(!emojiOk.hasReplacement, "character granularity keeps emoji intact (no U+FFFD)");
  check(emojiOk.hasSmiley, "right side shows the changed emoji");

  const targetSize = await page.getByRole("checkbox", { name: "Ignore case" }).evaluate((el) => {
    const label = el.closest("label");
    return label ? label.getBoundingClientRect().height : 0;
  });
  check(targetSize >= 40, "ignore-case label is a touch-sized target");

  await page.setViewportSize({ width: 375, height: 667 });
  const fits = await leftArea().evaluate((el) => {
    const container = el.closest("div.space-y-5");
    return container ? container.scrollWidth <= container.clientWidth + 1 : true;
  });
  check(fits, "tool content fits within 375px without horizontal overflow");
  check(await compare().isVisible(), "Compare button visible on mobile");
  await page.setViewportSize({ width: 1280, height: 900 });

  const big = "line\n".repeat(2200);
  await leftArea().fill(big);
  await rightArea().fill(big);
  check(
    (await page.getByText(/Large input detected/).count()) === 1,
    "large input shows honest warning banner"
  );

  await page.goto(`${BASE_URL}/use/notepad`, { waitUntil: "networkidle" });
  check(
    (await page.locator("#notepad-text").count()) === 1,
    "notepad still renders (cross-tool)"
  );
} catch (err) {
  console.error(err);
  failed++;
} finally {
  await browser.close();
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}