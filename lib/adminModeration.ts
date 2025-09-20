import { sanitizeMarkdown } from "./comments";

export type ModerateAction = "approve" | "spam" | "delete" | "hardDelete" | "edit" | "removeAttachment";

export interface ModerateInput {
  action: ModerateAction;
  ids?: string[]; // for bulk status changes or hardDelete
  id?: string; // for single-item ops like edit or removeAttachment
  bodyMd?: string; // for edit
  attachmentId?: string; // for removeAttachment
}

export interface ModerateResultItem {
  id: string;
  ok: boolean;
  message?: string;
}

export interface ModerationRepo {
  updateStatus(ids: string[], status: "approved" | "spam" | "deleted"): Promise<number>;
  hardDelete(ids: string[]): Promise<number>;
  editComment(id: string, bodyMd: string, bodyHtml: string): Promise<boolean>;
  removeAttachment(attachmentId: string): Promise<boolean>;
}

export async function moderateComments(repo: ModerationRepo, input: ModerateInput): Promise<ModerateResultItem[]> {
  switch (input.action) {
    case "approve":
    case "spam":
    case "delete": {
      const ids = input.ids ?? [];
      if (!ids.length) return [];
      const changed = await repo.updateStatus(ids, input.action === "approve" ? "approved" : input.action === "spam" ? "spam" : "deleted");
      return ids.map((id, idx) => ({ id, ok: idx < changed }));
    }
    case "hardDelete": {
      const ids = input.ids ?? [];
      if (!ids.length) return [];
      const removed = await repo.hardDelete(ids);
      return ids.map((id, idx) => ({ id, ok: idx < removed }));
    }
    case "edit": {
      if (!input.id) throw new Error("id required for edit");
      if (typeof input.bodyMd !== "string" || !input.bodyMd.trim()) throw new Error("bodyMd required");
      const bodyHtml = sanitizeMarkdown(input.bodyMd);
      const ok = await repo.editComment(input.id, input.bodyMd, bodyHtml);
      return [{ id: input.id, ok }];
    }
    case "removeAttachment": {
      const id = input.attachmentId ?? input.id;
      if (!id) throw new Error("attachmentId required");
      const ok = await repo.removeAttachment(id);
      return [{ id, ok }];
    }
  }
}

