const programasRaw = require("../database/programas.json");
const sinonimos = require("../database/sinonimos.json");
const { normalizarTexto } = require("../utils/normalizar");

const programas = Array.isArray(programasRaw) ? programasRaw : [programasRaw];

function encontrarPrograma(mensaje) {
    const text = normalizarTexto(mensaje);
    let mejorPrograma = null;
    let longitudMaxima = 0; // Usaremos esto para encontrar el sinónimo más largo

    for (const [clave, lista] of Object.entries(sinonimos)) {
        const claveNorm = normalizarTexto(clave);
        // Combina la clave con sus sinónimos para tener todas las variantes
        const variantes = [claveNorm].concat((lista || []).map(normalizarTexto));

        for (const variante of variantes) {
            if (!variante) continue;
            
            // 1. Verificar si el mensaje incluye el sinónimo actual
            if (text.includes(variante)) {
                // 2. Si el sinónimo actual es más largo, es más específico
                if (variante.length > longitudMaxima) {
                    
                    // 3. Buscar el programa que coincide con la CLAVE GENERAL
                    const programa = programas.find(
                        (p) => normalizarTexto(p.PROGRAMA || "") === claveNorm
                    );

                    if (programa) {
                        mejorPrograma = programa;
                        longitudMaxima = variante.length;
                    }
                }
            }
        }
    }

    // Si se encontró un programa, devolverlo en un array (o solo el objeto, como prefieras)
    return mejorPrograma ? [mejorPrograma] : [];
}

module.exports = { encontrarPrograma };
