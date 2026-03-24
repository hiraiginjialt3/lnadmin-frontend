import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { 
  getDashboardStats, 
  getTodayAttendance, 
  getSystemStatus,
  getAllEmployees,
  getEmployeeViolations,
  getLeaveStats
} from "../services/api";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import { useAuth } from '../context/AuthContext';

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, getDashboardCards, isAdmin, isHR, isAccountant, isEmployee } = useAuth();
  
  const [stats, setStats] = useState(null);
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [totalEmployees, setTotalEmployees] = useState("NULL");
  const [violations, setViolations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [payrollAmount, setPayrollAmount] = useState("₱0.00");
  const [systemStatus, setSystemStatus] = useState({});
  const [leaveStats, setLeaveStats] = useState({
    pending: 0,
    approved: 0,
    denied: 0,
    total: 0
  });
  
  const [currentUser, setCurrentUser] = useState(null);
  const [logoutLoading, setLogoutLoading] = useState(false);

  // Get current user from localStorage on component mount
  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      try {
        const parsedUser = JSON.parse(userData);
        setCurrentUser(parsedUser);
      } catch (error) {
        console.error('Error parsing user data:', error);
      }
    }
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Build promises array based on role
      const promises = [getDashboardStats(), getTodayAttendance(), getSystemStatus(), getLeaveStats()];
      
      // Only fetch employee and violation data for roles that can see them
      if (isAdmin || isHR) {
        promises.push(getAllEmployees());
        promises.push(getEmployeeViolations());
      }
      
      const [statsRes, todayRes, systemStatusRes, leaveStatsRes, employeesRes, violationsRes] = await Promise.all(promises);

      if (statsRes.data.success) setStats(statsRes.data.stats);
      if (todayRes.data.success) setTodayAttendance(todayRes.data);
      if (systemStatusRes.data.success) setSystemStatus(systemStatusRes.data);
      else setSystemStatus({ flask: "unknown", sqlite: { status: "unknown" }, mongodb: { status: "unknown" }});
      
      if (leaveStatsRes.data.success) {
        setLeaveStats(leaveStatsRes.data.stats);
      }
      
      // Only set employee data if fetched (for Admin and HR)
      if ((isAdmin || isHR) && employeesRes?.data.success) {
        const employees = employeesRes.data.employees;
        setTotalEmployees(employees.length);
        const activeEmployees = employees.filter(emp => emp.status === 'active').length;
        const totalPayroll = activeEmployees * 20000;
        setPayrollAmount(`₱${totalPayroll.toLocaleString()}`);
      }
      
      if ((isAdmin || isHR) && violationsRes?.data.success) {
        setViolations(violationsRes.data.data || []);
      }
    } catch (error) {
      console.error(error);
      setSystemStatus({ flask: "error", sqlite: { status: "error" }, mongodb: { status: "error" }});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const openViolations = violations.filter(v => v.status === 'pending').length;
  const dashboardCards = getDashboardCards(user?.role);

  // LOGOUT FUNCTION
  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

  const handleLogout = async () => {
    setLogoutLoading(true);
    
    try {
      const user = JSON.parse(localStorage.getItem('user'));
      
      if (user?.email) {
        console.log('Logging out user:', user.email);
        
        const response = await fetch(`${API_URL}/api/admin/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            email: user.email,
            session_id: user.session_id 
          }),
        });

        const data = await response.json();
        
        if (data.success) {
          console.log('Logout recorded successfully:', data.logout_log_id);
        } else {
          console.warn('Logout recording failed:', data.message);
        }
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      sessionStorage.clear();
      navigate('/login', { replace: true });
      setLogoutLoading(false);
    }
  };

  return (
    <div className="container-fluid p-4">
      {/* Page Title with Logout and User Info */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h4 className="fw-bold mb-1">
            {isAdmin ? 'Admin Dashboard' : isHR ? 'HR Dashboard' : isAccountant ? 'Accountant Dashboard' : 'Employee Dashboard'}
          </h4>
          <small className="text-muted">
            Welcome back, {user?.name || currentUser?.admin_name || 'User'}! | 
            Role: <span className="fw-bold">{user?.role || currentUser?.role || 'Admin'}</span>
          </small>
        </div>
        
        <div className="d-flex align-items-center gap-3">
          {currentUser && (
            <div className="text-end">
              <div className="fw-semibold">
                <i className="bi bi-person-circle me-2 text-primary"></i>
                {currentUser.admin_name || currentUser.name || 'User'}
              </div>
              <small className="text-muted d-block">
                <i className="bi bi-envelope me-1"></i>
                {currentUser.email}
              </small>
              <small className="text-muted d-block">
                <span className={`badge ${isAdmin ? 'bg-danger' : isHR ? 'bg-success' : isAccountant ? 'bg-info' : 'bg-secondary'}`}>
                  {user?.role || currentUser?.role || 'Admin'}
                </span>
              </small>
            </div>
          )}
          <button 
            className="btn btn-danger" 
            onClick={handleLogout}
            disabled={logoutLoading}
          >
            {logoutLoading ? (
              <>
                <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                Logging out...
              </>
            ) : (
              <>
                <i className="bi bi-box-arrow-right me-1"></i> Log Out
              </>
            )}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-2">Loading dashboard data...</p>
        </div>
      ) : (
        <>
          {/* Leave Management Summary Card - Visible to all roles */}
          <div className="row mb-4">
            <div className="col-12">
              <div className="card border-primary shadow-sm rounded-0">
                <div className="card-header bg-primary text-white fw-semibold rounded-0 d-flex justify-content-between align-items-center">
                  <span>
                    <i className="bi bi-calendar-check-fill me-2"></i>
                    Leave Management Summary
                  </span>
                  <Link to="/admin/leaves" className="btn btn-sm btn-light">
                    <i className="bi bi-arrow-right me-1"></i> Manage Leaves
                  </Link>
                </div>
                <div className="card-body">
                  <div className="row">
                    <div className="col-md-3 col-6 mb-3">
                      <div className="text-center p-3 bg-warning bg-opacity-10 rounded">
                        <i className="bi bi-clock-history fs-1 text-warning mb-2"></i>
                        <h3 className="fw-bold mb-0">{leaveStats.pending}</h3>
                        <small className="text-muted">Pending Requests</small>
                      </div>
                    </div>
                    <div className="col-md-3 col-6 mb-3">
                      <div className="text-center p-3 bg-success bg-opacity-10 rounded">
                        <i className="bi bi-check-circle fs-1 text-success mb-2"></i>
                        <h3 className="fw-bold mb-0">{leaveStats.approved}</h3>
                        <small className="text-muted">Approved</small>
                      </div>
                    </div>
                    <div className="col-md-3 col-6 mb-3">
                      <div className="text-center p-3 bg-danger bg-opacity-10 rounded">
                        <i className="bi bi-x-circle fs-1 text-danger mb-2"></i>
                        <h3 className="fw-bold mb-0">{leaveStats.denied}</h3>
                        <small className="text-muted">Denied</small>
                      </div>
                    </div>
                    <div className="col-md-3 col-6 mb-3">
                      <div className="text-center p-3 bg-info bg-opacity-10 rounded">
                        <i className="bi bi-calendar-check fs-1 text-info mb-2"></i>
                        <h3 className="fw-bold mb-0">{leaveStats.total}</h3>
                        <small className="text-muted">Total Requests</small>
                      </div>
                    </div>
                  </div>
                  {leaveStats.pending > 0 && (
                    <div className="alert alert-warning mb-0 mt-2">
                      <i className="bi bi-exclamation-triangle me-2"></i>
                      You have <strong>{leaveStats.pending} pending</strong> leave request{leaveStats.pending > 1 ? 's' : ''} that need your attention.
                      <Link to="/admin/leaves" className="alert-link ms-2">Review now →</Link>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Summary Cards - Role-based visibility */}
          <div className="row g-3 mb-4">
            {/* Total Employees - Admin & HR only */}
            {(isAdmin || isHR) && (
              <SummaryCard
                title="Total Employees"
                value={totalEmployees}
                icon="people"
                color="primary"
                bg="bg-primary-subtle"
                rounded="rounded-4"
                hover
              />
            )}
            
            {/* Present Today - Admin & Accountant only */}
            {(isAdmin || isAccountant) && (
              <SummaryCard
                title="Present Today"
                value={todayAttendance?.stats?.total_today || "0"}
                icon="calendar-check"
                color="success"
                bg="bg-success-subtle"
                rounded="rounded-4"
                hover
              />
            )}
            
            {/* Payroll Released - Admin & Accountant only */}
            {(isAdmin || isAccountant) && (
              <SummaryCard
                title="Payroll Released"
                value={payrollAmount}
                icon="cash-stack"
                color="warning"
                bg="bg-warning-subtle"
                rounded="rounded-4"
                hover
              />
            )}
            
            {/* Open Violations - Admin & HR only */}
            {(isAdmin || isHR) && (
              <SummaryCard
                title="Open Violations"
                value={openViolations}
                icon="exclamation-triangle"
                color="danger"
                bg="bg-danger-subtle"
                rounded="rounded-4"
                hover
              />
            )}
            
            {/* Pending Leaves - All roles */}
            <SummaryCard
              title="Pending Leaves"
              value={leaveStats.pending}
              icon="calendar-check-fill"
              color="info"
              bg="bg-info-subtle"
              rounded="rounded-4"
              hover
            />
            
          </div>

          {/* Management Section - Role-based module visibility */}
          <div className="card border shadow-sm rounded-0">
            <div className="card-header bg-light fw-semibold rounded-0">
              Management Modules
            </div>
            <div className="card-body">
              <div className="row g-3">
                {/* Accounts & Departments - Admin & HR only */}
                {(isAdmin || isHR) && (
                  <ModuleCard
                    to="/accmanagement"
                    icon="people-fill"
                    title="Accounts & Departments Management"
                    description="Manage employee accounts and profiles"
                  />
                )}
                
                {/* Attendance - Admin & Accountant only */}
                {(isAdmin || isAccountant || isHR) && (
                  <ModuleCard
                    to="/attendance"
                    icon="calendar-check"
                    title="Attendance"
                    description="Daily attendance records and tracking"
                  />
                )}
                
                {/* Salary & Payroll - Admin & Accountant only */}
                {(isAdmin || isAccountant) && (
                  <ModuleCard
                    to="/salary"
                    icon="cash-stack"
                    title="Salary & Payroll"
                    description="Payroll processing and salaries"
                  />
                )}
                
                {/* Company Calendar - All roles */}
                <ModuleCard
                  to="/admincalendar"
                  icon="calendar-event"
                  title="Company Calendar"
                  description={isAdmin || isHR ? "Manage the Dates" : "View company calendar"}
                />
                
                {/* Leave Management - All roles */}
                <ModuleCard
                  to="/admin/leaves"
                  icon="calendar-check-fill"
                  title="Leave Management"
                  description={`Manage leave requests (${leaveStats.pending} pending)`}
                  badge={leaveStats.pending > 0 ? leaveStats.pending : null}
                />
                
                {/* Government Info - Admin & Employee only */}
                {(isAdmin || isEmployee) && (
                  <ModuleCard
                    to="/govinfo"
                    icon="file-earmark-text"
                    title="Government Info"
                    description="SSS, PhilHealth, Pag-IBIG"
                  />
                )}
                
                {/* Violations - Admin & HR only */}
                {(isAdmin || isHR) && (
                  <ModuleCard
                    to="/violations"
                    icon="exclamation-triangle"
                    title="Violations"
                    description="Employee violations and notices"
                  />
                )}
                
                {/* Documents - All roles */}
                <ModuleCard
                  to="/documents"
                  icon="folder"
                  title="Documents"
                  description="Payslips and official files"
                />
                
                {/* System Logs - Admin only */}
                {isAdmin && (
                  <ModuleCard
                    to="/systemlogs"
                    icon="folder"
                    title="System Logs"
                    description="System updates, audit trails"
                  />
                )}
              </div>
            </div>
          </div>

          {/* Quick Stats Row - Role-based visibility */}
          <div className="row g-3 mb-4 mt-4">
            {/* Attendance Status - Admin & Accountant only */}
            {(isAdmin || isAccountant) && (
              <div className="col-12 col-md-4">
                <div className="card shadow-sm rounded-4 border-0 h-100 bg-light hover-card">
                  <div className="card-body p-4">
                    <div className="d-flex align-items-center mb-3">
                      <div className="me-3 fs-4 text-primary">
                        <i className="bi bi-clock-history"></i>
                      </div>
                      <h6 className="fw-semibold mb-0">Attendance Status</h6>
                    </div>
                    <div className="d-flex justify-content-between mb-2">
                      <span>Currently In</span>
                      <span className="fw-bold text-success">
                        {todayAttendance?.stats?.currently_in || "0"}
                      </span>
                    </div>
                    <div className="d-flex justify-content-between mb-2">
                      <span>Clocked Out</span>
                      <span className="fw-bold text-primary">
                        {todayAttendance?.stats?.clocked_out || "0"}
                      </span>
                    </div>
                    <div className="d-flex justify-content-between">
                      <span>Absent</span>
                      <span className="fw-bold text-danger">
                        {todayAttendance?.stats?.absent || "0"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Employee Status - Admin & HR only */}
            {(isAdmin || isHR) && (
              <div className="col-12 col-md-4">
                <div className="card shadow-sm rounded-4 border-0 h-100 bg-light hover-card">
                  <div className="card-body p-4">
                    <div className="d-flex align-items-center mb-3">
                      <div className="me-3 fs-4 text-success">
                        <i className="bi bi-person-check"></i>
                      </div>
                      <h6 className="fw-semibold mb-0">Employee Status</h6>
                    </div>
                    <div className="d-flex justify-content-between mb-2">
                      <span>Active</span>
                      <span className="fw-bold text-success">
                        {stats?.active_employees || "0"}
                      </span>
                    </div>
                    <div className="d-flex justify-content-between mb-2">
                      <span>Inactive</span>
                      <span className="fw-bold text-danger">
                        {stats?.inactive_employees || "0"}
                      </span>
                    </div>
                    <div className="d-flex justify-content-between">
                      <span>Faces Registered</span>
                      <span className="fw-bold text-info">
                        {stats?.total_faces_registered || "0"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Department Distribution - Admin & HR only */}
            {(isAdmin || isHR) && (
              <div className="col-12 col-md-4">
                <div className="card shadow-sm rounded-4 border-0 h-100 bg-light hover-card">
                  <div className="card-body p-4">
                    <div className="d-flex align-items-center mb-3">
                      <div className="me-3 fs-4 text-info">
                        <i className="bi bi-building"></i>
                      </div>
                      <h6 className="fw-semibold mb-0">Department Distribution</h6>
                    </div>
                    <div className="small">
                      {stats?.department_data?.slice(0, 3).map(dept => (
                        <div
                          key={dept.department}
                          className="d-flex justify-content-between mb-1 text-truncate"
                        >
                          <span className="text-muted text-truncate">{dept.department}:</span>
                          <span className="fw-bold">{dept.count}</span>
                        </div>
                      ))}
                      {stats?.department_data?.length > 3 && (
                        <div className="text-center mt-2">
                          <small className="text-muted">
                            +{stats.department_data.length - 3} more
                          </small>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* For Accountant - Show financial summary instead */}
            {isAccountant && (
              <div className="col-12 col-md-4">
                <div className="card shadow-sm rounded-4 border-0 h-100 bg-light hover-card">
                  <div className="card-body p-4">
                    <div className="d-flex align-items-center mb-3">
                      <div className="me-3 fs-4 text-warning">
                        <i className="bi bi-calculator"></i>
                      </div>
                      <h6 className="fw-semibold mb-0">Payroll Summary</h6>
                    </div>
                    <div className="d-flex justify-content-between mb-2">
                      <span>Weekly Payroll</span>
                      <span className="fw-bold text-success">{payrollAmount}</span>
                    </div>
                    <div className="d-flex justify-content-between mb-2">
                      <span>This Month</span>
                      <span className="fw-bold text-primary">₱{(parseFloat(payrollAmount.replace('₱', '').replace(/,/g, '')) * 4).toLocaleString()}</span>
                    </div>
                    <div className="d-flex justify-content-between">
                      <span>Pending Leaves</span>
                      <span className="fw-bold text-warning">{leaveStats.pending}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* For Employee - Show personal summary */}
            {isEmployee && (
              <div className="col-12 col-md-4">
                <div className="card shadow-sm rounded-4 border-0 h-100 bg-light hover-card">
                  <div className="card-body p-4">
                    <div className="d-flex align-items-center mb-3">
                      <div className="me-3 fs-4 text-primary">
                        <i className="bi bi-person-badge"></i>
                      </div>
                      <h6 className="fw-semibold mb-0">My Information</h6>
                    </div>
                    <div className="d-flex justify-content-between mb-2">
                      <span>Employee ID</span>
                      <span className="fw-bold">{user?.employee_id || currentUser?.employee_id || 'N/A'}</span>
                    </div>
                    <div className="d-flex justify-content-between mb-2">
                      <span>My Leaves</span>
                      <span className="fw-bold text-success">{leaveStats.approved} Approved</span>
                    </div>
                    <div className="d-flex justify-content-between">
                      <span>Pending Requests</span>
                      <span className="fw-bold text-warning">{leaveStats.pending}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Today's Attendance Summary - Admin & Accountant only */}
          {todayAttendance && (isAdmin || isAccountant) && (
            <div className="card border shadow-sm rounded-0 mb-4">
              <div className="card-header bg-light fw-semibold rounded-0 d-flex justify-content-between align-items-center">
                <span>
                  <i className="bi bi-database me-2"></i>
                  Today's Attendance Summary
                  <small className="ms-2 text-muted">
                    (Source: {todayAttendance.source || 'SQLite'})
                  </small>
                </span>
                <Link to="/attendance" className="btn btn-sm btn-primary">
                  <i className="bi bi-arrow-right me-1"></i> View All Attendance
                </Link>
              </div>
              <div className="card-body">
                <div className="row">
                  <div className="col-md-3 text-center">
                    <div className="p-3">
                      <i className="bi bi-clock-history fs-1 text-primary mb-2"></i>
                      <h5 className="fw-bold">{todayAttendance?.stats?.total_today || "0"}</h5>
                      <small className="text-muted">Total Today</small>
                    </div>
                  </div>
                  <div className="col-md-3 text-center">
                    <div className="p-3">
                      <i className="bi bi-person-check fs-1 text-success mb-2"></i>
                      <h5 className="fw-bold">{todayAttendance?.stats?.currently_in || "0"}</h5>
                      <small className="text-muted">Currently Working</small>
                    </div>
                  </div>
                  <div className="col-md-3 text-center">
                    <div className="p-3">
                      <i className="bi bi-person-x fs-1 text-danger mb-2"></i>
                      <h5 className="fw-bold">{todayAttendance?.stats?.absent || "0"}</h5>
                      <small className="text-muted">Absent Today</small>
                    </div>
                  </div>
                  <div className="col-md-3 text-center">
                    <div className="p-3">
                      <i className="bi bi-calendar2-check fs-1 text-warning mb-2"></i>
                      <h5 className="fw-bold">{todayAttendance?.stats?.clocked_out || "0"}</h5>
                      <small className="text-muted">Completed Shift</small>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Recent Attendance - Admin & Accountant only */}
          {todayAttendance?.recent_entries?.length > 0 && (isAdmin || isAccountant) && (
            <div className="card border shadow-sm rounded-0 mb-4">
              <div className="card-header bg-light fw-semibold rounded-0 d-flex justify-content-between align-items-center">
                <span>Recent Clock-ins Today</span>
                <Link to="/attendance" className="btn btn-sm btn-primary">
                  View All
                </Link>
              </div>
              <div className="card-body">
                <div className="table-responsive">
                  <table className="table table-sm table-hover">
                    <thead>
                      <tr>
                        <th>Employee</th>
                        <th>Clock In</th>
                        <th>Clock Out</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {todayAttendance.recent_entries.slice(0, 5).map((entry, index) => (
                        <tr key={index}>
                          <td>
                            <div className="d-flex align-items-center">
                              <Link 
                                to={`/employees/update/${entry.employee_id || 'unknown'}`} 
                                className="text-decoration-none text-dark d-flex align-items-center"
                              >
                                <i className="bi bi-person-circle me-2 text-muted"></i>
                                <span>{entry.employee_name}</span>
                              </Link>
                            </div>
                          </td>
                          <td>
                            <span className="badge bg-success rounded-pill">
                              {entry.clock_in_time}
                            </span>
                          </td>
                          <td>
                            {entry.clock_out_time ? (
                              <span className="badge bg-danger rounded-pill">
                                {entry.clock_out_time}
                              </span>
                            ) : (
                              <span className="badge bg-warning rounded-pill">Still In</span>
                            )}
                          </td>
                          <td>
                            {entry.clock_out_time ? (
                              <span className="text-success">Completed</span>
                            ) : (
                              <span className="text-warning">Working</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* System Status - Admin only */}
          {isAdmin && (
            <div className="card border shadow-sm rounded-0 mt-4">
              <div className="card-header bg-light fw-semibold rounded-0">
                System Status
              </div>
              <div className="card-body">
                <div className="row">
                  <div className="col-md-6">
                    <div className="d-flex align-items-center mb-3">
                      <div className={`status-indicator ${systemStatus.flask === 'running' ? 'bg-success' : 'bg-danger'}`}></div>
                      <div className="ms-3">
                        <h6 className="mb-0">Backend Connection</h6>
                        <small className="text-muted">
                          {systemStatus.flask === 'running' ? 'Connected to Flask API' : 'Disconnected'}
                        </small>
                      </div>
                    </div>
                    <div className="d-flex align-items-center mb-3">
                      <div className="status-indicator bg-info"></div>
                      <div className="ms-3">
                        <h6 className="mb-0">Face Recognition</h6>
                        <small className="text-muted">
                          {stats?.total_faces_registered || '0'} faces registered
                        </small>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="d-flex align-items-center mb-3">
                      <div className={`status-indicator ${systemStatus.sqlite?.status === 'connected' ? 'bg-success' : 'bg-warning'}`}></div>
                      <div className="ms-3">
                        <h6 className="mb-0">SQLite Database</h6>
                        <small className="text-muted">
                          {systemStatus.sqlite?.status === 'connected' ? 'Active' : systemStatus.sqlite?.status || 'Unknown'}
                        </small>
                      </div>
                    </div>
                    <div className="d-flex align-items-center">
                      <div className={`status-indicator ${systemStatus.mongodb?.status === 'connected' ? 'bg-success' : 'bg-warning'}`}></div>
                      <div className="ms-3">
                        <h6 className="mb-0">MongoDB</h6>
                        <small className="text-muted">
                          {systemStatus.mongodb?.status === 'connected' ? 'Connected' : systemStatus.mongodb?.status || 'Unknown'}
                        </small>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-3 text-center">
                  <small className="text-muted">
                    Last updated: {new Date().toLocaleTimeString()}
                  </small>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

/* ===========================
   Summary Card Component
=========================== */
const SummaryCard = ({ title, value, icon, color }) => (
  <div className="col-6 col-md-3">
    <div className="card summary-card shadow-sm h-100">
      <div className="card-body d-flex align-items-center justify-content-between">
        <div>
          <div className="summary-title">{title}</div>
          <div className="summary-value">{value}</div>
        </div>
        <i className={`bi bi-${icon} summary-icon text-${color}`}></i>
      </div>
    </div>
  </div>
);

/* ===========================
   Module Card Component (UPDATED with badge)
=========================== */
const ModuleCard = ({ to, icon, title, description, badge }) => (
  <div className="col-12 col-md-6 col-xl-4">
    <Link to={to} className="text-decoration-none text-dark">
      <div className="border p-3 h-100 rounded-0 module-card hover-card">
        <div className="d-flex align-items-start gap-3">
          <i className={`bi bi-${icon} fs-4 text-primary`}></i>
          <div className="flex-grow-1">
            <div className="d-flex justify-content-between align-items-center">
              <h6 className="fw-semibold mb-1">{title}</h6>
              {badge && (
                <span className="badge bg-warning rounded-pill">{badge}</span>
              )}
            </div>
            <p className="text-muted small mb-0">{description}</p>
          </div>
        </div>
      </div>
    </Link>
  </div>
);

// Add some custom CSS for better UI
const styles = `
  .status-indicator {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    display: inline-block;
  }
  
  .hover-card:hover {
    background-color: #f8f9fa;
    border-color: #0d6efd !important;
    transform: translateY(-2px);
    transition: all 0.3s ease;
  }
  
  .module-card {
    cursor: pointer;
  }
  
  .summary-title {
    font-size: 0.9rem;
    color: #6c757d;
  }
  
  .summary-value {
    font-size: 1.8rem;
    font-weight: bold;
    line-height: 1.2;
  }
  
  .summary-icon {
    font-size: 2.5rem;
    opacity: 0.5;
  }
`;

// Add styles to the document
const styleSheet = document.createElement("style");
styleSheet.innerText = styles;
document.head.appendChild(styleSheet);

export default Dashboard;