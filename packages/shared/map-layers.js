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

  function addControl(map, token) {
    const layers = {};
    styles.forEach(({ label, style }, index) => {
      layers[label] = tileLayer(style, token);
      if (index === 0) layers[label].addTo(map);
    });
    const control = L.control.layers(layers, null, { collapsed: true, position: 'topright' }).addTo(map);
    return { control, layers };
  }

  global.PropertyMapLayers = { styles, tileLayer, addControl };
}(window));
