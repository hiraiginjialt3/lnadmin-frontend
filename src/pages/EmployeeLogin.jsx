// src/pages/EmployeeLogin.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import 'bootstrap-icons/font/bootstrap-icons.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const EmployeeLogin = () => {
  const navigate = useNavigate();
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
      const response = await fetch(`${API_URL}/api/employee/login`, {
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

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Login failed');
      }

      if (data.success) {
        localStorage.setItem('employeeAuthToken', data.session_id);
        localStorage.setItem('employee', JSON.stringify({
          email: data.email,
          employee_id: data.employee_id,
          name: data.name,
          role: data.role,
          department: data.department,
          login_time: data.login_time
        }));

        navigate('/employee/dashboard', { replace: true });
      }
    } catch (err) {
      console.error('Login error:', err);
      setError(err.message || 'Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <header className="header-banner d-flex align-items-center justify-content-center px-3">
        <div className="header-logo text-white">Employee Portal</div>
      </header>

      <div className="container vh-100 d-flex justify-content-center align-items-center">
        <div className="card shadow w-100" style={{ maxWidth: '400px' }}>
          <div className="card-body p-4">
            <h3 className="text-center mb-4">
              <i className="bi bi-person-badge me-2"></i>
              Employee Login
            </h3>

            {error && (
              <div className="alert alert-danger">{error}</div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label className="form-label">Email</label>
                <input
                  type="email"
                  className="form-control"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="mb-3">
                <label className="form-label">Password</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="form-control"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <button type="submit" className="btn btn-primary w-100" disabled={loading}>
                {loading ? 'Logging in...' : 'Login'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
};

export default EmployeeLogin; // Make sure this line exists