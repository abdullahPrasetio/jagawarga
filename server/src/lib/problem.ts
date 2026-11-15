import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { ZodError } from 'zod';

const titles: Record<string, string> = {
  unauthorized: 'Belum terautentikasi',
  forbidden: 'Tidak punya akses',
  not_found: 'Tidak ditemukan',
  validation_failed: 'Data tidak valid',
  conflict: 'Bentrok data',
  rate_limited: 'Terlalu banyak permintaan',
  invite_invalid: 'Kode undangan tidak berlaku',
  alert_active: 'Masih ada panic aktif',
  no_community: 'Belum tergabung di komunitas',
  community_suspended: 'Komunitas dinonaktifkan',
  payload_too_large: 'Berkas terlalu besar',
  insufficient_storage: 'Penyimpanan penuh',
  household_full: 'Anggota rumah sudah penuh',
};

export class ApiError extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    readonly code: string,
    readonly detail: string,
  ) {
    super(detail);
    this.name = 'ApiError';
  }
}

export function problem(
  c: Context,
  status: ContentfulStatusCode,
  code: string,
  detail: string,
  extra: Record<string, unknown> = {},
) {
  return c.json(
    {
      type: `https://jagawarga.id/errors/${code}`,
      title: titles[code] ?? code,
      status,
      detail,
      code,
      ...extra,
    },
    status,
    { 'content-type': 'application/problem+json' },
  );
}

/** Mengubah error apa pun menjadi problem+json. */
export function toProblem(c: Context, err: unknown) {
  if (err instanceof ApiError) return problem(c, err.status, err.code, err.detail);

  if (err instanceof ZodError) {
    const first = err.issues[0];
    const path = first?.path.join('.') ?? '';
    return problem(c, 400, 'validation_failed', path ? `${path}: ${first?.message}` : 'Data tidak valid', {
      issues: err.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
    });
  }

  let current: unknown = err;
  for (let depth = 0; depth < 4 && current; depth += 1) {
    const code = (current as { code?: string }).code;
    if (code === '23505') return problem(c, 409, 'conflict', 'Data dengan kunci yang sama sudah ada');
    if (code === '23503') return problem(c, 409, 'conflict', 'Data terkait tidak ditemukan atau masih dipakai');
    current = (current as { cause?: unknown }).cause;
  }

  console.error('[unhandled]', err);
  return problem(c, 500, 'internal_error', 'Terjadi kesalahan pada server');
}
