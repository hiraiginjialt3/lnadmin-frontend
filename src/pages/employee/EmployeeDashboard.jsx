import React, { useState, useEffect } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const EmployeeDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [showViolationsModal, setShowViolationsModal] = useState(false);
  
  // State for real data
  const [employee, setEmployee] = useState(null);
  const [currentSalary, setCurrentSalary] = useState({
    amount: 0,
    asOf: new Date().toLocaleDateString()
  });
  const [workingHours, setWorkingHours] = useState({
    current: 0,
    target: 160, // Monthly target hours
    percentage: 0
  });
  const [transactions, setTransactions] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [violations, setViolations] = useState([]);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 4;

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // Get employee from localStorage
      const employeeData = localStorage.getItem('employee');
      if (!employeeData) {
        console.error('No employee data found');
        setLoading(false);
        return;
      }

      const emp = JSON.parse(employeeData);
      setEmployee(emp);

      // Fetch all data in parallel
      await Promise.all([
        fetchCurrentSalary(emp.employee_id),
        fetchWorkingHours(emp.employee_id, emp.name),
        fetchRecentTransactions(emp.employee_id),
        fetchAnnouncements(),
        fetchViolations(emp.employee_id)
      ]);

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCurrentSalary = async (employeeId) => {
    try {
      // Get most recent payroll
      const response = await fetch(`${API_URL}/api/payroll/employee/${employeeId}?limit=1`);
      const data = await response.json();

      if (data.success && data.payrolls.length > 0) {
        const latest = data.payrolls[0];
        setCurrentSalary({
          amount: latest.net_pay || 0,
          gross: latest.gross_pay || 0,
          asOf: latest.week_end ? new Date(latest.week_end).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          }) : new Date().toLocaleDateString()
        });
      }
    } catch (error) {
      console.error('Error fetching salary:', error);
    }
  };

  const fetchWorkingHours = async (employeeId, employeeName) => {
    try {
      // Calculate current month's working hours
      const today = new Date();
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      
      const startDate = firstDay.toISOString().split('T')[0];
      const endDate = lastDay.toISOString().split('T')[0];

      // Get attendance records for this month
      const response = await fetch(
        `${API_URL}/api/attendance/employee/${encodeURIComponent(employeeName)}?start_date=${startDate}&end_date=${endDate}`
      );
      const data = await response.json();

      let totalHours = 0;
      if (data.success && data.records) {
        data.records.forEach(record => {
          if (record.clock_in_time && record.clock_out_time) {
            const timeIn = record.clock_in_time.split(':').map(Number);
            const timeOut = record.clock_out_time.split(':').map(Number);
            
            const inMinutes = timeIn[0] * 60 + timeIn[1];
            const outMinutes = timeOut[0] * 60 + timeOut[1];
            
            let hoursWorked = (outMinutes - inMinutes) / 60;
            if (hoursWorked < 0) hoursWorked += 24; // Overnight shift
            
            totalHours += hoursWorked;
          }
        });
      }

      // If no attendance records, use default 40 hours for demo
      if (totalHours === 0) {
        totalHours = 40;
      }

      const targetHours = 160; // 40 hours per week * 4 weeks
      const percentage = Math.min((totalHours / targetHours) * 100, 100);

      setWorkingHours({
        current: Math.round(totalHours * 10) / 10,
        target: targetHours,
        percentage: Math.round(percentage)
      });

    } catch (error) {
      console.error('Error fetching working hours:', error);
      // Fallback to demo data
      setWorkingHours({
        current: 40,
        target: 160,
        percentage: 25
      });
    }
  };

  const fetchRecentTransactions = async (employeeId) => {
    try {
      const response = await fetch(`${API_URL}/api/payroll/employee/${employeeId}?limit=10`);
      const data = await response.json();

      if (data.success) {
        const formatted = data.payrolls.map((payroll, index) => ({
          id: payroll._id || index,
          type: 'Salary',
          date: payroll.week_end ? new Date(payroll.week_end).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          }) : 'Recent',
          amount: payroll.net_pay || 0,
          gross: payroll.gross_pay || 0,
          status: payroll.status || 'pending'
        }));
        setTransactions(formatted);
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
    }
  };

  const fetchAnnouncements = async () => {
    try {
      // You'll need to create this endpoint
      const response = await fetch(`${API_URL}/api/announcements/active`);
      const data = await response.json();

      if (data.success) {
        setAnnouncements(data.announcements);
      }
    } catch (error) {
      console.error('Error fetching announcements:', error);
      // Fallback to demo data
      setAnnouncements([
        { id: 1, text: 'Team meeting at 10 AM' },
        { id: 2, text: 'Project deadline extended' },
        { id: 3, text: 'New policy update' },
        { id: 4, text: 'Maintenance scheduled tomorrow' },
        { id: 5, text: 'Office party next week' },
      ]);
    }
  };

  const fetchViolations = async (employeeId) => {
    try {
      const response = await fetch(`${API_URL}/api/employee/${employeeId}/violations?limit=3`);
      const data = await response.json();

      if (data.success) {
        setViolations(data.violations);
      }
    } catch (error) {
      console.error('Error fetching violations:', error);
      // Fallback to demo data
      setViolations([
        { id: 1, type: 'Late', date: new Date().toISOString().split('T')[0] },
        { id: 2, type: 'Early Leave', date: new Date(Date.now() - 86400000).toISOString().split('T')[0] },
        { id: 3, type: 'Absent', date: new Date(Date.now() - 172800000).toISOString().split('T')[0] },
      ]);
    }
  };

  // Pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentTransactions = transactions.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(transactions.length / itemsPerPage);

  const formatCurrency = (amount) => {
    return amount.toLocaleString('en-PH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  if (loading) {
    return (
      <div className="container py-5 text-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <p className="mt-2">Loading your dashboard...</p>
      </div>
    );
  }

  return (
    <div className="container py-4">

      {/* Welcome Banner */}
      {employee && (
        <div className="alert alert-primary mb-3 py-2">
          <div className="d-flex align-items-center">
            <i className="bi bi-person-circle fs-5 me-2"></i>
            <div>
              <strong>Welcome back, {employee.name}!</strong>
              <small className="text-muted ms-2">{employee.department} • {employee.employee_id}</small>
            </div>
          </div>
        </div>
      )}

      {/* Current Salary */}
      <div className="card mb-4 shadow-sm">
        <div className="card-body d-flex justify-content-between align-items-center">
          <div>
            <h6 className="card-title mb-1">
              <i className="bi bi-cash-stack me-1 text-success"></i>
              Current Salary
            </h6>
            <h3 className="mb-0 fw-bold">₱ {formatCurrency(currentSalary.amount)}</h3>
            {currentSalary.gross > 0 && (
              <small className="text-muted">
                Gross: ₱ {formatCurrency(currentSalary.gross)}
              </small>
            )}
          </div>
          <div className="text-end">
            <small className="text-muted d-block">as of</small>
            <small className="text-muted">{currentSalary.asOf}</small>
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="row mb-4">

        {/* Working Hours */}
        <div className="col-md-4 mb-3">
          <div className="card shadow-sm text-center py-3 h-100">
            <div className="d-flex flex-column align-items-center justify-content-between h-100">
              <div className="position-relative" style={{ width: '120px', height: '120px' }}>
                {/* Circular progress indicator */}
                <svg viewBox="0 0 36 36" className="circular-chart">
                  <path
                    d="M18 2.0845
                      a 15.9155 15.9155 0 0 1 0 31.831
                      a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="#e0e0e0"
                    strokeWidth="3"
                  />
                  <path
                    d="M18 2.0845
                      a 15.9155 15.9155 0 0 1 0 31.831
                      a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="#007bff"
                    strokeWidth="3"
                    strokeDasharray={`${workingHours.percentage}, 100`}
                    strokeLinecap="round"
                  />
                  <text x="18" y="20.35" textAnchor="middle" dominantBaseline="middle" style={{ fontSize: '0.4em', fill: '#666' }}>
                    {workingHours.percentage}%
                  </text>
                </svg>
              </div>
              <div className="mt-2">
                <h6 className="mb-0">Working Hours</h6>
                <small className="text-muted">
                  {workingHours.current} / {workingHours.target} hrs this month
                </small>
              </div>
            </div>
          </div>
        </div>

        {/* Announcement */}
        <div className="col-md-4 mb-3">
          <div
            className="card shadow-sm text-center py-3 h-100 d-flex flex-column justify-content-center"
            style={{ cursor: 'pointer' }}
            onClick={() => setShowAnnouncementModal(true)}
          >
            <i className="bi bi-bell fs-2 mb-2 text-warning"></i>
            <h6>Announcements</h6>
            <span className="badge bg-danger mt-2" style={{ fontSize: '0.9rem' }}>
              {announcements.length} New
            </span>
          </div>
        </div>

        {/* Violations */}
        <div className="col-md-4 mb-3">
          <div
            className="card shadow-sm text-center py-3 h-100 d-flex flex-column justify-content-center"
            style={{ cursor: 'pointer' }}
            onClick={() => setShowViolationsModal(true)}
          >
            <i className="bi bi-exclamation-triangle fs-2 mb-2 text-danger"></i>
            <h6>Violations / Warnings</h6>
            {violations.length > 0 ? (
              <>
                <p className="mb-1" style={{ fontSize: '0.9rem', fontWeight: 500 }}>
                  {violations[0].type}
                </p>
                <p className="text-muted mb-0" style={{ fontSize: '0.8rem' }}>
                  {new Date(violations[0].date).toLocaleDateString()}
                </p>
              </>
            ) : (
              <p className="text-success mb-0">
                <i className="bi bi-check-circle me-1"></i>
                No violations
              </p>
            )}
          </div>
        </div>

      </div>

      {/* Transaction History */}
      <div className="card shadow-sm">
        <div className="card-header fw-bold d-flex justify-content-between align-items-center">
          <span>
            <i className="bi bi-clock-history me-2"></i>
            Recent Transactions
          </span>
          <span className="badge bg-primary">{transactions.length} Records</span>
        </div>

        {currentTransactions.length > 0 ? (
          <ul className="list-group list-group-flush">
            {currentTransactions.map((t) => (
              <li
                key={t.id}
                className="list-group-item d-flex justify-content-between align-items-center"
              >
                <div>
                  <strong>{t.type}</strong>
                  <div className="text-muted small">{t.date}</div>
                  {t.status && (
                    <span className={`badge ${t.status === 'paid' ? 'bg-success' : 'bg-warning'} mt-1`}>
                      {t.status}
                    </span>
                  )}
                </div>
                <div className="text-end">
                  <span className="fw-bold text-success d-block">
                    ₱ {formatCurrency(t.amount)}
                  </span>
                  {t.gross > 0 && (
                    <small className="text-muted">
                      Gross: ₱ {formatCurrency(t.gross)}
                    </small>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-center py-4 text-muted">
            <i className="bi bi-inbox fs-1 d-block mb-2"></i>
            No recent transactions
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="card-footer">
            <nav>
              <ul className="pagination justify-content-center flex-wrap mb-0">
                <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
                  <button 
                    className="page-link"
                    onClick={() => setCurrentPage(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </button>
                </li>

                {[...Array(totalPages).keys()].map((num) => (
                  <li key={num + 1} className={`page-item ${currentPage === num + 1 ? 'active' : ''}`}>
                    <button 
                      className="page-link"
                      onClick={() => setCurrentPage(num + 1)}
                    >
                      {num + 1}
                    </button>
                  </li>
                ))}

                <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
                  <button 
                    className="page-link"
                    onClick={() => setCurrentPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </button>
                </li>
              </ul>
            </nav>
          </div>
        )}
      </div>

      {/* Announcement Modal */}
      {showAnnouncementModal && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  <i className="bi bi-megaphone me-2"></i>
                  Announcements
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowAnnouncementModal(false)}
                ></button>
              </div>
              <div className="modal-body">
                {announcements.length > 0 ? (
                  <ul className="list-group">
                    {announcements.map((ann) => (
                      <li key={ann.id} className="list-group-item">
                        {ann.text}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-center text-muted py-3">No announcements</p>
                )}
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowAnnouncementModal(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Violations Modal */}
      {showViolationsModal && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  <i className="bi bi-exclamation-triangle me-2"></i>
                  Active Violations
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowViolationsModal(false)}
                ></button>
              </div>
              <div className="modal-body">
                {violations.length > 0 ? (
                  <ul className="list-group">
                    {violations.map((v) => (
                      <li
                        key={v.id}
                        className="list-group-item d-flex justify-content-between align-items-center"
                      >
                        <div>
                          <span className="fw-bold">{v.type}</span>
                          {v.description && (
                            <div className="small text-muted">{v.description}</div>
                          )}
                        </div>
                        <small className="text-muted">
                          {new Date(v.date).toLocaleDateString()}
                        </small>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-center text-success py-3">
                    <i className="bi bi-check-circle-fill me-2"></i>
                    No active violations
                  </p>
                )}
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowViolationsModal(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx="true">{`
        .circular-chart {
          display: block;
          width: 100%;
          height: 100%;
        }
      `}</style>
    </div>
  );
};

export default EmployeeDashboard;