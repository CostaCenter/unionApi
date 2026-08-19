const dayjs = require('dayjs');
const { cotizacion, kit, armado, productoCotizacion, producto, itemKit, materia, client, areaCotizacion,  requisicion, comprasCotizacion,  ComprasCotizacionProyecto, 
    comprasCotizacionItem, itemRequisicion, itemToProject, necesidadProyecto, Op
} = require('../../db/db');

// Crear requsición
const createRequisicion = async(nombre, fecha, para, cotizacionId) => {
    // Validamos la entrada de los parámetros.
    if(!cotizacionId || !nombre) return 501;
    // Caso contrario, enviamos
    const newReq = await requisicion.create({
        nombre, fecha,
        estado: 'pendiente',
        fechaNecesaria: para,
        cotizacionId
    }).catch(err => {
        console.log(err);
        return null;
    });

    // Validamos la respuesta
    if(!newReq) return 502
    // Caso contrario. Enviamos respuesta completa
    return newReq;
}

//


const getRequisicionDetallada = async (reqId) => {
    // 1. Consulta a la Base de Datos (Exactamente tu lógica de Sequelize)
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
                            include: [{ model: kit, as: 'kits', through: { attributes: ['cantidad'] } }]
                        },
                        { 
                            model: productoCotizacion, 
                            include: [ producto ] 
                        }
                    ]
                }
            ]
        }]
    });

    if (!searchReq) return null;

    // 2. Recolección de IDs para Kits (Lógica de Sets)
    const kitIds = new Set();
    searchReq.cotizacion.areaCotizacions.forEach(area => {
        area.kits.forEach(k => kitIds.add(k.id));
        area.armados.forEach(a => a.kits.forEach(k => kitIds.add(k.id)));
    });

    const kitsConMateria = await kit.findAll({
        where: { id: [...kitIds] },
        include: [{ model: itemKit, include: [materia] }]
    });

    // 3. Consolidación de Totales
    const totalMateriaPrima = {};
    const totalKits = {};
    const totalProductos = {};

    searchReq.cotizacion.areaCotizacions.forEach(area => {
        // --- Kits ---
        area.kits.forEach(kitEnCoti => {
            // kitCotizacion.cantidad es DataTypes.STRING en el modelo → convertir a Number
            const cantidadKitEnCoti = Number(kitEnCoti.kitCotizacion?.cantidad) || 0;
            const kitId = kitEnCoti.id;

            if (!totalKits[kitId]) {
                totalKits[kitId] = { id: kitId, nombre: kitEnCoti.name, cantidad: 0 };
            }
            totalKits[kitId].cantidad += cantidadKitEnCoti;

            const kitDetallado = kitsConMateria.find(k => k.id === kitId);
            if (kitDetallado?.itemKits) {
                kitDetallado.itemKits.forEach(item => {
                    const key = `${item.materium.id}`;
                    const cantidadTotal = Number(item.medida) * Number(cantidadKitEnCoti);

                    const medidaTrabajada = item.materium.unidad == 'mt2' ? item.materium.medida
                    .split('X')
                    .map(v => parseFloat(v))
                    .reduce((a, b) => a * b, 1) : item.materium.medida;
                    if (!totalMateriaPrima[key]) {
                        totalMateriaPrima[key] = { 
                            id: item.calibre || item.materium.id,
                            cguno: item.materium.item,
                            nombre: item.materium.description, 
                            unidad: item.materium.unidad, 
                            cantidad: 0,
                            medida:  medidaTrabajada
                        };
                    }
                    totalMateriaPrima[key].cantidad += cantidadTotal;
                });
            }
        });

        // --- Armados ---
        area.armados.forEach(armadoEnCoti => {
            const cantidadArmadoEnCoti = armadoEnCoti.armadoCotizacion?.cantidad || 0;
            armadoEnCoti.kits.forEach(kitEnArmado => {
                const cantidadKitEnArmado = kitEnArmado.armadoKits?.cantidad || 0;
                const kitDetallado = kitsConMateria.find(k => k.id === kitEnArmado.id);

                if (kitDetallado?.itemKits) {
                    kitDetallado.itemKits.forEach(item => {
                        const key = `${item.materium.id}`;
                        const cantidadTotal = Number(item.medida) * Number(cantidadKitEnArmado) * Number(cantidadArmadoEnCoti);
                        if (!totalMateriaPrima[key]) {
                            totalMateriaPrima[key] = { 
                                id: item.materium.id,
                                nombre: item.materium.description, 
                                unidad: item.materium.unidad, 
                                cantidad: 0 ,
                                medida: item.medida
                            };
                        }
                        totalMateriaPrima[key].cantidad += cantidadTotal;
                    });
                }
            });
        });

        // --- Productos ---
        if (area.productoCotizacions?.length > 0) {
            // --- Productos ---
                area.productoCotizacions.forEach(pc => {
                    if (!pc.producto) return;
                
                    const consumoUnitario =
                    pc.producto.unidad === 'mt2'
                        ? pc.medida
                            ?.split('X')
                            .map(Number)
                            .reduce((a, b) => a * b, 1)
                        : Number(pc.medida || 1);
                
                    const key = `${pc.producto.id}-${pc.medida}`;
                
                    if (!totalProductos[key]) {
                    totalProductos[key] = {
                        id: pc.producto.id,
                        nombre: pc.producto.item,
                        unidad: pc.producto.unidad,
                        cantidad: 0,
                        medida: consumoUnitario
                    };
                    }
                
                    totalProductos[key].cantidad +=  Number(pc.cantidad);
                });
  
        }
    });

    return {
        requisicion: searchReq,
        cantidades: Object.values(totalMateriaPrima),
        resumenKits: Object.values(totalKits),
        resumenProductos: Object.values(totalProductos)
    };
};

// COMPRAS Y COTIZACIONES
// Generamos función para anexar necesidad al proyecto - KITS y producto terminado
// const giveNecesidadToProject = async(requisicionId, kitId, productoId, cantidad) => {

//     if(!cantidad || !requisicionId) return null;

//     const addRegistro = await necesidadProyecto.create({
//         cantidadComprometida: Number(cantidad),
//         cantidadEntrega: 0,
//         requisicionId: requisicionId,
//         kitId: kitId ? kitId : null, 
//         productoId: productoId ? productoId : null
//     })
//     return true
// }

// AGREGAR MATERIA - ITEM REQUISICIÓN
const addMateriaRequisicion = async (
        requisicionId,
        materiaId,
        cantidad,
        medida,
        t
    ) => {

    if (!materiaId || !requisicionId) {
        throw new Error('INVALID_PARAMS');
    }

    const existente = await itemRequisicion.findOne({
      where: {
        requisicionId,
        materiumId: materiaId
      },
      transaction: t
    });

    // Si ya existe, SUMAR la cantidad al registro existente
    if (existente) {
      existente.cantidad = Number(existente.cantidad) + Number(cantidad);
      await existente.save({ transaction: t });
      return {
        created: false,
        item: existente
      };
    }

    const nuevoItem = await itemRequisicion.create({
      requisicionId,
      materiumId: materiaId,
      cantidad,
      cantidadEntrega: 0,
      estado: 'pendiente',
      medida
    }, { transaction: t });

    return {
      created: true,
      item: nuevoItem
    };
};

const addProductoRequisicion = async (
    requisicionId,
    productoId,
    cantidad,
    medida = null,
    t
    ) => {
    if (!productoId || !requisicionId) {
        throw new Error('INVALID_PARAMS');
    }

    const existente = await itemRequisicion.findOne({
        where: {
            requisicionId,
            productoId
        },
        transaction: t
    });

    // Si ya existe, SUMAR la cantidad al registro existente
    if (existente) {
        existente.cantidad = Number(existente.cantidad) + Number(cantidad);
        await existente.save({ transaction: t });
        return {
            created: false,
            item: existente
        };
    }

    const nuevoItem = await itemRequisicion.create({
        requisicionId,
        productoId,
        cantidad,
        cantidadEntrega: 0,
        estado: 'pendiente',
        medida
    }, { transaction: t });

    return {
        created: true,
        item: nuevoItem
    };
};


  
  
const getNecesidadProjecto = async (requisicionId, t) => {
    // 1. Obtenemos los datos
    const data = await getRequisicionDetallada(requisicionId); 
    if (!data) return null;

    // 🔍 DEBUG: Ver qué datos llegan
    console.log('📊 [getNecesidadProjecto] CANTIDADES RECIBIDAS:', JSON.stringify(data.cantidades, null, 2));
    console.log('📊 [getNecesidadProjecto] RESUMEN PRODUCTOS:', JSON.stringify(data.resumenProductos, null, 2));
    console.log('📊 [getNecesidadProjecto] RESUMEN KITS:', data.resumenKits.length, 'kits');

    // 2. Kits → paralelo
    console.log('🔵 Procesando', data.resumenKits.length, 'kits...');
    await Promise.all(
        data.resumenKits.map(r => {
            console.log(`🔵 Kit ID: ${r.id}, Cantidad: ${r.cantidad}, Medida: ${r.medida || 'N/A'}`);
            return giveNecesidadToProject(requisicionId, r.id, null, r.cantidad, r.medida, t);
        })
    );

    // 3. Productos → secuencial
    console.log('🟢 Procesando', data.resumenProductos.length, 'productos...');
    for (const prod of data.resumenProductos) {
        console.log(`🟢 Producto ID: ${prod.id}, Cantidad: ${prod.cantidad}, Medida: ${prod.medida || 'N/A'}`);
        await giveNecesidadToProject(
            requisicionId,
            null,
            prod.id,
            prod.cantidad,  
            prod.medida,
            t
        );
    }

    return true;
};

const giveNecesidadToProject = async (requisicionId, kitId, productoId, cantidad, medida, t) => {
    try {
        // Validación básica: Si no hay cantidad o es 0, no creamos registro
        if (!cantidad || cantidad <= 0 || !requisicionId) {
            console.log(`⚠️ Validación falló - Req: ${requisicionId}, Kit: ${kitId}, Prod: ${productoId}, Cantidad: ${cantidad}`);
            return false;
        }

        // Construir whereClause dinámicamente (solo campos no null)
        const whereClause = { requisicionId };
        if (kitId) whereClause.kitId = kitId;
        if (productoId) whereClause.productoId = productoId;

        console.log(`🔍 Buscando con WHERE:`, whereClause);

        // Buscar o crear el registro
        const [record, created] = await necesidadProyecto.findOrCreate({
            where: whereClause,
            defaults: {
                cantidadComprometida: Number(cantidad),
                medida: medida || null
            },
            transaction: t
        });

        // Si es nuevo, establecer cantidadEntrega en 0 (si el campo existe)
        if (created && record.cantidadEntrega !== undefined) {
            record.cantidadEntrega = 0;
            await record.save({ transaction: t });
        }

        // Si ya existía, SUMAR la nueva cantidad al registro existente
        if (!created) {
            const cantidadAnterior = record.cantidadComprometida;
            record.cantidadComprometida = Number(record.cantidadComprometida) + Number(cantidad);
            await record.save({ transaction: t });
            console.log(`✅ Actualizado necesidad - Req: ${requisicionId}, Kit: ${kitId || 'N/A'}, Prod: ${productoId || 'N/A'}, Cantidad anterior: ${cantidadAnterior}, Cantidad sumada: ${cantidad}, Nueva cantidad total: ${record.cantidadComprometida}`);
        } else {
            console.log(`✅ Creada necesidad - Req: ${requisicionId}, Kit: ${kitId || 'N/A'}, Prod: ${productoId || 'N/A'}, Cantidad: ${cantidad}`);
        }
 
        return true;
    } catch (error) {
        // Logueamos el error para que tú como administrador sepas qué falló
        console.error(`❌ Error asignando necesidad (Req: ${requisicionId}, Kit: ${kitId}, Prod: ${productoId}):`, error.message);
        // Lanzamos el error para que el Promise.all del controlador lo capture
        throw error; 
    }
};

// Nueva cotización de compras
const nuevaCompra = async(body) => {
    const { name, description, fecha, proveedor, proyectos } = body;
    
    let time = dayjs();
    
    const searchCotizacion = await comprasCotizacion.create({
        name,
        description, 
        fecha: time.format("YYYY-MM-DD"),
        proveedorId: proveedor
    }) 
    .then(async (result) => {

        if (proyectos && proyectos.length) {
            proyectos.map(async (pr) => {
                const addToProyecto = await ComprasCotizacionProyecto.create({
                    name: result.name,
                    requisicionId: pr,
                    comprasCotizacionId: result.id,
                })
            })
        }

        return result
    });

    if(!searchCotizacion) return null;
    return searchCotizacion
}



const TIPOS_COMPRAS_ITEM = ['material', 'producto', 'servicio_libre'];

const inferTipoComprasItem = (body = {}) => {
    if (body.tipo && TIPOS_COMPRAS_ITEM.includes(body.tipo)) return body.tipo;
    if (body.productoId) return 'producto';
    if (body.materiaId || body.materiumId) return 'material';
    return null;
};

const attachProyectosToComprasItem = async (comprasCotizacionItemId, proyectos = []) => {
    if (!comprasCotizacionItemId || !Array.isArray(proyectos) || !proyectos.length) {
        return [];
    }

    const created = await Promise.all(
        proyectos.map((pr) =>
            itemToProject.create({
                cantidad: pr.cantidad,
                necesidad: pr.necesidad,
                estado: 'pendiente',
                requisicionId: pr.requisicionId,
                comprasCotizacionItemId,
            })
        )
    );

    return created;
};

// Anexar item o itemCompra a una cotización (material / producto)
const addItemToCotizacion = async(body) => {
    const { cantidad, precioUnidad, descuento, precio, precioTotal, materiaId, productoId, cotizacionId, requisicion, medida } = body;
    const tipo = inferTipoComprasItem(body);

    const addItem = await comprasCotizacionItem.create({
        cantidad, 
        precioUnidad,
        descuento, 
        precio,
        precioTotal,
        estado: 'pendiente',
        tipo,
        descripcionLibre: null,
        materiaId: tipo === 'material' ? materiaId : null,
        requisicionId: requisicion,
        materiumId: tipo === 'material' ? materiaId : null,
        productoId: tipo === 'producto' ? productoId : null,
        comprasCotizacionId: cotizacionId,
        medida
    })
 
    if(!addItem) return null;
    return addItem
}

// Anexar servicio de texto libre a una orden de compra
const addServicioLibreToCotizacion = async(body) => {
    const {
        descripcionLibre,
        cantidad,
        precioUnidad,
        descuento,
        precio,
        precioTotal,
        cotizacionId,
        requisicion,
    } = body;

    const addItem = await comprasCotizacionItem.create({
        cantidad,
        precioUnidad,
        descuento: descuento ?? '0',
        precio,
        precioTotal,
        estado: 'pendiente',
        tipo: 'servicio_libre',
        descripcionLibre: String(descripcionLibre).trim(),
        materiaId: null,
        materiumId: null,
        productoId: null,
        requisicionId: requisicion ?? null,
        comprasCotizacionId: cotizacionId,
        medida: null,
    });

    if (!addItem) return null;
    return addItem;
}
 
/** Asignaciones por proyecto: itemToProject o requisicionId directo en la línea de compra */
const getAsignacionesProyecto = (linea) => {
    const proyectos = linea.itemToProjects || [];
    if (proyectos.length > 0) {
        return proyectos.map((r) => ({
            requisicionId: r.requisicionId,
            cantidad: Number(r.cantidad || 0),
        }));
    }
    if (linea.requisicionId) {
        return [{
            requisicionId: linea.requisicionId,
            cantidad: Number(linea.cantidad || 0),
        }];
    }
    return [];
};

const buildItemRequisicionWhere = (linea, asignacion, tipo) => {
    const where = { requisicionId: asignacion.requisicionId };

    if (tipo === 'materia') {
        where.materiumId = linea.materiumId || linea.materiaId;
    } else {
        where.productoId = linea.productoId;
        if (linea.medida != null && linea.medida !== '') {
            where.medida = linea.medida;
        }
    }

    return where;
};

const actualizarItemRequisicionEntrega = async (item, cantidadAgregar) => {
    const cantidadNecesaria = Number(item.cantidad || 0);
    item.cantidadEntrega = Number(item.cantidadEntrega || 0) + Number(cantidadAgregar || 0);
    item.estado = item.cantidadEntrega < cantidadNecesaria ? 'parcialmente' : 'comprado';
    await item.save();
};

const updateItems = async (cotizacionId) => {
    const searchCotizacion = await comprasCotizacionItem.findAll({
        where: { comprasCotizacionId: cotizacionId },
        include: [{ model: itemToProject }],
    });

    if (!searchCotizacion || searchCotizacion.length === 0) return;

    const requisicionesAfectadas = new Set();

    // 1️⃣ Actualizamos cantidades entregadas por proyecto
    for (const linea of searchCotizacion) {
        const asignaciones = getAsignacionesProyecto(linea);
        if (!asignaciones.length) continue;

        const esMateria = !!(linea.materiumId || linea.materiaId);
        const esProducto = !!linea.productoId;
        if (!esMateria && !esProducto) continue;

        const tipo = esMateria ? 'materia' : 'producto';

        for (const asignacion of asignaciones) {
            if (!asignacion.requisicionId || asignacion.cantidad <= 0) continue;

            const item = await itemRequisicion.findOne({
                where: buildItemRequisicionWhere(linea, asignacion, tipo),
            });

            if (!item) continue;

            await actualizarItemRequisicionEntrega(item, asignacion.cantidad);
            requisicionesAfectadas.add(asignacion.requisicionId);
        }
    }

    // 2️⃣ Recalculamos estado de la requisición
    for (const id of requisicionesAfectadas) {
        const items = await itemRequisicion.findAll({ where: { requisicionId: id } });

        const totalItems = items.length;
        const itemsCompletados = items.filter(
            (it) => Number(it.cantidadEntrega || 0) >= Number(it.cantidad || 0)
        ).length;
        const algunAvance = items.some((it) => Number(it.cantidadEntrega || 0) > 0);

        let nuevoEstado = 'pendiente';

        if (itemsCompletados === totalItems && totalItems > 0) {
            nuevoEstado = 'comprado';
        } else if (algunAvance) {
            nuevoEstado = 'comprando';
        }

        await requisicion.update(
            { estado: nuevoEstado },
            { where: { id } }
        );
    }
};
  

const giveItemToProjects = async (id) => {
    try{
        const update = await itemToProject.findByPk(id) 

        update.estado = 'comprado';

        await update.save()
    }catch(err){
        console.log(err)

    }
}

// Exportación
module.exports = {
    getRequisicionDetallada, // Obtener requisición detallada
    createRequisicion,
    nuevaCompra, // Nueva compra
    addItemToCotizacion, // añadir item a Cotización,
    addServicioLibreToCotizacion, // servicio texto libre en OC
    attachProyectosToComprasItem, // repartición itemToProject
    inferTipoComprasItem,
    updateItems, // Actualizar items y requisicion
    giveNecesidadToProject, // Dar necesidad de kit o producto a proyecto 
    addMateriaRequisicion, // Agregar materia a requisición
    addProductoRequisicion, // Agregar producto a requisición
    getNecesidadProjecto, // Obtener necesidad de proyecto
}