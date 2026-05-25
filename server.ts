/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { Note } from "./src/types.js"; // Use js extension for esm bundle safety or standard compilation

const app = express();
const PORT = 3000;

// Enable JSON body sizes for base64 audio transfers
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Settings persist file
const SETTINGS_FILE = path.join(process.cwd(), "settings.json");
let obsidianPathSetting = "";

function loadSavedSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf-8"));
      if (settings.obsidianPath) {
        obsidianPathSetting = settings.obsidianPath;
      }
    }
  } catch (err) {
    console.error("Failed to load settings from settings.json", err);
  }
}
loadSavedSettings();

function getNotesDir(): string {
  // 1. If user set an absolute path or relative path for Obsidian Vault / Local Folder
  if (obsidianPathSetting) {
    const resolvedPath = path.resolve(obsidianPathSetting);
    if (!fs.existsSync(resolvedPath)) {
      try {
        fs.mkdirSync(resolvedPath, { recursive: true });
      } catch (err) {
        console.error(`Failed to create custom directory matching setting of ${resolvedPath}:`, err);
      }
    }
    if (fs.existsSync(resolvedPath)) {
      return resolvedPath;
    }
  }

  // 2. Or env override
  if (process.env.OBSIDIAN_VAULT_PATH) {
    const resolvedPath = path.resolve(process.env.OBSIDIAN_VAULT_PATH);
    if (!fs.existsSync(resolvedPath)) {
      try {
        fs.mkdirSync(resolvedPath, { recursive: true });
      } catch {}
    }
    if (fs.existsSync(resolvedPath)) {
      return resolvedPath;
    }
  }

  // 3. Fallback
  const defaultDir = path.join(process.cwd(), "notes");
  if (!fs.existsSync(defaultDir)) {
    fs.mkdirSync(defaultDir, { recursive: true });
  }
  return defaultDir;
}

// Security sandbox for filenames
function getSafePath(filename: string): string {
  const safeName = path.basename(filename);
  // Ensure we append md if it somehow didn't have it
  const finalName = safeName.endsWith(".md") ? safeName : `${safeName}.md`;
  return path.join(getNotesDir(), finalName);
}

// Frontmatter helpers for standard Markdown compatibility
function parseNote(filename: string, rawContent: string): Note {
  const match = rawContent.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (match) {
    const yamlStr = match[1];
    const markdown = match[2];
    const meta: any = {};
    
    yamlStr.split("\n").forEach((line) => {
      const idx = line.indexOf(":");
      if (idx !== -1) {
        const key = line.slice(0, idx).trim();
        const value = line.slice(idx + 1).trim();
        meta[key] = value.replace(/^['"]|['"]$/g, "");
      }
    });

    return {
      filename,
      title: meta.title || filename.replace(".md", ""),
      content: markdown,
      createdAt: meta.createdAt || new Date().toISOString(),
      duration: meta.duration ? parseFloat(meta.duration) : undefined,
      transcriptionType: (meta.transcriptionType === "ai" ? "ai" : "realtime") as "realtime" | "ai",
    };
  }

  // Fallback for files without frontmatter
  return {
    filename,
    title: filename.replace(".md", ""),
    content: rawContent,
    createdAt: new Date().toISOString(),
    transcriptionType: "realtime",
  };
}

function stringifyNote(note: Partial<Note>): string {
  const frontmatter = `---
title: ${note.title || "Untitled Note"}
createdAt: ${note.createdAt || new Date().toISOString()}
transcriptionType: ${note.transcriptionType || "realtime"}
${note.duration !== undefined ? `duration: ${note.duration}` : ""}
---
${note.content || ""}
`;
  return frontmatter;
}

// Lazy Gemini API Client Initialization
let aiClient: GoogleGenAI | null = null;
function getAI(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY is not defined. Please add your API key in the Secrets panel.");
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// --- API VIEWS AND ENDPOINTS ---

// Check API health / setup status
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    hasApiKey: !!process.env.GEMINI_API_KEY,
    notesDir: getNotesDir(),
    obsidianPath: obsidianPathSetting,
  });
});

// Settings GET/POST for local Obsidian vault / custom path configurations
app.get("/api/settings", (req, res) => {
  res.json({
    obsidianPath: obsidianPathSetting,
    actualNotesDir: getNotesDir()
  });
});

app.post("/api/settings", (req, res) => {
  try {
    const { obsidianPath } = req.body;
    let targetPath = (obsidianPath || "").trim();
    
    if (targetPath) {
      const resolved = path.resolve(targetPath);
      // Validate that directory can either exist or be created recursively
      if (!fs.existsSync(resolved)) {
        fs.mkdirSync(resolved, { recursive: true });
      }
      obsidianPathSetting = resolved;
    } else {
      obsidianPathSetting = "";
    }

    // Persist to settings.json
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify({ obsidianPath: obsidianPathSetting }, null, 2), "utf-8");
    res.json({ success: true, obsidianPath: obsidianPathSetting, actualNotesDir: getNotesDir() });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to customize Obsidian directory path." });
  }
});

// List all notes
app.get("/api/notes", (req, res) => {
  try {
    const activeDir = getNotesDir();
    const files = fs.readdirSync(activeDir);
    const notes: Note[] = [];

    files.forEach((file) => {
      if (file.endsWith(".md")) {
        try {
          const filePath = path.join(activeDir, file);
          const rawContent = fs.readFileSync(filePath, "utf-8");
          notes.push(parseNote(file, rawContent));
        } catch (fileErr) {
          console.error(`Error reading note file ${file}:`, fileErr);
        }
      }
    });

    // Sort notes descending (most recent first)
    notes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.json(notes);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to read notes directory" });
  }
});

// Create or update a note
app.post("/api/notes", (req, res) => {
  try {
    const { filename, title, content, createdAt, duration, transcriptionType } = req.body;
    
    // Create new filename if none supplied
    const targetFilename = filename || `note_${Date.now()}.md`;
    const safePath = getSafePath(targetFilename);

    const notePayload: Note = {
      filename: path.basename(safePath),
      title: title || "New Voice Note",
      content: content || "",
      createdAt: createdAt || new Date().toISOString(),
      duration: duration !== undefined ? parseFloat(duration) : undefined,
      transcriptionType: transcriptionType || "realtime",
    };

    const serialized = stringifyNote(notePayload);
    fs.writeFileSync(safePath, serialized, "utf-8");
    
    res.json({ success: true, note: notePayload });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to save note" });
  }
});

// Delete a note
app.delete("/api/notes/:filename", (req, res) => {
  try {
    const { filename } = req.params;
    const safePath = getSafePath(filename);
    
    if (fs.existsSync(safePath)) {
      fs.unlinkSync(safePath);
      res.json({ success: true, deleted: filename });
    } else {
      res.status(404).json({ error: "Note not found" });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to delete note" });
  }
});

// API endpoint to post-refine text transcriptions into specific types
app.post("/api/gemini/refine", async (req, res) => {
  try {
    const { text, noteType } = req.body;
    if (!text || text.trim().length === 0) {
      return res.status(400).json({ error: "No transcription text to refine" });
    }

    const ai = getAI();
    let promptPrefix = "";

    switch (noteType) {
      case "bullet_points":
        promptPrefix = "Analyze the speech transcript below. Reorganize and clean up grammatical issues, then represent it completely and accurately using bullet points grouped under logical header sections. Highlight key names or values in bold.";
        break;
      case "checklist":
        promptPrefix = "Analyze the speech transcript below. Synthesize it into a clean checklist/to-do list. Use '[ ]' for unchecked items or logical tasks, and organise by headings if appropriate. Highlight important things.";
        break;
      case "meeting_minutes":
        promptPrefix = "Format the speech transcript below into highly professional, structured Meeting Minutes. Create sections for Date, Objective, Quick Summary, Key Highlights, and Action Items with owners if named.";
        break;
      case "journal":
        promptPrefix = "Format the speech transcript into a deep, beautifully written personal Journal Entry or diary page. Clean up stutters and layout elegant paragraphs, quotes, and bullet lists for reflection.";
        break;
      default:
        promptPrefix = "Redraft and structure the raw speech transcription below into clean, beautifully formatted general Markdown. Fix run-on sentences, separate spoken thoughts into clear paragraphs, and use headings where appropriate.";
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `${promptPrefix}\n\nSPEECH TRANSCRIPT TO REFORMAT:\n"${text}"\n\nProvide the formatted markdown output ONLY. No chat preamble or conversational intro.`,
    });

    res.json({ refinedText: response.text || "" });
  } catch (err: any) {
    console.error("Refinement server error:", err);
    res.status(500).json({ error: err.message || "Intermittent error when contacting Gemini formatting service." });
  }
});

// API endpoint to transcribe audio file base64 directly with Gemini audio modal
app.post("/api/gemini/audio-transcribe", async (req, res) => {
  try {
    const { audioBase64, mimeType } = req.body;
    if (!audioBase64) {
      return res.status(400).json({ error: "No audio stream data provided" });
    }

    const ai = getAI();
    
    // Transcribe with multimodal audio capability using gemini-3.5-flash
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [
        {
          inlineData: {
            data: audioBase64,
            mimeType: mimeType || "audio/webm",
          },
        },
        "Transcribe this voice audio accurately. Present the output directly as clean, nicely formatted Markdown with appropriate paragraphs, lists, and spacing based on what was spoken. Outputs ONLY the note content. No conversational introduction.",
      ],
    });

    const transcription = response.text || "";

    // Suggest a short headline
    let title = "Voice Recording";
    if (transcription.trim().length > 0) {
      try {
        const titleRes = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: `Create a very short, specific 3-to-4 word description/title for a note with this content. Output the brief title directly (do not use quotes or markdown formatting):\n\n${transcription.slice(0, 1000)}`,
        });
        title = (titleRes.text || "Voice Recording").replace(/["'#*]/g, "").trim();
      } catch (tErr) {
        console.error("Subtext title prompt error", tErr);
      }
    }

    res.json({ transcription, title });
  } catch (err: any) {
    console.error("Gemini Multimodal Speech-to-Text error:", err);
    res.status(500).json({ error: err.message || "Failed to parse audio streaming." });
  }
});

// Configure development or static serving
async function bootstrap() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    // Mount Vite development middlewares
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running actively at http://localhost:${PORT}`);
  });
}

bootstrap();
