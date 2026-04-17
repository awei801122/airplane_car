import React from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppProvider } from './context/AppContext'
import Navbar from './components/Navbar'
import CustomerHome from './pages/customer/CustomerHome'
import DriverHome from './pages/driver/DriverHome'
import AdminDashboard from './pages/admin/AdminDashboard'

const App: React.FC = () => {
  return (
    <AppProvider>
      <HashRouter>
        <div className="min-h-screen bg-background text-textPrimary font-sans">
          <Navbar />
          <Routes>
            <Route path="/customer" element={<CustomerHome />} />
            <Route path="/driver" element={<DriverHome />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/" element={<Navigate to="/customer" replace />} />
          </Routes>
        </div>
      </HashRouter>
    </AppProvider>
  )
}

export default App
