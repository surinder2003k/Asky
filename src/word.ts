/**
 * Word (.docx) export for Asky chats.
 *
 * Uses the `docx` library to generate a real Word document from the chat
 * transcript: user/assistant messages as paragraphs, plus the chat title,
 * model, and date in the header.
 */
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
} from "docx";
import type { Chat } from "./storage";

/** Strip markdown-ish syntax for a clean Word document. */
function cleanText(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, (m) => `[code block]\n${m}`)
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/#{1,6}\s+/g, "")
    .replace(/^\s*[-*]\s+/gm, "• ")
    .replace(/>\s+/gm, "");
}

export async function exportChatToWord(chat: Chat): Promise<void> {
  const children: Paragraph[] = [];

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [new TextRun({ text: chat.title || "Chat export", size: 44, bold: true })],
    }),
  );
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: `Exported on ${new Date().toLocaleString()} • Model: ${chat.modelKey || "unknown"}`,
          size: 20,
          color: "666666",
        }),
      ],
    }),
  );
  children.push(new Paragraph({ text: "", spacing: { after: 240 } }));

  for (const msg of chat.messages) {
    const label = msg.role === "user" ? "You" : "Asky";
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 240, after: 80 },
        children: [new TextRun({ text: label, size: 28, bold: true, color: "2A2A2A" })],
      }),
    );
    const lines = cleanText(msg.content || "").split("\n");
    for (const line of lines) {
      if (line === "[code block]" || line.startsWith("```")) {
        children.push(
          new Paragraph({
            shading: { fill: "F2F2F2" },
            children: [new TextRun({ text: line.replace("```", "").trim(), font: "Consolas", size: 20 })],
          }),
        );
        continue;
      }
      children.push(
        new Paragraph({
          spacing: { after: 100 },
          children: [new TextRun({ text: line || " ", size: 22 })],
        }),
      );
    }
  }

  const doc = new Document({
    creator: "Asky",
    title: chat.title || "Chat export",
    sections: [{ properties: {}, children }],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(chat.title || "chat").replace(/[^a-zA-Z0-9 _-]/g, "").slice(0, 40) || "chat"}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
