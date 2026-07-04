// topicPresets — a handful of ready-made questions that showcase the council
// without requiring the user to think one up first. Chosen to span domains
// (engineering practice, work culture, economics, tech policy) so each preset
// gives the skeptic/optimist/expert/contrarian genuinely different footing to
// argue from, rather than four takes on the same industry.

export type TopicPreset = {
  /** Short chip label; a UI cue only, never sent to the backend. */
  label: string;
  /** The full question that fills the textarea when picked. */
  question: string;
};

export const TOPIC_PRESETS: readonly TopicPreset[] = [
  { label: "Four-day week", question: "Should companies switch to a four-day work week?" },
  {
    label: "Remote-first",
    question: "Should a growing startup stay remote-first or require an office?",
  },
  {
    label: "AI code review",
    question: "Should AI-generated code be allowed to merge without a human review?",
  },
  {
    label: "Universal basic income",
    question: "Would a universal basic income do more good than harm?",
  },
];
