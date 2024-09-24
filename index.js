import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { google } from 'googleapis';
import express from 'express';
import bodyParser from 'body-parser';
import mime from 'mime-types';
import multer from 'multer';
import cors from 'cors';

import crypto from 'crypto';
import CryptoJS from 'crypto-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(bodyParser.json());
app.use(cors({
  origin: 'http://localhost:8000', // Replace with your client origin
  credentials: true // Allow cookies to be sent with requests
})); // Use CORS middleware

const isDev = process.env.NODE_ENV === 'development';

const frontendDirectoryPath = isDev
  ? path.join(__dirname, '../frontend')
  : path.join(__dirname, 'frontend');

// Serve static files from the frontend directory
app.use(express.static(frontendDirectoryPath));

// Serve login.html at the root URL
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend/login.html'));
});

const oauth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  process.env.REDIRECT_URI
);

let tokens = null;

try {
  const tokenData = fs.readFileSync(path.join(__dirname, "tokens.json"), "utf8");
  tokens = JSON.parse(tokenData);
  oauth2Client.setCredentials(tokens);
} catch (err) {
  console.log("No tokens file found. User will need to authenticate.");
}

const PORT = process.env.PORT || 8000;
// Correct multer configuration
const upload = multer({
  dest: 'uploads/', 
  limits: { fileSize: 10 * 1024 * 1024 }, // Optional: set file size limit to 10MB
  fileFilter: (req, file, cb) => {
    if (!file) {
      cb(new Error('No file selected'), false);
    } else {
      cb(null, true);
    }
  },
});


app.get("/auth/google", (req, res) => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: [
      "https://www.googleapis.com/auth/userinfo.profile",
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/drive.readonly",
      "https://www.googleapis.com/auth/contacts.readonly",
      "https://www.googleapis.com/auth/drive.file",
      "https://www.googleapis.com/auth/drive.metadata.readonly"
    ],
  });
  res.redirect(authUrl);
});

app.get("/google/redirect", async (req, res) => {
  try {
    const { code } = req.query;
    const { tokens: newTokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(newTokens);
    tokens = newTokens;

    // Save tokens to file
    fs.writeFileSync(path.join(__dirname, "tokens.json"), JSON.stringify(newTokens));
    
    // Set a cookie to indicate the user is authenticated
    res.cookie('authenticated', 'true', { httpOnly: true, secure: true, sameSite: 'Lax' });
    
    res.redirect('/dashboard.html');
  } catch (err) {
    console.error("Error retrieving tokens:", err);
    res.redirect('/?error=' + encodeURIComponent('Authentication failed. Please try again.'));
  }
});

// Route to fetch files from Google Drive
app.get("/listFiles", async (req, res) => {
  try {
    const { filter } = req.query; // 'all', 'files', 'folders'
    const drive = google.drive({ version: "v3", auth: oauth2Client });

    const response = await drive.files.list({
      pageSize: 20,
      fields: "files(id, name, mimeType, webViewLink, iconLink, thumbnailLink)",
    });

    let files = response.data.files;

    if (filter === 'files') {
      files = files.filter(file => file.mimeType !== 'application/vnd.google-apps.folder');
    } else if (filter === 'folders') {
      files = files.filter(file => file.mimeType === 'application/vnd.google-apps.folder');
    }

    if (files.length === 0) {
      res.json({ message: "No files found." });
    } else {
      res.json(files);
    }
  } catch (error) {
    console.error("Error fetching files:", error.message);
    res.status(500).send("Failed to retrieve files.");
  }
});

app.post("/uploadFile", upload.single('file'), async (req, res) => {
  try {
    const file = req.file;

    // Check if a file was uploaded
    if (!file) {
      console.error("No file uploaded. Check if the file input was correct.");
      return res.status(400).send("No file uploaded.");
    }

    // Log file details
    console.log("File details:", file);

    // Ensure MIME type is detected correctly
    const mimeType = mime.lookup(file.originalname) || "application/octet-stream";
    console.log(`Uploading file with MIME type: ${mimeType}`);

    // Authenticate Google Drive API
    const drive = google.drive({ version: "v3", auth: oauth2Client });

    // Attempt to upload the file to Google Drive
    const response = await drive.files.create({
      requestBody: {
        name: file.originalname,
        mimeType: mimeType,
      },
      media: {
        mimeType: mimeType,
        body: fs.createReadStream(file.path),
      },
    });

    // Check if upload was successful
    console.log("Google Drive response:", response.data);

    // Remove the uploaded file from local storage after successful upload
    fs.unlinkSync(file.path);
    console.log("File uploaded successfully with ID:", response.data.id);
    res.send(`File uploaded successfully with ID: ${response.data.id}`);
  } catch (error) {
    // Log detailed error message and stack trace
    console.error("Error uploading file:", error.message);
    console.error("Stack trace:", error.stack);

    // If the error is from Google API, log the response details
    if (error.response) {
      console.error("Google API Error Response:", error.response.data);
    }

    // Send a detailed error message back to the client
    res.status(500).send(`Failed to upload file. Please try again. Error: ${error.message}`);
  }
});

app.post("/uploadFolder", upload.array('files'), async (req, res) => {
  try {
    const folderName = req.body.folderName;
    if (!folderName) {
      console.error("No folder name provided");
      return res.status(400).send("No folder name provided.");
    }

    console.log("Creating folder:", folderName);
    const drive = google.drive({ version: "v3", auth: oauth2Client });

    // Create a folder on Google Drive
    const folderMetadata = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
    };

    const folderResponse = await drive.files.create({
      resource: folderMetadata,
      fields: 'id',
    });

    const folderId = folderResponse.data.id;
    console.log("Folder created successfully with ID:", folderId);

    // Upload files into the created folder
    const filePromises = req.files.map(file => {
      console.log("Uploading file:", file.originalname);
      const mimeType = mime.lookup(file.originalname) || "application/octet-stream";
      return drive.files.create({
        requestBody: {
          name: file.originalname,
          parents: [folderId], // Specify the parent folder ID
          mimeType: mimeType,
        },
        media: {
          mimeType: mimeType,
          body: fs.createReadStream(file.path),
        },
      }).then(response => {
        fs.unlinkSync(file.path); // Remove the file after uploading
        return response.data.id;
      });
    });

    const fileIds = await Promise.all(filePromises);
    console.log("Files uploaded successfully:", fileIds);
    res.send(`Folder '${folderName}' created successfully with ID: ${folderId}, and files uploaded: ${fileIds.join(', ')}`);
  } catch (error) {
    console.error("Error uploading folder:", error.message);
    res.status(500).send("Failed to create folder or upload files. Please try again.");
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

app.get('/api/userProfile', isAuthenticated, async (req, res) => {
  console.log('Received request for /api/userProfile');
  try {
    // Check if the access token is expired and refresh if necessary
    if (oauth2Client.isTokenExpiring()) {
      const { credentials } = await oauth2Client.refreshAccessToken();
      tokens = credentials;
      fs.writeFileSync(path.join(__dirname, "tokens.json"), JSON.stringify(credentials));
      console.log('Access token refreshed and saved');
    }

    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    // Fetch basic user info
    const { data: userInfo } = await oauth2.userinfo.get();

    // Fetch user's Drive usage
    const { data: about } = await drive.about.get({
      fields: 'storageQuota, user'
    });

    // Fetch recent files
    const { data: files } = await drive.files.list({
      pageSize: 10,
      fields: 'files(id, name, mimeType, modifiedTime)',
      orderBy: 'modifiedTime desc'
    });

    const userProfile = {
      name: userInfo.name,
      email: userInfo.email,
      profilePicture: userInfo.picture,
      storageUsed: about.storageQuota.usage,
      storageLimit: about.storageQuota.limit,
      driveLocale: about.user.emailAddress,
      recentFiles: files.files.map(file => ({
        name: file.name,
        type: file.mimeType,
        lastModified: file.modifiedTime
      })),
      // You can still include mock data for fields not available via API
      jobTitle: 'Software Engineer',
      department: 'Engineering',
      location: 'San Francisco, CA',
      joinDate: '2022-01-01'
    };

    console.log('Fetched user profile:', userProfile);
    res.json(userProfile);
  } catch (error) {
    console.error('Error in /api/userProfile:', error);
    if (error.code === 401) {
      res.status(401).json({ error: 'Authentication failed', details: 'Please re-authenticate' });
    } else if (error.code === 403) {
      res.status(403).json({ error: 'Insufficient permissions', details: 'Please check the requested scopes' });
    } else {
      res.status(500).json({ error: 'Failed to fetch user profile', details: error.message });
    }
  }
});



app.post("/api/signout", (req, res) => {
  try {
      // Clear the tokens
      tokens = null;
      oauth2Client.revokeCredentials((err) => {
          if (err) {
              console.error("Error revoking credentials:", err);
          }
          // Delete the stored tokens file
          fs.unlink(path.join(__dirname, "tokens.json"), (unlinkErr) => {
              if (unlinkErr) {
                  console.error("Error deleting tokens file:", unlinkErr);
              }
              res.json({ message: "Successfully signed out" });
          });
      });
  } catch (error) {
      console.error("Error during sign-out:", error);
      res.status(500).json({ error: "An error occurred during sign-out" });
  }
});

function isAuthenticated(req, res, next) {
  if (!tokens) {
    return res.status(401).json({ error: "User not authenticated" });
  }
  next();
}


app.get("/api/checkAuth", (req, res) => {
  console.log("Checking authentication status");
  res.json({ authenticated: !!tokens });
});

async function refreshTokenIfNeeded() {
  try {
    if (tokens && oauth2Client.isTokenExpiring()) {
      const { credentials } = await oauth2Client.refreshAccessToken();
      tokens = credentials;
      fs.writeFileSync(path.join(__dirname, "tokens.json"), JSON.stringify(credentials));
      console.log('Access token refreshed and saved');
    }
  } catch (error) {
    console.error('Error refreshing token:', error);
    tokens = null;
    fs.unlinkSync(path.join(__dirname, "tokens.json"));
  }
}

app.use(async (req, res, next) => {
  await refreshTokenIfNeeded();
  next();
});

app.use((req, res) => {
  console.log(`No route found for ${req.method} ${req.url}`);
  res.status(404).json({ error: 'Not Found' });
});

app.use((req, res, next) => {
  console.log(`Received ${req.method} request for ${req.url}`);
  next();
});