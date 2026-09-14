(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.PropertyContact = api;
})(typeof globalThis !== 'undefined' ? globalThis : window, function () {
  const phone = '5515998134885';

  function detailsUrl(property, baseUrl) {
    const origin = baseUrl || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
    return new URL(`/imovel.html?id=${encodeURIComponent(String(property?.id || ''))}`, origin).toString();
  }

  function messageForProperty(property, url) {
    const title = String(property?.titulo || property?.categoria || 'imóvel').trim();
    const address = String(property?.endereco || '').trim();
    return [
      `Olá! Tenho interesse no imóvel ${title}, anunciado no Tatuí Imóveis.`,
      address ? `Endereço: ${address}` : '',
      `Link do imóvel: ${url}`
    ].filter(Boolean).join('\n');
  }

  function toWhatsApp(message) {
    return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  }

  function listingLink(property, baseUrl) {
    return toWhatsApp(messageForProperty(property, detailsUrl(property, baseUrl)));
  }

  function formLink(property, contact, baseUrl) {
    const url = detailsUrl(property, baseUrl);
    const details = messageForProperty(property, url);
    const fields = [
      ['Nome', contact?.nome],
      ['Telefone', contact?.telefone],
      ['E-mail', contact?.email]
    ].filter(([, value]) => String(value || '').trim());
    const message = [details, '', ...fields.map(([label, value]) => `${label}: ${String(value).trim()}`)].join('\n');
    return toWhatsApp(message);
  }

  return { phone, detailsUrl, messageForProperty, listingLink, formLink };
});
