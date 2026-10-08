(() => {
  if (window.MaterialIcons) return;

  const aliases = {
    'arrow-left': 'arrow_back', 'arrow-right': 'arrow_forward', 'arrow-square-out': 'open_in_new',
    'map-pin': 'location_on', 'house': 'home', 'buildings': 'apartment', 'mountains': 'landscape',
    'tree': 'park', 'storefront': 'storefront', 'ruler': 'straighten', 'currency-circle-dollar': 'attach_money',
    'bed': 'bed', 'bathtub': 'bathtub', 'car': 'directions_car', 'swimming-pool': 'pool',
    'cooking-pot': 'outdoor_grill', 'elevator': 'elevator', 'drop': 'water_drop', 'lightning': 'bolt',
    'road-horizon': 'add_road', 'waves': 'waves', 'armchair': 'chair', 'wheelchair': 'accessible',
    'wind': 'air', 'chart-line': 'analytics', 'users': 'group', 'file-text': 'description',
    'envelope': 'mail', 'sparkle': 'auto_awesome', 'gear': 'settings', 'sign-out': 'logout',
    'pencil-simple': 'edit', 'trash': 'delete', 'plus': 'add', 'floppy-disk': 'save',
    'x': 'close', 'whatsapp-logo': 'chat'
  };

  const textAliases = [
    [/meu perfil/i, 'person'], [/meus imóveis/i, 'apartment'], [/sair|encerrar sessão/i, 'logout'],
    [/compartilh|share/i, 'share'], [/excluir|remover|lixeira/i, 'delete'],
    [/editar/i, 'edit'], [/salvar|publicar/i, 'save'], [/voltar/i, 'arrow_back'],
    [/fechar|cancelar/i, 'close'], [/visão geral|dashboard|métrica/i, 'analytics'],
    [/usuário/i, 'group'], [/auditoria|histórico|política|conteúdo/i, 'description'],
    [/e-mail|email|enviar/i, 'mail'], [/oportunidade/i, 'auto_awesome'],
    [/configuraç/i, 'settings'], [/localiza|endereço|bairro|cidade/i, 'location_on'],
    [/área|terreno/i, 'square_foot'], [/investimento|valor|preço/i, 'attach_money'],
    [/quarto|cama/i, 'bed'], [/banheiro/i, 'bathtub'], [/vaga|carro/i, 'directions_car'],
    [/visualiza|acesso/i, 'visibility'], [/interesse|mensagem|whatsapp/i, 'chat_bubble']
  ];

  function iconName(value) {
    const key = String(value || '').trim().toLowerCase();
    return aliases[key] || key.replaceAll('-', '_');
  }

  function makeIcon(name, className = '') {
    const icon = document.createElement('span');
    icon.className = `material-symbol-icon${className ? ` ${className}` : ''}`;
    icon.textContent = iconName(name);
    icon.setAttribute('aria-hidden', 'true');
    return icon;
  }

  function svgName(svg) {
    const classes = typeof svg.className === 'object' ? svg.className.baseVal : String(svg.className || '');
    if (/listing-whatsapp-icon/.test(classes) || svg.closest('.advertiser-help-contact, .leaflet-container, .mapboxgl-map')) return '';
    if (/home-opportunity-icon/.test(classes)) return iconName(svg.dataset.materialSymbol || 'auto_awesome');
    if (/password-eye-open/.test(classes)) return 'visibility';
    if (/password-eye-closed/.test(classes)) return 'visibility_off';
    if (/property-share-icon/.test(classes)) return 'share';
    if (/property-delete-icon/.test(classes) || svg.closest('.property-delete-icon')) return 'delete';
    if (svg.closest('.user-menu-icon')) {
      const label = svg.closest('[role="menuitem"]')?.textContent || '';
      return textAliases.find(([pattern]) => pattern.test(label))?.[1] || 'person';
    }
    const stat = svg.closest('.owner-property-stat');
    if (stat) return textAliases.find(([pattern]) => pattern.test(`${stat.title} ${stat.textContent}`))?.[1] || 'analytics';
    if (svg.closest('.home-nearby-button')) return 'my_location';
    const label = [svg.getAttribute('aria-label'), svg.getAttribute('title'), svg.parentElement?.getAttribute('aria-label'), svg.parentElement?.textContent].filter(Boolean).join(' ');
    return textAliases.find(([pattern]) => pattern.test(label))?.[1] || 'auto_awesome';
  }

  function enhance(root = document) {
    const find = selector => [
      ...(root.matches?.(selector) ? [root] : []),
      ...root.querySelectorAll(selector)
    ].filter(element => !element.closest?.('#app'));
    find('[data-material-symbol]').forEach(element => {
      if (element.dataset.materialized === 'true') return;
      const icon = makeIcon(element.dataset.materialSymbol, element.className);
      element.dataset.materialized = 'true';
      element.replaceWith(icon);
    });
    find('[data-phosphor]').forEach(element => {
      if (element.dataset.materialized === 'true') return;
      const name = iconName(element.dataset.phosphor);
      element.classList.remove('phosphor-icon');
      element.classList.add('material-symbol-icon');
      element.dataset.materialized = 'true';
      element.textContent = name;
      element.removeAttribute('data-phosphor');
      element.setAttribute('aria-hidden', 'true');
    });
    find('svg').forEach(svg => {
      if (svg.dataset.materialized === 'true') return;
      const name = svgName(svg);
      if (!name) return;
      const icon = makeIcon(name, [...svg.classList].join(' '));
      svg.dataset.materialized = 'true';
      svg.replaceWith(icon);
    });
    find('.listing-photo-arrow').forEach(button => {
      if (button.dataset.materialized === 'true') return;
      const name = button.classList.contains('listing-photo-prev') ? 'arrow_back' : 'arrow_forward';
      button.replaceChildren(makeIcon(name));
      button.dataset.materialized = 'true';
    });
    find('.lightbox-nav, .modal-close, .lightbox-close').forEach(button => {
      if (button.dataset.materialized === 'true') return;
      const name = button.classList.contains('lightbox-prev') ? 'arrow_back' : button.classList.contains('lightbox-next') ? 'arrow_forward' : 'close';
      button.replaceChildren(makeIcon(name));
      button.dataset.materialized = 'true';
    });
    find('span, div').forEach(element => {
      if (element.children.length || element.classList.contains('material-symbol-icon')) return;
      const symbol = { '←': 'arrow_back', '→': 'arrow_forward', '‹': 'arrow_back', '›': 'arrow_forward', '×': 'close', '✓': 'check', '⌂': 'home', '⌖': 'location_on', '⌕': 'search', '↔': 'swap_horiz' }[element.textContent.trim()];
      if (!symbol) return;
      element.replaceChildren(makeIcon(symbol));
    });
    find('button, a').forEach(element => {
      if (element.querySelector('.material-symbol-icon') || element.dataset.materialized === 'true') return;
      const firstText = element.firstChild;
      if (firstText?.nodeType !== Node.TEXT_NODE || !/^\s*\+\s+/.test(firstText.textContent)) return;
      firstText.textContent = firstText.textContent.replace(/^\s*\+\s+/, '');
      element.prepend(makeIcon('add'));
    });
  }

  window.MaterialIcons = { iconName, makeIcon, enhance };
  enhance();
  new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(node => {
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    if (node.closest('#app')) return;
    enhance(node);
  }))).observe(document.documentElement, { childList: true, subtree: true });
})();
