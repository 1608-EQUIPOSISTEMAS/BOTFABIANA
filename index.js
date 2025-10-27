const fs = require("fs");
const path = require("path");
const { MessageMedia } = require("whatsapp-web.js");

const { enviarHorarios } = require("./src/services/enviarHorarios");
const { crearCliente } = require("./src/bot/cliente");
const { normalizarTexto } = require("./src/utils/normalizar");
const { encontrarPrograma } = require("./src/services/encontrarPrograma");

// --- INICIALIZACIÓN DE SERVIDOR Y CLIENTE ---
const { iniciarServidor } = require("./src/dashboard/server");
iniciarServidor(); // Inicia el servidor

const client = crearCliente();
const estadoUsuarios = {}; // 🔹 Estado temporal para seguir conversaciones

// --- CONFIGURACIÓN DE RUTAS ---
const projectRoot = process.cwd();
const mediaPath = path.join(projectRoot, 'media');

const PATHS = {
    STATS: path.join(projectRoot, "src", "database", "stats.json"),
    PROGRAMAS: path.join(projectRoot, "src", "database", "programas.json"),
    PLUS: path.join(projectRoot, "src", "database", "plus.json"),
    SALUDOS: path.join(projectRoot, "src", "database", "saludos.json"),
    PERFIL: path.join(projectRoot, "src", "database", "perfil.json"),
    CTA: path.join(projectRoot, "src", "database", "cta.json"),
};

// --- ESTRUCTURA DE DATOS EN MEMORIA ---
let programasData = [];
let plusData = {};
let saludosData = {};
let perfilData = {};
let ctaData = {};
let statsEnMemoria = {};

// 📌 CONFIGURACIÓN DE ESTADÍSTICAS (KPIs) 📌
const DEFAULT_STATS = {
    "totalReceived": 0,
    "totalResponded": 0,
    "keywords": {
        "info": 0,
        "hola": 0,
        "estoy": 0
    },
    "programInquiries": {}
};

function loadStats() {
    try {
        const data = fs.readFileSync(PATHS.STATS, "utf8");
        statsEnMemoria = JSON.parse(data);
        // Asegura que la estructura base exista
        statsEnMemoria.keywords = statsEnMemoria.keywords || JSON.parse(JSON.stringify(DEFAULT_STATS.keywords));
        statsEnMemoria.programInquiries = statsEnMemoria.programInquiries || {};
    } catch (err) {
        console.error("❌ Error cargando stats.json. Inicializando por defecto:", err.message);
        statsEnMemoria = JSON.parse(JSON.stringify(DEFAULT_STATS));
    }
}

function saveStats() {
    try {
        fs.writeFileSync(PATHS.STATS, JSON.stringify(statsEnMemoria, null, 2), "utf8");
    } catch (err) {
        console.error("❌ Error guardando stats.json:", err.message);
    }
}

function recordMessage(type, keyword = null, programName = null) {
    if (type === 'received') {
        statsEnMemoria.totalReceived += 1;
    }

    if (type === 'responded') {
        statsEnMemoria.totalResponded += 1;

        if (keyword) {
            const key = keyword.toLowerCase().trim();
            if (statsEnMemoria.keywords.hasOwnProperty(key)) {
                statsEnMemoria.keywords[key] += 1;
            }
        }
    }

    if (programName) {
        const key = programName.toUpperCase().trim();
        statsEnMemoria.programInquiries[key] = (statsEnMemoria.programInquiries[key] || 0) + 1;
    }

    saveStats();
}

// ✅ Función para cargar todos los JSON al inicio (SOLUCIÓN AL PROBLEMA DE RENDIMIENTO)
function loadAllData() {
    try {
        programasData = JSON.parse(fs.readFileSync(PATHS.PROGRAMAS, "utf8"));
        plusData = JSON.parse(fs.readFileSync(PATHS.PLUS, "utf8"));
        saludosData = JSON.parse(fs.readFileSync(PATHS.SALUDOS, "utf8"));
        perfilData = JSON.parse(fs.readFileSync(PATHS.PERFIL, "utf8"));
        ctaData = JSON.parse(fs.readFileSync(PATHS.CTA, "utf8"));
        console.log("✅ Todos los datos JSON cargados correctamente en memoria.");
    } catch (error) {
        console.error("❌ Error al cargar datos JSON:", error.message);
        // Establecer valores por defecto si falla la carga de algún archivo crucial
        perfilData = {
            texto: "🚨 *Para asesorarte y brindarte la INVERSIÓN del programa, por favor indícame tu perfil:* \n1) Soy egresado...\n5) Soy independiente"
        };
    }
}

// --- FUNCIÓN DE UTILIDAD: DENTRO DE HORARIO ---
function estaDentroHorario() {
    const ahora = new Date();
    const opciones = { timeZone: "America/Lima", hour: "2-digit", hour12: false, weekday: "long" };
    const horaPeru = parseInt(ahora.toLocaleString("es-PE", opciones), 10);
    const dia = ahora.toLocaleDateString("es-PE", { timeZone: "America/Lima", weekday: "long" }).toLowerCase();

    const esFinDeSemana = (dia === "sábado" || dia === "domingo");

    if (!esFinDeSemana && horaPeru >= 9 && horaPeru < 18) { // Lunes a Viernes: 9am a 6pm
        return true;
    }
    if (esFinDeSemana && horaPeru >= 9 && horaPeru < 13) { // Sábado/Domingo: 9am a 1pm
        return true;
    }
    return false;
}

// 🚨 Cargar datos al inicio del bot
loadStats();
loadAllData();
// -----------------------------------------------------

client.on("message", async (message) => {
    try {
        // 1. Filtros y Registro
        recordMessage('received');

        if (message.from.includes("@g.us") || message.from.includes("@broadcast") || message.type !== "chat") {
            return;
        }

        const textoOriginal = (message.body || "").trim();
        const texto = normalizarTexto(textoOriginal);
        const numero = message.from;
        const nombre = message._data?.notifyName || "Sin nombre";

        console.log(`\n📩 Mensaje de ${nombre} (${numero}): ${textoOriginal}`);

        // --- FLUJO: 4. ESPERANDO DECISIÓN WEB (Seguimiento de 3 minutos) ---
        if (estadoUsuarios[numero]?.estado === "esperandoDecisionWeb") {
            // 1. Opcion: Sí, todo correcto (1)
            if (texto === "1") {
                await client.sendMessage(numero, `*¡Ya te hemos registrado al Programa!* 🚀\nRecuerda tener en cuenta lo siguiente 💙👇🏻`);

                // 1b. Enviar imagen de registro completo
                const IMAGEN_REGISTRO_PATH = path.join(mediaPath, "pago", "webins.jpg");
                if (fs.existsSync(IMAGEN_REGISTRO_PATH)) {
                    const media = MessageMedia.fromFilePath(IMAGEN_REGISTRO_PATH);
                    await client.sendMessage(numero, media);
                } else {
                    console.log("⚠️ No se encontró la imagen de registro completo.");
                }

                // 1c. Mensaje 3: Bienvenida y Links
                await client.sendMessage(numero, `*Bienvenid@ a la Comunidad WE* 💙\n¡Que disfrutes tu programa!\n\n📲 *Agéndanos en tus contactos* ...\n\n👩🏻‍💻 *Evalúa nuestra atención* 👉🏼 bit.ly/4azD6Z4\n\n👥 *Únete a nuestra Comunidad WE* 👉🏼 bit.ly/COMUNIDAD_WE \n\n¡Gracias por confiar en WE! 🚀`);

                // 1d. Mensaje 4: Promoción PLUS
                await client.sendMessage(numero, `💎 *Beneficio Exclusivo* 💎\n\nPor tu inscripción, adquiere la MEMBRESÍA PLUS, donde podrás acceder a *+50 Cursos y Especializaciones Online Certificados*, además de increíbles beneficios 📚⚡\n\n👉🏼 *Única Inversión > S/ 150* (Normal S/250)\n\nPuedes validarlo, para un amigo o familiar que también esté interesado en capacitarse 🚀\n\n _Válido por 3 días_ 📍`);

                recordMessage('responded');
                delete estadoUsuarios[numero]; // Limpieza final
                return;

                // 2. Opcion: Aún no, necesito ayuda (2)
            } else if (texto === "2") {
                const msgFuera = "✨ Genial, en un momento un asesor se comunicará contigo para resolver tus consultas 😄";
                const msgDentro = "⏰ ¡Estamos contentos de poder ayudarte en tu elección! Un asesor se comunicará contigo el día de *mañana*. Por favor, indícame un *horario* para que se contacte contigo. 🙋🏻‍♀️";

                // Se usa la lógica de horario para determinar si se comunica en un momento o mañana (asesor)
                await client.sendMessage(numero, estaDentroHorario() ? msgDentro : msgFuera);

                recordMessage('responded');
                delete estadoUsuarios[numero]; // Limpieza final
                return;

                // 3. Opcion: Respuesta inválida (BUG CORREGIDO)
            } else {
                return; // Mantiene el estado esperandoDecisionWeb
            }
        }

        // --- FLUJO: 3. ESPERANDO MÉTODO DE PAGO ---
        if (estadoUsuarios[numero]?.estado === "esperandoMetodoPago") {
            const { nombrePrograma, edicion } = estadoUsuarios[numero];

            // Re-busca el programa para obtener el ENLACE (solo si es necesario)
            const p = programasData.find(
                (pr) => normalizarTexto(pr.PROGRAMA) === normalizarTexto(nombrePrograma) &&
                    normalizarTexto(pr.EDICION) === normalizarTexto(edicion)
            );

            if (!p) {
                delete estadoUsuarios[numero];
                return;
            }

            const esEstudiante = estadoUsuarios[numero].esEstudiante;
            const categoria = estadoUsuarios[numero].categoria || "CURSO";
            const esCurso = categoria === "CURSO";

            const datosMsg = esEstudiante ?
                `*Bríndame por favor, los siguientes datos*:\n\n🔹DNI o CÉDULA:\n🔹Nombre completo:\n🔹Número de Celular:\n🔹Fecha de Inicio:\n🔹Correo (Gmail):\n🔹Foto de Voucher:\n🔹Foto de Intranet o Carnet Universitario:\n\nY listo! 🌟 Cuando realices el pago y envío de tus datos, me avisas para comentarte los siguientes detalles. 🙋🏻‍♀️💙` :
                `*Bríndame por favor, los siguientes datos*:\n\n🔹DNI o CÉDULA:\n🔹Nombre completo:\n🔹Número de Celular:\n🔹Fecha de Inicio:\n🔹Correo (Gmail):\n🔹Foto de Voucher:\n\nY listo! 🌟 Cuando realices el pago y envío de tus datos, me avisas para comentarte los siguientes detalles. 🙋🏻‍♀️💙`;

            // --- Pago 1: Yape ---
            if (texto.includes("1") || texto.includes("yape")) {
                await client.sendMessage(numero, `*Perfecto* ✨\n\nTe envío el número de Yape y Código QR 👇\n\n📲 999 606 366 // WE Educación Ejecutiva`);
                const nombreYape = esCurso ? "yapecursos.jpeg" : "yapeprog.jpeg";
                const rutaQR = path.join(mediaPath, "pago", nombreYape);

                if (fs.existsSync(rutaQR)) {
                    const media = MessageMedia.fromFilePath(rutaQR);
                    await client.sendMessage(numero, media);
                }

                await client.sendMessage(numero, datosMsg);
                recordMessage('responded');
                delete estadoUsuarios[numero];
                return;
            }

            // --- Pago 2: Depósito o Transferencia ---
            if (texto.includes("2") || texto.includes("bcp") || texto.includes("deposito") || texto.includes("transferencia")) {
                const mensajeDepo = esCurso ?
                    `¡Excelente! Te comparto los datos de nuestra cuenta para que realices la transferencia:\n\n🏛️ *Banco: BCP*\nNúmero de cuenta: 193-9914694-0-22\ny desde *otros Bancos*, puedes transferir a esta cuenta:\nCCI: 00219300991469402218\n\n*Titular*: WE Foundation` :
                    `¡Excelente! Te comparto los datos de nuestra cuenta para que realices la transferencia:\n\n🏛️ *Banco: BCP*\nNúmero de cuenta: 193-9285511-0-38\ny desde *otros Bancos*, puedes transferir a esta cuenta:\nCCI: 002-19300928551103810\n\n*Titular*: WE Educación Ejecutiva SAC`;

                await client.sendMessage(numero, mensajeDepo);
                await client.sendMessage(numero, datosMsg);
                recordMessage('responded');
                delete estadoUsuarios[numero];
                return;
            }

            // --- Pago 3: Web (Lógica original con seguimiento de 3 minutos) ---
            if (texto.includes("3") || texto.includes("web")) {
                if (!p.ENLACE) {
                    delete estadoUsuarios[numero];
                    return;
                }

                const mensajeTexto = `👉 “Perfecto, puedes hacer tu pago de manera rápida y 100% segura a través de nuestra web:\n\n🔗 ${p["ENLACE"]}\n\n💡 Ventaja: El pago se confirma al instante, tu matrícula queda asegurada y podrás acceder a tus cursos online gratuitos en el Campus Virtual W|E⚡”\n\n🚨Revisa los pasos del video 👇🏻 e inscríbete en menos de 1 minuto, fácil, rápido y seguro.\n\nY listo! 🌟 Cuando realices el pago y envío de tus datos, me avisas para comentarte los siguientes detalles. 🙋🏻‍♀️💙`;
                await client.sendMessage(numero, mensajeTexto);

                const rutaVideo = path.join(mediaPath, "videos", "WEB.mp4");
                if (fs.existsSync(rutaVideo)) {
                    const media = MessageMedia.fromFilePath(rutaVideo);
                    await client.sendMessage(numero, media);
                }

                recordMessage('responded');
                estadoUsuarios[numero].estado = "esperandoDecisionWeb";

                // Programar el mensaje de seguimiento (3 minutos)
                const followUpMessage = `💳 Cuentame, ¿Pudiste completar tu pago en el link web? 🌐\n\n1️⃣ Sí, todo correcto 🙌\n2️⃣ Aún no, necesito ayuda 🤔`;

                setTimeout(async () => {
                    try {
                        if (estadoUsuarios[numero]?.estado === "esperandoDecisionWeb") {
                            await client.sendMessage(numero, followUpMessage);
                            console.log(`✅ Mensaje de seguimiento enviado a ${numero}.`);
                        }
                    } catch (error) {
                        console.error(`❌ Error en el setTimeout para follow-up de ${numero}:`, error);
                    }
                }, 3 * 60 * 1000); // 3 minutos

                return;
            }
            // Respuesta Inválida
            return;
        }

        // --- FLUJO: 2. ESPERANDO DECISIÓN (Después de la Inversión) ---
        if (estadoUsuarios[numero]?.estado === "esperandoDecision") {
            const msgFuera = "✨ Genial, en un momento un asesor se comunicará contigo para resolver tus consultas 😄";
            const msgDentro = "⏰ ¡Estamos contentos de poder ayudarte en tu elección! Un asesor se comunicará contigo el día de *mañana*. Por favor, indícame un *horario* para que se contacte contigo. 🙋🏻‍♀️";

            switch (texto) {
                case "1":
                case "2": // Opción de inscripción
                    await client.sendMessage(numero, `*¡Perfecto!* La inscripción es muy sencilla 😇\n\nContamos con los siguientes MÉTODOS DE PAGO👇🏻\n\n1️⃣ Yape 📲\n2️⃣ Depósito o transferencia bancaria 🏛️\n3️⃣ Pago online vía Web 🌐(Aceptamos todas las tarjetas 💳)\n\nComéntame *¿Cuál sería tu mejor opción de pago?* 😊`);
                    estadoUsuarios[numero].estado = "esperandoMetodoPago";
                    recordMessage('responded');
                    return;

                case "3":
                case "4": // Opción de llamada/asesoría
                    await client.sendMessage(numero, estaDentroHorario() ? msgDentro : msgFuera);
                    delete estadoUsuarios[numero];
                    recordMessage('responded');
                    return;

                default:
                    return;
            }
        }

        // --- FLUJO: 1. ESPERANDO PERFIL (Respuesta 1-5) ---
        if (estadoUsuarios[numero]?.estado === "esperandoPerfil") {
            const { nombrePrograma, edicion } = estadoUsuarios[numero];

            // Re-busca el programa usando el nombre y la edición guardados
            const p = programasData.find(
                (pr) => normalizarTexto(pr.PROGRAMA) === normalizarTexto(nombrePrograma) &&
                    normalizarTexto(pr.EDICION) === normalizarTexto(edicion)
            );

            if (!p) {
                delete estadoUsuarios[numero];
                return;
            }

            let resKeyName = "";
            switch (texto) {
                case "1": resKeyName = "RES1"; break;
                case "2": resKeyName = "RES2"; break;
                case "3": resKeyName = "RES3"; break;
                case "4": resKeyName = "RES4"; break;
                case "5": resKeyName = "RES5"; break;
                default:
                    return;
            }

            // Enviar respuesta personalizada (RES1-RES5)
            const resValue = p[resKeyName];
            if (resValue) {
                await client.sendMessage(numero, resValue);
            }

            const esEstudiante = texto === "3" || texto === "4";
            const esCurso = (p.CATEGORIA || "").toUpperCase() === "CURSO";
            let inversionMsg = "";

            // ✅ INICIO: LÓGICA COMPLETA DE INVERSIÓN (RESTAURADA)
            if (esCurso) {
                if (esEstudiante) {
                    inversionMsg = `*Hasta el Viernes 31 de Octubre HalloW|E 👻🎃*

Opciones de pago:
1️⃣ *Al Contado* Ahorro máximo😉
🔥55% Dcto > S/ ${p["EXEST"]} ~(Normal S/ ${p["INV EST T"]})~

2️⃣ *En Cuotas sin intereses*
50% Dcto > S/ ${p["INV EST"]} ~(Normal S/ ${p["INV EST T"]})~
💳 Reserva con S/ ${p["RESEST"]}

*La inversión incluye el CERTIFICADO* 📚`;
                } else {
                    inversionMsg = `*Hasta el Viernes 31 de Octubre HalloW|E 👻🎃*

Opciones de pago:
1️⃣ *Al Contado* Ahorro máximo😉
🔥55% Dcto > S/ ${p["EXPRO"]} ~(Normal S/ ${p["INV PRO T"]})~

2️⃣ *En Cuotas sin intereses*
50% Dcto > S/ ${p["INV PRO"]} ~(Normal S/ ${p["INV PRO T"]})~
💳 Reserva con S/ ${p["RESPRO"]}

*La inversión incluye el CERTIFICADO* 📚`;
                }
            } else {
                // Es un "Programa" (no un Curso)
                if (esEstudiante) {
                    inversionMsg = `*Hasta el Viernes 31 de Octubre HalloW|E 👻🎃*

Facilidades de pago:
1️⃣ *En Cuotas sin Intereses* 
🔥50% Dcto > S/ ${p["INV EST"]} ~(Normal S/ ${p["INV EST T"]})~
💳 Reserva con S/ ${p["RESEST"]}

2️⃣ *Al Contado* Ahorro máximo😉
🔥55% Dcto > S/ ${p["EXEST"]} ~(Normal S/ ${p["INV EST T"]})~

*La inversión incluye el CERTIFICADO* 📚`;
                } else {
                    // Profesional (no estudiante)
                    inversionMsg = `*Hasta el Viernes 31 de Octubre HalloW|E 👻🎃*

Facilidades de pago:
1️⃣ *En Cuotas sin Intereses* 
🔥50% Dcto > S/ ${p["INV PRO"]} ~(Normal S/ ${p["INV PRO T"]})~
💳 Reserva con S/ ${p["RESPRO"]}

2️⃣ *Al Contado* Ahorro máximo😉
🔥55% Dcto > S/ ${p["EXPRO"]} ~(Normal S/ ${p["INV PRO T"]})~

*La inversión incluye el CERTIFICADO* 📚`;
                }
            }
            // ✅ FIN: LÓGICA COMPLETA DE INVERSIÓN (RESTAURADA)

            await client.sendMessage(numero, inversionMsg);

            // Enviar mensajes de seguimiento (PLUS y CTA)
            if (plusData?.texto) await client.sendMessage(numero, plusData.texto);
            if (ctaData?.texto) await client.sendMessage(numero, ctaData.texto);

            recordMessage('responded');

            // Actualizar estado para la siguiente decisión
            estadoUsuarios[numero] = {
                estado: "esperandoDecision",
                nombrePrograma: p.PROGRAMA,
                edicion: p.EDICION,
                esEstudiante,
                categoria: (p.CATEGORIA || "").toUpperCase()
            };
            return;
        }

        // --- FLUJO: 0. INICIO DE CONVERSACIÓN (Detectar programa) ---
        if (texto.includes("hola, estoy en") || texto.includes("info") || texto.includes("información") || texto.includes("facilitar")  || texto.includes("quiero") || texto.includes("quisiera")) {
            const resultados = encontrarPrograma(textoOriginal, programasData);

            if (resultados.length === 1) {
                const p = resultados[0];
                let keywordUsed = texto.includes("hola") ? 'hola' : texto.includes("info") ? 'info' : texto.includes("estoy") ? 'estoy' : texto.includes("quiero") ? 'quiero' : texto.includes("quisiera") ? 'quisiera' : null;
                recordMessage('responded', keywordUsed, p.PROGRAMA);

                // Enviar información del programa
                if (saludosData?.texto) await client.sendMessage(message.from, saludosData.texto);
                if (p.PERSONALIZADO) await client.sendMessage(message.from, p.PERSONALIZADO);

                // Envío de media (video, imagen, PDF)
                const videoPath = p.VIDEO ? path.join(mediaPath, p.VIDEO) : null;
                const imagePath = p.POSTDOCEN ? path.join(mediaPath, p.POSTDOCEN) : null;
                const pdfPath = p.BROCHURE ? path.join(mediaPath, p.BROCHURE) : null;

                if (videoPath && fs.existsSync(videoPath)) {
                    await client.sendMessage(message.from, MessageMedia.fromFilePath(videoPath));
                } else if (imagePath && fs.existsSync(imagePath)) {
                    await client.sendMessage(message.from, MessageMedia.fromFilePath(imagePath));
                }

                if (p.BENEFICIOS) await client.sendMessage(message.from, p.BENEFICIOS);

                if (pdfPath && fs.existsSync(pdfPath)) {
                    await client.sendMessage(message.from, MessageMedia.fromFilePath(pdfPath));
                }

                await enviarHorarios(client, message.from, p.PROGRAMA);

                // Pregunta de perfil
                const perfilMsg = perfilData?.texto || "🚨 *Para asesorarte y brindarte la INVERSIÓN del programa, por favor indícame tu perfil...*";
                await client.sendMessage(message.from, perfilMsg);

                // Guardar estado (solo el nombre y edición para buscar después)
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
        // Manejo de error de protocolo para intentar el reinicio
        if (error.message.includes('Protocol error (Runtime.callFunctionOn)')) {
            console.log("🚨 Reintentando inicializar el cliente de WhatsApp en 10 segundos...");
            setTimeout(() => {
                client.initialize();
            }, 10000);
        }
    }
});

client.initialize();