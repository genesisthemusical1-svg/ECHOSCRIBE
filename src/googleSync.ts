/**
 * Dedicated Google Drive & Google Sheets Sync Helpers
 * Handles folder creation, file creation/updating, and spreadsheet indexing client-side.
 */

// Helper to escape queries
const escapeDriveName = (name: string) => name.replace(/'/g, "\\'");

/**
 * Find or create a specific folder on Google Drive
 */
export async function findOrCreateFolder(token: string, folderName: string = "EchoScribe Notes"): Promise<string> {
  const query = `name = '${escapeDriveName(folderName)}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id)`;

  let res = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to search folder: ${errText}`);
  }

  const data = await res.json();
  if (data.files && data.files.length > 0) {
    return data.files[0].id;
  }

  // Folder does not exist, create it
  const createUrl = 'https://www.googleapis.com/drive/v3/files';
  res = await fetch(createUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder'
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to create Google Drive folder: ${errText}`);
  }

  const folder = await res.json();
  return folder.id;
}

/**
 * Find or create the master tracking Spreadsheet
 */
export async function findOrCreateSpreadsheet(token: string, folderId: string, sheetName: string = "EchoScribe Notes Index"): Promise<string> {
  const query = `name = '${escapeDriveName(sheetName)}' and mimeType = 'application/vnd.google-apps.spreadsheet' and '${folderId}' in parents and trashed = false`;
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id)`;

  let res = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to search spreadsheet: ${errText}`);
  }

  const data = await res.json();
  if (data.files && data.files.length > 0) {
    return data.files[0].id;
  }

  // Create new Spreadsheet
  const createUrl = 'https://www.googleapis.com/drive/v3/files';
  res = await fetch(createUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: sheetName,
      mimeType: 'application/vnd.google-apps.spreadsheet',
      parents: [folderId]
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to create spreadsheet: ${errText}`);
  }

  const file = await res.json();
  const spreadsheetId = file.id;

  // Initialize the sheet headers
  const sheetsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1!A1:E1?valueInputOption=USER_ENTERED`;
  await fetch(sheetsUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      values: [["Title", "Date Created", "Word Count", "Google Drive File ID", "Local Filename"]]
    })
  });

  return spreadsheetId;
}

/**
 * Upload or update a note Markdown file on Google Drive
 */
export async function syncNoteFile(
  token: string,
  folderId: string,
  note: { title: string; content: string; createdAt: string; filename: string }
): Promise<string> {
  // Use note.filename (immutable ID) to find file in order to avoid duplicates if title changes
  // Or look up by title to let the user open them. Let's look up by filename so it maps perfectly!
  const driveFileName = `${note.filename.replace(".md", "")} - ${note.title}.md`;
  
  // Find if a file for this note already exists in the folder
  // Query: find files with names starting with note.filename or matching the exact current filename
  const query = `name contains '${note.filename.replace(".md", "")}' and '${folderId}' in parents and trashed = false`;
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id, name)`;

  const resSearch = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${token}` }
  });

  let fileId = "";
  if (resSearch.ok) {
    const data = await resSearch.json();
    if (data.files && data.files.length > 0) {
      fileId = data.files[0].id;
      
      // Update name to match current title if it changed
      if (data.files[0].name !== driveFileName) {
        await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: driveFileName
          })
        });
      }
    }
  }

  const fileMetadata = {
    name: driveFileName,
    mimeType: "text/markdown",
    parents: fileId ? undefined : [folderId]
  };

  const fileBody = `---
title: ${note.title}
createdAt: ${note.createdAt}
localFilename: ${note.filename}
---
${note.content}
`;

  if (fileId) {
    // File exists, upload new content to its media endpoint
    const uploadUrl = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`;
    const resUpload = await fetch(uploadUrl, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "text/markdown"
      },
      body: fileBody
    });

    if (!resUpload.ok) {
      const errText = await resUpload.text();
      throw new Error(`Failed to update note content in Drive: ${errText}`);
    }
  } else {
    // Create new file metadata
    const createUrl = "https://www.googleapis.com/drive/v3/files";
    const resCreate = await fetch(createUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(fileMetadata)
    });

    if (!resCreate.ok) {
      const errText = await resCreate.text();
      throw new Error(`Failed to create note metadata in Drive: ${errText}`);
    }

    const file = await resCreate.json();
    fileId = file.id;

    // Upload content
    const uploadUrl = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`;
    const resUpload = await fetch(uploadUrl, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "text/markdown"
      },
      body: fileBody
    });

    if (!resUpload.ok) {
      const errText = await resUpload.text();
      throw new Error(`Failed to upload note content to Drive: ${errText}`);
    }
  }

  return fileId;
}

/**
 * Completely clear and re-write the tracking Google sheet index with the latest notes
 */
export async function updateSheetsIndex(
  token: string,
  spreadsheetId: string,
  notes: Array<{ title: string; createdAt: string; content: string; filename: string; googleDriveId?: string }>
): Promise<void> {
  // Clear the existing sheet rows (except for header Sheet1!A1:E1)
  const clearUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1!A2:E1000:clear`;
  await fetch(clearUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  // Prepare new rows
  const rows = notes.map(note => {
    const wordCount = note.content ? note.content.trim().split(/\s+/).length : 0;
    const dateFormatted = new Date(note.createdAt).toLocaleDateString() + " " + new Date(note.createdAt).toLocaleTimeString();
    return [
      note.title,
      dateFormatted,
      `${wordCount} words`,
      note.googleDriveId ? `https://drive.google.com/file/d/${note.googleDriveId}/view` : "Pending Sync",
      note.filename
    ];
  });

  if (rows.length === 0) return;

  // Write new rows
  const writeUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1!A2?valueInputOption=USER_ENTERED`;
  const resWrite = await fetch(writeUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      values: rows
    })
  });

  if (!resWrite.ok) {
    const errText = await resWrite.text();
    throw new Error(`Failed to update sheet index: ${errText}`);
  }
}
