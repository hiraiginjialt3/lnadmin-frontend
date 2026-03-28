import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const { user, loading, logout } = useAuth();
  const [validating, setValidating] = useState(true);
  const [isValid, setIsValid] = useState(false);

  // Validate session with backend
  const validateSession = async (token, userData) => {
    try {
      const response = await fetch(`${API_URL}/api/auth/validate`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (response.ok && data.valid) {
        // Check if role is allowed (not Employee)
        if (data.role === 'Employee') {
          console.warn('Employee detected in protected route - logging out');
          logout();
          return false;
        }
        
        // Check if role is in allowedRoles if specified
        if (allowedRoles.length > 0 && !allowedRoles.includes(data.role)) {
          console.warn(`Role ${data.role} not allowed for this route`);
          return false;
        }
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Session validation error:', error);
      return false;
    }
  };

  useEffect(() => {
    const checkAuthorization = async () => {
      const token = localStorage.getItem('authToken');
      const userData = localStorage.getItem('user');
      
      // If no token or user, not authorized
      if (!token || !userData) {
        setIsValid(false);
        setValidating(false);
        return;
      }
      
      try {
        const parsedUser = JSON.parse(userData);
        
        // Quick check - block employees immediately
        if (parsedUser.role === 'Employee') {
          console.warn('Employee blocked from protected route');
          localStorage.removeItem('authToken');
          localStorage.removeItem('user');
          logout();
          setIsValid(false);
          setValidating(false);
          return;
        }
        
        // Validate with backend
        const valid = await validateSession(token, parsedUser);
        setIsValid(valid);
        
        if (!valid) {
          // Clear invalid session
          localStorage.removeItem('authToken');
          localStorage.removeItem('user');
          logout();
        }
      } catch (error) {
        console.error('Error checking authorization:', error);
        setIsValid(false);
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        logout();
      } finally {
        setValidating(false);
      }
    };

    // Only run if user exists or we need to check
    if (!loading) {
      checkAuthorization();
    }
  }, [loading, logout, allowedRoles]);

  // Show loading spinner while checking
  if (loading || validating) {
    return (
      <div className="d-flex justify-content-center align-items-center vh-100">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  // Not logged in or invalid session
  if (!user || !isValid) {
    return <Navigate to="/login" replace />;
  }

  // Check role-based access (double check with backend-validated role)
  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  // Employee check (extra safety)
  if (user.role === 'Employee') {
    console.warn('Employee access denied to protected route');
    logout();
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default ProtectedRoute;