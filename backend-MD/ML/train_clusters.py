from __future__ import annotations

import platform
import sys
from datetime import datetime, timezone

import joblib
import numpy as np
import pandas as pd
import sklearn
from sklearn.cluster import KMeans
from sklearn.metrics import calinski_harabasz_score, davies_bouldin_score, silhouette_score

import config as cfg

K_RANGE = range(2, 9)

PROFILE_FEATURES = [
    "age_at_enrollment",
    "admission_grade",
    "previous_qualification_grade",
    "curricular_units_1st_sem_approved",
    "curricular_units_1st_sem_grade",
    "curricular_units_2nd_sem_approved",
    "curricular_units_2nd_sem_grade",
    "scholarship_holder",
    "debtor",
    "tuition_fees_up_to_date",
    "displaced",
]


def load_inputs() -> tuple[pd.DataFrame, object]:
    if not cfg.PROCESSED_DATASET.exists():
        sys.exit(
            f"[erro] dataset tratado não encontrado: {cfg.PROCESSED_DATASET}\n"
            "        execute primeiro: python ML/prepare_data.py"
        )
    if not cfg.SCALER_FILE.exists():
        sys.exit(
            f"[erro] scaler não encontrado: {cfg.SCALER_FILE}\n"
            "        execute primeiro: python ML/train_model.py"
        )
    return pd.read_csv(cfg.PROCESSED_DATASET), joblib.load(cfg.SCALER_FILE)


def choose_k(scaled: np.ndarray) -> tuple[int, list[dict]]:
    evaluations = []
    print("\n[seleção de k] comparação de números de grupos")
    print(f"  {'k':>3} {'silhueta':>12} {'davies-bouldin':>18} {'calinski-harabasz':>20}")

    for k in K_RANGE:
        model = KMeans(n_clusters=k, n_init=10, random_state=cfg.RANDOM_STATE).fit(scaled)
        labels = model.labels_
        entry = {
            "k": k,
            "silhouette": round(float(silhouette_score(scaled, labels)), 4),
            "davies_bouldin": round(float(davies_bouldin_score(scaled, labels)), 4),
            "calinski_harabasz": round(float(calinski_harabasz_score(scaled, labels)), 2),
            "inertia": round(float(model.inertia_), 2),
        }
        evaluations.append(entry)
        print(
            f"  {k:>3} {entry['silhouette']:>12.4f} "
            f"{entry['davies_bouldin']:>18.4f} {entry['calinski_harabasz']:>20.2f}"
        )

    best = max(evaluations, key=lambda entry: entry["silhouette"])
    print(f"\n  k escolhido: {best['k']} (silhueta {best['silhouette']:.4f})")
    return best["k"], evaluations


def build_profiles(frame: pd.DataFrame, labels: np.ndarray) -> list[dict]:
    total = len(frame)
    profiles = []

    for cluster_id in sorted(set(int(label) for label in labels)):
        mask = labels == cluster_id
        subset = frame[mask]

        class_counts = subset[cfg.TARGET_COLUMN].value_counts().to_dict()
        distribution = {
            class_name: {
                "count": int(class_counts.get(class_id, 0)),
                "ratio": round(class_counts.get(class_id, 0) / len(subset), 4),
            }
            for class_id, class_name in cfg.INVERSE_LABEL_MAP.items()
        }

        dropout_ratio = distribution["Dropout"]["ratio"]
        if dropout_ratio >= 0.50:
            attention = "alta"
        elif dropout_ratio >= 0.25:
            attention = "média"
        else:
            attention = "baixa"

        profiles.append(
            {
                "cluster_id": cluster_id,
                "size": int(mask.sum()),
                "ratio": round(float(mask.sum()) / total, 4),
                "class_distribution": distribution,
                "dropout_ratio": dropout_ratio,
                "attention_level": attention,
                "feature_means": {
                    name: round(float(subset[name].mean()), 4) for name in PROFILE_FEATURES
                },
            }
        )

    return sorted(profiles, key=lambda profile: profile["dropout_ratio"], reverse=True)


def main() -> None:
    cfg.ensure_directories()

    print("[não supervisionado] descoberta de perfis de estudantes (KMeans)")

    frame, scaler = load_inputs()
    X = frame[cfg.FEATURE_NAMES]
    scaled = scaler.transform(X)
    print(f"  registros                 : {len(frame)}")
    print(f"  atributos                 : {len(cfg.FEATURE_NAMES)}")

    best_k, evaluations = choose_k(scaled)

    model = KMeans(n_clusters=best_k, n_init=10, random_state=cfg.RANDOM_STATE).fit(scaled)
    labels = model.labels_
    profiles = build_profiles(frame, labels)

    print("\n  perfis identificados (ordenados por proporção de Dropout)")
    print(f"  {'grupo':>6}{'tamanho':>10}{'%':>8}{'Dropout':>10}{'Enrolled':>10}{'Graduate':>10}{'atenção':>10}")
    for profile in profiles:
        dist = profile["class_distribution"]
        print(
            f"  {profile['cluster_id']:>6}{profile['size']:>10}{profile['ratio'] * 100:>7.1f}%"
            f"{dist['Dropout']['ratio'] * 100:>9.1f}%{dist['Enrolled']['ratio'] * 100:>9.1f}%"
            f"{dist['Graduate']['ratio'] * 100:>9.1f}%{profile['attention_level']:>10}"
        )

    trained_at = datetime.now(timezone.utc)
    cluster_version = f"KMeans-k{best_k}-{trained_at.strftime('%Y%m%dT%H%M%S')}"

    joblib.dump(model, cfg.CLUSTER_MODEL_FILE)

    metadata = {
        "cluster_version": cluster_version,
        "algorithm": "KMeans",
        "task": "unsupervised-clustering",
        "k": best_k,
        "hyperparameters": {
            key: (value if isinstance(value, (int, float, str, bool, type(None))) else str(value))
            for key, value in model.get_params().items()
        },
        "selection_rationale": (
            f"k={best_k} escolhido por maximizar o coeficiente de silhueta "
            f"entre k={K_RANGE.start} e k={K_RANGE.stop - 1}."
        ),
        "metrics": {
            "silhouette": round(float(silhouette_score(scaled, labels)), 4),
            "davies_bouldin": round(float(davies_bouldin_score(scaled, labels)), 4),
            "calinski_harabasz": round(float(calinski_harabasz_score(scaled, labels)), 2),
            "inertia": round(float(model.inertia_), 2),
            "k_evaluations": evaluations,
        },
        "features": {"count": len(cfg.FEATURE_NAMES), "order": cfg.FEATURE_NAMES},
        "preprocessing": {
            "scaler": "StandardScaler (reutilizado da etapa 3, artifacts/scaler.pkl)"
        },
        "profiles": profiles,
        "profile_features": PROFILE_FEATURES,
        "dataset": {**cfg.dataset_fingerprint(), "rows": int(len(frame))},
        "trained_at": trained_at.isoformat(),
        "environment": {
            "python": platform.python_version(),
            "scikit_learn": sklearn.__version__,
            "pandas": pd.__version__,
            "numpy": np.__version__,
            "joblib": joblib.__version__,
        },
        "disclaimer": (
            "Agrupamento é análise exploratória complementar. A distribuição de "
            "classes por grupo descreve os dados históricos do grupo e não é uma "
            "predição para um estudante individual."
        ),
    }
    cfg.write_json(cfg.CLUSTER_METADATA_FILE, metadata)

    print("\n  artefatos gerados:")
    for path in (cfg.CLUSTER_MODEL_FILE, cfg.CLUSTER_METADATA_FILE):
        print(f"    {path.relative_to(cfg.ML_DIR)}")
    print("\n[não supervisionado] concluído")


if __name__ == "__main__":
    main()
