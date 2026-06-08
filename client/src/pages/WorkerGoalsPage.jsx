import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Target, Zap, TrendingUp, Plus, Edit2, Check, Loader2, X, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { useGetWorkerGoalsQuery, useSetWorkerGoalMutation, useGetZoneBenchmarkQuery } from '../services/api';

function ProgressRing({ pct, size = 80, stroke = 8, color = '#6366f1' }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (Math.min(pct, 100) / 100) * circ;
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} stroke="#e2e8f0" strokeWidth={stroke} fill="none" />
      <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none"
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" style={{ transition: 'stroke-dasharray 0.4s ease' }} />
    </svg>
  );
}

function GoalCard({ goal, onEdit }) {
  const earned = goal.earnedPaise ?? 0;
  const target = goal.targetPaise ?? 0;
  const pct = target > 0 ? Math.round((earned / target) * 100) : 0;
  const remaining = Math.max(0, target - earned);
  const over = earned > target;
  const color = pct >= 100 ? '#10b981' : pct >= 60 ? '#6366f1' : '#f59e0b';

  return (
    <div className={`bg-white rounded-2xl border p-4 ${pct >= 100 ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200'}`}>
      <div className="flex items-center gap-4">
        <div className="relative flex-shrink-0">
          <ProgressRing pct={pct} color={color} />
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-sm font-bold text-slate-700">{pct}%</p>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-bold text-slate-800 text-sm capitalize">{goal.period} Goal</p>
            {pct >= 100 && <span className="text-[10px] bg-emerald-100 text-emerald-700 font-bold px-2 py-0.5 rounded-full">Achieved!</span>}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            ₹{(earned / 100).toFixed(0)} earned of ₹{(target / 100).toFixed(0)} target
          </p>
          {over ? (
            <p className="text-xs text-emerald-600 font-medium mt-0.5">+₹{(( earned - target) / 100).toFixed(0)} over target!</p>
          ) : (
            <p className="text-xs text-slate-400 mt-0.5">₹{(remaining / 100).toFixed(0)} more to go</p>
          )}
        </div>
        <button onClick={onEdit} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400">
          <Edit2 size={14} />
        </button>
      </div>

      {/* Mini progress bar */}
      <div className="mt-3 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function SetGoalSheet({ period, currentTarget, onClose }) {
  const [val, setVal] = useState(currentTarget ? String(currentTarget / 100) : '');
  const [setGoal, { isLoading }] = useSetWorkerGoalMutation();

  async function submit(e) {
    e.preventDefault();
    const amtPaise = Math.round(parseFloat(val) * 100);
    if (!amtPaise || amtPaise < 100) return toast.error('Set at least ₹1 as goal');
    try {
      await setGoal({ period, targetPaise: amtPaise }).unwrap();
      toast.success(`${period} goal set!`);
      onClose();
    } catch (err) { toast.error(err?.data?.error || 'Failed to set goal'); }
  }

  const PRESETS = period === 'daily' ? [500, 1000, 1500, 2000] : [5000, 10000, 20000, 30000];

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end" onClick={onClose}>
      <div className="bg-white rounded-t-2xl w-full p-5 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-slate-800 capitalize">Set {period} Goal</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100"><X size={16} /></button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div className="flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-2">
            <span className="text-lg font-bold text-slate-400">₹</span>
            <input type="number" min={1} step={1} value={val} onChange={e => setVal(e.target.value)}
              placeholder="0" className="flex-1 text-2xl font-bold text-slate-800 outline-none bg-transparent" />
          </div>
          <div className="flex gap-2">
            {PRESETS.map(p => (
              <button key={p} type="button" onClick={() => setVal(String(p))}
                className="flex-1 text-xs py-1.5 rounded-lg border border-slate-200 text-slate-600 font-medium hover:bg-indigo-50 hover:border-indigo-200">
                ₹{p >= 1000 ? `${p / 1000}K` : p}
              </button>
            ))}
          </div>
          <button type="submit" disabled={isLoading}
            className="w-full py-2.5 rounded-xl bg-indigo-600 text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
            {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Save Goal
          </button>
        </form>
      </div>
    </div>
  );
}

export default function WorkerGoalsPage() {
  const nav = useNavigate();
  const { data, isLoading } = useGetWorkerGoalsQuery();
  const { data: benchmark } = useGetZoneBenchmarkQuery();
  const [editPeriod, setEditPeriod] = useState(null);

  const goals = data?.goals ?? [];
  const dailyGoal = goals.find(g => g.period === 'daily');
  const weeklyGoal = goals.find(g => g.period === 'weekly');

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => nav(-1)} className="p-1.5 rounded-lg hover:bg-slate-100"><ArrowLeft size={18} /></button>
        <h1 className="font-semibold text-slate-800">Earnings Goals</h1>
      </header>

      <div className="p-4 space-y-4">
        {/* Benchmark card */}
        {benchmark && (
          <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-2xl p-4 text-white">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp size={14} className="text-indigo-300" />
              <p className="text-xs text-indigo-200 font-medium">Zone Benchmark</p>
            </div>
            <p className="text-2xl font-bold">Top {Math.round(100 - benchmark.percentile)}%</p>
            <p className="text-xs text-indigo-200 mt-0.5">in your zone · avg ₹{(benchmark.zoneAvgPaise / 100).toFixed(0)}/week</p>
            <div className="mt-3 h-1.5 bg-indigo-500 rounded-full">
              <div className="h-full bg-white rounded-full" style={{ width: `${benchmark.percentile}%` }} />
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-10"><Loader2 size={20} className="animate-spin text-slate-300" /></div>
        ) : (
          <>
            {/* Daily goal */}
            <div>
              <div className="flex items-center justify-between mb-2 px-1">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Daily Goal</p>
                {!dailyGoal && (
                  <button onClick={() => setEditPeriod('daily')} className="text-xs text-indigo-600 flex items-center gap-0.5">
                    <Plus size={11} /> Set Goal
                  </button>
                )}
              </div>
              {dailyGoal ? (
                <GoalCard goal={dailyGoal} onEdit={() => setEditPeriod('daily')} />
              ) : (
                <button onClick={() => setEditPeriod('daily')}
                  className="w-full bg-white rounded-xl border border-dashed border-slate-300 p-8 flex flex-col items-center text-slate-400 gap-2 hover:bg-slate-50">
                  <Target size={24} className="opacity-30" />
                  <p className="text-sm">Set a daily earnings goal</p>
                </button>
              )}
            </div>

            {/* Weekly goal */}
            <div>
              <div className="flex items-center justify-between mb-2 px-1">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Weekly Goal</p>
                {!weeklyGoal && (
                  <button onClick={() => setEditPeriod('weekly')} className="text-xs text-indigo-600 flex items-center gap-0.5">
                    <Plus size={11} /> Set Goal
                  </button>
                )}
              </div>
              {weeklyGoal ? (
                <GoalCard goal={weeklyGoal} onEdit={() => setEditPeriod('weekly')} />
              ) : (
                <button onClick={() => setEditPeriod('weekly')}
                  className="w-full bg-white rounded-xl border border-dashed border-slate-300 p-8 flex flex-col items-center text-slate-400 gap-2 hover:bg-slate-50">
                  <Target size={24} className="opacity-30" />
                  <p className="text-sm">Set a weekly earnings goal</p>
                </button>
              )}
            </div>

            {/* Tip */}
            <button onClick={() => nav('/worker/earnings')} className="w-full bg-amber-50 border border-amber-100 rounded-xl p-3 flex items-center gap-2 text-xs text-amber-700">
              <Zap size={13} className="text-amber-500" />
              <span className="flex-1">View detailed job-by-job breakdown to track progress</span>
              <ChevronRight size={13} />
            </button>
          </>
        )}
      </div>

      {editPeriod && (
        <SetGoalSheet
          period={editPeriod}
          currentTarget={editPeriod === 'daily' ? dailyGoal?.targetPaise : weeklyGoal?.targetPaise}
          onClose={() => setEditPeriod(null)}
        />
      )}
    </div>
  );
}
