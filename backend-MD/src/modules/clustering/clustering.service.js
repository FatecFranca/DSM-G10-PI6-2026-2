import { getClusterMetadata } from '../../ml/artifacts.js';
import { runPythonScript } from '../../ml/pythonRunner.js';
import { validateRecords } from '../../ml/validation.js';

export const CLUSTERING_DISCLAIMER =
  'Agrupamento é análise exploratória complementar à classificação. A distribuição de classes ' +
  'do grupo descreve o histórico dos estudantes daquele perfil e não é uma predição individual.';

function describeClustering(metadata) {
  return {
    version: metadata.cluster_version,
    algorithm: metadata.algorithm,
    k: metadata.k,
    trainedAt: metadata.trained_at,
    silhouette: metadata.metrics?.silhouette,
  };
}

export async function assignClusters(body) {
  const { records, warnings } = await validateRecords(body, { allowBatch: true });
  const [metadata, assignment] = await Promise.all([
    getClusterMetadata(),
    runPythonScript('cluster_assign.py', { records }),
  ]);

  const response = {
    clustering: describeClustering(metadata),
    count: assignment.results.length,
    results: assignment.results.map((entry) => ({
      index: entry.index,
      clusterId: entry.cluster_id,
      distance: entry.distance,
      attentionLevel: entry.attention_level,
      profile: entry.profile
        ? {
            size: entry.profile.size,
            ratio: entry.profile.ratio,
            dropoutRatio: entry.profile.dropout_ratio,
            classDistribution: entry.profile.class_distribution,
            featureMeans: entry.profile.feature_means,
          }
        : null,
    })),
    disclaimer: CLUSTERING_DISCLAIMER,
  };

  if (warnings.length > 0) response.warnings = warnings;
  return response;
}

export async function getProfiles() {
  const metadata = await getClusterMetadata();

  return {
    clustering: describeClustering(metadata),
    selectionRationale: metadata.selection_rationale,
    metrics: {
      silhouette: metadata.metrics?.silhouette,
      daviesBouldin: metadata.metrics?.davies_bouldin,
      calinskiHarabasz: metadata.metrics?.calinski_harabasz,
      inertia: metadata.metrics?.inertia,
      kEvaluations: metadata.metrics?.k_evaluations,
    },
    profileFeatures: metadata.profile_features,
    profiles: (metadata.profiles ?? []).map((profile) => ({
      clusterId: profile.cluster_id,
      size: profile.size,
      ratio: profile.ratio,
      dropoutRatio: profile.dropout_ratio,
      attentionLevel: profile.attention_level,
      classDistribution: profile.class_distribution,
      featureMeans: profile.feature_means,
    })),
    dataset: metadata.dataset,
    disclaimer: CLUSTERING_DISCLAIMER,
  };
}
