(() => {
  const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
  const number = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
  const clean = value => String(value ?? '').trim();
  const iconPaths = {
    'map-pin': ['M128 232s80-72 80-136a80 80 0 1 0-160 0c0 64 80 136 80 136Z', 'M128 120a24 24 0 1 0 0-48 24 24 0 0 0 0 48Z'],
    ruler: ['m224 56-168 168-40-40L184 16l40 40Z', 'm152 48 24 24', 'm120 80 24 24', 'm88 112 24 24', 'm56 144 24 24'],
    bed: ['M24 160V56', 'M24 160h208v40', 'M24 120h208v40', 'M60 120V88h48a24 24 0 0 1 24 24v8', 'M132 120V88h60a40 40 0 0 1 40 40v32'],
    'currency-circle-dollar': ['M224 128a96 96 0 1 1-192 0 96 96 0 0 1 192 0Z', 'M160 88c-8-12-21-18-36-18-20 0-36 11-36 27s14 23 40 29 40 13 40 29-16 27-40 27c-17 0-31-7-40-19', 'M128 54v148'],
    'arrows-left-right': ['M40 96h176', 'm160 40 56 56-56 56', 'M216 160H40', 'm96 104-56 56 56 56'],
    'arrow-right': ['M32 128h192', 'm144 48 80 80-80 80'],
    share: ['M200 88a32 32 0 1 1-64 0 32 32 0 0 1 64 0Z', 'M88 128a32 32 0 1 1-64 0 32 32 0 0 1 64 0Z', 'M200 168a32 32 0 1 1-64 0 32 32 0 0 1 64 0Z', 'm86 112 55-32', 'm86 144 55 32']
  };

  function icon(name) {
    if (name === 'arrows-left-right') {
      const exchange = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      exchange.setAttribute('viewBox', '0 0 256 256');
      exchange.setAttribute('class', 'home-opportunity-icon home-opportunity-exchange-icon');
      exchange.setAttribute('aria-hidden', 'true');
      exchange.setAttribute('focusable', 'false');
      for (const d of iconPaths[name]) {
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', d);
        exchange.append(path);
      }
      return exchange;
    }
    if (window.MaterialIcons) return window.MaterialIcons.makeIcon(({ 'map-pin': 'location_on', ruler: 'straighten', bed: 'bed', 'currency-circle-dollar': 'attach_money', 'arrow-right': 'arrow_forward', share: 'share' })[name] || 'auto_awesome', 'home-opportunity-icon');
    const element = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    element.setAttribute('viewBox', '0 0 256 256');
    element.setAttribute('class', 'home-opportunity-icon');
    element.dataset.materialSymbol = name;
    element.setAttribute('aria-hidden', 'true');
    element.setAttribute('focusable', 'false');
    for (const d of iconPaths[name] || iconPaths['arrow-right']) {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', d);
      element.append(path);
    }
    return element;
  }

  function fact(value, iconName) {
    const row = document.createElement('li');
    row.append(icon(iconName));
    const copy = document.createElement('span');
    copy.className = 'home-opportunity-fact-copy';
    const detail = document.createElement('strong');
    detail.textContent = value;
    copy.append(detail);
    row.append(copy);
    return row;
  }

  function investment(item) {
    const minimum = item.valor_minimo == null ? null : Number(item.valor_minimo);
    const maximum = item.valor_maximo == null ? null : Number(item.valor_maximo);
    const monthly = Array.isArray(item.transacoes) && item.transacoes.length === 1 && item.transacoes[0] === 'Aluguel';
    const format = value => `${money.format(value)}${monthly ? '/mês' : ''}`;
    if (minimum == null && maximum == null) return 'A combinar';
    if (minimum == null) return `Até ${format(maximum)}`;
    if (maximum == null) return `A partir de ${format(minimum)}`;
    return `${format(minimum)} a ${format(maximum)}`;
  }

  function area(item) {
    const minimum = item.area_total_minima == null ? null : Number(item.area_total_minima);
    const maximum = item.area_total_maxima == null ? null : Number(item.area_total_maxima);
    if (minimum == null && maximum == null) return 'A combinar';
    if (minimum == null) return `Até ${number.format(maximum)} m²`;
    if (maximum == null) return `A partir de ${number.format(minimum)} m²`;
    return `${number.format(minimum)} a ${number.format(maximum)} m²`;
  }

  function makeCard(item) {
    const card = document.createElement('article');
    card.className = 'home-opportunity-card';

    const detailsUrl = `oportunidade.html?id=${encodeURIComponent(item.id)}`;
    const cardLink = document.createElement('a');
    cardLink.className = 'home-opportunity-hit-area';
    cardLink.href = detailsUrl;
    cardLink.setAttribute('aria-label', `Ver detalhes da oportunidade: ${clean(item.titulo)}`);

    const title = document.createElement('h3');
    title.textContent = clean(item.titulo) || 'Imóvel procurado';
    const location = document.createElement('p');
    location.className = 'home-opportunity-location';
    location.append(icon('map-pin'));
    location.append(document.createTextNode([item.cidade, item.estado].filter(Boolean).join(' / ') || 'Localização a combinar'));

    const facts = document.createElement('ul');
    facts.className = 'home-opportunity-facts';
    const rooms = Number(item.quartos_minimos || 0);
    if (rooms > 0) facts.append(fact(`${number.format(rooms)} ${rooms === 1 ? 'quarto' : 'quartos'}`, 'bed'));
    else if (item.area_total_minima != null || item.area_total_maxima != null) facts.append(fact(area(item), 'ruler'));
    else {
      const transactions = Array.isArray(item.transacoes) ? item.transacoes : [];
      const transactionNames = transactions.map(value => value === 'Venda' ? 'Compra' : value);
      facts.append(fact(transactionNames.join(' · ') || 'Negociação a combinar', 'arrows-left-right'));
    }
    facts.append(fact(investment(item), 'currency-circle-dollar'));

    const link = document.createElement('a');
    link.className = 'home-opportunity-cta';
    link.href = window.OpportunityShare?.contactLink(item) || `oportunidade.html?id=${encodeURIComponent(item.id)}`;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = 'Tenho imóvel compatível';
    link.setAttribute('aria-label', `Tenho imóvel compatível com a oportunidade: ${clean(item.titulo)}`);

    const details = document.createElement('a');
    details.className = 'home-opportunity-details';
    details.href = detailsUrl;
    details.textContent = 'Ver detalhes';

    const actions = document.createElement('div');
    actions.className = 'home-opportunity-actions';
    const share = document.createElement('button');
    share.className = 'home-opportunity-share';
    share.type = 'button';
    share.setAttribute('aria-label', `Compartilhar oportunidade: ${clean(item.titulo)}`);
    share.title = 'Compartilhar oportunidade';
    share.append(icon('share'));
    const shareStatus = document.createElement('span');
    shareStatus.className = 'home-opportunity-share-status';
    shareStatus.setAttribute('role', 'status');
    shareStatus.setAttribute('aria-live', 'polite');
    share.addEventListener('click', async () => {
      share.disabled = true;
      const result = await window.OpportunityShare?.share(item) || 'failed';
      shareStatus.textContent = window.OpportunityShare?.messageFor(result) || 'Não foi possível compartilhar agora.';
      share.disabled = false;
    });
    actions.append(link, details, share);

    card.append(cardLink, title, location, facts, actions, shareStatus);
    return card;
  }

  async function load() {
    const response = await fetch('/api/oportunidades?limit=3');
    if (!response.ok) return;
    const items = await response.json();
    if (!Array.isArray(items) || items.length === 0) return;

    const section = document.createElement('section');
    section.className = 'home-opportunities-section';
    section.setAttribute('aria-labelledby', 'home-opportunities-title');

    const header = document.createElement('header');
    header.className = 'home-opportunities-heading';
    const headingCopy = document.createElement('div');
    const eyebrow = document.createElement('p');
    eyebrow.className = 'home-kicker';
    eyebrow.textContent = 'Oportunidades';
    const title = document.createElement('h2');
    title.id = 'home-opportunities-title';
    title.textContent = 'Oportunidades';
    const description = document.createElement('p');
    description.textContent = 'Veja quem está procurando um imóvel em Tatuí.';
    headingCopy.append(eyebrow, title, description);

    header.append(headingCopy);

    const grid = document.createElement('div');
    grid.className = 'home-opportunities-grid';
    grid.dataset.count = String(Math.min(items.length, 3));
    items.slice(0, 3).forEach(item => grid.append(makeCard(item)));

    const footer = document.createElement('div');
    footer.className = 'home-opportunities-footer';
    const actions = document.createElement('div');
    actions.className = 'home-opportunities-footer-actions';
    const publish = document.createElement('a');
    publish.className = 'home-opportunities-publish';
    publish.href = 'https://wa.me/5515998134885?text=' + encodeURIComponent('Olá! Gostaria de publicar uma oportunidade de compra no Tatuí Imóveis.');
    publish.target = '_blank';
    publish.rel = 'noopener noreferrer';
    publish.textContent = 'Publicar uma busca';
    const allLink = document.createElement('a');
    allLink.className = 'home-opportunities-all';
    allLink.href = 'oportunidades.html';
    allLink.textContent = 'Ver oportunidades';
    const arrow = icon('arrow-right');
    arrow.classList.add('home-opportunities-arrow');
    allLink.append(' ', arrow);
    const note = document.createElement('small');
    note.textContent = 'As oportunidades são cadastradas pela equipe Tatuí Imóveis.';
    actions.append(publish, allLink);
    footer.append(actions, note);
    section.append(header, grid, footer);

    const homeFooter = document.querySelector('.site-footer, .home-footer');
    if (!homeFooter) return;
    const popularProperties = document.querySelector('.home-highlights-section');
    homeFooter.parentNode.insertBefore(section, popularProperties || homeFooter);
  }

  function whenHomeReady(attempt = 0) {
    if (document.querySelector('.site-footer, .home-footer')) {
      load().catch(() => { /* Se a API falhar, a home continua sem um bloco vazio. */ });
      return;
    }
    if (attempt < 100) window.setTimeout(() => whenHomeReady(attempt + 1), 50);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => whenHomeReady(), { once: true });
  else whenHomeReady();
})();
