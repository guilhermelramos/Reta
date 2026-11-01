/** Texto curto e sem quebras, usado em prompts e na normalização das respostas. */
export function clip(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length <= max ? clean : clean.slice(0, max);
}
