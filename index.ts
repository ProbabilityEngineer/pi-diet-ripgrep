import { spawn } from "node:child_process";
import { mkdtemp, open, rm } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Type } from "@earendil-works/pi-ai";
import {
  DEFAULT_MAX_BYTES,
  DEFAULT_MAX_LINES,
  defineTool,
  formatSize,
  truncateHead,
  type TruncationResult,
  type ExtensionAPI,
} from "@earendil-works/pi-coding-agent";

const MAX_METADATA_MATCH_BYTES = 20_000;
const MAX_LINE_BYTES = 1_024;

const rgTool = defineTool({
  name: "rg",
  label: "ripgrep",
  description: "Exact text/regex search with ripgrep. Use for literal verification, logs, config keys, TODOs, and message lookup. Text matches alone do not establish symbol identity, code structure, or behavior.",
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

  async execute(_toolCallId, params, signal, _onUpdate, ctx) {
    const args = buildArgs(params);
    const searchPaths = params.paths?.length ? params.paths : ["."];
    const maxMatches = params.maxMatches ?? 50;

    const capture = await captureRg([...args, "--", params.query, ...searchPaths], ctx.cwd, signal);
    const parsed = await parseRgJson(capture.rawPath, capture.fullPath, maxMatches);
    const truncation = truncateHead(parsed.lines.join("\n"), {
      maxLines: DEFAULT_MAX_LINES,
      maxBytes: DEFAULT_MAX_BYTES,
    });
    const details: RgDetails = {
      query: shortText(params.query, 512),
      searchedPaths: searchPaths.slice(0, 20).map(value => shortText(value, 256)),
      matchCount: parsed.totalMatchCount,
      truncated: parsed.omittedMatches > 0 || parsed.metadataOmitted > 0 ||
        parsed.shortenedLines > 0 || parsed.previewOverflow || truncation.truncated ||
        parsed.invalidRecords > 0,
      matches: parsed.matches,
      metadataOmitted: parsed.metadataOmitted,
      shortenedLines: parsed.shortenedLines,
      incomplete: parsed.invalidRecords > 0,
    };
    if (details.query !== params.query || searchPaths.length > 20 ||
        searchPaths.some(value => Buffer.byteLength(value) > 256)) details.truncated = true;
    let text = truncation.content || (parsed.invalidRecords ? "No complete matching records parsed." : "No matches found");
    if (details.truncated) {
      // Do not duplicate the display content inside transcript metadata.
      const { content: _content, ...stats } = truncation;
      details.truncation = stats;
      details.fullOutputPath = capture.fullPath;
      details.rawOutputPath = capture.rawPath;
      const notices: string[] = [];
      if (parsed.omittedMatches) notices.push(`${parsed.omittedMatches} matches omitted by maxMatches cap`);
      if (parsed.metadataOmitted) notices.push(`${parsed.metadataOmitted} selected matches omitted from metadata by its byte budget`);
      if (parsed.shortenedLines) notices.push(`${parsed.shortenedLines} long lines shortened; match windows may omit other occurrences`);
      if (parsed.invalidRecords) notices.push(`${parsed.invalidRecords} invalid JSON records; search evidence is incomplete`);
      if (truncation.truncated || parsed.previewOverflow) {
        notices.push(
          `output truncated to ${truncation.outputLines}/${truncation.totalLines} lines and ${formatSize(truncation.outputBytes)}/${formatSize(truncation.totalBytes)}`,
        );
      }
      if (!notices.length) notices.push("query/path metadata shortened");
      text += `\n\n[${notices.join("; ")}. Full output: ${capture.fullPath}; raw rg JSON: ${capture.rawPath}. Temporary files; not a durable archive.]`;
    } else {
      await rm(capture.directory, { recursive: true, force: true });
    }

    return {
      content: [{ type: "text", text }],
      details,
      isError: parsed.invalidRecords > 0,
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
  truncation?: Omit<TruncationResult, "content">;
  fullOutputPath?: string;
  rawOutputPath?: string;
  metadataOmitted?: number;
  shortenedLines?: number;
  incomplete?: boolean;
};

function shortText(value: string, maxBytes: number) {
  const buffer = Buffer.from(value);
  if (buffer.length <= maxBytes) return value;
  return windowText(buffer, 0, maxBytes - 3) + "...";
}

function windowText(buffer: Buffer, start: number, end: number) {
  while (start < end && (buffer[start] & 0xc0) === 0x80) start++;
  while (end < buffer.length && end > start && (buffer[end] & 0xc0) === 0x80) end--;
  return buffer.subarray(start, end).toString("utf8");
}

function linePreview(value: string, submatches: { start: number }[] = []) {
  const buffer = Buffer.from(value);
  if (buffer.length <= MAX_LINE_BYTES) return value;
  if (!submatches.length) return shortText(value, MAX_LINE_BYTES);
  return submatches.slice(0, 3).map(match => {
    const start = Math.max(0, match.start - 120);
    const end = Math.min(buffer.length, match.start + 200);
    return `[match byte column ${match.start + 1}] ${start > 0 ? "..." : ""}${windowText(buffer, start, end)}${end < buffer.length ? "..." : ""}`;
  }).join(" | ");
}

async function captureRg(args: string[], cwd: string, signal?: AbortSignal) {
  const directory = await mkdtemp(join(tmpdir(), "pi-diet-ripgrep-"));
  const rawPath = join(directory, "rg.jsonl");
  const stderrPath = join(directory, "stderr.txt");
  const out = await open(rawPath, "w", 0o600);
  const err = await open(stderrPath, "w", 0o600);
  let failure: Error | undefined;
  let code: number | null;
  try {
    code = await new Promise<number | null>(resolve => {
      const child = spawn("rg", args, { cwd, signal, stdio: ["ignore", out.fd, err.fd] });
      child.on("error", error => { failure = error; });
      child.on("close", resolve);
    });
  } finally {
    await Promise.all([out.close(), err.close()]);
  }
  if (failure || (code !== 0 && code !== 1)) {
    const file = await open(stderrPath, "r");
    let message: string;
    try {
      const bytes = Buffer.alloc(4_000);
      const { bytesRead } = await file.read(bytes, 0, bytes.length, 0);
      message = bytes.subarray(0, bytesRead).toString("utf8").trim();
    } finally { await file.close(); }
    throw new Error(`${message || failure?.message || `ripgrep exited with code ${code}`}\nCaptured stdout: ${rawPath}; stderr: ${stderrPath}`);
  }
  return { directory, rawPath, fullPath: join(directory, "output.txt") };
}

async function parseRgJson(rawPath: string, fullPath: string, maxMatches: number) {
  const lines: string[] = [];
  const matches: RgMatch[] = [];
  let totalMatchCount = 0;
  let metadataBytes = 0, metadataOmitted = 0, shortenedLines = 0, invalidRecords = 0;
  let previewBytes = 0, previewOverflow = false, first = true;
  const output = await open(fullPath, "w", 0o600);
  const input = createReadStream(rawPath);
  const records = createInterface({ input, crlfDelay: Infinity });
  const addPreview = (line: string) => {
    if (previewOverflow) return;
    lines.push(line);
    previewBytes += Buffer.byteLength(line) + 1;
    if (lines.length > DEFAULT_MAX_LINES || previewBytes > DEFAULT_MAX_BYTES) previewOverflow = true;
  };
  try {
  for await (const rawLine of records) {
    if (!rawLine.trim()) continue;
    let record: any;
    try {
      record = JSON.parse(rawLine);
    } catch {
      invalidRecords++;
      continue;
    }
    if (!record || typeof record !== "object") {
      invalidRecords++;
      continue;
    }

    if (record.type === "match") {
      totalMatchCount += 1;
      const path = record.data?.path?.text ?? "<unknown>";
      const line = record.data?.line_number ?? 0;
      const text = String(record.data?.lines?.text ?? "").replace(/\n$/, "");
      const column = (record.data?.submatches?.[0]?.start ?? 0) + 1;
      await output.writeFile(`${first ? "" : "\n"}${path}:${line}:${column}:${text}`);
      first = false;
      if (totalMatchCount <= maxMatches) {
        const preview = linePreview(text, record.data?.submatches);
        if (preview !== text || Buffer.byteLength(path) > 512) shortenedLines++;
        const match = { path: shortText(path, 512), line, column, text: preview };
        const bytes = Buffer.byteLength(JSON.stringify(match));
        if (metadataBytes + bytes <= MAX_METADATA_MATCH_BYTES) {
          matches.push(match);
          metadataBytes += bytes;
        } else metadataOmitted++;
        addPreview(`${shortText(path, 512)}:${line}:${column}:${preview}`);
      }
      continue;
    }

    if (record.type === "context") {
      const path = record.data?.path?.text ?? "<unknown>";
      const line = record.data?.line_number ?? 0;
      const text = String(record.data?.lines?.text ?? "").replace(/\n$/, "");
      const formatted = `${path}-${line}- ${text}`;
      await output.writeFile(`${first ? "" : "\n"}${formatted}`);
      first = false;
      if (totalMatchCount <= maxMatches) {
        const preview = linePreview(text);
        if (preview !== text || Buffer.byteLength(path) > 512) shortenedLines++;
        addPreview(`${shortText(path, 512)}-${line}- ${preview}`);
      }
    }
  }
  } finally {
    records.close();
    input.destroy();
    await output.close();
  }
  return { lines, matches, totalMatchCount, metadataOmitted, shortenedLines, invalidRecords,
    previewOverflow, omittedMatches: Math.max(0, totalMatchCount - maxMatches) };
}
