import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { attendanceSettingsAPI } from '../services/api';

const CompanySettingsContext = createContext();

export const useCompanySettings = () => {
  const context = useContext(CompanySettingsContext);
  if (!context) {
    throw new Error('useCompanySettings must be used within CompanySettingsProvider');
  }
  return context;
};

export const CompanySettingsProvider = ({ children }) => {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const response = await attendanceSettingsAPI.get();
      if (response.data.success) {
        setSettings(response.data.settings);
      } else {
        // Fallback defaults
        setSettings({
          work_days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
          standard_work_hours: 8,
          holiday_rate: 2.0,
          sunday_rate: 1.3,
          overtime_rate: 1.25,
          clock_in_start: '08:00',
          clock_in_end: '17:00'
        });
      }
    } catch (err) {
      console.error('Failed to fetch settings:', err);
      setSettings({
        work_days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        standard_work_hours: 8,
        holiday_rate: 2.0,
        sunday_rate: 1.3,
        overtime_rate: 1.25
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const getWorkDaysPerWeek = useCallback(() => {
    if (!settings?.work_days) return 5;
    return settings.work_days.length;
  }, [settings]);

  // DOLE Formula: Monthly Salary from Weekly Salary
  const calculateMonthlySalary = useCallback((weeklySalary, workDaysPerWeek = null) => {
    if (!weeklySalary || weeklySalary <= 0) return 0;
    
    const daysPerWeek = workDaysPerWeek || getWorkDaysPerWeek();
    const dailyRate = weeklySalary / daysPerWeek;
    
    // DOLE factor method
    if (daysPerWeek === 6) {
      return (dailyRate * 313) / 12;  // 313 days for 6-day work week
    } else {
      return (dailyRate * 261) / 12;  // 261 days for 5-day work week
    }
  }, [getWorkDaysPerWeek]);

  // Calculate Weekly Salary from Hourly Rate
  const calculateWeeklySalary = useCallback((hourlyRate, hoursPerDay = 8, workDaysPerWeek = null) => {
    const days = workDaysPerWeek || getWorkDaysPerWeek();
    return hourlyRate * hoursPerDay * days;
  }, [getWorkDaysPerWeek]);

  // Calculate Monthly Salary from Hourly Rate
  const calculateMonthlySalaryFromHourly = useCallback((hourlyRate, hoursPerDay = 8, workDaysPerWeek = null) => {
    const weekly = calculateWeeklySalary(hourlyRate, hoursPerDay, workDaysPerWeek);
    return calculateMonthlySalary(weekly, workDaysPerWeek);
  }, [calculateWeeklySalary, calculateMonthlySalary]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const value = {
    settings,
    loading,
    error,
    refreshSettings: fetchSettings,
    getWorkDaysPerWeek,
    calculateMonthlySalary,
    calculateWeeklySalary,
    calculateMonthlySalaryFromHourly,
    workDaysPerWeek: getWorkDaysPerWeek()
  };

  return (
    <CompanySettingsContext.Provider value={value}>
      {children}
    </CompanySettingsContext.Provider>
  );
};
