import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, before, test } from "node:test";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import register from "../index.ts";

// Exercise the registered tool, including subprocess handling and host truncation.
let tool: any;
register({ registerTool(value: unknown) { tool = value; } } as ExtensionAPI);
let cwd: string;
before(async () => { cwd = await mkdtemp(join(tmpdir(), "rg-tests-")); });
after(async () => { await rm(cwd, { recursive: true, force: true }); });

const execute = (params: Record<string, unknown>) =>
  tool.execute("test", params, undefined, undefined, { cwd });
const text = (result: any): string => result.content[0].text;

function record(line: number, value = "needle", type = "match", start = 0) {
  return JSON.stringify({
    type,
    data: {
      path: { text: "src/example.ts" },
      line_number: line,
      lines: { text: `${value}\n` },
      submatches: [{ start, end: start + 6 }],
    },
  });
}

// PATH changes are confined to each awaited test. Top-level tests run serially.
async function withFakeRg(output: string, action: () => Promise<void>, code = 0, stderr = "") {
  const bin = await mkdtemp(join(tmpdir(), "rg-bin-"));
  const oldPath = process.env.PATH;
  const capture = join(bin, "args.json");
  await writeFile(join(bin, "rg"), `#!${process.execPath}
const fs = require("node:fs");
fs.writeFileSync(${JSON.stringify(capture)}, JSON.stringify(process.argv.slice(2)));
process.stdout.write(${JSON.stringify(output)});
process.stderr.write(${JSON.stringify(stderr)});
process.exitCode = ${code};
`, { mode: 0o755 });
  process.env.PATH = bin;
  try {
    await action();
    return JSON.parse(await readFile(capture, "utf8"));
  } finally {
    if (oldPath === undefined) delete process.env.PATH;
    else process.env.PATH = oldPath;
    await rm(bin, { recursive: true, force: true });
  }
}

async function savedOutput(result: any) {
  assert.equal(result.details.truncated, true);
  assert.ok(result.details.fullOutputPath);
  try {
    return await readFile(result.details.fullOutputPath, "utf8");
  } finally {
    await rm(dirname(result.details.fullOutputPath), { recursive: true, force: true });
  }
}

test("registered guidance describes exact search without advertising other extensions", () => {
  assert.equal(tool.name, "rg");
  const guidance = [tool.description, tool.promptSnippet, ...(tool.promptGuidelines ?? [])]
    .filter(Boolean).join("\n");
  assert.match(guidance, /Exact text\/regex/);
  assert.match(guidance, /Text matches alone do not establish/);
  assert.doesNotMatch(guidance, /\b(?:Semble|LSP|AST)\b|pi-diet-|ast_grep|semble_search/i);
});

test("default arguments and paths, with a leading-dash pattern", async () => {
  const args = await withFakeRg("", async () => {
    const result = await execute({ query: "--help" });
    assert.equal(text(result), "No matches found");
    assert.deepEqual(result.details.searchedPaths, ["."]);
  });
  assert.deepEqual(args, [
    "--json", "--color=never", "--line-number", "--column",
    "--smart-case", "--", "--help", ".",
  ]);
});

test("all search options, globs, and paths are passed as separate arguments", async () => {
  const args = await withFakeRg("", async () => {
    await execute({
      query: "a b", paths: ["src folder", "other.ts"],
      glob: ["*.ts", "!vendor/**"], caseSensitive: true,
      word: true, context: 0, hidden: true, fixedStrings: true,
    });
  });
  assert.deepEqual(args, [
    "--json", "--color=never", "--line-number", "--column",
    "--case-sensitive", "-w", "--hidden", "--fixed-strings", "-C", "0",
    "--glob", "*.ts", "--glob", "!vendor/**", "--", "a b", "src folder", "other.ts",
  ]);
});

test("empty paths and explicit false options retain safe defaults", async () => {
  const args = await withFakeRg("", async () => {
    await execute({ query: "needle", paths: [], caseSensitive: false, word: false, hidden: false, fixedStrings: false });
  });
  assert.deepEqual(args, [
    "--json", "--color=never", "--line-number", "--column",
    "--smart-case", "--", "needle", ".",
  ]);
});

test("exit code 1 is a clean no-match result", async () => {
  await withFakeRg("", async () => {
    const result = await execute({ query: "absent" });
    assert.equal(text(result), "No matches found");
    assert.equal(result.details.matchCount, 0);
    assert.equal(result.details.truncated, false);
    assert.deepEqual(result.details.matches, []);
    assert.equal(result.details.fullOutputPath, undefined);
  }, 1);
});

test("subprocess errors preserve useful stderr", async () => {
  await withFakeRg("", async () => {
    await assert.rejects(execute({ query: "[" }), /regex parse error: unclosed character class/);
  }, 2, "regex parse error: unclosed character class\n");
});

test("missing rg produces a useful spawn error", async () => {
  const bin = await mkdtemp(join(tmpdir(), "rg-missing-"));
  const oldPath = process.env.PATH;
  process.env.PATH = bin;
  try {
    await assert.rejects(execute({ query: "needle" }), /rg.*ENOENT/);
  } finally {
    if (oldPath === undefined) delete process.env.PATH;
    else process.env.PATH = oldPath;
    await rm(bin, { recursive: true, force: true });
  }
});

test("formatting retains paths, 1-based positions, and context on both sides", async () => {
  await withFakeRg([
    '{"type":"begin"}', "not json",
    record(6, "before", "context"),
    record(7, "  needle", "match", 2),
    record(8, "after", "context"),
    '{"type":"end"}',
  ].join("\n"), async () => {
    const result = await execute({ query: "needle", context: 1 });
    assert.deepEqual(result.details.matches, [
      { path: "src/example.ts", line: 7, column: 3, text: "  needle" },
    ]);
    assert.equal(text(result), "src/example.ts-6- before\nsrc/example.ts:7:3:  needle\nsrc/example.ts-8- after");
    assert.equal(result.details.truncated, false);
  });
});

test("match cap limits displayed matches but saves all matches and context", async () => {
  const output = [
    record(1), record(2, "context one", "context"),
    record(3), record(4, "context two", "context"),
  ].join("\n");
  await withFakeRg(output, async () => {
    const result = await execute({ query: "needle", maxMatches: 1 });
    assert.equal(result.details.matchCount, 2);
    assert.equal(result.details.matches.length, 1);
    assert.match(text(result), /1 matches omitted by maxMatches cap/);
    assert.doesNotMatch(text(result), /example.ts:3:|context two/);
    assert.equal(await savedOutput(result),
      "src/example.ts:1:1:needle\nsrc/example.ts-2- context one\nsrc/example.ts:3:1:needle\nsrc/example.ts-4- context two");
  });
});

test("default cap is 50 and hitting the cap exactly is not truncation", async () => {
  for (const count of [50, 51]) {
    await withFakeRg(Array.from({ length: count }, (_, i) => record(i + 1)).join("\n"), async () => {
      const result = await execute({ query: "needle" });
      assert.equal(result.details.matches.length, 50);
      assert.equal(result.details.matchCount, count);
      assert.equal(result.details.truncated, count > 50);
      if (count > 50) assert.match(await savedOutput(result), /example.ts:51:1:needle/);
      else assert.equal(result.details.fullOutputPath, undefined);
    });
  }
});

test("byte truncation saves complete output", async () => {
  const value = "needle " + "x".repeat(60_000);
  await withFakeRg(record(1, value), async () => {
    const result = await execute({ query: "needle" });
    assert.equal(result.details.truncation.truncated, true);
    assert.ok(text(result).length < value.length);
    assert.equal(await savedOutput(result), `src/example.ts:1:1:${value}`);
  });
});

test("line truncation saves all context lines", async () => {
  await withFakeRg([
    record(1),
    ...Array.from({ length: 2100 }, (_, i) => record(i + 2, "ctx", "context")),
  ].join("\n"), async () => {
    const result = await execute({ query: "needle", context: 2100 });
    assert.equal(result.details.truncation.truncated, true);
    assert.equal(result.details.truncation.outputLines, 2000);
    const full = await savedOutput(result);
    assert.equal(full.split("\n").length, 2101);
    assert.match(full, /example.ts-2101- ctx$/);
  });
});

test("real rg handles dash patterns, spaces in paths, context, no matches, and invalid regex", async () => {
  // Deliberately require rg rather than silently skipping integration coverage.
  execFileSync("rg", ["--version"]);
  await writeFile(join(cwd, "a file.txt"), "before\n  --needle\nafter\n");
  const result = await execute({ query: "--needle", paths: ["a file.txt"], fixedStrings: true, context: 1 });
  assert.deepEqual(result.details.matches, [
    { path: "a file.txt", line: 2, column: 3, text: "  --needle" },
  ]);
  assert.match(text(result), /a file.txt-1- before/);
  assert.match(text(result), /a file.txt-3- after/);
  assert.equal(text(await execute({ query: "absent", paths: ["a file.txt"] })), "No matches found");
  await assert.rejects(execute({ query: "[", paths: ["a file.txt"] }), /regex parse error/);
});
