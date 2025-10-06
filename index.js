// index.js

const fs = require("fs");
const path = require("path");
const { MessageMedia } = require("whatsapp-web.js");

const { enviarHorarios } = require("./src/services/enviarHorarios");
const { crearCliente } = require("./src/bot/cliente");
const { normalizarTexto } = require("./src/utils/normalizar");
const { encontrarPrograma } = require("./src/services/encontrarPrograma");

// ✅ IMPORTA y ejecuta la función para iniciar el servidor
const { app, iniciarServidor } = require("./src/dashboard/server");
iniciarServidor();

const client = crearCliente();

// 🔹 Estado temporal
const estadoUsuarios = {};

// ✅ Construir la ruta base del proyecto de forma segura
const projectRoot = process.cwd();
const mediaPath = path.join(projectRoot, 'media');

// -----------------------------------------------------
// 📌 CONFIGURACIÓN Y FUNCIONES DE ESTADÍSTICAS (KPIs) 📌
// -----------------------------------------------------
const STATS_PATH = path.join(projectRoot, "src", "database", "stats.json");
let statsEnMemoria = {};

const DEFAULT_STATS = {
    "totalReceived": 0,
    "totalResponded": 0,
    "keywords": {
        "info": 0,
        "hola": 0,
        "estoy": 0 // Palabra clave solicitada
    },
    "programInquiries": {} // Contará las consultas por nombre de programa
};

function loadStats() {
    try {
        const data = fs.readFileSync(STATS_PATH, "utf8");
        statsEnMemoria = JSON.parse(data);
        // Asegura que la estructura base exista
        statsEnMemoria.keywords = statsEnMemoria.keywords || JSON.parse(JSON.stringify(DEFAULT_STATS.keywords));
        statsEnMemoria.programInquiries = statsEnMemoria.programInquiries || {};
    } catch (err) {
        console.error("❌ Error cargando stats.json. Inicializando por defecto:", err.message);
        statsEnMemoria = JSON.parse(JSON.stringify(DEFAULT_STATS)); // Deep copy
    }
}

function saveStats() {
    try {
        fs.writeFileSync(STATS_PATH, JSON.stringify(statsEnMemoria, null, 2), "utf8");
    } catch (err) {
        console.error("❌ Error guardando stats.json:", err.message);
    }
}

/**
 * Registra un evento en las estadísticas en memoria.
 * @param {('received'|'responded')} type - Tipo de evento a registrar.
 * @param {string | null} keyword - Palabra clave que activó la respuesta (e.g., 'info').
 * @param {string | null} programName - Nombre del programa consultado.
 */
function recordMessage(type, keyword = null, programName = null) {
    if (type === 'received') {
        statsEnMemoria.totalReceived += 1;
    }

    if (type === 'responded') {
        statsEnMemoria.totalResponded += 1;

        // 1. Registro por palabra clave
        if (keyword) {
            const key = keyword.toLowerCase().trim();
            if (statsEnMemoria.keywords.hasOwnProperty(key)) {
                statsEnMemoria.keywords[key] += 1;
            }
        }
    }

    // 2. Registro de consultas por programa específico
    if (programName) {
        const key = programName.toUpperCase().trim();
        statsEnMemoria.programInquiries[key] = (statsEnMemoria.programInquiries[key] || 0) + 1;
    }

    saveStats();
}

// 🚨 Cargar las estadísticas al inicio del bot
loadStats();
// -----------------------------------------------------

const PROGRAMAS_PATH = path.join(projectRoot, "src", "database", "programas.json");
const PLUS_PATH = path.join(projectRoot, "src", "database", "plus.json");
const SALUDOS_PATH = path.join(projectRoot, "src", "database", "saludos.json");
const PERFIL_PATH = path.join(projectRoot, "src", "database", "perfil.json");
const CTA_PATH = path.join(projectRoot, "src", "database", "cta.json");

client.on("message", async (message) => {
    try {
        // 1. 🚨 KPI: Registrar mensaje recibido antes de cualquier filtro
        recordMessage('received');

        if (message.from.includes("@g.us") || message.from.includes("@broadcast")) return;
        if (message.type !== "chat") return;

        // ✅ LECTURA DINÁMICA: Leer los archivos JSON en cada mensaje
        let programasData = [];
        try {
            const programasRaw = fs.readFileSync(PROGRAMAS_PATH, "utf8");
            programasData = JSON.parse(programasRaw);
        } catch (readError) {
            console.error("❌ Error al leer programas.json:", readError);
        }

        let plusData = {};
        try {
            const plusRaw = fs.readFileSync(PLUS_PATH, "utf8");
            plusData = JSON.parse(plusRaw);
        } catch (readError) {
            console.error("❌ Error al leer plus.json:", readError);
        }

        let saludosData = {};
        try {
            const saludosRaw = fs.readFileSync(SALUDOS_PATH, "utf8");
            saludosData = JSON.parse(saludosRaw);
        } catch (readError) {
            console.error("❌ Error al leer saludos.json:", readError);
        }

        let perfilData = {}; // Nuevo objeto para los datos del perfil
        try {
            const perfilRaw = fs.readFileSync(PERFIL_PATH, "utf8");
            perfilData = JSON.parse(perfilRaw);
        } catch (readError) {
            console.error("❌ Error al leer perfil.json:", readError);
            // Si no existe, podemos crear uno por defecto para evitar errores.
            perfilData = {
                texto: "🚨 *Para asesorarte y brindarte la INVERSIÓN del programa, por favor indícame tu perfil:* \n1) Soy egresado y quiero actualizarme\n2) Soy egresado y busco chamba\n3) Soy estudiante y quiero aprender más\n4) Soy estudiante y busco prácticas\n5) Soy independiente"
            };
            fs.writeFileSync(PERFIL_PATH, JSON.stringify(perfilData, null, 2), "utf8");
        }
        console.log("🟢 Contenido de perfil.json:", perfilData);

        let ctaData = {};
        try {
            const ctaRaw = fs.readFileSync(CTA_PATH, "utf8");
            ctaData = JSON.parse(ctaRaw);
        } catch (readError) {
            console.error("❌ Error al leer cta.json:", readError);
        }

        const textoOriginal = (message.body || "").trim();
        const texto = normalizarTexto(textoOriginal);
        const numero = message.from;
        const nombre = message._data?.notifyName || "Sin nombre";

        console.log(`📩 Mensaje de ${nombre} (${numero}): ${textoOriginal}`);

        // ✅ Flujo de perfil (Respuesta a la elección de perfil: 1-5)
        if (estadoUsuarios[numero]?.estado === "esperandoPerfil") {
            const nombrePrograma = estadoUsuarios[numero].nombrePrograma;
            const edicion = estadoUsuarios[numero].edicion;

            // ✅ CAMBIO CLAVE: Volver a buscar el programa en los datos recién leídos
            const p = programasData.find(
                (pr) =>
                    normalizarTexto(pr.PROGRAMA) === normalizarTexto(nombrePrograma) &&
                    normalizarTexto(pr.EDICION) === normalizarTexto(edicion)
            );

            if (!p) {
                await client.sendMessage(numero, "⚠️ Lo siento, no pude encontrar el programa. Por favor, inicia la conversación nuevamente.");
                delete estadoUsuarios[numero];
                return;
            }

            let resKeyName = "";

            // 1) Determinar qué RESX corresponde
            switch (texto) {
                case "1": resKeyName = "RES1"; break;
                case "2": resKeyName = "RES2"; break;
                case "3": resKeyName = "RES3"; break;
                case "4": resKeyName = "RES4"; break;
                case "5": resKeyName = "RES5"; break;
                default:
                    await client.sendMessage(numero, "⚠️ Por favor elige una opción válida (1 a 5).");
                    return;
            }

            // 2) Obtener el contenido personalizado (si existe)
            const resValue = p[resKeyName];

            if (resValue) {
                await client.sendMessage(numero, resValue);
            } else {
                await client.sendMessage(numero, "⚠️ No hay respuesta configurada para esta opción.");
            }

            // 🔹 Definir si es estudiante (3 o 4) o profesional
            const esEstudiante = texto === "3" || texto === "4";
            estadoUsuarios[numero].esEstudiante = esEstudiante;

            // 🔹 Definir si es curso o no
            const esCurso = (p.CATEGORIA || "").toUpperCase() === "CURSO";

            // ✅ Construcción de inversión según tipo (usando la variable 'p' actualizada)
            let inversionMsg = "";

            if (esCurso) {
                if (esEstudiante) {
                    inversionMsg = `*Hasta el Viernes 03 de Octubre por W|E EduFest* 📚🎉🍻

Opciones de pago:
1️⃣ *Al Contado* Ahorro máximo😉
🔥55% Dcto > S/ ${p["EXEST"]} ~(Normal S/ ${p["INV EST T"]})~

2️⃣ *En Cuotas sin intereses*
45% Dcto > S/ ${p["INV EST"]} ~(Normal S/ ${p["INV EST T"]})~
💳 Reserva con S/ ${p["RESEST"]}

*La inversión incluye el CERTIFICADO* 📚`;
                } else {
                    inversionMsg = `*Hasta el Viernes 03 de Octubre por W|E EduFest* 📚🎉🍻

Opciones de pago:
1️⃣ *Al Contado* Ahorro máximo😉
🔥55% Dcto > S/ ${p["EXPRO"]} ~(Normal S/ ${p["INV PRO T"]})~

2️⃣ *En Cuotas sin intereses*
45% Dcto > S/ ${p["INV PRO"]} ~(Normal S/ ${p["INV PRO T"]})~
💳 Reserva con S/ ${p["RESPRO"]}

*La inversión incluye el CERTIFICADO* 📚`;
                }
            } else {
                if (esEstudiante) {
                    inversionMsg = `*Hasta el Viernes 03 de Octubre por W|E EduFest* 📚🎉🍻

Facilidades de pago:
1️⃣ *En Cuotas sin Intereses* 🔥45% Dcto > S/ ${p["INV EST"]} ~(Normal S/ ${p["INV EST T"]})~
💳 Reserva con S/ ${p["RESEST"]}

2️⃣ *Al Contado* Ahorro máximo😉
🔥55% Dcto > S/ ${p["EXEST"]} ~(Normal S/ ${p["INV EST T"]})~

*La inversión incluye el CERTIFICADO* 📚`;
                } else {
                    inversionMsg = `*Hasta el Viernes 03 de Octubre por W|E EduFest* 📚🎉🍻 

Facilidades de pago:
1️⃣ *En Cuotas sin Intereses* 🔥45% Dcto > S/ ${p["INV PRO"]} ~(Normal S/ ${p["INV PRO T"]})~
💳 Reserva con S/ ${p["RESPRO"]}

2️⃣ *Al Contado* Ahorro máximo😉
🔥55% Dcto > S/ ${p["EXPRO"]} ~(Normal S/ ${p["INV PRO T"]})~

*La inversión incluye el CERTIFICADO* 📚`;
                }
            }

            await client.sendMessage(numero, inversionMsg);

            // ✅ Referencia actualizada
            if (plusData?.texto) {
                await client.sendMessage(numero, plusData.texto);
            }

            // ✅ Referencia actualizada
            if (ctaData?.texto) {
                await client.sendMessage(numero, ctaData.texto);
            }

            // 2. 🚨 KPI: Registrar respuesta del bot
            recordMessage('responded');

            estadoUsuarios[numero] = {
                estado: "esperandoDecision",
                nombrePrograma: p.PROGRAMA, // Solo guardamos el nombre y la edición
                edicion: p.EDICION,
                esEstudiante,
                categoria: (p.CATEGORIA || "").toUpperCase()
            };
            return;
        }

        // ✅ Flujo de decisión después de inversión (con horarios)
        if (estadoUsuarios[numero]?.estado === "esperandoDecision") {
            const ahora = new Date();
            const opciones = { timeZone: "America/Lima", hour: "2-digit", hour12: false, weekday: "long" };
            const horaPeru = parseInt(ahora.toLocaleString("es-PE", opciones), 10);
            const dia = ahora.toLocaleDateString("es-PE", { timeZone: "America/Lima", weekday: "long" }).toLowerCase();

            const esFinDeSemana = (dia === "sábado" || dia === "domingo");

            let dentroHorario = false;
            if (!esFinDeSemana && horaPeru >= 9 && horaPeru < 18) {
                dentroHorario = true;
            } else if (esFinDeSemana && horaPeru >= 9 && horaPeru < 13) {
                dentroHorario = true;
            }

            const msgFuera = "✨ Genial, en un momento un asesor se comunicará contigo para resolver tus consultas 😄";
            const msgDentro = "⏰ ¡Estamos contentos de poder ayudarte en tu elección! Un asesor se comunicará contigo el día de *mañana*. Por favor, indícame un *horario* para que se contacte contigo. 🙋🏻‍♀️";

            switch (texto) {
                case "1":
                case "2":
                    await client.sendMessage(numero, `*¡Perfecto!* La inscripción es muy sencilla 😇

Contamos con los siguientes MÉTODOS DE PAGO👇🏻

1️⃣ Yape  📲
2️⃣ Depósito o transferencia bancaria 🏛️
3️⃣ Pago online vía Web 🌐(Aceptamos todas las tarjetas 💳)

Coméntame *¿Cuál sería tu mejor opción de pago?* 😊`);
                    estadoUsuarios[numero].estado = "esperandoMetodoPago";
                    // 3. 🚨 KPI: Registrar respuesta
                    recordMessage('responded');
                    return;

                case "3":
                case "4":
                    await client.sendMessage(numero, dentroHorario ? msgDentro : msgFuera);
                    delete estadoUsuarios[numero];
                    // 4. 🚨 KPI: Registrar respuesta
                    recordMessage('responded');
                    return;

                default:
                    await client.sendMessage(numero, "⚠️ Por favor selecciona 1 o 2 para inscripción, o 3 o 4 para llamada.");
                    return;
            }
        }

        // ✅ Flujo método de pago (Respuesta a la elección de método: Yape, Depósito, Web)
        if (estadoUsuarios[numero]?.estado === "esperandoMetodoPago") {
            const esEstudiante = estadoUsuarios[numero]?.esEstudiante;
            const categoria = estadoUsuarios[numero]?.categoria || "CURSO";

            const datosMsgEstudiante = `*Bríndame por favor, los siguientes datos*:

🔹DNI o CÉDULA:
🔹Nombre completo:
🔹Número de Celular:
🔹Fecha de Inicio:
🔹Correo (Gmail):
🔹Foto de Voucher:
🔹Foto de Intranet o Carnet Universitario:

Y listo! 🌟 Cuando realices el pago y envío de tus datos, me avisas para comentarte los siguientes detalles. 🙋🏻‍♀️💙`;

            const datosMsgProfesional = `*Bríndame por favor, los siguientes datos*:

🔹DNI o CÉDULA:
🔹Nombre completo:
🔹Número de Celular:
🔹Fecha de Inicio:
🔹Correo (Gmail):
🔹Foto de Voucher:

Y listo! 🌟 Cuando realices el pago y envío de tus datos, me avisas para comentarte los siguientes detalles. 🙋🏻‍♀️💙`;

            const esCurso = categoria === "CURSO";
            const nombreYape = esCurso ? "yapecursos.jpeg" : "yapeprog.jpeg";
            const nombreDepo = esCurso ? "depocursos.jpg" : "depoprog.jpg";

            if (texto.includes("1") || texto.includes("yape")) { // Yape
                await client.sendMessage(numero, `*Perfecto* ✨

Te envío el número de Yape y Código QR 👇

📲 979 493 060 // WE Foundation`);

                // ✅ Corregido: Ruta para el QR de Yape
                const rutaQR = path.join(mediaPath, "pago", nombreYape);
                console.log("🔍 Buscando QR Yape en:", rutaQR);

                if (fs.existsSync(rutaQR)) {
                    console.log("✅ QR encontrado, enviando...");
                    const media = MessageMedia.fromFilePath(rutaQR);
                    await client.sendMessage(numero, media);
                } else {
                    console.log("⚠️ No se encontró el QR en:", rutaQR);
                }

                await client.sendMessage(numero, esEstudiante ? datosMsgEstudiante : datosMsgProfesional);

                // 5. 🚨 KPI: Registrar respuesta
                recordMessage('responded');

                delete estadoUsuarios[numero]; // 👈 Limpieza
                return;
            }

            if (texto.includes("2") || texto.includes("bcp") || texto.includes("deposito")) { // Depósito o transferencia
                let mensajeDepo = "";
                if (esCurso) {
                    mensajeDepo = `¡Excelente! Te comparto los datos de nuestra cuenta para que realices la transferencia:

🏛️ *Banco: BCP*
Número de cuenta: 193-9914694-0-22

y desde *otros Bancos*, puedes transferir a esta cuenta:
CCI: 00219300991469402218

*Titular*: WE Foundation`;
                } else {
                    mensajeDepo = `¡Excelente! Te comparto los datos de nuestra cuenta para que realices la transferencia:

🏛️ *Banco: BCP*
Número de cuenta: 193-9285511-0-38

y desde *otros Bancos*, puedes transferir a esta cuenta:
CCI: 002-19300928551103810

*Titular*: WE Educación Ejecutiva SAC`;
                }

                await client.sendMessage(numero, mensajeDepo);
                await client.sendMessage(numero, esEstudiante ? datosMsgEstudiante : datosMsgProfesional);

                // 6. 🚨 KPI: Registrar respuesta
                recordMessage('responded');

                delete estadoUsuarios[numero]; // 👈 Limpieza
                return;
            }

            if (texto.includes("3") || texto.includes("web")) {
                const nombrePrograma = estadoUsuarios[numero].nombrePrograma;
                const edicion = estadoUsuarios[numero].edicion;

                // Buscar el programa nuevamente usando los datos del estado
                const p = programasData.find(
                    (pr) =>
                        normalizarTexto(pr.PROGRAMA) === normalizarTexto(nombrePrograma) &&
                        normalizarTexto(pr.EDICION) === normalizarTexto(edicion)
                );

                if (!p || !p.ENLACE) {
                    delete estadoUsuarios[numero]; // Limpieza
                    return;
                }

                // --- 1. PREPARAR EL TEXTO SIN EL ENLACE DE YOUTUBE ---
                const mensajeTexto = `👉 “Perfecto, puedes hacer tu pago de manera rápida y 100% segura a través de nuestra web:

🔗 ${p["ENLACE"]}

💡 Ventaja: El pago se confirma al instante, tu matrícula queda asegurada y podrás acceder a tus cursos online gratuitos en el Campus Virtual W|E⚡”

🚨Revisa los pasos del video 👇🏻 e inscríbete en menos de 1 minuto, fácil, rápido y seguro.

Y listo! 🌟 Cuando realices el pago y envío de tus datos, me avisas para comentarte los siguientes detalles. 🙋🏻‍♀️💙`;

                // --- 2. ENVIAR EL MENSAJE DE TEXTO ---
                await client.sendMessage(numero, mensajeTexto);

                // --- 3. PREPARAR Y ENVIAR EL VIDEO LOCAL ---
                try {
                    const nombreVideo = "WEB.mp4";
                    const rutaVideo = path.join(mediaPath, "videos", nombreVideo)

                    console.log("🔍 Buscando video para pago web en:", rutaVideo);

                    if (fs.existsSync(rutaVideo)) {
                        console.log("✅ Video encontrado, enviando...");

                        // **ESTA ES LA LÍNEA CLAVE**
                        // Reemplaza la línea simulada con el método real de la librería.
                        const media = MessageMedia.fromFilePath(rutaVideo);

                        // Envía el video. El textoMensaje anterior sirve como un 'caption' implícito.
                        await client.sendMessage(numero, media);
                    } else {
                        console.log("⚠️ No se encontró el video en:", rutaVideo);
                        await client.sendMessage(numero, "⚠️ Lo siento, no se pudo cargar el video explicativo. Revisa la web para el pago.");
                    }
                } catch (error) {
                    console.error("Error al enviar el video:", error);
                    await client.sendMessage(numero, "⚠️ No pude enviar el video. Por favor, realiza los pasos indicados en el texto.");
                }

                // 7. 🚨 KPI: Registrar respuesta
                recordMessage('responded');

                delete estadoUsuarios[numero]; // 👈 Limpieza
                return;
            }
            return;
        }

        // ✅ Flujo principal cuando viene de "hola estoy en", "info", o "facilitar"
        if (texto.includes("hola estoy en") || texto.includes("info") || texto.includes("facilitar")) {
            // ✅ Actualizado: Pasar los datos de los programas a la función
            const resultados = encontrarPrograma(textoOriginal, programasData);

            if (resultados.length === 0) {
                // No se encontró programa, no hay respuesta del bot.
                return;
            }

            if (resultados.length === 1) {
                const p = resultados[0];

                // 8. 🚨 KPI: Identificar keyword usada para registrar
                let keywordUsed = null;
                // Priorización de keywords solicitadas:
                if (texto.includes("hola")) {
                    keywordUsed = 'hola';
                } else if (texto.includes("info")) {
                    keywordUsed = 'info';
                } else if (texto.includes("estoy")) {
                    keywordUsed = 'estoy';
                }

                // 9. 🚨 KPI: Registrar respuesta del bot, keyword (si existe), y el programa consultado
                recordMessage('responded', keywordUsed, p.PROGRAMA);


                // ✅ Reemplazar el saludo estático por el dinámico
                if (saludosData?.texto) {
                    await client.sendMessage(message.from, saludosData.texto);
                }

                if (p.PERSONALIZADO) {
                    await client.sendMessage(message.from, p.PERSONALIZADO);
                }

                const videoPath = p.VIDEO ? path.join(mediaPath, p.VIDEO) : null;
                const imagePath = p.POSTDOCEN ? path.join(mediaPath, p.POSTDOCEN) : null;
                const pdfPath = p.BROCHURE ? path.join(mediaPath, p.BROCHURE) : null;

                console.log("🔍 Buscando archivos para:", p.PROGRAMA);
                if (videoPath) console.log("👉 Ruta video:", videoPath);
                if (imagePath) console.log("👉 Ruta imagen:", imagePath);
                if (pdfPath) console.log("👉 Ruta PDF:", pdfPath);

                if (videoPath && fs.existsSync(videoPath)) {
                    console.log("✅ Video encontrado, enviando...");
                    const media = MessageMedia.fromFilePath(videoPath);
                    await client.sendMessage(message.from, media);
                } else if (imagePath && fs.existsSync(imagePath)) {
                    console.log("✅ Imagen encontrada, enviando...");
                    const media = MessageMedia.fromFilePath(imagePath);
                    await client.sendMessage(message.from, media);
                } else {
                    console.log("⚠️ No se encontró ni video ni imagen para:", p.PROGRAMA);
                }

                if (p.BENEFICIOS) {
                    await client.sendMessage(message.from, p.BENEFICIOS);
                }

                if (pdfPath && fs.existsSync(pdfPath)) {
                    console.log("✅ PDF encontrado, enviando...");
                    const media = MessageMedia.fromFilePath(pdfPath);
                    await client.sendMessage(message.from, media);
                } else {
                    console.log("⚠️ No se encontró PDF en:", pdfPath);
                }

                await enviarHorarios(client, message.from, p.PROGRAMA);

                if (perfilData?.texto) {
                    await client.sendMessage(message.from, perfilData.texto);
                } else {
                    // Si no se pudo leer el JSON, puedes enviar un mensaje de respaldo
                    await client.sendMessage(message.from, "🚨 *Para asesorarte y brindarte la INVERSIÓN del programa, por favor indícame tu perfil:* \n1) Soy egresado y quiero actualizarme\n2) Soy egresado y busco chamba\n3) Soy estudiante y quiero aprender más\n4) Soy estudiante y busco prácticas\n5) Soy independiente");
                }

                // ✅ CAMBIO CLAVE: Solo guardamos el nombre del programa y la edición
                // para poder buscar la versión más reciente en el siguiente mensaje.
                estadoUsuarios[numero] = {
                    estado: "esperandoPerfil",
                    nombrePrograma: p.PROGRAMA,
                    edicion: p.EDICION,
                    categoria: (p.CATEGORIA || "").toUpperCase()
                };
                return;
            }
        }
    } catch (error) {
        console.error("❌ Error procesando mensaje:", error);
        if (error.message.includes('Protocol error (Runtime.callFunctionOn)')) {
            console.log("🚨 Reintentando inicializar el cliente de WhatsApp en 10 segundos...");
            setTimeout(() => {
                client.initialize();
            }, 10000);
        }
    }
});

client.initialize();
