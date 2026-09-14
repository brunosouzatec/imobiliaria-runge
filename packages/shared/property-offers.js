(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.PropertyOffers = api;
})(typeof globalThis !== 'undefined' ? globalThis : window, function () {
  const allowed = ['Venda', 'Aluguel', 'Permuta'];
  const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

  const normalizeTypes = (value, fallback = '') => {
    let items = value;
    if (typeof items === 'string') {
      try { items = JSON.parse(items); } catch (_) { items = items.split(',').map(item => item.trim()); }
    }
    if (!Array.isArray(items)) items = [];
    const selected = [...new Set(items.filter(item => allowed.includes(item)))];
    return selected.length ? selected : allowed.includes(fallback) ? [fallback] : [];
  };

  const amount = value => {
    if (value === null || value === undefined || value === '' || value === 'null') return null;
    const parsed = typeof value === 'number' ? value : Number(String(value).trim().replace(/R\$\s?/g, '').replace(/\./g, '').replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : null;
  };

  const format = value => {
    const parsed = amount(value);
    return parsed === null ? '' : currency.format(parsed);
  };

  const primaryType = types => {
    const selected = normalizeTypes(types);
    return selected.includes('Venda') ? 'Venda' : selected.includes('Aluguel') ? 'Aluguel' : selected[0] || '';
  };

  const displayTitle = property => {
    const category = String(property?.categoria || '').trim();
    const selected = normalizeTypes(property?.tipos_transacao, property?.tipo);
    const types = allowed.filter(type => selected.includes(type));
    if (category && types.length) return `${category} - ${types.join('/')}`;
    return String(property?.titulo || category || 'Imóvel');
  };

  const isChecked = value => value === true || value === 1 || value === '1' || value === 'true';

  const parse = data => {
    const types = normalizeTypes(data?.tipos_transacao, data?.tipo);
    const legacyPrice = amount(data?.preco);
    const sale = types.includes('Venda') ? amount(data?.preco_venda) ?? (data?.tipo === 'Venda' ? legacyPrice : null) : null;
    const rent = types.includes('Aluguel') ? amount(data?.preco_aluguel) ?? (data?.tipo === 'Aluguel' ? legacyPrice : null) : null;
    const features = typeof data?.caracteristicas === 'string' ? (() => { try { return JSON.parse(data.caracteristicas) || {}; } catch (_) { return {}; } })() : data?.caracteristicas || {};
    const condoClosed = Boolean(features.condominio) && data?.categoria !== 'Comercial';
    const condo = condoClosed && isChecked(data?.condominio_incluso);
    const condoAmount = condoClosed && !condo ? amount(data?.condominio_valor) : null;
    return { types, type: primaryType(types), sale, rent, price: sale ?? rent ?? legacyPrice ?? 0, water: isChecked(data?.agua_inclusa), power: isChecked(data?.luz_inclusa), internet: isChecked(data?.internet_inclusa), condoClosed, condo, condoAmount };
  };
  const isValid = offer => offer.types.length > 0
    && (!offer.types.includes('Venda') || offer.sale > 0)
    && (!offer.types.includes('Aluguel') || offer.rent > 0)
    && (!offer.condoClosed || offer.condo || offer.condoAmount > 0);

  const describe = property => {
    const types = normalizeTypes(property?.tipos_transacao, property?.tipo);
    const descriptions = types.map(type => {
      if (type === 'Permuta') return 'Aceita permuta';
      const field = type === 'Venda' ? 'preco_venda' : 'preco_aluguel';
      const fallback = property?.tipo === type ? property?.preco : null;
      const price = amount(property?.[field] ?? fallback);
      if (price === null) return '';
      return `${type}: ${currency.format(price)}${type === 'Aluguel' ? '/mês' : ''}`;
    }).filter(Boolean);
    if (property?.categoria !== 'Comercial' && isChecked(property?.caracteristicas?.condominio) && !isChecked(property?.condominio_incluso)) {
      const condoFee = amount(property?.condominio_valor);
      if (condoFee !== null) descriptions.push(`Condomínio: ${currency.format(condoFee)}/mês`);
    }
    return descriptions.join(' · ') || (property?.tipo === 'Permuta' ? 'Aceita permuta' : currency.format(amount(property?.preco) || 0));
  };

  const summary = property => {
    const included = [];
    if (isChecked(property?.agua_inclusa)) included.push('Água');
    if (isChecked(property?.luz_inclusa)) included.push('Luz');
    if (isChecked(property?.internet_inclusa)) included.push('Internet');
    if (isChecked(property?.condominio_incluso)) included.push('Condomínio');
    const condoFee = property?.categoria !== 'Comercial' && isChecked(property?.caracteristicas?.condominio) && !isChecked(property?.condominio_incluso) ? amount(property?.condominio_valor) : null;
    return { transactions: normalizeTypes(property?.tipos_transacao, property?.tipo), prices: describe(property), included, condoFee };
  };

  const sort = (properties, order = 'recentes', transaction = '') => {
    const priceOf = property => {
      const offer = parse(property);
      if (transaction === 'Aluguel') return offer.rent ?? offer.price;
      if (transaction === 'Venda') return offer.sale ?? offer.price;
      return offer.sale ?? offer.rent ?? offer.price;
    };
    const idOf = property => Number(property?.id) || 0;
    return [...(properties || [])].sort((a, b) => {
      if (order === 'menor-valor') return priceOf(a) - priceOf(b) || idOf(b) - idOf(a);
      if (order === 'maior-valor') return priceOf(b) - priceOf(a) || idOf(b) - idOf(a);
      if (order === 'antigos') return idOf(a) - idOf(b);
      return idOf(b) - idOf(a);
    });
  };

  return { allowed, normalizeTypes, amount, format, primaryType, displayTitle, isChecked, parse, isValid, describe, summary, sort };
});
