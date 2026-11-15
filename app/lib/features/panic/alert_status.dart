import '../../core/models.dart';
import 'alert_kinds.dart';

/// Pemetaan status alert ke teks Indonesia. Dipakai layar panic dan diuji unit.
class AlertStatusView {
  const AlertStatusView({required this.title, required this.caption, required this.tone});

  final String title;
  final String caption;
  final String tone; // 'danger' | 'calm' | 'done'

  String get badgeLabel => switch (tone) {
        'danger' => 'DARURAT',
        'done' => 'SELESAI',
        _ => 'DITANGANI',
      };
}

AlertStatusView alertStatusView(AlertItem alert) {
  switch (alert.status) {
    case 'active':
      return AlertStatusView(
        title: 'Menunggu respons',
        caption: alert.acknowledgedByName == null
            ? 'Belum ada warga atau petugas yang merespons'
            : '${alert.acknowledgedByName} merespons',
        tone: 'danger',
      );
    case 'acknowledged':
      return AlertStatusView(
        title: 'Sedang ditangani',
        caption: alert.acknowledgedByName == null
            ? 'Petugas sedang menuju lokasi'
            : 'Ditangani oleh ${alert.acknowledgedByName}',
        tone: 'calm',
      );
    case 'cancelled':
      return AlertStatusView(
        title: 'Dibatalkan',
        caption: 'Sinyal dibatalkan oleh pemicu',
        tone: 'done',
      );
    case 'resolved':
      final resolution = alert.resolution == 'false_alarm' ? 'False alarm' : 'Ditangani';
      return AlertStatusView(
        title: 'Selesai',
        caption: alert.resolvedByName == null
            ? resolution
            : '$resolution oleh ${alert.resolvedByName}',
        tone: 'done',
      );
    default:
      return const AlertStatusView(
        title: 'Status tidak dikenal',
        caption: 'Muat ulang halaman',
        tone: 'done',
      );
  }
}

String alertHeadline(AlertItem alert) {
  final kind = alertKindFor(alert.kind);
  return '${kind.shortLabel} — ${alert.houseLabel ?? 'Tanpa unit'}';
}
