import { execFile as execFileCallback } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { Type } from "@earendil-works/pi-ai";
import {
  DEFAULT_MAX_BYTES,
  DEFAULT_MAX_LINES,
  defineTool,
  formatSize,
  truncateHead,
  type TruncationResult,
  withFileMutationQueue,
  type ExtensionAPI,
} from "@earendil-works/pi-coding-agent";

const execFile = promisify(execFileCallback);

const rgTool = defineTool({
  name: "rg",
  label: "ripgrep",
  description: "Exact text/regex search with ripgrep. Use for literal verification, logs, config keys, TODOs, and message lookup. Prefer LSP/AST/Semble for symbol, structural, or semantic discovery.",
  parameters: Type.Object({
    query: Type.String({ description: "Pattern" }),
    paths: Type.Optional(Type.Array(Type.String({ description: "Path" }))),
    glob: Type.Optional(Type.Array(Type.String({ description: "Glob" }))),
    caseSensitive: Type.Optional(Type.Boolean({ description: "Case-sensitive" })),
    word: Type.Optional(Type.Boolean({ description: "Word match" })),
    context: Type.Optional(Type.Integer({ minimum: 0, description: "Context lines" })),
    maxMatches: Type.Optional(Type.Integer({ minimum: 1, maximum: 200, description: "Match cap" })),
    hidden: Type.Optional(Type.Boolean({ description: "Search hidden files" })),
    fixedStrings: Type.Optional(Type.Boolean({ description: "Literal strings" })),
  }),

  async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
    const args = buildArgs(params);
    const searchPaths = params.paths?.length ? params.paths : ["."];
    const maxMatches = params.maxMatches ?? 50;

    let stdout = "";
    try {
      const result = await execFile("rg", [...args, params.query, ...searchPaths], {
        cwd: ctx.cwd,
        encoding: "utf8",
        maxBuffer: 100 * 1024 * 1024,
      });
      stdout = result.stdout;
    } catch (error: any) {
      stdout = error?.stdout ?? "";
      if (error?.code !== 1) {
        throw new Error(error?.stderr?.trim() || error?.message || "ripgrep failed");
      }
    }

    const parsed = parseRgJson(stdout, maxMatches);
    const details: RgDetails = {
      query: params.query,
      searchedPaths: searchPaths,
      matchCount: parsed.totalMatchCount,
      truncated: parsed.totalMatchCount > parsed.matches.length,
      matches: parsed.matches,
    };

    if (!parsed.totalMatchCount) {
      return {
        content: [{ type: "text", text: "No matches found" }],
        details,
      };
    }

    const fullText = parsed.lines.join("\n");
    const truncation = truncateHead(fullText, {
      maxLines: DEFAULT_MAX_LINES,
      maxBytes: DEFAULT_MAX_BYTES,
    });

    let text = truncation.content;
    if (details.truncated || truncation.truncated) {
      details.truncated = true;
      details.truncation = truncation;
      const tempDir = await mkdtemp(join(tmpdir(), "pi-diet-ripgrep-"));
      const tempFile = join(tempDir, "output.txt");
      await withFileMutationQueue(tempFile, async () => {
        await writeFile(tempFile, fullText, "utf8");
      });
      details.fullOutputPath = tempFile;
      const omittedMatches = Math.max(0, parsed.totalMatchCount - parsed.matches.length);
      const notices: string[] = [];
      if (omittedMatches) notices.push(`${omittedMatches} matches omitted by maxMatches cap`);
      if (truncation.truncated) {
        notices.push(
          `output truncated to ${truncation.outputLines}/${truncation.totalLines} lines and ${formatSize(truncation.outputBytes)}/${formatSize(truncation.totalBytes)}`,
        );
      }
      text += `\n\n[${notices.join("; ")}. Full output: ${tempFile}]`;
    }

    return {
      content: [{ type: "text", text }],
      details,
    };
  },
});

export default function (pi: ExtensionAPI) {
  pi.registerTool(rgTool);
}

function buildArgs(params: {
  glob?: string[];
  caseSensitive?: boolean;
  word?: boolean;
  context?: number;
  hidden?: boolean;
  fixedStrings?: boolean;
}) {
  const args = ["--json", "--color=never", "--line-number", "--column"];
  if (params.caseSensitive) {
    args.push("--case-sensitive");
  } else {
    args.push("--smart-case");
  }
  if (params.word) args.push("-w");
  if (params.hidden) args.push("--hidden");
  if (params.fixedStrings) args.push("--fixed-strings");
  if (typeof params.context === "number") args.push("-C", String(params.context));
  for (const glob of params.glob ?? []) args.push("--glob", glob);
  return args;
}

type RgMatch = {
  path: string;
  line: number;
  column: number;
  text: string;
};

type RgDetails = {
  query: string;
  searchedPaths: string[];
  matchCount: number;
  truncated: boolean;
  matches: RgMatch[];
  truncation?: TruncationResult;
  fullOutputPath?: string;
};

function parseRgJson(stdout: string, maxMatches: number) {
  const lines: string[] = [];
  const matches: RgMatch[] = [];
  let totalMatchCount = 0;

  for (const rawLine of stdout.split(/\r?\n/)) {
    if (!rawLine.trim()) continue;
    let record: any;
    try {
      record = JSON.parse(rawLine);
    } catch {
      continue;
    }

    if (record.type === "match") {
      totalMatchCount += 1;
      const path = record.data?.path?.text ?? "<unknown>";
      const line = record.data?.line_number ?? 0;
      const text = String(record.data?.lines?.text ?? "").replace(/\n$/, "");
      const column = (record.data?.submatches?.[0]?.start ?? 0) + 1;
      if (matches.length < maxMatches) {
        matches.push({ path, line, column, text });
        lines.push(`${path}:${line}:${column}:${text}`);
      }
      continue;
    }

    if (record.type === "context" && matches.length > 0) {
      const path = record.data?.path?.text ?? "<unknown>";
      const line = record.data?.line_number ?? 0;
      const text = String(record.data?.lines?.text ?? "").replace(/\n$/, "");
      lines.push(`${path}-${line}- ${text}`);
    }
  }

  return { lines, matches, totalMatchCount };
}
