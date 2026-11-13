// US10 - Registrar viaje (pantalla completa, con mapa de la ruta, duracion automatica y repeticion).
import { useState, useCallback, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { api } from '../api/client.js'
import LocalidadSelect from '../components/LocalidadSelect.jsx'
import useLocalidades from '../hooks/useLocalidades.js'
import Icon from '../components/Icon.jsx'
import MapaRuta from '../components/MapaRuta.jsx'
import { formatoDuracion, formatoKm, formatoPesos, horaDeLlegada, calcularMonto } from '../utils/tarifa.js'
import { Campo, Alerta, Toast, BadgeEstado, formatoFecha } from '../components/ui.jsx'
import { calcularLlegadasAcumuladas } from '../utils/horarios.js'
import { hoyEnCordoba } from '../utils/estadoViaje.js'

const HORAS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const MINUTOS = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'))
const horaValida = (valor) => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(valor ?? '')
const claveParada = () => globalThis.crypto?.randomUUID?.() ?? `parada-${Date.now()}-${Math.random()}`

// Orden de la semana arrancando en lunes. "valor" coincide con Date.getDay() (0 = domingo).
const DIAS_SEMANA = [
  { valor: 1, corto: 'L', nombre: 'Lunes' },
  { valor: 2, corto: 'M', nombre: 'Martes' },
  { valor: 3, corto: 'Mi', nombre: 'Miércoles' },
  { valor: 4, corto: 'J', nombre: 'Jueves' },
  { valor: 5, corto: 'V', nombre: 'Viernes' },
  { valor: 6, corto: 'S', nombre: 'Sábado' },
  { valor: 0, corto: 'D', nombre: 'Domingo' },
]

const DIAS_CORTOS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']

export function codigoViaje(id) {
  return `V-${String(id).padStart(4, '0')}`
}

export function hoyISO() {
  return hoyEnCordoba()
}

function horaActualEnCordoba() {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Argentina/Cordoba',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date())
}

export function SelectorHora({ hora, minuto, onHora, onMinuto, etiqueta }) {
  return (
    <div className="hora-selects">
      <select value={hora} onChange={(e) => onHora(e.target.value)} aria-label={`${etiqueta}: hora`}>
        <option value="">HH</option>
        {HORAS.map((h) => <option key={h} value={h}>{h}</option>)}
      </select>
      <span>:</span>
      <select value={minuto} onChange={(e) => onMinuto(e.target.value)} aria-label={`${etiqueta}: minutos`}>
        <option value="">MM</option>
        {MINUTOS.map((m) => <option key={m} value={m}>{m}</option>)}
      </select>
    </div>
  )
}

const FORM_VACIO = { origen: '', destino: '', fecha: '', cupo_total: '0' }

export default function ViajeNuevo() {
  const navegar = useNavigate()
  const { localidades, cargando: cargandoLocalidades, error: errorLocalidades } = useLocalidades()

  const [form, setForm] = useState(FORM_VACIO)
  const [paradas, setParadas] = useState([])
  const [salida, setSalida] = useState(['', ''])
  const [modoEstimacion, setModoEstimacion] = useState('mapa') // mapa | llegada | duracion
  const [llegada, setLlegada] = useState(['', ''])
  const [duracionManual, setDuracionManual] = useState('')
  const [ruta, setRuta] = useState(null) // ruta calculada por el mapa: { distancia_km, duracion_min, aproximada }
  const [precioKm, setPrecioKm] = useState(undefined) // tarifa del comisionista (undefined = cargando)
  // Repeticion: 'unico' | 'diario' | 'semanal'
  const [tipoRepeticion, setTipoRepeticion] = useState('unico')
  const [diasSel, setDiasSel] = useState([])
  const [errores, setErrores] = useState({})
  const [errorGeneral, setErrorGeneral] = useState(null) // { tipo, titulo, texto }
  const [guardando, setGuardando] = useState(false)
  const [registrado, setRegistrado] = useState(null) // { cantidad, primero, resumen }
  const [claveForm, setClaveForm] = useState(0) // remonta el formulario al "registrar otro viaje"
  useEffect(() => {
    api.get('/tarifa').then((t) => setPrecioKm(t.precio_km)).catch(() => setPrecioKm(null))
  }, [])
  const cerrarToast = useCallback(() => setRegistrado((r) => (r ? { ...r, toast: false } : r)), [])

  function cambiar(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }))
    setErrores((e) => ({ ...e, [campo]: undefined, ...(campo === 'cupo_total' && { cupo: undefined }) }))
  }

  function toggleDia(valor) {
    setDiasSel((actuales) => (actuales.includes(valor) ? actuales.filter((d) => d !== valor) : [...actuales, valor]))
    setErrores((e) => ({ ...e, dias: undefined }))
  }

  // Al elegir "Días de la semana" sin ningun dia marcado, sugerimos el de la fecha del viaje.
  function elegirTipo(tipo) {
    setTipoRepeticion(tipo)
    if (tipo === 'semanal' && diasSel.length === 0 && form.fecha) {
      setDiasSel([new Date(`${form.fecha}T00:00:00`).getDay()])
    }
  }

  function cambiarCupo(delta) {
    const actual = Number(form.cupo_total) || 0
    cambiar('cupo_total', String(Math.max(0, actual + delta)))
  }

  const horaSalida = salida[0] && salida[1] ? `${salida[0]}:${salida[1]}` : ''
  const recorridoElegido = Boolean(form.origen && form.destino)
  const localidadesParadas = paradas.map((p) => p.localidad)
  const firmaRecorrido = JSON.stringify([form.origen, ...localidadesParadas, form.destino])
  const horariosAuto = paradas.length > 0 && ruta?.firma === firmaRecorrido && !ruta.aproximada
    ? calcularLlegadasAcumuladas(horaSalida, ruta.tramos?.map((t) => t.duracion_min) ?? [])
    : null
  const llegadasParadas = horariosAuto?.slice(0, paradas.length) ?? []
  const horaLlegadaAuto = horariosAuto?.at(-1) ?? ''
  const duracionRuta = ruta && !ruta.aproximada ? ruta.duracion_min : null
  const horaLlegadaManual = llegada[0] && llegada[1] ? `${llegada[0]}:${llegada[1]}` : ''
  const duracionMin = modoEstimacion === 'duracion'
    ? (duracionManual ? Number(duracionManual) : null)
    : modoEstimacion === 'llegada' && horaLlegadaManual && horaSalida
      ? (Number(horaLlegadaManual.slice(0, 2)) * 60 + Number(horaLlegadaManual.slice(3)) - Number(horaSalida.slice(0, 2)) * 60 - Number(horaSalida.slice(3)) + 1440) % 1440
      : duracionRuta
  const horaLlegada = paradas.length ? horaLlegadaAuto : modoEstimacion === 'llegada'
    ? horaLlegadaManual && horaLlegadaManual < horaSalida ? `${horaLlegadaManual} (+1 día)` : horaLlegadaManual
    : horaDeLlegada(horaSalida, duracionMin) ?? ''
  const montoPorPasajero = calcularMonto({ precioKm, distanciaKm: ruta && !ruta.aproximada ? ruta.distancia_km : null })

  function validar() {
    const e = {}
    if (!form.origen) e.origen = 'Selecciona la localidad de origen'
    if (!form.destino) e.destino = 'Selecciona la localidad de destino'
    if (form.origen && form.origen === form.destino) e.destino = 'El origen y el destino deben ser distintos'
    if (!form.fecha) e.fecha = 'Indica la fecha del viaje'
    else if (form.fecha < hoyISO()) e.fecha = 'La fecha del viaje no puede ser anterior a hoy'
    else if (form.fecha === hoyISO() && horaSalida && horaSalida <= horaActualEnCordoba()) e.salida = 'La hora de salida debe ser posterior a la hora actual'
    if (!horaSalida) e.salida = 'Ingresa un horario válido (hh:mm)'
    if (modoEstimacion === 'llegada') {
      if (!horaLlegadaManual) e.llegada = 'Ingresa la hora estimada de llegada'
      else if (horaLlegadaManual === horaSalida) e.llegada = 'La llegada debe ser distinta de la hora de salida'
    }
    if (modoEstimacion === 'duracion') {
      const minutos = Number(duracionManual)
      if (!duracionManual || !Number.isInteger(minutos) || minutos < 1) e.duracion = 'Ingresa una duración en minutos mayor a cero'
      else if (minutos > 1439) e.duracion = 'La duración no puede superar las 23 horas y 59 minutos'
    }
    const puntos = [form.origen, ...paradas.map((p) => p.localidad), form.destino].filter(Boolean)
    if (new Set(puntos.map((p) => p.toLocaleLowerCase())).size !== puntos.length) e.paradas = 'No repitas localidades en el recorrido'
    if (paradas.length && !horariosAuto) e.paradas = ruta?.firma === firmaRecorrido && ruta.aproximada
      ? 'No se pudieron calcular tiempos exactos para todos los tramos; intentá nuevamente'
      : ruta?.firma === firmaRecorrido && !ruta.aproximada
        ? 'El horario calculado supera la medianoche del mismo día'
        : 'Esperando el cálculo exacto de los tramos'
    let horaAnterior = horaSalida
    for (let i = 0; i < paradas.length; i++) {
      const p = paradas[i]
      if (!p.localidad) e[`parada_${i}`] = 'Selecciona una localidad'
      const horaParada = paradas.length ? llegadasParadas[i] : p.hora_estimada
      if (!horaValida(horaParada)) e[`parada_hora_${i}`] = 'No hay una hora calculada válida'
      else if (horaAnterior && horaParada <= horaAnterior) e[`parada_hora_${i}`] = 'Debe ser posterior a la hora anterior'
      if (horaParada) horaAnterior = horaParada
    }
    if (horaLlegada && horaAnterior && horaAnterior >= horaLlegada) e.paradas = 'Las paradas deben ocurrir antes de la llegada final'
    const cupo = Number(form.cupo_total)
    if (form.cupo_total === '' || !Number.isInteger(cupo) || cupo < 0) e.cupo = 'Indica un cupo de pasajeros igual o mayor a 0'
    if (tipoRepeticion === 'semanal' && diasSel.length === 0) e.dias = 'Elegí al menos un día de la semana para repetir el viaje'
    return e
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setErrorGeneral(null)

    const encontrados = validar()
    if (Object.keys(encontrados).length > 0) {
      setErrores(encontrados)
      setErrorGeneral({ tipo: 'error', titulo: 'Faltan datos obligatorios', texto: 'Completa todos los campos obligatorios con un formato válido para registrar el viaje.' })
      return
    }

    setGuardando(true)
    try {
      const payload = {
        ...form,
        cupo_total: Number(form.cupo_total),
        hora_salida: horaSalida,
        paradas: paradas.map((p, i) => ({ ...p, hora_estimada: paradas.length ? llegadasParadas[i] : p.hora_estimada })),
        ...(paradas.length === 0 && modoEstimacion === 'llegada' && { hora_llegada: horaLlegadaManual }),
        ...(paradas.length === 0 && modoEstimacion === 'duracion' && { duracion_min: Number(duracionManual) }),
        repeticion:
          tipoRepeticion === 'unico'
            ? { tipo: 'unico' }
            : { tipo: tipoRepeticion, dias: tipoRepeticion === 'semanal' ? diasSel : undefined },
      }
      const guardado = await api.post('/viajes', payload)
      const lista = guardado?.viajes ?? [guardado]
      setRegistrado({
        cantidad: lista.length,
        primero: lista[0],
        horaSalida,
        toast: true,
      })
    } catch (err) {
      const solapa = /superpon/i.test(err.message)
      setErrorGeneral(
        solapa
          ? { tipo: 'aviso', titulo: 'El horario se superpone con otro viaje activo', texto: `${err.message}. Elige otro horario para continuar.`.replace('..', '.') }
          : { tipo: 'error', titulo: 'No se pudo registrar el viaje', texto: err.message }
      )
    } finally {
      setGuardando(false)
    }
  }

  function registrarOtro() {
    setForm(FORM_VACIO)
    setParadas([])
    setSalida(['', ''])
    setModoEstimacion('mapa')
    setLlegada(['', ''])
    setDuracionManual('')
    setRuta(null)
    setTipoRepeticion('unico')
    setDiasSel([])
    setErrores({})
    setErrorGeneral(null)
    setRegistrado(null)
    setClaveForm((k) => k + 1)
  }

  const migas = (
    <nav className="migas" aria-label="Ruta">
      <button type="button" onClick={() => navegar('/viajes')}>Viajes</button>
      <Icon nombre="right" tamano={14} />
      <strong>Registrar viaje</strong>
    </nav>
  )

  // ---------- Exito ----------
  if (registrado) {
    const v = registrado.primero
    const serie = registrado.cantidad > 1
    return (
      <section>
        {registrado.toast && (
          <Toast
            titulo={serie ? 'Viajes registrados' : 'Viaje registrado'}
            texto={serie ? `Se crearon ${registrado.cantidad} viajes en estado Programado.` : `El viaje ${codigoViaje(v.id)} quedó en estado Programado.`}
            onClose={cerrarToast}
          />
        )}
        {migas}
        <div className="card exito-card">
          <span className="icono-caja"><Icon nombre="checkcircle" tamano={26} /></span>
          <h2>{serie ? 'Viajes registrados correctamente' : 'Viaje registrado correctamente'}</h2>
          <p>{serie ? `Se registraron ${registrado.cantidad} viajes. En Viajes vas a ver el más próximo; el siguiente aparece cuando se realice, y la serie sigue hasta que la canceles.` : 'El viaje fue guardado y quedó disponible para los clientes.'}</p>
          <div className="exito-detalle">
            <div className="resumen-fila"><span>{serie ? 'Primer viaje' : 'N° de viaje'}</span><strong>{codigoViaje(v.id)}</strong></div>
            <div className="resumen-fila"><span>Recorrido</span><strong>{v.origen} <span style={{ color: 'var(--texto-3)' }}>→</span> {v.destino}</strong></div>
            <div className="resumen-fila"><span>Fecha y salida</span><strong>{formatoFecha(v.fecha)} · {v.hora_salida.slice(0, 5)}</strong></div>
            {serie && <div className="resumen-fila"><span>Cantidad de viajes</span><strong>{registrado.cantidad}</strong></div>}
            <div className="resumen-fila"><span>Estado</span><BadgeEstado estado="programado" /></div>
          </div>
          <div className="exito-acciones">
            <button type="button" className="btn" onClick={registrarOtro}><Icon nombre="plus" tamano={16} /> Registrar otro viaje</button>
            <button type="button" className="btn btn-primario" onClick={() => navegar('/viajes', { state: { abrirId: serie ? null : v.id } })}>
              {serie ? 'Ver viajes' : 'Ver viaje'} <Icon nombre="arrow" tamano={16} />
            </button>
          </div>
        </div>
      </section>
    )
  }

  // ---------- Formulario ----------
  const textoRepeticion =
    tipoRepeticion === 'unico' ? 'Una sola vez'
    : tipoRepeticion === 'diario' ? 'Todos los días, sin fin'
    : diasSel.length ? `${[...diasSel].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((d) => DIAS_CORTOS[d]).join(', ')} (sin fin)` : '—'

  return (
    <section>
      {migas}
      {errorLocalidades && <Alerta tipo="error" titulo="No se pudo cargar la lista de localidades">{errorLocalidades}</Alerta>}
      {errorGeneral && <Alerta tipo={errorGeneral.tipo} titulo={errorGeneral.titulo}>{errorGeneral.texto}</Alerta>}

      <form className="form-viaje" onSubmit={handleSubmit} noValidate key={claveForm}>
        <div className="card">
          <div className="card-cabecera">
            <div>
              <h2>Datos del viaje</h2>
              <p>Indica el recorrido, la fecha y la hora de salida. Usa la estimación del mapa o ingresa la llegada o duración.</p>
            </div>
          </div>
          <div className="card-cuerpo">
            <div className="seccion">
              <p className="seccion-titulo">Recorrido</p>
              <div className="grilla-2">
                <LocalidadSelect label="Origen" value={form.origen} onChange={(v) => cambiar('origen', v)} localidades={localidades} deshabilitado={cargandoLocalidades} error={errores.origen} />
                <LocalidadSelect label="Destino" value={form.destino} onChange={(v) => cambiar('destino', v)} localidades={localidades} deshabilitado={cargandoLocalidades} error={errores.destino} />
              </div>
              {recorridoElegido && form.origen !== form.destino && (
                <MapaRuta origen={form.origen} destino={form.destino} paradasRecorrido={paradas.filter((p) => p.localidad)} alto={300} onRuta={setRuta} />
              )}
              <div className="seccion" style={{ marginTop: 18 }}>
                <p className="seccion-titulo">Paradas intermedias</p>
                {paradas.map((parada, i) => <div className="grilla-3" key={parada.id ?? parada.clientKey} style={{ alignItems: 'end', marginBottom: 12 }}>
                  <LocalidadSelect label={`Parada ${i + 1}`} value={parada.localidad} onChange={(localidad) => setParadas((actuales) => actuales.map((p, n) => n === i ? { ...p, localidad } : p))} localidades={localidades} deshabilitado={cargandoLocalidades} error={errores[`parada_${i}`]} />
                  <Campo label="Hora estimada automática" requerido icono="clock" error={errores[`parada_hora_${i}`]}><input type="time" readOnly value={llegadasParadas[i] ?? ''} /></Campo>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button type="button" className="btn" disabled={i === 0} aria-label="Mover parada arriba" onClick={() => setParadas((a) => { const b = [...a]; [b[i - 1], b[i]] = [b[i], b[i - 1]]; return b })}>↑</button>
                    <button type="button" className="btn" disabled={i === paradas.length - 1} aria-label="Mover parada abajo" onClick={() => setParadas((a) => { const b = [...a]; [b[i + 1], b[i]] = [b[i], b[i + 1]]; return b })}>↓</button>
                    <button type="button" className="btn" onClick={() => setParadas((a) => a.filter((_, n) => n !== i))}>Quitar</button>
                  </div>
                </div>)}
                {errores.paradas && <p className="campo-error">{errores.paradas}</p>}
                <button type="button" className="btn" onClick={() => setParadas((a) => [...a, { clientKey: claveParada(), localidad: '', hora_estimada: '' }])}>Agregar parada</button>
                {paradas.length > 0 && <p className="campo-ayuda">Las horas se calculan automáticamente tramo por tramo; no se agrega tiempo de espera en las paradas.</p>}
              </div>
            </div>

            <div className="seccion">
              <p className="seccion-titulo">Fecha y horario</p>
              <div className="grilla-3">
                <Campo label="Fecha" requerido icono="calendar" error={errores.fecha}>
                  <input type="date" name="fecha" value={form.fecha} min={hoyISO()} onChange={(e) => cambiar('fecha', e.target.value)} />
                </Campo>
                <Campo label="Hora de salida" requerido icono="clock" error={errores.salida}>
                  <SelectorHora etiqueta="Hora de salida" hora={salida[0]} minuto={salida[1]} onHora={(h) => { setSalida([h, salida[1]]); setErrores((e) => ({ ...e, salida: undefined })) }} onMinuto={(m) => { setSalida([salida[0], m]); setErrores((e) => ({ ...e, salida: undefined })) }} />
                </Campo>
                {modoEstimacion === 'mapa' && <Campo label="Duración estimada" icono="clock" soloLectura ayuda={duracionMin == null ? 'Se calcula sola al elegir origen y destino' : 'Calculada por el sistema'}>
                  <input type="text" readOnly tabIndex={-1} value={recorridoElegido ? (duracionMin != null ? formatoDuracion(duracionMin) : (ruta ? 'No disponible' : 'Calculando...')) : ''} placeholder="Automática" aria-label="Duración del viaje (calculada)" />
                </Campo>}
              </div>
              {paradas.length === 0 && <div className="campo" style={{ marginTop: 14 }}>
                <span className="campo-label">Estimación de llegada</span>
                <div className="segmentado" role="radiogroup" aria-label="Método de estimación de llegada">
                  <button type="button" role="radio" aria-checked={modoEstimacion === 'mapa'} className={modoEstimacion === 'mapa' ? 'activo' : ''} onClick={() => setModoEstimacion('mapa')}>Usar mapa</button>
                  <button type="button" role="radio" aria-checked={modoEstimacion === 'llegada'} className={modoEstimacion === 'llegada' ? 'activo' : ''} onClick={() => setModoEstimacion('llegada')}>Ingresar llegada</button>
                  <button type="button" role="radio" aria-checked={modoEstimacion === 'duracion'} className={modoEstimacion === 'duracion' ? 'activo' : ''} onClick={() => setModoEstimacion('duracion')}>Ingresar duración</button>
                </div>
              </div>}
              {paradas.length > 0 && <Campo label="Llegada estimada automática" soloLectura ayuda={horaLlegadaAuto ? 'Calculada acumulando los tramos del recorrido' : 'Esperando un cálculo exacto de la ruta'}><input type="time" readOnly value={horaLlegadaAuto} /></Campo>}
              {paradas.length === 0 && modoEstimacion === 'llegada' && <div className="grilla-2" style={{ marginTop: 12 }}>
                <Campo label="Hora estimada de llegada" requerido icono="clock" error={errores.llegada}>
                  <SelectorHora etiqueta="Hora estimada de llegada" hora={llegada[0]} minuto={llegada[1]} onHora={(h) => { setLlegada([h, llegada[1]]); setErrores((e) => ({ ...e, llegada: undefined })) }} onMinuto={(m) => { setLlegada([llegada[0], m]); setErrores((e) => ({ ...e, llegada: undefined })) }} />
                </Campo>
              </div>}
              {paradas.length === 0 && modoEstimacion === 'duracion' && <div className="grilla-2" style={{ marginTop: 12 }}>
                <Campo label="Duración estimada (minutos)" requerido icono="clock" error={errores.duracion}>
                  <input type="number" min="1" step="1" value={duracionManual} onChange={(e) => { setDuracionManual(e.target.value); setErrores((actuales) => ({ ...actuales, duracion: undefined })) }} placeholder="Ej.: 45" />
                </Campo>
              </div>}
            </div>

            <div className="seccion">
              <p className="seccion-titulo">Cupo</p>
              <div className="grilla-2">
                <Campo label="Cupo de pasajeros" requerido icono="seat" error={errores.cupo}>
                  <input type="number" min="0" step="1" name="cupo_total" value={form.cupo_total} onChange={(e) => cambiar('cupo_total', e.target.value)} placeholder="Ej: 4" />
                  <span className="stepper">
                    <button type="button" aria-label="Quitar un lugar" onClick={() => cambiarCupo(-1)}><Icon nombre="minus" tamano={14} /></button>
                    <button type="button" aria-label="Agregar un lugar" onClick={() => cambiarCupo(1)}><Icon nombre="plus" tamano={14} /></button>
                  </span>
                </Campo>
              </div>
            </div>

            <div className="seccion">
              <p className="seccion-titulo">Repetición</p>
              <div className="segmentado" role="radiogroup" aria-label="Repetición del viaje">
                <button type="button" role="radio" aria-checked={tipoRepeticion === 'unico'} className={tipoRepeticion === 'unico' ? 'activo' : ''} onClick={() => elegirTipo('unico')}>Una sola vez</button>
                <button type="button" role="radio" aria-checked={tipoRepeticion === 'diario'} className={tipoRepeticion === 'diario' ? 'activo' : ''} onClick={() => elegirTipo('diario')}>Todos los días</button>
                <button type="button" role="radio" aria-checked={tipoRepeticion === 'semanal'} className={tipoRepeticion === 'semanal' ? 'activo' : ''} onClick={() => elegirTipo('semanal')}>Días de la semana</button>
              </div>
              {tipoRepeticion === 'semanal' && (
                <div style={{ marginTop: 14 }}>
                  <div className="dias" role="group" aria-label="Días de la semana">
                    {DIAS_SEMANA.map((d) => (
                      <button key={d.valor} type="button" title={d.nombre} aria-pressed={diasSel.includes(d.valor)} className={diasSel.includes(d.valor) ? 'activo' : ''} onClick={() => toggleDia(d.valor)}>
                        {d.corto}
                      </button>
                    ))}
                  </div>
                  {errores.dias && <p className="campo-error" style={{ marginTop: 8 }}><Icon nombre="alert" tamano={16} />{errores.dias}</p>}
                </div>
              )}
              {tipoRepeticion !== 'unico' && (
                <p className="campo-ayuda" style={{ marginTop: 12 }}>El viaje se repite hasta que lo canceles. Se crean con 3 meses de anticipación y la serie se va extendiendo sola.</p>
              )}
            </div>
          </div>
          <div className="card-pie">
            <button type="button" className="btn" onClick={() => navegar('/viajes')} disabled={guardando}>Cancelar</button>
            <button type="submit" className="btn btn-primario" disabled={guardando}>
              <Icon nombre="checkcircle" tamano={16} /> {guardando ? 'Registrando...' : 'Registrar viaje'}
            </button>
          </div>
        </div>

        <aside className="card">
          <div className="card-cabecera"><h2>Resumen</h2></div>
          <div className="card-cuerpo">
            <div className="resumen-fila"><span>Estado inicial</span><BadgeEstado estado="programado" /></div>
            <div className="resumen-fila"><span>Recorrido</span><strong>{form.origen && form.destino ? `${form.origen} → ${form.destino}` : '—'}</strong></div>
            <div className="resumen-fila"><span>Salida</span><strong>{form.fecha && horaSalida ? `${formatoFecha(`${form.fecha}T00:00:00`)} · ${horaSalida}` : '—'}</strong></div>
            <div className="resumen-fila"><span>Distancia</span><strong>{ruta && !ruta.aproximada ? formatoKm(ruta.distancia_km) : '—'}</strong></div>
            <div className="resumen-fila"><span>Duración</span><strong>{formatoDuracion(duracionMin)}</strong></div>
            <div className="resumen-fila"><span>Llegada (aprox.)</span><strong>{horaLlegada || '—'}</strong></div>
            <div className="resumen-fila"><span>Cupo</span><strong>{`${Number(form.cupo_total) || 0} pasajero${Number(form.cupo_total) === 1 ? '' : 's'}`}</strong></div>
            <div className="resumen-fila"><span>Repetición</span><strong>{textoRepeticion}</strong></div>
            <div className="resumen-fila"><span>Tu precio por km</span><strong>{precioKm ? formatoPesos(precioKm) : '—'}</strong></div>
            <div className="resumen-fila"><span>Precio por pasajero</span><strong>{formatoPesos(montoPorPasajero)}</strong></div>
            {precioKm === null && (
              <p className="nota-resumen">Todavía no configuraste tu precio por km, así que los clientes no van a ver un precio. <Link to="/tarifa">Configurarlo ahora</Link></p>
            )}
            <p className="nota-resumen">Al registrarlo, el viaje quedará <strong>Programado</strong> y visible para que los clientes puedan asociarse.</p>
          </div>
        </aside>
      </form>
    </section>
  )
}
