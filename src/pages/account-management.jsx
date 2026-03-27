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
  const [archiving, setArchiving] = useState(false);
  const [systemHealth, setSystemHealth] = useState({});
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [archivePassword, setArchivePassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  
  // Modal password visibility states
  const [showModalPassword, setShowModalPassword] = useState(false);
  const [showModalConfirmPassword, setShowModalConfirmPassword] = useState(false);
  
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
  
  // Validation error states
  const [validationErrors, setValidationErrors] = useState({
    name: "",
    email: "",
    password: "",
    contact_number: "",
    birthday: "",
    department: "",
    role: "",
    face_image: ""
  });
  
  // Camera states
  const [showCamera, setShowCamera] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  const [cameraError, setCameraError] = useState("");
  const [capturing, setCapturing] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  
  // Password visibility state for employee creation
  const [showPassword, setShowPassword] = useState(false);
  
  // Add state for generated ID preview
  const [generatedIdPreview, setGeneratedIdPreview] = useState("");
  
  // State for departments from MongoDB
  const [departments, setDepartments] = useState([]);
  
  // Helper function to show alerts
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Define available roles based on current user's role
  const getAvailableRoles = () => {
    const userRole = user?.role || 'Admin';
    
    const rolePermissions = {
      Admin: ['Admin', 'HR', 'Accountant', 'Employee'],
      HR: ['HR', 'Accountant', 'Employee'],
      Accountant: ['Accountant', 'Employee'],
      Employee: []
    };
    
    return rolePermissions[userRole] || [];
  };

  // Check if user can create a specific role
  const canCreateRole = (role) => {
    const availableRoles = getAvailableRoles();
    return availableRoles.includes(role);
  };

  // Validation functions
  const validateName = (name) => {
    if (!name || name.trim().length < 2) {
      return "Name must be at least 2 characters long";
    }
    return "";
  };

  const validateEmail = (email) => {
    if (!email) {
      return "Email is required";
    }
    const emailLower = email.toLowerCase();
    if (!emailLower.endsWith('@gmail.com') && !emailLower.endsWith('@yahoo.com')) {
      return "Email must end with @gmail.com or @yahoo.com";
    }
    return "";
  };

  const validatePassword = (password) => {
    if (!password) {
      return "Password is required";
    }
    if (password.length < 8) {
      return "Password must be at least 8 characters long";
    }
    return "";
  };

  const validateContactNumber = (contactNumber) => {
    if (!contactNumber) return ""; // Optional field
    const phoneRegex = /^09\d{9}$/;
    if (!phoneRegex.test(contactNumber)) {
      return "Contact number must be 11 digits starting with '09' (e.g., 09123456789)";
    }
    return "";
  };

  const validateBirthday = (birthday) => {
    if (!birthday) return ""; // Optional field
    
    const birthDate = new Date(birthday);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    if (age < 18) {
      return "Employee must be at least 18 years old";
    }
    return "";
  };

  const validateDepartment = (department) => {
    if (!department) {
      return "Department is required";
    }
    return "";
  };

  const validateRole = (role) => {
    if (!role) {
      return "Role is required";
    }
    if (!canCreateRole(role)) {
      return `You don't have permission to create ${role} accounts`;
    }
    return "";
  };

  const validateFaceImage = (faceImage) => {
    if (!faceImage) {
      return "Face recognition image is required for attendance system";
    }
    return "";
  };

  // Validate all fields before submission
  const validateForm = () => {
    const errors = {
      name: validateName(newEmployee.name),
      email: validateEmail(newEmployee.email),
      password: validatePassword(newEmployee.password),
      contact_number: validateContactNumber(newEmployee.contact_number),
      birthday: validateBirthday(newEmployee.birthday),
      department: validateDepartment(newEmployee.department),
      role: validateRole(newEmployee.role),
      face_image: validateFaceImage(newEmployee.face_image)
    };
    
    setValidationErrors(errors);
    
    // Check if there are any errors
    return !Object.values(errors).some(error => error !== "");
  };

  // Real-time validation for input fields
  const validateField = (field, value) => {
    let error = "";
    switch(field) {
      case 'name':
        error = validateName(value);
        break;
      case 'email':
        error = validateEmail(value);
        break;
      case 'password':
        error = validatePassword(value);
        break;
      case 'contact_number':
        error = validateContactNumber(value);
        break;
      case 'birthday':
        error = validateBirthday(value);
        break;
      case 'department':
        error = validateDepartment(value);
        break;
      case 'role':
        error = validateRole(value);
        break;
      case 'face_image':
        error = validateFaceImage(value);
        break;
      default:
        break;
    }
    
    setValidationErrors(prev => ({...prev, [field]: error}));
    return error;
  };

  // Check if form is valid for button enable/disable
  const isFormValid = () => {
    // Check required fields
    if (!newEmployee.name) return false;
    if (!newEmployee.email) return false;
    if (!newEmployee.password || newEmployee.password.length < 8) return false;
    if (!newEmployee.department) return false;
    if (!newEmployee.face_image) return false;
    if (!canCreateRole(newEmployee.role)) return false;
    
    // Check validation errors
    if (validationErrors.name) return false;
    if (validationErrors.email) return false;
    if (validationErrors.password) return false;
    if (validationErrors.contact_number) return false;
    if (validationErrors.birthday) return false;
    if (validationErrors.department) return false;
    if (validationErrors.role) return false;
    if (validationErrors.face_image) return false;
    
    return true;
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
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const context = canvas.getContext('2d');
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      canvas.toBlob((blob) => {
        const file = new File([blob], "camera_capture.jpg", { type: "image/jpeg" });
        
        setFacePreview(URL.createObjectURL(blob));
        setNewEmployee({...newEmployee, face_image: file});
        validateField('face_image', file);
        
        stopCamera();
        setCapturing(false);
      }, 'image/jpeg', 0.95);
    }
  };

  // Retake photo function
  const retakePhoto = () => {
    setFacePreview(null);
    setNewEmployee({...newEmployee, face_image: null});
    validateField('face_image', null);
    setShowCamera(true);
  };

  // MODIFIED: Enhanced fetchEmployees to get profile_image_base64
  const fetchEmployees = useCallback(async () => {
    try {
      setLoading(true);
      const response = await API.get('/employees');
      const data = response.data;
      if (data.success) {
        const employeesWithFullData = await Promise.all(
          data.employees.map(async (emp) => {
            try {
              const faceResponse = await API.get(`/employee/${emp.employee_id}/face-info`);
              let hasFaceData = false;
              if (faceResponse.data) {
                hasFaceData = faceResponse.data.has_face_data;
              }
              
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

  // Queue employee for archive when deactivated
  const queueEmployeeForArchive = useCallback(async (employeeId, employeeName) => {
    try {
      await API.post('/archive/queue-employee', { 
        employee_id: employeeId, 
        employee_name: employeeName 
      });
      console.log(`[QUEUE] ${employeeName} queued for archive`);
    } catch (error) {
      console.error("Queue error:", error);
    }
  }, []);

  // Open password modal - reset fields
  const openPasswordModal = () => {
    setArchivePassword("");
    setConfirmPassword("");
    setPasswordError("");
    setShowModalPassword(false);
    setShowModalConfirmPassword(false);
    setShowPasswordModal(true);
  };

  // Close password modal
  const closePasswordModal = () => {
    setShowPasswordModal(false);
    setArchivePassword("");
    setConfirmPassword("");
    setPasswordError("");
    setShowModalPassword(false);
    setShowModalConfirmPassword(false);
  };

  // Toggle modal password visibility
  const toggleModalPasswordVisibility = () => {
    setShowModalPassword(!showModalPassword);
  };

  // Toggle modal confirm password visibility
  const toggleModalConfirmPasswordVisibility = () => {
    setShowModalConfirmPassword(!showModalConfirmPassword);
  };

  // Archive all inactive employees with password
  const handleArchiveInactive = useCallback(async () => {
    // Validate password
    if (archivePassword.length < 6) {
      setPasswordError("Password must be at least 6 characters long");
      return;
    }
    
    if (archivePassword !== confirmPassword) {
      setPasswordError("Passwords do not match");
      return;
    }
    
    setShowPasswordModal(false);
    
    if (!window.confirm(`⚠️ ARCHIVE ALL INACTIVE EMPLOYEES\n\nThis will:\n• Archive all inactive employees to a password-protected ZIP file\n• Remove their data from all databases\n• Download the archive file to your computer\n\nAre you sure you want to continue?`)) {
      return;
    }
    
    setArchiving(true);
    setError("");
    setSuccess("");
    
    try {
      // Make the request with responseType: 'blob' to handle file download
      const response = await API.post('/archive/inactive-employees', 
        { password: archivePassword },
        { responseType: 'blob' }
      );
      
      // Create a blob from the response
      const blob = new Blob([response.data], { 
        type: 'application/zip' 
      });
      
      // Create a download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Get filename from Content-Disposition header or use default
      let filename = 'employee_archive.zip';
      const contentDisposition = response.headers['content-disposition'];
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1].replace(/['"]/g, '');
        }
      }
      
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      // Show success message
      showAlert("success", `
        <div class="text-start">
          <h6 class="mb-3">✅ Archive Complete!</h6>
          <p><strong>File downloaded:</strong> ${filename}</p>
          <p><strong>Password:</strong> <code>${archivePassword}</code></p>
          <p class="mb-0 text-success">The ZIP file has been saved to your Downloads folder.</p>
          <hr class="my-2">
          <p class="small text-muted mb-0">
            <i class="bi bi-info-circle me-1"></i>
            The archived employees have been removed from the system. They can only be restored from this file.
          </p>
        </div>
      `, true);
      
      // Refresh the employee list
      fetchEmployees();
      
    } catch (error) {
      console.error("Archive error:", error);
      
      // Try to parse error response if it's JSON
      if (error.response && error.response.data instanceof Blob) {
        const text = await error.response.data.text();
        try {
          const errorData = JSON.parse(text);
          setError(errorData.message || "Error archiving employees");
        } catch {
          setError("Error archiving employees");
        }
      } else {
        setError(error.response?.data?.message || "Error archiving employees");
      }
    } finally {
      setArchiving(false);
      setArchivePassword("");
      setConfirmPassword("");
    }
  }, [archivePassword, confirmPassword, fetchEmployees]);

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
      validateField('face_image', file);
      setShowCamera(false);
    }
  };

  // Handle file button click
  const handleFileButtonClick = () => {
    stopCamera();
    document.getElementById('face-image-input').click();
  };

  const handleDepartmentChange = (e) => {
    const value = e.target.value;
    setNewEmployee({...newEmployee, department: value});
    validateField('department', value);
  };

  const handleRoleChange = (e) => {
    const selectedRole = e.target.value;
    if (!canCreateRole(selectedRole)) {
      showAlert("warning", `You don't have permission to create ${selectedRole} accounts.`, true);
      return;
    }
    setNewEmployee({...newEmployee, role: selectedRole});
    validateField('role', selectedRole);
  };

  const handleNameChange = (e) => {
    const value = e.target.value;
    setNewEmployee({...newEmployee, name: value});
    validateField('name', value);
  };

  const handleEmailChange = (e) => {
    const value = e.target.value;
    setNewEmployee({...newEmployee, email: value});
    validateField('email', value);
  };

  const handlePasswordChange = (e) => {
    const value = e.target.value;
    setNewEmployee({...newEmployee, password: value});
    validateField('password', value);
  };

  const handleContactNumberChange = (e) => {
    const value = e.target.value;
    setNewEmployee({...newEmployee, contact_number: value});
    validateField('contact_number', value);
  };

  const handleBirthdayChange = (e) => {
    const value = e.target.value;
    setNewEmployee({...newEmployee, birthday: value});
    validateField('birthday', value);
  };

  const handleCreateEmployee = async () => {
    scrollToTop();
    
    // Validate all fields
    if (!validateForm()) {
      // Show first error message
      const firstError = Object.values(validationErrors).find(error => error !== "");
      if (firstError) {
        showAlert("warning", firstError, true);
      }
      return;
    }
    
    try {
      const formData = new FormData();
      formData.append('name', newEmployee.name.trim());
      formData.append('email', newEmployee.email.toLowerCase());
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
      
      // Reset validation errors
      setValidationErrors({
        name: "",
        email: "",
        password: "",
        contact_number: "",
        birthday: "",
        department: "",
        role: "",
        face_image: ""
      });
      
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
          
          if (newStatus === "inactive") {
            await queueEmployeeForArchive(employeeId, employee?.name || 'Unknown');
            showAlert("info", `⚠️ ${employee?.name} has been queued for archiving. They will be archived when you click "Archive All Inactive".`);
          }
          
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
      {/* Password Modal - Fixed with proper focus management and show/hide password */}
      {showPasswordModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} tabIndex="-1">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  <i className="bi bi-lock me-2"></i>
                  Set Archive Password
                </h5>
                <button type="button" className="btn-close" onClick={closePasswordModal}></button>
              </div>
              <div className="modal-body">
                <p className="text-muted mb-3">
                  Set a password to protect the archive ZIP file. This password will be required to extract the archive.
                </p>
                <div className="mb-3">
                  <label className="form-label fw-bold">Password</label>
                  <div className="input-group">
                    <input
                      type={showModalPassword ? "text" : "password"}
                      className="form-control"
                      value={archivePassword}
                      onChange={(e) => setArchivePassword(e.target.value)}
                      placeholder="Enter password (min. 6 characters)"
                      autoFocus
                    />
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      onClick={toggleModalPasswordVisibility}
                    >
                      <i className={`bi ${showModalPassword ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                    </button>
                  </div>
                  <small className="text-muted">Minimum 6 characters</small>
                </div>
                <div className="mb-3">
                  <label className="form-label fw-bold">Confirm Password</label>
                  <div className="input-group">
                    <input
                      type={showModalConfirmPassword ? "text" : "password"}
                      className="form-control"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm password"
                    />
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      onClick={toggleModalConfirmPasswordVisibility}
                    >
                      <i className={`bi ${showModalConfirmPassword ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                    </button>
                  </div>
                </div>
                {passwordError && (
                  <div className="alert alert-danger py-2 mb-0">
                    <i className="bi bi-exclamation-triangle me-2"></i>
                    {passwordError}
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closePasswordModal}>
                  Cancel
                </button>
                <button 
                  type="button" 
                  className="btn btn-primary" 
                  onClick={handleArchiveInactive}
                  disabled={archiving}
                >
                  {archiving ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-1"></span>
                      Archiving...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-archive me-1"></i>
                      Start Archive
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Alert Container */}
      <div id="alert-container"></div>

      {/* Header */}
      <div className="mb-4">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
          <div>
            <h4 className="fw-bold mb-1">Account Management</h4>
            <small className="text-muted">
              Face Recognition Employee Registration
            </small>
          </div>
          <div className="d-flex gap-2 flex-wrap">
            <button 
              className="btn btn-danger btn-sm" 
              onClick={openPasswordModal}
              disabled={archiving || extractingFeatures || employees.filter(e => e.status === 'inactive').length === 0}
            >
              {archiving ? (
                <>
                  <span className="spinner-border spinner-border-sm me-1"></span>
                  Archiving...
                </>
              ) : (
                <>
                  <i className="bi bi-archive me-1"></i>
                  Archive All Inactive
                </>
              )}
            </button>
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
            <div className="col-md-3">
              <small className="d-block text-muted">
                <i className="bi bi-archive me-1 text-warning"></i>
                Inactive Employees
              </small>
              <strong className="text-warning">{employees.filter(e => e.status === 'inactive').length} queued for archive</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Archive Queue Info Card */}
      {employees.filter(e => e.status === 'inactive').length > 0 && (
        <div className="card bg-warning bg-opacity-10 mb-4">
          <div className="card-body py-3">
            <div className="row align-items-center">
              <div className="col-md-8">
                <small className="d-block text-warning">
                  <i className="bi bi-archive me-1"></i>
                  Archive Queue
                </small>
                <strong>
                  {employees.filter(e => e.status === 'inactive').length} inactive employee(s) ready for archive
                </strong>
                <p className="small text-muted mb-0 mt-1">
                  Click "Archive All Inactive" to set a password and permanently archive these employees.
                </p>
              </div>
              <div className="col-md-4 text-end">
                <span className="badge bg-warning text-dark">
                  <i className="bi bi-archive me-1"></i>
                  {employees.filter(e => e.status === 'inactive').length} Pending Archive
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

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
                          {emp.status === "active" ? (
                            <span className="badge bg-success">ACTIVE</span>
                          ) : (
                            <div>
                              <span className="badge bg-danger mb-1">INACTIVE</span>
                              <small className="text-muted d-block">
                                <i className="bi bi-archive me-1"></i>
                                Queued for archive
                              </small>
                            </div>
                          )}
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
                            disabled={extractingFeatures || archiving}
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
                        className={`form-control ${validationErrors.name ? 'is-invalid' : ''}`}
                        value={newEmployee.name}
                        onChange={handleNameChange}
                        placeholder="e.g., Juan Dela Cruz"
                        required
                      />
                      {validationErrors.name && (
                        <div className="invalid-feedback">{validationErrors.name}</div>
                      )}
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
                        className={`form-control ${validationErrors.email ? 'is-invalid' : ''}`}
                        value={newEmployee.email}
                        onChange={handleEmailChange}
                        placeholder="e.g., juan.delacruz@gmail.com"
                        required
                      />
                      {validationErrors.email && (
                        <div className="invalid-feedback">{validationErrors.email}</div>
                      )}
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
                          className={`form-control ${validationErrors.password ? 'is-invalid' : ''}`}
                          value={newEmployee.password}
                          onChange={handlePasswordChange}
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
                      {validationErrors.password && (
                        <div className="invalid-feedback d-block">{validationErrors.password}</div>
                      )}
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
                        className={`form-control ${validationErrors.contact_number ? 'is-invalid' : ''}`}
                        value={newEmployee.contact_number}
                        onChange={handleContactNumberChange}
                        placeholder="e.g., 09123456789"
                        maxLength="11"
                      />
                      {validationErrors.contact_number && (
                        <div className="invalid-feedback">{validationErrors.contact_number}</div>
                      )}
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
                        className={`form-select ${validationErrors.role ? 'is-invalid' : ''}`}
                        value={newEmployee.role}
                        onChange={handleRoleChange}
                      >
                        {availableRoles.map(role => (
                          <option key={role} value={role}>{role}</option>
                        ))}
                      </select>
                      {validationErrors.role && (
                        <div className="invalid-feedback">{validationErrors.role}</div>
                      )}
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
                        className={`form-select ${validationErrors.department ? 'is-invalid' : ''}`}
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
                      {validationErrors.department && (
                        <div className="invalid-feedback">{validationErrors.department}</div>
                      )}
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
                        className={`form-control ${validationErrors.birthday ? 'is-invalid' : ''}`}
                        value={newEmployee.birthday}
                        onChange={handleBirthdayChange}
                        max={new Date().toISOString().split('T')[0]}
                      />
                      {validationErrors.birthday && (
                        <div className="invalid-feedback">{validationErrors.birthday}</div>
                      )}
                      <small className="text-muted">Must be 18+ years old</small>
                    </div>

                    {/* Face Recognition Image */}
                    <div className="mb-4">
                      <label className="form-label">
                        <i className="bi bi-camera me-1"></i>
                        Face Recognition Image *
                        <span className="text-danger"> (Required for attendance)</span>
                      </label>
                      
                      {validationErrors.face_image && !facePreview && !showCamera && (
                        <div className="alert alert-danger py-2 mb-2">
                          <i className="bi bi-exclamation-triangle me-2"></i>
                          {validationErrors.face_image}
                        </div>
                      )}

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
                        <div className={`alert ${validationErrors.face_image ? 'alert-danger' : 'alert-secondary'} py-3 text-center mb-0`}>
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
                      setValidationErrors({
                        name: "",
                        email: "",
                        password: "",
                        contact_number: "",
                        birthday: "",
                        department: "",
                        role: "",
                        face_image: ""
                      });
                      stopCamera();
                    }}
                    disabled={extractingFeatures}
                  >
                    Cancel
                  </button>
                  <button 
                    className="btn btn-primary"
                    onClick={handleCreateEmployee}
                    disabled={!isFormValid() || extractingFeatures}
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
