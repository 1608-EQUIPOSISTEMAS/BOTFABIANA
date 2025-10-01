// script.js
function showAlert(message, isSuccess = true) {
    const overlay = document.createElement('div');
    overlay.className = 'custom-alert-overlay';

    const iconClass = isSuccess ? 'success' : 'error';
    const icon = isSuccess ? '✅' : '❌';
    const title = isSuccess ? 'Éxito' : 'Error';

    overlay.innerHTML = `
        <div class="custom-alert-box">
            <div class="custom-alert-icon ${iconClass}">${icon}</div>
            <h4>${title}</h4>
            <p>${message}</p>
            <button class="custom-alert-button" onclick="hideAlert()">Aceptar</button>
        </div>
    `;

    document.body.appendChild(overlay);
    overlay.style.display = 'flex';
}
function hideAlert() {
    const overlay = document.querySelector('.custom-alert-overlay');
    if (overlay) {
        overlay.remove();
    }
}
let programasData = [];

// 📄 script.js (Nueva Función)

/**
 * Función encargada de dibujar las tarjetas de programas en el DOM.
 * @param {Array} programasArray - El array de programas a renderizar (puede ser completo o filtrado).
 */
function renderizarProgramas(programasArray) {
    const cardsContainer = document.getElementById("programas-cards");
    cardsContainer.innerHTML = ""; // Limpiar antes de dibujar

    if (!Array.isArray(programasArray) || programasArray.length === 0) {
        // En caso de que se llame con array vacío (p. ej., después de la búsqueda fallida)
        showAlert("No se encontraron programas para mostrar", false); 
        cardsContainer.style.display = "none";
        return;
    }
    
    // Aquí usamos programasData (la variable global) para encontrar el índice real 
    // en el array completo, lo cual es necesario para editar/eliminar con el PUT/DELETE de la API.

    const programasUnicos = {};
    programasArray.forEach(p => {
        // Encuentra el índice original en programasData para las acciones de edición/eliminación
        const indexReal = programasData.findIndex(item => item === p); 
        
        if (!programasUnicos[p.PROGRAMA]) {
            programasUnicos[p.PROGRAMA] = [];
        }
        // Usamos indexReal si existe, si no, usamos el -1 o el actual del loop (para el ejemplo)
        programasUnicos[p.PROGRAMA].push({ ...p, index: indexReal !== -1 ? indexReal : programasData.indexOf(p) }); 
    });

    Object.entries(programasUnicos).forEach(([nombre, ediciones], idx) => {
        const card = document.createElement("div");
        card.className = "programa-card";

        // 🚨 TODO ESTE CÓDIGO HTML ERA EL BLOQUE GRANDE QUE ESTABA EN cargarProgramas
        card.innerHTML = `
            <div class="programa-header">
                <div class="programa-nombre">${nombre}</div>
            </div>

            <div class="programa-acciones">
                <button class="programa-btn info-programa-btn" data-programa="${nombre}" style="margin-right:8px;">
                    ℹ️ Información de programa
                </button>
                <button class="programa-btn ver-ediciones-btn" style="margin-right:8px;">
                    📂 Ver ediciones
                </button>
                <button class="programa-btn agregar-edicion-btn" data-programa="${nombre}">
                    ➕ Agregar Edición
                </button>
            </div>

            <div class="ediciones" id="ediciones-${idx}" style="display:none; margin-top:10px;">
                ${ediciones.map(ed => `
                    <div class="programa-edicion" style="margin-top:8px;">
                        <div><b>${ed.EDICION}</b> — Inicio: ${ed.INICIO || "?"} — Docente: ${ed.DOCENTE || "?"}</div>
                        <div class="mini-form" id="form-${ed.index}" style="display:none; margin-top:8px; border:1px solid #ddd; padding:8px; border-radius:8px;">
                            <div class="programa-detalle">🗓 Edición: <input value="${ed.EDICION || ""}" data-field="EDICION"></div>
                            <div class="programa-detalle">🗓 Inicio: <input value="${ed.INICIO || ""}" data-field="INICIO"></div>
                            <div class="programa-detalle">🗓 Fin: <input value="${ed.FIN || ""}" data-field="FIN"></div>
                            <div class="programa-detalle">👨‍🏫 Docente: <input value="${ed.DOCENTE || ""}" data-field="DOCENTE"></div>
                            <div class="programa-detalle">🖼 Foto Docente: <input type="file" accept="image/*" data-field="POSTDOCEN">${ed.POSTDOCEN ? `<img src="/media/${ed.POSTDOCEN}" style="max-width:80px; margin-top:5px;">` : ""}</div>
                            <div class="programa-detalle">🎬 Video Promo: <input type="file" accept="video/*" data-field="VIDEO">${ed.VIDEO ? `<video src="/media/${ed.VIDEO}" controls style="max-width:120px; margin-top:5px;"></video>` : ""}</div>
                            <div style="margin-top:10px;">
                                <button class="programa-btn1 guardar-btn" data-index="${ed.index}">💾 Guardar</button>
                                <button class="programa-btn1 cancelar-btn" data-index="${ed.index}">❌ Cancelar</button>
                            </div>
                        </div>
                        <button class="programa-btn2 editar-btn" data-index="${ed.index}">✏️ Editar esta edición</button>
                        <button class="programa-btn2 eliminar-btn" data-index="${ed.index}">🗑️ Eliminar</button>
                    </div>
                `).join('')}
            </div>
        `;

        cardsContainer.appendChild(card);
    });
    
    // Si manejas los clics en el contenedor, vuelve a poner el escuchador:
    cardsContainer.addEventListener("click", manejarClick); 
    cardsContainer.style.display = "grid";
}

// 📄 script.js (Función cargarProgramas - Simplificada)

async function cargarProgramas() {
    const loading = document.getElementById("programas-loading");
    const error = document.getElementById("programas-error");
    const cardsContainer = document.getElementById("programas-cards");

    loading.style.display = "block";
    error.style.display = "none";
    cardsContainer.style.display = "none";
    
    try {
        const res = await fetch("/api/programas");
        const programas = await res.json();

        programasData = programas; // Almacena en la variable global

        if (!Array.isArray(programas) || programas.length === 0) {
            throw new Error("No hay programas disponibles");
        }

        // 🚨 USAR LA FUNCIÓN DE DIBUJADO COMPARTIDA 🚨
        renderizarProgramas(programasData); 

        loading.style.display = "none";
        
    } catch (err) {
        console.error("❌ Error cargando programas:", err);
        loading.style.display = "none";
        error.style.display = "block";
    }
}





async function manejarClick(e) {
    const target = e.target;
    if (target.classList.contains("ver-ediciones-btn")) {
        // 🟠 Usa .closest() para encontrar el ancestro más cercano con la clase .programa-card
        const card = target.closest(".programa-card");

        if (card) {
            // 🟢 Luego, busca el contenedor de ediciones dentro de esa tarjeta
            const edicionesDiv = card.querySelector(".ediciones");

            if (edicionesDiv) {
                // 🟢 Y finalmente, alterna la visibilidad y el texto del botón
                const isHidden = edicionesDiv.style.display === "none" || edicionesDiv.style.display === "";
                edicionesDiv.style.display = isHidden ? "block" : "none";
                target.textContent = isHidden ? "➖ Ocultar ediciones" : "📂 Ver ediciones";
            }
        }
    }
    // Lógica para el botón "Información de programa"
    else if (target.classList.contains("info-programa-btn")) {
        const programa = target.dataset.programa;
        const card = target.closest(".programa-card");
        const infoContainer = card.querySelector(".info-programa-container");

        // Cierra los demás desgloses, excepto el que vamos a abrir
        cerrarTodosLosDesgloses(infoContainer);

        mostrarInfoPrograma(programa, target.parentElement);
        target.textContent = "ℹ️ Información de programa";
    }
    else if (target.classList.contains("guardar-programa-btn")) {
        const programa = target.dataset.programa;
        const form = target.closest(".info-programa-container");
        await guardarInfoPrograma(programa, form);
    }
    else if (target.classList.contains("cancelar-programa-btn")) {
        const form = target.closest(".info-programa-container");
        if (form) form.remove();
    }
    else if (target.classList.contains("editar-btn")) {
        const index = target.dataset.index;
        const form = document.getElementById(`form-${index}`);
        if (form) {
            form.style.display = form.style.display === "none" ? "block" : "none";
        }
    }
    else if (target.classList.contains("cancelar-btn")) {
        const index = target.dataset.index;
        const form = document.getElementById(`form-${index}`);
        if (form) form.style.display = "none";
    }
    else if (target.classList.contains("guardar-btn")) {
        const index = target.dataset.index;
        const form = document.getElementById(`form-${index}`);
        if (form) {
            await guardar(index, form);
        }
    }
    else if (target.classList.contains("agregar-edicion-btn")) {
        const programa = target.dataset.programa;
        agregarEdicion(programa);
    }
    else if (target.classList.contains("eliminar-btn")) {
        const index = target.dataset.index;
        eliminarEdicion(index);
    }
    // Guardar nueva edición
    else if (target.classList.contains("guardar-nuevo-btn")) {
        const form = document.getElementById("add-form-container");
        if (form) {
            const programa = target.dataset.programa;
            await guardarNuevaEdicion(programa, form);
        }
    }
    // Cancelar nueva edición
    else if (target.classList.contains("cancelar-nuevo-btn")) {
        const container = document.getElementById("add-form-container");
        if (container) container.remove();
    }
}

// Agrega esta función fuera de manejarClick, en tu script principal
function cerrarTodosLosDesgloses(contenedorExcluido) {
    // Selecciona todos los contenedores de desglose
    const todosLosContenedores = document.querySelectorAll(".ediciones, .info-programa-container");

    // Itera sobre cada contenedor
    todosLosContenedores.forEach(contenedor => {
        // Si el contenedor no es el que estamos a punto de abrir, lo cerramos
        if (contenedor && contenedor !== contenedorExcluido) {
            contenedor.style.display = "none";

            // Encuentra el botón padre y resetea su texto
            const card = contenedor.closest(".programa-card");
            if (card) {
                // Restablece el botón de "Ver ediciones"
                const verEdicionesBtn = card.querySelector(".ver-ediciones-btn");
                if (verEdicionesBtn) {
                    verEdicionesBtn.textContent = "📂 Ver ediciones";
                }

                // Restablece el botón de "Información de programa"
                const infoProgramaBtn = card.querySelector(".info-programa-btn");
                if (infoProgramaBtn) {
                    infoProgramaBtn.textContent = "ℹ️ Información de programa";
                }
            }
        }
    });
}

async function mostrarInfoPrograma(nombrePrograma, cardElement) {
    // Si el formulario de edición ya está visible, lo ocultamos
    const formContainer = cardElement.querySelector('.info-programa-container');
    if (formContainer) {
        formContainer.remove();
        return;
    }

    try {
        // Usa los datos ya cargados en la variable global
        const programaInfo = programasData.find(p => p.PROGRAMA === nombrePrograma);

        if (!programaInfo) {
            throw new Error("Información del programa no encontrada.");
        }

        const infoHTML = `
            <div class="info-programa-container mini-form" style="margin-top:10px; padding:15px; border:1px solid #555; border-radius:10px; background-color:#333;">
                <div class="programa-detalle">
                    Descripción corta:
                    <textarea data-field="PERSONALIZADO" class="input-style" rows="5">${programaInfo.PERSONALIZADO || ""}</textarea>
                </div>
                <div class="programa-detalle">
                    Beneficios:
                    <textarea data-field="BENEFICIOS" class="input-style" rows="10">${programaInfo.BENEFICIOS || ""}</textarea>
                </div>
                <div class="programa-detalle">
                    Precio Profesional: <input type="number" value="${programaInfo["INV PRO T"] || ""}" data-field="INV PRO T" class="input-style">
                </div>
                <div class="programa-detalle">
                    Precio Estudiante: <input type="number" value="${programaInfo["INV EST T"] || ""}" data-field="INV EST T" class="input-style">
                </div>
                <div class="programa-detalle">
                    Respuesta al Perfil de Cliente -> Opc. 1):
                    <textarea data-field="BENEFICIOS" class="input-style" rows="10">${programaInfo.RES1 || ""}</textarea>
                </div>
                <div class="programa-detalle">
                    Respuesta al Perfil de Cliente -> Opc. 2):
                    <textarea data-field="BENEFICIOS" class="input-style" rows="10">${programaInfo.RES2 || ""}</textarea>
                </div>
                <div class="programa-detalle">
                    Respuesta al Perfil de Cliente -> Opc. 3):
                    <textarea data-field="BENEFICIOS" class="input-style" rows="10">${programaInfo.RES3 || ""}</textarea>
                </div>
                <div class="programa-detalle">
                    Respuesta al Perfil de Cliente -> Opc. 4):
                    <textarea data-field="BENEFICIOS" class="input-style" rows="10">${programaInfo.RES4 || ""}</textarea>
                </div>
                <div class="programa-detalle">
                    Respuesta al Perfil de Cliente -> Opc. 5:
                    <textarea data-field="BENEFICIOS" class="input-style" rows="10">${programaInfo.RES5 || ""}</textarea>
                </div>
                <div style="margin-top: 10px;">
                    <button class="programa-btn1 guardar-programa-btn" data-programa="${nombrePrograma}">💾 Guardar</button>
                    <button class="programa-btn1 cancelar-programa-btn">❌ Cancelar</button>
                </div>
                
            </div>
        `;
        cardElement.insertAdjacentHTML('beforeend', infoHTML);
    } catch (err) {
        console.error("❌ Error mostrando información del programa:", err);
        alert("❌ No se pudo cargar la información del programa.");
    }
}

async function guardarInfoPrograma(nombrePrograma, form) {
    const textareas = form.querySelectorAll("textarea");
    const inputs = form.querySelectorAll("input");
    const formData = {};

    textareas.forEach(textarea => {
        const field = textarea.dataset.field;
        formData[field] = textarea.value.trim();
    });

    inputs.forEach(input => {
        const field = input.dataset.field;
        formData[field] = input.value.trim();
    });

    try {
        const res = await fetch(`/api/programa/${nombrePrograma}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(formData)
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        showAlert("Información del programa actualizada correctamente", true); // ✅ Antes: alert("✅ Información...")
    } catch (err) {
        console.error("❌ Error al guardar la información del programa:", err);
        showAlert(`No se pudo actualizar la información del programa: ${err.message}`, false); // ✅ Antes: alert("❌ No se pudo...")
    }
}

function agregarEdicion(programa) {
    if (document.getElementById("add-form-container")) {
        alert("Ya hay un formulario de adición abierto. Por favor, ciérrelo primero.");
        return;
    }

    const formHTML = `
        <div id="add-form-container" class="mini-form" style="position:relative; margin-top:1rem; text-align:left;">
            <h4>➕ Agregar nueva edición a ${programa}</h4>
            <div class="programa-detalle">
                🗓 Edición: <input type="text" data-field="EDICION" placeholder="Ej: ED2025-dic-1">
            </div>
            <div class="programa-detalle">
                🗓 Inicio: <input type="text" data-field="INICIO" placeholder="Ej: Sábado 20 Diciembre">
            </div>
            <div class="programa-detalle">
                🗓 Fin: <input type="text" data-field="FIN" placeholder="Ej: Viernes 30 de Enero">
            </div>
            <div class="programa-detalle">
                👨‍🏫 Docente: <input type="text" data-field="DOCENTE" placeholder="Ej: Giancarlos Barboza">
            </div>
            <div class="programa-detalle">
                🖼 Foto Docente:
                <input type="file" accept="image/*" data-field="POSTDOCEN">
            </div>
            <div class="programa-detalle">
                🎬 Video Promo:
                <input type="file" accept="video/*" data-field="VIDEO">
            </div>
            <div style="margin-top:10px;">
                <button class="programa-btn guardar-nuevo-btn" data-programa="${programa}">💾 Guardar Nueva</button>
                <button class="programa-btn cancelar-nuevo-btn">❌ Cancelar</button>
            </div>
        </div>
    `;

    const card = document.querySelector(`.programa-card .agregar-edicion-btn[data-programa="${programa}"]`).parentElement;
    card.insertAdjacentHTML('beforeend', formHTML);
}

async function guardarNuevaEdicion(programa, form) {
    const inputs = form.querySelectorAll("input");
    const nuevaEdicion = { PROGRAMA: programa };
    const filesToUpload = {};

    for (const input of inputs) {
        const field = input.dataset.field;
        if (input.type === "file" && input.files.length > 0) {
            filesToUpload[field] = input.files[0];
        } else if (input.type !== "file") {
            nuevaEdicion[field] = input.value.trim();
        }
    }

    try {
        const res = await fetch("/api/programas", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(nuevaEdicion)
        });

        const data = await res.json();
        if (data.error) throw new Error(data.error);

        const programasActuales = await (await fetch("/api/programas")).json();
        const nuevoIndex = programasActuales.length - 1;

        // 3. Subir los archivos si existen, uno por uno
        for (const field in filesToUpload) {
            const file = filesToUpload[field];
            await subirArchivo(nuevoIndex, field, file);
        }

        alert("✅ Nueva edición agregada y archivos subidos correctamente");
        document.getElementById("add-form-container").remove();
    } catch (err) {
        console.error("❌ Error al guardar la nueva edición:", err);
        alert("❌ No se pudo agregar la nueva edición: " + err.message);
    }
}

async function eliminarEdicion(index) {
    if (!confirm("⚠️ ¿Estás seguro de que quieres eliminar esta edición? Esta acción no se puede deshacer.")) {
        return;
    }

    try {
        const res = await fetch(`/api/programas/${index}`, {
            method: "DELETE"
        });

        const data = await res.json();
        if (data.error) throw new Error(data.error);
        showAlert("Edición eliminada correctamente", true);
        // Opcional: Eliminar la tarjeta del DOM
        // const card = document.querySelector(`.editar-btn[data-index="${index}"]`).closest('.programa-edicion');
        // if (card) card.remove();
    } catch (err) {
        console.error("❌ Error al eliminar edición:", err);
        showAlert(`No se pudo eliminar la edición: ${err.message}`, false); // ✅ Antes: alert("❌ No se pudo...")
    }
}

// ===== Subir archivo y actualizar el JSON =====
async function subirArchivo(index, field, file) {
    const formData = new FormData();
    formData.append('file', file);

    try {
        const res = await fetch(`/api/upload/${index}/${field}`, {
            method: "POST",
            body: formData
        });

        if (!res.ok) {
            const errorText = await res.text(); // Leer la respuesta como texto
            throw new Error(errorText);
        }

        const data = await res.json();
        if (data.error) throw new Error(data.error);
        return data.file; // Retorna el nombre del archivo guardado
    } catch (err) {
        console.error(`❌ Error subiendo ${field}:`, err);
        alert(`❌ No se pudo subir el archivo: ${err.message}`);
        return null;
    }
}

// ===== Guardar edición (CORREGIDA) =====
async function guardar(index, form) {
    const inputs = form.querySelectorAll("input");
    const formData = {};
    const filesToUpload = {};

    // 1. Recolectar datos y archivos de los inputs
    for (const input of inputs) {
        const field = input.dataset.field;
        if (input.type === "file" && input.files.length > 0) {
            filesToUpload[field] = input.files[0];
        } else if (input.type !== "file") {
            formData[field] = input.value.trim();
        }
    }

    try {
        // 2. Subir los archivos primero, si existen
        for (const field in filesToUpload) {
            const file = filesToUpload[field];
            const nuevoNombre = await subirArchivo(index, field, file);
            if (nuevoNombre) {
                formData[field] = nuevoNombre;
            }
        }

        // 3. Enviar la solicitud PUT con los datos de texto y los nombres de archivos actualizados
        const res = await fetch(`/api/programas/${index}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(formData)
        });

        const data = await res.json();
        if (data.error) throw new Error(data.error);
        showAlert("Edición actualizada correctamente", true);
        // Oculta el formulario de edición
        form.style.display = 'none';
    } catch (err) {
        console.error("❌ Error al guardar:", err);
        alert("❌ No se pudo actualizar la edición: " + err.message);
    }
}

// ===== Funciones de interfaz de usuario =====
function showSection(seccion) {
    const secciones = document.querySelectorAll(".content-section");
    const botones = document.querySelectorAll(".nav-btn");

    secciones.forEach(s => s.classList.remove("active"));
    botones.forEach(b => b.classList.remove("active"));

    if (seccion === "programas") {
        document.getElementById("programas-section").classList.add("active");
        botones[0].classList.add("active");
        cargarProgramas();
    } else if (seccion === "mensajes-globales") {
        // ✅ Carga ambas funciones cuando se selecciona la sección
        document.getElementById("mensajes-globales-section").classList.add("active");
        botones[1].classList.add("active");
        cargarSaludos();
        cargarPlus();
        cargarPerfil();
        cargarCta();
    } else if (seccion === "otros") {
        // ✅ Carga ambas funciones cuando se selecciona la sección
        document.getElementById("otros-section").classList.add("active");
        botones[2].classList.add("active");
        cargarDescuentos();
    }
}

function buscarProgramas() {
    const termino = document.getElementById("busqueda-programa").value.toLowerCase();
    const cardsContainer = document.getElementById("programas-cards");

    // Limpia las tarjetas
    cardsContainer.innerHTML = "";

    // Si no hay término, mostramos todo de nuevo
    if (!termino.trim()) {
        programasData.length ? renderizarProgramas(programasData) : showAlert("No hay programas cargados", false);
        return;
    }

    // Filtrar programas que coincidan con el texto
    const filtrados = programasData.filter(p =>
        p.PROGRAMA.toLowerCase().includes(termino)
    );

    if (filtrados.length === 0) {
        showAlert("⚠️ No se encontraron programas con ese nombre", false);
    } else {
        renderizarProgramas(filtrados);
    }
}

// ✅ Funciones para el Saludo
async function cargarSaludos() {
    const textarea = document.getElementById("saludos-texto");
    const statusMsg = document.getElementById("saludos-status-msg");
    statusMsg.textContent = "Cargando...";
    try {
        const res = await fetch("/api/saludos"); // <-- aquí ya relativo
        if (!res.ok) throw new Error("Error al cargar saludos");
        const data = await res.json();
        textarea.value = data.texto;
        statusMsg.textContent = "✅ Saludo cargado correctamente";
        statusMsg.style.color = "var(--color-success)";
    } catch (err) {
        console.error("❌ Error cargando saludo:", err);
        statusMsg.textContent = `❌ No se pudo cargar el saludo: ${err.message}`;
        statusMsg.style.color = "var(--color-danger)";
    }
}

async function guardarSaludos() {
    const textarea = document.getElementById("saludos-texto");
    const statusMsg = document.getElementById("saludos-status-msg");
    const texto = textarea.value.trim();
    statusMsg.textContent = "Guardando...";
    try {
        const res = await fetch("/api/saludos", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ texto })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        statusMsg.textContent = "✅ Saludo actualizado correctamente";
        statusMsg.style.color = "var(--color-success)";
    } catch (err) {
        console.error("❌ Error guardando saludo:", err);
        statusMsg.textContent = `❌ No se pudo guardar el saludo: ${err.message}`;
        statusMsg.style.color = "var(--color-danger)";
    }
}

async function cargarPlus() {
    const textarea = document.getElementById("plus-texto");
    const statusMsg = document.getElementById("plus-status-msg");
    statusMsg.textContent = "Cargando...";

    try {
        const res = await fetch("/api/plus");
        if (!res.ok) {
            throw new Error("Error al cargar el mensaje global");
        }
        const data = await res.json();
        textarea.value = data.texto;
        statusMsg.textContent = "✅ Mensaje global cargado correctamente";
        statusMsg.style.color = "var(--color-success)";
    } catch (err) {
        console.error("❌ Error cargando mensaje global:", err);
        statusMsg.textContent = `❌ No se pudo cargar el mensaje global: ${err.message}`;
        statusMsg.style.color = "var(--color-danger)";
    }
}

async function guardarPlus() {
    const textarea = document.getElementById("plus-texto");
    const statusMsg = document.getElementById("plus-status-msg");
    const texto = textarea.value.trim();
    statusMsg.textContent = "Guardando...";

    try {
        const res = await fetch("/api/plus", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ texto })
        });
        const data = await res.json();
        if (data.error) {
            throw new Error(data.error);
        }
        statusMsg.textContent = "✅ Mensaje global actualizado correctamente";
        statusMsg.style.color = "var(--color-success)";
    } catch (err) {
        console.error("❌ Error guardando mensaje global:", err);
        statusMsg.textContent = `❌ No se pudo guardar el mensaje global: ${err.message}`;
        statusMsg.style.color = "var(--color-danger)";
    }
}

async function cargarPerfil() {
    const textarea = document.getElementById("perfil-texto");
    const statusMsg = document.getElementById("perfil-status-msg");
    statusMsg.textContent = "Cargando...";

    try {
        const res = await fetch("/api/perfil");
        if (!res.ok) {
            throw new Error("Error al cargar el mensaje de perfil");
        }
        const data = await res.json();
        textarea.value = data.texto;
        statusMsg.textContent = "✅ Mensaje de perfil cargado correctamente";
        statusMsg.style.color = "var(--color-success)";
    } catch (err) {
        console.error("❌ Error cargando mensaje de perfil:", err);
        statusMsg.textContent = `❌ No se pudo cargar el mensaje de perfil: ${err.message}`;
        statusMsg.style.color = "var(--color-danger)";
    }
}

async function guardarPerfil() {
    const textarea = document.getElementById("perfil-texto");
    const statusMsg = document.getElementById("perfil-status-msg");
    const texto = textarea.value.trim();
    statusMsg.textContent = "Guardando...";

    try {
        const res = await fetch("/api/perfil", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ texto })
        });
        const data = await res.json();
        if (data.error) {
            throw new Error(data.error);
        }
        statusMsg.textContent = "✅ Mensaje de perfil actualizado correctamente";
        statusMsg.style.color = "var(--color-success)";
    } catch (err) {
        console.error("❌ Error guardando mensaje de perfil:", err);
        statusMsg.textContent = `❌ No se pudo guardar el mensaje de perfil: ${err.message}`;
        statusMsg.style.color = "var(--color-danger)";
    }
}

async function cargarCta() {
    const textarea = document.getElementById("cta-texto");
    const statusMsg = document.getElementById("cta-status-msg");
    statusMsg.textContent = "Cargando...";

    try {
        const res = await fetch("/api/cta");
        if (!res.ok) {
            throw new Error("Error al cargar el mensaje de cta");
        }
        const data = await res.json();
        textarea.value = data.texto;
        statusMsg.textContent = "✅ Mensaje de cta cargado correctamente";
        statusMsg.style.color = "var(--color-success)";
    } catch (err) {
        console.error("❌ Error cargando mensaje de cta:", err);
        statusMsg.textContent = `❌ No se pudo cargar el mensaje de cta: ${err.message}`;
        statusMsg.style.color = "var(--color-danger)";
    }
}

async function guardarCta() {
    const textarea = document.getElementById("cta-texto");
    const statusMsg = document.getElementById("cta-status-msg");
    const texto = textarea.value.trim();
    statusMsg.textContent = "Guardando...";

    try {
        const res = await fetch("/api/cta", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ texto })
        });
        const data = await res.json();
        if (data.error) {
            throw new Error(data.error);
        }
        statusMsg.textContent = "✅ Mensaje de cta actualizado correctamente";
        statusMsg.style.color = "var(--color-success)";
    } catch (err) {
        console.error("❌ Error guardando mensaje de cta:", err);
        statusMsg.textContent = `❌ No se pudo guardar el mensaje de cta: ${err.message}`;
        statusMsg.style.color = "var(--color-danger)";
    }
}

// Añade esta función en tu script.js
async function cargarDescuentos() {
    const cuotaInput = document.getElementById("descuento-cuota");
    const campanaInput = document.getElementById("descuento-campana");
    const statusMsg = document.getElementById("descuentos-status-msg");
    statusMsg.textContent = "Cargando...";

    try {
        const res = await fetch("/api/descuentos");
        if (!res.ok) throw new Error("Error al cargar los descuentos.");
        const data = await res.json();
        cuotaInput.value = data.cuota;
        campanaInput.value = data.campana;
        statusMsg.textContent = "✅ Descuentos cargados correctamente.";
        statusMsg.style.color = "var(--color-success)";
    } catch (err) {
        console.error("❌ Error cargando descuentos:", err);
        statusMsg.textContent = `❌ No se pudo cargar los descuentos: ${err.message}`;
        statusMsg.style.color = "var(--color-danger)";
    }
}

// Añade esta función en tu script.js
async function guardarDescuentos() {
    const cuotaInput = document.getElementById("descuento-cuota");
    const campanaInput = document.getElementById("descuento-campana");
    const statusMsg = document.getElementById("descuentos-status-msg");

    const cuota = parseInt(cuotaInput.value);
    const campana = parseInt(campanaInput.value);

    // Validación básica
    if (isNaN(cuota) || isNaN(campana) || cuota < 0 || campana < 0) {
        showAlert("Por favor, ingrese valores numéricos válidos (0-100).", false);
        return;
    }

    statusMsg.textContent = "Guardando y actualizando precios...";
    try {
        const res = await fetch("/api/descuentos", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cuota, campana })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);

        showAlert("Descuentos y precios de programas actualizados correctamente.", true);
        cargarProgramas(); // Opcional: recargar la lista de programas para ver los precios nuevos.

    } catch (err) {
        console.error("❌ Error guardando descuentos:", err);
        showAlert(`No se pudo guardar los descuentos: ${err.message}`, false);
    }
}
window.hideAlert = hideAlert;

// Este bloque de código ahora está DENTRO de DOMContentLoaded para asegurar que 'busqueda-programa' existe.
// (Lo he borrado de aquí y lo he puesto más abajo en la posición lógica)

document.addEventListener("DOMContentLoaded", () => {
    
    // --- LÓGICA DE BÚSQUEDA Y PROGRAMAS ---
    const btnBuscar = document.getElementById("btn-buscar-programa");
    const inputBuscar = document.getElementById("busqueda-programa");

    // 🚨 CORRECCIÓN 1: El keypress que fallaba ahora está dentro de la verificación del input.
    // También verifica si el input existe antes de usarlo.
    if (inputBuscar) {
        // Bloque original que fallaba (ahora corregido y dentro de DOMContentLoaded)
        inputBuscar.addEventListener("keypress", function (e) {
            if (e.key === "Enter") {
                buscarProgramas();
            }
        });
        
        // Bloque de keyup que ya estaba:
        inputBuscar.addEventListener("keyup", (e) => {
            if (e.key === "Enter") {
                buscarProgramas();
            }
        });
    }

    if (btnBuscar) {
        btnBuscar.addEventListener("click", buscarProgramas);
    }
    
    // 🚨 CORRECCIÓN DE SINTAXIS: La llave que cerraba prematuramente ha sido eliminada.
    // El resto del código ahora se ejecuta correctamente.
    
    // Muestra la sección de "programas" al cargar la página
    showSection("programas");
    cargarProgramas();
    cargarSaludos();
    cargarPlus();
    cargarPerfil();
    cargarCta();

    // --- CONEXIÓN DE BOTONES DE CONFIGURACIÓN ---
    
    // Botones Saludos
    // NOTA: Usamos una verificación simple, ya que si falla aquí, el error debe ser visible.
    document.getElementById("guardar-saludos-btn")?.addEventListener("click", guardarSaludos);
    document.getElementById("recargar-saludos-btn")?.addEventListener("click", cargarSaludos);

    // Botones Plus
    document.getElementById("guardar-plus-btn")?.addEventListener("click", guardarPlus);
    document.getElementById("recargar-plus-btn")?.addEventListener("click", cargarPlus);

    // Botones Perfil
    document.getElementById("guardar-perfil-btn")?.addEventListener("click", guardarPerfil);
    document.getElementById("recargar-perfil-btn")?.addEventListener("click", cargarPerfil);

    // Botones CTA
    document.getElementById("guardar-cta-btn")?.addEventListener("click", guardarCta);
    document.getElementById("recargar-cta-btn")?.addEventListener("click", cargarCta);

    // Conecta los botones de descuentos
    document.getElementById("guardar-descuentos-btn")?.addEventListener("click", guardarDescuentos);
    document.getElementById("recargar-descuentos-btn")?.addEventListener("click", cargarDescuentos);

    // --- LÓGICA DEL BOTÓN DE REINICIO ---
    const restartBtn = document.getElementById('restart-bot-btn');
    const statusMsg = document.getElementById('restart-status-msg');

    if (restartBtn) {
        restartBtn.addEventListener('click', async () => {
            if (confirm('¿Estás seguro de que quieres reiniciar el bot? Esto puede tomar unos segundos.')) {
                restartBtn.disabled = true;
                statusMsg.textContent = 'Reiniciando... por favor espera.';

                try {
                    const response = await fetch('/api/restart-bot', { method: 'POST' });
                    if (response.ok) {
                        statusMsg.textContent = '✅ Bot reiniciado exitosamente. Espera el QR en la consola.';
                    } else {
                        statusMsg.textContent = '❌ Error al reiniciar el bot.';
                    }
                } catch (error) {
                    console.error('Error al enviar solicitud de reinicio:', error);
                    statusMsg.textContent = '❌ Error de conexión con el servidor.';
                } finally {
                    restartBtn.disabled = false;
                    setTimeout(() => {
                        statusMsg.textContent = '';
                    }, 9000);
                }
            }
        });
    }
}); // Cierre final de DOMContentLoaded (Posición correcta)