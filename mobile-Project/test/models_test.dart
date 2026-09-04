import 'package:flutter_test/flutter_test.dart';
import 'package:pae_mobile/models/analysis.dart';
import 'package:pae_mobile/models/common.dart';
import 'package:pae_mobile/models/enums.dart';
import 'package:pae_mobile/models/follow_up.dart';
import 'package:pae_mobile/models/student.dart';

void main() {
  group('enums do contrato da API', () {
    test('mantêm o texto exato usado como chave de tradução', () {
      expect(Classification.dropout.api, 'Dropout');
      expect(Priority.high.api, 'HIGH');
      expect(FollowUpStatus.inProgress.api, 'IN_PROGRESS');
      // Acentuado de propósito: a chave de tradução é `attention.média`.
      expect(AttentionLevel.media.api, 'média');
    });

    test('convertem valores desconhecidos sem quebrar', () {
      expect(Classification.fromApi('Outro'), isNull);
      expect(Priority.fromApi(null), isNull);
      expect(Role.fromApi('DESCONHECIDO'), Role.viewer);
      expect(FollowUpStatus.fromApi(null), FollowUpStatus.open);
    });
  });

  group('conversores tolerantes', () {
    test('aceitam número vindo como texto e ignoram tipo inesperado', () {
      expect(Json.intOf('42'), 42);
      expect(Json.dbl(7), 7.0);
      expect(Json.dblOrNull(null), isNull);
      expect(Json.intOf(const {}), 0);
    });

    test('numbers descarta entradas não numéricas', () {
      final result = Json.numbers({'a': 1, 'b': '2.5', 'c': 'x', 'd': null});
      expect(result, {'a': 1.0, 'b': 2.5});
    });
  });

  test('Paginated lê a página e os itens', () {
    final page = Paginated.fromJson({
      'data': [
        {'id': '1', 'code': 'A1', 'name': 'Estudante', 'institutionId': 'i1'},
      ],
      'pagination': {'page': 2, 'limit': 20, 'total': 21, 'totalPages': 2},
    }, StudentSummary.fromJson);

    expect(page.data.single.name, 'Estudante');
    expect(page.pagination.page, 2);
    expect(page.pagination.totalPages, 2);
  });

  test('AnalysisResult lê classificação, prioridade e agrupamento', () {
    final result = AnalysisResult.fromJson({
      'id': 'a1',
      'studentId': 's1',
      'analysis': {
        'classification': 'Dropout',
        'classId': 0,
        'confidence': 0.78,
        'probabilities': {'Dropout': 0.78, 'Enrolled': 0.14, 'Graduate': 0.08},
      },
      'recommendation': {
        'priority': 'HIGH',
        'label': 'Acompanhamento prioritário',
        'description': 'texto',
        'factors': {'escalatedByCluster': true, 'clusterAttentionLevel': 'alta'},
      },
      'cluster': {
        'clusterId': 2,
        'clusterVersion': 'v1',
        'attentionLevel': 'alta',
        'profile': {'size': 842, 'dropoutRatio': 0.825},
      },
      'model': {'version': 'v1', 'algorithm': 'LinearDiscriminantAnalysis'},
      'disclaimer': 'apoio à decisão',
    });

    expect(result.classification, Classification.dropout);
    expect(result.recommendation.priority, Priority.high);
    expect(result.recommendation.escalatedByCluster, isTrue);
    expect(result.cluster!.attentionLevel, AttentionLevel.alta);
    expect(result.cluster!.profileDropoutRatio, 0.825);
    expect(result.probabilities.length, 3);
  });

  test('análise sem agrupamento não quebra a leitura', () {
    final result = AnalysisResult.fromJson({
      'analysis': {'classification': 'Graduate', 'classId': 2, 'confidence': null},
      'recommendation': {'priority': 'LOW', 'label': '', 'description': ''},
      'cluster': null,
      'model': {'version': 'v1', 'algorithm': 'LDA'},
      'disclaimer': '',
    });

    expect(result.cluster, isNull);
    expect(result.confidence, isNull);
    expect(result.probabilities, isEmpty);
  });

  group('FollowUp.isOverdue', () {
    FollowUp build(String status, DateTime? dueDate) => FollowUp.fromJson({
          'id': 'f1',
          'studentId': 's1',
          'title': 'Contato',
          'status': status,
          'priority': 'MEDIUM',
          'dueDate': dueDate?.toIso8601String(),
        });

    final ontem = DateTime.now().subtract(const Duration(days: 1));
    final amanha = DateTime.now().add(const Duration(days: 1));

    test('vencido só quando ainda está em aberto', () {
      expect(build('OPEN', ontem).isOverdue, isTrue);
      expect(build('IN_PROGRESS', ontem).isOverdue, isTrue);
      expect(build('DONE', ontem).isOverdue, isFalse);
      expect(build('CANCELLED', ontem).isOverdue, isFalse);
    });

    test('não vencido sem prazo ou com prazo futuro', () {
      expect(build('OPEN', null).isOverdue, isFalse);
      expect(build('OPEN', amanha).isOverdue, isFalse);
    });
  });

  test('Student lê atributos, situação do cadastro e histórico', () {
    final student = Student.fromJson({
      'id': 's1',
      'code': '2026-0001',
      'name': 'João da Silva',
      'institutionId': 'i1',
      'features': {'age_at_enrollment': 20, 'admission_grade': 127.3},
      'featuresStatus': {'complete': false, 'filled': 2, 'total': 36, 'missing': ['gender']},
      'analyses': [
        {
          'id': 'a1',
          'studentId': 's1',
          'classification': 'Enrolled',
          'priority': 'MEDIUM',
          'modelVersion': 'v1',
          'algorithm': 'LDA',
        },
      ],
    });

    expect(student.features, {'age_at_enrollment': 20.0, 'admission_grade': 127.3});
    expect(student.featuresStatus!.complete, isFalse);
    expect(student.featuresStatus!.filled, 2);
    expect(student.analyses.single.classification, Classification.enrolled);
    expect(student.followUps, isEmpty);
  });
}
