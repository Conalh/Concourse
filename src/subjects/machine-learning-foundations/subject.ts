import { createSubjectAdapter, defineSubject } from '../../subject-sdk'

export const machineLearningFoundationsSubject = defineSubject({
  schemaVersion: '0.1',
  id: 'machine-learning-foundations',
  version: '0.1.0',
  title: 'Machine Learning Foundations',
  summary:
    'Trace machine learning as a system of data, models, loss, optimization, and generalization.',
  tags: [
    'machine-learning',
    'artificial-intelligence',
    'foundations',
    'optimization',
    'generalization',
  ],
  modules: [
    {
      id: 'the-learning-system',
      title: 'The Learning System',
      summary:
        'Frame ML tasks and trace the data-to-update loop before naming algorithms.',
      order: 0,
      conceptIds: [
        'learning-problem',
        'example',
        'feature',
        'target',
        'dataset',
        'representation',
        'model',
        'parameter',
        'hyperparameter',
        'training',
        'inference',
      ],
      objectiveIds: [
        'trace-learning-loop',
        'frame-prediction-problem',
        'distinguish-parameters-hyperparameters',
        'distinguish-training-inference',
      ],
      activityIds: [
        'orient-learning-loop',
        'predict-serving-update',
        'classify-system-parts',
        'debug-vague-ml-task',
        'transfer-build-risk-frame',
      ],
    },
    {
      id: 'linear-models-as-functions',
      title: 'Linear Models as Functions',
      summary:
        'Make prediction mechanical with weights, bias, feature values, and residuals.',
      order: 10,
      conceptIds: [
        'scalar',
        'feature-vector',
        'weight',
        'bias',
        'weighted-sum',
        'linear-model',
        'linear-regression',
        'prediction',
        'residual',
      ],
      objectiveIds: [
        'calculate-linear-prediction',
        'explain-weight-and-bias',
        'calculate-residual',
      ],
      activityIds: [
        'orient-linear-prediction',
        'calculate-linear-prediction',
        'predict-weight-change',
        'calculate-residual',
        'transfer-jump-linear-model',
      ],
    },
    {
      id: 'loss-gradients-and-optimization',
      title: 'Loss, Gradients, and Optimization',
      summary:
        'Turn prediction error into a loss, a gradient direction, and one parameter update.',
      order: 20,
      conceptIds: [
        'error',
        'loss',
        'mean-squared-error',
        'objective',
        'derivative',
        'gradient',
        'gradient-descent',
        'learning-rate',
        'batch',
        'epoch',
        'optimization-step',
      ],
      objectiveIds: [
        'calculate-mse',
        'apply-gradient-update',
        'diagnose-optimization-behavior',
        'distinguish-batches-epochs',
      ],
      activityIds: [
        'orient-loss-and-gradient',
        'calculate-mse',
        'choose-gradient-direction',
        'apply-gradient-step',
        'diagnose-large-learning-rate',
        'debug-training-loop-order',
        'recall-batch-epoch',
      ],
    },
    {
      id: 'classification-scores-and-probability',
      title: 'Classification, Scores, and Probability',
      summary:
        'Separate logits, probabilities, thresholds, and class decisions.',
      order: 30,
      conceptIds: [
        'binary-classification',
        'score',
        'logit',
        'sigmoid',
        'probability',
        'decision-threshold',
        'binary-cross-entropy',
        'positive-class',
        'negative-class',
      ],
      objectiveIds: [
        'distinguish-classification-outputs',
        'reason-about-thresholds',
      ],
      activityIds: [
        'orient-classification-scores',
        'predict-positive-logit',
        'predict-threshold-lowering',
        'debug-probability-confusion',
        'explain-bce-penalty',
      ],
    },
    {
      id: 'generalization-and-evaluation',
      title: 'Generalization and Evaluation',
      summary:
        'Judge models by unseen-data behavior, leakage risk, baselines, and metrics.',
      order: 40,
      conceptIds: [
        'training-set',
        'validation-set',
        'test-set',
        'generalization',
        'training-error',
        'validation-error',
        'underfitting',
        'overfitting',
        'data-leakage',
        'regularization',
        'baseline',
        'accuracy',
        'precision',
        'recall',
        'metric-selection',
      ],
      objectiveIds: [
        'diagnose-generalization-patterns',
        'identify-data-leakage',
        'select-evaluation-metric',
      ],
      activityIds: [
        'orient-generalization',
        'diagnose-overfitting',
        'diagnose-underfitting',
        'identify-leakage',
        'select-recall-metric',
        'transfer-evaluation-plan',
      ],
    },
    {
      id: 'bridge-to-deep-learning',
      title: 'Bridge to Deep Learning',
      summary:
        'Map neural networks and automatic differentiation back onto the same learning loop.',
      order: 50,
      conceptIds: [
        'function-composition',
        'hidden-representation',
        'activation-function',
        'nonlinearity',
        'neural-network',
        'computational-graph',
        'forward-pass',
        'backpropagation',
        'automatic-differentiation',
        'representation-learning',
      ],
      objectiveIds: [
        'trace-computational-graph',
        'map-loop-to-neural-networks',
      ],
      activityIds: [
        'orient-deep-learning-bridge',
        'predict-stacked-linear-functions',
        'trace-computational-graph',
        'explain-autograd-training-code',
        'transfer-loop-to-transformer',
      ],
    },
  ],
  concepts: [
    {
      id: 'learning-problem',
      title: 'Learning problem',
      summary:
        'A task stated as what should be predicted, from what data, and for what evaluation purpose.',
      prerequisiteConceptIds: [],
      relatedConceptIds: ['dataset', 'model', 'generalization'],
      tags: ['system'],
    },
    {
      id: 'example',
      title: 'Example',
      summary:
        'One observed case in a dataset, such as one player attempt or one build run.',
      prerequisiteConceptIds: ['learning-problem'],
      relatedConceptIds: ['feature', 'target'],
      tags: ['data'],
    },
    {
      id: 'feature',
      title: 'Feature',
      summary:
        'An input value used by a model, such as practice minutes or gear score.',
      prerequisiteConceptIds: ['example'],
      relatedConceptIds: ['representation', 'feature-vector'],
      tags: ['data'],
    },
    {
      id: 'target',
      title: 'Target',
      summary:
        'The value the system is trying to predict, such as clear status or completion time.',
      prerequisiteConceptIds: ['example'],
      relatedConceptIds: ['prediction', 'residual'],
      tags: ['data'],
    },
    {
      id: 'dataset',
      title: 'Dataset',
      summary:
        'A collection of examples with features and, for supervised learning, targets.',
      prerequisiteConceptIds: ['feature', 'target'],
      relatedConceptIds: ['batch', 'training-set', 'test-set'],
      tags: ['data'],
    },
    {
      id: 'representation',
      title: 'Representation',
      summary: 'The numeric form used to present a problem to a model.',
      prerequisiteConceptIds: ['dataset'],
      relatedConceptIds: ['feature-vector', 'hidden-representation'],
      tags: ['data'],
    },
    {
      id: 'model',
      title: 'Model',
      summary:
        'A parameterized function that maps represented inputs to predictions.',
      prerequisiteConceptIds: ['representation'],
      relatedConceptIds: ['linear-model', 'neural-network'],
      tags: ['model'],
    },
    {
      id: 'parameter',
      title: 'Parameter',
      summary: 'A value learned by training, such as a weight or bias.',
      prerequisiteConceptIds: ['model'],
      relatedConceptIds: ['weight', 'bias', 'optimization-step'],
      tags: ['model'],
    },
    {
      id: 'hyperparameter',
      title: 'Hyperparameter',
      summary:
        'A configured value that controls training or model form, such as learning rate.',
      prerequisiteConceptIds: ['model'],
      relatedConceptIds: ['learning-rate', 'epoch'],
      tags: ['training'],
    },
    {
      id: 'training',
      title: 'Training',
      summary: 'Using data, loss, and optimization to change model parameters.',
      prerequisiteConceptIds: ['parameter'],
      relatedConceptIds: ['inference', 'gradient-descent'],
      tags: ['training'],
    },
    {
      id: 'inference',
      title: 'Inference',
      summary:
        'Using a trained model to produce predictions without optimizer updates.',
      prerequisiteConceptIds: ['model'],
      relatedConceptIds: ['training', 'prediction'],
      tags: ['serving'],
    },
    {
      id: 'scalar',
      title: 'Scalar',
      summary:
        'A single numeric value, such as one feature value or one weight.',
      prerequisiteConceptIds: ['feature'],
      relatedConceptIds: ['feature-vector'],
      tags: ['math'],
    },
    {
      id: 'feature-vector',
      title: 'Feature vector',
      summary: 'A compact ordered list of numeric features for one example.',
      prerequisiteConceptIds: ['representation'],
      relatedConceptIds: ['weighted-sum'],
      tags: ['math'],
    },
    {
      id: 'weight',
      title: 'Weight',
      summary: 'A learned parameter that scales a feature contribution.',
      prerequisiteConceptIds: ['parameter'],
      relatedConceptIds: ['weighted-sum', 'linear-model'],
      tags: ['model'],
    },
    {
      id: 'bias',
      title: 'Bias',
      summary: 'A learned offset added to a model prediction.',
      prerequisiteConceptIds: ['parameter'],
      relatedConceptIds: ['weighted-sum', 'linear-model'],
      tags: ['model'],
    },
    {
      id: 'weighted-sum',
      title: 'Weighted sum',
      summary:
        'A prediction score formed by multiplying features by weights and adding bias.',
      prerequisiteConceptIds: ['weight', 'bias'],
      relatedConceptIds: ['linear-model', 'logit'],
      tags: ['model'],
    },
    {
      id: 'linear-model',
      title: 'Linear model',
      summary:
        'A model whose prediction is a weighted sum of inputs plus bias.',
      prerequisiteConceptIds: ['weighted-sum'],
      relatedConceptIds: ['linear-regression', 'logit', 'function-composition'],
      tags: ['model'],
    },
    {
      id: 'linear-regression',
      title: 'Linear regression',
      summary: 'Using a linear model to predict a continuous target.',
      prerequisiteConceptIds: ['linear-model'],
      relatedConceptIds: ['mean-squared-error'],
      tags: ['regression'],
    },
    {
      id: 'prediction',
      title: 'Prediction',
      summary: 'The model output before comparing it with the target.',
      prerequisiteConceptIds: ['model'],
      relatedConceptIds: ['target', 'loss'],
      tags: ['model'],
    },
    {
      id: 'residual',
      title: 'Residual',
      summary:
        'The signed difference between prediction and target; this subject uses prediction minus target.',
      prerequisiteConceptIds: ['prediction', 'target'],
      relatedConceptIds: ['error', 'mean-squared-error'],
      tags: ['error'],
    },
    {
      id: 'error',
      title: 'Error',
      summary:
        'A difference between what the model predicted and what the target says.',
      prerequisiteConceptIds: ['residual'],
      relatedConceptIds: ['loss', 'training-error', 'validation-error'],
      tags: ['error'],
    },
    {
      id: 'loss',
      title: 'Loss',
      summary:
        'A training objective value computed from prediction error for one or more examples.',
      prerequisiteConceptIds: ['error'],
      relatedConceptIds: ['mean-squared-error', 'binary-cross-entropy'],
      tags: ['optimization'],
    },
    {
      id: 'mean-squared-error',
      title: 'Mean squared error',
      summary:
        'Average squared prediction error, often used for regression training.',
      prerequisiteConceptIds: ['loss'],
      relatedConceptIds: ['linear-regression'],
      tags: ['loss'],
    },
    {
      id: 'objective',
      title: 'Objective',
      summary:
        'The loss or score the training process tries to minimize or optimize.',
      prerequisiteConceptIds: ['loss'],
      relatedConceptIds: ['gradient', 'metric-selection'],
      tags: ['optimization'],
    },
    {
      id: 'derivative',
      title: 'Derivative',
      summary:
        'Local sensitivity: how a small input change affects an output near the current value.',
      prerequisiteConceptIds: ['objective'],
      relatedConceptIds: ['gradient'],
      tags: ['math'],
    },
    {
      id: 'gradient',
      title: 'Gradient',
      summary:
        'The collection of loss sensitivities with respect to parameters.',
      prerequisiteConceptIds: ['derivative'],
      relatedConceptIds: ['gradient-descent', 'backpropagation'],
      tags: ['optimization'],
    },
    {
      id: 'learning-rate',
      title: 'Learning rate',
      summary:
        'A hyperparameter controlling how large each parameter update is.',
      prerequisiteConceptIds: ['hyperparameter'],
      relatedConceptIds: ['gradient-descent'],
      tags: ['optimization'],
    },
    {
      id: 'gradient-descent',
      title: 'Gradient descent',
      summary:
        'An update rule that adjusts parameters opposite the gradient direction to reduce loss.',
      prerequisiteConceptIds: ['gradient', 'learning-rate'],
      relatedConceptIds: ['optimization-step'],
      tags: ['optimization'],
    },
    {
      id: 'batch',
      title: 'Batch',
      summary: 'A subset of examples used for one training update.',
      prerequisiteConceptIds: ['dataset'],
      relatedConceptIds: ['epoch', 'optimization-step'],
      tags: ['training'],
    },
    {
      id: 'epoch',
      title: 'Epoch',
      summary: 'One pass through the training dataset.',
      prerequisiteConceptIds: ['batch'],
      relatedConceptIds: ['training'],
      tags: ['training'],
    },
    {
      id: 'optimization-step',
      title: 'Optimization step',
      summary: 'One parameter update computed from loss gradients.',
      prerequisiteConceptIds: ['gradient-descent'],
      relatedConceptIds: ['batch', 'parameter'],
      tags: ['optimization'],
    },
    {
      id: 'binary-classification',
      title: 'Binary classification',
      summary: 'Predicting one of two classes, such as clear or not clear.',
      prerequisiteConceptIds: ['target'],
      relatedConceptIds: ['positive-class', 'negative-class'],
      tags: ['classification'],
    },
    {
      id: 'score',
      title: 'Score',
      summary:
        'A raw model output used before conversion into a probability or class decision.',
      prerequisiteConceptIds: ['linear-model'],
      relatedConceptIds: ['logit', 'prediction'],
      tags: ['classification'],
    },
    {
      id: 'logit',
      title: 'Logit',
      summary:
        'A raw classification score before the sigmoid converts it to a probability.',
      prerequisiteConceptIds: ['score'],
      relatedConceptIds: ['sigmoid'],
      tags: ['classification'],
    },
    {
      id: 'sigmoid',
      title: 'Sigmoid',
      summary: 'A function that maps a logit to a value between 0 and 1.',
      prerequisiteConceptIds: ['logit'],
      relatedConceptIds: ['probability'],
      tags: ['classification'],
    },
    {
      id: 'probability',
      title: 'Probability',
      summary:
        'A model output between 0 and 1 for a class, not proof that the event will occur.',
      prerequisiteConceptIds: ['sigmoid'],
      relatedConceptIds: ['decision-threshold', 'binary-cross-entropy'],
      tags: ['classification'],
    },
    {
      id: 'decision-threshold',
      title: 'Decision threshold',
      summary:
        'The cutoff used to convert a probability into a predicted class.',
      prerequisiteConceptIds: ['probability'],
      relatedConceptIds: ['precision', 'recall'],
      tags: ['classification'],
    },
    {
      id: 'binary-cross-entropy',
      title: 'Binary cross-entropy',
      summary:
        'A classification loss that penalizes confident wrong probabilities strongly.',
      prerequisiteConceptIds: ['loss', 'probability'],
      relatedConceptIds: ['binary-classification'],
      tags: ['loss'],
    },
    {
      id: 'positive-class',
      title: 'Positive class',
      summary:
        'The class labeled as the event of interest in binary classification.',
      prerequisiteConceptIds: ['binary-classification'],
      relatedConceptIds: ['negative-class'],
      tags: ['classification'],
    },
    {
      id: 'negative-class',
      title: 'Negative class',
      summary: 'The other class in a binary classification task.',
      prerequisiteConceptIds: ['binary-classification'],
      relatedConceptIds: ['positive-class'],
      tags: ['classification'],
    },
    {
      id: 'training-set',
      title: 'Training set',
      summary: 'Examples used to fit model parameters.',
      prerequisiteConceptIds: ['dataset'],
      relatedConceptIds: ['validation-set', 'training-error'],
      tags: ['evaluation'],
    },
    {
      id: 'validation-set',
      title: 'Validation set',
      summary:
        'Held-out examples used to tune choices and inspect unseen-data behavior before final testing.',
      prerequisiteConceptIds: ['dataset'],
      relatedConceptIds: ['test-set', 'validation-error'],
      tags: ['evaluation'],
    },
    {
      id: 'test-set',
      title: 'Test set',
      summary:
        'Held-out examples reserved for final evaluation after development decisions.',
      prerequisiteConceptIds: ['dataset'],
      relatedConceptIds: ['validation-set'],
      tags: ['evaluation'],
    },
    {
      id: 'generalization',
      title: 'Generalization',
      summary: 'How well a trained model performs on relevant unseen examples.',
      prerequisiteConceptIds: ['training', 'validation-set'],
      relatedConceptIds: ['overfitting', 'underfitting'],
      tags: ['evaluation'],
    },
    {
      id: 'training-error',
      title: 'Training error',
      summary: 'Error measured on examples used to fit parameters.',
      prerequisiteConceptIds: ['training-set', 'loss'],
      relatedConceptIds: ['validation-error'],
      tags: ['evaluation'],
    },
    {
      id: 'validation-error',
      title: 'Validation error',
      summary: 'Error measured on held-out validation examples.',
      prerequisiteConceptIds: ['validation-set', 'loss'],
      relatedConceptIds: ['training-error'],
      tags: ['evaluation'],
    },
    {
      id: 'underfitting',
      title: 'Underfitting',
      summary:
        'A pattern where the model performs poorly on both training and validation data.',
      prerequisiteConceptIds: ['training-error', 'validation-error'],
      relatedConceptIds: ['model', 'regularization'],
      tags: ['evaluation'],
    },
    {
      id: 'overfitting',
      title: 'Overfitting',
      summary:
        'A pattern where training performance improves while validation behavior worsens.',
      prerequisiteConceptIds: ['training-error', 'validation-error'],
      relatedConceptIds: ['regularization', 'data-leakage'],
      tags: ['evaluation'],
    },
    {
      id: 'data-leakage',
      title: 'Data leakage',
      summary:
        'When information unavailable at prediction time enters training or evaluation features.',
      prerequisiteConceptIds: ['dataset'],
      relatedConceptIds: ['generalization', 'validation-set'],
      tags: ['evaluation'],
    },
    {
      id: 'regularization',
      title: 'Regularization',
      summary:
        'A training constraint or penalty that can reduce overfitting pressure.',
      prerequisiteConceptIds: ['overfitting'],
      relatedConceptIds: ['generalization'],
      tags: ['training'],
    },
    {
      id: 'baseline',
      title: 'Baseline',
      summary:
        'A simple reference system used to judge whether a model adds value.',
      prerequisiteConceptIds: ['learning-problem'],
      relatedConceptIds: ['metric-selection'],
      tags: ['evaluation'],
    },
    {
      id: 'accuracy',
      title: 'Accuracy',
      summary: 'The fraction of classifications that are correct.',
      prerequisiteConceptIds: ['generalization'],
      relatedConceptIds: ['precision', 'recall'],
      tags: ['metric'],
    },
    {
      id: 'precision',
      title: 'Precision',
      summary:
        'Among predicted positives, the fraction that are actually positive.',
      prerequisiteConceptIds: ['generalization'],
      relatedConceptIds: ['recall', 'decision-threshold'],
      tags: ['metric'],
    },
    {
      id: 'recall',
      title: 'Recall',
      summary: 'Among actual positives, the fraction the model catches.',
      prerequisiteConceptIds: ['generalization'],
      relatedConceptIds: ['precision', 'decision-threshold'],
      tags: ['metric'],
    },
    {
      id: 'metric-selection',
      title: 'Metric selection',
      summary:
        'Choosing evaluation metrics based on the cost of different errors.',
      prerequisiteConceptIds: ['accuracy', 'precision', 'recall'],
      relatedConceptIds: ['baseline'],
      tags: ['evaluation'],
    },
    {
      id: 'function-composition',
      title: 'Function composition',
      summary:
        'Connecting functions so the output of one becomes input to another.',
      prerequisiteConceptIds: ['model'],
      relatedConceptIds: ['computational-graph'],
      tags: ['deep-learning'],
    },
    {
      id: 'hidden-representation',
      title: 'Hidden representation',
      summary: 'An intermediate numeric representation learned inside a model.',
      prerequisiteConceptIds: ['representation'],
      relatedConceptIds: ['representation-learning', 'neural-network'],
      tags: ['deep-learning'],
    },
    {
      id: 'activation-function',
      title: 'Activation function',
      summary:
        'A function inserted between layers so a network can model nonlinear patterns.',
      prerequisiteConceptIds: ['function-composition'],
      relatedConceptIds: ['nonlinearity', 'neural-network'],
      tags: ['deep-learning'],
    },
    {
      id: 'nonlinearity',
      title: 'Nonlinearity',
      summary: 'Behavior that cannot be reduced to one linear weighted sum.',
      prerequisiteConceptIds: ['activation-function'],
      relatedConceptIds: ['linear-model'],
      tags: ['deep-learning'],
    },
    {
      id: 'neural-network',
      title: 'Neural network',
      summary:
        'A parameterized model built by composing layers, often with nonlinear activations.',
      prerequisiteConceptIds: ['activation-function'],
      relatedConceptIds: ['linear-model', 'representation-learning'],
      tags: ['deep-learning'],
    },
    {
      id: 'computational-graph',
      title: 'Computational graph',
      summary:
        'A record of operations and dependencies used to compute outputs and propagate gradients.',
      prerequisiteConceptIds: ['function-composition'],
      relatedConceptIds: ['forward-pass', 'backpropagation'],
      tags: ['deep-learning'],
    },
    {
      id: 'forward-pass',
      title: 'Forward pass',
      summary:
        'Computing predictions and loss by following graph dependencies from inputs forward.',
      prerequisiteConceptIds: ['computational-graph'],
      relatedConceptIds: ['backpropagation'],
      tags: ['deep-learning'],
    },
    {
      id: 'backpropagation',
      title: 'Backpropagation',
      summary:
        'Efficient derivative propagation through the computational graph.',
      prerequisiteConceptIds: ['computational-graph', 'gradient'],
      relatedConceptIds: ['automatic-differentiation'],
      tags: ['deep-learning'],
    },
    {
      id: 'automatic-differentiation',
      title: 'Automatic differentiation',
      summary:
        'Software machinery that computes gradients from recorded operations.',
      prerequisiteConceptIds: ['backpropagation'],
      relatedConceptIds: ['optimization-step'],
      tags: ['deep-learning'],
    },
    {
      id: 'representation-learning',
      title: 'Representation learning',
      summary: 'Learning useful internal numeric representations from data.',
      prerequisiteConceptIds: ['hidden-representation', 'neural-network'],
      relatedConceptIds: ['generalization'],
      tags: ['deep-learning'],
    },
  ],
  objectives: [
    {
      id: 'trace-learning-loop',
      conceptIds: [
        'learning-problem',
        'dataset',
        'model',
        'prediction',
        'loss',
        'gradient-descent',
        'generalization',
      ],
      statement:
        'Trace one supervised-learning iteration from represented data through prediction, loss, gradient update, and evaluation.',
      successCriteria: [
        'Orders data, model, prediction, loss, optimization, and evaluation in the correct loop.',
      ],
    },
    {
      id: 'frame-prediction-problem',
      conceptIds: ['learning-problem', 'example', 'feature', 'target'],
      statement:
        'Frame a prediction problem by naming examples, features, target, and evaluation intent.',
      successCriteria: [
        'Identifies at least one valid example unit, two candidate features, one target, and a checkable evaluation goal.',
      ],
    },
    {
      id: 'distinguish-parameters-hyperparameters',
      conceptIds: ['parameter', 'hyperparameter', 'weight', 'learning-rate'],
      statement:
        'Separate learned parameters from configured hyperparameters in a training setup.',
      successCriteria: [
        'Classifies weights or bias as learned parameters and learning rate as a configured hyperparameter.',
      ],
    },
    {
      id: 'distinguish-training-inference',
      conceptIds: ['training', 'inference', 'optimization-step'],
      statement:
        'Distinguish training-time parameter updates from inference-time prediction.',
      successCriteria: [
        'States that serving predictions should not run optimizer updates by default.',
      ],
    },
    {
      id: 'calculate-linear-prediction',
      conceptIds: ['linear-model', 'weight', 'bias', 'prediction'],
      statement:
        'Calculate the output of a one-feature linear model from supplied values.',
      successCriteria: ['Computes y_hat = w*x + b exactly for small integers.'],
    },
    {
      id: 'explain-weight-and-bias',
      conceptIds: ['weight', 'bias', 'weighted-sum'],
      statement:
        'Explain how changing a weight or bias changes a linear prediction.',
      successCriteria: [
        'Identifies whether the output changes by a scaled feature contribution or by a constant offset.',
      ],
    },
    {
      id: 'calculate-residual',
      conceptIds: ['prediction', 'target', 'residual'],
      statement:
        'Calculate a residual using the convention prediction minus target.',
      successCriteria: ['Applies the signed residual convention consistently.'],
    },
    {
      id: 'calculate-mse',
      conceptIds: ['mean-squared-error', 'loss', 'residual'],
      statement:
        'Calculate mean squared error for a tiny set of predictions and targets.',
      successCriteria: [
        'Squares each error, sums the squared errors, and divides by the example count.',
      ],
    },
    {
      id: 'apply-gradient-update',
      conceptIds: ['gradient', 'gradient-descent', 'learning-rate'],
      statement:
        'Apply one gradient-descent update from a supplied gradient and learning rate.',
      successCriteria: [
        'Uses theta_new = theta_old - eta * grad L with the supplied numbers.',
      ],
    },
    {
      id: 'diagnose-optimization-behavior',
      conceptIds: ['learning-rate', 'gradient-descent', 'loss'],
      statement:
        'Diagnose an optimization run whose loss oscillates or diverges.',
      successCriteria: [
        'Connects the observed pattern to an excessively large update size when the evidence supports it.',
      ],
    },
    {
      id: 'distinguish-batches-epochs',
      conceptIds: ['batch', 'epoch', 'optimization-step'],
      statement:
        'Distinguish a batch update from one full pass through the training data.',
      successCriteria: [
        'Classifies batch as update subset and epoch as full training-set pass.',
      ],
    },
    {
      id: 'distinguish-classification-outputs',
      conceptIds: ['logit', 'sigmoid', 'probability', 'decision-threshold'],
      statement:
        'Distinguish logits, probabilities, and thresholded class predictions.',
      successCriteria: [
        'Identifies the raw score, converted probability, and cutoff decision as separate values.',
      ],
    },
    {
      id: 'reason-about-thresholds',
      conceptIds: ['decision-threshold', 'precision', 'recall'],
      statement:
        'Predict how changing a decision threshold changes positive predictions and possible metric tradeoffs.',
      successCriteria: [
        'States that lowering the threshold creates more positive predictions and may raise recall while lowering precision.',
      ],
    },
    {
      id: 'diagnose-generalization-patterns',
      conceptIds: [
        'generalization',
        'training-error',
        'validation-error',
        'underfitting',
        'overfitting',
      ],
      statement:
        'Diagnose underfitting or overfitting from training and validation behavior.',
      successCriteria: [
        'Maps poor train plus poor validation to underfitting, and improving train plus worsening validation to overfitting.',
      ],
    },
    {
      id: 'identify-data-leakage',
      conceptIds: ['data-leakage', 'training-set', 'validation-set'],
      statement:
        'Identify a feature that leaks post-outcome information into training or evaluation.',
      successCriteria: [
        'Rejects features unavailable at prediction time or derived after the target occurred.',
      ],
    },
    {
      id: 'select-evaluation-metric',
      conceptIds: ['baseline', 'accuracy', 'precision', 'recall'],
      statement:
        'Select an evaluation metric based on the cost of false positives and false negatives.',
      successCriteria: [
        'Chooses recall when missing positive cases is the dominant cost and explains why accuracy alone can mislead.',
      ],
    },
    {
      id: 'trace-computational-graph',
      conceptIds: ['computational-graph', 'forward-pass', 'backpropagation'],
      statement:
        'Trace dependencies through a small computational graph from inputs to loss and gradients.',
      successCriteria: [
        'Names which values feed predictions, which values feed loss, and which dependencies gradients follow.',
      ],
    },
    {
      id: 'map-loop-to-neural-networks',
      conceptIds: [
        'neural-network',
        'activation-function',
        'automatic-differentiation',
        'representation-learning',
      ],
      statement:
        'Map data, parameters, prediction, loss, optimizer, and evaluation from a linear model onto a neural network.',
      successCriteria: [
        'Explains that neural networks preserve the learning loop while adding composed differentiable functions and hidden representations.',
      ],
    },
  ],
  activities: [
    {
      id: 'orient-learning-loop',
      moduleId: 'the-learning-system',
      conceptIds: [
        'learning-problem',
        'dataset',
        'model',
        'prediction',
        'loss',
        'training',
        'generalization',
      ],
      objectiveIds: ['trace-learning-loop'],
      title: 'Orient to the learning loop',
      kind: 'orient',
      scaffoldLevel: 'worked',
      blocks: [
        {
          kind: 'text',
          body: 'A machine-learning system starts with examples. The model predicts from represented inputs, loss measures prediction error, optimization updates parameters, and evaluation checks behavior on data not used for the update.',
        },
        {
          kind: 'comparison',
          items: [
            {
              label: 'Training',
              body: 'Use data, loss, and gradients to change parameters.',
            },
            {
              label: 'Inference',
              body: 'Use the trained parameters to produce predictions.',
            },
          ],
        },
      ],
      evaluation: { kind: 'manual-completion' },
      completionPolicy: { kind: 'manual' },
      nextActivityIds: ['predict-serving-update'],
    },
    {
      id: 'predict-serving-update',
      moduleId: 'the-learning-system',
      conceptIds: ['training', 'inference', 'optimization-step'],
      objectiveIds: ['distinguish-training-inference'],
      title: 'Predict serving behavior',
      kind: 'predict',
      scaffoldLevel: 'guided',
      blocks: [
        {
          kind: 'question',
          prompt:
            'A trained boss-clear model is serving predictions to players. What should happen for a normal prediction request?',
          supportingText:
            'Assume this is inference, not a scheduled retraining job.',
        },
      ],
      response: {
        kind: 'single-choice',
        options: [
          {
            id: 'option-inference-no-update',
            label:
              'Use current parameters to predict without an optimizer update.',
          },
          {
            id: 'option-update-weights',
            label: 'Update the weights from this one request before answering.',
          },
          {
            id: 'option-relabel-target',
            label: 'Change the target label because the player asked.',
          },
        ],
      },
      evaluation: {
        kind: 'choice-selection',
        correctOptionIds: ['option-inference-no-update'],
      },
      completionPolicy: { kind: 'passing-evaluation' },
      nextActivityIds: ['classify-system-parts'],
    },
    {
      id: 'classify-system-parts',
      moduleId: 'the-learning-system',
      conceptIds: ['example', 'feature', 'target', 'hyperparameter'],
      objectiveIds: [
        'frame-prediction-problem',
        'distinguish-parameters-hyperparameters',
      ],
      title: 'Classify system parts',
      kind: 'recall',
      scaffoldLevel: 'guided',
      blocks: [
        {
          kind: 'question',
          prompt:
            'For a boss-clear classifier, which two values are input features rather than the target or a training setting?',
        },
      ],
      response: {
        kind: 'multiple-choice',
        options: [
          { id: 'option-practice-minutes', label: 'practice_minutes' },
          { id: 'option-gear-score', label: 'gear_score' },
          { id: 'option-cleared-boss', label: 'cleared_boss' },
          { id: 'option-learning-rate', label: 'learning_rate' },
        ],
        minimumSelections: 2,
        maximumSelections: 2,
      },
      evaluation: {
        kind: 'choice-selection',
        correctOptionIds: ['option-practice-minutes', 'option-gear-score'],
      },
      completionPolicy: { kind: 'passing-evaluation' },
      nextActivityIds: ['debug-vague-ml-task'],
    },
    {
      id: 'debug-vague-ml-task',
      moduleId: 'the-learning-system',
      conceptIds: ['learning-problem', 'example', 'feature', 'target'],
      objectiveIds: ['frame-prediction-problem'],
      title: 'Debug a vague ML task',
      kind: 'debug',
      scaffoldLevel: 'completion',
      blocks: [
        {
          kind: 'question',
          prompt:
            'A teammate proposes: "Build ML that improves player skill." What is missing before this is a specified supervised-learning problem?',
        },
      ],
      response: {
        kind: 'multiple-choice',
        options: [
          { id: 'option-example-unit', label: 'A clear example unit.' },
          { id: 'option-target', label: 'A target to predict.' },
          { id: 'option-evaluation', label: 'A way to evaluate predictions.' },
          {
            id: 'option-transformer',
            label: 'A transformer architecture before any target is named.',
          },
        ],
        minimumSelections: 3,
        maximumSelections: 3,
      },
      evaluation: {
        kind: 'choice-selection',
        correctOptionIds: [
          'option-example-unit',
          'option-target',
          'option-evaluation',
        ],
      },
      completionPolicy: { kind: 'passing-evaluation' },
      nextActivityIds: ['transfer-build-risk-frame'],
    },
    {
      id: 'transfer-build-risk-frame',
      moduleId: 'the-learning-system',
      conceptIds: ['learning-problem', 'feature', 'target', 'dataset'],
      objectiveIds: ['frame-prediction-problem'],
      title: 'Transfer to build-risk framing',
      kind: 'transfer',
      scaffoldLevel: 'transfer',
      blocks: [
        {
          kind: 'question',
          prompt:
            'Frame a software build-risk model. Name the example unit, two features, the target, and one evaluation check.',
        },
      ],
      response: {
        kind: 'text',
        multiline: true,
        minimumLength: 40,
      },
      evaluation: {
        kind: 'rubric-assisted-text',
        criteria: [
          {
            id: 'names-example-unit',
            description:
              'Names one build, pull request, or release as the example unit.',
            required: true,
          },
          {
            id: 'names-features',
            description: 'Names at least two available input features.',
            required: true,
          },
          {
            id: 'names-target-evaluation',
            description: 'Names a prediction target and an evaluation check.',
            required: true,
          },
        ],
      },
      completionPolicy: { kind: 'submission' },
      nextActivityIds: ['orient-linear-prediction'],
    },
    {
      id: 'orient-linear-prediction',
      moduleId: 'linear-models-as-functions',
      conceptIds: ['linear-model', 'weight', 'bias', 'prediction'],
      objectiveIds: ['calculate-linear-prediction', 'explain-weight-and-bias'],
      title: 'Orient to linear prediction',
      kind: 'orient',
      scaffoldLevel: 'worked',
      blocks: [
        {
          kind: 'equation',
          expression: 'y_hat = w*x + b',
          description:
            'Prediction equals weight times feature value plus bias.',
        },
        {
          kind: 'text',
          body: 'If x is practice hours, w controls how strongly practice changes the prediction. The bias b shifts the prediction even when x is zero.',
        },
      ],
      evaluation: { kind: 'manual-completion' },
      completionPolicy: { kind: 'manual' },
      nextActivityIds: ['calculate-linear-prediction'],
    },
    {
      id: 'calculate-linear-prediction',
      moduleId: 'linear-models-as-functions',
      conceptIds: ['linear-model', 'weight', 'bias', 'prediction'],
      objectiveIds: ['calculate-linear-prediction'],
      title: 'Calculate a linear prediction',
      kind: 'predict',
      scaffoldLevel: 'completion',
      blocks: [
        {
          kind: 'question',
          prompt:
            'Use y_hat = w*x + b. If x = 3, w = 2, and b = 1, what is y_hat?',
        },
      ],
      response: { kind: 'number', step: 0.1 },
      evaluation: {
        kind: 'numerical-tolerance',
        expected: 7,
        absoluteTolerance: 0,
      },
      completionPolicy: { kind: 'passing-evaluation' },
      nextActivityIds: ['predict-weight-change'],
    },
    {
      id: 'predict-weight-change',
      moduleId: 'linear-models-as-functions',
      conceptIds: ['weight', 'weighted-sum', 'prediction'],
      objectiveIds: ['explain-weight-and-bias'],
      title: 'Predict a weight change',
      kind: 'predict',
      scaffoldLevel: 'guided',
      blocks: [
        {
          kind: 'question',
          prompt:
            'With x = 3 and b unchanged, w increases from 2 to 3. How does the prediction change?',
        },
      ],
      response: {
        kind: 'single-choice',
        options: [
          { id: 'option-increases-three', label: 'It increases by 3.' },
          { id: 'option-increases-one', label: 'It increases by 1.' },
          { id: 'option-unchanged', label: 'It does not change.' },
        ],
      },
      evaluation: {
        kind: 'choice-selection',
        correctOptionIds: ['option-increases-three'],
      },
      completionPolicy: { kind: 'passing-evaluation' },
      nextActivityIds: ['calculate-residual'],
    },
    {
      id: 'calculate-residual',
      moduleId: 'linear-models-as-functions',
      conceptIds: ['prediction', 'target', 'residual'],
      objectiveIds: ['calculate-residual'],
      title: 'Calculate a residual',
      kind: 'recall',
      scaffoldLevel: 'completion',
      blocks: [
        {
          kind: 'question',
          prompt:
            'This subject uses residual = prediction - target. If prediction = 7 and target = 9, what is the residual?',
        },
      ],
      response: { kind: 'number', step: 0.1 },
      evaluation: {
        kind: 'numerical-tolerance',
        expected: -2,
        absoluteTolerance: 0,
      },
      completionPolicy: { kind: 'passing-evaluation' },
      nextActivityIds: ['transfer-jump-linear-model'],
    },
    {
      id: 'transfer-jump-linear-model',
      moduleId: 'linear-models-as-functions',
      conceptIds: ['linear-model', 'feature', 'prediction', 'residual'],
      objectiveIds: [
        'calculate-linear-prediction',
        'explain-weight-and-bias',
        'calculate-residual',
      ],
      title: 'Transfer to jump-height prediction',
      kind: 'transfer',
      scaffoldLevel: 'transfer',
      blocks: [
        {
          kind: 'question',
          prompt:
            'A tiny model predicts jump height from training sessions: y_hat = 1.5*x + 10. Explain what x, 1.5, 10, y_hat, and a residual mean in this technical example.',
        },
      ],
      response: {
        kind: 'text',
        multiline: true,
        minimumLength: 50,
      },
      evaluation: {
        kind: 'rubric-assisted-text',
        criteria: [
          {
            id: 'maps-symbols',
            description: 'Maps x, weight, bias, and y_hat to the example.',
            required: true,
          },
          {
            id: 'explains-residual',
            description:
              'Explains residual as prediction minus measured target.',
            required: true,
          },
        ],
      },
      completionPolicy: { kind: 'submission' },
      nextActivityIds: ['orient-loss-and-gradient'],
    },
    {
      id: 'orient-loss-and-gradient',
      moduleId: 'loss-gradients-and-optimization',
      conceptIds: [
        'loss',
        'mean-squared-error',
        'gradient',
        'gradient-descent',
        'learning-rate',
      ],
      objectiveIds: ['calculate-mse', 'apply-gradient-update'],
      title: 'Orient to loss and gradients',
      kind: 'orient',
      scaffoldLevel: 'worked',
      blocks: [
        {
          kind: 'equation',
          expression: 'MSE = (1 / n) * sum((y_hat_i - y_i)^2)',
          description: 'Mean squared error averages squared prediction errors.',
        },
        {
          kind: 'equation',
          expression: 'theta_new = theta_old - eta * grad L(theta)',
          description:
            'Gradient descent moves parameters opposite the loss gradient.',
        },
        {
          kind: 'callout',
          purpose: 'mental-model',
          title: 'Derivative first',
          body: 'At this level, read derivative as local sensitivity. Later math subjects deepen the formal calculus.',
        },
      ],
      evaluation: { kind: 'manual-completion' },
      completionPolicy: { kind: 'manual' },
      nextActivityIds: ['calculate-mse'],
    },
    {
      id: 'calculate-mse',
      moduleId: 'loss-gradients-and-optimization',
      conceptIds: ['mean-squared-error', 'loss', 'residual'],
      objectiveIds: ['calculate-mse'],
      title: 'Calculate mean squared error',
      kind: 'complete',
      scaffoldLevel: 'completion',
      blocks: [
        {
          kind: 'question',
          prompt:
            'Predictions are [2, 4] and targets are [3, 3]. The squared errors are [1, 1]. What is the MSE?',
        },
      ],
      response: { kind: 'number', step: 0.1 },
      evaluation: {
        kind: 'numerical-tolerance',
        expected: 1,
        absoluteTolerance: 0,
      },
      completionPolicy: { kind: 'passing-evaluation' },
      nextActivityIds: ['choose-gradient-direction'],
    },
    {
      id: 'choose-gradient-direction',
      moduleId: 'loss-gradients-and-optimization',
      conceptIds: ['gradient', 'gradient-descent'],
      objectiveIds: ['apply-gradient-update'],
      title: 'Choose the update direction',
      kind: 'predict',
      scaffoldLevel: 'guided',
      blocks: [
        {
          kind: 'question',
          prompt:
            'If grad L(theta) is positive and gradient descent uses theta_new = theta_old - eta * grad L(theta), which direction does theta move?',
        },
      ],
      response: {
        kind: 'single-choice',
        options: [
          { id: 'option-decrease-theta', label: 'theta decreases.' },
          { id: 'option-increase-theta', label: 'theta increases.' },
          { id: 'option-no-change', label: 'theta cannot change.' },
        ],
      },
      evaluation: {
        kind: 'choice-selection',
        correctOptionIds: ['option-decrease-theta'],
      },
      completionPolicy: { kind: 'passing-evaluation' },
      nextActivityIds: ['apply-gradient-step'],
    },
    {
      id: 'apply-gradient-step',
      moduleId: 'loss-gradients-and-optimization',
      conceptIds: ['gradient', 'gradient-descent', 'learning-rate'],
      objectiveIds: ['apply-gradient-update'],
      title: 'Apply one gradient step',
      kind: 'complete',
      scaffoldLevel: 'completion',
      blocks: [
        {
          kind: 'question',
          prompt:
            'theta = 2, gradient = 3, and learning rate eta = 0.1. Using theta_new = theta - eta*gradient, what is theta_new?',
        },
      ],
      response: { kind: 'number', step: 0.1 },
      evaluation: {
        kind: 'numerical-tolerance',
        expected: 1.7,
        absoluteTolerance: 0.0001,
      },
      completionPolicy: { kind: 'passing-evaluation' },
      nextActivityIds: ['diagnose-large-learning-rate'],
    },
    {
      id: 'diagnose-large-learning-rate',
      moduleId: 'loss-gradients-and-optimization',
      conceptIds: ['learning-rate', 'gradient-descent', 'loss'],
      objectiveIds: ['diagnose-optimization-behavior'],
      title: 'Diagnose a large learning rate',
      kind: 'debug',
      scaffoldLevel: 'guided',
      blocks: [
        {
          kind: 'question',
          prompt:
            'Training loss jumps up and down, sometimes becoming larger after an update. Other code is unchanged. Which diagnosis best fits?',
        },
      ],
      response: {
        kind: 'single-choice',
        options: [
          {
            id: 'option-learning-rate-too-large',
            label: 'The learning rate may be too large.',
          },
          {
            id: 'option-inference-mode',
            label: 'The model is definitely in inference mode.',
          },
          {
            id: 'option-no-loss-needed',
            label: 'The system no longer needs a loss function.',
          },
        ],
      },
      evaluation: {
        kind: 'choice-selection',
        correctOptionIds: ['option-learning-rate-too-large'],
      },
      completionPolicy: { kind: 'passing-evaluation' },
      nextActivityIds: ['debug-training-loop-order'],
    },
    {
      id: 'debug-training-loop-order',
      moduleId: 'loss-gradients-and-optimization',
      conceptIds: ['optimization-step', 'gradient', 'batch'],
      objectiveIds: ['diagnose-optimization-behavior'],
      title: 'Debug training-loop order',
      kind: 'debug',
      scaffoldLevel: 'independent',
      blocks: [
        {
          kind: 'code',
          language: 'python',
          caption: 'Broken training loop',
          highlightedLines: [4, 5],
          source:
            'for batch in training_data:\n    predictions = model(batch.features)\n    loss = loss_function(predictions, batch.targets)\n    optimizer.step()\n    loss.backward()',
        },
        {
          kind: 'question',
          prompt: 'What is the main ordering bug?',
        },
      ],
      response: {
        kind: 'single-choice',
        options: [
          {
            id: 'option-step-before-backward',
            label:
              'optimizer.step runs before loss.backward computes gradients.',
          },
          {
            id: 'option-no-features',
            label: 'The model should never receive features.',
          },
          {
            id: 'option-loss-after-step',
            label: 'The loss must be calculated after optimizer.step.',
          },
        ],
      },
      evaluation: {
        kind: 'choice-selection',
        correctOptionIds: ['option-step-before-backward'],
      },
      completionPolicy: { kind: 'passing-evaluation' },
      nextActivityIds: ['recall-batch-epoch'],
    },
    {
      id: 'recall-batch-epoch',
      moduleId: 'loss-gradients-and-optimization',
      conceptIds: ['batch', 'epoch', 'optimization-step'],
      objectiveIds: ['distinguish-batches-epochs'],
      title: 'Recall batch and epoch',
      kind: 'recall',
      scaffoldLevel: 'guided',
      blocks: [
        {
          kind: 'question',
          prompt: 'Which statements are correct?',
        },
      ],
      response: {
        kind: 'multiple-choice',
        options: [
          {
            id: 'option-batch-subset',
            label: 'A batch is a subset of examples used for an update.',
          },
          {
            id: 'option-epoch-pass',
            label: 'An epoch is one pass through the training dataset.',
          },
          {
            id: 'option-batch-target',
            label: 'A batch is the target label.',
          },
          {
            id: 'option-epoch-parameter',
            label: 'An epoch is a learned parameter.',
          },
        ],
        minimumSelections: 2,
        maximumSelections: 2,
      },
      evaluation: {
        kind: 'choice-selection',
        correctOptionIds: ['option-batch-subset', 'option-epoch-pass'],
      },
      completionPolicy: { kind: 'passing-evaluation' },
      nextActivityIds: ['orient-classification-scores'],
    },
    {
      id: 'orient-classification-scores',
      moduleId: 'classification-scores-and-probability',
      conceptIds: [
        'binary-classification',
        'logit',
        'sigmoid',
        'probability',
        'decision-threshold',
      ],
      objectiveIds: ['distinguish-classification-outputs'],
      title: 'Orient to scores and thresholds',
      kind: 'orient',
      scaffoldLevel: 'worked',
      blocks: [
        {
          kind: 'equation',
          expression: 'p = sigmoid(z)',
          description:
            'A sigmoid maps logit z to a probability-like value p between 0 and 1.',
        },
        {
          kind: 'comparison',
          items: [
            { label: 'Logit', body: 'Raw score before sigmoid.' },
            {
              label: 'Probability',
              body: 'Number between 0 and 1 after sigmoid.',
            },
            {
              label: 'Class',
              body: 'Decision after comparing probability with a threshold.',
            },
          ],
        },
      ],
      evaluation: { kind: 'manual-completion' },
      completionPolicy: { kind: 'manual' },
      nextActivityIds: ['predict-positive-logit'],
    },
    {
      id: 'predict-positive-logit',
      moduleId: 'classification-scores-and-probability',
      conceptIds: ['logit', 'sigmoid', 'probability'],
      objectiveIds: ['distinguish-classification-outputs'],
      title: 'Predict a positive logit',
      kind: 'predict',
      scaffoldLevel: 'guided',
      blocks: [
        {
          kind: 'question',
          prompt:
            'A binary classifier outputs a positive logit z. Before calibration questions, what is true about sigmoid(z)?',
        },
      ],
      response: {
        kind: 'single-choice',
        options: [
          { id: 'option-above-half', label: 'It is above 0.5.' },
          { id: 'option-below-half', label: 'It is below 0.5.' },
          { id: 'option-always-one', label: 'It is always exactly 1.' },
        ],
      },
      evaluation: {
        kind: 'choice-selection',
        correctOptionIds: ['option-above-half'],
      },
      completionPolicy: { kind: 'passing-evaluation' },
      nextActivityIds: ['predict-threshold-lowering'],
    },
    {
      id: 'predict-threshold-lowering',
      moduleId: 'classification-scores-and-probability',
      conceptIds: ['decision-threshold', 'precision', 'recall'],
      objectiveIds: ['reason-about-thresholds'],
      title: 'Predict a threshold change',
      kind: 'predict',
      scaffoldLevel: 'guided',
      blocks: [
        {
          kind: 'question',
          prompt:
            'A clear-boss classifier lowers its positive threshold from 0.7 to 0.4. What usually changes first?',
        },
      ],
      response: {
        kind: 'single-choice',
        options: [
          {
            id: 'option-more-positives',
            label:
              'More examples are predicted positive; recall can rise and precision can fall.',
          },
          {
            id: 'option-retrain-weights',
            label:
              'The model must retrain its weights before any prediction changes.',
          },
          {
            id: 'option-fewer-positives',
            label: 'Fewer examples are predicted positive by definition.',
          },
        ],
      },
      evaluation: {
        kind: 'choice-selection',
        correctOptionIds: ['option-more-positives'],
      },
      completionPolicy: { kind: 'passing-evaluation' },
      nextActivityIds: ['debug-probability-confusion'],
    },
    {
      id: 'debug-probability-confusion',
      moduleId: 'classification-scores-and-probability',
      conceptIds: ['probability', 'decision-threshold'],
      objectiveIds: ['distinguish-classification-outputs'],
      title: 'Debug probability confusion',
      kind: 'debug',
      scaffoldLevel: 'independent',
      blocks: [
        {
          kind: 'question',
          prompt:
            'A dashboard says: "The model predicted 0.8, so this player is guaranteed to clear." What is wrong?',
        },
      ],
      response: {
        kind: 'single-choice',
        options: [
          {
            id: 'option-not-proof',
            label:
              '0.8 is a model probability output, not proof that the event will occur.',
          },
          {
            id: 'option-threshold-learned',
            label: 'A threshold is always a learned model parameter.',
          },
          {
            id: 'option-logit-class',
            label: 'A logit and final class are identical.',
          },
        ],
      },
      evaluation: {
        kind: 'choice-selection',
        correctOptionIds: ['option-not-proof'],
      },
      completionPolicy: { kind: 'passing-evaluation' },
      nextActivityIds: ['explain-bce-penalty'],
    },
    {
      id: 'explain-bce-penalty',
      moduleId: 'classification-scores-and-probability',
      conceptIds: ['binary-cross-entropy', 'probability', 'positive-class'],
      objectiveIds: ['distinguish-classification-outputs'],
      title: 'Explain a confident wrong penalty',
      kind: 'explain',
      scaffoldLevel: 'guided',
      blocks: [
        {
          kind: 'question',
          prompt:
            'In binary classification, explain why predicting p = 0.99 for the positive class is punished strongly when the true class is negative.',
        },
      ],
      response: {
        kind: 'text',
        multiline: true,
        minimumLength: 35,
      },
      evaluation: {
        kind: 'rubric-assisted-text',
        criteria: [
          {
            id: 'mentions-confident-wrong',
            description: 'Mentions that the prediction is confidently wrong.',
            required: true,
          },
          {
            id: 'connects-loss',
            description:
              'Connects the penalty to classification loss rather than a final metric.',
            required: true,
          },
        ],
      },
      completionPolicy: { kind: 'submission' },
      nextActivityIds: ['orient-generalization'],
    },
    {
      id: 'orient-generalization',
      moduleId: 'generalization-and-evaluation',
      conceptIds: [
        'training-set',
        'validation-set',
        'test-set',
        'generalization',
        'baseline',
      ],
      objectiveIds: ['diagnose-generalization-patterns'],
      title: 'Orient to generalization',
      kind: 'orient',
      scaffoldLevel: 'worked',
      blocks: [
        {
          kind: 'comparison',
          items: [
            { label: 'Training set', body: 'Fits parameters.' },
            { label: 'Validation set', body: 'Guides development choices.' },
            { label: 'Test set', body: 'Reserved for final evaluation.' },
          ],
        },
        {
          kind: 'callout',
          purpose: 'misconception',
          title: 'Low training loss is not the goal',
          body: 'The useful question is whether the model performs well on relevant unseen examples and beats a simple baseline.',
        },
      ],
      evaluation: { kind: 'manual-completion' },
      completionPolicy: { kind: 'manual' },
      nextActivityIds: ['diagnose-overfitting'],
    },
    {
      id: 'diagnose-overfitting',
      moduleId: 'generalization-and-evaluation',
      conceptIds: ['training-error', 'validation-error', 'overfitting'],
      objectiveIds: ['diagnose-generalization-patterns'],
      title: 'Diagnose overfitting',
      kind: 'debug',
      scaffoldLevel: 'guided',
      blocks: [
        {
          kind: 'question',
          prompt:
            'Training error keeps falling, but validation error starts rising. Which diagnosis best fits?',
        },
      ],
      response: {
        kind: 'single-choice',
        options: [
          { id: 'option-overfitting', label: 'Overfitting.' },
          { id: 'option-underfitting', label: 'Underfitting.' },
          { id: 'option-inference-only', label: 'Inference without training.' },
        ],
      },
      evaluation: {
        kind: 'choice-selection',
        correctOptionIds: ['option-overfitting'],
      },
      completionPolicy: { kind: 'passing-evaluation' },
      nextActivityIds: ['diagnose-underfitting'],
    },
    {
      id: 'diagnose-underfitting',
      moduleId: 'generalization-and-evaluation',
      conceptIds: ['training-error', 'validation-error', 'underfitting'],
      objectiveIds: ['diagnose-generalization-patterns'],
      title: 'Diagnose underfitting',
      kind: 'debug',
      scaffoldLevel: 'guided',
      blocks: [
        {
          kind: 'question',
          prompt:
            'Training error and validation error both stay high after reasonable training. Which diagnosis best fits?',
        },
      ],
      response: {
        kind: 'single-choice',
        options: [
          { id: 'option-underfitting', label: 'Underfitting.' },
          { id: 'option-overfitting', label: 'Overfitting.' },
          { id: 'option-perfect-fit', label: 'The model is already perfect.' },
        ],
      },
      evaluation: {
        kind: 'choice-selection',
        correctOptionIds: ['option-underfitting'],
      },
      completionPolicy: { kind: 'passing-evaluation' },
      nextActivityIds: ['identify-leakage'],
    },
    {
      id: 'identify-leakage',
      moduleId: 'generalization-and-evaluation',
      conceptIds: ['data-leakage', 'feature', 'target'],
      objectiveIds: ['identify-data-leakage'],
      title: 'Identify leakage',
      kind: 'debug',
      scaffoldLevel: 'independent',
      blocks: [
        {
          kind: 'question',
          prompt:
            'A clear-boss classifier uses "reward_claimed_after_attempt" as a training feature. The feature is only created after the outcome. What is the issue?',
        },
      ],
      response: {
        kind: 'single-choice',
        options: [
          {
            id: 'option-leakage',
            label:
              'It leaks post-outcome information unavailable at prediction time.',
          },
          {
            id: 'option-good-feature',
            label: 'It is always a safe pre-attempt feature.',
          },
          {
            id: 'option-hyperparameter',
            label: 'It is just a hyperparameter.',
          },
        ],
      },
      evaluation: {
        kind: 'choice-selection',
        correctOptionIds: ['option-leakage'],
      },
      completionPolicy: { kind: 'passing-evaluation' },
      nextActivityIds: ['select-recall-metric'],
    },
    {
      id: 'select-recall-metric',
      moduleId: 'generalization-and-evaluation',
      conceptIds: ['accuracy', 'precision', 'recall', 'metric-selection'],
      objectiveIds: ['select-evaluation-metric'],
      title: 'Select a metric for missed positives',
      kind: 'predict',
      scaffoldLevel: 'guided',
      blocks: [
        {
          kind: 'question',
          prompt:
            'A moderation model should catch as many truly unsafe cases as possible for review. Missing a positive is costlier than sending extra cases to review. Which metric deserves special attention?',
        },
      ],
      response: {
        kind: 'single-choice',
        options: [
          { id: 'option-recall', label: 'Recall.' },
          { id: 'option-accuracy-only', label: 'Accuracy only.' },
          { id: 'option-training-loss', label: 'Training loss only.' },
        ],
      },
      evaluation: {
        kind: 'choice-selection',
        correctOptionIds: ['option-recall'],
      },
      completionPolicy: { kind: 'passing-evaluation' },
      nextActivityIds: ['transfer-evaluation-plan'],
    },
    {
      id: 'transfer-evaluation-plan',
      moduleId: 'generalization-and-evaluation',
      conceptIds: [
        'baseline',
        'validation-set',
        'test-set',
        'metric-selection',
        'data-leakage',
      ],
      objectiveIds: ['select-evaluation-metric', 'identify-data-leakage'],
      title: 'Transfer to an evaluation plan',
      kind: 'transfer',
      scaffoldLevel: 'transfer',
      blocks: [
        {
          kind: 'question',
          prompt:
            'Propose an evaluation plan for the boss-clear model. Include a baseline, validation/test separation, one metric choice, and one leakage check.',
        },
      ],
      response: {
        kind: 'text',
        multiline: true,
        minimumLength: 70,
      },
      evaluation: {
        kind: 'rubric-assisted-text',
        criteria: [
          {
            id: 'includes-baseline',
            description: 'Includes a simple baseline comparison.',
            required: true,
          },
          {
            id: 'separates-splits',
            description: 'Separates validation from final test use.',
            required: true,
          },
          {
            id: 'includes-metric-leakage',
            description: 'Names a metric and a leakage check.',
            required: true,
          },
        ],
      },
      completionPolicy: { kind: 'submission' },
      nextActivityIds: ['orient-deep-learning-bridge'],
    },
    {
      id: 'orient-deep-learning-bridge',
      moduleId: 'bridge-to-deep-learning',
      conceptIds: [
        'function-composition',
        'activation-function',
        'neural-network',
        'computational-graph',
        'backpropagation',
      ],
      objectiveIds: ['map-loop-to-neural-networks'],
      title: 'Orient to the deep-learning bridge',
      kind: 'orient',
      scaffoldLevel: 'worked',
      blocks: [
        {
          kind: 'text',
          body: 'A neural network is still a parameterized model. It composes many operations, produces predictions, computes loss, propagates gradients through dependencies, updates parameters, and requires evaluation.',
        },
        {
          kind: 'callout',
          purpose: 'connection',
          title: 'Bridge to transformers',
          body: 'A transformer is a more complex differentiable model. The training loop still needs data, predictions, an objective, gradients, updates, and evaluation.',
        },
      ],
      evaluation: { kind: 'manual-completion' },
      completionPolicy: { kind: 'manual' },
      nextActivityIds: ['predict-stacked-linear-functions'],
    },
    {
      id: 'predict-stacked-linear-functions',
      moduleId: 'bridge-to-deep-learning',
      conceptIds: ['function-composition', 'linear-model', 'nonlinearity'],
      objectiveIds: ['map-loop-to-neural-networks'],
      title: 'Predict stacked linear functions',
      kind: 'predict',
      scaffoldLevel: 'guided',
      blocks: [
        {
          kind: 'question',
          prompt:
            'If you stack only linear functions with no nonlinear activation between them, what kind of function is the stack still equivalent to?',
        },
      ],
      response: {
        kind: 'single-choice',
        options: [
          { id: 'option-still-linear', label: 'A linear function.' },
          { id: 'option-transformer', label: 'A transformer by definition.' },
          { id: 'option-random-forest', label: 'A random forest.' },
        ],
      },
      evaluation: {
        kind: 'choice-selection',
        correctOptionIds: ['option-still-linear'],
      },
      completionPolicy: { kind: 'passing-evaluation' },
      nextActivityIds: ['trace-computational-graph'],
    },
    {
      id: 'trace-computational-graph',
      moduleId: 'bridge-to-deep-learning',
      conceptIds: ['computational-graph', 'forward-pass', 'backpropagation'],
      objectiveIds: ['trace-computational-graph'],
      title: 'Trace a computational graph',
      kind: 'recall',
      scaffoldLevel: 'guided',
      blocks: [
        {
          kind: 'question',
          prompt:
            'For z = w*x + b and L = loss(z, y), which dependency statements are correct?',
        },
      ],
      response: {
        kind: 'multiple-choice',
        options: [
          { id: 'option-z-depends', label: 'z depends on w, x, and b.' },
          { id: 'option-loss-depends', label: 'L depends on z and y.' },
          {
            id: 'option-target-updated',
            label: 'Backpropagation updates the target y.',
          },
          {
            id: 'option-no-graph',
            label: 'Gradients do not need operation dependencies.',
          },
        ],
        minimumSelections: 2,
        maximumSelections: 2,
      },
      evaluation: {
        kind: 'choice-selection',
        correctOptionIds: ['option-z-depends', 'option-loss-depends'],
      },
      completionPolicy: { kind: 'passing-evaluation' },
      nextActivityIds: ['explain-autograd-training-code'],
    },
    {
      id: 'explain-autograd-training-code',
      moduleId: 'bridge-to-deep-learning',
      conceptIds: [
        'forward-pass',
        'backpropagation',
        'automatic-differentiation',
        'optimization-step',
      ],
      objectiveIds: [
        'trace-computational-graph',
        'map-loop-to-neural-networks',
      ],
      title: 'Explain autograd training code',
      kind: 'explain',
      scaffoldLevel: 'independent',
      blocks: [
        {
          kind: 'code',
          language: 'python',
          caption: 'Conceptual training loop',
          source:
            'for batch in training_data:\n    predictions = model(batch.features)\n    loss = loss_function(predictions, batch.targets)\n\n    optimizer.zero_grad()\n    loss.backward()\n    optimizer.step()',
        },
        {
          kind: 'question',
          prompt:
            'Explain what the forward pass, loss.backward, and optimizer.step do in this conceptual loop.',
        },
      ],
      response: {
        kind: 'code',
        language: 'python',
        starterCode: '# Forward pass:\n# Backward pass:\n# Parameter update:\n',
      },
      evaluation: {
        kind: 'rubric-assisted-text',
        criteria: [
          {
            id: 'explains-forward',
            description:
              'Maps predictions and loss to the forward computation.',
            required: true,
          },
          {
            id: 'explains-backward',
            description:
              'Explains backward as gradient computation through dependencies.',
            required: true,
          },
          {
            id: 'explains-step',
            description:
              'Explains optimizer step as parameter update from gradients.',
            required: true,
          },
        ],
      },
      completionPolicy: { kind: 'submission' },
      nextActivityIds: ['transfer-loop-to-transformer'],
    },
    {
      id: 'transfer-loop-to-transformer',
      moduleId: 'bridge-to-deep-learning',
      conceptIds: [
        'neural-network',
        'automatic-differentiation',
        'representation-learning',
        'generalization',
      ],
      objectiveIds: ['map-loop-to-neural-networks'],
      title: 'Transfer the loop to transformers',
      kind: 'transfer',
      scaffoldLevel: 'transfer',
      blocks: [
        {
          kind: 'question',
          prompt:
            'Map data, representation, model, prediction, objective, optimization, and evaluation from a linear model to a neural network or transformer. Name what stays structurally present.',
        },
      ],
      response: {
        kind: 'text',
        multiline: true,
        minimumLength: 90,
      },
      evaluation: {
        kind: 'rubric-assisted-text',
        criteria: [
          {
            id: 'maps-loop-parts',
            description:
              'Maps data, model, prediction, objective, optimization, and evaluation.',
            required: true,
          },
          {
            id: 'preserves-foundation',
            description:
              'Explains that architecture complexity does not remove the learning loop.',
            required: true,
          },
          {
            id: 'avoids-overclaim',
            description:
              'Avoids claiming all LLM training recipes are identical.',
            required: true,
          },
        ],
      },
      completionPolicy: { kind: 'submission' },
      nextActivityIds: [],
    },
  ],
  extensions: [],
})

export const machineLearningFoundationsSubjectAdapter = createSubjectAdapter(
  machineLearningFoundationsSubject,
)
