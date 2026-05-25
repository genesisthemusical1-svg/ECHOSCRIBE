/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Note {
  filename: string; // e.g., "note_1716654000000.md"
  title: string;
  content: string;
  createdAt: string; // ISO Timestamp
  duration?: number; // seconds of source audio if recorded
  transcriptionType: 'realtime' | 'ai';
}

export interface RefineRequest {
  text: string;
  noteType: 'bullet_points' | 'checklist' | 'meeting_minutes' | 'journal' | 'raw';
}

export interface RefineResponse {
  refinedText: string;
}

export interface TranscribeRequest {
  audioBase64: string;
  mimeType: string;
  duration?: number;
}

export interface TranscribeResponse {
  transcription: string;
  title: string;
}
