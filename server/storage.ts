import { type SavedAnalysis, type InsertSavedAnalysis, savedAnalyses } from "@shared/schema";
import { db } from "../db";
import { desc, eq } from "drizzle-orm";

export interface IStorage {
  // Saved Analyses
  getSavedAnalyses(): Promise<SavedAnalysis[]>;
  getSavedAnalysis(id: string): Promise<SavedAnalysis | undefined>;
  createSavedAnalysis(analysis: InsertSavedAnalysis): Promise<SavedAnalysis>;
  deleteSavedAnalysis(id: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getSavedAnalyses(): Promise<SavedAnalysis[]> {
    return db.select().from(savedAnalyses).orderBy(desc(savedAnalyses.createdAt));
  }

  async getSavedAnalysis(id: string): Promise<SavedAnalysis | undefined> {
    const [analysis] = await db.select().from(savedAnalyses).where(eq(savedAnalyses.id, id));
    return analysis;
  }

  async createSavedAnalysis(analysis: InsertSavedAnalysis): Promise<SavedAnalysis> {
    const [created] = await db.insert(savedAnalyses).values(analysis).returning();
    return created;
  }

  async deleteSavedAnalysis(id: string): Promise<void> {
    await db.delete(savedAnalyses).where(eq(savedAnalyses.id, id));
  }
}

export const storage = new DatabaseStorage();
