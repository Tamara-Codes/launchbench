/** Static LaunchBench brand mark: green rocket lifting off a white desk. Scales crisply at any size. */
export function RocketDeskIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="34 156 232 210" className={className} role="img" aria-hidden="true" focusable="false">
      {/* desk (white) */}
      <g fill="#f7faf9">
        <rect x="88.5" y="292" width="15" height="60" rx="3" />
        <rect x="196.5" y="292" width="15" height="60" rx="3" />
        <rect x="79" y="343.5" width="34" height="13" rx="3" />
        <rect x="187" y="343.5" width="34" height="13" rx="3" />
      </g>
      <path d="M40,300L260,300L258,312L42,312Z" fill="#dfe4e3" />
      <path d="M54,286L246,286L260,300L40,300Z" fill="#f7faf9" />
      <rect x="201" y="290" width="22" height="6" rx="3" fill="#45d995" />
      {/* rocket (green), scaled down so it sits in proportion on the desk */}
      <g transform="translate(150 296) scale(0.62) translate(-150 -296)">
        <g fill="#45d995">
          <path d="M184,224L216,278L176,260Z" />
          <path d="M116,224L84,278L124,260Z" />
          <path d="M150,84C163,87 181,116 188,150C188,158 186,208 186,238C186,252 179,246 172,262C168,265 162,266 150,266C138,266 132,265 128,262C121,246 114,252 114,238C114,208 112,158 112,150C105,116 137,87 150,84Z" />
        </g>
        <circle cx="150" cy="150" r="14" fill="#12161c" />
      </g>
    </svg>
  );
}
