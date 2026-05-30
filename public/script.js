const contenedorProductos = document.getElementById("listaProductos");
const buscador = document.getElementById("buscadorProductos");
const filtroCategoria = document.getElementById("filtroCategoria");

let productosGlobales = [];

async function cargarProductos() {
  if (!contenedorProductos) return;

  try {
    const respuesta = await fetch("/api/productos");
    productosGlobales = await respuesta.json();

    pintarProductos(productosGlobales);

  } catch (error) {
    console.error("Error cargando productos:", error);

    contenedorProductos.innerHTML = `
      <div class="empty-state">
        <h3>No se pudieron cargar los productos</h3>
        <p>Revisa que el servidor esté encendido correctamente.</p>
      </div>
    `;
  }
}

function pintarProductos(productos) {
  contenedorProductos.innerHTML = "";

  if (!productos.length) {
    contenedorProductos.innerHTML = `
      <div class="empty-state">
        <h3>Aún no hay productos publicados</h3>
        <p>Agrega productos desde el panel administrativo.</p>
      </div>
    `;
    return;
  }

  productos.forEach((producto) => {
    const imagen = producto.imagen && producto.imagen.trim() !== ""
      ? producto.imagen
      : "https://via.placeholder.com/600x600?text=Blushea";

    const tonosHTML = producto.tieneTonos && producto.tonos && producto.tonos.length > 0
      ? `
        <div class="mini-tones">
          ${producto.tonos.slice(0, 5).map(tono => `<span>${tono}</span>`).join("")}
          ${producto.tonos.length > 5 ? `<span>+${producto.tonos.length - 5}</span>` : ""}
        </div>
      `
      : "";

    contenedorProductos.innerHTML += `
      <article class="product-card">
        <a href="producto.html?id=${producto.id}" class="product-image-link">
          <div class="product-image">
            <img src="${imagen}" alt="${producto.nombre}">
          </div>
        </a>

        <div class="product-info">
          <span class="product-category">${producto.categoria || "Producto"}</span>

          <h3>${producto.nombre}</h3>

          <p>${producto.descripcion}</p>

          ${tonosHTML}

          <div class="product-meta">
            <strong>$${Number(producto.precio).toLocaleString("es-CO")} COP</strong>
            <small>${producto.stock > 0 ? `Stock: ${producto.stock}` : "Agotado"}</small>
          </div>

          <div class="product-actions">
            <a href="producto.html?id=${producto.id}" class="btn-card">
              Ver producto
            </a>

            <a 
              href="https://wa.me/573001112233?text=Hola,%20quiero%20comprar%20${encodeURIComponent(producto.nombre)}"
              target="_blank"
              class="btn-card-outline"
            >
              WhatsApp
            </a>
          </div>
        </div>
      </article>
    `;
  });
}

function aplicarFiltros() {
  const texto = buscador.value.toLowerCase().trim();
  const categoria = filtroCategoria.value;

  const productosFiltrados = productosGlobales.filter((producto) => {
    const coincideTexto =
      producto.nombre.toLowerCase().includes(texto) ||
      producto.descripcion.toLowerCase().includes(texto) ||
      producto.categoria.toLowerCase().includes(texto);

    const coincideCategoria =
      categoria === "Todos" || producto.categoria === categoria;

    return coincideTexto && coincideCategoria;
  });

  pintarProductos(productosFiltrados);
}

if (buscador) {
  buscador.addEventListener("input", aplicarFiltros);
}

if (filtroCategoria) {
  filtroCategoria.addEventListener("change", aplicarFiltros);
}

cargarProductos();