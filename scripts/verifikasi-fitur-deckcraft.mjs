/**
 * Verifikasi statis fitur DeckCraft baru (tanpa browser, tanpa binary).
 *
 * Mengunci regresi yang ditemukan sesi ini:
 *  1. Mirror `Deploy Github/` tidak boleh meng-import `server/deckcraft-api.ts`
 *     secara statis -> build Vercel gagal ("cannot find module").
 *  2. Konverter harus menghasilkan perintah font untuk blok kode.
 *  3. Perintah harus membawa nomor slide.
 *  4. Klien harus punya jalur filmstrip + ekspor format.
 *  5. UI harus punya tombol PDF/GIF + filmstrip.
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const cek = (l, ok, d = "") => {
  console.log(`[${ok ? "OK  " : "GAGAL"}] ${l}${d ? " — " + d : ""}`);
  if (!ok) process.exitCode = 1;
};

const baca = (p) => readFileSync(path.resolve(p), "utf8");

// ---------- 1. Mirror Vercel ----------
const mirror = "Deploy Github";
cek("folder mirror ada", existsSync(mirror));

const viteMirror = baca(path.join(mirror, "vite.config.ts"));
cek(
  "mirror vite.config TIDAK meng-import server/deckcraft-api secara statis",
  !/^\s*import\s+.*from\s+"\.\/server\//m.test(viteMirror),
  "import statis membuat build Vercel gagal",
);
cek(
  "mirror vite.config memuat modul API secara dinamis + aman",
  /await import\("\.\/server\/deckcraft-api\.ts"\)/.test(viteMirror) &&
    /catch/.test(viteMirror),
);
cek(
  "mirror TIDAK punya folder server/ (memang tak boleh, Vercel statis)",
  !existsSync(path.join(mirror, "server")),
);

const pkgMirrorPath = path.join(mirror, "package.json");
// BOM bikin JSON.parse gagal ("Unexpected token '\uFEFF'"), jadi berkas
// dibaca sebagai byte dulu, BOM-nya dicek terpisah, lalu JSON-nya dibaca
// dari teks yang sudah dibersihkan.
const bytePkg = readFileSync(pkgMirrorPath);
const adaBom = bytePkg[0] === 0xef && bytePkg[1] === 0xbb && bytePkg[2] === 0xbf;
const teksPkg = adaBom
  ? Buffer.from(bytePkg.subarray(3)).toString("utf8")
  : bytePkg.toString("utf8");
let pkgMirror = { scripts: {} };
try {
  pkgMirror = JSON.parse(teksPkg);
} catch (e) {
  cek("mirror package.json bisa diparse sebagai JSON", false, e.message);
}
cek(
  "mirror package.json tak mengandung dependensi runtime server",
  !pkgMirror.dependencies?.["@types/node"] ||
    pkgMirror.devDependencies?.["@types/node"] !== undefined,
  "devDependency tidak masalah",
);
cek(
  "mirror package.json tak punya skrip yang menunjuk folder tak ada",
  !pkgMirror.scripts?.["serve"] &&
    !pkgMirror.scripts?.["verify:all"] &&
    !pkgMirror.scripts?.["vendor:deckcraft"],
  Object.keys(pkgMirror.scripts ?? {}).join(", "),
);
cek(
  "mirror typecheck cuma satu tsconfig (tak merujuk file tak ada)",
  pkgMirror.scripts?.typecheck === "tsc --noEmit",
  pkgMirror.scripts?.typecheck,
);
// BOM bikin PostCSS/Vite gagal parse JSON -> build mirror pecah.
cek(
  "mirror package.json tanpa BOM",
  !adaBom,
  `3 byte pertama: ${[...bytePkg.subarray(0, 3)].map((b) => b.toString(16)).join(" ")}`,
);

// ---------- 2. Konverter: font blok kode ----------
const konv = baca("src/lib/deckcraft-ppt.ts");
cek("konverter punya konstanta FONT_KODE", /export const FONT_KODE\s*=/.test(konv));
cek("konverter punya UKURAN_FONT_KODE", /export const UKURAN_FONT_KODE\s*=/.test(konv));
cek(
  "blok kode memakai format.font",
  /tambahKode[\s\S]*?format\.font/.test(konv),
);
cek(
  "blok kode memakai format.size",
  /tambahKode[\s\S]*?format\.size/.test(konv),
);
cek(
  "blok kode memakai shape.fill + shape.line",
  /tambahKode[\s\S]*?shape\.fill/.test(konv) &&
    /tambahKode[\s\S]*?shape\.line/.test(konv),
);
cek(
  "blok kode ditangani lewat tambahKode (bukan tambahTeks)",
  /case "code"[\s\S]{0,80}tambahKode/.test(konv),
);
cek(
  "konverter memberi nomor slide pada perintah",
  /slide\?: number/.test(konv) && /perintahBersih\.push\(\{ \.\.\.isi, slide: nomorSlide \}\)/.test(konv),
);
cek(
  "konverter TIDAK membuat perintah slide.go (bridge yang menyisipkan)",
  !/command:\s*"slide\.go"/.test(konv),
);

// ---------- 3. Bridge: sisipkan slide.go ----------
const bridge = baca("src/lib/deckcraft.ts");
cek(
  "bridge menyisipkan slide.go sebelum perintah per-slide",
  /command:\s*"slide\.go"/.test(bridge) && /perintahKeEngine/.test(bridge),
);
cek(
  "bridge punya perintahKeEngine yang menyisipkan slide.go",
  /perintahKeEngine/.test(bridge) && /slide\.go/.test(bridge),
);
cek(
  "bridge punya metode jalankanEngine (perintah engine di luar batch)",
  /async jalankanEngine\(/.test(bridge),
);
cek(
  "bridge punya ekspor berformat (pdf/gif)",
  /async ekspor\(/.test(bridge) && /"pdf"/.test(bridge) && /"gif"/.test(bridge),
);
cek(
  "bridge punya renderSemua (filmstrip)",
  /async renderSemua\(/.test(bridge),
);

// ---------- 4. Server API ----------
const api = baca("server/deckcraft-api.ts");
cek("server punya rute /api/deckcraft/filmstrip", /\/api\/deckcraft\/filmstrip/.test(api));
cek("server punya rute /api/deckcraft/export-format", /\/api\/deckcraft\/export-format/.test(api));
cek("server menolak format tak didukung dengan 400", /FORMAT_EKSPOR/.test(api));

// ---------- 5. Klien browser ----------
const klien = baca("src/lib/deckcraft-client.ts");
cek("klien punya ambilFilmstrip", /export async function ambilFilmstrip/.test(klien));
cek("klien punya unduhFormatDeckcraft", /export async function unduhFormatDeckcraft/.test(klien));
cek(
  "klien tetap punya unduhPptxDeckcraft (rute /export tak diubah)",
  /export async function unduhPptxDeckcraft/.test(klien) &&
    /\$\{DASAR\}\/export`/.test(klien),
);

// ---------- 6. UI ----------
const ui = baca("src/components/DeckCraftStudio.tsx");
cek("UI punya tombol Unduh PDF", /Unduh PDF/.test(ui));
cek("UI punya tombol Unduh GIF", /Unduh GIF/.test(ui));
cek("UI merender filmstrip", /dc-filmstrip/.test(ui));
cek("UI punya toggle filmstrip", /dc-toggle-filmstrip/.test(ui));
cek("UI memanggil ambilFilmstrip", /ambilFilmstrip\(/.test(ui));

// ---------- 7. CSS ----------
const css = baca("src/styles/glass.css");
cek("CSS punya gaya .dc-filmstrip", /\.dc-filmstrip\s*\{/.test(css));
cek("CSS punya gaya .dc-toggle-filmstrip", /\.dc-toggle-filmstrip\s*\{/.test(css));
cek(
  "filmstrip TIDAK pakai backdrop-filter (menghindari layer kompositing)",
  !/\.dc-filmstrip[^{]*\{[^}]*backdrop-filter/.test(css),
);

// ---------- 8. Skrip verifikasi baru ----------
for (const s of [
  "scripts/verifikasi-kode-deckcraft.mts",
  "scripts/verifikasi-api-filmstrip.mjs",
  "scripts/verifikasi-ui-filmstrip.mjs",
]) {
  cek(`skrip ${s} ada`, existsSync(s));
}

// ---------- 9. Bukti DOM untuk selektor yang di-whitelist ----------
//
// Selektor filmstrip hanya muncul saat toggle dibuka, jadi `verifikasi-css.mjs`
// tak bisa mengujinya di state default dan harus ada di whitelist-nya.
// Whitelist tanpa bukti ==dead CSS yang lolos. Skrip ini memastikan
// selektor itu benar-benar dirender di DOM saat filmstrip dibuka.
const uiFilmstrip = baca("scripts/verifikasi-ui-filmstrip.mjs");
cek(
  "skrip UI filmstrip membuktikan .dc-filmstrip-item ada di DOM",
  uiFilmstrip.includes(".dc-filmstrip-item") &&
    uiFilmstrip.includes("querySelectorAll('.dc-filmstrip-item')"),
);
cek(
  "skrip UI filmstrip membuka toggle sebelum menghitung thumbnail",
  uiFilmstrip.includes("Filmstrip") && uiFilmstrip.includes("b.click()"),
);
cek(
  "skrip UI filmstrip memverifikasi thumbnail benar-benar ter-render",
  uiFilmstrip.includes("naturalWidth"),
);

console.log("\nSelesai.");
