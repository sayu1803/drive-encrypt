import { app, BrowserWindow } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import isDev from 'electron-is-dev';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let server;

function startServer() {
    return new Promise((resolve, reject) => {
        server = spawn('node', ['index.js'], {
            stdio: 'inherit',
            shell: true,
        });

        server.on('error', (error) => {
            console.error('Failed to start the server:', error);
            reject(error);
        });

        server.on('close', (code) => {
            console.log(`Server exited with code ${code}`);
            if (code !== 0) reject(new Error(`Server exited with code ${code}`));
        });

        resolve();
    });
}

function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
        },
    });

    const startURL = isDev
        ? 'http://localhost:8000/login.html'
        : `file://${path.join(__dirname, 'frontend/login.html')}`;

    mainWindow.loadURL(startURL);

    if (isDev) {
        mainWindow.webContents.openDevTools();
    }
}

app.whenReady().then(async () => {
    try {
        await startServer();  // Start the server
        setTimeout(createWindow, 2000);  // Wait 2 seconds for the server to fully start before loading the Electron window
    } catch (error) {
        console.error('Failed to start the server:', error);
    }

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
    if (server) server.kill('SIGTERM');
});
