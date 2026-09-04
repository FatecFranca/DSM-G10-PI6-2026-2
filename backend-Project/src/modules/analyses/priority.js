export const PRIORITY = { LOW: 'LOW', MEDIUM: 'MEDIUM', HIGH: 'HIGH' };

export const PRIORITY_RANK = { LOW: 1, MEDIUM: 2, HIGH: 3 };

export const rankOf = (priority) => PRIORITY_RANK[priority] ?? PRIORITY_RANK.MEDIUM;

const CONFIDENT_THRESHOLD = 0.6;

export function derivePriority(result) {
  const { classification, confidence } = result;
  const confident = typeof confidence === 'number' && confidence >= CONFIDENT_THRESHOLD;

  let priority;
  let label;
  let description;

  if (classification === 'Dropout') {
    priority = confident ? PRIORITY.HIGH : PRIORITY.MEDIUM;
    label = confident ? 'Acompanhamento prioritário' : 'Acompanhamento recomendado';
    description = confident
      ? 'O modelo associou este conjunto de características ao grupo de evasão com sinal consistente. Indica-se contato e acompanhamento prioritário.'
      : 'O modelo indicou evasão, mas com confiança moderada. Recomenda-se revisão dos dados e acompanhamento.';
  } else if (classification === 'Enrolled') {
    priority = PRIORITY.MEDIUM;
    label = 'Observação continuada';
    description =
      'A situação está em aberto (matriculado, sem desfecho definido). Indica-se observar a evolução do desempenho ao longo do período.';
  } else if (classification === 'Graduate') {
    priority = confident ? PRIORITY.LOW : PRIORITY.MEDIUM;
    label = confident ? 'Sem indicativo de prioridade' : 'Observação continuada';
    description = confident
      ? 'O modelo associou este conjunto de características ao grupo de conclusão. Nenhuma ação prioritária é indicada por esta análise.'
      : 'O modelo indicou conclusão, mas com confiança moderada. Vale observar a evolução.';
  } else {
    priority = PRIORITY.MEDIUM;
    label = 'Revisão manual';
    description = 'Classificação não reconhecida pelas regras de acompanhamento. Requer revisão.';
  }

  return {
    priority,
    label,
    description,
    factors: {
      classification,
      confidence,
      confidenceThreshold: CONFIDENT_THRESHOLD,
      confidentSignal: confident,
    },
  };
}

export default derivePriority;
