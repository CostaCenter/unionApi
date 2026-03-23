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
            const cantidadKitEnCoti = kitEnCoti.kitCotizacion?.cantidad || 0;
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
        medida
    ) => {
    
    if (!materiaId || !requisicionId) {
        throw new Error('INVALID_PARAMS');
    }
  
    const existente = await itemRequisicion.findOne({
      where: {
        requisicionId,
        materiumId: materiaId
      }
    });
  
    if (existente) {
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
    });
  
    return {
      created: true,
      item: nuevoItem
    };
};

const addProductoRequisicion = async (
    requisicionId,
    productoId,
    cantidad,
    medida = null
    ) => {
    if (!productoId || !requisicionId) {
        throw new Error('INVALID_PARAMS');
    }


    const nuevoItem = await itemRequisicion.create({
        requisicionId,
        productoId,
        cantidad,
        cantidadEntrega: 0,
        estado: 'pendiente',
        medida
    });

    return {
        created: true,
        item: nuevoItem
    };
};


  
  
const getNecesidadProjecto = async (requisicionId, t) => {
    // 1. Obtenemos los datos
    const data = await getRequisicionDetallada(requisicionId); 
    if (!data) return null;

    // 2. Kits → paralelo
    await Promise.all(
        data.resumenKits.map(r =>
            giveNecesidadToProject(requisicionId, r.id, null, r.cantidad, r.medida, t)
        )
    );

    // 3. Productos → secuencial
    for (const prod of data.resumenProductos) {
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
        if (!cantidad || cantidad <= 0 || !requisicionId) return false;

        await necesidadProyecto.create({
            cantidadComprometida: Number(cantidad),
            cantidadEntrega: 0,
            requisicionId: requisicionId,
            kitId: kitId || null, 
            productoId: productoId || null,
            medida: medida || null
        }, { transaction: t });
 
        return true;
    } catch (error) {
        // Logueamos el error para que tú como administrador sepas qué falló
        console.error(`Error asignando necesidad (Req: ${requisicionId}, Kit: ${kitId}, Prod: ${productoId}):`, error.message);
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
 
        proyectos.map(async (pr) => {
            const addToProyecto = await ComprasCotizacionProyecto.create({
                name: result.name,
                requisicionId: pr,
                comprasCotizacionId: result.id,
            })
        })
        
 
        return result
    });

    if(!searchCotizacion) return null;
    return searchCotizacion
}



// Anexar item o itemCompra a una cotización
const addItemToCotizacion = async(body) => {
    const { cantidad, precioUnidad, descuento, precio, precioTotal, materiaId, productoId, cotizacionId, requisicion, medida } = body;

    const addItem = await comprasCotizacionItem.create({
        cantidad, 
        precioUnidad,
        descuento, 
        precio,
        precioTotal,
        estado: 'pendiente',
        materiaId,
        requisicionId: requisicion,
        materiumId: materiaId,
        productoId,
        comprasCotizacionId: cotizacionId,
        medida
    })
 
    if(!addItem) return null;
    return addItem
}
 
const updateItems = async (cotizacionId) => {
    const searchCotizacion = await comprasCotizacionItem.findAll({
      where: { comprasCotizacionId: cotizacionId },
      include: [{ model: itemToProject }],
    });
  
    if (!searchCotizacion || searchCotizacion.length === 0) return;
  
    const requisicionesAfectadas = new Set();
  
    // 1️⃣ Actualizamos cantidades entregadas
    for (const l of searchCotizacion) {
        if(l.materiumId){
            for (const r of l.itemToProjects) {
                const item = await itemRequisicion.findOne({
                    where: {
                        materiumId: l.materiumId,
                        requisicionId: r.requisicionId
                    }
                });

                if(item){
                    item.cantidadEntrega =
                    Number(item.cantidadEntrega) + Number(l.cantidad);
        
                    // Estado del item (opcional, pero útil)
                    item.estado =
                    item.cantidadEntrega < item.necesidad
                        ? 'parcialmente'
                        : 'comprado';
        
                    await item.save();
        
                    requisicionesAfectadas.add(r.requisicionId);
                }
            }
        }
        if(l.productoId){
            for (const r of l.itemToProjects) {
                const item = await itemRequisicion.findOne({
                    where: {
                        productoId: l.productoId,
                        requisicionId: r.requisicionId,
                        medida: l.medida
                    },
                });

                if(item){
                    item.cantidadEntrega =
                    Number(item.cantidadEntrega) + Number(r.cantidad);
            
                    // Estado del item (opcional, pero útil)
                    item.estado =
                    item.cantidadEntrega < item.necesidad
                        ? 'parcialmente'
                        : 'comprado';

                    await item.save();
             
                    requisicionesAfectadas.add(r.requisicionId);
                }
            }
        }
    }
  
    // 2️⃣ Recalculamos estado REAL de la requisición
    // for (const requisicionId of requisicionesAfectadas) {
    //   const items = await itemRequisicion.findAll({
    //     where: { requisicionId },
    //   });
  
    //   let hayAlgoComprado = false;
    //   let faltaAlgo = false;
  
    //   for (const it of items) {
    //     if (Number(it.cantidadEntrega) > 0) {
    //       hayAlgoComprado = true;
    //     }
    //     if (Number(it.cantidadEntrega) < Number(it.necesidad)) {
    //       faltaAlgo = true;
    //     }
    //   }
  
    //   let nuevoEstado = 'pendiente';
  
    //   if (!hayAlgoComprado) {
    //     nuevoEstado = 'pendiente';
    //   } else if (hayAlgoComprado && faltaAlgo) {
    //     nuevoEstado = 'comprando';
    //   } else {
    //     nuevoEstado = 'comprado';
    //   }
  
    //   await requisicion.update(
    //     { estado: nuevoEstado },
    //     { where: { id: requisicionId } }
    //   );
    // }
    // 2️⃣ Recalculamos estado de la requisición
    for (const id of requisicionesAfectadas) {
        const items = await itemRequisicion.findAll({ where: { requisicionId: id } });

        // Lógica ultra-segura
        const totalItems = items.length;
        const itemsCompletados = items.filter(it => Number(it.cantidadEntrega) >= Number(it.necesidad)).length;
        const algunAvance = items.some(it => Number(it.cantidadEntrega) > 0);

        let nuevoEstado = 'pendiente';
        
        if (itemsCompletados === totalItems && totalItems > 0) {
        nuevoEstado = 'comprado';
        } else if (algunAvance) {
        nuevoEstado = 'comprando';
        }

        // 🚩 Asegúrate que 'requisicion' sea tu MODELO de Sequelize
        await requisicion.update(
        { estado: nuevoEstado },
        { where: { id: id } }
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
    updateItems, // Actualizar items y requisicion
    giveNecesidadToProject, // Dar necesidad de kit o producto a proyecto 
    addMateriaRequisicion, // Agregar materia a requisición
    addProductoRequisicion, // Agregar producto a requisición
    getNecesidadProjecto, // Obtener necesidad de proyecto
}