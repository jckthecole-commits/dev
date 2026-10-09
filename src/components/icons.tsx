import type { SVGProps } from 'react'

/** Icon set — 24 grid, 1.5px stroke, rounded joins (matches the moodboard). */
const P: Record<string, React.ReactNode> = {
  camera: (
    <>
      <path d="M4 8.5h3l1.6-2.5h6.8L17 8.5h3V19H4V8.5Z" />
      <circle cx="12" cy="13.5" r="3.4" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s6-5.5 6-11a6 6 0 0 0-12 0c0 5.5 6 11 6 11Z" />
      <circle cx="12" cy="10" r="2.2" />
    </>
  ),
  calendar: (
    <>
      <rect x="4" y="5.5" width="16" height="14" rx="2.5" />
      <path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3.5" />
      <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" />
    </>
  ),
  sliders: (
    <>
      <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="10" cy="17" r="2" />
    </>
  ),
  bag: (
    <>
      <path d="M5 8h14l-1 12H6L5 8Z" />
      <path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.2-4.2" />
    </>
  ),
  heart: <path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20Z" />,
  user: (
    <>
      <circle cx="12" cy="8.5" r="3.8" />
      <path d="M4.5 20c.9-3.8 3.9-5.8 7.5-5.8s6.6 2 7.5 5.8" />
    </>
  ),
  menu: <path d="M4 9h16M4 15h16" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  'arrow-right': <path d="M4 12h15M13 6l6 6-6 6" />,
  'arrow-left': <path d="M20 12H5M11 6l-6 6 6 6" />,
  'arrow-up-right': <path d="M7 17 17 7M8 7h9v9" />,
  'chevron-down': <path d="m6 9 6 6 6-6" />,
  'chevron-right': <path d="m9 6 6 6-6 6" />,
  'chevron-left': <path d="m15 6-6 6 6 6" />,
  check: <path d="m5 12.5 4.2 4.2L19 7" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  upload: (
    <>
      <path d="M12 15V4M7.5 8.5 12 4l4.5 4.5" />
      <path d="M4.5 14v4.5A1.5 1.5 0 0 0 6 20h12a1.5 1.5 0 0 0 1.5-1.5V14" />
    </>
  ),
  download: (
    <>
      <path d="M12 4v11M7.5 10.5 12 15l4.5-4.5" />
      <path d="M4.5 14v4.5A1.5 1.5 0 0 0 6 20h12a1.5 1.5 0 0 0 1.5-1.5V14" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.5M12 7.8v.2" />
    </>
  ),
  alert: (
    <>
      <path d="M12 4 21 19.5H3L12 4Z" />
      <path d="M12 10v4.5M12 17.2v.2" />
    </>
  ),
  truck: (
    <>
      <path d="M3 6.5h11v10H3zM14 10h3.8l3.2 3.4v3.1h-7" />
      <circle cx="7" cy="17.5" r="1.8" />
      <circle cx="17" cy="17.5" r="1.8" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3.5 19 6v5.5c0 4.4-3 7.7-7 9-4-1.3-7-4.6-7-9V6l7-2.5Z" />
      <path d="m8.8 12 2.3 2.3 4.3-4.6" />
    </>
  ),
  eye: (
    <>
      <path d="M2.8 12S6.2 5.8 12 5.8 21.2 12 21.2 12 17.8 18.2 12 18.2 2.8 12 2.8 12Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  ruler: (
    <>
      <path d="M3.5 15.5 15.5 3.5l5 5-12 12-5-5Z" />
      <path d="m7 12 1.8 1.8M10 9l1.8 1.8M13 6l1.8 1.8" />
    </>
  ),
  phone: <path d="M6.5 3.8h3l1.5 4-2 1.3a10.5 10.5 0 0 0 5.9 5.9l1.3-2 4 1.5v3a2 2 0 0 1-2.1 2A16.2 16.2 0 0 1 4.5 5.9a2 2 0 0 1 2-2.1Z" />,
  mail: (
    <>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" />
      <path d="m4 7 8 6 8-6" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  store: (
    <>
      <path d="M4 9.5 5.5 4.5h13L20 9.5" />
      <path d="M4 9.5c0 1.4 1.1 2.5 2.7 2.5S9.3 10.9 9.3 9.5c0 1.4 1.2 2.5 2.7 2.5s2.7-1.1 2.7-2.5c0 1.4 1.1 2.5 2.6 2.5S20 10.9 20 9.5" />
      <path d="M5.5 12v8h13v-8M10 20v-4.5h4V20" />
    </>
  ),
  building: (
    <>
      <path d="M5 20V5.5A1.5 1.5 0 0 1 6.5 4h7A1.5 1.5 0 0 1 15 5.5V20M15 10h3.5a1.5 1.5 0 0 1 1.5 1.5V20M3.5 20h17" />
      <path d="M8.5 8h3M8.5 11.5h3M8.5 15h3" />
    </>
  ),
  file: (
    <>
      <path d="M6.5 3.5h7l4 4v13h-11z" />
      <path d="M13.5 3.5v4h4M9 12.5h6M9 16h6" />
    </>
  ),
  logout: (
    <>
      <path d="M14 4.5H6.5v15H14" />
      <path d="M10.5 12H20M16.5 8.5 20 12l-3.5 3.5" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.5v2.2M12 18.3v2.2M20.5 12h-2.2M5.7 12H3.5M18 6l-1.6 1.6M7.6 16.4 6 18M18 18l-1.6-1.6M7.6 7.6 6 6" />
    </>
  ),
  chart: <path d="M4 19.5h16M7 16V11M11 16V6.5M15 16v-6M19 16V8.5" />,
  users: (
    <>
      <circle cx="9" cy="9" r="3.3" />
      <path d="M3 19c.7-3.2 3-5 6-5s5.3 1.8 6 5" />
      <path d="M15.5 6.2a3.2 3.2 0 0 1 0 6M17.6 14.4c1.7.7 2.9 2.2 3.4 4.6" />
    </>
  ),
  tag: (
    <>
      <path d="M3.8 12.3 11.5 4.5h7.9v7.9l-7.8 7.7a1.6 1.6 0 0 1-2.2 0L3.8 14.5a1.6 1.6 0 0 1 0-2.2Z" />
      <circle cx="15.5" cy="8.5" r="1.3" />
    </>
  ),
  star: <path d="m12 4 2.5 5.1 5.6.8-4 3.9 1 5.6-5.1-2.6-5 2.6 1-5.6-4.1-3.9 5.6-.8L12 4Z" />,
  trash: (
    <>
      <path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13" />
      <path d="M10 10.5v6M14 10.5v6" />
    </>
  ),
  edit: <path d="m4.5 19.5.8-4L15.8 5a2 2 0 0 1 2.8 0l.4.4a2 2 0 0 1 0 2.8L8.5 18.7l-4 .8Z" />,
  external: (
    <>
      <path d="M13.5 4.5h6v6M19.5 4.5 11 13" />
      <path d="M17 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 4 18.5v-10A1.5 1.5 0 0 1 5.5 7H10" />
    </>
  ),
  layers: (
    <>
      <path d="m12 4 8.5 4.5L12 13 3.5 8.5 12 4Z" />
      <path d="m3.5 12.5 8.5 4.5 8.5-4.5M3.5 16.5 12 21l8.5-4.5" />
    </>
  ),
  box: (
    <>
      <path d="M4 7.5 12 3.5l8 4v9l-8 4-8-4v-9Z" />
      <path d="m4 7.5 8 4 8-4M12 11.5v9" />
    </>
  ),
  glasses: (
    <>
      <rect x="2.5" y="9" width="8" height="6.5" rx="3" />
      <rect x="13.5" y="9" width="8" height="6.5" rx="3" />
      <path d="M10.5 11.5c1-.9 2-.9 3 0M2.5 10.5 1.5 9M21.5 10.5l1-1.5" />
    </>
  ),
  rx: (
    <>
      <rect x="4.5" y="3.5" width="15" height="17" rx="2" />
      <path d="M8 8h4.2a2 2 0 0 1 0 4H8V8Zm0 4v4.5M11.5 12l4.5 4.5M16 12.5l-4 4" />
    </>
  ),
  sparkle: <path d="M12 3.5c.6 4.3 2.2 5.9 6.5 6.5-4.3.6-5.9 2.2-6.5 6.5-.6-4.3-2.2-5.9-6.5-6.5 4.3-.6 5.9-2.2 6.5-6.5ZM18.5 15.5c.3 1.8 1 2.5 2.8 2.8-1.8.3-2.5 1-2.8 2.8-.3-1.8-1-2.5-2.8-2.8 1.8-.3 2.5-1 2.8-2.8Z" />,
  refresh: (
    <>
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
    </>
  ),
  copy: (
    <>
      <rect x="8.5" y="8.5" width="11" height="11" rx="2" />
      <path d="M15.5 8.5V6A1.5 1.5 0 0 0 14 4.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5" />
    </>
  ),
  print: (
    <>
      <path d="M7 8.5V4h10v4.5M7 16H4.5v-6A1.5 1.5 0 0 1 6 8.5h12a1.5 1.5 0 0 1 1.5 1.5v6H17" />
      <path d="M7 13.5h10V20H7z" />
    </>
  ),
  home: <path d="M4 10.5 12 4l8 6.5V20h-5.5v-5.5h-5V20H4v-9.5Z" />,
  grid: (
    <>
      <rect x="4" y="4" width="6.5" height="6.5" rx="1.5" />
      <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" />
    </>
  ),
  list: <path d="M9 7h11M9 12h11M9 17h11M4.5 7h.1M4.5 12h.1M4.5 17h.1" />,
  inbox: (
    <>
      <path d="M4 13.5 6 5h12l2 8.5V19H4v-5.5Z" />
      <path d="M4 13.5h4.5l1 2.5h5l1-2.5H20" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="9.5" rx="2" />
      <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
    </>
  ),
  card: (
    <>
      <rect x="3" y="5.5" width="18" height="13" rx="2.5" />
      <path d="M3 10h18M7 14.5h3" />
    </>
  ),
  cash: (
    <>
      <rect x="3" y="6.5" width="18" height="11" rx="2" />
      <circle cx="12" cy="12" r="2.6" />
      <path d="M6.5 12h.1M17.5 12h.1" />
    </>
  ),
  bank: <path d="M3.5 9 12 4.5 20.5 9M5 9.5v8M9.5 9.5v8M14.5 9.5v8M19 9.5v8M3.5 19.5h17" />,
  locker: (
    <>
      <rect x="4" y="3.5" width="16" height="17" rx="2" />
      <path d="M12 3.5v17M4 9.5h16M4 15h16M9.5 6.5h.1M14.5 12h.1M9.5 18h.1" />
    </>
  ),
  'zoom-in': (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.2-4.2M11 8.5v5M8.5 11h5" />
    </>
  ),
  flip: <path d="M12 3.5v17M8.5 7 4 12l4.5 5V7ZM15.5 7l4.5 5-4.5 5V7Z" />,
  whatsapp: (
    <>
      <path d="M4.5 19.5 5.6 16A8 8 0 1 1 8.4 18.6l-3.9.9Z" />
      <path d="M9.2 8.6c-.3.9 0 2.3 1.3 3.7s2.9 2 3.8 1.6l.7-1-1.5-.9-.7.6c-.7-.3-1.6-1.2-1.9-1.9l.6-.7-.8-1.5-1.5.1Z" />
    </>
  ),
  instagram: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="4.5" />
      <circle cx="12" cy="12" r="3.6" />
      <path d="M16.8 7.2h.1" />
    </>
  ),
  facebook: <path d="M13.5 20v-7h2.4l.4-2.8h-2.8V8.5c0-.8.3-1.4 1.4-1.4h1.5V4.6a19 19 0 0 0-2.2-.1c-2.2 0-3.6 1.3-3.6 3.7v2.1H8.2V13h2.4v7" />,
}

export type IconName = keyof typeof P

export function Icon({ name, size = 22, strokeWidth = 1.5, ...rest }: { name: IconName; size?: number; strokeWidth?: number } & Omit<SVGProps<SVGSVGElement>, 'name'>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={rest['aria-label'] ? undefined : true}
      focusable="false"
      {...rest}
    >
      {P[name]}
    </svg>
  )
}
