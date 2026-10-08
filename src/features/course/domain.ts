export type Goal = { topic:string; goal:string; days:number; dailyMinutes:number; startDate:string; sourceUrls:string[] };
export type DaySlot = { date:string; month:string; week:number; day:number; focus:string; learn:number; practice:number; review:number };
export type Question = { id:string; prompt:string; options:string[]; correctIndex:number; explanation:string; sourceIds:string[] };
export type Material = { title:string; scope:string; weeklyTopics:string[]; lesson:{ title:string; outcome:string; sections:{heading:string; body:string; sourceIds:string[]}[]; practice:string; questions:Question[] } };
export type Usage = { inputTokens:number; outputTokens:number;reasoningTokens?:number };
export const courseVersion=(course:{provenance:string;active_generation:string|null;content_revision?:number})=>`${course.provenance}:${course.active_generation}${course.content_revision?`:r${course.content_revision}`:''}`;
export const sourceHosts = ['science.nasa.gov','docs.python.org','developer.mozilla.org','openstax.org','ocw.mit.edu','en.wikipedia.org','zh.wikipedia.org','learn.microsoft.com','help.aliyun.com','docs.langchain.com','viva.pressbooks.pub','openmusictheory.github.io','www.fiba.basketball','www.fide.com'];
export const todayInShanghai = () => new Intl.DateTimeFormat('en-CA', { timeZone:'Asia/Shanghai', year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date());
export const validId = (id:string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
function text(value:unknown, label:string, max:number) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error(`${label}缺失或过长。`);
  return value.trim();
}
export function safeSourceURL(value:string) {
  const url = new URL(value);
  if (value.length > 1000 || url.protocol !== 'https:' || url.username || url.password || url.port || !sourceHosts.includes(url.hostname)) {
    throw new Error('资料链接仅支持已列出的可信网站和标准 HTTPS 地址。');
  }
  url.hash = ''; return url.href;
}
export function defaultSources(topic:string):string[] {
  if (/天文|宇宙|astronomy/i.test(topic)) return ['https://science.nasa.gov/universe/stars/'];
  if (/python/i.test(topic)) return ['https://docs.python.org/3/tutorial/introduction.html'];
  if (/javascript|编程/i.test(topic)) return ['https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Scripting/What_is_JavaScript'];
  if (/音乐|乐理/i.test(topic)) return ['https://openmusictheory.github.io/basicNotation.html'];
  if (/经济/i.test(topic)) return ['https://openstax.org/books/principles-economics-3e/pages/1-introduction'];
  if (/ai|人工智能|agent|rag|langgraph/i.test(topic)) return ['https://docs.langchain.com/oss/python/langgraph/overview'];
  return [];
}
export function validateGoal(input:Record<string, unknown>):Goal {
  const topic = text(input.topic, '主题', 100);
  const days = Number(input.days ?? 30), dailyMinutes = Number(input.dailyMinutes ?? 30);
  if (!Number.isInteger(days) || days < 1 || days > 365) throw new Error('学习天数应为1—365的整数。');
  if (!Number.isInteger(dailyMinutes) || dailyMinutes < 5 || dailyMinutes > 240) throw new Error('每日总时间应为5—240分钟的整数。');
  const startDate = String(input.startDate || todayInShanghai());
  const parsed = new Date(`${startDate}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0,10) !== startDate
      || startDate < '2020-01-01' || startDate > '2100-12-31') throw new Error('开始日期无效。');
  const rawUrls = input.sourceUrls;
  if (rawUrls != null && typeof rawUrls !== 'string' && !Array.isArray(rawUrls)) throw new Error('资料链接格式无效。');
  const urls = Array.isArray(rawUrls) ? rawUrls : (rawUrls || '').split(/\r?\n/).filter(Boolean);
  if (urls.length > 3) throw new Error('最多提供三个资料链接。');
  const sourceUrls = [...new Set((urls.length ? urls : defaultSources(topic)).map(url => safeSourceURL(String(url))))];
  return { topic, goal:input.goal ? text(input.goal, '目标', 500) : `理解${topic}的基础概念，并完成第一课独立练习`, days, dailyMinutes, startDate, sourceUrls };
}
export function buildSchedule(goal:Goal, weeklyTopics:string[] = []) : DaySlot[] {
  return Array.from({ length:goal.days }, (_, index) => {
    const date = new Date(`${goal.startDate}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + index);
    const learn = Math.floor(goal.dailyMinutes * .5), practice = Math.floor(goal.dailyMinutes * .3);
    const day = date.toISOString().slice(0,10), week = Math.floor(index / 7) + 1;
    return { date:day, month:day.slice(0,7), day:index+1, week, focus:weeklyTopics[week-1] || `${goal.topic} · 第${week}周（待生成主题）`, learn, practice, review:goal.dailyMinutes-learn-practice };
  });
}
export function validateMaterial(raw:unknown, goal:Goal, sources:string[]) : Material {
  const data = raw as Record<string, any>;
  if (!data || typeof data !== 'object') throw new Error('生成内容格式无效。');
  if (data.sourceInsufficient === true) throw new Error(`资料不足：${text(data.reason, '补充资料说明', 500)}`);
  function citations(ids:unknown) {
    if (!Array.isArray(ids) || !ids.length || ids.length > 3 || ids.some(id => typeof id !== 'string' || !sources.includes(id))) throw new Error('课程引用了未提供的资料。');
    return [...new Set(ids)] as string[];
  }
  if (!Array.isArray(data.weeklyTopics) || data.weeklyTopics.length !== Math.ceil(goal.days / 7)) throw new Error('生成的周计划与学习天数不一致。');
  const lesson = data.lesson;
  if (!lesson || !Array.isArray(lesson.sections) || lesson.sections.length < 1 || lesson.sections.length > 4 || !Array.isArray(lesson.questions) || lesson.questions.length !== 5) throw new Error('第一课需要正文和五道完整练习。');
  const questions:Question[] = lesson.questions.map((q:any, index:number) => {
    if (!q || !Array.isArray(q.options) || q.options.length < 3 || q.options.length > 4 || !Number.isInteger(q.correctIndex) || q.correctIndex < 0 || q.correctIndex >= q.options.length) throw new Error('生成的练习选项或答案无效。');
    const options = q.options.map((option:unknown) => text(option,'选项',300));
    if (new Set(options).size !== options.length) throw new Error('练习选项重复。');
    return { id:`q${index+1}`, prompt:text(q.prompt,'问题',400), options, correctIndex:q.correctIndex, explanation:text(q.explanation,'解释',800), sourceIds:citations(q.sourceIds) };
  });
  if (new Set(questions.map(q => q.prompt)).size !== 5) throw new Error('生成的问题重复，请重新生成。');
  const practice=Array.isArray(lesson.practice)&&lesson.practice.length<=4?lesson.practice.map((step:unknown)=>text(step,'练习步骤',800)).join('\n'):lesson.practice;
  return { title:text(data.title,'课程标题',150), scope:text(data.scope,'课程范围',600), weeklyTopics:data.weeklyTopics.map((v:unknown)=>text(v,'周主题',120)),
    lesson:{ title:text(lesson.title,'首课标题',150), outcome:text(lesson.outcome,'学习目标',300), practice:text(practice,'练习任务',800), questions,
      sections:lesson.sections.map((s:any)=>({heading:text(s?.heading,'章节',100),body:text(s?.body,'正文',1800),sourceIds:citations(s?.sourceIds)})) } };
}
export function gradeLesson(questions:Question[], answers:Record<string,unknown>) {
  const feedback = questions.map(q => {
    const raw = answers[q.id];
    if (typeof raw !== 'string' || !/^\d+$/.test(raw) || Number(raw) >= q.options.length) throw new Error('请完成全部题目并选择有效选项。');
    const selected = Number(raw);
    return { id:q.id, prompt:q.prompt, chosen:q.options[selected], correct:selected === q.correctIndex, correctAnswer:q.options[q.correctIndex], explanation:q.explanation };
  });
  return { score:feedback.filter(q => q.correct).length, total:questions.length, feedback };
}
export function validateUsage(usage:Usage) {
  const reasoning=usage.reasoningTokens??0;
  if(!Number.isInteger(reasoning)||reasoning<0||reasoning>32768||reasoning>usage.outputTokens||!Number.isInteger(usage.inputTokens)||usage.inputTokens<0||usage.inputTokens>60000||!Number.isInteger(usage.outputTokens)||usage.outputTokens<0||usage.outputTokens-reasoning>6000)throw new Error('调用用量无法确认。');
}
export function estimateFen(usage:Usage) {
  validateUsage(usage);
  // Beijing list prices, 2026-10-06: input 0.8 / output 2.7 CNY per million; round up to fen.
  return Math.ceil((usage.inputTokens * 8 + usage.outputTokens * 27) / 100000);
}
