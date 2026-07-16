import test from 'node:test'
import assert from 'node:assert/strict'

import {
  DEMO_ANSWERS,
  createDemoState,
  transitionDemo,
} from '../website/demo-model.js'

test('starts at the route with no answer', () => {
  assert.deepEqual(createDemoState(), {
    step: 'route',
    answerStatus: 'unanswered',
  })
})

test('publishes the three approved answer choices', () => {
  assert.deepEqual(
    DEMO_ANSWERS.map(({ id, correct }) => ({ id, correct })),
    [
      { id: 'membrane', correct: true },
      { id: 'dna', correct: false },
      { id: 'ribosomes', correct: false },
    ],
  )
})

test('follows the approved forward path', () => {
  const lesson = transitionDemo(createDemoState(), { type: 'start' })
  const recall = transitionDemo(lesson, { type: 'continue' })
  const pack = transitionDemo(recall, {
    type: 'answer',
    choice: 'membrane',
  })

  assert.equal(lesson.step, 'lesson')
  assert.equal(recall.step, 'recall')
  assert.deepEqual(pack, { step: 'pack', answerStatus: 'correct' })
})

test('explains an incorrect answer and permits retry', () => {
  const recall = { step: 'recall', answerStatus: 'unanswered' }
  const incorrect = transitionDemo(recall, {
    type: 'answer',
    choice: 'dna',
  })

  assert.deepEqual(incorrect, {
    step: 'recall',
    answerStatus: 'incorrect',
  })
  assert.deepEqual(transitionDemo(incorrect, { type: 'retry' }), recall)
})

test('supports back and reset without retaining stale answers', () => {
  assert.deepEqual(
    transitionDemo({ step: 'pack', answerStatus: 'correct' }, { type: 'back' }),
    { step: 'recall', answerStatus: 'correct' },
  )
  assert.deepEqual(
    transitionDemo(
      { step: 'recall', answerStatus: 'incorrect' },
      { type: 'back' },
    ),
    { step: 'lesson', answerStatus: 'unanswered' },
  )
  assert.deepEqual(
    transitionDemo(
      { step: 'lesson', answerStatus: 'unanswered' },
      { type: 'back' },
    ),
    createDemoState(),
  )
  assert.deepEqual(
    transitionDemo(
      { step: 'pack', answerStatus: 'correct' },
      { type: 'reset' },
    ),
    createDemoState(),
  )
})

test('recovers invalid state and ignores impossible transitions', () => {
  assert.deepEqual(
    transitionDemo(
      { step: 'missing', answerStatus: 'incorrect' },
      { type: 'back' },
    ),
    createDemoState(),
  )
  assert.deepEqual(
    transitionDemo(createDemoState(), { type: 'continue' }),
    createDemoState(),
  )
})
