// src/components/ArchivedLogs.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  getArchivedActivities,
  restoreArchivedActivity,
  restoreMultipleArchived,
  permanentlyDeleteArchived,
  permanentlyDeleteMultipleArchived,
  searchArchivedActivities,
  getArchivedStats,
  exportArchivedToCSV,
  exportArchivedToJSON,
  clearAllArchived
} from '../utils/archivedLogger';

const ArchivedLogs = ({ isOpen, onClose, onRestore }) => {
  const [archivedActivities, setArchivedActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    total: 0,
    totalPages: 1,
    hasMore: true
  });
  const [filter, setFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('date');
  const [sortDirection, setSortDirection] = useState('desc');
  const [selectedActivities, setSelectedActivities] = useState(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [stats, setStats] = useState(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);
  const searchInputRef = useRef(null);
  const observerRef = useRef(null);
  const mountedRef = useRef(true);

  // Available categories
  const getCategories = useCallback(() => {
    return ['all', 'create', 'update', 'delete', 'maintenance', 'auth', 'other'];
  }, []);

  const getCategoryDisplayName = useCallback((category) => {
    const names = {
      all: 'All Categories',
      create: 'Create Actions',
      update: 'Update Actions',
      delete: 'Delete Actions',
      maintenance: 'Maintenance',
      auth: 'Authentication',
      other: 'Other'
    };
    return names[category] || category;
  }, []);

  const getCategoryColor = useCallback((category) => {
    const colors = {
      create: { bg: '#e6f7f0', text: '#10b981', border: '#10b981' },
      update: { bg: '#f3e8ff', text: '#8b5cf6', border: '#8b5cf6' },
      delete: { bg: '#fee8e8', text: '#ef4444', border: '#ef4444' },
      maintenance: { bg: '#e8e8e8', text: '#64748b', border: '#64748b' },
      auth: { bg: '#fff3e0', text: '#f97316', border: '#f97316' },
      other: { bg: '#f1f5f9', text: '#475569', border: '#475569' }
    };
    return colors[category] || colors.other;
  }, []);

// In ArchivedLogs.jsx, update the loadArchivedActivities function
const loadArchivedActivities = useCallback(async (page = 1, reset = false) => {
  if (!mountedRef.current) return;
  
  try {
    if (page === 1) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    setError(null);

    const filters = {
      category: categoryFilter !== 'all' ? categoryFilter : undefined,
      search: searchTerm || undefined
    };

    if (filter === 'today') {
      const now = new Date();
      filters.startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    } else if (filter === 'week') {
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      filters.startDate = weekAgo.toISOString();
    } else if (filter === 'month') {
      const now = new Date();
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      filters.startDate = monthAgo.toISOString();
    }

    const result = await getArchivedActivities(page, 20, filters);
    
    if (!mountedRef.current) return;
    
    // Sort activities
    let sortedActivities = [...result.activities];
    switch(sortBy) {
      case 'category':
        sortedActivities.sort((a, b) => {
          const categoryCompare = (a.category || '').localeCompare(b.category || '');
          if (categoryCompare !== 0) {
            return sortDirection === 'asc' ? categoryCompare : -categoryCompare;
          }
          return new Date(b.timestamp) - new Date(a.timestamp);
        });
        break;
      case 'user':
        sortedActivities.sort((a, b) => {
          const userCompare = (a.user || '').localeCompare(b.user || '');
          if (userCompare !== 0) {
            return sortDirection === 'asc' ? userCompare : -userCompare;
          }
          return new Date(b.timestamp) - new Date(a.timestamp);
        });
        break;
      default:
        sortedActivities.sort((a, b) => {
          const dateA = new Date(a.timestamp);
          const dateB = new Date(b.timestamp);
          return sortDirection === 'desc' ? dateB - dateA : dateA - dateB;
        });
    }

    // Deduplicate activities by ID
    const uniqueActivities = [];
    const seenIds = new Set();
    
    for (const activity of sortedActivities) {
      if (!seenIds.has(activity.id)) {
        seenIds.add(activity.id);
        uniqueActivities.push(activity);
      }
    }

    setArchivedActivities(prev => reset ? uniqueActivities : [...prev, ...uniqueActivities]);
    setPagination({
      page: result.page,
      total: result.total,
      totalPages: result.totalPages,
      hasMore: result.hasMore !== false && result.page < result.totalPages
    });
  } catch (error) {
    console.error('Error loading archived activities:', error);
    if (mountedRef.current) {
      setError('Failed to load archived activities. Please try again.');
    }
  } finally {
    if (mountedRef.current) {
      setLoading(false);
      setLoadingMore(false);
    }
  }
}, [categoryFilter, filter, searchTerm, sortBy, sortDirection]);

  // Load stats
  const loadStats = useCallback(async () => {
    if (!mountedRef.current) return;
    
    try {
      const statsData = await getArchivedStats();
      if (mountedRef.current) {
        setStats(statsData);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  }, []);

  // Handle search
  const handleSearch = useCallback(async (e) => {
    if (e) e.preventDefault();
    
    if (!searchTerm.trim()) {
      loadArchivedActivities(1, true);
      return;
    }
    
    if (!mountedRef.current) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const results = await searchArchivedActivities(searchTerm);
      if (mountedRef.current) {
        setArchivedActivities(results);
        setPagination({
          page: 1,
          total: results.length,
          totalPages: 1,
          hasMore: false
        });
      }
    } catch (error) {
      console.error('Error searching:', error);
      if (mountedRef.current) {
        setError('Search failed. Please try again.');
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [searchTerm, loadArchivedActivities]);

  // Handle restore single activity
  const handleRestore = useCallback(async (activityId) => {
    if (!window.confirm('Restore this activity to main logs?')) return;
    
    setRestoring(true);
    setError(null);
    
    try {
      const restored = await restoreArchivedActivity(activityId);
      if (restored && mountedRef.current) {
        setArchivedActivities(prev => prev.filter(act => act.id !== activityId));
        setSelectedActivities(prev => {
          const newSet = new Set(prev);
          newSet.delete(activityId);
          return newSet;
        });
        onRestore?.(restored);
        loadStats();
        // Show success message
        const successMsg = document.createElement('div');
        successMsg.textContent = 'Activity restored successfully!';
        successMsg.style.cssText = 'position:fixed;bottom:20px;right:20px;background:#10b981;color:white;padding:12px 24px;border-radius:8px;z-index:10000;animation:fadeOut 3s forwards';
        document.body.appendChild(successMsg);
        setTimeout(() => successMsg.remove(), 3000);
      } else if (mountedRef.current) {
        setError('Failed to restore activity.');
      }
    } catch (error) {
      console.error('Error restoring activity:', error);
      if (mountedRef.current) {
        setError('Error restoring activity.');
      }
    } finally {
      if (mountedRef.current) {
        setRestoring(false);
      }
    }
  }, [onRestore, loadStats]);

  // Handle bulk restore
  const handleBulkRestore = useCallback(async () => {
    if (selectedActivities.size === 0) return;
    
    if (!window.confirm(`Restore ${selectedActivities.size} selected activities to main logs?`)) return;
    
    setRestoring(true);
    setError(null);
    
    try {
      const activityIds = Array.from(selectedActivities);
      const restored = await restoreMultipleArchived(activityIds);
      
      if (mountedRef.current && restored.length > 0) {
        setArchivedActivities(prev => prev.filter(act => !selectedActivities.has(act.id)));
        setSelectedActivities(new Set());
        setSelectionMode(false);
        onRestore?.(restored);
        loadStats();
        
        const successMsg = document.createElement('div');
        successMsg.textContent = `Successfully restored ${restored.length} activities.`;
        successMsg.style.cssText = 'position:fixed;bottom:20px;right:20px;background:#10b981;color:white;padding:12px 24px;border-radius:8px;z-index:10000;animation:fadeOut 3s forwards';
        document.body.appendChild(successMsg);
        setTimeout(() => successMsg.remove(), 3000);
      } else if (mountedRef.current) {
        setError('Failed to restore activities.');
      }
    } catch (error) {
      console.error('Error bulk restoring:', error);
      if (mountedRef.current) {
        setError('Error restoring activities.');
      }
    } finally {
      if (mountedRef.current) {
        setRestoring(false);
      }
    }
  }, [selectedActivities, onRestore, loadStats]);

  // Handle permanent delete single
  // In ArchivedLogs.jsx, update the permanentlyDeleteArchived function
const handlePermanentDelete = useCallback(async (activityId) => {
  if (!window.confirm('Permanently delete this activity? This action cannot be undone.')) return;
  
  setDeleting(true);
  setError(null);
  
  try {
    console.log('Attempting to delete activity:', activityId);
    
    // First, check if the activity exists in the current list
    const activityExists = archivedActivities.some(act => act.id === activityId);
    if (!activityExists) {
      setError('Activity not found in archived logs.');
      setDeleting(false);
      return;
    }
    
    const success = await permanentlyDeleteArchived(activityId);
    
    if (success && mountedRef.current) {
      // Remove the activity from local state
      setArchivedActivities(prev => prev.filter(act => act.id !== activityId));
      setSelectedActivities(prev => {
        const newSet = new Set(prev);
        newSet.delete(activityId);
        return newSet;
      });
      loadStats();
      
      // Show success message
      const successMsg = document.createElement('div');
      successMsg.textContent = 'Activity permanently deleted.';
      successMsg.style.cssText = 'position:fixed;bottom:20px;right:20px;background:#ef4444;color:white;padding:12px 24px;border-radius:8px;z-index:10000;animation:fadeOut 3s forwards';
      document.body.appendChild(successMsg);
      setTimeout(() => successMsg.remove(), 3000);
    } else if (mountedRef.current) {
      setError('Failed to delete activity. The activity may have already been deleted.');
    }
  } catch (error) {
    console.error('Error deleting activity:', error);
    if (mountedRef.current) {
      setError('Error deleting activity. Please try again.');
    }
  } finally {
    if (mountedRef.current) {
      setDeleting(false);
    }
  }
}, [archivedActivities, loadStats]);

  // Handle bulk permanent delete
  const handleBulkDelete = useCallback(async () => {
    if (selectedActivities.size === 0) return;
    
    if (!window.confirm(`Permanently delete ${selectedActivities.size} selected activities? This action cannot be undone.`)) return;
    
    setDeleting(true);
    setError(null);
    
    try {
      const activityIds = Array.from(selectedActivities);
      const deletedCount = await permanentlyDeleteMultipleArchived(activityIds);
      
      if (mountedRef.current && deletedCount > 0) {
        setArchivedActivities(prev => prev.filter(act => !selectedActivities.has(act.id)));
        setSelectedActivities(new Set());
        setSelectionMode(false);
        loadStats();
        
        const successMsg = document.createElement('div');
        successMsg.textContent = `Successfully deleted ${deletedCount} activities.`;
        successMsg.style.cssText = 'position:fixed;bottom:20px;right:20px;background:#ef4444;color:white;padding:12px 24px;border-radius:8px;z-index:10000;animation:fadeOut 3s forwards';
        document.body.appendChild(successMsg);
        setTimeout(() => successMsg.remove(), 3000);
      } else if (mountedRef.current && deletedCount === 0) {
        setError('No activities were deleted.');
      }
    } catch (error) {
      console.error('Error bulk deleting:', error);
      if (mountedRef.current) {
        setError('Error deleting activities.');
      }
    } finally {
      if (mountedRef.current) {
        setDeleting(false);
      }
    }
  }, [selectedActivities, loadStats]);

  // Handle clear all archived
  const handleClearAll = useCallback(async () => {
    if (!window.confirm('⚠️ WARNING: This will permanently delete ALL archived logs. This action cannot be undone. Are you absolutely sure?')) return;
    
    const confirmation = window.prompt('Type "DELETE" to confirm:');
    if (confirmation !== 'DELETE') {
      alert('Confirmation failed. No changes were made.');
      return;
    }
    
    setDeleting(true);
    setError(null);
    
    try {
      const success = await clearAllArchived();
      if (success && mountedRef.current) {
        setArchivedActivities([]);
        setSelectedActivities(new Set());
        setSelectionMode(false);
        loadStats();
        
        const successMsg = document.createElement('div');
        successMsg.textContent = 'All archived logs have been permanently deleted.';
        successMsg.style.cssText = 'position:fixed;bottom:20px;right:20px;background:#ef4444;color:white;padding:12px 24px;border-radius:8px;z-index:10000;animation:fadeOut 3s forwards';
        document.body.appendChild(successMsg);
        setTimeout(() => successMsg.remove(), 3000);
      } else if (mountedRef.current) {
        setError('Failed to clear archived logs.');
      }
    } catch (error) {
      console.error('Error clearing archived:', error);
      if (mountedRef.current) {
        setError('Error clearing archived logs.');
      }
    } finally {
      if (mountedRef.current) {
        setDeleting(false);
      }
    }
  }, [loadStats]);

  // Handle export
  const handleExport = useCallback((format) => {
    let activitiesToExport = archivedActivities;
    
    if (selectedActivities.size > 0) {
      activitiesToExport = archivedActivities.filter(act => 
        selectedActivities.has(act.id)
      );
    }
    
    const filename = `archived-logs-${new Date().toISOString().split('T')[0]}`;
    
    let success = false;
    if (format === 'csv') {
      success = exportArchivedToCSV(activitiesToExport, `${filename}.csv`);
    } else {
      success = exportArchivedToJSON(activitiesToExport, `${filename}.json`);
    }
    
    if (success) {
      const successMsg = document.createElement('div');
      successMsg.textContent = `Exported ${activitiesToExport.length} logs as ${format.toUpperCase()}`;
      successMsg.style.cssText = 'position:fixed;bottom:20px;right:20px;background:#10b981;color:white;padding:12px 24px;border-radius:8px;z-index:10000;animation:fadeOut 3s forwards';
      document.body.appendChild(successMsg);
      setTimeout(() => successMsg.remove(), 3000);
    } else {
      setError('Export failed. Please try again.');
    }
    
    setShowExportMenu(false);
  }, [archivedActivities, selectedActivities]);

  // Toggle selection mode
  const toggleSelectionMode = useCallback(() => {
    setSelectionMode(prev => !prev);
    if (selectionMode) {
      setSelectedActivities(new Set());
    }
  }, [selectionMode]);

  // Toggle select all
  const toggleSelectAll = useCallback(() => {
    if (selectedActivities.size === archivedActivities.length) {
      setSelectedActivities(new Set());
    } else {
      const newSelected = new Set();
      archivedActivities.forEach(act => {
        newSelected.add(act.id);
      });
      setSelectedActivities(newSelected);
    }
  }, [selectedActivities.size, archivedActivities]);

  // Toggle single selection
  const toggleSelectActivity = useCallback((activityId) => {
    setSelectedActivities(prev => {
      const newSelected = new Set(prev);
      if (newSelected.has(activityId)) {
        newSelected.delete(activityId);
      } else {
        newSelected.add(activityId);
      }
      return newSelected;
    });
  }, []);

  // Format timestamp
  const formatTimestamp = useCallback((timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    
    return date.toLocaleString();
  }, []);

  // Get action icon
  const getActionIcon = useCallback((action) => {
    if (!action) return 'bi bi-record-circle';
    
    const actionLower = action.toLowerCase();
    if (actionLower.includes('created') || actionLower.includes('added')) 
      return 'bi bi-plus-circle-fill';
    if (actionLower.includes('updated') || actionLower.includes('edited') || actionLower.includes('modified')) 
      return 'bi bi-pencil-fill';
    if (actionLower.includes('deleted') || actionLower.includes('removed')) 
      return 'bi bi-trash-fill';
    if (actionLower.includes('sync') || actionLower.includes('processed')) 
      return 'bi bi-arrow-repeat';
    if (actionLower.includes('logged in')) 
      return 'bi bi-box-arrow-in-right';
    if (actionLower.includes('logged out')) 
      return 'bi bi-box-arrow-right';
    return 'bi bi-record-circle';
  }, []);

  // Load more for infinite scroll
  const loadMore = useCallback(() => {
    if (pagination.hasMore && !loadingMore && !loading && !searchTerm) {
      loadArchivedActivities(pagination.page + 1);
    }
  }, [pagination.hasMore, pagination.page, loadingMore, loading, searchTerm, loadArchivedActivities]);

  // Intersection observer for infinite scroll with cleanup
  const lastActivityRef = useCallback(node => {
    if (loadingMore || loading) return;
    if (observerRef.current) {
      observerRef.current.disconnect();
    }
    
    if (node && pagination.hasMore) {
      observerRef.current = new IntersectionObserver(entries => {
        if (entries[0].isIntersecting && pagination.hasMore && !loadingMore && !loading && !searchTerm) {
          loadMore();
        }
      }, { rootMargin: '100px', threshold: 0.1 });
      
      observerRef.current.observe(node);
    }
  }, [loadingMore, loading, pagination.hasMore, loadMore, searchTerm]);

  // Reset filters
  const resetFilters = useCallback(() => {
    setFilter('all');
    setCategoryFilter('all');
    setSearchTerm('');
    setSortBy('date');
    setSortDirection('desc');
    loadArchivedActivities(1, true);
  }, [loadArchivedActivities]);

  // Initial load and cleanup
  useEffect(() => {
    if (isOpen) {
      mountedRef.current = true;
      loadArchivedActivities(1, true);
      loadStats();
    }
    
    return () => {
      // Cleanup observer on unmount
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
      mountedRef.current = false;
    };
  }, [isOpen, loadArchivedActivities, loadStats]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;
      
      if (e.key === 'Escape') {
        onClose();
      }
      
      if (e.ctrlKey && e.key === 'f') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      
      if (e.ctrlKey && e.key === 'a' && selectionMode) {
        e.preventDefault();
        toggleSelectAll();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, selectionMode, toggleSelectAll]);

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2000,
      animation: 'fadeIn 0.2s ease'
    }} onClick={onClose}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        width: '90%',
        maxWidth: '1200px',
        height: '85vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
      }} onClick={(e) => e.stopPropagation()}>
        
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #eaeef2',
          backgroundColor: '#f8fafc',
          borderRadius: '12px 12px 0 0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div>
            <h2 style={{ margin: 0, color: '#1a1a1a', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="bi bi-archive" style={{ color: '#f97316' }}></i>
              Archived Logs
              <span style={{
                fontSize: '0.85rem',
                backgroundColor: '#e2e8f0',
                color: '#475569',
                padding: '2px 8px',
                borderRadius: '20px',
                fontWeight: 'normal'
              }}>
                {pagination.total} items
              </span>
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>
              Archived logs older than 30 days are stored here
            </p>
          </div>
          
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setShowStats(!showStats)}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                backgroundColor: showStats ? '#4361ee' : 'white',
                color: showStats ? 'white' : '#475569',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <i className="bi bi-pie-chart"></i>
              Stats
            </button>
            
            <button
              onClick={onClose}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: '#e2e8f0',
                color: '#475569',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <i className="bi bi-x-lg"></i>
              Close
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div style={{
            margin: '16px 24px 0 24px',
            padding: '12px 16px',
            backgroundColor: '#fee8e8',
            border: '1px solid #ef4444',
            borderRadius: '8px',
            color: '#ef4444',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <span><i className="bi bi-exclamation-triangle-fill" style={{ marginRight: '8px' }}></i>{error}</span>
            <button
              onClick={() => setError(null)}
              style={{
                border: 'none',
                background: 'none',
                color: '#ef4444',
                cursor: 'pointer',
                fontSize: '1.2rem'
              }}
            >
              &times;
            </button>
          </div>
        )}

        {/* Stats Panel */}
        {showStats && stats && (
          <div style={{
            padding: '16px 24px',
            backgroundColor: '#fef9e6',
            borderBottom: '1px solid #eaeef2',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
            gap: '12px'
          }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Total Archived</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#f97316' }}>{stats.total}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Create</div>
              <div style={{ fontSize: '1.25rem', fontWeight: '500', color: '#10b981' }}>{stats.byCategory?.create || 0}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Update</div>
              <div style={{ fontSize: '1.25rem', fontWeight: '500', color: '#8b5cf6' }}>{stats.byCategory?.update || 0}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Delete</div>
              <div style={{ fontSize: '1.25rem', fontWeight: '500', color: '#ef4444' }}>{stats.byCategory?.delete || 0}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Oldest Archived</div>
              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                {stats.oldestDate ? new Date(stats.oldestDate).toLocaleDateString() : 'N/A'}
              </div>
            </div>
          </div>
        )}

        {/* Controls */}
        <div style={{
          padding: '16px 24px',
          borderBottom: '1px solid #eaeef2',
          backgroundColor: 'white'
        }}>
          {/* Search Bar */}
          <form onSubmit={handleSearch} style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search archived logs... (Ctrl+F)"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: '20px',
                  border: '1px solid #e2e8f0',
                  fontSize: '0.9rem',
                  outline: 'none'
                }}
              />
              <button
                type="submit"
                style={{
                  padding: '8px 16px',
                  borderRadius: '20px',
                  border: 'none',
                  backgroundColor: '#4361ee',
                  color: 'white',
                  cursor: 'pointer'
                }}
              >
                <i className="bi bi-search"></i>
              </button>
            </div>
          </form>

          {/* Filter Controls */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '20px',
                  border: '1px solid #e2e8f0',
                  backgroundColor: 'white',
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
              >
                <option value="date">Sort by Date</option>
                <option value="category">Sort by Category</option>
                <option value="user">Sort by User</option>
              </select>
              
              <button
                onClick={() => setSortDirection(prev => prev === 'desc' ? 'asc' : 'desc')}
                style={{
                  padding: '6px 12px',
                  borderRadius: '20px',
                  border: '1px solid #e2e8f0',
                  backgroundColor: 'white',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <i className={`bi bi-arrow-${sortDirection === 'desc' ? 'down' : 'up'}`}></i>
                {sortDirection === 'desc' ? 'Newest' : 'Oldest'}
              </button>
            </div>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              style={{
                padding: '6px 12px',
                borderRadius: '20px',
                border: '1px solid #e2e8f0',
                backgroundColor: 'white',
                fontSize: '0.85rem',
                cursor: 'pointer'
              }}
            >
              {getCategories().map(cat => (
                <option key={cat} value={cat}>{getCategoryDisplayName(cat)}</option>
              ))}
            </select>

            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              {['all', 'today', 'week', 'month'].map(filterOption => (
                <button
                  key={filterOption}
                  onClick={() => setFilter(filterOption)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '20px',
                    border: 'none',
                    backgroundColor: filter === filterOption ? '#4361ee' : '#e2e8f0',
                    color: filter === filterOption ? 'white' : '#475569',
                    fontSize: '0.85rem',
                    cursor: 'pointer'
                  }}
                >
                  {filterOption.charAt(0).toUpperCase() + filterOption.slice(1)}
                </button>
              ))}
            </div>

            <button
              onClick={resetFilters}
              style={{
                padding: '6px 12px',
                borderRadius: '20px',
                border: '1px solid #e2e8f0',
                backgroundColor: 'white',
                fontSize: '0.85rem',
                cursor: 'pointer'
              }}
            >
              <i className="bi bi-arrow-clockwise"></i> Reset
            </button>

            <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
              <button
                onClick={toggleSelectionMode}
                style={{
                  padding: '6px 12px',
                  borderRadius: '20px',
                  border: '1px solid #e2e8f0',
                  backgroundColor: selectionMode ? '#4361ee' : 'white',
                  color: selectionMode ? 'white' : '#475569',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <i className={`bi ${selectionMode ? 'bi-check-square' : 'bi-square'}`}></i>
                {selectionMode ? 'Selection Mode' : 'Select'}
              </button>

              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  disabled={archivedActivities.length === 0}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '20px',
                    border: '1px solid #e2e8f0',
                    backgroundColor: 'white',
                    color: '#10b981',
                    fontSize: '0.85rem',
                    cursor: archivedActivities.length === 0 ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    opacity: archivedActivities.length === 0 ? 0.5 : 1
                  }}
                >
                  <i className="bi bi-download"></i>
                  Export
                </button>
                
                {showExportMenu && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: '4px',
                    backgroundColor: 'white',
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    border: '1px solid #eaeef2',
                    zIndex: 10,
                    minWidth: '150px'
                  }}>
                    <div
                      onClick={() => handleExport('csv')}
                      style={{
                        padding: '10px 16px',
                        cursor: 'pointer',
                        borderBottom: '1px solid #eaeef2',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}
                    >
                      <i className="bi bi-file-earmark-spreadsheet" style={{ color: '#10b981' }}></i>
                      Export as CSV
                    </div>
                    <div
                      onClick={() => handleExport('json')}
                      style={{
                        padding: '10px 16px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}
                    >
                      <i className="bi bi-file-earmark-code" style={{ color: '#f97316' }}></i>
                      Export as JSON
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bulk Actions Bar */}
          {selectionMode && selectedActivities.size > 0 && (
            <div style={{
              marginTop: '12px',
              padding: '8px 12px',
              backgroundColor: '#e8f0fe',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px'
            }}>
              <span style={{ color: '#4361ee', fontWeight: '500' }}>
                <i className="bi bi-check-circle-fill" style={{ marginRight: '8px' }}></i>
                {selectedActivities.size} item{selectedActivities.size > 1 ? 's' : ''} selected
              </span>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  onClick={toggleSelectAll}
                  style={{
                    padding: '4px 12px',
                    borderRadius: '16px',
                    border: '1px solid #4361ee',
                    backgroundColor: 'white',
                    color: '#4361ee',
                    fontSize: '0.8rem',
                    cursor: 'pointer'
                  }}
                >
                  {selectedActivities.size === archivedActivities.length ? 'Deselect All' : 'Select All'}
                </button>
                <button
                  onClick={handleBulkRestore}
                  disabled={restoring}
                  style={{
                    padding: '4px 12px',
                    borderRadius: '16px',
                    border: '1px solid #10b981',
                    backgroundColor: 'white',
                    color: '#10b981',
                    fontSize: '0.8rem',
                    cursor: restoring ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <i className="bi bi-arrow-counterclockwise"></i>
                  {restoring ? 'Restoring...' : 'Restore'}
                </button>
                <button
                  onClick={handleBulkDelete}
                  disabled={deleting}
                  style={{
                    padding: '4px 12px',
                    borderRadius: '16px',
                    border: '1px solid #ef4444',
                    backgroundColor: 'white',
                    color: '#ef4444',
                    fontSize: '0.8rem',
                    cursor: deleting ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <i className="bi bi-trash"></i>
                  {deleting ? 'Deleting...' : 'Delete Permanently'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Archived Logs List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
          {loading && archivedActivities.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px', color: '#94a3b8' }}>
              <i className="bi bi-arrow-repeat spin" style={{ fontSize: '2rem' }}></i>
              <p style={{ marginTop: '12px' }}>Loading archived logs...</p>
            </div>
          ) : archivedActivities.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px', color: '#94a3b8' }}>
              <i className="bi bi-archive" style={{ fontSize: '3rem', opacity: 0.5 }}></i>
              <p style={{ marginTop: '16px', fontSize: '1rem' }}>No archived logs found</p>
              <p style={{ fontSize: '0.9rem' }}>Activities older than 30 days will appear here</p>
            </div>
          ) : (
            archivedActivities.map((activity, index) => (
                  <div
                    key={`archived-${activity.id}-${index}`}  // Add prefix and index for uniqueness
                    ref={index === archivedActivities.length - 1 ? lastActivityRef : null}
                    style={{
                      padding: '16px',
                      marginBottom: '8px',
                      backgroundColor: selectionMode && selectedActivities.has(activity.id) ? '#e8f0fe' : '#f8fafc',
                      borderRadius: '8px',
                      border: '1px solid #eaeef2',
                      transition: 'background-color 0.2s',
                      cursor: selectionMode ? 'pointer' : 'default'
                    }}
                    onClick={() => selectionMode && toggleSelectActivity(activity.id)}
                  >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  {selectionMode && (
                    <input
                      type="checkbox"
                      checked={selectedActivities.has(activity.id)}
                      onChange={() => toggleSelectActivity(activity.id)}
                      onClick={(e) => e.stopPropagation()}
                      style={{ marginTop: '4px' }}
                    />
                  )}
                  
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    backgroundColor: getCategoryColor(activity.category).bg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: getCategoryColor(activity.category).text,
                    fontSize: '1.2rem',
                    flexShrink: 0
                  }}>
                    <i className={getActionIcon(activity.action)}></i>
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <strong style={{ color: '#1a1a1a' }}>{activity.user}</strong>
                        <span style={{
                          backgroundColor: getCategoryColor(activity.category).bg,
                          color: getCategoryColor(activity.category).text,
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '0.7rem',
                          fontWeight: '600',
                          border: `1px solid ${getCategoryColor(activity.category).border}`
                        }}>
                          {activity.category}
                        </span>
                        <span style={{ color: '#64748b', fontSize: '0.9rem' }}>{activity.action}</span>
                        {activity.details && (
                          <span style={{
                            backgroundColor: '#e2e8f0',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontSize: '0.8rem',
                            color: '#475569'
                          }}>
                            {activity.details.length > 50 ? `${activity.details.substring(0, 50)}...` : activity.details}
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                        {formatTimestamp(activity.timestamp)}
                      </span>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '12px', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '12px', flexWrap: 'wrap' }}>
                      <span><i className="bi bi-envelope"></i> {activity.userEmail}</span>
                      <span><i className="bi bi-geo-alt"></i> {activity.ip || '127.0.0.1'}</span>
                      <span><i className="bi bi-calendar"></i> Archived: {activity.archivedAt ? new Date(activity.archivedAt).toLocaleDateString() : 'Unknown'}</span>
                    </div>

                    {!selectionMode && (
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRestore(activity.id);
                          }}
                          disabled={restoring}
                          style={{
                            padding: '4px 12px',
                            borderRadius: '16px',
                            border: '1px solid #10b981',
                            backgroundColor: 'white',
                            color: '#10b981',
                            fontSize: '0.75rem',
                            cursor: restoring ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <i className="bi bi-arrow-counterclockwise"></i>
                          Restore
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePermanentDelete(activity.id);
                          }}
                          disabled={deleting}
                          style={{
                            padding: '4px 12px',
                            borderRadius: '16px',
                            border: '1px solid #ef4444',
                            backgroundColor: 'white',
                            color: '#ef4444',
                            fontSize: '0.75rem',
                            cursor: deleting ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <i className="bi bi-trash"></i>
                          Delete Permanently
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
          
          {loadingMore && (
            <div style={{ textAlign: 'center', padding: '20px', color: '#94a3b8' }}>
              <i className="bi bi-arrow-repeat spin"></i> Loading more...
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 24px',
          borderTop: '1px solid #eaeef2',
          backgroundColor: '#f8fafc',
          borderRadius: '0 0 12px 12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '0.85rem',
          color: '#64748b',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div>
            <i className="bi bi-info-circle"></i> Page {pagination.page} of {pagination.totalPages}
            <span style={{ marginLeft: '12px' }}>
              <i className="bi bi-archive"></i> {pagination.total} total archived
            </span>
          </div>
          
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleClearAll}
              disabled={deleting || archivedActivities.length === 0}
              style={{
                border: 'none',
                background: 'none',
                color: '#ef4444',
                fontSize: '0.8rem',
                cursor: (deleting || archivedActivities.length === 0) ? 'not-allowed' : 'pointer',
                padding: '4px 8px',
                borderRadius: '4px',
                opacity: (deleting || archivedActivities.length === 0) ? 0.5 : 1
              }}
            >
              <i className="bi bi-trash3"></i> Clear All Archived
            </button>
          </div>
        </div>
      </div>

      <style>
        {`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          .spin {
            animation: spin 1s linear infinite;
            display: inline-block;
          }
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes fadeOut {
            0% { opacity: 1; }
            70% { opacity: 1; }
            100% { opacity: 0; visibility: hidden; }
          }
        `}
      </style>
    </div>
  );
};

export default ArchivedLogs;
