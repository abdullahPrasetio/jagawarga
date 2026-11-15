import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api_error.dart';
import '../../core/session.dart';
import '../../core/theme.dart';
import '../../core/widgets.dart';

class ActivatePage extends ConsumerStatefulWidget {
  const ActivatePage({super.key});

  @override
  ConsumerState<ActivatePage> createState() => _ActivatePageState();
}

class _ActivatePageState extends ConsumerState<ActivatePage> {
  final _code = TextEditingController();
  final _name = TextEditingController();
  final _phone = TextEditingController();
  final _password = TextEditingController();
  String? _error;
  bool _busy = false;

  @override
  void dispose() {
    _code.dispose();
    _name.dispose();
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
      await ref.read(sessionProvider.notifier).activate(
            inviteCode: _code.text.trim().toUpperCase(),
            name: _name.text.trim(),
            phone: _phone.text.trim(),
            password: _password.text,
          );
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
      appBar: AppBar(title: const Text('Aktivasi akun')),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'Masukkan kode undangan dari pengurus atau kepala keluarga Anda.',
                style: WargaTypography.caption.copyWith(color: WargaColors.inkMuted),
              ),
              const SizedBox(height: 24),
              Text('Kode undangan', style: WargaTypography.label),
              const SizedBox(height: 6),
              TextField(
                controller: _code,
                textCapitalization: TextCapitalization.characters,
                style: WargaTypography.bodyStrong.copyWith(letterSpacing: 2),
                decoration: const InputDecoration(hintText: 'ABCD1234'),
              ),
              const SizedBox(height: 16),
              Text('Nama lengkap', style: WargaTypography.label),
              const SizedBox(height: 6),
              TextField(controller: _name, decoration: const InputDecoration(hintText: 'Nama sesuai KTP')),
              const SizedBox(height: 16),
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
                decoration: const InputDecoration(
                  hintText: 'Minimal 8 karakter',
                  helperText: 'Minimal 8 karakter',
                ),
              ),
              const SizedBox(height: 24),
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
                    : const Text('Aktivasi'),
              ),
              const SizedBox(height: 12),
              Center(
                child: TextButton(
                  onPressed: () => context.go('/login'),
                  child: const Text('Sudah punya akun? Masuk'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
