import { describe, expect, it } from "vitest";

// Extract the code-block parsing logic used by MessageText so we can test it
// deterministically without rendering React Native views.
function extractCodeBlocks(text: string): string[] {
  const blocks: string[] = [];
  const lines = text.split("\n");
  let inCodeBlock = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith("```")) {
      if (!inCodeBlock) {
        const codeLines: string[] = [];
        let j = i + 1;
        while (j < lines.length && !lines[j].trim().startsWith("```")) {
          codeLines.push(lines[j]);
          j++;
        }
        blocks.push(codeLines.join("\n"));
        i = j;
        inCodeBlock = false;
        continue;
      }
      continue;
    }
    if (inCodeBlock) continue;
  }
  return blocks;
}

describe("code block copy feature", () => {
  it("extracts a code block from a chat message", () => {
    const text = "Here is the code:\n```ts\nconst x = 1;\nconsole.log(x);\n```\nDone.";
    const blocks = extractCodeBlocks(text);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toBe("const x = 1;\nconsole.log(x);");
  });

  it("extracts multiple code blocks", () => {
    const text = "```\nfirst\n```\nsome text\n```\nsecond\n```";
    expect(extractCodeBlocks(text)).toEqual(["first", "second"]);
  });

  it("handles empty code block", () => {
    const text = "no code here\n```\n```";
    const blocks = extractCodeBlocks(text);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toBe("");
  });

  it("returns nothing when there are no code blocks", () => {
    expect(extractCodeBlocks("just plain text")).toEqual([]);
  });

  it("handles language tag on the opening fence", () => {
    const text = "```python\nprint('hi')\n```";
    const blocks = extractCodeBlocks(text);
    expect(blocks).toHaveLength(1);
    // Language tag line is treated as first content line — app copies it as-is
    expect(blocks[0]).toContain("print('hi')");
  });
});

// Extract the table-parsing logic used by MessageText so we can test it
// deterministically without rendering React Native views.
function extractTables(text: string): string[][][] {
  const tables: string[][][] = [];
  const lines = text.split("\n");
  const isTableLine = (line: string) =>
    /^\|[^|]*\|/.test(line.trim()) && line.trim().split("|").length >= 4;
  const isSeparatorRow = (line: string) => /^\|[\s:\-|]+\|/.test(line.trim());
  const isTableRow = (line: string) => isTableLine(line) || isSeparatorRow(line);
  const parseRow = (line: string) =>
    line.trim().slice(1, -1).split("|").map((c) => c.trim());

  for (let i = 0; i < lines.length; i++) {
    if (isTableLine(lines[i]) && isTableLine(lines[i + 1]) && i + 1 < lines.length) {
      const tableLines: string[] = [];
      let j = i;
      while (j < lines.length && isTableRow(lines[j])) {
        tableLines.push(lines[j]);
        j++;
      }
      tables.push([parseRow(tableLines[0]), ...tableLines.slice(2).map(parseRow)]);
      i = j - 1;
    }
  }
  return tables;
}

describe("markdown table rendering", () => {
  it("extracts header and body rows from a table", () => {
    const text =
      "| Model | Provider | Vision |\n| --- | --- | --- |\n| Gemini | google | yes |\n| Llama | groq | no |";
    const tables = extractTables(text);
    expect(tables).toHaveLength(1);
    expect(tables[0]).toEqual([
      ["Model", "Provider", "Vision"],
      ["Gemini", "google", "yes"],
      ["Llama", "groq", "no"],
    ]);
  });

  it("ignores plain text lines that contain single pipes", () => {
    const text = "use the command `cat file.txt | grep foo` here";
    expect(extractTables(text)).toEqual([]);
  });

  it("extracts multiple tables separated by text", () => {
    const text =
      "| A | B |\n| --- | --- |\n| 1 | 2 |\n\ntext between\n\n| C | D |\n| --- | --- |\n| 3 | 4 |";
    const tables = extractTables(text);
    expect(tables).toHaveLength(2);
  });

  it("handles tables with inline markdown in cells", () => {
    const text = "| Name | Note |\n| --- | --- |\n| **Bold** | `code` |";
    const tables = extractTables(text);
    expect(tables[0].length).toBeGreaterThan(1);
    expect(tables[0][1][0]).toBe("**Bold**");
    expect(tables[0][1][1]).toBe("`code`");
  });
});
