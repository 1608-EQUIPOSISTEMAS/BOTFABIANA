function normalizarTexto(str) {
  return (str || '').toLowerCase().trim();
}

module.exports = { normalizarTexto };
