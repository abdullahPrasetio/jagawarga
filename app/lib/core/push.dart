import 'dart:io';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

import 'api_client.dart';

@pragma('vm:entry-point')
Future<void> _backgroundHandler(RemoteMessage message) async {
  // Push latar ditangani sistem; handler ini hanya menjaga entrypoint tetap ada.
}

/// Inisialisasi push bersifat best-effort: tanpa `google-services.json`
/// aplikasi tetap bisa dipakai (panic diverifikasi lewat SSE + inbox).
class PushService {
  static bool _ready = false;
  static final _local = FlutterLocalNotificationsPlugin();

  static bool get isReady => _ready;

  static Future<void> initialize() async {
    if (!Platform.isAndroid && !Platform.isIOS) return;

    try {
      // Jangan pernah menggantung startup: Firebase/Play Services bisa lambat
      // atau tidak tersedia sama sekali.
      await Firebase.initializeApp().timeout(const Duration(seconds: 6));
    } catch (error) {
      debugPrint('push nonaktif: $error');
      return;
    }

    try {
      FirebaseMessaging.onBackgroundMessage(_backgroundHandler);

      await _local.initialize(
        settings: const InitializationSettings(
          android: AndroidInitializationSettings('@mipmap/ic_launcher'),
          iOS: DarwinInitializationSettings(),
        ),
      );

      await _local
          .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()
          ?.createNotificationChannel(
            const AndroidNotificationChannel(
              'panic',
              'Panic',
              description: 'Sinyal darurat warga',
              importance: Importance.max,
              playSound: true,
              enableVibration: true,
            ),
          );

      FirebaseMessaging.onMessage.listen((message) async {
        final notification = message.notification;
        if (notification == null) return;
        await _local.show(
          id: notification.hashCode,
          title: notification.title,
          body: notification.body,
          notificationDetails: NotificationDetails(
            android: AndroidNotificationDetails(
              message.data['type'] == 'panic' ? 'panic' : 'default',
              'Jaga Warga',
              importance: Importance.max,
              priority: Priority.high,
            ),
          ),
        );
      });

      _ready = true;
    } catch (error) {
      debugPrint('push gagal disiapkan: $error');
    }
  }

  /// `responder` = pengurus/satpam: selain topic komunitas, mereka juga
  /// berlangganan topic petugas agar menerima notifikasi tambahan.
  static Future<void> subscribe(
    Api api,
    String communityId, {
    required bool responder,
  }) async {
    if (!_ready) return;
    try {
      await FirebaseMessaging.instance.requestPermission();
      await FirebaseMessaging.instance.subscribeToTopic(communityTopic(communityId));

      if (responder) {
        await FirebaseMessaging.instance.subscribeToTopic(responderTopic(communityId));
      }

      final token = await FirebaseMessaging.instance.getToken();
      if (token != null) {
        await api.post('auth/me/devices', body: {'token': token, 'platform': _platform});
      }
    } catch (error) {
      debugPrint('subscribe push gagal: $error');
    }
  }

  static Future<void> unsubscribe(String communityId) async {
    if (!_ready) return;
    try {
      await FirebaseMessaging.instance.unsubscribeFromTopic(communityTopic(communityId));
      await FirebaseMessaging.instance.unsubscribeFromTopic(responderTopic(communityId));
    } catch (_) {
      // abaikan: logout tetap berjalan
    }
  }

  /// Alert yang membuka aplikasi (dari notifikasi panic maupun update status).
  static Future<String?> initialAlertId() async {
    if (!_ready) return null;
    final message = await FirebaseMessaging.instance.getInitialMessage();
    return _alertIdOf(message);
  }

  static Stream<String> get onAlertTap {
    if (!_ready) return const Stream.empty();
    return FirebaseMessaging.onMessageOpenedApp
        .map(_alertIdOf)
        .where((id) => id != null)
        .cast<String>();
  }

  static String? _alertIdOf(RemoteMessage? message) {
    final data = message?.data;
    if (data == null) return null;
    if (data['type'] != 'panic' && data['type'] != 'alert') return null;
    return data['alertId'] as String?;
  }

  static String communityTopic(String communityId) => 'community_$communityId';

  static String responderTopic(String communityId) => 'community_${communityId}_responders';

  static String get _platform => Platform.isIOS ? 'ios' : 'android';
}
