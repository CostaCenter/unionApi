const { cotizacion, kitCotizacion, armado, armadoCotizacion } = require('../../db/db');

// Crear cotizacion
const createCotizacion = async (clientId, name, description, time, fechaAprobada, price, descuento, iva) => {
    try{

        // Generamos la función para crear
        const createCotizacion = await cotizacion.create({
            clientId,
            name,
            description, 
            time, 
            fechaAprobada,
            price,
            descuento,
            iva,
            state: price ? 'pendiente' : 'desarrollo'
        }).catch(err => {
            console.log(err);
            return null;
        });

        return createCotizacion;
    }catch(err){
        console.log(err);
        return 500;
    }
}

// Agregar item cotización
const addItemToCotizacionServices = async(cotizacionId, kitId, cantidad, precio, descuento) => {
 
    
    const searchItemOnCoti = await kitCotizacion.findOne({
        where: {
            cotizacionId,
            kitId
        }
    }).catch(err => null);

    if(searchItemOnCoti) return 200
    // Caso contrario, permita que se cree
    const addItemToCoti = await kitCotizacion.create({
        cotizacionId,
        cantidad,
        precio,
        descuento: descuento,
        kitId,
    }).catch(err => {
        console.log(err);
        return null;
    }); 
    if(!addItemToCoti) return 502
    return addItemToCoti;
}

// Agregar item cotización
const addSuperKitToCotizacionServices = async(cotizacionId, armadoId, cantidad, precio, descuento) => {
    const searchItemOnCoti = await armadoCotizacion.findOne({
        where: {
            cotizacionId,
            armadoId
        }
    }).catch(err => null);

    if(searchItemOnCoti) return 200
    // Caso contrario, permita que se cree
    const addItemToCoti = await armadoCotizacion.create({
        cotizacionId,
        cantidad,
        precio,
        descuento: descuento,
        armadoId,
    }).catch(err => {
        console.log(err);
        return null;
    }); 
    if(!addItemToCoti) return 502
    return addItemToCoti;
}

// Exportación
module.exports = {
    createCotizacion,
    addItemToCotizacionServices,
    addSuperKitToCotizacionServices
}