import './App.css'

const plannedLayers = [
  'UI -> application layer -> learning core',
  'subject packages -> subject SDK -> learning core',
  'infrastructure -> learning core ports',
]

function App() {
  return (
    <main className="appShell">
      <section className="heroPanel" aria-labelledby="app-title">
        <p className="statusText">Increment 1 foundation</p>
        <h1 id="app-title">Subject-agnostic learning interface</h1>
        <p className="summary">
          The repository now has the React, TypeScript, test, lint, formatting,
          documentation, and directory-boundary scaffolding for the learning
          kernel.
        </p>
      </section>

      <section className="boundaryPanel" aria-labelledby="boundary-title">
        <h2 id="boundary-title">Dependency direction</h2>
        <ol>
          {plannedLayers.map((layer) => (
            <li key={layer}>{layer}</li>
          ))}
        </ol>
      </section>
    </main>
  )
}

export default App
