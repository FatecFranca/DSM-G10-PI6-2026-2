import 'package:flutter/material.dart';

@immutable
class AppColors extends ThemeExtension<AppColors> {
  const AppColors({
    required this.bg,
    required this.surface,
    required this.surfaceAlt,
    required this.surfaceInset,
    required this.surfaceHover,
    required this.border,
    required this.borderStrong,
    required this.text,
    required this.textMuted,
    required this.textSubtle,
    required this.textInverse,
    required this.brand,
    required this.brandDark,
    required this.brandSoft,
    required this.dropout,
    required this.enrolled,
    required this.graduate,
    required this.danger,
    required this.warning,
    required this.success,
    required this.info,
    required this.scrim,
  });

  final Color bg;
  final Color surface;
  final Color surfaceAlt;
  final Color surfaceInset;
  final Color surfaceHover;
  final Color border;
  final Color borderStrong;
  final Color text;
  final Color textMuted;
  final Color textSubtle;
  final Color textInverse;
  final Color brand;
  final Color brandDark;
  final Color brandSoft;
  final Color dropout;
  final Color enrolled;
  final Color graduate;
  final Color danger;
  final Color warning;
  final Color success;
  final Color info;
  final Color scrim;

  static const Color sidebarBg = Color(0xFF070B15);
  static const Color sidebarText = Color(0xFFC7CFE6);
  static const Color sidebarTextMuted = Color(0xFF7A86A8);
  static const Color sidebarBorder = Color(0x2494A3B8);
  static const Color sidebarHoverBg = Color(0x1A94A3B8);

  static const AppColors dark = AppColors(
    bg: Color(0xFF0A0F1C),
    surface: Color(0xFF121A2B),
    surfaceAlt: Color(0xFF16203A),
    surfaceInset: Color(0xFF1B263F),
    surfaceHover: Color(0xFF182236),
    border: Color(0xFF253150),
    borderStrong: Color(0xFF37456B),
    text: Color(0xFFE8ECF5),
    textMuted: Color(0xFF97A2C0),
    textSubtle: Color(0xFF6A7594),
    textInverse: Color(0xFF0A0F1C),
    brand: Color(0xFF4F8DFD),
    brandDark: Color(0xFF78A9FF),
    brandSoft: Color(0xFF16233F),
    dropout: Color(0xFFF56565),
    enrolled: Color(0xFFFBBF24),
    graduate: Color(0xFF3DDC9B),
    danger: Color(0xFFF56565),
    warning: Color(0xFFFBBF24),
    success: Color(0xFF3DDC9B),
    info: Color(0xFF4FC3F7),
    scrim: Color(0xA803060E),
  );

  static const AppColors light = AppColors(
    bg: Color(0xFFF5F7FA),
    surface: Color(0xFFFFFFFF),
    surfaceAlt: Color(0xFFF8FAFC),
    surfaceInset: Color(0xFFF1F5F9),
    surfaceHover: Color(0xFFEEF2F7),
    border: Color(0xFFE2E8F0),
    borderStrong: Color(0xFFCBD5E1),
    text: Color(0xFF0F172A),
    textMuted: Color(0xFF64748B),
    textSubtle: Color(0xFF94A3B8),
    textInverse: Color(0xFFFFFFFF),
    brand: Color(0xFF1D4ED8),
    brandDark: Color(0xFF1E3FA8),
    brandSoft: Color(0xFFEEF3FF),
    dropout: Color(0xFFDC2626),
    enrolled: Color(0xFFD97706),
    graduate: Color(0xFF059669),
    danger: Color(0xFFDC2626),
    warning: Color(0xFFD97706),
    success: Color(0xFF059669),
    info: Color(0xFF0284C7),
    scrim: Color(0x800F172A),
  );

  Color _mix(Color color, double percent, Color base) =>
      Color.lerp(base, color, percent)!;

  Color soft(Color color) => _mix(color, 0.16, surface);

  Color softBorder(Color color) => _mix(color, 0.38, border);

  Color softText(Color color) => _mix(color, 0.75, text);

  @override
  AppColors copyWith() => this;

  @override
  AppColors lerp(ThemeExtension<AppColors>? other, double t) {
    if (other is! AppColors) return this;
    return t < 0.5 ? this : other;
  }
}

abstract final class AppSizes {
  static const double radiusSm = 6;
  static const double radius = 10;
  static const double radiusLg = 16;

  static const double contentPadding = 16;
  static const double cardPadding = 16;
  static const double gap = 16;
  static const double gapTight = 9;

  static const double fontBody = 14.5;
  static const double fontPageTitle = 19;
  static const double fontCardTitle = 14.5;
  static const double fontStatValue = 20;
  static const double fontLabel = 11.5;
  static const double fontSmall = 12.5;
  static const double fontHint = 12;
}

ThemeData buildAppTheme(Brightness brightness) {
  final colors = brightness == Brightness.dark ? AppColors.dark : AppColors.light;

  final base = ThemeData(
    brightness: brightness,
    useMaterial3: true,
    colorScheme: ColorScheme.fromSeed(
      seedColor: colors.brand,
      brightness: brightness,
      primary: colors.brand,
      onPrimary: Colors.white,
      surface: colors.surface,
      onSurface: colors.text,
      error: colors.danger,
    ),
    scaffoldBackgroundColor: colors.bg,
    canvasColor: colors.surface,
    dividerColor: colors.border,
    splashFactory: InkSparkle.splashFactory,
  );

  return base.copyWith(
    extensions: [colors],
    textTheme: base.textTheme.apply(
      bodyColor: colors.text,
      displayColor: colors.text,
      fontSizeFactor: 1,
    ),
    appBarTheme: AppBarTheme(
      backgroundColor: colors.surface,
      foregroundColor: colors.text,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      scrolledUnderElevation: 0,
      shape: Border(bottom: BorderSide(color: colors.border)),
      titleTextStyle: TextStyle(
        color: colors.text,
        fontSize: 15.5,
        fontWeight: FontWeight.w600,
      ),
    ),
    dividerTheme: DividerThemeData(color: colors.border, space: 1, thickness: 1),
    iconTheme: IconThemeData(color: colors.textMuted, size: 20),
    progressIndicatorTheme: ProgressIndicatorThemeData(
      color: colors.brand,
      linearTrackColor: colors.surfaceInset,
    ),
    checkboxTheme: CheckboxThemeData(
      side: BorderSide(color: colors.borderStrong, width: 1.5),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppSizes.radiusSm - 2),
      ),
      fillColor: WidgetStateProperty.resolveWith(
        (states) => states.contains(WidgetState.selected) ? colors.brand : Colors.transparent,
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: colors.surface,
      isDense: true,
      contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 12),
      hintStyle: TextStyle(color: colors.textSubtle, fontSize: 14),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppSizes.radiusSm),
        borderSide: BorderSide(color: colors.borderStrong),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppSizes.radiusSm),
        borderSide: BorderSide(color: colors.borderStrong),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppSizes.radiusSm),
        borderSide: BorderSide(color: colors.brand, width: 1.6),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppSizes.radiusSm),
        borderSide: BorderSide(color: colors.danger),
      ),
      focusedErrorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppSizes.radiusSm),
        borderSide: BorderSide(color: colors.danger, width: 1.6),
      ),
      disabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppSizes.radiusSm),
        borderSide: BorderSide(color: colors.border),
      ),
      errorStyle: TextStyle(
        color: colors.danger,
        fontSize: AppSizes.fontLabel,
        fontWeight: FontWeight.w500,
      ),
    ),
    dialogTheme: DialogThemeData(
      backgroundColor: colors.surface,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppSizes.radiusLg),
      ),
    ),
    bottomSheetTheme: BottomSheetThemeData(
      backgroundColor: colors.surface,
      surfaceTintColor: Colors.transparent,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppSizes.radiusLg)),
      ),
    ),
    snackBarTheme: SnackBarThemeData(
      backgroundColor: colors.surface,
      contentTextStyle: TextStyle(color: colors.text, fontSize: 13.5),
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppSizes.radiusSm),
      ),
    ),
    drawerTheme: const DrawerThemeData(
      backgroundColor: AppColors.sidebarBg,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(),
    ),
  );
}

extension AppColorsContext on BuildContext {
  AppColors get colors => Theme.of(this).extension<AppColors>()!;
}
