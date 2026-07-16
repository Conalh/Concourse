import { mkdir, mkdtemp, rename, rm, stat } from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'

import {
  SCHEMA_VERSION,
  type CurriculumNode,
  type LearningItem,
  type LearningPackDocuments,
  type LearningResource,
  type StudySet,
} from '@learnt/learning-pack-contracts'
import {
  canonicalizePackFilesForPacking,
  loadLearningPackDirectory,
  stableJsonBytes,
  writeFilesToDirectory,
  type LoadedLearningPack,
  type PackFileRecord,
} from '@learnt/learning-pack-sdk'

export type LogicLesson = Readonly<{
  code: `${number}.${number}`
  nodeId: string
  title: string
  chapters: readonly number[]
  learnerJob: string
  conceptIds: readonly string[]
  objectiveIds: readonly string[]
  prerequisiteConceptIds?: readonly string[]
  explanation: string
  workedExample: string
  guidedPrompt: string
  guidedOptions: readonly string[]
  guidedCorrectOptionId: string
  independentPrompt: string
  independentSolution: string
  commonMistake: string
}>

export type LogicModule = Readonly<{
  code: `${number}.0`
  nodeId: string
  title: string
  prerequisiteConceptIds: readonly string[]
  lessons: readonly LogicLesson[]
  reviewPrompt: string
  checkpointPrompt: string
}>

const source = {
  title: 'forall x: Calgary',
  authors: ['P. D. Magnus', 'Tim Button', 'Robert Trueman', 'Richard Zach'],
  canonicalUrl: 'https://forallx.openlogicproject.org/html/',
  license: 'CC-BY-4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  attribution:
    'Concourse adapted the organization, examples, and learning activities from forall x: Calgary by P. D. Magnus, Tim Button, Robert Trueman, and Richard Zach, licensed CC BY 4.0.',
} as const

const zeroHash = '0'.repeat(64)
const textEncoder = new TextEncoder()

export const logicFoundationsModules: readonly LogicModule[] = [
  {
    code: '1.0',
    nodeId: 'node-logic-1-0-arguments-and-meaning',
    title: 'Logic, Arguments, and Meaning',
    prerequisiteConceptIds: [],
    lessons: [
      {
        code: '1.1',
        nodeId: 'node-logic-1-1-arguments',
        title: 'Arguments',
        chapters: [1],
        learnerJob:
          'Separate an argument into premises offered as reasons and the conclusion they support.',
        conceptIds: ['argument-structure'],
        objectiveIds: ['identify-premises-and-conclusion'],
        explanation:
          'An argument is a set of claims in which some claims—the premises—are presented as reasons for another claim—the conclusion. Finding the conclusion first often makes the structure easier to see.',
        workedExample:
          'The server is unreachable, so the deployment cannot finish. “The server is unreachable” is the premise; “the deployment cannot finish” is the conclusion signaled by “so.”',
        guidedPrompt:
          'In “Every cached result is stale; therefore this response should be refreshed,” which claim is the conclusion?',
        guidedOptions: [
          'This response should be refreshed.',
          'Every cached result is stale.',
          'The word “therefore.”',
        ],
        guidedCorrectOptionId: 'item-logic-1-1-arguments-guided-option-1',
        independentPrompt:
          'Write one premise and one conclusion for an argument about whether a software change should be reviewed before release.',
        independentSolution:
          'Example: “Unreviewed changes can hide defects” is a premise. “Therefore this change should be reviewed before release” is the conclusion.',
        commonMistake:
          'A topic is not automatically a conclusion. The conclusion is the claim the other statements are meant to support.',
      },
      {
        code: '1.2',
        nodeId: 'node-logic-1-2-scope-of-logic',
        title: 'The Scope of Logic',
        chapters: [2],
        learnerJob:
          'Distinguish whether reasoning follows from whether its premises happen to be true.',
        conceptIds: ['logical-consequence'],
        objectiveIds: ['distinguish-validity-from-truth'],
        explanation:
          'Logic evaluates the relationship between premises and a conclusion. A valid pattern cannot have true premises and a false conclusion, even when the particular premises used in an example are not actually true.',
        workedExample:
          'All robots are poets. Ada is a robot. Therefore Ada is a poet. The first premise may be false in the real world, but the conclusion follows from the two premises, so the pattern is valid.',
        guidedPrompt: 'What does deductive validity guarantee?',
        guidedOptions: [
          'Every premise is factually true.',
          'If the premises are true, the conclusion cannot be false.',
          'The conclusion is persuasive to every reader.',
        ],
        guidedCorrectOptionId: 'item-logic-1-2-scope-of-logic-guided-option-2',
        independentPrompt:
          'Explain why an argument may be valid even when one of its premises is false.',
        independentSolution:
          'Validity concerns what would follow if the premises were true. Actual premise truth is a separate question used when judging soundness.',
        commonMistake:
          'Do not reject a valid form merely because its subject matter is fictional or one premise is false.',
      },
      {
        code: '1.3',
        nodeId: 'node-logic-1-3-other-logical-notions',
        title: 'Other Logical Notions',
        chapters: [3],
        learnerJob:
          'Relate validity, consistency, equivalence, and contradiction without treating them as synonyms.',
        conceptIds: ['logical-relations'],
        objectiveIds: ['compare-logical-relations'],
        explanation:
          'Validity describes an argument. Consistency describes whether claims could all be true together. Equivalence describes claims that always share a truth value. A contradiction cannot be true under any interpretation.',
        workedExample:
          '“The build passed” and “The build did not pass” are inconsistent because they cannot both be true. Their conjunction is a contradiction, but neither sentence by itself is an argument.',
        guidedPrompt:
          'Which description best fits two claims that cannot both be true?',
        guidedOptions: [
          'They are inconsistent.',
          'They are automatically valid.',
          'They are equivalent.',
        ],
        guidedCorrectOptionId:
          'item-logic-1-3-other-logical-notions-guided-option-1',
        independentPrompt:
          'Give a pair of contradictory claims and explain why no situation makes both true.',
        independentSolution:
          'Example: “The door is open” and “The door is not open,” used of the same door at the same time and in the same sense, cannot both be true.',
        commonMistake:
          'Disagreement is not always contradiction. The claims must rule each other out under the same interpretation.',
      },
    ],
    reviewPrompt:
      'Review how premises support conclusions and how validity differs from truth, consistency, and contradiction.',
    checkpointPrompt:
      'Analyze a short argument, identify its structure, and classify the logical relationship among its claims.',
  },
  {
    code: '2.0',
    nodeId: 'node-logic-2-0-truth-functional-language',
    title: 'Truth-Functional Language',
    prerequisiteConceptIds: ['logical-relations'],
    lessons: [
      {
        code: '2.1',
        nodeId: 'node-logic-2-1-first-steps-symbolization',
        title: 'First Steps to Symbolization',
        chapters: [4],
        learnerJob:
          'Expose an argument pattern by replacing complete atomic claims with stable sentence letters.',
        conceptIds: ['sentence-form'],
        objectiveIds: ['abstract-argument-form'],
        explanation:
          'Symbolization separates logical structure from subject matter. Start by assigning one sentence letter to each distinct atomic claim, then preserve repeated claims with the same letter.',
        workedExample:
          '“The cache is warm. If the cache is warm, the response is fast. Therefore the response is fast” has the form C, C → F, therefore F.',
        guidedPrompt:
          'A claim appears twice in an argument. How should a symbolization key represent it?',
        guidedOptions: [
          'Use the same sentence letter both times.',
          'Choose a new letter for every occurrence.',
          'Replace it with a connective.',
        ],
        guidedCorrectOptionId:
          'item-logic-2-1-first-steps-symbolization-guided-option-1',
        independentPrompt:
          'Give a symbolization key and form for: “If the build passes, deployment starts. The build passes. So deployment starts.”',
        independentSolution:
          'Let B mean “The build passes” and D mean “Deployment starts.” The form is B → D, B, therefore D.',
        commonMistake:
          'A sentence letter stands for a complete atomic claim, not for an individual word inside it.',
      },
      {
        code: '2.2',
        nodeId: 'node-logic-2-2-connectives',
        title: 'Connectives',
        chapters: [5],
        learnerJob:
          'Translate negation, conjunction, disjunction, conditional, and biconditional structure into TFL.',
        conceptIds: ['truth-functional-connectives'],
        objectiveIds: ['symbolize-connectives'],
        explanation:
          'TFL builds complex sentences with five connectives: ¬, ∧, ∨, →, and ↔. Translate the logical job of the English expression rather than matching words mechanically.',
        workedExample:
          'With R for “The release is ready” and A for “Approval arrived,” “The release is ready only if approval arrived” becomes R → A.',
        guidedPrompt:
          'Which TFL form matches “The test passes if and only if the expected and actual values match”?',
        guidedOptions: ['T ↔ M', 'T → M', 'T ∨ M'],
        guidedCorrectOptionId: 'item-logic-2-2-connectives-guided-option-1',
        independentPrompt:
          'Symbolize “The job runs unless the queue is paused,” using J and P.',
        independentSolution:
          'A standard TFL rendering is ¬P → J, equivalently J ∨ P in truth-functional contexts.',
        commonMistake:
          '“Only if” introduces a necessary condition and points toward the consequent of a conditional.',
      },
      {
        code: '2.3',
        nodeId: 'node-logic-2-3-sentences-of-tfl',
        title: 'Sentences of TFL',
        chapters: [6],
        learnerJob:
          'Recognize well-formed TFL sentences and identify their main connective.',
        conceptIds: ['tfl-syntax'],
        objectiveIds: ['parse-tfl-sentences'],
        explanation:
          'A TFL sentence is built recursively: atomic letters are sentences; negating a sentence makes a sentence; and joining two sentences with a binary connective inside brackets makes a sentence.',
        workedExample:
          'In ¬(A ∨ B), the outermost operation is negation. In (¬A ∨ B), the main connective is disjunction.',
        guidedPrompt: 'Which expression is a well-formed TFL sentence?',
        guidedOptions: ['(A ∧ ¬B)', 'A ∧ → B', '¬ ∨ A'],
        guidedCorrectOptionId:
          'item-logic-2-3-sentences-of-tfl-guided-option-1',
        independentPrompt:
          'Identify the main connective and immediate components of ((A ∧ B) → ¬C).',
        independentSolution:
          'The main connective is →. Its antecedent is (A ∧ B), and its consequent is ¬C.',
        commonMistake:
          'The visually central symbol is not necessarily the main connective; use the sentence’s construction and brackets.',
      },
      {
        code: '2.4',
        nodeId: 'node-logic-2-4-ambiguity',
        title: 'Ambiguity',
        chapters: [7],
        learnerJob:
          'Resolve lexical or structural ambiguity before committing to one formalization.',
        conceptIds: ['structural-ambiguity'],
        objectiveIds: ['disambiguate-before-symbolizing'],
        explanation:
          'One English sentence can express different claims in different contexts. Formalization begins by stating the intended reading, especially when grouping changes the logical structure.',
        workedExample:
          '“The monitor is quiet or the service is slow and overloaded” could mean Q ∨ (S ∧ O) or (Q ∨ S) ∧ O. The context must choose.',
        guidedPrompt:
          'What should you do first when an English sentence supports two different TFL structures?',
        guidedOptions: [
          'State the intended reading.',
          'Choose the shorter formula automatically.',
          'Remove every connective.',
        ],
        guidedCorrectOptionId: 'item-logic-2-4-ambiguity-guided-option-1',
        independentPrompt:
          'Give two bracketings for “A or B and C” and explain how their truth conditions differ.',
        independentSolution:
          'A ∨ (B ∧ C) needs A or both B and C. (A ∨ B) ∧ C always requires C and also at least one of A or B.',
        commonMistake:
          'Do not treat ordinary-language punctuation as a complete substitute for identifying the intended grouping.',
      },
      {
        code: '2.5',
        nodeId: 'node-logic-2-5-use-and-mention',
        title: 'Use and Mention',
        chapters: [8],
        learnerJob:
          'Distinguish using an expression to talk about the world from mentioning the expression itself.',
        conceptIds: ['use-mention-distinction'],
        objectiveIds: ['distinguish-use-from-mention'],
        explanation:
          'Using a name talks about its bearer; mentioning a name talks about the expression. Quotation marks and metavariables keep the object language separate from the language used to describe it.',
        workedExample:
          'Ada was a mathematician uses “Ada” to name a person. “Ada” has three letters mentions the written name.',
        guidedPrompt:
          'Which sentence mentions an expression rather than using it?',
        guidedOptions: [
          '“A ∧ B” contains a conjunction symbol.',
          'A ∧ B is true on this valuation.',
          'Ada designed an algorithm.',
        ],
        guidedCorrectOptionId: 'item-logic-2-5-use-and-mention-guided-option-1',
        independentPrompt:
          'Explain the difference between A and “A” in a sentence about TFL.',
        independentSolution:
          'A is an atomic sentence of the object language. “A” is a name for that written expression in the metalanguage.',
        commonMistake:
          'Quotation marks change what the sentence is about; they are not decorative emphasis.',
      },
    ],
    reviewPrompt:
      'Translate ordinary claims into well-formed TFL while preserving repeated atoms, grouping, and the use–mention distinction.',
    checkpointPrompt:
      'Disambiguate a short passage, give its symbolization key and TFL form, and identify the main connective.',
  },
  {
    code: '3.0',
    nodeId: 'node-logic-3-0-truth-tables',
    title: 'Truth Tables',
    prerequisiteConceptIds: ['truth-functional-connectives', 'tfl-syntax'],
    lessons: [
      {
        code: '3.1',
        nodeId: 'node-logic-3-1-characteristic-truth-tables',
        title: 'Characteristic Truth Tables',
        chapters: [9],
        learnerJob:
          'Evaluate each TFL connective from the truth values of its immediate components.',
        conceptIds: ['characteristic-truth-tables'],
        objectiveIds: ['evaluate-connectives'],
        explanation:
          'A characteristic truth table defines a connective. Negation flips one value; conjunction requires both true; inclusive disjunction requires at least one true; a conditional is false only from true to false; a biconditional requires matching values.',
        workedExample:
          'If A is true and B is false, then A ∧ B is false, A ∨ B is true, A → B is false, and A ↔ B is false.',
        guidedPrompt: 'When is a material conditional A → B false?',
        guidedOptions: [
          'A is true and B is false.',
          'A and B are both false.',
          'A is false and B is true.',
        ],
        guidedCorrectOptionId:
          'item-logic-3-1-characteristic-truth-tables-guided-option-1',
        independentPrompt:
          'Evaluate ¬A, A ∨ B, and A ↔ B when A is false and B is true.',
        independentSolution:
          '¬A is true; A ∨ B is true; A ↔ B is false because the component values differ.',
        commonMistake:
          'TFL disjunction is inclusive unless explicitly represented otherwise; both disjuncts may be true.',
      },
      {
        code: '3.2',
        nodeId: 'node-logic-3-2-truth-functional-connectives',
        title: 'Truth-Functional Connectives',
        chapters: [10],
        learnerJob:
          'Determine whether a connective’s output is fixed entirely by its component truth values.',
        conceptIds: ['truth-functionality'],
        objectiveIds: ['identify-truth-functional-operators'],
        explanation:
          'A connective is truth-functional when component truth values uniquely determine the compound truth value. TFL deliberately models these connectives and leaves intensional notions such as necessity outside its scope.',
        workedExample:
          'Knowing P is true completely determines ¬P as false. Knowing P is true does not by itself determine “It is necessarily the case that P.”',
        guidedPrompt: 'Which expression is not truth-functional?',
        guidedOptions: [
          'It is necessarily the case that P.',
          'P and Q.',
          'P if and only if Q.',
        ],
        guidedCorrectOptionId:
          'item-logic-3-2-truth-functional-connectives-guided-option-1',
        independentPrompt:
          'Explain why “because” cannot be represented merely by a TFL connective with a truth table.',
        independentSolution:
          'Two component claims can keep the same truth values while their explanatory or causal relationship changes, so truth values alone do not determine “because.”',
        commonMistake:
          'A connective appearing between two truth-valued claims is not automatically truth-functional.',
      },
      {
        code: '3.3',
        nodeId: 'node-logic-3-3-complete-truth-tables',
        title: 'Complete Truth Tables',
        chapters: [11],
        learnerJob:
          'Construct every valuation for a formula and evaluate it from the inside out.',
        conceptIds: ['complete-truth-tables'],
        objectiveIds: ['construct-complete-truth-table'],
        explanation:
          'A complete table with n atomic letters has 2ⁿ rows. List valuations systematically, then calculate the smallest subsentences before the main connective.',
        workedExample:
          'A formula containing A and B needs four rows: TT, TF, FT, FF. For (A ∧ B) → A, evaluate A ∧ B first and the conditional last.',
        guidedPrompt:
          'How many rows does a complete truth table need for A, B, and C?',
        guidedOptions: ['8', '6', '3'],
        guidedCorrectOptionId:
          'item-logic-3-3-complete-truth-tables-guided-option-1',
        independentPrompt: 'Describe the evaluation order for ¬(A ∨ B) ↔ C.',
        independentSolution:
          'Evaluate A ∨ B, negate that result, then compare ¬(A ∨ B) with C using the biconditional.',
        commonMistake:
          'Do not calculate the main connective before the truth values of its immediate components are available.',
      },
      {
        code: '3.4',
        nodeId: 'node-logic-3-4-semantic-concepts',
        title: 'Semantic Concepts',
        chapters: [12],
        learnerJob:
          'Use truth tables to test tautology, contradiction, equivalence, satisfiability, entailment, and validity.',
        conceptIds: ['tfl-semantic-properties'],
        objectiveIds: ['test-semantic-properties'],
        explanation:
          'Semantic tests ask what happens across valuations. A tautology is always true, a contradiction always false, equivalent formulas match on every row, and a valid argument has no row with true premises and a false conclusion.',
        workedExample:
          'A ∨ ¬A is true on both valuations of A, so it is a tautology. A ∧ ¬A is false on both, so it is a contradiction.',
        guidedPrompt: 'What would make a truth-table argument invalid?',
        guidedOptions: [
          'A row with all premises true and the conclusion false.',
          'A row with one premise false.',
          'A row where every sentence is true.',
        ],
        guidedCorrectOptionId:
          'item-logic-3-4-semantic-concepts-guided-option-1',
        independentPrompt:
          'State the truth-table test for equivalence between formulas A and B.',
        independentSolution:
          'Compare their columns on every valuation. They are equivalent exactly when their truth values match on every row.',
        commonMistake:
          'One matching row does not establish equivalence; the columns must match on all valuations.',
      },
    ],
    reviewPrompt:
      'Evaluate TFL formulas systematically and connect complete truth-table patterns to semantic classifications.',
    checkpointPrompt:
      'Build or inspect a truth table, identify a decisive row, and justify a semantic verdict.',
  },
  {
    code: '4.0',
    nodeId: 'node-logic-4-0-semantic-reasoning-tfl',
    title: 'Semantic Reasoning in TFL',
    prerequisiteConceptIds: [
      'complete-truth-tables',
      'tfl-semantic-properties',
    ],
    lessons: [
      {
        code: '4.1',
        nodeId: 'node-logic-4-1-limitations-of-tfl',
        title: 'Limitations of TFL',
        chapters: [13],
        learnerJob:
          'Recognize valid reasoning that TFL cannot reveal because atomic sentence structure has been hidden.',
        conceptIds: ['expressive-limits'],
        objectiveIds: ['recognize-tfl-limitations'],
        explanation:
          'TFL analyzes truth-functional structure, not internal subject–predicate structure, vagueness, modality, or explanation. A poor formalization can therefore miss genuine validity or introduce consequences the English claim did not have.',
        workedExample:
          '“Every square has four sides; this shape is a square; therefore it has four sides” is valid, but treating each whole sentence as an unrelated TFL atom hides why.',
        guidedPrompt:
          'Why can TFL fail to display the validity of “Ada is a dog, so Ada is an animal”?',
        guidedOptions: [
          'TFL treats the internal predicate relationship as opaque.',
          'TFL has no truth values.',
          'The English argument has no conclusion.',
        ],
        guidedCorrectOptionId:
          'item-logic-4-1-limitations-of-tfl-guided-option-1',
        independentPrompt:
          'Name one feature of meaning that TFL deliberately leaves unanalyzed and explain the consequence.',
        independentSolution:
          'Example: necessity is not truth-functional, so two true component claims do not determine whether either is necessarily true.',
        commonMistake:
          'A failed TFL validity test may reveal an inadequate formalization rather than bad reasoning in the original language.',
      },
      {
        code: '4.2',
        nodeId: 'node-logic-4-2-truth-table-shortcuts',
        title: 'Truth Table Shortcuts',
        chapters: [14],
        learnerJob:
          'Skip unnecessary component calculations while preserving a justified semantic test.',
        conceptIds: ['truth-table-shortcuts'],
        objectiveIds: ['apply-truth-table-shortcuts'],
        explanation:
          'A true disjunct settles a disjunction, a false conjunct settles a conjunction, and a conditional is settled true by a false antecedent or true consequent. For validity, focus on candidate rows where every premise is true.',
        workedExample:
          'If P is false, P → Q is true without evaluating Q. If P ∧ Q must be true, both P and Q are forced true.',
        guidedPrompt: 'Which value settles A ∧ B as false immediately?',
        guidedOptions: [
          'Either conjunct is false.',
          'Either conjunct is true.',
          'The conjuncts have matching values.',
        ],
        guidedCorrectOptionId:
          'item-logic-4-2-truth-table-shortcuts-guided-option-1',
        independentPrompt:
          'Explain how to narrow a validity test whose first premise is A ∧ B.',
        independentSolution:
          'Only rows with A true and B true can make that premise true, so all other rows can be ignored when searching for a counterexample.',
        commonMistake:
          'A shortcut is justified by a connective’s truth condition; it is not permission to omit a row that could still be decisive.',
      },
      {
        code: '4.3',
        nodeId: 'node-logic-4-3-partial-truth-tables',
        title: 'Partial Truth Tables',
        chapters: [15],
        learnerJob:
          'Construct a decisive valuation instead of a full table when one counterexample is enough.',
        conceptIds: ['partial-truth-tables'],
        objectiveIds: ['construct-countervaluation'],
        explanation:
          'Universal claims need every valuation, but failures often need only one. To refute tautology, find one false row; to refute validity, find one row with true premises and a false conclusion.',
        workedExample:
          'To show A → B is not a tautology, assign A true and B false. That single valuation makes the conditional false.',
        guidedPrompt: 'What is sufficient to show that an argument is invalid?',
        guidedOptions: [
          'One valuation with true premises and a false conclusion.',
          'One valuation with a false premise.',
          'A complete table with no false cells.',
        ],
        guidedCorrectOptionId:
          'item-logic-4-3-partial-truth-tables-guided-option-1',
        independentPrompt:
          'Give a valuation showing that A ∨ B does not entail A.',
        independentSolution:
          'Set A false and B true. Then A ∨ B is true while A is false, providing a countervaluation.',
        commonMistake:
          'A row is a counterexample to validity only when every premise is true and the conclusion is false on that same row.',
      },
    ],
    reviewPrompt:
      'Choose between complete and partial truth-table methods while respecting what TFL can and cannot represent.',
    checkpointPrompt:
      'Find and explain a decisive valuation, or explain why TFL is too coarse to capture the original inference.',
  },
  {
    code: '5.0',
    nodeId: 'node-logic-5-0-natural-deduction-foundations',
    title: 'Natural Deduction Foundations',
    prerequisiteConceptIds: ['tfl-syntax', 'tfl-semantic-properties'],
    lessons: [
      {
        code: '5.1',
        nodeId: 'node-logic-5-1-idea-natural-deduction',
        title: 'The Idea of Natural Deduction',
        chapters: [16],
        learnerJob:
          'Explain how a derivation displays a chain of licensed inference rather than checking every valuation.',
        conceptIds: ['natural-deduction'],
        objectiveIds: ['explain-proof-purpose'],
        explanation:
          'Truth tables test cases; natural deduction transforms formulas using rules. A derivation makes the route from assumptions to conclusion explicit and can scale without enumerating every valuation.',
        workedExample:
          'From P ∨ Q and ¬P, a derivation can infer Q by a licensed rule, recording the reason on the line where Q appears.',
        guidedPrompt: 'What does a natural-deduction proof primarily display?',
        guidedOptions: [
          'A sequence of rule-licensed inference steps.',
          'Every possible valuation.',
          'The historical origin of each premise.',
        ],
        guidedCorrectOptionId:
          'item-logic-5-1-idea-natural-deduction-guided-option-1',
        independentPrompt:
          'Contrast the information supplied by a truth-table validity test with the information supplied by a derivation.',
        independentSolution:
          'A truth table shows there is no countervaluation. A derivation shows one structured route from the premises to the conclusion using accepted rules.',
        commonMistake:
          'A derivation is not a list of formulas that happen to be true; every non-assumption line needs a valid justification.',
      },
      {
        code: '5.2',
        nodeId: 'node-logic-5-2-basic-rules-tfl',
        title: 'Basic Rules for TFL',
        chapters: [17],
        learnerJob:
          'Select introduction or elimination rules based on the main connective of available formulas and goals.',
        conceptIds: ['tfl-proof-rules'],
        objectiveIds: ['apply-basic-tfl-rules'],
        explanation:
          'Introduction rules build a formula with a chosen main connective; elimination rules use such a formula. Subproofs temporarily add assumptions and discharge them only through the rule that licenses closure.',
        workedExample:
          'From A and B, infer A ∧ B by conjunction introduction. From A ∧ B, infer either conjunct by conjunction elimination.',
        guidedPrompt: 'Which rule directly derives A from A ∧ B?',
        guidedOptions: [
          'Conjunction elimination',
          'Conjunction introduction',
          'Conditional introduction',
        ],
        guidedCorrectOptionId: 'item-logic-5-2-basic-rules-tfl-guided-option-1',
        independentPrompt:
          'Describe the subproof needed to derive A → B by conditional introduction.',
        independentSolution:
          'Open a subproof assuming A, derive B within that subproof, then close it and infer A → B while discharging the assumption A.',
        commonMistake:
          'A formula proved inside a subproof cannot be used outside after closure unless the governing rule permits it.',
      },
      {
        code: '5.3',
        nodeId: 'node-logic-5-3-constructing-proofs',
        title: 'Constructing Proofs',
        chapters: [18],
        learnerJob:
          'Plan a proof by working backward from the goal and forward from usable premises.',
        conceptIds: ['proof-strategy'],
        objectiveIds: ['plan-tfl-proof'],
        explanation:
          'The goal’s main connective suggests an introduction rule; the premises’ main connectives suggest elimination rules. When direct progress stalls, a carefully scoped subproof can expose the missing route.',
        workedExample:
          'To prove A → (B ∧ A), assume A, derive B from available premises, combine B with A, then close the subproof with conditional introduction.',
        guidedPrompt:
          'If the goal is A ∧ B, what backward plan is most direct?',
        guidedOptions: [
          'Plan to derive A and B separately, then use ∧ introduction.',
          'Assume ¬A and stop.',
          'Apply ∧ elimination to the goal.',
        ],
        guidedCorrectOptionId:
          'item-logic-5-3-constructing-proofs-guided-option-1',
        independentPrompt:
          'Give a forward and backward planning observation for premises A → B and A with goal B ∧ A.',
        independentSolution:
          'Forward: A → B and A yield B. Backward: the conjunction goal requires B and A; both are then available for ∧ introduction.',
        commonMistake:
          'Writing the desired conclusion does not prove it; every planned line must be reachable by a rule from accessible earlier lines.',
      },
    ],
    reviewPrompt:
      'Match proof goals and available formulas to introduction, elimination, and subproof strategies.',
    checkpointPrompt:
      'Plan and explain a short derivation, including every assumption, rule choice, and discharged subproof.',
  },
  {
    code: '6.0',
    nodeId: 'node-logic-6-0-proof-strategy',
    title: 'Proof Strategy',
    prerequisiteConceptIds: [
      'natural-deduction',
      'tfl-proof-rules',
      'proof-strategy',
    ],
    lessons: [
      {
        code: '6.1',
        nodeId: 'node-logic-6-1-additional-rules-tfl',
        title: 'Additional Rules for TFL',
        chapters: [19],
        learnerJob:
          'Apply convenient rules such as DS, MT, DNE, excluded middle, and De Morgan transformations with exact premises.',
        conceptIds: ['additional-tfl-rules'],
        objectiveIds: ['apply-additional-tfl-rules'],
        explanation:
          'Additional rules compress common derivations. Their convenience does not relax matching requirements: disjunctive syllogism needs a disjunction plus the negation of one disjunct, and modus tollens needs a conditional plus a negated consequent.',
        workedExample:
          'From A ∨ B and ¬A, infer B by DS. From A → B and ¬B, infer ¬A by MT.',
        guidedPrompt: 'Which pair licenses modus tollens?',
        guidedOptions: ['A → B and ¬B', 'A → B and B', 'A ∨ B and ¬A'],
        guidedCorrectOptionId:
          'item-logic-6-1-additional-rules-tfl-guided-option-1',
        independentPrompt:
          'Use a named additional rule to derive ¬C from C → D and ¬D.',
        independentSolution:
          'Modus tollens applies to C → D and ¬D, yielding ¬C.',
        commonMistake:
          'Affirming the consequent—from A → B and B to A—is not modus tollens and is invalid.',
      },
      {
        code: '6.2',
        nodeId: 'node-logic-6-2-proof-theoretic-concepts',
        title: 'Proof-Theoretic Concepts',
        chapters: [20],
        learnerJob:
          'Read the single turnstile as a claim about derivability and distinguish it from semantic entailment.',
        conceptIds: ['proof-theoretic-concepts'],
        objectiveIds: ['distinguish-turnstiles'],
        explanation:
          'Γ ⊢ A says there is a derivation of A from assumptions in Γ. Γ ⊨ A says no interpretation makes Γ true and A false. One is proof-theoretic; the other is semantic.',
        workedExample:
          '⊢ A ∨ ¬A says the formula is a theorem with no undischarged assumptions. ⊨ A ∨ ¬A says it is true on every valuation.',
        guidedPrompt: 'What does Γ ⊢ A assert?',
        guidedOptions: [
          'A can be derived from assumptions in Γ.',
          'A is false on one valuation.',
          'Γ and A are strings with the same length.',
        ],
        guidedCorrectOptionId:
          'item-logic-6-2-proof-theoretic-concepts-guided-option-1',
        independentPrompt:
          'Explain the difference between ⊢ A and ⊨ A without assuming soundness or completeness.',
        independentSolution:
          '⊢ A reports the existence of a proof with no undischarged assumptions. ⊨ A reports truth on every valuation. Their equivalence is a further theorem, not part of either definition.',
        commonMistake:
          'The single and double turnstiles are not interchangeable notation merely because they often agree in TFL.',
      },
      {
        code: '6.3',
        nodeId: 'node-logic-6-3-derived-rules',
        title: 'Derived Rules',
        chapters: [21],
        learnerJob:
          'Expand a convenient derived-rule step into a proof using only the basic rules.',
        conceptIds: ['derived-rules'],
        objectiveIds: ['expand-derived-rule'],
        explanation:
          'A derived rule is admissible because every use can be replaced by a pattern of basic-rule steps. It shortens proofs without adding new derivable conclusions.',
        workedExample:
          'A DS step from A ∨ B and ¬A can be expanded by disjunction elimination: handle the A branch via contradiction and infer B directly in the B branch.',
        guidedPrompt: 'What does deriving an additional rule establish?',
        guidedOptions: [
          'Every use can be replaced by basic-rule steps.',
          'The rule changes the truth table of a connective.',
          'The rule permits inaccessible subproof lines.',
        ],
        guidedCorrectOptionId: 'item-logic-6-3-derived-rules-guided-option-1',
        independentPrompt:
          'Explain why adding a derived rule can shorten proofs without increasing what the system can prove.',
        independentSolution:
          'Because each derived-rule use expands into an existing basic derivation, it abbreviates proofs but reaches no conclusion unavailable before.',
        commonMistake:
          'A familiar valid argument form is not automatically a rule of the chosen proof system until its derivation or authorization is established.',
      },
      {
        code: '6.4',
        nodeId: 'node-logic-6-4-soundness-completeness',
        title: 'Soundness and Completeness',
        chapters: [22],
        learnerJob:
          'Relate derivability and semantic consequence through the soundness and completeness guarantees.',
        conceptIds: ['soundness-completeness'],
        objectiveIds: ['relate-proof-and-semantics'],
        explanation:
          'Soundness says derivable conclusions are semantically entailed: Γ ⊢ A implies Γ ⊨ A. Completeness says every semantic consequence is derivable: Γ ⊨ A implies Γ ⊢ A.',
        workedExample:
          'If the proof system derives B from A and A → B, soundness guarantees no valuation makes both premises true and B false. Completeness guarantees every TFL-valid pattern has some derivation.',
        guidedPrompt: 'Which claim expresses completeness?',
        guidedOptions: [
          'If Γ ⊨ A, then Γ ⊢ A.',
          'If Γ ⊢ A, then Γ ⊨ A.',
          'If Γ ⊬ A, then Γ is empty.',
        ],
        guidedCorrectOptionId:
          'item-logic-6-4-soundness-completeness-guided-option-1',
        independentPrompt:
          'State what soundness protects us from and what completeness promises.',
        independentSolution:
          'Soundness prevents the rules from proving a semantic non-consequence. Completeness promises that the rules are strong enough to derive every TFL semantic consequence.',
        commonMistake:
          'Soundness and completeness are metatheoretic claims about the proof system, not labels for individual premises.',
      },
    ],
    reviewPrompt:
      'Use additional and derived rules accurately while keeping proof-theoretic and semantic claims distinct.',
    checkpointPrompt:
      'Analyze a short proof strategy and explain how soundness, completeness, or derived-rule expansion justifies it.',
  },
  {
    code: '7.0',
    nodeId: 'node-logic-7-0-first-order-language',
    title: 'First-Order Language',
    prerequisiteConceptIds: ['tfl-syntax', 'truth-functional-connectives'],
    lessons: [
      {
        code: '7.1',
        nodeId: 'node-logic-7-1-building-blocks-fol',
        title: 'Building Blocks of FOL',
        chapters: [23],
        learnerJob:
          'Distinguish names, predicates, variables, quantifiers, and the domain when decomposing an atomic claim.',
        conceptIds: ['fol-building-blocks'],
        objectiveIds: ['identify-fol-building-blocks'],
        prerequisiteConceptIds: ['tfl-syntax'],
        explanation:
          'First-order logic opens atomic claims to show which objects are discussed and what is said of them. Names pick out domain members, predicates express properties or relations, variables hold places, and quantifiers say how widely those variables range.',
        workedExample:
          'Let the domain be devices, d name the dashboard, and O mean “is offline.” Od says the dashboard is offline, while ∃xOx says at least one device is offline, whether named or not.',
        guidedPrompt:
          'With domain devices, d for the dashboard, and O for “is offline,” which formula says that some device is offline?',
        guidedOptions: ['∃xOx', 'Od', '∀xOx'],
        guidedCorrectOptionId:
          'item-logic-7-1-building-blocks-fol-guided-option-1',
        independentPrompt:
          'Using domain servers, s for Sol, and R for “is restarting,” identify the job of each symbol in ∃xRx and Rs.',
        independentSolution:
          'The domain fixes what x may range over; x is a variable; ∃ is the existential quantifier; R is a one-place predicate; s is a name. ∃xRx says some server is restarting, while Rs says Sol is restarting.',
        commonMistake:
          'A quantified variable ranges over the entire stated domain, not merely the objects that happen to have names.',
      },
      {
        code: '7.2',
        nodeId: 'node-logic-7-2-one-quantifier',
        title: 'Sentences with One Quantifier',
        chapters: [24],
        learnerJob:
          'Choose a domain and symbolize common one-quantifier claims with the correct connective and scope.',
        conceptIds: ['quantifier-symbolization'],
        objectiveIds: ['symbolize-single-quantifier-claims'],
        prerequisiteConceptIds: [
          'fol-building-blocks',
          'truth-functional-connectives',
        ],
        explanation:
          'Universal claims usually restrict a class with a conditional, while existential claims usually join the witness conditions with a conjunction. Paraphrasing first makes the intended quantifier, restriction, and scope visible.',
        workedExample:
          'With domain services, A for “is an API,” and M for “is monitored,” “Every API is monitored” becomes ∀x(Ax → Mx); “Some API is monitored” becomes ∃x(Ax ∧ Mx).',
        guidedPrompt:
          'With domain services, A for “is an API,” and M for “is monitored,” which formula says every API is monitored?',
        guidedOptions: ['∀x(Ax → Mx)', '∀x(Ax ∧ Mx)', '∃x(Ax → Mx)'],
        guidedCorrectOptionId: 'item-logic-7-2-one-quantifier-guided-option-1',
        independentPrompt:
          'Using domain files, L for “is a log,” and E for “is encrypted,” symbolize “No log is encrypted” and give one equivalent formulation.',
        independentSolution:
          'One answer is ¬∃x(Lx ∧ Ex). An equivalent answer is ∀x(Lx → ¬Ex). Both exclude any file that is simultaneously a log and encrypted.',
        commonMistake:
          'An existential conditional such as ∃x(Lx → Ex) is usually too weak because any non-log can make its conditional true.',
      },
      {
        code: '7.3',
        nodeId: 'node-logic-7-3-multiple-generality',
        title: 'Multiple Generality',
        chapters: [25],
        learnerJob:
          'Track predicate-place order and quantifier order in claims about several objects.',
        conceptIds: ['multiple-generality'],
        objectiveIds: ['distinguish-quantifier-order'],
        prerequisiteConceptIds: ['quantifier-symbolization'],
        explanation:
          'Many-place predicates preserve an ordered relation between objects. With multiple quantifiers, changing which quantifier has wider scope can change whether witnesses may differ or must be shared.',
        workedExample:
          'If Rxy means “x reviews y,” ∀x∃yRxy allows each reviewer a different item. ∃y∀xRxy requires one particular item reviewed by everyone.',
        guidedPrompt:
          'If Rxy means “x reviews y,” which formula requires one shared item that everyone reviews?',
        guidedOptions: ['∃y∀xRxy', '∀x∃yRxy', '∀y∃xRxy'],
        guidedCorrectOptionId:
          'item-logic-7-3-multiple-generality-guided-option-1',
        independentPrompt:
          'Using domain people and Mxy for “x messages y,” compare ∀x∃yMxy with ∃y∀xMxy by describing a three-person case where only the first is true.',
        independentSolution:
          'Let Ana message Bo, Bo message Cy, and Cy message Ana, with no other messages. Everyone messages someone, so ∀x∃yMxy is true. No single person is messaged by everyone, so ∃y∀xMxy is false.',
        commonMistake:
          'Do not swap predicate places or quantifier order as a cosmetic rewrite; either change can alter the claim.',
      },
      {
        code: '7.4',
        nodeId: 'node-logic-7-4-identity',
        title: 'Identity',
        chapters: [26],
        learnerJob:
          'Use identity and non-identity to express sameness, exceptions, and finite numerical claims.',
        conceptIds: ['fol-identity'],
        objectiveIds: ['symbolize-identity-and-quantity'],
        prerequisiteConceptIds: ['multiple-generality'],
        explanation:
          'The identity sign says that two terms pick out one and the same object. Its negation guarantees distinct witnesses, which lets FOL express “someone else,” exclusions, and minimum or exact quantities.',
        workedExample:
          'With A for “is an alert,” ∃x∃y(Ax ∧ Ay ∧ x ≠ y) says there are at least two alerts because the two witnesses must be distinct.',
        guidedPrompt: 'Which formula says that there are at least two alerts?',
        guidedOptions: [
          '∃x∃y(Ax ∧ Ay ∧ x ≠ y)',
          '∃x∃y(Ax ∧ Ay)',
          '∀x∀y(Ax → x = y)',
        ],
        guidedCorrectOptionId: 'item-logic-7-4-identity-guided-option-1',
        independentPrompt:
          'Using domain users, a for Ari, and Fxy for “x follows y,” symbolize “Ari follows everyone other than Ari.”',
        independentSolution:
          'A direct rendering is ∀x(x ≠ a → Fax). This leaves open whether Ari follows Ari, because the conditional restricts the claim to users distinct from Ari.',
        commonMistake:
          'Two existential variables do not automatically denote two objects; add non-identity when distinctness matters.',
      },
    ],
    reviewPrompt:
      'Retrieve how domains, predicate places, quantifier scope, and identity determine a first-order symbolization.',
    checkpointPrompt:
      'Build and explain a finite first-order symbolization key, then compare formulas that differ in quantifier order or identity.',
  },
  {
    code: '8.0',
    nodeId: 'node-logic-8-0-expressing-first-order-claims',
    title: 'Expressing First-Order Claims',
    prerequisiteConceptIds: [
      'fol-building-blocks',
      'quantifier-symbolization',
      'multiple-generality',
      'fol-identity',
    ],
    lessons: [
      {
        code: '8.1',
        nodeId: 'node-logic-8-1-sentences-fol',
        title: 'Sentences of FOL',
        chapters: [27],
        learnerJob:
          'Recognize FOL terms, formulas, sentences, bound variables, and free variables by the formation rules.',
        conceptIds: ['fol-syntax'],
        objectiveIds: ['identify-fol-sentences'],
        prerequisiteConceptIds: ['fol-building-blocks'],
        explanation:
          'Names and variables are terms. Predicates applied to the right number of terms form atomic formulas, and connectives and quantifiers build larger formulas. A formula is a sentence only when every variable occurrence is bound.',
        workedExample:
          'In ∀x(Rxy → Py), x is bound by ∀x but both occurrences of y are free, so the expression is a formula but not a sentence. ∀x∃y(Rxy → Py) binds both variables.',
        guidedPrompt:
          'Which expression is an FOL sentence with no free variables?',
        guidedOptions: ['∀x∃yRxy', '∀xRxy', 'Rxy'],
        guidedCorrectOptionId: 'item-logic-8-1-sentences-fol-guided-option-1',
        independentPrompt:
          'For ∃y(Qy ∧ Rxy), list every bound and free variable occurrence and state whether the formula is a sentence.',
        independentSolution:
          'Both occurrences of y are within ∃y and are bound. The occurrence of x is free, so the formula is not a sentence.',
        commonMistake:
          'A quantifier binds only matching variable occurrences within its scope, not every variable visible nearby.',
      },
      {
        code: '8.2',
        nodeId: 'node-logic-8-2-definite-descriptions',
        title: 'Definite Descriptions',
        chapters: [28],
        learnerJob:
          'Analyze “the F is G” as existence, uniqueness, and predication without inventing a name.',
        conceptIds: ['definite-descriptions'],
        objectiveIds: ['analyze-definite-descriptions'],
        prerequisiteConceptIds: ['fol-identity', 'quantifier-symbolization'],
        explanation:
          'A definite description aims at exactly one object. A Russell-style analysis replaces “the” with a quantified claim: at least one object is F, at most one object is F, and that object is G.',
        workedExample:
          'With D for “is the deploy leader” and O for “is online,” “The deploy leader is online” can be rendered ∃x(Dx ∧ ∀y(Dy → y = x) ∧ Ox).',
        guidedPrompt:
          'Which formula says that exactly one deploy leader exists and that person is online?',
        guidedOptions: [
          '∃x(Dx ∧ ∀y(Dy → y = x) ∧ Ox)',
          '∃x(Dx ∧ Ox)',
          '∀x(Dx → Ox)',
        ],
        guidedCorrectOptionId:
          'item-logic-8-2-definite-descriptions-guided-option-1',
        independentPrompt:
          'Using C for “is a current coordinator” and A for “is available,” symbolize “The current coordinator is available” and label the existence, uniqueness, and availability parts.',
        independentSolution:
          'One solution is ∃x(Cx ∧ ∀y(Cy → y = x) ∧ Ax). Cx supplies a witness, ∀y(Cy → y = x) makes that witness unique, and Ax attributes availability. Equivalent bracketings that preserve those three conditions are acceptable.',
        commonMistake:
          '∃x(Cx ∧ Ax) supplies existence but not uniqueness, so it means only that some coordinator is available.',
      },
      {
        code: '8.3',
        nodeId: 'node-logic-8-3-ambiguity',
        title: 'Ambiguity',
        chapters: [29],
        learnerJob:
          'Separate scope readings of ordinary-language claims before selecting a first-order formula.',
        conceptIds: ['fol-scope-ambiguity'],
        objectiveIds: ['distinguish-fol-scope-readings'],
        prerequisiteConceptIds: ['fol-syntax', 'multiple-generality'],
        explanation:
          'FOL makes the scope of every quantifier and connective explicit. An English sentence may leave open whether a witness is shared, whether negation is inside a quantifier, or which phrase “only” restricts.',
        workedExample:
          '“Every analyst checked a report” may mean ∀x(Ax → ∃y(Ry ∧ Cxy)), allowing different reports, or ∃y(Ry ∧ ∀x(Ax → Cxy)), requiring one shared report.',
        guidedPrompt:
          'Which formula gives the shared-report reading of “Every analyst checked a report”?',
        guidedOptions: [
          '∃y(Ry ∧ ∀x(Ax → Cxy))',
          '∀x(Ax → ∃y(Ry ∧ Cxy))',
          '∀y(Ry → ∃x(Ax ∧ Cxy))',
        ],
        guidedCorrectOptionId: 'item-logic-8-3-ambiguity-guided-option-1',
        independentPrompt:
          'Give two readings of “Not every service passed a check” using Sx, Cy, and Pxy, and explain where negation or existential scope differs.',
        independentSolution:
          'A natural reading is ¬∀x(Sx → ∃y(Cy ∧ Pxy)), equivalently some service passed no check. A distinct reading can deny a shared-check claim: ¬∃y(Cy ∧ ∀x(Sx → Pxy)). The first denies coverage per service; the second only denies one common check.',
        commonMistake:
          'Do not grade an ambiguous English sentence against one formula until the intended scope reading has been stated.',
      },
    ],
    reviewPrompt:
      'Review well-formed FOL sentences, Russell-style descriptions, and the scope choices that distinguish competing readings.',
    checkpointPrompt:
      'Diagnose a first-order expression for free variables, uniqueness, and scope, then defend one explicit reading of an ambiguous claim.',
  },
  {
    code: '9.0',
    nodeId: 'node-logic-9-0-interpretations',
    title: 'Interpretations',
    prerequisiteConceptIds: [
      'fol-syntax',
      'definite-descriptions',
      'fol-scope-ambiguity',
    ],
    lessons: [
      {
        code: '9.1',
        nodeId: 'node-logic-9-1-extensionality',
        title: 'Extensionality',
        chapters: [30],
        learnerJob:
          'Specify predicate extensions and explain why FOL cannot distinguish predicates with the same extension merely by differences in meaning.',
        conceptIds: ['fol-extensions'],
        objectiveIds: ['specify-fol-interpretation'],
        prerequisiteConceptIds: ['fol-syntax'],
        explanation:
          'FOL is extensional: an interpretation fixes a nonempty domain, assigns names to domain members, and assigns each predicate an extension. If two predicates have the same extension, FOL cannot distinguish them merely because their ordinary-language meanings differ. One-place extensions contain objects; many-place extensions contain ordered tuples.',
        workedExample:
          'In domain {α, β}, let P mean “is on call” and Q mean “is on the response team,” but assign both the same extension {α}. The phrases have different meanings, yet P and Q have the same extension, so every atomic sentence formed with the same name gets the same truth value under this interpretation.',
        guidedPrompt:
          'In domain {α, β}, predicates P and Q have the same extension {α}, although their symbolization-key phrases have different meanings. What follows in FOL?',
        guidedOptions: [
          'FOL cannot distinguish P from Q by meaning alone on this interpretation.',
          'P and Q must have different extensions because their phrases mean different things.',
          'Neither predicate can be true of α because two predicates mention it.',
        ],
        guidedCorrectOptionId: 'item-logic-9-1-extensionality-guided-option-1',
        independentPrompt:
          'For domain {1, 2}, c denotes 1, d denotes 2, P and Q both have extension {2}, and R has extension {⟨1,2⟩}. Evaluate Pc, Qc, Pd, Qd, Rcd, and Rdc, then state what P and Q show about extensionality.',
        independentSolution:
          'Pc and Qc are false; Pd and Qd are true because both predicates have extension {2}. Rcd is true and Rdc is false because ordered-pair direction matters. Even if P and Q were keyed to phrases with different meanings, FOL treats them alike here because their extensions match.',
        commonMistake:
          'Matching extensions do not make two ordinary-language predicates synonymous; they only make FOL unable to represent their difference in meaning on that interpretation.',
      },
      {
        code: '9.2',
        nodeId: 'node-logic-9-2-truth-fol',
        title: 'Truth in FOL',
        chapters: [31],
        learnerJob:
          'Evaluate atomic, truth-functional, and quantified FOL sentences in a finite interpretation.',
        conceptIds: ['truth-in-fol'],
        objectiveIds: ['evaluate-fol-truth'],
        prerequisiteConceptIds: ['fol-extensions', 'quantifier-symbolization'],
        explanation:
          'Atomic truth follows from referents and extensions, and the familiar connectives retain their TFL truth conditions. A universal is true when every domain member satisfies its formula; an existential is true when at least one member does.',
        workedExample:
          'In domain {a, b} with P extension {a}, ∃xPx is true because a is a witness, while ∀xPx is false because b is a counterexample.',
        guidedPrompt:
          'Domain {a, b}; P has extension {a}. Which quantified sentence is true?',
        guidedOptions: ['∃xPx', '∀xPx', '¬∃xPx'],
        guidedCorrectOptionId: 'item-logic-9-2-truth-fol-guided-option-1',
        independentPrompt:
          'In domain {1, 2, 3}, let e denote 2 and E have extension {2}. Evaluate ∀x(Ex → x = e), ∃xEx, and ∀xEx.',
        independentSolution:
          '∀x(Ex → x = e) is true because the only E-object is the referent of e. ∃xEx is true with witness 2. ∀xEx is false because 1 and 3 are not in E.',
        commonMistake:
          'Quantifiers range over all domain members, including unnamed members; checking only named objects is insufficient.',
      },
      {
        code: '9.3',
        nodeId: 'node-logic-9-3-semantic-concepts',
        title: 'Semantic Concepts',
        chapters: [32],
        learnerJob:
          'Classify validity, contradiction, equivalence, entailment, and joint satisfiability across interpretations.',
        conceptIds: ['fol-semantic-concepts'],
        objectiveIds: ['classify-fol-semantic-relations'],
        prerequisiteConceptIds: ['truth-in-fol', 'logical-relations'],
        explanation:
          'FOL semantic notions quantify over interpretations rather than TFL valuations. A validity is true in every interpretation; an entailment has no interpretation with true premises and false conclusion; satisfiable sentences share at least one model.',
        workedExample:
          '∀xPx entails Pa when a is a name, because every interpretation that makes all domain members P also makes the referent of a P. By contrast, Pa does not entail ∀xPx when another domain member may fail P.',
        guidedPrompt: 'What establishes that Γ does not entail A in FOL?',
        guidedOptions: [
          'An interpretation where every sentence in Γ is true and A is false.',
          'An interpretation where A is true.',
          'A derivation of A from Γ.',
        ],
        guidedCorrectOptionId:
          'item-logic-9-3-semantic-concepts-guided-option-1',
        independentPrompt:
          'Classify the pair ∃xPx and ∀x¬Px as jointly satisfiable or unsatisfiable, and justify your answer semantically.',
        independentSolution:
          'They are jointly unsatisfiable. The existential requires a P-member, while the universal says every domain member is non-P, so no interpretation can make both true.',
        commonMistake:
          'One favorable interpretation proves satisfiability, not validity; validity requires truth in every interpretation.',
      },
    ],
    reviewPrompt:
      'Retrieve how domains, referents, extensions, satisfaction, and interpretation-wide definitions determine FOL semantics.',
    checkpointPrompt:
      'Evaluate a finite interpretation and use it to classify a semantic claim with an explicit witness or counterexample.',
  },
  {
    code: '10.0',
    nodeId: 'node-logic-10-0-relational-reasoning',
    title: 'Relational Reasoning',
    prerequisiteConceptIds: [
      'fol-extensions',
      'truth-in-fol',
      'fol-semantic-concepts',
    ],
    lessons: [
      {
        code: '10.1',
        nodeId: 'node-logic-10-1-using-interpretations',
        title: 'Using Interpretations',
        chapters: [33],
        learnerJob:
          'Construct a small counter-interpretation to refute a proposed validity, entailment, equivalence, or contradiction.',
        conceptIds: ['counter-interpretations'],
        objectiveIds: ['construct-counter-interpretation'],
        prerequisiteConceptIds: ['fol-semantic-concepts', 'fol-extensions'],
        explanation:
          'A single carefully chosen interpretation can refute a universal semantic claim. Work backward from the truth values required, choose the smallest useful domain, then assign predicate extensions and name referents to realize them.',
        workedExample:
          'To refute Pa ⊨ ∀xPx, use domain {a, b}, let the name a denote a, and let P have extension {a}. The premise is true while the conclusion is false at b.',
        guidedPrompt: 'Which interpretation refutes Pa ⊨ ∀xPx?',
        guidedOptions: [
          'Domain {a, b}; a denotes a; P = {a}.',
          'Domain {a}; a denotes a; P = {a}.',
          'Domain {a, b}; a denotes a; P = {a, b}.',
        ],
        guidedCorrectOptionId:
          'item-logic-10-1-using-interpretations-guided-option-1',
        independentPrompt:
          'Give a two-object counter-interpretation to ∃xPx ⊨ ∀xPx, including the domain and extension of P.',
        independentSolution:
          'Let the domain be {1, 2} and P = {1}. Then ∃xPx is true with witness 1, while ∀xPx is false because 2 is not P. Any isomorphic two-object model works.',
        commonMistake:
          'A counter-interpretation must satisfy every premise and falsify the conclusion at the same time.',
      },
      {
        code: '10.2',
        nodeId: 'node-logic-10-2-reasoning-about-interpretations',
        title: 'Reasoning About Interpretations',
        chapters: [34],
        learnerJob:
          'Distinguish claims settled by one interpretation from claims that require reasoning about all interpretations.',
        conceptIds: ['interpretation-reasoning'],
        objectiveIds: ['reason-across-interpretations'],
        prerequisiteConceptIds: ['counter-interpretations'],
        explanation:
          'One model proves satisfiability, and one countermodel disproves validity or entailment. Positive universal claims—validity, contradiction, equivalence, unsatisfiability, and entailment—require an argument covering every interpretation.',
        workedExample:
          'A one-object domain whose sole member is in P shows ∃xPx satisfiable. To show ∀x(Px ∨ ¬Px) valid, reason that every object in every interpretation either satisfies P or does not.',
        guidedPrompt:
          'What is enough to prove that a set of FOL sentences is satisfiable?',
        guidedOptions: [
          'One interpretation making all of them true.',
          'One interpretation making one of them false.',
          'Ten interpretations making all of them true.',
        ],
        guidedCorrectOptionId:
          'item-logic-10-2-reasoning-about-interpretations-guided-option-1',
        independentPrompt:
          'Explain why checking 100 interpretations cannot prove an FOL sentence valid, while one false interpretation can prove it invalid.',
        independentSolution:
          'Validity requires truth in every interpretation, and there are infinitely many interpretations, so 100 positive cases leave others open. A single false case directly contradicts the universal requirement and is decisive.',
        commonMistake:
          'Many supporting examples do not establish a claim quantified over every interpretation.',
      },
      {
        code: '10.3',
        nodeId: 'node-logic-10-3-properties-relations',
        title: 'Properties of Relations',
        chapters: [35],
        learnerJob:
          'Recognize and formalize reflexive, symmetric, transitive, and antisymmetric relation properties.',
        conceptIds: ['relation-properties'],
        objectiveIds: ['classify-relation-properties'],
        prerequisiteConceptIds: [
          'multiple-generality',
          'fol-semantic-concepts',
        ],
        explanation:
          'Relation properties add structure not guaranteed by an arbitrary two-place predicate. Reflexivity requires Rxx for every x; symmetry reverses every related pair; transitivity closes two-step paths; antisymmetry forces mutually related objects to be identical.',
        workedExample:
          'On {1, 2}, R = {⟨1,1⟩, ⟨2,2⟩, ⟨1,2⟩, ⟨2,1⟩} is reflexive and symmetric. It is also transitive because every required composite pair is already present.',
        guidedPrompt: 'Which formula expresses symmetry of R?',
        guidedOptions: [
          '∀x∀y(Rxy → Ryx)',
          '∀xRxx',
          '∀x∀y∀z((Rxy ∧ Ryz) → Rxz)',
        ],
        guidedCorrectOptionId:
          'item-logic-10-3-properties-relations-guided-option-1',
        independentPrompt:
          'For domain {1, 2} and R = {⟨1,1⟩, ⟨2,2⟩, ⟨1,2⟩}, classify R as reflexive, symmetric, transitive, and antisymmetric.',
        independentSolution:
          'R is reflexive because both self-pairs occur; not symmetric because ⟨1,2⟩ occurs without ⟨2,1⟩; transitive because every available two-step chain has its required result; and antisymmetric because no two distinct objects are related in both directions.',
        commonMistake:
          'Antisymmetric does not mean “never symmetric”; it forbids two distinct objects from being related both ways.',
      },
    ],
    reviewPrompt:
      'Retrieve how countermodels, all-interpretation arguments, and named relation properties support semantic reasoning.',
    checkpointPrompt:
      'Construct or diagnose a finite interpretation, then state exactly which semantic claim and relation properties it establishes.',
  },
  {
    code: '11.0',
    nodeId: 'node-logic-11-0-quantifier-identity-proofs',
    title: 'Quantifier and Identity Proofs',
    prerequisiteConceptIds: [
      'proof-strategy',
      'quantifier-symbolization',
      'fol-identity',
    ],
    lessons: [
      {
        code: '11.1',
        nodeId: 'node-logic-11-1-basic-rules-fol',
        title: 'Basic Rules for FOL',
        chapters: [36],
        learnerJob:
          'Apply universal and existential introduction and elimination while checking substitution and fresh-name restrictions.',
        conceptIds: ['fol-quantifier-rules'],
        objectiveIds: ['apply-fol-quantifier-rules'],
        prerequisiteConceptIds: ['proof-strategy', 'quantifier-symbolization'],
        explanation:
          'The quantifier rules control when a quantified claim may yield an instance and when an instance may support a quantified claim. Universal elimination instantiates any name; existential introduction generalizes from a named case. Universal introduction requires a genuinely arbitrary name, and existential elimination requires a fresh temporary witness whose identity does not leak into the conclusion.',
        workedExample:
          'From ∀x(Px → Qx) and Pa: 1. instantiate the universal as Pa → Qa by ∀E; 2. combine it with Pa by →E; 3. conclude Qa. By contrast, deriving ∀xQx from Qa is licensed by ∀I only when a occurs in no premise or undischarged assumption.',
        guidedPrompt: 'Which quantifier-rule use is licensed?',
        guidedOptions: [
          'From ∀xPx infer Pa by ∀E.',
          'From Pa, where a occurs in a premise, infer ∀xPx by ∀I.',
          'From ∃xPx infer Pa directly, without a fresh-name subproof.',
        ],
        guidedCorrectOptionId:
          'item-logic-11-1-basic-rules-fol-guided-option-1',
        independentPrompt:
          'Give a line-by-line derivation of ∃xQx from ∀x(Px → Qx) and Pa, naming every quantifier and connective rule.',
        independentSolution:
          'Reviewed derivation: 1. ∀x(Px → Qx) Premise. 2. Pa Premise. 3. Pa → Qa ∀E 1. 4. Qa →E 2,3. 5. ∃xQx ∃I 4. Self-check rubric: the instance preserves the same name throughout; →E cites both required lines; ∃I replaces the relevant name occurrence; every line is in dependency order. A different derivation is acceptable if each step is licensed, its citations are explicit, and no quantifier restriction is violated.',
        commonMistake:
          'A name used for ∀I must be arbitrary, and a name introduced inside ∃E must be fresh; a convenient letter is not automatically eligible.',
      },
      {
        code: '11.2',
        nodeId: 'node-logic-11-2-proofs-quantifiers',
        title: 'Proofs with Quantifiers',
        chapters: [37],
        learnerJob:
          'Order forward and backward proof moves so quantifier restrictions and subproof goals are satisfied.',
        conceptIds: ['quantifier-proof-strategy'],
        objectiveIds: ['construct-quantifier-proofs'],
        prerequisiteConceptIds: ['fol-quantifier-rules', 'proof-strategy'],
        explanation:
          'Proof construction combines the familiar connective strategies with quantifier-specific moves. Work backward from a universal goal using a fresh arbitrary name, forward from an existential premise using a fresh-witness subproof, and delay existential introduction or universal elimination until the needed instance is clear.',
        workedExample:
          'To derive ∀x(Px → Qx) from ∀xPx and ∀xQx, choose a fresh a, instantiate Pa and Qa, open a conditional subproof with Pa, reiterate Qa, close with →I, and only then generalize with ∀I. That order keeps a arbitrary.',
        guidedPrompt:
          'To prove ∀x(Px → Qx) from ∀xPx and ∀xQx, which ordered plan is legitimate?',
        guidedOptions: [
          'Choose a fresh name a; derive Pa and Qa by ∀E; assume Pa; reiterate Qa; close with →I; conclude ∀x(Px → Qx) by ∀I.',
          'Conclude ∀x(Px → Qx) first, then choose a name that appears in a premise.',
          'Use ∃E on ∀xPx and skip the conditional subproof.',
        ],
        guidedCorrectOptionId:
          'item-logic-11-2-proofs-quantifiers-guided-option-1',
        independentPrompt:
          'Construct a proof of ∀xQx from ∀x(Px → Qx) and ∀xPx, showing the exact order of instantiation, connective elimination, and generalization.',
        independentSolution:
          'Reviewed derivation: 1. ∀x(Px → Qx) Premise. 2. ∀xPx Premise. 3. Pa → Qa ∀E 1, with fresh a. 4. Pa ∀E 2. 5. Qa →E 3,4. 6. ∀xQx ∀I 5. Self-check rubric: a is absent from all premises; both universal instances use the same arbitrary name; the conditional is eliminated before generalization; ∀I is the final step. A different derivation is acceptable if its dependency order is valid and the ∀I name remains arbitrary.',
        commonMistake:
          'Do not generalize from a name that occurs in a premise or undischarged assumption; that object is no longer arbitrary.',
      },
      {
        code: '11.3',
        nodeId: 'node-logic-11-3-conversion-quantifiers',
        title: 'Conversion of Quantifiers',
        chapters: [38],
        learnerJob:
          'Move negation across quantifiers with the correct quantifier switch and justify the conversion.',
        conceptIds: ['quantifier-conversion'],
        objectiveIds: ['apply-quantifier-conversion'],
        prerequisiteConceptIds: [
          'fol-quantifier-rules',
          'truth-functional-connectives',
        ],
        explanation:
          'Quantifier conversion pairs negation with a quantifier switch: denying that everything is F is equivalent to saying something is not F, while denying that anything is F is equivalent to saying everything is not F. The conversion changes both the quantifier and the scope of negation.',
        workedExample:
          '¬∀xRx converts to ∃x¬Rx. Read left to right: it is not the case that every object is reliable, so at least one object is not reliable. Keeping ∀ while merely pushing the negation inward would change the claim.',
        guidedPrompt: 'Which is equivalent to ¬∃xPx?',
        guidedOptions: ['∀x¬Px', '∃x¬Px', '¬∀x¬Px'],
        guidedCorrectOptionId:
          'item-logic-11-3-conversion-quantifiers-guided-option-1',
        independentPrompt:
          'Derive or justify the equivalence between ¬∀x(Px → Qx) and ∃x(Px ∧ ¬Qx), showing each conversion or TFL equivalence used.',
        independentSolution:
          'Reviewed chain: ¬∀x(Px → Qx) is equivalent by quantifier conversion to ∃x¬(Px → Qx); replace the conditional inside the quantifier with ¬Px ∨ Qx, then apply negation and De Morgan/double negation to obtain ∃x(Px ∧ ¬Qx). Self-check rubric: the outer ∀ becomes ∃; negation remains over the whole matrix until the TFL transformation; the final witness satisfies P and fails Q. A different derivation is acceptable if every equivalence preserves scope and the endpoints are interderivable.',
        commonMistake:
          'Pushing negation across a quantifier without switching ∀ and ∃ produces a non-equivalent formula.',
      },
      {
        code: '11.4',
        nodeId: 'node-logic-11-4-rules-identity',
        title: 'Rules for Identity',
        chapters: [39],
        learnerJob:
          'Use identity introduction for reflexivity and identity elimination to substitute co-referring names in a controlled proof step.',
        conceptIds: ['identity-proof-rules'],
        objectiveIds: ['apply-identity-proof-rules'],
        prerequisiteConceptIds: ['fol-identity', 'fol-quantifier-rules'],
        explanation:
          'Identity introduction licenses a = a without premises. Identity elimination uses a = b plus a formula containing one name to replace one or more eligible occurrences with the other. Substitution transfers a property or relation; it does not manufacture identity from merely similar descriptions.',
        workedExample:
          'From a = b and Rab: 1. cite a = b; 2. replace the first occurrence of a in Rab with b by =E; 3. obtain Rbb. The identity statement is cited before the formula being transformed.',
        guidedPrompt:
          'From a = b and Pa, which conclusion follows directly by =E?',
        guidedOptions: ['Pb', 'a = a only', '∀xPx'],
        guidedCorrectOptionId: 'item-logic-11-4-rules-identity-guided-option-1',
        independentPrompt:
          'Prove ∀x∀y(x = y → y = x) using =I, =E, conditional introduction, and universal introduction.',
        independentSolution:
          'Reviewed derivation: choose fresh a and b; assume a = b; write a = a by =I; use =E with a = b to replace the first a in a = a, yielding b = a; discharge the assumption to get a = b → b = a; generalize over b and then a by ∀I. Self-check rubric: both names are fresh; =I creates only reflexive identity; =E performs the symmetry-producing substitution; the assumption is discharged before either ∀I. A different derivation is acceptable if it proves symmetry without assuming it and respects both universal-introduction restrictions.',
        commonMistake:
          'Identity elimination needs an identity premise; sharing every listed predicate does not by itself prove that two names denote one object.',
      },
    ],
    reviewPrompt:
      'Retrieve quantifier-rule restrictions, proof-order strategy, conversion laws, and identity substitution without treating names as arbitrary by default.',
    checkpointPrompt:
      'Construct or diagnose a quantified proof, citing each line and checking fresh-name, scope, subproof, and identity-substitution conditions.',
  },
  {
    code: '12.0',
    nodeId: 'node-logic-12-0-proof-mastery',
    title: 'Proof Mastery',
    prerequisiteConceptIds: [
      'fol-quantifier-rules',
      'quantifier-proof-strategy',
      'identity-proof-rules',
    ],
    lessons: [
      {
        code: '12.1',
        nodeId: 'node-logic-12-1-derived-rules',
        title: 'Derived Rules',
        chapters: [40],
        learnerJob:
          'Justify quantifier-conversion shortcuts by expanding them into basic-rule derivations.',
        conceptIds: ['fol-derived-rules'],
        objectiveIds: ['justify-derived-quantifier-rules'],
        prerequisiteConceptIds: ['quantifier-conversion', 'derived-rules'],
        explanation:
          'A quantifier-conversion rule is derived when every use can be expanded into the basic quantifier and connective rules. The shortcut is safe because it compresses an available derivation rather than adding a new consequence.',
        workedExample:
          'Expand ¬∀xPx to ∃x¬Px using only basic rules: 1. ¬∀xPx Premise. 2. Assume ¬∃x¬Px for indirect proof. 3. Choose a fresh arbitrary name a. 4. Assume ¬Pa. 5. Infer ∃x¬Px by ∃I from line 4. 6. Derive ⊥ from assumption 2 and line 5. 7. Discharge the nested assumption by ¬I to obtain ¬¬Pa. 8. Infer Pa by DNE. 9. Infer ∀xPx by ∀I; a occurs in no premise or undischarged assumption. 10. Derive ⊥ from premise 1 and line 9. 11. Discharge assumption 2 by ¬I to obtain ¬¬∃x¬Px. 12. Infer ∃x¬Px by DNE. This dependency order derives the CQ direction without using CQ in its own justification.',
        guidedPrompt: 'What proves that a CQ rule is derived rather than new?',
        guidedOptions: [
          'A basic-rule derivation can replace every CQ use.',
          'CQ changes the semantics of ∀ and ∃.',
          'CQ may cite lines inside closed subproofs.',
        ],
        guidedCorrectOptionId: 'item-logic-12-1-derived-rules-guided-option-1',
        independentPrompt:
          'Outline a basic-rule derivation that justifies one direction of ¬∃xPx therefore ∀x¬Px, naming the contradiction and discharge steps.',
        independentSolution:
          'Reviewed outline: choose fresh a; assume Pa; infer ∃xPx by ∃I; contradict ¬∃xPx; discharge Pa to obtain ¬Pa; because a is arbitrary and absent from the premise, infer ∀x¬Px by ∀I. Self-check rubric: the witness name is fresh; ∃I supplies the sentence contradicted by the premise; the assumption is discharged before ∀I; the final generalization meets its restriction. A different derivation is acceptable if it expands the CQ direction using only authorized basic rules.',
        commonMistake:
          'Calling a transformation intuitive does not establish it as a derived rule; the expansion must obey every basic-rule restriction.',
      },
      {
        code: '12.2',
        nodeId: 'node-logic-12-2-proofs-semantics',
        title: 'Proofs and Semantics',
        chapters: [41],
        learnerJob:
          'Choose a proof or an interpretation as the efficient witness for a positive or negative logical claim while keeping turnstiles distinct.',
        conceptIds: ['proofs-and-semantics'],
        objectiveIds: ['choose-proof-or-model'],
        prerequisiteConceptIds: ['fol-derived-rules', 'fol-semantic-concepts'],
        explanation:
          'Derivability and semantic entailment are different definitions even when soundness and completeness connect them. A proof is a finite certificate for derivability. One interpretation refutes entailment, and a counter-interpretation may have any nonempty domain allowed by FOL. By contrast, establishing entailment semantically must cover every interpretation. Pick the method whose polarity matches the task.',
        workedExample:
          'To establish Pa ⊨ ∃xPx, either give the two-line proof Pa, then ∃xPx by ∃I, or argue semantically that the referent of a is a witness. To refute ∃xPx ⊨ ∀xPx, one two-object counter-interpretation is decisive.',
        guidedPrompt:
          'What is the most direct certificate that Γ does not entail A?',
        guidedOptions: [
          'One interpretation making every sentence in Γ true and A false.',
          'One proof of A from Γ.',
          'A list of formulas with no truth assignments.',
        ],
        guidedCorrectOptionId:
          'item-logic-12-2-proofs-semantics-guided-option-1',
        independentPrompt:
          'For ∀x(Px → Qx), ∃xPx ⊨ ∃xQx, give either a formal derivation or a semantic argument and explain why your certificate establishes entailment.',
        independentSolution:
          'Reviewed derivation: take the existential premise with fresh witness a in an ∃E subproof; instantiate the universal as Pa → Qa; derive Qa; introduce ∃xQx; close ∃E. Self-check rubric: the witness is fresh; the conclusion contains no leaked witness name; the universal premise is instantiated inside the subproof; the final existential claim follows outside it. A different derivation is acceptable if it is formally licensed, or a semantic argument is acceptable if it covers every interpretation rather than one example.',
        commonMistake:
          'A model can prove satisfiability or refute entailment, but one favorable model cannot establish a claim about every interpretation.',
      },
      {
        code: '12.3',
        nodeId: 'node-logic-12-3-normal-forms',
        title: 'Normal Forms',
        chapters: [45],
        learnerJob:
          'Recognize and construct equivalent disjunctive and conjunctive normal forms from decisive truth-table rows.',
        conceptIds: ['normal-forms'],
        objectiveIds: ['construct-normal-forms'],
        prerequisiteConceptIds: [
          'complete-truth-tables',
          'tfl-semantic-properties',
        ],
        explanation:
          'DNF is a disjunction of conjunctions of literals; CNF is a conjunction of disjunctions of literals. Negation has minimal scope in both. A complete truth table constructs DNF from its true rows and CNF from its false rows, guaranteeing an equivalent formula.',
        workedExample:
          'For A ↔ B, the true rows TT and FF yield DNF (A ∧ B) ∨ (¬A ∧ ¬B). The false rows TF and FT yield CNF (¬A ∨ B) ∧ (A ∨ ¬B). Each form matches the original column on all four rows.',
        guidedPrompt: 'Which formula is in DNF?',
        guidedOptions: [
          '(A ∧ ¬B) ∨ (¬A ∧ B)',
          '(A ∨ B) ∧ (¬A ∨ C)',
          '¬(A ∨ B) → C',
        ],
        guidedCorrectOptionId: 'item-logic-12-3-normal-forms-guided-option-1',
        independentPrompt:
          'Construct one DNF and one CNF equivalent to A → B, and verify each against the conditional false row.',
        independentSolution:
          'Reviewed answers include DNF ¬A ∨ B and CNF ¬A ∨ B. ¬A ∨ B contains two literals: it is DNF as a disjunction of one-literal conjunctions and CNF as one disjunctive clause. It is false only when A is true and B is false. Self-check rubric: only ¬, ∧, and ∨ appear; every negation has atomic scope; the DNF has no disjunction inside a conjunction; the CNF has no conjunction inside a disjunction; the truth values match A → B. A different derivation is acceptable if the proposed forms satisfy the structural tests and match all four rows.',
        commonMistake:
          'Normal form is a structural condition, not merely a formula that happens to use conjunction or disjunction.',
      },
      {
        code: '12.4',
        nodeId: 'node-logic-12-4-functional-completeness',
        title: 'Functional Completeness',
        chapters: [46],
        learnerJob:
          'Explain functional completeness and test whether a proposed connective basis can express every truth function.',
        conceptIds: ['functional-completeness'],
        objectiveIds: ['evaluate-functional-completeness'],
        prerequisiteConceptIds: [
          'normal-forms',
          'truth-functional-connectives',
        ],
        explanation:
          'A set of connectives is functionally complete when formulas using only that set can realize every possible truth table. Normal forms use ¬, ∧, and ∨. After recovering ¬ and ∧ from NAND, define disjunction by A ∨ B ≡ ¬(¬A ∧ ¬B); the recovered {¬, ∧, ∨} normal-form basis is functionally complete. NOR supports the analogous recovery, so either NAND or NOR can serve alone.',
        workedExample:
          'Let A | B mean NAND. Then ¬A is A | A. Conjunction is ¬(A | B), written using only NAND as (A | B) | (A | B). Now use A ∨ B ≡ ¬(¬A ∧ ¬B): replace each negation and conjunction in that definition with its NAND formula. NAND therefore recovers the full {¬, ∧, ∨} basis used by normal forms, which establishes functional completeness.',
        guidedPrompt: 'Why is disjunction alone not functionally complete?',
        guidedOptions: [
          'Any formula built only from ∨ is true when every input is true, so it cannot express negation.',
          'Disjunction has two inputs rather than one.',
          'Disjunction cannot appear in a truth table.',
        ],
        guidedCorrectOptionId:
          'item-logic-12-4-functional-completeness-guided-option-1',
        independentPrompt:
          'Using NAND notation A | B, express ¬A and A ∧ B, then explain why those definitions support functional completeness.',
        independentSolution:
          'Reviewed definitions: ¬A is A | A; A ∧ B is (A | B) | (A | B). NAND first negates the conjunction, and the repeated NAND negates that result. Next recover disjunction with A ∨ B ≡ ¬(¬A ∧ ¬B), replacing ¬ and ∧ by those NAND definitions. Thus the recovered {¬, ∧, ∨} normal-form basis is functionally complete. Self-check rubric: evaluate the negation and conjunction definitions on every input row; show the disjunction bridge; use only NAND in the expanded formulas; connect the recovered basis to the normal-form theorem. A different derivation is acceptable if its NAND-only formulas have the required truth tables and the completeness argument includes the bridge to a known complete basis.',
        commonMistake:
          'Showing that a basis expresses several familiar connectives is not enough unless those connectives are themselves known to generate every truth function.',
      },
      {
        code: '12.5',
        nodeId: 'node-logic-12-5-proving-equivalences',
        title: 'Proving Equivalences',
        chapters: [47],
        learnerJob:
          'Build a checkable chain of equivalence-preserving replacements and use it to reach a requested normal form.',
        conceptIds: ['equivalence-transformations'],
        objectiveIds: ['prove-equivalence-chain'],
        prerequisiteConceptIds: ['normal-forms', 'functional-completeness'],
        explanation:
          'Equivalent formulas may replace one another inside a larger formula without changing its truth value. A chain records one local law per step—such as conditional elimination, De Morgan, double negation, distribution, or absorption—so the whole transformation remains auditable.',
        workedExample:
          'Transform ¬(A → B): first replace A → B with ¬A ∨ B; apply De Morgan to get ¬¬A ∧ ¬B; apply double negation to reach A ∧ ¬B. Each replacement targets a displayed subformula and names one equivalence.',
        guidedPrompt: 'What is the legitimate next step after ¬(¬A ∨ B)?',
        guidedOptions: [
          '¬¬A ∧ ¬B by De Morgan.',
          '¬A ∧ B by commutativity.',
          'A ∨ ¬B by identity elimination.',
        ],
        guidedCorrectOptionId:
          'item-logic-12-5-proving-equivalences-guided-option-1',
        independentPrompt:
          'Give a named equivalence chain converting ¬(A ∧ (B ∨ C)) into DNF, one local replacement per line.',
        independentSolution:
          'Reviewed chain: ¬(A ∧ (B ∨ C)); ¬A ∨ ¬(B ∨ C) by De Morgan; ¬A ∨ (¬B ∧ ¬C) by De Morgan. This is DNF: a disjunction whose second disjunct is a conjunction of literals. Self-check rubric: each line changes one displayed subformula under a named equivalence; negations finish with atomic scope; the last formula satisfies the DNF structural conditions; endpoints agree on every valuation. A different derivation is acceptable if every replacement is equivalence-preserving and the final formula is genuinely in DNF.',
        commonMistake:
          'An algebraic-looking rewrite is not a proof of equivalence unless the replaced subformula and governing equivalence are identifiable.',
      },
    ],
    reviewPrompt:
      'Connect derived quantifier rules, proof-semantic certificates, normal forms, functional completeness, and equivalence chains into one auditable toolkit.',
    checkpointPrompt:
      'Choose and complete a proof, countermodel, normal-form construction, or equivalence chain, then audit every dependency and transformation.',
  },
]

export function buildLogicFoundationsPack(): LearningPackDocuments {
  return buildCanonicalPack().documents
}

export async function writeLogicFoundationsPack(
  outputDirectory: string,
): Promise<void> {
  const outputPath = resolve(outputDirectory)
  const parentDirectory = dirname(outputPath)
  await mkdir(parentDirectory, { recursive: true })

  const temporaryDirectory = await mkdtemp(
    join(parentDirectory, `.${basename(outputPath)}-write-`),
  )
  const backupDirectory = `${temporaryDirectory}-previous`
  let movedExistingOutput = false

  try {
    await writeFilesToDirectory(temporaryDirectory, buildCanonicalPack().files)
    const loaded = await loadLearningPackDirectory(temporaryDirectory)

    if (!('documents' in loaded)) {
      throw new Error(
        `Written Logic Foundations pack validation failed: ${loaded.diagnostics
          .map((diagnostic) => `${diagnostic.code} at ${diagnostic.path}`)
          .join('; ')}`,
      )
    }

    if (await pathExists(outputPath)) {
      await rename(outputPath, backupDirectory)
      movedExistingOutput = true
    }

    await rename(temporaryDirectory, outputPath)

    if (movedExistingOutput) {
      await rm(backupDirectory, { force: true, recursive: true })
    }
  } catch (error: unknown) {
    if (
      movedExistingOutput &&
      !(await pathExists(outputPath)) &&
      (await pathExists(backupDirectory))
    ) {
      await rename(backupDirectory, outputPath)
    }
    throw error
  } finally {
    await rm(temporaryDirectory, { force: true, recursive: true })
    if ((await pathExists(outputPath)) && (await pathExists(backupDirectory))) {
      await rm(backupDirectory, { force: true, recursive: true })
    }
  }
}

function buildCanonicalPack(): LoadedLearningPack {
  const documents = buildSourceDocuments()
  const files = documentFiles(documents)
  const canonical = canonicalizePackFilesForPacking(files)

  if (!('documents' in canonical)) {
    throw new Error(
      `Logic Foundations pack validation failed: ${canonical.diagnostics
        .map((diagnostic) => `${diagnostic.code} at ${diagnostic.path}`)
        .join('; ')}`,
    )
  }

  return canonical
}

function buildSourceDocuments(): LearningPackDocuments {
  const lessons = logicFoundationsModules.flatMap((module) => module.lessons)
  const items = logicFoundationsModules.flatMap(buildModuleItems)
  const sets = [
    ...logicFoundationsModules.flatMap(buildModuleSets),
    ...buildCourseSets(),
  ]
  const resources = lessons.flatMap(buildLessonResources)
  const conceptIds = unique(lessons.flatMap((lesson) => lesson.conceptIds))
  const objectiveIds = unique(lessons.flatMap((lesson) => lesson.objectiveIds))

  return {
    manifest: {
      schemaVersion: SCHEMA_VERSION,
      packId: 'logic',
      version: '1.0.0',
      title: 'Logic Foundations',
      summary:
        'A guided introduction to arguments, formal languages, semantics, and proof.',
      language: 'en-US',
      license: source.license,
      authors: [{ name: 'Concourse' }],
      releasedAt: '2026-07-11T00:00:00.000Z',
      capabilities: {
        required: [
          { capabilityId: 'core.learning-pack', version: SCHEMA_VERSION },
        ],
        optional: [],
      },
      files: manifestFiles(),
      homepageUrl: source.canonicalUrl,
      keywords: ['logic', 'reasoning', 'arguments', 'semantics', 'proof'],
    },
    catalog: {
      schemaVersion: SCHEMA_VERSION,
      subjects: [
        {
          subjectId: 'logic',
          title: 'Logic Foundations',
          summary:
            'Learn to analyze arguments and reason precisely with formal tools.',
          tags: ['logic', 'reasoning', 'philosophy'],
          conceptIds,
          objectiveIds,
          courseIds: ['logic-foundations'],
        },
      ],
      concepts: conceptIds.map((conceptId) => ({
        conceptId,
        title: titleFromId(conceptId),
        summary: conceptSummary(conceptId),
        tags: ['logic', 'foundations'],
        prerequisiteConceptIds: prerequisiteConceptIdsFor(conceptId),
        relatedConceptIds: relatedConceptIdsFor(conceptId),
        resourceLinks: lessons
          .filter((lesson) => lesson.conceptIds.includes(conceptId))
          .flatMap((lesson) => lessonResourceLinks(lesson)),
      })),
      objectives: objectiveIds.map((objectiveId) => ({
        objectiveId,
        statement: objectiveStatement(objectiveId),
        successCriteria: [objectiveSuccessCriterion(objectiveId)],
        conceptIds: unique(
          lessons
            .filter((lesson) => lesson.objectiveIds.includes(objectiveId))
            .flatMap((lesson) => lesson.conceptIds),
        ),
        resourceLinks: lessons
          .filter((lesson) => lesson.objectiveIds.includes(objectiveId))
          .flatMap((lesson) => lessonResourceLinks(lesson)),
      })),
    },
    courses: {
      schemaVersion: SCHEMA_VERSION,
      courses: [
        {
          courseId: 'logic-foundations',
          title: 'Logic Foundations',
          summary:
            'Twelve modules from argument analysis through first-order proof and formal equivalence.',
          subjectIds: ['logic'],
          tags: ['logic', 'self-paced'],
          rootNodes: logicFoundationsModules.map(buildModuleNode),
        },
      ],
    },
    items: { schemaVersion: SCHEMA_VERSION, items },
    sets: { schemaVersion: SCHEMA_VERSION, sets },
    resources: { schemaVersion: SCHEMA_VERSION, resources },
    theme: {
      schemaVersion: SCHEMA_VERSION,
      themeId: 'theme-logic-foundations',
      displayName: 'Logic Foundations',
      accentColor: '#7655C9',
      backgroundRole: 'system',
      iconAssetId: null,
      coverAssetId: null,
    },
  }
}

function buildModuleItems(module: LogicModule): LearningItem[] {
  const lessonItems = module.lessons.flatMap(buildLessonItems)
  const plan = moduleItemPlan(module)
  const concepts = unique([
    ...module.prerequisiteConceptIds,
    ...module.lessons.flatMap((lesson) => lesson.conceptIds),
  ])
  const objectives = unique(
    module.lessons.flatMap((lesson) => lesson.objectiveIds),
  )

  return [
    ...(plan.hasOrientation
      ? [
          choiceItem({
            itemId: orientationItemIdFor(module),
            title: `${module.code} Orientation`,
            prompt: `Which goal best describes ${module.title}?`,
            options: [
              module.reviewPrompt,
              'Memorize notation without connecting it to reasoning.',
              'Skip the authored sequence and guess from surface wording.',
            ],
            correctOption: 0,
            solution: module.reviewPrompt,
            conceptIds: concepts,
            objectiveIds: objectives,
          }),
        ]
      : []),
    ...lessonItems,
    ...plan.reviewLessons.map((lesson, index) =>
      choiceItem({
        itemId: reviewItemIdFor(module, index),
        title: `${module.code} Review: ${lesson.title}`,
        prompt: lesson.guidedPrompt,
        options: lesson.guidedOptions,
        correctOption: guidedCorrectOptionIndex(lesson),
        solution: guidedFeedbackFor(lesson),
        conceptIds: lesson.conceptIds,
        objectiveIds: lesson.objectiveIds,
      }),
    ),
    ...plan.checkpointLessons.map((lesson, index) =>
      selfGradeItem({
        itemId: checkpointItemIdFor(module, index),
        title: `${module.code} Checkpoint: ${lesson.title}`,
        prompt: `${module.checkpointPrompt} ${lesson.independentPrompt}`,
        solution: lesson.independentSolution,
        conceptIds: lesson.conceptIds,
        objectiveIds: lesson.objectiveIds,
      }),
    ),
  ]
}

function buildLessonItems(lesson: LogicLesson): LearningItem[] {
  const guidedItemId = guidedItemIdFor(lesson)

  return [
    choiceItem({
      itemId: guidedItemId,
      title: `${lesson.code} Guided Check`,
      prompt: lesson.guidedPrompt,
      options: lesson.guidedOptions,
      correctOption: guidedCorrectOptionIndex(lesson),
      solution: guidedFeedbackFor(lesson),
      conceptIds: lesson.conceptIds,
      objectiveIds: lesson.objectiveIds,
    }),
    selfGradeItem({
      itemId: independentItemIdFor(lesson),
      title: `${lesson.code} Independent Check`,
      prompt: lesson.independentPrompt,
      solution: lesson.independentSolution,
      conceptIds: lesson.conceptIds,
      objectiveIds: lesson.objectiveIds,
    }),
  ]
}

function buildModuleSets(module: LogicModule): StudySet[] {
  const lessonItemIds = module.lessons.flatMap((lesson) => [
    guidedItemIdFor(lesson),
    independentItemIdFor(lesson),
  ])
  const supplementalItemIds = moduleSupplementalItemIds(module)

  return [
    {
      setId: deckIdFor(module),
      kind: 'deck',
      title: `${module.code} ${module.title} Review`,
      summary: `Retrieve the key ideas from ${module.title}.`,
      selection: { kind: 'explicit', itemIds: lessonItemIds },
      playModes: ['flashcard'],
      ordering: 'authored',
      timeLimitSeconds: null,
      attemptLimit: null,
    },
    {
      setId: checkpointSetIdFor(module),
      kind: 'quiz',
      title: `${module.code} ${module.title} Checkpoint`,
      summary: module.checkpointPrompt,
      selection: {
        kind: 'explicit',
        itemIds: supplementalItemIds,
      },
      playModes: ['single-choice-quiz', 'self-grade-review'],
      ordering: 'shuffle',
      timeLimitSeconds: null,
      attemptLimit: null,
    },
  ]
}

function buildCourseSets(): StudySet[] {
  return [
    {
      setId: 'set-logic-cumulative-review',
      kind: 'deck',
      title: 'Logic Foundations Cumulative Review',
      summary:
        'Retrieve one foundational idea from every module in authored course order.',
      selection: {
        kind: 'explicit',
        itemIds: [
          'item-logic-1-1-arguments-guided',
          'item-logic-2-1-first-steps-symbolization-guided',
          'item-logic-3-1-characteristic-truth-tables-guided',
          'item-logic-4-1-limitations-of-tfl-guided',
          'item-logic-5-1-idea-natural-deduction-guided',
          'item-logic-6-1-additional-rules-tfl-guided',
          'item-logic-7-1-building-blocks-fol-guided',
          'item-logic-8-1-sentences-fol-guided',
          'item-logic-9-1-extensionality-guided',
          'item-logic-10-1-using-interpretations-guided',
          'item-logic-11-1-basic-rules-fol-guided',
          'item-logic-12-1-derived-rules-guided',
        ],
      },
      playModes: ['flashcard'],
      ordering: 'authored',
      timeLimitSeconds: null,
      attemptLimit: null,
    },
    {
      setId: 'set-logic-final-transfer',
      kind: 'quiz',
      title: 'Logic Foundations Final Mixed Transfer',
      summary:
        'Transfer semantic, symbolic, proof, and metatheoretic skills across the full course.',
      selection: {
        kind: 'explicit',
        itemIds: [
          'item-logic-1-0-checkpoint-1',
          'item-logic-2-2-connectives-guided',
          'item-logic-3-0-checkpoint-1',
          'item-logic-4-2-truth-table-shortcuts-guided',
          'item-logic-5-0-checkpoint-1',
          'item-logic-6-2-proof-theoretic-concepts-guided',
          'item-logic-7-0-checkpoint-1',
          'item-logic-8-2-definite-descriptions-guided',
          'item-logic-9-0-checkpoint-1',
          'item-logic-10-2-reasoning-about-interpretations-guided',
          'item-logic-11-2-proofs-quantifiers-independent',
          'item-logic-11-3-conversion-quantifiers-independent',
          'item-logic-12-3-normal-forms-independent',
          'item-logic-12-4-functional-completeness-independent',
          'item-logic-12-5-proving-equivalences-independent',
        ],
      },
      playModes: ['single-choice-quiz', 'self-grade-review'],
      ordering: 'shuffle',
      timeLimitSeconds: null,
      attemptLimit: null,
    },
  ]
}

function buildModuleNode(module: LogicModule): CurriculumNode {
  const concepts = unique([
    ...module.prerequisiteConceptIds,
    ...module.lessons.flatMap((lesson) => lesson.conceptIds),
  ])
  const objectives = unique(
    module.lessons.flatMap((lesson) => lesson.objectiveIds),
  )
  const plan = moduleItemPlan(module)
  const lessonNodes = module.lessons.map(buildLessonNode)
  const reviewNodeId = `${module.nodeId}-review`
  const checkpointNodeId = `${module.nodeId}-checkpoint`
  const orientationItemIds = plan.hasOrientation
    ? [orientationItemIdFor(module)]
    : []
  const reviewItemIds = plan.reviewLessons.map((_, index) =>
    reviewItemIdFor(module, index),
  )
  const checkpointItemIds = plan.checkpointLessons.map((_, index) =>
    checkpointItemIdFor(module, index),
  )

  return {
    nodeId: module.nodeId,
    kind: 'module',
    title: `${module.code} ${module.title}`,
    summary: module.reviewPrompt,
    itemIds: orientationItemIds,
    conceptIds: concepts,
    objectiveIds: objectives,
    children: [
      ...lessonNodes,
      {
        nodeId: reviewNodeId,
        kind: 'lesson',
        title: `${moduleNumber(module)}.8 Review`,
        summary: module.reviewPrompt,
        itemIds: reviewItemIds,
        conceptIds: concepts,
        objectiveIds: objectives,
        children: [],
        entries: [
          ...reviewItemIds.map((itemId) => ({
            kind: 'item' as const,
            itemId,
          })),
          { kind: 'study-set', studySetId: deckIdFor(module) },
        ],
        customKindLabel: null,
      },
      {
        nodeId: checkpointNodeId,
        kind: 'lesson',
        title: `${moduleNumber(module)}.9 Checkpoint`,
        summary: module.checkpointPrompt,
        itemIds: checkpointItemIds,
        conceptIds: concepts,
        objectiveIds: objectives,
        children: [],
        entries: [
          ...checkpointItemIds.map((itemId) => ({
            kind: 'item' as const,
            itemId,
          })),
          { kind: 'study-set', studySetId: checkpointSetIdFor(module) },
        ],
        customKindLabel: null,
      },
    ],
    entries: [
      ...orientationItemIds.map((itemId) => ({
        kind: 'item' as const,
        itemId,
      })),
      ...lessonNodes.map((lesson) => ({
        kind: 'child-node' as const,
        nodeId: lesson.nodeId,
      })),
      { kind: 'child-node', nodeId: reviewNodeId },
      { kind: 'child-node', nodeId: checkpointNodeId },
    ],
    customKindLabel: null,
  }
}

function moduleItemPlan(module: LogicModule): {
  hasOrientation: boolean
  reviewLessons: readonly LogicLesson[]
  checkpointLessons: readonly LogicLesson[]
} {
  switch (module.lessons.length) {
    case 3:
      return {
        hasOrientation: true,
        reviewLessons: module.lessons.slice(0, 2),
        checkpointLessons: module.lessons,
      }
    case 4:
      return {
        hasOrientation: true,
        reviewLessons: module.lessons.slice(0, 2),
        checkpointLessons: module.lessons.slice(-1),
      }
    case 5:
      return {
        hasOrientation: false,
        reviewLessons: module.lessons.slice(0, 1),
        checkpointLessons: module.lessons.slice(-1),
      }
    default:
      throw new Error(
        `Logic module ${module.code} must contain three, four, or five source lessons.`,
      )
  }
}

function moduleSupplementalItemIds(module: LogicModule): string[] {
  const plan = moduleItemPlan(module)
  return [
    ...(plan.hasOrientation ? [orientationItemIdFor(module)] : []),
    ...plan.reviewLessons.map((_, index) => reviewItemIdFor(module, index)),
    ...plan.checkpointLessons.map((_, index) =>
      checkpointItemIdFor(module, index),
    ),
  ]
}

function moduleItemPrefix(module: LogicModule): string {
  return `item-logic-${module.code.replace('.', '-')}`
}

function orientationItemIdFor(module: LogicModule): string {
  return `${moduleItemPrefix(module)}-orientation`
}

function reviewItemIdFor(module: LogicModule, index: number): string {
  return `${moduleItemPrefix(module)}-review-${String(index + 1)}`
}

function checkpointItemIdFor(module: LogicModule, index: number): string {
  return `${moduleItemPrefix(module)}-checkpoint-${String(index + 1)}`
}

function guidedCorrectOptionIndex(lesson: LogicLesson): number {
  const guidedItemId = guidedItemIdFor(lesson)
  return lesson.guidedOptions.findIndex(
    (_, index) =>
      `${guidedItemId}-option-${String(index + 1)}` ===
      lesson.guidedCorrectOptionId,
  )
}

function guidedFeedbackFor(lesson: LogicLesson): string {
  const correctOption = lesson.guidedOptions[guidedCorrectOptionIndex(lesson)]
  if (correctOption === undefined) {
    throw new Error(`Missing guided feedback option for ${lesson.code}.`)
  }
  return `Correct answer: “${correctOption}” because it matches the lesson's governing explanation: ${lesson.explanation} Common-mistake guidance: ${lesson.commonMistake}`
}

function buildLessonNode(lesson: LogicLesson): CurriculumNode {
  return {
    nodeId: lesson.nodeId,
    kind: 'lesson',
    title: `${lesson.code} ${lesson.title}`,
    summary: lesson.learnerJob,
    itemIds: [guidedItemIdFor(lesson), independentItemIdFor(lesson)],
    conceptIds: [...lesson.conceptIds],
    objectiveIds: [...lesson.objectiveIds],
    children: [],
    entries: [
      { kind: 'resource', resourceId: embeddedResourceIdFor(lesson) },
      { kind: 'resource', resourceId: sourceResourceIdFor(lesson) },
      { kind: 'item', itemId: guidedItemIdFor(lesson) },
      { kind: 'item', itemId: independentItemIdFor(lesson) },
    ],
    customKindLabel: null,
  }
}

function buildLessonResources(lesson: LogicLesson): LearningResource[] {
  const chapterLabel = lesson.chapters
    .map((chapter) => `Chapter ${String(chapter)}`)
    .join(', ')
  const canonicalUrl = lessonSourceUrl(lesson)

  return [
    {
      id: embeddedResourceIdFor(lesson),
      contentRevision: 1,
      title: `${lesson.code} ${lesson.title}: explanation and worked example`,
      summary: lesson.learnerJob,
      modality: 'text',
      roles: ['explanation', 'worked-example'],
      conceptIds: [...lesson.conceptIds],
      objectiveIds: [...lesson.objectiveIds],
      difficulty: 'introductory',
      language: 'en-US',
      source: {
        kind: 'embedded-content',
        content: [
          textBlock(lesson.explanation),
          calloutBlock('tip', `Worked example: ${lesson.workedExample}`),
          calloutBlock('warning', `Common mistake: ${lesson.commonMistake}`),
        ],
      },
      tags: ['logic', 'lesson'],
      provenance: {
        author: 'Concourse',
        sourceTitle: source.title,
        license: source.license,
        licenseUrl: source.licenseUrl,
        canonicalUrl,
        attributionText: source.attribution,
        contentOwnership: 'pack-authored',
      },
      accessibility: {
        screenReaderOptimized: true,
        textAlternativeAvailable: true,
        language: 'en-US',
      },
    },
    {
      id: sourceResourceIdFor(lesson),
      contentRevision: 1,
      title: `${source.title}: ${chapterLabel}`,
      summary: `Primary curriculum reference for ${lesson.code} ${lesson.title}.`,
      modality: 'text',
      roles: ['reference'],
      conceptIds: [...lesson.conceptIds],
      objectiveIds: [...lesson.objectiveIds],
      difficulty: 'introductory',
      language: 'en-US',
      source: {
        kind: 'bibliographic-reference',
        title: source.title,
        authors: [...source.authors],
        publisher: 'Open Logic Project',
        chapter: chapterLabel,
        canonicalUrl,
        citationText: `${source.title}, ${chapterLabel}.`,
      },
      tags: ['logic', 'source'],
      provenance: {
        author: source.authors.join(', '),
        publisher: 'Open Logic Project',
        sourceTitle: source.title,
        license: source.license,
        licenseUrl: source.licenseUrl,
        canonicalUrl,
        attributionText: source.attribution,
        contentOwnership: 'external-link-only',
      },
      accessibility: { language: 'en-US' },
    },
  ]
}

function choiceItem(input: {
  itemId: string
  title: string
  prompt: string
  options: readonly string[]
  correctOption: number
  solution: string
  conceptIds: readonly string[]
  objectiveIds: readonly string[]
}): LearningItem {
  if (input.correctOption < 0 || input.correctOption >= input.options.length) {
    throw new Error(`Missing correct option for ${input.itemId}.`)
  }

  const options = input.options.map((label, index) => ({
    optionId: `${input.itemId}-option-${String(index + 1)}`,
    label,
    contentBlocks: [],
  }))
  const correctOptionId = options[input.correctOption]?.optionId

  if (correctOptionId === undefined) {
    throw new Error(`Missing correct option for ${input.itemId}.`)
  }

  return {
    itemId: input.itemId,
    learningRevision: 1,
    title: input.title,
    promptBlocks: [questionBlock(input.prompt)],
    response: {
      kind: 'single-choice',
      options,
      textInput: null,
      numberInput: null,
    },
    evaluation: {
      kind: 'choice-selection',
      correctOptionIds: [correctOptionId],
      acceptedAnswers: [],
      caseSensitive: false,
      trimWhitespace: true,
      expectedNumber: null,
      absoluteTolerance: null,
      passingSelfGrades: [],
    },
    reviewedSolutionBlocks: [textBlock(input.solution)],
    conceptIds: [...input.conceptIds],
    objectiveIds: [...input.objectiveIds],
    allowedPlayModes: ['single-choice-quiz', 'flashcard'],
  }
}

function selfGradeItem(input: {
  itemId: string
  title: string
  prompt: string
  solution: string
  conceptIds: readonly string[]
  objectiveIds: readonly string[]
}): LearningItem {
  return {
    itemId: input.itemId,
    learningRevision: 1,
    title: input.title,
    promptBlocks: [questionBlock(input.prompt)],
    response: {
      kind: 'self-grade',
      options: [],
      textInput: null,
      numberInput: null,
    },
    evaluation: {
      kind: 'self-grade',
      correctOptionIds: [],
      acceptedAnswers: [],
      caseSensitive: false,
      trimWhitespace: true,
      expectedNumber: null,
      absoluteTolerance: null,
      passingSelfGrades: ['good', 'easy'],
    },
    reviewedSolutionBlocks: [textBlock(input.solution)],
    conceptIds: [...input.conceptIds],
    objectiveIds: [...input.objectiveIds],
    allowedPlayModes: ['flashcard', 'self-grade-review'],
  }
}

function documentFiles(documents: LearningPackDocuments): PackFileRecord[] {
  const jsonFiles = [
    ['pack.json', documents.manifest],
    ['catalog.json', documents.catalog],
    ['courses.json', documents.courses],
    ['items.json', documents.items],
    ['sets.json', documents.sets],
    ['resources.json', documents.resources],
    ['theme.json', documents.theme],
  ] as const

  return [
    ...jsonFiles.map(([path, document]) =>
      fileRecord(path, stableJsonBytes(document)),
    ),
    fileRecord('README.md', textEncoder.encode(readme())),
  ]
}

function fileRecord(path: string, bytes: Uint8Array): PackFileRecord {
  return { path, bytes, sha256: '', size: bytes.byteLength }
}

function manifestFiles(): LearningPackDocuments['manifest']['files'] {
  return [
    manifestFile('catalog.json', 'catalog', 'application/json'),
    manifestFile('courses.json', 'courses', 'application/json'),
    manifestFile('items.json', 'items', 'application/json'),
    manifestFile('README.md', 'documentation', 'text/markdown'),
    manifestFile('resources.json', 'resources', 'application/json'),
    manifestFile('sets.json', 'sets', 'application/json'),
    manifestFile('theme.json', 'theme', 'application/json'),
  ]
}

function manifestFile(
  path: string,
  role: LearningPackDocuments['manifest']['files'][number]['role'],
  mediaType: string,
): LearningPackDocuments['manifest']['files'][number] {
  return { assetId: null, path, role, mediaType, sha256: zeroHash, bytes: 0 }
}

function lessonResourceLinks(
  lesson: LogicLesson,
): NonNullable<
  LearningPackDocuments['catalog']['concepts'][number]['resourceLinks']
> {
  return [
    {
      resourceId: embeddedResourceIdFor(lesson),
      role: 'explanation',
      recommendedUse: 'before-attempt',
      priority: 1,
    },
    {
      resourceId: sourceResourceIdFor(lesson),
      role: 'reference',
      recommendedUse: 'optional',
      priority: 2,
    },
  ]
}

function guidedItemIdFor(lesson: LogicLesson): string {
  return `item-${lesson.nodeId.replace(/^node-/, '')}-guided`
}

function independentItemIdFor(lesson: LogicLesson): string {
  return `item-${lesson.nodeId.replace(/^node-/, '')}-independent`
}

function embeddedResourceIdFor(lesson: LogicLesson): string {
  return `resource-${lesson.nodeId.replace(/^node-/, '')}-teaching`
}

function sourceResourceIdFor(lesson: LogicLesson): string {
  return `resource-${lesson.nodeId.replace(/^node-/, '')}-source`
}

function lessonSourceUrl(lesson: LogicLesson): string {
  const chapter = lesson.chapters[0]
  if (chapter === undefined || lesson.chapters.length !== 1) {
    throw new Error(
      `Logic lesson ${lesson.code} must map to exactly one source chapter.`,
    )
  }
  return `https://forallx.openlogicproject.org/html/Ch${String(chapter)}.html`
}

function deckIdFor(module: LogicModule): string {
  return `set-logic-${moduleNumber(module)}-deck`
}

function checkpointSetIdFor(module: LogicModule): string {
  return `set-logic-${moduleNumber(module)}-checkpoint`
}

function moduleNumber(module: LogicModule): string {
  return module.code.slice(0, -2)
}

function textBlock(text: string) {
  return {
    kind: 'text' as const,
    text,
    language: null,
    calloutRole: null,
    assetId: null,
    altText: null,
  }
}

function questionBlock(text: string) {
  return {
    kind: 'question' as const,
    text,
    language: null,
    calloutRole: null,
    assetId: null,
    altText: null,
  }
}

function calloutBlock(role: 'tip' | 'warning', text: string) {
  return {
    kind: 'callout' as const,
    text,
    language: null,
    calloutRole: role,
    assetId: null,
    altText: null,
  }
}

function titleFromId(id: string): string {
  return id
    .split('-')
    .map((word) =>
      word.toLowerCase() === 'tfl'
        ? 'TFL'
        : `${word.charAt(0).toUpperCase()}${word.slice(1)}`,
    )
    .join(' ')
}

function conceptSummary(conceptId: string): string {
  return lessonForConcept(conceptId).explanation
}

function objectiveStatement(objectiveId: string): string {
  return lessonForObjective(objectiveId).learnerJob
}

function objectiveSuccessCriterion(objectiveId: string): string {
  const lesson = lessonForObjective(objectiveId)
  return `Produces the reviewed result for “${lesson.independentPrompt}” and avoids this named error: ${lesson.commonMistake}`
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)]
}

function prerequisiteConceptIdsFor(conceptId: string): string[] {
  const lesson = lessonForConcept(conceptId)
  if (lesson.prerequisiteConceptIds !== undefined) {
    return unique(lesson.prerequisiteConceptIds)
  }
  return unique(
    logicFoundationsModules
      .filter((module) =>
        module.lessons.some((lesson) => lesson.conceptIds.includes(conceptId)),
      )
      .flatMap((module) => module.prerequisiteConceptIds),
  )
}

function relatedConceptIdsFor(conceptId: string): string[] {
  const lesson = lessonForConcept(conceptId)
  if (lesson.prerequisiteConceptIds !== undefined) {
    const owningModule = logicFoundationsModules.find((module) =>
      module.lessons.includes(lesson),
    )
    if (owningModule === undefined) {
      throw new Error(`Missing module owner for concept ${conceptId}.`)
    }
    const lessonIndex = owningModule.lessons.indexOf(lesson)
    return unique([
      ...lesson.prerequisiteConceptIds,
      ...(owningModule.lessons[lessonIndex - 1]?.conceptIds ?? []),
      ...(owningModule.lessons[lessonIndex + 1]?.conceptIds ?? []),
    ]).filter((candidate) => candidate !== conceptId)
  }
  const owningModules = logicFoundationsModules.filter((module) =>
    module.lessons.some((lesson) => lesson.conceptIds.includes(conceptId)),
  )
  if (owningModules.length === 0) {
    throw new Error(`Missing lesson owner for concept ${conceptId}.`)
  }
  return unique(
    owningModules.flatMap((module) => [
      ...module.prerequisiteConceptIds,
      ...module.lessons.flatMap((lesson) => lesson.conceptIds),
    ]),
  ).filter((candidate) => candidate !== conceptId)
}

function lessonForConcept(conceptId: string): LogicLesson {
  const lesson = logicFoundationsModules
    .flatMap((module) => module.lessons)
    .find((candidate) => candidate.conceptIds.includes(conceptId))
  if (lesson === undefined) {
    throw new Error(`Missing authored lesson for concept ${conceptId}.`)
  }
  return lesson
}

function lessonForObjective(objectiveId: string): LogicLesson {
  const lesson = logicFoundationsModules
    .flatMap((module) => module.lessons)
    .find((candidate) => candidate.objectiveIds.includes(objectiveId))
  if (lesson === undefined) {
    throw new Error(`Missing authored lesson for objective ${objectiveId}.`)
  }
  return lesson
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch (error: unknown) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      return false
    }
    throw error
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error
}

function readme(): string {
  return `# Logic Foundations

Logic Foundations is an original Concourse course organized around *forall x: Calgary* by P. D. Magnus, Tim Button, Robert Trueman, and Richard Zach.

Source: ${source.canonicalUrl}

License: [${source.license}](${source.licenseUrl}).

${source.attribution} Learner-facing explanations and exercises are original Concourse writing unless explicitly marked as quotations.

Logic Foundations release 1.0.0 contains Modules 1 through 12 and covers Chapters 1 through 41 and 45 through 47. It includes argument analysis, TFL and FOL syntax and semantics, natural-deduction proof, normal forms, functional completeness, and equivalence transformations.

Chapters 42 through 44 and 48 are optional follow-on material and are not included in this release or required for completion.
`
}
