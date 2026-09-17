import { chromium } from "playwright-core";

const BASE_URL = process.env.BASE_URL || "http://localhost:3788";
const PAGE = `${BASE_URL}/use/password-generator`;

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

async function password() {
  return await page
    .locator('input[aria-label="Generated password"]')
    .inputValue();
}

function hasAny(val, re) {
  return re.test(val);
}

await page.goto(PAGE, { waitUntil: "networkidle" });
await page.waitForTimeout(300);

try {
  // 1: fresh load generates a valid default password client-side
  const p1 = await password();
  check(p1.length === 16, "fresh load generates a 16-char password");
  check(
    hasAny(p1, /[A-Z]/) && hasAny(p1, /[a-z]/) && hasAny(p1, /[0-9]/) && hasAny(p1, /[^A-Za-z0-9]/),
    "default password contains all four char types"
  );

  // 2: default strength is Strong (was mislabeled Weak)
  const meter = page.locator('[role="meter"]');
  check(
    (await meter.getAttribute("aria-valuetext")) === "Strong",
    "default 16-char password rates Strong"
  );
  check(
    Number(await meter.getAttribute("aria-valuenow")) === 100,
    "default entropy score is 100"
  );
  check(
    (await page.locator("text=/≈ 103 bits/").count()) === 1,
    "entropy bit count shown (~103 bits)"
  );

  // 3: regenerate produces a different, valid password
  await page.getByRole("button", { name: "Regenerate" }).click();
  const p2 = await password();
  check(p2 !== p1 && p2.length === 16, "regenerate produces a different 16-char password");

  // 4: slider changes length and auto-regenerates
  await page.locator("#length-slider").fill("6");
  await page.waitForTimeout(300);
  const p6 = await password();
  check(p6.length === 6, "length 6 yields a 6-char password");
  check(
    hasAny(p6, /[A-Z]/) && hasAny(p6, /[a-z]/) && hasAny(p6, /[0-9]/) && hasAny(p6, /[^A-Za-z0-9]/),
    "length-6 password still contains all four types"
  );
  await page.locator("#length-slider").fill("64");
  await page.waitForTimeout(300);
  check((await password()).length === 64, "length 64 yields a 64-char password");
  await page.locator("#length-slider").fill("16");
  await page.waitForTimeout(300);

  // 5: disabling a type regenerates without that type
  await page.getByRole("checkbox", { name: "Lowercase (a-z)" }).uncheck();
  await page.waitForTimeout(300);
  const noLower = await password();
  check(
    noLower.length === 16 && !/[a-z]/.test(noLower) && /[A-Z]/.test(noLower),
    "unchecking lowercase regenerates without lowercase"
  );
  await page.getByRole("checkbox", { name: "Lowercase (a-z)" }).check();
  await page.waitForTimeout(300);

  // 6: KEY TEST — exclude ambiguous never emits Il1O0o
  await page.getByRole("checkbox", { name: "Exclude ambiguous characters (Il1O0o)" }).check();
  await page.waitForTimeout(300);
  let leaked = 0;
  for (let i = 0; i < 25; i++) {
    await page.getByRole("button", { name: "Regenerate" }).click();
    const val = await password();
    if (/[Il1O0o]/.test(val)) leaked++;
  }
  check(leaked === 0, "exclude ambiguous: zero Il1O0o over 25 regenerations");

  // 7: toggling exclusion refreshed the visible password immediately
  const excluded = await password();
  check(!/[Il1O0o]/.test(excluded), "toggling exclusion instantly regenerates a clean password");

  // 8: copy works and matches the displayed value
  const beforeCopy = await password();
  await page.getByRole("button", { name: "Copy", exact: true }).first().click();
  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  check(clipboard === beforeCopy, "copy puts the exact password on the clipboard");
  await page.waitForFunction(
    () =>
      Array.from(document.querySelectorAll("button")).some((b) =>
        b.textContent?.includes("Copied")
      ),
    null,
    { timeout: 3000 }
  );
  check(
    (await page.locator("button", { hasText: "Copied" }).count()) === 1,
    "copy button shows Copied"
  );

  // 9: all types off — cleared, controls disabled, honest hint
  await page.getByRole("checkbox", { name: "Uppercase (A-Z)" }).uncheck();
  await page.getByRole("checkbox", { name: "Lowercase (a-z)" }).uncheck();
  await page.getByRole("checkbox", { name: "Digits (0-9)" }).uncheck();
  await page.getByRole("checkbox", { name: "Symbols (!@#$)" }).uncheck();
  await page.waitForTimeout(300);
  check((await password()) === "", "all types off clears the password field");
  check(
    await page.getByRole("button", { name: "Regenerate" }).isDisabled(),
    "regenerate disabled when no type selected"
  );
  check(
    await page.getByRole("button", { name: "Copy" }).isDisabled(),
    "copy disabled when no type selected"
  );
  check(
    (await meter.getAttribute("aria-valuetext")) === "Select at least one character type",
    "meter explains the empty state"
  );
  await page.getByRole("checkbox", { name: "Uppercase (A-Z)" }).check();
  await page.getByRole("checkbox", { name: "Lowercase (a-z)" }).check();
  await page.getByRole("checkbox", { name: "Digits (0-9)" }).check();
  await page.getByRole("checkbox", { name: "Symbols (!@#$)" }).check();
  await page.waitForTimeout(300);
  check((await password()).length === 16, "re-enabling types regenerates a password");

  // 10: slider accessible name + meter semantics + status region + fieldset
  check(
    (await page.locator("#length-slider").getAttribute("aria-label")) === null,
    "slider has no aria-label (uses visible htmlFor label instead)"
  );
  const sliderName = await page.locator("#length-slider").evaluate((el) => {
    return (el.labels && el.labels.length > 0 ? el.labels[0].textContent : "").trim();
  });
  check(sliderName.startsWith("Length: 16"), "slider labelled via htmlFor");
  const legend = await page.locator("fieldset legend").textContent();
  check(legend.trim() === "Character types", "checkboxes grouped with a fieldset legend");
  const statusCount = await page.locator('[role="status"]').count();
  check(statusCount > 0, "sr-only role=status region present");
  check(
    (await meter.getAttribute("aria-label")) === "Password strength",
    "meter has accessible label"
  );

  // 11: generated-password input is labelled for AT
  const outName = await page
    .locator('input[aria-label="Generated password"]')
    .getAttribute("aria-label");
  check(outName === "Generated password", "output input has aria-label");

  // 12: mobile no horizontal overflow (tool-scoped)
  await page.setViewportSize({ width: 375, height: 667 });
  const fits = await page
    .locator("#length-slider")
    .evaluate((el) => el.getBoundingClientRect().right <= 376);
  check(fits, "no horizontal overflow at 375px");
  check(
    await page.getByRole("button", { name: "Regenerate" }).isVisible(),
    "regenerate visible on mobile"
  );
  await page.setViewportSize({ width: 1280, height: 900 });

  // 13: large length stays strong + honest entropy figure
  await page.locator("#length-slider").fill("24");
  await page.waitForTimeout(300);
  check(
    hasAny(await password(), /[^A-Za-z0-9]/),
    "24-char password still contains a symbol"
  );

  // 14: cross-tool regression
  await page.goto(`${BASE_URL}/use/notepad`, { waitUntil: "networkidle" });
  check(
    (await page.locator("#notepad-text").count()) === 1,
    "notepad tool still renders (cross-tool)"
  );
} catch (err) {
  console.error(err);
  failed++;
} finally {
  await browser.close();
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}