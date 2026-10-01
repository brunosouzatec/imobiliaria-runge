const MAX_RESULTS = 8;

function list(value, fallback = []) {
  if (Array.isArray(value)) return value;
  if (value == null || value === '') return fallback;
  if (typeof value !== 'string') return fallback;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch (_) {
    return fallback;
  }
}

function object(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value !== 'string') return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (_) {
    return {};
  }
}

function normalize(value) {
  return String(value ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function number(value) {
  if (value == null || value === '' || typeof value === 'boolean') return null;
  const parsed = Number(String(value).replace(',', '.').match(/-?\d+(?:\.\d+)?/)?.[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizedTransactions(value, fallback) {
  return list(value, fallback ? [fallback] : [])
    .map(item => normalize(item))
    .map(item => item === 'compra' ? 'venda' : item)
    .filter(item => ['venda', 'aluguel', 'permuta'].includes(item));
}

function normalizedTypes(opportunity) {
  return list(opportunity.tipos_imovel, opportunity.tipo_imovel ? [opportunity.tipo_imovel] : [])
    .map(normalize).filter(Boolean);
}

function propertyArea(features) {
  return number(features.area_total) ?? number(features.area) ?? number(features.area_terreno);
}

function priceCandidates(property, transactions) {
  const propertyTransactions = normalizedTransactions(property.transacoes, property.tipo);
  const common = transactions.filter(item => propertyTransactions.includes(item));
  const candidates = [];
  for (const transaction of common) {
    if (transaction === 'venda') candidates.push(number(property.preco_venda) ?? number(property.preco));
    if (transaction === 'aluguel') candidates.push(number(property.preco_aluguel) ?? number(property.preco));
  }
  return candidates.filter(value => value != null && value > 0);
}

function rangeProximity(value, minimum, maximum) {
  if (minimum != null && value < minimum) return minimum > 0 ? Math.max(0, value / minimum) : 0;
  if (maximum != null && value > maximum) return maximum > 0 ? Math.max(0, maximum / value) : 0;
  return 1;
}

function textWords(value) {
  return new Set(normalize(value).split(' ').filter(Boolean));
}

function propertySearchWords(property, features) {
  const parts = [property.descricao || ''];
  for (const [key, value] of Object.entries(features)) {
    if (value === true) parts.push(key.replace(/_/g, ' '));
    else if (value !== false && value != null && value !== '') parts.push(`${key.replace(/_/g, ' ')} ${value}`);
  }
  return textWords(parts.join(' '));
}

function scoreOpportunityProperty(opportunity, property) {
  const wantedTypes = normalizedTypes(opportunity);
  const propertyType = normalize(property.categoria || property.tipo_imovel || '');
  if (wantedTypes.length && !wantedTypes.includes(propertyType)) return { eligible: false, rejection: 'type' };

  const wantedState = normalize(opportunity.estado || 'SP');
  const wantedCity = normalize(opportunity.cidade);
  if (!wantedCity || normalize(property.estado) !== wantedState || normalize(property.cidade) !== wantedCity) {
    return { eligible: false, rejection: 'location' };
  }

  const wantedTransactions = normalizedTransactions(opportunity.transacoes);
  const propertyTransactions = normalizedTransactions(property.transacoes, property.tipo);
  const commonTransactions = wantedTransactions.filter(item => propertyTransactions.includes(item));
  if (!commonTransactions.length) return { eligible: false, rejection: 'transaction' };

  const features = object(property.caracteristicas);
  const reasons = [
    { criterio: 'Tipo', atende: true, detalhe: property.categoria || property.tipo_imovel },
    { criterio: 'Localização', atende: true, detalhe: `${property.cidade}, ${property.estado}` },
    { criterio: 'Transação', atende: true, detalhe: commonTransactions.join(' / ') }
  ];
  let possible = 0;
  let earned = 0;
  const addCriterion = (label, weight, ratio, detail) => {
    possible += weight;
    earned += weight * ratio;
    reasons.push({ criterio: label, atende: ratio >= 0.999, detalhe: detail });
  };

  const neighborhoods = list(opportunity.bairros).map(normalize).filter(Boolean);
  if (neighborhoods.length) {
    const neighborhood = normalize(property.bairro);
    const match = neighborhoods.includes(neighborhood);
    addCriterion('Bairro', 20, match ? 1 : 0, property.bairro || 'Não informado');
  }

  const minimumPrice = number(opportunity.valor_minimo);
  const maximumPrice = number(opportunity.valor_maximo);
  if (minimumPrice != null || maximumPrice != null) {
    const prices = priceCandidates(property, commonTransactions);
    const best = prices.length ? Math.max(...prices.map(value => rangeProximity(value, minimumPrice, maximumPrice))) : 0;
    const detail = prices.length
      ? (best === 1 ? 'Dentro da faixa informada' : prices.map(value => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })).join(' / '))
      : 'Valor não informado';
    addCriterion('Investimento', 35, best, detail);
  }

  const minimumArea = number(opportunity.area_total_minima);
  const maximumArea = number(opportunity.area_total_maxima);
  if (minimumArea != null || maximumArea != null) {
    const area = propertyArea(features);
    const ratio = area == null ? 0 : rangeProximity(area, minimumArea, maximumArea);
    addCriterion('Área total', 30, ratio, area == null ? 'Área não informada' : `${area.toLocaleString('pt-BR')} m²`);
  }

  const numericNeeds = [
    ['quartos_minimos', 'quartos', 'Quartos'],
    ['suites_minimas', 'suite', 'Suítes'],
    ['vagas_minimas', 'vagas', 'Vagas']
  ].filter(([need]) => number(opportunity[need]) != null);
  const numericWeight = numericNeeds.length ? 15 / numericNeeds.length : 0;
  for (const [need, key, label] of numericNeeds) {
    const required = number(opportunity[need]);
    const actual = number(features[key]);
    const ratio = actual == null ? 0 : required <= 0 || actual >= required ? 1 : actual / required;
    addCriterion(label, numericWeight, ratio, actual == null ? 'Não informado' : `${actual} (mínimo ${required})`);
  }

  const wantedFeatures = list(opportunity.caracteristicas).map(value => String(value).trim()).filter(Boolean);
  if (wantedFeatures.length) {
    const words = propertySearchWords(property, features);
    const matched = wantedFeatures.filter(value => [...textWords(value)].every(word => words.has(word))).length;
    const ratio = matched / wantedFeatures.length;
    addCriterion('Características', 10, ratio, `${matched} de ${wantedFeatures.length} identificada(s)`);
  }

  return {
    eligible: true,
    result: {
      id: property.id,
      score: possible ? Math.round((earned / possible) * 100) : null,
      comparedCriteria: reasons.length - 3,
      transacoes: commonTransactions,
      reasons
    }
  };
}

function scoreOpportunityMatches(opportunity, properties, limit = MAX_RESULTS) {
  const rejected = { location: 0, type: 0, transaction: 0 };
  const matches = [];
  for (const property of properties) {
    const scored = scoreOpportunityProperty(opportunity, property);
    if (!scored.eligible) rejected[scored.rejection] += 1;
    else matches.push(scored.result);
  }
  matches.sort((left, right) => (right.score ?? -1) - (left.score ?? -1) || Number(right.id) - Number(left.id));
  return {
    totalProperties: properties.length,
    eligibleCount: matches.length,
    rejected,
    matches: matches.slice(0, Math.max(0, Math.min(MAX_RESULTS, Number(limit) || MAX_RESULTS)))
  };
}

module.exports = { MAX_RESULTS, scoreOpportunityProperty, scoreOpportunityMatches };
