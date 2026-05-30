const listaCarrito = document.getElementById("listaCarrito");
const resumenCarrito = document.getElementById("resumenCarrito");

let carrito = JSON.parse(localStorage.getItem("carritoBlushea")) || [];
let envio = 0;

function guardarCarrito() {
  localStorage.setItem("carritoBlushea", JSON.stringify(carrito));
}

function calcularSubtotal() {
  return carrito.reduce((total, item) => total + item.precio * item.cantidad, 0);
}

function pintarResumen() {
  const subtotal = calcularSubtotal();
  const total = subtotal + envio;

  resumenCarrito.innerHTML = `
    <div class="delivery-summary">
      <p><strong>Subtotal:</strong> $${subtotal.toLocaleString("es-CO")} COP</p>
      <p><strong>Envío:</strong> $${envio.toLocaleString("es-CO")} COP</p>
      <p><strong>Total:</strong> $${total.toLocaleString("es-CO")} COP</p>
    </div>
  `;
}

function pintarCarrito() {
  listaCarrito.innerHTML = "";

  if (!carrito.length) {
    listaCarrito.innerHTML = `
      <div class="empty-state">
        <h3>Tu carrito está vacío</h3>
        <p>Agrega productos desde el catálogo.</p>
      </div>
    `;
    pintarResumen();
    return;
  }

  carrito.forEach((item, index) => {
    listaCarrito.innerHTML += `
      <div class="cart-item">
        <img src="${item.imagen}" alt="${item.nombre}">
        <div>
          <h3>${item.nombre}</h3>
          ${item.tono ? `<p>Tono: ${item.tono}</p>` : ""}
          <p>Cantidad: ${item.cantidad}</p>
          <strong>$${(item.precio * item.cantidad).toLocaleString("es-CO")} COP</strong>
        </div>
        <button onclick="eliminarItem(${index})">Eliminar</button>
      </div>
    `;
  });

  pintarResumen();
}

function eliminarItem(index) {
  carrito.splice(index, 1);
  guardarCarrito();
  pintarCarrito();
}

document.getElementById("calcularCarritoEnvio").addEventListener("click", async () => {
  const barrio = document.getElementById("barrioCliente").value.trim();

  if (!barrio) {
    alert("Escribe el barrio.");
    return;
  }

  const respuesta = await fetch("/api/calcular-envio", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ barrio })
  });

  const resultado = await respuesta.json();

  if (!respuesta.ok) {
    alert(resultado.mensaje);
    return;
  }

  envio = Number(resultado.valorEnvio);
  pintarResumen();
});

document.getElementById("confirmarPedido").addEventListener("click", async () => {
  if (!carrito.length) {
    alert("El carrito está vacío.");
    return;
  }

  const cliente = {
    nombre: document.getElementById("nombreCliente").value.trim(),
    telefono: document.getElementById("telefonoCliente").value.trim(),
    direccion: document.getElementById("direccionCliente").value.trim(),
    barrio: document.getElementById("barrioCliente").value.trim(),
    ciudad: "Medellín"
  };

  if (!cliente.nombre || !cliente.telefono || !cliente.direccion || !cliente.barrio) {
    alert("Completa todos los datos.");
    return;
  }

  const subtotal = calcularSubtotal();
  const total = subtotal + envio;

  const respuesta = await fetch("/api/pedidos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      cliente,
      productos: carrito,
      subtotal,
      envio,
      total
    })
  });

  const resultado = await respuesta.json();

  if (!respuesta.ok) {
    alert(resultado.mensaje || "Error creando pedido");
    return;
  }

  localStorage.removeItem("carritoBlushea");

  const linkSeguimiento = `${window.location.origin}/seguimiento.html?id=${resultado.pedido.id}`;

  alert("Pedido creado correctamente. Ahora verás tu link de seguimiento.");

  window.location.href = linkSeguimiento;
});

pintarCarrito();