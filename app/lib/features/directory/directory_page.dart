import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/api_client.dart';
import '../../core/models.dart';
import '../../core/theme.dart';
import '../../core/widgets.dart';

class DirectoryPage extends ConsumerStatefulWidget {
  const DirectoryPage({super.key});

  @override
  ConsumerState<DirectoryPage> createState() => _DirectoryPageState();
}

class _DirectoryPageState extends ConsumerState<DirectoryPage> {
  final _search = TextEditingController();
  List<DirectoryEntry> _entries = const [];
  String? _interest;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final json = await ref.read(apiProvider).get('directory', query: {
        if (_search.text.trim().isNotEmpty) 'q': _search.text.trim(),
        if (_interest != null) 'interest': _interest,
      });
      if (!mounted) return;
      setState(() => _entries = listOf(json, 'items', DirectoryEntry.fromJson));
    } catch (_) {
      // daftar kosong
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final interests = _entries.expand((entry) => entry.interests).toSet().toList()..sort();

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Warga'),
            Text(
              '${_entries.length} anggota',
              style: WargaTypography.caption.copyWith(color: WargaColors.inkMuted),
            ),
          ],
        ),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
            child: TextField(
              controller: _search,
              textInputAction: TextInputAction.search,
              onSubmitted: (_) => _load(),
              decoration: InputDecoration(
                hintText: 'Cari nama atau blok',
                prefixIcon: const Icon(Icons.search),
                suffixIcon: IconButton(icon: const Icon(Icons.refresh), onPressed: _load),
              ),
            ),
          ),
          SizedBox(
            height: 52,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              children: [
                Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: ChoiceChip(
                    label: const Text('Semua'),
                    selected: _interest == null,
                    onSelected: (_) {
                      setState(() => _interest = null);
                      _load();
                    },
                  ),
                ),
                for (final interest in interests)
                  Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: ChoiceChip(
                      label: Text(interest),
                      selected: _interest == interest,
                      onSelected: (_) {
                        setState(() => _interest = interest);
                        _load();
                      },
                    ),
                  ),
              ],
            ),
          ),
          if (_loading) const LinearProgressIndicator(minHeight: 2),
          Expanded(
            child: RefreshIndicator(
              onRefresh: _load,
              child: _entries.isEmpty && !_loading
                  ? ListView(
                      children: const [
                        EmptyState(
                          icon: Icons.people_outline,
                          title: 'Tidak ada warga yang cocok',
                          caption: 'Coba kata kunci atau minat lain.',
                        ),
                      ],
                    )
                  : ListView.separated(
                      padding: const EdgeInsets.all(16),
                      itemCount: _entries.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 8),
                      itemBuilder: (context, index) {
                        final entry = _entries[index];
                        return AppCard(
                          padding: const EdgeInsets.all(16),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              AvatarCircle(entry.name),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(entry.name, style: WargaTypography.h3),
                                    Text(
                                      entry.houseLabel ?? 'Tanpa unit',
                                      style: WargaTypography.caption
                                          .copyWith(color: WargaColors.inkMuted),
                                    ),
                                    const SizedBox(height: 6),
                                    Wrap(
                                      spacing: 6,
                                      runSpacing: 6,
                                      children: [
                                        for (final interest in entry.interests.take(3))
                                          Container(
                                            padding: const EdgeInsets.symmetric(
                                              horizontal: 8,
                                              vertical: 2,
                                            ),
                                            decoration: BoxDecoration(
                                              color: WargaColors.neutral100,
                                              borderRadius:
                                                  BorderRadius.circular(WargaRadii.pill),
                                            ),
                                            child: Text(
                                              interest,
                                              style: WargaTypography.caption
                                                  .copyWith(color: WargaColors.inkMuted),
                                            ),
                                          ),
                                      ],
                                    ),
                                  ],
                                ),
                              ),
                              if (entry.waNumber != null)
                                IconButton(
                                  onPressed: () => launchUrl(
                                    Uri.parse('https://wa.me/${entry.waNumber}'),
                                    mode: LaunchMode.externalApplication,
                                  ),
                                  icon: const Icon(Icons.chat_outlined, color: WargaColors.brand600),
                                  tooltip: 'WhatsApp',
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
