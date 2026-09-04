import '../core/api_client.dart';
import '../models/analysis.dart';
import '../models/common.dart';
import '../models/dashboard.dart';
import '../models/data_mining.dart';
import '../models/enums.dart';
import '../models/feature_contract.dart';
import '../models/follow_up.dart';
import '../models/student.dart';
import '../models/user.dart';

/// Serviços de API, um por área funcional — espelho de
/// `frontend-Project/src/services/index.ts`.
///
/// Toda rede do aplicativo passa por aqui. Nenhuma tela monta URL, e não
/// existe endpoint paralelo para o Mobile: os contratos são os mesmos
/// consumidos por Web e Desktop (seção 6 e seção 13 do `.IA/CONTEXT.md`).
class AuthService {
  const AuthService(this._api);
  final ApiClient _api;

  Future<LoginResponse> login(String email, String password) async {
    final json = await _api.post<Map<String, dynamic>>(
      '/auth/login',
      {'email': email, 'password': password},
      true, // skipAuthRedirect: 401 aqui é credencial errada, não sessão expirada
    );
    return LoginResponse.fromJson(json);
  }

  Future<User> me() async => User.fromJson(await _api.get<Map<String, dynamic>>('/auth/me'));

  Future<void> changePassword(String currentPassword, String newPassword) => _api.post<void>(
        '/auth/change-password',
        {'currentPassword': currentPassword, 'newPassword': newPassword},
      );

  Future<void> forgotPassword(String email) =>
      _api.post<void>('/auth/forgot-password', {'email': email}, true);

  Future<void> resetPassword(String token, String newPassword) =>
      _api.post<void>('/auth/reset-password', {'token': token, 'newPassword': newPassword}, true);
}

class StudentsService {
  const StudentsService(this._api);
  final ApiClient _api;

  Future<FeatureContract> featureContract() async => FeatureContract.fromJson(
        await _api.get<Map<String, dynamic>>('/students/feature-contract'),
      );

  Future<Paginated<StudentSummary>> list({
    int page = 1,
    int limit = 20,
    String? search,
    String? classification,
    String? priority,
    bool? analyzed,
    String? sort,
  }) async {
    final json = await _api.get<Map<String, dynamic>>('/students', {
      'page': page,
      'limit': limit,
      'search': search,
      'classification': classification,
      'priority': priority,
      'analyzed': analyzed,
      'sort': sort,
    });
    return Paginated.fromJson(json, StudentSummary.fromJson);
  }

  Future<Student> get(String id) async =>
      Student.fromJson(await _api.get<Map<String, dynamic>>('/students/$id'));

  Future<Student> create(Map<String, Object?> payload) async =>
      Student.fromJson(await _api.post<Map<String, dynamic>>('/students', payload));

  Future<Student> update(String id, Map<String, Object?> payload) async =>
      Student.fromJson(await _api.patch<Map<String, dynamic>>('/students/$id', payload));

  Future<void> deactivate(String id) => _api.delete<void>('/students/$id');
}

class AnalysesService {
  const AnalysesService(this._api);
  final ApiClient _api;

  Future<Paginated<AnalysisRecord>> list({
    int page = 1,
    int limit = 20,
    String? studentId,
    String? classification,
    String? priority,
    DateTime? from,
    DateTime? to,
  }) async {
    final json = await _api.get<Map<String, dynamic>>('/analyses', {
      'page': page,
      'limit': limit,
      'studentId': studentId,
      'classification': classification,
      'priority': priority,
      'from': from?.toUtc().toIso8601String(),
      'to': to?.toUtc().toIso8601String(),
    });
    return Paginated.fromJson(json, AnalysisRecord.fromJson);
  }

  Future<AnalysisResult> get(String id) async =>
      AnalysisResult.fromJson(await _api.get<Map<String, dynamic>>('/analyses/$id'));

  Future<AnalysisResult> runForStudent(String studentId, {bool includeClustering = true}) async =>
      AnalysisResult.fromJson(await _api.post<Map<String, dynamic>>(
        '/analyses/student/$studentId',
        {'includeClustering': includeClustering},
      ));

  /// Preferível a N chamadas unitárias: cada requisição ao `backend-MD` paga o
  /// custo de subir o interpretador Python uma vez, não uma vez por estudante.
  Future<BatchAnalysisResponse> runBatch(
    List<String> studentIds, {
    bool includeClustering = true,
  }) async =>
      BatchAnalysisResponse.fromJson(await _api.post<Map<String, dynamic>>(
        '/analyses/batch',
        {'studentIds': studentIds, 'includeClustering': includeClustering},
      ));

  /// Classifica sem persistir — nada entra no histórico.
  Future<AnalysisResult> simulate(
    Map<String, double> features, {
    bool includeClustering = true,
  }) async =>
      AnalysisResult.fromJson(await _api.post<Map<String, dynamic>>(
        '/analyses/simulate',
        {'features': features, 'includeClustering': includeClustering},
      ));
}

class FollowUpsService {
  const FollowUpsService(this._api);
  final ApiClient _api;

  Future<Paginated<FollowUp>> list({
    int page = 1,
    int limit = 20,
    String? studentId,
    String? status,
    String? priority,
    bool? mine,
    bool? overdue,
  }) async {
    final json = await _api.get<Map<String, dynamic>>('/follow-ups', {
      'page': page,
      'limit': limit,
      'studentId': studentId,
      'status': status,
      'priority': priority,
      'mine': mine == true ? true : null,
      'overdue': overdue == true ? true : null,
    });
    return Paginated.fromJson(json, FollowUp.fromJson);
  }

  Future<FollowUp> create({
    required String studentId,
    String? analysisId,
    required String title,
    String? notes,
    Priority? priority,
    DateTime? dueDate,
  }) async =>
      FollowUp.fromJson(await _api.post<Map<String, dynamic>>('/follow-ups', {
        'studentId': studentId,
        'analysisId': ?analysisId,
        'title': title,
        if (notes != null && notes.isNotEmpty) 'notes': notes,
        if (priority != null) 'priority': priority.api,
        if (dueDate != null) 'dueDate': dueDate.toUtc().toIso8601String(),
      }));

  Future<FollowUp> updateStatus(String id, FollowUpStatus status) async =>
      FollowUp.fromJson(await _api.patch<Map<String, dynamic>>(
        '/follow-ups/$id',
        {'status': status.api},
      ));
}

class DashboardService {
  const DashboardService(this._api);
  final ApiClient _api;

  Future<Dashboard> get({int days = 180}) async =>
      Dashboard.fromJson(await _api.get<Map<String, dynamic>>('/dashboard', {'days': days}));

  Future<Timeline> timeline({int days = 180, String granularity = 'month'}) async =>
      Timeline.fromJson(await _api.get<Map<String, dynamic>>(
        '/dashboard/timeline',
        {'days': days, 'granularity': granularity},
      ));
}

class DataMiningService {
  const DataMiningService(this._api);
  final ApiClient _api;

  Future<ClusterProfilesResponse> profiles() async => ClusterProfilesResponse.fromJson(
        await _api.get<Map<String, dynamic>>('/datamining/profiles'),
      );

  Future<ModelProcessResponse> model() async => ModelProcessResponse.fromJson(
        await _api.get<Map<String, dynamic>>('/datamining/model'),
      );

  Future<ClusterDistributionResponse> clusterDistribution() async =>
      ClusterDistributionResponse.fromJson(
        await _api.get<Map<String, dynamic>>('/datamining/cluster-distribution'),
      );
}

class UsersService {
  const UsersService(this._api);
  final ApiClient _api;

  Future<Paginated<User>> list({
    int page = 1,
    int limit = 20,
    String? search,
    String? role,
  }) async {
    final json = await _api.get<Map<String, dynamic>>('/users', {
      'page': page,
      'limit': limit,
      'search': search,
      'role': role,
    });
    return Paginated.fromJson(json, User.fromJson);
  }

  Future<void> create(Map<String, Object?> payload) => _api.post<void>('/users', payload);

  Future<void> update(String id, Map<String, Object?> payload) =>
      _api.patch<void>('/users/$id', payload);

  Future<void> resetPassword(String id, String newPassword) =>
      _api.post<void>('/users/$id/password', {'newPassword': newPassword});

  Future<void> deactivate(String id) => _api.delete<void>('/users/$id');
}

class InstitutionsService {
  const InstitutionsService(this._api);
  final ApiClient _api;

  Future<Paginated<Institution>> list({
    int page = 1,
    int limit = 20,
    String? search,
    bool? active,
  }) async {
    final json = await _api.get<Map<String, dynamic>>('/institutions', {
      'page': page,
      'limit': limit,
      'search': search,
      'active': active,
    });
    return Paginated.fromJson(json, Institution.fromJson);
  }

  Future<void> create(Map<String, Object?> payload) => _api.post<void>('/institutions', payload);

  Future<void> update(String id, Map<String, Object?> payload) =>
      _api.patch<void>('/institutions/$id', payload);

  Future<void> deactivate(String id) => _api.delete<void>('/institutions/$id');
}

/// Ponto único de acesso aos serviços, injetado por Provider.
class Api {
  Api(this.client)
      : auth = AuthService(client),
        students = StudentsService(client),
        analyses = AnalysesService(client),
        followUps = FollowUpsService(client),
        dashboard = DashboardService(client),
        dataMining = DataMiningService(client),
        users = UsersService(client),
        institutions = InstitutionsService(client);

  final ApiClient client;
  final AuthService auth;
  final StudentsService students;
  final AnalysesService analyses;
  final FollowUpsService followUps;
  final DashboardService dashboard;
  final DataMiningService dataMining;
  final UsersService users;
  final InstitutionsService institutions;
}
