(() => {
  const app = document.querySelector('#oportunidade-app');
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const money = value => value == null ? 'A combinar' : Number(value).toLocaleString('pt-BR', { style:'currency', currency:'BRL', maximumFractionDigits:0 });

  async function load() {
    const id = new URLSearchParams(location.search).get('id');
    if (!/^\d+$/.test(id || '')) throw new Error('Oportunidade inválida.');
    const response = await fetch('/api/oportunidades/' + id);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Oportunidade não encontrada.');
    render(data);
  }

  function render(item) {
    const contact = window.OpportunityShare?.contactLink(item) || '#';
    const tipos = Array.isArray(item.tipos_imovel) && item.tipos_imovel.length ? item.tipos_imovel : [item.tipo_imovel];
    const areaMinima = item.area_total_minima == null ? 'A combinar' : `${esc(Number(item.area_total_minima).toLocaleString('pt-BR', { maximumFractionDigits: 1 }))} m²`;

    app.innerHTML = `<a class="op-back-link" href="/oportunidades"><span class="material-symbol-icon" aria-hidden="true">arrow_back</span> Voltar para oportunidades</a><article class="op-detail-card"><p class="op-eyebrow">Oportunidade de compra · ${esc(item.cidade)}${item.estado ? ` · ${esc(item.estado)}` : ''}</p><h1>${esc(item.titulo)}</h1><p class="op-detail-description">${esc(item.descricao)}</p><div class="op-detail-grid"><div><strong>Tipos de imóvel</strong><span>${esc(tipos.join(' / '))}</span></div><div><strong>Transação</strong><span>${esc((item.transacoes || []).join(' / '))}</span></div><div><strong>Investimento</strong><span>${money(item.valor_minimo)}${item.valor_maximo ? ` a ${money(item.valor_maximo)}` : ''}</span></div><div><strong>Área total mínima</strong><span>${areaMinima}</span></div></div>${item.bairros?.length ? `<section class="op-detail-section"><h2>Regiões de interesse</h2><p>${esc(item.bairros.join(', '))}</p></section>` : ''}${item.caracteristicas?.length ? `<section class="op-detail-section"><h2>Características desejadas</h2><p>${esc(item.caracteristicas.join(' · '))}</p></section>` : ''}<div class="op-detail-actions"><a class="op-button op-detail-button" href="${contact}" target="_blank" rel="noopener noreferrer">Tenho um imóvel compatível · WhatsApp</a><button class="op-button op-share-button" type="button"><span class="material-symbol-icon" aria-hidden="true">share</span> Compartilhar oportunidade</button><span class="op-share-status" role="status" aria-live="polite"></span></div></article>`;

    const shareButton = app.querySelector('.op-share-button');
    const shareStatus = app.querySelector('.op-share-status');
    shareButton?.addEventListener('click', async () => {
      shareButton.disabled = true;
      const result = await window.OpportunityShare?.share(item) || 'failed';
      shareStatus.textContent = window.OpportunityShare?.messageFor(result) || 'Não foi possível compartilhar agora.';
      shareButton.disabled = false;
    });
  }

  load().catch(error => { app.innerHTML = `<main class="op-empty"><strong>${esc(error.message)}</strong><br><a href="/oportunidades">Voltar para oportunidades</a></main>`; });
})();
