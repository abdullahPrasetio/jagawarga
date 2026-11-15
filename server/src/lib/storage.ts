import { mkdir, statfs, writeFile } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import { env } from '../env';
import { ApiError } from './problem';

/**
 * `MEDIA_DIR` relatif diresolusi terhadap root repo, bukan cwd, supaya
 * `make dev`, `bun test`, dan skrip verifikasi menulis ke folder yang sama.
 */
const repoRoot = resolve(import.meta.dir, '../../..');
export const mediaDir = isAbsolute(env.MEDIA_DIR) ? env.MEDIA_DIR : resolve(repoRoot, env.MEDIA_DIR);

const MAX_BYTES = 5 * 1024 * 1024;
const MIN_FREE_BYTES = 1024 * 1024 * 1024;

const signatures: Array<{ mime: string; ext: string; test: (bytes: Uint8Array) => boolean }> = [
  { mime: 'image/jpeg', ext: 'jpg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    mime: 'image/png',
    ext: 'png',
    test: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  },
  {
    mime: 'image/webp',
    ext: 'webp',
    test: (b) =>
      b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50,
  },
];

export type SavedImage = { storageKey: string; mime: string; bytes: number };

export async function saveImage(communityId: string, file: File): Promise<SavedImage> {
  if (file.size > MAX_BYTES) {
    throw new ApiError(413, 'payload_too_large', 'Ukuran gambar maksimal 5 MB');
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const signature = signatures.find((candidate) => candidate.test(bytes));
  if (!signature) {
    throw new ApiError(400, 'validation_failed', 'Hanya gambar JPEG, PNG, atau WebP');
  }

  const baseDir = mediaDir;
  await mkdir(baseDir, { recursive: true });

  try {
    const stats = await statfs(baseDir);
    const free = stats.bavail * stats.bsize;
    if (free < MIN_FREE_BYTES) {
      throw new ApiError(507, 'insufficient_storage', 'Penyimpanan server hampir penuh');
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    // statfs tidak tersedia: lanjutkan, penulisan file tetap akan gagal jika disk penuh.
  }

  const folder = join(baseDir, communityId);
  await mkdir(folder, { recursive: true });

  const name = `${crypto.randomUUID()}.${signature.ext}`;
  await writeFile(join(folder, name), bytes);

  return { storageKey: `${communityId}/${name}`, mime: signature.mime, bytes: bytes.byteLength };
}

export function mediaPath(storageKey: string): string {
  const baseDir = mediaDir;
  const full = resolve(baseDir, storageKey);
  if (!full.startsWith(baseDir + '/')) {
    throw new ApiError(400, 'validation_failed', 'storage key tidak valid');
  }
  return full;
}
