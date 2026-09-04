enum Role {
  admin('ADMIN'),
  analyst('ANALYST'),
  viewer('VIEWER');

  const Role(this.api);
  final String api;

  static Role fromApi(String? value) => switch (value) {
        'ADMIN' => Role.admin,
        'ANALYST' => Role.analyst,
        _ => Role.viewer,
      };
}

enum Classification {
  dropout('Dropout'),
  enrolled('Enrolled'),
  graduate('Graduate');

  const Classification(this.api);
  final String api;

  static Classification? fromApi(String? value) => switch (value) {
        'Dropout' => Classification.dropout,
        'Enrolled' => Classification.enrolled,
        'Graduate' => Classification.graduate,
        _ => null,
      };
}

enum Priority {
  low('LOW'),
  medium('MEDIUM'),
  high('HIGH');

  const Priority(this.api);
  final String api;

  static Priority? fromApi(String? value) => switch (value) {
        'LOW' => Priority.low,
        'MEDIUM' => Priority.medium,
        'HIGH' => Priority.high,
        _ => null,
      };
}

enum FollowUpStatus {
  open('OPEN'),
  inProgress('IN_PROGRESS'),
  done('DONE'),
  cancelled('CANCELLED');

  const FollowUpStatus(this.api);
  final String api;

  static FollowUpStatus fromApi(String? value) => switch (value) {
        'IN_PROGRESS' => FollowUpStatus.inProgress,
        'DONE' => FollowUpStatus.done,
        'CANCELLED' => FollowUpStatus.cancelled,
        _ => FollowUpStatus.open,
      };
}

abstract final class Json {
  static String str(Object? value, [String fallback = '']) =>
      value is String ? value : fallback;

  static String? strOrNull(Object? value) => value is String ? value : null;

  static int intOf(Object? value, [int fallback = 0]) => switch (value) {
        int v => v,
        double v => v.round(),
        String v => int.tryParse(v) ?? fallback,
        _ => fallback,
      };

  static int? intOrNull(Object? value) => switch (value) {
        int v => v,
        double v => v.round(),
        String v => int.tryParse(v),
        _ => null,
      };

  static double dbl(Object? value, [double fallback = 0]) => switch (value) {
        double v => v,
        int v => v.toDouble(),
        String v => double.tryParse(v) ?? fallback,
        _ => fallback,
      };

  static double? dblOrNull(Object? value) => switch (value) {
        double v => v,
        int v => v.toDouble(),
        String v => double.tryParse(v),
        _ => null,
      };

  static bool boolOf(Object? value, [bool fallback = false]) =>
      value is bool ? value : fallback;

  static DateTime? date(Object? value) =>
      value is String ? DateTime.tryParse(value)?.toLocal() : null;

  static Map<String, dynamic> map(Object? value) =>
      value is Map ? Map<String, dynamic>.from(value) : const {};

  static Map<String, dynamic>? mapOrNull(Object? value) =>
      value is Map ? Map<String, dynamic>.from(value) : null;

  static List<Map<String, dynamic>> list(Object? value) => value is List
      ? value.whereType<Map>().map((item) => Map<String, dynamic>.from(item)).toList()
      : const [];

  static List<String> strings(Object? value) =>
      value is List ? value.whereType<String>().toList() : const [];

  static Map<String, double> numbers(Object? value) {
    if (value is! Map) return {};
    final result = <String, double>{};
    value.forEach((key, item) {
      final number = dblOrNull(item);
      if (key is String && number != null) result[key] = number;
    });
    return result;
  }
}
