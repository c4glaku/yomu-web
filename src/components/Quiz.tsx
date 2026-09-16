import { ArrowRight, Check, RotateCcw, Sparkles, X } from 'lucide-react'
import { useState } from 'react'
import type { Question } from '../types'
import { Modal } from './UI'

export default function Quiz({
  questions,
  onClose,
  onComplete,
}: {
  questions: Question[]
  onClose: () => void
  onComplete: (score: { correct: number; total: number }) => void
}) {
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<string[]>([])
  const [done, setDone] = useState(false)
  const question = questions[index]
  const answer = answers[index]
  const correct = questions.filter((question, i) => question.answer === answers[i]).length
  const missed = questions.filter((question, i) => question.answer !== answers[i])
  return (
    <Modal title={done ? 'A little more familiar' : 'Let those words sink in'} onClose={onClose}>
      {!questions.length ? (
        <div className="empty">
          <Sparkles size={31} />
          <h3>A few more words to discover</h3>
          <p>
            There wasn’t enough dictionary vocabulary to make a useful quiz. Read another page or
            save a word, then try again.
          </p>
          <button className="primary" onClick={onClose}>
            Keep exploring <ArrowRight size={17} />
          </button>
        </div>
      ) : done ? (
        <div className="quiz-results">
          <div className="result-icon">
            <Sparkles size={30} />
          </div>
          <p className="eyebrow">EVERY TRY IS PROGRESS</p>
          <h3>
            {correct}
            <span> / {questions.length}</span>
          </h3>
          <p>
            {correct === questions.length
              ? 'All familiar faces. Nicely remembered.'
              : 'Some words take a little longer to settle in.'}
          </p>
          {missed.length > 0 && (
            <div className="missed-list">
              <h4>Take another look</h4>
              {missed.map((question, i) => (
                <div key={i}>
                  <strong lang="ja">{question.entry.word}</strong>
                  <p>
                    {question.entry.reading} · {question.entry.meanings.slice(0, 2).join('; ')}
                  </p>
                  {question.sentence && (
                    <p lang="ja" className="muted">
                      {question.sentence}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
          <button className="primary full-width" onClick={onClose}>
            All done <Check size={17} />
          </button>
          <button
            className="text-button"
            onClick={() => {
              setIndex(0)
              setAnswers([])
              setDone(false)
            }}
          >
            <RotateCcw size={15} />
            Try again
          </button>
        </div>
      ) : (
        <>
          <div className="quiz-topline">
            <span>
              Question {index + 1} of {questions.length}
            </span>
            <span>{correct} correct</span>
          </div>
          <div className="quiz-progress">
            <div style={{ width: `${(index / questions.length) * 100}%` }} />
          </div>
          <p className="quiz-prompt">
            {question.kind === 'reading'
              ? 'How do you read this word?'
              : 'What does this word mean?'}
          </p>
          <h3 className="quiz-word" lang="ja">
            {question.entry.word}
          </h3>
          {question.sentence && (
            <p className="quiz-sentence" lang="ja">
              {question.sentence}
            </p>
          )}
          <div className="quiz-options">
            {question.options.map((option, i) => (
              <button
                key={option}
                disabled={answer !== undefined}
                className={
                  answer !== undefined
                    ? option === question.answer
                      ? 'correct'
                      : option === answer
                        ? 'incorrect'
                        : ''
                    : ''
                }
                onClick={() => setAnswers([...answers, option])}
              >
                <span className="option-letter">{String.fromCharCode(65 + i)}</span>
                <span lang={question.kind === 'reading' ? 'ja' : 'en'}>{option}</span>
                {answer !== undefined && option === question.answer && <Check size={17} />}
                {option === answer && option !== question.answer && <X size={17} />}
              </button>
            ))}
          </div>
          {answer !== undefined && (
            <div className="quiz-feedback" aria-live="polite">
              <strong>
                {answer === question.answer
                  ? 'You’ve got it.'
                  : `The answer is ${question.answer}.`}
              </strong>
              <p>
                {question.entry.reading} · {question.entry.meanings.slice(0, 2).join('; ')}
              </p>
              <button
                className="primary full-width"
                onClick={() => {
                  if (index + 1 === questions.length) {
                    setDone(true)
                    onComplete({ correct, total: questions.length })
                  } else setIndex(index + 1)
                }}
              >
                {index + 1 === questions.length ? 'See your results' : 'Next word'}
                <ArrowRight size={17} />
              </button>
            </div>
          )}
        </>
      )}
    </Modal>
  )
}
