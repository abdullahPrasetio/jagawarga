import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/config.dart';
import '../../core/session.dart';
import '../../core/theme.dart';

class WebOnlyPage extends ConsumerWidget {
  const WebOnlyPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.laptop_mac_outlined, size: 40, color: WargaColors.inkMuted),
              const SizedBox(height: 16),
              Text(
                'Kelola komunitas lewat web admin',
                style: WargaTypography.h2,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              Text(
                AppConfig.webAdminUrl,
                style: WargaTypography.caption.copyWith(color: WargaColors.inkMuted),
              ),
              const SizedBox(height: 20),
              OutlinedButton(
                onPressed: () => Clipboard.setData(const ClipboardData(text: AppConfig.webAdminUrl)),
                child: const Text('Salin alamat'),
              ),
              const SizedBox(height: 8),
              TextButton(
                onPressed: () => ref.read(sessionProvider.notifier).logout(),
                child: const Text('Keluar'),
              ),
              const SizedBox(height: 24),
              TextButton.icon(
                onPressed: () => context.go('/login'),
                icon: const Icon(Icons.login),
                label: const Text('Masuk dengan akun warga'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
