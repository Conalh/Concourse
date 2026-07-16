const stationDescriptions = {
  route:
    'Route is the course builder and learning environment for arranging lessons, resources, exercises, branches, and reusable blocks.',
  loop: 'Loop turns learning material into focused retrieval practice, review packs, and repeatable study sessions.',
  transfer:
    'Transfer is the local-pack layer for importing, syncing, validating, and updating learning material.',
  modes:
    'Modes are flexible presentation and support preferences attached to content and interfaces.',
}

const modeViews = {
  chunked: `
    <div class="mode-output mode-output-chunked">
      <ol>
        <li>The neuron receives enough input to start a signal.</li>
        <li>Channels open and charged particles move across the membrane.</li>
        <li>The next section opens, carrying the signal forward.</li>
      </ol>
    </div>
  `,
  visual: `
    <div class="mode-output visual-diagram">
      <div class="neuron-diagram" aria-label="Simple signal diagram">
        <span>Dendrite receives input</span>
        <span>Membrane charge shifts</span>
        <span>Axon carries signal</span>
      </div>
      <p>The same idea is shown as a labeled sequence.</p>
    </div>
  `,
  audio: `
    <div class="mode-output audio-box">
      <p><strong>Audio version</strong></p>
      <div class="audio-track" aria-hidden="true"></div>
      <p><a href="#modes">Read the transcript</a></p>
    </div>
  `,
  guided: `
    <div class="mode-output">
      <div class="guided-checkpoint">
        <p><strong>Checkpoint</strong></p>
        <p>What has to change before the next channel opens?</p>
      </div>
      <div class="guided-checkpoint">
        <p><strong>Try saying it back</strong></p>
        <p>A signal moves because nearby channels open in sequence.</p>
      </div>
    </div>
  `,
  low: `
    <div class="mode-output low-stimulation">
      <p>
        A neuron sends a signal when charge changes across the membrane. That
        change opens nearby channels, so the signal moves down the axon.
      </p>
    </div>
  `,
  quick: `
    <div class="mode-output quick-box">
      <p><strong>Quick summary</strong></p>
      <p>A neural signal is a chain reaction of membrane charge changes.</p>
      <p><strong>Recall question</strong></p>
      <p>What opens the next channel in the sequence?</p>
    </div>
  `,
}

const setupMobileNavigation = () => {
  const header = document.querySelector('[data-header]')
  const button = document.querySelector('[data-menu-button]')
  const nav = document.querySelector('[data-site-nav]')

  if (
    !(header instanceof HTMLElement) ||
    !(button instanceof HTMLButtonElement)
  ) {
    return
  }

  const closeMenu = () => {
    header.classList.remove('is-open')
    document.body.classList.remove('nav-open')
    button.setAttribute('aria-expanded', 'false')
  }

  const openMenu = () => {
    header.classList.add('is-open')
    document.body.classList.add('nav-open')
    button.setAttribute('aria-expanded', 'true')
  }

  button.addEventListener('click', () => {
    if (header.classList.contains('is-open')) {
      closeMenu()
      return
    }

    openMenu()
  })

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && header.classList.contains('is-open')) {
      closeMenu()
      button.focus()
    }
  })

  nav?.addEventListener('click', (event) => {
    if (event.target instanceof HTMLAnchorElement) {
      closeMenu()
    }
  })

  window.addEventListener('resize', () => {
    if (window.innerWidth > 1120) {
      closeMenu()
    }
  })
}

const setupEcosystemMap = () => {
  const panel = document.querySelector('.ecosystem-panel')
  const description = document.querySelector('[data-station-description]')
  const buttons = document.querySelectorAll('[data-station]')

  if (
    !(panel instanceof HTMLElement) ||
    !(description instanceof HTMLElement)
  ) {
    return
  }

  const setActiveStation = (station) => {
    panel.dataset.active = station
    description.textContent = stationDescriptions[station]

    buttons.forEach((button) => {
      if (!(button instanceof HTMLButtonElement)) {
        return
      }

      const active = button.dataset.station === station
      button.classList.toggle('is-active', active)
      button.setAttribute('aria-pressed', active ? 'true' : 'false')
    })
  }

  buttons.forEach((button) => {
    if (!(button instanceof HTMLButtonElement)) {
      return
    }

    const station = button.dataset.station

    if (typeof station !== 'string') {
      return
    }

    button.addEventListener('click', () => setActiveStation(station))
    button.addEventListener('focus', () => setActiveStation(station))
    button.addEventListener('mouseenter', () => setActiveStation(station))
  })

  setActiveStation('route')
}

const setupModesDemo = () => {
  const demo = document.querySelector('[data-modes-demo]')
  const preview = document.querySelector('[data-mode-preview]')

  if (!(demo instanceof HTMLElement) || !(preview instanceof HTMLElement)) {
    return
  }

  const buttons = Array.from(demo.querySelectorAll('[data-mode]')).filter(
    (button) => button instanceof HTMLButtonElement,
  )

  const selectedModes = new Set(['chunked'])

  const renderPreview = () => {
    const orderedModes = Object.keys(modeViews).filter((mode) =>
      selectedModes.has(mode),
    )

    preview.innerHTML = `
      <p class="preview-kicker">Sample lesson</p>
      <h3>How neurons send a signal</h3>
      ${orderedModes.map((mode) => modeViews[mode]).join('')}
    `
  }

  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      const mode = button.dataset.mode

      if (typeof mode !== 'string') {
        return
      }

      if (selectedModes.has(mode)) {
        selectedModes.delete(mode)
      } else {
        selectedModes.add(mode)
      }

      if (selectedModes.size === 0) {
        selectedModes.add('chunked')
      }

      buttons.forEach((candidate) => {
        const candidateMode = candidate.dataset.mode
        const isPressed =
          typeof candidateMode === 'string' && selectedModes.has(candidateMode)
        candidate.setAttribute('aria-pressed', isPressed ? 'true' : 'false')
      })

      renderPreview()
    })
  })
}

const setupFaqAccordion = () => {
  const faqList = document.querySelector('[data-faq-list]')

  if (!(faqList instanceof HTMLElement)) {
    return
  }

  const items = Array.from(faqList.querySelectorAll('details'))

  items.forEach((item) => {
    item.addEventListener('toggle', () => {
      if (!item.open) {
        return
      }

      items.forEach((candidate) => {
        if (candidate !== item) {
          candidate.open = false
        }
      })
    })
  })
}

const setupCurrentYear = () => {
  const yearTarget = document.querySelector('[data-current-year]')

  if (yearTarget instanceof HTMLElement) {
    yearTarget.textContent = String(new Date().getFullYear())
  }
}

setupMobileNavigation()
setupEcosystemMap()
setupModesDemo()
setupFaqAccordion()
setupCurrentYear()
