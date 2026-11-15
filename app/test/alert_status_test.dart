import 'package:flutter_test/flutter_test.dart';
import 'package:jagawarga/core/models.dart';
import 'package:jagawarga/features/panic/alert_status.dart';

AlertItem alert({required String status, String? ack, String? resolution, String? resolver}) {
  return AlertItem(
    id: 'a1',
    kind: 'panic',
    status: status,
    triggeredByName: 'Budi',
    triggeredBy: 'u1',
    houseLabel: 'Blok A No. 3',
    acknowledgedByName: ack,
    resolution: resolution,
    resolvedByName: resolver,
    createdAt: DateTime.now().toIso8601String(),
    eventCount: 0,
  );
}

void main() {
  test('status active menampilkan menunggu respons', () {
    final view = alertStatusView(alert(status: 'active'));
    expect(view.title, 'Menunggu respons');
    expect(view.badgeLabel, 'DARURAT');
  });

  test('status acknowledged menyebut petugas', () {
    final view = alertStatusView(alert(status: 'acknowledged', ack: 'Joko'));
    expect(view.title, 'Sedang ditangani');
    expect(view.caption, 'Ditangani oleh Joko');
    expect(view.badgeLabel, 'DITANGANI');
  });

  test('resolved false alarm', () {
    final view = alertStatusView(
      alert(status: 'resolved', resolution: 'false_alarm', resolver: 'Joko'),
    );
    expect(view.title, 'Selesai');
    expect(view.caption, 'False alarm oleh Joko');
    expect(view.badgeLabel, 'SELESAI');
  });

  test('resolved handled', () {
    final view = alertStatusView(alert(status: 'resolved', resolution: 'handled'));
    expect(view.caption, 'Ditangani');
  });

  test('cancelled', () {
    final view = alertStatusView(alert(status: 'cancelled'));
    expect(view.title, 'Dibatalkan');
  });
}
