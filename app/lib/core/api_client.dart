import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'api_error.dart';
import 'config.dart';
import 'session.dart';

final apiProvider = Provider<Api>((ref) => Api(ref));

/// Klien HTTP tunggal. Semua request membawa access token dari sesi, dan
/// 401 memicu refresh single-flight lalu retry sekali.
class Api {
  Api(this._ref);

  final Ref _ref;

  late final Dio _dio = Dio(
    BaseOptions(
      baseUrl: '${AppConfig.apiPrefix}/',
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 20),
      validateStatus: (status) => status != null && status < 400,
      headers: {'accept': 'application/json'},
    ),
  );

  String? get _token => _ref.read(sessionProvider).accessToken;

  Options _options(String method, {Map<String, dynamic>? query, bool multipart = false}) {
    final headers = <String, String>{};
    final token = _token;
    if (token != null) headers['authorization'] = 'Bearer $token';

    return Options(
      method: method,
      headers: headers,
      contentType: multipart ? 'multipart/form-data' : 'application/json',
      responseType: ResponseType.json,
    );
  }

  Future<Response<dynamic>> _send(
    String method,
    String path, {
    Object? data,
    Map<String, dynamic>? query,
    bool multipart = false,
  }) async {
    Future<Response<dynamic>> call() => _dio.request<dynamic>(
          path,
          data: data,
          queryParameters: query,
          options: _options(method, query: query, multipart: multipart),
        );

    try {
      return await call();
    } on DioException catch (error) {
      final unauthorized = error.response?.statusCode == 401;
      if (unauthorized && _token != null) {
        final outcome = await _ref.read(sessionProvider.notifier).refreshTokens();

        if (outcome == RefreshOutcome.success) return call();

        if (outcome == RefreshOutcome.invalid) {
          await _ref
              .read(sessionProvider.notifier)
              .forceLogout(notice: 'Sesi berakhir. Silakan masuk lagi.');
          throw ApiException(
            status: 401,
            code: 'unauthorized',
            message: 'Sesi berakhir. Silakan masuk lagi.',
          );
        }

        // Jaringan/server bermasalah: jangan hapus sesi 30 hari milik pengguna.
        throw ApiException(
          status: 0,
          code: 'network_error',
          message: 'Tidak dapat memperbarui sesi. Periksa koneksi Anda.',
        );
      }
      throw apiExceptionFrom(error);
    }
  }

  Future<Map<String, dynamic>> get(String path, {Map<String, dynamic>? query}) async {
    final response = await _send('GET', path, query: query);
    return (response.data as Map?)?.cast<String, dynamic>() ?? <String, dynamic>{};
  }

  Future<Map<String, dynamic>> post(String path, {Object? body}) async {
    final response = await _send('POST', path, data: body);
    return (response.data as Map?)?.cast<String, dynamic>() ?? <String, dynamic>{};
  }

  Future<Map<String, dynamic>> patch(String path, {Object? body}) async {
    final response = await _send('PATCH', path, data: body);
    return (response.data as Map?)?.cast<String, dynamic>() ?? <String, dynamic>{};
  }

  Future<Map<String, dynamic>> delete(String path) async {
    final response = await _send('DELETE', path);
    return (response.data as Map?)?.cast<String, dynamic>() ?? <String, dynamic>{};
  }

  Future<Response<dynamic>> raw(String path, {Map<String, dynamic>? query}) {
    return _send('GET', path, query: query);
  }

  /// Koneksi SSE (dipakai `EventsClient`). Tidak melewati retry 401 biasa
  /// karena body stream tidak bisa diulang.
  Future<ResponseBody> stream(String path, {String? lastEventId}) async {
    final headers = <String, String>{'accept': 'text/event-stream'};
    final token = _token;
    if (token != null) headers['authorization'] = 'Bearer $token';
    if (lastEventId != null) headers['last-event-id'] = lastEventId;

    final response = await _dio.request<ResponseBody>(
      path,
      options: Options(
        method: 'GET',
        headers: headers,
        responseType: ResponseType.stream,
        // SSE tetap terbuka; heartbeat server 25 detik tidak boleh memicu
        // receiveTimeout Dio.
        receiveTimeout: Duration.zero,
      ),
    );

    final body = response.data;
    if (body == null) throw StateError('stream kosong');
    return body;
  }

  Future<Map<String, dynamic>> upload(
    String path, {
    required String filePath,
    Map<String, String> fields = const {},
  }) async {
    final form = FormData.fromMap({
      ...fields,
      'file': await MultipartFile.fromFile(filePath),
    });

    final response = await _send('POST', path, data: form, multipart: true);
    return (response.data as Map?)?.cast<String, dynamic>() ?? <String, dynamic>{};
  }

  /// Request tanpa token (aktivasi/login/refresh).
  Future<Response<dynamic>> anonymous(
    String method,
    String path, {
    Object? body,
    Map<String, String> headers = const {},
  }) async {
    try {
      return await Dio(
        BaseOptions(
          baseUrl: '${AppConfig.apiPrefix}/',
          connectTimeout: const Duration(seconds: 10),
          headers: {'accept': 'application/json', ...headers},
          validateStatus: (status) => status != null && status < 400,
        ),
      ).request<dynamic>(
        path,
        data: body,
        options: Options(method: method, contentType: 'application/json'),
      );
    } on DioException catch (error) {
      throw apiExceptionFrom(error);
    }
  }
}

List<T> listOf<T>(Map<String, dynamic> json, String key, T Function(Map<String, dynamic>) parse) {
  return ((json[key] as List?) ?? const [])
      .map((item) => parse((item as Map).cast<String, dynamic>()))
      .toList();
}
