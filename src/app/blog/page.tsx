'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Clock, TrendingUp, AlertTriangle, FileText } from 'lucide-react';
import { POSTS } from '@/lib/blog';


const CATEGORIES = ['All', 'Investigation', 'Dark Money', 'Insider Trading', 'Trump Trades'];

// ─── Featured post (first / most recent investigation) ───────────────────────
const FEATURED = POSTS[0];
const REST = POSTS.slice(1);

export default function BlogPage() {
  const [activeCategory, setActiveCategory] = useState('All');

  const filtered = activeCategory === 'All'
    ? POSTS
    : POSTS.filter(p => p.category === activeCategory);

  const featured = activeCategory === 'All' ? FEATURED : filtered[0];
  const gridPosts = activeCategory === 'All' ? REST : filtered.slice(1);

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <div className="border-b border-slate-800 bg-gradient-to-b from-slate-900 to-slate-950">
        <div className="max-w-5xl mx-auto px-6 py-16">
          <div className="flex items-center gap-3 mb-6">
            <Link href="/" className="flex items-center gap-1.5 text-slate-500 hover:text-white text-sm transition-colors">
              <ArrowLeft size={14} />
              Back to Tracker
            </Link>
          </div>
          <h1 className="text-4xl font-black text-white mb-3">Investigations</h1>
          <p className="text-slate-400 text-lg max-w-2xl">
            Original reporting and data analysis on federal spending, congressional stock trading, and political money flows. No paywall. No agenda except the truth.
          </p>
        </div>
      </div>

      {/* Featured Investigation */}
      {featured && (
        <div className="border-b border-slate-800 bg-slate-900/40 group">
          <div className="max-w-5xl mx-auto px-6 py-10">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xs font-mono uppercase tracking-widest text-slush-red">
                Featured Investigation
              </span>
            </div>
            <div className="flex flex-col lg:flex-row gap-8 items-start">

              {/* Clickable card body */}
              <Link
                href={`/blog/${featured.slug}`}
                className="flex-1 min-w-0 cursor-pointer"
              >
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                    featured.category === 'Investigation' ? 'bg-emerald-900/60 text-emerald-400' :
                    featured.category === 'Dark Money' ? 'bg-purple-900/60 text-purple-400' :
                    featured.category === 'Insider Trading' ? 'bg-red-900/60 text-red-400' :
                    'bg-blue-900/60 text-blue-400'
                  }`}>
                    {featured.category}
                  </span>
                  <span className="text-slate-600 text-xs">{featured.date}</span>
                  <span className="text-slate-600 text-xs flex items-center gap-1">
                    <Clock size={11} /> {featured.readTime}
                  </span>
                </div>
                <h2 className="text-2xl md:text-3xl font-black text-white leading-tight mb-3 group-hover:text-slush-red transition-colors">
                  {featured.title}
                </h2>
                <p className="text-slate-400 text-base leading-relaxed mb-5 max-w-2xl">
                  {featured.excerpt}
                </p>
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="inline-flex items-center gap-2 bg-slush-red hover:bg-slush-red-dark text-white font-bold px-5 py-2.5 rounded-lg text-sm transition-colors">
                    Read Investigation <ArrowRight size={15} />
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {featured.tags.slice(0, 4).map(tag => (
                      <span key={tag} className="px-2 py-0.5 bg-slate-800 text-slate-500 text-xs rounded">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </Link>

              {/* Stats sidebar */}
              <div className="shrink-0 w-full lg:w-56 grid grid-cols-2 lg:grid-cols-1 gap-3">
                {[
                  { label: 'Published', value: featured.date },
                  { label: 'Read time', value: featured.readTime },
                  { label: 'Category', value: featured.category },
                  { label: 'Author', value: featured.author },
                ].map(stat => (
                  <div key={stat.label} className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-3">
                    <div className="text-slate-500 text-xs mb-0.5">{stat.label}</div>
                    <div className="text-white font-bold text-sm">{stat.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Category filter */}
      <div className="border-b border-slate-800 bg-slate-900/50">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center gap-2 flex-wrap">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  activeCategory === cat
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Posts grid */}
      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="grid gap-6 md:grid-cols-2">
          {gridPosts.map(post => (
            <article
              key={post.slug}
              className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden hover:border-emerald-600/40 transition-all group"
            >
              {/* Category badge */}
              <div className="px-6 pt-6 pb-0">
                <div className="flex items-center gap-2 mb-3">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                    post.category === 'Investigation' ? 'bg-emerald-900/60 text-emerald-400' :
                    post.category === 'Dark Money' ? 'bg-purple-900/60 text-purple-400' :
                    post.category === 'Insider Trading' ? 'bg-red-900/60 text-red-400' :
                    'bg-blue-900/60 text-blue-400'
                  }`}>
                    {post.category}
                  </span>
                  <span className="text-slate-600 text-xs">{post.date}</span>
                </div>
                <h2 className="text-lg font-bold text-white group-hover:text-emerald-400 transition-colors leading-snug mb-2">
                  {post.title}
                </h2>
                <p className="text-slate-400 text-sm leading-relaxed mb-4 line-clamp-3">
                  {post.excerpt}
                </p>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <Clock size={11} />
                    {post.readTime}
                  </span>
                  <span>by {post.author}</span>
                </div>
                <div className="flex items-center gap-1 text-emerald-400 text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                  Read More
                  <TrendingUp size={13} />
                </div>
              </div>

              {/* Tags */}
              <div className="px-6 pb-5 flex flex-wrap gap-1.5">
                {post.tags.map(tag => (
                  <span key={tag} className="px-2 py-0.5 bg-slate-800 text-slate-500 text-xs rounded">
                    {tag}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>

        {/* Empty state */}
        {filtered.length === 0 && (
          <div className="text-center py-20 text-slate-500">
            <FileText size={40} className="mx-auto mb-3 opacity-50" />
            <p>No posts in this category yet.</p>
          </div>
        )}

        {/* API callout */}
        <div className="mt-16 bg-slate-900 border border-slate-700 rounded-xl p-8 text-center">
          <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
          <h3 className="text-white font-bold text-lg mb-2">Want to do your own investigation?</h3>
          <p className="text-slate-400 text-sm mb-5 max-w-lg mx-auto">
            Our public API lets you pull the full dataset. 60 requests/minute, JSON or CSV. Built for journalists, researchers, and data journalists.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <a
              href="/api/v1/trades?limit=5&format=json"
              className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium rounded-lg transition-colors"
              target="_blank"
            >
              View API Docs
            </a>
            <a
              href="/connect"
              className="px-5 py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Submit a Tip
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}