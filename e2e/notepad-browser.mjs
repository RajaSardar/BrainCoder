import { chromium } from "playwright-core";
import { writeFileSync, readFileSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const BASE_URL = process.env.BASE_URL || "http://localhost:3788";
const PAGE = `${BASE_URL}/use/notepad`;

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

async function clearNotepad() {
  await page.goto(PAGE, { waitUntil: "networkidle" });
  await page.waitForTimeout(350);
  await page.locator("#notepad-text").fill("");
  await page.waitForTimeout(250);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(250);
}

const TXT = join(tmpdir(), `notepad-test-${Date.now()}.txt`);

try {
  // 1: fresh load
  await clearNotepad();
  check(
    (await page.locator("#notepad-text").inputValue()) === "",
    "fresh load textarea empty"
  );
  check(
    (await page.locator("#notepad-meta").textContent()) ===
      "0 words · 0 chars · auto-saves locally",
    "fresh load shows 0 words"
  );

  // 2: typing updates counts immediately
  await page.locator("#notepad-text").fill("hello world");
  check(
    (await page.locator("#notepad-meta").textContent()) ===
      "2 words · 11 chars · auto-saves locally",
    "word/char count updates immediately"
  );

  // 3: auto-save persists across reload
  await page.waitForTimeout(800);
  await page.reload({ waitUntil: "networkidle" });
  check(
    (await page.locator("#notepad-text").inputValue()) === "hello world",
    "reload restores auto-saved note"
  );

  // 4: fast reload persists now (pagehide flush)
  await clearNotepad();
  await page.locator("#notepad-text").fill("fast flush text");
  await page.reload({ waitUntil: "networkidle" });
  check(
    (await page.locator("#notepad-text").inputValue()) === "fast flush text",
    "fast reload persists after pagehide flush"
  );

  // 5: copy to clipboard
  await page.getByRole("button", { name: "Copy" }).click();
  await page.waitForTimeout(300);
  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  check(clipboard === "fast flush text", "copy reads text");
  await page.waitForFunction(
    () =>
      Array.from(document.querySelectorAll("button")).some((b) =>
        b.textContent?.includes("Copied")
      ),
    null,
    { timeout: 3000 }
  );
  check(
    (await page.locator("button", { hasText: "Copied" }).textContent()).includes(
      "Copied"
    ),
    "copy button shows Copied"
  );

  // 6: save download
  await clearNotepad();
  await page.locator("#notepad-text").fill("Meeting notes tomorrow");
  const download = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Save" }).click(),
  ]);
  const dl = download[0];
  const expectedDate = new Date().toISOString().slice(0, 10);
  check(
    dl.suggestedFilename() === `meeting-notes-tomorrow-${expectedDate}.txt`,
    "download filename derived from first line"
  );
  const body = await dl.path().then((p) => readFileSync(p, "utf8"));
  check(body === "Meeting notes tomorrow", "download content matches textarea");

  // 7: clear two-step flow
  await page.getByRole("button", { name: "Clear" }).click();
  check(
    (await page.getByRole("button", { name: "Confirm clear" }).count()) === 1,
    "Clear arms to Confirm clear"
  );
  // click away and wait for disarm
  await page.locator("#notepad-text").click();
  await page.waitForTimeout(4500);
  check(
    (await page.getByRole("button", { name: "Clear" }).count()) === 1 &&
      (await page.getByRole("button", { name: "Confirm clear" }).count()) === 0,
    "armed Clear auto-reverts after timeout"
  );
  // now actually clear
  await page.getByRole("button", { name: "Clear" }).click();
  await page.getByRole("button", { name: "Confirm clear" }).click();
  check(
    (await page.locator("#notepad-text").inputValue()) === "",
    "clear empties textarea"
  );
  check(
    (await page.locator("#notepad-meta").textContent()) ===
      "0 words · 0 chars · auto-saves locally",
    "clear resets word count"
  );

  // 8: open file + same-file re-select
  writeFileSync(TXT, "from file 123");
  await page.getByRole("button", { name: "Open" }).click();
  await page.locator('input[type="file"]').setInputFiles(TXT);
  await page.waitForTimeout(200);
  check(
    (await page.locator("#notepad-text").inputValue()) === "from file 123",
    "open file loads content"
  );
  // re-open same file
  await page.locator('input[type="file"]').setInputFiles(TXT);
  await page.waitForTimeout(200);
  check(
    (await page.locator("#notepad-text").inputValue()) === "from file 123",
    "re-open same file fires onChange"
  );
  const activeTag = await page.evaluate(() => document.activeElement?.tagName);
  check(activeTag === "TEXTAREA", "focus on textarea after file open");

  // 9: overwrite with typing
  await page.locator("#notepad-text").selectText();
  await page.keyboard.type("replaced content");
  check(
    (await page.locator("#notepad-text").inputValue()) === "replaced content",
    "typing replaces selected content"
  );

  // 10: mobile viewport
  await page.setViewportSize({ width: 375, height: 667 });
  const fits = await page
    .locator("#notepad-text")
    .evaluate((el) => el.getBoundingClientRect().right <= 376);
  check(fits, "no horizontal overflow at 375px");
  for (const name of ["Open", "Save", "Copy"]) {
    const btn = page.getByRole("button", { name }).first();
    check(await btn.isVisible(), `button ${name} visible on mobile`);
  }
  await page.setViewportSize({ width: 1280, height: 900 });

  // 11: unicode word/char counts
  await clearNotepad();
  await page.locator("#notepad-text").fill("café ☕ 東京");
  check(
    (await page.locator("#notepad-meta").textContent()) ===
      "3 words · 9 chars · auto-saves locally",
    "unicode counts correctly"
  );

  // 12: label and accessibility attributes
  check(
    (await page.locator('label[for="notepad-text"]').textContent()).trim() ===
      "Notes",
    "textarea has visible label Notes"
  );
  const describedby = await page
    .locator("#notepad-text")
    .getAttribute("aria-describedby");
  check(describedby === "notepad-meta", "textarea has aria-describedby");

  // 13: status region exists
  const statusExists = await page.locator('[role="status"]').count();
  check(statusExists > 0, "sr-only role=status region present");

  // 14: save fires and updates label
  await clearNotepad();
  await page.locator("#notepad-text").fill("Auto-save test");
  const beforeSave = (
    await page.locator("#notepad-meta").textContent()
  ).includes("auto-saves locally");
  check(beforeSave, "before save label says auto-saves locally");
  await page.waitForTimeout(800);
  const afterSave = (await page.locator("#notepad-meta").textContent()).includes(
    "saved at"
  );
  check(afterSave, "after save label updates to saved at");

  // 15: copy disabled when empty, enabled with text
  await clearNotepad();
  check(
    await page.getByRole("button", { name: "Copy" }).isDisabled(),
    "copy disabled when empty"
  );
  await page.locator("#notepad-text").fill("a");
  check(
    !(await page.getByRole("button", { name: "Copy" }).isDisabled()),
    "copy enabled when text present"
  );

  // 16: over-capacity warning
  await clearNotepad();
  const longText = "a".repeat(2_000_001);
  await page.evaluate((t) => {
    const ta = document.querySelector("#notepad-text");
    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      "value"
    ).set;
    nativeSetter.call(ta, t);
    ta.dispatchEvent(new Event("input", { bubbles: true }));
  }, longText);
  await page.waitForTimeout(200);
  const alert = page.locator('[role="alert"]:not(#__next-route-announcer__)');
  const alertVisible = await alert.isVisible();
  check(alertVisible, "over-capacity shows role=alert warning");
  const alertText = await alert.textContent();
  check(
    alertText.includes("2 million"),
    "over-capacity warning text correct"
  );
  check(
    (await page.locator("#notepad-text").inputValue()).length <= 2_000_000,
    "textarea content capped"
  );
  await page.locator('button[aria-label="Dismiss error"]').click();
  check(!(await alert.isVisible()), "error dismiss works");

  // 17: cross-tool regression
  await page.goto(`${BASE_URL}/use/base64`, { waitUntil: "networkidle" });
  const radios = await page.locator('[role="radio"]').count();
  check(radios > 0, "base64 tool radios present (cross-tool)");
} catch (err) {
  console.error(err);
  failed++;
} finally {
  try {
    unlinkSync(TXT);
  } catch {}
  await browser.close();
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}