(function (root) {
  function escaparHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function textoParaHtml(value) {
    return String(value || '')
      .replace(/\r\n?/g, '\n')
      .split('\n')
      .map(line => `<p>${line ? escaparHtml(line) : '<br>'}</p>`)
      .join('');
  }

  function sanitizar(value) {
    return String(value || '')
      .replace(/<(script|style|iframe)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
      .replace(/<\/?(script|style|iframe)\b[^>]*>/gi, '')
      // contenteditable e colagens de texto rico usam DIVs para marcar linhas.
      .replace(/<div\b[^>]*>/gi, '<p>')
      .replace(/<\/div\s*>/gi, '</p>')
      .replace(/\r\n?/g, '<br>')
      .replace(/\s(?:on\w+|style|href|src|srcset)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
      .replace(/<(?!\/?(?:strong|b|em|i|u|ul|ol|li|p|br)(?:\s|>))[^>]*>/gi, '');
  }

  function decodificarEntidade(match, entity) {
    const normalized = entity.toLowerCase();
    if (normalized === 'amp') return '&';
    if (normalized === 'lt') return '<';
    if (normalized === 'gt') return '>';
    if (normalized === 'quot') return '"';
    if (normalized === 'apos' || normalized === '#39') return "'";
    if (normalized === 'nbsp') return ' ';
    const code = normalized.startsWith('#x')
      ? parseInt(normalized.slice(2), 16)
      : normalized.startsWith('#') ? parseInt(normalized.slice(1), 10) : NaN;
    try { return Number.isInteger(code) && code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match; }
    catch (_) { return match; }
  }

  function resumo(value) {
    return sanitizar(value)
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<\/(?:p|ul|ol|li)>/gi, ' ')
      .replace(/<(?:p|ul|ol|li|strong|b|em|i|u)\b[^>]*>/gi, ' ')
      .replace(/<[^>]*>/g, ' ')
      .replace(/&(#x[\da-f]+|#\d+|#39|amp|lt|gt|quot|apos|nbsp);/gi, decodificarEntidade)
      .replace(/\s+/gu, ' ')
      .trim();
  }

  root.PropertyDescription = { textoParaHtml, sanitizar, resumo };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.PropertyDescription;
})(typeof window !== 'undefined' ? window : globalThis);
