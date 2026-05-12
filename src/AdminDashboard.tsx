import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from 'firebase/auth';
import { collection, query, where, getDocs, setDoc, doc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { Quiz } from './types';
import { Plus, Play, Sparkles, BookOpen, Trash, Edit3, Search } from 'lucide-react';
import { motion } from 'motion/react';

export default function AdminDashboard({ user }: { user: User }) {
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState<(Quiz & {id: string})[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchQuizzes();
  }, [user]);

  const fetchQuizzes = async () => {
    try {
      const q = query(collection(db, 'quizzes'), where('adminId', '==', user.uid));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Quiz & {id: string}));
      // Sort by creation desc
      data.sort((a, b) => b.createdAt - a.createdAt);
      setQuizzes(data);
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, 'quizzes');
    } finally {
      setLoading(false);
    }
  };

  const deleteQuiz = async (id: string) => {
    if (!confirm('Are you sure you want to delete this quiz?')) return;
    try {
      await deleteDoc(doc(db, 'quizzes', id));
      setQuizzes(prev => prev.filter(q => q.id !== id));
    } catch (error) {
      console.error(error);
      alert('Failed to delete quiz');
    }
  };

  const startNewSession = async (quiz: Quiz & {id: string}) => {
    try {
      // Generate 6 digit code
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      const sessionRef = doc(db, 'sessions', code);
      await setDoc(sessionRef, {
        adminId: user.uid,
        quizId: quiz.id,
        status: 'waiting',
        currentQuestionIndex: 0,
        questionEndTime: 0,
        createdAt: Date.now()
      });
      navigate(`/admin/session/${code}`);
    } catch (e: any) {
      console.error(e);
      alert("Failed to start session: " + e.message);
    }
  };

  const startLiveMentorSession = async () => {
    try {
      const quizRef = doc(collection(db, 'quizzes'));
      const newQuiz: Quiz = {
        adminId: user.uid,
        title: 'Live Interactive Session',
        subject: 'Mentor Mode',
        timerPerQuestion: 30,
        questions: [],
        createdAt: Date.now()
      };
      await setDoc(quizRef, newQuiz);
      await startNewSession({ ...newQuiz, id: quizRef.id });
    } catch (e: any) {
      console.error(e);
      alert("Failed to start live session: " + e.message);
    }
  };

  if (loading) return <div>Loading quizzes...</div>;

  const filteredQuizzes = quizzes.filter(q => 
    q.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    q.subject.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8 pb-20">
      
      <div className="bg-vibrant-yellow p-8 rounded-[32px] border-[6px] border-vibrant-yellow-dark shadow-[0_8px_0_var(--color-vibrant-yellow-shadow)] flex flex-col md:flex-row items-center justify-between gap-6 transform hover:-translate-y-1 transition-transform">
         <div>
           <h2 className="text-4xl sm:text-5xl font-black text-[#222] drop-shadow-sm flex items-center gap-4">Host a Live Quiz <Sparkles className="hidden sm:block" size={40} /></h2>
           <p className="text-xl font-bold text-[#222]/80 mt-2">No pre-planning needed. Type questions real-time as a mentor!</p>
         </div>
         <button onClick={startLiveMentorSession} className="bg-white text-vibrant-text border-[4px] border-black/10 shadow-[0_6px_0_rgba(0,0,0,0.15)] hover:shadow-[0_8px_0_rgba(0,0,0,0.15)] hover:-translate-y-1 active:translate-y-1 active:shadow-none px-8 py-4 rounded-[24px] font-black text-2xl transition-all whitespace-nowrap">
           Start Live ✨
         </button>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between bg-black/10 p-6 rounded-3xl border border-white/10 shadow-lg gap-4">
        <div>
          <h1 className="text-4xl font-bold drop-shadow-md">Your Drafted Quizzes</h1>
          <p className="text-white/80 mt-1 font-medium">Manage your past templates and start sessions from them.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" size={20} />
            <input 
              type="text" 
              placeholder="Search quizzes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-white/10 border-2 border-white/20 rounded-2xl pl-12 pr-4 px-4 py-3 focus:outline-none focus:border-vibrant-yellow text-white font-bold w-full sm:w-64"
            />
          </div>
          <button 
            onClick={() => navigate('/admin/create')}
            className="flex items-center justify-center gap-2 bg-vibrant-green text-vibrant-text border-[4px] border-vibrant-green-border shadow-[0_4px_0_var(--color-vibrant-green-border)] hover:-translate-y-1 hover:shadow-[0_6px_0_var(--color-vibrant-green-border)] px-6 py-3 rounded-2xl font-bold transition-all active:translate-y-1 active:shadow-none min-w-[160px]"
          >
            <Plus size={20} strokeWidth={3} />
            Create Quiz
          </button>
        </div>
      </div>

      {filteredQuizzes.length === 0 ? (
        <div className="text-center py-20 border-[4px] border-dashed border-white/20 rounded-3xl bg-black/5">
          <p className="text-white/60 mb-4 font-medium text-lg">
            {searchQuery ? `No quizzes found for "${searchQuery}"` : "You haven't created any quizzes yet."}
          </p>
          {!searchQuery && (
            <button 
              onClick={() => navigate('/admin/create')}
              className="text-vibrant-yellow hover:text-white font-bold text-lg underline decoration-2 underline-offset-4"
            >
              Create your first quiz
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredQuizzes.map((quiz) => (
            <motion.div 
              key={quiz.id}
              whileHover={{ y: -6 }}
              className="bg-white text-vibrant-text border-[4px] border-black/10 p-6 rounded-[32px] flex flex-col justify-between items-start shadow-[0_12px_24px_rgba(0,0,0,0.15)] relative group"
            >
              <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={() => navigate(`/admin/create?edit=${quiz.id}`)}
                  className="p-2 hover:bg-black/5 rounded-full transition-colors text-vibrant-blue"
                >
                  <Edit3 size={20} />
                </button>
                <button 
                  onClick={() => deleteQuiz(quiz.id)}
                  className="p-2 hover:bg-black/5 rounded-full transition-colors text-vibrant-pink"
                >
                  <Trash size={20} />
                </button>
              </div>

              <div className="w-full mb-6 pr-10">
                <span className="text-xs font-bold uppercase tracking-widest text-vibrant-pink mb-2 block">{quiz.subject}</span>
                <h3 className="text-2xl font-bold truncate" title={quiz.title}>{quiz.title}</h3>
                <p className="text-sm text-gray-500 mt-2 font-medium">{quiz.questions.length} Flashcards • {quiz.timerPerQuestion}s</p>
              </div>

              <div className="w-full grid grid-cols-1 gap-3">
                <button 
                  onClick={() => startNewSession(quiz)}
                  className="w-full flex items-center justify-center gap-2 bg-vibrant-blue text-white border-[4px] border-vibrant-blue-border rounded-xl py-3 font-black text-lg hover:-translate-y-1 hover:shadow-[0_6px_0_var(--color-vibrant-blue-border)] transition-all active:translate-y-1 active:shadow-none shadow-[0_4px_0_var(--color-vibrant-blue-border)]"
                >
                  <Play size={20} fill="currentColor" />
                  Host Quiz
                </button>
                <button 
                  onClick={() => navigate(`/study/${quiz.id}`)}
                  className="w-full flex items-center justify-center gap-2 bg-vibrant-yellow text-vibrant-text border-[4px] border-vibrant-yellow-dark rounded-xl py-3 font-black text-lg hover:-translate-y-1 hover:shadow-[0_6px_0_var(--color-vibrant-yellow-shadow)] transition-all active:translate-y-1 active:shadow-none shadow-[0_4px_0_var(--color-vibrant-yellow-shadow)]"
                >
                  <BookOpen size={20} />
                  Study Cards
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
