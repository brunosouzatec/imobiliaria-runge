(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.YouTubeVideo = api;
})(typeof globalThis !== 'undefined' ? globalThis : window, function () {
  const hosts = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be', 'youtube-nocookie.com', 'www.youtube-nocookie.com']);
  const videoIdPattern = /^[A-Za-z0-9_-]{11}$/;

  const extractId = value => {
    if (typeof value !== 'string' || !value.trim()) return null;
    let candidate = value.trim();
    if (!/^[a-z][a-z\d+.-]*:/i.test(candidate)) candidate = `https://${candidate}`;
    let url;
    try { url = new URL(candidate); } catch (_) { return null; }
    if (!['http:', 'https:'].includes(url.protocol) || !hosts.has(url.hostname.toLowerCase())) return null;

    let id = null;
    if (url.hostname.toLowerCase() === 'youtu.be') id = url.pathname.split('/').filter(Boolean)[0] || null;
    else if (url.pathname === '/watch') id = url.searchParams.get('v');
    else id = url.pathname.match(/^\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{11})(?:\/|$)/)?.[1] || null;
    return videoIdPattern.test(id || '') ? id : null;
  };

  const isValidInput = value => value == null || (typeof value === 'string' && (!value.trim() || Boolean(extractId(value))));
  const isVideoId = value => typeof value === 'string' && videoIdPattern.test(value);
  const watchUrl = value => isVideoId(value) ? `https://www.youtube.com/watch?v=${value}` : '';
  const embedUrl = value => isVideoId(value) ? `https://www.youtube-nocookie.com/embed/${value}?rel=0` : '';

  return { extractId, isValidInput, isVideoId, watchUrl, embedUrl };
});
