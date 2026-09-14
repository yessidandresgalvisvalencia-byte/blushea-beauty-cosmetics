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
      stock <= 0;


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
                  <span>BLUSHÉA</span>
                </div>
              `
          }

          ${
            agotado
              ? `
                <span class="product-sold-out">
                  AGOTADO
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

        <div class="product-meta">

          <strong>
            ${formatearPrecio(precio)}
          </strong>

          <small class="${agotado ? "stock-out" : "stock-ok"}">

            ${
              agotado
                ? "Agotado"
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


  return `https://wa.me/573001112233?text=${encodeURIComponent(mensaje)}`;
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
   FILTROS
   ========================================================= */

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
          textoVariantes.includes(texto);


        const coincideCategoria =
          categoria === "Todos" ||
          categoriaProducto === categoria;


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