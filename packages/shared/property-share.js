(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.PropertyShare = api;
})(typeof globalThis !== 'undefined' ? globalThis : window, function () {
  const urlFor = (property, origin) => {
    if (!property?.id) return '';
    const base = origin || (typeof location !== 'undefined' ? location.origin : 'http://localhost');
    const url = new URL('/imovel', base);
    url.searchParams.set('id', String(property.id));
    return url.href;
  };

  const photoUrlFor = property => String(property?.fotos?.[0]?.url || '').trim();

  const fileForPhoto = async (property, environment) => {
    const photoUrl = photoUrlFor(property);
    const FileCtor = environment.File || (typeof File !== 'undefined' ? File : null);
    if (!photoUrl || typeof environment.fetch !== 'function' || !FileCtor) return null;
    const response = await environment.fetch(photoUrl, { mode: 'cors' });
    if (!response.ok) return null;
    const blob = await response.blob();
    const type = blob.type || 'image/jpeg';
    const extension = type.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
    return new FileCtor([blob], `imovel-${property.id}.${extension}`, { type });
  };

  const share = async (property, environment = globalThis, options = {}) => {
    const url = urlFor(property, environment.location?.origin);
    if (!url) return 'failed';
    const title = String(property.titulo || property.categoria || 'Imóvel');
    const text = [title, property.endereco].filter(Boolean).join(' · ');
    const payload = { title, text: `Confira este imóvel no Tatuí Imóveis: ${text}`, url };
    const photoUrl = photoUrlFor(property);
    let photoAttached = false;

    if (typeof environment.navigator?.share === 'function') {
      try {
        try {
          const file = await fileForPhoto(property, environment);
          if (file && (!environment.navigator.canShare || environment.navigator.canShare({ files: [file] }))) {
            payload.files = [file];
            photoAttached = true;
          }
        } catch (_) { /* Compartilha texto e link quando a foto não puder ser anexada. */ }
        if (!options.requireFile || !photoUrl || photoAttached) {
          await environment.navigator.share(payload);
          return 'shared';
        }
      } catch (error) {
        if (error?.name === 'AbortError') return 'cancelled';
      }
    }

    if (options.fallbackUrl && typeof environment.open === 'function') {
      environment.open(options.fallbackUrl, '_blank', 'noopener,noreferrer');
      return 'fallback';
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

  return { urlFor, photoUrlFor, share };
});
