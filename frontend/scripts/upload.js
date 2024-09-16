document.getElementById('uploadButton').addEventListener('click', async () => {
    const fileInput = document.getElementById('fileInput');
    const file = fileInput.files[0];

    if (!file) {
        document.getElementById('message').textContent = 'Please select a file to upload.';
        return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch('http://localhost:8000/uploadFile', {
            method: 'POST',
            body: formData
        });

        const result = await response.text();
        if (response.ok) {
            document.getElementById('message').textContent = `File uploaded successfully: ${result}`;
        } else {
            document.getElementById('message').textContent = `Error: ${result}`;
        }
    } catch (error) {
        console.error('Error uploading file:', error);
        document.getElementById('message').textContent = 'Failed to upload file. Please try again.';
    }
});
