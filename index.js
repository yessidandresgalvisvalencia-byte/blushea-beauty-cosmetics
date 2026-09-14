"use strict";

/* =========================================================
   BLUSHÉA BEAUTY COSMETICS
   SERVER.JS
   ========================================================= */


/* =========================================================
   VARIABLES DE ENTORNO
   Deben cargarse ANTES de usar process.env
   ========================================================= */

require("dotenv").config();


/* =========================================================
   DEPENDENCIAS
   ========================================================= */

const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const multer = require("multer");

const {
  MercadoPagoConfig,
  Preference
} = require("mercadopago");


/* =========================================================
   APLICACIÓN
   ========================================================= */

const app = express();

const PORT =
  Number(process.env.PORT) || 4000;


/* =========================================================
   MERCADO PAGO
   ========================================================= */

const MERCADO_PAGO_ACCESS_TOKEN =
  process.env.MERCADO_PAGO_ACCESS_TOKEN;


let preference = null;


if (MERCADO_PAGO_ACCESS_TOKEN) {

  const mpClient =
    new MercadoPagoConfig({
      accessToken:
        MERCADO_PAGO_ACCESS_TOKEN
    });


  preference =
    new Preference(mpClient);

} else {

  console.warn(
    "ADVERTENCIA: MERCADO_PAGO_ACCESS_TOKEN no está configurado."
  );

}


/* =========================================================
   CONFIGURACIÓN EXPRESS
   ========================================================= */

app.disable("x-powered-by");


app.use(
  express.json({
    limit: "1mb"
  })
);


app.use(
  express.urlencoded({
    extended: true,
    limit: "1mb"
  })
);


/* =========================================================
   RUTAS DEL PROYECTO
   ========================================================= */

const publicDir =
  path.join(
    __dirname,
    "public"
  );


const uploadDir =
  path.join(
    publicDir,
    "uploads"
  );


const dataPath =
  path.join(
    __dirname,
    "productos.json"
  );


const pedidosPath =
  path.join(
    __dirname,
    "pedidos.json"
  );


const ventasPath =
  path.join(
    __dirname,
    "ventas.json"
  );


/* =========================================================
   CREAR CARPETAS Y ARCHIVOS NECESARIOS
   ========================================================= */

function asegurarDirectorio(ruta) {

  if (!fs.existsSync(ruta)) {

    fs.mkdirSync(
      ruta,
      {
        recursive: true
      }
    );

  }

}


function asegurarArchivoJSON(ruta) {

  if (!fs.existsSync(ruta)) {

    fs.writeFileSync(
      ruta,
      "[]",
      "utf8"
    );

  }

}


asegurarDirectorio(publicDir);

asegurarDirectorio(uploadDir);

asegurarArchivoJSON(dataPath);

asegurarArchivoJSON(pedidosPath);

asegurarArchivoJSON(ventasPath);


/* =========================================================
   FUNCIONES PARA LEER / GUARDAR JSON
   ========================================================= */

function leerJSON(ruta) {

  try {

    const contenido =
      fs.readFileSync(
        ruta,
        "utf8"
      );


    const datos =
      JSON.parse(contenido);


    return Array.isArray(datos)
      ? datos
      : [];


  } catch (error) {

    console.error(
      `Error leyendo ${ruta}:`,
      error
    );


    return [];

  }

}


function guardarJSON(
  ruta,
  datos
) {

  fs.writeFileSync(
    ruta,
    JSON.stringify(
      datos,
      null,
      2
    ),
    "utf8"
  );

}


/* =========================================================
   ARCHIVOS ESTÁTICOS
   ========================================================= */

app.use(
  express.static(
    publicDir,
    {
      index: "index.html",
      maxAge: "1h"
    }
  )
);


/* =========================================================
   MULTER
   SUBIDA SEGURA DE IMÁGENES
   ========================================================= */

const TIPOS_IMAGEN_PERMITIDOS =
  new Set([
    "image/jpeg",
    "image/png",
    "image/webp"
  ]);


const storage =
  multer.diskStorage({

    destination:
      (req, file, cb) => {

        cb(
          null,
          uploadDir
        );

      },


    filename:
      (req, file, cb) => {

        /*
         * No confiamos en el nombre original
         * enviado por el navegador.
         */

        let extension =
          path
            .extname(
              file.originalname
            )
            .toLowerCase();


        const extensionesPermitidas =
          new Set([
            ".jpg",
            ".jpeg",
            ".png",
            ".webp"
          ]);


        if (
          !extensionesPermitidas.has(
            extension
          )
        ) {

          if (
            file.mimetype ===
            "image/png"
          ) {

            extension = ".png";

          } else if (
            file.mimetype ===
            "image/webp"
          ) {

            extension = ".webp";

          } else {

            extension = ".jpg";

          }

        }


        const identificador =
          crypto.randomBytes(16)
            .toString("hex");


        cb(
          null,
          `${Date.now()}-${identificador}${extension}`
        );

      }

  });


const upload =
  multer({

    storage,


    limits: {

      /*
       * Máximo 8 MB por fotografía.
       */

      fileSize:
        8 * 1024 * 1024,

      /*
       * 20 variantes + 1 imagen simple.
       */

      files: 21

    },


    fileFilter:
      (req, file, cb) => {

        if (
          !TIPOS_IMAGEN_PERMITIDOS.has(
            file.mimetype
          )
        ) {

          return cb(
            new Error(
              "Formato de imagen no permitido. Usa JPG, PNG o WEBP."
            )
          );

        }


        cb(
          null,
          true
        );

      }

  });


/* =========================================================
   UTILIDADES DE VALIDACIÓN
   ========================================================= */

function textoSeguro(
  valor,
  maximo = 500
) {

  if (
    typeof valor !== "string"
  ) {

    return "";

  }


  return valor
    .trim()
    .slice(
      0,
      maximo
    );

}


function numeroPositivo(
  valor
) {

  const numero =
    Number(valor);


  if (
    !Number.isFinite(numero) ||
    numero <= 0
  ) {

    return null;

  }


  return numero;

}


function enteroNoNegativo(
  valor
) {

  const numero =
    Number(valor);


  if (
    !Number.isInteger(numero) ||
    numero < 0
  ) {

    return null;

  }


  return numero;

}


/* =========================================================
   ELIMINAR ARCHIVO SUBIDO
   ========================================================= */

function eliminarImagen(
  rutaPublica
) {

  if (
    !rutaPublica ||
    typeof rutaPublica !== "string"
  ) {

    return;

  }


  try {

    /*
     * Solo permitimos eliminar archivos
     * ubicados dentro de /uploads.
     */

    if (
      !rutaPublica.startsWith(
        "/uploads/"
      )
    ) {

      return;

    }


    const nombreArchivo =
      path.basename(
        rutaPublica
      );


    const rutaFisica =
      path.join(
        uploadDir,
        nombreArchivo
      );


    if (
      fs.existsSync(
        rutaFisica
      )
    ) {

      fs.unlinkSync(
        rutaFisica
      );

    }


  } catch (error) {

    console.error(
      "Error eliminando imagen:",
      error
    );

  }

}


/* =========================================================
   LIMPIAR IMÁGENES DE UNA PETICIÓN FALLIDA
   ========================================================= */

function eliminarArchivosPeticion(
  req
) {

  if (!req.files) {

    return;

  }


  const archivos = [];


  Object.values(
    req.files
  ).forEach(
    grupo => {

      if (
        Array.isArray(grupo)
      ) {

        archivos.push(
          ...grupo
        );

      }

    }
  );


  archivos.forEach(
    archivo => {

      if (
        archivo &&
        archivo.filename
      ) {

        eliminarImagen(
          `/uploads/${archivo.filename}`
        );

      }

    }
  );

}


/* =========================================================
   API - OBTENER PRODUCTOS
   ========================================================= */

app.get(
  "/api/productos",
  (req, res) => {

    try {

      const productos =
        leerJSON(
          dataPath
        );


      res.json(
        productos
      );


    } catch (error) {

      console.error(
        "Error leyendo productos:",
        error
      );


      res.status(500).json({

        mensaje:
          "Error leyendo productos"

      });

    }

  }
);


/* =========================================================
   API - CREAR PRODUCTO

   Admite:

   PRODUCTO NORMAL
   imagen

   PRODUCTO CON VARIANTES
   nombresVariantes
   imagenesVariantes
   ========================================================= */

app.post(
  "/api/productos",

  upload.fields([

    {
      name: "imagen",
      maxCount: 1
    },

    {
      name: "imagenesVariantes",
      maxCount: 20
    }

  ]),

  (req, res) => {

    try {

      const productos =
        leerJSON(
          dataPath
        );


      /* =====================================================
         DATOS PRINCIPALES
         ===================================================== */

      const nombre =
        textoSeguro(
          req.body.nombre,
          150
        );


      const categoria =
        textoSeguro(
          req.body.categoria,
          80
        );


      const descripcion =
        textoSeguro(
          req.body.descripcion,
          3000
        );


      const precio =
        numeroPositivo(
          req.body.precio
        );


      const stock =
        enteroNoNegativo(
          req.body.stock
        );


      const tieneTonos =
        req.body.tieneTonos ===
        "si";


      /* =====================================================
         VALIDACIONES
         ===================================================== */

      if (!nombre) {

        eliminarArchivosPeticion(
          req
        );


        return res
          .status(400)
          .json({

            mensaje:
              "El nombre del producto es obligatorio"

          });

      }


      if (!categoria) {

        eliminarArchivosPeticion(
          req
        );


        return res
          .status(400)
          .json({

            mensaje:
              "La categoría es obligatoria"

          });

      }


      if (
        precio === null
      ) {

        eliminarArchivosPeticion(
          req
        );


        return res
          .status(400)
          .json({

            mensaje:
              "El precio debe ser mayor que cero"

          });

      }


      if (
        stock === null
      ) {

        eliminarArchivosPeticion(
          req
        );


        return res
          .status(400)
          .json({

            mensaje:
              "El stock debe ser un número entero válido"

          });

      }


      if (!descripcion) {

        eliminarArchivosPeticion(
          req
        );


        return res
          .status(400)
          .json({

            mensaje:
              "La descripción es obligatoria"

          });

      }


      /* =====================================================
         VARIANTES
         ===================================================== */

      let variantes = [];


      if (tieneTonos) {

        let nombresVariantes =
          req.body.nombresVariantes ||
          [];


        /*
         * Con una sola variante Express devuelve
         * string. Con varias devuelve array.
         */

        if (
          !Array.isArray(
            nombresVariantes
          )
        ) {

          nombresVariantes =
            [
              nombresVariantes
            ];

        }


        nombresVariantes =
          nombresVariantes
            .map(
              nombreVariante =>
                textoSeguro(
                  nombreVariante,
                  80
                )
            )
            .filter(Boolean);


        const imagenesVariantes =
          req.files
            ?.imagenesVariantes ||
          [];


        if (
          nombresVariantes.length === 0
        ) {

          eliminarArchivosPeticion(
            req
          );


          return res
            .status(400)
            .json({

              mensaje:
                "Debes agregar al menos un color o tono"

            });

        }


        if (
          nombresVariantes.length !==
          imagenesVariantes.length
        ) {

          eliminarArchivosPeticion(
            req
          );


          return res
            .status(400)
            .json({

              mensaje:
                "Cada color debe tener su propia fotografía"

            });

        }


        /*
         * Evitamos nombres repetidos:
         * Rosa, Rosa, Rosa...
         */

        const nombresNormalizados =
          nombresVariantes.map(
            variante =>
              variante
                .toLocaleLowerCase(
                  "es-CO"
                )
          );


        if (
          new Set(
            nombresNormalizados
          ).size !==
          nombresNormalizados.length
        ) {

          eliminarArchivosPeticion(
            req
          );


          return res
            .status(400)
            .json({

              mensaje:
                "No puedes repetir el mismo color o tono"

            });

        }


        variantes =
          nombresVariantes.map(
            (
              nombreVariante,
              index
            ) => ({

              nombre:
                nombreVariante,

              imagen:
                `/uploads/${imagenesVariantes[index].filename}`

            })
          );

      }


      /* =====================================================
         IMAGEN PRINCIPAL
         ===================================================== */

      let imagenPrincipal =
        "";


      if (tieneTonos) {

        /*
         * La primera variante se convierte en
         * la fotografía principal del producto.
         */

        imagenPrincipal =
          variantes[0]
            ?.imagen ||
          "";

      } else {

        const imagenSimple =
          req.files
            ?.imagen
            ?.[0];


        if (imagenSimple) {

          imagenPrincipal =
            `/uploads/${imagenSimple.filename}`;

        }

      }


      if (!imagenPrincipal) {

        eliminarArchivosPeticion(
          req
        );


        return res
          .status(400)
          .json({

            mensaje:
              "Debes subir al menos una fotografía del producto"

          });

      }


      /* =====================================================
         ARRAY TONOS

         Lo mantenemos porque el catálogo/carrito
         antiguo ya utiliza producto.tonos.

         Así no rompemos compatibilidad.
         ===================================================== */

      const tonos =
        variantes.map(
          variante =>
            variante.nombre
        );


      /* =====================================================
         NUEVO PRODUCTO
         ===================================================== */

      const nuevoProducto = {

        id:
          Date.now(),

        nombre,

        categoria,

        precio,

        stock,

        descripcion,

        tieneTonos,

        tonos,

        variantes,

        imagen:
          imagenPrincipal,

        fechaCreacion:
          new Date()
            .toISOString()

      };


      /* =====================================================
         GUARDAR
         ===================================================== */

      productos.push(
        nuevoProducto
      );


      guardarJSON(
        dataPath,
        productos
      );


      res
        .status(201)
        .json({

          mensaje:
            "Producto agregado correctamente",

          producto:
            nuevoProducto

        });


    } catch (error) {

      /*
       * Si ocurre un error después de que Multer
       * guardó las imágenes, intentamos borrarlas
       * para no dejar archivos huérfanos.
       */

      eliminarArchivosPeticion(
        req
      );


      console.error(
        "Error guardando producto:",
        error
      );


      res
        .status(500)
        .json({

          mensaje:
            "Error interno guardando producto"

        });

    }

  }
);


/* =========================================================
   API - ELIMINAR PRODUCTO
   ========================================================= */

app.delete(
  "/api/productos/:id",
  (req, res) => {

    try {

      const id =
        String(
          req.params.id
        );


      let productos =
        leerJSON(
          dataPath
        );


      const producto =
        productos.find(
          productoActual =>
            String(
              productoActual.id
            ) === id
        );


      if (!producto) {

        return res
          .status(404)
          .json({

            mensaje:
              "Producto no encontrado"

          });

      }


      /*
       * Primero actualizamos productos.json.
       */

      productos =
        productos.filter(
          productoActual =>
            String(
              productoActual.id
            ) !== id
        );


      guardarJSON(
        dataPath,
        productos
      );


      /*
       * Utilizamos Set para evitar intentar borrar
       * dos veces la misma imagen.
       *
       * La imagen principal de un producto con
       * variantes también es la imagen de la
       * primera variante.
       */

      const imagenes =
        new Set();


      if (
        producto.imagen
      ) {

        imagenes.add(
          producto.imagen
        );

      }


      if (
        Array.isArray(
          producto.variantes
        )
      ) {

        producto.variantes.forEach(
          variante => {

            if (
              variante &&
              variante.imagen
            ) {

              imagenes.add(
                variante.imagen
              );

            }

          }
        );

      }


      imagenes.forEach(
        imagen => {

          eliminarImagen(
            imagen
          );

        }
      );


      res.json({

        mensaje:
          "Producto eliminado correctamente"

      });


    } catch (error) {

      console.error(
        "Error eliminando producto:",
        error
      );


      res
        .status(500)
        .json({

          mensaje:
            "Error eliminando producto"

        });

    }

  }
);


/* =========================================================
   ENVÍOS
   ========================================================= */

const PRECIO_KM =
  Number(
    process.env.PRECIO_KM ||
    1500
  );


app.post(
  "/api/calcular-envio",
  (req, res) => {

    try {

      const barrio =
        textoSeguro(
          req.body.barrio,
          120
        );


      if (!barrio) {

        return res
          .status(400)
          .json({

            mensaje:
              "El barrio es obligatorio"

          });

      }


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


      const barrioNormalizado =
        barrio
          .toLocaleLowerCase(
            "es-CO"
          )
          .trim();


      const distanciaKm =
        distanciasMedellin[
          barrioNormalizado
        ];


      if (!distanciaKm) {

        return res
          .status(404)
          .json({

            mensaje:
              "Por ahora no tenemos ese barrio registrado. Escríbenos por WhatsApp para confirmar el domicilio."

          });

      }


      const valorEnvio =
        distanciaKm *
        PRECIO_KM;


      res.json({

        ciudad:
          "Medellín",

        barrio,

        distanciaKm,

        distanciaCobradaKm:
          distanciaKm,

        precioKm:
          PRECIO_KM,

        valorEnvio

      });


    } catch (error) {

      console.error(
        "Error calculando envío:",
        error
      );


      res
        .status(500)
        .json({

          mensaje:
            "Error calculando envío"

        });

    }

  }
);


/* =========================================================
   VALIDACIÓN BÁSICA DE CLIENTE
   ========================================================= */

function normalizarCliente(
  cliente
) {

  if (
    !cliente ||
    typeof cliente !== "object"
  ) {

    return null;

  }


  const clienteLimpio = {

    nombre:
      textoSeguro(
        cliente.nombre,
        150
      ),

    telefono:
      textoSeguro(
        cliente.telefono,
        50
      ),

    direccion:
      textoSeguro(
        cliente.direccion,
        250
      ),

    barrio:
      textoSeguro(
        cliente.barrio,
        120
      )

  };


  if (
    !clienteLimpio.nombre ||
    !clienteLimpio.telefono ||
    !clienteLimpio.direccion ||
    !clienteLimpio.barrio
  ) {

    return null;

  }


  return clienteLimpio;

}


/* =========================================================
   API - CREAR PEDIDO
   ========================================================= */

app.post(
  "/api/pedidos",
  (req, res) => {

    try {

      const pedidos =
        leerJSON(
          pedidosPath
        );


      const cliente =
        normalizarCliente(
          req.body.cliente
        );


      if (!cliente) {

        return res
          .status(400)
          .json({

            mensaje:
              "Los datos del cliente están incompletos"

          });

      }


      if (
        !Array.isArray(
          req.body.productos
        ) ||
        req.body.productos.length === 0
      ) {

        return res
          .status(400)
          .json({

            mensaje:
              "El pedido debe contener productos"

          });

      }


      /*
       * Por ahora conservamos la estructura de
       * productos que ya utiliza tu carrito.
       *
       * Más adelante conviene recalcular precios
       * y stock exclusivamente desde el servidor.
       */

      const productos =
        req.body.productos.map(
          producto => ({

            id:
              producto.id,

            nombre:
              textoSeguro(
                producto.nombre,
                150
              ),

            precio:
              Number(
                producto.precio
              ),

            cantidad:
              Number(
                producto.cantidad
              ),

            tono:
              textoSeguro(
                producto.tono,
                80
              ),

            imagen:
              textoSeguro(
                producto.imagen,
                500
              )

          })
        );


      const subtotal =
        Number(
          req.body.subtotal
        );


      const envio =
        Number(
          req.body.envio
        );


      const total =
        Number(
          req.body.total
        );


      if (
        !Number.isFinite(subtotal) ||
        !Number.isFinite(envio) ||
        !Number.isFinite(total) ||
        subtotal < 0 ||
        envio < 0 ||
        total <= 0
      ) {

        return res
          .status(400)
          .json({

            mensaje:
              "Los valores del pedido no son válidos"

          });

      }


      const nuevoPedido = {

        id:
          Date.now(),

        fecha:
          new Date()
            .toLocaleString(
              "es-CO",
              {
                timeZone:
                  "America/Bogota"
              }
            ),

        cliente,

        productos,

        subtotal,

        envio,

        total,

        estado:
          "Pendiente"

      };


      pedidos.push(
        nuevoPedido
      );


      guardarJSON(
        pedidosPath,
        pedidos
      );


      res
        .status(201)
        .json({

          mensaje:
            "Pedido creado correctamente",

          pedido:
            nuevoPedido

        });


    } catch (error) {

      console.error(
        "Error creando pedido:",
        error
      );


      res
        .status(500)
        .json({

          mensaje:
            "Error creando pedido"

        });

    }

  }
);


/* =========================================================
   API - OBTENER PEDIDOS
   ========================================================= */

app.get(
  "/api/pedidos",
  (req, res) => {

    try {

      const pedidos =
        leerJSON(
          pedidosPath
        );


      res.json(
        pedidos
      );


    } catch (error) {

      console.error(
        "Error leyendo pedidos:",
        error
      );


      res
        .status(500)
        .json({

          mensaje:
            "Error leyendo pedidos"

        });

    }

  }
);


/* =========================================================
   API - OBTENER UN PEDIDO
   ========================================================= */

app.get(
  "/api/pedidos/:id",
  (req, res) => {

    try {

      const pedidos =
        leerJSON(
          pedidosPath
        );


      const pedido =
        pedidos.find(
          pedidoActual =>
            String(
              pedidoActual.id
            ) ===
            String(
              req.params.id
            )
        );


      if (!pedido) {

        return res
          .status(404)
          .json({

            mensaje:
              "Pedido no encontrado"

          });

      }


      res.json(
        pedido
      );


    } catch (error) {

      console.error(
        "Error leyendo pedido:",
        error
      );


      res
        .status(500)
        .json({

          mensaje:
            "Error leyendo pedido"

        });

    }

  }
);


/* =========================================================
   ESTADOS PERMITIDOS DEL PEDIDO
   ========================================================= */

const ESTADOS_PEDIDO =
  new Set([

    "Pendiente",

    "Confirmado",

    "Preparando",

    "Enviado",

    "Entregado",

    "Cancelado"

  ]);


/* =========================================================
   API - CAMBIAR ESTADO
   ========================================================= */

app.put(
  "/api/pedidos/:id/estado",
  (req, res) => {

    try {

      const estado =
        textoSeguro(
          req.body.estado,
          30
        );


      if (
        !ESTADOS_PEDIDO.has(
          estado
        )
      ) {

        return res
          .status(400)
          .json({

            mensaje:
              "Estado de pedido no válido"

          });

      }


      let pedidos =
        leerJSON(
          pedidosPath
        );


      const ventas =
        leerJSON(
          ventasPath
        );


      const pedido =
        pedidos.find(
          pedidoActual =>
            String(
              pedidoActual.id
            ) ===
            String(
              req.params.id
            )
        );


      if (!pedido) {

        return res
          .status(404)
          .json({

            mensaje:
              "Pedido no encontrado"

          });

      }


      pedido.estado =
        estado;


      if (
        estado ===
        "Entregado"
      ) {

        pedido.fechaEntregado =
          new Date()
            .toLocaleString(
              "es-CO",
              {
                timeZone:
                  "America/Bogota"
              }
            );


        /*
         * Evitamos duplicar accidentalmente una
         * venta con el mismo ID.
         */

        const yaExisteVenta =
          ventas.some(
            venta =>
              String(
                venta.id
              ) ===
              String(
                pedido.id
              )
          );


        if (!yaExisteVenta) {

          ventas.push(
            pedido
          );

        }


        pedidos =
          pedidos.filter(
            pedidoActual =>
              String(
                pedidoActual.id
              ) !==
              String(
                req.params.id
              )
          );

      }


      guardarJSON(
        pedidosPath,
        pedidos
      );


      guardarJSON(
        ventasPath,
        ventas
      );


      res.json({

        mensaje:
          "Estado actualizado",

        pedido

      });


    } catch (error) {

      console.error(
        "Error actualizando pedido:",
        error
      );


      res
        .status(500)
        .json({

          mensaje:
            "Error actualizando pedido"

        });

    }

  }
);


/* =========================================================
   API - HISTORIAL DE VENTAS
   ========================================================= */

app.get(
  "/api/ventas",
  (req, res) => {

    try {

      const ventas =
        leerJSON(
          ventasPath
        );


      res.json(
        ventas
      );


    } catch (error) {

      console.error(
        "Error leyendo ventas:",
        error
      );


      res
        .status(500)
        .json({

          mensaje:
            "Error leyendo ventas"

        });

    }

  }
);


/* =========================================================
   MERCADO PAGO
   ========================================================= */

app.post(
  "/api/crear-pago",
  async (req, res) => {

    try {

      if (!preference) {

        return res
          .status(503)
          .json({

            mensaje:
              "Mercado Pago no está configurado"

          });

      }


      const pedidoId =
        req.body.pedidoId;


      if (!pedidoId) {

        return res
          .status(400)
          .json({

            mensaje:
              "El pedido es obligatorio"

          });

      }


      const pedidos =
        leerJSON(
          pedidosPath
        );


      const pedido =
        pedidos.find(
          pedidoActual =>
            String(
              pedidoActual.id
            ) ===
            String(
              pedidoId
            )
        );


      if (!pedido) {

        return res
          .status(404)
          .json({

            mensaje:
              "Pedido no encontrado"

          });

      }


      const items =
        pedido.productos.map(
          producto => ({

            title:
              producto.tono
                ?
                `${producto.nombre} - ${producto.tono}`
                :
                producto.nombre,

            quantity:
              Number(
                producto.cantidad
              ),

            unit_price:
              Number(
                producto.precio
              ),

            currency_id:
              "COP"

          })
        );


      if (
        Number(
          pedido.envio
        ) > 0
      ) {

        items.push({

          title:
            "Envío a domicilio",

          quantity:
            1,

          unit_price:
            Number(
              pedido.envio
            ),

          currency_id:
            "COP"

        });

      }


      /*
       * En producción utiliza APP_BASE_URL
       * desde Render.
       */

      const baseUrl =
        (
          process.env.APP_BASE_URL ||
          "https://blushea-beauty-cosmetics.onrender.com"
        )
          .replace(
            /\/+$/,
            ""
          );


      const response =
        await preference.create({

          body: {

            items,

            external_reference:
              String(
                pedido.id
              ),

            back_urls: {

              success:
                `${baseUrl}/seguimiento.html?id=${encodeURIComponent(pedido.id)}`,

              failure:
                `${baseUrl}/carrito.html`,

              pending:
                `${baseUrl}/seguimiento.html?id=${encodeURIComponent(pedido.id)}`

            },

            auto_return:
              "approved"

          }

        });


      if (
        !response ||
        !response.init_point
      ) {

        throw new Error(
          "Mercado Pago no devolvió init_point"
        );

      }


      res.json({

        init_point:
          response.init_point

      });


    } catch (error) {

      console.error(
        "Error creando pago Mercado Pago:",
        error
      );


      res
        .status(500)
        .json({

          mensaje:
            "Error creando pago en Mercado Pago"

        });

    }

  }
);


/* =========================================================
   ERROR DE MULTER / ARCHIVOS
   ========================================================= */

app.use(
  (error, req, res, next) => {

    if (
      error instanceof
      multer.MulterError
    ) {

      console.error(
        "Error Multer:",
        error
      );


      if (
        error.code ===
        "LIMIT_FILE_SIZE"
      ) {

        return res
          .status(400)
          .json({

            mensaje:
              "Una de las imágenes supera el máximo permitido de 8 MB"

          });

      }


      if (
        error.code ===
        "LIMIT_FILE_COUNT"
      ) {

        return res
          .status(400)
          .json({

            mensaje:
              "Has intentado subir demasiadas imágenes"

          });

      }


      return res
        .status(400)
        .json({

          mensaje:
            "Error procesando las imágenes"

        });

    }


    if (
      error &&
      error.message &&
      error.message.includes(
        "Formato de imagen no permitido"
      )
    ) {

      return res
        .status(400)
        .json({

          mensaje:
            error.message

        });

    }


    next(error);

  }
);


/* =========================================================
   404 PARA API
   ========================================================= */

app.use(
  "/api",
  (req, res) => {

    res
      .status(404)
      .json({

        mensaje:
          "Ruta de API no encontrada"

      });

  }
);


/* =========================================================
   ERROR GENERAL
   ========================================================= */

app.use(
  (error, req, res, next) => {

    console.error(
      "Error no controlado:",
      error
    );


    if (
      res.headersSent
    ) {

      return next(
        error
      );

    }


    res
      .status(500)
      .json({

        mensaje:
          "Error interno del servidor"

      });

  }
);


/* =========================================================
   INICIAR SERVIDOR
   ========================================================= */

app.listen(
  PORT,
  () => {

    console.log(
      `BLUSHÉA funcionando en puerto ${PORT}`
    );

    console.log(
      `Local: http://localhost:${PORT}`
    );

  }
);