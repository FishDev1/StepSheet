// Copilot copy / paste: reading pasted steps (including [Code: ...] tags), review & replace, prompts.
const { ok, run, openApp } = require("./lib");
run("Copilot", async b => {
  const { p, errs } = await openApp(b, { viewport: { width: 1280, height: 900 } });
  const ps = await p.evaluate(() => parseSteps(`Title: Fuel system
1. [Safety] Wear REQUIRED P.P.E
2. [Work Content] Route FUEL HOSE to OUTBOARD [Code: 33 CFR 183.540]
3. [Verify] VERIFY ANTI-SIPHON VALVE installed (Code: ABYC H-24)
4. [Work Content] Mount BATTERY BOX
   [Code: ABYC E-10]
5. [Check] Check hose clamps [Code: ABYC H-24] [Code: 33 CFR 183.532]
6. [Quality] Inspect DECK seams`));
  const s = ps.steps;
  ok(ps.title === "Fuel system" && s.length === 6, "Reads the title and 6 numbered steps");
  ok(s[0].type === "Safety" && s[2].type === "Verify" && s[4].type === "Check", "Reads step types from [Type] tags");
  ok(s[0].code == null, "No tag means no code");
  ok(s[1].caption === "Route FUEL HOSE to OUTBOARD" && s[1].code === "33 CFR 183.540", "[Code: ...] tag moves into the Code box");
  ok(s[2].code === "ABYC H-24", "(Code: ...) in parentheses also works");
  ok(s[3].caption === "Mount BATTERY BOX" && s[3].code === "ABYC E-10", "A tag wrapped onto its own line still works");
  ok(s[4].code === "ABYC H-24, 33 CFR 183.532", "Two tags on one step are joined");

  // Copy out: codes travel with the steps
  await p.evaluate(() => { D = blankDoc(); const t = blankTask(D.default_ppp); t.caption = "Route fuel hose"; t.code = "ABYC H-24"; const u = blankTask(D.default_ppp); u.caption = "Mount battery"; u.code = "ABYC E-10"; D.tasks = [t, u]; render(); });
  ok((await p.evaluate(() => stepsText())).includes("Route fuel hose [Code: ABYC H-24]"), "Copied steps carry their codes");
  ok(await p.evaluate(() => COPILOT_PROMPT.includes("outboard") && VWI_PROMPT.includes("outboard") && COPILOT_PROMPT.includes("never guess")), "Prompts limit codes to outboard pontoons and say never guess");

  // Review & replace shows the code change, and applies it
  await p.evaluate(() => reviewPaste(parseSteps("1. [Work Content] {1} Route FUEL HOSE to OUTBOARD [Code: 33 CFR 183.540]\n2. [Work Content] {2} Mount BATTERY BOX")));
  await p.waitForSelector(".revlist");
  const rev = await p.locator(".revlist").innerText();
  ok(rev.includes("ABYC H-24") && rev.includes("33 CFR 183.540"), "Review shows old and new code");
  await p.click("[data-apply]");
  ok(JSON.stringify(await p.evaluate(() => D.tasks.map(t => t.code))) === JSON.stringify(["33 CFR 183.540", "ABYC E-10"]), "Apply sets the new code; an untagged step keeps its code");

  // Bundling two steps keeps both codes
  await p.evaluate(() => reviewPaste(parseSteps("1. [Work Content] {1,2} Route FUEL HOSE and mount BATTERY BOX")));
  await p.waitForSelector(".revlist"); await p.click("[data-apply]");
  ok(await p.evaluate(() => D.tasks.length === 1 && D.tasks[0].code === "33 CFR 183.540, ABYC E-10"), "Combining steps keeps every code");

  // Paste dialog, Add to bottom
  await p.click('[data-act="copilot"]'); await p.click('.menu button:has-text("Paste")');
  await p.fill("#pasteBox", "1. [Check] Check TRIM gap [Code: ABYC H-24]"); await p.click('[data-a="append"]');
  ok(await p.evaluate(() => { const t = D.tasks.at(-1); return t.caption === "Check TRIM gap" && t.tasktype === "Check" && t.code === "ABYC H-24"; }), "Paste dialog adds steps at the bottom with type and code");
  ok(!errs.length, "No console errors " + JSON.stringify(errs));
  // Combined steps with photos: pick the main photo, the others become insets
  const setup2 = async () => p.evaluate(async () => { const mk = async col => { const c = document.createElement("canvas"); c.width = 800; c.height = 600; const x = c.getContext("2d"); x.fillStyle = col; x.fillRect(0, 0, 800, 600);
      const b = await new Promise(r => c.toBlob(r, "image/jpeg", 0.9)); const id = newId(); D.images[id] = bytesToB64(new Uint8Array(await b.arrayBuffer())); return id; };
    D = blankDoc(); const a = blankTask(D.default_ppp), b = blankTask(D.default_ppp), c = blankTask(D.default_ppp);
    a.caption = "Route hose"; a.image_id = await mk("#c00"); b.caption = "Clamp hose"; b.image_id = await mk("#00c"); c.caption = "Check clamps"; D.tasks = [a, b, c]; render(); return [a.image_id, b.image_id]; });
  let [ra, rb] = await setup2();
  await p.evaluate(() => reviewPaste(parseSteps("1. [Work Content] {1,2} Route HOSE and clamp it\n2. [Check] {3} Check CLAMPS")));
  await p.waitForSelector(".revlist");
  ok(await p.locator('.revpics [data-main="0"]').count() === 2 && await p.locator('.revpics [data-main="1"]').count() === 0, "A combined step with two photos offers a Main choice; a single step doesn't");
  ok(await p.locator('[data-main="0"]').first().isChecked() && await p.locator('[data-ins="0"]').nth(1).isChecked() && await p.locator('[data-ins="0"]').first().isDisabled(), "Default: first step's photo is Main, the other is an inset");
  await p.click("[data-apply]"); await p.waitForFunction(() => document.querySelector("#modal").hidden);
  let res = await p.evaluate(([a, b]) => { const t = D.tasks[0]; return { orig: t.markup && t.markup.orig === a, inset: t.markup && t.markup.items.some(i => i.t === "img" && i.id === b), newPhoto: t.image_id !== a && !!D.images[t.image_id], n: D.tasks.length }; }, [ra, rb]);
  ok(res.orig && res.inset && res.newPhoto && res.n === 2, "Apply: main photo with the other step's photo inset, editable in Mark up");
  const px = await p.evaluate(async () => { const t = D.tasks[0], it = t.markup.items[0]; const bm = await createImageBitmap(new Blob([b64ToBytes(D.images[t.image_id])], { type: "image/jpeg" }));
    const c = document.createElement("canvas"); c.width = bm.width; c.height = bm.height; const x = c.getContext("2d"); x.drawImage(bm, 0, 0);
    const at = (X, Y) => [...x.getImageData(X, Y, 1, 1).data.slice(0, 3)]; return { inset: at(Math.round(it.x + it.w / 2), Math.round(it.y + it.h / 2)), main: at(40, 40) }; });
  ok(px.inset[2] > 150 && px.inset[0] < 80 && px.main[0] > 150 && px.main[2] < 80, "The finished photo shows the inset (blue) on the main photo (red)");
  // choose the second photo as main
  [ra, rb] = await setup2();
  await p.evaluate(() => reviewPaste(parseSteps("1. [Work Content] {1,2} Route HOSE and clamp it\n2. [Check] {3} Check CLAMPS")));
  await p.waitForSelector(".revlist"); await p.locator('[data-main="0"]').nth(1).check();
  ok(await p.locator('[data-ins="0"]').nth(1).isDisabled() && await p.locator('[data-ins="0"]').first().isChecked(), "Switching Main swaps which photo is the inset");
  await p.click("[data-apply]"); await p.waitForFunction(() => document.querySelector("#modal").hidden);
  ok(await p.evaluate(([a, b]) => { const t = D.tasks[0]; return t.markup.orig === b && t.markup.items.some(i => i.id === a); }, [ra, rb]), "Apply uses the chosen main photo");
  // untick the inset: main photo only
  [ra, rb] = await setup2();
  await p.evaluate(() => reviewPaste(parseSteps("1. [Work Content] {1,2} Route HOSE and clamp it\n2. [Check] {3} Check CLAMPS")));
  await p.waitForSelector(".revlist"); await p.locator('[data-ins="0"]').nth(1).uncheck(); await p.click("[data-apply]"); await p.waitForFunction(() => document.querySelector("#modal").hidden);
  ok(await p.evaluate(a => D.tasks[0].image_id === a && !D.tasks[0].markup, ra), "Unticking Inset keeps just the main photo");
  // combined step where only one source has a photo: unchanged behaviour
  await p.evaluate(() => reviewPaste(parseSteps("1. [Work Content] {1,2} Route HOSE, clamp it and check CLAMPS")));
  await p.waitForSelector(".revlist");
  ok(await p.locator(".revpics").count() === 0, "Combining a step that has a photo with one that doesn't shows no picker");
  await p.click("[data-apply]");
});
