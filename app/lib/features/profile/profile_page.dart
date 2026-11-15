import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api_client.dart';
import '../../core/push.dart';
import '../../core/widget_service.dart';
import '../../core/session.dart';
import '../../core/theme.dart';
import '../../core/widgets.dart';

class ProfilePage extends ConsumerStatefulWidget {
  const ProfilePage({super.key});

  @override
  ConsumerState<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends ConsumerState<ProfilePage> {
  @override
  Widget build(BuildContext context) {
    final session = ref.watch(sessionProvider);
    final me = session.me;
    final membership = session.membership;

    return Scaffold(
      appBar: AppBar(title: const Text('Profil')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          AppCard(
            child: Row(
              children: [
                AvatarCircle(me?.name ?? 'Warga', size: 56),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(me?.name ?? '-', style: WargaTypography.h2),
                      const SizedBox(height: 2),
                      Text(
                        '${membership?.houseLabel ?? 'Tanpa unit'} · ${membership?.role ?? ''}',
                        style: WargaTypography.caption.copyWith(color: WargaColors.inkMuted),
                      ),
                      if (me?.bio != null && me!.bio!.isNotEmpty) ...[
                        const SizedBox(height: 6),
                        Text(me.bio!, style: WargaTypography.caption),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          AppCard(
            padding: EdgeInsets.zero,
            child: Column(
              children: [
                ListTile(
                  leading: const Icon(Icons.home_outlined),
                  title: const Text('Rumah saya'),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => context.push('/rumah'),
                ),
                const Divider(height: 1),
                ListTile(
                  leading: const Icon(Icons.volunteer_activism_outlined),
                  title: const Text('Donasi warga'),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => context.push('/donasi'),
                ),
                const Divider(height: 1),
                ListTile(
                  leading: const Icon(Icons.campaign_outlined),
                  title: const Text('Pengumuman'),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => context.push('/pengumuman'),
                ),
                const Divider(height: 1),
                ListTile(
                  leading: const Icon(Icons.notifications_none),
                  title: const Text('Notifikasi'),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => context.push('/notifikasi'),
                ),
                const Divider(height: 1),
                ListTile(
                  leading: const Icon(Icons.edit_outlined),
                  title: const Text('Ubah profil'),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => _editSheet(),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          OutlinedButton(
            style: OutlinedButton.styleFrom(foregroundColor: WargaColors.danger700),
            onPressed: () async {
              final communityId = ref.read(sessionProvider).membership?.communityId;
              if (communityId != null) await PushService.unsubscribe(communityId);
              await WidgetService.markLoggedOut();
              await ref.read(sessionProvider.notifier).logout();
            },
            child: const Text('Keluar'),
          ),
        ],
      ),
    );
  }

  Future<void> _editSheet() async {
    final session = ref.read(sessionProvider);
    final me = session.me;
    if (me == null) return;

    final nameController = TextEditingController(text: me.name);
    final bioController = TextEditingController(text: me.bio ?? '');
    final interestController = TextEditingController();
    final interests = [...me.interests];
    var directoryVisible = me.directoryVisible;
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
          child: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text('Ubah profil', style: WargaTypography.h2),
                const SizedBox(height: 16),
                TextField(
                  controller: nameController,
                  decoration: const InputDecoration(labelText: 'Nama'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: bioController,
                  maxLines: 2,
                  decoration: const InputDecoration(labelText: 'Bio singkat'),
                ),
                const SizedBox(height: 12),
                Text('Minat / hobi', style: WargaTypography.label),
                const SizedBox(height: 6),
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: [
                    for (final interest in interests)
                      Chip(
                        label: Text(interest),
                        onDeleted: () => setSheetState(() => interests.remove(interest)),
                      ),
                  ],
                ),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: interestController,
                        decoration: const InputDecoration(hintText: 'Futsal, Musik, …'),
                      ),
                    ),
                    IconButton(
                      onPressed: () {
                        final value = interestController.text.trim();
                        if (value.length >= 2 && !interests.contains(value)) {
                          setSheetState(() => interests.add(value));
                          interestController.clear();
                        }
                      },
                      icon: const Icon(Icons.add),
                    ),
                  ],
                ),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  value: directoryVisible,
                  onChanged: (value) => setSheetState(() => directoryVisible = value),
                  title: const Text('Tampil di direktori warga'),
                ),
                const SizedBox(height: 8),
                FilledButton(
                  onPressed: busy
                      ? null
                      : () async {
                          setSheetState(() => busy = true);
                          try {
                            await ref.read(apiProvider).patch('auth/me/profile', body: {
                              'name': nameController.text.trim(),
                              'bio': bioController.text.trim(),
                              'interests': interests,
                              'directoryVisible': directoryVisible,
                            });
                            ref.read(sessionProvider.notifier).patchProfile(
                                  name: nameController.text.trim(),
                                  bio: bioController.text.trim(),
                                  interests: interests,
                                  directoryVisible: directoryVisible,
                                );
                            if (sheetContext.mounted) Navigator.of(sheetContext).pop();
                          } catch (error) {
                            if (sheetContext.mounted) {
                              ScaffoldMessenger.of(sheetContext).showSnackBar(
                                SnackBar(content: Text(errorMessage(error))),
                              );
                              setSheetState(() => busy = false);
                            }
                          }
                        },
                  child: const Text('Simpan'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
