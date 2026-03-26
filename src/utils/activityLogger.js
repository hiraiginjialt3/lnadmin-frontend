// src/utils/activityLogger.js
import { v4 as uuidv4 } from 'uuid';
import LZString from 'lz-string';

// ==================== CONFIGURATION ====================
const ACTIVITY_CONFIG = {
  STORAGE_KEYS: {
    ACTIVITIES: 'system_activities',
    PENDING: 'pending_activities',
    SEARCH_INDEX: 'activity_search_index',
    FILTER_PREFS: 'log_filter_preferences'
  },
  LIMITS: {
    MAX_ACTIVITIES: 200,
    MAX_CACHE_SIZE: 1000,
    PAGE_SIZE: 50,
    SEARCH_MIN_CHARS: 2
  },
  TIMING: {
    DEDUP_WINDOW_MS: 30000,
    SYNC_RETRY_DELAY: 1000,
    MAX_RETRIES: 5,
    SYNC_INTERVAL: 30000,
    DEBOUNCE_DELAY: 300
  },
  CATEGORIES: ['create', 'update', 'delete', 'maintenance', 'auth', 'other'],
  API_URL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api'
};

// ==================== STATE MANAGEMENT ====================
let searchTimeout = null;
const recentActivitiesLog = new Map();
const syncQueue = [];
let syncInProgress = false;

// ==================== UTILITY FUNCTIONS ====================

const sanitizeForStorage = (input) => {
  if (typeof input !== 'string') return input;
  
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .trim();
};

const validateActivity = (activity) => {
  const required = ['action', 'timestamp', 'user', 'userEmail', 'userId'];
  const missing = required.filter(field => !activity[field]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required fields: ${missing.join(', ')}`);
  }
  
  if (isNaN(new Date(activity.timestamp).getTime())) {
    throw new Error('Invalid timestamp');
  }
  
  if (activity.category && !ACTIVITY_CONFIG.CATEGORIES.includes(activity.category)) {
    activity.category = 'other';
  }
  
  return true;
};

const measurePerformance = (fn, fnName) => {
  return async (...args) => {
    const start = performance.now();
    try {
      const result = await fn(...args);
      const duration = performance.now() - start;
      
      if (duration > 100) {
        console.warn(`⚠️ Slow operation ${fnName}: ${duration.toFixed(2)}ms`);
      }
      
      return result;
    } catch (error) {
      console.error(`❌ Error in ${fnName}:`, error);
      throw error;
    }
  };
};

const handleStorageQuotaExceeded = (error, activities) => {
  if (error.name === 'QuotaExceededError' || error.code === 22) {
    console.warn('Storage quota exceeded, performing cleanup...');
    const toKeep = activities.slice(0, ACTIVITY_CONFIG.LIMITS.MAX_ACTIVITIES / 2);
    saveActivitiesToStorage(toKeep);
    return true;
  }
  return false;
};

const getCurrentUser = () => {
  try {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  } catch (e) {
    console.error('Error parsing user from localStorage:', e);
    return null;
  }
};

const getValidToken = async () => {
  const token = localStorage.getItem('authToken');
  return token || null;
};

const getStoredActivities = () => {
  try {
    const compressed = localStorage.getItem(ACTIVITY_CONFIG.STORAGE_KEYS.ACTIVITIES);
    if (!compressed) return [];
    
    const decompressed = LZString.decompress(compressed);
    return decompressed ? JSON.parse(decompressed) : [];
  } catch (e) {
    console.error('Error parsing activities from localStorage:', e);
    return [];
  }
};

const saveActivitiesToStorage = (activities) => {
  try {
    const compressed = LZString.compress(JSON.stringify(activities));
    localStorage.setItem(ACTIVITY_CONFIG.STORAGE_KEYS.ACTIVITIES, compressed);
  } catch (e) {
    console.error('Error saving activities to localStorage:', e);
    handleStorageQuotaExceeded(e, activities);
  }
};

const getPendingActivities = () => {
  try {
    const pending = localStorage.getItem(ACTIVITY_CONFIG.STORAGE_KEYS.PENDING);
    return pending ? JSON.parse(pending) : [];
  } catch (e) {
    console.error('Error parsing pending activities:', e);
    return [];
  }
};

const savePendingActivities = (pending) => {
  try {
    localStorage.setItem(ACTIVITY_CONFIG.STORAGE_KEYS.PENDING, JSON.stringify(pending));
  } catch (e) {
    console.error('Error saving pending activities:', e);
  }
};

const buildSearchIndex = (activities) => {
  const index = {};
  
  activities.forEach(act => {
    const searchableText = `${act.user} ${act.action} ${act.details || ''} ${act.userEmail}`.toLowerCase();
    const words = searchableText.split(/\s+/);
    
    words.forEach(word => {
      if (word.length >= ACTIVITY_CONFIG.LIMITS.SEARCH_MIN_CHARS) {
        if (!index[word]) index[word] = [];
        if (!index[word].includes(act.id)) {
          index[word].push(act.id);
        }
      }
    });
  });
  
  try {
    localStorage.setItem(ACTIVITY_CONFIG.STORAGE_KEYS.SEARCH_INDEX, JSON.stringify(index));
  } catch (e) {
    console.error('Error saving search index:', e);
  }
  
  return index;
};

const cleanupRecentActivities = () => {
  const now = Date.now();
  const cutoff = now - ACTIVITY_CONFIG.TIMING.DEDUP_WINDOW_MS;
  
  for (const [key, timestamp] of recentActivitiesLog.entries()) {
    if (timestamp < cutoff) {
      recentActivitiesLog.delete(key);
    }
  }
  
  if (recentActivitiesLog.size > ACTIVITY_CONFIG.LIMITS.MAX_CACHE_SIZE) {
    const oldestKeys = Array.from(recentActivitiesLog.keys())
      .slice(0, recentActivitiesLog.size - ACTIVITY_CONFIG.LIMITS.MAX_CACHE_SIZE);
    oldestKeys.forEach(key => recentActivitiesLog.delete(key));
  }
};

const getCategoryFromAction = (action) => {
  const actionLower = action.toLowerCase();
  
  if (actionLower.includes('created') || actionLower.includes('added') || 
      actionLower.includes('registered') || actionLower.includes('new')) {
    return 'create';
  }
  
  if (actionLower.includes('updated') || actionLower.includes('edited') || 
      actionLower.includes('modified') || actionLower.includes('activated') || 
      actionLower.includes('deactivated') || actionLower.includes('status changed') || 
      actionLower.includes('enabled') || actionLower.includes('disabled') ||
      actionLower.includes('changed')) {
    return 'update';
  }
  
  if (actionLower.includes('deleted') || actionLower.includes('removed') || 
      actionLower.includes('archived')) {
    return 'delete';
  }
  
  if (actionLower.includes('sync') || actionLower.includes('processed') || 
      actionLower.includes('extracted') || actionLower.includes('generated') ||
      actionLower.includes('backup') || actionLower.includes('loaded') ||
      actionLower.includes('cleared') || actionLower.includes('export')) {
    return 'maintenance';
  }
  
  if (actionLower.includes('logged in') || actionLower.includes('logged out') || 
      actionLower.includes('login') || actionLower.includes('logout') ||
      actionLower.includes('authenticated')) {
    return 'auth';
  }
  
  return null;
};

const syncWithRetry = async (pending, retryCount = 0) => {
  const token = await getValidToken();
  
  if (!token) {
    console.log('No valid token, skipping sync');
    return false;
  }

  try {
    console.log(`🔄 Syncing ${pending.length} activities (attempt ${retryCount + 1})...`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    const response = await fetch(`${ACTIVITY_CONFIG.API_URL}/system-logs/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ activities: pending }),
      signal: controller.signal,
      credentials: 'include'
    });

    clearTimeout(timeoutId);
    
    const data = await response.json();

    if (response.ok) {
      console.log(`✅ Successfully synced ${pending.length} activities`);
      return true;
    } else {
      throw new Error(data.message || 'Sync failed');
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log('⏱️ Sync timeout');
    } else {
      console.log(`❌ Sync failed: ${error.message}`);
    }
    
    if (retryCount < ACTIVITY_CONFIG.TIMING.MAX_RETRIES) {
      const delay = ACTIVITY_CONFIG.TIMING.SYNC_RETRY_DELAY * Math.pow(2, retryCount);
      console.log(`⏳ Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return syncWithRetry(pending, retryCount + 1);
    }
    
    return false;
  }
};

export const syncPendingActivities = async () => {
  if (syncInProgress) {
    return new Promise((resolve) => {
      syncQueue.push(resolve);
    });
  }

  syncInProgress = true;
  
  try {
    const pending = getPendingActivities();
    
    if (pending.length === 0) {
      return;
    }

    if (!navigator.onLine) {
      console.log('📴 Offline, skipping sync');
      return;
    }

    const success = await syncWithRetry(pending);

    if (success) {
      savePendingActivities([]);
      
      const activities = getStoredActivities();
      const updatedActivities = activities.map(act => {
        if (pending.some(p => p.id === act.id)) {
          return { ...act, synced: true };
        }
        return act;
      });
      
      saveActivitiesToStorage(updatedActivities);
      buildSearchIndex(updatedActivities);
    }
  } catch (error) {
    console.log('Error in syncPendingActivities:', error);
  } finally {
    syncInProgress = false;
    
    while (syncQueue.length > 0) {
      const next = syncQueue.shift();
      next();
    }
  }
};

const getClientIP = () => {
  try {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return '127.0.0.1 (local)';
    }
    
    return new Promise((resolve) => {
      const pc = new RTCPeerConnection({ iceServers: [] });
      pc.createDataChannel('');
      pc.createOffer()
        .then(offer => pc.setLocalDescription(offer))
        .catch(() => {});
      
      pc.onicecandidate = (ice) => {
        if (!ice || !ice.candidate || !ice.candidate.candidate) {
          resolve('IP unavailable');
          return;
        }
        
        const ipRegex = /([0-9]{1,3}(\.[0-9]{1,3}){3})/;
        const match = ice.candidate.candidate.match(ipRegex);
        if (match && match[1]) {
          resolve(match[1]);
        } else {
          resolve('IP unavailable');
        }
      };
      
      setTimeout(() => resolve('IP unavailable'), 2000);
    });
  } catch (e) {
    console.log('Error getting IP:', e);
    return 'IP unavailable';
  }
};

// ==================== CORE FUNCTIONS ====================

export const logActivity = async (action, details = '') => {
  const user = getCurrentUser();
  if (!user) {
    console.log('No user found, skipping activity log');
    return null;
  }

  const category = getCategoryFromAction(action);
  
  if (!category) {
    console.log(`Skipping non-essential action: ${action}`);
    return null;
  }

  const userId = user.id || user._id || user.admin_id || 'unknown';
  const activityKey = `${userId}_${category}_${action}`;
  const now = Date.now();
  const lastLogTime = recentActivitiesLog.get(activityKey);
  
  if (lastLogTime && (now - lastLogTime) < ACTIVITY_CONFIG.TIMING.DEDUP_WINDOW_MS) {
    console.log(`Duplicate activity detected, skipping: ${action}`);
    return null;
  }
  
  recentActivitiesLog.set(activityKey, now);
  cleanupRecentActivities();

  const ip = await getClientIP();

  const newActivity = {
    id: uuidv4(),
    user: sanitizeForStorage(user.name || user.admin_name || user.username || 'Admin User'),
    userEmail: sanitizeForStorage(user.email || user.admin_email || 'unknown@email.com'),
    userId: userId,
    action: sanitizeForStorage(action),
    category,
    details: sanitizeForStorage(details),
    timestamp: new Date().toISOString(),
    ip: ip,
    synced: false,
    userAgent: navigator.userAgent,
    createdAt: new Date().toISOString()
  };

  try {
    validateActivity(newActivity);
  } catch (error) {
    console.error('Invalid activity:', error);
    return null;
  }

  const activities = getStoredActivities();
  activities.unshift(newActivity);
  
  const activeActivities = activities;
  
  if (activeActivities.length > ACTIVITY_CONFIG.LIMITS.MAX_ACTIVITIES) {
    activeActivities.pop();
  }
  
  saveActivitiesToStorage(activeActivities);
  
  const pending = getPendingActivities();
  pending.push(newActivity);
  savePendingActivities(pending);

  buildSearchIndex(activeActivities);

  if (navigator.onLine && !syncInProgress) {
    syncPendingActivities();
  }

  console.log(`✅ Logged: ${action} (${category})`);
  return newActivity;
};

export const getActivitiesWithPagination = measurePerformance(
  async (page = 1, pageSize = ACTIVITY_CONFIG.LIMITS.PAGE_SIZE, filters = {}) => {
    try {
      const token = await getValidToken();
      if (token && navigator.onLine) {
        const queryParams = new URLSearchParams({
          page,
          limit: pageSize,
          sort: '-timestamp'
        });
        
        if (filters.category && filters.category !== 'all') {
          queryParams.append('category', filters.category);
        }
        
        if (filters.search?.trim()) {
          queryParams.append('search', filters.search.trim());
        }
        
        if (filters.startDate) {
          queryParams.append('startDate', filters.startDate);
        }
        
        if (filters.endDate) {
          queryParams.append('endDate', filters.endDate);
        }
        
        if (filters.userId) {
          queryParams.append('userId', filters.userId);
        }

        const response = await fetch(
          `${ACTIVITY_CONFIG.API_URL}/system-logs?${queryParams.toString()}`,
          { 
            headers: { 'Authorization': `Bearer ${token}` },
            credentials: 'include'
          }
        );

        if (response.ok) {
          const data = await response.json();
          
          const localActivities = getStoredActivities();
          const localActivityMap = new Map(localActivities.map(a => [a.id, a]));
          
          const mergedActivities = (data.activities || []).map(dbAct => {
            const localAct = localActivityMap.get(dbAct.id);
            return {
              ...dbAct,
              synced: localAct ? localAct.synced : true
            };
          });
          
          return {
            activities: mergedActivities,
            total: data.total || 0,
            page: data.page || page,
            totalPages: data.totalPages || 1,
            fromDatabase: true
          };
        }
      }
    } catch (error) {
      console.error('Error fetching from database:', error);
    }

    console.log('Falling back to localStorage');
    let allActivities = getStoredActivities();
    
    if (filters.category && filters.category !== 'all') {
      allActivities = allActivities.filter(act => act.category === filters.category);
    }

    if (filters.userId) {
      allActivities = allActivities.filter(act => act.userId === filters.userId);
    }

    if (filters.search?.trim()) {
      const searchTerm = filters.search.toLowerCase().trim();
      const searchIndex = JSON.parse(
        localStorage.getItem(ACTIVITY_CONFIG.STORAGE_KEYS.SEARCH_INDEX) || '{}'
      );
      
      if (Object.keys(searchIndex).length > 0) {
        const matchingIds = new Set();
        const searchWords = searchTerm.split(/\s+/);
        
        searchWords.forEach(word => {
          if (word.length >= ACTIVITY_CONFIG.LIMITS.SEARCH_MIN_CHARS && searchIndex[word]) {
            searchIndex[word].forEach(id => matchingIds.add(id));
          }
        });
        
        if (matchingIds.size > 0) {
          allActivities = allActivities.filter(act => matchingIds.has(act.id));
        }
      } else {
        allActivities = allActivities.filter(act => 
          (act.user && act.user.toLowerCase().includes(searchTerm)) ||
          (act.action && act.action.toLowerCase().includes(searchTerm)) ||
          (act.details && act.details.toLowerCase().includes(searchTerm)) ||
          (act.userEmail && act.userEmail.toLowerCase().includes(searchTerm))
        );
      }
    }

    if (filters.startDate) {
      const start = new Date(filters.startDate);
      allActivities = allActivities.filter(act => new Date(act.timestamp) >= start);
    }

    if (filters.endDate) {
      const end = new Date(filters.endDate);
      allActivities = allActivities.filter(act => new Date(act.timestamp) <= end);
    }

    allActivities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    const total = allActivities.length;
    const startIndex = (page - 1) * pageSize;
    const paginatedActivities = allActivities.slice(startIndex, startIndex + pageSize);

    return {
      activities: paginatedActivities,
      total,
      page,
      totalPages: Math.ceil(total / pageSize),
      fromDatabase: false
    };
  },
  'getActivitiesWithPagination'
);

export const searchActivities = async (searchTerm, page = 1, pageSize = ACTIVITY_CONFIG.LIMITS.PAGE_SIZE) => {
  clearTimeout(searchTimeout);
  
  return new Promise((resolve) => {
    searchTimeout = setTimeout(async () => {
      const result = await getActivitiesWithPagination(page, pageSize, { search: searchTerm });
      resolve(result);
    }, ACTIVITY_CONFIG.TIMING.DEBOUNCE_DELAY);
  });
};

export const loadFromDatabase = async () => {
  try {
    const token = await getValidToken();
    if (!token || !navigator.onLine) {
      console.log('Cannot load from database: offline or no token');
      return false;
    }

    console.log('Loading all activities from database...');
    
    const response = await fetch(
      `${ACTIVITY_CONFIG.API_URL}/system-logs?page=1&limit=200&sort=-timestamp`,
      { 
        headers: { 'Authorization': `Bearer ${token}` },
        credentials: 'include'
      }
    );

    if (!response.ok) {
      console.log('Failed to load from database');
      return false;
    }

    const data = await response.json();
    
    if (data.activities?.length > 0) {
      const localActivities = getStoredActivities();
      const existingIds = new Set(localActivities.map(a => a.id));
      const newActivities = data.activities.filter(dbAct => !existingIds.has(dbAct.id));
      
      if (newActivities.length > 0) {
        const mergedActivities = [...newActivities, ...localActivities];
        mergedActivities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        if (mergedActivities.length > ACTIVITY_CONFIG.LIMITS.MAX_ACTIVITIES) {
          mergedActivities.length = ACTIVITY_CONFIG.LIMITS.MAX_ACTIVITIES;
        }
        
        saveActivitiesToStorage(mergedActivities);
        buildSearchIndex(mergedActivities);
        console.log(`Added ${newActivities.length} new activities from database`);
      }
      
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error loading from database:', error);
    return false;
  }
};

export const getCategoryStats = async () => {
  try {
    const token = await getValidToken();
    if (token && navigator.onLine) {
      const response = await fetch(`${ACTIVITY_CONFIG.API_URL}/system-logs/stats`, {
        headers: { 'Authorization': `Bearer ${token}` },
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.stats || {
          create: 0, update: 0, delete: 0, maintenance: 0, auth: 0, other: 0
        };
      }
    }
  } catch (error) {
    console.error('Error fetching stats:', error);
  }
  
  const activities = getStoredActivities();
  const stats = {
    create: 0, update: 0, delete: 0, maintenance: 0, auth: 0, other: 0
  };

  activities.forEach(act => {
    if (stats[act.category] !== undefined) {
      stats[act.category]++;
    } else {
      stats.other++;
    }
  });

  return stats;
};

export const getActivityTimeline = (activities, groupBy = 'day') => {
  if (!activities?.length) return [];
  
  const timeline = {};
  
  activities.forEach(act => {
    const date = new Date(act.timestamp);
    let key;
    
    switch(groupBy) {
      case 'hour':
        key = `${date.toISOString().split('T')[0]} ${String(date.getHours()).padStart(2, '0')}:00`;
        break;
      case 'day':
        key = date.toISOString().split('T')[0];
        break;
      case 'week':
        const startOfYear = new Date(date.getFullYear(), 0, 1);
        const days = Math.floor((date - startOfYear) / (24 * 60 * 60 * 1000));
        const weekNumber = Math.ceil((days + startOfYear.getDay() + 1) / 7);
        key = `${date.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
        break;
      case 'month':
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        break;
      default:
        key = date.toISOString().split('T')[0];
    }
    
    if (!timeline[key]) {
      timeline[key] = {
        date: key,
        total: 0,
        categories: { create: 0, update: 0, delete: 0, maintenance: 0, auth: 0, other: 0 }
      };
    }
    
    timeline[key].total++;
    const category = act.category || 'other';
    if (timeline[key].categories[category] !== undefined) {
      timeline[key].categories[category]++;
    } else {
      timeline[key].categories.other++;
    }
  });
  
  return Object.values(timeline).sort((a, b) => a.date.localeCompare(b.date));
};

export const exportActivitiesToCSV = (activities, filename = `system-logs-${new Date().toISOString().split('T')[0]}.csv`) => {
  if (!activities?.length) {
    console.log('No activities to export');
    return false;
  }

  const headers = ['Timestamp', 'User', 'Email', 'Action', 'Category', 'Details', 'IP', 'Synced'];
  const rows = [headers.join(',')];

  activities.forEach(act => {
    const row = [
      `"${new Date(act.timestamp).toLocaleString()}"`,
      `"${act.user || ''}"`,
      `"${act.userEmail || ''}"`,
      `"${act.action || ''}"`,
      `"${act.category || ''}"`,
      `"${(act.details || '').replace(/"/g, '""')}"`,
      `"${act.ip || '127.0.0.1'}"`,
      act.synced ? 'Yes' : 'No'
    ];
    rows.push(row.join(','));
  });

  const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  downloadFile(blob, filename);
  
  return true;
};

export const exportActivitiesToJSON = (activities, filename = `system-logs-${new Date().toISOString().split('T')[0]}.json`) => {
  if (!activities?.length) {
    console.log('No activities to export');
    return false;
  }

  const jsonContent = JSON.stringify(activities, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json' });
  downloadFile(blob, filename);
  
  return true;
};

const downloadFile = (blob, filename) => {
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
};

export const saveFilterPreferences = (preferences) => {
  try {
    localStorage.setItem(ACTIVITY_CONFIG.STORAGE_KEYS.FILTER_PREFS, JSON.stringify(preferences));
    return true;
  } catch (e) {
    console.error('Error saving filter preferences:', e);
    return false;
  }
};

export const loadFilterPreferences = () => {
  try {
    const saved = localStorage.getItem(ACTIVITY_CONFIG.STORAGE_KEYS.FILTER_PREFS);
    return saved ? JSON.parse(saved) : null;
  } catch (e) {
    console.error('Error loading filter preferences:', e);
    return null;
  }
};

export const bulkDeleteActivities = (activityIds) => {
  if (!activityIds?.length) return [];
  
  const activities = getStoredActivities();
  const filtered = activities.filter(act => !activityIds.includes(act.id));
  saveActivitiesToStorage(filtered);
  buildSearchIndex(filtered);
  
  console.log(`Bulk deleted ${activityIds.length} activities`);
  return filtered;
};

export const clearLocalActivities = () => {
  localStorage.removeItem(ACTIVITY_CONFIG.STORAGE_KEYS.ACTIVITIES);
  localStorage.removeItem(ACTIVITY_CONFIG.STORAGE_KEYS.PENDING);
  localStorage.removeItem(ACTIVITY_CONFIG.STORAGE_KEYS.SEARCH_INDEX);
  recentActivitiesLog.clear();
  console.log('Local activities cleared');
};

export const getActivitiesFromDatabase = async () => {
  const result = await getActivitiesWithPagination(1, 200);
  return result.activities;
};

export const getActivitiesByCategory = async (category, page = 1, pageSize = ACTIVITY_CONFIG.LIMITS.PAGE_SIZE) => {
  return getActivitiesWithPagination(page, pageSize, { category });
};

export const getUserActivities = async (userId, page = 1, pageSize = ACTIVITY_CONFIG.LIMITS.PAGE_SIZE) => {
  return getActivitiesWithPagination(page, pageSize, { userId });
};

export const getActivitiesByDateRange = async (startDate, endDate, page = 1, pageSize = ACTIVITY_CONFIG.LIMITS.PAGE_SIZE) => {
  return getActivitiesWithPagination(page, pageSize, { startDate, endDate });
};

export const deleteActivity = async (activityId) => {
  console.log(`Deleting activity ${activityId} from localStorage`);
  
  const activities = getStoredActivities();
  const filtered = activities.filter(act => act.id !== activityId);
  saveActivitiesToStorage(filtered);
  buildSearchIndex(filtered);
  
  return filtered;
};

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('Back online, syncing pending activities...');
    syncPendingActivities();
  });

  setInterval(() => {
    if (navigator.onLine && !syncInProgress) {
      syncPendingActivities();
    }
  }, ACTIVITY_CONFIG.TIMING.SYNC_INTERVAL);
}

const ActivityLogger = {
  logActivity,
  getActivities: getActivitiesFromDatabase,
  getActivitiesWithPagination,
  getActivitiesFromDatabase,
  getActivitiesByCategory,
  getUserActivities,
  clearLocalActivities,
  deleteActivity,
  searchActivities,
  getActivitiesByDateRange,
  getCategoryStats,
  syncPendingActivities,
  loadFromDatabase,
  exportActivitiesToCSV,
  exportActivitiesToJSON,
  saveFilterPreferences,
  loadFilterPreferences,
  bulkDeleteActivities,
  getActivityTimeline
};

export default ActivityLogger;
