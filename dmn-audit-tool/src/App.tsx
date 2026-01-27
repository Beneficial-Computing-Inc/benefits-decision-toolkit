import { Routes, Route } from 'react-router-dom'
import { CatalogPage } from './pages/catalog'
import { CheckDetailPage } from './pages/check-detail'
import { ScreenerPage } from './pages/screener'
import { AccessibleScreenerPage } from './pages/accessible-screener'
import { AutoScreenerPage } from './pages/auto-screener'
import { ErrorBoundary } from './components/error-boundary'

function App() {
  return (
    <div className="min-h-screen bg-background">
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<CatalogPage />} />
          <Route path="/check/:checkId" element={<CheckDetailPage />} />
          <Route path="/screener" element={<ScreenerPage />} />
          <Route path="/screener/accessible" element={<AccessibleScreenerPage />} />
          <Route path="/screener/auto" element={<AutoScreenerPage />} />
        </Routes>
      </ErrorBoundary>
    </div>
  )
}

export default App
