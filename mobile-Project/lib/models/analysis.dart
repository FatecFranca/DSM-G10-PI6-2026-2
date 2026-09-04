import 'common.dart';
import 'enums.dart';
import 'feature_contract.dart';

class Recommendation {
  const Recommendation({
    required this.priority,
    required this.label,
    required this.description,
    required this.confidentSignal,
  });

  final Priority? priority;
  final String label;
  final String description;
  final bool confidentSignal;

  factory Recommendation.fromJson(Map<String, dynamic> json) {
    final factors = Json.map(json['factors']);
    return Recommendation(
      priority: Priority.fromApi(Json.strOrNull(json['priority'])),
      label: Json.str(json['label']),
      description: Json.str(json['description']),
      confidentSignal: Json.boolOf(factors['confidentSignal']),
    );
  }
}

class ModelRef {
  const ModelRef({required this.version, required this.algorithm});

  final String version;
  final String algorithm;

  factory ModelRef.fromJson(Map<String, dynamic> json) => ModelRef(
        version: Json.str(json['version']),
        algorithm: Json.str(json['algorithm']),
      );
}

class AnalysisResult {
  const AnalysisResult({
    required this.id,
    required this.studentId,
    required this.classification,
    required this.classId,
    required this.confidence,
    required this.probabilities,
    required this.recommendation,
    required this.model,
    required this.student,
    required this.warnings,
    required this.disclaimer,
    required this.createdAt,
  });

  final String? id;
  final String? studentId;
  final Classification? classification;
  final int classId;
  final double? confidence;
  final Map<String, double> probabilities;
  final Recommendation recommendation;
  final ModelRef model;
  final NamedRef? student;
  final List<OutOfRangeWarning> warnings;
  final String disclaimer;
  final DateTime? createdAt;

  factory AnalysisResult.fromJson(Map<String, dynamic> json) {
    final analysis = Json.map(json['analysis']);
    return AnalysisResult(
      id: Json.strOrNull(json['id']),
      studentId: Json.strOrNull(json['studentId']),
      classification: Classification.fromApi(Json.strOrNull(analysis['classification'])),
      classId: Json.intOf(analysis['classId']),
      confidence: Json.dblOrNull(analysis['confidence']),
      probabilities: Json.numbers(analysis['probabilities']),
      recommendation: Recommendation.fromJson(Json.map(json['recommendation'])),
      model: ModelRef.fromJson(Json.map(json['model'])),
      student: NamedRef.fromJson(json['student']),
      warnings: Json.list(json['warnings']).map(OutOfRangeWarning.fromJson).toList(),
      disclaimer: Json.str(json['disclaimer']),
      createdAt: Json.date(json['createdAt']),
    );
  }
}

class AnalysisRecord {
  const AnalysisRecord({
    required this.id,
    required this.studentId,
    required this.classification,
    required this.confidence,
    required this.priority,
    required this.modelVersion,
    required this.algorithm,
    required this.createdAt,
    required this.student,
    required this.requestedBy,
  });

  final String id;
  final String studentId;
  final Classification? classification;
  final double? confidence;
  final Priority? priority;
  final String modelVersion;
  final String algorithm;
  final DateTime? createdAt;
  final NamedRef? student;
  final NamedRef? requestedBy;

  factory AnalysisRecord.fromJson(Map<String, dynamic> json) => AnalysisRecord(
        id: Json.str(json['id']),
        studentId: Json.str(json['studentId']),
        classification: Classification.fromApi(Json.strOrNull(json['classification'])),
        confidence: Json.dblOrNull(json['confidence']),
        priority: Priority.fromApi(Json.strOrNull(json['priority'])),
        modelVersion: Json.str(json['modelVersion']),
        algorithm: Json.str(json['algorithm']),
        createdAt: Json.date(json['createdAt']),
        student: NamedRef.fromJson(json['student']),
        requestedBy: NamedRef.fromJson(json['requestedBy']),
      );
}

class BatchAnalysisResponse {
  const BatchAnalysisResponse({required this.analyzed, required this.skipped});

  final int analyzed;
  final int skipped;

  factory BatchAnalysisResponse.fromJson(Map<String, dynamic> json) => BatchAnalysisResponse(
        analyzed: Json.intOf(json['analyzed']),
        skipped: Json.list(json['skipped']).length,
      );
}
