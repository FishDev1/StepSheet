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
  await p.click('[data-mkc="#1f6fe0"]');
  ok(await p.evaluate(() => MK.items[1].c === "#1f6fe0"), "Color button recolors the selected mark");
  // delete, then undo brings it back
  await p.click('#mk [data-mk="del"]');
  ok(await p.evaluate(() => MK.items.length === 3 && MK.sel === -1), "Delete removes the selected mark");
  await p.click('#mk [data-mk="undo"]');
  ok(await p.evaluate(() => MK.items.length === 4 && MK.items[1].c === "#1f6fe0"), "Undo brings it back");
  await p.keyboard.press("Control+z");
  ok(await p.evaluate(() => MK.items[1].c === "#e5191c"), "Ctrl+Z undoes the color change");
  // line thickness: Thinner / Thicker on the selected mark, and for new marks
  await p.click('[data-mkt="select"]'); await drag(at(.10, .25), at(.10, .25 + 0.0001), 1);
  await p.evaluate(() => { MK.sel = 0; mkUpdate(); });
  ok(await p.locator("#mk .mk-thick").isVisible(), "Thinner/Thicker show while a shape is selected");
  const th0 = await p.evaluate(() => MK.items[0].th);
  await p.click('#mk [data-mk="thicker"]'); await p.click('#mk [data-mk="thicker"]');
  ok(await p.evaluate(t => MK.items[0].th === t + 2, th0), "Thicker makes the selected mark thicker");
  await p.click('#mk [data-mk="thinner"]');
  ok(await p.evaluate(t => MK.items[0].th === t + 1, th0), "Thinner makes it thinner again");
  for (let k = 0; k < 6; k++) if (!(await p.locator('#mk [data-mk="thicker"]').isDisabled())) await p.click('#mk [data-mk="thicker"]');
  ok(await p.locator('#mk [data-mk="thicker"]').isDisabled(), "Thicker stops at the thickest setting");
  await p.click('#mk [data-mk="undo"]');
  await p.click('[data-mkt="box"]'); await p.evaluate(() => { MK.sel = -1; mkUpdate(); });
  const nextTh = await p.evaluate(() => ST.mk_th);
  await drag(at(.05, .70), at(.20, .85));
  ok(await p.evaluate(t => MK.items.at(-1).th === t, nextTh), "A new mark uses the last thickness chosen");
  await p.click('#mk [data-mk="undo"]');
  // rotation: buttons, rotate handle with snapping, picking and resizing a rotated mark
  await p.click('[data-mkt="select"]'); await p.evaluate(() => { MK.sel = 1; mkUpdate(); });   // the box
  ok(await p.locator("#mk .mk-rot").isVisible(), "Turn buttons show for a selected box");
  await p.click('#mk [data-mk="rotr"]'); await p.click('#mk [data-mk="rotr"]');
  ok(await p.evaluate(() => Math.abs(MK.items[1].rot * 180 / Math.PI - 30) < 0.01), "Turn right twice = 30 degrees");
  await p.click('#mk [data-mk="rotl"]'); await p.click('#mk [data-mk="rotl"]');
  ok(await p.evaluate(() => !MK.items[1].rot), "Turn left twice = back to straight");
  // drag the rotate handle a quarter turn around the centre -> snaps to 90
  const rh = await p.evaluate(() => { const it = MK.items[1], h = mkHandles(it).find(h => h.k === "rot"), c = mkCenter(it), r = document.querySelector("#mkCanvas").getBoundingClientRect();
    const toS = q => [r.left + q.x * MK.scale, r.top + q.y * MK.scale]; const R = Math.hypot(h.x - c.x, h.y - c.y); return { h: toS(h), end: toS({ x: c.x + R + 0.02 * R, y: c.y + 0.03 * R }) }; });
  await drag(rh.h, rh.end, 12);
  ok(await p.evaluate(() => Math.abs(MK.items[1].rot * 180 / Math.PI - 90) < 0.01), "Dragging the rotate handle turns the box and snaps to 90 degrees");
  // a rotated box is picked by its rotated edge, not its old one
  await p.evaluate(() => { MK.sel = -1; mkUpdate(); });
  const edge = await p.evaluate(() => { const it = MK.items[1], b = mkBox(it), c = mkCenter(it); const w = mkRotPt({ x: b.x + b.w, y: c.y }, c, it.rot), r = document.querySelector("#mkCanvas").getBoundingClientRect(); return [r.left + w.x * MK.scale, r.top + w.y * MK.scale]; });
  await p.mouse.click(...edge);
  ok(await p.evaluate(() => MK.sel === 1), "Tapping the rotated box's edge selects it");
  // resize from a corner keeps the angle and the opposite corner in place
  const rz = await p.evaluate(() => { const it = MK.items[1], H = mkHandles(it), se = H.find(h => h.k === "se"), nw = H.find(h => h.k === "nw"), r = document.querySelector("#mkCanvas").getBoundingClientRect();
    return { se: [r.left + se.x * MK.scale, r.top + se.y * MK.scale], nw: [nw.x, nw.y] }; });
  await drag(rz.se, [rz.se[0] - 20, rz.se[1] + 25]);
  const after = await p.evaluate(() => { const it = MK.items[1], nw = mkHandles(it).find(h => h.k === "nw"); return { rot: it.rot, nw: [nw.x, nw.y] }; });
  ok(Math.abs(after.rot * 180 / Math.PI - 90) < 0.01 && Math.hypot(after.nw[0] - rz.nw[0], after.nw[1] - rz.nw[1]) < 1.5, "Resizing a rotated box keeps its angle and its opposite corner");
  ok(await p.evaluate(() => mkHandles({ t: "arrow", x1: 0, y1: 0, x2: 5, y2: 5 }).every(h => h.k !== "rot") && !mkRotatable({ t: "pen" })), "Arrows and freehand have no rotate handle");
  // undo all the rotation so the rest of the test is unchanged
  while (await p.evaluate(() => !!MK.items[1].rot)) await p.click('#mk [data-mk="undo"]');
  await p.evaluate(() => { MK.sel = -1; mkUpdate(); });
  // colors are red, blue, yellow
  ok(JSON.stringify(await p.evaluate(() => [...document.querySelectorAll("#mk [data-mkc]")].map(b => b.getAttribute("aria-label")))) === '["Red","Blue","Yellow"]', "Colors are red, blue and yellow");
  // text labels: blue = white on blue, yellow = red on yellow
  await p.click('[data-mkc="#1f6fe0"]'); await p.click('[data-mkt="text"]'); await p.mouse.click(...at(.30, .55));
  await p.waitForSelector("#mkTxt"); await p.fill("#mkTxt", "TORQUE TO 35 IN-LBS"); await p.keyboard.press("Enter");
  let lab = await p.evaluate(() => { const i = MK.items.at(-1); return { t: i.t, s: i.s, c: i.c, ink: mkInk(i.c), sel: MK.sel === MK.items.length - 1, inside: (() => { const b = mkBox(i); return b.x >= 0 && b.y >= 0 && b.x + b.w <= MK.W + 0.5 && b.y + b.h <= MK.H + 0.5; })() }; });
  ok(lab.t === "text" && lab.s === "TORQUE TO 35 IN-LBS" && lab.c === "#1f6fe0" && lab.ink === "#ffffff" && lab.sel && lab.inside, "Text tool adds a label: white text on blue, inside the photo");
  const pix = await p.evaluate(() => { const i = MK.items.at(-1), b = mkBox(i), cv = document.querySelector("#mkCanvas"), k = MK.scale * MK.dpr, x = cv.getContext("2d");
    const d = x.getImageData(Math.round((b.x + 3) * k), Math.round((b.y + b.h / 2) * k), 1, 1).data; return [d[0], d[1], d[2]]; });
  ok(pix[2] > 180 && pix[0] < 90, "Label background draws blue " + JSON.stringify(pix));
  await p.click('[data-mkc="#ffd60a"]');
  ok(await p.evaluate(() => { const i = MK.items.at(-1); return i.c === "#ffd60a" && mkInk(i.c) === "#e5191c"; }), "Yellow label has red text");
  // tap the selected label to edit its words
  const lb = await p.evaluate(() => { const b = mkBox(MK.items.at(-1)), r = document.querySelector("#mkCanvas").getBoundingClientRect(); return [r.left + (b.x + b.w / 2) * MK.scale, r.top + (b.y + b.h / 2) * MK.scale]; });
  await p.click('[data-mkt="select"]'); await p.mouse.click(...lb);
  await p.waitForSelector("#mkTxt"); await p.fill("#mkTxt", "TORQUE TO 40 IN-LBS"); await p.click('#dlg [data-r="1"]');
  ok(await p.waitForFunction(() => MK.items.at(-1).s === "TORQUE TO 40 IN-LBS", null, { timeout: 2000 }).then(() => true, () => false), "Tapping a selected label edits its text");
  const sz0 = await p.evaluate(() => MK.items.at(-1).size);
  const lse = await p.evaluate(() => { const b = mkBox(MK.items.at(-1)), r = document.querySelector("#mkCanvas").getBoundingClientRect(); return [r.left + (b.x + b.w) * MK.scale, r.top + (b.y + b.h) * MK.scale]; });
  await drag(lse, [lse[0] + 60, lse[1] + 10]);
  ok(await p.evaluate(s0 => MK.items.at(-1).size > s0, sz0), "Dragging a label's corner makes the text bigger");
  // Smaller / Bigger buttons
  ok(await p.locator("#mk .mk-tsize").isVisible(), "Smaller/Bigger buttons show while a label is selected");
  const s1 = await p.evaluate(() => MK.items.at(-1).size);
  await p.click('#mk [data-mk="tbigger"]'); const s2 = await p.evaluate(() => MK.items.at(-1).size);
  await p.click('#mk [data-mk="tsmaller"]'); await p.click('#mk [data-mk="tsmaller"]'); const s3 = await p.evaluate(() => MK.items.at(-1).size);
  ok(s2 > s1 && s3 < s2, `Bigger and Smaller change the label size (${s1} -> ${s2} -> ${s3})`);
  for (let k = 0; k < 8; k++) if (!(await p.locator('#mk [data-mk="tsmaller"]').isDisabled())) await p.click('#mk [data-mk="tsmaller"]');
  ok(await p.locator('#mk [data-mk="tsmaller"]').isDisabled(), "Smaller stops at the smallest size");
  // remove the label again so the counts below stay the same
  await p.click('#mk [data-mk="del"]');
  await p.click('[data-mkc="#e5191c"]');
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
  await p.evaluate(() => { MK.items.at(-1).rot = Math.PI / 6; });   // turn the inserted picture 30 degrees
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
  ok(await p.evaluate(() => { const d = parseSoe(new TextDecoder("iso-8859-1").decode(serializeSoe(D))); return Math.abs(d.tasks[0].markup.items.at(-1).rot - Math.PI / 6) < 1e-9; }), ".soe keeps a mark's rotation");
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
  // ---- Crop ----
  await p.evaluate(() => { D.tasks[2].image_id = D.tasks[0].image_id; D.tasks[3].image_id = D.tasks[0].image_id; render(); }); await p.waitForTimeout(300);
  await p.click('[data-mkopen="2"]'); await p.waitForSelector("#mk:not([hidden])");
  const full = await p.evaluate(() => ({ w: MK.OW, h: MK.OH }));
  const cb = await p.locator("#mkCanvas").boundingBox();
  const cdrag = async (x0, y0, x1, y1) => { await p.mouse.move(cb.x + cb.width * x0, cb.y + cb.height * y0); await p.mouse.down();
    for (let k = 1; k <= 6; k++) await p.mouse.move(cb.x + cb.width * (x0 + (x1 - x0) * k / 6), cb.y + cb.height * (y0 + (y1 - y0) * k / 6)); await p.mouse.up(); };
  await p.click('[data-mkt="circle"]'); await cdrag(.6, .6, .8, .8);   // a mark in the lower right
  await p.click('[data-mkt="crop"]');
  ok(await p.locator("#mk .mk-cropbar").isVisible(), "Crop shows Done cropping / Full photo");
  // drag the top-left corner handle in to the middle
  const cb2 = await p.locator("#mkCanvas").boundingBox();
  await p.mouse.move(cb2.x + 2, cb2.y + 2); await p.mouse.down(); for (let k = 1; k <= 6; k++) await p.mouse.move(cb2.x + cb2.width * .5 * k / 6, cb2.y + cb2.height * .5 * k / 6); await p.mouse.up();
  await p.click('#mk [data-mk="cropok"]');
  const cr = await p.evaluate(() => ({ c: MK.crop, W: MK.W, H: MK.H, tool: MK.tool, bar: !document.querySelector("#mk .mk-cropbar").hidden }));
  ok(cr.c && Math.abs(cr.c.x - full.w / 2) < full.w * .03 && Math.abs(cr.c.w - full.w / 2) < full.w * .03 && cr.W === cr.c.w && cr.tool === "circle" && !cr.bar, "Dragging the corner and Done cropping crops to the lower-right quarter " + JSON.stringify(cr));
  await p.click('#mk [data-mk="done"]'); await p.waitForSelector("#mk", { state: "hidden" });
  const cs = await p.evaluate(async () => { const t = D.tasks[2]; const b = await createImageBitmap(new Blob([b64ToBytes(D.images[t.image_id])], { type: "image/jpeg" }));
    const o = await createImageBitmap(new Blob([b64ToBytes(D.images[t.markup.orig])], { type: "image/jpeg" })); return { w: b.width, h: b.height, ow: o.width, crop: t.markup.crop, n: t.markup.items.length }; });
  ok(cs.crop && Math.abs(cs.w - cs.crop.w) <= 1 && Math.abs(cs.h - cs.crop.h) <= 1 && cs.ow === full.w && cs.n === 1, "Saved photo is the cropped size; the full original and the mark are kept " + JSON.stringify(cs));
  ok(await p.evaluate(() => { const d = parseSoe(new TextDecoder("iso-8859-1").decode(serializeSoe(D))); return JSON.stringify(d.tasks[2].markup.crop) === JSON.stringify(D.tasks[2].markup.crop); }), ".soe keeps the crop");
  // reopen: crop is still there and can be widened back out
  await p.click('[data-mkopen="2"]'); await p.waitForSelector("#mk:not([hidden])");
  ok(await p.evaluate(() => !!MK.crop && MK.W === MK.crop.w), "Reopening shows the cropped view");
  await p.click('[data-mkt="crop"]'); ok(await p.evaluate(() => MK.W === MK.OW), "Crop tool shows the whole original again");
  await p.click('#mk [data-mk="cropreset"]'); await p.click('#mk [data-mk="cropok"]');
  ok(await p.evaluate(() => MK.crop === null && MK.W === MK.OW), "Full photo removes the crop");
  await p.click('#mk [data-mk="undo"]'); ok(await p.evaluate(() => !!MK.crop), "Undo brings the crop back");
  // ---- Replace the photo underneath, keeping marks ----
  await p.evaluate(async () => { const c = document.createElement("canvas"); c.width = 800; c.height = 600; const x = c.getContext("2d"); x.fillStyle = "#3a3"; x.fillRect(0, 0, 800, 600);
    window.__np = await new Promise(r => c.toBlob(r, "image/png")); });
  const npB64 = await p.evaluate(async () => { const u = new Uint8Array(await window.__np.arrayBuffer()); let s = ""; for (const c of u) s += String.fromCharCode(c); return btoa(s); });
  const npf = path.join(__dirname, "fixtures", "_newphoto.png"); fs.writeFileSync(npf, Buffer.from(npB64, "base64"));
  const bef = await p.evaluate(() => { const R = MK.crop, n = mkNorm(MK.items[0]); return { rx: (n.x + n.w / 2 - R.x) / R.w, ry: (n.y + n.h / 2 - R.y) / R.h, id: MK.origId }; });
  await p.locator("#mkBase").setInputFiles(npf); await p.waitForFunction(id => MK.origId !== id, bef.id);
  const aft = await p.evaluate(() => { const n = mkNorm(MK.items[0]); return { rx: (n.x + n.w / 2) / MK.OW, ry: (n.y + n.h / 2) / MK.OH, w: MK.OW, h: MK.OH, crop: MK.crop, n: MK.items.length }; });
  ok(aft.w === 800 && aft.h === 600 && aft.crop === null && aft.n === 1, "Photo button swaps the photo underneath and keeps the mark " + JSON.stringify(aft));
  ok(Math.abs(aft.rx - bef.rx) < .02 && Math.abs(aft.ry - bef.ry) < .02, "The mark stays in the same spot on the new photo");
  await p.click('#mk [data-mk="done"]'); await p.waitForSelector("#mk", { state: "hidden" });
  ok(await p.evaluate(() => { const t = D.tasks[2]; return t.markup && t.markup.items.length === 1 && !t.markup.crop && t.image_id !== t.markup.orig; }), "Done saves the new photo with the mark");
  // From the step card: a step with an inset picture gets a better main photo
  await p.evaluate(async () => { const t = D.tasks[2]; t.markup.items.push({ t: "img", id: D.tasks[3].image_id, x: 500, y: 350, w: 250, h: 200, c: "#e5191c", th: 2 }); t.image_id = await mkFlatten(await mkDecode(t.markup.orig), t.markup.items, new Map([[D.tasks[3].image_id, await mkDecode(D.tasks[3].image_id)]]), null); });
  const card = p.evaluate(async () => { await setImages(2, [new File([window.__np], "better.png", { type: "image/png" })]); });
  await p.waitForSelector('#dlg [data-r="1"]'); ok(await p.locator("#dlg").innerText().then(t => /Keep the marks/.test(t)), "Adding a photo to a marked-up step asks whether to keep the marks");
  await p.click('#dlg [data-r="1"]'); await card;
  ok(await p.evaluate(() => { const t = D.tasks[2]; return t.markup && t.markup.items.length === 2 && t.markup.items.some(i => i.t === "img" && i.id === D.tasks[3].image_id) && t.image_title === "better.png"; }), "Keep marks: the inset picture and mark move onto the new photo");
  const card2 = p.evaluate(async () => { await setImages(2, [new File([window.__np], "clean.png", { type: "image/png" })]); });
  await p.waitForSelector('#dlg [data-r="0"]'); await p.click('#dlg [data-r="0"]'); await card2;
  ok(await p.evaluate(() => !D.tasks[2].markup && D.tasks[2].image_title === "clean.png"), "Start clean: just the new photo");
  fs.unlinkSync(npf);
  ok(!errs.length, "No console errors " + JSON.stringify(errs));

  // Real-world reopen paths: close & reopen the app (restored draft), and Save -> Open the .soe
  { const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); const q = await ctx.newPage(); const qe = []; q.on("pageerror", e => qe.push(String(e)));
    await q.goto(require("./lib").url("StepSheet.html")); await q.waitForFunction(() => typeof loadDoc === "function");
    await q.evaluate(s => loadDoc(parseSoe(s)), fs.readFileSync(FIXTURE).toString("latin1")); await q.waitForTimeout(500);
    await q.click('[data-mkopen="0"]'); await q.waitForSelector("#mk:not([hidden])");
    const cb = await q.locator("#mkCanvas").boundingBox();
    await q.click('[data-mkt="circle"]'); await q.mouse.move(cb.x + cb.width * .2, cb.y + cb.height * .2); await q.mouse.down(); await q.mouse.move(cb.x + cb.width * .5, cb.y + cb.height * .5, { steps: 6 }); await q.mouse.up();
    await q.click('#mk [data-mk="done"]'); await q.waitForSelector("#mk", { state: "hidden" });
    await q.waitForTimeout(1500);                                  // auto-recovery draft is written
    const saved = await q.evaluate(() => { const u = serializeSoe(D); let s = ""; for (const c of u) s += String.fromCharCode(c); return btoa(s); });
    await q.reload(); await q.waitForFunction(() => typeof D !== "undefined" && D.tasks.length === 4, null, { timeout: 10000 }); await q.waitForTimeout(500);
    await q.click('[data-mkopen="0"]'); await q.waitForSelector("#mk:not([hidden])");
    ok(await q.evaluate(() => MK.items.length === 1 && MK.items[0].t === "circle" && MK.origId === D.tasks[0].markup.orig && MK.origId !== D.tasks[0].image_id), "After closing and reopening the app, the marks are still editable");
    await q.click('#mk [data-mk="cancel"]');
    ok(!qe.length, "Reopen app: no page errors " + JSON.stringify(qe));
    await ctx.close();
    // Save -> open the file in a fresh browser (no saved draft)
    const f = path.join(__dirname, "fixtures", "_marked.soe"); fs.writeFileSync(f, Buffer.from(saved, "base64"));
    const c2 = await b.newContext({ viewport: { width: 1280, height: 900 } }); const r = await c2.newPage();
    await r.goto(require("./lib").url("StepSheet.html")); await r.waitForFunction(() => typeof loadDoc === "function");
    await r.locator("#soeInput").setInputFiles(f); await r.waitForFunction(() => D.tasks.length === 4 && D.tasks[0].markup, null, { timeout: 10000 }); fs.unlinkSync(f);
    await r.waitForTimeout(400); await r.click('[data-mkopen="0"]'); await r.waitForSelector("#mk:not([hidden])");
    ok(await r.evaluate(() => MK.items.length === 1 && MK.origId === D.tasks[0].markup.orig), "After Save and opening the .soe again, the marks are still editable");
    await r.evaluate(() => { MK.items[0].c = "#1f6fe0"; }); await r.click('#mk [data-mk="done"]'); await r.waitForSelector("#mk", { state: "hidden" });
    ok(await r.evaluate(() => D.tasks[0].markup.items[0].c === "#1f6fe0"), "...and changes to them save");
    await c2.close(); }

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
