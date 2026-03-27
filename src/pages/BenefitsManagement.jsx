import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { benefitsAPI, employeeAPI, sssBracketsAPI, attendanceSettingsAPI, weeklyPayrollAPI } from "../services/api";
import { useCompanySettings } from "../context/CompanySettingsContext";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";

const BenefitsManagement = () => {
  // ========== Get shared company settings ==========
  const { 
    settings: companySettings,
    workDaysPerWeek,
    calculateMonthlySalary,
    calculateWeeklySalary
  } = useCompanySettings();

  // State declarations
  const [employees, setEmployees] = useState([]);
  const [benefits, setBenefits] = useState([]);
  const [sssBrackets, setSssBrackets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [showBracketEditor, setShowBracketEditor] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [editingBracket, setEditingBracket] = useState(null);
  const [validationError, setValidationError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [employeeWeeklySalary, setEmployeeWeeklySalary] = useState(0);
  const [generatingBrackets, setGeneratingBrackets] = useState(false);
  const [deleteAllLoading, setDeleteAllLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingBracketId, setDeletingBracketId] = useState(null);
  
  // ========== NEW: Payroll rates state ==========
  const [payrollRates, setPayrollRates] = useState(new Map());
  const [loadingRates, setLoadingRates] = useState(false);
  const [currentWeekRange, setCurrentWeekRange] = useState({ start: '', end: '' });
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  
  // Cache for API data
  const [lastFetch, setLastFetch] = useState(null);
  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  
  // Bracket settings
  const [bracketSettings, setBracketSettings] = useState({
    min_salary_start: 5250,
    max_salary_end: 40000,
    bracket_interval: 500,
    msc_start: 5000,
    msc_increment: 500,
    regular_msc_cap: 20000,
    ec_standard: 10.00,
    ec_elevated: 30.00,
    ec_threshold: 15000,
    employee_ss_percentage: 5.0,
    employer_ss_percentage: 10.0,
    employee_mpf_percentage: 5.0,
    employer_mpf_percentage: 10.0,
  });
  
  const [formData, setFormData] = useState({
    sss_weekly: 0,
    philhealth_weekly: 0,
    pagibig_weekly: 0,
    sss_loan_weekly: 0,
    pagibig_loan_weekly: 0,
    emergency_weekly: 0,
    other_weekly: 0,
    other_desc: ""
  });
  
  const [bracketForm, setBracketForm] = useState({
    min_salary: '',
    max_salary: '',
    monthly_credit: '',
    regular_ss_base: '',
    mpf_base: '',
    employee_ss_percentage: 5.0,
    employer_ss_percentage: 10.0,
    employee_mpf_percentage: 5.0,
    employer_mpf_percentage: 10.0,
    ec_amount: 10.00,
    is_active: true
  });

  // ============================================
  // HELPER FUNCTIONS
  // ============================================
  
  const formatCurrency = useCallback((amount) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2
    }).format(amount || 0);
  }, []);
  
  // ============================================
  // GET CURRENT WEEK RANGE
  // ============================================
  
  const getCurrentSunday = useCallback(() => {
    const today = new Date();
    const day = today.getDay();
    const daysUntilSaturday = day === 6 ? 0 : 6 - day;
    const saturday = new Date(today);
    saturday.setDate(today.getDate() + daysUntilSaturday);
    const sunday = new Date(saturday);
    sunday.setDate(saturday.getDate() - 6);
    return sunday.toISOString().split('T')[0];
  }, []);
  
  const getCurrentSaturday = useCallback(() => {
    const today = new Date();
    const day = today.getDay();
    const daysUntilSaturday = day === 6 ? 0 : 6 - day;
    const saturday = new Date(today);
    saturday.setDate(today.getDate() + daysUntilSaturday);
    return saturday.toISOString().split('T')[0];
  }, []);
  
  // ============================================
  // FETCH PAYROLL RATES
  // ============================================
  
  const fetchPayrollRates = useCallback(async () => {
    setLoadingRates(true);
    try {
      const weekStart = getCurrentSunday();
      const weekEnd = getCurrentSaturday();
      setCurrentWeekRange({ start: weekStart, end: weekEnd });
      
      const response = await weeklyPayrollAPI.getAll({
        week_start: weekStart,
        week_end: weekEnd
      });
      
      if (response.data.success) {
        const ratesMap = new Map();
        (response.data.data || []).forEach(payroll => {
          if (payroll.employee_id && payroll.hourly_rate) {
            ratesMap.set(payroll.employee_id, payroll.hourly_rate);
          }
        });
        setPayrollRates(ratesMap);
      }
    } catch (error) {
      console.error('[Payroll Rates] Failed to fetch:', error);
    } finally {
      setLoadingRates(false);
    }
  }, [getCurrentSunday, getCurrentSaturday]);
  
  // ============================================
  // GET EMPLOYEE HOURLY RATE FROM PAYROLL
  // ============================================
  
  const getEmployeeHourlyRate = useCallback((employeeId) => {
    const rate = payrollRates.get(employeeId);
    if (rate && rate > 0) return rate;
    
    const employee = employees.find(e => e.employee_id === employeeId);
    if (employee) {
      if (employee.hourly_rate) return employee.hourly_rate;
      if (employee.hourlyRate) return employee.hourlyRate;
      if (employee.rate) return employee.rate;
    }
    
    return companySettings?.default_hourly_rate || 86.87;
  }, [payrollRates, employees, companySettings]);
  
  // ============================================
  // FETCH EMPLOYEE WEEKLY SALARY
  // ============================================
  
  const fetchEmployeeWeeklySalary = useCallback(async (employeeId) => {
    try {
      const hourlyRate = getEmployeeHourlyRate(employeeId);
      
      if (hourlyRate > 0) {
        const hoursPerDay = companySettings?.standard_work_hours || 8;
        const weeklySalary = hourlyRate * hoursPerDay * workDaysPerWeek;
        setEmployeeWeeklySalary(weeklySalary);
        return weeklySalary;
      }
      return 0;
    } catch (error) {
      console.error('[Salary] Error fetching employee:', error);
      return 0;
    }
  }, [workDaysPerWeek, companySettings, getEmployeeHourlyRate]);
  
  // ============================================
  // DOLE HELPER - Convert weekly to monthly salary
  // ============================================
  
  const getDOLEMonthlySalary = useCallback((weeklySalary) => {
    if (!weeklySalary || weeklySalary <= 0) return 0;
    
    const dailyRate = weeklySalary / workDaysPerWeek;
    
    if (workDaysPerWeek === 6) {
      return (dailyRate * 313) / 12;
    } else {
      return (dailyRate * 261) / 12;
    }
  }, [workDaysPerWeek]);
  
  // ============================================
  // BENEFITS CALCULATIONS (DOLE Formula)
  // ============================================
  
  const calculateSSSWeekly = useCallback((weeklySalary, brackets) => {
    if (!weeklySalary || weeklySalary <= 0 || !brackets || brackets.length === 0) {
      return 0;
    }
    
    const monthlySalary = getDOLEMonthlySalary(weeklySalary);
    
    const bracket = brackets.find(b => 
      monthlySalary >= b.min_salary && monthlySalary <= b.max_salary
    );
    
    if (bracket) {
      return Math.round((bracket.employee_contribution / 4) * 100) / 100;
    }
    return 0;
  }, [getDOLEMonthlySalary]);
  
  const calculatePhilHealthWeekly = useCallback((weeklySalary) => {
    if (!weeklySalary || weeklySalary <= 0) return 0;
    
    const monthlySalary = getDOLEMonthlySalary(weeklySalary);
    const monthlyShare = monthlySalary * 0.015;
    
    return Math.round((monthlyShare / 4) * 100) / 100;
  }, [getDOLEMonthlySalary]);
  
  const calculatePagIBIGWeekly = useCallback((weeklySalary) => {
    if (!weeklySalary || weeklySalary <= 0) return 0;
    
    const monthlySalary = getDOLEMonthlySalary(weeklySalary);
    let monthlyContribution = monthlySalary * 0.02;
    monthlyContribution = Math.min(monthlyContribution, 100);
    
    return Math.round((monthlyContribution / 4) * 100) / 100;
  }, [getDOLEMonthlySalary]);
  
  // ============================================
  // DEBOUNCED SEARCH
  // ============================================
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);
  
  // ============================================
  // DATA FETCHING WITH CACHING
  // ============================================
  
  const fetchData = useCallback(async (force = false, signal = null) => {
    const now = Date.now();
    if (!force && lastFetch && (now - lastFetch) < CACHE_DURATION) {
      return;
    }
    
    try {
      setLoading(true);
      const [empRes, benefitsRes, sssRes] = await Promise.all([
        employeeAPI.getAll(signal),
        benefitsAPI.getAll(signal),
        sssBracketsAPI.getAll(signal)
      ]);
      
      if (signal?.aborted) return;
      
      if (empRes.data.success) {
        setEmployees(empRes.data.employees || []);
      }
      if (benefitsRes.data.success) {
        setBenefits(benefitsRes.data.data || []);
      }
      if (sssRes.data.success) {
        const sorted = (sssRes.data.data || []).sort((a, b) => a.min_salary - b.min_salary);
        setSssBrackets(sorted);
      }
      setLastFetch(now);
    } catch (error) {
      if (error.name !== 'AbortError' && error.code !== 'ERR_CANCELED' && !error.message?.includes('canceled')) {
        console.error("Error fetching data:", error);
        setValidationError("Error loading data");
        setTimeout(() => setValidationError(''), 3000);
      }
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, [lastFetch]);
  
  // ============================================
  // MEMOIZED DATA
  // ============================================
  
  const benefitsMap = useMemo(() => {
    const map = new Map();
    benefits.forEach(b => {
      if (b.employee_id) {
        map.set(b.employee_id, b);
      }
    });
    return map;
  }, [benefits]);
  
  const filteredEmployees = useMemo(() => {
    if (!debouncedSearch) return employees;
    const lowerSearch = debouncedSearch.toLowerCase();
    return employees.filter(emp => 
      emp.name?.toLowerCase().includes(lowerSearch) ||
      emp.employee_id?.toLowerCase().includes(lowerSearch) ||
      emp.department?.toLowerCase().includes(lowerSearch)
    );
  }, [employees, debouncedSearch]);
  
  const paginatedEmployees = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredEmployees.slice(start, start + itemsPerPage);
  }, [filteredEmployees, currentPage, itemsPerPage]);
  
  const totalPages = Math.ceil(filteredEmployees.length / itemsPerPage);
  
  const stats = useMemo(() => {
    let totalWeekly = 0;
    let withBenefitsCount = 0;
    
    for (let i = 0; i < benefits.length; i++) {
      const b = benefits[i];
      withBenefitsCount++;
      totalWeekly += (b.sss_weekly || 0) + 
                     (b.philhealth_weekly || 0) + 
                     (b.pagibig_weekly || 0) + 
                     (b.sss_loan_weekly || 0) + 
                     (b.pagibig_loan_weekly || 0) + 
                     (b.emergency_weekly || 0) + 
                     (b.other_weekly || 0);
    }
    
    return {
      totalEmployees: employees.length,
      withBenefits: withBenefitsCount,
      withoutBenefits: employees.length - withBenefitsCount,
      totalWeekly,
      activeBrackets: sssBrackets.filter(b => b.is_active).length
    };
  }, [employees.length, benefits, sssBrackets]);
  
  const sortedBrackets = useMemo(() => {
    return [...sssBrackets].sort((a, b) => a.min_salary - b.min_salary);
  }, [sssBrackets]);
  
  const formTotal = useMemo(() => {
    return Object.entries(formData)
      .filter(([key]) => key.includes('_weekly') && !key.includes('desc'))
      .reduce((sum, [_, value]) => sum + (parseFloat(value) || 0), 0);
  }, [formData]);
  
  // ============================================
  // RECALCULATE BENEFITS
  // ============================================
  
  const recalculateBenefits = useCallback(async () => {
    if (!selectedEmployee) return;
    
    try {
      const weeklySalary = await fetchEmployeeWeeklySalary(selectedEmployee.employee_id);
      
      if (weeklySalary > 0) {
        const sss = calculateSSSWeekly(weeklySalary, sssBrackets);
        const philhealth = calculatePhilHealthWeekly(weeklySalary);
        const pagibig = calculatePagIBIGWeekly(weeklySalary);
        
        setFormData(prev => ({
          ...prev,
          sss_weekly: sss,
          philhealth_weekly: philhealth,
          pagibig_weekly: pagibig
        }));
        
        const monthlyDisplay = getDOLEMonthlySalary(weeklySalary);
        setSuccessMessage(`Benefits recalculated based on ₱${weeklySalary.toFixed(2)} weekly salary (₱${monthlyDisplay.toFixed(2)} monthly using DOLE formula)`);
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        setValidationError('No salary data found for this employee. Please set hourly rate in payroll first.');
        setTimeout(() => setValidationError(''), 3000);
      }
    } catch (error) {
      console.error('[Recalc] Error:', error);
      setValidationError('Error recalculating benefits');
      setTimeout(() => setValidationError(''), 3000);
    }
  }, [selectedEmployee, fetchEmployeeWeeklySalary, calculateSSSWeekly, calculatePhilHealthWeekly, calculatePagIBIGWeekly, getDOLEMonthlySalary, sssBrackets]);
  
  // ============================================
  // BENEFITS MANAGEMENT
  // ============================================
  
  const handleInputChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name.includes('_weekly') ? (parseFloat(value) || 0) : value
    }));
  }, []);
  
  const saveBenefits = useCallback(async (e) => {
    e.preventDefault();
    if (!selectedEmployee || saving) return;
    
    const errors = [];
    if (formData.other_weekly > 0 && !formData.other_desc.trim()) {
      errors.push('Please provide description for other deductions');
    }
    if (formData.sss_weekly < 0 || formData.philhealth_weekly < 0 || formData.pagibig_weekly < 0) {
      errors.push('Deductions cannot be negative');
    }
    
    if (errors.length > 0) {
      setValidationError(errors.join(', '));
      setTimeout(() => setValidationError(''), 3000);
      return;
    }
    
    setSaving(true);
    
    try {
      const total = formTotal;
      
      const data = {
        employee_id: selectedEmployee.employee_id,
        employee_name: selectedEmployee.name,
        department: selectedEmployee.department || "",
        sss_weekly: formData.sss_weekly,
        philhealth_weekly: formData.philhealth_weekly,
        pagibig_weekly: formData.pagibig_weekly,
        sss_loan_weekly: formData.sss_loan_weekly,
        pagibig_loan_weekly: formData.pagibig_loan_weekly,
        emergency_weekly: formData.emergency_weekly,
        other_weekly: formData.other_weekly,
        other_desc: formData.other_desc,
        total_weekly: total
      };
      
      const response = await benefitsAPI.save(data);
      
      if (response.data && response.data.success) {
        setSuccessMessage(`✅ ${response.data.message || 'Benefits saved successfully!'}`);
        setTimeout(() => {
          setShowModal(false);
          setSelectedEmployee(null);
          setSuccessMessage('');
          fetchData(true);
        }, 1500);
      } else {
        setValidationError(`❌ ${response.data?.message || 'Failed to save benefits'}`);
        setTimeout(() => setValidationError(''), 3000);
      }
    } catch (error) {
      console.error('Save error:', error);
      setValidationError("❌ Error saving benefits");
      setTimeout(() => setValidationError(''), 3000);
    } finally {
      setSaving(false);
    }
  }, [selectedEmployee, formData, saving, fetchData, formTotal]);
  
  const openModal = useCallback(async (employee) => {
    setSelectedEmployee(employee);
    const weeklySalary = await fetchEmployeeWeeklySalary(employee.employee_id);
    setEmployeeWeeklySalary(weeklySalary);
    
    const existingBenefits = benefitsMap.get(employee.employee_id);
    
    if (existingBenefits) {
      setFormData({
        sss_weekly: existingBenefits.sss_weekly || 0,
        philhealth_weekly: existingBenefits.philhealth_weekly || 0,
        pagibig_weekly: existingBenefits.pagibig_weekly || 0,
        sss_loan_weekly: existingBenefits.sss_loan_weekly || 0,
        pagibig_loan_weekly: existingBenefits.pagibig_loan_weekly || 0,
        emergency_weekly: existingBenefits.emergency_weekly || 0,
        other_weekly: existingBenefits.other_weekly || 0,
        other_desc: existingBenefits.other_desc || ""
      });
    } else {
      const sss = calculateSSSWeekly(weeklySalary, sssBrackets);
      const philhealth = calculatePhilHealthWeekly(weeklySalary);
      const pagibig = calculatePagIBIGWeekly(weeklySalary);
      
      setFormData({
        sss_weekly: sss,
        philhealth_weekly: philhealth,
        pagibig_weekly: pagibig,
        sss_loan_weekly: 0,
        pagibig_loan_weekly: 0,
        emergency_weekly: 0,
        other_weekly: 0,
        other_desc: ""
      });
      
      if (weeklySalary === 0) {
        setValidationError('⚠️ No salary found. Please set hourly rate in payroll first.');
        setTimeout(() => setValidationError(''), 5000);
      }
    }
    
    setShowModal(true);
  }, [fetchEmployeeWeeklySalary, benefitsMap, calculateSSSWeekly, calculatePhilHealthWeekly, calculatePagIBIGWeekly, sssBrackets]);
  
  // ============================================
  // BRACKET CRUD OPERATIONS
  // ============================================
  
  const handleDelete = useCallback(async (id) => {
    setDeletingBracketId(id);
    try {
      const response = await sssBracketsAPI.delete(id);
      if (response.data.success) {
        setSssBrackets(prev => prev.filter(b => b._id !== id));
        setSuccessMessage('✅ Bracket deleted successfully!');
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        setValidationError('Error deleting bracket');
      }
    } catch (error) {
      setValidationError('Error deleting bracket');
    } finally {
      setDeletingBracketId(null);
    }
  }, []);
  
  const deleteAllBrackets = useCallback(async () => {
    if (sssBrackets.length === 0) {
      alert('No brackets to delete');
      return;
    }
    
    if (window.confirm(`Delete ALL ${sssBrackets.length} brackets? This cannot be undone!`)) {
      setDeleteAllLoading(true);
      try {
        const response = await sssBracketsAPI.deleteAll();
        if (response.data && response.data.success) {
          setSssBrackets([]);
          setSuccessMessage(`✅ Successfully deleted ALL brackets!`);
        } else {
          setValidationError(`❌ ${response.data?.message || 'Failed to delete brackets'}`);
        }
        setTimeout(() => {
          setSuccessMessage('');
          setValidationError('');
        }, 3000);
      } catch (error) {
        setValidationError('Error deleting brackets');
      } finally {
        setDeleteAllLoading(false);
      }
    }
  }, [sssBrackets.length]);
  
  const handleBracketChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    setBracketForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    setValidationError('');
  }, []);
  
  const resetBracketForm = useCallback(() => {
    setEditingBracket(null);
    setBracketForm({
      min_salary: '',
      max_salary: '',
      monthly_credit: '',
      regular_ss_base: '',
      mpf_base: '',
      employee_ss_percentage: 5.0,
      employer_ss_percentage: 10.0,
      employee_mpf_percentage: 5.0,
      employer_mpf_percentage: 10.0,
      ec_amount: 10.00,
      is_active: true
    });
    setValidationError('');
  }, []);
  
  const saveBracket = useCallback(async (e) => {
    e.preventDefault();
    if (saving) return;
    
    setValidationError('');
    setSuccessMessage('');
    
    const minSalary = parseFloat(bracketForm.min_salary);
    const maxSalary = parseFloat(bracketForm.max_salary);
    const monthlyCredit = parseFloat(bracketForm.monthly_credit);
    
    if (isNaN(minSalary) || isNaN(maxSalary) || minSalary < 0 || maxSalary < 0) {
      setValidationError('Please enter valid positive numbers for salary ranges');
      return;
    }
    
    if (isNaN(monthlyCredit) || monthlyCredit < 0) {
      setValidationError('Please enter a valid monthly credit amount');
      return;
    }
    
    setSaving(true);
    
    try {
      const percentages = {
        employee_ss: parseFloat(bracketForm.employee_ss_percentage),
        employer_ss: parseFloat(bracketForm.employer_ss_percentage),
        employee_mpf: parseFloat(bracketForm.employee_mpf_percentage),
        employer_mpf: parseFloat(bracketForm.employer_mpf_percentage)
      };
      
      const ecAmount = parseFloat(bracketForm.ec_amount) || 0;
      const regularCap = bracketSettings.regular_msc_cap;
      
      const regularBase = Math.min(monthlyCredit, regularCap);
      const mpfBase = monthlyCredit > regularCap ? monthlyCredit - regularCap : 0;
      
      const employeeRegularSS = regularBase * (percentages.employee_ss / 100);
      const employerRegularSS = regularBase * (percentages.employer_ss / 100);
      const employeeMPF = mpfBase * (percentages.employee_mpf / 100);
      const employerMPF = mpfBase * (percentages.employer_mpf / 100);
      const employeeTotal = employeeRegularSS + employeeMPF;
      const employerTotal = employerRegularSS + employerMPF + ecAmount;
      
      const bracketData = {
        min_salary: minSalary,
        max_salary: maxSalary,
        monthly_credit: monthlyCredit,
        regular_ss_base: regularBase,
        mpf_base: mpfBase,
        employee_contribution: employeeTotal,
        employer_contribution: employerTotal,
        employee_ss_contribution: employeeRegularSS,
        employer_ss_contribution: employerRegularSS,
        employee_mpf_contribution: employeeMPF,
        employer_mpf_contribution: employerMPF,
        ec_contribution: ecAmount,
        employee_ss_percentage: percentages.employee_ss,
        employer_ss_percentage: percentages.employer_ss,
        employee_mpf_percentage: percentages.employee_mpf,
        employer_mpf_percentage: percentages.employer_mpf,
        regular_msc_cap: regularCap,
        ec_threshold: bracketSettings.ec_threshold,
        is_active: bracketForm.is_active
      };
      
      let response;
      if (editingBracket) {
        response = await sssBracketsAPI.update(editingBracket._id, bracketData);
        if (response.data.success) {
          setSssBrackets(prev => prev.map(b => 
            b._id === editingBracket._id ? { ...b, ...bracketData } : b
          ));
        }
      } else {
        response = await sssBracketsAPI.create(bracketData);
        if (response.data.success) {
          setSssBrackets(prev => [...prev, { ...bracketData, _id: response.data.id }]);
        }
      }
      
      if (response.data.success) {
        setSuccessMessage(`✅ Bracket ${editingBracket ? 'updated' : 'added'} successfully!`);
        resetBracketForm();
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        setValidationError(response.data.message || 'Failed to save bracket');
      }
    } catch (error) {
      setValidationError("Error saving bracket");
      console.error("Save error:", error);
    } finally {
      setSaving(false);
    }
  }, [bracketForm, editingBracket, saving, resetBracketForm, bracketSettings]);
  
  const openBracketEditor = useCallback((bracket = null) => {
    console.log('Opening bracket editor', bracket); // Debug log
    if (bracket) {
      setEditingBracket(bracket);
      setBracketForm({
        min_salary: bracket.min_salary,
        max_salary: bracket.max_salary,
        monthly_credit: bracket.monthly_credit,
        regular_ss_base: bracket.regular_ss_base || '',
        mpf_base: bracket.mpf_base || '',
        employee_ss_percentage: bracket.employee_ss_percentage || 5.0,
        employer_ss_percentage: bracket.employer_ss_percentage || 10.0,
        employee_mpf_percentage: bracket.employee_mpf_percentage || 5.0,
        employer_mpf_percentage: bracket.employer_mpf_percentage || 10.0,
        ec_amount: bracket.ec_contribution || 10.00,
        is_active: bracket.is_active
      });
    } else {
      resetBracketForm();
    }
    setShowBracketEditor(true);
  }, [resetBracketForm]);
  
  // ============================================
  // SETTINGS MANAGEMENT
  // ============================================
  
  const handleSettingsChange = useCallback((e) => {
    const { name, value } = e.target;
    setBracketSettings(prev => ({ ...prev, [name]: value === '' ? '' : parseFloat(value) }));
    setValidationError('');
  }, []);
  
  const saveSettings = useCallback(() => {
    localStorage.setItem('sss_bracket_settings', JSON.stringify(bracketSettings));
    setSuccessMessage('✅ Settings saved successfully!');
    setTimeout(() => setSuccessMessage(''), 3000);
    setShowSettingsModal(false);
  }, [bracketSettings]);
  
  const resetToSSSDefaults = useCallback(() => {
    setBracketSettings({
      min_salary_start: 5250,
      max_salary_end: 40000,
      bracket_interval: 500,
      msc_start: 5000,
      msc_increment: 500,
      regular_msc_cap: 20000,
      ec_standard: 10.00,
      ec_elevated: 30.00,
      ec_threshold: 15000,
      employee_ss_percentage: 5.0,
      employer_ss_percentage: 10.0,
      employee_mpf_percentage: 5.0,
      employer_mpf_percentage: 10.0,
    });
    setSuccessMessage('✅ Reset to default SSS values');
    setTimeout(() => setSuccessMessage(''), 3000);
  }, []);
  
  const generateSSSBrackets = useCallback(async () => {
    if (generatingBrackets) return;
    
    setGeneratingBrackets(true);
    setValidationError('');
    setSuccessMessage('');
    
    try {
      const settings = bracketSettings;
      
      const minSalaryStart = parseFloat(settings.min_salary_start);
      const maxSalaryEnd = parseFloat(settings.max_salary_end);
      const bracketInterval = parseFloat(settings.bracket_interval);
      const mscStart = parseFloat(settings.msc_start);
      const mscIncrement = parseFloat(settings.msc_increment);
      const regularCap = parseFloat(settings.regular_msc_cap);
      const ecStandard = parseFloat(settings.ec_standard);
      const ecElevated = parseFloat(settings.ec_elevated);
      const ecThreshold = parseFloat(settings.ec_threshold);
      const employeeSS = parseFloat(settings.employee_ss_percentage);
      const employerSS = parseFloat(settings.employer_ss_percentage);
      const employeeMPF = parseFloat(settings.employee_mpf_percentage);
      const employerMPF = parseFloat(settings.employer_mpf_percentage);
      
      if (isNaN(minSalaryStart) || minSalaryStart <= 0 ||
          isNaN(maxSalaryEnd) || maxSalaryEnd <= 0 ||
          isNaN(mscStart) || mscStart <= 0 ||
          isNaN(mscIncrement) || mscIncrement <= 0 ||
          isNaN(bracketInterval) || bracketInterval <= 0 ||
          isNaN(regularCap) || regularCap <= 0) {
        setValidationError('Please enter valid positive numbers for all fields');
        setGeneratingBrackets(false);
        return;
      }
      
      const bracketsToAdd = [];
      
      const percentages = {
        employee_ss: employeeSS,
        employer_ss: employerSS,
        employee_mpf: employeeMPF,
        employer_mpf: employerMPF
      };
      
      const getECAmount = (msc, threshold, standard, elevated) => {
        return msc >= threshold ? elevated : standard;
      };
      
      const calculateContributions = (msc, regularCap, ecAmount, percentages) => {
        const regularBase = Math.min(msc, regularCap);
        const employeeRegularSS = regularBase * (percentages.employee_ss / 100);
        const employerRegularSS = regularBase * (percentages.employer_ss / 100);
        
        let employeeMPF = 0;
        let employerMPF = 0;
        let mpfBase = 0;
        
        if (msc > regularCap) {
          mpfBase = msc - regularCap;
          employeeMPF = mpfBase * (percentages.employee_mpf / 100);
          employerMPF = mpfBase * (percentages.employer_mpf / 100);
        }
        
        return {
          regular_base: regularBase,
          mpf_base: mpfBase,
          employee_regular_ss: employeeRegularSS,
          employer_regular_ss: employerRegularSS,
          employee_mpf: employeeMPF,
          employer_mpf: employerMPF,
          employee_total: employeeRegularSS + employeeMPF,
          employer_total: employerRegularSS + employerMPF + ecAmount,
          ec_contribution: ecAmount
        };
      };
      
      // BRACKET 1: BELOW MINIMUM
      const firstMSC = mscStart;
      const firstMaxSalary = minSalaryStart - 0.01;
      const firstEC = getECAmount(firstMSC, ecThreshold, ecStandard, ecElevated);
      const firstContributions = calculateContributions(firstMSC, regularCap, firstEC, percentages);
      
      bracketsToAdd.push({
        min_salary: 0,
        max_salary: firstMaxSalary,
        monthly_credit: firstMSC,
        regular_ss_base: firstContributions.regular_base,
        mpf_base: firstContributions.mpf_base,
        employee_contribution: firstContributions.employee_total,
        employer_contribution: firstContributions.employer_total,
        employee_ss_contribution: firstContributions.employee_regular_ss,
        employer_ss_contribution: firstContributions.employer_regular_ss,
        employee_mpf_contribution: firstContributions.employee_mpf,
        employer_mpf_contribution: firstContributions.employer_mpf,
        ec_contribution: firstContributions.ec_contribution,
        employee_ss_percentage: percentages.employee_ss,
        employer_ss_percentage: percentages.employer_ss,
        employee_mpf_percentage: percentages.employee_mpf,
        employer_mpf_percentage: percentages.employer_mpf,
        regular_msc_cap: regularCap,
        ec_threshold: ecThreshold,
        is_active: true
      });
      
      // REGULAR BRACKETS
      let currentMinSalary = minSalaryStart;
      let currentMSC = mscStart + mscIncrement;
      
      while (currentMinSalary <= maxSalaryEnd) {
        const currentMaxSalary = currentMinSalary + bracketInterval - 0.01;
        const currentEC = getECAmount(currentMSC, ecThreshold, ecStandard, ecElevated);
        const currentContributions = calculateContributions(currentMSC, regularCap, currentEC, percentages);
        
        bracketsToAdd.push({
          min_salary: currentMinSalary,
          max_salary: currentMaxSalary,
          monthly_credit: currentMSC,
          regular_ss_base: currentContributions.regular_base,
          mpf_base: currentContributions.mpf_base,
          employee_contribution: currentContributions.employee_total,
          employer_contribution: currentContributions.employer_total,
          employee_ss_contribution: currentContributions.employee_regular_ss,
          employer_ss_contribution: currentContributions.employer_regular_ss,
          employee_mpf_contribution: currentContributions.employee_mpf,
          employer_mpf_contribution: currentContributions.employer_mpf,
          ec_contribution: currentContributions.ec_contribution,
          employee_ss_percentage: percentages.employee_ss,
          employer_ss_percentage: percentages.employer_ss,
          employee_mpf_percentage: percentages.employee_mpf,
          employer_mpf_percentage: percentages.employer_mpf,
          regular_msc_cap: regularCap,
          ec_threshold: ecThreshold,
          is_active: true
        });
        
        currentMinSalary = currentMaxSalary + 0.01;
        currentMSC += mscIncrement;
        
        if (currentMinSalary > maxSalaryEnd) break;
      }
      
      // FINAL BRACKET
      if (currentMinSalary <= maxSalaryEnd) {
        const finalEC = getECAmount(currentMSC, ecThreshold, ecStandard, ecElevated);
        const finalContributions = calculateContributions(currentMSC, regularCap, finalEC, percentages);
        
        bracketsToAdd.push({
          min_salary: currentMinSalary,
          max_salary: maxSalaryEnd,
          monthly_credit: currentMSC,
          regular_ss_base: finalContributions.regular_base,
          mpf_base: finalContributions.mpf_base,
          employee_contribution: finalContributions.employee_total,
          employer_contribution: finalContributions.employer_total,
          employee_ss_contribution: finalContributions.employee_regular_ss,
          employer_ss_contribution: finalContributions.employer_regular_ss,
          employee_mpf_contribution: finalContributions.employee_mpf,
          employer_mpf_contribution: finalContributions.employer_mpf,
          ec_contribution: finalContributions.ec_contribution,
          employee_ss_percentage: percentages.employee_ss,
          employer_ss_percentage: percentages.employer_ss,
          employee_mpf_percentage: percentages.employee_mpf,
          employer_mpf_percentage: percentages.employer_mpf,
          regular_msc_cap: regularCap,
          ec_threshold: ecThreshold,
          is_active: true
        });
      }
      
      const previewMessage = `Generate ${bracketsToAdd.length} SSS brackets?\n\n` +
        `This will replace all ${sssBrackets.length} existing brackets.\n\n` +
        `📊 PREVIEW:\n` +
        `1. ₱0 - ₱${firstMaxSalary.toFixed(2)} → MSC: ₱${firstMSC.toFixed(2)}\n` +
        `   Employee: ₱${firstContributions.employee_total.toFixed(2)} | Employer: ₱${firstContributions.employer_total.toFixed(2)}\n` +
        `   EC: ₱${firstContributions.ec_contribution.toFixed(2)}\n` +
        `2. ₱${minSalaryStart.toFixed(2)} - ₱${(minSalaryStart + bracketInterval - 0.01).toFixed(2)} → MSC: ₱${mscStart.toFixed(2)}\n` +
        `   Employee: ₱${bracketsToAdd[1]?.employee_contribution?.toFixed(2) || '0'}\n` +
        `   MPF Base: ₱${bracketsToAdd[1]?.mpf_base?.toFixed(2) || '0'}\n` +
        `   EC: ₱${bracketsToAdd[1]?.ec_contribution?.toFixed(2) || '0'}\n\n` +
        `⚠️ This action cannot be undone!`;
      
      const confirmed = window.confirm(previewMessage);
      
      if (confirmed) {
        const response = await sssBracketsAPI.bulkCreate(bracketsToAdd, true);
        
        if (response.data && response.data.success) {
          await fetchData(true);
          setSuccessMessage(`✅ Successfully generated ${bracketsToAdd.length} SSS brackets with MPF and EC!`);
        } else {
          setValidationError(`❌ ${response.data?.message || 'Failed to generate brackets'}`);
        }
        
        setTimeout(() => {
          setSuccessMessage('');
          setValidationError('');
        }, 3000);
      }
      
    } catch (error) {
      console.error('[Generate] Error:', error);
      setValidationError(`❌ Error generating brackets: ${error.message}`);
      setTimeout(() => setValidationError(''), 3000);
    } finally {
      setGeneratingBrackets(false);
    }
  }, [bracketSettings, generatingBrackets, sssBrackets.length, fetchData]);
  
  // ============================================
  // RENDER FUNCTIONS
  // ============================================
  
  const renderEmployeeRows = () => {
    return paginatedEmployees.map(emp => {
      const employeeBenefits = benefitsMap.get(emp.employee_id);
      const hourlyRate = getEmployeeHourlyRate(emp.employee_id);
      
      let total = 0;
      if (employeeBenefits) {
        total = (employeeBenefits.sss_weekly || 0) + 
                (employeeBenefits.philhealth_weekly || 0) + 
                (employeeBenefits.pagibig_weekly || 0) + 
                (employeeBenefits.sss_loan_weekly || 0) + 
                (employeeBenefits.pagibig_loan_weekly || 0) + 
                (employeeBenefits.emergency_weekly || 0) + 
                (employeeBenefits.other_weekly || 0);
      }
      
      return (
        <tr key={emp.employee_id} style={{ borderBottom: '1px solid #eee' }}>
          <td style={{ padding: '12px' }}>
            <div style={{ fontWeight: '500' }}>{emp.name}</div>
            <div style={{ fontSize: '11px', color: '#7f8c8d' }}>{emp.employee_id}</div>
            <div style={{ fontSize: '11px', color: '#999' }}>{emp.department || 'No Dept'}</div>
            <div style={{ fontSize: '10px', color: '#007bff', marginTop: '4px' }}>
              ₱{hourlyRate.toFixed(2)}/hr (from payroll)
            </div>
          </td>
          <td style={{ padding: '12px', textAlign: 'center' }}>
            {employeeBenefits ? formatCurrency(employeeBenefits.sss_weekly) : '-'}
          </td>
          <td style={{ padding: '12px', textAlign: 'center' }}>
            {employeeBenefits ? formatCurrency(employeeBenefits.philhealth_weekly) : '-'}
          </td>
          <td style={{ padding: '12px', textAlign: 'center' }}>
            {employeeBenefits ? formatCurrency(employeeBenefits.pagibig_weekly) : '-'}
          </td>
          <td style={{ padding: '12px', textAlign: 'center' }}>
            <span style={{ fontWeight: 'bold', color: '#28a745' }}>
              {employeeBenefits ? formatCurrency(total) : '-'}
            </span>
          </td>
          <td style={{ padding: '12px', textAlign: 'center' }}>
            <button 
              style={{ padding: '6px 12px', background: '#28a745', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}
              onClick={() => openModal(emp)}
            >
              {employeeBenefits ? 'Edit' : 'Setup'}
            </button>
          </td>
        </tr>
      );
    });
  };
  
  const renderBracketRows = () => {
    return sortedBrackets.map((b, index) => {
      const nextBracket = sortedBrackets[index + 1];
      const hasGap = nextBracket && Math.abs(b.max_salary + 0.01 - nextBracket.min_salary) > 0.001;
      const isDeleting = deletingBracketId === b._id;
      
      const mpfBase = b.mpf_base || 0;
      const employeeMPF = b.employee_mpf_contribution || 0;
      const employerMPF = b.employer_mpf_contribution || 0;
      const ecAmount = b.ec_contribution || 0;
      const hasMPF = mpfBase > 0 || employeeMPF > 0 || employerMPF > 0;
      
      return (
        <tr key={b._id} style={{ borderBottom: '1px solid #eee', background: hasGap ? '#fff3cd' : index % 2 === 0 ? '#fff' : '#fafafa' }}>
          <td style={{ padding: '12px', textAlign: 'center' }}>{index + 1}</td>
          <td style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold' }}>₱ {b.min_salary.toFixed(2)}</td>
          <td style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold' }}>₱ {b.max_salary.toFixed(2)}</td>
          <td style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold', color: '#007bff' }}>₱ {b.monthly_credit.toFixed(2)}</td>
          <td style={{ padding: '12px', textAlign: 'center' }}>
            <div>Regular: ₱ {(b.regular_ss_base || 0).toFixed(2)}</div>
            {hasMPF && (
              <div style={{ fontSize: '11px', color: '#fd7e14', marginTop: '4px' }}>
                MPF Base: ₱ {mpfBase.toFixed(2)}
              </div>
            )}
          </td>
          <td style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold', color: '#28a745' }}>
            ₱ {b.employee_contribution.toFixed(2)}
            {hasMPF && (
              <div style={{ fontSize: '10px', color: '#666', marginTop: '4px' }}>
                SS: ₱ {(b.employee_ss_contribution || 0).toFixed(2)}<br/>
                MPF: ₱ {employeeMPF.toFixed(2)}
              </div>
            )}
          </td>
          <td style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold', color: '#dc3545' }}>
            ₱ {b.employer_contribution.toFixed(2)}
            {hasMPF && (
              <div style={{ fontSize: '10px', color: '#666', marginTop: '4px' }}>
                SS: ₱ {(b.employer_ss_contribution || 0).toFixed(2)}<br/>
                MPF: ₱ {employerMPF.toFixed(2)}
              </div>
            )}
          </td>
          <td style={{ padding: '12px', textAlign: 'center' }}>
            <div style={{ fontWeight: 'bold', color: '#fd7e14' }}>
              EC: ₱ {ecAmount.toFixed(2)}
            </div>
            {hasMPF && (
              <div style={{ fontSize: '11px', color: '#28a745', marginTop: '4px' }}>
                MPF Total: ₱ {(employeeMPF + employerMPF).toFixed(2)}
              </div>
            )}
          </td>
          <td style={{ padding: '12px', textAlign: 'center' }}>
            <span style={{ 
              background: b.is_active ? '#d4edda' : '#f8d7da', 
              color: b.is_active ? '#155724' : '#721c24', 
              padding: '4px 12px', 
              borderRadius: '20px', 
              fontSize: '12px' 
            }}>
              {b.is_active ? 'Active' : 'Inactive'}
            </span>
          </td>
          <td style={{ padding: '12px', textAlign: 'center' }}>
            <button 
              style={{ padding: '6px 12px', background: '#28a745', color: '#fff', border: 'none', borderRadius: 4, marginRight: 8, cursor: 'pointer' }} 
              onClick={() => openBracketEditor(b)}
            >
              Edit
            </button>
            <button 
              style={{ padding: '6px 12px', background: '#dc3545', color: '#fff', border: 'none', borderRadius: 4, cursor: isDeleting ? 'not-allowed' : 'pointer', opacity: isDeleting ? 0.6 : 1 }} 
              onClick={() => handleDelete(b._id)} 
              disabled={isDeleting}
            >
              {isDeleting ? '...' : 'Delete'}
            </button>
          </td>
        </tr>
      );
    });
  };
  
  const renderPagination = () => {
    if (totalPages <= 1) return null;
    
    const pages = [];
    const maxVisible = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);
    
    if (endPage - startPage + 1 < maxVisible) {
      startPage = Math.max(1, endPage - maxVisible + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    
    return (
      <div className="card-footer bg-white" style={{ padding: '15px' }}>
        <nav aria-label="Employee pagination">
          <ul className="pagination justify-content-center mb-0">
            <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
              <button className="page-link" onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}>
                <i className="bi bi-chevron-left"></i>
              </button>
            </li>
            
            {startPage > 1 && (
              <>
                <li className="page-item">
                  <button className="page-link" onClick={() => setCurrentPage(1)}>1</button>
                </li>
                {startPage > 2 && <li className="page-item disabled"><span className="page-link">...</span></li>}
              </>
            )}
            
            {pages.map(page => (
              <li key={page} className={`page-item ${currentPage === page ? 'active' : ''}`}>
                <button className="page-link" onClick={() => setCurrentPage(page)}>
                  {page}
                </button>
              </li>
            ))}
            
            {endPage < totalPages && (
              <>
                {endPage < totalPages - 1 && <li className="page-item disabled"><span className="page-link">...</span></li>}
                <li className="page-item">
                  <button className="page-link" onClick={() => setCurrentPage(totalPages)}>{totalPages}</button>
                </li>
              </>
            )}
            
            <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
              <button className="page-link" onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}>
                <i className="bi bi-chevron-right"></i>
              </button>
            </li>
          </ul>
        </nav>
      </div>
    );
  };
  
  // ============================================
  // LOAD SETTINGS AND PAYROLL RATES ON MOUNT
  // ============================================
  
  useEffect(() => {
    const abortController = new AbortController();
    
    const loadSettings = async () => {
      try {
        const savedSettings = localStorage.getItem('sss_bracket_settings');
        if (savedSettings) {
          const parsed = JSON.parse(savedSettings);
          setBracketSettings(parsed);
        }
      } catch (error) {
        console.error('Error loading settings:', error);
      }
    };
    
    loadSettings();
    fetchData(false, abortController.signal);
    fetchPayrollRates();
    
    return () => abortController.abort();
  }, [fetchData, fetchPayrollRates]);
  
  // ============================================
  // STYLES
  // ============================================
  
  const styles = {
    card: { background: '#fff', borderRadius: 10, boxShadow: '0 2px 10px rgba(0,0,0,0.1)', overflow: 'hidden' },
    table: { width: '100%', borderCollapse: 'collapse', fontSize: '14px' },
    th: { padding: '12px', textAlign: 'left', fontWeight: 600, color: '#555', borderBottom: '2px solid #dee2e6' },
    td: { padding: '12px', borderBottom: '1px solid #eee' },
    centerText: { padding: 40, textAlign: 'center', color: '#7f8c8d' },
    input: { width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: 6, fontSize: '14px' },
    btnPrimary: { padding: '10px 20px', background: '#007bff', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '14px' },
    btnSecondary: { padding: '10px 20px', background: '#6c757d', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '14px' },
    btnDanger: { padding: '8px 16px', background: '#dc3545', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '13px' },
    btnSuccess: { padding: '8px 16px', background: '#28a745', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '13px' },
    btnInfo: { padding: '8px 16px', background: '#17a2b8', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '13px' },
    errorBox: { background: '#f8d7da', color: '#721c24', padding: '12px', borderRadius: 6, marginBottom: 20, border: '1px solid #f5c6cb' },
    successBox: { background: '#d4edda', color: '#155724', padding: '12px', borderRadius: 6, marginBottom: 20, border: '1px solid #c3e6cb' },
    overlay: { 
      position: 'fixed', 
      inset: 0, 
      background: 'rgba(0,0,0,0.5)', 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      zIndex: 1050,
      overflow: 'auto',
      padding: '20px'
    },
    modal: { 
      background: '#fff', 
      padding: 25, 
      borderRadius: 10, 
      width: '90%', 
      maxWidth: '950px', 
      maxHeight: '85vh', 
      overflowY: 'auto' 
    },
    settingsModal: { 
      background: '#fff', 
      padding: 30, 
      borderRadius: 12, 
      width: '90%', 
      maxWidth: '700px', 
      maxHeight: '90vh', 
      overflowY: 'auto', 
      boxShadow: '0 10px 40px rgba(0,0,0,0.2)' 
    },
    bracketModal: { 
      background: '#fff', 
      padding: 25, 
      borderRadius: 12, 
      width: '95%', 
      maxWidth: '1200px', 
      maxHeight: '90vh', 
      overflowY: 'auto', 
      boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
      position: 'relative'
    },
    infoBox: { background: '#f8f9fa', padding: '12px', borderRadius: 5, marginBottom: 15, border: '1px solid #eee', fontSize: '13px' },
    previewBox: { background: '#e7f3ff', padding: '15px', borderRadius: 8, marginTop: 15, border: '1px solid #b8daff' }
  };
  
  const { card, table, th, td, centerText, input, btnPrimary, btnSecondary, btnDanger, btnSuccess, btnInfo, errorBox, successBox, overlay, modal, settingsModal, bracketModal, infoBox, previewBox } = styles;
  
  // ============================================
  // MAIN RENDER
  // ============================================
  
  return (
    <div style={{ padding: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0, color: '#2c3e50', fontSize: '24px' }}>Benefits Management</h2>
        <div>
          <button style={{ ...btnSecondary, marginRight: '10px' }} onClick={() => { fetchData(true); fetchPayrollRates(); }}>
            <i className="bi bi-arrow-clockwise"></i> Refresh
          </button>
          <button style={{ ...btnInfo, marginRight: '10px' }} onClick={() => setShowSettingsModal(true)}>
            <i className="bi bi-gear"></i> Settings
          </button>
          <button style={btnPrimary} onClick={() => openBracketEditor()}>
            <i className="bi bi-table"></i> SSS Brackets
          </button>
        </div>
      </div>
      
      {/* Payroll Rate Info Bar */}
      <div style={{ background: '#e3f2fd', padding: '10px 15px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #b8daff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <i className="bi bi-calculator" style={{ marginRight: '8px', color: '#007bff' }}></i>
            <strong>Hourly Rates Source:</strong> Payroll records for week {currentWeekRange.start} to {currentWeekRange.end}
            {loadingRates && <span className="ms-2 text-muted">(Loading rates...)</span>}
          </div>
          <div>
            <small className="text-muted">
              {payrollRates.size} employee rates loaded
            </small>
          </div>
        </div>
      </div>
      
      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px', marginBottom: '20px' }}>
        <div style={{ background: '#007bff', color: '#fff', padding: '15px', borderRadius: '8px' }}>
          <div style={{ fontSize: '13px', opacity: 0.9 }}>Total Employees</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{stats.totalEmployees}</div>
        </div>
        <div style={{ background: '#28a745', color: '#fff', padding: '15px', borderRadius: '8px' }}>
          <div style={{ fontSize: '13px', opacity: 0.9 }}>With Benefits</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{stats.withBenefits}</div>
        </div>
        <div style={{ background: '#ffc107', color: '#fff', padding: '15px', borderRadius: '8px' }}>
          <div style={{ fontSize: '13px', opacity: 0.9 }}>Needs Setup</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{stats.withoutBenefits}</div>
        </div>
        <div style={{ background: '#17a2b8', color: '#fff', padding: '15px', borderRadius: '8px' }}>
          <div style={{ fontSize: '13px', opacity: 0.9 }}>SSS Brackets</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{stats.activeBrackets} Active</div>
        </div>
      </div>
      
      {/* Work Days Info Bar */}
      <div style={{ background: '#e8f5e9', padding: '10px 15px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #c3e6cb' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <i className="bi bi-calendar-week" style={{ marginRight: '8px', color: '#28a745' }}></i>
            <strong>Work Schedule:</strong> {workDaysPerWeek} days/week • {companySettings?.standard_work_hours || 8} hours/day
          </div>
          <div>
            <small className="text-muted">
              DOLE Formula: {workDaysPerWeek === 6 ? '313/12' : '261/12'} days/year
            </small>
          </div>
        </div>
      </div>
      
      {/* Search */}
      <div style={{ marginBottom: '20px' }}>
        <input
          type="text"
          placeholder="🔍 Search employees by name, ID, or department"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ ...input, width: '100%', maxWidth: '400px' }}
        />
        {searchTerm && (
          <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
            Found {filteredEmployees.length} result(s) - Showing {paginatedEmployees.length} per page
          </div>
        )}
      </div>
      
      {/* Employee Benefits Table */}
      <div className="card border shadow-sm rounded-3">
        <div className="card-header bg-white border-bottom rounded-top-3 py-3">
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <h6 className="fw-bold mb-0">
                <i className="bi bi-cash-coin me-2 text-primary"></i>
                Employee Benefits
              </h6>
              <small className="text-muted">
                Showing {paginatedEmployees.length} of {filteredEmployees.length} employees
              </small>
            </div>
            <div className="text-end">
              <div className="small text-muted">Total Weekly Deductions</div>
              <div className="fw-bold text-success">{formatCurrency(stats.totalWeekly)}</div>
            </div>
          </div>
        </div>
        
        {loading ? (
          <div className="card-body text-center py-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <p className="mt-2">Loading benefits data...</p>
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="card-body text-center py-5">
            <i className="bi bi-people fs-1 text-muted mb-3"></i>
            <h5>No employees found</h5>
            <p className="text-muted">
              {searchTerm ? `No results found for "${searchTerm}"` : 'No employees in the system'}
            </p>
          </div>
        ) : (
          <>
            <div className="card-body p-0">
              <div className="table-responsive">
                <table className="table table-hover mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Employee</th>
                      <th className="text-center">SSS</th>
                      <th className="text-center">PhilHealth</th>
                      <th className="text-center">Pag-IBIG</th>
                      <th className="text-center">Total Deductions</th>
                      <th className="text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {renderEmployeeRows()}
                  </tbody>
                </table>
              </div>
            </div>
            {renderPagination()}
          </>
        )}
      </div>
      
      {/* Benefits Modal */}
      {showModal && selectedEmployee && (
        <div style={overlay} onClick={(e) => {
          if (e.target === e.currentTarget) {
            setShowModal(false);
            setSelectedEmployee(null);
            setValidationError('');
            setSuccessMessage('');
          }
        }}>
          <div style={modal}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '18px' }}>
                {benefitsMap.get(selectedEmployee.employee_id) ? 'Edit Benefits' : 'Setup Benefits'} for {selectedEmployee.name}
              </h3>
              <button
                onClick={() => {
                  setShowModal(false);
                  setSelectedEmployee(null);
                  setValidationError('');
                  setSuccessMessage('');
                }}
                style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>
            
            {successMessage && (
              <div style={successBox}>
                <i className="bi bi-check-circle-fill" style={{ marginRight: '10px' }}></i>
                {successMessage}
              </div>
            )}
            {validationError && (
              <div style={errorBox}>
                <i className="bi bi-exclamation-triangle-fill" style={{ marginRight: '10px' }}></i>
                {validationError}
              </div>
            )}
            
            <form onSubmit={saveBenefits}>
              <div style={infoBox}>
                <div><strong>Employee:</strong> {selectedEmployee.name}</div>
                <div><strong>ID:</strong> {selectedEmployee.employee_id}</div>
                <div><strong>Department:</strong> {selectedEmployee.department || 'Not assigned'}</div>
                <div><strong>Work Schedule:</strong> {workDaysPerWeek} days/week, {companySettings?.standard_work_hours || 8} hours/day</div>
                <div><strong>Hourly Rate (from payroll):</strong> {formatCurrency(getEmployeeHourlyRate(selectedEmployee.employee_id))}/hr</div>
                <div><strong>Weekly Salary:</strong> {employeeWeeklySalary > 0 ? formatCurrency(employeeWeeklySalary) : 'Not set'}</div>
                <div><strong>Monthly Salary (DOLE):</strong> {employeeWeeklySalary > 0 ? formatCurrency(getDOLEMonthlySalary(employeeWeeklySalary)) : 'Not set'}</div>
                {employeeWeeklySalary === 0 && (
                  <div style={{ fontSize: '12px', color: '#ffc107', marginTop: '5px' }}>
                    ⚠️ No salary found. Please set hourly rate in payroll first.
                  </div>
                )}
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                    <h4 style={{ fontSize: '14px', margin: 0, color: '#007bff' }}>Government Contributions (Weekly)</h4>
                    {employeeWeeklySalary > 0 && (
                      <button type="button" style={btnSuccess} onClick={recalculateBenefits}>
                        <i className="bi bi-calculator"></i> Recalculate
                      </button>
                    )}
                  </div>
                  
                  <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500', fontSize: '13px' }}>SSS Contribution</label>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <span style={{ marginRight: '5px', fontSize: '14px' }}>₱</span>
                      <input type="number" name="sss_weekly" style={input} value={formData.sss_weekly} onChange={handleInputChange} step="0.01" required />
                    </div>
                    <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>
                      Based on SSS bracket using DOLE monthly salary
                    </div>
                  </div>
                  
                  <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500', fontSize: '13px' }}>PhilHealth Contribution</label>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <span style={{ marginRight: '5px', fontSize: '14px' }}>₱</span>
                      <input type="number" name="philhealth_weekly" style={input} value={formData.philhealth_weekly} onChange={handleInputChange} step="0.01" required />
                    </div>
                    <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>1.5% of DOLE monthly salary</div>
                  </div>
                  
                  <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500', fontSize: '13px' }}>Pag-IBIG Contribution</label>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <span style={{ marginRight: '5px', fontSize: '14px' }}>₱</span>
                      <input type="number" name="pagibig_weekly" style={input} value={formData.pagibig_weekly} onChange={handleInputChange} step="0.01" required />
                    </div>
                    <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>2% of DOLE monthly salary (max ₱100/month)</div>
                  </div>
                </div>
                
                <div>
                  <h4 style={{ fontSize: '14px', marginBottom: '15px', color: '#ffc107' }}>Optional Deductions (Weekly)</h4>
                  
                  <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500', fontSize: '13px' }}>SSS Loan</label>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <span style={{ marginRight: '5px', fontSize: '14px' }}>₱</span>
                      <input type="number" name="sss_loan_weekly" style={input} value={formData.sss_loan_weekly} onChange={handleInputChange} step="0.01" />
                    </div>
                  </div>
                  
                  <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500', fontSize: '13px' }}>Pag-IBIG Loan</label>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <span style={{ marginRight: '5px', fontSize: '14px' }}>₱</span>
                      <input type="number" name="pagibig_loan_weekly" style={input} value={formData.pagibig_loan_weekly} onChange={handleInputChange} step="0.01" />
                    </div>
                  </div>
                  
                  <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500', fontSize: '13px' }}>Emergency Advance</label>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <span style={{ marginRight: '5px', fontSize: '14px' }}>₱</span>
                      <input type="number" name="emergency_weekly" style={input} value={formData.emergency_weekly} onChange={handleInputChange} step="0.01" />
                    </div>
                  </div>
                  
                  <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500', fontSize: '13px' }}>Other Deductions</label>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
                      <span style={{ marginRight: '5px', fontSize: '14px' }}>₱</span>
                      <input type="number" name="other_weekly" style={input} value={formData.other_weekly} onChange={handleInputChange} step="0.01" />
                    </div>
                    <input type="text" name="other_desc" style={input} placeholder="Description (e.g., Uniform, Insurance)" value={formData.other_desc} onChange={handleInputChange} />
                  </div>
                </div>
              </div>
              
              <div style={{ background: '#e8f5e9', padding: '15px', borderRadius: '5px', marginTop: '20px', border: '1px solid #81c784' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 'bold', fontSize: '14px' }}>Total Weekly Deductions:</span>
                  <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#28a745' }}>{formatCurrency(formTotal)}</span>
                </div>
                <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                  Monthly equivalent: {formatCurrency(formTotal * 4.33333)} | 
                  DOLE Monthly: {employeeWeeklySalary > 0 ? formatCurrency(getDOLEMonthlySalary(employeeWeeklySalary)) : 'N/A'}
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: 10, marginTop: '25px', justifyContent: 'flex-end' }}>
                <button type="button" style={btnSecondary} onClick={() => { setShowModal(false); setSelectedEmployee(null); setValidationError(''); setSuccessMessage(''); }}>Cancel</button>
                <button type="submit" style={btnPrimary} disabled={saving}>
                  {saving ? 'Saving...' : (benefitsMap.get(selectedEmployee.employee_id) ? 'Update Benefits' : 'Save Benefits')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* Settings Modal */}
      {showSettingsModal && (
        <div style={overlay} onClick={(e) => {
          if (e.target === e.currentTarget) {
            setShowSettingsModal(false);
          }
        }}>
          <div style={settingsModal}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '18px' }}>SSS Bracket Generation Settings</h3>
              <button
                onClick={() => setShowSettingsModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px' }}>
              <div>
                <label>Min Salary Start</label>
                <input type="number" name="min_salary_start" value={bracketSettings.min_salary_start} onChange={handleSettingsChange} style={input} />
              </div>
              <div>
                <label>Max Salary End</label>
                <input type="number" name="max_salary_end" value={bracketSettings.max_salary_end} onChange={handleSettingsChange} style={input} />
              </div>
              <div>
                <label>Bracket Interval</label>
                <input type="number" name="bracket_interval" value={bracketSettings.bracket_interval} onChange={handleSettingsChange} style={input} />
              </div>
              <div>
                <label>MSC Start</label>
                <input type="number" name="msc_start" value={bracketSettings.msc_start} onChange={handleSettingsChange} style={input} />
              </div>
              <div>
                <label>MSC Increment</label>
                <input type="number" name="msc_increment" value={bracketSettings.msc_increment} onChange={handleSettingsChange} style={input} />
              </div>
              <div>
                <label>Regular MSC Cap</label>
                <input type="number" name="regular_msc_cap" value={bracketSettings.regular_msc_cap} onChange={handleSettingsChange} style={input} />
              </div>
              <div>
                <label>EC Standard (below threshold)</label>
                <input type="number" name="ec_standard" value={bracketSettings.ec_standard} onChange={handleSettingsChange} style={input} step="0.01" />
              </div>
              <div>
                <label>EC Elevated (above threshold)</label>
                <input type="number" name="ec_elevated" value={bracketSettings.ec_elevated} onChange={handleSettingsChange} style={input} step="0.01" />
              </div>
              <div>
                <label>EC Threshold</label>
                <input type="number" name="ec_threshold" value={bracketSettings.ec_threshold} onChange={handleSettingsChange} style={input} />
              </div>
              <div>
                <label>Employee SS Percentage (%)</label>
                <input type="number" name="employee_ss_percentage" value={bracketSettings.employee_ss_percentage} onChange={handleSettingsChange} style={input} step="0.1" />
              </div>
              <div>
                <label>Employer SS Percentage (%)</label>
                <input type="number" name="employer_ss_percentage" value={bracketSettings.employer_ss_percentage} onChange={handleSettingsChange} style={input} step="0.1" />
              </div>
              <div>
                <label>Employee MPF Percentage (%)</label>
                <input type="number" name="employee_mpf_percentage" value={bracketSettings.employee_mpf_percentage} onChange={handleSettingsChange} style={input} step="0.1" />
              </div>
              <div>
                <label>Employer MPF Percentage (%)</label>
                <input type="number" name="employer_mpf_percentage" value={bracketSettings.employer_mpf_percentage} onChange={handleSettingsChange} style={input} step="0.1" />
              </div>
            </div>
            
            <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button style={btnSecondary} onClick={() => setShowSettingsModal(false)}>Cancel</button>
              <button style={btnPrimary} onClick={saveSettings}>Save Settings</button>
              <button style={btnInfo} onClick={resetToSSSDefaults}>Reset to SSS Defaults</button>
              <button style={btnSuccess} onClick={generateSSSBrackets} disabled={generatingBrackets}>
                {generatingBrackets ? 'Generating...' : 'Generate SSS Brackets'}
              </button>
              {sssBrackets.length > 0 && (
                <button style={btnDanger} onClick={deleteAllBrackets} disabled={deleteAllLoading}>
                  {deleteAllLoading ? 'Deleting...' : `Delete All (${sssBrackets.length})`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Bracket Editor Modal */}
      {showBracketEditor && (
        <div style={overlay} onClick={(e) => {
          if (e.target === e.currentTarget) {
            setShowBracketEditor(false);
            resetBracketForm();
          }
        }}>
          <div style={bracketModal}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '18px' }}>
                {editingBracket ? 'Edit SSS Bracket' : 'Add New SSS Bracket'}
              </h3>
              <button
                onClick={() => {
                  setShowBracketEditor(false);
                  resetBracketForm();
                }}
                style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>
            
            {validationError && (
              <div style={errorBox}>
                <i className="bi bi-exclamation-triangle-fill me-2"></i>
                {validationError}
              </div>
            )}
            
            <form onSubmit={saveBracket}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Min Salary (₱)</label>
                  <input 
                    type="number" 
                    name="min_salary" 
                    value={bracketForm.min_salary} 
                    onChange={handleBracketChange} 
                    style={input} 
                    step="0.01" 
                    required 
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Max Salary (₱)</label>
                  <input 
                    type="number" 
                    name="max_salary" 
                    value={bracketForm.max_salary} 
                    onChange={handleBracketChange} 
                    style={input} 
                    step="0.01" 
                    required 
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Monthly Credit (MSC) (₱)</label>
                  <input 
                    type="number" 
                    name="monthly_credit" 
                    value={bracketForm.monthly_credit} 
                    onChange={handleBracketChange} 
                    style={input} 
                    step="0.01" 
                    required 
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Employee SS %</label>
                  <input 
                    type="number" 
                    name="employee_ss_percentage" 
                    value={bracketForm.employee_ss_percentage} 
                    onChange={handleBracketChange} 
                    style={input} 
                    step="0.1" 
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Employer SS %</label>
                  <input 
                    type="number" 
                    name="employer_ss_percentage" 
                    value={bracketForm.employer_ss_percentage} 
                    onChange={handleBracketChange} 
                    style={input} 
                    step="0.1" 
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Employee MPF %</label>
                  <input 
                    type="number" 
                    name="employee_mpf_percentage" 
                    value={bracketForm.employee_mpf_percentage} 
                    onChange={handleBracketChange} 
                    style={input} 
                    step="0.1" 
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Employer MPF %</label>
                  <input 
                    type="number" 
                    name="employer_mpf_percentage" 
                    value={bracketForm.employer_mpf_percentage} 
                    onChange={handleBracketChange} 
                    style={input} 
                    step="0.1" 
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>EC Amount (₱)</label>
                  <input 
                    type="number" 
                    name="ec_amount" 
                    value={bracketForm.ec_amount} 
                    onChange={handleBracketChange} 
                    style={input} 
                    step="0.01" 
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Status</label>
                  <label style={{ display: 'flex', alignItems: 'center' }}>
                    <input 
                      type="checkbox" 
                      name="is_active" 
                      checked={bracketForm.is_active} 
                      onChange={handleBracketChange} 
                      style={{ marginRight: '8px' }} 
                    />
                    Active
                  </label>
                </div>
              </div>
              
              <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button 
                  type="button" 
                  style={btnSecondary} 
                  onClick={() => { 
                    setShowBracketEditor(false); 
                    resetBracketForm(); 
                  }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  style={btnPrimary} 
                  disabled={saving}
                >
                  {saving ? 'Saving...' : (editingBracket ? 'Update Bracket' : 'Add Bracket')}
                </button>
              </div>
            </form>
            
            {sssBrackets.length > 0 && (
              <>
                <hr style={{ margin: '20px 0' }} />
                <h4 style={{ fontSize: '16px', marginBottom: '15px' }}>Existing SSS Brackets</h4>
                <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                  <table style={table}>
                    <thead style={{ position: 'sticky', top: 0, background: '#f8f9fa' }}>
                      <tr>
                        <th style={th}>#</th>
                        <th style={th}>Min Salary</th>
                        <th style={th}>Max Salary</th>
                        <th style={th}>MSC</th>
                        <th style={th}>Base</th>
                        <th style={th}>Employee</th>
                        <th style={th}>Employer</th>
                        <th style={th}>EC</th>
                        <th style={th}>Status</th>
                        <th style={th}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {renderBracketRows()}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default BenefitsManagement;
