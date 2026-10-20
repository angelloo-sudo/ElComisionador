// Epica 7: Administracion de Gastos (US40 a US48). Dos pestanas: gastos y tipos de gasto.
import { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client.js'
import Icon from '../components/Icon.jsx'
import { Toast } from '../components/ui.jsx'
import GastosTab from '../components/gastos/GastosTab.jsx'
import TiposGastoTab from '../components/gastos/TiposGastoTab.jsx'

export default function Gastos() {
  const [pestana, setPestana] = useState('gastos')
  // Tipos de gasto: alimentan los selectores y filtros de la pestana de gastos.
  const [tipos, setTipos] = useState([])
  const [errorTipos, setErrorTipos] = useState(null)
  const [toast, setToast] = useState(null)
  const cerrarToast = useCallback(() => setToast(null), [])

  const cargarTipos = useCallback(() => {
    api.get('/finanzas/tipos-gasto')
      .then((lista) => { setTipos(lista); setErrorTipos(null) })
      .catch((err) => setErrorTipos(err.message))
  }, [])

  useEffect(() => { cargarTipos() }, [cargarTipos])

  return (
    <section>
      <div className="pestanas" role="tablist" aria-label="Administración de gastos">
        <button type="button" role="tab" aria-selected={pestana === 'gastos'} className={pestana === 'gastos' ? 'activo' : ''} onClick={() => setPestana('gastos')}>
          <Icon nombre="wallet" tamano={16} /> Gastos
        </button>
        <button type="button" role="tab" aria-selected={pestana === 'tipos'} className={pestana === 'tipos' ? 'activo' : ''} onClick={() => setPestana('tipos')}>
          <Icon nombre="tag" tamano={16} /> Tipos de gasto
        </button>
      </div>

      {errorTipos && <p className="campo-error" style={{ marginBottom: 16 }}><Icon nombre="alert" tamano={16} />No se pudieron cargar los tipos de gasto: {errorTipos}</p>}

      {pestana === 'gastos'
        ? <GastosTab tipos={tipos} avisar={setToast} />
        : <TiposGastoTab onCambio={cargarTipos} avisar={setToast} />}

      {toast && <Toast titulo={toast.titulo} texto={toast.texto} onClose={cerrarToast} />}
    </section>
  )
}
