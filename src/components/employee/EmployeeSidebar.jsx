import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './EmployeeSidebar.css';

const EmployeeSidebar = () => {
  const [open, setOpen] = useState(false);
  const [employeeName, setEmployeeName] = useState('Employee');
  const [employeeRole, setEmployeeRole] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    // Get employee data from localStorage
    const employeeData = localStorage.getItem('employee');
    if (employeeData) {
      try {
        const employee = JSON.parse(employeeData);
        setEmployeeName(employee.name || 'Employee');
        setEmployeeRole(employee.role || 'Employee');
      } catch (error) {
        console.error('Error parsing employee data:', error);
      }
    }
  }, []);

  const handleLogout = () => {
    // Clear both admin and employee data
    localStorage.removeItem("employeeAuthToken");
    localStorage.removeItem("employee");
    localStorage.removeItem("authToken");
    localStorage.removeItem("user");
    navigate("/login", { replace: true });
  };

  // Helper to close sidebar after clicking a link (mobile)
  const handleLinkClick = () => setOpen(false);

  return (
    <>
      {/* Hamburger Button for Mobile */}
      <button className="hamburger d-md-none" onClick={() => setOpen(!open)}>
        <i className="bi bi-list"></i>
      </button>

      {/* Sidebar */}
      <aside className={`sidebar ${open ? "open" : ""}`}>
        {/* Profile */}
        <div className="profile">
          <div className="avatar">
            <i className="bi bi-person-circle"></i>
          </div>
          <h6 className="username">Hello, {employeeName}</h6>
          <p className="role">{employeeRole}</p>
        </div>

        <hr />

        {/* Menu */}
        <nav className="menu">
          <NavLink to="/employee/dashboard" className="menu-item" onClick={handleLinkClick}>
            <i className="bi bi-speedometer2"></i> Dashboard
          </NavLink>

          <NavLink to="/employee/salary" className="menu-item" onClick={handleLinkClick}>
            <i className="bi bi-cash-stack"></i> Salary
          </NavLink>

          <NavLink to="/employee/attendance" className="menu-item" onClick={handleLinkClick}>
            <i className="bi bi-calendar-check"></i> Attendance
          </NavLink>

          <NavLink to="/employee/calendar" className="menu-item" onClick={handleLinkClick}>
            <i className="bi bi-calendar3"></i> Company Calendar
          </NavLink>

          <NavLink to="/employee/govinfo" className="menu-item" onClick={handleLinkClick}>
            <i className="bi bi-file-earmark-text"></i> Government Info
          </NavLink>

          {/* Leave of Absence Link */}
          <NavLink
            to="/employee/leave-of-absence"
            className="menu-item"
            onClick={handleLinkClick}
          >
            <i className="bi bi-journal-check"></i> Leave of Absences
          </NavLink>
        </nav>

        <hr />

        {/* Logout */}
        <div className="logout">
          <button className="logout-btn btn btn-danger w-100" onClick={handleLogout}>
            Log Out
          </button>
        </div>
      </aside>
    </>
  );
};

export default EmployeeSidebar;