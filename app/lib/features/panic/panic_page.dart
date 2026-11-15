import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/api_client.dart';
import '../../core/events.dart';
import '../../core/format.dart';
import '../../core/models.dart';
import '../../core/session.dart';
import '../../core/theme.dart';
import '../../core/widgets.dart';
import 'alert_status.dart';

class PanicPage extends ConsumerStatefulWidget {
  const PanicPage({super.key, required this.alertId});

  final String alertId;

  @override
  ConsumerState<PanicPage> createState() => _PanicPageState();
}

class _PanicPageState extends ConsumerState<PanicPage> {
  AlertItem? _alert;
  List<AlertEventItem> _events = const [];
  String? _error;
  Timer? _poll;
  StreamSubscription<AppEvent>? _eventSub;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _load();
    _poll = Timer.periodic(const Duration(seconds: 3), (_) => _load(silent: true));
    _eventSub = ref.read(eventsProvider).stream.listen((event) {
      if (event.name.startsWith('panic')) _load(silent: true);
    });
  }

  @override
  void dispose() {
    _poll?.cancel();
    _eventSub?.cancel();
    super.dispose();
  }

  Future<void> _load({bool silent = false}) async {
    try {
      final json = await ref.read(apiProvider).get('alerts/${widget.alertId}');
      if (!mounted) return;
      setState(() {
        _alert = AlertItem.fromJson(json);
        _events = ((json['events'] as List?) ?? const [])
            .map((item) => AlertEventItem.fromJson((item as Map).cast<String, dynamic>()))
            .toList();
        _error = null;
      });
    } catch (error) {
      if (!silent && mounted) setState(() => _error = errorMessage(error));
    }
  }

  Future<void> _act(Future<void> Function() action) async {
    setState(() => _busy = true);
    try {
      await action();
      await _load(silent: true);
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(errorMessage(error))));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final alert = _alert;
    final session = ref.watch(sessionProvider);
    final api = ref.read(apiProvider);

    if (alert == null) {
      return Scaffold(
        backgroundColor: WargaColors.paper,
        appBar: AppBar(title: const Text('Sinyal darurat')),
        body: Center(
          child: _error != null
              ? Padding(padding: const EdgeInsets.all(24), child: InlineError(_error!))
              : const CircularProgressIndicator(),
        ),
      );
    }

    final view = alertStatusView(alert);
    final danger = view.tone == 'danger';
    final background = danger ? WargaColors.danger600 : WargaColors.brand900;
    final isTrigger = alert.triggeredBy == session.me?.id;
    final canRespond = session.membership?.canRespondAlert ?? false;
    final createdAt = DateTime.tryParse(alert.createdAt)?.toLocal();
    final canCancel = isTrigger &&
        alert.isOpen &&
        createdAt != null &&
        DateTime.now().difference(createdAt).inSeconds <= 10;

    return Scaffold(
      backgroundColor: background,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  IconButton(
                    onPressed: () => context.go('/'),
                    icon: const Icon(Icons.close, color: Colors.white),
                    tooltip: 'Tutup',
                  ),
                  const Spacer(),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: Colors.white24,
                      borderRadius: BorderRadius.circular(WargaRadii.pill),
                    ),
                    child: Text(
                      view.badgeLabel,
                      style: WargaTypography.label.copyWith(color: Colors.white),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 24),
              Text(
                alertHeadline(alert),
                style: WargaTypography.display.copyWith(color: Colors.white),
              ),
              const SizedBox(height: 8),
              Text(
                'Dipicu ${formatDateTime(alert.createdAt)} · ${alert.eventCount} catatan',
                style: WargaTypography.caption.copyWith(color: Colors.white70),
              ),
              const SizedBox(height: 24),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: WargaColors.surface,
                  borderRadius: BorderRadius.circular(WargaRadii.lg),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(view.title, style: WargaTypography.h2),
                    const SizedBox(height: 4),
                    Text(
                      view.caption,
                      style: WargaTypography.caption.copyWith(color: WargaColors.inkMuted),
                    ),
                    if (alert.message != null && alert.message!.isNotEmpty) ...[
                      const SizedBox(height: 12),
                      Text('“${alert.message}”', style: WargaTypography.body),
                    ],
                    const SizedBox(height: 16),
                    for (final event in _events.take(4))
                      Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: Row(
                          children: [
                            const Icon(Icons.circle, size: 8, color: WargaColors.inkMuted),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                '${_eventLabel(event.type)}'
                                '${event.actorName == null ? '' : ' — ${event.actorName}'}',
                                style: WargaTypography.caption,
                              ),
                            ),
                            Text(
                              formatDateTime(event.createdAt),
                              style: WargaTypography.caption.copyWith(color: WargaColors.inkMuted),
                            ),
                          ],
                        ),
                      ),
                  ],
                ),
              ),
              const Spacer(),
              if (canRespond && alert.status == 'active')
                FilledButton(
                  style: FilledButton.styleFrom(
                    backgroundColor: Colors.white,
                    foregroundColor: WargaColors.danger700,
                  ),
                  onPressed: _busy
                      ? null
                      : () => _act(() => api.post('alerts/${alert.id}/acknowledge')),
                  child: const Text('Saya merespons'),
                ),
              if ((canRespond || isTrigger) && alert.isOpen) ...[
                const SizedBox(height: 8),
                OutlinedButton(
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Colors.white,
                    side: const BorderSide(color: Colors.white70),
                  ),
                  onPressed: _busy ? null : () => _resolveSheet(api, alert),
                  child: const Text('Selesaikan'),
                ),
              ],
              if (canCancel) ...[
                const SizedBox(height: 8),
                TextButton(
                  style: TextButton.styleFrom(foregroundColor: Colors.white70),
                  onPressed: _busy
                      ? null
                      : () => _act(() => api.post('alerts/${alert.id}/cancel')),
                  child: const Text('Batalkan sinyal'),
                ),
              ],
              const SizedBox(height: 8),
              Center(
                child: Text(
                  'Timeline tersimpan otomatis.',
                  style: WargaTypography.caption.copyWith(color: Colors.white70),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _eventLabel(String type) => switch (type) {
        'created' => 'Sinyal dikirim',
        'acknowledged' => 'Direspons',
        'resolved' => 'Diselesaikan',
        'cancelled' => 'Dibatalkan',
        'notified' => 'Notifikasi dikirim ke warga',
        _ => type,
      };

  Future<void> _resolveSheet(Api api, AlertItem alert) async {
    final noteController = TextEditingController();
    var resolution = 'handled';

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (sheetContext) => Padding(
        padding: EdgeInsets.only(
          left: 20,
          right: 20,
          top: 20,
          bottom: MediaQuery.of(sheetContext).viewInsets.bottom + 24,
        ),
        child: StatefulBuilder(
          builder: (context, setSheetState) => Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Selesaikan sinyal', style: WargaTypography.h2),
              const SizedBox(height: 12),
              SegmentedButton<String>(
                segments: const [
                  ButtonSegment(value: 'handled', label: Text('Ditangani')),
                  ButtonSegment(value: 'false_alarm', label: Text('False alarm')),
                ],
                selected: {resolution},
                onSelectionChanged: (value) => setSheetState(() => resolution = value.first),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: noteController,
                decoration: const InputDecoration(labelText: 'Catatan (opsional)'),
                maxLines: 2,
              ),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: () async {
                  Navigator.of(sheetContext).pop();
                  await _act(
                    () => api.post('alerts/${alert.id}/resolve', body: {
                      'resolution': resolution,
                      'note': noteController.text.trim().isEmpty ? null : noteController.text.trim(),
                    }),
                  );
                },
                child: const Text('Simpan'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

Future<void> callNumber(String phone) async {
  final uri = Uri.parse('tel:$phone');
  if (await canLaunchUrl(uri)) await launchUrl(uri);
}
