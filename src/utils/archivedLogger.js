import LZString from 'lz-string';
import { API_BASE_URL } from '../config';

import LZString from 'lz-string';
import { API_BASE_URL } from '../config';

// ===== PUT DEBUG HERE =====
console.log('API_BASE_URL value:', API_BASE_URL);
console.log('Type of API_BASE_URL:', typeof API_BASE_URL);
// ===== END DEBUG =====

const ARCHIVED_CONFIG = {
  STORAGE_KEYS: {
    ARCHIVED: 'archived_activities'
  },
  LIMITS: {
    MAX_ARCHIVED: 1000,
    PAGE_SIZE: 20
  }
};

// API Configuration
const API_URL = (() => {
  if (!API_BASE_URL) {
    return 'http://localhost:5000/api';
  }
  
  let base = API_BASE_URL.replace(/\/$/, '');
  
  if (base.endsWith('/api')) {
    return base;
  }
  
  return `${base}/api`;
})();

console.log('FINAL API_URL:', API_URL);


/**
 * Get auth token from localStorage
 */
const getAuthToken = () => {
  return localStorage.getItem('authToken');
};

/**
 * Check if user is authenticated
 */
const isAuthenticated = () => {
  return !!getAuthToken() && navigator.onLine;
};

/**
 * Safe JSON parse with error handling
 */
const safeJSONParse = (str, fallback = []) => {
  if (!str) return fallback;
  try {
    return JSON.parse(str);
  } catch (error) {
    console.error('JSON parse error:', error);
    return fallback;
  }
};

/**
 * Safe JSON stringify with error handling
 */
const safeJSONStringify = (obj, fallback = '[]') => {
  try {
    return JSON.stringify(obj);
  } catch (error) {
    console.error('JSON stringify error:', error);
    return fallback;
  }
};

/**
 * Get archived activities from localStorage (fallback)
 */
const getArchivedFromLocalStorage = () => {
  try {
    const compressed = localStorage.getItem(ARCHIVED_CONFIG.STORAGE_KEYS.ARCHIVED);
    if (!compressed) return [];
    
    const decompressed = LZString.decompress(compressed);
    if (!decompressed) return [];
    
    return safeJSONParse(decompressed, []);
  } catch (error) {
    console.error('Error getting archived from storage:', error);
    return [];
  }
};

/**
 * Save archived activities to localStorage (fallback)
 */
const saveArchivedToLocalStorage = (activities) => {
  try {
    if (!Array.isArray(activities)) {
      console.error('Invalid activities array');
      return false;
    }
    
    const jsonString = safeJSONStringify(activities);
    const compressed = LZString.compress(jsonString);
    localStorage.setItem(ARCHIVED_CONFIG.STORAGE_KEYS.ARCHIVED, compressed);
    return true;
  } catch (error) {
    console.error('Error saving archived to storage:', error);
    
    // Handle quota exceeded
    if (error.name === 'QuotaExceededError' || error.code === 22) {
      console.warn('Storage quota exceeded, trimming archived logs...');
      const trimmed = activities.slice(0, ARCHIVED_CONFIG.LIMITS.MAX_ARCHIVED / 2);
      const jsonString = safeJSONStringify(trimmed);
      const compressed = LZString.compress(jsonString);
      localStorage.setItem(ARCHIVED_CONFIG.STORAGE_KEYS.ARCHIVED, compressed);
      return true;
    }
    
    return false;
  }
};

/**
 * Filter activities locally (for fallback)
 */
const filterActivitiesLocally = (activities, filters) => {
  let filtered = [...activities];
  
  if (filters.category && filters.category !== 'all') {
    filtered = filtered.filter(act => act.category === filters.category);
  }
  
  if (filters.search && filters.search.trim()) {
    const searchLower = filters.search.toLowerCase().trim();
    filtered = filtered.filter(act => 
      (act.user && act.user.toLowerCase().includes(searchLower)) ||
      (act.action && act.action.toLowerCase().includes(searchLower)) ||
      (act.details && act.details.toLowerCase().includes(searchLower)) ||
      (act.userEmail && act.userEmail.toLowerCase().includes(searchLower))
    );
  }
  
  if (filters.startDate) {
    const start = new Date(filters.startDate);
    start.setHours(0, 0, 0, 0);
    filtered = filtered.filter(act => {
      const actDate = new Date(act.timestamp);
      return actDate >= start;
    });
  }
  
  if (filters.endDate) {
    const end = new Date(filters.endDate);
    end.setHours(23, 59, 59, 999);
    filtered = filtered.filter(act => {
      const actDate = new Date(act.timestamp);
      return actDate <= end;
    });
  }
  
  return filtered;
};

/**
 * Get all archived activities with pagination and filtering
 */
export const getArchivedActivities = async (page = 1, pageSize = ARCHIVED_CONFIG.LIMITS.PAGE_SIZE, filters = {}) => {
  try {
    // Try to get from API first if authenticated
    if (isAuthenticated()) {
      const queryParams = new URLSearchParams({
        page,
        limit: pageSize
      });
      
      if (filters.category && filters.category !== 'all') {
        queryParams.append('category', filters.category);
      }
      
      if (filters.search && filters.search.trim()) {
        queryParams.append('search', filters.search.trim());
      }
      
      if (filters.startDate) {
        queryParams.append('startDate', filters.startDate);
      }
      
      if (filters.endDate) {
        queryParams.append('endDate', filters.endDate);
      }
      
      const response = await fetch(`${API_URL}/archived-logs?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        return {
          activities: data.activities || [],
          total: data.total || 0,
          page: data.page || page,
          totalPages: data.totalPages || 1,
          hasMore: data.hasMore !== false && (data.page || page) < (data.totalPages || 1)
        };
      }
    }
  } catch (error) {
    console.error('Error fetching archived from API:', error);
  }
  
  // Fallback to localStorage
  console.log('Falling back to localStorage for archived logs');
  let activities = getArchivedFromLocalStorage();
  activities = filterActivitiesLocally(activities, filters);
  
  // Sort by date descending
  activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  
  const total = activities.length;
  const startIndex = (page - 1) * pageSize;
  const paginated = activities.slice(startIndex, startIndex + pageSize);
  
  return {
    activities: paginated,
    total,
    page,
    totalPages: Math.ceil(total / pageSize),
    hasMore: page < Math.ceil(total / pageSize)
  };
};

/**
 * Archive a single activity to database
 */
export const archiveActivity = async (activity) => {
  if (!activity || !activity.id) {
    console.error('Invalid activity for archiving');
    return false;
  }
  
  try {
    // Try to archive via API if authenticated
    if (isAuthenticated()) {
      const response = await fetch(`${API_URL}/system-logs/${activity.id}/archive`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify({ activity })
      });
      
      if (response.ok) {
        console.log(`Activity ${activity.id} archived to database`);
        return true;
      }
    }
  } catch (error) {
    console.error('Error archiving to API:', error);
  }
  
  // Fallback to localStorage
  console.log('Falling back to localStorage for archiving');
  const archived = getArchivedFromLocalStorage();
  
  // Check if already archived
  const alreadyArchived = archived.some(a => a.id === activity.id);
  if (alreadyArchived) {
    console.log(`Activity ${activity.id} already archived, skipping`);
    return true;
  }
  
  // Add archived timestamp
  const archivedActivity = {
    ...activity,
    archivedAt: new Date().toISOString()
  };
  
  // Add to archived (newest first)
  archived.unshift(archivedActivity);
  
  // Enforce size limit
  if (archived.length > ARCHIVED_CONFIG.LIMITS.MAX_ARCHIVED) {
    archived.length = ARCHIVED_CONFIG.LIMITS.MAX_ARCHIVED;
  }
  
  return saveArchivedToLocalStorage(archived);
};

/**
 * Archive multiple activities to database
 */
export const archiveMultipleActivities = async (activities) => {
  if (!activities || !activities.length) return false;
  
  try {
    // Try to archive via API if authenticated
    if (isAuthenticated()) {
      const response = await fetch(`${API_URL}/system-logs/batch-archive`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify({ activities })
      });
      
      if (response.ok) {
        console.log(`Archived ${activities.length} activities to database`);
        return true;
      }
    }
  } catch (error) {
    console.error('Error batch archiving to API:', error);
  }
  
  // Fallback to localStorage
  console.log('Falling back to localStorage for batch archiving');
  const archived = getArchivedFromLocalStorage();
  const existingIds = new Set(archived.map(a => a.id));
  const newActivities = [];
  
  for (const activity of activities) {
    if (!existingIds.has(activity.id)) {
      newActivities.push({
        ...activity,
        archivedAt: new Date().toISOString()
      });
    }
  }
  
  if (newActivities.length === 0) return true;
  
  const updated = [...newActivities, ...archived];
  
  // Enforce size limit
  if (updated.length > ARCHIVED_CONFIG.LIMITS.MAX_ARCHIVED) {
    updated.length = ARCHIVED_CONFIG.LIMITS.MAX_ARCHIVED;
  }
  
  return saveArchivedToLocalStorage(updated);
};

/**
 * Restore an archived activity back to main storage
 */
export const restoreArchivedActivity = async (activityId) => {
  if (!activityId) {
    console.error('No activity ID provided');
    return null;
  }
  
  try {
    // Try to restore via API if authenticated
    if (isAuthenticated()) {
      const response = await fetch(`${API_URL}/archived-logs/${activityId}/restore`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log(`Activity ${activityId} restored from database`);
        return data.activity;
      }
    }
  } catch (error) {
    console.error('Error restoring from API:', error);
  }
  
  // Fallback to localStorage
  console.log('Falling back to localStorage for restoration');
  const archived = getArchivedFromLocalStorage();
  const activityIndex = archived.findIndex(act => act.id === activityId);
  
  if (activityIndex === -1) {
    console.log(`Activity ${activityId} not found in archived`);
    return null;
  }
  
  const restoredActivity = { ...archived[activityIndex] };
  delete restoredActivity.archivedAt;
  delete restoredActivity.archived_at;

  
  // Remove from archived
  archived.splice(activityIndex, 1);
  
  // Save updated archived
  const saveSuccess = saveArchivedToLocalStorage(archived);
  if (!saveSuccess) {
    console.error('Failed to save archived after restoration');
    return null;
  }
  
  // Add back to main activities
  const mainCompressed = localStorage.getItem('system_activities');
  let mainActivities = [];
  
  if (mainCompressed) {
    const decompressed = LZString.decompress(mainCompressed);
    if (decompressed) {
      mainActivities = safeJSONParse(decompressed, []);
    }
  }
  
  // Check if already exists in main
  const alreadyExists = mainActivities.some(a => a.id === restoredActivity.id);
  if (!alreadyExists) {
    mainActivities.unshift(restoredActivity);
  }
  
  // Limit main activities size
  if (mainActivities.length > 200) {
    mainActivities = mainActivities.slice(0, 200);
  }
  
  const mainRecompressed = LZString.compress(safeJSONStringify(mainActivities));
  localStorage.setItem('system_activities', mainRecompressed);
  
  return restoredActivity;
};

/**
 * Restore multiple archived activities with batch processing
 */
export const restoreMultipleArchived = async (activityIds) => {
  if (!activityIds || !activityIds.length) return [];
  
  try {
    // Try to restore via API if authenticated
    if (isAuthenticated()) {
      const response = await fetch(`${API_URL}/archived-logs/batch-restore`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify({ logIds: activityIds })
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log(`Restored ${data.restored_count} activities from database`);
        return data.restored_logs || [];
      }
    }
  } catch (error) {
    console.error('Error batch restoring from API:', error);
  }
  
  // Fallback to localStorage
  console.log('Falling back to localStorage for batch restoration');
  const archived = getArchivedFromLocalStorage();
  const restored = [];
  
  // Process in batches to avoid blocking UI
  const batchSize = 10;
  const results = [];
  
  for (let i = 0; i < activityIds.length; i += batchSize) {
    const batch = activityIds.slice(i, i + batchSize);
    const batchResults = [];
    
    for (const id of batch) {
      const activity = archived.find(act => act.id === id);
      if (activity) {
        const restoredActivity = { ...activity };
        delete restoredActivity.archivedAt;
        batchResults.push(restoredActivity);
        restored.push(restoredActivity);
      }
    }
    
    results.push(...batchResults);
    
    // Allow UI to breathe between batches
    if (i + batchSize < activityIds.length) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }
  
  // Remove restored activities from archived
  const filteredArchived = archived.filter(act => !activityIds.includes(act.id));
  const saveSuccess = saveArchivedToLocalStorage(filteredArchived);
  
  if (!saveSuccess) {
    console.error('Failed to save archived after bulk restoration');
    return [];
  }
  
  // Add to main activities
  if (results.length > 0) {
    const mainCompressed = localStorage.getItem('system_activities');
    let mainActivities = [];
    
    if (mainCompressed) {
      const decompressed = LZString.decompress(mainCompressed);
      if (decompressed) {
        mainActivities = safeJSONParse(decompressed, []);
      }
    }
    
    // Add new activities, avoiding duplicates
    const existingIds = new Set(mainActivities.map(a => a.id));
    const newActivities = results.filter(act => !existingIds.has(act.id));
    
    mainActivities = [...newActivities, ...mainActivities];
    
    // Limit size
    if (mainActivities.length > 200) {
      mainActivities = mainActivities.slice(0, 200);
    }
    
    const mainRecompressed = LZString.compress(safeJSONStringify(mainActivities));
    localStorage.setItem('system_activities', mainRecompressed);
  }
  
  return results;
};

/**
 * Permanently delete an archived activity
 */
export const permanentlyDeleteArchived = async (activityId) => {
  if (!activityId) return false;
  
  try {
    // Try to delete via API if authenticated
    if (isAuthenticated()) {
      const response = await fetch(`${API_URL}/archived-logs/${activityId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`
        }
      });
      
      if (response.ok) {
        console.log(`Activity ${activityId} permanently deleted from database`);
        return true;
      } else if (response.status === 404) {
        // Activity not found in database, check local storage
        console.log(`Activity ${activityId} not found in database, checking local...`);
        // Fall through to localStorage check
      } else {
        console.error(`Server returned ${response.status} for delete`);
        return false;
      }
    }
  } catch (error) {
    console.error('Error deleting from API:', error);
    // Continue to localStorage fallback
  }
  
  // Fallback to localStorage
  console.log('Falling back to localStorage for deletion');
  try {
    const archived = getArchivedFromLocalStorage();
    const activityIndex = archived.findIndex(act => act.id === activityId);
    
    if (activityIndex === -1) {
      console.log(`Activity ${activityId} not found in archived`);
      return false;
    }
    
    const filtered = archived.filter(act => act.id !== activityId);
    
    if (filtered.length === archived.length) {
      console.log(`Activity ${activityId} not found in archived`);
      return false;
    }
    
    const success = saveArchivedToLocalStorage(filtered);
    
    if (success) {
      console.log(`Activity ${activityId} permanently deleted from local storage`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error in localStorage deletion:', error);
    return false;
  }
};

/**
 * Permanently delete multiple archived activities
 */
export const permanentlyDeleteMultipleArchived = async (activityIds) => {
  if (!activityIds || !activityIds.length) return 0;
  
  try {
    // Try to delete via API if authenticated
    if (isAuthenticated()) {
      const response = await fetch(`${API_URL}/archived-logs/batch-delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify({ logIds: activityIds })
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log(`Deleted ${data.deleted_count} activities from database`);
        return data.deleted_count || 0;
      }
    }
  } catch (error) {
    console.error('Error batch deleting from API:', error);
  }
  
  // Fallback to localStorage
  console.log('Falling back to localStorage for batch deletion');
  const archived = getArchivedFromLocalStorage();
  const idSet = new Set(activityIds);
  const filtered = archived.filter(act => !idSet.has(act.id));
  
  const deletedCount = archived.length - filtered.length;
  
  if (deletedCount > 0) {
    const success = saveArchivedToLocalStorage(filtered);
    return success ? deletedCount : 0;
  }
  
  return 0;
};

/**
 * Search archived activities
 */
export const searchArchivedActivities = async (searchTerm) => {
  if (!searchTerm || !searchTerm.trim()) return [];
  
  try {
    // Try to search via API if authenticated
    if (isAuthenticated()) {
      const response = await fetch(`${API_URL}/archived-logs/search?q=${encodeURIComponent(searchTerm)}`, {
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.activities || [];
      }
    }
  } catch (error) {
    console.error('Error searching from API:', error);
  }
  
  // Fallback to localStorage
  console.log('Falling back to localStorage for search');
  const archived = getArchivedFromLocalStorage();
  const searchLower = searchTerm.toLowerCase().trim();
  
  // Limit search to recent 500 items for performance
  const searchPool = archived.slice(0, 500);
  
  return searchPool.filter(act => 
    (act.user && act.user.toLowerCase().includes(searchLower)) ||
    (act.action && act.action.toLowerCase().includes(searchLower)) ||
    (act.details && act.details.toLowerCase().includes(searchLower)) ||
    (act.userEmail && act.userEmail.toLowerCase().includes(searchLower))
  );
};

/**
 * Get archived statistics
 */
export const getArchivedStats = async () => {
  try {
    // Try to get stats via API if authenticated
    if (isAuthenticated()) {
      const response = await fetch(`${API_URL}/archived-logs/stats`, {
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.stats;
      }
    }
  } catch (error) {
    console.error('Error getting stats from API:', error);
  }
  
  // Fallback to localStorage
  console.log('Falling back to localStorage for stats');
  const archived = getArchivedFromLocalStorage();
  
  const byCategory = {
    create: 0,
    update: 0,
    delete: 0,
    maintenance: 0,
    auth: 0,
    other: 0
  };
  
  archived.forEach(act => {
    const category = act.category || 'other';
    if (byCategory[category] !== undefined) {
      byCategory[category]++;
    } else {
      byCategory.other++;
    }
  });
  
  const dates = archived
    .map(act => new Date(act.timestamp).getTime())
    .filter(ts => !isNaN(ts));
  
  const oldestDate = dates.length > 0 ? new Date(Math.min(...dates)).toISOString() : null;
  const newestDate = dates.length > 0 ? new Date(Math.max(...dates)).toISOString() : null;
  
  return {
    total: archived.length,
    byCategory,
    oldestDate,
    newestDate
  };
};

/**
 * Export archived to CSV with error handling
 */
export const exportArchivedToCSV = (activities, filename) => {
  if (!activities || !activities.length) {
    console.warn('No activities to export');
    return false;
  }
  
  try {
    const headers = ['Timestamp', 'User', 'Email', 'Action', 'Category', 'Details', 'IP', 'Archived At'];
    const rows = [headers.join(',')];
    
    activities.forEach(act => {
      const escapeCSV = (str) => {
        if (!str) return '';
        return `"${String(str).replace(/"/g, '""')}"`;
      };
      
      const row = [
        escapeCSV(new Date(act.timestamp).toLocaleString()),
        escapeCSV(act.user || ''),
        escapeCSV(act.userEmail || ''),
        escapeCSV(act.action || ''),
        escapeCSV(act.category || ''),
        escapeCSV(act.details || ''),
        escapeCSV(act.ip || '127.0.0.1'),
        escapeCSV(act.archivedAt ? new Date(act.archivedAt).toLocaleString() : '')
      ];
      rows.push(row.join(','));
    });
    
    const csvContent = rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    downloadFile(blob, filename || `archived-logs-${new Date().toISOString().split('T')[0]}.csv`);
    return true;
  } catch (error) {
    console.error('Error exporting to CSV:', error);
    return false;
  }
};

/**
 * Export archived to JSON with error handling
 */
export const exportArchivedToJSON = (activities, filename) => {
  if (!activities || !activities.length) {
    console.warn('No activities to export');
    return false;
  }
  
  try {
    const jsonContent = safeJSONStringify(activities, '[]');
    const blob = new Blob([jsonContent], { type: 'application/json' });
    downloadFile(blob, filename || `archived-logs-${new Date().toISOString().split('T')[0]}.json`);
    return true;
  } catch (error) {
    console.error('Error exporting to JSON:', error);
    return false;
  }
};

/**
 * Clear all archived logs from database
 */
export const clearAllArchived = async () => {
  try {
    // Try to clear via API if authenticated
    if (isAuthenticated()) {
      const response = await fetch(`${API_URL}/archived-logs/clear-all`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`
        }
      });
      
      if (response.ok) {
        console.log('All archived logs cleared from database');
        return true;
      }
    }
  } catch (error) {
    console.error('Error clearing from API:', error);
  }
  
  // Fallback to localStorage
  console.log('Falling back to localStorage for clearing');
  try {
    localStorage.removeItem(ARCHIVED_CONFIG.STORAGE_KEYS.ARCHIVED);
    return true;
  } catch (error) {
    console.error('Error clearing archived:', error);
    return false;
  }
};

/**
 * Sync archived logs from database to localStorage
 */
export const syncArchivedFromDatabase = async () => {
  try {
    if (!isAuthenticated()) {
      console.log('Not authenticated, skipping sync');
      return false;
    }
    
    const response = await fetch(`${API_URL}/archived-logs?page=1&limit=500`, {
      headers: {
        'Authorization': `Bearer ${getAuthToken()}`
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.activities && data.activities.length > 0) {
        saveArchivedToLocalStorage(data.activities);
        console.log(`Synced ${data.activities.length} archived logs from database`);
        return true;
      }
    }
    return false;
  } catch (error) {
    console.error('Error syncing from database:', error);
    return false;
  }
};

/**
 * Download file helper with error handling
 */
const downloadFile = (blob, filename) => {
  try {
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error downloading file:', error);
  }
};

// Create the exported object
const ArchivedLogger = {
  getArchivedActivities,
  archiveActivity,
  archiveMultipleActivities,
  restoreArchivedActivity,
  restoreMultipleArchived,
  permanentlyDeleteArchived,
  permanentlyDeleteMultipleArchived,
  searchArchivedActivities,
  getArchivedStats,
  exportArchivedToCSV,
  exportArchivedToJSON,
  clearAllArchived,
  syncArchivedFromDatabase
};

export default ArchivedLogger;
