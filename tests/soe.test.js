// .soe files: opening, saving, and round-trip fidelity (nothing lost, including tags StepSheet doesn't model).
const { ok, run, openApp, fs, FIXTURE } = require("./lib");
run(".soe files", async b => {
  const { p, errs } = await openApp(b);
  const original = fs.readFileSync(FIXTURE).toString("latin1");
  const save = () => p.evaluate(() => new TextDecoder("iso-8859-1").decode(serializeSoe(D)));
  // Flatten an .soe into sorted "path | attributes | text" lines (photos compared separately).
  const flat = s => p.evaluate(s => { const x = new DOMParser().parseFromString(s, "application/xml"), out = [];
    const walk = (el, path) => { for (const c of el.children) { const pth = path + "/" + (path.endsWith("/images") ? "<photo>" : c.tagName);
      const attrs = [...c.attributes].map(a => a.name + "=" + a.value).join(",");
      out.push(pth + " | " + attrs + " | " + (c.children.length ? "" : c.textContent.replace(/\s+/g, path.endsWith("/images") ? "" : " ").trim())); walk(c, pth); } };
    walk(x.documentElement, x.documentElement.tagName); return out.sort(); }, s);

  // Open
  const info = await p.evaluate(s => { loadDoc(parseSoe(s)); return { n: D.tasks.length, title: D.header.udc1, num: D.header.udc4, es: D.header_es.udc1,
    photos: Object.keys(D.images).length, url: D.url, types: D.tasks.map(t => t.tasktype).join(","), code: D.tasks[1].code, q: D.tasks[2].quality,
    waste: D.tasks[2].wastes.waiting, ct: D.tasks[1].cycletime, capEs: D.tasks[3].caption_es }; }, original);
  ok(info.n === 4, "Sample opens with all 4 steps");
  ok(info.title === "SAMPLE RAIL INSTALL" && info.num === "OPS-SOP-000123", "Header boxes read");
  ok(info.es === "INSTALACION DE RIEL DE MUESTRA" && info.capEs.startsWith("Verifique"), "Spanish header and step text read");
  ok(info.photos === 2, "Both photos read");
  ok(info.types === "Safety,Work Content,Check,Verify", "Step types read");
  ok(info.code === "ABYC H-24" && info.q === true && info.waste === true && info.ct === "45", "Code, quality flag, waste and cycle time read");
  ok(info.url === "C:\\Instructions\\sample.soe", "A value split in two CDATA pieces reads as one");

  // Save: every tag, attribute and value comes back
  const saved = await save();
  const [a, c] = [await flat(original), await flat(saved)];
  const missing = a.filter(x => !c.includes(x)), added = c.filter(x => !a.includes(x));
  ok(!missing.length && !added.length, "Save keeps every tag, attribute and value" + (missing.length ? " MISSING " + JSON.stringify(missing.slice(0, 5)) : "") + (added.length ? " ADDED " + JSON.stringify(added.slice(0, 5)) : ""));
  ok(/<ExampleApprover role="QA">/.test(saved) && /<\/imageroot><ExampleTrailer>/.test(saved), "Unknown tags keep attributes and their place (inside FileProperties, after the photos)");
  const photosSame = await p.evaluate(([o, s]) => { const grab = t => { const m = {}; const re = /<([A-F0-9-]{36})>([\s\S]*?)<\/\1>/gi; let x; while ((x = re.exec(t))) m[x[1]] = x[2].replace(/\s+/g, ""); return m; };
    const A = grab(o), B = grab(s); return Object.keys(A).length === 2 && Object.keys(A).every(k => A[k] === B[k]); }, [original, saved]);
  ok(photosSame, "Photos saved byte-for-byte");

  // Save twice: identical
  await p.evaluate(s => loadDoc(parseSoe(s)), saved);
  ok((await save()) === saved, "Second save is identical to the first");

  // Edit, then save: unknown tags still there, edit kept
  await p.evaluate(() => { D.tasks[0].caption = "Edited caption"; D.tasks[0].code = "33 CFR 183.540"; });
  const edited = await save();
  ok(edited.includes("Edited caption") && edited.includes("<code><![CDATA[33 CFR 183.540]]></code>") && edited.includes("<ExampleNote>"), "Edits save and unknown tags survive the edit");

  // Removed photo is dropped; kept photo stays
  await p.evaluate(() => { D.tasks[0].image_id = ""; });
  const dropped = await save();
  ok((dropped.match(/<[A-F0-9-]{36}>/gi) || []).length === 1, "A photo no step uses is left out on save");

  // Bad input
  const bad = await p.evaluate(() => { try { parseSoe("hello"); return "no error"; } catch (e) { return e.message; } });
  ok(/isn't a \.soe file|empty/.test(bad), "Non-.soe text gives a readable error");
  ok(!errs.length, "No console errors " + JSON.stringify(errs));
});
