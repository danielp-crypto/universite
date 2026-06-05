import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy | Universite',
  description: 'Privacy Policy for Universite - Learn how we protect your data, handle recordings, transcripts, and personal information.',
};

export default function PrivacyPage() {
  return (
    <div className="bg-slate-50 min-h-screen">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Link href="/" className="flex items-center">
                <span className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">Universite</span>
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              <Link href="/" className="text-slate-600 hover:text-indigo-600 font-medium transition-colors">Home</Link>
              <Link href="/login" className="text-slate-600 hover:text-indigo-600 font-medium transition-colors">Login</Link>
              <Link href="/signup" className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-medium hover:shadow-lg transition-all">Sign Up</Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <article className="bg-white rounded-2xl shadow-sm p-8 md:p-12">
          <header className="mb-8">
            <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">Privacy Policy</h1>
            <p className="text-lg text-slate-600 mb-2">Last updated: <time dateTime="2026-03-01">March 1, 2026</time></p>
            <p className="text-slate-600">At Universite, we take your privacy seriously. This policy explains how we collect, use, and protect your personal information.</p>
          </header>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">Introduction</h2>
            <p className="text-slate-700 mb-4 leading-relaxed">Welcome to Universite. We are committed to protecting your privacy and ensuring the security of your personal information. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our AI learning assistant platform.</p>
            <p className="text-slate-700 mb-4 leading-relaxed">By using Universite, you agree to the collection and use of information in accordance with this policy.</p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">Information We Collect</h2>
            <h3 className="text-xl font-semibold text-slate-800 mb-3">Personal Information</h3>
            <ul className="list-disc list-inside text-slate-700 mb-4 space-y-2 ml-4">
              <li><strong>Account Information:</strong> Name, email address, password (encrypted), and profile picture</li>
              <li><strong>Authentication Data:</strong> Information from third-party authentication providers (Google, Apple)</li>
              <li><strong>Academic Information:</strong> University name, course of study, academic level, and preferences</li>
            </ul>
            <h3 className="text-xl font-semibold text-slate-800 mb-3 mt-6">Educational Content</h3>
            <ul className="list-disc list-inside text-slate-700 mb-4 space-y-2 ml-4">
              <li><strong>Audio Recordings:</strong> Lecture recordings and audio files you upload</li>
              <li><strong>Transcripts:</strong> Automatically generated transcripts from your recordings</li>
              <li><strong>Study Materials:</strong> Notes, flashcards, and other content you create</li>
              <li><strong>Chat History:</strong> Conversations with our AI assistant</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">How We Use Your Information</h2>
            <ul className="list-disc list-inside text-slate-700 mb-4 space-y-2 ml-4">
              <li><strong>Service Delivery:</strong> To provide, maintain, and improve our AI learning assistant services</li>
              <li><strong>Personalization:</strong> To personalize your learning experience</li>
              <li><strong>Transcription Services:</strong> To generate accurate transcripts from your audio recordings</li>
              <li><strong>AI Processing:</strong> To process your educational content and provide AI-powered tutoring</li>
              <li><strong>Security:</strong> To detect, prevent, and address technical issues and security threats</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">Data Security</h2>
            <p className="text-slate-700 mb-4 leading-relaxed">We implement industry-standard security measures including encryption in transit (TLS/SSL) and at rest (AES-256), access controls, and regular security audits to protect your information.</p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">Your Rights and Choices</h2>
            <ul className="list-disc list-inside text-slate-700 mb-4 space-y-2 ml-4">
              <li><strong>Access:</strong> Request access to your personal information</li>
              <li><strong>Correction:</strong> Request correction of inaccurate information</li>
              <li><strong>Deletion:</strong> Request deletion of your personal information and account</li>
              <li><strong>Data Portability:</strong> Request a copy of your data in a machine-readable format</li>
            </ul>
            <p className="text-slate-700 mb-4 leading-relaxed">To exercise these rights, contact us at <a href="mailto:privacy@universite.co.za" className="text-indigo-600 hover:underline">privacy@universite.co.za</a>.</p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">Contact Us</h2>
            <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
              <p className="text-slate-700 mb-2"><strong>Email:</strong> <a href="mailto:privacy@universite.co.za" className="text-indigo-600 hover:underline">privacy@universite.co.za</a></p>
              <p className="text-slate-700 mb-2"><strong>Support:</strong> <a href="mailto:support@universite.co.za" className="text-indigo-600 hover:underline">support@universite.co.za</a></p>
            </div>
          </section>

          <div className="mt-12 pt-8 border-t border-slate-200">
            <div className="flex flex-col sm:flex-row gap-4 justify-between">
              <Link href="/" className="text-indigo-600 hover:text-indigo-700 font-medium transition-colors">← Back to Home</Link>
              <Link href="/terms" className="text-indigo-600 hover:text-indigo-700 font-medium transition-colors">Terms of Service →</Link>
            </div>
          </div>
        </article>
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-300 py-12 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8 mb-8">
            <div>
              <span className="text-xl font-bold text-white">Universite</span>
              <p className="text-sm mt-2">AI-powered learning assistant for university students.</p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
                <li><Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Contact</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="mailto:support@universite.co.za" className="hover:text-white transition-colors">support@universite.co.za</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-800 pt-8 text-center text-sm">
            <p>&copy; 2026 Universite. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
