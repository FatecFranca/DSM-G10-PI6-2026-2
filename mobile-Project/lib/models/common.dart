import 'enums.dart';

class Paginated<T> {
  const Paginated({required this.data, required this.pagination});

  final List<T> data;
  final PageInfo pagination;

  factory Paginated.fromJson(
    Map<String, dynamic> json,
    T Function(Map<String, dynamic>) parse,
  ) {
    return Paginated(
      data: Json.list(json['data']).map(parse).toList(),
      pagination: PageInfo.fromJson(Json.map(json['pagination'])),
    );
  }

  bool get isEmpty => data.isEmpty;
}

class PageInfo {
  const PageInfo({
    required this.page,
    required this.limit,
    required this.total,
    required this.totalPages,
    required this.hasNext,
    required this.hasPrevious,
  });

  final int page;
  final int limit;
  final int total;
  final int totalPages;
  final bool hasNext;
  final bool hasPrevious;

  factory PageInfo.fromJson(Map<String, dynamic> json) => PageInfo(
        page: Json.intOf(json['page'], 1),
        limit: Json.intOf(json['limit'], 20),
        total: Json.intOf(json['total']),
        totalPages: Json.intOf(json['totalPages'], 1),
        hasNext: Json.boolOf(json['hasNext']),
        hasPrevious: Json.boolOf(json['hasPrevious']),
      );
}

class NamedRef {
  const NamedRef({required this.id, required this.name, this.extra});

  final String id;
  final String name;
  final String? extra;

  static NamedRef? fromJson(Object? value) {
    final json = Json.mapOrNull(value);
    if (json == null) return null;
    return NamedRef(
      id: Json.str(json['id']),
      name: Json.str(json['name']),
      extra: Json.strOrNull(json['code']) ?? Json.strOrNull(json['city']),
    );
  }
}

class DistributionItem {
  const DistributionItem({required this.value, required this.count, required this.ratio});

  final String value;
  final int count;
  final double ratio;

  factory DistributionItem.fromJson(Map<String, dynamic> json) => DistributionItem(
        value: Json.str(json['value']),
        count: Json.intOf(json['count']),
        ratio: Json.dbl(json['ratio']),
      );
}

class Distribution {
  const Distribution({required this.total, required this.items});

  final int total;
  final List<DistributionItem> items;

  factory Distribution.fromJson(Map<String, dynamic> json) => Distribution(
        total: Json.intOf(json['total']),
        items: Json.list(json['items']).map(DistributionItem.fromJson).toList(),
      );

  int countOf(String value) => items
      .where((item) => item.value == value)
      .fold(0, (sum, item) => sum + item.count);
}
