const { 
  supabase, 
  verifyToken, 
  getTokenFromHeaders,
  corsHeaders
} = require('./utils');

// Load environment variables
require('dotenv').config();

exports.handler = async (event, context) => {
  // Dynamic import for ES module
  const { Octokit } = await import('@octokit/rest');
  const origin = event.headers.origin || event.headers.Origin;
  
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders(origin),
      body: ''
    };
  }

  try {
    // Get token from headers
    const token = getTokenFromHeaders(event.headers);
    
    if (!token) {
      return {
        statusCode: 401,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Authentication required' })
      };
    }

    // Verify token
    const decoded = verifyToken(token);
    if (!decoded) {
      return {
        statusCode: 401,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid token' })
      };    }

    // Get user and check admin privileges
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, has_admin_privileges')
      .eq('id', decoded.id)
      .single();

    if (userError || !user || !user.has_admin_privileges) {
      return {
        statusCode: 403,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Admin privileges required' })
      };
    }

    // Initialize GitHub client
    console.log('GitHub token available:', !!process.env.GITHUB_TOKEN);
    console.log('GitHub token length:', process.env.GITHUB_TOKEN ? process.env.GITHUB_TOKEN.length : 0);
    
    if (!process.env.GITHUB_TOKEN) {
      return {
        statusCode: 500,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'GitHub token not configured' })
      };
    }
    
    const octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN
    });

    const REPO_OWNER = 'Materioa';
    const REPO_NAME = 'cdn-materio';

    const method = event.httpMethod;    switch (method) {
      case 'GET':
        // List files or get file info
        let queryPath = event.queryStringParameters?.path || '';
        // Decode URL-encoded path (e.g., %2F -> /)
        queryPath = decodeURIComponent(queryPath);
        // Convert '/' to empty string for GitHub API root directory
        if (queryPath === '/') {
          queryPath = '';
        }
        return await listGitHubFiles(octokit, REPO_OWNER, REPO_NAME, queryPath, origin);

      case 'POST':
        // Upload file
        return await uploadGitHubFile(event, octokit, REPO_OWNER, REPO_NAME, origin);

      case 'DELETE':
        // Delete file
        let deletePath = event.queryStringParameters?.path;
        if (!deletePath) {          return {
            statusCode: 400,
            headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'File path required' })
          };
        }
        // Decode URL-encoded path (e.g., %2F -> /)
        deletePath = decodeURIComponent(deletePath);
        // Convert '/' to empty string for GitHub API root directory
        if (deletePath === '/') {
          deletePath = '';
        }
        return await deleteGitHubFile(octokit, REPO_OWNER, REPO_NAME, deletePath, origin);

      case 'PUT':
        // Rename file
        const body = JSON.parse(event.body);
        const oldPath = body.oldPath;
        const newPath = body.newPath;
        if (!oldPath || !newPath) {
          return {
            statusCode: 400,
            headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Both oldPath and newPath required' })
          };
        }
        return await renameGitHubFile(octokit, REPO_OWNER, REPO_NAME, oldPath, newPath, origin);

      default:
        return {
          statusCode: 405,
          headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Method not allowed' })
        };
    }
  } catch (error) {
    console.error('CDN API Error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    return {
      statusCode: 500,
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        error: 'Internal server error',
        details: error.message // Add error details for debugging
      })
    };
  }
};

// Helper function to list GitHub files
async function listGitHubFiles(octokit, owner, repo, path, origin) {
  try {
    const { data } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: path || ''
    });

    if (Array.isArray(data)) {
      // Directory listing
      const fileList = data.map(item => ({
        name: item.name,
        type: item.type === 'dir' ? 'directory' : 'file',
        size: item.type === 'file' ? item.size : null,
        path: item.path,
        download_url: item.download_url,
        sha: item.sha
      }));

      return {
        statusCode: 200,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'directory',
          path: path || '',
          items: fileList.sort((a, b) => {
            if (a.type !== b.type) {
              return a.type === 'directory' ? -1 : 1;
            }
            return a.name.localeCompare(b.name);
          })
        })
      };
    } else {
      // Single file
      return {
        statusCode: 200,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'file',
          name: data.name,
          size: data.size,
          path: data.path,
          download_url: data.download_url,
          sha: data.sha
        })
      };
    }

  } catch (error) {
    if (error.status === 404) {
      return {
        statusCode: 404,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'File or directory not found' })
      };
    }
    console.error('GitHub API Error:', error);
    return {
      statusCode: 500,
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to list files' })
    };
  }
}

// Helper function to upload file to GitHub
async function uploadGitHubFile(event, octokit, owner, repo, origin) {
  try {
    console.log('Upload request received');
    console.log('Content-Type:', event.headers['content-type']);
    console.log('Body length:', event.body ? event.body.length : 0);
    
    if (!event.body) {
      return {
        statusCode: 400,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'No body provided' })
      };
    }

    // Parse multipart form data manually for serverless
    const body = event.isBase64Encoded ? Buffer.from(event.body, 'base64') : Buffer.from(event.body);
    const contentType = event.headers['content-type'] || event.headers['Content-Type'];
    
    if (!contentType || !contentType.includes('multipart/form-data')) {
      return {
        statusCode: 400,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid content type. Expected multipart/form-data' })
      };
    }

    // Extract boundary
    const boundary = contentType.split('boundary=')[1];
    if (!boundary) {
      return {
        statusCode: 400,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'No boundary found in content-type' })
      };
    }

    // Parse multipart data
    const parts = body.toString().split(`--${boundary}`);
    let fileContent = null;
    let fileName = null;
    let targetPath = '';

    for (const part of parts) {
      if (part.includes('Content-Disposition: form-data')) {
        const lines = part.split('\r\n');
        const disposition = lines.find(line => line.includes('Content-Disposition'));
        
        if (disposition && disposition.includes('name="file"')) {
          // Extract filename
          const filenameMatch = disposition.match(/filename="([^"]+)"/);
          if (filenameMatch) {
            fileName = filenameMatch[1];
          }
          
          // Find content (after double CRLF)
          const contentStart = part.indexOf('\r\n\r\n') + 4;
          const contentEnd = part.lastIndexOf('\r\n');
          if (contentStart < contentEnd) {
            fileContent = part.slice(contentStart, contentEnd);
          }
        } else if (disposition && disposition.includes('name="path"')) {
          // Extract path
          const contentStart = part.indexOf('\r\n\r\n') + 4;
          const contentEnd = part.lastIndexOf('\r\n');
          if (contentStart < contentEnd) {
            targetPath = part.slice(contentStart, contentEnd).trim();
          }
        }
      }
    }

    if (!fileContent || !fileName) {
      return {
        statusCode: 400,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'No file provided or file parsing failed' })
      };
    }

    // Convert '/' to empty string for GitHub API root directory
    if (targetPath === '/') {
      targetPath = '';
    }

    const filePath = targetPath ? `${targetPath}/${fileName}` : fileName;
    
    // Convert file content to base64
    const content = Buffer.from(fileContent, 'binary').toString('base64');

    console.log('Uploading file:', fileName, 'to path:', filePath);

    // Check if file already exists to get SHA for update
    let sha = null;
    try {
      const { data: existingFile } = await octokit.rest.repos.getContent({
        owner,
        repo,
        path: filePath
      });
      sha = existingFile.sha;
      console.log('File exists, updating with SHA:', sha);
    } catch (error) {
      // File doesn't exist, which is fine for new uploads
      if (error.status !== 404) {
        throw error;
      }
      console.log('New file upload');
    }

    // Upload/update file
    const { data } = await octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: filePath,
      message: `Upload ${fileName}`,
      content,
      sha // Include SHA if updating existing file
    });

    console.log('File uploaded successfully');

    return {
      statusCode: 200,
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'File uploaded successfully',
        file: {
          name: fileName,
          path: filePath,
          size: Buffer.from(fileContent, 'binary').length,
          sha: data.content.sha,
          download_url: data.content.download_url
        }
      })
    };

  } catch (error) {
    console.error('Upload error:', error);
    return {
      statusCode: 500,
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Upload failed: ' + error.message })
    };
  }
}

// Helper function to delete file from GitHub
async function deleteGitHubFile(octokit, owner, repo, path, origin) {
  try {
    // Get file info to get SHA
    const { data } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path
    });    if (Array.isArray(data)) {
      // This is a directory - perform recursive deletion
      console.log(`Deleting directory: ${path} with ${data.length} items`);
      
      // Delete all files in the directory first
      const deletePromises = data.map(async (item) => {
        if (item.type === 'file') {
          console.log(`Deleting file: ${item.path}`);
          return await octokit.rest.repos.deleteFile({
            owner,
            repo,
            path: item.path,
            message: `Delete ${item.name} from ${path}`,
            sha: item.sha
          });
        } else if (item.type === 'dir') {
          // Recursively delete subdirectory
          console.log(`Recursively deleting subdirectory: ${item.path}`);
          const result = await deleteGitHubFile(octokit, owner, repo, item.path, origin);
          if (result.statusCode !== 200) {
            throw new Error(`Failed to delete subdirectory: ${item.path}`);
          }
          return result;
        }
      });

      // Wait for all deletions to complete
      await Promise.all(deletePromises);

      // Cleanup metadata after successful deletion
      await cleanupMetadataOnDeletion(octokit, owner, repo, path, origin);

      return {
        statusCode: 200,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: `Directory '${path}' and all its contents deleted successfully`,
          deletedItems: data.length
        })
      };
    } else {
      // This is a single file
      console.log(`Deleting file: ${path}`);
      
      // Delete the file
      await octokit.rest.repos.deleteFile({
        owner,
        repo,
        path,
        message: `Delete ${data.name}`,
        sha: data.sha
      });

      // Cleanup metadata after successful deletion
      await cleanupMetadataOnDeletion(octokit, owner, repo, path, origin);

      return {
        statusCode: 200,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'File deleted successfully' })
      };
    }

  } catch (error) {
    if (error.status === 404) {
      return {
        statusCode: 404,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'File not found' })
      };
    }
    console.error('GitHub delete error:', error);
    return {
      statusCode: 500,
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Delete failed: ' + error.message })
    };
  }
}

// Helper function to rename file in GitHub
async function renameGitHubFile(octokit, owner, repo, oldPath, newPath, origin) {
  try {
    // Get the current file content and SHA
    const { data: fileData } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: oldPath
    });

    if (Array.isArray(fileData)) {
      return {
        statusCode: 400,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Cannot rename directory' })
      };
    }

    // Create new file with same content
    await octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: newPath,
      message: `Rename ${oldPath} to ${newPath}`,
      content: fileData.content
    });

    // Delete old file
    await octokit.rest.repos.deleteFile({
      owner,
      repo,
      path: oldPath,
      message: `Remove old file ${oldPath} after rename`,
      sha: fileData.sha
    });

    return {
      statusCode: 200,
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        message: 'File renamed successfully',
        oldPath,
        newPath 
      })
    };

  } catch (error) {
    if (error.status === 404) {
      return {
        statusCode: 404,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'File not found' })
      };
    }
    console.error('GitHub rename error:', error);
    return {
      statusCode: 500,
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Rename failed: ' + error.message })
    };
  }
}

// Helper function to clean up metadata files when files are deleted
async function cleanupMetadataOnDeletion(octokit, owner, repo, deletedPath, origin) {
  try {
    console.log(`Cleaning up metadata for deleted path: ${deletedPath}`);
    
    // Clean up resource library
    await cleanupResourceLibrary(octokit, owner, repo, deletedPath, origin);
    
    // Clean up notifications (optional - could add deletion notification)
    await createDeletionNotification(octokit, owner, repo, deletedPath, origin);
    
  } catch (error) {
    console.error('Error cleaning up metadata:', error);
    // Don't fail the deletion if metadata cleanup fails
  }
}

// Helper function to clean up resource library
async function cleanupResourceLibrary(octokit, owner, repo, deletedPath, origin) {
  try {
    // Get the resource library file
    const { data: resourceLibData } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: 'databases/beta/resource.lib.json'
    });
    
    const content = Buffer.from(resourceLibData.content, 'base64').toString('utf8');
    let resourceLib = JSON.parse(content);
    
    // Extract filename from path for cleanup
    const fileName = deletedPath.split('/').pop();
    let updated = false;
    
    // Search through all semesters, subjects, and categories to remove the file
    for (const semester in resourceLib) {
      if (typeof resourceLib[semester] === 'object') {
        for (const subject in resourceLib[semester]) {
          if (Array.isArray(resourceLib[semester][subject])) {
            for (const category of resourceLib[semester][subject]) {
              if (category.content && Array.isArray(category.content)) {
                const initialLength = category.content.length;
                category.content = category.content.filter(file => file !== fileName);
                if (category.content.length !== initialLength) {
                  updated = true;
                  console.log(`Removed ${fileName} from ${semester}/${subject}/${category.type}`);
                }
              }
            }
          }
        }
      }
    }
    
    // Update the resource library file if changes were made
    if (updated) {
      const updatedContent = Buffer.from(JSON.stringify(resourceLib, null, 2)).toString('base64');
      await octokit.rest.repos.createOrUpdateFileContents({
        owner,
        repo,
        path: 'databases/beta/resource.lib.json',
        message: `Remove ${fileName} from resource library`,
        content: updatedContent,
        sha: resourceLibData.sha
      });
      console.log('Resource library updated successfully');
    }
    
  } catch (error) {
    if (error.status === 404) {
      console.log('Resource library file not found, skipping cleanup');
    } else {
      console.error('Error cleaning up resource library:', error);
    }
  }
}

// Helper function to create deletion notification
async function createDeletionNotification(octokit, owner, repo, deletedPath, origin) {
  try {
    // Get existing notifications
    let notifications = [];
    let notificationsSha = null;
    
    try {
      const { data: notificationsData } = await octokit.rest.repos.getContent({
        owner,
        repo,
        path: 'notifications.json'
      });
      
      const content = Buffer.from(notificationsData.content, 'base64').toString('utf8');
      notifications = JSON.parse(content);
      notificationsSha = notificationsData.sha;
    } catch (error) {
      console.log('No existing notifications file, creating new one');
    }
    
    // Create deletion notification
    const fileName = deletedPath.split('/').pop();
    const notification = {
      title: "File Deleted",
      message: `File "${fileName}" has been removed from the system.`,
      date: new Date().toISOString(),
      type: "deletion",
      links: []
    };
    
    // Add notification to the top
    notifications.unshift(notification);
    
    // Keep only last 100 notifications
    if (notifications.length > 100) {
      notifications = notifications.slice(0, 100);
    }
    
    // Update notifications file
    const updatedContent = Buffer.from(JSON.stringify(notifications, null, 2)).toString('base64');
    
    if (notificationsSha) {
      await octokit.rest.repos.createOrUpdateFileContents({
        owner,
        repo,
        path: 'notifications.json',
        message: `Add deletion notification for ${fileName}`,
        content: updatedContent,
        sha: notificationsSha
      });
    } else {
      await octokit.rest.repos.createOrUpdateFileContents({
        owner,
        repo,
        path: 'notifications.json',
        message: `Create notifications file with deletion of ${fileName}`,
        content: updatedContent
      });
    }
    
    console.log('Deletion notification created successfully');
    
  } catch (error) {
    console.error('Error creating deletion notification:', error);
  }
}
