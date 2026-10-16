// Original "N" monogram: a rounded tile with a single-stroke N. Also used as public/favicon.svg.
export function Logo({ size = 32 }) {
  return (
    <svg className="logo-mark" width={size} height={size} style={{ width: size, height: size }} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect width="32" height="32" rx="8" fill="#e50914" stroke="none" />
      <path d="M10.5 22.5v-13l11 13v-13" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
