import 'package:flutter/material.dart';

import '../../core/theme.dart';

/// Jenis bantuan yang bisa dikirim warga. Server menerima nilai yang sama
/// (`kind` pada POST /alerts) dan memakai judul notifikasi berbeda per jenis.
class AlertKind {
  const AlertKind({
    required this.value,
    required this.label,
    required this.shortLabel,
    required this.icon,
    required this.description,
  });

  final String value;
  final String label;
  final String shortLabel;
  final IconData icon;
  final String description;
}

const alertKinds = <AlertKind>[
  AlertKind(
    value: 'panic',
    label: 'Panic',
    shortLabel: 'PANIC',
    icon: Icons.warning_amber_rounded,
    description: 'Darurat umum — semua warga diberi tahu.',
  ),
  AlertKind(
    value: 'security',
    label: 'Maling',
    shortLabel: 'MALING',
    icon: Icons.visibility_outlined,
    description: 'Orang mencurigakan atau pencurian.',
  ),
  AlertKind(
    value: 'fire',
    label: 'Kebakaran',
    shortLabel: 'KEBAKARAN',
    icon: Icons.local_fire_department_outlined,
    description: 'Asap atau api terlihat.',
  ),
  AlertKind(
    value: 'medical',
    label: 'Medis',
    shortLabel: 'MEDIS',
    icon: Icons.medical_services_outlined,
    description: 'Butuh pertolongan medis segera.',
  ),
];

AlertKind alertKindFor(String value) {
  return alertKinds.firstWhere(
    (kind) => kind.value == value,
    orElse: () => alertKinds.first,
  );
}

/// Ikon + warna untuk riwayat alert, dipakai layar Kelola dan detail.
({IconData icon, Color color}) alertKindVisual(String value) {
  final kind = alertKindFor(value);
  final color = switch (value) {
    'fire' => WargaColors.amber700,
    'medical' => WargaColors.brand700,
    _ => WargaColors.danger600,
  };
  return (icon: kind.icon, color: color);
}
