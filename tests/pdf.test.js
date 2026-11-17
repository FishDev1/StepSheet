// PDF output: builds, carries the right text, keeps photo resolution, and gets the right file name.
const { ok, run, openApp, fs, FIXTURE } = require("./lib");
run("PDFs", async b => {
  const { p, errs } = await openApp(b);
  await p.evaluate(s => loadDoc(parseSoe(s)), fs.readFileSync(FIXTURE).toString("latin1"));
  const pdf = (kind, lang) => p.evaluate(async ([kind, lang]) => {
    const blob = kind === "analysis" ? await buildSoe(D, "x.pdf") : await buildInstructions(D, "x.pdf", () => {}, lang);
    const u8 = new Uint8Array(await blob.arrayBuffer()); let s = ""; for (const c of u8) s += String.fromCharCode(c); return s; }, [kind, lang]);

  const en = await pdf("steps", "en");
  ok(en.startsWith("%PDF-") && en.trimEnd().endsWith("%%EOF"), "Instructions PDF is a complete PDF file");
  ok((en.match(/\/Type \/Page\b/g) || []).length >= 1, "It has at least one page");
  ok(en.includes("SAMPLE RAIL INSTALL") && en.includes("OPS-SOP-000123"), "Header title and number are printed");
  ok(en.includes("Position PORT RAIL on DECK"), "Step text is printed");
  ok(en.includes("ABYC H-24"), "Step's USCG / ABYC code is printed");
  ok((en.match(/\/Subtype \/Image/g) || []).length >= 2, "Both photos are embedded");
  const es = await pdf("steps", "es");
  ok(es.includes("INSTALACION DE RIEL DE MUESTRA") && es.includes("Verifique que cada SUJETADOR"), "Spanish PDF uses the Spanish text");
  const an = await pdf("analysis");
  ok(an.startsWith("%PDF-") && an.length > 1000, "Analysis PDF builds");

  // Photo resolution: screen shows a small preview, the PDF keeps the original (or the chosen quality)
  const res = await p.evaluate(async () => {
    const c = document.createElement("canvas"); c.width = 4000; c.height = 3000; const x = c.getContext("2d");
    for (let i = 0; i < 300; i++) { x.fillStyle = `hsl(${i * 7},70%,50%)`; x.fillRect((i * 131) % 3800, (i * 97) % 2800, 200, 200); }
    const blob = await new Promise(r => c.toBlob(r, "image/jpeg", 0.9)); const id = newId();
    D.images[id] = bytesToB64(new Uint8Array(await blob.arrayBuffer())); D.tasks[0].image_id = id; render();
    await new Promise(r => setTimeout(r, 1500)); const im = document.querySelector(`img[data-pid="${id}"]`); await im.decode().catch(() => {});
    const keep = ST.image_quality, out = { preview: Math.max(im.naturalWidth, im.naturalHeight) };
    for (const q of ["Original", "Low"]) { ST.image_quality = q; pdfImgCache.clear(); const pi = await pdfImage(id); out[q] = [pi.w, pi.h, pi.bytes.length === b64ToBytes(D.images[id]).length]; }
    ST.image_quality = keep; pdfImgCache.clear(); return out; });
  ok(res.preview > 0 && res.preview <= 480, "On-screen photo is a small preview (" + res.preview + " px)");
  ok(res.Original[0] === 4000 && res.Original[1] === 3000 && res.Original[2], "Quality: Original puts the full 4000x3000 photo, unchanged, in the PDF");
  ok(Math.max(res.Low[0], res.Low[1]) === 800, "Quality: Low shrinks the PDF photo to 800 px");

  // File names: digits from header row 2 box 2, then the title
  const names = await p.evaluate(() => { const mk = (u4, u1, es, name) => ({ name, header: { udc4: u4, udc1: u1 }, header_es: { udc1: es } });
    return [pdfFileName(mk("OPS-SOP-000123", "STANDARD RAIL INSTALL", "INSTALACIÓN ESTÁNDAR DE RIEL", "x.soe"), "pdf"),
      pdfFileName(mk("OPS-SOP-000123", "STANDARD RAIL INSTALL", "INSTALACIÓN ESTÁNDAR DE RIEL", "x.soe"), "es"),
      pdfFileName(mk("OPS-SOP-000123", "STANDARD RAIL INSTALL", "", "x.soe"), "es"),
      pdfFileName(mk("OPS-SOP-000123", "STANDARD RAIL INSTALL", "", "x.soe"), "soe"),
      pdfFileName(mk("DOC #: OPS-SOP-04512 REV A", "MOTOR PAN / BRACKET: 1/4\" GAP?", "", "x.soe"), "pdf"),
      pdfFileName(mk("OPS-SOP-XXXXXX", "STANDARD RAIL INSTALL", "", "x.soe"), "pdf"),
      pdfFileName(mk("", "", "", "One peice motorpan.soe"), "pdf")]; });
  const want = ["000123 STANDARD RAIL INSTALL.pdf", "000123 INSTALACIÓN ESTÁNDAR DE RIEL (Español).pdf", "000123 STANDARD RAIL INSTALL (Español).pdf",
    "000123 STANDARD RAIL INSTALL Analysis.pdf", "04512 MOTOR PAN - BRACKET 1-4 GAP.pdf", "STANDARD RAIL INSTALL.pdf", "One peice motorpan.pdf"];
  want.forEach((w, i) => ok(names[i] === w, "PDF file name: " + JSON.stringify(names[i]) + (names[i] === w ? "" : " (expected " + JSON.stringify(w) + ")")));
  ok(!errs.length, "No console errors " + JSON.stringify(errs));
});
