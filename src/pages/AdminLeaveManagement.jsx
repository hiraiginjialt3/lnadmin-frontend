import React, { useState, useEffect } from "react";
import API from "../services/api";

const AdminLeaveManagement = () => {
  const [activeTab, setActiveTab] = useState('employees');
  const [employees, setEmployees] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [processing, setProcessing] = useState(false);
  const [stats, setStats] = useState({
    pending: 0,
    approved: 0,
    denied: 0,
    total: 0
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [error, setError] = useState(null);
  
  // Edit Balance Modal State
  const [editBalanceModal, setEditBalanceModal] = useState({
    show: false,
    employee_id: null,
    employee_name: null,
    employee_email: null,
    personal_leave: 5,
    sick_leave: 5,
    emergency_leave: 5,
    new_personal: 5,
    new_sick: 5,
    new_emergency: 5
  });

  useEffect(() => {
    if (activeTab === 'employees') {
      fetchEmployees();
    } else {
      fetchLeaveRequests();
      fetchStats();
    }
  }, [activeTab, filter]);

  const fetchEmployees = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log("Fetching from /api/employee-credentials");
      const response = await API.get("/employee-credentials");
      console.log("Employees response:", response.data);
      
      if (response.data.success) {
        const employeesList = response.data.employees || [];
        
        // Fetch leave balances for each employee
        const employeesWithBalances = await Promise.all(
          employeesList.map(async (emp) => {
            try {
              const balanceResponse = await API.get(`/leave/balance/${emp.employee_id}`);
              if (balanceResponse.data.success) {
                return {
                  ...emp,
                  personal_leave: balanceResponse.data.balances.personal_leave,
                  sick_leave: balanceResponse.data.balances.sick_leave,
                  emergency_leave: balanceResponse.data.balances.emergency_leave
                };
              }
            } catch (error) {
              console.log(`No balance found for ${emp.employee_id}, using defaults`);
            }
            return {
              ...emp,
              personal_leave: 5,
              sick_leave: 5,
              emergency_leave: 5
            };
          })
        );
        
        setEmployees(employeesWithBalances);
      } else {
        setError(response.data.message || "Failed to fetch employees");
      }
    } catch (error) {
      console.error("Error fetching employees:", error);
      setError(`Failed to fetch employees: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchLeaveRequests = async () => {
    setLoading(true);
    setError(null);
    try {
      let url = `/leave/requests`;
      
      if (filter !== 'all') {
        url += `?status=${filter}`;
      }
      
      console.log("Fetching leave requests from:", url);
      const response = await API.get(url);
      console.log("Leave requests response:", response.data);
      
      if (response.data.success) {
        setLeaveRequests(response.data.requests || []);
      } else {
        setError(response.data.message || "Failed to fetch leave requests");
      }
    } catch (error) {
      console.error("Error fetching leave requests:", error);
      setError(error.response?.data?.message || error.message || "Error fetching leave requests");
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const url = `/leave/stats`;
      console.log("Fetching stats from:", url);
      const response = await API.get(url);
      console.log("Stats response:", response.data);
      
      if (response.data.success) {
        setStats(response.data.stats || {
          pending: 0,
          approved: 0,
          denied: 0,
          total: 0
        });
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const handleEditAllBalances = async () => {
    setProcessing(true);
    let successCount = 0;
    let errorCount = 0;
    let results = [];
    
    try {
      // Update Personal Leave
      if (editBalanceModal.new_personal !== editBalanceModal.personal_leave) {
        try {
          const response = await API.post("/leave/admin/edit-balance", {
            employee_id: editBalanceModal.employee_id,
            leave_type: 'personal',
            new_balance: editBalanceModal.new_personal,
            reason: 'Admin bulk edit'
          });
          if (response.data.success) {
            successCount++;
            results.push(`Personal: ${editBalanceModal.personal_leave} → ${editBalanceModal.new_personal}`);
          }
        } catch (error) {
          errorCount++;
          console.error("Error updating personal leave:", error);
          results.push(`Personal: Failed`);
        }
      }
      
      // Update Sick Leave
      if (editBalanceModal.new_sick !== editBalanceModal.sick_leave) {
        try {
          const response = await API.post("/leave/admin/edit-balance", {
            employee_id: editBalanceModal.employee_id,
            leave_type: 'sick',
            new_balance: editBalanceModal.new_sick,
            reason: 'Admin bulk edit'
          });
          if (response.data.success) {
            successCount++;
            results.push(`Sick: ${editBalanceModal.sick_leave} → ${editBalanceModal.new_sick}`);
          }
        } catch (error) {
          errorCount++;
          console.error("Error updating sick leave:", error);
          results.push(`Sick: Failed`);
        }
      }
      
      // Update Emergency Leave
      if (editBalanceModal.new_emergency !== editBalanceModal.emergency_leave) {
        try {
          const response = await API.post("/leave/admin/edit-balance", {
            employee_id: editBalanceModal.employee_id,
            leave_type: 'emergency',
            new_balance: editBalanceModal.new_emergency,
            reason: 'Admin bulk edit'
          });
          if (response.data.success) {
            successCount++;
            results.push(`Emergency: ${editBalanceModal.emergency_leave} → ${editBalanceModal.new_emergency}`);
          }
        } catch (error) {
          errorCount++;
          console.error("Error updating emergency leave:", error);
          results.push(`Emergency: Failed`);
        }
      }
      
      if (successCount > 0) {
        alert(`✅ Successfully updated ${successCount} leave balance(s)\n${results.join('\n')}` + (errorCount > 0 ? `\n❌ ${errorCount} failed` : ''));
      } else if (errorCount > 0) {
        alert(`❌ Failed to update ${errorCount} leave balance(s)`);
      } else {
        alert('No changes were made');
      }
      
      setEditBalanceModal({...editBalanceModal, show: false});
      fetchEmployees();
      
    } catch (error) {
      console.error('Error in bulk update:', error);
      alert(`❌ Error updating balances: ${error.message}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleApproveRequest = async (requestId) => {
    setProcessing(true);
    setError(null);
    try {
      const url = `/leave/approve/${requestId}`;
      console.log(`Approving request ${requestId}`);
      
      const response = await API.post(url, {
        admin_notes: adminNotes
      });

      console.log("Approve response:", response.data);

      if (response.data.success) {
        alert(`✅ ${response.data.message}`);
        setSelectedRequest(null);
        setAdminNotes('');
        
        await fetchLeaveRequests();
        await fetchStats();
      }
    } catch (error) {
      console.error("Error approving request:", error);
      alert(`❌ ${error.response?.data?.message || error.message || "Error approving request"}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleDenyRequest = async (requestId) => {
    setProcessing(true);
    setError(null);
    try {
      const url = `/leave/deny/${requestId}`;
      console.log(`Denying request ${requestId}`);
      
      const response = await API.post(url, {
        admin_notes: adminNotes
      });

      console.log("Deny response:", response.data);

      if (response.data.success) {
        alert(`✅ ${response.data.message}`);
        setSelectedRequest(null);
        setAdminNotes('');
        
        await fetchLeaveRequests();
        await fetchStats();
      }
    } catch (error) {
      console.error("Error denying request:", error);
      alert(`❌ ${error.response?.data?.message || error.message || "Error denying request"}`);
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (status) => {
    switch(status?.toLowerCase()) {
      case 'approved':
        return <span className="badge bg-success">Approved</span>;
      case 'pending':
        return <span className="badge bg-warning text-dark">Pending</span>;
      case 'denied':
        return <span className="badge bg-danger">Denied</span>;
      default:
        return <span className="badge bg-secondary">{status || 'Unknown'}</span>;
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString();
    } catch (e) {
      return dateString;
    }
  };

  // Filter employees based on search
  const filteredEmployees = employees.filter(emp => {
    return searchTerm === '' || 
      (emp.name && emp.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (emp.employee_id && emp.employee_id.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (emp.department && emp.department.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (emp.email && emp.email.toLowerCase().includes(searchTerm.toLowerCase()));
  });

  // Filter requests based on search and date range
  const filteredRequests = leaveRequests.filter(request => {
    const matchesSearch = searchTerm === '' || 
      (request.employee_name && request.employee_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (request.employee_id && request.employee_id.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (request.leave_type && request.leave_type.toLowerCase().includes(searchTerm.toLowerCase()));
    
    let matchesDateRange = true;
    if (dateRange.start && dateRange.end && request.start_date) {
      matchesDateRange = request.start_date >= dateRange.start && request.start_date <= dateRange.end;
    }
    
    return matchesSearch && matchesDateRange;
  });

  return (
    <div className="container-fluid my-4">
      <div className="d-flex justify-content-between align-items-center">
        <h4 className="fw-bold mb-1">Leave Management</h4>
        <button 
          className="btn btn-primary"
          onClick={activeTab === 'employees' ? fetchEmployees : fetchLeaveRequests}
          disabled={loading}
        >
          <i className="bi bi-arrow-repeat me-2"></i>
          Refresh
        </button>
      </div>

      {/* Tab Navigation */}
      <ul className="nav nav-tabs mb-4">
        <li className="nav-item">
          <button 
            className={`nav-link ${activeTab === 'employees' ? 'active fw-bold' : ''}`}
            onClick={() => setActiveTab('employees')}
          >
            <i className="bi bi-people me-2"></i>
            Employees ({employees.length})
          </button>
        </li>
        <li className="nav-item">
          <button 
            className={`nav-link ${activeTab === 'requests' ? 'active fw-bold' : ''}`}
            onClick={() => setActiveTab('requests')}
          >
            <i className="bi bi-calendar-check me-2"></i>
            Leave Requests ({stats.total})
          </button>
        </li>
      </ul>

      {/* Connection Status */}
      <div className="alert alert-info mb-4">
        <i className="bi bi-info-circle-fill me-2"></i>
        Connected to server: {API.defaults.baseURL}
        {activeTab === 'requests' && stats.total > 0 && (
          <> | 
            <strong className="ms-2">Pending: {stats.pending}</strong> | 
            <strong className="ms-2">Approved: {stats.approved}</strong> | 
            <strong className="ms-2">Denied: {stats.denied}</strong>
          </>
        )}
      </div>

      {/* Error Alert */}
      {error && (
        <div className="alert alert-danger alert-dismissible fade show mb-4" role="alert">
          <i className="bi bi-exclamation-triangle-fill me-2"></i>
          {error}
          <button 
            type="button" 
            className="btn-close" 
            onClick={() => setError(null)}
          ></button>
        </div>
      )}

      {/* Search Bar */}
      <div className="card shadow-sm mb-4">
        <div className="card-body">
          <div className="row">
            <div className="col-md-12">
              <input
                type="text"
                className="form-control"
                placeholder={activeTab === 'employees' 
                  ? "Search employees by name, ID, email, or department..." 
                  : "Search requests by name, ID, or leave type..."}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Employees Tab */}
      {activeTab === 'employees' && (
        <div className="card shadow-sm">
          <div className="card-header bg-primary text-white d-flex justify-content-between align-items-center">
            <h5 className="mb-0">Employee Leave Balances</h5>
            <span className="badge bg-light text-dark">Total: {employees.length}</span>
          </div>
          <div className="card-body">
            {loading ? (
              <div className="text-center py-5">
                <div className="spinner-border text-primary" role="status" style={{width: '3rem', height: '3rem'}}>
                  <span className="visually-hidden">Loading...</span>
                </div>
                <p className="mt-3">Loading employees from Employee_credentials...</p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table table-hover table-striped">
                  <thead className="table-dark" style={{ color: '#000' }}>
                    <tr>
                      <th style={{ color: '#000' }}>Employee</th>
                      <th style={{ color: '#000' }}>Department</th>
                      <th style={{ color: '#000' }}>Personal Leave</th>
                      <th style={{ color: '#000' }}>Sick Leave</th>
                      <th style={{ color: '#000' }}>Emergency Leave</th>
                      <th style={{ color: '#000' }}>Total</th>
                      <th style={{ color: '#000' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEmployees.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="text-center py-4">
                          <i className="bi bi-inbox fs-1 d-block mb-3 text-muted"></i>
                          {searchTerm ? 'No employees match your search' : 'No employees found in Employee_credentials'}
                        </td>
                      </tr>
                    ) : (
                      filteredEmployees.map((emp) => {
                        const total = (emp.personal_leave || 0) + (emp.sick_leave || 0) + (emp.emergency_leave || 0);
                        return (
                          <tr key={emp.employee_id}>
                            <td>
                              <strong>{emp.name || 'Unknown'}</strong>
                              <br />
                              <small className="text-muted">{emp.employee_id}</small>
                              {emp.email && (
                                <>
                                  <br />
                                  <small className="text-muted">{emp.email}</small>
                                </>
                              )}
                            </td>
                            <td>{emp.department || 'N/A'}</td>
                            <td>
                              <span className={`badge fs-6 p-2 ${emp.personal_leave < 2 ? 'bg-danger' : 'bg-info'}`}>
                                {emp.personal_leave || 5} 
                              </span>
                            </td>
                            <td>
                              <span className={`badge fs-6 p-2 ${emp.sick_leave < 2 ? 'bg-danger' : 'bg-info'}`}>
                                {emp.sick_leave || 5} 
                              </span>
                            </td>
                            <td>
                              <span className={`badge fs-6 p-2 ${emp.emergency_leave < 2 ? 'bg-danger' : 'bg-info'}`}>
                                {emp.emergency_leave || 5}
                              </span>
                            </td>
                            <td>
                              <span className="badge bg-secondary fs-6 p-2">
                                {total} / 15
                              </span>
                            </td>
                            <td>
                              <button 
                                className="btn btn-sm btn-outline-primary"
                                onClick={() => {
                                  setEditBalanceModal({
                                    show: true,
                                    employee_id: emp.employee_id,
                                    employee_name: emp.name,
                                    employee_email: emp.email,
                                    personal_leave: emp.personal_leave || 5,
                                    sick_leave: emp.sick_leave || 5,
                                    emergency_leave: emp.emergency_leave || 5,
                                    new_personal: emp.personal_leave || 5,
                                    new_sick: emp.sick_leave || 5,
                                    new_emergency: emp.emergency_leave || 5
                                  });
                                }}
                              >
                                <i className="bi bi-pencil-square"></i> Edit All Balances
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Leave Requests Tab */}
      {activeTab === 'requests' && (
        <>
          {/* Statistics Cards */}
          <div className="row mb-4">
            <div className="col-md-3 mb-3">
              <div 
                className="card bg-warning text-white h-100" 
                style={{ cursor: 'pointer' }} 
                onClick={() => setFilter('pending')}
              >
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-center">
                    <div>
                      <h6 className="card-title">Pending Requests</h6>
                      <h2 className="mb-0">{stats.pending}</h2>
                    </div>
                    <i className="bi bi-clock-history fs-1"></i>
                  </div>
                </div>
              </div>
            </div>
            <div className="col-md-3 mb-3">
              <div 
                className="card bg-success text-white h-100" 
                style={{ cursor: 'pointer' }} 
                onClick={() => setFilter('approved')}
              >
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-center">
                    <div>
                      <h6 className="card-title">Approved</h6>
                      <h2 className="mb-0">{stats.approved}</h2>
                    </div>
                    <i className="bi bi-check-circle fs-1"></i>
                  </div>
                </div>
              </div>
            </div>
            <div className="col-md-3 mb-3">
              <div 
                className="card bg-danger text-white h-100" 
                style={{ cursor: 'pointer' }} 
                onClick={() => setFilter('denied')}
              >
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-center">
                    <div>
                      <h6 className="card-title">Denied</h6>
                      <h2 className="mb-0">{stats.denied}</h2>
                    </div>
                    <i className="bi bi-x-circle fs-1"></i>
                  </div>
                </div>
              </div>
            </div>
            <div className="col-md-3 mb-3">
              <div 
                className="card bg-info text-white h-100" 
                style={{ cursor: 'pointer' }} 
                onClick={() => setFilter('all')}
              >
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-center">
                    <div>
                      <h6 className="card-title">Total</h6>
                      <h2 className="mb-0">{stats.total}</h2>
                    </div>
                    <i className="bi bi-calendar-check fs-1"></i>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Filter Buttons */}
          <div className="card shadow-sm mb-4">
            <div className="card-body">
              <div className="row">
                <div className="col-md-12">
                  <div className="btn-group" role="group">
                    <button 
                      className={`btn ${filter === 'pending' ? 'btn-primary' : 'btn-outline-primary'}`}
                      onClick={() => setFilter('pending')}
                    >
                      Pending <span className="badge bg-light text-dark ms-1">{stats.pending}</span>
                    </button>
                    <button 
                      className={`btn ${filter === 'approved' ? 'btn-primary' : 'btn-outline-primary'}`}
                      onClick={() => setFilter('approved')}
                    >
                      Approved <span className="badge bg-light text-dark ms-1">{stats.approved}</span>
                    </button>
                    <button 
                      className={`btn ${filter === 'denied' ? 'btn-primary' : 'btn-outline-primary'}`}
                      onClick={() => setFilter('denied')}
                    >
                      Denied <span className="badge bg-light text-dark ms-1">{stats.denied}</span>
                    </button>
                    <button 
                      className={`btn ${filter === 'all' ? 'btn-primary' : 'btn-outline-primary'}`}
                      onClick={() => setFilter('all')}
                    >
                      All <span className="badge bg-light text-dark ms-1">{stats.total}</span>
                    </button>
                  </div>
                </div>
              </div>
              
              {/* Date Range Filter */}
              <div className="row mt-3">
                <div className="col-md-3">
                  <label className="form-label">Date From</label>
                  <input
                    type="date"
                    className="form-control"
                    value={dateRange.start}
                    onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
                  />
                </div>
                <div className="col-md-3">
                  <label className="form-label">Date To</label>
                  <input
                    type="date"
                    className="form-control"
                    value={dateRange.end}
                    onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
                  />
                </div>
                <div className="col-md-6 d-flex align-items-end">
                  <button 
                    className="btn btn-outline-secondary me-2"
                    onClick={() => setDateRange({ start: '', end: '' })}
                  >
                    Clear
                  </button>
                  <span className="text-muted">
                    Showing {filteredRequests.length} of {leaveRequests.length} requests
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Leave Requests Table */}
          <div className="card shadow-sm">
            <div className="card-body">
              {loading ? (
                <div className="text-center py-5">
                  <div className="spinner-border text-primary" role="status" style={{width: '3rem', height: '3rem'}}>
                    <span className="visually-hidden">Loading...</span>
                  </div>
                  <p className="mt-3">Loading leave requests...</p>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-hover table-striped">
                    <thead className="table-dark">
                      <tr>
                        <th>Employee</th>
                        <th>Department</th>
                        <th>Leave Type</th>
                        <th>Date Range</th>
                        <th>Duration</th>
                        <th>Reason</th>
                        <th>Status</th>
                        <th>Submitted</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRequests.length === 0 ? (
                        <tr>
                          <td colSpan="9" className="text-center py-4">
                            <i className="bi bi-inbox fs-1 d-block mb-3 text-muted"></i>
                            No leave requests found
                          </td>
                        </tr>
                      ) : (
                        filteredRequests.map((request) => (
                          <tr key={request._id} className={selectedRequest?._id === request._id ? 'table-primary' : ''}>
                            <td>
                              <strong>{request.employee_name || 'N/A'}</strong>
                              <br />
                              <small className="text-muted">{request.employee_id || 'N/A'}</small>
                              {request.employee_email && (
                                <>
                                  <br />
                                  <small className="text-muted">{request.employee_email}</small>
                                </>
                              )}
                            </td>
                            <td>{request.department || 'N/A'}</td>
                            <td>{request.leave_type || 'N/A'}</td>
                            <td>
                              {formatDate(request.start_date)}
                              {request.end_date && request.end_date !== request.start_date && 
                                <><br />to {formatDate(request.end_date)}</>
                              }
                            </td>
                            <td>
                              <span className="badge bg-secondary">
                                {request.duration || 1} day{request.duration > 1 ? 's' : ''}
                              </span>
                            </td>
                            <td>{request.reason || '-'}</td>
                            <td>{getStatusBadge(request.status)}</td>
                            <td>{formatDate(request.submitted_at)}</td>
                            <td>
                              {request.status === 'Pending' ? (
                                selectedRequest?._id === request._id ? (
                                  <div className="d-flex flex-column gap-2" style={{ minWidth: '200px' }}>
                                    <textarea
                                      className="form-control form-control-sm"
                                      rows="2"
                                      placeholder="Admin notes..."
                                      value={adminNotes}
                                      onChange={(e) => setAdminNotes(e.target.value)}
                                    />
                                    <div className="d-flex gap-2">
                                      <button 
                                        className="btn btn-sm btn-success flex-grow-1"
                                        onClick={() => handleApproveRequest(request._id)}
                                        disabled={processing}
                                      >
                                        {processing ? '...' : '✓ Approve'}
                                      </button>
                                      <button 
                                        className="btn btn-sm btn-danger flex-grow-1"
                                        onClick={() => handleDenyRequest(request._id)}
                                        disabled={processing}
                                      >
                                        {processing ? '...' : '✗ Deny'}
                                      </button>
                                      <button 
                                        className="btn btn-sm btn-secondary"
                                        onClick={() => {
                                          setSelectedRequest(null);
                                          setAdminNotes('');
                                        }}
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <button 
                                    className="btn btn-sm btn-primary"
                                    onClick={() => {
                                      setSelectedRequest(request);
                                      setAdminNotes('');
                                    }}
                                  >
                                    <i className="bi bi-pencil me-1"></i> Process
                                  </button>
                                )
                              ) : (
                                <div className="d-flex flex-column gap-1">
                                  <small className="text-muted">
                                    {request.processed_by && `by ${request.processed_by}`}
                                  </small>
                                  <button 
                                    className="btn btn-sm btn-outline-primary mt-1"
                                    onClick={async () => {
                                      try {
                                        const balanceResponse = await API.get(`/leave/balance/${request.employee_id}`);
                                        if (balanceResponse.data.success) {
                                          setEditBalanceModal({
                                            show: true,
                                            employee_id: request.employee_id,
                                            employee_name: request.employee_name,
                                            employee_email: request.employee_email,
                                            personal_leave: balanceResponse.data.balances.personal_leave,
                                            sick_leave: balanceResponse.data.balances.sick_leave,
                                            emergency_leave: balanceResponse.data.balances.emergency_leave,
                                            new_personal: balanceResponse.data.balances.personal_leave,
                                            new_sick: balanceResponse.data.balances.sick_leave,
                                            new_emergency: balanceResponse.data.balances.emergency_leave
                                          });
                                        }
                                      } catch (error) {
                                        alert('Could not fetch current balance');
                                      }
                                    }}
                                  >
                                    <i className="bi bi-pencil-square"></i> Edit All Balances
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Edit All Balances - Full Page Overlay */}
      {editBalanceModal.show && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          zIndex: 9999,
          overflowY: 'auto',
          padding: '20px'
        }}>
          <div style={{
            maxWidth: '1400px',
            margin: '30px auto',
            backgroundColor: 'white',
            borderRadius: '12px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
          }}>
            <div className="modal-header bg-primary text-white py-4">
              <h5 className="modal-title fs-3">
                <i className="bi bi-pencil-square me-2"></i>
                Edit All Leave Balances
              </h5>
              <button 
                type="button" 
                className="btn-close btn-close-white" 
                onClick={() => setEditBalanceModal({...editBalanceModal, show: false})}
              ></button>
            </div>
            
            <div className="p-5">
              {/* Employee Info Card */}
              <div className="card bg-light border-0 mb-5">
                <div className="card-body p-4">
                  <div className="row align-items-center">
                    <div className="col-md-1 text-center">
                      <i className="bi bi-person-badge display-4 text-primary"></i>
                    </div>
                    <div className="col-md-11">
                      <h3 className="mb-2 fw-bold">{editBalanceModal.employee_name}</h3>
                      <div className="d-flex flex-wrap gap-3">
                        <span className="badge bg-secondary fs-6 p-2">ID: {editBalanceModal.employee_id}</span>
                        {editBalanceModal.employee_email && (
                          <span className="text-muted fs-5">
                            <i className="bi bi-envelope me-2"></i>{editBalanceModal.employee_email}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Balance Cards Row */}
              <div className="row g-4">
                {/* Personal Leave Card */}
                <div className="col-md-4">
                  <div className="card h-100 border-0 shadow-lg">
                    <div className="card-header bg-warning bg-opacity-25 border-bottom py-3">
                      <h4 className="mb-0 fw-bold">
                        <i className="bi bi-person me-2"></i>
                        Personal Leave
                      </h4>
                    </div>
                    <div className="card-body p-4">
                      <div className="mb-4">
                        <label className="form-label text-muted fw-bold">CURRENT BALANCE</label>
                        <div className="d-flex align-items-center">
                          <span className="display-3 fw-bold me-3">{editBalanceModal.personal_leave}</span>
                          <span className="text-muted fs-4">days</span>
                        </div>
                        <div className="progress mt-3" style={{ height: '10px' }}>
                          <div 
                            className={`progress-bar ${editBalanceModal.personal_leave > 5 ? 'bg-primary' : (editBalanceModal.personal_leave < 2 ? 'bg-danger' : 'bg-warning')}`} 
                            style={{ width: `${Math.min((editBalanceModal.personal_leave) * 100, 100)}%` }}
                          ></div>
                        </div>
                        {editBalanceModal.personal_leave > 5 && (
                          <div className="mt-2 text-primary">
                            <i className="bi bi-exclamation-circle me-1"></i>
                            Above max ({editBalanceModal.personal_leave - 5} extra)
                          </div>
                        )}
                      </div>
                      
                      <div>
                        <label className="form-label text-muted fw-bold">NEW BALANCE</label>
                        <div className="input-group">
                          <input 
                            type="number" 
                            className="form-control form-control-lg text-center fw-bold"
                            value={editBalanceModal.new_personal}
                            onChange={(e) => setEditBalanceModal({
                              ...editBalanceModal, 
                              new_personal: parseInt(e.target.value) || 0
                            })}
                            min="0"
                            step="1"
                            style={{ fontSize: '2rem', height: '70px' }}
                          />
                          <span className="input-group-text fs-4">days</span>
                        </div>
                        {editBalanceModal.new_personal !== editBalanceModal.personal_leave && (
                          <div className={`mt-3 fs-5 ${editBalanceModal.new_personal > editBalanceModal.personal_leave ? 'text-success' : 'text-danger'}`}>
                            <i className={`bi bi-arrow-${editBalanceModal.new_personal > editBalanceModal.personal_leave ? 'up' : 'down'} me-2`}></i>
                            Change: {editBalanceModal.new_personal - editBalanceModal.personal_leave > 0 ? '+' : ''}{editBalanceModal.new_personal - editBalanceModal.personal_leave} day
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sick Leave Card */}
                <div className="col-md-4">
                  <div className="card h-100 border-0 shadow-lg">
                    <div className="card-header bg-info bg-opacity-25 border-bottom py-3">
                      <h4 className="mb-0 fw-bold">
                        <i className="bi bi-heart-pulse me-2"></i>
                        Sick Leave
                      </h4>
                    </div>
                    <div className="card-body p-4">
                      <div className="mb-4">
                        <label className="form-label text-muted fw-bold">CURRENT BALANCE</label>
                        <div className="d-flex align-items-center">
                          <span className="display-3 fw-bold me-3">{editBalanceModal.sick_leave}</span>
                          <span className="text-muted fs-4"> days</span>
                        </div>
                        <div className="progress mt-3" style={{ height: '10px' }}>
                          <div 
                            className={`progress-bar ${editBalanceModal.sick_leave > 5 ? 'bg-primary' : (editBalanceModal.sick_leave < 2 ? 'bg-danger' : 'bg-info')}`} 
                            style={{ width: `${Math.min((editBalanceModal.sick_leave) * 100, 100)}%` }}
                          ></div>
                        </div>
                        {editBalanceModal.sick_leave > 5 && (
                          <div className="mt-2 text-primary">
                            <i className="bi bi-exclamation-circle me-1"></i>
                            Above max ({editBalanceModal.sick_leave - 5} extra)
                          </div>
                        )}
                      </div>
                      
                      <div>
                        <label className="form-label text-muted fw-bold">NEW BALANCE</label>
                        <div className="input-group">
                          <input 
                            type="number" 
                            className="form-control form-control-lg text-center fw-bold"
                            value={editBalanceModal.new_sick}
                            onChange={(e) => setEditBalanceModal({
                              ...editBalanceModal, 
                              new_sick: parseInt(e.target.value) || 0
                            })}
                            min="0"
                            step="1"
                            style={{ fontSize: '2rem', height: '70px' }}
                          />
                          <span className="input-group-text fs-4">days</span>
                        </div>
                        {editBalanceModal.new_sick !== editBalanceModal.sick_leave && (
                          <div className={`mt-3 fs-5 ${editBalanceModal.new_sick > editBalanceModal.sick_leave ? 'text-success' : 'text-danger'}`}>
                            <i className={`bi bi-arrow-${editBalanceModal.new_sick > editBalanceModal.sick_leave ? 'up' : 'down'} me-2`}></i>
                            Change: {editBalanceModal.new_sick - editBalanceModal.sick_leave > 0 ? '+' : ''}{editBalanceModal.new_sick - editBalanceModal.sick_leave} day
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Emergency Leave Card */}
                <div className="col-md-4">
                  <div className="card h-100 border-0 shadow-lg">
                    <div className="card-header bg-danger bg-opacity-25 border-bottom py-3">
                      <h4 className="mb-0 fw-bold">
                        <i className="bi bi-exclamation-triangle me-2"></i>
                        Emergency Leave
                      </h4>
                    </div>
                    <div className="card-body p-4">
                      <div className="mb-4">
                        <label className="form-label text-muted fw-bold">CURRENT BALANCE</label>
                        <div className="d-flex align-items-center">
                          <span className="display-3 fw-bold me-3">{editBalanceModal.emergency_leave}</span>
                          <span className="text-muted fs-4">days</span>
                        </div>
                        <div className="progress mt-3" style={{ height: '10px' }}>
                          <div 
                            className={`progress-bar ${editBalanceModal.emergency_leave > 5 ? 'bg-primary' : (editBalanceModal.emergency_leave < 2 ? 'bg-danger' : 'bg-danger')}`} 
                            style={{ width: `${Math.min((editBalanceModal.emergency_leave) * 100, 100)}%` }}
                          ></div>
                        </div>
                        {editBalanceModal.emergency_leave > 5 && (
                          <div className="mt-2 text-primary">
                            <i className="bi bi-exclamation-circle me-1"></i>
                            Above max ({editBalanceModal.emergency_leave - 5} extra)
                          </div>
                        )}
                      </div>
                      
                      <div>
                        <label className="form-label text-muted fw-bold">NEW BALANCE</label>
                        <div className="input-group">
                          <input 
                            type="number" 
                            className="form-control form-control-lg text-center fw-bold"
                            value={editBalanceModal.new_emergency}
                            onChange={(e) => setEditBalanceModal({
                              ...editBalanceModal, 
                              new_emergency: parseInt(e.target.value) || 0
                            })}
                            min="0"
                            step="1"
                            style={{ fontSize: '2rem', height: '70px' }}
                          />
                          <span className="input-group-text fs-4">days</span>
                        </div>
                        {editBalanceModal.new_emergency !== editBalanceModal.emergency_leave && (
                          <div className={`mt-3 fs-5 ${editBalanceModal.new_emergency > editBalanceModal.emergency_leave ? 'text-success' : 'text-danger'}`}>
                            <i className={`bi bi-arrow-${editBalanceModal.new_emergency > editBalanceModal.emergency_leave ? 'up' : 'down'} me-2`}></i>
                            Change: {editBalanceModal.new_emergency - editBalanceModal.emergency_leave > 0 ? '+' : ''}{editBalanceModal.new_emergency - editBalanceModal.emergency_leave} day
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Summary and Info */}
              <div className="row mt-5">
                <div className="col-12">
                  <div className="card bg-light border-0">
                    <div className="card-body p-4">
                      <div className="d-flex align-items-center">
                        <i className="bi bi-info-circle-fill text-primary fs-1 me-4"></i>
                        <div>
                          <h5 className="mb-2 fw-bold">Bulk Update Information</h5>
                          <p className="mb-0 text-muted fs-5">
                            Changes will only be applied to balances where the new value differs from the current value. 
                            You can update one, two, or all three leave types at once.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer bg-light p-4">
              <div className="d-flex justify-content-between align-items-center w-100">
                <div className="fs-5">
                  {(
                    editBalanceModal.new_personal !== editBalanceModal.personal_leave ||
                    editBalanceModal.new_sick !== editBalanceModal.sick_leave ||
                    editBalanceModal.new_emergency !== editBalanceModal.emergency_leave
                  ) && (
                    <span className="text-muted">
                      <i className="bi bi-pencil me-2"></i>
                      <strong>Updating:</strong>{' '}
                      {[
                        editBalanceModal.new_personal !== editBalanceModal.personal_leave ? 'Personal' : null,
                        editBalanceModal.new_sick !== editBalanceModal.sick_leave ? 'Sick' : null,
                        editBalanceModal.new_emergency !== editBalanceModal.emergency_leave ? 'Emergency' : null
                      ].filter(Boolean).join(' • ')}
                    </span>
                  )}
                </div>
                <div>
                  <button 
                    className="btn btn-secondary me-3 px-5 py-3 fs-5" 
                    onClick={() => setEditBalanceModal({...editBalanceModal, show: false})}
                  >
                    Cancel
                  </button>
                  <button 
                    className="btn btn-primary px-5 py-3 fs-5" 
                    onClick={handleEditAllBalances}
                    disabled={processing || (
                      editBalanceModal.new_personal === editBalanceModal.personal_leave &&
                      editBalanceModal.new_sick === editBalanceModal.sick_leave &&
                      editBalanceModal.new_emergency === editBalanceModal.emergency_leave
                    )}
                  >
                    {processing ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                        Updating...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-check-circle me-2"></i>
                        Update All Balances
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminLeaveManagement;