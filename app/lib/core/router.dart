import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../features/announcements/announcement_detail_page.dart';
import '../features/announcements/announcements_page.dart';
import '../features/auth/activate_page.dart';
import '../features/auth/login_page.dart';
import '../features/donations/campaign_detail_page.dart';
import '../features/donations/campaigns_page.dart';
import '../features/directory/directory_page.dart';
import '../features/finance/finance_page.dart';
import '../features/home/home_page.dart';
import '../features/kelola/kelola_page.dart';
import '../features/notifications/notifications_page.dart';
import '../features/panic/panic_confirm_page.dart';
import '../features/panic/panic_page.dart';
import '../features/profile/household_page.dart';
import '../features/profile/profile_page.dart';
import '../features/shell.dart';
import '../features/web_only_page.dart';
import 'session.dart';

final routerProvider = Provider<GoRouter>((ref) {
  final listenable = _RouterRefresh(ref);
  ref.onDispose(listenable.dispose);

  return GoRouter(
    initialLocation: '/',
    refreshListenable: listenable,
    redirect: (context, state) {
      final session = ref.read(sessionProvider);
      final path = state.matchedLocation;
      final isAuthRoute = path == '/login' || path == '/activate';

      if (!session.isLoggedIn) return isAuthRoute ? null : '/login';

      if (session.isPlatformAdmin && session.membership == null) {
        return path == '/web-only' ? null : '/web-only';
      }

      if (session.membership == null) return path == '/activate' ? null : '/activate';
      if (isAuthRoute || path == '/web-only') return '/';

      return null;
    },
    routes: [
      GoRoute(path: '/login', builder: (_, __) => const LoginPage()),
      GoRoute(path: '/activate', builder: (_, __) => const ActivatePage()),
      GoRoute(path: '/web-only', builder: (_, __) => const WebOnlyPage()),
      GoRoute(
        path: '/panic/confirm',
        builder: (_, state) => PanicConfirmPage(
          initialKind: state.uri.queryParameters['type'] ?? 'panic',
        ),
      ),
      GoRoute(path: '/panic/:id', builder: (_, state) => PanicPage(alertId: state.pathParameters['id']!)),
      GoRoute(path: '/pengumuman', builder: (_, __) => const AnnouncementsPage()),
      GoRoute(path: '/pengumuman/:id', builder: (_, state) => AnnouncementDetailPage(id: state.pathParameters['id']!)),
      GoRoute(path: '/notifikasi', builder: (_, __) => const NotificationsPage()),
      GoRoute(path: '/donasi', builder: (_, __) => const CampaignsPage()),
      GoRoute(path: '/donasi/:id', builder: (_, state) => CampaignDetailPage(id: state.pathParameters['id']!)),
      GoRoute(path: '/rumah', builder: (_, __) => const HouseholdPage()),
      StatefulShellRoute.indexedStack(
        builder: (_, __, navigationShell) => AppShell(navigationShell: navigationShell),
        branches: [
          StatefulShellBranch(routes: [GoRoute(path: '/', builder: (_, __) => const HomePage())]),
          StatefulShellBranch(routes: [GoRoute(path: '/keuangan', builder: (_, __) => const FinancePage())]),
          StatefulShellBranch(routes: [GoRoute(path: '/warga', builder: (_, __) => const DirectoryPage())]),
          StatefulShellBranch(routes: [GoRoute(path: '/kelola', builder: (_, __) => const KelolaPage())]),
          StatefulShellBranch(routes: [GoRoute(path: '/profil', builder: (_, __) => const ProfilePage())]),
        ],
      ),
    ],
  );
});

class _RouterRefresh extends ChangeNotifier {
  _RouterRefresh(Ref ref) {
    ref.listen(sessionProvider, (_, __) => notifyListeners());
  }
}
