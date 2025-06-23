import { Schedule } from './components/Schedule/Schedule'
import './App.css'

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>Radio Scheduler</h1>
      </header>
      <main>
        <Schedule />
      </main>
    </div>
  )
}

export default App
