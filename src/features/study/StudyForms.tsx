'use client';
import {useActionState,useEffect,useRef} from 'react';
import {createStudyAction,startStudyAction} from './actions';
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
