"use strict";


/* =========================================================
   BLUSHÉA BEAUTY COSMETICS
   CARRITO DE COMPRAS
   ========================================================= */


/* =========================================================
   ELEMENTOS PRINCIPALES
   ========================================================= */

const listaCarrito =
  document.getElementById(
    "listaCarrito"
  );


const resumenCarrito =
  document.getElementById(
    "resumenCarrito"
  );


const botonCalcularEnvio =
  document.getElementById(
    "calcularCarritoEnvio"
  );


const botonConfirmarPedido =
  document.getElementById(
    "confirmarPedido"
  );


const nombreCliente =
  document.getElementById(
    "nombreCliente"
  );


const telefonoCliente =
  document.getElementById(
    "telefonoCliente"
  );


const direccionCliente =
  document.getElementById(
    "direccionCliente"
  );


const barrioCliente =
  document.getElementById(
    "barrioCliente"
  );


/* =========================================================
   ESTADO DEL CARRITO
   ========================================================= */

let carrito =
  obtenerCarrito();


let envio = 0;


let envioCalculado =
  false;


let procesandoPedido =
  false;


/* =========================================================
   LEER CARRITO
   ========================================================= */

function obtenerCarrito() {

  try {

    const datos =
      JSON.parse(
        localStorage.getItem(
          "carritoBlushea"
        )
      );


    return Array.isArray(datos)
      ? datos
      : [];


  } catch (error) {

    console.error(
      "Error leyendo carrito:",
      error
    );


    return [];

  }

}


/* =========================================================
   GUARDAR CARRITO
   ========================================================= */

function guardarCarrito() {

  localStorage.setItem(
    "carritoBlushea",
    JSON.stringify(
      carrito
    )
  );

}


/* =========================================================
   ESCAPAR HTML
   ========================================================= */

function escaparHTML(valor) {

  return String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

}


/* =========================================================
   FORMATEAR PRECIO
   ========================================================= */

function formatearPrecio(valor) {

  const numero =
    Number(valor);


  if (
    !Number.isFinite(numero)
  ) {

    return "$0 COP";

  }


  return `$${numero.toLocaleString(
    "es-CO"
  )} COP`;

}


/* =========================================================
   NORMALIZAR CARRITO

   Sirve también para productos guardados con
   la versión anterior de BLUSHÉA.
   ========================================================= */

function normalizarCarrito() {

  carrito =
    carrito
      .filter(
        item =>
          item &&
          item.id !== undefined &&
          item.nombre
      )
      .map(
        item => ({

          id:
            item.id,

          nombre:
            String(
              item.nombre ||
              "Producto"
            ),

          precio:
            Math.max(
              0,
              Number(
                item.precio
              ) || 0
            ),

          imagen:
            String(
              item.imagen ||
              ""
            ),

          cantidad:
            Math.max(
              1,
              Math.floor(
                Number(
                  item.cantidad
                ) || 1
              )
            ),

          tono:
            String(
              item.tono ||
              ""
            )

        })
      );


  guardarCarrito();

}


/* =========================================================
   CALCULAR SUBTOTAL
   ========================================================= */

function calcularSubtotal() {

  return carrito.reduce(
    (
      total,
      item
    ) => {

      const precio =
        Number(
          item.precio
        ) || 0;


      const cantidad =
        Number(
          item.cantidad
        ) || 1;


      return total +
        (
          precio *
          cantidad
        );

    },
    0
  );

}


/* =========================================================
   TOTAL
   ========================================================= */

function calcularTotal() {

  return calcularSubtotal() +
    envio;

}


/* =========================================================
   INVALIDAR ENVÍO

   Si cambia el barrio o dirección, el valor
   anterior deja de considerarse confirmado.
   ========================================================= */

function invalidarEnvio() {

  envio = 0;

  envioCalculado =
    false;


  pintarResumen();

}


/* =========================================================
   RESUMEN
   ========================================================= */

function pintarResumen() {

  if (!resumenCarrito) {

    return;

  }


  const subtotal =
    calcularSubtotal();


  const total =
    subtotal +
    envio;


  resumenCarrito.innerHTML = `

    <div
      class="delivery-summary"
    >

      <p>

        <span>
          Subtotal
        </span>

        <strong>
          ${formatearPrecio(
            subtotal
          )}
        </strong>

      </p>


      <p>

        <span>
          Envío
        </span>

        <strong>

          ${
            envioCalculado
              ? formatearPrecio(
                  envio
                )
              : "Por calcular"
          }

        </strong>

      </p>


      <p
        class="cart-grand-total"
      >

        <span>
          Total
        </span>

        <strong>

          ${
            envioCalculado
              ? formatearPrecio(
                  total
                )
              : formatearPrecio(
                  subtotal
                )
          }

        </strong>

      </p>


      ${
        !envioCalculado &&
        carrito.length > 0
          ? `
            <small>
              Calcula el domicilio para conocer
              el total final de tu compra.
            </small>
          `
          : ""
      }

    </div>

  `;

}


/* =========================================================
   PINTAR CARRITO
   ========================================================= */

function pintarCarrito() {

  if (!listaCarrito) {

    return;

  }


  listaCarrito.innerHTML =
    "";


  /* =====================================================
     CARRITO VACÍO
     ===================================================== */

  if (
    carrito.length === 0
  ) {

    listaCarrito.innerHTML = `

      <div
        class="empty-state"
      >

        <h3>
          Tu carrito está vacío
        </h3>

        <p>
          Encuentra tu próximo favorito
          en BLUSHÉA.
        </p>

        <a
          href="/#productos"
          class="buy-detail-button"
        >
          Ver productos
        </a>

      </div>

    `;


    pintarResumen();

    actualizarBotonCompra();

    return;

  }


  /* =====================================================
     PRODUCTOS
     ===================================================== */

  carrito.forEach(
    (
      item,
      index
    ) => {

      const nombre =
        escaparHTML(
          item.nombre
        );


      const imagen =
        escaparHTML(
          item.imagen
        );


      const tono =
        item.tono
          ? escaparHTML(
              item.tono
            )
          : "";


      const cantidad =
        Math.max(
          1,
          Number(
            item.cantidad
          ) || 1
        );


      const precio =
        Number(
          item.precio
        ) || 0;


      const totalProducto =
        precio *
        cantidad;


      const elemento =
        document.createElement(
          "article"
        );


      elemento.className =
        "cart-item";


      elemento.innerHTML = `


        <!-- FOTO -->

        <div
          class="cart-item-image"
        >

          ${
            imagen
              ? `
                <img
                  src="${imagen}"
                  alt="${nombre}${
                    tono
                      ? ` - ${tono}`
                      : ""
                  }"
                  loading="lazy"
                >
              `
              : `
                <div
                  class="cart-image-placeholder"
                >
                  BLUSHÉA
                </div>
              `
          }

        </div>



        <!-- INFORMACIÓN -->

        <div
          class="cart-item-info"
        >

          <h3>
            ${nombre}
          </h3>


          ${
            tono
              ? `
                <p
                  class="cart-item-tone"
                >

                  <strong>
                    Color / tono:
                  </strong>

                  ${tono}

                </p>
              `
              : ""
          }


          <p
            class="cart-unit-price"
          >

            ${formatearPrecio(
              precio
            )} c/u

          </p>



          <!-- CANTIDAD -->

          <div
            class="cart-quantity"
          >

            <span>
              Cantidad
            </span>


            <div
              class="quantity-control"
            >

              <button
                type="button"
                class="cart-minus"
                data-index="${index}"
                aria-label="Disminuir cantidad"
              >
                −
              </button>


              <strong>
                ${cantidad}
              </strong>


              <button
                type="button"
                class="cart-plus"
                data-index="${index}"
                aria-label="Aumentar cantidad"
              >
                +
              </button>

            </div>

          </div>


          <strong
            class="cart-item-total"
          >

            ${formatearPrecio(
              totalProducto
            )}

          </strong>

        </div>



        <!-- ELIMINAR -->

        <button
          type="button"
          class="cart-remove-button"
          data-index="${index}"
          aria-label="Eliminar ${nombre} del carrito"
        >
          Eliminar
        </button>

      `;


      listaCarrito.appendChild(
        elemento
      );

    }
  );


  activarBotonesCarrito();

  pintarResumen();

  actualizarBotonCompra();

}


/* =========================================================
   BOTONES DE PRODUCTOS
   ========================================================= */

function activarBotonesCarrito() {

  /* -----------------------------------------------------
     ELIMINAR
     ----------------------------------------------------- */

  document
    .querySelectorAll(
      ".cart-remove-button"
    )
    .forEach(
      boton => {

        boton.addEventListener(
          "click",
          () => {

            const index =
              Number(
                boton.dataset.index
              );


            eliminarItem(
              index
            );

          }
        );

      }
    );


  /* -----------------------------------------------------
     RESTAR
     ----------------------------------------------------- */

  document
    .querySelectorAll(
      ".cart-minus"
    )
    .forEach(
      boton => {

        boton.addEventListener(
          "click",
          () => {

            const index =
              Number(
                boton.dataset.index
              );


            cambiarCantidad(
              index,
              -1
            );

          }
        );

      }
    );


  /* -----------------------------------------------------
     SUMAR
     ----------------------------------------------------- */

  document
    .querySelectorAll(
      ".cart-plus"
    )
    .forEach(
      boton => {

        boton.addEventListener(
          "click",
          () => {

            const index =
              Number(
                boton.dataset.index
              );


            cambiarCantidad(
              index,
              1
            );

          }
        );

      }
    );

}


/* =========================================================
   CAMBIAR CANTIDAD
   ========================================================= */

function cambiarCantidad(
  index,
  cambio
) {

  const item =
    carrito[index];


  if (!item) {

    return;

  }


  const nuevaCantidad =
    Number(
      item.cantidad
    ) +
    cambio;


  if (
    nuevaCantidad < 1
  ) {

    return;

  }


  item.cantidad =
    nuevaCantidad;


  /*
   * Si cambia el carrito, recalculamos después
   * el total. El domicilio puede mantenerse
   * porque depende del barrio.
   */

  guardarCarrito();

  pintarCarrito();

}


/* =========================================================
   ELIMINAR PRODUCTO
   ========================================================= */

function eliminarItem(
  index
) {

  if (
    index < 0 ||
    index >= carrito.length
  ) {

    return;

  }


  carrito.splice(
    index,
    1
  );


  guardarCarrito();


  if (
    carrito.length === 0
  ) {

    envio = 0;

    envioCalculado =
      false;

  }


  pintarCarrito();

}


/* =========================================================
   ACTUALIZAR BOTÓN DE COMPRA
   ========================================================= */

function actualizarBotonCompra() {

  if (
    !botonConfirmarPedido
  ) {

    return;

  }


  if (
    carrito.length === 0
  ) {

    botonConfirmarPedido.disabled =
      true;

    return;

  }


  if (
    !procesandoPedido
  ) {

    botonConfirmarPedido.disabled =
      false;

  }

}


/* =========================================================
   CALCULAR ENVÍO
   ========================================================= */

botonCalcularEnvio?.addEventListener(
  "click",
  async () => {

    const barrio =
      barrioCliente
        ?.value
        .trim() ||
      "";


    const direccion =
      direccionCliente
        ?.value
        .trim() ||
      "";


    if (!direccion) {

      alert(
        "Escribe la dirección de entrega."
      );

      direccionCliente?.focus();

      return;

    }


    if (!barrio) {

      alert(
        "Escribe el barrio."
      );

      barrioCliente?.focus();

      return;

    }


    botonCalcularEnvio.disabled =
      true;


    botonCalcularEnvio.textContent =
      "Calculando...";


    try {

      const respuesta =
        await fetch(
          "/api/calcular-envio",
          {

            method:
              "POST",

            headers: {

              "Content-Type":
                "application/json"

            },

            body:
              JSON.stringify({

                direccion,

                barrio,

                ciudad:
                  "Medellín"

              })

          }
        );


      let resultado;


      try {

        resultado =
          await respuesta.json();

      } catch {

        resultado = {};

      }


      if (
        !respuesta.ok
      ) {

        envio = 0;

        envioCalculado =
          false;


        pintarResumen();


        alert(
          resultado.mensaje ||
          "No pudimos calcular el domicilio."
        );


        return;

      }


      const valorEnvio =
        Number(
          resultado.valorEnvio
        );


      if (
        !Number.isFinite(
          valorEnvio
        ) ||
        valorEnvio < 0
      ) {

        throw new Error(
          "Valor de envío inválido"
        );

      }


      envio =
        valorEnvio;


      envioCalculado =
        true;


      pintarResumen();


    } catch (error) {

      console.error(
        "Error calculando envío:",
        error
      );


      envio = 0;

      envioCalculado =
        false;


      pintarResumen();


      alert(
        "No pudimos conectar con el servidor para calcular el domicilio."
      );

    }


    finally {

      botonCalcularEnvio.disabled =
        false;


      botonCalcularEnvio.textContent =
        "Calcular envío";

    }

  }
);


/* =========================================================
   SI CAMBIA DIRECCIÓN O BARRIO

   El domicilio anterior deja de ser válido.
   ========================================================= */

direccionCliente?.addEventListener(
  "input",
  () => {

    if (
      envioCalculado
    ) {

      invalidarEnvio();

    }

  }
);


barrioCliente?.addEventListener(
  "input",
  () => {

    if (
      envioCalculado
    ) {

      invalidarEnvio();

    }

  }
);


/* =========================================================
   VALIDAR CLIENTE
   ========================================================= */

function obtenerCliente() {

  const cliente = {

    nombre:
      nombreCliente
        ?.value
        .trim() ||
      "",

    telefono:
      telefonoCliente
        ?.value
        .trim() ||
      "",

    direccion:
      direccionCliente
        ?.value
        .trim() ||
      "",

    barrio:
      barrioCliente
        ?.value
        .trim() ||
      "",

    ciudad:
      "Medellín"

  };


  if (!cliente.nombre) {

    alert(
      "Escribe tu nombre completo."
    );

    nombreCliente?.focus();

    return null;

  }


  if (!cliente.telefono) {

    alert(
      "Escribe tu número de teléfono."
    );

    telefonoCliente?.focus();

    return null;

  }


  /*
   * Validación sencilla para Colombia.
   * Quitamos espacios, guiones, paréntesis y +.
   */

  const telefonoNumerico =
    cliente.telefono
      .replace(
        /[\s()+-]/g,
        ""
      );


  if (
    !/^\d{7,15}$/.test(
      telefonoNumerico
    )
  ) {

    alert(
      "Revisa el número de teléfono."
    );

    telefonoCliente?.focus();

    return null;

  }


  if (!cliente.direccion) {

    alert(
      "Escribe la dirección de entrega."
    );

    direccionCliente?.focus();

    return null;

  }


  if (!cliente.barrio) {

    alert(
      "Escribe el barrio."
    );

    barrioCliente?.focus();

    return null;

  }


  return cliente;

}


/* =========================================================
   CONFIRMAR PEDIDO
   ========================================================= */

botonConfirmarPedido?.addEventListener(
  "click",
  async () => {

    /*
     * Evita doble clic:
     * dos pedidos + dos pagos.
     */

    if (
      procesandoPedido
    ) {

      return;

    }


    if (
      carrito.length === 0
    ) {

      alert(
        "Tu carrito está vacío."
      );

      return;

    }


    const cliente =
      obtenerCliente();


    if (!cliente) {

      return;

    }


    /*
     * No dejamos crear el pedido con domicilio
     * en $0 porque la clienta olvidó calcularlo.
     */

    if (
      !envioCalculado
    ) {

      alert(
        "Calcula primero el valor del domicilio."
      );


      botonCalcularEnvio
        ?.scrollIntoView({

          behavior:
            "smooth",

          block:
            "center"

        });


      return;

    }


    const subtotal =
      calcularSubtotal();


    const total =
      subtotal +
      envio;


    if (
      subtotal <= 0 ||
      total <= 0
    ) {

      alert(
        "No pudimos calcular correctamente el total de la compra."
      );

      return;

    }


    procesandoPedido =
      true;


    botonConfirmarPedido.disabled =
      true;


    const textoOriginalBoton =
      botonConfirmarPedido.textContent;


    botonConfirmarPedido.textContent =
      "Preparando pago...";


    try {

      /* =====================================================
         1. CREAR PEDIDO
         ===================================================== */

      const respuesta =
        await fetch(
          "/api/pedidos",
          {

            method:
              "POST",

            headers: {

              "Content-Type":
                "application/json"

            },

            body:
              JSON.stringify({

                cliente,

                /*
                 * IMPORTANTE:
                 *
                 * Aquí mandamos el carrito COMPLETO.
                 *
                 * Cada producto conserva:
                 *
                 * id
                 * nombre
                 * precio
                 * cantidad
                 * tono
                 * imagen
                 *
                 * Por eso "Negro" seguirá siendo
                 * "Negro" en pedidos y recibos.
                 */

                productos:
                  carrito,

                subtotal,

                envio,

                total

              })

          }
        );


      let resultado;


      try {

        resultado =
          await respuesta.json();

      } catch {

        resultado = {};

      }


      if (
        !respuesta.ok
      ) {

        throw new Error(
          resultado.mensaje ||
          "No pudimos crear tu pedido."
        );

      }


      if (
        !resultado.pedido ||
        !resultado.pedido.id
      ) {

        throw new Error(
          "El servidor no devolvió el número del pedido."
        );

      }


      const pedidoId =
        resultado.pedido.id;


      /* =====================================================
         2. CREAR PAGO EN MERCADO PAGO
         ===================================================== */

      botonConfirmarPedido.textContent =
        "Abriendo Mercado Pago...";


      const pagoRespuesta =
        await fetch(
          "/api/crear-pago",
          {

            method:
              "POST",

            headers: {

              "Content-Type":
                "application/json"

            },

            body:
              JSON.stringify({

                pedidoId

              })

          }
        );


      let pago;


      try {

        pago =
          await pagoRespuesta.json();

      } catch {

        pago = {};

      }


      /* =====================================================
         PEDIDO CREADO, PERO FALLÓ MERCADO PAGO
         ===================================================== */

      if (
        !pagoRespuesta.ok ||
        !pago.init_point
      ) {

        /*
         * MUY IMPORTANTE:
         *
         * NO borramos el carrito en este caso.
         * Si Mercado Pago falla, la clienta
         * todavía conserva su compra.
         */

        alert(
          "Tu pedido fue creado, pero no pudimos abrir Mercado Pago. Te llevaremos al seguimiento de tu pedido."
        );


        window.location.href =
          `/seguimiento.html?id=${encodeURIComponent(
            pedidoId
          )}`;


        return;

      }


      /* =====================================================
         3. PAGO LISTO

         Solo aquí limpiamos el carrito.
         ===================================================== */

      localStorage.removeItem(
        "carritoBlushea"
      );


      /*
       * Guardamos temporalmente el último pedido
       * para poder recuperarlo si después quieres
       * mostrar una página de confirmación.
       */

      localStorage.setItem(
        "ultimoPedidoBlushea",
        String(
          pedidoId
        )
      );


      /* =====================================================
         4. REDIRECCIÓN A MERCADO PAGO
         ===================================================== */

      window.location.href =
        pago.init_point;


    } catch (error) {

      console.error(
        "Error procesando compra:",
        error
      );


      alert(
        error.message ||
        "Ocurrió un error procesando tu compra. Intenta nuevamente."
      );


      procesandoPedido =
        false;


      botonConfirmarPedido.disabled =
        false;


      botonConfirmarPedido.textContent =
        textoOriginalBoton;

    }

  }
);


/* =========================================================
   INICIALIZACIÓN
   ========================================================= */

normalizarCarrito();

pintarCarrito();