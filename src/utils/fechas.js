function obtenerFechas(programa) {
  const fechas = [];
  for (let i = 1; i <= 5; i++) {
    const key = `INICIO${i}`;
    if (programa[key]) {
      fechas.push(programa[key]);
    }
  }
  return fechas.slice(0, 3);
}

module.exports = { obtenerFechas };
