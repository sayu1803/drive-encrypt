document.addEventListener('DOMContentLoaded', function() {
    fetchDriveFiles();
    setupEventListeners();
});

function setupEventListeners() {
    document.getElementById('homeLink').addEventListener('click', function() {
        window.location.href = 'dashboard.html';
    });

    document.getElementById('dashboardLogo').addEventListener('click', function() {
        window.location.href = 'dashboard.html';
    });

    document.getElementById('myDriveLink').addEventListener('click', toggleGoogleDriveSection);

    document.getElementById('starredLink').addEventListener('click', function() {
        alert("Starred functionality not implemented yet.");
    });

    document.getElementById('trashLink').addEventListener('click', function() {
        alert("Trash functionality not implemented yet.");
    });

    document.getElementById('newButton').addEventListener('click', function() {
        document.getElementById('uploadModal').style.display = 'block';
    });

    document.getElementsByClassName('close')[0].addEventListener('click', function() {
        document.getElementById('uploadModal').style.display = 'none';
    });

    window.onclick = function(event) {
        if (event.target == document.getElementById('uploadModal')) {
            document.getElementById('uploadModal').style.display = 'none';
        }
    };

    document.getElementById('uploadFileBtn').addEventListener('click', function() {
        handleFileUpload();
        document.getElementById('uploadModal').style.display = 'none';
    });

    document.getElementById('uploadFolderBtn').addEventListener('click', function() {
        handleFolderUpload();
        document.getElementById('uploadModal').style.display = 'none';
    });

    document.getElementById('searchBar').addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase();
        filterFiles(searchTerm);
    });

    const filterButtons = document.querySelectorAll('.file-filters .filter-btn');
    filterButtons.forEach(button => {
        button.addEventListener('click', function() {
            filterButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            const filter = this.textContent.toLowerCase();
            fetchDriveFiles(filter);
        });
    });
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

    files.forEach(file => {
        const fileElement = document.createElement('div');
        fileElement.classList.add('file-item');
        fileElement.innerHTML = `
            <div class="file-item-content">
                <img src="${file.iconLink}" alt="icon" class="file-icon" />
                <div class="file-item-info">
                    <a href="${file.webViewLink}" target="_blank" class="file-link">${file.name}</a>
                    <div class="file-details">
                        <span>${file.owner}</span>
                        <span>${file.modifiedTime}</span>
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
        fileListElement.appendChild(fileElement);
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
        body: formData
    })
    .then(response => response.text())
    .then(result => {
        console.log(result);
        alert(result);
        fetchDriveFiles();
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