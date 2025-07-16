const express = require('express');
const { materia, cotizacion, client, user, armado, kitCotizacion, armadoKits, areaCotizacion, armadoCotizacion, proveedor, extension, price, kit, itemKit, linea, categoria, requisicion, db, Op} = require('../db/db');
const { searchPrice, addPriceMt, updatePriceState,  } = require('./services/priceServices');
const { searchKit, createKitServices, addItemToKit, deleteDeleteItemOnKit, changeState } = require('./services/kitServices');

// Obtener todas las requisiciones
const getAllRequisiciones = async (req, res) => {
    try {
        const searchReq = await requisicion.findAll({
            include: [{
                model: cotizacion,
                attributes: ['id', 'name', 'state', 'createdAt'], // Traemos solo datos clave
                include: [
                    { model: client },
                    { model: user, attributes: ['id', 'name'] }
                ]
            }],
            order: [['createdAt', 'DESC']]
        });

        if (!searchReq || !searchReq.length) {
            return res.status(404).json({ msg: 'Sin resultados.' });
        }
        
        res.status(200).json(searchReq);
    } catch (err) {
        console.log(err);
        res.status(500).json({ msg: 'Ha ocurrido un error en el servidor' });
    }
}

const getRequisicion = async (req, res) => {
    try {
        const { reqId } = req.params;
        if (!reqId) return res.status(400).json({ msg: 'Parámetro no es válido.' });

        // PASO 1, 2 y 3: Se mantienen igual. Traemos los datos en dos consultas.
        const searchReq = await requisicion.findByPk(reqId, {
            include: [{
                model: cotizacion,
                include: [{
                    model: areaCotizacion,
                    include: [
                        { model: kit, through: { attributes: ['cantidad', 'precio'] } },
                        { model: armado, through: { attributes: ['cantidad', 'precio'] }, include: [{ model: kit, as: 'kits', through: { attributes: ['cantidad'] } }] }
                    ]
                }]
            }]
        });

        if (!searchReq) {
            return res.status(404).json({ msg: 'No hemos encontrado esta requisición' });
        }

        const kitIds = new Set();
        const kitDataMap = new Map();
        searchReq.cotizacion.areaCotizacions.forEach(area => {
            area.kits.forEach(k => { kitIds.add(k.id); kitDataMap.set(k.id, k.kitCotizacion); });
            area.armados.forEach(a => a.kits.forEach(k => { kitIds.add(k.id); kitDataMap.set(k.id, k.armadoKits); }));
        });

        const kitsConMateria = await kit.findAll({
            where: { id: [...kitIds] },
            include: [{ model: itemKit, include: [materia] }]
        });

        // --- PASO 4: Lógica de cálculo CON LA CORRECCIÓN ---
        const totalMateriaPrima = {};
        const totalKits = {}; // <-- NUEVO: Objeto para consolidar los kits

        // Iteramos sobre la primera consulta para obtener las cantidades correctas
        searchReq.cotizacion.areaCotizacions.forEach(area => {
            // Procesamos Kits directos
            area.kits.forEach(kitEnCoti => {
                const cantidadKitEnCoti = kitEnCoti.kitCotizacion?.cantidad || 0;

                // <-- NUEVO: Lógica para consolidar el total de cada kit
                const kitId = kitEnCoti.id;
                if (!totalKits[kitId]) {
                    totalKits[kitId] = { id: kitId, nombre: kitEnCoti.name, cantidad: 0 };
                }
                totalKits[kitId].cantidad += cantidadKitEnCoti;

                const kitDetallado = kitsConMateria.find(k => k.id === kitEnCoti.id);
 
                if (kitDetallado && kitDetallado.itemKits) {
                    kitDetallado.itemKits.forEach(item => {
                        // ▼▼▼ CORRECCIÓN AQUÍ ▼▼▼
                        const key = `${item.materium.id}`; // Usamos 'materium'
                        const cantidadTotal = Number(item.medida) * Number(cantidadKitEnCoti);
                        
                        if (!totalMateriaPrima[key]) {
                            totalMateriaPrima[key] = { 
                                id: item.materium.id, // Usamos 'materium'
                                nombre: item.materium.description, 
                                medidaOriginal: item.materium.medida, 
                                unidad: item.materium.unidad, 
                                cantidad: 0 
                            };
                        }
                        totalMateriaPrima[key].cantidad += cantidadTotal;
                    });
                }
            });

            // Procesamos Armados
            area.armados.forEach(armadoEnCoti => {
                const cantidadArmadoEnCoti = armadoEnCoti.armadoCotizacion?.cantidad || 0;
                armadoEnCoti.kits.forEach(kitEnArmado => {
                    const cantidadKitEnArmado = kitEnArmado.armadoKits?.cantidad || 0;
                    const kitDetallado = kitsConMateria.find(k => k.id === kitEnArmado.id);

                    if (kitDetallado && kitDetallado.itemKits) {
                        kitDetallado.itemKits.forEach(item => {
                            // ▼▼▼ CORRECCIÓN AQUÍ ▼▼▼
                            const key = `${item.materium.id}`; // Usamos 'materium'
                            const cantidadTotal = Number(item.medida) * Number(cantidadKitEnArmado) * Number(cantidadArmadoEnCoti);

                            if (!totalMateriaPrima[key]) {
                                totalMateriaPrima[key] = { 
                                    id: item.materium.id, // Usamos 'materium'
                                    nombre: item.materium.description, 
                                    medidaOriginal: item.materium.medida, 
                                    unidad: item.materium.unidad, 
                                    cantidad: 0 
                                };
                            }
                            totalMateriaPrima[key].cantidad += cantidadTotal;
                        });
                    }
                });
            });
        });

        res.status(200).json({
            requisicion: searchReq,
            cantidades: Object.values(totalMateriaPrima),
            resumenKits: Object.values(totalKits)
        });

    } catch (err) {
        console.log(err);
        res.status(500).json({ msg: 'Ha ocurrido un error en la principal.' });
    }
} 


const getMultipleReq = async (req, res) => {
    try {
        const { ids } = req.body;
        if (!ids || !ids.length) return res.status(400).json({ msg: 'Parámetro inválido' });

        // --- PASO 1: Traemos la estructura de TODAS las requisiciones seleccionadas ---
        const multiReq = await requisicion.findAll({
            where: { id: { [Op.in]: ids } },
            include: [{
                model: cotizacion,
                include: [{
                    model: areaCotizacion,
                    include: [
                        { model: kit, through: { attributes: ['cantidad'] } },
                        { model: armado, through: { attributes: ['cantidad'] }, include: [{ model: kit, as: 'kits', through: { attributes: ['cantidad'] } }] }
                    ]
                }]
            }]
        });

        if (!multiReq || !multiReq.length) {
            return res.status(404).json({ msg: 'No se encontraron resultados.' });
        }
        
        const cotizacionesConsultadas = multiReq.map(req => req.cotizacion);
        // --- PASO 2: Recolectamos todos los IDs de kits únicos de todas las requisiciones ---
        const kitIds = new Set();
        multiReq.forEach(req => {
            req.cotizacion.areaCotizacions.forEach(area => {
                area.kits.forEach(k => kitIds.add(k.id));
                area.armados.forEach(a => a.kits.forEach(k => kitIds.add(k.id)));
            });
        });

        // --- PASO 3: Hacemos UNA SOLA consulta para traer los detalles de TODOS esos kits ---
        const kitsConMateria = await kit.findAll({
            where: { id: [...kitIds] },
            include: [{
                model: itemKit,
                include: [materia] // Usando el nombre de modelo 'materia'
            }]
        });

        // --- PASO 4: Lógica de cálculo para agregar las cantidades ---
        const totalMateriaPrima = {};
        const totalKits = {}; // Objeto para consolidar kits

        // Iteramos sobre cada requisición encontrada
        multiReq.forEach(req => {
            // Navegamos por su estructura para encontrar los kits y armados
            req.cotizacion.areaCotizacions.forEach(area => {
                // Procesamos los KITS directos
                area.kits.forEach(kitEnCoti => {
                    const cantidadKitEnCoti = kitEnCoti.kitCotizacion?.cantidad || 0;

                    const kitId = kitEnCoti.id;
                    if (!totalKits[kitId]) {
                        // Asumo que el nombre del kit está en la propiedad 'name'
                        totalKits[kitId] = { id: kitId, nombre: kitEnCoti.name, cantidad: 0 };
                    }
                    totalKits[kitId].cantidad = Number(totalKits[kitId].cantidad) + Number(cantidadKitEnCoti);
                    const kitDetallado = kitsConMateria.find(k => k.id === kitEnCoti.id);

                    if (kitDetallado && kitDetallado.itemKits) {
                        kitDetallado.itemKits.forEach(item => {
                            const key = `${item.materium.id}`;
                            const cantidadTotal = Number(item.medida) * Number(cantidadKitEnCoti);
                            if (!totalMateriaPrima[key]) {
                                totalMateriaPrima[key] = { id: item.materium.id, nombre: item.materium.description, medidaOriginal: item.materium.medida, unidad: item.materium.unidad, cantidad: 0 };
                            }
                            totalMateriaPrima[key].cantidad += cantidadTotal;
                        });
                    }
                });

                // Procesamos los ARMADOS
                area.armados.forEach(armadoEnCoti => {
                    const cantidadArmadoEnCoti = armadoEnCoti.armadoCotizacion?.cantidad || 0;
                    armadoEnCoti.kits.forEach(kitEnArmado => {
                        const cantidadKitEnArmado = kitEnArmado.armadoKits?.cantidad || 0;
                        const kitDetallado = kitsConMateria.find(k => k.id === kitEnArmado.id);

                        if (kitDetallado && kitDetallado.itemKits) {
                            kitDetallado.itemKits.forEach(item => {
                                const key = `${item.materium.id}`;
                                const cantidadTotal = Number(item.medida) * Number(cantidadKitEnArmado) * Number(cantidadArmadoEnCoti);
                                if (!totalMateriaPrima[key]) {
                                    totalMateriaPrima[key] = { id: item.materium.id, nombre: item.materium.description, medidaOriginal: item.materium.medida, unidad: item.materium.unidad, cantidad: 0 };
                                }
                                totalMateriaPrima[key].cantidad += cantidadTotal;
                            });
                        }
                    });
                });
            });
        });

        res.status(200).json({
            // Puedes enviar las requisiciones si las necesitas en el frontend
            // requisiciones: multiReq, 
            requisicion: cotizacionesConsultadas,
            resumenKits: Object.values(totalKits), // Se añade el nuevo resumen
            cantidades: Object.values(totalMateriaPrima)
        });

    } catch (err) {
        console.log(err);
        res.status(500).json({ msg: 'Ha ocurrido un error en la principal.' });
    }
}

module.exports = { 
    getAllRequisiciones, // Obtener todas las requsiciones
    getRequisicion, // Obtener una requisición 
    getMultipleReq, // Multiples requisiciones
}