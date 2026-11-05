// US18: solo permite modificar horarios y cupos libres, preservando ruta y fecha.
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/client.js'
import Icon from '../components/Icon.jsx'
import { Alerta, BadgeEstado, Campo, ESTADOS_VIAJE, formatoFecha, textoRepeticion } from '../components/ui.jsx'
import { formatoDuracion, formatoKm, formatoPesos, calcularMonto } from '../utils/tarifa.js'
import { codigoViaje, SelectorHora } from './ViajeNuevo.jsx'
import LocalidadSelect from '../components/LocalidadSelect.jsx'
import useLocalidades from '../hooks/useLocalidades.js'
import MapaRuta from '../components/MapaRuta.jsx'
import { calcularLlegadasAcumuladas } from '../utils/horarios.js'

const partirHora = (valor) => valor ? [valor.slice(0, 2), valor.slice(3, 5)] : ['', '']
const horaValida = (valor) => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(valor)

export default function ViajeEditar() {
  const { id } = useParams()
  const navegar = useNavigate()
  const [original, setOriginal] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState('')
  const [cupo, setCupo] = useState('')
  const [paradas, setParadas] = useState([])
  const { localidades, cargando: cargandoLocalidades } = useLocalidades()
  const [salida, setSalida] = useState(['', ''])
  const [llegada, setLlegada] = useState(['', ''])
  const [precioKm, setPrecioKm] = useState(null)
  const [errores, setErrores] = useState({})
  const [errorGeneral, setErrorGeneral] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [ruta, setRuta] = useState(null)

  useEffect(() => {
    api.get(`/viajes/${id}`).then((viaje) => {
      setOriginal(viaje)
      setCupo(String(viaje.cupo_total))
      setParadas(viaje.paradas ?? [])
      setSalida(partirHora(viaje.hora_salida))
      setLlegada(partirHora(viaje.hora_llegada))
    }).catch((error) => setErrorCarga(error.message)).finally(() => setCargando(false))
    api.get('/tarifa').then((tarifa) => setPrecioKm(tarifa.precio_km)).catch(() => setPrecioKm(null))
  }, [id])

  const horaSalida = salida.every(Boolean) ? `${salida[0]}:${salida[1]}` : ''
  const horarioAutomatico = paradas.length > 0 || (original?.paradas?.length ?? 0) > 0
  const firmaRecorrido = JSON.stringify([original?.origen, ...paradas.map((p) => p.localidad), original?.destino])
  const horariosAuto = horarioAutomatico && ruta?.firma === firmaRecorrido && !ruta.aproximada
    ? calcularLlegadasAcumuladas(horaSalida, ruta.tramos?.map((t) => t.duracion_min) ?? [])
    : null
  const horaLlegada = horarioAutomatico
    ? horariosAuto?.at(-1) ?? ''
    : llegada.every(Boolean) ? `${llegada[0]}:${llegada[1]}` : ''
  const llegadasParadas = horariosAuto?.slice(0, paradas.length) ?? []
  const ocupados = original?.ocupados ?? 0
  const sinCambios = useMemo(() => original && horaSalida === original.hora_salida?.slice(0, 5)
    && horaLlegada === original.hora_llegada?.slice(0, 5) && Number(cupo) === original.cupo_total
    && JSON.stringify(paradas) === JSON.stringify(original.paradas ?? []),
  [original, horaSalida, horaLlegada, cupo, paradas])
  const distancia = original?.distancia_km == null ? null : Number(original.distancia_km)

  function validar() {
    const nuevos = {}
    if (!horaValida(horaSalida)) nuevos.salida = 'Ingresa una hora válida (HH:MM)'
    if (!horaValida(horaLlegada)) nuevos.llegada = 'Ingresa una hora válida (HH:MM)'
    else if (horaValida(horaSalida) && horaLlegada <= horaSalida) nuevos.llegada = 'La llegada debe ser posterior a la salida y el mismo día'
    const capacidad = Number(cupo)
    if (cupo === '' || !Number.isInteger(capacidad) || capacidad < 0) nuevos.cupo = 'Indica una capacidad entera igual o mayor a cero'
    else if (capacidad < ocupados) nuevos.cupo = `La capacidad no puede ser menor que los ${ocupados} lugares ocupados`
    const puntos = [original.origen, ...paradas.map((p) => p.localidad), original.destino]
    if (new Set(puntos.map((p) => p?.trim().toLocaleLowerCase())).size !== puntos.length) nuevos.paradas = 'No repitas localidades en el recorrido'
    if (horarioAutomatico && !horariosAuto) nuevos.paradas = ruta?.firma === firmaRecorrido && !ruta.aproximada
      ? 'El horario calculado supera la medianoche del mismo día'
      : 'Esperá el cálculo exacto de todos los tramos antes de guardar'
    let anterior = horaSalida
    paradas.forEach((p, i) => {
      const hora = horarioAutomatico ? llegadasParadas[i] : p.hora_estimada
      if (!p.localidad || !horaValida(hora) || hora <= anterior || hora >= horaLlegada) nuevos.paradas = `Revisá el horario de la parada ${i + 1}`
      anterior = hora
    })
    return nuevos
  }

  async function guardar(evento) {
    evento.preventDefault()
    setErrorGeneral(null)
    if (sinCambios) return setErrorGeneral({ tipo: 'aviso', titulo: 'No hay cambios para guardar', texto: 'Modificá un horario o la capacidad para continuar.' })
    const nuevos = validar()
    setErrores(nuevos)
    if (Object.keys(nuevos).length) return setErrorGeneral({ tipo: 'error', titulo: 'Revisá los datos', texto: 'Corregí los horarios y la capacidad antes de guardar.' })
    setGuardando(true)
    try {
      await api.put(`/viajes/${id}`, { hora_salida: horaSalida, hora_llegada: horaLlegada, cupo_total: Number(cupo), paradas: paradas.map((p, i) => ({ ...p, hora_estimada: horarioAutomatico ? llegadasParadas[i] : p.hora_estimada })) })
      navegar('/viajes', { state: { aviso: { titulo: 'Viaje modificado', texto: `Se guardaron los cambios del viaje ${codigoViaje(id)}. Los clientes vinculados recibieron una notificación.` } } })
    } catch (error) {
      setErrorGeneral({ tipo: 'error', titulo: 'No se pudo modificar el viaje', texto: error.message })
    } finally { setGuardando(false) }
  }

  const migas = <nav className="migas" aria-label="Ruta"><button type="button" onClick={() => navegar('/viajes')}>Viajes</button><Icon nombre="right" tamano={14} /><strong>Modificar viaje {codigoViaje(id)}</strong></nav>
  if (cargando) return <section>{migas}<p className="vacio">Cargando viaje...</p></section>
  if (errorCarga || !original) return <section>{migas}<Alerta tipo="error" titulo="No se pudo cargar el viaje">{errorCarga || 'Viaje no encontrado'}</Alerta><button className="btn" onClick={() => navegar('/viajes')}>Volver a Viajes</button></section>
  if (original.estado !== 'programado') return <section>{migas}<Alerta tipo="aviso" titulo="Este viaje ya no se puede modificar">Solo se editan viajes programados. Estado actual: {ESTADOS_VIAJE[original.estado]?.texto ?? original.estado}.</Alerta><button className="btn" onClick={() => navegar('/viajes')}>Volver a Viajes</button></section>

  return <section>
    {migas}
    {ocupados > 0 && <Alerta tipo="aviso" titulo="Las reservas confirmadas se conservan">Hay {ocupados} lugares ocupados. La capacidad no puede reducirse por debajo de esa cantidad.</Alerta>}
    {errorGeneral && <Alerta tipo={errorGeneral.tipo} titulo={errorGeneral.titulo}>{errorGeneral.texto}</Alerta>}
    <form className="form-viaje" onSubmit={guardar} noValidate>
      <div className="card">
        <div className="card-cabecera"><div><h2>Editar viaje</h2><p>Podés cambiar los horarios y la capacidad disponible.</p></div></div>
        <div className="card-cuerpo">
          <div className="seccion"><p className="seccion-titulo">Recorrido fijo</p><div className="grilla-2">
            <Campo label="Origen" soloLectura><input readOnly value={original.origen} /></Campo>
            <Campo label="Destino" soloLectura><input readOnly value={original.destino} /></Campo>
          </div><p className="campo-ayuda">El recorrido y la fecha no se pueden modificar.</p></div>
          <div className="seccion"><p className="seccion-titulo">Horarios</p><div className="grilla-2">
            <Campo label="Hora de salida" requerido icono="clock" error={errores.salida}><SelectorHora etiqueta="Hora de salida" hora={salida[0]} minuto={salida[1]} onHora={(v) => setSalida([v, salida[1]])} onMinuto={(v) => setSalida([salida[0], v])} /></Campo>
            {horarioAutomatico
              ? <Campo label="Hora estimada de llegada automática" soloLectura error={errores.llegada}><input type="time" readOnly value={horaLlegada} /></Campo>
              : <Campo label="Hora estimada de llegada" requerido icono="clock" error={errores.llegada}><SelectorHora etiqueta="Hora estimada de llegada" hora={llegada[0]} minuto={llegada[1]} onHora={(v) => setLlegada([v, llegada[1]])} onMinuto={(v) => setLlegada([llegada[0], v])} /></Campo>}
          </div></div>
          <div className="seccion">
            <p className="seccion-titulo">Paradas intermedias</p>
            {paradas.map((p, i) => <div className="grilla-3" key={p.id ?? p.clientKey} style={{ alignItems: 'end', marginBottom: 12 }}>
              <LocalidadSelect label={`Parada ${i + 1}`} value={p.localidad} onChange={(localidad) => setParadas((a) => a.map((x, n) => n === i ? { ...x, localidad } : x))} localidades={localidades} deshabilitado={cargandoLocalidades} />
              <Campo label="Hora estimada automática" requerido><input type="time" readOnly value={llegadasParadas[i] ?? ''} /></Campo>
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" className="btn" disabled={i === 0} onClick={() => setParadas((a) => { const b = [...a]; [b[i - 1], b[i]] = [b[i], b[i - 1]]; return b })}>↑</button>
                <button type="button" className="btn" disabled={i === paradas.length - 1} onClick={() => setParadas((a) => { const b = [...a]; [b[i + 1], b[i]] = [b[i], b[i + 1]]; return b })}>↓</button>
                <button type="button" className="btn" onClick={() => setParadas((a) => a.filter((_, n) => n !== i))}>Quitar</button>
              </div>
            </div>)}
            {errores.paradas && <p className="campo-error">{errores.paradas}</p>}
            <button type="button" className="btn" onClick={() => setParadas((a) => [...a, { clientKey: globalThis.crypto?.randomUUID?.() ?? `parada-${Date.now()}`, localidad: '', hora_estimada: '' }])}>Agregar parada</button>
            {paradas.length > 0 && <p className="campo-ayuda">Las horas se recalculan al cambiar el orden o la salida. No se agrega tiempo de espera.</p>}
            <MapaRuta origen={original.origen} destino={original.destino} paradasRecorrido={paradas.filter((p) => p.localidad)} alto={300} mostrarKm={false} onRuta={setRuta} />
          </div>
          <div className="seccion"><p className="seccion-titulo">Capacidad</p><div className="grilla-2">
            <Campo label="Cupo total de pasajeros" requerido icono="seat" error={errores.cupo}><input type="number" min={ocupados} step="1" value={cupo} onChange={(e) => setCupo(e.target.value)} /><span className="stepper"><button type="button" aria-label="Quitar un lugar" onClick={() => setCupo(String(Math.max(ocupados, Number(cupo || 0) - 1)))}><Icon nombre="minus" tamano={14} /></button><button type="button" aria-label="Agregar un lugar" onClick={() => setCupo(String(Number(cupo || 0) + 1))}><Icon nombre="plus" tamano={14} /></button></span></Campo>
          </div><p className="campo-ayuda">Lugares ocupados: {ocupados}. Las reservas existentes permanecen vinculadas.</p></div>
        </div>
        <div className="card-pie"><button type="button" className="btn" onClick={() => navegar('/viajes')} disabled={guardando}>Cancelar</button><button type="submit" className="btn btn-primario" disabled={guardando}><Icon nombre="checkcircle" tamano={16} /> {guardando ? 'Guardando...' : 'Guardar cambios'}</button></div>
      </div>
      <aside className="card"><div className="card-cabecera"><h2>Resumen</h2></div><div className="card-cuerpo">
        <div className="resumen-fila"><span>N° de viaje</span><strong>{codigoViaje(original.id)}</strong></div><div className="resumen-fila"><span>Estado</span><BadgeEstado estado={original.estado} fecha={original.fecha} /></div>
        <div className="resumen-fila"><span>Recorrido</span><strong>{original.origen} → {original.destino}</strong></div><div className="resumen-fila"><span>Fecha</span><strong>{formatoFecha(`${String(original.fecha).slice(0, 10)}T00:00:00`)}</strong></div>
        <div className="resumen-fila"><span>Salida</span><strong>{horaSalida || '—'}</strong></div><div className="resumen-fila"><span>Llegada</span><strong>{horaLlegada || '—'}</strong></div>
        <div className="resumen-fila"><span>Distancia</span><strong>{formatoKm(distancia)}</strong></div><div className="resumen-fila"><span>Duración</span><strong>{formatoDuracion(original.duracion_min)}</strong></div>
        <div className="resumen-fila"><span>Cupo (ocupados / total)</span><strong>{ocupados} / {cupo}</strong></div>
        {original.serie_id && <div className="resumen-fila"><span>Repetición</span><strong>{textoRepeticion(original.repeticion_dias, original.serie_id)}</strong></div>}
        <div className="resumen-fila"><span>Precio por pasajero</span><strong>{formatoPesos(calcularMonto({ precioKm, distanciaKm: distancia }))}</strong></div>
        {precioKm === null && <p className="nota-resumen">No configuraste precio por km. <Link to="/tarifa">Configurar tarifa</Link></p>}
      </div></aside>
    </form>
  </section>
}
