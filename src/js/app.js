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
        console.log('🔥 Initializing Firebase...');
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
        console.log('Firebase initialized successfully!');
        
        // Add a timeout fallback to hide loading after 5 seconds
        setTimeout(() => {
            if (loadingState && !loadingState.classList.contains('hidden')) {
                console.log('⏰ TIMEOUT: FORCE HIDE');
                hideLoading();
            }
        }, 5000);
        
        // Immediately try to authenticate
        console.log('🔐 Starting authentication...');
        
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
        console.log('🔥 HIDING LOADING...');
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
    } else if (date < today) {
        return `🚨 ${date.toLocaleDateString('id-ID')}`;
    } else {
        return `<svg class="w-4 h-4 inline mr-1" fill="currentColor" viewBox="0 0 24 24"><path d="M7 11h2v2H7zm0 4h2v2H7zm4-4h2v2h-2zm0 4h2v2h-2zm4-4h2v2h-2zm0 4h2v2h-2z"/><path d="M5 22h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-1V2h-2v2H8V2H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2zM19 8H5v12h14V8z"/></svg>${date.toLocaleDateString('id-ID')}`;
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
        console.log('🔥 Theme is:', isDark ? 'DARK' : 'LIGHT');
        
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
            console.log('💡 SWITCHED TO LIGHT');
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
function renderDesktopTask(task) {
    const deadlineText = formatDate(task.deadline);
    const isTaskOverdue = isOverdue(task.deadline);
    const tr = document.createElement('tr');
    
    const rowClass = task.status === 'Sudah Dikerjakan' ? 'bg-green-50/50 dark:bg-green-900/20' : 
                     (isTaskOverdue ? 'bg-red-50/30 dark:bg-red-900/20' : '');
    
    tr.className = `hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${rowClass}`;
    
    const taskContent = task.notes ? 
        `<div>
            <div class="${task.status === 'Sudah Dikerjakan' ? 'text-gray-400 dark:text-gray-500 line-through' : 'text-gray-900 dark:text-gray-200'}">${task.text}</div>
            <div class="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1">
                <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M14,2H6A2,2,0,0,0,4,4V20a2,2,0,0,0,2,2H18a2,2,0,0,0,2-2V8ZM18,20H6V4h7V9a1,1,0,0,0,1,1h4Z"/>
                </svg>
                ${task.notes}
            </div>
        </div>` :
        `<div class="${task.status === 'Sudah Dikerjakan' ? 'text-gray-400 dark:text-gray-500 line-through' : 'text-gray-900 dark:text-gray-200'}">${task.text}</div>`;
    
    tr.innerHTML = `
        <td class="px-6 py-4 text-sm font-medium">${taskContent}</td>
        <td class="px-6 py-4 text-sm ${isTaskOverdue && task.status !== 'Sudah Dikerjakan' ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-gray-600 dark:text-gray-400'}">${deadlineText}</td>
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
            <h3 class="font-bold text-lg flex-1 ${task.status === 'Sudah Dikerjakan' ? 'text-gray-400 dark:text-gray-500 line-through' : 'text-gray-900 dark:text-gray-200'}">${task.text}</h3>
            <button class="ml-2 text-gray-400 hover:text-red-600 p-1 rounded-full hover:bg-red-100 dark:hover:bg-red-900/50 transition-all flex-shrink-0" data-type="delete" data-id="${task.id}" title="Hapus tugas">
                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19,7H16V6a3,3,0,0,0-3-3H11A3,3,0,0,0,8,6V7H5A1,1,0,0,0,5,9H6V19a3,3,0,0,0,3,3h6a3,3,0,0,0,3-3V9h1a1,1,0,0,0,0-2ZM10,6a1,1,0,0,1,1-1h2a1,1,0,0,1,1,1V7H10Zm6,13a1,1,0,0,1-1,1H9a1,1,0,0,1-1-1V9h8Z"/>
                </svg>
            </button>
        </div>
        
        ${task.notes ? `
        <div class="mb-3 p-2 bg-gray-50 dark:bg-gray-700/50 rounded text-sm text-gray-600 dark:text-gray-400 flex items-start gap-2">
            <svg class="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                <path d="M14,2H6A2,2,0,0,0,4,4V20a2,2,0,0,0,2,2H18a2,2,0,0,0,2-2V8ZM18,20H6V4h7V9a1,1,0,0,0,1,1h4Z"/>
            </svg>
            <div>
                <strong>Catatan:</strong> ${task.notes}
            </div>
        </div>
        ` : ''}
        
        <!-- Deadline -->
        <div class="mb-3 text-sm flex items-center gap-2">
            <svg class="w-4 h-4 text-gray-500 dark:text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19,3H18V1a1,1,0,0,0-2,0V3H8V1A1,1,0,0,0,6,1V3H5A3,3,0,0,0,2,6V19a3,3,0,0,0,3,3H19a3,3,0,0,0,3-3V6A3,3,0,0,0,19,3ZM4,19V9H20V19a1,1,0,0,1-1,1H5A1,1,0,0,1,4,19Z"/>
            </svg>
            <span class="font-medium text-gray-600 dark:text-gray-400">Deadline:</span>
            <span class="${isTaskOverdue && task.status !== 'Sudah Dikerjakan' ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-gray-700 dark:text-gray-300'}">${deadlineText}</span>
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

        tasks.forEach(task => {
            // Render for desktop
            taskListDesktop.appendChild(renderDesktopTask(task));
            
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
            // Get original value to compare
            const originalKey = `${id}-status`;
            const originalValue = originalValues.get(originalKey);
            
            // Only update and notify if value actually changed
            if (target.value !== originalValue) {
                await updateDoc(taskRef, { status: target.value });
                const message = target.value === 'Sudah Dikerjakan' ? 
                    'Selamat! Tugas selesai!' : 
                    'Status tugas diperbarui';
                showNotification(message, 'success', 3000);
                // Update stored value
                originalValues.set(originalKey, target.value);
            }
        } else if (type === 'priority') {
            // Get original value to compare
            const originalKey = `${id}-priority`;
            const originalValue = originalValues.get(originalKey);
            
            // Only update if value actually changed (no notification for priority)
            if (target.value !== originalValue) {
                await updateDoc(taskRef, { priority: target.value });
                // Update stored value
                originalValues.set(originalKey, target.value);
            }
        }
    } catch (error) {
        console.error('Error updating task:', error);
        showNotification('Gagal memperbarui tugas. Coba lagi.', 'error');
    }
}

async function addTask(e) {
    e.preventDefault();
    console.log('Form submitted!');
    
    const text = taskInput?.value?.trim();
    const notes = notesInput?.value?.trim() || '';
    const deadline = deadlineInput?.value || '';
    
    console.log('Form data:', { text, notes, deadline });
    
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
            priority: priorityInput?.value || 'Sedang',
            status: 'Belum Dikerjakan',
            createdAt: new Date()
        };
        
        tasks.unshift(localTask);
        renderTasks(tasks);
        updateStatistics(tasks);
        
        // Clear form
        taskInput.value = '';
        if (notesInput) notesInput.value = '';
        if (deadlineInput) deadlineInput.value = '';
        if (priorityInput) priorityInput.value = 'Sedang';
        
        alert('Tugas disimpan offline! (Firebase rules error)');
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
        
        // Reset form
        taskInput.value = '';
        if (notesInput) notesInput.value = '';
        if (deadlineInput) deadlineInput.value = '';
        if (priorityInput) priorityInput.value = 'Sedang';
        
        // Clear draft
        clearDraft();
        
        // Focus back to input
        taskInput.focus();
        
    } catch (error) {
        console.error('SAVE ERROR:', error);
        alert('GAGAL SAVE: ' + error.message);
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
        console.log('🔥 FORCE HIDE LOADING NOW!');
        hideLoading();
        
        // BACKUP: Force hide after 2 seconds
        setTimeout(() => {
            console.log('🚨 BACKUP HIDE LOADING');
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
            console.log('🚨 FIREBASE RULES ERROR - CHECK FIRESTORE RULES!');
            
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
    console.log('🔌 Setting up event listeners...');
    
    if (taskForm) {
        taskForm.addEventListener('submit', addTask);
        console.log('Form submit listener added');
    } else {
        console.error('Task form not found!');
    }
    
    document.body.addEventListener('change', handleTaskAction);
    document.body.addEventListener('click', handleTaskAction);
    
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
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Ctrl/Cmd + Enter to submit form
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            if (taskInput.value.trim()) {
                taskForm.dispatchEvent(new Event('submit'));
            }
        }
        
        // Escape to clear form
        if (e.key === 'Escape') {
            taskInput.value = '';
            notesInput.value = '';
            deadlineInput.value = '';
            priorityInput.value = 'Sedang';
            clearDraft();
            taskInput.focus();
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
        console.log('🚨 FINAL FORCE HIDE LOADING');
        hideLoading();
    }, 3000);
    
    console.log('App initialization complete!');
});