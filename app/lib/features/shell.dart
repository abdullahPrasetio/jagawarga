import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../core/api_client.dart';
import '../core/events.dart';
import '../core/push.dart';
import '../core/widget_service.dart';
import '../core/session.dart';

class AppShell extends ConsumerStatefulWidget {
  const AppShell({super.key, required this.navigationShell});

  final StatefulNavigationShell navigationShell;

  @override
  ConsumerState<AppShell> createState() => _AppShellState();
}

class _AppShellState extends ConsumerState<AppShell> {
  @override
  void initState() {
    super.initState();
    final session = ref.read(sessionProvider);
    final communityId = session.membership?.communityId;

    ref.read(eventsProvider).start();
    if (communityId != null) {
      PushService.subscribe(
        ref.read(apiProvider),
        communityId,
        responder: session.membership?.canRespondAlert ?? false,
      );
    }

    PushService.initialAlertId().then((alertId) {
      if (alertId != null && mounted) context.push('/panic/$alertId');
    });

    _alertTapSub = PushService.onAlertTap.listen((alertId) {
      if (mounted) context.push('/panic/$alertId');
    });

    WidgetService.initialRoute().then((route) {
      if (route != null && mounted) context.push(route);
    });

    _widgetSub = WidgetService.onRoute.listen((route) {
      if (mounted) context.push(route);
    });
  }

  StreamSubscription<String>? _alertTapSub;
  StreamSubscription<String>? _widgetSub;

  @override
  void dispose() {
    _alertTapSub?.cancel();
    _widgetSub?.cancel();
    ref.read(eventsProvider).stop();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final membership = ref.watch(sessionProvider).membership;
    final showKelola = membership?.canRespondAlert ?? false;

    final branchIndexes = <int>[0, 1, 2, if (showKelola) 3, 4];

    final destinations = <NavigationDestination>[
      const NavigationDestination(icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home), label: 'Beranda'),
      const NavigationDestination(
        icon: Icon(Icons.receipt_long_outlined),
        selectedIcon: Icon(Icons.receipt_long),
        label: 'Keuangan',
      ),
      const NavigationDestination(icon: Icon(Icons.people_outline), selectedIcon: Icon(Icons.people), label: 'Warga'),
      if (showKelola)
        const NavigationDestination(icon: Icon(Icons.shield_outlined), selectedIcon: Icon(Icons.shield), label: 'Kelola'),
      const NavigationDestination(icon: Icon(Icons.person_outline), selectedIcon: Icon(Icons.person), label: 'Profil'),
    ];

    final selected = branchIndexes.indexOf(widget.navigationShell.currentIndex);

    return Scaffold(
      body: widget.navigationShell,
      bottomNavigationBar: NavigationBar(
        selectedIndex: selected < 0 ? 0 : selected,
        destinations: destinations,
        onDestinationSelected: (index) {
          final branch = branchIndexes[index];
          widget.navigationShell.goBranch(branch, initialLocation: branch == widget.navigationShell.currentIndex);
        },
      ),
    );
  }
}
