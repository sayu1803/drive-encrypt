document.addEventListener('DOMContentLoaded', function() {
    fetchDriveFiles();
    setupProfileDropdown();
    fetchUserProfile().then(updateProfileInfo);
    setupEventListeners();
    setupProfileIcon();
    checkAuthentication();
    setupPeriodicAuthCheck();
});

function setupEventListeners() {
    try {
        const elements = {
            homeLink: document.getElementById('homeLink'),
            dashboardLogo: document.getElementById('dashboardLogo'),
            myDriveLink: document.getElementById('myDriveLink'),
            starredLink: document.getElementById('starredLink'),
            trashLink: document.getElementById('trashLink'),
            viewProfileLink: document.getElementById('viewProfileLink'),
            profileModalClose: document.querySelector('#profileModal .close'),
            profileButton: document.getElementById('profileButton'),
            uploadButton: document.getElementById('uploadButton'),
            uploadModalClose: document.getElementsByClassName('close')[0],
            uploadFileBtn: document.getElementById('uploadFileBtn'),
            uploadFolderBtn: document.getElementById('uploadFolderBtn'),
            searchBar: document.getElementById('searchBar'),
            signOutButton: document.getElementById('signOutButton'),
            toggleViewButton: document.getElementById('toggleViewButton')
        };

        if (elements.homeLink) elements.homeLink.addEventListener('click', () => window.location.href = 'dashboard.html');
        if (elements.dashboardLogo) elements.dashboardLogo.addEventListener('click', () => window.location.href = 'dashboard.html');
        if (elements.myDriveLink) elements.myDriveLink.addEventListener('click', toggleGoogleDriveSection);
        if (elements.starredLink) elements.starredLink.addEventListener('click', () => alert("Starred functionality not implemented yet."));
        if (elements.trashLink) elements.trashLink.addEventListener('click', () => alert("Trash functionality not implemented yet."));
        if (elements.viewProfileLink) elements.viewProfileLink.addEventListener('click', showProfileModal);
        if (elements.profileModalClose) elements.profileModalClose.addEventListener('click', hideProfileModal);
        if (elements.profileButton) elements.profileButton.addEventListener('click', toggleProfileDropdown);
        if (elements.uploadButton) elements.uploadButton.addEventListener('click', showUploadModal);
        if (elements.uploadModalClose) elements.uploadModalClose.addEventListener('click', () => document.getElementById('uploadModal').style.display = 'none');
        if (elements.uploadFileBtn) elements.uploadFileBtn.addEventListener('click', () => { handleFileUpload(); document.getElementById('uploadModal').style.display = 'none'; });
        if (elements.uploadFolderBtn) elements.uploadFolderBtn.addEventListener('click', () => { handleFolderUpload(); document.getElementById('uploadModal').style.display = 'none'; });
        if (elements.searchBar) elements.searchBar.addEventListener('input', () => filterFiles(elements.searchBar.value.toLowerCase()));
        if (elements.signOutButton) elements.signOutButton.addEventListener('click', handleSignOut);
        if (elements.toggleViewButton) elements.toggleViewButton.addEventListener('click', toggleView);

        const filterButtons = document.querySelectorAll('.file-filters .filter-btn');
        filterButtons.forEach(button => {
            button.addEventListener('click', function() {
                filterButtons.forEach(btn => btn.classList.remove('active'));
                this.classList.add('active');
                const filter = this.textContent.toLowerCase();
                fetchDriveFiles(filter);
            });
        });

        // Fetch user profile when the page loads
        fetchUserProfile();

        console.log('Event listeners set up successfully');
    } catch (error) {
        console.error('Error setting up event listeners:', error);
    }

    // Global click event listener
    document.addEventListener('click', function(event) {
        const profileDropdown = document.getElementById('profileDropdown');
        const uploadModal = document.getElementById('uploadModal');
        const profileModal = document.getElementById('profileModal');

        if (!event.target.closest('.profile-section') && profileDropdown) {
            profileDropdown.style.display = 'none';
        }
        if (event.target == uploadModal) {
            uploadModal.style.display = 'none';
        }
        if (event.target == profileModal) {
            hideProfileModal();
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

async function fetchDriveFiles(filter = 'all') {
    try {
        const response = await fetch(`/listFiles?filter=${filter}`);
        const files = await response.json();
        displayFiles(files);
    } catch (error) {
        console.error('Error fetching files:', error);
        document.getElementById('fileList').innerHTML = '<p>Failed to load files.</p>';
    }
}

function displayFiles(files) {
    const fileListElement = document.getElementById('fileList');
    fileListElement.innerHTML = '';

    if (files.length === 0) {
        fileListElement.innerHTML = '<p>No files found.</p>';
        return;
    }

    const container = document.createElement('div');
    container.className = fileListElement.classList.contains('file-grid') ? 'file-grid' : 'file-list';

    files.forEach(file => {
        const fileElement = document.createElement('div');
        fileElement.classList.add('file-item');
        const iconPath = getFileIconPath(file.mimeType, file.name);
        fileElement.innerHTML = `
            <div class="file-item-content">
                <img src="${iconPath}" alt="${file.name}" class="file-icon" width="40" height="40">
                <div class="file-item-info">
                    <a href="${file.webViewLink}" target="_blank" class="file-link">${file.name}</a>
                    <div class="file-details">
                        <span>${file.owner || 'Unknown'}</span>
                        <span>${file.modifiedTime || 'Unknown'}</span>
                        <span>${file.size}</span>
                    </div>
                </div>
            </div>
            <div class="file-actions">
                <button class="file-action-button">
                    <i class="fas fa-share"></i>
                </button>
                <button class="file-action-button">
                    <i class="fas fa-ellipsis-v"></i>
                </button>
            </div>
        `;
        container.appendChild(fileElement);
    });

    fileListElement.appendChild(container);
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

function handleFileUpload() {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.onchange = function () {
        const file = fileInput.files[0];
        const formData = new FormData();
        formData.append('file', file);
        uploadFileToServer(formData);
    };
    fileInput.click();
}

function handleFolderUpload() {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.multiple = true;
    fileInput.webkitdirectory = true;
    fileInput.onchange = function () {
        if (fileInput.files.length > 0) {
            const formData = new FormData();
            const folderPath = fileInput.files[0].webkitRelativePath.split('/')[0];
            formData.append('folderName', folderPath);
            for (const file of fileInput.files) {
                formData.append('files', file);
            }
            uploadFolderToServer(formData);
        }
    };
    fileInput.click();
}

function uploadFileToServer(formData) {
    fetch('/uploadFile', {
      method: 'POST',
      body: formData,
    })
      .then(response => {
        if (!response.ok) {
          // Capture and log detailed error response from the server
          return response.text().then(errorMessage => {
            console.error('Failed to upload file:', errorMessage);
            alert(`Failed to upload file: ${errorMessage}`);
          });
        }
        return response.text();
      })
      .then(result => {
        if (result) {
          console.log(result);
          alert(result);
          fetchDriveFiles(); // Refresh file list upon successful upload
        }
      })
      .catch(error => console.error('Error uploading file:', error));
  }

function uploadFolderToServer(formData) {
    fetch('/uploadFolder', {
        method: 'POST',
        body: formData
    })
    .then(response => response.text())
    .then(result => {
        console.log(result);
        alert(result); 
        fetchDriveFiles();
    })
    .catch(error => console.error('Error uploading folder:', error));
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
        // Display an error message to the user
        const errorMessage = document.createElement('div');
        errorMessage.textContent = 'Failed to load user profile. Please try refreshing the page.';
        errorMessage.style.color = 'red';
        errorMessage.style.padding = '10px';
        document.body.insertBefore(errorMessage, document.body.firstChild);
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

function setupProfileDrawer() {
    const profileToggle = document.getElementById('profileToggle');
    const profileDrawer = document.getElementById('profileDrawer');
    const closeProfileDrawer = document.getElementById('closeProfileDrawer');

    profileToggle.addEventListener('click', toggleProfileDrawer);
    closeProfileDrawer.addEventListener('click', closeDrawer);

    // Close drawer when clicking outside
    document.addEventListener('click', (event) => {
        if (!profileDrawer.contains(event.target) && !profileToggle.contains(event.target)) {
            closeDrawer();
        }
    });

    function toggleProfileDrawer() {
        profileDrawer.classList.toggle('open');
    }

    function closeDrawer() {
        profileDrawer.classList.remove('open');
    }
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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

function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
        return 'Today';
    } else if (diffDays === 1) {
        return 'Yesterday';
    } else if (diffDays < 7) {
        return `${diffDays} days ago`;
    } else {
        return date.toLocaleDateString();
    }
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
  
  

function setupPeriodicAuthCheck() {
    setInterval(() => {
        fetch('/api/checkAuth')
            .then(response => response.json())
            .then(data => {
                if (!data.authenticated) {
                    window.location.href = '/login.html';
                }
            })
            .catch(error => {
                console.error('Error checking authentication:', error);
            });
    }, 60000); // Check every minute
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

function displayFiles(files) {
    const fileListElement = document.getElementById('fileList');
    fileListElement.innerHTML = '';

    if (files.length === 0) {
        fileListElement.innerHTML = '<p>No files found.</p>';
        return;
    }

    files.forEach(file => {
        const fileElement = document.createElement('div');
        fileElement.classList.add('file-item');
        const iconPath = getFileIconPath(file.mimeType, file.name);
        fileElement.innerHTML = `
            <div class="file-item-content">
                <img src="${iconPath}" alt="${file.name}" class="file-icon" width="40" height="40">
                <div class="file-item-info">
                    <a href="${file.webViewLink}" target="_blank" class="file-link">${file.name}</a>
                    <div class="file-details">
                        <span>${file.owner || 'Unknown'}</span>
                        <span>${file.modifiedTime || 'Unknown'}</span>
                        <span>${file.size || 'Unknown'}</span>
                    </div>
                </div>
            </div>
            <div class="file-actions">
                <button class="file-action-button">
                    <i class="fas fa-share"></i>
                </button>
                <button class="file-action-button">
                    <i class="fas fa-ellipsis-v"></i>
                </button>
            </div>
        `;
        fileListElement.appendChild(fileElement);
    });
}

function setupProfileDropdown() {
    const profileToggle = document.getElementById('profileToggle');
    const profileDropdown = document.getElementById('profileDropdown');
    const darkModeToggle = document.getElementById('darkModeToggle');
    const settingsButton = document.getElementById('settingsButton');
    const signOutButton = document.getElementById('signOutButton');

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
    document.body.classList.toggle('dark-mode');
    // You can add logic here to save the user's preference
}

function openSettings() {
    // Implement your settings functionality here
    console.log('Settings clicked');
}

function updateProfileInfo(profileData) {
    document.getElementById('profileName').textContent = profileData.name;
    document.getElementById('profileEmail').textContent = profileData.email;
    document.getElementById('profilePicture').src = profileData.profilePicture || 'assets/default-profile-icon.png';
    document.getElementById('profileIconImage').src = profileData.profilePicture || 'assets/default-profile-icon.png';
}