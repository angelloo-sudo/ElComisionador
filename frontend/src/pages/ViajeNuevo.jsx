// US10 - Registrar viaje (pantalla completa, con hora de llegada y repeticion).
import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client.js'
import LocalidadSelect from '../components/LocalidadSelect.jsx'
import useLocalidades from '../hooks/useLocalidades.js'
import Icon from '../components/Icon.jsx'
import { Campo, Alerta, Toast, BadgeEstado, formatoFecha } from '../components/ui.jsx'

const HORAS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const MINUTOS = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'))

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
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
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

const FORM_VACIO = { origen: '', destino: '', fecha: '', cupo_total: '' }

export default function ViajeNuevo() {
  const navegar = useNavigate()
  const { localidades, cargando: cargandoLocalidades, error: errorLocalidades } = useLocalidades()

  const [form, setForm] = useState(FORM_VACIO)
  const [salida, setSalida] = useState(['', ''])
  const [llegada, setLlegada] = useState(['', ''])
  // Repeticion: 'unico' | 'diario' | 'semanal'
  const [tipoRepeticion, setTipoRepeticion] = useState('unico')
  const [diasSel, setDiasSel] = useState([])
  const [errores, setErrores] = useState({})
  const [errorGeneral, setErrorGeneral] = useState(null) // { tipo, titulo, texto }
  const [guardando, setGuardando] = useState(false)
  const [registrado, setRegistrado] = useState(null) // { cantidad, primero, resumen }
  const [claveForm, setClaveForm] = useState(0) // remonta el formulario al "registrar otro viaje"
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
    cambiar('cupo_total', String(Math.max(1, actual + delta)))
  }

  const horaSalida = salida[0] && salida[1] ? `${salida[0]}:${salida[1]}` : ''
  const horaLlegada = llegada[0] && llegada[1] ? `${llegada[0]}:${llegada[1]}` : ''

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
        hora_llegada: horaLlegada,
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
    setSalida(['', ''])
    setLlegada(['', ''])
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
              <p>Indica el recorrido, la fecha y el horario de salida y llegada.</p>
            </div>
          </div>
          <div className="card-cuerpo">
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
                  <input type="date" name="fecha" value={form.fecha} min={hoyISO()} onChange={(e) => cambiar('fecha', e.target.value)} />
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
                  <input type="number" min="1" step="1" name="cupo_total" value={form.cupo_total} onChange={(e) => cambiar('cupo_total', e.target.value)} placeholder="Ej: 4" />
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
            <div className="resumen-fila"><span>Llegada (aprox.)</span><strong>{horaLlegada || '—'}</strong></div>
            <div className="resumen-fila"><span>Cupo</span><strong>{Number(form.cupo_total) > 0 ? `${form.cupo_total} pasajero${Number(form.cupo_total) === 1 ? '' : 's'}` : '—'}</strong></div>
            <div className="resumen-fila"><span>Repetición</span><strong>{textoRepeticion}</strong></div>
            <p className="nota-resumen">Al registrarlo, el viaje quedará <strong>Programado</strong> y visible para que los clientes puedan asociarse.</p>
          </div>
        </aside>
      </form>
    </section>
  )
}
