'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';

export default function Home() {
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
              <a href="#pricing" className="text-slate-600 hover:text-indigo-600 transition-colors font-medium">Pricing</a>
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
      <section id="features" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">Powerful Features for Your Studies</h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">Everything you need to excel in your courses</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-slate-50 rounded-2xl p-6 hover:shadow-xl transition-all transform hover:-translate-y-1">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">Record & Transcribe Lectures</h3>
              <p className="text-slate-600">Record your lectures or upload audio files. Get accurate transcripts instantly with AI-powered speech recognition.</p>
            </div>

            {/* Feature 2 */}
            <div className="bg-slate-50 rounded-2xl p-6 hover:shadow-xl transition-all transform hover:-translate-y-1">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">AI-Powered Tutoring</h3>
              <p className="text-slate-600">Ask questions about your lectures and get instant, personalized explanations tailored to your learning style.</p>
            </div>

            {/* Feature 3 */}
            <div className="bg-slate-50 rounded-2xl p-6 hover:shadow-xl transition-all transform hover:-translate-y-1">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">Smart Flashcards</h3>
              <p className="text-slate-600">Automatically generate flashcards from your lecture content. Study key concepts efficiently with spaced repetition.</p>
            </div>

            {/* Feature 4 */}
            <div className="bg-slate-50 rounded-2xl p-6 hover:shadow-xl transition-all transform hover:-translate-y-1">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">Auto-Generated Notes</h3>
              <p className="text-slate-600">Get comprehensive notes automatically generated from your lectures. Organize and search through all your study materials.</p>
            </div>

            {/* Feature 5 */}
            <div className="bg-slate-50 rounded-2xl p-6 hover:shadow-xl transition-all transform hover:-translate-y-1">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">Smart Search</h3>
              <p className="text-slate-600">Search across all your lectures, notes, and transcripts. Find exactly what you're looking for in seconds.</p>
            </div>

            {/* Feature 6 */}
            <div className="bg-slate-50 rounded-2xl p-6 hover:shadow-xl transition-all transform hover:-translate-y-1">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">Progress Tracking</h3>
              <p className="text-slate-600">Monitor your study progress with detailed analytics. See your learning patterns and improve your study habits.</p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-20 bg-gradient-to-br from-slate-50 to-indigo-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">How It Works</h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">Get started in minutes and transform your study routine</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-2xl font-bold flex items-center justify-center mx-auto mb-4">1</div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">Record Your Lecture</h3>
              <p className="text-slate-600">Use our app to record lectures in real-time or upload existing audio files. Works on any device.</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-2xl font-bold flex items-center justify-center mx-auto mb-4">2</div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">Get Instant Transcripts</h3>
              <p className="text-slate-600">Free plan includes unlimited transcriptions. Record as many lectures as you want with AI-powered transcription.</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-2xl font-bold flex items-center justify-center mx-auto mb-4">3</div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">Study with AI</h3>
              <p className="text-slate-600">Try AI study tools for free. Generate flashcards, Q&A, and summaries. Upgrade for unlimited AI-powered learning.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 bg-white border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">Plans for Every Study Journey</h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              Start with unlimited transcriptions and upgrade for unlimited AI study tools.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Free Plan */}
            <div className="relative bg-slate-50 rounded-3xl border border-slate-200 p-8 md:p-10">
              <div className="inline-flex items-center px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold mb-4">
                Most students start here
              </div>
              <h3 className="text-2xl font-semibold text-slate-900 mb-1">Free Plan</h3>
              <p className="text-sm uppercase tracking-wide text-slate-500 mb-4">No credit card • Perfect for trying Universite</p>
              <p className="text-4xl font-bold text-slate-900 mb-6">$0<span className="text-base font-medium text-slate-500 ml-1">/ forever</span></p>
              <ul className="space-y-3 text-slate-700 mb-8 text-sm">
                <li className="flex items-start">
                  <span className="mt-1 mr-2 text-emerald-600">✓</span>
                  <span><strong>Unlimited transcriptions</strong> - Record as many lectures as you want</span>
                </li>
                <li className="flex items-start">
                  <span className="mt-1 mr-2 text-emerald-600">✓</span>
                  <span><strong>10 AI flashcards/month</strong> - Try intelligent study cards</span>
                </li>
                <li className="flex items-start">
                  <span class="mt-1 mr-2 text-emerald-600">✓</span>
                  <span><strong>5 Q&A generations/month</strong> - Ask questions about your lectures</span>
                </li>
                <li className="flex items-start">
                  <span class="mt-1 mr-2 text-emerald-600">✓</span>
                  <span><strong>2 AI summaries/month</strong> - Get lecture insights</span>
                </li>
                <li className="flex items-start">
                  <span class="mt-1 mr-2 text-emerald-600">✓</span>
                  <span><strong>Local storage</strong> - Your data stays on your device</span>
                </li>
                <li className="flex items-start">
                  <span class="mt-1 mr-2 text-slate-400">•</span>
                  <span class="text-slate-400">Unlimited AI features</span>
                </li>
                <li className="flex items-start">
                  <span class="mt-1 mr-2 text-slate-400">•</span>
                  <span class="text-slate-400">Advanced study analytics</span>
                </li>
                <li className="flex items-start">
                  <span class="mt-1 mr-2 text-slate-400">•</span>
                  <span class="text-slate-400">Priority support</span>
                </li>
              </ul>
              <Link href="/signup" className="w-full inline-flex justify-center items-center px-6 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:shadow-lg transition-all text-center font-semibold">
                Get Started Free
              </Link>
            </div>

            {/* Premium Plan */}
            <div className="relative bg-gradient-to-br from-indigo-600 to-purple-600 rounded-3xl p-8 md:p-10 text-white">
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                <div className="inline-flex items-center px-4 py-2 rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 text-emerald-900 text-sm font-semibold shadow-lg">
                  🔥 Most Popular
                </div>
              </div>
              <div className="inline-flex items-center px-3 py-1 rounded-full bg-white/20 text-white text-xs font-semibold mb-4">
                Unlimited AI Power
              </div>
              <h3 className="text-2xl font-semibold text-white mb-1">Premium Plan</h3>
              <p className="text-sm uppercase tracking-wide text-white/80 mb-4">Perfect for serious students</p>
              <p className="text-4xl font-bold text-white mb-2">$9.99<span className="text-base font-medium text-white/80 ml-1">/ month</span></p>
              <p className="text-sm text-white/80 mb-6">Cancel anytime • No setup fees</p>
              <ul className="space-y-3 text-white/90 mb-8 text-sm">
                <li className="flex items-start">
                  <span className="mt-1 mr-2 text-emerald-400">✓</span>
                  <span><strong>Everything in Free</strong>, plus...</span>
                </li>
                <li className="flex items-start">
                  <span className="mt-1 mr-2 text-emerald-400">✓</span>
                  <span><strong>200 AI flashcards/month</strong> - Unlimited study cards</span>
                </li>
                <li className="flex items-start">
                  <span className="mt-1 mr-2 text-emerald-400">✓</span>
                  <span><strong>100 Q&A generations/month</strong> - Unlimited contextual questions</span>
                </li>
                <li className="flex items-start">
                  <span className="mt-1 mr-2 text-emerald-400">✓</span>
                  <span><strong>50 AI summaries/month</strong> - Unlimited lecture insights</span>
                </li>
                <li className="flex items-start">
                  <span className="mt-1 mr-2 text-emerald-400">✓</span>
                  <span><strong>1000 AI requests/month</strong> - Unlimited AI usage</span>
                </li>
                <li className="flex items-start">
                  <span className="mt-1 mr-2 text-emerald-400">✓</span>
                  <span><strong>Advanced analytics</strong> - Deep study insights</span>
                </li>
                <li className="flex items-start">
                  <span className="mt-1 mr-2 text-emerald-400">✓</span>
                  <span><strong>Priority support</strong> - Get help when you need it</span>
                </li>
              </ul>
              <Link href="/signup" className="w-full inline-flex justify-center items-center px-6 py-3 border border-white/30 text-base font-medium rounded-lg text-white hover:bg-white/10 transition-all text-center font-semibold">
                Upgrade to Premium
              </Link>
            </div>
          </div>

          <div className="mt-16 text-center">
            <p className="text-slate-600">
              Questions about our plans? <a href="mailto:support@universite.ai" className="text-indigo-600 hover:text-indigo-700 font-medium">Contact our support team</a>
            </p>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-6">About Universite</h2>
              <p className="text-lg text-slate-600 mb-4">
                Universite is an AI-powered learning platform designed specifically for university/college students. We understand the challenges of keeping up with lectures, understanding complex concepts, and preparing for exams.
              </p>
              <p className="text-lg text-slate-600 mb-4">
                Our mission is to make education more accessible and efficient by leveraging cutting-edge AI technology. With Universite, you can focus on learning rather than worrying about note-taking or finding study materials.
              </p>
              <p className="text-lg text-slate-600">
                Join thousands of students who are already using Universite to excel in their studies and achieve their academic goals.
              </p>
            </div>
            <div className="bg-gradient-to-br from-indigo-100 to-purple-100 rounded-3xl p-8">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-4xl font-bold text-indigo-600 mb-2">37.5k</div>
                  <div className="text-slate-600 text-xs md:text-sm">Lecture Transcription mins processed</div>
                </div>
                <div>
                  <div className="text-4xl font-bold text-indigo-600 mb-2">2500</div>
                  <div className="text-slate-600 text-xs md:text-sm">Lectures Recorded</div>
                </div>
                <div>
                  <div className="text-4xl font-bold text-indigo-600 mb-2">99%</div>
                  <div className="text-slate-600 text-xs md:text-sm">AI Accuracy Rate</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-indigo-600 to-purple-600">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">Ready to Transform Your Learning?</h2>
          <p className="text-xl text-indigo-100 mb-8">Join thousands of students already using Universite to excel in their studies.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/signup" className="px-8 py-4 bg-white text-indigo-600 rounded-xl font-semibold text-lg hover:shadow-xl transition-all transform hover:scale-105">
              Get Started Free
            </Link>
            <Link href="/login" className="px-8 py-4 bg-transparent border-2 border-white text-white rounded-xl font-semibold text-lg hover:bg-white/10 transition-all">
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-300 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
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
                <li><Link href="/signup" className="hover:text-white transition-colors">Sign Up</Link></li>
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
