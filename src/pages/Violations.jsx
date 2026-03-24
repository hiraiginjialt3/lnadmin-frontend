import React, { useState, useEffect } from 'react';
import { 
  getViolations, 
  createViolation, 
  deleteViolation, 
  getAllEmployees
} from '../services/api';
import { logActivity } from '../utils/activityLogger';

const ITEMS_PER_PAGE = 5;

const Violations = () => {
    const [violations, setViolations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [employees, setEmployees] = useState([]);
    const [deleteLoading, setDeleteLoading] = useState(false); // Add delete loading state

    const [search, setSearch] = useState('');
    const [currentPage, setCurrentPage] = useState(1);

    const [formData, setFormData] = useState({
        employee_id: '',
        violation_type: 'Tardiness',
        description: '',
        status: 'Pending',
        severity: 'Low'
    });

    const [selectedEmployee, setSelectedEmployee] = useState(null);

    /* ================= FETCH VIOLATIONS ================= */
    const fetchViolations = async () => {
        try {
            setLoading(true);
            setError('');
            console.log('Fetching violations...');
            const res = await getViolations();
            console.log('Violations API Response:', res);
            console.log('Violations Data:', res.data);
            
            if (res.data && res.data.success) {
                setViolations(res.data.data || []);
                
                if (res.data.message && res.data.data && res.data.data.length === 0) {
                    setError(res.data.message);
                } else if (res.data.data && res.data.data.length === 0) {
                    setError('No violations found in the database.');
                }
            } else {
                setViolations([]);
                setError(res.data?.message || 'Failed to load violations.');
            }
        } catch (err) {
            console.error('Error fetching violations:', err);
            console.error('Error details:', err.response);
            setViolations([]);
            setError('Connection error. Please check if the server is running.');
        } finally {
            setLoading(false);
        }
    };

    /* ================= FETCH EMPLOYEES ================= */
    const fetchEmployees = async () => {
        try {
            console.log('Fetching employees...');
            const res = await getAllEmployees();
            console.log('Employees response:', res.data);
            setEmployees(res.data.employees || []);
        } catch (err) {
            console.error('Failed to load employees:', err);
            setEmployees([]);
        }
    };

    useEffect(() => {
        fetchViolations();
        fetchEmployees();
        
        // ✅ LOG THE ACTIVITY - When user navigates to violations page
        logActivity('Viewed Violations', 'Accessed the violations management page');
        
    }, []);

    /* ================= EMPLOYEE SELECTION ================= */
    const handleEmployeeSelect = (employeeId) => {
        const employee = employees.find(emp => emp.employee_id === employeeId);
        if (employee) {
            setSelectedEmployee(employee);
            setFormData({
                ...formData,
                employee_id: employeeId,
            });
        } else {
            setSelectedEmployee(null);
        }
    };

    /* ============== SEARCH RESET PAGE ============== */
    useEffect(() => {
        setCurrentPage(1);
    }, [search]);

    /* ================= FILTER ================= */
    const filteredViolations = (violations || []).filter(v => {
        const empId = (v.employeeId || '').toString().toLowerCase();
        const empName = (v.employeeName || '').toString().toLowerCase();
        const dept = (v.department || '').toString().toLowerCase();
        const searchTerm = (search || '').toLowerCase();
        
        return (
            empId.includes(searchTerm) ||
            empName.includes(searchTerm) ||
            dept.includes(searchTerm)
        );
    });

    /* ================= PAGINATION ================= */
    const totalPages = Math.ceil(filteredViolations.length / ITEMS_PER_PAGE);
    const paginatedViolations = filteredViolations.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    /* ================= FORM SUBMISSION ================= */
    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const violationData = {
                employee_id: formData.employee_id,
                violation_type: formData.violation_type,
                description: formData.description,
                status: formData.status,
                severity: formData.severity
            };
            
            console.log('Submitting violation:', violationData);
            const res = await createViolation(violationData);
            console.log('Create violation response:', res.data);
            
            // ✅ LOG THE ACTIVITY - Violation created
            const employee = employees.find(emp => emp.employee_id === formData.employee_id);
            await logActivity(
                'Created Violation Record',
                `${formData.violation_type} violation for ${employee?.name || 'Unknown'} (${formData.employee_id}) - ${formData.description.substring(0, 50)}${formData.description.length > 50 ? '...' : ''}`
            );
            
            await fetchViolations();
            setShowModal(false);
            setFormData({
                employee_id: '',
                violation_type: 'Tardiness',
                description: '',
                status: 'Pending',
                severity: 'Low'
            });
            setSelectedEmployee(null);
            alert(res.data.message || 'Violation added successfully!');
        } catch (error) {
            console.error('Error creating violation:', error);
            alert(error.response?.data?.message || 'Failed to add violation');
        }
    };

    /* ================= FIXED DELETE FUNCTION ================= */
    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this violation?')) {
            try {
                setDeleteLoading(true);
                
                // Find the violation before deleting to get details for logging
                const violation = violations.find(v => v._id === id);
                
                if (!violation) {
                    alert('Violation not found');
                    setDeleteLoading(false);
                    return;
                }
                
                console.log('Deleting violation with ID:', id);
                
                // Call the delete API
                const response = await deleteViolation(id);
                console.log('Delete response:', response);
                
                // Check if deletion was successful
                if (response.data && response.data.success) {
                    // ✅ LOG THE ACTIVITY - Violation deleted
                    await logActivity(
                        'Deleted Violation Record',
                        `${violation.violationType} violation for ${violation.employeeName} (${violation.employeeId})`
                    );
                    
                    // Refresh the violations list
                    await fetchViolations();
                    
                    alert('✅ Violation deleted successfully!');
                } else {
                    alert(response.data?.message || 'Failed to delete violation');
                }
                
            } catch (error) {
                console.error('Error deleting violation:', error);
                
                // Show more detailed error message
                if (error.response) {
                    console.error('Error response:', error.response.data);
                    alert(`Error: ${error.response.data?.message || error.response.statusText}`);
                } else if (error.request) {
                    alert('Network error: Could not connect to server');
                } else {
                    alert(`Error: ${error.message}`);
                }
            } finally {
                setDeleteLoading(false);
            }
        }
    };

    /* ================= BADGE STYLE ================= */
    const badgeStyle = (type) => {
        const styles = {
            Tardiness: ['#fff3cd', '#856404'],
            Absenteeism: ['#f8d7da', '#721c24'],
            'Policy Violation': ['#d1ecf1', '#0c5460'],
            Misconduct: ['#f5c6cb', '#721c24'],
            Other: ['#e2e3e5', '#383d41']
        };
        const [bg, color] = styles[type] || styles.Other;
        return { background: bg, color };
    };

    // Source badge style
    const sourceBadgeStyle = (source) => {
        if (source === 'auto_late_detection') {
            return {
                background: '#cce5ff',
                color: '#004085',
                padding: '2px 8px',
                borderRadius: '12px',
                fontSize: '11px',
                fontWeight: 'bold',
                marginLeft: '8px'
            };
        }
        return {
            background: '#e2e3e5',
            color: '#383d41',
            padding: '2px 8px',
            borderRadius: '12px',
            fontSize: '11px',
            marginLeft: '8px'
        };
    };

    // Shift badge style
    const shiftBadgeStyle = (shiftType) => {
        if (shiftType === 'night') {
            return {
                background: '#d1c4e9',
                color: '#4a148c',
                padding: '2px 8px',
                borderRadius: '12px',
                fontSize: '11px',
                marginLeft: '8px'
            };
        }
        return null;
    };

    return (
        <div style={{ padding: '20px' }}>
            {/* HEADER */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h4 className="fw-bold mb-1">Employee Violation</h4>
                
                {/* Only the Add Violation button remains */}
                <button style={btnPrimary} onClick={() => setShowModal(true)}>
                    + Add Violation
                </button>
            </div>

            {/* SYSTEM STATUS INDICATOR */}
            <div style={{ 
                marginBottom: '15px', 
                padding: '8px 15px', 
                background: '#e8f5e9', 
                borderRadius: '5px',
                border: '1px solid #81c784',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
            }}>
                <span style={{ fontSize: '20px' }}>✅</span>
                <div style={{ fontSize: '13px', color: '#2e7d32' }}>
                    <strong>Auto-Detection Active:</strong> Late violations are automatically created when employees clock in after 8:16 AM or during night shift (1:00 AM - 5:00 AM)
                </div>
            </div>

            {/* DEBUG INFO */}
            <div style={{ marginBottom: '15px', padding: '10px', background: '#f8f9fa', borderRadius: '5px' }}>
                <div style={{ fontSize: '12px', color: '#666' }}>
                    Database: ems_violations.employee_violations | 
                    Total Violations: {violations.length} | 
                    Employees Available: {employees.length} | 
                    Auto-generated: {violations.filter(v => v.source === 'auto_late_detection').length} |
                    Night Shift: {violations.filter(v => v.shift_type === 'night').length} |
                    Morning Shift: {violations.filter(v => v.shift_type === 'morning' && v.source === 'auto_late_detection').length}
                </div>
            </div>

            {/* SEARCH - Auto-generated filter button REMOVED */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px', alignItems: 'center' }}>
                <input
                    type="text"
                    placeholder="🔍 Search by Employee ID, Name, or Department"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{ ...searchInput, width: '100%', maxWidth: '400px' }}
                />
                
                <div style={{ fontSize: '13px', color: '#666', marginLeft: '15px' }}>
                    Results: <strong>{filteredViolations.length}</strong>
                </div>
            </div>

            {/* ERROR */}
            {error && (
                <div style={errorBox}>
                    {error}
                    <button 
                        onClick={fetchViolations} 
                        style={{ marginLeft: '10px', padding: '5px 10px', background: '#fff', border: '1px solid #721c24', color: '#721c24', borderRadius: '3px' }}
                    >
                        Retry
                    </button>
                </div>
            )}

            {/* TABLE */}
            <div style={card}>
                {loading ? (
                    <div style={centerText}>Loading violations...</div>
                ) : filteredViolations.length === 0 ? (
                    <div style={centerText}>
                        {search ? `No results found for "${search}"` : 'No violations found in the database.'}
                    </div>
                ) : (
                    <table style={table}>
                        <thead>
                            <tr style={{ background: '#f8f9fa' }}>
                                <th style={th}>Employee</th>
                                <th style={th}>Department</th>
                                <th style={th}>Violation</th>
                                <th style={th}>Description</th>
                                <th style={th}>Date</th>
                                <th style={th}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedViolations.map(v => (
                                <tr key={v._id} style={{ borderBottom: '1px solid #eee' }}>
                                    <td style={td}>
                                        <div style={{ fontWeight: '500', display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
                                            {v.employeeName}
                                            {/* Auto-generated badge */}
                                            {v.source === 'auto_late_detection' && (
                                                <span style={sourceBadgeStyle(v.source)}>
                                                    ⏰ Auto
                                                </span>
                                            )}
                                            {/* Night shift badge */}
                                            {v.shift_type === 'night' && (
                                                <span style={shiftBadgeStyle(v.shift_type)}>
                                                    🌙 Night
                                                </span>
                                            )}
                                        </div>
                                        <div style={{ fontSize: '12px', color: '#7f8c8d' }}>
                                            ID: {v.employeeId}
                                        </div>
                                        {/* Show clock-in time for auto-generated violations */}
                                        {v.clock_in_time && (
                                            <div style={{ 
                                                fontSize: '11px', 
                                                color: v.shift_type === 'night' ? '#4a148c' : '#dc3545',
                                                fontWeight: v.shift_type === 'night' ? 'bold' : 'normal'
                                            }}>
                                                Clock-in: {v.clock_in_time}
                                                {v.shift_type === 'night' && ' (Night Shift)'}
                                            </div>
                                        )}
                                    </td>
                                    <td style={td}>{v.department}</td>
                                    <td style={td}>
                                        <span style={{ ...badge, ...badgeStyle(v.violationType) }}>
                                            {v.violationType}
                                        </span>
                                    </td>
                                    <td style={{ ...td, color: '#555' }}>
                                        {v.description}
                                        {/* Show source info */}
                                        {v.source === 'auto_late_detection' && (
                                            <div style={{ 
                                                fontSize: '11px', 
                                                color: v.shift_type === 'night' ? '#4a148c' : '#0066cc', 
                                                marginTop: '4px' 
                                            }}>
                                                ⚡ {v.shift_type === 'night' ? 'Auto-detected night shift lateness' : 'Auto-generated from late clock-in'}
                                            </div>
                                        )}
                                    </td>
                                    <td style={td}>
                                        <div style={{ fontSize: '12px', color: '#7f8c8d' }}>
                                            {v.date ? v.date.split(' ')[0] : 'N/A'}
                                        </div>
                                    </td>
                                    <td style={td}>
                                        <button 
                                            style={btnDanger} 
                                            onClick={() => handleDelete(v._id)}
                                            disabled={deleteLoading}
                                        >
                                            {deleteLoading ? 'Deleting...' : 'Delete'}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* PAGINATION */}
            {totalPages > 1 && (
                <div style={pagination}>
                    <button
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(p => p - 1)}
                        style={pageBtn(currentPage === 1)}
                    >
                        Prev
                    </button>

                    {[...Array(totalPages)].map((_, i) => (
                        <button
                            key={i}
                            onClick={() => setCurrentPage(i + 1)}
                            style={pageBtn(false, currentPage === i + 1)}
                        >
                            {i + 1}
                        </button>
                    ))}

                    <button
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage(p => p + 1)}
                        style={pageBtn(currentPage === totalPages)}
                    >
                        Next
                    </button>
                </div>
            )}

            {/* MODAL */}
            {showModal && (
                <div style={overlay}>
                    <div style={modal}>
                        <h2>Add Violation</h2>
                        <form onSubmit={handleSubmit}>
                            {/* Employee Selection Dropdown */}
                            <div style={{ marginBottom: '15px' }}>
                                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>
                                    Select Employee *
                                </label>
                                <select 
                                    required 
                                    style={input}
                                    value={formData.employee_id}
                                    onChange={(e) => handleEmployeeSelect(e.target.value)}
                                >
                                    <option value="">-- Select Employee --</option>
                                    {employees.map(emp => (
                                        <option key={emp.employee_id} value={emp.employee_id}>
                                            {emp.name} ({emp.employee_id}) - {emp.department || 'No Department'}
                                        </option>
                                    ))}
                                </select>
                                {employees.length === 0 && (
                                    <div style={{ fontSize: '12px', color: '#dc3545', marginTop: '5px' }}>
                                        No employees found. Please add employees first.
                                    </div>
                                )}
                            </div>

                            {/* Auto-filled Employee Info */}
                            {selectedEmployee && (
                                <div style={infoBox}>
                                    <div><strong>Employee:</strong> {selectedEmployee.name}</div>
                                    <div><strong>Department:</strong> {selectedEmployee.department || 'Not assigned'}</div>
                                    <div><strong>Email:</strong> {selectedEmployee.email || 'No email'}</div>
                                </div>
                            )}

                            <div style={{ marginBottom: '15px' }}>
                                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>
                                    Violation Type *
                                </label>
                                <select 
                                    required 
                                    style={input} 
                                    value={formData.violation_type}
                                    onChange={e => setFormData({ ...formData, violation_type: e.target.value })}
                                >
                                    <option value="Tardiness">Tardiness</option>
                                    <option value="Absenteeism">Absenteeism</option>
                                    <option value="Policy Violation">Policy Violation</option>
                                    <option value="Misconduct">Misconduct</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>

                            <div style={{ marginBottom: '15px' }}>
                                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>
                                    Severity
                                </label>
                                <select 
                                    style={input} 
                                    value={formData.severity}
                                    onChange={e => setFormData({ ...formData, severity: e.target.value })}
                                >
                                    <option value="Low">Low Severity</option>
                                    <option value="Medium">Medium Severity</option>
                                    <option value="High">High Severity</option>
                                </select>
                            </div>

                            <div style={{ marginBottom: '15px' }}>
                                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>
                                    Description *
                                </label>
                                <textarea 
                                    required 
                                    placeholder="Enter violation description..." 
                                    style={{ ...input, minHeight: 100 }}
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                />
                            </div>

                            <div style={{ display: 'flex', gap: 10, marginTop: '20px' }}>
                                <button type="button" style={btnGray} onClick={() => {
                                    setShowModal(false);
                                    setFormData({
                                        employee_id: '',
                                        violation_type: 'Tardiness',
                                        description: '',
                                        status: 'Pending',
                                        severity: 'Low'
                                    });
                                    setSelectedEmployee(null);
                                }}>
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    style={btnPrimary} 
                                    disabled={!formData.employee_id || !formData.description}
                                >
                                    Save Violation
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

/* ================= STYLES ================= */
const card = { background: '#fff', borderRadius: 10, boxShadow: '0 2px 10px rgba(0,0,0,0.1)', overflow: 'hidden' };
const table = { width: '100%', borderCollapse: 'collapse' };
const th = { padding: 15, textAlign: 'left', fontWeight: 600, color: '#555' };
const td = { padding: 15 };
const badge = { padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 500 };
const centerText = { padding: 40, textAlign: 'center', color: '#7f8c8d' };
const errorBox = { background: '#f8d7da', color: '#721c24', padding: 15, borderRadius: 5, marginBottom: 15 };
const searchInput = { padding: '10px 15px', border: '1px solid #ddd', borderRadius: 5 };
const infoBox = { background: '#f8f9fa', padding: '15px', borderRadius: '5px', marginBottom: '15px', border: '1px solid #eee' };

const pagination = { display: 'flex', justifyContent: 'center', gap: 8, marginTop: 20 };
const pageBtn = (disabled, active = false) => ({
    padding: '6px 12px',
    borderRadius: 4,
    border: '1px solid #ddd',
    background: active ? '#007bff' : '#fff',
    color: active ? '#fff' : '#333',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1
});

const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center' };
const modal = { background: '#fff', padding: 30, borderRadius: 10, width: 500, maxHeight: '80vh', overflowY: 'auto' };
const input = { width: '100%', padding: 10, marginBottom: 10, border: '1px solid #ddd', borderRadius: 5 };

const btnPrimary = { 
    padding: '10px 20px', 
    background: '#007bff', 
    color: '#fff', 
    border: 'none', 
    borderRadius: 5, 
    cursor: 'pointer',
    opacity: 1,
    transition: 'opacity 0.3s'
};
const btnGray = { 
    flex: 1, 
    padding: 10, 
    background: '#6c757d', 
    color: '#fff', 
    border: 'none', 
    borderRadius: 5, 
    cursor: 'pointer' 
};
const btnDanger = { 
    padding: '5px 10px', 
    background: '#dc3545', 
    color: '#fff', 
    border: 'none', 
    borderRadius: 3, 
    cursor: 'pointer',
    opacity: 1,
    transition: 'opacity 0.3s',
    ':disabled': {
        opacity: 0.5,
        cursor: 'not-allowed'
    }
};

export default Violations;