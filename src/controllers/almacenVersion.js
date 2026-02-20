const { trasladarPiezasCompletasVersion, requierePiezasCompletas, obtenerUnidadItem } = require('./services/inventarioServicesVersion');

/**
 * Controlador para registrar movimientos versionados
 * Transferencia de bodega 1→4 (MP) o 2→5 (PT) con piezas completas para mt2/mt
 * Sin compromiso en bodega origen
 * Relacionado con orden de compra
 */
const registrarMovimientosVersion = async (req, res) => {
  try {
    const {
      materiaId,
      productoId,
      cantidad,
      tipoProducto,
      tipo,
      ubicacionOrigenId,
      ubicacionDestinoId,
      refDoc,
      cotizacionId,
      comprasCotizacionId, // OBLIGATORIO para version nueva
      usuarioId
    } = req.body;

    // Validaciones básicas
    if (!tipoProducto || !tipo || !refDoc) {
      return res.status(400).json({ 
        msg: 'Parámetros no válidos: tipoProducto, tipo y refDoc son requeridos.' 
      });
    }

    // Solo soportamos TRANSFERENCIA en esta versión
    if (tipo !== 'TRANSFERENCIA') {
      return res.status(400).json({ 
        msg: 'Esta versión solo soporta TRANSFERENCIA. Use la ruta original para otros tipos.' 
      });
    }

    // Validaciones para TRANSFERENCIA
    if ((!materiaId && !productoId) || !cantidad || !ubicacionOrigenId || !ubicacionDestinoId) {
      return res.status(400).json({ 
        msg: 'Para TRANSFERENCIA necesita materiaId o productoId, cantidad, ubicacionOrigenId y ubicacionDestinoId.' 
      });
    }

    // Validar comprasCotizacionId (obligatorio en versión nueva)
    if (!comprasCotizacionId) {
      return res.status(400).json({ 
        msg: 'comprasCotizacionId es obligatorio para transferencias versionadas. Debe estar relacionado con una orden de compra.' 
      });
    }

    // Validar que sea transferencia de bodega correcta
    // Bodega 1 → 4 (Materia Prima) o Bodega 2 → 5 (Producto Terminado)
    const esTransferenciaValida = 
      (ubicacionOrigenId === 1 && ubicacionDestinoId === 4) || // MP
      (ubicacionOrigenId === 2 && ubicacionDestinoId === 5);   // PT

    if (!esTransferenciaValida) {
      return res.status(400).json({ 
        msg: 'Transferencia versionada solo permite: Bodega 1→4 (Materia Prima) o Bodega 2→5 (Producto Terminado).' 
      });
    }

    // Validar tipoProducto coincide con bodegas
    if (ubicacionOrigenId === 1 && tipoProducto !== 'Materia Prima' && tipoProducto !== 'MP') {
      return res.status(400).json({ 
        msg: 'Bodega 1 es para Materia Prima. tipoProducto debe ser "Materia Prima" o "MP".' 
      });
    }

    if (ubicacionOrigenId === 2 && tipoProducto !== 'Producto' && tipoProducto !== 'PR') {
      return res.status(400).json({ 
        msg: 'Bodega 2 es para Producto Terminado. tipoProducto debe ser "Producto" o "PR".' 
      });
    }

    // Obtener información del item para determinar si necesita piezas completas
    let itemInfo;
    try {
      itemInfo = await obtenerUnidadItem(materiaId, productoId);
    } catch (error) {
      return res.status(404).json({ msg: error.message });
    }

    const necesitaPiezasCompletas = requierePiezasCompletas(itemInfo.unidad);

    // Ejecutar transferencia
    console.log('[REGISTRAR_MOVIMIENTOS_VERSION] Ejecutando transferencia con datos:', {
      materiumId: materiaId || null,
      productoId: productoId || null,
      cantidadSolicitada: cantidad,
      ubicacionOrigenId,
      ubicacionDestinoId,
      refDoc,
      comprasCotizacionId,
      cotizacionId: cotizacionId || null,
      tipoProducto
    });

    const resultado = await trasladarPiezasCompletasVersion({
      materiumId: materiaId || null,
      productoId: productoId || null,
      cantidadSolicitada: cantidad,
      ubicacionOrigenId,
      ubicacionDestinoId,
      refDoc,
      comprasCotizacionId,
      cotizacionId: cotizacionId || null,
      usuarioId: req.user ? req.user.id : usuarioId || null,
      ordenarPor: 'DESC' // Piezas grandes primero
    });

    console.log('[REGISTRAR_MOVIMIENTOS_VERSION] Transferencia completada exitosamente:', {
      cantidadTransferida: resultado.cantidadTransferida,
      cantidadSolicitada: resultado.cantidadSolicitada,
      detalles: resultado.detalles?.length || 0
    });

    return res.status(201).json({
      success: true,
      msg: necesitaPiezasCompletas 
        ? 'Transferencia de piezas completas realizada exitosamente.' 
        : 'Transferencia realizada exitosamente.',
      data: resultado
    });

  } catch (err) {
    console.error('Error en registrarMovimientosVersion:', err);
    return res.status(500).json({ 
      success: false,
      msg: 'Ha ocurrido un error en registrarMovimientosVersion', 
      error: err.message 
    });
  }
};

/**
 * Endpoint para verificar si un item requiere piezas completas
 * Útil para el frontend saber qué lógica usar
 */
const verificarRequierePiezasCompletas = async (req, res) => {
  try {
    const { materiaId, productoId } = req.query;

    if (!materiaId && !productoId) {
      return res.status(400).json({ 
        msg: 'Debe proporcionar materiaId o productoId.' 
      });
    }

    const itemInfo = await obtenerUnidadItem(
      materiaId ? Number(materiaId) : null,
      productoId ? Number(productoId) : null
    );

    const requiere = requierePiezasCompletas(itemInfo.unidad);

    return res.status(200).json({
      success: true,
      materiaId: materiaId ? Number(materiaId) : null,
      productoId: productoId ? Number(productoId) : null,
      unidad: itemInfo.unidad,
      tipo: itemInfo.tipo,
      requierePiezasCompletas: requiere
    });

  } catch (err) {
    console.error('Error en verificarRequierePiezasCompletas:', err);
    return res.status(500).json({ 
      success: false,
      msg: 'Error al verificar unidad', 
      error: err.message 
    });
  }
};

/**
 * Endpoint de prueba - Muestra información útil para testing
 * Ayuda a entender qué datos necesitas para probar
 */
const endpointPrueba = async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      msg: 'Endpoint de prueba - Rutas versionadas funcionando',
      rutas: {
        transferencia: 'POST /api/inventario-version/post/bodega/movimientos-version',
        verificar: 'GET /api/inventario-version/get/verificar/piezas-completas'
      },
      ejemploTransferencia: {
        materiaId: 123, // ID de materia prima (opcional si usas productoId)
        productoId: null, // ID de producto (opcional si usas materiaId)
        cantidad: 3.2, // Cantidad solicitada
        tipoProducto: 'Materia Prima', // 'Materia Prima' o 'MP' para bodega 1, 'Producto' o 'PR' para bodega 2
        tipo: 'TRANSFERENCIA', // Siempre 'TRANSFERENCIA' en esta versión
        ubicacionOrigenId: 1, // 1 para MP, 2 para PT
        ubicacionDestinoId: 4, // 4 para MP, 5 para PT
        refDoc: 'REF-TEST-001', // Referencia del documento
        comprasCotizacionId: 456, // OBLIGATORIO - ID de orden de compra
        cotizacionId: 789 // Opcional - ID de cotización/proyecto
      },
      ejemploVerificar: {
        url: '/api/inventario-version/get/verificar/piezas-completas?materiaId=123',
        queryParams: {
          materiaId: 'ID de materia prima (opcional)',
          productoId: 'ID de producto (opcional)'
        }
      },
      notas: [
        'Para mt2 y mt: transfiere piezas completas automáticamente',
        'Para kg, unidades, etc.: transfiere cantidad exacta',
        'comprasCotizacionId es OBLIGATORIO',
        'Solo permite Bodega 1→4 (MP) o 2→5 (PT)',
        'No compromete stock en bodega origen',
        'Material llega a bodega destino como disponible (pool compartido)'
      ]
    });
  } catch (err) {
    return res.status(500).json({ 
      success: false,
      msg: 'Error en endpoint de prueba', 
      error: err.message 
    });
  }
};

module.exports = {
  registrarMovimientosVersion,
  verificarRequierePiezasCompletas,
  endpointPrueba
};
