const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");

const app = express();
const PORT = 4000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const publicDir = path.join(__dirname, "public");
const uploadDir = path.join(publicDir, "uploads");
const dataPath = path.join(__dirname, "productos.json");

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

if (!fs.existsSync(dataPath)) {
  fs.writeFileSync(dataPath, "[]", "utf8");
}

app.use(express.static(publicDir));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const nombreLimpio = file.originalname.replace(/\s+/g, "-");
    cb(null, Date.now() + "-" + nombreLimpio);
  }
});

const upload = multer({ storage });

app.get("/api/productos", (req, res) => {
  try {
    const productos = JSON.parse(fs.readFileSync(dataPath, "utf8"));
    res.json(productos);
  } catch (error) {
    console.error("Error leyendo productos:", error);
    res.status(500).json({ mensaje: "Error leyendo productos" });
  }
});

app.post("/api/productos", upload.single("imagen"), (req, res) => {
  try {
    let productos = [];

    try {
      productos = JSON.parse(fs.readFileSync(dataPath, "utf8"));
    } catch {
      productos = [];
    }

    const tieneTonos = req.body.tieneTonos === "si";

    const tonos = tieneTonos && req.body.tonos
      ? req.body.tonos
          .split(",")
          .map((tono) => tono.trim())
          .filter((tono) => tono !== "")
      : [];

    const nuevoProducto = {
      id: Date.now(),
      nombre: req.body.nombre,
      categoria: req.body.categoria,
      precio: Number(req.body.precio),
      stock: Number(req.body.stock),
      descripcion: req.body.descripcion,
      tieneTonos: tieneTonos,
      tonos: tonos,
      imagen: req.file ? `/uploads/${req.file.filename}` : ""
    };

    productos.push(nuevoProducto);

    fs.writeFileSync(dataPath, JSON.stringify(productos, null, 2), "utf8");

    res.json({
      mensaje: "Producto agregado correctamente",
      producto: nuevoProducto
    });

  } catch (error) {
    console.error("Error guardando producto:", error);
    res.status(500).json({
      mensaje: "Error interno guardando producto",
      error: error.message
    });
  }
});
app.delete("/api/productos/:id", (req, res) => {
  try {
    const id = req.params.id;
    let productos = JSON.parse(fs.readFileSync(dataPath, "utf8"));

    const producto = productos.find((p) => String(p.id) === String(id));

    if (!producto) {
      return res.status(404).json({ mensaje: "Producto no encontrado" });
    }

    productos = productos.filter((p) => String(p.id) !== String(id));

    fs.writeFileSync(dataPath, JSON.stringify(productos, null, 2), "utf8");

    if (producto.imagen) {
      const imagePath = path.join(publicDir, producto.imagen);

      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    res.json({ mensaje: "Producto eliminado correctamente" });

  } catch (error) {
    console.error("Error eliminando producto:", error);
    res.status(500).json({ mensaje: "Error eliminando producto" });
  }
});
require("dotenv").config();

const ORS_API_KEY = process.env.ORS_API_KEY;
const TIENDA_LAT = Number(process.env.TIENDA_LAT);
const TIENDA_LON = Number(process.env.TIENDA_LON);
const PRECIO_KM = Number(process.env.PRECIO_KM || 1500);


app.post("/api/calcular-envio", (req, res) => {
  try {
    const { barrio } = req.body;

    if (!barrio) {
      return res.status(400).json({ mensaje: "El barrio es obligatorio" });
    }

    const precioKm = 1500;

    const distanciasMedellin = {
      "el poblado": 6,
      "laureles": 4,
      "belén": 5,
      "belen": 5,
      "prado": 3,
      "centro": 2,
      "manrique": 6,
      "robledo": 7,
      "castilla": 7,
      "aranjuez": 5,
      "buenos aires": 4,
      "guayabal": 6,
      "estadio": 4,
      "floresta": 5,
      "calasanz": 6,
      "san javier": 7,
      "popular": 8,
      "santa cruz": 7,
      "doce de octubre": 8,
      "villa hermosa": 5
    };

    const barrioNormalizado = barrio.toLowerCase().trim();
    const distanciaKm = distanciasMedellin[barrioNormalizado];

    if (!distanciaKm) {
      return res.status(404).json({
        mensaje: "Por ahora no tenemos ese barrio registrado. Escríbenos por WhatsApp para confirmar el domicilio."
      });
    }

    const valorEnvio = distanciaKm * precioKm;

    res.json({
      ciudad: "Medellín",
      barrio,
      distanciaKm,
      distanciaCobradaKm: distanciaKm,
      precioKm,
      valorEnvio
    });

  } catch (error) {
    console.error("Error calculando envío:", error);
    res.status(500).json({ mensaje: "Error calculando envío" });
  }
});

const pedidosPath = path.join(__dirname, "pedidos.json");
const ventasPath = path.join(__dirname, "ventas.json");

if (!fs.existsSync(pedidosPath)) {
  fs.writeFileSync(pedidosPath, "[]", "utf8");
}

if (!fs.existsSync(ventasPath)) {
  fs.writeFileSync(ventasPath, "[]", "utf8");
}

app.post("/api/pedidos", (req, res) => {
  try {
    const pedidos = JSON.parse(fs.readFileSync(pedidosPath, "utf8"));

    const nuevoPedido = {
      id: Date.now(),
      fecha: new Date().toLocaleString("es-CO"),
      cliente: req.body.cliente,
      productos: req.body.productos,
      subtotal: req.body.subtotal,
      envio: req.body.envio,
      total: req.body.total,
      estado: "Pendiente"
    };

    pedidos.push(nuevoPedido);

    fs.writeFileSync(pedidosPath, JSON.stringify(pedidos, null, 2), "utf8");

    res.json({
      mensaje: "Pedido creado correctamente",
      pedido: nuevoPedido
    });

  } catch (error) {
    console.error("Error creando pedido:", error);
    res.status(500).json({ mensaje: "Error creando pedido" });
  }
});

app.get("/api/pedidos", (req, res) => {
  try {
    const pedidos = JSON.parse(fs.readFileSync(pedidosPath, "utf8"));
    res.json(pedidos);
  } catch (error) {
    res.status(500).json({ mensaje: "Error leyendo pedidos" });
  }
});

app.get("/api/pedidos/:id", (req, res) => {
  try {
    const pedidos = JSON.parse(fs.readFileSync(pedidosPath, "utf8"));
    const pedido = pedidos.find(p => String(p.id) === String(req.params.id));

    if (!pedido) {
      return res.status(404).json({ mensaje: "Pedido no encontrado" });
    }

    res.json(pedido);

  } catch (error) {
    res.status(500).json({ mensaje: "Error leyendo pedido" });
  }
});

app.put("/api/pedidos/:id/estado", (req, res) => {
  try {
    const { estado } = req.body;

    let pedidos = JSON.parse(fs.readFileSync(pedidosPath, "utf8"));
    let ventas = JSON.parse(fs.readFileSync(ventasPath, "utf8"));

    const pedido = pedidos.find(p => String(p.id) === String(req.params.id));

    if (!pedido) {
      return res.status(404).json({ mensaje: "Pedido no encontrado" });
    }

    pedido.estado = estado;

    if (estado === "Entregado") {
      pedido.fechaEntregado = new Date().toLocaleString("es-CO");
      ventas.push(pedido);
      pedidos = pedidos.filter(p => String(p.id) !== String(req.params.id));
    }

    fs.writeFileSync(pedidosPath, JSON.stringify(pedidos, null, 2), "utf8");
    fs.writeFileSync(ventasPath, JSON.stringify(ventas, null, 2), "utf8");

    res.json({ mensaje: "Estado actualizado", pedido });

  } catch (error) {
    res.status(500).json({ mensaje: "Error actualizando pedido" });
  }
});

app.get("/api/ventas", (req, res) => {
  try {
    const ventas = JSON.parse(fs.readFileSync(ventasPath, "utf8"));
    res.json(ventas);
  } catch (error) {
    res.status(500).json({ mensaje: "Error leyendo ventas" });
  }
});
app.listen(PORT, () => {
  console.log(`Blushéa Beauty Cosmetics funcionando en http://localhost:${PORT}`);
});