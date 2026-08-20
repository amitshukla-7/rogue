'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Plus, 
  Sparkles, 
  TrendingUp, 
  Clock, 
  Flame, 
  MessageSquare, 
  ArrowUp, 
  ArrowDown, 
  Users, 
  ShieldCheck, 
  X,
  MessageCircle,
  BarChart2,
  CheckCircle2,
  Trash2,
  Hash,
  Lock,
  ArrowRight,
  Radio,
  Zap,
  MoreVertical,
  Flag
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { getAvatarUrl } from '../lib/avatar';
import { useUser } from '../components/layout-wrapper';
import { Post, Room } from '@campusconnect/shared';
import FoundingBadge from '../components/founding-badge';
import PostActionMenu from '../components/post-action-menu';

export default function HomePage() {
  const { user } = useUser();

  const [posts, setPosts] = useState<Post[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [selectedSort, setSelectedSort] = useState<'trending' | 'latest' | 'top'>('trending');
  
  // Create Post Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [postTitle, setPostTitle] = useState('');
  const [postContent, setPostContent] = useState('');
  const [isAnonymousPost, setIsAnonymousPost] = useState(false);
  const [submittingPost, setSubmittingPost] = useState(false);

  // Poll state
  const [isPollPost, setIsPollPost] = useState(false);
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
  const [pollDuration, setPollDuration] = useState<'8h' | '24h' | 'always'>('24h');

  // Expanded Post Comments Drawer State
  const [activeCommentPostId, setActiveCommentPostId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  // Comment 3-dot menu state
  const [activeCommentMenu, setActiveCommentMenu] = useState<string | null>(null);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);
  const [commentMenuPos, setCommentMenuPos] = useState<{ top: number; right: number } | null>(null);

  useEffect(() => {
    const loadInitialFeedData = async () => {
      setLoadingPosts(true);
      try {
        const [postsData, roomsData] = await Promise.all([
          apiFetch(`/api/posts?sort=${selectedSort}`).catch(() => null),
          apiFetch('/api/rooms').catch(() => null)
        ]);

        if (postsData && postsData.posts) {
          setPosts(postsData.posts);
        }
        if (Array.isArray(roomsData)) {
          setRooms(roomsData.slice(0, 5));
        }
      } catch (err) {
        console.warn('Feed data API fetch warning:', err);
      } finally {
        setLoadingPosts(false);
      }
    };

    loadInitialFeedData();
  }, [selectedSort]);

  const fetchPosts = async () => {
    try {
      const data = await apiFetch(`/api/posts?sort=${selectedSort}`);
      if (data && data.posts) {
        setPosts(data.posts);
      }
    } catch (err) {
      console.warn('Feed posts API fetch warning:', err);
    }
  };

  const handleVote = async (postId: string, voteType: 'up' | 'down') => {
    if (!user) {
      alert('Please sign in to vote on posts!');
      return;
    }

    // Optimistic UI Update for instant feedback (<5ms)
    setPosts(prev => prev.map(p => {
      if (p.id === postId) {
        const currentVote = p.user_vote;
        let scoreDiff = 0;
        let newVote: 'up' | 'down' | null = voteType;

        if (currentVote === voteType) {
          newVote = null;
          scoreDiff = voteType === 'up' ? -1 : 1;
        } else if (currentVote) {
          scoreDiff = voteType === 'up' ? 2 : -2;
        } else {
          scoreDiff = voteType === 'up' ? 1 : -1;
        }

        return {
          ...p,
          score: Math.max(0, p.score + scoreDiff),
          user_vote: newVote
        };
      }
      return p;
    }));

    try {
      const res = await apiFetch(`/api/posts/${postId}/vote`, {
        method: 'POST',
        body: JSON.stringify({ vote: voteType })
      });
      if (res && res.post) {
        setPosts(prev => prev.map(p => {
          if (p.id === postId) {
            const author = (res.post.author && res.post.author.name && res.post.author.name !== 'Campus Student')
              ? res.post.author
              : (p.author || res.post.author);
            return { ...res.post, author };
          }
          return p;
        }));
      }
    } catch (err: any) {
      fetchPosts();
    }
  };

  const handlePollVote = async (postId: string, optionId: string) => {
    if (!user) {
      alert('Please sign in to vote on polls!');
      return;
    }

    try {
      const res = await apiFetch(`/api/posts/${postId}/poll/vote`, {
        method: 'POST',
        body: JSON.stringify({ option_id: optionId })
      });
      if (res && res.post) {
        setPosts(prev => prev.map(p => p.id === postId ? res.post : p));
      }
    } catch (err: any) {
      alert(err.message || 'Poll vote failed');
    }
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      alert('Please sign in to create a post!');
      return;
    }
    if (!postTitle.trim() || !postContent.trim()) return;

    setSubmittingPost(true);

    let pollPayload = null;
    if (isPollPost) {
      const validOptions = pollOptions.map(o => o.trim()).filter(Boolean);
      if (validOptions.length < 2) {
        alert('Please add at least 2 valid options for your poll.');
        setSubmittingPost(false);
        return;
      }
      pollPayload = {
        question: postTitle.trim(),
        options: validOptions,
        duration: pollDuration
      };
    }

    try {
      const res = await apiFetch('/api/posts', {
        method: 'POST',
        body: JSON.stringify({
          title: postTitle,
          content: postContent,
          topic: 'General',
          is_anonymous: isAnonymousPost,
          poll: pollPayload
        })
      });

      if (res && res.post) {
        setPosts(prev => [res.post, ...prev]);
        setShowCreateModal(false);
        setPostTitle('');
        setPostContent('');
        setIsAnonymousPost(false);
        setIsPollPost(false);
        setPollOptions(['', '']);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to create post');
    } finally {
      setSubmittingPost(false);
    }
  };


  const handleAddComment = async (postId: string, e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      alert('Please sign in to comment!');
      return;
    }
    if (!commentText.trim()) return;

    setSubmittingComment(true);
    try {
      const res = await apiFetch(`/api/posts/${postId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ content: commentText })
      });

      if (res && res.comment) {
        setPosts(prev => prev.map(p => {
          if (p.id === postId) {
            const updatedComments = [...(p.comments || []), res.comment];
            try {
              localStorage.setItem(`comments_${postId}`, JSON.stringify(updatedComments));
            } catch (e) {}
            return {
              ...p,
              comment_count: updatedComments.length,
              comments: updatedComments
            };
          }
          return p;
        }));
        setCommentText('');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to post comment');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (postId: string, commentId: string) => {
    if (!confirm('Delete this comment? This cannot be undone.')) return;
    setDeletingCommentId(commentId);
    setActiveCommentMenu(null);
    try {
      await apiFetch(`/api/posts/${postId}/comments/${commentId}`, { method: 'DELETE' });
      setPosts(prev => prev.map(p => {
        if (p.id !== postId) return p;
        const updated = (p.comments || []).filter((c: any) => c.id !== commentId);
        try {
          localStorage.setItem(`comments_${postId}`, JSON.stringify(updated));
        } catch (e) {}
        return { ...p, comments: updated, comment_count: updated.length };
      }));
    } catch (err: any) {
      alert(err.message || 'Failed to delete comment');
    } finally {
      setDeletingCommentId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#0D0E15] text-white p-4 md:p-6 pb-28">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* MAIN FEED COLUMN (LEFT 8 COLS) */}
        <main className="lg:col-span-8 flex flex-col gap-6">
          
          {/* Top Hero Banner & Post Trigger */}
          <div className="bg-[#151722] border border-[#232635] rounded-3xl p-6 shadow-2xl relative overflow-hidden">
            <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-coral/10 border border-coral/30 text-coral text-[11px] font-mono mb-2">
                  <Sparkles className="w-3.5 h-3.5" /> Campus Feed & Buzz
                </div>
                <h1 className="text-xl md:text-2xl font-bold font-fraunces text-white">What's happening on campus?</h1>
                <p className="text-xs text-text-muted mt-0.5">Share thoughts, ask questions, or announce events.</p>
              </div>

              <button
                onClick={() => setShowCreateModal(true)}
                className="px-5 py-2.5 rounded-2xl bg-coral hover:bg-coral-hover text-white text-xs font-bold shadow-lg shadow-coral/20 flex items-center gap-2 transition-all transform hover:scale-105 cursor-pointer flex-shrink-0"
              >
                <Plus className="w-4 h-4" /> Create Post
              </button>
            </div>
          </div>

          {/* Sort Selector Bar */}
          <div className="flex items-center justify-between bg-[#151722] border border-[#232635] rounded-2xl p-3 shadow-lg">
            <span className="text-xs font-bold text-text-muted uppercase tracking-wider font-mono px-2">Feed Posts</span>
            
            {/* Sort Selector */}
            <div className="flex items-center justify-end bg-[#0F1015] border border-[#232635] rounded-xl p-1 text-xs shrink-0">
              <button
                onClick={() => setSelectedSort('trending')}
                className={`px-3 py-1 rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer ${
                  selectedSort === 'trending' ? 'bg-[#232635] text-coral font-bold' : 'text-text-muted hover:text-white'
                }`}
              >
                <Flame className="w-3.5 h-3.5" /> Trending
              </button>
              <button
                onClick={() => setSelectedSort('latest')}
                className={`px-3 py-1 rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer ${
                  selectedSort === 'latest' ? 'bg-[#232635] text-teal font-bold' : 'text-text-muted hover:text-white'
                }`}
              >
                <Clock className="w-3.5 h-3.5" /> Latest
              </button>
              <button
                onClick={() => setSelectedSort('top')}
                className={`px-3 py-1 rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer ${
                  selectedSort === 'top' ? 'bg-[#232635] text-star font-bold' : 'text-text-muted hover:text-white'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" /> Top
              </button>
            </div>
          </div>

          {/* POSTS FEED LIST */}
          {loadingPosts ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-text-muted">
              <div className="w-8 h-8 rounded-full border-2 border-coral border-t-transparent animate-spin"></div>
              <p className="text-xs font-mono">Loading posts...</p>
            </div>
          ) : posts.length === 0 ? (
            <div className="p-12 text-center bg-[#151722] border border-[#232635] rounded-3xl">
              <Sparkles className="w-10 h-10 text-coral mx-auto mb-3 opacity-50" />
              <h3 className="text-sm font-bold text-white">No posts in this topic yet</h3>
              <p className="text-xs text-text-muted mt-1">Be the first student to start a discussion!</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="mt-4 px-5 py-2 rounded-xl bg-coral text-white text-xs font-bold"
              >
                Create Post
              </button>
            </div>
          ) : (
            posts.map((post) => (
              <div
                key={post.id}
                className="bg-[#151722] border border-[#232635] hover:border-[#2f3346] transition-all rounded-3xl p-5 md:p-6 shadow-xl flex flex-col gap-4 relative group"
              >
                
                {/* Author Info Bar (Links to Instagram Profile if not anonymous) */}
                <div className="flex items-center justify-between border-b border-[#232635]/80 pb-3.5">
                  {post.is_anonymous || post.author.id === 'anonymous' ? (
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#232635] border border-[#232635] flex items-center justify-center text-lg shadow-inner">
                        🕵️
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-white">Anonymous Student</span>
                          <span className="px-2 py-0.5 rounded-full bg-coral/20 border border-coral/40 text-[9px] font-mono text-coral font-bold uppercase tracking-wider">
                            INCOGNITO
                          </span>
                        </div>
                        <span className="text-[11px] text-text-muted font-mono">@anonymous • Identity Protected</span>
                      </div>
                    </div>
                  ) : (
                    <Link
                      href={`/profile/${post.author.id}`}
                      className="flex items-center gap-3 group/author"
                    >
                      <div className="w-10 h-10 rounded-full overflow-hidden border border-[#232635]">
                        <img
                          src={getAvatarUrl(post.author.photos)}
                          alt={post.author.name}
                          className="w-full h-full object-cover rounded-full"
                        />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-white group-hover/author:text-coral transition-colors">
                            {post.author.name}
                          </span>
                          <FoundingBadge badge={post.author.founding_badge} size="sm" />
                          {post.author.is_banned && (
                            <span className="px-2 py-0.5 rounded-full bg-red-500/20 border border-red-500/40 text-[9px] font-mono text-red-400 font-bold uppercase">
                              🚫 BANNED
                            </span>
                          )}
                          {post.author.college_verified && !post.author.is_banned && (
                            <span title="College Verified">
                              <ShieldCheck className="w-3.5 h-3.5 text-teal" />
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-coral font-mono">@{post.author.handle}</span>
                      </div>
                    </Link>
                  )}


                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-text-muted font-mono">
                      {new Date(post.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>

                    {/* 3-DOT ACTION MENU (DELETE, MESSAGE, REPORT, BLOCK) */}
                    <PostActionMenu
                      creatorId={post.author.id}
                      creatorName={post.author.name}
                      creatorHandle={post.author.handle}
                      contentId={post.id}
                      contentType="post"
                      onUserBlocked={(userId) => {
                        setPosts(prev => prev.filter(p => p.author.id !== userId));
                      }}
                      onPostDeleted={(deletedId) => {
                        setPosts(prev => prev.filter(p => p.id !== deletedId));
                      }}
                    />
                  </div>
                </div>

                {/* Post Body */}
                <div className="space-y-2">
                  <h2 className="text-base md:text-lg font-bold text-white leading-snug">{post.title}</h2>
                  <p className="text-xs md:text-sm text-lavender leading-relaxed whitespace-pre-line">{post.content}</p>
                </div>

                {/* Interactive Poll Section if Post Has Poll */}
                {post.poll && post.poll.options && (
                  <div className="mt-2 bg-[#0F1015] border border-[#232635] rounded-2xl p-4 space-y-3 shadow-inner">
                    <div className="flex items-center justify-between border-b border-[#232635] pb-2.5">
                      <div className="flex items-center gap-2 text-xs font-bold text-coral font-mono">
                        <BarChart2 className="w-4 h-4 text-coral animate-pulse" />
                        <span>CAMPUS POLL</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {post.poll.duration !== 'always' && post.poll.expires_at && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-coral/10 border border-coral/20 text-coral font-semibold flex items-center gap-1">
                            <Clock className="w-3 h-3 text-coral" />
                            {(() => {
                              const diff = new Date(post.poll.expires_at).getTime() - Date.now();
                              if (diff <= 0) return 'Expired';
                              const hours = Math.floor(diff / (1000 * 60 * 60));
                              const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                              return hours > 0 ? `${hours}h ${mins}m left` : `${mins}m left`;
                            })()}
                          </span>
                        )}
                        <span className="text-[10px] font-mono text-text-muted">
                          {post.poll.total_votes || 0} {(post.poll.total_votes || 0) === 1 ? 'vote' : 'votes'}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {post.poll.options.map((opt: any) => {
                        const totalVotes = post.poll?.total_votes || 0;
                        const votes = opt.votes || 0;
                        const percentage = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
                        const isVoted = post.poll?.user_voted_option_id === opt.id;

                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => handlePollVote(post.id, opt.id)}
                            className={`w-full relative overflow-hidden rounded-xl border p-3 text-left transition-all cursor-pointer group ${
                              isVoted 
                                ? 'border-coral/70 bg-coral/10 shadow-lg shadow-coral/5' 
                                : 'border-[#232635] bg-[#151722] hover:border-coral/40'
                            }`}
                          >
                            {/* Animated percentage progress bar */}
                            <div
                              className={`absolute top-0 bottom-0 left-0 transition-all duration-500 rounded-xl ${
                                isVoted ? 'bg-coral/30' : 'bg-coral/15'
                              }`}
                              style={{ width: `${percentage}%` }}
                            />

                            <div className="relative z-10 flex items-center justify-between gap-3 text-xs">
                              <div className="flex items-center gap-2 font-medium text-white min-w-0">
                                {isVoted && <CheckCircle2 className="w-4 h-4 text-coral shrink-0" />}
                                <span className={`truncate ${isVoted ? 'font-bold text-coral' : ''}`}>{opt.text}</span>
                              </div>
                              
                              <div className="flex items-center gap-2 shrink-0 font-mono text-[11px]">
                                <span className="text-text-muted font-normal">{votes} {votes === 1 ? 'vote' : 'votes'}</span>
                                <span className={`font-bold ${isVoted ? 'text-coral' : 'text-white'}`}>{percentage}%</span>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Post Footer Action Bar (Upvote / Downvote & Comments) */}
                <div className="flex items-center justify-between pt-2">
                  
                  {/* Vote Counter Pill */}
                  <div className="flex items-center bg-[#0F1015] border border-[#232635] rounded-2xl p-1 gap-1">
                    <button
                      onClick={() => handleVote(post.id, 'up')}
                      className={`p-1.5 rounded-xl hover:bg-[#232635] transition-colors cursor-pointer ${
                        post.user_vote === 'up' ? 'text-coral font-bold' : 'text-text-muted hover:text-white'
                      }`}
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>

                    <span className={`px-2 font-mono text-xs font-bold ${
                      (post.score || 0) > 0 ? 'text-coral' : 'text-white'
                    }`}>
                      {Math.max(0, post.score || 0)}
                    </span>

                    <button
                      onClick={() => handleVote(post.id, 'down')}
                      className={`p-1.5 rounded-xl hover:bg-[#232635] transition-colors cursor-pointer ${
                        post.user_vote === 'down' ? 'text-rose-400 font-bold' : 'text-text-muted hover:text-white'
                      }`}
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>
                  </div>


                  {/* Comment Counter Button */}
                  <button
                    onClick={() => setActiveCommentPostId(activeCommentPostId === post.id ? null : post.id)}
                    className="flex items-center gap-2 px-3.5 py-1.5 rounded-2xl bg-[#0F1015] border border-[#232635] hover:border-teal/50 text-xs font-semibold text-text-muted hover:text-white transition-all cursor-pointer"
                  >
                    <MessageSquare className="w-4 h-4 text-teal" />
                    <span>{post.comment_count} Comments</span>
                  </button>
                </div>

                {/* INLINE EXPANDED COMMENT SECTION */}
                {activeCommentPostId === post.id && (
                  <div className="mt-3 pt-4 border-t border-[#232635] space-y-3 animate-fadeIn">
                    <h4 className="text-xs font-mono uppercase tracking-wider text-text-muted">Comments</h4>
                    
                    {/* Add Comment Input */}
                    <form onSubmit={(e) => handleAddComment(post.id, e)} className="flex gap-2">
                      <input
                        type="text"
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        placeholder="Add a comment to this discussion..."
                        className="flex-1 bg-[#0F1015] border border-[#232635] focus:border-coral rounded-xl px-3.5 py-2 text-xs text-white outline-none"
                      />
                      <button
                        type="submit"
                        disabled={submittingComment || !commentText.trim()}
                        className="px-4 py-2 bg-coral hover:bg-coral-hover text-white text-xs font-bold rounded-xl transition-all disabled:opacity-50 cursor-pointer"
                      >
                        Post
                      </button>
                    </form>

                    {/* Existing Comments */}
                    <div className="space-y-2.5 max-h-60 overflow-y-auto pt-2">
                      {(() => {
                        let localSaved: any[] = [];
                        try {
                          localSaved = JSON.parse(localStorage.getItem(`comments_${post.id}`) || '[]');
                        } catch (e) {}

                        const commentMap = new Map();
                        (post.comments || []).forEach((c: any) => commentMap.set(c.id, c));
                        localSaved.forEach((c: any) => {
                          if (!commentMap.has(c.id)) commentMap.set(c.id, c);
                        });

                        const displayComments = Array.from(commentMap.values()).sort(
                          (a: any, b: any) => new Date(a.created_at || Date.now()).getTime() - new Date(b.created_at || Date.now()).getTime()
                        );

                        return displayComments.length > 0 ? (
                          displayComments.map((comment: any) => {
                            const isCommentAuthor = user?.id === comment.author?.id || user?.id?.toString() === comment.author_id?.toString();
                            const isPostOwner = user?.id === post.author?.id || user?.id?.toString() === (post as any).author_id?.toString();
                            const isAdmin = (user as any)?.is_admin || user?.email === 'amitkumarshukla296@gmail.com';
                            const canDelete = isCommentAuthor || isPostOwner || isAdmin;
                            const isMenuOpen = activeCommentMenu === comment.id;

                            return (
                              <div
                                key={comment.id}
                                className="p-3 rounded-2xl bg-[#0F1015] border border-[#232635] flex items-start gap-2.5"
                              >
                                <img
                                  src={getAvatarUrl(comment.author?.photos)}
                                  alt={comment.author?.name || 'Student'}
                                  className="w-6 h-6 rounded-full object-cover border border-coral flex-shrink-0 mt-0.5"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs font-bold text-white">{comment.author?.name || 'Student'}</span>
                                    <span className="text-[10px] text-coral font-mono">@{comment.author?.handle || 'student'}</span>
                                    {isCommentAuthor && (
                                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-coral/15 text-coral font-mono border border-coral/20">You</span>
                                    )}
                                  </div>
                                  <p className="text-xs text-lavender mt-0.5 break-words">
                                    {deletingCommentId === comment.id ? (
                                      <span className="italic text-text-muted">Deleting...</span>
                                    ) : comment.content}
                                  </p>
                                </div>

                                {/* 3-Dot Menu Button */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (isMenuOpen) {
                                      setActiveCommentMenu(null);
                                      setCommentMenuPos(null);
                                    } else {
                                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                      setCommentMenuPos({
                                        top: rect.bottom + 6,
                                        right: window.innerWidth - rect.right
                                      });
                                      setActiveCommentMenu(comment.id);
                                    }
                                  }}
                                  className="p-1.5 rounded-lg bg-[#202330]/60 hover:bg-[#202330] text-[#8F96A6] hover:text-white transition-colors cursor-pointer shrink-0 mt-0.5"
                                  title="More options"
                                >
                                  <MoreVertical className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            );
                          })
                        ) : (
                          <p className="text-xs text-text-muted italic">No comments yet. Start the conversation!</p>
                        );
                      })()}
                    </div>

                    {/* FIXED-POSITION Comment Dropdown — escapes overflow container */}
                    {activeCommentMenu && commentMenuPos && (() => {
                      const comment = post.comments?.find((c: any) => c.id === activeCommentMenu);
                      if (!comment) return null;
                      const isCommentAuthor = user?.id === comment.author?.id || user?.id?.toString() === comment.author_id?.toString();
                      const isPostOwner = user?.id === post.author?.id || user?.id?.toString() === (post as any).author_id?.toString();
                      const isAdmin = (user as any)?.is_admin || user?.email === 'amitkumarshukla296@gmail.com';
                      const canDelete = isCommentAuthor || isPostOwner || isAdmin;

                      return (
                        <>
                          <div
                            className="fixed inset-0 z-[998]"
                            onClick={() => { setActiveCommentMenu(null); setCommentMenuPos(null); }}
                          />
                          <div
                            onClick={(e) => e.stopPropagation()}
                            style={{ top: commentMenuPos.top, right: commentMenuPos.right }}
                            className="fixed w-48 bg-[#161822] border border-[#2B2F42] rounded-xl shadow-2xl z-[999] py-1 divide-y divide-[#202330] animate-in fade-in duration-150"
                          >
                            {canDelete && (
                              <div className="py-1">
                                <button
                                  onClick={() => {
                                    setActiveCommentMenu(null);
                                    setCommentMenuPos(null);
                                    handleDeleteComment(post.id, comment.id);
                                  }}
                                  disabled={deletingCommentId === comment.id}
                                  className="w-full px-3 py-2 text-left text-xs font-semibold text-rose-500 hover:bg-rose-500/10 flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>{isCommentAuthor ? 'Delete My Comment' : 'Remove from My Post'}</span>
                                </button>
                              </div>
                            )}
                            {!isCommentAuthor && comment.author?.id && comment.author.id !== 'anonymous' && (
                              <div className="py-1">
                                <button
                                  onClick={() => {
                                    setActiveCommentMenu(null);
                                    setCommentMenuPos(null);
                                    window.location.href = `/chat?user=${comment.author.id}&name=${encodeURIComponent(comment.author.name || 'Student')}&handle=${encodeURIComponent(comment.author.handle || '')}`;
                                  }}
                                  className="w-full px-3 py-2 text-left text-xs font-semibold text-white hover:bg-[#202330] flex items-center gap-2 transition-colors cursor-pointer"
                                >
                                  <MessageCircle className="w-3.5 h-3.5 text-teal" />
                                  <span>Message</span>
                                </button>
                              </div>
                            )}
                            {!isCommentAuthor && (
                              <div className="py-1">
                                <button
                                  onClick={() => {
                                    setActiveCommentMenu(null);
                                    setCommentMenuPos(null);
                                    try {
                                      const existing = JSON.parse(localStorage.getItem('admin_reports') || '[]');
                                      existing.unshift({ reported_user_id: comment.author?.id, content_id: comment.id, content_type: 'comment', reason: 'Reported by user', created_at: new Date().toISOString() });
                                      localStorage.setItem('admin_reports', JSON.stringify(existing));
                                    } catch (e) {}
                                    alert('Comment reported to admin.');
                                  }}
                                  className="w-full px-3 py-2 text-left text-xs font-semibold text-amber-400 hover:bg-[#202330] flex items-center gap-2 transition-colors cursor-pointer"
                                >
                                  <Flag className="w-3.5 h-3.5 text-amber-400" />
                                  <span>Report</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}

              </div>
            ))
          )}
        </main>

        {/* SIDEBAR COLUMN: ROOMS & DISCOVERY (RIGHT 4 COLS) */}
        <aside className="lg:col-span-4 flex flex-col gap-6">
          
          {/* FLASH HANGOUTS SIDEBAR WIDGET */}
          <div className="bg-[#151722] border border-coral/30 hover:border-coral/50 transition-all rounded-3xl p-5 shadow-2xl space-y-3 relative overflow-hidden group">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-coral animate-pulse fill-coral" />
                <h3 className="text-sm font-bold text-white font-fraunces">Flash Hangouts</h3>
              </div>
              <span className="text-[10px] font-mono text-coral bg-coral/10 border border-coral/20 px-2 py-0.5 rounded-full font-bold">2H EXPIRING</span>
            </div>
            <p className="text-xs text-text-muted leading-relaxed">
              Looking for a study partner, canteen lunch buddy, or badminton player on campus right now?
            </p>
            <Link
              href="/rooms"
              className="w-full py-2.5 px-3 bg-coral hover:bg-coral-hover text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-md shadow-coral/20 group-hover:scale-[1.02]"
            >
              <Zap className="w-3.5 h-3.5 fill-white" />
              <span>Browse Flash Hangouts</span>
            </Link>
          </div>

          {/* ROOMS SECTION ON HOMEPAGE */}
          <div className="bg-[#151722] border border-[#232635] rounded-3xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#232635] pb-3">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-teal animate-pulse" />
                <h3 className="text-sm font-bold text-white font-fraunces">Active Campus Rooms</h3>
              </div>
              <Link href="/rooms" className="text-xs font-semibold text-coral hover:underline flex items-center gap-1">
                View All <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            <div className="flex flex-col gap-2.5">
              {rooms.map((room) => {
                const roomType = (room.type as string) || '';
                const isSquad = roomType === 'plan' || roomType === 'private' || roomType === 'squad';
                return (
                  <Link
                    key={room.id}
                    href={`/rooms/${room.id}`}
                    className="p-3 rounded-2xl bg-[#0F1015] border border-[#232635] hover:border-coral/50 transition-all flex items-center justify-between group cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${
                        isSquad 
                          ? 'bg-teal/10 border-teal/20 text-teal' 
                          : 'bg-coral/10 border-coral/20 text-coral'
                      }`}>
                        {isSquad ? <Lock className="w-4 h-4" /> : <Hash className="w-4 h-4" />}
                      </div>

                      <div className="min-w-0">
                        <span className="text-xs font-bold text-white group-hover:text-coral transition-colors truncate block">
                          {room.name.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}⚡☕💻🎮🌙🍿🚗]/gu, '').trim()}
                        </span>
                        <span className="text-[10px] text-teal flex items-center gap-1 font-mono mt-0.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-teal animate-pulse"></span>
                          {isSquad ? 'Squad Room' : 'Campus Room'}
                        </span>
                      </div>
                    </div>

                    <span className="text-xs font-bold text-coral group-hover:translate-x-0.5 transition-transform shrink-0 ml-2">
                      Enter →
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>



        </aside>
      </div>

      {/* CREATE POST MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-[#151722] border border-[#232635] rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 relative">
            <div className="flex items-center justify-between border-b border-[#232635] pb-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">Create Post</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-text-muted hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Post Format Selector */}
            <div className="flex items-center bg-[#0F1015] border border-[#232635] rounded-xl p-1 text-xs">
              <button
                type="button"
                onClick={() => setIsPollPost(false)}
                className={`flex-1 py-2 rounded-lg font-bold transition-all cursor-pointer ${
                  !isPollPost ? 'bg-[#232635] text-white shadow-md' : 'text-text-muted hover:text-white'
                }`}
              >
                📝 Standard Post
              </button>
              <button
                type="button"
                onClick={() => setIsPollPost(true)}
                className={`flex-1 py-2 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  isPollPost ? 'bg-coral/20 text-coral border border-coral/40 shadow-md' : 'text-text-muted hover:text-white'
                }`}
              >
                <BarChart2 className="w-3.5 h-3.5" /> Create Poll
              </button>
            </div>

            <form onSubmit={handleCreatePost} className="space-y-4">

              <div>
                <label className="block text-xs font-semibold text-text-muted uppercase mb-1">
                  {isPollPost ? 'Poll Question / Title' : 'Post Title'}
                </label>
                <input
                  type="text"
                  value={postTitle}
                  onChange={(e) => setPostTitle(e.target.value)}
                  placeholder={isPollPost ? 'e.g. Which campus fest event is the best?' : "What's your post about?"}
                  className="w-full bg-[#0F1015] border border-[#232635] focus:border-coral rounded-xl py-2.5 px-3.5 text-xs text-white outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-muted uppercase mb-1">Content / Context</label>
                <textarea
                  value={postContent}
                  onChange={(e) => setPostContent(e.target.value)}
                  rows={isPollPost ? 2 : 4}
                  placeholder={isPollPost ? 'Add context or instructions for voters...' : 'Share details, thoughts, or ask a question...'}
                  className="w-full bg-[#0F1015] border border-[#232635] focus:border-coral rounded-xl py-2.5 px-3.5 text-xs text-white outline-none resize-none"
                  required
                />
              </div>

              {/* POLL OPTIONS CREATOR */}
              {isPollPost && (
                <div className="space-y-3 bg-[#0F1015] border border-[#232635] rounded-2xl p-3.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-coral uppercase font-mono">Poll Options</label>
                    <span className="text-[10px] text-text-muted">Min 2, Max 5 options</span>
                  </div>

                  <div className="space-y-2">
                    {pollOptions.map((option, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={option}
                          onChange={(e) => {
                            const newOpts = [...pollOptions];
                            newOpts[idx] = e.target.value;
                            setPollOptions(newOpts);
                          }}
                          placeholder={`Option ${idx + 1}`}
                          className="flex-1 bg-[#151722] border border-[#232635] focus:border-coral rounded-xl py-2 px-3 text-xs text-white outline-none"
                          required
                        />
                        {pollOptions.length > 2 && (
                          <button
                            type="button"
                            onClick={() => setPollOptions(pollOptions.filter((_, i) => i !== idx))}
                            className="p-1.5 text-rose-400 hover:text-rose-300 rounded-lg hover:bg-rose-500/10 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {pollOptions.length < 5 && (
                    <button
                      type="button"
                      onClick={() => setPollOptions([...pollOptions, ''])}
                      className="w-full mt-1 py-1.5 border border-dashed border-[#232635] hover:border-coral/50 rounded-xl text-xs text-coral font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Option
                    </button>
                  )}

                  {/* Poll Duration Timing Selector */}
                  <div className="pt-2 border-t border-[#232635]">
                    <label className="block text-[11px] font-bold text-coral uppercase mb-1.5 font-mono">Poll Timing / Duration</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: '8h', label: '8 Hours', detail: 'Active for 8h' },
                        { id: '24h', label: '24 Hours', detail: 'Active for 24h' },
                        { id: 'always', label: 'Always', detail: 'Always Active' }
                      ].map((t) => {
                        const isSelected = pollDuration === t.id;
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => setPollDuration(t.id as any)}
                            className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                              isSelected 
                                ? 'bg-coral/20 border-coral text-coral shadow-md' 
                                : 'bg-[#151722] border-[#232635] text-text-muted hover:text-white'
                            }`}
                          >
                            <span>{t.label}</span>
                            <span className="text-[9px] font-mono font-normal opacity-80">{t.detail}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                </div>
              )}

              {/* Anonymous Posting Toggle */}
              <div 
                onClick={() => setIsAnonymousPost(!isAnonymousPost)}
                className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between cursor-pointer select-none ${
                  isAnonymousPost 
                    ? 'bg-coral/10 border-coral/50' 
                    : 'bg-[#0F1015] border-[#232635] hover:border-[#34384b]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">🕵️</span>
                  <div>
                    <span className="text-xs font-bold text-white block">Post Anonymously</span>
                    <span className="text-[10px] text-text-muted">Hide your name, handle, and profile link</span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={isAnonymousPost}
                  onChange={(e) => setIsAnonymousPost(e.target.checked)}
                  className="w-4 h-4 accent-coral cursor-pointer"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>

              <button
                type="submit"
                disabled={submittingPost || !postTitle.trim() || !postContent.trim()}
                className="w-full py-3 bg-coral hover:bg-coral-hover text-white font-bold text-xs rounded-xl shadow-lg shadow-coral/20 transition-all disabled:opacity-50 cursor-pointer"
              >
                {submittingPost 
                  ? 'Publishing...' 
                  : isPollPost 
                  ? (isAnonymousPost ? 'Publish Anonymous Poll 📊' : 'Publish Poll 📊')
                  : (isAnonymousPost ? 'Publish Anonymous Post 🕵️' : 'Publish Post')}
              </button>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
