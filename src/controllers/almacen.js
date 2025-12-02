const express = require('express');
const { ubicacion, client, inventario, producto, requisicion, itemKit, materia, extension, kit, movimientoInventario, necesidadProyecto, cotizacion_compromiso, priceKit, productPrice, cotizacion, db: sequelize } = require('../db/db');
const { Op, QueryTypes  } = require('sequelize');
const dayjs = require('dayjs');
const { validateEmailService } = require('./services/userServices');
const { registrarMovimiento, registrarMovimientoMPONE, registrarMovimientoPTONE, comprometerStock, createCompromiso, getBodegaData, registrarMovimientoAlmacen, sacarDelInventario, trasladarPorCantidadAtomic, seleccionarYTrasladarParaProyecto, getItemOverviewEnriquecido, getItemOverviewByBodega, listarItemsEnInventario, listarItemsEnInventarioOptimizado, updateCompromisoEntregado, getItemsConMenosStock, getItemsConMasMovimiento, consolidarKit, sacaMateriasConsolidadoTransactional } = require('./services/inventarioServices');
const { default: axios } = require('axios');

// Item con menos stock
const getItemsConMenosStockController = async (req, res) => {
  try {
    const { tipo, ubicacionId, limit } = req.query;

    // Validación mínima
    if (!tipo || !['MP', 'PR'].includes(String(tipo).toUpperCase())) {
      return res.status(400).json({
        success: false,
        msg: "Query param 'tipo' requerido: use 'MP' para materia prima o 'PR' para producto terminado."
      });
    }

    const result = await getItemsConMenosStock({
      tipo: String(tipo).toUpperCase(),
      ubicacionId: ubicacionId ? Number(ubicacionId) : null,
      limit: limit ? Number(limit) : 20
    });

    return res.status(200).json(result);

  } catch (err) {
    console.error('getItemsConMenosStockController error:', err);
    return res.status(500).json({
      success: false,
      msg: 'Error interno del servidor',
      error: err.message
    });
  }
};

// Item con más movimiento
const getItemsConMasMovimientoController = async (req, res) => {
  try {
    let { tipo, ubicacionId, dateFrom, dateTo, limit, orderBy } = req.query;

    // Validación del tipo
    tipo = tipo ? tipo.toUpperCase() : null;
    if (!tipo || !['MP', 'PR'].includes(tipo)) {
      return res.status(400).json({
        success: false,
        msg: "El parámetro 'tipo' es requerido: MP o PR"
      });
    }

    ubicacionId = ubicacionId ? Number(ubicacionId) : null;
    limit = limit ? Number(limit) : 20;
    orderBy = orderBy === 'count' ? 'count' : 'qty'; // default qty

    // WHERE dinámico
    let where = `WHERE 1=1`;

    if (tipo === 'MP') {
      where += ` AND "materiumId" IS NOT NULL`;
    } else {
      where += ` AND "productoId" IS NOT NULL`;
    }

    if (ubicacionId) where += ` AND "ubicacionId" = ${ubicacionId}`;
    if (dateFrom) where += ` AND "createdAt" >= '${dateFrom}'`;
    if (dateTo) where += ` AND "createdAt" <= '${dateTo}'`;

    // Query principal
    const query = `
      SELECT
        COALESCE("materiumId", "productoId") AS "itemId",
        COUNT(*) AS "movCount",
        COALESCE(SUM(ABS("cantidad")), 0) AS "movQty"
      FROM "movimientoInventarios"
      ${where}
      GROUP BY COALESCE("materiumId", "productoId")
      ORDER BY ${orderBy === 'count' ? `"movCount" DESC` : `"movQty" DESC`}
      LIMIT ${limit};
    `;

    const rows = await sequelize.query(query, { type: QueryTypes.SELECT });

    // 🔥 AQUI AGREGAMOS EL NOMBRE DEL ÍTEM
    for (let r of rows) {
      if (tipo === "MP") {
        const mp = await sequelize.query(
          `SELECT description FROM "materia" WHERE id = ${r.itemId} LIMIT 1`,
          { type: QueryTypes.SELECT }
        );
        r.nombre = mp.length ? mp[0].description : null;
      } else {
        const pr = await sequelize.query(
          `SELECT item FROM "producto" WHERE id = ${r.itemId} LIMIT 1`,
          { type: QueryTypes.SELECT }
        );
        r.nombre = pr.length ? pr[0].item : null;
      }
    }

    return res.status(200).json({
      success: true,
      items: rows
    });

  } catch (err) {
    console.error('getItemsConMasMovimientoController error:', err);
    return res.status(500).json({
      success: false,
      msg: 'Error interno en el servidor',
      error: err.message
    });
  }
};

// Obtener items con más más en negativo
const getItemsConCompromisoNegativoController = async (req, res) => {
  try {
    let { tipo, ubicacionId, limit } = req.query;

    // --- 1. Validaciones ---
    tipo = tipo ? tipo.toUpperCase() : null;
    if (!tipo || !['MP', 'PR'].includes(tipo)) {
      return res.status(400).json({ success: false, msg: "El parámetro 'tipo' es requerido: MP o PR" });
    }
    
    limit = limit ? Number(limit) : 50;
    ubicacionId = ubicacionId ? Number(ubicacionId) : null;

    // --- 2. Configuración Dinámica ---
    // Determinamos qué ID buscar (Materia Prima o Producto Terminado)
    const idCol = tipo === 'MP' ? '"materiumId"' : '"productoId"';
    
    const replacements = { limit };
    let stockWhere = '';

    if (ubicacionId) {
        stockWhere = `AND "ubicacionId" = :ubicacionId`;
        replacements.ubicacionId = ubicacionId;
    }

    // --- 3. Query SQL Corregido ---
    // - Tabla: "cotizacion_compromisos" (Plural)
    // - Columna: "cantidadComprometida" (Según tu modelo)
    
    const query = `
      WITH SumaCompromisos AS (
        SELECT 
          ${idCol} as "itemId", 
          SUM("cantidadComprometida") as "totalComprometido", -- <--- CORREGIDO (antes era "cantidad")
          COUNT(*) as "numCompromisos"
        FROM "cotizacion_compromisos"  -- <--- CORREGIDO (Plural por defecto de Sequelize)
        WHERE ${idCol} IS NOT NULL
        GROUP BY ${idCol}
      ),
      SumaStock AS (
        SELECT 
          ${idCol} as "itemId",
          SUM("cantidadDisponible") as "totalStock"
        FROM "inventarioItemFisicos"   -- <--- Asegúrate que esta también sea plural (estándar Sequelize)
        WHERE ${idCol} IS NOT NULL
        ${stockWhere}
        GROUP BY ${idCol}
      )
      SELECT 
        c."itemId",
        COALESCE(c."numCompromisos", 0) AS "compromisosCount",
        COALESCE(c."totalComprometido", 0) AS "cantidadComprometida",
        COALESCE(s."totalStock", 0) AS "stockDisponible"
      FROM SumaCompromisos c
      LEFT JOIN SumaStock s ON c."itemId" = s."itemId"
      WHERE COALESCE(s."totalStock", 0) < COALESCE(c."totalComprometido", 0)
      ORDER BY (COALESCE(c."totalComprometido", 0) - COALESCE(s."totalStock", 0)) DESC
      LIMIT :limit;
    `;

    const rows = await sequelize.query(query, { 
        type: QueryTypes.SELECT,
        replacements: replacements
    });

    // --- 4. Obtener Nombres (Metadata) ---
    const itemsResultado = [];

    if (rows.length > 0) {
        const ids = rows.map(r => r.itemId);
        let metaMap = {};

        if (tipo === 'MP') {
            const metas = await materia.findAll({ 
                where: { id: ids }, 
                attributes: ['id', 'description'], 
                raw: true 
            });
            metas.forEach(m => metaMap[m.id] = m.description);
        } else {
            const metas = await producto.findAll({ 
                where: { id: ids }, 
                attributes: ['id', 'item'], 
                raw: true 
            });
            metas.forEach(p => metaMap[p.id] = p.item);
        }

        // Armar respuesta final
        for (const row of rows) {
            itemsResultado.push({
                itemId: row.itemId,
                nombre: metaMap[row.itemId] || 'Desconocido',
                stockDisponible: Number(row.stockDisponible),
                cantidadComprometida: Number(row.cantidadComprometida),
                diferencia: Number(row.cantidadComprometida) - Number(row.stockDisponible)
            });
        }
    }

    return res.status(200).json({
      success: true,
      tipo,
      items: itemsResultado
    });

  } catch (err) {
    console.error('getItemsConCompromisoNegativoController error:', err);
    return res.status(500).json({
      success: false,
      msg: 'Error interno en el servidor',
      error: err.message
    });
  }
};



// SACAR DE LA BODEGA EN PROCESO - KIT
const sacaKitBodegaEnProceso = async (req, res) => {
    try{
        // Recibimos kit y proyecto por query
        const { requisicionId, kitId, cantidad} = req.query;
        // Validamos datos
        if(!requisicionId || !kitId) return res.status(400).json({msg: 'Los parámetros no son validos'});
        // Caso contrario, avanzamos
        
        console.log('llego acá')
        const searchKit = await kit.findByPk(kitId, {
            include:[{
                model: itemKit,
                include:[{
                    model: materia
                }]
            }]
        })

        if(!searchKit) return res.status(404).json({msg: 'No hemos encontrado esto'});
        // Caso contrario. Ejecutamos
        const consolidado = consolidarKit(searchKit, Number(cantidad));


        try {
            const resultado = await sacaMateriasConsolidadoTransactional(consolidado, {
                ubicacionOrigenId: 1,
                refDoc: `SALIDA_REQUIS_${requisicionId}_KIT_${kitId}`,
                cotizacionId: searchKit.cotizacionId ?? null,
                usuarioId: req.user ? req.user.id : null,
                ordenarPor: 'DESC'
        });

        console.log('paso más')

        const updateCompromiso = await necesidadProyecto.findOne({
            where: {
                requisicionId: requisicionId,
                kitId:kitId
            }
        })

        if(!updateCompromiso){
            console.log('no encontreamos esto')
        }
        console.log('si lo encontramos')
        let cantidadHoy = Number(Number(cantidad) + Number(updateCompromiso.cantidadEntregada))

        updateCompromiso.cantidadEntregada = Number(cantidadHoy)
        updateCompromiso.estado = cantidadHoy <= 0 ? 'reservado' : cantidadHoy > 0 && cantidadHoy < updateCompromiso.cantidadComprometida ? 'parcial' : 'completo' 

        await updateCompromiso.save()


        // let inventary = await inventario.findOne({ where: { productoId: productoId, ubicacionId } });
        // if (!inventary) {
        //   inventary = await inventario.create({ productoId: productoId, ubicacionId, cantidad: 0, cantidadComprometida: 0 });
        // } 
        // inventary.cantidad = parseFloat(inventary.cantidad) + parseFloat(cantidad);
        // console.log(inventary.cantidad)

        // await inventary.save();
      // Si quieres, aquí actualizas el compromiso entregado: sumar cantidades entregadas al proyecto
      // Ejemplo (suponiendo updateCompromisoEntregado espera este objeto):
      // await updateCompromisoEntregado({ ... });

        return res.status(200).json({ ok: true, consolidado, resultado });
    } catch (errSalida) {
        console.log(errSalida)
            // errSalida proviene de la transacción (ej. 'Stock insuficiente...')
        return res.status(400).json({ ok: false, msg: errSalida.message });
        
    }


    }catch(err){
        console.log(err)
        res.status(500).json({msg: 'ha ocurrido un error en la principal'});
    }
}



// Buscamos materia prima por Query - Inventario
const searchMPForInventario = async (req, res) => {
    try{
        // Recibo dato por query
        const { query,  bodegaId } = req.query; // Obtiene el parámetro de búsqueda desde la URL

        if (!query) {
            return res.status(400).json({ message: "Debes proporcionar un término de búsqueda." });
        }

        // 1. Empezamos con la condición que siempre se aplica.
        const whereClause = {};

        // 2. Aplicamos la lógica condicional para la búsqueda.
        if (!isNaN(query) && query.trim() !== '') {
            // SI ES UN NÚMERO, busca solo por ID.
            whereClause.id = query;
        } else {
            // SI ES TEXTO, busca solo por nombre.
            whereClause.description = { [Op.iLike]: `%${query}%` };
        }

        const kits = await materia.findAll({
            where: whereClause, 
            include:[
                {
                    model: inventario,
                    where: {
                        ubicacionId: bodegaId
                    },
                    required:true
                },
                ], 
            attributes: { exclude: ['createdAt', 'updatedAt'] },
            
        }).catch((err => {
            console.log(err);
            return null; 
        }));

        if(!kits) return res.status(404).json({msg: 'No encontrado'})

        res.status(200).json(kits);
    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal'});
    }
}

// Buscamos materia prima por Query - Inventario
const searchPTForInventario = async (req, res) => {
    try{
        // Recibo dato por query
        const { query,  bodegaId } = req.query; // Obtiene el parámetro de búsqueda desde la URL

        if (!query) {
            return res.status(400).json({ message: "Debes proporcionar un término de búsqueda." });
        }

        // 1. Empezamos con la condición que siempre se aplica.
        const whereClause = {};

        // 2. Aplicamos la lógica condicional para la búsqueda.
        if (!isNaN(query) && query.trim() !== '') {
            // SI ES UN NÚMERO, busca solo por ID.
            whereClause.id = query;
        } else {
            // SI ES TEXTO, busca solo por nombre.
            whereClause.item = { [Op.iLike]: `%${query}%` };
        }

        const kits = await producto.findAll({
            where: whereClause, 
            include:[
                {
                    model: inventario,
                    where: {
                        ubicacionId: bodegaId
                    },
                    required:true
                },
                ], 
            attributes: { exclude: ['createdAt', 'updatedAt'] },
            
        }).catch((err => {
            console.log(err);
            return null; 
        }));

        if(!kits) return res.status(404).json({msg: 'No encontrado'})

        res.status(200).json(kits);
    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal'});
    }
}


// Obtener movimientos de una bogeda
const getMovimientosBodega = async (req, res) => {
    try{
        // 1. Obtenemos los filtros desde req.query (o req.body si lo prefieres)
        const { fechaInicio, fechaFin } = req.query;
        const { bodegaId } = req.params;

        // 2. Construimos el objeto de condiciones 'where' dinámicamente
        const whereConditions = {};

        // Fechas por defecto
        const hoy = dayjs();

        // 3 meses antes
        const tresMesesAntes = hoy.subtract(3, "month");
        // --- Filtro por Rango de Fechas ---
        if (fechaInicio && fechaFin) {
            whereConditions.createdAt = {
                [Op.between]: [
                    dayjs(fechaInicio ? fechaInicio : tresMesesAntes).startOf('day').toDate(),
                    dayjs(fechaFin ? fechaFin : hoy).endOf('day').toDate()
                ]
            };
        }

        whereConditions.ubicacionOrigenId = bodegaId;
        whereConditions.ubicacionDestinoId = bodegaId;

        // 3. Hacemos la consulta a la base de datos
        const movimientos = await movimientoInventario.findAll({
            where: whereConditions,
            // Incluimos los modelos relacionados para tener la información completa
            include: [
                {
                    model: materia,
                    required:false
                },
                {
                    model: producto,
                    required:false

                }
            ],
            order: [['createdAt', 'DESC']] // Ordena los más recientes primero
        }); 
        // Validamos
        if(!movimientos) return res.status(404).json({msg: 'NO hay elementos'});
        // Caso contrario, avanzamos...
        res.status(200).json(movimientos);

    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal.'});
    }
}
// Obtener bodega especifica productos
const getBodegaItems = async(req, res) => {
    try{
        // Recibo dato por params
        const { bodegaId } = req.params;
        // Validamos
        if(!bodegaId) return res.status(200).json({msg: 'Ha ocurrido un error en la principal.'});
        // Caso contrario, avanzamos
        const searchItems = await inventario.findAll({
            where: {
                ubicacionId: bodegaId
            },
            limit: 30,
            include: [{
                model: materia,
            }, {
                model: producto,
            }],
            order:[['cantidad', 'DESC']]
        })


        if(!searchItems) return res.status(404).json({msg: 'No hay resultados'});
        // Caso contrario, enviamos
        res.status(200).json(searchItems);

    }catch(err){ 
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal'});
    }
}
// Obtener bodegas
const getBodegas = async (req, res) => {
    try{
        // Recibimos datos por body
        const { bodegas } = req.body;
        // Validamos
        if(!bodegas) return res.status(404).json({msg: 'Ha ocurrido un error en la principal'});
        // Caso contrario, avanzamos
        const bodegasData = [];


        for (const bode of bodegas) {
            const result = await getBodegaData(bode);
            bodegasData.push(result);
        }


        res.status(200).json(bodegasData)
    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal.'});
    }
}
// CONTROLADORES DEL INVENTARIO
const getAllInventario = async (req, res) =>{
    try{
        // Creamos consulta.
        const searchAll = await inventario.findAll({
            include: [{
                model: ubicacion
            }]
        }).catch(err => {
            console.log(err);
            return null;
        });

        if(!searchAll) return res.status(404).json({msg: 'No hay inventario'});
        // caso contrario. Enviamos respuesta.
        res.status(200).json({msg: 'Ha ocurrido un error en la principal.'});
    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal.'})
    }
}
// Obtener todos los movimientos y estados actuales de un elemento de materia prima
const getInvetarioMateriaPrima = async(req, res) => {
    try{
        // Recibo datos por params
        const { mpId } = req.params;
        // Validamos
        if(!mpId) return res.status(400).json({msg: 'No hemos recibido parámetro'});
        // Caso contrario, avanzamos
        const searchThat = await materia.findOne({
            where: {
                id: mpId
            },
            include:[{
                model: inventario,
                include:[{
                    model: ubicacion
                }]
            }, {
                model: movimientoInventario,
                required:false,
            }]
        })

        // Validamos que existan registros
        if(!searchThat) return res.status(404).json({msg: 'No hemos encontrado registro de esta materia prima.'});
        // Caso contrario, avanzamos
        res.status(200).json(searchThat);

    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal'});
    }
}
// Obtener inventario item especifico
const getAllInventarioId = async(req, res) => {
    try{
        // Recibimos el item ID y la ubicación. // Bodega, Proceso, Terminado...
        const { itemId, ubicacionId } = req.params;
        if(!itemId || !ubicacionId) return res.status(501).json({msg: 'No hemos encontrado esto.'});
        
        // Caso contrario, consultamos esto...
        const searchItemInventario = await materia.findByPk(itemId, {
            include: [{
                model: inventario, 
                include:[
                    {
                        model: ubicacion
                }]
            }, {
                model: cotizacion_compromiso,
                include:[{
                    model: cotizacion
                }]
            }]
        })
        // const searchInventario = await inventario.findOne({
        //     where: {
        //         materiumId: itemId,
        //         ubicacionId,
        //     },
        //     include:[{
        //         model: materia
        //     },
        //     {
        //         model: ubicacion,
        //         include:[{ 
        //             model: movimientoInventario, as: 'origen' 
        //         },
        //         { 
        //             model: movimientoInventario, as: 'destino' 
        //         }]
        //     }
            
        //     ]
        // }).catch(err => {
        //     console.log(err);
        //     return null;
        // });

        if(!searchItemInventario) return res.status(404).json({msg: 'No hemos encontrado esto aquí'});
        // Caso contrario, avanzamos
        res.status(200).json(searchItemInventario);
        
    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal.'});
    }
} 

// Obtener inventario item especifico
const getAllInventarioIdProducto = async(req, res) => {
    try{
        // Recibimos el item ID y la ubicación. // Bodega, Proceso, Terminado...
        const { itemId, ubicacionId } = req.params;
        if(!itemId || !ubicacionId) return res.status(501).json({msg: 'No hemos encontrado esto.'});
        
        // Caso contrario, consultamos esto...
        const searchItemInventario = await producto.findByPk(itemId, {
            include: [{
                model: inventario, 
                include:[
                    {
                        model: ubicacion
                }]
            }, {
                model: cotizacion_compromiso,
                include:[{
                    model: cotizacion
                }]
            }]
        })
        // const searchInventario = await inventario.findOne({
        //     where: {
        //         materiumId: itemId,
        //         ubicacionId,
        //     },
        //     include:[{
        //         model: materia
        //     },
        //     {
        //         model: ubicacion,
        //         include:[{ 
        //             model: movimientoInventario, as: 'origen' 
        //         },
        //         { 
        //             model: movimientoInventario, as: 'destino' 
        //         }]
        //     }
            
        //     ]
        // }).catch(err => {
        //     console.log(err);
        //     return null;
        // });

        if(!searchItemInventario) return res.status(404).json({msg: 'No hemos encontrado esto aquí'});
        // Caso contrario, avanzamos
        res.status(200).json(searchItemInventario);
        
    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal.'});
    }
} 

// Obtener movimientos de materia prima data
const getMovimientosMateriaBodega = async(req, res) => {
    try{
        const { itemId, ubicacionId } = req.params;
        if(!itemId || !ubicacionId) return res.status(200).json({msg: 'Parámetros no validos'});
        // Caso contrario, avanzamos
        
        const searchItem = await inventario.findOne({
            where: {
                materiumId: itemId,
                ubicacionId: ubicacionId
            },
            include:[{
                model: ubicacion,
                include:[
                    {
                        model: movimientoInventario, as: 'origen',
                        where: {
                            materiumId: itemId
                        },
                        required: false
                    },
                    {
                        model: movimientoInventario, as: 'destino',
                        where: {
                            materiumId: itemId
                        },
                        required: false
                    }
                ]
            }] 
        })
        console.log(searchItem)
        if(!searchItem) return res.status(404).json({msg: 'No hemos encontrado esto.'});
        res.status(200).json(searchItem);

    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal'});
    }
}

// Obtener movimientos por proyecto
const getMovimientosItemProyectos = async (req, res) => {
  try {
    const { cotizacionId, itemId } = req.params;
    if (!cotizacionId || !itemId) {
      return res.status(400).json({ msg: "Parámetros no válidos" });
    }

    const searchItem = await inventario.findOne({
      where: { materiumId: itemId },
      include: [
        {
          model: ubicacion,
          include: [
            {
              model: movimientoInventario,
              as: "origen", // Asegúrate que exista esta asociación en el modelo
              required: false, // para que no bloquee si no hay movimientos
              where: { cotizacionId },
            },
            {
              model: movimientoInventario,
              as: "destino", // Asegúrate que exista esta asociación en el modelo
              required: false,
              where: { cotizacionId },
            },
          ],
        },
      ],
    });

    if (!searchItem) {
      return res.status(404).json({ msg: "No hemos encontrado este item en inventario" });
    }

    res.status(200).json(searchItem);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Ha ocurrido un error en la principal" });
  }
};

// Obtener movimientos producto terminado por bodega
const getMovimientosProductosBodega = async(req, res) => {
    try{
        const { itemId, ubicacionId } = req.params;
        if(!itemId || !ubicacionId) return res.status(200).json({msg: 'Parámetros no validos'});
        // Caso contrario, avanzamos
        
        const searchItem = await inventario.findOne({
            where: {
                productoId: itemId,
                ubicacionId: ubicacionId
            },
            include:[{
                model: ubicacion,
                include:[
                    {
                        model: movimientoInventario, as: 'origen',
                        where: {
                            productoId: itemId
                        },
                        required: false
                    },
                    {
                        model: movimientoInventario, as: 'destino',
                        where: {
                            productoId: itemId
                        },
                        required: false
                    }
                ]
            }] 
        })
        if(!searchItem) return res.status(404).json({msg: 'No hemos encontrado esto.'});
        res.status(200).json(searchItem);

    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal'});
    }
}

// Agregar todo los productos comercializables a bodega de productos
const addPTToBodega = async (req, res) => {
    try{
        // Consultamos toda la materia prima

        const searchAllPT = await producto.findAll();
        if(!searchAllPT) return res.status(404).json({msg: 'No hemos encontrado productos.'});
        // Caso contrario, avanzamos

        searchAllPT.forEach(async (pt) => {
            const consultarEnIV = await inventario.findOne({
                where: {
                    productoId: pt.id,
                    ubicacionId: 2
                }
            });

            if(!consultarEnIV){
                registrarMovimientoPTONE(pt.id)
                console.log('Agregado')
            }
        });
        return res.status(200).json({msg: 'Finalizo'});

    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal.'});
    }
} 

// Agregar toda la materia prima a bodega de materia Prima
const addMtToBodega = async (req, res) => {
    try{
        // Consultamos toda la materia prima

        const searchAllMP = await materia.findAll();
        if(!searchAllMP) return res.status(404).json({msg: 'No hemos encontrado materia prima.'});
        // Caso contrario, avanzamos

        searchAllMP.forEach(async (mp) => {
            const consultarEnIV = await inventario.findOne({
                where: {
                    materiumId: mp.id,
                    ubicacionId: 1
                }
            });
 
            if(!consultarEnIV){
                registrarMovimientoMPONE(mp.id)
                console.log('Agregado')
            }
        });
        return res.status(200).json({msg: 'Finalizo'});

    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal.'});
    }
}
// Crear bodega
const newBodega = async (req, res) => {
    try{
        // Recibimos datos por body
        const { nombre, tipo, description, userId } = req.body;
        // Validamos la entrada
        if(!nombre || !tipo || !description) return res.status(400).json({msg: 'Los parámetros no son validos.'});
        
        // Caso contrario, avanzamos...
        const newAdd = await ubicacion.create({
            nombre,
            tipo,
            description
        });

        // Validamos
        if(!newAdd) return res.status(502).json({msg: 'No hemos logrado crear esto.'});
        // Caso contrario, avanzamos...
        res.status(200).json(newAdd);

    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal.'});
    }
}


const registrarMovimientos = async (req, res) => {
  try {
    const {
      materiaId,
      productoId,
      cantidad,
      tipoProducto,
      tipo,
      ubicacionOrigenId,
      ubicacionDestinoId,
      refDoc,
      cotizacionId,
      itemFisicoId,
      numPiezas,
      comprasCotizacionId,
      modoSeleccion // nuevo: 'PIEZAS_COMPLETAS' o null/otro
    } = req.body;

    // Validaciones básicas
    if (!tipoProducto || !tipo || !refDoc) {
      return res.status(400).json({ msg: 'Parámetros no válidos: tipoProducto, tipo y refDoc son requeridos.' });
    }

    // ENTRADA: delegar a tu flujo actual (creación de items desde numPiezas)
    if (tipo === 'ENTRADA') {
      const resultado = await registrarMovimientoAlmacen(req.body);
      return res.status(201).json(resultado);
    }

    // SALIDA
    if (tipo === 'SALIDA') {
      // Si el cliente indica un itemFisicoId usamos el flujo directo existente
      if (itemFisicoId) {
        const resultado = await registrarMovimientoAlmacen(req.body);
        return res.status(201).json(resultado);
      }

      // SALIDA por cantidad. Requerimos ubicación y cantidad y al menos materiumId o productoId
      if ((!materiaId && !productoId) || !cantidad || !ubicacionOrigenId) {
        return res.status(400).json({ msg: 'Para SALIDA por cantidad necesita materiaId o productoId, cantidad y ubicacionOrigenId.' });
      }

      // Si piden piezas completas, usamos la función especializada
      if (modoSeleccion === 'PIEZAS_COMPLETAS') {
        const resultado = await seleccionarYTrasladarParaProyecto({
          materiumId: materiaId || null,
          productoId: productoId || null,
          cantidadNecesaria: cantidad,
          ubicacionOrigenId,
          ubicacionDestinoId: null, // SALIDA simple no crea destino; si quieres que cree, pasa la ubicacionDestinoId
          refDoc,
          preferWhole: true,
          minUsableRemnant: 0.5, // puedes parametrizar según materia
          applyChanges: true,    // aplica los cambios (actualiza DB y crea movimientos)
          idsAdicionales: {
            cotizacionId: cotizacionId || null,
            comprasCotizacionId: comprasCotizacionId || null,
            usuarioId: req.user ? req.user.id : null
          }
        });
        return res.status(201).json(resultado);
      }

      // Default: comportamiento normal de sacar por cantidad
      const resultado = await sacarDelInventario({
        materiumId: materiaId || null,
        productoId: productoId || null,
        cantidadSolicitada: cantidad,
        ubicacionOrigenId,
        refDoc,
        cotizacionId,
        usuarioId: req.user ? req.user.id : null,
        ordenarPor: 'DESC'
      });
      return res.status(201).json(resultado);
    }

    // TRANSFERENCIA
    if (tipo === 'TRANSFERENCIA') {
      // Si viene itemFisicoId -> usar tu flujo actual (transferencia de pieza concreta)
      if (itemFisicoId) {
        const resultado = await registrarMovimientoAlmacen(req.body);
        return res.status(201).json(resultado);
      }

      // TRANSFERENCIA por cantidad: requerimos origen y destino y cantidad
      if ((!materiaId && !productoId) || !cantidad || !ubicacionOrigenId || !ubicacionDestinoId || !cotizacionId) {
        return res.status(400).json({ msg: 'Para TRANSFERENCIA por cantidad necesita materiaId o productoId, cantidad, ubicacionOrigenId y ubicacionDestinoId.' });
      }

      // Si piden piezas completas, usamos la función de selección pero con destino
      if (modoSeleccion === 'PIEZAS_COMPLETAS') {
        const resultado = await seleccionarYTrasladarParaProyecto({
          materiumId: materiaId || null,
          productoId: productoId || null,
          cantidadNecesaria: cantidad,
          ubicacionOrigenId,
          ubicacionDestinoId, // aquí sí creará items en destino
          refDoc,
          preferWhole: true,
          minUsableRemnant: 0.5,
          applyChanges: true, // aplica y crea items destino + movimientos
          idsAdicionales: {
            cotizacionId: cotizacionId || null,
            comprasCotizacionId: comprasCotizacionId || null,
            usuarioId: req.user ? req.user.id : null
          }
        });
            console.log("BODY:", req.body);
            console.log("PARAMS:", req.params);
            console.log("QUERY:", req.query);


        const update = await updateCompromisoEntregado({
            materiumId: materiaId || null, 
            cotizacionId: cotizacionId || null, 
            cantidad, 
            productoId: productoId || null
        }) 
        return res.status(201).json(resultado);
      }

      // Default: traslado atómico estándar (consume + crea items destino + movimientos)
      const resultado = await trasladarPorCantidadAtomic({
        materiumId: materiaId || null,
        productoId: productoId || null,
        cantidadSolicitada: cantidad,
        ubicacionOrigenId,
        ubicacionDestinoId,
        refDoc,
        cotizacionId,
        comprasCotizacionId,
        usuarioId: req.user ? req.user.id : null,
        ordenarPor: 'DESC'
      });
      return res.status(201).json(resultado);
    }

    // No coincide con ningún tipo
    return res.status(400).json({ msg: 'Tipo de movimiento no soportado por este endpoint.' });

  } catch (err) {
    console.error('Error en registrarMovimientos controller:', err);
    return res.status(500).json({ msg: 'Ha ocurrido un error en registrarMovimientos', error: err.message });
  }
};

const getItemOverviewByBodegaController = async (req, res) => {
  try {
    const { materiumId, productoId, ubicacionId, limit } = req.query;
    if ((!materiumId && !productoId) || !ubicacionId) {
      return res.status(400).json({ msg: 'Enviar materiumId o productoId y ubicacionId' });
    }

    const overview = await getItemOverviewByBodega({
      materiumId: materiumId ? Number(materiumId) : null,
      productoId: productoId ? Number(productoId) : null,
      ubicacionId: Number(ubicacionId),
      limitSample: limit ? Number(limit) : 100
    });

    return res.status(200).json(overview);
  } catch (err) {
    console.error('getItemOverviewByBodegaController error:', err);
    return res.status(500).json({ msg: 'Error', error: err.message });
  }
};

// OBTENER TODO DE UNA BODEGA
// controllers/inventarioController.js

const listarItemsController = async (req, res) => {
  try {
    const {
      ubicacionId,
      tipo,       // 'MP' | 'PR' | undefined
      page = 1,
      limit = 50,
      orderBy,    // 'totalMeters'|'records'|'fullPiecesMeters'|'remnantMeters'
      orderDir    // 'ASC'|'DESC'
    } = req.query;

    // Validaciones básicas
    const pageNum = Number(page) || 1;
    const limitNum = Math.min(Math.max(Number(limit) || 50, 1), 1000); // limit razonable
    const orderDirection = (orderDir || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const payload = {
      ubicacionId: ubicacionId ? Number(ubicacionId) : null,
      tipo: tipo ? String(tipo).toUpperCase() : null,
      page: pageNum,
      limit: limitNum,
      orderBy: orderBy || 'totalMeters',
      orderDir: orderDirection
    };

    const result = await listarItemsEnInventarioOptimizado(payload);
    return res.status(200).json(result);
  } catch (err) {
    console.error('listarItemsController error:', err);
    return res.status(500).json({ success: false, msg: 'Error al listar items de inventario', error: err.message });
  }
};


const registrarMovimientosMultiples = async (req, res) => {
    try{
        // Recibimos datos por body
        const { materiaId, productoId, cantidad, tipoProducto, tipo, ubicacionOrigenId, ubicacionDestinoId, refDoc, cotizacionId, productos} = req.body;
        if(!cantidad || !tipoProducto || !tipo  || !refDoc || !productos) return res.status(400).json({msg: 'Los parámetros no son validos'});
        // Caso contrario, avanzamos
        const add = await registrarMovimiento(req.body);
        res.status(201).json(add);
    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal'});
    }
}  


// obtenemos cotizaciones con compromisos para almacén
const getCotizacionConCompromisos = async (req, res) => {
    try{
        // Ejecutamos función para consultar
         const searchResults = await cotizacion.findAll({
            include:[{model: client}, {
                model: cotizacion_compromiso,
                required:true
            }]
         });

         if(!searchResults) return res.status(404).json({msg: 'No hay resultado'});
         // Caso contrario, avanzamos
         res.status(200).json(searchResults);


    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal.'})
    }
}
// Obtenemos una cotización con compromisos para almacen
const getOneCotizacionConCompromisos = async (req, res) => {
    try{
        // Recibimos dato por params
        const { cotizacionId } = req.params;
        // Validamos
        if(!cotizacionId) return res.status(400).json({msg: 'El parámetro no es valido.'});
        // Caso contrario, avanzamos...
        const searchCoti = await cotizacion.findByPk(cotizacionId, {
            include:[{
                model: requisicion,
                as: 'requisiciones',
                include:[{
                    model: necesidadProyecto,
                    include:[{
                        model: kit,
                        include:[{ 
                            model: priceKit,
                            where: {
                                state: 'active'
                            }
                        }, {
                            model: extension
                        }]
                    }, {
                        model: producto,
                        include:[{ 
                            model: productPrice,
                            where: {
                                state: 'active'
                            }
                        }]
                    }]
                }]
            },{
                model: client
            },{
                model: cotizacion_compromiso,
                include:[{
                    model: materia
                }, {model: producto}],
                required: true,
            }]
        });

        if(!searchCoti) return res.status(404).json({msg: 'No hemos encontrado esto'});
        // Caso contrario, avanzamos
        res.status(200).json(searchCoti);
    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal.'});
    }
}
const nuevoCompromiso = async (req, res) => {
    try {
        const { cotizacionId } = req.params;
        if (!cotizacionId) return res.status(400).json({ msg: 'Parámetro no es válido.' });

        const compromisoArray = [];

        const getData = await axios
            .get(`https://unionapi-production.up.railway.app/api/requisicion/get/${cotizacionId}`)
            .then(res => res.data);

        if (getData.cantidades) {
            getData.cantidades.forEach(many => {
                let unidad = many.unidad;
                let consumo = Number(many.cantidad);
                console.log('Consumo:', consumo, 'Unidad:', unidad);
                let original = 0;
                if (unidad !== 'mt2') {
                    original = Number(many.medidaOriginal);
                }
 
                let productoLados = 0;
                if (unidad === 'mt2') {
                    const [ladoA, ladoB] = many.medidaOriginal.split('X').map(Number);
                    if (!isNaN(ladoA) && !isNaN(ladoB)) {
                        productoLados = ladoA * ladoB;
                    }
                } 
 
                let comprometer = 1;
                if ((unidad === 'kg' || unidad === 'mt' || unidad === 'unidad') && original > 0) {
                    comprometer = consumo / original;
                } else if (unidad === 'mt2' && productoLados > 0) {
                    comprometer = consumo / productoLados;
                }

                compromisoArray.push({
                    unidad,
                    cantidadComprometida: comprometer,
                    cantidadEntregada: 0,
                    estado: 'pendiente',
                    materiaId: many.id,
                    materiumId: many.id,
                    ubicacionId: 1,
                    cotizacionId: Number(getData.requisicion.cotizacionId)
                });
            });
        }
 
        // Productos 
        if (getData.resumenProductos) {
            getData.resumenProductos.forEach(prod => {
                compromisoArray.push({
                    unidad: prod.unidad,
                    cantidadComprometida: prod.cantidad,
                    cantidadEntregada: 0,
                    estado: 'pendiente',
                    productoId: prod.id, // 👈 identificador de producto
                    ubicacionId: 1,
                    cotizacionId: Number(getData.requisicion.cotizacionId)
                });
            });
        }
        for (const mp of compromisoArray) {
            if (mp.materiaId) {
                // comprometer materia prima
                await comprometerStock(mp.materiaId, 1, mp.cantidadComprometida);
                await createCompromiso(mp.materiaId, mp.cantidadComprometida, getData.requisicion.cotizacionId);
            } else if (mp.productoId) {
                // comprometer producto (puedes hacer otra lógica si aplica)
                await comprometerStock(mp.materiaId, 2, mp.cantidadComprometida, mp.productoId);
                await createCompromiso(mp.materiaId, mp.cantidadComprometida, getData.requisicion.cotizacionId, mp.productoId);
            }
        }
        res.status(200).json(compromisoArray);

    } catch (err) {
        console.log(err);
        res.status(500).json({ msg: 'Ha ocurrido un error en la principal.' });
    }
};


module.exports = {
    searchMPForInventario, // Buscar por nombre o id materia prima. En una bodega.
    searchPTForInventario,  // Buscar por nombre o id Producto. En una bodega.
    getMovimientosBodega, // Obtenemos los mivimientos de una bodega en un rango de fechas.
    getBodegaItems, // Obtener items de bodega
    getBodegas, // Obtener bodegas información
    getInvetarioMateriaPrima, // Obtenemos registro de materia prima, ubicaciones y movimientos
    newBodega,
    registrarMovimientos,
    nuevoCompromiso, // Aprobar para obtener requi
    addMtToBodega, // Agregar toda la materia prima a inventario. Bodega 1
    addPTToBodega, // agregar todo el producto comercializable a inventario. Bodega 2
    getAllInventarioId, // Obtener registro de una materia prima inventario
    getAllInventarioIdProducto, // Obtener registor de una producto inventario - Bodega 2
    getMovimientosMateriaBodega, // OBtener movimientos de item en una bodega
    getMovimientosItemProyectos, // Obtenemos los movimientos de un ITEM por proyecto
    getMovimientosProductosBodega, // Obtenemos movimientos de producto terminado en una bodega

    // Vemos proyectos
    getCotizacionConCompromisos, // Ver todos los proyectos - en almacén
    getOneCotizacionConCompromisos, // Ver un proyecto - En almacén por params.    

    // VER ITEM
    getItemOverviewByBodegaController, // Ver item almacen
    listarItemsController, // VER TODO DE ALMACÉN
    getItemsConMenosStockController, // Ver item con menos stock
    getItemsConMasMovimientoController, // Ver item con más movimientos
    getItemsConCompromisoNegativoController, // Negativos
    sacaKitBodegaEnProceso, // SACAR KIT DE BODEGA EN PROCESO
}  