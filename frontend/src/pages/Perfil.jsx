import { useEffect, useState, useCallback } from 'react'
import { api, guardarSesion, cerrarSesion } from '../api/client.js'
import Avatar from '../components/Avatar.jsx'
import Icon from '../components/Icon.jsx'
import { Campo, CampoPassword, Alerta, Toast, Modal, formatoFecha } from '../components/ui.jsx'
import { prepararFotoPerfil, ACEPTA_FOTOS } from '../utils/imagen.js'

const formularioInicial = {
  nombre: '', apellido: '', email: '', password: '', confirmarPassword: '',
  dni: '', telefono: '', presentacion: '', foto_perfil: '',
}

const MAX_PRESENTACION = 500

// El backend devuelve null en los campos vacios; los inputs controlados necesitan texto.
function aFormulario(datos) {
  return {
    ...formularioInicial,
    ...Object.fromEntries(Object.entries(datos).map(([k, v]) => [k, v ?? ''])),
    password: '', confirmarPassword: '',
  }
}

function mensajeDeError(error, fallback) {
  return error?.message || fallback
}

export default function Perfil({ onCuentaDadaDeBaja }) {
  const [form, setForm] = useState(formularioInicial)
  const [perfil, setPerfil] = useState(null)
  const [errorGeneral, setErrorGeneral] = useState('')
  const [errores, setErrores] = useState({})
  const [toast, setToast] = useState(false)
  const [editando, setEditando] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [fotoModificada, setFotoModificada] = useState(false)
  const [procesandoFoto, setProcesandoFoto] = useState(false)
  const [confirmandoBaja, setConfirmandoBaja] = useState(false)
  const [entiendo, setEntiendo] = useState(false)
  const esComisionista = perfil?.rol === 'comisionista'
  const cerrarToast = useCallback(() => setToast(false), [])

  useEffect(() => {
    async function cargarPerfil() {
      try {
        const datos = await api.get('/auth/perfil')
        setPerfil(datos)
        setForm(aFormulario(datos))
      } catch (error) {
        setErrorGeneral(mensajeDeError(error, 'No se pudo cargar tu perfil.'))
      } finally {
        setCargando(false)
      }
    }

    cargarPerfil()
  }, [])

  function handleChange(event) {
    const { name, value } = event.target
    setForm((actual) => ({ ...actual, [name]: value }))
    setErrores((e) => ({ ...e, [name]: undefined }))
  }

  function validarFormulario() {
    const e = {}
    if (!form.nombre.trim() || form.nombre.trim().length > 120) e.nombre = 'El nombre es obligatorio'
    if (form.password && form.password.length < 6) e.password = 'La nueva contraseña debe tener al menos 6 caracteres'
    if (form.password !== form.confirmarPassword) e.confirmarPassword = 'Las contraseñas no coinciden'
    if (form.presentacion.length > MAX_PRESENTACION) e.presentacion = `La presentación no puede superar los ${MAX_PRESENTACION} caracteres`
    if (perfil?.rol === 'cliente' || esComisionista) {
      if (!/^\d{7,8}$/.test(form.dni.replace(/\D/g, ''))) e.dni = 'El DNI debe tener 7 u 8 dígitos'
      if (!form.telefono.trim()) e.telefono = 'Ingresa un número de teléfono válido'
    }
    return e
  }

  async function guardarCambios(event) {
    event.preventDefault()
    const encontrados = validarFormulario()
    if (Object.keys(encontrados).length > 0) {
      setErrores(encontrados)
      setErrorGeneral('Revisa los campos marcados en rojo y vuelve a intentarlo.')
      return
    }

    setErrorGeneral('')
    setCargando(true)
    try {
      const { confirmarPassword, ...datosAEnviar } = form
      datosAEnviar.dni = datosAEnviar.dni.replace(/\D/g, '')
      // La presentacion y la foto son solo del comisionista. La foto solo se reenvia si la
      // cambió (o la quitó), para no subir de nuevo la misma imagen en cada guardado.
      if (!esComisionista) {
        delete datosAEnviar.presentacion
        delete datosAEnviar.foto_perfil
      } else if (!fotoModificada) {
        delete datosAEnviar.foto_perfil
      }
      const respuesta = await api.put('/auth/perfil', datosAEnviar)
      guardarSesion(respuesta)
      setPerfil(respuesta.usuario)
      setForm(aFormulario(respuesta.usuario))
      setErrores({})
      setFotoModificada(false)
      setEditando(false)
      setToast(true)
    } catch (error) {
      setErrorGeneral(mensajeDeError(error, 'No se pudo actualizar tu perfil.'))
    } finally {
      setCargando(false)
    }
  }

  async function elegirFoto(event) {
    const archivo = event.target.files?.[0]
    event.target.value = '' // permite volver a elegir el mismo archivo
    if (!archivo) return

    setErrorGeneral('')
    setProcesandoFoto(true)
    try {
      const foto = await prepararFotoPerfil(archivo)
      setForm((actual) => ({ ...actual, foto_perfil: foto }))
      setFotoModificada(true)
    } catch (error) {
      setErrorGeneral(mensajeDeError(error, 'No se pudo cargar la foto.'))
    } finally {
      setProcesandoFoto(false)
    }
  }

  function quitarFoto() {
    setForm((actual) => ({ ...actual, foto_perfil: '' }))
    setFotoModificada(true)
  }

  function cancelarEdicion() {
    setForm(aFormulario(perfil))
    setErrores({})
    setErrorGeneral('')
    setFotoModificada(false)
    setEditando(false)
  }

  function cerrarModalBaja() {
    setConfirmandoBaja(false)
    setEntiendo(false)
  }

  // US11: dar de baja la propia cuenta.
  async function darDeBaja() {
    try {
      await api.del('/auth/perfil')
      cerrarSesion()
      onCuentaDadaDeBaja?.()
    } catch (error) {
      cerrarModalBaja()
      setErrorGeneral(mensajeDeError(error, 'No se pudo dar de baja tu cuenta.'))
    }
  }

  if (cargando && !perfil) return <p className="campo-ayuda">Cargando perfil...</p>

  const esCliente = perfil?.rol === 'cliente'
  const tieneContacto = esCliente || esComisionista // ambos roles dejan DNI y teléfono
  const etiquetaRol = esComisionista ? 'Comisionista' : 'Cliente'

  // ---------- Edicion ----------
  if (editando && perfil) {
    return (
      <section>
        <nav className="migas" aria-label="Ruta">
          <button type="button" onClick={cancelarEdicion}>Mi perfil</button>
          <Icon nombre="right" tamano={14} />
          <strong>Editar información</strong>
        </nav>

        {errorGeneral && <Alerta tipo="error" titulo="No se pudieron guardar los cambios">{errorGeneral}</Alerta>}

        <form className="card" onSubmit={guardarCambios} noValidate>
          <div className="card-cabecera">
            <div>
              <h2>Editar información personal</h2>
              <p>Actualiza tus datos. Los campos con <span style={{ color: 'var(--rojo)' }}>*</span> son obligatorios.</p>
            </div>
          </div>
          <div className="card-cuerpo">
            {esComisionista && (
              <div className="seccion">
                <div className="foto-editor">
                  <Avatar foto={form.foto_perfil} nombre={form.nombre} apellido={form.apellido} />
                  <div className="foto-acciones">
                    <label className="btn btn-chico">
                      <Icon nombre="upload" tamano={16} />
                      {procesandoFoto ? 'Procesando...' : form.foto_perfil ? 'Cambiar foto' : 'Elegir foto'}
                      <input type="file" accept={ACEPTA_FOTOS} onChange={elegirFoto} disabled={procesandoFoto || cargando} hidden />
                    </label>
                    {form.foto_perfil && (
                      <button type="button" className="btn btn-chico" onClick={quitarFoto} disabled={cargando}>Quitar foto</button>
                    )}
                    <span className="campo-ayuda">JPG, PNG o WebP. Se recorta en cuadrado y se achica sola.</span>
                  </div>
                </div>
              </div>
            )}

            <div className="seccion">
              <div className="grilla-2">
                <Campo label="Nombre" requerido error={errores.nombre}>
                  <input name="nombre" value={form.nombre} onChange={handleChange} maxLength="120" placeholder="Tu nombre" />
                </Campo>
                <Campo label="Apellido" requerido error={errores.apellido}>
                  <input name="apellido" value={form.apellido} onChange={handleChange} maxLength="120" placeholder="Tu apellido" />
                </Campo>
                <Campo label="Correo electrónico" icono="lock" soloLectura ayuda="El correo es tu usuario de acceso y no puede modificarse.">
                  <input name="email" type="email" value={form.email} readOnly />
                </Campo>
                {tieneContacto && (
                  <Campo label="Teléfono" requerido icono="phone" error={errores.telefono}>
                    <input name="telefono" value={form.telefono} onChange={handleChange} placeholder="+54 351 456-7890" />
                  </Campo>
                )}
                {tieneContacto && (
                  <Campo label="DNI" requerido icono="idcard" error={errores.dni}>
                    <input name="dni" value={form.dni} onChange={handleChange} inputMode="numeric" placeholder="30.456.789" />
                  </Campo>
                )}
              </div>
            </div>

            {esComisionista && (
              <div className="seccion">
                <p className="seccion-titulo">Presentación</p>
                <div className="campo">
                  <label>Presentación <span className="opcional">(opcional, la va a ver el cliente)</span></label>
                  <textarea
                    className="area"
                    name="presentacion"
                    value={form.presentacion}
                    onChange={handleChange}
                    maxLength={MAX_PRESENTACION}
                    rows="4"
                    placeholder="Contá quién sos, qué recorridos hacés, cuánta experiencia tenés..."
                  />
                  <span className="contador">{form.presentacion.length}/{MAX_PRESENTACION}</span>
                  {errores.presentacion && <p className="campo-error"><Icon nombre="alert" tamano={16} />{errores.presentacion}</p>}
                </div>
              </div>
            )}

            <div className="seccion">
              <p className="seccion-titulo">Cambiar contraseña (opcional)</p>
              <div className="grilla-2">
                <CampoPassword label="Nueva contraseña" name="password" value={form.password} onChange={handleChange} autoComplete="new-password" placeholder="Mínimo 6 caracteres" error={errores.password} />
                <CampoPassword label="Repetir contraseña" name="confirmarPassword" value={form.confirmarPassword} onChange={handleChange} autoComplete="new-password" placeholder="Repite la contraseña" error={errores.confirmarPassword} />
              </div>
            </div>
          </div>
          <div className="card-pie">
            <button type="button" className="btn" onClick={cancelarEdicion} disabled={cargando}>Cancelar</button>
            <button type="submit" className="btn btn-primario" disabled={cargando}>
              <Icon nombre="checkcircle" tamano={16} /> {cargando ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </section>
    )
  }

  // ---------- Vista ----------
  return (
    <section>
      {toast && <Toast titulo="Datos actualizados" texto="Los cambios se guardaron correctamente." onClose={cerrarToast} />}
      {errorGeneral && <Alerta tipo="error" titulo="Ocurrió un problema">{errorGeneral}</Alerta>}

      {perfil && (
        <>
          <div className="perfil-grilla">
            <aside className="card perfil-lateral">
              <Avatar foto={perfil.foto_perfil} nombre={perfil.nombre} apellido={perfil.apellido ?? ''} tamano={136} />
              <h2>{perfil.nombre} {perfil.apellido || ''}</h2>
              <p className="correo">{perfil.email}</p>
              <div className="badges">
                <span className="badge">{etiquetaRol}</span>
                <span className="badge punto verde">Activo</span>
              </div>
              {esComisionista && (
                <p className="perfil-presentacion">
                  {perfil.presentacion || 'Todavía no cargaste una presentación. Editá tu perfil para contarle a tus clientes quién sos.'}
                </p>
              )}
              <div className="miembro">
                <span>Miembro desde</span>
                <strong>{formatoFecha(perfil.creado_en)}</strong>
              </div>
            </aside>

            <div className="card">
              <div className="card-cabecera">
                <div>
                  <h2>Información personal</h2>
                  <p>Datos registrados en tu cuenta</p>
                </div>
                <button type="button" className="btn" onClick={() => setEditando(true)}>
                  <Icon nombre="pencil" tamano={16} /> Editar perfil
                </button>
              </div>
              <div className="datos-grilla">
                <div className="dato"><span><Icon nombre="user" tamano={16} /> Nombre</span><strong>{perfil.nombre}</strong></div>
                <div className="dato"><span><Icon nombre="user" tamano={16} /> Apellido</span><strong>{perfil.apellido || '-'}</strong></div>
                <div className="dato"><span><Icon nombre="mail" tamano={16} /> Correo electrónico</span><strong>{perfil.email}</strong></div>
                {tieneContacto && <div className="dato"><span><Icon nombre="phone" tamano={16} /> Teléfono</span><strong>{perfil.telefono || '-'}</strong></div>}
                {tieneContacto && <div className="dato"><span><Icon nombre="idcard" tamano={16} /> DNI</span><strong>{perfil.dni || '-'}</strong></div>}
              </div>
              {esComisionista && (!perfil.dni || !perfil.telefono) && (
                <div className="card-cuerpo">
                  <Alerta tipo="aviso" titulo="Faltan datos de contacto">Completá tu DNI y tu teléfono: ahora son obligatorios. Editá tu perfil para cargarlos.</Alerta>
                </div>
              )}
            </div>
          </div>

          <div className="baja-card">
            <div>
              <h3>Dar de baja mi usuario</h3>
              <p>
                Se cerrará tu sesión y se eliminará la información histórica asociada
                {esComisionista ? ' (viajes, ingresos y gastos)' : ' (traslados y encomiendas)'}. Esta acción no se puede deshacer.
              </p>
            </div>
            <button type="button" className="btn btn-peligro" onClick={() => setConfirmandoBaja(true)}>
              <Icon nombre="userx" tamano={16} /> Dar de baja
            </button>
          </div>
        </>
      )}

      {confirmandoBaja && (
        <Modal onClose={cerrarModalBaja}>
          <span className="modal-icono"><Icon nombre="userx" tamano={22} /></span>
          <h2>¿Dar de baja tu usuario?</h2>
          <p>Se cerrará tu sesión y se eliminará la información histórica asociada a tu cuenta. Esta acción no se puede deshacer.</p>
          <label className="check-linea">
            <input type="checkbox" checked={entiendo} onChange={(e) => setEntiendo(e.target.checked)} />
            <span>Entiendo que esta acción es permanente.</span>
          </label>
          <div className="modal-acciones">
            <button type="button" className="btn" onClick={cerrarModalBaja}>Cancelar</button>
            <button type="button" className="btn btn-peligro" disabled={!entiendo} onClick={darDeBaja}>Dar de baja</button>
          </div>
        </Modal>
      )}
    </section>
  )
}
