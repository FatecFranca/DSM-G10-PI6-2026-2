from __future__ import annotations

import platform
import sys
from datetime import datetime, timezone

import joblib
import numpy as np
import pandas as pd
import sklearn
from sklearn.discriminant_analysis import LinearDiscriminantAnalysis
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    balanced_accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
)
from sklearn.model_selection import StratifiedKFold, cross_validate, train_test_split
from sklearn.naive_bayes import GaussianNB
from sklearn.neighbors import KNeighborsClassifier
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVC
from sklearn.tree import DecisionTreeClassifier

import config as cfg

EQUIVALENCE_TOLERANCE = 0.01


def build_candidates() -> dict[str, object]:
    return {
        "LogisticRegression": LogisticRegression(
            max_iter=1000, random_state=cfg.RANDOM_STATE
        ),
        "LinearDiscriminantAnalysis": LinearDiscriminantAnalysis(),
        "KNeighborsClassifier": KNeighborsClassifier(n_neighbors=15),
        "DecisionTreeClassifier": DecisionTreeClassifier(
            max_depth=8, min_samples_leaf=10, random_state=cfg.RANDOM_STATE
        ),
        "GaussianNB": GaussianNB(),
        "SVC": SVC(kernel="rbf", C=1.0, probability=True, random_state=cfg.RANDOM_STATE),
        "RandomForestClassifier": RandomForestClassifier(
            n_estimators=300, min_samples_leaf=2, random_state=cfg.RANDOM_STATE, n_jobs=-1
        ),
        "RandomForestBalanced": RandomForestClassifier(
            n_estimators=300,
            min_samples_leaf=2,
            class_weight="balanced",
            random_state=cfg.RANDOM_STATE,
            n_jobs=-1,
        ),
        "GradientBoostingClassifier": GradientBoostingClassifier(
            random_state=cfg.RANDOM_STATE
        ),
    }


def compute_feature_importance(model) -> tuple[list[dict] | None, str | None]:
    if hasattr(model, "feature_importances_"):
        values = np.asarray(model.feature_importances_, dtype=float)
        method = "tree_feature_importances (redução de impureza)"
    elif hasattr(model, "coef_"):
        coefficients = np.atleast_2d(np.asarray(model.coef_, dtype=float))
        values = np.abs(coefficients).mean(axis=0)
        total = values.sum()
        values = values / total if total > 0 else values
        method = (
            "mean_abs_coefficient (média do |coeficiente| entre as classes, "
            "sobre features padronizadas, normalizada para somar 1)"
        )
    else:
        return None, None

    pairs = sorted(zip(cfg.FEATURE_NAMES, values), key=lambda pair: pair[1], reverse=True)
    return (
        [{"feature": name, "importance": round(float(value), 6)} for name, value in pairs],
        method,
    )


def load_processed() -> pd.DataFrame:
    if not cfg.PROCESSED_DATASET.exists():
        sys.exit(
            f"[erro] dataset tratado não encontrado: {cfg.PROCESSED_DATASET}\n"
            "        execute primeiro: python ML/prepare_data.py"
        )
    return pd.read_csv(cfg.PROCESSED_DATASET)


def cross_validate_candidates(X_train, y_train) -> list[dict]:
    kfold = StratifiedKFold(
        n_splits=cfg.CV_SPLITS, shuffle=True, random_state=cfg.RANDOM_STATE
    )
    results = []

    print(f"\n[passo 4] validação cruzada ({cfg.CV_SPLITS} folds estratificados)")
    print(f"  {'algoritmo':<30} {'acurácia':>18} {'F1 macro':>18}")

    for name, estimator in build_candidates().items():
        pipeline = Pipeline([("scaler", StandardScaler()), ("model", estimator)])
        scores = cross_validate(
            pipeline,
            X_train,
            y_train,
            cv=kfold,
            scoring=("accuracy", "f1_macro"),
            n_jobs=1,
        )
        entry = {
            "algorithm": name,
            "cv_accuracy_mean": round(float(scores["test_accuracy"].mean()), 4),
            "cv_accuracy_std": round(float(scores["test_accuracy"].std()), 4),
            "cv_f1_macro_mean": round(float(scores["test_f1_macro"].mean()), 4),
            "cv_f1_macro_std": round(float(scores["test_f1_macro"].std()), 4),
        }
        results.append(entry)
        print(
            f"  {name:<30} "
            f"{entry['cv_accuracy_mean']:.4f} (+/-{entry['cv_accuracy_std']:.4f}) "
            f"{entry['cv_f1_macro_mean']:.4f} (+/-{entry['cv_f1_macro_std']:.4f})"
        )

    return results


def evaluate_candidates(X_train_scaled, y_train, X_test_scaled, y_test, cv_results) -> list[dict]:
    print("\n[passo 5] treino e avaliação em treino/teste")
    print(f"  {'algoritmo':<30} {'acc treino':>12} {'acc teste':>12} {'F1 macro teste':>16}")

    cv_by_name = {entry["algorithm"]: entry for entry in cv_results}
    evaluated = []

    for name, estimator in build_candidates().items():
        estimator.fit(X_train_scaled, y_train)

        train_pred = estimator.predict(X_train_scaled)
        test_pred = estimator.predict(X_test_scaled)

        entry = dict(cv_by_name[name])
        entry.update(
            {
                "train_accuracy": round(float(accuracy_score(y_train, train_pred)), 4),
                "test_accuracy": round(float(accuracy_score(y_test, test_pred)), 4),
                "test_balanced_accuracy": round(
                    float(balanced_accuracy_score(y_test, test_pred)), 4
                ),
                "test_f1_macro": round(float(f1_score(y_test, test_pred, average="macro")), 4),
                "estimator": estimator,
            }
        )
        entry["overfit_gap"] = round(entry["train_accuracy"] - entry["test_accuracy"], 4)
        evaluated.append(entry)

        print(
            f"  {name:<30} {entry['train_accuracy']:>12.4f} "
            f"{entry['test_accuracy']:>12.4f} {entry['test_f1_macro']:>16.4f}"
        )

    return evaluated


def select_final(evaluated: list[dict]) -> dict:
    ranked = sorted(evaluated, key=lambda e: (e["test_f1_macro"], e["test_accuracy"]), reverse=True)
    best_f1 = ranked[0]["test_f1_macro"]

    tied = [e for e in ranked if best_f1 - e["test_f1_macro"] <= EQUIVALENCE_TOLERANCE]
    winner = min(tied, key=lambda e: (e["overfit_gap"], -e["test_f1_macro"]))

    tied_summary = ", ".join(
        f"{e['algorithm']} (F1 {e['test_f1_macro']:.4f}, gap {e['overfit_gap']:.4f})" for e in tied
    )

    winner["selection_rationale"] = (
        f"Critério: F1 macro no conjunto de teste como métrica principal (adotado "
        f"em lugar da acurácia por causa do desbalanceamento entre as três classes), "
        f"com desempate por generalização. O melhor F1 macro observado foi "
        f"{best_f1:.4f} ({ranked[0]['algorithm']}); {len(tied)} candidato(s) ficaram "
        f"dentro da tolerância de {EQUIVALENCE_TOLERANCE} e foram considerados "
        f"estatisticamente equivalentes: {tied_summary}. Entre eles foi escolhido "
        f"{winner['algorithm']}, o de menor distância treino-teste "
        f"({winner['overfit_gap']:.4f}), conforme a exigência de escolher pelo "
        f"desempenho generalizável e não apenas pelo desempenho no treino. "
        f"Desempenho do modelo escolhido — F1 macro no teste: "
        f"{winner['test_f1_macro']:.4f}; acurácia no teste: {winner['test_accuracy']:.4f}; "
        f"acurácia no treino: {winner['train_accuracy']:.4f}; acurácia balanceada no "
        f"teste: {winner['test_balanced_accuracy']:.4f}. Média na validação cruzada "
        f"de {cfg.CV_SPLITS} folds sobre o treino: acurácia "
        f"{winner['cv_accuracy_mean']:.4f}, F1 macro {winner['cv_f1_macro_mean']:.4f}."
    )
    winner["selection_criteria"] = {
        "primary_metric": "test_f1_macro",
        "tie_breaker": "menor overfit_gap (train_accuracy - test_accuracy)",
        "equivalence_tolerance": EQUIVALENCE_TOLERANCE,
        "best_test_f1_macro": best_f1,
        "tied_candidates": [e["algorithm"] for e in tied],
    }
    return winner


def main() -> None:
    cfg.ensure_directories()

    print("[etapa 3] treinamento e seleção do modelo")

    frame = load_processed()

    X = frame[cfg.FEATURE_NAMES]
    y = frame[cfg.TARGET_COLUMN]
    print(f"  atributos (X)             : {X.shape}")
    print(f"  alvo (Y)                  : {y.shape}")

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=cfg.TEST_SIZE,
        random_state=cfg.RANDOM_STATE,
        stratify=y,
    )
    print(f"  treino / teste            : {len(X_train)} / {len(X_test)}")
    print("  proporção das classes     : treino vs teste")
    for class_id, class_name in cfg.INVERSE_LABEL_MAP.items():
        train_ratio = float((y_train == class_id).mean())
        test_ratio = float((y_test == class_id).mean())
        print(f"    {class_name:<10} {train_ratio * 100:>5.1f}%  vs {test_ratio * 100:>5.1f}%")

    scaler = StandardScaler().fit(X_train)
    X_train_scaled = scaler.transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    cv_results = cross_validate_candidates(X_train, y_train)
    evaluated = evaluate_candidates(X_train_scaled, y_train, X_test_scaled, y_test, cv_results)
    winner = select_final(evaluated)

    final_model = winner.pop("estimator")
    algorithm = winner["algorithm"]

    print(f"\n[passo 6] modelo final: {algorithm}")
    print(f"  {winner['selection_rationale']}")

    test_pred = final_model.predict(X_test_scaled)
    matrix = confusion_matrix(y_test, test_pred, labels=sorted(cfg.INVERSE_LABEL_MAP))
    report = classification_report(
        y_test,
        test_pred,
        labels=sorted(cfg.INVERSE_LABEL_MAP),
        target_names=cfg.CLASS_NAMES,
        output_dict=True,
        zero_division=0,
    )

    print("\n  matriz de confusão (linhas = real, colunas = previsto)")
    header = "            " + "".join(f"{name:>10}" for name in cfg.CLASS_NAMES)
    print(header)
    for idx, row in enumerate(matrix):
        print(f"  {cfg.CLASS_NAMES[idx]:<10}" + "".join(f"{int(value):>10}" for value in row))

    print("\n  relatório por classe")
    print(f"  {'classe':<12}{'precisão':>10}{'revocação':>12}{'F1':>10}{'suporte':>10}")
    for class_name in cfg.CLASS_NAMES:
        metrics = report[class_name]
        print(
            f"  {class_name:<12}{metrics['precision']:>10.4f}{metrics['recall']:>12.4f}"
            f"{metrics['f1-score']:>10.4f}{int(metrics['support']):>10}"
        )

    feature_importance, importance_method = compute_feature_importance(final_model)
    if feature_importance:
        print(f"\n  10 atributos mais influentes (método: {importance_method})")
        for item in feature_importance[:10]:
            print(f"    {item['feature']:<50}{item['importance']:.4f}")

    trained_at = datetime.now(timezone.utc)
    model_version = f"{algorithm}-{trained_at.strftime('%Y%m%dT%H%M%S')}"

    joblib.dump(final_model, cfg.MODEL_FILE)
    joblib.dump(scaler, cfg.SCALER_FILE)

    metadata = {
        "model_version": model_version,
        "contract_version": "1.0.0",
        "algorithm": algorithm,
        "task": "supervised-classification",
        "classes": cfg.CLASS_NAMES,
        "label_map": cfg.LABEL_MAP,
        "hyperparameters": {
            key: (value if isinstance(value, (int, float, str, bool, type(None))) else str(value))
            for key, value in final_model.get_params().items()
        },
        "dataset": {
            **cfg.dataset_fingerprint(),
            "rows_total": int(len(frame)),
            "rows_train": int(len(X_train)),
            "rows_test": int(len(X_test)),
            "test_size": cfg.TEST_SIZE,
            "random_state": cfg.RANDOM_STATE,
        },
        "features": {
            "count": len(cfg.FEATURE_NAMES),
            "order": cfg.FEATURE_NAMES,
        },
        "preprocessing": {
            "scaler": "StandardScaler",
            "scaler_fitted_on": "X_train only (após o split, para evitar data leakage)",
            "categorical_encoding": "códigos inteiros originais do dataset (sem one-hot)",
            "target_encoding": cfg.LABEL_MAP,
        },
        "metrics": {
            "cv_folds": cfg.CV_SPLITS,
            "cv_accuracy_mean": winner["cv_accuracy_mean"],
            "cv_f1_macro_mean": winner["cv_f1_macro_mean"],
            "train_accuracy": winner["train_accuracy"],
            "test_accuracy": winner["test_accuracy"],
            "test_balanced_accuracy": winner["test_balanced_accuracy"],
            "test_f1_macro": winner["test_f1_macro"],
            "overfit_gap": winner["overfit_gap"],
            "confusion_matrix": {
                "labels": cfg.CLASS_NAMES,
                "matrix": matrix.tolist(),
            },
            "classification_report": report,
        },
        "feature_importance": feature_importance,
        "feature_importance_method": importance_method,
        "candidates": [
            {key: value for key, value in entry.items() if key != "estimator"}
            for entry in sorted(evaluated, key=lambda e: e["test_f1_macro"], reverse=True)
        ],
        "selection_rationale": winner["selection_rationale"],
        "selection_criteria": winner["selection_criteria"],
        "supports_probability": hasattr(final_model, "predict_proba"),
        "trained_at": trained_at.isoformat(),
        "environment": {
            "python": platform.python_version(),
            "scikit_learn": sklearn.__version__,
            "pandas": pd.__version__,
            "numpy": np.__version__,
            "joblib": joblib.__version__,
        },
        "artifacts": {
            "model": cfg.MODEL_FILE.name,
            "scaler": cfg.SCALER_FILE.name,
        },
        "disclaimer": (
            "A classificação é apoio à tomada de decisão e não uma previsão "
            "garantida sobre o futuro do estudante. O campo confidence é a "
            "probabilidade estimada pelo modelo para a classe escolhida e não "
            "foi calibrado estatisticamente."
        ),
    }
    cfg.write_json(cfg.MODEL_METADATA_FILE, metadata)

    print("\n  artefatos gerados:")
    for path in (cfg.MODEL_FILE, cfg.SCALER_FILE, cfg.MODEL_METADATA_FILE):
        print(f"    {path.relative_to(cfg.ML_DIR)}")
    print(f"\n  versão do modelo          : {model_version}")
    print("\n[etapa 3] concluída — próximo passo: python ML/train_clusters.py (opcional)")


if __name__ == "__main__":
    main()
