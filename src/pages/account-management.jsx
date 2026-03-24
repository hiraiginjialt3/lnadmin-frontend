import React, { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { logActivity } from '../utils/activityLogger';
import { useAuth } from '../context/AuthContext';
import API, { 
  getHealth,
  getAllEmployees,
  getDepartments,
  syncAttendanceDB,
  processAllFaces
} from '../services/api';

const AccountManagement = () => {
  const { user } = useAuth(); // Get current logged-in user
  const [view, setView] = useState("status");
  const [profilePreview, setProfilePreview] = useState(null);
  const [facePreview, setFacePreview] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [extractingFeatures, setExtractingFeatures] = useState(false);
  const [systemHealth, setSystemHealth] = useState({});
  const [newEmployee, setNewEmployee] = useState({
    name: "",
    email: "",
    password: "",
    role: "Employee",
    department: "",
    contact_number: "",
    birthday: "",
    profile_picture: null,
    face_image: null
  });
  
  // Camera states
  const [showCamera, setShowCamera] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  const [cameraError, setCameraError] = useState("");
  const [capturing, setCapturing] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  
  // Password visibility state
  const [showPassword, setShowPassword] = useState(false);
  
  // Add state for generated ID preview
  const [generatedIdPreview, setGeneratedIdPreview] = useState("");
  
  // State for departments from MongoDB
  const [departments, setDepartments] = useState([]);

  // Define available roles based on current user's role
  const getAvailableRoles = () => {
    const userRole = user?.role || 'Admin';
    
    const rolePermissions = {
      Admin: ['Admin', 'HR', 'Accountant', 'Employee'],  // Admin can create all roles
      HR: ['HR', 'Accountant', 'Employee'],             // HR cannot create Admin
      Accountant: ['Accountant', 'Employee'],           // Accountant cannot create Admin or HR
      Employee: []                                       // Employee cannot create anyone
    };
    
    return rolePermissions[userRole] || [];
  };

  // Check if user can create a specific role
  const canCreateRole = (role) => {
    const availableRoles = getAvailableRoles();
    return availableRoles.includes(role);
  };

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [cameraStream]);

  // Handle video stream when camera is shown
  useEffect(() => {
    if (showCamera && videoRef.current) {
      startCamera();
    } else if (!showCamera && cameraStream) {
      stopCamera();
    }
  }, [showCamera]);

  // Start camera function
  const startCamera = async () => {
    try {
      setCameraError("");
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user"
        } 
      });
      
      setCameraStream(stream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Camera error:", err);
      setCameraError("Unable to access camera. Please ensure camera permissions are granted.");
    }
  };

  // Stop camera function
  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setShowCamera(false);
  };

  // Capture photo from camera
  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      setCapturing(true);
      
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      // Set canvas dimensions to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      // Draw video frame to canvas
      const context = canvas.getContext('2d');
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Convert canvas to file
      canvas.toBlob((blob) => {
        // Create file from blob
        const file = new File([blob], "camera_capture.jpg", { type: "image/jpeg" });
        
        // Set as face image
        setFacePreview(URL.createObjectURL(blob));
        setNewEmployee({...newEmployee, face_image: file});
        
        // Stop camera and close modal
        stopCamera();
        setCapturing(false);
      }, 'image/jpeg', 0.95);
    }
  };

  // Retake photo function
  const retakePhoto = () => {
    setFacePreview(null);
    setNewEmployee({...newEmployee, face_image: null});
    setShowCamera(true);
  };

  // MODIFIED: Enhanced fetchEmployees to get profile_image_base64
  const fetchEmployees = useCallback(async () => {
    try {
      setLoading(true);
      const response = await API.get('/employees');
      const data = response.data;
      if (data.success) {
        // Fetch face data status and full employee data for each employee
        const employeesWithFullData = await Promise.all(
          data.employees.map(async (emp) => {
            try {
              // Fetch face info
              const faceResponse = await API.get(`/employee/${emp.employee_id}/face-info`);
              let hasFaceData = false;
              if (faceResponse.data) {
                hasFaceData = faceResponse.data.has_face_data;
              }
              
              // Fetch full employee data to get profile_image_base64
              try {
                const empResponse = await API.get(`/employee/${emp.employee_id}`);
                if (empResponse.data.success) {
                  return { 
                    ...emp, 
                    has_face_data: hasFaceData,
                    profile_image_base64: empResponse.data.employee?.profile_image_base64,
                    face_image_base64: empResponse.data.employee?.face_image_base64
                  };
                }
              } catch (err) {
                console.log(`Could not fetch full data for ${emp.employee_id}`);
              }
              
              return { ...emp, has_face_data: hasFaceData };
            } catch (err) {
              console.log(`Could not fetch face data for ${emp.employee_id}:`, err.message);
              return { ...emp, has_face_data: false };
            }
          })
        );
        setEmployees(employeesWithFullData);
      }
    } catch (error) {
      console.error("Error fetching employees:", error);
      showAlert("danger", "Failed to fetch employees. Please check if backend is running.");
    } finally {
      setLoading(false);
    }
  }, []);

  const checkSystemHealth = useCallback(async () => {
    try {
      const response = await getHealth();
      const data = response.data;
      setSystemHealth(data);
      return data;
    } catch (error) {
      console.error("Error checking system health:", error);
      return { mongodb: { status: 'not connected' } };
    }
  }, []);

  // Function to sync attendance.db with MongoDB
  const syncAttendanceDatabase = useCallback(async () => {
    try {
      console.log("[SYNC] Starting database sync...");
      const response = await syncAttendanceDB();
      const data = response.data;
      
      if (data.success) {
        console.log(`[SYNC] Success: Added ${data.synced_count}, Removed ${data.deleted_count}`);
        return data;
      } else {
        console.error("[SYNC] Failed:", data.message);
        return null;
      }
    } catch (error) {
      console.error("[SYNC] Error:", error);
      return null;
    }
  }, []);

  // Function to fetch departments from MongoDB
  const fetchDepartments = useCallback(async () => {
    try {
      const response = await getDepartments();
      const data = response.data;
      
      if (data.success) {
        console.log("Fetched departments:", data.data);
        const departmentNames = data.data.map(dept => dept.departmentName);
        setDepartments(departmentNames);
      } else {
        console.error("Failed to fetch departments:", data.message);
        setDepartments([
          "Information Technology",
          "Human Resources", 
          "Finance",
          "Operations",
          "Sales",
          "Marketing",
          "Production",
          "Logistics"
        ]);
      }
    } catch (error) {
      console.error("Error fetching departments:", error);
      setDepartments([
        "Information Technology",
        "Human Resources", 
        "Finance",
        "Operations", 
        "Marketing",
        "Production",
        "Logistics"
      ]);
    }
  }, []);

  useEffect(() => {
    const initialize = async () => {
      const healthData = await checkSystemHealth();
      await fetchDepartments();
      
      if (healthData.mongodb?.status === 'connected') {
        const syncResult = await syncAttendanceDatabase();
        if (syncResult) {
          console.log("[AUTO-SYNC] Database sync completed successfully");
        }
      }
      
      await fetchEmployees();
    };
    
    initialize();
  }, []);

  // Generate ID preview when department or role changes
  useEffect(() => {
    const generateIdPreview = () => {
      if (!newEmployee.department || !newEmployee.role) {
        setGeneratedIdPreview("");
        return;
      }
      
      const deptPrefix = newEmployee.department.substring(0, 2).toUpperCase();
      
      let rolePrefix = "";
      const roleLower = newEmployee.role.toLowerCase();
      if (roleLower.includes('manager')) {
        rolePrefix = 'MGR';
      } else if (roleLower.includes('admin')) {
        rolePrefix = 'ADM';
      } else if (roleLower.includes('supervisor')) {
        rolePrefix = 'SUP';
      } else if (roleLower.includes('employee') || roleLower.includes('staff')) {
        rolePrefix = 'EMP';
      } else {
        rolePrefix = newEmployee.role.substring(0, 3).toUpperCase();
      }
      
      setGeneratedIdPreview(`${deptPrefix}${rolePrefix}001`);
    };
    
    generateIdPreview();
  }, [newEmployee.department, newEmployee.role]);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleProfileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setProfilePreview(URL.createObjectURL(file));
      setNewEmployee({...newEmployee, profile_picture: file});
    }
  };

  // Handle face image change (file input)
  const handleFaceImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFacePreview(URL.createObjectURL(file));
      setNewEmployee({...newEmployee, face_image: file});
      setShowCamera(false); // Close camera if open
    }
  };

  // Handle file button click
  const handleFileButtonClick = () => {
    stopCamera();
    document.getElementById('face-image-input').click();
  };

  const handleDepartmentChange = (e) => {
    setNewEmployee({...newEmployee, department: e.target.value});
  };

  const handleRoleChange = (e) => {
    const selectedRole = e.target.value;
    // Check if user can create this role
    if (!canCreateRole(selectedRole)) {
      showAlert("warning", `You don't have permission to create ${selectedRole} accounts.`, true);
      return;
    }
    setNewEmployee({...newEmployee, role: selectedRole});
  };

  const handleCreateEmployee = async () => {
    scrollToTop();
    
    // Check if user can create the selected role
    if (!canCreateRole(newEmployee.role)) {
      showAlert("danger", `You don't have permission to create ${newEmployee.role} accounts.`, true);
      return;
    }
    
    if (!newEmployee.name) {
      showAlert("warning", "Name is required!", true);
      return;
    }

    if (!newEmployee.email) {
      showAlert("warning", "Email is required for employee login!", true);
      return;
    }

    if (!newEmployee.password) {
      showAlert("warning", "Password is required for employee login!", true);
      return;
    }

    if (newEmployee.password.length < 8) {
      showAlert("warning", "Password must be at least 8 characters long!", true);
      return;
    }

    if (!newEmployee.department) {
      showAlert("warning", "Department is required!", true);
      return;
    }

    if (!newEmployee.face_image) {
      showAlert("warning", "Face recognition image is required for attendance system!", true);
      return;
    }

    try {
      const formData = new FormData();
      formData.append('name', newEmployee.name);
      formData.append('email', newEmployee.email);
      formData.append('password', newEmployee.password);
      formData.append('role', newEmployee.role);
      formData.append('department', newEmployee.department);
      formData.append('contact_number', newEmployee.contact_number);
      formData.append('birthday', newEmployee.birthday);
      
      if (newEmployee.profile_picture) {
        formData.append('profile_picture', newEmployee.profile_picture);
      } else {
        formData.append('profile_picture', '');
      }
      
      if (newEmployee.face_image) {
        formData.append('face_image', newEmployee.face_image);
      }

      console.log("Creating employee with department:", newEmployee.department);
      console.log("Role:", newEmployee.role);
      console.log("Profile picture:", newEmployee.profile_picture ? "Yes" : "No");
      console.log("Face image:", newEmployee.face_image ? "Yes" : "No");

      const createResponse = await API.post('/employee/register', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      const createData = createResponse.data;
      
      if (!createData.success) {
        if (createData.errors && createData.errors.length > 0) {
          showAlert("danger", createData.errors.join('<br>'), true);
        } else {
          showAlert("danger", createData.message || "Error creating employee.", true);
        }
        return;
      }

      await logActivity(
        'Created Employee Account',
        `Registered ${createData.employee_name} (${createData.employee_id}) as ${createData.role} in ${createData.department}`
      );

      setNewEmployee({
        name: "",
        email: "",
        password: "",
        role: "Employee",
        department: "",
        contact_number: "",
        birthday: "",
        profile_picture: null,
        face_image: null
      });
      setProfilePreview(null);
      setFacePreview(null);
      setGeneratedIdPreview("");
      setShowPassword(false);
      
      setView("status");
      fetchEmployees();
      checkSystemHealth();

      let successMessage = `
        <div class="text-start">
          <h6 class="mb-3">✅ Employee Created Successfully!</h6>
          <p><strong>Employee:</strong> ${createData.employee_name}</p>
          <p><strong>Employee ID:</strong> ${createData.employee_id}</p>
          <p><strong>Email:</strong> ${newEmployee.email}</p>
          <p><strong>Department:</strong> ${createData.department}</p>
          <p><strong>Role:</strong> ${createData.role || newEmployee.role}</p>
          <hr>
          <h6>🔐 Login Credentials:</h6>
          <ul class="mb-2">
            <li>✅ Email: ${newEmployee.email}</li>
            <li>✅ Password: [secured - saved in ${createData.role || newEmployee.role}_credentials]</li>
          </ul>
          <hr>
          <h6>📊 Face Recognition Results:</h6>
          <ul class="mb-0">
            ${createData.has_face_data ? '<li>✅ 128D facial features extracted</li>' : '<li>⚠️ Face features could not be extracted</li>'}
            <li>✅ Saved to features_all.csv</li>
            <li>✅ Face image stored as base64 in MongoDB</li>
            ${createData.profile_base64_length ? '<li>✅ Profile picture stored as base64 in MongoDB</li>' : ''}
            ${systemHealth.mongodb?.status === 'connected' ? '<li>✅ Synced to MongoDB Cloud</li>' : '<li>⚠️ Saved locally only (MongoDB offline)</li>'}
            <li>✅ Ready for face recognition attendance</li>
          </ul>
          <p class="text-success mt-2">
            <i class="bi bi-check-circle-fill me-1"></i>
            Employee can now login at the employee portal
          </p>
        </div>
      `;
      showAlert("success", successMessage, true);

    } catch (error) {
      console.error("Error:", error);
      showAlert("danger", "Error creating employee. Please try again.", true);
    }
  };

  const handleUpdateEmployeeStatus = async (employeeId, currentStatus) => {
    const newStatus = currentStatus === "active" ? "inactive" : "active";
    
    if (window.confirm(`Are you sure you want to ${newStatus} this employee?`)) {
      try {
        const response = await API.put(`/employees/${employeeId}/status`, { status: newStatus });
        const data = response.data;
        
        if (data.success) {
          const employee = employees.find(emp => emp.employee_id === employeeId);
          
          await logActivity(
            `${newStatus === 'active' ? 'Activated' : 'Deactivated'} Employee Account`,
            `${employee?.name || 'Unknown'} (${employeeId}) is now ${newStatus}`
          );
          
          showAlert("success", `Employee ${newStatus}d successfully!`);
          fetchEmployees();
        } else {
          showAlert("danger", data.message || "Failed to update employee status.");
        }
      } catch (error) {
        console.error("Error updating status:", error);
        showAlert("danger", "Failed to update employee status.");
      }
    }
  };

  // Updated handleAddFaceData to use base64 storage
  const handleAddFaceData = async (employeeId, employeeName) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (file) {
        setExtractingFeatures(true);
        showAlert("info", "Processing face image for base64 storage...");

        const formData = new FormData();
        formData.append('face_image', file);
        formData.append('name', employeeName);

        try {
          const response = await API.post(`/employee/${employeeId}/update-face`, formData, {
            headers: {
              'Content-Type': 'multipart/form-data'
            }
          });
          
          const data = response.data;
          setExtractingFeatures(false);

          if (data.success) {
            showAlert("success", `
              ✅ Face image added successfully!
              <br>Stored as base64 in MongoDB
            `, true);
            fetchEmployees();
          } else {
            showAlert("warning", data.message || "Failed to add face image");
          }
        } catch (error) {
          console.error("Error:", error);
          setExtractingFeatures(false);
          showAlert("danger", "Error processing face image.");
        }
      }
    };
    input.click();
  };

  const handleManualSync = async () => {
    if (window.confirm("This will force sync SQLite database with MongoDB. Continue?")) {
      try {
        setLoading(true);
        showAlert("info", "Syncing databases...");
        
        const result = await syncAttendanceDatabase();
        
        if (result) {
          showAlert("success", `
            <div class="text-start">
              <h6 class="mb-2">✅ Manual Sync Complete!</h6>
              <p><strong>Added:</strong> ${result.synced_count} employees</p>
              <p><strong>Removed:</strong> ${result.deleted_count} employees</p>
              <p class="mb-0 small text-muted">SQLite attendance.db is now synced with MongoDB</p>
            </div>
          `, true);
          
          await fetchEmployees();
        } else {
          showAlert("danger", "Sync failed. Please check MongoDB connection.");
        }
      } catch (error) {
        console.error("Manual sync error:", error);
        showAlert("danger", "Failed to sync databases");
      } finally {
        setLoading(false);
      }
    }
  };

  const batchProcessFaces = async () => {
    if (window.confirm("This will process ALL face images in the data_faces_from_camera folder. Continue?")) {
      try {
        setExtractingFeatures(true);
        showAlert("info", "Starting batch processing of all face images...");

        const response = await processAllFaces();
        const data = response.data;
        setExtractingFeatures(false);

        if (data.success) {
          showAlert("success", data.message);
          fetchEmployees();
        } else {
          showAlert("warning", data.message);
        }
      } catch (error) {
        console.error("Error:", error);
        setExtractingFeatures(false);
        showAlert("danger", "Error processing faces.");
      }
    }
  };

  const showAlert = (type, message, isHtml = false, scroll = false) => {
    const alertContainer = document.getElementById('alert-container');
    if (!alertContainer) return;
    
    const alertId = `alert-${Date.now()}`;
    const alertHtml = `
      <div id="${alertId}" class="alert alert-${type} alert-dismissible fade show" role="alert">
        ${isHtml ? message : `<i class="bi bi-${type === 'success' ? 'check-circle' : type === 'danger' ? 'exclamation-triangle' : 'info-circle'} me-2"></i>${message}`}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
      </div>
    `;
    
    alertContainer.innerHTML = alertHtml;
    
    if (scroll) {
      setTimeout(() => {
        scrollToTop();
      }, 100);
    }
    
    setTimeout(() => {
      const alert = document.getElementById(alertId);
      if (alert) {
        alert.remove();
      }
    }, 8000);
  };

  // Get available roles for the dropdown
  const availableRoles = getAvailableRoles();

  return (
    <div className="container py-4">
      {/* Alert Container */}
      <div id="alert-container"></div>

      {/* Header */}
      <div className="mb-4">
        <div className="d-flex justify-content-between align-items-center">
          <div>
            <h4 className="fw-bold mb-1">Account Management</h4>
            <small className="text-muted">
              Face Recognition Employee Registration | Logged in as: <strong>{user?.role || 'Admin'}</strong>
            </small>
          </div>
          <div className="d-flex gap-2">
            <button 
              className="btn btn-outline-info btn-sm" 
              onClick={checkSystemHealth}
              disabled={extractingFeatures}
            >
              <i className="bi bi-heart-pulse me-1"></i>
              System Health
            </button>
            <button 
              className="btn btn-outline-success btn-sm" 
              onClick={handleManualSync}
              disabled={extractingFeatures || loading}
            >
              <i className="bi bi-arrow-left-right me-1"></i>
              Sync Databases
            </button>
            <button 
              className="btn btn-outline-warning btn-sm" 
              onClick={batchProcessFaces}
              disabled={extractingFeatures}
            >
              <i className="bi bi-arrow-repeat me-1"></i>
              Batch Process Faces
            </button>
          </div>
        </div>
      </div>

      {/* System Status Card */}
      <div className="card bg-light mb-4">
        <div className="card-body py-3">
          <div className="row">
            <div className="col-md-3">
              <small className="d-block text-muted">
                <i className="bi bi-database me-1"></i>
                SQLite (Local)
              </small>
              <strong>{employees.length} employees</strong>
            </div>
            <div className="col-md-3">
              <small className="d-block text-muted">
                <i className={`bi ${systemHealth.mongodb?.status === 'connected' ? 'bi-cloud-check text-success' : 'bi-cloud-slash text-warning'} me-1`}></i>
                MongoDB (Cloud)
              </small>
              <strong>{systemHealth.mongodb?.status === 'connected' ? 'Connected' : 'Offline'}</strong>
            </div>
            <div className="col-md-3">
              <small className="d-block text-muted">
                <i className="bi bi-camera me-1"></i>
                Faces Registered
              </small>
              <strong>{employees.filter(e => e.has_face_data).length} / {employees.length}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Buttons */}
      <div className="d-flex gap-2 mb-4 flex-wrap">
        <button className="btn btn-secondary" onClick={() => setView("status")}>
          <i className="bi bi-arrow-repeat me-1"></i>
          Employee Status
        </button>
        <button className="btn btn-primary" onClick={() => setView("create")}>
          <i className="bi bi-person-plus-fill me-1"></i>
          Create Employee
        </button>
        <Link to="/departments" className="btn btn-primary">
          <i className="bi bi-building me-1"></i>
          Departments
        </Link>
      </div>
      

      {extractingFeatures && (
        <div className="alert alert-info">
          <div className="d-flex align-items-center">
            <div className="spinner-border spinner-border-sm me-3" role="status"></div>
            <div>
              <strong>Processing Face Image...</strong>
              <p className="mb-0 small">Converting to base64 and storing in MongoDB</p>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-2">Loading employees...</p>
        </div>
      ) : (
        <>
          {/* ================= STATUS VIEW ================= */}
          {view === "status" && (
            <div className="card shadow-sm">
              <div className="card-header d-flex justify-content-between align-items-center">
                <h5 className="mb-0">Employee Status Management</h5>
                <span className="badge bg-primary">
                  {employees.filter(e => e.status === 'active').length} Active / {employees.length} Total
                </span>
              </div>
              <div className="table-responsive">
                <table className="table align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>ID</th>
                      <th>Employee</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Face Data</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map((emp) => (
                      <tr key={emp.employee_id}>
                        <td>
                          <code>{emp.employee_id}</code>
                        </td>
                        <td>
                          <Link 
                            to={`/accmanagement/update/${emp.employee_id}`}
                            className="text-decoration-none text-dark d-flex align-items-center"
                          >
                            {emp.profile_image_base64 ? (
                              <img
                                src={`data:image/jpeg;base64,${emp.profile_image_base64}`}
                                alt="profile"
                                className="rounded-circle me-3"
                                width="40"
                                height="40"
                                style={{ objectFit: 'cover' }}
                                onError={(e) => {
                                  e.target.onerror = null;
                                  e.target.src = 'https://via.placeholder.com/40';
                                }}
                              />
                            ) : emp.profile_picture ? (
                              <img
                                src={`http://localhost:5000/uploads/${emp.profile_picture}`}
                                alt="profile"
                                className="rounded-circle me-3"
                                width="40"
                                height="40"
                                style={{ objectFit: 'cover' }}
                                onError={(e) => {
                                  e.target.onerror = null;
                                  e.target.src = 'https://via.placeholder.com/40';
                                }}
                              />
                            ) : (
                              <div className="rounded-circle bg-secondary d-flex align-items-center justify-content-center me-3"
                                style={{width: "40px", height: "40px"}}>
                                <i className="bi bi-person text-white"></i>
                              </div>
                            )}
                            <div>
                              <strong>{emp.name}</strong>
                              <div className="text-muted small">{emp.email}</div>
                            </div>
                          </Link>
                        </td>
                        <td>
                          <span className="badge bg-info">{emp.role}</span>
                        </td>
                        <td>
                          <span className={`badge ${emp.status === "active" ? "bg-success" : "bg-danger"}`}>
                            {emp.status.toUpperCase()}
                          </span>
                        </td>
                        <td>
                          {emp.has_face_data ? (
                            <span className="badge bg-success">
                              <i className="bi bi-check-circle me-1"></i>Registered
                            </span>
                          ) : (
                            <button 
                              className="btn btn-sm btn-outline-warning"
                              onClick={() => handleAddFaceData(emp.employee_id, emp.name)}
                              disabled={extractingFeatures}
                            >
                              <i className="bi bi-camera me-1"></i>Add Face
                            </button>
                          )}
                        </td>
                        <td>
                          <button 
                            className={`btn btn-sm ${emp.status === "active" ? "btn-danger" : "btn-success"}`}
                            onClick={() => handleUpdateEmployeeStatus(emp.employee_id, emp.status)}
                            disabled={extractingFeatures}
                          >
                            {emp.status === "active" ? "Deactivate" : "Activate"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ================= CREATE VIEW ================= */}
          {view === "create" && (
            <div className="card shadow-sm">
              <div className="card-body">
                <h5 className="mb-3">
                  <i className="bi bi-person-plus-fill me-2"></i>
                  Create New Employee with Face Recognition
                </h5>

                {/* Auto-generated ID Preview */}
                {generatedIdPreview && (
                  <div className="alert alert-success mb-4">
                    <div className="d-flex align-items-center">
                      <i className="bi bi-info-circle me-2"></i>
                      <div>
                        <strong>Auto-generated Employee ID Preview:</strong>
                        <div className="mt-1">
                          <code className="fs-5 bg-light p-2 rounded">{generatedIdPreview}</code>
                          <small className="text-muted ms-2">
                            (Format: {newEmployee.department?.substring(0, 2).toUpperCase() || "DP"}{newEmployee.role?.substring(0, 3).toUpperCase() || "EMP"}001)
                          </small>
                        </div>
                        <small className="text-muted">
                          The system will automatically generate the final ID when you submit.
                        </small>
                      </div>
                    </div>
                  </div>
                )}

                {/* Validation Requirements */}
                <div className="alert alert-info mb-4">
                  <h6 className="mb-2">
                    <i className="bi bi-exclamation-triangle me-2"></i>
                    Validation Requirements
                  </h6>
                  <ul className="mb-0 small">
                    <li><strong>Name:</strong> Required, at least 2 characters</li>
                    <li><strong>Email:</strong> Required for login, must end with @gmail.com or @yahoo.com</li>
                    <li><strong>Password:</strong> Required, minimum 8 characters</li>
                    <li><strong>Contact:</strong> Optional, must be 11 digits starting with '09'</li>
                    <li><strong>Birthday:</strong> Optional, must be 18+ years old</li>
                    <li><strong>Department & Role:</strong> Required for ID generation</li>
                    <li><strong>Face Image:</strong> Required for attendance system</li>
                  </ul>
                </div>

                <div className="row">
                  <div className="col-md-6">
                    {/* Name */}
                    <div className="mb-3">
                      <label className="form-label">
                        <i className="bi bi-person me-1"></i>
                        Full Name *
                      </label>
                      <input 
                        type="text" 
                        className="form-control"
                        value={newEmployee.name}
                        onChange={(e) => setNewEmployee({...newEmployee, name: e.target.value})}
                        placeholder="e.g., Juan Dela Cruz"
                        required
                      />
                    </div>

                    {/* Email */}
                    <div className="mb-3">
                      <label className="form-label">
                        <i className="bi bi-envelope me-1"></i>
                        Email *
                        <span className="text-danger"> (Required for login)</span>
                      </label>
                      <input 
                        type="email" 
                        className="form-control"
                        value={newEmployee.email}
                        onChange={(e) => setNewEmployee({...newEmployee, email: e.target.value})}
                        placeholder="e.g., juan.delacruz@gmail.com"
                        required
                      />
                      <small className="text-muted">Must end with @gmail.com or @yahoo.com</small>
                    </div>

                    {/* Password Field */}
                    <div className="mb-3">
                      <label className="form-label">
                        <i className="bi bi-lock me-1"></i>
                        Password *
                        <span className="text-danger"> (Required for login)</span>
                      </label>
                      <div className="input-group">
                        <input 
                          type={showPassword ? 'text' : 'password'}
                          className="form-control"
                          value={newEmployee.password}
                          onChange={(e) => setNewEmployee({...newEmployee, password: e.target.value})}
                          placeholder="Enter password (min. 8 characters)"
                          required
                          minLength="8"
                        />
                        <button
                          type="button"
                          className="btn btn-outline-secondary"
                          onClick={() => setShowPassword(!showPassword)}
                          tabIndex="-1"
                        >
                          <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                        </button>
                      </div>
                      <small className="text-muted">Minimum 8 characters long</small>
                    </div>

                    {/* Contact Number */}
                    <div className="mb-3">
                      <label className="form-label">
                        <i className="bi bi-telephone me-1"></i>
                        Contact Number
                        <span className="text-muted small"> (Optional)</span>
                      </label>
                      <input 
                        type="text" 
                        className="form-control"
                        value={newEmployee.contact_number}
                        onChange={(e) => setNewEmployee({...newEmployee, contact_number: e.target.value})}
                        placeholder="e.g., 09123456789"
                        maxLength="11"
                      />
                      <small className="text-muted">Must be 11 digits starting with '09'</small>
                    </div>

                    {/* Profile Picture */}
                    <div className="mb-3">
                      <label className="form-label">
                        <i className="bi bi-image me-1"></i>
                        Profile Picture (Optional)
                      </label>
                      <input
                        type="file"
                        className="form-control"
                        accept="image/*"
                        onChange={handleProfileChange}
                      />
                      {profilePreview && (
                        <div className="mt-2">
                          <img
                            src={profilePreview}
                            alt="profile preview"
                            className="rounded-circle"
                            width="80"
                            height="80"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="col-md-6">
                    {/* Role - Role-based restriction applied */}
                    <div className="mb-3">
                      <label className="form-label">
                        <i className="bi bi-person-badge me-1"></i>
                        Role *
                      </label>
                      <select 
                        className="form-select"
                        value={newEmployee.role}
                        onChange={handleRoleChange}
                      >
                        {availableRoles.map(role => (
                          <option key={role} value={role}>{role}</option>
                        ))}
                      </select>
                      {user?.role !== 'Admin' && (
                        <small className="text-muted">
                          {availableRoles.includes('Admin') ? 'You can create Admin accounts' : 'Admin accounts can only be created by Administrators'}
                        </small>
                      )}
                    </div>

                    {/* Department */}
                    <div className="mb-3">
                      <label className="form-label">
                        <i className="bi bi-building me-1"></i>
                        Department *
                      </label>
                      <select 
                        className="form-select"
                        value={newEmployee.department}
                        onChange={handleDepartmentChange}
                      >
                        <option value="">Select Department</option>
                        {departments.length > 0 ? (
                          departments.map((dept, index) => (
                            <option key={index} value={dept}>
                              {dept}
                            </option>
                          ))
                        ) : (
                          <>
                            <option value="Information Technology">Information Technology</option>
                            <option value="Human Resources">Human Resources</option>
                            <option value="Finance">Finance</option>
                            <option value="Operations">Operations</option>
                            <option value="Sales">Sales</option>
                            <option value="Marketing">Marketing</option>
                            <option value="Production">Production</option>
                            <option value="Logistics">Logistics</option>
                          </>
                        )}
                      </select>
                      <small className="text-muted">
                        Departments loaded from MongoDB: {departments.length} found
                      </small>
                    </div>

                    {/* Birthday */}
                    <div className="mb-3">
                      <label className="form-label">
                        <i className="bi bi-calendar-event me-1"></i>
                        Birthday
                        <span className="text-muted small"> (Optional)</span>
                      </label>
                      <input 
                        type="date" 
                        className="form-control"
                        value={newEmployee.birthday}
                        onChange={(e) => setNewEmployee({...newEmployee, birthday: e.target.value})}
                        max={new Date().toISOString().split('T')[0]}
                      />
                      <small className="text-muted">Must be 18+ years old</small>
                    </div>

                    {/* Face Recognition Image */}
                    <div className="mb-4">
                      <label className="form-label">
                        <i className="bi bi-camera me-1"></i>
                        Face Recognition Image *
                        <span className="text-danger"> (Required for attendance)</span>
                      </label>
                      

                      {/* Hidden file input */}
                      <input
                        id="face-image-input"
                        type="file"
                        className="d-none"
                        accept="image/*"
                        onChange={handleFaceImageChange}
                      />

                      {/* Camera/File Selection Buttons */}
                      <div className="d-flex gap-2 mb-3">
                        <button
                          type="button"
                          className="btn btn-outline-primary flex-fill"
                          onClick={() => setShowCamera(true)}
                          disabled={showCamera}
                        >
                          <i className="bi bi-camera me-2"></i>
                          Use Camera
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline-secondary flex-fill"
                          onClick={handleFileButtonClick}
                          disabled={showCamera}
                        >
                          <i className="bi bi-folder2-open me-2"></i>
                          Choose File
                        </button>
                      </div>

                      {/* Camera Preview */}
                      {showCamera && (
                        <div className="card mb-3">
                          <div className="card-header bg-dark text-white py-2">
                            <div className="d-flex justify-content-between align-items-center">
                              <span>
                                <i className="bi bi-camera-video me-2"></i>
                                Camera Preview
                              </span>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-light"
                                onClick={stopCamera}
                              >
                                <i className="bi bi-x-lg"></i>
                              </button>
                            </div>
                          </div>
                          <div className="card-body p-2">
                            {cameraError ? (
                              <div className="alert alert-danger mb-0">
                                <i className="bi bi-exclamation-triangle me-2"></i>
                                {cameraError}
                              </div>
                            ) : (
                              <>
                                <video
                                  ref={videoRef}
                                  autoPlay
                                  playsInline
                                  className="w-100 rounded"
                                  style={{ maxHeight: '300px', objectFit: 'cover' }}
                                />
                                <canvas ref={canvasRef} className="d-none" />
                                <div className="d-flex gap-2 mt-3">
                                  <button
                                    type="button"
                                    className="btn btn-success flex-fill"
                                    onClick={capturePhoto}
                                    disabled={capturing || !cameraStream}
                                  >
                                    {capturing ? (
                                      <>
                                        <span className="spinner-border spinner-border-sm me-2"></span>
                                        Capturing...
                                      </>
                                    ) : (
                                      <>
                                        <i className="bi bi-camera me-2"></i>
                                        Capture Photo
                                      </>
                                    )}
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={stopCamera}
                                  >
                                    Cancel
                                  </button>
                                </div>
                                <p className="text-muted small mt-2 mb-0">
                                  <i className="bi bi-info-circle me-1"></i>
                                  Position your face clearly in the frame and click Capture
                                </p>
                              </>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Face Preview */}
                      {facePreview && !showCamera && (
                        <div className="mt-3 p-3 border rounded">
                          <div className="d-flex align-items-center gap-3">
                            <img
                              src={facePreview}
                              alt="face preview"
                              className="rounded"
                              width="120"
                              height="120"
                              style={{objectFit: 'cover'}}
                            />
                            <div className="flex-grow-1">
                              <span className="badge bg-primary mb-2">Face Preview</span>
                              <p className="small text-muted mb-2">
                                This image will be converted to base64 and stored in MongoDB.
                              </p>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-warning"
                                onClick={retakePhoto}
                              >
                                <i className="bi bi-arrow-repeat me-1"></i>
                                Retake / Choose New
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* No image selected message */}
                      {!facePreview && !showCamera && (
                        <div className="alert alert-secondary py-3 text-center mb-0">
                          <i className="bi bi-camera fs-1 d-block mb-2"></i>
                          <p className="mb-0">No face image selected yet.</p>
                          <small className="text-muted">
                            Click "Use Camera" to take a photo or "Choose File" to upload an image.
                          </small>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="d-flex justify-content-between mt-4">
                  <button 
                    className="btn btn-secondary"
                    onClick={() => {
                      setView("status");
                      setNewEmployee({
                        name: "",
                        email: "",
                        password: "",
                        role: "Employee",
                        department: "",
                        contact_number: "",
                        birthday: "",
                        profile_picture: null,
                        face_image: null
                      });
                      setProfilePreview(null);
                      setFacePreview(null);
                      setGeneratedIdPreview("");
                      setShowPassword(false);
                      stopCamera();
                    }}
                    disabled={extractingFeatures}
                  >
                    Cancel
                  </button>
                  <button 
                    className="btn btn-primary"
                    onClick={handleCreateEmployee}
                    disabled={
                      !newEmployee.name || 
                      !newEmployee.email ||
                      !newEmployee.password ||
                      newEmployee.password.length < 8 ||
                      !newEmployee.department || 
                      !newEmployee.face_image || 
                      extractingFeatures ||
                      !canCreateRole(newEmployee.role)
                    }
                  >
                    {extractingFeatures ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2"></span>
                        Creating Employee...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-save me-1"></i>
                        Create Employee
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AccountManagement;