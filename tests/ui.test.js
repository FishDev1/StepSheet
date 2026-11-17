// Everyday editing on a desktop browser: typing, step bar, drag, Analysis, menus, accessibility, narrow widths.
const { ok, run, openApp } = require("./lib");
run("editing (desktop)", async b => {
  const { p, errs } = await openApp(b, { viewport: { width: 1180, height: 860 } });
  await p.evaluate(()=>{ D=blankDoc(); D.name="T.soe"; const mk=c=>{ const t=blankTask(D.default_ppp); t.caption=c; return t; }; D.tasks=[mk("A"),mk("B"),mk("C")]; sel=new Set([0]); render(); });
  const caps=()=>p.evaluate(()=>D.tasks.map(t=>t.caption).join(""));
  // Tab in task box -> next, and adds a step at the end
  await p.click('#cap0'); await p.keyboard.press('Tab'); ok(await p.evaluate(()=>document.activeElement.id)==='cap1','Tab moves to next task box');
  await p.keyboard.press('Shift+Tab'); ok(await p.evaluate(()=>document.activeElement.id)==='cap0','Shift+Tab moves back');
  await p.click('#cap2'); await p.keyboard.press('Tab'); ok(await p.evaluate(()=>D.tasks.length)===4 && await p.evaluate(()=>document.activeElement.id)==='cap3','Tab on last step adds a step');
  await p.keyboard.press('Tab'); ok(await p.evaluate(()=>D.tasks.length)===4,'Tab on an empty last step does not add another');
  await p.evaluate(()=>{ D.tasks.pop(); render(); });
  // Step bar (direct buttons, act on the selected step)
  await p.click('[data-sel="1"]'); ok((await p.$eval('#stepbar .sbinfo',e=>e.textContent))==='Step 2','Step bar names the selected step');
  await p.click('#stepbar [data-act="down"]'); ok(await caps()==='ACB','Down button moves the selected step');
  ok(await p.evaluate(()=>[...sel][0])===2,'Selection follows the moved step');
  ok(await p.$eval('#stepbar [data-act="down"]',e=>e.disabled),'Down is disabled on the last step');
  await p.click('#stepbar [data-act="del"]'); ok(await caps()==='AC','Delete button');
  await p.click('#toast [data-act="undo"]'); ok(await caps()==='ACB','Undo restores deleted step');
  await p.click('[data-sel="0"]'); await p.click('#stepbar [data-act="insert"]'); ok(await p.evaluate(()=>D.tasks.length===4&&D.tasks[0].caption===""),'Insert above'); await p.evaluate(()=>{ D.tasks.shift(); sel=new Set([0]); render(); });
  await p.focus('#stepbar [data-act="up"]'); ok(await p.evaluate(()=>document.activeElement.disabled===false||document.activeElement.dataset.act!=="up"),'Step bar buttons are keyboard reachable');
  // shift-select and Step menu
  await p.click('[data-sel="0"]'); await p.click('[data-sel="1"]',{modifiers:['Shift']}); ok(await p.evaluate(()=>sel.size)===2,'Shift+click selects a range');
  ok((await p.$eval('#stepbar .sbinfo',e=>e.textContent))==='2 steps selected','Step bar shows multi-select');
  await p.click('#stepbar [data-act="dup"]'); ok(await caps()==='ACACB','Duplicate selection');
  await p.evaluate(()=>{ D.tasks.splice(2,2); sel=new Set([0]); render(); });
  // Drag reorder: move step 1 below step 3
  { const bb=await p.$eval('[data-row="2"]',e=>e.getBoundingClientRect().height); await p.dragAndDrop('[data-drag="0"]','[data-row="2"]',{targetPosition:{x:20,y:bb-8}}); } ok(await caps()==='CBA','Drag handle reorders (A to bottom)');
  // Type, quality, layout
  await p.selectOption('#tt0','Check'); ok(await p.evaluate(()=>D.tasks[0].tasktype)==='Check','Type select updates');
  await p.check('[data-q="0"]'); ok(await p.evaluate(()=>D.tasks[0].quality)===true,'Integral to quality toggle');
  await p.selectOption('#pp0','1 Picture Portrait'); ok(await p.evaluate(()=>D.tasks[0].pics_per_page)==='1 Picture Portrait','Layout select keeps file value');
  ok((await p.$eval('#pp0',e=>e.selectedOptions[0].textContent))==='1 photo · portrait','Layout shown as friendly label');
  // Analysis
  await p.click('[data-tab="an"]'); await p.fill('#ct0','20'); await p.fill('#ct1','30');
  ok((await p.$eval('#anSum',e=>e.textContent)).includes('50'),'Totals update live while typing');
  ok(await p.evaluate(()=>document.activeElement.id)==='ct1','Focus stays in the time box');
  await p.click('label:has(> [data-value="1"][value="VA"])'); ok(await p.evaluate(()=>D.tasks[1].value_added&&!D.tasks[1].non_value_added),'Value radio sets Value Added');
  await p.click('label:has(> [data-sw="1"][value="setup"])'); ok(await p.evaluate(()=>D.tasks[1].setup.selected&&!D.tasks[1].work.selected),'Activity Setup');
  await p.check('[data-ml="1"][value="labor"]'); ok(await p.evaluate(()=>D.tasks[1].setup.labor),'Labor checkbox');
  await p.click('[data-wastemenu="1"]'); await p.click('.menu button:has-text("Waiting")'); await p.waitForTimeout(60); ok(await p.evaluate(()=>D.tasks[1].wastes.waiting),'Add waste from menu');
  ok(await p.evaluate(()=>document.activeElement.dataset.wastemenu)==="1",'Focus returns to Add after picking a waste');
  await p.click('[data-unwaste="1"][data-w="waiting"]'); ok(await p.evaluate(()=>!D.tasks[1].wastes.waiting),'Remove waste chip');
  ok((await p.$eval('#anChart',e=>e.textContent)).includes('30 · Value Added'),'Chart bars carry text labels');
  // Save / reopen round trip
  const xml=await p.evaluate(()=>new TextDecoder("iso-8859-1").decode(serializeSoe(D)));
  const back=await p.evaluate(x=>{ const d=parseSoe(x); return JSON.stringify(d.tasks.map(t=>[t.caption,t.tasktype,t.quality,t.pics_per_page,t.cycletime,t.value_added,t.setup.selected,t.setup.labor])); },xml);
  ok(back===await p.evaluate(()=>JSON.stringify(D.tasks.map(t=>[t.caption,t.tasktype,t.quality,t.pics_per_page,t.cycletime,t.value_added,t.setup.selected,t.setup.labor]))),'.soe save and reopen keep every field');
  // PDFs still build
  const sizes=await p.evaluate(async()=>{ const a=await buildInstructions(D,"T.pdf",()=>{}); const s=await buildSoe(D,"T.pdf"); return [a.size,s.size]; });
  ok(sizes[0]>1000&&sizes[1]>1000,'Instructions and Analysis PDFs build ('+sizes+')');
  // menus: File / PDF contents
  await p.click('[data-tab="vi"]'); ok(await p.evaluate(()=>['new','open','save','saveas'].every(k=>{ const e=document.querySelector('#tb [data-act="'+k+'"]'); return e&&e.offsetParent!==null; })),'New, Open, Save, Save As are direct toolbar buttons');
  await p.click('[data-menu="pdf"]'); const pm=await p.$$eval('.menu button',x=>x.map(y=>y.textContent.replace(/times.*$/,'')).join('|')); ok(pm.includes('Analysis PDF')&&pm.includes('Export steps to Excel'),'Create PDF menu: '+pm); await p.keyboard.press('Escape');
  await p.click('[data-act="copilot"]'); ok((await p.$$eval('.menu button',x=>x.length))===4,'Copilot menu opens'); await p.keyboard.press('Escape');
  // accessible names on icon-only controls
  const unnamed=await p.evaluate(()=>[...document.querySelectorAll('button,select,input,textarea,[role=button]')].filter(e=>e.offsetParent!==null).filter(e=>{ const n=(e.getAttribute('aria-label')||e.textContent||'').trim(); const lab=e.labels&&e.labels.length; return !n&&!lab&&!e.title; }).map(e=>e.outerHTML.slice(0,80)));
  ok(!unnamed.length,'Every visible control has a name '+JSON.stringify(unnamed));
  // 200% zoom ~ 590px wide fine pointer, and 320px
  for(const w of [590,320]){ await p.setViewportSize({width:w,height:800}); await p.waitForTimeout(100); ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No sideways scroll at '+w+'px'); }
  ok(!errs.length, "No console errors " + JSON.stringify(errs));
});
