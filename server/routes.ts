import type { Express } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import { insertSavedAnalysisSchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Get all saved analyses
  app.get("/api/analyses", async (req, res) => {
    try {
      const analyses = await storage.getSavedAnalyses();
      res.json(analyses);
    } catch (error) {
      console.error("Error fetching analyses:", error);
      res.status(500).json({ error: "Failed to fetch analyses" });
    }
  });

  // Get a specific saved analysis
  app.get("/api/analyses/:id", async (req, res) => {
    try {
      const analysis = await storage.getSavedAnalysis(req.params.id);
      if (!analysis) {
        return res.status(404).json({ error: "Analysis not found" });
      }
      res.json(analysis);
    } catch (error) {
      console.error("Error fetching analysis:", error);
      res.status(500).json({ error: "Failed to fetch analysis" });
    }
  });

  // Save a new analysis
  app.post("/api/analyses", async (req, res) => {
    try {
      const validationResult = insertSavedAnalysisSchema.safeParse(req.body);
      
      if (!validationResult.success) {
        const readableError = fromZodError(validationResult.error);
        return res.status(400).json({ error: readableError.message });
      }

      const analysis = await storage.createSavedAnalysis(validationResult.data);
      res.status(201).json(analysis);
    } catch (error) {
      console.error("Error saving analysis:", error);
      res.status(500).json({ error: "Failed to save analysis" });
    }
  });

  // Delete a saved analysis
  app.delete("/api/analyses/:id", async (req, res) => {
    try {
      await storage.deleteSavedAnalysis(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting analysis:", error);
      res.status(500).json({ error: "Failed to delete analysis" });
    }
  });

  return httpServer;
}
