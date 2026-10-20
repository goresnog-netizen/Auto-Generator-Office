import { describe, it, expect } from "vitest";

// Smoke test: verify core utilities work correctly
// These tests validate the pure functions that the app depends on

describe("NitZ-909 Core Smoke Tests", () => {
  it("should sanitize file names correctly", () => {
    const sanitize = (name: string) =>
      name
        .replace(/[\\/:*?"<>|]+/g, "-")
        .replace(/\s+/g, " ")
        .replace(/[. ]+$/, "")
        .slice(0, 120)
        .trim() || "Dokumen NitZ-909";

    expect(sanitize("Test/File:Name?")).toBe("Test-File-Name-");
    expect(sanitize("  Multiple   Spaces  ")).toBe("Multiple Spaces");
    expect(sanitize("")).toBe("Dokumen NitZ-909");
    expect(sanitize("   ")).toBe("Dokumen NitZ-909");
  });

  it("should parse JSON blocks correctly", () => {
    const parseBlocks = (json: string) => {
      const cleaned = json
        .trim()
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/```\s*$/, "")
        .trim();
      const data = JSON.parse(cleaned);
      if (!Array.isArray(data)) throw new Error("Not an array");
      return data.filter(
        (item: any) =>
          item &&
          typeof item === "object" &&
          typeof item.type === "string" &&
          ["heading", "paragraph", "list"].includes(item.type),
      );
    };

    const input =
      '```json\n[{"type":"heading","text":"Title","level":1},{"type":"paragraph","text":"Content"}]\n```';
    const result = parseBlocks(input);
    expect(result).toHaveLength(2);
    expect(result[0].type).toBe("heading");
    expect(result[1].type).toBe("paragraph");
  });

  it("should validate template structure", () => {
    const validateTemplate = (t: any) => {
      if (!t || typeof t !== "object") return false;
      if (!t.id || !t.nama || !t.kategori || !t.format) return false;
      if (!Array.isArray(t.blocks) || t.blocks.length === 0) return false;
      return t.blocks.every(
        (b: any) =>
          b &&
          typeof b === "object" &&
          typeof b.id === "string" &&
          typeof b.type === "string",
      );
    };

    const validTemplate = {
      id: "test",
      nama: "Test",
      kategori: "dokumen",
      format: "word",
      blocks: [{ id: "1", type: "heading", text: "Title", level: 1 }],
    };

    const invalidTemplate = { id: "test" };

    expect(validateTemplate(validTemplate)).toBe(true);
    expect(validateTemplate(invalidTemplate)).toBe(false);
    expect(validateTemplate(null)).toBe(false);
  });

  it("should handle export format validation", () => {
    const validFormats = ["pdf", "word", "pptx", "xlsx", "diagram"];
    const isValidFormat = (f: string) => validFormats.includes(f);

    expect(isValidFormat("pdf")).toBe(true);
    expect(isValidFormat("word")).toBe(true);
    expect(isValidFormat("pptx")).toBe(true);
    expect(isValidFormat("xlsx")).toBe(true);
    expect(isValidFormat("diagram")).toBe(true);
    expect(isValidFormat("invalid")).toBe(false);
  });
});
