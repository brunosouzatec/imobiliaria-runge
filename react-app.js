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

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
