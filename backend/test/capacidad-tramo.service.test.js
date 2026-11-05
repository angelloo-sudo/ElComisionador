import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { lugaresEnTramo } from '../src/services/capacidad-tramo.service.js'

const paradas = [{ localidad: 'Río Cuarto' }, { localidad: 'Villa María' }]
const base = { paradas, origen: 'Vicuña Mackenna', destino: 'Córdoba' }

describe('capacidad por tramos', () => {
  it('permite reutilizar un asiento en tramos consecutivos', () => {
    const reservas = [
      { origen_localidad: 'Vicuña Mackenna', destino_localidad: 'Río Cuarto', cantidad_pasajeros: 1 },
      { origen_localidad: 'Río Cuarto', destino_localidad: 'Villa María', cantidad_pasajeros: 1 },
    ]
    assert.equal(lugaresEnTramo({ ...base, reservas, desde: 'Villa María', hasta: 'Córdoba' }), 0)
    assert.equal(lugaresEnTramo({ ...base, reservas, desde: 'Vicuña Mackenna', hasta: 'Villa María' }), 1)
  })

  it('suma reservas superpuestas y asigna conservadoramente el viaje entero a solicitudes no mapeables', () => {
    const reservas = [
      { origen_localidad: 'Vicuña Mackenna', destino_localidad: 'Villa María', cantidad_pasajeros: 2 },
      { origen_localidad: 'Localidad histórica', destino_localidad: 'Córdoba', cantidad_pasajeros: 1 },
    ]
    assert.equal(lugaresEnTramo({ ...base, reservas, desde: 'Río Cuarto', hasta: 'Córdoba' }), 3)
  })
})
