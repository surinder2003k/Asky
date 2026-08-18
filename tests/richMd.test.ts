import { describe, expect, it } from "vitest";
import { renderRichMd } from "../src/richMd";

describe("renderRichMd", () => {
  it("renders a gfm table", () => {
    const md = "| a | b |\n|---|---|\n| 1 | 2 |";
    const html = renderRichMd(md);
    expect(html).toContain("<table");
    expect(html).toContain("<th>");
  });

  it("emits KaTeX math placeholder for inline math", () => {
    const html = renderRichMd("hello $E=mc^2$ world");
    expect(html).toContain("E=mc^2");
    expect(html).toContain("katex");
  });

  it("emits mermaid placeholder for fenced mermaid blocks", () => {
    const md = "```mermaid\ngraph TD\n  A-->B\n```";
    const html = renderRichMd(md);
    expect(html).toContain("language-mermaid");
    expect(html).toContain("graph TD");
  });

  it("keeps html preview placeholders", () => {
    const md = "```html\n<h1>hi</h1>\n```";
    const html = renderRichMd(md);
    expect(html).toContain("code-html-block");
  });
});
