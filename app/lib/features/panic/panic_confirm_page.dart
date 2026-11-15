import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api_client.dart';
import '../../core/session.dart';
import '../../core/theme.dart';
import 'alert_kinds.dart';
import 'panic_button.dart';

/// Layar konfirmasi sebelum sinyal darurat dikirim. Dipakai dari beranda dan
/// (nanti) dari widget layar utama, sehingga widget tidak pernah mengirim
/// panic tanpa konfirmasi.
class PanicConfirmPage extends ConsumerStatefulWidget {
  const PanicConfirmPage({super.key, this.initialKind = 'panic'});

  final String initialKind;

  @override
  ConsumerState<PanicConfirmPage> createState() => _PanicConfirmPageState();
}

class _PanicConfirmPageState extends ConsumerState<PanicConfirmPage> {
  late AlertKind _kind = alertKindFor(widget.initialKind);
  bool _sending = false;

  Future<void> _send() async {
    if (_sending) return;
    setState(() => _sending = true);

    try {
      final json = await ref.read(apiProvider).post('alerts', body: {
        'kind': _kind.value,
        'houseId': ref.read(sessionProvider).membership?.houseId,
      });
      if (!mounted) return;
      context.go('/panic/${json['id']}');
    } catch (error) {
      if (!mounted) return;
      setState(() => _sending = false);
      await showDialog<void>(
        context: context,
        builder: (dialogContext) => AlertDialog(
          title: const Text('Sinyal gagal terkirim'),
          content: Text(errorMessage(error)),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext),
              child: const Text('Tutup'),
            ),
            FilledButton(
              onPressed: () {
                Navigator.pop(dialogContext);
                _send();
              },
              child: const Text('Coba lagi'),
            ),
          ],
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: WargaColors.brand900,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        foregroundColor: Colors.white,
        title: const Text('Kirim sinyal darurat'),
        titleTextStyle: WargaTypography.h1.copyWith(color: Colors.white),
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
          children: [
            Text(
              'Pilih jenis bantuan, lalu tahan tombol selama 1,5 detik.',
              style: WargaTypography.caption.copyWith(color: Colors.white70),
            ),
            const SizedBox(height: 16),
            for (final kind in alertKinds) ...[
              _KindTile(
                kind: kind,
                selected: _kind.value == kind.value,
                onTap: () => setState(() => _kind = kind),
              ),
              const SizedBox(height: 8),
            ],
            const SizedBox(height: 16),
            Center(
              child: PanicButton(
                size: 200,
                label: 'KIRIM',
                sublabel: _kind.label,
                onTriggered: _send,
              ),
            ),
            const SizedBox(height: 12),
            Center(
              child: Text(
                _sending ? 'Mengirim sinyal…' : _kind.description,
                style: WargaTypography.caption.copyWith(color: Colors.white70),
                textAlign: TextAlign.center,
              ),
            ),
            const SizedBox(height: 16),
            Center(
              child: TextButton(
                onPressed: () => context.go('/'),
                child: Text(
                  'Batal',
                  style: WargaTypography.bodyStrong.copyWith(color: Colors.white70),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _KindTile extends StatelessWidget {
  const _KindTile({required this.kind, required this.selected, required this.onTap});

  final AlertKind kind;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(WargaRadii.md),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          color: selected ? Colors.white : Colors.white.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(WargaRadii.md),
          border: Border.all(color: Colors.white24),
        ),
        child: Row(
          children: [
            Icon(
              kind.icon,
              size: 20,
              color: selected ? WargaColors.brand900 : Colors.white,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                kind.label,
                style: WargaTypography.bodyStrong.copyWith(
                  color: selected ? WargaColors.brand900 : Colors.white,
                ),
              ),
            ),
            if (selected)
              const Icon(Icons.check_circle, size: 20, color: WargaColors.brand600),
          ],
        ),
      ),
    );
  }
}
