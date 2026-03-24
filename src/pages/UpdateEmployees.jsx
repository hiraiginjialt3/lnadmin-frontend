import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from '../context/AuthContext';
import API from "../services/api";

const UpdateEmployees = () => {
  const { employeeId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [extractingFace, setExtractingFace] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [employee, setEmployee] = useState({
    name: "",
    email: "",
    role: "",
    department: "",
    contact_number: "",
    profile_picture: null,
    profile_picture_url: "",
    status: "active",
    has_face_data: false,
    profile_image_base64: null,
    face_image_base64: null
  });

  // Face image states
  const [faceImage, setFaceImage] = useState(null);
  const [facePreview, setFacePreview] = useState(null);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  const [cameraError, setCameraError] = useState("");
  const [capturing, setCapturing] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // Password change state
  const [passwordData, setPasswordData] = useState({
    newPassword: "",
    confirmPassword: ""
  });

  // Password visibility toggle
  const [showPassword, setShowPassword] = useState({
    new: false,
    confirm: false
  });

  // Password validation errors
  const [passwordErrors, setPasswordErrors] = useState({
    newPassword: "",
    confirmPassword: ""
  });

  // Password update loading state
  const [updatingPassword, setUpdatingPassword] = useState(false);

  // Departments state - FIXED: Load from MongoDB
  const [departments, setDepartments] = useState([]);

  // Define available roles for update based on current user's role
  const getAvailableRolesForUpdate = () => {
    const userRole = user?.role || 'Admin';
    const currentEmployeeRole = employee.role;
    
    const rolePermissions = {
      Admin: ['Admin', 'HR', 'Accountant', 'Employee'],
      HR: ['HR', 'Accountant', 'Employee'],
      Accountant: ['Accountant', 'Employee'],
      Employee: []
    };
    
    const allowedRoles = rolePermissions[userRole] || [];
    const canChangeRole = userRole !== 'Employee' && 
      (userRole === 'Admin' || (userRole === 'HR' && currentEmployeeRole !== 'Admin'));
    
    return { roles: allowedRoles, canChangeRole };
  };

  // Check if user can update this employee
  const canUpdateEmployee = () => {
    const userRole = user?.role || 'Admin';
    const targetRole = employee.role;
    
    if (userRole === 'Admin') return true;
    if (userRole === 'HR' && targetRole !== 'Admin') return true;
    if (userRole === 'Accountant' && (targetRole === 'Accountant' || targetRole === 'Employee')) return true;
    if (userRole === 'Employee') return false;
    
    return false;
  };

  // Check if user can change the role
  const canChangeRole = () => {
    const userRole = user?.role || 'Admin';
    const targetRole = employee.role;
    
    if (userRole === 'Admin') return true;
    if (userRole === 'HR' && targetRole !== 'Admin') return true;
    if (userRole === 'Accountant' && targetRole === 'Employee') return true;
    
    return false;
  };

  // Get available roles for the dropdown
  const { roles: availableRoles, canChangeRole: roleChangeAllowed } = getAvailableRolesForUpdate();

  // ========== CAMERA FUNCTIONS ==========
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

  // Start camera
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

  // Stop camera
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
        setFaceImage(file);
        
        stopCamera();
        setCapturing(false);
      }, 'image/jpeg', 0.95);
    }
  };

  // Handle file upload for face
  const handleFaceImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFacePreview(URL.createObjectURL(file));
      setFaceImage(file);
      setShowCamera(false);
    }
  };

  // Handle file button click
  const handleFileButtonClick = () => {
    stopCamera();
    document.getElementById('face-image-input').click();
  };

  // Retake photo
  const retakePhoto = () => {
    setFacePreview(null);
    setFaceImage(null);
    setShowCamera(true);
  };

  // Remove face image
  const removeFaceImage = () => {
    setFacePreview(null);
    setFaceImage(null);
  };

  // ========== FETCH DEPARTMENTS FROM MONGODB ==========
  const fetchDepartments = useCallback(async () => {
    try {
      const response = await API.get('/departments');
      const data = response.data;
      
      if (data.success) {
        console.log("Fetched departments:", data.data);
        const departmentNames = data.data.map(dept => dept.departmentName);
        setDepartments(departmentNames);
      } else {
        console.error("Failed to fetch departments:", data.message);
        // Fallback departments
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
        "Sales", 
        "Marketing",
        "Production",
        "Logistics"
      ]);
    }
  }, []);

  // ========== FETCH EMPLOYEE DATA ==========
  const fetchEmployee = useCallback(async () => {
    try {
      setLoading(true);
      const response = await API.get(`/employee/${employeeId}`);
      
      if (response.data.success) {
        const emp = response.data.employee;
        console.log("Fetched employee data:", emp);
        
        // Check if current user can update this employee
        if (!canUpdateEmployee()) {
          setError("You don't have permission to update this employee.");
          setTimeout(() => navigate("/accmanagement"), 2000);
          return;
        }
        
        let profileImageUrl = "";
        if (emp.profile_image_base64) {
          if (emp.profile_image_base64.startsWith('data:image')) {
            profileImageUrl = emp.profile_image_base64;
          } else {
            profileImageUrl = `data:image/jpeg;base64,${emp.profile_image_base64}`;
          }
        }
        
        setEmployee({
          name: emp.name || "",
          email: emp.email || "",
          role: emp.role || "Employee",
          department: emp.department || "",
          contact_number: emp.contact_number || "",
          profile_picture: null,
          profile_picture_url: profileImageUrl,
          status: emp.status || "active",
          has_face_data: emp.has_face_data || false,
          profile_image_base64: emp.profile_image_base64,
          face_image_base64: emp.face_image_base64
        });

        if (emp.face_image_base64) {
          let faceImageUrl;
          if (emp.face_image_base64.startsWith('data:image')) {
            faceImageUrl = emp.face_image_base64;
          } else {
            faceImageUrl = `data:image/jpeg;base64,${emp.face_image_base64}`;
          }
          setFacePreview(faceImageUrl);
        }
      } else {
        setError("Employee not found");
      }
    } catch (err) {
      console.error("Error fetching employee:", err);
      setError("Failed to load employee data");
    } finally {
      setLoading(false);
    }
  }, [employeeId, navigate]);

  // ========== INITIAL LOAD ==========
  useEffect(() => {
    fetchDepartments();
    if (employeeId) {
      fetchEmployee();
    }
  }, [employeeId, fetchDepartments, fetchEmployee]);

  // Handle form changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setEmployee(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle role change with permission check
  const handleRoleChange = (e) => {
    const newRole = e.target.value;
    
    if (!roleChangeAllowed) {
      setError("You don't have permission to change the role.");
      return;
    }
    
    if (!availableRoles.includes(newRole)) {
      setError(`You don't have permission to set role to ${newRole}.`);
      return;
    }
    
    setEmployee(prev => ({
      ...prev,
      role: newRole
    }));
  };

  // Handle password changes
  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({
      ...prev,
      [name]: value
    }));

    setPasswordErrors(prev => ({
      ...prev,
      [name]: ""
    }));
  };

  // Toggle password visibility
  const togglePasswordVisibility = (field) => {
    setShowPassword(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  // Validate password
  const validatePassword = () => {
    const errors = {
      newPassword: "",
      confirmPassword: ""
    };
    let isValid = true;

    if (passwordData.newPassword || passwordData.confirmPassword) {
      if (passwordData.newPassword && passwordData.newPassword.length < 6) {
        errors.newPassword = "Password must be at least 6 characters long";
        isValid = false;
      }

      if (passwordData.newPassword !== passwordData.confirmPassword) {
        errors.confirmPassword = "Passwords do not match";
        isValid = false;
      }
    }

    setPasswordErrors(errors);
    return isValid;
  };

  // Handle profile picture change
  const handleProfileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setEmployee(prev => ({
        ...prev,
        profile_picture: file,
        profile_picture_url: URL.createObjectURL(file)
      }));
    }
  };

  // ========== HANDLE PASSWORD ONLY UPDATE ==========
  const handlePasswordOnlyUpdate = async () => {
    if (!validatePassword()) return;
    
    if (!passwordData.newPassword) {
      setError("Please enter a new password");
      return;
    }
    
    setUpdatingPassword(true);
    setError("");
    setSuccess("");
    
    try {
      const response = await API.put(`/employees/${employeeId}/password`, { 
        password: passwordData.newPassword 
      });
      
      if (response.data.success) {
        setSuccess("✅ Password updated successfully!");
        // Clear password fields
        setPasswordData({ newPassword: "", confirmPassword: "" });
        // Clear password errors
        setPasswordErrors({ newPassword: "", confirmPassword: "" });
      } else {
        setError(response.data.message || "Failed to update password");
      }
    } catch (err) {
      console.error("Password update error:", err);
      setError(err.response?.data?.message || "Error updating password");
    } finally {
      setUpdatingPassword(false);
    }
  };

  // ========== HANDLE FACE UPDATE ==========
  const handleUpdateFace = async () => {
    if (!faceImage) {
      setError("Please select a face image first");
      return;
    }

    if (!window.confirm("This will replace the existing face recognition data. Continue?")) {
      return;
    }

    setExtractingFace(true);
    setError("");
    setSuccess("");

    try {
      const formData = new FormData();
      formData.append('face_image', faceImage);
      formData.append('name', employee.name);

      const response = await API.post(`/employee/${employeeId}/update-face`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (response.data.success) {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64String = reader.result.split(',')[1];
          setEmployee(prev => ({
            ...prev,
            has_face_data: true,
            face_image_base64: base64String
          }));
          
          setSuccess(`
            ✅ Face updated successfully!
            Employee now has face image stored in MongoDB as base64
          `);
        };
        reader.readAsDataURL(faceImage);
      } else {
        setError(response.data.message || "Failed to update face");
      }
    } catch (err) {
      console.error("Face update error:", err);
      setError(err.response?.data?.message || "Error updating face image");
    } finally {
      setExtractingFace(false);
    }
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validatePassword()) {
      return;
    }

    if (!canUpdateEmployee()) {
      setError("You don't have permission to update this employee.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const formData = new FormData();
      
      formData.append('name', employee.name || '');
      formData.append('email', employee.email || '');
      formData.append('role', employee.role || '');
      formData.append('department', employee.department || '');
      formData.append('contact_number', employee.contact_number || '');
      formData.append('status', employee.status || 'active');
      
      if (employee.profile_picture) {
        formData.append('profile_picture', employee.profile_picture);
      } else {
        formData.append('profile_picture', '');
      }

      if (passwordData.newPassword) {
        formData.append('password', passwordData.newPassword);
      }

      const response = await API.put(`/employees/${employeeId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (response.data.success) {
        let message = "Employee information updated successfully!";
        
        if (faceImage) {
          message += " Don't forget to update the face image separately.";
        }
        
        setSuccess(message);
        
        setPasswordData({
          newPassword: "",
          confirmPassword: ""
        });
        
        setTimeout(() => {
          navigate("/accmanagement");
        }, 2000);
      } else {
        setError(response.data.message || "Failed to update employee");
      }
    } catch (err) {
      console.error("Update error:", err);
      setError(err.response?.data?.message || "An error occurred while updating");
    } finally {
      setSaving(false);
    }
  };

  // Handle cancel
  const handleCancel = () => {
    if (faceImage && !window.confirm("You have unsaved face changes. Leave anyway?")) {
      return;
    }
    navigate("/accmanagement");
  };

  if (loading) {
    return (
      <div className="container py-4">
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-2">Loading employee data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-4">
      <div className="card shadow-sm">
        <div className="card-header bg-primary text-white">
          <h5 className="mb-0">
            <i className="bi bi-person-badge me-2"></i>
            Update Employee: {employee.name}
          </h5>
        </div>
        
        <div className="card-body">
          {/* Alerts */}
          {error && (
            <div className="alert alert-danger alert-dismissible fade show">
              <i className="bi bi-exclamation-triangle me-2"></i>
              {error}
              <button 
                type="button" 
                className="btn-close" 
                onClick={() => setError("")}
              ></button>
            </div>
          )}

          {success && (
            <div className="alert alert-success alert-dismissible fade show">
              <i className="bi bi-check-circle me-2"></i>
              {success}
              <button 
                type="button" 
                className="btn-close" 
                onClick={() => setSuccess("")}
              ></button>
            </div>
          )}

          {/* ===== FACE RECOGNITION SECTION ===== */}
          <div className="card border-primary mb-4">
            <div className="card-header bg-primary bg-opacity-10">
              <h6 className="mb-0 fw-bold text-primary">
                <i className="bi bi-camera me-2"></i>
                Face Recognition Data (Stored in MongoDB as Base64)
              </h6>
            </div>
            <div className="card-body">
              <div className="row">
                <div className="col-md-6">
                  {/* Current Face Status */}
                  <div className="mb-3">
                    <label className="form-label fw-bold">Current Face Status</label>
                    <div>
                      {employee.has_face_data ? (
                        <span className="badge bg-success fs-6 p-2">
                          <i className="bi bi-check-circle me-1"></i>
                          Face Registered (Base64 in MongoDB)
                        </span>
                      ) : (
                        <span className="badge bg-warning fs-6 p-2">
                          <i className="bi bi-exclamation-triangle me-1"></i>
                          No Face Data Registered
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Face Image Update Section */}
                  <div className="mt-4">
                    <label className="form-label fw-bold">
                      <i className="bi bi-camera me-1"></i>
                      Update Face Image
                    </label>
                    
                    {/* Hidden file input */}
                    <input
                      id="face-image-input"
                      type="file"
                      className="d-none"
                      accept="image/*"
                      onChange={handleFaceImageChange}
                    />

                    {/* Camera/File Buttons */}
                    <div className="d-flex gap-2 mb-3">
                      <button
                        type="button"
                        className="btn btn-outline-primary flex-fill"
                        onClick={() => setShowCamera(true)}
                        disabled={showCamera || extractingFace}
                      >
                        <i className="bi bi-camera me-2"></i>
                        Use Camera
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline-secondary flex-fill"
                        onClick={handleFileButtonClick}
                        disabled={showCamera || extractingFace}
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
                            </>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Face Preview - New Image */}
                    {facePreview && faceImage && !showCamera && (
                      <div className="mt-3 p-3 border rounded">
                        <div className="d-flex align-items-center gap-3">
                          <img
                            src={facePreview}
                            alt="face preview"
                            className="rounded"
                            width="100"
                            height="100"
                            style={{objectFit: 'cover'}}
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src = 'https://via.placeholder.com/100';
                            }}
                          />
                          <div className="flex-grow-1">
                            <span className="badge bg-info mb-2">New Face Preview</span>
                            <p className="small text-muted mb-2">
                              This will replace existing face data in MongoDB
                            </p>
                            <div className="d-flex gap-2">
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-warning"
                                onClick={retakePhoto}
                                disabled={extractingFace}
                              >
                                <i className="bi bi-arrow-repeat me-1"></i>
                                Retake
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-danger"
                                onClick={removeFaceImage}
                                disabled={extractingFace}
                              >
                                <i className="bi bi-x-circle me-1"></i>
                                Remove
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Update Face Button */}
                    {facePreview && faceImage && !showCamera && (
                      <div className="mt-3">
                        <button
                          type="button"
                          className="btn btn-warning w-100"
                          onClick={handleUpdateFace}
                          disabled={extractingFace || !faceImage}
                        >
                          {extractingFace ? (
                            <>
                              <span className="spinner-border spinner-border-sm me-2"></span>
                              Processing Face...
                            </>
                          ) : (
                            <>
                              <i className="bi bi-cloud-upload me-2"></i>
                              Update Face Image in MongoDB
                            </>
                          )}
                        </button>
                        <small className="text-muted d-block mt-2">
                          <i className="bi bi-info-circle me-1"></i>
                          This will save the face image as base64 in MongoDB (no files on disk)
                        </small>
                      </div>
                    )}

                    {/* Show current face image */}
                    {!facePreview && !showCamera && employee.face_image_base64 && (
                      <div className="mt-3 p-3 border rounded">
                        <div className="d-flex align-items-center gap-3">
                          <img
                            src={`data:image/jpeg;base64,${employee.face_image_base64}`}
                            alt="current face"
                            className="rounded"
                            width="100"
                            height="100"
                            style={{objectFit: 'cover'}}
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src = 'https://via.placeholder.com/100';
                            }}
                          />
                          <div>
                            <span className="badge bg-success mb-2">Current Face Image</span>
                            <p className="small text-muted mb-2">
                              Stored as base64 in MongoDB
                            </p>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-primary"
                              onClick={() => setShowCamera(true)}
                            >
                              <i className="bi bi-camera me-1"></i>
                              Update Face
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="col-md-6">
                  
                </div>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="row">
              {/* Left Column - Profile Picture */}
              <div className="col-md-4">
                <div className="mb-4">
                  <label className="form-label fw-bold">
                    <i className="bi bi-image me-1"></i>
                    Profile Picture
                  </label>
                  <div className="text-center">
                    {employee.profile_picture_url ? (
                      <img
                        src={employee.profile_picture_url}
                        alt="Profile"
                        className="rounded-circle mb-3 border"
                        style={{ width: "200px", height: "200px", objectFit: "cover" }}
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = 'https://via.placeholder.com/200';
                        }}
                      />
                    ) : (
                      <div 
                        className="rounded-circle bg-secondary d-flex align-items-center justify-content-center mb-3 mx-auto"
                        style={{ width: "200px", height: "200px" }}
                      >
                        <i className="bi bi-person text-white" style={{ fontSize: "5rem" }}></i>
                      </div>
                    )}
                    
                    <input
                      type="file"
                      className="form-control"
                      accept="image/*"
                      onChange={handleProfileChange}
                    />
                    <small className="text-muted">
                      Upload new profile picture (optional)
                    </small>
                  </div>
                </div>

                {/* Employee ID Display */}
                <div className="mb-3">
                  <label className="form-label fw-bold">Employee ID</label>
                  <input
                    type="text"
                    className="form-control bg-light"
                    value={employeeId}
                    readOnly
                    disabled
                  />
                  <small className="text-muted">Employee ID cannot be changed</small>
                </div>

                {/* Status */}
                <div className="mb-3">
                  <label className="form-label fw-bold">Status</label>
                  <select
                    name="status"
                    className="form-select"
                    value={employee.status}
                    onChange={handleChange}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              {/* Right Column - Form Fields */}
              <div className="col-md-8">
                <div className="row">
                  {/* Full Name */}
                  <div className="col-md-6 mb-3">
                    <label className="form-label fw-bold">
                      <i className="bi bi-person me-1"></i>
                      Full Name *
                    </label>
                    <input
                      type="text"
                      name="name"
                      className="form-control"
                      value={employee.name}
                      onChange={handleChange}
                      required
                    />
                  </div>

                  {/* Email */}
                  <div className="col-md-6 mb-3">
                    <label className="form-label fw-bold">
                      <i className="bi bi-envelope me-1"></i>
                      Email Address
                    </label>
                    <input
                      type="email"
                      name="email"
                      className="form-control"
                      value={employee.email}
                      onChange={handleChange}
                      placeholder="employee@company.com"
                    />
                  </div>

                  {/* Role - With permission check */}
                  <div className="col-md-6 mb-3">
                    <label className="form-label fw-bold">
                      <i className="bi bi-person-badge me-1"></i>
                      Role *
                    </label>
                    <select
                      name="role"
                      className="form-select"
                      value={employee.role}
                      onChange={handleRoleChange}
                      disabled={!roleChangeAllowed}
                      required
                    >
                      {availableRoles.map(role => (
                        <option key={role} value={role}>{role}</option>
                      ))}
                    </select>
                    {!roleChangeAllowed && (
                      <small className="text-muted text-danger">
                        You don't have permission to change the role of this employee.
                      </small>
                    )}
                  </div>

                  {/* Department - FIXED: Uses departments from MongoDB */}
                  <div className="col-md-6 mb-3">
                    <label className="form-label fw-bold">
                      <i className="bi bi-building me-1"></i>
                      Department *
                    </label>
                    <select
                      name="department"
                      className="form-select"
                      value={employee.department}
                      onChange={handleChange}
                      required
                    >
                      <option value="">Select Department</option>
                      {departments.length > 0 ? (
                        departments.map((dept, index) => (
                          <option key={index} value={dept}>{dept}</option>
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

                  {/* Contact Number */}
                  <div className="col-md-6 mb-3">
                    <label className="form-label fw-bold">
                      <i className="bi bi-phone me-1"></i>
                      Contact Number
                    </label>
                    <input
                      type="text"
                      name="contact_number"
                      className="form-control"
                      value={employee.contact_number}
                      onChange={handleChange}
                      placeholder="09123456789"
                    />
                  </div>

                  {/* Birthday */}
                  <div className="col-md-6 mb-3">
                    <label className="form-label fw-bold">
                      <i className="bi bi-calendar me-1"></i>
                      Birthday
                    </label>
                    <input
                      type="text"
                      className="form-control bg-light"
                      value="Birthdate cannot be changed"
                      readOnly
                      disabled
                    />
                  </div>

                  {/* Password Change Section */}
                  <div className="col-12 mt-4">
                    <div className="card border-warning">
                      <div className="card-header bg-warning bg-opacity-25">
                        <h6 className="mb-0 fw-bold">
                          <i className="bi bi-key me-2"></i>
                          Change Password
                        </h6>
                      </div>
                      <div className="card-body">
                        <div className="row">
                          <div className="col-md-6 mb-3">
                            <label className="form-label fw-bold">New Password</label>
                            <div className="input-group">
                              <input
                                type={showPassword.new ? "text" : "password"}
                                name="newPassword"
                                className={`form-control ${passwordErrors.newPassword ? 'is-invalid' : ''}`}
                                value={passwordData.newPassword}
                                onChange={handlePasswordChange}
                                placeholder="Enter new password"
                                minLength="6"
                              />
                              <button
                                type="button"
                                className="btn btn-outline-secondary"
                                onClick={() => togglePasswordVisibility('new')}
                              >
                                <i className={`bi bi-${showPassword.new ? 'eye-slash' : 'eye'}`}></i>
                              </button>
                            </div>
                            {passwordErrors.newPassword && (
                              <div className="invalid-feedback d-block">
                                {passwordErrors.newPassword}
                              </div>
                            )}
                          </div>

                          <div className="col-md-6 mb-3">
                            <label className="form-label fw-bold">Confirm Password</label>
                            <div className="input-group">
                              <input
                                type={showPassword.confirm ? "text" : "password"}
                                name="confirmPassword"
                                className={`form-control ${passwordErrors.confirmPassword ? 'is-invalid' : ''}`}
                                value={passwordData.confirmPassword}
                                onChange={handlePasswordChange}
                                placeholder="Confirm new password"
                                disabled={!passwordData.newPassword}
                              />
                              <button
                                type="button"
                                className="btn btn-outline-secondary"
                                onClick={() => togglePasswordVisibility('confirm')}
                                disabled={!passwordData.newPassword}
                              >
                                <i className={`bi bi-${showPassword.confirm ? 'eye-slash' : 'eye'}`}></i>
                              </button>
                            </div>
                            {passwordErrors.confirmPassword && (
                              <div className="invalid-feedback d-block">
                                {passwordErrors.confirmPassword}
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* ADDED: Separate Password Update Button */}
                        <div className="row mt-3">
                          <div className="col-12">
                            <button
                              type="button"
                              className="btn btn-warning w-100"
                              onClick={handlePasswordOnlyUpdate}
                              disabled={updatingPassword || !passwordData.newPassword || saving || extractingFace}
                            >
                              {updatingPassword ? (
                                <>
                                  <span className="spinner-border spinner-border-sm me-2"></span>
                                  Updating Password...
                                </>
                              ) : (
                                <>
                                  <i className="bi bi-key me-2"></i>
                                  Update Password Only
                                </>
                              )}
                            </button>
                            <small className="text-muted d-block mt-2 text-center">
                              <i className="bi bi-info-circle me-1"></i>
                              This will update the password without changing other employee information
                            </small>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="d-flex justify-content-between mt-4">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleCancel}
                    disabled={saving || extractingFace || updatingPassword}
                  >
                    <i className="bi bi-x-circle me-1"></i>
                    Cancel
                  </button>
                  
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={saving || extractingFace || updatingPassword}
                  >
                    {saving ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2"></span>
                        Saving Changes...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-save me-1"></i>
                        Save All Changes
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default UpdateEmployees;