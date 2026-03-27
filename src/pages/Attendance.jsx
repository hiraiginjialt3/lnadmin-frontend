import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getMongoDBAttendance, getTodayMongoDBAttendance } from "../services/api";
import API from "../services/api";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";

const Attendance = () => {
  const [attendanceData, setAttendanceData] = useState([]);
  const [todayStats, setTodayStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  
  const [autoClockOutStatus, setAutoClockOutStatus] = useState(null);
  const [attendanceSettings, setAttendanceSettings] = useState(null);

  const fetchAttendanceData = async () => {
    try {
      setLoading(true);
      
      // Fetch today's stats and all attendance data in parallel
      const [todayRes, allRes] = await Promise.all([
        getTodayMongoDBAttendance(),
        getMongoDBAttendance(filterDate)
      ]);

      if (todayRes.data.success) {
        setTodayStats(todayRes.data);
      }

      if (allRes.data.success) {
        setAttendanceData(allRes.data.data || []);
      } else {
        console.error("Failed to fetch attendance data:", allRes.data.error);
      }

    } catch (error) {
      console.error("Error fetching attendance data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAttendanceSettings = async () => {
    try {
      const response = await API.get('/attendance/settings');
      if (response.data.success) {
        setAttendanceSettings(response.data.settings);
      }
    } catch (error) {
      console.error("Error fetching attendance settings:", error);
    }
  };

  const fetchAutoClockOutStatus = async () => {
    try {
      const response = await API.get('/attendance/auto-clockout/status');
      if (response.data.success) {
        setAutoClockOutStatus(response.data);
      }
    } catch (error) {
      console.error("Error fetching auto clock-out status:", error);
    }
  };

  useEffect(() => {
    fetchAttendanceData();
    fetchAutoClockOutStatus();
    fetchAttendanceSettings();
    
    const interval = setInterval(fetchAutoClockOutStatus, 60000);
    return () => clearInterval(interval);
  }, [filterDate]);

  const filteredData = attendanceData.filter(record =>
    record.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    record.employee_id?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredData.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const handleDateChange = (e) => {
    setFilterDate(e.target.value);
    setCurrentPage(1);
  };

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  const getCurrentTime = () => {
    const now = new Date();
    return now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const getEmployeesWhoForgotToClockOut = () => {
    if (!autoClockOutStatus?.open_employees || !attendanceSettings) return [];
    
    const currentTime = getCurrentTime();
    const clockOutStart = attendanceSettings.clock_out_start || '17:00';
    
    const currentMinutes = (timeStr) => {
      const [hours, minutes] = timeStr.split(':');
      return parseInt(hours) * 60 + parseInt(minutes);
    };
    
    const currentTimeMinutes = currentMinutes(currentTime);
    const clockOutStartMinutes = currentMinutes(clockOutStart);
    
    if (currentTimeMinutes >= clockOutStartMinutes) {
      return autoClockOutStatus.open_employees;
    }
    
    return [];
  };

  const employeesWhoForgot = getEmployeesWhoForgotToClockOut();

  return (
    <div className="container-fluid p-4">
      <div className="mb-4">
        <div className="d-flex justify-content-between align-items-center">
          <div>
            <h4 className="fw-bold mb-1">Attendance Management</h4>
            <small className="text-muted">
              View and manage employee attendance records
            </small>
          </div>
          <Link to="/dashboard" className="btn btn-outline-primary btn-sm">
            <i className="bi bi-arrow-left me-1"></i> Back to Dashboard
          </Link>
        </div>
      </div>

      {autoClockOutStatus && attendanceSettings && (
        <div className="card border shadow-sm rounded-0 mb-4">
          <div className={`card-header ${employeesWhoForgot.length > 0 ? 'bg-warning' : 'bg-light'} fw-semibold rounded-0`}>
            <i className="bi bi-clock-history me-2"></i>
            Auto Clock-Out System
          </div>
          <div className="card-body">
            <div className="row">
              {/* Column 1: Forgot to Clock Out */}
              <div className="col-md-3 mb-3 mb-md-0 d-flex">
                <div className="text-center p-2 w-100 d-flex flex-column justify-content-center align-items-center">
                  <i className="bi bi-person-clock fs-4 text-warning"></i>
                  <div className="fw-bold fs-5 mt-1">{employeesWhoForgot.length || 0}</div>
                  <small className="text-muted">Forgot to Clock Out</small>
                </div>
              </div>
              
              {/* Column 2: Clock Out Start Time */}
              <div className="col-md-3 mb-3 mb-md-0 d-flex">
                <div className="text-center p-2 w-100 d-flex flex-column justify-content-center align-items-center">
                  <i className="bi bi-clock fs-4 text-primary"></i>
                  <div className="fw-bold fs-5 mt-1">{attendanceSettings.clock_out_start || '17:00'}</div>
                  <small className="text-muted">Clock Out Start Time</small>
                </div>
              </div>
              
              {/* Column 3: Auto Clock-Out Time */}
              <div className="col-md-3 mb-3 mb-md-0 d-flex">
                <div className="text-center p-2 w-100 d-flex flex-column justify-content-center align-items-center">
                  <i className="bi bi-hourglass-split fs-4 text-info"></i>
                  <div className="fw-bold fs-5 mt-1">{autoClockOutStatus.auto_clock_out_time || '22:00'}</div>
                  <small className="text-muted">Auto Clock-Out Time</small>
                </div>
              </div>
              
              {/* Column 4: Current Time */}
              <div className="col-md-3 mb-3 mb-md-0 d-flex">
                <div className="text-center p-2 w-100 d-flex flex-column justify-content-center align-items-center">
                  <i className="bi bi-clock-history fs-4 text-secondary"></i>
                  <div className="fw-bold fs-5 mt-1">{getCurrentTime()}</div>
                  <small className="text-muted">Current Time</small>
                </div>
              </div>
            </div>
            
            {/* Employees who forgot to clock out - only show if past clock_out_start */}
            {employeesWhoForgot.length > 0 && (
              <div className="mt-3">
                <small className="text-muted d-block mb-2">
                  <i className="bi bi-people me-1"></i>
                  Employees who haven't clocked out after {attendanceSettings.clock_out_start || '17:00'}:
                </small>
                <div className="d-flex flex-wrap gap-2">
                  {employeesWhoForgot.slice(0, 5).map((emp, idx) => (
                    <span key={idx} className="badge bg-secondary">
                      {emp.name} (Clocked in at {emp.clock_in_time})
                    </span>
                  ))}
                  {employeesWhoForgot.length > 5 && (
                    <span className="badge bg-info">
                      +{employeesWhoForgot.length - 5} more
                    </span>
                  )}
                </div>
                <small className="text-muted d-block mt-2">
                  <i className="bi bi-info-circle me-1"></i>
                  These employees will be auto clocked-out at {autoClockOutStatus.auto_clock_out_time || '22:00'}
                </small>
              </div>
            )}
            
            {employeesWhoForgot.length === 0 && autoClockOutStatus.open_records_count > 0 && (
              <div className="mt-3">
                <small className="text-muted d-block">
                  <i className="bi bi-info-circle me-1"></i>
                  {autoClockOutStatus.open_records_count} employee(s) haven't clocked out yet, but it's before {attendanceSettings.clock_out_start || '17:00'}
                </small>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Today's Summary Cards */}
      {todayStats && (
        <div className="row g-3 mb-4">
          <div className="col-12">
            <div className="card border shadow-sm rounded-0">
              <div className="card-header bg-light fw-semibold rounded-0">
                <i className="bi bi-calendar-check me-2"></i>
                Today's Summary ({new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })})
              </div>
              <div className="card-body">
                <div className="row">
                  <div className="col-md-3 text-center">
                    <div className="p-3">
                      <i className="bi bi-people fs-1 text-primary mb-2"></i>
                      <h5 className="fw-bold">{todayStats.stats?.total_today || "0"}</h5>
                      <small className="text-muted">Total Present</small>
                    </div>
                  </div>
                  <div className="col-md-3 text-center">
                    <div className="p-3">
                      <i className="bi bi-person-check fs-1 text-success mb-2"></i>
                      <h5 className="fw-bold">{todayStats.stats?.currently_in || "0"}</h5>
                      <small className="text-muted">Currently Working</small>
                    </div>
                  </div>
                  <div className="col-md-3 text-center">
                    <div className="p-3">
                      <i className="bi bi-person-x fs-1 text-danger mb-2"></i>
                      <h5 className="fw-bold">{todayStats.stats?.absent || "0"}</h5>
                      <small className="text-muted">Absent Today</small>
                    </div>
                  </div>
                  <div className="col-md-3 text-center">
                    <div className="p-3">
                      <i className="bi bi-clock-history fs-1 text-warning mb-2"></i>
                      <h5 className="fw-bold">{todayStats.stats?.clocked_out || "0"}</h5>
                      <small className="text-muted">Completed Shift</small>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters and Search */}
      <div className="card border shadow-sm rounded-0 mb-4">
        <div className="card-body">
          <div className="row g-3">
            <div className="col-md-6">
              <label className="form-label">Filter by Date</label>
              <input
                type="date"
                className="form-control"
                value={filterDate}
                onChange={handleDateChange}
              />
            </div>
            <div className="col-md-6">
              <label className="form-label">Search Employee</label>
              <div className="input-group">
                <span className="input-group-text">
                  <i className="bi bi-search"></i>
                </span>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Search by name or employee ID..."
                  value={searchTerm}
                  onChange={handleSearch}
                />
                {searchTerm && (
                  <button
                    className="btn btn-outline-secondary"
                    type="button"
                    onClick={() => setSearchTerm("")}
                  >
                    <i className="bi bi-x"></i>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Attendance Records Table */}
      <div className="card border shadow-sm rounded-0">
        <div className="card-header bg-light fw-semibold rounded-0 d-flex justify-content-between align-items-center">
          <span>
            <i className="bi bi-list-check me-2"></i>
            Attendance Records
            <small className="ms-2 text-muted">
              Showing {filteredData.length} records
            </small>
          </span>
          <button 
            className="btn btn-sm btn-outline-primary"
            onClick={fetchAttendanceData}
            disabled={loading}
          >
            <i className="bi bi-arrow-clockwise me-1"></i>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
        
        {loading ? (
          <div className="card-body text-center py-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <p className="mt-2">Loading attendance records...</p>
          </div>
        ) : filteredData.length === 0 ? (
          <div className="card-body text-center py-5">
            <i className="bi bi-calendar-x fs-1 text-muted mb-3"></i>
            <h5>No attendance records found</h5>
            <p className="text-muted">
              {searchTerm ? 'Try a different search term' : `No records for ${formatDate(filterDate)}`}
            </p>
          </div>
        ) : (
          <>
            <div className="card-body">
              <div className="table-responsive">
                <table className="table table-hover table-sm">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Employee</th>
                      <th>Date</th>
                      <th>Clock In</th>
                      <th>Clock Out</th>
                      <th>Status</th>
                      <th>Duration</th>
                      <th>Sync Status</th>
                      <th>Auto Clock-Out</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentItems.map((record, index) => {
                      // Calculate duration
                      let duration = "N/A";
                      if (record.clock_in_time && record.clock_out_time) {
                        const inTime = new Date(`${record.date}T${record.clock_in_time}`);
                        const outTime = new Date(`${record.date}T${record.clock_out_time}`);
                        const diffMs = outTime - inTime;
                        const hours = Math.floor(diffMs / (1000 * 60 * 60));
                        const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                        duration = `${hours}h ${minutes}m`;
                      }

                      return (
                        <tr key={record._id || index}>
                          <td>{indexOfFirstItem + index + 1}</td>
                          <td>
                            <div className="d-flex align-items-center">
                              <i className="bi bi-person-circle me-2 text-muted"></i>
                              <div>
                                <div className="fw-semibold">{record.name}</div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className="badge bg-secondary">
                              {formatDate(record.date)}
                            </span>
                          </td>
                          <td>
                            <span className="badge bg-success">
                              {record.clock_in_time || 'N/A'}
                            </span>
                          </td>
                          <td>
                            {record.clock_out_time ? (
                              <span className={`badge ${record.auto_clocked_out ? 'bg-info' : 'bg-danger'}`}>
                                {record.clock_out_time}
                                {record.auto_clocked_out && (
                                  <small className="ms-1">(Auto)</small>
                                )}
                              </span>
                            ) : (
                              <span className="badge bg-warning">Still In</span>
                            )}
                          </td>
                          <td>
                            {record.clock_out_time ? (
                              <span className="badge bg-success">Completed</span>
                            ) : (
                              <span className="badge bg-warning">Working</span>
                            )}
                          </td>
                          <td>
                            <small>{duration}</small>
                          </td>
                          <td>
                            <span className={`badge ${
                              record.sync_status === 'synced' ? 'bg-success' : 
                              record.sync_status === 'pending' ? 'bg-warning' : 'bg-secondary'
                            }`}>
                              {record.sync_status || 'unknown'}
                            </span>
                          </td>
                          <td>
                            {record.auto_clocked_out && (
                              <span className="badge bg-info" title={record.auto_clock_out_reason}>
                                <i className="bi bi-clock-history me-1"></i>
                                Auto
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="card-footer">
                <nav aria-label="Attendance pagination">
                  <ul className="pagination justify-content-center mb-0">
                    <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
                      <button
                        className="page-link"
                        onClick={() => setCurrentPage(currentPage - 1)}
                        disabled={currentPage === 1}
                      >
                        <i className="bi bi-chevron-left"></i>
                      </button>
                    </li>
                    
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter(page => 
                        page === 1 || 
                        page === totalPages || 
                        (page >= currentPage - 2 && page <= currentPage + 2)
                      )
                      .map((page, index, array) => {
                        if (index > 0 && page - array[index - 1] > 1) {
                          return [
                            <li key={`ellipsis-${page}`} className="page-item disabled">
                              <span className="page-link">...</span>
                            </li>,
                            <li key={page} className={`page-item ${currentPage === page ? 'active' : ''}`}>
                              <button className="page-link" onClick={() => setCurrentPage(page)}>
                                {page}
                              </button>
                            </li>
                          ];
                        }
                        return (
                          <li key={page} className={`page-item ${currentPage === page ? 'active' : ''}`}>
                            <button className="page-link" onClick={() => setCurrentPage(page)}>
                              {page}
                            </button>
                          </li>
                        );
                      })}
                    
                    <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
                      <button
                        className="page-link"
                        onClick={() => setCurrentPage(currentPage + 1)}
                        disabled={currentPage === totalPages}
                      >
                        <i className="bi bi-chevron-right"></i>
                      </button>
                    </li>
                  </ul>
                  <div className="text-center mt-2">
                    <small className="text-muted">
                      Page {currentPage} of {totalPages} • Showing {currentItems.length} of {filteredData.length} records
                    </small>
                  </div>
                </nav>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

const styles = `
  .table th {
    font-weight: 600;
    background-color: #f8f9fa;
    border-bottom: 2px solid #dee2e6;
  }
  
  .table tbody tr:hover {
    background-color: #f5f5f5;
  }
  
  .badge {
    font-weight: 500;
    padding: 0.35em 0.65em;
  }
  
  .page-item.active .page-link {
    background-color: #0d6efd;
    border-color: #0d6efd;
  }
`;

// Add styles to the document
const styleSheet = document.createElement("style");
styleSheet.innerText = styles;
document.head.appendChild(styleSheet);

export default Attendance;