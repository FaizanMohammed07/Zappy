import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Play, CheckCircle, Lock, Award, ChevronRight, Loader2, X, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useGetTrainingModulesQuery, useGetTrainingModuleQuery, useSubmitTrainingQuizMutation } from '../services/api';

const DIFF_COLOR = { beginner: 'emerald', intermediate: 'amber', advanced: 'red' };
const DIFF_LABEL = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' };

function ModuleCard({ mod, onOpen }) {
  const dc = DIFF_COLOR[mod.difficulty] ?? 'slate';
  const cls = { emerald: 'bg-emerald-100 text-emerald-700', amber: 'bg-amber-100 text-amber-700', red: 'bg-red-100 text-red-700', slate: 'bg-slate-100 text-slate-600' };
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      {mod.thumbnail && <img src={mod.thumbnail} alt="" className="w-full h-28 object-cover rounded-lg mb-3" />}
      <div className="flex items-start gap-2 mb-2">
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cls[dc]}`}>{DIFF_LABEL[mod.difficulty]}</span>
        {mod.xpReward > 0 && <span className="text-[10px] bg-indigo-100 text-indigo-700 font-bold px-2 py-0.5 rounded-full">+{mod.xpReward} XP</span>}
        {mod.bonusRupees > 0 && <span className="text-[10px] bg-emerald-100 text-emerald-700 font-bold px-2 py-0.5 rounded-full">+₹{mod.bonusRupees}</span>}
      </div>
      <p className="font-semibold text-slate-800 text-sm">{mod.title}</p>
      <p className="text-xs text-slate-500 line-clamp-2 mt-0.5">{mod.description}</p>
      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span>🎓 Pass: {mod.passingScore}%</span>
          <span>⏱ {mod.durationMin}min</span>
        </div>
        <button onClick={() => onOpen(mod._id)}
          className="flex items-center gap-1.5 text-xs font-semibold bg-indigo-600 text-white px-3 py-1.5 rounded-lg">
          {mod.certified ? <CheckCircle size={11} /> : <Play size={11} />}
          {mod.certified ? 'Redo' : 'Start'}
        </button>
      </div>
      {mod.certified && (
        <div className="mt-2 flex items-center gap-1 text-xs text-emerald-600">
          <Award size={11} /> Certified — {mod.certScore}% score
        </div>
      )}
    </div>
  );
}

function QuizModal({ moduleId, onClose }) {
  const { data: mod, isLoading } = useGetTrainingModuleQuery(moduleId);
  const [submit, { isLoading: submitting }] = useSubmitTrainingQuizMutation();
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [videoWatched, setVideoWatched] = useState(false);

  function selectAnswer(qi, ai) { setAnswers(p => ({ ...p, [qi]: ai })); }

  async function handleSubmit() {
    const quizAnswers = mod.quiz.map((_, i) => answers[i] ?? -1);
    if (quizAnswers.includes(-1)) return toast.error('Please answer all questions before submitting');
    try {
      const res = await submit({ id: moduleId, answers: quizAnswers }).unwrap();
      setResult(res);
    } catch (err) {
      // Server returns 400 with score data when failed (not passed) — handle gracefully
      const errData = err?.data;
      if (errData?.passed === false) {
        setResult({ passed: false, score: errData.score, passingScore: mod.passingScore });
      } else {
        toast.error(errData?.error || errData?.message || 'Submission failed. Try again.');
      }
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end" onClick={onClose}>
      <div className="bg-white rounded-t-2xl w-full max-h-[95vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
          <h2 className="font-bold text-slate-800 text-sm">{mod?.title ?? 'Training'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100"><X size={16} /></button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 size={20} className="animate-spin text-slate-300" /></div>
        ) : result ? (
          <div className="p-6 text-center space-y-4">
            {result.passed ? (
              <>
                <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
                  <Award size={28} className="text-emerald-600" />
                </div>
                <p className="text-xl font-bold text-slate-800">Certified!</p>
                <p className="text-slate-500 text-sm">You scored <strong>{result.score}%</strong> — above the {mod.passingScore}% passing mark.</p>
                {result.bonusAdded > 0 && <p className="text-emerald-600 font-semibold">+₹{result.bonusAdded / 100} bonus credited to wallet</p>}
                {result.unlockedService && <p className="text-indigo-600 text-sm font-medium">🔓 Unlocked: {result.unlockedService}</p>}
                <button onClick={onClose} className="w-full py-3 bg-emerald-600 text-white rounded-xl font-semibold">Done</button>
              </>
            ) : (
              <>
                <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto">
                  <AlertCircle size={28} className="text-red-400" />
                </div>
                <p className="text-xl font-bold text-slate-800">Not Passed</p>
                <p className="text-slate-500 text-sm">You scored <strong>{result.score}%</strong>. You need {result.passingScore ?? mod?.passingScore}% to pass.</p>
                <p className="text-slate-400 text-xs">Review the training video and try again.</p>
                <button onClick={() => { setResult(null); setAnswers({}); setVideoWatched(false); }} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-semibold">Watch Video & Retry</button>
              </>
            )}
          </div>
        ) : (
          <div className="p-4 space-y-5">
            {/* Video */}
            {mod?.videoUrl && !videoWatched && (
              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Training Video</p>
                <div className="relative bg-black rounded-xl overflow-hidden" style={{ paddingTop: '56.25%' }}>
                  <iframe className="absolute inset-0 w-full h-full" src={mod.videoUrl} allow="accelerometer; autoplay; encrypted-media; gyroscope" allowFullScreen title={mod.title} />
                </div>
                <button onClick={() => setVideoWatched(true)} className="w-full py-2 bg-indigo-50 text-indigo-600 text-sm font-semibold rounded-xl border border-indigo-100">
                  I've watched the video — Take Quiz
                </button>
              </div>
            )}

            {(videoWatched || !mod?.videoUrl) && mod?.quiz?.length > 0 && (
              <div className="space-y-5">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Quiz ({mod.quiz.length} questions)</p>
                {mod.quiz.map((q, qi) => (
                  <div key={qi} className="space-y-2">
                    <p className="text-sm font-semibold text-slate-800">{qi + 1}. {q.question}</p>
                    {q.options.map((opt, ai) => (
                      <button key={ai} onClick={() => selectAnswer(qi, ai)}
                        className={`w-full text-left px-3.5 py-2.5 rounded-xl border text-sm transition ${answers[qi] === ai ? 'border-indigo-400 bg-indigo-50 text-indigo-700 font-medium' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
                        {String.fromCharCode(65 + ai)}. {opt}
                      </button>
                    ))}
                  </div>
                ))}
                <button onClick={handleSubmit} disabled={submitting || Object.keys(answers).length < mod.quiz.length}
                  className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold disabled:opacity-50 flex items-center justify-center gap-2">
                  {submitting ? <Loader2 size={14} className="animate-spin" /> : null} Submit Answers
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function WorkerTrainingPage() {
  const nav = useNavigate();
  const { data, isLoading } = useGetTrainingModulesQuery();
  const [openModule, setOpenModule] = useState(null);
  const [filter, setFilter] = useState('all');

  const modules = data?.modules ?? [];
  const filters = ['all', 'beginner', 'intermediate', 'advanced'];
  const visible = filter === 'all' ? modules : modules.filter(m => m.difficulty === filter);

  const certified = modules.filter(m => m.certified).length;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => nav(-1)} className="p-1.5 rounded-lg hover:bg-slate-100"><ArrowLeft size={18} /></button>
        <h1 className="font-semibold text-slate-800">Training & Certification</h1>
        {certified > 0 && (
          <span className="ml-auto flex items-center gap-1 text-xs font-bold bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full">
            <Award size={10} /> {certified} certified
          </span>
        )}
      </header>

      <div className="p-4 space-y-4">
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 text-xs text-indigo-700 space-y-0.5">
          <p className="font-semibold">Earn certifications to unlock premium services</p>
          <p>Watch the training video, then pass the quiz to get certified and receive bonus credits.</p>
        </div>

        {/* Filters */}
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {filters.map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full border transition capitalize ${filter === f ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-200 text-slate-600 bg-white'}`}>
              {f}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin text-slate-300" /></div>
        ) : visible.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-slate-200 p-10 text-center text-sm text-slate-400">
            No training modules yet
          </div>
        ) : (
          <div className="space-y-3">
            {visible.map(m => <ModuleCard key={m._id} mod={m} onOpen={setOpenModule} />)}
          </div>
        )}
      </div>

      {openModule && <QuizModal moduleId={openModule} onClose={() => setOpenModule(null)} />}
    </div>
  );
}
