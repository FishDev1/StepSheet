// Phones: layout fits the screen, touch controls, Copilot in Settings.
const { ok, run, openApp } = require("./lib");
const { devices } = require("playwright");
const fill = () => { D = blankDoc(); const mk = (c, type) => { const t = blankTask(D.default_ppp); t.caption = c; t.tasktype = type; return t; };
  D.tasks = [mk("Required PPE", "Safety"), mk("Position PORT RAIL on DECK and align to BOW mark.", "Work Content"), mk("Check RAIL gap to DECK TRIM is 1/4\".", "Check")]; render(); };
run("phones", async b => {
  for (const [name, opts] of [["320 px phone (dark mode)", { viewport: { width: 320, height: 693 }, isMobile: true, hasTouch: true, colorScheme: "dark" }], ["iPhone 13", devices["iPhone 13"]]]) {
    const { ctx, p, errs } = await openApp(b, opts);
    await p.evaluate(fill); await p.waitForTimeout(150);
    const m = await p.evaluate(() => { const vis = e => e && e.offsetParent !== null;
      const card = document.querySelector(".scard").getBoundingClientRect(), y0 = document.querySelector(".mainwrap").getBoundingClientRect().top, bar = document.querySelector(".mobbar");
      return { overflow: document.documentElement.scrollWidth > innerWidth, stepbar: vis(document.querySelector("#stepbar")), mobbar: vis(bar),
        fits: card.height <= bar.getBoundingClientRect().top - y0, settingsLabel: [...document.querySelectorAll("#tabs button")].filter(vis).map(e => e.innerText.trim()).join("|"),
        codeFont: parseFloat(getComputedStyle(document.querySelector("#tm0")).fontSize) }; });
    ok(!m.overflow, name + ": no sideways scrolling");
    ok(!m.stepbar && m.mobbar, name + ": bottom action bar replaces the desktop step bar");
    ok(m.fits, name + ": a whole step card fits on screen");
    ok(/Settings/.test(m.settingsLabel) && !/Document settings/.test(m.settingsLabel), name + ": tab reads \"Settings\"");
    ok(m.codeFont >= 16, name + ": text boxes are 16 px so iPhone doesn't zoom in");
    // Time box on the step card, before the Code box, feeds the same cycle time Analysis uses
    ok(await p.locator("#rc1").count() === 0, name + ": Code box is hidden by default");
    await p.evaluate(() => { ST.show_code_box = true; render(); });
    const order = await p.evaluate(() => { const a = document.querySelector("#tm1"), c = document.querySelector("#rc1"); return !!(a && c && (a.compareDocumentPosition(c) & Node.DOCUMENT_POSITION_FOLLOWING)); });
    ok(order, name + ": Time box sits before the Code box");
    await p.locator("#tm1").fill("45"); await p.locator("#tm2").fill("20");
    ok(await p.evaluate(() => D.tasks[1].cycletime === "45" && D.tasks[2].cycletime === "20"), name + ": typing in Time sets the step's cycle time");
    ok(/Total time 65/.test(await p.locator("#status").innerText()), name + ": status line shows the total time");
    ok(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)), name + ": still no sideways scrolling with the Time box");
    await p.click('#tabs [data-tab="opt"]');
    ok(await p.locator(".copilot-card [data-cp]").count() === 4, name + ": Copilot card with 4 actions in Settings");
    ok(!errs.length, name + ": no console errors " + JSON.stringify(errs));
    await ctx.close();
  }
  // Paste from Copilot on a phone
  const { ctx, p, errs } = await openApp(b, devices["iPhone 13"]);
  await p.click('#tabs [data-tab="opt"]'); await p.click('[data-cp="paste"]');
  await p.fill("#pasteBox", "1. [Work Content] Route FUEL HOSE [Code: 33 CFR 183.540]"); await p.click('[data-a="append"]');
  ok(await p.evaluate(() => D.tasks.at(-1).code === "33 CFR 183.540"), "Phone: paste from Copilot fills the Code box");
  ok(!errs.length, "Phone paste: no console errors " + JSON.stringify(errs));
  await ctx.close();
  // Desktop doesn't show the Copilot card (it has the toolbar menu)
  const d = await openApp(b, { viewport: { width: 1280, height: 800 } });
  await d.p.click('#tabs [data-tab="opt"]');
  ok(await d.p.locator(".copilot-card").count() === 0, "Desktop: no Copilot card in Settings");
});
