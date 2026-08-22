from __future__ import annotations

import sys

import matplotlib

matplotlib.use("Agg")

import matplotlib.pyplot as plt
import pandas as pd
import seaborn as sns

import config as cfg

sns.set_theme(style="whitegrid")

FOCUS_FEATURES = [
    "age_at_enrollment",
    "admission_grade",
    "previous_qualification_grade",
    "curricular_units_1st_sem_approved",
    "curricular_units_1st_sem_grade",
    "curricular_units_2nd_sem_approved",
    "curricular_units_2nd_sem_grade",
    "unemployment_rate",
]


def save(figure: plt.Figure, name: str) -> None:
    path = cfg.FIGURES_DIR / name
    figure.tight_layout()
    figure.savefig(path, dpi=120)
    plt.close(figure)
    print(f"    {path.relative_to(cfg.ML_DIR)}")


def plot_class_distribution(frame: pd.DataFrame) -> None:
    labels = frame[cfg.TARGET_COLUMN].map(cfg.INVERSE_LABEL_MAP)
    figure, axis = plt.subplots(figsize=(6, 4))
    sns.countplot(x=labels, order=cfg.CLASS_NAMES, ax=axis, hue=labels, legend=False)
    axis.set_title("Distribuição das classes-alvo")
    axis.set_xlabel("")
    axis.set_ylabel("estudantes")
    for container in axis.containers:
        axis.bar_label(container)
    save(figure, "01_class_distribution.png")


def plot_histograms(frame: pd.DataFrame) -> None:
    figure, axes = plt.subplots(2, 4, figsize=(18, 8))
    for axis, feature in zip(axes.flat, FOCUS_FEATURES):
        sns.histplot(frame[feature], bins=30, ax=axis, kde=True)
        axis.set_title(feature, fontsize=9)
        axis.set_xlabel("")
    figure.suptitle("Histogramas dos principais atributos numéricos")
    save(figure, "02_histograms.png")


def plot_boxplots_by_class(frame: pd.DataFrame) -> None:
    labels = frame[cfg.TARGET_COLUMN].map(cfg.INVERSE_LABEL_MAP)
    figure, axes = plt.subplots(2, 4, figsize=(18, 8))
    for axis, feature in zip(axes.flat, FOCUS_FEATURES):
        sns.boxplot(x=labels, y=frame[feature], order=cfg.CLASS_NAMES, ax=axis,
                    hue=labels, legend=False)
        axis.set_title(feature, fontsize=9)
        axis.set_xlabel("")
        axis.tick_params(axis="x", labelrotation=20)
    figure.suptitle("Boxplots por classe — identificação de outliers e separação entre classes")
    save(figure, "03_boxplots_by_class.png")


def plot_correlation(frame: pd.DataFrame) -> None:
    numeric = frame[cfg.FEATURE_NAMES + [cfg.TARGET_COLUMN]]
    figure, axis = plt.subplots(figsize=(16, 13))
    sns.heatmap(numeric.corr(), cmap="coolwarm", center=0, ax=axis,
                cbar_kws={"shrink": 0.6}, xticklabels=True, yticklabels=True)
    axis.tick_params(labelsize=6)
    axis.set_title("Matriz de correlação (todos os atributos + alvo)")
    save(figure, "04_correlation_matrix.png")


def plot_target_correlation(frame: pd.DataFrame) -> None:
    correlation = (
        frame[cfg.FEATURE_NAMES]
        .corrwith(frame[cfg.TARGET_COLUMN])
        .sort_values(key=abs, ascending=False)
        .head(20)
    )
    figure, axis = plt.subplots(figsize=(9, 7))
    sns.barplot(x=correlation.values, y=correlation.index, ax=axis,
                hue=correlation.index, legend=False)
    axis.set_title("20 atributos com maior correlação (absoluta) com a classe-alvo")
    axis.set_xlabel("correlação de Pearson com o alvo codificado")
    axis.tick_params(labelsize=8)
    save(figure, "05_target_correlation.png")


def plot_pairplot(frame: pd.DataFrame) -> None:
    subset = frame[
        [
            "curricular_units_1st_sem_approved",
            "curricular_units_2nd_sem_approved",
            "admission_grade",
            "age_at_enrollment",
            cfg.TARGET_COLUMN,
        ]
    ].copy()
    subset[cfg.TARGET_COLUMN] = subset[cfg.TARGET_COLUMN].map(cfg.INVERSE_LABEL_MAP)
    grid = sns.pairplot(subset, hue=cfg.TARGET_COLUMN, hue_order=cfg.CLASS_NAMES,
                        corner=True, plot_kws={"alpha": 0.5, "s": 12})
    grid.figure.suptitle("Dispersão entre pares de atributos, por classe", y=1.02)
    save(grid.figure, "06_pairplot.png")


def main() -> None:
    cfg.ensure_directories()

    if not cfg.PROCESSED_DATASET.exists():
        sys.exit(
            f"[erro] dataset tratado não encontrado: {cfg.PROCESSED_DATASET}\n"
            "        execute primeiro: python ML/prepare_data.py"
        )

    frame = pd.read_csv(cfg.PROCESSED_DATASET)
    print(f"[exploração] {len(frame)} registros, {len(cfg.FEATURE_NAMES)} atributos")
    print("  figuras geradas:")

    plot_class_distribution(frame)
    plot_histograms(frame)
    plot_boxplots_by_class(frame)
    plot_correlation(frame)
    plot_target_correlation(frame)
    plot_pairplot(frame)

    print("\n[exploração] concluída")


if __name__ == "__main__":
    main()
