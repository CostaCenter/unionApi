const { materia, kit, itemKit, proveedor, percentage,  price, priceKit, linea, categoria } = require('../../db/db');

// SearchKit
const searchKit = async(nombre, extension) => {
    try{
        const searchKit = await kit.findOne({
            where: {
                name: nombre,
                extensionId: extension
            }
        }).catch(err => null);
        // Si no hay registro, avanzamos
        if(!searchKit) return 404;
        // Si existe un registro, enviamos 200
        return 200

    }catch(err){
        console.log(err);
        return 500
    }
}
// Buscar un precio para u n MP de un PV
const createKitServices = async(code, nombre, description, extension, linea, categoria) => {
    try{
        if(!nombre || !extension) return 501
        // Caso contrario, avanzamos...

        const addNewKit = await kit.create({
            code, 
            name: nombre,
            description,
            extensionId: extension,
            lineaId: linea,
            categoriumId: categoria
        }).catch(err => {
            console.log(err);
            return 502;
        });

        return addNewKit;

    }catch(err){
        console.log(err);
        return 500
    }
} 
 
// Add Items To Kit. 
const addItemToKit = async (mtId, kitId, cantidad, medida, calibre, areaKitId) => {
    try{
        // Buscamos que exista el MtId y el Kit.
        const searchKit = await kit.findByPk(kitId).catch(err => null);
        if(!searchKit) return 404

        const searcMateria = await materia.findOne({
            where: {
                id: mtId
            },
            include:[{
                model: price,
                where: {
                    state: 'active'
                },
                required:true
            }]
        }).catch(err => {
            console.log(err);
            return 502; 
        });
        if(!searcMateria) return 404
        
       
        // Caso contrario... 
        const addItemToKitSend = await itemKit.create({
            cantidad,
            medida,
            kitId,
            materiaId: mtId,
            calibre,
            areaId: areaKitId
        }).catch(err => {
            console.log(err);
            return 502;
        })
        console.log(addItemToKitSend)
        return addItemToKitSend;
    }catch(err){
        console.log(err);
        return 500;
    } 
}

// Eliminar item de un kit
const deleteDeleteItemOnKit = async (itemKitId, kitId, itemId) => {
    try{    
        // Validamos que los parámetros entren realmente.
        // Caso contrario, avanzamos...
        const searchKit = await kit.findByPk(kitId);
        const searchMateria = await materia.findByPk(itemId);
        // const searchKitItem = await itemKit.findOne({
        //     where: {
        //         materiaId: itemId,
        //         kitId: kitId
        //     }
        // }).catch(err => null);

        // Si no hay resultados, envia respuesta
        // const deletee = await searchKit.removeMateria(searchMateria);
        const deletee = await itemKit.destroy({
            where: {
                id: itemKitId
            }
        })
        if(!deletee) return 502
        return 200

    }catch(err){
        console.log(err);
        return 500
    }
}
// Cambiar estado del kit
const changeState = async(kitId, state) => {
    try{
        const updateState = await kit.update({
            state
        }, {
            where: {
                id: kitId
            }
        }).catch(err => {
            console.log(err);
            return null
        })
        if(!updateState) return 502
        return 200
    }catch(err){
        console.log(err);
        return 500
    }
}


// DAR PRECIO 
const givePriceToKitServices = async (kitId, bruto) => {
    try{
        let valorSinIva = Number(bruto)
        let valorDelIva = Number(valorSinIva * 0.19).toFixed(0)
        let valorNeto = Number(Number(valorSinIva) + Number(valorDelIva)).toFixed(0)

        // Buscamos un precio
        const findPrice = await priceKit.findOne({
            where: {
                state: 'active',
                kitId: kitId
            }
        });

        if(!findPrice){
            const addPrice = await priceKit.create({
                bruto: valorSinIva,
                iva: valorDelIva,
                valor: valorNeto,
                kitId,
                state: 'active'
            });

            return addPrice
        }else{
            if(Math.abs(valorSinIva - Number(findPrice.bruto)) / findPrice.bruto >= 0.03){

                const updatePrice = await priceKit.update({
                    state: 'changed'
                }, {
                    where: {
                        id: findPrice.id
                    }
                }) 
                .then(async (res) => {
                    const addPrice = await priceKit.create({
                        bruto: valorSinIva,
                        iva: valorDelIva,
                        valor: valorNeto,
                        kitId,
                        state: 'active'
                    });

                    return addPrice;
                })

                return updatePrice;
                
            }
        }
        

    }catch(err){
        console.log(err);
        return null
    }
}
const givePercentage = async(kitId) => {
    const searchKit = await kit.findOne({
        where: {
            id: kitId
        },
        include: [
            {
                model: priceKit,
                where: {
                    state: 'active'
                },
                required:false
            },
            // ▼▼▼ INICIO DEL BLOQUE CORREGIDO ▼▼▼
            {
                model: itemKit, // 1. La asociación ahora pasa por aquí
                attributes: ['id', 'cantidad', 'medida', 'calibre', 'areaId', 'materiaId'], // Atributos de la tabla intermedia que quieres ver
                include: [
                    {
                        model: materia, // 2. Incluimos materium DENTRO de itemKit
                        attributes: ['id', 'item', 'description', 'medida', 'unidad'], // Tus atributos originales
                        include: [{
                            model: price,
                            where: { state: 'active' },
                            required: false, // Usar false es una buena práctica (LEFT JOIN)
                            attributes: ['id', 'valor', 'iva', 'descuentos', 'state'] // Tus atributos originales
                        }]
                    },
                ]
            },
            {
                model: linea,
                include: [{
                    model: percentage,
                    where: { state: 'active' },
                    required: false
                }],
                attributes: { exclude: ['createdAt', 'updatedAt', 'description', 'type', 'code', 'state'] }
            },
        ] 
    });

    return searchKit;
}


const getPromedio = (array) => { // 'array' es el objeto 'item' completo
    
    // --- VALIDACIÓN DE SEGURIDAD ---
    if (!array || !array.materium || !array.materium.prices || array.materium.prices.length === 0) {
        return 0;
    }

    // --- EXTRACCIÓN DE DATOS ---
    const materia = array.materium;
    const promedio = Number(materia.prices.reduce((acc, p) => Number(acc) + Number(p.valor), 0)) / materia.prices.length;
    
    const unidad = materia.unidad;
    const medidaMateria = materia.medida; // Medida de la materia prima (ej: "1.22X2.44")
    const consumirMedida = array.medida;  // Medida del consumo (ej: "1")

    // --- LÓGICA DE CÁLCULO CORREGIDA ---
    if (unidad == 'mt2') {
        // Para la MEDIDA DE LA MATERIA PRIMA, sí separamos por 'X'
        const AreaMateria = Number(medidaMateria.split('X')[0]) * Number(medidaMateria.split('X')[1]);

        if (AreaMateria === 0) return 0;

        const precioMetroCuadrado = promedio / AreaMateria;

        // Para la MEDIDA DEL CONSUMO, usamos el valor directamente
        const AreaAConsumir = Number(consumirMedida); 
        
        const costo = AreaAConsumir * precioMetroCuadrado;
        return costo;

    } else if (unidad == 'mt') {
        if (Number(medidaMateria) === 0) return 0;
        const precioMetro = promedio / Number(medidaMateria);
        const MetrosAConsumir = Number(consumirMedida);
        const costo = precioMetro * MetrosAConsumir;
        return costo; 

    } else if (unidad == 'unidad') {
        if (Number(medidaMateria) === 0) return 0;
        const precioUnidad = promedio / Number(medidaMateria);
        const unidadesAConsumir = Number(consumirMedida);
        const costo = precioUnidad * unidadesAConsumir;
        return costo;

    } else if (unidad == 'kg') {
        if (Number(medidaMateria) === 0) return 0;
        const precioKg = promedio / Number(medidaMateria);
        const kgAConsumir = Number(consumirMedida);
        const costo = precioKg * kgAConsumir;
        return costo;
    }

    return 0;
}
// Exportación
module.exports = {
    searchKit, // Buscar Kit
    createKitServices, // Crear un Kit
    addItemToKit, // Agregamos item a  kit.
    deleteDeleteItemOnKit, // Eliminar item de un Kit
    changeState, // Actualizar estado del kit 
    givePercentage, // Obtener un kit con sus precios y detalles
    getPromedio, // Obtener promedio
    givePriceToKitServices, // Cambiar precio
}