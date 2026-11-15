import { useEffect, useRef, useState, type ReactNode } from 'react';
import { fetchProtectedMedia } from '../api/client';

export function Rupiah({ value, className = '' }: { value: number; className?: string }) {
  return (
    <span className={`tnum whitespace-nowrap ${className}`}>
      {new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        maximumFractionDigits: 0,
      })
        .format(value)
        .replace(/\u00a0/g, ' ')}
    </span>
  );
}

const pillStyles: Record<string, { label: string; className: string; icon: string }> = {
  paid: { label: 'Lunas', className: 'bg-brand-100 text-brand-700', icon: '✓' },
  lunas: { label: 'Lunas', className: 'bg-brand-100 text-brand-700', icon: '✓' },
  approved: { label: 'Disetujui', className: 'bg-brand-100 text-brand-700', icon: '✓' },
  partial: { label: 'Sebagian', className: 'bg-amber-100 text-amber-700', icon: '◐' },
  unpaid: { label: 'Belum bayar', className: 'bg-amber-100 text-amber-700', icon: '◷' },
  pending: { label: 'Menunggu', className: 'bg-neutral-100 text-ink-muted', icon: '◷' },
  rejected: { label: 'Ditolak', className: 'bg-danger-100 text-danger-700', icon: '✕' },
  active: { label: 'Aktif', className: 'bg-danger-100 text-danger-700', icon: '!' },
  acknowledged: { label: 'Ditangani', className: 'bg-danger-100 text-danger-700', icon: '◉' },
  resolved: { label: 'Selesai', className: 'bg-neutral-100 text-ink-muted', icon: '✓' },
  cancelled: { label: 'Dibatalkan', className: 'bg-neutral-100 text-ink-muted', icon: '–' },
  open: { label: 'Berjalan', className: 'bg-brand-100 text-brand-700', icon: '●' },
  closed: { label: 'Ditutup', className: 'bg-neutral-100 text-ink-muted', icon: '■' },
};

export function StatusPill({ status }: { status: string }) {
  const style = pillStyles[status] ?? {
    label: status,
    className: 'bg-neutral-100 text-ink-muted',
    icon: '•',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${style.className}`}
    >
      <span aria-hidden>{style.icon}</span>
      {style.label}
    </span>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-line bg-surface p-5 ${className}`}>{children}</div>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-xl font-semibold text-ink">{children}</h2>
      {action}
    </div>
  );
}

export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
  width = 560,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}) {
  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/40 p-4">
      <div
        className="max-h-[90vh] w-full overflow-y-auto rounded-2xl border border-line bg-surface shadow-xl"
        style={{ maxWidth: width }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="rounded-lg px-2 text-ink-muted hover:bg-paper" aria-label="Tutup">
            ✕
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer ? <div className="flex justify-end gap-2 border-t border-line px-5 py-4">{footer}</div> : null}
      </div>
    </div>
  );
}

export function Button({
  children,
  variant = 'primary',
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost' }) {
  const styles = {
    primary: 'bg-brand-600 text-white hover:bg-brand-700 disabled:bg-neutral-100 disabled:text-ink-muted',
    secondary: 'border border-brand-600 text-brand-700 bg-surface hover:bg-brand-100',
    danger: 'bg-danger-600 text-white hover:bg-danger-700',
    ghost: 'text-ink-muted hover:bg-paper',
  }[variant];

  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

export function EmptyState({ title, caption }: { title: string; caption: string }) {
  return (
    <div className="flex flex-col items-center gap-1 px-6 py-12 text-center">
      <p className="text-base font-semibold text-ink">{title}</p>
      <p className="text-sm text-ink-muted">{caption}</p>
    </div>
  );
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="mb-4 flex items-center justify-between rounded-xl bg-danger-100 px-4 py-3 text-sm text-danger-700">
      <span>{message}</span>
      {onRetry ? (
        <button onClick={onRetry} className="font-semibold underline">
          Coba lagi
        </button>
      ) : null}
    </div>
  );
}

export function QueryError({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  if (!error) return null;
  return (
    <ErrorBanner
      message={error instanceof Error ? error.message : 'Gagal memuat data dari server'}
      onRetry={onRetry}
    />
  );
}

export function ImageProof({ mediaId, height = 200 }: { mediaId: string | null; height?: number }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!mediaId) return;
    let objectUrl: string | null = null;
    let cancelled = false;

    fetchProtectedMedia(mediaId)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => setFailed(true));

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [mediaId]);

  if (!mediaId) return <div className="text-sm text-ink-muted">Tanpa bukti</div>;
  if (failed) return <div className="text-sm text-danger-700">Bukti gagal dimuat</div>;
  if (!url) return <div className="animate-pulse rounded-xl bg-neutral-100" style={{ height }} />;

  return (
    <a href={url} target="_blank" rel="noreferrer">
      <img src={url} alt="Bukti pembayaran" className="rounded-xl border border-line object-contain" style={{ maxHeight: height }} />
    </a>
  );
}

export function SkeletonRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="h-11 animate-pulse rounded-lg bg-neutral-100" />
      ))}
    </div>
  );
}

/** '2026-11' → 'Nov 2026' (label periode tagihan). */
export function periodLabel(period: string | null | undefined): string {
  if (!period) return '-';
  const [year, month] = period.split('-').map(Number);
  if (!year || !month) return period;
  return new Intl.DateTimeFormat('id-ID', { month: 'short', year: 'numeric' }).format(
    new Date(year, month - 1, 1),
  );
}

const dayMonth = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' });
const dayMonthYear = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});
const timeOnly = new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' });

/** Tahun dihilangkan bila sama dengan tahun berjalan supaya tabel tetap ringkas. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.getFullYear() === new Date().getFullYear()
    ? dayMonth.format(date)
    : dayMonthYear.format(date);
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  const day =
    date.getFullYear() === new Date().getFullYear() ? dayMonth.format(date) : dayMonthYear.format(date);
  return `${day}, ${timeOnly.format(date)}`;
}

/** Pilihan periode (`YYYY-MM`) untuk filter & form tagihan. */
export function periodOptions(back = 12, forward = 3): string[] {
  const now = new Date();
  return Array.from({ length: back + forward + 1 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - back + index, 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  });
}

export function PeriodSelect({
  value,
  onChange,
  includeAll = false,
  ariaLabel = 'Periode',
  className = '',
}: {
  value: string;
  onChange: (value: string) => void;
  includeAll?: boolean;
  ariaLabel?: string;
  className?: string;
}) {
  const options = periodOptions();

  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      aria-label={ariaLabel}
      className={`rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand-600 ${className}`}
    >
      {includeAll && <option value="all">Semua periode</option>}
      {options.map((period) => (
        <option key={period} value={period}>
          {periodLabel(period)}
        </option>
      ))}
      {!options.includes(value) && value !== 'all' && (
        <option value={value}>{periodLabel(value)}</option>
      )}
    </select>
  );
}

/**
 * Tanggal ditampilkan dalam format Indonesia; input native tetap dipakai
 * (tersembunyi) supaya pemilih tanggal platform yang muncul.
 */
/** Input nominal rupiah: hanya digit, tampil dengan pemisah ribuan. */
export function MoneyInput({
  value,
  onChange,
  ariaLabel = 'Nominal',
}: {
  value: number;
  onChange: (value: number) => void;
  ariaLabel?: string;
}) {
  const digits = new Intl.NumberFormat('id-ID');

  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-muted">
        Rp
      </span>
      <input
        inputMode="numeric"
        aria-label={ariaLabel}
        value={value > 0 ? digits.format(value) : ''}
        placeholder="0"
        onChange={(event) => onChange(Number(event.target.value.replace(/\D/g, '')) || 0)}
        className="tnum w-full rounded-xl border border-line bg-surface py-2 pl-10 pr-3 text-right text-sm outline-none focus:border-brand-600"
      />
    </div>
  );
}

export function DateField({
  value,
  onChange,
  ariaLabel = 'Tanggal',
}: {
  value: string;
  onChange: (value: string) => void;
  ariaLabel?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);

  return (
    <button
      type="button"
      onClick={() => {
        const input = ref.current;
        if (!input) return;
        if (typeof input.showPicker === 'function') input.showPicker();
        else input.focus();
      }}
      aria-label={ariaLabel}
      className="relative flex w-full items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-left text-sm outline-none focus:border-brand-600 focus:ring-0"
    >
      <span className={`flex-1 ${value ? 'text-ink' : 'text-ink-muted'}`}>
        {value ? formatDate(value) : 'Pilih tanggal'}
      </span>
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden className="text-ink-muted">
        <rect x="2" y="3" width="12" height="11" rx="2" stroke="currentColor" strokeWidth="1.4" fill="none" />
        <path d="M2 6.5h12M5.5 2v2.5M10.5 2v2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
      <input
        ref={ref}
        type="date"
        value={value}
        aria-label={ariaLabel}
        tabIndex={-1}
        onChange={(event) => onChange(event.target.value)}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
    </button>
  );
}
