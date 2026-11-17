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
});
