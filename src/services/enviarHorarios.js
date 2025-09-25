const fs = require("fs");
const path = require("path");

const SEGUIMIENTO_PATH = path.join(__dirname, "../../programas.json");

// 📅 Obtener fecha actual (solo la parte YYYY-MM-DD)
function obtenerFechaActual() {
  const hoy = new Date();
  return hoy.toISOString().split("T")[0];
}

// 📌 Convertir dd/mm/yyyy → YYYY-MM-DD
function convertirFecha(fechaStr) {
  if (!fechaStr) return null;
  const [dia, mes, anio] = fechaStr.split("/").map(Number);
  // Ajustar a formato comparable
  return `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

// 📌 Función para enviar horarios
async function enviarHorarios(client, numero, programaNombre, maxOpciones = 3) {
  try {
    const data = fs.readFileSync(SEGUIMIENTO_PATH, "utf8");
    const seguimiento = JSON.parse(data);
    const fechaActual = obtenerFechaActual();

    // ✅ Filtrar: mismo programa (ignora mayúsculas) y fechas futuras usando INICIO6
    const opciones = seguimiento
      .filter(item => {
        if (!item.PROGRAMA || !item.INICIO6) return false;
        const fechaComparar = convertirFecha(item.INICIO6);
        return (
          item.PROGRAMA.toLowerCase() === programaNombre.toLowerCase() &&
          fechaComparar >= fechaActual
        );
      })
      .slice(0, maxOpciones);

    if (opciones.length === 0) {
      await client.sendMessage(
        numero,
        `⚠️ No encontré horarios próximos para *${programaNombre}*.`
      );
      console.log(`⚠️ Sin horarios futuros para: ${programaNombre}`);
      return;
    }

    // ✨ Construir mensaje
    let mensaje = `🔵 *HORARIOS*\n`;

    opciones.forEach((opcion, index) => {
      mensaje += `\n*Opción ${index + 1}:*\n`;
      mensaje += `🔹 *Inicio:* ${opcion.INICIO}\n`; // Texto amigable
      mensaje += `🔹 *Fin:* ${opcion.FIN}\n`;
      mensaje += `🔹 *Horario:* ${opcion.HORARIO} ${opcion.DIAS} (Perú 🇵🇪)\n`;
      mensaje += `🔹 *Duración:* ${opcion.SESIONES} sesiones\n`;
    });

    mensaje += `\nClases *EN VIVO* vía Teams 🔴\n`;
    mensaje += `🔵 ¿Horario complicado? *Tenemos FLEXIBILIDAD* Horaria para ti ⏱️.\n`;

    await client.sendMessage(numero, mensaje);
    console.log(`✅ Horarios enviados para: ${programaNombre}`);
  } catch (err) {
    console.error("❌ Error al enviar horarios:", err);
  }
}

module.exports = { enviarHorarios };
