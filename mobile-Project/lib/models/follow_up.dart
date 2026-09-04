import 'common.dart';
import 'enums.dart';

/// Ação de acompanhamento aberta a partir de uma análise.
class FollowUp {
  const FollowUp({
    required this.id,
    required this.studentId,
    required this.analysisId,
    required this.title,
    required this.notes,
    required this.status,
    required this.priority,
    required this.dueDate,
    required this.resolvedAt,
    required this.createdAt,
    required this.student,
    required this.assignedTo,
    required this.createdBy,
  });

  final String id;
  final String studentId;
  final String? analysisId;
  final String title;
  final String? notes;
  final FollowUpStatus status;
  final Priority? priority;
  final DateTime? dueDate;
  final DateTime? resolvedAt;
  final DateTime? createdAt;
  final NamedRef? student;
  final NamedRef? assignedTo;
  final NamedRef? createdBy;

  factory FollowUp.fromJson(Map<String, dynamic> json) => FollowUp(
        id: Json.str(json['id']),
        studentId: Json.str(json['studentId']),
        analysisId: Json.strOrNull(json['analysisId']),
        title: Json.str(json['title']),
        notes: Json.strOrNull(json['notes']),
        status: FollowUpStatus.fromApi(Json.strOrNull(json['status'])),
        priority: Priority.fromApi(Json.strOrNull(json['priority'])),
        dueDate: Json.date(json['dueDate']),
        resolvedAt: Json.date(json['resolvedAt']),
        createdAt: Json.date(json['createdAt']),
        student: NamedRef.fromJson(json['student']),
        assignedTo: NamedRef.fromJson(json['assignedTo']),
        createdBy: NamedRef.fromJson(json['createdBy']),
      );

  /// Prazo vencido e ainda em aberto — mesma regra da tela Web.
  bool get isOverdue =>
      dueDate != null &&
      dueDate!.isBefore(DateTime.now()) &&
      (status == FollowUpStatus.open || status == FollowUpStatus.inProgress);
}
