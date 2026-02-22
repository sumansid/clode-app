// Kanagawa Paper — Ink (dark) theme
// https://github.com/thesimonho/kanagawa-paper.nvim

// ─── Base palette ────────────────────────────────────────────────────────────
export const palette = {
  sumiInk0:  '#16161D',
  sumiInk1:  '#181820',
  sumiInk2:  '#1a1a22',
  sumiInk3:  '#1F1F28', // main background
  sumiInk4:  '#2A2A37',
  sumiInk5:  '#363646',
  sumiInk6:  '#54546D',

  fujiWhite:     '#DCD7BA',
  fujiGray:      '#727169',
  oldWhite:      '#C8C093',

  dragonWhite:   '#c5c9c5',
  dragonGray:    '#a6a69c',
  dragonGray2:   '#9e9b93',
  dragonGray3:   '#7a8382',

  dragonRed:     '#c4746e',
  dragonOrange:  '#b6927b',
  dragonOrange2: '#9d7665',
  dragonYellow:  '#c4b28a',
  dragonGreen:   '#699469',
  dragonGreen2:  '#8a9a7b',
  dragonGreen3:  '#717e67',
  dragonBlue:    '#658594',
  dragonBlue2:   '#859fac',
  dragonPink:    '#a292a3',
  dragonViolet:  '#8992a7',
  dragonAqua:    '#8ea49e',
  dragonTeal:    '#949fb5',

  springViolet1: '#938AA9',
  waveAqua2:     '#7AA89F',
} as const;

// ─── Semantic tokens ─────────────────────────────────────────────────────────
const p = palette;

export const theme = {
  // Backgrounds
  bg:          p.sumiInk3,
  bgDark:      p.sumiInk0,
  bgDim:       p.sumiInk1,
  surface:     p.sumiInk4,
  surfaceAlt:  p.sumiInk2,
  overlay:     'rgba(0,0,0,0.7)',

  // Borders
  border:      p.sumiInk5,
  borderDim:   p.sumiInk4,

  // Text
  fg:          p.fujiWhite,
  fgDim:       p.dragonGray,
  fgDimmer:    p.fujiGray,
  fgMuted:     p.sumiInk6,

  // Accents
  accent:      p.dragonBlue,
  accentLight: p.dragonBlue2,
  link:        p.dragonBlue2,

  // Status
  green:       p.dragonGreen,
  greenBg:     'rgba(105,148,105,0.12)',
  red:         p.dragonRed,
  redBg:       'rgba(196,116,110,0.12)',
  yellow:      p.dragonYellow,
  yellowBg:    'rgba(196,178,138,0.10)',
  orange:      p.dragonOrange,
  orangeBg:    'rgba(182,146,123,0.10)',
  purple:      p.springViolet1,
  purpleBg:    'rgba(147,138,169,0.12)',
  pink:        p.dragonPink,

  // Syntax / tool colors
  synString:   p.dragonGreen2,
  synKeyword:  p.dragonPink,
  synFunction: p.dragonBlue2,
  synComment:  p.fujiGray,
  synOperator: p.dragonRed,
  synType:     p.dragonAqua,
  synOrange:   p.dragonOrange,
  synViolet:   p.dragonViolet,
} as const;
