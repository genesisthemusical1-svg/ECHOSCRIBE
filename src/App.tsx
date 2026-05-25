/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  motion, 
  AnimatePresence 
} from 'motion/react';
import { 
  Mic, 
  MicOff, 
  Plus, 
  Search, 
  Sparkles, 
  Save, 
  Download, 
  Trash2, 
  FileText, 
  Clock, 
  Calendar, 
  Check, 
  Info, 
  AlertCircle, 
  Bell, 
  Copy, 
  Edit, 
  ArrowRight, 
  RefreshCw, 
  BookOpen, 
  Cloud,
  CloudLightning,
  Library as LibraryIcon,
  ChevronLeft,
  Settings,
  Monitor,
  Menu,
  ChevronRight,
  LogOut,
  FolderOpen,
  Award
} from 'lucide-react';
import { Note } from './types.ts';
import { 
  formatFriendlyDate, 
  formatDuration, 
  parseAndStyleMarkdown,
  localPolishGrammar
} from './utils.tsx';
import { 
  initAuth, 
  googleSignIn, 
  logout, 
  getAccessToken,
  setAccessTokenInMemory
} from './firebase.ts';
import {
  findOrCreateFolder,
  findOrCreateSpreadsheet,
  syncNoteFile,
  updateSheetsIndex
} from './googleSync.ts';
import { User } from 'firebase/auth';

declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}

export default function App() {
  // Navigation & Core state
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isEditorMode, setIsEditorMode] = useState(false); // Toggle markdown raw edit
  const [showLibrary, setShowLibrary] = useState(true); // Toggle clean library drawer

  // Google OAuth Sync state
  const [user, setUser] = useState<User | null>(null);
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);
  const [driveFolderId, setDriveFolderId] = useState<string | null>(null);
  const [spreadsheetId, setSpreadsheetId] = useState<string | null>(null);
  const [googleSyncing, setGoogleSyncing] = useState(false);

  // Active inputs
  const [noteTitle, setNoteTitle] = useState('');
  const [noteText, setNoteText] = useState('');
  const [currentTranscriptionType, setCurrentTranscriptionType] = useState<'realtime' | 'ai'>('realtime');

  // Post-recording Title Request Modal state
  const [showTitleModal, setShowTitleModal] = useState(false);
  const [tempNoteText, setTempNoteText] = useState('');
  const [tempDuration, setTempDuration] = useState(0);
  const [tempTranscriptionType, setTempTranscriptionType] = useState<'realtime' | 'ai'>('realtime');
  const [suggestedTitle, setSuggestedTitle] = useState('');

  // Recording processes
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordingMode, setRecordingMode] = useState<'realtime' | 'ai'>('realtime');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [audioWaveform, setAudioWaveform] = useState<number[]>([]);

  // System & Toast configurations
  const [apiHealth, setApiHealth] = useState<{ hasApiKey: boolean; status: string } | null>(null);
  const [notificationPermission, setNotificationPermission] = useState<'default' | 'granted' | 'denied' | 'unsupported'>('default');
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [obsidianPath, setObsidianPath] = useState('');
  const [actualNotesDir, setActualNotesDir] = useState('');
  const [inputObsidianPath, setInputObsidianPath] = useState('');
  const [showToast, setShowToast] = useState<{ show: boolean; msg: string; type: 'success' | 'info' | 'error' }>({ show: false, msg: '', type: 'info' });

  // Status Indicators
  const [isRefining, setIsRefining] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTranscribingAudio, setIsTranscribingAudio] = useState(false);

  // References
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const waveformIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Trigger quick styled toast
  const triggerToast = (msg: string, type: 'success' | 'info' | 'error' = 'success') => {
    setShowToast({ show: true, msg, type });
    setTimeout(() => {
      setShowToast(prev => ({ ...prev, show: false }));
    }, 4000);
  };

  // Mount logic: fetch API status, local notes, and check google sync auth
  useEffect(() => {
    fetchHealthCheck();
    fetchSettings();
    fetchNotesList();

    // Setup Notification status
    if (!('Notification' in window)) {
      setNotificationPermission('unsupported');
    } else {
      setNotificationPermission(Notification.permission as any);
    }

    // Try auto-handling Google Auth check
    initAuth(
      async (firebaseUser, token) => {
        setUser(firebaseUser);
        setGoogleToken(token);
        await bootstrapGoogleIntegration(token, firebaseUser);
      },
      () => {
        // Safe fail
        setUser(null);
        setGoogleToken(null);
      }
    );
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        setObsidianPath(data.obsidianPath || '');
        setActualNotesDir(data.actualNotesDir || '');
        setInputObsidianPath(data.obsidianPath || '');
      }
    } catch (err) {
      console.error("Failed to load Obsidian path settings", err);
    }
  };

  const handleSaveObsidianPath = async (newPath: string) => {
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ obsidianPath: newPath })
      });
      if (res.ok) {
        const data = await res.json();
        setObsidianPath(data.obsidianPath || '');
        setActualNotesDir(data.actualNotesDir || '');
        setInputObsidianPath(data.obsidianPath || '');
        triggerToast("Obsidian / Local path updated!", "success");
        await fetchNotesList();
      } else {
        const err = await res.json();
        triggerToast(err.error || "Failed to update path", "error");
      }
    } catch {
      triggerToast("Error updating storage path", "error");
    }
  };

  const fetchHealthCheck = async () => {
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const data = await res.json();
        setApiHealth({ hasApiKey: data.hasApiKey, status: data.status });
      }
    } catch {
      setApiHealth({ hasApiKey: false, status: 'unreachable' });
    }
  };

  const fetchNotesList = async (selectFirstId: boolean = false) => {
    try {
      const res = await fetch('/api/notes');
      if (res.ok) {
        const data = await res.json();
        setNotes(data || []);
        if (selectFirstId && data.length > 0) {
          selectNote(data[0]);
        }
      }
    } catch (err) {
      console.error("Failed to read notes directory", err);
    }
  };

  // Bootstrap Google Drive Folder and Sheet spreadsheets
  const bootstrapGoogleIntegration = async (token: string, firebaseUser: User) => {
    setGoogleSyncing(true);
    try {
      const folderId = await findOrCreateFolder(token);
      setDriveFolderId(folderId);

      const sheetId = await findOrCreateSpreadsheet(token, folderId);
      setSpreadsheetId(sheetId);
      
      triggerToast(`Successfully synced to Google Drive & Sheets!`, "success");
    } catch (err: any) {
      console.error(err);
      triggerToast("Failed to initialize Google Folder: " + err.message, "error");
    } finally {
      setGoogleSyncing(false);
    }
  };

  // Trigger Google Sign-in flow
  const handleGoogleConnect = async () => {
    setIsConnectingGoogle(true);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setGoogleToken(result.accessToken);
        triggerToast("Google user authenticated!", "success");
        await bootstrapGoogleIntegration(result.accessToken, result.user);
      }
    } catch (err: any) {
      console.error("Google Auth error:", err);
      triggerToast(err.message || "Failed to authenticate Google Workspace", "error");
    } finally {
      setIsConnectingGoogle(false);
    }
  };

  const handleGoogleDisconnect = async () => {
    if (confirm("Disconnect Google Drive and Sheets sync?")) {
      await logout();
      setUser(null);
      setGoogleToken(null);
      setDriveFolderId(null);
      setSpreadsheetId(null);
      triggerToast("Google Sync disconnected.", "info");
    }
  };

  // Triggers background sync to user's Google Drive and Google Sheets!
  const syncNotesToGoogleDrive = async (silent: boolean = false) => {
    if (!googleToken || !driveFolderId || !spreadsheetId) {
      if (!silent) triggerToast("Google account not connected or initialized", "error");
      return;
    }

    setGoogleSyncing(true);
    if (!silent) triggerToast("Syncing your local library to Google Workspace...", "info");

    try {
      const syncedNotes = [...notes];
      const syncedNotesWithGoogleIds: Note[] = [];

      // Iterate and sync files
      for (const note of syncedNotes) {
        try {
          const driveFileId = await syncNoteFile(googleToken, driveFolderId, note);
          syncedNotesWithGoogleIds.push({
            ...note,
            content: note.content // local reference mapping
          });
          // Attach for sheet indexing
          (note as any).googleDriveId = driveFileId;
        } catch (e) {
          console.error(`Error syncing note ${note.title}:`, e);
        }
      }

      // Overwrite Index Row Spreadsheet
      await updateSheetsIndex(googleToken, spreadsheetId, syncedNotes as any);
      
      if (!silent) {
        triggerToast("Google Drive & Sheets synchronized!", "success");
        sendDesktopNotification("Google Sync Complete", "All local notes were successfully updated in Google Drive and listed in Sheets.");
      }
    } catch (err: any) {
      console.error(err);
      if (!silent) triggerToast("Failed to synchronize with Google: " + err.message, "error");
    } finally {
      setGoogleSyncing(false);
    }
  };

  // Request notifications
  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      triggerToast("Notifications are not supported in this browser.", "error");
      return;
    }
    try {
      const status = await Notification.requestPermission();
      setNotificationPermission(status as any);
      if (status === 'granted') {
        new Notification("Notifications Connected!", {
          body: "You'll now receive brief status updates for completed recordings.",
        });
        triggerToast("Notifications enabled!", "success");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const sendDesktopNotification = (title: string, body: string) => {
    if (notificationPermission === 'granted') {
      try {
        new Notification(title, { body });
      } catch (err) {
        console.warn("Desktop notification trigger failed", err);
      }
    }
  };

  // Filter notes in local listings
  const filteredNotes = useMemo(() => {
    return notes.filter(n => {
      const search = searchTerm.toLowerCase();
      return n.title.toLowerCase().includes(search) || n.content.toLowerCase().includes(search);
    });
  }, [notes, searchTerm]);

  // Selects notes
  const selectNote = (note: Note) => {
    if (isRecording) {
      if (!confirm("Stop recording to switch notes?")) return;
      stopRecordingAction();
    }
    setSelectedNote(note);
    setNoteTitle(note.title);
    setNoteText(note.content);
    setCurrentTranscriptionType(note.transcriptionType);
    setIsEditorMode(false);
  };

  // Save changes locally and immediately trigger background Google Sync if authenticated!
  const saveNoteToServer = async (overrideText?: string, overrideTitle?: string) => {
    const textToSave = overrideText !== undefined ? overrideText : noteText;
    const titleToSave = overrideTitle !== undefined ? overrideTitle : noteTitle;
    
    if (!titleToSave.trim()) {
      triggerToast("Please enter a note title", "error");
      return;
    }
    
    setIsSaving(true);
    try {
      const payload: Note = {
        filename: selectedNote?.filename || `note_${Date.now()}.md`,
        title: titleToSave,
        content: textToSave,
        transcriptionType: selectedNote?.transcriptionType || currentTranscriptionType,
        duration: selectedNote?.duration || (recordingSeconds > 0 ? recordingSeconds : undefined),
        createdAt: selectedNote?.createdAt || new Date().toISOString()
      };

      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        triggerToast("Saved locally", "success");
        
        // Reload list and map chosen index
        await fetchNotesList();
        
        if (data.note) {
          setSelectedNote(data.note);
        }

        // Trigger Google Workspace background sync if active
        if (googleToken && driveFolderId && spreadsheetId) {
          triggerToast("Syncing changes to Google Drive & Sheets...", "info");
          try {
            const driveFileId = await syncNoteFile(googleToken, driveFolderId, data.note || payload);
            (data.note || payload).googleDriveId = driveFileId;
            
            // Re-get list and post Sheet update
            const freshRes = await fetch('/api/notes');
            if (freshRes.ok) {
              const freshNotes = await freshRes.json();
              // Update local array link temporarily for Sheets update
              const mappedNotes = freshNotes.map((n: any) => {
                if (n.filename === payload.filename) {
                  n.googleDriveId = driveFileId;
                }
                return n;
              });
              await updateSheetsIndex(googleToken, spreadsheetId, mappedNotes);
            }
            triggerToast("Synced to Google Folder & Sheets!", "success");
          } catch (gErr: any) {
            console.error(gErr);
            triggerToast("Background Google Sync failed: " + gErr.message, "error");
          }
        }
      } else {
        const errData = await res.json();
        triggerToast(errData.error || "Failed to save file", "error");
      }
    } catch {
      triggerToast("Connection lost to server save endpoint", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const deleteNoteFromServer = async (filename: string) => {
    if (!confirm("Are you sure you want to permanently delete this note?")) {
      return;
    }
    try {
      const res = await fetch(`/api/notes/${filename}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        triggerToast("Note deleted", "success");
        if (selectedNote?.filename === filename) {
          setSelectedNote(null);
          setNoteTitle('');
          setNoteText('');
        }
        await fetchNotesList();
        
        // Re-sync Sheets spreadsheet to reflect deletion
        if (googleToken && spreadsheetId) {
          syncNotesToGoogleDrive(true);
        }
      }
    } catch {
      triggerToast("Failed to delete note", "error");
    }
  };

  // Clipboard copies
  const copyRawContent = () => {
    navigator.clipboard.writeText(noteText);
    triggerToast("Copied raw markdown!", "success");
  };

  // Export & Download Markdown file
  const downloadMarkdownFileLocal = () => {
    try {
      const element = document.createElement("a");
      const filePayload = `---
title: ${noteTitle}
createdAt: ${selectedNote?.createdAt || new Date().toISOString()}
transcriptionType: ${selectedNote?.transcriptionType || 'realtime'}
---
${noteText}`;

      const file = new Blob([filePayload], { type: 'text/markdown;charset=utf-8' });
      element.href = URL.createObjectURL(file);
      element.download = `${noteTitle.toLowerCase().replace(/[^a-z0-9]+/g, '_') || 'recording_note'}.md`;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
      triggerToast("Download triggered!", "success");
    } catch {
      triggerToast("Download failed", "error");
    }
  };

  // --- REFINING STYLES (GEMINI) ---
  const applyAIRefinement = async (type: 'bullet_points' | 'checklist' | 'meeting_minutes' | 'journal' | 'raw') => {
    if (!noteText.trim()) {
      triggerToast("No content to refine!", "info");
      return;
    }

    if (type === 'raw') {
      setIsRefining(true);
      try {
        const polished = localPolishGrammar(noteText);
        setNoteText(polished);
        triggerToast("Punctuation & stutters clean!", "success");
        if (selectedNote) {
          await saveNoteToServer(polished);
        }
      } catch (err) {
        triggerToast("Error polishing grammar locally.", "error");
      } finally {
        setIsRefining(false);
      }
      return;
    }

    if (apiHealth && !apiHealth.hasApiKey) {
      triggerToast("Gemini Key is missing. Add GEMINI_API_KEY in block secrets.", "error");
      return;
    }

    setIsRefining(true);
    triggerToast("Gemini organizing note...", "info");
    try {
      const res = await fetch('/api/gemini/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: noteText, noteType: type })
      });

      if (res.ok) {
        const data = await res.json();
        setNoteText(data.refinedText);
        triggerToast("Formatting complete!", "success");
        if (selectedNote) {
          await saveNoteToServer(data.refinedText);
        }
      } else {
        const err = await res.json();
        triggerToast(err.error || "Formatting error", "error");
      }
    } catch {
      triggerToast("Connection failed during format request", "error");
    } finally {
      setIsRefining(false);
    }
  };

  // Waveform effect loop
  const simulateWaveforms = () => {
    waveformIntervalRef.current = setInterval(() => {
      setAudioWaveform(prev => {
        const next = [...prev];
        if (next.length > 25) next.shift();
        next.push(Math.floor(Math.random() * 85) + 10);
        return next;
      });
    }, 110);
  };

  // --- RECORDING WORKFLOWS ---
  const startRecordingAction = async () => {
    if (isRecording) {
      stopRecordingAction();
      return;
    }

    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      triggerToast("Microphone denied. Check browser voice permissions.", "error");
      return;
    }

    // Set record states
    setRecordingSeconds(0);
    setAudioWaveform(Array(18).fill(8));
    setIsRecording(true);
    setInterimTranscript('');

    // Start timer counter
    timerIntervalRef.current = setInterval(() => {
      setRecordingSeconds(prev => prev + 1);
    }, 1000);

    simulateWaveforms();

    if (recordingMode === 'realtime') {
      runBrowserSpeechRecognition();
    } else {
      runMultimodalAudioRecording();
    }
  };

  const stopRecordingAction = () => {
    if (!isRecording) return;
    setIsRecording(false);

    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (waveformIntervalRef.current) {
      clearInterval(waveformIntervalRef.current);
      waveformIntervalRef.current = null;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (err) {
        console.error(err);
      }
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (err) {
        console.error(err);
      }
    }

    triggerToast("Recording completed", "info");
  };

  // Standard WebSpeech API
  const runBrowserSpeechRecognition = () => {
    const SpeechClass = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechClass) {
      triggerToast("Speech API unsupported. Defaulting to Multimodal WAV snippet!", "info");
      setRecordingMode('ai');
      setTimeout(() => {
        runMultimodalAudioRecording();
      }, 300);
      return;
    }

    const rec = new SpeechClass();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';

    let recognizedText = "";

    rec.onstart = () => {
      triggerToast("Continuous microphone listening...", "success");
    };

    rec.onresult = (e: any) => {
      let interim = '';
      let finalized = '';

      for (let i = e.resultIndex; i < e.results.length; ++i) {
        if (e.results[i].isFinal) {
          finalized += e.results[i][0].transcript;
        } else {
          interim += e.results[i][0].transcript;
        }
      }

      setInterimTranscript(interim);
      if (finalized) {
        recognizedText = recognizedText ? recognizedText + ' ' + finalized : finalized;
      }
    };

    rec.onerror = (err: any) => {
      console.error(err);
      if (err.error !== 'no-speech') {
        triggerToast(`Dictation issue: ${err.error}`, "error");
        stopRecordingAction();
      }
    };

    rec.onend = () => {
      setInterimTranscript('');
      
      // Immediately request details & title
      if (recognizedText.trim().length > 0) {
        // Prepare title modal
        const dateStr = new Date().toLocaleDateString();
        setSuggestedTitle(`Realtime Note - ${dateStr}`);
        setTempNoteText(recognizedText.trim());
        setTempDuration(recordingSeconds);
        setTempTranscriptionType('realtime');
        
        // Open the naming modal!
        setShowTitleModal(true);
      } else {
        triggerToast("No vocal transcription captured.", "info");
      }
    };

    recognitionRef.current = rec;
    rec.start();
  };

  // Multimodal Gemini WAV snippet capture
  const runMultimodalAudioRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      let recorder: MediaRecorder;
      
      try {
        recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      } catch {
        recorder = new MediaRecorder(stream);
      }

      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        // Release tracks
        stream.getTracks().forEach(t => t.stop());
        
        // Process
        await processMultimodalAudioBlob(audioBlob);
      };

      mediaRecorderRef.current = recorder;
      recorder.start(1000);
      triggerToast("AI tape recorder running...", "success");
    } catch {
      triggerToast("Failed to launch recording hardware", "error");
      setIsRecording(false);
    }
  };

  const processMultimodalAudioBlob = async (blob: Blob) => {
    if (apiHealth && !apiHealth.hasApiKey) {
      triggerToast("Gemini key missing.", "error");
      return;
    }

    setIsTranscribingAudio(true);
    triggerToast("Decompressing audio & parsing with Gemini...", "info");

    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onloadend = async () => {
      try {
        const base64Data = (reader.result as string).split(',')[1];
        
        const res = await fetch('/api/gemini/audio-transcribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            audioBase64: base64Data,
            mimeType: blob.type
          })
        });

        if (res.ok) {
          const data = await res.json();
          
          // Pre-fill fields but trigger manual Title Confirmation Modal!
          const generatedText = data.transcription || "";
          const headerSuggestion = data.title || `AI Note - ${new Date().toLocaleDateString()}`;

          setTempNoteText(generatedText);
          setSuggestedTitle(headerSuggestion);
          setTempDuration(recordingSeconds);
          setTempTranscriptionType('ai');

          // Launch modal!
          setShowTitleModal(true);
          triggerToast("Transcription parsed! Choose a title.", "success");
        } else {
          const errData = await res.json();
          triggerToast(errData.error || "Multimodal error", "error");
        }
      } catch {
        triggerToast("Failed to contact Gemini audio engine", "error");
      } finally {
        setIsTranscribingAudio(false);
      }
    };
  };

  // Submit Naming Modal: Actually saves and starts background Google Folder upload!
  const handleSubmitTitleModal = async (finalTitle: string) => {
    if (!finalTitle.trim()) {
      triggerToast("Please enter a valid note title", "error");
      return;
    }

    setShowTitleModal(false);
    setIsSaving(true);

    const generatedFilename = `note_${Date.now()}.md`;
    const payload: Note = {
      filename: generatedFilename,
      title: finalTitle.trim(),
      content: tempNoteText,
      transcriptionType: tempTranscriptionType,
      duration: tempDuration > 0 ? tempDuration : undefined,
      createdAt: new Date().toISOString()
    };

    try {
      // Save locally to server
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        triggerToast(`Saved "${finalTitle}" locally`, "success");
        sendDesktopNotification("Note Created", `Successfully drafted: "${finalTitle}"`);
        
        setNoteText(tempNoteText);
        setNoteTitle(finalTitle);
        setCurrentTranscriptionType(tempTranscriptionType);
        
        // Reload list and select this newly compiled note
        await fetchNotesList();
        if (data.note) {
          setSelectedNote(data.note);
        }

        // Handle quick background sync to Drive & Sheets spreadsheet if logged in
        if (googleToken && driveFolderId && spreadsheetId) {
          triggerToast("Syncing new index on Google Drive...", "info");
          try {
            const driveFileId = await syncNoteFile(googleToken, driveFolderId, data.note || payload);
            (data.note || payload).googleDriveId = driveFileId;

            // Re-render spreadsheet rows list
            const freshRes = await fetch('/api/notes');
            if (freshRes.ok) {
              const freshNotes = await freshRes.json();
              const mappedNotes = freshNotes.map((n: any) => {
                if (n.filename === generatedFilename) {
                  n.googleDriveId = driveFileId;
                }
                return n;
              });
              await updateSheetsIndex(googleToken, spreadsheetId, mappedNotes);
            }
            triggerToast("Synchronized to Google Sheets and Drive!", "success");
          } catch (syncErr: any) {
            console.error(syncErr);
            triggerToast("Drive sync deferred: " + syncErr.message, "error");
          }
        }

        // Close library or leave it; view the rendered page automatically
        setIsEditorMode(false);
      } else {
        triggerToast("Failed to save recording to backend", "error");
      }
    } catch {
      triggerToast("Save connection offline", "error");
    } finally {
      setIsSaving(false);
      setTempNoteText('');
      setTempDuration(0);
    }
  };

  // Compile active note content styling render
  const renderedContent = useMemo(() => {
    return parseAndStyleMarkdown(noteText);
  }, [noteText]);

  return (
    <div className="min-h-screen bg-[#09090B] text-[#D4D4D8] flex flex-col font-sans select-none antialiased" id="app-root-container">
      
      {/* Top Header/Status bar */}
      <header className="bg-[#09090B] border-b border-[#1C1C1F] py-4 px-6 sticky top-0 z-30 flex items-center justify-between" id="primary-app-header">
        <div className="flex items-center gap-3">
          <div className="bg-[#10B981]/10 text-[#10B981] p-1.5 rounded-lg flex items-center justify-center">
            <Mic className="h-4.5 w-4.5" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white tracking-widest uppercase flex items-center gap-2">
              EchoScribe
              <span className="h-1.5 w-1.5 rounded-full bg-[#10B981] animate-pulse"></span>
            </h1>
          </div>
        </div>

        {/* User Workspace & Google Sync Panel */}
        <div className="flex items-center gap-3">
          {/* Settings button to customize storage paths and run locally */}
          <button 
            type="button"
            onClick={() => setShowSettingsPanel(!showSettingsPanel)}
            className={`p-2 rounded-lg transition-all flex items-center justify-center cursor-pointer ${
              showSettingsPanel 
                ? 'bg-[#10B981]/15 text-[#10B981]' 
                : 'text-[#71717A] hover:text-white hover:bg-[#18181B]'
            }`}
            title="App Customization & Local PC Vault Setup"
            id="settings-panel-toggle-btn"
          >
            <Settings className="h-4.5 w-4.5" />
          </button>

          {/* Library Folder icon toggle for clean browsing list */}
          <button
            onClick={() => setShowLibrary(!showLibrary)}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all border ${
              showLibrary 
                ? 'bg-[#18181B] border-[#10B981]/40 text-white' 
                : 'bg-transparent border-[#1C1C1F] text-[#A1A1AA] hover:text-white hover:bg-[#18181B]'
            }`}
            title="Toggle Library Catalog"
          >
            <LibraryIcon className="h-3.5 w-3.5" />
            <span>Library ({notes.length})</span>
          </button>

          {/* Sync status element */}
          {user ? (
            <div className="flex items-center gap-2 bg-[#18181B] border border-[#27272A] rounded-lg pl-3 pr-2 py-1" id="synced-google-account-pill">
              <Cloud className="h-3.5 w-3.5 text-[#10B981]" />
              <div className="text-[11px] font-medium text-[#D4D4D8] max-w-[150px] truncate leading-none">
                {user.email}
              </div>
              
              <div className="h-3 w-[1px] bg-[#27272A] mx-1" />

              <button
                onClick={() => syncNotesToGoogleDrive(false)}
                disabled={googleSyncing}
                className="p-1 hover:bg-[#27272A] rounded text-[#10B981] transition-colors cursor-pointer"
                title="Sync library to Google Folder & update Sheet Index"
              >
                {googleSyncing ? (
                  <RefreshCw className="h-3 w-3 animate-spin text-[#10B981]" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
              </button>

              <button
                onClick={handleGoogleDisconnect}
                className="p-1 hover:bg-red-950/20 rounded text-red-400 transition-colors cursor-pointer"
                title="Sign out of Google Sync"
              >
                <LogOut className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <button
              onClick={handleGoogleConnect}
              disabled={isConnectingGoogle}
              className="flex items-center gap-2 bg-white text-black hover:bg-zinc-200 transition-colors text-xs font-bold px-3 py-1.5 rounded-lg cursor-pointer disabled:opacity-50"
              id="google-sign-in-pill"
            >
              {isConnectingGoogle ? (
                <RefreshCw className="h-3 w-3 animate-spin" />
              ) : (
                <svg className="h-3.5 w-3.5" viewBox="0 0 48 48">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                </svg>
              )}
              <span>{isConnectingGoogle ? 'Syncing...' : 'Connect to Google'}</span>
            </button>
          )}
        </div>
      </header>

      {/* OS & Local PC Sync Setup Configuration Panel */}
      <AnimatePresence>
        {showSettingsPanel && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-[#0C0C0E] border-b border-[#1C1C1F] overflow-hidden"
            id="obsidian-settings-view-panel"
          >
            <div className="max-w-6xl mx-auto p-6 md:p-8 space-y-6 text-xs text-[#A1A1AA]">
              
              <div className="flex justify-between items-center border-b border-[#1C1C1F] pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-md bg-[#10B981]/15 text-[#10B981]">
                    <Settings className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm uppercase tracking-wider">Sync Integrations & Local PC Preferences</h3>
                    <p className="text-[10px] text-zinc-500 mt-0.5">Configure Obsidian local vaults, cloud drive backups, and multi-platform boots.</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowSettingsPanel(false)}
                  className="text-zinc-500 hover:text-white bg-[#18181B] hover:bg-[#27272A] px-3 py-1.5 rounded-lg font-medium transition-all transition-colors cursor-pointer"
                >
                  Close Settings ✕
                </button>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                
                {/* COLUMN 1: OBSIDIAN LOCAL DIRECTORY SETTING */}
                <div className="space-y-3.5 bg-[#121214] p-5 rounded-xl border border-[#1C1C1F] flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-white font-bold text-xs uppercase tracking-wider">
                      <BookOpen className="h-4 w-4 text-[#10B981]" />
                      Obsidian Vault Integration
                    </div>
                    <p className="leading-relaxed text-[#8E8E93]">
                      Obsidian operates purely on a folder of standard <code className="text-[#10B981] bg-[#10B981]/5 px-1 rounded font-mono text-[10px]">.md</code> files. Enter the folder path below to point EchoScribe directly to your Obsidian vault directory.
                    </p>
                    <p className="text-[10px] italic text-[#71717A]">
                      Whenever you record or make edits, Markdown files will save directly inside your local vault vault!
                    </p>
                  </div>

                  <div className="space-y-2.5 pt-2">
                    <label className="block text-[10px] uppercase tracking-wider font-bold text-zinc-400">Vault Local Path:</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={inputObsidianPath}
                        onChange={(e) => setInputObsidianPath(e.target.value)}
                        placeholder={window.navigator.platform.toLowerCase().includes('win') ? "C:\\Users\\Account\\MyObsidianVault" : "/Users/account/Obsidian/Vault"}
                        className="flex-1 bg-[#09090B] border border-[#27272A] text-white text-[11px] font-mono p-2 rounded-lg placeholder-zinc-700 focus:outline-hidden focus:border-[#10B981] focus:ring-1 focus:ring-[#10B981]/20 transition-all text-ellipsis"
                      />
                      <button
                        onClick={() => handleSaveObsidianPath(inputObsidianPath)}
                        className="bg-white hover:bg-zinc-200 text-black px-3.5 rounded-lg text-xs font-bold transition-all transition-colors cursor-pointer text-center"
                      >
                        Mount
                      </button>
                    </div>
                    
                    <div className="pt-2 text-[10px] text-zinc-500 space-y-1">
                      <div className="flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#10B981]" />
                        <span>Active Target:</span>
                      </div>
                      <div className="bg-[#09090B] p-2 rounded border border-zinc-900 break-all select-all font-mono text-[10px] text-zinc-400 leading-normal">
                        {actualNotesDir || "Default App Folder"}
                      </div>
                    </div>
                  </div>
                </div>

                {/* COLUMN 2: HOW TO RUN NATIVELY ON YOUR OWN PC */}
                <div className="space-y-3 bg-[#121214] p-5 rounded-xl border border-[#1C1C1F] lg:col-span-2 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-white font-bold text-xs uppercase tracking-wider">
                      <Monitor className="h-4 w-4 text-[#10B981]" />
                      Run Natively on your PC (Offline Local Server)
                    </div>
                    <p className="leading-relaxed text-[#8E8E93]">
                      By default, this preview is previewing on a sandbox container. You can instantly run this full system and all services <strong>directly on your local computer</strong> so it links seamlessly to your offline file system:
                    </p>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4 pb-1 pt-1 text-[11px]">
                    <div className="bg-[#09090B] p-3 rounded-lg border border-[#1C1C1F] space-y-2">
                      <div className="font-semibold text-white flex items-center gap-1.5">
                        <span className="bg-[#18181B] border border-zinc-805 h-4 w-4 rounded-full inline-flex items-center justify-center text-[10px]">1</span>
                        Download Source ZIP / Git
                      </div>
                      <p className="text-zinc-400 leading-relaxed text-[11px]">
                        Open the AI Studio settings menu at the top right header, and select <strong>Export to GitHub</strong> or <strong>Download ZIP</strong> to save the code to your local computer.
                      </p>
                    </div>

                    <div className="bg-[#09090B] p-3 rounded-lg border border-[#1C1C1F] space-y-1">
                      <div className="font-semibold text-white flex items-center gap-1.5">
                        <span className="bg-[#18181B] border border-zinc-805 h-4 w-4 rounded-full inline-flex items-center justify-center text-[10px]">2</span>
                        Install Node Dependencies
                      </div>
                      <p className="text-zinc-400 leading-relaxed text-[11px]">
                        Unpack the ZIP and open your computer Terminal in that folder. Install program dependencies by typing the command:
                      </p>
                      <pre className="bg-zinc-950 p-1.5 rounded text-[10px] font-mono text-emerald-400 border border-zinc-850 select-all block mt-1.5 text-center">npm install</pre>
                    </div>

                    <div className="bg-[#09090B] p-3 rounded-lg border border-[#1C1C1F] space-y-1">
                      <div className="font-semibold text-white flex items-center gap-1.5">
                        <span className="bg-[#18181B] border border-zinc-805 h-4 w-4 rounded-full inline-flex items-center justify-center text-[10px]">3</span>
                        Gemini & Google Setup
                      </div>
                      <p className="text-zinc-400 leading-relaxed text-[11px]">
                        Create a local file named <code className="text-[#10B981]">.env</code> inside the root directory, pasting your offline secret Gemini keys inside:
                      </p>
                      <pre className="bg-zinc-950 p-1.5 rounded text-[9px] font-mono text-emerald-400 border border-zinc-850 select-all block mt-1 leading-normal">
GEMINI_API_KEY=AIzaSy...
PORT=3000</pre>
                    </div>

                    <div className="bg-[#09090B] p-3 rounded-lg border border-[#1C1C1F] space-y-1.5">
                      <div className="font-semibold text-white flex items-center gap-1.5">
                        <span className="bg-[#18181B] border border-zinc-805 h-4 w-4 rounded-full inline-flex items-center justify-center text-[10px]">4</span>
                        Boot the Local Server
                      </div>
                      <p className="text-zinc-400 leading-relaxed text-[10px]">
                        Boot the offline development engine by entering:
                        <code className="block select-all font-mono bg-zinc-950 text-emerald-400 p-1.5 mt-1 border border-zinc-850 rounded text-center">npm run dev</code>
                        Point your browser to <code className="text-[#10B981]">http://localhost:3000</code> and configure your custom Obsidian path input there!
                      </p>
                    </div>
                  </div>

                  {/* Auto Boot options */}
                  <div className="border-t border-zinc-900 pt-3 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between text-[10px]">
                    <span className="font-semibold text-white uppercase tracking-wider text-[9px]">🖥️ SYSTEM BOOT INSTANT AUTO-STARTUP CHANNELS:</span>
                    <div className="flex gap-4">
                      <div>
                        <span className="text-zinc-400">Windows Startup Shortcut:</span>{' '}
                        <span className="text-zinc-500">Run <code className="bg-zinc-905 p-0.5 rounded">shell:startup</code>, create shortcut linking to <code className="text-zinc-400 font-mono">http://localhost:3000</code></span>
                      </div>
                      <div>
                        <span className="text-zinc-400">macOS Login Items:</span>{' '}
                        <span className="text-zinc-500">Drag browser link into General &gt; Login Items</span>
                      </div>
                    </div>
                  </div>

                </div>

              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Styled toast overlay */}
      <AnimatePresence>
        {showToast.show && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className={`fixed top-16 right-4 z-50 px-3.5 py-2.5 rounded-lg border text-xs font-semibold flex items-center gap-2 shadow-2xl ${
              showToast.type === 'success' ? 'bg-[#10B981]/10 text-white border-[#10B981]/30 shadow-[#10B981]/5' :
              showToast.type === 'error' ? 'bg-red-950/20 text-red-300 border-red-900/30' :
              'bg-[#121214] text-[#D4D4D8] border-[#27272A]'
            }`}
          >
            {showToast.type === 'success' && <Check className="h-3 w-3 text-[#10B981]" />}
            {showToast.type === 'error' && <AlertCircle className="h-3.5 w-3.5 text-red-400" />}
            <span>{showToast.msg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MAIN CONTAINER WORKSPACE */}
      <div className="flex-1 flex max-w-[1600px] w-full mx-auto relative overflow-hidden" id="primary-bento-layout">
        
        {/* Dynamic sliding Library drawer (List/Library Pane) */}
        <AnimatePresence>
          {showLibrary && (
            <motion.aside 
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 330, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ type: 'spring', duration: 0.35 }}
              className="border-r border-[#1C1C1F] bg-[#0C0C0E] shrink-0 h-full flex flex-col overflow-hidden z-20 absolute lg:relative"
              id="library-panel-slider"
            >
              {/* Library search/header segment */}
              <div className="p-4 border-b border-[#1C1C1F] space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-[10px] font-bold text-[#71717A] tracking-wider uppercase">Saved Documents</h2>
                  <span className="font-mono text-[9px] px-1.5 py-0.5 rounded-md bg-[#18181B] border border-[#27272A] text-zinc-500">
                    {notes.length} notes
                  </span>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#52525B]" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search titles & transcripts..."
                    className="w-full bg-[#121214] border border-[#1C1C1F] text-xs py-2 pl-9 pr-3 rounded-lg placeholder-zinc-600 text-white focus:outline-hidden focus:ring-1 focus:ring-[#10B981] focus:border-[#10B981] transition-all"
                  />
                </div>
              </div>

              {/* Items scroll catalog list */}
              <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5">
                {filteredNotes.length === 0 ? (
                  <div className="text-center py-16 text-[#52525B]" id="blank-library-state">
                    <FileText className="h-7 w-7 mx-auto text-zinc-800 mb-2 stroke-1.25" />
                    <p className="text-xs font-semibold">No notes found</p>
                    <p className="text-[10px] mt-0.5">Start dictating to create files.</p>
                  </div>
                ) : (
                  filteredNotes.map((note) => {
                    const isSelected = selectedNote?.filename === note.filename;
                    const wordCount = note.content ? note.content.trim().split(/\s+/).length : 0;
                    return (
                      <div
                        key={note.filename}
                        onClick={() => selectNote(note)}
                        className={`p-3 rounded-lg cursor-pointer transition-all border ${
                          isSelected 
                            ? 'bg-[#18181B] border-[#10B981]/50 shadow-md' 
                            : 'bg-transparent border-transparent hover:bg-[#121214] hover:border-[#1C1C1F]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-1.5">
                          <h3 className={`text-xs font-bold truncate ${isSelected ? 'text-[#10B981]' : 'text-zinc-300'}`}>
                            {note.title}
                          </h3>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteNoteFromServer(note.filename);
                            }}
                            className="text-zinc-600 hover:text-red-400 p-0.5 rounded opacity-0 group-hover:opacity-100 lg:group-hover:opacity-100 hover:bg-zinc-800 focus:opacity-100"
                            title="Delete permanently"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                        
                        <p className="text-[10px] text-zinc-500 line-clamp-2 mt-1 select-none">
                          {note.content ? note.content.replace(/[#*`\-]/g, '').trim() : "Empty speech document"}
                        </p>

                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#1C1C1F] text-[9px] font-mono text-[#52525B]">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-2.5 w-2.5" />
                            {formatFriendlyDate(note.createdAt)}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[8px] bg-zinc-900 border border-zinc-800 rounded px-1 text-zinc-400">
                              {wordCount} words
                            </span>
                            {note.duration && (
                              <span className="bg-zinc-900 text-zinc-400 px-1 rounded border border-zinc-800 text-[8px] flex items-center gap-0.5">
                                <Clock className="h-2 w-2" />
                                {formatDuration(note.duration)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* User Google sync instruction footlink */}
              <div className="p-3 bg-[#0A0A0B] border-t border-[#1C1C1F] text-[9px] text-[#52525B]">
                <div className="flex items-center gap-1.5">
                  <FolderOpen className="h-3.5 w-3.5 text-zinc-600" />
                  <span>Synced Google Folder: <em>EchoScribe Notes</em></span>
                </div>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Dynamic visual Workspace stage */}
        <section className="flex-1 flex flex-col min-w-0" id="primary-reading-recording-stage">
          
          {/* TOP HALF: Dictation and Tape recorder section */}
          <div className="p-6 border-b border-[#1C1C1F] bg-[#09090B] flex flex-col items-center justify-center relative overflow-hidden shrink-0" id="tactile-mic-section">
            
            {/* Soft pulsing mic background when active */}
            {isRecording && (
              <div className="absolute inset-0 bg-radial-gradient from-[#10B981]/5 to-transparent pointer-events-none animate-pulse" />
            )}

            <div className="w-full max-w-xl mx-auto flex flex-col items-center text-center space-y-4">
              
              {/* Pulsing Audio waveform visualizer */}
              {isRecording && (
                <div className="flex items-end gap-0.5 h-10 px-4 mt-2 justify-center" id="voice-amplitude-pulses">
                  {audioWaveform.map((amp, idx) => (
                    <motion.div
                      key={idx}
                      animate={{ height: amp }}
                      className="w-1 bg-[#10B981] rounded-t-xs shadow-[0_0_6px_rgba(16,185,129,0.3)]"
                      style={{ minHeight: '3px' }}
                    />
                  ))}
                </div>
              )}

              {/* Large central Tactile mic circles */}
              <div className="relative">
                {isRecording && (
                  <span className="absolute -inset-4 rounded-full bg-[#10B981]/10 animate-ping duration-1000" />
                )}
                
                <button
                  onClick={startRecordingAction}
                  disabled={isTranscribingAudio}
                  className={`h-20 w-20 rounded-full flex items-center justify-center text-white transition-all duration-300 transform hover:scale-105 active:scale-95 cursor-pointer shadow-xl relative ${
                    isRecording 
                      ? 'bg-red-600 ring-4 ring-red-950/20 shadow-[0_0_20px_rgba(239,68,68,0.4)]' 
                      : isTranscribingAudio
                        ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700'
                        : 'bg-[#10B981] hover:brightness-110 shadow-[0_0_20px_rgba(16,185,129,0.2)] text-black font-semibold'
                  }`}
                  id="central-mic-trigger"
                  title={isRecording ? "Stop voice recording" : "Hold or click to dictate note"}
                >
                  {isTranscribingAudio ? (
                    <RefreshCw className="h-7 w-7 animate-spin text-white" />
                  ) : isRecording ? (
                    <MicOff className="h-7 w-7 text-white animate-pulse" />
                  ) : (
                    <Mic className="h-7 w-7 text-black" />
                  )}
                </button>
              </div>

              <div>
                <h2 className="text-sm font-semibold text-white tracking-wide">
                  {isRecording 
                    ? `Recording transcription (${recordingSeconds}s)...` 
                    : isTranscribingAudio 
                      ? 'Decoding speech memo...'
                      : 'Hold or click to record mic'}
                </h2>
                <p className="text-[10px] text-zinc-500 mt-0.5 max-w-xs mx-auto">
                  {isRecording 
                    ? 'Speak cleanly. When done record stops, we ask for note title.' 
                    : 'Your voice is converted straight to clean markdown documents.'}
                </p>
              </div>

              {/* Mode Settings selector panel */}
              <div className="flex items-center gap-1.5" id="dictation-mode-toggle">
                <button
                  type="button"
                  disabled={isRecording}
                  onClick={() => setRecordingMode('realtime')}
                  className={`px-3 py-1 rounded text-[9px] uppercase font-bold tracking-wider transition-all border ${
                    recordingMode === 'realtime' 
                      ? 'bg-zinc-900 border-[#10B981]/50 text-[#10B981]' 
                      : 'bg-transparent border-zinc-800 text-zinc-500 hover:text-[#999]'
                  }`}
                >
                  🎧 Continuous Realtime
                </button>
                <button
                  type="button"
                  disabled={isRecording}
                  onClick={() => setRecordingMode('ai')}
                  className={`px-3 py-1 rounded text-[9px] uppercase font-bold tracking-wider transition-all border ${
                    recordingMode === 'ai' 
                      ? 'bg-zinc-900 border-[#10B981]/50 text-[#10B981]' 
                      : 'bg-transparent border-zinc-800 text-zinc-500 hover:text-[#999]'
                  }`}
                >
                  ✨ Multimodal AI (High fidelity)
                </button>
              </div>

              {/* Speaking interim transcript block */}
              {interimTranscript && (
                <div className="bg-zinc-900/50 p-2 text-[11px] border border-dashed border-zinc-850 text-emerald-400 italic rounded-lg w-max shrink-0 shadow-xs max-w-xl truncate">
                  &ldquo;{interimTranscript}&rdquo;
                </div>
              )}
            </div>
          </div>

          {/* LOWER HALF: Note Workspace Stage View / Edit pane */}
          <div className="flex-1 flex flex-col min-h-0 bg-[#09090B]">
            {selectedNote ? (
              <div className="flex-1 flex flex-col min-h-0" id="selected-workspace-holder">
                
                {/* Save details header bar */}
                <div className="px-6 py-3.5 border-b border-[#1C1C1F] flex items-center justify-between gap-4 bg-zinc-950/20" id="note-heading-dock">
                  <div className="flex-1 min-w-0">
                    <input
                      type="text"
                      value={noteTitle}
                      onChange={(e) => setNoteTitle(e.target.value)}
                      placeholder="Title of note..."
                      className="w-full text-sm font-bold text-white bg-transparent border-b border-transparent hover:border-zinc-800 focus:border-[#10B981] focus:outline-hidden py-0.5 text-ellipsis overflow-hidden caret-[#10B981]"
                    />
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    {/* Render visual preview vs editor selector toggles */}
                    <div className="bg-zinc-900 border border-zinc-805 p-0.5 rounded-lg flex items-center shrink-0">
                      <button
                        onClick={() => setIsEditorMode(false)}
                        className={`px-3 py-1 rounded text-[10px] font-semibold transition-all ${
                          !isEditorMode 
                            ? 'bg-[#18181B] text-[#10B981] shadow-xs' 
                            : 'text-zinc-500 hover:text-zinc-300'
                        }`}
                      >
                        <BookOpen className="h-3 w-3 inline mr-1" />
                        Read
                      </button>
                      <button
                        onClick={() => setIsEditorMode(true)}
                        className={`px-3 py-1 rounded text-[10px] font-semibold transition-all ${
                          isEditorMode 
                            ? 'bg-[#18181B] text-[#10B981] shadow-xs' 
                            : 'text-zinc-500 hover:text-zinc-300'
                        }`}
                      >
                        <Edit className="h-3 w-3 inline mr-1" />
                        Edit Markdown
                      </button>
                    </div>

                    <div className="h-4 w-[1px] bg-zinc-800" />

                    {/* Sync changes */}
                    <button
                      onClick={() => saveNoteToServer()}
                      disabled={isSaving}
                      className="bg-[#10B981] hover:brightness-110 text-neutral-900 font-bold text-[11px] px-3.5 py-1.5 rounded-lg shadow-sm transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50 shrink-0"
                    >
                      {isSaving ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                      <span>Sync</span>
                    </button>
                  </div>
                </div>

                {/* Gemini and Free rules refinement tool dock */}
                <div className="bg-[#121214] border-b border-[#1C1C1F] py-2.5 px-6 flex flex-wrap items-center gap-2" id="format-refinement-row">
                  <span className="text-[9px] uppercase font-bold tracking-wider text-[#10B981] font-mono flex items-center gap-1 shrink-0 mr-1.5 animate-pulse">
                    <Sparkles className="h-3 w-3" />
                    Clean & Format:
                  </span>
                  
                  <button
                    type="button"
                    disabled={isRefining || !noteText}
                    onClick={() => applyAIRefinement('raw')}
                    className="px-2.5 py-1 rounded bg-zinc-900 hover:bg-zinc-850 hover:border-[#10B981]/30 text-[10px] text-zinc-300 border border-zinc-800 transition-all cursor-pointer disabled:opacity-30"
                    title="Removes um/ah filler words, stutters, and fixes punctuation instantly"
                  >
                    🧹 Polish Punctuation (Free/Offline)
                  </button>

                  <button
                    type="button"
                    disabled={isRefining || !noteText}
                    onClick={() => applyAIRefinement('bullet_points')}
                    className="px-2.5 py-1 rounded bg-zinc-900 hover:bg-zinc-850 hover:border-[#10B981]/30 text-[10px] text-zinc-300 border border-zinc-800 transition-all cursor-pointer disabled:opacity-30"
                    title="Ask Gemini to sort spoken notes into clean lists"
                  >
                    📝 Bullet Points (Gemini)
                  </button>

                  <button
                    type="button"
                    disabled={isRefining || !noteText}
                    onClick={() => applyAIRefinement('checklist')}
                    className="px-2.5 py-1 rounded bg-zinc-900 hover:bg-zinc-850 hover:border-[#10B981]/30 text-[10px] text-zinc-300 border border-zinc-800 transition-all cursor-pointer disabled:opacity-30"
                    title="Build checklist todo spreadsheet squares"
                  >
                    ✅ checklist (Gemini)
                  </button>

                  <button
                    type="button"
                    disabled={isRefining || !noteText}
                    onClick={() => applyAIRefinement('meeting_minutes')}
                    className="px-2.5 py-1 rounded bg-zinc-900 hover:bg-zinc-850 hover:border-[#10B981]/30 text-[10px] text-zinc-300 border border-zinc-800 transition-all cursor-pointer disabled:opacity-30"
                    title="Draft agenda and tasks ownership"
                  >
                    💼 Minutes (Gemini)
                  </button>

                  {isRefining && (
                    <div className="flex items-center gap-1 ml-auto text-[10px] text-[#10B981] font-mono font-medium">
                      <RefreshCw className="h-2.5 w-2.5 animate-spin mr-1" />
                      <span>Formulating...</span>
                    </div>
                  )}
                </div>

                {/* Editor or view content page sheet */}
                <div className="flex-1 p-6 md:p-8 overflow-y-auto min-h-[220px] flex flex-col bg-[#09090B]" id="main-textsheet-canvas">
                  {!isEditorMode ? (
                    <div className="flex-1 flex flex-col justify-between" id="visual-render-pane">
                      <div className="prose max-w-none text-[#D4D4D8] break-words flex-1 select-text">
                        {noteText.trim() ? (
                          renderedContent
                        ) : (
                          <div className="h-full flex flex-col items-center justify-center py-16 text-zinc-650 text-center">
                            <FileText className="h-10 w-10 text-zinc-800 mb-3 stroke-1.25" />
                            <h3 className="text-zinc-500 font-bold text-xs uppercase tracking-wide">Blank Note Sheet</h3>
                            <p className="text-[11px] max-w-xs mt-1 text-zinc-600 leading-relaxed">
                              Speak using the central capsule, or type formatted markdown in the &quot;Edit Markdown&quot; terminal pane.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <textarea
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      placeholder="Start drafting notes or speak clearly with the central audio trigger..."
                      className="w-full flex-1 bg-[#121214] border border-[#1C1C1F] p-5 rounded-xl text-neutral-200 font-mono text-xs focus:outline-hidden focus:ring-1 focus:ring-[#10B981] focus:border-[#10B981] leading-relaxed outline-hidden resize-none select-all caret-[#10B981]"
                      id="active-text-sheet-box"
                    />
                  )}
                </div>

                {/* Foot indicators bar */}
                <div className="border-t border-[#1C1C1F] px-6 py-3 bg-zinc-950/20 text-[10px] text-zinc-500 flex items-center justify-between" id="note-actions-footbar">
                   <div className="font-mono flex items-center gap-2">
                     <span>{noteText ? `${noteText.trim().split(/\s+/).length} words` : '0 words'}</span>
                     <span className="text-zinc-700">|</span>
                     <span>Type: {selectedNote.transcriptionType === 'ai' ? 'Multimodal' : 'SpeechAPI'}</span>
                   </div>

                   <div className="flex items-center gap-1.5">
                     <button
                       onClick={copyRawContent}
                       className="p-1 px-2.5 rounded font-bold text-[#A1A1AA] hover:text-white text-[10px] hover:bg-zinc-900 transition-colors flex items-center gap-1 cursor-pointer"
                       title="Copy markdown text"
                     >
                       <Copy className="h-3.5 w-3.5 text-[#10B981]" />
                       <span>Copy</span>
                     </button>
                     <button
                       onClick={downloadMarkdownFileLocal}
                       className="p-1 px-2.5 rounded font-bold text-[#A1A1AA] hover:text-white text-[10px] hover:bg-zinc-900 transition-colors flex items-center gap-1 cursor-pointer"
                       title="Download as physical backup note"
                     >
                       <Download className="h-3.5 w-3.5 text-[#10B981]" />
                       <span>Download</span>
                     </button>
                   </div>
                </div>

              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-zinc-600" id="blank-editor-main-state">
                <div className="bg-[#121214] border border-[#1C1C1F] p-4 rounded-full mb-3 shrink-0">
                  <Mic className="h-8 w-8 text-[#10B981]/50 shadow-md" />
                </div>
                <h3 className="text-zinc-400 font-bold text-xs uppercase tracking-widest">No Active Note Selected</h3>
                <p className="text-[11px] max-w-sm mt-1 mb-4 leading-relaxed text-zinc-600">
                  Select a document from your sliding library, or hit the central record button to capture fresh transcripts.
                </p>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => {
                        setNoteTitle(`Voice Note - ${new Date().toLocaleDateString()}`);
                        setNoteText('');
                        setSelectedNote({
                          filename: `note_${Date.now()}.md`,
                          title: `Local Drafting Sheet`,
                          content: '',
                          createdAt: new Date().toISOString(),
                          transcriptionType: 'realtime'
                        });
                        setIsEditorMode(true);
                    }}
                    className="flex items-center gap-1 py-1.5 px-3.5 bg-zinc-900 hover:bg-zinc-850 hover:text-white border border-zinc-800 transition-all rounded-lg text-xs font-semibold text-zinc-400 cursor-pointer"
                  >
                    <Plus className="h-3 w-3 text-[#10B981]" />
                    <span>Open Empty Draft</span>
                  </button>
                </div>
              </div>
            )}
          </div>

        </section>

      </div>

      {/* --- POST-RECORDING NAME MODAL DIALOG --- */}
      <AnimatePresence>
        {showTitleModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs select-all">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#121214] border border-[#27272A] w-full max-w-md p-6 rounded-2xl shadow-2xl space-y-4"
              id="title-prompt-dialog"
            >
              <div className="flex items-center gap-2 text-[#10B981]">
                <Award className="h-5 w-5 animate-bounce" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-white">Name Your Dictation</h2>
              </div>
              <p className="text-[11px] text-zinc-500 leading-normal">
                Give your transcription an identifying title. It will be saved as a local document and instantly synced to your Google Drive folder and Spreadsheet index!
              </p>

              <div className="space-y-1.5 pt-1">
                <label className="text-[10px] uppercase font-bold text-zinc-500 font-mono">Suggested Title</label>
                <input
                  type="text"
                  value={suggestedTitle}
                  onChange={(e) => setSuggestedTitle(e.target.value)}
                  placeholder="e.g. Project brainstorm note"
                  className="w-full bg-[#09090B] border border-[#27272A] text-white text-xs px-3.5 py-2.5 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-[#10B981] focus:border-[#10B981]"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSubmitTitleModal(suggestedTitle);
                    }
                  }}
                />
              </div>

              {/* Brief sneak peak of text */}
              <div className="bg-[#09090B] p-3 rounded-lg max-h-[100px] overflow-y-auto text-[10px] border border-zinc-900 font-mono text-zinc-500 select-none">
                <strong className="text-zinc-650 block text-[9px] uppercase tracking-wide mb-1">Transcript Preview</strong>
                &ldquo;{tempNoteText.slice(0, 300)}{tempNoteText.length > 300 ? '...' : ''}&rdquo;
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    // Save as untitled anyway
                    handleSubmitTitleModal(suggestedTitle || `Voice Note - ${new Date().toLocaleDateString()}`);
                  }}
                  className="flex-1 bg-[#10B981] hover:brightness-110 text-neutral-900 font-bold text-xs py-2.5 rounded-lg transition-all cursor-pointer text-center"
                >
                  Save & Sync File
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowTitleModal(false);
                    setTempNoteText('');
                  }}
                  className="px-4 py-2.5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 hover:text-white rounded-lg text-xs text-zinc-400 font-semibold cursor-pointer"
                >
                  Discard
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
