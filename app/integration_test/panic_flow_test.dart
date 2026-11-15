import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:jagawarga/main.dart' as app;

/// End-to-end di emulator. Butuh API berjalan di `API_BASE_URL`
/// (default `http://10.0.2.2:8787`) dan data demo (`make seed`).
///
/// Yang diuji di perangkat: login → beranda → alert realtime lewat SSE →
/// layar panic → batalkan. Ambang tahan tombol (1,5 detik) diuji di
/// `test/panic_button_test.dart` karena gesture hold tidak deterministik
/// di binding live.
void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  const apiBase = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:8787',
  );
  const phone = '081100000005';
  const password = 'Rahasia123!';

  Future<void> waitFor(WidgetTester tester, Finder finder, {int seconds = 60}) async {
    final deadline = DateTime.now().add(Duration(seconds: seconds));
    while (DateTime.now().isBefore(deadline)) {
      await tester.pump(const Duration(milliseconds: 200));
      if (finder.evaluate().isNotEmpty) return;
    }
    fail('Tidak menemukan $finder setelah $seconds detik');
  }

  Future<Map<String, dynamic>> apiCall(
    HttpClient client,
    String method,
    String path, {
    String? token,
    Map<String, dynamic>? body,
  }) async {
    final request = await client.openUrl(method, Uri.parse('$apiBase/api/v1$path'));
    request.headers.contentType = ContentType.json;
    if (token != null) request.headers.set('authorization', 'Bearer $token');
    if (body != null) request.write(jsonEncode(body));

    final response = await request.close();
    final text = await response.transform(utf8.decoder).join();
    if (text.isEmpty) return <String, dynamic>{'status': response.statusCode};
    return (jsonDecode(text) as Map).cast<String, dynamic>();
  }

  testWidgets('login lalu alert realtime dan batalkan dari aplikasi', (tester) async {
    await const FlutterSecureStorage().deleteAll();

    final client = HttpClient();
    addTearDown(client.close);

    final login = await apiCall(client, 'POST', '/auth/login', body: {
      'phone': phone,
      'password': password,
    });
    final tokenValue = login['accessToken'];
    if (tokenValue is! String) {
      fail('Login API gagal: ${jsonEncode(login)}');
    }
    final apiToken = tokenValue;

    // Bersihkan alert yang tertinggal supaya panic baru tidak kena 409.
    final active = await apiCall(client, 'GET', '/alerts/active', token: apiToken);
    for (final alert in (active['items'] as List).cast<Map>()) {
      await apiCall(client, 'POST', '/alerts/${alert['id']}/resolve', token: apiToken, body: {
        'resolution': 'false_alarm',
      });
    }

    app.main();
    await tester.pump(const Duration(seconds: 1));
    await waitFor(tester, find.text('Masuk ke Jaga Warga'));

    await tester.enterText(find.byType(TextField).at(0), phone);
    await tester.enterText(find.byType(TextField).at(1), password);
    await tester.tap(find.widgetWithText(FilledButton, 'Masuk'));

    await waitFor(tester, find.text('Panic Button'), seconds: 120);

    // Alert dikirim lewat API; aplikasi harus menampilkannya via SSE.
    final created = await apiCall(client, 'POST', '/alerts', token: apiToken, body: {
      'message': 'uji e2e',
    });
    final alertId = created['id'] as String;

    await waitFor(tester, find.textContaining('PANIC AKTIF'), seconds: 60);

    await tester.tap(find.text('Lihat'));
    await waitFor(tester, find.textContaining('PANIC AKTIF'), seconds: 30);

    if (find.text('Batalkan sinyal').evaluate().isNotEmpty) {
      // Jendela batal hanya 10 detik sejak alert dibuat.
      await tester.tap(find.text('Batalkan sinyal'));
      await waitFor(tester, find.text('Dibatalkan'), seconds: 30);

      final after = await apiCall(client, 'GET', '/alerts/$alertId', token: apiToken);
      expect(after['status'], 'cancelled');
    } else {
      // Sudah lewat 10 detik: selesaikan lewat API agar DB bersih.
      await apiCall(client, 'POST', '/alerts/$alertId/resolve', token: apiToken, body: {
        'resolution': 'false_alarm',
      });
      await waitFor(tester, find.text('Selesai'), seconds: 30);
    }
  });
}
