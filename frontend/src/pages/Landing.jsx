import { useEffect, useState } from 'react'
import { api } from '../api/client.js'
import { Mascota } from '../components/ui.jsx'
import Icon from '../components/Icon.jsx'
import canguroCabecera from '../assets/canguro-cabecera.png'
import canguroPortada from '../assets/canguro-portada.gif'

const opinionesIniciales = [
  { nombre: 'Lucía M.', rol: 'Cliente', texto: 'Pude coordinar el envío de un paquete con más claridad y seguir cada paso desde el mismo lugar.', ejemplo: true },
  { nombre: 'Marcos R.', rol: 'Comisionista', texto: 'Me resulta práctico organizar los viajes y tener los pedidos de encomiendas ordenados.', ejemplo: true },
  { nombre: 'Sofía G.', rol: 'Cliente', texto: 'Encontré una forma sencilla de ponerme en contacto y saber cuándo llegaba mi encomienda.', ejemplo: true },
]

const beneficios = [
  { icono: 'package', titulo: 'Encomiendas en camino', texto: 'Clientes y comisionistas coordinan cada envío y siguen su recorrido en un mismo lugar.' },
  { icono: 'logo', titulo: 'Viajes bajo control', texto: 'Organizá recorridos, horarios y lugares disponibles para pasajeros.' },
  { icono: 'wallet', titulo: 'Todo más claro', texto: 'Reuní envíos, pasajeros y movimientos de tu actividad en un solo lugar.' },
]

export default function Landing({ onIngresar }) {
  // Las opiniones se guardan en la base y solo las publica un usuario con sesión iniciada.
  // Mientras no haya ninguna (o si la API no responde), se muestran las de ejemplo.
  const [opiniones, setOpiniones] = useState(opinionesIniciales)

  useEffect(() => {
    let vigente = true
    api.get('/opiniones')
      .then(({ opiniones: publicadas }) => { if (vigente && publicadas?.length) setOpiniones(publicadas) })
      .catch(() => { /* se quedan las de ejemplo */ })
    return () => { vigente = false }
  }, [])

  return (
    <div className="landing">
      <header className="landing-nav">
        <a className="landing-marca" href="#inicio" aria-label="ComiTrack, inicio">
          <img className="landing-marca-mascota" src={canguroCabecera} alt="" aria-hidden="true" />
          <span>ComiTrack</span>
        </a>
        <nav className="landing-links" aria-label="Navegación principal">
          <a href="#como-funciona">Cómo funciona</a>
          <a href="#comunidad">Comunidad</a>
        </nav>
        <button type="button" className="landing-login" onClick={onIngresar}>
          Ingresar <Icon nombre="arrow" tamano={17} />
        </button>
      </header>

      <main id="inicio">
        <section className="landing-hero">
          <div className="landing-hero-copy">
            <span className="landing-eyebrow"><span /> ENCOMIENDAS Y VIAJES, EN UN SOLO LUGAR</span>
            <h1>Tus encomiendas<br /><em>llegan más lejos.</em></h1>
            <p>Conectá con un comisionista para enviar o recibir paquetes. También encontrá viajes y coordiná traslados de pasajeros desde un mismo lugar.</p>
            <div className="landing-acciones">
              <button type="button" className="landing-cta" onClick={onIngresar}>Empezar ahora <Icon nombre="arrow" tamano={18} /></button>
              <a className="landing-secundario" href="#como-funciona">Conocé ComiTrack <span>↓</span></a>
            </div>
            <div className="landing-confianza"><span className="landing-puntos"><i /><i /><i /></span><span>Un mismo camino para tus paquetes y tus viajes.</span></div>
          </div>

          <div className="landing-escena" aria-label="La mascota canguro de ComiTrack junto a un viaje organizado">
            <div className="landing-orbita orbita-uno" /><div className="landing-orbita orbita-dos" />
            <div className="landing-etiqueta etiqueta-ruta"><span className="landing-mini-icon"><Icon nombre="pin" tamano={17} /></span><span><b>Tu próxima ruta</b><small>Lista para organizar</small></span><i className="landing-pulso" /></div>
            <div className="landing-tarjeta-viaje">
              <div className="landing-tarjeta-top"><span>ENCOMIENDA</span><span className="landing-estado"><i /> EN CAMINO</span></div>
              <div className="landing-ruta"><div className="landing-puntos-ruta"><i /><span /><i /></div><div><b>Retiro</b><strong>Tu ciudad</strong><b>Entrega</b><strong>Tu próximo destino</strong></div><Icon nombre="arrow" tamano={18} /></div>
              <div className="landing-tarjeta-pie"><span><Icon nombre="package" tamano={15} /> Paquete acompañado</span><span><Icon nombre="users" tamano={15} /> En contacto</span></div>
            </div>
            <div className="landing-mascota-fondo"><img className="landing-mascota-imagen" src={canguroPortada} alt="Canguro de ComiTrack llevando un paquete" /></div>
            <div className="landing-burbuja"><span>¡Vamos!</span><i /></div>
            <div className="landing-destello destello-a">✳</div><div className="landing-destello destello-b">✦</div>
          </div>
          <a className="landing-scroll" href="#como-funciona"><span /> Deslizá para descubrir</a>
        </section>

        <section className="landing-cinta" aria-label="Herramientas de ComiTrack">
          <span>PLANIFICÁ</span><i>✳</i><span>CONECTÁ</span><i>✳</i><span>SEGUÍ</span><i>✳</i><span>AVANZÁ</span><i>✳</i><span>PLANIFICÁ</span>
        </section>

        <section className="landing-beneficios" id="como-funciona">
          <div className="landing-seccion-titulo"><span className="landing-eyebrow">TODO EN EL MISMO CAMINO</span><h2>Menos vueltas.<br /><em>Más viaje.</em></h2><p>ComiTrack te ayuda a tener cada parte de la operación a mano, estés organizando un recorrido o buscando cómo llegar.</p></div>
          <div className="landing-beneficios-grid">
            {beneficios.map((beneficio, i) => <article className="landing-beneficio" key={beneficio.titulo}><span className="landing-beneficio-num">0{i + 1}</span><span className="landing-beneficio-icon"><Icon nombre={beneficio.icono} tamano={23} /></span><h3>{beneficio.titulo}</h3><p>{beneficio.texto}</p><span className="landing-beneficio-linea" /></article>)}
          </div>
        </section>

        <section className="landing-comunidad" id="comunidad">
          <div className="landing-comunidad-visual"><div className="landing-mapa-ilustrado" role="img" aria-label="Mapa ilustrado con una ruta de entrega, origen, destino y el canguro de ComiTrack llevando un paquete"><div className="mapa-cuadricula" /><svg className="mapa-calles" viewBox="0 0 520 330" aria-hidden="true"><path d="M-20 70 115 120 205 55 345 95 535 30M-15 245 100 200 215 265 345 205 530 275M55-15 100 90 75 180 145 345M270-20 240 75 300 155 265 240 325 350M440-15 385 75 430 165 385 250 455 350" /><path d="M95 225C135 195 156 205 185 166S240 100 285 125s65 80 110 58 50-47 85-41" className="mapa-ruta-linea" /></svg><span className="mapa-etiqueta mapa-origen"><i /> Retiro</span><span className="mapa-etiqueta mapa-destino"><i /> Entrega</span><div className="mapa-mascota"><Mascota ancho={100} /><span className="mapa-paquete" aria-hidden="true">□</span></div></div></div>
          <div className="landing-comunidad-copy"><span className="landing-eyebrow">HECHO PARA CONECTAR</span><h2>De una ciudad<br />a otra, <em>en camino.</em></h2><p>Clientes y comisionistas coordinan el envío y la entrega de cada encomienda. Y cuando necesitás viajar, también podés encontrar y organizar traslados de pasajeros.</p><div className="landing-opinion"><span><Icon nombre="checkcircle" tamano={19} /></span><div><strong>Paquetes y viajes, más fáciles de coordinar</strong><small>Todo el recorrido y la información de cada solicitud, en un mismo lugar.</small></div></div></div>
        </section>

        <section className="landing-opiniones" aria-labelledby="opiniones-titulo">
          <div className="landing-opiniones-cabecera"><div><span className="landing-eyebrow">VOCES DE LA COMUNIDAD</span><h2 id="opiniones-titulo">¿Cómo te va con <em>ComiTrack?</em></h2><p>Clientes y comisionistas pueden compartir su experiencia y ayudar a mejorar la aplicación.</p></div><span className="landing-opiniones-total">{opiniones.length} opiniones</span></div>
          <div className="landing-opiniones-grid">
            <div className="landing-opiniones-lista">
              {opiniones.map((opinion, indice) => <article className="landing-opinion-card" key={opinion.id ?? `${opinion.nombre}-${indice}`}>
                <div className="landing-opinion-meta"><span className="landing-opinion-avatar">{opinion.nombre.charAt(0).toUpperCase()}</span><div><strong>{opinion.nombre}</strong><small>{opinion.rol}</small></div>{opinion.ejemplo && <span className="landing-opinion-ejemplo">Ejemplo</span>}</div>
                <p>{opinion.texto}</p>
              </article>)}
            </div>
            <div className="landing-opinion-form">
              <h3>Dejá tu opinión</h3>
              <p>Para que las opiniones sean reales, solo pueden publicarlas clientes y comisionistas registrados. Ingresá a tu cuenta y vas a encontrar el formulario en el Inicio.</p>
              <button className="landing-cta" type="button" onClick={onIngresar}>Ingresar para opinar <Icon nombre="arrow" tamano={17} /></button>
            </div>
          </div>
        </section>

        <section className="landing-cierre"><div><span className="landing-eyebrow">EL PRÓXIMO VIAJE EMPIEZA ACÁ</span><h2>¿A dónde vamos?</h2><p>Organizá tu actividad o encontrá el viaje que necesitás.</p></div><button type="button" className="landing-cta landing-cta-claro" onClick={onIngresar}>Ingresar a ComiTrack <Icon nombre="arrow" tamano={18} /></button><div className="landing-cierre-mascota"><Mascota ancho={100} /></div></section>
      </main>

      <footer className="landing-footer">
        <a className="landing-marca landing-marca-footer" href="#inicio"><img className="landing-marca-mascota" src={canguroCabecera} alt="" aria-hidden="true" /><span>ComiTrack</span></a>
        <div className="landing-contacto">
          <strong>Soporte y contacto</strong>
          <a href="mailto:angeldanielprz26@gmail.com">angeldanielprz26@gmail.com</a>
          <a href="tel:3518122196">351 812-2196</a>
        </div>
        <span>Movemos historias, conectamos caminos.</span>
        <a href="#inicio">Volver arriba ↑</a>
      </footer>
    </div>
  )
}
