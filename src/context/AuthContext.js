import React, { createContext, useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const AuthContext = createContext();
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [permissions, setPermissions] = useState({});
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Function to validate session with backend
  const validateSession = async () => {
    const token = localStorage.getItem('authToken');
    const userData = localStorage.getItem('user');
    
    if (!token || !userData) {
      setLoading(false);
      return false;
    }
    
    try {
      const response = await fetch(`${API_URL}/api/auth/validate`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (data.valid && data.role !== 'Employee') {
        // Session is valid, update user data with latest from server
        const currentUser = JSON.parse(userData);
        const updatedUser = {
          ...currentUser,
          role: data.role,
          email: data.email,
          name: data.name,
          validated_at: new Date().toISOString()
        };
        
        setUser(updatedUser);
        setPermissions(updatedUser.permissions || {});
        localStorage.setItem('user', JSON.stringify(updatedUser));
        return true;
      } else {
        // Invalid session or employee - clear everything
        console.warn('Invalid session or employee access detected');
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        setUser(null);
        setPermissions({});
        return false;
      }
    } catch (error) {
      console.error('Session validation error:', error);
      // Don't clear on network error, but mark as invalid
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Check session on app load
  useEffect(() => {
    validateSession();
  }, []);

  // Periodically validate session (every 5 minutes)
  useEffect(() => {
    const interval = setInterval(() => {
      if (user) {
        validateSession();
      }
    }, 5 * 60 * 1000); // 5 minutes
    
    return () => clearInterval(interval);
  }, [user]);

  const login = (userData) => {
    setUser(userData);
    setPermissions(userData.permissions || {});
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('authToken', userData.session_id);
  };

  const logout = async () => {
    // Call logout endpoint
    const token = localStorage.getItem('authToken');
    const userData = user;
    
    if (token && userData?.email) {
      try {
        await fetch(`${API_URL}/api/admin/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            email: userData.email,
            session_id: token 
          }),
        });
      } catch (error) {
        console.error('Logout error:', error);
      }
    }
    
    setUser(null);
    setPermissions({});
    localStorage.removeItem('user');
    localStorage.removeItem('authToken');
    navigate('/login');
  };

  const getSidebarItems = (role) => {
    // Only show sidebar items for allowed roles
    if (role === 'Employee') return [];
    
    const allItems = [
      { path: '/dashboard', name: 'Dashboard', icon: 'bi-speedometer2', roles: ['Admin', 'HR', 'Accountant'] },
      { path: '/accmanagement', name: 'Accounts & Departments', icon: 'bi-people-fill', roles: ['Admin', 'HR'] },
      { path: '/attendance', name: 'Attendance', icon: 'bi-calendar-check', roles: ['Admin', 'Accountant', 'HR'] },
      { path: '/salary', name: 'Salary', icon: 'bi-cash-stack', roles: ['Admin', 'Accountant'] },
      { path: '/admincalendar', name: 'Company Calendar', icon: 'bi-calendar', roles: ['Admin', 'HR', 'Accountant'] },
      { path: '/admin/leaves', name: 'Leave Management', icon: 'bi-calendar-check-fill', roles: ['Admin', 'HR'] },
      { path: '/govinfo', name: 'Government Info', icon: 'bi-file-earmark-text', roles: ['Admin', 'HR', 'Accountant'] },
      { path: '/violations', name: 'Violations', icon: 'bi-exclamation-triangle', roles: ['Admin', 'HR'] },
      { path: '/systemlogs', name: 'System Logs', icon: 'bi-folder', roles: ['Admin'] }
    ];

    return allItems.filter(item => item.roles.includes(role));
  };

  const getDashboardCards = (role) => {
    // Only show cards for allowed roles
    if (role === 'Employee') return [];
    
    const allCards = [
      { id: 'total_employees', title: 'Total Employees', visible: ['Admin', 'HR'] },
      { id: 'present_today', title: 'Present Today', visible: ['Admin', 'Accountant'] },
      { id: 'payroll_released', title: 'Payroll Released', visible: ['Admin', 'Accountant'] },
      { id: 'open_violations', title: 'Open Violations', visible: ['Admin', 'HR'] },
      { id: 'pending_leaves', title: 'Pending Leaves', visible: ['Admin', 'HR', 'Accountant'] },
      { id: 'attendance_rate', title: 'Attendance Rate', visible: ['Admin', 'Accountant'] }
    ];

    return allCards.filter(card => card.visible.includes(role));
  };

  const value = {
    user,
    permissions,
    loading,
    login,
    logout,
    validateSession,
    getSidebarItems,
    getDashboardCards,
    isAdmin: user?.role === 'Admin',
    isHR: user?.role === 'HR',
    isAccountant: user?.role === 'Accountant',
    isEmployee: user?.role === 'Employee',
    isAuthorized: user?.role && ['Admin', 'HR', 'Accountant'].includes(user.role)
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};