const express = require('express');
const { materia, cotizacion, client, user, armado, kitCotizacion, armadoKits, areaCotizacion, armadoCotizacion, proveedor, extension, price, kit, itemKit, linea, categoria, requisicion, itemRequisicion, db, Op} = require('../db/db');
const { searchPrice, addPriceMt, updatePriceState,  } = require('./services/priceServices');
const { searchKit, createKitServices, addItemToKit, deleteDeleteItemOnKit, changeState } = require('./services/kitServices');
const { default: axios } = require('axios');

// Obtener todas las requisiciones
const getAllRequisiciones = async (req, res) => {
    try {
        const searchReq = await requisicion.findAll({
            where:{
                estado: {
                    [Op.in]: ['pendiente', 'comprando']
                }
            },
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

const realRequisicion = async (req, res) => {
    try{
        // Recibimos datos por params
        const { reqId } = req.params
        // Validamos
        if(!reqId) return res.status(400).json({msg: 'Parámetro invalido'});

        // PASO 1, 2 y 3: Se mantienen igual. Traemos los datos en dos consultas.
        const searchReq = await requisicion.findByPk(reqId, {
            include: [{
                model: cotizacion,
                include: [{model: client}]
            }, {
                model: itemRequisicion,
                include: [{
                    model: materia
                }]
            }]
        });

        if(!searchReq) return res.status(404).json({msg: 'NO hemos encontrado esto'});

        res.status(200).json(searchReq)
    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal.'});
    }
}
// Obtener multiples requisiciones
const getRealProyectosRequisicion = async (req, res) => {
    try{
        // Recibo datos por body
        const { ids } = req.body;
        if (!ids || !ids.length) return res.status(400).json({ msg: 'Parámetro inválido' });

        const multiReq = await requisicion.findAll({
            where: { id: { [Op.in]: ids } },
            include: [ {model: cotizacion,
                include:[{model:client}]
            }, {
                model: itemRequisicion,
                include:[{
                    model: materia
                }]
            }]
        });

        if (!multiReq.length) {
            return res.status(404).json({ msg: 'No encontramos requisiciones con esos IDs' });
        }
        const consolidado = {};
        const plainReqs = multiReq.map(r => r.toJSON());
        plainReqs.forEach(req => {
            req.itemRequisicions.forEach(item => {
                const matId = item.materium.id; // cuidado: depende de cómo definiste el alias en tu modelo
                if (!consolidado[matId]) {
                    consolidado[matId] = {
                        materiaId: matId,
                        nombre: item.materium.description,
                        medida: item.materium.medida,
                        unidad: item.materium.unidad,
                        entregado: 0,
                        totalCantidad: 0
                    };
                }
                consolidado[matId].totalCantidad += Number(item.cantidad);
                consolidado[matId].entragado += Number(item.cantidadEntrega);
            });
        });

        // Lo devolvemos como array
        const resultado = Object.values(consolidado);
        let result = {
            proyectos: multiReq,
            consolidado: resultado,
            totalRequisiciones: multiReq.length
        }
        res.status(200).json(result);
    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal'})
    }
}
// Obtener materia prima en proceso de comprar
const getMateriaByComprar =  async (req, res) => {
    try{
        // Recibo la materia prima por ID y los proyectos que puedan venir
        const { mpId, ids } = req.body;
        // Validamos entrada
        if(!mpId || !ids) return res.status(400).json({msg: 'Los parámetros no son validos.'});
        // Caso contrario, avanzamos...

        const dataMP = await materia.findByPk(mpId, {
            include:[{
                model: itemRequisicion,
                where: { requisicionId: { [Op.in]: ids } },
                include: [ {model: requisicion}]
            }, {
                model: price,
                include:[{
                    model: proveedor
                }]
            }]
        })

        if(!dataMP) return res.status(404).json({msg: 'NO hay resultados'});
        // Caso contrario, avanzamos
        res.status(201).json(dataMP)

    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal.'})
    }
}
// Cotizar en tiempo real
const getProveedoresComunes = async (req, res) => {
  try {
    const { materiaIds } = req.body; // ej: [6, 7, 10]
    if (!materiaIds || materiaIds.length < 1) {
      return res.status(400).json({ msg: "Debes enviar al menos 1 materia prima" });
    }

    // 1. Traer materias con precios y proveedores
    const materias = await materia.findAll({
      where: { id: { [Op.in]: materiaIds } },
      include: [{
        model: price,
        include: [ proveedor ]
      }]
    });

    if (!materias.length) {
      return res.status(404).json({ msg: "No encontramos materias primas" });
    }

    // 2. Extraer proveedores de cada materia
    const proveedoresPorMateria = materias.map(m =>
      m.prices.map(p => p.proveedorId)
    );

    // 3. Calcular intersección
    let comunes = proveedoresPorMateria[0];
    for (let i = 1; i < proveedoresPorMateria.length; i++) {
      comunes = comunes.filter(id => proveedoresPorMateria[i].includes(id));
    }

    // 4. Construir respuesta con precios
    const resultado = comunes.map(provId => {
      const prov = materias[0].prices.find(p => p.proveedorId === provId).proveedor;

      const preciosPorMateria = materias.map(m => {
        const precio = m.prices.find(p => p.proveedorId === provId);
        return {
          materiaId: m.id,
          nombreMateria: m.item,
          unidad: m.unidad,
          precio: precio ? precio.valor : null
        };
      });

      return {
        proveedor: prov,
        precios: preciosPorMateria
      };
    });

    res.status(200).json({
      proveedoresComunes: resultado,
      materiasCotizadas: materiaIds
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error en la búsqueda de proveedores comunes" });
  }
};



const getRequisicion = async (req, res) => {
    try {
        const { reqId } = req.params;
        if (!reqId) return res.status(400).json({ msg: 'Parámetro no es válido.' });

        // PASO 1, 2 y 3: Se mantienen igual. Traemos los datos en dos consultas.
        const searchReq = await requisicion.findByPk(reqId, {
            include: [{
                model: cotizacion,
                include: [{model: client},{
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

const addAllItems = async (req, res) => {
    try{
        // Recibo datos por params
        const { requisicionId } = req.params;

        const getData = await axios.get(`http://192.168.1.15:3000/api/requisicion/get/${requisicionId}`)
        .then(res => res.data.cantidades);

        if(!getData) return res.status(404).json({msg: 'nada'}); 
        getData.map(async (val, i) => {
            let body = {
                requisicionId: requisicionId,
                materiaId: val.id,
                cantidad: val.cantidad 
            }
            const send = await axios.post(`http://192.168.1.15:3000/api/requisicion/post/addMateria/req`, body)
            .then(res => {
                console.log('creo')
            })
        })

        res.status(201).json({msg: 'Exito'});
    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal.'});
    }
}

const addProductToReq = async (req, res) => {
    try{ 
        // Recibimos datos por body
        const { productoId, cantidad, requisicionId } = req.body;
        if(!productoId || !requisicionId) return res.status(400).json({msg: 'Parámetros invalidos'});
        // Caso contrario, avanzamos...
        
        const searchAwait = await itemRequisicion.findOne({
            where: {
                requisicionId,
                productoId
            }
        });
        if(searchAwait) return res.status(200).json({msg: 'Ya existe.'});

        const addItem = await itemRequisicion.create({
            requisicionId,
            productoId,
            cantidad,
            cantidadEntrega: 0,
            estado: 'pendiente'
        });

        res.status(201).json(addItem)
    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurido un error en la principal'})
    }
}

const addMateriaReq = async (req, res) => {
    try{ 
        // Recibimos datos por body
        const { materiaId, cantidad, requisicionId } = req.body;
        if(!materiaId || !requisicionId) return res.status(400).json({msg: 'Parámetros invalidos'});
        // Caso contrario, avanzamos...
        
        const searchAwait = await itemRequisicion.findOne({
            where: {
                requisicionId,
                materiumId: materiaId
            }
        });

        if(searchAwait) return res.status(200).json({msg: 'Ya existe.'});
        const addItem = await itemRequisicion.create({
            requisicionId,
            materiumId: materiaId,
            cantidad,
            cantidadEntrega: 0,
            estado: 'pendiente'
        });

        res.status(201).json(addItem)
    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurido un error en la principal'})
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

const changeStateOfReq = async (req, res) => {
    try{
        // Recibimos datos por body
        const { reqId, state} = req.body;
        // Validamos que lo datos entren correctamente
        if(!reqId || !state) return res.status(400).json({msg: 'Los parámetros no son validos'});
        // Caso contrario, avanzamos
        // Generamos la consultado para actualizar
        const updateReq = await requisicion.update({
            estado: state
        }, {
            where: {
                id: reqId
            }
        });
        // Validamos la respuesta de la actualización.
        if(!updateReq) return res.status(502).json({msg: 'No hemos logrado actualizar esto'});
        // caso contrario
        res.status(200).json({msg: 'Actualizado con éxito'})
    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal'});
    }
}

module.exports = { 
    getAllRequisiciones, // Obtener todas las requsiciones
    getRequisicion, // Obtener una requisición 
    getMultipleReq, // Multiples requisiciones
    changeStateOfReq, // Cambiar de estado la requisicións
    addProductToReq, // Agregar item a la requisición
    addMateriaReq, // Agregar materia prima a la requisición
    addAllItems, // Anexar todo
    realRequisicion, // Obtenemos la verdadera requisición
    getRealProyectosRequisicion, // Obtenemos multiples requisiciones
    getMateriaByComprar, // Obtenemos materia prima en requisición
    getProveedoresComunes, // Obtener proveedores comunes
}