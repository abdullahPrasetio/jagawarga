import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../core/api_client.dart';
import '../../core/format.dart';
import '../../core/models.dart';
import '../../core/session.dart';
import '../../core/theme.dart';
import '../../core/widgets.dart';

class CampaignDetailPage extends ConsumerStatefulWidget {
  const CampaignDetailPage({super.key, required this.id});

  final String id;

  @override
  ConsumerState<CampaignDetailPage> createState() => _CampaignDetailPageState();
}

class _CampaignDetailPageState extends ConsumerState<CampaignDetailPage> {
  Campaign? _campaign;
  List<Donation> _donations = const [];
  String? _error;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final json = await ref.read(apiProvider).get('campaigns/${widget.id}');
      if (!mounted) return;
      setState(() {
        _campaign = Campaign.fromJson(json);
        _donations = listOf(json, 'donations', Donation.fromJson);
        _error = null;
      });
    } catch (error) {
      if (mounted) setState(() => _error = errorMessage(error));
    }
  }

  @override
  Widget build(BuildContext context) {
    final campaign = _campaign;

    return Scaffold(
      appBar: AppBar(title: const Text('Donasi')),
      body: campaign == null
          ? Center(child: _error != null ? InlineError(_error!) : const CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Text(campaign.title, style: WargaTypography.h1),
                const SizedBox(height: 4),
                Text(
                  campaign.deadline == null
                      ? 'Tanpa batas waktu'
                      : 'Berakhir ${formatDate(campaign.deadline!)}',
                  style: WargaTypography.caption.copyWith(color: WargaColors.inkMuted),
                ),
                const SizedBox(height: 16),
                AppCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      ClipRRect(
                        borderRadius: BorderRadius.circular(WargaRadii.pill),
                        child: LinearProgressIndicator(
                          value: campaign.progress,
                          minHeight: 10,
                          backgroundColor: WargaColors.neutral100,
                        ),
                      ),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          MoneyText(campaign.collectedAmount, style: WargaTypography.h2),
                          Text(
                            ' dari ${formatRupiah(campaign.targetAmount)}',
                            style: WargaTypography.caption.copyWith(color: WargaColors.inkMuted),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '${campaign.donorCount} donatur terverifikasi',
                        style: WargaTypography.caption.copyWith(color: WargaColors.inkMuted),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                Text(campaign.description, style: WargaTypography.body.copyWith(height: 1.6)),
                const SizedBox(height: 24),
                FilledButton(
                  onPressed: campaign.status == 'open' && !_busy ? _donateSheet : null,
                  child: Text(campaign.status == 'open' ? 'Saya ingin berdonasi' : 'Kampanye ditutup'),
                ),
                const SizedBox(height: 24),
                SectionHeader(title: 'Donatur'),
                const SizedBox(height: 8),
                if (_donations.isEmpty)
                  Text(
                    'Belum ada donasi terverifikasi.',
                    style: WargaTypography.caption.copyWith(color: WargaColors.inkMuted),
                  )
                else
                  for (final donation in _donations)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 6),
                      child: Row(
                        children: [
                          AvatarCircle(donation.donorName, size: 32),
                          const SizedBox(width: 12),
                          Expanded(child: Text(donation.donorName, style: WargaTypography.bodyStrong)),
                          MoneyText(donation.amount, style: WargaTypography.bodyStrong),
                        ],
                      ),
                    ),
              ],
            ),
    );
  }

  Future<void> _donateSheet() async {
    final api = ref.read(apiProvider);
    final amountController = TextEditingController();
    final nameController = TextEditingController();
    File? file;
    var anonymous = false;
    var busy = false;

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (sheetContext) => StatefulBuilder(
        builder: (context, setSheetState) => Padding(
          padding: EdgeInsets.fromLTRB(
            20,
            8,
            20,
            MediaQuery.of(sheetContext).viewInsets.bottom + 24,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Lapor donasi', style: WargaTypography.h2),
              const SizedBox(height: 16),
              Text('Nominal', style: WargaTypography.label),
              const SizedBox(height: 6),
              TextField(
                controller: amountController,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(prefixText: 'Rp ', hintText: '100000'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: nameController,
                decoration: const InputDecoration(labelText: 'Nama donatur (opsional)'),
              ),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                value: anonymous,
                onChanged: (value) => setSheetState(() => anonymous = value),
                title: const Text('Sembunyikan nama saya'),
              ),
              OutlinedButton.icon(
                onPressed: () async {
                  final picked = await ImagePicker().pickImage(
                    source: ImageSource.gallery,
                    imageQuality: 60,
                    maxWidth: 1280,
                  );
                  if (picked != null) setSheetState(() => file = File(picked.path));
                },
                icon: const Icon(Icons.image_outlined),
                label: Text(file == null ? 'Tambah bukti transfer' : 'Ganti bukti'),
              ),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: busy
                    ? null
                    : () async {
                        final amount = int.tryParse(amountController.text.replaceAll(RegExp(r'\D'), ''));
                        if (amount == null || amount <= 0) {
                          ScaffoldMessenger.of(sheetContext)
                              .showSnackBar(const SnackBar(content: Text('Nominal belum valid')));
                          return;
                        }

                        setSheetState(() => busy = true);
                        try {
                          if (file == null) {
                            await api.post('campaigns/${widget.id}/donations', body: {
                              'amount': amount,
                              if (nameController.text.trim().isNotEmpty)
                                'donorName': nameController.text.trim(),
                              'isAnonymous': anonymous,
                            });
                          } else {
                            await api.upload(
                              'campaigns/${widget.id}/donations',
                              filePath: file!.path,
                              fields: {
                                'amount': '$amount',
                                if (nameController.text.trim().isNotEmpty)
                                  'donorName': nameController.text.trim(),
                                'isAnonymous': '$anonymous',
                              },
                            );
                          }
                          if (sheetContext.mounted) Navigator.of(sheetContext).pop();
                          await _load();
                        } catch (error) {
                          if (sheetContext.mounted) {
                            ScaffoldMessenger.of(sheetContext)
                                .showSnackBar(SnackBar(content: Text(errorMessage(error))));
                            setSheetState(() => busy = false);
                          }
                        }
                      },
                child: busy
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                      )
                    : const Text('Kirim untuk diverifikasi'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
