import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:home_widget/home_widget.dart';

/// Snapshot kecil yang dibaca AppWidget native (RemoteViews tidak bisa
/// menjalankan Flutter). Widget **tidak pernah** mengirim panic sendiri:
/// tap tombol membuka layar konfirmasi di aplikasi.
class WidgetService {
  static const _providers = [
    'id.my.temancode.jagawarga.widget.PanicWidgetProvider',
    'id.my.temancode.jagawarga.widget.BantuanWidgetProvider',
    'id.my.temancode.jagawarga.widget.InfoWidgetProvider',
  ];

  static Future<void> sync({
    required bool hasActiveAlert,
    required String houseLabel,
    required String communityName,
    String? alertHouse,
    String? alertKind,
    String? announcement,
    int unpaidCount = 0,
    int unpaidTotal = 0,
    required String updatedLabel,
  }) async {
    await _write('widget_status', hasActiveAlert ? 'alert' : 'safe');
    await _write('widget_house', houseLabel);
    await _write('widget_community', communityName);
    await _write('widget_alert_house', alertHouse ?? '');
    await _write('widget_alert_kind', alertKind ?? '');
    await _write('widget_announcement', announcement ?? '');
    await _write('widget_unpaid_count', '$unpaidCount');
    await _write('widget_unpaid_total', '$unpaidTotal');
    await _write('widget_updated', updatedLabel);
    await _refresh();
  }

  static Future<void> markLoggedOut() async {
    await _write('widget_status', 'unauthenticated');
    await _write('widget_house', '');
    await _write('widget_alert_house', '');
    await _write('widget_announcement', '');
    await _write('widget_unpaid_count', '0');
    await _write('widget_unpaid_total', '0');
    await _write('widget_updated', '');
    await _refresh();
  }

  static Future<void> _write(String key, String value) {
    return HomeWidget.saveWidgetData<String>(key, value);
  }

  static Future<void> _refresh() async {
    for (final provider in _providers) {
      try {
        await HomeWidget.updateWidget(qualifiedAndroidName: provider);
        debugPrint('[widget] $provider diperbarui');
      } catch (error) {
        // widget mungkin belum dipasang / bukan Android
        debugPrint('[widget] $provider gagal: $error');
      }
    }
  }

  /// URI yang dikirim widget: `jagawarga:///panic/confirm?type=medical`.
  static String? routeFor(Uri? uri) {
    if (uri == null) return null;
    if (uri.path == '/panic/confirm') {
      final type = uri.queryParameters['type'] ?? 'panic';
      return '/panic/confirm?type=$type';
    }
    return null;
  }

  static Future<String?> initialRoute() async {
    try {
      return routeFor(await HomeWidget.initiallyLaunchedFromHomeWidget());
    } catch (_) {
      return null;
    }
  }

  static Stream<String> get onRoute {
    try {
      return HomeWidget.widgetClicked.map(routeFor).where((route) => route != null).cast<String>();
    } catch (_) {
      return const Stream.empty();
    }
  }
}
