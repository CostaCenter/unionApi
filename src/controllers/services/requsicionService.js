const { cotizacion, kitCotizacion, requisicion, comprasCotizacion,  ComprasCotizacionProyecto, 
    comprasCotizacionItem, itemRequisicion, Op
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


// COMPRAS Y COTIZACIONES

// Nueva cotización de compras
const nuevaCompra = async(body) => {
    const { name, description, fecha, proveedor, proyectos } = body;

    const searchCotizacion = await comprasCotizacion.create({
        name,
        description, 
        fecha,
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
    const { cantidad, precioUnidad, precioTotal, materiaId, productoId, cotizacionId, requisicion } = body;

    const addItem = await comprasCotizacionItem.create({
        cantidad, 
        precioUnidad,
        precioTotal,
        estado: 'pendiente',
        materiaId,
        requisicionId: requisicion,
        materiumId: materiaId,
        productoId,
        comprasCotizacionId: cotizacionId
    })

    if(!addItem) return null;
    return addItem
}
 
// Actualizar items
const updateItems =  async (cotizacion) => {
    try{
        // Recibimos por body
        const searchCotizacion = await comprasCotizacionItem.findAll({
            where: {
                comprasCotizacionId: cotizacion
            }
        });
        
        // Buscamos e iteramos...

        if(!searchCotizacion) return null;

        const a = searchCotizacion?.forEach( async (l) => {
            if(l.materiumId){
                const update = await itemRequisicion.findOne({
                    where: {
                        materiumId: l.materiumId,
                        requisicionId: l.requisicionId,
                    }
                })

                update.cantidadEntrega = Number(update.cantidadEntrega) + Number(l.cantidad)

                await update.save()
            }
        })

        const updateRequisicion = await requisicion.update({
            state: 'compra parcial'
        }, {
            where: {
                id: searchCotizacion.requisicionId
            }
        })

        return updateRequisicion;


    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal.'});
    }
}

// Exportación
module.exports = {
    createRequisicion,
    nuevaCompra, // Nueva compra
    addItemToCotizacion, // añadir item a Cotización,
    updateItems, // Actualizar items y requisicion
}