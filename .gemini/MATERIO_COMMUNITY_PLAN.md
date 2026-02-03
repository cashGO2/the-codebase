# Materio Community (Boards) - Implementation Plan

## Overview
A forum/community feature for Materio where users can post threads, discussions, and engage in collaborative learning. The feature will be built as an **injectable module** similar to giscus, with a separate API sub-project to handle the Vercel 12 API limit.

## Architecture

### Sub-Project Structure
```
d:\v4\materio\community-api\
├── .env
├── .env.example
├── .vercel/
├── index.js                 # Express app entry point
├── package.json
├── vercel.json
├── lib/
│   └── supabase.js          # Supabase client configuration
├── routes/
│   ├── posts.js             # Thread/Post CRUD operations
│   ├── comments.js          # Comments on posts
│   ├── votes.js             # Upvote/downvote system
│   ├── notes.js             # Community notes (context additions)
│   └── auth.js              # Auth middleware & user linking
└── middleware/
    └── cors.js              # CORS configuration
```

### Frontend Module Structure
```
d:\v4\materio\assets\scripts\community\
├── community.js             # Main injectable module
├── post-renderer.js         # Post/thread rendering
├── feed.js                  # Feed generation & infinite scroll
├── votes.js                 # Vote handling
├── notes.js                 # Community notes UI
└── attachments.js           # File upload handling
```

### CSS Styles
```
d:\v4\materio\assets\style\community.css   # All community styles
```

## Database Schema (Supabase/PostgreSQL)

### Tables

#### 1. `community_posts`
```sql
CREATE TABLE community_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    author_id UUID REFERENCES auth.users(id),
    author_name TEXT NOT NULL,
    is_anonymous BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    upvotes INTEGER DEFAULT 0,
    downvotes INTEGER DEFAULT 0,
    comment_count INTEGER DEFAULT 0,
    tags TEXT[] DEFAULT '{}',
    semester TEXT,
    subject TEXT,
    is_pinned BOOLEAN DEFAULT false,
    is_verified BOOLEAN DEFAULT false,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'hidden', 'deleted'))
);
```

#### 2. `community_comments`
```sql
CREATE TABLE community_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID REFERENCES community_posts(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES community_comments(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    author_id UUID REFERENCES auth.users(id),
    author_name TEXT NOT NULL,
    is_anonymous BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    upvotes INTEGER DEFAULT 0,
    downvotes INTEGER DEFAULT 0,
    is_verified BOOLEAN DEFAULT false
);
```

#### 3. `community_votes`
```sql
CREATE TABLE community_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    target_id UUID NOT NULL,
    target_type TEXT NOT NULL CHECK (target_type IN ('post', 'comment', 'note')),
    vote_type TEXT NOT NULL CHECK (vote_type IN ('up', 'down')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, target_id, target_type)
);
```

#### 4. `community_notes`
```sql
CREATE TABLE community_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID REFERENCES community_posts(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    author_id UUID REFERENCES auth.users(id),
    author_name TEXT NOT NULL,
    is_faculty_verified BOOLEAN DEFAULT false,
    faculty_verifier_id UUID REFERENCES auth.users(id),
    student_verifications INTEGER DEFAULT 0,
    is_approved BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 5. `community_attachments`
```sql
CREATE TABLE community_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID REFERENCES community_posts(id) ON DELETE CASCADE,
    comment_id UUID REFERENCES community_comments(id) ON DELETE CASCADE,
    file_url TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 6. `community_note_votes`
```sql
CREATE TABLE community_note_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    note_id UUID REFERENCES community_notes(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    is_helpful BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(note_id, user_id)
);
```

### Realtime Subscriptions
Using Supabase Realtime for:
- New posts in feed
- New comments on viewed posts
- Vote count updates
- Community notes additions

## API Endpoints

### Posts
- `GET /posts` - Get feed with pagination
- `GET /posts/:id` - Get single post with comments
- `POST /posts` - Create new post
- `PUT /posts/:id` - Update post
- `DELETE /posts/:id` - Delete post

### Comments
- `GET /posts/:id/comments` - Get comments for a post
- `POST /posts/:id/comments` - Add comment
- `PUT /comments/:id` - Update comment
- `DELETE /comments/:id` - Delete comment

### Votes
- `POST /votes` - Cast vote (up/down)
- `DELETE /votes/:target_id` - Remove vote

### Notes
- `GET /posts/:id/notes` - Get community notes
- `POST /posts/:id/notes` - Add community note
- `POST /notes/:id/verify` - Verify note (faculty/student)

### Attachments
- `POST /upload` - Upload attachment (to Supabase Storage)
- `DELETE /attachments/:id` - Delete attachment

## Core Features

### 1. Attachments Support
- **Images**: JPG, PNG, WebP, GIF (with animation support)
- **Videos**: MP4, WebM (max 50MB)
- **Documents**: PDF, DOCX, PPTX (max 25MB)
- Storage: Supabase Storage with CDN delivery
- Preview: Image/video thumbnails, document icons

### 2. Vote System
- Upvote/downvote on posts, comments, and notes
- One vote per user per item (can switch)
- Real-time vote count updates
- Vote history tracking

### 3. Identity Options
- **Materio Account**: Link with existing Materio account (shows username & avatar)
- **Anonymous**: Display as "materio_user" with anonymous avatar
- Users can choose per-post/comment

### 4. Community Notes (Reader's Added Context)
Similar to X/Twitter Community Notes:
- Any user can propose a context note
- **Faculty Verification**: Auto-approved if verified faculty confirms
- **Student Consensus**: Needs 5+ student votes with >70% "helpful" rating
- Shows below post when approved
- Different visual treatment (highlighted, trusted)

## Injectable Module Design

### Usage (Similar to Giscus)
```html
<!-- Include in page -->
<div id="materio-community" 
     data-feed-type="subject"
     data-subject="computer-networks"
     data-semester="6">
</div>
<script src="https://materioa.netlify.app/assets/scripts/community/community.js" 
        data-theme="auto"
        async>
</script>
```

### Module Features
1. **Self-contained**: All CSS/JS bundled together
2. **Theme-aware**: Respects dark/light mode
3. **Responsive**: Mobile-first design
4. **Real-time**: Live updates via Supabase
5. **Configurable**: Data attributes for customization

### Configuration Options
```javascript
{
    feedType: 'all' | 'subject' | 'semester' | 'user',
    subject: string,
    semester: string,
    theme: 'light' | 'dark' | 'auto',
    enableAnonymous: true,
    enableNotes: true,
    postsPerPage: 10
}
```

## UI/UX Design

### Feed View
- Card-based post previews
- Infinite scroll pagination
- Filter pills (Latest, Popular, Unanswered)
- Quick vote buttons
- Thread preview (first 2 lines)

### Post Detail View
- Full post content
- Rich text rendering (Markdown)
- Attachment gallery
- Comment thread (nested)
- Community notes section
- Vote buttons with counts
- Share/bookmark actions

### Create Post Modal
- Rich text editor with Markdown
- Attachment upload dropzone
- Tag selection
- Anonymous toggle
- Preview mode

### Visual Hierarchy
- Orange accent (#ff8200) for primary actions
- Glassmorphism for cards
- Smooth animations/transitions
- Dark mode support

## Implementation Phases

### Phase 1: Foundation
1. Create `community-api` sub-project
2. Set up Supabase tables and RLS policies
3. Implement core API endpoints (posts, comments)
4. Basic frontend module structure

### Phase 2: Core Features
1. Vote system implementation
2. Attachment upload handling
3. Real-time subscriptions
4. Feed rendering with pagination

### Phase 3: Advanced Features
1. Community notes system
2. Faculty verification flow
3. Student consensus mechanism
4. Anonymous posting

### Phase 4: Polish
1. Theme integration
2. Mobile optimization
3. Performance tuning
4. Error handling & edge cases

## Security Considerations

### Row-Level Security (RLS)
- Users can only edit/delete their own posts
- Vote manipulation prevention
- Rate limiting on API
- Content moderation hooks

### CORS Configuration
```javascript
origin: [
    'https://materioa.netlify.app',
    'https://materio-boards.vercel.app',
    'http://localhost:*'
]
```

## Deployment

### Community API (Separate Vercel Project)
- Deploy to: `materio-community-api.vercel.app`
- Connect to same Supabase project
- Environment variables from main .env

### Frontend Module
- Bundled with main Materio assets
- Loaded on-demand when community tab active
- CDN cached for performance

## Next Steps
1. Create the `community-api` sub-project structure
2. Set up Supabase migrations for new tables
3. Implement the injectable module

---
*Created: 2026-01-31*
*Status: Planning*
