let imoveis = [];

async function carregarImoveis() {
  const response = await fetch('/api/imoveis');
  if (!response.ok) throw new Error('Não foi possível carregar os imóveis.');
  imoveis = await response.json();
  return imoveis;
}

function formatarPreco(preco, tipo) {
  const valor = preco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  return tipo === 'Aluguel' ? `${valor}/mês` : valor;
}
