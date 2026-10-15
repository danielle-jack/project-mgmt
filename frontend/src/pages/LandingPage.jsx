import { useState } from 'react'
import './LandingPage.css'

const teamPhoto =
  'https://images.unsplash.com/photo-1758873268631-fa944fc5cad2?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&ixlib=rb-4.1.0&q=85&w=1080'

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12h13M13 6l6 6-6 6" />
    </svg>
  )
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="m10 8 6 4-6 4z" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m5 12 4 4L19 6" />
    </svg>
  )
}

/**
 * Public marketing page. Only admins can create accounts, so both "Log in" and
 * "Start free" go to the login page.
 */
export default function LandingPage({ onLogin }) {
  const [demoOpen, setDemoOpen] = useState(false)

  return (
    <div className="landing">
      <header className="landing-header">
        <a className="landing-logo" href="#">
          <span className="logo-shape">
            <i />
            <i />
            <i />
          </span>
          Planeo
        </a>
        <nav className="landing-nav">
          <a className="active" href="#home">
            Home
          </a>
          <a href="#product">Product</a>
          <a href="#solutions">Solutions</a>
          <a href="#pricing">Pricing</a>
          <a href="#about">About us</a>
        </nav>
        <div className="header-actions">
          <button className="login-button" onClick={onLogin}>Log in</button>
          <button className="signup-button" onClick={onLogin}>
            Start free <ArrowIcon />
          </button>
        </div>
      </header>

      <main id="home">
        <section className="hero">
          <div className="hero-copy">
            <div className="hero-kicker">
              <span />
              Work clearer. Deliver faster.
            </div>
            <h1>
              Bring every project
              <br />
              into <em>focus.</em>
            </h1>
            <p>
              Plan projects, balance team capacity, and keep every milestone
              moving—without the status meetings and scattered spreadsheets.
            </p>
            <div className="hero-actions">
              <button className="hero-primary" onClick={onLogin}>
                Start for free <ArrowIcon />
              </button>
              <button className="demo-button" onClick={() => setDemoOpen(true)}>
                <span>
                  <PlayIcon />
                </span>
                See how it works
              </button>
            </div>
            <div className="hero-note">
              <CheckIcon />
              Free for teams up to 5 <span /> No credit card required
            </div>
          </div>

          <div className="hero-visual" id="product">
            <div className="visual-backdrop">
              <span className="orbit orbit-one" />
              <span className="orbit orbit-two" />
              <img src={teamPhoto} alt="A team collaborating in a modern workspace" />
              <div className="photo-overlay" />
            </div>

            <div className="float-card project-card">
              <div className="card-label">PROJECT PROGRESS</div>
              <div className="card-row">
                <strong>Website launch</strong>
                <b>78%</b>
              </div>
              <div className="mini-progress">
                <span />
              </div>
              <div className="avatars">
                <i>AM</i>
                <i>JR</i>
                <i>NK</i>
                <i>+3</i>
              </div>
            </div>

            <div className="float-card capacity-card">
              <div className="capacity-icon">
                <span />
              </div>
              <div>
                <small>Team capacity</small>
                <strong>84% allocated</strong>
              </div>
              <span className="good">Healthy</span>
            </div>

            <div className="float-card milestone-card">
              <span className="date-box">
                <b>24</b>
                <small>NOV</small>
              </span>
              <span>
                <small>UPCOMING MILESTONE</small>
                <strong>Design handoff</strong>
                <em>On track</em>
              </span>
            </div>

            <div className="spark spark-one">✦</div>
            <div className="spark spark-two">+</div>
          </div>
        </section>

        <section className="trust">
          <p>Trusted by teams that turn plans into progress</p>
          <div className="logos">
            <span><b>◆</b> Northstar</span>
            <span><b>◫</b> Vertex</span>
            <span><b>◎</b> LUMEN</span>
            <span><b>⌁</b> Everpath</span>
            <span><b>✦</b> Arcadia</span>
          </div>
        </section>

        <section className="value-strip" id="solutions">
          <div>
            <strong>One clear view</strong>
            <span>Projects, people, and milestones together.</span>
          </div>
          <div>
            <strong>Built-in guardrails</strong>
            <span>Prevent overbooking before it happens.</span>
          </div>
          <div>
            <strong>Progress that’s honest</strong>
            <span>Spot dependencies and risk at a glance.</span>
          </div>
        </section>
      </main>

      {demoOpen && (
        <div className="modal-backdrop" onClick={() => setDemoOpen(false)}>
          <div className="demo-modal" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={() => setDemoOpen(false)}>
              ×
            </button>
            <div className="video-placeholder">
              <PlayIcon />
            </div>
            <h2>See Planeo in action</h2>
            <p>A two-minute tour of smarter planning, capacity, and delivery.</p>
            <button className="hero-primary" onClick={() => setDemoOpen(false)}>
              Start exploring <ArrowIcon />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
