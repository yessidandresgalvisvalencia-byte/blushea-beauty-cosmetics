"use strict";

/* =========================================================
   BLUSHÉA — CATÁLOGO
   Variantes visuales + filtros + carrito
   ========================================================= */

const contenedorProductos =
  document.getElementById("listaProductos");

const buscador =
  document.getElementById("buscadorProductos");

const filtroCategoria =
  document.getElementById("filtroCategoria");

const catalogStatus =
  document.getElementById("catalogStatus");

const contadorCarrito =
  document.getElementById("contadorCarrito");


let productosGlobales = [];


/* =========================================================
   UTILIDADES
   ========================================================= */

function escaparHTML(valor) {
  return String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


function formatearPrecio(valor) {
  const numero = Number(valor);

  if (!Number.isFinite(numero)) {
    return "$0 COP";
  }

  return `$${numero.toLocaleString("es-CO")} COP`;
}


function obtenerImagenProducto(producto) {
  if (
    producto?.imagen &&
    String(producto.imagen).trim()
  ) {
    return String(producto.imagen);
  }

  return "";
}


/* =========================================================
   VARIANTES

   Formato nuevo esperado desde index.js:

   variantes: [
     {
       nombre: "Rosado",
       imagen: "/uploads/rosa.webp"
     },
     {
       nombre: "Negro",
       imagen: "/uploads/negro.webp"
     }
   ]

   También conserva compatibilidad con los productos
   antiguos que solo tenían producto.tonos.
   ========================================================= */

function obtenerVariantes(producto) {

  /* -------------------------------------------------------
     SISTEMA NUEVO
     ------------------------------------------------------- */

  if (
    Array.isArray(producto?.variantes) &&
    producto.variantes.length > 0
  ) {
    return producto.variantes
      .filter(variante =>
        variante &&
        variante.nombre
      )
      .map(variante => ({
        nombre: String(variante.nombre),
        imagen:
          String(
            variante.imagen ||
            producto.imagen ||
            ""
          )
      }));
  }


  /* -------------------------------------------------------
     COMPATIBILIDAD CON PRODUCTOS ANTIGUOS
     ------------------------------------------------------- */

  if (
    producto?.tieneTonos &&
    Array.isArray(producto.tonos) &&
    producto.tonos.length > 0
  ) {
    return producto.tonos.map(tono => ({
      nombre: String(tono),
      imagen: String(producto.imagen || "")
    }));
  }


  return [];
}


/* =========================================================
   CONTADOR DEL CARRITO
   ========================================================= */

function actualizarContadorCarrito() {

  if (!contadorCarrito) {
    return;
  }

  try {
    const carrito =
      JSON.parse(
        localStorage.getItem("carritoBlushea")
      ) || [];

    const cantidad =
      Array.isArray(carrito)
        ? carrito.reduce(
            (total, item) =>
              total + (Number(item.cantidad) || 0),
            0
          )
        : 0;

    contadorCarrito.textContent =
      String(cantidad);

    contadorCarrito.hidden =
      cantidad <= 0;


  } catch (error) {
    console.error(
      "Error leyendo carrito:",
      error
    );

    contadorCarrito.textContent = "0";
    contadorCarrito.hidden = true;
  }
}



/* =========================================================
   NAVEGACIÓN ACTIVA SEGÚN LA SECCIÓN VISIBLE
   ========================================================= */

function activarNavegacionPorSeccion() {
  const enlaces = Array.from(document.querySelectorAll(".nav [data-nav-section]"));
  const secciones = ["inicio", "productos", "contacto"]
    .map(id => document.getElementById(id))
    .filter(Boolean);

  const marcar = id => {
    enlaces.forEach(enlace => {
      enlace.classList.toggle("is-active", enlace.dataset.navSection === id);
    });
  };

  const desdeHash = () => {
    const id = window.location.hash.replace("#", "");
    marcar(["productos", "contacto"].includes(id) ? id : "inicio");
  };

  enlaces.forEach(enlace => {
    if (enlace.dataset.navSection !== "carrito") {
      enlace.addEventListener("click", () => marcar(enlace.dataset.navSection));
    }
  });

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(entradas => {
      const visibles = entradas
        .filter(entrada => entrada.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
      if (visibles[0]) marcar(visibles[0].target.id);
    }, { rootMargin: "-25% 0px -55% 0px", threshold: [0.01, 0.25, 0.5] });

    secciones.forEach(seccion => observer.observe(seccion));
  }

  window.addEventListener("hashchange", desdeHash);
  desdeHash();
}

activarNavegacionPorSeccion();

/* =========================================================
   CARGAR PRODUCTOS
   ========================================================= */

async function cargarProductos() {

  if (!contenedorProductos) {
    return;
  }

  contenedorProductos.innerHTML = `
    <div class="empty-state">
      <h3>Cargando productos...</h3>
      <p>Estamos preparando el catálogo.</p>
    </div>
  `;

  try {

    const respuesta =
      await fetch(
        "/api/productos",
        {
          cache: "no-store"
        }
      );

    if (!respuesta.ok) {
      throw new Error(
        "No fue posible cargar los productos."
      );
    }

    const resultado =
      await respuesta.json();

    if (!Array.isArray(resultado)) {
      throw new Error(
        "El servidor devolvió un formato inválido."
      );
    }

    productosGlobales =
      resultado;

    pintarProductos(
      productosGlobales
    );

  } catch (error) {

    console.error(
      "Error cargando productos:",
      error
    );

    contenedorProductos.innerHTML = `
      <div class="empty-state">
        <h3>No pudimos cargar los productos</h3>

        <p>
          Intenta nuevamente en unos segundos.
        </p>

        <button
          type="button"
          id="reintentarCatalogo"
          class="btn-primary"
        >
          Intentar nuevamente
        </button>
      </div>
    `;

    document
      .getElementById("reintentarCatalogo")
      ?.addEventListener(
        "click",
        cargarProductos
      );
  }
}


/* =========================================================
   CREAR BOTONES DE VARIANTES
   ========================================================= */

function crearVariantesHTML(
  producto,
  variantes
) {

  if (!variantes.length) {
    return "";
  }

  return `
    <div class="catalog-variants">

      <div class="catalog-variants-heading">

        <span>
          Color
        </span>

        <strong
          class="catalog-selected-variant"
          data-selected-variant
        >
          ${escaparHTML(variantes[0].nombre)}
        </strong>

      </div>


      <div
        class="catalog-variant-list"
        role="group"
        aria-label="Colores disponibles para ${escaparHTML(producto.nombre)}"
      >

        ${variantes.map(
          (variante, index) => `

            <button
              type="button"
              class="catalog-variant-button ${index === 0 ? "is-selected" : ""}"
              data-variant-index="${index}"
              aria-pressed="${index === 0 ? "true" : "false"}"
              title="${escaparHTML(variante.nombre)}"
            >

              <span class="catalog-variant-dot"></span>

              <span>
                ${escaparHTML(variante.nombre)}
              </span>

            </button>

          `
        ).join("")}

      </div>

    </div>
  `;
}


/* =========================================================
   PINTAR PRODUCTOS
   ========================================================= */

function pintarProductos(productos) {

  if (!contenedorProductos) {
    return;
  }

  contenedorProductos.innerHTML = "";


  /* -------------------------------------------------------
     ESTADO VACÍO
     ------------------------------------------------------- */

  if (
    !Array.isArray(productos) ||
    productos.length === 0
  ) {

    contenedorProductos.innerHTML = `
      <div class="empty-state">

        <h3>
          No encontramos productos
        </h3>

        <p>
          Prueba con otra búsqueda o categoría.
        </p>

      </div>
    `;

    if (catalogStatus) {
      catalogStatus.textContent =
        "0 productos encontrados";
    }

    return;
  }


  if (catalogStatus) {
    catalogStatus.textContent =
      `${productos.length} ${
        productos.length === 1
          ? "producto encontrado"
          : "productos encontrados"
      }`;
  }


  /* -------------------------------------------------------
     CREAR CADA PRODUCTO
     ------------------------------------------------------- */

  productos.forEach(producto => {


    const variantes =
      obtenerVariantes(producto);


    /*
     * Si tiene variantes, la primera fotografía
     * será la imagen inicial del catálogo.
     */

    const imagenInicial =
      variantes.length > 0
        ? variantes[0].imagen
        : obtenerImagenProducto(producto);


    const nombre =
      escaparHTML(
        producto.nombre ||
        "Producto"
      );


    const categoria =
      escaparHTML(
        producto.categoria ||
        "Producto"
      );


    const descripcion =
      escaparHTML(
        producto.descripcion ||
        ""
      );


    const precio =
      Number(producto.precio) || 0;


    const stock =
      Math.max(
        0,
        Number(producto.stock) || 0
      );


    const agotado =
      stock <= 0 || !(precio > 0);

    const pendiente = producto.proximamente === true;


    const tarjeta =
      document.createElement("article");


    tarjeta.className =
      "product-card";


    tarjeta.dataset.productId =
      String(producto.id);


    /*
     * Guardamos temporalmente la variante
     * seleccionada dentro de la tarjeta.
     */

    tarjeta.dataset.selectedVariant =
      variantes.length > 0
        ? variantes[0].nombre
        : "";


    tarjeta.innerHTML = `

      <!-- ===============================================
           IMAGEN
           =============================================== -->

      <a
        href="${crearURLProducto(
          producto.id,
          variantes[0]?.nombre || ""
        )}"
        class="product-image-link"
        data-product-link
        aria-label="Ver ${nombre}"
      >

        <div class="product-image">

          ${
            imagenInicial
              ? `
                <img
                  src="${escaparHTML(imagenInicial)}"
                  alt="${nombre}${
                    variantes.length
                      ? ` - ${escaparHTML(variantes[0].nombre)}`
                      : ""
                  }"
                  loading="lazy"
                  data-product-image
                >
              `
              : `
                <div class="product-image-placeholder">
                  <span>${pendiente ? "FOTO PRÓXIMAMENTE" : "BLUSHÉA"}</span>
                </div>
              `
          }

          ${
            agotado
              ? `
                <span class="product-sold-out">
                  ${pendiente ? "PRÓXIMAMENTE" : "AGOTADO"}
                </span>
              `
              : ""
          }

        </div>

      </a>



      <!-- ===============================================
           INFORMACIÓN
           =============================================== -->

      <div class="product-info">

        <span class="product-category">
          ${categoria}
        </span>


        <h3>
          ${nombre}
        </h3>


        ${
          descripcion
            ? `
              <p class="product-description">
                ${descripcion}
              </p>
            `
            : ""
        }



        <!-- =============================================
             VARIANTES
             ============================================= -->

        ${crearVariantesHTML(
          producto,
          variantes
        )}



        <!-- =============================================
             PRECIO Y STOCK
             ============================================= -->

        ${producto.precioPrueba ? '<p class="product-description"><strong>PRECIO DE PRUEBA · No disponible para compra real</strong></p>' : ""}

        <div class="product-meta">

          <strong>
            ${pendiente ? "Precio por confirmar" : formatearPrecio(precio)}
          </strong>

          <small class="${agotado ? "stock-out" : "stock-ok"}">

            ${
              agotado
                ? (pendiente ? "En preparación" : "Agotado")
                : stock <= 3
                  ? `Solo quedan ${stock}`
                  : "Disponible"
            }

          </small>

        </div>



        <!-- =============================================
             ACCIONES
             ============================================= -->

        <div class="product-actions">

          <a
            href="${crearURLProducto(
              producto.id,
              variantes[0]?.nombre || ""
            )}"
            class="btn-card"
            data-product-link
          >
            Ver producto
          </a>

          <a
            href="${crearWhatsApp(
              producto,
              variantes[0]?.nombre || ""
            )}"
            target="_blank"
            rel="noopener noreferrer"
            class="btn-card-outline"
            data-whatsapp-link
          >
            WhatsApp
          </a>

          <button
            type="button"
            class="btn-card"
            data-add-cart
            ${agotado ? "disabled aria-disabled=\"true\"" : ""}
          >
            Agregar al carrito
          </button>

        </div>

      </div>

    `;


    contenedorProductos.appendChild(
      tarjeta
    );


    /*
     * Activamos la lógica específica de
     * esta tarjeta.
     */

    activarVariantesTarjeta(
      tarjeta,
      producto,
      variantes
    );

    activarAgregarCarritoTarjeta(
      tarjeta,
      producto,
      variantes
    );

  });
}


/* =========================================================
   AGREGAR AL CARRITO DESDE EL CATÁLOGO
   ========================================================= */

function activarAgregarCarritoTarjeta(tarjeta, producto, variantes) {
  const boton = tarjeta.querySelector("[data-add-cart]");

  if (!boton || boton.disabled) {
    return;
  }

  boton.addEventListener("click", () => {
    const tono = tarjeta.dataset.selectedVariant || variantes[0]?.nombre || "";

    if (variantes.length > 0 && !tono) {
      return;
    }

    let carrito = [];

    try {
      const guardado = JSON.parse(localStorage.getItem("carritoBlushea"));
      carrito = Array.isArray(guardado) ? guardado : [];
    } catch (error) {
      console.error("Error leyendo carrito:", error);
    }

    const id = producto.id;
    const existente = carrito.find(
      item => String(item.id) === String(id) && String(item.tono || "") === String(tono)
    );

    if (existente) {
      existente.cantidad = Math.max(1, Number(existente.cantidad) || 1) + 1;
    } else {
      carrito.push({
        id,
        nombre: String(producto.nombre || "Producto"),
        precio: Math.max(0, Number(producto.precio) || 0),
        imagen: String(producto.imagen || ""),
        cantidad: 1,
        tono: String(tono || "")
      });
    }

    localStorage.setItem("carritoBlushea", JSON.stringify(carrito));
    actualizarContadorCarrito();

    boton.textContent = "✓ Producto agregado";
    boton.classList.add("is-added");
    boton.disabled = true;
    boton.setAttribute("aria-disabled", "true");

    let confirmacion = tarjeta.querySelector("[data-cart-confirmation]");
    if (!confirmacion) {
      confirmacion = document.createElement("div");
      confirmacion.dataset.cartConfirmation = "true";
      confirmacion.className = "cart-add-confirmation";
      confirmacion.setAttribute("role", "status");
      confirmacion.setAttribute("aria-live", "polite");
      tarjeta.querySelector(".product-actions")?.insertAdjacentElement("afterend", confirmacion);
    }

    confirmacion.innerHTML = `
      <strong>✓ Agregado al carrito</strong>
      <span>${escaparHTML(producto.nombre)}${tono ? ` · ${escaparHTML(tono)}` : ""}</span>
      <a href="/carrito.html">Ver carrito</a>
    `;

    setTimeout(() => {
      boton.textContent = "Agregar otro";
      boton.classList.remove("is-added");
      boton.disabled = false;
      boton.removeAttribute("aria-disabled");
    }, 2200);
  });
}


/* =========================================================
   URL DEL PRODUCTO

   Ejemplo:

   producto.html?id=123&variante=Negro
   ========================================================= */

function crearURLProducto(
  productoId,
  variante
) {

  const parametros =
    new URLSearchParams();


  parametros.set(
    "id",
    String(productoId)
  );


  if (variante) {
    parametros.set(
      "variante",
      variante
    );
  }


  return `/producto.html?${parametros.toString()}`;
}


/* =========================================================
   URL DE WHATSAPP
   ========================================================= */

function crearWhatsApp(
  producto,
  variante
) {

  let mensaje =
    `Hola, quiero comprar ${producto.nombre}`;


  if (variante) {
    mensaje +=
      ` en color ${variante}`;
  }


  mensaje += ".";


  return `https://wa.me/573022769069?text=${encodeURIComponent(mensaje)}`;
}


/* =========================================================
   ACTIVAR VARIANTES DE UNA TARJETA

   ESTA ES LA PARTE QUE HACE:

   ROSADO -> FOTO ROSADA
   NEGRO  -> FOTO NEGRA
   ========================================================= */

function activarVariantesTarjeta(
  tarjeta,
  producto,
  variantes
) {

  if (!variantes.length) {
    return;
  }


  const botones =
    tarjeta.querySelectorAll(
      ".catalog-variant-button"
    );


  const imagen =
    tarjeta.querySelector(
      "[data-product-image]"
    );


  const nombreSeleccionado =
    tarjeta.querySelector(
      "[data-selected-variant]"
    );


  const enlacesProducto =
    tarjeta.querySelectorAll(
      "[data-product-link]"
    );


  const enlaceWhatsApp =
    tarjeta.querySelector(
      "[data-whatsapp-link]"
    );


  botones.forEach(boton => {

    boton.addEventListener(
      "click",
      evento => {

        /*
         * Evita cualquier navegación accidental.
         */

        evento.preventDefault();

        evento.stopPropagation();


        const indice =
          Number(
            boton.dataset.variantIndex
          );


        const variante =
          variantes[indice];


        if (!variante) {
          return;
        }


        /* ===============================================
           1. CAMBIAR BOTÓN ACTIVO
           =============================================== */

        botones.forEach(
          otroBoton => {

            const seleccionado =
              otroBoton === boton;


            otroBoton.classList.toggle(
              "is-selected",
              seleccionado
            );


            otroBoton.setAttribute(
              "aria-pressed",
              seleccionado
                ? "true"
                : "false"
            );

          }
        );


        /* ===============================================
           2. GUARDAR VARIANTE SELECCIONADA
           =============================================== */

        tarjeta.dataset.selectedVariant =
          variante.nombre;


        /* ===============================================
           3. CAMBIAR NOMBRE DEL COLOR
           =============================================== */

        if (nombreSeleccionado) {

          nombreSeleccionado.textContent =
            variante.nombre;

        }


        /* ===============================================
           4. CAMBIAR FOTOGRAFÍA

           AQUÍ ocurre exactamente lo que pediste.
           =============================================== */

        if (
          imagen &&
          variante.imagen
        ) {

          /*
           * Pequeño efecto visual.
           */

          imagen.classList.add(
            "is-changing"
          );


          const nuevaImagen =
            new Image();


          nuevaImagen.onload =
            () => {

              imagen.src =
                variante.imagen;


              imagen.alt =
                `${producto.nombre} - ${variante.nombre}`;


              requestAnimationFrame(
                () => {

                  imagen.classList.remove(
                    "is-changing"
                  );

                }
              );

            };


          nuevaImagen.onerror =
            () => {

              /*
               * Si una imagen falla, dejamos
               * la fotografía anterior.
               */

              imagen.classList.remove(
                "is-changing"
              );


              console.error(
                `No se pudo cargar la imagen de la variante ${variante.nombre}`
              );

            };


          nuevaImagen.src =
            variante.imagen;

        }


        /* ===============================================
           5. ACTUALIZAR "VER PRODUCTO"

           Si eligió Negro:
           producto.html?id=X&variante=Negro
           =============================================== */

        const urlProducto =
          crearURLProducto(
            producto.id,
            variante.nombre
          );


        enlacesProducto.forEach(
          enlace => {

            enlace.href =
              urlProducto;

          }
        );


        /* ===============================================
           6. ACTUALIZAR WHATSAPP
           =============================================== */

        if (enlaceWhatsApp) {

          enlaceWhatsApp.href =
            crearWhatsApp(
              producto,
              variante.nombre
            );

        }

      }
    );

  });
}


/* =========================================================
   CLASIFICACIÓN COMERCIAL POR ZONA
   ========================================================= */

function normalizarTextoCategoria(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function obtenerZonaProducto(producto) {
  const categoria = normalizarTextoCategoria(producto?.categoria);
  const nombre = normalizarTextoCategoria(producto?.nombre);
  const descripcion = normalizarTextoCategoria(producto?.descripcion);
  const identidad = categoria + " " + nombre;
  const texto = [categoria, nombre, descripcion].join(" ");

  // Herramientas de aplicación tienen prioridad.
  if (/brocha|pincel|beauty blender|beautyblender|esponja.*maquill|esponja.*cosmetic|aplicador.*maquill/.test(identidad)) {
    return "Brochas";
  }

  if (/cosmetiquera|washbag|estuche|organizador/.test(identidad)) {
    return "Accesorios";
  }

  // Labios va antes que Ojos para evitar que "delineador de labios"
  // termine clasificado como delineador de ojos.
  if (/labial|labios|lipstick|lip gloss|lipgloss|gloss.*lab|balsamo.*lab|bálsamo.*lab|tinta.*lab|perfilador.*lab|delineador.*lab|lip liner|aceite.*lab|lip oil/.test(identidad)) {
    return "Labios";
  }

  if (/sombra|paleta.*ojo|pigmento.*ojo|glitter.*ojo|prebase.*ojo|pestana|pestañ|delineador|eyeliner|mascara.*pest|rimel|rímel|ceja|brow|lapiz.*ojo|lápiz.*ojo/.test(identidad)) {
    return "Ojos";
  }

  if (/skincare|serum|sérum|suero facial|crema facial|hidratante facial|limpiador facial|agua micelar|desmaquillante|tonico facial|tónico facial|protector solar|bloqueador facial|mascarilla facial|exfoliante facial|contorno de ojos|esencia facial/.test(texto)) {
    return "Skincare";
  }

  if (/\bbase\b|foundation|corrector|concealer|polvo|contorno|bronzer|rubor|blush|iluminador|highlighter|tinta liquida|tinta líquida|primer.*maquill|fijador.*maquill/.test(texto)) {
    return "Rostro";
  }

  if (/corporal|cuerpo|body/.test(texto)) return "Corporal";
  if (/capilar|cabello|hair/.test(texto)) return "Capilar";

  return "Otros";
}

function aplicarFiltros() {

  const texto =
    buscador
      ? buscador.value
          .toLowerCase()
          .trim()
      : "";


  const categoria =
    filtroCategoria
      ? filtroCategoria.value
      : "Todos";


  const productosFiltrados =
    productosGlobales.filter(
      producto => {

        const nombre =
          String(
            producto.nombre || ""
          ).toLowerCase();


        const descripcion =
          String(
            producto.descripcion || ""
          ).toLowerCase();


        const categoriaProducto =
          String(
            producto.categoria || ""
          );

        const zonaProducto =
          obtenerZonaProducto(producto);


        const variantes =
          obtenerVariantes(
            producto
          );


        const textoVariantes =
          variantes
            .map(
              variante =>
                variante.nombre
            )
            .join(" ")
            .toLowerCase();


        const coincideTexto =
          nombre.includes(texto) ||
          descripcion.includes(texto) ||
          categoriaProducto
            .toLowerCase()
            .includes(texto) ||
          zonaProducto.toLowerCase().includes(texto) ||
          textoVariantes.includes(texto);


        const coincideCategoria =
          categoria === "Todos" ||
          zonaProducto === categoria;


        return (
          coincideTexto &&
          coincideCategoria
        );

      }
    );


  pintarProductos(
    productosFiltrados
  );

}


/* =========================================================
   EVENTOS
   ========================================================= */

buscador?.addEventListener(
  "input",
  aplicarFiltros
);


filtroCategoria?.addEventListener(
  "change",
  aplicarFiltros
);


/* =========================================================
   ACTUALIZAR CONTADOR SI CAMBIA LOCALSTORAGE
   ========================================================= */

window.addEventListener(
  "storage",
  evento => {

    if (
      evento.key ===
      "carritoBlushea"
    ) {

      actualizarContadorCarrito();

    }

  }
);


/* =========================================================
   INICIAR
   ========================================================= */

actualizarContadorCarrito();

cargarProductos();

/* =========================================================
   ASESORA VIRTUAL DE BELLEZA · CATÁLOGO REAL
   ========================================================= */
const beautyLauncher = document.getElementById("beautyAssistantLauncher");
const beautyPanel = document.getElementById("beautyAssistant");
const beautyClose = document.getElementById("beautyAssistantClose");
const beautyForm = document.getElementById("beautyAssistantForm");
const beautyInput = document.getElementById("beautyAssistantInput");
const beautyMessages = document.getElementById("beautyAssistantMessages");

function abrirBeautyAssistant(abierto = true) {
  if (!beautyPanel || !beautyLauncher) return;
  beautyPanel.classList.toggle("is-open", abierto);
  beautyPanel.setAttribute("aria-hidden", String(!abierto));
  beautyLauncher.setAttribute("aria-expanded", String(abierto));
  if (abierto) setTimeout(() => beautyInput?.focus(), 180);
}

function beautyEscape(valor) {
  return String(valor ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
}

function agregarBeautyMensaje(texto, tipo = "bot", html = false) {
  if (!beautyMessages) return;
  const div = document.createElement("div");
  div.className = "beauty-message beauty-message-" + tipo;
  if (html) div.innerHTML = texto; else div.textContent = texto;
  beautyMessages.appendChild(div);
  beautyMessages.scrollTop = beautyMessages.scrollHeight;
}

function precioBeauty(valor) {
  return "$" + Number(valor || 0).toLocaleString("es-CO");
}

function responderBeautyAssistant(consulta) {
  const q = normalizarTextoCategoria(consulta);
  let zona = "";
  if (/labio|labial|gloss|tinta lab|lip/.test(q)) zona = "Labios";
  else if (/ojo|sombra|pestana|pestañ|delineador|rimel|rímel|ceja/.test(q)) zona = "Ojos";
  else if (/rostro|base|corrector|concealer|polvo|rubor|blush|contorno|iluminador/.test(q)) zona = "Rostro";
  else if (/skincare|piel|serum|sérum|crema facial|limpiador/.test(q)) zona = "Skincare";
  else if (/brocha|pincel|esponja|beauty blender/.test(q)) zona = "Brochas";

  const numeros = consulta.match(/[\d.,]+/g) || [];
  let limite = null;
  if (/hasta|menos de|menor|presupuesto|maximo|máximo/.test(q) && numeros.length) {
    const bruto = numeros[numeros.length - 1].replace(/\D/g, "");
    limite = Number(bruto);
    if (limite > 0 && limite < 1000) limite *= 1000;
  }

  let candidatos = [...productosGlobales];
  if (zona) candidatos = candidatos.filter(p => obtenerZonaProducto(p) === zona);
  if (limite) candidatos = candidatos.filter(p => Number(p.precio || 0) <= limite);

  if (!zona && !limite) {
    candidatos = candidatos.filter(p => {
      const texto = normalizarTextoCategoria([p.nombre, p.categoria, p.descripcion].join(" "));
      return q.split(" ").filter(x => x.length > 2).some(x => texto.includes(x));
    });
  }

  candidatos = candidatos.slice(0, 4);
  if (!candidatos.length) {
    agregarBeautyMensaje("No encontré una opción exacta con esos criterios 💗 Prueba diciéndome si buscas rostro, ojos, labios, skincare o brochas, y si tienes un presupuesto.");
    return;
  }

  const intro = zona
    ? "Estas opciones de " + zona.toLowerCase() + " están en nuestro catálogo:"
    : limite
      ? "Encontré estas opciones dentro de tu presupuesto:"
      : "Encontré estas opciones que pueden interesarte:";

  const tarjetas = candidatos.map(p => {
    const tonos = obtenerVariantes(p).slice(0, 3).map(v => beautyEscape(v.nombre)).join(" · ");
    return '<a class="beauty-result" href="/producto.html?id=' + encodeURIComponent(p.id) + '">' +
      '<strong>' + beautyEscape(p.nombre) + '</strong>' +
      '<span>' + precioBeauty(p.precio) + (tonos ? " · " + tonos : "") + '</span>' +
      '<small>Ver producto →</small></a>';
  }).join("");

  agregarBeautyMensaje('<span class="beauty-result-intro">' + beautyEscape(intro) + '</span>' + tarjetas, "bot", true);
}

beautyLauncher?.addEventListener("click", () => abrirBeautyAssistant(!beautyPanel?.classList.contains("is-open")));
beautyClose?.addEventListener("click", () => abrirBeautyAssistant(false));
beautyForm?.addEventListener("submit", e => {
  e.preventDefault();
  const consulta = beautyInput?.value.trim();
  if (!consulta) return;
  agregarBeautyMensaje(consulta, "user");
  beautyInput.value = "";
  setTimeout(() => responderBeautyAssistant(consulta), 180);
});
document.querySelectorAll("[data-beauty-query]").forEach(btn => btn.addEventListener("click", () => {
  const consulta = btn.dataset.beautyQuery || "";
  agregarBeautyMensaje(consulta, "user");
  setTimeout(() => responderBeautyAssistant(consulta), 150);
}));
