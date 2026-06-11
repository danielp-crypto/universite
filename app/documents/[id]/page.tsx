'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

function DocumentDetailPageContent() {
  const params = useParams();
  const router = useRouter();
  const documentId = params.id as string;

  const [document, setDocument] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<'summary' | 'questions'>('summary');
  const [summary, setSummary] = useState('');
  const [questions, setQuestions] = useState<any>(null);

  useEffect(() => {
    loadDocument();
  }, [documentId]);

  const loadDocument = () => {
    try {
      const documents = JSON.parse(localStorage.getItem('universite_documents') || '[]');
      const doc = documents.find((d: any) => d.id === documentId);
      if (doc) {
        setDocument(doc);
        if (doc.summary) setSummary(doc.summary);
        if (doc.questions) setQuestions(doc.questions);
      } else {
        router.push('/documents');
      }
    } catch (error) {
      console.error('Error loading document:', error);
      router.push('/documents');
    } finally {
      setLoading(false);
    }
  };

  const handleExtractText = async () => {
    if (!document) return;

    setProcessing(true);
    try {
      const response = await fetch('/api/documents/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: document.id,
          type: document.type,
          content: document.content
        })
      });

      const data = await response.json();
      if (data.success) {
        // Update document with extracted text
        const documents = JSON.parse(localStorage.getItem('universite_documents') || '[]');
        const docIndex = documents.findIndex((d: any) => d.id === documentId);
        if (docIndex !== -1) {
          documents[docIndex].text = data.text;
          localStorage.setItem('universite_documents', JSON.stringify(documents));
          setDocument(documents[docIndex]);
        }
      }
    } catch (error) {
      console.error('Error extracting text:', error);
      alert('Failed to extract text');
    } finally {
      setProcessing(false);
    }
  };

  const handleGenerateSummary = async () => {
    if (!document || !document.text) {
      alert('Please extract text first');
      return;
    }

    setProcessing(true);
    try {
      const response = await fetch('/api/documents/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: document.text })
      });

      const data = await response.json();
      if (data.success) {
        setSummary(data.summary);
        // Update document with summary
        const documents = JSON.parse(localStorage.getItem('universite_documents') || '[]');
        const docIndex = documents.findIndex((d: any) => d.id === documentId);
        if (docIndex !== -1) {
          documents[docIndex].summary = data.summary;
          localStorage.setItem('universite_documents', JSON.stringify(documents));
        }
      }
    } catch (error) {
      console.error('Error generating summary:', error);
      alert('Failed to generate summary');
    } finally {
      setProcessing(false);
    }
  };

  const handleGenerateQuestions = async () => {
    if (!document || !document.text) {
      alert('Please extract text first');
      return;
    }

    setProcessing(true);
    try {
      const response = await fetch('/api/documents/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: document.text })
      });

      const data = await response.json();
      if (data.success) {
        setQuestions(data.questions);
        // Update document with questions
        const documents = JSON.parse(localStorage.getItem('universite_documents') || '[]');
        const docIndex = documents.findIndex((d: any) => d.id === documentId);
        if (docIndex !== -1) {
          documents[docIndex].questions = data.questions;
          localStorage.setItem('universite_documents', JSON.stringify(documents));
        }
      }
    } catch (error) {
      console.error('Error generating questions:', error);
      alert('Failed to generate questions');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 flex items-center justify-center">
        <div className="text-slate-600">Loading...</div>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 flex items-center justify-center">
        <div className="text-slate-600">Document not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="text-xl font-bold text-indigo-600">
              Universite
            </Link>
            <nav className="flex gap-4">
              <Link href="/documents" className="text-indigo-600 text-sm font-semibold">
                Documents
              </Link>
              <Link href="/lectures" className="text-slate-600 hover:text-slate-800 text-sm font-medium">
                Lectures
              </Link>
              <Link href="/flashcards" className="text-slate-600 hover:text-slate-800 text-sm font-medium">
                Flashcards
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Document Info */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-800 mb-2">{document.name}</h1>
              <p className="text-slate-500 text-sm">
                Uploaded {new Date(document.uploadedAt).toLocaleDateString()}
              </p>
            </div>
            <Link
              href="/documents"
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors"
            >
              Back
            </Link>
          </div>

          {/* Action Buttons */}
          <div className="mt-6 flex flex-wrap gap-3">
            {!document.text && (
              <button
                onClick={handleExtractText}
                disabled={processing}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {processing ? 'Processing...' : 'Extract Text'}
              </button>
            )}
            {document.text && !summary && (
              <button
                onClick={handleGenerateSummary}
                disabled={processing}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {processing ? 'Generating...' : 'Generate Summary'}
              </button>
            )}
            {document.text && !questions && (
              <button
                onClick={handleGenerateQuestions}
                disabled={processing}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {processing ? 'Generating...' : 'Generate Questions'}
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200">
          <div className="flex border-b border-slate-200">
            <button
              onClick={() => setActiveTab('summary')}
              className={`px-6 py-3 text-sm font-semibold transition-colors ${
                activeTab === 'summary' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Summary
            </button>
            <button
              onClick={() => setActiveTab('questions')}
              className={`px-6 py-3 text-sm font-semibold transition-colors ${
                activeTab === 'questions' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Questions
            </button>
          </div>

          <div className="p-6">
            {activeTab === 'summary' && (
              <div>
                {summary ? (
                  <div className="prose prose-slate max-w-none">
                    <p className="text-slate-700 whitespace-pre-wrap">{summary}</p>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-slate-500 mb-4">No summary generated yet</p>
                    {document.text ? (
                      <button
                        onClick={handleGenerateSummary}
                        disabled={processing}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-lg text-sm font-medium transition-colors"
                      >
                        {processing ? 'Generating...' : 'Generate Summary'}
                      </button>
                    ) : (
                      <p className="text-slate-400 text-sm">Extract text first to generate summary</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'questions' && (
              <div>
                {questions ? (
                  <div className="space-y-8">
                    {/* Multiple Choice Questions */}
                    {questions.multipleChoice && questions.multipleChoice.length > 0 && (
                      <div>
                        <h3 className="text-lg font-semibold text-slate-800 mb-4">Multiple Choice Questions</h3>
                        <div className="space-y-4">
                          {questions.multipleChoice.map((q: any, idx: number) => (
                            <div key={idx} className="bg-slate-50 rounded-lg p-4">
                              <p className="font-medium text-slate-800 mb-3">{idx + 1}. {q.question}</p>
                              <div className="space-y-2">
                                {q.options.map((opt: string, optIdx: number) => (
                                  <div
                                    key={optIdx}
                                    className={`p-2 rounded ${
                                      opt === q.correctAnswer ? 'bg-green-100 text-green-800' : 'bg-white'
                                    }`}
                                  >
                                    {opt}
                                  </div>
                                ))}
                              </div>
                              {q.explanation && (
                                <p className="mt-3 text-sm text-slate-600 italic">{q.explanation}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Short Answer Questions */}
                    {questions.shortAnswer && questions.shortAnswer.length > 0 && (
                      <div>
                        <h3 className="text-lg font-semibold text-slate-800 mb-4">Short Answer Questions</h3>
                        <div className="space-y-4">
                          {questions.shortAnswer.map((q: any, idx: number) => (
                            <div key={idx} className="bg-slate-50 rounded-lg p-4">
                              <p className="font-medium text-slate-800 mb-2">{idx + 1}. {q.question}</p>
                              <p className="text-sm text-slate-600"><strong>Answer:</strong> {q.answer}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Essay Questions */}
                    {questions.essay && questions.essay.length > 0 && (
                      <div>
                        <h3 className="text-lg font-semibold text-slate-800 mb-4">Essay Questions</h3>
                        <div className="space-y-4">
                          {questions.essay.map((q: any, idx: number) => (
                            <div key={idx} className="bg-slate-50 rounded-lg p-4">
                              <p className="font-medium text-slate-800 mb-2">{idx + 1}. {q.question}</p>
                              <p className="text-sm text-slate-600"><strong>Points to cover:</strong> {q.points}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-slate-500 mb-4">No questions generated yet</p>
                    {document.text ? (
                      <button
                        onClick={handleGenerateQuestions}
                        disabled={processing}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-lg text-sm font-medium transition-colors"
                      >
                        {processing ? 'Generating...' : 'Generate Questions'}
                      </button>
                    ) : (
                      <p className="text-slate-400 text-sm">Extract text first to generate questions</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default function DocumentDetailPage() {
  return <DocumentDetailPageContent />;
}
