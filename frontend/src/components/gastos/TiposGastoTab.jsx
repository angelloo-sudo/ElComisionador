// US47 - Consultar tipos de gasto, US45 registrar, US46 modificar y US48 eliminar.
import { useCallback, useEffect, useState } from 'react'
import { api } from '../../api/client.js'
import Icon from '../Icon.jsx'
import { Alerta, Campo } from '../ui.jsx'
import ConfirmarBajaModal from './ConfirmarBajaModal.jsx'
import TipoGastoFormModal from './TipoGastoFormModal.jsx'

const FILTROS_VACIOS = { q: '' }

export default function TiposGastoTab({ onCambio, avisar }) {
  const [tipos, setTipos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [filtros, setFiltros] = useState(FILTROS_VACIOS)
  const [filtrosAplicados, setFiltrosAplicados] = useState(FILTROS_VACIOS)
  const [formulario, setFormulario] = useState(null) // null | { tipo: null | tipo }
  const [tipoAEliminar, setTipoAEliminar] = useState(null)

  const hayFiltrosActivos = filtrosAplicados.q !== ''

  const cargar = useCallback((filtrosParaBuscar) => {
    setCargando(true)
    setError(null)
    const params = new URLSearchParams()
    if (filtrosParaBuscar.q) params.set('q', filtrosParaBuscar.q)
    return api.get(`/finanzas/tipos-gasto?${params.toString()}`)
      .then(setTipos)
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false))
  }, [])

  useEffect(() => { cargar(filtrosAplicados) }, [cargar, filtrosAplicados])

  function handleBuscar(e) {
    e.preventDefault()
    setFiltrosAplicados({ q: filtros.q.trim() })
  }

  function handleLimpiar() {
    setFiltros(FILTROS_VACIOS)
    setFiltrosAplicados(FILTROS_VACIOS)
  }

  // Tras cualquier cambio se recarga la lista y se avisa a la pantalla para que actualice los selectores.
  function huboCambio() {
    cargar(filtrosAplicados)
    onCambio()
  }

  function handleGuardado(tipo, editando) {
    setFormulario(null)
    huboCambio()
    avisar(editando
      ? { titulo: 'Tipo de gasto modificado', texto: `Se actualizó "${tipo.nombre}".` }
      : { titulo: 'Tipo de gasto registrado', texto: `"${tipo.nombre}" ya está disponible para clasificar gastos.` })
  }

  async function confirmarEliminacion() {
    const tipo = tipoAEliminar
    await api.del(`/finanzas/tipos-gasto/${tipo.id}`)
    setTipoAEliminar(null)
    huboCambio()
    avisar({ titulo: 'Tipo de gasto eliminado', texto: `Se eliminó "${tipo.nombre}".` })
  }

  return (
    <section>
      <div className="barra-pagina">
        <div>
          <h2>Tipos de gasto</h2>
          <p>Categorías para clasificar los egresos de tu actividad.</p>
        </div>
        <button type="button" className="btn btn-primario" onClick={() => setFormulario({ tipo: null })}>
          <Icon nombre="plus" tamano={16} /> Registrar tipo
        </button>
      </div>

      <form className="card filtros-gastos filtros-tipos" onSubmit={handleBuscar}>
        <Campo label="Nombre" icono="search">
          <input value={filtros.q} onChange={(e) => setFiltros({ ...filtros, q: e.target.value })} placeholder="Buscar por nombre" />
        </Campo>
        <div className="acciones">
          <button type="submit" className="btn btn-primario"><Icon nombre="search" tamano={16} /> Buscar</button>
          {hayFiltrosActivos && <button type="button" className="btn" onClick={handleLimpiar}>Limpiar</button>}
        </div>
      </form>

      {error && <Alerta tipo="error" titulo="No se pudieron cargar los tipos de gasto">{error}</Alerta>}

      <div className="card tabla-wrap">
        {cargando ? (
          <p className="vacio">Cargando tipos de gasto...</p>
        ) : tipos.length === 0 ? (
          <p className="vacio">
            {hayFiltrosActivos ? 'No se encontraron tipos de gasto con esos filtros.' : 'Todavía no registraste tipos de gasto.'}
          </p>
        ) : (
          <table className="tabla">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Descripción</th>
                <th className="num">Gastos</th>
                                <th></th>
              </tr>
            </thead>
            <tbody>
              {tipos.map((tipo) => (
                <tr key={tipo.id}>
                  <td className="col-concepto">{tipo.nombre}</td>
                  <td className="col-descripcion">{tipo.descripcion || '-'}</td>
                  <td className="num">{tipo.cantidad_gastos}</td>
                  <td>
                    <div className="acciones-fila">
                      <button type="button" className="btn btn-chico" onClick={() => setFormulario({ tipo })}>
                        <Icon nombre="pencil" tamano={13} /> Modificar
                      </button>
                      <button type="button" className="btn btn-chico btn-peligro" onClick={() => setTipoAEliminar(tipo)}>Eliminar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {formulario && (
        <TipoGastoFormModal tipo={formulario.tipo} onClose={() => setFormulario(null)} onGuardado={handleGuardado} />
      )}

      {tipoAEliminar && (
        <ConfirmarBajaModal
          titulo={`¿Eliminar "${tipoAEliminar.nombre}"?`}
          errorTitulo="No se pudo eliminar el tipo de gasto"
          deshabilitarConfirmar={tipoAEliminar.cantidad_gastos > 0}
          onConfirmar={confirmarEliminacion}
          onClose={() => setTipoAEliminar(null)}
        >
          {tipoAEliminar.cantidad_gastos > 0 ? (
            <p>
              No se puede eliminar: tiene {tipoAEliminar.cantidad_gastos} gasto{tipoAEliminar.cantidad_gastos === 1 ? '' : 's'} asociado{tipoAEliminar.cantidad_gastos === 1 ? '' : 's'}.
              Cambiales el tipo o eliminalos primero.
            </p>
          ) : (
            <p>Se elimina definitivamente y esta acción no se puede deshacer.</p>
          )}
        </ConfirmarBajaModal>
      )}
    </section>
  )
}
