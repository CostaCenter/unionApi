const { materia, proveedor, price, productPrice, producto, linea, categoria } = require('../../db/db');

// Buscar un precio para un MP de un PV
const searchPrice = async(mtId, pvId) => {
    try{
        // Validamos la entrada de los parámetros
        if(!mtId || !pvId) return 501
        // Caso contrario, enviamos la consulta

        const searchValor = await price.findOne({
            where: {
                materiumId: mtId,
                proveedorId: pvId,
                state: 'active'
            }
        }).catch(err => {
            console.log(err);
            return null;
        });

        if(!searchValor){
            // Enviamos 200 si no hay resultado
            return 404
        }else{
            // Enviamos 200, si hay resultado
            return 200
        }
    }catch(err){
        console.log(err);
        return 500
    }
}
// Actualizar Precio MP
const addPriceMt = async (mtId, pvId, valor, iva, descuentos) => {
    try{
        // Validamos que entren los parámetros.
        if(!mtId || !pvId || !valor) return 501
        // Caso contrario, avanzamos...

        // Verificamos que el proveedor Exista.
        const searchProveedor = await proveedor.findByPk(pvId).catch(err => null);
        // Observamos resultado
        if(!searchProveedor) return 404
        // Caso contrario, avanzamos...
        // Buscamos la existancia de MP. 
        const searchMp = await materia.findByPk(mtId).catch(err => null);
        if(!searchMp) return 404
        // Caso contrario, procedemos a asignar un precio...
         
        
        // Buscamos si ya existe. 
        
        const addPrice = await price.create({
            materiumId: mtId, 
            proveedorId: pvId,
            valor,
            iva,
            descuentos,
            state: 'active'
        }).catch(err => {
            console.log(err);
            return null;
        });

        if(!addPrice) return 502
        // Caso contrario, enviamos resultado. 201 Succesful!
        return addPrice
    }catch(err){
        console.log(err)
        return 500
    }
}

// Actualizar el estado de un precio
const updatePriceState = async(mtId, pvId, state) => {
    try{
        // Validamos parámetros
        if(!mtId || !pvId || !state) return 501
        
        // Caso contrario, avanzamos...
        const updateState = await price.update({
            state
        }, 
        {
            where: {
                materiumId: mtId,
                proveedorId: pvId,
                state: 'active'
            }
        })
        .then(res => {
            return 200
        })
        .catch(err => {
            console.log(err);
            return 502
        });

        return updateState;

    }catch(err){
        console.log(err);
        return 500
    }
}


// PRODUCTO TERMINADO

// Buscar un precio para un PT de un PV
const searchProductPrice = async(productId, pvId) => {
    try{
        // Validamos la entrada de los parámetros
        if(!productId || !pvId) return 501

        // Caso contrario, enviamos la consulta
        const searchValor = await productPrice.findOne({
            where: {
                productoId: productId,
                proveedorId: pvId,
                state: 'active'
            }
        }).catch(err => {
            console.log(err);
            return null;
        });

        if(!searchValor){
            // Enviamos 200 si no hay resultado
            return 404
        }else{
            // Enviamos 200, si hay resultado
            return 200
        }
    }catch(err){
        console.log(err);
        return 500
    }
}

// Actualizar Precio PT
const addPricePT = async (productId, pvId, valor, iva, descuentos) => {
    try{
        // Validamos que entren los parámetros.
        if(!productId || !pvId || !valor) return 501
        // Caso contrario, avanzamos...

        // Verificamos que el proveedor Exista.
        const searchProveedor = await proveedor.findByPk(pvId).catch(err => null);
        // Observamos resultado
        if(!searchProveedor) return 404
        // Caso contrario, avanzamos...

        // Buscamos la existancia de PT. 
        const searchMp = await producto.findByPk(productId).catch(err => null);
        if(!searchMp) return 404


        // Caso contrario, procedemos a asignar un precio...
        const addPrice = await productPrice.create({
            productoId: productId, 
            proveedorId: pvId,
            valor,
            iva,
            descuentos,
            state: 'active'
        }).catch(err => {
            console.log(err);
            return null;
        });

        if(!addPrice) return 502
        // Caso contrario, enviamos resultado. 201 Succesful!
        return addPrice
    }catch(err){
        console.log(err)
        return 500
    }
}

// Actualizar el estado de un precio
const updateProductPriceState = async(productId, pvId, state) => {
    try{
        // Validamos parámetros
        if(!productId || !pvId || !state) return 501
        
        // Caso contrario, avanzamos...
        const updateState = await productPrice.update({
            state
        }, 
        {
            where: {
                productoId: productId,
                proveedorId: pvId,
                state: 'active'
            }
        })
        .then(res => {
            return 200
        })
        .catch(err => {
            console.log(err);
            return 502
        });

        return updateState;

    }catch(err){
        console.log(err);
        return 500
    }
} 

// Exportación
module.exports = {
    searchPrice, // Buscar precio de un PV y MT
    addPriceMt, // Agregar precio
    updatePriceState, // Cambiar estado a Changed 

    // Producto
    searchProductPrice, // Buscar precio de un PV Y PT
    addPricePT, // Agregar precio a Producto terminado
    updateProductPriceState, // Actualizar estado.
}