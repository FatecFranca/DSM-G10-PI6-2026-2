export const FEATURE_DESCRIPTIONS: Record<string, string> = {
  marital_status:
    'Estado civil do estudante no momento da matrícula. Código categórico.\n\n' +
    '1 = Solteiro(a)\n' +
    '2 = Casado(a)\n' +
    '3 = Viúvo(a)\n' +
    '4 = Divorciado(a)\n' +
    '5 = União estável\n' +
    '6 = Legalmente separado(a)',
  application_mode:
    'Modalidade/via de ingresso utilizada na candidatura ao curso. Código categórico — o valor numérico identifica a via de acesso, sem relação de ordem ou grandeza.\n\n' +
    'Exemplos: 1 = 1ª fase, contingente geral; 39 = ingresso para maiores de 23 anos; 42 = transferência de instituição; 43 = mudança de curso; 15 = estudante internacional.',
  application_order:
    'Posição de preferência atribuída a este curso pelo estudante no ato da candidatura, entre as opções indicadas.\n\n' +
    '0 ou 1 = curso indicado como 1ª opção\n' +
    'Valores superiores = opção de menor prioridade na candidatura',
  course:
    'Código identificador do curso em que o estudante está matriculado.\n\n' +
    'Trata-se de um identificador categórico; o valor numérico não representa quantidade, nota ou ordem de grandeza.',
  daytime_evening_attendance:
    'Turno de frequência das aulas. Campo binário.\n\n' +
    '1 = Diurno\n' +
    '0 = Noturno',
  previous_qualification:
    'Nível de qualificação/formação concluída pelo estudante antes do ingresso no curso atual. Código categórico.\n\n' +
    'Exemplos: 1 = ensino secundário; 2/3 = formação superior já concluída (bacharelado/licenciatura); 39 = curso de especialização tecnológica; 19 = ensino básico, 3º ciclo.',
  previous_qualification_grade:
    'Nota obtida na qualificação anterior, expressa na escala portuguesa de candidatura ao ensino superior.\n\n' +
    'Intervalo teórico de 0 a 200; quanto mais próximo de 200, maior o desempenho registrado na formação anterior.',
  nationality:
    'Código do país de nacionalidade do estudante. Campo categórico.\n\n' +
    '1 = Portuguesa (nacionalidade predominante na base histórica)\n' +
    'Demais valores = outras nacionalidades (ex.: brasileira, cabo-verdiana, espanhola, entre outras)',
  mothers_qualification:
    'Nível de escolaridade da mãe do estudante. Código categórico.\n\n' +
    'Exemplos: 1 = ensino secundário completo; 2/3 = ensino superior (bacharelado/licenciatura); 4/5 = mestrado ou doutorado; 19/37/38 = ensino básico; 35 = sem escolarização formal (não alfabetizada).',
  fathers_qualification:
    'Nível de escolaridade do pai do estudante. Código categórico.\n\n' +
    'Exemplos: 1 = ensino secundário completo; 2/3 = ensino superior (bacharelado/licenciatura); 4/5 = mestrado ou doutorado; 19/37/38 = ensino básico; 35 = sem escolarização formal (não alfabetizado).',
  mothers_occupation:
    'Ocupação profissional da mãe do estudante, classificada por categoria ocupacional. Código categórico.\n\n' +
    'Exemplos: 0 = estudante; 1 = quadro superior/cargo de direção; 2 = profissão especializada (atividade intelectual ou científica); 9 = trabalhador não qualificado; 90 = outra situação (ex.: desempregada, aposentada).',
  fathers_occupation:
    'Ocupação profissional do pai do estudante, classificada por categoria ocupacional. Código categórico.\n\n' +
    'Exemplos: 0 = estudante; 1 = quadro superior/cargo de direção; 2 = profissão especializada (atividade intelectual ou científica); 9 = trabalhador não qualificado; 90 = outra situação (ex.: desempregado, aposentado).',
  admission_grade:
    'Nota final de admissão/candidatura ao curso atual, responsável pela ocupação da vaga pelo estudante.\n\n' +
    'Intervalo teórico de 0 a 200, na mesma escala da nota de qualificação anterior.',
  displaced:
    'Indica se o estudante se deslocou de sua cidade/região de origem para cursar a formação atual. Campo binário.\n\n' +
    '1 = Sim, houve deslocamento\n' +
    '0 = Não, permanece na cidade de origem',
  educational_special_needs:
    'Indica se há registro de necessidade educacional especial associada ao estudante. Campo binário.\n\n' +
    '1 = Sim\n' +
    '0 = Não',
  debtor:
    'Indica se o estudante possui pendência financeira (dívida) registrada junto à instituição de ensino. Campo binário.\n\n' +
    '1 = Sim, inadimplente\n' +
    '0 = Não, sem pendências',
  tuition_fees_up_to_date:
    'Indica se os pagamentos das mensalidades do estudante estão regularizados. Campo binário.\n\n' +
    '1 = Em dia\n' +
    '0 = Em atraso\n\n' +
    'Atributo de peso relevante no modelo preditivo de risco de evasão.',
  gender:
    'Gênero do estudante, conforme codificação binária original da base de dados de origem.\n\n' +
    '1 = uma categoria de gênero\n' +
    '0 = outra categoria de gênero',
  scholarship_holder:
    'Indica se o estudante é beneficiário de bolsa de estudos. Campo binário.\n\n' +
    '1 = Sim, bolsista\n' +
    '0 = Não bolsista',
  age_at_enrollment:
    'Idade do estudante, em anos completos, na data de matrícula no curso.',
  international:
    'Indica se o estudante possui nacionalidade estrangeira em relação ao país da instituição de ensino. Campo binário.\n\n' +
    '1 = Sim, estudante internacional\n' +
    '0 = Não, nacional do país da instituição',
  curricular_units_1st_sem_credited:
    'Número de Unidades Curriculares (UCs) do 1º semestre creditadas por aproveitamento de estudos — disciplinas dispensadas por equivalência a formação anterior, sem terem sido cursadas na instituição atual.\n\n' +
    'Valores mais altos indicam maior volume de aproveitamento de créditos.',
  curricular_units_1st_sem_enrolled:
    'Número de Unidades Curriculares (UCs) em que o estudante efetuou matrícula no 1º semestre.',
  curricular_units_1st_sem_evaluations:
    'Número de avaliações (provas/trabalhos) efetivamente realizadas pelo estudante no 1º semestre.\n\n' +
    'Pode exceder o número de UCs matriculadas, pois cada disciplina pode ter mais de um instrumento de avaliação.',
  curricular_units_1st_sem_approved:
    'Número de Unidades Curriculares (UCs) em que o estudante obteve aprovação no 1º semestre.\n\n' +
    'Indicador de desempenho acadêmico de maior relevância: quanto maior o valor, melhor o aproveitamento registrado no período.',
  curricular_units_1st_sem_grade:
    'Nota média do estudante nas UCs avaliadas no 1º semestre, na escala portuguesa de 0 a 20.\n\n' +
    'O valor 0 costuma indicar ausência de UCs avaliadas no período.',
  curricular_units_1st_sem_without_evaluations:
    'Número de UCs do 1º semestre em que o estudante permaneceu matriculado sem realizar qualquer avaliação.\n\n' +
    'Valores elevados constituem indício de afastamento precoce das atividades acadêmicas no período.',
  curricular_units_2nd_sem_credited:
    'Número de Unidades Curriculares (UCs) do 2º semestre creditadas por aproveitamento de estudos — disciplinas dispensadas por equivalência a formação anterior, sem terem sido cursadas na instituição atual.\n\n' +
    'Valores mais altos indicam maior volume de aproveitamento de créditos.',
  curricular_units_2nd_sem_enrolled:
    'Número de Unidades Curriculares (UCs) em que o estudante efetuou matrícula no 2º semestre.',
  curricular_units_2nd_sem_evaluations:
    'Número de avaliações (provas/trabalhos) efetivamente realizadas pelo estudante no 2º semestre.\n\n' +
    'Pode exceder o número de UCs matriculadas, pois cada disciplina pode ter mais de um instrumento de avaliação.',
  curricular_units_2nd_sem_approved:
    'Número de Unidades Curriculares (UCs) em que o estudante obteve aprovação no 2º semestre.\n\n' +
    'Atributo de maior peso no modelo preditivo utilizado pelo sistema: valores baixos tendem a elevar o risco de evasão identificado.',
  curricular_units_2nd_sem_grade:
    'Nota média do estudante nas UCs avaliadas no 2º semestre, na escala portuguesa de 0 a 20.\n\n' +
    'O valor 0 costuma indicar ausência de UCs avaliadas no período.',
  curricular_units_2nd_sem_without_evaluations:
    'Número de UCs do 2º semestre em que o estudante permaneceu matriculado sem realizar qualquer avaliação.\n\n' +
    'Valores elevados constituem indício de afastamento precoce das atividades acadêmicas no período.',
  unemployment_rate:
    'Taxa de desemprego nacional (%) referente ao período de ingresso do estudante.\n\n' +
    'Indicador macroeconômico do contexto do período, não uma característica individual do estudante.',
  inflation_rate:
    'Taxa de inflação nacional (%) referente ao período de ingresso do estudante.\n\n' +
    'Indicador macroeconômico do contexto do período; admite valores negativos em cenários de deflação.',
  gdp:
    'Variação do Produto Interno Bruto (PIB) nacional (%) referente ao período de ingresso do estudante.\n\n' +
    'Indicador macroeconômico do contexto do período; admite valores negativos em cenários de retração econômica.',
};
