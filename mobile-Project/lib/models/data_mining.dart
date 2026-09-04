import 'enums.dart';

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

class ModelCandidate {
  const ModelCandidate({
    required this.algorithm,
    required this.cvAccuracyMean,
    required this.cvF1MacroMean,
    required this.cvRecallDropoutMean,
    required this.cvSelectionScore,
    required this.overfitGap,
  });

  final String algorithm;
  final double cvAccuracyMean;
  final double cvF1MacroMean;
  final double cvRecallDropoutMean;
  final double cvSelectionScore;
  final double overfitGap;

  factory ModelCandidate.fromJson(Map<String, dynamic> json) => ModelCandidate(
        algorithm: Json.str(json['algorithm']),
        cvAccuracyMean: Json.dbl(json['cv_accuracy_mean']),
        cvF1MacroMean: Json.dbl(json['cv_f1_macro_mean']),
        cvRecallDropoutMean: Json.dbl(json['cv_recall_dropout_mean']),
        cvSelectionScore: Json.dbl(json['cv_selection_score']),
        overfitGap: Json.dbl(json['overfit_gap']),
      );
}

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
    required this.testRecallDropout,
    required this.devAccuracy,
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
  final double testRecallDropout;
  final double devAccuracy;
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
      testRecallDropout: Json.dbl(evaluation['test_recall_dropout']),
      devAccuracy: Json.dbl(evaluation['dev_accuracy']),
      overfitGap: Json.dbl(evaluation['generalization_gap']),
      cvFolds: Json.intOf(evaluation['cv_folds']),
      cvAccuracyMean: Json.dbl(evaluation['cv_accuracy_mean']),
      confusionMatrix: ConfusionMatrix.fromJson(Json.map(evaluation['confusion_matrix'])),
      classificationReport: report,
      environment: environment,
      disclaimer: Json.str(json['disclaimer']),
    );
  }
}
