// Production-browser E2E for JWT Decoder.
// Run against an existing production server: BASE_URL=http://localhost:3801 node e2e/jwt-decoder-browser.mjs
//
// Authored against the real component. Not executed here (no server, no build
// in this change) — the Node mirror in audit/check-jwt-decoder.mjs is what
// actually ran. Every assertion below is a claim about what a user sees, and
// they are deliberately written against the labels and roles the component
// actually renders rather than against test ids it does not have.
import assert from "node:assert/strict";
import { chromium } from "playwright-core";

const BASE_URL = process.env.BASE_URL || "http://localhost:3801";

const b64url = (s) => Buffer.from(s, "utf8").toString("base64url");
const seg = (o) => b64url(JSON.stringify(o));

const SEC = Math.floor(Date.now() / 1000);
const GOOD = [
  seg({ alg: "HS256", typ: "JWT", kid: "k1" }),
  seg({
    iss: "https://issuer.example",
    sub: "user-42",
    aud: ["api", "admin"],
    exp: SEC + 7200,
    nbf: SEC - 60,
    iat: SEC - 300,
    jti: "abc-123",
    scope: "read write",
  }),
  "9ZwGs2NbR1lpUHRBxQWjJs2SS4tr0xYViHjq5M0KgRU",
].join(".");

const ARRAY_PAYLOAD = `${seg({ alg: "none", typ: "JWT" })}.${seg([1, 2, 3])}.sig`;
const MARKUP_PAYLOAD = `${seg({ alg: "none" })}.${seg({ role: "<img src=x onerror=\"window.__pwned=1\">" })}.sig`;

let passed = 0;
const failures = [];

async function check(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`ok  ${name}`);
  } catch (err) {
    failures.push({ name, err });
    console.log(`NOT ${name}`);
    console.log(`    ${String(err.message).split("\n").join("\n    ")}`);
  }
}

const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  permissions: ["clipboard-read", "clipboard-write"],
});
const page = await context.newPage();
page.setDefaultTimeout(30000);

const field = () => page.getByLabel("JSON Web Token (compact serialization)");
const root = () => field().locator("xpath=ancestor::div[contains(@class,'space-y-4')][1]");
const alertBox = () => page.locator('[role="alert"]:not(#__next-route-announcer__)');
const live = () => root().locator('div[role="status"][aria-live="polite"]');
// Panel titles carry counts, so the accessible name is matched by prefix.
const panel = (title) => page.locator(`section[role="region"][aria-label^="${title}"]`);
const copyBtn = (label) => page.getByRole("button", { name: label, exact: true });

/** Every request this page makes, so the privacy claim can be checked. */
const requests = [];
page.on("request", (req) => requests.push(req));

async function setToken(value) {
  await field().fill(value);
}

async function setHuge(n) {
  await page.evaluate((size) => {
    const el = document.querySelector('textarea[spellcheck="false"]');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
    setter.call(el, "a".repeat(size));
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }, n);
}

async function readClipboard() {
  return page.evaluate(() => navigator.clipboard.readText());
}

try {
  await page.goto(`${BASE_URL}/use/jwt-decoder`, { waitUntil: "networkidle" });
  await check("tool page loads", () => assert.ok(page.url().includes("/use/jwt-decoder")));

  await check("default state: empty, no alert, no panels, no demo token", async () => {
    assert.equal(await field().inputValue(), "");
    assert.equal(await alertBox().count(), 0);
    assert.equal(await panel("Structure").count(), 0);
    assert.equal(await panel("Header").count(), 0);
    assert.equal(await panel("Payload").count(), 0);
    assert.equal(await panel("Claims").count(), 0);
    assert.equal(await copyBtn("Copy the raw token").count(), 0);
    assert.equal(await root().getByRole("button", { name: "Clear" }).count(), 0);
    assert.match(await field().getAttribute("placeholder"), /header\.payload\.signature/);
    const body = await root().textContent();
    assert.ok(!/eyJ[A-Za-z0-9_-]{8,}/.test(body), "no sample token is rendered on boot");
    assert.match(body, /no sample token is loaded/);
  });

  await check("honesty banner is visible, above the input, and not a footnote", async () => {
    const banner = root().locator("div:has(> p:has-text('Decoded, not verified.'))");
    assert.equal(await banner.count(), 1);
    const text = await banner.textContent();
    assert.match(text, /Decoded, not verified\./);
    assert.match(text, /no key, no issuer/);
    assert.match(text, /never tells you whether a token is authentic/);
    assert.match(text, /never sent anywhere/);
    // compareDocumentPosition runs in the page, so both nodes have to be
    // handed in as real DOM handles rather than locators. DOCUMENT_POSITION_FOLLOWING
    // is the bit that means "the field comes after the banner in document order".
    const [bannerEl, fieldEl] = await Promise.all([banner.elementHandle(), field().elementHandle()]);
    const relation = await bannerEl.evaluate(
      (el, input) => el.compareDocumentPosition(input) & Node.DOCUMENT_POSITION_FOLLOWING,
      fieldEl
    );
    assert.equal(relation, 4, "the banner precedes the input in the DOM");
  });

  await check("input is labelled and described, and root reports aria-busy=false", async () => {
    assert.equal(await field().count(), 1);
    assert.ok(await field().getAttribute("aria-describedby"));
    assert.equal(await field().getAttribute("aria-invalid"), "false");
    assert.equal(await field().getAttribute("spellcheck"), "false");
    assert.equal(await field().getAttribute("autocomplete"), "off");
    assert.equal(await root().getAttribute("aria-busy"), "false");
  });

  await setToken(GOOD);
  await check("valid token: three segments decoded, structure report is complete", async () => {
    assert.equal(await alertBox().count(), 0);
    const rows = panel("Structure").locator("li");
    assert.equal(await rows.count(), 3);
    const text = await panel("Structure").textContent();
    for (const name of ["Header", "Payload", "Signature"]) {
      assert.match(text, new RegExp(name));
    }
    assert.match(text, /Decoded/);
    // 38 bytes is the real decoded length of {"alg":"HS256","typ":"JWT","kid":"k1"}.
    assert.match(text, /38 bytes/, "the header's real byte length is shown");
  });

  await check("header panel shows alg, typ, kid and the raw JSON", async () => {
    const text = await panel("Header").textContent();
    assert.match(text, /HS256/);
    assert.match(text, /JWT/);
    assert.match(text, /k1/);
    assert.match(text, /"alg": "HS256"/);
  });

  await check("payload panel shows the pretty-printed payload", async () => {
    const text = await panel("Payload").textContent();
    assert.match(text, /user-42/);
    assert.match(text, /https:\/\/issuer\.example/);
    assert.match(text, /"iss": "https:\/\/issuer\.example"/);
  });

  await check("claims panel: registered claims first, private claim last", async () => {
    const text = await panel("Claims").textContent();
    assert.match(text, /^Claims \(\d+\)/);
    const keys = await panel("Claims").locator("li code").allTextContents();
    assert.deepEqual(keys.slice(0, 7), ["iss", "sub", "aud", "exp", "nbf", "iat", "jti"]);
    assert.equal(keys[7], "scope");
    // kid and typ are JOSE header parameters, not RFC 7519 payload claims, so
    // this token carries every registered payload claim and the "not present"
    // line must be absent rather than listing header fields.
    assert.ok(
      !/Not present in this token/.test(text),
      "the claims panel names no missing claim when all seven registered payload claims are present"
    );
  });

  await check("date claims read as real dates and real relative times", async () => {
    const text = await panel("Claims").textContent();
    // The token is built at SEC and the page reads it a second or two later, so a
    // relative reading can pick up a seconds component. The unit under test is
    // the direction and the magnitude, not the exact second.
    assert.match(text, /Expires in 1 hour(?: \d+ (?:second|minute)s?)?/, "exp reads as a countdown");
    assert.match(text, /Valid since 1 minute(?: \d+ seconds?)? ago/, "nbf reads as a past reading");
    assert.match(text, /Issued 5 minutes(?: \d+ seconds?)? ago/, "iat reads as a past reading");
    assert.match(text, /\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} UTC/, "an absolute UTC date is shown");
  });

  await check("live region announces the decode, with the honesty caveat", async () => {
    const text = await live().textContent();
    assert.match(text, /Decoded 3 segments and 8 claims\./);
    assert.match(text, /Decoded, not verified\./);
  });

  await check("copy buttons: three, distinct names, all enabled once decoded", async () => {
    for (const label of ["Copy the raw token", "Copy the decoded header", "Copy the decoded payload"]) {
      assert.equal(await copyBtn(label).count(), 1, `${label} is present exactly once`);
      assert.equal(await copyBtn(label).isEnabled(), true, `${label} is enabled`);
    }
  });

  await check("copy buttons put the exact decoded text on the clipboard", async () => {
    await copyBtn("Copy the decoded header").click();
    assert.deepEqual(JSON.parse(await readClipboard()), {
      alg: "HS256",
      typ: "JWT",
      kid: "k1",
    });
    await copyBtn("Copy the decoded payload").click();
    assert.equal(JSON.parse(await readClipboard()).sub, "user-42");
    await copyBtn("Copy the raw token").click();
    assert.equal(await readClipboard(), GOOD);
  });

  await check("raw token is never sent anywhere (checked on the real request log)", () => {
    assert.ok(requests.length > 0, "the page did load, so the log is meaningful");
    const leaked = requests.filter((r) => {
      try {
        return (
          (r.postData() ?? "").includes(GOOD) ||
          (r.url() ?? "").includes(GOOD) ||
          (r.postData() ?? "").includes("user-42")
        );
      } catch {
        return false;
      }
    });
    assert.equal(leaked.length, 0, `token text appeared in ${leaked.length} request(s)`);
  });

  await setToken(ARRAY_PAYLOAD);
  await check("array payload decodes and is disclosed as a non-object", async () => {
    assert.equal(await alertBox().count(), 0);
    const text = await panel("Payload").textContent();
    assert.match(text, /This payload is a JSON array, not a JSON object/);
    assert.match(text, /\[/);
    assert.match(text, /no named claims to read dates out of/);
    assert.equal(await panel("Claims").locator("li").count(), 0);
    assert.match(await panel("Claims").textContent(), /carries no named claims/);
  });

  await setToken(MARKUP_PAYLOAD);
  await check("markup in a claim is rendered as text and never executed", async () => {
    assert.equal(await page.evaluate(() => window.__pwned), undefined);
    assert.equal(await root().locator('img[src="x"]').count(), 0);
    const text = await panel("Claims").textContent();
    assert.ok(text.includes("<img src=x onerror="), "the markup is visible verbatim as text");
    assert.equal(await page.evaluate(() => window.__pwned), undefined);
  });

  await setToken("abc.def");
  await check("two segments: refused by name, with the real count", async () => {
    assert.equal(await alertBox().count(), 1);
    assert.match(await alertBox().textContent(), /Not read as a JWT\./);
    assert.match(await alertBox().textContent(), /2 segments/);
    assert.equal(await panel("Header").count(), 0);
    assert.equal(await panel("Payload").count(), 0);
    assert.equal(await panel("Structure").locator("li").count(), 2, "the partial structure is still shown");
    assert.match(await live().textContent(), /not read as a JWT/i);
  });

  await setToken("a.b.c.d");
  await check("four segments: refused", async () => {
    assert.match(await alertBox().textContent(), /4 segments/);
  });

  await setToken("a.b.c.d.e");
  await check("five segments: named as a JWE, not half-decoded", async () => {
    const text = await alertBox().textContent();
    assert.match(text, /JWE/);
    assert.match(text, /five/);
    assert.equal(await panel("Header").count(), 0);
  });

  await setToken("onlyonesegment");
  await check("one segment: refused with the real count", async () => {
    assert.match(await alertBox().textContent(), /1 segment/);
  });

  await setToken(`ab+cd.${seg({ a: 1 })}.sig`);
  await check("standard-Base64 character: refused with the real reason", async () => {
    const text = await alertBox().textContent();
    assert.match(text, /header segment could not be read/);
    assert.match(text, /standard Base64/);
  });

  await setToken(`${seg({ alg: "none" })}.ab cd.sig`);
  await check("space in a segment: refused by position", async () => {
    assert.match(await alertBox().textContent(), /position 3/);
  });

  await setToken(`${seg({ alg: "none" })}.${b64url("{oops}")}.sig`);
  await check("payload that is not JSON: refused with the parser's reason", async () => {
    const text = await alertBox().textContent();
    assert.match(text, /payload segment could not be read/);
    assert.match(text, /not valid JSON/);
    assert.match(text, /\{oops\}/);
  });

  await setToken(`${b64url("[1,2]")}.${seg({ a: 1 })}.sig`);
  await check("header that is not an object: refused with the RFC", async () => {
    assert.match(await alertBox().textContent(), /RFC 7515/);
  });

  await setToken(`.${seg({ a: 1 })}.sig`);
  await check("empty header segment: refused, not treated as {}", async () => {
    assert.match(await alertBox().textContent(), /empty/i);
  });

  await setToken(`${seg({ alg: "none" })}.${seg({ sub: "x" })}.`);
  await check("alg:none with an empty signature decodes and is called unsecured", async () => {
    assert.equal(await alertBox().count(), 0);
    const text = await panel("Structure").textContent();
    assert.match(text, /unsecured/i);
  });

  await setToken(`${seg({ alg: "HS256" })}.${seg({ sub: "x" })}.ab+cd`);
  await check("unreadable signature: header and payload still shown, signature still unchecked", async () => {
    assert.equal(await alertBox().count(), 0);
    assert.equal(await panel("Header").count(), 1);
    assert.equal(await panel("Payload").count(), 1);
    assert.match(await root().textContent(), /signature segment is not readable/);
    assert.match(await root().textContent(), /still not checked/);
  });

  await setToken("");
  await check("clearing back to empty restores the boot state exactly", async () => {
    assert.equal(await alertBox().count(), 0);
    assert.equal(await panel("Structure").count(), 0);
    assert.equal(await panel("Header").count(), 0);
    assert.match(await root().textContent(), /no sample token is loaded/);
  });

  await setHuge(262_144 + 1);
  await check("over the cap: refused with the real numbers, nothing decoded", async () => {
    assert.equal(await field().inputValue().then((v) => v.length), 262_145);
    const text = await alertBox().textContent();
    assert.match(text, /262,145 characters/);
    assert.match(text, /262,144 characters \(256 KB\)/);
    assert.match(text, /nothing was decoded/);
    assert.equal(await panel("Structure").count(), 0);
    assert.equal(await panel("Header").count(), 0);
    assert.equal(await field().getAttribute("aria-invalid"), "true");
    assert.match(await root().textContent(), /262,145 of 262,144 characters \(256 KB\)\./);
  });

  await setHuge(262_144);
  await check("exactly at the cap: no size refusal, the real reason is shown", async () => {
    const text = await alertBox().textContent();
    assert.ok(!text.includes("262,144 characters (256 KB) limit"), "the size message does not fire at the cap");
    assert.match(text, /1 segment/);
    assert.equal(await panel("Structure").locator("li").count(), 1);
    assert.equal(await field().getAttribute("aria-invalid"), "false");
  });

  await setToken(GOOD);
  await check("recovers from the over-cap refusal", async () => {
    assert.equal(await alertBox().count(), 0);
    assert.equal(await panel("Header").count(), 1);
    assert.equal(await field().getAttribute("aria-invalid"), "false");
  });

  await root().getByRole("button", { name: "Clear" }).click();
  await check("Clear empties the field and removes every panel", async () => {
    assert.equal(await field().inputValue(), "");
    assert.equal(await panel("Structure").count(), 0);
    assert.equal(await panel("Payload").count(), 0);
    assert.equal(await copyBtn("Copy the raw token").count(), 0);
    assert.equal(await alertBox().count(), 0);
  });

  await check("all three panels are named regions with the copy buttons inside them", async () => {
    await setToken(GOOD);
    for (const [title, label] of [
      ["Header", "Copy the decoded header"],
      ["Payload", "Copy the decoded payload"],
    ]) {
      assert.equal(await panel(title).getByRole("button", { name: label, exact: true }).count(), 1);
    }
  });

  await check("no horizontal overflow in the tool subtree at 375px", async () => {
    await setToken(GOOD);
    await page.setViewportSize({ width: 375, height: 667 });
    const { maxRight, vw } = await page.evaluate(() => {
      const el = document.querySelector('textarea[spellcheck="false"]');
      const container = el.closest("div.space-y-4");
      let maxRight = 0;
      for (const child of container.querySelectorAll("*")) {
        const r = child.getBoundingClientRect();
        if (r.width) maxRight = Math.max(maxRight, r.right);
      }
      return { maxRight, vw: document.documentElement.clientWidth };
    });
    assert.ok(maxRight <= vw + 1, `maxRight ${maxRight} > vw ${vw}`);
  });

  await page.setViewportSize({ width: 1280, height: 900 });
  await check("keyboard: the field is reachable and focus is visible", async () => {
    await page.locator('textarea[spellcheck="false"]').focus();
    assert.equal(await page.evaluate(() => document.activeElement.tagName), "TEXTAREA");
    const ring = await page
      .locator('textarea[spellcheck="false"]')
      .evaluate((el) => getComputedStyle(el).outlineStyle + " " + getComputedStyle(el).outlineWidth);
    assert.ok(!/none/.test(ring), `focus ring is not suppressed (${ring})`);
  });

  await check("long single-line claim wraps instead of pushing the page wide", async () => {
    const long = "y".repeat(400);
    await setToken(`${seg({ alg: "none" })}.${seg({ blob: long })}.sig`);
    const overflow = await page.evaluate(() => {
      const el = document.querySelector('textarea[spellcheck="false"]');
      const container = el.closest("div.space-y-4");
      let maxRight = 0;
      for (const child of container.querySelectorAll("*")) {
        const r = child.getBoundingClientRect();
        if (r.width) maxRight = Math.max(maxRight, r.right);
      }
      return maxRight - document.documentElement.clientWidth;
    });
    assert.ok(overflow <= 1, `long claim overflows by ${overflow}px`);
  });

  await check("a huge claim is truncated on screen and reports its real length", async () => {
    const blob = "z".repeat(2000);
    await setToken(`${seg({ alg: "none" })}.${seg({ blob })}.sig`);
    const text = await panel("Claims").textContent();
    assert.match(text, /Shown truncated/);
    assert.match(text, /2,000 characters long/);
    await copyBtn("Copy the decoded payload").click();
    const copied = JSON.parse(await readClipboard());
    assert.equal(copied.blob.length, 2000, "the copy button still gives the full value");
  });

  await check("wrong-typed exp is read but flagged, not rendered as a date", async () => {
    await setToken(`${seg({ alg: "none" })}.${seg({ exp: String(SEC + 60) })}.sig`);
    const text = await panel("Claims").textContent();
    assert.match(text, /JSON string/);
    assert.match(text, /Expires in (?:1 minute|5\d seconds)/);
  });

  await check("impossible exp is refused rather than rendered as a wrong date", async () => {
    await setToken(`${seg({ alg: "none" })}.${seg({ exp: 1e300 })}.sig`);
    const text = await panel("Claims").textContent();
    assert.match(text, /outside the range/);
    assert.ok(!/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} UTC/.test(text), "no bogus date is shown");
  });

  await check("Bearer prefix and stray whitespace are scrubbed and disclosed", async () => {
    await setToken(`  Bearer ${GOOD}  `);
    assert.equal(await alertBox().count(), 0);
    assert.equal(await panel("Header").count(), 1);
    assert.match(await root().textContent(), /Bearer/);
    // The disclosure names what actually happened rather than paraphrasing it.
    assert.match(await root().textContent(), /Ignored whitespace around the token/);
    assert.match(await root().textContent(), /Removed the leading “Bearer”/);
  });

  await check("no demo token and no verification affordance anywhere in the tool", async () => {
    const text = await root().textContent();
    assert.ok(!/verify (the |your )?(jwt )?signature with/i.test(text));
    assert.ok(!/signature is valid/i.test(text));
    assert.equal(await root().locator('input[type="password"], input[type="text"]').count(), 0, "there is nowhere to type a key");
    assert.equal(await root().locator("form").count(), 0, "nothing is submitted anywhere");
  });

  await page.goto(`${BASE_URL}/use/base64`, { waitUntil: "networkidle" });
  await check("shared CopyButton still works elsewhere (cross-tool)", async () => {
    // base64 labels its shared CopyButton with the `label` prop, so this confirms the
    // component still works with that variant too.
    const copy = copyBtn("Copy result");
    assert.equal(await copy.count(), 1, "the shared CopyButton works in base64");
    assert.equal(await copy.isEnabled(), true);
  });
} finally {
  await browser.close();
}

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("FAILED: " + failures.map((f) => f.name).join(", "));
  process.exitCode = 1;
}
