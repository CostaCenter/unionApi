const express = require('express');
const { client, kit, extension, producto, materia, cotizacion, notaCotizacion, armado, armadoCotizacion, kitCotizacion, productoCotizacion, areaCotizacion, user, db} = require('../db/db');
const { Op } = require('sequelize');
const { createCotizacion, addItemToCotizacionServices, addSuperKitToCotizacionServices, addProductoToCotizacionServices } = require('./services/cotizacionServices');
const { createRequisicion } = require('./services/requsicionService');
const dayjs = require('dayjs');
const multer = require('multer');

const cloudinary = require('cloudinary').v2;
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Buscar cliente para cotizacion
const searchClientQuery = async(req, res) => {
    try {
        const { query } = req.query; // Obtiene el parámetro de búsqueda desde la URL

        if (!query) {
            return res.status(400).json({ message: "Debes proporcionar un término de búsqueda." });
        }

        const clientes = await client.findAll({
            where: {
                [Op.or]: [
                    { nombre: { [Op.iLike]: `%${query}%` } }, // Búsqueda flexible (ignora mayúsculas/minúsculas)
                    { nit: { [Op.iLike]: `%${query}%` } } // Buscar en otro campo
                ]
            },
            attributes: { exclude: ['createdAt', 'updatedAt'] },
            limit: 10, // Máximo 10 resultados para eficiencia
        }).catch((err => {
            console.log(err);
            return null;
        }));

        if(!clientes) return res.status(404).json({msg: 'No encontrado'})

        res.status(200).json(clientes);
    } catch (error) {
        console.error("Error al buscar productos:", error);
        res.status(500).json({ message: "Error interno del servidor" });
    }
}
// Obtener Cotizaciones
const getAllCotizaciones = async(req, res) => {
    try{
        const { userId } = req.params;
        const searchCotizaciones = await cotizacion.findAll({
            where: {
                userId
            },
            include: [ 
                {
                    model: areaCotizacion,
                    include:[{
                        model: kit,
                        include:[{
                            model: materia,
                            attributes: { exclude: ['createdAt', 'updatedAt']}
                        }, {model: extension}], 
                        through: {
                            attributes: ['id', 'cantidad', 'precio', 'descuento', 'areaCotizacionId'] // o los campos que tengas en KitCotizacion
                        }
                    }, { 
                        model: armado
                    }, {
                        model: producto,
                        through: {
                            attributes: ['id', 'cantidad', 'precio', 'descuento', 'areaCotizacionId'] // o los campos que tenga productoCotizacion
                        }
                    }] 
                }, 
                {
                    model: client
            }, { model: notaCotizacion}, {model: user}], 
            order: [
                ['createdAt', 'DESC'], // Orden global por creación de la cotización
                [notaCotizacion, 'createdAt', 'ASC'], // 👈 Orden solo para las notas
                [areaCotizacion, 'createdAt', 'DESC'], // 👈 Orden solo para las notas

            ]
        }).catch(err => {
            console.log(err);
            return null
        });
        // Validamos contenido.
        if(!searchCotizaciones) return res.status(404).json({msg: 'No hay cotizaciones'});
        // Caso contrario
        res.status(200).json(searchCotizaciones);
    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un erro en la principal.'});
    }
}
// Obtener cotización.
const getCotizacion = async(req, res) => {
    try{
        // Recibimos datos por params
        const { cotiId } = req.params;
        // Validamos que el parametro entre
        if(!cotiId) return res.status(501).json({msg: 'El parámetro no es valido'});
    
        // Caso contrario, consultados
        const searchCoti = await cotizacion.findByPk(cotiId, {
            attributes: { exclude: ['updatedAt']},
            include:[ {model: areaCotizacion,
                include:[{ 
                    model: kit,
                    include:[{
                        model: materia
                    },{model: extension}],
                    through: {
                        attributes: ['id', 'cantidad', 'precio', 'descuento', 'areaCotizacionId'] // o los campos que tengas en KitCotizacion
                    }
                }, {
                    model: armado,
                }, {
                    model: producto
                }]
            }, {model: client}, { model: notaCotizacion}, {model: user}],
            order: [
                ['createdAt', 'DESC'], // Orden global por creación de la cotización
                [notaCotizacion, 'createdAt', 'ASC'], // 👈 Orden solo para las notas
                [areaCotizacion, 'createdAt', 'DESC'], // 👈 Orden solo para las notas
            
            ]
        }).catch(err => {
            console.log(err);
            return null;
        })

        if(!searchCoti) return res.status(404).json({msg: 'No hemos encontrado esto'});
        // Caso contrario, enviamos respuesta
        res.status(200).json(searchCoti);

    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal'});
    }
}

// Crear cotización
const newCotizacion = async (req, res) => {
    try{
        
        const { userId, clientId, name, description, time, fechaAprobada, price, descuento, iva, } = req.body;
        
        // Validamos 
        if(!userId || !clientId || !name || !time) return res.status(501).json({msg: 'Los parámetros no son validos.'});
         
        // Procedemos a crear cotización
        const add = await createCotizacion(userId, clientId, name, description, time, fechaAprobada, price, descuento, iva)
        .catch(err => {
            console.log(err);
            return null;
        });

        if(!add) return res.status(502).json({msg: 'No hemos logrado crear esto.'});
        // Caso contrario, devolvemos cotización
        res.status(201).json(add);
    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal.'});
    }
}

// Agregamos items o kit a la cotización
const addItemToCotizacion = async(req, res) => {
    try{
        // Recibimos datos por body.
        const { cotizacionId, kitId, cantidad, areaId, precio, descuento } = req.body;
        // Validamos que los datos entren correctamente
        if(!cotizacionId || !kitId || !cantidad || !precio ) return res.status(501).json({msg: 'Los parámetros no son validos.'});
        // Caso contrario, avanzamos...

        const sendItem = await addItemToCotizacionServices(cotizacionId, kitId, cantidad, precio, descuento)
        .catch(err => {
            console.log(err); 
            return null;
        });
        if(sendItem == 200) return res.status(200).json({msg: 'Ya existe este kit dentro de la cotización.'}); 
        if(!sendItem || sendItem == 502) return res.status(502).json({msg: 'No hemos logrado crear esto.'});
        // Caso contrario, enviamos la creación
        res.status(201).json(sendItem);



    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal.'});
    }
}
// Dar descuento a item en cotización
const giveDescuento = async(req, res) => {
    try{
        // Recibimos datos por body
        const { kitCotizacionId, descuento } = req.body;
        // Validamos que los datos entres
        if(!kitCotizacionId || !descuento) return res.status(400).json({msg: 'Los parámetros no son validos.'});
        // Caso contrario, avanzamos
        // Consultamos que exista este itemCotizacion
        const getKitCotizacion = await kitCotizacion.findByPk(kitCotizacionId);
        // Validamos la respuesta
        if(!getKitCotizacion) return res.status(404).json({msg: 'No hemos encontrado este item en la cotización'});
        // Caso contrario, avannzamos
        // Creamos petición para actualizar
        const updateKitCotizacion = await kitCotizacion.update({
            descuento
        }, {
            where: {
                id: kitCotizacionId
            }
        });
        // Validamos la respuesta
        if(!updateKitCotizacion) return res.status(502).json({msg: 'No hemos logrado actualizar esto.'});
        // Caso contrario, enviamos respuesta 200. ¡Actualizado!
        res.status(200).json({msg: 'Descuento añadido.'});
    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal.'});
    }
}

// Dar descuento a superKit en cotización
const giveDescuentoSuperKitItem = async(req, res) => {
    try{
        // Recibimos datos por body
        const { superKitId, descuento } = req.body;
        // Validamos que los datos entres
        if(!superKitId || !descuento) return res.status(400).json({msg: 'Los parámetros no son validos.'});
        // Caso contrario, avanzamos
        // Consultamos que exista este itemCotizacion
        const getKitCotizacion = await armadoCotizacion.findByPk(superKitId);
        // Validamos la respuesta
        if(!getKitCotizacion) return res.status(404).json({msg: 'No hemos encontrado este item en la cotización'});
        // Caso contrario, avannzamos
        // Creamos petición para actualizar
        const updateKitCotizacion = await armadoCotizacion.update({
            descuento
        }, {
            where: {
                id: superKitId
            }
        });
        // Validamos la respuesta
        if(!updateKitCotizacion) return res.status(502).json({msg: 'No hemos logrado actualizar esto.'});
        // Caso contrario, enviamos respuesta 200. ¡Actualizado!
        res.status(200).json({msg: 'Descuento añadido.'});
    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal.'});
    }
}

// agregar superKit a la cotizacion
const addSuperKit = async(req, res) => {
    try{
        // Recibimos datos por body 
        const { cotizacionId, superKitId, cantidad, precio, descuento } = req.body; // Destructuramos
    
        // Validamos la entrada de parámetros
        if(!cotizacionId || !superKitId || !cantidad || !precio) return res.status(400).json({msg: 'Los parámetros no son validos.'});
        
        // Enviamos petición asincrónica - Consultando una función services. Del Archivo cotizacionServices.js
        // Pasamos la cotización, el superKit, la cantidad, el precio y un descuento si tiene.
        const sendItem = await addSuperKitToCotizacionServices(cotizacionId, superKitId, cantidad, precio, descuento)
        .catch(err => {
            console.log(err);
            return null;
        });
        if(sendItem == 200) return res.status(200).json({msg: 'Ya existe este superKit dentro de la cotización.'}); 
        if(!sendItem || sendItem == 502) return res.status(502).json({msg: 'No hemos logrado crear esto.'});
        // Caso contrario, enviamos la creación
        res.status(201).json(sendItem);
    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal.'});
    }
}

// Agregar producto terminado a la cotización
const addProducto = async(req, res) => {
    try{
        // Recibimos datos por body 
        const { cotizacionId, productoId, cantidad, precio, descuento } = req.body; // Destructuramos
    
        // Validamos la entrada de parámetros
        if(!cotizacionId || !productoId || !cantidad || !precio) return res.status(400).json({msg: 'Los parámetros no son validos.'});
        
        // Enviamos petición asincrónica - Consultando una función services. Del Archivo cotizacionServices.js
        // Pasamos la cotización, el superKit, la cantidad, el precio y un descuento si tiene.
        const sendItem = await addProductoToCotizacionServices(cotizacionId, productoId, cantidad, precio, descuento)
        .catch(err => {
            console.log(err);
            return null;
        });
        if(sendItem == 200) return res.status(200).json({msg: 'Ya existe este superKit dentro de la cotización.'}); 
        if(!sendItem || sendItem == 502) return res.status(502).json({msg: 'No hemos logrado crear esto.'});
        // Caso contrario, enviamos la creación
        res.status(201).json(sendItem);
    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal.'});
    }
}

// Actualizar item de una cotización
const updateItemToCotizacion = async(req, res) => {
    try{
        // Recibimos datos por body
        const { cotizacionId, kitId, cantidad, precio, descuento } = req.body;
        // Validamos la entrada de los datos
        if(!cotizacionId || !kitId) return res.status(501).json({msg: 'Los parámetros no son validos.'});

        const update = await kitCotizacion.update({
            cantidad,
            precio,
            descuento: descuento,
        }, {
            where: {
                kitId,
                areaId: cotizacionId,
            }
        });

        if(!update) return res.status(502).json({msg: 'No hemos logrado actualizar esto.'});
        // Caso contrario
        res.status(200).json({msg: 'Actualizado con éxito'})
    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal.'});
    }
}

// Eliminar item de una cotización
const deleteKitOnCotizacion = async (req, res) => {
    try{
        // Recibimos datos por body
        const { cotizacionId, kitId } = req.body;
        if(!cotizacionId || !kitId) return res.status(501).json({msg: 'Los parámetros no son validos.'});
        // Caso contrario, avanzamos...

        const searchKit = await kit.findByPk(kitId).catch(err => null);
        const searchCotizacion = await areaCotizacion.findByPk(cotizacionId).catch(err => null)
        if(!searchKit || !searchCotizacion) return res.status(404).json({msg: 'No hemos encontrado esto.'});
        
        // Caso contrario, eliminamos.

        const deletee = await searchKit.removeAreaCotizacion(searchCotizacion).catch(err => {
            console.log(err)
        });
        if(!deletee) return res.status(502).json({msg: 'No hemos logrado eliminar esto'});

        res.status(200).json({msg: 'Eliminado con éxito'})
    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal.'});
    }
}

// Eliminar item de una cotización
const deleteSuperKitOnCotizacion = async (req, res) => {
    try{
        // Recibimos datos por body
        const { cotizacionId, superKidId } = req.body;
        if(!cotizacionId || !superKidId) return res.status(501).json({msg: 'Los parámetros no son validos.'});
        // Caso contrario, avanzamos...

        const searchKit = await armado.findByPk(superKidId).catch(err => null);
        const searchCotizacion = await areaCotizacion.findByPk(cotizacionId).catch(err => null)
        if(!searchKit || !searchCotizacion) return res.status(404).json({msg: 'No hemos encontrado esto.'});
        
        // Caso contrario, eliminamos.

        const deletee = await searchKit.removeAreaCotizacion(searchCotizacion).catch(err => null);
        if(!deletee) return res.status(502).json({msg: 'No hemos logrado eliminar esto'});

        res.status(200).json({msg: 'Eliminado con éxito'})
    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal.'});
    }
}

// Aprobadar cotizaciónn
const acceptCotizacion = async (req, res) => {
    try{
        // Recibimos la cotización por params
        const { cotiId } = req.params;
        // Validamos
        if(!cotiId) return res.status(501).json({msg: 'El parámetro no es valido.'});
        // Caso contrario, avanzamos

        const searchCoti = await cotizacion.findByPk(cotiId).catch(err => null);
        // Validamos
        if(!searchCoti) return res.status(404).json({msg: 'No hemos encontrado esta cotización'});
        
        // Caso contrario, avanzamos
        const updateCoti = await cotizacion.update({
            state: 'aprobada'
        }, {
            where: {
                id: cotiId
            }
        })
        .then(async (res) => {
            // Obtenemos la hora actual
            const fechaActual = dayjs().format('YYYY-MM-DD');
            const fechaMaxima = dayjs().add(3, 'day').format('YYYY-MM-DD');
            // Creamos la requisición
            const newRequsicion = await createRequisicion(searchCoti.name, fechaActual, fechaMaxima, cotiId);

            return newRequsicion;
        })
        .catch(err => {
            console.log(err);
            return null;
        });
        console.log(updateCoti);
        if(updateCoti == 501) return res.status(501).json({msg: 'Parametros no son validos.'});
        if(updateCoti == 502) return res.status(502).json({msg: 'No hemos logrado generar requsición'})
        res.status(201).json({msg: 'Requisición enviada'})

    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal'});
    }
} 

// Dividir cotización por áreas
const addAreaToCotizacion = async (req, res) =>  {
    try{ 
        // Recbimos datos por body
        const { cotizacionId, name, description, userId } = req.body;
        // Validamos que entren los parámetros
        if(!cotizacionId || !name || !userId) return res.status(400).json({msg: 'Parámetros no son validos.'});
        // Caso contrario, avanzamos...

        // Procedemos a consultar cotizacion
        const searchCoti = await cotizacion.findByPk(cotizacionId, {
            where: {
                state: 'desarrollo'
            }
        })

        // Validamos la existencia.
        if(!searchCoti) return res.status(404).json({msg: 'No hemos encontrado esto.'});
        // Caso contrario, avanzamos
        const addArea = await areaCotizacion.create({
            name,
            description,
            state: true,
            cotizacionId
        })
        // Validamos respuesta
        if(!addArea) return res.status(502).json({msg: 'No hemos logrado crear esto.'});
        // Caso contrario, avanzamos
        res.status(200).json(addArea);
        
        
    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal.'});
    }
}
// Editar
const editAreaToCotizacion = async (req, res) =>  {
    try{ 
        // Recbimos datos por body
        const { cotizacionId, areaId, name, state, description, userId } = req.body;
        // Validamos que entren los parámetros
        if(!cotizacionId || !areaId || !name || !userId) return res.status(400).json({msg: 'Parámetros no son validos.'});
        // Caso contrario, avanzamos...

        // Procedemos a consultar cotizacion
        const searchCoti = await cotizacion.findByPk(cotizacionId, {
            where: {
                state: 'desarrollo'
            }
        })

        // Validamos la existencia.
        if(!searchCoti) return res.status(404).json({msg: 'No hemos encontrado esto.'});
        // Caso contrario, avanzamos
        const addArea = await areaCotizacion.update({
            name,
            description,
            state,
            cotizacionId
        }, {
            where: {
                id: areaId
            }
        })
        // Validamos respuesta
        if(!addArea) return res.status(502).json({msg: 'No hemos logrado crear esto.'});
        // Caso contrario, avanzamos
        res.status(200).json(addArea);
        
        
    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal.'});
    }
}

// Clonar Área
const clonarArea = async (req, res) => { 
    try{
        // Recibimos parametro por params
        const { areaId , userId} = req.body;
        if(!areaId) return res.status(501).json({msg: 'Invado el parámetro'})
        // Definimos la transacción
        const transaction = await db.transaction();

        const kitOriginal = await areaCotizacion.findByPk(areaId, {
            include:[{
                model: kit,
            }, { 
                model: armado
            }, {
                model: producto,
            }],
            transaction
        }).catch(err => {
            console.log(err);
            return null; 
        });

        // Validamos la existencia
        if(!kitOriginal) {
            await transaction.rollback();
            return res.status(404).json({msg: 'No hemos encontrado este kit'});
        }
        // Caso contrario, avanzamos...

        const nuevoKit = await areaCotizacion.create({
            name: `${kitOriginal.name} - Copia`,
            description: kitOriginal.description,
            state: kitOriginal.state, 
            cotizacionId: kitOriginal.cotizacionId,
        }, { transaction }); 

        if(!nuevoKit) { 
            await transaction.rollback();
            return res.status(502).json({msg: 'No hemos logrado crear esto.'});
        }

        // Listamos la armados
        const nuevosArmados = kitOriginal.armados?.map((mp) => ({
            cantidad: mp.armadoCotizacion.cantidad,
            descuento: mp.armadoCotizacion.descuento,
            precio: mp.armadoCotizacion.precio,
            armadoId: mp.id, 
            areaId: nuevoKit.id
        }));

        // Listamos la armados
        const nuevosKits = kitOriginal.kits?.map((mp) => ({
            cantidad: mp.kitCotizacion.cantidad,
            descuento: mp.kitCotizacion.descuento,
            precio: mp.kitCotizacion.precio,
            kitId: mp.id, 
            areaId: nuevoKit.id
        }));

        // Listamos los productos
        const nuevosProductos = kitOriginal.productos?.map((mp) => ({
            cantidad: mp.productoCotizacion.cantidad,
            descuento: mp.productoCotizacion.descuento,
            precio: mp.productoCotizacion.precio,
            productoId: mp.id, 
            areaId: nuevoKit.id
        }));
        // Caso contrario
        // Caso contrario, avanzamos
        if(nuevosArmados.length > 0 || nuevosKits.length > 0 || nuevosProductos.length  > 0){
            await armadoCotizacion.bulkCreate(nuevosArmados,  { transaction })
            await kitCotizacion.bulkCreate(nuevosKits,  { transaction })
            await productoCotizacion.bulkCreate(nuevosProductos,  { transaction })

            // .then(async (res) => {
            //     // Entidad, entidadId, accion, detalle, fecha, userId
            //     const a = await addLog('kits', nuevoKit.id, 'create', 'Clonó este kit.', userId)
            //     return res
            // })
            
            await transaction.commit();
            return res.status(201).json({msg: 'Área clonada con éxito!'});
        }else{

            await transaction.commit();

            return res.status(201).json({msg: 'Área clonado con éxito (El área original no tenia items).'})
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

        console.error('Error en la funcion clonar Kit.', err);

        res.status(500).json({msg: 'Ha ocurrido un error en la principal.'});
    }
}

// Eliminar
const deleteAreaToCotizacion = async (req, res) =>  {
    try{ 
        // Recbimos datos por body
        const { cotizacionId, areaId, userId } = req.body;
        
        // Validamos que entren los parámetros
        if(!cotizacionId || !areaId || !userId) return res.status(400).json({msg: 'Parámetros no son validos.'});
        // Caso contrario, avanzamos...

        // Procedemos a consultar cotizacion
        const searchCoti = await cotizacion.findByPk(cotizacionId, {
            where: {
                state: 'desarrollo'
            }
        })

        // Validamos la existencia.
        if(!searchCoti) return res.status(404).json({msg: 'No hemos encontrado esto.'});
        // Caso contrario, avanzamos
        const addArea = await areaCotizacion.destroy({
            where: {
                id: areaId
            }
        })
        // Validamos respuesta
        if(!addArea) return res.status(502).json({msg: 'No hemos logrado eliminar esto.'});
        // Caso contrario, avanzamos
        res.status(200).json({msg: 'Eliminado con éxito'});
        
        
    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal.'});
    }
}  
 
// Agregar nota , imagen a cotizacion
const addRegisterToCotizacion = async (req, res) => {
    try{
        // Recibimos variables por body
        const { texto,  cotizacionId} = req.body;
        // Validamos la entrada
        if(!cotizacionId ) return res.status(501).json({msg: 'Los parámetros ingresado no son validos.'});
        // Caso contrario, avanzamos...
        if(req.file){
            const result = await cloudinary.uploader.upload(
                `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`, // Usando el buffer de memoryStorage
                { folder: 'galeriaUnion' } // Opcional: especificar una carpeta
            )
    
            // Creamos consulta para avanzar
            const addNew = await notaCotizacion.create({
                texto,
                imagen: result.secure_url,
                type: texto ? 'mixto' : 'imagen', 
                cotizacionId
            });

            return res.status(201).json(addNew);
        }else{
            // Creamos consulta para avanzar
            const addNew = await notaCotizacion.create({
                texto,
                type: 'texto', 
                cotizacionId
            });
            return res.status(201).json(addNew);
        }
         
        
    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal.'});
    }
}
module.exports = { 
    getCotizacion, // Obtenemos una cotización por su Id
    newCotizacion, // Crear una nueva cotización
    addItemToCotizacion, // Agregar item a la cotización
    updateItemToCotizacion, // Actualizar items y precios dentro de una cotización.
    deleteKitOnCotizacion, // Eliminar Kit de una cotización
    getAllCotizaciones, // Obtener todas las cotizaciones
    searchClientQuery, // QUERY
    acceptCotizacion, // Aceptar cotización
    addSuperKit, // Nuevo superKit en Cotización.
    deleteSuperKitOnCotizacion, // Eliminar superKit Item
    giveDescuento, // Dar descuento a kitCotizacion
    giveDescuentoSuperKitItem, // Dar descuento a item SuperKit
    addAreaToCotizacion, // Agregar área a la cotización
    editAreaToCotizacion, // Editar área de la cotización
    deleteAreaToCotizacion, // Eliminar área de la cotización
    addProducto, // Agregar producto a cotización
    clonarArea, // Clonar área de cotización
    addRegisterToCotizacion, // Agregar nota
}  