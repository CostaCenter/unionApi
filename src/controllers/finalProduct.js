const express = require('express');
const { producto, productPrice, percentage, proveedor, price, linea, categoria, db, literal } = require('../db/db');
const { Op } = require('sequelize');
const { searchPrice, addPriceMt, updatePriceState, searchProductPrice, updateProductPriceState, addPricePT,  } = require('./services/priceServices');

// Controladores para Producto terminado

const buscarPorQueryProducto = async (req, res) => {
    try { 
      const { q } = req.query; // ejemplo: /buscar?q=mesa
  
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
 
module.exports = { 
    addProductoTerminado, // Agregar producto terminado
    updateProducto, // Actualiza Producto
    deleteProducto, // Eliminar producto
    clonarProducto, // Clonar producto
    getAllProducto, // Obtener todos los productos
    getItemProducto, // Obtener item por ID
    addPriceProducto, // Agregamos precio
    buscarPorQueryProducto, // Search by query
    updatePricesProductos, // Update prices
}