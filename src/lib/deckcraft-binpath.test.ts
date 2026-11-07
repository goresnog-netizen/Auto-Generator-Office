/**
 * Uji penentuan lokasi binary deckcraft-cli.
 *
 * Regresi yang dijaga: fungsi ini dulu hanya mengembalikan jalur Windows,
 * sehingga instalasi Linux/macOS — termasuk container Docker — selalu
 * melaporkan "Binary deckcraft-cli tidak ditemukan" meski berkasnya ada.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import path from "node:path";
import { defaultBinPath } from "./deckcraft";

describe("defaultBinPath", () => {
  const asli = process.env.DECKCRAFT_CLI;

  afterEach(() => {
    if (asli === undefined) delete process.env.DECKCRAFT_CLI;
    else process.env.DECKCRAFT_CLI = asli;
    vi.restoreAllMocks();
  });

  it("memakai DECKCRAFT_CLI bila di-set (dipakai image Docker)", () => {
    process.env.DECKCRAFT_CLI = "/usr/local/bin/deckcraft-cli";
    expect(defaultBinPath()).toBe("/usr/local/bin/deckcraft-cli");
  });

  it("mengabaikan DECKCRAFT_CLI yang kosong / hanya spasi", () => {
    process.env.DECKCRAFT_CLI = "   ";
    const hasil = defaultBinPath();
    expect(hasil).not.toBe("   ");
    expect(hasil.endsWith("deckcraft-cli") || hasil.endsWith("deckcraft-cli.exe")).toBe(true);
  });

  it("di Windows menunjuk berkas .exe di folder portable", () => {
    delete process.env.DECKCRAFT_CLI;
    vi.spyOn(process, "platform", "get").mockReturnValue("win32");
    const hasil = defaultBinPath();
    expect(hasil).toContain("deckcraft-0.8.0-windows-x64-portable");
    expect(hasil.endsWith("deckcraft-cli.exe")).toBe(true);
  });

  it("di Linux menunjuk bin/deckcraft-cli (struktur arsip resmi)", () => {
    delete process.env.DECKCRAFT_CLI;
    vi.spyOn(process, "platform", "get").mockReturnValue("linux");
    const hasil = defaultBinPath();
    expect(hasil).toBe(
      path.join(
        process.cwd(),
        "vendors",
        "deckcraft-bin",
        "app",
        "deckcraft-0.8.0-linux-x86_64",
        "bin",
        "deckcraft-cli",
      ),
    );
    // Linux TIDAK boleh memakai akhiran .exe
    expect(hasil.endsWith(".exe")).toBe(false);
  });

  it("di macOS menunjuk folder macos-universal", () => {
    delete process.env.DECKCRAFT_CLI;
    vi.spyOn(process, "platform", "get").mockReturnValue("darwin");
    const hasil = defaultBinPath();
    expect(hasil).toContain("deckcraft-cli-0.8.0-macos-universal");
    expect(hasil.endsWith("deckcraft-cli")).toBe(true);
  });
});
