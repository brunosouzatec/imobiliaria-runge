(() => {
  const phosphorStyles = document.createElement('link');
  phosphorStyles.rel = 'stylesheet';
  phosphorStyles.href = '/phosphor-icons.css';
  document.head.appendChild(phosphorStyles);
  function header(activePage = '') {
    return `<header class="react-header" data-site-chrome="header"><a class="react-brand" href="index.html"><img src="assets/tatui-imoveis-logo.svg" alt="Tatuí Imóveis — O portal de imóveis de Tatuí"></a><a class="home-button${activePage === 'home' ? ' active' : ''}" href="index.html">Página inicial</a><nav class="react-nav"><a class="${activePage === 'opportunities' ? 'active' : ''}" href="oportunidades.html">Oportunidades</a><a class="${activePage === 'properties' ? 'active' : ''}" href="imoveis.html">Imóveis</a><a class="${activePage === 'announce' ? 'active' : ''}" href="cadastro.html">Anunciar</a><a class="react-action${activePage === 'account' ? ' active' : ''}" href="login.html">Área do usuário</a></nav></header>`;
  }

  function footer() {
    return '<footer class="site-footer" id="contato" data-site-chrome="footer"><a class="site-footer-brand" href="index.html"><img src="assets/tatui-imoveis-logo-light.svg" alt="Tatuí Imóveis"><span>O portal de imóveis de Tatuí.</span></a><nav><a href="imoveis.html">Comprar</a><a href="imoveis.html?tipo=Aluguel">Alugar</a><a href="imoveis.html">Imóveis</a><a href="oportunidades.html">Oportunidades</a><a href="index.html#contato">Contato</a><a href="privacidade.html">Política de Privacidade</a></nav><span class="site-footer-note">Tatuí, a cidade que a gente ama.</span></footer>';
  }

  function mount(root = document, activePage = '') {
    root.querySelector('[data-site-header]')?.insertAdjacentHTML('beforebegin', header(activePage));
    root.querySelector('[data-site-footer]')?.insertAdjacentHTML('beforebegin', footer());
    root.querySelector('[data-site-header]')?.remove();
    root.querySelector('[data-site-footer]')?.remove();
  }

  function observeCadastro() {
    const replace = () => {
      const legacyHeader = document.querySelector('.cadastro-site-header');
      if (legacyHeader) legacyHeader.outerHTML = header('announce');
      const legacyFooter = [...document.body.children].find(element => element.matches('footer.site-footer') && !element.hasAttribute('data-site-chrome'));
      if (legacyFooter) legacyFooter.outerHTML = footer();
    };
    replace();
    new MutationObserver(replace).observe(document.body, { childList: true, subtree: false });
  }

  window.SiteChrome = { header, footer, mount, observeCadastro };
})();
