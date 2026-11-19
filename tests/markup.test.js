// Photo markup: draw circles, boxes, arrows and freehand, move/resize/recolor/undo/delete,
// insert a picture, save into the step, reopen editable, save/open the .soe, clear back to the original.
const { ok, run, openApp, fs, FIXTURE, path } = require("./lib");
const { devices } = require("playwright");
run("photo markup", async b => {
  const { p, errs } = await openApp(b, { viewport: { width: 1280, height: 900 } });
  await p.evaluate(s => { loadDoc(parseSoe(s)); render(); }, fs.readFileSync(FIXTURE).toString("latin1"));
  await p.waitForTimeout(800);
  const t0 = await p.evaluate(() => ({ id: D.tasks[0].image_id, n: Object.keys(D.images).length }));
  ok(await p.locator('[data-mkopen="0"]').isVisible(), "Step with a photo shows a Mark up button");
  ok(await p.locator('[data-mkopen="2"]').count() === 0, "Step without a photo has no Mark up button");
  await p.click('[data-mkopen="0"]'); await p.waitForSelector("#mk:not([hidden])");
  ok(await p.evaluate(() => MK && MK.tool === "circle"), "Editor opens with the Circle tool");
  ok(await p.locator('#mk [data-mk="undo"]').isDisabled() && await p.locator('#mk [data-mk="del"]').isDisabled(), "Undo and Delete start disabled");
  const box = await p.locator("#mkCanvas").boundingBox();
  const at = (fx, fy) => [box.x + box.width * fx, box.y + box.height * fy];
  const drag = async (a, z, steps = 8) => { await p.mouse.move(...a); await p.mouse.down(); await p.mouse.move(...z, { steps }); await p.mouse.up(); };
  await drag(at(.10, .10), at(.35, .40));                                      // circle
  await p.click('[data-mkt="box"]'); await drag(at(.50, .15), at(.80, .45));  // box
  await p.click('[data-mkt="arrow"]'); await drag(at(.15, .85), at(.40, .60)); // arrow
  await p.click('[data-mkt="pen"]'); await drag(at(.55, .70), at(.85, .90), 15); // freehand
  let it = await p.evaluate(() => MK.items.map(i => i.t));
  ok(JSON.stringify(it) === '["circle","box","arrow","pen"]', "Draws circle, box, arrow and freehand " + JSON.stringify(it));
  ok(await p.evaluate(() => MK.items.every(i => i.c === "#e5191c")), "Marks are red by default");
  // tiny tap does not create a mark
  await p.click('[data-mkt="circle"]'); await p.mouse.click(...at(.95, .05));
  ok(await p.evaluate(() => MK.items.length === 4), "A tap without dragging doesn't add a mark");
  // select the box by its edge with the Move tool, drag it
  await p.click('[data-mkt="select"]');
  const before = await p.evaluate(() => ({ ...MK.items[1] }));
  await drag(at(.50, .30), at(.55, .35));
  const moved = await p.evaluate(() => ({ sel: MK.sel, ...MK.items[1] }));
  ok(moved.sel === 1 && moved.x > before.x && moved.y > before.y && Math.abs(moved.w - before.w) < 1, "Move tool drags a mark without resizing it");
  // resize from the bottom-right handle
  const se = await p.evaluate(() => { const i = MK.items[1], r = document.querySelector("#mkCanvas").getBoundingClientRect(); return [r.left + (i.x + i.w) * MK.scale, r.top + (i.y + i.h) * MK.scale]; });
  await drag(se, [se[0] + 40, se[1] + 30]);
  const rs = await p.evaluate(() => ({ ...MK.items[1] }));
  const sc = await p.evaluate(() => MK.scale);   // screen px per photo px
  ok(Math.abs(rs.w - moved.w - 40 / sc) < 2 && Math.abs(rs.h - moved.h - 30 / sc) < 2 && Math.abs(rs.x - moved.x) < 1, "Corner handle resizes the selected mark");
  // recolor the selected mark
  await p.click('[data-mkc="#ffd60a"]');
  ok(await p.evaluate(() => MK.items[1].c === "#ffd60a"), "Color button recolors the selected mark");
  // delete, then undo brings it back
  await p.click('#mk [data-mk="del"]');
  ok(await p.evaluate(() => MK.items.length === 3 && MK.sel === -1), "Delete removes the selected mark");
  await p.click('#mk [data-mk="undo"]');
  ok(await p.evaluate(() => MK.items.length === 4 && MK.items[1].c === "#ffd60a"), "Undo brings it back");
  await p.keyboard.press("Control+z");
  ok(await p.evaluate(() => MK.items[1].c === "#e5191c"), "Ctrl+Z undoes the color change");
  // insert a picture
  const inset = path.join(__dirname, "fixtures", "_inset.png");
  await p.evaluate(async () => { const c = document.createElement("canvas"); c.width = 400; c.height = 300; const x = c.getContext("2d"); x.fillStyle = "#08f"; x.fillRect(0, 0, 400, 300);
    window.__png = await new Promise(r => c.toBlob(r, "image/png")); });
  const pngB64 = await p.evaluate(async () => { const u = new Uint8Array(await window.__png.arrayBuffer()); let s = ""; for (const c of u) s += String.fromCharCode(c); return btoa(s); });
  fs.writeFileSync(inset, Buffer.from(pngB64, "base64"));
  await p.locator("#mkPic").setInputFiles(inset); await p.waitForFunction(() => MK.items.some(i => i.t === "img"));
  fs.unlinkSync(inset);
  const ins = await p.evaluate(() => { const i = MK.items.at(-1); return { t: i.t, ar: i.w / i.h, inside: i.x + i.w <= MK.W && i.y + i.h <= MK.H, sel: MK.sel === MK.items.length - 1, has: !!D.images[i.id] }; });
  ok(ins.t === "img" && Math.abs(ins.ar - 4 / 3) < 0.01 && ins.inside && ins.sel && ins.has, "Inserted picture lands inside the photo, keeps its shape, and is selected");
  // Done: photo is replaced by the flattened version, original kept
  await p.click('#mk [data-mk="done"]'); await p.waitForSelector("#mk", { state: "hidden" });
  const t1 = await p.evaluate(async () => { const t = D.tasks[0]; const dim = async id => { const b = await createImageBitmap(new Blob([b64ToBytes(D.images[id])], { type: "image/jpeg" })); return b.width + "x" + b.height; };
    return { id: t.image_id, orig: t.markup && t.markup.orig, n: t.markup && t.markup.items.length, dimNew: await dim(t.image_id), dimOrig: await dim(t.markup.orig), dirty }; });
  ok(t1.id !== t0.id && t1.orig === t0.id && t1.n === 5, "Done puts the marked-up photo on the step and keeps the original + 5 marks");
  ok(t1.dimNew === t1.dimOrig, "Marked-up photo is the same size as the original (" + t1.dimNew + ")");
  ok(t1.dirty, "Document shows as changed");
  // reopen: marks are still separate and editable
  await p.click('[data-mkopen="0"]'); await p.waitForSelector("#mk:not([hidden])");
  ok(await p.evaluate(() => MK.items.length === 5 && MK.origId === D.tasks[0].markup.orig), "Reopening shows the marks, still editable, on the clean photo");
  await p.keyboard.press("Escape"); await p.waitForSelector("#mk", { state: "hidden" });
  ok(await p.evaluate(() => !MK), "Esc with no new changes closes without asking");
  // save and reopen the .soe
  const rt = await p.evaluate(() => { const x = new TextDecoder("iso-8859-1").decode(serializeSoe(D)); const d = parseSoe(x); const t = d.tasks[0];
    return { has: x.includes("<markup>"), orig: !!d.images[t.markup.orig], inset: !!d.images[t.markup.items.at(-1).id], flat: !!d.images[t.image_id], n: t.markup.items.length, same: new TextDecoder("iso-8859-1").decode(serializeSoe(d)) === x }; });
  ok(rt.has && rt.orig && rt.inset && rt.flat && rt.n === 5, ".soe keeps the marks, the original photo and the inserted picture");
  ok(rt.same, "Saving the reopened file again gives the same file");
  // PDF still builds and uses the marked-up photo
  const pdfOk = await p.evaluate(async () => { const bl = await buildInstructions(D, "x.pdf", () => {}, "en"); return bl.size > 1000; });
  ok(pdfOk, "PDF builds with the marked-up photo");
  // Cancel with changes asks first
  await p.click('[data-mkopen="0"]'); await p.waitForSelector("#mk:not([hidden])");
  await p.click('#mk [data-mk="clear"]'); await p.click('#mk [data-mk="cancel"]');
  ok(await p.locator("#modal").isVisible(), "Cancel after changes asks before discarding");
  await p.click('#dlg [data-r="0"]'); ok(await p.evaluate(() => !!MK), "Choosing Cancel keeps the editor open");
  // Clear all + Done goes back to the original photo
  await p.click('#mk [data-mk="done"]'); await p.waitForSelector("#mk", { state: "hidden" });
  ok(await p.evaluate(id => D.tasks[0].image_id === id && !D.tasks[0].markup, t0.id), "Clear all + Done puts the original photo back");
  // replacing / removing a photo drops its marks
  await p.evaluate(() => { D.tasks[1].markup = { orig: D.tasks[1].image_id, items: [] }; });
  await p.evaluate(() => document.querySelector('[data-rmimg="1"]').click());
  ok(await p.evaluate(() => !D.tasks[1].markup && !D.tasks[1].image_id), "Removing a photo removes its marks");
  ok(!errs.length, "No console errors " + JSON.stringify(errs));

  // Tablet: touch drawing with real touch pointer events
  const tab = await openApp(b, { ...devices["iPad (gen 7)"] });
  await tab.p.evaluate(s => { loadDoc(parseSoe(s)); render(); }, fs.readFileSync(FIXTURE).toString("latin1"));
  await tab.p.waitForTimeout(600);
  ok(await tab.p.locator('[data-mkopen="0"]').isVisible(), "Tablet: Mark up button is visible without hovering");
  await tab.p.locator('[data-mkopen="0"]').tap(); await tab.p.waitForSelector("#mk:not([hidden])");
  const tb = await tab.p.locator("#mkCanvas").boundingBox();
  const cdp = await tab.ctx.newCDPSession(tab.p);
  const tp = (x, y) => [{ x: tb.x + tb.width * x, y: tb.y + tb.height * y }];
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: tp(.2, .2) });
  for (let k = 1; k <= 8; k++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: tp(.2 + k * .04, .2 + k * .03) });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await tab.p.waitForTimeout(100);
  ok(await tab.p.evaluate(() => MK.items.length === 1 && MK.items[0].t === "circle" && MK.items[0].w > 50), "Tablet: a finger drag draws a circle");
  const sizes = await tab.p.evaluate(() => [...document.querySelectorAll("#mk button")].filter(b => b.offsetParent).map(b => { const r = b.getBoundingClientRect(); return Math.min(r.width, r.height); }));
  ok(Math.min(...sizes) >= 36, "Tablet: every editor button is at least 36 px (" + Math.min(...sizes) + ")");
  ok(await tab.p.evaluate(() => { const c = document.querySelector("#mkCanvas").getBoundingClientRect(); return c.width > innerWidth * 0.6; }), "Tablet: photo fills most of the screen");
  await tab.p.locator('#mk [data-mk="done"]').tap(); await tab.p.waitForSelector("#mk", { state: "hidden" });
  ok(await tab.p.evaluate(() => !!D.tasks[0].markup && D.tasks[0].markup.items.length === 1), "Tablet: Done saves the mark");
  ok(!tab.errs.length, "Tablet: no console errors " + JSON.stringify(tab.errs));
});
