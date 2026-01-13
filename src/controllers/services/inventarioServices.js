const { ubicacion, materia, kit, producto, inventario, movimientoInventario,  inventarioItemFisico, cotizacion_compromiso, db } = require('../../db/db');
const { Op, QueryTypes  } = require('sequelize');

const sequelize = db


// VER MENOS STOCK
async function getItemsConMenosStock({ tipo = 'MP', ubicacionId = null, limit = 20 } = {}) {
  if (!tipo || !['MP','PR'].includes(String(tipo).toUpperCase())) {
    throw new Error("El parámetro 'tipo' es requerido y debe ser 'MP' o 'PR'.");
  }
  const t = String(tipo).toUpperCase();
  const lim = Math.max(1, Math.min(1000, Number(limit) || 20));
  const ubFilter = (ubicacionId == null || ubicacionId === '') ? null : Number(ubicacionId);

  // subconsulta agregada: sum(cantidadDisponible) por item (solo registros con cantidad > 0)
  // si se pasa ubicacionId, filtramos por esa bodega
  const whereUb = ubFilter ? `WHERE "ubicacionId" = ${ubFilter} AND "cantidadDisponible" > 0` : `WHERE "cantidadDisponible" > 0`;

  // Query separado por tipo: left join maestros <- agregados inventario
  if (t === 'MP') {
    const sql = `
      SELECT
        m.id AS "itemId",
        m.item AS "itemName",
        m.description AS "description",
        m.medida AS "medida",
        m.unidad AS "unidad",
        COALESCE(ai.records, 0)::int AS "records",
        COALESCE(ai.totalMeters, 0)::numeric AS "totalMeters",
        COALESCE(ai.fullPiecesCount, 0)::int AS "fullPiecesCount",
        COALESCE(ai.remnantCount, 0)::int AS "remnantCount",
        COALESCE(ai.fullPiecesMeters, 0)::numeric AS "fullPiecesMeters",
        COALESCE(ai.remnantMeters, 0)::numeric AS "remnantMeters"
      FROM "materia" m
      LEFT JOIN (
        SELECT
          "materiumId" AS itemId,
          COUNT(id) FILTER (WHERE "cantidadDisponible" > 0) AS records,
          SUM("cantidadDisponible") FILTER (WHERE "cantidadDisponible" > 0) AS totalMeters,
          SUM(CASE WHEN "esRemanente" = false AND "cantidadDisponible" > 0 THEN 1 ELSE 0 END) AS fullPiecesCount,
          SUM(CASE WHEN "esRemanente" = true AND "cantidadDisponible" > 0 THEN 1 ELSE 0 END) AS remnantCount,
          SUM(CASE WHEN "esRemanente" = false AND "cantidadDisponible" > 0 THEN "cantidadDisponible" ELSE 0 END) AS fullPiecesMeters,
          SUM(CASE WHEN "esRemanente" = true AND "cantidadDisponible" > 0 THEN "cantidadDisponible" ELSE 0 END) AS remnantMeters
        FROM "inventarioItemFisicos"
        ${whereUb}
        GROUP BY "materiumId"
      ) ai ON ai.itemId = m.id
      ORDER BY COALESCE(ai.totalMeters, 0) ASC, COALESCE(ai.records, 0) ASC
      LIMIT ${lim};
    `;

    const rows = await sequelize.query(sql, { type: QueryTypes.SELECT });
    return { success: true, tipo: 'MP', ubicacionId: ubFilter, limit: lim, items: rows };
  } else {
    // PR
    const sql = `
      SELECT
        p.id AS "itemId",
        p.nombre AS "itemName",
        p.sku AS "sku",
        p.medida AS "medida",
        p.unidad AS "unidad",
        COALESCE(ai.records, 0)::int AS "records",
        COALESCE(ai.totalMeters, 0)::numeric AS "totalMeters",
        COALESCE(ai.fullPiecesCount, 0)::int AS "fullPiecesCount",
        COALESCE(ai.remnantCount, 0)::int AS "remnantCount",
        COALESCE(ai.fullPiecesMeters, 0)::numeric AS "fullPiecesMeters",
        COALESCE(ai.remnantMeters, 0)::numeric AS "remnantMeters"
      FROM "producto" p
      LEFT JOIN (
        SELECT
          "productoId" AS itemId,
          COUNT(id) FILTER (WHERE "cantidadDisponible" > 0) AS records,
          SUM("cantidadDisponible") FILTER (WHERE "cantidadDisponible" > 0) AS totalMeters,
          SUM(CASE WHEN "esRemanente" = false AND "cantidadDisponible" > 0 THEN 1 ELSE 0 END) AS fullPiecesCount,
          SUM(CASE WHEN "esRemanente" = true AND "cantidadDisponible" > 0 THEN 1 ELSE 0 END) AS remnantCount,
          SUM(CASE WHEN "esRemanente" = false AND "cantidadDisponible" > 0 THEN "cantidadDisponible" ELSE 0 END) AS fullPiecesMeters,
          SUM(CASE WHEN "esRemanente" = true AND "cantidadDisponible" > 0 THEN "cantidadDisponible" ELSE 0 END) AS remnantMeters
        FROM "inventarioItemFisicos"
        ${whereUb}
        GROUP BY "productoId"
      ) ai ON ai.itemId = p.id
      ORDER BY COALESCE(ai.totalMeters, 0) ASC, COALESCE(ai.records, 0) ASC
      LIMIT ${lim};
    `;

    const rows = await sequelize.query(sql, { type: QueryTypes.SELECT });
    return { success: true, tipo: 'PR', ubicacionId: ubFilter, limit: lim, items: rows };
  }
}

// Obtener item con más movimientos...
// Obtener item con más movimientos (adaptada a tu estructura: usa movimientoInventario.sequelize)
async function getItemsConMasMovimiento({
  tipo = 'MP',
  ubicacionId = null,
  dateFrom = null,
  dateTo = null,
  movementTypes = null,
  limit = 20,
  orderBy = 'qty' // 'qty' or 'count'
} = {}) {
  if (!tipo || !['MP','PR'].includes(String(tipo).toUpperCase())) {
    throw new Error("El parámetro 'tipo' es requerido y debe ser 'MP' o 'PR'.");
  }
  const t = String(tipo).toUpperCase();
  const lim = Math.max(1, Math.min(1000, Number(limit) || 20));

  // Obtener la instancia de sequelize desde el modelo movimientoInventario
  const sequelizeInst = movimientoInventario && (movimientoInventario.sequelize || movimientoInventario._sequelize);
  if (!sequelizeInst) throw new Error('No se pudo localizar la instancia de Sequelize desde movimientoInventario.');

  // Construir cláusulas WHERE dinámicas en array (seguro)
  const whereClauses = [];
  if (ubicacionId !== null && ubicacionId !== undefined) {
    // consideramos movimientos donde origen O destino corresponde a la bodega
    whereClauses.push(`( "ubicacionOrigenId" = ${Number(ubicacionId)} OR "ubicacionDestinoId" = ${Number(ubicacionId)} )`);
  }
  if (dateFrom) {
    whereClauses.push(`"createdAt" >= '${String(dateFrom)}'`);
  }
  if (dateTo) {
    whereClauses.push(`"createdAt" <= '${String(dateTo)}'`);
  }
  if (movementTypes && Array.isArray(movementTypes) && movementTypes.length) {
    const safe = movementTypes.map(mt => `'${String(mt)}'`).join(',');
    whereClauses.push(`"tipoMovimiento" IN (${safe})`);
  }

  // columna id segun tipo
  const idCol = (t === 'MP') ? '"materiumId"' : '"productoId"';

  // Construir whereSQL garantizando que siempre se incluya la condición idCol IS NOT NULL sin dejar 'AND' suelto
  let whereSQL;
  if (whereClauses.length) {
    whereSQL = `WHERE ${whereClauses.join(' AND ')} AND ${idCol} IS NOT NULL`;
  } else {
    whereSQL = `WHERE ${idCol} IS NOT NULL`;
  }

  // nombre real de la tabla de movimientos desde el modelo
  const movimientosTable = (typeof movimientoInventario.getTableName === 'function')
    ? movimientoInventario.getTableName()
    : 'movimientoInventarios';

  // Query de agregación
  const aggSQL = `
    SELECT
      ${idCol} AS "itemId",
      COUNT(*) AS "movCount",
      COALESCE(SUM(ABS("cantidadAfectada")), 0) AS "movQty"
    FROM "${movimientosTable}"
    ${whereSQL}
    GROUP BY ${idCol}
    ORDER BY ${ orderBy === 'count' ? '"movCount" DESC' : '"movQty" DESC' }
    LIMIT ${lim};
  `;

  // Ejecutar consulta
  const aggRows = await sequelizeInst.query(aggSQL, { type: QueryTypes.SELECT });

  if (!aggRows || aggRows.length === 0) {
    return { success: true, tipo: t, ubicacionId, limit: lim, items: [] };
  }

  // Obtener metadatos en batch
  const ids = aggRows.map(r => Number(r.itemId));
  const metaMap = {};
  if (t === 'MP') {
    const metas = await materia.findAll({ where: { id: ids }, attributes: ['id','item','description','medida','unidad'], raw: true });
    for (const m of metas) metaMap[String(m.id)] = m;
  } else {
    const metas = await producto.findAll({ where: { id: ids }, attributes: ['id','nombre','sku','medida','unidad'], raw: true });
    for (const p of metas) metaMap[String(p.id)] = p;
  }

  // Construir respuesta
  const items = aggRows.map(r => {
    const itemId = Number(r.itemId);
    return {
      itemId,
      itemType: t,
      itemData: metaMap[String(itemId)] || null,
      movCount: Number(r.movCount || 0),
      movQty: Number(r.movQty || 0)
    };
  });

  return { success: true, tipo: t, ubicacionId, limit: lim, items };
}


// OBTENEMOS UN KIT
function consolidarKit(kit, cantidadKits = 1) {
  if (!kit || !Array.isArray(kit.itemKits)) return [];

  const toNumber = v => {
    if (v === null || v === undefined) return 0;
    if (typeof v === 'number') return v;
    return Number(String(v).trim().replace(',', '.')) || 0;
  };

  const mapa = {};

  for (const ik of kit.itemKits) {
    const m = ik.materium || {};
    const materiaId = m.id ?? ik.materiaId;
    if (materiaId == null) continue;

    const cantidadPorKit = toNumber(ik.cantidad);
    const totalCantidad = cantidadPorKit * toNumber(cantidadKits);

    // campos solicitados: unidad, medida, item
    const unidad = m.unidad ?? '';
    const medida = m.medida ?? ik.medida ?? '';
    const item = m.description ?? m.description ?? '';

    if (!mapa[materiaId]) {
      mapa[materiaId] = {
        materiaId,
        item,
        unidad,
        medida,
        cantidadPorKit,
        totalCantidad: 0,
        detalles: []
      };
    }

    // sumar totales (si el mismo materia aparece varias veces)
    mapa[materiaId].totalCantidad += totalCantidad;

    mapa[materiaId].detalles.push({
      itemKitId: ik.id,
      cantidadPorKit,
      cantidadKits: toNumber(cantidadKits),
      cantidadTotal: totalCantidad
    });
  }

  return Object.values(mapa);
}

// SACAR ITEMS
async function sacaMateriasConsolidadoTransactional(consolidado = [], {
  StockModel,
  MovimientoModel,
  sequelize,
  ubicacionOrigenId = 4,
  refDoc = 'SALIDA_KIT',
  usuarioId = null,
  referenciaTipo = 'kit',
  referenciaId = null,
  comprobarBodega = true // si false, buscara cualquier stock disponible (adaptar si quieres)
} = {}) {
  if (!Array.isArray(consolidado)) throw new Error('consolidado debe ser un array');
  if (!StockModel || !MovimientoModel || !sequelize) throw new Error('StockModel, MovimientoModel y sequelize son requeridos');

  // Resultado final
  const resultados = [];

  // Abrimos transacción
  return await sequelize.transaction(async (tx) => {
    // Recorremos cada materia y validamos + descontamos
    for (const item of consolidado) {
      const materiaId = Number(item.materiaId);
      const cantidadSolicitada = Number(item.totalCantidad ?? item.cantidadTotal ?? 0);

      if (!materiaId || cantidadSolicitada <= 0) {
        throw new Error(`Item inválido: materiaId=${item.materiaId} cantidad=${item.totalCantidad}`);
      }

      // Buscar stock disponible para esa materia en la bodega (con lock)
      // Ajusta el where según tu esquema (por ejemplo: materiaId + bodegaId)
      const where = { materiaId };
      if (comprobarBodega) where.bodegaId = ubicacionOrigenId;

      // Intentamos obtener la fila de stock con bloqueo FOR UPDATE
      const stockRow = await StockModel.findOne({
        where,
        transaction: tx,
        lock: tx.LOCK.UPDATE
      });

      const disponible = stockRow ? Number(stockRow.cantidad || 0) : 0;

      if (disponible < cantidadSolicitada) {
        // Lanzamos error para que Sequelize haga rollback
        throw new Error(`Stock insuficiente para materiaId ${materiaId}. Disponible: ${disponible}, requerido: ${cantidadSolicitada}`);
      }

      // Decrementar stock (usamos update directo por compatibilidad)
      // Puedes usar StockModel.decrement si prefieres
      const nuevoStock = disponible - cantidadSolicitada;
      await StockModel.update(
        { cantidad: nuevoStock },
        { where: { id: stockRow.id }, transaction: tx }
      );

      // Crear movimiento de salida
      await MovimientoModel.create({
        materiaId,
        bodegaId: stockRow.bodegaId ?? ubicacionOrigenId,
        tipo: 'SALIDA',
        cantidad: cantidadSolicitada,
        referenciaTipo,
        referenciaId,
        refDoc,
        usuarioId,
        fecha: new Date()
      }, { transaction: tx });

      resultados.push({
        materiaId,
        cantidad: cantidadSolicitada,
        stockAntes: disponible,
        stockDespues: nuevoStock,
        ok: true
      });
    }

    // Si llegamos aquí, todo correcto -> commit automático al retornar
    return {
      ok: true,
      resultados,
      summary: {
        totalItems: resultados.length,
        ok: resultados.length
      }
    };
  }); // fin transaction
}


// SaCAR DEL INVENTARIO EN KIT



// Obtener datos de bodegas
async function getBodegaData(bodega){
  // Buscamos la bodega
  const getBodega = await ubicacion.findByPk(bodega);
  if(!getBodega) return null;

  // Caso contrario avanzamos
  const countAllData = await inventario.count({
    where: {
      ubicacionId: getBodega.id
    }
  })

  const bodegaResult = {
    nombre: getBodega.nombre,
    idBodega: getBodega.id,
    cantidad: countAllData
  }

  console.log(bodegaResult)
  return bodegaResult

} 
// función para agregar materia prima primera vez
async function registrarMovimientoMPONE(materiaId) {
    // 1. Crear el movimiento
    const movimiento = await movimientoInventario.create({
        materiumId: materiaId,
        productoId:null,
        cantidad:0,
        tipoProducto: 'Materia Prima',
        tipoMovimiento: 'ENTRADA',
        referenciaDeDocumento: 'Ingreso',
        ubicacionOrigenId:1, 
        ubicacionDestinoId:1
    }); 
  
    // 2. Actualizar inventario según tipo
        await ajustarStock(materiaId, 1, 0);

    return movimiento;
}
// función para agregar producto terminado primera vez.
async function registrarMovimientoPTONE(productoId) {
    // 1. Crear el movimiento
    const movimiento = await movimientoInventario.create({
        materiumId: null,
        productoId:productoId,
        cantidad:0,
        tipoProducto: 'producto',
        tipoMovimiento: 'ENTRADA',
        referenciaDeDocumento: 'Ingreso',
        ubicacionOrigenId:2, 
        ubicacionDestinoId:2
    }); 
 
    // 2. Actualizar inventario según tipo
        await ajustarStockProducto(productoId, 2, 0);

    return movimiento;
}


async function registrarMovimiento({ materiaId, productoId, cantidad, tipoProducto, tipo, ubicacionOrigenId, ubicacionDestinoId, refDoc, cotizacionId }) {
    // 1. Crear el movimiento
    const movimiento = await movimientoInventario.create({
        materiumId: materiaId,
        productoId,
        cotizacionId,
        cantidad,
        tipoProducto,
        tipoMovimiento: tipo,
        referenciaDeDocumento: refDoc,
        ubicacionOrigenId, 
        ubicacionDestinoId
    });     
 
    // 2. Actualizar inventario según tipo 
    if(tipoProducto == 'Materia Prima'){
        if (tipo === 'ENTRADA') {
            await ajustarStock(materiaId, ubicacionDestinoId, cantidad);
        } 
        else if (tipo === 'SALIDA') {
            await ajustarStock(materiaId, ubicacionOrigenId, -cantidad);
        } 
        else if (tipo === 'TRANSFERENCIA') {
            if(ubicacionOrigenId == 4){
              await ajustarStock(materiaId, ubicacionDestinoId, cantidad);

              await ajustarStock(materiaId, ubicacionOrigenId, -cantidad, cotizacionId);
              await updateCantidadComprometida(materiaId, null, cantidad, ubicacionDestinoId)
              
            }else{
              await ajustarStock(materiaId, ubicacionOrigenId, -cantidad);
              await ajustarStock(materiaId, ubicacionDestinoId, cantidad, cotizacionId);
              await updateCantidadComprometida(materiaId, null, -cantidad, ubicacionOrigenId)

            }
        }
    }else if(tipoProducto == 'Producto'){
        if (tipo === 'ENTRADA') {
            await ajustarStockProducto(productoId, ubicacionDestinoId, cantidad);
        } 
        else if (tipo === 'SALIDA') {
            await ajustarStockProducto(productoId, ubicacionOrigenId, -cantidad);
        } 
        else if (tipo === 'TRANSFERENCIA') {
          if(ubicacionOrigenId == 5){
            // A la cantidad origen le saco y le quito compromiso
            await ajustarStockProducto(productoId, ubicacionOrigenId, -cantidad, cotizacionId);
            // Y al destino, le agrego compromiso.
            await ajustarStockProducto(productoId, ubicacionDestinoId, cantidad);
            // Función aparte para actualizar cantidad comprometida
            await updateCantidadComprometida(null, productoId, cantidad, ubicacionDestinoId)

          }else{
            // A la ubicacion de origen le quito cantidad
            await ajustarStockProducto(productoId, ubicacionOrigenId, -cantidad);
            // Y a la ubicación destino, se la agrego y le estoy agregando compromiso a la ubicacion destino
            await ajustarStockProducto(productoId, ubicacionDestinoId, cantidad, cotizacionId);
            await updateCantidadComprometida(null, productoId, -cantidad, ubicacionOrigenId)
          }
        }
    } 
 
    return movimiento; 
}

async function registrarMovimientoAlmacen(datosMovimiento) {
    const { 
        materiaId, productoId, cantidad, tipoProducto, tipo, 
        ubicacionOrigenId, ubicacionDestinoId, refDoc, cotizacionId, 
        itemFisicoId, numPiezas // <--- CAMPOS CLAVE AÑADIDOS
    } = datosMovimiento;

    console.log(`Debug: numPiezas: ${numPiezas}`);
    console.log(`Debug: cantidad: ${cantidad}`); 
    // --- 1. PROCESAR EL MOVIMIENTO Y ACTUALIZAR inventarioItemFisico ---
    let piezaAfectada = null;
    let itemsCreados = [];
    
    if (tipo === 'ENTRADA') {
        console.log('ENTRADA: antes de crear item fisico')
        // En la ENTRADA, la cantidad (ej: 60 ML) se convierte en 'numPiezas' (ej: 10 varillas).
        itemsCreados = await crearItemFisico( 
            // 🚨 VERIFICA ESTO: materiumId DEBE SER USADO AQUÍ
            materiaId,  
            productoId, 
            ubicacionDestinoId, 
            numPiezas,  
            cotizacionId  
        );


        console.log('ENTRADA: despues de crear item fisico')

    } else if (tipo === 'SALIDA') {
        // En la SALIDA, se consume una parte de una pieza específica (itemFisicoId).
        piezaAfectada = await actualizarItemFisico(itemFisicoId, cantidad, null, 'SALIDA');        
    
      } else if (tipo === 'TRANSFERENCIA') {
        // En la TRANSFERENCIA, se mueve una pieza completa de ubicación.
        piezaAfectada = await actualizarItemFisico(itemFisicoId, 0, ubicacionDestinoId, 'TRANSFERENCIA');
        
        // **Nota sobre el Compromiso:** Ya no manejas 'updateCantidadComprometida' aquí.
        // El compromiso se gestiona en la tabla 'cotizacion_compromiso' y en el estado del ítem.
    }

    // --- 2. REGISTRAR EL MOVIMIENTO HISTÓRICO ---
    
    // Si fue una ENTRADA, registramos un movimiento global. 
    // Si fue SALIDA/TRANSFERENCIA, registramos el itemFisicoId.
    const itemMovimientoId = (tipo === 'ENTRADA') ? null : itemFisicoId; 

    console.log('Debe crear movimiento')
    console.log(materiaId, productoId, cotizacionId, cantidad, tipoProducto, tipo, refDoc, ubicacionOrigenId, ubicacionDestinoId, itemMovimientoId)
    const movimiento = await movimientoInventario.create({
        materiumId: materiaId,
        productoId,
        cotizacionId, 
        cantidad: cantidad, // Usamos la cantidad total del movimiento
        tipoProducto,
        tipoMovimiento: tipo,
        referenciaDeDocumento: refDoc,
        ubicacionOrigenId, 
        ubicacionDestinoId,
        itemFisicoId: itemMovimientoId // Enlace a la pieza afectada
    });
 
    return movimiento; 
}

async function trasladarMateriaPrimaPorCantidad(
    materiaId,
    cantidadNecesaria,
    ubicacionOrigenId,
    ubicacionDestinoId,
    refDoc,
    cotizacionId = null // Opcional
) {
    if (!cantidadNecesaria || cantidadNecesaria <= 0) {
        throw new Error("La cantidad a trasladar debe ser un valor positivo.");
    }
    if (!materiaId || !ubicacionOrigenId || !ubicacionDestinoId) {
        throw new Error("Faltan IDs requeridos: materiaId, ubicacionOrigenId, ubicacionDestinoId.");
    }

    let cantidadPendiente = parseFloat(cantidadNecesaria);
    const itemsAfectadosIds = [];

    // --- 1. BUSCAR ÍTEMS DISPONIBLES EN ORIGEN ---
    // Buscamos las piezas de la materia prima en la ubicación de origen, ordenadas por stock descendente.
    // Esto asegura que cortamos primero las piezas más grandes, optimizando el remanente.
    const itemsDisponibles = await inventarioItemFisico.findAll({
        where: {
            materiumId: materiaId,
            ubicacionId: ubicacionOrigenId,
            cantidadDisponible: {
                [sequelize.Op.gt]: 0 // Mayor que cero
            }
        },
        order: [['cantidadDisponible', 'DESC']]
    });

    if (itemsDisponibles.length === 0) {
        throw new Error("Stock insuficiente: No se encontraron ítems físicos disponibles en la ubicación de origen.");
    }
    
    // VERIFICACIÓN RÁPIDA DE STOCK TOTAL
    const stockTotal = itemsDisponibles.reduce((sum, item) => sum + parseFloat(item.cantidadDisponible), 0);
    if (stockTotal < cantidadNecesaria) {
        throw new Error(`Stock insuficiente. Necesario: ${cantidadNecesaria}. Disponible: ${stockTotal}.`);
    }

    // --- 2. PROCESAR CADA ÍTEM PARA CUBRIR LA CANTIDAD ---
    for (const item of itemsDisponibles) {
        if (cantidadPendiente <= 0) {
            break; // Ya cubrimos la cantidad necesaria
        }

        const itemFisicoId = item.id;
        const stockActual = parseFloat(item.cantidadDisponible);
        
        // La cantidad a sacar de la pieza actual
        const cantidadASacar = Math.min(cantidadPendiente, stockActual);
        
        // --- 3. SALIDA (CORTE) DE LA BODEGA DE ORIGEN ---
        // Usamos la función principal para registrar un movimiento de SALIDA, lo que actualizará
        // el stock de la pieza y registrará el movimiento histórico.
        await registrarMovimientoAlmacen({
            materiaId: materiaId,
            productoId: null,
            cantidad: cantidadASacar, // Cantidad consumida/cortada
            tipoProducto: 'MP',
            tipo: 'SALIDA',
            ubicacionOrigenId: ubicacionOrigenId,
            ubicacionDestinoId: null, // No aplica para la salida/corte
            refDoc: refDoc,
            cotizacionId: cotizacionId,
            itemFisicoId: itemFisicoId,
            numPiezas: 0
        });

        // --- 4. ENTRADA DE LA MATERIA TRASLADADA EN LA BODEGA DE DESTINO ---
        // Se crea un NUEVO ítem físico en la bodega de destino con la cantidad cortada.
        // Asumimos que la función crearItemFisico solo crea los ítems físicos,
        // y que el registro histórico de ENTRADA se hace de forma explícita o dentro de registrarMovimientoAlmacen.
        
        // Nota: Adaptamos la llamada a 'crearItemFisico' para que cree 1 sola pieza con la longitud del corte.
        // Esto asume que 'crearItemFisico' sabe obtener la 'medida' inicial del material, pero la sobreescribimos 
        // con la cantidad cortada para la 'cantidadDisponible' y 'longitudInicial' del nuevo ítem.
        
        // 🚨 Debido a cómo está diseñada tu 'crearItemFisico', que usa 'numPiezas' para iterar,
        // necesitamos un paso intermedio para que cree una única pieza con el tamaño correcto. 
        // Si no puedes modificar 'crearItemFisico', te daré la solución más robusta:
        
        // Opción Robusta (si 'crearItemFisico' es flexible):
        const itemCreado = await inventarioItemFisico.create({
            materiumId: materiaId,
            ubicacionId: ubicacionDestinoId,
            comprasCotizacionId: cotizacionId, 
            cantidadDisponible: cantidadASacar, // <-- Esta es la clave
            longitudInicial: cantidadASacar,   // <-- Esta es la clave
            estado: 'Disponible',
            esRemanente: false
        });
        
        // Y ahora, registramos el movimiento histórico de la ENTRADA (el traslado en destino)
        await movimientoInventario.create({
            materiumId: materiaId,
            productoId: null,
            cotizacionId: cotizacionId, 
            cantidadAfectada: cantidadASacar,
            tipoProducto: 'MP',
            tipoMovimiento: 'ENTRADA', // El traslado se registra como ENTRADA en el destino
            referenciaDeDocumento: refDoc,
            ubicacionOrigenId: ubicacionOrigenId, // Registramos el origen para el histórico completo
            ubicacionDestinoId: ubicacionDestinoId,
            itemFisicoId: itemCreado.id // Enlace a la pieza recién creada en destino
        });


        // --- 5. ACTUALIZAR PENDIENTE ---
        cantidadPendiente -= cantidadASacar;
        itemsAfectadosIds.push(itemFisicoId);
    }
    
    console.log(`Traslado exitoso. Cantidad total trasladada: ${cantidadNecesaria}.`);
    
    return { 
        msg: "Traslado completado exitosamente.", 
        itemsDeOrigenAfectados: itemsAfectadosIds, 
        cantidadTrasladada: cantidadNecesaria 
    };
}
// Para translar.
async function SubCode (){
  try{
    /*
      TRANSLADAR ES:
      EL PROCESO DE TOMAR ELEMENTOS DE UNA BODEGA Y PASARLOS A OTRA. 
      DEBO EJECUTAR LA FUNCION DE SACAR DE LA BODEGA E INGRESARLOS A LA OTRA BODEGA. SI TIENE 
      EL PROYECTO, ENTONCES LE INCLUYO EL PROYECTO. 

      -- LA FUNCIÓN DE SACAR, DEBE SACARME LA CANTIDAD DE ITEMS QUE NECESITO PORQUE LE INGRESO UNA MEDIDA
      BUSCO TODOS LOS ITEM QUE NECESITE PARA ESE TRANSLADO Y LE DOY SACAR

      Y ESOS MISMO ITEMS LES DOY INGRESAR PERO CON UNA NUEVA BODEGA.
    */
  }catch(err){
    console.log(err)
    res.status(500).json({msg: 'Ha ocurrido un error en la principal.'});
  }
}

/**
 * parseMedidaToMeters(medida)
 * - acepta: "6", "2.5", "1.8x2.30", "1,8 X 2,30", "1.8 por 2.30", "180x230", etc.
 * - devuelve: número en METROS (Number) o null si no pueda parsear.
 */
function parseMedidaToMeters(medida) {
  if (medida === null || medida === undefined) return null;
  if (typeof medida === 'number' && !isNaN(medida)) return Number(medida);

  let s = String(medida).trim();
  if (s.length === 0) return null;
  s = s.replace(/\s+/g, ' ').replace(/,/g, '.').toLowerCase();
  s = s.replace(/\s*(m2|m²|mt2|metros2|metros cuadrados|metros2)\s*$/i, '').trim();

  const multMatch = s.match(/(-?\d*\.?\d+)\s*(?:x|×|\*|por)\s*(-?\d*\.?\d+)/i);
  if (multMatch) {
    let a = parseFloat(multMatch[1]), b = parseFloat(multMatch[2]);
    if (isNaN(a) || isNaN(b)) return null;
    if (Math.abs(a) >= 50) a = a / 100;
    if (Math.abs(b) >= 50) b = b / 100;
    return Number(Number(a * b).toFixed(6));
  }

  const compactMatch = s.match(/^(-?\d*\.?\d+)[x×\*](-?\d*\.?\d+)$/i);
  if (compactMatch) {
    let a = parseFloat(compactMatch[1]), b = parseFloat(compactMatch[2]);
    if (isNaN(a) || isNaN(b)) return null;
    if (Math.abs(a) >= 50) a = a / 100;
    if (Math.abs(b) >= 50) b = b / 100;
    return Number(Number(a * b).toFixed(6));
  }

  const num = parseFloat(s);
  if (!isNaN(num)) return Number(num);
  console.warn(`parseMedidaToMeters: no pudo parsear medida="${medida}"`);
  return null;
}

// CREAR ITEMS
// Asegúrate de importar los modelos materia, producto, e inventarioItemFisico
async function crearItemFisico(
  materiumId,
  productoId,
  ubicacionDestinoId,
  numPiezas,
  comprasCotizacionId
) {
  // Validaciones mínimas
  if (!materiumId && !productoId) throw new Error("Debe proporcionar un materiumId o un productoId.");
  if (!ubicacionDestinoId) throw new Error("Debe proporcionar ubicacionDestinoId.");
  numPiezas = Number.isInteger(numPiezas) && numPiezas > 0 ? numPiezas : 1;

  let longitudInicial = null;
  let cantidadPorPieza = null; // para materia puede ser un valor >0; para producto será 1

  // --- 1. Obtener info según tipo ---
  if (materiumId) {
    const material = await materia.findByPk(materiumId, {
      attributes: ['medida']
    });
    if (!material) throw new Error("No se encontró la materia prima con el ID proporcionado.");

  const medidaString = material.medida;
  const medidaNumerica = parseMedidaToMeters(medidaString);

  if (medidaNumerica === null || medidaNumerica <= 0) {
      throw new Error(`El campo 'medida' (${medidaString}) para este material no es interpretable como metros.`);
  }

  longitudInicial = medidaNumerica;
    // Para materia, cada pieza tendrá longitudInicial = medidaNumerica
    cantidadPorPieza = longitudInicial;

  } else if (productoId) {
    // Producto terminado -> unidad por pieza
    // No usamos 'medida' para producto ahora: cada pieza es 1 unidad.
    longitudInicial = null;
    cantidadPorPieza = 1;
  }

  // --- 2. Crear registros dentro de transacción (bulkCreate para eficiencia) ---
  const ahora = new Date();
  const itemsToCreate = [];

  for (let i = 0; i < numPiezas; i++) {
    itemsToCreate.push({
      // Referencias
      materiumId: materiumId || null,
      productoId: productoId || null,
      ubicacionId: ubicacionDestinoId,

      // Referencias comerciales
      comprasCotizacionId: comprasCotizacionId || null,

      // Cantidades / medidas
      cantidadDisponible: cantidadPorPieza,
      longitudInicial: longitudInicial,

      // Metadatos / estados (ajusta nombres si tu modelo usa otros)
      estado: 'Disponible',    // como en tu versión original
      esRemanente: false,      // heurística base; podrías cambiar para materia si cantidadPorPieza < 1
      createdAt: ahora,
      updatedAt: ahora
    });
  }

  try {
    const createdItems = await sequelize.transaction(async (t) => {
      // Usa bulkCreate dentro de la transacción
      const created = await inventarioItemFisico.bulkCreate(itemsToCreate, { transaction: t, returning: true });
      return created;
    });

    // Normalizamos el retorno: cantidad total y registros creados (plain objects si es posible)
    const createdPlain = createdItems.map(ci => (ci.get ? ci.get({ plain: true }) : ci));
    const cantidadTotal = (cantidadPorPieza != null) ? (numPiezas * Number(cantidadPorPieza)) : null;

    return {
      msg: `Se crearon ${numPiezas} ítems físicos correctamente.`,
      numPiezasCreadas: numPiezas,
      cantidadTotal, // para producto será igual a numPiezas (1 por pieza)
      items: createdPlain
    };
  } catch (error) {
    console.error("Error al crear ítems físicos:", error);
    throw new Error("Fallo en la transacción al crear el inventario detallado.");
  }
}


// SACAR ITEMS - KIT 
async function sacaMateriasConsolidadoTransactional(consolidado = [], opts = {}) {
  const {
    ubicacionOrigenId = 4,
    refDoc = 'SALIDA_KIT',
    cotizacionId = null,
    usuarioId = null,
    ordenarPor = 'DESC'
  } = opts || {};

  if (!Array.isArray(consolidado) || consolidado.length === 0) {
    throw new Error('consolidado debe ser un array no vacío');
  }

  // Abrimos transacción global
  return await sequelize.transaction(async (tx) => {
    const resultados = [];

    for (const item of consolidado) {
      const materiaId = Number(item.materiaId);
      const cantidad = Number(item.totalCantidad ?? item.cantidadTotal ?? 0);

      if (!materiaId || cantidad <= 0) {
        // invalid item -> lanzamos para rollback (puedes cambiar a skip si prefieres)
        throw new Error(`Item inválido en consolidado: materiaId=${item.materiaId} cantidad=${item.totalCantidad}`);
      }

      // Llamamos a tu función que soporta transaction, pasándole tx
      const res = await sacarDelInventarioWithTransaction({
        materiumId: materiaId,
        productoId: null,
        cantidadSolicitada: cantidad,
        ubicacionOrigenId,
        refDoc,
        cotizacionId,
        usuarioId,
        ordenarPor,
        transaction: tx
      });

      // si la función retornara error en vez de lanzar, podrías verificar res.success
      resultados.push({
        materiaId,
        cantidad,
        ok: true,
        detalle: res
      });
    }

    // Si llegamos aquí sin excepciones -> commit implícito
    return { ok: true, resultados, summary: { totalItems: resultados.length } };
  }); // fin transaction
}


// SACAR DEL INVENTARIO KIT
// NUEVA FUNCIÓN: copia segura con soporte transaction sin tocar la original
async function sacarDelInventarioWithTransaction({
  materiumId = null,
  productoId = null,
  cantidadSolicitada,
  ubicacionOrigenId,
  refDoc,
  cotizacionId = null,
  usuarioId = null,
  ordenarPor = 'DESC', // 'DESC' = piezas grandes primero, 'ASC' = piezas pequeñas primero
  // transaction opcional: si se pasa, se usa; si no, la función abre su propia transacción
  transaction = null
}) {
  // mismas validaciones iniciales que la función original
  if (!materiumId && !productoId) {
    throw new Error('Debe indicar materiumId (MP) o productoId (Producto).');
  }
  if (!ubicacionOrigenId) {
    throw new Error('Falta ubicacionOrigenId.');
  }
  const cantidad = parseFloat(cantidadSolicitada);
  if (isNaN(cantidad) || cantidad <= 0) {
    throw new Error('La cantidad a sacar debe ser un número mayor que 0.');
  }

  const EPS = 0.0001;

  // === DETECCIÓN DINÁMICA: columna válida para cantidad en movimientoInventario ===
  const qi = sequelize.getQueryInterface();
  const movimientoTableName = (movimientoInventario.getTableName && movimientoInventario.getTableName()) || movimientoInventario.tableName || 'movimientoInventario';
  let cantidadColumn = 'cantidadAfectada';
  try {
    const desc = await qi.describeTable(movimientoTableName);
    const posibles = [
      'cantidadAfectada', 'cantidad', 'cantidad_afectada',
      'cantidadSalida', 'cantidad_salida', 'qty', 'cantidad_entregada', 'cantidad_salida_total'
    ];
    const found = posibles.find(p => Object.prototype.hasOwnProperty.call(desc, p));
    if (found) cantidadColumn = found;
  } catch (err) {
    console.warn('No se pudo describir movimientoInventario table; usando columna por defecto:', err.message);
  }

  // encapsulamos la lógica en runWithTx para poder reutilizarla con transaction pasada o propia
  const runWithTx = async (t) => {
    // ------------------------------------------------
    // BLOQUE 1: MATERIA PRIMA (si NO viene productoId)
    // ------------------------------------------------
    if (!productoId) {
      const itemsDisponibles = await inventarioItemFisico.findAll({
        where: {
          materiumId: materiumId,
          ubicacionId: ubicacionOrigenId,
          cantidadDisponible: { [Op.gt]: 0 }
        },
        order: [['cantidadDisponible', ordenarPor]],
        transaction: t,
        lock: t.LOCK.UPDATE
      });

      if (!itemsDisponibles || itemsDisponibles.length === 0) {
        throw new Error('No hay ítems disponibles en la ubicación de origen para esa materia prima.');
      }

      let medidaCalc = null;
      try {
        const mat = await materia.findByPk(materiumId, { attributes: ['medida'], raw: true, transaction: t });
        if (mat && mat.medida) {
          medidaCalc = typeof parseMedidaToMeters === 'function' ? parseMedidaToMeters(mat.medida) : null;
        }
      } catch (e) {
        medidaCalc = null;
      }

      if (medidaCalc !== null && !isNaN(Number(medidaCalc))) {
        for (const pieza of itemsDisponibles) {
          const cantActual = (pieza.cantidadDisponible === null || pieza.cantidadDisponible === undefined) ? 0 : Number(pieza.cantidadDisponible);
          if (isNaN(cantActual) || cantActual <= EPS) {
            pieza.cantidadDisponible = medidaCalc;
            if (pieza.longitudInicial === null || pieza.longitudInicial === undefined || Number(pieza.longitudInicial) <= 0) {
              pieza.longitudInicial = medidaCalc;
            }
            await inventarioItemFisico.update(
              { cantidadDisponible: medidaCalc, longitudInicial: medidaCalc },
              { where: { id: pieza.id }, transaction: t }
            );
          } else {
            if (pieza.longitudInicial === null || pieza.longitudInicial === undefined || Number(pieza.longitudInicial) <= 0) {
              pieza.longitudInicial = medidaCalc;
              await inventarioItemFisico.update(
                { longitudInicial: medidaCalc },
                { where: { id: pieza.id }, transaction: t }
              );
            }
          }
        }
      }

      const stockTotal = itemsDisponibles.reduce((s, it) => {
        const v = (it.cantidadDisponible === null || it.cantidadDisponible === undefined) ? 0 : parseFloat(it.cantidadDisponible);
        return s + (isNaN(v) ? 0 : v);
      }, 0);
      if (stockTotal + EPS < cantidad) {
        throw new Error(`Stock insuficiente. Necesario: ${cantidad}. Disponible: ${stockTotal}.`);
      }

      let restante = cantidad;
      const detalles = [];

      for (const pieza of itemsDisponibles) {
        if (restante <= EPS) break;

        const itemId = pieza.id;
        const stockActual = parseFloat(pieza.cantidadDisponible);
        if (isNaN(stockActual) || stockActual <= EPS) continue;

        const aConsumir = Math.min(restante, stockActual);
        const nuevoStock = +(stockActual - aConsumir);

        let nuevoEstado = 'Cortada';
        let esRemanente = true;
        if (nuevoStock <= EPS) {
          nuevoEstado = 'Agotada';
          esRemanente = false;
        } else {
          nuevoEstado = 'Cortada';
          esRemanente = true;
        }

        await pieza.update({
          cantidadDisponible: nuevoStock,
          estado: nuevoEstado,
          esRemanente: esRemanente
        }, { transaction: t });

        const movData = {
          materiumId: materiumId,
          productoId: null,
          cotizacionId: cotizacionId,
          tipoProducto: 'MP',
          tipoMovimiento: 'SALIDA',
          referenciaDeDocumento: refDoc,
          ubicacionOrigenId: ubicacionOrigenId,
          ubicacionDestinoId: null,
          itemFisicoId: itemId,
          usuarioId: usuarioId
        };
        movData[cantidadColumn] = aConsumir;

        const mov = await movimientoInventario.create(movData, { transaction: t });

        detalles.push({
          itemId,
          tipo: 'MP',
          longitudInicial: pieza.longitudInicial !== undefined ? parseFloat(pieza.longitudInicial) : null,
          consumo: aConsumir,
          nuevoStock,
          movimientoId: mov.id,
          estado: nuevoEstado,
          esRemanente
        });

        restante = +(restante - aConsumir);
      }

      if (restante > EPS) {
        throw new Error(`No se pudo consumir la cantidad completa de materia prima. Falta: ${restante}`);
      }

      return {
        success: true,
        tipo: 'MP',
        id: materiumId,
        ubicacionOrigenId,
        cantidadSolicitada: cantidad,
        totalConsumido: detalles.reduce((s, d) => s + d.consumo, 0),
        detalles
      };
    }

    // ------------------------------------------------
    // BLOQUE 2: PRODUCTO (si viene productoId)
    // ------------------------------------------------
    else {
      if (!Number.isInteger(cantidad)) {
        throw new Error('Para productos terminados la cantidad debe ser un número entero (unidades).');
      }

      const itemsDisponibles = await inventarioItemFisico.findAll({
        where: {
          productoId: productoId,
          ubicacionId: ubicacionOrigenId,
          cantidadDisponible: { [Op.gt]: 0 }
        },
        order: [['cantidadDisponible', ordenarPor]],
        transaction: t,
        lock: t.LOCK.UPDATE
      });

      if (!itemsDisponibles || itemsDisponibles.length === 0) {
        throw new Error('No hay ítems disponibles en la ubicación de origen para ese producto.');
      }

      const stockTotal = itemsDisponibles.reduce((s, it) => s + parseFloat(it.cantidadDisponible), 0);
      if (stockTotal + EPS < cantidad) {
        throw new Error(`Stock insuficiente. Necesario: ${cantidad}. Disponible: ${stockTotal}.`);
      }

      let restante = cantidad;
      const detalles = [];

      for (const pieza of itemsDisponibles) {
        if (restante <= EPS) break;

        const itemId = pieza.id;
        const stockActual = parseFloat(pieza.cantidadDisponible);
        if (stockActual <= EPS) continue;

        const aConsumir = Math.min(restante, stockActual);
        const nuevoStock = +(stockActual - aConsumir);

        let nuevoEstado = 'Cortada';
        let esRemanente = true;
        if (nuevoStock <= EPS) {
          nuevoEstado = 'Agotada';
          esRemanente = false;
        } else {
          nuevoEstado = 'Cortada';
          esRemanente = true;
        }

        await pieza.update({
          cantidadDisponible: nuevoStock,
          estado: nuevoEstado,
          esRemanente: esRemanente
        }, { transaction: t });

        const movData = {
          materiumId: null,
          productoId: productoId,
          cotizacionId: cotizacionId,
          tipoProducto: 'PR',
          tipoMovimiento: 'SALIDA',
          referenciaDeDocumento: refDoc,
          ubicacionOrigenId: ubicacionOrigenId,
          ubicacionDestinoId: null,
          itemFisicoId: itemId,
          usuarioId: usuarioId
        };
        movData[cantidadColumn] = aConsumir;

        const mov = await movimientoInventario.create(movData, { transaction: t });

        detalles.push({
          itemId,
          tipo: 'PR',
          longitudInicial: pieza.longitudInicial !== undefined ? parseFloat(pieza.longitudInicial) : null,
          consumo: aConsumir,
          nuevoStock,
          movimientoId: mov.id,
          estado: nuevoEstado,
          esRemanente
        });

        restante = +(restante - aConsumir);
      }

      if (restante > EPS) {
        throw new Error(`No se pudo consumir la cantidad completa del producto. Falta: ${restante}`);
      }

      return {
        success: true,
        tipo: 'PR',
        id: productoId,
        ubicacionOrigenId,
        cantidadSolicitada: cantidad,
        totalConsumido: detalles.reduce((s, d) => s + d.consumo, 0),
        detalles
      };
    }
  }; // fin runWithTx

  // Si nos pasaron transaction la usamos; si no, abrimos una transacción nueva (comportamiento anterior)
  if (transaction) {
    return await runWithTx(transaction);
  } else {
    return await sequelize.transaction(async (t) => {
      return await runWithTx(t);
    });
  }
}


// SACAR DEL INVENTARIO
async function sacarDelInventario({
  materiumId = null,
  productoId = null,
  cantidadSolicitada,
  ubicacionOrigenId,
  refDoc,
  cotizacionId = null,
  usuarioId = null,
  ordenarPor = 'DESC' // 'DESC' = piezas grandes primero, 'ASC' = piezas pequeñas primero
}) {
  // Validaciones iniciales
  if (!materiumId && !productoId) {
    throw new Error('Debe indicar materiumId (MP) o productoId (Producto).');
  }
  if (!ubicacionOrigenId) {
    throw new Error('Falta ubicacionOrigenId.');
  }
  const cantidad = parseFloat(cantidadSolicitada);
  if (isNaN(cantidad) || cantidad <= 0) {
    throw new Error('La cantidad a sacar debe ser un número mayor que 0.');
  }

  const EPS = 0.0001;

  // === DETECCIÓN DINÁMICA: columna válida para cantidad en movimientoInventario ===
  // Esto evita errores si la tabla no tiene "cantidadAfectada"
  const qi = sequelize.getQueryInterface();
  const movimientoTableName = (movimientoInventario.getTableName && movimientoInventario.getTableName()) || movimientoInventario.tableName || 'movimientoInventario';
  let cantidadColumn = 'cantidadAfectada'; // fallback por compatibilidad con tu código actual
  try {
    const desc = await qi.describeTable(movimientoTableName);
    const posibles = [
      'cantidadAfectada', 'cantidad', 'cantidad_afectada',
      'cantidadSalida', 'cantidad_salida', 'qty', 'cantidad_entregada', 'cantidad_salida_total'
    ];
    const found = posibles.find(p => Object.prototype.hasOwnProperty.call(desc, p));
    if (found) cantidadColumn = found;
  } catch (err) {
    // Si falla describeTable, mantenemos el fallback 'cantidadAfectada'
    console.warn('No se pudo describir movimientoInventario table; usando columna por defecto:', err.message);
  }

  return await sequelize.transaction(async (t) => {
    // ------------------------------------------------
    // BLOQUE 1: MATERIA PRIMA (si NO viene productoId)
    // ------------------------------------------------
    if (!productoId) {
      // 1) obtener items disponibles para la materia prima y bloquearlos (FOR UPDATE)
      const itemsDisponibles = await inventarioItemFisico.findAll({
        where: {
          materiumId: materiumId,
          ubicacionId: ubicacionOrigenId,
          cantidadDisponible: { [Op.gt]: 0 } // seguimos buscando >0, pero parcheamos piezas con valores faltantes si es necesario
        },
        order: [['cantidadDisponible', ordenarPor]],
        transaction: t,
        lock: t.LOCK.UPDATE
      });

      if (!itemsDisponibles || itemsDisponibles.length === 0) {
        throw new Error('No hay ítems disponibles en la ubicación de origen para esa materia prima.');
      }

      // --- PARCHE: asegurar longitudInicial/cantidadDisponible desde materia.medida si faltan ---
      // Cargar la medida de la materia (solo una vez)
      let medidaCalc = null;
      try {
        const mat = await materia.findByPk(materiumId, { attributes: ['medida'], raw: true, transaction: t });
        if (mat && mat.medida) {
          // parseMedidaToMeters debe existir en tu código (helper). Devuelve null si no puede parsear.
          medidaCalc = typeof parseMedidaToMeters === 'function' ? parseMedidaToMeters(mat.medida) : null;
        }
      } catch (e) {
        // no crítico: si falla, seguimos sin medidaCalc
        medidaCalc = null;
      }

      if (medidaCalc !== null && !isNaN(Number(medidaCalc))) {
        // Normalizar piezas en memoria y opcionalmente persistir corrección
        for (const pieza of itemsDisponibles) {
          // Si la pieza no tiene cantidadDisponible válida, asignamos medidaCalc
          const cantActual = (pieza.cantidadDisponible === null || pieza.cantidadDisponible === undefined) ? 0 : Number(pieza.cantidadDisponible);
          if (isNaN(cantActual) || cantActual <= EPS) {
            // asignar en memoria para que el flujo use el valor correcto
            pieza.cantidadDisponible = medidaCalc;
            // opcional: también asignar longitudInicial si falta
            if (pieza.longitudInicial === null || pieza.longitudInicial === undefined || Number(pieza.longitudInicial) <= 0) {
              pieza.longitudInicial = medidaCalc;
            }
            // Persistir la corrección en la BD para no recalcularla después
            // Si prefieres NO persistir, comenta la siguiente línea.
            await inventarioItemFisico.update(
              { cantidadDisponible: medidaCalc, longitudInicial: medidaCalc },
              { where: { id: pieza.id }, transaction: t }
            );
          } else {
            // si cantidadDisponible existe pero longitudInicial no, rellenamos longitudInicial en DB/opcionalmente en memoria
            if (pieza.longitudInicial === null || pieza.longitudInicial === undefined || Number(pieza.longitudInicial) <= 0) {
              pieza.longitudInicial = medidaCalc;
              // Persistir longitudInicial si quieres
              await inventarioItemFisico.update(
                { longitudInicial: medidaCalc },
                { where: { id: pieza.id }, transaction: t }
              );
            }
          }
        }
      }

      // 2) verificar stock total (usar los valores ya normalizados en memoria)
      const stockTotal = itemsDisponibles.reduce((s, it) => {
        const v = (it.cantidadDisponible === null || it.cantidadDisponible === undefined) ? 0 : parseFloat(it.cantidadDisponible);
        return s + (isNaN(v) ? 0 : v);
      }, 0);
      if (stockTotal + EPS < cantidad) {
        throw new Error(`Stock insuficiente. Necesario: ${cantidad}. Disponible: ${stockTotal}.`);
      }

      // 3) iterar y consumir
      let restante = cantidad;
      const detalles = [];

      for (const pieza of itemsDisponibles) {
        if (restante <= EPS) break;

        const itemId = pieza.id;
        const stockActual = parseFloat(pieza.cantidadDisponible);
        if (isNaN(stockActual) || stockActual <= EPS) continue;

        const aConsumir = Math.min(restante, stockActual);
        const nuevoStock = +(stockActual - aConsumir);

        // determinar nuevo estado / esRemanente (tu lógica de MP)
        let nuevoEstado = 'Cortada';
        let esRemanente = true;
        if (nuevoStock <= EPS) {
          nuevoEstado = 'Agotada';
          esRemanente = false;
        } else {
          nuevoEstado = 'Cortada';
          esRemanente = true;
        }

        // actualizar la pieza origen (MP): solo cantidadDisponible, estado, esRemanente
        await pieza.update({
          cantidadDisponible: nuevoStock,
          estado: nuevoEstado,
          esRemanente: esRemanente
        }, { transaction: t });

        // registrar movimiento SALIDA vinculado a la pieza origen (MP)
        const movData = {
          materiumId: materiumId,
          productoId: null,
          cotizacionId: cotizacionId,
          tipoProducto: 'MP',
          tipoMovimiento: 'SALIDA',
          referenciaDeDocumento: refDoc,
          ubicacionOrigenId: ubicacionOrigenId,
          ubicacionDestinoId: null,
          itemFisicoId: itemId,
          usuarioId: usuarioId
        };
        // Agregar la cantidad usando la columna detectada
        movData[cantidadColumn] = aConsumir;

        const mov = await movimientoInventario.create(movData, { transaction: t });

        detalles.push({
          itemId,
          tipo: 'MP',
          longitudInicial: pieza.longitudInicial !== undefined ? parseFloat(pieza.longitudInicial) : null,
          consumo: aConsumir,
          nuevoStock,
          movimientoId: mov.id,
          estado: nuevoEstado,
          esRemanente
        });

        restante = +(restante - aConsumir);
      }

      if (restante > EPS) {
        throw new Error(`No se pudo consumir la cantidad completa de materia prima. Falta: ${restante}`);
      }

      return {
        success: true,
        tipo: 'MP',
        id: materiumId,
        ubicacionOrigenId,
        cantidadSolicitada: cantidad,
        totalConsumido: detalles.reduce((s, d) => s + d.consumo, 0),
        detalles
      };
    }

    // ------------------------------------------------
    // BLOQUE 2: PRODUCTO (si viene productoId)
    // ------------------------------------------------
    else {
      // Para productos: exigir cantidad entera (unidades)
      if (!Number.isInteger(cantidad)) {
        throw new Error('Para productos terminados la cantidad debe ser un número entero (unidades).');
      }

      // 1) obtener items disponibles para el producto y bloquearlos (FOR UPDATE)
      const itemsDisponibles = await inventarioItemFisico.findAll({
        where: {
          productoId: productoId,
          ubicacionId: ubicacionOrigenId,
          cantidadDisponible: { [Op.gt]: 0 }
        },
        order: [['cantidadDisponible', ordenarPor]],
        transaction: t,
        lock: t.LOCK.UPDATE
      });

      if (!itemsDisponibles || itemsDisponibles.length === 0) {
        throw new Error('No hay ítems disponibles en la ubicación de origen para ese producto.');
      }

      // 2) verificar stock total
      const stockTotal = itemsDisponibles.reduce((s, it) => s + parseFloat(it.cantidadDisponible), 0);
      if (stockTotal + EPS < cantidad) {
        throw new Error(`Stock insuficiente. Necesario: ${cantidad}. Disponible: ${stockTotal}.`);
      }

      // 3) iterar y consumir (para producto normalmente cada pieza es 1 unidad)
      let restante = cantidad;
      const detalles = [];

      for (const pieza of itemsDisponibles) {
        if (restante <= EPS) break;

        const itemId = pieza.id;
        const stockActual = parseFloat(pieza.cantidadDisponible);
        if (stockActual <= EPS) continue;

        // Para productos queremos consumir piezas completas por defecto (1 unidad)
        // pero respetamos si una pieza tiene cantidadDisponible > 1 (p. ej. paquete)
        const aConsumir = Math.min(restante, stockActual);
        const nuevoStock = +(stockActual - aConsumir);

        // determinar nuevo estado / esRemanente (puedes ajustar reglas para producto si difieren)
        let nuevoEstado = 'Cortada';
        let esRemanente = true;
        if (nuevoStock <= EPS) {
          nuevoEstado = 'Agotada';
          esRemanente = false;
        } else {
          nuevoEstado = 'Cortada';
          esRemanente = true;
        }

        // actualizar la pieza origen (Producto): solo cantidadDisponible, estado, esRemanente
        await pieza.update({
          cantidadDisponible: nuevoStock,
          estado: nuevoEstado,
          esRemanente: esRemanente
        }, { transaction: t });

        // registrar movimiento SALIDA vinculado a la pieza origen (Producto)
        const movData = {
          materiumId: null,
          productoId: productoId,
          cotizacionId: cotizacionId,
          tipoProducto: 'PR',
          tipoMovimiento: 'SALIDA',
          referenciaDeDocumento: refDoc,
          ubicacionOrigenId: ubicacionOrigenId,
          ubicacionDestinoId: null,
          itemFisicoId: itemId,
          usuarioId: usuarioId
        };
        // Agregar la cantidad usando la columna detectada
        movData[cantidadColumn] = aConsumir;

        const mov = await movimientoInventario.create(movData, { transaction: t });

        detalles.push({
          itemId,
          tipo: 'PR',
          longitudInicial: pieza.longitudInicial !== undefined ? parseFloat(pieza.longitudInicial) : null,
          consumo: aConsumir,
          nuevoStock,
          movimientoId: mov.id,
          estado: nuevoEstado,
          esRemanente
        });

        restante = +(restante - aConsumir);
      }

      if (restante > EPS) {
        throw new Error(`No se pudo consumir la cantidad completa del producto. Falta: ${restante}`);
      }

      return {
        success: true,
        tipo: 'PR',
        id: productoId,
        ubicacionOrigenId,
        cantidadSolicitada: cantidad,
        totalConsumido: detalles.reduce((s, d) => s + d.consumo, 0),
        detalles
      };
    }
  }); // fin transaction
}



// Transladar... Función atomica
async function trasladarPorCantidadAtomic({
  materiumId = null,
  productoId = null,
  cantidadSolicitada,
  ubicacionOrigenId,
  ubicacionDestinoId,
  refDoc,
  cotizacionId = null,           // referencia de cotización/proyecto (opcional)
  comprasCotizacionId = null,    // orden de compra / id de entrega (opcional)
  usuarioId = null,
  ordenarPor = 'DESC'            // 'DESC' piezas grandes primero, 'ASC' pequeñas primero
}) {
  if (!materiumId && !productoId) throw new Error('Debe especificar materiumId o productoId.');
  if (!ubicacionOrigenId || !ubicacionDestinoId) throw new Error('Requiere ubicacionOrigenId y ubicacionDestinoId.');
  const cantidad = parseFloat(cantidadSolicitada);
  if (isNaN(cantidad) || cantidad <= 0) throw new Error('La cantidad a trasladar debe ser mayor que 0.');

  const EPS = 0.0001;
  const campoFiltro = productoId ? 'productoId' : 'materiumId';
  const idFiltro = productoId ? productoId : materiumId;
  const tipoProducto = productoId ? 'PR' : 'MP';

  return await sequelize.transaction(async (t) => {
    // 1) obtener items disponibles en origen y bloquearlos
    const itemsDisponibles = await inventarioItemFisico.findAll({
      where: {
        [campoFiltro]: idFiltro,
        ubicacionId: ubicacionOrigenId,
        cantidadDisponible: { [Op.gt]: 0 }
      },
      order: [['cantidadDisponible', ordenarPor]],
      transaction: t,
      lock: t.LOCK.UPDATE
    });

    if (!itemsDisponibles || itemsDisponibles.length === 0) {
      throw new Error('No hay ítems disponibles en la ubicación de origen.');
    }

    // 2) verificar stock total
    const stockTotal = itemsDisponibles.reduce((s, it) => s + parseFloat(it.cantidadDisponible), 0);
    if (stockTotal + EPS < cantidad) {
      throw new Error(`Stock insuficiente. Necesario: ${cantidad}. Disponible: ${stockTotal}.`);
    }

    // 3) iterar y trasladar
    let restante = cantidad;
    const detalles = []; // recoge info de cada corte/traslado

    for (const pieza of itemsDisponibles) {
      if (restante <= EPS) break;
      const origenId = pieza.id;
      const stockActual = parseFloat(pieza.cantidadDisponible);
      if (stockActual <= EPS) continue;

      const aConsumir = Math.min(restante, stockActual);
      const nuevoStockOrigen = +(stockActual - aConsumir);

      // actualizar pieza origen (cantidadDisponible, estado, esRemanente)
      let nuevoEstadoOrigen = 'Cortada';
      let esRemanenteOrigen = true;
      if (nuevoStockOrigen <= EPS) {
        nuevoEstadoOrigen = 'Agotada';
        esRemanenteOrigen = false;
      }

      await pieza.update({
        cantidadDisponible: nuevoStockOrigen,
        estado: nuevoEstadoOrigen,
        esRemanente: esRemanenteOrigen
      }, { transaction: t });

      // registrar movimiento SALIDA (origen)
      const movSalida = await movimientoInventario.create({
        materiumId: materiumId || null,
        productoId: productoId || null,
        cotizacionId: cotizacionId,
        comprasCotizacionId: comprasCotizacionId, // si aplica, lo dejamos también en la salida
        cantidadAfectada: aConsumir,
        tipoProducto,
        tipoMovimiento: 'SALIDA',
        referenciaDeDocumento: refDoc,
        ubicacionOrigenId,
        ubicacionDestinoId: ubicacionDestinoId,
        itemFisicoId: origenId,
        usuarioId
      }, { transaction: t });

      // crear nuevo item en destino (remanente / trozo trasladado)
      // según tu diseño, longitudInicial = longitudInicial_origen (referencia)
      const nuevoItem = await inventarioItemFisico.create({
        [campoFiltro]: idFiltro,
        ubicacionId: ubicacionDestinoId,
        cantidadDisponible: aConsumir,
        longitudInicial: pieza.longitudInicial !== undefined ? pieza.longitudInicial : null,
        estado: 'Disponible',
        esRemanente: false, // es el trozo recién creado; puedes ajustar
        parent_item_fisico_id: origenId || null,
        comprasCotizacionId: comprasCotizacionId || null, // se guarda la orden/entrega si aplica
        // añade otros campos que necesites (referencias, lote, etc.)
      }, { transaction: t });

      // registrar movimiento ENTRADA (destino), ligado al nuevo item
      const movEntrada = await movimientoInventario.create({
        materiumId: materiumId || null,
        productoId: productoId || null,
        cotizacionId: cotizacionId,
        comprasCotizacionId: comprasCotizacionId,
        cantidadAfectada: aConsumir,
        tipoProducto,
        tipoMovimiento: 'ENTRADA',
        referenciaDeDocumento: refDoc,
        ubicacionOrigenId,
        ubicacionDestinoId,
        itemFisicoId: nuevoItem.id,               // el item destino
        itemFisicoOrigenId: origenId,             // campo extra si tu modelo lo soporta (si no, lo puedes guardar en referenciaDeDocumento)
        usuarioId
      }, { transaction: t });

      detalles.push({
        origenId,
        nuevoItemId: nuevoItem.id,
        consumo: aConsumir,
        nuevoStockOrigen,
        movSalidaId: movSalida.id,
        movEntradaId: movEntrada.id,
        longitudInicialReferencia: pieza.longitudInicial !== undefined ? parseFloat(pieza.longitudInicial) : null
      });

      restante = +(restante - aConsumir);
    }

    if (restante > EPS) {
      // seguridad: no debería pasar
      throw new Error(`No se completó el traslado. Falta: ${restante}`);
    }

    return {
      success: true,
      tipoProducto,
      idProductoOMateria: idFiltro,
      ubicacionOrigenId,
      ubicacionDestinoId,
      cantidadSolicitada: cantidad,
      totalTrasladado: detalles.reduce((s, d) => s + d.consumo, 0),
      detalles
    };
  }); // fin transaction
}

// TRANSLADAR COMPLETO
async function seleccionarYTrasladarParaProyecto({
  materiumId = null,
  productoId = null,
  cantidadNecesaria,
  ubicacionOrigenId,
  ubicacionDestinoId = null,
  refDoc = null,
  preferWhole = true,
  minUsableRemnant = 0.5,
  applyChanges = true,
  idsAdicionales = {}
}) {


  if (!materiumId && !productoId) throw new Error('Debe indicar materiumId o productoId.');
  if (!ubicacionOrigenId) throw new Error('Falta ubicacionOrigenId.');
  const cantidad = parseFloat(cantidadNecesaria);
  if (isNaN(cantidad) || cantidad <= 0) throw new Error('cantidadNecesaria debe ser > 0.');

  const EPS = 1e-9;
  const campoFiltro = productoId ? 'productoId' : 'materiumId';
  const idFiltro = productoId ? productoId : materiumId;
  const tipoProducto = productoId ? 'PR' : 'MP';

  return await sequelize.transaction(async (t) => {
    // 1) tomar items y lock
    let items = await inventarioItemFisico.findAll({
      where: {
        [campoFiltro]: idFiltro,
        ubicacionId: ubicacionOrigenId,
        cantidadDisponible: { [Op.gt]: 0 }
      },
      // ordenar para heurística: piezas grandes primero
      order: [['cantidadDisponible', 'DESC']],
      transaction: t,
      lock: t.LOCK.UPDATE
    });

    if (!items || items.length === 0) {
      throw new Error('No hay ítems disponibles en origen.');
    }

    const stockTotal = items.reduce((s, it) => s + parseFloat(it.cantidadDisponible), 0);
    if (stockTotal + EPS < cantidad) {
      throw new Error(`Stock insuficiente. Necesario: ${cantidad}. Disponible: ${stockTotal}.`);
    }

    // Plan de consumo: array de { item, consumir, nuevoStock, tomarCompleta(boolean) }
    const plan = [];
    let restante = cantidad;

    // Helper: marcar item como "consumido totalmente" y agregar al plan
    const consumirCompleta = (it) => {
      const stockActual = parseFloat(it.cantidadDisponible);
      plan.push({
        itemId: it.id,
        consumir: stockActual,
        nuevoStock: 0,
        tomaCompleta: true,
        longitudInicial: it.longitudInicial !== undefined ? parseFloat(it.longitudInicial) : null
      });
      restante = +(restante - stockActual);
    };

    if (preferWhole) {
      // 1) Intentar usar piezas completas (whole) hasta cubrir o agotar whole candidates
      for (const it of items) {
        if (restante <= EPS) break;
        const stockActual = parseFloat(it.cantidadDisponible);

        // Si la pieza completa ayuda a cubrir restante, tomarla entera
        // Regla: si stockActual <= restante => tomarla completa (sumará)
        // Si stockActual > restante, tomar completa solo si:
        //   - no hay otra pieza que deje remanente usable al cortarla
        //   - o tomar completo es preferible porque evita remanentes pequeños
        if (stockActual <= restante + EPS) {
          consumirCompleta(it);
        } else {
          // stockActual > restante: considerar cortar parcial
          const remanenteSiCorto = +(stockActual - restante);
          if (remanenteSiCorto + EPS >= minUsableRemnant) {
            // podemos cortar y dejar remanente usable
            plan.push({
              itemId: it.id,
              consumir: restante,
              nuevoStock: remanenteSiCorto,
              tomaCompleta: false,
              longitudInicial: it.longitudInicial !== undefined ? parseFloat(it.longitudInicial) : null
            });
            restante = 0;
            break;
          } else {
            // remanente demasiado pequeño -> mejor tomar la pieza completa (aceptar sobrante)
            consumirCompleta(it);
          }
        }
      }

      // Si quedó restante > 0 (raro porque chequeamos stockTotal), recorrer again
      if (restante > EPS) {
        for (const it of items) {
          if (restante <= EPS) break;
          // si ya plan incluye this item, skip
          if (plan.some(p => p.itemId === it.id)) continue;
          const stockActual = parseFloat(it.cantidadDisponible);
          if (stockActual <= EPS) continue;
          // intentar consumir parcialmente si deja remanente usable
          const aConsumir = Math.min(restante, stockActual);
          const rem = +(stockActual - aConsumir);
          if (rem + EPS >= minUsableRemnant) {
            plan.push({
              itemId: it.id,
              consumir: aConsumir,
              nuevoStock: rem,
              tomaCompleta: aConsumir >= stockActual - EPS ? true : false,
              longitudInicial: it.longitudInicial !== undefined ? parseFloat(it.longitudInicial) : null
            });
            restante = +(restante - aConsumir);
          } else {
            // tomar completa si necesario
            consumirCompleta(it);
          }
        }
      }
    } else {
      // prefer exact: consumir lo más cercano posible sin generar remanente < minUsableRemnant
      for (const it of items) {
        if (restante <= EPS) break;
        const stockActual = parseFloat(it.cantidadDisponible);
        if (stockActual <= EPS) continue;
        // si cortar para satisfacer restante deja remanente >= minUsableRemnant, ok
        const aConsumir = Math.min(restante, stockActual);
        const remIfCut = +(stockActual - aConsumir);
        if (remIfCut + EPS >= minUsableRemnant || Math.abs(remIfCut) <= EPS) {
          // aceptable
          plan.push({
            itemId: it.id,
            consumir: aConsumir,
            nuevoStock: remIfCut,
            tomaCompleta: Math.abs(remIfCut) <= EPS,
            longitudInicial: it.longitudInicial !== undefined ? parseFloat(it.longitudInicial) : null
          });
          restante = +(restante - aConsumir);
        } else {
          // remanente muy pequeño -> en lugar de cortar tomar completa o buscar otra pieza más grande
          // si stockActual <= restante -> tomar completa
          if (stockActual <= restante + EPS) {
            consumirCompleta(it);
          } else {
            // stockActual > restante but remanente < minUsableRemnant -> buscar otra pieza que pueda dejar remanente usable
            // buscamos en items posteriores
            const candidate = items.find(j => {
              const sj = parseFloat(j.cantidadDisponible);
              if (j.id === it.id) return false;
              if (sj <= EPS) return false;
              const remIfCutJ = +(sj - Math.min(restante, sj));
              return remIfCutJ + EPS >= minUsableRemnant || Math.abs(remIfCutJ) <= EPS;
            });
            if (candidate) {
              // consumimos de candidate en next loop (salimos de la actual sin usarla)
              continue;
            } else {
              // no hay candidate -> tomar completa la actual (evitar remanente pequeño)
              consumirCompleta(it);
            }
          }
        }
      }
    }

    // Al final, validar que el plan cubre la necesidad
    const totalPlan = plan.reduce((s, p) => s + parseFloat(p.consumir), 0);
    if (totalPlan + EPS < cantidad) {
      throw new Error(`No se pudo planificar la cantidad total. Planeado: ${totalPlan}, requerido: ${cantidad}`);
    }

    // Si applyChanges = true, aplicamos updates y movimientos (todo en la misma transacción)
    const resultados = [];
    if (applyChanges) {
      for (const p of plan) {
        // obtener el objeto pieza actual con lock (ya tenemos items bloqueados)
        const pieza = items.find(it => it.id === p.itemId);
        if (!pieza) throw new Error(`Pieza ${p.itemId} no encontrada al aplicar cambios.`);

        // actualizar cantidadDisponible y estado
        await pieza.update({
          cantidadDisponible: p.nuevoStock,
          estado: p.nuevoStock <= EPS ? 'Agotada' : 'Cortada',
          esRemanente: p.nuevoStock > EPS
        }, { transaction: t });

        // registro SALIDA
        const movSalida = await movimientoInventario.create({
          materiumId: materiumId || null,
          productoId: productoId || null,
          cotizacionId: idsAdicionales.cotizacionId || null,
          comprasCotizacionId: idsAdicionales.comprasCotizacionId || null,
          cantidadAfectada: p.consumir,
          tipoProducto,
          tipoMovimiento: 'SALIDA',
          referenciaDeDocumento: refDoc,
          ubicacionOrigenId,
          ubicacionDestinoId: ubicacionDestinoId || null,
          itemFisicoId: p.itemId,
          usuarioId: idsAdicionales.usuarioId || null
        }, { transaction: t });

        let nuevoItemDestino = null;
        let movEntrada = null;
        if (ubicacionDestinoId) {
          // crear item en destino con longitudInicial = referencia del origen (según tu preferencia)
          nuevoItemDestino = await inventarioItemFisico.create({
            [campoFiltro]: idFiltro,
            ubicacionId: ubicacionDestinoId,
            cantidadDisponible: p.consumir,
            longitudInicial: pieza.longitudInicial !== undefined ? pieza.longitudInicial : null,
            estado: 'Disponible',
            esRemanente: false,
            parent_item_fisico_id: pieza.id,
            comprasCotizacionId: idsAdicionales.comprasCotizacionId || null
          }, { transaction: t });

          // registro ENTRADA
          movEntrada = await movimientoInventario.create({
            materiumId: materiumId || null,
            productoId: productoId || null,
            cotizacionId: idsAdicionales.cotizacionId || null,
            comprasCotizacionId: idsAdicionales.comprasCotizacionId || null,
            cantidadAfectada: p.consumir,
            tipoProducto,
            tipoMovimiento: 'ENTRADA',
            referenciaDeDocumento: refDoc,
            ubicacionOrigenId,
            ubicacionDestinoId,
            itemFisicoId: nuevoItemDestino.id,
            itemFisicoOrigenId: pieza.id,
            usuarioId: idsAdicionales.usuarioId || null
          }, { transaction: t });
        }

        resultados.push({
          itemIdOrigen: pieza.id,
          consumo: p.consumir,
          nuevoStockOrigen: p.nuevoStock,
          movimientoSalidaId: movSalida.id,
          nuevoItemDestinoId: nuevoItemDestino ? nuevoItemDestino.id : null,
          movimientoEntradaId: movEntrada ? movEntrada.id : null
        });
      }
    }

    return {
      success: true,
      tipoProducto,
      idProductoOMateria: idFiltro,
      cantidadNecesaria: cantidad,
      preferWhole,
      minUsableRemnant,
      plan,
      resultados
    };
  }); // fin transaction
}

// SACAR
async function actualizarItemFisico(itemFisicoId, cantidad, nuevaUbicacionId, tipoOperacion) {
    
    let piezaActualizada = null;

    try {
        await sequelize.transaction(async (t) => {
            
            // 1. Obtener la pieza y bloquear la fila (LOCK.UPDATE) para seguridad en el corte.
            const pieza = await inventarioItemFisico.findByPk(itemFisicoId, { 
                transaction: t,
                lock: t.LOCK.UPDATE 
            });

            if (!pieza) {
                throw new Error(`Ítem Físico ID ${itemFisicoId} no encontrado.`);
            }

            // --- 2. Lógica de Consumo (SALIDA) ---
            if (tipoOperacion === 'SALIDA') {
                const stockActual = parseFloat(pieza.cantidadDisponible);
                const consumo = parseFloat(cantidad); 
                
                // Validar que el stock sea suficiente
                if (consumo <= 0 || stockActual < consumo) {
                    throw new Error(`Stock insuficiente. Solicitado: ${consumo}. Disponible: ${stockActual}.`);
                }

                const nuevoStock = stockActual - consumo;
                let nuevoEstado = 'Cortada';
                let esRemanente = true;

                // Determinar el nuevo estado
                if (nuevoStock < 0.001) { // Usamos un margen pequeño para evitar errores de coma flotante
                    nuevoEstado = 'Agotada';
                    esRemanente = false;
                } else if (Math.abs(nuevoStock - parseFloat(pieza.longitudInicial)) < 0.001) {
                    // Si el stock es igual a la longitud inicial (por ejemplo, después de una devolución total), regresa a Disponible
                    nuevoEstado = 'Disponible';
                    esRemanente = false;
                }

                // Aplicar la actualización del stock y estado
                piezaActualizada = await pieza.update({
                    cantidadDisponible: nuevoStock,
                    estado: nuevoEstado,
                    esRemanente: esRemanente
                }, { transaction: t });

            // --- 3. Lógica de Transferencia ---
            } else if (tipoOperacion === 'TRANSFERENCIA') {
                
                if (!nuevaUbicacionId) {
                    throw new Error("Se requiere nuevaUbicacionId para la TRANSFERENCIA.");
                }

                // Aplicar la actualización de la ubicación
                piezaActualizada = await pieza.update({
                    ubicacionId: nuevaUbicacionId,
                    // El estado se mantiene
                }, { transaction: t });
            }
        });

        return piezaActualizada;

    } catch (error) {
        console.error(`Error en actualización de Ítem Físico ${itemFisicoId}:`, error.message);
        throw error;
    }
}

async function updateCantidadComprometida(materiaId, productoId, cantidad, ubicacionId){
  if(!productoId){
    let inventary = await inventario.findOne({ where: { materiumId: materiaId, ubicacionId } });
    inventary.cantidadComprometida = parseFloat(inventary.cantidadComprometida) + parseFloat(cantidad);
    
    inventary.save() 
  }else{
    let inventary = await inventario.findOne({ where: { productoId: productoId, ubicacionId } });
    inventary.cantidadComprometida = parseFloat(inventary.cantidadComprometida) + parseFloat(cantidad);
    
    inventary.save()
  }
}
// Actualizar compromiso
async function updateCompromiso(materiaId, entrega, cotizacionId, productoId){

  // Consultamos compromiso
  if(!productoId){
      const consulta = await cotizacion_compromiso.findOne({
      where: {
        materiaId,
        materiumId: materiaId,
        cotizacionId
      } 
    });
    // Si no hay, enviamos null
    if(!consulta) return null;
    // Avanzamos...
    let cantidadEnCompromiso = consulta.cantidadComprometida;
    let cantidadEnEntregada = consulta.cantidadEntregada;
    let totalEntrega = Number(cantidadEnEntregada) + parseFloat(entrega);
    let estadoData = totalEntrega >= cantidadEnCompromiso ? 'completo' : 'parcial';
    // Procedemos a crear el compromiso
    let actualizarCompromiso = await cotizacion_compromiso.update({
      cantidadEntregada: totalEntrega,
      estado: estadoData,
    }, {
      where: {
        materiumId:materiaId,
        materiaId,
        cotizacionId
      }
    })
 
    return actualizarCompromiso;

  }else{
      console.log('Analizando si llega')
      console.log(productoId)
      console.log(entrega)

      const consulta = await cotizacion_compromiso.findOne({
      where: {
        productoId: productoId,
        cotizacionId
      }
    });
    // Si no hay, enviamos null
    if(!consulta) return null;
    // Avanzamos...
    let cantidadEnCompromiso = consulta.cantidadComprometida;
    let cantidadEnEntregada = consulta.cantidadEntregada;
    let totalEntrega = Number(cantidadEnEntregada) + parseFloat(entrega);
    let estadoData = totalEntrega >= cantidadEnCompromiso ? 'completo' : 'parcial';
    // Procedemos a crear el compromiso
    let actualizarCompromiso = await cotizacion_compromiso.update({
      cantidadEntregada: totalEntrega,
      estado: estadoData,
    }, {
      where: {
        productoId:productoId,
        cotizacionId
      } 
    })

    return actualizarCompromiso;
  }
}


 
async function ajustarStockProducto(productoId, ubicacionId, cantidad, cotizacionId) {
  if (!productoId) return;

  // Buscar o crear inventario (una sola vez)
  let inventary = await inventario.findOne({ where: { productoId: productoId, ubicacionId } });
  if (!inventary) {
    inventary = await inventario.create({ productoId: productoId, ubicacionId, cantidad: 0, cantidadComprometida: 0 });
  }

  // Actualizas la cantidad física (misma lógica que tenías)
  inventary.cantidad = parseFloat(inventary.cantidad) + parseFloat(cantidad);


  // Si hay cotizacion, actualizas compromiso (misma lógica: suma)
  if (cotizacionId) {
    try {
    console.log('que valor entra',cantidad)
    console.log('cantidad comprometida: ', inventary.cantidadComprometida)
    // La variable siempre se mantiene como Number
    inventary.cantidadComprometida = parseFloat(inventary.cantidadComprometida) + parseFloat(cantidad);    
    } catch (error) {
      console.error('Error al ajustar cantidad comprometida:', error);
    }
    // Usamos la misma instancia inventary ya obtenida/creada arriba

    // Llamada a updateCompromiso: paso productoId como 4º parámetro (igual que antes,
    // esto asegura que updateCompromiso use la rama de producto).
    await updateCompromiso(null, cantidad, cotizacionId, productoId);

  }

  await inventary.save();
}

 

 
async function ajustarStock(materiaId, ubicacionId, cantidad, cotizacionId, productoId) {
    if(!productoId){
      let inventary = await inventario.findOne({ where: { materiumId: materiaId, ubicacionId } });

      if (!inventary) {
          inventary = await inventario.create({ materiumId: materiaId, materiaId, ubicacionId, cantidad: 0, cantidadComprometida: 0 });
      }
      inventary.cantidad = parseFloat(inventary.cantidad) + parseFloat(cantidad);
      await inventary.save();

    }else{

      let inventary = await inventario.findOne({ where: { productoId: productoId, ubicacionId } });
      if (!inventary) {
          inventary = await inventario.create({ productoId: productoId, ubicacionId, cantidad: 0, cantidadComprometida: 0 });
      }
      inventary.cantidad = parseFloat(inventary.cantidad) + parseFloat(cantidad);
      console.log(inventary.cantidad)

      await inventary.save();

    }

    if(cotizacionId){
      if(!productoId){
        let inventary = await inventario.findOne({ where: { materiumId: materiaId, ubicacionId } });

        inventary.cantidadComprometida = parseFloat(inventary.cantidadComprometida) - parseFloat(cantidad);
        await updateCompromiso(materiaId, cantidad, cotizacionId)

        await inventary.save();

      }else{
        let inventary = await inventario.findOne({ where: { productoId: productoId, ubicacionId } });

        inventary.cantidadComprometida = parseFloat(inventary.cantidadComprometida) + parseFloat(cantidad);
        await updateCompromiso(materiaId, cantidad, cotizacionId)

        await inventary.save();
      }
    }

}
 

async function comprometerStock(materiaId, ubicacionId, cantidad, productoId) {
  if(!productoId){
    let inv = await inventario.findOne({ where: { materiumId: materiaId, ubicacionId } });
    if (!inv) {
      inv = await inventario.create({ materiaId, ubicacionId, cantidad: 0, cantidadComprometida: 0 });
    }
    inv.cantidadComprometida = parseFloat(cantidad);
    await inv.save();
    return inv;
  }else{
    let inv = await inventario.findOne({ where: { productoId: productoId, ubicacionId } });
    if (!inv) {
      inv = await inventario.create({ productoId, ubicacionId, cantidad: 0, cantidadComprometida: 0 });
    }
    inv.cantidadComprometida = parseFloat(cantidad);
    await inv.save();
    return inv;
  }
  
}

// Actualizar compromiso
async function updateCompromisoEntregado(datos) {
  const { materiumId, cotizacionId, cantidad, productoId } = datos;

  console.log('datooods', materiumId, cotizacionId, cantidad, productoId)
  
  try{
  if(!productoId){
      console.log('empiece a consultar')
      let inv = await cotizacion_compromiso.findOne({ where: { materiaId:materiumId, cotizacionId } }).catch(err => {
        console.log(err)
      })
      console.log('resultado, ', inv)
      if (!inv) {
        console.log('No hemos encontrado esto')
        return null;
      }
      console.log('inv', inv)
      
      let valor = Number(inv.cantidadEntregada) + parseFloat(cantidad);
      console.log('recibida', cantidad)
      console.log('valor a dar', valor)
      inv.cantidadEntregada = valor;
      if(valor >= inv.cantidadComprometida){
        inv.estado = 'completo';
      }else if(valor <= 0){
        inv.estado = 'reservado';
      }else{
        inv.estado = 'parcial';
      }
    
      await inv.save();
      return inv;
    }else{
      let inv = await inventario.findOne({ where: { productoId: productoId, ubicacionId } });
      if (!inv) {
        inv = await inventario.create({ productoId, ubicacionId, cantidad: 0, cantidadComprometida: 0 });
      }
      inv.cantidadComprometida = parseFloat(cantidad);
      await inv.save();
      return inv;
    }
  }catch(err){
    console.log('No encontrado')
    return null;
  }
  
}

async function liberarCompromiso(materiaId, ubicacionId, cantidad) {
  let inv = await inventario.findOne({ where: { materiumId: materiaId, ubicacionId } });
  if (inv) {
    inv.cantidadComprometida = Math.max(0, parseFloat(inv.cantidadComprometida) - parseFloat(cantidad));
    await inv.save();
  }
  return inv; 
}

async function createCompromiso(materiaId, cantidadComprometida, cotizacionId, productoId){
  let numero = cantidadComprometida;
  console.log(numero)
  // Procedemos a crear el compromiso
  let createCompromiso = await cotizacion_compromiso.create({
    cantidadComprometida: numero,
    cantidadEntrega: 0,
    estado: 'reservado',
    materiaId: !productoId ? materiaId : null,
    materiumId: !productoId ? materiaId : null,
    productoId: productoId,
    cotizacionId,
    ubicacionId: 3
  })  

  return createCompromiso;
}


// Obtener un producto por bodega (versión robusta: detecta columnas reales en movimientoInventario)
async function getItemOverviewByBodega({ materiumId = null, productoId = null, ubicacionId, limitSample = 50 }) {
  if (!materiumId && !productoId) throw new Error('Debe indicar materiumId o productoId.');
  if (!ubicacionId) throw new Error('Debe indicar ubicacionId (bodega).');

  const campoFiltro = materiumId ? 'materiumId' : 'productoId';
  const idFiltro = materiumId ? materiumId : productoId;
  const tipo = materiumId ? 'materia' : 'producto';

  // 1) Obtener el item (producto o materia)
  let rawItem = null;
  if (materiumId) {
    rawItem = await materia.findByPk(materiumId, {
      attributes: ['id', 'item', 'description', 'medida', 'unidad'],
      raw: true
    });
  } else {
    rawItem = await producto.findByPk(productoId, {
      attributes: ['id', 'item', 'description', 'medida', 'unidad'],
      raw: true
    });
  }
  if (!rawItem) throw new Error(`${tipo} con id ${idFiltro} no encontrado.`);

  const itemData = {
    id: rawItem.id,
    item: rawItem.item || null,
    description: rawItem.description || null,
    medida: rawItem.medida || null,
    unidad: rawItem.unidad || null,
    sku: rawItem.sku || null
  };

  // 2) Registros en la bodega
  const registrosBodega = await inventarioItemFisico.findAll({
    where: {
      [campoFiltro]: idFiltro,
      ubicacionId,
      cantidadDisponible: { [Op.gt]: 0 }
    },
    attributes: [
      'id', campoFiltro, 'ubicacionId',
      'longitudInicial', 'cantidadDisponible',
      'esRemanente', 'state', 'comprasCotizacionId', 'createdAt'
    ],
    order: [['cantidadDisponible', 'DESC'], ['createdAt', 'ASC']],
    limit: limitSample,
    raw: true
  });

  // 3) Resumen de la bodega
  const resumenBodegaRaw = await inventarioItemFisico.findOne({
    attributes: [
      [sequelize.literal(`COALESCE(SUM(CASE WHEN "esRemanente" = false THEN 1 ELSE 0 END),0)`), 'completeCount'],
      [sequelize.literal(`COALESCE(SUM(CASE WHEN "esRemanente" = true THEN 1 ELSE 0 END),0)`), 'remnantCount'],
      [sequelize.literal(`COALESCE(SUM("cantidadDisponible"), 0)`), 'totalMeters'],
      [sequelize.literal(`COALESCE(COUNT("id"), 0)`), 'itemsCount']
    ],
    where: {
      [campoFiltro]: idFiltro,
      ubicacionId,
      cantidadDisponible: { [Op.gt]: 0 }
    },
    raw: true
  }) || {};

  const resumenBodega = {
    ubicacionId,
    completeCount: parseInt(resumenBodegaRaw.completeCount || 0, 10),
    remnantCount: parseInt(resumenBodegaRaw.remnantCount || 0, 10),
    totalMeters: parseFloat(resumenBodegaRaw.totalMeters || 0),
    itemsCount: parseInt(resumenBodegaRaw.itemsCount || 0, 10)
  };

  // 4) Otras bodegas que tengan el mismo item
  const otrasBodegasRaw = await inventarioItemFisico.findAll({
    attributes: [
      ['ubicacionId', 'ubicacionId'],
      [sequelize.literal(`COALESCE(SUM(CASE WHEN "esRemanente" = false AND "cantidadDisponible" > 0 THEN 1 ELSE 0 END),0)`), 'completeCount'],
      [sequelize.literal(`COALESCE(SUM(CASE WHEN "esRemanente" = true AND "cantidadDisponible" > 0 THEN 1 ELSE 0 END),0)`), 'remnantCount'],
      [sequelize.literal(`COALESCE(SUM("cantidadDisponible"), 0)`), 'totalMeters'],
      [sequelize.literal(`COALESCE(COUNT("id"),0)`), 'itemsCount']
    ],
    where: {
      [campoFiltro]: idFiltro,
      ubicacionId: { [Op.ne]: ubicacionId },
      cantidadDisponible: { [Op.gt]: 0 }
    },
    group: ['ubicacionId'],
    order: [[sequelize.literal(`COALESCE(SUM("cantidadDisponible"), 0)`), 'DESC']],
    raw: true
  });

  const otrasBodegas = await Promise.all(otrasBodegasRaw.map(async (r) => {
    const ub = await ubicacion.findByPk(r.ubicacionId, { raw: true });
    return {
      ubicacionId: r.ubicacionId,
      ubicacionNombre: ub?.nombre || ub?.titulo || null,
      completeCount: parseInt(r.completeCount || 0, 10),
      remnantCount: parseInt(r.remnantCount || 0, 10),
      totalMeters: parseFloat(r.totalMeters || 0),
      itemsCount: parseInt(r.itemsCount || 0, 10)
    };
  }));

  // 5) Compromisos
  const compromisos = await cotizacion_compromiso.findAll({
    where: { [campoFiltro]: idFiltro },
    attributes: ['id','cotizacionId','cantidadComprometida','createdAt'],
    raw: true
  });

  // === Preparación dinámica: detectar columnas de cantidad en movimientoInventario ===
  const qi = sequelize.getQueryInterface();
  const movimientoTableName = (movimientoInventario.getTableName && movimientoInventario.getTableName()) || movimientoInventario.tableName || 'movimiento_inventario';
  let existingCantidadCols = [];
  try {
    const desc = await qi.describeTable(movimientoTableName);
    const possibleCols = [
      'cantidadAfectada', 'cantidad', 'cantidad_afectada',
      'cantidadSalida', 'cantidad_salida', 'qty', 'cantidad_salida_total', 'cantidad_entregada'
    ];
    existingCantidadCols = possibleCols.filter(cn => Object.prototype.hasOwnProperty.call(desc, cn));
  } catch (e) {
    // si falla, dejamos arreglo vacío y tratamos como "no hay columnas"
    existingCantidadCols = []; 
  }

  // Preparamos la expresión literal segura (o '0' si no hay columnas)
  const deliveredLiteral = (existingCantidadCols.length > 0)
    ? `COALESCE(SUM(COALESCE(${existingCantidadCols.map(c => `"${c}"`).join(',')},0)),0)`
    : '0';

  // 6) Calcular entregado por compromiso — usando la expresión dinámica
  const compromisosWithDelivered = await Promise.all(compromisos.map(async (c) => {
    let delivered = 0;
    if (deliveredLiteral === '0') {
      delivered = 0;
    } else {
      const deliveredRaw = await movimientoInventario.findOne({
        attributes: [[sequelize.literal(deliveredLiteral), 'delivered']],
        where: {
          cotizacionId: c.cotizacionId,
          tipoMovimiento: 'SALIDA'
        },
        raw: true
      });
      delivered = parseFloat(deliveredRaw?.delivered || 0);
    }
    const comprometida = parseFloat(c.cantidadComprometida || 0);
    return {
      ...c,
      cantidad_entregada: delivered,
      cantidad_pendiente: Math.max(0, comprometida - delivered)
    };
  }));

  // 7) Respuesta final
  return {
    success: true,
    itemType: tipo,
    item: itemData,
    resumenBodega,
    registrosBodega,
    otrasBodegas,
    compromisos: compromisosWithDelivered
  };
}





// Obtener todos los items por bodega

async function listarItemsEnInventarioOptimizado({
  ubicacionId = null,     // filtrar por bodega (opcional)
  tipo = null,            // 'MP' (materia) | 'PR' (producto) | null (ambos)
  page = 1,
  limit = 50,
  minCantidadDisponible = 0.000001, // filtrar registros con cantidadDisponible > este valor
  orderBy = 'totalMeters', // 'totalMeters' | 'records' | 'fullPiecesMeters' | 'remnantMeters'
  orderDir = 'DESC' // 'ASC'|'DESC'
} = {}) {
  const offset = (Math.max(1, page) - 1) * limit;

  // WHERE dinámico aplicable a la agregación (solo para registros con cantidad > min)
  const whereParts = [`"cantidadDisponible" > ${minCantidadDisponible}`];
  if (ubicacionId) whereParts.push(`"ubicacionId" = ${Number(ubicacionId)}`);

  if (tipo === 'MP') {
    whereParts.push(`"materiumId" IS NOT NULL`);
  } else if (tipo === 'PR') {
    whereParts.push(`"productoId" IS NOT NULL`);
  }

  const whereSQL = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

  // Build order expression safely (no alias issues)
  const orderExpr = (() => {
    switch ((orderBy || '').toLowerCase()) {
      case 'records': return `"records" ${orderDir}`;
      case 'fullpiecesmeters': return `"fullPiecesMeters" ${orderDir}`;
      case 'remnantmeters': return `"remnantMeters" ${orderDir}`;
      default: return `"totalMeters" ${orderDir}`; // default totalMeters
    }
  })();

  // Helper para normalizar keys numéricas de filas resultantes
  const num = v => (v === undefined || v === null) ? 0 : Number(v);

  // -------------------------------------------------------
  // 1) CASO A: si no se solicita 'tipo' (null) -> comportamiento original (SQL con LIMIT/OFFSET)
  // -------------------------------------------------------
  if (!tipo) {
    const aggregationSQL = `
      SELECT
        COALESCE("materiumId", "productoId") AS "itemId",
        CASE WHEN "materiumId" IS NOT NULL THEN 'MP' ELSE 'PR' END AS "itemType",
        COUNT("id") AS "records",
        COALESCE(SUM("cantidadDisponible"), 0) AS "totalMeters",
        COALESCE(SUM(CASE WHEN "esRemanente" = false THEN 1 ELSE 0 END), 0) AS "fullPiecesCount",
        COALESCE(SUM(CASE WHEN "esRemanente" = true THEN 1 ELSE 0 END), 0) AS "remnantCount",
        COALESCE(SUM(CASE WHEN "esRemanente" = false THEN "cantidadDisponible" ELSE 0 END), 0) AS "fullPiecesMeters",
        COALESCE(SUM(CASE WHEN "esRemanente" = true THEN "cantidadDisponible" ELSE 0 END), 0) AS "remnantMeters"
      FROM "inventarioItemFisicos"
      ${whereSQL}
      GROUP BY COALESCE("materiumId", "productoId"), CASE WHEN "materiumId" IS NOT NULL THEN 'MP' ELSE 'PR' END
      ORDER BY ${orderExpr}
      LIMIT ${Number(limit)} OFFSET ${Number(offset)};
    `;
    const aggregates = await sequelize.query(aggregationSQL, { type: sequelize.QueryTypes.SELECT });

    // Fast return if no rows
    if (!aggregates || aggregates.length === 0) {
      return {
        success: true,
        page,
        limit,
        groupsCount: 0,
        items: []
      };
    }

    // collect ids to fetch metadata in batch
    const mpIds = [];
    const prIds = [];
    for (const r of aggregates) {
      const itemId = r.itemId ?? r.itemid;
      const itemType = (r.itemType || r.itemtype || '').toUpperCase();
      if (itemType === 'MP') mpIds.push(Number(itemId));
      else prIds.push(Number(itemId));
    }

    // fetch metadata
    const mpMap = {};
    if (mpIds.length) {
      const mps = await materia.findAll({ where: { id: mpIds }, attributes: ['id','item','description','medida','unidad'], raw: true });
      for (const m of mps) mpMap[String(m.id)] = m;
    }
    const prMap = {};
    if (prIds.length) {
      const prs = await producto.findAll({ where: { id: prIds }, attributes: ['id','item','description','medida','unidad'], raw: true });
      for (const p of prs) prMap[String(p.id)] = p;
    }

    // map results
    const items = aggregates.map(r => {
      const itemId = r.itemId ?? r.itemid;
      const itemType = (r.itemType || r.itemtype || '').toUpperCase();
      return {
        itemId: Number(itemId),
        itemType,
        itemData: itemType === 'MP' ? (mpMap[String(itemId)] || null) : (prMap[String(itemId)] || null),
        records: num(r.records),
        totalMeters: num(r.totalMeters ?? r.totalmeters),
        fullPiecesCount: num(r.fullPiecesCount ?? r.fullpiecescount),
        remnantCount: num(r.remnantCount ?? r.remnantcount),
        fullPiecesMeters: num(r.fullPiecesMeters ?? r.fullpiecesmeters),
        remnantMeters: num(r.remnantMeters ?? r.remnantmeters)
      };
    });

    // count total groups for pagination (distinct items matching where)
    const countSQL = `
      SELECT COUNT(DISTINCT COALESCE("materiumId", "productoId")) AS "groupsCount"
      FROM "inventarioItemFisicos"
      ${whereSQL};
    `;
    const countRes = await sequelize.query(countSQL, { type: sequelize.QueryTypes.SELECT });
    const groupsCount = Number(countRes?.[0]?.groupsCount ?? 0);

    return {
      success: true,
      page,
      limit,
      groupsCount,
      items
    };
  }

  // -------------------------------------------------------
  // 2) CASO B: si se solicita 'tipo' -> queremos TIPOS + incluir items sin stock dentro de 'items'
  // -------------------------------------------------------

  // 2.1) obtener todos los agregados PARA ESE TIPO (sin LIMIT/OFFSET)
  const aggregationAllSQL = `
    SELECT
      COALESCE("materiumId", "productoId") AS "itemId",
      CASE WHEN "materiumId" IS NOT NULL THEN 'MP' ELSE 'PR' END AS "itemType",
      COUNT("id") AS "records",
      COALESCE(SUM("cantidadDisponible"), 0) AS "totalMeters",
      COALESCE(SUM(CASE WHEN "esRemanente" = false THEN 1 ELSE 0 END), 0) AS "fullPiecesCount",
      COALESCE(SUM(CASE WHEN "esRemanente" = true THEN 1 ELSE 0 END), 0) AS "remnantCount",
      COALESCE(SUM(CASE WHEN "esRemanente" = false THEN "cantidadDisponible" ELSE 0 END), 0) AS "fullPiecesMeters",
      COALESCE(SUM(CASE WHEN "esRemanente" = true THEN "cantidadDisponible" ELSE 0 END), 0) AS "remnantMeters"
    FROM "inventarioItemFisicos"
    ${whereSQL}
    GROUP BY COALESCE("materiumId", "productoId"), CASE WHEN "materiumId" IS NOT NULL THEN 'MP' ELSE 'PR' END
    ORDER BY ${orderExpr};
  `;

  const aggregatesAll = await sequelize.query(aggregationAllSQL, { type: sequelize.QueryTypes.SELECT });

  // build maps for quick lookup and collect itemIds present
  const presentIdsSet = new Set();
  const mpIdsPresent = [];
  const prIdsPresent = [];
  for (const r of aggregatesAll) {
    const itemId = String(r.itemId ?? r.itemid);
    const itemType = (r.itemType || r.itemtype || '').toUpperCase();
    presentIdsSet.add(`${itemType}::${itemId}`);
    if (itemType === 'MP') mpIdsPresent.push(Number(itemId));
    else prIdsPresent.push(Number(itemId));
  }

  // 2.2) fetch metadata for present ones (batch)
  const mpMap = {};
  const prMap = {};
  if (mpIdsPresent.length) {
    const mps = await materia.findAll({ where: { id: mpIdsPresent }, attributes: ['id','item','description','medida','unidad'], raw: true });
    for (const m of mps) mpMap[String(m.id)] = m;
  }
  if (prIdsPresent.length) {
    const prs = await producto.findAll({ where: { id: prIdsPresent }, attributes: ['id','item','description','medida','unidad'], raw: true });
    for (const p of prs) prMap[String(p.id)] = p;
  }

  // 2.3) build items array from aggregates (these are those WITH stock)
  const itemsWithStock = aggregatesAll.map(r => {
    const itemId = Number(r.itemId ?? r.itemid);
    const itemType = (r.itemType || r.itemtype || '').toUpperCase();
    return {
      itemId,
      itemType,
      itemData: itemType === 'MP' ? (mpMap[String(itemId)] || null) : (prMap[String(itemId)] || null),
      records: num(r.records),
      totalMeters: num(r.totalMeters ?? r.totalmeters),
      fullPiecesCount: num(r.fullPiecesCount ?? r.fullpiecescount),
      remnantCount: num(r.remnantCount ?? r.remnantcount),
      fullPiecesMeters: num(r.fullPiecesMeters ?? r.fullpiecesmeters),
      remnantMeters: num(r.remnantMeters ?? r.remnantmeters)
    };
  });

  // 2.4) fetch ALL masters for the requested type (to find those WITHOUT stock)
  let masters = [];
  if (tipo === 'MP') {
    masters = await materia.findAll({ attributes: ['id','item','description','medida','unidad'], raw: true });
  } else { // 'PR'
    masters = await producto.findAll({ attributes: ['id','item','description','medida','unidad'], raw: true });
  }

  // 2.5) build zero-stock items for masters not present in aggregatesAll
  const zeros = [];
  for (const m of masters) {
    const key = `${tipo}::${String(m.id)}`;
    if (!presentIdsSet.has(key)) {
      zeros.push({
        itemId: Number(m.id),
        itemType: tipo,
        itemData: m,
        records: 0,
        totalMeters: 0,
        fullPiecesCount: 0,
        remnantCount: 0,
        fullPiecesMeters: 0,
        remnantMeters: 0
      });
    }
  }

  // 2.6) combine itemsWithStock + zeros into single array, sort, paginate
  const combined = itemsWithStock.concat(zeros);

  // sort by orderBy key (fallback to numeric 0)
  const sortKey = (orderBy || 'totalMeters').toString();
  combined.sort((a, b) => {
    const va = Number(a[sortKey] ?? 0);
    const vb = Number(b[sortKey] ?? 0);
    return (orderDir && orderDir.toUpperCase() === 'ASC') ? va - vb : vb - va;
  });

  const groupsCount = combined.length;
  const pagedItems = combined.slice(offset, offset + limit);

  // 2.7) return page
  return {
    success: true,
    page,
    limit,
    groupsCount,
    items: pagedItems
  };
}




module.exports = {
    getBodegaData, // Contamos elementos de una bodega
    registrarMovimiento, // Registrar movimientos y anexa materia prima
    registrarMovimientoMPONE, // Registrar materia prima en estado básico.
    registrarMovimientoPTONE, // Registrar producto comercializable en estado básico
    comprometerStock, // Comprometer stock de materia prima CUANDO la cotización se aprueba.
    createCompromiso, // Cremos un compromiso por cada uno de los elementos.
    updateCompromiso, // Actualizamos el compromiso que se entrega

    // NUEVO ALMACÉN
    registrarMovimientoAlmacen, // Registrando movimientos en almacén
    sacarDelInventario, // Sacar del inventario
    trasladarPorCantidadAtomic, // TRASFERIR
    seleccionarYTrasladarParaProyecto, // TRANSFERIR COMPLETO - PEDAZO DE UNA SOLA NO VARIAS

    // OBTENEMOS MATERIA O PRODUCTO E INVENTARIO
    getItemOverviewByBodega, // OBTENER
    listarItemsEnInventarioOptimizado, // OBTENER TODOS LOS PRODUCTOS POR ID
    updateCompromisoEntregado, // actualizar compromiso entregado
    getItemsConMenosStock, // VER MENOS STOCK
    getItemsConMasMovimiento, // Obtener item con más movimiento
    consolidarKit, // Consolidar kit por almacen


    sacaMateriasConsolidadoTransactional,
}