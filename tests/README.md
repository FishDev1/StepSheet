# StepSheet tests

Automated checks that the built app still works: about 120 checks in a real browser (headless Chromium)
plus 6 for the Python edition. A full run takes about a minute.

## Run them

From the repo root, after building:

```
python src/build.py                    # tests check the built files, so build first
cd tests
npm install                            # once: installs Playwright
npx playwright install chromium        # once: downloads the test browser
npm test
```

The last line says `TOTAL: N passed, 0 failed`. Anything else is a problem: the failing line says what broke.
The command also exits non-zero on failure, so it can gate a CI pipeline.

Run one area at a time with `node tests/<name>.test.js`.
Python checks alone: `python -m unittest -v tests.test_python`.

## What's covered

| File | Checks |
| --- | --- |
| `ui.test.js` | Desktop editing: typing and Tab between steps, step bar, select, duplicate, delete and undo, drag to reorder, step type, quality flag, layouts, Analysis tab totals, values, wastes, toolbar and menus, every control has a name, no sideways scroll at 590 px and 320 px |
| `soe.test.js` | Opening the sample `.soe`; saving keeps every tag, attribute, value and photo (including tags StepSheet doesn't recognize); a second save is identical; edits save; unused photos dropped; bad files give a readable error |
| `pdf.test.js` | Instructions, Spanish and Analysis PDFs build and contain the header, steps, codes and photos; screen previews are small while the PDF keeps the full photo (Original) or shrinks it (Low); PDF file names |
| `copilot.test.js` | Reading pasted steps and `[Code: ...]` tags, codes going out with copied steps, prompts, Review & replace, combining steps, the Paste dialog |
| `phone.test.js` | 320 px (dark mode) and iPhone 13: fits the screen, bottom action bar, a whole step card visible, 16 px text boxes, Copilot card in Settings, pasting on a phone |
| `pwa.test.js` | Manifest, icons, service-worker version matches `build.py`, relative paths; served from a local web server: service worker installs, app opens with the network off; Open with loads a `.soe`; `StepSheet.html` forwards to the installable app on a website |
| `test_python.py` | Python edition reads the sample, keeps everything on save, PDF names match the app, PDFs build (skipped without reportlab) |

## The sample file

`fixtures/sample.soe` is made up (no real company content): 4 steps, 2 small photos, a Spanish title,
a USCG/ABYC code, and a few `Example*` tags standing in for anything the original Visual Instructor might
store that StepSheet doesn't model. Rebuild it with `npm run sample`. It's good practice to also try a few
real production `.soe` files by hand before a release (see the release checklist in the handover guide).

## When a test fails after a change on purpose

Some checks pin exact values (file names, labels, the 480 px preview). If you changed that behavior on
purpose, update the expected value in the test in the same commit.
