/**
 * Bid Document Service — Online editing + Word export/import
 *
 * Manages bid documents with structured sections stored as JSONB.
 * Supports online rich-text editing, Word export via `docx`, and
 * Word import via `mammoth`.
 */

import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { bidDocuments } from "@/lib/db/schema";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  TableRow,
  TableCell,
  Table,
  WidthType,
  BorderStyle,
} from "docx";
import mammoth from "mammoth";

// ==================== Type Definitions ====================

export interface BidSection {
  id: string;
  sectionNo: string;
  title: string;
  content: string;
  parentId: string | null;
  linkedReviewItems: string[];
  linkedResponseItems: string[];
  scoringInfo: { score?: number; weight?: number } | null;
  status: "generated" | "edited" | "empty";
}

export interface BidDocumentWithSections {
  id: string;
  projectId: string;
  title: string;
  source: string;
  sections: BidSection[];
  metadata: Record<string, unknown> | null;
  version: number | null;
  status: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

// ==================== Service ====================

export class BidDocumentService {
  /** Fetch a bid document with its sections. */
  async getDocument(docId: string): Promise<BidDocumentWithSections | null> {
    const rows = await db
      .select()
      .from(bidDocuments)
      .where(eq(bidDocuments.id, docId))
      .limit(1);

    if (rows.length === 0) return null;

    const row = rows[0];
    return {
      id: row.id,
      projectId: row.projectId,
      title: row.title,
      source: row.source,
      sections: (row.sections as BidSection[]) ?? [],
      metadata: row.metadata as Record<string, unknown> | null,
      version: row.version,
      status: row.status,
      createdAt: row.createdAt ?? null,
      updatedAt: row.updatedAt ?? null,
    };
  }

  /** List all bid documents for a project. */
  async listByProject(projectId: string): Promise<BidDocumentWithSections[]> {
    const rows = await db
      .select()
      .from(bidDocuments)
      .where(eq(bidDocuments.projectId, projectId));

    return rows.map((row) => ({
      id: row.id,
      projectId: row.projectId,
      title: row.title,
      source: row.source,
      sections: (row.sections as BidSection[]) ?? [],
      metadata: row.metadata as Record<string, unknown> | null,
      version: row.version,
      status: row.status,
      createdAt: row.createdAt ?? null,
      updatedAt: row.updatedAt ?? null,
    }));
  }

  /** Update a single section's content. */
  async updateSection(
    docId: string,
    sectionId: string,
    content: string,
  ): Promise<void> {
    const doc = await this.getDocument(docId);
    if (!doc) throw new Error("Document not found");

    const sections = doc.sections.map((s) =>
      s.id === sectionId ? { ...s, content, status: "edited" as const } : s,
    );

    await db
      .update(bidDocuments)
      .set({
        sections,
        status: "editing",
        updatedAt: new Date(),
      })
      .where(eq(bidDocuments.id, docId));
  }

  /** Add a new section to the document. */
  async addSection(docId: string, section: BidSection): Promise<void> {
    const doc = await this.getDocument(docId);
    if (!doc) throw new Error("Document not found");

    const sections = [...doc.sections, section];

    await db
      .update(bidDocuments)
      .set({
        sections,
        status: "editing",
        updatedAt: new Date(),
      })
      .where(eq(bidDocuments.id, docId));
  }

  /** Reorder sections by providing an ordered array of section IDs. */
  async reorderSections(docId: string, sectionOrder: string[]): Promise<void> {
    const doc = await this.getDocument(docId);
    if (!doc) throw new Error("Document not found");

    const sectionMap = new Map(doc.sections.map((s) => [s.id, s]));
    const reordered = sectionOrder
      .map((id) => sectionMap.get(id))
      .filter(Boolean) as BidSection[];

    // Append any sections not in the order list (safety)
    const orderedIds = new Set(sectionOrder);
    const remaining = doc.sections.filter((s) => !orderedIds.has(s.id));
    const sections = [...reordered, ...remaining];

    await db
      .update(bidDocuments)
      .set({ sections, updatedAt: new Date() })
      .where(eq(bidDocuments.id, docId));
  }

  /** Auto-save all sections at once (periodic editor save). */
  async autoSave(docId: string, sections: BidSection[]): Promise<void> {
    await db
      .update(bidDocuments)
      .set({
        sections,
        status: "editing",
        updatedAt: new Date(),
      })
      .where(eq(bidDocuments.id, docId));
  }

  /** Export the document to a Word (.docx) buffer. */
  async exportToWord(docId: string): Promise<Buffer> {
    const doc = await this.getDocument(docId);
    if (!doc) throw new Error("Document not found");

    const children: (Paragraph | Table)[] = [];

    // Document title
    children.push(
      new Paragraph({
        text: doc.title,
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
      }),
    );

    for (const section of doc.sections) {
      // Section heading
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `${section.sectionNo}  ${section.title}`,
              bold: true,
              size: 28,
            }),
          ],
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 300, after: 100 },
        }),
      );

      // Content — split into paragraphs on double newlines or <br>/<p> tags
      const paragraphs = htmlToTextParagraphs(section.content);
      for (const text of paragraphs) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text, size: 24 })],
            spacing: { after: 80 },
          }),
        );
      }
    }

    const wordDoc = new Document({
      sections: [
        {
          children,
        },
      ],
    });

    const buffer = await Packer.toBuffer(wordDoc);
    return Buffer.from(buffer);
  }

  /** Import a Word file and re-parse into sections. */
  async importFromWord(docId: string, fileBuffer: Buffer): Promise<void> {
    const result = await mammoth.convertToHtml({ buffer: fileBuffer });
    const html = result.value;

    // Parse HTML into sections based on heading patterns
    const sections = parseHtmlToSections(html);

    await db
      .update(bidDocuments)
      .set({
        sections,
        source: "uploaded",
        status: "editing",
        updatedAt: new Date(),
      })
      .where(eq(bidDocuments.id, docId));
  }
}

// ==================== Helpers ====================

/** Strip HTML tags and split content into plain-text paragraphs. */
function htmlToTextParagraphs(html: string): string[] {
  if (!html) return [];

  // Replace block-level tags with newline markers
  const text = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li>/gi, "- ")
    .replace(/<[^>]+>/g, "") // strip remaining tags
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .trim();

  // Split on double newlines, filter empties
  return text
    .split(/\n{2,}/)
    .map((p) => p.replace(/\n/g, " ").trim())
    .filter(Boolean);
}

/** Parse mammoth HTML output into BidSection objects. */
function parseHtmlToSections(html: string): BidSection[] {
  const sections: BidSection[] = [];
  let sectionIndex = 0;

  // Split on <h1>, <h2>, <h3> headings
  const headingRegex = /<h[1-3][^>]*>(.*?)<\/h[1-3]>/gi;
  const parts = html.split(headingRegex);

  // parts: [prelude, heading1_text, content1, heading2_text, content2, ...]
  // If there's content before the first heading, treat it as an intro section
  if (parts.length > 0 && parts[0].trim()) {
    sectionIndex++;
    sections.push({
      id: crypto.randomUUID(),
      sectionNo: String(sectionIndex),
      title: "前言",
      content: parts[0].trim(),
      parentId: null,
      linkedReviewItems: [],
      linkedResponseItems: [],
      scoringInfo: null,
      status: "generated",
    });
  }

  // Process heading-content pairs
  for (let i = 1; i < parts.length; i += 2) {
    const headingText = stripTags(parts[i] || "").trim();
    const contentHtml = parts[i + 1] || "";

    if (headingText) {
      sectionIndex++;
      sections.push({
        id: crypto.randomUUID(),
        sectionNo: String(sectionIndex),
        title: headingText,
        content: contentHtml.trim(),
        parentId: null,
        linkedReviewItems: [],
        linkedResponseItems: [],
        scoringInfo: null,
        status: "generated",
      });
    }
  }

  // If no headings found, put everything in one section
  if (sections.length === 0 && html.trim()) {
    sections.push({
      id: crypto.randomUUID(),
      sectionNo: "1",
      title: "正文",
      content: html.trim(),
      parentId: null,
      linkedReviewItems: [],
      linkedResponseItems: [],
      scoringInfo: null,
      status: "generated",
    });
  }

  return sections;
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, "").trim();
}

/** Singleton instance */
export const bidDocumentService = new BidDocumentService();
