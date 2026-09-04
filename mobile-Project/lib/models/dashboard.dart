import 'analysis.dart';
import 'common.dart';
import 'enums.dart';
import 'student.dart';

/// Indicadores consolidados (`GET /api/dashboard`).
class Dashboard {
  const Dashboard({
    required this.totalStudents,
    required this.activeStudents,
    required this.analyzedStudents,
    required this.analysisCoverage,
    required this.pendingAnalysis,
    required this.totalAnalyses,
    required this.analysesInPeriod,
    required this.classificationDistribution,
    required this.priorityDistribution,
    required this.followUpsOpen,
    required this.followUpsOverdue,
    required this.attentionQueue,
    required this.recentAnalyses,
    required this.lastModelUsed,
    required this.lastModelUsedAt,
    required this.disclaimer,
  });

  final int totalStudents;
  final int activeStudents;
  final int analyzedStudents;
  final double analysisCoverage;
  final int pendingAnalysis;
  final int totalAnalyses;
  final int analysesInPeriod;
  final Distribution classificationDistribution;
  final Distribution priorityDistribution;
  final int followUpsOpen;
  final int followUpsOverdue;
  final List<StudentSummary> attentionQueue;
  final List<AnalysisRecord> recentAnalyses;
  final ModelRef? lastModelUsed;
  final DateTime? lastModelUsedAt;
  final String disclaimer;

  bool get hasStudents => totalStudents > 0;

  factory Dashboard.fromJson(Map<String, dynamic> json) {
    final overview = Json.map(json['overview']);
    final followUps = Json.map(json['followUps']);
    final model = Json.mapOrNull(json['lastModelUsed']);

    return Dashboard(
      totalStudents: Json.intOf(overview['totalStudents']),
      activeStudents: Json.intOf(overview['activeStudents']),
      analyzedStudents: Json.intOf(overview['analyzedStudents']),
      analysisCoverage: Json.dbl(overview['analysisCoverage']),
      pendingAnalysis: Json.intOf(overview['pendingAnalysis']),
      totalAnalyses: Json.intOf(overview['totalAnalyses']),
      analysesInPeriod: Json.intOf(overview['analysesInPeriod']),
      classificationDistribution:
          Distribution.fromJson(Json.map(json['classificationDistribution'])),
      priorityDistribution: Distribution.fromJson(Json.map(json['priorityDistribution'])),
      followUpsOpen: Json.intOf(followUps['open']),
      followUpsOverdue: Json.intOf(followUps['overdue']),
      attentionQueue: Json.list(json['attentionQueue']).map(StudentSummary.fromJson).toList(),
      recentAnalyses: Json.list(json['recentAnalyses']).map(AnalysisRecord.fromJson).toList(),
      lastModelUsed: model == null ? null : ModelRef.fromJson(model),
      lastModelUsedAt: model == null ? null : Json.date(model['at']),
      disclaimer: Json.str(json['disclaimer']),
    );
  }
}

/// Ponto da série temporal (`GET /api/dashboard/timeline`).
class TimelinePoint {
  const TimelinePoint({
    required this.period,
    required this.total,
    required this.dropout,
    required this.enrolled,
    required this.graduate,
    required this.highPriority,
  });

  final String period;
  final int total;
  final int dropout;
  final int enrolled;
  final int graduate;
  final int highPriority;

  factory TimelinePoint.fromJson(Map<String, dynamic> json) => TimelinePoint(
        period: Json.str(json['period']),
        total: Json.intOf(json['total']),
        dropout: Json.intOf(json['Dropout']),
        enrolled: Json.intOf(json['Enrolled']),
        graduate: Json.intOf(json['Graduate']),
        highPriority: Json.intOf(json['highPriority']),
      );

  int valueOf(Classification classification) => switch (classification) {
        Classification.dropout => dropout,
        Classification.enrolled => enrolled,
        Classification.graduate => graduate,
      };
}

class Timeline {
  const Timeline({required this.totalAnalyses, required this.series});

  final int totalAnalyses;
  final List<TimelinePoint> series;

  factory Timeline.fromJson(Map<String, dynamic> json) => Timeline(
        totalAnalyses: Json.intOf(json['totalAnalyses']),
        series: Json.list(json['series']).map(TimelinePoint.fromJson).toList(),
      );
}
