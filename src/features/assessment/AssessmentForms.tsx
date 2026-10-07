'use client';
import {useActionState,useEffect,useRef,useState,useTransition} from 'react';
import {startAction,submitAction,helpAction,reviewAction,resolveAction,candidateAction,publishAction} from './actions';
import type {FormState} from './actions';
type Action=(state:FormState,data:FormData)=>Promise<FormState>;
export function SmallForm({action,hidden,children}:{action:Action;hidden:Record<string,string>;children:React.ReactNode}){
  const [state,run,pending]=useActionState(action,{error:''});const error=useRef<HTMLParagraphElement>(null);
  useEffect(()=>{if(state.error)error.current?.focus();},[state.error]);
  return <form action={run} onReset={e=>e.preventDefault()} className="goal-form assessment-form">
    {Object.entries(hidden).map(([name,value])=><input key={name} type="hidden" name={name} value={value}/>)}
    {state.error&&<p className="alert" ref={error} role="alert" tabIndex={-1}>{state.error}</p>}
    {state.success&&<p className="alert success" role="status">{state.success}</p>}
    <fieldset disabled={pending}>{children}</fieldset>{pending&&<p role="status">正在保存…</p>}
  </form>;
}
export function StartForm({pack,skill,canExam=true}:{pack:string;skill:string;canExam?:boolean}){return <SmallForm action={startAction} hidden={{pack_id:pack,skill_id:skill}}><div className="assessment-actions">{canExam&&<button className="button" name="mode" value="exam">独立考核 / 新题补测</button>}<button className="button secondary" name="mode" value="diagnosis">诊断基础</button><button className="button secondary" name="mode" value="skip">跳级测验</button></div></SmallForm>;}
export function CandidateForm({courseId}:{courseId:string}){return <SmallForm action={candidateAction} hidden={{course_id:courseId}}><button className="button secondary">申请诊断题库审核</button></SmallForm>;}
type PublicQuestion={id:string;prompt:string;type:string;options?:string[]};
export function AssessmentForm({id,questions,initialHelp}:{id:string;questions:PublicQuestion[];initialHelp:Record<string,{text:string}>}){
  const [state,action,pending]=useActionState(submitAction,{error:''});const [help,setHelp]=useState(initialHelp),[helpError,setHelpError]=useState('');
  const [helpPending,transition]=useTransition();const error=useRef<HTMLParagraphElement>(null);
  useEffect(()=>{if(state.error||helpError)error.current?.focus();},[state.error,helpError]);
  function show(qid:string,kind:string){transition(async()=>{const result=await helpAction(id,qid,kind);setHelpError(result.error);if(!result.error)setHelp(old=>({...old,[qid]:{text:result.text}}));});}
  return <form action={action} onReset={e=>e.preventDefault()} className="quiz-form">
    <input type="hidden" name="session_id" value={id}/>
    {(state.error||helpError)&&<p ref={error} role="alert" tabIndex={-1} className="alert">{state.error||helpError}</p>}
    <fieldset disabled={pending||helpPending}>{questions.map((q,index)=><fieldset className="question" key={q.id}>
      <legend>{index+1}. {q.prompt}</legend>
      {q.type==='choice'?q.options!.map((option,i)=><label className="option" key={i}><input type="radio" name={q.id} value={i} required/>{option}</label>):<><label htmlFor={q.id}>你的独立解释（等待人工复核）</label><textarea id={q.id} name={q.id} required maxLength={1800} rows={4}/></>}
      <div className="assessment-help"><button type="button" className="text-link" onClick={()=>show(q.id,'hint')}>查看提示</button><button type="button" className="text-link" onClick={()=>show(q.id,'answer')}>查看答案 / 评分依据</button></div>
      {help[q.id]&&<div className="hint-box" role="status">{help[q.id].text}<p className="note">已记录帮助访问，本题不计独立证据；补测将使用新题。</p></div>}
    </fieldset>)}</fieldset>
    <button className="button" disabled={pending||helpPending}>{pending?'正在保存…':'提交独立作答'}</button>
    <p className="note">会话有效30分钟。提交前可刷新继续；未提交的选项不跨刷新保存。</p>
  </form>;
}
export function ReviewForm({sessionId,questionId}:{sessionId:string;questionId:string}){return <SmallForm action={reviewAction} hidden={{session_id:sessionId,question_id:questionId}}><label htmlFor={`reason-${questionId}`}>复核原因</label><textarea id={`reason-${questionId}`} name="reason" required minLength={5} maxLength={1500} rows={2}/><button className="button secondary">提交评分复核</button></SmallForm>;}
export function ResolveForm({reviewId}:{reviewId:string}){return <SmallForm action={resolveAction} hidden={{review_id:reviewId}}><label htmlFor={reviewId}>结论</label><select id={reviewId} name="correct" required><option value="">请选择</option><option value="true">符合评分依据</option><option value="false">不符合评分依据</option></select><label htmlFor={`rationale-${reviewId}`}>来源与评分依据</label><textarea id={`rationale-${reviewId}`} name="rationale" required minLength={5} maxLength={1500} rows={3}/><button className="button">保存复核决定</button></SmallForm>;}
export function PublishForm({packId,spec}:{packId:string;spec:string}){return <SmallForm action={publishAction} hidden={{pack_id:packId}}><label htmlFor={`spec-${packId}`}>审核题库 JSON（新增五个题族及补测新题）</label><textarea id={`spec-${packId}`} name="spec" defaultValue={spec} required rows={16} maxLength={200000}/><label htmlFor={`rationale-${packId}`}>题族、来源、前置与评分核查意见</label><textarea id={`rationale-${packId}`} name="rationale" required minLength={5} maxLength={1500} rows={3}/><button className="button">批准并保存题库版本</button></SmallForm>;}
