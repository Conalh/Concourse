# AI/ML Learning Roadmap

This roadmap defines the trunk for Learnt's AI, machine learning, deep
learning, and LLM curriculum. It is not a topic checklist. Each stage should
produce demonstrated capability through prediction, calculation,
implementation, debugging, transfer, evaluation, and research reconstruction.

## Target Capability Map

By the end of the path, the learner should be able to:

- Predict how data, features, model form, parameters, loss, optimization, and
  evaluation choices affect observed model behavior.
- Calculate small model outputs, residuals, losses, gradients, parameter
  updates, probabilities, threshold decisions, and core metrics.
- Implement core algorithms and training loops in progressively more realistic
  Python and PyTorch settings.
- Debug failures by separating problem framing, data quality, representation,
  optimization, generalization, metric selection, and implementation errors.
- Evaluate models with baselines, validation strategy, error analysis, leakage
  checks, reliability limits, and fit-for-purpose metrics.
- Explain mechanisms compactly without treating libraries, neural networks, or
  LLMs as magic.
- Transfer the same learning-system model across linear regression, logistic
  regression, neural networks, transformers, and language-model workflows.

## Candidate First Subject Analysis

### AI Survey First

Potential benefit: broad orientation across symbolic AI, machine learning,
deep learning, generative AI, and deployed systems.

Primary weakness: the learner can collect terminology before they have a
mechanical model for how a system learns from examples.

Disposition: useful later as an organizing map or public-facing overview, not
as the trunk.

### Mathematics First

Potential benefit: rigorous preparation for linear algebra, probability,
calculus, optimization, and information theory.

Primary weakness: detached prerequisites can make the learner manipulate
symbols before knowing what system behavior the symbols explain.

Disposition: necessary as parallel and later deepening subjects. It should not
be a hard gate for the first serious ML subject.

### Neural Networks First

Potential benefit: immediate relevance to modern AI and LLMs.

Primary weakness: neural networks can hide the more general structure of
problem, data, model, prediction, loss, optimization, and evaluation.

Disposition: valuable once the reusable learning loop is stable.

### Machine-Learning System Foundations First

Potential benefit: creates the reusable framework that later supports linear
models, logistic regression, neural networks, transformers, and language-model
training.

Decision: start with `machine-learning-foundations` version `0.1.0`.

Rationale: the first subject should make the learner trace the complete
learning system before adding architectural complexity. Transformers are then
introduced later as complex differentiable models, not unexplained machinery.

## Subject-Level Roadmap

1. Machine Learning Foundations
2. Mathematical Tools for Machine Learning
3. Classical Supervised Learning
4. Unsupervised Learning and Representation
5. Deep Learning Foundations
6. Training Neural Networks
7. Attention and Transformers
8. Language Modeling
9. LLM Training and Adaptation
10. Retrieval and Tool-Using Systems
11. LLM Evaluation, Reliability, and Alignment
12. ML Research and Experiment Design

Parallel subjects:

- Linear Algebra for ML
- Probability and Statistics for ML
- Calculus and Optimization for ML
- Python and PyTorch Laboratory
- Reinforcement Learning
- Computer Vision
- Sequence Modeling
- Interpretability
- ML Systems and Deployment

## Dependency Graph

```text
Machine Learning Foundations
  -> Classical Supervised Learning
  -> Deep Learning Foundations
  -> Training Neural Networks
  -> Attention and Transformers
  -> Language Modeling
  -> LLM Training and Adaptation
  -> Retrieval and Tool-Using Systems
  -> LLM Evaluation, Reliability, and Alignment
  -> ML Research and Experiment Design

Machine Learning Foundations
  -> Mathematical Tools for Machine Learning
      -> Linear Algebra for ML
      -> Probability and Statistics for ML
      -> Calculus and Optimization for ML

Python and PyTorch Laboratory
  || Machine Learning Foundations
  -> Deep Learning Foundations
  -> Training Neural Networks

Unsupervised Learning and Representation
  -> Embeddings
  -> Representation Learning
  -> Attention and Transformers
```

Hard prerequisites should stay narrow. Machine Learning Foundations requires
basic arithmetic, variables, simple functions, averages, and short
Python-like pseudocode. Dedicated math subjects deepen the mechanisms after the
learner has a system to attach them to.

Just-in-time concepts in the first subject:

- Vectors as compact feature lists.
- Derivatives as local sensitivity.
- Probability as a model output for a binary class, not human certainty.
- Logarithms as deferred machinery behind cross-entropy.
- Computational graphs as dependency records for gradient propagation.

Dedicated math becomes necessary before rigorous matrix-based derivations,
optimizer analysis, probability calibration, information theory, transformer
attention calculations, and paper-level proofs.

## Learning-Depth Policy

Every concept can appear at three depths:

- Intuition: what the concept is for and how to recognize it.
- Mechanism: how the concept changes system behavior.
- Derivation / implementation: why the mechanism follows mathematically or how
  to build it.

Gradient descent in Machine Learning Foundations:

- Intuition: update parameters to reduce loss.
- Mechanism: use local sensitivity and learning rate to choose update
  direction and size.
- Calculation: one-dimensional numeric update.

Gradient descent in Training Neural Networks:

- Vector gradients, optimizer behavior, implementation details, and training
  diagnostics.

Optimization mathematics:

- Fuller derivations, convergence assumptions, numerical behavior, and failure
  modes.

Transformers:

- Foundations subject: still data, model, prediction, objective, gradients,
  updates, and evaluation.
- Attention and Transformers: attention calculations, architecture, masking,
  positional information, and sequence modeling.
- Language Modeling and LLM Training: token prediction objectives, scaling
  behavior, adaptation, evaluation, and reliability.

## Evidence Policy

Meaningful evidence grows in kind:

- Prediction: choose or state what the system will output or how a change
  affects behavior.
- Numerical calculation: compute small predictions, residuals, losses,
  updates, probabilities, or metrics.
- Debugging: identify the broken assumption, code step, data split, metric, or
  interpretation.
- Code explanation: map short pseudocode to data, model, loss, gradients, and
  updates.
- Implementation: write minimal algorithms and verify behavior on small data.
- Transfer: apply the same mechanism to a new domain without changing the
  underlying structure.
- Experiment design: propose a baseline, split, metric, ablation, and error
  analysis.
- Research-paper reconstruction: restate the problem, method, assumptions,
  evidence, limitations, and open questions.

Completion is evidence for an authored activity. It is not mastery. Mastery
requires repeated transfer, delayed retrieval, debugging, and independent
implementation across contexts.

## Future Ideas

These are deliberately deferred:

- Interactive tensor visualizers.
- Notebook or Python execution.
- PyTorch runtime integration.
- AI grading.
- Adaptive mastery tracking.
- Spaced repetition.
- Attention heatmaps.
- LLM chat interface.
- Generated curricula.

If built later, each should remain a platform feature with subject-agnostic
contracts rather than a custom branch for one subject.

## Reference Anchors

These references anchor terminology and sequencing decisions. Activities in
the subject remain self-contained and do not require external reading.

- Google Machine Learning Crash Course:
  https://developers.google.com/machine-learning/crash-course
- Stanford CS229 lecture notes:
  https://cs229.stanford.edu/lectures-spring2022/main_notes.pdf
- Deep Learning, Goodfellow, Bengio, and Courville:
  https://www.deeplearningbook.org/
- PyTorch Learn the Basics:
  https://docs.pytorch.org/tutorials/beginner/basics/intro.html
- PyTorch Autograd:
  https://docs.pytorch.org/tutorials/beginner/basics/autogradqs_tutorial.html
- PyTorch Optimization:
  https://docs.pytorch.org/tutorials/beginner/basics/optimization_tutorial.html
- Attention Is All You Need:
  https://arxiv.org/abs/1706.03762
