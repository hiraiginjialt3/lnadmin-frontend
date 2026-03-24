import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './Sidebar.css';
import { logActivity } from '../utils/activityLogger';
import { useAuth } from '../context/AuthContext';

const Sidebar = () => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { user, getSidebarItems, logout } = useAuth();

  const sidebarItems = getSidebarItems(user?.role || 'Employee');

  const handleNavigation = (pageName) => {
    logActivity(`Viewed ${pageName}`, `Navigated to ${pageName} page`);
    setOpen(false);
  };

  const handleLogout = async () => {
    try {
      const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
      
      if (user?.email) {
        await fetch(`${API_URL}/api/admin/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            email: user.email,
            session_id: user.session_id 
          }),
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      logout();
    }
  };

  const getRoleBadgeColor = (role) => {
    const colors = {
      Admin: '#dc3545',
      HR: '#28a745',
      Accountant: '#17a2b8',
      Employee: '#6c757d'
    };
    return colors[role] || '#6c757d';
  };

  return (
    <>
      <button
        className="hamburger d-md-none"
        onClick={() => setOpen(!open)}
      >
        <i className="bi bi-list"></i>
      </button>

      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="profile">
          <div className="avatar">
            <i className="bi bi-person-circle"></i>
          </div>
          <h6 className="username">Hello, {user?.name || 'User'}</h6>
          <p className="role">
            <span 
              className="badge" 
              style={{ 
                backgroundColor: getRoleBadgeColor(user?.role),
                fontSize: '12px',
                padding: '4px 8px'
              }}
            >
              {user?.role || 'Employee'}
            </span>
          </p>
        </div>

        <hr />

        <nav className="menu">
          {sidebarItems.map((item) => (
            <NavLink 
              key={item.path}
              to={item.path} 
              className="menu-item" 
              onClick={() => handleNavigation(item.name)}
            >
              <i className={`bi ${item.icon}`}></i>
              <span>{item.name}</span>
              {item.name === 'Leave Management' && (
                <span className="badge bg-warning ms-auto">Pending</span>
              )}
            </NavLink>
          ))}
        </nav>

        <hr />

        <div className="logout">
          <button 
            className="logout-btn btn btn-danger w-100" 
            onClick={handleLogout}
          >
            Log Out
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;