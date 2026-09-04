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
    make_scorer,
    recall_score,
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
DROPOUT_RECALL_WEIGHT = 0.50
MAX_OVERFIT_GAP = 0.05
DROPOUT_CLASS_ID = cfg.LABEL_MAP["Dropout"]

DROPOUT_RECALL_SCORER = make_scorer(
    recall_score, labels=[DROPOUT_CLASS_ID], average="macro", zero_division=0
)


def build_candidates() -> dict[str, object]:
    return {
        "LogisticRegression": LogisticRegression(
            max_iter=1000, random_state=cfg.RANDOM_STATE
        ),
        "LogisticRegressionBalanced": LogisticRegression(
            max_iter=1000, class_weight="balanced", random_state=cfg.RANDOM_STATE
        ),
        "LinearDiscriminantAnalysis": LinearDiscriminantAnalysis(),
        "LinearDiscriminantAnalysisDropoutPrior": LinearDiscriminantAnalysis(
            priors=[0.45, 0.25, 0.30]
        ),
        "KNeighborsClassifier": KNeighborsClassifier(n_neighbors=15),
        "DecisionTreeClassifier": DecisionTreeClassifier(
            max_depth=8, min_samples_leaf=10, random_state=cfg.RANDOM_STATE
        ),
        "DecisionTreeBalanced": DecisionTreeClassifier(
            max_depth=8,
            min_samples_leaf=10,
            class_weight="balanced",
            random_state=cfg.RANDOM_STATE,
        ),
        "GaussianNB": GaussianNB(),
        "SVC": SVC(kernel="rbf", C=1.0, probability=True, random_state=cfg.RANDOM_STATE),
        "SVCBalanced": SVC(
            kernel="rbf",
            C=1.0,
            probability=True,
            class_weight="balanced",
            random_state=cfg.RANDOM_STATE,
        ),
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


def dropout_recall(y_true, y_pred) -> float:
    return float(recall_score(y_true, y_pred, labels=[DROPOUT_CLASS_ID], average="macro"))


def selection_score(f1_macro: float, recall_dropout: float) -> float:
    w = DROPOUT_RECALL_WEIGHT
    return (1 - w) * f1_macro + w * recall_dropout


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


def split_development_test(X, y):
    return train_test_split(
        X, y, test_size=cfg.TEST_SIZE, random_state=cfg.RANDOM_STATE, stratify=y
    )


def select_by_cross_validation(X_dev, y_dev) -> list[dict]:
    kfold = StratifiedKFold(
        n_splits=cfg.CV_SPLITS, shuffle=True, random_state=cfg.RANDOM_STATE
    )
    scoring = {
        "accuracy": "accuracy",
        "f1_macro": "f1_macro",
        "recall_dropout": DROPOUT_RECALL_SCORER,
    }

    print(
        f"\n[passo 4] seleção por validação cruzada ({cfg.CV_SPLITS} folds estratificados) "
        f"sobre o conjunto de desenvolvimento"
    )
    print("          o conjunto de teste não participa desta etapa")
    print(
        f"  {'algoritmo':<40} {'F1 macro':>10} {'rec.Dropout':>13} {'score':>9} {'gap':>9}"
    )

    evaluated = []
    for name, estimator in build_candidates().items():
        pipeline = Pipeline([("scaler", StandardScaler()), ("model", estimator)])
        scores = cross_validate(
            pipeline,
            X_dev,
            y_dev,
            cv=kfold,
            scoring=scoring,
            n_jobs=1,
            return_train_score=True,
        )
        entry = {
            "algorithm": name,
            "cv_accuracy_mean": round(float(scores["test_accuracy"].mean()), 4),
            "cv_accuracy_std": round(float(scores["test_accuracy"].std()), 4),
            "cv_f1_macro_mean": round(float(scores["test_f1_macro"].mean()), 4),
            "cv_f1_macro_std": round(float(scores["test_f1_macro"].std()), 4),
            "cv_recall_dropout_mean": round(float(scores["test_recall_dropout"].mean()), 4),
            "cv_recall_dropout_std": round(float(scores["test_recall_dropout"].std()), 4),
            "cv_train_accuracy_mean": round(float(scores["train_accuracy"].mean()), 4),
        }
        entry["cv_selection_score"] = round(
            selection_score(entry["cv_f1_macro_mean"], entry["cv_recall_dropout_mean"]), 4
        )
        entry["overfit_gap"] = round(
            entry["cv_train_accuracy_mean"] - entry["cv_accuracy_mean"], 4
        )
        evaluated.append(entry)

        print(
            f"  {name:<40} {entry['cv_f1_macro_mean']:>10.4f} "
            f"{entry['cv_recall_dropout_mean']:>13.4f} "
            f"{entry['cv_selection_score']:>9.4f} {entry['overfit_gap']:>9.4f}"
        )

    return evaluated


def select_final(evaluated: list[dict]) -> dict:
    eligible = [e for e in evaluated if e["overfit_gap"] <= MAX_OVERFIT_GAP]
    discarded = [e for e in evaluated if e["overfit_gap"] > MAX_OVERFIT_GAP]
    if not eligible:
        eligible = evaluated
        discarded = []

    ranked = sorted(
        eligible,
        key=lambda e: (e["cv_selection_score"], e["cv_f1_macro_mean"]),
        reverse=True,
    )
    best_score = ranked[0]["cv_selection_score"]
    tied = [e for e in ranked if best_score - e["cv_selection_score"] <= EQUIVALENCE_TOLERANCE]
    winner = max(tied, key=lambda e: (e["cv_selection_score"], -e["overfit_gap"]))

    w = DROPOUT_RECALL_WEIGHT
    tied_summary = ", ".join(
        f"{e['algorithm']} (score {e['cv_selection_score']:.4f}, gap {e['overfit_gap']:.4f})"
        for e in tied
    )
    discarded_summary = (
        ", ".join(f"{e['algorithm']} (gap {e['overfit_gap']:.4f})" for e in discarded)
        if discarded
        else "nenhum"
    )

    winner["selection_rationale"] = (
        f"Critério em três etapas, todas medidas por validação cruzada de "
        f"{cfg.CV_SPLITS} folds sobre o conjunto de desenvolvimento — o conjunto de teste "
        f"não participa da escolha, para que as métricas publicadas não sejam otimistas. "
        f"(1) Descarte por memorização: candidatos cuja distância entre acurácia de treino "
        f"e de validação passa de {MAX_OVERFIT_GAP} são eliminados, por decorarem o treino "
        f"em vez de generalizar — descartados: {discarded_summary}. "
        f"(2) Score de seleção: combina, com peso igual ({1 - w:.2f}/{w:.2f}), o F1 macro "
        f"(equilíbrio entre as três classes desbalanceadas) e a revocação da classe Dropout "
        f"(proporção dos evasores reais que o modelo encontra). A revocação de Dropout entra "
        f"no critério porque, num sistema de apoio à identificação de estudantes em risco, "
        f"deixar de sinalizar quem evade é o erro caro. Melhor score entre os elegíveis: "
        f"{best_score:.4f}. (3) Empate: {len(tied)} candidato(s) ficaram dentro da tolerância "
        f"de {EQUIVALENCE_TOLERANCE} e foram tratados como equivalentes: {tied_summary}. "
        f"Escolhido: {winner['algorithm']} — F1 macro {winner['cv_f1_macro_mean']:.4f} "
        f"(+/-{winner['cv_f1_macro_std']:.4f}), revocação de Dropout "
        f"{winner['cv_recall_dropout_mean']:.4f} (+/-{winner['cv_recall_dropout_std']:.4f}), "
        f"acurácia {winner['cv_accuracy_mean']:.4f}, distância treino-validação "
        f"{winner['overfit_gap']:.4f}."
    )
    winner["selection_criteria"] = {
        "measured_on": f"cross_validation_{cfg.CV_SPLITS}fold_on_development_set",
        "test_set_used_for_selection": False,
        "primary_metric": "cv_selection_score",
        "score_formula": f"{1 - w:.2f} * f1_macro + {w:.2f} * recall_Dropout",
        "dropout_recall_weight": w,
        "overfit_guard": f"descarta candidatos com gap treino-validação > {MAX_OVERFIT_GAP}",
        "discarded_by_overfit_guard": [e["algorithm"] for e in discarded],
        "equivalence_tolerance": EQUIVALENCE_TOLERANCE,
        "best_cv_selection_score": best_score,
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

    X_dev, X_test, y_dev, y_test = split_development_test(X, y)
    print(f"  desenvolvimento / teste   : {len(X_dev)} / {len(X_test)}")
    print("  proporção das classes     : desenvolvimento vs teste")
    for class_id, class_name in cfg.INVERSE_LABEL_MAP.items():
        print(
            f"    {class_name:<10} {float((y_dev == class_id).mean()) * 100:>5.1f}%"
            f"  vs {float((y_test == class_id).mean()) * 100:>5.1f}%"
        )

    evaluated = select_by_cross_validation(X_dev, y_dev)
    winner = select_final(evaluated)
    algorithm = winner["algorithm"]

    print(f"\n[passo 5] modelo escolhido: {algorithm}")
    print(f"  {winner['selection_rationale']}")

    print("\n[passo 6] ajuste final no desenvolvimento e avaliação única no teste")
    scaler = StandardScaler().fit(X_dev)
    final_model = build_candidates()[algorithm]
    final_model.fit(scaler.transform(X_dev), y_dev)

    dev_pred = final_model.predict(scaler.transform(X_dev))
    test_pred = final_model.predict(scaler.transform(X_test))

    test_metrics = {
        "dev_accuracy": round(float(accuracy_score(y_dev, dev_pred)), 4),
        "test_accuracy": round(float(accuracy_score(y_test, test_pred)), 4),
        "test_balanced_accuracy": round(float(balanced_accuracy_score(y_test, test_pred)), 4),
        "test_f1_macro": round(float(f1_score(y_test, test_pred, average="macro")), 4),
        "test_recall_dropout": round(dropout_recall(y_test, test_pred), 4),
    }
    test_metrics["generalization_gap"] = round(
        test_metrics["dev_accuracy"] - test_metrics["test_accuracy"], 4
    )

    print(f"  acurácia no teste         : {test_metrics['test_accuracy']:.4f}")
    print(f"  F1 macro no teste         : {test_metrics['test_f1_macro']:.4f}")
    print(f"  revocação de Dropout      : {test_metrics['test_recall_dropout']:.4f}")
    print(f"  distância desenv.-teste   : {test_metrics['generalization_gap']:.4f}")

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
    print("            " + "".join(f"{name:>10}" for name in cfg.CLASS_NAMES))
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
        "contract_version": "1.1.0",
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
            "rows_development": int(len(X_dev)),
            "rows_test": int(len(X_test)),
            "test_size": cfg.TEST_SIZE,
            "random_state": cfg.RANDOM_STATE,
        },
        "features": {"count": len(cfg.FEATURE_NAMES), "order": cfg.FEATURE_NAMES},
        "preprocessing": {
            "scaler": "StandardScaler",
            "scaler_fitted_on": (
                "conjunto de desenvolvimento; durante a validação cruzada o scaler é "
                "reajustado dentro de cada fold (Pipeline), sem vazamento"
            ),
            "categorical_encoding": "códigos inteiros originais do dataset (sem one-hot)",
            "target_encoding": cfg.LABEL_MAP,
        },
        "metrics": {
            "cv_folds": cfg.CV_SPLITS,
            "cv_accuracy_mean": winner["cv_accuracy_mean"],
            "cv_f1_macro_mean": winner["cv_f1_macro_mean"],
            "cv_recall_dropout_mean": winner["cv_recall_dropout_mean"],
            "cv_selection_score": winner["cv_selection_score"],
            "overfit_gap": winner["overfit_gap"],
            **test_metrics,
            "confusion_matrix": {"labels": cfg.CLASS_NAMES, "matrix": matrix.tolist()},
            "classification_report": report,
        },
        "feature_importance": feature_importance,
        "feature_importance_method": importance_method,
        "candidates": sorted(evaluated, key=lambda e: e["cv_selection_score"], reverse=True),
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
        "artifacts": {"model": cfg.MODEL_FILE.name, "scaler": cfg.SCALER_FILE.name},
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
    print("\n[etapa 3] concluída — o modelo já pode ser consumido pela API (ML/predict.py).")


if __name__ == "__main__":
    main()
