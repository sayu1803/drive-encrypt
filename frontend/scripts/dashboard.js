document.addEventListener('DOMContentLoaded', function() {
    setupEventListeners();
    setActiveSidebarItem('homeLink');
    fetchDriveFiles();
    setupProfileDropdown();
    fetchUserProfile().then(updateProfileInfo);
    setupProfileIcon();
    checkAuthentication();
    setupPeriodicAuthCheck();
    checkRequiredElements();
    updateEncryptedFilesCount();
    initializeAuthCheck();
    setInitialTheme();
});

function setupEventListeners() {
    try {
        const elements = {
            homeLink: document.getElementById('homeLink'),
            dashboardLogo: document.getElementById('dashboardLogo'),
            starredLink: document.getElementById('starredLink'),
            trashLink: document.getElementById('trashLink'),
            viewProfileLink: document.getElementById('viewProfileLink'),
            profileModalClose: document.querySelector('#profileModal .close'),
            profileButton: document.getElementById('profileButton'),
            uploadButton: document.getElementById('uploadToggle'),
            uploadFileBtn: document.getElementById('uploadFileBtn'),
            uploadEncryptedFileBtn: document.getElementById('uploadEncryptedFileBtn'),
            uploadFolderBtn: document.getElementById('uploadFolderBtn'),
            searchBar: document.getElementById('searchBar'),
            signOutButton: document.getElementById('signOutButton'),
            toggleViewButton: document.getElementById('toggleViewButton'),
            deleteModal: document.getElementById('deleteModal'),
            cancelDeleteBtn: document.getElementById('cancelDelete'),
            confirmDeleteBtn: document.getElementById('confirmDelete'),
            secureFilesLink: document.getElementById('secureFilesLink')
        };

        if (elements.homeLink) elements.homeLink.addEventListener('click', () => window.location.href = 'dashboard.html');
        if (elements.dashboardLogo) elements.dashboardLogo.addEventListener('click', () => window.location.href = 'dashboard.html');
        if (elements.secureFilesLink) elements.secureFilesLink.addEventListener('click', showSecureFiles);
        if (elements.starredLink) elements.starredLink.addEventListener('click', () => alert("Starred functionality not implemented yet."));
        if (elements.trashLink) elements.trashLink.addEventListener('click', () => alert("Trash functionality not implemented yet."));
        if (elements.viewProfileLink) elements.viewProfileLink.addEventListener('click', showProfileModal);
        if (elements.profileModalClose) elements.profileModalClose.addEventListener('click', hideProfileModal);
        if (elements.profileButton) elements.profileButton.addEventListener('click', toggleProfileDropdown);
        if (elements.uploadButton) elements.uploadButton.addEventListener('click', toggleUploadMenu);
        if (elements.uploadFileBtn) elements.uploadFileBtn.addEventListener('click', (e) => handleFileUpload(e, false));
        if (elements.uploadEncryptedFileBtn) elements.uploadEncryptedFileBtn.addEventListener('click', handleEncryptedFileUpload);
        if (elements.uploadFolderBtn) elements.uploadFolderBtn.addEventListener('click', handleFolderUpload);
        if (elements.searchBar) elements.searchBar.addEventListener('input', () => filterFiles(elements.searchBar.value.toLowerCase()));
        if (elements.signOutButton) elements.signOutButton.addEventListener('click', handleSignOut);
        if (elements.toggleViewButton) elements.toggleViewButton.addEventListener('click', toggleView);
        if (elements.cancelDeleteBtn) elements.cancelDeleteBtn.addEventListener('click', hideDeleteModal);
        if (elements.confirmDeleteBtn) elements.confirmDeleteBtn.addEventListener('click', function(){
            const fileID = deleteModal.dataset.fileId;
            deleteFile(fileID);
            hideDeleteModal();
        });

        const filterButtons = document.querySelectorAll('.file-filters .filter-option');
        filterButtons.forEach(button => {
            button.addEventListener('click', function() {
                filterButtons.forEach(btn => btn.classList.remove('active'));
                this.classList.add('active');
                const filter = this.textContent.toLowerCase();
                fetchDriveFiles(filter);
            });
        });

        console.log('Event listeners set up successfully');
    } catch (error) {
        console.error('Error setting up event listeners:', error);
    }

    // Global click event listener
    document.addEventListener('click', function(event) {
        const profileDropdown = document.getElementById('profileDropdown');
        const uploadMenu = document.getElementById('uploadMenu');

        if (!event.target.closest('.profile-section') && profileDropdown) {
            profileDropdown.style.display = 'none';
        }
        if (!event.target.closest('.upload-dropup') && uploadMenu) {
            uploadMenu.classList.remove('show');
        }
    });
}

function toggleProfileDropdown() {
    const dropdown = document.getElementById('profileDropdown');
    if (dropdown) {
        dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
    }
}

function showUploadModal() {
    const uploadModal = document.getElementById('uploadModal');
    if (uploadModal) uploadModal.style.display = 'block';
}

function showEncryptedUploadModal() {
    const modal = document.getElementById('encryptedUploadModal');
    if (modal) modal.style.display = 'block';
}

function hideEncryptedUploadModal() {
    const modal = document.getElementById('encryptedUploadModal');
    if (modal) modal.style.display = 'none';
}

function hideUploadModal() {
    const uploadModal = document.getElementById('uploadModal');
    if (uploadModal) uploadModal.style.display = 'none';
}

async function fetchDriveFiles(filter = 'all') {
    try {
        const response = await fetch(`/listFiles?filter=${filter}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const files = await response.json();
        displayFiles(files, filter === 'secure');
    } catch (error) {
        console.error('Error fetching files:', error);
        showAlert('Failed to load files. Please try again later.', 'error');
        document.getElementById('fileList').innerHTML = '<p>Failed to load files.</p>';
    }
}

// function displayFiles(files, secureOnly = false) {
//     const fileListElement = document.getElementById('fileList');
//     fileListElement.innerHTML = '';

//     const filesToDisplay = secureOnly ? files.filter(file => file.properties && file.properties.encrypted === 'true') : files;

//     if (filesToDisplay.length === 0) {
//         fileListElement.innerHTML = '<p>No files found.</p>';
//         return;
//     }

//     filesToDisplay.forEach(file => {
//         const fileElement = document.createElement('div');
//         fileElement.classList.add('file-item');
//         const iconPath = getFileIconPath(file.mimeType, file.name);
        
//         const formattedSize = formatFileSize(file.size);
//         const formattedDate = formatDate(file.modifiedTime);
//         const isEncrypted = file.properties && file.properties.encrypted === 'true';

//         fileElement.innerHTML = `
//             <div class="file-item-content">
//                 <img src="${iconPath}" alt="${file.name}" class="file-icon" width="40" height="40">
//                 <div class="file-item-info">
//                     <a href="${file.webViewLink}" target="_blank" class="file-link">${file.name}</a>
//                     <div class="file-details">
//                         <span>${file.owners ? file.owners[0].displayName : 'Unknown'}</span>
//                         <span>${formattedDate}</span>
//                         <span>${formattedSize}</span>
//                         ${isEncrypted ? '<span class="encrypted-tag">Encrypted</span>' : ''}
//                     </div>
//                 </div>
//             </div>
//             <div class="file-actions">
//                 <button class="file-action-button share-btn" data-file-id="${file.id}">
//                     <i class="fas fa-share"></i>
//                 </button>
//                 <button class="file-action-button download-btn" data-file-id="${file.id}" data-file-name="${file.name}" data-encrypted="${isEncrypted}">
//                     <i class="fas fa-download"></i>
//                 </button>
//                 <button class="file-action-button delete-btn" data-file-id="${file.id}" data-file-name="${file.name}">
//                     <i class="fas fa-trash"></i>
//                 </button>
//             </div>
//         `;
//         fileListElement.appendChild(fileElement);
//     });

//     // Add event listeners for file actions
//     document.querySelectorAll('.share-btn').forEach(button => {
//         button.addEventListener('click', handleShare);
//     });
//     document.querySelectorAll('.download-btn').forEach(button => {
//         button.addEventListener('click', handleDownload);
//     });
//     document.querySelectorAll('.delete-btn').forEach(button => {
//         button.addEventListener('click', handleDelete);
//     });
// }

function displayFiles(files, secureOnly = false) {
    const fileListElement = document.getElementById('fileList');
    fileListElement.innerHTML = '';

    const filesToDisplay = secureOnly ? files.filter(file => file.properties && file.properties.encrypted === 'true') : files;

    if (filesToDisplay.length === 0) {
        fileListElement.innerHTML = '<p>No files found.</p>';
        return;
    }

    filesToDisplay.forEach(file => {
        const fileElement = document.createElement('div');
        fileElement.classList.add('file-item');
        const iconPath = getFileIconPath(file.mimeType, file.name);
        
        const formattedSize = formatFileSize(file.size);
        const formattedDate = formatDate(file.modifiedTime);
        const isEncrypted = file.properties && file.properties.encrypted === 'true';

        fileElement.innerHTML = `
            <div class="file-item-content">
                <img src="${iconPath}" alt="${file.name}" class="file-icon" width="40" height="40">
                <div class="file-item-info">
                    <a href="${file.webViewLink || file.webContentLink}" target="_blank" class="file-link">${file.name}</a>
                    <div class="file-details">
                        <span>${file.owners ? file.owners[0].displayName : 'Unknown'}</span>
                        <span>${formattedDate}</span>
                        <span>${formattedSize}</span>
                        ${isEncrypted ? '<span class="encrypted-tag">Encrypted</span>' : ''}
                    </div>
                </div>
            </div>
            <div class="file-actions">
                <button class="file-action-button share-btn" data-file-id="${file.id}">
                    <i class="fas fa-share"></i>
                </button>
                <button class="file-action-button download-btn" data-file-id="${file.id}" data-file-name="${file.name}" data-encrypted="${isEncrypted}">
                    <i class="fas fa-download"></i>
                </button>
                <button class="file-action-button delete-btn" data-file-id="${file.id}" data-file-name="${file.name}">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        fileListElement.appendChild(fileElement);
    });

    // Add event listeners for file actions
    document.querySelectorAll('.share-btn').forEach(button => {
        button.addEventListener('click', handleShare);
    });
    document.querySelectorAll('.download-btn').forEach(button => {
        button.addEventListener('click', handleDownload);
    });
    document.querySelectorAll('.delete-btn').forEach(button => {
        button.addEventListener('click', handleDelete);
    });
}

function filterFiles(searchTerm) {
    const fileItems = document.querySelectorAll('.file-item');
    fileItems.forEach(item => {
        const fileName = item.querySelector('.file-link').textContent.toLowerCase();
        if (fileName.includes(searchTerm)) {
            item.style.display = '';
        } else {
            item.style.display = 'none';
        }
    });
}


function handleFileUpload(event, isEncrypted = false) {
    event.preventDefault();
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.onchange = function () {
        const file = fileInput.files[0];
        if (file) {
            uploadFile(file, isEncrypted);
        }
    };
    fileInput.click();
}

function handleEncryptedFileUpload(event) {
    handleFileUpload(event, true);
}

function handleFolderUpload(event) {
    event.preventDefault();
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.webkitdirectory = true;
    fileInput.onchange = function () {
        if (fileInput.files.length > 0) {
            const formData = new FormData();
            const folderPath = fileInput.files[0].webkitRelativePath.split('/')[0];
            formData.append('folderName', folderPath);
            for (const file of fileInput.files) {
                formData.append('files', file);
            }
            uploadFolderToServer(formData, fileInput.files.length);
        }
    };
    fileInput.click();
}

async function uploadFile(file, isEncrypted) {
    const formData = new FormData();
    let encryptionKey = null;

    if (isEncrypted) {
        encryptionKey = CryptoJS.lib.WordArray.random(256/8).toString();
        const fileArrayBuffer = await file.arrayBuffer();
        const wordArray = CryptoJS.lib.WordArray.create(fileArrayBuffer);
        const encryptedContent = CryptoJS.AES.encrypt(wordArray, encryptionKey).toString();
        const encryptedBlob = new Blob([encryptedContent], { type: 'application/octet-stream' });
        formData.append('file', encryptedBlob, file.name); // Removed '.encrypted' extension
        formData.append('encryptionKey', encryptionKey);
        formData.append('isEncrypted', 'true');
    } else {
        formData.append('file', file);
        formData.append('isEncrypted', 'false');
    }

    formData.append('metadata', JSON.stringify({ properties: { encrypted: isEncrypted } }));

    try {
        const response = await fetch('/uploadFile', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
        }

        const result = await response.json();
        if (isEncrypted) {
            localStorage.setItem(`encryptionKey_${result.fileId}`, encryptionKey);
        }
        showAlert(`${isEncrypted ? 'Encrypted f' : 'F'}ile uploaded successfully`, 'success');
        fetchDriveFiles();
        updateEncryptedFilesCount();
    } catch (error) {
        console.error('Upload error:', error);
        showAlert(`Failed to upload ${isEncrypted ? 'encrypted ' : ''}file. ${error.message}`, 'error');
    }
}

function showProgressBar() {
    const progressContainer = document.getElementById('uploadProgressContainer');
    progressContainer.style.display = 'block';
}

function hideProgressBar() {
    const progressContainer = document.getElementById('uploadProgressContainer');
    progressContainer.style.display = 'none';
    updateProgressBar(0);
}

function updateProgressBar(percent) {
    const progressBar = document.getElementById('uploadProgressBar');
    progressBar.style.width = percent + '%';
}

function uploadFolderToServer(formData, totalFiles) {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/uploadFolder', true);

    showProgressBar();

    xhr.upload.onprogress = function(event) {
        if (event.lengthComputable) {
            const percentComplete = (event.loaded / event.total) * 100;
            updateProgressBar(percentComplete);
        }
    };

    xhr.onload = function() {
        if (xhr.status === 200) {
            hideProgressBar();
            showAlert('Folder uploaded successfully', 'success');
            fetchDriveFiles(); // Refresh file list
        } else {
            hideProgressBar();
            showAlert('Failed to upload folder. Please try again.', 'error');
        }
    };

    xhr.onerror = function() {
        hideProgressBar();
        showAlert('An error occurred while uploading the folder.', 'error');
    };

    xhr.send(formData);
}

function toggleGoogleDriveSection() {
    document.querySelector('.content-header h2').textContent = "My Drive";
    document.querySelector('.dashboard-cards').style.display = 'none';
    document.getElementById('fileSection').style.display = 'block';
    fetchDriveFiles();
}

async function fetchUserProfile() {
    try {
        const response = await fetch('/api/userProfile');
        if (!response.ok) {
            throw new Error('Failed to fetch profile');
        }
        const profileData = await response.json();
        updateProfileInfo(profileData);
        updateTotalStorageCard(profileData);
        return profileData;
    } catch (error) {
        console.error('Error fetching user profile:', error);
        showAlert("Failed to load user profile. Please try to re-login.", 'error');
        throw error;
    }
}

function updateProfileUI(profileData) {
    const defaultProfileImage = 'assets/default-profile-icon.png';
    const profilePicture = profileData.profilePicture || defaultProfileImage;

    document.getElementById('profileIconImage').src = profilePicture;
    document.getElementById('profilePicture').src = profilePicture;
    document.getElementById('profileName').textContent = profileData.name;
    document.getElementById('profileEmail').textContent = profileData.email;
    document.getElementById('profileStorage').textContent = `${formatBytes(profileData.storageUsed)} / ${formatBytes(profileData.storageLimit)} used`;

    const recentFilesList = document.getElementById('recentFilesList');
    recentFilesList.innerHTML = '';
    profileData.recentFiles.slice(0, 5).forEach(file => {
        const li = document.createElement('li');
        li.className = 'recent-file-item';
        const iconClass = getFileIconClass(file.type);
        li.innerHTML = `
            <i class="${iconClass}"></i>
            <span class="file-name">${file.name}</span>
            <span class="file-date">${formatDate(file.lastModified)}</span>
        `;
        recentFilesList.appendChild(li);
    });
}

function showProfileModal() {
    const profileModal = document.getElementById('profileModal');
    if (profileModal) profileModal.style.display = 'block';
}

function hideProfileModal() {
    const profileModal = document.getElementById('profileModal');
    if (profileModal) profileModal.style.display = 'none';
}


function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatFileSize(bytes) {
    if (bytes === undefined) return 'Unknown';
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDate(dateString) {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffTime / (1000 * 60));
  
    if (diffDays === 0) {
      if (diffHours === 0) {
        if (diffMinutes === 0) {
          return 'Just now';
        }
        return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
      }
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    }
  }

function setupProfileIcon() {
    const profileIconImage = document.getElementById('profileIconImage');
    const profilePicture = document.getElementById('profilePicture');
    const defaultProfileImage = 'assets/default-profile-icon.png';

    function setDefaultImage(imgElement) {
        imgElement.src = defaultProfileImage;
    }

    profileIconImage.onerror = function() {
        setDefaultImage(this);
    };

    profilePicture.onerror = function() {
        setDefaultImage(this);
    };

    // Set default image if src is empty or invalid
    if (!profileIconImage.src || profileIconImage.src === window.location.href) {
        setDefaultImage(profileIconImage);
    }

    if (!profilePicture.src || profilePicture.src === window.location.href) {
        setDefaultImage(profilePicture);
    }
}

async function handleSignOut() {
    try {
        const response = await fetch('/api/signout', {
            method: 'POST',
            credentials: 'include',
        });

        if (response.ok) {
            // Clear any client-side storage
            localStorage.removeItem('user');
            sessionStorage.clear();

            // Redirect to the login page
            window.location.href = '/';
        } else {
            const errorData = await response.json();
            console.error('Sign out failed:', errorData.error);
            alert('Failed to sign out. Please try again.');
        }
    } catch (error) {
        console.error('Error during sign out:', error);
        alert('An error occurred while signing out. Please try again.');
    }
}

function getFileIconClass(mimeType) {
    const iconMap = {
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'fas fa-file-word',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'fas fa-file-excel',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'fas fa-file-powerpoint',
        'application/pdf': 'fas fa-file-pdf',
        'text/plain': 'fas fa-file-alt',
        'image/jpeg': 'fas fa-file-image',
        'image/png': 'fas fa-file-image',
        'audio/mpeg': 'fas fa-file-audio',
        'video/mp4': 'fas fa-file-video',
    };

    return iconMap[mimeType] || 'fas fa-file';
}

function updateTotalStorageCard(profileData) {
    const totalStorageValue = document.getElementById('totalStorageValue');
    const totalStorageSubtext = document.getElementById('totalStorageSubtext');
    
    if (!totalStorageValue || !totalStorageSubtext) {
        console.error('Total storage elements not found');
        return;
    }
    
    const usedStorage = formatBytes(profileData.storageUsed);
    const totalStorage = formatBytes(profileData.storageLimit);
    const freeStorage = formatBytes(profileData.storageLimit - profileData.storageUsed);
    
    totalStorageValue.textContent = `${usedStorage} / ${totalStorage}`;
    totalStorageSubtext.textContent = `${freeStorage} free`;

    // Update the progress bar
    updateStorageProgressBar(profileData.storageUsed, profileData.storageLimit);
}

function updateStorageProgressBar(used, total) {
    const progressBar = document.querySelector('.total-storage .progress-bar');
    if (!progressBar) {
        console.error('Progress bar element not found');
        return;
    }

    const percentage = (used / total) * 100;
    progressBar.style.width = `${percentage}%`;

    // Change color based on usage
    if (percentage > 90) {
        progressBar.style.backgroundColor = '#ff4444'; // Red for high usage
    } else if (percentage > 70) {
        progressBar.style.backgroundColor = '#ffbb33'; // Orange for moderate usage
    } else {
        progressBar.style.backgroundColor = '#00C851'; // Green for low usage
    }
}

function checkAuthentication() {
    fetch('/api/checkAuth', { credentials: 'include' })
      .then(response => {
        if (!response.ok) {
          console.error('Failed to fetch /api/checkAuth:', response.status, response.statusText);
          throw new Error('Authentication check failed');
        }
        return response.json();
      })
      .then(data => {
        if (data.authenticated) {
          // Check if the current page is already the dashboard to prevent an infinite loop
          if (window.location.pathname === '/dashboard.html') {
            console.log('User is already on the dashboard, no further redirects needed.');
            return; // Exit to prevent continuous reloading
          }
          updateLoginMessage('Already authenticated. Redirecting to dashboard...');
          setTimeout(() => {
            window.location.href = '/dashboard.html'; // Redirect only if not already on the dashboard
          }, 1000);
        } else {
          updateLoginMessage('Please log in.');
        }
      })
      .catch(error => {
        console.error('Error checking authentication:', error);
        updateLoginMessage('Unable to check authentication status. Please try again.', true);
      });
  }
  
let authCheckInterval;

function setupPeriodicAuthCheck() {
    // Clear any existing interval
    if (authCheckInterval) {
        clearInterval(authCheckInterval);
    }

    authCheckInterval = setInterval(async () => {
        try {
            const response = await fetch('/api/checkAuth', {
                method: 'GET',
                headers: {
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                },
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            if (!data.authenticated) {
                window.location.href = '/login.html';
            }
        } catch (error) {
            console.error('Error checking authentication:', error);
            
            // If it's a network error, don't redirect immediately
            if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
                console.log('Network error detected. Will retry on next interval.');
            } else {
                // For other errors, redirect to login
                window.location.href = '/login.html';
            }
        }
    }, 60000); // Check every minute
}

function handleVisibilityChange() {
    if (document.hidden) {
        // Page is hidden, clear the interval
        if (authCheckInterval) {
            clearInterval(authCheckInterval);
        }
    } else {
        // Page is visible again, restart the periodic check
        setupPeriodicAuthCheck();
    }
}

function initializeAuthCheck() {
    setupPeriodicAuthCheck();
    document.addEventListener('visibilitychange', handleVisibilityChange);
}

function updateLoginMessage(message, isError = false) {
    const loginMessage = document.getElementById('loginMessage'); // Ensure this element exists in your HTML
    if (!loginMessage) {
        console.error('Login message element not found');
        return;
    }
    loginMessage.textContent = message;
    loginMessage.style.color = isError ? 'red' : 'blue';
}

function getFileIconPath(mimeType, fileName) {
    const fileExtension = fileName.split('.').pop().toLowerCase();
    
    const iconMap = {
      'folder': 'folder.png',
      'audio': 'audio.png',
      'video': 'video.png',
      'image': 'image.png',
      'pdf': 'pdf.png',
      'zip': 'zip.png',
      'rar': 'rar.png',
      '7z': 'zip.png',
      'tar': 'zip.png',
      'gz': 'zip.png',
      'doc': 'docx.png',
      'docx': 'docx.png',
      'odt': 'docx.png',
      'xls': 'xls.png',
      'xlsx': 'xls.png',
      'csv': 'xls.png',
      'ppt': 'pptx.png',
      'pptx': 'pptx.png',
      'py': 'py.svg',
      'js': 'js.svg',
      'java': 'java.svg',
      'exe': 'exe.png',
      'sh': 'sh.svg',
      'cpp': 'cpp.svg',
      'cs': 'cs.svg',
      'php': 'php.png',
      'rb': 'rb.svg',
      'swift': 'swift.svg',
      'go': 'go.svg',
      'ts': 'ts.svg',
      'html': 'html.svg',
      'css': 'css.svg',
      'sql': 'sql.png',
      'txt': 'txt.png',
      'svg': 'svg.png',
      'apk': 'apk.png',
      'iso': 'iso.png',
      'jsx': 'jsx.svg',
      'unknown': 'unknown.png'
    };
  
    let iconName;
  
    if (mimeType === 'application/vnd.google-apps.folder') {
      iconName = 'folder';
    } else if (mimeType.startsWith('audio/')) {
      iconName = 'audio';
    } else if (mimeType.startsWith('video/')) {
      iconName = 'video';
    } else if (mimeType.startsWith('image/')) {
      iconName = 'image';
    } else if (mimeType === 'application/pdf') {
      iconName = 'pdf';
    } else if (fileExtension in iconMap) {
      iconName = fileExtension;
    } else if (mimeType === 'application/vnd.google-apps.document') {
      iconName = 'docx';
    } else if (mimeType === 'application/vnd.google-apps.spreadsheet') {
      iconName = 'xlsx';
    } else if (mimeType === 'application/vnd.google-apps.presentation') {
      iconName = 'pptx';
    } else {
      iconName = 'unknown';
    }
  
    return `/assets/file-icons/${iconMap[iconName]}`;
  }

  function toggleView() {
    const fileListElement = document.getElementById('fileList');
    const toggleViewIcon = document.getElementById('toggleViewIcon');
    const isGrid = fileListElement.classList.toggle('file-grid');

    if (isGrid) {
        toggleViewIcon.src = 'assets/file-icons/list-icon.png';
        fileListElement.classList.remove('file-list');
    } else {
        toggleViewIcon.src = 'assets/file-icons/grid-icon.png';
        fileListElement.classList.add('file-list');
    }

    // Re-display files to apply the new layout
    fetchDriveFiles();
}


function setupProfileDropdown() {
    const profileToggle = document.getElementById('profileToggle');
    const profileDropdown = document.getElementById('profileDropdown');
    const darkModeToggle = document.getElementById('darkModeToggle');
    const settingsButton = document.getElementById('settingsButton');
    const signOutButton = document.getElementById('signOutButton');

    if (darkModeToggle) {
        darkModeToggle.addEventListener('click', toggleDarkMode);
    }

    // Set initial dark mode state
    setInitialDarkMode();

    profileToggle.addEventListener('click', function(event) {
        event.stopPropagation();
        toggleProfileDropdown();
    });

    document.addEventListener('click', function(event) {
        if (!profileDropdown.contains(event.target) && event.target !== profileToggle) {
            profileDropdown.style.display = 'none';
        }
    });

    darkModeToggle.addEventListener('click', toggleDarkMode);
    settingsButton.addEventListener('click', openSettings);
    signOutButton.addEventListener('click', handleSignOut);
}

function toggleDarkMode() {
    const body = document.body;
    const isDarkMode = body.classList.toggle('dark-mode');
    updateDarkModeStyles(isDarkMode);
    localStorage.setItem('darkMode', isDarkMode);
}

function setInitialDarkMode() {
    const prefersDarkMode = localStorage.getItem('darkMode') === 'true';
    if (prefersDarkMode) {
        document.body.classList.add('dark-mode');
        updateDarkModeStyles(true);
    }
}

function updateDarkModeStyles(isDarkMode) {
    const darkModeStylesheet = document.getElementById('darkModeStylesheet');
    if (isDarkMode) {
        if (!darkModeStylesheet) {
            const link = document.createElement('link');
            link.id = 'darkModeStylesheet';
            link.rel = 'stylesheet';
            link.href = 'styles/dark-mode.css';
            document.head.appendChild(link);
        }
    } else {
        if (darkModeStylesheet) {
            darkModeStylesheet.remove();
        }
    }

    const darkModeToggle = document.getElementById('darkModeToggle');
    if (darkModeToggle) {
        darkModeToggle.innerHTML = isDarkMode ? 
            '<i class="fas fa-sun"></i> Light Mode' : 
            '<i class="fas fa-moon"></i> Dark Mode';
    }
}

function setInitialTheme() {
    const prefersDarkMode = localStorage.getItem('darkMode') === 'true';
    if (prefersDarkMode) {
        document.body.classList.add('dark-mode');
        const link = document.createElement('link');
        link.id = 'theme-stylesheet';
        link.rel = 'stylesheet';
        link.href = 'styles/dark-mode.css';
        document.head.appendChild(link);
    }
}

function openSettings() {
    // Implement your settings functionality here
    console.log('Settings clicked');
}

function updateProfileInfo(profileData) {
    const elements = {
        profileName: document.getElementById('profileName'),
        profileEmail: document.getElementById('profileEmail'),
        profilePicture: document.getElementById('profilePicture'),
        profileIconImage: document.getElementById('profileIconImage')
    };

    for (const [key, element] of Object.entries(elements)) {
        if (!element) {
            console.error(`${key} element not found`);
            continue;
        }

        if (key === 'profilePicture' || key === 'profileIconImage') {
            element.src = profileData.profilePicture || 'assets/default-profile-icon.png';
        } else {
            element.textContent = profileData[key.replace('profile', '').toLowerCase()] || '';
        }
    }
}

function handleDelete(event) {
    event.stopPropagation();
    const fileId = event.currentTarget.dataset.fileId;
    const fileName = event.currentTarget.dataset.fileName;
    if (fileId && fileName) {
        showDeleteModal(fileId, fileName);
    } else {
        console.error('File ID or name is missing');
        showAlert('Error: Unable to delete file. Please try again.', 'error');
    }
}

async function deleteFile(fileId) {
    try {
        const response = await fetch(`/deleteFile/${fileId}`, { method: 'DELETE' });
        if (response.ok) {
            showAlert('File deleted successfully', 'success');
            fetchDriveFiles(); // Refresh the file list
            updateEncryptedFilesCount();
        } else {
            const errorData = await response.json();
            showAlert('Failed to delete file', 'error')
            console.log(`Failed to delete file: ${errorData.error}`);
        }
    } catch (error) {
        console.error('Error deleting file:', error);
        showAlert('An error occurred while deleting the file', 'error');
    }
}

function toggleUploadMenu() {
    const uploadMenu = document.getElementById('uploadMenu');
    if (uploadMenu) {
        uploadMenu.classList.toggle('show');
    }
}

  function showAlert(message, type) {
    const alertContainer = document.getElementById('alertContainer');
    if (!alertContainer) {
        console.error('Alert container not found');
        return;
    }

    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    
    const icon = document.createElement('span');
    icon.className = 'alert-icon';
    icon.innerHTML = getAlertIcon(type);
    
    const messageSpan = document.createElement('span');
    messageSpan.textContent = message;
    
    const closeButton = document.createElement('button');
    closeButton.className = 'alert-close';
    closeButton.innerHTML = '&times;';
    closeButton.onclick = () => {
        alert.remove();
    };
    
    alert.appendChild(icon);
    alert.appendChild(messageSpan);
    alert.appendChild(closeButton);
    
    alertContainer.appendChild(alert);
    
    // Force a reflow to enable the transition
    alert.offsetHeight;
    
    alert.classList.add('show');
    
    setTimeout(() => {
        alert.classList.remove('show');
        setTimeout(() => {
            alert.remove();
        }, 300);
    }, 5000);
}

function getAlertIcon(type) {
    switch (type) {
        case 'error':
            return '<i class="fas fa-exclamation-circle"></i>';
        case 'success':
            return '<i class="fas fa-check-circle"></i>';
        case 'info':
        default:
            return '<i class="fas fa-info-circle"></i>';
    }
}

function removeAlert(alert) {
    alert.classList.remove('show');
    setTimeout(() => {
        alert.remove();
    }, 300);
}

function showDeleteModal(fileId, fileName) {
    const deleteModal = document.getElementById('deleteModal');
    deleteModal.style.display = 'block';
    deleteModal.dataset.fileId = fileId;
    
    const modalMessage = deleteModal.querySelector('p');
    modalMessage.textContent = `Are you sure you want to delete "${fileName}"? This action cannot be undone.`;
}

function hideDeleteModal() {
    deleteModal.style.display = 'none';
}

document.querySelectorAll('.file-action-button.delete-btn').forEach(button => {
    const fileId = button.closest('.file-item').dataset.fileId;
    const fileName = button.closest('.file-item').querySelector('.file-link').textContent;
    button.addEventListener('click', (event) => handleDelete(event, fileId, fileName));
});

function handleUploadFormSubmit(event) {
    event.preventDefault();
    const fileInput = document.getElementById('fileInput');
    if (fileInput.files.length > 0) {
        uploadFile(fileInput.files[0]);
    }
}

async function uploadEncryptedFile(file) {
    const formData = new FormData();
    
    // Generate a random key for encryption
    const encryptionKey = CryptoJS.lib.WordArray.random(256/8).toString();
    
    // Read the file as an ArrayBuffer
    const fileArrayBuffer = await file.arrayBuffer();
    // Convert ArrayBuffer to WordArray
    const wordArray = CryptoJS.lib.WordArray.create(fileArrayBuffer);
    // Encrypt the file content
    const encryptedContent = CryptoJS.AES.encrypt(wordArray, encryptionKey).toString();
    
    // Create a new Blob with the encrypted content
    const encryptedBlob = new Blob([encryptedContent], { type: 'application/octet-stream' });
    
    // Append the encrypted file to the formData
    formData.append('file', encryptedBlob, file.name);
    
    // Append the encryption key (you might want to handle this more securely)
    formData.append('encryptionKey', encryptionKey);
    
    // Add metadata to indicate encryption and original mime type
    formData.append('metadata', JSON.stringify({
        properties: {
            encrypted: 'true',
            originalMimeType: file.type
        }
    }));

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/uploadFile', true);

    xhr.upload.onprogress = function(e) {
        if (e.lengthComputable) {
            const percentComplete = (e.loaded / e.total) * 100;
            updateProgressBar(percentComplete);
        }
    };

    xhr.onload = function() {
        if (xhr.status === 200) {
            const response = JSON.parse(xhr.responseText);
            // Store the encryption key securely (this is just a simple example)
            localStorage.setItem(`encryptionKey_${response.fileId}`, encryptionKey);
            showAlert('Encrypted file uploaded successfully', 'success');
            fetchDriveFiles(); // Refresh file list
        } else {
            showAlert('Failed to upload encrypted file. Please try again.', 'error');
        }
        hideProgressBar();
    };

    xhr.onerror = function() {
        showAlert('An error occurred while uploading the encrypted file.', 'error');
        hideProgressBar();
    };

    showProgressBar();
    xhr.send(formData);
}

function showSecureFiles() {
    setActiveSidebarItem('secureFilesLink');
    const sectionTitle = document.getElementById('sectionTitle');
    const dashboardCards = document.getElementById('dashboardCards');
    const fileSection = document.getElementById('fileSection');

    if (sectionTitle) {
        sectionTitle.textContent = "Secure Files";
    } else {
        console.warn('Section title element not found');
    }

    if (dashboardCards) {
        dashboardCards.style.display = 'none';
    } else {
        console.warn('Dashboard cards element not found');
    }

    if (fileSection) {
        fileSection.style.display = 'block';
    } else {
        console.warn('File section element not found');
    }

    fetchDriveFiles('secure');
}

function checkRequiredElements() {
    const requiredElements = [
        'dashboardCards',
        'fileSection',
        'fileList',
        'uploadProgressContainer',
        'uploadProgressBar'
    ];

    const missingElements = requiredElements.filter(id => !document.getElementById(id));

    if (missingElements.length > 0) {
        console.error('Missing required elements:', missingElements.join(', '));
        showAlert('Some page elements are missing. Please refresh the page or contact support.', 'error');
    }
}

function handleShare(event) {
    const fileId = event.currentTarget.dataset.fileId;
    // Implement sharing functionality here
    console.log(`Sharing file with ID: ${fileId}`);
    // You might want to open a modal or implement your sharing logic
}

async function handleDownload(event) {
    const fileId = event.currentTarget.dataset.fileId;
    const fileName = event.currentTarget.dataset.fileName;
    const isEncrypted = event.currentTarget.dataset.encrypted === 'true';

    try {
        console.log(`Attempting to download file: ${fileName} (ID: ${fileId}, Encrypted: ${isEncrypted})`);
        const response = await fetch(`/api/downloadFile/${fileId}`);
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Download failed');
        }

        let blob = await response.blob();
        let mimeType = blob.type;

        if (isEncrypted) {
            const encryptionKey = localStorage.getItem(`encryptionKey_${fileId}`);
            if (!encryptionKey) {
                throw new Error('Encryption key not found for this file');
            }

            // Convert blob to text
            const encryptedContent = await blob.text();
            // Decrypt the content
            const decrypted = CryptoJS.AES.decrypt(encryptedContent, encryptionKey);
            // Convert WordArray to Uint8Array
            const decryptedArray = convertWordArrayToUint8Array(decrypted);
            // Create a new Blob with the decrypted content
            mimeType = response.headers.get('X-Original-Mime-Type') || 'application/octet-stream';
            blob = new Blob([decryptedArray], { type: mimeType });
        }

        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        console.log(`File downloaded successfully: ${fileName}`);
        showAlert(isEncrypted ? 'Encrypted file downloaded and decrypted successfully' : 'File downloaded successfully', 'success');
    } catch (error) {
        console.error('Error downloading file:', error);
        showAlert(`Failed to download file: ${error.message}`, 'error');
    }
}

function convertWordArrayToUint8Array(wordArray) {
    const arrayOfWords = wordArray.words;
    const length = wordArray.sigBytes;
    const uInt8Array = new Uint8Array(length);
    for (let i = 0; i < length; i++) {
        const byte = (arrayOfWords[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
        uInt8Array[i] = byte;
    }
    return uInt8Array;
}

async function updateEncryptedFilesCount() {
    try {
        const response = await fetch('/listFiles?filter=secure');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const files = await response.json();
        const encryptedFiles = files.filter(file => file.properties && file.properties.encrypted === 'true');
        const encryptedFilesCount = encryptedFiles.length;
        
        const countElement = document.getElementById('encryptedFilesCount');
        if (countElement) {
            countElement.textContent = encryptedFilesCount;
        }
    } catch (error) {
        console.error('Error fetching encrypted files count:', error);
    }
}

function setActiveSidebarItem(itemId) {
    // Remove 'active' class from all sidebar items
    document.querySelectorAll('.nav-links ul li a').forEach(item => {
        item.classList.remove('active');
    });

    // Add 'active' class to the selected item
    const activeItem = document.getElementById(itemId);
    if (activeItem) {
        activeItem.classList.add('active');
    }
}


/*settingss*/

document.addEventListener('DOMContentLoaded', function() {
    const settingsModal = document.getElementById('settingsModal');
    const settingsButton = document.getElementById('settingsButton');
    const closeButton = document.querySelector('.close-button');
    const navItems = document.querySelectorAll('.settings-nav .nav-item');
    const sections = document.querySelectorAll('.settings-section');

    // Show modal
    function showSettingsModal() {
        settingsModal.style.display = 'block';
        document.body.style.overflow = 'hidden'; // Prevent background scrolling
    }

    // Hide modal
    function hideSettingsModal() {
        settingsModal.style.display = 'none';
        document.body.style.overflow = ''; // Restore background scrolling
    }

    // Switch sections
    function switchSection(sectionId) {
        navItems.forEach(item => {
            item.classList.toggle('active', item.dataset.section === sectionId);
        });

        sections.forEach(section => {
            section.classList.toggle('active', section.id === sectionId);
        });
    }

    // Event Listeners
    settingsButton.addEventListener('click', showSettingsModal);
    closeButton.addEventListener('click', hideSettingsModal);

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            switchSection(item.dataset.section);
        });
    });

    // Close modal when clicking outside
    settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) {
            hideSettingsModal();
        }
    });

    // Handle theme change
    const themeSelect = document.querySelector('.theme-select');
    themeSelect.addEventListener('change', (e) => {
        const selectedTheme = e.target.value;
        console.log(`Theme changed to: ${selectedTheme}`);
        // Implement theme change logic here
    });

    // Handle encryption algorithm change
    const encryptionAlgoSelect = document.getElementById('encryptionAlgo');
    encryptionAlgoSelect.addEventListener('change', (e) => {
        const selectedAlgo = e.target.value;
        console.log(`Encryption algorithm changed to: ${selectedAlgo}`);
        // Implement encryption algorithm change logic here
    });

    // Handle files display count change
    const filesDisplayCountInput = document.getElementById('filesDisplayCount');
    filesDisplayCountInput.addEventListener('change', (e) => {
        const count = e.target.value;
        console.log(`Files display count changed to: ${count}`);
        // Implement files display count change logic here
    });

    // Handle premium upgrade
    const upgradeToPremiumButton = document.getElementById('upgradeToPremium');
    upgradeToPremiumButton.addEventListener('click', () => {
        console.log('Upgrade to premium clicked');
        // Implement premium upgrade logic here
    });

    // Handle privacy policy link
    const privacyPolicyLink = document.getElementById('privacyPolicyLink');
    privacyPolicyLink.addEventListener('click', (e) => {
        e.preventDefault();
        console.log('Privacy policy link clicked');
        // Implement privacy policy display logic here
    });

    // For demonstration purposes, let's log when the modal is opened and closed
    console.log('Settings modal script loaded');
    settingsButton.addEventListener('click', () => console.log('Settings modal opened'));
    closeButton.addEventListener('click', () => console.log('Settings modal closed'));
});