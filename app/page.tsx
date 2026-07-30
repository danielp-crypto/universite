'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

export default function Home() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    // Smooth scrolling for anchor links
    const handleAnchorClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest('a');
      if (anchor) {
        const href = anchor.getAttribute('href');
        if (href && href.startsWith('#')) {
          e.preventDefault();
          const targetEl = document.querySelector(href);
          if (targetEl) {
            targetEl.scrollIntoView({
              behavior: 'smooth',
              block: 'start',
            });
          }
        }
      }
    };

    document.addEventListener('click', handleAnchorClick);
    return () => {
      document.removeEventListener('click', handleAnchorClick);
    };
  }, []);

  return (
    <div className="bg-white text-slate-900 min-h-screen font-sans">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg mr-3">
                <img alt="Universite logo" className="w-6 h-6 md:w-7 md:h-7 object-contain" src="/assets/images/icon-white-removebg.png" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">Universite</span>
            </div>
            <div className="hidden md:flex items-center space-x-8">
              <a href="#features" className="text-slate-600 hover:text-indigo-600 transition-colors font-medium">Features</a>
              <a href="#how-it-works" className="text-slate-600 hover:text-indigo-600 transition-colors font-medium">How It Works</a>
              <a href="#pricing" className="text-slate-600 hover:text-indigo-600 transition-colors font-medium">Pricing</a>
              <a href="#faq" className="text-slate-600 hover:text-indigo-600 transition-colors font-medium">FAQ</a>
              <a href="#about" className="text-slate-600 hover:text-indigo-600 transition-colors font-medium">About</a>
            </div>
            <div className="hidden md:flex items-center space-x-4">
              <Link href="/login" className="text-slate-600 hover:text-indigo-600 font-medium transition-colors">Login</Link>
              <Link href="/signup" className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-medium hover:shadow-lg transition-all">Free Beta</Link>
            </div>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <svg className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>
        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-t border-slate-200 px-4 py-4 space-y-3">
            <a href="#features" className="block text-slate-600 hover:text-indigo-600 transition-colors font-medium py-2" onClick={() => setMobileMenuOpen(false)}>Features</a>
            <a href="#how-it-works" className="block text-slate-600 hover:text-indigo-600 transition-colors font-medium py-2" onClick={() => setMobileMenuOpen(false)}>How It Works</a>
            <a href="#pricing" className="block text-slate-600 hover:text-indigo-600 transition-colors font-medium py-2" onClick={() => setMobileMenuOpen(false)}>Pricing</a>
            <a href="#faq" className="block text-slate-600 hover:text-indigo-600 transition-colors font-medium py-2" onClick={() => setMobileMenuOpen(false)}>FAQ</a>
            <a href="#about" className="block text-slate-600 hover:text-indigo-600 transition-colors font-medium py-2" onClick={() => setMobileMenuOpen(false)}>About</a>
            <div className="pt-3 border-t border-slate-200 space-y-3">
              <Link href="/login" className="block text-slate-600 hover:text-indigo-600 font-medium transition-colors py-2" onClick={() => setMobileMenuOpen(false)}>Login</Link>
              <Link href="/signup" className="block px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-medium hover:shadow-lg transition-all text-center" onClick={() => setMobileMenuOpen(false)}>Free Beta</Link>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-purple-50 py-20 md:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="animate-fade-in">
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-slate-900 mb-6 leading-tight">
                Transform Your Learning with <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">Universite</span>
              </h1>
              <p className="text-lg sm:text-xl text-slate-600 mb-8 leading-relaxed">
                Start free with 4 lectures, then upgrade for unlimited AI-powered study tools.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link href="#pricing" className="px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold text-lg hover:shadow-xl transition-all transform hover:scale-105 text-center">
                  Free Beta
                </Link>
                <a href="#how-it-works" className="px-8 py-4 bg-white border-2 border-slate-200 text-slate-700 rounded-xl font-semibold text-lg hover:border-indigo-300 transition-all text-center">
                  Learn More
                </a>
              </div>
              <p className="mt-6 text-sm text-slate-500">Free Beta : notes + exam questions + memo + AI chat for 4 lectures • Premium: R149/month: unlimited lectures and AI study tools.</p>
            </div>

            <div className="animate-fade-in animate-float order-first md:order-last">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-400 to-purple-400 rounded-3xl transform rotate-6 opacity-20"></div>
                <div className="relative bg-white rounded-3xl shadow-2xl p-4 sm:p-6 md:p-8 border border-slate-200">
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
                        <p className="text-slate-700 text-sm">I can help you understand the key concepts from your lecture on Quantum Mechanics...</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 flex-row-reverse">
                      <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd" />
                        </svg>
                      </div>
                      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-2xl rounded-tr-sm p-4 flex-1">
                        <p className="text-sm">Can you explain the double-slit experiment?</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-16 md:py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 md:mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-900 mb-4">Powerful Features for Your Studies</h2>
            <p className="text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto">Everything you need to excel in your courses</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {/* Feature 1 */}
            <div className="bg-slate-50 rounded-2xl p-6 hover:shadow-xl transition-all transform hover:-translate-y-1">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">Record/Upload Lectures</h3>
              <p className="text-slate-600">Record your lectures or upload audio files. Upload: maximum 90 minutes per audio file.</p>
            </div>

            {/* Feature 2 */}
            <div className="bg-slate-50 rounded-2xl p-6 hover:shadow-xl transition-all transform hover:-translate-y-1">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">AI-Powered Tutoring</h3>
              <p className="text-slate-600">Ask your lectures questions and get instant, personalized explanations tailored to your learning style.</p>
            </div>

            {/* Feature 3 */}
            <div className="bg-slate-50 rounded-2xl p-6 hover:shadow-xl transition-all transform hover:-translate-y-1">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">PDF export</h3>
              <p className="text-slate-600">Download pdf of individual lectures or for the entire module for offline studying. </p>
            </div>

            {/* Feature 4 */}
            <div className="bg-slate-50 rounded-2xl p-6 hover:shadow-xl transition-all transform hover:-translate-y-1">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">Auto-Generated Notes and exam questions + memos ,cheat sheet containing formulas and definitions,</h3>
              <p className="text-slate-600">Get all of these automatically generated from your lectures.</p>
            </div>

            {/* Feature 5 */}
            <div className="bg-slate-50 rounded-2xl p-6 hover:shadow-xl transition-all transform hover:-translate-y-1">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">Self-Test Quiz</h3>
              <p className="text-slate-600">Test your understanding.</p>
            </div>

            {/* Feature 6 */}
            <div className="bg-slate-50 rounded-2xl p-6 hover:shadow-xl transition-all transform hover:-translate-y-1">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">Exam Mode</h3>
              <p className="text-slate-600">Take a mock exam to prepare for the big day.</p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-16 md:py-20 bg-gradient-to-br from-slate-50 to-indigo-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 md:mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-900 mb-4">How It Works</h2>
            <p className="text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto">Get started in minutes and transform your study routine</p>
          </div>
          <div className="grid sm:grid-cols-3 gap-6 md:gap-8 max-w-5xl mx-auto">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-2xl font-bold flex items-center justify-center mx-auto mb-4">1</div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">Record/Upload Your Lecture</h3>
              <p className="text-slate-600">Use our app to record lectures in real-time or upload existing audio files. Works on any device.</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-2xl font-bold flex items-center justify-center mx-auto mb-4">2</div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">Get Instant study assests</h3>
              <p className="text-slate-600">Record/Upload your lectures and get  AI-powered study materials created for you.</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-2xl font-bold flex items-center justify-center mx-auto mb-4">3</div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">Study with AI</h3>
              <p className="text-slate-600">Get 24/7 personalised tutoring for all your difficult modules.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-16 md:py-20 bg-white border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10 md:mb-12">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-900 mb-4">Plans for Every Study Journey</h2>
            <p className="text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto">
              Start with 4 lectures and upgrade for unlimited AI study tools.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 md:gap-8 max-w-4xl mx-auto">
            {/* Free trial */}
            <div className="relative bg-slate-50 rounded-3xl border border-slate-200 p-6 sm:p-8 md:p-10">
              <div className="inline-flex items-center px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold mb-4">
              Limited Beta Access
              </div>
              <h3 className="text-xl sm:text-2xl font-semibold text-slate-900 mb-1">Free Beta</h3>
              <p className="text-sm uppercase tracking-wide text-slate-500 mb-4">No bank card • Perfect for trying Universite</p>
              <p className="text-3xl sm:text-4xl font-bold text-slate-900 mb-6">R0<span className="text-sm sm:text-base font-medium text-slate-500 ml-1">/ for 4 lectures</span></p>
              <ul className="space-y-3 text-slate-700 mb-8 text-sm">
                <li className="flex items-start">
                  <span className="mt-1 mr-2 text-emerald-600">✓</span>
                  <span><strong>Record/Upload up to 4 lectures (lifetime) </strong> - upload up to 60 minutes per lecture </span>
                </li>
                <li className="flex items-start">
                  <span className="mt-1 mr-2 text-emerald-600">✓</span>
                  <span><strong> Mobile & web access</strong> - Any device </span>
                </li>
                
                <li className="flex items-start">
                  <span className="mt-1 mr-2 text-emerald-600">✓</span>
                  <span><strong>AI notes + 10 exam questions per lecture</strong> - Get lecture insights</span>
                </li>
                <li className="flex items-start">
                  <span className="mt-1 mr-2 text-emerald-600">✓</span>
                  <span><strong>AI Chat</strong> - 10 messages per lecture</span>
                </li>
                <li className="flex items-start">
                  <span className="mt-1 mr-2 text-emerald-600">✓</span>
                  <span><strong>No lecture Recordings/Uploads stored</strong> - Deleted post-transcription</span>
                </li>
                <li className="flex items-start">
                  <span className="mt-1 mr-2 text-emerald-600">✓</span>
                  <span><strong> Great for trying the platform</strong></span>
                </li>
                <li className="flex items-start">
                  <span className="mt-1 mr-2 text-slate-400">•</span>
                  <span className="text-slate-400">Priority processing</span>
                </li>
              </ul>
              <Link href="/signup" className="w-full inline-flex justify-center items-center px-4 sm:px-6 py-3 border border-transparent text-sm sm:text-base font-medium rounded-lg text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:shadow-lg transition-all text-center font-semibold">
                Beta
              </Link>
            </div>

            {/* Premium Plan */}
            <div className="relative bg-gradient-to-br from-indigo-600 to-purple-600 rounded-3xl p-6 sm:p-8 md:p-10 text-white">
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                <div className="inline-flex items-center px-3 sm:px-4 py-1 sm:py-2 rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 text-emerald-900 text-xs sm:text-sm font-semibold shadow-lg">
                  🔥 Most Popular
                </div>
              </div>
              <div className="inline-flex items-center px-3 py-1 rounded-full bg-white/20 text-white text-xs font-semibold mb-4">
                Unlimited AI Power
              </div>
              <h3 className="text-xl sm:text-2xl font-semibold text-white mb-1">Premium</h3>
              <p className="text-xs sm:text-sm uppercase tracking-wide text-white/80 mb-4">Perfect for serious students</p>
              <p className="text-3xl sm:text-4xl font-bold text-white mb-2">R149<span className="text-sm sm:text-base font-medium text-white/80 ml-1">Monthly</span></p>
              <p className="text-sm text-white/80 mb-6">Everything you need to pass your modules</p>
              <ul className="space-y-3 text-white/90 mb-8 text-sm">
                <li className="flex items-start">
                  <span className="mt-1 mr-2 text-emerald-400">✓</span>
                  <span><strong>Everything in Beta</strong>, plus...</span>
                </li>
                <li className="flex items-start">
                  <span className="mt-1 mr-2 text-emerald-400">✓</span>
                  <span><strong>Self-Test Quiz</strong> - Quiz yourself</span>
                </li>
                <li className="flex items-start">
                  <span className="mt-1 mr-2 text-emerald-400">✓</span>
                  <span><strong> Unlimited lectures for that module</strong> - record/upload up to 90 minutes per lecture </span>
                </li>
                <li className="flex items-start">
                  <span className="mt-1 mr-2 text-emerald-400">✓</span>
                  <span><strong>AI study assets per lecture</strong> - Unlimited lecture insights</span>
                </li>
                <li className="flex items-start">
                  <span className="mt-1 mr-2 text-emerald-400">✓</span>
                  <span><strong>AI Chat</strong> - Unlimited AI usage for each lecture (fair use) </span>
                </li>
                
                <li className="flex items-start">
                  <span className="mt-1 mr-2 text-emerald-400">✓</span>
                  <span><strong>Early Access</strong> - Access to future premium features</span>
                </li>
                <li className="flex items-start">
                  <span className="mt-1 mr-2 text-emerald-400">✓</span>
                  <span><strong>PDF export</strong> - Export everything to view offline</span>
                </li>
                <li className="flex items-start">
                  <span className="mt-1 mr-2 text-emerald-400">✓</span>
                  <span><strong>No lecture Recordings/Uploads stored</strong> - Deleted post-transcription</span>
                </li>
                <li className="flex items-start">
                  <span className="mt-1 mr-2 text-emerald-400">✓</span>
                  <span><strong>Advanced analytics</strong> - Deep study insights</span>
                </li>
                <li className="flex items-start">
                  <span className="mt-1 mr-2 text-emerald-400">✓</span>
                  <span><strong>Priority processing</strong> - Get help when you need it</span>
                </li>
              </ul>
              <Link href="/signup" className="w-full inline-flex justify-center items-center px-4 sm:px-6 py-3 border border-white/30 text-sm sm:text-base font-medium rounded-lg text-white hover:bg-white/10 transition-all text-center font-semibold">
                Premium
              </Link>
            </div>
          </div>

          <div className="mt-16 text-center">
            <p className="text-slate-600">
              Questions about our plans? <a href="mailto:support@universite.co.za" className="text-indigo-600 hover:text-indigo-700 font-medium">Contact our support team</a>
            </p>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-16 md:py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
            <div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-900 mb-6">About Universite</h2>
              <p className="text-base sm:text-lg text-slate-600 mb-4">
                Universite is the AI study companion built for university and college students.We understand the challenges of keeping up with lectures, understanding complex concepts, and preparing for exams.
              </p>
              <p className="text-base sm:text-lg text-slate-600 mb-4">
                Our mission is to make education more accessible and efficient by leveraging cutting-edge AI technology. With Universite, you can focus on learning rather than worrying about note-taking or finding study materials.
              </p>
              <p className="text-base sm:text-lg text-slate-600">
                Create a Universite account to excel in your studies and achieve your academic goals.
              </p>
            </div>
            <div className="bg-gradient-to-br from-indigo-100 to-purple-100 rounded-3xl p-6 sm:p-8">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-3xl sm:text-4xl font-bold text-indigo-600 mb-2">37.5k</div>
                  <div className="text-slate-600 text-xs md:text-sm">Lecture Transcription mins processed</div>
                </div>
                <div>
                  <div className="text-3xl sm:text-4xl font-bold text-indigo-600 mb-2">1000</div>
                  <div className="text-slate-600 text-xs md:text-sm">Lectures Recorded</div>
                </div>
                <div>
                  <div className="text-3xl sm:text-4xl font-bold text-indigo-600 mb-2">99%</div>
                  <div className="text-slate-600 text-xs md:text-sm">AI Accuracy Rate</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-16 md:py-20 bg-gradient-to-br from-slate-50 to-indigo-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-900 mb-4">Frequently Asked Questions</h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">Everything you need to know about Universite</p>
          </div>

          <div className="space-y-4">
            {[
              {
                question: "What is Universite?",
                answer: "Universite is an AI-powered learning assistant for university students. It helps you record lectures, automatically generates transcripts, notes, exam questions, and provides 24/7 AI tutoring to help you understand difficult concepts."
              },
              {
                question: "How does the free beta work?",
                answer: "The free beta gives you 4 lecture credits to try the platform. You can record or upload up to 4 lectures (max 90 minutes each) and get AI-generated notes, exam questions, and basic AI chat. No credit card required."
              },
              {
                question: "What's included in Premium?",
                answer: "Premium (R149/month) gives you unlimited lectures, self-test mode, advanced AI chat with full context and history, study planning, PDF export, and priority processing. It's designed for serious students who want to maximize their learning."
              },
              {
                question: "Are my lecture recordings stored?",
                answer: "No. For your privacy, audio recordings are deleted immediately after transcription is complete. We only retain the generated transcripts, notes, and study materials in your account until you delete them."
              },
              {
                question: "How long does transcription take?",
                answer: "Transcription typically takes 2-5 minutes for a 60-minute lecture. Premium users get priority processing for faster results."
              },
              {
                question: "Can I use Universite offline?",
                answer: "Premium users can export their lectures, notes, and study materials as PDFs for offline studying. The AI chat and recording features require an internet connection."
              },
              {
                question: "What audio formats are supported?",
                answer: "You can record directly in the app or upload audio files. Supported formats include MP3, WAV, M4A, and other common audio formats. Maximum file size is 90 minutes of audio per lecture."
              },
              {
                question: "How accurate is the transcription?",
                answer: "Our AI transcription achieves 99% accuracy for clear audio recordings. Accuracy may vary with background noise, multiple speakers, or technical terminology."
              },
              {
                question: "Can I cancel my subscription anytime?",
                answer: "Yes, you can cancel your Premium subscription at any time. You'll continue to have access to Premium features until the end of your current billing period."
              },
              {
                question: "Is my data secure?",
                answer: "Absolutely. We use industry-standard encryption (TLS/SSL in transit, AES-256 at rest) and follow strict data protection practices. Your educational content is private and never shared with third parties."
              }
            ].map((faq, index) => (
              <div key={index} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}
                  className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-slate-50 transition-colors"
                >
                  <span className="font-semibold text-slate-900 pr-4">{faq.question}</span>
                  <svg
                    className={`w-5 h-5 text-slate-500 flex-shrink-0 transition-transform ${openFaq === index ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {openFaq === index && (
                  <div className="px-6 pb-4 text-slate-600 leading-relaxed">
                    {faq.answer}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 md:py-20 bg-gradient-to-r from-indigo-600 to-purple-600">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-6">Ready to Transform Your Learning?</h2>
          <p className="text-lg sm:text-xl text-indigo-100 mb-8">Join thousands of students already using Universite to excel in their studies.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/signup" className="px-6 sm:px-8 py-4 bg-white text-indigo-600 rounded-xl font-semibold text-base sm:text-lg hover:shadow-xl transition-all transform hover:scale-105">
              Get Started Free
            </Link>
            <Link href="/login" className="px-6 sm:px-8 py-4 bg-transparent border-2 border-white text-white rounded-xl font-semibold text-base sm:text-lg hover:bg-white/10 transition-all">
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-300 py-10 md:py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-6 md:gap-8 mb-8">
            <div>
              <div className="flex items-center mb-4">
                <img src="/assets/images/icon-white-removebg.png" alt="Universite logo" className="h-8 w-8 mr-2" />
                <span className="text-xl font-bold text-white">Universite</span>
              </div>
              <p className="text-sm text-slate-400">AI-powered learning assistant for university/college students.</p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a></li>
                <li><a href="#about" className="hover:text-white transition-colors">About</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li><Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
                <li><Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Support</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li><Link href="/login" className="hover:text-white transition-colors">Login</Link></li>
                <li><Link href="/signup" className="hover:text-white transition-colors">Free Trial</Link></li>
                <li><a href="mailto:support@universite.co.za" className="hover:text-white transition-colors">Contact Us</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-800 pt-8 text-center text-sm text-slate-500">
            <p>&copy; 2026 Universite. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
