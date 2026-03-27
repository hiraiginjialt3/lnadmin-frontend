import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { weeklyPayrollAPI, attendanceSettingsAPI, employeeAPI, attendanceAPI } from "../services/api";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import { logActivity } from '../utils/activityLogger';
import API from "../services/api";

const Adminsalary = () => {
  const [payrolls, setPayrolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [settings, setSettings] = useState(null);
  const [selectedWeek, setSelectedWeek] = useState({
    start: getCurrentSunday(),
    end: getUpcomingSaturday()
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingPayroll, setEditingPayroll] = useState(null);
  const [formData, setFormData] = useState({});
  const [statusFilter, setStatusFilter] = useState("all");
  const [expandedRows, setExpandedRows] = useState([]);
  
  // Payslip state
  const [isPayslipModalOpen, setIsPayslipModalOpen] = useState(false);
  const [selectedPayslip, setSelectedPayslip] = useState(null);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const payslipRef = useRef(null);

  // Settings edit mode
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [editingSettings, setEditingSettings] = useState(null);

  // Bulk Rate Editor State
  const [isBulkRateModalOpen, setIsBulkRateModalOpen] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [bulkRateForm, setBulkRateForm] = useState({});
  const [selectAll, setSelectAll] = useState(false);
  const [bulkRateSearch, setBulkRateSearch] = useState("");
  const [bulkRateFilter, setBulkRateFilter] = useState("all");
  const [bulkValidationError, setBulkValidationError] = useState("");

  // Track if hourly rates have been modified
  const [rateModified, setRateModified] = useState(false);

  function getUpcomingSaturday() {
    const today = new Date();
    const day = today.getDay();
    const daysUntilSaturday = day === 6 ? 0 : 6 - day;
    const saturday = new Date(today);
    saturday.setDate(today.getDate() + daysUntilSaturday);
    return saturday.toISOString().split('T')[0];
  }

  function getSundayFromSaturday(saturdayDate) {
    const saturday = new Date(saturdayDate);
    const sunday = new Date(saturday);
    sunday.setDate(saturday.getDate() - 6);
    return sunday.toISOString().split('T')[0];
  }

  function getCurrentSaturday() {
    const today = new Date();
    const day = today.getDay();
    const daysUntilSaturday = day === 6 ? 0 : 6 - day;
    const saturday = new Date(today);
    saturday.setDate(today.getDate() + daysUntilSaturday);
    return saturday.toISOString().split('T')[0];
  }

  function getCurrentSunday() {
    const saturday = new Date(getUpcomingSaturday());
    const sunday = new Date(saturday);
    sunday.setDate(saturday.getDate() - 6);
    return sunday.toISOString().split('T')[0];
  }

  const handleSaturdayChange = (saturdayDate) => {
    const sundayStart = getSundayFromSaturday(saturdayDate);
    setSelectedWeek({ start: sundayStart, end: saturdayDate });
    setCurrentPage(1);
  };

  const navigateWeek = (direction) => {
    const currentSaturday = new Date(selectedWeek.end);
    const newSaturday = new Date(currentSaturday);
    newSaturday.setDate(currentSaturday.getDate() + (direction === 'next' ? 7 : -7));
    const newSaturdayDate = newSaturday.toISOString().split('T')[0];
    const newSundayStart = getSundayFromSaturday(newSaturdayDate);
    setSelectedWeek({ start: newSundayStart, end: newSaturdayDate });
    setCurrentPage(1);
  };

  const toggleRowExpansion = (payrollId) => {
    setExpandedRows(prev => 
      prev.includes(payrollId) 
        ? prev.filter(id => id !== payrollId)
        : [...prev, payrollId]
    );
  };

 // In fetchSettings function, add holiday pay settings extraction
const fetchSettings = async () => {
  try {
    const response = await attendanceSettingsAPI.get();
    if (response.data.success) {
      const settingsData = response.data.settings;
      setSettings(settingsData);
      setEditingSettings(settingsData);
      
      // Log the holiday pay settings to verify they're loaded
      console.log('[Holiday Pay Settings Loaded]:', {
        regular_holiday_paid: settingsData.regular_holiday_paid,
        regular_holiday_rate: settingsData.regular_holiday_rate,
        special_working_paid: settingsData.special_working_paid,
        special_working_rate: settingsData.special_working_rate,
        special_non_working_paid: settingsData.special_non_working_paid,
        special_non_working_rate: settingsData.special_non_working_rate
      });
    }
  } catch (error) {
    console.error('Failed to fetch settings:', error);
  }
};

  const saveSettings = async () => {
    try {
      const response = await attendanceSettingsAPI.save(editingSettings);
      if (response.data.success) {
        setSettings(editingSettings);
        setIsSettingsModalOpen(false);
        
        await logActivity(
          'Updated Rate Settings',
          `Updated payroll rates: OT=${editingSettings.overtime_rate}x, Sunday=${editingSettings.sunday_rate}x, Holiday=${editingSettings.holiday_rate}x, Night Diff=${editingSettings.night_shift_differential * 100}%`
        );
        
        alert('✅ Rate settings saved successfully!');
        fetchPayrollData();
      } else {
        alert(`❌ Failed: ${response.data.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('❌ Failed to save settings. Check console.');
    }
  };

  const handleSettingsChange = (e) => {
    const { name, value } = e.target;
    setEditingSettings(prev => ({
      ...prev,
      [name]: parseFloat(value) || 0
    }));
  };

const fetchPayrollData = async () => {
  setLoading(true);
  try {
    const response = await weeklyPayrollAPI.getAll({
      week_start: selectedWeek.start,
      week_end: selectedWeek.end
    });
    
    if (response.data.success) {
      const processedPayrolls = (response.data.data || []).map(payroll => ({
        ...payroll,
        
        // ===== BASIC HOURS =====
        regular_hours: payroll.regular_hours || 0,
        overtime_hours: payroll.overtime_hours || 0,
        sunday_hours: payroll.sunday_hours || 0,
        sunday_overtime_hours: payroll.sunday_overtime_hours || 0,
        holiday_hours: payroll.holiday_hours || 0,
        holiday_overtime: payroll.holiday_overtime || 0,
        total_hours: payroll.total_hours || 0,
        days_worked: payroll.days_worked || 0,
        hourly_rate: payroll.hourly_rate || 86.87,
        
        // ===== SPECIAL HOLIDAY HOURS =====
        special_working_hours: payroll.special_working_hours || 0,
        special_non_working_hours: payroll.special_non_working_hours || 0,
        special_non_working_ot_hours: payroll.special_non_working_ot_hours || 0,
        
        // ===== NIGHT SHIFT HOURS =====
        night_hours: payroll.night_hours || 0,
        sunday_night_hours: payroll.sunday_night_hours || 0,
        night_overtime_hours: payroll.night_overtime_hours || 0,
        sunday_night_overtime_hours: payroll.sunday_night_overtime_hours || 0,
        night_shift_differential: payroll.night_shift_differential || 0.10,
        night_shift_pay: payroll.night_shift_pay || 0,
        
        // ===== RATES =====
        overtime_rate: payroll.overtime_rate || 1.25,
        sunday_rate: payroll.sunday_rate || 1.30,
        regular_holiday_rate: payroll.regular_holiday_rate || settings?.regular_holiday_rate || 2.0,
        special_working_rate: payroll.special_working_rate || settings?.special_working_rate || 1.0,
        special_non_working_rate: payroll.special_non_working_rate || settings?.special_non_working_rate || 1.3,
        holiday_overtime_rate: payroll.holiday_overtime_rate || settings?.holiday_overtime_rate || 1.5,
        
        // ===== EARNINGS =====
        regular_pay: payroll.regular_pay || 0,
        overtime_pay: payroll.overtime_pay || 0,
        sunday_pay: payroll.sunday_pay || 0,
        sunday_overtime_pay: payroll.sunday_overtime_pay || 0,
        holiday_pay: payroll.holiday_pay || 0,
        holiday_ot_pay: payroll.holiday_ot_pay || 0,
        special_working_pay: payroll.special_working_pay || 0,
        special_non_working_pay: payroll.special_non_working_pay || 0,
        special_non_working_ot_pay: payroll.special_non_working_ot_pay || 0,
        gross_pay: payroll.gross_pay || 0,
        
        // ===== DEDUCTIONS =====
        tax_withheld: payroll.tax_withheld || 0,
        sss: payroll.sss || 0,
        sss_loan: payroll.sss_loan || 0,
        philhealth: payroll.philhealth || 0,
        pagibig: payroll.pagibig || 0,
        pagibig_loan: payroll.pagibig_loan || 0,
        emergency_advance: payroll.emergency_advance || 0,
        other_deductions: payroll.other_deductions || 0,
        total_deductions: payroll.total_deductions || 0,
        
        // ===== NET =====
        net_pay: payroll.net_pay || 0,
        
        // ===== STATUS =====
        status: payroll.status || 'pending'
      }));
      
      setPayrolls(processedPayrolls);
      setExpandedRows([]);
      
      console.log('[FETCH] Processed payrolls:', processedPayrolls.length);
      if (processedPayrolls.length > 0) {
        console.log('[FETCH] Sample special working hours:', processedPayrolls[0].special_working_hours);
        console.log('[FETCH] Sample special non-working hours:', processedPayrolls[0].special_non_working_hours);
      }
      
    } else {
      console.error("Failed to fetch payroll:", response.data.error);
    }
  } catch (error) {
    console.error('Error fetching payroll:', error);
    setPayrolls([]);
  } finally {
    setLoading(false);
  }
};

  const fetchActiveEmployees = async () => {
    setLoadingEmployees(true);
    setBulkValidationError("");
    try {
      const response = await employeeAPI.getAll();
      
      if (response.data.success) {
        const activeEmployees = response.data.employees
          .filter(emp => emp.status === 'active')
          .sort((a, b) => a.name.localeCompare(b.name));
        
        setEmployees(activeEmployees);
        
        const initialForm = {};
        activeEmployees.forEach(emp => {
          let rate = null;
          
          if (emp.hourly_rate !== undefined && emp.hourly_rate !== null) {
            rate = typeof emp.hourly_rate === 'string' 
              ? parseFloat(emp.hourly_rate) 
              : emp.hourly_rate;
          } 
          else if (emp.hourlyRate !== undefined && emp.hourlyRate !== null) {
            rate = typeof emp.hourlyRate === 'string' 
              ? parseFloat(emp.hourlyRate) 
              : emp.hourlyRate;
          } 
          else if (emp.rate !== undefined && emp.rate !== null) {
            rate = typeof emp.rate === 'string' 
              ? parseFloat(emp.rate) 
              : emp.rate;
          }
          
          if (isNaN(rate) || rate === null || rate === 0) {
            const existingPayroll = payrolls.find(p => p.employee_id === emp.employee_id);
            if (existingPayroll && existingPayroll.hourly_rate) {
              rate = existingPayroll.hourly_rate;
            } else {
              rate = settings?.default_hourly_rate || 86.87;
            }
          }
          
          if (isNaN(rate) || rate <= 0) {
            rate = 86.87;
          }
          
          initialForm[emp.employee_id] = {
            hourly_rate: rate,
            selected: false
          };
        });
        
        setBulkRateForm(initialForm);
        setSelectAll(false);
        setBulkRateSearch("");
        setBulkRateFilter("all");
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
      setBulkValidationError('❌ Failed to fetch employees. Please try again.');
    } finally {
      setLoadingEmployees(false);
    }
  };

  const openBulkRateModal = () => {
    fetchActiveEmployees();
    setIsBulkRateModalOpen(true);
  };

  const handleEmployeeRateChange = (employeeId, value) => {
    setBulkRateForm(prev => ({
      ...prev,
      [employeeId]: {
        ...prev[employeeId],
        hourly_rate: parseFloat(value) || 0
      }
    }));
  };

  const handleSelectEmployee = (employeeId) => {
    setBulkRateForm(prev => ({
      ...prev,
      [employeeId]: {
        ...prev[employeeId],
        selected: !prev[employeeId]?.selected
      }
    }));
    setSelectAll(false);
  };

  const handleSelectAll = () => {
    const newSelectAll = !selectAll;
    setSelectAll(newSelectAll);
    
    const updatedForm = { ...bulkRateForm };
    Object.keys(updatedForm).forEach(empId => {
      updatedForm[empId] = {
        ...updatedForm[empId],
        selected: newSelectAll
      };
    });
    setBulkRateForm(updatedForm);
  };

  const applySameRateToSelected = (rate) => {
    const updatedForm = { ...bulkRateForm };
    let updatedCount = 0;
    
    Object.keys(updatedForm).forEach(empId => {
      if (updatedForm[empId].selected) {
        updatedForm[empId] = {
          ...updatedForm[empId],
          hourly_rate: rate
        };
        updatedCount++;
      }
    });
    
    setBulkRateForm(updatedForm);
    
    if (updatedCount > 0) {
      setBulkValidationError(`✅ Applied rate ₱${rate} to ${updatedCount} selected employee(s)`);
      setTimeout(() => setBulkValidationError(""), 3000);
    }
  };

  const applyBulkRateUpdate = async () => {
    const selectedEmployees = Object.entries(bulkRateForm)
      .filter(([_, data]) => data.selected)
      .map(([empId, data]) => ({
        employee_id: empId,
        hourly_rate: data.hourly_rate,
        name: employees.find(e => e.employee_id === empId)?.name || empId
      }));
    
    if (selectedEmployees.length === 0) {
      setBulkValidationError('❌ Please select at least one employee');
      return;
    }

    if (!window.confirm(`Update hourly rates for ${selectedEmployees.length} employee(s)?`)) {
      return;
    }

    try {
      setLoadingEmployees(true);
      
      const response = await employeeAPI.bulkUpdateRates(selectedEmployees);
      
      if (response.data.success) {
        await logActivity(
          'Bulk Updated Hourly Rates',
          `Updated hourly rates for ${response.data.success_count} employees${response.data.fail_count > 0 ? `, ${response.data.fail_count} failed` : ''}`
        );
        
        if (response.data.fail_count === 0) {
          alert(`✅ Successfully updated rates for ${response.data.success_count} employees!`);
          setIsBulkRateModalOpen(false);
          fetchPayrollData();
        } else {
          alert(`⚠️ Updated ${response.data.success_count} employees, failed for ${response.data.fail_count} employees.\nFailed: ${response.data.failed_employees.join(', ')}`);
        }
      } else {
        setBulkValidationError(`❌ ${response.data.message || 'Failed to update rates'}`);
      }
      
    } catch (error) {
      console.error('Error updating rates:', error);
      
      let successCount = 0;
      let failCount = 0;
      const failedEmployees = [];
      
      for (const emp of selectedEmployees) {
        try {
          await employeeAPI.updateSimpleRate(emp.employee_id, emp.hourly_rate);
          successCount++;
        } catch (err) {
          console.error(`Failed to update ${emp.name}:`, err);
          failCount++;
          failedEmployees.push(emp.name);
        }
      }
      
      if (failCount === 0) {
        alert(`✅ Successfully updated rates for ${successCount} employees!`);
        setIsBulkRateModalOpen(false);
        fetchPayrollData();
      } else {
        alert(`⚠️ Updated ${successCount} employees, failed for ${failCount} employees.\nFailed: ${failedEmployees.join(', ')}`);
      }
    } finally {
      setLoadingEmployees(false);
    }
  };

  const getFilteredBulkEmployees = () => {
    return employees.filter(emp => {
      const matchesSearch = 
        emp.name?.toLowerCase().includes(bulkRateSearch.toLowerCase()) ||
        emp.employee_id?.toLowerCase().includes(bulkRateSearch.toLowerCase()) ||
        emp.department?.toLowerCase().includes(bulkRateSearch.toLowerCase());
      
      if (!matchesSearch) return false;
      
      if (bulkRateFilter === 'selected') {
        return bulkRateForm[emp.employee_id]?.selected;
      } else if (bulkRateFilter === 'unselected') {
        return !bulkRateForm[emp.employee_id]?.selected;
      }
      
      return true;
    });
  };

  const openPayslip = async (payroll) => {
    if (payroll.status !== 'paid') {
      alert('⚠️ This payroll has not been marked as paid yet. Please mark it as paid before viewing the payslip.');
      return;
    }
    
    setSelectedPayslip(payroll);
    setIsPayslipModalOpen(true);
    
    try {
      setLoadingAttendance(true);
      
      // ===== GET HOLIDAYS FROM DATABASE =====
      let holidaysData = {};
      try {
        const holidaysResponse = await API.get("/calendar/holidays");
        if (holidaysResponse.data.success) {
          holidaysData = holidaysResponse.data.holidays.reduce((acc, holiday) => {
            let rate = 1.0;
            
            if (holiday.type === 'regular') {
              rate = 2.0;
            } else if (holiday.type === 'special_non_working') {
              rate = 1.3;
            } else if (holiday.type === 'special_working') {
              rate = 1.0;
            }
            
            acc[holiday.date] = {
              name: holiday.name,
              type: holiday.type,
              rate: rate
            };
            return acc;
          }, {});
        }
      } catch (err) {
        console.error('[Holidays] Failed to load:', err);
      }
      
      const getHolidayInfo = (dateStr) => {
        return holidaysData[dateStr] || null;
      };
      
      // ===== GET SETTINGS FROM DATABASE =====
      let breakSettings = {
        break_enabled: true,
        break_start: "12:00",
        break_end: "13:00",
        unpaid_break: true
      };
      
      let nightShiftSettings = {
        enabled: true,
        start: "22:00",
        end: "06:00",
        differential: 0.10
      };
      
      let nightShiftBreakSettings = {
        enabled: false,
        start: "00:00",
        end: "01:00",
        unpaid: true
      };
      
      let standardWorkHours = 8;
      let sundayRate = 1.30;
      let overtimeRate = 1.25;
      let holidayRate = 2.00;
      
      try {
        const settingsResponse = await attendanceSettingsAPI.get();
        if (settingsResponse.data.success && settingsResponse.data.settings) {
          const dbSettings = settingsResponse.data.settings;
          
          breakSettings = {
            break_enabled: dbSettings.break_enabled ?? true,
            break_start: dbSettings.break_start ?? "12:00",
            break_end: dbSettings.break_end ?? "13:00",
            unpaid_break: dbSettings.unpaid_break ?? true
          };
          
          nightShiftSettings = {
            enabled: dbSettings.night_shift_enabled ?? true,
            start: dbSettings.night_shift_start ?? "22:00",
            end: dbSettings.night_shift_end ?? "06:00",
            differential: dbSettings.night_shift_differential ?? 0.10
          };
          
          if (dbSettings.night_shift_break) {
            nightShiftBreakSettings = {
              enabled: dbSettings.night_shift_break.enabled ?? false,
              start: dbSettings.night_shift_break.start ?? "00:00",
              end: dbSettings.night_shift_break.end ?? "01:00",
              unpaid: dbSettings.night_shift_break.unpaid ?? true
            };
          }
          
          standardWorkHours = dbSettings.standard_work_hours ?? 8;
          sundayRate = dbSettings.sunday_rate ?? 1.30;
          overtimeRate = dbSettings.overtime_rate ?? 1.25;
          holidayRate = dbSettings.holiday_rate ?? 2.00;
        }
      } catch (err) {
        console.error('[SETTINGS] Failed to load, using defaults:', err);
      }
      
      // ===== FETCH ATTENDANCE RECORDS =====
      const response = await attendanceAPI.getByEmployeeNameAndDateRange({
        employee_name: payroll.employee_name,
        start_date: payroll.week_start,
        end_date: payroll.week_end
      });
      
      if (response.data.success) {
        const records = response.data.attendance;
        
        const parseTime = (timeStr) => {
          if (!timeStr) return 0;
          const time = timeStr.includes('T') ? timeStr.split('T')[1] : timeStr;
          const [hours, minutes] = time.split(':');
          return parseInt(hours) + parseInt(minutes) / 60;
        };
        
        const calculateNightHoursWithBreak = (startHour, endHour, nightStartHour, nightEndHour, nightBreakStart, nightBreakEnd, nightBreakEnabled, nightBreakUnpaid) => {
          let nightHours = 0;
          let nightBreakDeducted = 0;
          let currentStart = startHour;
          let currentEnd = endHour;
          
          if (currentEnd < currentStart) {
            currentEnd += 24;
          }
          
          // Night shift window: 22:00 (10 PM) to 06:00 (6 AM)
          let nightStart = nightStartHour;
          let nightEnd = nightEndHour;
          if (nightEnd < nightStart) {
            nightEnd += 24;
          }
          
          const nightOverlapStart = Math.max(currentStart, nightStart);
          const nightOverlapEnd = Math.min(currentEnd, nightEnd);
          
          if (nightOverlapEnd > nightOverlapStart) {
            nightHours = nightOverlapEnd - nightOverlapStart;
            
            // Apply night shift break if enabled and unpaid
            if (nightBreakEnabled && nightBreakUnpaid) {
              let breakStart = nightBreakStart;
              let breakEnd = nightBreakEnd;
              
              if (breakEnd < breakStart) {
                breakEnd += 24;
              }
              
              // Adjust break times for overnight shifts
              if (currentEnd > 24) {
                if (breakStart >= 0 && breakStart < 6) {
                  breakStart += 24;
                  breakEnd += 24;
                }
              }
              
              const breakOverlapStart = Math.max(nightOverlapStart, breakStart);
              const breakOverlapEnd = Math.min(nightOverlapEnd, breakEnd);
              
              if (breakOverlapEnd > breakOverlapStart) {
                nightBreakDeducted = breakOverlapEnd - breakOverlapStart;
                nightHours -= nightBreakDeducted;
              }
            }
          }
          
          return { nightHours: Math.max(0, nightHours), nightBreakDeducted };
        };
        

        const processedRecords = records.map(record => {
          const date = record.date ? record.date.split('T')[0] : null;
          const dateObj = new Date(date);
          const dayName = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][dateObj.getDay()];
          
          const holidayInfo = getHolidayInfo(date);
          const isHoliday = !!holidayInfo;
          const holidayType = holidayInfo?.type || 'regular';
          const holidayName = holidayInfo?.name || '';
          const holidayRateValue = holidayInfo?.rate || 1.0;
          
          const timeIn = record.clock_in_time || record.time_in;
          const timeOut = record.clock_out_time || record.time_out;
          
          let totalHours = 0;
          let nightHours = 0;
          let nightBreakDeducted = 0;
          
          if (timeIn && timeOut) {
            let start = parseTime(timeIn);
            let end = parseTime(timeOut);
            totalHours = end - start;
            if (totalHours < 0) totalHours += 24;
            
            // Deduct regular break if applicable
            if (breakSettings.break_enabled && breakSettings.unpaid_break) {
              const breakStartHour = parseTime(breakSettings.break_start);
              const breakEndHour = parseTime(breakSettings.break_end);
              
              if (breakStartHour !== null && breakEndHour !== null) {
                if (start <= breakStartHour && end >= breakEndHour) {
                  const breakDuration = breakEndHour - breakStartHour;
                  totalHours -= breakDuration;
                }
              }
            }
            
            totalHours = Math.max(0, totalHours);
            
            // Calculate night shift hours with break deduction
            if (nightShiftSettings.enabled) {
              const nightStartHour = parseTime(nightShiftSettings.start);
              let nightEndHour = parseTime(nightShiftSettings.end);
              if (nightEndHour < nightStartHour) nightEndHour += 24;
              
              const nightBreakStart = parseTime(nightShiftBreakSettings.start);
              let nightBreakEnd = parseTime(nightShiftBreakSettings.end);
              if (nightBreakEnd < nightBreakStart) nightBreakEnd += 24;
              
              const nightCalc = calculateNightHoursWithBreak(
                start, end, 
                nightStartHour, nightEndHour,
                nightBreakStart, nightBreakEnd,
                nightShiftBreakSettings.enabled,
                nightShiftBreakSettings.unpaid
              );
              
              nightHours = nightCalc.nightHours;
              nightBreakDeducted = nightCalc.nightBreakDeducted;
            }
          }
          
          const formatDisplayTime = (timeStr) => {
            if (!timeStr) return '-';
            if (timeStr.includes('T')) return timeStr.substring(11, 16);
            return timeStr.substring(0, 5);
          };
          
          // Initialize all hour types
          let regularHours = 0, overtimeHours = 0;
          let sundayHours = 0, sundayOvertimeHours = 0;
          let holidayHours = 0, holidayOvertimeHours = 0;
          let nightRegularHours = 0, nightOvertimeHours = 0;
          let sundayNightHours = 0, sundayNightOvertimeHours = 0;
          let specialWorkingHours = 0, specialNonWorkingHours = 0;
          
          // Determine day type priority: Holiday > Sunday > Regular
          const isRegularHoliday = isHoliday && holidayType === 'regular';
          const isSpecialNonWorking = isHoliday && holidayType === 'special_non_working';
          const isSpecialWorking = isHoliday && holidayType === 'special_working';
          const isSunday = !isHoliday && dayName === 'SUN';
          
          // Separate night and non-night hours
          const nonNightHours = Math.max(0, totalHours - nightHours);
          
          if (totalHours > 0) {
            // First, allocate non-night hours
            let nonNightReg = 0, nonNightOT = 0;
            if (nonNightHours > standardWorkHours) {
              nonNightReg = standardWorkHours;
              nonNightOT = nonNightHours - standardWorkHours;
            } else {
              nonNightReg = nonNightHours;
              nonNightOT = 0;
            }
            
            // Then allocate night hours, starting with filling remaining standard hours
            let nightReg = 0, nightOT = 0;
            if (nightHours > 0) {
              if (nonNightReg >= standardWorkHours) {
                // Already met standard hours with non-night work
                nightOT = nightHours;
              } else {
                const remainingStandard = standardWorkHours - nonNightReg;
                if (nightHours <= remainingStandard) {
                  nightReg = nightHours;
                } else {
                  nightReg = remainingStandard;
                  nightOT = nightHours - remainingStandard;
                }
              }
            }
            
            // Now categorize based on day type
            if (isRegularHoliday) {
              // Regular Holiday - all hours are holiday hours
              holidayHours = nonNightReg + nightReg;
              holidayOvertimeHours = nonNightOT + nightOT;
            } 
            else if (isSpecialNonWorking) {
              // Special Non-Working - if paid, treat as special non-working rate
              specialNonWorkingHours = nonNightReg + nightReg;
              // Overtime on special non-working days gets holiday overtime rate
              holidayOvertimeHours = nonNightOT + nightOT;
            }
            else if (isSpecialWorking) {
              // Special Working - treat as regular with special rate
              specialWorkingHours = nonNightReg + nightReg;
              overtimeHours = nonNightOT;
              nightOvertimeHours = nightOT;
            }
            else if (isSunday) {
              // Sunday - all hours get Sunday premium
              sundayHours = nonNightReg;
              sundayOvertimeHours = nonNightOT;
              sundayNightHours = nightReg;
              sundayNightOvertimeHours = nightOT;
            }
            else {
              // Regular day
              regularHours = nonNightReg;
              overtimeHours = nonNightOT;
              nightRegularHours = nightReg;
              nightOvertimeHours = nightOT;
            }
          }
          
          return {
            date: date,
            dayName: dayName,
            isHoliday: isHoliday,
            holidayType: holidayType,
            holidayName: holidayName,
            time_in: formatDisplayTime(timeIn),
            time_out: formatDisplayTime(timeOut),
            break_start: breakSettings.break_start,
            break_end: breakSettings.break_end,
            regular_hours: regularHours,
            overtime_hours: overtimeHours,
            sunday_hours: sundayHours,
            sunday_overtime_hours: sundayOvertimeHours,
            holiday_hours: holidayHours,
            holiday_overtime_hours: holidayOvertimeHours,
            special_working_hours: specialWorkingHours,
            special_non_working_hours: specialNonWorkingHours,
            night_hours: nightRegularHours,
            night_overtime_hours: nightOvertimeHours,
            sunday_night_hours: sundayNightHours,
            sunday_night_overtime_hours: sundayNightOvertimeHours,
            total_hours: totalHours,
            night_break_deducted: nightBreakDeducted
          };
        });
        
        setAttendanceRecords(processedRecords);
      }
    } catch (error) {
      console.error('[Payslip] Error:', error);
    } finally {
      setLoadingAttendance(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const autoGeneratePayroll = async () => {
    if (!window.confirm(`Generate payroll for ALL active employees for week ${selectedWeek.start} to ${selectedWeek.end}?\n\nThis will automatically calculate hours from attendance records.`)) {
      return;
    }
    
    setGenerating(true);
    try {
      const response = await weeklyPayrollAPI.autoGenerate({
        week_start: selectedWeek.start,
        week_end: selectedWeek.end
      });
      
      if (response.data.success) {
        await logActivity(
          'Created Payroll Records',
          `Generated ${response.data.generated_count} payroll records for week ${selectedWeek.start} to ${selectedWeek.end}`
        );
        
        alert(`✅ Payroll Generated Successfully!\n\n` +
              `Week: ${selectedWeek.start} to ${selectedWeek.end}\n` +
              `New payrolls: ${response.data.generated_count}\n` +
              `Skipped (already exist): ${response.data.skipped_count}`);
        
        fetchPayrollData();
      } else {
        alert(`❌ Failed: ${response.data.message}`);
      }
    } catch (error) {
      console.error('Error generating payroll:', error);
      alert('❌ Error generating payroll. Check console.');
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    fetchPayrollData();
    logActivity('Viewed Salary Management', 'Accessed the payroll management page');
  }, [selectedWeek]);

  const filteredData = payrolls.filter(payroll => {
    const matchesSearch = 
      payroll.employee_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payroll.employee_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payroll.department?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = 
      statusFilter === "all" || 
      payroll.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredData.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(amount || 0);
  };

  const calculateSummaryData = () => {
    if (payrolls.length === 0) {
      return {
        totalEmployees: 0,
        totalGross: 0,
        totalNet: 0,
        totalDeductions: 0,
        pendingCount: 0,
        paidCount: 0,
        totalHours: 0
      };
    }

    let totalGross = 0;
    let totalNet = 0;
    let totalDeductions = 0;
    let pendingCount = 0;
    let paidCount = 0;
    let totalHours = 0;

    payrolls.forEach(payroll => {
      totalGross += payroll.gross_pay || 0;
      totalNet += payroll.net_pay || 0;
      totalDeductions += payroll.total_deductions || 0;
      
      totalHours +=
        (payroll.regular_hours || 0) +
        (payroll.overtime_hours || 0) +
        (payroll.sunday_hours || 0) +
        (payroll.sunday_overtime_hours || 0) +
        (payroll.holiday_hours || 0) +
        (payroll.holiday_overtime || 0) +
        (payroll.night_hours || 0) +
        (payroll.sunday_night_hours || 0) +
        (payroll.night_overtime_hours || 0) +
        (payroll.sunday_night_overtime_hours || 0);

      if (payroll.status === 'pending') pendingCount++;
      if (payroll.status === 'paid') paidCount++;
    });

    return {
      totalEmployees: payrolls.length,
      totalGross,
      totalNet,
      totalDeductions,
      pendingCount,
      paidCount,
      totalHours
    };
  };

const calculateBreakdown = (payroll) => {
  const hourlyRate = payroll.hourly_rate || 0;
  const otRate = payroll.overtime_rate || settings?.overtime_rate || 1.25;
  const sundayRate = payroll.sunday_rate || settings?.sunday_rate || 1.30;
  const regularHolidayRate = payroll.regular_holiday_rate || settings?.regular_holiday_rate || settings?.holiday_rate || 2.00;
  const specialWorkingRate = payroll.special_working_rate || settings?.special_working_rate || 1.0;
  const specialNonWorkingRate = payroll.special_non_working_rate || settings?.special_non_working_rate || 1.3;
  const nightShiftRate = payroll.night_shift_differential || settings?.night_shift_differential || 0.10;
  const holidayOvertimeRate = payroll.holiday_overtime_rate || settings?.holiday_overtime_rate || 1.5; // ADD THIS

  const regularHours = payroll.regular_hours || 0;
  const overtimeHours = payroll.overtime_hours || 0;
  const sundayHours = payroll.sunday_hours || 0;
  const sundayOvertimeHours = payroll.sunday_overtime_hours || 0;
  const holidayHours = payroll.holiday_hours || 0;
  const holidayOvertimeHours = payroll.holiday_overtime || 0;
  const nightHours = payroll.night_hours || 0;
  const sundayNightHours = payroll.sunday_night_hours || 0;
  const nightOvertimeHours = payroll.night_overtime_hours || 0;
  const sundayNightOvertimeHours = payroll.sunday_night_overtime_hours || 0;

  // Special hours from backend
  const specialWorkingHours = payroll.special_working_hours || 0;
  const specialNonWorkingHours = payroll.special_non_working_hours || 0;
  const specialNonWorkingOtHours = payroll.special_non_working_ot_hours || 0; // ADD THIS

  const regularPay = regularHours * hourlyRate;
  const overtimePay = overtimeHours * hourlyRate * otRate;
  const sundayPay = sundayHours * hourlyRate * sundayRate;
  const sundayOvertimePay = sundayOvertimeHours * hourlyRate * sundayRate * otRate;
  const holidayPay = holidayHours * hourlyRate * regularHolidayRate;
  const holidayOvertimePay = holidayOvertimeHours * hourlyRate * regularHolidayRate * holidayOvertimeRate; // USE holidayOvertimeRate
  const specialWorkingPay = specialWorkingHours * hourlyRate * specialWorkingRate;
  const specialNonWorkingPay = specialNonWorkingHours * hourlyRate * specialNonWorkingRate;
  const specialNonWorkingOtPay = specialNonWorkingOtHours * hourlyRate * specialNonWorkingRate * holidayOvertimeRate; // ADD THIS
  
  const nightPay = nightHours * hourlyRate * nightShiftRate;
  const sundayNightPay = sundayNightHours * hourlyRate * sundayRate * (1 + nightShiftRate);
  const nightOvertimePay = nightOvertimeHours * hourlyRate * otRate * (1 + nightShiftRate);
  const sundayNightOvertimePay = sundayNightOvertimeHours * hourlyRate * sundayRate * otRate * (1 + nightShiftRate);
  
  const nightShiftPay = nightPay + sundayNightPay + nightOvertimePay + sundayNightOvertimePay;

  const totalHours =
    regularHours + overtimeHours +
    sundayHours + sundayOvertimeHours +
    holidayHours + holidayOvertimeHours +
    nightHours + sundayNightHours +
    nightOvertimeHours + sundayNightOvertimeHours +
    specialWorkingHours + specialNonWorkingHours + specialNonWorkingOtHours; // ADD specialNonWorkingOtHours

  const totalDeductions =
    (payroll.sss || 0) +
    (payroll.sss_loan || 0) +
    (payroll.philhealth || 0) +
    (payroll.pagibig || 0) +
    (payroll.pagibig_loan || 0) +
    (payroll.tax_withheld || 0) +
    (payroll.emergency_advance || 0) +
    (payroll.other_deductions || 0);

  const grossPay =
    regularPay + overtimePay +
    sundayPay + sundayOvertimePay +
    holidayPay + holidayOvertimePay +
    specialWorkingPay + specialNonWorkingPay + specialNonWorkingOtPay + // ADD specialNonWorkingOtPay
    nightShiftPay;

  return {
    regularPay, overtimePay,
    sundayPay, sundayOvertimePay,
    holidayPay, holidayOvertimePay,
    specialWorkingPay, specialNonWorkingPay,
    specialNonWorkingOtPay,
    nightPay, sundayNightPay, nightOvertimePay, sundayNightOvertimePay,
    nightShiftPay,
    totalHours, totalDeductions,
    grossPay, netPay: grossPay - totalDeductions,
    regularHours, overtimeHours,
    sundayHours, sundayOvertimeHours,
    holidayHours, holidayOvertimeHours,
    specialWorkingHours, specialNonWorkingHours,
    specialNonWorkingOtHours,
    nightHours, sundayNightHours,
    nightOvertimeHours, sundayNightOvertimeHours,
    hourlyRate, otRate, sundayRate, regularHolidayRate, specialWorkingRate, specialNonWorkingRate, nightShiftRate, holidayOvertimeRate
  };
};

  const summary = calculateSummaryData();

  const openEditModal = (payroll) => {
    setEditingPayroll(payroll);
    setFormData({
      regular_hours: payroll.regular_hours || 0,
      overtime_hours: payroll.overtime_hours || 0,
      sunday_hours: payroll.sunday_hours || 0,
      sunday_overtime_hours: payroll.sunday_overtime_hours || 0,
      holiday_hours: payroll.holiday_hours || 0,
      holiday_overtime: payroll.holiday_overtime || 0,
      hourly_rate: payroll.hourly_rate || 86.87,
      sss: payroll.sss || 0,
      sss_loan: payroll.sss_loan || 0,
      philhealth: payroll.philhealth || 0,
      pagibig: payroll.pagibig || 0,
      pagibig_loan: payroll.pagibig_loan || 0,
      tax_withheld: payroll.tax_withheld || 0,
      emergency_advance: payroll.emergency_advance || 0,
      other_deductions: payroll.other_deductions || 0,
      status: payroll.status || 'pending'
    });
    setRateModified(false);
    setIsEditModalOpen(true);
  };

  const handleInputChange = (e) => {
    const { name, value, type } = e.target;
    
    if (name === 'hourly_rate') {
      setRateModified(true);
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) || 0 : value
    }));
  };

  const quickAdjustRate = (adjustment) => {
    setFormData(prev => ({
      ...prev,
      hourly_rate: Math.max(0, (prev.hourly_rate || 0) + adjustment)
    }));
    setRateModified(true);
  };

const saveEditedPayroll = async () => {
  try {
    const hourlyRate = formData.hourly_rate;
    const otRate = settings?.overtime_rate || 1.25;
    const sundayRate = settings?.sunday_rate || 1.30;
    const regularHolidayRate = settings?.regular_holiday_rate || settings?.holiday_rate || 2.00;
    const specialWorkingRate = settings?.special_working_rate || 1.0;
    const specialNonWorkingRate = settings?.special_non_working_rate || 1.3;
    const nightShiftRate = settings?.night_shift_differential || 0.10;
    const holidayOvertimeRate = settings?.holiday_overtime_rate || 1.5;

    // Get hours from form data
    const regularHours = formData.regular_hours || 0;
    const overtimeHours = formData.overtime_hours || 0;
    const sundayHours = formData.sunday_hours || 0;
    const sundayOvertimeHours = formData.sunday_overtime_hours || 0;
    const holidayHours = formData.holiday_hours || 0;
    const holidayOvertimeHours = formData.holiday_overtime || 0;
    const specialWorkingHours = formData.special_working_hours || 0;
    const specialNonWorkingHours = formData.special_non_working_hours || 0;
    const specialNonWorkingOtHours = formData.special_non_working_ot_hours || 0;
    const nightHours = formData.night_hours || 0;
    const sundayNightHours = formData.sunday_night_hours || 0;
    const nightOvertimeHours = formData.night_overtime_hours || 0;
    const sundayNightOvertimeHours = formData.sunday_night_overtime_hours || 0;

    // Calculate all earnings
    const regularPay = regularHours * hourlyRate;
    const overtimePay = overtimeHours * hourlyRate * otRate;
    const sundayPay = sundayHours * hourlyRate * sundayRate;
    const sundayOvertimePay = sundayOvertimeHours * hourlyRate * sundayRate * otRate;
    const holidayPay = holidayHours * hourlyRate * regularHolidayRate;
    const holidayOvertimePay = holidayOvertimeHours * hourlyRate * regularHolidayRate * holidayOvertimeRate;
    const specialWorkingPay = specialWorkingHours * hourlyRate * specialWorkingRate;
    const specialNonWorkingPay = specialNonWorkingHours * hourlyRate * specialNonWorkingRate;
    const specialNonWorkingOtPay = specialNonWorkingOtHours * hourlyRate * specialNonWorkingRate * holidayOvertimeRate;
    
    const nightPay = nightHours * hourlyRate * nightShiftRate;
    const sundayNightPay = sundayNightHours * hourlyRate * sundayRate * (1 + nightShiftRate);
    const nightOvertimePay = nightOvertimeHours * hourlyRate * otRate * (1 + nightShiftRate);
    const sundayNightOvertimePay = sundayNightOvertimeHours * hourlyRate * sundayRate * otRate * (1 + nightShiftRate);
    
    const nightShiftPay = nightPay + sundayNightPay + nightOvertimePay + sundayNightOvertimePay;

    // Calculate gross pay
    const grossPay = regularPay + overtimePay + sundayPay + sundayOvertimePay +
                     holidayPay + holidayOvertimePay + specialWorkingPay + 
                     specialNonWorkingPay + specialNonWorkingOtPay + nightShiftPay;

    // Calculate total deductions
    const totalDeductions = (formData.sss || 0) + (formData.sss_loan || 0) +
                            (formData.philhealth || 0) + (formData.pagibig || 0) +
                            (formData.pagibig_loan || 0) + (formData.tax_withheld || 0) +
                            (formData.emergency_advance || 0) + (formData.other_deductions || 0);

    // Calculate net pay
    const netPay = grossPay - totalDeductions;

    // Prepare complete payroll data with recalculated values
    const payrollData = {
      ...editingPayroll,
      ...formData,
      // Recalculated values
      regular_pay: regularPay,
      overtime_pay: overtimePay,
      sunday_pay: sundayPay,
      sunday_overtime_pay: sundayOvertimePay,
      holiday_pay: holidayPay,
      holiday_ot_pay: holidayOvertimePay,
      special_working_pay: specialWorkingPay,
      special_non_working_pay: specialNonWorkingPay,
      special_non_working_ot_pay: specialNonWorkingOtPay,
      night_shift_pay: nightShiftPay,
      gross_pay: grossPay,
      total_deductions: totalDeductions,
      net_pay: netPay,
      // Rate settings
      overtime_rate: otRate,
      sunday_rate: sundayRate,
      regular_holiday_rate: regularHolidayRate,
      special_working_rate: specialWorkingRate,
      special_non_working_rate: specialNonWorkingRate,
      night_shift_differential: nightShiftRate,
      holiday_overtime_rate: holidayOvertimeRate,
    };
    
    if (rateModified) {
      try {
        await employeeAPI.updateSimpleRate(editingPayroll.employee_id, formData.hourly_rate);
        console.log('Hourly rate updated successfully');
      } catch (rateError) {
        console.error('Failed to update hourly rate:', rateError);
      }
    }
    
    const response = await weeklyPayrollAPI.save(payrollData);
    
    if (response.data.success) {
      const rateChangeMsg = rateModified ? ` (Rate updated to ₱${formData.hourly_rate})` : '';
      
      await logActivity(
        'Updated Payroll Record',
        `Updated payroll for ${editingPayroll.employee_name} (${editingPayroll.employee_id}) - Week ${editingPayroll.week_start}${rateChangeMsg}`
      );
      
      alert('✅ Payroll updated!');
      setIsEditModalOpen(false);
      fetchPayrollData();
    } else {
      alert(`❌ Failed: ${response.data.message || 'Unknown error'}`);
    }
  } catch (error) {
    console.error('Error saving:', error);
    alert('❌ Failed to update. Check console.');
  }
};

  const deletePayroll = async (payrollId) => {
    if (!window.confirm('Are you sure you want to delete this payroll record?')) {
      return;
    }
    
    try {
      const payroll = payrolls.find(p => p._id === payrollId);
      
      const response = await weeklyPayrollAPI.delete(payrollId);
      if (response.data.success) {
        if (payroll) {
          await logActivity(
            'Deleted Payroll Record',
            `Deleted payroll for ${payroll.employee_name} (${payroll.employee_id}) - Week ${payroll.week_start}`
          );
        }
        
        alert('✅ Payroll deleted');
        fetchPayrollData();
      } else {
        alert(`❌ Failed: ${response.data.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error deleting:', error);
      alert('❌ Failed to delete. Check console.');
    }
  };

  const deleteAllForWeek = async () => {
    if (!window.confirm(`⚠️ WARNING: This will delete ALL payroll records for the week ${selectedWeek.start} to ${selectedWeek.end}.\n\nThis action cannot be undone! Are you sure you want to continue?`)) {
      return;
    }
    
    try {
      const response = await weeklyPayrollAPI.deleteByWeek({
        week_start: selectedWeek.start,
        week_end: selectedWeek.end
      });
      
      if (response.data.success) {
        await logActivity(
          'Deleted All Payroll Records',
          `Deleted ${response.data.deleted_count} payroll records for week ${selectedWeek.start} to ${selectedWeek.end}`
        );
        
        alert(`✅ Successfully deleted ${response.data.deleted_count} payroll record(s) for the week!`);
        fetchPayrollData();
      } else {
        alert(`❌ Failed: ${response.data.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error deleting all records:', error);
      alert('❌ Failed to delete records. Check console.');
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  const markAsPaid = async (payrollId) => {
    if (!window.confirm('Are you sure you want to mark this payroll as paid?')) {
      return;
    }
    
    try {
      const payrollToUpdate = payrolls.find(p => p._id === payrollId);
      if (!payrollToUpdate) {
        alert('Payroll record not found!');
        return;
      }
      
      const updatedPayroll = {
        ...payrollToUpdate,
        status: 'paid'
      };
      
      const response = await weeklyPayrollAPI.save(updatedPayroll);
      
      if (response.data.success) {
        await logActivity(
          'Marked Payroll as Paid',
          `Marked ${payrollToUpdate.employee_name}'s payroll (${payrollToUpdate.employee_id}) as paid - Week ${payrollToUpdate.week_start}`
        );
        
        alert('✅ Marked as paid!');
        fetchPayrollData();
      } else {
        alert(`❌ Failed: ${response.data.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error marking as paid:', error);
      alert('❌ Failed to update status. Please try editing the payroll manually.');
    }
  };

  const printPayslip = () => {
    if (payslipRef.current) {
      const printContents = payslipRef.current.innerHTML;
      const printWindow = window.open('', '_blank');
      printWindow.document.write(`
        <html>
          <head>
            <title>Payslip_${selectedPayslip?.employee_name}</title>
            <style>
              @media print {
                body {
                  margin: 0;
                  padding: 20px;
                }
                .no-print {
                  display: none;
                }
                @page {
                  size: auto;
                  margin: 10mm;
                }
              }
              body {
                font-family: 'Courier New', monospace;
                margin: 0;
                padding: 20px;
                background: white;
              }
              table {
                border-collapse: collapse;
                width: 100%;
                margin-bottom: 10px;
              }
              td, th {
                border: 1px solid #000;
                padding: 4px;
              }
            </style>
          </head>
          <body>
            ${printContents}
            <div class="no-print" style="text-align: center; margin-top: 20px;">
              <button onclick="window.print()" style="padding: 8px 16px; margin: 0 5px;">Print</button>
              <button onclick="window.close()" style="padding: 8px 16px; margin: 0 5px;">Close</button>
            </div>
            <script>
              window.onload = function() {
                setTimeout(function() {
                  window.print();
                }, 500);
              };
            <\/script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  // Styles
  const card = { background: '#fff', borderRadius: 10, boxShadow: '0 2px 10px rgba(0,0,0,0.1)', overflow: 'hidden' };
  const table = { width: '100%', borderCollapse: 'collapse', fontSize: '14px' };
  const th = { padding: '12px', textAlign: 'left', fontWeight: 600, color: '#555', fontSize: '13px' };
  const td = { padding: '12px', fontSize: '13px' };
  const centerText = { padding: 40, textAlign: 'center', color: '#7f8c8d' };
  const searchInput = { padding: '8px 12px', border: '1px solid #ddd', borderRadius: 5, fontSize: '14px' };

  const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1050 };
  const modal = { background: '#fff', padding: '25px', borderRadius: 10, width: 950, maxHeight: '80vh', overflowY: 'auto' };
  const input = { width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: 5, fontSize: '13px' };

  const btnPrimary = { 
    padding: '8px 16px', 
    background: '#007bff', 
    color: '#fff', 
    border: 'none', 
    borderRadius: 4, 
    cursor: 'pointer',
    fontSize: '13px'
  };
  
  const btnSecondary = { 
    padding: '8px 16px', 
    background: '#6c757d', 
    color: '#fff', 
    border: 'none', 
    borderRadius: 4, 
    cursor: 'pointer',
    fontSize: '13px'
  };
  
  const btnDanger = { 
    padding: '4px 8px', 
    background: '#dc3545', 
    color: '#fff', 
    border: 'none', 
    borderRadius: 3, 
    cursor: 'pointer',
    fontSize: '12px'
  };

  const btnSuccess = { 
    padding: '4px 8px', 
    background: '#28a745', 
    color: '#fff', 
    border: 'none', 
    borderRadius: 3, 
    cursor: 'pointer',
    fontSize: '12px',
    minWidth: '60px'
  };

  const infoBox = { background: '#f8f9fa', padding: '12px', borderRadius: '5px', marginBottom: '15px', border: '1px solid #eee', fontSize: '13px' };
  const errorBox = { background: '#f8d7da', color: '#721c24', padding: '10px', borderRadius: '4px', marginBottom: '15px', fontSize: '13px', border: '1px solid #f5c6cb' };

  return (
    <div className="container-fluid p-4">
      {/* Page Header */}
      <div className="mb-4">
        <div className="d-flex justify-content-between align-items-center">
          <div>
            <h4 className="fw-bold mb-1">Payroll Management</h4>
            <small className="text-muted">
              Manage employee payroll calculations and records
            </small>
          </div>
          <div className="d-flex gap-2">
            <button 
              className="btn btn-outline-warning btn-sm"
              onClick={() => setIsSettingsModalOpen(true)}
            >
              <i className="bi bi-sliders me-1"></i> Edit Rates
            </button>
            
            <button 
              className="btn btn-outline-primary btn-sm"
              onClick={openBulkRateModal}
            >
              <i className="bi bi-people me-1"></i> Hourly Rate Edits
            </button>
            
            <Link to="/benefits" className="btn btn-outline-success btn-sm">
              <i className="bi bi-gift me-1"></i> Benefits Management
            </Link>
          </div>
        </div>
      </div>

{/* Settings Bar - Updated to show all 3 holiday types */}
{settings && (
  <div className="card bg-light mb-3">
    <div className="card-body py-2">
      <div className="row align-items-center">
        <div className="col-md-2">
          <small className="text-muted">⚙️ Current Settings:</small>
        </div>
        <div className="col-md-10">
          <div className="d-flex flex-wrap gap-1">
            <span className="badge bg-primary me-1">
              Work Day: <strong>{settings.standard_work_hours || 8}h</strong>
            </span>
            <span className="badge bg-warning text-dark me-1">
              OT Rate: <strong>{settings.overtime_rate || 1.25}x</strong>
            </span>
            <span className="badge bg-info me-1">
              Sunday: <strong>{settings.sunday_rate || 1.30}x</strong>
            </span>
            <span className="badge bg-dark me-1">
              Night Diff: <strong>{((settings.night_shift_differential || 0.10) * 100).toFixed(0)}%</strong>
            </span>
            <span className="badge bg-danger me-1">
              Regular Holiday: <strong>{settings.regular_holiday_paid ? `${settings.regular_holiday_rate || 2.0}x` : 'Unpaid'}</strong>
            </span>
            <span className="badge" style={{ backgroundColor: '#fd7e14', color: 'white' }}>
              Special Working: <strong>{settings.special_working_paid ? `${settings.special_working_rate || 1.0}x` : 'Unpaid'}</strong>
            </span>
            <span className="badge" style={{ backgroundColor: '#ffc107', color: '#000' }}>
              Special Non-Working: <strong>{settings.special_non_working_paid ? `${settings.special_non_working_rate || 1.3}x (if worked)` : 'No Pay'}</strong>
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
)}

      {/* Summary Cards */}
      <div className="row g-2 mb-3">
        {[
          { color: "primary", icon: "bi-people", value: summary.totalEmployees, label: "Employees" },
          { color: "success", icon: "bi-cash-stack", value: formatCurrency(summary.totalGross), label: "Gross Pay" },
          { color: "warning", icon: "bi-wallet2", value: formatCurrency(summary.totalNet), label: "Net Pay" },
          { color: "danger", icon: "bi-clock-history", value: `${summary.totalHours.toFixed(1)}h`, label: "Total Hours" },
          { color: "info", icon: "bi-hourglass-split", value: summary.pendingCount, label: "Pending" },
          { color: "success", icon: "bi-check-circle", value: summary.paidCount, label: "Paid" },
        ].map((card, index) => (
          <div key={index} className="col-6 col-md-4 col-lg-2">
            <div className={`card border-${card.color} shadow-sm h-100`}>
              <div className="card-body p-2 text-center">
                <div className={`text-${card.color} mb-1`}>
                  <i className={`bi ${card.icon} fs-6`}></i>
                </div>
                <div className="fw-bold small text-truncate">{card.value}</div>
                <div className="text-muted" style={{ fontSize: "0.75rem" }}>{card.label}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Controls and Filters */}
      <div className="card border shadow-sm rounded-3 mb-4">
        <div className="card-header bg-white border-bottom rounded-top-3 py-3">
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <h6 className="fw-bold mb-0">
                <i className="bi bi-sliders me-2 text-primary"></i>
                Filters & Controls
              </h6>
            </div>
            <div className="text-muted small d-none d-lg-block">
              <i className="bi bi-calendar-week me-1"></i>
              Week: {formatDate(selectedWeek.start)} to {formatDate(selectedWeek.end)}
            </div>
          </div>
        </div>
        <div className="card-body">
          <div className="row g-3">
            <div className="col-xxl-3 col-xl-4 col-lg-6 col-md-12 mb-3">
              <div>
                <label className="form-label fw-semibold mb-2">
                  <i className="bi bi-calendar3 me-1"></i>
                  Select Week
                </label>
                <div className="d-flex align-items-center gap-2 mb-2">
                  <button className="btn btn-outline-secondary btn-sm flex-shrink-0 px-2" onClick={() => navigateWeek('prev')}>
                    <i className="bi bi-chevron-left"></i>
                  </button>
                  <div className="flex-grow-1">
                    <input
                      type="date"
                      className="form-control form-control-sm"
                      value={selectedWeek.end}
                      onChange={(e) => handleSaturdayChange(e.target.value)}
                    />
                  </div>
                  <button className="btn btn-outline-secondary btn-sm flex-shrink-0 px-2" onClick={() => navigateWeek('next')}>
                    <i className="bi bi-chevron-right"></i>
                  </button>
                </div>
                <small className="text-muted d-block">
                  {formatDate(selectedWeek.start)} to {formatDate(selectedWeek.end)}
                </small>
              </div>
            </div>

            <div className="col-xxl-3 col-xl-4 col-lg-6 col-md-12 mb-3">
              <div>
                <label className="form-label fw-semibold mb-2">
                  <i className="bi bi-search me-1"></i>
                  Search Employees
                </label>
                <div className="input-group">
                  <span className="input-group-text bg-white border-end-0 py-1">
                    <i className="bi bi-search text-muted"></i>
                  </span>
                  <input
                    type="text"
                    className="form-control border-start-0 py-1"
                    placeholder="Name, ID, or department..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setCurrentPage(1);
                    }}
                  />
                  {searchTerm && (
                    <button className="btn btn-outline-secondary border-start-0 py-1" onClick={() => setSearchTerm("")}>
                      <i className="bi bi-x"></i>
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="col-xxl-3 col-xl-4 col-lg-6 col-md-12 mb-3">
              <div>
                <label className="form-label fw-semibold mb-2">
                  <i className="bi bi-funnel me-1"></i>
                  Filter by Status
                </label>
                <div className="d-flex flex-wrap gap-2 mb-1">
                  <button
                    className={`btn btn-sm px-3 ${statusFilter === 'all' ? 'btn-primary' : 'btn-outline-primary'}`}
                    onClick={() => { setStatusFilter('all'); setCurrentPage(1); }}
                  >All</button>
                  <button
                    className={`btn btn-sm px-3 ${statusFilter === 'pending' ? 'btn-warning' : 'btn-outline-warning'}`}
                    onClick={() => { setStatusFilter('pending'); setCurrentPage(1); }}
                  >Pending</button>
                  <button
                    className={`btn btn-sm px-3 ${statusFilter === 'paid' ? 'btn-success' : 'btn-outline-success'}`}
                    onClick={() => { setStatusFilter('paid'); setCurrentPage(1); }}
                  >Paid</button>
                </div>
              </div>
            </div>

            <div className="col-xxl-3 col-xl-12 col-lg-6 col-md-12">
              <div>
                <label className="form-label fw-semibold mb-2">
                  <i className="bi bi-lightning-charge me-1"></i>
                  Actions
                </label>
                <div className="row g-2">
                  <div className="col-sm-4 col-12">
                    <button className="btn btn-primary btn-sm w-100" onClick={fetchPayrollData} disabled={loading}>
                      {loading ? (
                        <><span className="spinner-border spinner-border-sm me-1"></span>Loading</>
                      ) : (
                        <><i className="bi bi-arrow-clockwise me-1"></i>Refresh</>
                      )}
                    </button>
                  </div>
                  <div className="col-sm-4 col-12">
                    <button className="btn btn-success btn-sm w-100" onClick={autoGeneratePayroll} disabled={generating}>
                      {generating ? (
                        <><span className="spinner-border spinner-border-sm me-1"></span>Generating</>
                      ) : (
                        <><i className="bi bi-lightning-charge me-1"></i>Generate</>
                      )}
                    </button>
                  </div>
                  <div className="col-sm-4 col-12">
                    <button 
                      className="btn btn-danger btn-sm w-100" 
                      onClick={deleteAllForWeek} 
                      disabled={payrolls.length === 0 || loading}
                      title={payrolls.length === 0 ? "No records to delete" : "Delete all records for this week"}
                    >
                      <i className="bi bi-trash3 me-1"></i>
                      Delete All ({payrolls.length})
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Payroll Table */}
      <div className="card border shadow-sm rounded-3">
        <div className="card-header bg-white border-bottom rounded-top-3 py-3">
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <h6 className="fw-bold mb-0">
                <i className="bi bi-cash-coin me-2 text-primary"></i>
                Payroll Records
              </h6>
              <small className="text-muted">
                Showing {filteredData.length} of {payrolls.length} records
              </small>
            </div>
            <div className="text-end">
              <div className="small text-muted">Total Gross</div>
              <div className="fw-bold text-success">{formatCurrency(summary.totalGross)}</div>
            </div>
          </div>
        </div>
        
        {loading ? (
          <div className="card-body text-center py-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <p className="mt-2">Loading payroll records...</p>
          </div>
        ) : filteredData.length === 0 ? (
          <div className="card-body text-center py-5">
            <i className="bi bi-cash-stack fs-1 text-muted mb-3"></i>
            <h5>No payroll records found</h5>
            <p className="text-muted">
              {searchTerm || statusFilter !== 'all' 
                ? 'No records match your filters.' 
                : `No records found for week ${selectedWeek.start} to ${selectedWeek.end}`}
            </p>
            {!searchTerm && statusFilter === 'all' && (
              <button className="btn btn-success mt-2" onClick={autoGeneratePayroll}>
                <i className="bi bi-lightning-charge me-1"></i>
                Generate Payroll
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="card-body p-0">
              <div className="table-responsive">
                <table className="table table-hover mb-0">
                  <thead className="table-light">
                    <tr>
                      <th className="ps-3" style={{ width: '5%' }}></th>
                      <th style={{ width: '22%' }}>Employee</th>
                      <th className="text-center" style={{ width: '12%' }}>Hours</th>
                      <th className="text-center" style={{ width: '18%' }}>Gross Pay</th>
                      <th className="text-center" style={{ width: '15%' }}>Net Pay</th>
                      <th className="text-center" style={{ width: '10%' }}>Status</th>
                      <th className="text-center" style={{ width: '18%' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentItems.map((payroll, index) => {
                      const breakdown = calculateBreakdown(payroll);
                      const isExpanded = expandedRows.includes(payroll._id);
                      
                      return (
                        <React.Fragment key={payroll._id || index}>
                          <tr 
                            className="border-bottom hover-row"
                            style={{ cursor: 'pointer' }}
                            onClick={() => toggleRowExpansion(payroll._id)}
                          >
                            <td className="ps-3 align-middle">
                              <i className={`bi bi-chevron-right transition-all ${isExpanded ? 'rotate-90' : ''}`}></i>
                            </td>
                            <td className="align-middle">
                              <div className="fw-bold">{payroll.employee_name}</div>
                              <div className="small text-muted">
                                {payroll.department} • {payroll.employee_id}
                              </div>
                              <div className="small text-primary">
                                ₱{payroll.hourly_rate?.toFixed(2)}/hr
                              </div>
                            </td>
                            <td className="align-middle text-center">
                              <div className="fw-semibold">{breakdown.totalHours.toFixed(1)}h</div>
                            </td>
                            <td className="align-middle text-center">
                              <div className="fw-bold text-success">{formatCurrency(breakdown.grossPay)}</div>
                              <div className="small text-danger">-{formatCurrency(breakdown.totalDeductions)}</div>
                            </td>
                            <td className="align-middle text-center">
                              <div className="fw-bold fs-5" style={{ color: '#28a745' }}>
                                {formatCurrency(breakdown.netPay)}
                              </div>
                            </td>
                            <td className="align-middle text-center">
                              <span className={`badge ${payroll.status === 'paid' ? 'bg-success' : 'bg-warning'}`}>
                                {payroll.status?.toUpperCase()}
                              </span>
                            </td>
                            <td className="align-middle text-center" onClick={(e) => e.stopPropagation()}>
                              <div className="btn-group btn-group-sm">
                                {payroll.status === 'paid' && (
                                  <button 
                                    className="btn btn-outline-info" 
                                    onClick={() => openPayslip(payroll)} 
                                    title="View Payslip"
                                  >
                                    <i className="bi bi-receipt"></i>
                                  </button>
                                )}
                                {payroll.status === 'pending' && (
                                  <>
                                    <button className="btn btn-outline-warning" onClick={() => openEditModal(payroll)} title="Edit">
                                      <i className="bi bi-pencil"></i>
                                    </button>
                                    <button 
                                      className="btn btn-outline-success" 
                                      onClick={() => markAsPaid(payroll._id)} 
                                      title="Mark as Paid"
                                    >
                                      <i className="bi bi-cash"></i>
                                    </button>
                                    <button className="btn btn-outline-danger" onClick={() => deletePayroll(payroll._id)} title="Delete">
                                      <i className="bi bi-trash"></i>
                                    </button>
                                  </>
                                )}
                                {payroll.status === 'paid' && (
                                  <button className="btn btn-outline-danger" onClick={() => deletePayroll(payroll._id)} title="Delete">
                                    <i className="bi bi-trash"></i>
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>                        
                            {isExpanded && (
                              <tr className="bg-light">
                                <td colSpan="7" className="p-0">
                                  <div className="p-4">
                                    <div className="row">
                                      <div className="col-md-12">
                                        <h6 className="fw-bold mb-3">
                                          <i className="bi bi-calculator me-2"></i>
                                          Earnings Breakdown (Hourly Rate: {formatCurrency(breakdown.hourlyRate)})
                                        </h6>
                                        <div className="card bg-white border-0 shadow-sm">
                                          <div className="card-body">
                                            <div className="row">
                                              <div className="col-md-6">
                                                <table className="table table-sm">
                                                  <tbody>
                                                    <tr>
                                                      <td>Regular Hours:</td>
                                                      <td className="text-end">{breakdown.regularHours.toFixed(2)}h</td>
                                                      <td className="text-end">{formatCurrency(breakdown.regularPay)}</td>
                                                    </tr>
                                                    {breakdown.overtimeHours > 0 && (
                                                      <tr>
                                                        <td>Overtime ({breakdown.otRate}x):</td>
                                                        <td className="text-end">{breakdown.overtimeHours.toFixed(2)}h</td>
                                                        <td className="text-end">{formatCurrency(breakdown.overtimePay)}</td>
                                                      </tr>
                                                    )}
                                                    {breakdown.sundayHours > 0 && (
                                                      <tr>
                                                        <td>Sunday ({breakdown.sundayRate}x):</td>
                                                        <td className="text-end">{breakdown.sundayHours.toFixed(2)}h</td>
                                                        <td className="text-end">{formatCurrency(breakdown.sundayPay)}</td>
                                                      </tr>
                                                    )}
                                                    {breakdown.sundayOvertimeHours > 0 && (
                                                      <tr>
                                                        <td>Sunday OT ({breakdown.sundayRate}x × {breakdown.otRate}x):</td>
                                                        <td className="text-end">{breakdown.sundayOvertimeHours.toFixed(2)}h</td>
                                                        <td className="text-end">{formatCurrency(breakdown.sundayOvertimePay)}</td>
                                                      </tr>
                                                    )}
                                                    {breakdown.holidayHours > 0 && (
                                                      <tr style={{ backgroundColor: '#ffebee' }}>
                                                        <td>🔴 Regular Holiday ({breakdown.regularHolidayRate}x):</td>
                                                        <td className="text-end">{breakdown.holidayHours.toFixed(2)}h</td>
                                                        <td className="text-end">{formatCurrency(breakdown.holidayPay)}</td>
                                                      </tr>
                                                    )}
                                                    {breakdown.holidayOvertimeHours > 0 && (
                                                      <tr style={{ backgroundColor: '#ffebee' }}>
                                                        <td>Regular Holiday OT ({breakdown.regularHolidayRate}x × {breakdown.otRate}x):</td>
                                                        <td className="text-end">{breakdown.holidayOvertimeHours.toFixed(2)}h</td>
                                                        <td className="text-end">{formatCurrency(breakdown.holidayOvertimePay)}</td>
                                                      </tr>
                                                    )}
                                                    {/* Update the special working row */}
                                                    {breakdown.specialWorkingHours > 0 && (
                                                      <tr style={{ backgroundColor: '#fff3e0' }}>
                                                        <td>🟠 Special Working Day ({breakdown.specialWorkingRate}x):</td>
                                                        <td className="text-end">{breakdown.specialWorkingHours.toFixed(2)}h</td>
                                                        <td className="text-end">{formatCurrency(breakdown.specialWorkingPay)}</td>
                                                      </tr>
                                                    )}

                                                    {/* Update the special non-working row */}
                                                    {breakdown.specialNonWorkingHours > 0 && (
                                                      <tr style={{ backgroundColor: '#fffde7' }}>
                                                        <td>🟡 Special Non-Working Day ({breakdown.specialNonWorkingRate}x):</td>
                                                        <td className="text-end">{breakdown.specialNonWorkingHours.toFixed(2)}h</td>
                                                        <td className="text-end">{formatCurrency(breakdown.specialNonWorkingPay)}</td>
                                                      </tr>
                                                    )}

                                                    {/* Add special non-working overtime row */}
                                                    {breakdown.specialNonWorkingOtHours > 0 && (
                                                      <tr style={{ backgroundColor: '#fffde7' }}>
                                                        <td>🟡 Special Non-Working OT ({breakdown.specialNonWorkingRate}x × {breakdown.holidayOvertimeRate}x):</td>
                                                        <td className="text-end">{breakdown.specialNonWorkingOtHours.toFixed(2)}h</td>
                                                        <td className="text-end">{formatCurrency(breakdown.specialNonWorkingOtPay)}</td>
                                                      </tr>
                                                    )}
                                                    {breakdown.nightHours > 0 && (
                                                      <tr>
                                                        <td>Night Regular (+{(breakdown.nightShiftRate * 100).toFixed(0)}%):</td>
                                                        <td className="text-end">{breakdown.nightHours.toFixed(2)}h</td>
                                                        <td className="text-end">{formatCurrency(breakdown.nightPay)}</td>
                                                      </tr>
                                                    )}
                                                    {breakdown.nightOvertimeHours > 0 && (
                                                      <tr>
                                                        <td>Night OT ({breakdown.otRate}x +{(breakdown.nightShiftRate * 100).toFixed(0)}%):</td>
                                                        <td className="text-end">{breakdown.nightOvertimeHours.toFixed(2)}h</td>
                                                        <td className="text-end">{formatCurrency(breakdown.nightOvertimePay)}</td>
                                                      </tr>
                                                    )}
                                                    {breakdown.sundayNightHours > 0 && (
                                                      <tr>
                                                        <td>Sunday Night ({breakdown.sundayRate}x +{(breakdown.nightShiftRate * 100).toFixed(0)}%):</td>
                                                        <td className="text-end">{breakdown.sundayNightHours.toFixed(2)}h</td>
                                                        <td className="text-end">{formatCurrency(breakdown.sundayNightPay)}</td>
                                                      </tr>
                                                    )}
                                                    {breakdown.sundayNightOvertimeHours > 0 && (
                                                      <tr>
                                                        <td>Sunday Night OT ({breakdown.sundayRate}x × {breakdown.otRate}x +{(breakdown.nightShiftRate * 100).toFixed(0)}%):</td>
                                                        <td className="text-end">{breakdown.sundayNightOvertimeHours.toFixed(2)}h</td>
                                                        <td className="text-end">{formatCurrency(breakdown.sundayNightOvertimePay)}</td>
                                                      </tr>
                                                    )}
                                                  </tbody>
                                                  <tfoot className="table-group-divider">
                                                    <tr>
                                                      <th colSpan="2">Total Gross:</th>
                                                      <th className="text-end text-success fw-bold">{formatCurrency(breakdown.grossPay)}</th>
                                                    </tr>
                                                  </tfoot>
                                                </table>
                                              </div>
                                              <div className="col-md-6">
                                                <table className="table table-sm">
                                                  <tbody>
                                                    <tr>
                                                      <td>SSS:</td>
                                                      <td className="text-end">{formatCurrency(payroll.sss || 0)}</td>
                                                    </tr>
                                                    {(payroll.sss_loan || 0) > 0 && (
                                                      <tr>
                                                        <td>SSS Loan:</td>
                                                        <td className="text-end">{formatCurrency(payroll.sss_loan)}</td>
                                                      </tr>
                                                    )}
                                                    <tr>
                                                      <td>PhilHealth:</td>
                                                      <td className="text-end">{formatCurrency(payroll.philhealth || 0)}</td>
                                                    </tr>
                                                    <tr>
                                                      <td>Pag-IBIG:</td>
                                                      <td className="text-end">{formatCurrency(payroll.pagibig || 0)}</td>
                                                    </tr>
                                                    {(payroll.pagibig_loan || 0) > 0 && (
                                                      <tr>
                                                        <td>Pag-IBIG Loan:</td>
                                                        <td className="text-end">{formatCurrency(payroll.pagibig_loan)}</td>
                                                      </tr>
                                                    )}
                                                    {(payroll.tax_withheld || 0) > 0 && (
                                                      <tr>
                                                        <td>Withholding Tax:</td>
                                                        <td className="text-end">{formatCurrency(payroll.tax_withheld)}</td>
                                                      </tr>
                                                    )}
                                                    {(payroll.emergency_advance || 0) > 0 && (
                                                      <tr>
                                                        <td>Emergency Advance:</td>
                                                        <td className="text-end">{formatCurrency(payroll.emergency_advance)}</td>
                                                      </tr>
                                                    )}
                                                    {(payroll.other_deductions || 0) > 0 && (
                                                      <tr>
                                                        <td>Other Deductions:</td>
                                                        <td className="text-end">{formatCurrency(payroll.other_deductions)}</td>
                                                      </tr>
                                                    )}
                                                  </tbody>
                                                  <tfoot className="table-group-divider">
                                                    <tr>
                                                      <th>Total Deductions:</th>
                                                      <th className="text-end text-danger">-{formatCurrency(breakdown.totalDeductions)}</th>
                                                    </tr>
                                                    <tr className="table-active">
                                                      <th className="fs-5 fw-bold">Net Pay:</th>
                                                      <th className="text-end fs-5" style={{ color: '#28a745' }}>
                                                        {formatCurrency(breakdown.netPay)}
                                                      </th>
                                                    </tr>
                                                  </tfoot>
                                                </table>
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="card-footer bg-white">
                <nav aria-label="Payroll pagination">
                  <ul className="pagination justify-content-center mb-0">
                    <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
                      <button className="page-link" onClick={() => setCurrentPage(currentPage - 1)}>
                        <i className="bi bi-chevron-left"></i>
                      </button>
                    </li>
                    
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter(page => page === 1 || page === totalPages || (page >= currentPage - 2 && page <= currentPage + 2))
                      .map((page, index, array) => {
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
                      <button className="page-link" onClick={() => setCurrentPage(currentPage + 1)}>
                        <i className="bi bi-chevron-right"></i>
                      </button>
                    </li>
                  </ul>
                </nav>
              </div>
            )}
          </>
        )}
      </div>

      {/* Edit Modal */}
      {isEditModalOpen && editingPayroll && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content">
              <div className="modal-header bg-primary text-white">
                <h5 className="modal-title">
                  <i className="bi bi-pencil-square me-2"></i>
                  Edit Payroll: {editingPayroll.employee_name}
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setIsEditModalOpen(false)}></button>
              </div>
              <div className="modal-body">
                <div className="row">
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Employee</label>
                    <input type="text" className="form-control" value={editingPayroll.employee_name} readOnly />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Week</label>
                    <input type="text" className="form-control" value={`${editingPayroll.week_start} to ${editingPayroll.week_end}`} readOnly />
                  </div>

                  <div className="col-12 mb-3">
                    <h6 className="border-bottom pb-2">Hours</h6>
                    <div className="row g-2">
                      <div className="col-md-2">
                        <label className="form-label small">Regular</label>
                        <input 
                          type="number" 
                          name="regular_hours" 
                          className="form-control form-control-sm" 
                          value={formData.regular_hours} 
                          onChange={handleInputChange} 
                          min="0"
                          step="0.5"
                        />
                      </div>
                      <div className="col-md-2">
                        <label className="form-label small">OT</label>
                        <input 
                          type="number" 
                          name="overtime_hours" 
                          className="form-control form-control-sm" 
                          value={formData.overtime_hours} 
                          onChange={handleInputChange} 
                          min="0"
                          step="0.5"
                        />
                      </div>
                      <div className="col-md-2">
                        <label className="form-label small">Sunday</label>
                        <input 
                          type="number" 
                          name="sunday_hours" 
                          className="form-control form-control-sm" 
                          value={formData.sunday_hours} 
                          onChange={handleInputChange} 
                          min="0"
                          step="0.5"
                        />
                      </div>
                      <div className="col-md-2">
                        <label className="form-label small">Sunday OT</label>
                        <input 
                          type="number" 
                          name="sunday_overtime_hours" 
                          className="form-control form-control-sm" 
                          value={formData.sunday_overtime_hours || 0} 
                          onChange={handleInputChange} 
                          min="0"
                          step="0.5"
                        />
                      </div>
                      <div className="col-md-2">
                        <label className="form-label small">Holiday</label>
                        <input 
                          type="number" 
                          name="holiday_hours" 
                          className="form-control form-control-sm" 
                          value={formData.holiday_hours} 
                          onChange={handleInputChange} 
                          min="0"
                          step="0.5"
                        />
                      </div>
                      <div className="col-md-2">
                        <label className="form-label small">HOL OT</label>
                        <input 
                          type="number" 
                          name="holiday_overtime" 
                          className="form-control form-control-sm" 
                          value={formData.holiday_overtime} 
                          onChange={handleInputChange} 
                          min="0"
                          step="0.5"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="col-12 mb-3">
                    <h6 className="border-bottom pb-2">Rate Settings</h6>
                    <div className="row">
                      <div className="col-md-8">
                        <label className="form-label fw-bold">Hourly Rate (₱)</label>
                        <div className="input-group">
                          <span className="input-group-text">₱</span>
                          <input 
                            type="number" 
                            name="hourly_rate" 
                            className="form-control form-control-lg" 
                            value={formData.hourly_rate} 
                            onChange={handleInputChange} 
                            min="0"
                            step="1"
                            style={{ fontSize: '1.25rem' }}
                          />
                          <button 
                            className="btn btn-outline-secondary" 
                            type="button"
                            onClick={() => quickAdjustRate(-10)}
                            title="Decrease by ₱10"
                          >
                            <i className="bi bi-dash"></i>
                          </button>
                          <button 
                            className="btn btn-outline-secondary" 
                            type="button"
                            onClick={() => quickAdjustRate(10)}
                            title="Increase by ₱10"
                          >
                            <i className="bi bi-plus"></i>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="col-12 mb-3">
                    <h6 className="border-bottom pb-2">Deductions</h6>
                    
                    <div className="row g-2 mb-3">
                      <div className="col-md-3">
                        <label className="form-label small fw-semibold">SSS</label>
                        <div className="input-group input-group-sm">
                          <span className="input-group-text">₱</span>
                          <input 
                            type="number" 
                            name="sss" 
                            className="form-control" 
                            value={formData.sss} 
                            onChange={handleInputChange} 
                            min="0"
                            step="0.01"
                          />
                        </div>
                      </div>
                      <div className="col-md-3">
                        <label className="form-label small fw-semibold">SSS Loan</label>
                        <div className="input-group input-group-sm">
                          <span className="input-group-text">₱</span>
                          <input 
                            type="number" 
                            name="sss_loan" 
                            className="form-control" 
                            value={formData.sss_loan || 0} 
                            onChange={handleInputChange} 
                            min="0"
                            step="0.01"
                          />
                        </div>
                      </div>
                      <div className="col-md-3">
                        <label className="form-label small fw-semibold">PhilHealth</label>
                        <div className="input-group input-group-sm">
                          <span className="input-group-text">₱</span>
                          <input 
                            type="number" 
                            name="philhealth" 
                            className="form-control" 
                            value={formData.philhealth} 
                            onChange={handleInputChange} 
                            min="0"
                            step="0.01"
                          />
                        </div>
                      </div>
                      <div className="col-md-3">
                        <label className="form-label small fw-semibold">Pag-IBIG</label>
                        <div className="input-group input-group-sm">
                          <span className="input-group-text">₱</span>
                          <input 
                            type="number" 
                            name="pagibig" 
                            className="form-control" 
                            value={formData.pagibig} 
                            onChange={handleInputChange} 
                            min="0"
                            step="0.01"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="row g-2 mb-3">
                      <div className="col-md-3">
                        <label className="form-label small fw-semibold">Pag-IBIG Loan</label>
                        <div className="input-group input-group-sm">
                          <span className="input-group-text">₱</span>
                          <input 
                            type="number" 
                            name="pagibig_loan" 
                            className="form-control" 
                            value={formData.pagibig_loan || 0} 
                            onChange={handleInputChange} 
                            min="0"
                            step="0.01"
                          />
                        </div>
                      </div>
                      <div className="col-md-3">
                        <label className="form-label small fw-semibold">Withholding Tax</label>
                        <div className="input-group input-group-sm">
                          <span className="input-group-text">₱</span>
                          <input 
                            type="number" 
                            name="tax_withheld" 
                            className="form-control" 
                            value={formData.tax_withheld || 0} 
                            onChange={handleInputChange} 
                            min="0"
                            step="0.01"
                          />
                        </div>
                      </div>
                      <div className="col-md-3">
                        <label className="form-label small fw-semibold">Emergency Advance</label>
                        <div className="input-group input-group-sm">
                          <span className="input-group-text">₱</span>
                          <input 
                            type="number" 
                            name="emergency_advance" 
                            className="form-control" 
                            value={formData.emergency_advance} 
                            onChange={handleInputChange} 
                            min="0"
                            step="0.01"
                          />
                        </div>
                      </div>
                      <div className="col-md-3">
                        <label className="form-label small fw-semibold">Other Deductions</label>
                        <div className="input-group input-group-sm">
                          <span className="input-group-text">₱</span>
                          <input 
                            type="number" 
                            name="other_deductions" 
                            className="form-control" 
                            value={formData.other_deductions} 
                            onChange={handleInputChange} 
                            min="0"
                            step="0.01"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsEditModalOpen(false)}>Cancel</button>
                <button type="button" className="btn btn-primary" onClick={saveEditedPayroll}>
                  {rateModified ? 'Save Changes (Rate Modified)' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payslip Modal - Same as your existing code */}
      {isPayslipModalOpen && selectedPayslip && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
          <div className="modal-dialog" style={{ maxWidth: '1100px' }}>
            <div className="modal-content">
              <div className="modal-header bg-secondary text-white py-0" style={{ padding: '6px 12px' }}>
                <h5 className="modal-title" style={{ fontSize: '13px', fontWeight: 'normal' }}>
                  <i className="bi bi-receipt me-1"></i>
                  Payslip: {selectedPayslip.employee_name}
                </h5>
                <button type="button" className="btn-close btn-close-white btn-sm" onClick={() => setIsPayslipModalOpen(false)}></button>
              </div>
              
              <div className="modal-body p-2">
                <div ref={payslipRef} className="payslip-container" style={{ 
                  padding: '8px 10px', 
                  fontFamily: 'Courier New, monospace', 
                  fontSize: '9px',
                  backgroundColor: '#fff',
                  color: '#555',
                  lineHeight: '1.3'
                }}>
                  <div style={{ textAlign: 'center', marginBottom: '12px', borderBottom: '1px solid #ddd', paddingBottom: '8px' }}>
                    <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#333' }}>LN DISPLAY</div>
                    <div style={{ fontSize: '9px', color: '#666', marginTop: '4px' }}>
                      <i className="bi bi-telephone-fill" style={{ fontSize: '8px' }}></i> 09175902634 / 8-2914500
                    </div>
                    <div style={{ fontSize: '8px', color: '#888', marginTop: '2px' }}>
                      <i className="bi bi-geo-alt-fill" style={{ fontSize: '8px' }}></i> Block 4 Lot 6 Apple Ville Subdivision, Tullahan Road Sta. Quiteria, Caloocan City
                    </div>
                  </div>
                  
                  <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#333' }}>{selectedPayslip.employee_name}</div>
                    <div style={{ fontSize: '9px', color: '#888' }}>{formatDate(selectedPayslip.week_start)} - {formatDate(selectedPayslip.week_end)}</div>
                  </div>

                  {loadingAttendance ? (
                    <div style={{ textAlign: 'center', padding: '15px' }}>Loading attendance data...</div>
                  ) : (
                    (() => {
                      const breakdown = calculateBreakdown(selectedPayslip);
                      
                      const attendanceMap = new Map();
                      attendanceRecords.forEach(record => {
                        if (record.date) {
                          attendanceMap.set(record.date, record);
                        }
                      });
                      
                      const weekDates = [];
                      const startDate = new Date(selectedPayslip.week_start);
                      const endDate = new Date(selectedPayslip.week_end);

                      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
                        const dateStr = d.toISOString().split('T')[0];
                        const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
                        weekDates.push({ 
                          date: dateStr, 
                          dayName: dayNames[d.getDay()]
                        });
                      }
                      
                      const formatTime = (timeString) => {
                        if (!timeString) return '-';
                        if (timeString.includes('T')) {
                          return timeString.substring(11, 16);
                        }
                        return timeString.substring(0, 5);
                      };
                      
                      return (
                        <>
                          {/* Attendance Table with All Hour Types */}
                          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '8px', fontSize: '8px' }}>
                            <thead>
                              <tr style={{ backgroundColor: '#f5f5f5' }}>
                                <th style={{ border: '1px solid #ddd', padding: '3px', textAlign: 'center', width: '6%' }}>DAY</th>
                                <th style={{ border: '1px solid #ddd', padding: '3px', textAlign: 'center', width: '6%' }}>IN</th>
                                <th style={{ border: '1px solid #ddd', padding: '3px', textAlign: 'center', width: '6%' }}>OUT</th>
                                <th style={{ border: '1px solid #ddd', padding: '3px', textAlign: 'center', width: '6%' }}>REG</th>
                                <th style={{ border: '1px solid #ddd', padding: '3px', textAlign: 'center', width: '6%' }}>OT</th>
                                <th style={{ border: '1px solid #ddd', padding: '3px', textAlign: 'center', width: '6%' }}>SUN</th>
                                <th style={{ border: '1px solid #ddd', padding: '3px', textAlign: 'center', width: '6%' }}>SUN-OT</th>
                                <th style={{ border: '1px solid #ddd', padding: '3px', textAlign: 'center', width: '6%' }}>HOL</th>
                                <th style={{ border: '1px solid #ddd', padding: '3px', textAlign: 'center', width: '6%' }}>HOL-OT</th>
                                <th style={{ border: '1px solid #ddd', padding: '3px', textAlign: 'center', width: '6%', backgroundColor: '#fff3e0' }} title="Night Regular (after break deduction)"> NIGHT</th>
                                <th style={{ border: '1px solid #ddd', padding: '3px', textAlign: 'center', width: '6%', backgroundColor: '#fff3e0' }} title="Night Overtime"> N-OT</th>
                                <th style={{ border: '1px solid #ddd', padding: '3px', textAlign: 'center', width: '6%', backgroundColor: '#ffe6cc' }} title="Sunday Night Regular"> SUN-N</th>
                                <th style={{ border: '1px solid #ddd', padding: '3px', textAlign: 'center', width: '6%', backgroundColor: '#ffe6cc' }} title="Sunday Night Overtime">SUN-NOT</th>
                                <th style={{ border: '1px solid #ddd', padding: '3px', textAlign: 'center', width: '6%', backgroundColor: '#d1e7dd' }}>TOTAL</th>
                              </tr>
                            </thead>
                            <tbody>
                              {weekDates.map(({ date, dayName }) => {
                                const attendance = attendanceMap.get(date);
                                const isHoliday = attendance?.isHoliday || false;
                                const holidayType = attendance?.holidayType || 'regular';
                                
                                const regValue = attendance?.regular_hours > 0 ? attendance.regular_hours.toFixed(1) : ' ';
                                const otValue = attendance?.overtime_hours > 0 ? attendance.overtime_hours.toFixed(1) : ' ';
                                const sunValue = attendance?.sunday_hours > 0 ? attendance.sunday_hours.toFixed(1) : ' ';
                                const sunOtValue = attendance?.sunday_overtime_hours > 0 ? attendance.sunday_overtime_hours.toFixed(1) : ' ';
                                const holValue = attendance?.holiday_hours > 0 ? attendance.holiday_hours.toFixed(1) : ' ';
                                const holOtValue = attendance?.holiday_overtime_hours > 0 ? attendance.holiday_overtime_hours.toFixed(1) : ' ';
                                const nightValue = attendance?.night_hours > 0 ? attendance.night_hours.toFixed(1) : ' ';
                                const nightOtValue = attendance?.night_overtime_hours > 0 ? attendance.night_overtime_hours.toFixed(1) : ' ';
                                const sundayNightValue = attendance?.sunday_night_hours > 0 ? attendance.sunday_night_hours.toFixed(1) : ' ';
                                const sundayNightOtValue = attendance?.sunday_night_overtime_hours > 0 ? attendance.sunday_night_overtime_hours.toFixed(1) : ' ';
                                const totalValue = attendance?.total_hours > 0 ? attendance.total_hours.toFixed(1) : '0';
                                
                                let rowBgColor = 'transparent';
                                let holidayIcon = '';
                                if (isHoliday) {
                                  rowBgColor = '#ffffff';
                                  holidayIcon = holidayType === 'regular' ? '(RH)' : '(SW)';
                                } else if (dayName === 'SUN') {
                                  rowBgColor = '#ffffff';
                                }
                                
                                const hadNightBreak = attendance?.night_break_deducted > 0;
                                
                                return (
                                  <tr key={date} style={{ backgroundColor: rowBgColor }}>
                                    <td style={{ border: '1px solid #ddd', padding: '3px', textAlign: 'center', fontWeight: isHoliday ? 'bold' : 'normal' }}>
                                      {dayName} {holidayIcon}
                                    </td>
                                    <td style={{ border: '1px solid #ddd', padding: '3px', textAlign: 'center' }}>
                                      {attendance?.time_in || '-'}
                                    </td>
                                    <td style={{ border: '1px solid #ddd', padding: '3px', textAlign: 'center' }}>
                                      {attendance?.time_out || '-'}
                                    </td>
                                    <td style={{ border: '1px solid #ddd', padding: '3px', textAlign: 'center' }}>{regValue}</td>
                                    <td style={{ border: '1px solid #ddd', padding: '3px', textAlign: 'center' }}>{otValue}</td>
                                    <td style={{ border: '1px solid #ddd', padding: '3px', textAlign: 'center' }}>{sunValue}</td>
                                    <td style={{ border: '1px solid #ddd', padding: '3px', textAlign: 'center' }}>{sunOtValue}</td>
                                    <td style={{ border: '1px solid #ddd', padding: '3px', textAlign: 'center', fontWeight: isHoliday ? 'bold' : 'normal' }}>
                                      {holValue}
                                    </td>
                                    <td style={{ border: '1px solid #ddd', padding: '3px', textAlign: 'center' }}>{holOtValue}</td>
                                    <td style={{ border: '1px solid #ddd', padding: '3px', textAlign: 'center', backgroundColor: '#fff3e0' }} title={hadNightBreak ? `Night break deducted: ${attendance.night_break_deducted.toFixed(1)}h` : "Night shift hours"}>
                                      {nightValue}
                                    </td>
                                    <td style={{ border: '1px solid #ddd', padding: '3px', textAlign: 'center', backgroundColor: '#fff3e0' }}>
                                      {nightOtValue}
                                    </td>
                                    <td style={{ border: '1px solid #ddd', padding: '3px', textAlign: 'center', backgroundColor: '#ffe6cc' }}>
                                      {sundayNightValue}
                                    </td>
                                    <td style={{ border: '1px solid #ddd', padding: '3px', textAlign: 'center', backgroundColor: '#ffe6cc' }}>
                                      {sundayNightOtValue}
                                    </td>
                                    <td style={{ border: '1px solid #ddd', padding: '3px', textAlign: 'center', fontWeight: 'bold', backgroundColor: '#d1e7dd' }}>
                                      {totalValue}
                                    </td>
                                  </tr>
                                );
                              })}
                              
                              {/* Weekly Total Row */}
                              <tr style={{ backgroundColor: '#e9ecef', fontWeight: 'bold' }}>
                                <td colSpan="3" style={{ border: '1px solid #ddd', padding: '3px', textAlign: 'right' }}>WEEKLY TOTAL:</td>
                                <td style={{ border: '1px solid #ddd', padding: '3px', textAlign: 'center' }}>{breakdown.regularHours.toFixed(1)}</td>
                                <td style={{ border: '1px solid #ddd', padding: '3px', textAlign: 'center' }}>{breakdown.overtimeHours.toFixed(1)}</td>
                                <td style={{ border: '1px solid #ddd', padding: '3px', textAlign: 'center' }}>{breakdown.sundayHours.toFixed(1)}</td>
                                <td style={{ border: '1px solid #ddd', padding: '3px', textAlign: 'center' }}>{breakdown.sundayOvertimeHours.toFixed(1)}</td>
                                <td style={{ border: '1px solid #ddd', padding: '3px', textAlign: 'center', backgroundColor: '#fff3e0' }}>{breakdown.holidayHours.toFixed(1)}</td>
                                <td style={{ border: '1px solid #ddd', padding: '3px', textAlign: 'center' }}>{breakdown.holidayOvertimeHours.toFixed(1)}</td>
                                <td style={{ border: '1px solid #ddd', padding: '3px', textAlign: 'center', backgroundColor: '#fff3e0' }}>
                                  {breakdown.nightHours.toFixed(1)}
                                </td>
                                <td style={{ border: '1px solid #ddd', padding: '3px', textAlign: 'center', backgroundColor: '#fff3e0' }}>
                                  {breakdown.nightOvertimeHours.toFixed(1)}
                                </td>
                                <td style={{ border: '1px solid #ddd', padding: '3px', textAlign: 'center', backgroundColor: '#ffe6cc' }}>
                                  {breakdown.sundayNightHours.toFixed(1)}
                                </td>
                                <td style={{ border: '1px solid #ddd', padding: '3px', textAlign: 'center', backgroundColor: '#ffe6cc' }}>
                                  {breakdown.sundayNightOvertimeHours.toFixed(1)}
                                </td>
                                <td style={{ border: '1px solid #ddd', padding: '3px', textAlign: 'center', fontWeight: 'bold', backgroundColor: '#d1e7dd' }}>
                                  {breakdown.totalHours.toFixed(1)}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                          
                          {/* Earnings and Deductions Section */}
                          <div style={{ display: 'flex', gap: '10px', marginBottom: '8px' }}>
                            <table style={{ width: '50%', borderCollapse: 'collapse', fontSize: '8px' }}>
                              <tbody>
                                <tr><td style={{ border: '1px solid #ddd', padding: '3px' }}>REGULAR</td><td style={{ border: '1px solid #ddd', padding: '3px', textAlign: 'right' }}>{formatCurrency(breakdown.regularPay)}</td></tr>
                                {breakdown.overtimeHours > 0 && <tr><td style={{ border: '1px solid #ddd', padding: '3px' }}>OVERTIME ({breakdown.otRate}x)</td><td style={{ border: '1px solid #ddd', padding: '3px', textAlign: 'right' }}>{formatCurrency(breakdown.overtimePay)}</td></tr>}
                                {breakdown.sundayHours > 0 && <tr><td style={{ border: '1px solid #ddd', padding: '3px' }}>SUNDAY ({breakdown.sundayRate}x)</td><td style={{ border: '1px solid #ddd', padding: '3px', textAlign: 'right' }}>{formatCurrency(breakdown.sundayPay)}</td></tr>}
                                {breakdown.sundayOvertimeHours > 0 && <tr><td style={{ border: '1px solid #ddd', padding: '3px' }}>SUNDAY OT ({breakdown.sundayRate}x × {breakdown.otRate}x)</td><td style={{ border: '1px solid #ddd', padding: '3px', textAlign: 'right' }}>{formatCurrency(breakdown.sundayOvertimePay)}</td></tr>}
                                {breakdown.holidayHours > 0 && <tr><td style={{ border: '1px solid #ddd', padding: '3px' }}>HOLIDAY ({breakdown.holidayRate}x)</td><td style={{ border: '1px solid #ddd', padding: '3px', textAlign: 'right' }}>{formatCurrency(breakdown.holidayPay)}</td></tr>}
                                {breakdown.holidayOvertimeHours > 0 && <tr><td style={{ border: '1px solid #ddd', padding: '3px' }}>HOLIDAY OT ({breakdown.holidayRate}x × {breakdown.otRate}x)</td><td style={{ border: '1px solid #ddd', padding: '3px', textAlign: 'right' }}>{formatCurrency(breakdown.holidayOvertimePay)}</td></tr>}
                                {breakdown.nightHours > 0 && <tr><td style={{ border: '1px solid #ddd', padding: '3px', backgroundColor: '#fff3e0' }}> NIGHT (+{(breakdown.nightShiftRate * 100).toFixed(0)}%) <span style={{ fontSize: '6px' }}>(after break)</span></td><td style={{ border: '1px solid #ddd', padding: '3px', textAlign: 'right', backgroundColor: '#fff3e0' }}>{formatCurrency(breakdown.nightPay)}</td></tr>}
                                {breakdown.nightOvertimeHours > 0 && <tr><td style={{ border: '1px solid #ddd', padding: '3px', backgroundColor: '#fff3e0' }}> NIGHT OT ({breakdown.otRate}x +{(breakdown.nightShiftRate * 100).toFixed(0)}%)</td><td style={{ border: '1px solid #ddd', padding: '3px', textAlign: 'right', backgroundColor: '#fff3e0' }}>{formatCurrency(breakdown.nightOvertimePay)}</td></tr>}
                                {breakdown.sundayNightHours > 0 && <tr><td style={{ border: '1px solid #ddd', padding: '3px', backgroundColor: '#ffe6cc' }}> SUNDAY NIGHT ({breakdown.sundayRate}x +{(breakdown.nightShiftRate * 100).toFixed(0)}%)</td><td style={{ border: '1px solid #ddd', padding: '3px', textAlign: 'right', backgroundColor: '#ffe6cc' }}>{formatCurrency(breakdown.sundayNightPay)}</td></tr>}
                                {breakdown.sundayNightOvertimeHours > 0 && <tr><td style={{ border: '1px solid #ddd', padding: '3px', backgroundColor: '#ffe6cc' }}> SUN NIGHT OT ({breakdown.sundayRate}x × {breakdown.otRate}x +{(breakdown.nightShiftRate * 100).toFixed(0)}%)</td><td style={{ border: '1px solid #ddd', padding: '3px', textAlign: 'right', backgroundColor: '#ffe6cc' }}>{formatCurrency(breakdown.sundayNightOvertimePay)}</td></tr>}
                                <tr style={{ backgroundColor: '#f5f5f5' }}><td style={{ border: '1px solid #ddd', padding: '3px', fontWeight: 'bold' }}>GROSS</td><td style={{ border: '1px solid #ddd', padding: '3px', textAlign: 'right', fontWeight: 'bold' }}>{formatCurrency(breakdown.grossPay)}</td></tr>
                              </tbody>
                            </table>

                            <table style={{ width: '50%', borderCollapse: 'collapse', fontSize: '8px' }}>
                              <tbody>
                                {(selectedPayslip.sss || 0) > 0 && <tr><td style={{ border: '1px solid #ddd', padding: '3px' }}>SSS</td><td style={{ border: '1px solid #ddd', padding: '3px', textAlign: 'right' }}>{formatCurrency(selectedPayslip.sss)}</td></tr>}
                                {(selectedPayslip.sss_loan || 0) > 0 && <tr><td style={{ border: '1px solid #ddd', padding: '3px' }}>SSS LOAN</td><td style={{ border: '1px solid #ddd', padding: '3px', textAlign: 'right' }}>{formatCurrency(selectedPayslip.sss_loan)}</td></tr>}
                                {(selectedPayslip.philhealth || 0) > 0 && <tr><td style={{ border: '1px solid #ddd', padding: '3px' }}>PHILHEALTH</td><td style={{ border: '1px solid #ddd', padding: '3px', textAlign: 'right' }}>{formatCurrency(selectedPayslip.philhealth)}</td></tr>}
                                {(selectedPayslip.pagibig || 0) > 0 && <tr><td style={{ border: '1px solid #ddd', padding: '3px' }}>PAG-IBIG</td><td style={{ border: '1px solid #ddd', padding: '3px', textAlign: 'right' }}>{formatCurrency(selectedPayslip.pagibig)}</td></tr>}
                                {(selectedPayslip.pagibig_loan || 0) > 0 && <tr><td style={{ border: '1px solid #ddd', padding: '3px' }}>PAG-IBIG LOAN</td><td style={{ border: '1px solid #ddd', padding: '3px', textAlign: 'right' }}>{formatCurrency(selectedPayslip.pagibig_loan)}</td></tr>}
                                {(selectedPayslip.tax_withheld || 0) > 0 && <tr><td style={{ border: '1px solid #ddd', padding: '3px' }}>WITHHOLDING TAX</td><td style={{ border: '1px solid #ddd', padding: '3px', textAlign: 'right' }}>{formatCurrency(selectedPayslip.tax_withheld)}</td></tr>}
                                {(selectedPayslip.emergency_advance || 0) > 0 && <tr><td style={{ border: '1px solid #ddd', padding: '3px' }}>EMERGENCY ADVANCE</td><td style={{ border: '1px solid #ddd', padding: '3px', textAlign: 'right' }}>{formatCurrency(selectedPayslip.emergency_advance)}</td></tr>}
                                {(selectedPayslip.other_deductions || 0) > 0 && <tr><td style={{ border: '1px solid #ddd', padding: '3px' }}>OTHER DEDUCTIONS</td><td style={{ border: '1px solid #ddd', padding: '3px', textAlign: 'right' }}>{formatCurrency(selectedPayslip.other_deductions)}</td></tr>}
                                <tr style={{ backgroundColor: '#f5f5f5' }}><td style={{ border: '1px solid #ddd', padding: '3px', fontWeight: 'bold' }}>TOTAL DED.</td><td style={{ border: '1px solid #ddd', padding: '3px', textAlign: 'right', fontWeight: 'bold' }}>{formatCurrency(breakdown.totalDeductions)}</td></tr>
                              </tbody>
                            </table>
                          </div>

                          <div style={{ border: '1px solid #ddd', padding: '6px', textAlign: 'center', backgroundColor: '#f5f5f5', fontSize: '10px', fontWeight: 'bold' }}>
                            NET PAY: {formatCurrency(breakdown.netPay)}
                          </div>
                          
                          {(() => {
                            const hasNightBreaks = attendanceRecords.some(record => record.night_break_deducted > 0);
                            if (hasNightBreaks) {
                              return (
                                <div style={{ marginTop: '6px', padding: '4px', borderTop: '1px dashed #ddd', fontSize: '6px', color: '#888', textAlign: 'center' }}>
                                  * Night shift hours shown are after deducting unpaid night shift breaks per company policy
                                </div>
                              );
                            }
                            return null;
                          })()}
                        </>
                      );
                    })()
                  )}
                </div>
              </div>
              
              <div className="modal-footer py-1" style={{ padding: '6px' }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIsPayslipModalOpen(false)}>Close</button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={printPayslip}>Print</button>
              </div>
            </div>
          </div>
        </div>
      )}
      
{/* Settings Modal - Fixed scrolling and button visibility */}
{isSettingsModalOpen && editingSettings && (
  <div style={overlay}>
    <div style={{ 
      ...modal, 
      width: '1000px', 
      maxWidth: '90vw',
      height: '90vh',
      maxHeight: '90vh',
      padding: '0',
      borderRadius: '12px',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Modal Header - Fixed */}
      <div style={{ 
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '20px 24px',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h3 style={{ 
              margin: 0, 
              fontSize: '1.5rem', 
              fontWeight: '600', 
              color: '#fff'
            }}>
              <i className="bi bi-sliders2 me-2"></i>
              Rate & Holiday Pay Settings
            </h3>
            <p style={{ 
              margin: '8px 0 0 0', 
              fontSize: '0.875rem', 
              color: 'rgba(255,255,255,0.8)'
            }}>
              Configure payroll calculation rates and holiday pay rules
            </p>
          </div>
          <button 
            onClick={() => setIsSettingsModalOpen(false)}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '28px',
              cursor: 'pointer',
              color: '#fff',
              padding: '0',
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '8px',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(255,255,255,0.1)'}
            onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
          >
            ×
          </button>
        </div>
      </div>
      
      {/* Modal Body - Scrollable */}
      <div style={{ 
        padding: '24px', 
        overflowY: 'auto',
        flex: 1,
        minHeight: 0
      }}>
        {/* Alert Banner */}
        <div style={{ 
          background: '#e3f2fd', 
          padding: '14px 18px', 
          borderRadius: '10px', 
          marginBottom: '24px',
          borderLeft: '4px solid #1976d2'
        }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <i className="bi bi-info-circle-fill" style={{ fontSize: '1.1rem', color: '#1976d2', marginRight: '12px' }}></i>
            <div style={{ fontSize: '0.85rem' }}>
              <strong>Note:</strong> These rates affect all payroll calculations. Changes will be applied to future payroll generations.
            </div>
          </div>
        </div>
        
        {/* Standard Work Hours Card */}
        <div style={{ 
          background: '#fff', 
          borderRadius: '10px', 
          border: '1px solid #e0e0e0',
          marginBottom: '24px',
          padding: '16px 20px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h6 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '600' }}>
                <i className="bi bi-clock-history me-2" style={{ color: '#667eea' }}></i>
                Standard Work Hours
              </h6>
              <small style={{ color: '#6c757d', fontSize: '0.7rem' }}>Base working hours per day before overtime</small>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input
                type="number"
                name="standard_work_hours"
                value={editingSettings.standard_work_hours || 8}
                onChange={handleSettingsChange}
                min="1"
                max="24"
                step="0.5"
                style={{ 
                  width: '100px', 
                  padding: '8px 12px',
                  fontSize: '0.9rem',
                  textAlign: 'center',
                  border: '1px solid #ddd',
                  borderRadius: '6px'
                }}
              />
              <span style={{ color: '#6c757d', fontSize: '0.85rem' }}>hours/day</span>
            </div>
          </div>
        </div>

        {/* Rate Settings - 3 Column Grid */}
        <h6 style={{ 
          fontSize: '0.95rem', 
          fontWeight: '600', 
          marginBottom: '12px'
        }}>
          <i className="bi bi-calculator me-2"></i>
          Premium & Differential Rates
        </h6>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(3, 1fr)', 
          gap: '16px',
          marginBottom: '24px'
        }}>
          {/* Overtime Card */}
          <div style={{ 
            background: '#fff', 
            borderRadius: '10px', 
            border: '1px solid #e0e0e0',
            padding: '14px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div>
                <i className="bi bi-lightning-charge" style={{ color: '#ffc107', marginRight: '6px', fontSize: '0.9rem' }}></i>
                <span style={{ fontWeight: '600', fontSize: '0.85rem' }}>Overtime</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <input
                  type="number"
                  name="overtime_rate"
                  value={editingSettings.overtime_rate || 1.25}
                  onChange={handleSettingsChange}
                  min="1"
                  max="3"
                  step="0.05"
                  style={{ 
                    width: '70px', 
                    padding: '6px',
                    textAlign: 'center',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '0.85rem'
                  }}
                />
                <span style={{ fontSize: '0.85rem' }}>x</span>
              </div>
            </div>
            <small style={{ color: '#6c757d', fontSize: '0.7rem' }}>Regular overtime hours</small>
          </div>

          {/* Sunday Rate Card */}
          <div style={{ 
            background: '#fff', 
            borderRadius: '10px', 
            border: '1px solid #e0e0e0',
            padding: '14px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div>
                <i className="bi bi-sun" style={{ color: '#0dcaf0', marginRight: '6px', fontSize: '0.9rem' }}></i>
                <span style={{ fontWeight: '600', fontSize: '0.85rem' }}>Sunday</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <input
                  type="number"
                  name="sunday_rate"
                  value={editingSettings.sunday_rate || 1.30}
                  onChange={handleSettingsChange}
                  min="1"
                  max="3"
                  step="0.05"
                  style={{ 
                    width: '70px', 
                    padding: '6px',
                    textAlign: 'center',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '0.85rem'
                  }}
                />
                <span style={{ fontSize: '0.85rem' }}>x</span>
              </div>
            </div>
            <small style={{ color: '#6c757d', fontSize: '0.7rem' }}>Sunday work premium</small>
          </div>

          {/* Night Differential Card */}
          <div style={{ 
            background: '#fff', 
            borderRadius: '10px', 
            border: '1px solid #e0e0e0',
            padding: '14px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div>
                <i className="bi bi-moon-stars" style={{ color: '#6c757d', marginRight: '6px', fontSize: '0.9rem' }}></i>
                <span style={{ fontWeight: '600', fontSize: '0.85rem' }}>Night Diff</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <input
                  type="number"
                  name="night_shift_differential"
                  value={editingSettings.night_shift_differential || 0.10}
                  onChange={handleSettingsChange}
                  min="0"
                  max="1"
                  step="0.01"
                  style={{ 
                    width: '70px', 
                    padding: '6px',
                    textAlign: 'center',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '0.85rem'
                  }}
                />
                <span style={{ fontSize: '0.85rem' }}>%</span>
              </div>
            </div>
            <small style={{ color: '#6c757d', fontSize: '0.7rem' }}>
              {((editingSettings.night_shift_differential || 0.10) * 100).toFixed(0)}% extra
            </small>
          </div>
        </div>

        {/* Holiday Overtime Rate Card */}
        <div style={{ 
          background: '#fff', 
          borderRadius: '10px', 
          border: '1px solid #e0e0e0',
          marginBottom: '24px',
          padding: '14px 18px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <i className="bi bi-calendar2-plus" style={{ color: '#dc3545', marginRight: '6px' }}></i>
              <span style={{ fontWeight: '600', fontSize: '0.85rem' }}>Holiday Overtime Rate</span>
              <div><small style={{ color: '#6c757d', fontSize: '0.7rem' }}>Regular Holiday and Special Non-Working OT</small></div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="number"
                name="holiday_overtime_rate"
                value={editingSettings.holiday_overtime_rate || 1.5}
                onChange={handleSettingsChange}
                min="1"
                max="3"
                step="0.05"
                style={{ 
                  width: '90px', 
                  padding: '8px',
                  textAlign: 'center',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  fontSize: '0.9rem'
                }}
              />
              <span style={{ fontSize: '0.85rem' }}>x</span>
            </div>
          </div>
        </div>

        {/* Holiday Pay Configuration Section */}
        <div style={{ marginBottom: '20px' }}>
          <h6 style={{ fontSize: '0.95rem', fontWeight: '600', marginBottom: '12px' }}>
            <i className="bi bi-calendar-heart me-2" style={{ color: '#dc3545' }}></i>
            Holiday Pay Configuration
          </h6>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
            {/* Regular Holiday Card */}
            <div style={{ 
              background: editingSettings.regular_holiday_paid ? '#fff5f5' : '#fff',
              borderRadius: '10px', 
              border: editingSettings.regular_holiday_paid ? '2px solid #dc3545' : '1px solid #e0e0e0',
              padding: '14px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div>
                  <i className="bi bi-calendar2-heart" style={{ color: '#dc3545', fontSize: '0.9rem', marginRight: '6px' }}></i>
                  <span style={{ fontWeight: '600', fontSize: '0.85rem' }}>Regular Holidays</span>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    name="regular_holiday_paid"
                    checked={editingSettings.regular_holiday_paid ?? true}
                    onChange={(e) => setEditingSettings(prev => ({
                      ...prev,
                      regular_holiday_paid: e.target.checked
                    }))}
                    style={{ width: '40px', height: '20px', cursor: 'pointer' }}
                  />
                </label>
              </div>
              <div style={{ marginBottom: '12px' }}>
                <span style={{ 
                  display: 'inline-block',
                  padding: '3px 10px',
                  background: editingSettings.regular_holiday_paid ? '#28a745' : '#6c757d',
                  color: '#fff',
                  borderRadius: '20px',
                  fontSize: '0.7rem',
                  marginBottom: '6px'
                }}>
                  {editingSettings.regular_holiday_paid ? "✅ Paid" : "❌ Unpaid"}
                </span>
                <div style={{ fontSize: '0.7rem', color: '#6c757d', marginTop: '6px' }}>
                  {editingSettings.regular_holiday_paid
                    ? "Paid even if not working"
                    : "No work, No pay"}
                </div>
              </div>
              {editingSettings.regular_holiday_paid && (
                <div>
                  <label style={{ fontSize: '0.7rem', marginBottom: '6px', display: 'block' }}>Rate</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input
                      type="number"
                      name="regular_holiday_rate"
                      value={editingSettings.regular_holiday_rate ?? 2.0}
                      onChange={(e) => setEditingSettings(prev => ({
                        ...prev,
                        regular_holiday_rate: parseFloat(e.target.value) || 0
                      }))}
                      step="0.05"
                      min="1"
                      style={{ 
                        width: '80px', 
                        padding: '6px',
                        textAlign: 'center',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '0.8rem'
                      }}
                    />
                    <span style={{ fontSize: '0.8rem' }}>x</span>
                  </div>
                </div>
              )}
            </div>

            {/* Special Working Day Card */}
            <div style={{ 
              background: editingSettings.special_working_paid ? '#fff8f0' : '#fff',
              borderRadius: '10px', 
              border: editingSettings.special_working_paid ? '2px solid #fd7e14' : '1px solid #e0e0e0',
              padding: '14px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div>
                  <i className="bi bi-briefcase" style={{ color: '#fd7e14', fontSize: '0.9rem', marginRight: '6px' }}></i>
                  <span style={{ fontWeight: '600', fontSize: '0.85rem' }}>Special Working</span>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    name="special_working_paid"
                    checked={editingSettings.special_working_paid ?? true}
                    onChange={(e) => setEditingSettings(prev => ({
                      ...prev,
                      special_working_paid: e.target.checked
                    }))}
                    style={{ width: '40px', height: '20px', cursor: 'pointer' }}
                  />
                </label>
              </div>
              <div style={{ marginBottom: '12px' }}>
                <span style={{ 
                  display: 'inline-block',
                  padding: '3px 10px',
                  background: editingSettings.special_working_paid ? '#28a745' : '#6c757d',
                  color: '#fff',
                  borderRadius: '20px',
                  fontSize: '0.7rem',
                  marginBottom: '6px'
                }}>
                  {editingSettings.special_working_paid ? "✅ Paid" : "❌ Unpaid"}
                </span>
                <div style={{ fontSize: '0.7rem', color: '#6c757d', marginTop: '6px' }}>
                  {editingSettings.special_working_paid
                    ? "Paid even if not working"
                    : "No work, No pay"}
                </div>
              </div>
              {editingSettings.special_working_paid && (
                <div>
                  <label style={{ fontSize: '0.7rem', marginBottom: '6px', display: 'block' }}>Rate</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input
                      type="number"
                      name="special_working_rate"
                      value={editingSettings.special_working_rate ?? 1.0}
                      onChange={(e) => setEditingSettings(prev => ({
                        ...prev,
                        special_working_rate: parseFloat(e.target.value) || 0
                      }))}
                      step="0.05"
                      min="1"
                      style={{ 
                        width: '80px', 
                        padding: '6px',
                        textAlign: 'center',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '0.8rem'
                      }}
                    />
                    <span style={{ fontSize: '0.8rem' }}>x</span>
                  </div>
                </div>
              )}
            </div>

            {/* Special Non-Working Day Card */}
            <div style={{ 
              background: editingSettings.special_non_working_paid ? '#fffde7' : '#fff',
              borderRadius: '10px', 
              border: editingSettings.special_non_working_paid ? '2px solid #ffc107' : '1px solid #e0e0e0',
              padding: '14px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div>
                  <i className="bi bi-calendar-x" style={{ color: '#ffc107', fontSize: '0.9rem', marginRight: '6px' }}></i>
                  <span style={{ fontWeight: '600', fontSize: '0.85rem' }}>Special Non-Working</span>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    name="special_non_working_paid"
                    checked={editingSettings.special_non_working_paid ?? false}
                    onChange={(e) => setEditingSettings(prev => ({
                      ...prev,
                      special_non_working_paid: e.target.checked
                    }))}
                    style={{ width: '40px', height: '20px', cursor: 'pointer' }}
                  />
                </label>
              </div>
              <div style={{ marginBottom: '12px' }}>
                <span style={{ 
                  display: 'inline-block',
                  padding: '3px 10px',
                  background: editingSettings.special_non_working_paid ? '#28a745' : '#6c757d',
                  color: '#fff',
                  borderRadius: '20px',
                  fontSize: '0.7rem',
                  marginBottom: '6px'
                }}>
                  {editingSettings.special_non_working_paid ? "✅ Paid" : "❌ No work, no pay"}
                </span>
                <div style={{ fontSize: '0.7rem', color: '#6c757d', marginTop: '6px' }}>
                  {editingSettings.special_non_working_paid
                    ? "Paid even if not working"
                    : "No work, no pay"}
                </div>
              </div>
              {editingSettings.special_non_working_paid && (
                <div>
                  <label style={{ fontSize: '0.7rem', marginBottom: '6px', display: 'block' }}>Rate</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input
                      type="number"
                      name="special_non_working_rate"
                      value={editingSettings.special_non_working_rate ?? 1.3}
                      onChange={(e) => setEditingSettings(prev => ({
                        ...prev,
                        special_non_working_rate: parseFloat(e.target.value) || 0
                      }))}
                      step="0.05"
                      min="1"
                      style={{ 
                        width: '80px', 
                        padding: '6px',
                        textAlign: 'center',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '0.8rem'
                      }}
                    />
                    <span style={{ fontSize: '0.8rem' }}>x</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Summary Card */}
        <div style={{ 
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: '10px',
          padding: '14px'
        }}>
          <h6 style={{ color: '#fff', margin: '0 0 10px 0', textAlign: 'center', fontSize: '0.85rem' }}>
            <i className="bi bi-info-circle me-2"></i>
            Current Rate Settings Summary
          </h6>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(4, 1fr)', 
            gap: '8px',
            color: '#fff',
            fontSize: '0.75rem',
            textAlign: 'center'
          }}>
            <div>
              <div><strong>OT:</strong> {editingSettings.overtime_rate || 1.25}x</div>
              <div style={{ marginTop: '4px' }}><strong>Sunday:</strong> {editingSettings.sunday_rate || 1.30}x</div>
            </div>
            <div>
              <div><strong>Night Diff:</strong> {((editingSettings.night_shift_differential || 0.10) * 100).toFixed(0)}%</div>
              <div style={{ marginTop: '4px' }}><strong>Holiday OT:</strong> {editingSettings.holiday_overtime_rate || 1.5}x</div>
            </div>
            <div>
              <div>Regular: {editingSettings.regular_holiday_paid ? `${editingSettings.regular_holiday_rate || 2.0}x` : 'Unpaid'}</div>
              <div style={{ marginTop: '4px' }}>Spec Work: {editingSettings.special_working_paid ? `${editingSettings.special_working_rate || 1.0}x` : 'Unpaid'}</div>
            </div>
            <div>
              <div>Spec Non-Work: {editingSettings.special_non_working_paid ? `${editingSettings.special_non_working_rate || 1.3}x` : 'Unpaid'}</div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Modal Footer - Fixed at bottom */}
      <div style={{ 
        padding: '16px 24px', 
        borderTop: '1px solid #e0e0e0',
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '12px',
        background: '#fff',
        flexShrink: 0
      }}>
        <button 
          onClick={() => setIsSettingsModalOpen(false)}
          style={{
            padding: '8px 24px',
            background: '#f8f9fa',
            border: '1px solid #dee2e6',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '0.85rem',
            fontWeight: '500',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => e.target.style.background = '#e9ecef'}
          onMouseLeave={(e) => e.target.style.background = '#f8f9fa'}
        >
          Cancel
        </button>
        <button 
          onClick={saveSettings}
          style={{
            padding: '8px 28px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '0.85rem',
            fontWeight: '500',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => e.target.style.opacity = '0.9'}
          onMouseLeave={(e) => e.target.style.opacity = '1'}
        >
          <i className="bi bi-check-lg me-1"></i>
          Save All Settings
        </button>
      </div>
    </div>
  </div>
)}

      {/* BULK RATE EDITOR MODAL */}
      {isBulkRateModalOpen && (
        <div style={overlay}>
          <div style={{ ...modal, width: '1000px' }}>
            <h3 style={{ marginBottom: '20px', fontSize: '18px' }}>
              <i className="bi bi-people me-2"></i>
              Bulk Hourly Rate Editor
            </h3>

            {loadingEmployees ? (
              <div style={centerText}>Loading employees...</div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px', marginBottom: '20px' }}>
                  <div style={{ background: '#007bff', color: '#fff', padding: '15px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '13px', opacity: 0.9 }}>Total Employees</div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{employees.length}</div>
                  </div>
                  <div style={{ background: '#28a745', color: '#fff', padding: '15px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '13px', opacity: 0.9 }}>Selected</div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{Object.values(bulkRateForm).filter(d => d.selected).length}</div>
                  </div>
                  <div style={{ background: '#ffc107', color: '#fff', padding: '15px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '13px', opacity: 0.9 }}>To Update</div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{Object.values(bulkRateForm).filter(d => d.selected).length}</div>
                  </div>
                </div>

                {bulkValidationError && (
                  <div style={errorBox}>
                    <i className="bi bi-exclamation-triangle-fill me-2"></i>
                    {bulkValidationError}
                  </div>
                )}

                <div style={infoBox}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <button 
                        style={{ ...btnSuccess, marginRight: '10px' }}
                        onClick={handleSelectAll}
                      >
                        <i className="bi bi-check-all me-1"></i>
                        {selectAll ? 'Deselect All' : 'Select All'}
                      </button>
                      
                      <div style={{ display: 'inline-block', marginLeft: '10px' }}>
                        <select 
                          style={{ padding: '8px', border: '1px solid #ddd', borderRadius: 4, fontSize: '13px' }}
                          onChange={(e) => {
                            const rate = parseFloat(e.target.value);
                            if (rate) applySameRateToSelected(rate);
                          }}
                          value=""
                        >
                          <option value="" disabled>Set Rate for Selected</option>
                          <option value="86.87">₱86.87 (NCR Minimum)</option>
                          <option value="100">₱100</option>
                          <option value="125">₱125</option>
                          <option value="150">₱150</option>
                          <option value="200">₱200</option>
                        </select>
                      </div>
                    </div>
                    
                    <div>
                      <input
                        type="text"
                        placeholder="Search employees..."
                        value={bulkRateSearch}
                        onChange={(e) => setBulkRateSearch(e.target.value)}
                        style={{ ...searchInput, width: '250px' }}
                      />
                      <select 
                        style={{ ...searchInput, width: '120px', marginLeft: '10px' }}
                        value={bulkRateFilter}
                        onChange={(e) => setBulkRateFilter(e.target.value)}
                      >
                        <option value="all">All</option>
                        <option value="selected">Selected</option>
                        <option value="unselected">Unselected</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div style={{ maxHeight: '400px', overflowY: 'auto', border: '1px solid #eee', borderRadius: '4px', marginBottom: '20px' }}>
                  <table style={table}>
                    <thead style={{ position: 'sticky', top: 0, background: '#f8f9fa' }}>
                      <tr>
                        <th style={{ ...th, textAlign: 'center', width: '5%' }}>
                          <input type="checkbox" checked={selectAll} onChange={handleSelectAll} />
                        </th>
                        <th style={th}>Employee</th>
                        <th style={th}>Department</th>
                        <th style={th}>Role</th>
                        <th style={{ ...th, textAlign: 'center' }}>Current Rate</th>
                        <th style={th}>New Rate (₱)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getFilteredBulkEmployees().length === 0 ? (
                        <tr>
                          <td colSpan="6" style={centerText}>
                            No employees match your filters
                          </td>
                        </tr>
                      ) : (
                        getFilteredBulkEmployees().map(emp => (
                          <tr 
                            key={emp.employee_id} 
                            style={{ 
                              borderBottom: '1px solid #eee', 
                              background: bulkRateForm[emp.employee_id]?.selected ? '#e3f2fd' : 'transparent',
                              cursor: 'pointer'
                            }}
                            onClick={() => handleSelectEmployee(emp.employee_id)}
                          >
                            <td style={{ ...td, textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                              <input 
                                type="checkbox"
                                checked={bulkRateForm[emp.employee_id]?.selected || false}
                                onChange={() => handleSelectEmployee(emp.employee_id)}
                              />
                            </td>
                            <td style={td}>
                              <div style={{ fontWeight: '500' }}>{emp.name}</div>
                              <div style={{ fontSize: '11px', color: '#7f8c8d' }}>{emp.employee_id}</div>
                            </td>
                            <td style={td}>{emp.department || 'N/A'}</td>
                            <td style={td}>{emp.role}</td>
                            <td style={{ ...td, textAlign: 'center' }}>
                              <span style={{ background: '#6c757d', color: '#fff', padding: '3px 8px', borderRadius: '12px', fontSize: '12px' }}>
                                ₱{(() => {
                                  let originalRate = 86.87;
                                  
                                  if (emp.hourly_rate !== undefined && emp.hourly_rate !== null) {
                                    originalRate = typeof emp.hourly_rate === 'string' 
                                      ? parseFloat(emp.hourly_rate) 
                                      : emp.hourly_rate;
                                  } else if (emp.hourlyRate !== undefined && emp.hourlyRate !== null) {
                                    originalRate = typeof emp.hourlyRate === 'string' 
                                      ? parseFloat(emp.hourlyRate) 
                                      : emp.hourlyRate;
                                  } else {
                                    const payrollRecord = payrolls.find(p => p.employee_id === emp.employee_id);
                                    if (payrollRecord && payrollRecord.hourly_rate) {
                                      originalRate = payrollRecord.hourly_rate;
                                    }
                                  }
                                  
                                  return Number(originalRate).toFixed(2);
                                })()}
                              </span>
                            </td>
                            <td style={td} onClick={(e) => e.stopPropagation()}>
                              <div style={{ display: 'flex', alignItems: 'center' }}>
                                <span style={{ marginRight: '5px', fontSize: '14px', fontWeight: 'bold', color: '#007bff' }}>₱</span>
                                <input
                                  type="number"
                                  style={{ 
                                    ...input, 
                                    width: '100px',
                                    borderColor: bulkRateForm[emp.employee_id]?.selected ? '#007bff' : '#ddd',
                                    backgroundColor: bulkRateForm[emp.employee_id]?.selected ? '#fff' : '#f9f9f9'
                                  }}
                                  value={bulkRateForm[emp.employee_id]?.hourly_rate || 86.87}
                                  onChange={(e) => handleEmployeeRateChange(emp.employee_id, e.target.value)}
                                  min="0"
                                  step="1"
                                  disabled={!bulkRateForm[emp.employee_id]?.selected}
                                />
                                {bulkRateForm[emp.employee_id]?.selected && (
                                  <span style={{ marginLeft: '5px', color: '#28a745', fontSize: '12px' }}>
                                    <i className="bi bi-pencil-fill"></i>
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div style={infoBox}>
                  <i className="bi bi-info-circle me-2"></i>
                  <strong>Quick Tips:</strong> Select employees using checkboxes, then use the dropdown to set the same rate for all selected. You can also edit individual rates directly in the table.
                </div>
              </>
            )}
            
            <div style={{ display: 'flex', gap: 10, marginTop: '20px' }}>
              <button 
                type="button" 
                style={btnSecondary} 
                onClick={() => setIsBulkRateModalOpen(false)}
              >
                Cancel
              </button>
              <button 
                type="button" 
                style={btnPrimary} 
                onClick={applyBulkRateUpdate}
                disabled={loadingEmployees || Object.values(bulkRateForm).filter(d => d.selected).length === 0}
              >
                {loadingEmployees ? 'Updating...' : `Update Selected (${Object.values(bulkRateForm).filter(d => d.selected).length})`}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx="true">{`
        .hover-row:hover {
          background-color: rgba(0, 0, 0, 0.02) !important;
        }
        .rotate-90 {
          transform: rotate(90deg);
        }
        .transition-all {
          transition: transform 0.2s ease-in-out;
        }
        .table-group-divider {
          border-top: 2px solid #dee2e6;
        }
        @media print {
          .no-print {
            display: none !important;
          }
          .modal {
            position: relative !important;
            display: block !important;
          }
        }
      `}</style>
    </div>
  );
};

export default Adminsalary;
