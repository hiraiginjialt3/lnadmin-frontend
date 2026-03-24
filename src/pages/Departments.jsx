import React, { useState, useEffect } from 'react';
import { departmentAPI } from '../services/api';

const Departments = () => {
    const [departments, setDepartments] = useState([]);
    const [managers, setManagers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingManagers, setLoadingManagers] = useState(false);
    const [error, setError] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({
        departmentName: '',
        managerName: '',
        status: 'active',
        customDepartment: ''
    });

    // Predefined department options
    const departmentOptions = ['IT', 'HR', 'Accounting', 'Sales', 'Marketing', 'Operations', 'Finance', 'Admin'];

    // Fetch departments from API
    const fetchDepartments = async () => {
        try {
            setLoading(true);
            setError('');
            
            const response = await departmentAPI.getAll();
            
            if (response.data.success) {
                setDepartments(response.data.data || []);
            } else {
                setError(response.data.message || 'Failed to load departments');
            }
        } catch (err) {
            setError('Failed to connect to server. Make sure backend is running on port 5000.');
            console.error('Error fetching departments:', err);
        } finally {
            setLoading(false);
        }
    };

    // Fetch managers from API
    const fetchManagers = async () => {
        try {
            setLoadingManagers(true);
            const response = await departmentAPI.getManagers();
            
            if (response.data.success) {
                setManagers(response.data.data || []);
            }
        } catch (err) {
            console.error('Error fetching managers:', err);
        } finally {
            setLoadingManagers(false);
        }
    };

    useEffect(() => {
        fetchDepartments();
        fetchManagers();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            // Prepare final department name
            let finalDepartmentName = formData.departmentName;
            
            // If "other" is selected, use custom department name
            if (formData.departmentName === 'other') {
                if (!formData.customDepartment || formData.customDepartment.trim() === '') {
                    alert('Please enter a department name');
                    return;
                }
                finalDepartmentName = formData.customDepartment.trim();
            }
            
            if (!finalDepartmentName || finalDepartmentName.trim() === '') {
                alert('Department name is required');
                return;
            }
            
            const dataToSubmit = {
                departmentName: finalDepartmentName,
                managerName: formData.managerName,
                status: formData.status
            };
            
            let response;
            
            if (editingId) {
                response = await departmentAPI.update(editingId, dataToSubmit);
                
                if (response.data.success) {
                    alert(response.data.message || 'Department updated successfully!');
                } else {
                    throw new Error(response.data.message);
                }
            } else {
                response = await departmentAPI.create(dataToSubmit);
                
                if (response.data.success) {
                    alert(response.data.message || 'Department created successfully!');
                } else {
                    throw new Error(response.data.message);
                }
            }
            
            await fetchDepartments();
            setShowModal(false);
            resetForm();
        } catch (err) {
            console.error('Error:', err);
            
            if (err.response?.data) {
                alert(`Error: ${err.response.data.message || 'Unknown error'}`);
            } else {
                alert('Error: ' + (err.message || 'Something went wrong'));
            }
        }
    };

    const resetForm = () => {
        setFormData({
            departmentName: '',
            managerName: '',
            status: 'active',
            customDepartment: ''
        });
        setEditingId(null);
    };

    const handleEdit = (department) => {
        // Check if department name is in the predefined options
        const isInOptions = departmentOptions.includes(department.departmentName);
        
        setFormData({
            departmentName: isInOptions ? department.departmentName : 'other',
            managerName: department.managerName || '',
            status: department.status || 'active',
            customDepartment: isInOptions ? '' : department.departmentName
        });
        
        setEditingId(department._id);
        setShowModal(true);
    };

    const handleDelete = async (id, name) => {
        if (window.confirm(`Are you sure you want to delete "${name}" department?`)) {
            try {
                const response = await departmentAPI.delete(id);
                
                if (response.data.success) {
                    await fetchDepartments();
                    alert('Department deleted successfully!');
                } else {
                    throw new Error(response.data.message);
                }
            } catch (err) {
                alert('Failed to delete: ' + (err.message || 'Something went wrong'));
            }
        }
    };

    return (
        <div style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h4 className="fw-bold mb-1">Department Management</h4>
                <button 
                    onClick={() => setShowModal(true)}
                    style={{ 
                        padding: '10px 20px', 
                        background: '#007bff', 
                        color: 'white', 
                        border: 'none', 
                        borderRadius: '5px', 
                        cursor: 'pointer',
                        fontWeight: '500'
                    }}
                >
                    + Add Department
                </button>
            </div>

            {error && (
                <div style={{ 
                    background: '#f8d7da', 
                    color: '#721c24', 
                    padding: '15px', 
                    borderRadius: '5px', 
                    marginBottom: '20px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <span>{error}</span>
                    <button 
                        onClick={fetchDepartments}
                        style={{ 
                            padding: '5px 10px', 
                            background: '#dc3545', 
                            color: 'white', 
                            border: 'none', 
                            borderRadius: '3px', 
                            cursor: 'pointer',
                            fontSize: '12px'
                        }}
                    >
                        Retry
                    </button>
                </div>
            )}

            {/* Departments Table */}
            <div style={{ 
                background: 'white', 
                borderRadius: '10px', 
                overflow: 'hidden', 
                boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
                minHeight: '200px'
            }}>
                {loading ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#7f8c8d' }}>
                        Loading departments...
                    </div>
                ) : departments.length === 0 ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#95a5a6' }}>
                        <p>No departments found in the database.</p>
                        <p>Click "Add Department" to create your first department.</p>
                    </div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: '#f8f9fa' }}>
                                <th style={{ padding: '15px', textAlign: 'left', fontWeight: '600', color: '#555' }}>Department Name</th>
                                <th style={{ padding: '15px', textAlign: 'left', fontWeight: '600', color: '#555' }}>Manager</th>
                                <th style={{ padding: '15px', textAlign: 'left', fontWeight: '600', color: '#555' }}>Status</th>
                                <th style={{ padding: '15px', textAlign: 'left', fontWeight: '600', color: '#555' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {departments.map((dept) => (
                                <tr key={dept._id} style={{ borderBottom: '1px solid #eee' }}>
                                    <td style={{ padding: '15px' }}>
                                        <div style={{ fontWeight: '500', color: '#2c3e50' }}>
                                            {dept.departmentName}
                                        </div>
                                        <div style={{ fontSize: '12px', color: '#7f8c8d', marginTop: '2px' }}>
                                            ID: {dept._id?.substring(0, 8)}...
                                        </div>
                                    </td>
                                    <td style={{ padding: '15px', color: '#555' }}>
                                        {dept.managerName ? (
                                            <div>
                                                <div style={{ fontWeight: '500' }}>{dept.managerName}</div>
                                                {dept.managerId && (
                                                    <div style={{ fontSize: '12px', color: '#7f8c8d', marginTop: '2px' }}>
                                                        ID: {dept.managerId}
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <span style={{ color: '#95a5a6', fontStyle: 'italic' }}>Not assigned</span>
                                        )}
                                    </td>
                                    <td style={{ padding: '15px' }}>
                                        <span style={{
                                            padding: '4px 10px',
                                            borderRadius: '20px',
                                            fontSize: '12px',
                                            fontWeight: '500',
                                            background: dept.status === 'active' ? '#d4edda' : '#f8d7da',
                                            color: dept.status === 'active' ? '#155724' : '#721c24',
                                            display: 'inline-block'
                                        }}>
                                            {dept.status ? dept.status.toUpperCase() : 'ACTIVE'}
                                        </span>
                                    </td>
                                    <td style={{ padding: '15px' }}>
                                        <div style={{ display: 'flex', gap: '10px' }}>
                                            <button 
                                                onClick={() => handleEdit(dept)}
                                                style={{ 
                                                    padding: '5px 10px', 
                                                    background: '#ffc107', 
                                                    color: '#212529', 
                                                    border: 'none', 
                                                    borderRadius: '3px', 
                                                    cursor: 'pointer',
                                                    fontSize: '12px'
                                                }}
                                            >
                                                Edit
                                            </button>
                                            <button 
                                                onClick={() => handleDelete(dept._id, dept.departmentName)}
                                                style={{ 
                                                    padding: '5px 10px', 
                                                    background: '#dc3545', 
                                                    color: 'white', 
                                                    border: 'none', 
                                                    borderRadius: '3px', 
                                                    cursor: 'pointer',
                                                    fontSize: '12px'
                                                }}
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Database Info */}
            <div style={{ 
                marginTop: '20px', 
                padding: '10px', 
                background: '#f8f9fa', 
                borderRadius: '5px',
                fontSize: '12px',
                color: '#666',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
            }}>
                <div>
                    <strong>Total:</strong> {loading ? '...' : departments.length} departments
                </div>
                <div>
                    <strong>Managers Available:</strong> {loadingManagers ? '...' : managers.length}
                </div>
            </div>

            {/* Add/Edit Modal */}
            {showModal && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000
                }}>
                    <div style={{
                        background: 'white',
                        padding: '30px',
                        borderRadius: '10px',
                        width: '450px',
                        maxWidth: '90%'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h2 style={{ margin: 0 }}>{editingId ? 'Edit Department' : 'Add New Department'}</h2>
                            <button 
                                onClick={() => { setShowModal(false); resetForm(); }}
                                style={{ 
                                    background: 'none', 
                                    border: 'none', 
                                    fontSize: '24px', 
                                    cursor: 'pointer', 
                                    color: '#7f8c8d' 
                                }}
                            >
                                ×
                            </button>
                        </div>
                        
                        <form onSubmit={handleSubmit}>
                            <div style={{ marginBottom: '15px' }}>
                                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500', color: '#555' }}>
                                    Department Name *
                                </label>
                                <select
                                    required
                                    value={formData.departmentName}
                                    onChange={(e) => setFormData({...formData, departmentName: e.target.value})}
                                    style={{ 
                                        width: '100%', 
                                        padding: '10px', 
                                        border: '1px solid #ddd', 
                                        borderRadius: '5px',
                                        fontSize: '14px'
                                    }}
                                >
                                    <option value="">Select a department</option>
                                    {departmentOptions.map((dept) => (
                                        <option key={dept} value={dept}>{dept}</option>
                                    ))}
                                    <option value="other">Other (Specify)</option>
                                </select>
                                
                                {formData.departmentName === 'other' && (
                                    <input
                                        type="text"
                                        required
                                        value={formData.customDepartment || ''}
                                        onChange={(e) => setFormData({...formData, customDepartment: e.target.value})}
                                        placeholder="Enter department name"
                                        style={{ 
                                            width: '100%', 
                                            padding: '10px', 
                                            border: '1px solid #ddd', 
                                            borderRadius: '5px',
                                            fontSize: '14px',
                                            marginTop: '10px'
                                        }}
                                    />
                                )}
                            </div>
                            
                            <div style={{ marginBottom: '15px' }}>
                                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500', color: '#555' }}>
                                    Manager (Optional)
                                </label>
                                <select
                                    value={formData.managerName}
                                    onChange={(e) => setFormData({...formData, managerName: e.target.value})}
                                    style={{ 
                                        width: '100%', 
                                        padding: '10px', 
                                        border: '1px solid #ddd', 
                                        borderRadius: '5px',
                                        fontSize: '14px'
                                    }}
                                    disabled={loadingManagers}
                                >
                                    <option value="">Select a manager</option>
                                    {managers.map((manager) => (
                                        <option key={manager.employee_id} value={manager.name}>
                                            {manager.name} ({manager.role})
                                        </option>
                                    ))}
                                </select>
                            </div>
                            
                            <div style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500', color: '#555' }}>
                                    Status
                                </label>
                                <select
                                    value={formData.status}
                                    onChange={(e) => setFormData({...formData, status: e.target.value})}
                                    style={{ 
                                        width: '100%', 
                                        padding: '10px', 
                                        border: '1px solid #ddd', 
                                        borderRadius: '5px',
                                        fontSize: '14px'
                                    }}
                                >
                                    <option value="active">Active</option>
                                    <option value="inactive">Inactive</option>
                                </select>
                            </div>
                            
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button
                                    type="button"
                                    onClick={() => { setShowModal(false); resetForm(); }}
                                    style={{ 
                                        padding: '10px 20px', 
                                        background: '#6c757d', 
                                        color: 'white', 
                                        border: 'none', 
                                        borderRadius: '5px', 
                                        cursor: 'pointer', 
                                        flex: 1,
                                        fontWeight: '500'
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    style={{ 
                                        padding: '10px 20px', 
                                        background: editingId ? '#ffc107' : '#007bff', 
                                        color: editingId ? '#212529' : 'white', 
                                        border: 'none', 
                                        borderRadius: '5px', 
                                        cursor: 'pointer', 
                                        flex: 1,
                                        fontWeight: '500'
                                    }}
                                >
                                    {editingId ? 'Update' : 'Create'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Departments;