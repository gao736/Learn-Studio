'use client';
import { useActionState,useEffect,useRef,useState } from 'react';
import { useRouter } from 'next/navigation';
import { createCourseAction,generateCourseAction,updateSourcesAction } from './actions';
import { validateGoal,sourceHosts } from './domain';
import type { Goal } from './domain';

export function NewCourseForm({submissionKey,startDate}:{submissionKey:string;startDate:string}) {
  const [state,action,pending] = useActionState(createCourseAction,{error:''});
  const [preview,setPreview] = useState<Goal|null>(null), [error,setError] = useState('');
  const alert = useRef<HTMLDivElement>(null);
  useEffect(()=>{ if (state.error || error) alert.current?.focus(); },[state.error,error]);
  return <form className="goal-form" action={action} onReset={event=>event.preventDefault()} onChange={()=>{setPreview(null);setError('');}} onSubmit={event=>{
    if (!preview) { event.preventDefault();
      const data = new FormData(event.currentTarget);
      try {setPreview(validateGoal(Object.fromEntries(data)));setError('');} catch(e) {setError((e as Error).message);}
    }
  }}>
    {(state.error || error) && <div ref={alert} tabIndex={-1} className="alert" role="alert">{error || state.error}</div>}
    <input type="hidden" name="submission_key" value={submissionKey} />
    <fieldset disabled={pending} className="goal-fields">
      <label htmlFor="topic">想学习什么</label><input id="topic" name="topic" required maxLength={100} placeholder="例如：天文学、Python、历史、AI Agent" list="topic-examples" />
      <datalist id="topic-examples">{['天文学','经济学','Python','英语表达','音乐理论','历史','篮球投篮','国际象棋','AI Agent'].map(topic=><option key={topic} value={topic}/>)}</datalist>
      <label htmlFor="goal">这次想达到的目标（可选）</label><textarea id="goal" name="goal" maxLength={500} rows={3} placeholder="例如：能解释恒星和行星的区别；不填时从入门概念开始" />
      <div className="form-grid"><div><label htmlFor="days">学习天数</label><input id="days" name="days" type="number" min={1} max={365} step={1} required defaultValue={30}/></div><div><label htmlFor="dailyMinutes">每日总时间预算（分钟）</label><input id="dailyMinutes" name="dailyMinutes" type="number" min={5} max={240} step={1} required defaultValue={30}/></div></div>
      <p className="note">这是所有主题合计的时间。已有课程占用的分钟会扣除，剩余不足5分钟时会提示调整。</p>
      <label htmlFor="startDate">开始日期</label><input id="startDate" name="startDate" type="date" defaultValue={startDate} required/>
      <label htmlFor="sourceUrls">公开资料链接（可选，每行一个，最多三个）</label><textarea id="sourceUrls" name="sourceUrls" rows={3} maxLength={3500} placeholder="已知主题可使用预置来源；其他主题请补充可信资料"/>
      <details><summary className="text-link">查看首轮支持的资料网站</summary><p className="note">{sourceHosts.join('、')}。仅支持公开HTTPS文字网页，私有文档上传在后续模块开放。</p></details>
    </fieldset>
    {preview && <section className="hint-box scope-preview" aria-labelledby="scope-heading"><h2 id="scope-heading">确认这次学习范围</h2><p>{preview.topic} · {preview.days}天 · 每日总预算{preview.dailyMinutes}分钟</p><p>{preview.goal}</p><p>从零基础开始。本次生成课程骨架和第一课正文、练习与五道题；后续正文仍是计划骨架。独立考核需另建审核题库，客观练习完成后可进入间隔复习。</p><p className="note">主题、目标和公开资料正文将发送至硅基流动。仅使用已核对的免费文本模型；核价失败会停止生成。未配置密钥时只保存草案。</p>{!preview.sourceUrls.length && <p>此主题暂无预置来源。可以先保存，再补充公开资料。</p>}</section>}
    <button className="button" disabled={pending}>{pending ? '正在保存…' : preview ? '确认范围并保存课程' : '查看学习范围'}</button>
  </form>;
}
export function GenerateControl({courseId,status,serverError,recoverable}:{courseId:string;status:string;serverError:string;recoverable:boolean}) {
  const [state,action,pending] = useActionState(generateCourseAction,{error:''});
  const router = useRouter(); const [pollError,setPollError] = useState('');
  useEffect(()=>{
    if (!['queued','running'].includes(status) || recoverable) return;
    let alive = true, polls=0;
    const timer = setInterval(async ()=>{
      if (++polls > 40) {clearInterval(timer);if(alive){setPollError('任务暂时没有回应，请刷新查看恢复入口。');router.refresh();} return;}
      try {
        const response = await fetch(`/api/courses/${courseId}`,{cache:'no-store',signal:AbortSignal.timeout(5000)});
        if (!response.ok) throw new Error();
        const data = await response.json();
        if (alive && (data.status !== status || data.recoverable)) {clearInterval(timer);router.refresh();}
      } catch {if(alive)setPollError('暂时无法读取进度，请刷新或稍后重试。');}
    },5000);
    return ()=>{alive=false;clearInterval(timer);};
  },[courseId,status,recoverable,router]);
  if (status === 'ready') return null;
  return <div>
    {state.error && state.error !== serverError && <div className="alert course-error" role="alert">{state.error}</div>}
    {pollError && <p className="alert" role="alert">{pollError}</p>}
    {['queued','running'].includes(status) && !recoverable ? <p role="status" className="hint-box">{status === 'queued' ? '任务已保存，等待后台生成。' : '正在读取资料和生成第一课。'}离开页面不会删除任务。</p> : <form action={action}>
      <input type="hidden" name="course_id" value={courseId}/>
      <button className="button" disabled={pending}>{pending ? '正在提交…' : status === 'draft' ? '开始生成第一课' : '重新尝试生成'}</button>
      {recoverable && <p className="note">原任务已超过恢复等待时间；重试会保留原调用记录，不重复发布旧结果。</p>}
    </form>}
  </div>;
}
export function SourceForm({courseId,sourceUrls}:{courseId:string;sourceUrls:string[]}) {
  const [state,action,pending] = useActionState(updateSourcesAction,{error:''});
  return <details className="source-editor"><summary className="text-link">补充或修改资料链接</summary><form action={action} className="goal-form" onReset={e=>e.preventDefault()}>
    <input type="hidden" name="course_id" value={courseId}/><label htmlFor="source-update">公开资料链接</label><textarea id="source-update" name="sourceUrls" rows={3} defaultValue={sourceUrls.join('\n')} maxLength={3500}/>
    <p className="note">支持：{sourceHosts.join('、')}。修改后复用原课程，不占新的课程名额。</p>
    {state.error && <p role="alert" className="alert">{state.error}</p>}{state.success && <p className="alert success" role="status">{state.success}</p>}
    <button className="button secondary" disabled={pending}>{pending ? '正在保存…' : '保存资料链接'}</button>
  </form></details>;
}
