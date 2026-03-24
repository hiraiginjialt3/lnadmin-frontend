import axios from 'axios';
import { API_BASE_URL } from '../config';

// Base URLs - Now using environment-based configuration
const FLASK_BASE = API_BASE_URL.replace('/api', '');
const API_BASE = API_BASE_URL;

// Create axios instances
const FlaskAPI = axios.create({
    baseURL: FLASK_BASE,
    headers: {
        'Content-Type': 'application/json',
    },
});

const API = axios.create({
    baseURL: API_BASE,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add request interceptor for debugging
API.interceptors.request.use(request => {
    console.log('API Request:', request.method.toUpperCase(), request.url);
    return request;
});

// Add response interceptor for error handling
API.interceptors.response.use(
    response => response,
    error => {
        console.error('API Error:', error.response?.status, error.response?.data);
        return Promise.reject(error);
    }
);

// Health & System Status
export const getHealth = () => FlaskAPI.get('/health');
export const getSyncStatus = () => FlaskAPI.get('/check_sync_status');
export const syncNow = () => FlaskAPI.post('/sync_now');
// Employee Management
export const getAllEmployees = () => API.get('/employees');
//api/employee/{id}
export const getEmployee = (employeeId) => API.get(`/employee/${employeeId}`);
export const createEmployee = (employeeData) => {
    const formData = new FormData();
    Object.keys(employeeData).forEach(key => {
        if (employeeData[key] !== null && employeeData[key] !== undefined) {
            formData.append(key, employeeData[key]);
        }
    });
    return API.post('/employees', formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });
};

export const getLeaveStats = () => {
  return axios.get(`${API_BASE}/leave/stats`);
};

//api/employees/{id}
export const updateEmployee = (employeeId, employeeData) => {
    const formData = new FormData();
    Object.keys(employeeData).forEach(key => {
        if (employeeData[key] !== null && employeeData[key] !== undefined) {
            formData.append(key, employeeData[key]);
        }
    });
    return API.put(`/employees/${employeeId}`, formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });
};

export const updateEmployeeStatus = (employeeId, status) => 
    API.put(`/employees/${employeeId}/status`, { status });

// Face Recognition (Feature extraction disabled - dlib not available)
export const extractFaceFeatures = (employeeId, name, faceImage) => {
    const formData = new FormData();
    formData.append('employee_id', employeeId);
    formData.append('name', name);
    formData.append('face_image', faceImage);
    return API.post('/extract-face-features', formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });
};

export const processAllFaces = () => API.post('/process-all-faces');

export const syncAttendanceDB = () => 
    API.post('/sync/attendance-db');

// Dashboard Stats
export const getDashboardStats = () => API.get('/dashboard/stats');

// System Status
export const getSystemStatus = () => API.get('/system/status');

// Today's Attendance
export const getTodayAttendance = () => API.get('/attendance/today');

// ========== VIOLATIONS ==========
export const getEmployeeViolations = () => API.get('/violations');

export const createEmployeeViolation = (violationData) => 
    API.post('/violations', violationData);

export const deleteEmployeeViolation = (id) => 
    API.delete(`/violations/${id}`);

export const registerFace = extractFaceFeatures;

// Face recognition is disabled (dlib not available on Render)
export const recognizeFace = (imageFile) =>
    Promise.resolve({
        data: {
            success: false,
            message: "Face recognition is disabled on this server",
            employee_id: null,
            employee_name: null,
            confidence: 0
        }
    });

// Updated clock-in/out to use real endpoints
export const clockIn = (data) => API.post('/attendance/clock-in', data);

export const clockOut = (data) => API.post('/attendance/clock-out', data);

// Updated getAttendance to use real endpoint
export const getAttendance = (employeeId, params) => 
    API.get(`/attendance/employee/${employeeId}/range`, { params });

// Updated syncMongoDB to use real endpoint
export const syncMongoDB = () => API.post('/sync/mongodb');

// Updated uploadProfilePicture to use real endpoint
export const uploadProfilePicture = (employeeId, file) => {
    const formData = new FormData();
    formData.append('profile_picture', file);
    return API.post(`/upload/profile-picture/${employeeId}`, formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });
};

// MongoDB Attendance
export const getMongoDBAttendance = (date = null) => {
  const url = date 
    ? `/attendance/mongodb?date=${date}`
    : `/attendance/mongodb`;
  return API.get(url);
};

export const getTodayMongoDBAttendance = () => 
  API.get('/attendance/mongodb/today');

export const getViolations = getEmployeeViolations;

export const createViolation = createEmployeeViolation;
export const deleteViolation = deleteEmployeeViolation;

export const getDepartments = () => API.get('/departments');
export const getEmployeesList = () => API.get('/employees-list');
export const getEmployeeDetails = (employeeId) => API.get(`/employee-details/${employeeId}`);
export const getEmployeesDropdown = () => API.get('/employees-dropdown');
// Get all managers
export const getAvailableManagers = () => API.get('/managers');

// Create department
export const createDepartment = (departmentData) => {
    return API.post('/departments', departmentData)
        .then(response => {
            console.log('Create department response:', response);
            return response;
        })
        .catch(error => {
            console.error('Create department error:', error);
            throw error;
        });
};

// Update department
export const updateDepartment = (id, departmentData) => 
    API.put(`/departments/${id}`, departmentData);

// Delete department
export const deleteDepartment = (id) => 
    API.delete(`/departments/${id}`);

// ========== PAYROLL ==========
export const getWeeklyPayroll = (params = {}) => {
    const queryParams = new URLSearchParams();
    console.log("Fetching payroll with params:", params);
    if (params.week_start) queryParams.append('week_start', params.week_start);
    if (params.week_end) queryParams.append('week_end', params.week_end);
    if (params.department && params.department !== 'All') queryParams.append('department', params.department);
    if (params.status && params.status !== 'All') queryParams.append('status', params.status);
    const queryString = queryParams.toString();
    const url = `/payroll/weekly${queryString ? `?${queryString}` : ''}`;
    return API.get(url);
};

export const saveWeeklyPayroll = (data) => API.post('/payroll/weekly', data);
export const deleteWeeklyPayroll = (id) => API.delete(`/payroll/weekly/${id}`);
export const autoGenerateWeeklyPayroll = (data) => API.post('/payroll/weekly/auto-generate', data);
export const deleteWeeklyPayrollByWeek = (weekData) => {
    return API.delete(`/payroll/weekly/by-week?week_start=${encodeURIComponent(weekData.week_start)}&week_end=${encodeURIComponent(weekData.week_end)}`);
};

// ========== BENEFITS API - COMPLETE ==========

export const getBenefits = (signal) => API.get('/benefits', { signal });
export const saveBenefits = (data) => API.post('/benefits', data);
export const getBenefitsByEmployeeId = (employeeId) => 
    API.get(`/benefits/employee/${employeeId}`);
export const deleteBenefits = (employeeId) => 
    API.delete(`/benefits/delete/${employeeId}`);
export const getBenefitsStats = () => API.get('/benefits/stats');
export const saveWeeklyBenefits = (data) => 
    API.post('/benefits/weekly', data);
export const getWeeklyBenefits = () => 
    API.get('/benefits/weekly');
export const getBenefitsForPayroll = (employeeId) => 
    API.get(`/benefits/payroll-deductions/${employeeId}`);
export const getEmployeeHourlyRate = (employeeId) => 
    API.get(`/employee/${employeeId}/hourly-rate`);

// ========== SSS BRACKETS API - COMPLETE ==========
export const getSssBrackets = (signal) => API.get('/sss-brackets', { signal });
export const getSssBracketById = (id) => API.get(`/sss-brackets/${id}`);
export const createSssBracket = (data) => API.post('/sss-brackets', data);
export const updateSssBracket = (id, data) => API.put(`/sss-brackets/${id}`, data);
export const deleteSssBracket = (id) => API.delete(`/sss-brackets/${id}`);

//Bulk operations for fast performance
export const bulkCreateSssBrackets = (brackets, deleteExisting = true) => 
    API.post('/sss-brackets/bulk', { brackets, deleteExisting });

//Delete all brackets in one operation
export const deleteAllSssBrackets = () => 
    API.delete('/sss-brackets/all');

//Preview brackets before generating
export const previewSssBrackets = (settings) => 
    API.post('/sss-brackets/preview', settings);

//sssBracketsAPI with all operations
export const sssBracketsAPI = {
    getAll: getSssBrackets,
    getById: getSssBracketById,
    create: createSssBracket,
    update: updateSssBracket,
    delete: deleteSssBracket,
    bulkCreate: bulkCreateSssBrackets,
    deleteAll: deleteAllSssBrackets,
    preview: previewSssBrackets
};

// ========== ATTENDANCE SETTINGS API ==========
export const getAttendanceSettings = () => API.get('/attendance/settings');
export const saveAttendanceSettings = (settings) => API.post('/attendance/settings', settings);
export const attendanceSettingsAPI = {
    get: getAttendanceSettings,
    save: saveAttendanceSettings
};
export const getAttendanceByDateRange = (employeeId, startDate, endDate) => {
    return API.get(`/attendance/employee/${employeeId}/range`, {
        params: {
            start_date: startDate,
            end_date: endDate
        }
    });
};
export const getAttendanceByEmployeeAndDateRange = (params) => {
    const encodedName = encodeURIComponent(params.employee_name);
    return API.get(`/attendance/employee/${encodedName}`, {
        params: {
            start_date: params.start_date,
            end_date: params.end_date
        }
    });
};

// Add this new function to your attendanceAPI
export const getAttendanceByEmployeeNameAndDateRange = (params) => {
    const encodedName = encodeURIComponent(params.employee_name);
    return API.get(`/attendance/employee-by-name/${encodedName}/range`, {
        params: {
            start_date: params.start_date,
            end_date: params.end_date
        }
    });
};

// ========== BULK RATE UPDATE ==========
export const bulkUpdateEmployeeRates = (rateUpdates) => {
    return API.post('/employees/bulk-update-rates', { employees: rateUpdates });
};

export const updateSimpleRate = (employeeId, hourlyRate) => {
    const formData = new FormData();
    formData.append('hourly_rate', parseFloat(hourlyRate) || 500);
    
    return API.post(`/update-employee-rate/${employeeId}`, formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });
};

// ========== GROUPED APIS ==========

export const employeeAPI = {
    getAll: getAllEmployees,
    getById: getEmployee,
    create: createEmployee,
    update: updateEmployee,
    updateStatus: updateEmployeeStatus,
    updateSimpleRate: updateSimpleRate,
    bulkUpdateRates: bulkUpdateEmployeeRates,
    getHourlyRate: getEmployeeHourlyRate,
};

export const faceAPI = {
    register: extractFaceFeatures,
    recognize: recognizeFace,
    processAll: processAllFaces,
};

export const systemAPI = {
    getDashboardStats,
    getSystemStatus,
    getHealth,
    getSyncStatus,
    syncMongoDB,
    syncNow,
    syncAttendanceDB,
};

export const attendanceAPI = {
    clockIn,
    clockOut,
    getAttendance,
    getTodayAttendance,
    getMongoDBAttendance,
    getTodayMongoDBAttendance,
    getByDateRange: getAttendanceByDateRange,
    getByEmployeeAndDateRange: getAttendanceByEmployeeAndDateRange,
    getByEmployeeNameAndDateRange: getAttendanceByEmployeeNameAndDateRange,
};

export const uploadAPI = {
    uploadProfile: uploadProfilePicture,
};

export const violationAPI = {
    getAll: getEmployeeViolations,
    create: createEmployeeViolation,
    delete: deleteEmployeeViolation,
};

export const departmentAPI = {
    getAll: getDepartments,
    getManagers: getAvailableManagers,
    create: createDepartment,
    update: updateDepartment,
    delete: deleteDepartment,
};

export const weeklyPayrollAPI = {
    getAll: getWeeklyPayroll,
    save: saveWeeklyPayroll,
    delete: deleteWeeklyPayroll,
    autoGenerate: autoGenerateWeeklyPayroll,
    deleteByWeek: deleteWeeklyPayrollByWeek
};

export const benefitsAPI = {
    getAll: getBenefits,
    save: saveBenefits,
    getByEmployeeId: getBenefitsByEmployeeId,
    delete: deleteBenefits,
    getStats: getBenefitsStats,
    saveWeekly: saveWeeklyBenefits,
    getWeekly: getWeeklyBenefits,
    getForPayroll: getBenefitsForPayroll
};

export default API;