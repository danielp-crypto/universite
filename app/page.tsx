import Link from 'next/link';

export const metadata = {
  title: 'Universite - AI Learning Assistant for Students | Record Lectures & Get AI Tutoring',
  description: 'Universite - AI Learning Assistant for Students. Record lectures, get instant transcripts, personalized tutoring, homework help, and AI-powered study tools. Transform your learning experience with AI.',
  keywords: 'AI learning assistant, university student tools, lecture recording, transcript generator, AI tutor, homework help, study assistant, educational technology, student productivity, AI education',
  authors: [{ name: 'Universite' }],
  robots: 'index, follow',
  alternates: {
    canonical: 'https://amplifyapp.com',
  },
  openGraph: {
    title: 'Universite - AI Learning Assistant for Students | Transform Your Learning',
    description: 'Record lectures, get instant transcripts, personalized AI tutoring, and powerful study tools. Join thousands of students using AI to excel in their studies.',
    url: 'https://amplifyapp.com',
    siteName: 'Universite',
    images: [
      {
        url: 'https://amplifyapp.comassets/images/new-logo-white-removebg-preview.png-1-192x192.png',
        width: 192,
        height: 192,
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Universite - AI Learning Assistant for Students',
    description: 'Record lectures, get instant transcripts, and study smarter with AI-powered tools.',
    images: ['https://amplifyapp.comassets/images/new-logo-white-removebg-preview.png-1-192x192.png'],
  },
};

export default function Home() {
  return (
    <div className="bg-white text-slate-900 min-h-screen font-sans">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <img 
                src="/assets/images/new-logo-white-removebg-preview.png-1-192x192.png" 
                alt="Universite logo" 
                className="h-10 w-10 mr-3" 
              />
              <span className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">Universite</span>
            </div>
            <div className="hidden md:flex items-center space-x-8">
              <a href="#features" className="text-slate-600 hover:text-indigo-600 transition-colors font-medium">Features</a>
              <a href="#how-it-works" className="text-slate-600 hover:text-indigo-600 transition-colors font-medium">How It Works</a>
              <a href="#about" className="text-slate-600 hover:text-indigo-600 transition-colors font-medium">About</a>
            </div>
            <div className="flex items-center space-x-4">
              <Link href="/login" className="text-slate-600 hover:text-indigo-600 font-medium transition-colors">Login</Link>
              <Link href="/signup" className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-medium hover:shadow-lg transition-all">Sign Up</Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-purple-50 py-20 md:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="animate-fade-in">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-slate-900 mb-6 leading-tight">
                Transform Your Learning with <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">Universite</span>
              </h1>
              <p className="text-xl text-slate-600 mb-8 leading-relaxed">
                Start free with unlimited transcriptions, then upgrade for unlimited AI-powered study tools when you're ready.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link href="/signup" className="px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold text-lg hover:shadow-xl transition-all transform hover:scale-105 text-center">
                  Get Started Free
                </Link>
                <a href="#how-it-works" className="px-8 py-4 bg-white border-2 border-slate-200 text-slate-700 rounded-xl font-semibold text-lg hover:border-indigo-300 transition-all text-center">
                  Learn More
                </a>
              </div>
              <p className="mt-6 text-sm text-slate-500">Free plan: unlimited transcriptions • Premium $9.99/month: unlimited AI study tools</p>
            </div>
            
            <div className="animate-fade-in animate-float">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-400 to-purple-400 rounded-3xl transform rotate-6 opacity-20"></div>
                <div className="relative bg-white rounded-3xl shadow-2xl p-8 border border-slate-200">
                  <div className="flex items-center mb-4">
                    <div className="w-3 h-3 rounded-full bg-red-500 mr-2"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-500 mr-2"></div>
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                        <img src="/assets/images/icon-white-removebg.png" alt="Universite AI Assistant" className="w-6 h-6" />
                      </div>
                      <div className="bg-slate-100 rounded-2xl rounded-tl-sm p-4 flex-1">
                        <p className="text-slate-700">I can help you understand the key concepts from your lecture on Quantum Mechanics...</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 flex-row-reverse">
                      <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd" />
                        </svg>
                      </div>
                      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-2xl rounded-tr-sm p-4 flex-1">
                        <p>Can you explain the double-slit experiment?</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
