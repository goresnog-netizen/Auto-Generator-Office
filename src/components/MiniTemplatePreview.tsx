import type { ContentBlock } from "../types";
import { WARNA_KATEGORI, type TemplateGaleri } from "../data/templates";
const potong = (s: string, n = 42) => (s.length > n ? s.slice(0, n) + "…" : s);
function Bar({ t, c, bold, sz }: { t: string; c: string; bold?: boolean; sz?: number }) {
  const x = t.length > 40 ? t.slice(0, 40) + "…" : t;
  return <div style={{ fontSize: sz ?? 5, color: c, fontWeight: bold ? 700 : 400, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", lineHeight: 1.4 }}>{x}</div>;
}
function Cell({ t, head }: { t: string; head?: boolean }) {
  const x = t.length > 12 ? t.slice(0, 12) + "…" : t;
  return <div style={{ fontSize: 4.5, fontWeight: head ? 700 : 400, background: head ? "var(--surface-2)" : "var(--bg)", border: "1px solid var(--border)", borderRadius: 1.5, padding: "1.5px 3px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{x}</div>;
}
function Blok({ bl }: { bl: ContentBlock }) {
  if (bl.type === "heading") return <Bar t={bl.text} c="var(--text)" bold sz={bl.level === 1 ? 6.5 : 5.5} />;
  if (bl.type === "paragraph") return <Bar t={bl.text} c="var(--muted)" sz={4.8} />;
  if (bl.type === "list") return <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>{bl.items.slice(0, 3).map((it, i) => <Bar key={i} t={(bl.ordered ? i + 1 + ". " : "• ") + it.text} c="var(--muted)" sz={4.8} />)}</div>;
  if (bl.type === "table") {
    const k = Math.min(Math.max(bl.headers.length, 1), 3);
    return <div style={{ display: "grid", gridTemplateColumns: "repeat(" + k + ", 1fr)", gap: 1.5, marginTop: 2 }}>{bl.headers.slice(0, k).map((h, i) => <Cell key={i} t={h} head />)}{bl.rows.slice(0, 2).flatMap((r, ri) => r.slice(0, k).map((cc, ci) => <Cell key={ri + "-" + ci} t={cc} />))}</div>;
  }
  if (bl.type === "chart") {
    const d = bl.data.datasets[0]?.data ?? [];
    const m = Math.max(1, ...d);
    return <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 18, marginTop: 2, padding: "2px 3px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 2 }}>{d.slice(0, 6).map((v, i) => <div key={i} style={{ flex: 1, height: Math.max(15, Math.round((v / m) * 100)) + "%", minHeight: 3, borderRadius: 1, background: "var(--brand)" }} />)}</div>;
  }
  if (bl.type === "diagram") return <div style={{ marginTop: 2, border: "1px dashed var(--border)", borderRadius: 2, padding: "2px 4px", fontSize: 4.8, color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>◇ {potong(bl.source || "diagram", 36)}</div>;
  if (bl.type === "image") return <div style={{ marginTop: 2, height: 15, borderRadius: 2, border: "1px solid var(--border)", background: "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 4.8, color: "var(--muted)" }}>🖼 {potong(bl.alt || "gambar", 22)}</div>;
  return <div style={{ height: 1, background: "var(--border)", margin: "2px 0" }} />;
}
export function MiniTemplatePreview({ template, lebar }: { template: TemplateGaleri; lebar?: number }) {
  const w = WARNA_KATEGORI[template.kategori];
  const isi = template.blocks.slice(0, 4);
  const W = lebar ?? 148;
  if (template.format === "pptx") {
    const j = template.blocks.find((x) => x.type === "heading");
    const gambar = template.blocks.find((x) => x.type === "image");
    const grafik = template.blocks.find((x) => x.type === "chart");
    const rest = template.blocks.filter((x) => x !== j && x !== gambar).slice(0, 2);
    return <div style={{ width: W, aspectRatio: "16 / 9", background: "#fff", border: "1px solid var(--border)", borderRadius: 4, padding: "0", display: "flex", flexDirection: "column", overflow: "hidden" }}><div style={{ height: 5, background: w }} />{j && j.type === "heading" && <div style={{ fontSize: 6.5, fontWeight: 800, color: "#1c1d1c", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", padding: "4px 7px 0" }}>{potong(j.text, 34)}</div>}<div style={{ display: "flex", gap: 4, flex: 1, minHeight: 0, padding: "3px 7px 5px" }}><div style={{ flex: 1.4, display: "flex", flexDirection: "column", gap: 1.5, minWidth: 0 }}>{grafik && grafik.type === "chart" ? <Blok bl={grafik} /> : rest.map((x, i) => <Blok key={i} bl={x} />)}</div><div style={{ width: 30, borderRadius: 2, overflow: "hidden", background: gambar && gambar.type === "image" ? undefined : w + "33", border: "1px solid var(--border)", flexShrink: 0, position: "relative" }}>{gambar && gambar.type === "image" && gambar.src ? <img src={gambar.src} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} /> : <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg," + w + "55," + w + "22)" }} />}</div></div><div style={{ display: "flex", justifyContent: "space-between", padding: "2px 7px", fontSize: 4.5, color: "#6b7280", borderTop: "1px solid #eee" }}><span>NitZ-909</span><span>DATA UJI</span></div></div>;
  }
  if (template.format === "xlsx") {
    const tb = template.blocks.find((x) => x.type === "table");
    return <div style={{ width: W, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 3, overflow: "hidden" }}><div style={{ display: "flex", gap: 4, padding: "3px 5px", borderBottom: "1px solid var(--border)", background: "var(--surface)", fontSize: 5, color: "var(--muted)", fontWeight: 700 }}><span>A</span><span>B</span><span>C</span><span style={{ marginLeft: "auto", color: w }}>{tb && tb.type === "table" ? tb.rows.length + " baris" : "lembar"}</span></div><div style={{ padding: "4px 5px" }}>{tb && tb.type === "table" ? <Blok bl={tb} /> : isi.slice(0, 3).map((x, i) => <Blok key={i} bl={x} />)}</div></div>;
  }
  if (template.format === "diagram") {
    const j = template.blocks.find((x) => x.type === "heading");
    const v = template.blocks.find((x) => x.type === "chart" || x.type === "diagram" || x.type === "table");
    return <div style={{ width: W, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 4, padding: "5px 7px", display: "flex", flexDirection: "column", gap: 2, overflow: "hidden" }}><div style={{ alignSelf: "flex-start", fontSize: 4.5, fontWeight: 800, color: "#fff", background: w, borderRadius: 99, padding: "1px 6px" }}>INFOGRAFIS</div>{j && j.type === "heading" && <div style={{ fontSize: 6.5, fontWeight: 800, color: "var(--text)", lineHeight: 1.25 }}>{potong(j.text, 38)}</div>}{v ? <Blok bl={v} /> : isi.slice(1, 3).map((x, i) => <Blok key={i} bl={x} />)}</div>;
  }
  return <div style={{ width: 62, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 2, padding: "5px 6px", display: "flex", flexDirection: "column", gap: 2, overflow: "hidden" }}><div style={{ height: 4, width: "82%", borderRadius: 2, background: w }} />{isi.map((x, i) => <Blok key={i} bl={x} />)}</div>;
}
