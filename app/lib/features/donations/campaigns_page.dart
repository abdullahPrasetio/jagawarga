import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api_client.dart';
import '../../core/format.dart';
import '../../core/models.dart';
import '../../core/theme.dart';
import '../../core/widgets.dart';

class CampaignsPage extends ConsumerStatefulWidget {
  const CampaignsPage({super.key});

  @override
  ConsumerState<CampaignsPage> createState() => _CampaignsPageState();
}

class _CampaignsPageState extends ConsumerState<CampaignsPage> {
  List<Campaign> _items = const [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final json = await ref.read(apiProvider).get('campaigns');
      if (!mounted) return;
      setState(() => _items = listOf(json, 'items', Campaign.fromJson));
    } catch (_) {
      // daftar kosong
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Donasi')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: _items.isEmpty
                  ? ListView(
                      children: const [
                        EmptyState(
                          icon: Icons.volunteer_activism_outlined,
                          title: 'Belum ada kampanye',
                          caption: 'Kampanye donasi dari pengurus akan tampil di sini.',
                        ),
                      ],
                    )
                  : ListView.separated(
                      padding: const EdgeInsets.all(16),
                      itemCount: _items.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 8),
                      itemBuilder: (context, index) {
                        final item = _items[index];
                        return AppCard(
                          onTap: () => context.push('/donasi/${item.id}'),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Expanded(child: Text(item.title, style: WargaTypography.h3)),
                                  StatusPill(item.status),
                                ],
                              ),
                              const SizedBox(height: 8),
                              ClipRRect(
                                borderRadius: BorderRadius.circular(WargaRadii.pill),
                                child: LinearProgressIndicator(
                                  value: item.progress,
                                  minHeight: 8,
                                  backgroundColor: WargaColors.neutral100,
                                ),
                              ),
                              const SizedBox(height: 8),
                              Row(
                                children: [
                                  MoneyText(item.collectedAmount, style: WargaTypography.bodyStrong),
                                  Text(
                                    ' dari ${formatRupiah(item.targetAmount)}',
                                    style: WargaTypography.caption.copyWith(color: WargaColors.inkMuted),
                                  ),
                                  const Spacer(),
                                  Text(
                                    '${item.donorCount} donatur',
                                    style: WargaTypography.caption.copyWith(color: WargaColors.inkMuted),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        );
                      },
                    ),
            ),
    );
  }
}
