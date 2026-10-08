(() => {
  const materialIconsScript = document.createElement('script');
  materialIconsScript.src = '/material-icons.js';
  materialIconsScript.onload = () => window.MaterialIcons?.enhance(document);
  document.head.appendChild(materialIconsScript);
  function header(activePage = '') {
    return `<header class="react-header" data-site-chrome="header"><a class="react-brand" href="index.html"><img src="assets/tatui-imoveis-logo.svg" alt="Tatuí Imóveis — O portal de imóveis de Tatuí"></a><a class="home-button${activePage === 'home' ? ' active' : ''}" href="index.html">Página inicial</a><nav class="react-nav"><a class="${activePage === 'opportunities' ? 'active' : ''}" href="oportunidades.html">Oportunidades</a><a class="${activePage === 'properties' ? 'active' : ''}" href="imoveis.html">Imóveis</a><a class="${activePage === 'announce' ? 'active' : ''}" href="cadastro.html">Anunciar</a><a class="react-action${activePage === 'account' ? ' active' : ''}" href="login.html">Área do usuário</a></nav></header>`;
  }

  function footer() {
    return '<footer class="site-footer" id="contato" data-site-chrome="footer"><a class="site-footer-brand" href="index.html"><img src="assets/tatui-imoveis-logo-light.svg" alt="Tatuí Imóveis"><span>O portal de imóveis de Tatuí.</span><span class="site-footer-creci">Corretora de imóveis · CRECI-SP 273083-F</span></a><nav><a href="imoveis.html">Comprar</a><a href="imoveis.html?tipo=Aluguel">Alugar</a><a href="imoveis.html">Imóveis</a><a href="oportunidades.html">Oportunidades</a><a href="index.html#contato">Contato</a><a href="privacidade.html">Política de Privacidade</a><a href="termos-de-uso.html">Termos de Uso</a></nav><span class="site-footer-note">Tatuí, a cidade que a gente ama.</span></footer>';
  }

  function ensureAdvertiserHelp(root = document) {
    if (!root.body || root.body.querySelector('.advertiser-help-contact')) return;
    const message = encodeURIComponent('Olá! Sou anunciante no Tatuí Imóveis e estou com uma dúvida. Pode me ajudar?');
    root.body.insertAdjacentHTML('beforeend', `<a class="advertiser-help-contact" href="https://wa.me/5515998134885?text=${message}" target="_blank" rel="noopener noreferrer" aria-label="Dúvidas para anunciar? Fale com a equipe pelo WhatsApp"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.67-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.247-.694.247-1.29.173-1.414-.074-.123-.272-.198-.57-.347M12.051 21.785h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.999-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.99 2.898a9.825 9.825 0 0 1 2.894 6.993c-.002 5.45-4.437 9.885-9.889 9.885m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.334.157 11.89c0 2.096.547 4.142 1.588 5.946L.057 24l6.304-1.654a11.88 11.88 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.334 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg><span><strong>Precisa de ajuda?</strong><small>Fale com a gente</small></span></a>`);
  }

  function mount(root = document, activePage = '') {
    root.querySelector('[data-site-header]')?.insertAdjacentHTML('beforebegin', header(activePage));
    root.querySelector('[data-site-footer]')?.insertAdjacentHTML('beforebegin', footer());
    root.querySelector('[data-site-header]')?.remove();
    root.querySelector('[data-site-footer]')?.remove();
    ensureAdvertiserHelp(root);
  }

  function observeCadastro() {
    const replace = () => {
      const legacyHeader = document.querySelector('.cadastro-site-header');
      if (legacyHeader) legacyHeader.outerHTML = header('announce');
      const legacyFooter = [...document.body.children].find(element => element.matches('footer.site-footer') && !element.hasAttribute('data-site-chrome'));
      if (legacyFooter) legacyFooter.outerHTML = footer();
    };
    replace();
    ensureAdvertiserHelp(document);
    new MutationObserver(replace).observe(document.body, { childList: true, subtree: false });
  }

  window.SiteChrome = { header, footer, mount, observeCadastro, ensureAdvertiserHelp };
})();
