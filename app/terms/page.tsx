'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service | Universite - User Agreement & Legal Terms',
  description: 'Terms of Service for Universite - Read our terms and conditions for using the AI learning assistant platform. Understand your rights and responsibilities.',
  keywords: 'terms of service, terms and conditions, user agreement, legal terms, Universite terms, service agreement',
};

export default function TermsPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="bg-slate-50 min-h-screen flex flex-col">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Link href="/" className="flex items-center">
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg mr-3">
                  <img alt="Universite logo" className="w-6 h-6 md:w-7 md:h-7 object-contain" src="/assets/images/icon-white-removebg.png" />
                </div>
                <span className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">Universite</span>
              </Link>
            </div>
            <div className="hidden md:flex items-center space-x-4">
              <Link href="/" className="text-slate-600 hover:text-indigo-600 font-medium transition-colors">Home</Link>
              <Link href="/login" className="text-slate-600 hover:text-indigo-600 font-medium transition-colors">Login</Link>
              <Link href="/signup" className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-medium hover:shadow-lg transition-all">Sign Up</Link>
            </div>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <svg className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="md:hidden py-4 border-t border-slate-200">
              <div className="flex flex-col space-y-3">
                <Link href="/" className="text-slate-600 hover:text-indigo-600 font-medium transition-colors py-2">Home</Link>
                <Link href="/login" className="text-slate-600 hover:text-indigo-600 font-medium transition-colors py-2">Login</Link>
                <Link href="/signup" className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-medium hover:shadow-lg transition-all text-center">Sign Up</Link>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex-1">
        <article className="bg-white rounded-2xl shadow-sm p-8 md:p-12">
          {/* Header */}
          <header className="mb-8">
            <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">Terms of Service</h1>
            <p className="text-lg text-slate-600 mb-2">Last updated: <time dateTime="2026-03-19">January 19, 2026</time></p>
            <p className="text-slate-600">Please read these Terms of Service carefully before using Universite. By accessing or using our services, you agree to be bound by these terms.</p>
          </header>

          {/* Introduction */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">1. Introduction</h2>
            <p className="text-slate-700 mb-4 leading-relaxed">
              Welcome to Universite (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;). These Terms of Service (&quot;Terms&quot;) govern your access to and use of the Universite AI learning assistant platform, including our website, mobile applications, and related services (collectively, the &quot;Service&quot;).
            </p>
            <p className="text-slate-700 mb-4 leading-relaxed">
              By accessing or using the Service, you agree to be bound by these Terms. If you disagree with any part of these Terms, you may not access or use the Service.
            </p>
            <p className="text-slate-700 mb-4 leading-relaxed">
              These Terms constitute a legally binding agreement between you and Universite. Please read them carefully.
            </p>
          </section>

          {/* Acceptance of Terms */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">2. Acceptance of Terms</h2>
            <p className="text-slate-700 mb-4 leading-relaxed">
              By creating an account, accessing, or using the Service, you acknowledge that you have read, understood, and agree to be bound by these Terms and our Privacy Policy, which is incorporated by reference.
            </p>
            <p className="text-slate-700 mb-4 leading-relaxed">
              If you are using the Service on behalf of an organization, you represent and warrant that you have the authority to bind that organization to these Terms, and the terms &quot;you&quot; and &quot;your&quot; will refer to that organization.
            </p>
          </section>

          {/* Eligibility */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">3. Eligibility</h2>
            <p className="text-slate-700 mb-4 leading-relaxed">
              You must be at least 13 years old (or the age of majority in your jurisdiction) to use the Service. By using the Service, you represent and warrant that:
            </p>
            <ul className="list-disc list-inside text-slate-700 mb-4 space-y-2 ml-4">
              <li>You are of legal age to form a binding contract</li>
              <li>You have the right, authority, and capacity to enter into these Terms</li>
              <li>You will comply with all applicable laws and regulations</li>
              <li>All information you provide is accurate, current, and complete</li>
            </ul>
          </section>

          {/* Account Registration */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">4. Account Registration</h2>
            <p className="text-slate-700 mb-4 leading-relaxed">
              To access certain features of the Service, you must register for an account. When you register, you agree to:
            </p>
            <ul className="list-disc list-inside text-slate-700 mb-4 space-y-2 ml-4">
              <li>Provide accurate, current, and complete information</li>
              <li>Maintain and promptly update your account information</li>
              <li>Maintain the security of your password and account</li>
              <li>Accept responsibility for all activities that occur under your account</li>
              <li>Notify us immediately of any unauthorized use of your account</li>
            </ul>
            <p className="text-slate-700 mb-4 leading-relaxed">
              You are responsible for maintaining the confidentiality of your account credentials. We are not liable for any loss or damage arising from your failure to protect your account information.
            </p>
          </section>

          {/* Use of Service */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">5. Use of Service</h2>
            
            <h3 className="text-xl font-semibold text-slate-800 mb-3">5.1 Permitted Use</h3>
            <p className="text-slate-700 mb-4 leading-relaxed">
              You may use the Service for lawful educational and personal purposes in accordance with these Terms. The Service is designed to assist with learning, studying, and educational activities.
            </p>

            <h3 className="text-xl font-semibold text-slate-800 mb-3 mt-6">5.2 Prohibited Activities</h3>
            <p className="text-slate-700 mb-4 leading-relaxed">
              You agree not to:
            </p>
            <ul className="list-disc list-inside text-slate-700 mb-4 space-y-2 ml-4">
              <li>Use the Service for any illegal purpose or in violation of any applicable laws</li>
              <li>Violate or infringe upon the rights of others, including intellectual property rights</li>
              <li>Upload, transmit, or distribute any content that is harmful, offensive, defamatory, or violates any third-party rights</li>
              <li>Attempt to gain unauthorized access to the Service or any related systems or networks</li>
              <li>Use automated systems (bots, scrapers) to access the Service without our express written permission</li>
              <li>Interfere with or disrupt the Service or servers connected to the Service</li>
              <li>Reverse engineer, decompile, or disassemble any part of the Service</li>
              <li>Use the Service to create competing products or services</li>
              <li>Share your account credentials with others or allow unauthorized access to your account</li>
              <li>Use the Service to generate content for academic dishonesty, including plagiarism or cheating on exams</li>
            </ul>
          </section>

          {/* User Content */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">6. User Content</h2>
            
            <h3 className="text-xl font-semibold text-slate-800 mb-3">6.1 Ownership</h3>
            <p className="text-slate-700 mb-4 leading-relaxed">
              You retain ownership of any content you upload, record, or create using the Service (&quot;User Content&quot;), including lecture recordings, notes, and study materials.
            </p>

            <h3 className="text-xl font-semibold text-slate-800 mb-3 mt-6">6.2 License to Universite</h3>
            <p className="text-slate-700 mb-4 leading-relaxed">
              By uploading or creating User Content, you grant Universite a worldwide, non-exclusive, royalty-free license to:
            </p>
            <ul className="list-disc list-inside text-slate-700 mb-4 space-y-2 ml-4">
              <li>Store, process, and transmit your User Content to provide the Service</li>
              <li>Use your User Content to improve our AI models and services (with appropriate anonymization)</li>
              <li>Display and distribute your User Content as necessary to provide the Service</li>
            </ul>

            <h3 className="text-xl font-semibold text-slate-800 mb-3 mt-6">6.3 Content Responsibility</h3>
            <p className="text-slate-700 mb-4 leading-relaxed">
              You are solely responsible for your User Content. You represent and warrant that:
            </p>
            <ul className="list-disc list-inside text-slate-700 mb-4 space-y-2 ml-4">
              <li>You have the right to upload and use the User Content</li>
              <li>Your User Content does not violate any laws or third-party rights</li>
              <li>Your User Content does not contain confidential or proprietary information of others without authorization</li>
            </ul>
          </section>

          {/* AI-Generated Content */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">7. AI-Generated Content</h2>
            <p className="text-slate-700 mb-4 leading-relaxed">
              The Service uses artificial intelligence to generate transcripts, summaries, flashcards, and other educational content. You understand and agree that:
            </p>
            <ul className="list-disc list-inside text-slate-700 mb-4 space-y-2 ml-4">
              <li>AI-generated content may contain errors or inaccuracies</li>
              <li>You should verify AI-generated content before relying on it for important decisions</li>
              <li>AI-generated content is provided &quot;as is&quot; without warranties of any kind</li>
              <li>We are not responsible for any consequences resulting from your use of AI-generated content</li>
            </ul>
          </section>

          {/* Intellectual Property */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">8. Intellectual Property</h2>
            
            <h3 className="text-xl font-semibold text-slate-800 mb-3">8.1 Service Ownership</h3>
            <p className="text-slate-700 mb-4 leading-relaxed">
              The Service, including its design, features, functionality, and content (excluding User Content), is owned by Universite and protected by copyright, trademark, and other intellectual property laws.
            </p>

            <h3 className="text-xl font-semibold text-slate-800 mb-3 mt-6">8.2 Limited License</h3>
            <p className="text-slate-700 mb-4 leading-relaxed">
              Subject to these Terms, we grant you a limited, non-exclusive, non-transferable, revocable license to access and use the Service for your personal, non-commercial educational purposes.
            </p>
          </section>

          {/* Privacy */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">9. Privacy</h2>
            <p className="text-slate-700 mb-4 leading-relaxed">
              Your use of the Service is also governed by our Privacy Policy. Please review our Privacy Policy to understand how we collect, use, and protect your information.
            </p>
            <p className="text-slate-700 mb-4 leading-relaxed">
              By using the Service, you consent to the collection and use of your information as described in our Privacy Policy.
            </p>
          </section>

          {/* Fees and Payment */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">10. Fees and Payment</h2>
            
            <h3 className="text-xl font-semibold text-slate-800 mb-3">10.1 Free and Paid Plans</h3>
            <p className="text-slate-700 mb-4 leading-relaxed">
              We offer both free and paid subscription plans. Features and limitations of each plan are described on our website. We reserve the right to modify our pricing and plans at any time.
            </p>

            <h3 className="text-xl font-semibold text-slate-800 mb-3 mt-6">10.2 Payment Terms</h3>
            <p className="text-slate-700 mb-4 leading-relaxed">
              If you subscribe to a paid plan:
            </p>
            <ul className="list-disc list-inside text-slate-700 mb-4 space-y-2 ml-4">
              <li>You agree to pay all fees associated with your subscription</li>
              <li>Fees are charged in advance on a recurring basis (monthly or annually)</li>
              <li>All fees are non-refundable except as required by law or as explicitly stated</li>
              <li>We may change our fees with 30 days&apos; notice</li>
            </ul>

            <h3 className="text-xl font-semibold text-slate-800 mb-3 mt-6">10.3 Cancellation</h3>
            <p className="text-slate-700 mb-4 leading-relaxed">
              You may cancel your subscription at any time. Cancellation takes effect at the end of your current billing period. You will continue to have access to paid features until the end of your billing period.
            </p>
          </section>

          {/* Termination */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">11. Termination</h2>
            
            <h3 className="text-xl font-semibold text-slate-800 mb-3">11.1 Termination by You</h3>
            <p className="text-slate-700 mb-4 leading-relaxed">
              You may terminate your account at any time by contacting us or using the account deletion feature in your settings.
            </p>

            <h3 className="text-xl font-semibold text-slate-800 mb-3 mt-6">11.2 Termination by Us</h3>
            <p className="text-slate-700 mb-4 leading-relaxed">
              We may suspend or terminate your account immediately if:
            </p>
            <ul className="list-disc list-inside text-slate-700 mb-4 space-y-2 ml-4">
              <li>You violate these Terms</li>
              <li>You engage in fraudulent, illegal, or harmful activities</li>
              <li>We are required to do so by law</li>
              <li>You fail to pay applicable fees (for paid plans)</li>
            </ul>

            <h3 className="text-xl font-semibold text-slate-800 mb-3 mt-6">11.3 Effect of Termination</h3>
            <p className="text-slate-700 mb-4 leading-relaxed">
              Upon termination, your right to use the Service will immediately cease. We may delete your account and User Content, though we may retain certain information as required by law or for legitimate business purposes.
            </p>
          </section>

          {/* Disclaimers */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">12. Disclaimers</h2>
            <p className="text-slate-700 mb-4 leading-relaxed">
              THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
            </p>
            <p className="text-slate-700 mb-4 leading-relaxed">
              We do not warrant that:
            </p>
            <ul className="list-disc list-inside text-slate-700 mb-4 space-y-2 ml-4">
              <li>The Service will be uninterrupted, secure, or error-free</li>
              <li>Any defects or errors will be corrected</li>
              <li>The Service is free of viruses or other harmful components</li>
              <li>AI-generated content is accurate, complete, or reliable</li>
            </ul>
          </section>

          {/* Limitation of Liability */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">13. Limitation of Liability</h2>
            <p className="text-slate-700 mb-4 leading-relaxed">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, UNIVERSITE SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES, WHETHER INCURRED DIRECTLY OR INDIRECTLY, OR ANY LOSS OF DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES.
            </p>
            <p className="text-slate-700 mb-4 leading-relaxed">
              Our total liability for any claims arising from or related to the Service shall not exceed the amount you paid us in the 12 months preceding the claim, or $100, whichever is greater.
            </p>
          </section>

          {/* Indemnification */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">14. Indemnification</h2>
            <p className="text-slate-700 mb-4 leading-relaxed">
              You agree to indemnify, defend, and hold harmless Universite and its officers, directors, employees, and agents from and against any claims, liabilities, damages, losses, and expenses (including reasonable attorneys&apos; fees) arising out of or relating to:
            </p>
            <ul className="list-disc list-inside text-slate-700 mb-4 space-y-2 ml-4">
              <li>Your use of the Service</li>
              <li>Your User Content</li>
              <li>Your violation of these Terms</li>
              <li>Your violation of any rights of another party</li>
            </ul>
          </section>

          {/* Changes to Terms */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">15. Changes to Terms</h2>
            <p className="text-slate-700 mb-4 leading-relaxed">
              We reserve the right to modify these Terms at any time. We will notify you of material changes by:
            </p>
            <ul className="list-disc list-inside text-slate-700 mb-4 space-y-2 ml-4">
              <li>Posting the updated Terms on our website</li>
              <li>Sending an email to the address associated with your account</li>
              <li>Displaying a notice within the Service</li>
            </ul>
            <p className="text-slate-700 mb-4 leading-relaxed">
              Your continued use of the Service after changes become effective constitutes acceptance of the modified Terms. If you do not agree to the modified Terms, you must stop using the Service.
            </p>
          </section>

          {/* Governing Law */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">16. Governing Law</h2>
            <p className="text-slate-700 mb-4 leading-relaxed">
              These Terms shall be governed by and construed in accordance with the laws of South Africa, without regard to its conflict of law provisions. Any disputes arising from these Terms or the Service shall be subject to the exclusive jurisdiction of the courts of South Africa.
            </p>
          </section>

          {/* Contact Information */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">17. Contact Us</h2>
            <p className="text-slate-700 mb-4 leading-relaxed">
              If you have any questions about these Terms, please contact us:
            </p>
            <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
              <p className="text-slate-700 mb-2"><strong>Email:</strong> <a href="mailto:legal@universite.co.za" className="text-indigo-600 hover:underline">legal@universite.co.za</a></p>
              <p className="text-slate-700 mb-2"><strong>Support:</strong> <a href="mailto:support@universite.co.za" className="text-indigo-600 hover:underline">support@universite.co.za</a></p>
            </div>
          </section>

          {/* Navigation */}
          <div className="mt-12 pt-8 border-t border-slate-200">
            <div className="flex flex-col sm:flex-row gap-4 justify-between">
              <Link href="/" className="text-indigo-600 hover:text-indigo-700 font-medium transition-colors">← Back to Home</Link>
              <div className="flex gap-4">
                <Link href="/privacy" className="text-indigo-600 hover:text-indigo-700 font-medium transition-colors">Privacy Policy →</Link>
              </div>
            </div>
          </div>
        </article>
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-300 py-12 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center mb-4">
                <img src="/assets/images/icon-white-removebg.png" alt="Universite logo" className="h-8 w-8 mr-2" />
                <span className="text-xl font-bold text-white">Universite</span>
              </div>
              <p className="text-sm">AI-powered learning assistant for university students.</p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
                <li><Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Support</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/login" className="hover:text-white transition-colors">Login</Link></li>
                <li><Link href="/signup" className="hover:text-white transition-colors">Sign Up</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Contact</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="mailto:support@universite.co.za" className="hover:text-white transition-colors">support@universite.co.za</a></li>
                <li><a href="mailto:legal@universite.co.za" className="hover:text-white transition-colors">legal@universite.co.za</a></li>
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
