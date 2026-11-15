import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:jagawarga/core/format.dart';

void main() {
  setUpAll(() async {
    await initializeDateFormatting('id_ID');
  });

  test('formatRupiah memakai titik ribuan tanpa desimal', () {
    expect(formatRupiah(150000), 'Rp 150.000');
    expect(formatRupiah(0), 'Rp 0');
    expect(formatRupiah(4250000), 'Rp 4.250.000');
  });

  test('monthLabel menerjemahkan periode', () {
    expect(monthLabel('2026-11').toLowerCase(), 'november 2026');
  });

  test('relativeTime untuk waktu dekat', () {
    final now = DateTime.now().subtract(const Duration(minutes: 5)).toIso8601String();
    expect(relativeTime(now), '5 menit lalu');
  });
}
