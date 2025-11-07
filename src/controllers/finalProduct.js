const express = require('express');
const { producto, productPrice, percentage, proveedor, price, linea, categoria, db, literal } = require('../db/db');
const { Op } = require('sequelize');
const { searchPrice, addPriceMt, updatePriceState, searchProductPrice, updateProductPriceState, addPricePT,  } = require('./services/priceServices');
const dayjs = require('dayjs');
const sequelize = producto.sequelize; // <-- Aquí obtienes la instancia
// Controladores para Producto terminado

const buscarPorQueryProducto = async (req, res) => {
    try { 
      const { q, lineaId } = req.query; // ejemplo: /buscar?q=mesa
  
      const whereClause = {
        };
        // 2. Aplicamos la lógica condicional para la búsqueda.
        if (!isNaN(q) && q.trim() !== '') {
            // SI ES UN NÚMERO, busca solo por ID.
            whereClause.id = q;
        } else {
                  // SI ES TEXTO, busca solo por nombre.
            whereClause.item = { [Op.iLike]: `%${q}%` };
        }

        // Si llega un 'lineaId', se añade al filtro
        if (lineaId) {
            whereClause.lineaId = lineaId;

        }

      const resultados = await producto.findAll({
        where: whereClause, 
        include:[{
            model: productPrice,
            where: {
                state: 'active'
            }
        },{
            model: linea,
            include:[{
                model: percentage,
                where: {
                    state: 'active'
                },
                required:false
            
            }]
        }, {
            model: categoria
        }],
      });
  
      res.json(resultados);
  
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Error en la búsqueda' });
    }
}

const getAllPriceProductoTerminadoProvider = async (req, res) => {
    try{
        const { productoId, proveedorId } = req.params
 
        // Validamos la entrada...
        if(!productoId || !proveedorId) return res.status(400).json({msg: 'Debes ingresar los parámetros'})
        // Caso contrario, avanzamos
        const searchPrices = await productPrice.findAll({
            where: {
                productoId: productoId,
                proveedorId
            },
            include:[{
                model: proveedor
            }],
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

// Filtrar y agrupar
const getProduccionPorFecha = async (req, res) => {
    try {
        const { inicio, fin} = req.params;
        // Define el rango de fechas (por defecto, los últimos 6 meses)
        const fechaFin = fin ? dayjs(fin).endOf('day') : dayjs().endOf('day');
        const fechaInicio = inicio ?  dayjs(inicio).startOf('day')  : dayjs(fin).subtract(6, 'month').startOf('day');

        const { categoriaId, lineaId } = req.query;

        // <-- CAMBIO: Se crea un objeto 'where' dinámico
        const whereConditions = {
            createdAt: {
                [Op.between]: [fechaInicio.toDate(), fechaFin.toDate()]
            }
        };
        // Si se proporciona un categoriaId, se añade al filtro
        if (categoriaId) {
            whereConditions.categoriumId = categoriaId;
        }

        // Si se proporciona un lineaId, se añade al filtro
        if (lineaId) {
            whereConditions.lineaId = lineaId;
        }
        const resultados = await producto.findAll({
            // 1. Selecciona y formatea los campos que necesitas
            attributes: [
                // Extrae solo la fecha (YYYY-MM-DD) de la columna 'createdAt'
                [sequelize.fn('DATE', sequelize.col('createdAt')), 'fecha'],
                // Cuenta cuántos productos hay por cada fecha y lo nombra 'cantidad'
                [sequelize.fn('COUNT', sequelize.col('id')), 'cantidad']
            ],
            // 2. Filtra por el rango de fechas
            where: whereConditions,
            // 3. Agrupa los resultados por la fecha extraída
            group: [sequelize.fn('DATE', sequelize.col('createdAt'))],
            // 4. Ordena los resultados cronológicamente
            order: [[sequelize.fn('DATE', sequelize.col('createdAt')), 'ASC']],
            // Opcional: raw:true devuelve objetos JSON planos, ideal para agregaciones
            raw: true
        });

        
        // 5. Convierte las fechas a objetos Date para MUI X Charts
        const datosParaGrafica = resultados

        res.status(200).json(datosParaGrafica);

    } catch (err) {
        console.error("Error al obtener datos de producción:", err);
        res.status(500).json({ msg: 'Error en el servidor.' });
    }
};


// Filtrar 
const getProductosFiltrados = async (req, res) => {
    try {
        // 1. Obtenemos los filtros desde req.query (o req.body si lo prefieres)
        const { fechaInicio, fechaFin, categoriaId, lineaId } = req.query;

        // 2. Construimos el objeto de condiciones 'where' dinámicamente
        const whereConditions = {};

        // --- Filtro por Rango de Fechas ---
        if (fechaInicio && fechaFin) {
            whereConditions.createdAt = {
                [Op.between]: [
                    dayjs(fechaInicio).startOf('day').toDate(),
                    dayjs(fechaFin).endOf('day').toDate()
                ]
            };
        }

        // --- Filtro por Categoría ---
        if (categoriaId) {
            whereConditions.categoriumId = categoriaId;
        }

        // --- Filtro por Línea ---
        if (lineaId) {
            whereConditions.lineaId = lineaId;
        }
         
        // 3. Hacemos la consulta a la base de datos
        const productos = await producto.findAll({
            where: whereConditions,
            // Incluimos los modelos relacionados para tener la información completa
            include: [
                { model: categoria }, // Asume que tienes un alias 'categoria'
                { model: linea }       // Asume que tienes un alias 'linea'
            ],
            order: [['createdAt', 'DESC']] // Ordena los más recientes primero
        });

        if (!productos || productos.length === 0) {
            return res.status(404).json({ msg: 'No se encontraron productos con los filtros aplicados.' });
        }

        res.status(200).json(productos);

    } catch (err) {
        console.error("Error al filtrar productos:", err);
        res.status(500).json({ msg: 'Error en el servidor.' });
    }
};

// Consultar elemento de forma individual
const getItemProducto = async (req, res) => {
    try{
        // Recibimos Id por params
        const { itemId } = req.params;
        // Validamos que el parámetro entre correctamente
        if(!itemId) return res.status(501).json({msg: 'Parámetro invalido'});

        // Caso contrario, avanzamos 
        const searchItem = await producto.findOne({
            where: {
                id:itemId
            },
            include: [{
                model: productPrice,
                where: {
                    state: 'active'
                },
                attributes:['id', 'valor', 'iva', 'descuentos', 'state', 'createdAt'],
                include: [{
                    model: proveedor,
                    attributes:['id', 'type', 'nit', 'nombre']
                }],
                required:false
            }, {
                model: categoria
            }, {
                model: linea
            }]
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

// Consultar toda el producto terminado
const getAllProducto = async(req, res) => {
    try{
        // Procedemos a buscar todos los elementos de Producto terminado
        const searchAllProductos = await producto.findAll({
            include: [{
                model: productPrice,
                where: {
                    state: 'active'
                },
                required:false
            }, {
                model: linea,
            }, {
                model: categoria
            }],
            order:[['description', 'ASC']]
        })
        .catch(err => {
            console.log(err);
            return null; 
        });
        // Validamos que existan regsitros.
        if(!searchAllProductos || !searchAllProductos.length) return res.status(404).json({msg: 'No hay registros para mostrar'});
        // Caso contrario, enviamos respuesta
        res.status(200).json(searchAllProductos);
    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal.'});
    }
}
// Agregar al sistema Producto terminado
const addProductoTerminado = async(req, res) => {
    try{
        // Recibimos datos por body
        const { item, description, medida, unidad, peso, volumen, procedencia, criticidad, lineaId, categoriumId } = req.body;

        // Validamos que los datos entren correctamente
        if(!item || !description || !lineaId || !categoriumId) return res.status(400).json({msg: 'Los parámetros no son validos.'});
        // Caso contrario, avanzamos 

        // Buscamos 
        const searchProductoTerminado = await producto.findOne({
            where: { 
                item
            }
        }).catch(err => {
            console.log(err);
            return null;
        });
        // Validamos la respuesta
        if(searchProductoTerminado) return res.status(200).json({msg: 'Ya existe un item con este nombre.'});
        // Caso contrario, creamos el item 

        const createItem = await producto.create({
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
// Eliminar Cotización
const deleteProducto = async (req, res) =>  {
    try{ 
        // Recbimos datos por body
        const { productoId, userId } = req.body;
        
        // Validamos que entren los parámetros
        if(!productoId || !userId) return res.status(400).json({msg: 'Parámetros no son validos.'});
        // Caso contrario, avanzamos...

        // Procedemos a consultar cotizacion
        const searchProducto = await producto.findByPk(productoId)

        // Validamos la existencia.
        if(!searchProducto) return res.status(404).json({msg: 'No hemos encontrado esto.'});
        // Caso contrario, avanzamos
        const deleteProducto = await producto.destroy({
            where: {
                id: productoId
            }
        })
        // Validamos respuesta
        if(!deleteProducto) return res.status(502).json({msg: 'No hemos logrado eliminar esto.'});
        // Caso contrario, avanzamos
        res.status(200).json({msg: 'Eliminado con éxito'});
        
        
    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal.'});
    }
} 

// Actualizar item
const updateProducto = async(req, res) => {
    try{
        // Recibimos datos por body
        const { itemId, item, description, medida, unidad, peso, volumen, procedencia, criticidad, lineaId, categoriaId} = req.body;

        // Validamos que los datos entren correctamente
        if(!itemId) return res.status(501).json({msg: 'Parámetro invalido.'});
        // Caso contrario, avanzamos
 
        // Buscamos 
        const searchProducto = await producto.findByPk(itemId).catch(err => {
            console.log(err);
            return null;
        });
        // Validamos la respuesta
        if(!searchProducto) return res.status(404).json({msg: 'No hemos encontrado este registro.'});
        // Caso contrario, creamos el item

        const updateItem = await producto.update({
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

// Clonar PRODUCTO
const clonarProducto = async (req, res) => { 
    try{ 
        // Recibimos parametro por params
        const { productoId , userId} = req.params;
        if(!productoId) return res.status(501).json({msg: 'Invado el parámetro'})
        // Definimos la transacción
        const transaction = await db.transaction();

        const productoOriginal = await producto.findByPk(productoId, {
            transaction
        }).catch(err => {
            console.log(err);
            return null; 
        });

        // Validamos la existencia
        if(!productoOriginal) {
            await transaction.rollback();
            return res.status(404).json({msg: 'No hemos encontrado este kit'});
        }
        // Caso contrario, avanzamos...

        const nuevoKit = await producto.create({
            item: productoOriginal.item,
            description: productoOriginal.description,
            peso: productoOriginal.peso,
            volumen: productoOriginal.volumen,
            procedencia: productoOriginal.procendencia,
            criticidad: productoOriginal.criticidad,
            medida: productoOriginal.medida,
            unidad: productoOriginal.unidad,
            lineaId: productoOriginal.lineaId, 
            categoriumId: productoOriginal.categoriumId,

        }, { transaction }); 

        if(!nuevoKit) { 
            await transaction.rollback();
            return res.status(502).json({msg: 'No hemos logrado crear esto.'});
        }

        await transaction.commit();
        return res.status(201).json({msg: 'Kit clonado con éxito!'});
       
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

const updatePricesProductos = async (req, res) => {
    // Buscamos productos
    const searchAllPrices = await productPrice.findAll();

    if(!searchAllPrices) return res.status(404).json({msg: 'No hemos encontrado esto.'});

    searchAllPrices.map(async (pr, i) => {
        const valorActual = pr.descuentos; // Este valor pasará a descuento.
        const valorIva = Number(valorActual) * 0.19
        const final = Number(Number(valorActual) + Number(valorIva)).toFixed(0)
        const updatePrices = await productPrice.update({
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
    res.status(200).json({msg: 'Actualizado'})
}

// Agregar un precio según proveedor a PT
const addPriceProducto = async(req, res) => {
    try{ 
        // Recibimos datos por body
        const { productoId, pvId, price, iva, descuentos } = req.body;
        // Validamos que entren los parámetros.
        if(!productoId) return res.status(400).json({msg: 'Parametros no son validos'})
        // Consultamos precio.
        const consultarPrice = await searchProductPrice(productoId, pvId).catch(err => null);
        // Validamos respuesta
        if(consultarPrice == 404){ 
            const addPriceMtVar = await addPricePT(productoId, pvId, price, iva, descuentos)
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
            const updateStatePrice = await updateProductPriceState(productoId, pvId, 'changed')
            .then(async (result) => {
                // Una vez actualizado el estado del precio. Actualizamos ahora si nuevo precio.
                if(result == 200){
                    const addPriceMtVar = await addPricePT(productoId, pvId, price, iva, descuentos)
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


// Desactivar número
const updateToInactivePCMPPT = async (req, res) => {
    try{
        // Recibimos datos por body
        const { priceId} = req.body;
        // Validamos la entrada
        if(!priceId ) return res.status(400).json({msg: 'Recibimos datos por body'});
        // Avanzamos
        const updateThat = await productPrice.update({
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
    addProductoTerminado, // Agregar producto terminado
    getProduccionPorFecha, // Obtener grupo de productos creados
    getProductosFiltrados, // Filtrar por fecha, categoría y linea
    updateProducto, // Actualiza Producto
    deleteProducto, // Eliminar producto
    clonarProducto, // Clonar producto
    getAllProducto, // Obtener todos los productos
    getItemProducto, // Obtener item por ID
    addPriceProducto, // Agregamos precio
    buscarPorQueryProducto, // Search by query
    updatePricesProductos, // Update prices
    updateToInactivePCMPPT, // Desactivar precio producto
    getAllPriceProductoTerminadoProvider, // Producto terminado actualizacio de precios
}