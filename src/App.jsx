import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import AuthProvider from './hooks/AuthProvider'
import ProtectedRoute from './components/ProtectedRoute'
import PublicRoute from './components/PublicRoute'
import AppLayout from './components/AppLayout'
import Inicio from './pages/Inicio'
import Login from './pages/Login'
import Registro from './pages/Registro'
import Hoy from './pages/Hoy'
import Tareas from './pages/Tareas'
import NuevaTarea from './pages/NuevaTarea'
import EditarTarea from './pages/EditarTarea'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Solo para quien NO tiene sesión */}
          <Route element={<PublicRoute />}>
            <Route path="/login" element={<Login />} />
            <Route path="/registro" element={<Registro />} />
          </Route>

          {/* Solo para quien SÍ tiene sesión */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/" element={<Inicio />} />
              <Route path="/hoy" element={<Hoy />} />
              <Route path="/tareas" element={<Tareas />} />
              <Route path="/tareas/nueva" element={<NuevaTarea />} />
              <Route path="/tareas/:id/editar" element={<EditarTarea />} />
            </Route>
          </Route>

          {/* Cualquier otra ruta: al inicio (que redirige a /login si no hay sesión) */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
