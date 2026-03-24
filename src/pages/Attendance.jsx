import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getMongoDBAttendance, getTodayMongoDBAttendance } from "../services/api";
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

  useEffect(() => {
    fetchAttendanceData();
  }, [filterDate]);

  // Filter attendance data based on search term
  const filteredData = attendanceData.filter(record =>
    record.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    record.employee_id?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredData.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);

  // Format date for display
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  // Handle date filter change
  const handleDateChange = (e) => {
    setFilterDate(e.target.value);
    setCurrentPage(1); // Reset to first page when filter changes
  };

  // Handle search
  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1); // Reset to first page when search changes
  };

  return (
    <div className="container-fluid p-4">
      {/* Page Title */}
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
                              <span className="badge bg-danger">
                                {record.clock_out_time}
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
                        // Add ellipsis
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

// Add some custom CSS
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