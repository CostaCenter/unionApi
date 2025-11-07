const express = require('express');
const { materia, proveedor, price, linea, categoria, comprasCotizacion, comprasCotizacionItem, db } = require('../db/db');
const { Op } = require('sequelize');
const { searchPrice, addPriceMt, updatePriceState,  } = require('./services/priceServices');

// Controladores para Materia de prima

const buscarPorQuery = async (req, res) => {
    try {
      const { q } = req.query; // ejemplo: /buscar?q=mesa
  
        const whereClause = {};
        // 2. Aplicamos la lógica condicional para la búsqueda.
        if (!isNaN(q) && q.trim() !== '') {
            // SI ES UN NÚMERO, busca solo por ID.
            whereClause.id = q;
        } else {
            // SI ES TEXTO, busca solo por nombre.
            whereClause.item = { [Op.iLike]: `%${q}%` };
            whereClause.item = { [Op.iLike]: `%${q}%`  };
        }
      const resultados = await materia.findAll({
        where: whereClause 
      });
  
      res.json(resultados);
  
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Error en la búsqueda' });
    }
}



const parseNumber = (v) => {
  if (v === null || v === undefined) return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[, ]+/g, ''));
  return Number.isNaN(n) ? 0 : n;
};

/**
 * GET /materia/:materiaId/comportamiento
 * o   /materia/comportamiento?materiaId=3
 *
 * Query params:
 *  - startDate YYYY-MM-DD
 *  - endDate   YYYY-MM-DD
 *  - proveedorIds csv (1,2,3)
 *  - groupBy day|week|month (default month)
 *  - allStates=true  (opcional, para depuración: no filtra por estadoPago:'compras')
 */
const getMateriaComportamiento = async (req, res) => {
  try {
    // aceptamos materiaId de params o query
    const materiaId = req.params.materiaId ?? req.query.materiaId;
    const { startDate, endDate, proveedorIds, groupBy = 'month', allStates } = req.query;

    if (!materiaId) {
      return res.status(400).json({ msg: 'materiaId es obligatorio: usa /materia/:materiaId/comportamiento o ?materiaId=ID' });
    }

    const parseIds = (v) => (!v ? null : v.split(',').map(x => (isNaN(Number(x)) ? x.trim() : Number(x))));
    const proveedorIdsArr = parseIds(proveedorIds);

    // where principal para comprasCotizacion (cabecera)
    const whereOrden = {};
    if (!allStates || String(allStates) === 'false') {
      whereOrden.estadoPago = 'compras';
    }

    if (startDate || endDate) {
      whereOrden.createdAt = {};
      if (startDate) whereOrden.createdAt[Op.gte] = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23,59,59,999);
        whereOrden.createdAt[Op.lte] = end;
      }
    }
    if (proveedorIdsArr) whereOrden.proveedorId = { [Op.in]: proveedorIdsArr };

    // include: traemos solo items que pertenezcan a la materia buscada (usando materiaId)
    const itemsIncludeWhere = {
      materiaId: materiaId,
    };

    const ordenes = await comprasCotizacion.findAll({
      where: whereOrden,
      include: [
        {
          model: comprasCotizacionItem,
          where: itemsIncludeWhere,
          required: true,
          attributes: [
            'id',
            'cantidad',
            'precioUnidad',
            'descuento',
            'precio',
            'precioTotal',
            'materiaId',
            'createdAt'
          ],
        },
        {
          model: proveedor,
          attributes: ['id', 'nombre'],
        },
      ],
      order: [['createdAt', 'ASC']],
    });

    // Si no encontró nada, ejecutamos una consulta diagnóstica ligera para ayudar a entender por qué
    if (!ordenes || ordenes.length === 0) {
      // intentamos contar items para esa materia sin aplicar otros filtros (solo para diagnóstico)
      const totalItems = await comprasCotizacionItem.count({ where: { materiaId } }).catch(() => null);

      // intentamos contar ordenes relacionadas (join simple)
      const totalOrdenesRelacionadas = await comprasCotizacionItem.findAll({
        where: { materiumId: materiaId },
        attributes: ['comprasCotizacionId'],
        group: ['comprasCotizacionId'],
        limit: 10,
      }).then(rows => rows.length).catch(() => null);

      return res.status(404).json({
        msg: 'No se encontraron compras para esa materia con los filtros aplicados',
        diagnostico: {
          materiaId, 
          totalItemsEncontrados: totalItems,
          filtrosAplicados: { startDate: startDate || null, endDate: endDate || null, proveedorIds: proveedorIdsArr || null, estadoPagoFiltrado: !allStates || String(allStates) === 'false' ? 'compras' : 'todos' }
        }
      });
    }

    // helper para bucket key
    const bucketKey = (date, by) => {
      const d = new Date(date);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2,'0');
      const dd = String(d.getDate()).padStart(2,'0');

      if (by === 'day') return `${yyyy}-${mm}-${dd}`;
      if (by === 'week') {
        const tmp = new Date(d.valueOf());
        tmp.setHours(0,0,0,0);
        tmp.setDate(tmp.getDate() + 3 - ((tmp.getDay() + 6) % 7));
        const week1 = new Date(tmp.getFullYear(), 0, 4);
        const weekNo = 1 + Math.round(((tmp - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
        return `${tmp.getFullYear()}-W${String(weekNo).padStart(2,'0')}`;
      }
      return `${yyyy}-${mm}`;
    };

    // acumuladores
    const buckets = {}; // { key: { totalCantidad, totalValor, proveedores: {provId: {id, nombre, cantidad, valor}} } }
    const totalsGlobal = { cantidad: 0, valor: 0 };

    for (const orden of ordenes) {
      const ordenDate = orden.createdAt || (orden.comprasCotizacionItems?.[0]?.createdAt) || new Date();
      const proveedorObj = orden.proveedor ? { id: orden.proveedor.id, nombre: orden.proveedor.nombre } : { id: null, nombre: 'Sin proveedor' };

      for (const item of orden.comprasCotizacionItems) {
        // comprobar que la materia del item coincide (por seguridad)
        if (String(item.materiaId) !== String(materiaId)) continue;

        const cantidad = parseNumber(item.cantidad);
        let valorLinea = 0;

        // cálculo del valor: preferir precioTotal; si no existe, (precioUnidad - descuento) * cantidad
        const precioTotalRaw = item.precioTotal ?? item.precio;
        if (precioTotalRaw !== null && precioTotalRaw !== undefined && String(precioTotalRaw).trim() !== '') {
          valorLinea = parseNumber(precioTotalRaw);
        } else {
          const pu = parseNumber(item.precioUnidad);
          const desc = parseNumber(item.descuento);
          const puNet = pu - desc;
          valorLinea = puNet * cantidad;
        }

        const key = bucketKey(ordenDate, groupBy);

        if (!buckets[key]) buckets[key] = { totalCantidad: 0, totalValor: 0, proveedores: {} };

        buckets[key].totalCantidad += cantidad;
        buckets[key].totalValor += valorLinea;

        const provId = proveedorObj.id ?? 'null';
        if (!buckets[key].proveedores[provId]) {
          buckets[key].proveedores[provId] = { id: provId, nombre: proveedorObj.nombre || 'Sin proveedor', cantidad: 0, valor: 0 };
        }
        buckets[key].proveedores[provId].cantidad += cantidad;
        buckets[key].proveedores[provId].valor += valorLinea;

        totalsGlobal.cantidad += cantidad;
        totalsGlobal.valor += valorLinea;
      }
    }

    // ordenar keys
    const sortedKeys = Object.keys(buckets).sort((a,b) => a < b ? -1 : 1);

    // preparar output para frontend
    const labels = [];
    const series = { cantidad: [], valor: [] };

    // construir lista de proveedores aparecidos
    const proveedoresMap = {};
    sortedKeys.forEach(k => {
      Object.values(buckets[k].proveedores).forEach(p => {
        proveedoresMap[p.id] = p.nombre;
      });
    });

    const seriesPorProveedor = {};
    Object.keys(proveedoresMap).forEach(pid => {
      seriesPorProveedor[pid] = { id: pid, nombre: proveedoresMap[pid], cantidad: [], valor: [] };
    });

    for (const key of sortedKeys) {
      labels.push(key);
      series.cantidad.push(Number((buckets[key].totalCantidad).toFixed(6)));
      series.valor.push(Number((buckets[key].totalValor).toFixed(2)));

      Object.keys(seriesPorProveedor).forEach(pid => {
        const provData = buckets[key].proveedores[pid];
        if (provData) {
          seriesPorProveedor[pid].cantidad.push(Number(provData.cantidad.toFixed(6)));
          seriesPorProveedor[pid].valor.push(Number(provData.valor.toFixed(2)));
        } else {
          seriesPorProveedor[pid].cantidad.push(0);
          seriesPorProveedor[pid].valor.push(0);
        }
      });
    }

    const result = {
      materiaId,
      groupBy,
      filters: { startDate: startDate || null, endDate: endDate || null, proveedorIds: proveedorIdsArr || null, estadoPagoFiltrado: !allStates || String(allStates) === 'false' ? 'compras' : 'todos' },
      labels,
      datasets: {
        totals: { cantidad: series.cantidad, valor: series.valor },
        porProveedor: Object.values(seriesPorProveedor),
      },
      totalsGlobal,
      bucketsRaw: buckets,
    };

    return res.status(200).json({ data: result });
  } catch (err) {
    console.error('getMateriaComportamiento error:', err);
    return res.status(500).json({ msg: 'Error al generar comportamiento de materia prima', error: err.message });
  }
};


const getAllPriceMateriaProvider = async (req, res) => {
    try{
        const { materiaId, proveedorId } = req.params
 
        // Validamos la entrada...
        if(!materiaId || !proveedorId) return res.status(400).json({msg: 'Debes ingresar los parámetros'})
        // Caso contrario, avanzamos
        const searchPrices = await price.findAll({
            where: {
                materiumId: materiaId,
                proveedorId
            },
            order:[['createdAt', 'ASC']]
        });

        if(!searchPrices) return res.status(404).json({msg: 'No hemos encontrado esto'});
        // Caso contrario, avanzamos
        res.status(200).json(searchPrices)
    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal'})
    }
}

// Consultar elemento individual
const getItem = async (req, res) => {
    try{
        // Recibimos Id por params
        const { itemId } = req.params;
        // Validamos que el parámetro entre correctamente
        if(!itemId) return res.status(501).json({msg: 'Parámetro invalido'});

        // Caso contrario, avanzamos 
        const searchItem = await materia.findOne({
            where: {
                id:itemId
            },
            include: [{
                model: price,
                where: {
                    state: 'active'
                },
                include: [{
                    model: proveedor,
                    attributes:['id', 'type', 'nit', 'nombre']
                }],
                required:false
            }, {
                model: categoria
            }, {
                model: linea
            }],
            order: [
                // Ordenamos por la fecha de creación del proveedor anidado
                [price, proveedor, 'createdAt', 'DESC']
            ]
        }).catch(err => {
            console.log(err);
            return null;
        });

        // Validamos que el resultado contenga un registro.
        if(!searchItem) return res.status(404).json({msg: 'No hemos encontrado este item'});

        // caso contrario, avanzamos (200). Succesful!
        res.status(200).json(searchItem);
    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal'});
    }
}

// Consultar toda la matería prima
const getAllMateria = async(req, res) => {
    try{
        // Procedemos a buscar todos los elementos de matería prima
        const searchAllMateria = await materia.findAll({
            include: [{
                model: price,
                where: {
                    state: 'active'
                },
                required:false
            }],
            order:[['description', 'ASC']]
        })
        .catch(err => {
            console.log(err);
            return null; 
        });
        // Validamos que existan regsitros.
        if(!searchAllMateria || !searchAllMateria.length) return res.status(404).json({msg: 'No hay registros para mostrar'});
        // Caso contrario, enviamos respuesta
        res.status(200).json(searchAllMateria);
    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal.'});
    }
}
// Agregar al sistema
const addMateria = async(req, res) => {
    try{
        // Recibimos datos por body
        const { item, description, unidad, medida, peso, volumen, procedencia, criticidad, lineaId, categoriumId, calibre } = req.body;

        // Validamos que los datos entren correctamente
        if(!item || !description || !medida || !lineaId || !categoriumId) return res.status(501).json({msg: 'Los parámetros no son validos.'});
        // Caso contrario, avanzamos 

        // Buscamos 
        const searchMateria = await materia.findOne({
            where: { 
                item
            }
        }).catch(err => {
            console.log(err);
            return null;
        });
        // Validamos la respuesta
        if(searchMateria) return res.status(200).json({msg: 'Ya existe un item con este nombre.'});
        // Caso contrario, creamos el item 

        const createItem = await materia.create({
            item,
            description,
            medida, 
            unidad,
            peso, 
            volumen,
            procedencia,
            criticidad,
            lineaId,
            categoriumId,
            calibre
        }).catch(err => {
            console.log(err);
            return null
        }); 
        
        // Validamos la respuesta
        if(!createItem) return res.status(502).json({msg: 'No hemos logrado crer este item, intentalo más tarde'});

        // Caso contrario, enviamos el registro, 201. Succesful!
        res.status(201).json(createItem);
    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal'});
    }
}


// Actualizar item
const updateMateria = async(req, res) => {
    try{
        // Recibimos datos por body
        const { itemId, item, description, medida, unidad, peso, volumen, procedencia, criticidad, lineaId, categoriaId, calibre } = req.body;

        // Validamos que los datos entren correctamente
        if(!itemId) return res.status(501).json({msg: 'Parámetro invalido.'});
        // Caso contrario, avanzamos
 
        // Buscamos 
        const searchMateria = await materia.findByPk(itemId).catch(err => {
            console.log(err);
            return null;
        });
        // Validamos la respuesta
        if(!searchMateria) return res.status(404).json({msg: 'No hemos encontrado este registro.'});
        // Caso contrario, creamos el item

        const updateItem = await materia.update({
            item,
            description,
            medida,
            unidad,
            peso,
            volumen,
            procedencia,
            criticidad,
            lineaId,
            categoriumId: categoriaId,
            calibre
        }, {
            where: {
                id: itemId
            }
        }).catch(err => {
            console.log(err);
            return null
        });
        
        // Validamos la respuesta
        if(!updateItem) return res.status(502).json({msg: 'No hemos logrado actualizar este item, intentalo más tarde'});

        // Caso contrario, enviamos el registro, 201. Succesful!
        res.status(201).json({msg: 'Item actualizado con éxito'});
    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal'});
    }
}

// Clonar mt
const clonarMateriaPrima = async (req, res) => { 
     const transaction = await db.transaction();

    try{ 
        // Recibimos parametro por params
        const { MPID , userId} = req.body;
        if(!MPID) return res.status(501).json({msg: 'Invado el parámetro'})
        // Definimos la transacción

        const MpOriginal = await materia.findByPk(MPID, {
            include: [{
                model: price,
            }]
        }, {
            transaction
        }).catch(err => {
            console.log(err);
            return null; 
        });

        // Validamos la existencia
        if(!MpOriginal) {
            await transaction.rollback();
            return res.status(404).json({msg: 'No hemos encontrado este kit'});
        }
        // Caso contrario, avanzamos...

        const nuevoMateria = await materia.create({
            item: MpOriginal.item,
            description: MpOriginal.description,
            peso: MpOriginal.peso,
            volumen: MpOriginal.volumen,
            procedencia: MpOriginal.procendencia,
            criticidad: MpOriginal.criticidad,
            medida: MpOriginal.medida,
            unidad: MpOriginal.unidad,
            lineaId: MpOriginal.lineaId, 
            categoriumId: MpOriginal.categoriumId,

        }, { transaction }); 

        if(!nuevoMateria) { 
            await transaction.rollback();
            return res.status(502).json({msg: 'No hemos logrado crear esto.'});
        }

        // Listamos la materia
        const precio = MpOriginal.prices.map((pric) => ({
            valor: String(pric.valor),
            iva: pric.iva,
            descuentos: pric.descuentos,
            materiumId: nuevoMateria.id,
            proveedorId: pric.proveedorId,
            state: String(pric.state),
        }));
        // Caso contrario
        // Caso contrario, avanzamos
        if(precio.length > 0){
            await price.bulkCreate(precio,  { transaction })
            .then((res) =>  {
                return true
            })

            await transaction.commit();
            return res.status(201).json({msg: 'Kit clonado con éxito!'});
        }else{

            await transaction.commit();

            return res.status(201).json({msg: 'Kit clonado con éxito (El Kit original no tenia items).'})
        }
       
    }catch(err){
        if (transaction) {
            try {
                 await transaction.rollback();
                 console.error('Rollback de transacción exitoso.');
            } catch (rollbackErr) {
                 console.error('Error haciendo rollback de la transacción:', rollbackErr);
                 // Opcional: reportar este error de rollback si es crítico
            }
        }

        console.error('Error en la funcion clonar producto.', err);

        res.status(500).json({msg: 'Ha ocurrido un error en la principal.'});
    }
}

// Eliminar Kit
const deleteMP = async(req, res) => {
    try{
        const { materiaId, userId } = req.body;

        if(!materiaId) return res.status(501).json({msg: 'El parámetro no es valido.'});
        // Caso contrario, avanzamos

        const materiaAEliminar = await materia.findByPk(materiaId).catch(err => null);
        // Validamos
        if(!materiaAEliminar) return res.status(404).json({msg: 'No hemos encontrado este kit.'});
        
        const sendRemove = await materiaAEliminar.destroy()

        if(!sendRemove) return res.state(502).json({msg: 'No hemos logrado eliminar esto'});
        // Caso contrario, avanzamos
        res.status(200).json({msg: 'Eliminado con éxito'});

    }catch(err){    
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal'});
    }
}

// Agregar un precio según proveedor a MT
const addPriceMateriaPrima = async(req, res) => {
    try{
        // Recibimos datos por body
        const { mtId, pvId, price, iva, descuentos } = req.body;
        // Validamos que entren los parámetros.
        
        // Consultamos precio.
        const consultarPrice = await searchPrice(mtId, pvId).catch(err => null);
        
        // Validamos respuesta
        if(consultarPrice == 404){
            const addPriceMtVar = await addPriceMt(mtId, pvId, price, iva, descuentos)
            .catch(err => {
                console.log(err);
                return null;
            })
            // Si Arroja 404
            if(addPriceMtVar == 501) return res.status(501).json({msg: 'Parámetros no validos'});

            if(addPriceMtVar == 404) return res.status(501).json({msg: 'No hemos encontrado esto.'});

            // Si arroja 501
            if(addPriceMtVar == 502) return res.status(501).json({msg: 'No hemos logrado crear esto.'});
            
            return res.status(201).json(addPriceMtVar);
        }else{
            // Enviamos petición para actualizar precio.
            const updateStatePrice = await updatePriceState(mtId, pvId, 'changed')
            .then(async (result) => {
                // Una vez actualizado el estado del precio. Actualizamos ahora si nuevo precio.
                if(result == 200){
                    const addPriceMtVar = await addPriceMt(mtId, pvId, price, iva, descuentos)
                    .catch(err => {
                        console.log(err);
                        return null;
                    })

                    return addPriceMtVar;
                }else{
                    return result
                }
            })
            .catch(err => null);
            // Validamos resultado. 
            // Si Arroja 404
            if(updateStatePrice == 501) return res.status(501).json({msg: 'Parámetros no validos'});

            if(updateStatePrice == 404) return res.status(501).json({msg: 'No hemos encontrado esto.'});

            // Si arroja 501
            if(updateStatePrice == 502) return res.status(501).json({msg: 'No hemos logrado actualizar esto.'});

            return res.status(201).json(updateStatePrice); 
        }

    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal.'});
    }
}

const updatePricesMP = async (req, res) => {
    // Buscamos productos
    const searchAllPrices = await price.findAll();

    if(!searchAllPrices) return res.status(404).json({msg: 'No hemos encontrado esto.'});

    searchAllPrices.map(async (pr, i) => {
        const valorActual = pr.valor; // Este valor pasará a descuento.
        const valorIva = Number(Number(valorActual) * 0.19).toFixed(0);
        const final = Number(Number(valorActual) + Number(valorIva)).toFixed(0)
        const updatePrices = await price.update({
            iva: valorIva,
            valor: final
        }, {
            where: {
                id: pr.id
            }
        });
        return updatePrices
    })

    // Actualizado con éxito
    res.status(200).json({msg: 'Materia prima actualizada'})
}

const updateToInactivePCMP = async (req, res) => {
    try{
        // Recibimos datos por body
        const { priceId} = req.body;
        // Validamos la entrada
        if(!priceId ) return res.status(400).json({msg: 'Recibimos datos por body'});
        // Avanzamos
        const updateThat = await price.update({
            state: 'changed'
        }, {
            where: {
                id: priceId
            }
        });
        if(!updateThat) return res.status(502).json({msg:'No logrados actualizar esto.'});
        // Caso contrario:
        res.status(201).json({msg: 'Actualizado con éxito'})
    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal.'});
    }
}

module.exports = { 
    buscarPorQuery, // Buscador
    getItem, // Obtener item individual
    getAllMateria, // Obtener todos los registros de la tabla. Sin filtros**
    addMateria, // Agregar matería al sistema. 
    clonarMateriaPrima, // Clonar item  
    deleteMP, // Eliminar MP
    updateMateria, // Actualizar item
    addPriceMateriaPrima, // Agregar precio
    updatePricesMP, // Actualizar MP
    updateToInactivePCMP, // Change state to "Changed"
    getMateriaComportamiento, // Obtener gráfica de materia prima
    getAllPriceMateriaProvider, // Obtenemos todos los precios
}