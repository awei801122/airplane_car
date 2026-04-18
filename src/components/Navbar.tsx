import React from 'react'
import { useApp } from '../context/AppContext'

const Navbar: React.FC = () => {
  const { currentUser, setCurrentUser } = useApp()

  return (
    <nav className="bg-surface border-b border-border px-4 py-3">
      <div className="max-w-lg mx-auto flex items-center justify-between">
        <div className="text-xl font-bold text-primary">
          <i className="fa-solid fa-car-side mr-2"></i>YJOVA 車來了
        </div>
        {currentUser && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-textSecondary">{currentUser.name}</span>
            <button
              onClick={() => setCurrentUser(null)}
              className="text-xs text-textSecondary hover:text-primary"
            >
              登出
            </button>
          </div>
        )}
      </div>
    </nav>
  )
}

export default Navbar
