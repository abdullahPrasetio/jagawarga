import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../core/api_client.dart';
import '../../core/format.dart';
import '../../core/models.dart';
import '../../core/session.dart';
import '../../core/theme.dart';
import '../../core/widgets.dart';

class FinancePage extends ConsumerStatefulWidget {
  const FinancePage({super.key});

  @override
  ConsumerState<FinancePage> createState() => _FinancePageState();
}

class _FinancePageState extends ConsumerState<FinancePage> {
  int _tab = 0;
  List<Invoice> _invoices = const [];
  List<LedgerEntry> _ledger = const [];
  Summary? _summary;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final api = ref.read(apiProvider);

    try {
      final results = await Future.wait([
        api.get('finance/invoices'),
        api.get('finance/ledger', query: {'limit': 50}),
        api.get('finance/summary'),
      ]);

      if (!mounted) return;
      setState(() {
        _invoices = listOf(results[0], 'items', Invoice.fromJson);
        _ledger = listOf(results[1], 'items', LedgerEntry.fromJson);
        _summary = Summary.fromJson(results[2]);
        _error = null;
      });
    } catch (error) {
      if (mounted) setState(() => _error = errorMessage(error));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final total = _invoices
        .where((invoice) => invoice.status != 'paid')
        .fold<int>(0, (sum, invoice) => sum + invoice.remaining);

    return Scaffold(
      appBar: AppBar(title: const Text('Keuangan')),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            SegmentedButton<int>(
              segments: const [
                ButtonSegment(value: 0, label: Text('Tagihan')),
                ButtonSegment(value: 1, label: Text('Kas')),
              ],
              selected: {_tab},
              onSelectionChanged: (value) => setState(() => _tab = value.first),
            ),
            const SizedBox(height: 16),
            if (_loading) const LinearProgressIndicator(minHeight: 2),
            if (_error != null) InlineError(_error!),
            if (_tab == 0) ..._invoiceSection(total) else ..._cashSection(),
          ],
        ),
      ),
    );
  }

  List<Widget> _invoiceSection(int total) {
    if (_invoices.isEmpty && !_loading) {
      return const [
        EmptyState(
          icon: Icons.receipt_long_outlined,
          title: 'Belum ada tagihan',
          caption: 'Tagihan baru muncul setelah pengurus menerbitkannya.',
        ),
      ];
    }

    return [
      AppCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('TOTAL BELUM DIBAYAR', style: WargaTypography.label.copyWith(color: WargaColors.inkMuted)),
            const SizedBox(height: 4),
            MoneyText(total, style: WargaTypography.h1),
          ],
        ),
      ),
      const SizedBox(height: 12),
      for (final invoice in _invoices) ...[
        AppCard(
          onTap: () => _invoiceSheet(invoice),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(child: Text(invoice.title, style: WargaTypography.h3)),
                  StatusPill(invoice.status),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                'Jatuh tempo ${formatDate(invoice.dueDate)} · ${invoice.houseLabel}',
                style: WargaTypography.caption.copyWith(color: WargaColors.inkMuted),
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  MoneyText(invoice.amount),
                  const Spacer(),
                  if (invoice.status != 'paid')
                    Text(
                      'Sisa ${formatRupiah(invoice.remaining)}',
                      style: WargaTypography.caption.copyWith(color: WargaColors.inkMuted),
                    ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 8),
      ],
    ];
  }

  List<Widget> _cashSection() {
    final summary = _summary;
    if (summary == null) return const [SizedBox(height: 40)];

    return [
      AppCard(
        child: Row(
          children: [
            _CashColumn(label: 'Masuk', amount: summary.income, color: WargaColors.brand700),
            _CashColumn(label: 'Keluar', amount: summary.expense, color: WargaColors.danger700),
            _CashColumn(label: 'Saldo', amount: summary.closing),
          ],
        ),
      ),
      const SizedBox(height: 16),
      SectionHeader(title: 'Transaksi'),
      const SizedBox(height: 8),
      if (_ledger.isEmpty)
        const EmptyState(
          icon: Icons.account_balance_wallet_outlined,
          title: 'Belum ada transaksi',
          caption: 'Kas warga akan tercatat di sini.',
        )
      else
        for (final entry in _ledger) ...[
          AppCard(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(entry.description, style: WargaTypography.bodyStrong),
                      const SizedBox(height: 2),
                      Text(
                        '${entry.category} · ${formatDate(entry.occurredOn)}',
                        style: WargaTypography.caption.copyWith(color: WargaColors.inkMuted),
                      ),
                    ],
                  ),
                ),
                MoneyText(
                  entry.amount,
                  color: entry.direction == 'income' ? WargaColors.brand700 : WargaColors.danger700,
                  signed: entry.direction == 'income',
                ),
              ],
            ),
          ),
          const SizedBox(height: 8),
        ],
    ];
  }

  Future<void> _invoiceSheet(Invoice invoice) async {
    final api = ref.read(apiProvider);
    List<Payment> payments = const [];

    try {
      final json = await api.get('finance/invoices/${invoice.id}/payments');
      payments = listOf(json, 'items', Payment.fromJson);
    } catch (_) {
      // riwayat opsional
    }

    if (!mounted) return;

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (sheetContext) => Padding(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(invoice.title, style: WargaTypography.h2),
            const SizedBox(height: 4),
            Text(
              '${invoice.houseLabel} · jatuh tempo ${formatDate(invoice.dueDate)}',
              style: WargaTypography.caption.copyWith(color: WargaColors.inkMuted),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                MoneyText(invoice.amount, style: WargaTypography.h1),
                const Spacer(),
                StatusPill(invoice.status),
              ],
            ),
            const SizedBox(height: 16),
            if (payments.isNotEmpty) ...[
              Text('Riwayat laporan', style: WargaTypography.h3),
              const SizedBox(height: 8),
              for (final payment in payments)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Row(
                    children: [
                      MoneyText(payment.amount, style: WargaTypography.bodyStrong),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          formatDate(payment.reportedAt),
                          style: WargaTypography.caption.copyWith(color: WargaColors.inkMuted),
                        ),
                      ),
                      StatusPill(payment.status),
                    ],
                  ),
                ),
              const SizedBox(height: 8),
            ],
            if (invoice.status != 'paid')
              FilledButton(
                onPressed: () async {
                  Navigator.of(sheetContext).pop();
                  await _reportSheet(invoice);
                },
                child: const Text('Lapor bayar'),
              ),
          ],
        ),
      ),
    );
  }

  Future<void> _reportSheet(Invoice invoice) async {
    final api = ref.read(apiProvider);
    final noteController = TextEditingController();
    File? file;
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
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Lapor pembayaran', style: WargaTypography.h2),
              const SizedBox(height: 4),
              Text(
                '${invoice.houseLabel} · ${invoice.title}',
                style: WargaTypography.caption.copyWith(color: WargaColors.inkMuted),
              ),
              const SizedBox(height: 16),
              InkWell(
                onTap: () async {
                  final picked = await ImagePicker().pickImage(
                    source: ImageSource.gallery,
                    imageQuality: 60,
                    maxWidth: 1280,
                  );
                  if (picked != null) setSheetState(() => file = File(picked.path));
                },
                child: Container(
                  height: 160,
                  width: double.infinity,
                  decoration: BoxDecoration(
                    color: WargaColors.paper,
                    borderRadius: BorderRadius.circular(WargaRadii.md),
                    border: Border.all(color: WargaColors.line),
                  ),
                  child: file == null
                      ? Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Icon(Icons.image_outlined, size: 32, color: WargaColors.inkMuted),
                            const SizedBox(height: 8),
                            Text(
                              'Tambah bukti transfer',
                              style: WargaTypography.caption.copyWith(color: WargaColors.inkMuted),
                            ),
                            Text(
                              'JPG/PNG, maks 5 MB',
                              style: WargaTypography.caption.copyWith(color: WargaColors.inkMuted),
                            ),
                          ],
                        )
                      : ClipRRect(
                          borderRadius: BorderRadius.circular(WargaRadii.md),
                          child: Image.file(file!, fit: BoxFit.cover),
                        ),
                ),
              ),
              const SizedBox(height: 16),
              Text('Catatan (opsional)', style: WargaTypography.label),
              const SizedBox(height: 6),
              TextField(
                controller: noteController,
                decoration: const InputDecoration(hintText: 'Transfer BCA a.n. Budi'),
              ),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: busy
                    ? null
                    : () async {
                        setSheetState(() => busy = true);
                        try {
                          final note = noteController.text.trim();
                          if (file == null) {
                            await api.post('finance/invoices/${invoice.id}/payments', body: {
                              'amount': invoice.remaining,
                              if (note.isNotEmpty) 'note': note,
                            });
                          } else {
                            await api.upload(
                              'finance/invoices/${invoice.id}/payments',
                              filePath: file!.path,
                              fields: {
                                'amount': '${invoice.remaining}',
                                if (note.isNotEmpty) 'note': note,
                              },
                            );
                          }
                          if (sheetContext.mounted) Navigator.of(sheetContext).pop();
                          await _load();
                        } catch (error) {
                          if (sheetContext.mounted) {
                            ScaffoldMessenger.of(sheetContext)
                                .showSnackBar(SnackBar(content: Text(errorMessage(error))));
                            setSheetState(() => busy = false);
                          }
                        }
                      },
                child: busy
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                      )
                    : const Text('Kirim untuk diverifikasi'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _CashColumn extends StatelessWidget {
  const _CashColumn({required this.label, required this.amount, this.color});

  final String label;
  final int amount;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: WargaTypography.caption.copyWith(color: WargaColors.inkMuted)),
          const SizedBox(height: 2),
          MoneyText(amount, style: WargaTypography.h3, color: color),
        ],
      ),
    );
  }
}
