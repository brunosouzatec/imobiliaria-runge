const tatuí = [-23.3556, -47.8561];
const map = L.map('map', { zoomControl: true }).setView(tatuí, 14);

// Garante que o Leaflet conheça as dimensões finais do container após o layout.
window.addEventListener('load', () => map.invalidateSize());

L.tileLayer(`https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/{z}/{x}/{y}?access_token=${MAPBOX_TOKEN}`, {
  attribution: '&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  tileSize: 512,
  zoomOffset: -1,
  maxZoom: 19
}).addTo(map);

// Banco de dados simulado de imóveis.
function inserirMarcadoresDeImoveis(imoveis) {
  imoveis.forEach((imovel) => {
    const { latitude, longitude } = imovel.coordenadas;
    L.marker([latitude, longitude])
      .addTo(map)
      .bindPopup(`
        <article class="property-popup">
          <span class="property-type">${imovel.tipo}</span>
          <h2>${imovel.titulo}</h2>
          <p class="property-price">${formatarPreco(imovel.preco, imovel.tipo)}</p>
          <a class="details-button" href="imovel.html?id=${imovel.id}">Ver mais detalhes</a>
        </article>
      `, {
        className: 'runge-popup',
        minWidth: 230,
        maxWidth: 280
      });
  });
}

carregarImoveis().then(inserirMarcadoresDeImoveis).catch(console.error);


L.marker(tatuí)
  .addTo(map)
  .bindPopup('<strong>Imobiliária Runge</strong><br>Centro de Tatuí, SP');

const searchInput = document.querySelector('#location-search');
const searchButton = document.querySelector('#search-button');
const searchMessage = document.querySelector('#search-message');
const suggestions = document.querySelector('#location-suggestions');
let searchTimer;

function esconderSugestoes() {
  suggestions.innerHTML = '';
  suggestions.classList.remove('is-visible');
}

function mostrarSugestoes(features) {
  suggestions.innerHTML = '';
  features.forEach((feature) => {
    const option = document.createElement('button');
    option.className = 'location-suggestion';
    option.type = 'button';
    option.setAttribute('role', 'option');
    option.textContent = feature.place_name;
    option.addEventListener('click', () => {
      const [longitude, latitude] = feature.center;
      searchInput.value = feature.place_name;
      map.setView([latitude, longitude], 16);
      L.popup().setLatLng([latitude, longitude]).setContent(`<strong>${feature.text}</strong><br>${feature.place_name}`).openOn(map);
      esconderSugestoes();
    });
    suggestions.appendChild(option);
  });
  suggestions.classList.toggle('is-visible', features.length > 0);
}

async function buscarSugestoes() {
  const query = searchInput.value.trim();
  if (query.length < 3) return esconderSugestoes();
  try {
    const response = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query + ', Tatuí, SP')}.json?access_token=${MAPBOX_TOKEN}&language=pt-BR&country=br&limit=5&autocomplete=true`);
    const data = await response.json();
    mostrarSugestoes(data.features || []);
  } catch {
    esconderSugestoes();
  }
}

async function searchLocation() {
  const query = searchInput.value.trim();
  if (!query) return;
  searchMessage.textContent = 'Buscando localização…';
  try {
    const response = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query + ', Tatuí, SP')}.json?access_token=${MAPBOX_TOKEN}&language=pt-BR&country=br&limit=1&autocomplete=true&types=address,postcode,neighborhood,place,locality`);
    const results = await response.json();
    if (!results.features?.length) throw new Error('not-found');
    const result = results.features[0];
    const [longitude, latitude] = result.center;
    map.setView([latitude, longitude], 16);
    L.popup().setLatLng([latitude, longitude]).setContent(`<strong>${result.text}</strong><br>${result.place_name}`).openOn(map);
    searchMessage.textContent = '';
  } catch {
    searchMessage.textContent = 'Localização não encontrada.';
  }
}

searchButton.addEventListener('click', searchLocation);
searchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(buscarSugestoes, 250);
});
searchInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') searchLocation();
  if (event.key === 'Escape') esconderSugestoes();
});
document.addEventListener('click', (event) => {
  if (!event.target.closest('.search-box')) esconderSugestoes();
});
