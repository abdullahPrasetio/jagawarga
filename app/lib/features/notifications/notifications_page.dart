import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api_client.dart';
import '../../core/format.dart';
import '../../core/models.dart';
import '../../core/theme.dart';
import '../../core/widgets.dart';

class NotificationsPage extends ConsumerStatefulWidget {
  const NotificationsPage({super.key});

  @override
  ConsumerState<NotificationsPage> createState() => _NotificationsPageState();
}

class _NotificationsPageState extends ConsumerState<NotificationsPage> {
  List<NotificationItem> _items = const [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final json = await ref.read(apiProvider).get('notifications', query: {'limit': 50});
      if (!mounted) return;
      setState(() => _items = listOf(json, 'items', NotificationItem.fromJson));
    } catch (_) {
      // biarkan daftar kosong; pengguna bisa tarik untuk memuat ulang
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _open(NotificationItem item) async {
    if (item.isUnread) {
      try {
        await ref.read(apiProvider).post('notifications/${item.id}/read');
        setState(() {
          _items = _items
              .map((entry) => entry.id == item.id
                  ? NotificationItem(
                      id: entry.id,
                      type: entry.type,
                      title: entry.title,
                      body: entry.body,
                      createdAt: entry.createdAt,
                      data: entry.data,
                      readAt: DateTime.now().toIso8601String(),
                    )
                  : entry)
              .toList();
        });
      } catch (_) {
        // abaikan: navigasi tetap dilakukan
      }
    }

    if (!mounted) return;
    final alertId = item.data['alertId'] as String?;
    if (item.type == 'panic' && alertId != null) {
      context.push('/panic/$alertId');
      return;
    }
    final announcementId = item.data['announcementId'] as String?;
    if (announcementId != null) context.push('/pengumuman/$announcementId');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Notifikasi')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: _items.isEmpty
                  ? ListView(
                      children: const [
                        EmptyState(
                          icon: Icons.notifications_none,
                          title: 'Belum ada notifikasi',
                          caption: 'Sinyal darurat dan pengumuman baru akan muncul di sini.',
                        ),
                      ],
                    )
                  : ListView.separated(
                      itemCount: _items.length,
                      separatorBuilder: (_, __) => const Divider(height: 1),
                      itemBuilder: (context, index) {
                        final item = _items[index];
                        final icon = switch (item.type) {
                          'panic' => Icons.warning_amber_rounded,
                          'announcement' => Icons.campaign_outlined,
                          _ => Icons.info_outline,
                        };
                        final color = item.type == 'panic' ? WargaColors.danger600 : WargaColors.brand600;

                        return Container(
                          color: item.isUnread ? WargaColors.brand100.withValues(alpha: 0.4) : null,
                          child: ListTile(
                            onTap: () => _open(item),
                            leading: Icon(icon, color: color),
                            title: Text(item.title, style: WargaTypography.bodyStrong),
                            subtitle: Text(
                              item.body,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: WargaTypography.caption.copyWith(color: WargaColors.inkMuted),
                            ),
                            trailing: Text(
                              relativeTime(item.createdAt),
                              style: WargaTypography.caption.copyWith(color: WargaColors.inkMuted),
                            ),
                          ),
                        );
                      },
                    ),
            ),
    );
  }
}
