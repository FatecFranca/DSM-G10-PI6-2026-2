from __future__ import annotations

import json
import sys

import joblib
import numpy as np

import config as cfg

from predict import build_matrix, extract_records, fail, read_payload


def load_artifacts() -> tuple[object, object, dict]:
    for path in (cfg.CLUSTER_MODEL_FILE, cfg.CLUSTER_METADATA_FILE, cfg.SCALER_FILE):
        if not path.exists():
            fail(
                "CLUSTERING_NOT_TRAINED",
                f"Artefato de clusterização ausente: {path.name}. "
                "Execute ML/train_clusters.py antes de solicitar agrupamento.",
            )
    try:
        model = joblib.load(cfg.CLUSTER_MODEL_FILE)
        scaler = joblib.load(cfg.SCALER_FILE)
        metadata = cfg.read_json(cfg.CLUSTER_METADATA_FILE)
    except Exception as error:
        fail(
            "CLUSTER_ARTIFACT_CORRUPTED",
            "Falha ao carregar os artefatos de agrupamento — arquivo corrompido ou incompatível "
            f"com a versão instalada das bibliotecas: {error}. "
            "Execute ML/train_clusters.py novamente para regenerar os artefatos.",
        )
    return model, scaler, metadata


def main() -> None:
    payload = read_payload()
    records = extract_records(payload)
    frame = build_matrix(records)

    model, scaler, metadata = load_artifacts()
    profiles_by_id = {profile["cluster_id"]: profile for profile in metadata.get("profiles", [])}

    try:
        scaled = scaler.transform(frame)
        assigned = model.predict(scaled)
        distances = model.transform(scaled)
    except Exception as error:
        fail("INFERENCE_FAILED", f"Falha ao atribuir o grupo: {error}")
        return

    results = []
    for position, cluster_id in enumerate(assigned):
        cluster_id = int(cluster_id)
        profile = profiles_by_id.get(cluster_id, {})
        results.append(
            {
                "index": position,
                "cluster_id": cluster_id,
                "distance": round(float(np.min(distances[position])), 6),
                "attention_level": profile.get("attention_level"),
                "profile": {
                    "size": profile.get("size"),
                    "ratio": profile.get("ratio"),
                    "dropout_ratio": profile.get("dropout_ratio"),
                    "class_distribution": profile.get("class_distribution"),
                    "feature_means": profile.get("feature_means"),
                },
            }
        )

    json.dump(
        {
            "ok": True,
            "cluster_version": metadata.get("cluster_version"),
            "algorithm": metadata.get("algorithm"),
            "k": metadata.get("k"),
            "results": results,
        },
        sys.stdout,
        ensure_ascii=False,
    )
    sys.stdout.flush()


if __name__ == "__main__":
    main()
