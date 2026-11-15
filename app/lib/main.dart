import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/date_symbol_data_local.dart';

import 'core/push.dart';
import 'core/router.dart';
import 'core/session.dart';
import 'core/theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initializeDateFormatting('id_ID');
  // Push disiapkan di latar belakang agar layar login tidak menunggu Firebase.
  unawaited(PushService.initialize());

  final container = ProviderContainer();
  try {
    await container.read(sessionProvider.notifier).restore();
  } catch (error) {
    debugPrint('restore sesi gagal: $error');
  }

  runApp(
    UncontrolledProviderScope(
      container: container,
      child: const JagaWargaApp(),
    ),
  );
}

class JagaWargaApp extends ConsumerWidget {
  const JagaWargaApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);

    return MaterialApp.router(
      title: 'Jaga Warga',
      debugShowCheckedModeBanner: false,
      theme: WargaTheme.build(),
      routerConfig: router,
    );
  }
}
