import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, Navigate } from 'react-router-dom';

// Components
import Sidebar from './components/Sidebar';
import EmployeeSidebar from './components/employee/EmployeeSidebar';
import Header from './components/Header';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from './components/ProtectedRoute';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import AccountManagement from './pages/account-management';
import AdminSalary from './pages/adminsalary';
import Departments from './pages/Departments';
import GovInfo from './pages/govinfo';
import Violations from './pages/Violations';
import Reports from './pages/Reports';
import Systemlogs from './pages/Systemlogs';
import Attendance from './pages/Attendance';
import BenefitsManagement from './pages/BenefitsManagement';
import UpdateEmployees from './pages/UpdateEmployees';
import CompanyCalendar from "./pages/employee/CompanyCalendar";

// Admin Pages
import AdminCompanyCalendar from "./pages/AdminCompanyCalendar";
import AdminLeaveManagement from './pages/AdminLeaveManagement'; 

// Employee Pages
import EmployeeLogin from './pages/EmployeeLogin';
import ProtectedEmployeeRoute from './components/employee/ProtectedEmployeeRoute';
import EmployeeDashboard from './pages/employee/EmployeeDashboard';
import EmployeeSalary from './pages/employee/EmployeeSalary';
import EmployeeAttendance from './pages/employee/Attendance';
import EmployeeGovInfo from "./pages/employee/employeegovinfo";
import LeaveOfAbsencePage from './pages/employee/loa'; 

import { ViolationsProvider } from './context/ViolationsContext';
import { AuthProvider } from './context/AuthContext';
import { CompanySettingsProvider } from './context/CompanySettingsContext';

// Webpage
import CompanyInfo from './pages/CompanyInfo';

import './App.css';

// Roles
const ROLES = {
  ADMIN: 'Admin',
  HR: 'HR',
  ACCOUNTANT: 'Accountant',
  EMPLOYEE: 'Employee'
};

const Layout = () => {
  const location = useLocation();

  const isEmployeeRoute = location.pathname.startsWith('/employee');

  const hideSidebar =
    location.pathname === '/' ||
    location.pathname === '/login' ||
    location.pathname === '/dashboard';

  const hideHeader =
    location.pathname === '/' ||
    location.pathname === '/login';

  return (
    <div className={`app-container ${hideSidebar ? 'no-sidebar' : ''}`}>

      {/* Sidebar - Role-based */}
      {!hideSidebar && (isEmployeeRoute ? <EmployeeSidebar /> : <Sidebar />)}

      <div className="main-content">
        {!hideHeader && <Header />}

        <div className="content-wrapper">
          <Routes>

            {/* ===== Admin Pages ACL ===== */}
            
            {/* Dashboard - All roles can access */}
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute allowedRoles={[ROLES.ADMIN, ROLES.HR, ROLES.ACCOUNTANT, ROLES.EMPLOYEE]}>
                  <Dashboard />
                </ProtectedRoute>
              } 
            />

            {/* Accounts & Departments Management - Admin & HR only */}
            <Route 
              path="/accmanagement" 
              element={
                <ProtectedRoute allowedRoles={[ROLES.ADMIN, ROLES.HR]}>
                  <AccountManagement />
                </ProtectedRoute>
              } 
            />

            {/* Update Employee - Admin & HR only */}
            <Route 
              path="/accmanagement/update/:employeeId" 
              element={
                <ProtectedRoute allowedRoles={[ROLES.ADMIN, ROLES.HR]}>
                  <UpdateEmployees />
                </ProtectedRoute>
              } 
            />

            {/* Salary & Payroll - Admin & Accountant only */}
            <Route 
              path="/salary" 
              element={
                <ProtectedRoute allowedRoles={[ROLES.ADMIN, ROLES.ACCOUNTANT]}>
                  <AdminSalary />
                </ProtectedRoute>
              } 
            />

            {/* Benefits Management - Admin & Accountant only */}
            <Route 
              path="/benefits" 
              element={
                <ProtectedRoute allowedRoles={[ROLES.ADMIN, ROLES.ACCOUNTANT]}>
                  <BenefitsManagement />
                </ProtectedRoute>
              } 
            />

            {/* Departments - Admin & HR only */}
            <Route 
              path="/departments" 
              element={
                <ProtectedRoute allowedRoles={[ROLES.ADMIN, ROLES.HR]}>
                  <Departments />
                </ProtectedRoute>
              } 
            />

            {/* Violations - Admin & HR only */}
            <Route 
              path="/violations" 
              element={
                <ProtectedRoute allowedRoles={[ROLES.ADMIN, ROLES.HR]}>
                  <Violations />
                </ProtectedRoute>
              } 
            />

            {/* Government Info - Admin, HR, Accountant, Employee */}
            <Route 
              path="/govinfo" 
              element={
                <ProtectedRoute allowedRoles={[ROLES.ADMIN, ROLES.HR, ROLES.ACCOUNTANT, ROLES.EMPLOYEE]}>
                  <GovInfo />
                </ProtectedRoute>
              } 
            />

            {/* Reports - Admin only */}
            <Route 
              path="/reports" 
              element={
                <ProtectedRoute allowedRoles={[ROLES.ADMIN]}>
                  <Reports />
                </ProtectedRoute>
              } 
            />

            {/* System Logs - Admin only */}
            <Route 
              path="/systemlogs" 
              element={
                <ProtectedRoute allowedRoles={[ROLES.ADMIN]}>
                  <Systemlogs />
                </ProtectedRoute>
              } 
            />

            {/* Attendance - Admin, Accountant, and HR */}
            <Route 
              path="/attendance" 
              element={
                <ProtectedRoute allowedRoles={[ROLES.ADMIN, ROLES.ACCOUNTANT, ROLES.HR]}>
                  <Attendance />
                </ProtectedRoute>
              } 
            />

            {/* Company Info - Public (no auth needed) */}
            <Route path="/company-info" element={<CompanyInfo />} />

            {/* Employee Calendar - All roles can view */}
            <Route 
              path="/employee/calendar" 
              element={
                <ProtectedRoute allowedRoles={[ROLES.ADMIN, ROLES.HR, ROLES.ACCOUNTANT, ROLES.EMPLOYEE]}>
                  <CompanyCalendar />
                </ProtectedRoute>
              } 
            />

            {/* Admin Calendar - Admin, HR, Accountant can manage */}
            <Route 
              path="/admincalendar" 
              element={
                <ProtectedRoute allowedRoles={[ROLES.ADMIN, ROLES.HR, ROLES.ACCOUNTANT]}>
                  <AdminCompanyCalendar />
                </ProtectedRoute>
              } 
            />

            {/* Admin Leave Management - Admin, HR, Accountant, Employee can manage */}
            <Route 
              path="/admin/leaves" 
              element={
                <ProtectedRoute allowedRoles={[ROLES.ADMIN, ROLES.HR]}>
                  <AdminLeaveManagement />
                </ProtectedRoute>
              } 
            />

            {/* Documents - All roles */}
            <Route 
              path="/documents" 
              element={
                <ProtectedRoute allowedRoles={[ROLES.ADMIN, ROLES.HR, ROLES.ACCOUNTANT, ROLES.EMPLOYEE]}>
                  <div style={{ padding: '2rem' }}>
                    <h2>Documents Management</h2>
                    <p>This section is under development.</p>
                  </div>
                </ProtectedRoute>
              } 
            />

            {/* ===== Employee Pages===== */}
            <Route path="/employee/login" element={<EmployeeLogin />} />

            <Route 
              path="/employee/dashboard" 
              element={
                <ProtectedEmployeeRoute>
                  <EmployeeDashboard />
                </ProtectedEmployeeRoute>
              } 
            />

            <Route 
              path="/employee/salary" 
              element={
                <ProtectedEmployeeRoute>
                  <EmployeeSalary />
                </ProtectedEmployeeRoute>
              } 
            />

            <Route 
              path="/employee/attendance" 
              element={
                <ProtectedEmployeeRoute>
                  <EmployeeAttendance />
                </ProtectedEmployeeRoute>
              } 
            />

            <Route 
              path="/employee/govinfo" 
              element={
                <ProtectedEmployeeRoute>
                  <EmployeeGovInfo />
                </ProtectedEmployeeRoute>
              } 
            />

            <Route 
              path="/employee/leave-of-absence" 
              element={
                <ProtectedEmployeeRoute>
                  <LeaveOfAbsencePage />
                </ProtectedEmployeeRoute>
              } 
            />

            {/* ===== Default ===== */}
            <Route
              path="*"
              element={
                <div style={{ padding: '2rem', textAlign: 'center' }}>
                  <h2>Page Not Found</h2>
                  <p>Please select a valid page from the sidebar.</p>
                </div>
              }
            />

          </Routes>
        </div>
      </div>
    </div>
  );
};

function App() {
  return (
    <CompanySettingsProvider>
      <Router>
        <AuthProvider>
          <ViolationsProvider>
            <ScrollToTop />
            <Routes>
              <Route path="/" element={<Login />} />
              <Route path="/login" element={<Login />} />
              <Route path="/*" element={<Layout />} />
            </Routes>
          </ViolationsProvider>
        </AuthProvider>
      </Router>
    </CompanySettingsProvider>
  );
}

export default App;
