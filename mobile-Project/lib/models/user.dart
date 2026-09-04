import 'common.dart';
import 'enums.dart';

class User {
  const User({
    required this.id,
    required this.name,
    required this.email,
    required this.role,
    required this.institutionId,
    required this.active,
    required this.lastLoginAt,
    required this.createdAt,
    required this.institution,
  });

  final String id;
  final String name;
  final String email;
  final Role role;
  final String? institutionId;
  final bool active;
  final DateTime? lastLoginAt;
  final DateTime? createdAt;
  final NamedRef? institution;

  factory User.fromJson(Map<String, dynamic> json) => User(
        id: Json.str(json['id']),
        name: Json.str(json['name']),
        email: Json.str(json['email']),
        role: Role.fromApi(Json.strOrNull(json['role'])),
        institutionId: Json.strOrNull(json['institutionId']),
        active: Json.boolOf(json['active'], true),
        lastLoginAt: Json.date(json['lastLoginAt']),
        createdAt: Json.date(json['createdAt']),
        institution: NamedRef.fromJson(json['institution']),
      );

  String get initials {
    final parts = name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
    if (parts.isEmpty) return '—';
    if (parts.length == 1) {
      return parts.first.substring(0, parts.first.length >= 2 ? 2 : 1).toUpperCase();
    }
    return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
  }
}

class LoginResponse {
  const LoginResponse({required this.token, required this.expiresIn});

  final String token;
  final String expiresIn;

  factory LoginResponse.fromJson(Map<String, dynamic> json) => LoginResponse(
        token: Json.str(json['token']),
        expiresIn: Json.str(json['expiresIn']),
      );
}

class Permissions {
  const Permissions(this.role);

  final Role? role;

  bool get _isAdmin => role == Role.admin;
  bool get _isAnalyst => role == Role.analyst;

  bool get manageUsers => _isAdmin;
  bool get manageInstitutions => _isAdmin;
  bool get seeDataMining => _isAdmin;
  bool get writeStudents => _isAdmin || _isAnalyst;
  bool get runAnalyses => _isAdmin || _isAnalyst;
  bool get manageFollowUps => _isAdmin || _isAnalyst;
  bool get seeAllInstitutions => _isAdmin;
}

class Institution {
  const Institution({
    required this.id,
    required this.name,
    required this.city,
    required this.state,
    required this.type,
    required this.email,
    required this.phone,
    required this.active,
    required this.studentCount,
    required this.userCount,
    required this.analysisCount,
  });

  final String id;
  final String name;
  final String? city;
  final String? state;
  final String? type;
  final String? email;
  final String? phone;
  final bool active;
  final int? studentCount;
  final int? userCount;
  final int? analysisCount;

  factory Institution.fromJson(Map<String, dynamic> json) => Institution(
        id: Json.str(json['id']),
        name: Json.str(json['name']),
        city: Json.strOrNull(json['city']),
        state: Json.strOrNull(json['state']),
        type: Json.strOrNull(json['type']),
        email: Json.strOrNull(json['email']),
        phone: Json.strOrNull(json['phone']),
        active: Json.boolOf(json['active'], true),
        studentCount: Json.intOrNull(json['studentCount']),
        userCount: Json.intOrNull(json['userCount']),
        analysisCount: Json.intOrNull(json['analysisCount']),
      );
}
