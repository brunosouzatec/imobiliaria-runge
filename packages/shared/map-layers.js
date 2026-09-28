(function (global) {
  const styles = [
    { id: 'ruas', label: 'Ruas', style: 'streets-v12' },
    { id: 'satellite', label: 'Satélite', style: 'satellite-streets-v12' },
    { id: 'outdoors', label: 'Terreno', style: 'outdoors-v12' },
    { id: 'light', label: 'Claro', style: 'light-v11' },
    { id: 'dark', label: 'Escuro', style: 'dark-v11' }
  ];

  function tileLayer(style, token) {
    return L.tileLayer(`https://api.mapbox.com/styles/v1/mapbox/${style}/tiles/{z}/{x}/{y}?access_token=${encodeURIComponent(token || '')}`, {
      attribution: '&copy; Mapbox &copy; OpenStreetMap',
      tileSize: 512,
      zoomOffset: -1,
      maxZoom: 19
    });
  }

  function addControl(map, token, options = {}) {
    const layers = {};
    const initialLayer = options.initial || 'ruas';
    styles.forEach(({ id, label, style }) => {
      layers[label] = tileLayer(style, token);
      if (id === initialLayer) layers[label].addTo(map);
    });
    const control = L.control.layers(layers, null, {
      collapsed: options.collapsed !== undefined ? options.collapsed : true,
      position: options.position || 'topright'
    }).addTo(map);
    return { control, layers };
  }

  global.PropertyMapLayers = { styles, tileLayer, addControl };
}(window));
