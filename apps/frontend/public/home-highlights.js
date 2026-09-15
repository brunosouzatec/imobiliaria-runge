(function () {
  const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

  function text(value) { return String(value || '').trim(); }
  function price(item) {
    const sale = Number(item.preco_venda || 0);
    const rent = Number(item.preco_aluguel || 0);
    if (sale && rent) return `Venda ${money.format(sale)} · Aluguel ${money.format(rent)}/mês`;
    if (rent) return `${money.format(rent)}/mês`;
    if (sale) return money.format(sale);
    return 'Consulte o valor';
  }
  function address(item) {
    return [item.rua, item.numero && `nº ${item.numero}`, item.bairro, item.cidade, item.estado].filter(Boolean).join(', ') || text(item.endereco) || 'Localização não informada';
  }
  function makeCard(item, index) {
    const card = document.createElement('article');
    card.className = 'home-highlight-card';
    const link = document.createElement('a');
    link.className = 'home-highlight-media';
    link.href = `imovel.html?id=${encodeURIComponent(item.id)}`;
    link.setAttribute('aria-label', `Ver ${text(item.titulo) || 'imóvel'} em detalhes`);
    if (item.fotos && item.fotos[0] && item.fotos[0].url) {
      const image = document.createElement('img');
      image.src = item.fotos[0].url;
      image.alt = text(item.fotos[0].nome) || text(item.titulo) || 'Foto do imóvel';
      image.loading = index < 2 ? 'eager' : 'lazy';
      link.append(image);
    } else {
      const empty = document.createElement('span');
      empty.textContent = 'Sem foto disponível';
      link.append(empty);
    }
    const badge = document.createElement('span');
    badge.className = 'home-highlight-badge';
    badge.textContent = 'Destaque do mês';
    link.append(badge);
    card.append(link);

    const body = document.createElement('div');
    body.className = 'home-highlight-body';
    const category = document.createElement('p');
    category.className = 'home-highlight-category';
    category.textContent = [text(item.categoria), (item.tipos_transacao || []).join(' / ')].filter(Boolean).join(' · ');
    const title = document.createElement('h3');
    title.textContent = text(item.titulo) || `${text(item.categoria) || 'Imóvel'} em Tatuí`;
    const value = document.createElement('strong');
    value.className = 'home-highlight-price';
    value.textContent = price(item);
    const location = document.createElement('p');
    location.className = 'home-highlight-location';
    location.textContent = address(item);
    const footer = document.createElement('div');
    footer.className = 'home-highlight-footer';
    const views = document.createElement('span');
    views.textContent = `${Number(item.visualizacoes || 0)} acesso${Number(item.visualizacoes || 0) === 1 ? '' : 's'} este mês`;
    const details = document.createElement('a');
    details.href = link.href;
    details.textContent = 'Ver detalhes →';
    footer.append(views, details);
    body.append(category, title, value, location, footer);
    card.append(body);
    return card;
  }

  async function load() {
    const footer = document.querySelector('.home-footer');
    if (!footer) return;
    try {
      const response = await fetch('/api/imoveis/destaques?limit=4');
      if (!response.ok) return;
      const items = await response.json();
      if (!Array.isArray(items) || !items.length) return;
      const section = document.createElement('section');
      section.className = 'home-highlights-section';
      section.setAttribute('aria-labelledby', 'home-highlights-title');
      const heading = document.createElement('div');
      heading.className = 'home-highlights-heading';
      const eyebrow = document.createElement('p');
      eyebrow.className = 'home-kicker';
      eyebrow.textContent = 'Em alta neste mês';
      const title = document.createElement('h2');
      title.id = 'home-highlights-title';
      title.textContent = 'Imóveis mais acessados';
      const lead = document.createElement('p');
      lead.textContent = 'Conheça os anúncios que mais despertaram interesse em Tatuí.';
      heading.append(eyebrow, title, lead);
      const grid = document.createElement('div');
      grid.className = 'home-highlights-grid';
      items.forEach((item, index) => grid.append(makeCard(item, index)));
      section.append(heading, grid);
      footer.parentNode.insertBefore(section, footer);
    } catch (_) { /* A home sem ranking continua utilizável se a API estiver indisponível. */ }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load, { once: true });
  else load();
}());
