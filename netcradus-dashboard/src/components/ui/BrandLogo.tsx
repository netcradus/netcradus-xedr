/**
 * NET XDR brand mark + wordmark.
 * The "N" mark transitions white (left) → orange (right), echoing
 * the NET (white) / XDR (orange) split in the wordmark.
 */

const ORANGE = '#F97316'
const NAVY   = '#0f2356'  // dark colour for light-background variant

// ── Icon-only mark (compact, used as favicon-style element) ──────────────────
// variant "dark"  → white left stroke (for dark / navy backgrounds)
// variant "light" → navy left stroke  (for white / light backgrounds)

export function BrandMark({ size = 32, variant = 'dark' }: { size?: number; variant?: 'dark' | 'light' }) {
  const id        = `nmark-${size}-${variant}`
  const w         = size * 0.55  // viewBox is 22×32
  const leftColor = variant === 'light' ? NAVY : 'white'
  const gradFrom  = variant === 'light' ? NAVY : 'white'

  return (
    <svg
      width={w}
      height={size}
      viewBox="0 0 22 32"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={gradFrom} />
          <stop offset="100%" stopColor={ORANGE} />
        </linearGradient>
      </defs>
      {/* Left vertical */}
      <rect x="0" y="0" width="4.5" height="32" rx="1" fill={leftColor} />
      {/* Diagonal — left-to-orange gradient */}
      <polygon points="4.5,0 9,0 17,32 12.5,32" fill={`url(#${id})`} />
      {/* Right vertical — orange */}
      <rect x="17" y="0" width="4.5" height="32" rx="1" fill={ORANGE} />
    </svg>
  )
}

// ── Sidebar lockup: mark + "NET XDR" text ────────────────────────────────────

export function SidebarLogo() {
  return (
    <div className="flex items-center gap-2.5">
      <BrandMark size={34} />
      <div>
        <p className="text-[15px] font-black tracking-[0.18em] leading-tight">
          <span className="text-white">NET</span>
          <span style={{ color: ORANGE }}> XDR</span>
        </p>
        <p className="text-[10px] text-white/45 mt-0.5 tracking-wide">
          Hybrid SIEM + SOAR Platform
        </p>
      </div>
    </div>
  )
}

// ── Auth panel lockup: mark + "NET XDR" (slightly larger) ────────────────────

export function AuthLogo() {
  return (
    <div className="flex items-center gap-3">
      <BrandMark size={40} />
      <div>
        <p className="text-[17px] font-black tracking-[0.18em] leading-tight">
          <span className="text-white">NET</span>
          <span style={{ color: ORANGE }}> XDR</span>
        </p>
        <p className="text-[11px] text-white/45 mt-0.5 tracking-wide">
          Hybrid SIEM + SOAR Platform
        </p>
      </div>
    </div>
  )
}

// ── Large watermark SVG (replaces blurred PNG in auth background) ─────────────

export function WatermarkMark() {
  const id = 'wm-nmark'
  return (
    <svg
      viewBox="0 0 22 32"
      fill="none"
      className="relative w-full object-contain blur-[1px] mix-blend-screen animate-fade-in-watermark"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="white"  stopOpacity="0.9" />
          <stop offset="100%" stopColor={ORANGE} stopOpacity="0.9" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="4.5" height="32" rx="0.8" fill="white" />
      <polygon points="4.5,0 9,0 17,32 12.5,32" fill={`url(#${id})`} />
      <rect x="17" y="0" width="4.5" height="32" rx="0.8" fill={ORANGE} />
    </svg>
  )
}

// ── Login page logo (centred, large, on white panel) ─────────────────────────

export function LoginLogo() {
  return (
    <div className="flex flex-col items-center gap-3 mb-8">
      <BrandMark size={72} variant="light" />
      <p className="text-2xl font-black tracking-[0.2em]">
        <span style={{ color: NAVY }}>NET</span>
        <span style={{ color: ORANGE }}> XDR</span>
      </p>
    </div>
  )
}
