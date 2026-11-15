/// Konfigurasi runtime. Ubah lewat `--dart-define=API_BASE_URL=...`.
class AppConfig {
  /// 10.0.2.2 adalah loopback host dari emulator Android.
  static const apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:8787',
  );

  static const webAdminUrl = String.fromEnvironment(
    'WEB_ADMIN_URL',
    defaultValue: 'http://localhost:5173',
  );

  static String get apiPrefix => '$apiBaseUrl/api/v1';
}
