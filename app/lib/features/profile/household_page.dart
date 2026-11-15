import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:share_plus/share_plus.dart';

import '../../core/api_client.dart';
import '../../core/format.dart';
import '../../core/models.dart';
import '../../core/session.dart';
import '../../core/theme.dart';
import '../../core/widgets.dart';

class HouseholdPage extends ConsumerStatefulWidget {
  const HouseholdPage({super.key});

  @override
  ConsumerState<HouseholdPage> createState() => _HouseholdPageState();
}

class _HouseholdPageState extends ConsumerState<HouseholdPage> {
  Household? _household;
  String? _houseLabel;
  bool _isHead = false;
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final membership = ref.read(sessionProvider).membership;
    setState(() => _isHead = membership?.isHouseholdHead ?? false);

    try {
      final json = await ref.read(apiProvider).get('me/household');
      if (!mounted) return;
      setState(() {
        _houseLabel = (json['house'] as Map?)?['label'] as String?;
        _household = Household(
          houseLabel: _houseLabel,
          headName: json['headName'] as String?,
          members: listOf(json, 'members', HouseholdMember.fromJson),
        );
        _error = null;
      });
    } catch (error) {
      if (mounted) setState(() => _error = errorMessage(error));
    }
  }

  @override
  Widget build(BuildContext context) {
    final household = _household;

    return Scaffold(
      appBar: AppBar(title: const Text('Rumah saya')),
      body: household == null
          ? Center(child: _error != null ? InlineError(_error!) : const CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Text(_houseLabel ?? 'Tanpa unit', style: WargaTypography.h1),
                const SizedBox(height: 4),
                Text(
                  household.headName == null
                      ? 'Belum ada kepala keluarga'
                      : 'Kepala keluarga: ${household.headName}',
                  style: WargaTypography.caption.copyWith(color: WargaColors.inkMuted),
                ),
                const SizedBox(height: 16),
                AppCard(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  child: Column(
                    children: [
                      for (final member in household.members)
                        ListTile(
                          leading: AvatarCircle(member.name, size: 36),
                          title: Text(member.name, style: WargaTypography.bodyStrong),
                          subtitle: Text(
                            member.isHouseholdHead ? 'Kepala keluarga' : 'Anggota',
                            style: WargaTypography.caption.copyWith(
                              color: member.isHouseholdHead
                                  ? WargaColors.brand700
                                  : WargaColors.inkMuted,
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
                const SizedBox(height: 24),
                if (_isHead)
                  FilledButton(
                    onPressed: _busy ? null : _invite,
                    child: const Text('Undang anggota keluarga'),
                  ),
                const SizedBox(height: 8),
                Text(
                  'Setiap anggota punya akun sendiri agar sinyal darurat jelas dari siapa. Maksimal 6 anggota per rumah.',
                  style: WargaTypography.caption.copyWith(color: WargaColors.inkMuted),
                ),
              ],
            ),
    );
  }

  Future<void> _invite() async {
    setState(() => _busy = true);
    try {
      final json = await ref.read(apiProvider).post('invites/household');
      if (!mounted) return;
      final code = json['code'] as String;
      final expiresAt = json['expiresAt'] as String;

      await showModalBottomSheet<void>(
        context: context,
        builder: (sheetContext) => Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('Kode undangan keluarga', style: WargaTypography.h2),
              const SizedBox(height: 4),
              Text(
                'Berlaku sampai ${formatDate(expiresAt)} · sekali pakai',
                style: WargaTypography.caption.copyWith(color: WargaColors.inkMuted),
              ),
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.symmetric(vertical: 20),
                decoration: BoxDecoration(
                  color: WargaColors.paper,
                  borderRadius: BorderRadius.circular(WargaRadii.md),
                  border: Border.all(color: WargaColors.line),
                ),
                alignment: Alignment.center,
                child: Text(
                  code,
                  style: WargaTypography.h1.copyWith(letterSpacing: 4),
                ),
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () async {
                        await Clipboard.setData(ClipboardData(text: code));
                        if (sheetContext.mounted) {
                          ScaffoldMessenger.of(sheetContext)
                              .showSnackBar(const SnackBar(content: Text('Kode disalin')));
                        }
                      },
                      child: const Text('Salin'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: FilledButton(
                      onPressed: () => SharePlus.instance.share(
                        ShareParams(
                          text: 'Kode undangan Jaga Warga: $code (berlaku 7 hari, sekali pakai)',
                        ),
                      ),
                      child: const Text('Bagikan'),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      );
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(errorMessage(error))));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }
}
