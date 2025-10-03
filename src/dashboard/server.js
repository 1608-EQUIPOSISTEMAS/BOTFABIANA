// server.js

const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const { fork } = require('child_process'); // Importa 'fork'

const app = express();
const PORT = 9000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const projectRoot = path.join(__dirname, "..");
const mediaPath = path.join(projectRoot, "media");


app.use(express.static(path.join(__dirname, "public")));
app.use('/media', express.static(mediaPath));
app.use('/media/images', express.static(path.join(mediaPath, 'images')));
app.use('/media/videos', express.static(path.join(mediaPath, 'videos')));
app.use('/media/pdfs', express.static(path.join(mediaPath, 'pdfs')));


// ✅ CORRECCIÓN: Rutas de los JSON
// La carpeta 'database' está en 'src', no en 'src/dashboard'
const PROGRAMAS_PATH = path.join(projectRoot,  "database", "programas.json");
const PLUS_PATH = path.join(projectRoot,  "database", "plus.json");
const SALUDOS_PATH = path.join(projectRoot, "database", "saludos.json");
const PERFIL_PATH = path.join(projectRoot, "database", "perfil.json");
const CTA_PATH = path.join(projectRoot, "database", "cta.json");
const STATS_PATH = path.join(projectRoot, "database", "stats.json"); 


const DESCUENTOS_PATH = path.join(__dirname, "descuentos.json"); // Agrega esta línea


// Variable global para almacenar los datos en memoria.
let programasEnMemoria = [];
let plusEnMemoria = {};
let saludosEnMemoria = {};
let perfilEnMemoria = {};
let ctaEnMemoria = {};
let statsEnMemoria = {};
let botProcess = null; // Variable para el proceso del bot

function recargarStatsEnMemoria() {
    try {
        const data = fs.readFileSync(STATS_PATH, "utf8");
        statsEnMemoria = JSON.parse(data);
        console.log("✅ Datos de estadísticas recargados en memoria.");
    } catch (err) {
        console.error("❌ Error al recargar estadísticas en memoria:", err);
        statsEnMemoria = { totalReceived: 0, totalResponded: 0, keywords: { info: 0, hola: 0, estoy: 0 } };
    }
}
// Llama a recargarStatsEnMemoria() al iniciar el servidor

// =========================
// 📌 API Estadísticas
// =========================
app.get("/api/stats", (req, res) => {
    recargarStatsEnMemoria(); // Asegura los datos más recientes
    res.json(statsEnMemoria);
});

app.post("/api/stats/reset", (req, res) => {
    const defaultStats = { totalReceived: 0, totalResponded: 0, keywords: { info: 0, hola: 0, estoy: 0 } };
    try {
        fs.writeFileSync(STATS_PATH, JSON.stringify(defaultStats, null, 2), "utf8");
        recargarStatsEnMemoria();
        // Si el bot está corriendo en el mismo proceso (no es tu caso), debes reiniciar la memoria en index.js.
        // Dado que usas 'fork' (child_process), el bot se reiniciará con el reset si lo reinicias.
        res.json({ success: true, message: "Estadísticas reiniciadas." });
    } catch (err) {
        console.error("❌ Error reiniciando estadísticas:", err);
        res.status(500).json({ error: "No se pudieron reiniciar las estadísticas." });
    }
});

// ===================================
// 📌 Funciones para Recargar los datos en memoria
// ===================================

function recargarProgramasEnMemoria() {
    try {
        const data = fs.readFileSync(PROGRAMAS_PATH, "utf8");
        programasEnMemoria = JSON.parse(data);
        console.log("✅ Datos de programas recargados en memoria.");
    } catch (err) {
        console.error("❌ Error al recargar programas en memoria:", err);
        programasEnMemoria = [];
    }
}

function recargarPlusEnMemoria() {
    try {
        const data = fs.readFileSync(PLUS_PATH, "utf8");
        plusEnMemoria = JSON.parse(data);
        console.log("✅ Datos de plus recargados en memoria.");
    } catch (err) {
        console.error("❌ Error al recargar plus en memoria:", err);
        plusEnMemoria = {};
    }
}

function recargarSaludosEnMemoria() {
    try {
        const data = fs.readFileSync(SALUDOS_PATH, "utf8");
        saludosEnMemoria = JSON.parse(data);
        console.log("✅ Datos de saludos recargados en memoria.");
    } catch (err) {
        console.error("❌ Error al recargar saludos en memoria:", err);
        saludosEnMemoria = {};
    }
}

// Mover la función de perfil aquí para consistencia
function recargarPerfilEnMemoria() {
    try {
        const data = fs.readFileSync(PERFIL_PATH, "utf8");
        perfilEnMemoria = JSON.parse(data);
        console.log("✅ Datos de perfil recargados en memoria.");
    } catch (err) {
        console.error("❌ Error al recargar perfil en memoria:", err);
        perfilEnMemoria = {};
    }
}

// Mover la función de cta aquí para consistencia
function recargarCtaEnMemoria() {
    try {
        const data = fs.readFileSync(CTA_PATH, "utf8");
        ctaEnMemoria = JSON.parse(data);
        console.log("✅ Datos de cta recargados en memoria.");
    } catch (err) {
        console.error("❌ Error al recargar cta en memoria:", err);
        ctaEnMemoria = {};
    }
}

// Llama a las funciones de recarga al iniciar el servidor
recargarProgramasEnMemoria();
recargarPlusEnMemoria();
recargarSaludosEnMemoria();
recargarPerfilEnMemoria();
recargarCtaEnMemoria(); // Mover esta llamada aquí

// =========================
// 📌 Configuración de multer
// =========================

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        let uploadPath = '';
        if (req.params.field === 'POSTDOCEN') {
            uploadPath = path.join(mediaPath, 'images');
        } else if (req.params.field === 'VIDEO') {
            uploadPath = path.join(mediaPath, 'videos');
        } else if (req.params.field === 'BROCHURE') {
            uploadPath = path.join(mediaPath, 'pdfs');
        } else {
            return cb(new Error("Campo de archivo no válido"));
        }
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniqueName = Date.now() + "-" + Math.round(Math.random() * 1e9);
        cb(null, uniqueName + path.extname(file.originalname));
    },
});
const upload = multer({ storage });

// =========================
// 📌 API Programas
// =========================

app.get("/api/programas", (req, res) => {
    try {
        const data = fs.readFileSync(PROGRAMAS_PATH, "utf8");
        res.json(JSON.parse(data));
    } catch (err) {
        console.error("❌ Error leyendo programas:", err);
        res.status(500).json({ error: "No se pudieron leer los programas" });
    }
});

// 📌 API Búsqueda de Programas (Para búsquedas avanzadas o en el futuro)
// =========================
app.get("/api/programas/buscar", (req, res) => {
    const query = req.query.q ? req.query.q.toLowerCase() : '';
    
    if (!query) {
        // Si no hay query, devuelve todos los programas
        return res.json(programasEnMemoria);
    }

    try {
        const resultadosFiltrados = programasEnMemoria.filter(programa => {
            // Asume que buscas en la columna 'PROGRAMA'
            const nombre = (programa.PROGRAMA || "").toLowerCase();
            return nombre.includes(query);
        });

        res.json(resultadosFiltrados);

    } catch (err) {
        console.error("❌ Error al procesar la búsqueda en el servidor:", err);
        res.status(500).json({ error: "Fallo interno del servidor al buscar." });
    }
});

app.post("/api/programas", (req, res) => {
    try {
        const data = fs.readFileSync(PROGRAMAS_PATH, "utf8");
        let programas = JSON.parse(data);
        const nuevaEdicion = req.body;
        if (!nuevaEdicion.PROGRAMA || !nuevaEdicion.EDICION) {
            return res.status(400).json({ error: "Los campos 'PROGRAMA' y 'EDICION' son obligatorios" });
        }
        programas.push(nuevaEdicion);
        fs.writeFileSync(PROGRAMAS_PATH, JSON.stringify(programas, null, 2), "utf8");
        recargarProgramasEnMemoria();
        res.json({ success: true, message: "Nueva edición agregada", edicion: nuevaEdicion });
    } catch (err) {
        console.error("❌ Error agregando nueva edición:", err);
        res.status(500).json({ error: "No se pudo agregar la nueva edición" });
    }
});

app.put("/api/programas/:index", (req, res) => {
    try {
        const data = fs.readFileSync(PROGRAMAS_PATH, "utf8");
        let programas = JSON.parse(data);
        const { index } = req.params;
        const updated = req.body;
        if (!Array.isArray(programas)) {
            return res.status(400).json({ error: "El archivo no contiene un array de programas" });
        }
        if (!programas[index]) {
            return res.status(404).json({ error: "Programa no encontrado" });
        }
        Object.keys(updated).forEach(key => {
            if (updated[key] !== undefined && updated[key] !== null) {
                programas[index][key] = updated[key];
            }
        });
        fs.writeFileSync(PROGRAMAS_PATH, JSON.stringify(programas, null, 2), "utf8");
        recargarProgramasEnMemoria();
        res.json({ success: true, programa: programas[index] });
    } catch (err) {
        console.error("❌ Error actualizando programa:", err);
        res.status(500).json({ error: "No se pudo actualizar el programa" });
    }
});



app.put("/api/programa/:nombrePrograma", (req, res) => {
    try {
        const { nombrePrograma } = req.params;
        const updatedInfo = req.body;
        const data = fs.readFileSync(PROGRAMAS_PATH, "utf8");
        let programas = JSON.parse(data);
        if (!nombrePrograma || !updatedInfo) {
            return res.status(400).json({ error: "Faltan datos en la solicitud." });
        }
        let cambiosRealizados = false;
        const programasActualizados = programas.map(p => {
            if (p.PROGRAMA === nombrePrograma) {
                const nuevoP = { ...p };
                Object.keys(updatedInfo).forEach(key => {
                    if (updatedInfo[key] !== undefined && updatedInfo[key] !== null) {
                        nuevoP[key] = updatedInfo[key];
                        cambiosRealizados = true;
                    }
                });
                return nuevoP;
            }
            return p;
        });
        if (!cambiosRealizados) {
            return res.status(404).json({ error: "No se encontró el programa para actualizar." });
        }
        fs.writeFileSync(PROGRAMAS_PATH, JSON.stringify(programasActualizados, null, 2), "utf8");
        console.log(`✅ Información de "${nombrePrograma}" guardada en programas.json`);
        recargarProgramasEnMemoria();
        res.json({ success: true, message: "Información del programa actualizada correctamente." });
    } catch (err) {
        console.error("❌ Error al actualizar la información del programa:", err);
        res.status(500).json({ error: "Error interno del servidor: " + err.message });
    }
});

app.delete("/api/programas/:index", (req, res) => {
    try {
        const data = fs.readFileSync(PROGRAMAS_PATH, "utf8");
        let programas = JSON.parse(data);
        const { index } = req.params;
        if (index < 0 || index >= programas.length) {
            return res.status(404).json({ error: "Índice de edición no válido" });
        }
        programas.splice(index, 1);
        fs.writeFileSync(PROGRAMAS_PATH, JSON.stringify(programas, null, 2), "utf8");
        recargarProgramasEnMemoria();
        res.json({ success: true, message: "Edición eliminada correctamente" });
    } catch (err) {
        console.error("❌ Error eliminando edición:", err);
        res.status(500).json({ error: "No se pudo eliminar la edición" });
    }
});

app.post("/api/upload/:index/:field", upload.single("file"), (req, res) => {
    try {
        const { index, field } = req.params;
        if (!req.file) {
            return res.status(400).json({ error: "No se subió ningún archivo" });
        }
        const fullPath = path.resolve(req.file.path);
        console.log(`✅ Archivo subido y guardado en la ruta: ${fullPath}`);
        const data = fs.readFileSync(PROGRAMAS_PATH, "utf8");
        let programas = JSON.parse(data);
        let fileUrl = '';
        if (field === 'POSTDOCEN') {
            fileUrl = `images/${req.file.filename}`;
        } else if (field === 'VIDEO') {
            fileUrl = `videos/${req.file.filename}`;
        } else if (field === 'BROCHURE') {
            fileUrl = `pdfs/${req.file.filename}`;
        }
        if (index >= 0) {
            if (!programas[index]) {
                return res.status(404).json({ error: "Programa no encontrado" });
            }
            programas[index][field] = fileUrl;
            fs.writeFileSync(PROGRAMAS_PATH, JSON.stringify(programas, null, 2), "utf8");
            recargarProgramasEnMemoria();
        }
        res.json({
            success: true,
            message: "Archivo subido y programa actualizado",
            file: fileUrl,
        });
    } catch (err) {
        console.error("❌ Error subiendo archivo:", err);
        res.status(500).json({ error: "No se pudo subir el archivo: " + err.message });
    }
});

// =========================
// 📌 API Plus
// =========================

app.get("/api/plus", (req, res) => {
    try {
        const data = fs.readFileSync(PLUS_PATH, "utf8");
        res.json(JSON.parse(data));
    } catch (err) {
        console.error("❌ Error leyendo plus.json:", err);
        res.status(500).json({ error: "No se pudo leer el texto global" });
    }
});

app.put("/api/plus", (req, res) => {
    try {
        const { texto } = req.body;
        if (!texto) {
            return res.status(400).json({ error: "El campo 'texto' es requerido" });
        }
        const nuevoPlus = { texto };
        fs.writeFileSync(PLUS_PATH, JSON.stringify(nuevoPlus, null, 2), "utf8");
        recargarPlusEnMemoria();
        res.json({ success: true, plus: nuevoPlus });
    } catch (err) {
        console.error("❌ Error guardando plus.json:", err);
        res.status(500).json({ error: "No se pudo actualizar el texto global" });
    }
});

// =========================
// 📌 API Saludos
// =========================

app.get("/api/saludos", (req, res) => {
    try {
        const data = fs.readFileSync(SALUDOS_PATH, "utf8");
        res.json(JSON.parse(data));
    } catch (err) {
        console.error("❌ Error leyendo saludos.json:", err);
        res.status(500).json({ error: "No se pudo leer el texto de saludo" });
    }
});

app.put("/api/saludos", (req, res) => {
    try {
        const { texto } = req.body;
        if (!texto) {
            return res.status(400).json({ error: "El campo 'texto' es requerido" });
        }
        const nuevoSaludo = { texto };
        fs.writeFileSync(SALUDOS_PATH, JSON.stringify(nuevoSaludo, null, 2), "utf8");
        recargarSaludosEnMemoria();
        res.json({ success: true, saludo: nuevoSaludo });
    } catch (err) {
        console.error("❌ Error guardando saludos.json:", err);
        res.status(500).json({ error: "No se pudo actualizar el texto de saludo" });
    }
});

// Mover las rutas de Perfil junto con las otras API
// =========================
// 📌 API Perfil
// =========================

app.get("/api/perfil", (req, res) => {
    try {
        const data = fs.readFileSync(PERFIL_PATH, "utf8");
        res.json(JSON.parse(data));
    } catch (err) {
        console.error("❌ Error leyendo perfil.json:", err);
        res.status(500).json({ error: "No se pudo leer el texto de perfil" });
    }
});

app.put("/api/perfil", (req, res) => {
    try {
        const { texto } = req.body;
        if (!texto) {
            return res.status(400).json({ error: "El campo 'texto' es requerido" });
        }
        const nuevoPerfil = { texto };
        fs.writeFileSync(PERFIL_PATH, JSON.stringify(nuevoPerfil, null, 2), "utf8");
        recargarPerfilEnMemoria();
        res.json({ success: true, perfil: nuevoPerfil });
    } catch (err) {
        console.error("❌ Error guardando perfil.json:", err);
        res.status(500).json({ error: "No se pudo actualizar el texto de perfil" });
    }
});

// 📌 API Cta
// =========================

app.get("/api/cta", (req, res) => {
    try {
        const data = fs.readFileSync(CTA_PATH, "utf8");
        res.json(JSON.parse(data));
    } catch (err) {
        console.error("❌ Error leyendo cta.json:", err);
        res.status(500).json({ error: "No se pudo leer el texto de perfil" });
    }
});

app.put("/api/cta", (req, res) => {
    try {
        const { texto } = req.body;
        if (!texto) {
            return res.status(400).json({ error: "El campo 'texto' es requerido" });
        }
        const nuevoCta = { texto };
        fs.writeFileSync(CTA_PATH, JSON.stringify(nuevoCta, null, 2), "utf8");
        recargarCtaEnMemoria();
        res.json({ success: true, perfil: nuevoCta });
    } catch (err) {
        console.error("❌ Error guardando cta.json:", err);
        res.status(500).json({ error: "No se pudo actualizar el texto de cta" });
    }
});

// Crear el archivo de descuentos si no existe
const descuentosPorDefecto = { cuota: 45, campana: 55 };
if (!fs.existsSync(DESCUENTOS_PATH)) {
    fs.writeFileSync(DESCUENTOS_PATH, JSON.stringify(descuentosPorDefecto, null, 2));
}

// ✅ NUEVA RUTA para obtener descuentos
app.get('/api/descuentos', (req, res) => {
    try {
        const data = fs.readFileSync(DESCUENTOS_PATH, 'utf8');
        res.json(JSON.parse(data));
    } catch (err) {
        res.status(500).json({ error: 'No se pudo leer el archivo de descuentos.' });
    }
});

// ✅ NUEVA RUTA para guardar y recalcular descuentos
app.put('/api/descuentos', (req, res) => {
    try {
        const { cuota, campana } = req.body;
        if (cuota === undefined || campana === undefined) {
            return res.status(400).json({ error: 'Faltan campos.' });
        }

        // 1. Guardar los nuevos porcentajes
        fs.writeFileSync(DESCUENTOS_PATH, JSON.stringify({ cuota, campana }, null, 2));

        // 2. Recalcular y actualizar los precios de los programas
        const programasRaw = fs.readFileSync(PROGRAMAS_PATH, 'utf8');
        const programas = JSON.parse(programasRaw);
        
        programas.forEach(p => {
            // El valor a modificar es INV PRO e INV EST
            const invProT = parseFloat(p["INV PRO T"]);
            const invEstT = parseFloat(p["INV EST T"]);

            // Asumiendo que el descuento por cuota es el menor y por campaña es el mayor
            // Puedes ajustar la lógica si es al revés
            if (!isNaN(invProT)) {
                p["EXPRO"] = Math.round(invProT * (1 - campana / 100));
                p["INV PRO"] = Math.round(invProT * (1 - cuota / 100)); // Usando cuota como reserva
            }
            if (!isNaN(invEstT)) {
                p["EXEST"] = Math.round(invEstT * (1 - campana / 100));
                p["INV EST"] = Math.round(invEstT * (1 - cuota / 100)); // Usando cuota como reserva
            }
        });

        // Guardar los programas actualizados
        fs.writeFileSync(PROGRAMAS_PATH, JSON.stringify(programas, null, 2));
        
        res.json({ message: "Descuentos y programas actualizados." });

    } catch (err) {
        console.error("Error al actualizar descuentos:", err);
        res.status(500).json({ error: 'Ocurrió un error al guardar los descuentos.' });
    }
});

// =========================
// 📌 NUEVA RUTA: Reiniciar Bot
// =========================
app.post("/api/restart-bot", (req, res) => {
    console.log("🤖 Solicitud de reinicio recibida.");

    // Si el proceso del bot ya existe, lo matamos
    if (botProcess) {
        console.log("❌ Matando el proceso del bot anterior...");
        botProcess.kill('SIGKILL');
    }

    // Iniciamos el bot como un nuevo proceso
    console.log("✅ Iniciando un nuevo proceso para el bot...");
    botProcess = fork(path.join(projectRoot, "index.js")); 
    
    botProcess.on('exit', (code) => {
        console.log(`El proceso del bot se cerró con código: ${code}`);
        botProcess = null; // Reiniciamos la variable
    });

    res.status(200).json({ message: "El bot se está reiniciando." });
});

// =========================
// 📌 NUEVA RUTA: Reiniciar Bot
// =========================
app.post("/api/restart-bot", (req, res) => {
    console.log("🤖 Solicitud de reinicio recibida.");

    if (botProcess) {
        console.log("❌ Matando el proceso del bot anterior...");
        botProcess.kill('SIGKILL');
    }

    console.log("✅ Iniciando un nuevo proceso para el bot...");
    botProcess = fork(path.join(projectRoot, "index.js")); 

    botProcess.on('exit', (code) => {
        console.log(`El proceso del bot se cerró con código: ${code}`);
        botProcess = null;
    });

    res.status(200).json({ message: "El bot se está reiniciando." });
});

// =========================
// 📌 Inicio del servidor y exportación
// =========================
function iniciarServidor() {
    app.listen(PORT, () => {
        console.log(`✅ Dashboard corriendo en http://localhost:${PORT}`);
        // Aquí puedes iniciar el bot por primera vez
    });
}



module.exports ={
    app,
    iniciarServidor,
    programasEnMemoria,
    plusEnMemoria,
    saludosEnMemoria,
    perfilEnMemoria,
    ctaEnMemoria,
    recargarProgramasEnMemoria,
    recargarPlusEnMemoria,
    recargarSaludosEnMemoria,
    recargarPerfilEnMemoria,
    recargarCtaEnMemoria
};