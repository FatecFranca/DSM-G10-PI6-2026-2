import 'enums.dart';

/// Perfil (cluster) descoberto por aprendizado não supervisionado sobre o
/// conjunto de treino.
///
/// É leitura de padrões gerais, **não** predição individual, e não entra na
/// classificação — apenas pode elevar a prioridade, no Back-End.
class ClusterProfile {
  const ClusterProfile({
    required this.clusterId,
    required this.size,
    required this.ratio,
    required this.dropoutRatio,
    required this.attentionLevel,
    required this.classDistribution,
    required this.featureMeans,
  });

  final int clusterId;
  final int size;
  final double ratio;
  final double dropoutRatio;
  final AttentionLevel? attentionLevel;

  /// `classe -> { count, ratio }`.
  final Map<String, ({int count, double ratio})> classDistribution;
  final Map<String, double> featureMeans;

  factory ClusterProfile.fromJson(Map<String, dynamic> json) {
    final distribution = <String, ({int count, double ratio})>{};
    Json.map(json['classDistribution']).forEach((key, value) {
      final entry = Json.map(value);
      distribution[key] = (count: Json.intOf(entry['count']), ratio: Json.dbl(entry['ratio']));
    });

    return ClusterProfile(
      clusterId: Json.intOf(json['clusterId']),
      size: Json.intOf(json['size']),
      ratio: Json.dbl(json['ratio']),
      dropoutRatio: Json.dbl(json['dropoutRatio']),
      attentionLevel: AttentionLevel.fromApi(Json.strOrNull(json['attentionLevel'])),
      classDistribution: distribution,
      featureMeans: Json.numbers(json['featureMeans']),
    );
  }
}

class ClusteringInfo {
  const ClusteringInfo({
    required this.version,
    required this.algorithm,
    required this.k,
    required this.silhouette,
    required this.trainedAt,
  });

  final String version;
  final String algorithm;
  final int k;
  final double silhouette;
  final DateTime? trainedAt;

  factory ClusteringInfo.fromJson(Map<String, dynamic> json) => ClusteringInfo(
        version: Json.str(json['version']),
        algorithm: Json.str(json['algorithm']),
        k: Json.intOf(json['k']),
        silhouette: Json.dbl(json['silhouette']),
        trainedAt: Json.date(json['trainedAt']),
      );
}

class ClusterProfilesResponse {
  const ClusterProfilesResponse({
    required this.clustering,
    required this.selectionRationale,
    required this.profiles,
    required this.disclaimer,
  });

  final ClusteringInfo clustering;
  final String selectionRationale;
  final List<ClusterProfile> profiles;
  final String disclaimer;

  factory ClusterProfilesResponse.fromJson(Map<String, dynamic> json) => ClusterProfilesResponse(
        clustering: ClusteringInfo.fromJson(Json.map(json['clustering'])),
        selectionRationale: Json.str(json['selectionRationale']),
        profiles: Json.list(json['profiles']).map(ClusterProfile.fromJson).toList(),
        disclaimer: Json.str(json['disclaimer']),
      );
}

/// Quantos estudantes já analisados nesta base caíram em cada perfil.
class ClusterDistributionEntry {
  const ClusterDistributionEntry({
    required this.clusterId,
    required this.attentionLevel,
    required this.dropoutRatio,
    required this.localCount,
    required this.localRatio,
  });

  final int clusterId;
  final AttentionLevel? attentionLevel;
  final double dropoutRatio;
  final int localCount;
  final double localRatio;

  factory ClusterDistributionEntry.fromJson(Map<String, dynamic> json) =>
      ClusterDistributionEntry(
        clusterId: Json.intOf(json['clusterId']),
        attentionLevel: AttentionLevel.fromApi(Json.strOrNull(json['attentionLevel'])),
        dropoutRatio: Json.dbl(json['dropoutRatio']),
        localCount: Json.intOf(json['localCount']),
        localRatio: Json.dbl(json['localRatio']),
      );
}

class ClusterDistributionResponse {
  const ClusterDistributionResponse({
    required this.totalAnalysesWithCluster,
    required this.distribution,
  });

  final int totalAnalysesWithCluster;
  final List<ClusterDistributionEntry> distribution;

  factory ClusterDistributionResponse.fromJson(Map<String, dynamic> json) =>
      ClusterDistributionResponse(
        totalAnalysesWithCluster: Json.intOf(json['totalAnalysesWithCluster']),
        distribution:
            Json.list(json['distribution']).map(ClusterDistributionEntry.fromJson).toList(),
      );
}

class FeatureImportanceItem {
  const FeatureImportanceItem({required this.feature, required this.importance});

  final String feature;
  final double importance;

  factory FeatureImportanceItem.fromJson(Map<String, dynamic> json) => FeatureImportanceItem(
        feature: Json.str(json['feature']),
        importance: Json.dbl(json['importance']),
      );
}

class ConfusionMatrix {
  const ConfusionMatrix({required this.labels, required this.matrix});

  final List<String> labels;
  final List<List<int>> matrix;

  factory ConfusionMatrix.fromJson(Map<String, dynamic> json) {
    final rows = json['matrix'];
    return ConfusionMatrix(
      labels: Json.strings(json['labels']),
      matrix: rows is List
          ? rows
              .whereType<List>()
              .map((row) => row.map((cell) => Json.intOf(cell)).toList())
              .toList()
          : const [],
    );
  }
}

class ClassMetrics {
  const ClassMetrics({
    required this.precision,
    required this.recall,
    required this.f1,
    required this.support,
  });

  final double precision;
  final double recall;
  final double f1;
  final int support;

  factory ClassMetrics.fromJson(Map<String, dynamic> json) => ClassMetrics(
        precision: Json.dbl(json['precision']),
        recall: Json.dbl(json['recall']),
        f1: Json.dbl(json['f1-score']),
        support: Json.intOf(json['support']),
      );
}

/// Um algoritmo candidato da comparação registrada no treino.
class ModelCandidate {
  const ModelCandidate({
    required this.algorithm,
    required this.cvAccuracyMean,
    required this.trainAccuracy,
    required this.testAccuracy,
    required this.testF1Macro,
    required this.overfitGap,
  });

  final String algorithm;
  final double cvAccuracyMean;
  final double trainAccuracy;
  final double testAccuracy;
  final double testF1Macro;
  final double overfitGap;

  factory ModelCandidate.fromJson(Map<String, dynamic> json) => ModelCandidate(
        algorithm: Json.str(json['algorithm']),
        cvAccuracyMean: Json.dbl(json['cv_accuracy_mean']),
        trainAccuracy: Json.dbl(json['train_accuracy']),
        testAccuracy: Json.dbl(json['test_accuracy']),
        testF1Macro: Json.dbl(json['test_f1_macro']),
        overfitGap: Json.dbl(json['overfit_gap']),
      );
}

/// Processo completo do modelo em uso (`GET /api/datamining/model`), que é como
/// a plataforma demonstra as etapas de Mineração de Dados.
class ModelProcessResponse {
  const ModelProcessResponse({
    required this.version,
    required this.algorithm,
    required this.classes,
    required this.trainedAt,
    required this.dataUnderstanding,
    required this.preparation,
    required this.featureCount,
    required this.importance,
    required this.importanceMethod,
    required this.candidates,
    required this.selectionRationale,
    required this.testAccuracy,
    required this.testF1Macro,
    required this.trainAccuracy,
    required this.overfitGap,
    required this.cvFolds,
    required this.cvAccuracyMean,
    required this.confusionMatrix,
    required this.classificationReport,
    required this.environment,
    required this.disclaimer,
  });

  final String version;
  final String algorithm;
  final List<String> classes;
  final DateTime? trainedAt;
  final Map<String, dynamic> dataUnderstanding;
  final Map<String, dynamic> preparation;
  final int featureCount;
  final List<FeatureImportanceItem> importance;
  final String? importanceMethod;
  final List<ModelCandidate> candidates;
  final String selectionRationale;
  final double testAccuracy;
  final double testF1Macro;
  final double trainAccuracy;
  final double overfitGap;
  final int cvFolds;
  final double cvAccuracyMean;
  final ConfusionMatrix confusionMatrix;
  final Map<String, ClassMetrics> classificationReport;
  final Map<String, String> environment;
  final String disclaimer;

  factory ModelProcessResponse.fromJson(Map<String, dynamic> json) {
    final model = Json.map(json['model']);
    final process = Json.map(json['process']);
    final featureSelection = Json.map(process['featureSelection']);
    final modelSelection = Json.map(process['modelSelection']);
    final evaluation = Json.map(process['evaluation']);

    final report = <String, ClassMetrics>{};
    Json.map(evaluation['classification_report']).forEach((key, value) {
      final entry = Json.mapOrNull(value);
      if (entry != null && entry.containsKey('precision')) {
        report[key] = ClassMetrics.fromJson(entry);
      }
    });

    final environment = <String, String>{};
    Json.map(json['environment']).forEach((key, value) {
      environment[key] = '$value';
    });

    return ModelProcessResponse(
      version: Json.str(model['version']),
      algorithm: Json.str(model['algorithm']),
      classes: Json.strings(model['classes']),
      trainedAt: Json.date(model['trainedAt']),
      dataUnderstanding: Json.map(process['dataUnderstanding']),
      preparation: Json.map(process['preparation']),
      featureCount: Json.intOf(featureSelection['count']),
      importance:
          Json.list(featureSelection['importance']).map(FeatureImportanceItem.fromJson).toList(),
      importanceMethod: Json.strOrNull(featureSelection['importanceMethod']),
      candidates: Json.list(modelSelection['candidates']).map(ModelCandidate.fromJson).toList(),
      selectionRationale: Json.str(modelSelection['rationale']),
      testAccuracy: Json.dbl(evaluation['test_accuracy']),
      testF1Macro: Json.dbl(evaluation['test_f1_macro']),
      trainAccuracy: Json.dbl(evaluation['train_accuracy']),
      overfitGap: Json.dbl(evaluation['overfit_gap']),
      cvFolds: Json.intOf(evaluation['cv_folds']),
      cvAccuracyMean: Json.dbl(evaluation['cv_accuracy_mean']),
      confusionMatrix: ConfusionMatrix.fromJson(Json.map(evaluation['confusion_matrix'])),
      classificationReport: report,
      environment: environment,
      disclaimer: Json.str(json['disclaimer']),
    );
  }
}
