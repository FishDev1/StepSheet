// Shared helpers for the StepSheet browser tests. Requires Node 18+ and Playwright (see tests/README.md).
const path = require("path");
const fs = require("fs");
const { pathToFileURL } = require("url");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "..");                    // repo root
const file = (...p) => path.join(ROOT, ...p);
const url = (...p) => pathToFileURL(file(...p)).href;         // file:// URL for a repo file
const FIXTURE = path.join(__dirname, "fixtures", "sample.soe");

let passed = 0, failed = 0;
function ok(cond, msg) {
  if (cond) { passed++; console.log("  PASS " + msg); }
  else { failed++; process.exitCode = 1; console.log("  FAIL " + msg); }
}
function done(name) { console.log(`${name}: ${passed} passed, ${failed} failed`); return { passed, failed }; }

// Open the built single-file app (or another built page) and collect page errors.
async function openApp(browser, opts = {}, page = "StepSheet.html") {
  const ctx = await browser.newContext(opts);
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", e => errs.push(String(e)));
  p.on("console", m => { if (m.type() === "error") errs.push(m.text()); });
  await p.goto(url(page));
  await p.waitForFunction(() => typeof D !== "undefined" && typeof render === "function");
  await p.waitForTimeout(200);
  return { ctx, p, errs };
}

// Run one test file body with a fresh browser; always closes it.
function run(name, body) {
  (async () => {
    console.log(name);
    const b = await chromium.launch();
    try { await body(b); }
    catch (e) { ok(false, "test crashed: " + (e && e.stack || e)); }
    finally { await b.close(); done(name); }
  })();
}

module.exports = { ROOT, file, url, FIXTURE, ok, run, openApp, fs, path };
