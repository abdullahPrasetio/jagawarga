import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/theme.dart';

/// Tombol darurat: harus **ditahan** [holdDuration] sebelum memicu aksi.
/// Lepas sebelum selesai = batal, tanpa request apa pun.
class PanicButton extends StatefulWidget {
  const PanicButton({
    super.key,
    required this.onTriggered,
    this.holdDuration = const Duration(milliseconds: 1500),
    this.size = 200,
    this.label = 'TAHAN',
    this.sublabel = '1,5 detik',
  });

  final Future<void> Function() onTriggered;
  final Duration holdDuration;
  final double size;
  final String label;
  final String sublabel;

  @override
  State<PanicButton> createState() => _PanicButtonState();
}

class _PanicButtonState extends State<PanicButton> {
  Timer? _timer;
  double _progress = 0;
  bool _fired = false;

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void _start() {
    if (_timer != null || _fired) return;

    HapticFeedback.heavyImpact();
    setState(() => _progress = 0);

    const tick = Duration(milliseconds: 50);
    _timer = Timer.periodic(tick, (timer) {
      if (!mounted) {
        timer.cancel();
        return;
      }

      final next = _progress + tick.inMilliseconds / widget.holdDuration.inMilliseconds;
      setState(() => _progress = next.clamp(0, 1));

      if (next >= 1) {
        timer.cancel();
        _timer = null;
        _fire();
      }
    });
  }

  void _cancel() {
    if (_fired) return;
    _timer?.cancel();
    _timer = null;
    if (_progress > 0) setState(() => _progress = 0);
  }

  Future<void> _fire() async {
    if (_fired) return;
    _fired = true;
    HapticFeedback.vibrate();
    try {
      await widget.onTriggered();
    } finally {
      if (mounted) {
        setState(() {
          _fired = false;
          _progress = 0;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final size = widget.size;

    return Semantics(
      button: true,
      label: 'Tombol panic. Tahan ${widget.holdDuration.inMilliseconds ~/ 100} detik untuk mengirim sinyal darurat.',
      child: GestureDetector(
        onTapDown: (_) => _start(),
        onTapUp: (_) => _cancel(),
        onTapCancel: _cancel,
        child: SizedBox(
          width: size + 16,
          height: size + 16,
          child: Stack(
            alignment: Alignment.center,
            children: [
              SizedBox(
                width: size + 16,
                height: size + 16,
                child: CircularProgressIndicator(
                  value: _progress,
                  strokeWidth: 4,
                  backgroundColor: Colors.white24,
                  valueColor: const AlwaysStoppedAnimation(Colors.white),
                ),
              ),
              AnimatedContainer(
                duration: const Duration(milliseconds: 120),
                width: size,
                height: size,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: _progress > 0 ? WargaColors.danger700 : WargaColors.danger600,
                  boxShadow: const [
                    BoxShadow(color: Color(0x33000000), blurRadius: 24, offset: Offset(0, 8)),
                  ],
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      widget.label,
                      style: WargaTypography.h2.copyWith(
                        color: Colors.white,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 1.5,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      widget.sublabel,
                      style: WargaTypography.caption.copyWith(color: Colors.white70),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
