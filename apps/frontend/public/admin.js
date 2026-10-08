(() => {
  const materialIconsScript = document.createElement('script');
  materialIconsScript.src = '/material-icons.js';
  materialIconsScript.onload = () => { enhanceAdminIcons(); window.MaterialIcons?.enhance(document); };
  document.head.appendChild(materialIconsScript);
  const app = document.querySelector('#admin-app');
  const adminIconByText = [
    [/analisar imóveis compatíveis/i, 'search'], [/visão geral|dashboard/i, 'analytics'], [/editar/i, 'edit'], [/imóveis|imóvel/i, 'home_work'], [/usuários|usuário/i, 'group'],
    [/auditoria|histórico/i, 'history'], [/termos do proprietário|termos do corretor parceiro/i, 'description'], [/termos de uso/i, 'description'], [/conteúdo|política/i, 'description'], [/e-mail|email/i, 'mail'],
    [/oportunidade/i, 'auto_awesome'], [/configurações|configuração/i, 'settings'], [/sair|logout/i, 'logout'],
    [/excluir|remover/i, 'delete'], [/incluir|novo|adicionar/i, 'add'],
    [/salvar|publicar/i, 'save'], [/voltar/i, 'arrow_back'], [/detalhes|abrir/i, 'open_in_new'],
    [/teste|enviar/i, 'mail'], [/fechar|cancelar/i, 'close']
  ];
  function materialIcon(name, className) {
    const icon = document.createElement('span');
    icon.className = `material-symbol-icon ${className}`;
    icon.textContent = name;
    icon.setAttribute('aria-hidden', 'true');
    return icon;
  }
  function enhanceAdminIcons() {
    app.querySelectorAll('.admin-opportunity-location').forEach(element => {
      if (element.querySelector('[data-phosphor], .material-symbol-icon')) return;
      const icon = materialIcon('location_on', 'admin-opportunity-inline-icon');
      element.prepend(icon);
    });
    // Only process each fact row, not icon spans nested inside it. The observer
    // below watches the same subtree, so matching descendants would recursively
    // wrap newly inserted icons and freeze the admin page.
    app.querySelectorAll('.admin-opportunity-facts > span').forEach((element, index) => {
      const fact = element.querySelector('strong');
      const label = element.textContent.replace(fact?.textContent || '', '').toLowerCase();
      if (label.includes('área') && fact && !fact.dataset.areaLocalized) {
        fact.textContent = fact.textContent.replace(/\d+(?:[.,]\d+)?/g, value => Number(value.replace(',', '.')).toLocaleString('pt-BR', { maximumFractionDigits: 1 }));
        fact.dataset.areaLocalized = 'true';
      }
      if (element.querySelector('[data-phosphor], .material-symbol-icon')) return;
      if (fact && !element.querySelector('.admin-opportunity-fact-content')) {
        const content = document.createElement('span');
        content.className = 'admin-opportunity-fact-content';
        const caption = document.createElement('small');
        caption.textContent = label.trim();
        content.append(caption, fact);
        [...element.childNodes].forEach(node => {
          if (node !== content && node !== fact && node.nodeType === Node.TEXT_NODE) node.remove();
        });
        element.append(content);
      }
      const symbol = label.includes('tipo') ? 'home' : label.includes('área') ? 'straighten' : /investimento|valor/.test(label) ? 'attach_money' : ['home', 'straighten', 'attach_money'][index % 3];
      const icon = materialIcon(symbol, 'admin-opportunity-inline-icon');
      element.prepend(icon);
    });
    app.querySelectorAll('button, a, .admin-property-placeholder, .admin-property-address, .admin-opportunity-location, .admin-opportunity-facts > span').forEach(element => {
      if (element.querySelector('[data-phosphor], .material-symbol-icon') || element.classList.contains('admin-icon-enhanced') || element.classList.contains('admin-icon-checked')) return;
      if (element.classList.contains('admin-user')) {
        element.classList.add('admin-icon-checked');
        return;
      }
      if (element.classList.contains('admin-property-placeholder')) element.textContent = '';
      if (element.classList.contains('admin-modal-close')) element.textContent = '';
      if (element.classList.contains('admin-property-placeholder') || element.classList.contains('admin-modal-close')) {
        const icon = materialIcon(element.classList.contains('admin-modal-close') ? 'close' : 'home', 'admin-context-icon');
        element.append(icon);
        element.classList.add('admin-icon-enhanced');
        return;
      }
      if (element.classList.contains('admin-secondary-action') && element.innerHTML.includes('→')) element.innerHTML = element.innerHTML.replace('→', '');
      const text = element.textContent.trim();
      const match = adminIconByText.find(([pattern]) => pattern.test(text));
      if (!match) { element.classList.add('admin-icon-checked'); return; }
      const icon = materialIcon(match[1], 'admin-context-icon');
      element.prepend(icon);
      element.classList.add('admin-icon-enhanced');
    });
    window.MaterialIcons?.enhance(app);
  }
  const state = { tab: 'dashboard', dashboard: null, properties: [], opportunities: [], opportunityTypes: [], editingOpportunity: null, users: [], audit: [], policy: null, terms: null, smtp: null, emailProvider: null };
  let activityChart = null;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const tipoCadastro = value => ({'Proprietário Direto':'Proprietário','Proprietario Direto':'Proprietário','Corretor':'Corretor','Imobiliária':'Imobiliária','Imobiliaria':'Imobiliária'}[String(value ?? '').trim()] || 'Não informado');
  async function api(path, options) { const response = await fetch(path, options); const data = await response.json().catch(() => ({})); if (response.status === 401) throw new Error('LOGIN_REQUIRED'); if (!response.ok) throw new Error(data.error || 'Não foi possível concluir a operação.'); return data; }
  function login() { app.innerHTML = '<main class="admin-login"><img src="assets/tatui-imoveis-logo.svg" alt="Tatuí Imóveis"><h1>Área administrativa</h1><p>Entre com suas credenciais administrativas.</p><form id="admin-login-form"><label>Usuário<input name="email" type="email" autocomplete="username" required></label><label>Senha<div class="password-field"><input name="senha" type="password" autocomplete="current-password" required><button type="button" class="password-toggle" aria-label="Mostrar senha" aria-pressed="false" title="Senha oculta — clique para mostrar"><svg class="password-eye password-eye-open" viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.3-5 9.5-5 9.5 5 9.5 5-3.3 5-9.5 5-9.5-5-9.5-5Z"></path><circle cx="12" cy="12" r="2.5"></circle></svg><svg class="password-eye password-eye-closed" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18"></path><path d="M10.6 6.9A10.8 10.8 0 0 1 12 6.8c6.2 0 9.5 5.2 9.5 5.2a17.8 17.8 0 0 1-3.1 3.3"></path><path d="M6.6 8.2C4.2 9.4 2.5 12 2.5 12s3.3 5.2 9.5 5.2c1.3 0 2.5-.3 3.5-.7"></path></svg></button></div></label><p id="admin-login-error"></p><button class="admin-primary">Entrar</button></form></main>'; const password = document.querySelector('.admin-login input[name="senha"]'); const toggle = document.querySelector('.admin-login .password-toggle'); toggle.onclick = () => { const visible = password.type === 'text'; password.type = visible ? 'password' : 'text'; toggle.classList.toggle('is-visible', !visible); toggle.setAttribute('aria-label', visible ? 'Mostrar senha' : 'Ocultar senha'); toggle.setAttribute('aria-pressed', String(!visible)); toggle.title = visible ? 'Senha oculta — clique para mostrar' : 'Senha visível — clique para ocultar'; }; document.querySelector('#admin-login-form').onsubmit = async event => { event.preventDefault(); try { await api('/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(event.currentTarget)))}); await load(); } catch(error) { document.querySelector('#admin-login-error').textContent = error.message === 'LOGIN_REQUIRED' ? 'Usuário ou senha inválidos.' : error.message; } }; }
  function shell(content) {
    if (activityChart) { activityChart.destroy(); activityChart = null; }
    app.innerHTML = `<header class="admin-header"><a href="/"><img src="assets/tatui-imoveis-logo.svg" alt="Tatuí Imóveis"></a><div><strong>Área administrativa</strong><button id="logout">Sair</button></div></header><main class="admin-shell"><aside><button data-tab="dashboard">Visão geral</button><button data-tab="properties">Imóveis</button><button data-tab="opportunities">Oportunidades</button><button data-tab="users">Usuários</button><button data-tab="policy">Conteúdos e política</button><button data-tab="terms">Termos de uso</button><button data-tab="email">E-mail</button><button data-tab="audit">Auditoria</button></aside><section class="admin-content">${content}</section></main>`;
    enhanceAdminIcons(); window.MaterialIcons?.enhance(app);
    document.querySelectorAll('[data-tab]').forEach(button => button.onclick = () => { state.tab = button.dataset.tab; render(); });
    document.querySelector('#logout').onclick = async () => { await fetch('/api/logout',{method:'POST'}); location.replace('/'); };
    if (state.tab === 'dashboard') drawActivityChart();
  }
  async function load() { try { const [dashboard, properties, opportunities, configuredTypes, users, audit, policy, terms, smtp] = await Promise.all([api('/api/admin/dashboard'), api('/api/admin/imoveis'), api('/api/admin/oportunidades'), api('/api/admin/oportunidades/tipos'), api('/api/admin/usuarios'), api('/api/admin/auditoria'), api('/api/admin/conteudos/politica_privacidade'), api('/api/admin/conteudos/termos_uso'), api('/api/admin/configuracoes/email')]); state.dashboard = dashboard; state.properties = properties; state.opportunities = opportunities; state.opportunityTypes = configuredTypes.map(item => item.nome); if (!state.opportunityTypes.length) state.opportunityTypes = ['Casa', 'Apartamento', 'Terreno', 'Chácara / Sítio', 'Comercial']; state.users = users; state.audit = audit; state.policy = policy; state.terms = terms; state.smtp = smtp; render(); } catch (error) { if (error.message === 'LOGIN_REQUIRED') return login(); app.innerHTML = '<main class="admin-error"><h1>Acesso administrativo</h1><p>' + esc(error.message) + '</p></main>'; } }
  function drawActivityChart() {
    const canvas = document.querySelector('#admin-activity-chart');
    if (!canvas || !window.Chart || !state.dashboard) return;
    const days = state.dashboard.serieDiaria || [];
    const labels = days.map(day => Number(day.dia.slice(-2)));
    const chartContext = canvas.getContext('2d');
    const area = chartContext.createLinearGradient(0, 0, 0, 340);
    area.addColorStop(0, 'rgba(8, 124, 118, .20)');
    area.addColorStop(1, 'rgba(8, 124, 118, .015)');
    activityChart = new window.Chart(chartContext, {
      type: 'line',
      data: { labels, datasets: [
        { label: 'Acessos', data: days.map(day => Number(day.acessos || 0)), yAxisID: 'yViews', borderColor: '#087c76', backgroundColor: area, fill: true, tension: .36, borderWidth: 3, pointRadius: 0, pointHoverRadius: 5, pointHoverBorderWidth: 3, pointHoverBorderColor: '#fff' },
        { label: 'Interesses', data: days.map(day => Number(day.interesses || 0)), yAxisID: 'yInterests', borderColor: '#e95f1a', backgroundColor: '#e95f1a', fill: false, tension: .3, borderWidth: 2.5, pointRadius: 2.5, pointHoverRadius: 5, pointHoverBorderWidth: 3, pointHoverBorderColor: '#fff' }
      ] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 450, easing: 'easeOutQuart' },
        interaction: { mode: 'index', intersect: false },
        layout: { padding: { top: 8, right: 6 } },
        plugins: {
          legend: { position: 'top', align: 'end', labels: { usePointStyle: true, pointStyle: 'circle', boxWidth: 8, boxHeight: 8, padding: 20, color: '#315653', font: { family: 'Arial, sans-serif', size: 12, weight: '600' } } },
          tooltip: { backgroundColor: '#173b3b', titleColor: '#fff', bodyColor: '#eaf3f0', borderColor: 'rgba(255,255,255,.14)', borderWidth: 1, padding: 12, usePointStyle: true, displayColors: true, callbacks: { title: items => `Dia ${items[0]?.label} · ${state.dashboard.periodo}`, label: item => ` ${item.dataset.label}: ${Number(item.parsed.y).toLocaleString('pt-BR')}` } }
        },
        scales: {
          x: { grid: { display: false }, border: { display: false }, ticks: { autoSkip: true, maxTicksLimit: 8, maxRotation: 0, color: '#73817e', font: { family: 'Arial, sans-serif', size: 11 }, padding: 10 } },
          yViews: { type: 'linear', position: 'left', beginAtZero: true, title: { display: true, text: 'Acessos', color: '#607674', font: { family: 'Arial, sans-serif', size: 11, weight: '600' } }, grid: { color: 'rgba(23,59,59,.08)', drawTicks: false }, border: { display: false }, ticks: { precision: 0, color: '#73817e', font: { family: 'Arial, sans-serif', size: 11 }, padding: 10 } },
          yInterests: { type: 'linear', position: 'right', beginAtZero: true, title: { display: true, text: 'Interesses', color: '#607674', font: { family: 'Arial, sans-serif', size: 11, weight: '600' } }, grid: { drawOnChartArea: false, drawTicks: false }, border: { display: false }, ticks: { precision: 0, color: '#73817e', font: { family: 'Arial, sans-serif', size: 11 }, padding: 10 } }
        }
      }
    });
  }
  function dashboard() {
    const { metricas: m, periodo } = state.dashboard;
    const propertyLink = item => `<a class="admin-dashboard-property-link" href="/imovel?id=${encodeURIComponent(item.id)}" aria-label="Ver detalhes do imóvel ${esc(item.id)}">#${esc(item.id)}</a>`;
    const chartTitle = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${periodo}-01T00:00:00Z`));
    const chart = `<section class="admin-panel admin-dashboard-chart"><div class="admin-dashboard-chart-heading"><div><span class="admin-eyebrow">Desempenho</span><h2>Atividade diária</h2><p>Acessos aos anúncios e solicitações de interesse em ${esc(chartTitle)}.</p></div></div><div class="admin-dashboard-chart-canvas"><canvas id="admin-activity-chart" role="img" aria-label="Gráfico de linhas com os acessos e interesses diários no período selecionado" aria-describedby="admin-activity-chart-description"><p>Gráfico de atividade diária; os dados estão resumidos nos indicadores acima.</p></canvas></div><p class="admin-dashboard-chart-description" id="admin-activity-chart-description">O eixo esquerdo mostra acessos aos anúncios; o eixo direito mostra solicitações de interesse.</p></section>`;
    return `<div class="admin-dashboard-heading"><div><h1>Visão geral</h1><p>Acompanhe o desempenho da imobiliária.</p></div><label class="admin-dashboard-period">Mês de referência<input id="dashboard-month" type="month" value="${esc(periodo)}" max="${esc(state.dashboard.mesAtual || periodo)}" aria-label="Selecionar mês de referência"><small id="dashboard-period-status" aria-live="polite"></small></label></div><div class="admin-metrics"><article><strong>${m.usuarios}</strong><span>Usuários</span></article><article><strong>${m.imoveis}</strong><span>Imóveis</span></article><article><strong>${m.acessosMes}</strong><span>Acessos no mês</span></article><article><strong>${m.contatosMes}</strong><span>Interesses no mês</span></article></div>${chart}<div class="admin-columns"><section class="admin-panel"><h2>Últimos imóveis cadastrados</h2><table><thead><tr><th>ID</th><th>Imóvel</th><th>Tipo</th></tr></thead><tbody>${state.dashboard.ultimos.map(item => `<tr><td>${propertyLink(item)}</td><td><strong>${esc(item.categoria)}</strong><small>${esc(item.anunciante || 'Sem anunciante')}</small></td><td>${esc(item.tipo)}</td></tr>`).join('') || '<tr><td colspan="3">Nenhum imóvel cadastrado.</td></tr>'}</tbody></table></section><section class="admin-panel"><h2>Mais acessados em ${esc(chartTitle)}</h2><table><thead><tr><th>ID</th><th>Imóvel</th><th>Acessos</th></tr></thead><tbody>${state.dashboard.populares.map(item => `<tr><td>${propertyLink(item)}</td><td>${esc(item.categoria)} · ${esc(item.tipo)}</td><td>${Number(item.acessos || 0).toLocaleString('pt-BR')}</td></tr>`).join('') || '<tr><td colspan="3">Nenhum acesso registrado.</td></tr>'}</tbody></table></section></div>`;
  }
  function properties() {
    const characteristics = window.PropertyCharacteristics;
    const offers = window.PropertyOffers;
    const count = value => Number(value || 0).toLocaleString('pt-BR');
    return `<div class="admin-title-row"><div><p class="admin-eyebrow">Catálogo</p><h1>Imóveis</h1><p>Gerencie os anúncios publicados, revise os dados e acompanhe o desempenho de cada imóvel.</p></div><a class="admin-primary" href="/cadastro?modo=imovel">+ Incluir imóvel</a></div><div class="admin-property-list">${state.properties.map(item => {
      const photo = item.fotos?.[0]?.url;
      const title = offers?.displayTitle(item) || item.categoria || item.tipo || 'Imóvel';
      const price = offers?.describe(item) || '';
      const features = characteristics?.summary(characteristics.list(item.caracteristicas)) || [];
      const metrics = item.metricas || {};
      const editUrl = `/cadastro?modo=editar&id=${encodeURIComponent(item.id)}&admin=1`;
      const status = item.status || 'disponivel';
      const statusLabels = { em_negociacao: 'Em negociação', vendido: 'Vendido', reservado: 'Reservado', alugado: 'Alugado', disponivel: 'Disponível' };
      const statusOptions = Object.entries(statusLabels).map(([value, label]) => `<option value="${value}" ${status === value ? 'selected' : ''}>${label}</option>`).join('');
      return `<article class="admin-property-card"><a class="admin-property-media" href="${editUrl}" aria-label="Editar ${esc(title)}">${photo ? `<img src="${esc(photo)}" alt="Foto de ${esc(item.categoria || 'imóvel')}">` : '<span class="admin-property-placeholder" aria-hidden="true">⌂</span>'}<span class="property-status-watermark property-status-${esc(status)}">${esc(statusLabels[status] || statusLabels.disponivel)}</span></a><div class="admin-property-main"><div class="admin-property-heading"><div><h2>${esc(title)}</h2>${price ? `<strong class="admin-property-price">${esc(price)}</strong>` : ''}</div><span class="admin-property-id">#${esc(item.id)}</span></div><p class="admin-property-address">${esc(item.endereco || 'Endereço não informado')}</p>${features.length ? `<div class="admin-property-feature-list" aria-label="Resumo das características">${features.map(feature => `<span class="admin-property-feature"><span class="material-symbol-icon" aria-hidden="true">${esc(characteristics.icon(feature.key))}</span><span>${esc(feature.display)}</span></span>`).join('')}</div>` : ''}<div class="admin-property-meta"><span>Anunciante</span><strong>${esc(item.anunciante || 'Sem anunciante')}</strong></div><div class="admin-property-status-control"><label for="property-status-${esc(item.id)}">Status do anúncio</label><select id="property-status-${esc(item.id)}" data-property-status="${esc(item.id)}" aria-label="Status do imóvel ${esc(item.id)}">${statusOptions}</select><span data-property-status-message="${esc(item.id)}" role="status" aria-live="polite"></span></div><div class="owner-property-stats admin-property-stats" aria-label="Estatísticas acumuladas do anúncio"><div class="owner-property-stat" title="Aberturas da página de detalhes do anúncio"><span class="material-symbol-icon" aria-hidden="true">visibility</span><strong>${count(metrics.visualizacoes ?? item.acessos)}</strong><span>Visualizações</span></div><div class="owner-property-stat" title="Compartilhamentos concluídos ou link copiado"><span class="material-symbol-icon" aria-hidden="true">share</span><strong>${count(metrics.compartilhamentos)}</strong><span>Compartilhamentos</span></div><div class="owner-property-stat" title="Solicitações enviadas pelo formulário Tenho interesse"><span class="material-symbol-icon" aria-hidden="true">chat_bubble</span><strong>${count(metrics.interesses)}</strong><span>Interesses</span></div></div><div class="admin-property-actions"><a class="admin-secondary-action" href="${editUrl}">Editar imóvel <span aria-hidden="true">→</span></a><button class="admin-danger-action" type="button" data-delete="${esc(item.id)}">Excluir</button></div></div></article>`;
    }).join('') || '<div class="admin-property-empty"><strong>Nenhum imóvel cadastrado.</strong><span>Inclua o primeiro anúncio para começar a gerenciar o catálogo.</span></div>'}</div>`;
  }
  function legacyOpportunities() { return `<div class="admin-title-row"><div><p class="admin-eyebrow">Demanda do mercado</p><h1>Oportunidades de compra</h1><p>Cadastre buscas reais de clientes e publique oportunidades para que proprietários encontrem uma demanda compatível.</p></div></div><section class="admin-panel admin-opportunity-form"><h2>Nova oportunidade</h2><div class="admin-form-grid"><label>Título<input id="op-title" maxlength="180" placeholder="Ex.: Família procura casa no Centro"></label><label>Tipo<select id="op-type"><option>Casa</option><option>Apartamento</option><option>Terreno</option><option>Chácara / Sítio</option><option>Comercial</option></select></label><label>Cidade<input id="op-city" value="Tatuí" maxlength="120"></label><label>Valor mínimo<input id="op-min" type="number" min="0" step="0.01"></label><label>Valor máximo<input id="op-max" type="number" min="0" step="0.01"></label><label class="admin-field-wide">Descrição<textarea id="op-description" rows="4" maxlength="5000" placeholder="Descreva o que o cliente procura."></textarea></label></div><fieldset class="admin-opportunity-transactions"><legend>Transação aceita</legend><label><input type="checkbox" name="op-transaction" value="Venda" checked> Compra</label><label><input type="checkbox" name="op-transaction" value="Aluguel"> Aluguel</label><label><input type="checkbox" name="op-transaction" value="Permuta"> Permuta</label></fieldset><div class="admin-opportunity-actions"><button class="admin-primary" id="create-opportunity">Salvar como rascunho</button><span id="opportunity-status" role="status"></span></div></section><section class="admin-panel"><div class="admin-panel-heading"><div><h2>Oportunidades cadastradas</h2><p>Somente as publicadas aparecem na área pública.</p></div></div><div class="admin-opportunity-list">${state.opportunities.map(item => { const tipos = Array.isArray(item.tipos_imovel) && item.tipos_imovel.length ? item.tipos_imovel : [item.tipo_imovel]; return `<article class="admin-opportunity-row"><div><span class="admin-property-kicker">${esc(item.status)} · ${esc(tipos.join(' · '))}</span><h3>${esc(item.titulo)}</h3><p>${esc(item.estado || 'SP')} · ${esc(item.cidade)}${item.bairros?.length ? ` · ${esc(item.bairros.join(', '))}` : ''} · ${esc(item.descricao)}</p></div><div class="admin-opportunity-row-actions"><select data-op-status="${item.id}" aria-label="Status de ${esc(item.titulo)}">${['rascunho','publicada','atendida','expirada','cancelada'].map(status => `<option value="${status}" ${item.status === status ? 'selected' : ''}>${status}</option>`).join('')}</select><button class="admin-danger-action" type="button" data-op-delete="${item.id}">Excluir</button></div></article>`; }).join('') || '<p>Nenhuma oportunidade cadastrada.</p>'}</div></section>`; }
  function opportunities() {
    const types = state.opportunityTypes.length ? state.opportunityTypes : ['Casa', 'Apartamento', 'Terreno', 'Chácara / Sítio', 'Comercial'];
    const statuses = { rascunho: 'Rascunho', publicada: 'Publicada', atendida: 'Atendida', expirada: 'Expirada', cancelada: 'Cancelada' };
    const money = value => value == null ? 'A combinar' : Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
    const range = (min, max, suffix = '') => min == null && max == null ? 'A combinar' : `${min == null ? 'Até ' + max : max == null ? 'A partir de ' + min : `${min} a ${max}`}${suffix}`;
    return `<div class="admin-title-row admin-opportunity-page-heading"><div><p class="admin-eyebrow">Demanda do mercado</p><h1>Oportunidades de compra</h1><p>Organize as buscas dos clientes e publique oportunidades para conectar proprietários às demandas certas.</p></div><span class="admin-page-badge"><strong>${state.opportunities.length}</strong> ${state.opportunities.length === 1 ? 'oportunidade' : 'oportunidades'}</span></div><section class="admin-panel admin-opportunity-form"><div class="admin-opportunity-form-heading"><div><p class="admin-eyebrow">Novo cadastro</p><h2>Registrar uma oportunidade</h2><p>Preencha apenas o que já estiver definido pelo cliente. Os campos opcionais podem ser completados depois.</p></div><span class="admin-draft-badge">Salva como rascunho</span></div><div class="admin-opportunity-section"><div class="admin-opportunity-section-heading"><span>1</span><div><h3>Dados principais</h3><p>Defina o que o cliente procura e como deseja negociar.</p></div></div><div class="admin-form-grid admin-opportunity-grid"><label class="admin-field-wide">Título da oportunidade<input id="op-title" maxlength="180" placeholder="Ex.: Família procura casa no Centro"></label><label>Tipo<select id="op-type">${types.map(type => `<option>${esc(type)}</option>`).join('')}</select></label><label>Cidade<input id="op-city" value="Tatuí" maxlength="120"></label><label>Valor mínimo<input id="op-min" type="number" min="0" step="0.01" placeholder="Ex.: 250000"></label><label>Valor máximo<input id="op-max" type="number" min="0" step="0.01" placeholder="Ex.: 450000"></label><label class="admin-field-wide">Descrição<textarea id="op-description" rows="4" maxlength="5000" placeholder="Descreva o perfil do imóvel e as necessidades do cliente."></textarea></label></div><fieldset class="admin-opportunity-transactions"><legend>Transação aceita</legend><label><input type="checkbox" name="op-transaction" value="Venda" checked> Compra</label><label><input type="checkbox" name="op-transaction" value="Aluguel"> Aluguel</label><label><input type="checkbox" name="op-transaction" value="Permuta"> Permuta</label></fieldset></div><div class="admin-opportunity-actions"><div><button class="admin-primary" id="create-opportunity">Salvar como rascunho</button><span id="opportunity-status" role="status"></span></div><small>Você poderá publicar ou alterar o status na lista abaixo.</small></div></section><section class="admin-panel admin-opportunity-catalog"><div class="admin-panel-heading"><div><p class="admin-eyebrow">Acompanhamento</p><h2>Oportunidades cadastradas</h2><p>Revise o status e mantenha as demandas atualizadas para o público.</p></div><span class="admin-panel-count">${state.opportunities.length}</span></div><div class="admin-opportunity-list">${state.opportunities.map(item => { const tipos = Array.isArray(item.tipos_imovel) && item.tipos_imovel.length ? item.tipos_imovel : [item.tipo_imovel]; const status = statuses[item.status] || item.status; const location = [item.estado || 'SP', item.cidade, item.bairros?.length ? item.bairros.join(', ') : ''].filter(Boolean).join(' · '); const investment = range(item.valor_minimo == null ? null : money(item.valor_minimo), item.valor_maximo == null ? null : money(item.valor_maximo)); const area = range(item.area_total_minima, item.area_total_maxima, ' m²'); return `<article class="admin-opportunity-row"><div class="admin-opportunity-row-main"><div class="admin-opportunity-row-top"><span class="admin-opportunity-status admin-opportunity-status-${esc(item.status)}">${esc(status)}</span><span class="admin-opportunity-id">#${esc(item.id)}</span></div><h3>${esc(item.titulo)}</h3><p class="admin-opportunity-location">${esc(location)}</p><div class="admin-opportunity-facts"><span><strong>${esc(tipos.join(' · '))}</strong>Tipo${tipos.length > 1 ? 's' : ''}</span><span><strong>${esc(area)}</strong>Área</span><span><strong>${esc(investment)}</strong>Investimento</span></div><p class="admin-opportunity-description">${esc(item.descricao)}</p><button class="admin-secondary-action admin-opportunity-match-button" type="button" data-op-match="${item.id}" aria-expanded="false" aria-controls="admin-opportunity-matches-${item.id}">Analisar imóveis compatíveis</button></div><div class="admin-opportunity-row-actions"><label>Status<select data-op-status="${item.id}" aria-label="Status de ${esc(item.titulo)}">${Object.entries(statuses).map(([value, label]) => `<option value="${value}" ${item.status === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label><button class="admin-danger-action" type="button" data-op-delete="${item.id}">Excluir</button></div><div class="admin-opportunity-matches" id="admin-opportunity-matches-${item.id}" aria-live="polite" hidden></div></article>`; }).join('') || '<div class="admin-opportunity-empty"><strong>Nenhuma oportunidade cadastrada.</strong><span>Cadastre a primeira demanda usando o formulário acima.</span></div>'}</div></section>`;
  }
  function opportunityMatchesMarkup(data) {
    const rejected = data.rejected || {};
    const noMatches = !data.matches?.length;
    const rejectedSummary = [
      rejected.location && `${rejected.location} por localização`,
      rejected.type && `${rejected.type} por tipo`,
      rejected.transaction && `${rejected.transaction} por transação`
    ].filter(Boolean).join(' · ');
    const summary = noMatches
      ? `Nenhum anúncio passou pelos critérios essenciais (tipo, cidade/estado e transação).${rejectedSummary ? ` ${rejectedSummary}.` : ''}`
      : `${data.eligibleCount} ${data.eligibleCount === 1 ? 'imóvel atende' : 'imóveis atendem'} aos critérios essenciais. Exibindo até ${data.matches.length} melhores correspondências.`;
    const cards = (data.matches || []).map(match => {
      const item = state.properties.find(property => Number(property.id) === Number(match.id));
      if (!item) return '';
      const title = window.PropertyOffers?.displayTitle(item) || item.categoria || item.tipo || 'Imóvel';
      const description = window.PropertyOffers?.describe(item) || '';
      const editUrl = `/cadastro?modo=editar&id=${encodeURIComponent(item.id)}&admin=1`;
      const reasons = match.reasons.slice(3).map(reason => `<span class="admin-opportunity-match-reason ${reason.atende ? 'is-met' : 'is-missed'}"><span class="material-symbol-icon" aria-hidden="true">${reason.atende ? 'check_circle' : 'info'}</span><span><strong>${esc(reason.criterio)}:</strong> ${esc(reason.detalhe)}</span></span>`).join('');
      return `<article class="admin-opportunity-match-card"><a class="admin-opportunity-match-photo" href="/imovel?id=${encodeURIComponent(item.id)}" aria-label="Ver ${esc(title)}">${item.fotos?.[0]?.url ? `<img src="${esc(item.fotos[0].url)}" alt="">` : '<span class="material-symbol-icon" aria-hidden="true">home</span>'}</a><div class="admin-opportunity-match-body"><div class="admin-opportunity-match-heading"><h4><a href="/imovel?id=${encodeURIComponent(item.id)}">${esc(title)}</a></h4><span class="admin-opportunity-match-score">${match.score == null ? 'Critérios essenciais' : `${match.score}% compatível`}</span></div><p>${esc(item.endereco || [item.bairro, item.cidade, item.estado].filter(Boolean).join(' · ') || 'Endereço não informado')}</p>${description ? `<strong class="admin-opportunity-match-price">${esc(description)}</strong>` : ''}${reasons ? `<div class="admin-opportunity-match-reasons">${reasons}</div>` : '<small class="admin-opportunity-match-note">A oportunidade não tem critérios opcionais preenchidos para pontuar.</small>'}</div><a class="admin-opportunity-match-edit" href="${editUrl}">Editar</a></article>`;
    }).join('');
    return `<p class="admin-opportunity-match-summary">${esc(summary)}</p>${cards ? `<div class="admin-opportunity-match-list">${cards}</div>` : '<p class="admin-opportunity-match-empty">Revise tipo, cidade, transação, preço ou área da oportunidade para ampliar ou ajustar a busca.</p>'}<small class="admin-opportunity-match-disclaimer">Pontuação calculada por regras explícitas; os critérios essenciais precisam coincidir. Não é uma garantia de adequação.</small>`;
  }
  function users() { return `<h1>Usuários</h1><p>Selecione um usuário para consultar anúncios e imóveis acessados.</p><div class="admin-panel"><table class="admin-users-table"><thead><tr><th>Usuário</th><th>Perfil</th><th>Imóveis</th><th>Acessos</th></tr></thead><tbody>${state.users.map(item => `<tr><td><button class="admin-user" data-user="${item.id}"><strong>${esc(item.nome)}</strong><small>${esc(item.email)}</small></button></td><td>${esc(tipoCadastro(item.tipo_usuario))}</td><td>${item.imoveis}</td><td>${item.acessos}</td></tr>`).join('')}</tbody></table></div><div id="user-detail"></div>`; }
  function policy() { const content = state.policy?.conteudo || 'Nenhum conteúdo publicado.'; const version = state.policy?.versao || 1; const updated = state.policy?.updated_at ? new Date(state.policy.updated_at).toLocaleString('pt-BR') : 'Não informado'; return `<h1>Política de Privacidade</h1><p>Consulte e edite a versão vigente diretamente nesta área administrativa.</p><div class="admin-policy-grid"><section class="admin-panel"><div class="admin-panel-heading"><div><h2>Versão vigente</h2><p>Versão ${esc(version)} · Atualizada em ${esc(updated)}</p></div><span class="admin-status-badge">Publicada</span></div><div class="admin-policy-preview" aria-label="Prévia da política de privacidade">${esc(content)}</div></section><section class="admin-panel"><h2>Editar política</h2><p>Ao salvar, uma nova versão será publicada.</p><label>Texto da política<textarea id="policy-text" rows="18">${esc(content)}</textarea></label><button class="admin-primary" id="save-policy">Salvar nova versão</button><span id="policy-status"></span></section></div>`; }
  function terms() { const content = state.terms?.conteudo || 'Os Termos de Uso estão em elaboração. A versão oficial será publicada após revisão e aprovação da responsável pelo site.'; const version = state.terms?.versao || 1; const updated = state.terms?.updated_at ? new Date(state.terms.updated_at).toLocaleString('pt-BR') : 'Ainda não editado'; return `<h1>Termos de Uso</h1><p>Gerencie o texto que ficará disponível publicamente na página de Termos de Uso.</p><div class="admin-policy-grid"><section class="admin-panel"><div class="admin-panel-heading"><div><h2>Versão pública atual</h2><p>Versão ${esc(version)} · Atualizada em ${esc(updated)}</p></div><span class="admin-status-badge">${state.terms?.versao > 1 ? 'Publicada' : 'Em elaboração'}</span></div><div class="admin-policy-preview" aria-label="Prévia dos Termos de Uso">${esc(content)}</div></section><section class="admin-panel"><h2>Editar Termos de Uso</h2><p>O conteúdo salvo fica disponível imediatamente na página pública. Enquanto o texto jurídico não estiver aprovado, mantenha o aviso de elaboração.</p><label>Texto dos termos<textarea id="terms-text" rows="18">${esc(content)}</textarea></label><button class="admin-primary" id="save-terms">Salvar nova versão</button><span id="terms-status" role="status" aria-live="polite"></span></section></div>`; }
  function email() { const smtp = state.smtp || {}; const isSendGrid = (state.emailProvider || document.querySelector('#email-provider')?.value || smtp.provedor || 'sendgrid') === 'sendgrid'; const secretLabel = isSendGrid ? 'Chave da API do SendGrid' : 'Senha do SMTP'; const secretPlaceholder = smtp.configurado ? 'Deixe em branco para manter a atual' : isSendGrid ? 'SG.xxxxxxxxxxxxxxxxx' : 'Informe a senha'; return `<h1>Configuração de e-mail</h1><p>Escolha o serviço usado para enviar links de recuperação e mensagens do sistema. As credenciais ficam disponíveis somente nesta área administrativa e são armazenadas criptografadas.</p><section class="admin-panel"><div class="admin-panel-heading"><div><h2>Serviço de envio</h2><p>O remetente precisa estar autorizado no serviço escolhido.</p></div><span class="admin-status-badge">${smtp.configurado ? 'Configurado' : 'Pendente'}</span></div><div class="admin-form-grid"><label>Provedor<select id="email-provider"><option value="sendgrid" ${isSendGrid ? 'selected' : ''}>SendGrid Web API</option><option value="smtp" ${!isSendGrid ? 'selected' : ''}>Servidor SMTP</option></select></label><label>Remetente<input id="smtp-from" type="email" value="${esc(smtp.remetente)}" placeholder="noreply@tatuiimoveis.com.br" autocomplete="email"></label>${isSendGrid ? `<label class="admin-field-wide">${secretLabel}<div class="password-field"><input id="smtp-pass" type="password" autocomplete="new-password" placeholder="${secretPlaceholder}"><button type="button" class="password-toggle" aria-label="Mostrar senha" aria-pressed="false" title="Senha oculta — clique para mostrar"><svg class="password-eye password-eye-open" viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.3-5 9.5-5 9.5 5 9.5 5-3.3 5-9.5 5-9.5-5-9.5-5Z"></path><circle cx="12" cy="12" r="2.5"></circle></svg><svg class="password-eye password-eye-closed" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18"></path><path d="M10.6 6.9A10.8 10.8 0 0 1 12 6.8c6.2 0 9.5 5.2 9.5 5.2a17.8 17.8 0 0 1 3.1 3.3"></path><path d="M6.6 8.2C4.2 9.4 2.5 12 2.5 12s3.3 5.2 9.5 5.2c1.3 0 2.5-.3 3.5-.7"></path></svg></button></div></label>` : `<label>Servidor<input id="smtp-host" value="${esc(smtp.host)}" placeholder="smtp.exemplo.com"></label><label>Porta<input id="smtp-port" type="number" min="1" max="65535" value="${esc(smtp.port || 587)}"></label><label>Usuário<input id="smtp-user" value="${esc(smtp.usuario)}" autocomplete="username"></label><label>${secretLabel}<div class="password-field"><input id="smtp-pass" type="password" autocomplete="new-password" placeholder="${secretPlaceholder}"><button type="button" class="password-toggle" aria-label="Mostrar senha" aria-pressed="false" title="Senha oculta — clique para mostrar"><svg class="password-eye password-eye-open" viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.3-5 9.5-5 9.5 5 9.5 5-3.3 5-9.5 5-9.5-5-9.5-5Z"></path><circle cx="12" cy="12" r="2.5"></circle></svg><svg class="password-eye password-eye-closed" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18"></path><path d="M10.6 6.9A10.8 10.8 0 0 1 12 6.8c6.2 0 9.5 5.2 9.5 5.2a17.8 17.8 0 0 1 3.1 3.3"></path><path d="M6.6 8.2C4.2 9.4 2.5 12 2.5 12s3.3 5.2 9.5 5.2c1.3 0 2.5-.3 3.5-.7"></path></svg></button></div></label><label class="admin-checkbox"><input id="smtp-secure" type="checkbox" ${smtp.secure ? 'checked' : ''}> Conexão segura (TLS/SSL)</label>`}</div><p id="smtp-status" role="status"></p><div class="admin-email-actions"><button class="admin-primary" id="save-smtp">Salvar configuração</button><button class="admin-secondary-action" type="button" id="open-smtp-test">Enviar e-mail de teste</button></div></section><div class="admin-modal-backdrop" id="smtp-test-modal" hidden><section class="admin-modal" role="dialog" aria-modal="true" aria-labelledby="smtp-test-title"><button class="admin-modal-close" type="button" id="close-smtp-test" aria-label="Fechar">×</button><h2 id="smtp-test-title">Testar envio de e-mail</h2><p>Informe um endereço que você consiga consultar. O sistema fará um envio real usando o provedor selecionado.</p><form id="smtp-test-form"><label>Enviar para<input id="smtp-test-email" type="email" required placeholder="seuemail@exemplo.com" autocomplete="email"></label><p class="admin-test-note">O diagnóstico informará se o problema está na autenticação, conexão, TLS/SSL ou remetente.</p><p id="smtp-test-status" role="status"></p><div class="admin-modal-actions"><button class="admin-secondary-action" type="button" id="cancel-smtp-test">Cancelar</button><button class="admin-primary" type="submit">Enviar teste</button></div></form></section></div>`; }
  function audit() { if (state.tab === 'terms') return terms(); return `<h1>Auditoria</h1><p>Últimas ações administrativas registradas.</p><div class="admin-panel"><table><thead><tr><th>Data</th><th>Administrador</th><th>Ação</th><th>Entidade</th></tr></thead><tbody>${state.audit.map(item => `<tr><td>${new Date(item.created_at).toLocaleString('pt-BR')}</td><td>${esc(item.administrador || 'Sistema')}</td><td>${esc(item.acao)}</td><td>${esc(item.entidade)} ${esc(item.entidade_id || '')}</td></tr>`).join('')}</tbody></table></div>`; }
  function termosProprietario() {
    const content = state.ownerTerms?.conteudo || 'Termos do Proprietário ainda não foram carregados.';
    const version = state.ownerTerms?.versao || 1;
    const updated = state.ownerTerms?.updated_at ? new Date(state.ownerTerms.updated_at).toLocaleString('pt-BR') : 'Ainda não editado';
    return `<h1>Termos do Proprietário</h1><p>Edite separadamente as condições de anúncio e intermediação aceitas por quem cadastra imóvel como Proprietário Direto.</p><div class="admin-legal-review-notice"><strong>Revisão necessária</strong><span>A versão inicial foi organizada a partir das orientações recebidas e está marcada como minuta. Peça revisão jurídica antes de usar em produção. Salvar publica a nova versão e exige novo aceite nos próximos cadastros e edições de proprietários.</span></div><div class="admin-policy-grid"><section class="admin-panel"><div class="admin-panel-heading"><div><h2>Versão vigente</h2><p>Versão ${esc(version)} · Atualizada em ${esc(updated)}</p></div><span class="admin-status-badge">${state.ownerTerms?.versao ? 'Disponível' : 'Em elaboração'}</span></div><div class="admin-policy-preview" aria-label="Prévia dos Termos do Proprietário">${esc(content)}</div></section><section class="admin-panel"><h2>Editar Termos do Proprietário</h2><p>O conteúdo salvo fica disponível no link apresentado junto ao aceite no cadastro do imóvel.</p><label>Texto dos termos<textarea id="owner-terms-text" rows="22">${esc(content)}</textarea></label><button class="admin-primary" id="save-owner-terms">Salvar nova versão</button><span id="owner-terms-status" role="status" aria-live="polite"></span></section></div>`;
  }

  function termosCorretorParceiro() {
    const content = state.partnerTerms?.conteudo || 'Termos do Corretor Parceiro ainda não foram carregados.';
    const version = state.partnerTerms?.versao || 1;
    const updated = state.partnerTerms?.updated_at ? new Date(state.partnerTerms.updated_at).toLocaleString('pt-BR') : 'Ainda não editado';
    return `<h1>Termos do Corretor Parceiro</h1><p>Gerencie o aceite específico solicitado no cadastro de Corretores e Imobiliárias.</p><div class="admin-legal-review-notice"><strong>Revisão necessária</strong><span>A versão inicial reproduz as condições enviadas pela cliente e está marcada como minuta. Recomenda-se revisão jurídica antes de usar em produção. Ao salvar uma revisão, novos cadastros profissionais verão a versão atual.</span></div><div class="admin-policy-grid"><section class="admin-panel"><div class="admin-panel-heading"><div><h2>Versão vigente</h2><p>Versão ${esc(version)} · Atualizada em ${esc(updated)}</p></div><span class="admin-status-badge">${state.partnerTerms?.versao ? 'Disponível' : 'Em elaboração'}</span></div><div class="admin-policy-preview" aria-label="Prévia dos Termos do Corretor Parceiro">${esc(content)}</div></section><section class="admin-panel"><h2>Editar Termos do Corretor Parceiro</h2><p>O conteúdo salvo fica disponível no link junto ao aceite do cadastro profissional.</p><label>Texto dos termos<textarea id="partner-terms-text" rows="22">${esc(content)}</textarea></label><button class="admin-primary" id="save-partner-terms">Salvar nova versão</button><span id="partner-terms-status" role="status" aria-live="polite"></span></section></div>`;
  }

  const shellOriginalWithOwnerTerms = shell;
  shell = content => {
    shellOriginalWithOwnerTerms(content);
    const aside = document.querySelector('.admin-shell > aside');
    if (!aside) return;
    if (!aside.querySelector('[data-tab="ownerTerms"]')) {
      const button = document.createElement('button');
      button.type = 'button'; button.dataset.tab = 'ownerTerms'; button.textContent = 'Termos do proprietário';
      aside.querySelector('[data-tab="terms"]')?.after(button);
      button.onclick = () => { state.tab = 'ownerTerms'; render(); };
    }
    if (!aside.querySelector('[data-tab="partnerTerms"]')) {
      const button = document.createElement('button');
      button.type = 'button'; button.dataset.tab = 'partnerTerms'; button.textContent = 'Termos do corretor parceiro';
      aside.querySelector('[data-tab="ownerTerms"]')?.after(button);
      button.onclick = () => { state.tab = 'partnerTerms'; render(); };
    }
    enhanceAdminIcons();
  };
  const renderOriginalWithOwnerTerms = render;
  render = () => {
    if (state.tab === 'ownerTerms') {
      shell(termosProprietario());
      document.querySelectorAll('[data-tab]').forEach(button => button.classList.toggle('active', button.dataset.tab === state.tab));
      return;
    }
    if (state.tab === 'partnerTerms') {
      shell(termosCorretorParceiro());
      document.querySelectorAll('[data-tab]').forEach(button => button.classList.toggle('active', button.dataset.tab === state.tab));
      return;
    }
    renderOriginalWithOwnerTerms();
  };
  const loadOriginalWithOwnerTerms = load;
  load = async () => {
    await loadOriginalWithOwnerTerms();
    try { state.ownerTerms = await api('/api/admin/conteudos/termos_proprietario'); }
    catch (error) { state.ownerTerms = { conteudo: `Não foi possível carregar o termo: ${error.message}`, versao: 0 }; }
    try { state.partnerTerms = await api('/api/admin/conteudos/termos_corretor_parceiro'); }
    catch (error) { state.partnerTerms = { conteudo: `Não foi possível carregar o termo: ${error.message}`, versao: 0 }; }
    if (state.tab === 'ownerTerms' || state.tab === 'partnerTerms') render();
  };

  app.addEventListener('click', async event => {
    const button = event.target.closest('#save-owner-terms');
    if (!button) return;
    const status = document.querySelector('#owner-terms-status');
    button.disabled = true; status.textContent = 'Salvando…';
    try {
      state.ownerTerms = await api('/api/admin/conteudos/termos_proprietario', { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({conteudo:document.querySelector('#owner-terms-text').value}) });
      status.textContent = 'Nova versão salva. Proprietários que ainda não aceitaram esta versão precisarão aceitá-la antes de publicar ou editar anúncios.';
    } catch (error) { status.textContent = error.message; }
    finally { button.disabled = false; }
  });

  app.addEventListener('click', async event => {
    const button = event.target.closest('#save-partner-terms');
    if (!button) return;
    const status = document.querySelector('#partner-terms-status');
    button.disabled = true; status.textContent = 'Salvando…';
    try {
      state.partnerTerms = await api('/api/admin/conteudos/termos_corretor_parceiro', { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({conteudo:document.querySelector('#partner-terms-text').value}) });
      status.textContent = 'Nova versão salva. Novos cadastros de Corretores e Imobiliárias deverão aceitá-la.';
    } catch (error) { status.textContent = error.message; }
    finally { button.disabled = false; }
  });

  app.addEventListener('click', async event => {
    const button = event.target.closest('#save-terms');
    if (!button) return;
    const status = document.querySelector('#terms-status');
    button.disabled = true;
    status.textContent = 'Salvando…';
    try {
      state.terms = await api('/api/admin/conteudos/termos_uso', { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({conteudo:document.querySelector('#terms-text').value}) });
      status.textContent = 'Nova versão salva e já disponível na página pública.';
    } catch (error) {
      status.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });
  app.addEventListener('change', async event => {
    const statusSelect = event.target?.closest('[data-property-status]');
    if (statusSelect) {
      const propertyId = statusSelect.dataset.propertyStatus;
      const message = document.querySelector(`[data-property-status-message="${CSS.escape(propertyId)}"]`);
      statusSelect.disabled = true;
      if (message) message.textContent = 'Salvando…';
      try {
        await api(`/api/admin/imoveis/${encodeURIComponent(propertyId)}/status`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ status:statusSelect.value }) });
        state.properties = await api('/api/admin/imoveis');
        render();
      } catch (error) {
        const current = state.properties.find(item => String(item.id) === String(propertyId));
        statusSelect.value = current?.status || 'disponivel';
        statusSelect.disabled = false;
        if (message) message.textContent = error.message || 'Não foi possível atualizar o status.';
      }
      return;
    }
    if (event.target?.id !== 'dashboard-month') return;
    const period = event.target.value;
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) return;
    const status = document.querySelector('#dashboard-period-status');
    status.textContent = 'Atualizando…';
    event.target.disabled = true;
    try { state.dashboard = await api('/api/admin/dashboard?mes=' + encodeURIComponent(period)); render(); }
    catch (error) { event.target.disabled = false; status.textContent = error.message; }
  });
  function render() { const content = state.tab === 'dashboard' ? dashboard() : state.tab === 'properties' ? properties() : state.tab === 'users' ? users() : state.tab === 'policy' ? policy() : state.tab === 'email' ? email() : audit(); shell(content); document.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('active', b.dataset.tab === state.tab)); document.querySelectorAll('[data-delete]').forEach(b => b.onclick = async () => { if (!confirm('Excluir este imóvel e suas fotos?')) return; await api('/api/admin/imoveis/' + b.dataset.delete, { method:'DELETE' }); state.properties = await api('/api/admin/imoveis'); state.dashboard = await api('/api/admin/dashboard'); render(); }); document.querySelectorAll('[data-user]').forEach(b => b.onclick = async () => { const detail = await api('/api/admin/usuarios/' + b.dataset.user); document.querySelector('#user-detail').innerHTML = `<section class="admin-panel"><h2>${esc(detail.usuario.nome)}</h2><p>${esc(detail.usuario.email)} · ${esc(detail.usuario.telefone)}</p><h3>Imóveis cadastrados</h3><p>${detail.imoveis.length || 0} anúncio(s)</p><h3>Imóveis acessados</h3><ul>${detail.acessados.map(item => `<li>${esc(item.categoria)} · ${esc(item.tipo)} — ${new Date(item.created_at).toLocaleString('pt-BR')}</li>`).join('') || '<li>Nenhum acesso associado.</li>'}</ul></section>`; }); const save = document.querySelector('#save-policy'); if (save) save.onclick = async () => { const status = document.querySelector('#policy-status'); const result = await api('/api/admin/conteudos/politica_privacidade', { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({conteudo:document.querySelector('#policy-text').value}) }); state.policy = result; status.textContent = 'Salvo com sucesso.'; }; const saveSmtp = document.querySelector('#save-smtp'); if (saveSmtp) saveSmtp.onclick = async () => { const status = document.querySelector('#smtp-status'); status.textContent = 'Salvando…'; try { const provider = document.querySelector('#email-provider').value; state.smtp = await api('/api/admin/configuracoes/email', { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ provedor:provider, host:document.querySelector('#smtp-host')?.value, porta:Number(document.querySelector('#smtp-port')?.value), usuario:document.querySelector('#smtp-user')?.value, remetente:document.querySelector('#smtp-from').value, senha:document.querySelector('#smtp-pass').value, seguro:document.querySelector('#smtp-secure')?.checked || false }) }); status.textContent = 'Configuração salva com sucesso.'; render(); } catch (error) { status.textContent = error.message; } }; const provider = document.querySelector('#email-provider'); if (provider) provider.onchange = () => render(); const modal = document.querySelector('#smtp-test-modal'); const closeModal = () => { if (modal) modal.hidden = true; }; const openTest = document.querySelector('#open-smtp-test'); if (openTest) openTest.onclick = () => { modal.hidden = false; document.querySelector('#smtp-test-email').focus(); }; document.querySelector('#close-smtp-test')?.addEventListener('click', closeModal); document.querySelector('#cancel-smtp-test')?.addEventListener('click', closeModal); modal?.addEventListener('click', event => { if (event.target === modal) closeModal(); }); const testForm = document.querySelector('#smtp-test-form'); if (testForm) testForm.onsubmit = async event => { event.preventDefault(); const status = document.querySelector('#smtp-test-status'); const submit = testForm.querySelector('button[type="submit"]'); submit.disabled = true; status.className = ''; status.textContent = 'Autenticando e enviando…'; try { const result = await api('/api/admin/configuracoes/email/teste', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ email:document.querySelector('#smtp-test-email').value }) }); status.className = 'admin-test-success'; status.textContent = result.message; } catch (error) { status.className = 'admin-test-error'; status.textContent = error.message; } finally { submit.disabled = false; } }; }
  document.addEventListener('click', event => { const toggle = event.target.closest('.admin-content .password-toggle'); if (!toggle) return; const password = toggle.parentElement?.querySelector('input'); if (!password) return; const visible = password.type === 'text'; password.type = visible ? 'password' : 'text'; toggle.classList.toggle('is-visible', !visible); toggle.setAttribute('aria-label', visible ? 'Mostrar senha' : 'Ocultar senha'); toggle.setAttribute('aria-pressed', String(!visible)); toggle.title = visible ? 'Senha oculta — clique para mostrar' : 'Senha visível — clique para ocultar'; });
  document.addEventListener('change', event => { if (event.target?.id === 'email-provider') { state.emailProvider = event.target.value; render(); } }, true);
  const BR_STATES = [['AC','Acre'],['AL','Alagoas'],['AP','Amapá'],['AM','Amazonas'],['BA','Bahia'],['CE','Ceará'],['DF','Distrito Federal'],['ES','Espírito Santo'],['GO','Goiás'],['MA','Maranhão'],['MT','Mato Grosso'],['MS','Mato Grosso do Sul'],['MG','Minas Gerais'],['PA','Pará'],['PB','Paraíba'],['PR','Paraná'],['PE','Pernambuco'],['PI','Piauí'],['RJ','Rio de Janeiro'],['RN','Rio Grande do Norte'],['RS','Rio Grande do Sul'],['RO','Rondônia'],['RR','Roraima'],['SC','Santa Catarina'],['SP','São Paulo'],['SE','Sergipe'],['TO','Tocantins']].map(([sigla, nome]) => ({ sigla, nome }));
  const semAcentos = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const termosLocaisIgnorados = new Set(['a', 'as', 'da', 'das', 'de', 'do', 'dos', 'e']);
  const abreviacoesLocais = { dr: 'doutor', dra: 'doutora', jd: 'jardim', vl: 'vila', sta: 'santa', sto: 'santo' };
  function nomeLocalCorresponde(nome, termo) {
    const tokens = semAcentos(termo).replace(/[^a-z0-9]+/g, ' ').split(' ').filter(token => token && !termosLocaisIgnorados.has(token)).map(token => abreviacoesLocais[token] || token);
    const palavras = semAcentos(nome).replace(/[^a-z0-9]+/g, ' ').split(' ').filter(Boolean);
    return !tokens.length || tokens.every(token => palavras.some(palavra => palavra === token || palavra.startsWith(token)));
  }
  const localidadesCache = { estados: null, cidades: new Map(), bairros: new Map() };
  async function carregarEstados() {
    if (localidadesCache.estados) return localidadesCache.estados;
    try { localidadesCache.estados = await api('/api/localidades/estados'); return localidadesCache.estados; }
    catch (_) { localidadesCache.estados = BR_STATES; return localidadesCache.estados; }
  }
  async function carregarCidades(uf) {
    if (localidadesCache.cidades.has(uf)) return localidadesCache.cidades.get(uf);
    try { const cidades = await api(`/api/localidades/cidades?uf=${encodeURIComponent(uf)}`); localidadesCache.cidades.set(uf, cidades); return cidades; }
    catch (_) { const cidades = [...new Set(state.properties.filter(item => String(item.estado || '').toUpperCase() === uf).map(item => item.cidade).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR')); localidadesCache.cidades.set(uf, cidades); return cidades; }
  }
  async function carregarBairros(uf, cidade, termo = '') {
    const cacheKey = `${uf}|${semAcentos(cidade)}|${semAcentos(termo)}`;
    if (localidadesCache.bairros.has(cacheKey)) return localidadesCache.bairros.get(cacheKey);
    try { const bairros = await api(`/api/localidades/bairros?uf=${encodeURIComponent(uf)}&cidade=${encodeURIComponent(cidade)}&q=${encodeURIComponent(termo)}`); localidadesCache.bairros.set(cacheKey, bairros); return bairros; }
    catch (_) { const bairros = [...new Set(state.properties.filter(item => String(item.estado || '').toUpperCase() === uf && semAcentos(item.cidade) === semAcentos(cidade)).map(item => item.bairro).filter(Boolean))].filter(value => nomeLocalCorresponde(value, termo)).sort((a, b) => a.localeCompare(b, 'pt-BR')).slice(0, 30); localidadesCache.bairros.set(cacheKey, bairros); return bairros; }
  }
  function montarAutocomplete(input, getOptions, { onSelect, inline = false } = {}) {
    const wrapper = document.createElement('div');
    wrapper.className = `admin-autocomplete${inline ? ' admin-autocomplete-inline' : ''}`;
    input.replaceWith(wrapper);
    wrapper.appendChild(input);
    input.removeAttribute('list');
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-expanded', 'false');
    const menu = document.createElement('div');
    menu.className = 'admin-autocomplete-menu';
    menu.setAttribute('role', 'listbox');
    menu.hidden = true;
    wrapper.appendChild(menu);
    let options = [];
    let activeIndex = -1;
    let requestId = 0;
    let isOpen = false;
    const close = () => { isOpen = false; wrapper.classList.remove('is-open'); menu.hidden = true; input.setAttribute('aria-expanded', 'false'); activeIndex = -1; };
    const select = option => { input.value = option.label; close(); onSelect?.(option); };
    const paint = () => {
      menu.innerHTML = options.map((option, index) => `<button type="button" role="option" aria-selected="${index === activeIndex}" class="admin-autocomplete-option${index === activeIndex ? ' is-active' : ''}" data-autocomplete-index="${index}">${esc(option.label)}</button>`).join('');
      menu.hidden = !isOpen || !options.length;
      input.setAttribute('aria-expanded', String(!menu.hidden));
    };
    const search = async (query = '') => {
      const currentRequest = ++requestId;
      const result = await getOptions(query);
      if (currentRequest !== requestId) return;
      options = result.slice(0, 30);
      activeIndex = -1;
      paint();
    };
    input.addEventListener('focus', () => { isOpen = true; wrapper.classList.add('is-open'); search(input.value); });
    input.addEventListener('input', () => { isOpen = true; wrapper.classList.add('is-open'); search(input.value); });
    input.addEventListener('keydown', event => {
      if (menu.hidden || !options.length) return;
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); activeIndex = (activeIndex + (event.key === 'ArrowDown' ? 1 : options.length - 1)) % options.length; paint(); }
      if (event.key === 'Enter' && activeIndex >= 0) { event.preventDefault(); select(options[activeIndex]); }
      if (event.key === 'Escape') close();
    });
    menu.addEventListener('mousedown', event => { const option = event.target.closest('[data-autocomplete-index]'); if (option) { event.preventDefault(); select(options[Number(option.dataset.autocompleteIndex)]); } });
    document.addEventListener('mousedown', event => { if (!wrapper.contains(event.target)) close(); });
    return { refresh: () => search(input.value), close };
  }
  const formatadorMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  function lerMoedaBrasileira(value) {
    const text = String(value ?? '').trim();
    if (!text) return null;
    const normalized = text.includes(',')
      ? text.replace(/[^\d,-]/g, '').replace(/\./g, '').replace(',', '.')
      : text.replace(/[^\d-]/g, '');
    const number = Number(normalized);
    return Number.isFinite(number) && number >= 0 ? number : null;
  }
  function aplicarMascaraMoeda(input) {
    if (!input) return;
    input.type = 'text';
    input.inputMode = 'numeric';
    input.removeAttribute('min');
    input.removeAttribute('step');
    input.placeholder = 'R$ 0,00';
    input.addEventListener('input', () => {
      const digits = input.value.replace(/\D/g, '').slice(0, 14);
      input.value = digits ? formatadorMoeda.format(Number(digits) / 100) : '';
      input.setSelectionRange(input.value.length, input.value.length);
    });
  }
  async function configurarFormularioOportunidade() {
    aplicarMascaraMoeda(document.querySelector('#op-min'));
    aplicarMascaraMoeda(document.querySelector('#op-max'));
    const transactionFieldset = document.querySelector('.admin-opportunity-transactions');
    const titleLabel = document.querySelector('#op-title')?.closest('label');
    if (transactionFieldset && titleLabel) {
      transactionFieldset.classList.add('admin-field-wide');
      transactionFieldset.innerHTML = `<legend>Transação aceita <small>(selecione uma ou mais)</small></legend><div class="admin-opportunity-type-options"><label><input type="checkbox" name="op-transaction" value="Venda" checked><span>Compra</span></label><label><input type="checkbox" name="op-transaction" value="Aluguel"><span>Aluguel</span></label><label><input type="checkbox" name="op-transaction" value="Permuta"><span>Permuta</span></label></div>`;
      titleLabel.insertAdjacentElement('afterend', transactionFieldset);
    }
    const typeSelect = document.querySelector('#op-type');
    if (typeSelect) typeSelect.closest('label').outerHTML = `<fieldset class="admin-opportunity-types admin-field-wide"><legend>Tipos de imóvel <small>(selecione um ou mais)</small></legend><div class="admin-opportunity-type-options" id="op-type-options">${state.opportunityTypes.map(type => `<label><input type="checkbox" name="op-property-type" value="${esc(type)}"> <span>${esc(type)}</span></label>`).join('')}</div><div class="admin-add-type"><input id="op-new-type" maxlength="80" placeholder="Ex.: Galpão"><button class="admin-secondary-action" type="button" id="add-opportunity-type">Adicionar tipo</button></div><small class="admin-field-help">Inclua um novo tipo quando uma oportunidade não se encaixar nas opções existentes.</small></fieldset>`;
    document.querySelector('#add-opportunity-type')?.addEventListener('click', async () => {
      const input = document.querySelector('#op-new-type'); const nome = input.value.trim();
      if (!nome) return;
      try { await api('/api/admin/oportunidades/tipos', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ nome }) }); state.opportunityTypes = (await api('/api/admin/oportunidades/tipos')).map(item => item.nome); render(); }
      catch (error) { const status = document.querySelector('#opportunity-status'); if (status) status.textContent = error.message; }
    });
    const city = document.querySelector('#op-city');
    if (!city) return;
    const cityLabel = city.closest('label');
    cityLabel.insertAdjacentHTML('beforebegin', '<label>Estado<input id="op-state" placeholder="Digite UF ou estado"></label>');
    cityLabel.insertAdjacentHTML('afterend', '<label>Bairros de interesse<div class="admin-autocomplete-row"><input id="op-neighborhood" maxlength="120" placeholder="Pesquise e adicione um bairro"><button class="admin-secondary-action" type="button" id="add-opportunity-neighborhood">Adicionar</button></div><div class="admin-opportunity-tags" id="op-neighborhood-tags"></div><input type="hidden" id="op-bairros-json" value="[]"><small class="admin-field-help">Opcional. Você pode adicionar mais de um bairro.</small></label><label>Área mínima (m²)<input id="op-area-min" type="number" min="0" step="0.01" placeholder="Ex.: 250"></label><label>Área máxima (m²)<input id="op-area-max" type="number" min="0" step="0.01" placeholder="Ex.: 500"></label>');
    const stateInput = document.querySelector('#op-state');
    const neighborhoods = [];
    let stateRows = BR_STATES;
    let cityOptions = [];
    const renderNeighborhoods = () => { document.querySelector('#op-neighborhood-tags').innerHTML = neighborhoods.map((item, index) => `<button type="button" class="admin-opportunity-tag" data-neighborhood-index="${index}">${esc(item)} <span aria-hidden="true">×</span></button>`).join(''); document.querySelector('#op-bairros-json').value = JSON.stringify(neighborhoods); };
    const cityAutocomplete = montarAutocomplete(city, async query => cityOptions.filter(value => !query || semAcentos(value).includes(semAcentos(query))).map(value => ({ value, label: value })), { onSelect: option => { city.value = option.value; neighborhoodAutocomplete?.refresh(); } });
    const neighborhoodInput = document.querySelector('#op-neighborhood');
    const neighborhoodAutocomplete = montarAutocomplete(neighborhoodInput, async query => { const uf = stateInput.dataset.uf; if (!uf || !city.value.trim()) return []; return (await carregarBairros(uf, city.value, query)).map(value => ({ value, label: value })); }, { inline: true, onSelect: option => { neighborhoodInput.value = option.value; } });
    document.querySelector('#add-opportunity-neighborhood').onclick = () => { const value = neighborhoodInput.value.trim(); if (!value || neighborhoods.some(item => semAcentos(item) === semAcentos(value))) return; neighborhoods.push(value); neighborhoodInput.value = ''; neighborhoodAutocomplete.close(); renderNeighborhoods(); };
    document.querySelector('#op-neighborhood-tags').onclick = event => { const button = event.target.closest('[data-neighborhood-index]'); if (!button) return; neighborhoods.splice(Number(button.dataset.neighborhoodIndex), 1); renderNeighborhoods(); };
    const selectState = async selected => {
      delete stateInput.dataset.uf;
      city.value = '';
      cityOptions = [];
      city.disabled = true;
      neighborhoodInput.value = '';
      neighborhoodAutocomplete.close();
      if (!selected) { city.disabled = false; return; }
      stateInput.dataset.uf = selected.sigla;
      cityOptions = await carregarCidades(selected.sigla);
      city.disabled = false;
      cityAutocomplete.refresh();
    };
    const stateAutocomplete = montarAutocomplete(stateInput, async query => stateRows.filter(row => !query || semAcentos(`${row.sigla} ${row.nome}`).includes(semAcentos(query))).map(row => ({ value: row.sigla, label: row.nome, state: row })), { onSelect: option => { stateInput.value = option.label; selectState(option.state); } });
    carregarEstados().then(rows => { stateRows = rows; stateAutocomplete.refresh(); });
    const editing = state.editingOpportunity;
    if (editing) {
      const editState = BR_STATES.find(row => row.sigla === String(editing.estado || 'SP').toUpperCase()) || BR_STATES.find(row => row.sigla === 'SP');
      document.querySelector('.admin-opportunity-form-heading h2').textContent = `Editar oportunidade #${editing.id}`;
      document.querySelector('.admin-opportunity-form-heading p:last-child').textContent = 'Atualize os dados da oportunidade. A alteração será registrada na auditoria administrativa.';
      document.querySelector('.admin-draft-badge').textContent = `Status atual: ${{ rascunho: 'Rascunho', publicada: 'Publicada', atendida: 'Atendida', expirada: 'Expirada', cancelada: 'Cancelada' }[editing.status] || editing.status}`;
      const saveButton = document.querySelector('#create-opportunity');
      saveButton.textContent = 'Salvar alterações';
      saveButton.insertAdjacentHTML('afterend', '<button class="admin-secondary-action" type="button" id="cancel-opportunity-edit">Cancelar edição</button>');
      document.querySelector('#op-title').value = editing.titulo || '';
      for (const input of document.querySelectorAll('[name="op-property-type"]')) input.checked = (editing.tipos_imovel || [editing.tipo_imovel]).includes(input.value);
      for (const input of document.querySelectorAll('[name="op-transaction"]')) input.checked = (editing.transacoes || []).includes(input.value);
      document.querySelector('#op-min').value = editing.valor_minimo == null ? '' : formatadorMoeda.format(Number(editing.valor_minimo));
      document.querySelector('#op-max').value = editing.valor_maximo == null ? '' : formatadorMoeda.format(Number(editing.valor_maximo));
      document.querySelector('#op-area-min').value = editing.area_total_minima ?? '';
      document.querySelector('#op-area-max').value = editing.area_total_maxima ?? '';
      document.querySelector('#op-description').value = editing.descricao || '';
      stateInput.value = editState.nome;
      stateInput.dataset.uf = editState.sigla;
      await selectState(editState);
      city.value = editing.cidade || '';
      neighborhoods.push(...(editing.bairros || []));
      renderNeighborhoods();
    } else {
      stateInput.value = 'São Paulo';
      stateInput.dataset.uf = 'SP';
      await selectState({ sigla: 'SP', nome: 'São Paulo' });
    }
    document.querySelector('#cancel-opportunity-edit')?.addEventListener('click', () => { state.editingOpportunity = null; render(); });
  }
  document.addEventListener('click', async event => {
    const button = event.target.closest('#create-opportunity');
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const status = document.querySelector('#opportunity-status');
    const stateInput = document.querySelector('#op-state');
    const estado = stateInput?.dataset.uf || '';
    const tipos_imovel = [...document.querySelectorAll('[name="op-property-type"]:checked')].map(input => input.value);
    const bairros = JSON.parse(document.querySelector('#op-bairros-json')?.value || '[]');
    if (!estado) { status.textContent = 'Selecione um estado da lista.'; return; }
    if (!tipos_imovel.length) { status.textContent = 'Selecione pelo menos um tipo de imóvel.'; return; }
    status.textContent = 'Salvando…';
    try {
      const editing = state.editingOpportunity;
      const payload = { ...(editing || {}), titulo:document.querySelector('#op-title').value, tipos_imovel, tipo_imovel:tipos_imovel[0], cidade:document.querySelector('#op-city').value, estado, bairros, area_total_minima:document.querySelector('#op-area-min').value, area_total_maxima:document.querySelector('#op-area-max').value, valor_minimo:lerMoedaBrasileira(document.querySelector('#op-min').value), valor_maximo:lerMoedaBrasileira(document.querySelector('#op-max').value), descricao:document.querySelector('#op-description').value, transacoes:[...document.querySelectorAll('[name="op-transaction"]:checked')].map(input => input.value), status:editing?.status || 'rascunho' };
      await api(editing ? `/api/admin/oportunidades/${encodeURIComponent(editing.id)}` : '/api/admin/oportunidades', { method:editing ? 'PATCH' : 'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
      state.editingOpportunity = null;
      state.opportunities = await api('/api/admin/oportunidades');
      render();
    } catch (error) { status.textContent = error.message; }
  }, true);
  const renderBase = render;
  render = function renderOpportunitiesAware() {
    if (state.tab !== 'opportunities') return renderBase();
    shell(opportunities());
    const editing = state.editingOpportunity;
    configurarFormularioOportunidade();
    if (editing) requestAnimationFrame(() => document.querySelector('#op-title')?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
    document.querySelectorAll('[data-tab]').forEach(button => button.classList.toggle('active', button.dataset.tab === state.tab));
    document.querySelectorAll('.admin-opportunity-row').forEach(row => {
      const main = row.querySelector('.admin-opportunity-row-main');
      const actions = row.querySelector('.admin-opportunity-row-actions');
      const matchButton = row.querySelector('[data-op-match]');
      const matches = row.querySelector('.admin-opportunity-matches');
      const description = main?.querySelector('.admin-opportunity-description');
      const title = main?.querySelector('h3')?.textContent.trim();
      const opportunity = state.opportunities.find(item => String(item.id) === row.querySelector('[data-op-status]')?.dataset.opStatus);
      if (description && title && description.textContent.trim().replace(/[^\p{L}\p{N}]+/gu, '').toLocaleLowerCase() === title.replace(/[^\p{L}\p{N}]+/gu, '').toLocaleLowerCase()) description.remove();
      const today = new Date().toLocaleDateString('sv-SE');
      const unexpired = !opportunity?.expira_em || String(opportunity.expira_em).slice(0, 10) >= today;
      if (opportunity?.status === 'publicada' && unexpired && actions && !actions.querySelector('[data-op-share]')) {
        const share = document.createElement('button');
        share.className = 'admin-secondary-action admin-opportunity-edit-action admin-opportunity-share-action';
        share.type = 'button';
        share.dataset.opShare = String(opportunity.id);
        share.setAttribute('aria-label', `Compartilhar oportunidade: ${opportunity.titulo}`);
        share.append(materialIcon('share', 'admin-context-icon'), document.createTextNode('Compartilhar'));
        actions.insertBefore(share, actions.querySelector('[data-op-delete]'));
        const status = document.createElement('span');
        status.className = 'admin-opportunity-share-status';
        status.dataset.opShareStatus = String(opportunity.id);
        status.setAttribute('role', 'status');
        status.setAttribute('aria-live', 'polite');
        actions.append(status);
      }
      if (!row.querySelector('.admin-opportunity-card-footer')) {
        const footer = document.createElement('div');
        footer.className = 'admin-opportunity-card-footer';
        if (matchButton) footer.append(matchButton);
        if (actions) footer.append(actions);
        row.insertBefore(footer, matches || null);
      }
    });
    document.querySelectorAll('[data-op-status]').forEach(select => {
      const row = select.closest('.admin-opportunity-row');
      const actions = row?.querySelector('.admin-opportunity-row-actions');
      if (!actions || actions.querySelector('[data-op-edit]')) return;
      const edit = document.createElement('button');
      edit.className = 'admin-secondary-action admin-opportunity-edit-action';
      edit.type = 'button';
      edit.dataset.opEdit = select.dataset.opStatus;
      edit.setAttribute('aria-label', `Editar oportunidade ${select.getAttribute('aria-label')?.replace(/^Status de /, '') || ''}`.trim());
      edit.append(materialIcon('edit', 'admin-context-icon'), document.createTextNode('Editar'));
      actions.insertBefore(edit, actions.querySelector('[data-op-delete]'));
      edit.addEventListener('click', () => {
        state.editingOpportunity = state.opportunities.find(item => String(item.id) === String(edit.dataset.opEdit)) || null;
        if (state.editingOpportunity) render();
      });
    });
    document.querySelectorAll('[data-op-share]').forEach(button => button.addEventListener('click', async () => {
      const opportunity = state.opportunities.find(item => String(item.id) === button.dataset.opShare);
      const status = button.closest('.admin-opportunity-row')?.querySelector(`[data-op-share-status="${button.dataset.opShare}"]`);
      if (!opportunity || !status) return;
      button.disabled = true;
      const result = await window.OpportunityShare?.share(opportunity) || 'failed';
      status.textContent = window.OpportunityShare?.messageFor(result) || 'Não foi possível compartilhar agora.';
      button.disabled = false;
    }));
    document.querySelectorAll('[data-op-match]').forEach(button => button.addEventListener('click', async () => {
      const panel = document.getElementById(`admin-opportunity-matches-${button.dataset.opMatch}`);
      if (!panel) return;
      if (button.dataset.loaded === 'true') {
        panel.hidden = !panel.hidden;
        button.setAttribute('aria-expanded', String(!panel.hidden));
        button.textContent = panel.hidden ? 'Ver imóveis compatíveis' : 'Ocultar imóveis compatíveis';
        return;
      }
      button.disabled = true;
      button.textContent = 'Analisando anúncios…';
      panel.hidden = false;
      panel.innerHTML = '<p class="admin-opportunity-match-loading">Comparando os critérios cadastrados com os imóveis.</p>';
      button.setAttribute('aria-expanded', 'true');
      try {
        const data = await api(`/api/admin/oportunidades/${encodeURIComponent(button.dataset.opMatch)}/compatibilidades`);
        panel.innerHTML = opportunityMatchesMarkup(data);
        button.dataset.loaded = 'true';
        button.textContent = 'Ocultar imóveis compatíveis';
      } catch (error) {
        panel.innerHTML = `<p class="admin-opportunity-match-empty">${esc(error.message)}</p>`;
        button.textContent = 'Tentar análise novamente';
      } finally { button.disabled = false; }
    }));
    document.querySelectorAll('[data-op-delete]').forEach(button => button.addEventListener('click', async () => {
      if (!confirm('Excluir esta oportunidade?')) return;
      await api('/api/admin/oportunidades/' + button.dataset.opDelete, { method:'DELETE' });
      state.opportunities = await api('/api/admin/oportunidades');
      render();
    }));
    document.querySelectorAll('[data-op-status]').forEach(select => select.addEventListener('change', async () => {
      const item = state.opportunities.find(opportunity => String(opportunity.id) === String(select.dataset.opStatus));
      if (!item) return;
      await api('/api/admin/oportunidades/' + item.id, { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ ...item, status:select.value }) });
      state.opportunities = await api('/api/admin/oportunidades');
      render();
    }));
  };
  load();
})();
