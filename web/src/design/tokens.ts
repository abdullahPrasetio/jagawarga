/**
 * Token desain web — cermin dari `design/design-system.md` dan
 * `app/lib/core/theme.dart`. Dipakai oleh Tailwind (`tailwind.css`) dan
 * komponen React. Jangan menulis hex langsung di komponen.
 */

export const color = {
  brand900: '#0B3B24',
  brand700: '#14532D',
  brand600: '#1A6B3C',
  brand500: '#21854B',
  brand100: '#DCFCE7',

  paper: '#F7F6F2',
  surface: '#FFFFFF',
  ink: '#10231A',
  inkMuted: '#5B6B61',
  line: '#E3E6E1',

  danger700: '#991B1B',
  danger600: '#DC2626',
  danger100: '#FEE2E2',

  amber700: '#92400E',
  amber100: '#FDF0DF',

  neutral100: '#EEF0ED',

  success600: '#157F3C',
} as const;

export const radius = { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 } as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  section: 32,
  screen: 40,
  hero: 56,
} as const;

export const typography = {
  display: { fontSize: 32, lineHeight: 38, weight: 700, letterSpacing: '-0.5px' },
  h1: { fontSize: 24, lineHeight: 30, weight: 700, letterSpacing: '-0.2px' },
  h2: { fontSize: 20, lineHeight: 26, weight: 600 },
  h3: { fontSize: 17, lineHeight: 24, weight: 600 },
  body: { fontSize: 15, lineHeight: 22, weight: 400 },
  bodyStrong: { fontSize: 15, lineHeight: 22, weight: 600 },
  caption: { fontSize: 13, lineHeight: 18, weight: 500 },
  label: { fontSize: 12, lineHeight: 16, weight: 600, letterSpacing: '0.2px' },
  money: { fontSize: 17, lineHeight: 24, weight: 600, fontVariantNumeric: 'tabular-nums' },
} as const;

export const shadow = {
  floating: '0 8px 24px -12px rgba(16,35,26,0.18)',
} as const;

export const rupiah = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

export function formatRupiah(value: number): string {
  return rupiah.format(value).replace(/\u00a0/g, ' ');
}
