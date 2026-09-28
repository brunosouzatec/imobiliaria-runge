(function (root) {
  function escaparHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function urlAbsoluta(value, baseUrl) {
    if (typeof value !== 'string' || !value.trim()) return '';
    try {
      const url = new URL(value, baseUrl);
      return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
    } catch (_) {
      return '';
    }
  }

  function criarTags(property, photoPath, publicUrl, summary) {
    let base;
    try {
      base = new URL(publicUrl);
      if (!['http:', 'https:'].includes(base.protocol)) return '';
    } catch (_) {
      return '';
    }

    const id = Number(property?.id);
    if (!Number.isSafeInteger(id) || id < 1) return '';

    const canonicalUrl = new URL(`/imovel?id=${id}`, base).href;
    const imageUrl = urlAbsoluta(photoPath, base.href);
    const location = [property?.bairro, property?.cidade, property?.estado]
      .map(value => String(value || '').trim())
      .filter(Boolean)
      .join(', ');
    const title = [property?.categoria || 'Imóvel', property?.tipo]
      .map(value => String(value || '').trim())
      .filter(Boolean)
      .join(' para ');
    const descriptionParts = [title, location, summary]
      .map(value => String(value || '').trim())
      .filter(Boolean);
    const description = (descriptionParts.join(' · ') || 'Confira este imóvel no portal Tatuí Imóveis.').slice(0, 300);
    const imageAlt = `Foto do imóvel ${property?.categoria || 'anunciado'}${location ? ` em ${location}` : ''}`;
    const pageTitle = `${title || 'Imóvel em Tatuí'} | Tatuí Imóveis`;

    return [
      `<title>${escaparHtml(pageTitle)}</title>`,
      `<meta property="og:type" content="website">`,
      `<meta property="og:site_name" content="Tatuí Imóveis">`,
      `<meta property="og:title" content="${escaparHtml(pageTitle)}">`,
      `<meta property="og:description" content="${escaparHtml(description)}">`,
      `<meta property="og:url" content="${escaparHtml(canonicalUrl)}">`,
      imageUrl ? `<meta property="og:image" content="${escaparHtml(imageUrl)}">` : '',
      imageUrl && new URL(imageUrl).protocol === 'https:' ? `<meta property="og:image:secure_url" content="${escaparHtml(imageUrl)}">` : '',
      imageUrl ? `<meta property="og:image:alt" content="${escaparHtml(imageAlt)}">` : '',
      `<meta name="twitter:card" content="${imageUrl ? 'summary_large_image' : 'summary'}">`,
      `<meta name="twitter:title" content="${escaparHtml(pageTitle)}">`,
      `<meta name="twitter:description" content="${escaparHtml(description)}">`,
      imageUrl ? `<meta name="twitter:image" content="${escaparHtml(imageUrl)}">` : ''
    ].filter(Boolean).join('');
  }

  const api = { criarTags, urlAbsoluta };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.PropertyOpenGraph = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
