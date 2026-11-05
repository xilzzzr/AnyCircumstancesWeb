import type { Content, TDocumentDefinitions } from "pdfmake/interfaces";
import {
  documentText,
  safeDownloadName,
  type VaultDocument,
} from "./vaultDocuments";

export async function textPdf(title: string, body: string): Promise<Blob> {
  const [{ default: pdfMake }, { default: fonts }] = await Promise.all([
    import("pdfmake/build/pdfmake"),
    import("pdfmake/build/vfs_fonts"),
  ]);
  pdfMake.addVirtualFileSystem(fonts);
  const content: Content[] = [
    { text: title, fontSize: 20, bold: true, margin: [0, 0, 0, 18] },
    { text: body, fontSize: 11, lineHeight: 1.3 },
  ];
  const definition: TDocumentDefinitions = {
    content,
    pageMargins: [40, 40, 40, 40],
    defaultStyle: { font: "Roboto" },
  };
  return pdfMake.createPdf(definition).getBlob();
}
export async function documentPdf(doc: VaultDocument, note = "") {
  return textPdf(
    doc.title,
    (note ? `Note for your recipient\n${note}\n\n` : "") + documentText(doc),
  );
}
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
export type PackageItem = {
  name: string;
  note: string;
  document?: VaultDocument;
  blob: Blob;
};
export async function downloadPackage(items: PackageItem[]) {
  const { zipSync } = await import("fflate");
  const used = new Set<string>(["start here.pdf", "start here.txt"]);
  const entries: Record<string, Uint8Array> = Object.create(null);
  const instructions: string[] = [];
  const introductions = items.filter(
    (i) => i.document?.template === "introduction",
  );
  introductions.forEach((i) =>
    instructions.push(documentText(i.document!), ""),
  );
  for (const item of items) {
    const base = safeDownloadName(item.name);
    let name = base;
    let index = 2;
    while (used.has(name.toLowerCase())) {
      const dot = base.lastIndexOf(".");
      name =
        dot > 0
          ? `${base.slice(0, dot)} (${index++})${base.slice(dot)}`
          : `${base} (${index++})`;
    }
    used.add(name.toLowerCase());
    entries[name] = new Uint8Array(await item.blob.arrayBuffer());
    instructions.push(name, item.note || "No additional instructions.", "");
  }
  const text = instructions.join("\n");
  entries["Start here.pdf"] = new Uint8Array(
    await (await textPdf("Your files and instructions", text)).arrayBuffer(),
  );
  entries["Start here.txt"] = new TextEncoder().encode(text);
  downloadBlob(
    new Blob([zipSync(entries, { level: 0 })], { type: "application/zip" }),
    "AnyCircumstances-files.zip",
  );
}
