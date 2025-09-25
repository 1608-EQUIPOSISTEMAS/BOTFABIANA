const programasRaw = require("../../programas.json");
const sinonimos = require("../../sinonimos.json");
const { normalizarTexto } = require("../utils/normalizar");

const programas = Array.isArray(programasRaw) ? programasRaw : [programasRaw];

function encontrarPrograma(mensaje) {
  const text = normalizarTexto(mensaje);
  const encontrados = new Map();

  for (const [clave, lista] of Object.entries(sinonimos)) {
    const claveNorm = normalizarTexto(clave);
    const variantes = [claveNorm].concat((lista || []).map(normalizarTexto));

    // Si el mensaje incluye alguna variante del sinónimo
    if (variantes.some(v => v && text.includes(v))) {
      // 👉 Busca en programas.json el que coincida con la clave (exacto)
      const programa = programas.find(
        (p) => normalizarTexto(p.PROGRAMA || "") === claveNorm
      );

      if (programa) {
        encontrados.set(claveNorm, programa);
      }
    }
  }

  return Array.from(encontrados.values());
}

module.exports = { encontrarPrograma };
