const express = require('express');
const { ubicacion, inventario, producto, materia, movimientoInventario, cotizacion_compromiso, cotizacion } = require('../db/db');
const { Op } = require('sequelize');
const dayjs = require('dayjs');
const { validateEmailService } = require('./services/userServices');
const { registrarMovimiento, registrarMovimientoMPONE, registrarMovimientoPTONE, comprometerStock, createCompromiso, getBodegaData } = require('./services/inventarioServices');
const { default: axios } = require('axios');

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
                        }
                    },
                    {
                        model: movimientoInventario, as: 'destino',
                        where: {
                            materiumId: itemId
                        }
                    }
                ]
            }]
        })

        if(!searchItem) return res.status(404).json({msg: 'Ha ocurrido un error en la principal'});
        res.status(200).json(searchItem);

    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal'});
    }
}

// Obtener movimientos por proyecto
const getMovimientosItemProyectos = async(req, res) => {
    try{
        const { cotizacionId, itemId} = req.params;
        if(!cotizacionId || !itemId) return res.status(200).json({msg: 'Parámetros no validos'});
        // Caso contrario, avanzamos
        
        const searchItem = await inventario.findOne({
            where: {
                materiumId: itemId,
            },
            include:[{
                model: ubicacion,
                include:[
                    {
                        model: movimientoInventario, as: 'origen',
                        where: {
                            materiumId: itemId,
                            cotizacionId
                        }
                    },
                    {
                        model: movimientoInventario, as: 'destino',
                        where: {
                            materiumId: itemId,
                            cotizacionId
                        }
                    }
                ]
            }]
        })

        if(!searchItem) return res.status(404).json({msg: 'Ha ocurrido un error en la principal'});
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
    try{
        // Recibimos datos por body
        const { materiaId, productoId, cantidad, tipoProducto, tipo, ubicacionOrigenId, ubicacionDestinoId, refDoc, cotizacionId } = req.body;
        if(!cantidad || !tipoProducto || !tipo  || !refDoc) return res.status(400).json({msg: 'Los parámetros no son validos'});
        // Caso contrario, avanzamos
        const add = await registrarMovimiento(req.body);
        res.status(201).json(add);
    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal'});
    }
} 

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

const nuevoCompromiso = async (req, res) => {
    try{
        // Recibimos datos por body
        const { cotizacionId } = req.params;
        // Validamos
        if(!cotizacionId) return res.status(400).json({msg: 'Parámetro no es valido.'});
        // Caso contrario, avanzamos

        const compromisoArray = [];

        const getData = await axios.get(`http://192.168.1.15:3000/api/requisicion/get/${cotizacionId}`)
        .then(res => res.data);


        if(getData.cantidades){
            getData.cantidades.forEach(many => {
                let original = many.medidaOriginal; // Cantidad original
                let unidad = many.unidad; // Unidad de medida
                let consumo = many.cantidad; // Cantidad de consumo según unidad medida.
                // Si es un mt2 cojo el lado A primero
                let mt2A = many.unidad == 'mt2' ? many.medidaOriginal.split('X')[0] : 0
                // Si es un mt2 cojo el lado B primero
                let mt2B = many.unidad == 'mt2' ? many.medidaOriginal.split('X')[1] : 0
                let productoLados = Number(Number(mt2A * mt2B));
                let comprometer = unidad == 'kg' || unidad == 'mt' || unidad == 'unidad' ? Math.round(Number(consumo / Number(original)))
                : unidad == 'mt2' ? Math.round(Number(consumo / productoLados)) : 1
                let data = {
                    unidad,
                    cantidadComprometida: comprometer,
                    cantidadEntregada: 0,
                    estado: 'pendiente',
                    materiaId: many.id, 
                    materiumId: many.id,
                    ubicacionId: 1,
                    cotizacionId: Number(cotizacionId)
                }

                compromisoArray.push(data)
            });
        }


        compromisoArray.forEach(async mp => {
            await comprometerStock(mp.materiaId, 1, mp.cantidadComprometida)
            await createCompromiso(mp.materiaId, mp.cantidadComprometida, cotizacionId)
        });
 
        res.status(200).json(compromisoArray);

    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal.'});
    }
}


module.exports = {
    searchMPForInventario, // Buscar por nombre o id materia prima. En una bodega.
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
    getMovimientosMateriaBodega, // OBtener movimientos de item en una bodega
    getMovimientosItemProyectos, // Obtenemos los movimientos de un ITEM por proyecto
}