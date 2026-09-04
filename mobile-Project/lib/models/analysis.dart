import 'common.dart';
import 'enums.dart';
import 'feature_contract.dart';

/// Leitura de acompanhamento derivada pelo `backend-Project`.
///
/// A prioridade é **regra de negócio do Back-End** (`priority.js`): o app
/// apenas apresenta. Nunca recalcular aqui (seção 6, item 3 do `.IA/CONTEXT.md`).
class Recommendation {
  const Recommendation({
    required this.priority,
    required this.label,
    required this.description,
    required this.escalatedByCluster,
    required this.clusterAttentionLevel,
    required this.confidentSignal,
  });

  final Priority? priority;
  final String label;
  final String description;
  final bool escalatedByCluster;
  final AttentionLevel? clusterAttentionLevel;
  final bool confidentSignal;

  factory Recommendation.fromJson(Map<String, dynamic> json) {
    final factors = Json.map(json['factors']);
    return Recommendation(
      priority: Priority.fromApi(Json.strOrNull(json['priority'])),
      label: Json.str(json['label']),
      description: Json.str(json['description']),
      escalatedByCluster: Json.boolOf(factors['escalatedByCluster']),
      clusterAttentionLevel:
          AttentionLevel.fromApi(Json.strOrNull(factors['clusterAttentionLevel'])),
      confidentSignal: Json.boolOf(factors['confidentSignal']),
    );
  }
}

/// Perfil de agrupamento atribuído a um estudante nesta análise.
class ClusterAssignment {
  const ClusterAssignment({
    required this.clusterId,
    required this.clusterVersion,
    required this.attentionLevel,
    required this.distance,
    required this.profileSize,
    required this.profileDropoutRatio,
  });

  final int clusterId;
  final String? clusterVersion;
  final AttentionLevel? attentionLevel;
  final double? distance;
  final int? profileSize;
  final double? profileDropoutRatio;

  static ClusterAssignment? fromJson(Object? value) {
    final json = Json.mapOrNull(value);
    if (json == null) return null;
    final profile = Json.map(json['profile']);
    return ClusterAssignment(
      clusterId: Json.intOf(json['clusterId']),
      clusterVersion: Json.strOrNull(json['clusterVersion']),
      attentionLevel: AttentionLevel.fromApi(Json.strOrNull(json['attentionLevel'])),
      distance: Json.dblOrNull(json['distance']),
      profileSize: Json.intOrNull(profile['size']),
      profileDropoutRatio: Json.dblOrNull(profile['dropoutRatio']),
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

/// Resultado completo de uma análise (simulada ou persistida).
class AnalysisResult {
  const AnalysisResult({
    required this.id,
    required this.studentId,
    required this.classification,
    required this.classId,
    required this.confidence,
    required this.probabilities,
    required this.recommendation,
    required this.cluster,
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
  final ClusterAssignment? cluster;
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
      cluster: ClusterAssignment.fromJson(json['cluster']),
      model: ModelRef.fromJson(Json.map(json['model'])),
      student: NamedRef.fromJson(json['student']),
      warnings: Json.list(json['warnings']).map(OutOfRangeWarning.fromJson).toList(),
      disclaimer: Json.str(json['disclaimer']),
      createdAt: Json.date(json['createdAt']),
    );
  }
}

/// Linha do histórico de análises.
class AnalysisRecord {
  const AnalysisRecord({
    required this.id,
    required this.studentId,
    required this.classification,
    required this.confidence,
    required this.priority,
    required this.modelVersion,
    required this.algorithm,
    required this.clusterId,
    required this.attentionLevel,
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
  final int? clusterId;
  final AttentionLevel? attentionLevel;
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
        clusterId: Json.intOrNull(json['clusterId']),
        attentionLevel: AttentionLevel.fromApi(Json.strOrNull(json['attentionLevel'])),
        createdAt: Json.date(json['createdAt']),
        student: NamedRef.fromJson(json['student']),
        requestedBy: NamedRef.fromJson(json['requestedBy']),
      );
}

/// Resposta de `POST /api/analyses/batch`.
class BatchAnalysisResponse {
  const BatchAnalysisResponse({required this.analyzed, required this.skipped});

  final int analyzed;
  final int skipped;

  factory BatchAnalysisResponse.fromJson(Map<String, dynamic> json) => BatchAnalysisResponse(
        analyzed: Json.intOf(json['analyzed']),
        skipped: Json.list(json['skipped']).length,
      );
}
