import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api_error.dart';
import '../../core/session.dart';
import '../../core/theme.dart';
import '../../core/widgets.dart';

class LoginPage extends ConsumerStatefulWidget {
  const LoginPage({super.key});

  @override
  ConsumerState<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends ConsumerState<LoginPage> {
  final _phone = TextEditingController();
  final _password = TextEditingController();
  String? _error;
  bool _busy = false;

  @override
  void dispose() {
    _phone.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      _busy = true;
      _error = null;
    });

    try {
      await ref.read(sessionProvider.notifier).login(_phone.text.trim(), _password.text);
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } catch (error) {
      if (mounted) setState(() => _error = errorMessage(error));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 40),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 24),
              Container(
                width: 56,
                height: 56,
                decoration: const BoxDecoration(color: WargaColors.brand100, shape: BoxShape.circle),
                child: const Icon(Icons.shield_outlined, color: WargaColors.brand700),
              ),
              const SizedBox(height: 24),
              Text('Masuk ke Jaga Warga', style: WargaTypography.h1),
              const SizedBox(height: 8),
              Text(
                'Gunakan nomor HP yang terdaftar di komunitas Anda.',
                style: WargaTypography.caption.copyWith(color: WargaColors.inkMuted),
              ),
              if (ref.watch(sessionProvider).notice != null) ...[
                const SizedBox(height: 16),
                InlineError(ref.watch(sessionProvider).notice!),
              ],
              const SizedBox(height: 32),
              Text('Nomor HP', style: WargaTypography.label),
              const SizedBox(height: 6),
              TextField(
                controller: _phone,
                keyboardType: TextInputType.phone,
                decoration: const InputDecoration(hintText: '08xxxxxxxxxx'),
              ),
              const SizedBox(height: 16),
              Text('Password', style: WargaTypography.label),
              const SizedBox(height: 6),
              TextField(
                controller: _password,
                obscureText: true,
                decoration: const InputDecoration(hintText: 'Minimal 8 karakter'),
                onSubmitted: (_) => _submit(),
              ),
              Align(
                alignment: Alignment.centerRight,
                child: TextButton(
                  onPressed: () => showDialog<void>(
                    context: context,
                    builder: (context) => AlertDialog(
                      title: const Text('Lupa password?'),
                      content: const Text(
                        'Hubungi pengurus komunitas Anda. Pengurus dapat membuat password sementara dari menu Kelola.',
                      ),
                      actions: [
                        TextButton(onPressed: () => Navigator.pop(context), child: const Text('Mengerti')),
                      ],
                    ),
                  ),
                  child: const Text('Lupa password?'),
                ),
              ),
              if (_error != null) ...[
                InlineError(_error!),
                const SizedBox(height: 12),
              ],
              FilledButton(
                onPressed: _busy ? null : _submit,
                child: _busy
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                      )
                    : const Text('Masuk'),
              ),
              const SizedBox(height: 16),
              Center(
                child: TextButton(
                  onPressed: () => context.go('/activate'),
                  child: const Text('Punya kode undangan? Aktivasi'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
