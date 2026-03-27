// Systemlogs.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  getActivitiesWithPagination, 
  logActivity,
  syncPendingActivities,
  loadFromDatabase,
  exportActivitiesToCSV,
  exportActivitiesToJSON,
  saveFilterPreferences,
  loadFilterPreferences,
  bulkDeleteActivities,
  getActivityTimeline
} from '../utils/activityLogger';
import ArchivedLogs from '../utils/ArchivedLogs';
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const Systemlogs = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadingFromDb, setLoadingFromDb] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState(null);
  const [activities, setActivities] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    total: 0,
    totalPages: 1,
    hasMore: true
  });
  const [filter, setFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortBy, setSortBy] = useState('date');
  const [sortDirection, setSortDirection] = useState('desc');
  const [searchTerm, setSearchTerm] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState('');
  const [showLoadModal, setShowLoadModal] = useState(false);
  
  // New state variables for UX enhancements
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [customDateRange, setCustomDateRange] = useState({
    startDate: '',
    endDate: ''
  });
  const [selectedActivities, setSelectedActivities] = useState(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showTimelineView, setShowTimelineView] = useState(false);
  const [timelineData, setTimelineData] = useState([]);
  const [timelineGroupBy, setTimelineGroupBy] = useState('day');
  const [showSaveFilterModal, setShowSaveFilterModal] = useState(false);
  const [filterName, setFilterName] = useState('');
  const [savedFilters, setSavedFilters] = useState([]);
  
  // New state for Phase 1 features
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const [hoveredActivity, setHoveredActivity] = useState(null);
  const [previewPosition, setPreviewPosition] = useState({ x: 0, y: 0 });
  const hoverTimeoutRef = useRef(null);
  const searchInputRef = useRef(null);
  const [showArchivedLogs, setShowArchivedLogs] = useState(false);
  
  // New state for Context Menu
  const [contextMenu, setContextMenu] = useState({
    show: false,
    x: 0,
    y: 0,
    activity: null
  });
  
  // New state for Color Customization
  const [categoryColors, setCategoryColors] = useState(() => {
    const saved = localStorage.getItem('category_colors');
    return saved ? JSON.parse(saved) : {
      create: { bg: '#e6f7f0', text: '#10b981', border: '#10b981' },
      update: { bg: '#f3e8ff', text: '#8b5cf6', border: '#8b5cf6' },
      delete: { bg: '#fee8e8', text: '#ef4444', border: '#ef4444' },
      maintenance: { bg: '#e8e8e8', text: '#64748b', border: '#64748b' },
      auth: { bg: '#fff3e0', text: '#f97316', border: '#f97316' },
      other: { bg: '#f1f5f9', text: '#475569', border: '#475569' }
    };
  });
  
  const [showColorCustomizer, setShowColorCustomizer] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState(null);

  // Load saved filter preferences
  useEffect(() => {
    const savedPrefs = loadFilterPreferences();
    if (savedPrefs) {
      setFilter(savedPrefs.filter || 'all');
      setCategoryFilter(savedPrefs.categoryFilter || 'all');
      setSortBy(savedPrefs.sortBy || 'date');
      setSortDirection(savedPrefs.sortDirection || 'desc');
      setSearchTerm(savedPrefs.searchTerm || '');
      if (savedPrefs.customDateRange) {
        setCustomDateRange(savedPrefs.customDateRange);
      }
    }
    
    const saved = localStorage.getItem('saved_log_filters');
    if (saved) {
      setSavedFilters(JSON.parse(saved));
    }
  }, []);

  // Save preferences when they change
  useEffect(() => {
    const preferences = {
      filter,
      categoryFilter,
      sortBy,
      sortDirection,
      searchTerm,
      customDateRange
    };
    saveFilterPreferences(preferences);
  }, [filter, categoryFilter, sortBy, sortDirection, searchTerm, customDateRange]);

  // Save colors to localStorage when changed
  useEffect(() => {
    localStorage.setItem('category_colors', JSON.stringify(categoryColors));
  }, [categoryColors]);

  // Keyboard shortcut handler
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }

      if (e.ctrlKey && e.key === 'f') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      
      if (e.ctrlKey && e.key === 'e') {
        e.preventDefault();
        setShowExportMenu(prev => !prev);
      }
      
      if (e.ctrlKey && e.key === 'd') {
        e.preventDefault();
        setSelectionMode(prev => !prev);
        if (selectionMode) {
          setSelectedActivities(new Set());
        }
      }
      
      if (e.ctrlKey && e.key === 'a' && selectionMode) {
        e.preventDefault();
        setSelectedActivities(prev => {
          if (prev.size === activities.length) {
            return new Set();
          } else {
            const newSelected = new Set();
            activities.forEach(act => {
              newSelected.add(act._id || act.id);
            });
            return newSelected;
          }
        });
      }
      
      if (e.key === 'Escape') {
        if (showDetailsModal) setShowDetailsModal(false);
        if (showTimelineView) setShowTimelineView(false);
        if (showExportMenu) setShowExportMenu(false);
        if (showShortcutsHelp) setShowShortcutsHelp(false);
        setContextMenu(prev => ({ ...prev, show: false }));
        if (showColorCustomizer) setShowColorCustomizer(false);
      }
      
      if (e.key === '?' && !e.shiftKey) {
        e.preventDefault();
        setShowShortcutsHelp(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    selectionMode, 
    showDetailsModal, 
    showTimelineView, 
    showExportMenu, 
    showShortcutsHelp,
    showColorCustomizer,
    activities
  ]);

  const getCategories = () => {
    return ['all', 'create', 'update', 'delete', 'maintenance', 'auth', 'other'];
  };

  const getCategoryDisplayName = (category) => {
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
  };

  const getCategoryColor = (category) => {
    return categoryColors[category] || categoryColors.other;
  };

  const sortActivities = useCallback((activitiesToSort) => {
    const sorted = [...activitiesToSort];
    
    switch(sortBy) {
      case 'category':
        sorted.sort((a, b) => {
          const categoryCompare = (a.category || '').localeCompare(b.category || '');
          if (categoryCompare !== 0) {
            return sortDirection === 'asc' ? categoryCompare : -categoryCompare;
          }
          return new Date(b.timestamp) - new Date(a.timestamp);
        });
        break;
        
      case 'user':
        sorted.sort((a, b) => {
          const userCompare = (a.user || '').localeCompare(b.user || '');
          if (userCompare !== 0) {
            return sortDirection === 'asc' ? userCompare : -userCompare;
          }
          return new Date(b.timestamp) - new Date(a.timestamp);
        });
        break;
        
      default:
        sorted.sort((a, b) => {
          const dateA = new Date(a.timestamp);
          const dateB = new Date(b.timestamp);
          return sortDirection === 'desc' ? dateB - dateA : dateA - dateB;
        });
    }
    
    return sorted;
  }, [sortBy, sortDirection]);

  const loadActivities = useCallback(async (page = 1, reset = false) => {
    try {
      if (page === 1) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

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
      } else if (filter === 'custom' && customDateRange.startDate && customDateRange.endDate) {
        filters.startDate = new Date(customDateRange.startDate).toISOString();
        filters.endDate = new Date(customDateRange.endDate).toISOString();
      }

      const result = await getActivitiesWithPagination(page, 20, filters);
      
      let sortedActivities = sortActivities(result.activities);

      setActivities(prev => reset ? sortedActivities : [...prev, ...sortedActivities]);
      setPagination({
        page: result.page,
        total: result.total,
        totalPages: result.totalPages,
        hasMore: result.page < result.totalPages
      });
      
      setSyncStatus(result.fromDatabase ? '🟢 Connected' : '🟡 Local Cache');
    } catch (error) {
      console.error('Error loading activities:', error);
      setSyncStatus('🔴 Error loading');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [categoryFilter, filter, searchTerm, sortActivities, customDateRange]);

  const handleSync = useCallback(async () => {
    setIsSyncing(true);
    setSyncStatus('🔄 Syncing...');
    await syncPendingActivities();
    setActivities([]);
    await loadActivities(1, true);
    setIsSyncing(false);
  }, [loadActivities]);

  const handleLoadFromDatabase = useCallback(async () => {
    if (!navigator.onLine) {
      alert('You are offline. Please connect to the internet to load from database.');
      return;
    }

    setLoadingFromDb(true);
    setSyncStatus('🔄 Loading from database...');
    
    try {
      const success = await loadFromDatabase();
      
      if (success) {
        setActivities([]);
        await loadActivities(1, true);
        logActivity('Loaded from Database', 'Refreshed activity logs from database');
        setSyncStatus('🟢 Database loaded');
      } else {
        alert('Failed to load from database. Please try again.');
        setSyncStatus('🔴 Load failed');
      }
    } catch (error) {
      console.error('Error loading from database:', error);
      alert('Error loading from database: ' + error.message);
      setSyncStatus('🔴 Load error');
    } finally {
      setLoadingFromDb(false);
      setShowLoadModal(false);
    }
  }, [loadActivities]);

  const handleArchiveSelected = async () => {
    if (selectedActivities.size === 0) return;
    
    if (!window.confirm(`Archive ${selectedActivities.size} selected logs? They will be moved to Archived Logs and removed from active view.`)) return;
    
    setRestoring(true);
    setError(null);
    
    try {
      const activityIds = Array.from(selectedActivities);
      
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/admin/archive-selected`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ logIds: activityIds })
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        setActivities(prev => prev.filter(act => !selectedActivities.has(act.id)));
        setSelectedActivities(new Set());
        setSelectionMode(false);
        
        const successMsg = document.createElement('div');
        successMsg.textContent = `Successfully archived ${data.archived_count} logs.`;
        successMsg.style.cssText = 'position:fixed;bottom:20px;right:20px;background:#10b981;color:white;padding:12px 24px;border-radius:8px;z-index:10000;animation:fadeOut 3s forwards';
        document.body.appendChild(successMsg);
        setTimeout(() => successMsg.remove(), 3000);
        
        loadActivities(1, true);
      } else {
        setError(data.message || 'Failed to archive logs.');
      }
    } catch (error) {
      console.error('Error archiving logs:', error);
      setError('Error archiving logs. Please try again.');
    } finally {
      setRestoring(false);
    }
  };

  const handleExport = (format) => {
    if (selectedActivities.size > 0) {
      const selected = activities.filter(act => 
        selectedActivities.has(act._id || act.id)
      );
      if (format === 'csv') {
        exportActivitiesToCSV(selected, `selected-logs-${new Date().toISOString().split('T')[0]}.csv`);
      } else {
        exportActivitiesToJSON(selected, `selected-logs-${new Date().toISOString().split('T')[0]}.json`);
      }
    } else {
      if (format === 'csv') {
        exportActivitiesToCSV(activities, `all-logs-${new Date().toISOString().split('T')[0]}.csv`);
      } else {
        exportActivitiesToJSON(activities, `all-logs-${new Date().toISOString().split('T')[0]}.json`);
      }
    }
    setShowExportMenu(false);
    logActivity('Exported Logs', `Exported ${selectedActivities.size || activities.length} logs as ${format.toUpperCase()}`);
  };

  const handleDateRangeFilter = () => {
    if (customDateRange.startDate && customDateRange.endDate) {
      setFilter('custom');
      setActivities([]);
      setPagination({ page: 1, total: 0, totalPages: 1, hasMore: true });
      loadActivities(1, true);
      setShowDatePicker(false);
    }
  };

  const toggleSelectionMode = () => {
    setSelectionMode(!selectionMode);
    if (selectionMode) {
      setSelectedActivities(new Set());
    }
  };

  const toggleSelectAll = () => {
    if (selectedActivities.size === activities.length) {
      setSelectedActivities(new Set());
    } else {
      const newSelected = new Set();
      activities.forEach(act => {
        newSelected.add(act._id || act.id);
      });
      setSelectedActivities(newSelected);
    }
  };

  const toggleSelectActivity = (activityId) => {
    const newSelected = new Set(selectedActivities);
    if (newSelected.has(activityId)) {
      newSelected.delete(activityId);
    } else {
      newSelected.add(activityId);
    }
    setSelectedActivities(newSelected);
  }; 

  const handleBulkExport = (format) => {
    handleExport(format);
    setSelectionMode(false);
  };

  const viewActivityDetails = (activity) => {
    setSelectedActivity(activity);
    setShowDetailsModal(true);
  };

  const generateTimeline = () => {
    const timeline = getActivityTimeline(activities, timelineGroupBy);
    setTimelineData(timeline);
    setShowTimelineView(true);
  };

  const saveCurrentFilter = () => {
    if (!filterName.trim()) return;
    
    const newFilter = {
      id: Date.now().toString(),
      name: filterName,
      filter: filter,
      categoryFilter: categoryFilter,
      sortBy: sortBy,
      sortDirection: sortDirection,
      searchTerm: searchTerm,
      customDateRange: customDateRange,
      timestamp: new Date().toISOString()
    };
    
    const updated = [...savedFilters, newFilter];
    setSavedFilters(updated);
    localStorage.setItem('saved_log_filters', JSON.stringify(updated));
    
    setShowSaveFilterModal(false);
    setFilterName('');
    
    logActivity('Saved Filter', `Saved filter: ${filterName}`);
  };

  const handleActivityHover = (activity, event) => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredActivity(activity);
      setPreviewPosition({
        x: event.clientX,
        y: event.clientY
      });
    }, 500);
  };

  const handleActivityLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    setHoveredActivity(null);
  };

  const handleContextMenu = (e, activity) => {
    e.preventDefault();
    setContextMenu({
      show: true,
      x: e.clientX,
      y: e.clientY,
      activity
    });
  };

  const handleContextMenuAction = (action) => {
    if (!contextMenu.activity) return;

    switch(action) {
      case 'copy-action':
        navigator.clipboard.writeText(contextMenu.activity.action);
        break;
      case 'copy-details':
        navigator.clipboard.writeText(contextMenu.activity.details || '');
        break;
      case 'copy-timestamp':
        navigator.clipboard.writeText(new Date(contextMenu.activity.timestamp).toLocaleString());
        break;
      case 'export-single':
        exportActivitiesToJSON([contextMenu.activity], `activity-${contextMenu.activity.id}.json`);
        break;
      case 'delete-single':
        if (window.confirm('Delete this log from display?')) {
          bulkDeleteActivities([contextMenu.activity.id || contextMenu.activity._id]);
          setActivities(prev => prev.filter(a => (a.id || a._id) !== (contextMenu.activity.id || contextMenu.activity._id)));
        }
        break;
      case 'filter-user':
        setSearchTerm(contextMenu.activity.user);
        handleSearch(new Event('submit'));
        break;
      case 'filter-category':
        setCategoryFilter(contextMenu.activity.category);
        setActivities([]);
        loadActivities(1, true);
        break;
      default:
        break;
    }
    
    setContextMenu({ ...contextMenu, show: false });
  };

  const groupActivitiesByDate = (activities) => {
    const groups = {
      today: [],
      yesterday: [],
      thisWeek: [],
      lastWeek: [],
      thisMonth: [],
      older: []
    };

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const twoWeeksAgo = new Date(today);
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    const monthAgo = new Date(today);
    monthAgo.setMonth(monthAgo.getMonth() - 1);

    activities.forEach(activity => {
      const activityDate = new Date(activity.timestamp);
      const activityDay = new Date(activityDate.getFullYear(), activityDate.getMonth(), activityDate.getDate());

      if (activityDay.getTime() === today.getTime()) {
        groups.today.push(activity);
      } else if (activityDay.getTime() === yesterday.getTime()) {
        groups.yesterday.push(activity);
      } else if (activityDay >= weekAgo) {
        groups.thisWeek.push(activity);
      } else if (activityDay >= twoWeeksAgo) {
        groups.lastWeek.push(activity);
      } else if (activityDay >= monthAgo) {
        groups.thisMonth.push(activity);
      } else {
        groups.older.push(activity);
      }
    });

    return groups;
  };

  const updateCategoryColor = (category, colorType, value) => {
    setCategoryColors(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [colorType]: value
      }
    }));
  };

  const resetColors = () => {
    setCategoryColors({
      create: { bg: '#e6f7f0', text: '#10b981', border: '#10b981' },
      update: { bg: '#f3e8ff', text: '#8b5cf6', border: '#8b5cf6' },
      delete: { bg: '#fee8e8', text: '#ef4444', border: '#ef4444' },
      maintenance: { bg: '#e8e8e8', text: '#64748b', border: '#64748b' },
      auth: { bg: '#fff3e0', text: '#f97316', border: '#f97316' },
      other: { bg: '#f1f5f9', text: '#475569', border: '#475569' }
    });
  };

  const loadMoreActivities = useCallback(() => {
    if (pagination.hasMore && !loadingMore) {
      loadActivities(pagination.page + 1);
    }
  }, [pagination.hasMore, pagination.page, loadingMore, loadActivities]);

  const observerRef = useRef();
  const lastActivityRef = useCallback(node => {
    if (loadingMore) return;
    
    if (observerRef.current) {
      observerRef.current.disconnect();
    }
    
    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && pagination.hasMore && !loadingMore) {
        loadMoreActivities();
      }
    }, {
      root: null,
      rootMargin: '100px',
      threshold: 0.1
    });
    
    if (node) {
      observerRef.current.observe(node);
    }
  }, [loadingMore, pagination.hasMore, loadMoreActivities]);

  useEffect(() => {
    const getUser = () => {
      const userFromStorage = localStorage.getItem('user');
      if (userFromStorage) {
        try {
          const parsedUser = JSON.parse(userFromStorage);
          
          const normalizedUser = {
            id: parsedUser.admin_id || parsedUser.employee_id || parsedUser.id || parsedUser._id,
            name: parsedUser.admin_name || parsedUser.name || 'Admin User',
            email: parsedUser.admin_email || parsedUser.email || 'unknown@email.com',
            role: parsedUser.admin_role || parsedUser.role || 'admin',
            last_login: parsedUser.login_time || parsedUser.last_login,
            session_id: parsedUser.session_id || parsedUser.last_session_id
          };
          
          return normalizedUser;
        } catch (e) {
          console.error('Error parsing user from localStorage:', e);
        }
      }
      return null;
    };

    const getSessionTime = () => {
      const sessionTime = sessionStorage.getItem('sessionStartTime');
      if (sessionTime) {
        return new Date(parseInt(sessionTime));
      } else {
        const now = new Date();
        sessionStorage.setItem('sessionStartTime', now.getTime().toString());
        return now;
      }
    };

    const user = getUser();
    setCurrentUser(user);
    setSessionStartTime(getSessionTime());
    
    loadActivities(1, true);
    
    const syncInterval = setInterval(() => {
      if (navigator.onLine) {
        handleSync();
      }
    }, 30000);
    
    setLoading(false);
    
    return () => {
      clearInterval(syncInterval);
    };
  }, [loadActivities, handleSync]);

  const handleFilterChange = (newFilter) => {
    setFilter(newFilter);
    setActivities([]);
    setPagination({ page: 1, total: 0, totalPages: 1, hasMore: true });
    loadActivities(1, true);
  };

  const handleCategoryChange = (newCategory) => {
    setCategoryFilter(newCategory);
    setActivities([]);
    setPagination({ page: 1, total: 0, totalPages: 1, hasMore: true });
    loadActivities(1, true);
  };

  const handleSortChange = (newSort) => {
    setSortBy(newSort);
    setActivities(prev => sortActivities(prev));
  };

  const toggleSortDirection = () => {
    setSortDirection(prev => prev === 'desc' ? 'asc' : 'desc');
    setActivities(prev => sortActivities(prev));
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setActivities([]);
    setPagination({ page: 1, total: 0, totalPages: 1, hasMore: true });
    loadActivities(1, true);
  };

  const formatLastLogin = (lastLogin) => {
    if (!lastLogin) return 'Never';
    try {
      const date = new Date(lastLogin);
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });
    } catch (e) {
      return 'Invalid date';
    }
  };

  const getSessionDuration = () => {
    if (!sessionStartTime) return 'Just started';
    const now = new Date();
    const diffMs = now - sessionStartTime;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const remainingMins = diffMins % 60;
    
    if (diffHours > 0) {
      return `${diffHours}h ${remainingMins}m`;
    } else if (diffMins > 0) {
      return `${diffMins} minutes`;
    } else {
      return 'Less than a minute';
    }
  };

  const getActionIcon = (action) => {
    if (action.includes('Created') || action.includes('Added') || action.includes('Registered')) 
      return 'bi bi-plus-circle-fill';
    if (action.includes('Updated') || action.includes('Edited') || action.includes('Modified') || action.includes('Activated') || action.includes('Deactivated')) 
      return 'bi bi-pencil-fill';
    if (action.includes('Deleted') || action.includes('Removed')) 
      return 'bi bi-trash-fill';
    if (action.includes('Sync') || action.includes('Processed') || action.includes('Generated') || action.includes('Loaded')) 
      return 'bi bi-arrow-repeat';
    if (action.includes('Logged In')) 
      return 'bi bi-box-arrow-in-right';
    if (action.includes('Logged Out')) 
      return 'bi bi-box-arrow-right';
    return 'bi bi-record-circle';
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    
    const utcDate = date.getTime();
    const utcNow = now.getTime();
    
    const diffMs = utcNow - utcDate;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Manila'
    });
  };

  if (loading) {
    return (
      <div className="systemlogs-container" style={{ padding: '20px' }}>
        <h4 className="fw-bold mb-1">System Logs</h4>
        <div style={{ textAlign: 'center', padding: '40px', color: '#7f8c8d' }}>
          <i className="bi bi-arrow-repeat" style={{ fontSize: '2rem', animation: 'spin 1s linear infinite' }}></i>
          <p style={{ marginTop: '12px' }}>Loading user information...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px' }}>
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h4 className="fw-bold mb-1">System Activity Logs</h4>
      </div>

      {/* User Session Section */}
      <div style={{ 
        backgroundColor: '#ffffff', 
        borderRadius: '10px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        border: '1px solid #eee',
        overflow: 'hidden',
        marginBottom: '20px'
      }}>
        <div style={{ 
          padding: '15px 20px', 
          borderBottom: '1px solid #eee',
          backgroundColor: '#f8f9fa',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#2c3e50' }}>
            <i className="bi bi-person-badge" style={{ marginRight: '8px', color: '#007bff' }}></i>
            CURRENT SESSION
          </h3>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{
              backgroundColor: syncStatus.includes('🟢') ? '#e8f5e9' : 
                              syncStatus.includes('🟡') ? '#fff3e0' : '#fee8e8',
              color: syncStatus.includes('🟢') ? '#2e7d32' : 
                    syncStatus.includes('🟡') ? '#f97316' : '#ef4444',
              padding: '4px 12px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: '500'
            }}>
              {syncStatus || (currentUser ? '🟢 Connected' : '⚪ Not logged in')}
            </span>
            {currentUser && (
              <span style={{
                backgroundColor: '#e8f5e9',
                color: '#2e7d32',
                padding: '4px 12px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: '500'
              }}>
                <i className="bi bi-check-circle-fill" style={{ fontSize: '11px', marginRight: '4px' }}></i>
                Authenticated
              </span>
            )}
          </div>
        </div>
        
        {currentUser ? (
          <div className="user-details" style={{ padding: '20px' }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '16px', 
              marginBottom: '20px',
              padding: '8px 0',
              flexWrap: 'wrap'
            }}>
              <div style={{
                width: '70px',
                height: '70px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #007bff 0%, #6e48e5 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '32px',
                fontWeight: '600',
                boxShadow: '0 4px 15px rgba(0,123,255,0.3)'
              }}>
                {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'A'}
              </div>
              <div>
                <h4 style={{ 
                  margin: '0 0 4px 0', 
                  fontSize: '20px', 
                  fontWeight: '600', 
                  color: '#1a1a1a',
                  lineHeight: '1.2'
                }}>
                  {currentUser.name || 'Admin User'}
                </h4>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                  <p style={{ 
                    margin: 0, 
                    color: '#7f8c8d', 
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <i className="bi bi-envelope-fill" style={{ fontSize: '12px', color: '#007bff' }}></i>
                    {currentUser.email}
                  </p>
                  {currentUser.role && (
                    <span style={{
                      backgroundColor: '#f0f4ff',
                      color: '#007bff',
                      padding: '4px 10px',
                      borderRadius: '20px',
                      fontSize: '12px',
                      fontWeight: '500',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <i className="bi bi-shield-fill-check"></i>
                      {currentUser.role}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="user-section-grid" style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
              gap: '16px',
              marginBottom: '20px'
            }}>
              <div style={{ 
                backgroundColor: '#f8f9fa',
                padding: '15px',
                borderRadius: '8px',
                border: '1px solid #eee'
              }}>
                <div style={{ 
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '12px',
                  color: '#007bff'
                }}>
                  <i className="bi bi-key-fill"></i>
                  <span style={{ fontSize: '12px', fontWeight: '600', color: '#2c3e50' }}>SESSION ID</span>
                </div>
                <div style={{ 
                  fontFamily: 'monospace',
                  fontSize: '13px',
                  color: '#1a1a1a',
                  backgroundColor: '#ffffff',
                  padding: '10px 14px',
                  borderRadius: '6px',
                  border: '1px solid #eee',
                  wordBreak: 'break-all'
                }}>
                  {currentUser.session_id ? (
                    <>
                      <span style={{ color: '#007bff', fontWeight: '500' }}>
                        {currentUser.session_id.substring(0, 8)}
                      </span>
                      <span style={{ color: '#95a5a6' }}>
                        {currentUser.session_id.substring(8, 16)}
                      </span>
                      <span style={{ color: '#7f8c8d', fontSize: '12px', marginLeft: '8px' }}>
                        (active)
                      </span>
                    </>
                  ) : 'No active session ID'}
                </div>
              </div>

              <div style={{ 
                backgroundColor: '#f8f9fa',
                padding: '15px',
                borderRadius: '8px',
                border: '1px solid #eee'
              }}>
                <div style={{ 
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '12px',
                  color: '#f97316'
                }}>
                  <i className="bi bi-clock-history"></i>
                  <span style={{ fontSize: '12px', fontWeight: '600', color: '#2c3e50' }}>LAST LOGIN</span>
                </div>
                <div style={{ 
                  fontSize: '14px',
                  color: '#1a1a1a',
                  fontWeight: '500',
                  backgroundColor: '#ffffff',
                  padding: '10px 14px',
                  borderRadius: '6px',
                  border: '1px solid #eee'
                }}>
                  {formatLastLogin(currentUser.last_login)}
                </div>
              </div>

              <div style={{ 
                backgroundColor: '#f8f9fa',
                padding: '15px',
                borderRadius: '8px',
                border: '1px solid #eee'
              }}>
                <div style={{ 
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '12px',
                  color: '#10b981'
                }}>
                  <i className="bi bi-stopwatch"></i>
                  <span style={{ fontSize: '12px', fontWeight: '600', color: '#2c3e50' }}>SESSION DURATION</span>
                </div>
                <div style={{ 
                  fontSize: '14px',
                  color: '#1a1a1a',
                  fontWeight: '500',
                  backgroundColor: '#ffffff',
                  padding: '10px 14px',
                  borderRadius: '6px',
                  border: '1px solid #eee'
                }}>
                  {getSessionDuration()}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ padding: '48px 24px', textAlign: 'center' }}>
            <div style={{
              width: '100px',
              height: '100px',
              borderRadius: '50%',
              backgroundColor: '#f8f9fa',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px'
            }}>
              <i className="bi bi-person-x" style={{ fontSize: '48px', color: '#95a5a6' }}></i>
            </div>
            <h4 style={{ margin: '0 0 10px 0', color: '#1a1a1a', fontSize: '18px' }}>No Active Session</h4>
            <p style={{ color: '#7f8c8d', margin: '0 0 8px 0' }}>Please log in to view system logs</p>
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div style={{
          marginBottom: '16px',
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
              fontSize: '18px'
            }}
          >
            &times;
          </button>
        </div>
      )}

      {/* System Logs Section */}
      {currentUser && (
        <div style={{ 
          backgroundColor: '#ffffff',
          borderRadius: '10px',
          border: '1px solid #eee',
          overflow: 'hidden'
        }}>
          {/* Filter and Sort Controls */}
          <div style={{ 
            padding: '15px 20px',
            borderBottom: '1px solid #eee',
            backgroundColor: '#f8f9fa'
          }}>
            <div className="filter-controls" style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              flexWrap: 'wrap', 
              gap: '12px',
              marginBottom: '12px'
            }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#2c3e50' }}>
                <i className="bi bi-journal-text" style={{ marginRight: '8px', color: '#007bff' }}></i>
                ACTIVITY LOGS
                {pagination.total > 0 && (
                  <span style={{ 
                    marginLeft: '12px',
                    fontSize: '12px',
                    fontWeight: 'normal',
                    color: '#7f8c8d'
                  }}>
                    (Showing {activities.length} of {pagination.total})
                  </span>
                )}
              </h3>
              
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => setShowColorCustomizer(true)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '20px',
                    border: '1px solid #ddd',
                    backgroundColor: 'white',
                    color: '#8b5cf6',
                    fontSize: '12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                  title="Customize colors"
                >
                  <i className="bi bi-palette"></i>
                  Colors
                </button>
                
                <button
                  onClick={() => setShowArchivedLogs(true)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '20px',
                    border: '1px solid #ddd',
                    backgroundColor: 'white',
                    color: '#f97316',
                    fontSize: '12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <i className="bi bi-archive"></i>
                  Archived Logs
                </button>

                <button
                  onClick={() => setShowLoadModal(true)}
                  disabled={loadingFromDb || !navigator.onLine}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '20px',
                    border: '1px solid #ddd',
                    backgroundColor: loadingFromDb ? '#e9ecef' : 'white',
                    color: '#10b981',
                    fontSize: '12px',
                    fontWeight: '500',
                    cursor: loadingFromDb ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                  title="Load activities from database (preserves existing)"
                >
                  <i className={`bi ${loadingFromDb ? 'bi-arrow-repeat spin' : 'bi-database-down'}`}></i>
                  {loadingFromDb ? 'Loading...' : 'Load from DB'}
                </button>

                <button
                  onClick={handleSync}
                  disabled={isSyncing}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '20px',
                    border: '1px solid #ddd',
                    backgroundColor: isSyncing ? '#e9ecef' : 'white',
                    color: '#007bff',
                    fontSize: '12px',
                    fontWeight: '500',
                    cursor: isSyncing ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <i className={`bi ${isSyncing ? 'bi-arrow-repeat spin' : 'bi-cloud-arrow-up'}`}></i>
                  {isSyncing ? 'Syncing...' : 'Sync'}
                </button>
              </div>
            </div>

            {/* Search bar */}
            <form onSubmit={handleSearch} style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search activities... (Ctrl+F)"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: '20px',
                    border: '1px solid #ddd',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                />
                <button
                  type="submit"
                  style={{
                    padding: '8px 16px',
                    borderRadius: '20px',
                    border: 'none',
                    backgroundColor: '#007bff',
                    color: 'white',
                    fontSize: '14px',
                    cursor: 'pointer'
                  }}
                >
                  <i className="bi bi-search"></i>
                </button>
              </div>
            </form>

            {/* Filter controls */}
            <div className="filter-controls" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'wrap' }}>
                <select
                  value={sortBy}
                  onChange={(e) => handleSortChange(e.target.value)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '20px',
                    border: '1px solid #ddd',
                    backgroundColor: 'white',
                    color: '#475569',
                    fontSize: '12px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    outline: 'none'
                  }}
                >
                  <option value="date">Sort by Date</option>
                  <option value="category">Sort by Category</option>
                  <option value="user">Sort by User</option>
                </select>
                
                <button
                  onClick={toggleSortDirection}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '20px',
                    border: '1px solid #ddd',
                    backgroundColor: 'white',
                    color: '#475569',
                    fontSize: '12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                  title={sortDirection === 'desc' ? 'Newest first' : 'Oldest first'}
                >
                  <i className={`bi bi-arrow-${sortDirection === 'desc' ? 'down' : 'up'}`}></i>
                  {sortDirection === 'desc' ? 'Newest' : 'Oldest'}
                </button>
              </div>

              <select
                value={categoryFilter}
                onChange={(e) => handleCategoryChange(e.target.value)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '20px',
                  border: '1px solid #ddd',
                  backgroundColor: 'white',
                  color: '#475569',
                  fontSize: '12px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  outline: 'none'
                }}
              >
                {getCategories().map(cat => (
                  <option key={cat} value={cat}>
                    {getCategoryDisplayName(cat)}
                  </option>
                ))}
              </select>

              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                {['all', 'today', 'week'].map((filterOption) => (
                  <button
                    key={filterOption}
                    onClick={() => handleFilterChange(filterOption)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '20px',
                      border: 'none',
                      backgroundColor: filter === filterOption ? '#007bff' : '#e9ecef',
                      color: filter === filterOption ? 'white' : '#475569',
                      fontSize: '12px',
                      fontWeight: '500',
                      cursor: 'pointer'
                    }}
                  >
                    {filterOption.charAt(0).toUpperCase() + filterOption.slice(1)}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginLeft: 'auto' }}>
                <button
                  onClick={toggleSelectionMode}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '20px',
                    border: '1px solid #ddd',
                    backgroundColor: selectionMode ? '#007bff' : 'white',
                    color: selectionMode ? 'white' : '#475569',
                    fontSize: '12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <i className={`bi ${selectionMode ? 'bi-check-square' : 'bi-square'}`}></i>
                  {selectionMode ? 'Selection Mode On' : 'Select'}
                </button>

                <div style={{ position: 'relative' }}>
                  <button
                    onClick={() => setShowExportMenu(!showExportMenu)}
                    disabled={activities.length === 0}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '20px',
                      border: '1px solid #ddd',
                      backgroundColor: 'white',
                      color: '#10b981',
                      fontSize: '12px',
                      cursor: activities.length === 0 ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      opacity: activities.length === 0 ? 0.5 : 1
                    }}
                  >
                    <i className="bi bi-download"></i>
                    Export
                    <i className="bi bi-chevron-down" style={{ fontSize: '10px' }}></i>
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
                      border: '1px solid #ddd',
                      zIndex: 10,
                      minWidth: '150px'
                    }}>
                      <div
                        onClick={() => handleExport('csv')}
                        style={{
                          padding: '10px 16px',
                          cursor: 'pointer',
                          borderBottom: '1px solid #eee',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          color: '#1a1a1a',
                          fontSize: '13px'
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
                          gap: '8px',
                          color: '#1a1a1a',
                          fontSize: '13px'
                        }}
                      >
                        <i className="bi bi-file-earmark-code" style={{ color: '#f97316' }}></i>
                        Export as JSON
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => setShowDatePicker(!showDatePicker)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '20px',
                    border: '1px solid #ddd',
                    backgroundColor: filter === 'custom' ? '#007bff' : 'white',
                    color: filter === 'custom' ? 'white' : '#475569',
                    fontSize: '12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <i className="bi bi-calendar-range"></i>
                  {filter === 'custom' && customDateRange.startDate ? 
                    `${customDateRange.startDate} to ${customDateRange.endDate}` : 
                    'Custom Range'}
                </button>

                <button
                  onClick={generateTimeline}
                  disabled={activities.length === 0}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '20px',
                    border: '1px solid #ddd',
                    backgroundColor: showTimelineView ? '#007bff' : 'white',
                    color: showTimelineView ? 'white' : '#475569',
                    fontSize: '12px',
                    cursor: activities.length === 0 ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    opacity: activities.length === 0 ? 0.5 : 1
                  }}
                >
                  <i className="bi bi-bar-chart"></i>
                  Timeline
                </button>
              </div>
            </div>

            {/* Bulk Actions Bar */}
            {selectedActivities.size > 0 && (
              <div className="bulk-actions-bar" style={{
                marginTop: '12px',
                padding: '8px 12px',
                backgroundColor: '#e8f0fe',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px'
              }}>
                <span style={{ color: '#007bff', fontWeight: '500', fontSize: '13px' }}>
                  <i className="bi bi-check-circle-fill" style={{ marginRight: '8px' }}></i>
                  {selectedActivities.size} item{selectedActivities.size > 1 ? 's' : ''} selected
                </span>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    onClick={toggleSelectAll}
                    style={{
                      padding: '4px 12px',
                      borderRadius: '16px',
                      border: '1px solid #007bff',
                      backgroundColor: 'white',
                      color: '#007bff',
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    {selectedActivities.size === activities.length ? 'Deselect All' : 'Select All'}
                  </button>
                  <button
                    onClick={() => handleBulkExport('csv')}
                    style={{
                      padding: '4px 12px',
                      borderRadius: '16px',
                      border: '1px solid #10b981',
                      backgroundColor: 'white',
                      color: '#10b981',
                      fontSize: '12px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <i className="bi bi-download"></i>
                    Export
                  </button>
                  <button
                    onClick={handleArchiveSelected}
                    style={{
                      padding: '4px 12px',
                      borderRadius: '16px',
                      border: '1px solid #f97316',
                      backgroundColor: 'white',
                      color: '#f97316',
                      fontSize: '12px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <i className="bi bi-archive"></i>
                    Archive Logs
                  </button>
                </div>
              </div>
            )}

            {/* Date Range Picker Modal */}
            {showDatePicker && (
              <div style={{
                marginTop: '12px',
                padding: '16px',
                backgroundColor: '#f8f9fa',
                borderRadius: '8px',
                border: '1px solid #eee'
              }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div>
                    <label style={{ fontSize: '12px', color: '#7f8c8d', display: 'block', marginBottom: '4px' }}>
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={customDateRange.startDate}
                      onChange={(e) => setCustomDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                      style={{
                        padding: '8px',
                        borderRadius: '6px',
                        border: '1px solid #ddd',
                        fontSize: '13px'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', color: '#7f8c8d', display: 'block', marginBottom: '4px' }}>
                      End Date
                    </label>
                    <input
                      type="date"
                      value={customDateRange.endDate}
                      onChange={(e) => setCustomDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                      style={{
                        padding: '8px',
                        borderRadius: '6px',
                        border: '1px solid #ddd',
                        fontSize: '13px'
                      }}
                    />
                  </div>
                  <button
                    onClick={handleDateRangeFilter}
                    disabled={!customDateRange.startDate || !customDateRange.endDate}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '6px',
                      border: 'none',
                      backgroundColor: (!customDateRange.startDate || !customDateRange.endDate) ? '#95a5a6' : '#007bff',
                      color: 'white',
                      cursor: (!customDateRange.startDate || !customDateRange.endDate) ? 'not-allowed' : 'pointer',
                      fontSize: '13px'
                    }}
                  >
                    Apply Range
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Activities list with infinite scroll and grouping */}
          <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
            {activities.length > 0 ? (
              <>
                {Object.entries(groupActivitiesByDate(activities)).map(([groupName, groupActivities]) => {
                  if (groupActivities.length === 0) return null;
                  
                  const groupLabels = {
                    today: 'Today',
                    yesterday: 'Yesterday',
                    thisWeek: 'This Week',
                    lastWeek: 'Last Week',
                    thisMonth: 'This Month',
                    older: 'Older'
                  };

                  return (
                    <div key={groupName}>
                      {/* Sticky Header */}
                      <div style={{
                        position: 'sticky',
                        top: 0,
                        backgroundColor: '#f8f9fa',
                        padding: '8px 20px',
                        borderBottom: '2px solid #007bff',
                        borderTop: groupName !== 'today' ? '1px solid #eee' : 'none',
                        zIndex: 5
                      }}>
                        <h4 style={{
                          margin: 0,
                          fontSize: '12px',
                          fontWeight: '600',
                          color: '#007bff',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}>
                          {groupLabels[groupName]} 
                          <span style={{
                            marginLeft: '8px',
                            color: '#7f8c8d',
                            fontWeight: 'normal'
                          }}>
                            ({groupActivities.length})
                          </span>
                        </h4>
                      </div>

                      {/* Group Activities */}
                      {groupActivities.map((activity, index) => (
                        <div
                          key={activity._id || activity.id}
                          ref={(index === groupActivities.length - 1 && 
                                groupName === Object.keys(groupActivitiesByDate(activities))
                                  .filter(g => groupActivitiesByDate(activities)[g].length > 0)
                                  .pop()) ? lastActivityRef : null}                         
                          onMouseEnter={(e) => handleActivityHover(activity, e)}
                          onMouseLeave={handleActivityLeave}
                          onContextMenu={(e) => handleContextMenu(e, activity)}
                          className="activity-item"
                          style={{
                            padding: window.innerWidth < 768 ? '12px' : '15px 20px',
                            borderBottom: index < groupActivities.length - 1 ? '1px solid #eee' : 'none',
                            backgroundColor: selectionMode && selectedActivities.has(activity._id || activity.id) 
                              ? '#e8f0fe' 
                              : !activity.synced 
                                ? '#fff9e6' 
                                : 'white',
                            display: 'flex',
                            alignItems: window.innerWidth < 768 ? 'flex-start' : 'center',
                            gap: '12px',
                            transition: 'background-color 0.2s',
                            cursor: 'pointer',
                            position: 'relative',
                            flexDirection: window.innerWidth < 768 ? 'column' : 'row'
                          }}
                          onClick={() => viewActivityDetails(activity)}
                        >
                          {/* Selection checkbox */}
                          {selectionMode && (
                            <div onClick={(e) => e.stopPropagation()} style={{ paddingTop: '10px' }}>
                              <input
                                type="checkbox"
                                checked={selectedActivities.has(activity._id || activity.id)}
                                onChange={() => toggleSelectActivity(activity._id || activity.id)}
                                style={{
                                  width: '18px',
                                  height: '18px',
                                  cursor: 'pointer'
                                }}
                              />
                            </div>
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
                            fontSize: '18px',
                            flexShrink: 0
                          }}>
                            <i className={getActionIcon(activity.action)}></i>
                          </div>

                          <div style={{ flex: 1, width: '100%' }}>
                            <div style={{ 
                              display: 'flex', 
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              marginBottom: '4px',
                              flexWrap: 'wrap',
                              gap: '8px'
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                <strong style={{ color: '#1a1a1a', fontSize: '14px' }}>{activity.user}</strong>
                                
                                {activity.category && (
                                  <span style={{ 
                                    backgroundColor: getCategoryColor(activity.category).bg,
                                    color: getCategoryColor(activity.category).text,
                                    padding: '2px 8px',
                                    borderRadius: '12px',
                                    fontSize: '11px',
                                    fontWeight: '600',
                                    border: `1px solid ${getCategoryColor(activity.category).border}`,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.3px'
                                  }}>
                                    {activity.category}
                                  </span>
                                )}
                                
                                <span style={{ color: '#7f8c8d', fontSize: '13px' }}>
                                  {activity.action}
                                </span>
                                {activity.details && (
                                  <span style={{ 
                                    backgroundColor: '#f8f9fa',
                                    padding: '2px 8px',
                                    borderRadius: '12px',
                                    fontSize: '12px',
                                    color: '#475569'
                                  }}>
                                    {activity.details}
                                  </span>
                                )}
                                
                                {activity.synced ? (
                                  <span style={{ 
                                    backgroundColor: '#e6f7e6',
                                    color: '#0a5c0a',
                                    padding: '2px 8px',
                                    borderRadius: '12px',
                                    fontSize: '11px',
                                    fontWeight: '600',
                                    border: '1px solid #0a5c0a'
                                  }}>
                                    ✓ Synced
                                  </span>
                                ) : (
                                  <span style={{ 
                                    backgroundColor: '#ffedd5',
                                    color: '#9a3412',
                                    padding: '2px 8px',
                                    borderRadius: '12px',
                                    fontSize: '11px',
                                    fontWeight: '600'
                                  }}>
                                    ⏳ Pending sync
                                  </span>
                                )}
                              </div>
                              <span style={{ 
                                fontSize: '12px',
                                color: '#95a5a6',
                                whiteSpace: 'nowrap'
                              }}>
                                {formatTimestamp(activity.timestamp)}
                              </span>
                            </div>
                            
                            <div style={{ 
                              display: 'flex',
                              gap: '12px',
                              fontSize: '12px',
                              color: '#95a5a6',
                              flexWrap: 'wrap'
                            }}>
                              <span>
                                <i className="bi bi-envelope" style={{ marginRight: '4px' }}></i>
                                {activity.userEmail}
                              </span>
                              <span>
                                <i className="bi bi-geo-alt" style={{ marginRight: '4px' }}></i>
                                {activity.ip || '127.0.0.1'}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
                
                {/* Loading more indicator */}
                {loadingMore && (
                  <div style={{ textAlign: 'center', padding: '20px', color: '#95a5a6', fontSize: '13px' }}>
                    <i className="bi bi-arrow-repeat spin" style={{ marginRight: '8px' }}></i>
                    Loading more activities...
                  </div>
                )}
                
                {/* End of list message */}
                {!pagination.hasMore && activities.length > 0 && (
                  <div style={{ 
                    textAlign: 'center', 
                    padding: '20px', 
                    color: '#95a5a6',
                    borderTop: '1px solid #eee',
                    fontSize: '13px'
                  }}>
                    <i className="bi bi-check-circle" style={{ marginRight: '8px' }}></i>
                    You've seen all activities
                  </div>
                )}
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: '#95a5a6' }}>
                <i className="bi bi-journal-x" style={{ fontSize: '48px', opacity: 0.5 }}></i>
                <p style={{ marginTop: '16px', fontSize: '14px' }}>
                  No activity logs recorded yet
                </p>
                <p style={{ fontSize: '12px' }}>
                  Only create, update, delete, and maintenance actions are logged
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          {activities.length > 0 && (
            <div style={{ 
              padding: '12px 20px',
              borderTop: '1px solid #eee',
              backgroundColor: '#f8f9fa',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '13px',
              color: '#7f8c8d',
              flexWrap: 'wrap',
              gap: '12px'
            }}>
              <div>
                <i className="bi bi-clock me-1"></i>
                Page {pagination.page} of {pagination.totalPages} | 
                <span style={{ marginLeft: '8px' }}>
                  <i className="bi bi-sort-down me-1"></i>
                  Sorted by {sortBy} ({sortDirection === 'desc' ? 'newest' : 'oldest'} first)
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Load from Database Modal */}
      {showLoadModal && (
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
          zIndex: 1000
        }} onClick={() => setShowLoadModal(false)}>
          <div className="modal-content" style={{
            backgroundColor: 'white',
            borderRadius: '10px',
            padding: '24px',
            maxWidth: '400px',
            width: '90%',
            boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
          }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 16px 0', color: '#1a1a1a', fontSize: '18px' }}>
              <i className="bi bi-database" style={{ marginRight: '8px', color: '#10b981' }}></i>
              Load from Database
            </h3>
            <p style={{ color: '#475569', marginBottom: '24px', fontSize: '14px' }}>
              This will load all activities from the database and merge them with your current display. 
              No existing logs will be removed.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowLoadModal(false)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: '1px solid #ddd',
                  backgroundColor: 'white',
                  color: '#475569',
                  cursor: 'pointer',
                  fontSize: '13px'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleLoadFromDatabase}
                disabled={loadingFromDb}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: loadingFromDb ? '#95a5a6' : '#10b981',
                  color: 'white',
                  cursor: loadingFromDb ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '13px'
                }}
              >
                {loadingFromDb ? (
                  <>
                    <i className="bi bi-arrow-repeat spin"></i>
                    Loading...
                  </>
                ) : (
                  <>
                    <i className="bi bi-check-lg"></i>
                    Confirm Load
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {showDetailsModal && selectedActivity && (
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
          zIndex: 1000
        }} onClick={() => setShowDetailsModal(false)}>
          <div className="modal-content" style={{
            backgroundColor: 'white',
            borderRadius: '10px',
            padding: '24px',
            maxWidth: '500px',
            width: '90%',
            maxHeight: '80vh',
            overflowY: 'auto',
            boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, color: '#1a1a1a', fontSize: '18px' }}>
                <i className="bi bi-info-circle" style={{ marginRight: '8px', color: '#007bff' }}></i>
                Activity Details
              </h3>
              <button
                onClick={() => setShowDetailsModal(false)}
                style={{
                  border: 'none',
                  background: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#7f8c8d'
                }}
              >
                &times;
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  backgroundColor: getCategoryColor(selectedActivity.category).bg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: getCategoryColor(selectedActivity.category).text,
                  fontSize: '24px'
                }}>
                  <i className={getActionIcon(selectedActivity.action)}></i>
                </div>
                <div>
                  <div style={{ fontSize: '16px', fontWeight: '600', color: '#1a1a1a' }}>
                    {selectedActivity.action}
                  </div>
                  <div style={{ fontSize: '12px', color: '#7f8c8d' }}>
                    {new Date(selectedActivity.timestamp).toLocaleString()}
                  </div>
                </div>
              </div>

              <div style={{ 
                backgroundColor: '#f8f9fa',
                padding: '16px',
                borderRadius: '8px',
                border: '1px solid #eee'
              }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    <tr>
                      <td style={{ padding: '8px 0', color: '#7f8c8d', width: '120px', fontSize: '13px' }}>User:</td>
                      <td style={{ padding: '8px 0', color: '#1a1a1a', fontWeight: '500', fontSize: '13px' }}>{selectedActivity.user}</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '8px 0', color: '#7f8c8d', fontSize: '13px' }}>Email:</td>
                      <td style={{ padding: '8px 0', color: '#1a1a1a', fontSize: '13px' }}>{selectedActivity.userEmail}</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '8px 0', color: '#7f8c8d', fontSize: '13px' }}>Category:</td>
                      <td style={{ padding: '8px 0' }}>
                        <span style={{
                          backgroundColor: getCategoryColor(selectedActivity.category).bg,
                          color: getCategoryColor(selectedActivity.category).text,
                          padding: '4px 12px',
                          borderRadius: '16px',
                          fontSize: '12px',
                          fontWeight: '500',
                          border: `1px solid ${getCategoryColor(selectedActivity.category).border}`
                        }}>
                          {selectedActivity.category}
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: '8px 0', color: '#7f8c8d', fontSize: '13px' }}>IP Address:</td>
                      <td style={{ padding: '8px 0', color: '#1a1a1a', fontSize: '13px' }}>{selectedActivity.ip || '127.0.0.1'}</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '8px 0', color: '#7f8c8d', fontSize: '13px' }}>Sync Status:</td>
                      <td style={{ padding: '8px 0' }}>
                        <span style={{
                          backgroundColor: selectedActivity.synced ? '#e8f5e9' : '#ffedd5',
                          color: selectedActivity.synced ? '#2e7d32' : '#9a3412',
                          padding: '4px 12px',
                          borderRadius: '16px',
                          fontSize: '12px'
                        }}>
                          {selectedActivity.synced ? 'Synced' : 'Pending'}
                        </span>
                      </td>
                    </tr>
                    {selectedActivity.details && (
                      <tr>
                        <td style={{ padding: '8px 0', color: '#7f8c8d', verticalAlign: 'top', fontSize: '13px' }}>Details:</td>
                        <td style={{ padding: '8px 0', color: '#1a1a1a', whiteSpace: 'pre-wrap', fontSize: '13px' }}>
                          {selectedActivity.details}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => {
                    exportActivitiesToJSON([selectedActivity], `activity-${selectedActivity.id}.json`);
                  }}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: '1px solid #10b981',
                    backgroundColor: 'white',
                    color: '#10b981',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '13px'
                  }}
                >
                  <i className="bi bi-download"></i>
                  Export
                </button>
                <button
                  onClick={() => setShowDetailsModal(false)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: '#007bff',
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: '13px'
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Save Filter Modal */}
      {showSaveFilterModal && (
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
          zIndex: 1000
        }} onClick={() => setShowSaveFilterModal(false)}>
          <div className="modal-content" style={{
            backgroundColor: 'white',
            borderRadius: '10px',
            padding: '24px',
            maxWidth: '400px',
            width: '90%',
            boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
          }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 16px 0', color: '#1a1a1a', fontSize: '18px' }}>
              <i className="bi bi-bookmark-plus" style={{ marginRight: '8px', color: '#8b5cf6' }}></i>
              Save Current Filter
            </h3>
            
            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '13px', color: '#475569', display: 'block', marginBottom: '4px' }}>
                Filter Name
              </label>
              <input
                type="text"
                value={filterName}
                onChange={(e) => setFilterName(e.target.value)}
                placeholder="e.g., Today's Updates, Last Week's Deletes"
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '6px',
                  border: '1px solid #ddd',
                  fontSize: '14px'
                }}
                autoFocus
              />
            </div>

            <div style={{
              backgroundColor: '#f8f9fa',
              padding: '12px',
              borderRadius: '6px',
              marginBottom: '20px'
            }}>
              <div style={{ fontSize: '12px', color: '#7f8c8d', marginBottom: '4px' }}>Current filter settings:</div>
              <div style={{ fontSize: '13px', color: '#1a1a1a' }}>
                • Filter: {filter === 'all' ? 'All time' : filter === 'today' ? 'Today' : filter === 'week' ? 'This week' : 'Custom range'}<br />
                • Category: {categoryFilter === 'all' ? 'All' : categoryFilter}<br />
                • Sort: {sortBy} ({sortDirection})<br />
                {searchTerm && `• Search: "${searchTerm}"`}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowSaveFilterModal(false)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: '1px solid #ddd',
                  backgroundColor: 'white',
                  color: '#475569',
                  cursor: 'pointer',
                  fontSize: '13px'
                }}
              >
                Cancel
              </button>
              <button
                onClick={saveCurrentFilter}
                disabled={!filterName.trim()}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: !filterName.trim() ? '#95a5a6' : '#8b5cf6',
                  color: 'white',
                  cursor: !filterName.trim() ? 'not-allowed' : 'pointer',
                  fontSize: '13px'
                }}
              >
                Save Filter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Timeline View Modal */}
      {showTimelineView && timelineData.length > 0 && (
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
          zIndex: 1000
        }} onClick={() => setShowTimelineView(false)}>
          <div className="modal-content" style={{
            backgroundColor: 'white',
            borderRadius: '10px',
            padding: '24px',
            maxWidth: '800px',
            width: '90%',
            maxHeight: '80vh',
            overflowY: 'auto',
            boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
              <h3 style={{ margin: 0, color: '#1a1a1a', fontSize: '18px' }}>
                <i className="bi bi-bar-chart" style={{ marginRight: '8px', color: '#007bff' }}></i>
                Activity Timeline
              </h3>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <select
                  value={timelineGroupBy}
                  onChange={(e) => {
                    setTimelineGroupBy(e.target.value);
                    const timeline = getActivityTimeline(activities, e.target.value);
                    setTimelineData(timeline);
                  }}
                  style={{
                    padding: '4px 8px',
                    borderRadius: '6px',
                    border: '1px solid #ddd',
                    fontSize: '12px'
                  }}
                >
                  <option value="hour">By Hour</option>
                  <option value="day">By Day</option>
                  <option value="week">By Week</option>
                  <option value="month">By Month</option>
                </select>
                <button
                  onClick={() => setShowTimelineView(false)}
                  style={{
                    border: 'none',
                    background: 'none',
                    fontSize: '24px',
                    cursor: 'pointer',
                    color: '#7f8c8d'
                  }}
                >
                  &times;
                </button>
              </div>
            </div>

            <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
              {timelineData.map((item, index) => (
                <div key={item.date} style={{ marginBottom: '16px' }}>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '4px',
                    flexWrap: 'wrap',
                    gap: '8px'
                  }}>
                    <span style={{ fontWeight: '600', color: '#1a1a1a', fontSize: '13px' }}>{item.date}</span>
                    <span style={{ fontSize: '12px', color: '#007bff', fontWeight: '500' }}>
                      Total: {item.total}
                    </span>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '4px', height: '30px' }}>
                    {item.categories.create > 0 && (
                      <div style={{
                        width: `${(item.categories.create / item.total) * 100}%`,
                        backgroundColor: categoryColors.create.bg,
                        border: `1px solid ${categoryColors.create.border}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: categoryColors.create.text,
                        fontSize: '11px',
                        fontWeight: '600',
                        borderRadius: '4px 0 0 4px'
                      }}>
                        {item.categories.create}
                      </div>
                    )}
                    {item.categories.update > 0 && (
                      <div style={{
                        width: `${(item.categories.update / item.total) * 100}%`,
                        backgroundColor: categoryColors.update.bg,
                        border: `1px solid ${categoryColors.update.border}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: categoryColors.update.text,
                        fontSize: '11px',
                        fontWeight: '600'
                      }}>
                        {item.categories.update}
                      </div>
                    )}
                    {item.categories.delete > 0 && (
                      <div style={{
                        width: `${(item.categories.delete / item.total) * 100}%`,
                        backgroundColor: categoryColors.delete.bg,
                        border: `1px solid ${categoryColors.delete.border}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: categoryColors.delete.text,
                        fontSize: '11px',
                        fontWeight: '600'
                      }}>
                        {item.categories.delete}
                      </div>
                    )}
                    {item.categories.maintenance > 0 && (
                      <div style={{
                        width: `${(item.categories.maintenance / item.total) * 100}%`,
                        backgroundColor: categoryColors.maintenance.bg,
                        border: `1px solid ${categoryColors.maintenance.border}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: categoryColors.maintenance.text,
                        fontSize: '11px',
                        fontWeight: '600'
                      }}>
                        {item.categories.maintenance}
                      </div>
                    )}
                    {item.categories.auth > 0 && (
                      <div style={{
                        width: `${(item.categories.auth / item.total) * 100}%`,
                        backgroundColor: categoryColors.auth.bg,
                        border: `1px solid ${categoryColors.auth.border}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: categoryColors.auth.text,
                        fontSize: '11px',
                        fontWeight: '600'
                      }}>
                        {item.categories.auth}
                      </div>
                    )}
                    {item.categories.other > 0 && (
                      <div style={{
                        width: `${(item.categories.other / item.total) * 100}%`,
                        backgroundColor: categoryColors.other.bg,
                        border: `1px solid ${categoryColors.other.border}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: categoryColors.other.text,
                        fontSize: '11px',
                        fontWeight: '600',
                        borderRadius: '0 4px 4px 0'
                      }}>
                        {item.categories.other}
                      </div>
                    )}
                  </div>

                  {index === 0 && (
                    <div style={{ 
                      display: 'flex', 
                      gap: '12px', 
                      marginTop: '8px',
                      fontSize: '10px',
                      color: '#7f8c8d',
                      flexWrap: 'wrap'
                    }}>
                      <span><span style={{ color: categoryColors.create.text }}>■</span> Create</span>
                      <span><span style={{ color: categoryColors.update.text }}>■</span> Update</span>
                      <span><span style={{ color: categoryColors.delete.text }}>■</span> Delete</span>
                      <span><span style={{ color: categoryColors.maintenance.text }}>■</span> Maintenance</span>
                      <span><span style={{ color: categoryColors.auth.text }}>■</span> Auth</span>
                      <span><span style={{ color: categoryColors.other.text }}>■</span> Other</span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button
                onClick={() => setShowTimelineView(false)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: '#007bff',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '13px'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts Help Modal */}
      {showShortcutsHelp && (
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
          zIndex: 2000
        }} onClick={() => setShowShortcutsHelp(false)}>
          <div className="modal-content" style={{
            backgroundColor: 'white',
            borderRadius: '10px',
            padding: '24px',
            maxWidth: '500px',
            width: '90%',
            maxHeight: '80vh',
            overflowY: 'auto'
          }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 20px 0', color: '#1a1a1a', fontSize: '18px' }}>
              <i className="bi bi-keyboard" style={{ marginRight: '8px', color: '#007bff' }}></i>
              Keyboard Shortcuts
            </h3>
            
            <div style={{ display: 'grid', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #eee', flexWrap: 'wrap', gap: '8px', fontSize: '13px' }}>
                <span><kbd style={{ background: '#f8f9fa', padding: '2px 6px', borderRadius: '4px', fontSize: '12px' }}>Ctrl+F</kbd></span>
                <span>Focus search</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #eee', flexWrap: 'wrap', gap: '8px', fontSize: '13px' }}>
                <span><kbd style={{ background: '#f8f9fa', padding: '2px 6px', borderRadius: '4px', fontSize: '12px' }}>Ctrl+E</kbd></span>
                <span>Export current view</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #eee', flexWrap: 'wrap', gap: '8px', fontSize: '13px' }}>
                <span><kbd style={{ background: '#f8f9fa', padding: '2px 6px', borderRadius: '4px', fontSize: '12px' }}>Ctrl+D</kbd></span>
                <span>Toggle selection mode</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #eee', flexWrap: 'wrap', gap: '8px', fontSize: '13px' }}>
                <span><kbd style={{ background: '#f8f9fa', padding: '2px 6px', borderRadius: '4px', fontSize: '12px' }}>Ctrl+A</kbd></span>
                <span>Select all (in selection mode)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #eee', flexWrap: 'wrap', gap: '8px', fontSize: '13px' }}>
                <span><kbd style={{ background: '#f8f9fa', padding: '2px 6px', borderRadius: '4px', fontSize: '12px' }}>Esc</kbd></span>
                <span>Close modals</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #eee', flexWrap: 'wrap', gap: '8px', fontSize: '13px' }}>
                <span><kbd style={{ background: '#f8f9fa', padding: '2px 6px', borderRadius: '4px', fontSize: '12px' }}>?</kbd></span>
                <span>Show this help</span>
              </div>
            </div>
            
            <button
              onClick={() => setShowShortcutsHelp(false)}
              style={{
                width: '100%',
                marginTop: '20px',
                padding: '10px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: '#007bff',
                color: 'white',
                cursor: 'pointer',
                fontSize: '13px'
              }}
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* Hover Preview */}
      {hoveredActivity && (
        <div style={{
          position: 'fixed',
          left: previewPosition.x + 20,
          top: previewPosition.y - 100,
          backgroundColor: 'white',
          borderRadius: '10px',
          padding: '12px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
          border: '1px solid #eee',
          zIndex: 1000,
          minWidth: '280px',
          maxWidth: '350px',
          pointerEvents: 'none',
          animation: 'fadeIn 0.2s ease'
        }}>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '8px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              backgroundColor: getCategoryColor(hoveredActivity.category).bg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: getCategoryColor(hoveredActivity.category).text,
              fontSize: '16px'
            }}>
              <i className={getActionIcon(hoveredActivity.action)}></i>
            </div>
            <div>
              <div style={{ fontWeight: '600', color: '#1a1a1a', fontSize: '13px' }}>{hoveredActivity.action}</div>
              <div style={{ fontSize: '11px', color: '#7f8c8d' }}>{hoveredActivity.user}</div>
            </div>
          </div>
          
          <div style={{ fontSize: '12px', color: '#475569', marginBottom: '8px' }}>
            {hoveredActivity.details || 'No additional details'}
          </div>
          
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between',
            fontSize: '10px',
            color: '#95a5a6',
            borderTop: '1px solid #eee',
            paddingTop: '8px',
            flexWrap: 'wrap',
            gap: '8px'
          }}>
            <span>{new Date(hoveredActivity.timestamp).toLocaleString()}</span>
            <span style={{
              backgroundColor: getCategoryColor(hoveredActivity.category).bg,
              color: getCategoryColor(hoveredActivity.category).text,
              padding: '2px 8px',
              borderRadius: '12px',
              fontSize: '10px',
              fontWeight: '600'
            }}>{hoveredActivity.category}</span>
          </div>
        </div>
      )}

      {/* Context Menu */}
      {contextMenu.show && (
        <div style={{
          position: 'fixed',
          left: contextMenu.x,
          top: contextMenu.y,
          backgroundColor: 'white',
          borderRadius: '8px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          border: '1px solid #eee',
          zIndex: 2000,
          minWidth: '180px',
          animation: 'fadeIn 0.1s ease'
        }}>
          <div
            onClick={() => handleContextMenuAction('copy-action')}
            style={{
              padding: '8px 12px',
              cursor: 'pointer',
              borderBottom: '1px solid #eee',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: '#1a1a1a',
              fontSize: '13px'
            }}
          >
            <i className="bi bi-files" style={{ color: '#007bff' }}></i>
            Copy Action
          </div>
          <div
            onClick={() => handleContextMenuAction('copy-details')}
            style={{
              padding: '8px 12px',
              cursor: 'pointer',
              borderBottom: '1px solid #eee',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: '#1a1a1a',
              fontSize: '13px'
            }}
          >
            <i className="bi bi-files" style={{ color: '#007bff' }}></i>
            Copy Details
          </div>
          <div
            onClick={() => handleContextMenuAction('copy-timestamp')}
            style={{
              padding: '8px 12px',
              cursor: 'pointer',
              borderBottom: '1px solid #eee',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: '#1a1a1a',
              fontSize: '13px'
            }}
          >
            <i className="bi bi-clock" style={{ color: '#f97316' }}></i>
            Copy Timestamp
          </div>
          <div
            onClick={() => handleContextMenuAction('export-single')}
            style={{
              padding: '8px 12px',
              cursor: 'pointer',
              borderBottom: '1px solid #eee',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: '#1a1a1a',
              fontSize: '13px'
            }}
          >
            <i className="bi bi-download" style={{ color: '#10b981' }}></i>
            Export Single
          </div>
          <div
            onClick={() => handleContextMenuAction('delete-single')}
            style={{
              padding: '8px 12px',
              cursor: 'pointer',
              borderBottom: '1px solid #eee',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: '#ef4444',
              fontSize: '13px'
            }}
          >
            <i className="bi bi-trash"></i>
            Delete from Display
          </div>
          <div
            onClick={() => handleContextMenuAction('filter-user')}
            style={{
              padding: '8px 12px',
              cursor: 'pointer',
              borderBottom: '1px solid #eee',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: '#1a1a1a',
              fontSize: '13px'
            }}
          >
            <i className="bi bi-person" style={{ color: '#8b5cf6' }}></i>
            Filter by this User
          </div>
          <div
            onClick={() => handleContextMenuAction('filter-category')}
            style={{
              padding: '8px 12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: '#1a1a1a',
              fontSize: '13px'
            }}
          >
            <i className="bi bi-tag" style={{ color: '#f97316' }}></i>
            Filter by this Category
          </div>
        </div>
      )}

      <ArchivedLogs 
        isOpen={showArchivedLogs}
        onClose={() => setShowArchivedLogs(false)}
        onRestore={(restoredActivity) => {
          loadActivities(1, true);
        }}
      />

      {/* Color Customizer Modal */}
      {showColorCustomizer && (
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
          zIndex: 2000
        }} onClick={() => setShowColorCustomizer(false)}>
          <div className="modal-content" style={{
            backgroundColor: 'white',
            borderRadius: '10px',
            padding: '24px',
            maxWidth: '500px',
            width: '90%',
            maxHeight: '80vh',
            overflowY: 'auto'
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, color: '#1a1a1a', fontSize: '18px' }}>
                <i className="bi bi-palette" style={{ marginRight: '8px', color: '#8b5cf6' }}></i>
                Customize Category Colors
              </h3>
              <button
                onClick={() => setShowColorCustomizer(false)}
                style={{
                  border: 'none',
                  background: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#7f8c8d'
                }}
              >
                &times;
              </button>
            </div>

            {Object.keys(categoryColors).map(category => (
              <div key={category} style={{ marginBottom: '20px', padding: '12px', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#1a1a1a', textTransform: 'capitalize' }}>
                  {category}
                </h4>
                <div style={{ display: 'grid', gap: '12px', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))' }}>
                  <div>
                    <label style={{ fontSize: '11px', color: '#7f8c8d', display: 'block', marginBottom: '4px' }}>Background</label>
                    <input
                      type="color"
                      value={categoryColors[category].bg}
                      onChange={(e) => updateCategoryColor(category, 'bg', e.target.value)}
                      style={{ width: '100%', height: '40px', cursor: 'pointer' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: '#7f8c8d', display: 'block', marginBottom: '4px' }}>Text</label>
                    <input
                      type="color"
                      value={categoryColors[category].text}
                      onChange={(e) => updateCategoryColor(category, 'text', e.target.value)}
                      style={{ width: '100%', height: '40px', cursor: 'pointer' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: '#7f8c8d', display: 'block', marginBottom: '4px' }}>Border</label>
                    <input
                      type="color"
                      value={categoryColors[category].border}
                      onChange={(e) => updateCategoryColor(category, 'border', e.target.value)}
                      style={{ width: '100%', height: '40px', cursor: 'pointer' }}
                    />
                  </div>
                </div>
                <div style={{ marginTop: '8px', padding: '8px', backgroundColor: 'white', borderRadius: '4px' }}>
                  <span style={{ display: 'inline-block', padding: '4px 12px', borderRadius: '16px', backgroundColor: categoryColors[category].bg, color: categoryColors[category].text, border: `1px solid ${categoryColors[category].border}`, fontSize: '11px' }}>
                    Preview: {category}
                  </span>
                </div>
              </div>
            ))}

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button
                onClick={resetColors}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: '1px solid #ddd',
                  backgroundColor: 'white',
                  color: '#475569',
                  cursor: 'pointer',
                  fontSize: '13px'
                }}
              >
                Reset to Defaults
              </button>
              <button
                onClick={() => setShowColorCustomizer(false)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: '#007bff',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '13px'
                }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add spinning animation */}
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
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }
          
          @media (max-width: 768px) {
            .user-details > div:first-child {
              flex-direction: column !important;
              text-align: center !important;
            }
            
            .filter-controls {
              flex-direction: column !important;
              align-items: stretch !important;
            }
            
            .filter-controls > div {
              width: 100% !important;
            }
            
            .filter-controls select,
            .filter-controls button {
              width: 100% !important;
            }
            
            .activity-item {
              flex-direction: column !important;
              align-items: flex-start !important;
            }
            
            .bulk-actions-bar {
              flex-direction: column !important;
              align-items: stretch !important;
            }
          }
        `}
      </style>
    </div>
  );
};

export default Systemlogs;
