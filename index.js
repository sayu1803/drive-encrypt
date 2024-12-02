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

const ENCRYPTION_KEYS_FILE = path.join(__dirname, 'encryption_keys.json');

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
      const { filter } = req.query;
      const drive = google.drive({ version: "v3", auth: oauth2Client });

      const response = await drive.files.list({
          pageSize: 30,
          fields: "files(id, name, mimeType, webViewLink, webContentLink, thumbnailLink, iconLink, size, modifiedTime, owners, properties)",
      });

      let files = response.data.files;

      if (filter === 'files') {
          files = files.filter(file => file.mimeType !== 'application/vnd.google-apps.folder');
      } else if (filter === 'folders') {
          files = files.filter(file => file.mimeType === 'application/vnd.google-apps.folder');
      } else if (filter === 'secure') {
        files = files.filter(file => file.properties && file.properties.encrypted === 'true');
      }

      // Add encrypted property to the file objects
      files = files.map(file => ({
          ...file,
          encrypted: file.properties && file.properties.encrypted === 'true'
      }));

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

app.get("/api/searchDrive", async (req, res) => {
  try {
      const { q } = req.query;
      const drive = google.drive({ version: "v3", auth: oauth2Client });

      const response = await drive.files.list({
          q: `fullText contains '${q}'`,
          fields: "files(id, name, mimeType, webViewLink, modifiedTime, size, owners)",
          pageSize: 30,
      });

      const files = response.data.files.map(file => ({
          ...file,
          source: 'drive',
          webContentLink: file.webViewLink,
          properties: { encrypted: false }
      }));

      res.json(files);
  } catch (error) {
      console.error("Error searching Drive:", error);
      res.status(500).json({ error: "Failed to search Drive" });
  }
});

app.post("/uploadFile", upload.single('file'), async (req, res) => {
  try {
      const file = req.file;
      const encryptionKey = req.body.encryptionKey;
      const isEncrypted = req.body.isEncrypted === 'true';
      const metadata = JSON.parse(req.body.metadata || '{}');

      if (!file) {
          console.error("No file uploaded.");
          return res.status(400).send("No file uploaded.");
      }

      console.log("File details:", file);

      const mimeType = isEncrypted ? 'application/octet-stream' : (mime.lookup(file.originalname) || "application/octet-stream");
      console.log(`Uploading file with MIME type: ${mimeType}`);

      const drive = google.drive({ version: "v3", auth: oauth2Client });

      const fileContent = fs.createReadStream(file.path);

      const fileMetadata = {
          name: file.originalname,
          mimeType: mimeType,
          properties: {
              ...metadata.properties,
              encrypted: isEncrypted,
              originalMimeType: metadata.properties.originalMimeType || mimeType
          }
      };

      const media = {
          mimeType: mimeType,
          body: fileContent
      };

      const response = await drive.files.create({
          resource: fileMetadata,
          media: media,
          fields: 'id'
      });

      fs.unlinkSync(file.path);
      console.log("File uploaded successfully with ID:", response.data.id);

      if (isEncrypted) {
          const keyStoragePath = path.join(__dirname, 'encryption_keys.json');
          let keys = {};
          if (fs.existsSync(keyStoragePath)) {
              keys = JSON.parse(fs.readFileSync(keyStoragePath, 'utf8'));
          }
          keys[response.data.id] = encryptionKey;
          fs.writeFileSync(keyStoragePath, JSON.stringify(keys));
      }

      res.json({ fileId: response.data.id });
  } catch (error) {
      console.error("Error uploading file:", error);
      res.status(500).send(`Failed to upload file. Error: ${error.message}`);
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

app.delete("/deleteFile/:fileId", isAuthenticated, async (req, res) => {
  try {
    const fileId = req.params.fileId;
    const drive = google.drive({ version: "v3", auth: oauth2Client });

    await drive.files.delete({
      fileId: fileId,
    });

    res.json({ message: "File deleted successfully" });
  } catch (error) {
    console.error("Error deleting file:", error);
    res.status(500).json({ error: "Failed to delete file" });
  }
});

app.get("/api/downloadFile/:fileId", async (req, res) => {
  try {
      const fileId = req.params.fileId;
      const drive = google.drive({ version: "v3", auth: oauth2Client });

      console.log(`Attempting to download file with ID: ${fileId}`);

      const file = await drive.files.get({
          fileId: fileId,
          fields: 'name, mimeType, properties'
      });

      console.log(`File details:`, file.data);

      const isEncrypted = file.data.properties && file.data.properties.encrypted === 'true';
      console.log(`Is file encrypted: ${isEncrypted}`);

      const response = await drive.files.get(
          { fileId: fileId, alt: 'media' },
          { responseType: 'arraybuffer' }
      );

      let fileContent = Buffer.from(response.data);
      console.log(`File content length: ${fileContent.length} bytes`);

      const fileName = file.data.name;

      res.setHeader('Content-disposition', `attachment; filename=${fileName}`);
      res.setHeader('Content-type', file.data.mimeType || 'application/octet-stream');
      if (isEncrypted) {
          res.setHeader('X-Original-Mime-Type', file.data.properties.originalMimeType || file.data.mimeType);
      }
      res.send(fileContent);
      console.log(`File sent successfully: ${fileName}`);
  } catch (error) {
      console.error("Error downloading file:", error);
      res.status(500).json({ error: `Failed to download file. Error: ${error.message}` });
  }
});

app.get("/api/filePreview/:fileId", isAuthenticated, async (req, res) => {
  try {
    const fileId = req.params.fileId;
    const drive = google.drive({ version: "v3", auth: oauth2Client });

    const file = await drive.files.get({
      fileId: fileId,
      fields: 'id, name, mimeType, webViewLink, webContentLink',
    });

    res.json(file.data);
  } catch (error) {
    console.error("Error fetching file preview:", error);
    res.status(500).json({ error: "Failed to fetch file preview" });
  }
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

function retrieveEncryptionKey(fileId) {
  try {
    const keysData = fs.readFileSync(ENCRYPTION_KEYS_FILE, 'utf8');
    const keys = JSON.parse(keysData);
    const key = keys[fileId];
    console.log(`Retrieved encryption key for file ${fileId}: ${key ? 'Found' : 'Not found'}`);
    return key || null;
  } catch (error) {
    console.error('Error retrieving encryption key:', error);
    return null;
  }
}

function verifyEncryptionKeys() {
  try {
    const keysData = fs.readFileSync(ENCRYPTION_KEYS_FILE, 'utf8');
    const keys = JSON.parse(keysData);
    console.log(`Loaded ${Object.keys(keys).length} encryption keys`);
    
    for (const [fileId, key] of Object.entries(keys)) {
      if (typeof key !== 'string' || key.length !== 64) {
        console.error(`Invalid key for file ${fileId}: ${key}`);
      }
    }
    
    console.log('Encryption keys verified successfully');
  } catch (error) {
    console.error('Error verifying encryption keys:', error);
  }
}

function convertWordArrayToUint8Array(wordArray) {
  const words = wordArray.words;
  const sigBytes = wordArray.sigBytes;
  const u8 = new Uint8Array(sigBytes);
  for (let i = 0; i < sigBytes; i++) {
    const byte = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
    u8[i] = byte;
  }
  return u8;
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

verifyEncryptionKeys();