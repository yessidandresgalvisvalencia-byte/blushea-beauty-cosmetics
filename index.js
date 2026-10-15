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
      maxAge: 0,
      setHeaders: (res, archivo) => {
        if (/\.html$/i.test(archivo)) {
          res.setHeader("Cache-Control", "no-store, must-revalidate");
        }
      }
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
   CATÁLOGO MAQUILLAJE · PRÓXIMAMENTE

   Se muestra nombre, descripción y tonos confirmados.
   Sin precio, stock ni imagen hasta completar la ficha.
   ========================================================= */

const CATALOGO_ACCESORIOS_DOCUMENTO_BASE = require("./data/catalogo-accesorios-documento.json");
const CATALOGO_IMAGENES_MANIFEST = require("./data/catalogo-imagenes-manifest.json");

function prepararImagenesCatalogo(producto) {
  const archivos = CATALOGO_IMAGENES_MANIFEST[producto.id] || [];
  const imagenes = archivos.map((archivo) => `/catalogo/${archivo}`);
  return { ...producto, imagenes, imagen: producto.imagen || "" };
}

const CATALOGO_ACCESORIOS_DOCUMENTO = CATALOGO_ACCESORIOS_DOCUMENTO_BASE.map(prepararImagenesCatalogo);

const CATALOGO_MAQUILLAJE_PROXIMAMENTE = [
  {id:"makeup-ruby-rose-feels",nombre:"Corrector Líquido Ruby Rose Feels",categoria:"Correctores",descripcion:"Corrector líquido con aplicador incorporado para complementar la rutina y trabajar ojeras, pequeñas imperfecciones o áreas donde quieras unificar visualmente el tono de la piel.",tonos:["Caramelo 50","Amendoa 30","Castanha 20"]},
  {id:"makeup-atenea-concealer",nombre:"Corrector Atenea 1st Scene Concealer",categoria:"Correctores",descripcion:"Corrector de maquillaje para unificar visualmente el tono y trabajar imperfecciones localizadas.",tonos:["00 Light","0.5 Warm Ivory","01 Natural","02 Beige","03 Vanilla","04 Ivory","4.5 Olive Beige","05 Espresso","5.5 Desert","06 Orange","07 Rose","08 Cocoa","09 Lila"]},
  {id:"makeup-anik-concealer",nombre:"Corrector de Ojeras Ani-K Makeup",categoria:"Correctores",descripcion:"Corrector líquido diseñado para complementar tu maquillaje y ayudarte a conseguir una apariencia más uniforme y definida. Presentación de 4.3 ml.",tonos:["00 Snow","01 Bone","02 Radiant","03 Honey","04 Ginger","05 Golden Brown"]},
  {id:"makeup-atenea-foundation",nombre:"Base líquida Atenea 1st Scene",categoria:"Bases",descripcion:"Base líquida para ayudar a unificar visualmente el tono del rostro.",tonos:["Light","Porcelain","Cream","Vainilla","Almond","Olive","Temple","Sand","Ebony"]},
  {id:"makeup-bloomshell-foundation",nombre:"Bloomshell My Foundation 2 en 1",categoria:"Bases",descripcion:"Producto de maquillaje que combina funciones de base y corrector.",tonos:["1","2","2.5","3","4","4.2","4.5","4.8","5","6","6.5","7"]},
  {id:"makeup-lulia-mate",nombre:"Base Líquida Mate Lulia",categoria:"Bases",descripcion:"Base líquida de acabado mate, ideal para unificar visualmente el tono de la piel y crear una apariencia más uniforme.",tonos:["01","02","03","04","05","06"]},
  {id:"makeup-montoc-foundation",nombre:"Base Líquida MONTOC Humide Healthy Foundation",categoria:"Bases",descripcion:"Base líquida ideal para unificar visualmente el tono de la piel y lograr una apariencia más uniforme y natural. Presentación en tubo.",tonos:["100","200","250","300","350","400","500"]},
  {id:"makeup-la-colors-truly-matte",nombre:"Base Líquida L.A. Colors Truly Matte",categoria:"Bases",descripcion:"Base líquida de acabado mate para unificar visualmente el tono de la piel. Su dispensador permite una aplicación práctica y controlada.",tonos:["351 Porcelain","352 Natural","353 Nude","354 Soft Beige","355 Medium Beige","356 Sand","357 Golden Beige","358 Warm Honey","359 Cool Beige","360 Café","361 Deep Tan","362 Warm Caramel","363 Cappuccino","364 Mahogany"]},
  {id:"makeup-vogue-foundation",nombre:"Base Líquida Vogue Resist 12H",categoria:"Bases",descripcion:"Base líquida ideal para unificar visualmente el tono de la piel y lograr un maquillaje con apariencia uniforme durante el día.",tonos:["Natural","Trigo","Gitano","Arena","Bronce","Avellana","Canela"]},
  {id:"makeup-dolce-bella-concealer",nombre:"Correctores de Color Dolce Bella Liquid Concealer",categoria:"Correctores",descripcion:"Correctores de color para complementar la preparación de la piel antes de la base. Cada referencia ayuda a neutralizar visualmente diferentes tonalidades del rostro. Presentación de 10 ml.",tonos:["1 Amarillo","3 Verde","8 Naranja"]}
].map((producto, indice) => prepararImagenesCatalogo({
  ...producto,
  // Valores solo para probar la experiencia de compra; NO son precios de venta.
  precio: [18900, 32900, 21900, 48900, 39900, 29900, 45900, 31900, 25900, 17900][indice],
  stock: 50,
  tieneTonos: producto.tonos.length > 0,
  variantes: producto.tonos.map((nombre) => ({ nombre, imagen: "" })),
  imagen: "",
  proximamente: false,
  precioPrueba: true,
  soloDemostracion: true
}));


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

        /*
         * El catálogo editorial no depende de Supabase.
         * Si el proveedor externo tiene una caída temporal,
         * seguimos mostrando los productos de maquillaje
         * que todavía están en preparación.
         */

        return res
          .status(200)
          .json(
            CATALOGO_MAQUILLAJE_PROXIMAMENTE.concat(CATALOGO_ACCESORIOS_DOCUMENTO)
          );

      }


      const productos =
        (data || [])
          .map(
            mapearProducto
          );


      res.json(
        productos.concat(CATALOGO_MAQUILLAJE_PROXIMAMENTE, CATALOGO_ACCESORIOS_DOCUMENTO)
      );


    } catch (error) {

      console.error(
        "Error leyendo productos:",
        error
      );

      /*
       * También protegemos el catálogo frente a errores de red
       * lanzados antes de que Supabase pueda devolver { error }.
       */
      return res
        .status(200)
        .json(
          CATALOGO_MAQUILLAJE_PROXIMAMENTE.concat(CATALOGO_ACCESORIOS_DOCUMENTO)
        );

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

const PRECIO_KM = 1200;
const ORIGEN_ENVIO = "Buenos Aires, Medellín, Antioquia, Colombia";
const CACHE_GEOCODIFICACION = new Map();
const CACHE_GEOCODIFICACION_MS = 24 * 60 * 60 * 1000;

function normalizarDireccionMedellin(direccion) {
  const limpia = String(direccion || "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\b(cra|cr|carrera)\.?\s*/i, "Carrera ")
    .replace(/\b(cl|calle)\.?\s*/i, "Calle ")
    .replace(/\b(transv|transversal)\.?\s*/i, "Transversal ")
    .replace(/\b(diag|diagonal)\.?\s*/i, "Diagonal ");

  // Convierte, por ejemplo, "carrera 29 38 f 187" en
  // "Carrera 29 # 38F-187", nomenclatura que los geocodificadores
  // reconocen con mucha más consistencia en Medellín.
  return limpia.replace(
    /^(Carrera|Calle|Transversal|Diagonal)\s+(\d+[A-Za-z]?)\s+(?:#\s*)?(\d+)\s*([A-Za-z]?)\s*[- ]?\s*(\d+)$/i,
    (_, via, numeroVia, numeroCruce, letra, placa) =>
      via + " " + numeroVia + " # " + numeroCruce + (letra ? letra.toUpperCase() : "") + "-" + placa
  );
}

async function geocodificarEnvio(consulta) {
  const clave = consulta.toLocaleLowerCase("es-CO").trim();
  const cache = CACHE_GEOCODIFICACION.get(clave);
  if (cache && cache.expira > Date.now()) return cache.coordenadas;
  const parametros = new URLSearchParams({
    q: consulta,
    format: "jsonv2",
    limit: "1",
    countrycodes: "co"
  });
  const respuesta = await fetch(
    "https://nominatim.openstreetmap.org/search?" + parametros.toString(),
    {
      headers: {
        "User-Agent": "BlusheaBeautyShipping/1.0",
        "Accept-Language": "es-CO,es"
      },
      signal: AbortSignal.timeout(4500)
    }
  );
  if (!respuesta.ok) return null;
  const datos = await respuesta.json();
  if (!Array.isArray(datos) || !datos[0]) return null;
  const lat = Number(datos[0].lat);
  const lon = Number(datos[0].lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const coordenadas = { lat, lon };
  CACHE_GEOCODIFICACION.set(clave, {
    coordenadas,
    expira: Date.now() + CACHE_GEOCODIFICACION_MS
  });
  if (CACHE_GEOCODIFICACION.size > 1000) {
    CACHE_GEOCODIFICACION.delete(CACHE_GEOCODIFICACION.keys().next().value);
  }
  return coordenadas;
}

async function distanciaConduccionKm(origen, destino) {
  const ruta = origen.lon + "," + origen.lat + ";" + destino.lon + "," + destino.lat;
  const respuesta = await fetch(
    "https://router.project-osrm.org/route/v1/driving/" + ruta + "?overview=false",
    { signal: AbortSignal.timeout(4500) }
  );
  if (!respuesta.ok) return null;
  const datos = await respuesta.json();
  const metros = Number(datos && datos.routes && datos.routes[0] && datos.routes[0].distance);
  return Number.isFinite(metros) ? metros / 1000 : null;
}

app.post("/api/calcular-envio", async (req, res) => {
  try {
    const direccion = textoSeguro(req.body.direccion, 250);
    const barrio = textoSeguro(req.body.barrio, 120);

    if (!direccion || !barrio) {
      return res.status(400).json({
        mensaje: "La dirección y el barrio son obligatorios"
      });
    }

    // El origen es fijo; evitamos geocodificarlo en cada cálculo.
    // Coordenadas aproximadas de Buenos Aires, Medellín.
    const origen = { lat: 6.2357, lon: -75.5526 };

    // Primero buscamos solo la dirección: los nombres de barrio suelen hacer
    // fallar o ralentizar Nominatim. El barrio se conserva para la entrega.
    const direccionNormalizada = normalizarDireccionMedellin(direccion);
    const consultasDestino = [
      direccionNormalizada + ", Medellín, Antioquia, Colombia",
      direccionNormalizada + ", " + barrio + ", Medellín, Colombia",
      direccion + ", Medellín, Antioquia, Colombia",
      barrio + ", Medellín, Antioquia, Colombia"
    ];

    let destino = null;
    for (const consulta of consultasDestino) {
      try {
        destino = await geocodificarEnvio(consulta);
      } catch (error) {
        console.warn("Geocodificación fallida:", consulta, error.message);
      }
      if (destino) break;
    }

    if (!destino) {
      return res.status(422).json({
        mensaje: "No pudimos ubicar la zona de entrega. Escribe un barrio reconocido de Medellín."
      });
    }

    // Seguridad: Nominatim puede devolver coincidencias homónimas fuera del
    // Valle de Aburrá. No cotizamos una ruta si las coordenadas no corresponden
    // razonablemente a Medellín.
    const dentroDeMedellin =
      destino.lat >= 6.10 && destino.lat <= 6.38 &&
      destino.lon >= -75.70 && destino.lon <= -75.45;

    if (!dentroDeMedellin) {
      return res.status(422).json({
        mensaje: "La dirección o el barrio no parecen corresponder a Medellín."
      });
    }

    const distanciaKm = await distanciaConduccionKm(origen, destino);
    if (!Number.isFinite(distanciaKm) || distanciaKm < 0) {
      return res.status(503).json({
        mensaje: "No pudimos calcular la ruta del domicilio en este momento."
      });
    }

    const distanciaCobradaKm = Math.max(1, Math.ceil(distanciaKm));
    const valorEnvio = distanciaCobradaKm * PRECIO_KM;

    return res.json({
      ciudad: "Medellín",
      origen: "Buenos Aires",
      barrio,
      distanciaKm: Number(distanciaKm.toFixed(2)),
      distanciaCobradaKm,
      precioKm: PRECIO_KM,
      valorEnvio
    });
  } catch (error) {
    console.error("Error calculando envío:", error);
    return res.status(500).json({
      mensaje: "No pudimos calcular el domicilio."
    });
  }
});


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
  async (req, res) => {

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


      if (req.body.productos.some(producto =>
        CATALOGO_MAQUILLAJE_PROXIMAMENTE.concat(CATALOGO_ACCESORIOS_DOCUMENTO).some(demo => String(demo.id) === String(producto.id))
      )) {
        return res.status(409).json({
          mensaje: "Estos productos tienen precios de prueba. Puedes probar el carrito, pero no finalizar un pedido real."
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


      const productosValidos = productos.every(producto =>
        producto.nombre &&
        Number.isFinite(producto.precio) &&
        producto.precio >= 0 &&
        Number.isInteger(producto.cantidad) &&
        producto.cantidad >= 1 &&
        producto.cantidad <= 99
      );

      if (!productosValidos) {
        return res.status(400).json({
          mensaje: "Hay productos con precio o cantidad no válidos"
        });
      }

      const subtotalCalculado = productos.reduce(
        (acumulado, producto) => acumulado + producto.precio * producto.cantidad,
        0
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


      // El domicilio nunca se confía al navegador: se recalcula en servidor
      // usando el mismo origen y la misma tarifa vigentes.
      const origenPedido = { lat: 6.2357, lon: -75.5526 };
      const direccionPedidoNormalizada = normalizarDireccionMedellin(cliente.direccion);
      const consultasDestinoPedido = [
        direccionPedidoNormalizada + ", Medellín, Antioquia, Colombia",
        direccionPedidoNormalizada + ", " + cliente.barrio + ", Medellín, Colombia",
        cliente.direccion + ", Medellín, Antioquia, Colombia",
        cliente.barrio + ", Medellín, Antioquia, Colombia"
      ];

      let destinoPedido = null;
      for (const consulta of consultasDestinoPedido) {
        try {
          destinoPedido = await geocodificarEnvio(consulta);
        } catch (error) {
          console.warn("Geocodificación de pedido fallida:", consulta, error.message);
        }
        if (destinoPedido) break;
      }

      if (!destinoPedido) {
        return res.status(422).json({
          mensaje: "No pudimos ubicar la zona de entrega en Medellín."
        });
      }

      const distanciaPedidoKm = await distanciaConduccionKm(origenPedido, destinoPedido);

      if (!Number.isFinite(distanciaPedidoKm) || distanciaPedidoKm < 0) {
        return res.status(503).json({
          mensaje: "No pudimos validar la ruta del domicilio en este momento."
        });
      }

      const distanciaCobradaPedidoKm = Math.max(1, Math.ceil(distanciaPedidoKm));
      const envioServidor = distanciaCobradaPedidoKm * PRECIO_KM;

      if (
        !Number.isFinite(subtotal) ||
        !Number.isFinite(envio) ||
        !Number.isFinite(total) ||
        subtotal < 0 ||
        Math.abs(subtotal - subtotalCalculado) > 0.01 ||
        envio < 0 ||
        total <= 0 ||
        envio !== envioServidor ||
        Math.abs(total - (subtotal + envioServidor)) > 0.01
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

        subtotal: subtotalCalculado,

        envio: envioServidor,

        total: subtotalCalculado + envioServidor,

        distanciaEnvioKm: Number(distanciaPedidoKm.toFixed(2)),
        distanciaCobradaEnvioKm: distanciaCobradaPedidoKm,
        precioKmEnvio: PRECIO_KM,

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


      if (pedido.productos.some(producto =>
        CATALOGO_MAQUILLAJE_PROXIMAMENTE.concat(CATALOGO_ACCESORIOS_DOCUMENTO).some(demo => String(demo.id) === String(producto.id))
      )) {
        return res.status(409).json({
          mensaje: "Pago deshabilitado para productos con precios de prueba."
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