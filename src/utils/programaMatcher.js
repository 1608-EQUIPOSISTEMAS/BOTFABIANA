const sinonimos = require('../../sinonimos.json');
const programas = require('../database/programas.json');

function normalizarTexto(texto) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quitar tildes
    .toLowerCase();
}

function encontrarPrograma(mensaje) {
  const texto = normalizarTexto(mensaje);

  // Buscar en sinónimos
  for (const [programa, lista] of Object.entries(sinonimos)) {
    if (texto.includes(programa) || lista.some(s => texto.includes(s))) {
      // Buscar coincidencia en programas.json
      const resultados = programas.filter(p =>
        normalizarTexto(p.Nombre).includes(programa)
      );
      if (resultados.length > 0) return resultados;
    }
  }

  return [];
}

module.exports = { encontrarPrograma };
