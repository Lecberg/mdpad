function App(): React.JSX.Element {
  const { electron, chrome, node } = window.api.versions

  return (
    <main className="page">
      <h1>mdpad</h1>
      <p>Project scaffold is running. The editor arrives in M1.</p>
      <p className="muted" data-testid="versions">
        Electron {electron} · Chromium {chrome} · Node {node}
      </p>
    </main>
  )
}

export default App
