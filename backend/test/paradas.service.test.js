import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mejorOrden, kmDeOrden } from '../src/services/paradas.service.js'

// Puntos: 0 = inicio, 1..n = paradas, n+1 = fin. Se arma una matriz a partir de coordenadas planas.
function matrizDe(coords) {
  return coords.map((a) => coords.map((b) => Math.hypot(a[0] - b[0], a[1] - b[1])))
}

describe('ruta sugerida: mejor orden de paradas', () => {
  it('respeta que cada persona suba antes de bajar y elige el recorrido mas corto', () => {
    // inicio (0,0), fin (10,0). Parada 0: sube en (2,0); parada 1: baja de esa persona en (8,3);
    // parada 2: sube otra persona en (3,3); parada 3: baja en (9,0).
    const coords = [[0, 0], [2, 0], [8, 3], [3, 3], [9, 0], [10, 0]]
    const m = matrizDe(coords)
    const precede = [-1, 0, -1, 2]
    const mejor = mejorOrden(m, 4, precede)
    const pos = (i) => mejor.orden.indexOf(i)
    assert.ok(pos(0) < pos(1) && pos(2) < pos(3))
    // Ningun otro orden valido es mas corto.
    const todos = []
    const perm = (a, r = []) => { if (!a.length) todos.push(r); a.forEach((x, i) => perm([...a.slice(0, i), ...a.slice(i + 1)], [...r, x])) }
    perm([0, 1, 2, 3])
    const validos = todos.filter((o) => o.indexOf(0) < o.indexOf(1) && o.indexOf(2) < o.indexOf(3))
    const minimo = Math.min(...validos.map((o) => kmDeOrden(m, 4, o)))
    assert.ok(Math.abs(mejor.km - minimo) < 1e-9)
    // Y mejora al orden "por la ruta" (0,2,1,3 -> 2,0,... no): el de ir parada por parada segun su posicion en X.
    const porX = [0, 2, 1, 3]
    assert.ok(mejor.km <= kmDeOrden(m, 4, porX) + 1e-9)
  })
})
