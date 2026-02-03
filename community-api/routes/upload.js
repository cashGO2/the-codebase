// Upload/Attachments API routes for Materio Community
const express = require('express');
const router = express.Router();
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { supabaseAdmin } = require('../lib/supabase');
const { authMiddleware, rateLimit } = require('../middleware/auth');

// Configure multer for memory storage
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB max
        files: 5 // Max 5 files per upload
    },
    fileFilter: (req, file, cb) => {
        // Allowed file types
        const allowedTypes = {
            images: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
            videos: ['video/mp4', 'video/webm'],
            documents: ['application/pdf', 'application/msword',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'application/vnd.ms-powerpoint',
                'application/vnd.openxmlformats-officedocument.presentationml.presentation']
        };

        const allAllowed = [...allowedTypes.images, ...allowedTypes.videos, ...allowedTypes.documents];

        if (allAllowed.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error(`File type ${file.mimetype} not allowed`), false);
        }
    }
});

// File type to category mapping
function getFileCategory(mimetype) {
    if (mimetype.startsWith('image/')) return 'images';
    if (mimetype.startsWith('video/')) return 'videos';
    return 'documents';
}

// File type to extension mapping
function getFileExtension(mimetype) {
    const map = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp',
        'image/gif': 'gif',
        'video/mp4': 'mp4',
        'video/webm': 'webm',
        'application/pdf': 'pdf',
        'application/msword': 'doc',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
        'application/vnd.ms-powerpoint': 'ppt',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx'
    };
    return map[mimetype] || 'bin';
}

/**
 * POST /upload - Upload attachment(s)
 */
router.post('/', authMiddleware(true), rateLimit(10, 60000), upload.array('files', 5), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No files uploaded' });
        }

        const uploadedFiles = [];
        const errors = [];

        for (const file of req.files) {
            try {
                const category = getFileCategory(file.mimetype);
                const extension = getFileExtension(file.mimetype);
                const fileName = `${uuidv4()}.${extension}`;
                const filePath = `community/${category}/${fileName}`;

                // Upload to Supabase Storage
                const { data, error } = await supabaseAdmin.storage
                    .from('attachments')
                    .upload(filePath, file.buffer, {
                        contentType: file.mimetype,
                        upsert: false
                    });

                if (error) {
                    console.error('Storage upload error:', error);
                    errors.push({ file: file.originalname, error: error.message });
                    continue;
                }

                // Get public URL
                const { data: urlData } = supabaseAdmin.storage
                    .from('attachments')
                    .getPublicUrl(filePath);

                uploadedFiles.push({
                    name: file.originalname,
                    url: urlData.publicUrl,
                    type: category,
                    mime_type: file.mimetype,
                    size: file.size,
                    path: filePath
                });
            } catch (uploadError) {
                console.error('File upload error:', uploadError);
                errors.push({ file: file.originalname, error: uploadError.message });
            }
        }

        if (uploadedFiles.length === 0) {
            return res.status(500).json({
                error: 'All file uploads failed',
                details: errors
            });
        }

        res.status(201).json({
            files: uploadedFiles,
            errors: errors.length > 0 ? errors : undefined,
            message: `${uploadedFiles.length} file(s) uploaded successfully`
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: error.message || 'Upload failed' });
    }
});

/**
 * DELETE /upload/:attachmentId - Delete an attachment
 */
router.delete('/:attachmentId', authMiddleware(true), async (req, res) => {
    try {
        const { attachmentId } = req.params;

        // Get attachment info
        const { data: attachment } = await supabaseAdmin
            .from('community_attachments')
            .select('id, file_url, post_id, comment_id')
            .eq('id', attachmentId)
            .single();

        if (!attachment) {
            return res.status(404).json({ error: 'Attachment not found' });
        }

        // Check ownership via post or comment
        let isOwner = false;

        if (attachment.post_id) {
            const { data: post } = await supabaseAdmin
                .from('community_posts')
                .select('author_id')
                .eq('id', attachment.post_id)
                .single();

            isOwner = post?.author_id === req.user.id;
        } else if (attachment.comment_id) {
            const { data: comment } = await supabaseAdmin
                .from('community_comments')
                .select('author_id')
                .eq('id', attachment.comment_id)
                .single();

            isOwner = comment?.author_id === req.user.id;
        }

        if (!isOwner && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Not authorized to delete this attachment' });
        }

        // Extract file path from URL for storage deletion
        const urlParts = new URL(attachment.file_url);
        const pathMatch = urlParts.pathname.match(/\/attachments\/(.+)$/);

        if (pathMatch) {
            // Delete from storage
            await supabaseAdmin.storage
                .from('attachments')
                .remove([pathMatch[1]]);
        }

        // Delete from database
        const { error } = await supabaseAdmin
            .from('community_attachments')
            .delete()
            .eq('id', attachmentId);

        if (error) {
            console.error('Error deleting attachment:', error);
            return res.status(500).json({ error: 'Failed to delete attachment' });
        }

        res.json({ message: 'Attachment deleted successfully' });
    } catch (error) {
        console.error('Attachment delete error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /upload/presigned - Get presigned URL for direct upload (optional alternative)
 */
router.get('/presigned', authMiddleware(true), async (req, res) => {
    try {
        const { filename, mimetype } = req.query;

        if (!filename || !mimetype) {
            return res.status(400).json({ error: 'Missing filename or mimetype' });
        }

        const category = getFileCategory(mimetype);
        const extension = getFileExtension(mimetype);
        const uniqueFilename = `${uuidv4()}.${extension}`;
        const filePath = `community/${category}/${uniqueFilename}`;

        // Create signed URL for upload
        const { data, error } = await supabaseAdmin.storage
            .from('attachments')
            .createSignedUploadUrl(filePath);

        if (error) {
            console.error('Presigned URL error:', error);
            return res.status(500).json({ error: 'Failed to generate upload URL' });
        }

        // Get public URL that will be valid after upload
        const { data: urlData } = supabaseAdmin.storage
            .from('attachments')
            .getPublicUrl(filePath);

        res.json({
            uploadUrl: data.signedUrl,
            token: data.token,
            publicUrl: urlData.publicUrl,
            path: filePath,
            expiresIn: 3600 // 1 hour
        });
    } catch (error) {
        console.error('Presigned URL error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
