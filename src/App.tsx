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
  Award,
  Play,
  Pause,
  Square,
  List,
  CheckSquare
} from 'lucide-react';
import { Note } from './types.ts';
import { 
  formatFriendlyDate, 
  formatDuration, 
  parseAndStyleMarkdown,
  localPolishGrammar,
  localAIRefine
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
  const [selectedNote, setSelectedNote] = useState<Note | null>(() => ({
    filename: `note_draft_${Date.now()}.md`,
    title: 'Untitled Note',
    content: '',
    createdAt: new Date().toISOString(),
    transcriptionType: 'realtime'
  }));
  const [searchTerm, setSearchTerm] = useState('');
  const [isEditorMode, setIsEditorMode] = useState(true); // Default to live markdown editor mode
  const [showLibrary, setShowLibrary] = useState(false); // Hide library sidebar by default

  // Google OAuth Sync state
  const [user, setUser] = useState<User | null>(null);
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);
  const [driveFolderId, setDriveFolderId] = useState<string | null>(null);
  const [spreadsheetId, setSpreadsheetId] = useState<string | null>(null);
  const [googleSyncing, setGoogleSyncing] = useState(false);

  // Active inputs
  const [noteTitle, setNoteTitle] = useState('Untitled Note');
  const [noteText, setNoteText] = useState('');
  const [currentTranscriptionType, setCurrentTranscriptionType] = useState<'realtime' | 'ai'>('realtime');

  // Post-recording Title Request Modal state
  const [showTitleModal, setShowTitleModal] = useState(false);
  const [tempNoteText, setTempNoteText] = useState('');
  const [tempDuration, setTempDuration] = useState(0);
  const [tempTranscriptionType, setTempTranscriptionType] = useState<'realtime' | 'ai'>('realtime');
  const [suggestedTitle, setSuggestedTitle] = useState('');

  // Recording processes and controls with active synchronization references
  const [isRecording, _setIsRecording] = useState(false);
  const isRecordingRef = useRef(false);
  const setIsRecording = (val: boolean) => {
    _setIsRecording(val);
    isRecordingRef.current = val;
  };

  const [isPaused, _setIsPaused] = useState(false);
  const isPausedRef = useRef(false);
  const setIsPaused = (val: boolean) => {
    _setIsPaused(val);
    isPausedRef.current = val;
  };

  const stopRequestedRef = useRef(false);
  const initialNoteTextRef = useRef('');

  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordingMode, setRecordingMode] = useState<'realtime' | 'ai'>('realtime');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [audioWaveform, setAudioWaveform] = useState<number[]>([]);

  // Hardware and audio routing state/refs
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [micPermissionState, setMicPermissionState] = useState<string>('unknown');

  const activeStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const enumerateAudioDevices = async () => {
    try {
      const devList = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devList.filter(d => d.kind === 'audioinput');
      setDevices(audioInputs);
      if (audioInputs.length > 0) {
        // Find default or use first found device
        const defaultDevice = audioInputs.find(d => d.deviceId === 'default') || audioInputs[0];
        setSelectedDeviceId(prev => prev || defaultDevice.deviceId);
      }
    } catch (err) {
      console.warn("Could not list audio inputs:", err);
    }
  };

  const checkMicPermission = async () => {
    try {
      if (navigator.permissions && navigator.permissions.query) {
        const res = await navigator.permissions.query({ name: 'microphone' as any });
        setMicPermissionState(res.state);
        res.onchange = () => {
          setMicPermissionState(res.state);
        };
      }
    } catch (e) {
      console.warn("Could not query microphone permission state", e);
    }
  };

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
    enumerateAudioDevices();
    checkMicPermission();

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

  // Standalone Desktop Window Heartbeat (holds server process alive while UI is engaged)
  useEffect(() => {
    const sendPulse = () => {
      fetch('/api/heartbeat', { method: 'POST' }).catch(() => {});
    };
    sendPulse();
    const interval = setInterval(sendPulse, 5000);
    return () => clearInterval(interval);
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
          setSelectedNote({
            filename: `note_draft_${Date.now()}.md`,
            title: 'Untitled Note',
            content: '',
            createdAt: new Date().toISOString(),
            transcriptionType: 'realtime'
          });
          setNoteTitle('Untitled Note');
          setNoteText('');
          setIsEditorMode(true);
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

  // --- REFINING STYLES (LOCAL & OFFLINE) ---
  const applyAIRefinement = async (type: 'bullet_points' | 'checklist' | 'meeting_minutes' | 'journal' | 'raw') => {
    if (!noteText.trim()) {
      triggerToast("No content to refine!", "info");
      return;
    }

    setIsRefining(true);
    try {
      const refined = localAIRefine(noteText, type);
      setNoteText(refined);
      triggerToast("Formatted note successfully!", "success");
      if (selectedNote) {
        await saveNoteToServer(refined);
      }
    } catch (err) {
      console.error(err);
      triggerToast("Error formatting note offline", "error");
    } finally {
      setIsRefining(false);
    }
  };

  // Start real-time audio analysis using active microphone levels
  const startAnalyser = (stream: MediaStream) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) {
        simulateWaveformsFallback();
        return;
      }

      const ctx = new AudioCtx();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64; 
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);

      audioContextRef.current = ctx;
      analyserRef.current = analyser;
      dataArrayRef.current = dataArray;

      const drawWaveform = () => {
        if (!isRecordingRef.current) return;
        animationFrameRef.current = requestAnimationFrame(drawWaveform);

        if (analyserRef.current && dataArrayRef.current && !isPausedRef.current) {
          analyserRef.current.getByteFrequencyData(dataArrayRef.current);

          const newWaveform: number[] = [];
          const step = Math.max(1, Math.floor(dataArrayRef.current.length / 18));

          for (let i = 0; i < 18; i++) {
            let sum = 0;
            const startIdx = i * step;
            const endIdx = Math.min(startIdx + step, dataArrayRef.current.length);
            for (let j = startIdx; j < endIdx; j++) {
              sum += dataArrayRef.current[j];
            }
            const avg = sum / (endIdx - startIdx || 1);
            const heightValue = Math.max(6, Math.floor((avg / 255) * 36) + 6);
            newWaveform.push(heightValue);
          }
          setAudioWaveform(newWaveform);
        } else if (isPausedRef.current) {
          setAudioWaveform(Array(18).fill(6));
        }
      };

      drawWaveform();
    } catch (err) {
      console.warn("Could not start visual analyzer, using simulation fallback", err);
      simulateWaveformsFallback();
    }
  };

  const simulateWaveformsFallback = () => {
    waveformIntervalRef.current = setInterval(() => {
      if (!isPausedRef.current) {
        setAudioWaveform(prev => {
          const next = [...prev];
          if (next.length > 18) next.shift();
          while (next.length < 18) next.push(6);
          next.push(Math.floor(Math.random() * 25) + 8);
          return next.slice(-18);
        });
      }
    }, 110);
  };

  const stopAnalyser = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (audioContextRef.current) {
      if (audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
      }
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    dataArrayRef.current = null;
  };

  // --- RECORDING WORKFLOWS & PAUSE CONTROLS ---
  const handlePauseToggle = () => {
    if (!isRecordingRef.current) return;
    if (isPausedRef.current) {
      // Resume
      setIsPaused(false);
      triggerToast("Recording resumed", "success");
      if (recordingMode === 'realtime' && recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch (e) {
          console.error("Failed to restart speech recognition:", e);
        }
      }
    } else {
      // Pause
      setIsPaused(true);
      triggerToast("Recording paused", "info");
      if (recordingMode === 'realtime' && recognitionRef.current) {
        try {
          // Temporarily stop recognition engine (onend won't auto-reset because isPausedRef is true)
          recognitionRef.current.stop();
        } catch (e) {
          console.error("Failed to pause speech recognition:", e);
        }
      }
    }
  };

  const handleStopAction = () => {
    if (!isRecordingRef.current) return;
    stopRequestedRef.current = true;
    stopRecordingAction();
  };

  const startRecordingAction = async () => {
    if (isRecording) {
      handleStopAction();
      return;
    }

    let stream: MediaStream;
    try {
      const constraints = {
        audio: selectedDeviceId ? { deviceId: { exact: selectedDeviceId } } : true
      };
      stream = await navigator.mediaDevices.getUserMedia(constraints);
      activeStreamRef.current = stream;
    } catch (err) {
      console.error(err);
      triggerToast("Microphone denied. Check browser voice permissions.", "error");
      return;
    }

    // Capture the starting text content of our current active note to append onto
    initialNoteTextRef.current = noteText;
    stopRequestedRef.current = false;

    // Set record states
    setRecordingSeconds(0);
    setAudioWaveform(Array(18).fill(8));
    setIsRecording(true);
    setIsPaused(false);
    setInterimTranscript('');

    // Start timer counter
    timerIntervalRef.current = setInterval(() => {
      if (!isPausedRef.current) {
        setRecordingSeconds(prev => prev + 1);
      }
    }, 1000);

    startAnalyser(stream);

    // Refresh devices list so that labelled formats are loaded!
    enumerateAudioDevices();

    if (recordingMode === 'realtime') {
      runBrowserSpeechRecognition();
    } else {
      runMultimodalAudioRecording(stream);
    }
  };

  const stopRecordingAction = () => {
    if (!isRecordingRef.current) return;
    setIsRecording(false);
    setIsPaused(false);

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

    stopAnalyser();
    if (activeStreamRef.current) {
      activeStreamRef.current.getTracks().forEach(t => t.stop());
      activeStreamRef.current = null;
    }

    triggerToast("Recording ended", "info");
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

      // Stream text live directly to active Note Container Drafting sheet!
      const currentDraftText = initialNoteTextRef.current
        ? initialNoteTextRef.current + (initialNoteTextRef.current.endsWith('\n') ? '' : '\n') + recognizedText + (interim ? ' ' + interim : '')
        : recognizedText + (interim ? ' ' + interim : '');

      setNoteText(currentDraftText);
    };

    rec.onerror = (err: any) => {
      console.error("Speech API Error:", err);
      if (err.error !== 'no-speech') {
        console.warn(`Local SpeechRecognition fail (${err.error}). Pivoting to persistent Gemini AI Mode...`);
        triggerToast(`Local browser dictation failed (${err.error}). Auto-switching to Gemini AI Tape Recorder...`, "info");
        
        // Sever handlers to prevent multiple firings
        rec.onend = null;
        rec.onerror = null;
        
        // Pivot state to Gemini AI mode
        setRecordingMode('ai');
        
        // Feed the active mic stream directly to Gemini Audio Tape Recorder
        if (activeStreamRef.current) {
          runMultimodalAudioRecording(activeStreamRef.current);
        } else {
          stopRecordingAction();
        }
      }
    };

    rec.onend = () => {
      setInterimTranscript('');
      
      // Auto-restart of continuous Speech Recognition to keep recording robust and avoid silence ending!
      if (isRecordingRef.current && !isPausedRef.current && !stopRequestedRef.current) {
        try {
          rec.start();
          return;
        } catch (e) {
          console.warn("Speech recognition auto-start error, delaying...", e);
          setTimeout(() => {
            if (isRecordingRef.current && !isPausedRef.current && !stopRequestedRef.current) {
              try { rec.start(); } catch {}
            }
          }, 300);
          return;
        }
      }

      if (stopRequestedRef.current) {
        stopRequestedRef.current = false;
        
        if (recognizedText.trim().length > 0) {
          // Decide whether we prompt for title confirmation modal
          const isNoteUntitled = selectedNote?.title === 'Untitled Note' || selectedNote?.title === 'Drafting Sheet';
          if (isNoteUntitled) {
            const dateStr = new Date().toLocaleDateString();
            setSuggestedTitle(`Realtime Note - ${dateStr}`);
            setTempNoteText(recognizedText.trim());
            setTempDuration(recordingSeconds);
            setTempTranscriptionType('realtime');
            setShowTitleModal(true);
          } else {
            // Save the updated content directly to server!
            saveNoteToServer();
            triggerToast("Dictation synced to active note!", "success");
          }
        } else {
          triggerToast("No vocal transcription captured.", "info");
        }
      }
    };

    recognitionRef.current = rec;
    try {
      rec.start();
    } catch (startErr: any) {
      console.warn("Direct SpeechRecognition activation failed, falling back to Gemini AI Mode:", startErr);
      triggerToast("Local speech engine failed. Auto-switching to Gemini AI Tape Recorder...", "info");
      setRecordingMode('ai');
      if (activeStreamRef.current) {
        runMultimodalAudioRecording(activeStreamRef.current);
      } else {
        stopRecordingAction();
      }
    }
  };

  // Multimodal Gemini WAV snippet capture with stream reuse
  const runMultimodalAudioRecording = async (existingStream?: MediaStream) => {
    try {
      const stream = existingStream || activeStreamRef.current || await navigator.mediaDevices.getUserMedia({
        audio: selectedDeviceId ? { deviceId: { exact: selectedDeviceId } } : true
      });
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
        // Process
        await processMultimodalAudioBlob(audioBlob);
      };

      mediaRecorderRef.current = recorder;
      recorder.start(1000);
      triggerToast("AI tape recorder running...", "success");
    } catch (err) {
      console.error(err);
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
          
          const generatedText = data.transcription || "";
          if (generatedText) {
            const combinedText = noteText 
              ? noteText + "\n\n" + generatedText 
              : generatedText;
            setNoteText(combinedText);

            const isNoteUntitled = selectedNote?.title === 'Untitled Note' || selectedNote?.title === 'Drafting Sheet';
            if (isNoteUntitled) {
              const headerSuggestion = data.title || `AI Note - ${new Date().toLocaleDateString()}`;
              setTempNoteText(generatedText);
              setSuggestedTitle(headerSuggestion);
              setTempDuration(recordingSeconds);
              setTempTranscriptionType('ai');
              setShowTitleModal(true);
              triggerToast("Transcription parsed! Choose a title.", "success");
            } else {
              await saveNoteToServer(combinedText);
              triggerToast("AI transcription appended to active note!", "success");
            }
          }
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
          <div className="h-8 w-8 flex items-center justify-center bg-transparent shrink-0">
            <div className="bg-[#0099FF]/10 text-[#0099FF] p-1.5 rounded-lg flex items-center justify-center">
              <Mic className="h-4.5 w-4.5" />
            </div>
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-widest uppercase flex items-center">
              <span className="text-white"><span className="text-[#0099FF]">ECHO</span>SCRIBE</span>
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
                ? 'bg-[#0099FF]/15 text-[#0099FF]' 
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
            className={`p-2 rounded-lg cursor-pointer transition-all border flex items-center justify-center ${
              showLibrary 
                ? 'bg-[#18181B] border-[#0099FF]/40 text-[#0099FF]' 
                : 'bg-transparent border-[#1C1C1F] text-[#A1A1AA] hover:text-white hover:bg-[#18181B]'
            }`}
            title={`Toggle Library Catalog (${notes.length} notes)`}
          >
            <LibraryIcon className="h-4.5 w-4.5" />
          </button>

          {/* Sync status element */}
          {user ? (
            <div className="flex items-center gap-2 bg-[#18181B] border border-[#27272A] rounded-lg pl-3 pr-2 py-1" id="synced-google-account-pill">
              <Cloud className="h-3.5 w-3.5 text-[#0099FF]" />
              <div className="text-[11px] font-medium text-[#D4D4D8] max-w-[150px] truncate leading-none">
                {user.email}
              </div>
              
              <div className="h-3 w-[1px] bg-[#27272A] mx-1" />

              <button
                onClick={() => syncNotesToGoogleDrive(false)}
                disabled={googleSyncing}
                className="p-1 hover:bg-[#27272A] rounded text-[#0099FF] transition-colors cursor-pointer"
                title="Sync library to Google Folder & update Sheet Index"
              >
                {googleSyncing ? (
                  <RefreshCw className="h-3 w-3 animate-spin text-[#0099FF]" />
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
              className="p-2 bg-white text-black hover:bg-zinc-200 transition-all rounded-lg cursor-pointer disabled:opacity-50 flex items-center justify-center text-center"
              id="google-sign-in-pill"
              title={isConnectingGoogle ? 'Syncing...' : 'Connect to Google'}
            >
              {isConnectingGoogle ? (
                <RefreshCw className="h-4.5 w-4.5 animate-spin" />
              ) : (
                <svg className="h-4.5 w-4.5" viewBox="0 0 48 48">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                </svg>
              )}
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
                  <div className="p-1.5 rounded-md bg-[#0099FF]/15 text-[#0099FF]">
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
                
                {/* COLUMN 1: INTEGRATION SETUP (OBSIDIAN & GOOGLE DRIVE) */}
                <div className="space-y-4 bg-[#121214] p-5 rounded-xl border border-[#1C1C1F] flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-white font-bold text-xs uppercase tracking-wider">
                      <BookOpen className="h-4 w-4 text-[#0099FF]" />
                      Obsidian Vault Integration
                    </div>
                    <p className="leading-relaxed text-[#8E8E93]">
                      Obsidian operates purely on a folder of standard <code className="text-[#0099FF] bg-[#0099FF]/5 px-1 rounded font-mono text-[10px]">.md</code> files. Enter the folder path below to point EchoScribe directly to your Obsidian vault directory.
                    </p>
                    <input
                      type="text"
                      value={inputObsidianPath}
                      onChange={(e) => setInputObsidianPath(e.target.value)}
                      placeholder={window.navigator.platform.toLowerCase().includes('win') ? "C:\\Users\\Account\\MyObsidianVault" : "/Users/account/Obsidian/Vault"}
                      className="w-full bg-[#09090B] border border-[#27272A] text-white text-[11px] font-mono p-2 rounded-lg placeholder-zinc-700 focus:outline-[#0099FF] focus:border-[#0099FF] focus:ring-1 focus:ring-[#0099FF]/20 transition-all text-ellipsis"
                    />
                    <button
                      onClick={() => handleSaveObsidianPath(inputObsidianPath)}
                      className="w-full bg-white hover:bg-zinc-200 text-black py-1.5 rounded-lg text-xs font-bold transition-all transition-colors cursor-pointer text-center"
                    >
                      Mount Local Vault
                    </button>
                    <div className="text-[10px] text-zinc-500 space-y-1">
                      <div className="flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#0099FF]" />
                        <span>Active Target:</span>
                      </div>
                      <div className="bg-[#09090B] p-2 rounded border border-zinc-900 break-all select-all font-mono text-[9px] text-zinc-400">
                        {actualNotesDir || "Default App Folder"}
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-zinc-900/60 pt-3 space-y-2">
                    <div className="flex items-center gap-2 text-white font-bold text-xs uppercase tracking-wider">
                      <Cloud className="h-4 w-4 text-[#0099FF]" />
                      Personal Google Cloud Sync
                    </div>
                    <p className="leading-relaxed text-[#8E8E93]">
                      Each user connects to their **own unique Google Account** securely via Firebase popup. Once authorized, local notes backup-mirror directly into your private Google Drive folder (<code className="text-zinc-400">EchoScribe Notes</code>) and list in Google Sheets (<code className="text-zinc-400">EchoScribe Notes Index</code>). Your credentials remain yours; the app communicates directly from your browser to Google APIS.
                    </p>
                  </div>
                </div>

                {/* COLUMN 2: HOW THE AI REFINEMENT TOOLS WORK */}
                <div className="space-y-3 bg-[#121214] p-5 rounded-xl border border-[#1C1C1F] flex flex-col justify-between">
                  <div className="space-y-3.5">
                    <div className="flex items-center gap-2 text-white font-bold text-xs uppercase tracking-wider">
                      <Sparkles className="h-4 w-4 text-[#0099FF]" />
                      AI Formatting & Refinement Tools
                    </div>
                    <p className="leading-relaxed text-[#8E8E93] pb-1">
                      Our offline high-performance formatting utilities reconstruct raw spoken scripts with zero lag. Here is how they operate:
                    </p>

                    <div className="space-y-3 text-[11px]">
                      <div className="bg-[#09090B] p-2.5 rounded-lg border border-[#1C1C1F]">
                        <span className="font-bold text-white flex items-center gap-1.5 mb-1">
                          🧹 Clean Grammar
                        </span>
                        <p className="text-zinc-400 leading-normal text-[10.5px]">
                          Cleans vocal hesitation ticks (ums, ahs, stutters, repetitions) and fixes syntax punctuation while keeping your actual words intact.
                        </p>
                      </div>

                      <div className="bg-[#09090B] p-2.5 rounded-lg border border-[#1C1C1F]">
                        <span className="font-bold text-white flex items-center gap-1.5 mb-1">
                          📝 Bullet Points
                        </span>
                        <p className="text-zinc-400 leading-normal text-[10.5px]">
                          Synthesizes long narrative blocks, identifies key thematic pillars, and compiles them into neat bullet point lists.
                        </p>
                      </div>

                      <div className="bg-[#09090B] p-2.5 rounded-lg border border-[#1C1C1F]">
                        <span className="font-bold text-white flex items-center gap-1.5 mb-1">
                          ✅ Checklist
                        </span>
                        <p className="text-zinc-400 leading-normal text-[10.5px]">
                          Locates action-oriented statements, todo plans, and chores, converting them into standard interactive markdown checkbox selectors.
                        </p>
                      </div>

                      <div className="bg-[#09090B] p-2.5 rounded-lg border border-[#1C1C1F]">
                        <span className="font-bold text-white flex items-center gap-1.5 mb-1">
                          💼 Minutes
                        </span>
                        <p className="text-zinc-400 leading-normal text-[10.5px]">
                          Compiles speech recordings into a professional executive meeting log, outlining highlights, action points, and future schedules.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* COLUMN 3: RUNNING NATIVELY ON YOUR PC */}
                <div className="space-y-3 bg-[#121214] p-5 rounded-xl border border-[#1C1C1F] flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-white font-bold text-xs uppercase tracking-wider">
                      <Monitor className="h-4 w-4 text-[#0099FF]" />
                      Run Natively on your PC (Offline Server)
                    </div>
                    <p className="leading-relaxed text-[#8E8E93]">
                      Unpack your EchoScribe code folder and run it 100% offline directly on your own machine. Make updates, save locally, or build launcher files:
                    </p>
                  </div>

                  <div className="space-y-2.5 pb-2 text-[11px]">
                    <div className="bg-[#09090B] p-2.5 rounded-lg border border-[#1C1C1F] space-y-1">
                      <div className="font-semibold text-white">
                        1. Export Code & Install
                      </div>
                      <p className="text-zinc-400 text-[10.5px] leading-relaxed">
                        Export ZIP in AI Studio, extract it, and run <code className="text-[#0099FF]">npm install</code> in your terminal.
                      </p>
                    </div>

                    <div className="bg-[#09090B] p-2.5 rounded-lg border border-[#1C1C1F] space-y-1">
                      <div className="font-semibold text-white">
                        2. Create Desktop Icon Launcher
                      </div>
                      <p className="text-zinc-400 text-[10.5px] leading-relaxed">
                        Generate a startup desktop shortcut by running:
                        <code className="block font-mono bg-zinc-950 text-sky-400 p-1 mt-1 border border-zinc-900 rounded text-center">node create-launcher.js</code>
                        We automatically generate an **EchoScribe.bat** (Windows) or **EchoScribe.command** (macOS) double-clickable shortcut file on your Desktop!
                      </p>
                    </div>

                    <div className="bg-[#09090B] p-2.5 rounded-lg border border-[#1C1C1F] space-y-1">
                      <div className="font-semibold text-white flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                        Fixed Launcher Race-conditions
                      </div>
                      <p className="text-zinc-400 text-[10.5px] leading-relaxed">
                        The batch shortcut runs the server first, waits for completely ready hooks, then launches your local browser seamlessly!
                      </p>
                    </div>
                  </div>

                  {/* Auto Boot options */}
                  <div className="border-t border-zinc-900 pt-3 text-[9.5px]">
                    <span className="font-semibold text-white uppercase tracking-wider text-[8.5px] block mb-1">🖥️ Windows Auto-Startup:</span>
                    <p className="text-zinc-500 leading-normal">
                      Press Win+R, type <code className="bg-zinc-950 p-0.5 rounded text-white font-mono text-[9px]">shell:startup</code>, and drag the desktop launcher Bat directly into that folder to boot EchoScribe instantly on PC startup.
                    </p>
                  </div>
                </div>

              </div>

              {/* MICROPHONE ROUTING & HARDWARE DIAGNOSTICS */}
              <div className="bg-[#121214] p-5 rounded-xl border border-[#1C1C1F] space-y-4">
                <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#0099FF] opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-[#0099FF]"></span>
                    </span>
                    <h4 className="font-bold text-white text-[11px] uppercase tracking-wider">Hardware Connection & Microphone Direct Routing</h4>
                  </div>
                  <div className="flex items-center gap-1.5 font-mono text-[9.5px]">
                    <span className="text-zinc-500">System Permission:</span>
                    <span className={`px-2 py-0.5 rounded-full font-semibold uppercase ${
                      micPermissionState === 'granted' ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/30' :
                      micPermissionState === 'denied' ? 'bg-red-950/40 text-red-400 border border-red-900/40' :
                      'bg-[#1c1c1f] text-zinc-400 border border-[#27272a]'
                    }`}>
                      {micPermissionState}
                    </span>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 items-center text-xs">
                  <div className="space-y-1.5">
                    <span className="font-semibold text-zinc-300 block">Select Audio Input Device:</span>
                    <p className="text-[10.5px] text-zinc-500 leading-normal">
                      Force EchoScribe to capture voices from a specific physical audio device instead of the default hardware channel.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {devices.length === 0 ? (
                      <button
                        onClick={enumerateAudioDevices}
                        className="w-full bg-[#09090B] border border-red-950/20 text-red-305 py-2.5 px-4 rounded-lg font-bold text-center hover:bg-red-950/10 cursor-pointer transition-colors text-[11px] text-red-400"
                      >
                        ⚠️ Request System Microphones Access
                      </button>
                    ) : (
                      <div className="w-full relative flex items-center">
                        <select
                          value={selectedDeviceId}
                          onChange={(e) => {
                            setSelectedDeviceId(e.target.value);
                            triggerToast(`Redirected audio output source!`, "success");
                          }}
                          className="w-full bg-[#09090B] border border-[#27272A] text-white text-[11px] py-2.5 pl-3.5 pr-10 rounded-lg focus:outline-[#0099FF] focus:border-[#0099FF]/50 focus:ring-1 focus:ring-[#0099FF]/20 font-medium cursor-pointer"
                        >
                          {devices.map(device => (
                            <option key={device.deviceId} value={device.deviceId} className="bg-[#121214]">
                              {device.label || `Microphone Input Channel`}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={enumerateAudioDevices}
                          className="absolute right-2 p-1.5 hover:bg-[#18181B] rounded text-sky-400 hover:text-[#0099FF] transition-colors cursor-pointer"
                          title="Refresh sound cards"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="text-[10.5px] text-zinc-500 leading-relaxed bg-[#09090B] p-3 rounded-lg border border-zinc-900 border-dashed">
                    <span className="text-zinc-300 font-semibold block mb-1">💡 Microphone Troubleshooting:</span>
                    If EchoScribe isn't recording, make sure your microphone is plugged in, choose it from the dropdown to route it, and unlock browser mic queries in your browser's address-bar privacy pad.
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
              showToast.type === 'success' ? 'bg-[#0099FF]/10 text-white border-[#0099FF]/30 shadow-[#0099FF]/5' :
              showToast.type === 'error' ? 'bg-red-950/20 text-red-300 border-red-900/30' :
              'bg-[#121214] text-[#D4D4D8] border-[#27272A]'
            }`}
          >
            {showToast.type === 'success' && <Check className="h-3 w-3 text-[#0099FF]" />}
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
                    className="w-full bg-[#121214] border border-[#1C1C1F] text-xs py-2 pl-9 pr-3 rounded-lg placeholder-zinc-600 text-white focus:outline-hidden focus:ring-1 focus:ring-[#0099FF] focus:border-[#0099FF] transition-all"
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
                            ? 'bg-[#18181B] border-[#0099FF]/50 shadow-md' 
                            : 'bg-transparent border-transparent hover:bg-[#121214] hover:border-[#1C1C1F]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-1.5">
                          <h3 className={`text-xs font-bold truncate ${isSelected ? 'text-[#0099FF]' : 'text-zinc-300'}`}>
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
              <div className="absolute inset-0 bg-radial-gradient from-[#0099FF]/5 to-transparent pointer-events-none animate-pulse" />
            )}

            <div className="w-full max-w-xl mx-auto flex flex-col items-center text-center space-y-4">
              
              {/* Pulsing Audio waveform visualizer */}
              {isRecording && (
                <div className="flex items-end gap-0.5 h-10 px-4 mt-2 justify-center" id="voice-amplitude-pulses">
                  {audioWaveform.map((amp, idx) => (
                    <motion.div
                      key={idx}
                      animate={{ height: amp }}
                      className="w-1 bg-[#0099FF] rounded-t-xs shadow-[0_0_6px_rgba(0,153,255,0.3)]"
                      style={{ minHeight: '3px' }}
                    />
                  ))}
                </div>
              )}

              {/* Manual Transcription Mode Segmented Switch */}
              {!isRecording && !isTranscribingAudio && (
                <div className="flex bg-[#121214] border border-[#1C1C1F] rounded-full p-0.5" id="engine-mode-pill-toggle">
                  <button
                    onClick={() => {
                      setRecordingMode('realtime');
                      triggerToast("Switched to Real-time Dictation!", "success");
                    }}
                    className={`rounded-full px-3.5 py-1 text-[10px] font-bold tracking-wide transition-all cursor-pointer uppercase ${
                      recordingMode === 'realtime'
                        ? 'bg-[#0099FF] text-black shadow-md'
                        : 'text-zinc-500 hover:text-zinc-200'
                    }`}
                  >
                    ⚡ Real-time
                  </button>
                  <button
                    onClick={() => {
                      setRecordingMode('ai');
                      triggerToast("Switched to Gemini AI high-fidelity transcription!", "success");
                    }}
                    className={`rounded-full px-3.5 py-1 text-[10px] font-bold tracking-wide transition-all cursor-pointer uppercase ${
                      recordingMode === 'ai'
                        ? 'bg-[#0099FF] text-black shadow-md'
                        : 'text-zinc-500 hover:text-zinc-200'
                    }`}
                  >
                    ✨ Gemini AI
                  </button>
                </div>
              )}

              {/* Large central Tactile mic circles */}
              <div className="relative">
                {isRecording && (
                  <span className="absolute -inset-4 rounded-full bg-[#0099FF]/10 animate-ping duration-1000" />
                )}
                
                <button
                  onClick={startRecordingAction}
                  disabled={isTranscribingAudio}
                  className={`h-20 w-20 rounded-full flex items-center justify-center text-white transition-all duration-300 transform hover:scale-105 active:scale-95 cursor-pointer shadow-xl relative ${
                    isRecording 
                      ? 'bg-red-600 ring-4 ring-red-950/20 shadow-[0_0_20px_rgba(239,68,68,0.4)]' 
                      : isTranscribingAudio
                        ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700'
                        : 'bg-[#0099FF] hover:brightness-110 shadow-[0_0_20px_rgba(0,153,255,0.2)] text-black font-semibold'
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
                <h2 className="text-sm font-semibold text-white tracking-wide text-center">
                  {isRecording ? (
                    <span className="flex items-center justify-center gap-1.5">
                      <span className="inline-block h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                      <span>
                        Recording via {recordingMode === 'realtime' ? 'WebSpeech Dictation' : 'Gemini AI Recorder'} ({recordingSeconds}s)...
                      </span>
                    </span>
                  ) : isTranscribingAudio ? (
                    'Decoding speech memo...'
                  ) : (
                    'Hold or click to record mic'
                  )}
                </h2>
                {isRecording && (
                  <p className="text-[10.5px] text-zinc-400 mt-1 max-w-sm mx-auto font-medium">
                    {recordingMode === 'realtime' 
                      ? "⚡ Audio streams live. Standard browser dictionary." 
                      : "✨ Recorded as a high-fidelity memo, then analyzed & structured beautifully by Gemini 3.5-flash."}
                  </p>
                )}
              </div>

              {/* Audio Input Device Selector Capsule */}
              {!isRecording && !isTranscribingAudio && (
                <div className="flex flex-col items-center space-y-1 mt-1">
                  <div className="flex items-center gap-1.5 bg-[#121214] border border-[#1C1C1F] hover:border-[#27272A] rounded-full px-3.5 py-1.5 text-[11px] font-medium text-zinc-400 hover:text-white transition-all shadow-xs">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[9px] text-[#0099FF] uppercase tracking-wide font-mono font-bold mr-1">Mic Source:</span>
                    {devices.length === 0 ? (
                      <button 
                        onClick={enumerateAudioDevices} 
                        className="hover:underline transition-colors cursor-pointer text-zinc-400 font-semibold text-xs"
                      >
                        List Audio Devices
                      </button>
                    ) : (
                      <select
                        value={selectedDeviceId}
                        onChange={(e) => {
                          setSelectedDeviceId(e.target.value);
                          triggerToast("Active microphone stream set!", "success");
                        }}
                        className="bg-transparent text-zinc-300 font-medium outline-hidden border-none text-[11px] cursor-pointer max-w-[180px] truncate"
                      >
                        {devices.map(device => (
                          <option key={device.deviceId} value={device.deviceId} className="bg-[#121214] text-zinc-300">
                            {device.label || `Microphone Input Channel`}
                          </option>
                        ))}
                      </select>
                    )}
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        enumerateAudioDevices();
                      }}
                      className="p-1 hover:bg-[#18181B] rounded text-sky-400 hover:text-[#0099FF] transition-colors cursor-pointer"
                      title="Refresh microphone listing"
                    >
                      <RefreshCw className="h-2.5 w-2.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* Speaking interim transcript block */}
              {interimTranscript && (
                <div className="bg-zinc-900/50 p-2 text-[11px] border border-dashed border-zinc-850 text-sky-450 text-sky-400 italic rounded-lg w-max shrink-0 shadow-xs max-w-xl truncate">
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
                      className="w-full text-sm font-bold text-white bg-transparent border-b border-transparent hover:border-zinc-800 focus:border-[#0099FF] focus:outline-hidden py-0.5 text-ellipsis overflow-hidden caret-[#0099FF]"
                    />
                  </div>
                </div>

                {/* Free offline local refinement tool dock */}
                <div className="bg-[#121214] border-b border-[#1C1C1F] py-2 px-6 flex items-center justify-between gap-4" id="format-refinement-row">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Read & Edit Markdown tabs - icon only with tooltips */}
                    <div className="bg-zinc-900 border border-zinc-800 p-0.5 rounded-lg flex items-center shrink-0 mr-1.5 animate-fade-in">
                      <button
                        onClick={() => setIsEditorMode(false)}
                        className={`p-1.5 rounded transition-all cursor-pointer ${
                          !isEditorMode 
                            ? 'bg-[#18181B] text-[#0099FF]' 
                            : 'text-zinc-500 hover:text-zinc-350'
                        }`}
                        title="Read Note Preview"
                      >
                        <BookOpen className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setIsEditorMode(true)}
                        className={`p-1.5 rounded transition-all cursor-pointer ${
                          isEditorMode 
                            ? 'bg-[#18181B] text-[#0099FF]' 
                            : 'text-zinc-500 hover:text-zinc-350'
                        }`}
                        title="Edit Markdown Content"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                    </div>

                    <button
                      type="button"
                      disabled={isRefining || !noteText}
                      onClick={() => applyAIRefinement('raw')}
                      className="group px-2.5 py-1.5 rounded bg-zinc-900 hover:bg-zinc-850 hover:text-[#0099FF] hover:border-[#0099FF]/30 text-[10px] text-zinc-300 border border-zinc-800 transition-colors cursor-pointer disabled:opacity-30 inline-flex items-center gap-1.5"
                      title="Removes um/ah filler words, stutters, and fixes punctuation instantly"
                    >
                      <Sparkles className="h-4 w-4 text-zinc-400 group-hover:text-[#0099FF] transition-colors" />
                      <span>Clean Grammar</span>
                    </button>

                    <button
                      type="button"
                      disabled={isRefining || !noteText}
                      onClick={() => applyAIRefinement('bullet_points')}
                      className="group px-2.5 py-1.5 rounded bg-zinc-900 hover:bg-zinc-850 hover:text-[#0099FF] hover:border-[#0099FF]/30 text-[10px] text-zinc-300 border border-zinc-800 transition-colors cursor-pointer disabled:opacity-30 inline-flex items-center gap-1.5"
                      title="Instantly group thoughts of raw record into bullet lists"
                    >
                      <List className="h-4 w-4 text-zinc-400 group-hover:text-[#0099FF] transition-colors" />
                      <span>Bullet Points</span>
                    </button>

                    <button
                      type="button"
                      disabled={isRefining || !noteText}
                      onClick={() => applyAIRefinement('checklist')}
                      className="group px-2.5 py-1.5 rounded bg-zinc-900 hover:bg-zinc-850 hover:text-[#0099FF] hover:border-[#0099FF]/30 text-[10px] text-zinc-300 border border-zinc-800 transition-colors cursor-pointer disabled:opacity-30 inline-flex items-center gap-1.5"
                      title="Build checklist todo items"
                    >
                      <CheckSquare className="h-4 w-4 text-zinc-400 group-hover:text-[#0099FF] transition-colors" />
                      <span>Checklist</span>
                    </button>

                    <button
                      type="button"
                      disabled={isRefining || !noteText}
                      onClick={() => applyAIRefinement('meeting_minutes')}
                      className="group px-2.5 py-1.5 rounded bg-zinc-900 hover:bg-zinc-850 hover:text-[#0099FF] hover:border-[#0099FF]/30 text-[10px] text-zinc-300 border border-zinc-800 transition-colors cursor-pointer disabled:opacity-30 inline-flex items-center gap-1.5"
                      title="Draft agenda highlights and task items"
                    >
                      <FileText className="h-4 w-4 text-zinc-400 group-hover:text-[#0099FF] transition-colors" />
                      <span>Minutes</span>
                    </button>

                    {isRefining && (
                      <div className="flex items-center gap-1 ml-2 text-[10px] text-[#0099FF] font-mono font-medium">
                        <RefreshCw className="h-2.5 w-2.5 animate-spin mr-1" />
                        <span>Formulating...</span>
                      </div>
                    )}
                  </div>

                  {/* Consolidate Action Buttons on the Right Side of the formatting row */}
                  {/* Keep only structural, light-weight, text-removed icon buttons with hover tooltips */}
                  <div className="flex items-center gap-1 shrink-0 bg-[#09090B] border border-zinc-800 p-1 rounded-lg">
                    {/* Sync changes */}
                    <button
                      onClick={() => saveNoteToServer()}
                      disabled={isSaving}
                      className="p-1.5 rounded hover:text-[#0099FF] hover:bg-[#121214] transition-all cursor-pointer disabled:opacity-30 text-zinc-400"
                      title="Sync Notes (Save changes to local vault & Google cloud)"
                    >
                      {isSaving ? (
                        <RefreshCw className="h-4 w-4 animate-spin text-[#0099FF]" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                    </button>

                    {/* Copy content */}
                    <button
                      onClick={copyRawContent}
                      disabled={!noteText}
                      className="p-1.5 rounded hover:text-[#0099FF] hover:bg-[#121214] transition-all cursor-pointer disabled:opacity-30 text-zinc-400"
                      title="Copy raw markdown to clipboard"
                    >
                      <Copy className="h-4 w-4" />
                    </button>

                    {/* Download file */}
                    <button
                      onClick={downloadMarkdownFileLocal}
                      disabled={!noteText}
                      className="p-1.5 rounded hover:text-[#0099FF] hover:bg-[#121214] transition-all cursor-pointer disabled:opacity-30 text-zinc-400"
                      title="Download as physical markdown backup"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                  </div>
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
                      className="w-full flex-1 bg-[#121214] border border-[#1C1C1F] p-5 rounded-xl text-neutral-200 font-mono text-xs focus:outline-hidden focus:ring-1 focus:ring-[#0099FF] focus:border-[#0099FF] leading-relaxed outline-hidden resize-none select-all caret-[#0099FF]"
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
                </div>

              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-zinc-600 h-full" id="blank-editor-main-state">
                <button 
                  onClick={() => {
                      setNoteTitle('Untitled Note');
                      setNoteText('');
                      setSelectedNote({
                        filename: `note_draft_${Date.now()}.md`,
                        title: 'Untitled Note',
                        content: '',
                        createdAt: new Date().toISOString(),
                        transcriptionType: 'realtime'
                      });
                      setIsEditorMode(true);
                  }}
                  className="flex items-center gap-2.5 py-3.5 px-6 bg-[#18181B] hover:bg-[#27272A] hover:text-white md:border border-zinc-800 transition-all rounded-xl text-xs font-bold text-zinc-400 cursor-pointer shadow-lg hover:shadow-cyan-500/5 hover:border-cyan-500/20"
                >
                  <Plus className="h-4.5 w-4.5 text-[#0099FF]" />
                  <span>Open Empty Draft</span>
                </button>
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
              <div className="flex items-center gap-2 text-[#0099FF]">
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
                  className="w-full bg-[#09090B] border border-[#27272A] text-white text-xs px-3.5 py-2.5 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-[#0099FF] focus:border-[#0099FF]"
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
                  className="flex-1 bg-[#0099FF] hover:brightness-110 text-neutral-900 font-bold text-xs py-2.5 rounded-lg transition-all cursor-pointer text-center"
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
