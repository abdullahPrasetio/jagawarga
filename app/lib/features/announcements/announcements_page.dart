import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api_client.dart';
import '../../core/format.dart';
import '../../core/models.dart';
import '../../core/session.dart';
import '../../core/theme.dart';
import '../../core/widgets.dart';

class AnnouncementsPage extends ConsumerStatefulWidget {
  const AnnouncementsPage({super.key});

  @override
  ConsumerState<AnnouncementsPage> createState() => _AnnouncementsPageState();
}

class _AnnouncementsPageState extends ConsumerState<AnnouncementsPage> {
  List<Announcement> _items = const [];
  String? _category;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final json = await ref.read(apiProvider).get('announcements', query: {
        'limit': 50,
        if (_category != null) 'category': _category,
      });
      if (!mounted) return;
      setState(() {
        _items = listOf(json, 'items', Announcement.fromJson);
        _error = null;
      });
    } catch (error) {
      if (mounted) setState(() => _error = errorMessage(error));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    const categories = ['umum', 'keamanan', 'kegiatan', 'darurat'];

    return Scaffold(
      appBar: AppBar(title: const Text('Pengumuman')),
      body: Column(
        children: [
          SizedBox(
            height: 44,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              children: [
                Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: ChoiceChip(
                    label: const Text('Semua'),
                    selected: _category == null,
                    onSelected: (_) {
                      setState(() => _category = null);
                      _load();
                    },
                  ),
                ),
                for (final category in categories)
                  Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: ChoiceChip(
                      label: Text(category),
                      selected: _category == category,
                      onSelected: (_) {
                        setState(() => _category = category);
                        _load();
                      },
                    ),
                  ),
              ],
            ),
          ),
          if (_loading) const LinearProgressIndicator(minHeight: 2),
          if (_error != null) Padding(padding: const EdgeInsets.all(16), child: InlineError(_error!)),
          Expanded(
            child: RefreshIndicator(
              onRefresh: _load,
              child: _items.isEmpty && !_loading
                  ? ListView(
                      children: const [
                        EmptyState(
                          icon: Icons.campaign_outlined,
                          title: 'Belum ada pengumuman',
                          caption: 'Pengumuman dari pengurus akan tampil di sini.',
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
                          padding: const EdgeInsets.all(16),
                          onTap: () => context.push('/pengumuman/${item.id}'),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  if (item.isPinned)
                                    const Padding(
                                      padding: EdgeInsets.only(right: 6),
                                      child: Icon(Icons.push_pin, size: 14, color: WargaColors.brand600),
                                    ),
                                  Expanded(child: Text(item.title, style: WargaTypography.h3)),
                                ],
                              ),
                              const SizedBox(height: 4),
                              Text(
                                '${item.category} · ${relativeTime(item.publishedAt ?? item.createdAt)}',
                                style: WargaTypography.caption.copyWith(color: WargaColors.inkMuted),
                              ),
                              const SizedBox(height: 8),
                              Text(
                                item.body,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: WargaTypography.body,
                              ),
                            ],
                          ),
                        );
                      },
                    ),
            ),
          ),
        ],
      ),
    );
  }
}
