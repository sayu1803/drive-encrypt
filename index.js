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

// Define __filename and __dirname in ES Module context
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(bodyParser.json());
app.use(cors()); // Use CORS middleware

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

// Load credentials from file if available
try {
  const creds = fs.readFileSync("creds.json", "utf8");
  oauth2Client.setCredentials(JSON.parse(creds));
} catch (err) {
  console.log("No creds file found. Please authenticate to generate one.");
}

const PORT = process.env.PORT || 8000;
const upload = multer({ dest: 'uploads/' });

app.get("/auth/google", (req, res) => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: [
      "https://www.googleapis.com/auth/userinfo.profile",
      "https://www.googleapis.com/auth/drive",
    ],
  });
  res.redirect(authUrl);
});

app.get("/google/redirect", async (req, res) => {
  try {
    const { code } = req.query;
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    fs.writeFileSync("creds.json", JSON.stringify(tokens)); // Save tokens
    res.redirect('/dashboard.html'); // Redirect to the dashboard after successful login
  } catch (err) {
    console.error("Error retrieving tokens:", err);
    res.status(500).send("Authentication failed");
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
    if (!file) {
      console.error("No file uploaded");
      return res.status(400).send("No file uploaded.");
    }

    console.log("File to upload:", file.originalname);
    const mimeType = mime.lookup(file.originalname) || "application/octet-stream";
    const drive = google.drive({ version: "v3", auth: oauth2Client });

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

    fs.unlinkSync(file.path); // Remove file after upload
    console.log("File uploaded successfully with ID:", response.data.id);
    res.send(`File uploaded successfully with ID: ${response.data.id}`);
  } catch (error) {
    console.error("Error uploading file:", error.message);
    res.status(500).send("Failed to upload file. Please try again.");
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
