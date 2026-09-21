(() => {
  const app = document.querySelector('#oportunidades-app');
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const money = value => value == null ? 'A combinar' : Number(value).toLocaleString('pt-BR', { style:'currency', currency:'BRL', maximumFractionDigits:0 });
  const whatsapp = item => 'https://wa.me/5515998134885?text=' + encodeURIComponent(`Olá! Tenho interesse na oportunidade "${item.titulo}" no Tatuí Imóveis.`);
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
  }
  function render(items, params, types) {
    app.innerHTML = `<section class="op-intro"><p class="op-eyebrow">Imóveis procurados</p><h1>Oportunidades de compra.</h1><p>Encontre pessoas que já estão procurando um imóvel com características específicas em Tatuí e região. Talvez o seu imóvel seja exatamente o que elas precisam.</p></section><form class="op-toolbar" id="op-filter"><label class="op-field"><span>Buscar</span><input name="q" value="${esc(params.get('q') || '')}" placeholder="Ex.: chácara, Centro, terreno"></label><label class="op-field"><span>Tipo de imóvel</span><select name="tipo"><option value="">Todos os tipos</option>${types.map(type => `<option ${params.get('tipo') === type ? 'selected' : ''}>${esc(type)}</option>`).join('')}</select></label><label class="op-field"><span>Ordenar</span><select name="ordem"><option value="recentes">Mais recentes</option><option value="valor-menor">Menor valor</option><option value="valor-maior">Maior valor</option></select></label><button class="op-button" type="submit">Buscar oportunidades</button></form><div class="op-results-head"><h2>${items.length} ${items.length === 1 ? 'oportunidade encontrada' : 'oportunidades encontradas'}</h2><span>Atualizadas pela equipe Tatuí Imóveis</span></div><section class="op-grid" aria-label="Oportunidades de compra">${items.map(card).join('') || '<div class="op-empty">Nenhuma oportunidade corresponde aos filtros. Tente buscar por outra região ou característica.</div>'}</section>`;
    document.querySelector('#op-filter').onsubmit = event => { event.preventDefault(); const data = new FormData(event.currentTarget); const next = new URLSearchParams(); if (data.get('q')) next.set('q', data.get('q')); if (data.get('tipo')) next.set('tipo', data.get('tipo')); location.search = next; };
  }
  function card(item) { const tipos = Array.isArray(item.tipos_imovel) && item.tipos_imovel.length ? item.tipos_imovel : [item.tipo_imovel]; return `<article class="op-card"><span class="op-card-kicker">${esc(tipos.join(' · '))} · ${esc(item.cidade)}</span><h3>${esc(item.titulo)}</h3><p>${esc(item.descricao)}</p><div class="op-card-meta"><span><strong>${money(item.valor_minimo)}${item.valor_maximo ? ` a ${money(item.valor_maximo)}` : ''}</strong>Faixa de investimento</span><span><strong>${item.area_total_minima ? `${esc(item.area_total_minima)} m²` : 'A combinar'}</strong>Área mínima</span></div><div class="op-card-footer"><a href="/oportunidade.html?id=${item.id}">Ver detalhes →</a><a class="op-whatsapp" href="${whatsapp(item)}" target="_blank" rel="noopener noreferrer">WhatsApp</a></div></article>`; }
  load().catch(error => { app.innerHTML = `<main class="op-empty"><strong>${esc(error.message)}</strong></main>`; });
})();
