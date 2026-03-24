import React, { createContext, useState, useContext, useEffect } from 'react';
import { getEmployeeViolations, createEmployeeViolation, deleteEmployeeViolation } from '../services/api';

const ViolationsContext = createContext();

export const useViolations = () => {
    const context = useContext(ViolationsContext);
    if (!context) {
        throw new Error('useViolations must be used within ViolationsProvider');
    }
    return context;
};

export const ViolationsProvider = ({ children }) => {
    const [violations, setViolations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Fetch violations
    const fetchViolations = async () => {
        try {
            setLoading(true);
            setError(null);
            console.log('Fetching violations from API...');
            
            const response = await getEmployeeViolations();
            console.log('API Response:', response.data);
            
            setViolations(response.data.data || []);
        } catch (err) {
            const errorMsg = err.response?.data?.message || err.message || 'Failed to fetch violations';
            setError(errorMsg);
            console.error('Error fetching violations:', err);
            
            // Fallback to empty array
            setViolations([]);
        } finally {
            setLoading(false);
        }
    };

    // Add violation
    const addViolation = async (violationData) => {
        try {
            console.log('Adding violation:', violationData);
            const response = await createEmployeeViolation(violationData);
            await fetchViolations(); // Refresh the list
            return response.data.data;
        } catch (err) {
            const errorMsg = err.response?.data?.message || err.message || 'Failed to add violation';
            throw new Error(errorMsg);
        }
    };

    // Delete violation
    const removeViolation = async (id) => {
        try {
            await deleteEmployeeViolation(id);
            await fetchViolations(); // Refresh the list
        } catch (err) {
            const errorMsg = err.response?.data?.message || err.message || 'Failed to delete violation';
            throw new Error(errorMsg);
        }
    };

    // Calculate dashboard stats
    const getStats = () => {
        return {
            total: violations.length,
            pending: violations.filter(v => v.status === 'Pending').length,
            underReview: violations.filter(v => v.status === 'Under Review').length,
            resolved: violations.filter(v => v.status === 'Resolved').length,
            low: violations.filter(v => v.severity === 'Low').length,
            medium: violations.filter(v => v.severity === 'Medium').length,
            high: violations.filter(v => v.severity === 'High').length,
            critical: violations.filter(v => v.severity === 'Critical').length
        };
    };

    // Fetch on component mount
    useEffect(() => {
        fetchViolations();
    }, []);

    const value = {
        violations,
        loading,
        error,
        fetchViolations,
        addViolation,
        removeViolation,
        getStats
    };

    return (
        <ViolationsContext.Provider value={value}>
            {children}
        </ViolationsContext.Provider>
    );
};