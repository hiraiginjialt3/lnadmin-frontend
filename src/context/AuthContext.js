import React, { createContext, useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const AuthContext = createContext();

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

    const getSidebarItems = (role) => {
    const allItems = [
        { path: '/dashboard', name: 'Dashboard', icon: 'bi-speedometer2', roles: ['Admin', 'HR', 'Accountant', 'Employee'] },
        { path: '/accmanagement', name: 'Accounts & Departments', icon: 'bi-people-fill', roles: ['Admin', 'HR'] },
        { path: '/attendance', name: 'Attendance', icon: 'bi-calendar-check', roles: ['Admin', 'Accountant', 'HR'] },
        { path: '/salary', name: 'Salary', icon: 'bi-cash-stack', roles: ['Admin', 'Accountant'] },
        { path: '/admincalendar', name: 'Company Calendar', icon: 'bi-calendar', roles: ['Admin', 'HR', 'Accountant', 'Employee'] },
        { path: '/admin/leaves', name: 'Leave Management', icon: 'bi-calendar-check-fill', roles: ['Admin', 'HR', 'Accountant', 'Employee'] },
        { path: '/govinfo', name: 'Government Info', icon: 'bi-file-earmark-text', roles: ['Admin', 'HR', 'Accountant', 'Employee'] },
        { path: '/violations', name: 'Violations & Negligences', icon: 'bi-exclamation-triangle', roles: ['Admin', 'HR'] },
        { path: '/documents', name: 'Documents', icon: 'bi-folder', roles: ['Admin', 'HR', 'Accountant', 'Employee'] },
        { path: '/systemlogs', name: 'System Logs', icon: 'bi-folder', roles: ['Admin'] }
    ];

    return allItems.filter(item => item.roles.includes(role));
    };

  const getDashboardCards = (role) => {
    const allCards = [
      { id: 'total_employees', title: 'Total Employees', visible: ['Admin', 'HR'] },
      { id: 'present_today', title: 'Present Today', visible: ['Admin', 'Accountant'] },
      { id: 'payroll_released', title: 'Payroll Released', visible: ['Admin', 'Accountant'] },
      { id: 'open_violations', title: 'Open Violations', visible: ['Admin', 'HR'] },
      { id: 'pending_leaves', title: 'Pending Leaves', visible: ['Admin', 'HR', 'Accountant', 'Employee'] },
      { id: 'attendance_rate', title: 'Attendance Rate', visible: ['Admin', 'Accountant', 'Employee'] }
    ];

    return allCards.filter(card => card.visible.includes(role));
  };

  useEffect(() => {
    const loadUser = () => {
      try {
        const userData = localStorage.getItem('user');
        if (userData) {
          const parsedUser = JSON.parse(userData);
          setUser(parsedUser);
          setPermissions(parsedUser.permissions || {});
        }
      } catch (error) {
        console.error('Error loading user:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadUser();
  }, []);

  const login = (userData) => {
    setUser(userData);
    setPermissions(userData.permissions || {});
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('authToken', userData.session_id);
  };

  const logout = () => {
    setUser(null);
    setPermissions({});
    localStorage.removeItem('user');
    localStorage.removeItem('authToken');
    navigate('/login');
  };

  const value = {
    user,
    permissions,
    loading,
    login,
    logout,
    getSidebarItems,
    getDashboardCards,
    isAdmin: user?.role === 'Admin',
    isHR: user?.role === 'HR',
    isAccountant: user?.role === 'Accountant',
    isEmployee: user?.role === 'Employee'
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};