// app.js - الإصدار المحدث مع نظام الفلترة
import { 
  auth, database, storage, onAuthStateChanged, signOut, ref, onValue, serverTimestamp, push, set, update, remove 
} from './firebase.js';

// عناصر DOM
const postsContainer = document.getElementById('posts-container');
const adminIcon = document.getElementById('admin-icon');
const loadingOverlay = document.getElementById('loading-overlay');
const uploadProgress = document.getElementById('upload-progress');
const notificationsIcon = document.getElementById('notifications-icon');
const profileHeaderIcon = document.getElementById('profile-header-icon');
const supportIcon = document.getElementById('support-icon');
const moreIcon = document.getElementById('more-icon');

// متغيرات النظام
let currentUserData = null;
let adminUsers = [];
let currentPosts = [];
let currentFilter = { type: '', location: '' };

// تحميل المنشورات عند بدء التحميل
document.addEventListener('DOMContentLoaded', () => {
    loadPosts();
    checkAuthState();
    initFiltersAndSearch();
    setupEventListeners();
});

// إعداد مستمعي الأحداث
function setupEventListeners() {
    // أيقونة الإشعارات
    if (notificationsIcon) {
        notificationsIcon.addEventListener('click', () => {
            alert('صفحة الإشعارات قيد التطوير');
        });
    }

    // أيقونة الملف الشخصي
    if (profileHeaderIcon) {
        profileHeaderIcon.addEventListener('click', () => {
            window.location.href = 'profile.html';
        });
    }
}

// التحقق من حالة المصادقة
function checkAuthState() {
    onAuthStateChanged(auth, user => {
        if (user) {
            // تحميل بيانات المستخدم الحالي
            const userRef = ref(database, 'users/' + user.uid);
            onValue(userRef, (snapshot) => {
                if (snapshot.exists()) {
                    currentUserData = snapshot.val();
                    currentUserData.uid = user.uid;
                    updateUIForLoggedInUser();
                }
            });
        } else {
            updateUIForLoggedOutUser();
        }
    });
}

// تحديث الواجهة للمستخدم المسجل
function updateUIForLoggedInUser() {
    // إظهار أيقونة الإدارة إذا كان المستخدم مشرفاً
    if (currentUserData && currentUserData.isAdmin) {
        adminIcon.style.display = 'flex';
    }
}

// تحديث الواجهة للمستخدم غير المسجل
function updateUIForLoggedOutUser() {
    adminIcon.style.display = 'none';
}

// تحميل المشرفين
function loadAdminUsers() {
    const usersRef = ref(database, 'users');
    onValue(usersRef, (snapshot) => {
        adminUsers = [];
        if (snapshot.exists()) {
            const users = snapshot.val();
            for (const userId in users) {
                if (users[userId].isAdmin) {
                    adminUsers.push(userId);
                }
            }
        }
    });
}

// تحميل المنشورات للجميع
function loadPosts() {
    showLoading();
    const postsRef = ref(database, 'posts');
    onValue(postsRef, (snapshot) => {
        postsContainer.innerHTML = '';
        currentPosts = [];
        
        if (snapshot.exists()) {
            const posts = snapshot.val();
            for (const postId in posts) {
                const post = { id: postId, ...posts[postId] };
                currentPosts.push(post);
                
                // تطبيق الفلتر الحالي
                if (filterPost(post)) {
                    createPostCard(post);
                }
            }
            
            if (postsContainer.children.length === 0) {
                postsContainer.innerHTML = '<p class="no-posts">لا توجد منشورات تطابق معايير البحث</p>';
            }
        } else {
            postsContainer.innerHTML = '<p class="no-posts">لا توجد منشورات بعد</p>';
        }
        hideLoading();
    });
}

// إنشاء بطاقة منشور
function createPostCard(post) {
    const postCard = document.createElement('div');
    postCard.className = 'post-card';
    postCard.dataset.type = post.category || '';
    postCard.dataset.location = post.location || '';
    
    const imageContent = post.imageUrl ? 
        `<img src="${post.imageUrl}" alt="${post.title}" class="post-image">` :
        `<div class="post-image"><i class="fas fa-image"></i></div>`;
    
    postCard.innerHTML = `
        ${imageContent}
        <h3 class="post-title">${post.title}</h3>
        <p class="post-description">${post.description}</p>
        <div class="post-meta">
            <div class="post-price">${post.price || 'غير محدد'}</div>
            <div class="post-location">
                <i class="fas fa-map-marker-alt"></i>
                <span>${post.location || 'غير محدد'}</span>
            </div>
        </div>
        <div class="post-category">${post.category || 'عام'}</div>
        <div class="post-time">${formatTimeAgo(post.createdAt)}</div>
    `;
    
    postCard.addEventListener('click', () => {
        // حفظ المنشور المحدد للانتقال إلى صفحة التفاصيل
        localStorage.setItem('currentPost', JSON.stringify(post));
        window.location.href = 'post-detail.html';
    });
    
    postsContainer.appendChild(postCard);
}

// تهيئة الفلاتر والبحث
function initFiltersAndSearch() {
    // البحث
    const searchInput = document.querySelector('.search-input');
    const searchBtn = document.querySelector('.search-btn');
    
    if (searchInput && searchBtn) {
        searchBtn.addEventListener('click', () => {
            filterPosts();
        });
        
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                filterPosts();
            }
        });
    }
    
    // الفلاتر
    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const filterType = btn.dataset.filter;
            const filterValue = btn.dataset.value;
            
            if (filterType === 'type') {
                currentFilter.type = currentFilter.type === filterValue ? '' : filterValue;
            } else if (filterType === 'location') {
                currentFilter.location = currentFilter.location === filterValue ? '' : filterValue;
            } else if (filterType === 'clear') {
                currentFilter = { type: '', location: '' };
            }
            
            // تحديث حالة الأزرار
            updateFilterButtons();
            
            // تطبيق الفلتر
            filterPosts();
        });
    });
}

// تحديث حالة أزرار الفلتر
function updateFilterButtons() {
    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(btn => {
        const filterType = btn.dataset.filter;
        const filterValue = btn.dataset.value;
        
        if (filterType === 'type') {
            btn.classList.toggle('active', currentFilter.type === filterValue);
        } else if (filterType === 'location') {
            btn.classList.toggle('active', currentFilter.location === filterValue);
        } else if (filterType === 'clear') {
            btn.classList.toggle('active', currentFilter.type === '' && currentFilter.location === '');
        }
    });
}

// فلترة المنشورات
function filterPosts() {
    const searchInput = document.querySelector('.search-input');
    const searchText = searchInput ? searchInput.value.toLowerCase() : '';
    
    postsContainer.innerHTML = '';
    
    if (currentPosts.length === 0) {
        postsContainer.innerHTML = '<p class="no-posts">لا توجد منشورات بعد</p>';
        return;
    }
    
    let filteredPosts = currentPosts.filter(post => filterPost(post, searchText));
    
    if (filteredPosts.length === 0) {
        postsContainer.innerHTML = '<p class="no-posts">لا توجد منشورات تطابق معايير البحث</p>';
    } else {
        filteredPosts.forEach(post => createPostCard(post));
    }
}

// دالة مساعدة للفلترة
function filterPost(post, searchText = '') {
    // فلترة حسب النوع
    if (currentFilter.type && post.category !== currentFilter.type) {
        return false;
    }
    
    // فلترة حسب الموقع
    if (currentFilter.location && post.location !== currentFilter.location) {
        return false;
    }
    
    // فلترة حسب البحث
    if (searchText) {
        const searchableText = `${post.title} ${post.description} ${post.category} ${post.location}`.toLowerCase();
        if (!searchableText.includes(searchText.toLowerCase())) {
            return false;
        }
    }
    
    return true;
}

// دالة لتنسيق الوقت المنقضي
function formatTimeAgo(timestamp) {
    if (!timestamp) return 'غير معروف';
    
    try {
        const date = typeof timestamp === 'object' ? 
            new Date(timestamp.seconds * 1000) : 
            new Date(timestamp);
            
        const now = new Date();
        const diffInSeconds = Math.floor((now - date) / 1000);
        
        if (diffInSeconds < 60) return 'الآن';
        if (diffInSeconds < 3600) return `قبل ${Math.floor(diffInSeconds / 60)} دقيقة`;
        if (diffInSeconds < 86400) return `قبل ${Math.floor(diffInSeconds / 3600)} ساعة`;
        if (diffInSeconds < 2592000) return `قبل ${Math.floor(diffInSeconds / 86400)} يوم`;
        
        return date.toLocaleDateString('ar-EG');
    } catch (error) {
        console.error('Error formatting date:', error);
        return 'غير معروف';
    }
}

// وظائف مساعدة
function showLoading() {
    if (loadingOverlay) loadingOverlay.classList.remove('hidden');
}

function hideLoading() {
    if (loadingOverlay) loadingOverlay.classList.add('hidden');
        }
