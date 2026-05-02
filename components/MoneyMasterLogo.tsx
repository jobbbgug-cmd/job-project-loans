export function MoneyMasterIcon({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 95" fill="none" xmlns="http://www.w3.org/2000/svg">

      {/* ── Coin 1 — top center ── */}
      <line x1="48" y1="5"  x2="48" y2="1"  stroke="#2a5a1e" strokeWidth="2.2" strokeLinecap="round"/>
      <line x1="53" y1="6"  x2="53" y2="2"  stroke="#2a5a1e" strokeWidth="2.2" strokeLinecap="round"/>
      {/* shadow base */}
      <circle cx="51" cy="14" r="10" fill="#ADBA18"/>
      {/* face */}
      <circle cx="51" cy="12" r="10" fill="#D8DC28"/>
      {/* highlight */}
      <ellipse cx="48" cy="9" rx="6.5" ry="3.5" fill="#ECEE55" opacity="0.75"/>

      {/* ── Coin 2 — middle right ── */}
      <line x1="65" y1="19" x2="65" y2="15" stroke="#2a5a1e" strokeWidth="2.2" strokeLinecap="round"/>
      <line x1="70" y1="20" x2="70" y2="16" stroke="#2a5a1e" strokeWidth="2.2" strokeLinecap="round"/>
      <circle cx="67" cy="28" r="9"  fill="#ADBA18"/>
      <circle cx="67" cy="26" r="9"  fill="#D8DC28"/>
      <ellipse cx="64" cy="23" rx="5.5" ry="3" fill="#ECEE55" opacity="0.75"/>

      {/* ── Coin 3 — lower left ── */}
      <line x1="35" y1="30" x2="35" y2="26" stroke="#2a5a1e" strokeWidth="2.2" strokeLinecap="round"/>
      <line x1="40" y1="31" x2="40" y2="27" stroke="#2a5a1e" strokeWidth="2.2" strokeLinecap="round"/>
      <circle cx="37" cy="39" r="9"  fill="#ADBA18"/>
      <circle cx="37" cy="37" r="9"  fill="#D8DC28"/>
      <ellipse cx="34" cy="34" rx="5.5" ry="3" fill="#ECEE55" opacity="0.75"/>

      {/* ── Hand (flat side-view, palm up) ── */}
      {/*
        Wrist block: lower-left parallelogram
        Palm: broad flat surface angled up-right
        Two finger-tips on the right edge
      */}

      {/* Wrist block */}
      <polygon
        points="8,90 18,72 30,76 20,94"
        fill="#78BE38"
      />

      {/* Palm body */}
      <path
        d="
          M 18,72
          L 24,59
          C 36,50 55,44 68,46
          L 75,40
          L 71,32
          L 67,38
          L 74,30
          L 69,36
          L 66,46
          C 52,48 34,54 27,63
          L 22,74
          Z
        "
        fill="#7EC840"
      />

      {/* Rim of palm (slightly darker line along top edge for depth) */}
      <path
        d="M 24,59 C 36,50 55,44 68,46"
        stroke="#5EA828" strokeWidth="2" fill="none"
      />
    </svg>
  );
}

export function MoneyMasterLogoFull({ iconSize = 64 }: { iconSize?: number }) {
  const fs1 = Math.round(iconSize * 0.235);
  const fs2 = Math.round(iconSize * 0.215);
  return (
    <div className="flex flex-col items-center" style={{ gap: iconSize * 0.12 }}>
      <MoneyMasterIcon size={iconSize} />
      <div className="text-center" style={{ lineHeight: 1.15 }}>
        <p
          className="font-black tracking-widest uppercase"
          style={{ color: '#D8DC28', fontSize: fs1, letterSpacing: '0.18em' }}
        >
          MY MONEY
        </p>
        <p
          className="font-black tracking-widest uppercase"
          style={{ color: '#7EC840', fontSize: fs2, letterSpacing: '0.22em' }}
        >
          MASTER
        </p>
      </div>
    </div>
  );
}
