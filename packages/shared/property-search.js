(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.PropertySearch = api;
})(typeof globalThis !== 'undefined' ? globalThis : window, function () {
  const normalize = value => String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  const searchableText = property => normalize([
    property?.titulo,
    property?.categoria,
    property?.descricao,
    property?.endereco,
    property?.endereco_completo,
    property?.logradouro,
    property?.rua,
    property?.numero,
    property?.bairro,
    property?.cidade,
    property?.estado,
    property?.cep
  ].filter(value => value !== null && value !== undefined).join(' '));

  const matches = (property, query) => {
    const normalizedQuery = normalize(query);
    if (!normalizedQuery) return true;

    const text = searchableText(property);
    if (text.includes(normalizedQuery)) return true;

    const terms = normalizedQuery.split(/\s+/).filter(Boolean);
    if (terms.length > 1 && terms.every(term => text.includes(term))) return true;

    const compactQuery = normalizedQuery.replace(/\s/g, '');
    return compactQuery.length >= 5 && text.replace(/\s/g, '').includes(compactQuery);
  };

  return Object.freeze({ normalize, searchableText, matches });
});
