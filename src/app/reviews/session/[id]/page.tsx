import Link from 'next/link';
import {notFound} from 'next/navigation';
import {AppShell} from '@/components/AppShell';
import {requireUser} from '@/server/session';
import {getReview} from '@/features/review/repository';
import {ReviewForm} from '@/features/review/ReviewForms';
export default async function ReviewSession({params}:{params:Promise<{id:string}>}){
  const user=await requireUser(),{id}=await params,review=await getReview(user.id,id);if(!review)notFound();
  const f=review.feedback;
  return <AppShell user={user} active="/reviews"><Link className="text-link" href="/reviews">← 返回到期复习</Link><article className="lesson"><header className="page-heading"><p className="eyebrow">{review.label}</p><h1>{f?'复习结果已保存':'先想一想，再作答。'}</h1><p>{f?'本次回忆和下一次复习时间已经保存。':'用已学题目练习回忆，提交后查看答案与来源。'}</p></header>
    {f?<><section className="card feedback"><span className={`status-badge ${f.correct?'':'warning'}`}>{f.correct?'回忆正确':'需要重学'}</span><h2>{review.question.prompt}</h2><p>你的答案：{f.chosen}</p><p>参考答案：{f.correctAnswer}</p><p>{f.explanation}</p><p className="hint-box">下次复习：{new Date(f.due).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false})}（北京时间）</p><p className="note">本次排期：{({1:'重学',2:'费力回忆',3:'正常回忆',4:'轻松回忆'} as Record<number,string>)[f.rating]}。错答强制重学，不会被自评改为正确。</p><details><summary className="text-link">查看资料来源</summary><ul className="source-list">{f.sources.map(s=><li key={s.url}><a href={s.url} target="_blank" rel="noopener noreferrer">{s.title}</a></li>)}</ul></details></section><Link className="button" href="/reviews" style={{marginTop:24}}>继续到期任务</Link></>:review.paused?<p className="hint-box">本题涉及评分复核，已暂停自动复习。请返回技能页核对来源。</p>:<ReviewForm id={review.id} question={review.question}/>}
    <p className="note">FSRS目标保持率90%为排期参数，尚非实际长期掌握率。重复提交只保留第一次结果；复习不用于考核解锁。</p>
  </article></AppShell>;
}
