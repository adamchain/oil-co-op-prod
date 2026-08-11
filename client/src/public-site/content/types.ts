/** One editable string on a marketing page. */
export type ContentField = {
  /** Stable dotted key, namespaced by page id, e.g. "ourStory.lead". */
  key: string;
  /** Human label shown in the admin Site Content editor. */
  label: string;
  /** Built-in default text, rendered whenever there is no admin override. */
  value: string;
  /** Render a multi-line textarea in the admin editor instead of a single line. */
  multiline?: boolean;
};

/** All editable strings for one marketing page, shown as a section in the editor. */
export type ContentGroup = {
  /** Page id / key namespace, e.g. "ourStory". */
  page: string;
  /** Section heading shown in the admin editor, e.g. "Our Story". */
  title: string;
  fields: ContentField[];
};
