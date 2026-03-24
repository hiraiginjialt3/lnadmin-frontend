import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import 'bootstrap-icons/font/bootstrap-icons.css';
import { useAuth } from '../context/AuthContext';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Use admin login endpoint only
      const endpoint = `${API_URL}/api/admin/login`;

      const loginResponse = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          email, 
          password,
          user_agent: navigator.userAgent 
        }),
      });

      const loginData = await loginResponse.json();

      if (!loginResponse.ok) {
        throw new Error(loginData.message || 'Login failed');
      }

      if (loginData.success) {
        // Get the actual role from server response
        const userRole = loginData.role || loginData.admin_role || 'Employee';
        
        console.log('Login successful! User role:', userRole);
        
        // Define permissions based on role
        const getPermissions = (role) => {
          const permissions = {
            Admin: {
              can_view_dashboard: true,
              can_view_accounts: true,
              can_edit_accounts: true,
              can_view_attendance: true,
              can_edit_attendance: true,
              can_view_salary: true,
              can_edit_salary: true,
              can_view_calendar: true,
              can_edit_calendar: true,
              can_view_leaves: true,
              can_edit_leaves: true,
              can_view_violations: true,
              can_edit_violations: true,
              can_view_system_logs: true,
              can_view_documents: true,
              can_edit_documents: true
            },
            HR: {
              can_view_dashboard: true,
              can_view_accounts: true,
              can_edit_accounts: true,
              can_view_attendance: false,
              can_edit_attendance: false,
              can_view_salary: false,
              can_edit_salary: false,
              can_view_calendar: true,
              can_edit_calendar: false,
              can_view_leaves: true,
              can_edit_leaves: true,
              can_view_violations: true,
              can_edit_violations: true,
              can_view_system_logs: false,
              can_view_documents: true,
              can_edit_documents: false
            },
            Accountant: {
              can_view_dashboard: true,
              can_view_accounts: false,
              can_edit_accounts: false,
              can_view_attendance: true,
              can_edit_attendance: false,
              can_view_salary: true,
              can_edit_salary: true,
              can_view_calendar: true,
              can_edit_calendar: false,
              can_view_leaves: true,
              can_edit_leaves: false,
              can_view_violations: false,
              can_edit_violations: false,
              can_view_system_logs: false,
              can_view_documents: true,
              can_edit_documents: false
            },
            Employee: {
              can_view_dashboard: true,
              can_view_accounts: false,
              can_edit_accounts: false,
              can_view_attendance: false,
              can_edit_attendance: false,
              can_view_salary: false,
              can_edit_salary: false,
              can_view_calendar: true,
              can_edit_calendar: false,
              can_view_leaves: true,
              can_edit_leaves: true,
              can_view_violations: false,
              can_edit_violations: false,
              can_view_system_logs: false,
              can_view_documents: true,
              can_edit_documents: false
            }
          };
          return permissions[role] || permissions.Employee;
        };
        
        // Prepare user data with correct role from server
        const userData = {
          email: loginData.admin_email,
          admin_id: loginData.admin_id,
          admin_name: loginData.admin_name,
          name: loginData.admin_name,
          role: userRole,  // Use the actual role from server
          session_id: loginData.session_id,
          login_time: loginData.login_time || new Date().toISOString(),
          permissions: loginData.permissions || getPermissions(userRole)
        };
        
        console.log('User data to store:', {
          name: userData.name,
          email: userData.email,
          role: userData.role,
          permissions: userData.permissions
        });
        
        // Store in localStorage
        localStorage.setItem('authToken', loginData.session_id);
        localStorage.setItem('user', JSON.stringify(userData));
        
        // Update auth context
        login(userData);
        
        // Navigate based on role (optional)
        // All roles go to dashboard, dashboard will handle visibility
        navigate('/dashboard', { replace: true });
      }
    } catch (err) {
      console.error('Login error:', err);
      setError(err.message || 'Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    alert('Please contact the system administrator to reset your password.');
  };

  const togglePassword = () => setShowPassword(!showPassword);

  // Get role display text
  const getRoleDisplay = () => {
    // This is just for UI - the actual role comes from server
    return '';
  };

  return (
    <>
      <header className="header-banner d-flex align-items-center justify-content-center px-3">
        <div className="header-logo text-white">
          <h2 className="mb-0">LN Display</h2>
        </div>
      </header>

      <div className="container vh-100 d-flex justify-content-center align-items-center">
        <div className="card shadow w-100" style={{ maxWidth: '400px' }}>
          <div className="card-body p-4">
            <h3 className="text-center mb-4">
              <i className="bi bi-shield-lock me-2"></i>
              Login
            </h3>

            {error && (
              <div className="alert alert-danger alert-dismissible fade show" role="alert">
                {error}
                <button type="button" className="btn-close" onClick={() => setError('')}></button>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {/* Email */}
              <div className="mb-3">
                <label className="form-label" htmlFor="email">Email address</label>
                <div className="input-group">
                  <span className="input-group-text">
                    <i className="bi bi-envelope-fill"></i>
                  </span>
                  <input
                    id="email"
                    type="email"
                    className={`form-control ${error ? 'is-invalid' : ''}`}
                    placeholder="Enter email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    autoComplete="email"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="mb-3">
                <label className="form-label" htmlFor="password">Password</label>
                <div className="input-group">
                  <span className="input-group-text">
                    <i className="bi bi-lock-fill"></i>
                  </span>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    className={`form-control ${error ? 'is-invalid' : ''}`}
                    placeholder="Enter password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={togglePassword}
                    disabled={loading}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <i className={`bi ${showPassword ? 'bi-eye-slash-fill' : 'bi-eye-fill'}`}></i>
                  </button>
                </div>
              </div>

              <div className="d-grid mb-3">
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  disabled={loading}
                  style={{ height: '45px' }}
                >
                  {loading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      Logging in...
                    </>
                  ) : (
                    'Login'
                  )}
                </button>
              </div>

              <div className="text-center">
                <button 
                  type="button" 
                  className="btn btn-link p-0"
                  onClick={handleForgotPassword}
                  disabled={loading}
                >
                  Forgot password?
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
};

export default Login;