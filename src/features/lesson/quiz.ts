const questions = [
  { id: 'q1', prompt: '像太阳这样的恒星，主要依靠什么持续释放能量？', options: ['反射行星的光', '内部的核聚变', '表面的普通燃烧'], correctIndex: 1, explanation: '太阳等主序恒星通过内部核聚变释放能量；普通燃烧不是其持续能量来源。' },
  { id: 'q2', prompt: '太阳属于哪一类天体？', options: ['恒星', '行星', '卫星'], correctIndex: 0, explanation: '太阳是我们最近的一颗恒星，地球等行星围绕太阳运行。' },
  { id: 'q3', prompt: '我们在夜空中看到金星的可见光，主要来自哪里？', options: ['金星上的灯光', '金星内部像太阳一样的核聚变', '金星反射的太阳光'], correctIndex: 2, explanation: '金星是行星，我们看到的明亮可见光主要是它反射的太阳光。' },
  { id: 'q4', prompt: '哪句话能正确区分本课讨论的恒星与行星？', options: ['恒星都比行星看起来大', '恒星可维持氢核聚变，行星不具备这种条件', '恒星不运动，行星才运动'], correctIndex: 1, explanation: '肉眼亮度和视大小受距离影响；恒星与行星都运动。本课用恒星能维持氢核聚变来理解区别。' },
  { id: 'q5', prompt: '围绕地球运行的月球属于哪一类？', options: ['天然卫星', '恒星', '太阳系的一颗行星'], correctIndex: 0, explanation: '月球是地球的天然卫星，月光主要来自反射的太阳光。' },
];
export const publicQuestions = questions.map(({ id, prompt, options }) => ({ id, prompt, options }));
export function gradeAstronomyQuiz(answers: Record<string, unknown>) {
  const feedback = questions.map(question => {
    const raw = answers[question.id];
    if (typeof raw !== 'string' || !/^\d+$/.test(raw)) throw new Error('请完成全部五道题后提交。');
    const selected = Number(raw);
    if (!Number.isSafeInteger(selected) || selected < 0 || selected >= question.options.length) throw new Error('存在无效选项，请重新选择。');
    return {
      id: question.id, prompt: question.prompt, chosen: question.options[selected],
      correct: selected === question.correctIndex, correctAnswer: question.options[question.correctIndex],
      explanation: question.explanation,
    };
  });
  return { score: feedback.filter(item => item.correct).length, total: questions.length, feedback };
}
