import 'analysis.dart';
import 'common.dart';
import 'enums.dart';
import 'feature_contract.dart';
import 'follow_up.dart';

/// Estudante na listagem (`GET /api/students`).
///
/// Os campos `last*` são o resumo desnormalizado gravado pelo `backend-Project`
/// na mesma transação da análise — é o que permite listar sem varrer o
/// histórico.
class StudentSummary {
  const StudentSummary({
    required this.id,
    required this.code,
    required this.name,
    required this.email,
    required this.course,
    required this.enrollmentYear,
    required this.institutionId,
    required this.lastClassification,
    required this.lastConfidence,
    required this.lastAnalysisAt,
    required this.lastPriority,
    required this.active,
    required this.institution,
  });

  final String id;
  final String code;
  final String name;
  final String? email;
  final String? course;
  final int? enrollmentYear;
  final String institutionId;
  final Classification? lastClassification;
  final double? lastConfidence;
  final DateTime? lastAnalysisAt;
  final Priority? lastPriority;
  final bool active;
  final NamedRef? institution;

  factory StudentSummary.fromJson(Map<String, dynamic> json) => StudentSummary(
        id: Json.str(json['id']),
        code: Json.str(json['code']),
        name: Json.str(json['name']),
        email: Json.strOrNull(json['email']),
        course: Json.strOrNull(json['course']),
        enrollmentYear: Json.intOrNull(json['enrollmentYear']),
        institutionId: Json.str(json['institutionId']),
        lastClassification: Classification.fromApi(Json.strOrNull(json['lastClassification'])),
        lastConfidence: Json.dblOrNull(json['lastConfidence']),
        lastAnalysisAt: Json.date(json['lastAnalysisAt']),
        lastPriority: Priority.fromApi(Json.strOrNull(json['lastPriority'])),
        active: Json.boolOf(json['active'], true),
        institution: NamedRef.fromJson(json['institution']),
      );
}

/// Detalhe do estudante (`GET /api/students/{id}`), com atributos, histórico de
/// análises e acompanhamentos.
class Student extends StudentSummary {
  const Student({
    required super.id,
    required super.code,
    required super.name,
    required super.email,
    required super.course,
    required super.enrollmentYear,
    required super.institutionId,
    required super.lastClassification,
    required super.lastConfidence,
    required super.lastAnalysisAt,
    required super.lastPriority,
    required super.active,
    required super.institution,
    required this.features,
    required this.featuresStatus,
    required this.analyses,
    required this.followUps,
    required this.createdBy,
    required this.warnings,
  });

  final Map<String, double>? features;
  final FeaturesStatus? featuresStatus;
  final List<AnalysisRecord> analyses;
  final List<FollowUp> followUps;
  final NamedRef? createdBy;
  final List<OutOfRangeWarning> warnings;

  factory Student.fromJson(Map<String, dynamic> json) {
    final summary = StudentSummary.fromJson(json);
    final rawFeatures = json['features'];
    return Student(
      id: summary.id,
      code: summary.code,
      name: summary.name,
      email: summary.email,
      course: summary.course,
      enrollmentYear: summary.enrollmentYear,
      institutionId: summary.institutionId,
      lastClassification: summary.lastClassification,
      lastConfidence: summary.lastConfidence,
      lastAnalysisAt: summary.lastAnalysisAt,
      lastPriority: summary.lastPriority,
      active: summary.active,
      institution: summary.institution,
      features: rawFeatures == null ? null : Json.numbers(rawFeatures),
      featuresStatus: FeaturesStatus.fromJson(json['featuresStatus']),
      analyses: Json.list(json['analyses']).map(AnalysisRecord.fromJson).toList(),
      followUps: Json.list(json['followUps']).map(FollowUp.fromJson).toList(),
      createdBy: NamedRef.fromJson(json['createdBy']),
      warnings: Json.list(json['warnings']).map(OutOfRangeWarning.fromJson).toList(),
    );
  }
}
