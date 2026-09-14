(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.PropertyShare = api;
})(typeof globalThis !== 'undefined' ? globalThis : window, function () {
  const urlFor = (property, origin) => {
    if (!property?.id) return '';
    const base = origin || (typeof location !== 'undefined' ? location.origin : 'http://localhost');
    const url = new URL('imovel.html', `${String(base).replace(/\/?$/, '/')}`);
    url.searchParams.set('id', String(property.id));
    return url.href;
  };

  const share = async (property, environment = globalThis) => {
    const url = urlFor(property, environment.location?.origin);
    if (!url) return 'failed';
    const title = String(property.titulo || property.categoria || 'Imóvel');
    const text = [title, property.endereco].filter(Boolean).join(' · ');
    const payload = { title, text: `Confira este imóvel no Tatuí Imóveis: ${text}`, url };

    if (typeof environment.navigator?.share === 'function') {
      try {
        await environment.navigator.share(payload);
        return 'shared';
      } catch (error) {
        if (error?.name === 'AbortError') return 'cancelled';
      }
    }

    if (typeof environment.navigator?.clipboard?.writeText === 'function') {
      try {
        await environment.navigator.clipboard.writeText(url);
        return 'copied';
      } catch (_) { /* Use the compatibility fallback below. */ }
    }

    const document = environment.document;
    if (document?.body && typeof document.execCommand === 'function') {
      const field = document.createElement('textarea');
      field.value = url;
      field.setAttribute('readonly', '');
      field.style.position = 'fixed';
      field.style.opacity = '0';
      document.body.appendChild(field);
      field.select();
      let copied = false;
      try { copied = document.execCommand('copy'); } catch (_) { copied = false; }
      field.remove();
      if (copied) return 'copied';
    }

    if (typeof environment.prompt === 'function') {
      environment.prompt('Copie o link deste imóvel:', url);
      return 'prompted';
    }
    return 'failed';
  };

  return { urlFor, share };
});
