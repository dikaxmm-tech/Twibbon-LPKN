/**
 * Google Drive integration utilities for uploading files
 */

const TARGET_FOLDER_ID = '1RY2ZZxiq9aCurhs8xIn7xTD7x3TU1Nkv';

interface UploadFileResponse {
  id: string;
  name: string;
  webViewLink?: string;
}

/**
 * Upload a file (Blob or File object) to the designated Google Drive folder
 */
export async function uploadFileToDrive(
  file: Blob | File,
  fileName: string,
  mimeType: string,
  accessToken: string
): Promise<UploadFileResponse> {
  if (!accessToken) {
    throw new Error('Google Drive access token is missing.');
  }

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
    const errorBody = await metaResponse.text();
    throw new Error(`Failed to create file metadata: ${metaResponse.statusText} - ${errorBody}`);
  }

  const metaDataResult = await metaResponse.json();
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
      body: file,
    }
  );

  if (!uploadResponse.ok) {
    const errorBody = await uploadResponse.text();
    throw new Error(`Failed to upload file content: ${uploadResponse.statusText} - ${errorBody}`);
  }

  // Step 3: Fetch webViewLink so we have a link to view/use if needed
  try {
    const getResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,webViewLink`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );
    if (getResponse.ok) {
      return await getResponse.json();
    }
  } catch (err) {
    console.warn('Error fetching webViewLink:', err);
  }

  return {
    id: fileId,
    name: fileName,
  };
}
