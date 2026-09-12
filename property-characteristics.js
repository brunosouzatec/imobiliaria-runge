(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.PropertyCharacteristics = api;
})(typeof globalThis !== 'undefined' ? globalThis : window, function () {
  const labels = {
    area: 'Área', quartos: 'Quartos', banheiros: 'Banheiros', vagas: 'Vagas de garagem',
    suite: 'Suítes', quintal: 'Quintal', piscina: 'Piscina', churrasqueira: 'Churrasqueira',
    sacada: 'Sacada', elevador: 'Elevador', condominio: 'Condomínio fechado',
    frente: 'Frente do terreno', topografia: 'Topografia', agua: 'Água encanada',
    energia: 'Energia elétrica', rua_asfaltada: 'Rua asfaltada', area_verde: 'Área verde',
    nascente: 'Nascente ou lago', salas: 'Salas ou ambientes', acessibilidade: 'Acessibilidade',
    estacionamento: 'Estacionamento', ar_condicionado: 'Ar-condicionado'
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
        if (numeric && key === 'area') display = `${number} m²`;
        else if (numeric && key === 'frente') display = `${number} m`;
        else if (numeric && key === 'quartos') display = count(number, 'quarto', 'quartos');
        else if (numeric && key === 'banheiros') display = count(number, 'banheiro', 'banheiros');
        else if (numeric && key === 'vagas') display = count(number, 'vaga', 'vagas');
        else if (numeric && key === 'suite') display = count(number, 'suíte', 'suítes');
        else if (numeric && key === 'salas') display = count(number, 'ambiente', 'ambientes');
        return { key, label: labels[key], value: item, display, boolean: item === true };
      });
  };

  const summary = features => features.filter(feature => ['area', 'quartos', 'banheiros', 'vagas'].includes(feature.key));
  const withCondoOption = (category, options) => {
    const base = options.filter(option => option.key !== 'condominio');
    return category && category !== 'Comercial'
      ? [...base, { key: 'condominio', label: 'Condomínio fechado', type: 'check' }]
      : base;
  };
  return { list, summary, withCondoOption };
});
