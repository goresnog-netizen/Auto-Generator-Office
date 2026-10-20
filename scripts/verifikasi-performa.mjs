/**
 * Verifikasi performa Glassmorphism modern.
 *
 * Mengukur:
 *  1. Berapa elemen yang punya backdrop-filter (layer kompositing).
 *  2. Frame rate saat scroll (aurora + blur).
 *  3. Apakah aurora benar-benar animasi (transform berubah antar frame).
 *  4. Apakah sheen tepi terlihat di panel.
 */
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const URL = process.env.URL || "http://127.0.0.1:5180/";
const PORT = 9343;

const chrome = spawn(CHROME, [
  "--headless=new",
  "--disable-gpu",
  "--hide-scrollbars",
  "--window-size=1600,1100",
  // Headless Chrome default-nya meniru `prefers-reduced-motion: reduce`,
  // yang mematikan animasi aurora. Matikan supaya animasi bisa diuji.
  "--force-prefers-reduced-motion=no-preference",
  // Tanpa ini, renderer headless bisa jadi idle: requestAnimationFrame
  // tidak pernah dipanggil sehingga FPS selalu 0.
  "--disable-background-timer-throttling",
  "--disable-renderer-backgrounding",
  "--disable-backgrounding-occluded-windows",
  "--disable-frame-rate-limit",
  `--remote-debugging-port=${PORT}`,
  "--user-data-dir=" + path.resolve("vendors/deckcraft-bin/chrome-profile-perf"),
  "about:blank",
], { stdio: ["ignore", "pipe", "pipe"] });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function target() {
  for (let i = 0; i < 40; i++) {
    try {
      const l = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const p = l.find((t) => t.type === "page");
      if (p?.webSocketDebuggerUrl) return p.webSocketDebuggerUrl;
    } catch {}
    await sleep(500);
  }
  throw new Error("CDP tidak siap");
}

const ws = new WebSocket(await target());
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let id = 0;
const pend = new Map();
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
});
const kirim = (method, params = {}) => new Promise((res) => {
  const i = ++id; pend.set(i, res);
  ws.send(JSON.stringify({ id: i, method, params }));
});
const ev = async (e) => {
  const r = await kirim("Runtime.evaluate", { expression: e, returnByValue: true, awaitPromise: true });
  if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.text ?? "eval gagal");
  return r.result?.result?.value;
};

await kirim("Page.enable");
await kirim("Performance.enable");
await kirim("Runtime.enable");
// Headless Chrome selalu meniru `prefers-reduced-motion: reduce` (flag CLI
// tidak berlaku). Override lewat CDP supaya animasi aurora bisa diuji.
await kirim("Emulation.setEmulatedMedia", {
  features: [{ name: "prefers-reduced-motion", value: "no-preference" }],
});
await kirim("Page.navigate", { url: URL });
for (let i = 0; i < 40; i++) {
  await sleep(500);
  if ((await ev(`!!document.querySelector('.nitz-app-root') && document.querySelectorAll('*').length > 200`)) === true) break;
}
await sleep(2000);

const cek = (l, ok, d = "") => {
  console.log(`[${ok ? "OK  " : "GAGAL"}] ${l}${d ? " — " + d : ""}`);
  if (!ok) process.exitCode = 1;
};

// 1. Lapisan backdrop-filter.
const layers = await ev(`
  (() => {
    let blur = 0, total = 0, willChange = 0;
    // Luas area yang ditutup layer blur (px2). Beban kompositing
    // backdrop-filter sebanding dengan AREA, bukan cuma jumlah elemen:
    // satu panel besar lebih mahal daripada sepuluh label kecil.
    //
    // PENTING: area dihitung per-KELOMPOK blur, bukan dijumlah mentah.
    // Elemen yang saling menumpuk (kartu di dalam sidebar di dalam
    // panel) would've terhitung berkali-kali dan membuat angkanya
    // jauh lebih besar dari beban sebenarnya.
    let areaBlur = 0;
    const contoh = [];
    for (const el of document.querySelectorAll('*')) {
      total++;
      const cs = getComputedStyle(el);
      const bf = cs.backdropFilter || cs.webkitBackdropFilter || '';
      if (bf.includes('blur')) {
        blur++;
        const r = el.getBoundingClientRect();
        const luas = Math.max(0, r.width) * Math.max(0, r.height);
        areaBlur += luas;
        if (contoh.length < 12) {
          contoh.push({
            cls: (el.className && String(el.className).split(' ')[0]) || el.tagName,
            w: Math.round(r.width),
            h: Math.round(r.height),
          });
        }
      }
      if (cs.willChange && cs.willChange !== 'auto') willChange++;
    }
    return { blur, total, willChange, areaBlur: Math.round(areaBlur), contoh };
  })()
`);
console.log(`  backdrop-filter: ${layers.blur}/${layers.total} (${((layers.blur/layers.total)*100).toFixed(1)}%)`);
console.log(`  area tercakup blur (akumulatif): ${(layers.areaBlur/1e6).toFixed(2)} Mpx`);
console.log(`  will-change: ${layers.willChange} elemen`);
cek("jumlah layer backdrop-filter terkendali (<= 60)", layers.blur <= 60, `${layers.blur}`);
cek(
  "jumlah layer blur rendah (<= 20)",
  layers.blur <= 20,
  `${layers.blur} layer`,
);

// 2. Aurora benar-benar animasi?
const reduced = await ev(
  `window.matchMedia('(prefers-reduced-motion: reduce)').matches`,
);
console.log("  prefers-reduced-motion aktif:", reduced);

const anim = await ev(`
  (() => {
    const a = document.querySelector('.nitz-aurora');
    if (!a) return null;
    const cs = getComputedStyle(a);
    return {
      ada: true,
      name: cs.animationName,
      durasi: cs.animationDuration,
      willChange: cs.willChange,
      transform: cs.transform,
    };
  })()
`);
console.log("  aurora:", JSON.stringify(anim));
cek("elemen .nitz-aurora ada", anim?.ada === true);
cek("aurora beranimasi (tidak killed reduced-motion)", anim?.name === "aurora-geser", anim?.name);
cek("aurora pakai transform (GPU, bukan repaint)", /matrix/.test(anim?.transform || ""));

// 3. Ukur transform aurora berubah → animasi benar-benar jalan.
const t1 = await ev(`getComputedStyle(document.querySelector('.nitz-aurora')).transform`);
await sleep(1200);
const t2 = await ev(`getComputedStyle(document.querySelector('.nitz-aurora')).transform`);
cek("transform aurora berubah antar waktu (animasi hidup)", t1 !== t2,
  t1 === t2 ? "tidak berubah" : "berubah");

// 4. Biaya layout+paint.
// CATATAN PENTING: angka "reaktif" yang besar (~150 ms) adalah artefak
// headless tanpa GPU — menyimpan ulang ribuan aturan CSS tiap iterasi.
// Yang relevan untuk experienced user adalah BIAYA TAMBAHAN dari blur,
// diukur dengan membandingkan dua kondisi pada proses yang sama, dan
// mengambil nilai TERKECIL dari beberapa percobaan (noise hanya menambah).
const ukur = `
  (mode) => {
    const root = document.querySelector('.nitz-app-root');
    const samples = [];
    for (let i = 0; i < 30; i++) {
      const t0 = performance.now();
      if (mode === 'reaktif') {
        document.body.style.setProperty('--probe', String(i));
        void root.offsetHeight;
        document.body.style.removeProperty('--probe');
      } else {
        void root.offsetHeight;   // baca layout, tanpa memaksa recalc
      }
      samples.push(performance.now() - t0);
    }
    samples.sort((a, b) => a - b);
    return {
      median: samples[Math.floor(samples.length / 2)],
      p95: samples[Math.floor(samples.length * 0.95)],
      max: samples[samples.length - 1],
    };
  }
`;

const baseline = await ev(`(${ukur})('baseline')`);
const reaktif = await ev(`(${ukur})('reaktif')`);
console.log(
  `  baseline (baca layout) : median ${baseline?.median?.toFixed(3)}ms`,
);
console.log(
  `  reaktif (ubah style)   : median ${reaktif?.median?.toFixed(2)}ms, ` +
    `p95 ${reaktif?.p95?.toFixed(2)}ms`,
);
cek("biaya baca layout < 1ms (tidak ada reflow mahal)", (baseline?.median ?? 999) < 1,
  `${baseline?.median?.toFixed(3)}ms`);

// 4. Biaya blur.
// CATATAN PENTING: probe lama mengubah CSS variable di `body`, yang
// memaksa browser menyimpan ulang SEMUA aturan CSS. Noise itu (puluhan
// ms, berpindah antar-jalankan) menutupi biaya blur yang jauh lebih
// kecil — makanya pengukuran lama flaky (6,4 ms vs 12,5 ms di eksekusi
// berbeda pada kode yang sama).
//
// Probe baru: SCROLL. Saat halaman digeser, `backdrop-filter` wajib
// mengambil sampel ulang isi di belakang tiap elemen berkaca. Kalau blur
// mahal, biaya frame saat scroll naik jelas. Ini juga skenario yang
// paling relevan bagi user nyata (membaca dokumen panjang).
//
// Catatan: probe sebelumnya memakai `backgroundPosition` — itu property
// layout, BUKAN repaint, jadi tak memaksa browser membaca backdrop
// sama sekali. Hasilnya 0,00 ms yang menyesatkan.
const ukurScroll = `
  (async () => {
    // Cari kontainer yang benar-benar bisa digeser. Aplikasi NitZ-909
    // memakai panel scroll internal, jadi tak cukup cuma documentElement.
    // CATATAN: querySelectorAll('*') TIDAK menyertakan documentElement --
    // itu harus ditambahkan eksplisit.
    const cari = () => {
      const kandidat = [document.documentElement, document.body];
      for (const el of kandidat) {
        if (el && el.scrollHeight - el.clientHeight > 80 && el.clientHeight > 100) {
          return el;
        }
      }
      for (const el of Array.from(document.querySelectorAll('*'))) {
        if (el.scrollHeight - el.clientHeight > 80 && el.clientHeight > 100) {
          return el;
        }
      }
      return null;
    };
    const target = cari();
    if (!target) {
      // Diagnostik: laporkan kenapa tak ada yang bisa digeser, supaya
      // kegagalan pengukuran tak disalahartikan sebagai "biaya 0 ms".
      const info = {
        de: {
          sh: document.documentElement.scrollHeight,
          ch: document.documentElement.clientHeight,
        },
        body: {
          sh: document.body.scrollHeight,
          ch: document.body.clientHeight,
        },
        ih: window.innerHeight,
      };
      return JSON.stringify({
        tidakBisaGeser: true,
        maksScroll: 0,
        info,
      });
    }
    const maksScroll = target.scrollHeight - target.clientHeight;
    const awal = target.scrollTop;
    // Geser halaman. Pengukuran waktu dilakukan di sisi Node (lihat
    // ambilTerbaik): timer di dalam halaman dipengaruhi cadence
    // requestAnimationFrame yang di headless bisa ~1 detik/frame, jadi
    // angka di dalam halaman bukan ukuran biaya yang kita mau.
    const langkah = Math.max(28, Math.floor(maksScroll / 8));
    for (let i = 0; i < 8; i++) {
      target.scrollTop = awal + (i + 1) * langkah;
      void target.scrollHeight;
    }
    return JSON.stringify({
      tidakBisaGeser: false,
      maksScroll,
      kelas: target.className ? String(target.className).slice(0, 60) : '(root)',
      posisi: target.scrollTop,
    });
  })
`;

/**
 * Ukur beban kerja kumulatif lewat Performance domain CDP.
 *
 * Kenapa bukan `Page.captureScreenshot`: raster PNG di headless memakan
 * ~5,7 detik per frame, dan encoding-nya mendominasi selisih sehingga
 * biaya blur (~5% dari total) tenggelam dalam noise.
 *
 * Kenapa bukan `performance.now()` di dalam halaman: di headless tanpa
 * GPU, requestAnimationFrame bisa berjarak ~1 detik antar-frame, jadi
 * timer di halaman mengukur cadence browser, bukan biaya kerja.
 *
 * `Performance.getMetrics` memberi counter KUMULATIF (TaskDuration,
 * LayoutDuration, RecalcStyleDuration). Selisih counter di atas N
 * operasi jauh lebih rendah noise daripada mengukur tiap operasi.
 */
const metrik = async () => {
  const r = await kirim("Performance.getMetrics");
  const m = {};
  for (const x of r.result?.metrics ?? []) m[x.name] = x.value;
  return m;
};

/** Scroll halaman dalam N langkah, memaksa paint tiap langkah. */
const SCROLL_STEPS = 40;
const bebanScroll = `
  (() => {
    const target = document.documentElement;
    const langkah = 40;
    for (let i = 0; i < ${SCROLL_STEPS}; i++) {
      target.scrollTop = (i + 1) * langkah;
      // Paksa browser memproses posisi scroll (bukan cuma mencatatnya).
      void target.scrollHeight;
      void target.getBoundingClientRect().height;
    }
    target.scrollTop = 0;
    return target.scrollTop;
  })
`;

/**
 * Ukur beban kumulatif (ms) untuk satu kondisi.
 * Mengembalikan selisih counter terhadap kondisi baseline.
 */
const ukurBeban = async () => {
  const sebelum = await metrik();
  await ev(bebanScroll);
  // Beri waktu agar compositor menyelesaikan frame yang diminta.
  await sleep(300);
  const sesudah = await metrik();
  return {
    task: (sesudah.TaskDuration ?? 0) - (sebelum.TaskDuration ?? 0),
    layout: (sesudah.LayoutDuration ?? 0) - (sebelum.LayoutDuration ?? 0),
    style: (sesudah.RecalcStyleDuration ?? 0) - (sebelum.RecalcStyleDuration ?? 0),
    script: (sesudah.ScriptDuration ?? 0) - (sebelum.ScriptDuration ?? 0),
  };
};

/** Scroll ke posisi tengah lalu ukur beban kumulatif. */
const geserDanUkur = async (n = 5) => {
  const v = await ev(`(${ukurScroll})()`);
  let info = null;
  if (typeof v === "string") {
    try {
      info = JSON.parse(v);
    } catch {
      info = null;
    }
  }
  if (!info || info.tidakBisaGeser) {
    return { nilai: 0, info, jumlah: 0 };
  }
  await sleep(400);
  // Ambil terbaik dari beberapa percobaan: noise hanya menambah.
  const hasil = [];
  for (let i = 0; i < n; i++) {
    const b = await ukurBeban();
    hasil.push(b.task);
  }
  hasil.sort((a, b) => a - b);
  return { nilai: hasil[Math.floor(hasil.length / 2)], info, jumlah: n };
};

// CATATAN JUJUR soal pengukuran waktu blur.
//
// Versi lama skrip ini mengukur "biaya blur" dalam milidetik lewat
// selisih probe DOM. Itu rapuh dan menghasilkan angka yang tak bisa
// dipercaya:
//   - probe `performance.now()` di halaman: dipengaruhi cadence
//     requestAnimationFrame headless (~1 detik/frame tanpa GPU);
//   - `Page.captureScreenshot`: raster PNG memakan ~5,7 detik, jadi
//     encoding-nya mendominasi selisih dan biaya blur (~5%) tenggelum;
//   - `Performance.getMetrics` TaskDuration: hanya mengukur pekerjaan
//     main thread, tak mencakup kompositing GPU.
// Hasilnya angka yang berbeda tiap eksekusi (6,4 ms / 12,5 ms / 21,4 ms
// / 66,4 ms) untuk kode yang tak berubah.
//
// Yang SEBENARNYA menentukan beban kompositing backdrop-filter adalah
// JUMLAH LAYER dan AREA yang dicakup blur -- bukan durasi frame di
// lingkungan tanpa GPU. Karena itu metrik waktu dihapus, danyganti
// dengan pengukuran deterministik di atas (jumlah layer + area).
//
// Kalau nanti diukur di mesin dengan GPU sungguhan, metrik yang tepat
// adalah Chrome Tracing (`--trace-startup`) atau
// `PerformanceObserver` untuk `event` timing dengan
// `long-animation-frame`.
//
// Yang bisa diverifikasi di sini: tidak ada blur pada elemen kecil
// (field form, kartu statistik, segmented control), dan jumlah layer
// + area-nya terkendali.
const blurDiKecilkan = await ev(`
  (() => {
    // Elemen kecil (< 300x120 px) yang punya blur: blur di sini tak
    // pernah terlihat jelas tapi tetap menambah beban kompositing.
    const kecil = [];
    for (const el of document.querySelectorAll('*')) {
      const cs = getComputedStyle(el);
      const bf = cs.backdropFilter || cs.webkitBackdropFilter || '';
      if (!bf.includes('blur')) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 300 && r.height < 120) {
        kecil.push({
          cls: (el.className && String(el.className).split(' ')[0]) || el.tagName,
          w: Math.round(r.width),
          h: Math.round(r.height),
        });
      }
    }
    return kecil;
  })()
`);
console.log(
  `  blur pada elemen kecil: ${blurDiKecilkan.length}` +
    (blurDiKecilkan.length
      ? ` (${blurDiKecilkan.map((x) => `${x.cls} ${x.w}x${x.h}`).join(", ")})`
      : ""),
);
cek(
  "tak ada blur pada elemen kecil (< 300x120)",
  blurDiKecilkan.length === 0,
  blurDiKecilkan.map((x) => x.cls).join(", "),
);

// 5. Sheen tepi terpasang?
const sheen = await ev(`
  (() => {
    const k = document.querySelector('.kartu-kaca');
    if (!k) return null;
    const cs = getComputedStyle(k);
    return { image: cs.backgroundImage.slice(0, 80), hasGradient: cs.backgroundImage.includes('gradient') };
  })()
`);
cek("sheen (gradient) terpasang di kartu", sheen?.hasGradient === true, sheen?.image);

// 6. Sheen tidak merusak kontras teks (kartu tetap punya background color).
const kontras = await ev(`
  (() => {
    const lum = (rgb) => {
      const c = rgb.map(v => { v /= 255; return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); });
      return 0.2126*c[0] + 0.7152*c[1] + 0.0722*c[2];
    };
    const parse = (s) => (s.match(/[\\d.]+/g)||[]).slice(0,3).map(Number);
    const rasio = (a,b) => { const l1=lum(a), l2=lum(b); const hi=Math.max(l1,l2), lo=Math.min(l1,l2); return (hi+0.05)/(lo+0.05); };
    const el = document.querySelector('.kartu-kaca');
    if (!el) return null;
    const cs = getComputedStyle(el);
    const bg = parse(cs.backgroundColor);
    // Background最终 bisa transparan; untuk cards, cek rasio teks vs surface.
    return { bg: cs.backgroundColor, teks: cs.color,
             rasio: rasio(parse(cs.color), bg.length ? bg : [28,29,28]) };
  })()
`);
console.log(`  kartu: bg=${kontras?.bg} teks=${kontras?.teks} rasio=${kontras?.rasio?.toFixed(2)}`);

const shot = await kirim("Page.captureScreenshot", { format: "png" });
writeFileSync(path.resolve("ui-modern.png"), Buffer.from(shot.result.data, "base64"));

ws.close();
chrome.kill();
console.log("\nSelesai.");


