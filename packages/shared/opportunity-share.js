(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.OpportunityShare = api;
})(typeof globalThis !== 'undefined' ? globalThis : window, function () {
  const urlFor = (opportunity, origin) => {
    const id = String(opportunity?.id || '').trim();
    if (!/^\d+$/.test(id)) return '';
    const base = origin || (typeof location !== 'undefined' ? location.origin : 'http://localhost');
    const url = new URL('/oportunidade', base);
    url.searchParams.set('id', id);
    return url.href;
  };

  const share = async (opportunity, environment = globalThis) => {
    const url = urlFor(opportunity, environment.location?.origin);
    if (!url) return 'failed';
    const title = String(opportunity?.titulo || 'Oportunidade de compra').trim();
    const payload = {
      title,
      text: `Confira esta oportunidade de compra no Tatuí Imóveis: ${title}`,
      url
    };

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
      } catch (_) { /* Continue com as alternativas compatíveis. */ }
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
      environment.prompt('Copie o link desta oportunidade:', url);
      return 'prompted';
    }
    return 'failed';
  };

  const messageFor = result => ({
    shared: 'Oportunidade compartilhada.',
    copied: 'Link copiado.',
    prompted: 'Copie o link exibido.',
    cancelled: 'Compartilhamento cancelado.',
    failed: 'Não foi possível compartilhar agora.'
  })[result] || 'Não foi possível compartilhar agora.';

  return { urlFor, share, messageFor };
});
