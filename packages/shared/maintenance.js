const MAINTENANCE_PAGE = '/manutencao.html';

function enabled(value) {
  return /^(1|true|yes|on)$/i.test(String(value || '').trim());
}

function isPublicPath(pathname) {
  return pathname === MAINTENANCE_PAGE || pathname === '/healthz';
}

function shouldShow(pathname, value) {
  return enabled(value) && !isPublicPath(pathname);
}

module.exports = { MAINTENANCE_PAGE, enabled, isPublicPath, shouldShow };
