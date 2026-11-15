import 'package:dio/dio.dart';

class ApiException implements Exception {
  ApiException({required this.status, required this.code, required this.message});

  final int status;
  final String code;
  final String message;

  bool get isUnauthorized => status == 401;

  @override
  String toString() => message;
}

ApiException apiExceptionFrom(DioException error) {
  final response = error.response;
  final data = response?.data;

  if (data is Map && data['code'] is String) {
    return ApiException(
      status: response?.statusCode ?? 0,
      code: data['code'] as String,
      message: (data['detail'] as String?) ?? 'Terjadi kesalahan',
    );
  }

  if (error.type == DioExceptionType.connectionError ||
      error.type == DioExceptionType.connectionTimeout) {
    return ApiException(
      status: 0,
      code: 'network_error',
      message: 'Tidak ada koneksi ke server warga',
    );
  }

  return ApiException(
    status: response?.statusCode ?? 0,
    code: 'unknown',
    message: error.message ?? 'Terjadi kesalahan',
  );
}

/// Field-level errors untuk form (`code` → pesan).
Map<String, String> validationErrors(ApiException error) {
  return switch (error.code) {
    'invite_invalid' => {'inviteCode': error.message},
    'household_full' => {'inviteCode': error.message},
    'community_suspended' => {'form': error.message},
    'no_community' => {'form': error.message},
    _ => {'form': error.message},
  };
}
