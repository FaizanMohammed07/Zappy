const TrainingModule = require('./training.model');
const Worker = require('./worker.model');

async function listModules(req, res, next) {
  try {
    const modules = await TrainingModule.find({ isActive: true })
      .sort({ order: 1, createdAt: 1 })
      .select('-quiz') // hide answers until opened
      .lean();

    const worker = await Worker.findById(req.auth.sub).select('certifications skills').lean();
    const earnedIds = new Set((worker?.certifications || []).map(c => c.moduleId));

    res.json({
      modules: modules.map(m => ({
        ...m,
        earned: earnedIds.has(String(m._id)),
      })),
    });
  } catch (err) { next(err); }
}

async function getModule(req, res, next) {
  try {
    const mod = await TrainingModule.findById(req.params.id).lean();
    if (!mod || !mod.isActive) return res.status(404).json({ error: 'Module not found' });
    // Return quiz without correct answers
    const safeQuiz = (mod.quiz || []).map(({ question, options }) => ({ question, options }));
    res.json({ module: { ...mod, quiz: safeQuiz } });
  } catch (err) { next(err); }
}

async function submitQuiz(req, res, next) {
  try {
    const mod = await TrainingModule.findById(req.params.id).lean();
    if (!mod || !mod.isActive) return res.status(404).json({ error: 'Module not found' });

    const worker = await Worker.findById(req.auth.sub).select('certifications skills wallet').lean();
    const alreadyEarned = (worker?.certifications || []).some(c => c.moduleId === String(mod._id));
    if (alreadyEarned) return res.status(409).json({ error: 'Already completed this module' });

    const { answers } = req.body; // [0, 2, 1, 3, ...]
    if (!Array.isArray(answers) || answers.length !== mod.quiz.length) {
      return res.status(400).json({ error: 'Answer count does not match quiz questions' });
    }

    const correct = answers.filter((a, i) => a === mod.quiz[i].correct).length;
    const score = mod.quiz.length > 0 ? Math.round((correct / mod.quiz.length) * 100) : 100;
    const passed = score >= mod.passingScore;

    if (!passed) {
      return res.status(400).json({ error: `Score ${score}% — need ${mod.passingScore}% to pass`, score, passed: false });
    }

    // Award certification + unlock service + bonus
    const updates = {
      $push: {
        certifications: { moduleId: String(mod._id), moduleName: mod.title, score, earnedAt: new Date() },
      },
    };
    if (mod.unlockService) {
      updates.$addToSet = { skills: mod.unlockService };
    }
    if (mod.bonusRupees > 0) {
      updates.$inc = { 'wallet.balance': mod.bonusRupees * 100, 'wallet.totalEarnings': mod.bonusRupees * 100 };
    }

    await Worker.updateOne({ _id: req.auth.sub }, updates);

    res.json({
      passed: true,
      score,
      bonusRupees: mod.bonusRupees,
      xpReward: mod.xpReward,
      unlockedService: mod.unlockService,
      message: `Congratulations! You scored ${score}% and earned your ${mod.title} certification.`,
    });
  } catch (err) { next(err); }
}

// Admin CRUD
async function adminListModules(req, res, next) {
  try {
    const modules = await TrainingModule.find().sort({ order: 1 }).lean();
    res.json({ modules });
  } catch (err) { next(err); }
}

async function adminCreateModule(req, res, next) {
  try {
    const mod = await TrainingModule.create(req.body);
    res.status(201).json({ module: mod });
  } catch (err) { next(err); }
}

async function adminUpdateModule(req, res, next) {
  try {
    const mod = await TrainingModule.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
    if (!mod) return res.status(404).json({ error: 'Not found' });
    res.json({ module: mod });
  } catch (err) { next(err); }
}

module.exports = { listModules, getModule, submitQuiz, adminListModules, adminCreateModule, adminUpdateModule };
