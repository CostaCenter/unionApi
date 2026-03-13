const express = require('express');
const { ubicacion, client, inventario, producto, requisicion, itemKit, materia, extension, kit, movimientoInventario, necesidadProyecto, cotizacion_compromiso, priceKit, productPrice, cotizacion, inventarioItemFisico, comprasCotizacionItem, itemToProject, db: sequelize } = require('../db/db');
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



// Obtener información de stock disponible para un producto terminado
// Esta función muestra cuánto producto terminado hay disponible en bodega 5 (en proceso)
// Para producto terminado: Bodega origen = 2, Bodega en proceso = 5
const getProductoTerminadoStock = async (req, res) => {
    try {
        const { productoId, cantidad = 1, ubicacionId = 5 } = req.query;
        
        // Validaciones
        if (!productoId) {
            return res.status(400).json({ msg: 'productoId es requerido' });
        }

        // Obtener el producto terminado
        const searchProducto = await producto.findByPk(productoId, {
            attributes: ['id', 'item', 'unidad', 'medida']
        });

        if (!searchProducto) {
            return res.status(404).json({ msg: 'Producto terminado no encontrado' });
        }

        const cantidadNecesaria = Number(cantidad);
        const unidad = searchProducto.unidad || '';
        const medida = searchProducto.medida || '';
        const item = searchProducto.item || '';

        // Obtener stock disponible en bodega 5 (en proceso) - OBLIGATORIO para producto terminado
        const itemsDisponiblesBodega5 = await inventarioItemFisico.findAll({
            where: {
                productoId: Number(productoId),
                ubicacionId: 5, // Bodega en proceso (OBLIGATORIO)
                cantidadDisponible: { [Op.gt]: 0 }
            },
            attributes: ['id', 'cantidadDisponible', 'esRemanente', 'state'],
            raw: true
        });

        // Verificar también en bodega 2 (solo para información, no para consumo)
        const itemsDisponiblesBodega2 = await inventarioItemFisico.findAll({
            where: {
                productoId: Number(productoId),
                ubicacionId: 2, // Bodega producto terminado
                cantidadDisponible: { [Op.gt]: 0 }
            },
            attributes: ['id', 'cantidadDisponible'],
            raw: true
        });

        // Calcular stock total disponible en bodega 5
        const stockDisponibleBodega5 = itemsDisponiblesBodega5.reduce(
            (sum, it) => sum + parseFloat(it.cantidadDisponible || 0),
            0
        );

        const stockDisponibleBodega2 = itemsDisponiblesBodega2.reduce(
            (sum, it) => sum + parseFloat(it.cantidadDisponible || 0),
            0
        );

        // Calcular cuánto falta
        const cantidadFalta = Math.max(0, cantidadNecesaria - stockDisponibleBodega5);
        const tieneStockSuficiente = stockDisponibleBodega5 >= cantidadNecesaria;

        return res.status(200).json({
            success: true,
            productoId: Number(productoId),
            productoName: item,
            cantidadSolicitada: cantidadNecesaria,
            ubicacionId: 5,
            nota: 'El sistema consume productos terminados desde bodega 5 (en proceso).',
            resumen: {
                tieneStockSuficiente,
                cantidadNecesaria,
                stockDisponible: stockDisponibleBodega5,
                cantidadFalta,
                itemsDisponibles: itemsDisponiblesBodega5.length
            },
            producto: {
                productoId: Number(productoId),
                item: item,
                unidad: unidad,
                medida: medida,
                cantidadNecesaria: cantidadNecesaria,
                stockDisponible: stockDisponibleBodega5,
                stockDisponibleBodega2: stockDisponibleBodega2,
                cantidadFalta: cantidadFalta,
                tieneStockSuficiente: tieneStockSuficiente,
                itemsDisponibles: itemsDisponiblesBodega5.length,
                necesitaTransferir: !tieneStockSuficiente && stockDisponibleBodega2 > 0
            }
        });

    } catch (err) {
        console.error('Error en getProductoTerminadoStock:', err);
        return res.status(500).json({
            success: false,
            msg: 'Error al obtener información de producto terminado',
            error: err.message
        });
    }
};

// Obtener información de materia prima necesaria y stock disponible para un kit
// Esta función muestra qué materia prima necesita un kit y cuánta hay disponible
// IMPORTANTE: El consumo se hace por CANTIDADES PARCIALES (mt2, mt) o enteras (unidades)
// - mt2 y mt: se pueden consumir parciales (ej: 4.5 mt2 de una lámina de 6 mt2)
// - unidades, kg, etc.: se consumen enteras según la lógica del modelo
const getKitMateriaPrimaStock = async (req, res) => {
    try {
        const { kitId, cantidad = 1, ubicacionId = 4 } = req.query;
        
        // Validaciones
        if (!kitId) {
            return res.status(400).json({ msg: 'kitId es requerido' });
        }

        // Obtener el kit con sus items
        const searchKit = await kit.findByPk(kitId, {
            include: [{
                model: itemKit,
                include: [{
                    model: materia
                }]
            }]
        });

        if (!searchKit) {
            return res.status(404).json({ msg: 'Kit no encontrado' });
        }

        // Consolidar la materia prima necesaria
        // Esto agrupa la materia prima del kit multiplicada por la cantidad solicitada
        const consolidado = consolidarKit(searchKit, Number(cantidad));

        // Para cada materia prima, obtener el stock disponible en bodega 4 (en proceso)
        const materiaConStock = await Promise.all(
            consolidado.map(async (item) => {
                // Obtener stock disponible en bodega 4 (en proceso) - OBLIGATORIO para materia prima
                const itemsDisponiblesBodega4 = await inventarioItemFisico.findAll({
                    where: {
                        materiumId: item.materiaId,
                        ubicacionId: 4, // Bodega en proceso (OBLIGATORIO)
                        cantidadDisponible: { [Op.gt]: 0 }
                    },
                    attributes: ['id', 'cantidadDisponible', 'esRemanente', 'state'],
                    raw: true
                });

                // Verificar también en bodega 1 (solo para información, no para consumo)
                const itemsDisponiblesBodega1 = await inventarioItemFisico.findAll({
                    where: {
                        materiumId: item.materiaId,
                        ubicacionId: 1, // Bodega materia prima
                        cantidadDisponible: { [Op.gt]: 0 }
                    },
                    attributes: ['id', 'cantidadDisponible'],
                    raw: true
                });

                // Calcular stock total disponible en bodega 4 (suma de todas las piezas disponibles)
                // NOTA: El consumo se hace por cantidades parciales, así que si hay:
                // - 1 lámina de 3 mt2 y necesitas 4.5 mt2: se consume la lámina completa (3 mt2) 
                //   y se busca otra para los 1.5 mt2 restantes
                // - 1 varilla de 6 mt y necesitas 2 mt: se consume 2 mt y quedan 4 mt como remanente
                const stockDisponibleBodega4 = itemsDisponiblesBodega4.reduce(
                    (sum, it) => sum + parseFloat(it.cantidadDisponible || 0),
                    0
                );

                const stockDisponibleBodega1 = itemsDisponiblesBodega1.reduce(
                    (sum, it) => sum + parseFloat(it.cantidadDisponible || 0),
                    0
                );

                // Calcular cuánto falta
                const cantidadNecesaria = parseFloat(item.totalCantidad || 0);
                const cantidadFalta = Math.max(0, cantidadNecesaria - stockDisponibleBodega4);
                const tieneStockSuficiente = stockDisponibleBodega4 >= cantidadNecesaria;

                return {
                    materiaId: item.materiaId,
                    item: item.item,
                    unidad: item.unidad,
                    medida: item.medida,
                    cantidadPorKit: item.cantidadPorKit, // Cantidad necesaria para 1 kit
                    cantidadNecesaria: cantidadNecesaria, // Cantidad total necesaria
                    stockDisponible: stockDisponibleBodega4, // Stock en bodega 4 (en proceso)
                    stockDisponibleBodega1: stockDisponibleBodega1, // Stock en bodega 1 (solo info)
                    cantidadFalta: cantidadFalta,
                    tieneStockSuficiente: tieneStockSuficiente,
                    itemsDisponibles: itemsDisponiblesBodega4.length, // Número de piezas disponibles en bodega 4
                    necesitaTransferir: !tieneStockSuficiente && stockDisponibleBodega1 > 0, // Si falta pero hay en bodega 1
                    detalles: item.detalles
                };
            })
        );

        // Resumen general
        const tieneTodoElStock = materiaConStock.every(m => m.tieneStockSuficiente);
        const totalMaterias = materiaConStock.length;
        const materiasConStockSuficiente = materiaConStock.filter(m => m.tieneStockSuficiente).length;

        return res.status(200).json({
            success: true,
            kitId: Number(kitId),
            kitName: searchKit.name,
            cantidadKits: Number(cantidad),
            ubicacionId: Number(ubicacionId),
            nota: 'El sistema consume CANTIDADES EXACTAS (parciales) en mt2 y mt. Ejemplo: si necesitas 0.26 mt2 y hay una lámina de 3 mt2, se consume exactamente 0.26 mt2 y quedan 2.74 mt2 como remanente. NO consume piezas completas, consume la cantidad exacta necesaria.',
            resumen: {
                tieneTodoElStock,
                totalMaterias,
                materiasConStockSuficiente,
                materiasConFalta: totalMaterias - materiasConStockSuficiente
            },
            materiaPrima: materiaConStock
        });

    } catch (err) {
        console.error('Error en getKitMateriaPrimaStock:', err);
        return res.status(500).json({
            success: false,
            msg: 'Error al obtener información de materia prima',
            error: err.message
        });
    }
};

// SACAR DE LA BODEGA EN PROCESO - PRODUCTO TERMINADO
const sacaProductoBodegaEnProceso = async (req, res) => {
    try{
        // Recibimos producto y proyecto por query
        const { requisicionId, productoId, cantidad} = req.query;
        // Validamos datos
        if(!requisicionId || !productoId) return res.status(400).json({msg: 'Los parámetros no son validos'});
        
        console.log('sacaProductoBodegaEnProceso - Iniciando:', { requisicionId, productoId, cantidad });
        
        const searchProducto = await producto.findByPk(productoId);

        if(!searchProducto) {
            console.log('Producto no encontrado:', productoId);
            return res.status(404).json({msg: 'No hemos encontrado este producto'});
        }
        
        try {
            // IMPORTANTE: El producto debe estar en bodega 5 (en proceso) para consumirlo
            // Esta función consume producto de la bodega en proceso (5) 
            // El producto fue transferido previamente desde bodega 2 a bodega 5
            console.log('Buscando producto en bodega 5 (en proceso)');
            const resultado = await sacarDelInventario({
                productoId: Number(productoId),
                materiumId: null,
                cantidadSolicitada: Number(cantidad),
                ubicacionOrigenId: 5, // Bodega en proceso (donde está el producto disponible)
                refDoc: `SALIDA_REQUIS_${requisicionId}_PRODUCTO_${productoId}`,
                cotizacionId: null,
                usuarioId: req.user ? req.user.id : null,
                ordenarPor: 'DESC'
            });
        
            console.log('Producto consumido exitosamente:', resultado);

            const updateCompromiso = await necesidadProyecto.findOne({
                where: {
                    requisicionId: requisicionId,
                    productoId: productoId
                }
            })

            if(!updateCompromiso){
                console.log('no encontramos el compromiso')
            } else {
                console.log('si lo encontramos')
                let cantidadHoy = Number(Number(cantidad) + Number(updateCompromiso.cantidadEntregada))

                updateCompromiso.cantidadEntregada = Number(cantidadHoy)
                updateCompromiso.estado = cantidadHoy <= 0 ? 'reservado' : cantidadHoy > 0 && cantidadHoy < updateCompromiso.cantidadComprometida ? 'parcial' : 'completo' 

                await updateCompromiso.save()
            }

            return res.status(200).json({ ok: true, resultado });
        } catch (errSalida) {
            console.log(errSalida)
            return res.status(400).json({ ok: false, msg: errSalida.message });
        }
    } catch (err) {
        console.error('Error en sacaProductoBodegaEnProceso:', err);
        return res.status(500).json({ ok: false, msg: err.message });
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
        
        console.log('sacaKitBodegaEnProceso - Iniciando:', { requisicionId, kitId, cantidad });
        
        const searchKit = await kit.findByPk(kitId, {
            include:[{
                model: itemKit,
                include:[{
                    model: materia
                }]
            }]
        })

        if(!searchKit) {
            console.log('Kit no encontrado:', kitId);
            return res.status(404).json({msg: 'No hemos encontrado esto'});
        }
        
        // Caso contrario. Ejecutamos
        const consolidado = consolidarKit(searchKit, Number(cantidad));
        console.log('Consolidado de materia prima:', consolidado);

        try {
            // IMPORTANTE: El material debe estar en bodega 4 (en proceso) para consumirlo
            // Esta función consume material de la bodega en proceso (4) para producir el kit
            // El material fue transferido previamente desde bodega 1 a bodega 4
            console.log('Buscando material en bodega 4 (en proceso)');
            const resultado = await sacaMateriasConsolidadoTransactional(consolidado, {
                ubicacionOrigenId: 4, // Bodega en proceso (donde está el material disponible)
                refDoc: `SALIDA_REQUIS_${requisicionId}_KIT_${kitId}`,
                cotizacionId: searchKit.cotizacionId ?? null,
                usuarioId: req.user ? req.user.id : null,
                ordenarPor: 'DESC'
        });
        
        console.log('Material consumido exitosamente:', resultado);

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
                    required:false
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
                    required:false
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

// SACAR MATERIA PRIMA DIRECTA DE BODEGA EN PROCESO PARA UN PROYECTO (SIN ORDEN DE COMPRA)
// - Consume materia prima desde la bodega 4 (en proceso)
// - Actualiza la necesidad del proyecto (necesidadProyecto) para esa materia
// - No depende de comprasCotizacion / orden de compra
const sacaMateriaDirectaBodegaEnProceso = async (req, res) => {
    try {
        const { requisicionId, materiaId, cantidad } = req.query;

        // Validaciones básicas
        if (!requisicionId || !materiaId) {
            return res.status(400).json({ msg: 'Los parámetros requisicionId y materiaId son requeridos.' });
        }

        const cantidadNum = Number(cantidad || 0);
        if (!cantidadNum || isNaN(cantidadNum) || cantidadNum <= 0) {
            return res.status(400).json({ msg: 'La cantidad debe ser un número mayor a 0.' });
        }

        // Buscar la necesidad del proyecto para esta materia
        const necesidad = await necesidadProyecto.findOne({
            where: {
                requisicionId: requisicionId,
                materiaId: Number(materiaId)
            }
        });

        if (!necesidad) {
            return res.status(404).json({ msg: 'No hemos encontrado una necesidad de proyecto para esta materia y requisición.' });
        }

        // Obtener cotizacionId desde la requisición (para trazabilidad en movimientos)
        const reqData = await requisicion.findByPk(requisicionId);
        const cotizacionId = reqData ? reqData.cotizacionId : null;

        // Consumir materia prima desde bodega 4 (en proceso)
        // Usamos la función genérica que selecciona piezas y descuenta cantidades parciales
        try {
            const resultado = await seleccionarYTrasladarParaProyecto({
                materiumId: Number(materiaId),
                productoId: null,
                cantidadNecesaria: cantidadNum,
                ubicacionOrigenId: 4,           // Bodega en proceso (MP)
                ubicacionDestinoId: null,       // Solo SALIDA (consumo), no se crea destino
                refDoc: `SALIDA_REQUIS_${requisicionId}_MP_${materiaId}`,
                preferWhole: false,             // Permitimos consumo parcial para esta salida directa
                minUsableRemnant: 0.5,
                applyChanges: true,
                idsAdicionales: {
                    cotizacionId: cotizacionId || null,
                    comprasCotizacionId: null,
                    usuarioId: req.user ? req.user.id : null
                }
            });

            // Actualizar necesidadProyecto (cantidadEntregada y estado)
            const entregadoActual = Number(necesidad.cantidadEntregada || 0);
            const comprometido = Number(necesidad.cantidadComprometida || 0);
            const nuevoTotalEntregado = entregadoActual + cantidadNum;

            necesidad.cantidadEntregada = nuevoTotalEntregado;

            if (nuevoTotalEntregado <= 0) {
                necesidad.estado = 'reservado';
            } else if (nuevoTotalEntregado > 0 && nuevoTotalEntregado < comprometido) {
                necesidad.estado = 'parcial';
            } else {
                necesidad.estado = 'completo';
            }

            await necesidad.save();

            return res.status(200).json({
                ok: true,
                msg: 'Materia prima consumida desde bodega en proceso para el proyecto.',
                resultado,
                necesidadProyecto: {
                    id: necesidad.id,
                    cantidadComprometida: comprometido,
                    cantidadEntregada: nuevoTotalEntregado,
                    estado: necesidad.estado
                }
            });
        } catch (errSalida) {
            console.error('Error al consumir materia desde bodega 4:', errSalida);
            return res.status(400).json({ ok: false, msg: errSalida.message });
        }

    } catch (err) {
        console.error(err);
        return res.status(500).json({ msg: 'Ha ocurrido un error en la principal.' });
    }
};

// TRANSFERIR MATERIA PRIMA DESDE BODEGA 1 A BODEGA 4 Y ENTREGARLA A UN PROYECTO
// - Saca stock de bodega 1 (materia prima)
// - Lo ingresa a bodega 4 (en proceso)
// - Actualiza el compromiso de la cotización (cotizacion_compromiso) para esa materia
//   => "Se la entregamos" a ese proyecto, pero físicamente queda en bodega 4 lista para producción
// TRANSFERIR MATERIA PRIMA O PRODUCTO TERMINADO DESDE BODEGA PRINCIPAL A BODEGA EN PROCESO Y ENTREGARLO A UN PROYECTO
// - Materia Prima: Bodega 1 → Bodega 4
// - Producto Terminado: Bodega 2 → Bodega 5
// - Actualiza cotizacion_compromiso con la cantidad entregada
// - Para productos terminados, aplica la regla de medida (mt2) para mover el item correcto
const transferirMateriaProyectoDesdeBodegaPrincipal = async (req, res) => {
    try {
        const { requisicionId, materiaId, productoId, cantidad, medida } = req.query;

        // Validar que venga uno u otro (no ambos, no ninguno)
        if (!requisicionId || (!materiaId && !productoId)) {
            return res.status(400).json({ 
                msg: 'Los parámetros requisicionId y (materiaId o productoId) son requeridos. Solo uno de los dos últimos.' 
            });
        }

        if (materiaId && productoId) {
            return res.status(400).json({ 
                msg: 'Debe proporcionar materiaId o productoId, no ambos.' 
            });
        }

        const cantidadNum = Number(cantidad || 0);
        if (!cantidadNum || isNaN(cantidadNum) || cantidadNum <= 0) {
            return res.status(400).json({ msg: 'La cantidad debe ser un número mayor a 0.' });
        }

        // Obtener la requisición para conocer la cotización/proyecto
        const reqData = await requisicion.findByPk(requisicionId);
        if (!reqData || !reqData.cotizacionId) {
            return res.status(404).json({ msg: 'No hemos encontrado la requisición o no tiene cotizacionId.' });
        }
        const cotizacionId = reqData.cotizacionId;

        // Determinar si es materia prima o producto terminado
        const esMateriaPrima = !!materiaId;
        const esProductoTerminado = !!productoId;

        // Configurar bodegas según el tipo
        let ubicacionOrigenId, ubicacionDestinoId, refDoc, tipoItem;
        
        if (esMateriaPrima) {
            ubicacionOrigenId = 1;  // Bodega materia prima
            ubicacionDestinoId = 4; // Bodega en proceso (MP)
            refDoc = `TRANSFER_REQUIS_${requisicionId}_MP_${materiaId}`;
            tipoItem = 'Materia Prima';
        } else {
            ubicacionOrigenId = 2;  // Bodega producto terminado
            ubicacionDestinoId = 5; // Bodega en proceso (PT)
            refDoc = `TRANSFER_REQUIS_${requisicionId}_PT_${productoId}`;
            tipoItem = 'Producto Terminado';
        }

        // Para productos terminados, validar y obtener la medida
        let medidaProducto = null;
        let unidadProducto = null;
        if (esProductoTerminado) {
            const searchProducto = await producto.findByPk(productoId, {
                attributes: ['id', 'item', 'unidad', 'medida']
            });
            
            if (!searchProducto) {
                return res.status(404).json({ msg: 'Producto terminado no encontrado.' });
            }
            
            unidadProducto = searchProducto.unidad || '';
            
            // Si la unidad es mt2, la medida es OBLIGATORIA para identificar el item correcto
            if (unidadProducto === 'mt2') {
                // Si el usuario envió medida, usarla; si no, usar la del producto
                medidaProducto = medida || searchProducto.medida;
                
                if (!medidaProducto) {
                    return res.status(400).json({ 
                        msg: 'Para productos terminados con unidad mt2, la medida es requerida. Envíe el parámetro "medida" en el query.' 
                    });
                }
            } else {
                // Para otras unidades, no se requiere medida
                medidaProducto = null;
            }
        }

        // 1) TRANSFERIR FÍSICAMENTE: BODEGA ORIGEN -> BODEGA EN PROCESO
        // Usamos la función genérica que ya sabe cortar/usar piezas
        const resultado = await seleccionarYTrasladarParaProyecto({
            materiumId: esMateriaPrima ? Number(materiaId) : null,
            productoId: esProductoTerminado ? Number(productoId) : null,
            cantidadNecesaria: cantidadNum,
            ubicacionOrigenId: ubicacionOrigenId,
            ubicacionDestinoId: ubicacionDestinoId,
            refDoc: refDoc,
            preferWhole: true,      // Preferimos piezas completas en el traslado
            minUsableRemnant: 0.5,
            applyChanges: true,
            idsAdicionales: {
                cotizacionId: cotizacionId,
                comprasCotizacionId: null,
                usuarioId: req.user ? req.user.id : null
            }
        });

        // 2) ACTUALIZAR COMPROMISO DE LA COTIZACIÓN
        // Para productos terminados con mt2, buscar el compromiso por productoId + medida
        // Para otros casos, buscar solo por productoId o materiumId
        if (esProductoTerminado && unidadProducto === 'mt2' && medidaProducto) {
            // Buscar compromiso específico por productoId + medida + cotizacionId
            const compromiso = await cotizacion_compromiso.findOne({
                where: {
                    productoId: Number(productoId),
                    cotizacionId: cotizacionId,
                    medida: medidaProducto
                }
            });

            if (compromiso) {
                const cantidadAnterior = Number(compromiso.cantidadEntregada || 0);
                const cantidadComprometida = Number(compromiso.cantidadComprometida || 0);
                const nuevoTotal = cantidadAnterior + cantidadNum;

                compromiso.cantidadEntregada = nuevoTotal;
                if (nuevoTotal >= cantidadComprometida) {
                    compromiso.estado = 'completo';
                } else if (nuevoTotal > 0) {
                    compromiso.estado = 'parcial';
                } else {
                    compromiso.estado = 'reservado';
                }

                await compromiso.save();
            } else {
                console.warn(`No se encontró compromiso para productoId ${productoId}, cotizacionId ${cotizacionId}, medida ${medidaProducto}`);
            }
        } else {
            // Para materia prima o productos sin medida, usar la función estándar
            await updateCompromisoEntregado({
                materiumId: esMateriaPrima ? Number(materiaId) : null,
                productoId: esProductoTerminado ? Number(productoId) : null,
                cotizacionId: cotizacionId,
                cantidad: cantidadNum
            });
        }

        return res.status(200).json({
            ok: true,
            msg: `${tipoItem} trasladado de bodega ${ubicacionOrigenId} a ${ubicacionDestinoId} y entregado al proyecto.`,
            resultado,
            proyecto: {
                requisicionId: Number(requisicionId),
                cotizacionId: cotizacionId
            },
            tipo: tipoItem,
            medida: medidaProducto || null,
            unidad: unidadProducto || null
        });

    } catch (err) {
        console.error('Error en transferirMateriaProyectoDesdeBodegaPrincipal:', err);
        return res.status(500).json({ 
            msg: 'Ha ocurrido un error en la principal.',
            error: err.message 
        });
    }
};
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

        if(!searchItemInventario) return res.status(404).json({msg: 'No hemos encontrado esto aquí'});
        
        // 🔄 Obtener items físicos de este material en esta bodega
        const itemsFisicos = await inventarioItemFisico.findAll({
            where: {
                materiumId: itemId,
                ubicacionId: Number(ubicacionId),
                cantidadDisponible: { [Op.gt]: 0 } // Solo items con stock disponible
            },
            order: [['createdAt', 'DESC']] // Items más recientes primero
        });

        // Obtener movimientos específicos de cada item físico (solo con cantidad)
        // Nota: No cargamos movimientos por item físico aquí para evitar sobrecarga
        const itemsFisicosConMovimientos = itemsFisicos.map(item => {
            const itemPlain = item.get({ plain: true });
            itemPlain.movimientos = []; // Se cargarán con paginación si se necesita
            return itemPlain;
        });

        // Parámetros de paginación para movimientos generales
        const pageMov = parseInt(req.query.pageMov) || 1;
        const limitMov = parseInt(req.query.limitMov) || 20;
        const offsetMov = (pageMov - 1) * limitMov;

        // ✅ OPTIMIZACIÓN: Usar raw: true y solo campos necesarios
        const movimientosGeneralesRaw = await movimientoInventario.findAll({
            where: {
                materiumId: itemId,
                [Op.or]: [
                    { ubicacionOrigenId: Number(ubicacionId) },
                    { ubicacionDestinoId: Number(ubicacionId) }
                ],
                // Filtrar solo movimientos con cantidad (no null y > 0)
                [Op.and]: [
                    sequelize.literal('"cantidad" IS NOT NULL AND "cantidad" > 0')
                ]
            },
            attributes: ['id', 'cantidad', 'tipoMovimiento', 'tipoProducto', 'referenciaDeDocumento', 
                         'cotizacionId', 'ubicacionOrigenId', 'ubicacionDestinoId', 
                         'createdAt', 'updatedAt', 'materiumId', 'productoId', 'itemFisicoId'],
            order: [['createdAt', 'DESC']],
            limit: limitMov,
            offset: offsetMov,
            raw: true // ✅ Mejor rendimiento
        });

        // ✅ OPTIMIZACIÓN: Obtener proyectos para todas las transferencias en una sola consulta
        const movimientosGenerales = movimientosGeneralesRaw;
        
        // Identificar transferencias que necesitan proyectos
        // Obtener comprasCotizacionId desde inventarioItemFisico
        const transferenciasConItemFisico = movimientosGenerales.filter(
            mov => mov.tipoMovimiento === 'TRANSFERENCIA' && mov.itemFisicoId
        );
        
        // Si hay transferencias, obtener comprasCotizacionId desde inventarioItemFisico
        let proyectosPorOC = {};
        if (transferenciasConItemFisico.length > 0) {
            const itemFisicoIds = [...new Set(transferenciasConItemFisico.map(mov => mov.itemFisicoId).filter(Boolean))];
            
            // Obtener comprasCotizacionId desde inventarioItemFisico
            const itemsFisicos = await inventarioItemFisico.findAll({
                where: { id: { [Op.in]: itemFisicoIds } },
                attributes: ['id', 'comprasCotizacionId'],
                raw: true
            });
            
            // Mapear itemFisicoId -> comprasCotizacionId
            const itemFisicoToOC = {};
            itemsFisicos.forEach(item => {
                if (item.comprasCotizacionId) {
                    itemFisicoToOC[item.id] = item.comprasCotizacionId;
                }
            });
            
            // Agregar comprasCotizacionId a los movimientos
            transferenciasConItemFisico.forEach(mov => {
                if (itemFisicoToOC[mov.itemFisicoId]) {
                    mov.comprasCotizacionId = itemFisicoToOC[mov.itemFisicoId];
                }
            });
            
            const comprasCotizacionIds = [...new Set(Object.values(itemFisicoToOC))];
            
            if (comprasCotizacionIds.length > 0) {
                try {
                    const itemsCotizacion = await comprasCotizacionItem.findAll({
                        where: {
                            comprasCotizacionId: { [Op.in]: comprasCotizacionIds },
                            materiumId: itemId
                        },
                        include: [{
                            model: itemToProject,
                            attributes: ['id', 'cantidad', 'comprasCotizacionItemId'],
                            include: [{
                                model: requisicion,
                                attributes: ['id', 'cotizacionId'],
                            include: [{
                                model: cotizacion,
                                attributes: ['id', 'name', 'description'] // ✅ Corregido: usar 'name' y 'description' según el modelo
                            }]
                            }]
                        }]
                    });

                    itemsCotizacion.forEach(item => {
                        if (item.itemToProjects && item.itemToProjects.length > 0) {
                            proyectosPorOC[item.comprasCotizacionId] = item.itemToProjects.map(itp => ({
                                cotizacionId: itp.requisicion?.cotizacionId,
                                nombreProyecto: itp.requisicion?.cotizacion?.name || `Proyecto ${itp.requisicion?.cotizacionId}`, // ✅ Corregido: usar 'name' en lugar de 'nombre'
                                cantidadAsignada: itp.cantidad
                            }));
                        }
                    });
                } catch (error) {
                    console.error('[getAllInventarioId] Error al obtener proyectos para transferencias:', error);
                }
            }
        }

        // Asignar proyectos a cada movimiento
        movimientosGenerales.forEach(mov => {
            if (mov.tipoMovimiento === 'TRANSFERENCIA' && mov.comprasCotizacionId && proyectosPorOC[mov.comprasCotizacionId]) {
                const proyectos = proyectosPorOC[mov.comprasCotizacionId];
                const cantidadTotal = proyectos.reduce((sum, p) => sum + parseFloat(p.cantidadAsignada || 0), 0);
                
                mov.proyectos = proyectos.map(proyecto => ({
                    ...proyecto,
                    cantidadProporcional: mov.cantidad && cantidadTotal > 0
                        ? (parseFloat(proyecto.cantidadAsignada || 0) / cantidadTotal) * parseFloat(mov.cantidad)
                        : 0
                }));
            } else {
                mov.proyectos = [];
            }
        });

        // ✅ Obtener comprasCotizacionId para ENTRADAS que tienen itemFisicoId
        const entradasConItemFisico = movimientosGenerales.filter(
            mov => mov.tipoMovimiento === 'ENTRADA' && mov.itemFisicoId
        );
        
        let itemFisicoToOC = {};
        if (entradasConItemFisico.length > 0) {
            const itemFisicoIds = [...new Set(entradasConItemFisico.map(mov => mov.itemFisicoId).filter(Boolean))];
            const itemsFisicos = await inventarioItemFisico.findAll({
                where: { id: { [Op.in]: itemFisicoIds } },
                attributes: ['id', 'comprasCotizacionId'],
                raw: true
            });
            
            itemsFisicos.forEach(item => {
                if (item.comprasCotizacionId) {
                    itemFisicoToOC[item.id] = item.comprasCotizacionId;
                }
            });
            
            // Asignar comprasCotizacionId a las ENTRADAS
            entradasConItemFisico.forEach(mov => {
                if (itemFisicoToOC[mov.itemFisicoId]) {
                    mov.comprasCotizacionId = itemFisicoToOC[mov.itemFisicoId];
                }
            });
        }

        // ✅ Obtener nombres de bodegas de forma optimizada (solo el campo nombre de la tabla ubicacion)
        const ubicacionIds = [...new Set([
            ...movimientosGenerales.map(m => m.ubicacionOrigenId).filter(Boolean),
            ...movimientosGenerales.map(m => m.ubicacionDestinoId).filter(Boolean)
        ])];
        
        let ubicacionesMap = {};
        if (ubicacionIds.length > 0) {
            const ubicaciones = await ubicacion.findAll({
                where: { id: { [Op.in]: ubicacionIds } },
                attributes: ['id', 'nombre'],
                raw: true
            });
            
            ubicaciones.forEach(ub => {
                ubicacionesMap[ub.id] = ub.nombre || null;
            });
        }
        
        // Asignar nombres de bodega a cada movimiento (solo el nombre de la tabla ubicacion)
        movimientosGenerales.forEach(mov => {
            mov.ubicacionOrigenNombre = mov.ubicacionOrigenId ? (ubicacionesMap[mov.ubicacionOrigenId] || null) : null;
            mov.ubicacionDestinoNombre = mov.ubicacionDestinoId ? (ubicacionesMap[mov.ubicacionDestinoId] || null) : null;
        });

        // ✅ OPTIMIZACIÓN: Count más rápido
        const totalMovimientos = await movimientoInventario.count({
            where: {
                materiumId: itemId,
                [Op.or]: [
                    { ubicacionOrigenId: Number(ubicacionId) },
                    { ubicacionDestinoId: Number(ubicacionId) }
                ],
                // Filtrar solo movimientos con cantidad (no null y > 0)
                [Op.and]: [
                    sequelize.literal('"cantidad" IS NOT NULL AND "cantidad" > 0')
                ]
            },
            col: 'id' // ✅ Especificar columna para count más rápido
        });

        // Convertir a objeto plano para agregar los datos nuevos
        const resultado = searchItemInventario.get({ plain: true });
        resultado.itemsFisicos = itemsFisicosConMovimientos;
        resultado.movimientos = movimientosGenerales;
        resultado.paginacionMovimientos = {
            page: pageMov,
            limit: limitMov,
            total: totalMovimientos,
            totalPages: Math.ceil(totalMovimientos / limitMov)
        };

        // Caso contrario, avanzamos
        res.status(200).json(resultado);
        
    } catch(err) {
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

        if(!searchItemInventario) return res.status(404).json({msg: 'No hemos encontrado esto aquí'});
        
        // 🔄 Obtener items físicos de este producto en esta bodega
        const itemsFisicos = await inventarioItemFisico.findAll({
            where: {
                productoId: itemId,
                ubicacionId: Number(ubicacionId),
                cantidadDisponible: { [Op.gt]: 0 } // Solo items con stock disponible
            },
            order: [['createdAt', 'DESC']] // Items más recientes primero
        });

        // Obtener movimientos específicos de cada item físico (solo con cantidad)
        // Nota: No cargamos movimientos por item físico aquí para evitar sobrecarga
        const itemsFisicosConMovimientos = itemsFisicos.map(item => {
            const itemPlain = item.get({ plain: true });
            itemPlain.movimientos = []; // Se cargarán con paginación si se necesita
            return itemPlain;
        });

        // Parámetros de paginación para movimientos generales
        const pageMov = parseInt(req.query.pageMov) || 1;
        const limitMov = parseInt(req.query.limitMov) || 20;
        const offsetMov = (pageMov - 1) * limitMov;

        // ✅ OPTIMIZACIÓN: Usar raw: true y solo campos necesarios
        const movimientosGeneralesRaw = await movimientoInventario.findAll({
            where: {
                productoId: itemId,
                [Op.or]: [
                    { ubicacionOrigenId: Number(ubicacionId) },
                    { ubicacionDestinoId: Number(ubicacionId) }
                ],
                // Filtrar solo movimientos con cantidad (no null y > 0)
                [Op.and]: [
                    sequelize.literal('"cantidad" IS NOT NULL AND "cantidad" > 0')
                ]
            },
            attributes: ['id', 'cantidad', 'tipoMovimiento', 'tipoProducto', 'referenciaDeDocumento', 
                         'cotizacionId', 'ubicacionOrigenId', 'ubicacionDestinoId', 
                         'createdAt', 'updatedAt', 'materiumId', 'productoId', 'itemFisicoId'],
            order: [['createdAt', 'DESC']],
            limit: limitMov,
            offset: offsetMov,
            raw: true // ✅ Mejor rendimiento
        });

        // ✅ OPTIMIZACIÓN: Obtener proyectos para todas las transferencias en una sola consulta
        const movimientosGenerales = movimientosGeneralesRaw;
        
        // Identificar transferencias que necesitan proyectos
        // Obtener comprasCotizacionId desde inventarioItemFisico
        const transferenciasConItemFisico = movimientosGenerales.filter(
            mov => mov.tipoMovimiento === 'TRANSFERENCIA' && mov.itemFisicoId
        );
        
        // Si hay transferencias, obtener comprasCotizacionId desde inventarioItemFisico
        let proyectosPorOC = {};
        if (transferenciasConItemFisico.length > 0) {
            const itemFisicoIds = [...new Set(transferenciasConItemFisico.map(mov => mov.itemFisicoId).filter(Boolean))];
            
            // Obtener comprasCotizacionId desde inventarioItemFisico
            const itemsFisicos = await inventarioItemFisico.findAll({
                where: { id: { [Op.in]: itemFisicoIds } },
                attributes: ['id', 'comprasCotizacionId'],
                raw: true
            });
            
            // Mapear itemFisicoId -> comprasCotizacionId
            const itemFisicoToOC = {};
            itemsFisicos.forEach(item => {
                if (item.comprasCotizacionId) {
                    itemFisicoToOC[item.id] = item.comprasCotizacionId;
                }
            });
            
            // Agregar comprasCotizacionId a los movimientos
            transferenciasConItemFisico.forEach(mov => {
                if (itemFisicoToOC[mov.itemFisicoId]) {
                    mov.comprasCotizacionId = itemFisicoToOC[mov.itemFisicoId];
                }
            });
            
            const comprasCotizacionIds = [...new Set(Object.values(itemFisicoToOC))];
            
            if (comprasCotizacionIds.length > 0) {
                try {
                    const itemsCotizacion = await comprasCotizacionItem.findAll({
                        where: {
                            comprasCotizacionId: { [Op.in]: comprasCotizacionIds },
                            productoId: itemId
                        },
                        include: [{
                            model: itemToProject,
                            attributes: ['id', 'cantidad', 'comprasCotizacionItemId'],
                            include: [{
                                model: requisicion,
                                attributes: ['id', 'cotizacionId'],
                            include: [{
                                model: cotizacion,
                                attributes: ['id', 'name', 'description'] // ✅ Corregido: usar 'name' y 'description' según el modelo
                            }]
                            }]
                        }]
                    });

                itemsCotizacion.forEach(item => {
                    if (item.itemToProjects && item.itemToProjects.length > 0) {
                        proyectosPorOC[item.comprasCotizacionId] = item.itemToProjects.map(itp => ({
                            cotizacionId: itp.requisicion?.cotizacionId,
                            nombreProyecto: itp.requisicion?.cotizacion?.name || `Proyecto ${itp.requisicion?.cotizacionId}`, // ✅ Corregido: usar 'name' en lugar de 'nombre'
                            cantidadAsignada: itp.cantidad
                        }));
                    }
                });
                } catch (error) {
                    console.error('[getAllInventarioIdProducto] Error al obtener proyectos para transferencias:', error);
                }
            }
        }

        // Asignar proyectos a cada movimiento
        movimientosGenerales.forEach(mov => {
            if (mov.tipoMovimiento === 'TRANSFERENCIA' && mov.comprasCotizacionId && proyectosPorOC[mov.comprasCotizacionId]) {
                const proyectos = proyectosPorOC[mov.comprasCotizacionId];
                const cantidadTotal = proyectos.reduce((sum, p) => sum + parseFloat(p.cantidadAsignada || 0), 0);
                
                mov.proyectos = proyectos.map(proyecto => ({
                    ...proyecto,
                    cantidadProporcional: mov.cantidad && cantidadTotal > 0
                        ? (parseFloat(proyecto.cantidadAsignada || 0) / cantidadTotal) * parseFloat(mov.cantidad)
                        : 0
                }));
            } else {
                mov.proyectos = [];
            }
        });

        // ✅ Obtener comprasCotizacionId para ENTRADAS que tienen itemFisicoId
        const entradasConItemFisico = movimientosGenerales.filter(
            mov => mov.tipoMovimiento === 'ENTRADA' && mov.itemFisicoId
        );
        
        let itemFisicoToOC = {};
        if (entradasConItemFisico.length > 0) {
            const itemFisicoIds = [...new Set(entradasConItemFisico.map(mov => mov.itemFisicoId).filter(Boolean))];
            const itemsFisicos = await inventarioItemFisico.findAll({
                where: { id: { [Op.in]: itemFisicoIds } },
                attributes: ['id', 'comprasCotizacionId'],
                raw: true
            });
            
            itemsFisicos.forEach(item => {
                if (item.comprasCotizacionId) {
                    itemFisicoToOC[item.id] = item.comprasCotizacionId;
                }
            });
            
            // Asignar comprasCotizacionId a las ENTRADAS
            entradasConItemFisico.forEach(mov => {
                if (itemFisicoToOC[mov.itemFisicoId]) {
                    mov.comprasCotizacionId = itemFisicoToOC[mov.itemFisicoId];
                }
            });
        }

        // ✅ Obtener nombres de bodegas de forma optimizada (solo el campo nombre de la tabla ubicacion)
        const ubicacionIds = [...new Set([
            ...movimientosGenerales.map(m => m.ubicacionOrigenId).filter(Boolean),
            ...movimientosGenerales.map(m => m.ubicacionDestinoId).filter(Boolean)
        ])];
        
        let ubicacionesMap = {};
        if (ubicacionIds.length > 0) {
            const ubicaciones = await ubicacion.findAll({
                where: { id: { [Op.in]: ubicacionIds } },
                attributes: ['id', 'nombre'],
                raw: true
            });
            
            ubicaciones.forEach(ub => {
                ubicacionesMap[ub.id] = ub.nombre || null;
            });
        }
        
        // Asignar nombres de bodega a cada movimiento (solo el nombre de la tabla ubicacion)
        movimientosGenerales.forEach(mov => {
            mov.ubicacionOrigenNombre = mov.ubicacionOrigenId ? (ubicacionesMap[mov.ubicacionOrigenId] || null) : null;
            mov.ubicacionDestinoNombre = mov.ubicacionDestinoId ? (ubicacionesMap[mov.ubicacionDestinoId] || null) : null;
        });

        // ✅ OPTIMIZACIÓN: Count más rápido
        const totalMovimientos = await movimientoInventario.count({
            where: {
                productoId: itemId,
                [Op.or]: [
                    { ubicacionOrigenId: Number(ubicacionId) },
                    { ubicacionDestinoId: Number(ubicacionId) }
                ],
                // Filtrar solo movimientos con cantidad (no null y > 0)
                [Op.and]: [
                    sequelize.literal('"cantidad" IS NOT NULL AND "cantidad" > 0')
                ]
            },
            col: 'id' // ✅ Especificar columna para count más rápido
        });

        // Convertir a objeto plano para agregar los datos nuevos
        const resultado = searchItemInventario.get({ plain: true });
        resultado.itemsFisicos = itemsFisicosConMovimientos;
        resultado.movimientos = movimientosGenerales;

        // Caso contrario, avanzamos
        res.status(200).json(resultado);
        
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

    const pageMovimientos = parseInt(req.query.pageMov) || 1;
    const limitMovimientos = parseInt(req.query.limitMov) || 20;

    const overview = await getItemOverviewByBodega({
      materiumId: materiumId ? Number(materiumId) : null,
      productoId: productoId ? Number(productoId) : null,
      ubicacionId: Number(ubicacionId),
      limitSample: limit ? Number(limit) : 100,
      pageMovimientos,
      limitMovimientos
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
    sacaProductoBodegaEnProceso, // SACAR PRODUCTO TERMINADO DE BODEGA EN PROCESO
    getProductoTerminadoStock, // OBTENER STOCK DE PRODUCTO TERMINADO
    getKitMateriaPrimaStock, // Obtener materia prima necesaria y stock disponible para un kit
    sacaMateriaDirectaBodegaEnProceso, // SACAR MATERIA PRIMA DIRECTA DE BODEGA 4 PARA UN PROYECTO
    transferirMateriaProyectoDesdeBodegaPrincipal, // TRANSFERIR MP DE B1 A B4 Y ENTREGARLA A UN PROYECTO
}  