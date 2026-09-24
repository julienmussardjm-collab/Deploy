// Brand mascot for the start screen: a robot scanning a badge QR code.
// Animations are driven by the .mascot-* classes in index.css.
export function Mascot({ className }) {
  return (
    <svg
      className={`mascot ${className || ''}`}
      viewBox="0 0 360 330"
      role="img"
      aria-label="Lead Scanner robot holding a phone scanning a badge"
    >
      <defs>
        <linearGradient id="msc-cape" x1="0.1" y1="0" x2="0.7" y2="1">
          <stop offset="0%" stopColor="#fda849" />
          <stop offset="100%" stopColor="#c96200" />
        </linearGradient>
        <linearGradient id="msc-shell" x1="0.15" y1="0" x2="0.85" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#dbe1e1" />
        </linearGradient>
        <radialGradient id="msc-core" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffe0b8" />
          <stop offset="50%" stopColor="#fb7f03" />
          <stop offset="100%" stopColor="#fb7f03" stopOpacity="0" />
        </radialGradient>
        <clipPath id="msc-screen">
          <rect x="248" y="150" width="72" height="128" rx="13" />
        </clipPath>
      </defs>
      <g className="mascot-float">
        <g className="mascot-cape">
          <path
            d="M134 158 Q180 148 226 158 L264 272 Q246 262 228 270 Q204 280 180 268 Q156 280 132 270 Q114 262 96 272 Z"
            fill="url(#msc-cape)"
          />
          <path d="M148 156 L134 268 Q156 276 180 268 L172 154 Z" fill="#a85200" opacity=".18" />
        </g>
        <g stroke="#0a3039" strokeWidth="7" strokeLinecap="round">
          <path d="M128 54 L92 36" />
          <path d="M232 54 L268 36" />
        </g>
        <rect x="166" y="128" width="28" height="26" rx="8" fill="#c7cdcd" />
        <rect x="110" y="26" width="140" height="112" rx="30" fill="url(#msc-shell)" />
        <rect
          x="110"
          y="26"
          width="140"
          height="112"
          rx="30"
          fill="none"
          stroke="#c2c7c6"
          strokeWidth="1.5"
        />
        <rect x="126" y="48" width="108" height="72" rx="20" fill="#08181c" />
        <rect
          x="126"
          y="48"
          width="108"
          height="72"
          rx="20"
          fill="none"
          stroke="#fb7f03"
          strokeWidth="2.5"
        />
        <g className="mascot-eyes" fill="#fb7f03">
          <rect x="151" y="66" width="14" height="27" rx="7" />
          <rect x="195" y="66" width="14" height="27" rx="7" />
        </g>
        <path
          d="M167 104 q13 11 26 0"
          fill="none"
          stroke="#fb7f03"
          strokeWidth="4.5"
          strokeLinecap="round"
        />
        <rect x="138" y="150" width="84" height="94" rx="26" fill="url(#msc-shell)" />
        <circle className="mascot-core-glow" cx="180" cy="190" r="27" fill="url(#msc-core)" />
        <circle cx="180" cy="190" r="14" fill="none" stroke="#fb7f03" strokeWidth="3" />
        <circle cx="180" cy="190" r="4.5" fill="#fb7f03" />
        <g fill="url(#msc-shell)" stroke="#b9c0c0" strokeWidth="1.5">
          <rect x="142" y="244" width="36" height="23" rx="11.5" />
          <rect x="182" y="244" width="36" height="23" rx="11.5" />
        </g>
        <circle cx="130" cy="206" r="18" fill="url(#msc-shell)" />
        <circle cx="230" cy="202" r="18" fill="url(#msc-shell)" />
        <g className="mascot-phone">
          <rect x="242" y="144" width="84" height="140" rx="18" fill="#0a3039" />
          <rect x="248" y="150" width="72" height="128" rx="13" fill="#fb7f03" />
          <g clipPath="url(#msc-screen)">
            <g fill="#ffffff">
              <rect x="262" y="184" width="17" height="17" rx="2" />
              <rect x="288" y="184" width="17" height="17" rx="2" />
              <rect x="262" y="210" width="17" height="17" rx="2" />
              <rect x="289" y="211" width="6" height="6" />
              <rect x="298" y="220" width="6" height="6" />
              <rect x="289" y="229" width="6" height="6" />
            </g>
            <g fill="#fb7f03">
              <rect x="267" y="189" width="7" height="7" rx="1" />
              <rect x="293" y="189" width="7" height="7" rx="1" />
              <rect x="267" y="215" width="7" height="7" rx="1" />
            </g>
            <rect
              className="mascot-scan"
              x="248"
              y="150"
              width="72"
              height="3"
              fill="#ffffff"
              opacity=".9"
            />
          </g>
          <g stroke="#ffffff" strokeWidth="3" fill="none" strokeLinecap="round">
            <path d="M259 176 v-8 h8" />
            <path d="M309 176 v-8 h-8" />
            <path d="M259 236 v8 h8" />
            <path d="M309 236 v8 h-8" />
          </g>
        </g>
      </g>
    </svg>
  );
}
