from __future__ import annotations

import hashlib
import json
from pathlib import Path

ML_DIR = Path(__file__).resolve().parent
RAW_DATASET = ML_DIR / "predic-students-dataset.csv"

DATA_DIR = ML_DIR / "data"
PROCESSED_DIR = DATA_DIR / "processed"
ARTIFACTS_DIR = ML_DIR / "artifacts"
REPORTS_DIR = ML_DIR / "reports"
FIGURES_DIR = REPORTS_DIR / "figures"

PROCESSED_DATASET = PROCESSED_DIR / "dataset_processed.csv"
LABEL_MAP_FILE = ARTIFACTS_DIR / "label_map.json"
FEATURE_SPEC_FILE = ARTIFACTS_DIR / "feature_spec.json"
PREPARATION_REPORT = REPORTS_DIR / "preparation_report.json"

SCALER_FILE = ARTIFACTS_DIR / "scaler.pkl"
MODEL_FILE = ARTIFACTS_DIR / "model.pkl"
MODEL_METADATA_FILE = ARTIFACTS_DIR / "model_metadata.json"

CSV_SEPARATOR = ";"
CSV_ENCODING = "utf-8-sig"

RANDOM_STATE = 42
TEST_SIZE = 0.20
CV_SPLITS = 10

TARGET_COLUMN_CSV = "Target"
TARGET_COLUMN = "target"

LABEL_MAP: dict[str, int] = {
    "Dropout": 0,
    "Enrolled": 1,
    "Graduate": 2,
}
INVERSE_LABEL_MAP: dict[int, str] = {v: k for k, v in LABEL_MAP.items()}
CLASS_NAMES: list[str] = [INVERSE_LABEL_MAP[i] for i in sorted(INVERSE_LABEL_MAP)]

FEATURES: list[dict[str, str]] = [
    {"csv": "Marital status", "api": "marital_status", "kind": "categorical", "label": "Estado civil"},
    {"csv": "Application mode", "api": "application_mode", "kind": "categorical", "label": "Modalidade de ingresso"},
    {"csv": "Application order", "api": "application_order", "kind": "numeric", "label": "Ordem de opção do curso"},
    {"csv": "Course", "api": "course", "kind": "categorical", "label": "Curso"},
    {"csv": "Daytime/evening attendance", "api": "daytime_evening_attendance", "kind": "binary", "label": "Turno (1=diurno, 0=noturno)"},
    {"csv": "Previous qualification", "api": "previous_qualification", "kind": "categorical", "label": "Qualificação anterior"},
    {"csv": "Previous qualification (grade)", "api": "previous_qualification_grade", "kind": "numeric", "label": "Nota da qualificação anterior"},
    {"csv": "Nacionality", "api": "nationality", "kind": "categorical", "label": "Nacionalidade"},
    {"csv": "Mother's qualification", "api": "mothers_qualification", "kind": "categorical", "label": "Escolaridade da mãe"},
    {"csv": "Father's qualification", "api": "fathers_qualification", "kind": "categorical", "label": "Escolaridade do pai"},
    {"csv": "Mother's occupation", "api": "mothers_occupation", "kind": "categorical", "label": "Ocupação da mãe"},
    {"csv": "Father's occupation", "api": "fathers_occupation", "kind": "categorical", "label": "Ocupação do pai"},
    {"csv": "Admission grade", "api": "admission_grade", "kind": "numeric", "label": "Nota de admissão"},
    {"csv": "Displaced", "api": "displaced", "kind": "binary", "label": "Deslocado da cidade de origem"},
    {"csv": "Educational special needs", "api": "educational_special_needs", "kind": "binary", "label": "Necessidades educacionais especiais"},
    {"csv": "Debtor", "api": "debtor", "kind": "binary", "label": "Inadimplente"},
    {"csv": "Tuition fees up to date", "api": "tuition_fees_up_to_date", "kind": "binary", "label": "Mensalidades em dia"},
    {"csv": "Gender", "api": "gender", "kind": "binary", "label": "Gênero (código do dataset)"},
    {"csv": "Scholarship holder", "api": "scholarship_holder", "kind": "binary", "label": "Bolsista"},
    {"csv": "Age at enrollment", "api": "age_at_enrollment", "kind": "numeric", "label": "Idade na matrícula"},
    {"csv": "International", "api": "international", "kind": "binary", "label": "Estudante internacional"},
    {"csv": "Curricular units 1st sem (credited)", "api": "curricular_units_1st_sem_credited", "kind": "numeric", "label": "UCs 1º sem. aproveitadas"},
    {"csv": "Curricular units 1st sem (enrolled)", "api": "curricular_units_1st_sem_enrolled", "kind": "numeric", "label": "UCs 1º sem. matriculadas"},
    {"csv": "Curricular units 1st sem (evaluations)", "api": "curricular_units_1st_sem_evaluations", "kind": "numeric", "label": "UCs 1º sem. avaliadas"},
    {"csv": "Curricular units 1st sem (approved)", "api": "curricular_units_1st_sem_approved", "kind": "numeric", "label": "UCs 1º sem. aprovadas"},
    {"csv": "Curricular units 1st sem (grade)", "api": "curricular_units_1st_sem_grade", "kind": "numeric", "label": "Média 1º sem."},
    {"csv": "Curricular units 1st sem (without evaluations)", "api": "curricular_units_1st_sem_without_evaluations", "kind": "numeric", "label": "UCs 1º sem. sem avaliação"},
    {"csv": "Curricular units 2nd sem (credited)", "api": "curricular_units_2nd_sem_credited", "kind": "numeric", "label": "UCs 2º sem. aproveitadas"},
    {"csv": "Curricular units 2nd sem (enrolled)", "api": "curricular_units_2nd_sem_enrolled", "kind": "numeric", "label": "UCs 2º sem. matriculadas"},
    {"csv": "Curricular units 2nd sem (evaluations)", "api": "curricular_units_2nd_sem_evaluations", "kind": "numeric", "label": "UCs 2º sem. avaliadas"},
    {"csv": "Curricular units 2nd sem (approved)", "api": "curricular_units_2nd_sem_approved", "kind": "numeric", "label": "UCs 2º sem. aprovadas"},
    {"csv": "Curricular units 2nd sem (grade)", "api": "curricular_units_2nd_sem_grade", "kind": "numeric", "label": "Média 2º sem."},
    {"csv": "Curricular units 2nd sem (without evaluations)", "api": "curricular_units_2nd_sem_without_evaluations", "kind": "numeric", "label": "UCs 2º sem. sem avaliação"},
    {"csv": "Unemployment rate", "api": "unemployment_rate", "kind": "numeric", "label": "Taxa de desemprego"},
    {"csv": "Inflation rate", "api": "inflation_rate", "kind": "numeric", "label": "Taxa de inflação"},
    {"csv": "GDP", "api": "gdp", "kind": "numeric", "label": "PIB"},
]

FEATURE_NAMES: list[str] = [f["api"] for f in FEATURES]
CSV_TO_API: dict[str, str] = {f["csv"]: f["api"] for f in FEATURES}


def normalize_csv_columns(columns) -> list[str]:
    return [str(c).replace("﻿", "").replace("\t", " ").strip() for c in columns]


def dataset_fingerprint(path: Path = RAW_DATASET) -> dict:
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    return {
        "file": path.name,
        "sha256": digest,
        "size_bytes": path.stat().st_size,
    }


def ensure_directories() -> None:
    for directory in (PROCESSED_DIR, ARTIFACTS_DIR, REPORTS_DIR, FIGURES_DIR):
        directory.mkdir(parents=True, exist_ok=True)


def write_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))
