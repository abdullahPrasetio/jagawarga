/// Token desain — sumber tunggal untuk warna, teks, radius, dan spasi.
/// Cermin dari `design/design-system.md`; perubahan di sini wajib disertai
/// perubahan `web/src/design/tokens.ts` agar mobile dan web tetap identik.
library;

import 'package:flutter/material.dart';

class WargaColors {
  static const brand900 = Color(0xFF0B3B24);
  static const brand700 = Color(0xFF14532D);
  static const brand600 = Color(0xFF1A6B3C);
  static const brand500 = Color(0xFF21854B);
  static const brand100 = Color(0xFFDCFCE7);

  static const paper = Color(0xFFF7F6F2);
  static const surface = Color(0xFFFFFFFF);
  static const ink = Color(0xFF10231A);
  static const inkMuted = Color(0xFF5B6B61);
  static const line = Color(0xFFE3E6E1);

  static const danger700 = Color(0xFF991B1B);
  static const danger600 = Color(0xFFDC2626);
  static const danger100 = Color(0xFFFEE2E2);

  static const amber700 = Color(0xFF92400E);
  static const amber100 = Color(0xFFFDF0DF);

  static const neutral100 = Color(0xFFEEF0ED);

  static const success600 = Color(0xFF157F3C);
}

class WargaRadii {
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 24;
  static const double pill = 999;
}

class WargaSpacing {
  static const double xs = 4;
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 20;
  static const double xxl = 24;
  static const double section = 32;
  static const double screen = 40;
  static const double hero = 56;
}

class WargaTypography {
  static const TextStyle display = TextStyle(
    fontSize: 32,
    height: 38 / 32,
    fontWeight: FontWeight.w700,
    letterSpacing: -0.5,
    fontFeatures: [FontFeature.tabularFigures()],
  );
  static const TextStyle h1 =
      TextStyle(fontSize: 24, height: 30 / 24, fontWeight: FontWeight.w700, letterSpacing: -0.2);
  static const TextStyle h2 =
      TextStyle(fontSize: 20, height: 26 / 20, fontWeight: FontWeight.w600);
  static const TextStyle h3 =
      TextStyle(fontSize: 17, height: 24 / 17, fontWeight: FontWeight.w600);
  static const TextStyle body =
      TextStyle(fontSize: 15, height: 22 / 15, fontWeight: FontWeight.w400);
  static const TextStyle bodyStrong =
      TextStyle(fontSize: 15, height: 22 / 15, fontWeight: FontWeight.w600);
  static const TextStyle caption =
      TextStyle(fontSize: 13, height: 18 / 13, fontWeight: FontWeight.w500);
  static const TextStyle label = TextStyle(
    fontSize: 12,
    height: 16 / 12,
    fontWeight: FontWeight.w600,
    letterSpacing: 0.2,
  );
  static const TextStyle money = TextStyle(
    fontSize: 17,
    height: 24 / 17,
    fontWeight: FontWeight.w600,
    fontFeatures: [FontFeature.tabularFigures()],
  );
}

class WargaTheme {
  static ThemeData build() {
    const scheme = ColorScheme(
      brightness: Brightness.light,
      primary: WargaColors.brand600,
      onPrimary: Colors.white,
      secondary: WargaColors.brand700,
      onSecondary: Colors.white,
      error: WargaColors.danger600,
      onError: Colors.white,
      surface: WargaColors.surface,
      onSurface: WargaColors.ink,
    );

    final base = ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      scaffoldBackgroundColor: WargaColors.paper,
      fontFamily: 'Roboto',
    );

    return base.copyWith(
      textTheme: base.textTheme.copyWith(
        displayMedium: WargaTypography.display.copyWith(color: WargaColors.ink),
        headlineSmall: WargaTypography.h1.copyWith(color: WargaColors.ink),
        titleLarge: WargaTypography.h2.copyWith(color: WargaColors.ink),
        titleMedium: WargaTypography.h3.copyWith(color: WargaColors.ink),
        bodyMedium: WargaTypography.body.copyWith(color: WargaColors.ink),
        bodySmall: WargaTypography.caption.copyWith(color: WargaColors.inkMuted),
        labelMedium: WargaTypography.label.copyWith(color: WargaColors.inkMuted),
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: WargaColors.paper,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        centerTitle: false,
        foregroundColor: WargaColors.ink,
        titleTextStyle: TextStyle(
          fontSize: 24,
          height: 30 / 24,
          fontWeight: FontWeight.w700,
          letterSpacing: -0.2,
          color: WargaColors.ink,
        ),
      ),
      cardTheme: CardThemeData(
        color: WargaColors.surface,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(WargaRadii.lg),
          side: const BorderSide(color: WargaColors.line),
        ),
      ),
      dividerTheme: const DividerThemeData(color: WargaColors.line, thickness: 1, space: 1),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size.fromHeight(52),
          backgroundColor: WargaColors.brand600,
          foregroundColor: Colors.white,
          disabledBackgroundColor: WargaColors.neutral100,
          disabledForegroundColor: WargaColors.inkMuted,
          textStyle: WargaTypography.bodyStrong,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(WargaRadii.md)),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          minimumSize: const Size.fromHeight(48),
          foregroundColor: WargaColors.brand700,
          side: const BorderSide(color: WargaColors.brand600),
          textStyle: WargaTypography.bodyStrong,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(WargaRadii.md)),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: WargaColors.brand700,
          textStyle: WargaTypography.bodyStrong,
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: WargaColors.surface,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        hintStyle: WargaTypography.body.copyWith(color: WargaColors.inkMuted),
        labelStyle: WargaTypography.label.copyWith(color: WargaColors.inkMuted),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(WargaRadii.md),
          borderSide: const BorderSide(color: WargaColors.line),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(WargaRadii.md),
          borderSide: const BorderSide(color: WargaColors.line),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(WargaRadii.md),
          borderSide: const BorderSide(color: WargaColors.brand600, width: 2),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(WargaRadii.md),
          borderSide: const BorderSide(color: WargaColors.danger600),
        ),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: WargaColors.surface,
        surfaceTintColor: Colors.transparent,
        indicatorColor: Colors.transparent,
        height: 64,
        labelTextStyle: WidgetStateProperty.resolveWith(
          (states) => WargaTypography.label.copyWith(
            color: states.contains(WidgetState.selected)
                ? WargaColors.brand700
                : WargaColors.inkMuted,
          ),
        ),
        iconTheme: WidgetStateProperty.resolveWith(
          (states) => IconThemeData(
            size: 22,
            color: states.contains(WidgetState.selected)
                ? WargaColors.brand700
                : WargaColors.inkMuted,
          ),
        ),
      ),
      snackBarTheme: SnackBarThemeData(
        backgroundColor: WargaColors.ink,
        contentTextStyle: WargaTypography.body.copyWith(color: Colors.white),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(WargaRadii.md)),
      ),
      bottomSheetTheme: const BottomSheetThemeData(
        backgroundColor: WargaColors.surface,
        surfaceTintColor: Colors.transparent,
        showDragHandle: true,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(WargaRadii.xl)),
        ),
      ),
      progressIndicatorTheme: const ProgressIndicatorThemeData(color: WargaColors.brand600),
      splashFactory: InkSparkle.splashFactory,
    );
  }
}
