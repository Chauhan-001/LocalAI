/**
 * Inline SVG icon set.
 *
 * Kept as local components so the app ships no icon-font or icon-package
 * dependency. Every icon inherits `currentColor` and is decorative by default.
 */

const base = {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': 'true',
  focusable: 'false'
};

const Icon = ({ children, size = 16, ...rest }) => (
  <svg {...base} width={size} height={size} {...rest}>
    {children}
  </svg>
);

export const IconPlus = props => (
  <Icon {...props}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);

export const IconSearch = props => (
  <Icon {...props}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </Icon>
);

export const IconTrash = props => (
  <Icon {...props}>
    <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
  </Icon>
);

export const IconPencil = props => (
  <Icon {...props}>
    <path d="M4 20h4l10-10-4-4L4 16v4Z" />
    <path d="m14 6 4 4" />
  </Icon>
);

export const IconPin = props => (
  <Icon {...props}>
    <path d="M12 17v5" />
    <path d="m9 3 6 0-.7 6.2 2.7 3.3H7l2.7-3.3L9 3Z" />
  </Icon>
);

export const IconSettings = props => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1" />
  </Icon>
);

export const IconMail = props => (
  <Icon {...props}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m3 7 9 6 9-6" />
  </Icon>
);

export const IconMenu = props => (
  <Icon {...props}>
    <path d="M4 6h16M4 12h16M4 18h16" />
  </Icon>
);

export const IconPanelLeft = props => (
  <Icon {...props}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M9 4v16" />
  </Icon>
);

export const IconCopy = props => (
  <Icon {...props}>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15V5a2 2 0 0 1 2-2h8" />
  </Icon>
);

export const IconCheck = props => (
  <Icon {...props}>
    <path d="m5 13 4 4L19 7" />
  </Icon>
);

export const IconRefresh = props => (
  <Icon {...props}>
    <path d="M21 12a9 9 0 1 1-3-6.7" />
    <path d="M21 4v5h-5" />
  </Icon>
);

export const IconThumbUp = props => (
  <Icon {...props}>
    <path d="M7 10v10H4V10h3Z" />
    <path d="M7 10l4-7a2 2 0 0 1 2 2l-.5 4H18a2 2 0 0 1 2 2.3l-1 6A2 2 0 0 1 17 19H7" />
  </Icon>
);

export const IconThumbDown = props => (
  <Icon {...props}>
    <path d="M7 14V4H4v10h3Z" />
    <path d="M7 14l4 7a2 2 0 0 0 2-2l-.5-4H18a2 2 0 0 0 2-2.3l-1-6A2 2 0 0 0 17 5H7" />
  </Icon>
);

export const IconSend = props => (
  <Icon {...props}>
    <path d="M4 12 20 4l-8 16-2-6-6-2Z" />
  </Icon>
);

export const IconStop = props => (
  <Icon {...props}>
    <rect x="6" y="6" width="12" height="12" rx="2" />
  </Icon>
);

export const IconSun = props => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19" />
  </Icon>
);

export const IconMoon = props => (
  <Icon {...props}>
    <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a7 7 0 1 0 10.5 10.5Z" />
  </Icon>
);

export const IconMonitor = props => (
  <Icon {...props}>
    <rect x="3" y="4" width="18" height="12" rx="2" />
    <path d="M8 20h8M12 16v4" />
  </Icon>
);

export const IconClose = props => (
  <Icon {...props}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Icon>
);

export const IconDownload = props => (
  <Icon {...props}>
    <path d="M12 4v10M8 11l4 4 4-4" />
    <path d="M4 20h16" />
  </Icon>
);

export const IconKeyboard = props => (
  <Icon {...props}>
    <rect x="2" y="6" width="20" height="12" rx="2" />
    <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8" />
  </Icon>
);

export const IconAlert = props => (
  <Icon {...props}>
    <path d="M12 4 2 20h20L12 4Z" />
    <path d="M12 10v4M12 17h.01" />
  </Icon>
);

export const IconSparkle = props => (
  <Icon {...props}>
    <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" />
  </Icon>
);

export const IconChat = props => (
  <Icon {...props}>
    <path d="M20 15a3 3 0 0 1-3 3H8l-4 3V6a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v9Z" />
  </Icon>
);
