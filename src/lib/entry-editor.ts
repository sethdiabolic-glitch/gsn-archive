import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import { TableKit } from "@tiptap/extension-table";

const FlowImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      float: {
        default: "none",
        parseHTML: (element) => element.getAttribute("data-float") || "none",
        renderHTML: (attributes) => ({ "data-float": attributes["float"] }),
      },
    };
  },
});

export function entryEditorExtensions() {
  return [
    StarterKit.configure({ heading: { levels: [2, 3] } }),
    FlowImage.configure({ allowBase64: false }),
    TextAlign.configure({ types: ["heading", "paragraph"] }),
    TableKit.configure({ table: { resizable: true, lastColumnResizable: false } }),
  ];
}
