# Next.js Migration Instructions

## Migration Status

### Completed ✅
- Next.js project structure (package.json, next.config.js, tsconfig.json)
- API routes migrated to Next.js:
  - `/api/chat` - AI chat with lecture context
  - `/api/generate-flashcards` - Generate flashcards from lectures
  - `/api/transcribe` - Transcribe audio files
  - `/api/lectures` - CRUD operations for lectures
  - `/api/lectures/[lectureId]` - Individual lecture operations
  - `/api/health` - Health check endpoint
- Updated .gitignore for Next.js/Node.js
- Updated .env.local.example with environment variables
- Basic Next.js homepage with API documentation

### Pending ⏳
- Migrate HTML pages to Next.js pages (can be done incrementally)
- Frontend styling and components
- Static assets migration

## Deployment Steps

### 1. Install Node.js
Download and install Node.js LTS from https://nodejs.org/

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Copy your existing environment variables from `.env` to `.env.local`:
```bash
# If you have a .env file
cp .env .env.local

# Or manually copy the variables to .env.local
```

Required environment variables:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `HUGGINGFACE_API_KEY`
- `DEEPGRAM_API_KEY`
- `GOOGLE_APPLICATION_CREDENTIALS` (optional)

### 4. Test Locally
```bash
npm run dev
```
Visit http://localhost:3000 to test the application.

### 5. Deploy to Vercel

#### Option A: Using Vercel CLI
```bash
npm install -g vercel
vercel
```

#### Option B: Using GitHub
1. Push your code to GitHub
2. Go to https://vercel.com/new
3. Import your repository
4. Vercel will automatically detect Next.js
5. Add environment variables in Vercel dashboard
6. Deploy

### 6. Configure Environment Variables in Vercel
In your Vercel project dashboard:
1. Go to Settings → Environment Variables
2. Add the same variables from your `.env.local` file
3. Redeploy if needed

## API Endpoints

All API routes are now available at:

- `POST /api/chat` - AI chat with lecture context
- `POST /api/generate-flashcards` - Generate flashcards from lectures
- `POST /api/transcribe` - Transcribe audio files
- `GET /api/lectures` - Get user's lectures
- `POST /api/lectures` - Create a new lecture
- `GET /api/lectures/[lectureId]` - Get specific lecture
- `PUT /api/lectures/[lectureId]` - Update lecture
- `DELETE /api/lectures/[lectureId]` - Delete lecture
- `GET /api/health` - Health check

## Frontend Migration (Optional)

The original HTML pages can be migrated to Next.js pages incrementally:

1. Copy HTML content to corresponding Next.js page components
2. Convert inline scripts to React hooks
3. Migrate CSS to Tailwind CSS or CSS modules
4. Update API calls to use Next.js API routes

Example page structure:
```
app/
  page.tsx              # Homepage
  login/
    page.tsx           # Login page
  lectures/
    page.tsx           # Lectures list
    [id]/
      page.tsx         # Lecture detail
  settings/
    page.tsx           # Settings page
```

## Cleanup (Optional)

Once the Next.js deployment is working, you can remove the old Python/Flask files:

- `api/` directory (Python serverless function)
- `api.py` (Flask app)
- `requirements.txt` (Python dependencies)
- `.python-version` (Python version file)

## Troubleshooting

### TypeScript Errors
TypeScript errors will resolve after running `npm install` as the type definitions will be installed.

### Build Errors
Ensure all environment variables are set in `.env.local` and in Vercel dashboard.

### API Routes Not Working
Check that:
- Environment variables are correctly set
- Supabase credentials are valid
- API keys are correct

## Benefits of Next.js on Vercel

- **Zero Configuration**: Vercel automatically detects and optimizes Next.js
- **Fast Deployments**: Edge network for global performance
- **Automatic HTTPS**: SSL certificates included
- **Serverless Functions**: API routes run on serverless infrastructure
- **Static Optimization**: Automatic static page generation
- **Image Optimization**: Built-in image optimization
- **Better DX**: Hot reload, TypeScript support, modern tooling
