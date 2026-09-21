(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.PropertyCharacteristics = api;
})(typeof globalThis !== 'undefined' ? globalThis : window, function () {
  const labels = {
    area: 'Área', area_total: 'Área total', area_construida: 'Área construída', quartos: 'Quartos', banheiros: 'Banheiros', vagas: 'Vagas de garagem',
    suite: 'Suítes', quintal: 'Quintal', piscina: 'Piscina', churrasqueira: 'Churrasqueira',
    sacada: 'Sacada', elevador: 'Elevador', condominio: 'Condomínio fechado',
    frente: 'Frente do terreno', topografia: 'Topografia', agua: 'Água encanada',
    energia: 'Energia elétrica', rua_asfaltada: 'Rua asfaltada', area_verde: 'Área verde',
    nascente: 'Nascente ou lago', salas: 'Salas ou ambientes', acessibilidade: 'Acessibilidade',
    estacionamento: 'Estacionamento', ar_condicionado: 'Ar-condicionado'
  };
  const iconPaths = {
    area: ['M4 7V4h3M20 17v3h-3M4 4l6 6m4 4 6 6M14 4h6v6M4 14v6h6'],
    area_total: ['M4 7V4h3M20 17v3h-3M4 4l6 6m4 4 6 6M14 4h6v6M4 14v6h6'],
    area_construida: ['M4 7V4h3M20 17v3h-3M4 4l6 6m4 4 6 6M14 4h6v6M4 14v6h6'],
    quartos: ['M3 4v16M3 11h18v9M5 11V7h5a4 4 0 0 1 4 4M21 11v9'],
    suite: ['M3 4v16M3 11h18v9M5 11V7h5a4 4 0 0 1 4 4M21 11v9', 'M17 4.5c-1.2 1.5-1.8 2.4-1.8 3.2a1.8 1.8 0 0 0 3.6 0c0-.8-.6-1.7-1.8-3.2z'],
    banheiros: ['M4 12h16v3a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5v-3zM7 12V6a3 3 0 0 1 6 0v1M7 17v1M17 17v1'],
    vagas: ['M5 11l1.5-4h11L19 11M3 11h18v8H3zM7 19v2M17 19v2M6 15h.01M18 15h.01'],
    quintal: ['M12 21v-8M5 11l2-5 5-3 5 3 2 5-7 3-7-3zM8 11h.01M16 11h.01'],
    piscina: ['M2 13c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2M2 18c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2M7 3v4M12 2v5M17 4v3'],
    churrasqueira: ['M4 10h16M6 10l2 8h8l2-8M8 21l1-3M16 21l-1-3M8 6c-1-1 1-2 0-3M12 6c-1-1 1-2 0-3M16 6c-1-1 1-2 0-3'],
    sacada: ['M4 21V4h16v17M4 9h16M4 14h16M8 9v5M12 9v5M16 9v5M9 21v-3h6v3'],
    elevador: ['M5 3h14v18H5zM12 7l-2 2h4l-2-2zM12 17l2-2h-4l2 2zM9 12h.01M15 12h.01'],
    condominio: ['M3 10l9-7 9 7v10H3zM9 21v-7h6v7M7 11h.01M17 11h.01'],
    frente: ['M4 7V4h3M20 17v3h-3M4 4l16 16M7 8l2-2M11 12l2-2M15 16l2-2'],
    topografia: ['M2 20l6-9 4 5 4-8 6 12H2zM7 17h.01M17 17h.01'],
    agua: ['M12 3c-3 4-6 7-6 11a6 6 0 0 0 12 0c0-4-3-7-6-11zM9 15a3 3 0 0 0 3 3'],
    energia: ['M13 2L4 13h7l-1 9 10-12h-7l1-8z'],
    rua_asfaltada: ['M5 21L9 3M19 21L15 3M12 4v3M12 11v3M12 18v2'],
    area_verde: ['M20 4c-9 0-15 4-15 11a5 5 0 0 0 5 5c7 0 11-6 10-16zM5 20c3-5 6-8 11-11'],
    nascente: ['M12 3v2M4.9 4.9l1.4 1.4M3 12h2M19 12h2M17.7 6.3l1.4-1.4M8 15c2 0 2-2 4-2s2 2 4 2 2-2 4-2M4 19c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2'],
    salas: ['M4 12V9a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3M3 12h18v7H3zM5 19v2M19 19v2M7 12V9h4v3M13 12V9h4v3'],
    acessibilidade: ['M12 4h.01M10 8h4l1 5h4M11 8l-2 7 4 2 2 4M9 15l-3 4M7 12l-3 1M12 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4z'],
    estacionamento: ['M7 21V3h6a5 5 0 0 1 0 10H7M7 13h6'],
    ar_condicionado: ['M12 2v20M4 7l16 10M4 17L20 7M9 4l3 2 3-2M9 20l3-2 3 2M3 10l3 1-1 3M19 10l-1 4 3 1M3 14l3-1M18 11l3-1'],
    default: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM8 12h8']
  };
  const order = Object.keys(labels);
  const count = (value, singular, plural) => `${value} ${Number(value) === 1 ? singular : plural}`;

  const list = value => {
    let data = value || {};
    if (typeof data === 'string') {
      try { data = JSON.parse(data) || {}; } catch (_) { data = {}; }
    }
    return Object.entries(data)
      .filter(([key, item]) => labels[key] && item !== false && item !== null && item !== undefined && item !== '')
      .sort(([a], [b]) => order.indexOf(a) - order.indexOf(b))
      .map(([key, item]) => {
        const numeric = Number.isFinite(Number(item)) && String(item).trim() !== '';
        const number = numeric ? Number(item).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) : item;
        let display = item === true ? 'Sim' : String(item);
        if (numeric && ['area', 'area_total', 'area_construida'].includes(key)) display = `${number} m²`;
        else if (numeric && key === 'frente') display = `${number} m`;
        else if (numeric && key === 'quartos') display = count(number, 'quarto', 'quartos');
        else if (numeric && key === 'banheiros') display = count(number, 'banheiro', 'banheiros');
        else if (numeric && key === 'vagas') display = count(number, 'vaga', 'vagas');
        else if (numeric && key === 'suite') display = count(number, 'suíte', 'suítes');
        else if (numeric && key === 'salas') display = count(number, 'ambiente', 'ambientes');
        return { key, label: labels[key], value: item, display, boolean: item === true };
      });
  };

  const summaryOrder = ['area_total', 'area_construida', 'area', 'quartos', 'suite', 'banheiros', 'vagas'];
  const summary = features => features
    .filter(feature => summaryOrder.includes(feature.key))
    .sort((a, b) => summaryOrder.indexOf(a.key) - summaryOrder.indexOf(b.key));
  const icon = key => iconPaths[key] || iconPaths.default;
  const withCondoOption = (category, options) => {
    const base = options.filter(option => option.key !== 'condominio');
    return category && category !== 'Comercial'
      ? [...base, { key: 'condominio', label: 'Condomínio fechado', type: 'check' }]
      : base;
  };
  return { list, summary, withCondoOption, icon };
});
