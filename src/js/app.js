// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signInAnonymously, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Import configuration
import { firebaseConfig, DEFAULT_APP_ID, INITIAL_AUTH_TOKEN } from './config.js';

// Global variables
let app, auth, db, tasksCollectionRef;
let autoSaveTimeout;
let taskDraft = {};
let tasks = []; // Global tasks array

// DOM Elements - Fixed IDs
const loadingState = document.getElementById('loading-state');
const taskContainer = document.getElementById('task-container');
const taskForm = document.getElementById('add-task-form');
const taskInput = document.getElementById('task-input');
const notesInput = document.getElementById('notes-input');
const deadlineInput = document.getElementById('deadline-input');
const priorityInput = document.getElementById('priority-input');
const taskListDesktop = document.getElementById('task-list-desktop');
const taskListMobile = document.getElementById('task-list-mobile');
const emptyState = document.getElementById('empty-state');
const notificationContainer = document.getElementById('notification-container');

// Statistics elements
const totalTasksEl = document.getElementById('total-tasks');
const completedTasksEl = document.getElementById('completed-tasks');
const pendingTasksEl = document.getElementById('pending-tasks');
const progressBar = document.getElementById('progress-bar');





// Initialize Firebase
function initializeFirebase() {
    try {
        console.log('Initializing Firebase...');
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
        console.log('Firebase initialized successfully!');
        
        // Add a timeout fallback to hide loading after 5 seconds
        setTimeout(() => {
            if (loadingState && !loadingState.classList.contains('hidden')) {
                console.log(' TIMEOUT: FORCE HIDE');
                hideLoading();
            }
        }, 5000);
        
        // Immediately try to authenticate
        console.log('Starting authentication...');
        
        signInAnonymously(auth)
            .then((result) => {
                console.log('Authentication successful!');
                console.log('User ID:', result.user.uid);
                setupFirebaseListeners(result.user.uid);
            })
            .catch((error) => {
                console.error('Authentication failed:', error);
                // Still show interface even if auth fails
                hideLoading();
            });
    } catch (error) {
        console.error('Firebase initialization error:', error);
        hideLoading();
    }
}

// LOADING FUNCTIONS
function showLoading() {
    console.log('SHOWING LOADING...');
    const loading = document.getElementById('loading-state');
    const container = document.getElementById('task-container');
    if (loading) loading.classList.remove('hidden');
    if (container) container.classList.add('hidden');
}

function hideLoading() {
    const loading = document.getElementById('loading-state');
    const container = document.getElementById('task-container');
    
    // Jangan log berkali-kali
    if (loading && !loading.classList.contains('hidden')) {
        console.log('HIDING LOADING...');
        loading.classList.add('hidden');
        console.log('LOADING HIDDEN');
    }
    
    if (container && container.classList.contains('hidden')) {
        container.classList.remove('hidden');
        console.log('CONTAINER SHOWN');
    }
}

// Notification System
function showNotification(message, type = 'info', duration = 5000) {
    // Global notification deduplication
    if (!window.notificationCache) window.notificationCache = new Map();
    
    const notifKey = `${message}-${type}`;
    const now = Date.now();
    
    // Check if identical notification was shown recently (within 1 second)
    if (window.notificationCache.has(notifKey)) {
        const lastTime = window.notificationCache.get(notifKey);
        if (now - lastTime < 1000) {
            console.log('Duplicate notification blocked:', message);
            return null; // Block duplicate
        }
    }
    
    // Record this notification
    window.notificationCache.set(notifKey, now);
    
    // Clean old entries every 50 notifications
    if (window.notificationCache.size > 50) {
        const cutoff = now - 10000; // 10 seconds ago
        for (const [key, time] of window.notificationCache.entries()) {
            if (time < cutoff) {
                window.notificationCache.delete(key);
            }
        }
    }
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    
    const icon = getNotificationIcon(type);
    notification.innerHTML = `
        <div class="flex items-center space-x-2">
            <span>${icon}</span>
            <span class="font-medium">${message}</span>
        </div>
    `;
    
    notificationContainer.appendChild(notification);
    
    // Auto remove after duration
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, duration);
    
    return notification;
}

function getNotificationIcon(type) {
    const icons = {
        success: '<svg class="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 24 24"><path d="M10.3,12.3a1,1,0,0,0,1.4,0L15.29,8.71a1,1,0,1,0-1.41-1.42L11,10.17,9.12,8.29a1,1,0,0,0-1.41,1.42ZM12,2A10,10,0,1,0,22,12,10,10,0,0,0,12,2Zm0,18a8,8,0,1,1,8-8A8,8,0,0,1,12,20Z"/></svg>',
        error: '<svg class="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12,2A10,10,0,1,0,22,12,10,10,0,0,0,12,2Zm3.21,11.79a1,1,0,0,1-1.42,1.42L12,13.41l-1.79,1.8a1,1,0,0,1-1.42-1.42L10.59,12,8.79,10.21a1,1,0,0,1,1.42-1.42L12,10.59l1.79-1.8a1,1,0,0,1,1.42,1.42L13.41,12Z"/></svg>', 
        info: '<svg class="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12,2A10,10,0,1,0,22,12,10,10,0,0,0,12,2Zm1,15H11V11h2Zm0-8H11V7h2Z"/></svg>',
        warning: '<svg class="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12,2,22,20H2ZM11,10h2v5H11Zm0,7h2v2H11Z"/></svg>'
    };
    return icons[type] || icons.info;
}

// Custom Delete Modal System
function showDeleteModal(taskText, onConfirm) {
    const modal = document.getElementById('delete-modal');
    const preview = document.getElementById('delete-task-preview');
    const confirmBtn = document.getElementById('confirm-delete');
    const cancelBtn = document.getElementById('cancel-delete');
    
    // Set task preview text
    preview.textContent = taskText;
    
    // Show modal with animation
    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.querySelector('div').classList.add('scale-100');
    }, 10);
    
    // Handle confirmation
    const handleConfirm = async () => {
        await onConfirm();
        hideDeleteModal();
    };
    
    // Handle cancel
    const handleCancel = () => {
        hideDeleteModal();
    };
    
    // Handle escape key
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            hideDeleteModal();
        }
    };
    
    // Add event listeners
    confirmBtn.addEventListener('click', handleConfirm, { once: true });
    cancelBtn.addEventListener('click', handleCancel, { once: true });
    document.addEventListener('keydown', handleEscape, { once: true });
    
    // Click outside to close
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            hideDeleteModal();
        }
    }, { once: true });
}

function hideDeleteModal() {
    const modal = document.getElementById('delete-modal');
    modal.classList.add('hidden');
    
    // Clean up event listeners
    const confirmBtn = document.getElementById('confirm-delete');
    const cancelBtn = document.getElementById('cancel-delete');
    confirmBtn.replaceWith(confirmBtn.cloneNode(true));
    cancelBtn.replaceWith(cancelBtn.cloneNode(true));
}

// Auto-save Draft System
function saveDraft() {
    taskDraft = {
        text: taskInput.value.trim(),
        notes: notesInput.value.trim(),
        deadline: deadlineInput.value,
        priority: priorityInput.value,
        timestamp: Date.now()
    };
    
    localStorage.setItem('taskDraft', JSON.stringify(taskDraft));
    showAutoSaveIndicator();
}

function loadDraft() {
    const saved = localStorage.getItem('taskDraft');
    if (saved) {
        try {
            const draft = JSON.parse(saved);
            // Only load if draft is less than 24 hours old
            if (Date.now() - draft.timestamp < 24 * 60 * 60 * 1000) {
                taskInput.value = draft.text || '';
                notesInput.value = draft.notes || '';
                deadlineInput.value = draft.deadline || '';
                priorityInput.value = draft.priority || 'Sedang';
                
                if (draft.text || draft.notes) {
                    showNotification('Draft tersimpan dimuat', 'info', 3000);
                }
            }
        } catch (error) {
            console.error('Error loading draft:', error);
        }
    }
}

function clearDraft() {
    localStorage.removeItem('taskDraft');
    taskDraft = {};
}

function resetTaskForm() {
    console.log('Resetting form... (called from:', (new Error()).stack.split('\n')[2].trim(), ')');
    
    // Clear all form inputs
    if (taskInput) {
        taskInput.value = '';
        taskInput.dispatchEvent(new Event('input')); // Trigger input event
    }
    if (notesInput) {
        notesInput.value = '';
        notesInput.dispatchEvent(new Event('input'));
    }
    if (deadlineInput) {
        deadlineInput.value = '';
        deadlineInput.dispatchEvent(new Event('change'));
    }
    if (priorityInput) {
        priorityInput.value = 'Sedang';
        priorityInput.dispatchEvent(new Event('change'));
    }
    
    // Clear draft
    clearDraft();
    
    // Reset form element itself
    if (taskForm) {
        taskForm.reset();
    }
    
    // Focus back to task input
    setTimeout(() => {
        if (taskInput) taskInput.focus();
    }, 50);
    
    console.log('Form reset completed');
}

// Embedded Link functionality
function handleEmbedLink() {
    const start = notesInput.selectionStart;
    const end = notesInput.selectionEnd;
    
    // Check if text is selected
    if (start === end) {
        showNotification('Pilih teks yang ingin dijadikan link!', 'warning', 3000);
        notesInput.focus();
        return;
    }
    
    const selectedText = notesInput.value.substring(start, end);
    
    // Create custom modal for URL input
    showLinkModal(selectedText, (url) => {
        // Validate URL
        if (!url || !isValidURL(url)) {
            showNotification('URL tidak valid!', 'error', 3000);
            return;
        }
        
        // Create markdown-style link
        const linkText = `[${selectedText}](${url})`;
        
        // Replace selected text with link
        const beforeText = notesInput.value.substring(0, start);
        const afterText = notesInput.value.substring(end);
        notesInput.value = beforeText + linkText + afterText;
        
        // Trigger input event for auto-save
        notesInput.dispatchEvent(new Event('input'));
        
        // Show success message
        showNotification('Link berhasil ditambahkan!', 'success', 2000);
        
        // Focus back to textarea
        notesInput.focus();
        
        // Set cursor position after the inserted link
        const newCursorPos = start + linkText.length;
        notesInput.setSelectionRange(newCursorPos, newCursorPos);
    });
}

// URL validation function
function isValidURL(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

// Parse markdown-style links and convert to HTML
function parseMarkdownLinks(text) {
    if (!text) return text;
    
    // Regex to match [text](url) format
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    
    return text.replace(linkRegex, (match, linkText, url) => {
        // Validate URL
        if (isValidURL(url)) {
            return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline transition-colors">${linkText}</a>`;
        }
        // If URL is invalid, return original text
        return match;
    });
}

// Show link input modal
function showLinkModal(selectedText, onConfirm) {
    // Create modal HTML
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50';
    modal.innerHTML = `
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 transform transition-all">
            <div class="p-6">
                <div class="flex items-center gap-3 mb-4">
                    <div class="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                        <svg class="w-5 h-5 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8,12a1,1,0,0,0,1,1h6a1,1,0,0,0,0-2H9A1,1,0,0,0,8,12ZM12,2A10,10,0,1,0,22,12,10,10,0,0,0,12,2Zm0,18a8,8,0,1,1,8-8A8,8,0,0,1,12,20Z"/>
                        </svg>
                    </div>
                    <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Buat Link</h3>
                </div>
                
                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Teks terpilih:</label>
                    <div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-sm text-gray-900 dark:text-gray-100 font-medium">"${selectedText}"</div>
                </div>
                
                <div class="mb-6">
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">URL Link:</label>
                    <input type="url" id="link-url-input" placeholder="https://example.com" 
                           class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
                
                <div class="flex justify-end gap-3">
                    <button id="cancel-link" class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors">
                        Batal
                    </button>
                    <button id="confirm-link" class="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors flex items-center gap-2">
                        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8,12a1,1,0,0,0,1,1h6a1,1,0,0,0,0-2H9A1,1,0,0,0,8,12ZM12,2A10,10,0,1,0,22,12,10,10,0,0,0,12,2Zm0,18a8,8,0,1,1,8-8A8,8,0,0,1,12,20Z"/>
                        </svg>
                        Buat Link
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Get elements
    const urlInput = modal.querySelector('#link-url-input');
    const cancelBtn = modal.querySelector('#cancel-link');
    const confirmBtn = modal.querySelector('#confirm-link');
    
    // Focus on URL input
    urlInput.focus();
    
    // Handle cancel
    const closeModal = () => {
        modal.remove();
    };
    
    cancelBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
    
    // Handle confirm
    const handleConfirm = () => {
        const url = urlInput.value.trim();
        if (url) {
            onConfirm(url);
            closeModal();
        }
    };
    
    confirmBtn.addEventListener('click', handleConfirm);
    urlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleConfirm();
        }
        if (e.key === 'Escape') {
            closeModal();
        }
    });
}

function showAutoSaveIndicator() {
    let indicator = document.getElementById('auto-save-indicator');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'auto-save-indicator';
        indicator.className = 'auto-save-indicator';
        indicator.innerHTML = 'Draft tersimpan';
        document.body.appendChild(indicator);
    }
    
    indicator.classList.add('show');
    setTimeout(() => {
        indicator.classList.remove('show');
    }, 2000);
}

// Date Helper Functions
function formatDate(dateString) {
    if (!dateString) return 'Tidak ada';
    
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Reset time to compare dates only
    today.setHours(0, 0, 0, 0);
    tomorrow.setHours(0, 0, 0, 0);
    yesterday.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);
    
    if (date.getTime() === today.getTime()) {
        return 'Hari ini';
    } else if (date.getTime() === tomorrow.getTime()) {
        return 'Besok';
    } else if (date.getTime() === yesterday.getTime()) {
        return 'Kemarin';
    } else {
        // Format: "Rabu, 10 Desember 2025"
        const options = { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        };
        const formattedDate = date.toLocaleDateString('id-ID', options);
        
        if (date < today) {
            return `<svg class="w-4 h-4 inline mr-1 text-red-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L1 21h22L12 2zm0 3.44L19.53 19H4.47L12 5.44z"/><path d="M11 10h2v4h-2zm0 6h2v2h-2z"/></svg>${formattedDate}`;
        } else {
            return formattedDate;
        }
    }
}

function isOverdue(dateString) {
    if (!dateString) return false;
    const date = new Date(dateString);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    return date < today;
}

// Theme Management
function initializeTheme() {
    const updateIcon = () => {
        const isDark = document.documentElement.classList.contains('dark');
        console.log('Theme is:', isDark ? 'DARK' : 'LIGHT');
        
        // Make sure elements exist
        if (!moonIcon || !sunIcon) {
            console.error('Theme toggle icons not found!');
            console.log('Available IDs:', Array.from(document.querySelectorAll('[id]')).map(el => el.id));
            return;
        }
        
        if (isDark) {
            // DARK THEME = SHOW MATAHARI
            sunIcon.classList.remove('hidden');
            moonIcon.classList.add('hidden');
            console.log('DARK: Showing MATAHARI');
        } else {
            // LIGHT THEME = SHOW BULAN  
            moonIcon.classList.remove('hidden');
            sunIcon.classList.add('hidden');
            console.log('LIGHT: Showing BULAN');
        }
    };
    
    const toggleTheme = () => {
        console.log('� TOGGLE CLICKED!');
        const html = document.documentElement;
        
        if (html.classList.contains('dark')) {
            html.classList.remove('dark');
            localStorage.setItem('theme', 'light');
            console.log('SWITCHED TO LIGHT');
        } else {
            html.classList.add('dark');
            localStorage.setItem('theme', 'dark');
            console.log('SWITCHED TO DARK');
        }
        
        updateIcon();
    };
    
    // Initialize theme
    if (localStorage.theme === 'dark') {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
    
    updateIcon();
    
    console.log('Theme system ready!');
}

// Priority and Status Styling
function getPriorityClasses(priority) {
    // Consistent gray styling for all priorities
    return 'bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600';
}

function getStatusClasses(status) {
    // Consistent gray styling for all statuses
    return 'bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600';
}

// Task Rendering
function renderDesktopTask(task, taskNumber) {
    const deadlineText = formatDate(task.deadline);
    const isTaskOverdue = isOverdue(task.deadline);
    const tr = document.createElement('tr');
    
    const rowClass = task.status === 'Sudah Dikerjakan' ? 'bg-green-50/50 dark:bg-green-900/20' : 
                     (isTaskOverdue ? 'bg-red-50/30 dark:bg-red-900/20' : '');
    
    tr.className = `hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${rowClass}`;
    
    // Clean display - hanya nama tugas, catatan bisa di-expand inline
    const taskContent = `
        <div class="w-full">
            <div class="${task.status === 'Sudah Dikerjakan' ? 'text-gray-400 dark:text-gray-500 line-through' : 'text-gray-900 dark:text-gray-200'} font-medium">
                ${task.text}
            </div>
            ${task.notes ? `
                <button class="text-xs text-blue-600 dark:text-blue-400 mt-1 opacity-75 hover:opacity-100 transition-opacity flex items-center gap-1" 
                        data-type="toggle-details" 
                        data-id="${task.id}">
                    <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M14,2H6A2,2,0,0,0,4,4V20a2,2,0,0,0,2,2H18a2,2,0,0,0,2-2V8ZM18,20H6V4h7V9a1,1,0,0,0,1,1h4Z"/>
                    </svg>
                    <span class="toggle-text">Ada catatan - Klik untuk detail</span>
                    <svg class="w-3 h-3 toggle-arrow transition-transform duration-200" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M7 10l5 5 5-5z"/>
                    </svg>
                </button>
            ` : ''}
        </div>
    `;
    
    tr.innerHTML = `
        <td class="px-4 py-4 text-center">
            <span class="task-number inline-flex items-center justify-center w-6 h-6 text-sm font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded-full">
                ${taskNumber}
            </span>
            <input type="checkbox" class="task-checkbox hidden rounded border-gray-300 dark:border-gray-600 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50" 
                   data-id="${task.id}" 
                   title="Pilih tugas untuk dihapus">
        </td>
        <td class="px-6 py-4 text-sm font-medium">${taskContent}</td>
        <td class="px-6 py-4 text-sm">
            <div class="flex items-center gap-2 group">
                <span class="text-xs ${isTaskOverdue && task.status !== 'Sudah Dikerjakan' ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-gray-600 dark:text-gray-400'}">${deadlineText}</span>
                <button class="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 p-1 rounded transition-all duration-200"
                        data-type="edit-deadline" 
                        data-id="${task.id}" 
                        data-deadline="${task.deadline || ''}"
                        title="Edit deadline">
                    <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                    </svg>
                </button>
            </div>
        </td>
        <td class="px-6 py-4">
            <select class="custom-select text-xs font-semibold rounded-md p-1.5 border focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-400 transition ${getPriorityClasses(task.priority)}" data-type="priority" data-id="${task.id}">
                <option value="Rendah" ${task.priority === 'Rendah' ? 'selected' : ''}>Rendah</option>
                <option value="Sedang" ${task.priority === 'Sedang' ? 'selected' : ''}>Sedang</option>
                <option value="Tinggi" ${task.priority === 'Tinggi' ? 'selected' : ''}>Tinggi</option>
            </select>
        </td>
        <td class="px-6 py-4">
            <select class="custom-select text-xs font-semibold rounded-md p-1.5 border focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-400 transition ${getStatusClasses(task.status)}" data-type="status" data-id="${task.id}">
                <option value="Belum Dikerjakan" ${task.status === 'Belum Dikerjakan' ? 'selected' : ''}>Belum</option>
                <option value="Sudah Dikerjakan" ${task.status === 'Sudah Dikerjakan' ? 'selected' : ''}>Selesai</option>
            </select>
        </td>
        <td class="px-6 py-4 text-right text-sm font-medium">
            <button class="text-gray-400 hover:text-red-600 p-2 rounded-full hover:bg-red-100 dark:hover:bg-red-900/50 transition duration-150" data-type="delete" data-id="${task.id}" title="Hapus tugas">
                <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19,7H16V6a3,3,0,0,0-3-3H11A3,3,0,0,0,8,6V7H5A1,1,0,0,0,5,9H6V19a3,3,0,0,0,3,3h6a3,3,0,0,0,3-3V9h1a1,1,0,0,0,0-2ZM10,6a1,1,0,0,1,1-1h2a1,1,0,0,1,1,1V7H10Zm6,13a1,1,0,0,1-1,1H9a1,1,0,0,1-1-1V9h8Z"/>
                </svg>
            </button>
        </td>
    `;
    
    // Store original values for change detection
    originalValues.set(`${task.id}-priority`, task.priority);
    originalValues.set(`${task.id}-status`, task.status);
    originalValues.set(`${task.id}-deadline`, task.deadline);

    // Buat detail row jika ada catatan
    if (task.notes) {
        const detailRow = document.createElement('tr');
        detailRow.className = `task-detail-row hidden ${rowClass}`;
        detailRow.setAttribute('data-task-id', task.id);
        detailRow.innerHTML = `
            <td colspan="5" class="px-6 py-0">
                <div class="detail-content overflow-hidden transition-all duration-300 max-h-0">
                    <div class="py-4 border-t border-gray-200 dark:border-gray-700">
                        <div class="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
                            <div class="flex items-start gap-3">
                                <svg class="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M14,2H6A2,2,0,0,0,4,4V20a2,2,0,0,0,2,2H18a2,2,0,0,0,2-2V8ZM18,20H6V4h7V9a1,1,0,0,0,1,1h4Z"/>
                                </svg>
                                <div class="flex-1">
                                    <h4 class="text-sm font-semibold text-gray-900 dark:text-gray-200 mb-2">Catatan:</h4>
                                    <div class="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                                        ${parseMarkdownLinks(task.notes)}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </td>
        `;
        
        // Return container dengan kedua row
        const container = document.createDocumentFragment();
        container.appendChild(tr);
        container.appendChild(detailRow);
        return container;
    }

    return tr;
}

function renderMobileTask(task) {
    const deadlineText = formatDate(task.deadline);
    const isTaskOverdue = isOverdue(task.deadline);
    const card = document.createElement('div');
    
    const completedClass = task.status === 'Sudah Dikerjakan' ? 'bg-green-50/50 dark:bg-green-900/20' : 'bg-white dark:bg-gray-800';
    const overdueClass = isTaskOverdue && task.status !== 'Sudah Dikerjakan' ? 'border-red-300 dark:border-red-500' : 'border-gray-200 dark:border-gray-700';
    
    card.className = `task-card-mobile rounded-lg shadow-lg border ${overdueClass} ${completedClass} hover-lift transition-all duration-200`;
    
    card.innerHTML = `
        <!-- Task Header -->
        <div class="flex justify-between items-start mb-3">
            <div class="flex-1 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors" onclick="showTaskDetail('${task.id}')">
                <h3 class="font-bold text-lg ${task.status === 'Sudah Dikerjakan' ? 'text-gray-400 dark:text-gray-500 line-through' : 'text-gray-900 dark:text-gray-200'}">
                    ${task.text}
                </h3>
                ${task.notes ? `
                    <div class="text-xs text-blue-600 dark:text-blue-400 mt-1 opacity-75">
                        <svg class="w-3 h-3 inline mr-1" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M14,2H6A2,2,0,0,0,4,4V20a2,2,0,0,0,2,2H18a2,2,0,0,0,2-2V8ZM18,20H6V4h7V9a1,1,0,0,0,1,1h4Z"/>
                        </svg>
                        Ada catatan - Tap untuk detail
                    </div>
                ` : ''}
            </div>
            <button class="ml-2 text-gray-400 hover:text-red-600 p-1 rounded-full hover:bg-red-100 dark:hover:bg-red-900/50 transition-all flex-shrink-0" data-type="delete" data-id="${task.id}" title="Hapus tugas">
                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19,7H16V6a3,3,0,0,0-3-3H11A3,3,0,0,0,8,6V7H5A1,1,0,0,0,5,9H6V19a3,3,0,0,0,3,3h6a3,3,0,0,0,3-3V9h1a1,1,0,0,0,0-2ZM10,6a1,1,0,0,1,1-1h2a1,1,0,0,1,1,1V7H10Zm6,13a1,1,0,0,1-1,1H9a1,1,0,0,1-1-1V9h8Z"/>
                </svg>
            </button>
        </div>
        
        <!-- Deadline -->
        <div class="mb-3 text-sm">
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <svg class="w-4 h-4 text-gray-500 dark:text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M19,3H18V1a1,1,0,0,0-2,0V3H8V1A1,1,0,0,0,6,1V3H5A3,3,0,0,0,2,6V19a3,3,0,0,0,3,3H19a3,3,0,0,0,3-3V6A3,3,0,0,0,19,3ZM4,19V9H20V19a1,1,0,0,1-1,1H5A1,1,0,0,1,4,19Z"/>
                    </svg>
                    <span class="font-medium text-gray-600 dark:text-gray-400">Deadline:</span>
                    <span class="text-xs ${isTaskOverdue && task.status !== 'Sudah Dikerjakan' ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-gray-600 dark:text-gray-400'}">${deadlineText}</span>
                </div>
                <button class="text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 p-1 rounded transition-all duration-200"
                        data-type="edit-deadline" 
                        data-id="${task.id}" 
                        data-deadline="${task.deadline || ''}"
                        title="Edit deadline">
                    <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                    </svg>
                </button>
            </div>
        </div>
        
        <!-- Controls - Stacked vertically on mobile -->
        <div class="space-y-3">
            <!-- Priority Row -->
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <svg class="w-4 h-4 text-gray-500 dark:text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12,2l3.09,6.26L22,9.27l-5,4.87L18.18,22,12,18.77,5.82,22,7,14.14,2,9.27l6.91-1.01Z"/>
                    </svg>
                    <span class="font-medium text-gray-600 dark:text-gray-400 text-sm">Prioritas</span>
                </div>
                <select class="custom-select text-xs font-semibold rounded-md px-3 py-1.5 border focus:outline-none focus:ring-2 focus:ring-blue-400 transition ${getPriorityClasses(task.priority)}" data-type="priority" data-id="${task.id}">
                    <option value="Rendah" ${task.priority === 'Rendah' ? 'selected' : ''}>Rendah</option>
                    <option value="Sedang" ${task.priority === 'Sedang' ? 'selected' : ''}>Sedang</option>
                    <option value="Tinggi" ${task.priority === 'Tinggi' ? 'selected' : ''}>Tinggi</option>
                </select>
            </div>
            
            <!-- Status Row -->
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <svg class="w-4 h-4 text-gray-500 dark:text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M10.3,12.3a1,1,0,0,0,1.4,0L15.29,8.71a1,1,0,1,0-1.41-1.42L11,10.17,9.12,8.29a1,1,0,0,0-1.41,1.42ZM12,2A10,10,0,1,0,22,12,10,10,0,0,0,12,2Zm0,18a8,8,0,1,1,8-8A8,8,0,0,1,12,20Z"/>
                    </svg>
                    <span class="font-medium text-gray-600 dark:text-gray-400 text-sm">Status</span>
                </div>
                <select class="custom-select text-xs font-semibold rounded-md px-3 py-1.5 border focus:outline-none focus:ring-2 focus:ring-blue-400 transition ${getStatusClasses(task.status)}" data-type="status" data-id="${task.id}">
                    <option value="Belum Dikerjakan" ${task.status === 'Belum Dikerjakan' ? 'selected' : ''}>Belum</option>
                    <option value="Sudah Dikerjakan" ${task.status === 'Sudah Dikerjakan' ? 'selected' : ''}>Selesai</option>
                </select>
            </div>
        </div>
    `;
    
    // Store original values for change detection
    originalValues.set(`${task.id}-priority`, task.priority);
    originalValues.set(`${task.id}-status`, task.status);
    originalValues.set(`${task.id}-deadline`, task.deadline);
    
    return card;
}

function renderTasks(tasks) {
    taskListDesktop.innerHTML = '';
    taskListMobile.innerHTML = '';
    
    if (tasks.length === 0) {
        emptyState.classList.remove('hidden');
    } else {
        emptyState.classList.add('hidden');
        
        // Sort tasks by priority
        tasks.sort((a, b) => {
            const priorityOrder = { 'Tinggi': 3, 'Sedang': 2, 'Rendah': 1 };
            return priorityOrder[b.priority] - priorityOrder[a.priority];
        });

        tasks.forEach((task, index) => {
            // Render for desktop
            taskListDesktop.appendChild(renderDesktopTask(task, index + 1));
            
            // Render for mobile
            taskListMobile.appendChild(renderMobileTask(task));
        });
    }
    
    updateStatistics(tasks);
}

// Task Actions
// Store original values to detect actual changes
const originalValues = new Map();

async function handleTaskAction(e) {
    const target = e.target.closest('[data-id]');
    if (!target || !tasksCollectionRef) return;
    
    const { type, id } = target.dataset;
    const taskRef = doc(tasksCollectionRef, id);

    try {
        if (type === 'delete') {
            // Get task text for preview in modal
            const taskRow = target.closest('tr, .task-card-mobile');
            const taskText = taskRow ? 
                (taskRow.querySelector('h3')?.textContent || 
                 taskRow.querySelector('[class*="text-gray-900"]')?.textContent || 
                 'Tugas ini') : 'Tugas ini';
            
            // Show custom delete modal
            showDeleteModal(taskText, async () => {
                await deleteDoc(taskRef);
                showNotification('Tugas berhasil dihapus', 'success');
            });
        } else if (type === 'status') {
            // Only handle change events, not clicks
            if (e.type === 'click') return;
            
            // Get original value to compare
            const originalKey = `${id}-status`;
            const originalValue = originalValues.get(originalKey);
            
            // Only update and notify if value actually changed
            if (target.value !== originalValue) {
                // Simple processing lock
                if (!window.processing) window.processing = new Set();
                const lockKey = `status-${id}`;
                
                if (window.processing.has(lockKey)) return;
                window.processing.add(lockKey);
                
                try {
                    await updateDoc(taskRef, { status: target.value });
                    
                    const message = target.value === 'Sudah Dikerjakan' ? 
                        'Selamat! Tugas selesai!' : 
                        'Status tugas diperbarui';
                    showNotification(message, 'success', 3000);
                    
                    // Update stored value
                    originalValues.set(originalKey, target.value);
                } finally {
                    setTimeout(() => window.processing.delete(lockKey), 500);
                }
            }
        } else if (type === 'priority') {
            // Only handle change events, not clicks
            if (e.type === 'click') return;
            
            // Get original value to compare
            const originalKey = `${id}-priority`;
            const originalValue = originalValues.get(originalKey);
            
            // Only update if value actually changed
            if (target.value !== originalValue) {
                // Simple processing lock
                if (!window.processing) window.processing = new Set();
                const lockKey = `priority-${id}`;
                
                if (window.processing.has(lockKey)) return;
                window.processing.add(lockKey);
                
                try {
                    await updateDoc(taskRef, { priority: target.value });
                    showNotification(`Prioritas diubah ke ${target.value}`, 'info', 2000);
                    
                    // Update stored value
                    originalValues.set(originalKey, target.value);
                } finally {
                    setTimeout(() => window.processing.delete(lockKey), 500);
                }
            }
        } else if (type === 'deadline') {
            // Only handle change events for deadline inputs
            if (e.type === 'click') return;
            
            // Get original value to compare
            const originalKey = `${id}-deadline`;
            const originalValue = originalValues.get(originalKey);
            
            // Only update if value actually changed
            if (target.value !== originalValue) {
                // Simple processing lock
                if (!window.processing) window.processing = new Set();
                const lockKey = `deadline-${id}`;
                
                if (window.processing.has(lockKey)) return;
                window.processing.add(lockKey);
                
                try {
                    await updateDoc(taskRef, { deadline: target.value });
                    
                    const deadlineText = target.value ? 
                        `diperbarui ke ${new Date(target.value).toLocaleDateString('id-ID')}` : 
                        'dihapus';
                    showNotification(`Deadline ${deadlineText}`, 'info', 2000);
                    
                    // Update stored value
                    originalValues.set(originalKey, target.value);
                } finally {
                    setTimeout(() => window.processing.delete(lockKey), 500);
                }
            }
        }
    } catch (error) {
        console.error('Error updating task:', error);
        showNotification('Gagal memperbarui tugas. Coba lagi.', 'error');
    }
}

async function addTask(e) {
    e.preventDefault();
    console.log('Form submitted!', 'Event type:', e.type, 'isTrusted:', e.isTrusted);
    
    const text = taskInput?.value?.trim();
    const notes = notesInput?.value?.trim() || '';
    const deadline = deadlineInput?.value || '';
    const priority = priorityInput?.value || 'Sedang';
    
    console.log('Form data:', { text, notes, deadline, priority });
    
    if (!text) {
        console.log('No task text entered');
        showNotification('Harap isi nama tugas!', 'warning');
        taskInput?.focus();
        return;
    }
    
    console.log('Task text OK:', text);
    
        // No notifications    // OFFLINE MODE FALLBACK
    if (!tasksCollectionRef || !auth?.currentUser) {
        console.log('OFFLINE MODE: Saving locally...');
        
        // Add to local tasks array
        const localTask = {
            id: 'local_' + Date.now(),
            text: text,
            notes: notes,
            deadline: deadline,
            priority: priority,
            status: 'Belum Dikerjakan',
            createdAt: new Date()
        };
        
        tasks.unshift(localTask);
        renderTasks(tasks);
        updateStatistics(tasks);
        
        // Clear form and focus with delay to ensure proper reset
        setTimeout(() => {
            resetTaskForm();
        }, 100);
        
        showNotification('Tugas disimpan offline! (Firebase connection issue)', 'warning');
        return;
    }
    
    if (!tasksCollectionRef) {
        console.log('Collection ref not ready');
        showNotification('Database belum siap, coba lagi!', 'error');
        return;
    }

    // Show loading state
    const submitBtn = taskForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<span class="loading-spinner"></span> Menambah...';
    submitBtn.disabled = true;

    try {
        console.log('SAVING TO FIREBASE...');
        
        const newTask = {
            text: text,
            notes: notes,
            deadline: deadline,
            priority: priorityInput?.value || 'Sedang',
            status: 'Belum Dikerjakan',
            createdAt: new Date(),
            userId: auth.currentUser.uid
        };
        
        console.log('Task data:', newTask);
        
        const docRef = await addDoc(tasksCollectionRef, newTask);
        console.log('TASK SAVED! ID:', docRef.id);
        
        // Reset form and clear draft with small delay to ensure proper reset
        setTimeout(() => {
            resetTaskForm();
        }, 100);
        showNotification('Tugas berhasil ditambahkan!', 'success');
        
    } catch (error) {
        console.error('SAVE ERROR:', error);
        
        // Still reset form even on error
        resetTaskForm();
        
        // Show user-friendly error message
        if (error.code === 'permission-denied') {
            showNotification('Tidak ada izin untuk menyimpan tugas. Periksa koneksi Firebase.', 'error');
        } else if (error.code === 'unavailable') {
            showNotification('Firebase tidak tersedia. Coba lagi nanti.', 'error');
        } else {
            showNotification('Gagal menyimpan tugas: ' + error.message, 'error');
        }
    } finally {
        // Restore button
        if (submitBtn) {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    }
}

// Statistics
function updateStatistics(tasks) {
    const total = tasks.length;
    const completed = tasks.filter(task => task.status === 'Sudah Dikerjakan').length;
    const pending = total - completed;
    
    totalTasksEl.textContent = total;
    completedTasksEl.textContent = completed;
    pendingTasksEl.textContent = pending;
    
    const progressPercentage = total === 0 ? 0 : (completed / total) * 100;
    
    // Remove existing width classes and add new one
    progressBar.className = progressBar.className.replace(/w-\[\d+%\]/, '');
    progressBar.style.width = `${progressPercentage}%`;
}

// Authentication and Database Setup
function setupFirebaseListeners(userId) {
    try {
        console.log('Setting up Firebase listeners for user:', userId);
        
        // Create collection reference
        tasksCollectionRef = collection(db, DEFAULT_APP_ID, userId, 'tasks');
        console.log('Created tasks collection reference');
        
        // LANGSUNG HIDE LOADING
        console.log('FORCE HIDE LOADING NOW!');
        hideLoading();
        
        // BACKUP: Force hide after 2 seconds
        setTimeout(() => {
            console.log('BACKUP HIDE LOADING');
            hideLoading();
        }, 2000);
        
        // Simple query without complex ordering that might fail
        const q = query(tasksCollectionRef);
        
        console.log('Starting to listen for tasks...');
        onSnapshot(q, (snapshot) => {
            console.log('SNAPSHOT:', snapshot.size, 'docs');
            
            tasks = [];
            snapshot.forEach(doc => {
                tasks.push({ ...doc.data(), id: doc.id });
            });
            
            console.log('TASKS:', tasks.length);
            
            // LANGSUNG RENDER
            renderTasks(tasks);
            updateStatistics(tasks);
            
        }, (error) => {
            console.error('SNAPSHOT ERROR:', error);
            console.log('FIREBASE RULES ERROR - CHECK FIRESTORE RULES U Dumbass >w<!');
            
            // Force show container even with error
            hideLoading();
            
            // Show alert to user
            alert('Firebase Error: ' + error.message + '\\n\\nCek Firebase Firestore Rules!');
        });
        
        window.firebaseConnected = true;
        
    } catch (error) {
        console.error('Error setting up Firebase listeners:', error);
        hideLoading();
        showNotification(`Gagal setup: ${error.message}`, 'error');
    }
}



// Event Listeners
function setupEventListeners() {
    console.log('Setting up event listeners...');
    
    if (taskForm) {
        taskForm.addEventListener('submit', addTask);
        console.log('Form submit listener added');
    } else {
        console.error('Task form not found!');
    }
    
    // Use change for dropdowns (status/priority) and click for buttons (delete)
    document.body.addEventListener('change', handleTaskAction);
    document.body.addEventListener('click', (e) => {
        // Only handle click for delete buttons, not dropdowns
        if (e.target.closest('[data-type="delete"]')) {
            handleTaskAction(e);
        }
        // Handle edit deadline button clicks
        if (e.target.closest('[data-type="edit-deadline"]')) {
            const button = e.target.closest('[data-type="edit-deadline"]');
            const taskId = button.dataset.id;
            const currentDeadline = button.dataset.deadline || '';
            editDeadline(taskId, currentDeadline);
        }
        // Handle toggle details button clicks
        if (e.target.closest('[data-type="toggle-details"]')) {
            const button = e.target.closest('[data-type="toggle-details"]');
            const taskId = button.dataset.id;
            toggleTaskDetails(taskId);
        }
    });
    
    // Auto-save draft functionality
    [taskInput, notesInput, deadlineInput, priorityInput].forEach(input => {
        if (input) {
            input.addEventListener('input', () => {
                clearTimeout(autoSaveTimeout);
                autoSaveTimeout = setTimeout(saveDraft, 1000);
            });
        }
    });
    
    // Load draft on page load
    loadDraft();
    
    // Embedded Link functionality
    const embedLinkBtn = document.getElementById('embed-link-btn');
    if (embedLinkBtn && notesInput) {
        embedLinkBtn.addEventListener('click', () => {
            handleEmbedLink();
        });
    }
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Ctrl/Cmd + Enter to submit form
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            if (taskInput.value.trim()) {
                // Create proper submit event like normal form submission
                const submitEvent = new Event('submit', {
                    bubbles: true,
                    cancelable: true
                });
                taskForm.dispatchEvent(submitEvent);
            }
        }
        
        // Escape to clear form
        if (e.key === 'Escape') {
            resetTaskForm();
            taskInput.focus();
        }
    });
    
    // Bulk delete functionality
    setupBulkDeleteListeners();
}

// Bulk Delete Functionality
function setupBulkDeleteListeners() {
    const toggleSelectionBtn = document.getElementById('toggle-selection-mode');
    const selectAllBtn = document.getElementById('select-all-btn');
    const deselectAllBtn = document.getElementById('deselect-all-btn');
    const bulkDeleteBtn = document.getElementById('bulk-delete-btn');
    const bulkActionsBar = document.getElementById('bulk-actions-bar');
    const selectionCount = document.getElementById('selection-count');
    
    let isSelectionMode = false;
    
    // Handle toggle selection mode with single/double click
    if (toggleSelectionBtn) {
        let clickCount = 0;
        let clickTimer = null;
        
        toggleSelectionBtn.addEventListener('click', (e) => {
            e.preventDefault();
            clickCount++;
            
            if (clickCount === 1) {
                // Single click - wait to see if double click
                clickTimer = setTimeout(() => {
                    // Single click confirmed - toggle selection mode
                    const taskContainer = document.getElementById('task-container');
                    const currentlyInSelectionMode = taskContainer?.classList.contains('selection-mode');
                    
                    if (currentlyInSelectionMode) {
                        // Exit selection mode
                        isSelectionMode = false;
                        toggleSelectionMode(isSelectionMode);
                    } else {
                        // Enter selection mode
                        isSelectionMode = true;
                        toggleSelectionMode(isSelectionMode);
                    }
                    clickCount = 0;
                }, 250); // Reduced timeout for better responsiveness
            } else if (clickCount === 2) {
                // Double click detected - clear single click timer
                clearTimeout(clickTimer);
                clickCount = 0;
                
                const taskContainer = document.getElementById('task-container');
                const currentlyInSelectionMode = taskContainer?.classList.contains('selection-mode');
                
                if (currentlyInSelectionMode) {
                    // Double click in selection mode - toggle select all
                    const checkboxes = document.querySelectorAll('.task-checkbox');
                    const checked = document.querySelectorAll('.task-checkbox:checked');
                    
                    if (checked.length === checkboxes.length && checkboxes.length > 0) {
                        // All selected, deselect all
                        checkboxes.forEach(checkbox => checkbox.checked = false);
                        console.log('Double click: Deselected all tasks');
                    } else {
                        // Not all selected, select all
                        checkboxes.forEach(checkbox => checkbox.checked = true);
                        console.log('Double click: Selected all tasks');
                    }
                    updateBulkSelectionUI();
                } else {
                    // Double click when not in selection mode - enter selection mode and select all
                    isSelectionMode = true;
                    toggleSelectionMode(isSelectionMode);
                    
                    // Wait a bit for DOM to update, then select all
                    setTimeout(() => {
                        const checkboxes = document.querySelectorAll('.task-checkbox');
                        checkboxes.forEach(checkbox => checkbox.checked = true);
                        updateBulkSelectionUI();
                        console.log('Double click: Entered selection mode and selected all');
                    }, 50);
                }
            }
        });
    }
    
    // Handle individual checkbox changes
    document.body.addEventListener('change', (e) => {
        if (e.target.classList.contains('task-checkbox')) {
            updateBulkSelectionUI();
        }
    });
    
    // Handle select all button
    if (selectAllBtn) {
        selectAllBtn.addEventListener('click', () => {
            document.querySelectorAll('.task-checkbox').forEach(checkbox => {
                checkbox.checked = true;
            });
            if (selectAllCheckbox) selectAllCheckbox.checked = true;
            updateBulkSelectionUI();
        });
    }
    
    // Handle deselect all button
    if (deselectAllBtn) {
        deselectAllBtn.addEventListener('click', () => {
            document.querySelectorAll('.task-checkbox').forEach(checkbox => {
                checkbox.checked = false;
            });
            if (selectAllCheckbox) selectAllCheckbox.checked = false;
            updateBulkSelectionUI();
        });
    }
    
    // Handle exit selection button
    const exitSelectionBtn = document.getElementById('exit-selection-btn');
    if (exitSelectionBtn) {
        exitSelectionBtn.addEventListener('click', () => {
            isSelectionMode = false;
            toggleSelectionMode(isSelectionMode);
        });
    }
    
    // Handle bulk delete button
    if (bulkDeleteBtn) {
        bulkDeleteBtn.addEventListener('click', () => {
            const selectedTasks = getSelectedTasks();
            if (selectedTasks.length > 0) {
                showBulkDeleteModal(selectedTasks);
            }
        });
    }
}

function toggleSelectionMode(isActive) {
    const taskContainer = document.getElementById('task-container');
    const toggleBtn = document.getElementById('toggle-selection-mode');
    const bulkActionsBar = document.getElementById('bulk-actions-bar');
    
    if (isActive) {
        // Enable selection mode
        taskContainer?.classList.add('selection-mode');
        toggleBtn?.classList.add('active');
        
        // Show bulk actions bar if any tasks are selected
        const selectedCount = document.querySelectorAll('.task-checkbox:checked').length;
        if (selectedCount > 0) {
            bulkActionsBar?.classList.remove('hidden');
        }
        
        // Update icon to show "active" state
        if (toggleBtn) {
            const svg = toggleBtn.querySelector('svg');
            if (svg) {
                svg.innerHTML = `<path d="M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22A10,10 0 0,1 2,12A10,10 0 0,1 12,2M11,16.5L18,9.5L16.59,8.09L11,13.67L7.91,10.59L6.5,12L11,16.5Z"/>`;
                svg.classList.add('text-purple-600', 'dark:text-purple-400');
                svg.classList.remove('text-gray-500', 'dark:text-gray-400');
            }
        }
    } else {
        // Disable selection mode
        taskContainer?.classList.remove('selection-mode');
        toggleBtn?.classList.remove('active');
        bulkActionsBar?.classList.add('hidden');
        
        // Clear all selections
        document.querySelectorAll('.task-checkbox:checked').forEach(checkbox => {
            checkbox.checked = false;
        });
        
        // Reset icon to default state
        if (toggleBtn) {
            const svg = toggleBtn.querySelector('svg');
            if (svg) {
                svg.innerHTML = `<path d="M9,20.42L2.79,14.21L5.62,11.38L9,14.77L18.88,4.88L21.71,7.71L9,20.42Z"/>`;
                svg.classList.remove('text-purple-600', 'dark:text-purple-400');
                svg.classList.add('text-gray-500', 'dark:text-gray-400');
            }
        }
    }
    
    updateBulkSelectionUI();
}

function updateBulkSelectionUI() {
    const checkboxes = document.querySelectorAll('.task-checkbox');
    const checked = document.querySelectorAll('.task-checkbox:checked');
    const bulkActionsBar = document.getElementById('bulk-actions-bar');
    const selectionCount = document.getElementById('selection-count');
    const toggleBtn = document.getElementById('toggle-selection-mode');
    const taskContainer = document.getElementById('task-container');
    
    // Only show bulk actions if in selection mode
    const isSelectionMode = taskContainer?.classList.contains('selection-mode');
    
    if (isSelectionMode && checked.length > 0) {
        bulkActionsBar?.classList.remove('hidden');
        if (selectionCount) {
            selectionCount.textContent = `${checked.length} tugas dipilih`;
        }
    } else {
        bulkActionsBar?.classList.add('hidden');
    }
    
    // Update toggle button state based on selection
    if (toggleBtn && isSelectionMode) {
        const svg = toggleBtn.querySelector('svg');
        if (svg) {
            if (checked.length === checkboxes.length && checkboxes.length > 0) {
                // All selected - filled circle check dengan purple yang lebih terang
                svg.innerHTML = `<path d="M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22A10,10 0 0,1 2,12A10,10 0 0,1 12,2Z M11,16.5L18,9.5L16.59,8.09L11,13.67L7.91,10.59L6.5,12L11,16.5Z"/>`;
                svg.classList.add('text-purple-700', 'dark:text-purple-300');
                svg.classList.remove('text-purple-600', 'dark:text-purple-400');
            } else if (checked.length > 0) {
                // Partial selection - dash icon dengan purple 
                svg.innerHTML = `<path d="M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22A10,10 0 0,1 2,12A10,10 0 0,1 12,2M8,11V13H16V11H8Z"/>`;
                svg.classList.add('text-purple-500', 'dark:text-purple-500');
                svg.classList.remove('text-purple-600', 'dark:text-purple-400', 'text-purple-700', 'dark:text-purple-300');
            } else {
                // None selected - active selection mode 
                svg.innerHTML = `<path d="M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22A10,10 0 0,1 2,12A10,10 0 0,1 12,2M11,16.5L18,9.5L16.59,8.09L11,13.67L7.91,10.59L6.5,12L11,16.5Z"/>`;
                svg.classList.add('text-purple-600', 'dark:text-purple-400');
                svg.classList.remove('text-purple-700', 'dark:text-purple-300', 'text-purple-500', 'dark:text-purple-500');
            }
        }
    }
}

function getSelectedTasks() {
    const selected = [];
    document.querySelectorAll('.task-checkbox:checked').forEach(checkbox => {
        const taskId = checkbox.dataset.id;
        const task = tasks.find(t => t.id === taskId);
        if (task) {
            selected.push(task);
        }
    });
    return selected;
}

function showBulkDeleteModal(selectedTasks) {
    const modal = document.getElementById('bulk-delete-modal');
    const countSpan = document.getElementById('bulk-count');
    const previewList = document.getElementById('bulk-delete-preview');
    const confirmBtn = document.getElementById('confirm-bulk-delete');
    const cancelBtn = document.getElementById('cancel-bulk-delete');
    
    if (!modal) return;
    
    // Update count
    if (countSpan) countSpan.textContent = selectedTasks.length;
    
    // Update preview list
    if (previewList) {
        previewList.innerHTML = selectedTasks.map(task => `
            <li class="flex items-center gap-2 p-2 bg-white dark:bg-gray-600 rounded border">
                <svg class="w-3 h-3 text-gray-400 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M14,2H6A2,2,0,0,0,4,4V20a2,2,0,0,0,2,2H18a2,2,0,0,0,2-2V8ZM18,20H6V4h7V9a1,1,0,0,0,1,1h4Z"/>
                </svg>
                <span class="text-sm">${task.text}</span>
            </li>
        `).join('');
    }
    
    // Show modal
    modal.classList.remove('hidden');
    
    // Handle confirm
    const handleConfirm = async () => {
        try {
            await deleteBulkTasks(selectedTasks);
            modal.classList.add('hidden');
            showNotification(`${selectedTasks.length} tugas berhasil dihapus`, 'success');
        } catch (error) {
            showNotification('Gagal menghapus tugas: ' + error.message, 'error');
        }
        cleanup();
    };
    
    // Handle cancel
    const handleCancel = () => {
        modal.classList.add('hidden');
        cleanup();
    };
    
    // Handle backdrop click
    const handleBackdropClick = (e) => {
        if (e.target === modal) {
            handleCancel();
        }
    };
    
    const cleanup = () => {
        confirmBtn?.removeEventListener('click', handleConfirm);
        cancelBtn?.removeEventListener('click', handleCancel);
        modal.removeEventListener('click', handleBackdropClick);
    };
    
    // Add event listeners
    confirmBtn?.addEventListener('click', handleConfirm);
    cancelBtn?.addEventListener('click', handleCancel);
    modal.addEventListener('click', handleBackdropClick);
}

async function deleteBulkTasks(selectedTasks) {
    const promises = selectedTasks.map(task => {
        if (tasksCollectionRef) {
            const taskRef = doc(tasksCollectionRef, task.id);
            return deleteDoc(taskRef);
        }
        return Promise.resolve();
    });
    
    await Promise.all(promises);
    
    // Clear selection
    document.querySelectorAll('.task-checkbox:checked').forEach(checkbox => {
        checkbox.checked = false;
    });
    updateBulkSelectionUI();
}

// Edit deadline function
function editDeadline(taskId, currentDeadline) {
    // Create inline date picker modal
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50';
    modal.innerHTML = `
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-sm w-full mx-4 transform transition-all">
            <div class="p-6">
                <div class="flex items-center gap-3 mb-4">
                    <div class="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                        <svg class="w-5 h-5 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M19,3H18V1a1,1,0,0,0-2,0V3H8V1A1,1,0,0,0,6,1V3H5A3,3,0,0,0,2,6V19a3,3,0,0,0,3,3H19a3,3,0,0,0,3-3V6A3,3,0,0,0,19,3ZM4,19V9H20V19a1,1,0,0,1-1,1H5A1,1,0,0,1,4,19Z"/>
                        </svg>
                    </div>
                    <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Edit Deadline</h3>
                </div>
                
                <div class="mb-6">
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Pilih Tanggal:</label>
                    <input type="date" id="deadline-edit-input" value="${currentDeadline}" 
                           class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
                
                <div class="flex justify-end gap-3">
                    <button id="cancel-deadline" class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors">
                        Batal
                    </button>
                    <button id="remove-deadline" class="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 bg-white dark:bg-gray-700 border border-red-300 dark:border-red-600 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                        Hapus
                    </button>
                    <button id="save-deadline" class="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors flex items-center gap-2">
                        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M19,13h-6v6a1,1,0,0,1-2,0V13H5a1,1,0,0,1,0-2h6V5a1,1,0,0,1,2,0v6h6a1,1,0,0,1,0,2Z"/>
                        </svg>
                        Simpan
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Get elements
    const dateInput = modal.querySelector('#deadline-edit-input');
    const cancelBtn = modal.querySelector('#cancel-deadline');
    const removeBtn = modal.querySelector('#remove-deadline');
    const saveBtn = modal.querySelector('#save-deadline');
    
    // Focus on date input
    dateInput.focus();
    
    // Handle close
    const closeModal = () => modal.remove();
    
    cancelBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
    
    // Handle remove deadline
    removeBtn.addEventListener('click', async () => {
        try {
            const taskRef = doc(tasksCollectionRef, taskId);
            await updateDoc(taskRef, { deadline: '' });
            showNotification('Deadline berhasil dihapus', 'success', 2000);
            closeModal();
        } catch (error) {
            showNotification('Gagal menghapus deadline', 'error', 3000);
        }
    });
    
    // Handle save
    saveBtn.addEventListener('click', async () => {
        try {
            const newDate = dateInput.value;
            const taskRef = doc(tasksCollectionRef, taskId);
            await updateDoc(taskRef, { deadline: newDate });
            
            const message = newDate ? 
                `Deadline diperbarui ke ${new Date(newDate).toLocaleDateString('id-ID')}` : 
                'Deadline dihapus';
            showNotification(message, 'success', 2000);
            closeModal();
        } catch (error) {
            showNotification('Gagal memperbarui deadline', 'error', 3000);
        }
    });
    
    // Keyboard shortcuts
    dateInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            saveBtn.click();
        }
    });
}

// Toggle inline task details
function toggleTaskDetails(taskId) {
    const detailRow = document.querySelector(`tr.task-detail-row[data-task-id="${taskId}"]`);
    const toggleButton = document.querySelector(`[data-type="toggle-details"][data-id="${taskId}"]`);
    
    if (!detailRow || !toggleButton) return;
    
    const detailContent = detailRow.querySelector('.detail-content');
    const toggleText = toggleButton.querySelector('.toggle-text');
    const toggleArrow = toggleButton.querySelector('.toggle-arrow');
    const isExpanded = !detailRow.classList.contains('hidden');
    
    if (isExpanded) {
        // Collapse
        detailContent.style.maxHeight = '0px';
        setTimeout(() => {
            detailRow.classList.add('hidden');
        }, 300);
        toggleText.textContent = 'Ada catatan - Klik untuk detail';
        toggleArrow.style.transform = 'rotate(0deg)';
    } else {
        // Expand
        detailRow.classList.remove('hidden');
        // Hitung tinggi content untuk animasi smooth
        const scrollHeight = detailContent.scrollHeight;
        detailContent.style.maxHeight = scrollHeight + 'px';
        toggleText.textContent = 'Sembunyikan detail';
        toggleArrow.style.transform = 'rotate(180deg)';
    }
}

// Truncate text function
function truncateText(text, maxLines = 3) {
    if (!text) return '';
    
    const words = text.split(' ');
    const wordsPerLine = 8; // Approximate words per line
    const maxWords = maxLines * wordsPerLine;
    
    if (words.length <= maxWords) {
        return text;
    }
    
    return words.slice(0, maxWords).join(' ') + '...';
}

// Show task detail modal
function showTaskDetail(taskId) {
    // Find task by ID
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    
    const deadlineText = formatDate(task.deadline);
    const isTaskOverdue = isOverdue(task.deadline);
    
    // Create modal HTML
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50';
    modal.innerHTML = `
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto transform transition-all">
            <div class="sticky top-0 bg-white dark:bg-gray-800 p-6 border-b border-gray-200 dark:border-gray-600 rounded-t-lg">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                            <svg class="w-5 h-5 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M14,2H6A2,2,0,0,0,4,4V20a2,2,0,0,0,2,2H18a2,2,0,0,0,2-2V8ZM18,20H6V4h7V9a1,1,0,0,0,1,1h4Z"/>
                            </svg>
                        </div>
                        <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Detail Tugas</h3>
                    </div>
                    <button class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 rounded transition-colors" onclick="this.closest('.fixed').remove()">
                        <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                        </svg>
                    </button>
                </div>
            </div>
            
            <div class="p-6">
                <!-- Task Title -->
                <div class="mb-6">
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Judul Tugas:</label>
                    <div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 text-gray-900 dark:text-gray-100 ${task.status === 'Sudah Dikerjakan' ? 'line-through text-gray-500' : ''}">
                        ${task.text}
                    </div>
                </div>
                
                <!-- Notes -->
                ${task.notes ? `
                <div class="mb-6">
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Catatan:</label>
                    <div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
                        ${parseMarkdownLinks(task.notes)}
                    </div>
                </div>
                ` : ''}
                
                <!-- Details Grid -->
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <!-- Deadline -->
                    <div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                        <div class="flex items-center gap-2 mb-2">
                            <svg class="w-4 h-4 text-gray-500 dark:text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M19,3H18V1a1,1,0,0,0-2,0V3H8V1A1,1,0,0,0,6,1V3H5A3,3,0,0,0,2,6V19a3,3,0,0,0,3,3H19a3,3,0,0,0,3-3V6A3,3,0,0,0,19,3ZM4,19V9H20V19a1,1,0,0,1-1,1H5A1,1,0,0,1,4,19Z"/>
                            </svg>
                            <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Deadline:</span>
                        </div>
                        <p class="text-sm ${isTaskOverdue && task.status !== 'Sudah Dikerjakan' ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-gray-600 dark:text-gray-400'}">${deadlineText}</p>
                    </div>
                    
                    <!-- Priority -->
                    <div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                        <div class="flex items-center gap-2 mb-2">
                            <svg class="w-4 h-4 text-gray-500 dark:text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12,1L15.09,7.26L22,9L17,14.14L18.18,22L12,18.77L5.82,22L7,14.14L2,9L8.91,7.26Z"/>
                            </svg>
                            <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Prioritas:</span>
                        </div>
                        <p class="text-sm">
                            <span class="px-2 py-1 rounded-full text-xs font-medium ${getPriorityClasses(task.priority).replace('border-gray-300 dark:border-gray-600', '')}">${task.priority}</span>
                        </p>
                    </div>
                    
                    <!-- Status -->
                    <div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                        <div class="flex items-center gap-2 mb-2">
                            <svg class="w-4 h-4 text-gray-500 dark:text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M10.3,12.3a1,1,0,0,0,1.4,0L15.29,8.71a1,1,0,1,0-1.41-1.42L11,10.17,9.12,8.29a1,1,0,0,0-1.41,1.42ZM12,2A10,10,0,1,0,22,12,10,10,0,0,0,12,2Zm0,18a8,8,0,1,1,8-8A8,8,0,0,1,12,20Z"/>
                            </svg>
                            <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Status:</span>
                        </div>
                        <p class="text-sm">
                            <span class="px-2 py-1 rounded-full text-xs font-medium ${getStatusClasses(task.status).replace('border-gray-300 dark:border-gray-600', '')}">${task.status}</span>
                        </p>
                    </div>
                </div>
                
                <!-- Created Date -->
                <div class="text-xs text-gray-500 dark:text-gray-400 text-center">
                    Dibuat pada: ${task.createdAt ? new Date(task.createdAt.seconds ? task.createdAt.seconds * 1000 : task.createdAt).toLocaleDateString('id-ID', {
                        weekday: 'long',
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    }) : 'Tidak diketahui'}
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Close on backdrop click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
    
    // Close on Escape key
    document.addEventListener('keydown', function escapeHandler(e) {
        if (e.key === 'Escape') {
            modal.remove();
            document.removeEventListener('keydown', escapeHandler);
        }
    });
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing app...');
    
    // Show loading state first
    showLoading();
    
    // Initialize Firebase
    initializeFirebase();
    
    // Setup event listeners
    setupEventListeners();
    
    // Load draft on startup
    loadDraft();
    
    // FORCE HIDE LOADING setelah 3 detik jika masih ada
    setTimeout(() => {
        console.log('FINAL FORCE HIDE LOADING');
        hideLoading();
    }, 3000);
    
    console.log('App initialization complete!');
});