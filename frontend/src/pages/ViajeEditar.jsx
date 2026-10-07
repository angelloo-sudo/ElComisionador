// US18 - Modificar la definicion de un viaje (fecha, horario, recorrido y cupo) en estado Programado.
import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/client.js'
import LocalidadSelect from '../components/LocalidadSelect.jsx'
import useLocalidades from '../hooks/useLocalidades.js'
import Icon from '../components/Icon.jsx'
import { Campo, Alerta, BadgeEstado, formatoFecha, textoRepeticion } from '../components/ui.jsx'
import { codigoViaje, hoyISO, SelectorHora } from './ViajeNuevo.jsx'

const partirHora = (h) => (h ? [h.slice(0, 2), h.slice(3, 5)] : ['', ''])

export default function ViajeEditar() {
  const { id } = useParams()
  const navegar = useNavigate()
  const { localidades, cargando: cargandoLocalidades } = useLocalidades()

  const [original, setOriginal] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState(null)
  const [form, setForm] = useState({ origen: '', destino: '', fecha: '', cupo_total: '' })
  const [salida, setSalida] = useState(['', ''])
  const [llegada, setLlegada] = useState(['', ''])
  const [alcance, setAlcance] = useState('este')
  const [errores, setErrores] = useState({})
  const [errorGeneral, setErrorGeneral] = useState(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    setCargando(true)
    api.get(`/viajes/${id}`)
      .then((v) => {
        setOriginal(v)
        setForm({ origen: v.origen, destino: v.destino, fecha: String(v.fecha).slice(0, 10), cupo_total: String(v.cupo_total) })
        setSalida(partirHora(v.hora_salida))
        setLlegada(partirHora(v.hora_llegada))
      })
      .catch((err) => setErrorCarga(err.message))
      .finally(() => setCargando(false))
  }, [id])

  const horaSalida = salida[0] && salida[1] ? `${salida[0]}:${salida[1]}` : ''
  const horaLlegada = llegada[0] && llegada[1] ? `${llegada[0]}:${llegada[1]}` : ''
  const ocupados = original?.ocupados ?? 0
  const esSerie = Boolean(original?.serie_id)
  const aplicaASerie = esSerie && alcance === 'siguientes'

  function cambiar(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }))
    setErrores((e) => ({ ...e, [campo]: undefined, ...(campo === 'cupo_total' && { cupo: undefined }) }))
  }

  function elegirAlcance(a) {
    setAlcance(a)
    // La fecha solo se puede mover al modificar un unico viaje.
    if (a === 'siguientes' && original) cambiar('fecha', String(original.fecha).slice(0, 10))
  }

  const sinCambios = useMemo(() => {
    if (!original) return true
    return form.origen === original.origen && form.destino === original.destino &&
      form.fecha === String(original.fecha).slice(0, 10) &&
      horaSalida === original.hora_salida?.slice(0, 5) && horaLlegada === original.hora_llegada?.slice(0, 5) &&
      Number(form.cupo_total) === original.cupo_total
  }, [original, form, horaSalida, horaLlegada])

  function validar() {
    const e = {}
    if (!form.origen) e.origen = 'Selecciona la localidad de origen'
    if (!form.destino) e.destino = 'Selecciona la localidad de destino'
    if (!form.fecha) e.fecha = 'Indica la fecha del viaje'
    else if (form.fecha < hoyISO()) e.fecha = 'La fecha del viaje no puede ser anterior a hoy'
    if (!horaSalida) e.salida = 'Ingresa un horario válido (hh:mm)'
    if (!horaLlegada) e.llegada = 'Ingresa un horario válido (hh:mm)'
    else if (horaSalida && horaLlegada <= horaSalida) e.llegada = 'La hora de llegada debe ser posterior a la de salida'
    const cupo = Number(form.cupo_total)
    if (!form.cupo_total || !Number.isInteger(cupo) || cupo < 1) e.cupo = 'Indica el cupo de pasajeros (mínimo 1)'
    else if (cupo < ocupados) e.cupo = `El cupo no puede ser menor que los ${ocupados} pasajeros que ya tiene el viaje`
    return e
  }

  async function handleSubmit(ev) {
    ev.preventDefault()
    setErrorGeneral(null)
    if (sinCambios) {
      setErrorGeneral({ tipo: 'aviso', titulo: 'No hay cambios para guardar', texto: 'Modificá al menos un dato del viaje para poder guardarlo.' })
      return
    }
    const encontrados = validar()
    if (Object.keys(encontrados).length > 0) {
      setErrores(encontrados)
      setErrorGeneral({ tipo: 'error', titulo: 'Revisá los datos del viaje', texto: 'Completa todos los campos obligatorios con un formato válido para guardar los cambios.' })
      return
    }
    setGuardando(true)
    try {
      const respuesta = await api.put(`/viajes/${id}`, {
        ...form,
        cupo_total: Number(form.cupo_total),
        hora_salida: horaSalida,
        hora_llegada: horaLlegada,
        alcance,
      })
      const afectados = respuesta.pasajerosAfectados ?? 0
      const state = {
        abrirId: null,
        aviso: respuesta.cantidad > 1
          ? { titulo: 'Viajes modificados', texto: `Se actualizaron ${respuesta.cantidad} viajes de la serie.` }
          : { titulo: 'Viaje modificado', texto: `Los cambios del viaje ${codigoViaje(id)} se guardaron correctamente.` },
      }
      if (afectados > 0) {
        state.alertaClientes = {
          titulo: 'Avisá a los clientes asociados',
          texto: `${respuesta.cantidad > 1 ? 'Los viajes modificados tienen' : `El viaje ${codigoViaje(id)} tiene`} ${afectados} pasajero${afectados === 1 ? '' : 's'} asociado${afectados === 1 ? '' : 's'}. Comunicales los cambios de fecha, horario o recorrido.`,
        }
      }
      navegar('/viajes', { state })
    } catch (err) {
      const solapa = /superpon/i.test(err.message)
      setErrorGeneral(
        solapa
          ? { tipo: 'aviso', titulo: 'El horario se superpone con otro viaje activo', texto: `${err.message}. Elige otro horario para continuar.`.replace('..', '.') }
          : { tipo: 'error', titulo: 'No se pudo modificar el viaje', texto: err.message }
      )
    } finally {
      setGuardando(false)
    }
  }

  const migas = (
    <nav className="migas" aria-label="Ruta">
      <button type="button" onClick={() => navegar('/viajes')}>Viajes</button>
      <Icon nombre="right" tamano={14} />
      <strong>Modificar viaje{original ? ` ${codigoViaje(original.id)}` : ''}</strong>
    </nav>
  )

  if (cargando) return <section>{migas}<p className="vacio">Cargando viaje...</p></section>
  if (errorCarga) {
    return (
      <section>
        {migas}
        <Alerta tipo="error" titulo="No se pudo cargar el viaje">{errorCarga}</Alerta>
        <button type="button" className="btn" onClick={() => navegar('/viajes')}>Volver a Viajes</button>
      </section>
    )
  }
  if (original.estado !== 'programado') {
    return (
      <section>
        {migas}
        <Alerta tipo="aviso" titulo="Este viaje ya no se puede modificar">Solo se pueden modificar viajes en estado Programado. Este viaje está en estado {original.estado === 'cancelado' ? 'Cancelado' : original.estado === 'en_curso' ? 'En curso' : 'Finalizado'}.</Alerta>
        <button type="button" className="btn" onClick={() => navegar('/viajes')}>Volver a Viajes</button>
      </section>
    )
  }

  return (
    <section>
      {migas}
      {ocupados > 0 && (
        <Alerta tipo="aviso" titulo="Este viaje tiene pasajeros asociados">
          {`Hay ${ocupados} pasajero${ocupados === 1 ? '' : 's'} asociado${ocupados === 1 ? '' : 's'}. Al guardar los cambios vas a ver un aviso para comunicárselos.`}
        </Alerta>
      )}
      {errorGeneral && <Alerta tipo={errorGeneral.tipo} titulo={errorGeneral.titulo}>{errorGeneral.texto}</Alerta>}

      <form className="form-viaje" onSubmit={handleSubmit} noValidate>
        <div className="card">
          <div className="card-cabecera">
            <div>
              <h2>Datos del viaje</h2>
              <p>Modificá el recorrido, la fecha, el horario o el cupo del viaje.</p>
            </div>
          </div>
          <div className="card-cuerpo">
            {esSerie && (
              <div className="seccion">
                <p className="seccion-titulo">Alcance de los cambios</p>
                <div className="segmentado" role="radiogroup" aria-label="Alcance de los cambios">
                  <button type="button" role="radio" aria-checked={alcance === 'este'} className={alcance === 'este' ? 'activo' : ''} onClick={() => elegirAlcance('este')}>Solo este viaje</button>
                  <button type="button" role="radio" aria-checked={alcance === 'siguientes'} className={alcance === 'siguientes' ? 'activo' : ''} onClick={() => elegirAlcance('siguientes')}>Este y los siguientes</button>
                </div>
                <p className="campo-ayuda" style={{ marginTop: 12 }}>
                  {alcance === 'este'
                    ? 'Los demás viajes de la serie no se modifican.'
                    : 'Se aplican a este viaje y a todos los programados que le siguen. La fecha no se puede cambiar para varios viajes a la vez.'}
                </p>
              </div>
            )}

            <div className="seccion">
              <p className="seccion-titulo">Recorrido</p>
              <div className="grilla-2">
                <LocalidadSelect label="Origen" value={form.origen} onChange={(v) => cambiar('origen', v)} localidades={localidades} deshabilitado={cargandoLocalidades} error={errores.origen} />
                <LocalidadSelect label="Destino" value={form.destino} onChange={(v) => cambiar('destino', v)} localidades={localidades} deshabilitado={cargandoLocalidades} error={errores.destino} />
              </div>
            </div>

            <div className="seccion">
              <p className="seccion-titulo">Fecha y horario</p>
              <div className="grilla-3">
                <Campo label="Fecha" requerido icono="calendar" error={errores.fecha}>
                  <input type="date" name="fecha" value={form.fecha} min={hoyISO()} disabled={aplicaASerie} onChange={(e) => cambiar('fecha', e.target.value)} />
                </Campo>
                <Campo label="Hora de salida" requerido icono="clock" error={errores.salida}>
                  <SelectorHora etiqueta="Hora de salida" hora={salida[0]} minuto={salida[1]} onHora={(h) => { setSalida([h, salida[1]]); setErrores((e) => ({ ...e, salida: undefined })) }} onMinuto={(m) => { setSalida([salida[0], m]); setErrores((e) => ({ ...e, salida: undefined })) }} />
                </Campo>
                <Campo label="Hora de llegada (aprox.)" requerido icono="clock" error={errores.llegada}>
                  <SelectorHora etiqueta="Hora de llegada" hora={llegada[0]} minuto={llegada[1]} onHora={(h) => { setLlegada([h, llegada[1]]); setErrores((e) => ({ ...e, llegada: undefined })) }} onMinuto={(m) => { setLlegada([llegada[0], m]); setErrores((e) => ({ ...e, llegada: undefined })) }} />
                </Campo>
              </div>
            </div>

            <div className="seccion">
              <p className="seccion-titulo">Cupo</p>
              <div className="grilla-2">
                <Campo label="Cupo de pasajeros" requerido icono="seat" error={errores.cupo}>
                  <input type="number" min={Math.max(1, ocupados)} step="1" name="cupo_total" value={form.cupo_total} onChange={(e) => cambiar('cupo_total', e.target.value)} />
                  <span className="stepper">
                    <button type="button" aria-label="Quitar un lugar" onClick={() => cambiar('cupo_total', String(Math.max(Math.max(1, ocupados), (Number(form.cupo_total) || 0) - 1)))}><Icon nombre="minus" tamano={14} /></button>
                    <button type="button" aria-label="Agregar un lugar" onClick={() => cambiar('cupo_total', String((Number(form.cupo_total) || 0) + 1))}><Icon nombre="plus" tamano={14} /></button>
                  </span>
                </Campo>
              </div>
            </div>
          </div>
          <div className="card-pie">
            <button type="button" className="btn" onClick={() => navegar('/viajes')} disabled={guardando}>Cancelar</button>
            <button type="submit" className="btn btn-primario" disabled={guardando}>
              <Icon nombre="checkcircle" tamano={16} /> {guardando ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </div>

        <aside className="card">
          <div className="card-cabecera"><h2>Resumen</h2></div>
          <div className="card-cuerpo">
            <div className="resumen-fila"><span>N° de viaje</span><strong>{codigoViaje(original.id)}</strong></div>
            <div className="resumen-fila"><span>Estado</span><BadgeEstado estado={original.estado} /></div>
            <div className="resumen-fila"><span>Recorrido</span><strong>{form.origen && form.destino ? `${form.origen} → ${form.destino}` : '—'}</strong></div>
            <div className="resumen-fila"><span>Salida</span><strong>{form.fecha && horaSalida ? `${formatoFecha(`${form.fecha}T00:00:00`)} · ${horaSalida}` : '—'}</strong></div>
            <div className="resumen-fila"><span>Llegada (aprox.)</span><strong>{horaLlegada || '—'}</strong></div>
            <div className="resumen-fila"><span>Cupo</span><strong>{Number(form.cupo_total) > 0 ? `${ocupados} / ${form.cupo_total}` : '—'}</strong></div>
            {esSerie && <div className="resumen-fila"><span>Repetición</span><strong>{textoRepeticion(original.repeticion_dias, original.serie_id)}</strong></div>}
            <p className="nota-resumen">Los cambios se validan contra tus otros viajes activos para evitar superposiciones.</p>
          </div>
        </aside>
      </form>
    </section>
  )
}
