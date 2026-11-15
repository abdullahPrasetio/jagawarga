import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api_client.dart';
import '../../core/config.dart';
import '../../core/format.dart';
import '../../core/models.dart';
import '../../core/session.dart';
import '../../core/theme.dart';
import '../../core/widgets.dart';

class AnnouncementDetailPage extends ConsumerStatefulWidget {
  const AnnouncementDetailPage({super.key, required this.id});

  final String id;

  @override
  ConsumerState<AnnouncementDetailPage> createState() => _AnnouncementDetailPageState();
}

class _AnnouncementDetailPageState extends ConsumerState<AnnouncementDetailPage> {
  Announcement? _item;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final json = await ref.read(apiProvider).get('announcements/${widget.id}');
      if (mounted) setState(() => _item = Announcement.fromJson(json));
    } catch (error) {
      if (mounted) setState(() => _error = errorMessage(error));
    }
  }

  @override
  Widget build(BuildContext context) {
    final token = ref.watch(sessionProvider).accessToken;

    return Scaffold(
      appBar: AppBar(title: const Text('Pengumuman')),
      body: _item == null
          ? Center(child: _error != null ? InlineError(_error!) : const CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Hero(
                  tag: 'announcement-${_item!.id}',
                  child: Text(_item!.title, style: WargaTypography.h1),
                ),
                const SizedBox(height: 8),
                Text(
                  '${_item!.category} · ${_item!.authorName} · ${formatDateTime(_item!.publishedAt ?? _item!.createdAt)}',
                  style: WargaTypography.caption.copyWith(color: WargaColors.inkMuted),
                ),
                if (_item!.attachmentMediaId != null) ...[
                  const SizedBox(height: 16),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(WargaRadii.lg),
                    child: CachedNetworkImage(
                      imageUrl: '${AppConfig.apiBaseUrl}/api/v1/media/${_item!.attachmentMediaId}/raw',
                      httpHeaders: token == null ? null : {'authorization': 'Bearer $token'},
                      fit: BoxFit.cover,
                      placeholder: (_, __) => Container(
                        height: 180,
                        color: WargaColors.neutral100,
                      ),
                      errorWidget: (_, __, ___) => const SizedBox.shrink(),
                    ),
                  ),
                ],
                const SizedBox(height: 16),
                SelectableText(_item!.body, style: WargaTypography.body.copyWith(height: 1.6)),
              ],
            ),
    );
  }
}
