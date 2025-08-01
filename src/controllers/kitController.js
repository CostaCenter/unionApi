const express = require('express');
const { materia, producto, user, proveedor, extension, price, kit, areaKit, itemKit, priceKit, linea, categoria, percentage, Op, db, literal } = require('../db/db');
const { searchPrice, addPriceMt, updatePriceState,  } = require('./services/priceServices');
const { searchKit, createKitServices, addItemToKit, deleteDeleteItemOnKit, changeState, givePercentage, getPromedio, givePriceToKitServices } = require('./services/kitServices');
const { addLog } = require('./services/logServices');
const dayjs = require('dayjs');
const sequelize = kit.sequelize; // <-- Aquí obtienes la instancia


// Buscamos kits para cotizar por Query
const searchKitsForCoti = async (req, res) => {
    try{
        // Recibo dato por query
        const { query,  cateriumId, lineaId  } = req.query; // Obtiene el parámetro de búsqueda desde la URL

        if (!query) {
            return res.status(400).json({ message: "Debes proporcionar un término de búsqueda." });
        }

                // 1. Empezamos con la condición que siempre se aplica.
        const whereClause = {
            state: 'completa'
        };

        // 2. Aplicamos la lógica condicional para la búsqueda.
        if (!isNaN(query) && query.trim() !== '') {
            // SI ES UN NÚMERO, busca solo por ID.
            whereClause.id = query;
        } else {
            // SI ES TEXTO, busca solo por nombre.
            whereClause.name = { [Op.iLike]: `%${query}%` };
        }

         // Si llega un 'cateriumId', se añade al filtro
        if (cateriumId) {
            whereClause.categoriumId = cateriumId; // Ajusta este nombre de campo si es necesario
        }

        // Si llega un 'lineaId', se añade al filtro
        if (lineaId) {
            whereClause.lineaId = lineaId;

        }

        const kits = await kit.findAll({
            where: whereClause, 
            include:[
                {
                    model: priceKit,
                    where: {
                        state: 'active'
                    }
                },
                // ▼▼▼ INICIO DEL BLOQUE MODIFICADO ▼▼▼
                // {
                //     model: itemKit, // 1. La asociación ahora pasa por el modelo intermedio
                //     attributes: { 
                //         // Opcional: Excluye datos de la tabla intermedia para una respuesta más limpia
                //         exclude: ['createdAt', 'updatedAt', 'kitId', 'materiaId', 'areaId'] 
                //     },
                //     include: [
                //         {
                //             model: materia, // 2. Incluimos Materia DENTRO de ItemKit
                //             include:[{
                //                 model: price,
                //                 where: {
                //                     state: 'active'
                //                 },
                //                 required: false // Se recomienda para no excluir kits si una materia no tiene precio activo
                //             }]
                //         },
                //         {
                //             model: areaKit // 3. Incluimos también el Área
                //         }
                //     ]
                // },
                {
                model: categoria
            },
            {
                model: linea,
                include:[{
                    model: percentage,
                    where: {
                        state: 'active'
                    },
                    required:false

                }]
            },{
                model: extension
            }],
            attributes: { exclude: ['createdAt', 'updatedAt'] },
            
        }).catch((err => {
            console.log(err);
            return null; 
        }));

        if(!kits) return res.status(404).json({msg: 'No encontrado'})

        res.status(200).json(kits);
    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal'});
    }
}
// Buscamos kits por Query
const searchKitsQuery = async(req, res) => {
    try {
        const { query } = req.query; // Obtiene el parámetro de búsqueda desde la URL

        if (!query) {
            return res.status(400).json({ message: "Debes proporcionar un término de búsqueda." });
        }

        const kits = await kit.findAll({
            where: {
                [Op.or]: [
                    { name: { [Op.iLike]: `%${query}%` } }, // Búsqueda flexible (ignora mayúsculas/minúsculas)
                ],
                state: 'completa'
            },
            attributes: { exclude: ['createdAt', 'updatedAt'] },
            limit: 10, // Máximo 10 resultados para eficiencia
        }).catch((err => {
            console.log(err);
            return null;
        }));

        if(!kits) return res.status(404).json({msg: 'No encontrado'})

        res.status(200).json(kits);
    } catch (error) {
        console.error("Error al buscar productos:", error);
        res.status(500).json({ message: "Error interno del servidor" });
    }
}
// Obtener todos los kikts Terminados
// Asegúrate de importar todos los modelos necesarios al inicio del archivo

// Obtenemos producción
const getProduccion = async (req, res) => {
    try{
        // Recibimos datos

        const searchAll = await kit.count({where: { state: 'desarrollo' } });
        const searchCompletos = await kit.count({where: { state: 'completa' } });

        const searchProductos = await producto.count();
        const searchLineas = await linea.count({where: {type: 'comercial'}})
        const searchUsers = await user.count({where: {area: 'produccion'}})

        const produccion = {
            desarrollo: searchAll ? searchAll : 0,
            completos: searchCompletos ? searchCompletos : 0,
            productos: searchProductos ? searchProductos : 0,
            lineas: searchLineas ? searchLineas : 0,
            usuarios: searchUsers ? searchUsers : 0
        }

        res.status(200).json(produccion)
    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal.'});
    }
}


// Filtrar y agrupar
const getKitPorFecha = async (req, res) => {
    try {
        const { inicio, fin} = req.params;
        // Define el rango de fechas (por defecto, los últimos 6 meses)
        const fechaFin = fin ? dayjs(fin).endOf('day') : dayjs().endOf('day');
        const fechaInicio = inicio ?  dayjs(inicio).startOf('day')  : dayjs(fin).subtract(6, 'month').startOf('day');

        const { categoriaId, lineaId, extensionId } = req.query;

        // <-- CAMBIO: Se crea un objeto 'where' dinámico
        const whereConditions = {
            createdAt: {
                [Op.between]: [fechaInicio.toDate(), fechaFin.toDate()]
            }
        };
        // Si se proporciona un categoriaId, se añade al filtro
        if (categoriaId) {
            whereConditions.categoriumId = categoriaId;
        }

        if (extensionId) {
            whereConditions.extensionId = extensionId;
        }

        // Si se proporciona un lineaId, se añade al filtro
        if (lineaId) {
            whereConditions.lineaId = lineaId;
        }
        const resultados = await kit.findAll({
            // 1. Selecciona y formatea los campos que necesitas
            attributes: [
                // Extrae solo la fecha (YYYY-MM-DD) de la columna 'createdAt'
                [sequelize.fn('DATE', sequelize.col('createdAt')), 'fecha'],
                // Cuenta cuántos productos hay por cada fecha y lo nombra 'cantidad'
                [sequelize.fn('COUNT', sequelize.col('id')), 'cantidad']
            ],
            // 2. Filtra por el rango de fechas
            where: whereConditions,
            // 3. Agrupa los resultados por la fecha extraída
            group: [sequelize.fn('DATE', sequelize.col('createdAt'))],
            // 4. Ordena los resultados cronológicamente
            order: [[sequelize.fn('DATE', sequelize.col('createdAt')), 'ASC']],
            // Opcional: raw:true devuelve objetos JSON planos, ideal para agregaciones
            raw: true
        });

        
        // 5. Convierte las fechas a objetos Date para MUI X Charts
        const datosParaGrafica = resultados

        res.status(200).json(datosParaGrafica);

    } catch (err) {
        console.error("Error al obtener datos de producción:", err);
        res.status(500).json({ msg: 'Error en el servidor.' });
    }
};


// Filtrar 
const getKitsFiltrados = async (req, res) => {
    try {
        // 1. Obtenemos los filtros desde req.query (o req.body si lo prefieres)
        const { fechaInicio, fechaFin, categoriaId, extensionId, lineaId } = req.query;

        // 2. Construimos el objeto de condiciones 'where' dinámicamente
        const whereConditions = {};

        // --- Filtro por Rango de Fechas ---
        if (fechaInicio && fechaFin) {
            whereConditions.createdAt = {
                [Op.between]: [
                    dayjs(fechaInicio).startOf('day').toDate(),
                    dayjs(fechaFin).endOf('day').toDate()
                ]
            };
        }

        // --- Filtro por Categoría ---
        if (categoriaId) {
            whereConditions.categoriumId = categoriaId;
        }

        if (extensionId) {
            whereConditions.extensionId = extensionId;
        }

        // --- Filtro por Línea ---
        if (lineaId) {
            whereConditions.lineaId = lineaId;
        }
         
        // 3. Hacemos la consulta a la base de datos
        const kitsResults = await kit.findAll({
            where: whereConditions,
            // Incluimos los modelos relacionados para tener la información completa
            include: [
                { model: categoria }, // Asume que tienes un alias 'categoria'
                { model: linea },       // Asume que tienes un alias 'linea'
                { model: extension }
            ],
            order: [['createdAt', 'DESC']] // Ordena los más recientes primero
        });

        if (!kitsResults || kitsResults.length === 0) {
            return res.status(404).json({ msg: 'No se encontraron productos con los filtros aplicados.' });
        }

        res.status(200).json(kitsResults);

    } catch (err) {
        console.error("Error al filtrar productos:", err);
        res.status(500).json({ msg: 'Error en el servidor.' });
    }
};

// KABO
const getAllKitCompleted = async(req, res) => {
    try{
        // La búsqueda principal no cambia
        const searchAll = await kit.findAll({
            where: {
                state: 'completa'
            },
            include:[
                // =============================================================
                // ▼▼▼ ESTE ES EL BLOQUE MODIFICADO ▼▼▼
                // =============================================================
                {
                    model: itemKit, // 1. Ahora incluimos el modelo intermedio ItemKit
                    attributes: { 
                        // Excluimos los IDs de la tabla intermedia para una respuesta más limpia
                        exclude: ['createdAt', 'updatedAt', 'kitId', 'materiaId', 'areaId'] 
                    },
                    include: [
                        {
                            model: materia, // 2. Anidamos Materia DENTRO de ItemKit
                            attributes: { exclude: ['createdAt', 'updatedAt'] },
                            include: [{
                                model: price,
                                where: { state: 'active' }, 
                                attributes: { exclude: ['createdAt', 'updatedAt'] },
                                required: false // Usar false o left join para no excluir kits si una materia no tiene precio activo
                            }]
                        },
                        {
                            model: Area // 3. También anidamos Area DENTRO de ItemKit
                        }
                    ]
                },
                // =============================================================
                // ▲▲▲ FIN DEL BLOQUE MODIFICADO ▲▲▲
                // =============================================================
                {
                    model: categoria
                },
                {
                    model: linea,
                    include:[{
                        model: percentage,
                        where: {
                            state: 'active'
                        },
                        required:false
                    }]
                },{
                    model: extension
                }
            ] 
        });

        if(!searchAll || searchAll.length === 0) return res.status(404).json({msg: 'No se encontraron kits completados'});

        // Enviamos resultados
        res.status(200).json(searchAll);
    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en el servidor'});
    }
}

// Obtener kits sin precio
const getKits = async(req, res) => {
    try{
        // Buscamos todos los elementos dentro de la base de datos
        const searchAll = await kit.findAll({
            include:[{  
                model: categoria,
                attributes: { exclude: ['createdAt', 'updatedAt', 'description', 'type', 'code'] }
            },
            {
                model: linea,
                attributes: { exclude: ['createdAt', 'updatedAt', 'description', 'type', 'code'] }
            },{
                model: extension,
                attributes: { exclude: ['createdAt', 'updatedAt', 'description', 'type'] }
            }], 
            order:[['createdAt', 'DESC']]
        }).catch(err => {
            console.log(err)
            return null
        });

        if(!searchAll) return res.status(404).json({msg: 'No hemos encontrado esto'});

        // caso contrario, enviamos resultados
        res.status(200).json(searchAll)
    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal'})
    }
}
// Obtener todos los kikts
const getAllKit = async(req, res) => {
    try{
        const searchAll = await kit.findAll({
            include:[
                // ▼▼▼ INICIO DEL BLOQUE MODIFICADO ▼▼▼
                {
                    model: itemKit, // 1. La asociación ahora pasa por el modelo intermedio
                    attributes: { 
                        // Opcional: Excluye datos de la tabla intermedia para una respuesta más limpia
                        exclude: ['createdAt', 'updatedAt', 'kitId', 'materiaId', 'areaId'] 
                    },
                    include: [
                        {
                            model: materia, // 2. Incluimos Materia DENTRO de ItemKit
                            include:[{
                                model: price,
                                where: {
                                    state: 'active'
                                },
                                required: false // Se recomienda para no excluir kits si una materia no tiene precio activo
                            }]
                        },
                        {
                            model: areaKit // 3. Incluimos también el Área
                        }
                    ]
                },
                // ▲▲▲ FIN DEL BLOQUE MODIFICADO ▲▲▲
                { 
                    model: categoria,
                    attributes: { exclude: ['createdAt', 'updatedAt', 'description', 'type', 'code', 'state'] }
                },{
                    model: linea,
                    include:[{
                        model: percentage,
                        where: {
                            state: 'active'
                        },
                        required:false
                    }],
                    attributes: { exclude: ['createdAt', 'updatedAt', 'description', 'type', 'code', 'state'] }
                },{ 
                    model: extension,
                    attributes: { exclude: ['createdAt', 'updatedAt', 'description', 'type', 'state'] }
                }
            ] ,
            order:[['name', 'ASC']]
        });

        if(!searchAll || searchAll.length === 0) return res.status(404).json({msg: 'No se encontraron kits'});

        res.status(200).json(searchAll);
    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en el servidor'})
    }
}
// Obtenemos un Kit con precios
const getKit = async (req, res) => {
    try {
        const { kitId } = req.params;
        if (!kitId) return res.status(404).json({ msg: 'Parámetro no es valido.' });

        const searchKit = await kit.findOne({
            where: {
                id: kitId
            },
            include: [
                {
                    model: priceKit,
                    where: {
                        state: 'active'
                    }
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
                        {
                            model: areaKit, // 3. También incluimos el área,
                        } 
                    ]
                },
                {
                    model: areaKit,
                    where: {
                        state: true
                    },
                    required:false
                },
                // ▲▲▲ FIN DEL BLOQUE CORREGIDO ▲▲▲
                {
                    model: categoria,
                    attributes: { exclude: ['createdAt', 'updatedAt', 'description', 'type', 'code', 'state'] }
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
                {
                    model: extension,
                    attributes: { exclude: ['createdAt', 'updatedAt', 'description', 'type', 'state'] }
                }
            ]
        });

        if (!searchKit) return res.status(404).json({ msg: 'No hemos encontrado esto.' });
        
        res.status(200).json(searchKit); // Se suele usar 200 para GET exitosos

    } catch (err) {
        console.log(err);
        res.status(500).json({ msg: 'Ha ocurrido un error en la principal.' });
    }
}

// Creamos un kit

const addKit = async (req, res) => {
    try{
        // Recibimos datos por body
        const { code, nombre, description, extension, linea, categoria, userId } = req.body;
        // Validamos que los datos entren correctamente
        if(!nombre || !extension) return res.status(501).json({msg: 'Los parámetros no son validos.'});
        // Caso contrario, avanzamos...
 
        // Validamos que no exista un kit con todos las condiciones
        const searchK = await searchKit(nombre, extension).catch(err => null);

        if(searchK == 404){
            const addKit = await createKitServices(code, nombre, description, extension, linea, categoria)
            .catch(err => {
                console.log(err);
                return null;
            })
            if(addKit == 502) return res.status(500).json({msg: 'No hemos logrado crear este kit'})
            // Entidad, entidadId, accion, detalle, fecha, userId
            const a = await addLog('kits', addKit.id, 'create', 'Creo nuevo kit', userId)
            return res.status(201).json(addKit); 


        }else if(searchK == 200){
            return res.status(200).json({msg: 'Ya existe este kit.'});
        }else{
            return res.status(502).json({msg: 'No hemos logrado crear esto.'});
        }
    }catch(err){
        console.log(err);
        return res.status(500).json({msg: 'Ha ocurrido un error en la principal.'});
    }
}
// Update Basic information about Kit
const updateKitt = async (req, res) => {
    try{
        // Recibimos datos por body
        const { kitId, nombre, description, extensionId, lineaId, categoriumId, userId } = req.body;

        // Validamos
        if(!kitId) return res.status(501).json({msg: 'Parametro invalido.'});
        // Caso contrario, avanzamos
        const updateKit = await kit.update({
            name: nombre,
            description,
            extensionId: extensionId,
            lineaId: lineaId,
            categoriumId: categoriumId
        }, {
            where: {
                id: kitId
            }
        })
        .then(async (res) => {
            // Entidad, entidadId, accion, detalle, fecha, userId
            const a = await addLog('kits', kitId, 'update', 'Actualizó datos generales de este kit', userId)
            return res
        })
        .catch(err => {
            console.log(err);
            return 502;
        });
        if(!updateKit) return res.status(502).json({msg: 'No hemos logrado actualizar esto.'});
        // Caso contrario
        res.status(200).json({msg: 'Actualizado con éxito'});
    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal.'});
    }
}

// Crear nuevo segmento para un kit
const addSegmento = async(req, res) => {
    try{
        // Recibimos datos por body
        const { name, kitId, userId } = req.body;
        // Validamos la entrada
        if(!name || !kitId || !userId) return res.status(400).json({msg: 'Parámetros no son validos.'});
        // Caso contrario
        const addSeg = await areaKit.create({
            name,
            kitId,
            state: true
        });
        // Validamos
        if(!addSeg) return res.status(502).json({msg: 'No hemos logrado crear este segmento'});
        // Caso contrario, enviamos respuesta.
        res.status(201).json(addSeg);

    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal.'});
    }
}

// Eliminar segmento
const deleteSegmento = async (req, res) => {
    try{
        // Recibimos dato por body
        const { segmentoId } = req.params;
        
        // Validamos
        if(!segmentoId ) return res.status(501).json({msg: 'Los parámetros no son validos'});
        // Caso contrario, avanzamos...
        const deleteKits = await itemKit.destroy({
            where: {
                areaId: segmentoId
            }
        })
        const deleteProducto = await itemKit.destroy({
            where: {
                areaId: segmentoId
            }
        })


        // Caso contrario, avanzamos...
        const deletee = await areaKit.destroy({
            where: {
                id: segmentoId
            }
        })
        if(!deletee) return res.status(502).json({msg: 'Ha ocurrido un error '})
        res.status(200).json({msg: 'Eliminado con exito'})
    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal.'});
    }
}
// Crear nuevo segmento para un kit
const updateSegmento = async(req, res) => {
    try{
        // Recibimos datos por body
        const { name, areaId } = req.body;
        // Validamos la entrada
        if(!name || !areaId) return res.status(400).json({msg: 'Parámetros no son validos.'});
        // Caso contrario
        const addSeg = await areaKit.update({
            name,
        }, {
            where: {
                id: areaId
            }
        });
        // Validamos
        if(!addSeg) return res.status(502).json({msg: 'No hemos logrado crear este segmento'});
        // Caso contrario, enviamos respuesta.
        res.status(201).json(addSeg);

    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal.'});
    }
}

// Agregamos item al Kit
const addItem = async (req, res) => {
    try{
        // Recibimos datos por body
        const { mtId, kitId, areaKitId,  cantidad, medida, calibre, userId} = req.body;

        //Validamos que entren correctamente.
        if(!mtId || !kitId || !cantidad || !medida) return res.status(501).json({msg: 'Los parámetros no son validos.'});
        
        // Caso contrario, avanzamos...

        const addChoosed = await addItemToKit(mtId, kitId, cantidad, medida, calibre, areaKitId)
        .then(async res => {
            const updateKit = await changeState(kitId, 'desarrollo')
            return res 
        })
        .then(async (res) => {
            // Entidad, entidadId, accion, detalle, fecha, userId
            const a = await addLog('kits', kitId, 'add', 'Añadió materia prima al kit', userId, mtId)
            return res
        })
        .catch(err => {
            console.log(err); 
            return null
        });
        if(addChoosed == 500) return res.status(500).json({msg: 'Falló la función.'});
        if(addChoosed == 502) return res.status(502).json({msg: 'No hemos logrado crear esto.'});
        if(addChoosed == 404) return res.status(404).json({msg: 'No hemos encontrado esto.'});
        if(addChoosed == 200) return res.status(404).json({msg: 'Este item ya hace parte del kit'});
        
        res.status(201).json(addChoosed)

    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal.'});
    }
} 

const updateItemOnKit = async (req, res) => {
    try{
        // Recibimos por body
        const { itemKitId, kitId, materiaId, medida, userId } = req.body;
        // Validamos que los datos entren correctamente
        if(!itemKitId || !kitId || !materiaId || !medida) return res.status(400).json({msg: 'No hemos recibido los datos correctamente.'});
        // Caso contrario, avanzamos

        const updateItemKit = itemKit.update({
            medida
        }, {
            where: {
                id: itemKitId,
            }
        }).then(async (res) => {
            // Entidad, entidadId, accion, detalle, fecha, userId
            const a = await addLog('kits', kitId, 'update', 'Modificó cantidades del kit', userId, materiaId)
            return res
        });

        if(!updateItemKit) return res.status(502).json({msg: 'No hemos encontrado esto.'});
        // Avanzamos
        res.status(201).json({msg: 'Actualizado con exito'});
    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal'});
    }
}
// Clonar KIT
const clonarKit = async (req, res) => {
    const transaction = await db.transaction();
    try {
        const { kitId, userId } = req.params;
        if (!kitId) return res.status(400).json({ msg: 'Parámetro inválido' });

        // --- 1. CONSULTA INICIAL ---
        // Traemos el kit original con sus áreas y sus items de una sola vez.
        const kitOriginal = await kit.findByPk(kitId, {
            include: [
                { model: itemKit },
                { model: areaKit }
            ],
            transaction
        });

        if (!kitOriginal) {
            await transaction.rollback();
            return res.status(404).json({ msg: 'No hemos encontrado este kit' });
        }

        // --- 2. CREAR EL KIT CLONADO ---
        const nuevoKit = await kit.create({
            name: `${kitOriginal.name} - Copia`,
            description: kitOriginal.description,
            lineaId: kitOriginal.lineaId,
            categoriumId: kitOriginal.categoriumId,
            extensionId: kitOriginal.extensionId,
            state: 'desarrollo'
        }, { transaction });

        // --- 3. CLONAR LAS ÁREAS Y CREAR UN MAPA DE IDs ---
        const areaIdMap = new Map();

        if (kitOriginal.areaKits && kitOriginal.areaKits.length > 0) {
            // Preparamos los datos de las nuevas áreas
            const nuevasAreasData = kitOriginal.areaKits.map(area => ({
                name: area.name,
                kitId: nuevoKit.id, // ¡Asignadas al nuevo kit!
                state: area.state,
            }));

            // Creamos las nuevas áreas en la base de datos
            // `returning: true` es importante para que nos devuelva los objetos creados con sus nuevos IDs
            const nuevasAreasCreadas = await areaKit.bulkCreate(nuevasAreasData, { transaction, returning: true });

            // Creamos un mapa para saber la correspondencia: { 'ID_viejo': ID_nuevo, ... }
            kitOriginal.areaKits.forEach((areaVieja, index) => {
                areaIdMap.set(areaVieja.id, nuevasAreasCreadas[index].id);
            });
        }

        // --- 4. INSERCIÓN Y COMMIT ---
        if (kitOriginal.itemKits && kitOriginal.itemKits.length > 0) {
            const nuevosItems = kitOriginal.itemKits.map(item => (
                
            console.log(item),
                {
                
                cantidad: item.cantidad,
                medida: item.medida,
                calibre: item.calibre,
                materiaId: item.materiaId,
                areaId: item.areaId ? areaIdMap.get(item.areaId) : null,
                kitId: nuevoKit.id
            }));
            await itemKit.bulkCreate(nuevosItems, { transaction });
        }
        
        // Confirmamos que toda la operación en la base de datos fue exitosa
        await transaction.commit();

        // --- 5. PASO FINAL: BUSCAMOS EL KIT COMPLETO PARA LA RESPUESTA ---
        const kitClonadoCompleto = await kit.findByPk(nuevoKit.id, {
            // Incluimos toda la información que el frontend necesita
            include: [
                {
                    model: itemKit,
                    include: [materia] // AHORA SÍ incluimos la materia prima
                },
                {
                    model: areaKit
                }
            ]
        });

        // Enviamos el objeto completo en la respuesta
        return res.status(201).json({ 
            msg: 'Kit, áreas e items clonados con éxito!', 
            nuevoKit: kitClonadoCompleto // Enviamos la versión completa
        });

    } catch (err) {
        if (transaction) await transaction.rollback();
        console.error('Error en la función clonarKit:', err);
        res.status(500).json({ msg: 'Ha ocurrido un error en el servidor.' });
    }
}


// Eliminar elemento del Kit
const deleteItemOnKit = async(req, res) => {
    try{
        // Recibo dos varaibles por body
        const { itemKitId, kitId, itemId, userId} = req.body;
        // Validamos
        if(!itemKitId ) return res.status(501).json({msg: 'Los parámetros no son validos'});
        
        // Caso contrario, avanzamos...
        const sendToDelete = await deleteDeleteItemOnKit(itemKitId, kitId, itemId)
        .then(async res => {
            const updateKit = await changeState(kitId, 'desarrollo')
            return res
        })
        .then(async (res) => {
            // Entidad, entidadId, accion, detalle, fecha, userId
            const a = await addLog('kits', kitId, 'delete', 'Elimino matería prima del kit', userId, itemId)
            return res
        })
        .catch(err => null);

        if(sendToDelete == 502) return res.status(502).json({msg: 'No hemos logrado eliminar esto.'});
        // Caso contrario.
        res.status(200).json({msg: 'Eliminado con éxito'})
    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal'});
    }
}

const changeStateToKit = async(req, res) => {
    try{
        // Recibo parámetros por body
        const { kitId, state, userId } = req.body;
        if(!kitId || !state) return res.status(501).json({msg: 'Los parámetros no son validos'});
        // Caso contrario

        const sendPeti = await changeState(kitId, state).catch(err => null)
        if(!sendPeti) return res.status(502).json({msg: 'No hemos logrado actualizar esto'});
        // caso contrario, actualizado con exito.
        const a = await addLog('kits', addKit, 'update', `Cambio el estado del kit a ${state}`, userId)
        res.status(200).json({msg: 'Actualizado con éxito'})
    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal.'})
    }
}
// Eliminar Kit
const deleteKit = async(req, res) => {
    try{
        const { kitId, userId } = req.params;

        if(!kitId) return res.status(501).json({msg: 'El parámetro no es valido.'});
        // Caso contrario, avanzamos

        const kitAEliminar = await kit.findByPk(kitId).catch(err => null);
        // Validamos
        if(!kitAEliminar) return res.status(404).json({msg: 'No hemos encontrado este kit.'});
        
        const sendRemove = await kitAEliminar.destroy()
        .then(async (res) => {
            // Entidad, entidadId, accion, detalle, fecha, userId
            const a = await addLog('kits', kitId, 'delete', 'Eliminó kit', userId)
            return res
        }).catch(err => {
            console.log(err);
            return null;
        });

        if(!sendRemove) return res.state(502).json({msg: 'No hemos logrado eliminar esto'});
        // Caso contrario, avanzamos
        res.status(200).json({msg: 'Eliminado con éxito'});

    }catch(err){    
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal'});
    }
}

// ITERAR SOFTWARE
const givePriceToKit = async (req, res) => { 
    try{
        // Primero obtenemos todos los kit.
        const searchAllKits = await kit.findAll();
        // Validamos
        if(!searchAllKits) return res.status(404).json({msg: 'No hay click'});
        // Los iteramos
        searchAllKits.forEach(async (k) => {
            //Obtenemos el kit
            const miniKit = await givePercentage(k.id);
            // Obtenemos la materia prima y obtenemos precios mapeando
            const costo = miniKit.itemKits.map((it) => getPromedio(it))
            // Reduzco y obtengo la suma promedio
            const getPrice = costo.reduce((acc, costo) => acc + costo, 0);
            // Lo convertimos en numero sin decimales.
            const valor = Number(getPrice).toFixed(0)

            // Envio valor y kit, para asignar precio
            const sendingAddPrice = await givePriceToKitServices(miniKit.id, valor)
            console.log(`${miniKit.name} - ${valor} COP`)
        })

        res.status(200).json({msg: 'finish'})
        // Buscamos la materia prima y medidas

        // Obtenemos el precio promedio

        // Si no existe el precio
            // LO CREAMOS

        // Caso contrario. 
            // BUSCAMOS EL PRECIO ACTIVO. 
            // LO DESACTIVAMOS Y CREAMOS EL NUEVO.
    }catch(err){
        console.log(err);
        res.status(500).json({msG: 'Ha ocurrido un error en la principal.'});
    }
}

module.exports = { 
    searchKitsQuery, // SearchKits With Query
    addKit, // Agregamos KIT.
    getProduccion, // Obtenemos todo
    getKitPorFecha, // Obtenemos resultados por fecha
    getKitsFiltrados, // Obtenemos grupo para gráfica
    addSegmento, // Nuevo segmento
    updateSegmento, // Actualizar segmento
    addItem, // Agregar Item
    updateKitt, // Actualizar kit
    clonarKit, // Clonar Kit
    deleteKit, // Eliminar Kit
    getKit, // Obtenemos el KIT
    deleteItemOnKit, // Eliminar item del kit
    getAllKit, // Obtenemos todos los kits 
    getKits, // Obtenemos los kits sin precios
    changeStateToKit, // Actualizar estado del kit
    getAllKitCompleted, // Obtener solo kits completos
    updateItemOnKit, // Update ItemKits
    searchKitsForCoti, // Buscamos kits para cotizar
    deleteSegmento, // Eliminar segmento


    givePriceToKit, // Obtener precio
}