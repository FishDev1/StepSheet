// Hosting / installable app: manifest, service worker, offline use, Open with, and build version consistency.
const { ok, run, openApp, fs, file, ROOT, path } = require("./lib");
const http = require("http");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".webmanifest": "application/manifest+json", ".png": "image/png" };
// A tiny static server for the repo root, like an internal web server would be (localhost counts as secure).
function serve() { return new Promise(res => { const s = http.createServer((q, r) => {
  let u = decodeURIComponent(q.url.split("?")[0]); if (u.endsWith("/")) u += "index.html";
  const f = path.join(ROOT, u); if (!f.startsWith(ROOT) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { "Content-Type": TYPES[path.extname(f)] || "application/octet-stream", "Cache-Control": /index\.html|sw\.js/.test(f) ? "no-cache" : "max-age=3600" });
  fs.createReadStream(f).pipe(r); }).listen(0, "127.0.0.1", () => res(s)); }); }
const png = f => { const b = fs.readFileSync(file(f)); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };

run("installable app", async b => {
  // Static checks on the built files
  const man = JSON.parse(fs.readFileSync(file("manifest.webmanifest"), "utf8"));
  ok(man.name === "StepSheet" && man.start_url === "./" && man.scope === "./" && man.display === "standalone", "Manifest: name, relative start address, standalone window");
  ok(man.file_handlers && JSON.stringify(man.file_handlers).includes(".soe"), "Manifest: opens .soe files");
  ok(man.icons.every(i => fs.existsSync(file(i.src)) && png(i.src).join("x") === i.sizes), "Manifest icons exist at their stated sizes");
  ok(png("icon-180.png").join("x") === "180x180", "Apple touch icon is 180x180");
  const cache = /CACHE = "([^"]+)"/.exec(fs.readFileSync(file("src", "build.py"), "utf8"))[1];
  ok(fs.readFileSync(file("sw.js"), "utf8").includes(`const CACHE = "${cache}"`), "sw.js carries the CACHE version from build.py (" + cache + ")");
  const idx = fs.readFileSync(file("index.html"), "utf8"), single = fs.readFileSync(file("StepSheet.html"), "utf8");
  ok(/rel="manifest" href="manifest\.webmanifest"/.test(idx) && idx.includes("register('sw.js')"), "index.html links the manifest and registers the service worker (relative paths)");
  ok(![idx, single].some(s => s.includes("__BUILD__") || s.includes("__WIDTHS__")), "Build placeholders are filled in");
  ok(!/\b(src|href)=["']\//.test(idx), "No absolute paths, so any folder on the server works");

  // Settings shows the same build number
  { const { p, ctx } = await openApp(b); await p.click('#tabs [data-tab="opt"]');
    ok((await p.locator("body").innerText()).includes("StepSheet build " + cache.split("-v").pop()), "Settings shows build " + cache.split("-v").pop()); await ctx.close(); }

  // Served over a web server: service worker takes over, then the app opens with the network off
  const srv = await serve(), base = `http://127.0.0.1:${srv.address().port}/`;
  { const ctx = await b.newContext(); const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(String(e)));
    await p.goto(base); await p.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller, null, { timeout: 15000 }).catch(() => {});
    if (!(await p.evaluate(() => !!navigator.serviceWorker.controller))) { await p.reload(); await p.waitForTimeout(800); }
    ok(await p.evaluate(() => !!navigator.serviceWorker.controller), "Service worker installs and controls the page");
    ok(await p.evaluate(async () => (await caches.keys()).length === 1), "Exactly one offline cache is kept");
    await ctx.setOffline(true); await p.reload(); await p.waitForTimeout(4500);
    ok(await p.evaluate(() => typeof D !== "undefined" && !!document.querySelector("#tb")), "App opens with the network off");
    ok(!errs.length, "No page errors while online/offline " + JSON.stringify(errs)); await ctx.close(); }
  srv.close();

  // Open with > StepSheet hands the file to the app
  { const xml = fs.readFileSync(path.join(__dirname, "fixtures", "sample.soe")).toString("latin1");
    const ctx = await b.newContext(); const p = await ctx.newPage();
    await p.addInitScript(x => { Object.defineProperty(window, "launchQueue", { configurable: true, value: { setConsumer(fn) { setTimeout(() => fn({ files: [{ kind: "file", name: "sample.soe", getFile: async () => new File([x], "sample.soe") }] }), 50); } } }); }, xml);
    await p.goto(require("./lib").url("index.html")); await p.waitForTimeout(1200);
    ok(await p.evaluate(() => D.tasks.length === 4 && D.header.udc1 === "SAMPLE RAIL INSTALL"), "A .soe file opened from Windows (Open with) loads into the app"); await ctx.close(); }

  // Single-file copy: on a website it forwards to the installable app; opened as a file it stays put
  { const ctx = await b.newContext({ ignoreHTTPSErrors: true }); const p = await ctx.newPage();
    await ctx.route("https://intranet.example/**", r => { const u = new URL(r.request().url());
      if (u.pathname.endsWith("/StepSheet.html")) return r.fulfill({ body: single, contentType: "text/html" });
      if (u.pathname.endsWith("/")) return r.fulfill({ body: idx, contentType: "text/html" }); return r.fulfill({ status: 404, body: "" }); });
    await p.goto("https://intranet.example/stepsheet/StepSheet.html"); await p.waitForTimeout(800);
    ok(p.url() === "https://intranet.example/stepsheet/", "StepSheet.html on a website forwards to the installable app"); await ctx.close(); }
  { const { p, ctx } = await openApp(b);
    ok(p.url().endsWith("StepSheet.html"), "StepSheet.html opened as a file stays a file");
    const meta = await p.evaluate(() => ({ app: document.querySelector("meta[name=application-name]").content, icons: document.querySelectorAll('link[rel=icon][type="image/png"],link[rel=apple-touch-icon]').length }));
    ok(meta.app === "StepSheet" && meta.icons === 3, "Single file carries the app name and icons for \"Install page as app\""); await ctx.close(); }
});
