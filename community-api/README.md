# Materio Community API

A separate Vercel serverless API for the Materio Community/Boards feature. This sub-project was created to work around Vercel's 12 API route limit per deployment.

## Features

- **Posts**: Create, read, update, delete discussion threads
- **Comments**: Threaded/nested comment system
- **Votes**: Upvote/downvote on posts, comments, and notes
- **Community Notes**: Reader-added context (like X/Twitter Community Notes)
  - Faculty verification (auto-approve)
  - Student consensus (5+ votes, 70% helpful threshold)
- **Attachments**: Support for images, GIFs, videos, and documents
- **Anonymous Posting**: Users can post as "materio_user"
- **Real-time Updates**: Supabase Realtime for live feed updates

## Tech Stack

- **Runtime**: Node.js + Express
- **Database**: Supabase (PostgreSQL)
- **Storage**: Supabase Storage
- **Auth**: JWT (compatible with Materio auth)
- **Hosting**: Vercel Serverless Functions

## Getting Started

### 1. Install Dependencies

```bash
cd community-api
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

Required environment variables:
- `PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (for admin operations)
- `JWT_SECRET` - Secret for verifying JWT tokens
- `FRONTEND_URL` - Main Materio frontend URL for CORS

### 3. Set Up Database

Run the SQL migration in your Supabase SQL Editor:

```sql
-- See sql/001_create_tables.sql
```

This creates:
- `community_posts` - Thread/post storage
- `community_comments` - Threaded comments
- `community_votes` - Vote tracking
- `community_notes` - Crowd-sourced context
- `community_note_votes` - Note helpfulness votes
- `community_attachments` - File metadata

### 4. Create Storage Bucket

In Supabase Dashboard → Storage:

1. Create a new bucket called `attachments`
2. Make it public
3. Add these policies:
   - Allow authenticated users to upload
   - Allow public read access

### 5. Run Locally

```bash
npm run dev
```

API will be available at `http://localhost:3001`

### 6. Deploy to Vercel

```bash
vercel
```

Or connect to GitHub for automatic deployments.

## API Endpoints

### Posts

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/posts` | Get feed with pagination & filters |
| GET | `/posts/:id` | Get single post with details |
| POST | `/posts` | Create new post (auth required) |
| PUT | `/posts/:id` | Update post (owner only) |
| DELETE | `/posts/:id` | Delete post (owner only) |

**Query Parameters for GET /posts:**
- `page` - Page number (default: 1)
- `limit` - Posts per page (default: 10)
- `sort` - `newest`, `popular`, `oldest`, `unanswered`
- `semester` - Filter by semester
- `subject` - Filter by subject
- `search` - Search in title/content

### Comments

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/comments/:postId` | Get comments for a post |
| POST | `/comments/:postId` | Add comment (auth required) |
| PUT | `/comments/:id` | Update comment (owner only) |
| DELETE | `/comments/:id` | Delete comment (owner only) |

### Votes

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/votes` | Cast vote (up/down) |
| DELETE | `/votes/:target_id` | Remove vote |
| GET | `/votes/user` | Get user's votes on targets |

**Body for POST /votes:**
```json
{
  "target_id": "uuid",
  "target_type": "post|comment|note",
  "vote_type": "up|down"
}
```

### Community Notes

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/notes/:postId` | Get notes for a post |
| POST | `/notes/:postId` | Add community note |
| POST | `/notes/:id/verify` | Faculty verify note |
| POST | `/notes/:id/vote` | Vote on note helpfulness |
| DELETE | `/notes/:id` | Delete note (owner only) |

### Upload

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/upload` | Upload file(s) |
| DELETE | `/upload/:id` | Delete attachment |
| GET | `/upload/presigned` | Get presigned upload URL |

## Frontend Integration

### Injectable Module

The community widget can be embedded on any page:

```html
<div id="materio-community" 
     data-api-url="https://materio-community.vercel.app"
     data-theme="auto"
     data-semester="6"
     data-subject="computer-networks">
</div>
<script src="https://materioa.netlify.app/assets/scripts/community/community.js" async></script>
```

### Configuration Options

| Attribute | Values | Default | Description |
|-----------|--------|---------|-------------|
| `data-api-url` | URL | `https://materio-community.vercel.app` | API endpoint |
| `data-theme` | `auto`, `light`, `dark` | `auto` | Color theme |
| `data-semester` | string | - | Filter by semester |
| `data-subject` | string | - | Filter by subject |
| `data-feed-type` | `all`, `semester`, `subject` | `all` | Feed filter mode |
| `data-posts-per-page` | number | `10` | Pagination size |
| `data-enable-anonymous` | `true`, `false` | `true` | Allow anonymous posts |
| `data-enable-notes` | `true`, `false` | `true` | Show community notes |
| `data-enable-attachments` | `true`, `false` | `true` | Allow file uploads |

## CORS Configuration

The API allows requests from:
- `https://materioa.netlify.app`
- `https://materio-community.vercel.app`
- `http://localhost:*` (development)

## Rate Limiting

- Posts: 10 per minute
- Comments: 20 per minute
- Votes: 60 per minute
- Notes: 5 per minute
- Uploads: 10 per minute

## Security

- Row-Level Security (RLS) on all tables
- JWT token verification for authenticated endpoints
- Self-vote prevention
- Content ownership validation
- File type and size restrictions

## License

MIT - Part of the Materio project
