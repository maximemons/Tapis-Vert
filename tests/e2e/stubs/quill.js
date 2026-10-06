export default class Quill {
  constructor(sel) {
    this.root = document.createElement("div");
    this.root.className = "ql-editor";
    this.root.contentEditable = "true";
    document.querySelector(sel).append(this.root);
    this.clipboard = { dangerouslyPasteHTML: (h) => { this.root.innerHTML = h; } };
  }
  getText() { return this.root.textContent; }
  setContents() { this.root.innerHTML = "<p><br></p>"; }
}
