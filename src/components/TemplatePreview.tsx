import { useEffect, useMemo, useRef, useState } from "react";
import { DocumentEditor } from "./DocumentEditor";
import { IkonFormat } from "./Ikon";
import { Badge } from "./ui";
import type { ContentBlock } from "../types";
import type { TemplateGaleri } from "../data/templates";
const FRAME_W = 280; const PAPER_W = 640; const SKALA = FRAME_W / PAPER_W;
function pecahSlide(blocks: ContentBlock[]): ContentBlock[][] {
  const out: ContentBlock[][] = []; let cur: ContentBlock[] = [];
  for (const bl of blocks) {
    if (bl.type === "heading" && bl.level === 2 && cur.length > 0) { out.push(cur); cur = []; }
    cur.push(bl);
  }
  if (cur.length) out.push(cur);
  return out.slice(0, 6);
}
function RenderBlok({ daftar }: { daftar: ContentBlock[] }) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const host = ref.current; if (!host) return;
    const ed = new DocumentEditor(daftar, undefined, undefined, true);
    host.innerHTML = "";
    daftar.forEach((bl) => { const w = document.createElement("div"); host.appendChild(w); ed.renderBlockHtml(bl, w); });
    return () => { host.innerHTML = ""; };
  }, [daftar]);
  return <div ref={ref} style={{ width: PAPER_W, transform: "scale(" + SKALA + ")", transformOrigin: "top left" }} />;
}
const LABEL: Record<string, string> = { word: "DOKUMEN · A4", pdf: "DOKUMEN · A4", pptx: "SLIDE · 16:9", xlsx: "SPREADSHEET", diagram: "INFOGRAFIS" };
export function TemplatePreview({ template }: { template: TemplateGaleri | null | undefined }) {
  const blok = useMemo(() => template?.blocks ?? [], [template]);
  const [slide, setSlide] = useState(0);
  // Reset slide saat ganti template — pola render-phase adjustment (React docs),
  // bukan useEffect, agar tidak cascading render (larangan react-hooks/set-state-in-effect).
  const [idTerakhir, setIdTerakhir] = useState(template?.id);
  if (template?.id !== idTerakhir) {
    setIdTerakhir(template?.id);
    setSlide(0);
  }
  if (!template) return null;
  const slides = template.format === "pptx" ? pecahSlide(blok) : [blok];
  const aktif = slides[Math.min(slide, slides.length - 1)] ?? [];
  const hSlide = Math.round((FRAME_W * 9) / 16); const hDoc = Math.round(FRAME_W * 1.414);
  return <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}><IkonFormat format={template.format} ukuran={20} /><strong style={{ flex: 1, fontSize: "var(--font-size-ui)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{template.nama}</strong><Badge variant="secondary">{blok.length} blok</Badge></div>
    <div style={{ fontSize: "var(--font-size-caption)", color: "var(--muted)", lineHeight: 1.5 }}>{template.deskripsi}</div>
    <div style={{ alignSelf: "flex-start", fontSize: 10, fontWeight: 800, letterSpacing: 0.5, color: "var(--muted)", border: "1px solid var(--border)", borderRadius: 99, padding: "2px 8px" }}>{LABEL[template.format] ?? template.format.toUpperCase()}</div>
    {template.format === "pptx" && slides.length > 1 && <div style={{ display: "flex", gap: 4, alignItems: "center" }}><span style={{ fontSize: 11, color: "var(--muted)" }}>Slide {Math.min(slide + 1, slides.length)}/{slides.length}</span><div style={{ display: "flex", gap: 4 }}>{slides.map((_, i) => <button key={i} onClick={() => setSlide(i)} aria-label={"Slide " + (i + 1)} style={{ width: 22, height: 6, borderRadius: 3, border: "1px solid var(--border)", background: i === Math.min(slide, slides.length - 1) ? "var(--brand)" : "var(--bg)", cursor: "pointer", padding: 0 }} />)}</div></div>}
    <div style={{ width: FRAME_W, borderRadius: template.format === "pptx" || template.format === "diagram" ? 6 : 3, border: "1px solid var(--border)", background: "var(--bg)", overflow: "hidden", pointerEvents: "none" }}>
      {(template.format === "word" || template.format === "pdf") && <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderBottom: "1px solid var(--border)", background: "var(--surface)" }}><div style={{ width: 22, height: 22, borderRadius: 4, background: "var(--brand)" }} /><div><div style={{ fontSize: 10, fontWeight: 800, color: "var(--text)" }}>{template.judulDokumen}</div><div style={{ fontSize: 9, color: "var(--muted)" }}>NitZ-909 · DATA UJI</div></div></div>}
      {template.format === "xlsx" && <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--border)", background: "var(--surface)", fontSize: 10, fontWeight: 700, color: "var(--muted)" }}>{["A", "B", "C", "D"].map((c) => <div key={c} style={{ flex: 1, padding: "4px 8px", borderRight: "1px solid var(--border)" }}>{c}</div>)}</div>}
      <div style={{ height: template.format === "pptx" ? hSlide : template.format === "word" || template.format === "pdf" ? hDoc : 220, overflow: "hidden", padding: template.format === "xlsx" ? 0 : 14 }}>
        <RenderBlok daftar={aktif} />
      </div>
      {(template.format === "word" || template.format === "pdf") && <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 14px", borderTop: "1px solid var(--border)", fontSize: 9, color: "var(--muted)" }}><span>Hal. 1</span><span>DATA UJI — sintetis</span></div>}
      {template.format === "pptx" && <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 12px", borderTop: "1px solid var(--border)", fontSize: 9, color: "var(--muted)" }}><span>{template.judulDokumen}</span><span>{Math.min(slide + 1, slides.length)}/{slides.length}</span></div>}
    </div>
  </div>;
}
