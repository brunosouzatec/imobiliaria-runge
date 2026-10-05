const PROPERTY_STATUSES = Object.freeze({
  em_negociacao: 'Em negociação',
  vendido: 'Vendido',
  reservado: 'Reservado',
  alugado: 'Alugado',
  disponivel: 'Disponível'
});

function normalizePropertyStatus(value) {
  return Object.hasOwn(PROPERTY_STATUSES, value) ? value : null;
}

module.exports = { PROPERTY_STATUSES, normalizePropertyStatus };
