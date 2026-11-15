import Link from 'next/link';
import {notFound} from 'next/navigation';
import {AppShell} from '@/components/AppShell';
import {requireUser} from '@/server/session';
import {getStudyPlan} from '@/features/study/repository';
import {weeklyHistory} from '@/features/study/weekly-repository';
import {studyWeek} from '@/features/study/weekly-domain';
import {todayInShanghai} from '@/features/course/domain';
import {WeeklyControl} from '@/features/study/StudyForms';
export default async function WeeklyEntry({params}:{params:Promise<{id:string}>}){
 const user=await requireUser(),{id}=await params,plan=await getStudyPlan(user.id,id);if(!plan)notFound();const history=await weeklyHistory(user.id,id);let week=0;try{week=studyWeek(plan.payload.startDate,todayInShanghai());}catch{}
 return <AppShell user={user} active="/weekly"><Link className="text-link" href={'/study/'+id}>← 返回学习计划</Link><header className="page-heading"><h1>每周回顾与调整</h1><p>本计划第{week||1}周 · 五道新题 · 30分钟内提交</p></header><section className="card"><h2>{week?'检查已学技能的保持情况':'从学习计划第七天开放'}</h2><p>题目来自已通过技能的有来源题库。作答不会增加独立考核通过证据；本周时间使用已有练习预留。</p><p className="note">题目一旦显示即不再用于之后的独立考核。新题不足时会明确提示，现有计划保持原样。</p>{week>0&&<WeeklyControl planId={id}/>}</section><section className="plan-section"><h2>保存的周测</h2>{history.length?history.map(s=><p key={s.id}><Link className="text-link" href={'/weekly/session/'+s.id}>第{s.week}周 · {s.state==='submitted'?'已保存结果':s.state==='expired'?'已过期，记录保留':'继续作答'}</Link></p>):<p className="note">还没有周测记录。</p>}</section></AppShell>;
}
