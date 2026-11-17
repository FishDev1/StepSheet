// Regenerates tests/fixtures/sample.soe: a small, made-up .soe file (no real company content)
// shaped like one saved by Visual Instructor 4.0, plus a few tags StepSheet doesn't model
// (Example*) so the tests can prove unknown data survives a save.
// Usage: node tests/fixtures/make-sample.js   (after python src/build.py)
const { chromium } = require("playwright");
const fs = require("fs"), path = require("path");
const { url } = require("../lib");
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto(url("StepSheet.html")); await p.waitForFunction(() => typeof serializeSoe === "function");
  const text = await p.evaluate(async () => {
    const jpeg = async (w, h, hue) => { const c = document.createElement("canvas"); c.width = w; c.height = h; const x = c.getContext("2d");
      x.fillStyle = `hsl(${hue},45%,55%)`; x.fillRect(0, 0, w, h); x.fillStyle = "#fff"; x.font = "28px sans-serif"; x.fillText("sample photo", 20, h / 2);
      const bl = await new Promise(r => c.toBlob(r, "image/jpeg", 0.8)); return bytesToB64(new Uint8Array(await bl.arrayBuffer())); };
    const d = blankDoc(); d.name = "sample.soe"; d.url = "C:\\Instructions\\sample.soe";
    Object.assign(d.header, { udc1: "SAMPLE RAIL INSTALL", udc2: "R SERIES", udc3: "REV A", udc4: "OPS-SOP-000123", udc5: "ASSEMBLY", udc6: "STATION 4", udc7: "INTERNAL USE" });
    d.header_es.udc1 = "INSTALACION DE RIEL DE MUESTRA";
    const mk = (caption, type, ct) => { const t = blankTask(d.default_ppp); t.caption = caption; t.tasktype = type; t.cycletime = ct || ""; return t; };
    const a = mk("Wear REQUIRED P.P.E: SAFETY GLASSES and GLOVES", "Safety", "10");
    const b2 = mk("Position PORT RAIL on DECK and align to BOW mark", "Work Content", "45"); b2.code = "ABYC H-24";
    const c = mk("Check RAIL gap to DECK TRIM is 1/4\"", "Check", "15"); c.quality = true; c.wastes.waiting = true;
    const e = mk("Verify every FASTENER is torqued", "Verify", "20"); e.caption_es = "Verifique que cada SUJETADOR tenga torque"; e.caption_es_src = e.caption;
    a.image_id = newId(); d.images[a.image_id] = await jpeg(320, 240, 210); a.image_title = "IMG_0001.jpg"; a.image_path = "C:\\Photos\\IMG_0001.jpg";
    b2.image_id = newId(); d.images[b2.image_id] = await jpeg(240, 320, 30); b2.image_title = "IMG_0002.jpg"; b2.image_path = "C:\\Photos\\IMG_0002.jpg";
    d.tasks = [a, b2, c, e];
    return new TextDecoder("iso-8859-1").decode(serializeSoe(d));
  });
  let t = text
    // Visual Instructor sometimes splits one value into two CDATA pieces; same value when read.
    .replace("<![CDATA[C:\\Instructions\\sample.soe]]>", "<![CDATA[C:\\Instructions\\]]><![CDATA[sample.soe]]>")
    // Tags StepSheet doesn't model, at several levels, to check they are kept on save.
    .replace("<FileProperties>", '<FileProperties><ExampleApprover role="QA"><![CDATA[J. Smith & Co.]]></ExampleApprover>')
    .replace("</VmsInfo>", "<ExampleRotation>90</ExampleRotation></VmsInfo>")
    .replace("</Task>", "<ExampleNote><line><![CDATA[Torque 35 IN-LBS < 40]]></line></ExampleNote></Task>")
    .replace("</imageroot></roots>", "</imageroot><ExampleTrailer><![CDATA[after images]]></ExampleTrailer></roots>");
  fs.writeFileSync(path.join(__dirname, "sample.soe"), Buffer.from(t, "latin1"));
  console.log("wrote tests/fixtures/sample.soe", t.length, "bytes");
  await b.close();
})();
