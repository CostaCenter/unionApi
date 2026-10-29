/**
 * Normaliza cantidades de materia prima mt2/mt para cotizacion_compromiso.
 * El compromiso del proyecto siempre debe registrar mt2 o mt, no piezas (láminas/tubos).
 */

function parseMedidaMaterial(medida) {
  if (medida == null || medida === '') return null;
  let s = String(medida).trim().toLowerCase();
  s = s.replace(/\s*(m2|m²|mt2|metros2|metros cuadrados)\s*$/i, '').trim();

  const multMatch = s.match(/(-?\d*\.?\d+)\s*(?:x|×|\*|por)\s*(-?\d*\.?\d+)/i);
  if (multMatch) {
    let a = parseFloat(multMatch[1]);
    let b = parseFloat(multMatch[2]);
    if (Number.isNaN(a) || Number.isNaN(b)) return null;
    if (Math.abs(a) >= 50) a /= 100;
    if (Math.abs(b) >= 50) b /= 100;
    return Number((a * b).toFixed(6));
  }

  const compactMatch = s.match(/^(-?\d*\.?\d+)[x×*](-?\d*\.?\d+)$/i);
  if (compactMatch) {
    let a = parseFloat(compactMatch[1]);
    let b = parseFloat(compactMatch[2]);
    if (Number.isNaN(a) || Number.isNaN(b)) return null;
    if (Math.abs(a) >= 50) a /= 100;
    if (Math.abs(b) >= 50) b /= 100;
    return Number((a * b).toFixed(6));
  }

  const num = parseFloat(s.replace(',', '.'));
  if (!Number.isNaN(num)) return Number(num);
  return null;
}

function esUnidadLongitudOPArea(unidad) {
  const u = String(unidad || '').toLowerCase().trim();
  return u === 'mt2' || u === 'mt';
}

/**
 * @param {number} cantidad - Valor recibido (piezas, mt2 o mt según origen)
 * @param {{ unidad?: string, medida?: string }} material
 * @param {{ cantidadPiezasOc?: number, cantidadComprometida?: number }} [ctx]
 * @returns {number}
 */
function normalizarCantidadCompromisoMateriaPrima(cantidad, material, ctx = {}) {
  const n = Number(cantidad);
  if (!Number.isFinite(n) || n <= 0) return n;

  if (!material || !esUnidadLongitudOPArea(material.unidad)) {
    return n;
  }

  const medidaPieza = parseMedidaMaterial(material.medida);
  if (!(medidaPieza > 0)) return n;

  const { cantidadPiezasOc, cantidadComprometida } = ctx;
  const enUnidadConsumo = n * medidaPieza;

  // Ya está en mt2/mt (itemToProject, transferencia física, etc.)
  if (cantidadComprometida != null && cantidadComprometida > 0) {
    if (n > (Number(cantidadPiezasOc) || 0) + 0.01 && n <= cantidadComprometida * 1.08) {
      return Number(n.toFixed(6));
    }
  }

  const piezasOc = cantidadPiezasOc != null ? Number(cantidadPiezasOc) : null;
  const esEntero = Math.abs(n - Math.round(n)) < 1e-6;

  // Legacy: valor = piezas (a menudo igual a la cantidad de la línea OC)
  const parecePiezas =
    esEntero &&
    piezasOc != null &&
    piezasOc > 0 &&
    n <= piezasOc + 1e-6 &&
    enUnidadConsumo > n + 0.01;

  if (parecePiezas) {
    return Number(enUnidadConsumo.toFixed(6));
  }

  if (piezasOc != null && Math.abs(n - piezasOc) < 1e-6) {
    return Number(enUnidadConsumo.toFixed(6));
  }

  return n;
}

/**
 * Reparto proporcional: convierte el total de asignaciones a mt2/mt si venía en piezas.
 */
function repartoCompromisoDesdeAsignaciones(asignaciones, material, cantidadPiezasOc) {
  const lista = Array.isArray(asignaciones) ? asignaciones : [];
  const totalAsignado = lista.reduce((s, a) => s + Number(a.cantidad || 0), 0);
  if (!(totalAsignado > 0)) {
    return lista.map((a) => ({ ...a, cantidadCompromiso: 0 }));
  }

  const totalMt = normalizarCantidadCompromisoMateriaPrima(totalAsignado, material, {
    cantidadPiezasOc,
  });

  return lista.map((a) => {
    const cantidad = Number(a.cantidad || 0);
    const cantidadCompromiso =
      totalAsignado > 0 ? Number(((cantidad / totalAsignado) * totalMt).toFixed(6)) : 0;
    return { ...a, cantidadCompromiso };
  });
}

module.exports = {
  parseMedidaMaterial,
  esUnidadLongitudOPArea,
  normalizarCantidadCompromisoMateriaPrima,
  repartoCompromisoDesdeAsignaciones,
};
