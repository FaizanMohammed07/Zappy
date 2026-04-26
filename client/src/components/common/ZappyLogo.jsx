/**
 * Zappy brand marks.
 *
 * <ZappyLogo /> — the symbol mark only (the stylized running Z with the
 *                 orange location pin). Sized by the `size` prop.
 *
 * <ZappyWordmark /> — logo + "ZAPPY" text side-by-side (used in the nav bar).
 *
 * <ZappyAppIcon /> — the rounded-square app-icon version with a background
 *                    (light or dark variant).
 *
 * The design: three stylized speed lines on the left trailing a running
 * figure formed by the Z cross-stroke, with a location pin accent in the
 * brand orange. Entirely vector so it's crisp at any size.
 */

export function ZappyLogo({ size = 48, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Zappy"
    >
      <defs>
        <linearGradient id="zappyLogoGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#2563EB" />
          <stop offset="100%" stopColor="#1E3A8A" />
        </linearGradient>
      </defs>

      {/* Speed lines */}
      <path d="M2 22 L14 22" stroke="#2563EB" strokeWidth="3" strokeLinecap="round" />
      <path d="M4 30 L18 30" stroke="#2563EB" strokeWidth="3" strokeLinecap="round" opacity="0.7" />
      <path d="M6 38 L12 38" stroke="#2563EB" strokeWidth="3" strokeLinecap="round" opacity="0.4" />

      {/* Z mark — top bar */}
      <path
        d="M20 16 L52 16 L52 24 L32 38 L52 38 L52 46 L20 46"
        fill="url(#zappyLogoGrad)"
      />

      {/* Runner silhouette — white figure overlaid on Z */}
      <g fill="#FFFFFF">
        <circle cx="42" cy="20" r="3" />
        <path d="M38 28 L45 24 L48 30 L44 36 L48 42 L44 46 L40 40 L36 36 L32 34 L36 30 Z" opacity="0.95" />
      </g>

      {/* Location pin accent */}
      <g transform="translate(50, 44)">
        <path
          d="M0 -6 C -5 -6 -8 -2 -8 1 C -8 5 0 12 0 12 C 0 12 8 5 8 1 C 8 -2 5 -6 0 -6 Z"
          fill="#F59E0B"
        />
        <circle cx="0" cy="0" r="2.5" fill="#FFFFFF" />
      </g>
    </svg>
  );
}

export function ZappyWordmark({ compact = false, className = '' }) {
  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <ZappyLogo size={compact ? 28 : 36} />
      <div className="leading-none">
        <div
          className="font-bold tracking-tight"
          style={{
            fontSize: compact ? 18 : 22,
            color: '#0F172A',
            letterSpacing: '-0.02em',
          }}
        >
          ZAPPY
        </div>
        {!compact && (
          <div className="text-[9px] mt-0.5 font-medium">
            <span style={{ color: '#2563EB' }}>Instant Help.</span>{' '}
            <span style={{ color: '#F59E0B' }}>Anytime.</span>{' '}
            <span style={{ color: '#22C55E' }}>Anywhere.</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function ZappyAppIcon({ size = 56, variant = 'light', className = '' }) {
  const bg =
    variant === 'dark'  ? '#0F172A' :
    variant === 'blue'  ? '#2563EB' :
                          '#FFFFFF';
  return (
    <div
      className={`inline-flex items-center justify-center shadow-soft ${className}`}
      style={{
        width: size,
        height: size,
        background: bg,
        borderRadius: size * 0.22, // Apple-ish squircle-ish radius
        border: variant === 'light' ? '1px solid #F1F5F9' : 'none',
      }}
    >
      <ZappyLogo size={size * 0.72} />
    </div>
  );
}

export default ZappyLogo;
