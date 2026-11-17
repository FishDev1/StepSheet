// Runs every tests/*.test.js, then the Python checks if Python is installed.
// Usage (from the repo root, after `python src/build.py`):  node tests/run.js
const { spawnSync } = require("child_process");
const fs = require("fs"), path = require("path");
const dir = __dirname;
let pass = 0, fail = 0, crashed = [];
for (const f of fs.readdirSync(dir).filter(f => f.endsWith(".test.js")).sort()) {
  const r = spawnSync(process.execPath, [path.join(dir, f)], { encoding: "utf8" });
  process.stdout.write(r.stdout); if (r.stderr) process.stderr.write(r.stderr);
  const m = /: (\d+) passed, (\d+) failed\s*$/.exec(r.stdout.trim());
  if (m) { pass += +m[1]; fail += +m[2]; } else crashed.push(f);
  if (r.status !== 0 && !(m && +m[2])) crashed.push(f);
}
const py = ["python3", "python", "py"].find(c => spawnSync(c, ["--version"]).status === 0);
if (py) {
  const r = spawnSync(py, ["-m", "unittest", "-v", "tests.test_python"], { cwd: path.resolve(dir, ".."), encoding: "utf8" });
  const out = (r.stdout || "") + (r.stderr || ""); process.stdout.write("python edition\n" + out.split("\n").filter(l => / \.\.\. |^Ran |^OK|^FAILED/.test(l)).map(l => "  " + l).join("\n") + "\n");
  const ran = +((/Ran (\d+) test/.exec(out) || [])[1] || 0), bad = /FAILED \((?:failures=(\d+))?(?:, )?(?:errors=(\d+))?/.exec(out);
  const nb = bad ? (+(bad[1] || 0) + +(bad[2] || 0)) : 0; pass += ran - nb; fail += nb;
} else console.log("python edition: skipped (Python not found)");
console.log(`\nTOTAL: ${pass} passed, ${fail} failed` + (crashed.length ? `; did not finish: ${[...new Set(crashed)].join(", ")}` : ""));
process.exitCode = fail || crashed.length ? 1 : 0;
