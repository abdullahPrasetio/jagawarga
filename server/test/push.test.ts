import { describe, expect, test } from 'bun:test';
import { alertNotification, communityTopic, responderTopic } from '../src/lib/push';

describe('notifikasi darurat', () => {
  test('judul berbeda per jenis bantuan', () => {
    expect(alertNotification('panic', 'Blok A No. 3', null).title).toBe('🚨 PANIC: Blok A No. 3');
    expect(alertNotification('security', 'Blok A No. 3', null).title).toBe('🚨 MALING: Blok A No. 3');
    expect(alertNotification('fire', 'Blok B No. 2', null).title).toBe('🔥 KEBAKARAN: Blok B No. 2');
    expect(alertNotification('medical', 'Blok C No. 1', null).title).toBe('🚑 MEDIS: Blok C No. 1');
  });

  test('pesan pemicu menggantikan teks bawaan', () => {
    const notification = alertNotification('security', 'Blok A No. 3', '  ada orang lompat pagar  ');
    expect(notification.body).toBe('ada orang lompat pagar');
  });

  test('tanpa pesan memakai teks bawaan per jenis', () => {
    expect(alertNotification('fire', null, null)).toEqual({
      title: '🔥 KEBAKARAN: Tanpa unit',
      body: 'Laporan kebakaran. Segera bantu dan hubungi petugas.',
    });
  });

  test('jenis tak dikenal jatuh ke panic, bukan crash', () => {
    expect(alertNotification('meteor', 'Blok A No. 1', null).title).toBe('🚨 PANIC: Blok A No. 1');
  });

  test('topic komunitas dan petugas terpisah', () => {
    expect(communityTopic('abc')).toBe('community_abc');
    expect(responderTopic('abc')).toBe('community_abc_responders');
  });
});
