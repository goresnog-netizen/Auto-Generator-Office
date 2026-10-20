/**
 * FormMode (F1) — formulir metadata laporan yang bisa dilipat.
 * State disimpan di App (localStorage `nitz909-metadata`); komponen ini
 * murni tampilan + pengumpul input.
 */
import { useState } from "react";
import { Button, Input } from "./ui";
import { Ikon } from "./Ikon";
import type { LaporanMetadata } from "../types";

interface FormModeProps {
  metadata: LaporanMetadata;
  ubahMetadata: (patch: Partial<LaporanMetadata>) => void;
  onTerapkan: () => void;
}

const LABEL: {
  kunci: keyof LaporanMetadata;
  teks: string;
  tipe?: string;
  placeholder: string;
}[] = [
  {
    kunci: "nomor",
    teks: "Nomor Dokumen",
    placeholder: "mis. 090/123/LAP/2026",
  },
  { kunci: "tanggal", teks: "Tanggal", tipe: "date", placeholder: "" },
  {
    kunci: "unit",
    teks: "Unit/Instansi",
    placeholder: "mis. Dinas Komunikasi dan Informatika",
  },
  {
    kunci: "penanggungJawab",
    teks: "Penanggung Jawab",
    placeholder: "Nama penanggung jawab",
  },
  { kunci: "periode", teks: "Periode", placeholder: "mis. Januari–Maret 2026" },
  { kunci: "lokasi", teks: "Lokasi", placeholder: "mis. Jakarta" },
];

export function FormMode({
  metadata,
  ubahMetadata,
  onTerapkan,
}: FormModeProps) {
  const [buka, setBuka] = useState(false);
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-2)",
      }}
    >
      <Button type="secondary" block onClick={() => setBuka((b) => !b)}>
        {<Ikon nama="catatan" />} {buka ? "Tutup Metadata" : "Isi Metadata"}
      </Button>
      {buka && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-2)",
          }}
        >
          {LABEL.map((f) => (
            <div
              key={f.kunci}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-1)",
              }}
            >
              <label
                style={{
                  fontSize: "var(--font-size-ui)",
                  color: "var(--muted)",
                }}
              >
                {f.teks}
              </label>
              <Input
                type={f.tipe ?? "text"}
                value={metadata[f.kunci]}
                onChange={(v) =>
                  ubahMetadata({ [f.kunci]: v } as Partial<LaporanMetadata>)
                }
                placeholder={f.placeholder}
              />
            </div>
          ))}
          <Button type="primary" block onClick={onTerapkan}>
            Terapkan ke Dokumen
          </Button>
        </div>
      )}
    </div>
  );
}
