'use client';
import { useActionState } from 'react';
import { submitQuiz } from './actions';
export function QuizForm({ questions, submissionKey, courseId, lessonVersion, quizAction = submitQuiz }: { questions: { id: string; prompt: string; options: string[] }[]; submissionKey: string; courseId?:string; lessonVersion?:string; quizAction?:typeof submitQuiz }) {
  const [state, action, pending] = useActionState(quizAction, { error: '' });
  // A returned save error still resolves the Action: cancel its automatic reset.
  // Successful submissions redirect, so this form never needs to clear in place.
  return <form action={action} onReset={event => event.preventDefault()}>
    <input type="hidden" name="submission_key" value={submissionKey} />
    {courseId && <input type="hidden" name="course_id" value={courseId} />}
    {lessonVersion && <input type="hidden" name="lesson_version" value={lessonVersion} />}
    {questions.map((question, index) => <fieldset key={question.id} disabled={pending}>
      <legend>{index + 1}. {question.prompt}</legend>
      {question.options.map((option, choice) => <label className="option" key={choice}>
        <input type="radio" name={question.id} value={choice} required />
        <span>{option}</span>
      </label>)}
    </fieldset>)}
    {state.error && <div className="alert" role="alert">{state.error}</div>}
    <div className="submit-row"><button className="button" disabled={pending}>{pending ? '正在保存…' : '提交并保存结果'}</button><span className="note" role="status">{pending ? '正在保存你的作答，请稍等。' : '提交后会看到每题的解释。'}</span></div>
  </form>;
}
