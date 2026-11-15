import 'dart:async';
import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'api_client.dart';
import 'session.dart';

class AppEvent {
  const AppEvent(this.name, this.data);

  final String name;
  final Map<String, dynamic> data;
}

final eventsProvider = Provider<EventsClient>((ref) {
  final client = EventsClient(ref);
  ref.onDispose(client.dispose);
  return client;
});

/// Satu koneksi SSE untuk seluruh aplikasi. Reconnect dengan backoff
/// 1→2→4→8→30 detik dan mengirim `Last-Event-ID` agar event yang terlewat
/// bisa diputar ulang oleh server.
class EventsClient {
  EventsClient(this._ref);

  final Ref _ref;
  final _controller = StreamController<AppEvent>.broadcast();

  Timer? _retryTimer;
  StreamSubscription<String>? _subscription;
  int _attempt = 0;
  String? _lastEventId;
  bool _active = false;

  Stream<AppEvent> get stream => _controller.stream;

  void start() {
    if (_active) return;
    _active = true;
    _connect();
  }

  void stop() {
    _active = false;
    _retryTimer?.cancel();
    _subscription?.cancel();
    _subscription = null;
  }

  void dispose() {
    stop();
    _controller.close();
  }

  Future<void> _connect() async {
    if (!_active) return;
    if (_ref.read(sessionProvider).accessToken == null) return;

    try {
      final body = await _ref.read(apiProvider).stream('events/stream', lastEventId: _lastEventId);
      _attempt = 0;

      final buffer = StringBuffer();

      _subscription = body.stream
          .cast<List<int>>()
          .transform(utf8.decoder)
          .listen(
        (chunk) {
          buffer.write(chunk);
          var text = buffer.toString();
          var index = text.indexOf('\n\n');

          while (index >= 0) {
            final raw = text.substring(0, index);
            text = text.substring(index + 2);
            _handleFrame(raw);
            index = text.indexOf('\n\n');
          }

          buffer
            ..clear()
            ..write(text);
        },
        onDone: _scheduleReconnect,
        onError: (_) => _scheduleReconnect(),
        cancelOnError: true,
      );
    } catch (_) {
      _scheduleReconnect();
    }
  }

  void _handleFrame(String raw) {
    String? name;
    String? id;
    final dataLines = <String>[];

    for (final line in raw.split('\n')) {
      if (line.startsWith('event:')) name = line.substring(6).trim();
      if (line.startsWith('id:')) id = line.substring(3).trim();
      if (line.startsWith('data:')) dataLines.add(line.substring(5).trim());
    }

    if (id != null) _lastEventId = id;
    if (name == null || dataLines.isEmpty) return;
    if (name == 'ping' || name == 'ready') return;

    final payload = dataLines.join('\n');
    Map<String, dynamic> data;
    try {
      final decoded = jsonDecode(payload);
      data = decoded is Map ? decoded.cast<String, dynamic>() : {'value': decoded};
    } catch (_) {
      data = {'raw': payload};
    }

    _controller.add(AppEvent(name, data));
  }

  void _scheduleReconnect() {
    _subscription?.cancel();
    _subscription = null;
    if (!_active) return;

    const delays = [1, 2, 4, 8, 30];
    final seconds = delays[_attempt.clamp(0, delays.length - 1)];
    _attempt += 1;

    _retryTimer?.cancel();
    _retryTimer = Timer(Duration(seconds: seconds), _connect);
  }
}
