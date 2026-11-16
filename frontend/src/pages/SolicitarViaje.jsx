// US19 (cliente): solicitar un viaje publicado por el comisionista. Al entrar se ven las dos
// opciones juntas: a la izquierda "Enviar una encomienda" y a la derecha "Viajar como pasajero",
// cada una con su propio formulario, precio y envío. El comisionista acepta o rechaza cada solicitud.
import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { api } from '../api/client.js'
import Icon from '../components/Icon.jsx'
import { Campo, Alerta, formatoFecha } from '../components/ui.jsx'
import { codigoViaje } from './ViajeNuevo.jsx'
import MapaRuta from '../components/MapaRuta.jsx'
import { formatoDuracion, formatoKm, formatoPesos } from '../utils/tarifa.js'

const FORM_INICIAL = {
  // pasajero
  nombre: '', apellido: '', dni: '', telefono: '', cantidad_pasajeros: '1', forma_pago: '',
  // encomienda
  tamano: '', tipo_contenido: '', contenido_descripcion: '',
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

const TAMANOS_PAQUETE = {
  pequeno: 'Equivale a 2 cajas de zapatillas',
  mediano: 'Equivale a una caja chica de mudanza',
  grande: 'Equivale a un televisor de 40 pulgadas',
}
const TAMANO_A_MINIMO = { pequeno: 'chica', mediano: 'mediana', grande: 'grande' }

const MAX_UNIDADES_EQUIPAJE = 10
const OPCIONES_TAMANO_EQUIPAJE = [
  { value: 'bolso_chico', label: 'Bolso chico (40 x 30 x 15 cm)', medidas: '40 x 30 x 15 cm' },
  { value: 'valija_chica', label: 'Valija chica (55 x 35 x 25 cm)', medidas: '55 x 35 x 25 cm' },
  { value: 'valija_mediana', label: 'Valija mediana (65 x 44 x 28 cm)', medidas: '65 x 44 x 28 cm' },
  { value: 'valija_grande', label: 'Valija grande (75 x 50 x 30 cm)', medidas: '75 x 50 x 30 cm' },
]

const SOLO_NUMEROS = /^\d*$/
const TEXTO_ACCION = { sube: 'sube un pasajero', baja: 'baja un pasajero', retira: 'se retira una encomienda', entrega: 'se entrega una encomienda' }
const aMinutos = (h) => Number(String(h).slice(0, 2)) * 60 + Number(String(h).slice(3, 5))

function detalleEquipaje(tamanos) {
  const cantidades = new Map()
  tamanos.forEach((tamano) => cantidades.set(tamano, (cantidades.get(tamano) ?? 0) + 1))
  return OPCIONES_TAMANO_EQUIPAJE
    .filter((opcion) => cantidades.has(opcion.value))
    .map((opcion) => `${opcion.label.split(' (')[0]} (${opcion.medidas}) × ${cantidades.get(opcion.value)}`)
    .join('; ')
}

function ReferenciaTamano({ tamano }) {
  return (
    <figure className="solicitud-tamano-referencia">
      <svg viewBox="0 0 240 120" aria-hidden="true" focusable="false">
        {tamano === 'pequeno' && (
          <g fill="var(--card)" stroke="var(--primario)" strokeWidth="3" strokeLinejoin="round">
            <path d="M38 43 76 26l38 17-38 17Z" />
            <path d="M38 43v39l38 17V60Z" />
            <path d="M114 43v39L76 99V60Z" />
            <path d="M98 31 136 14l38 17-38 17Z" />
            <path d="M98 31v39l38 17V48Z" />
            <path d="M174 31v39l-38 17V48Z" />
            <path d="M76 26v34m60-46v34" fill="none" />
          </g>
        )}
        {tamano === 'mediano' && (
          <g fill="var(--card)" stroke="var(--primario)" strokeWidth="3" strokeLinejoin="round">
            <path d="m55 39 65-25 65 25-65 27Z" />
            <path d="M55 39v51l65 25V66Z" />
            <path d="M185 39v51l-65 25V66Z" />
            <path d="M120 14v52M55 39l65 27 65-27" fill="none" />
            <path d="m111 18 18 7-18 7" fill="none" />
          </g>
        )}
        {tamano === 'grande' && (
          <g stroke="var(--primario)" strokeWidth="3" strokeLinejoin="round">
            <rect x="34" y="12" width="172" height="82" rx="8" fill="var(--card)" />
            <rect x="44" y="22" width="152" height="62" rx="3" fill="var(--activo)" />
            <path d="M120 95v10m-27 4h54" fill="none" strokeLinecap="round" />
          </g>
        )}
      </svg>
      <figcaption>{TAMANOS_PAQUETE[tamano]}</figcaption>
    </figure>
  )
}

function SelectorDesplegable({ id, label, value, options, placeholder, onChange, error }) {
  const [abierto, setAbierto] = useState(false)
  const contenedorRef = useRef(null)
  const botonRef = useRef(null)
  const listaRef = useRef(null)
  const opcionSeleccionada = options.find((opcion) => opcion.value === value)

  useEffect(() => {
    if (!abierto) return undefined
    const cerrarAlHacerClickAfuera = (evento) => {
      if (!contenedorRef.current?.contains(evento.target)) setAbierto(false)
    }
    document.addEventListener('pointerdown', cerrarAlHacerClickAfuera)
    return () => document.removeEventListener('pointerdown', cerrarAlHacerClickAfuera)
  }, [abierto])

  function moverFoco(evento) {
    const opciones = Array.from(listaRef.current?.querySelectorAll('[role="option"]') ?? [])
    const indice = opciones.indexOf(evento.currentTarget)
    if (evento.key === 'ArrowDown' || evento.key === 'ArrowUp') {
      evento.preventDefault()
      const direccion = evento.key === 'ArrowDown' ? 1 : -1
      opciones[(indice + direccion + opciones.length) % opciones.length]?.focus()
    } else if (evento.key === 'Home') {
      evento.preventDefault()
      opciones[0]?.focus()
    } else if (evento.key === 'End') {
      evento.preventDefault()
      opciones[opciones.length - 1]?.focus()
    } else if (evento.key === 'Escape') {
      evento.preventDefault()
      setAbierto(false)
      botonRef.current?.focus()
    }
  }

  function abrirConFlecha(evento) {
    if (evento.key !== 'ArrowDown' && evento.key !== 'ArrowUp') return
    evento.preventDefault()
    setAbierto(true)
    requestAnimationFrame(() => {
      const opciones = listaRef.current?.querySelectorAll('[role="option"]')
      const opcion = evento.key === 'ArrowDown' ? opciones?.[0] : opciones?.[opciones.length - 1]
      opcion?.focus()
    })
  }

  return (
    <div
      className={`equipaje-selector campo${error ? ' tiene-error' : ''}`}
      ref={contenedorRef}
      onBlur={(evento) => {
        if (!evento.currentTarget.contains(evento.relatedTarget)) setAbierto(false)
      }}
    >
      <label id={`${id}-label`}>{label}<span className="req">*</span></label>
      <button
        ref={botonRef}
        type="button"
        className="equipaje-selector-boton selector-desplegable-boton"
        aria-labelledby={`${id}-label ${id}-valor`}
        aria-haspopup="listbox"
        aria-expanded={abierto}
        aria-controls={`${id}-opciones`}
        aria-invalid={Boolean(error)}
        onClick={() => setAbierto((actual) => !actual)}
        onKeyDown={abrirConFlecha}
      >
        <span className="selector-desplegable-icono"><Icon nombre="package" tamano={17} /></span>
        <span id={`${id}-valor`} className={`selector-desplegable-valor${opcionSeleccionada ? '' : ' vacio'}`}>{opcionSeleccionada?.label ?? placeholder}</span>
        <Icon nombre="down" tamano={18} className={`equipaje-selector-flecha${abierto ? ' abierta' : ''}`} />
      </button>
      <div
        ref={listaRef}
        className="equipaje-selector-opciones"
        id={`${id}-opciones`}
        role="listbox"
        aria-labelledby={`${id}-label`}
        hidden={!abierto}
      >
        {options.map((opcion) => (
          <button
            key={opcion.value}
            type="button"
            role="option"
            aria-selected={value === opcion.value}
            className={value === opcion.value ? 'activa' : ''}
            onClick={() => {
              onChange(opcion.value)
              setAbierto(false)
              botonRef.current?.focus()
            }}
            onKeyDown={moverFoco}
          >
            {opcion.label}
          </button>
        ))}
      </div>
      {error && <p className="campo-error"><Icon nombre="alert" tamano={16} />{error}</p>}
    </div>
  )
}

// Formulario de una solicitud (pasajero o encomienda) con su propio tramo, precio y envío.
// En encomienda la localidad de retiro y de entrega queda fija: es la del tramo elegido en la lista.
function FormularioSolicitud({ tipo, viaje, locInicial, perfil, errorPerfil, bloqueo, onEnviada }) {
  const esPasajero = tipo === 'pasajero'
  const [fragil, setFragil] = useState(null) // null = sin responder
  const [llevaEquipaje, setLlevaEquipaje] = useState(null)
  const [cantidadEquipaje, setCantidadEquipaje] = useState('1')
  const [tamanosEquipaje, setTamanosEquipaje] = useState([''])
  const [form, setForm] = useState(() => ({
    ...FORM_INICIAL,
    ...(esPasajero && perfil ? { nombre: perfil.nombre ?? '', apellido: perfil.apellido ?? '', dni: perfil.dni ?? '', telefono: perfil.telefono ?? '' } : {}),
  }))
  const perfilPasajeroAplicado = useRef(esPasajero && Boolean(perfil))
  const [errores, setErrores] = useState({})
  const [errorGeneral, setErrorGeneral] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [enviada, setEnviada] = useState(null)
  // Verificacion de direcciones: verif.origen / verif.destino = { clave, estado, ... }
  const [verif, setVerif] = useState({})
  const pedidos = useRef({}) // clave -> promesa, para no repetir la misma consulta
  const [loc, setLoc] = useState(locInicial)
  // Tramo elegido: { estado: 'cargando' | 'ok' | 'invalido' | 'no_disponible', precio_persona, completo, ... }
  const [tramo, setTramo] = useState(null)

  useEffect(() => {
    if (!esPasajero || !perfil || perfilPasajeroAplicado.current) return
    perfilPasajeroAplicado.current = true
    setForm((actual) => ({
      ...actual,
      nombre: actual.nombre || perfil.nombre || '',
      apellido: actual.apellido || perfil.apellido || '',
      dni: actual.dni || perfil.dni || '',
      telefono: actual.telefono || perfil.telefono || '',
    }))
  }, [esPasajero, perfil])

  const okOrigen = verif.origen?.estado === 'ok' ? verif.origen.clave : ''
  const okDestino = verif.destino?.estado === 'ok' ? verif.destino.clave : ''

  // Cada vez que cambian las paradas se calcula el tramo: precio de una persona y cupos del tramo.
  useEffect(() => {
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
  useEffect(() => { if (loc.origen) verificar('origen') }, [loc.origen]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (loc.destino) verificar('destino') }, [loc.destino]) // eslint-disable-line react-hooks/exhaustive-deps

  function cambiar(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }))
    setErrores((e) => ({ ...e, [campo]: undefined }))
    const prefijo = /^(origen|destino)_(calle|altura)$/.exec(campo)?.[1]
    if (prefijo) setVerif((v) => ({ ...v, [prefijo]: undefined })) // la direccion cambio: hay que volver a verificar
  }

  function cambiarCantidadPasajeros(valor) {
    setForm((f) => ({ ...f, cantidad_pasajeros: valor }))
    setErrores((e) => ({ ...e, cantidad: undefined }))
  }

  function cambiarCantidadEquipaje(valor) {
    setCantidadEquipaje(valor)
    const nuevaCantidad = Number(valor)
    if (Number.isSafeInteger(nuevaCantidad) && nuevaCantidad > 0 && nuevaCantidad <= MAX_UNIDADES_EQUIPAJE) {
      setTamanosEquipaje((actuales) => Array.from({ length: nuevaCantidad }, (_, indice) => actuales[indice] ?? ''))
    }
    setErrores((e) => ({ ...e, cantidad_equipaje: undefined }))
  }

  function cambiarTamanoEquipaje(indice, valor) {
    setTamanosEquipaje((actuales) => actuales.map((tamano, i) => (i === indice ? valor : tamano)))
    setErrores((e) => ({ ...e, [`tamano_equipaje_${indice}`]: undefined }))
  }

  // Comprueba que la calle y la altura existan en la localidad de esa parada. Devuelve el resultado, o null si todavia no hay datos suficientes.
  async function verificar(prefijo, valores = form) {
    const calle = valores[`${prefijo}_calle`].trim()
    const altura = valores[`${prefijo}_altura`].trim()
    if (calle.length < 2 || !altura) return null
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
  const num = (campo) => (e) => {
    if (!SOLO_NUMEROS.test(e.target.value)) return
    if (campo === 'cantidad_pasajeros') cambiarCantidadPasajeros(e.target.value)
    else cambiar(campo, e.target.value)
  }
  const txt = (campo) => (e) => cambiar(campo, e.target.value)

  const libres = tramo?.estado === 'ok' ? tramo.cupos_disponibles_tramo : (viaje.cupos_disponibles ?? 0)
  const cantidad = Number(form.cantidad_pasajeros) || 0
  // Total a pagar: el precio por persona lo calcula el sistema; con varios pasajeros se multiplica.
  const viajeCompleto = loc.origen === viaje.origen && loc.destino === viaje.destino
  const precioPersona = tramo?.estado === 'ok' ? tramo.precio_persona : (viajeCompleto && tramo?.estado !== 'invalido' ? viaje.precio_pasajero : null)
  const claveMinimo = TAMANO_A_MINIMO[form.tamano]
  const minimoEncomienda = claveMinimo && tramo?.estado === 'ok'
    ? Number(tramo.minimos_encomienda?.[claveMinimo] ?? 0)
    : null
  const monto = precioPersona == null || (!esPasajero && minimoEncomienda === null)
    ? null
    : Math.round((Number(precioPersona) * (esPasajero ? Math.max(cantidad, 1) : 1) + (esPasajero ? 0 : minimoEncomienda)) * 100) / 100
  const tramoInvalido = tramo?.estado === 'invalido'
  const direccionResumen = (prefijo) => {
    const calle = form[`${prefijo}_calle`].trim()
    const altura = form[`${prefijo}_altura`].trim()
    const localidad = String(loc[prefijo] ?? '').trim()
    const codigoPostal = form[`${prefijo}_codigo_postal`].trim()
    const calleAltura = [calle, altura].filter(Boolean).join(' ')
    return [calleAltura, localidad, codigoPostal ? `CP ${codigoPostal}` : ''].filter(Boolean).join(', ') || '—'
  }

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
    if (esPasajero) {
      req('nombre', 'Ingresá tu nombre'); req('apellido', 'Ingresá tu apellido')
      if (!/^\d{7,8}$/.test(form.dni.trim())) e.dni = 'El DNI debe tener 7 u 8 dígitos'
      req('telefono', 'Ingresá tu número de celular')
      if (!Number.isInteger(cantidad) || cantidad < 1) e.cantidad = 'Indicá cuántos pasajeros son (mínimo 1)'
      else if (cantidad > 20) e.cantidad = 'La solicitud admite hasta 20 pasajeros'
      else if (cantidad > libres) e.cantidad = `Solo quedan ${libres} lugar${libres === 1 ? '' : 'es'} en este viaje`
      if (llevaEquipaje === null) e.lleva_equipaje = 'Indicá si llevás valija o bolso'
      if (llevaEquipaje) {
        const totalEquipaje = Number(cantidadEquipaje)
        if (!Number.isSafeInteger(totalEquipaje) || totalEquipaje < 1) {
          e.cantidad_equipaje = 'Indicá al menos 1 unidad de equipaje'
        } else if (totalEquipaje > MAX_UNIDADES_EQUIPAJE) {
          e.cantidad_equipaje = `Podés agregar hasta ${MAX_UNIDADES_EQUIPAJE} unidades de equipaje`
        } else {
          tamanosEquipaje.slice(0, totalEquipaje).forEach((tamano, indice) => {
            if (!tamano) e[`tamano_equipaje_${indice}`] = `Elegí el tamaño del equipaje ${indice + 1}`
          })
        }
      }
    } else {
      if (!form.tipo_contenido) e.tipo_contenido = 'Elegí el tipo de contenido'
      else if (form.tipo_contenido === 'otro' && form.contenido_descripcion.trim().length < 3) e.contenido_descripcion = 'Aclará qué contiene el paquete'
      if (!form.tamano) e.tamano = 'Elegí el tamaño del paquete'
      if (fragil === null) e.fragil = 'Indicá si el paquete es frágil'
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
      const payload = {
        viaje_id: Number(viaje.viaje_id), tipo,
        origen_localidad: loc.origen, destino_localidad: loc.destino,
        origen_calle: form.origen_calle, origen_altura: form.origen_altura, origen_codigo_postal: form.origen_codigo_postal, origen_descripcion: form.origen_descripcion,
        destino_calle: form.destino_calle, destino_altura: form.destino_altura, destino_codigo_postal: form.destino_codigo_postal,
        forma_pago: form.forma_pago,
        ...(esPasajero
          ? {
              nombre: form.nombre, apellido: form.apellido, dni: form.dni, telefono: form.telefono,
              lleva_equipaje: llevaEquipaje,
              equipaje_detalle: llevaEquipaje ? detalleEquipaje(tamanosEquipaje.slice(0, Number(cantidadEquipaje))) : null,
              cantidad_pasajeros: cantidad,
            }
          : { tipo_contenido: form.tipo_contenido, contenido_descripcion: form.tipo_contenido === 'otro' ? form.contenido_descripcion : '', tamano: form.tamano, fragil,
              emisor_nombre: form.emisor_nombre, emisor_apellido: form.emisor_apellido, emisor_telefono: form.emisor_telefono,
              receptor_nombre: form.receptor_nombre, receptor_apellido: form.receptor_apellido, receptor_telefono: form.receptor_telefono }),
      }
      const creada = await api.post('/solicitudes', payload)
      setEnviada({
        cantidad,
        monto: creada?.monto ?? null,
        distanciaKm: creada?.distancia_km ?? null,
        desde: direccionResumen('origen'),
        hasta: direccionResumen('destino'),
      })
      onEnviada?.()
    } catch (err) {
      setErrorGeneral({ tipo: /ya tenés|quedan|cupos|inici|programad/i.test(err.message) ? 'aviso' : 'error', titulo: 'No se pudo enviar la solicitud', texto: err.message })
    } finally {
      setGuardando(false)
    }
  }

  const cabecera = (
    <div className="card-cabecera solicitud-columna-cabecera">
      <span className="solicitud-columna-icono"><Icon nombre={esPasajero ? 'seat' : 'package'} tamano={20} /></span>
      <div>
        <h2>{esPasajero ? 'Viajar como pasajero' : 'Enviar una encomienda'}</h2>
        <p>{esPasajero ? 'Pedí tu lugar en este viaje. Tus lugares quedan confirmados cuando el comisionista acepta.' : 'El comisionista retira tu paquete y lo entrega en destino.'}</p>
      </div>
    </div>
  )

  if (enviada) {
    return (
      <div className="card solicitud-columna">
        {cabecera}
        <div className="card-cuerpo solicitud-enviada">
          <span className="icono-caja"><Icon nombre="checkcircle" tamano={24} /></span>
          <h3>Solicitud enviada</h3>
          <p>{esPasajero ? 'Tus lugares quedan confirmados recién cuando el comisionista la acepte.' : 'Te va a avisar si acepta llevar tu encomienda.'}</p>
          <div className="exito-detalle">
            <div className="resumen-fila"><span>{esPasajero ? 'Subís en' : 'Se retira en'}</span><strong>{enviada.desde}</strong></div>
            <div className="resumen-fila"><span>{esPasajero ? 'Bajás en' : 'Se entrega en'}</span><strong>{enviada.hasta}</strong></div>
            <div className="resumen-fila"><span>Distancia del tramo</span><strong>{formatoKm(enviada.distanciaKm)}</strong></div>
            {esPasajero && <div className="resumen-fila"><span>Pasajeros</span><strong>{enviada.cantidad}</strong></div>}
            <div className="resumen-fila"><span>Monto</span><strong>{enviada.monto == null ? 'A convenir con el comisionista' : formatoPesos(enviada.monto)}</strong></div>
            <div className="resumen-fila"><span>Estado</span><span className="badge punto ambar">Pendiente</span></div>
          </div>
        </div>
      </div>
    )
  }

  if (bloqueo) {
    return (
      <div className="card solicitud-columna">
        {cabecera}
        <div className="card-cuerpo"><Alerta tipo="aviso" titulo={esPasajero ? 'No podés pedir lugar como pasajero' : 'No podés enviar otra encomienda'}>{bloqueo}</Alerta></div>
      </div>
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
        <div className="localidad-fija"><Icon nombre="pin" tamano={16} /><strong>{loc[prefijo]}</strong></div>
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
    <form className="card solicitud-columna" onSubmit={enviar} noValidate>
      {cabecera}
      <div className="card-cuerpo">
        {errorGeneral && <Alerta tipo={errorGeneral.tipo} titulo={errorGeneral.titulo}>{errorGeneral.texto}</Alerta>}

        {esPasajero ? (
          <>
            <div className="seccion">
              <p className="seccion-titulo">Tus datos</p>
              {!perfil && errorPerfil && <Alerta tipo="aviso" titulo="No pudimos cargar tus datos automáticamente">Completá los campos manualmente. También podés revisar tu conexión e intentarlo de nuevo.</Alerta>}
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
                    <button type="button" aria-label="Quitar un pasajero" onClick={() => cambiarCantidadPasajeros(String(Math.max(1, cantidad - 1)))}><Icon nombre="minus" tamano={14} /></button>
                    <button type="button" aria-label="Agregar un pasajero" onClick={() => cambiarCantidadPasajeros(String(Math.min(libres, cantidad + 1)))}><Icon nombre="plus" tamano={14} /></button>
                  </span>
                </Campo>
              </div>
              <div className="campo">
                <label>¿Llevas valija o bolso?<span className="req">*</span></label>
                <div className="segmentado equipaje-respuesta" role="radiogroup" aria-label="¿Llevas valija o bolso?">
                  <button type="button" role="radio" aria-checked={llevaEquipaje === true} className={llevaEquipaje === true ? 'activo' : ''} onClick={() => { setLlevaEquipaje(true); setErrores((e) => ({ ...e, lleva_equipaje: undefined })) }}>Sí</button>
                  <button type="button" role="radio" aria-checked={llevaEquipaje === false} className={llevaEquipaje === false ? 'activo' : ''} onClick={() => { setLlevaEquipaje(false); setErrores((e) => ({ ...e, lleva_equipaje: undefined })) }}>No</button>
                </div>
                {errores.lleva_equipaje && <p className="campo-error"><Icon nombre="alert" tamano={16} />{errores.lleva_equipaje}</p>}
              </div>
              {llevaEquipaje && (
                <>
                  <div className="equipaje-cantidad">
                    <Campo label="Cantidad" requerido icono="package" error={errores.cantidad_equipaje} ayuda={`Hasta ${MAX_UNIDADES_EQUIPAJE} unidades.`}>
                      <input
                        type="number"
                        inputMode="numeric"
                        min="1"
                        max={MAX_UNIDADES_EQUIPAJE}
                        step="1"
                        value={cantidadEquipaje}
                        onChange={(e) => cambiarCantidadEquipaje(e.target.value)}
                      />
                    </Campo>
                  </div>
                  <div className="equipaje-tamanos-lista">
                    {Array.from({ length: Math.min(Math.max(Number(cantidadEquipaje) || 0, 0), MAX_UNIDADES_EQUIPAJE) }, (_, indice) => (
                      <SelectorDesplegable
                        key={indice}
                        id={`tamano-equipaje-${indice + 1}`}
                        label={`Equipaje ${indice + 1}`}
                        value={tamanosEquipaje[indice] ?? ''}
                        placeholder="Seleccioná un tamaño"
                        options={OPCIONES_TAMANO_EQUIPAJE}
                        onChange={(value) => cambiarTamanoEquipaje(indice, value)}
                        error={errores[`tamano_equipaje_${indice}`]}
                      />
                    ))}
                  </div>
                </>
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
              <div className="solicitud-paquete-tamano">
                <SelectorDesplegable
                  id="tamano-paquete"
                  label="Tamaño"
                  value={form.tamano}
                  placeholder="Seleccioná un tamaño"
                  options={[
                    { value: 'pequeno', label: 'Chico: hasta 30 a 40 cm' },
                    { value: 'mediano', label: 'Mediano: 40 x 30 x 30 cm' },
                    { value: 'grande', label: 'Grande: mayor a 40 x 30 x 30 cm' },
                  ]}
                  onChange={(value) => cambiar('tamano', value)}
                  error={errores.tamano}
                />
                {form.tamano && <ReferenciaTamano tamano={form.tamano} />}
              </div>
              <div className="grilla-2" style={{ marginTop: 16 }}>
                <SelectorDesplegable
                  id="tipo-contenido-paquete"
                  label="Tipo de contenido"
                  value={form.tipo_contenido}
                  placeholder="Seleccioná un tipo"
                  options={TIPOS_CONTENIDO.map(([value, label]) => ({ value, label }))}
                  onChange={(value) => cambiar('tipo_contenido', value)}
                  error={errores.tipo_contenido}
                />
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

        <div className="seccion solicitud-precio">
          <p className="seccion-titulo">Precio</p>
          <div className="resumen-fila"><span>{esPasajero ? 'Subís en' : 'Se retira en'}</span><strong>{direccionResumen('origen')}</strong></div>
          <div className="resumen-fila"><span>{esPasajero ? 'Bajás en' : 'Se entrega en'}</span><strong>{direccionResumen('destino')}</strong></div>
          <div className="resumen-fila"><span>Distancia del tramo</span><strong>{formatoKm(tramo?.estado === 'ok' ? tramo.distancia_km : null)}</strong></div>
          <div className="precio-total"><span>Total a pagar</span><strong>{monto == null ? '—' : formatoPesos(monto)}</strong></div>
          {monto == null && !tramoInvalido && tramo?.estado !== 'cargando' && <p className="nota-resumen" style={{ marginTop: 12 }}>El monto se acuerda con el comisionista.</p>}
          {!tramoInvalido && !viajeCompleto && monto != null && <p className="nota-resumen" style={{ marginTop: 12 }}>Pagás solo el tramo que recorrés, no el viaje completo.</p>}
          {esPasajero && cantidad > 0 && cantidad <= libres && (
            <p className="nota-resumen">Si el comisionista acepta, este tramo pasa a <strong>{(tramo?.ocupados_tramo ?? viaje.ocupados) + cantidad} / {viaje.cupo_total}</strong>.</p>
          )}
          {tramoInvalido && <p className="verif error paradas-aviso"><Icon nombre="alert" tamano={16} />{tramo.mensaje}</p>}
          {tramo?.estado === 'no_disponible' && <p className="verif aviso paradas-aviso"><Icon nombre="alert" tamano={16} />No pudimos calcular el tramo ahora. {tramo.mensaje ?? 'Probá de nuevo en unos minutos.'}</p>}
        </div>
      </div>
      <div className="card-pie">
        <button type="submit" className="btn btn-primario" disabled={guardando || tramoInvalido || (esPasajero && libres === 0)}>
          <Icon nombre="checkcircle" tamano={16} /> {guardando ? 'Enviando...' : esPasajero ? 'Solicitar lugar' : 'Enviar encomienda'}
        </button>
      </div>
    </form>
  )
}

export default function SolicitarViaje() {
  const { id } = useParams()
  const [parametros] = useSearchParams()
  const navegar = useNavigate()
  const [viaje, setViaje] = useState(null)
  const [perfil, setPerfil] = useState(null)
  const [errorPerfil, setErrorPerfil] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState(null)
  const [enviadas, setEnviadas] = useState(0)
  const [tipoActivo, setTipoActivo] = useState('encomienda')
  // Tramo elegido en la lista (para el mapa y los cupos del encabezado).
  const [tramo, setTramo] = useState(null)
  // Paradas ya confirmadas de otros pasajeros/encomiendas del viaje (solo localidades).
  const [otrasParadas, setOtrasParadas] = useState([])
  const pinesOtras = useMemo(() => otrasParadas.flatMap((p) => p.acciones.map((a) => ({
    lat: p.lat, lon: p.lon, accion: a, estado: 'aceptada', texto: `${p.localidad}: ${TEXTO_ACCION[a]}`,
  }))), [otrasParadas])

  useEffect(() => {
    const cargarPerfil = api.get('/auth/perfil')
      .then((p) => ({ perfil: p, error: null }))
      .catch(() => ({ perfil: null, error: true }))
    Promise.all([api.get(`/solicitudes/viajes-disponibles/${id}`), cargarPerfil])
      .then(([v, resultadoPerfil]) => {
        setViaje(v)
        setPerfil(resultadoPerfil.perfil)
        setErrorPerfil(resultadoPerfil.error)
      })
      .catch((err) => setErrorCarga(err.message))
      .finally(() => setCargando(false))
    api.get(`/solicitudes/viajes-disponibles/${id}/paradas`).then((r) => setOtrasParadas(r.paradas ?? [])).catch(() => setOtrasParadas([]))
  }, [id])

  const locInicial = useMemo(() => ({
    origen: parametros.get('desde') || viaje?.origen || '',
    destino: parametros.get('hasta') || viaje?.destino || '',
  }), [parametros, viaje])

  useEffect(() => {
    if (!viaje || !locInicial.origen || !locInicial.destino) return undefined
    let vigente = true
    api.get(`/solicitudes/viajes-disponibles/${viaje.viaje_id}/tramo?${new URLSearchParams({ desde: locInicial.origen, hasta: locInicial.destino })}`)
      .then((r) => { if (vigente) setTramo(r) })
      .catch(() => { if (vigente) setTramo(null) })
    return () => { vigente = false }
  }, [viaje, locInicial])

  const migas = (
    <nav className="migas" aria-label="Ruta">
      <button type="button" onClick={() => navegar('/mis-traslados')}>Viajes</button>
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
        <button type="button" className="btn" onClick={() => navegar('/mis-traslados')}>Volver a Viajes</button>
      </section>
    )
  }

  // Un mismo viaje admite una solicitud de pasajero y otra de encomienda; mientras la anterior de un tipo
  // siga vigente (pendiente o aceptada) no se puede repetir. Si se canceló o se rechazó, se puede volver a pedir.
  const yaPasajero = (viaje.mis_solicitudes ?? []).some((s) => s.tipo === 'pasajero')
  const yaEncomienda = (viaje.mis_solicitudes ?? []).some((s) => s.tipo === 'encomienda')
  const bloqueoPasajero = yaPasajero
    ? 'Ya solicitaste viajar como pasajero en este viaje. Para volver a hacerlo, cancelá antes esa solicitud en Solicitudes.'
    : viaje.cupos_disponibles === 0 ? 'Este viaje ya no tiene lugares para pasajeros, pero podés enviar una encomienda.' : null
  const bloqueoEncomienda = yaEncomienda
    ? 'Ya solicitaste enviar una encomienda en este viaje. Para volver a hacerlo, cancelá antes esa solicitud en Solicitudes.'
    : null

  const horaLocalidad = (localidad) => localidad === viaje.origen ? viaje.hora_salida
    : localidad === viaje.destino ? viaje.hora_llegada
      : viaje.paradas?.find((p) => p.localidad === localidad)?.hora_estimada
  const recorrido = `${locInicial.origen} → ${locInicial.destino}`
  const horaTramoSalida = horaLocalidad(locInicial.origen) ?? viaje.hora_salida
  const horaTramoLlegada = horaLocalidad(locInicial.destino) ?? viaje.hora_llegada
  const minutosTramo = horaTramoSalida && horaTramoLlegada ? (aMinutos(horaTramoLlegada) - aMinutos(horaTramoSalida) + 1440) % 1440 : viaje.duracion_min
  const salida = `${formatoFecha(`${viaje.fecha}T12:00:00`)} · ${horaTramoSalida?.slice(0, 5) ?? '—'}`
  const ocupados = tramo?.estado === 'ok' ? tramo.ocupados_tramo : viaje.ocupados

  return (
    <section>
      {migas}

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-cabecera"><h2>Viaje {codigoViaje(viaje.viaje_id)}</h2></div>
        <div className="card-cuerpo detalle-solicitud">
          <div className="viaje-detalle">
            <div className="resumen-fila"><span>Recorrido elegido</span><strong>{recorrido}</strong></div>
            {(locInicial.origen !== viaje.origen || locInicial.destino !== viaje.destino) && <div className="resumen-fila"><span>Viaje completo</span><strong>{viaje.origen} → {viaje.destino}</strong></div>}
            <div className="resumen-fila"><span>Salida</span><strong>{salida}</strong></div>
            <div className="resumen-fila"><span>Llegada estimada</span><strong>{horaTramoLlegada?.slice(0, 5) ?? '—'}</strong></div>
            <div className="resumen-fila"><span>Duración</span><strong>{formatoDuracion(minutosTramo > 0 ? minutosTramo : viaje.duracion_min)}</strong></div>
            <div className="resumen-fila"><span>Comisionista</span><strong>{`${viaje.comisionista_nombre} ${viaje.comisionista_apellido ?? ''}`.trim()}</strong></div>
            <div className="resumen-fila"><span>Cupos en este tramo</span><strong>{ocupados} / {viaje.cupo_total}</strong></div>
            <div className="cupo-barra" aria-hidden="true"><span style={{ width: `${Math.min(100, (ocupados / Math.max(viaje.cupo_total, 1)) * 100)}%` }} /></div>
          </div>
          <div>
            <MapaRuta origen={viaje.origen} destino={viaje.destino} paradasRecorrido={viaje.paradas ?? []} alto={300} mostrarKm={false} tramo={tramo?.estado === 'ok' && !tramo.completo ? tramo : null} paradas={pinesOtras} />
            {otrasParadas.length > 0 && (
              <div className="paradas-cliente">
                <b>Este viaje ya tiene paradas confirmadas</b>
                <ul>{otrasParadas.map((p) => <li key={p.localidad}>{p.localidad}: {p.acciones.map((a) => TEXTO_ACCION[a]).join(' y ')}</li>)}</ul>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="solicitud-tipo-selector" role="tablist" aria-label="Tipo de solicitud">
        {[
          { value: 'encomienda', label: 'Enviar una encomienda' },
          { value: 'pasajero', label: 'Viajar como pasajero' },
        ].map((tipo) => (
          <button
            key={tipo.value}
            type="button"
            role="tab"
            aria-selected={tipoActivo === tipo.value}
            className={tipoActivo === tipo.value ? 'activo' : ''}
            onClick={() => setTipoActivo(tipo.value)}
          >
            {tipo.label}
          </button>
        ))}
      </div>

      <div className="solicitud-columnas">
        {tipoActivo === 'encomienda' ? (
          <FormularioSolicitud tipo="encomienda" viaje={viaje} locInicial={locInicial} perfil={perfil} bloqueo={bloqueoEncomienda} onEnviada={() => setEnviadas((n) => n + 1)} />
        ) : (
          <FormularioSolicitud tipo="pasajero" viaje={viaje} locInicial={locInicial} perfil={perfil} errorPerfil={errorPerfil} bloqueo={bloqueoPasajero} onEnviada={() => setEnviadas((n) => n + 1)} />
        )}
      </div>

      <div className="solicitud-pie">
        <button type="button" className="btn" onClick={() => navegar('/mis-traslados')}>Volver a Viajes</button>
        {enviadas > 0 && <button type="button" className="btn btn-primario" onClick={() => navegar('/mis-traslados', { state: { pestana: 'solicitudes' } })}>Ver mis solicitudes <Icon nombre="arrow" tamano={16} /></button>}
      </div>
    </section>
  )
}
