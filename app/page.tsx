export default function Home() {
  return (
    <main style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>Universite</h1>
      <p style={{ fontSize: '1.25rem', color: '#666', marginBottom: '2rem' }}>
        AI Learning Assistant for Students
      </p>
      
      <div style={{ background: '#f5f5f5', padding: '1.5rem', borderRadius: '8px', marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>API Endpoints</h2>
        <ul style={{ lineHeight: '1.8' }}>
          <li><strong>POST /api/chat</strong> - AI chat with lecture context</li>
          <li><strong>POST /api/generate-flashcards</strong> - Generate flashcards from lectures</li>
          <li><strong>POST /api/transcribe</strong> - Transcribe audio files</li>
          <li><strong>GET /api/lectures</strong> - Get user's lectures</li>
          <li><strong>POST /api/lectures</strong> - Create a new lecture</li>
          <li><strong>GET /api/lectures/[id]</strong> - Get specific lecture</li>
          <li><strong>PUT /api/lectures/[id]</strong> - Update lecture</li>
          <li><strong>DELETE /api/lectures/[id]</strong> - Delete lecture</li>
          <li><strong>GET /api/health</strong> - Health check</li>
        </ul>
      </div>

      <div style={{ background: '#e3f2fd', padding: '1.5rem', borderRadius: '8px', marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Next Steps</h2>
        <ol style={{ lineHeight: '1.8' }}>
          <li>Install Node.js from <a href="https://nodejs.org/" style={{ color: '#1976d2' }}>nodejs.org</a></li>
          <li>Run <code style={{ background: '#f5f5f5', padding: '0.2rem 0.4rem', borderRadius: '4px' }}>npm install</code></li>
          <li>Copy environment variables from <code>.env</code> to <code>.env.local</code></li>
          <li>Run <code style={{ background: '#f5f5f5', padding: '0.2rem 0.4rem', borderRadius: '4px' }}>npm run dev</code> to test locally</li>
          <li>Push to GitHub and deploy to Vercel</li>
          <li>Migrate HTML pages to Next.js pages incrementally</li>
        </ol>
      </div>

      <p style={{ color: '#666', fontSize: '0.9rem' }}>
        Note: The HTML pages from the original Flask app need to be migrated to Next.js pages. 
        This is a frontend migration that can be done incrementally after the API is deployed.
      </p>
    </main>
  );
}
