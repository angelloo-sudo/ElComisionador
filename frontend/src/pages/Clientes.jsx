import { useState } from 'react'
import ClienteFormModal from '../components/clientes/ClienteFormModal.jsx'

export default function Clientes() {
  const [modalAbierto, setModalAbierto] = useState(false)

  function handleSaved(cliente) {
    // TODO: cuando Facu tenga la tabla, refrescarla aca (o via hook compartido)
    console.log('Cliente guardado:', cliente)
  }

  return (
    <section>
      <h1>Clientes</h1>
      <button onClick={() => setModalAbierto(true)}>+ Nuevo cliente</button>

      {/* TODO (Facu): tabla, buscador y boton editar por fila */}

      {modalAbierto && (
        <ClienteFormModal
          cliente={null}
          onClose={() => setModalAbierto(false)}
          onSaved={handleSaved}
        />
      )}
    </section>
  )
}