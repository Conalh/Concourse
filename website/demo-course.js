export const COURSE_ID = 'bacterial-survival'
export const COURSE_REVISION = 1

export const REQUIRED_ACTIVITY_IDS = Object.freeze([
  'boundary-permeability',
  'boundary-structure',
  'transport-gradient',
  'transport-mechanism',
  'osmosis-water',
  'osmosis-response',
  'energy-classify',
  'energy-scarce-nutrient',
  'response-sequence',
  'response-transporter',
  'antibiotic-targets',
  'antibiotic-consequence',
  'antibiotic-retrieval',
])

export const SUPPORT_NODE_IDS = Object.freeze([
  'support-charge-size',
  'support-gradient',
  'support-tonicity',
  'support-active-passive',
  'support-central-dogma',
])

export const EXTENSION_NODE_IDS = Object.freeze([
  'extension-cell-envelopes',
  'extension-proton-gradient',
  'extension-anaerobic-energy',
  'extension-plasmids',
])

function freezeActivity(activity) {
  return Object.freeze({
    confidenceRequired: true,
    minutes: 1.25,
    ...activity,
    choices: Object.freeze(activity.choices),
    feedback: Object.freeze(activity.feedback),
  })
}

const SHARED_FEEDBACK = Object.freeze({
  correct: 'That mechanism fits the conditions.',
  incorrect: 'Look at the direction of movement and the structure involved.',
  explanation:
    'Bacterial mechanisms vary, but the membrane, wall, transport proteins, genetic information, and ribosomes play distinct roles.',
})

export const ACTIVITIES = Object.freeze(
  [
    {
      activityId: 'boundary-permeability',
      conceptId: 'membrane-permeability',
      kind: 'multi-select',
      prompt:
        'A bacterium is placed in water containing oxygen, glucose, and sodium ions. Which can cross its lipid membrane directly with relative ease?',
      choices: [
        { id: 'oxygen', label: 'Oxygen (O₂)', detail: 'Small and nonpolar' },
        { id: 'glucose', label: 'Glucose', detail: 'Large and polar' },
        { id: 'sodium', label: 'Sodium ion (Na⁺)', detail: 'Charged' },
      ],
      correctResponse: ['oxygen'],
      feedback: {
        correct:
          'Oxygen is small and nonpolar, so it can move through the lipid bilayer directly.',
        incorrect:
          'Size, polarity, and charge matter. Charged ions and large polar molecules usually need proteins.',
        explanation:
          'Molecules still move in both directions; “crosses directly” describes relative permeability and net movement, not a one-way gate.',
      },
    },
    {
      activityId: 'boundary-structure',
      conceptId: 'cell-envelope',
      kind: 'matching',
      prompt:
        'Match each survival job to the structure that primarily performs it.',
      choices: {
        prompts: [
          { id: 'passage', label: 'Controls molecular passage' },
          { id: 'rupture', label: 'Resists osmotic rupture' },
        ],
        targets: [
          { id: 'membrane', label: 'Cell membrane' },
          { id: 'wall', label: 'Cell wall' },
        ],
      },
      correctResponse: { passage: 'membrane', rupture: 'wall' },
      feedback: {
        correct:
          'The membrane is selective; the wall is a rigid support layer.',
        incorrect:
          'The wall is not the main selective gate. Separate passage control from mechanical support.',
        explanation:
          'Most bacteria have both a cytoplasmic membrane and a cell wall, though envelope structures vary among species.',
      },
    },
    {
      activityId: 'transport-gradient',
      conceptId: 'concentration-gradient',
      kind: 'single-choice',
      prompt:
        'A permeable molecule is more concentrated outside the cell than inside. What is its expected net movement?',
      choices: [
        { id: 'in', label: 'Into the cell' },
        { id: 'out', label: 'Out of the cell' },
        { id: 'none', label: 'No molecules move' },
      ],
      correctResponse: 'in',
      feedback: {
        correct: 'Net movement is toward the lower concentration inside.',
        incorrect:
          'Individual molecules move both ways, but the larger flow is from high concentration to low.',
        explanation:
          'At equilibrium molecules continue to move, while the opposing flows become equal on average.',
      },
    },
    {
      activityId: 'transport-mechanism',
      conceptId: 'transport-proteins',
      kind: 'matching',
      prompt:
        'Match each substance to the most fitting simplified route across the membrane.',
      choices: {
        prompts: [
          { id: 'oxygen', label: 'Oxygen' },
          { id: 'ion', label: 'An ion moving down its gradient' },
          { id: 'nutrient', label: 'A selected polar nutrient' },
        ],
        targets: [
          { id: 'bilayer', label: 'Directly through the lipid bilayer' },
          { id: 'channel', label: 'Through a channel' },
          { id: 'carrier', label: 'Through a carrier' },
        ],
      },
      correctResponse: {
        oxygen: 'bilayer',
        ion: 'channel',
        nutrient: 'carrier',
      },
      feedback: {
        correct:
          'The routes differ because the substances have different physical properties.',
        incorrect:
          'Start with charge and polarity: the lipid core is unfavorable for ions and many polar nutrients.',
        explanation:
          'This is a simplified comparison. Real transport specificity and mechanisms vary among proteins and bacteria.',
      },
    },
    {
      activityId: 'osmosis-water',
      conceptId: 'osmosis',
      kind: 'single-choice',
      prompt:
        'The environment suddenly becomes much saltier than the cell interior. What is the expected net movement of water?',
      choices: [
        { id: 'out', label: 'Out of the cell' },
        { id: 'in', label: 'Into the cell' },
        { id: 'stop', label: 'Water stops moving' },
      ],
      correctResponse: 'out',
      feedback: {
        correct:
          'Water moves out overall toward the region with more dissolved solute.',
        incorrect:
          'Track water, not salt: the saltier exterior has the lower effective water concentration.',
        explanation:
          'Water molecules cross in both directions; osmosis describes the net result across a selectively permeable membrane.',
      },
    },
    {
      activityId: 'osmosis-response',
      conceptId: 'osmotic-stress',
      kind: 'matching',
      prompt:
        'Match each surrounding condition to the likely immediate pressure on the bacterium.',
      choices: {
        prompts: [
          { id: 'dilute', label: 'Exterior is relatively dilute' },
          { id: 'concentrated', label: 'Exterior is relatively concentrated' },
        ],
        targets: [
          { id: 'inward', label: 'Net water entry; wall resists expansion' },
          { id: 'outward', label: 'Net water loss; cytoplasm can shrink' },
        ],
      },
      correctResponse: { dilute: 'inward', concentrated: 'outward' },
      feedback: {
        correct:
          'You connected relative solute concentration to net water movement.',
        incorrect:
          'A more dilute exterior favors net water entry; a more concentrated exterior favors net water loss.',
        explanation:
          'The cell wall helps resist internal pressure, but the magnitude and response to osmotic stress vary among bacteria.',
      },
    },
    {
      activityId: 'energy-classify',
      conceptId: 'energy-coupling',
      kind: 'matching',
      prompt: 'Classify each movement by what drives the net transport.',
      choices: {
        prompts: [
          {
            id: 'down',
            label: 'Solute moves down its own gradient through a channel',
          },
          { id: 'against', label: 'Solute accumulates against its gradient' },
          {
            id: 'coupled',
            label: 'Nutrient enters as protons move down their gradient',
          },
        ],
        targets: [
          { id: 'passive', label: 'Down-gradient / passive' },
          { id: 'energy', label: 'Energy-coupled / active' },
        ],
      },
      correctResponse: {
        down: 'passive',
        against: 'energy',
        coupled: 'energy',
      },
      feedback: {
        correct:
          'Moving against a gradient requires an energy source or coupling mechanism.',
        incorrect:
          'Do not ask only whether a protein is present. Ask whether the transported substance moves down or against its gradient.',
        explanation:
          'Active transport is energy-coupled, but the transport protein does not always consume ATP directly.',
      },
    },
    {
      activityId: 'energy-scarce-nutrient',
      conceptId: 'active-transport',
      kind: 'single-choice',
      prompt:
        'A nutrient is scarce outside but already concentrated inside. Which strategy can keep accumulating it?',
      choices: [
        { id: 'simple', label: 'Direct diffusion through the membrane' },
        { id: 'channel', label: 'An always-open passive channel' },
        { id: 'coupled', label: 'An energy-coupled transporter' },
      ],
      correctResponse: 'coupled',
      feedback: {
        correct:
          'Energy coupling can drive accumulation against the nutrient gradient.',
        incorrect:
          'Passive routes favor movement down a gradient, which cannot explain continued accumulation here.',
        explanation:
          'Bacteria use several coupling strategies; this course does not imply that every transporter uses ATP directly.',
      },
    },
    {
      activityId: 'response-sequence',
      conceptId: 'gene-expression',
      kind: 'ordering',
      prompt:
        'Put the instructional path for producing a transport protein into a meaningful order.',
      choices: [
        { id: 'dna', label: 'A gene in DNA stores the instruction' },
        { id: 'rna', label: 'RNA carries an expressed copy' },
        { id: 'ribosome', label: 'A ribosome reads the RNA' },
        { id: 'protein', label: 'A protein is assembled' },
      ],
      correctResponse: ['dna', 'rna', 'ribosome', 'protein'],
      feedback: {
        correct:
          'The stored instruction is expressed through RNA and translated by a ribosome.',
        incorrect:
          'Separate stored information from the temporary message and the machinery that assembles protein.',
        explanation:
          'DNA → RNA → protein is the relevant instructional model here; real gene regulation is more complex.',
      },
    },
    {
      activityId: 'response-transporter',
      conceptId: 'gene-expression',
      kind: 'single-choice',
      prompt:
        'The cell needs more of a particular transport protein. Which change most directly supplies new copies?',
      choices: [
        {
          id: 'express',
          label: 'Express the relevant gene and translate its RNA',
        },
        {
          id: 'wall',
          label: 'Thicken the cell wall without changing gene expression',
        },
        {
          id: 'diffuse',
          label: 'Wait for the protein to diffuse through the lipid bilayer',
        },
      ],
      correctResponse: 'express',
      feedback: {
        correct:
          'Gene expression and translation can produce new copies of the transporter.',
        incorrect:
          'A transporter is a protein. New copies require an expressed instruction and ribosomal assembly.',
        explanation:
          'Cells regulate protein production through many steps; this activity focuses on the core informational sequence.',
      },
    },
    {
      activityId: 'antibiotic-targets',
      conceptId: 'antibiotic-targets',
      kind: 'matching',
      prompt:
        'Match each simplified antibiotic target to the cellular process most directly disrupted.',
      choices: {
        prompts: [
          { id: 'wall', label: 'Cell-wall assembly' },
          { id: 'membrane', label: 'Membrane integrity' },
          { id: 'ribosome', label: 'Ribosome function' },
        ],
        targets: [
          {
            id: 'support',
            label: 'Maintaining a protective load-bearing boundary',
          },
          {
            id: 'gradient',
            label: 'Maintaining controlled gradients and permeability',
          },
          { id: 'protein', label: 'Producing proteins' },
        ],
      },
      correctResponse: {
        wall: 'support',
        membrane: 'gradient',
        ribosome: 'protein',
      },
      feedback: {
        correct: 'Each target interrupts a different survival process.',
        incorrect:
          'Connect each target to the job you used earlier: support, selective boundary, or protein assembly.',
        explanation:
          'These are simplified mechanistic examples, not treatment guidance. Antibiotic effects and susceptibility vary.',
      },
    },
    {
      activityId: 'antibiotic-consequence',
      conceptId: 'antibiotic-targets',
      kind: 'single-choice',
      prompt:
        'A simplified antibiotic blocks bacterial ribosomes. What is the most direct consequence for a needed new transporter?',
      choices: [
        {
          id: 'cannot-build',
          label: 'The cell cannot assemble new transporter protein normally',
        },
        {
          id: 'dna-gone',
          label: 'The transporter gene immediately disappears from DNA',
        },
        {
          id: 'wall-selective',
          label: 'The cell wall becomes the selective membrane',
        },
      ],
      correctResponse: 'cannot-build',
      feedback: {
        correct:
          'Blocking ribosome function disrupts normal protein production.',
        incorrect:
          'The gene can still be present. The blocked step is translation: assembling protein from an RNA message.',
        explanation:
          'This is a learning scenario about mechanism, not advice about selecting or using an antibiotic.',
      },
    },
    {
      activityId: 'antibiotic-retrieval',
      conceptId: 'retrieval',
      kind: 'retrieval',
      prompt:
        'Retrieve an earlier mechanism and use it to explain what happens next in the antibiotic scenario.',
      choices: [
        {
          id: 'membrane',
          label: 'The membrane controls passage and helps maintain gradients',
        },
        {
          id: 'wall',
          label: 'The wall is the cell’s genetic information store',
        },
        {
          id: 'ribosome',
          label: 'The ribosome pumps water against osmotic gradients',
        },
      ],
      correctResponse: 'membrane',
      feedback: {
        correct:
          'You brought an earlier mechanism into a new survival problem.',
        incorrect:
          'Separate the boundary, support, and protein-building roles before applying the earlier concept.',
        explanation:
          'Concourse selects the retrieval focus from your earliest non-strong evidence; an all-strong path revisits osmotic stress.',
      },
    },
    {
      activityId: 'support-charge-size',
      conceptId: 'membrane-permeability',
      kind: 'matching',
      prompt: 'Rebuild permeability from physical properties.',
      choices: {
        prompts: [
          { id: 'small', label: 'Small and nonpolar' },
          { id: 'large', label: 'Large and polar' },
          { id: 'charged', label: 'Charged ion' },
        ],
        targets: [
          { id: 'direct', label: 'Relatively able to cross directly' },
          { id: 'protein', label: 'Usually needs a membrane protein' },
        ],
      },
      correctResponse: {
        small: 'direct',
        large: 'protein',
        charged: 'protein',
      },
      feedback: SHARED_FEEDBACK,
      confidenceRequired: false,
      minutes: 1.5,
    },
    {
      activityId: 'support-gradient',
      conceptId: 'concentration-gradient',
      kind: 'single-choice',
      prompt:
        'One side has 80 particles and the other has 20. Which way is net diffusion?',
      choices: [
        {
          id: '80-to-20',
          label: 'From the 80-particle side toward the 20-particle side',
        },
        {
          id: '20-to-80',
          label: 'From the 20-particle side toward the 80-particle side',
        },
        { id: 'frozen', label: 'No particles move at all' },
      ],
      correctResponse: '80-to-20',
      feedback: SHARED_FEEDBACK,
      confidenceRequired: false,
      minutes: 1.5,
    },
    {
      activityId: 'support-tonicity',
      conceptId: 'osmosis',
      kind: 'single-choice',
      prompt:
        'Before using tonicity labels, follow water: where does its net movement go?',
      choices: [
        {
          id: 'toward-solute',
          label: 'Toward the side with more dissolved solute',
        },
        {
          id: 'away-solute',
          label: 'Toward the side with less dissolved solute',
        },
        { id: 'none', label: 'Water never crosses a membrane' },
      ],
      correctResponse: 'toward-solute',
      feedback: SHARED_FEEDBACK,
      confidenceRequired: false,
      minutes: 1.5,
    },
    {
      activityId: 'support-active-passive',
      conceptId: 'energy-coupling',
      kind: 'matching',
      prompt: 'Use direction and energy to rebuild the distinction.',
      choices: {
        prompts: [
          { id: 'down', label: 'Moves down its own gradient' },
          { id: 'against', label: 'Moves against its own gradient' },
        ],
        targets: [
          { id: 'passive', label: 'Can be passive' },
          { id: 'active', label: 'Requires energy coupling' },
        ],
      },
      correctResponse: { down: 'passive', against: 'active' },
      feedback: SHARED_FEEDBACK,
      confidenceRequired: false,
      minutes: 1.5,
    },
    {
      activityId: 'support-central-dogma',
      conceptId: 'gene-expression',
      kind: 'ordering',
      prompt: 'Separate stored information, message, machine, and product.',
      choices: [
        { id: 'dna', label: 'DNA: stored instruction' },
        { id: 'rna', label: 'RNA: expressed message' },
        { id: 'ribosome', label: 'Ribosome: assembly machine' },
        { id: 'protein', label: 'Protein: assembled product' },
      ],
      correctResponse: ['dna', 'rna', 'ribosome', 'protein'],
      feedback: SHARED_FEEDBACK,
      confidenceRequired: false,
      minutes: 1.5,
    },
    {
      activityId: 'extension-cell-envelopes',
      conceptId: 'cell-envelope',
      kind: 'matching',
      prompt: 'Compare two common simplified bacterial envelope patterns.',
      choices: {
        prompts: [
          { id: 'gram-positive', label: 'Common Gram-positive pattern' },
          { id: 'gram-negative', label: 'Common Gram-negative pattern' },
        ],
        targets: [
          { id: 'thick', label: 'Thicker peptidoglycan, no outer membrane' },
          { id: 'outer', label: 'Thin peptidoglycan plus an outer membrane' },
        ],
      },
      correctResponse: { 'gram-positive': 'thick', 'gram-negative': 'outer' },
      feedback: SHARED_FEEDBACK,
      confidenceRequired: false,
      minutes: 1.5,
    },
    {
      activityId: 'extension-proton-gradient',
      conceptId: 'proton-gradient',
      kind: 'single-choice',
      prompt: 'What can a membrane proton gradient provide?',
      choices: [
        {
          id: 'coupling',
          label: 'A stored electrochemical difference that can drive work',
        },
        { id: 'dna', label: 'A replacement for DNA' },
        { id: 'wall', label: 'A second rigid cell wall' },
      ],
      correctResponse: 'coupling',
      feedback: SHARED_FEEDBACK,
      confidenceRequired: false,
      minutes: 1.5,
    },
    {
      activityId: 'extension-anaerobic-energy',
      conceptId: 'anaerobic-metabolism',
      kind: 'multi-select',
      prompt: 'Which statements can be true when oxygen is unavailable?',
      choices: [
        { id: 'fermentation', label: 'Some bacteria can use fermentation' },
        {
          id: 'acceptor',
          label: 'Some can respire using another terminal electron acceptor',
        },
        { id: 'universal', label: 'Every bacterium uses the same pathway' },
      ],
      correctResponse: ['fermentation', 'acceptor'],
      feedback: SHARED_FEEDBACK,
      confidenceRequired: false,
      minutes: 1.5,
    },
    {
      activityId: 'extension-plasmids',
      conceptId: 'plasmids',
      kind: 'multi-select',
      prompt: 'Which statements accurately describe plasmids?',
      choices: [
        {
          id: 'separate',
          label: 'They are DNA molecules separate from the main chromosome',
        },
        { id: 'some', label: 'Some carry antibiotic-resistance genes' },
        { id: 'all', label: 'All resistance is plasmid-borne' },
      ],
      correctResponse: ['separate', 'some'],
      feedback: SHARED_FEEDBACK,
      confidenceRequired: false,
      minutes: 1.5,
    },
  ].map(freezeActivity),
)

export const CHAPTERS = Object.freeze([
  Object.freeze({
    chapterId: 'boundary',
    number: 1,
    title: 'Hold the boundary',
    kicker: 'A living edge',
    summary:
      'Separate the selective membrane from the load-bearing wall, then predict what crosses.',
    conceptIds: ['membrane-permeability', 'cell-envelope'],
    coreNodeIds: ['boundary-permeability', 'boundary-structure'],
    supportNodeId: 'support-charge-size',
    extensionNodeId: 'extension-cell-envelopes',
    model:
      'A lipid membrane sits inside a supporting wall. Small nonpolar molecules pass the lipid core more readily than ions or large polar molecules.',
  }),
  Object.freeze({
    chapterId: 'transport',
    number: 2,
    title: 'Move matter',
    kicker: 'Follow the gradient',
    summary:
      'Use concentration gradients, channels, and carriers to explain net molecular movement.',
    conceptIds: ['concentration-gradient', 'transport-proteins'],
    coreNodeIds: ['transport-gradient', 'transport-mechanism'],
    supportNodeId: 'support-gradient',
    extensionNodeId: 'extension-proton-gradient',
    model:
      'Channels form selective paths; carriers bind and change shape. Both can help substances cross a membrane that would otherwise resist them.',
  }),
  Object.freeze({
    chapterId: 'osmosis',
    number: 3,
    title: 'Survive salt shock',
    kicker: 'Water follows conditions',
    summary:
      'Predict net water movement and connect osmotic pressure to the protective role of the wall.',
    conceptIds: ['osmosis', 'osmotic-stress'],
    coreNodeIds: ['osmosis-water', 'osmosis-response'],
    supportNodeId: 'support-tonicity',
    extensionNodeId: null,
    model:
      'When outside solute rises, water leaves overall. In a dilute environment, water enters overall and the wall helps resist expansion.',
  }),
  Object.freeze({
    chapterId: 'energy',
    number: 4,
    title: 'Pay for movement',
    kicker: 'Direction has a cost',
    summary:
      'Distinguish down-gradient movement from transport that must be coupled to energy.',
    conceptIds: ['energy-coupling', 'active-transport'],
    coreNodeIds: ['energy-classify', 'energy-scarce-nutrient'],
    supportNodeId: 'support-active-passive',
    extensionNodeId: 'extension-anaerobic-energy',
    model:
      'A cell can spend chemical energy or tap an ion gradient to move another substance against its own gradient.',
  }),
  Object.freeze({
    chapterId: 'response',
    number: 5,
    title: 'Build a response',
    kicker: 'From information to machinery',
    summary:
      'Trace a simplified path from DNA through RNA and ribosomes to a new transport protein.',
    conceptIds: ['gene-expression'],
    coreNodeIds: ['response-sequence', 'response-transporter'],
    supportNodeId: 'support-central-dogma',
    extensionNodeId: 'extension-plasmids',
    model:
      'DNA stores instructions. Expressed RNA can be read by ribosomes, which assemble proteins that change what the cell can do.',
  }),
  Object.freeze({
    chapterId: 'antibiotic',
    number: 6,
    title: 'Face an antibiotic',
    kicker: 'Integrate the system',
    summary:
      'Apply the boundary, transport, osmosis, energy, and gene-expression ideas in one non-clinical scenario.',
    conceptIds: ['antibiotic-targets', 'retrieval'],
    coreNodeIds: [
      'antibiotic-targets',
      'antibiotic-consequence',
      'antibiotic-retrieval',
    ],
    supportNodeId: null,
    extensionNodeId: null,
    model:
      'Different antibiotic classes can disrupt different bacterial processes. This simplified scenario is about mechanisms, not treatment decisions.',
  }),
])

const CORE_NEXT = Object.freeze(
  Object.fromEntries(
    REQUIRED_ACTIVITY_IDS.map((activityId, index) => [
      activityId,
      REQUIRED_ACTIVITY_IDS[index + 1] ?? null,
    ]),
  ),
)

function coreNode(activityId) {
  const activity = ACTIVITIES.find(
    (candidate) => candidate.activityId === activityId,
  )
  const chapter = CHAPTERS.find((candidate) =>
    candidate.coreNodeIds.includes(activityId),
  )
  return Object.freeze({
    nodeId: activityId,
    chapterId: chapter.chapterId,
    kind: activityId === 'antibiotic-retrieval' ? 'retrieval' : 'core',
    title: activity.prompt,
    activityId,
    conceptId: activity.conceptId,
    required: true,
    nextCoreNodeId: CORE_NEXT[activityId],
  })
}

const BRANCH_DETAILS = Object.freeze({
  'support-charge-size': [
    'boundary',
    'Charge and molecular size',
    'transport-gradient',
  ],
  'support-gradient': [
    'transport',
    'Reading a concentration gradient',
    'osmosis-water',
  ],
  'support-tonicity': [
    'osmosis',
    'Tonicity without vocabulary traps',
    'energy-classify',
  ],
  'support-active-passive': [
    'energy',
    'Passive versus active',
    'response-sequence',
  ],
  'support-central-dogma': [
    'response',
    'DNA → RNA → protein',
    'antibiotic-targets',
  ],
  'extension-cell-envelopes': [
    'boundary',
    'Two common envelope patterns',
    'transport-gradient',
  ],
  'extension-proton-gradient': [
    'transport',
    'Using a proton gradient',
    'osmosis-water',
  ],
  'extension-anaerobic-energy': [
    'energy',
    'Making energy without oxygen',
    'response-sequence',
  ],
  'extension-plasmids': [
    'response',
    'Plasmids and resistance traits',
    'antibiotic-targets',
  ],
})

function branchNode(nodeId) {
  const [chapterId, title, nextCoreNodeId] = BRANCH_DETAILS[nodeId]
  const activity = ACTIVITIES.find(
    (candidate) => candidate.activityId === nodeId,
  )
  return Object.freeze({
    nodeId,
    chapterId,
    kind: nodeId.startsWith('support-') ? 'support' : 'extension',
    title,
    activityId: nodeId,
    conceptId: activity.conceptId,
    required: false,
    nextCoreNodeId,
  })
}

export const COURSE_NODES = Object.freeze([
  ...REQUIRED_ACTIVITY_IDS.map(coreNode),
  ...SUPPORT_NODE_IDS.map(branchNode),
  ...EXTENSION_NODE_IDS.map(branchNode),
])

export const SCIENTIFIC_REFERENCES = Object.freeze([
  Object.freeze({
    id: 'openstax-membranes',
    title: 'Passive Transport',
    publisher: 'OpenStax Biology 2e',
    url: 'https://openstax.org/books/biology-2e/pages/5-2-passive-transport',
    note: 'Diffusion, selective permeability, and osmosis.',
  }),
  Object.freeze({
    id: 'openstax-active',
    title: 'Active Transport',
    publisher: 'OpenStax Biology 2e',
    url: 'https://openstax.org/books/biology-2e/pages/5-3-active-transport',
    note: 'Energy-coupled movement against electrochemical gradients.',
  }),
  Object.freeze({
    id: 'ncbi-bacterial-structure',
    title: 'Structure',
    publisher: 'Medical Microbiology, NCBI Bookshelf',
    url: 'https://www.ncbi.nlm.nih.gov/books/NBK8477/',
    note: 'Bacterial envelopes, ribosomes, and proton-motive force.',
  }),
  Object.freeze({
    id: 'ncbi-rna-protein',
    title: 'From RNA to Protein',
    publisher: 'Molecular Biology of the Cell, NCBI Bookshelf',
    url: 'https://www.ncbi.nlm.nih.gov/books/NBK26829/',
    note: 'Translation and ribosome-targeting antibiotics.',
  }),
  Object.freeze({
    id: 'nhgri-plasmid',
    title: 'Plasmid',
    publisher: 'National Human Genome Research Institute',
    url: 'https://www.genome.gov/genetics-glossary/Plasmid',
    note: 'Extrachromosomal DNA and some resistance-associated genes.',
  }),
])

export function getCourseNode(id) {
  return COURSE_NODES.find(({ nodeId }) => nodeId === id) ?? null
}

export function getActivity(id) {
  return ACTIVITIES.find(({ activityId }) => activityId === id) ?? null
}

function unique(values) {
  return new Set(values).size === values.length
}

export function validateCourseDefinition() {
  const chapterIds = CHAPTERS.map(({ chapterId }) => chapterId)
  const nodeIds = COURSE_NODES.map(({ nodeId }) => nodeId)
  const activityIds = ACTIVITIES.map(({ activityId }) => activityId)

  if (
    CHAPTERS.length !== 6 ||
    REQUIRED_ACTIVITY_IDS.length !== 13 ||
    !unique(chapterIds) ||
    !unique(nodeIds) ||
    !unique(activityIds)
  ) {
    return false
  }

  return COURSE_NODES.every((node) => {
    const chapter = CHAPTERS.find(
      ({ chapterId }) => chapterId === node.chapterId,
    )
    const activity = getActivity(node.activityId)
    const nextNode =
      node.nextCoreNodeId === null ? true : getCourseNode(node.nextCoreNodeId)
    const ownedByChapter =
      chapter !== undefined &&
      (chapter.coreNodeIds.includes(node.nodeId) ||
        chapter.supportNodeId === node.nodeId ||
        chapter.extensionNodeId === node.nodeId)
    return Boolean(activity && nextNode && ownedByChapter)
  })
}
