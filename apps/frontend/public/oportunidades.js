(() => {
  const app = document.querySelector('#oportunidades-app');
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const money = value => value == null ? 'A combinar' : Number(value).toLocaleString('pt-BR', { style:'currency', currency:'BRL', maximumFractionDigits:0 });
  function enhanceIcons() { app.querySelectorAll('.op-card-details > span[aria-hidden="true"]').forEach(element => { element.textContent = ''; element.className = 'phosphor-icon'; element.dataset.phosphor = 'arrow-right'; }); app.querySelectorAll('.op-whatsapp > span[aria-hidden="true"]').forEach(element => { element.textContent = ''; element.className = 'phosphor-icon'; element.dataset.phosphor = 'whatsapp-logo'; }); }
  const whatsapp = item => 'https://wa.me/5515998134885?text=' + encodeURIComponent(`Olá! Tenho interesse na oportunidade "${item.titulo}" no Tatuí Imóveis.`);
  const icon = name => {
    const names = { location: 'map-pin', property: 'house', neighborhood: 'buildings', money: 'currency-circle-dollar', area: 'ruler' };
    return `<span class="phosphor-icon op-card-icon" data-phosphor="${names[name] || 'sparkle'}" aria-hidden="true"></span>`;
  };
  async function load() {
    const params = new URLSearchParams(location.search);
    const query = new URLSearchParams();
    if (params.get('q')) query.set('q', params.get('q'));
    if (params.get('tipo')) query.set('tipo', params.get('tipo'));
    const response = await fetch('/api/oportunidades?' + query);
    if (!response.ok) throw new Error('Não foi possível carregar as oportunidades.');
    const typesResponse = await fetch('/api/oportunidade-tipos').catch(() => null);
    const types = typesResponse?.ok ? await typesResponse.json() : ['Casa','Apartamento','Terreno','Chácara / Sítio','Comercial'];
    render(await response.json(), params, types);
    enhanceIcons();
  }
  function render(items, params, types) {
    app.innerHTML = `<section class="op-intro"><p class="op-eyebrow">Imóveis procurados</p><h1>Oportunidades de compra.</h1><p>Encontre pessoas que já estão procurando um imóvel com características específicas em Tatuí e região. Talvez o seu imóvel seja exatamente o que elas precisam.</p></section><form class="op-toolbar" id="op-filter"><label class="op-field"><span>Buscar</span><input name="q" value="${esc(params.get('q') || '')}" placeholder="Ex.: chácara, Centro, terreno"></label><label class="op-field"><span>Tipo de imóvel</span><select name="tipo"><option value="">Todos os tipos</option>${types.map(type => `<option ${params.get('tipo') === type ? 'selected' : ''}>${esc(type)}</option>`).join('')}</select></label><label class="op-field"><span>Ordenar</span><select name="ordem"><option value="recentes">Mais recentes</option><option value="valor-menor">Menor valor</option><option value="valor-maior">Maior valor</option></select></label><button class="op-button" type="submit">Buscar oportunidades</button></form><div class="op-results-head"><h2>${items.length} ${items.length === 1 ? 'oportunidade encontrada' : 'oportunidades encontradas'}</h2><span>Atualizadas pela equipe Tatuí Imóveis</span></div><section class="op-grid" aria-label="Oportunidades de compra">${items.map(opportunityCard).join('') || '<div class="op-empty">Nenhuma oportunidade corresponde aos filtros. Tente buscar por outra região ou característica.</div>'}</section>`;
    document.querySelector('#op-filter').onsubmit = event => { event.preventDefault(); const data = new FormData(event.currentTarget); const next = new URLSearchParams(); if (data.get('q')) next.set('q', data.get('q')); if (data.get('tipo')) next.set('tipo', data.get('tipo')); location.search = next; };
  }
  function opportunityCard(item) {
    const tipos = Array.isArray(item.tipos_imovel) && item.tipos_imovel.length ? item.tipos_imovel : [item.tipo_imovel];
    const transacoes = Array.isArray(item.transacoes) && item.transacoes.length ? item.transacoes : ['Venda'];
    const location = [item.cidade, item.estado].filter(Boolean).join(' · ');
    const investment = item.valor_minimo == null && item.valor_maximo == null ? 'A combinar' : item.valor_minimo == null ? `Até ${money(item.valor_maximo)}` : item.valor_maximo == null ? `A partir de ${money(item.valor_minimo)}` : `${money(item.valor_minimo)} a ${money(item.valor_maximo)}`;
    const formatArea = value => esc(Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 1 }));
    const area = item.area_total_minima == null && item.area_total_maxima == null ? 'A combinar' : item.area_total_minima == null ? `Até ${formatArea(item.area_total_maxima)} m²` : item.area_total_maxima == null ? `A partir de ${formatArea(item.area_total_minima)} m²` : `${formatArea(item.area_total_minima)} a ${formatArea(item.area_total_maxima)} m²`;
    return `<article class="op-card"><header class="op-card-header"><div class="op-card-badges"><span class="op-card-badge">Oportunidade</span><span class="op-card-transaction">${esc(transacoes.join(' · '))}</span></div><span class="op-card-location" title="${esc(location)}">${icon('location')}${esc(location)}</span></header><div class="op-card-body"><h3>${esc(item.titulo)}</h3><p class="op-card-types">${icon('property')}${esc(tipos.join(' · '))}</p><p class="op-card-description">${esc(item.descricao)}</p>${item.bairros?.length ? `<p class="op-card-neighborhoods">${icon('neighborhood')}${esc(item.bairros.join(' · '))}</p>` : ''}</div><div class="op-card-meta"><div class="op-card-stat"><span class="op-card-stat-icon">${icon('money')}</span><span><small>Investimento</small><strong>${esc(investment)}</strong></span></div><div class="op-card-stat"><span class="op-card-stat-icon">${icon('area')}</span><span><small>Área total</small><strong>${area}</strong></span></div></div><footer class="op-card-footer"><a class="op-card-details" href="/oportunidade.html?id=${item.id}">Ver detalhes <span aria-hidden="true">→</span></a><a class="op-whatsapp" href="${whatsapp(item)}" target="_blank" rel="noopener noreferrer"><span aria-hidden="true">◉</span> WhatsApp</a></footer></article>`;
  }
  load().catch(error => { app.innerHTML = `<main class="op-empty"><strong>${esc(error.message)}</strong></main>`; });
})();
