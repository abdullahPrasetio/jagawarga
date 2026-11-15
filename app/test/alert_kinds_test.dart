import 'package:flutter_test/flutter_test.dart';
import 'package:jagawarga/features/panic/alert_kinds.dart';
import 'package:jagawarga/features/panic/alert_status.dart';
import 'package:jagawarga/core/models.dart';

AlertItem alert({required String kind, String? house}) {
  return AlertItem(
    id: 'a1',
    kind: kind,
    status: 'active',
    triggeredByName: 'Budi',
    triggeredBy: 'u1',
    houseLabel: house ?? 'Blok A No. 3',
    createdAt: DateTime.now().toIso8601String(),
    eventCount: 1,
  );
}

void main() {
  test('jenis bantuan dikenal dan punya label sendiri', () {
    expect(alertKindFor('security').shortLabel, 'MALING');
    expect(alertKindFor('fire').shortLabel, 'KEBAKARAN');
    expect(alertKindFor('medical').shortLabel, 'MEDIS');
    expect(alertKindFor('panic').shortLabel, 'PANIC');
  });

  test('jenis tidak dikenal jatuh ke panic', () {
    expect(alertKindFor('meteor').value, 'panic');
  });

  test('judul layar panic mengikuti jenis', () {
    expect(alertHeadline(alert(kind: 'security')), 'MALING — Blok A No. 3');
    expect(alertHeadline(alert(kind: 'fire')), 'KEBAKARAN — Blok A No. 3');
  });

  test('ikont tidak sama untuk kebakaran dan medis', () {
    expect(alertKindVisual('fire').icon, isNot(alertKindVisual('medical').icon));
  });
}
