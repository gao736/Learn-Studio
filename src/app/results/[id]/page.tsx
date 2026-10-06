import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/server/session';
import { AppShell } from '@/components/AppShell';
import { getAttempt } from '@/features/lesson/repository';

export default async function Results({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const attempt = await getAttempt(user.id, id);
  if (!attempt) notFound();
  return <AppShell user={user} active="/lesson/astronomy"><div className="topline"><span className="breadcrumb">课堂 / 本次反馈</span><span className="status-badge">结果已保存</span></div><div className="lesson"><p className="eyebrow">YOUR LEARNING RECORD</p><h1>这一小步，已经留下记录。</h1><p className="muted">恒星、行星与卫星 · 本次独立练习</p><p className="result-score">{attempt.score} / {attempt.total}</p><p className="note">{new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Shanghai' }).format(attempt.created_at)} · 课程版本 {attempt.lesson_version}</p><div className="hint-box">{attempt.score === attempt.total ? '本次五道题全部答对。你可以回到课文，用自己的例子再解释一次。' : '下面的解释可以帮你找到需要重新理解的部分。阅读后，试着不用选项复述。'}<br />这里记录本次表现，不把它标为完整能力或长期掌握。</div><section className="lesson-section"><h2>逐题看看为什么</h2>{attempt.feedback.map((item, index) => <div className="result-item" key={item.id}><span className={`result-status${item.correct ? '' : ' incorrect'}`}>{item.correct ? '回答正确' : '需要再理解'}</span><h3>{index + 1}. {item.prompt}</h3><p>你的选择：{item.chosen}</p>{!item.correct && <p>参考答案：{item.correctAnswer}</p>}<p>{item.explanation}</p></div>)}</section><div className="result-actions"><Link className="button" href="/today">回到今天</Link><Link className="button secondary" href="/lesson/astronomy">重新阅读与练习</Link></div><p className="note">重新练习会保存新记录，原有作答不会覆盖。重复熟题本身不构成新的能力验证。</p></div></AppShell>;
}
