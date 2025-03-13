export const ce = (tag: string, className: string) => {
  const e = document.createElement(tag);
  e.className = className;
  return e;
}
