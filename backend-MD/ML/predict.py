from __future__ import annotations

import json
import sys

import joblib
import numpy as np
import pandas as pd

import config as cfg

EXIT_OK = 0
EXIT_ERROR = 1


def fail(code: str, message: str, details: list | None = None) -> None:
    payload = {"ok": False, "error": {"code": code, "message": message}}
    if details:
        payload["error"]["details"] = details
    json.dump(payload, sys.stdout, ensure_ascii=False)
    sys.stdout.flush()
    sys.exit(EXIT_ERROR)


def read_payload() -> dict:
    raw = sys.stdin.read()
    if not raw or not raw.strip():
        fail("INVALID_INPUT", "Nenhum dado recebido no stdin.")
    try:
        return json.loads(raw)
    except json.JSONDecodeError as error:
        fail("INVALID_INPUT", f"JSON inválido no stdin: {error}")
    return {}


def extract_records(payload: dict) -> list[dict]:
    if isinstance(payload, list):
        records = payload
    elif isinstance(payload, dict):
        records = payload.get("records")
        if records is None and any(name in payload for name in cfg.FEATURE_NAMES):
            records = [payload]
    else:
        records = None

    if not isinstance(records, list) or not records:
        fail(
            "INVALID_INPUT",
            "Esperado um objeto com a chave 'records' contendo ao menos um registro.",
        )
    if not all(isinstance(record, dict) for record in records):
        fail("INVALID_INPUT", "Cada item de 'records' deve ser um objeto.")
    return records


def build_matrix(records: list[dict]) -> pd.DataFrame:
    problems: list[dict] = []
    rows: list[list[float]] = []

    for index, record in enumerate(records):
        missing = [name for name in cfg.FEATURE_NAMES if record.get(name) is None]
        if missing:
            problems.append({"index": index, "missing_features": missing})
            continue

        row: list[float] = []
        invalid: list[str] = []
        for name in cfg.FEATURE_NAMES:
            try:
                value = float(record[name])
            except (TypeError, ValueError):
                invalid.append(name)
                continue
            if not np.isfinite(value):
                invalid.append(name)
                continue
            row.append(value)

        if invalid:
            problems.append({"index": index, "invalid_features": invalid})
            continue

        rows.append(row)

    if problems:
        has_missing = any("missing_features" in problem for problem in problems)
        fail(
            "MISSING_FEATURES" if has_missing else "INVALID_FEATURE_VALUE",
            "Registros inválidos: todas as features são obrigatórias e devem ser numéricas finitas.",
            problems,
        )

    return pd.DataFrame(rows, columns=cfg.FEATURE_NAMES)


def load_artifacts() -> tuple[object, object, dict]:
    for path in (cfg.MODEL_FILE, cfg.SCALER_FILE, cfg.MODEL_METADATA_FILE):
        if not path.exists():
            fail(
                "MODEL_NOT_TRAINED",
                f"Artefato de modelo ausente: {path.name}. "
                "Execute o pipeline (ML/prepare_data.py e ML/train_model.py) antes de classificar.",
            )
    return joblib.load(cfg.MODEL_FILE), joblib.load(cfg.SCALER_FILE), cfg.read_json(
        cfg.MODEL_METADATA_FILE
    )


def main() -> None:
    payload = read_payload()
    records = extract_records(payload)
    frame = build_matrix(records)

    model, scaler, metadata = load_artifacts()

    try:
        scaled = scaler.transform(frame)
        predicted = model.predict(scaled)

        probabilities = None
        if hasattr(model, "predict_proba"):
            probabilities = model.predict_proba(scaled)
            model_classes = list(model.classes_)
    except Exception as error:
        fail("INFERENCE_FAILED", f"Falha ao executar a inferência: {error}")
        return

    results = []
    for position, class_id in enumerate(predicted):
        class_id = int(class_id)
        entry = {
            "index": position,
            "classification": cfg.INVERSE_LABEL_MAP.get(class_id, "Unknown"),
            "class_id": class_id,
            "confidence": None,
            "probabilities": None,
        }

        if probabilities is not None:
            row = probabilities[position]
            by_class = {
                cfg.INVERSE_LABEL_MAP.get(int(cls), str(cls)): round(float(prob), 6)
                for cls, prob in zip(model_classes, row)
            }
            entry["probabilities"] = by_class
            entry["confidence"] = round(float(max(row)), 6)

        results.append(entry)

    json.dump(
        {
            "ok": True,
            "model_version": metadata.get("model_version"),
            "algorithm": metadata.get("algorithm"),
            "supports_probability": probabilities is not None,
            "classes": cfg.CLASS_NAMES,
            "results": results,
        },
        sys.stdout,
        ensure_ascii=False,
    )
    sys.stdout.flush()
    sys.exit(EXIT_OK)


if __name__ == "__main__":
    main()
