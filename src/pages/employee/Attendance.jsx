import React, { useState, useEffect } from "react";
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const AttendancePage = () => {
  const [loading, setLoading] = useState(true);
  const [employee, setEmployee] = useState({
    name: "",
    employeeId: "",
    department: "",
  });
  
  const [summary, setSummary] = useState({
    avgWorkingHour: "0:00",
    avgTimeIn: "--:--",
    avgTimeOut: "--:--",
    avgBreakTime: "0:00",
  });

  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const recordsPerPage = 10;

  useEffect(() => {
    fetchEmployeeData();
    fetchAttendanceRecords();
  }, [currentPage]);

  const fetchEmployeeData = async () => {
    try {
      // Get employee from localStorage
      const employeeData = localStorage.getItem('employee');
      if (employeeData) {
        const parsed = JSON.parse(employeeData);
        setEmployee({
          name: parsed.name || 'Unknown',
          employeeId: parsed.employee_id || 'N/A',
          department: parsed.department || 'Not Assigned',
        });
      }
    } catch (error) {
      console.error('Error fetching employee data:', error);
    }
  };

  const fetchAttendanceRecords = async () => {
    setLoading(true);
    try {
      const employeeData = JSON.parse(localStorage.getItem('employee'));
      if (!employeeData || !employeeData.name) {
        setLoading(false);
        return;
      }

      // Fetch attendance records from MongoDB
      const response = await fetch(`${API_URL}/api/attendance/employee/${encodeURIComponent(employeeData.name)}`);
      const data = await response.json();

      if (data.success) {
        // Sort records by date (newest first)
        const sortedRecords = data.records.sort((a, b) => 
          new Date(b.date) - new Date(a.date)
        );

        setAttendanceRecords(sortedRecords);
        calculateSummary(sortedRecords);
        setTotalPages(Math.ceil(sortedRecords.length / recordsPerPage));
      } else {
        console.error('Failed to fetch attendance:', data.message);
        // Fallback to empty array
        setAttendanceRecords([]);
      }
    } catch (error) {
      console.error('Error fetching attendance:', error);
      setAttendanceRecords([]);
    } finally {
      setLoading(false);
    }
  };

  const calculateSummary = (records) => {
    if (!records || records.length === 0) {
      setSummary({
        avgWorkingHour: "0:00",
        avgTimeIn: "--:--",
        avgTimeOut: "--:--",
        avgBreakTime: "0:00",
      });
      return;
    }

    let totalWorkingSeconds = 0;
    let totalTimeInMinutes = 0;
    let totalTimeOutMinutes = 0;
    let validRecords = 0;

    records.forEach(record => {
      if (record.clock_in_time && record.clock_out_time) {
        // Calculate working hours
        const timeIn = record.clock_in_time;
        const timeOut = record.clock_out_time;
        
        const [inHours, inMinutes, inSeconds] = timeIn.split(':').map(Number);
        const [outHours, outMinutes, outSeconds] = timeOut.split(':').map(Number);
        
        const inTotalSeconds = inHours * 3600 + inMinutes * 60 + (inSeconds || 0);
        const outTotalSeconds = outHours * 3600 + outMinutes * 60 + (outSeconds || 0);
        
        let workingSeconds = outTotalSeconds - inTotalSeconds;
        if (workingSeconds < 0) workingSeconds += 24 * 3600; // Handle overnight
        
        totalWorkingSeconds += workingSeconds;
        
        // Average time in/out (convert to minutes for calculation)
        totalTimeInMinutes += inHours * 60 + inMinutes;
        totalTimeOutMinutes += outHours * 60 + outMinutes;
        
        validRecords++;
      }
    });

    if (validRecords > 0) {
      // Average working hours
      const avgSeconds = totalWorkingSeconds / validRecords;
      const avgHours = Math.floor(avgSeconds / 3600);
      const avgMinutes = Math.floor((avgSeconds % 3600) / 60);
      
      // Average time in
      const avgTimeInMinutes = Math.floor(totalTimeInMinutes / validRecords);
      const avgInHours = Math.floor(avgTimeInMinutes / 60);
      const avgInMins = avgTimeInMinutes % 60;
      const avgInPeriod = avgInHours >= 12 ? 'PM' : 'AM';
      const avgInDisplayHours = avgInHours > 12 ? avgInHours - 12 : avgInHours;
      
      // Average time out
      const avgTimeOutMinutes = Math.floor(totalTimeOutMinutes / validRecords);
      const avgOutHours = Math.floor(avgTimeOutMinutes / 60);
      const avgOutMins = avgTimeOutMinutes % 60;
      const avgOutPeriod = avgOutHours >= 12 ? 'PM' : 'AM';
      const avgOutDisplayHours = avgOutHours > 12 ? avgOutHours - 12 : avgOutHours;

      setSummary({
        avgWorkingHour: `${avgHours}:${avgMinutes.toString().padStart(2, '0')}`,
        avgTimeIn: `${avgInDisplayHours}:${avgInMins.toString().padStart(2, '0')}${avgInPeriod}`,
        avgTimeOut: `${avgOutDisplayHours}:${avgOutMins.toString().padStart(2, '0')}${avgOutPeriod}`,
        avgBreakTime: "1:00", // Default break time, can be calculated if you have break data
      });
    }
  };

  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  const formatTime = (timeString) => {
    if (!timeString) return '--:--';
    
    const [hours, minutes, seconds] = timeString.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours > 12 ? hours - 12 : hours;
    return `${displayHours}:${minutes.toString().padStart(2, '0')}${period}`;
  };

  // Get current page records
  const indexOfLastRecord = currentPage * recordsPerPage;
  const indexOfFirstRecord = indexOfLastRecord - recordsPerPage;
  const currentRecords = attendanceRecords.slice(indexOfFirstRecord, indexOfLastRecord);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  if (loading) {
    return (
      <div className="container my-5 text-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <p className="mt-2">Loading attendance records...</p>
      </div>
    );
  }

  return (
    <div className="container my-3">

      <h4 className="fw-bold mb-3">
        <i className="bi bi-calendar-check me-2"></i>
        My Attendance
      </h4>

      {/* Single Employee Info Card - One Line */}
      <div className="row mb-3">
        <div className="col-12">
          <div className="card p-3">
            <div className="d-flex align-items-center flex-wrap gap-3">
              <i className="bi bi-person-circle fs-1 text-primary"></i>
              <div className="d-flex flex-wrap gap-3 align-items-center">
                <div>
                  <span className="fw-bold fs-5">{employee.name}</span>
                </div>
                <div className="text-muted">
                  <i className="bi bi-person-badge me-1"></i>
                  {employee.employeeId}
                </div>
                <div className="text-muted">
                  <i className="bi bi-building me-1"></i>
                  {employee.department}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="row mb-3 g-2">
        <div className="col-6 col-md-3">
          <div className="card p-2 text-center h-100">
            <i className="bi bi-clock-history fs-3 mb-1 text-primary"></i>
            <div className="fw-bold fs-5">{summary.avgWorkingHour}</div>
            <small className="text-muted">Average Working Hours</small>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="card p-2 text-center h-100">
            <i className="bi bi-box-arrow-in-right fs-3 mb-1 text-success"></i>
            <div className="fw-bold fs-5">{summary.avgTimeIn}</div>
            <small className="text-muted">Average Time In</small>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="card p-2 text-center h-100">
            <i className="bi bi-box-arrow-right fs-3 mb-1 text-danger"></i>
            <div className="fw-bold fs-5">{summary.avgTimeOut}</div>
            <small className="text-muted">Average Time Out</small>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="card p-2 text-center h-100">
            <i className="bi bi-cup-hot fs-3 mb-1 text-warning"></i>
            <div className="fw-bold fs-5">{summary.avgBreakTime}</div>
            <small className="text-muted">Average Break Time</small>
          </div>
        </div>
      </div>

      {/* Attendance Table */}
      <div className="card shadow-sm">
        <div className="card-header bg-white d-flex justify-content-between align-items-center">
          <h6 className="mb-0 fw-bold">
            <i className="bi bi-table me-2"></i>
            Attendance History
          </h6>
          <span className="badge bg-primary">{attendanceRecords.length} Records</span>
        </div>
        <div className="card-body p-0">
          {attendanceRecords.length > 0 ? (
            <>
              <div className="table-responsive">
                <table className="table table-hover mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Date</th>
                      <th>Time In</th>
                      <th>Time Out</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentRecords.map((record, idx) => {
                      const hasClockOut = record.clock_out_time && record.clock_out_time !== '';
                      return (
                        <tr key={idx}>
                          <td>
                            <i className="bi bi-calendar3 me-2 text-muted"></i>
                            {formatDate(record.date)}
                          </td>
                          <td>
                            <i className="bi bi-box-arrow-in-right me-2 text-success"></i>
                            {formatTime(record.clock_in_time)}
                          </td>
                          <td>
                            <i className="bi bi-box-arrow-right me-2 text-danger"></i>
                            {hasClockOut ? formatTime(record.clock_out_time) : '--:--'}
                          </td>
                          <td>
                            {hasClockOut ? (
                              <span className="badge bg-success">
                                <i className="bi bi-check-circle me-1"></i>Present
                              </span>
                            ) : record.clock_in_time ? (
                              <span className="badge bg-warning text-dark">
                                <i className="bi bi-clock me-1"></i>Ongoing
                              </span>
                            ) : (
                              <span className="badge bg-danger">
                                <i className="bi bi-x-circle me-1"></i>Absent
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="d-flex justify-content-end p-3">
                  <nav>
                    <ul className="pagination pagination-sm mb-0">
                      <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
                        <button 
                          className="page-link" 
                          onClick={() => paginate(currentPage - 1)}
                          disabled={currentPage === 1}
                        >
                          &laquo;
                        </button>
                      </li>
                      {[...Array(totalPages).keys()].map(num => (
                        <li key={num + 1} className={`page-item ${currentPage === num + 1 ? 'active' : ''}`}>
                          <button 
                            className="page-link" 
                            onClick={() => paginate(num + 1)}
                          >
                            {num + 1}
                          </button>
                        </li>
                      ))}
                      <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
                        <button 
                          className="page-link" 
                          onClick={() => paginate(currentPage + 1)}
                          disabled={currentPage === totalPages}
                        >
                          &raquo;
                        </button>
                      </li>
                    </ul>
                  </nav>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-5">
              <i className="bi bi-calendar-x fs-1 text-muted"></i>
              <p className="mt-3 text-muted">No attendance records found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AttendancePage;