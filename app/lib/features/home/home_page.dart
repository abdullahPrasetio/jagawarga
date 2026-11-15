import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:geolocator/geolocator.dart';

import '../../core/api_client.dart';
import '../../core/events.dart';
import '../../core/format.dart';
import '../../core/widget_service.dart';
import '../../core/models.dart';
import '../../core/session.dart';
import '../../core/theme.dart';
import '../../core/widgets.dart';
import '../panic/alert_kinds.dart';
import '../panic/alert_status.dart';
import '../panic/panic_button.dart';
import '../panic/panic_page.dart' show callNumber;

class HomePage extends ConsumerStatefulWidget {
  const HomePage({super.key});

  @override
  ConsumerState<HomePage> createState() => _HomePageState();
}

class _HomePageState extends ConsumerState<HomePage> {
  List<AlertItem> _activeAlerts = const [];
  List<Announcement> _announcements = const [];
  Summary? _summary;
  int _unread = 0;
  bool _loading = true;
  StreamSubscription<AppEvent>? _events;

  @override
  void initState() {
    super.initState();
    _load();
    _events = ref.read(eventsProvider).stream.listen((event) {
      if (event.name.startsWith('panic') || event.name.startsWith('announcement')) _load(silent: true);
    });
  }

  @override
  void dispose() {
    _events?.cancel();
    super.dispose();
  }

  Future<void> _load({bool silent = false}) async {
    final api = ref.read(apiProvider);
    try {
      final results = await Future.wait([
        api.get('alerts/active'),
        api.get('announcements', query: {'limit': 3}),
        api.get('finance/summary'),
        api.get('notifications/unread-count'),
        api.get('finance/invoices'),
      ]);

      if (!mounted) return;

      final invoices = listOf(results[4], 'items', Invoice.fromJson);
      final unpaid = invoices.where((invoice) => invoice.status != 'paid').toList();
      final unpaidTotal = unpaid.fold<int>(0, (total, invoice) => total + invoice.remaining);

      setState(() {
        _activeAlerts = listOf(results[0], 'items', AlertItem.fromJson);
        _announcements = listOf(results[1], 'items', Announcement.fromJson);
        _summary = Summary.fromJson(results[2]);
        _unread = (results[3]['count'] as num?)?.toInt() ?? 0;
        _loading = false;
      });

      await _syncWidget(unpaid.length, unpaidTotal);
    } catch (_) {
      if (mounted) setState(() => _loading = false);
      if (!silent && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Gagal memuat beranda')),
        );
      }
    }
  }

  Future<void> _syncWidget(int unpaidCount, int unpaidTotal) async {
    final session = ref.read(sessionProvider);
    final membership = session.membership;
    if (membership == null) return;

    final alert = _activeAlerts.isEmpty ? null : _activeAlerts.first;

    await WidgetService.sync(
      hasActiveAlert: alert != null,
      houseLabel: membership.houseLabel ?? membership.communityName,
      communityName: membership.communityName,
      alertHouse: alert?.houseLabel,
      alertKind: alert?.kind,
      announcement: _announcements.isEmpty ? null : _announcements.first.title,
      unpaidCount: unpaidCount,
      unpaidTotal: unpaidTotal,
      updatedLabel: formatClock(DateTime.now()),
    );
  }

  Future<void> _triggerPanic() async {
    final api = ref.read(apiProvider);
    final membership = ref.read(sessionProvider).membership;

    double? lat;
    double? lng;
    try {
      final position = await Geolocator.getCurrentPosition().timeout(const Duration(seconds: 3));
      lat = position.latitude;
      lng = position.longitude;
    } catch (_) {
      // GPS opsional: sinyal tetap dikirim tanpa koordinat.
    }

    try {
      final json = await api.post('alerts', body: {
        'houseId': membership?.houseId,
        if (lat != null) 'lat': lat,
        if (lng != null) 'lng': lng,
      });
      if (!mounted) return;
      await _load(silent: true);
      if (mounted) context.go('/panic/${json['id']}');
    } catch (error) {
      if (mounted) await _failureDialog(errorMessage(error));
    }
  }

  Future<void> _failureDialog(String message) async {
    List<Map<String, dynamic>> staff = const [];
    try {
      final json = await ref.read(apiProvider).get('community/staff');
      staff = ((json['items'] as List?) ?? const []).cast<Map<String, dynamic>>();
    } catch (_) {
      // daftar kontak tidak wajib ada
    }

    if (!mounted) return;

    await showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Sinyal gagal terkirim'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(message, style: WargaTypography.caption),
            const SizedBox(height: 12),
            const Text(
              'Telepon pengurus atau satpam sekarang:',
              style: TextStyle(fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 8),
            for (final person in staff.take(4))
              ListTile(
                dense: true,
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.call, color: WargaColors.danger600),
                title: Text(person['name'] as String? ?? ''),
                subtitle: Text('${person['role']} · ${person['phone'] ?? ''}'),
                onTap: () => callNumber(person['phone'] as String? ?? ''),
              ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialogContext), child: const Text('Tutup')),
          FilledButton(
            onPressed: () {
              Navigator.pop(dialogContext);
              _triggerPanic();
            },
            child: const Text('Coba lagi'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(sessionProvider);
    final membership = session.membership;

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Halo, ${session.me?.name.split(' ').first ?? 'warga'}'),
            Text(
              membership?.houseLabel ?? 'Tanpa unit',
              style: WargaTypography.caption.copyWith(color: WargaColors.inkMuted),
            ),
          ],
        ),
        actions: [
          IconButton(
            onPressed: () => context.push('/notifikasi'),
            icon: Badge(
              isLabelVisible: _unread > 0,
              label: Text('$_unread'),
              child: const Icon(Icons.notifications_none),
            ),
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
          children: [
            if (_loading) const LinearProgressIndicator(minHeight: 2),
            for (final alert in _activeAlerts) ...[
              _ActiveAlertBanner(alert: alert),
              const SizedBox(height: 12),
            ],
            _PanicCard(onTriggered: _triggerPanic),
            const SizedBox(height: 24),
            SectionHeader(title: 'Bantuan cepat'),
            const SizedBox(height: 8),
            AppCard(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Column(
                children: [
                  for (final kind in alertKinds.where((kind) => kind.value != 'panic'))
                    ListTile(
                      leading: Icon(kind.icon, color: WargaColors.inkMuted),
                      title: Text(kind.label, style: WargaTypography.bodyStrong),
                      subtitle: Text(
                        kind.description,
                        style: WargaTypography.caption.copyWith(color: WargaColors.inkMuted),
                      ),
                      trailing: const Icon(Icons.chevron_right, size: 20),
                      onTap: () => context.push('/panic/confirm?type=${kind.value}'),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 24),
            SectionHeader(title: 'Kas warga', actionLabel: 'Lihat', onAction: () => context.go('/keuangan')),
            const SizedBox(height: 8),
            AppCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('SALDO', style: WargaTypography.label.copyWith(color: WargaColors.inkMuted)),
                  const SizedBox(height: 4),
                  MoneyText(_summary?.closing ?? 0, style: WargaTypography.display),
                  const SizedBox(height: 4),
                  Text(
                    _summary == null
                        ? 'Memuat…'
                        : 'Masuk ${formatRupiah(_summary!.income)} · Keluar ${formatRupiah(_summary!.expense)}',
                    style: WargaTypography.caption.copyWith(color: WargaColors.inkMuted),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
            SectionHeader(
              title: 'Pengumuman',
              actionLabel: 'Semua',
              onAction: () => context.push('/pengumuman'),
            ),
            const SizedBox(height: 8),
            if (_announcements.isEmpty)
              const EmptyState(
                icon: Icons.campaign_outlined,
                title: 'Belum ada pengumuman',
                caption: 'Pengumuman dari pengurus akan muncul di sini.',
              )
            else
              for (final item in _announcements) ...[
                AppCard(
                  padding: const EdgeInsets.all(16),
                  onTap: () => context.push('/pengumuman/${item.id}'),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          if (item.isPinned) ...[
                            const Icon(Icons.push_pin, size: 14, color: WargaColors.brand600),
                            const SizedBox(width: 4),
                          ],
                          Expanded(child: Text(item.title, style: WargaTypography.h3)),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '${item.category} · ${relativeTime(item.publishedAt ?? item.createdAt)}',
                        style: WargaTypography.caption.copyWith(color: WargaColors.inkMuted),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 8),
              ],
          ],
        ),
      ),
    );
  }
}

class _PanicCard extends StatelessWidget {
  const _PanicCard({required this.onTriggered});

  final Future<void> Function() onTriggered;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: WargaColors.brand900,
        borderRadius: BorderRadius.circular(WargaRadii.xl),
      ),
      child: Column(
        children: [
          Align(
            alignment: Alignment.centerLeft,
            child: Text('Panic Button', style: WargaTypography.h2.copyWith(color: Colors.white)),
          ),
          const SizedBox(height: 4),
          Align(
            alignment: Alignment.centerLeft,
            child: Text(
              'Kirim sinyal darurat ke seluruh warga.',
              style: WargaTypography.caption.copyWith(color: Colors.white70),
            ),
          ),
          const SizedBox(height: 20),
          PanicButton(onTriggered: onTriggered, size: 192),
          const SizedBox(height: 12),
          Text(
            'Tahan 1,5 detik untuk mengirim sinyal',
            style: WargaTypography.caption.copyWith(color: Colors.white60),
          ),
        ],
      ),
    );
  }
}

class _ActiveAlertBanner extends StatelessWidget {
  const _ActiveAlertBanner({required this.alert});

  final AlertItem alert;

  @override
  Widget build(BuildContext context) {
    final view = alertStatusView(alert);

    return InkWell(
      onTap: () => context.push('/panic/${alert.id}'),
      borderRadius: BorderRadius.circular(WargaRadii.lg),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: WargaColors.danger100,
          borderRadius: BorderRadius.circular(WargaRadii.lg),
        ),
        child: Row(
          children: [
            const Icon(Icons.warning_amber_rounded, color: WargaColors.danger700),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '${view.badgeLabel} — ${alert.houseLabel ?? 'Tanpa unit'}',
                    style: WargaTypography.h3.copyWith(color: WargaColors.danger700),
                  ),
                  Text(
                    '${view.title} · ${relativeTime(alert.createdAt)}',
                    style: WargaTypography.caption.copyWith(color: WargaColors.danger700),
                  ),
                ],
              ),
            ),
            TextButton(
              onPressed: () => context.push('/panic/${alert.id}'),
              child: const Text('Lihat'),
            ),
          ],
        ),
      ),
    );
  }
}
