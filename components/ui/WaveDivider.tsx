export function WaveDivider({ color = "#FFE600", flip = false }: { color?: string; flip?: boolean }) {
  return (
    <div style={{ position: "relative", lineHeight: 0, transform: flip ? "scaleY(-1)" : "none" }}>
      <svg
        viewBox="0 0 1440 50"
        preserveAspectRatio="none"
        style={{ display: "block", width: "100%", height: 50 }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M0,25 Q90,0 180,25 Q270,50 360,25 Q450,0 540,25 Q630,50 720,25 Q810,0 900,25 Q990,50 1080,25 Q1170,0 1260,25 Q1350,50 1440,25 L1440,50 L0,50 Z"
          fill={color}
          stroke="#000"
          strokeWidth="3"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  )
}
