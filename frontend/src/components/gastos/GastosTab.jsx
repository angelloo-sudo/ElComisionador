// US43 - Consultar gastos (con filtros y total), US40 registrar, US41 modificar, US42 eliminar
// y US44 asociar un gasto a un tipo de gasto (selector dentro de la tabla).
// El tipo de gasto es el concepto del gasto.
import { useCallback, useEffect, useState } from 'react'
import { api } from '../../api/client.js'
import Icon from '../Icon.jsx'
import { Alerta, Campo } from '../ui.jsx'
import ConfirmarBajaModal from './ConfirmarBajaModal.jsx'
import GastoDetalleModal from './GastoDetalleModal.jsx'
import GastoFormModal from './GastoFormModal.jsx'
import { formatoFechaISO, formatoMoneda } from '../../utils/gastos.js'

const FILTROS_VACIOS = { desde: '', hasta: '', tipo: '' }

export default function GastosTab({ tipos, avisar }) {
  const [datos, setDatos] = useState({ gastos: [], resumen: { cantidad: 0, total: '0.00' } })
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [filtros, setFiltros] = useState(FILTROS_VACIOS)
  const [filtrosAplicados, setFiltrosAplicados] = useState(FILTROS_VACIOS)
  const [errorFiltros, setErrorFiltros] = useState(null)
  const [formulario, setFormulario] = useState(null) // null | { gasto: null | gasto }
  const [detalle, setDetalle] = useState(null)
  const [gastoAEliminar, setGastoAEliminar] = useState(null)
  const [clasificando, setClasificando] = useState(null)
  const [errorClasificar, setErrorClasificar] = useState(null)

  const hayFiltrosActivos = Object.values(filtrosAplicados).some(Boolean)

  // silencioso: refresca la tabla sin mostrar "Cargando..." (se usa al clasificar desde la fila).
  const cargar = useCallback((filtrosParaBuscar, { silencioso = false } = {}) => {
    if (!silencioso) setCargando(true)
    setError(null)
    const params = new URLSearchParams()
    Object.entries(filtrosParaBuscar).forEach(([clave, valor]) => { if (valor) params.set(clave, valor) })
    return api.get(`/finanzas/gastos?${params.toString()}`)
      .then(setDatos)
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false))
  }, [])

  useEffect(() => { cargar(filtrosAplicados) }, [cargar, filtrosAplicados])

  const handleFiltroChange = (e) => setFiltros({ ...filtros, [e.target.name]: e.target.value })

  function handleBuscar(e) {
    e.preventDefault()
    if (filtros.desde && filtros.hasta && filtros.desde > filtros.hasta) {
      setErrorFiltros('La fecha "desde" no puede ser posterior a "hasta".')
      return
    }
    setErrorFiltros(null)
    setFiltrosAplicados(filtros)
  }

  function handleLimpiar() {
    setErrorFiltros(null)
    setFiltros(FILTROS_VACIOS)
    setFiltrosAplicados(FILTROS_VACIOS)
  }

  function handleGuardado(gasto, editando) {
    setFormulario(null)
    setDetalle(null)
    cargar(filtrosAplicados)
    avisar(editando
      ? { titulo: 'Gasto modificado', texto: `Se actualizó el gasto de ${gasto.tipo_nombre}.` }
      : { titulo: 'Gasto registrado', texto: `${gasto.tipo_nombre} por ${formatoMoneda(gasto.monto)}.` })
  }

  async function confirmarEliminacion() {
    const gasto = gastoAEliminar
    await api.del(`/finanzas/gastos/${gasto.id}`)
    setGastoAEliminar(null)
    setDetalle(null)
    cargar(filtrosAplicados)
    avisar({ titulo: 'Gasto eliminado', texto: `Se eliminó el gasto de ${gasto.tipo_nombre}.` })
  }

  // US44: cambia el tipo de un gasto directamente desde la tabla.
  async function clasificar(gasto, valor) {
    setClasificando(gasto.id)
    setErrorClasificar(null)
    try {
      const actualizado = await api.patch(`/finanzas/gastos/${gasto.id}/tipo`, { tipo_gasto_id: Number(valor) })
      await cargar(filtrosAplicados, { silencioso: true })
      avisar({ titulo: 'Gasto clasificado', texto: `Ahora es de tipo ${actualizado.tipo_nombre}.` })
    } catch (err) {
      setErrorClasificar(err.message)
    } finally {
      setClasificando(null)
    }
  }

  return (
    <section>
      <div className="barra-pagina">
        <div>
          <h2>Mis gastos</h2>
          <p>Registrá y consultá los gastos generales de tu actividad.</p>
        </div>
        <button type="button" className="btn btn-primario" onClick={() => setFormulario({ gasto: null })}>
          <Icon nombre="plus" tamano={16} /> Registrar gasto
        </button>
      </div>

      <form className="card filtros-gastos" onSubmit={handleBuscar}>
        <Campo label="Desde" icono="calendar">
          <input type="date" name="desde" value={filtros.desde} onChange={handleFiltroChange} />
        </Campo>
        <Campo label="Hasta" icono="calendar">
          <input type="date" name="hasta" value={filtros.hasta} onChange={handleFiltroChange} />
        </Campo>
        <Campo label="Tipo de gasto" icono="tag">
          <select name="tipo" value={filtros.tipo} onChange={handleFiltroChange}>
            <option value="">Todos</option>
            {tipos.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
          </select>
          <Icon nombre="down" />
        </Campo>
        <div className="acciones">
          <button type="submit" className="btn btn-primario"><Icon nombre="search" tamano={16} /> Buscar</button>
          {hayFiltrosActivos && <button type="button" className="btn" onClick={handleLimpiar}>Limpiar</button>}
        </div>
      </form>

      {errorFiltros && <Alerta tipo="error" titulo="Revisá los filtros">{errorFiltros}</Alerta>}
      {error && <Alerta tipo="error" titulo="No se pudieron cargar los gastos">{error}</Alerta>}
      {errorClasificar && (
        <Alerta tipo="error" titulo="No se pudo clasificar el gasto" onCerrar={() => setErrorClasificar(null)}>{errorClasificar}</Alerta>
      )}

      <div className="gastos-resumen" aria-live="polite">
        <div><span>Total de gastos</span><strong>{formatoMoneda(datos.resumen.total)}</strong></div>
        <div><span>Cantidad</span><strong>{datos.resumen.cantidad}</strong></div>
      </div>

      <div className="card tabla-wrap">
        {cargando ? (
          <p className="vacio">Cargando gastos...</p>
        ) : datos.gastos.length === 0 ? (
          <p className="vacio">{hayFiltrosActivos ? 'No se encontraron gastos con esos filtros.' : 'Todavía no registraste gastos.'}</p>
        ) : (
          <table className="tabla">
            <thead>
              <tr><th>Fecha</th><th>Concepto (tipo de gasto)</th><th className="num">Monto</th><th></th></tr>
            </thead>
            <tbody>
              {datos.gastos.map((gasto) => (
                <tr key={gasto.id}>
                  <td>{formatoFechaISO(gasto.fecha)}</td>
                  <td title={gasto.descripcion || undefined}>
                    {tipos.find((t) => t.id === gasto.tipo_gasto_id)?.nombre ?? '—'}
                  </td>
                  <td className="num">{formatoMoneda(gasto.monto)}</td>
                  <td>
                    <div className="acciones-fila">
                      <button type="button" className="btn btn-chico" onClick={() => setDetalle(gasto)}>Ver detalle</button>
                      <button type="button" className="btn btn-chico" onClick={() => setFormulario({ gasto })}>
                        <Icon nombre="pencil" tamano={13} /> Modificar
                      </button>
                      <button type="button" className="btn btn-chico btn-peligro" onClick={() => setGastoAEliminar(gasto)}>Eliminar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {formulario && (
        <GastoFormModal gasto={formulario.gasto} tipos={tipos} onClose={() => setFormulario(null)} onGuardado={handleGuardado} />
      )}

      {detalle && (
        <GastoDetalleModal
          gasto={detalle}
          onClose={() => setDetalle(null)}
          onModificar={(gasto) => { setDetalle(null); setFormulario({ gasto }) }}
          onBaja={(gasto) => { setDetalle(null); setGastoAEliminar(gasto) }}
        />
      )}

      {gastoAEliminar && (
        <ConfirmarBajaModal
          titulo="¿Eliminar este gasto?"
          errorTitulo="No se pudo eliminar el gasto"
          onConfirmar={confirmarEliminacion}
          onClose={() => setGastoAEliminar(null)}
        >
          <p>{gastoAEliminar.tipo_nombre} · {formatoMoneda(gastoAEliminar.monto)} · {formatoFechaISO(gastoAEliminar.fecha)}</p>
          <p style={{ marginTop: 10 }}>Se elimina definitivamente y esta acción no se puede deshacer.</p>
        </ConfirmarBajaModal>
      )}
    </section>
  )
}
