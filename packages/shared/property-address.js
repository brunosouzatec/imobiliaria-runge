(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.PropertyAddress = api;
})(typeof globalThis !== 'undefined' ? globalThis : window, function () {
  const formatCep = value => {
    const digits = String(value || '').replace(/\D/g, '').slice(0, 8);
    return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
  };

  const fromMapFeature = (feature, current = {}) => {
    const context = feature?.context || [];
    const get = prefix => context.find(item => item.id?.startsWith(`${prefix}.`));
    const types = feature?.place_type || [];
    const address = types.includes('address') ? feature : null;
    const region = get('region');
    return {
      cep: formatCep(get('postcode')?.text || current.cep),
      rua: address?.text || current.rua || '',
      numero: address?.address || address?.properties?.address || current.numero || '',
      bairro: get('neighborhood')?.text || get('district')?.text || current.bairro || '',
      cidade: get('locality')?.text || get('place')?.text || current.cidade || '',
      estado: region?.short_code?.split('-').pop()?.toUpperCase() || current.estado || ''
    };
  };

  const fromStored = property => {
    const parts = String(property?.endereco || '').split(',').map(part => part.trim()).filter(Boolean);
    const street = parts[0] || '';
    const numberMatch = `${street}, ${parts[1] || ''}`.match(/(?:n[ºo]?\.?\s*)?(\d+[A-Za-z]?)\b/i);
    const state = String(property?.estado || parts.at(-1) || '').replace(/^.*\s-\s/, '').replace(/\bBrasil\b/i, '').trim();
    const withoutState = parts.filter((_, index) => index !== parts.length - 1);
    const city = property?.cidade || withoutState.at(-1) || '';
    const neighborhood = property?.bairro || withoutState.at(-2) || '';
    return {
      cep: formatCep(property?.cep),
      rua: property?.rua || street.replace(/,?\s*(?:n[ºo]?\.?\s*)?\d+[A-Za-z]?\s*$/i, '').trim(),
      numero: property?.numero || numberMatch?.[1] || '',
      bairro: neighborhood,
      cidade: city,
      estado: state
    };
  };

  const display = address => [
    [address.rua, address.numero ? `nº ${address.numero}` : ''].filter(Boolean).join(', '),
    address.bairro,
    address.cidade,
    address.estado,
    address.cep ? `CEP ${formatCep(address.cep)}` : ''
  ].filter(Boolean).join(', ');

  const query = address => [
    [address.rua, address.numero].filter(Boolean).join(', '),
    address.bairro,
    address.cidade,
    address.estado,
    formatCep(address.cep)
  ].filter(Boolean).join(', ');

  return { formatCep, fromMapFeature, fromStored, display, query };
});
