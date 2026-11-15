import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'api_client.dart';
import 'api_error.dart';
import 'models.dart';

/// Hasil upaya memperbarui token.
/// - `invalid`: server menolak (401/403) → sesi memang berakhir, hapus token.
/// - `unavailable`: jaringan/server bermasalah → token **jangan** dihapus.
enum RefreshOutcome { success, invalid, unavailable }

class SessionState {
  const SessionState({
    this.accessToken,
    this.me,
    this.membership,
    this.memberships = const [],
    this.loading = false,
    this.notice,
  });

  final String? accessToken;
  final Me? me;
  final Membership? membership;
  final List<Membership> memberships;
  final bool loading;

  /// Pesan sekali tampil (mis. "Sesi berakhir") di layar login.
  final String? notice;

  bool get isLoggedIn => accessToken != null;
  bool get isPlatformAdmin => me?.isPlatformAdmin ?? false;

  SessionState copyWith({
    String? accessToken,
    Me? me,
    Membership? membership,
    List<Membership>? memberships,
    bool? loading,
    bool clearMembership = false,
  }) {
    return SessionState(
      accessToken: accessToken ?? this.accessToken,
      me: me ?? this.me,
      membership: clearMembership ? null : (membership ?? this.membership),
      memberships: memberships ?? this.memberships,
      loading: loading ?? this.loading,
    );
  }
}

final sessionProvider = NotifierProvider<SessionNotifier, SessionState>(SessionNotifier.new);

class SessionNotifier extends Notifier<SessionState> {
  static const _storage = FlutterSecureStorage();
  static const _refreshKey = 'jagawarga.refresh';

  Future<RefreshOutcome>? _refreshing;

  @override
  SessionState build() => const SessionState();

  Api get _api => ref.read(apiProvider);

  Future<bool> restore() async {
    final refreshToken = await _storage.read(key: _refreshKey);
    if (refreshToken == null) return false;

    try {
      final response = await _api.anonymous(
        'POST',
        'auth/refresh',
        body: {'refreshToken': refreshToken},
      );
      await _applyAuth(response.data as Map<String, dynamic>);
      return true;
    } on ApiException catch (error) {
      // Hanya penolakan server yang menghapus sesi. Gangguan jaringan tidak.
      if (error.status == 401 || error.status == 403) {
        await _storage.delete(key: _refreshKey);
      }
      return false;
    } catch (_) {
      return false;
    }
  }

  Future<void> _applyAuth(Map<String, dynamic> json) async {
    final accessToken = json['accessToken'] as String?;
    final refreshToken = json['refreshToken'] as String?;
    if (accessToken == null) throw StateError('accessToken tidak ada di response');

    if (refreshToken != null) await _storage.write(key: _refreshKey, value: refreshToken);

    // Set token dulu supaya /auth/me memakai kredensial baru.
    state = state.copyWith(accessToken: accessToken);

    final meJson = await _api.get('auth/me');
    final userJson = meJson['user'];
    final parsedMe = userJson == null ? null : Me.fromJson((userJson as Map).cast<String, dynamic>());

    final membershipJson = json['membership'] ?? meJson['membership'];
    final membershipsJson = (json['memberships'] ?? meJson['memberships'] ?? const []) as List;

    state = SessionState(
      accessToken: accessToken,
      me: parsedMe,
      membership: membershipJson == null
          ? null
          : Membership.fromJson((membershipJson as Map).cast<String, dynamic>()),
      memberships: membershipsJson
          .map((item) => Membership.fromJson((item as Map).cast<String, dynamic>()))
          .toList(),
    );
  }

  Future<void> login(String phone, String password) async {
    state = state.copyWith(loading: true);
    try {
      final response = await _api.anonymous(
        'POST',
        'auth/login',
        body: {'phone': phone, 'password': password},
      );
      await _applyAuth(response.data as Map<String, dynamic>);
    } finally {
      state = state.copyWith(loading: false);
    }
  }

  Future<void> activate({
    required String inviteCode,
    required String name,
    required String phone,
    required String password,
  }) async {
    state = state.copyWith(loading: true);
    try {
      final response = await _api.anonymous(
        'POST',
        'auth/activate',
        body: {'inviteCode': inviteCode, 'name': name, 'phone': phone, 'password': password},
      );
      await _applyAuth(response.data as Map<String, dynamic>);
    } finally {
      state = state.copyWith(loading: false);
    }
  }

  /// Single-flight: semua request 401 menunggu satu refresh yang sama.
  Future<RefreshOutcome> refreshTokens() {
    return _refreshing ??= _doRefresh().whenComplete(() => _refreshing = null);
  }

  Future<RefreshOutcome> _doRefresh() async {
    final refreshToken = await _storage.read(key: _refreshKey);
    if (refreshToken == null) return RefreshOutcome.invalid;

    try {
      final response = await _api.anonymous(
        'POST',
        'auth/refresh',
        body: {'refreshToken': refreshToken},
      );
      final json = response.data as Map<String, dynamic>;
      final accessToken = json['accessToken'] as String?;
      final nextRefresh = json['refreshToken'] as String?;
      if (accessToken == null) return RefreshOutcome.invalid;

      if (nextRefresh != null) await _storage.write(key: _refreshKey, value: nextRefresh);

      final membershipJson = json['membership'];
      state = state.copyWith(
        accessToken: accessToken,
        membership: membershipJson == null
            ? null
            : Membership.fromJson((membershipJson as Map).cast<String, dynamic>()),
        clearMembership: membershipJson == null,
      );
      return RefreshOutcome.success;
    } on ApiException catch (error) {
      return error.status == 401 || error.status == 403
          ? RefreshOutcome.invalid
          : RefreshOutcome.unavailable;
    } catch (_) {
      return RefreshOutcome.unavailable;
    }
  }

  Future<void> logout() async {
    final refreshToken = await _storage.read(key: _refreshKey);
    if (refreshToken != null) {
      try {
        await _api.anonymous('POST', 'auth/logout', body: {'refreshToken': refreshToken});
      } catch (_) {
        // keluar tetap dilanjutkan walau server tidak terjangkau
      }
    }
    await forceLogout();
  }

  Future<void> forceLogout({String? notice}) async {
    await _storage.delete(key: _refreshKey);
    state = SessionState(notice: notice);
  }

  Future<void> switchCommunity(String communityId) async {
    final json = await _api.post('auth/switch-community', body: {'communityId': communityId});
    await _applyAuth(json);
  }

  void patchProfile({String? name, String? bio, List<String>? interests, bool? directoryVisible}) {
    final me = state.me;
    if (me == null) return;
    state = state.copyWith(
      me: Me(
        id: me.id,
        name: name ?? me.name,
        phone: me.phone,
        isPlatformAdmin: me.isPlatformAdmin,
        interests: interests ?? me.interests,
        directoryVisible: directoryVisible ?? me.directoryVisible,
        bio: bio ?? me.bio,
        avatarMediaId: me.avatarMediaId,
      ),
    );
  }
}

/// Pesan error siap tampil untuk kegagalan API di UI.
String errorMessage(Object error) {
  if (error is ApiException) return error.message;
  return 'Terjadi kesalahan. Coba lagi.';
}
