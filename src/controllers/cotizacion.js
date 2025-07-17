const express = require('express');
const { client, service, serviceCotizacion, kit, itemKit, extension, producto, materia, cotizacion, versionCotizacion, notaCotizacion, armado, armadoCotizacion, kitCotizacion, productoCotizacion, areaCotizacion, user, db} = require('../db/db');
const { Op } = require('sequelize');
const { createCotizacion, addItemToCotizacionServices, addSuperKitToCotizacionServices, addProductoToCotizacionServices, addServiceToCotizacionServices } = require('./services/cotizacionServices');
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
        // Buscamos primero el usuario

        const person = await user.findByPk(userId);
        if(!person) return res.status(404).json({msg: 'No hemos encontrado este usuario.'});
        // Caso contrario, avanzamos

        if(person.area == 'gerencia'){ // Si es admin muestre todo
            const searchCotizaciones = await cotizacion.findAll({
                where: {
                    state: {
                        [Op.in]: ['aprobada', 'desarrollo']
                    }
                },
                attributes: { exclude: ['updatedAt']},
                include:[ {model: areaCotizacion,
                    include:[
                        // 1. Mantenemos la relación belongsToMany para 'kit' como la tenías
                        { 
                            model: kit,
                            include:[{
                                model: extension
                            }]
                            // Sequelize usará la tabla intermedia definida en tu relación
                        }, 
                        // 2. Mantenemos la relación belongsToMany para 'armado'
                        {
                            model: armado,
                        },
                        {
                            model: serviceCotizacion,
                            as: 'serviciosCotizados', 
                            include:[{
                                model: service
                            }]
                        },
                        // 3. Usamos la NUEVA relación hasMany para 'productoCotizacion'
                        {
                            model: productoCotizacion, // Incluimos el modelo de la LÍNEA de ítem
                            include: [ producto ]      // Y DENTRO de la línea, incluimos la información del producto
                        }
                    ]
                }, {model: client}, { model: notaCotizacion}, {model: user}, {
                    model: versionCotizacion,
                    include:[{
                        model: cotizacion
                    }]
                }], 
                order: [
                    ['createdAt', 'DESC'], // Orden global por creación de la cotización
                    [notaCotizacion, 'createdAt', 'ASC'], // 👈 Orden solo para las notas
                    [areaCotizacion, 'createdAt', 'DESC'], // 👈 Orden solo para las notas
                    [versionCotizacion, cotizacion, 'createdAt', 'DESC']
                ]
            }).catch(err => {
                console.log(err);
                return null
            });
            // Validamos contenido.
            if(!searchCotizaciones) return res.status(404).json({msg: 'No hay cotizaciones'});
            // Caso contrario
            res.status(200).json(searchCotizaciones);
        }else{ // Caso contrario, las cotizacion especficias
            const searchCotizaciones = await cotizacion.findAll({
                        where: {
                            userId,
                            state: {
                                [Op.in]: ['aprobada', 'desarrollo']
                            }
                        },
                        attributes: { exclude: ['updatedAt']},
                        include:[ {model: areaCotizacion,
                            include:[
                                // 1. Mantenemos la relación belongsToMany para 'kit' como la tenías
                                { 
                                    model: kit,
                                    // Sequelize usará la tabla intermedia definida en tu relación
                                }, 
                                
                                // 2. Mantenemos la relación belongsToMany para 'armado'
                                {
                                    model: armado,
                                },
                                {
                                    model: serviceCotizacion,
                                    as: 'serviciosCotizados',
                                    include:[{
                                        model: service
                                    }]
                                },
                                // 3. Usamos la NUEVA relación hasMany para 'productoCotizacion'
                                {
                                    model: productoCotizacion, // Incluimos el modelo de la LÍNEA de ítem
                                    include: [ producto ]      // Y DENTRO de la línea, incluimos la información del producto
                                }
                            ]
                        }, {model: client}, { model: notaCotizacion}, {model: user}, {
                            model: versionCotizacion,
                            include:[{
                                model: cotizacion
                            }]
                        }], 
                        order: [
                            ['createdAt', 'DESC'], // Orden global por creación de la cotización
                            [notaCotizacion, 'createdAt', 'ASC'], // 👈 Orden solo para las notas
                            [areaCotizacion, 'createdAt', 'DESC'], // 👈 Orden solo para las notas
                            [versionCotizacion, cotizacion, 'createdAt', 'DESC']
                        ]
                    }).catch(err => {
                        console.log(err);
                        return null
                    });
                    // Validamos contenido.
                    if(!searchCotizaciones) return res.status(404).json({msg: 'No hay cotizaciones'});
                    // Caso contrario
                    res.status(200).json(searchCotizaciones);
        }

        
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
                include:[
                    // 1. Mantenemos la relación belongsToMany para 'kit' como la tenías
                    { 
                        model: kit, // 1. Incluimos el modelo que tiene el precio y los datos de la cotización.
                        attributes: ['id', 'name', 'description'], // Trae solo los campos que necesites del kit
                        include:[{
                            model: extension
                        }]
                    }, 
                    // 2. Mantenemos la relación belongsToMany para 'armado'
                    {
                        model: armado,
                    },  
                    {
                        model: serviceCotizacion,
                        as: 'serviciosCotizados',
                        include:[{
                            model: service
                        }]
                    },
                    // 3. Usamos la NUEVA relación hasMany para 'productoCotizacion'
                    {
                        model: productoCotizacion, // Incluimos el modelo de la LÍNEA de ítem
                        include: [ producto ]      // Y DENTRO de la línea, incluimos la información del producto
                    }
                ]
            }, {model: client}, { model: notaCotizacion}, {model: user}, {
                model: versionCotizacion,
                include:[{
                    model: cotizacion
                }]
            }], 
            order: [
                ['createdAt', 'DESC'], // Orden global por creación de la cotización
                [notaCotizacion, 'createdAt', 'ASC'], // 👈 Orden solo para las notas
                [areaCotizacion, 'createdAt', 'DESC'], // 👈 Orden solo para las notas
                [versionCotizacion, cotizacion, 'createdAt', 'DESC']
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

// Crear cotización
const updateCotizacion = async (req, res) => {
    try{
        // Recibimos datos por body.
        const { cotizacionId, userId, name, time } = req.body;
        
        // Validamos 
        if(!userId || !name || !time) return res.status(501).json({msg: 'Los parámetros no son validos.'});
         
        // Procedemos a crear cotización
        const add = await cotizacion.update({
            name,
            time,
        }, {
            where: {
                id: cotizacionId
            }
        })
        .catch(err => {
            console.log(err);
            return null;
        });

        if(!add) return res.status(502).json({msg: 'No hemos logrado actualizar esto.'});
        // Caso contrario, devolvemos cotización
        res.status(201).json({msg: 'Actualizado con éxito'});
    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal.'});
    }
}

// Eliminar Cotización
const deleteCotizacion = async (req, res) =>  {
    try{ 
        // Recbimos datos por body
        const { cotizacionId, userId } = req.body;
        
        // Validamos que entren los parámetros
        if(!cotizacionId || !userId) return res.status(400).json({msg: 'Parámetros no son validos.'});
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
        const deleteCotizacion = await cotizacion.destroy({
            where: {
                id: cotizacionId
            }
        })
        // Validamos respuesta
        if(!deleteCotizacion) return res.status(502).json({msg: 'No hemos logrado eliminar esto.'});
        // Caso contrario, avanzamos
        res.status(200).json({msg: 'Eliminado con éxito'});
        
        
    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal.'});
    }
} 

// Add One versión to ToCotización
const newVersionAboutCotizacion = async (req, res) => {
    const transaction = await db.transaction();
    try{
        // Recibimos datos por body
        const { cotizacionId, userId } = req.body;
        // Validamos
        if(!cotizacionId || !userId) return res.status(400).json({msg: 'Los parámetros no son validos.'});
        // Caso contrario, avanzamos.
        
        
        
        // Consultamos Cotizacion
        const coti = await cotizacion.findByPk(cotizacionId, {
            include:[ {model: areaCotizacion,
                include:[{ 
                    model: kit,
                    through: {
                        attributes: ['id', 'cantidad', 'precio', 'descuento', 'areaCotizacionId'] // o los campos que tengas en KitCotizacion
                    }
                }, {
                    model: armado,
                }, {
                    model: producto
                }]
            }]
        }, { transaction });

        if(!coti){
            await transaction.rollback();
            return res.status(404).json({msg: 'No hemos encontrado esto'});
        } 

        // Buscamos si ya existe un versión
        if(!coti.versionCotizacionId){
            const newVersionCotizacion = await versionCotizacion.create({
                name: `${coti.name} - versiones`,
                description: `Lista de versiones`,
                state: 'active'
            }, { transaction })
            .then(async (res) => {
                const updateCoti = await cotizacion.update({
                    versionCotizacionId: res.id,
                    version: 1,
                }, {
                    where: {
                        id: coti.id
                    }
                })

                return res;
            })

            // Creamos cotización
            const newCoti = await cotizacion.create({
                name: `${coti.name} - version` ,
                description: coti.description,
                time: coti.time,
                state: 'version',
                clientId: coti.clientId,
                userId: coti.userId,
                versionCotizacionId: newVersionCotizacion.id,
                version: 2

            });
            // Mapeo todas las áreas. 
            if(coti.areaCotizacions?.length){
                for (const area of coti.areaCotizacions) {
                    const newArea = await areaCotizacion.create({
                        name: area.name,
                        description: area.description,
                        state: area.state,
                        cotizacionId: newCoti.id
                    }, { transaction });

                    

                    const kitsArray = area.kits.map((kt) => ({
                        cantidad: String(kt.kitCotizacion.cantidad),
                        precio: String(kt.kitCotizacion.precio),
                        descuento: String(kt.kitCotizacion.descuento),
                        areaId: newArea.id, 
                        kitId: kt.id 
                    }));

                    const productoArray = area.productos.map((pt) => ({
                        cantidad: String(pt.productoCotizacion.cantidad),
                        precio: String(pt.productoCotizacion.precio),
                        medida: pt.productoCotizacion.medida,
                        descuento: String(pt.productoCotizacion.descuento),
                        areaId: newArea.id, 
                        productoId: pt.id 
                    }));

                    if (kitsArray.length > 0) {
                        await kitCotizacion.bulkCreate(kitsArray, { transaction });
                    }
                    if (productoArray.length > 0) {
                        await productoCotizacion.bulkCreate(productoArray, { transaction });
                    }
                }

                // Después de todas las áreas:
                await transaction.commit();
                return res.status(201).json({msg: 'Clonado con éxito'});

            }else{
                 await transaction.commit();
                 return res.status(200).json({msg:'Se cancelo todo'})
            }
        }else{
            const newVersionCotizacion = await versionCotizacion.findByPk(coti.versionCotizacionId,{
                include:[{
                    model: cotizacion
                }]
            }, { transaction })

            // Creamos cotización
            const newCoti = await cotizacion.create({
                name: `${coti.name} - version ${newVersionCotizacion.cotizacions.length + 1}` ,
                description: coti.description,
                time: coti.time,
                state: 'version',
                clientId: coti.clientId,
                userId: coti.userId,
                versionCotizacionId: newVersionCotizacion.id,
                version: newVersionCotizacion.cotizacions.length + 1 

            });
            // Mapeo todas las áreas. 
            if(coti.areaCotizacions?.length){
                for (const area of coti.areaCotizacions) {
                    const newArea = await areaCotizacion.create({
                        name: area.name,
                        description: area.description,
                        state: area.state,
                        cotizacionId: newCoti.id
                    }, { transaction });

                    

                    const kitsArray = area.kits.map((kt) => ({
                        cantidad: String(kt.kitCotizacion.cantidad),
                        precio: String(kt.kitCotizacion.precio),
                        descuento: String(kt.kitCotizacion.descuento),
                        areaId: newArea.id, 
                        kitId: kt.id 
                    }));

                    const productoArray = area.productos.map((pt) => ({
                        cantidad: String(pt.productoCotizacion.cantidad),
                        precio: String(pt.productoCotizacion.precio),
                        medida: pt.productoCotizacion.medida,
                        descuento: String(pt.productoCotizacion.descuento),
                        areaId: newArea.id, 
                        productoId: pt.id 
                    }));

                    if (kitsArray.length > 0) {
                        await kitCotizacion.bulkCreate(kitsArray, { transaction });
                    }
                    if (productoArray.length > 0) {
                        await productoCotizacion.bulkCreate(productoArray, { transaction });
                    }
                }

                // Después de todas las áreas:
                await transaction.commit();
                return res.status(201).json({msg: 'Clonado con éxito'});

            }else{
                 await transaction.commit();
                 return res.status(200).json({msg:'Se cancelo todo'})
            }
        }
        
            
            // Mapeo todos los productos y agrego los productoCotizacion
            // Mapeo todos los superKit's y agrego los superKitCotizacion

    }catch(err){
        console.log(err)
        if (transaction) {
            try {
                 await transaction.rollback();
                 console.error('Rollback de transacción exitoso.');
            } catch (rollbackErr) {
                 console.error('Error haciendo rollback de la transacción:', rollbackErr);
                 // Opcional: reportar este error de rollback si es crítico
            }
        }
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal.'});
    }
}

// Definir versión como la versión oficial
const beOfficialVersion = async (req, res) => {
    try{
        // Recibimos datos por body
        const { cotizacionId, versionCotizacionId, userId } = req.body;
        // Validamos los parámetros
        if(!cotizacionId || !versionCotizacionId || !userId) return res.status(400).json({msg: 'Los parámetros no son validos.'})
        // Avanzamos
        // Consultamos la versión que tenga una cotización en desarrollo
        const searchVersionDesarrollo = await versionCotizacion.findByPk(versionCotizacionId, {
            include:[{
                model: cotizacion,
                where: {
                    state: 'desarrollo'
                }
            }]
        });

        // Actualizamos
        const updateToDesarrollo = await cotizacion.update({
            state: 'desarrollo'
        }, {
            where: {
                id: cotizacionId
            }
        })

        const updateToVersion = await cotizacion.update({
            state: 'version'
        }, {
            where: {
                id: searchVersionDesarrollo.cotizacions[0].id
            }
        })
        return res.status(201).json({msg: 'Actualizado con éxito'})
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

// Dar descuento a item en cotización
const giveDescuentoProducto = async(req, res) => {
    try{
        // Recibimos datos por body
        const { productoCotizacionId, descuento } = req.body;
        // Validamos que los datos entres
        if(!productoCotizacionId || !descuento) return res.status(400).json({msg: 'Los parámetros no son validos.'});
        // Caso contrario, avanzamos
        // Consultamos que exista este itemCotizacion
        const getProductoCotizacion = await productoCotizacion.findByPk(productoCotizacionId);
        // Validamos la respuesta
        if(!getProductoCotizacion) return res.status(404).json({msg: 'No hemos encontrado este item en la cotización'});
        // Caso contrario, avannzamos
        // Creamos petición para actualizar
        const updateProductoCotizacion = await productoCotizacion.update({
            descuento 
        }, {
            where: {
                id: productoCotizacionId
            }
        });
        // Validamos la respuesta
        if(!updateProductoCotizacion) return res.status(502).json({msg: 'No hemos logrado actualizar esto.'});
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

// agregar
//  superKit a la cotizacion
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
        const { cotizacionId, productoId, cantidad, precio, descuento, medida } = req.body; // Destructuramos
    
        // Validamos la entrada de parámetros
        if(!cotizacionId || !productoId || !cantidad || !precio) return res.status(400).json({msg: 'Los parámetros no son validos.'});
        
        // Enviamos petición asincrónica - Consultando una función services. Del Archivo cotizacionServices.js
        // Pasamos la cotización, el superKit, la cantidad, el precio y un descuento si tiene.
        const sendItem = await addProductoToCotizacionServices(cotizacionId, productoId, cantidad, precio, descuento, medida)
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

// Agregar servicio
const addService = async(req, res) => {
    try{
        // Recibimos datos por body 
        const { cotizacionId, servicioId, cantidad, precio, descuento } = req.body; // Destructuramos
    
        // Validamos la entrada de parámetros
        if(!cotizacionId || !servicioId || !cantidad || !precio) return res.status(400).json({msg: 'Los parámetros no son validos.'});
        
        // Enviamos petición asincrónica - Consultando una función services. Del Archivo cotizacionServices.js
        // Pasamos la cotización, el superKit, la cantidad, el precio y un descuento si tiene.
        const sendItem = await addServiceToCotizacionServices(cotizacionId, servicioId, cantidad, precio, descuento)
        .catch(err => {
            console.log(err);
            return null;
        });
        if(sendItem == 200) return res.status(200).json({msg: 'Ya existe este servicio'}); 
        if(!sendItem || sendItem == 502) return res.status(502).json({msg: 'No hemos logrado crear esto.'});
        // Caso contrario, enviamos la creación
        res.status(201).json(sendItem); 
    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal.'});
    }
}

// Dar descuento a item en cotización
const giveDescuentoService = async(req, res) => {
    try{
        // Recibimos datos por body
        const { serviceCotizacionId, descuento } = req.body;
        // Validamos que los datos entres
        if(!serviceCotizacionId || !descuento) return res.status(400).json({msg: 'Los parámetros no son validos.'});
        // Caso contrario, avanzamos
        // Consultamos que exista este itemCotizacion
        const getProductoCotizacion = await serviceCotizacion.findByPk(serviceCotizacionId);
        // Validamos la respuesta
        if(!getProductoCotizacion) return res.status(404).json({msg: 'No hemos encontrado este item en la cotización'});
        // Caso contrario, avannzamos
        // Creamos petición para actualizar
        const updateProductoCotizacion = await serviceCotizacion.update({
            descuento 
        }, {
            where: {
                id: serviceCotizacionId
            }
        });
        // Validamos la respuesta
        if(!updateProductoCotizacion) return res.status(502).json({msg: 'No hemos logrado actualizar esto.'});
        // Caso contrario, enviamos respuesta 200. ¡Actualizado!
        res.status(200).json({msg: 'Descuento añadido.'});
    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal.'});
    }
}

// Eliminar Producto de una cotización
const deleteServiceOnCotizacion = async (req, res) => {
    try{
        // Recibimos datos por body
        const { serviceCotizacionId } = req.body;
        if(!serviceCotizacionId ) return res.status(501).json({msg: 'Los parámetros no son validos.'});
        // Caso contrario, avanzamos...

        
        // Caso contrario, eliminamos.

        const removeProducCotizacion = await serviceCotizacion.destroy({
            where: {
                id: serviceCotizacionId
            }
        })
        if(!removeProducCotizacion) return res.status(502).json({msg: 'No hemos logrado eliminar esto'});

        res.status(200).json({msg: 'Eliminado con éxito'})
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
 
// Eliminar Producto de una cotización
const deleteProductOnCotizacion = async (req, res) => {
    try{
        // Recibimos datos por body
        const { productoCotizacionId } = req.body;
        if(!productoCotizacionId ) return res.status(501).json({msg: 'Los parámetros no son validos.'});
        // Caso contrario, avanzamos...

        
        // Caso contrario, eliminamos.

        const removeProducCotizacion = await productoCotizacion.destroy({
            where: {
                id: productoCotizacionId
            }
        })
        if(!removeProducCotizacion) return res.status(502).json({msg: 'No hemos logrado eliminar esto'});

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
    const transaction = await db.transaction();
    try {
        const { areaId, userId } = req.body;
        if (!areaId) return res.status(400).json({ msg: 'Parámetro inválido' });

        // --- CONSULTA CORREGIDA ---
        // Se mantiene tu lógica para kit y armado, y se corrige la de producto.
        const areaOriginal = await areaCotizacion.findByPk(areaId, {
            include: [
                {
                    model: kit, // Asumimos que esta relación 'belongsToMany' te funciona
                },
                {
                    model: armado, // Asumimos que esta relación 'belongsToMany' te funciona
                },
                {
                    model: productoCotizacion, // Forma correcta para producto
                    include: [producto]
                }
            ],
            transaction
        });

        if (!areaOriginal) {
            await transaction.rollback();
            return res.status(404).json({ msg: 'No hemos encontrado esta área' });
        }

        const nuevaArea = await areaCotizacion.create({
            name: `${areaOriginal.name} - Copia`,
            cotizacionId: areaOriginal.cotizacionId,
        }, { transaction });

        // ... Tu lógica para crear nuevoKit (que ahora es nuevaArea) ...

        // --- PROCESAMIENTO DE DATOS CORREGIDO ---

        // Lógica para armados (se mantiene como la tenías)
        const nuevosArmados = areaOriginal.armados?.map((mp) => ({
            cantidad: mp.armadoCotizacion.cantidad,
            descuento: mp.armadoCotizacion.descuento,
            precio: mp.armadoCotizacion.precio,
            armadoId: mp.id,
            areaId: nuevaArea.id,
            areaCotizacionId: nuevaArea.id

        }));

        // Lógica para kits (se mantiene como la tenías)
        const nuevosKits = areaOriginal.kits?.map((mp) => ({
            cantidad: mp.kitCotizacion.cantidad,
            descuento: mp.kitCotizacion.descuento,
            precio: mp.kitCotizacion.precio,
            kitId: mp.id,
            areaId: nuevaArea.id,
            areaCotizacionId: nuevaArea.id

        }));

        // ▼▼▼ AQUÍ ESTÁ LA CORRECCIÓN ▼▼▼
        // Ahora iteramos sobre 'productoCotizacions' que es lo que devuelve la consulta.
        const nuevosProductos = areaOriginal.productoCotizacions?.map((pc) => ({
            // Los datos de la tabla intermedia están directamente en 'pc'
            cantidad: pc.cantidad,
            descuento: pc.descuento,
            precio: pc.precio,
            // El ID del producto maestro está anidado
            productoId: pc.producto.id,
            areaId: nuevaArea.id,
            areaCotizacionId: nuevaArea.id
        }));
        
        // --- INSERCIÓN EN LOTE ---
        // Usamos optional chaining (?.) por si algún arreglo viene vacío
        if (nuevosArmados?.length) {
            await armadoCotizacion.bulkCreate(nuevosArmados, { transaction });
        }
        if (nuevosKits?.length) {
            await kitCotizacion.bulkCreate(nuevosKits, { transaction });
        }
        if (nuevosProductos?.length) {
            await productoCotizacion.bulkCreate(nuevosProductos, { transaction });
        }

        await transaction.commit();
        return res.status(201).json({ msg: 'Área clonada con éxito!', nuevaArea });

    } catch (err) {
        if (transaction) await transaction.rollback();
        console.error('Error en la función clonarArea:', err);
        res.status(500).json({ msg: 'Ha ocurrido un error en la principal.' });
    }
}

// Eliminar
const deleteAreaToCotizacion = async (req, res) => {
    const transaction = await db.transaction();
    try {
        const { areaId } = req.body;
        // ... validaciones ...

        // 1. Borrar todos los hijos primero
        await productoCotizacion.destroy({ where: { areaId: areaId }, transaction });
        await kitCotizacion.destroy({ where: { areaId: areaId }, transaction });
        await armadoCotizacion.destroy({ where: { areaId: areaId }, transaction });
        
        // 2. Ahora sí, borrar el padre
        await areaCotizacion.destroy({ where: { id: areaId }, transaction });

        await transaction.commit();
        res.status(200).json({ msg: 'Área y todo su contenido eliminados con éxito' });
        
    } catch (err) {
        if(transaction) await transaction.rollback();
        // ... manejo de errores ...
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
    updateCotizacion, // Actualizar cotizacion
    newVersionAboutCotizacion, // Versión de cotizacion
    beOfficialVersion, // Convertir a versión oficial
    deleteCotizacion, // Eliminar cotización
    addItemToCotizacion, // Agregar item a la cotización
    updateItemToCotizacion, // Actualizar items y precios dentro de una cotización.
    deleteKitOnCotizacion, // Eliminar Kit de una cotización
    getAllCotizaciones, // Obtener todas las cotizaciones
    searchClientQuery, // QUERY
    acceptCotizacion, // Aceptar cotización
    addSuperKit, // Nuevo superKit en Cotización.
    deleteSuperKitOnCotizacion, // Eliminar superKit Item
    deleteProductOnCotizacion, // Eliminar producto
    giveDescuento, // Dar descuento a kitCotizacion
    giveDescuentoProducto, // Dar descuento a producto Cotizacion
    giveDescuentoSuperKitItem, // Dar descuento a item SuperKit
    addAreaToCotizacion, // Agregar área a la cotización
    editAreaToCotizacion, // Editar área de la cotización
    deleteAreaToCotizacion, // Eliminar área de la cotización
    addProducto, // Agregar producto a cotización
    clonarArea, // Clonar área de cotización
    addRegisterToCotizacion, // Agregar nota 
    addService, // Dar precio a producto
    deleteServiceOnCotizacion, // Eliminar cotización
    giveDescuentoService, // Dar descuento.
}  