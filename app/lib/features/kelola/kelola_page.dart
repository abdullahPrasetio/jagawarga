import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api_client.dart';
import '../../core/format.dart';
import '../../core/models.dart';
import '../../core/session.dart';
import '../../core/theme.dart';
import '../../core/widgets.dart';

class KelolaPage extends ConsumerStatefulWidget {
  const KelolaPage({super.key});

  @override
  ConsumerState<KelolaPage> createState() => _KelolaPageState();
}

class _KelolaPageState extends ConsumerState<KelolaPage> with SingleTickerProviderStateMixin {
  late final TabController _tabs = TabController(length: 4, vsync: this);

  List<AlertItem> _alerts = const [];
  List<MemberItem> _members = const [];
  List<Map<String, dynamic>> _invites = const [];
  List<Announcement> _announcements = const [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadAll();
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  Future<void> _loadAll() async {
    final api = ref.read(apiProvider);
    setState(() => _loading = true);

    try {
      final results = await Future.wait([
        api.get('alerts', query: {'limit': 20}),
        api.get('members'),
        api.get('invites'),
        api.get('announcements', query: {'includeDrafts': true, 'limit': 20}),
      ]);

      if (!mounted) return;
      setState(() {
        _alerts = listOf(results[0], 'items', AlertItem.fromJson);
        _members = listOf(results[1], 'items', MemberItem.fromJson);
        _invites = ((results[2]['items'] as List?) ?? const []).cast<Map<String, dynamic>>();
        _announcements = listOf(results[3], 'items', Announcement.fromJson);
      });
    } catch (_) {
      // biarkan tampilan kosong
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Kelola'),
        bottom: TabBar(
          controller: _tabs,
          isScrollable: true,
          tabAlignment: TabAlignment.start,
          tabs: const [
            Tab(text: 'Alert'),
            Tab(text: 'Anggota'),
            Tab(text: 'Undangan'),
            Tab(text: 'Pengumuman'),
          ],
        ),
        actions: [
          IconButton(onPressed: _loadAll, icon: const Icon(Icons.refresh)),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : TabBarView(
              controller: _tabs,
              children: [
                _alertTab(),
                _memberTab(),
                _inviteTab(),
                _announcementTab(),
              ],
            ),
    );
  }

  Widget _alertTab() {
    if (_alerts.isEmpty) {
      return const EmptyState(
        icon: Icons.shield_outlined,
        title: 'Tidak ada alert',
        caption: 'Sinyal darurat warga akan muncul di sini.',
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: _alerts.length,
      separatorBuilder: (_, __) => const SizedBox(height: 8),
      itemBuilder: (context, index) {
        final alert = _alerts[index];

        return AppCard(
          onTap: () => context.push('/panic/${alert.id}'),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(alert.houseLabel ?? 'Tanpa unit', style: WargaTypography.h3),
                  ),
                  StatusPill(alert.status),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                '${alert.triggeredByName} · ${formatDateTime(alert.createdAt)}',
                style: WargaTypography.caption.copyWith(color: WargaColors.inkMuted),
              ),
              if (alert.isOpen) ...[
                const SizedBox(height: 8),
                Row(
                  children: [
                    if (alert.status == 'active')
                      Expanded(
                        child: OutlinedButton(
                          onPressed: () async {
                            await ref.read(apiProvider).post('alerts/${alert.id}/acknowledge');
                            await _loadAll();
                          },
                          child: const Text('Respons'),
                        ),
                      ),
                    if (alert.status == 'acknowledged') ...[
                      Expanded(
                        child: OutlinedButton(
                          onPressed: () async {
                            await ref.read(apiProvider).post('alerts/${alert.id}/resolve', body: {
                              'resolution': 'handled',
                            });
                            await _loadAll();
                          },
                          child: const Text('Selesaikan'),
                        ),
                      ),
                    ],
                  ],
                ),
              ],
            ],
          ),
        );
      },
    );
  }

  Widget _memberTab() {
    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: _members.length,
      separatorBuilder: (_, __) => const Divider(height: 1),
      itemBuilder: (context, index) {
        final member = _members[index];
        return ListTile(
          leading: AvatarCircle(member.name, size: 36),
          title: Text(member.name),
          subtitle: Text('${member.houseLabel ?? 'Tanpa unit'} · ${member.role}'),
          trailing: IconButton(
            icon: const Icon(Icons.copy, size: 18),
            onPressed: () {
              Clipboard.setData(ClipboardData(text: member.phone));
              ScaffoldMessenger.of(context)
                  .showSnackBar(SnackBar(content: Text('${member.phone} disalin')));
            },
          ),
        );
      },
    );
  }

  Widget _inviteTab() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        FilledButton(
          onPressed: () => _createInvite('pengurus'),
          child: const Text('Buat kode undangan staff'),
        ),
        const SizedBox(height: 16),
        for (final invite in _invites)
          AppCard(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        (invite['code'] as String?) ?? '',
                        style: WargaTypography.h3.copyWith(letterSpacing: 2),
                      ),
                      Text(
                        '${invite['role']} · ${invite['usedAt'] == null ? 'belum dipakai' : 'sudah dipakai'}',
                        style: WargaTypography.caption.copyWith(color: WargaColors.inkMuted),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.copy, size: 18),
                  onPressed: () => Clipboard.setData(
                    ClipboardData(text: (invite['code'] as String?) ?? ''),
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }

  Widget _announcementTab() {
    final titleController = TextEditingController();
    final bodyController = TextEditingController();
    var category = 'umum';

    return StatefulBuilder(
      builder: (context, setLocal) => ListView(
        padding: const EdgeInsets.all(16),
        children: [
          TextField(
            controller: titleController,
            decoration: const InputDecoration(labelText: 'Judul'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: bodyController,
            maxLines: 5,
            decoration: const InputDecoration(labelText: 'Isi pengumuman'),
          ),
          const SizedBox(height: 12),
          SegmentedButton<String>(
            segments: const [
              ButtonSegment(value: 'umum', label: Text('Umum')),
              ButtonSegment(value: 'keamanan', label: Text('Keamanan')),
              ButtonSegment(value: 'darurat', label: Text('Darurat')),
            ],
            selected: {category},
            onSelectionChanged: (value) => setLocal(() => category = value.first),
          ),
          const SizedBox(height: 12),
          FilledButton(
            onPressed: () async {
              final api = ref.read(apiProvider);
              try {
                final created = await api.post('announcements', body: {
                  'title': titleController.text.trim(),
                  'body': bodyController.text.trim(),
                  'category': category,
                });
                await api.post('announcements/${created['id']}/publish');
                titleController.clear();
                bodyController.clear();
                await _loadAll();
                if (mounted) {
                  ScaffoldMessenger.of(context)
                      .showSnackBar(const SnackBar(content: Text('Pengumuman terbit')));
                }
              } catch (error) {
                if (mounted) {
                  ScaffoldMessenger.of(context)
                      .showSnackBar(SnackBar(content: Text(errorMessage(error))));
                }
              }
            },
            child: const Text('Terbitkan'),
          ),
          const SizedBox(height: 24),
          SectionHeader(title: 'Riwayat'),
          for (final item in _announcements)
            ListTile(
              contentPadding: EdgeInsets.zero,
              title: Text(item.title),
              subtitle: Text(
                '${item.category} · ${item.publishedAt == null ? 'draf' : relativeTime(item.publishedAt!)}',
              ),
              trailing: IconButton(
                icon: const Icon(Icons.delete_outline, size: 18),
                onPressed: () async {
                  await ref.read(apiProvider).delete('announcements/${item.id}');
                  await _loadAll();
                },
              ),
            ),
        ],
      ),
    );
  }

  Future<void> _createInvite(String role) async {
    try {
      final json = await ref.read(apiProvider).post('invites', body: {'role': role});
      await _loadAll();
      if (!mounted) return;
      await showDialog<void>(
        context: context,
        builder: (dialogContext) => AlertDialog(
          title: const Text('Kode undangan'),
          content: SelectableText(
            json['code'] as String? ?? '',
            style: WargaTypography.h2.copyWith(letterSpacing: 3),
          ),
          actions: [
            TextButton(
              onPressed: () => Clipboard.setData(ClipboardData(text: json['code'] as String? ?? '')),
              child: const Text('Salin'),
            ),
            TextButton(onPressed: () => Navigator.pop(dialogContext), child: const Text('Tutup')),
          ],
        ),
      );
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(errorMessage(error))));
      }
    }
  }
}
