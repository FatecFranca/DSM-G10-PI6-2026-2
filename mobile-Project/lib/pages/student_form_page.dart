import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../core/theme.dart';
import '../models/feature_contract.dart';
import '../models/student.dart';
import '../models/user.dart';
import '../services/api_services.dart';
import '../state/api_error_text.dart';
import '../state/auth_state.dart';
import '../state/i18n_state.dart';
import '../widgets/app_shell.dart';
import '../widgets/features_form.dart';
import '../widgets/ui.dart';

class StudentFormPage extends StatefulWidget {
  const StudentFormPage({super.key, this.studentId});

  final String? studentId;

  bool get isEdit => studentId != null;

  @override
  State<StudentFormPage> createState() => _StudentFormPageState();
}

class _StudentFormPageState extends State<StudentFormPage> {
  final _code = TextEditingController();
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _course = TextEditingController();
  final _enrollmentYear = TextEditingController();

  FeatureContract? _contract;
  List<Institution> _institutions = const [];
  String? _institutionId;

  Map<String, double?> _featureValues = {};
  int _featuresRevision = 0;

  bool _loading = true;
  bool _saving = false;
  String? _loadError;
  String? _generalError;
  Map<String, String> _fieldErrors = {};

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  @override
  void dispose() {
    _code.dispose();
    _name.dispose();
    _email.dispose();
    _course.dispose();
    _enrollmentYear.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final api = context.read<Api>();
    final can = context.read<AuthState>().can;

    setState(() {
      _loading = true;
      _loadError = null;
    });

    try {
      final contract = await api.students.featureContract();
      Student? student;
      if (widget.isEdit) student = await api.students.get(widget.studentId!);

      List<Institution> institutions = const [];
      if (can.seeAllInstitutions) {
        institutions = (await api.institutions.list(limit: 100, active: true)).data;
      }

      if (!mounted) return;

      if (student != null) {
        _code.text = student.code;
        _name.text = student.name;
        _email.text = student.email ?? '';
        _course.text = student.course ?? '';
        _enrollmentYear.text =
            student.enrollmentYear == null ? '' : '${student.enrollmentYear}';
      }

      setState(() {
        _contract = contract;
        _institutions = institutions;
        _institutionId = student?.institutionId;
        _featureValues = initialFeatureValues(contract.features, student?.features);
        _featuresRevision++;
        _loading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _loadError = describeApiError(context.i18nRead, error);
        _loading = false;
      });
    }
  }

  int get _missingCount {
    final contract = _contract;
    if (contract == null) return 0;
    return contract.features
        .where((feature) => _featureValues[feature.name] == null)
        .length;
  }

  Future<void> _submit() async {
    final t = context.i18nRead;
    final api = context.read<Api>();
    final can = context.read<AuthState>().can;

    setState(() {
      _saving = true;
      _generalError = null;
      _fieldErrors = {};
    });

    final features = toFeaturePayload(_featureValues);
    final payload = <String, Object?>{
      'code': _code.text.trim(),
      'name': _name.text.trim(),
      if (_email.text.trim().isNotEmpty) 'email': _email.text.trim(),
      if (_course.text.trim().isNotEmpty) 'course': _course.text.trim(),
      if (_enrollmentYear.text.trim().isNotEmpty)
        'enrollmentYear': int.tryParse(_enrollmentYear.text.trim()),
      if (can.seeAllInstitutions && _institutionId != null) 'institutionId': _institutionId,
      if (features.isNotEmpty) 'features': features,
    };

    try {
      final saved = widget.isEdit
          ? await api.students.update(widget.studentId!, payload)
          : await api.students.create(payload);

      if (!mounted) return;
      showToast(
        context,
        t.t(widget.isEdit ? 'students.updated' : 'students.created'),
        tone: AlertTone.success,
      );
      if (saved.warnings.isNotEmpty) {
        showToast(context, t.t('students.outOfRangeHint'));
      }
      context.go('/students/${saved.id}');
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _fieldErrors = apiFieldIssues(error);
        _generalError = describeApiError(t, error);
      });
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.i18n;
    final auth = context.watch<AuthState>();
    final can = auth.can;

    if (!can.writeStudents) {
      return AppScaffold(
        title: t.t('students.new'),
        child: AppAlert(tone: AlertTone.danger, message: t.t('errors.INSUFFICIENT_ROLE')),
      );
    }

    if (_loading) {
      return AppScaffold(
        title: widget.isEdit ? t.t('students.edit') : t.t('students.new'),
        child: const LoadingState(),
      );
    }

    if (_loadError != null || _contract == null) {
      return AppScaffold(
        title: widget.isEdit ? t.t('students.edit') : t.t('students.new'),
        child: AppStack(
          children: [
            ErrorStateView(message: _loadError ?? t.t('errors.generic'), onRetry: _load),
            AppAlert(
              tone: AlertTone.warning,
              title: t.t('dataMining.unavailable'),
              message: t.t('dataMining.unavailableHint'),
            ),
          ],
        ),
      );
    }

    final contract = _contract!;
    final missing = _missingCount;
    final boundsInvalid = hasOutOfBoundsValues(contract.features, _featureValues);

    return AppScaffold(
      title: widget.isEdit ? t.t('students.edit') : t.t('students.new'),
      subtitle: t.t('students.subtitle'),
      actions: [
        AppButton(
          label: t.t('common.cancel'),
          variant: ButtonVariant.ghost,
          onPressed: _saving
              ? null
              : () => context.go(
                    widget.isEdit ? '/students/${widget.studentId}' : '/students',
                  ),
        ),
        AppButton(
          label: _saving ? t.t('common.saving') : t.t('common.save'),
          variant: ButtonVariant.primary,
          loading: _saving,
          onPressed: boundsInvalid ? null : _submit,
        ),
      ],
      child: AppStack(
        children: [
          if (_generalError != null)
            AppAlert(tone: AlertTone.danger, message: _generalError!),

          AppCard(
            title: t.t('students.basicData'),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                LabeledField(
                  label: t.t('students.code'),
                  required: true,
                  error: _fieldErrors['code'],
                  child: AppTextField(
                    controller: _code,
                    enabled: !_saving,
                    invalid: _fieldErrors.containsKey('code'),
                  ),
                ),
                const SizedBox(height: 14),
                LabeledField(
                  label: t.t('students.name'),
                  required: true,
                  error: _fieldErrors['name'],
                  child: AppTextField(
                    controller: _name,
                    enabled: !_saving,
                    invalid: _fieldErrors.containsKey('name'),
                  ),
                ),
                const SizedBox(height: 14),
                LabeledField(
                  label: t.t('students.email'),
                  error: _fieldErrors['email'],
                  child: AppTextField(
                    controller: _email,
                    keyboardType: TextInputType.emailAddress,
                    enabled: !_saving,
                    invalid: _fieldErrors.containsKey('email'),
                  ),
                ),
                const SizedBox(height: 14),
                LabeledField(
                  label: t.t('students.course'),
                  error: _fieldErrors['course'],
                  child: AppTextField(controller: _course, enabled: !_saving),
                ),
                const SizedBox(height: 14),
                LabeledField(
                  label: t.t('students.enrollmentYear'),
                  error: _fieldErrors['enrollmentYear'],
                  child: AppTextField(
                    controller: _enrollmentYear,
                    keyboardType: TextInputType.number,
                    enabled: !_saving,
                  ),
                ),
                const SizedBox(height: 14),
                if (can.seeAllInstitutions)
                  LabeledField(
                    label: t.t('students.institution'),
                    required: true,
                    error: _fieldErrors['institutionId'],
                    child: AppDropdown<String?>(
                      value: _institutionId,
                      enabled: !_saving && !widget.isEdit,
                      invalid: _fieldErrors.containsKey('institutionId'),
                      onChanged: (value) => setState(() => _institutionId = value),
                      items: [
                        (value: null, label: t.t('common.select')),
                        for (final institution in _institutions)
                          (value: institution.id, label: institution.name),
                      ],
                    ),
                  )
                else
                  LabeledField(
                    label: t.t('students.institution'),
                    child: InputDecorator(
                      decoration: const InputDecoration(enabled: false),
                      child: Text(
                        auth.user?.institution?.name ?? '—',
                        style: TextStyle(fontSize: 14, color: context.colors.textMuted),
                      ),
                    ),
                  ),
              ],
            ),
          ),

          AppCard(
            title: t.t('students.attributes'),
            hint: t.t('students.attributesHint'),
            actions: [
              AppBadge(
                label: missing == 0
                    ? t.t('students.attributesComplete')
                    : t.t('students.filledOf', {
                        'filled': contract.featureCount - missing,
                        'total': contract.featureCount,
                      }),
                color: missing == 0 ? context.colors.success : context.colors.warning,
              ),
            ],
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (missing > 0) ...[
                  AppAlert(message: t.t('students.cannotAnalyze')),
                  const SizedBox(height: AppSizes.gap),
                ],
                FeaturesForm(
                  features: contract.features,
                  values: _featureValues,
                  revision: _featuresRevision,
                  disabled: _saving,
                  fieldErrors: _fieldErrors,
                  onChanged: (name, value) => setState(() => _featureValues[name] = value),
                  onFillWithMeans: () => setState(() {
                    _featureValues = fillWithMeans(contract.features, _featureValues);
                    _featuresRevision++;
                  }),
                  onClear: () => setState(() {
                    _featureValues = initialFeatureValues(contract.features, null);
                    _featuresRevision++;
                  }),
                ),
              ],
            ),
          ),

          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              AppButton(
                label: t.t('common.cancel'),
                variant: ButtonVariant.ghost,
                onPressed: _saving
                    ? null
                    : () => context.go(
                          widget.isEdit ? '/students/${widget.studentId}' : '/students',
                        ),
              ),
              const SizedBox(width: 8),
              AppButton(
                label: _saving ? t.t('common.saving') : t.t('common.save'),
                variant: ButtonVariant.primary,
                loading: _saving,
                onPressed: boundsInvalid ? null : _submit,
              ),
            ],
          ),
        ],
      ),
    );
  }
}
