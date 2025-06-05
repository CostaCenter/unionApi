const express = require('express');
const { producto, productPrice, proveedor, price, linea, categoria } = require('../db/db');
const { Op } = require('sequelize');
const { searchPrice, addPriceMt, updatePriceState, searchProductPrice, updateProductPriceState, addPricePT,  } = require('./services/priceServices');

// Controladores para Producto terminado

const buscarPorQueryProducto = async (req, res) => {
    try { 
      const { q } = req.query; // ejemplo: /buscar?q=mesa
  
      const resultados = await producto.findAll({
        where: {
            [Op.or]: [
                { item: { [Op.iLike]: `%${q}%` } },
                { description: { [Op.iLike]: `%${q}%` } },
            ]
        },
        include:[{
            model: productPrice,
            where: {
                state: 'active'
            }
        },{
            model: linea
        }, {
            model: categoria
        }]
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
        const { item, description, peso, volumen, procedencia, criticidad, lineaId, categoriumId } = req.body;

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


// Actualizar item
const updateProducto = async(req, res) => {
    try{
        // Recibimos datos por body
        const { itemId, item, description, peso, volumen, procedencia, criticidad, lineaId, categoriaId} = req.body;

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
    getAllProducto, // Obtener todos los productos
    getItemProducto, // Obtener item por ID
    addPriceProducto, // Agregamos precio
    buscarPorQueryProducto, // Search by query
}