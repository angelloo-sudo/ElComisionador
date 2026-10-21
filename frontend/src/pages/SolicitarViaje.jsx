// US19 (cliente): formulario para solicitar un viaje publicado por el comisionista,
// como pasajero o para enviar una encomienda. El comisionista la acepta o la rechaza.
import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/client.js'
import Icon from '../components/Icon.jsx'
import { Campo, Alerta, formatoFecha } from '../components/ui.jsx'
import { codigoViaje } from './ViajeNuevo.jsx'
import MapaRuta from '../components/MapaRuta.jsx'
import LocalidadSelect from '../components/LocalidadSelect.jsx'
import useLocalidades from '../hooks/useLocalidades.js'
import { formatoDuracion, formatoPesos } from '../utils/tarifa.js'

const FORM_INICIAL = {
  // pasajero
  nombre: '', apellido: '', dni: '', telefono: '', cantidad_pasajeros: '1', forma_pago: '',
  equipaje_detalle: '',
  // encomienda
  peso_kg: '', ancho_cm: '', largo_cm: '', tipo_contenido: '', contenido_descripcion: '',
  emisor_nombre: '', emisor_apellido: '', emisor_telefono: '',
  receptor_nombre: '', receptor_apellido: '', receptor_telefono: '',
  // ubicaciones (comunes)
  origen_calle: '', origen_altura: '', origen_codigo_postal: '', origen_descripcion: '',
  destino_calle: '', destino_altura: '', destino_codigo_postal: '',
}

const TIPOS_CONTENIDO = [
  ['electronica', 'Electrónica'], ['ropa', 'Ropa'], ['alimentos', 'Comestibles'], ['libros', 'Libros'],
  ['hogar', 'Hogar'], ['documentacion', 'Documentación'], ['juguetes', 'Juguetes'], ['otro', 'Otro'],
]

const SOLO_NUMEROS = /^\d*$/
const TEXTO_ACCION = { sube: 'sube un pasajero', baja: 'baja un pasajero', retira: 'se retira una encomienda', entrega: 'se entrega una encomienda' }

export default function SolicitarViaje() {
  const { id } = useParams()
  const navegar = useNavigate()
  const [viaje, setViaje] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState(null)
  const [tipo, setTipo] = useState('pasajero')
  const [llevaEquipaje, setLlevaEquipaje] = useState(null) // null = sin responder
  const [fragil, setFragil] = useState(null) // null = sin responder
  const [form, setForm] = useState(FORM_INICIAL)
  const [errores, setErrores] = useState({})
  const [errorGeneral, setErrorGeneral] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [enviada, setEnviada] = useState(null)
  // Verificacion de direcciones: verif.origen / verif.destino = { clave, estado, ... }
  const [verif, setVerif] = useState({})
  const pedidos = useRef({}) // clave -> promesa, para no repetir la misma consulta
  const { localidades, cargando: cargandoLocalidades } = useLocalidades()
  // Paradas: localidad donde sube / se retira el paquete (origen) y donde baja / se entrega (destino).
  // Por defecto son las del viaje completo.
  const [loc, setLoc] = useState({ origen: '', destino: '' })
  // Tramo elegido: { estado: 'cargando' | 'ok' | 'invalido' | 'no_disponible', precio_persona, completo, desde, hasta, geometria, mensaje }
  const [tramo, setTramo] = useState(null)
  // Paradas ya confirmadas de otros pasajeros/encomiendas del viaje (solo localidades).
  const [otrasParadas, setOtrasParadas] = useState([])
  const pinesOtras = useMemo(() => otrasParadas.flatMap((p) => p.acciones.map((a) => ({
    lat: p.lat, lon: p.lon, accion: a, estado: 'aceptada', texto: `${p.localidad}: ${TEXTO_ACCION[a]}`,
  }))), [otrasParadas])

  useEffect(() => {
    Promise.all([api.get(`/solicitudes/viajes-disponibles/${id}`), api.get('/auth/perfil').catch(() => null)])
      .then(([v, perfil]) => {
        setViaje(v)
        setLoc({ origen: v.origen, destino: v.destino })
        const tomados = (v.mis_solicitudes ?? []).map((s) => s.tipo)
        if (v.cupos_disponibles === 0 || tomados.includes('pasajero')) setTipo('encomienda')
        if (perfil) {
          setForm((f) => ({ ...f, nombre: perfil.nombre ?? '', apellido: perfil.apellido ?? '', dni: perfil.dni ?? '', telefono: perfil.telefono ?? '' }))
        }
      })
      .catch((err) => setErrorCarga(err.message))
      .finally(() => setCargando(false))
  }, [id])

  const okOrigen = verif.origen?.estado === 'ok' ? verif.origen.clave : ''
  const okDestino = verif.destino?.estado === 'ok' ? verif.destino.clave : ''

  useEffect(() => {
    api.get(`/solicitudes/viajes-disponibles/${id}/paradas`).then((r) => setOtrasParadas(r.paradas ?? [])).catch(() => setOtrasParadas([]))
  }, [id])

  // Cada vez que cambian las paradas se calcula el tramo: precio de una persona y parte de la ruta para el mapa.
  useEffect(() => {
    if (!viaje) return undefined
    if (!loc.origen || !loc.destino) { setTramo(null); return undefined }
    let vigente = true
    setTramo((t) => ({ ...(t ?? {}), estado: 'cargando' }))
    const q = new URLSearchParams({ desde: loc.origen, hasta: loc.destino })
    // Con la direccion verificada el tramo se mide desde la calle y altura exactas, no desde el centro de la localidad.
    if (okOrigen) { q.set('desde_calle', form.origen_calle.trim()); q.set('desde_altura', form.origen_altura.trim()); q.set('desde_cp', form.origen_codigo_postal.trim()) }
    if (okDestino) { q.set('hasta_calle', form.destino_calle.trim()); q.set('hasta_altura', form.destino_altura.trim()); q.set('hasta_cp', form.destino_codigo_postal.trim()) }
    api.get(`/solicitudes/viajes-disponibles/${viaje.viaje_id}/tramo?${q}`)
      .then((r) => { if (vigente) setTramo(r) })
      .catch((e) => { if (vigente) setTramo({ estado: 'no_disponible', mensaje: e.message }) })
    return () => { vigente = false }
  }, [viaje, loc.origen, loc.destino, okOrigen, okDestino]) // eslint-disable-line react-hooks/exhaustive-deps

  // Si cambia la localidad de una parada, la calle y la altura ya escritas se vuelven a verificar en la nueva.
  useEffect(() => { if (viaje && loc.origen) verificar('origen') }, [loc.origen]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (viaje && loc.destino) verificar('destino') }, [loc.destino]) // eslint-disable-line react-hooks/exhaustive-deps

  function cambiarLocalidad(prefijo, valor) {
    setLoc((l) => ({ ...l, [prefijo]: valor }))
    setVerif((v) => ({ ...v, [prefijo]: undefined }))
    setErrores((e) => ({ ...e, [`${prefijo}_localidad`]: undefined }))
  }

  function cambiar(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }))
    setErrores((e) => ({ ...e, [campo]: undefined }))
    const prefijo = /^(origen|destino)_(calle|altura)$/.exec(campo)?.[1]
    if (prefijo) setVerif((v) => ({ ...v, [prefijo]: undefined })) // la direccion cambio: hay que volver a verificar
  }

  // Comprueba que la calle y la altura existan en la localidad elegida para esa parada. Devuelve el resultado, o null si todavia no hay datos suficientes.
  async function verificar(prefijo, valores = form) {
    const calle = valores[`${prefijo}_calle`].trim()
    const altura = valores[`${prefijo}_altura`].trim()
    if (!viaje || calle.length < 2 || !altura) return null
    const localidad = loc[prefijo]
    if (!localidad) return null
    const cp = valores[`${prefijo}_codigo_postal`].trim()
    const clave = `${calle}|${altura}|${localidad}|${cp}`
    setVerif((v) => (v[prefijo]?.clave === clave ? v : { ...v, [prefijo]: { clave, estado: 'verificando', localidad } }))
    if (!pedidos.current[clave]) {
      pedidos.current[clave] = api.post('/geo/validar-direccion', { calle, altura, localidad, codigo_postal: cp })
        .catch(() => ({ estado: 'no_verificable' }))
    }
    const resultado = await pedidos.current[clave]
    setVerif((v) => (v[prefijo]?.clave === clave ? { ...v, [prefijo]: { ...resultado, clave, localidad } } : v))
    if (resultado.codigo_postal_sugerido) {
      setForm((f) => (f[`${prefijo}_codigo_postal`].trim() ? f : { ...f, [`${prefijo}_codigo_postal`]: resultado.codigo_postal_sugerido }))
    }
    return resultado
  }
  const num = (campo) => (e) => { if (SOLO_NUMEROS.test(e.target.value)) cambiar(campo, e.target.value) }
  const txt = (campo) => (e) => cambiar(campo, e.target.value)

  const libres = viaje?.cupos_disponibles ?? 0
  // Un mismo viaje admite una solicitud de pasajero y otra de encomienda; mientras la anterior de un tipo
  // siga vigente (pendiente o aceptada) no se puede repetir. Si se canceló o el comisionista la rechazó, se puede volver a pedir.
  const yaPasajero = (viaje?.mis_solicitudes ?? []).some((s) => s.tipo === 'pasajero')
  const yaEncomienda = (viaje?.mis_solicitudes ?? []).some((s) => s.tipo === 'encomienda')
  const cantidad = Number(form.cantidad_pasajeros) || 0
  // Total a pagar: el precio por persona lo calcula el sistema; con varios pasajeros se multiplica.
  const viajeCompleto = Boolean(viaje) && loc.origen === viaje.origen && loc.destino === viaje.destino
  const precioPersona = tramo?.estado === 'ok' ? tramo.precio_persona : (viajeCompleto && tramo?.estado !== 'invalido' ? viaje?.precio_pasajero : null)
  const monto = precioPersona == null ? null : Math.round(Number(precioPersona) * (tipo === 'pasajero' ? Math.max(cantidad, 1) : 1) * 100) / 100
  const tramoInvalido = tramo?.estado === 'invalido'

  function validar() {
    const e = {}
    const req = (campo, msg) => { if (!String(form[campo]).trim()) e[campo] = msg }
    if (!loc.origen) e.origen_localidad = 'Elegí la localidad de la lista'
    if (!loc.destino) e.destino_localidad = 'Elegí la localidad de la lista'
    req('origen_calle', 'Indicá la calle'); req('origen_codigo_postal', 'Indicá el código postal')
    if (!form.origen_altura) e.origen_altura = 'Indicá la altura'
    req('destino_calle', 'Indicá la calle'); req('destino_codigo_postal', 'Indicá el código postal')
    if (!form.destino_altura) e.destino_altura = 'Indicá la altura'
    if (!form.forma_pago) e.forma_pago = 'Elegí la forma de pago'
    if (tipo === 'pasajero') {
      req('nombre', 'Ingresá tu nombre'); req('apellido', 'Ingresá tu apellido')
      if (!/^\d{7,8}$/.test(form.dni.trim())) e.dni = 'El DNI debe tener 7 u 8 dígitos'
      req('telefono', 'Ingresá tu número de celular')
      if (llevaEquipaje === null) e.equipaje = 'Indicá si llevás equipaje'
      else if (llevaEquipaje && form.equipaje_detalle.trim().length < 3) e.equipaje_detalle = 'Especificá qué equipaje llevás'
      if (!Number.isInteger(cantidad) || cantidad < 1) e.cantidad = 'Indicá cuántos pasajeros son (mínimo 1)'
      else if (cantidad > libres) e.cantidad = `Solo quedan ${libres} lugar${libres === 1 ? '' : 'es'} en este viaje`
    } else {
      if (!form.tipo_contenido) e.tipo_contenido = 'Elegí el tipo de contenido'
      else if (form.tipo_contenido === 'otro' && form.contenido_descripcion.trim().length < 3) e.contenido_descripcion = 'Aclará qué contiene el paquete'
      if (fragil === null) e.fragil = 'Indicá si el paquete es frágil'
      for (const c of ['peso_kg', 'ancho_cm', 'largo_cm']) {
        if (!(Number(String(form[c]).replace(',', '.')) > 0)) e[c] = 'Ingresá un valor mayor a 0'
      }
      for (const c of ['emisor_nombre', 'emisor_apellido', 'emisor_telefono', 'receptor_nombre', 'receptor_apellido', 'receptor_telefono']) req(c, 'Campo obligatorio')
    }
    return e
  }

  async function enviar(ev) {
    ev.preventDefault()
    setErrorGeneral(null)
    const encontrados = validar()
    if (Object.keys(encontrados).length > 0) {
      setErrores(encontrados)
      setErrorGeneral({ tipo: 'error', titulo: 'Revisá los datos', texto: 'Completá los campos marcados con un formato válido para enviar la solicitud.' })
      return
    }
    if (tramoInvalido) {
      setErrorGeneral({ tipo: 'error', titulo: 'Revisá las paradas', texto: tramo.mensaje })
      return
    }
    setGuardando(true)
    try {
      const [vOrigen, vDestino] = await Promise.all([verificar('origen'), verificar('destino')])
      const inexistentes = {}
      if (vOrigen?.estado === 'no_encontrada') inexistentes.origen_calle = 'No encontramos esa calle. Revisá cómo está escrita'
      if (vDestino?.estado === 'no_encontrada') inexistentes.destino_calle = 'No encontramos esa calle. Revisá cómo está escrita'
      if (Object.keys(inexistentes).length > 0) {
        setErrores(inexistentes)
        setErrorGeneral({ tipo: 'error', titulo: 'Revisá las direcciones', texto: 'No pudimos encontrar una de las direcciones. Corregí la calle o la altura para enviar la solicitud.' })
        setGuardando(false)
        return
      }
      const decimal = (v) => Number(String(v).replace(',', '.'))
      const payload = {
        viaje_id: Number(id), tipo,
        origen_localidad: loc.origen, destino_localidad: loc.destino,
        origen_calle: form.origen_calle, origen_altura: form.origen_altura, origen_codigo_postal: form.origen_codigo_postal, origen_descripcion: form.origen_descripcion,
        destino_calle: form.destino_calle, destino_altura: form.destino_altura, destino_codigo_postal: form.destino_codigo_postal,
        forma_pago: form.forma_pago,
        ...(tipo === 'pasajero'
          ? { nombre: form.nombre, apellido: form.apellido, dni: form.dni, telefono: form.telefono, lleva_equipaje: llevaEquipaje, equipaje_detalle: llevaEquipaje ? form.equipaje_detalle : '', cantidad_pasajeros: cantidad }
          : { tipo_contenido: form.tipo_contenido, contenido_descripcion: form.tipo_contenido === 'otro' ? form.contenido_descripcion : '', fragil,
              peso_kg: decimal(form.peso_kg), ancho_cm: decimal(form.ancho_cm), largo_cm: decimal(form.largo_cm),
              emisor_nombre: form.emisor_nombre, emisor_apellido: form.emisor_apellido, emisor_telefono: form.emisor_telefono,
              receptor_nombre: form.receptor_nombre, receptor_apellido: form.receptor_apellido, receptor_telefono: form.receptor_telefono }),
      }
      const creada = await api.post('/solicitudes', payload)
      setEnviada({ tipo, cantidad, monto: creada?.monto ?? null, desde: loc.origen, hasta: loc.destino })
    } catch (err) {
      setErrorGeneral({ tipo: /ya tenés|quedan|cupos|inici|programad/i.test(err.message) ? 'aviso' : 'error', titulo: 'No se pudo enviar la solicitud', texto: err.message })
    } finally {
      setGuardando(false)
    }
  }

  const migas = (
    <nav className="migas" aria-label="Ruta">
      <button type="button" onClick={() => navegar('/mis-traslados')}>Mis traslados</button>
      <Icon nombre="right" tamano={14} />
      <strong>Solicitar viaje{viaje ? ` ${codigoViaje(viaje.viaje_id)}` : ''}</strong>
    </nav>
  )

  if (cargando) return <section>{migas}<p className="vacio">Cargando viaje...</p></section>
  if (errorCarga) {
    return (
      <section>
        {migas}
        <Alerta tipo="aviso" titulo="Este viaje no está disponible">{errorCarga}</Alerta>
        <button type="button" className="btn" onClick={() => navegar('/mis-traslados')}>Volver a Mis traslados</button>
      </section>
    )
  }

  const recorrido = `${viaje.origen} → ${viaje.destino}`
  const salida = `${formatoFecha(`${viaje.fecha}T12:00:00`)} · ${viaje.hora_salida.slice(0, 5)}`

  if (enviada) {
    return (
      <section>
        {migas}
        <div className="card exito-card">
          <span className="icono-caja"><Icon nombre="checkcircle" tamano={26} /></span>
          <h2>Solicitud enviada</h2>
          <p>El comisionista va a revisar tu solicitud. {enviada.tipo === 'pasajero' ? 'Tus lugares quedan confirmados recién cuando la acepte.' : 'Te va a avisar si acepta llevar tu encomienda.'}</p>
          <div className="exito-detalle">
            <div className="resumen-fila"><span>Viaje</span><strong>{codigoViaje(viaje.viaje_id)} · {recorrido}</strong></div>
            <div className="resumen-fila"><span>Salida</span><strong>{salida}</strong></div>
            <div className="resumen-fila"><span>{enviada.tipo === 'pasajero' ? 'Subís en' : 'Se retira en'}</span><strong>{enviada.desde}</strong></div>
            <div className="resumen-fila"><span>{enviada.tipo === 'pasajero' ? 'Bajás en' : 'Se entrega en'}</span><strong>{enviada.hasta}</strong></div>
            <div className="resumen-fila"><span>Tipo</span><strong>{enviada.tipo === 'pasajero' ? `Pasajero${enviada.cantidad > 1 ? `s (${enviada.cantidad})` : ''}` : 'Encomienda'}</strong></div>
            <div className="resumen-fila"><span>Monto</span><strong>{enviada.monto == null ? 'A convenir con el comisionista' : formatoPesos(enviada.monto)}</strong></div>
            <div className="resumen-fila"><span>Estado</span><span className="badge punto ambar">Pendiente</span></div>
          </div>
          <div className="exito-acciones">
            <button type="button" className="btn btn-primario" onClick={() => navegar('/mis-traslados', { state: { pestana: 'solicitudes' } })}>Ver mis solicitudes <Icon nombre="arrow" tamano={16} /></button>
          </div>
        </div>
      </section>
    )
  }

  const mensajeVerificacion = (prefijo) => {
    const v = verif[prefijo]
    if (!v) return null
    const donde = v.localidad ? ` en ${v.localidad}` : ''
    if (v.estado === 'verificando') return <p className="verif neutro">Verificando la dirección...</p>
    if (v.estado === 'ok') return <p className="verif ok"><Icon nombre="checkcircle" tamano={16} />Dirección verificada: {v.direccion_normalizada}</p>
    if (v.estado === 'altura_no_confirmada') return <p className="verif aviso"><Icon nombre="alert" tamano={16} />La calle existe{donde}, pero no pudimos confirmar esa altura. Revisá que el número sea correcto.</p>
    if (v.estado === 'otra_localidad') return <p className="verif aviso"><Icon nombre="alert" tamano={16} />Esa dirección existe, pero no{donde}: encontramos {v.direccion_normalizada}. ¿Es la correcta?</p>
    if (v.estado === 'no_encontrada') return <p className="verif error"><Icon nombre="alert" tamano={16} />No encontramos esa calle{donde}. Revisá cómo está escrita.</p>
    return null
  }

  const ubicacion = (prefijo, titulo, conDescripcion) => (
    <div className="seccion">
      <p className="seccion-titulo">{titulo}</p>
      <div style={{ marginBottom: 16 }}>
        <LocalidadSelect
          label="Localidad"
          value={loc[prefijo]}
          onChange={(v) => cambiarLocalidad(prefijo, v)}
          localidades={localidades}
          deshabilitado={cargandoLocalidades}
          error={errores[`${prefijo}_localidad`]}
        />
        {loc[prefijo] && loc[prefijo] !== (prefijo === 'origen' ? viaje.origen : viaje.destino) && (
          <p className="paradas-ayuda">Es una parada intermedia: el viaje va de {viaje.origen} a {viaje.destino}.</p>
        )}
      </div>
      <div className="grilla-3">
        <Campo label="Calle" requerido icono="pin" error={errores[`${prefijo}_calle`]}>
          <input value={form[`${prefijo}_calle`]} onChange={txt(`${prefijo}_calle`)} onBlur={() => verificar(prefijo)} maxLength={100} placeholder="Ej: San Martín" />
        </Campo>
        <Campo label="Altura" requerido error={errores[`${prefijo}_altura`]}>
          <input inputMode="numeric" value={form[`${prefijo}_altura`]} onChange={num(`${prefijo}_altura`)} onBlur={() => verificar(prefijo)} maxLength={6} placeholder="Ej: 1234" />
        </Campo>
        <Campo label="Código postal" requerido error={errores[`${prefijo}_codigo_postal`]}>
          <input value={form[`${prefijo}_codigo_postal`]} onChange={txt(`${prefijo}_codigo_postal`)}
            onBlur={() => { if (verif[prefijo]?.estado !== 'ok') verificar(prefijo) }} maxLength={8} placeholder="Ej: 5000" />
        </Campo>
      </div>
      {mensajeVerificacion(prefijo)}
      {conDescripcion && (
        <div style={{ marginTop: 16 }}>
          <Campo label="Descripción del lugar" opcional="(opcional)" ayuda="Ayudale al comisionista a encontrarte. Ej: casa negra con escaleras blancas y macetas por fuera.">
            <textarea className="area" rows={3} maxLength={300} value={form.origen_descripcion} onChange={txt('origen_descripcion')} />
          </Campo>
        </div>
      )}
    </div>
  )

  // Forma de pago (efectivo / transferencia): la piden tanto pasajeros como encomiendas.
  const pago = (titulo) => (
                <div className="seccion">
                  <p className="seccion-titulo">{titulo}</p>
                  <div className="segmentado" role="radiogroup" aria-label="Forma de pago">
                    <button type="button" role="radio" aria-checked={form.forma_pago === 'efectivo'} className={form.forma_pago === 'efectivo' ? 'activo' : ''} onClick={() => cambiar('forma_pago', 'efectivo')}>Efectivo</button>
                    <button type="button" role="radio" aria-checked={form.forma_pago === 'transferencia'} className={form.forma_pago === 'transferencia' ? 'activo' : ''} onClick={() => cambiar('forma_pago', 'transferencia')}>Transferencia</button>
                  </div>
                  {errores.forma_pago && <p className="campo-error" style={{ marginTop: 8 }}><Icon nombre="alert" tamano={16} />{errores.forma_pago}</p>}
                </div>
  )

  const persona = (prefijo, titulo) => (
    <div className="seccion">
      <p className="seccion-titulo">{titulo}</p>
      <div className="grilla-3">
        <Campo label="Nombre" requerido icono="user" error={errores[`${prefijo}_nombre`]}><input value={form[`${prefijo}_nombre`]} onChange={txt(`${prefijo}_nombre`)} maxLength={120} /></Campo>
        <Campo label="Apellido" requerido error={errores[`${prefijo}_apellido`]}><input value={form[`${prefijo}_apellido`]} onChange={txt(`${prefijo}_apellido`)} maxLength={120} /></Campo>
        <Campo label="Teléfono" requerido icono="phone" error={errores[`${prefijo}_telefono`]}><input inputMode="tel" value={form[`${prefijo}_telefono`]} onChange={txt(`${prefijo}_telefono`)} maxLength={20} /></Campo>
      </div>
    </div>
  )

  return (
    <section>
      {migas}
      {errorGeneral && <Alerta tipo={errorGeneral.tipo} titulo={errorGeneral.titulo}>{errorGeneral.texto}</Alerta>}

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-cabecera"><h2>Viaje {codigoViaje(viaje.viaje_id)}</h2></div>
        <div className="card-cuerpo detalle-solicitud">
          <div className="viaje-detalle">
            <div className="resumen-fila"><span>Recorrido</span><strong>{recorrido}</strong></div>
            <div className="resumen-fila"><span>Salida</span><strong>{salida}</strong></div>
            <div className="resumen-fila"><span>Duración</span><strong>{formatoDuracion(viaje.duracion_min)}</strong></div>
            <div className="resumen-fila"><span>Comisionista</span><strong>{`${viaje.comisionista_nombre} ${viaje.comisionista_apellido ?? ''}`.trim()}</strong></div>
            <div className="resumen-fila"><span>Cupos para pasajeros</span><strong>{viaje.ocupados} / {viaje.cupo_total}</strong></div>
            <div className="cupo-barra" aria-hidden="true"><span style={{ width: `${Math.min(100, (viaje.ocupados / Math.max(viaje.cupo_total, 1)) * 100)}%` }} /></div>
          </div>
          <div>
            <MapaRuta origen={viaje.origen} destino={viaje.destino} alto={340} mostrarKm={false} tramo={tramo?.estado === 'ok' && !tramo.completo ? tramo : null} paradas={pinesOtras} />
            {otrasParadas.length > 0 && (
              <div className="paradas-cliente">
                <b>Este viaje ya tiene paradas confirmadas</b>
                <ul>{otrasParadas.map((p) => <li key={p.localidad}>{p.localidad}: {p.acciones.map((a) => TEXTO_ACCION[a]).join(' y ')}</li>)}</ul>
              </div>
            )}
            {tramo?.estado === 'ok' && (tramo.desde?.precisa || tramo.hasta?.precisa) && (
              <p className="campo-ayuda paradas-ayuda">Calculamos el precio desde la dirección exacta que ingresaste.</p>
            )}
            {tramoInvalido && <p className="verif error paradas-aviso"><Icon nombre="alert" tamano={16} />{tramo.mensaje}</p>}
            {tramo?.estado === 'no_disponible' && <p className="verif aviso paradas-aviso"><Icon nombre="alert" tamano={16} />No pudimos calcular el tramo ahora. {tramo.mensaje ?? 'Probá de nuevo en unos minutos.'}</p>}
          </div>
        </div>
      </div>

      <form className="form-viaje" onSubmit={enviar} noValidate>
        <div className="card">
          <div className="card-cabecera">
            <div>
              <h2>Solicitar viaje</h2>
              <p>Elegí cómo querés sumarte y completá los datos. El comisionista decide si acepta tu solicitud.</p>
            </div>
          </div>
          <div className="card-cuerpo">
            <div className="seccion">
              <p className="seccion-titulo">¿Qué querés hacer?</p>
              <div className="segmentado" role="radiogroup" aria-label="Tipo de solicitud">
                <button type="button" role="radio" aria-checked={tipo === 'pasajero'} disabled={libres === 0 || yaPasajero} className={tipo === 'pasajero' ? 'activo' : ''} onClick={() => setTipo('pasajero')}>Viajar como pasajero</button>
                <button type="button" role="radio" aria-checked={tipo === 'encomienda'} disabled={yaEncomienda} className={tipo === 'encomienda' ? 'activo' : ''} onClick={() => setTipo('encomienda')}>Enviar una encomienda</button>
              </div>
              {(yaPasajero || yaEncomienda) && (
                <p className="campo-ayuda" style={{ marginTop: 12 }}>
                  {yaPasajero && yaEncomienda
                    ? 'Ya solicitaste como pasajero y como encomienda en este viaje. Para volver a solicitar, cancelá la solicitud anterior desde Mis traslados.'
                    : yaPasajero
                      ? 'Ya solicitaste viajar como pasajero en este viaje. Para volver a hacerlo, cancelá antes esa solicitud en Mis traslados.'
                      : 'Ya solicitaste enviar una encomienda en este viaje. Para volver a hacerlo, cancelá antes esa solicitud en Mis traslados.'}
                </p>
              )}
              {libres === 0 && !yaPasajero && <p className="campo-ayuda" style={{ marginTop: 12 }}>Este viaje ya no tiene lugares para pasajeros, pero podés enviar una encomienda.</p>}
            </div>

            {tipo === 'pasajero' ? (
              <>
                <div className="seccion">
                  <p className="seccion-titulo">Tus datos</p>
                  <div className="grilla-2">
                    <Campo label="Nombre" requerido icono="user" error={errores.nombre}><input value={form.nombre} onChange={txt('nombre')} maxLength={120} /></Campo>
                    <Campo label="Apellido" requerido error={errores.apellido}><input value={form.apellido} onChange={txt('apellido')} maxLength={120} /></Campo>
                    <Campo label="DNI" requerido icono="idcard" error={errores.dni}><input inputMode="numeric" value={form.dni} onChange={num('dni')} maxLength={8} /></Campo>
                    <Campo label="Número de celular" requerido icono="phone" error={errores.telefono}><input inputMode="tel" value={form.telefono} onChange={txt('telefono')} maxLength={20} /></Campo>
                  </div>
                </div>

                <div className="seccion">
                  <p className="seccion-titulo">Pasajeros y equipaje</p>
                  <div className="grilla-2">
                    <Campo label="Cantidad de pasajeros" requerido icono="seat" error={errores.cantidad} ayuda={`Contá a todas las personas que viajan con vos. Quedan ${libres} lugar${libres === 1 ? '' : 'es'}.`}>
                      <input inputMode="numeric" value={form.cantidad_pasajeros} onChange={num('cantidad_pasajeros')} maxLength={2} />
                      <span className="stepper">
                        <button type="button" aria-label="Quitar un pasajero" onClick={() => cambiar('cantidad_pasajeros', String(Math.max(1, cantidad - 1)))}><Icon nombre="minus" tamano={14} /></button>
                        <button type="button" aria-label="Agregar un pasajero" onClick={() => cambiar('cantidad_pasajeros', String(Math.min(libres, cantidad + 1)))}><Icon nombre="plus" tamano={14} /></button>
                      </span>
                    </Campo>
                    <div className="campo">
                      <label>¿Llevás equipaje?<span className="req">*</span></label>
                      <div className="segmentado" role="radiogroup" aria-label="Lleva equipaje">
                        <button type="button" role="radio" aria-checked={llevaEquipaje === true} className={llevaEquipaje === true ? 'activo' : ''} onClick={() => { setLlevaEquipaje(true); setErrores((e) => ({ ...e, equipaje: undefined })) }}>Sí</button>
                        <button type="button" role="radio" aria-checked={llevaEquipaje === false} className={llevaEquipaje === false ? 'activo' : ''} onClick={() => { setLlevaEquipaje(false); setErrores((e) => ({ ...e, equipaje: undefined, equipaje_detalle: undefined })) }}>No</button>
                      </div>
                      {errores.equipaje && <p className="campo-error"><Icon nombre="alert" tamano={16} />{errores.equipaje}</p>}
                    </div>
                  </div>
                  {llevaEquipaje === true && (
                    <div style={{ marginTop: 16 }}>
                      <Campo label="¿Qué equipaje llevás?" requerido error={errores.equipaje_detalle}>
                        <textarea className="area" rows={2} maxLength={300} value={form.equipaje_detalle} onChange={txt('equipaje_detalle')} placeholder="Ej: 2 valijas medianas y una mochila" />
                      </Campo>
                    </div>
                  )}
                </div>

                {ubicacion('origen', 'Dónde te buscan', true)}
                {ubicacion('destino', 'Dónde te querés bajar', false)}
                {pago('Forma de pago')}
              </>
            ) : (
              <>
                {ubicacion('origen', 'Dónde se retira el paquete', true)}
                {ubicacion('destino', 'Dónde se entrega', false)}

                <div className="seccion">
                  <p className="seccion-titulo">Paquete</p>
                  <div className="grilla-3">
                    <Campo label="Peso (kg)" requerido error={errores.peso_kg}><input inputMode="decimal" value={form.peso_kg} onChange={txt('peso_kg')} placeholder="Ej: 4,5" /></Campo>
                    <Campo label="Ancho (cm)" requerido error={errores.ancho_cm}><input inputMode="decimal" value={form.ancho_cm} onChange={txt('ancho_cm')} placeholder="Ej: 30" /></Campo>
                    <Campo label="Largo (cm)" requerido error={errores.largo_cm}><input inputMode="decimal" value={form.largo_cm} onChange={txt('largo_cm')} placeholder="Ej: 40" /></Campo>
                  </div>
                  <div className="grilla-2" style={{ marginTop: 16 }}>
                    <Campo label="Tipo de contenido" requerido icono="package" error={errores.tipo_contenido}>
                      <select value={form.tipo_contenido} onChange={txt('tipo_contenido')}>
                        <option value="">Seleccioná un tipo</option>
                        {TIPOS_CONTENIDO.map(([valor, texto]) => <option key={valor} value={valor}>{texto}</option>)}
                      </select>
                      <Icon nombre="down" />
                    </Campo>
                    <div className="campo">
                      <label>¿Es frágil?<span className="req">*</span></label>
                      <div className="segmentado" role="radiogroup" aria-label="Es frágil">
                        <button type="button" role="radio" aria-checked={fragil === true} className={fragil === true ? 'activo' : ''} onClick={() => { setFragil(true); setErrores((e) => ({ ...e, fragil: undefined })) }}>Sí, es frágil</button>
                        <button type="button" role="radio" aria-checked={fragil === false} className={fragil === false ? 'activo' : ''} onClick={() => { setFragil(false); setErrores((e) => ({ ...e, fragil: undefined })) }}>No</button>
                      </div>
                      {errores.fragil && <p className="campo-error"><Icon nombre="alert" tamano={16} />{errores.fragil}</p>}
                    </div>
                  </div>
                  {form.tipo_contenido === 'otro' && (
                    <div style={{ marginTop: 16 }}>
                      <Campo label="¿Qué contiene?" requerido error={errores.contenido_descripcion}>
                        <textarea className="area" rows={2} maxLength={300} value={form.contenido_descripcion} onChange={txt('contenido_descripcion')} placeholder="Ej: repuestos de bicicleta" />
                      </Campo>
                    </div>
                  )}
                </div>

                {persona('emisor', 'Quien envía (emisor)')}
                {persona('receptor', 'Quien recibe (receptor)')}

                {pago('Forma de pago del envío')}
              </>
            )}
          </div>
          <div className="card-pie">
            <button type="button" className="btn" onClick={() => navegar('/mis-traslados')} disabled={guardando}>Cancelar</button>
            <button type="submit" className="btn btn-primario" disabled={guardando || tramoInvalido || (yaPasajero && yaEncomienda) || (tipo === 'pasajero' ? yaPasajero || libres === 0 : yaEncomienda)}>
              <Icon nombre="checkcircle" tamano={16} /> {guardando ? 'Enviando...' : 'Enviar solicitud'}
            </button>
          </div>
        </div>

        <aside className="card">
          <div className="card-cabecera"><h2>Precio</h2></div>
          <div className="card-cuerpo">
            <div className="resumen-fila"><span>{tipo === 'pasajero' ? 'Subís en' : 'Se retira en'}</span><strong>{loc.origen || '—'}</strong></div>
            <div className="resumen-fila"><span>{tipo === 'pasajero' ? 'Bajás en' : 'Se entrega en'}</span><strong>{loc.destino || '—'}</strong></div>
            <div className="precio-total"><span>Total a pagar</span><strong>{monto == null ? '—' : formatoPesos(monto)}</strong></div>
            {monto == null && !tramoInvalido && tramo?.estado !== 'cargando' && <p className="nota-resumen" style={{ marginTop: 12 }}>El monto se acuerda con el comisionista.</p>}
            {!tramoInvalido && viaje && !viajeCompleto && monto != null && <p className="nota-resumen" style={{ marginTop: 12 }}>Pagás solo el tramo que recorrés, no el viaje completo.</p>}
            {tipo === 'pasajero' && cantidad > 0 && cantidad <= libres && (
              <p className="nota-resumen">Si el comisionista acepta, el cupo pasa a <strong>{viaje.ocupados + cantidad} / {viaje.cupo_total}</strong>.</p>
            )}
          </div>
        </aside>
      </form>
    </section>
  )
}
