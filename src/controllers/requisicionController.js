const express = require('express');
const { materia, producto, productPrice, productoCotizacion, cotizacion, serviceCotizacion, service, client, user, armado, kitCotizacion, armadoKits, areaCotizacion, armadoCotizacion, proveedor, extension, price, kit, itemKit, linea, categoria, requisicion, itemRequisicion, 
    comprasCotizacion,  ComprasCotizacionProyecto, comprasCotizacionItem, db, Op} = require('../db/db');
const { searchPrice, addPriceMt, updatePriceState,  } = require('./services/priceServices');
const { searchKit, createKitServices, addItemToKit, deleteDeleteItemOnKit, changeState } = require('./services/kitServices');
const { default: axios } = require('axios');
const { nuevaCompra, addItemToCotizacion, updateItems } = require('./services/requsicionService');
const dayjs = require('dayjs');
const { render } = require('ejs');

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
    try {
        // Recibo datos por body
        const { ids } = req.body;
        if (!ids || !ids.length) {
            return res.status(400).json({ msg: 'Parámetro inválido' });
        }

        const multiReq = await requisicion.findAll({
            where: { id: { [Op.in]: ids } },
            include: [
                {
                    model: cotizacion,
                    include: [{ model: client }]
                },
                {
                    model: itemRequisicion,
                    include: [
                        {
                            model: materia,
                            include: [{
                                model: price,
                                where: { state: 'active' }
                            }]
                        },
                        {
                            model: producto,
                            include: [{
                                model: productPrice,
                                where: { state: 'active' }
                            }]
                        }
                    ]
                }
            ]
        });

        if (!multiReq.length) {
            return res.status(404).json({ msg: 'No encontramos requisiciones con esos IDs' });
        }

        const consolidado = {};
        const plainReqs = multiReq.map(r => r.toJSON());

        plainReqs.forEach(req => {
            req.itemRequisicions.forEach(item => {
                if (item.materium) {
                    // Consolidado de materias
                    const matId = `mat-${item.materium.id}`;
                    if (!consolidado[matId]) {
                        consolidado[matId] = {
                            tipo: 'materia',
                            id: item.materium.id,
                            nombre: item.materium.description,
                            medida: item.materium.medida,
                            unidad: item.materium.unidad,
                            precios: item.materium.prices,
                            entregado: 0,
                            totalCantidad: 0
                        };
                    }
                    consolidado[matId].totalCantidad += Number(item.cantidad);
                    consolidado[matId].entregado += Number(item.cantidadEntrega);
                }

                if (item.producto) {
                    // Consolidado de productos
                    const prodId = `prod-${item.producto.id}`;
                    if (!consolidado[prodId]) {
                        consolidado[prodId] = {
                            tipo: 'producto',
                            id: item.producto.id,
                            nombre: item.producto.item,
                            medida: item.producto.medida,
                            unidad: item.producto.unidad,
                            precios: item.producto.productPrices,
                            entregado: 0,
                            totalCantidad: 0
                        };
                    }
                    consolidado[prodId].totalCantidad += Number(item.cantidad);
                    consolidado[prodId].entregado += Number(item.cantidadEntrega);
                }
            });
        });

        // Lo devolvemos como array
        const resultado = Object.values(consolidado);

        let result = {
            proyectos: multiReq,
            consolidado: resultado,
            totalRequisiciones: multiReq.length
        };

        res.status(200).json(result);

    } catch (err) {
        console.log(err);
        res.status(500).json({ msg: 'Ha ocurrido un error en la principal' });
    }
};


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
                where: {
                    state: 'active'
                },
                include:[{
                    model: proveedor,
                    include:[{
                        model: price, 
                        where: {
                            state: 'active',
                            materiumId: mpId
                        },
                        required:true
                    },{  
                        model: comprasCotizacion,
                        where: {
                            estadoPago: null
                        },
                        required: false 
                    }]
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

const getProductosByComprar =  async (req, res) => {
    try{
        // Recibo la materia prima por ID y los proyectos que puedan venir
        const { mpId, ids } = req.body;
        // Validamos entrada
        if(!mpId || !ids) return res.status(400).json({msg: 'Los parámetros no son validos.'});
        // Caso contrario, avanzamos...

        const dataMP = await producto.findByPk(mpId, {
            include:[{
                model: itemRequisicion,
                where: { requisicionId: { [Op.in]: ids } },
                include: [ {model: requisicion}]
            }, {
                model: productPrice,
                where: {
                    state: 'active'
                },
                include:[{
                    model: proveedor,
                    include:[{
                        model: productPrice, 
                        where: {
                            state: 'active',
                            productoId: mpId
                        },
                        required:true
                    }, {  
                        model: comprasCotizacion,
                        where: {
                            estadoPago: null
                        },
                        required: false 
                    }]
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
        where: {
            state: 'active'
        },
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
          nombreMateria: m.description,
          materia: m,
          unidad: m.unidad,
          precio: precio ? precio.valor : null
        };
      });

      return {
        proveedor: prov,
        materias: preciosPorMateria
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

const getProveedoresComunesPT = async (req, res) => {
  try {
    const { materiaIds } = req.body; // ej: [6, 7, 10]
    if (!materiaIds || materiaIds.length < 1) {
      return res.status(400).json({ msg: "Debes enviar al menos 1 materia prima" });
    }

    // 1. Traer materias con precios y proveedores
    const materias = await producto.findAll({
      where: { id: { [Op.in]: materiaIds } },
      include: [{
        model: productPrice,
        where: {
            state: 'active'
        },
        include: [ proveedor ]
      }]
    });

    if (!materias.length) {
      return res.status(404).json({ msg: "No encontramos materias primas" });
    }

    // 2. Extraer proveedores de cada materia
    const proveedoresPorMateria = materias.map(m =>
      m.productPrices.map(p => p.proveedorId)
    );

    // 3. Calcular intersección
    let comunes = proveedoresPorMateria[0];
    for (let i = 1; i < proveedoresPorMateria.length; i++) {
      comunes = comunes.filter(id => proveedoresPorMateria[i].includes(id));
    }

    // 4. Construir respuesta con precios
    const resultado = comunes.map(provId => {
      const prov = materias[0].productPrices.find(p => p.proveedorId === provId).proveedor;

      const preciosPorMateria = materias.map(m => {
        const precio = m.productPrices.find(p => p.proveedorId === provId);
        return {
            tipo: 'producto',
            materiaId: m.id,
            nombreMateria: m.description,
            materia: m,
            unidad: m.unidad,
            precio: precio ? precio.valor : null
        };
      });

      return {
        tipo: 'producto',
        proveedor: prov,
        materias: preciosPorMateria
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

        // Consulta principal, ahora incluyendo productoCotizacion -> producto
        const searchReq = await requisicion.findByPk(reqId, {
            include: [{
                model: cotizacion,
                include: [
                    { model: client },
                    {
                        model: areaCotizacion,
                        include: [
                            { model: kit, through: { attributes: ['cantidad', 'precio'] } },
                            {
                                model: armado,
                                through: { attributes: ['cantidad', 'precio'] },
                                include: [
                                    { model: kit, as: 'kits', through: { attributes: ['cantidad'] } }
                                ]
                            },
                            { 
                                model: productoCotizacion, // 👈 aquí
                                include: [ producto ]     // 👈 traemos el producto asociado
                            }
                        ]
                    }
                ]
            }]
        });

        if (!searchReq) {
            return res.status(404).json({ msg: 'No hemos encontrado esta requisición' });
        }

        const kitIds = new Set();
        const kitDataMap = new Map();
        searchReq.cotizacion.areaCotizacions.forEach(area => {
            area.kits.forEach(k => { 
                kitIds.add(k.id); 
                kitDataMap.set(k.id, k.kitCotizacion); 
            });
            area.armados.forEach(a => 
                a.kits.forEach(k => { 
                    kitIds.add(k.id); 
                    kitDataMap.set(k.id, k.armadoKits); 
                })
            );
        });

        const kitsConMateria = await kit.findAll({
            where: { id: [...kitIds] },
            include: [{ model: itemKit, include: [materia] }]
        });

        const totalMateriaPrima = {};
        const totalKits = {};
        const totalProductos = {}; // 👈 consolidado de productos

        // Recorremos las áreas
        searchReq.cotizacion.areaCotizacions.forEach(area => {
            // --- Consolidar Kits ---
            area.kits.forEach(kitEnCoti => {
                const cantidadKitEnCoti = kitEnCoti.kitCotizacion?.cantidad || 0;

                const kitId = kitEnCoti.id;
                if (!totalKits[kitId]) {
                    totalKits[kitId] = { id: kitId, nombre: kitEnCoti.name, cantidad: 0 };
                }
                totalKits[kitId].cantidad += cantidadKitEnCoti;

                const kitDetallado = kitsConMateria.find(k => k.id === kitEnCoti.id);
                if (kitDetallado && kitDetallado.itemKits) {
                    kitDetallado.itemKits.forEach(item => {
                        const key = `${item.materium.id}`;
                        const cantidadTotal = Number(item.medida) * Number(cantidadKitEnCoti);

                        if (!totalMateriaPrima[key]) {
                            totalMateriaPrima[key] = { 
                                id: item.materium.id,
                                cguno: item.materium.item,
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

            // --- Consolidar Armados ---
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
                                totalMateriaPrima[key] = { 
                                    id: item.materium.id,
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

            // --- Consolidar Productos ---
            if (area.productoCotizacions && area.productoCotizacions.length > 0) {
                area.productoCotizacions.forEach(pc => {
                    const cantidadProd = pc.cantidad || 0; // viene del through productoCotizacion
                    const prod = pc.producto; // relación al producto
                    if (!prod) return;

                    const key = `${prod.id}`;
                    if (!totalProductos[key]) {
                        totalProductos[key] = {
                            id: prod.id,
                            nombre: prod.item,
                            unidad: prod.unidad,
                            cantidad: 0
                        };
                    }
                    totalProductos[key].cantidad += Number(cantidadProd);
                });
            }
        });

        res.status(200).json({
            requisicion: searchReq,
            cantidades: Object.values(totalMateriaPrima),
            resumenKits: Object.values(totalKits),
            resumenProductos: Object.values(totalProductos)
        });

    } catch (err) {
        console.log(err);
        res.status(500).json({ msg: 'Ha ocurrido un error en la principal.' });
    }
};


const addAllItems = async (req, res) => {
    try {
        const { requisicionId } = req.params;

        const getData = await axios.get(`https://unionapi-production.up.railway.app/api/requisicion/get/${requisicionId}`)
        .then((res) => {
            console.log(res.data);
            return res;
        })
        .then(res => res.data);

        if (!getData) return res.status(404).json({ msg: 'nada' });
        // Crear items materia Prima
        await Promise.all(
            getData.cantidades.map(val => {
                let unidad = val.unidad;
                let consumo = Number(val.cantidad);

                let original = 0;
                if (unidad !== 'mt2') {
                    original = Number(val.medidaOriginal);
                }

                let productoLados = 0;
                if (unidad === 'mt2') {
                    const [ladoA, ladoB] = val.medidaOriginal.split('X').map(Number);
                    if (!isNaN(ladoA) && !isNaN(ladoB)) {
                        productoLados = ladoA * ladoB;
                    }
                }

                let comprometer = 1;
                if ((unidad === 'kg' || unidad === 'mt' || unidad === 'unidad') && original > 0) {
                    comprometer = consumo / original;
                } else if (unidad === 'mt2' && productoLados > 0) {
                    comprometer = consumo / productoLados;
                }



                let body = {
                    requisicionId,
                    materiaId: val.id,
                    cantidad: comprometer
                };
                return axios.post(`https://unionapi-production.up.railway.app/api/requisicion/post/addMateria/req`, body)
            })
        );

        // Crear items Productos
        await Promise.all(
            getData.resumenProductos.map(val => {
                let unidad = val.unidad;
                let consumo = Number(val.cantidad);

                let body = {
                    requisicionId,
                    productoId: val.id,
                    cantidad: consumo
                };
                return axios.post(`https://unionapi-production.up.railway.app/api/requisicion/post/addItem/req`, body)
            })
        );
        res.status(201).json({ msg: 'Éxito' });

    } catch (err) {
        console.log(err);
        res.status(500).json({ msg: 'Ha ocurrido un error en la principal.' });
    }
};

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
            cantidad: cantidad,
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
                                totalMateriaPrima[key] = { id: item.materium.id, cguno: item.materium.item,nombre: item.materium.description, medidaOriginal: item.materium.medida, unidad: item.materium.unidad, cantidad: 0 };
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


// COMPRAS Y SUS COTIZACIONES
const newCotizacionProvider = async (req, res) => {
    try{
        // Recibimos datos por body
        const { name, description, fecha, proveedor, proyecto } = req.body;
        // Validamos
        if(!name || !description || !fecha || !proveedor || !proyecto) return res.status(400).json({msg: 'Parámetros no son validos.'});
        // Caso contrario, avanzamos
        
        // Buscamos primero, que no exista una cotización con ese nombre y ese proyecto
        const searchCotizacion = await comprasCotizacion.findOne({
            where: {
                name,
                proveedorId: proveedor
            },
            include: [{
                model: requisicion,
                as: 'requisiciones',
                through: {
                where: { requisicionId: proyecto }
                },
                required: true
            }]
        });

        if(searchCotizacion) return res.status(200).json({msg: 'Ya existe una cotización con este nombre'});

        // Caso contrario, avanzamos...
        const addNuevo = await nuevaCompra(req.body);

        if(!addNuevo) return res.status(501).json({msg: 'No hemos logrado crear esto.'});
        // Caso contrario, avanzamos...
        res.status(201).json(addNuevo);

    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal'});
    }
}

const changeToCompras = async (req, res) => {
    try{
        const { comprasCotizacionId } = req.params;

        if(!comprasCotizacionId) return res.status(400).json({msg: 'Parámetro invalido'});
        const hoy = dayjs();
        // Caso contrario, avanzamos...
        const searchData = await comprasCotizacion.findOne({
            where: {
                id: comprasCotizacionId,
            }
        });

        if(!searchData) return res.status(404).json({msg: 'No hemos encotrado esto.'});
        // Caso contrario, actualizamos 
        const updateData = await comprasCotizacion.update({
            estadoPago: 'compras',
            dayCompras: hoy.format('YYYY-MM-DD')
        }, {
            where: {
                id: comprasCotizacionId
            }
        }).then(async (result) => {
            const updateItemsCotizacions = await comprasCotizacionItem.update({
                estado: 'enProceso',
            }, {
                where: {
                    comprasCotizacionId
                }
            })

            return result;
        })

        if(!updateData) return res.status(501).json({msg: 'No hemos logrado actualizar esto'});
        // Caso contrario, avanzamos
        res.status(200).json({msg: 'Actualizado...'});
    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal'})
    }
}

// Actualizar a comprado
const changeToComprasToComprado = async (req, res) => {
    try{
        const { comprasCotizacionId } = req.params;

        if(!comprasCotizacionId) return res.status(400).json({msg: 'Parámetro invalido'});
        const hoy = dayjs();
        // Caso contrario, avanzamos...
        const searchData = await comprasCotizacion.findOne({
            where: {
                id: comprasCotizacionId,
            },
            include:[{
                model: comprasCotizacionItem
            }]
        });

        if(!searchData) return res.status(404).json({msg: 'No hemos encotrado esto.'});
        // Caso contrario, actualizamos 
        const updateData = await comprasCotizacion.update({
            estadoPago: 'comprado',
            daysFinish: hoy.format('YYY-MM-DD')
        }, {
            where: {
                id: comprasCotizacionId
            }
        }).then(async (result) => {
            const updateItemsCotizacions = await comprasCotizacionItem.update({
                estado: 'aprobado',
            }, {
                where: {
                    comprasCotizacionId
                }
            })

            return result;
        })

        if(!updateData) return res.status(501).json({msg: 'No hemos logrado actualizar esto'});
        await updateItems(comprasCotizacionId)


        // 🔹 NUEVO: actualizar requisiciones relacionadas
        const requisicionIds = [
            ...new Set(
                searchData.comprasCotizacionItems.map((it) => it.requisicionId)
            ),
        ];

        for (const reqId of requisicionIds) {
            // Todos los items de esa requisición
            const allItems = await itemRequisicion.findAll({
                where: { requisicionId: reqId },
            });

            const total = allItems.length;
            const comprados = allItems.filter(
                (it) => it.estado === "aprobado"
            ).length;

            let nuevoEstado = "pendiente";
            if (comprados === 0) {
                nuevoEstado = "pendiente";
            } else if (comprados < total) {
                nuevoEstado = "parcialmente";
            } else if (comprados === total) {
                nuevoEstado = "comprado";
            } 
 
            await requisicion.update(
                { estado: nuevoEstado },
                { where: { id: reqId } }
            );
        }
        // Caso contrario, avanzamos
        res.status(200).json({msg: 'Actualizado...'});
    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal'})
    }
}


// OBTENEMOS TODAS LAS ORDENES DE COMPRAS
const getAllOrdenesCompras = async (req, res) => {
    try{
        // Realizamos peticion
        const searchAll = await comprasCotizacion.findAll({
            where: {
                estadoPago: 'compras'
            },
            include:[{
                model: requisicion,
                as: 'requisiciones',
                through: { attributes: [] }
            },{
                model: comprasCotizacionItem,
                include:[{
                    model: requisicion
                }]
            }]
        });
        // Validamos la respuesta
        if(!searchAll || !searchAll.length) return res.status(404).json({msg: 'No hemos encontrado esto'});
        // Caso contrario, enviamos respuesta
        res.status(200).json(searchAll)
    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal'})
    }
}
// OBTENEMOS ORDEN DE COMPRA
const getOrdenDeCompra = async (req, res) => {
    try{
        // Recibo dato por params
        const { ordenId } = req.params;
        // Validamos
        if(!ordenId) return res.status(400).json({msg: 'El parámetro no es valido'});
        // Caso contrario avanzamos

        const searchOrden = await comprasCotizacion.findByPk(ordenId,{
            include:[{model:proveedor},{
                model: comprasCotizacionItem,
                include:[{
                    model: materia
                }, {
                    model: producto
                }]
            },{
                model: requisicion,
                as: 'requisiciones',
                through: { attributes: [] }
            } ]
        });

        if(!searchOrden) return res.status(404).json({msg: 'No hemos encontrado esto'});
        // Caso contrario, avanzamos
        res.status(200).json(searchOrden);
        
    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal'})
    }
}
// Obtenemos orden de compra en inventario
const getOrdenDeCompraAlmacen = async (req, res) => {
    try{
        // Recibo dato por params
        const { ordenId } = req.params;
        // Validamos
        if(!ordenId) return res.status(400).json({msg: 'El parámetro no es valido'});
        // Caso contrario avanzamos

        const searchOrden = await comprasCotizacion.findByPk(ordenId,{
            where: {
                estadoPago: 'comprado'
            },
            include:[{
                model:proveedor
            },{
                model: comprasCotizacionItem,
                include:[{
                    model: requisicion
                }, {
                    model: materia
                }, {
                    model: producto
                }]
            },{
                model: requisicion,
                as: 'requisiciones',
                through: { attributes: [] }
            } ]
        });

        if(!searchOrden) return res.status(404).json({msg: 'No hemos encontrado esto'});
        // Caso contrario, avanzamos
        res.status(200).json(searchOrden);
        
    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal'})
    }
}

// Agregar item a una cotización
const addItemToCotizacionProvider = async (req, res) => {
    try{
        // Recibimos datos por body
        const { cantidad, precioUnidad, precioTotal, materiaId, productoId, cotizacionId } = req.body;
        // Validamos
        if(!cantidad || !precioUnidad || !precioTotal || !cotizacionId) return res.status(400).json({msg: 'Los parámetros no son validos.'});
        // Caso contrario, avanzamos
        
        // Buscamos primero, que no exista una cotización con ese nombre y ese proyecto
        const searchItemCotizacion = await comprasCotizacionItem.findOne({
            where: {
                materiaId,
                productoId,
                comprasCotizacionId: cotizacionId
            },
        });

        if(searchItemCotizacion) return res.status(200).json({msg: 'Ya existe una cotización con este item'});

        // Caso contrario, avanzamos...
        const addItemCotizacion = await addItemToCotizacion(req.body);

        if(!addItemCotizacion) return res.status(501).json({msg: 'No hemos logrado crear esto.'});
        // Caso contrario, avanzamos...
        res.status(201).json(addItemCotizacion);

    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal'});
    }
}

// Crear función, que me reciba varias cotizaciones con sus respectivos elementos dentros
const addSomeMuchCotizacionsProvider = async (req, res) => {
    try{
        // Recibimos datos por body
        /* 
            DESCRIBIMOS LA ESTRUCTURA QUE NOS DEBE LLEGAR 
            [
                {
                    ProveedorId: 1,
                    nombreCotizacion: 'Acá el nombre de la cotización'
                    description: 'Una descripción de la cotización',
                    proyectos: [1,2,3],
                    items: [
                        {
                            materiaPrimaId: 1,
                            productoId: null,
                            precioUnidad: '10000',
                            precioTotal: '50000',
                            cantidad: 5,
                            cotizacionId: Proviene del mapeo ,
                            requisicionId:1 
                        },
                        {
                            materiaPrimaId: 1,
                            productoId: null,
                            precioUnidad: '10000',
                            precioTotal: '40000',
                            cantidad: 4,
                            cotizacionId: Proviene del mapeo ,
                            requisicionId:2 
                        }

                    ]
                }
            ]
        */
        const { datos } = req.body;
        // Validamos que los datos entren
        if(!datos) return res.status(400).json({msg: 'El parámetro no es valido.'});
        // Caso contrario, avanzamos
        let time = dayjs()
        datos.map(async( data) => {
            
            let body = {
                name: data.name,
                description: data.description,
                fecha: time.format("YYYY-MM-DD"),
                proyectos: data.proyectos,
                proveedor: data.proveedorId
            }
            const send = await nuevaCompra(body)
            .then(async (res) => {
                data.items.map(async (item) => {
                    let body = {
                        cantidad: item.cantidad,
                        requisicion: item.requisicion,
                        precioUnidad: item.precioUnidad,
                        precioTotal: item.precioTotal,
                        materiaId: item.materiaId,
                        productoId: item.productoId,
                        cotizacionId: res.id
                    }
                    const addItem = await addItemToCotizacion(body)
                })
            })
        })

        res.status(201).json({msg: 'Misión cumplida'})
    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal'});
    }
}

// Obtener tasa de aprobación de proveedores sobre una materia prima
const getProveedoresStats = async (req, res) => {
  try {
    const { materiumId, proveedores } = req.body;

    if (!materiumId || !proveedores?.length) {
      return res.status(400).json({ msg: "Debes enviar materiumId y un array de proveedores." });
    }

    // 1. Últimos precios de esa materia por proveedor
    const precios = await price.findAll({
      where: {
        materiumId,
        proveedorId: { [Op.in]: proveedores }
      },
      include: [
        { model: proveedor, include:[{
            model: price,
            where: {
                state: 'active',
                materiumId: materiumId
            }
        }] }, // 🔹 Devuelve objeto completo
        { model: materia }    // 🔹 Devuelve objeto completo
      ],
      order: [["createdAt", "DESC"]]
    });

    // Evitar repetidos → solo último precio por proveedor
    const vistos = new Set();
    const proveedoresData = [];

    for (const pr of precios) {
      if (!vistos.has(pr.proveedorId)) {
        vistos.add(pr.proveedorId);

        // 2. Buscar comprasCotizacion asociadas a ese proveedor
        const cotizaciones = await comprasCotizacion.findAll({
          where: { proveedorId: pr.proveedorId },
          include: [
            { model: requisicion, as:'requisiciones'} // 🔹 Devuelve objeto completo
          ]
        });

        const totalCotizaciones = cotizaciones.length;
        const aprobadas = cotizaciones.filter(cc => cc.requisicion?.estado === "compras").length;

        proveedoresData.push({
          proveedor: pr.proveedor,              // Objeto completo del proveedor
          materia: pr.materia,                  // Objeto completo de la materia
          precioActual: pr.precio,              // Último precio cargado
          totalCotizaciones,                    // Todas las comprasCotizacion creadas
          aprobadas,                            // De esas, cuántas en estado "compras"
          tasaAprobacion: totalCotizaciones > 0 
            ? (aprobadas / totalCotizaciones) * 100 
            : 0
        });
      }
    }


    return res.json(proveedoresData);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Error al obtener estadísticas de proveedores" });
  }
};


// Obtener tasa de aprobación de proveedores sobre una materia prima
const getProveedoresStatsProductos = async (req, res) => {
  try {
    const { productoId, proveedores } = req.body;

    if (!productoId || !proveedores?.length) {
      return res.status(400).json({ msg: "Debes enviar materiumId y un array de proveedores." });
    }

    // 1. Últimos precios de esa materia por proveedor
    const precios = await productPrice.findAll({
      where: {
        productoId,
        proveedorId: { [Op.in]: proveedores }
      },
      include: [
        { model: proveedor, include:[{
            model: productPrice,
            where: {
                state: 'active',
                productoId: productoId
            }
        }] }, // 🔹 Devuelve objeto completo
        { model: producto }    // 🔹 Devuelve objeto completo
      ],
      order: [["createdAt", "DESC"]]
    });

    // Evitar repetidos → solo último precio por proveedor
    const vistos = new Set();
    const proveedoresData = [];

    for (const pr of precios) {
      if (!vistos.has(pr.proveedorId)) {
        vistos.add(pr.proveedorId);

        // 2. Buscar comprasCotizacion asociadas a ese proveedor
        const cotizaciones = await comprasCotizacion.findAll({
          where: { proveedorId: pr.proveedorId },
          include: [
            { model: requisicion, as:'requisiciones'} // 🔹 Devuelve objeto completo
          ]
        });

        const totalCotizaciones = cotizaciones.length;
        const aprobadas = cotizaciones.filter(cc => cc.requisicion?.estado === "compras").length;

        proveedoresData.push({
          proveedor: pr.proveedor,              // Objeto completo del proveedor
          materia: pr.materia,                  // Objeto completo de la materia
          precioActual: pr.precio,              // Último precio cargado
          totalCotizaciones,                    // Todas las comprasCotizacion creadas
          aprobadas,                            // De esas, cuántas en estado "compras"
          tasaAprobacion: totalCotizaciones > 0 
            ? (aprobadas / totalCotizaciones) * 100 
            : 0
        });
      }
    }


    return res.json(proveedoresData);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Error al obtener estadísticas de proveedores" });
  }
};

// Creamos la función para ingresar item a una cotización
const addItemToCotizacionController = async(req, res) => {
    try{
        // Recibimos datos del item y la cotizacion
        const { cantidad, requisicion, precioUnidad, precioTotal, materiaId, productoId, cotizacionId } = req.body;
        // Validamos
        if(!cantidad || !requisicion || !precioUnidad || !precioTotal || !materiaId || !productoId || !cotizacionId) return res.status(400).json({msg: 'Ha ocurrido un error en la principal.'});
        // Caso contrario, avanzamos

        const addItem = await addItemToCotizacion(body);
        res.status(201).json({msg: 'Misión cumplida'})
        // Avazamos
    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'ha Ocurrido un error en la principal'}) 
    }
}

// CHATGPT agregamos función para anexar items a cotización
// POST /api/requisicion/post/cotizacion/add-items
const addItemsToCotizacion = async (req, res) => {
  try {
    const { cotizacionId, proyectos, items } = req.body;

    if (!cotizacionId || !items?.length) {
      return res.status(400).json({ msg: "Faltan datos obligatorios" });
    }

    // 🔹 Insertar cada item en CotizacionItems
    for (const it of items) {
      let a = await comprasCotizacionItem.create({
        cantidad: it.cantidad,
        precioUnidad: it.precioUnidad,
        precioTotal: it.precioTotal,
        estado: 'pendiente',
        materiumId: it.materiaId,
        materiaId: it.materiaId,
        productoId: it.productoId,
        requisicionId: it.requisicion,
        comprasCotizacionId: cotizacionId
      });
        console.log(a)

    }

    // 🔹 Si también necesitas guardar proyectos relacionados:
    if (proyectos?.length) {
      for (const proyectoId of proyectos) {
        await ComprasCotizacionProyecto.findOrCreate({
          where: { comprasCotizacionId: cotizacionId, requisicionId: proyectoId }
        });
      } 
    }
    res.status(201).json({ msg: "Items agregados correctamente" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error al agregar items" });
  }
};

const deleteItemOnCotizacion = async(req, res) => {
    try{
        // Recibimos por params
        const { comprasCotizacionItemId } = req.params;
        if(!comprasCotizacionItemId) return res.status(400).json({msg: 'Parámetro no es valido.'});
        // Caso contrario, avanzamos
        console.log('acá llega')
        const remove = await comprasCotizacionItem.destroy({
            where: {
                id: comprasCotizacionItemId
            }
        })
        .then((res) => {
            console.log(res);
            return true
        })
        .catch(err => null)

        if(!remove) return res.status(502).json({msg: 'No hemos logrado eliminar esto.'});
        // Caso contrario, avanzamos
        res.status(200).json({msg: 'Eliminado'});
        
    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'ha ocurrido un error en la principal.'});
    }
}

// Obtenemos todas las cotizaciones relacionadas con los proyectos
const getAllCotizacionsCompras = async (req, res) => {
    try{
        // Recibimos datos por body
        const { proyectos } = req.body;
        if(!proyectos || !proyectos.length) return res.status(400).json({msg: 'Los parámetros no son validos.'});
        // Caso contrario, avanzamos...
        const searchAllCotizacions = await comprasCotizacion.findAll({
            include:[{
                model: requisicion,
                as: 'requisiciones',
                where: {
                    id: { [Op.in]: proyectos }   // <-- filtramos las requisiciones relacionadas
                },
                through: { attributes: [] }     // oculta columnas de la tabla pivote
            },{
                model: proveedor
            }] 
        })  

        if(!searchAllCotizacions) return res.status(404).json({msg: 'No hay resutlados'});
        // Caso contrario
        res.status(200).json(searchAllCotizacions)
    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal.'});
    }
} 
const getCotizacionCompras = async (req, res) => {
    try{
        // Recibo dato por params
        const{ comprasCotizacionId } = req.params;
        // Validamos
        if(!comprasCotizacionId) return res.status(400).json({msg: 'Parámetro no valido.'});
        // Caso contrario, avanzamos...
        const searchCoti = await comprasCotizacion.findByPk(comprasCotizacionId, {
            include:[{
                    model: proveedor
                },{  
                model: comprasCotizacionItem,
                include:[{
                    model: requisicion,
                    include:[{
                        model: itemRequisicion,
                    },]
                }, { model: materia }, { model: producto}]
            }, {
                model: proveedor
            }]
        });

        if(!searchCoti) return res.status(404).json({msg: 'No hay resultados'});
        // Caso contrario, avanzamos
        res.status(200).json(searchCoti)
    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal.'});
    }
}

// Obtenemos las ordenes de compra para recibir en almacen
const getAllCotizacionsComprasAlmacen = async (req, res) => {
    try{
        // Recibimos datos por body
        // Caso contrario, avanzamos...
        const searchAllCotizacions = await comprasCotizacion.findAll({
            where: {
                estadoPago: 'comprado'
            },
            include:[{
                model: requisicion,
                as: 'requisiciones',
                through: { attributes: [] }     // oculta columnas de la tabla pivote
            },{
                model: proveedor
            }] 
        })  

        if(!searchAllCotizacions) return res.status(404).json({msg: 'No hay resutlados'});
        // Caso contrario
        res.status(200).json(searchAllCotizacions)
    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal.'});
    }
} 

const changeItemCotizacionCompras = async (req, res) => {
    try{
        // Recibo dato por params
        const { itemId } = req.params;
        // Validamos
        if(!itemId) return res.status(400).json({msg: 'No hemos encontrado esto'});
        // Caso contrario, avanzamos
        const searchItem = await comprasCotizacionItem.findByPk(itemId, {
            include:[{model: comprasCotizacion},{
                model: requisicion
            }]   
        });

        if(!searchItem) return res.status(404).json({msg: 'No encontrado'})
        searchItem.estado = 'Entregado';
        searchItem.save()

        const searchOtherItems = await comprasCotizacionItem.findAll({
            where: {
                estado: 'aprobado',
                comprasCotizacionId: searchItem.comprasCotizacionId
            }
        }) ;

        if(!searchOtherItems){
            const updateReq = await comprasCotizacion.update({
                estado: 'entregado'
            },{                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     
                where: {
                    id: searchItem.comprasCotizacionId
                }
            })
            return res.status(200).json({msg: 'Exito'})

        }else{
            return res.status(200).json({msg: 'Exito'})
        }
    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal'})
    }
}

// Obtenemos datos de proyecto
const getDataProject = async (req, res) => {
    try{
        // Buscamos por params
        const { projectId } = req.params;
        // Validamos
        if(!projectId) return res.status(400).json({msg: 'Parámetro no es valido'});
        // Caso contrario, avanzamos
        const searchReq = await requisicion.findByPk(projectId, 
            {
                include: [{
                    model: cotizacion,
                    include:[{
                        model: areaCotizacion,
                        include:[
                            // 1. Mantenemos la relación belongsToMany para 'kit' como la tenías
                            { 
                                model: kit, // 1. Incluimos el modelo que tiene el precio y los datos de la cotización.
                                attributes: ['id', 'name', 'description', 'state'], // Trae solo los campos que necesites del kit
                                include:[{
                                    model: extension
                                }]
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
                    }, {model: client}]
                }, {
                    model: comprasCotizacionItem,
                    include: [{model: materia}, {model: producto},{
                        model: comprasCotizacion,
                        include:[{
                            model: proveedor
                        }]
                    }]
                }]
            }
        )

        if(!searchReq) return res.status(404).json({msg: 'no hemos encontrado esto'});
        // Caso contrario, avanzamos
        res.status(200).json(searchReq)
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
    getProductosByComprar, // Obtenemos productos de esa requisición
    getProveedoresComunes, // Obtener proveedores comunes
    getProveedoresComunesPT, // Obtener proveedores comunes

    // COMPRAS
    newCotizacionProvider, // Nueva contización a un proveedor
    addItemToCotizacionProvider, // añadir item a una cotización
    addItemToCotizacionController, // Añadir item a una cotización especifica desde afuera.
    addSomeMuchCotizacionsProvider, // Crear cotizaciones necesarias con sus itemComprasCotizaciones
    getAllCotizacionsCompras, // Obtenemos cotizaciones por proyectos
    getCotizacionCompras, // Obtenemos cotizacion puntual
    changeToCompras, // Cambiamos de estado la cotización
    changeToComprasToComprado, // Actualizar a comprado
    getAllOrdenesCompras, // Obtenemos todas las ordenes de compra.
    getOrdenDeCompra, // Obtenemos orden de compra por params ID
    getOrdenDeCompraAlmacen, // Obtenemos orden de compra en almacen
    getAllCotizacionsComprasAlmacen, // Obtenemos ordenes de compra almacén
    changeItemCotizacionCompras, // Actualizar item u orden de compra

    getProveedoresStats, // Ver proveedores by Materia prima Data
    getProveedoresStatsProductos, // Ver proveedores By Productos Data
    addItemsToCotizacion, // Anexar item to cotización lado...
    deleteItemOnCotizacion, // Eliminar comprasItemCotizacion
    getDataProject, // Obtenemos detalles del projecto
}