# Machine Learning Foundations

Subject ID: `machine-learning-foundations`

Version: `0.1.0`

## Purpose

Machine Learning Foundations establishes the reusable system model behind
machine learning:

```text
Problem
  -> data and representation
  -> model
  -> prediction
  -> loss
  -> optimization
  -> updated parameters
  -> validation and evaluation
  -> generalization judgment
```

The subject is the trunk for later linear models, logistic regression, neural
networks, transformers, and language-model subjects.

## Assumed Prior Knowledge

The learner can:

- perform basic arithmetic
- work with negative numbers
- understand variables
- interpret simple functions
- calculate an average
- read short Python-like pseudocode
- understand that data can be represented numerically

The subject does not assume calculus fluency, linear algebra fluency,
probability theory, prior PyTorch, prior model implementation, or formal proof
comfort.

## Non-Goals

This subject does not teach decision trees, random forests, boosted trees,
support-vector machines, kernels, Bayesian methods, clustering, PCA,
reinforcement learning, full matrix calculus, optimizer families, convolutional
networks, recurrent networks, transformer internals, tokenization, scaling
laws, fine-tuning, RLHF, retrieval-augmented generation, agents, or deployment
infrastructure.

Future subjects may name those topics after this loop is stable.

## Canonical Notation

The authored package uses ASCII notation for portability:

- `x`: input or feature vector
- `y`: target
- `y_hat`: prediction
- `theta`: model parameters
- `w`: weight
- `b`: bias
- `L`: loss
- `eta`: learning rate
- `grad L`: gradient of the loss
- `D`: dataset

Every equation block includes a plain-language description. Notation is defined
before use.

## Concept Graph

The prerequisite spine is:

```text
learning-problem
  -> example
  -> feature
  -> target
  -> dataset
  -> representation
  -> model
  -> parameter
  -> prediction
  -> residual
  -> loss
  -> gradient
  -> gradient-descent
  -> training
  -> generalization
```

Classification branch:

```text
linear-model
  -> logit
  -> sigmoid
  -> probability
  -> decision-threshold
```

Deep-learning bridge:

```text
linear-model + function-composition
  -> activation-function
  -> neural-network
  -> computational-graph
  -> backpropagation
  -> automatic-differentiation
```

Related concepts connect across the graph without adding prerequisite cycles.

## Module Sequence

1. The Learning System
2. Linear Models as Functions
3. Loss, Gradients, and Optimization
4. Classification, Scores, and Probability
5. Generalization and Evaluation
6. Bridge to Deep Learning

## Objective Map

The subject uses observable objectives such as:

- Trace one supervised-learning iteration from input data through parameter
  update.
- Frame a prediction problem by identifying examples, features, targets, and
  evaluation intent.
- Distinguish model parameters from hyperparameters.
- Distinguish training from inference.
- Calculate a one-feature linear prediction.
- Calculate a residual with the convention `prediction - target`.
- Calculate mean squared error for two predictions.
- Apply one gradient-descent update from a supplied gradient and learning
  rate.
- Diagnose learning-rate, underfitting, overfitting, leakage, threshold, and
  probability interpretation failures.
- Distinguish logits, probabilities, and thresholded classes.
- Select a metric based on error costs.
- Explain how neural-network training preserves the
  model-loss-optimization-evaluation loop.

## Activity Map

The implementation uses 33 activities across six modules. The sequence is
mostly linear and progresses from worked orientation to completion, guided
practice, independent diagnosis, and transfer.

Required checkpoints:

- Linear prediction: `x = 3`, `w = 2`, `b = 1`, so `y_hat = 7`.
- Residual convention: `prediction - target`; `7 - 9 = -2`.
- Mean squared error: predictions `[2, 4]`, targets `[3, 3]`,
  squared errors `[1, 1]`, so `MSE = 1`.
- Gradient step: `theta = 2`, `gradient = 3`, `eta = 0.1`, so
  `theta_new = 1.7`.
- Threshold effect: lowering a threshold creates more positive predictions;
  recall can increase and precision can decrease depending on the dataset.

## Assessment Mix

The subject uses:

- manual orientation for compact system setup
- single-choice and multiple-choice deterministic checks
- numeric tolerance for hand calculations
- rubric-assisted text and code for explanation, problem framing,
  pseudocode reasoning, transfer, and experiment design

Rubric-assisted activities use `completionPolicy = submission` and are recorded
as ungraded evidence. Deterministic answer keys are reserved for structurally
deterministic tasks.

## Recurring Examples

Primary case study: game telemetry.

Recurring fictional features:

- `practice_minutes`
- `gear_score`
- `prior_attempts`

Recurring targets:

- regression target: `completion_time_seconds`
- classification target: whether a player clears a boss encounter

Transfer contexts:

- movement performance, such as predicting jump height from training
  measurements
- software behavior, such as predicting whether a build will pass from test and
  dependency signals

The subject distinguishes regression and classification targets and does not
claim causal conclusions from these examples.

## Bridge to Later Subjects

Later subjects add depth without replacing the trunk:

- Mathematical Tools for ML formalizes vectors, derivatives, probability,
  logarithms, and optimization behavior.
- Classical Supervised Learning expands model families and evaluation.
- Deep Learning Foundations adds layered differentiable functions and learned
  hidden representations.
- Training Neural Networks adds vector gradients, optimizer behavior, and
  diagnostics.
- Attention and Transformers explains architecture after the learner can trace
  data, prediction, objective, gradient, parameter update, and evaluation.
- Language Modeling and LLM Training map token prediction and transformer
  training back onto the same loop while acknowledging that real LLM training
  recipes vary.

## Technical Reference Anchors

- Google Machine Learning Crash Course:
  https://developers.google.com/machine-learning/crash-course
- Stanford CS229 lecture notes:
  https://cs229.stanford.edu/lectures-spring2022/main_notes.pdf
- Deep Learning, Goodfellow, Bengio, and Courville:
  https://www.deeplearningbook.org/
- PyTorch Autograd:
  https://docs.pytorch.org/tutorials/beginner/basics/autogradqs_tutorial.html
- PyTorch Optimization:
  https://docs.pytorch.org/tutorials/beginner/basics/optimization_tutorial.html
- Attention Is All You Need:
  https://arxiv.org/abs/1706.03762
