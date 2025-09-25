// excelToJson.js
const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

// 🔹 Función para convertir serial de Excel a Date
function excelDateToJSDate(serial) {
  // Excel cuenta desde 1900-01-01
  const excelEpoch = new Date(1899, 11, 30); // Ajuste por bug de Excel (falso 29-feb-1900)
  const days = Math.floor(serial);
  const date = new Date(excelEpoch.getTime() + days * 86400000); // 86400000 ms en un día
  return date;
}

// Ruta de tu archivo Excel
const excelPath = path.join(__dirname, 'SEGUIMIENTO.xlsx');

// Leer el archivo Excel
const workbook = xlsx.readFile(excelPath);

// Tomar la primera hoja (puedes cambiar el nombre si quieres otra)
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];

// Convertir hoja a JSON
const jsonData = xlsx.utils.sheet_to_json(worksheet, { defval: "" });

// 🔹 Normalizar fechas INICIO1..INICIO5
jsonData.forEach(p => {
  for (let i = 1; i <= 6; i++) {
    const key = `INICIO${i}`;
    if (p[key] && !isNaN(p[key])) {
      p[key] = excelDateToJSDate(p[key]).toLocaleDateString("es-PE");
    }
  }
});

// Guardar en archivo JSON
const jsonPath = path.join(__dirname, 'programas.json');
fs.writeFileSync(jsonPath, JSON.stringify(jsonData, null, 2), 'utf8');

console.log(`✅ Excel convertido a JSON con fechas corregidas: ${jsonPath}`);