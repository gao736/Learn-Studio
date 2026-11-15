'use client';
import {useActionState,useEffect,useRef} from 'react';
import {createStudyAction,startStudyAction,startWeeklyAction,submitWeeklyAction,confirmWeeklyAction,resumeStudyAction} from './actions';
function ErrorMessage({text}:{text:string}){
 const ref=useRef<HTMLDivElement>(null);useEffect(()=>{if(text)ref.current?.focus();},[text]);
 return text?<div className="alert" role="alert" ref={ref} tabIndex={-1}>{text}</div>:null;
}
export function CreateStudyForm({courseKey,startDate}:{courseKey:string;startDate:string}){
 const [state,action,pending]=useActionState(createStudyAction,{error:''});
 return <form action={action}><input type="hidden" name="course_key" value={courseKey}/><ErrorMessage text={state.error}/><fieldset disabled={pending}><label htmlFor="study-start">从哪天开始安排</label><input id="study-start" name="start_date" type="date" required min={startDate} defaultValue={startDate}/></fieldset><p className="note">此步保存学习安排，保留已有课程、成绩与复习排期。</p><button className="button" disabled={pending}>{pending?'正在保存…':'确认并保存学习计划'}</button></form>;
}
export function StartStudyForm({planId,taskId,revision,label='开始学习',disabled=false}:{planId:string;taskId:string;revision:number;label?:string;disabled?:boolean}){
 const [state,action,pending]=useActionState(startStudyAction,{error:''});
 return <form action={action}><input type="hidden" name="plan_id" value={planId}/><input type="hidden" name="task_id" value={taskId}/><input type="hidden" name="revision" value={revision}/><ErrorMessage text={state.error}/><button className="button" disabled={disabled||pending}>{pending?'正在保存…':label}</button></form>;
}

export function WeeklyControl({planId,sessionId,revision}:{planId:string;sessionId?:string;revision?:number}){
 const [state,action,pending]=useActionState(sessionId?confirmWeeklyAction:startWeeklyAction,{error:''});
 return <form action={action}><input type="hidden" name="plan_id" value={planId}/>{sessionId&&<><input type="hidden" name="session_id" value={sessionId}/><input type="hidden" name="revision" value={revision}/></>}<ErrorMessage text={state.error}/><button className="button" disabled={pending}>{pending?'正在保存…':sessionId?'确认调整后续安排':'开始或继续本周测验'}</button></form>;
}
export function WeeklyQuiz({id,questions}:{id:string;questions:{id:string;prompt:string;options:string[]}[]}){
 const [state,action,pending]=useActionState(submitWeeklyAction,{error:''});
 return <form className="assessment-form" action={action} onReset={e=>e.preventDefault()}><input type="hidden" name="session_id" value={id}/>{questions.map((q,i)=><fieldset className="question card" disabled={pending} key={q.id}><legend>{i+1}. {q.prompt}</legend>{q.options.map((v,index)=><label className="option" key={index}><input type="radio" name={q.id} value={index} required/><span>{v}</span></label>)}</fieldset>)}<ErrorMessage text={state.error}/><button className="button" disabled={pending}>{pending?'正在保存…':'提交并保存周测'}</button></form>;
}
export function ResumeStudyForm({planId,revision,today}:{planId:string;revision:number;today:string}){
 const [state,action,pending]=useActionState(resumeStudyAction,{error:'',saved:false});
 return <form className="goal-form" action={action} onReset={e=>e.preventDefault()}><input type="hidden" name="plan_id" value={planId}/><input type="hidden" name="revision" value={revision}/><ErrorMessage text={state.error}/>{state.saved&&<p className="hint-box" role="status">恢复安排已保存，可在下方查看新版本。</p>}<label htmlFor="resume-date">恢复学习日期</label><input id="resume-date" name="start_date" type="date" required min={today} defaultValue={today} disabled={pending}/><p className="note">从所选日期重新安排剩余任务。已开始的任务、已完成的学习、成绩和FSRS日期保留；时间冲突时会停止保存。</p><button className="button" disabled={pending}>{pending?'正在保存…':'确认恢复未开始的安排'}</button></form>;
}
