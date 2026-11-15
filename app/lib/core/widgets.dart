import 'package:flutter/material.dart';

import 'format.dart';
import 'theme.dart';

class AppCard extends StatelessWidget {
  const AppCard({super.key, required this.child, this.padding = const EdgeInsets.all(20), this.onTap});

  final Widget child;
  final EdgeInsets padding;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final card = Container(
      padding: padding,
      decoration: BoxDecoration(
        color: WargaColors.surface,
        borderRadius: BorderRadius.circular(WargaRadii.lg),
        border: Border.all(color: WargaColors.line),
      ),
      child: child,
    );

    if (onTap == null) return card;

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(WargaRadii.lg),
      child: card,
    );
  }
}

class SectionHeader extends StatelessWidget {
  const SectionHeader({super.key, required this.title, this.actionLabel, this.onAction});

  final String title;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Text(title, style: WargaTypography.h2.copyWith(color: WargaColors.ink)),
        ),
        if (actionLabel != null)
          TextButton(
            onPressed: onAction,
            child: Text(
              actionLabel!,
              style: WargaTypography.caption.copyWith(
                color: WargaColors.brand700,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
      ],
    );
  }
}

class StatusPill extends StatelessWidget {
  const StatusPill(this.status, {super.key});

  final String status;

  @override
  Widget build(BuildContext context) {
    final (label, fg, bg, icon) = switch (status) {
      'paid' || 'lunas' || 'approved' => ('Lunas', WargaColors.brand700, WargaColors.brand100, Icons.check_circle),
      'partial' || 'sebagian' => ('Sebagian', WargaColors.amber700, WargaColors.amber100, Icons.timelapse),
      'unpaid' || 'belum' => ('Belum bayar', WargaColors.amber700, WargaColors.amber100, Icons.schedule),
      'pending' || 'menunggu' => ('Menunggu', WargaColors.inkMuted, WargaColors.neutral100, Icons.hourglass_bottom),
      'rejected' || 'ditolak' => ('Ditolak', WargaColors.danger700, WargaColors.danger100, Icons.cancel),
      'active' || 'darurat' => ('Darurat', WargaColors.danger700, WargaColors.danger100, Icons.warning_amber_rounded),
      'acknowledged' => ('Ditangani', WargaColors.danger700, WargaColors.danger100, Icons.shield),
      'resolved' || 'cancelled' => ('Selesai', WargaColors.inkMuted, WargaColors.neutral100, Icons.check),
      'open' => ('Berjalan', WargaColors.brand700, WargaColors.brand100, Icons.campaign),
      _ => (status, WargaColors.inkMuted, WargaColors.neutral100, Icons.circle_outlined),
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(WargaRadii.pill)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: fg),
          const SizedBox(width: 4),
          Text(label, style: WargaTypography.caption.copyWith(color: fg, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}

class MoneyText extends StatelessWidget {
  const MoneyText(this.amount, {super.key, this.style, this.color, this.signed = false});

  final int amount;
  final TextStyle? style;
  final Color? color;
  final bool signed;

  @override
  Widget build(BuildContext context) {
    final prefix = signed ? (amount >= 0 ? '+ ' : '− ') : '';
    return Text(
      '$prefix${formatRupiah(amount.abs())}',
      style: (style ?? WargaTypography.money).copyWith(
        color: color ?? WargaColors.ink,
        fontFeatures: const [FontFeature.tabularFigures()],
      ),
    );
  }
}

class EmptyState extends StatelessWidget {
  const EmptyState({
    super.key,
    required this.icon,
    required this.title,
    required this.caption,
    this.actionLabel,
    this.onAction,
  });

  final IconData icon;
  final String title;
  final String caption;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 40, horizontal: 24),
      child: Column(
        children: [
          Icon(icon, size: 40, color: WargaColors.inkMuted),
          const SizedBox(height: 12),
          Text(title, style: WargaTypography.h3.copyWith(color: WargaColors.ink), textAlign: TextAlign.center),
          const SizedBox(height: 4),
          Text(
            caption,
            style: WargaTypography.caption.copyWith(color: WargaColors.inkMuted),
            textAlign: TextAlign.center,
          ),
          if (actionLabel != null) ...[
            const SizedBox(height: 16),
            SizedBox(
              width: 220,
              child: OutlinedButton(onPressed: onAction, child: Text(actionLabel!)),
            ),
          ],
        ],
      ),
    );
  }
}

class InlineError extends StatelessWidget {
  const InlineError(this.message, {super.key});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: WargaColors.danger100,
        borderRadius: BorderRadius.circular(WargaRadii.md),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.error_outline, size: 18, color: WargaColors.danger700),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              message,
              style: WargaTypography.caption.copyWith(color: WargaColors.danger700),
            ),
          ),
        ],
      ),
    );
  }
}

class AvatarCircle extends StatelessWidget {
  const AvatarCircle(this.name, {super.key, this.size = 40});

  final String name;
  final double size;

  @override
  Widget build(BuildContext context) {
    final initials = name
        .trim()
        .split(RegExp(r'\s+'))
        .take(2)
        .map((part) => part.isEmpty ? '' : part[0].toUpperCase())
        .join();

    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: const BoxDecoration(color: WargaColors.brand100, shape: BoxShape.circle),
      child: Text(
        initials.isEmpty ? '?' : initials,
        style: WargaTypography.bodyStrong.copyWith(color: WargaColors.brand700),
      ),
    );
  }
}

class InfoRow extends StatelessWidget {
  const InfoRow({super.key, required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 120,
            child: Text(label, style: WargaTypography.caption.copyWith(color: WargaColors.inkMuted)),
          ),
          Expanded(child: Text(value, style: WargaTypography.bodyStrong)),
        ],
      ),
    );
  }
}
