"use strict";

/* =========================================================
   BLUSHÉA BEAUTY COSMETICS
   BACKEND PRINCIPAL

   PRODUCTOS  -> SUPABASE POSTGRESQL
   IMÁGENES   -> SUPABASE STORAGE
   PEDIDOS    -> JSON (MIGRACIÓN POSTERIOR)
   VENTAS     -> JSON (MIGRACIÓN POSTERIOR)
   PAGOS      -> MERCADO PAGO
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
  createClient
} = require("@supabase/supabase-js");

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
   SUPABASE
   ========================================================= */

const SUPABASE_URL =
  process.env.SUPABASE_URL;

const SUPABASE_SECRET_KEY =
  process.env.SUPABASE_SECRET_KEY;

const SUPABASE_BUCKET =
  "productos";


if (
  !SUPABASE_URL ||
  !SUPABASE_SECRET_KEY
) {

  console.error(
    "ERROR: faltan SUPABASE_URL o SUPABASE_SECRET_KEY."
  );

  process.exit(1);

}


const supabase =
  createClient(
    SUPABASE_URL,
    SUPABASE_SECRET_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    }
  );


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
   RUTAS LOCALES

   IMPORTANTE:
   productos.json y public/uploads YA NO se utilizan
   para productos nuevos.

   pedidos.json y ventas.json continúan temporalmente.
   ========================================================= */

const publicDir =
  path.join(
    __dirname,
    "public"
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
   ARCHIVOS NECESARIOS
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
asegurarArchivoJSON(pedidosPath);
asegurarArchivoJSON(ventasPath);


/* =========================================================
   JSON TEMPORAL
   Solo pedidos y ventas.
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

   Ya NO escribe imágenes en el disco de Render.

   Las mantiene temporalmente en RAM mientras la petición
   se procesa y después se envían a Supabase Storage.
   ========================================================= */

const TIPOS_IMAGEN_PERMITIDOS =
  new Set([
    "image/jpeg",
    "image/png",
    "image/webp"
  ]);


const upload =
  multer({

    storage:
      multer.memoryStorage(),

    limits: {

      fileSize:
        8 * 1024 * 1024,

      files:
        21

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
   VALIDACIONES
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


function numeroPositivo(valor) {

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


function enteroNoNegativo(valor) {

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
   EXTENSIÓN SEGURA SEGÚN MIME
   ========================================================= */

function extensionPorMime(
  mimetype
) {

  switch (mimetype) {

    case "image/png":
      return "png";

    case "image/webp":
      return "webp";

    case "image/jpeg":
    default:
      return "jpg";

  }

}


/* =========================================================
   SUBIR IMAGEN A SUPABASE STORAGE
   ========================================================= */

async function subirImagenSupabase(
  archivo,
  carpetaProducto
) {

  if (
    !archivo ||
    !archivo.buffer
  ) {

    throw new Error(
      "Archivo de imagen inválido"
    );

  }


  const extension =
    extensionPorMime(
      archivo.mimetype
    );


  const identificador =
    crypto
      .randomBytes(16)
      .toString("hex");


  const rutaStorage =
    `${carpetaProducto}/${Date.now()}-${identificador}.${extension}`;


  const {
    error
  } =
    await supabase
      .storage
      .from(SUPABASE_BUCKET)
      .upload(
        rutaStorage,
        archivo.buffer,
        {
          contentType:
            archivo.mimetype,

          cacheControl:
            "31536000",

          upsert:
            false
        }
      );


  if (error) {

    console.error(
      "Error Supabase Storage:",
      error
    );

    throw new Error(
      "No se pudo guardar la fotografía"
    );

  }


  const {
    data
  } =
    supabase
      .storage
      .from(SUPABASE_BUCKET)
      .getPublicUrl(
        rutaStorage
      );


  if (
    !data ||
    !data.publicUrl
  ) {

    /*
     * Si por alguna razón no conseguimos la URL,
     * eliminamos el objeto que acabamos de crear.
     */

    await supabase
      .storage
      .from(SUPABASE_BUCKET)
      .remove([
        rutaStorage
      ]);

    throw new Error(
      "No se pudo generar la URL de la fotografía"
    );

  }


  return {

    url:
      data.publicUrl,

    path:
      rutaStorage

  };

}


/* =========================================================
   BORRAR OBJETOS DE SUPABASE STORAGE
   ========================================================= */

async function eliminarObjetosStorage(
  rutas
) {

  const rutasLimpias =
    [
      ...new Set(
        rutas.filter(Boolean)
      )
    ];


  if (
    rutasLimpias.length === 0
  ) {

    return;

  }


  const {
    error
  } =
    await supabase
      .storage
      .from(SUPABASE_BUCKET)
      .remove(
        rutasLimpias
      );


  if (error) {

    console.error(
      "No se pudieron eliminar algunas imágenes de Storage:",
      error
    );

  }

}


/* =========================================================
   OBTENER RUTA DE STORAGE DESDE URL PÚBLICA

   Esto permite borrar imágenes posteriormente sin tener
   que agregar otra columna a la tabla productos.
   ========================================================= */

function obtenerRutaStorageDesdeURL(
  url
) {

  if (
    !url ||
    typeof url !== "string"
  ) {

    return null;

  }


  try {

    const marcador =
      `/storage/v1/object/public/${SUPABASE_BUCKET}/`;


    const posicion =
      url.indexOf(
        marcador
      );


    if (
      posicion === -1
    ) {

      return null;

    }


    const ruta =
      url.slice(
        posicion +
        marcador.length
      );


    return decodeURIComponent(
      ruta
    );

  } catch (error) {

    console.error(
      "No se pudo interpretar URL de Storage:",
      error
    );

    return null;

  }

}


/* =========================================================
   CONVERTIR PRODUCTO SUPABASE -> FORMATO DEL FRONTEND

   La base usa snake_case.
   Tu catálogo actual usa camelCase.

   De esta forma NO necesitamos modificar ahora script.js,
   producto.html ni carrito.js.
   ========================================================= */

function mapearProducto(
  producto
) {

  return {

    id:
      producto.id,

    nombre:
      producto.nombre,

    categoria:
      producto.categoria,

    precio:
      Number(
        producto.precio
      ),

    stock:
      Number(
        producto.stock
      ),

    descripcion:
      producto.descripcion,

    tieneTonos:
      Boolean(
        producto.tiene_tonos
      ),

    tonos:
      Array.isArray(
        producto.tonos
      )
        ? producto.tonos
        : [],

    variantes:
      Array.isArray(
        producto.variantes
      )
        ? producto.variantes
        : [],

    imagen:
      producto.imagen,

    fechaCreacion:
      producto.fecha_creacion

  };

}


/* =========================================================
   API - OBTENER PRODUCTOS DESDE SUPABASE
   ========================================================= */

app.get(
  "/api/productos",
  async (req, res) => {

    try {

      const {
        data,
        error
      } =
        await supabase
          .from("productos")
          .select("*")
          .order(
            "fecha_creacion",
            {
              ascending:
                false
            }
          );


      if (error) {

        console.error(
          "Error Supabase obteniendo productos:",
          error
        );

        return res
          .status(500)
          .json({

            mensaje:
              "Error leyendo productos"

          });

      }


      const productos =
        (data || [])
          .map(
            mapearProducto
          );


      res.json(
        productos
      );


    } catch (error) {

      console.error(
        "Error leyendo productos:",
        error
      );


      res
        .status(500)
        .json({

          mensaje:
            "Error leyendo productos"

        });

    }

  }
);


/* =========================================================
   API - CREAR PRODUCTO EN SUPABASE
   ========================================================= */

app.post(
  "/api/productos",

  upload.fields([

    {
      name:
        "imagen",
      maxCount:
        1
    },

    {
      name:
        "imagenesVariantes",
      maxCount:
        20
    }

  ]),

  async (req, res) => {

    /*
     * Guardaremos aquí todas las rutas que se hayan subido
     * durante esta petición.
     *
     * Si la base de datos falla después, podemos limpiar
     * esas imágenes para no dejar archivos huérfanos.
     */

    const objetosSubidos = [];


    try {

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

        return res
          .status(400)
          .json({

            mensaje:
              "El nombre del producto es obligatorio"

          });

      }


      if (!categoria) {

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

        return res
          .status(400)
          .json({

            mensaje:
              "El stock debe ser un número entero válido"

          });

      }


      if (!descripcion) {

        return res
          .status(400)
          .json({

            mensaje:
              "La descripción es obligatoria"

          });

      }


      /*
       * Cada producto obtiene una carpeta única
       * dentro del bucket.
       */

      const carpetaProducto =
        crypto.randomUUID();


      let variantes = [];
      let imagenPrincipal = "";


      /* =====================================================
         PRODUCTO CON TONOS / VARIANTES
         ===================================================== */

      if (tieneTonos) {

        let nombresVariantes =
          req.body.nombresVariantes ||
          [];


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

          return res
            .status(400)
            .json({

              mensaje:
                "Cada color debe tener su propia fotografía"

            });

        }


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

          return res
            .status(400)
            .json({

              mensaje:
                "No puedes repetir el mismo color o tono"

            });

        }


        /*
         * Subimos cada fotografía a Supabase.
         */

        for (
          let index = 0;
          index < nombresVariantes.length;
          index += 1
        ) {

          const imagenSubida =
            await subirImagenSupabase(
              imagenesVariantes[index],
              carpetaProducto
            );


          objetosSubidos.push(
            imagenSubida.path
          );


          variantes.push({

            nombre:
              nombresVariantes[index],

            imagen:
              imagenSubida.url

          });

        }


        imagenPrincipal =
          variantes[0]
            ?.imagen ||
          "";

      }


      /* =====================================================
         PRODUCTO SIN TONOS
         ===================================================== */

      else {

        const imagenSimple =
          req.files
            ?.imagen
            ?.[0];


        if (!imagenSimple) {

          return res
            .status(400)
            .json({

              mensaje:
                "Debes subir al menos una fotografía del producto"

            });

        }


        const imagenSubida =
          await subirImagenSupabase(
            imagenSimple,
            carpetaProducto
          );


        objetosSubidos.push(
          imagenSubida.path
        );


        imagenPrincipal =
          imagenSubida.url;

      }


      if (!imagenPrincipal) {

        await eliminarObjetosStorage(
          objetosSubidos
        );


        return res
          .status(400)
          .json({

            mensaje:
              "Debes subir al menos una fotografía del producto"

          });

      }


      const tonos =
        variantes.map(
          variante =>
            variante.nombre
        );


      /* =====================================================
         INSERTAR PRODUCTO EN POSTGRESQL
         ===================================================== */

      const {
        data,
        error
      } =
        await supabase
          .from("productos")
          .insert({

            nombre,

            categoria,

            precio,

            stock,

            descripcion,

            tiene_tonos:
              tieneTonos,

            tonos,

            variantes,

            imagen:
              imagenPrincipal

          })
          .select("*")
          .single();


      if (error) {

        console.error(
          "Error insertando producto en Supabase:",
          error
        );


        await eliminarObjetosStorage(
          objetosSubidos
        );


        return res
          .status(500)
          .json({

            mensaje:
              "No se pudo guardar el producto"

          });

      }


      const nuevoProducto =
        mapearProducto(
          data
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
       * Si alguna parte de la operación falla,
       * intentamos borrar cualquier fotografía
       * que ya hubiese llegado a Storage.
       */

      await eliminarObjetosStorage(
        objetosSubidos
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
   API - ELIMINAR PRODUCTO DE SUPABASE
   ========================================================= */

app.delete(
  "/api/productos/:id",
  async (req, res) => {

    try {

      const id =
        String(
          req.params.id
        );


      /* =====================================================
         OBTENER PRODUCTO
         ===================================================== */

      const {
        data: producto,
        error: errorBusqueda
      } =
        await supabase
          .from("productos")
          .select("*")
          .eq(
            "id",
            id
          )
          .maybeSingle();


      if (errorBusqueda) {

        console.error(
          "Error buscando producto:",
          errorBusqueda
        );


        return res
          .status(500)
          .json({

            mensaje:
              "Error buscando producto"

          });

      }


      if (!producto) {

        return res
          .status(404)
          .json({

            mensaje:
              "Producto no encontrado"

          });

      }


      /* =====================================================
         REUNIR IMÁGENES
         ===================================================== */

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


      const rutasStorage =
        [...imagenes]
          .map(
            obtenerRutaStorageDesdeURL
          )
          .filter(Boolean);


      /* =====================================================
         BORRAR REGISTRO DE POSTGRESQL

         Primero quitamos el producto del catálogo.
         Si Storage falla posteriormente, como máximo queda
         un archivo huérfano, no un producto con imagen rota.
         ===================================================== */

      const {
        error: errorEliminacion
      } =
        await supabase
          .from("productos")
          .delete()
          .eq(
            "id",
            id
          );


      if (errorEliminacion) {

        console.error(
          "Error eliminando producto de Supabase:",
          errorEliminacion
        );


        return res
          .status(500)
          .json({

            mensaje:
              "Error eliminando producto"

          });

      }


      /* =====================================================
         BORRAR FOTOGRAFÍAS
         ===================================================== */

      await eliminarObjetosStorage(
        rutasStorage
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
   ESTADOS PERMITIDOS
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
   ERRORES DE MULTER
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
   404 API
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

    console.log(
      "Productos: Supabase PostgreSQL"
    );

    console.log(
      "Imágenes: Supabase Storage"
    );

  }
);