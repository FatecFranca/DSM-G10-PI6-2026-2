from __future__ import annotations

import sys

import pandas as pd

import config as cfg


def load_raw() -> pd.DataFrame:
    if not cfg.RAW_DATASET.exists():
        sys.exit(f"[erro] dataset bruto não encontrado: {cfg.RAW_DATASET}")

    frame = pd.read_csv(cfg.RAW_DATASET, sep=cfg.CSV_SEPARATOR, encoding=cfg.CSV_ENCODING)
    frame.columns = cfg.normalize_csv_columns(frame.columns)
    return frame


def inspect(frame: pd.DataFrame) -> dict:
    missing = {col: int(n) for col, n in frame.isna().sum().items() if n > 0}
    duplicated = int(frame.duplicated().sum())
    class_counts = frame[cfg.TARGET_COLUMN_CSV].value_counts().to_dict()
    total = len(frame)

    report = {
        "rows": total,
        "columns": len(frame.columns),
        "dtypes": {col: str(dtype) for col, dtype in frame.dtypes.items()},
        "missing_values": missing,
        "duplicated_rows": duplicated,
        "class_distribution": {
            label: {"count": int(count), "ratio": round(count / total, 4)}
            for label, count in class_counts.items()
        },
    }

    print(f"  linhas x colunas          : {total} x {len(frame.columns)}")
    print(f"  colunas com ausentes      : {len(missing)} {missing if missing else ''}")
    print(f"  linhas duplicadas         : {duplicated}")
    print("  distribuição das classes  :")
    for label, info in report["class_distribution"].items():
        print(f"    {label:<10} {info['count']:>5}  ({info['ratio'] * 100:.1f}%)")

    imbalance = max(class_counts.values()) / min(class_counts.values())
    report["imbalance_ratio"] = round(imbalance, 3)
    print(f"  razão de desbalanceamento : {imbalance:.2f}x (maior classe / menor classe)")
    return report


def validate_contract(frame: pd.DataFrame) -> None:
    expected = set(cfg.CSV_TO_API) | {cfg.TARGET_COLUMN_CSV}
    actual = set(frame.columns)

    missing = expected - actual
    extra = actual - expected

    if missing:
        sys.exit(
            "[erro] colunas declaradas em config.FEATURES ausentes no CSV: "
            + ", ".join(sorted(missing))
        )
    if extra:
        print(f"  [aviso] colunas no CSV fora do contrato (serão descartadas): {sorted(extra)}")


def clean(frame: pd.DataFrame, report: dict) -> pd.DataFrame:
    decisions: list[str] = []
    before = len(frame)

    frame = frame[list(cfg.CSV_TO_API) + [cfg.TARGET_COLUMN_CSV]].copy()
    decisions.append(
        f"Mantidas as {len(cfg.CSV_TO_API)} colunas do contrato de features + alvo; "
        "colunas fora do contrato descartadas."
    )

    duplicated = int(frame.duplicated().sum())
    if duplicated:
        frame = frame.drop_duplicates().reset_index(drop=True)
        decisions.append(f"Removidas {duplicated} linhas duplicadas.")
    else:
        decisions.append("Nenhuma linha duplicada encontrada.")

    missing_target = int(frame[cfg.TARGET_COLUMN_CSV].isna().sum())
    if missing_target:
        frame = frame.dropna(subset=[cfg.TARGET_COLUMN_CSV]).reset_index(drop=True)
        decisions.append(f"Removidas {missing_target} linhas sem variável-alvo.")

    missing_features = frame[list(cfg.CSV_TO_API)].isna().sum()
    imputed = {col: int(n) for col, n in missing_features.items() if n > 0}
    if imputed:
        for col in imputed:
            frame[col] = frame[col].fillna(frame[col].median())
        decisions.append(f"Ausentes imputados pela mediana: {imputed}")
    else:
        decisions.append("Nenhum valor ausente nos atributos — nenhuma imputação aplicada.")

    unknown = sorted(set(frame[cfg.TARGET_COLUMN_CSV].unique()) - set(cfg.LABEL_MAP))
    if unknown:
        sys.exit(
            f"[erro] a coluna alvo contém rótulos fora do mapeamento fixo: {unknown}. "
            "Atualize config.LABEL_MAP antes de prosseguir."
        )

    report["cleaning_decisions"] = decisions
    report["rows_after_cleaning"] = len(frame)
    report["rows_removed"] = before - len(frame)

    print(f"  linhas após limpeza       : {len(frame)} (removidas {before - len(frame)})")
    for decision in decisions:
        print(f"    - {decision}")
    return frame


def transform(frame: pd.DataFrame) -> pd.DataFrame:
    frame = frame.rename(columns=cfg.CSV_TO_API)
    frame[cfg.TARGET_COLUMN] = frame[cfg.TARGET_COLUMN_CSV].map(cfg.LABEL_MAP).astype(int)
    frame = frame.drop(columns=[cfg.TARGET_COLUMN_CSV])
    return frame[cfg.FEATURE_NAMES + [cfg.TARGET_COLUMN]]


def describe_features(frame: pd.DataFrame) -> list[dict]:
    spec = []
    for feature in cfg.FEATURES:
        column = frame[feature["api"]]
        spec.append(
            {
                "name": feature["api"],
                "label": feature["label"],
                "kind": feature["kind"],
                "dtype": "int" if pd.api.types.is_integer_dtype(column) else "float",
                "min": float(column.min()),
                "max": float(column.max()),
                "mean": round(float(column.mean()), 4),
                "required": True,
            }
        )
    return spec


def main() -> None:
    cfg.ensure_directories()

    print("[etapa 2] preparação dos dados")
    print(f"  dataset bruto             : {cfg.RAW_DATASET.name}")

    raw = load_raw()
    validate_contract(raw)
    report = inspect(raw)

    cleaned = clean(raw, report)
    processed = transform(cleaned)

    processed.to_csv(cfg.PROCESSED_DATASET, index=False)

    cfg.write_json(
        cfg.LABEL_MAP_FILE,
        {
            "label_map": cfg.LABEL_MAP,
            "inverse_label_map": {str(k): v for k, v in cfg.INVERSE_LABEL_MAP.items()},
            "classes": cfg.CLASS_NAMES,
        },
    )
    cfg.write_json(
        cfg.FEATURE_SPEC_FILE,
        {
            "feature_count": len(cfg.FEATURE_NAMES),
            "feature_order": cfg.FEATURE_NAMES,
            "features": describe_features(processed),
        },
    )

    report["dataset"] = cfg.dataset_fingerprint()
    report["target_encoding"] = cfg.LABEL_MAP
    report["scaling"] = (
        "StandardScaler é ajustado na etapa 3 (train_model.py), somente sobre o "
        "conjunto de treino, após o split — conforme item 7 da seção 6.1.2, para "
        "evitar data leakage. O dataset persistido aqui NÃO está escalado."
    )
    cfg.write_json(cfg.PREPARATION_REPORT, report)

    print("\n  artefatos gerados:")
    for path in (cfg.PROCESSED_DATASET, cfg.LABEL_MAP_FILE, cfg.FEATURE_SPEC_FILE, cfg.PREPARATION_REPORT):
        print(f"    {path.relative_to(cfg.ML_DIR)}")
    print("\n[etapa 2] concluída — próximo passo: python ML/train_model.py")


if __name__ == "__main__":
    main()
