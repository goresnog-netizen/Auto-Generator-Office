/**
 * Logo NitZ-909 — elang heraldik orisinal (ilustrasi vektor buatan sendiri,
 * bukan karakter berhak cipta mana pun). Warna mengikuti token brand aplikasi
 * sehingga ikut tema gelap/terang. Skala dari satu angka `size`.
 */
export default function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label="Logo NitZ-909"
      style={{ display: "block", flexShrink: 0 }}
    >
      {/* Sayap kiri: tiga lapis bulu merambat ke ujung */}
      <path
        d="M31 19C23 12 13 9 5 11c4 6 5 13 4 18 3-1 6-2 8-5 1 5 0 10-2 13 6-1 12-5 16-9Z"
        fill="var(--brand)"
        fillOpacity="0.9"
      />
      {/* Sayap kanan: cermin sayap kiri */}
      <path
        d="M33 19c8-7 18-10 26-8-4 6-5 13-4 18-3-1-6-2-8-5-1 5 0 10 2 13-6-1-12-5-16-9Z"
        fill="var(--brand)"
        fillOpacity="0.9"
      />
      {/* Garis bulu sayap agar bentuk tetap terbaca di 24px */}
      <g
        stroke="var(--brand)"
        strokeWidth="1.1"
        strokeLinecap="round"
        opacity="0.55"
        fill="none"
      >
        <path d="M27 20 12 14" />
        <path d="M27 24 9 23" />
        <path d="M28 29 8 34" />
        <path d="M37 20l15-6" />
        <path d="M37 24l18-1" />
        <path d="M36 29l20-5" />
      </g>
      {/* Kepala + badan */}
      <path
        d="M32 7c4.2 0 7.4 3 7.4 7 0 2.3-.9 4.2-2.3 5.6l1.6 5.2-4.4-2.9-2.3 3.1-2.3-3.1-4.4 2.9 1.6-5.2A7.4 7.4 0 0 1 24.6 14c0-4 3.2-7 7.4-7Z"
        fill="var(--brand)"
      />
      <path
        d="M32 22.5c3.4 0 5.6 2.7 5.6 6.3 0 5.8 2.2 9.9-.5 14.6-1.9 3.4-9.7 3.4-11.6 0-2.7-4.7-.5-8.8-.5-14.6 0-3.6 2.2-6.3 7-6.3Z"
        fill="currentColor"
      />
      {/* Ekor lancip */}
      <path d="M25 42h14L32 60Z" fill="var(--brand)" fillOpacity="0.75" />
      {/* Mata (negatif) */}
      <g fill="var(--bg)">
        <circle cx="28.6" cy="13.6" r="1.15" />
        <circle cx="35.4" cy="13.6" r="1.15" />
      </g>
    </svg>
  );
}
