const { useEffect, useMemo, useRef, useState } = React;
const TATUI = [-23.3556, -47.8561];

function formatPrice(value, tipo) {
  const number = Number(value || 0);
  return `${number.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}${tipo === 'Aluguel' ? '/mês' : ''}`;
}

function popupHtmlWithPhoto(imovel) {
  return `<article class="react-popup"><small>${imovel.tipo}</small><h3>${imovel.titulo}</h3><p>${formatPrice(imovel.preco, imovel.tipo)}</p><a href="imovel.html?id=${imovel.id}">Ver detalhes →</a></article>`;
}

function popupHtml(imovel) {
  const foto = imovel.fotos?.[0];
  const imagem = foto ? `<img class="react-popup-image" src="${foto.url}" alt="${foto.nome || imovel.titulo}">` : '';
  return `<article class="react-popup">${imagem}<small>${imovel.tipo}</small><h3>${imovel.titulo}</h3><p>${formatPrice(imovel.preco, imovel.tipo)}</p><a href="imovel.html?id=${imovel.id}">Ver detalhes</a></article>`;
}

function App() {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef(null);
  const areaRef = useRef(null);
  const [imoveis, setImoveis] = useState([]);
  const [usuario, setUsuario] = useState(null);
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [error, setError] = useState('');
  const geocodeCacheRef = useRef(new Map());
  const geocodeTimerRef = useRef(null);
  const geocodeRequestRef = useRef(null);

  useEffect(() => {
    const map = L.map(mapRef.current, { zoomControl: true }).setView(TATUI, 14);
    mapInstanceRef.current = map;
    L.tileLayer(`https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/{z}/{x}/{y}?access_token=${MAPBOX_TOKEN}`, {
      attribution: '&copy; Mapbox &copy; OpenStreetMap', tileSize: 512, zoomOffset: -1, maxZoom: 19
    }).addTo(map);
    markersRef.current = L.layerGroup().addTo(map);
    L.marker(TATUI).addTo(map).bindPopup('<strong>Imobiliária Runge</strong><br>Centro de Tatuí, SP');
    fetch('/api/imoveis').then((res) => res.json()).then((data) => setImoveis(Array.isArray(data) ? data : [])).catch(() => setError('Não foi possível carregar os imóveis.'));
    setTimeout(() => map.invalidateSize(), 100);
    return () => { mapInstanceRef.current = null; map.remove(); };
  }, []);

  useEffect(() => { fetch('/api/minha-conta').then((res) => res.ok ? res.json() : null).then((data) => setUsuario(data?.usuario || null)).catch(() => setUsuario(null)); }, []);

  useEffect(() => {
    const layer = markersRef.current;
    if (!layer) return;
    layer.clearLayers();
    imoveis.forEach((imovel) => {
      const coords = imovel.coordenadas || {};
      if (coords.latitude && coords.longitude) { const marker = L.marker([coords.latitude, coords.longitude]).addTo(layer).bindPopup(popupHtml(imovel)); marker.on('click', () => mapInstanceRef.current?.setView([coords.latitude, coords.longitude], mapInstanceRef.current.getZoom(), { animate: true })); }
    });
  }, [imoveis]);

  const consultarMapbox = async (value, limit = 5) => {
    const base = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(value + ', Tatuí, SP')}.json?access_token=${MAPBOX_TOKEN}&language=pt-BR&country=br&limit=${limit}&autocomplete=true`;
    const bairroUrl = `${base}&types=neighborhood,locality,place`;
    const geralUrl = `${base}&types=address,postcode,neighborhood,locality,place`;
    return buscarMapaOtimizado(value, limit);
    const [bairroResponse, geralResponse] = await Promise.all([fetch(bairroUrl), fetch(geralUrl)]);
    const bairroData = await bairroResponse.json();
    const geralData = await geralResponse.json();
    const bairros = bairroData.features || [];
    const demais = (geralData.features || []).filter((item) => !bairros.some((bairro) => bairro.id === item.id));
    return [...bairros, ...demais];
  };

  const search = (value = query) => {
    clearTimeout(geocodeTimerRef.current); const normalized = value.trim();
    if (normalized.length < 3) return setSuggestions([]);
    geocodeTimerRef.current = setTimeout(async () => { try { setSuggestions(await buscarMapaOtimizado(normalized)); } catch (e) { if (e.name !== 'AbortError') setSuggestions([]); } }, 400);
  };
  const searchLocation = async () => {
    const value = query.trim();
    if (value.length < 3) return;
    setSuggestions([]); setError('Buscando localização…');
    try {
      const features = await consultarMapbox(value, 5);
      const feature = features.find((item) => ['neighborhood', 'locality', 'place'].includes(item.place_type?.[0])) || features[0];
      if (!feature) throw new Error('not-found');
      mostrarArea(feature);
      setError('');
    } catch { setError('Bairro ou localização não encontrado em Tatuí.'); }
  };
  const selectPlace = (feature) => {
    setQuery(feature.place_name); setSuggestions([]); mostrarArea(feature);
  };
  const mostrarArea = (feature) => {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (areaRef.current) { map.removeLayer(areaRef.current); areaRef.current = null; }
    const [lng, lat] = feature.center;
    if (feature.bbox?.length === 4 && ['neighborhood', 'locality', 'place'].includes(feature.place_type?.[0])) {
      const bounds = [[feature.bbox[1], feature.bbox[0]], [feature.bbox[3], feature.bbox[2]]];
      areaRef.current = L.rectangle(bounds, { color: '#b36d43', weight: 2, fillColor: '#b36d43', fillOpacity: 0.12 }).addTo(map);
      map.fitBounds(bounds, { padding: [28, 28], maxZoom: 16 });
    } else map.setView([lat, lng], 16);
    L.popup().setLatLng([lat, lng]).setContent(`<strong>${feature.text}</strong><br>${feature.place_name}`).openOn(map);
  };
  const buscarMapaOtimizado = async (value, limit = 5) => {
    const normalized = value.trim().toLowerCase(); if (normalized.length < 3) return [];
    const cacheKey = `${normalized}|${limit}`; if (geocodeCacheRef.current.has(cacheKey)) return geocodeCacheRef.current.get(cacheKey);
    geocodeRequestRef.current?.abort(); const controller = new AbortController(); geocodeRequestRef.current = controller;
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(`${value.trim()}, Tatuí, SP`)}.json?access_token=${MAPBOX_TOKEN}&language=pt-BR&country=br&limit=${limit}&autocomplete=true&types=address,postcode,neighborhood,locality,place`;
    const response = await fetch(url, { signal: controller.signal }); if (!response.ok) throw new Error('mapbox-error');
    const features = (await response.json()).features || []; geocodeCacheRef.current.set(cacheKey, features); return features;
  };
  const buscarSugestoesOtimizado = (value) => { clearTimeout(geocodeTimerRef.current); const normalized = value.trim(); if (normalized.length < 3) return setSuggestions([]); geocodeTimerRef.current = setTimeout(async () => { try { setSuggestions(await buscarMapaOtimizado(normalized)); } catch (e) { if (e.name !== 'AbortError') setSuggestions([]); } }, 400); };
  const buscarLocalOtimizado = async () => { const value = query.trim(); if (value.length < 3) return; clearTimeout(geocodeTimerRef.current); setSuggestions([]); setError('Buscando localização…'); try { const features = await buscarMapaOtimizado(value); const feature = features.find((item) => ['neighborhood', 'locality', 'place'].includes(item.place_type?.[0])) || features[0]; if (!feature) throw new Error('not-found'); mostrarArea(feature); setError(''); } catch (e) { if (e.name !== 'AbortError') setError('Bairro ou localização não encontrado em Tatuí.'); } };
  const totalLabel = useMemo(() => `${imoveis.length} ${imoveis.length === 1 ? 'imóvel encontrado' : 'imóveis encontrados'}`, [imoveis]);
  const iniciais = usuario ? usuario.nome.trim().split(/\s+/).slice(0, 2).map((nome) => nome[0]).join('').toUpperCase() : '';
  return <div className="react-shell">
    <header className="react-header"><a className="react-brand" href="/"><img src="assets/runge-imobiliaria.png" alt="Runge Imobiliária" /></a><a className="home-button active" href="/">Página inicial</a><nav className="react-nav"><a href="imoveis.html">Imóveis</a><a href="#sobre">Sobre</a>{usuario ? <a className="react-user-link" href="login.html"><span className="react-avatar">{iniciais}</span><span>Olá, {usuario.nome.trim().split(/\s+/)[0]}</span></a> : <a className="react-action" href="login.html">Área do usuário</a>}</nav></header>
    <main className="react-main"><section className="react-panel"><p className="eyebrow">Imóveis em Tatuí e região</p><h1>O lugar certo para o seu próximo passo.</h1><p className="react-copy">Encontre seu novo endereço com atendimento próximo, informações claras e oportunidades para comprar, vender ou alugar com mais segurança.</p><div className="react-search"><label htmlFor="react-location">Encontre um imóvel por localização</label><div className="react-search-row"><input id="react-location" value={query} onChange={(e) => { setQuery(e.target.value); search(e.target.value); }} onKeyDown={(e) => { if (e.key === 'Enter') searchLocation(); if (e.key === 'Escape') setSuggestions([]); }} placeholder="Digite rua, bairro ou CEP" autoComplete="off"/><button onClick={searchLocation}>Buscar</button></div>{suggestions.length > 0 && <div className="react-suggestions">{suggestions.map((item) => <button key={item.id} onClick={() => selectPlace(item)}>{item.place_name}</button>)}</div>}{error && <p className="react-error">{error}</p>}</div><div className="react-stats"><div><strong>{imoveis.length}</strong><span>imóveis disponíveis</span></div><div><strong>Tatuí</strong><span>conhecimento da região</span></div></div></section><section className="react-map"><div id="react-map" ref={(node) => { mapRef.current = node; }}></div><span className="react-map-label">Explore as oportunidades no mapa</span></section></main>
  </div>;
}

function HomePage() {
  const mapRef = useRef(null); const mapInstanceRef = useRef(null); const markersRef = useRef(null);
  const [imoveis, setImoveis] = useState([]); const [query, setQuery] = useState(''); const [tipo, setTipo] = useState(''); const [preco, setPreco] = useState(''); const [suggestions, setSuggestions] = useState([]); const [error, setError] = useState('');
  const imoveisVisiveis = useMemo(() => imoveis.filter(item => { if (tipo && String(item.categoria || '').toLowerCase() !== tipo.toLowerCase()) return false; const valor = Number(item.preco || 0); if (preco === 'ate-250000' && valor > 250000) return false; if (preco === '250000-500000' && (valor < 250000 || valor > 500000)) return false; if (preco === 'acima-500000' && valor <= 500000) return false; return true; }), [imoveis, tipo, preco]);
  const cacheRef = useRef(new Map()); const timerRef = useRef(null); const requestRef = useRef(null);
  useEffect(() => {
    const map = L.map(mapRef.current, { zoomControl: true }).setView(TATUI, 13); mapInstanceRef.current = map;
    L.tileLayer(`https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/{z}/{x}/{y}?access_token=${MAPBOX_TOKEN}`, { attribution: '&copy; Mapbox &copy; OpenStreetMap', tileSize: 512, zoomOffset: -1, maxZoom: 19 }).addTo(map);
    markersRef.current = L.layerGroup().addTo(map); fetch('/api/imoveis').then(r => r.json()).then(data => setImoveis(Array.isArray(data) ? data : [])).catch(() => setError('Não foi possível carregar os imóveis.')); setTimeout(() => map.invalidateSize(), 100);
    return () => { mapInstanceRef.current = null; map.remove(); };
  }, []);
  useEffect(() => { const layer = markersRef.current; if (!layer) return; layer.clearLayers(); imoveisVisiveis.forEach(imovel => { const c = imovel.coordenadas || {}; if (!c.latitude || !c.longitude) return; const marker = L.marker([c.latitude, c.longitude]).addTo(layer).bindPopup(popupHtml(imovel)); marker.on('click', () => mapInstanceRef.current?.setView([c.latitude, c.longitude], mapInstanceRef.current.getZoom(), { animate: true })); }); }, [imoveisVisiveis]);
  const buscarLocal = async (value, limit = 5) => { const key = `${value.trim().toLowerCase()}|${limit}`; if (cacheRef.current.has(key)) return cacheRef.current.get(key); requestRef.current?.abort(); const controller = new AbortController(); requestRef.current = controller; const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(`${value.trim()}, Tatuí, SP`)}.json?access_token=${MAPBOX_TOKEN}&language=pt-BR&country=br&limit=${limit}&autocomplete=true&types=address,postcode,neighborhood,locality,place`; const response = await fetch(url, { signal: controller.signal }); const data = await response.json(); const features = data.features || []; cacheRef.current.set(key, features); return features; };
  const sugerir = (value) => { clearTimeout(timerRef.current); if (value.trim().length < 3) return setSuggestions([]); timerRef.current = setTimeout(async () => { try { setSuggestions(await buscarLocal(value)); } catch (e) { if (e.name !== 'AbortError') setSuggestions([]); } }, 400); };
  const selecionar = (feature) => { setQuery(feature.place_name); setSuggestions([]); const map = mapInstanceRef.current; if (!map) return; const [lng, lat] = feature.center; map.setView([lat, lng], 16); L.popup().setLatLng([lat, lng]).setContent(`<strong>${feature.text}</strong><br>${feature.place_name}`).openOn(map); };
  const buscar = async (event) => { event.preventDefault(); const termo = query.trim(); const params = new URLSearchParams(); if (termo) params.set('q', termo); if (tipo) params.set('categoria', tipo); if (preco) params.set('faixa', preco); if (!termo || termo.length < 3) { window.location.href = `imoveis.html${params.toString() ? `?${params.toString()}` : ''}`; return; } setSuggestions([]); setError('Buscando localização…'); try { const features = await buscarLocal(termo); const feature = features.find(item => ['neighborhood', 'locality', 'place'].includes(item.place_type?.[0])) || features[0]; if (!feature) throw new Error('not-found'); selecionar(feature); window.location.href = `imoveis.html?${params.toString()}`; } catch (e) { if (e.name !== 'AbortError') setError('Localização não encontrada em Tatuí.'); } };
  const verNaArea = () => { const map = mapInstanceRef.current; if (!map) return; const bounds = map.getBounds(); const ids = imoveisVisiveis.filter(item => { const c = item.coordenadas || {}; return c.latitude && c.longitude && bounds.contains([c.latitude, c.longitude]); }).map(item => item.id); window.location.href = `imoveis.html?ids=${ids.join(',')}`; };
  useEffect(() => { const container = mapRef.current?.parentElement; if (!container || container.querySelector('.home-area-button')) return; const button = document.createElement('button'); button.className = 'home-area-button'; button.type = 'button'; button.textContent = 'Ver imóveis nesta área'; button.addEventListener('click', verNaArea); container.appendChild(button); return () => { button.removeEventListener('click', verNaArea); button.remove(); }; }, [imoveisVisiveis]);
  const categorias = [['Casa', '⌂'], ['Apartamento', '▦'], ['Terreno', '△'], ['Chácara / Sítio', '♧'], ['Comercial', '▣']];
  return <div className="home-redesign"><header className="home-header"><a className="home-logo" href="/"><span className="home-logo-mark">⌂</span><span><strong>TATUÍ IMÓVEIS</strong><small>O portal de imóveis de Tatuí.</small></span></a><nav><a href="imoveis.html?tipo=Venda">Comprar</a><a href="imoveis.html?tipo=Aluguel">Alugar</a><a href="imoveis.html">Imóveis</a><a href="#sobre">Sobre</a><a href="#contato">Contato</a></nav><a className="home-announce" href="cadastro.html">Anuncie seu imóvel grátis</a></header><section className="home-hero"><div className="home-hero-content"><p className="home-kicker">Tatuí, a cidade para chamar de lar</p><h1>Encontre seu lugar em Tatuí.</h1><p>Casas, apartamentos, terrenos, chácaras e imóveis comerciais para comprar ou alugar.</p></div><form className="home-search" onSubmit={buscar}><label className="home-location-field"><span>⌖</span><input value={query} onChange={e => { setQuery(e.target.value); sugerir(e.target.value); }} placeholder="Bairro, região ou palavra-chave" autoComplete="off" /></label><select value={tipo} onChange={e => setTipo(e.target.value)} aria-label="Tipo de imóvel"><option value="">Tipo de imóvel</option><option>Casa</option><option>Apartamento</option><option>Terreno</option><option>Chácara / Sítio</option><option>Comercial</option></select><select value={preco} onChange={e => setPreco(e.target.value)} aria-label="Faixa de preço"><option value="">Faixa de preço</option><option value="ate-250000">Até R$ 250 mil</option><option value="250000-500000">R$ 250 a 500 mil</option><option value="acima-500000">Acima de R$ 500 mil</option></select><button type="submit">⌕&nbsp; Buscar imóveis</button>{suggestions.length > 0 && <div className="home-suggestions">{suggestions.map(item => <button type="button" key={item.id} onClick={() => selecionar(item)}>{item.place_name}</button>)}</div>}{error && <small className="home-search-error">{error}</small>}</form></section><section className="home-map-section" id="mapa"><div className="home-section-copy"><p className="home-kicker">Explore Tatuí</p><h2>Imóveis no mapa</h2><p>Veja os imóveis disponíveis em Tatuí e encontre o seu próximo endereço.</p><a href="imoveis.html">Ver todos os imóveis →</a></div><div className="home-map"><div ref={mapRef} id="react-map"></div><span>Arraste o mapa para explorar</span></div></section><section className="home-categories"><div><p className="home-kicker">Encontre com facilidade</p><h2>Busque por categoria</h2><p>Escolha o tipo de imóvel ideal para você.</p></div><div className="home-category-grid">{categorias.map(([label, icon]) => <a href={`imoveis.html?categoria=${encodeURIComponent(label)}`} key={label}><strong>{icon}</strong><span>{label}</span></a>)}</div></section><section className="home-announce-section" id="sobre"><div><p className="home-kicker">Tem um imóvel em Tatuí?</p><h2>Anuncie seu imóvel grátis.</h2><p>É rápido, simples e sem custo. Seu imóvel pode estar à procura de um novo dono ou inquilino agora mesmo.</p></div><a className="home-announce-button" href="cadastro.html">Anunciar agora grátis&nbsp; →</a></section><footer className="home-footer" id="contato"><a className="home-logo" href="/"><span className="home-logo-mark">⌂</span><span><strong>TATUÍ IMÓVEIS</strong><small>O portal de imóveis de Tatuí.</small></span></a><span>© Tatuí Imóveis</span><span>Foto: Santuário Conceição / Wikimedia Commons (CC BY-SA 4.0)</span></footer></div>;
}

ReactDOM.createRoot(document.getElementById('root')).render(<HomePage />);
