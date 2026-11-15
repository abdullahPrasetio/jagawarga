import 'package:intl/intl.dart';

final _rupiah = NumberFormat.currency(locale: 'id_ID', symbol: 'Rp ', decimalDigits: 0);
final _shortDate = DateFormat('d MMM yyyy', 'id_ID');
final _dateTime = DateFormat('d MMM yyyy, HH:mm', 'id_ID');

/// Satu-satunya pemformat nominal. Jangan memformat uang inline di widget.
String formatRupiah(int amount) => _rupiah.format(amount);

String formatDate(String iso) {
  final parsed = DateTime.tryParse(iso);
  return parsed == null ? '-' : _shortDate.format(parsed.toLocal());
}

String formatDateTime(String iso) {
  final parsed = DateTime.tryParse(iso);
  return parsed == null ? '-' : _dateTime.format(parsed.toLocal());
}

String relativeTime(String iso) {
  final parsed = DateTime.tryParse(iso);
  if (parsed == null) return '-';
  final diff = DateTime.now().difference(parsed.toLocal());
  if (diff.inMinutes < 1) return 'baru saja';
  if (diff.inMinutes < 60) return '${diff.inMinutes} menit lalu';
  if (diff.inHours < 24) return '${diff.inHours} jam lalu';
  if (diff.inDays < 30) return '${diff.inDays} hari lalu';
  return formatDate(iso);
}

String formatClock(DateTime time) => DateFormat('HH:mm', 'id_ID').format(time);

String monthLabel(String period) {
  final parsed = DateTime.tryParse('$period-01');
  return parsed == null ? period : DateFormat('MMMM yyyy', 'id_ID').format(parsed);
}
