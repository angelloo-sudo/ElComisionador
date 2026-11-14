// Formulario para dejar una opinión sobre ComiTrack. Solo aparece con la sesión iniciada;
// la opinión se guarda en la base y se muestra en la portada con el nombre abreviado.
import { useState } from 'react'
import { api } from '../api/client.js'
import { Alerta } from './ui.jsx'
import Icon from './Icon.jsx'

const MAXIMO = 400

export default function OpinionForm() {
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [aviso, setAviso] = useState(null)

  async function enviar(evento) {
    evento.preventDefault()
    const limpio = texto.trim()
    if (limpio.length < 5) {
      setAviso({ tipo: 'error', texto: 'Escribí tu opinión (mínimo 5 caracteres).' })
      return
    }
    setEnviando(true)
    setAviso(null)
    try {
      const respuesta = await api.post('/opiniones', { texto: limpio })
      setTexto('')
      setAviso({ tipo: 'exito', texto: respuesta.mensaje })
    } catch (error) {
      setAviso({ tipo: 'error', texto: error.message })
    } finally {
      setEnviando(false)
    }
  }

  return (
    <section className="card opinion-app">
      <div className="card-cabecera">
        <div>
          <h2>¿Cómo te va con ComiTrack?</h2>
          <p>Tu opinión se publica en la página de inicio con tu nombre y la inicial de tu apellido.</p>
        </div>
      </div>
      <form className="card-cuerpo opinion-app-form" onSubmit={enviar}>
        {aviso && <Alerta tipo={aviso.tipo} titulo={aviso.tipo === 'exito' ? 'Opinión publicada' : 'No se pudo publicar'} onCerrar={() => setAviso(null)}>{aviso.texto}</Alerta>}
        <textarea
          className="area"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          maxLength={MAXIMO}
          rows={3}
          placeholder="Contanos qué te resultó útil o qué mejorarías"
          aria-label="Tu opinión"
        />
        <div className="opinion-app-pie">
          <small className="campo-ayuda">{texto.length}/{MAXIMO}</small>
          <button type="submit" className="btn btn-primario" disabled={enviando || texto.trim().length < 5}>
            {enviando ? 'Publicando...' : <>Publicar opinión <Icon nombre="arrow" tamano={16} /></>}
          </button>
        </div>
      </form>
    </section>
  )
}
