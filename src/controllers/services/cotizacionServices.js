const { cotizacion, kitCotizacion, armado, armadoCotizacion, productoCotizacion } = require('../../db/db');

// Crear cotizacion
const createCotizacion = async (userId, clientId, name, description, time, fechaAprobada, price, descuento, iva) => {
    try{

        // Generamos la función para crear
        const createCotizacion = await cotizacion.create({
            userId,
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
const addItemToCotizacionServices = async(cotizacionId, kitId, cantidad,  precio, descuento) => {
 
    
    const searchItemOnCoti = await kitCotizacion.findOne({
        where: {
            areaId:cotizacionId,
            kitId
        }
    }).catch(err => null);

    if(searchItemOnCoti) return 200
    // Caso contrario, permita que se cree
    const addItemToCoti = await kitCotizacion.create({
        cantidad,
        precio,
        descuento: descuento,
        kitId,
        areaId: cotizacionId
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
            areaId: cotizacionId,
            armadoId
        }
    }).catch(err => null);

    if(searchItemOnCoti) return 200
    // Caso contrario, permita que se cree
    const addItemToCoti = await armadoCotizacion.create({
        areaId: cotizacionId,
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

// Agregar producto a cotización
const addProductoToCotizacionServices = async(cotizacionId, productoId, cantidad, precio, descuento) => {
    const searchItemOnCoti = await productoCotizacion.findOne({
        where: {
            areaId: cotizacionId,
            productoId
        }
    }).catch(err => null);

    if(searchItemOnCoti) return 200
    // Caso contrario, permita que se cree
    const addItemToCoti = await productoCotizacion.create({
        areaId: cotizacionId,
        cantidad,
        precio,
        descuento: descuento,
        productoId,
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
    addSuperKitToCotizacionServices,
    addProductoToCotizacionServices
}