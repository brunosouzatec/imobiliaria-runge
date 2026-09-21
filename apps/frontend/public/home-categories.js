(() => {
  const section = document.querySelector('.home-categories');
  const mapColumn = document.querySelector('.home-map-column');
  if (!section || !mapColumn) return;

  const labels = [...section.querySelectorAll('.home-category-grid a')].map((link, index) => ({
    label: link.querySelector('span')?.textContent?.trim() || '',
    icon: link.querySelector('strong')?.style.backgroundImage || '',
    color: ['#00796b', '#2563eb', '#c2410c', '#15803d', '#9333ea'][index] || '#00796b'
  })).filter(item => item.label);

  const panel = document.createElement('div');
  panel.className = 'home-map-categories';
  panel.innerHTML = '<div class="home-map-filter-heading"><h3>Explore por categoria</h3></div>';
  const grid = document.createElement('div');
  grid.className = 'home-category-grid';
  grid.setAttribute('role', 'group');
  grid.setAttribute('aria-label', 'Filtrar imóveis no mapa por categoria');
  const clear = document.createElement('button');
  clear.type = 'button';
  clear.className = 'home-category-clear';
  clear.textContent = 'Limpar categoria';
  clear.disabled = true;
  const selectCategory = selected => {
    grid.querySelectorAll('button').forEach(button => {
      const active = button.getAttribute('aria-label') === selected;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    window.__homeSetCategory?.(selected);
    clear.disabled = !selected;
  };
  clear.addEventListener('click', () => selectCategory(''));
  labels.forEach(({ label, icon, color }) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'home-map-category-button';
    button.setAttribute('aria-label', label);
    button.setAttribute('aria-pressed', 'false');
    button.title = label;
    button.style.setProperty('--category-color', color);
    button.innerHTML = `<span>${label}</span>`;
    const iconElement = document.createElement('strong');
    iconElement.style.setProperty('--category-icon', icon);
    iconElement.setAttribute('aria-hidden', 'true');
    button.prepend(iconElement);
    button.addEventListener('click', () => {
      selectCategory(button.classList.contains('active') ? '' : label);
    });
    grid.append(button);
  });
  const controls = document.createElement('div');
  controls.className = 'home-map-category-controls';
  controls.append(grid, clear);
  panel.append(controls);
  const map = mapColumn.querySelector('.home-map');
  const search = document.querySelector('.home-search');
  const explorer = document.createElement('div');
  explorer.className = 'home-map-explorer';
  map.parentNode.insertBefore(explorer, map);
  if (search) explorer.append(panel, search, map);
  else explorer.append(panel, map);
  section.remove();
})();
