// Verifikasi internal: manifest valid + semua id template PPTX baru ada.
import fs from "node:fs";

const manifest = JSON.parse(
  fs.readFileSync("templates/manifest/manifest.json", "utf8"),
);
console.log("manifest OK —", manifest.length, "entri");

const src = fs.readFileSync("src/data/templates.ts", "utf8");
const ids = [...src.matchAll(/\bid:\s*"([a-z0-9_]+)"/g)].map((m) => m[1]);
console.log("templates.ts —", ids.length, "id template");

const pptBaru = [
  "sampul_agenda_modern",
  "ringkasan_eksekutif_ppt",
  "dasbor_kpi_presentasi",
  "peta_jalan_roadmap",
  "pitch_proposal_investor",
  "laporan_keuangan_triwulan",
  "pelatihan_onboarding_tim",
  "evaluasi_program_kerja",
  "sosialisasi_kebijakan_baru",
  "perbandingan_opsi_keputusan",
  "laporan_insiden_krisis",
  "showcase_produk_umkm",
  "penutup_terima_kasih_cta",
  "laporan_operasi_militer",
  "laporan_kesiapan_satuan_militer",
];
const hilang = pptBaru.filter((x) => !ids.includes(x));
console.log(
  hilang.length === 0 ? "13 template PPTX baru: SEMUA ADA" : "HILANG: " + hilang.join(", "),
);

const duplikat = ids.filter((v, i) => ids.indexOf(v) !== i);
console.log(duplikat.length === 0 ? "id unik: OK" : "DUPLIKAT: " + duplikat.join(", "));

const manifestPptx = manifest.filter((m) => m.kategori === "presentasi").length;
console.log("manifest presentasi:", manifestPptx);
const tsPptx = [...src.matchAll(/kategori:\s*"presentasi"/g)].length;
console.log("templates.ts presentasi:", tsPptx);

process.exit(hilang.length === 0 && duplikat.length === 0 ? 0 : 1);
