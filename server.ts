import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;

// Body parser with 50mb limit for high-quality base64 image data
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const DATA_DIR = path.join(process.cwd(), 'data');
const SUBMISSIONS_DIR = path.join(DATA_DIR, 'submissions');
const TEMPLATES_FILE = path.join(DATA_DIR, 'templates.json');
const SUBMISSIONS_FILE = path.join(DATA_DIR, 'submissions.json');
const ADMIN_TOKEN_FILE = path.join(DATA_DIR, 'admin_token.json');
const TARGET_FOLDER_ID = '1RY2ZZxiq9aCurhs8xIn7xTD7x3TU1Nkv';

// Ensure database directories and mock files exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(SUBMISSIONS_DIR)) {
  fs.mkdirSync(SUBMISSIONS_DIR, { recursive: true });
}
if (!fs.existsSync(TEMPLATES_FILE)) {
  fs.writeFileSync(TEMPLATES_FILE, JSON.stringify([], null, 2), 'utf-8');
}
if (!fs.existsSync(SUBMISSIONS_FILE)) {
  fs.writeFileSync(SUBMISSIONS_FILE, JSON.stringify([], null, 2), 'utf-8');
}

// Helper to upload student twibbon file to Google Drive from the backend
async function uploadToGoogleDrive(filePath: string, fileName: string, mimeType: string, accessToken: string) {
  try {
    const fileBuffer = fs.readFileSync(filePath);
    
    // Step 1: Create Metadata inside target folder
    const metadata = {
      name: fileName,
      parents: [TARGET_FOLDER_ID],
      mimeType: mimeType,
    };

    const metaResponse = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(metadata),
    });

    if (!metaResponse.ok) {
      const errBody = await metaResponse.text();
      console.error(`Google Drive Server-side Metadata creation failed: ${metaResponse.statusText} - ${errBody}`);
      return null;
    }

    const metaDataResult = await metaResponse.json() as any;
    const fileId = metaDataResult.id;

    // Step 2: Upload file media body
    const uploadResponse = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': mimeType,
        },
        body: fileBuffer,
      }
    );

    if (!uploadResponse.ok) {
      const errBody = await uploadResponse.text();
      console.error(`Google Drive Server-side Content upload failed: ${uploadResponse.statusText} - ${errBody}`);
      return null;
    }

    return fileId;
  } catch (error) {
    console.error('Failed to upload file to Google Drive from server:', error);
    return null;
  }
}

// 1. Templates API Endpoints
app.get('/api/templates', (req, res) => {
  try {
    const data = fs.readFileSync(TEMPLATES_FILE, 'utf-8');
    const templates = JSON.parse(data);
    res.json(templates);
  } catch (err) {
    console.error('Error reading templates file:', err);
    res.status(550).json({ error: 'Failed to read templates' });
  }
});

app.post('/api/templates', (req, res) => {
  try {
    const newTemplate = req.body;
    const data = fs.readFileSync(TEMPLATES_FILE, 'utf-8');
    let templates = JSON.parse(data);
    
    // Purge older records with the same template ID to keep list clean
    templates = templates.filter((t: any) => t.id !== newTemplate.id);
    templates.push(newTemplate);
    
    fs.writeFileSync(TEMPLATES_FILE, JSON.stringify(templates, null, 2), 'utf-8');
    res.status(201).json({ success: true, template: newTemplate });
  } catch (err) {
    console.error('Error saving template:', err);
    res.status(500).json({ error: 'Failed to save template' });
  }
});

app.delete('/api/templates/:id', (req, res) => {
  try {
    const { id } = req.params;
    const data = fs.readFileSync(TEMPLATES_FILE, 'utf-8');
    let templates = JSON.parse(data);
    templates = templates.filter((t: any) => t.id !== id);
    fs.writeFileSync(TEMPLATES_FILE, JSON.stringify(templates, null, 2), 'utf-8');
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting template:', err);
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

app.post('/api/templates/default', (req, res) => {
  try {
    const { defaultTemplateId } = req.body;
    const data = fs.readFileSync(TEMPLATES_FILE, 'utf-8');
    let templates = JSON.parse(data);
    
    templates = templates.map((t: any) => ({
      ...t,
      isDefault: t.id === defaultTemplateId
    }));
    
    fs.writeFileSync(TEMPLATES_FILE, JSON.stringify(templates, null, 2), 'utf-8');
    res.json({ success: true, defaultTemplateId });
  } catch (err) {
    console.error('Error setting default template:', err);
    res.status(500).json({ error: 'Failed to set default template' });
  }
});

// 2. Submissions API Endpoints
app.get('/api/submissions', (req, res) => {
  try {
    const data = fs.readFileSync(SUBMISSIONS_FILE, 'utf-8');
    const submissions = JSON.parse(data);
    res.json(submissions);
  } catch (err) {
    console.error('Error reading submissions catalog:', err);
    res.status(500).json({ error: 'Failed to read submissions' });
  }
});

// Serve submission images directly via custom high-speed lightweight binary file routing
app.get('/api/submissions/images/:filename', (req, res) => {
  const { filename } = req.params;
  const filePath = path.join(SUBMISSIONS_DIR, filename);
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).send('Image file not found');
  }
});

app.post('/api/submissions', async (req, res) => {
  try {
    const newSubmission = req.body;
    const { id, imageUrl, studentName, studentClass, fileName, createdAt, templateId, syncedToDrive } = newSubmission;
    
    let savedImageUrl = imageUrl;
    let imagePath = '';
    
    // Save heavy base64 image block as local jpg binary file to minimize JSON database size
    if (imageUrl && imageUrl.startsWith('data:image')) {
      const base64Data = imageUrl.split(';base64,').pop();
      if (base64Data) {
        const ext = fileName.split('.').pop() || 'jpg';
        const imageFilename = `${id}.${ext}`;
        imagePath = path.join(SUBMISSIONS_DIR, imageFilename);
        fs.writeFileSync(imagePath, base64Data, { encoding: 'base64' });
        
        // Save the clean request URL instead of the heavy Base64 payload!
        savedImageUrl = `/api/submissions/images/${imageFilename}`;
      }
    }
    
    let isSynced = syncedToDrive || false;

    // Server-side automatic upload to Google Drive if Admin Token exists
    if (imagePath && fs.existsSync(imagePath) && fs.existsSync(ADMIN_TOKEN_FILE)) {
      try {
        const tokenData = JSON.parse(fs.readFileSync(ADMIN_TOKEN_FILE, 'utf-8'));
        if (tokenData && tokenData.accessToken) {
          const sanitizedClass = studentClass.replace(/[^a-zA-Z0-9_\s-]/g, '').trim();
          const sanitizedName = studentName.replace(/[^a-zA-Z0-9_\s-]/g, '').trim();
          const autoDriveFileName = `Submisi_${sanitizedClass}_${sanitizedName.replace(/\s+/g, '_')}_${Date.now()}.png`;
          
          console.log(`Server attempting automated background Google Drive upload for student ${studentName}...`);
          const driveFileId = await uploadToGoogleDrive(
            imagePath,
            autoDriveFileName,
            'image/png',
            tokenData.accessToken
          );
          
          if (driveFileId) {
            isSynced = true;
            console.log(`Server-side background Google Drive upload succeeded. FileId: ${driveFileId}`);
          }
        }
      } catch (driveErr) {
        console.error('Server failed to auto-upload to Google Drive (accessToken token expired or folder write failed):', driveErr);
      }
    }
    
    const submissionRecord = {
      id,
      studentName,
      studentClass,
      fileName,
      imageUrl: savedImageUrl,
      createdAt: createdAt || new Date().toISOString(),
      templateId,
      syncedToDrive: isSynced
    };
    
    const data = fs.readFileSync(SUBMISSIONS_FILE, 'utf-8');
    let submissions = JSON.parse(data);
    
    submissions = submissions.filter((s: any) => s.id !== id);
    submissions.push(submissionRecord);
    
    fs.writeFileSync(SUBMISSIONS_FILE, JSON.stringify(submissions, null, 2), 'utf-8');
    res.status(201).json(submissionRecord);
  } catch (err) {
    console.error('Error adding submission:', err);
    res.status(500).json({ error: 'Failed to write submission record' });
  }
});

// 3. Admin Token API Endpoints
app.get('/api/admin/token', (req, res) => {
  try {
    if (fs.existsSync(ADMIN_TOKEN_FILE)) {
      const data = fs.readFileSync(ADMIN_TOKEN_FILE, 'utf-8');
      res.json(JSON.parse(data));
    } else {
      res.json({ accessToken: null });
    }
  } catch (err) {
    res.json({ accessToken: null });
  }
});

app.post('/api/admin/token', (req, res) => {
  try {
    const { accessToken } = req.body;
    fs.writeFileSync(ADMIN_TOKEN_FILE, JSON.stringify({ accessToken, savedAt: new Date().toISOString() }, null, 2), 'utf-8');
    console.log('Saved new Admin access token to server database.');
    res.json({ success: true, accessToken });
  } catch (err) {
    console.error('Error writing admin token:', err);
    res.status(500).json({ error: 'Failed to save admin token' });
  }
});

app.delete('/api/admin/token', (req, res) => {
  try {
    if (fs.existsSync(ADMIN_TOKEN_FILE)) {
      fs.unlinkSync(ADMIN_TOKEN_FILE);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete admin token' });
  }
});

app.put('/api/submissions/:id/sync', (req, res) => {
  try {
    const { id } = req.params;
    const { synced } = req.body;
    
    const data = fs.readFileSync(SUBMISSIONS_FILE, 'utf-8');
    let submissions = JSON.parse(data);
    
    submissions = submissions.map((s: any) => {
      if (s.id === id) {
        return { ...s, syncedToDrive: synced };
      }
      return s;
    });
    
    fs.writeFileSync(SUBMISSIONS_FILE, JSON.stringify(submissions, null, 2), 'utf-8');
    res.json({ success: true });
  } catch (err) {
    console.error('Error setting synced state:', err);
    res.status(500).json({ error: 'Failed to update synced status' });
  }
});

// Bulk sync pending submissions to Google Drive
app.post('/api/submissions/sync-all', async (req, res) => {
  try {
    if (!fs.existsSync(ADMIN_TOKEN_FILE)) {
      return res.status(400).json({ error: 'Folder Google Drive Guru belum dihubungkan. Silakan hubungkan terlebih dahulu.' });
    }

    const tokenData = JSON.parse(fs.readFileSync(ADMIN_TOKEN_FILE, 'utf-8'));
    if (!tokenData || !tokenData.accessToken) {
      return res.status(400).json({ error: 'Sesi Google Drive telah kadaluarsa. Silakan hubungkan ulang.' });
    }

    const data = fs.readFileSync(SUBMISSIONS_FILE, 'utf-8');
    let submissions = JSON.parse(data);
    const unsyncedSet = submissions.filter((s: any) => !s.syncedToDrive);

    if (unsyncedSet.length === 0) {
      return res.json({ success: true, syncedCount: 0 });
    }

    let successCount = 0;
    for (const sub of unsyncedSet) {
      try {
        const imagePath = path.join(SUBMISSIONS_DIR, `${sub.id}.jpg`);
        const fallbackPath = path.join(SUBMISSIONS_DIR, `${sub.id}.png`);
        let finalPath = fs.existsSync(imagePath) ? imagePath : (fs.existsSync(fallbackPath) ? fallbackPath : '');
        
        if (!finalPath && sub.imageUrl && sub.imageUrl.includes('/api/submissions/images/')) {
          const filename = sub.imageUrl.split('/').pop();
          if (filename) {
            finalPath = path.join(SUBMISSIONS_DIR, filename);
          }
        }

        if (finalPath && fs.existsSync(finalPath)) {
          const sanitizedClass = sub.studentClass.replace(/[^a-zA-Z0-9_\s-]/g, '').trim();
          const sanitizedName = sub.studentName.replace(/[^a-zA-Z0-9_\s-]/g, '').trim();
          const autoDriveFileName = `Submisi_${sanitizedClass}_${sanitizedName.replace(/\s+/g, '_')}_${Date.now()}.png`;
          
          const fileId = await uploadToGoogleDrive(finalPath, autoDriveFileName, 'image/png', tokenData.accessToken);
          if (fileId) {
            sub.syncedToDrive = true;
            successCount++;
          }
        }
      } catch (err) {
        console.error(`Gagal sync item ${sub.id}:`, err);
      }
    }

    if (successCount > 0) {
      fs.writeFileSync(SUBMISSIONS_FILE, JSON.stringify(submissions, null, 2), 'utf-8');
    }

    res.json({ success: true, syncedCount: successCount });
  } catch (err) {
    console.error('Error in bulk sync API:', err);
    res.status(500).json({ error: 'Failed to synchronize files' });
  }
});

app.delete('/api/submissions/:id', (req, res) => {
  try {
    const { id } = req.params;
    const data = fs.readFileSync(SUBMISSIONS_FILE, 'utf-8');
    let submissions = JSON.parse(data);
    
    const target = submissions.find((s: any) => s.id === id);
    if (target && target.imageUrl && target.imageUrl.includes('/api/submissions/images/')) {
      const filename = target.imageUrl.split('/').pop();
      if (filename) {
        const imagePath = path.join(SUBMISSIONS_DIR, filename);
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
        }
      }
    }
    
    submissions = submissions.filter((s: any) => s.id !== id);
    fs.writeFileSync(SUBMISSIONS_FILE, JSON.stringify(submissions, null, 2), 'utf-8');
    res.json({ success: true });
  } catch (err) {
    console.error('Error removing submission:', err);
    res.status(500).json({ error: 'Failed to remove submission record' });
  }
});

// Vite middleware development handler and production handler
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server launched successfully at http://localhost:${PORT}`);
  });
}

startServer();
