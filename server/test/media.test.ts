import { beforeAll, describe, expect, test } from 'bun:test';
import { imageFile, loginAs, phones, request, seedDatabase } from './helpers';

let token = '';

beforeAll(async () => {
  await seedDatabase();
  token = await loginAs(phones.budi);
});

async function upload(file: File) {
  const form = new FormData();
  form.append('file', file);
  return request('/media', { method: 'POST', token, body: form });
}

describe('media', () => {
  test('gambar valid tersimpan dengan ukuran yang benar', async () => {
    const file = imageFile();
    const result = await upload(file);

    expect(result.status).toBe(201);
    expect(result.body.mime).toBe('image/png');
    expect(result.body.bytes).toBe(file.size);
    expect(typeof result.body.id).toBe('string');
  });

  test('berkas bukan gambar ditolak walau ekstensinya gambar', async () => {
    const fake = new File([new TextEncoder().encode('bukan gambar sama sekali')], 'bukti.png', {
      type: 'image/png',
    });

    const result = await upload(fake);

    expect(result.status).toBe(400);
    expect(result.body.code).toBe('validation_failed');
  });

  test('berkas lebih dari 5 MB ditolak 413', async () => {
    const big = new File([new Uint8Array(6 * 1024 * 1024)], 'besar.png', { type: 'image/png' });

    const result = await upload(big);

    expect(result.status).toBe(413);
    expect(result.body.code).toBe('payload_too_large');
  });

  test('raw media bisa dibaca anggota komunitas yang sama', async () => {
    const created = await upload(imageFile());
    const raw = await request(`/media/${created.body.id}/raw`, { token });

    expect(raw.status).toBe(200);
    expect(raw.headers.get('content-type')).toBe('image/png');
  });
});
