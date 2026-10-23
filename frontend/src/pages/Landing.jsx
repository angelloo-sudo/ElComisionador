import { Mascota } from '../components/ui.jsx'
import Icon from '../components/Icon.jsx'

const beneficios = [
  { icono: 'logo', titulo: 'Viajes bajo control', texto: 'Organizá recorridos, horarios y disponibilidad desde un solo lugar.' },
  { icono: 'package', titulo: 'Encomiendas acompañadas', texto: 'Seguí cada pedido y mantené a clientes y comisionistas conectados.' },
  { icono: 'wallet', titulo: 'Tu trabajo, más claro', texto: 'Reuní pasajeros, solicitudes y movimientos de tu actividad.' },
]

export default function Landing({ onIngresar }) {
  return (
    <div className="landing">
      <header className="landing-nav">
        <a className="landing-marca" href="#inicio" aria-label="ComiTrack, inicio">
          <Mascota ancho={48} />
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
            <span className="landing-eyebrow"><span /> VIAJES, ENCOMIENDAS Y PERSONAS</span>
            <h1>Cada viaje conecta.<br /><em>ComiTrack lo hace simple.</em></h1>
            <p>La plataforma para organizar tus viajes, coordinar pasajeros y encomiendas, y llevar el control de tu actividad en un solo lugar.</p>
            <div className="landing-acciones">
              <button type="button" className="landing-cta" onClick={onIngresar}>Empezar ahora <Icon nombre="arrow" tamano={18} /></button>
              <a className="landing-secundario" href="#como-funciona">Conocé ComiTrack <span>↓</span></a>
            </div>
            <div className="landing-confianza"><span className="landing-puntos"><i /><i /><i /></span><span>Una ruta más clara para quienes mueven personas y paquetes.</span></div>
          </div>

          <div className="landing-escena" aria-label="La mascota canguro de ComiTrack junto a un viaje organizado">
            <div className="landing-orbita orbita-uno" /><div className="landing-orbita orbita-dos" />
            <div className="landing-etiqueta etiqueta-ruta"><span className="landing-mini-icon"><Icon nombre="pin" tamano={17} /></span><span><b>Tu próxima ruta</b><small>Lista para organizar</small></span><i className="landing-pulso" /></div>
            <div className="landing-tarjeta-viaje">
              <div className="landing-tarjeta-top"><span>RECORRIDO</span><span className="landing-estado"><i /> PROGRAMADO</span></div>
              <div className="landing-ruta"><div className="landing-puntos-ruta"><i /><span /><i /></div><div><b>Origen</b><strong>Tu ciudad</strong><b>Destino</b><strong>Tu próximo lugar</strong></div><Icon nombre="arrow" tamano={18} /></div>
              <div className="landing-tarjeta-pie"><span><Icon nombre="clock" tamano={15} /> Horarios claros</span><span><Icon nombre="users" tamano={15} /> Todo conectado</span></div>
            </div>
            <div className="landing-mascota-fondo"><Mascota ancho={220} /></div>
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
          <div className="landing-comunidad-visual"><div className="landing-comunidad-sol" /><Mascota ancho={150} /><span className="landing-comunidad-tag">Kilómetro a kilómetro</span></div>
          <div className="landing-comunidad-copy"><span className="landing-eyebrow">HECHO PARA CONECTAR</span><h2>Las mejores rutas<br />se hacen <em>en equipo.</em></h2><p>ComiTrack acerca a quienes ofrecen un viaje con quienes necesitan llegar o enviar algo. Y cada experiencia ayuda a que el próximo recorrido sea todavía mejor.</p><div className="landing-opinion"><span>“</span><div><strong>Tu experiencia también cuenta</strong><small>Muy pronto, este espacio reunirá las historias y opiniones de la comunidad ComiTrack.</small></div><Icon nombre="checkcircle" tamano={19} /></div></div>
        </section>

        <section className="landing-cierre"><div><span className="landing-eyebrow">EL PRÓXIMO VIAJE EMPIEZA ACÁ</span><h2>¿A dónde vamos?</h2><p>Organizá tu actividad o encontrá el viaje que necesitás.</p></div><button type="button" className="landing-cta landing-cta-claro" onClick={onIngresar}>Ingresar a ComiTrack <Icon nombre="arrow" tamano={18} /></button><div className="landing-cierre-mascota"><Mascota ancho={100} /></div></section>
      </main>

      <footer className="landing-footer"><a className="landing-marca landing-marca-footer" href="#inicio"><Mascota ancho={34} /><span>ComiTrack</span></a><span>Movemos historias, conectamos caminos.</span><a href="#inicio">Volver arriba ↑</a></footer>
    </div>
  )
}
