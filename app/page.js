"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabaseBrowser } from "../lib/supabase-browser.js";

const STORAGE_KEY = "sheet-music-state-v3";
const THEME_KEY = "sheet-music-theme-v3";

const DEFAULT_STATE = {
  scores: [],
  setlists: [],
  selectedScoreId: null,
  selectedSetlistId: null,
  selectedBookmarkId: null,
  selectedAnnotationId: null,
  activeMode: "reader",
  theme: "dark",
  displayMode: "single",
  performanceMode: false,
  halfPageMode: false,
  sortBy: "recent",
  libraryView: "all",
  annotationTool: "pen",
  annotationColor: "amber",
  annotationThickness: "medium"
};

const MODE_OPTIONS = [
  { id: "library", label: "Library", description: "Browse, search, and organize" },
  { id: "reader", label: "Reader", description: "Score-first reading" },
  { id: "annotation", label: "Annotation", description: "Pen, marks, and notes" },
  { id: "setlists", label: "Setlists", description: "Programs and ordering" },
  { id: "performance", label: "Performance", description: "Minimal chrome" }
];

const DISPLAY_OPTIONS = [
  { value: "single", label: "Single page" },
  { value: "two-up", label: "Two-up" },
  { value: "split", label: "Split view" },
  { value: "continuous", label: "Continuous" }
];

const SORT_OPTIONS = [
  { value: "recent", label: "Recent" },
  { value: "title", label: "Title" },
  { value: "composer", label: "Composer" },
  { value: "pages", label: "Pages" }
];

const ANNOTATION_TOOLS = [
  { value: "pen", label: "Pen" },
  { value: "highlighter", label: "Highlighter" },
  { value: "eraser", label: "Eraser" },
  { value: "text", label: "Text" },
  { value: "shape", label: "Shape" },
  { value: "stamp", label: "Stamp" }
];

const ANNOTATION_COLORS = [
  { value: "amber", label: "Amber" },
  { value: "blue", label: "Blue" },
  { value: "green", label: "Green" },
  { value: "rose", label: "Rose" },
  { value: "slate", label: "Slate" }
];

const ANNOTATION_THICKNESSES = [
  { value: "thin", label: "Thin" },
  { value: "medium", label: "Medium" },
  { value: "bold", label: "Bold" }
];

function uid(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function clampPage(value, pages) {
  const next = Number(value) || 1;
  return Math.min(Math.max(next, 1), Math.max(Number(pages) || 1, 1));
}

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

function stemFromFilename(filename) {
  return filename.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
}

function normalizeBookmark(bookmark) {
  const startPage = clampPage(bookmark?.startPage ?? 1, bookmark?.endPage ?? 1);
  const endPage = clampPage(bookmark?.endPage ?? startPage, startPage);

  return {
    id: bookmark?.id ?? uid("bookmark"),
    name: bookmark?.name?.trim() || "Bookmark",
    startPage,
    endPage,
    kind: bookmark?.kind === "item" ? "item" : "page"
  };
}

function normalizeAnnotation(annotation) {
  return {
    id: annotation?.id ?? uid("annotation"),
    tool: annotation?.tool ?? "pen",
    page: clampPage(annotation?.page ?? 1, annotation?.page ?? 1),
    title: annotation?.title?.trim() || "Annotation",
    note: annotation?.note?.trim() || "",
    color: annotation?.color ?? "amber",
    thickness: annotation?.thickness ?? "medium",
    createdAt: annotation?.createdAt ?? new Date().toISOString()
  };
}

function normalizeScore(score) {
  const pages = Math.max(Number(score?.pages) || 1, 1);
  const source = score?.source
    ? score.source
    : score?.pdf?.dataUrl
      ? {
          kind: "pdf",
          name: score.pdf.name ?? `${score?.title ?? "score"}.pdf`,
          dataUrl: score.pdf.dataUrl
        }
      : null;

  return {
    id: score?.id ?? uid("score"),
    title: score?.title?.trim() || "Untitled score",
    composer: score?.composer?.trim() || "",
    pages,
    currentPage: clampPage(score?.currentPage ?? 1, pages),
    tags: Array.isArray(score?.tags) ? score.tags : [],
    notes: score?.notes?.trim?.() ?? score?.notes ?? "",
    createdAt: score?.createdAt ?? new Date().toISOString(),
    favorite: Boolean(score?.favorite),
    source,
    pdf: score?.pdf ?? null,
    audioTracks: Array.isArray(score?.audioTracks) ? score.audioTracks : [],
    bookmarks: Array.isArray(score?.bookmarks) ? score.bookmarks.map(normalizeBookmark) : [],
    annotations: Array.isArray(score?.annotations) ? score.annotations.map(normalizeAnnotation) : [],
    difficulty: score?.difficulty?.trim?.() ?? score?.difficulty ?? "",
    instrumentation: score?.instrumentation?.trim?.() ?? score?.instrumentation ?? ""
  };
}

function normalizeSetlist(setlist) {
  return {
    id: setlist?.id ?? uid("setlist"),
    name: setlist?.name?.trim() || "Setlist",
    notes: setlist?.notes?.trim?.() ?? setlist?.notes ?? "",
    itemIds: Array.isArray(setlist?.itemIds) ? setlist.itemIds : []
  };
}

function normalizeState(next) {
  const scores = Array.isArray(next?.scores) ? next.scores.map(normalizeScore) : [];
  const setlists = Array.isArray(next?.setlists) ? next.setlists.map(normalizeSetlist) : [];
  const selectedScoreId = scores.some((score) => score.id === next?.selectedScoreId)
    ? next.selectedScoreId
    : scores[0]?.id ?? null;
  const selectedSetlistId = setlists.some((setlist) => setlist.id === next?.selectedSetlistId)
    ? next.selectedSetlistId
    : setlists[0]?.id ?? null;
  const selectedScore = scores.find((score) => score.id === selectedScoreId) ?? null;
  const selectedBookmarkId =
    selectedScore?.bookmarks.some((bookmark) => bookmark.id === next?.selectedBookmarkId)
      ? next.selectedBookmarkId
      : null;
  const selectedAnnotationId =
    selectedScore?.annotations.some((annotation) => annotation.id === next?.selectedAnnotationId)
      ? next.selectedAnnotationId
      : null;

  return {
    ...DEFAULT_STATE,
    ...next,
    scores,
    setlists,
    selectedScoreId,
    selectedSetlistId,
    selectedBookmarkId,
    selectedAnnotationId
  };
}

function applyScorePatch(state, scoreId, patch) {
  return {
    ...state,
    scores: state.scores.map((score) => {
      if (score.id !== scoreId) {
        return score;
      }

      return normalizeScore({ ...score, ...patch });
    })
  };
}

function resolveSetlistItem(state, itemId) {
  if (itemId.startsWith("bookmark:")) {
    const bookmarkId = itemId.slice("bookmark:".length);
    for (const score of state.scores) {
      const bookmark = score.bookmarks.find((entry) => entry.id === bookmarkId);
      if (bookmark) {
        return { type: "bookmark", score, bookmark };
      }
    }
    return null;
  }

  const score = state.scores.find((entry) => entry.id === itemId) ?? null;
  return score ? { type: "score", score } : null;
}

export default function HomePage() {
  const [state, setState] = useState(DEFAULT_STATE);
  const [isLoaded, setIsLoaded] = useState(false);
  const [query, setQuery] = useState("");
  const [syncStatus, setSyncStatus] = useState("loading");
  const [session, setSession] = useState(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [authError, setAuthError] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [scoreForm, setScoreForm] = useState({
    title: "",
    composer: "",
    pages: "1",
    tags: "",
    notes: "",
    difficulty: "",
    instrumentation: ""
  });
  const [bookmarkForm, setBookmarkForm] = useState({
    name: "",
    startPage: "1",
    endPage: "1",
    kind: "page"
  });
  const [setlistForm, setSetlistForm] = useState({
    name: "",
    notes: ""
  });
  const [annotationForm, setAnnotationForm] = useState({
    title: "",
    note: "",
    page: "1"
  });

  const pdfImportRef = useRef(null);
  const backupImportRef = useRef(null);
  const audioImportRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setState(normalizeState(parsed?.state ?? parsed));
        if (parsed?.preferences?.theme) {
          setState((current) => ({ ...current, theme: parsed.preferences.theme }));
        }
      } catch {
        // Ignore malformed cache.
      }
    }

    const savedTheme = window.localStorage.getItem(THEME_KEY);
    if (savedTheme === "light" || savedTheme === "dark") {
      setState((current) => ({ ...current, theme: savedTheme }));
    } else {
      setState((current) => ({ ...current, theme: "dark" }));
    }

    async function loadRemoteState() {
      try {
        const response = await fetch("/api/library");
        if (!response.ok) {
          throw new Error(`Remote library request failed: ${response.status}`);
        }

        const payload = await response.json();
        if (!cancelled && payload?.state) {
          setState((current) =>
            normalizeState({
              ...current,
              ...payload.state,
              theme: payload.state.theme ?? current.theme,
              displayMode: payload.state.displayMode ?? current.displayMode,
              performanceMode: payload.state.performanceMode ?? current.performanceMode,
              halfPageMode: payload.state.halfPageMode ?? current.halfPageMode,
              activeMode: payload.state.activeMode ?? current.activeMode,
              sortBy: payload.state.sortBy ?? current.sortBy,
              libraryView: payload.state.libraryView ?? current.libraryView,
              annotationTool: payload.state.annotationTool ?? current.annotationTool,
              annotationColor: payload.state.annotationColor ?? current.annotationColor,
              annotationThickness: payload.state.annotationThickness ?? current.annotationThickness
            })
          );
          setSyncStatus("synced");
        } else if (!cancelled) {
          setSyncStatus("local");
        }
      } catch {
        if (!cancelled) {
          setSyncStatus("offline");
        }
      } finally {
        if (!cancelled) {
          setIsLoaded(true);
        }
      }
    }

    loadRemoteState();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!supabaseBrowser) {
      setSyncStatus("offline");
      return;
    }

    let mounted = true;

    supabaseBrowser.auth.getSession().then(({ data }) => {
      if (mounted) {
        setSession(data.session ?? null);
      }
    });

    const {
      data: { subscription }
    } = supabaseBrowser.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = state.theme;
  }, [state.theme]);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...state
      })
    );
    window.localStorage.setItem(THEME_KEY, state.theme);
  }, [isLoaded, state]);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/library", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            state
          })
        });

        if (!response.ok) {
          throw new Error("Remote save failed");
        }

        setSyncStatus("synced");
      } catch {
        setSyncStatus("offline");
      }
    }, 700);

    return () => window.clearTimeout(timer);
  }, [isLoaded, state]);

  const selectedScore = state.scores.find((score) => score.id === state.selectedScoreId) ?? null;
  const selectedSetlist =
    state.setlists.find((setlist) => setlist.id === state.selectedSetlistId) ?? null;
  const selectedBookmark =
    selectedScore?.bookmarks.find((bookmark) => bookmark.id === state.selectedBookmarkId) ?? null;
  const selectedAnnotation =
    selectedScore?.annotations.find((annotation) => annotation.id === state.selectedAnnotationId) ??
    null;

  const filteredScores = useMemo(() => {
    const value = query.trim().toLowerCase();
    let scores = state.scores;

    if (state.libraryView === "favorites") {
      scores = scores.filter((score) => score.favorite);
    }

    if (value) {
      scores = scores.filter((score) => {
        const haystack = [
          score.title,
          score.composer,
          score.notes,
          score.instrumentation,
          score.difficulty,
          ...(score.tags ?? [])
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(value);
      });
    }

    const sorted = [...scores];
    sorted.sort((a, b) => {
      switch (state.sortBy) {
        case "title":
          return a.title.localeCompare(b.title);
        case "composer":
          return a.composer.localeCompare(b.composer);
        case "pages":
          return a.pages - b.pages;
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

    return sorted;
  }, [query, state.libraryView, state.sortBy, state.scores]);

  function updateScore(scoreId, patch) {
    setState((current) => applyScorePatch(current, scoreId, patch));
  }

  function openScore(scoreId, nextMode = "reader") {
    setState((current) => ({
      ...current,
      selectedScoreId: scoreId,
      selectedBookmarkId: null,
      selectedAnnotationId: null,
      activeMode: nextMode
    }));
  }

  function jumpToPage(scoreId, page) {
    updateScore(scoreId, { currentPage: clampPage(page, selectedScore?.pages ?? 1) });
  }

  function turnPage(direction) {
    if (!selectedScore) {
      return;
    }

    const delta = direction > 0 ? 1 : -1;
    const nextPage = clampPage(selectedScore.currentPage + delta, selectedScore.pages);
    updateScore(selectedScore.id, { currentPage: nextPage });
  }

  function toggleFavorite(scoreId) {
    const score = state.scores.find((entry) => entry.id === scoreId);
    if (!score) {
      return;
    }

    updateScore(scoreId, { favorite: !score.favorite });
  }

  function addScore(event) {
    event.preventDefault();

    const title = scoreForm.title.trim();
    if (!title) {
      return;
    }

    const score = normalizeScore({
      id: uid("score"),
      title,
      composer: scoreForm.composer.trim(),
      pages: Number(scoreForm.pages) || 1,
      tags: scoreForm.tags
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      notes: scoreForm.notes.trim(),
      difficulty: scoreForm.difficulty.trim(),
      instrumentation: scoreForm.instrumentation.trim(),
      createdAt: new Date().toISOString(),
      favorite: false,
      source: null,
      audioTracks: [],
      bookmarks: [],
      annotations: []
    });

    setState((current) => ({
      ...current,
      scores: [score, ...current.scores],
      selectedScoreId: score.id,
      selectedBookmarkId: null,
      selectedAnnotationId: null,
      activeMode: "reader"
    }));

    setScoreForm({
      title: "",
      composer: "",
      pages: "1",
      tags: "",
      notes: "",
      difficulty: "",
      instrumentation: ""
    });
  }

  async function ingestFile(file) {
    const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
    const isImage = file.type.startsWith("image/");
    const isMusicXml = /(\.xml|\.mxl)$/i.test(file.name) || file.type.includes("xml");
    const isAudio = file.type.startsWith("audio/");

    if (isPdf || isImage || isMusicXml) {
      const dataUrl = await readFileAsDataUrl(file);
      if (!dataUrl) {
        return;
      }

      const sourceKind = isPdf ? "pdf" : isImage ? "image" : "musicxml";
      const nextScore = normalizeScore({
        id: uid("score"),
        title: stemFromFilename(file.name),
        composer: "",
        pages: 1,
        tags: [sourceKind === "pdf" ? "PDF" : sourceKind === "image" ? "Image" : "MusicXML"],
        notes: `Imported ${sourceKind.toUpperCase()} file: ${file.name}`,
        createdAt: new Date().toISOString(),
        source: {
          kind: sourceKind,
          name: file.name,
          dataUrl
        },
        audioTracks: [],
        bookmarks: [],
        annotations: []
      });

      setState((current) => ({
        ...current,
        scores: [nextScore, ...current.scores],
        selectedScoreId: nextScore.id,
        selectedBookmarkId: null,
        selectedAnnotationId: null,
        activeMode: "reader"
      }));
      return;
    }

    if (isAudio && selectedScore) {
      const dataUrl = await readFileAsDataUrl(file);
      if (!dataUrl) {
        return;
      }

      const track = {
        id: uid("audio"),
        name: file.name,
        dataUrl
      };

      updateScore(selectedScore.id, {
        audioTracks: [...selectedScore.audioTracks, track]
      });
    }
  }

  function handleFileUpload(event) {
    const files = Array.from(event.target.files ?? []);
    for (const file of files) {
      void ingestFile(file);
    }
    event.target.value = "";
  }

  function handleDrop(event) {
    event.preventDefault();
    for (const file of Array.from(event.dataTransfer.files ?? [])) {
      void ingestFile(file);
    }
  }

  async function sendMagicLink(event) {
    event.preventDefault();
    setAuthError("");
    setAuthMessage("");

    if (!supabaseBrowser) {
      setAuthError("Supabase auth is not configured.");
      return;
    }

    if (!authEmail.trim()) {
      setAuthError("Enter an email address.");
      return;
    }

    setAuthBusy(true);
    const { error } = await supabaseBrowser.auth.signInWithOtp({
      email: authEmail.trim(),
      options: {
        emailRedirectTo: window.location.origin
      }
    });
    setAuthBusy(false);

    if (error) {
      setAuthError(error.message);
      return;
    }

    setAuthMessage("Check your email for the login link.");
  }

  async function signInWithProvider(provider) {
    setAuthError("");
    setAuthMessage("");

    if (!supabaseBrowser) {
      setAuthError("Supabase auth is not configured.");
      return;
    }

    setAuthBusy(true);
    const { error } = await supabaseBrowser.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: window.location.origin
      }
    });
    setAuthBusy(false);

    if (error) {
      setAuthError(error.message);
    }
  }

  async function signOut() {
    if (!supabaseBrowser) {
      return;
    }

    await supabaseBrowser.auth.signOut();
  }

  function createSetlist(event) {
    event.preventDefault();
    const name = setlistForm.name.trim();
    if (!name) {
      return;
    }

    const next = normalizeSetlist({
      id: uid("setlist"),
      name,
      notes: setlistForm.notes.trim(),
      itemIds: []
    });

    setState((current) => ({
      ...current,
      setlists: [next, ...current.setlists],
      selectedSetlistId: next.id,
      activeMode: "setlists"
    }));

    setSetlistForm({
      name: "",
      notes: ""
    });
  }

  function duplicateSetlist(setlistId) {
    const source = state.setlists.find((setlist) => setlist.id === setlistId);
    if (!source) {
      return;
    }

    const duplicate = normalizeSetlist({
      id: uid("setlist"),
      name: `${source.name} copy`,
      notes: source.notes,
      itemIds: [...source.itemIds]
    });

    setState((current) => ({
      ...current,
      setlists: [duplicate, ...current.setlists],
      selectedSetlistId: duplicate.id
    }));
  }

  function removeSetlist(setlistId) {
    setState((current) => {
      const nextSetlists = current.setlists.filter((setlist) => setlist.id !== setlistId);
      return {
        ...current,
        setlists: nextSetlists,
        selectedSetlistId: nextSetlists[0]?.id ?? null
      };
    });
  }

  function addSelectionToSetlist() {
    if (!selectedSetlist) {
      return;
    }

    const entryId = selectedBookmark ? `bookmark:${selectedBookmark.id}` : selectedScore?.id;
    if (!entryId) {
      return;
    }

    setState((current) => ({
      ...current,
      setlists: current.setlists.map((setlist) => {
        if (setlist.id !== selectedSetlist.id || setlist.itemIds.includes(entryId)) {
          return setlist;
        }

        return {
          ...setlist,
          itemIds: [...setlist.itemIds, entryId]
        };
      })
    }));
  }

  function moveSetlistItem(itemId, direction) {
    if (!selectedSetlist) {
      return;
    }

    setState((current) => ({
      ...current,
      setlists: current.setlists.map((setlist) => {
        if (setlist.id !== selectedSetlist.id) {
          return setlist;
        }

        const index = setlist.itemIds.indexOf(itemId);
        const nextIndex = index + direction;
        if (index < 0 || nextIndex < 0 || nextIndex >= setlist.itemIds.length) {
          return setlist;
        }

        const itemIds = [...setlist.itemIds];
        const [moved] = itemIds.splice(index, 1);
        itemIds.splice(nextIndex, 0, moved);
        return {
          ...setlist,
          itemIds
        };
      })
    }));
  }

  function removeSetlistItem(itemId) {
    if (!selectedSetlist) {
      return;
    }

    setState((current) => ({
      ...current,
      setlists: current.setlists.map((setlist) =>
        setlist.id === selectedSetlist.id
          ? {
              ...setlist,
              itemIds: setlist.itemIds.filter((entry) => entry !== itemId)
            }
          : setlist
      )
    }));
  }

  function openSetlistItem(itemId) {
    const resolved = resolveSetlistItem(state, itemId);
    if (!resolved) {
      return;
    }

    if (resolved.type === "bookmark") {
      setState((current) => ({
        ...current,
        selectedScoreId: resolved.score.id,
        selectedBookmarkId: resolved.bookmark.id,
        selectedAnnotationId: null,
        activeMode: "reader"
      }));
      updateScore(resolved.score.id, { currentPage: resolved.bookmark.startPage });
      return;
    }

    setState((current) => ({
      ...current,
      selectedScoreId: resolved.score.id,
      selectedBookmarkId: null,
      selectedAnnotationId: null,
      activeMode: "reader"
    }));
  }

  function startPerformanceFromSetlist(setlistId) {
    const setlist = state.setlists.find((entry) => entry.id === setlistId);
    if (!setlist) {
      return;
    }

    const firstResolved = setlist.itemIds.map((itemId) => resolveSetlistItem(state, itemId)).find(Boolean);
    if (!firstResolved) {
      setState((current) => ({
        ...current,
        selectedSetlistId: setlistId,
        activeMode: "performance",
        performanceMode: true
      }));
      return;
    }

    if (firstResolved.type === "bookmark") {
      setState((current) => ({
        ...current,
        selectedSetlistId: setlistId,
        selectedScoreId: firstResolved.score.id,
        selectedBookmarkId: firstResolved.bookmark.id,
        selectedAnnotationId: null,
        activeMode: "performance",
        performanceMode: true
      }));
      updateScore(firstResolved.score.id, { currentPage: firstResolved.bookmark.startPage });
      return;
    }

    setState((current) => ({
      ...current,
      selectedSetlistId: setlistId,
      selectedScoreId: firstResolved.score.id,
      selectedBookmarkId: null,
      selectedAnnotationId: null,
      activeMode: "performance",
      performanceMode: true
    }));
  }

  function addBookmark(event) {
    event.preventDefault();
    if (!selectedScore || !bookmarkForm.name.trim()) {
      return;
    }

    const bookmark = normalizeBookmark({
      id: uid("bookmark"),
      name: bookmarkForm.name.trim(),
      startPage: Number(bookmarkForm.startPage) || selectedScore.currentPage || 1,
      endPage: Number(bookmarkForm.endPage) || Number(bookmarkForm.startPage) || selectedScore.currentPage || 1,
      kind: bookmarkForm.kind
    });

    updateScore(selectedScore.id, {
      bookmarks: [...selectedScore.bookmarks, bookmark]
    });

    setState((current) => ({
      ...current,
      selectedBookmarkId: bookmark.id
    }));

    setBookmarkForm({
      name: "",
      startPage: String(selectedScore.currentPage || 1),
      endPage: String(selectedScore.currentPage || 1),
      kind: "page"
    });
  }

  function removeBookmark(bookmarkId) {
    if (!selectedScore) {
      return;
    }

    updateScore(selectedScore.id, {
      bookmarks: selectedScore.bookmarks.filter((bookmark) => bookmark.id !== bookmarkId)
    });

    setState((current) => ({
      ...current,
      selectedBookmarkId: current.selectedBookmarkId === bookmarkId ? null : current.selectedBookmarkId
    }));
  }

  function jumpToBookmark(bookmark) {
    if (!selectedScore) {
      return;
    }

    setState((current) => ({
      ...current,
      selectedBookmarkId: bookmark.id,
      selectedAnnotationId: null,
      activeMode: "reader"
    }));
    updateScore(selectedScore.id, { currentPage: bookmark.startPage });
  }

  function addAnnotation(event) {
    event.preventDefault();
    if (!selectedScore) {
      return;
    }

    const annotation = normalizeAnnotation({
      id: uid("annotation"),
      tool: state.annotationTool,
      page: Number(annotationForm.page) || selectedScore.currentPage || 1,
      title: annotationForm.title.trim() || `${state.annotationTool} mark`,
      note: annotationForm.note.trim(),
      color: state.annotationColor,
      thickness: state.annotationThickness
    });

    updateScore(selectedScore.id, {
      annotations: [...selectedScore.annotations, annotation]
    });

    setState((current) => ({
      ...current,
      selectedAnnotationId: annotation.id,
      activeMode: "annotation"
    }));

    setAnnotationForm({
      title: "",
      note: "",
      page: String(selectedScore.currentPage || 1)
    });
  }

  function removeAnnotation(annotationId) {
    if (!selectedScore) {
      return;
    }

    updateScore(selectedScore.id, {
      annotations: selectedScore.annotations.filter((annotation) => annotation.id !== annotationId)
    });

    setState((current) => ({
      ...current,
      selectedAnnotationId: current.selectedAnnotationId === annotationId ? null : current.selectedAnnotationId
    }));
  }

  function toggleMode(mode) {
    setState((current) => ({
      ...current,
      activeMode: mode,
      performanceMode: mode === "performance" ? true : current.performanceMode
    }));
  }

  function exportBackup() {
    downloadJson("sheet-music-backup.json", {
      formatVersion: "v2.0",
      createdAt: new Date().toISOString(),
      product: {
        name: "Sheet Music",
        appVersion: "0.2.0"
      },
      library: {
        scoreCount: state.scores.length,
        setlistCount: state.setlists.length,
        bookmarkCount: state.scores.reduce((total, score) => total + (score.bookmarks?.length ?? 0), 0),
        annotationCount: state.scores.reduce((total, score) => total + (score.annotations?.length ?? 0), 0)
      },
      data: state
    });
  }

  function importBackup(event) {
    const [file] = event.target.files ?? [];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        const incoming = parsed?.data ?? parsed;
        if (incoming?.scores || incoming?.setlists) {
          setState(normalizeState(incoming));
          setSyncStatus("local");
        }
      } catch {
        // Ignore malformed files.
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  }

  function openFileDialog(ref) {
    ref.current?.click();
  }

  function setLibraryView(nextView) {
    setState((current) => ({ ...current, libraryView: nextView }));
  }

  function setSortBy(nextSort) {
    setState((current) => ({ ...current, sortBy: nextSort }));
  }

  function setAnnotationSetting(key, value) {
    setState((current) => ({ ...current, [key]: value }));
  }

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.defaultPrevented) {
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        turnPage(-1);
      }

      if (event.key === "ArrowRight" || event.key === " ") {
        event.preventDefault();
        turnPage(1);
      }

      if (event.key === "Escape" && state.performanceMode) {
        event.preventDefault();
        setState((current) => ({
          ...current,
          performanceMode: false,
          activeMode: "reader"
        }));
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [state.performanceMode, selectedScore, turnPage]);

  const readerBadge = selectedScore?.source?.kind
    ? selectedScore.source.kind.toUpperCase()
    : "LIBRARY";

  const stageClasses = [
    "stage",
    state.displayMode,
    state.halfPageMode ? "half-page" : "",
    state.performanceMode ? "stage--performance" : ""
  ]
    .filter(Boolean)
    .join(" ");

  const shellClasses = ["shell", state.performanceMode ? "shell--performance" : "", `mode-${state.activeMode}`]
    .filter(Boolean)
    .join(" ");

  const scorePageLabel = selectedScore
    ? `Page ${selectedScore.currentPage} of ${selectedScore.pages}`
    : "No score selected";

  return (
    <main className={shellClasses} onDrop={handleDrop} onDragOver={(event) => event.preventDefault()}>
      <header className="masthead">
        <div className="brandBlock">
          <p className="eyebrow">Sheet Music</p>
          <h1>Score-first sheet music built for Surface, rehearsal, and stage.</h1>
          <p className="lede">
            Local-first library, PDF and image import, annotations, setlists, page turns, and
            Supabase sync when you want cloud backup.
          </p>
        </div>

        <div className="statusBlock">
          <div className="statusGrid">
            <div className="metric">
              <span>Scores</span>
              <strong>{state.scores.length}</strong>
            </div>
            <div className="metric">
              <span>Setlists</span>
              <strong>{state.setlists.length}</strong>
            </div>
            <div className="metric">
              <span>Annotations</span>
              <strong>{state.scores.reduce((total, score) => total + (score.annotations?.length ?? 0), 0)}</strong>
            </div>
            <div className="metric">
              <span>Cloud</span>
              <strong>{syncStatus}</strong>
            </div>
          </div>

          <div className="authCard">
            {session?.user ? (
              <>
                <div>
                  <strong>{session.user.email ?? "Signed in"}</strong>
                  <p className="lede">Supabase session active.</p>
                </div>
                <button type="button" onClick={signOut}>
                  Sign out
                </button>
              </>
            ) : (
              <form className="stack" onSubmit={sendMagicLink}>
                <h3>Sign in</h3>
                <input
                  type="email"
                  value={authEmail}
                  onChange={(event) => setAuthEmail(event.target.value)}
                  placeholder="Email address"
                />
                <div className="authButtons">
                  <button type="submit" disabled={authBusy}>
                    Email link
                  </button>
                  <button type="button" onClick={() => void signInWithProvider("google")} disabled={authBusy}>
                    Google
                  </button>
                </div>
                {authMessage ? <p className="successText">{authMessage}</p> : null}
                {authError ? <p className="errorText">{authError}</p> : null}
              </form>
            )}
          </div>
        </div>

        <div className="toolbarBar">
          <div className="modeSwitch" role="tablist" aria-label="Application mode">
            {MODE_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                className={state.activeMode === option.id ? "modePill active" : "modePill"}
                aria-pressed={state.activeMode === option.id}
                onClick={() => toggleMode(option.id)}
              >
                <span>{option.label}</span>
                <small>{option.description}</small>
              </button>
            ))}
          </div>

          <div className="globalActions">
            <label className="toggleInline">
              <input
                type="checkbox"
                checked={state.theme === "dark"}
                onChange={() =>
                  setState((current) => ({
                    ...current,
                    theme: current.theme === "dark" ? "light" : "dark"
                  }))
                }
              />
              Dark mode
            </label>
            <button type="button" onClick={() => openFileDialog(pdfImportRef)}>
              Import PDF / image
            </button>
            <button type="button" onClick={() => openFileDialog(audioImportRef)} disabled={!selectedScore}>
              Attach audio
            </button>
            <button type="button" onClick={exportBackup}>
              Export backup
            </button>
            <button type="button" onClick={() => openFileDialog(backupImportRef)}>
              Import backup
            </button>
          </div>
        </div>
      </header>

      <section className="workspace">
        <aside className="rail rail--library">
          <div className="panelHeader">
            <div>
              <h2>Library</h2>
              <p>Browse scores, filter, and import without leaving the reader context.</p>
            </div>
          </div>

          <div className="stack">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search title, composer, notes, tags"
            />

            <div className="inlineControls">
              <label>
                <span>Sort</span>
                <select value={state.sortBy} onChange={(event) => setSortBy(event.target.value)}>
                  {SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Library view</span>
                <select value={state.libraryView} onChange={(event) => setLibraryView(event.target.value)}>
                  <option value="all">All scores</option>
                  <option value="favorites">Favorites</option>
                </select>
              </label>
            </div>
          </div>

          <div className="libraryShell">
            <ul className="scoreList">
              {filteredScores.map((score) => (
                <li key={score.id}>
                  <div className="scoreCard">
                    <button
                      type="button"
                      className={score.id === selectedScore?.id ? "scoreRow active" : "scoreRow"}
                      onClick={() => openScore(score.id, "reader")}
                    >
                      <span className="scoreTitleRow">
                        <strong>{score.title}</strong>
                        <span aria-hidden="true">{score.favorite ? "★" : "☆"}</span>
                      </span>
                      <small>
                        {score.composer || "Unknown composer"} · {score.pages} pages
                      </small>
                      <small>{score.tags.join(" · ") || "No tags"}</small>
                    </button>
                    <div className="scoreActions">
                      <button type="button" onClick={() => toggleFavorite(score.id)}>
                        {score.favorite ? "Unfavorite" : "Favorite"}
                      </button>
                      <button type="button" onClick={addSelectionToSetlist} disabled={!selectedSetlist || selectedScore?.id !== score.id}>
                        Queue
                      </button>
                      <button
                        type="button"
                        className="scoreDelete"
                        onClick={() =>
                          setState((current) => {
                            const nextScores = current.scores.filter((entry) => entry.id !== score.id);
                            return {
                              ...current,
                              scores: nextScores,
                              selectedScoreId: current.selectedScoreId === score.id ? nextScores[0]?.id ?? null : current.selectedScoreId,
                              selectedBookmarkId: null,
                              selectedAnnotationId: null,
                              setlists: current.setlists.map((setlist) => ({
                                ...setlist,
                                itemIds: setlist.itemIds.filter((itemId) => itemId !== score.id)
                              }))
                            };
                          })
                        }
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            {filteredScores.length === 0 ? (
              <div className="emptyState">
                <div>
                  <h3>No scores yet</h3>
                  <p>Import a PDF or image to start building the library.</p>
                </div>
              </div>
            ) : null}
          </div>

          <details className="drawer" open={state.activeMode === "library"}>
            <summary>Add score</summary>
            <form className="stack" onSubmit={addScore}>
              <input
                value={scoreForm.title}
                onChange={(event) => setScoreForm({ ...scoreForm, title: event.target.value })}
                placeholder="Title"
              />
              <input
                value={scoreForm.composer}
                onChange={(event) => setScoreForm({ ...scoreForm, composer: event.target.value })}
                placeholder="Composer"
              />
              <div className="inlineControls">
                <input
                  value={scoreForm.pages}
                  onChange={(event) => setScoreForm({ ...scoreForm, pages: event.target.value })}
                  type="number"
                  min="1"
                  placeholder="Pages"
                />
                <input
                  value={scoreForm.difficulty}
                  onChange={(event) => setScoreForm({ ...scoreForm, difficulty: event.target.value })}
                  placeholder="Difficulty"
                />
              </div>
              <input
                value={scoreForm.instrumentation}
                onChange={(event) => setScoreForm({ ...scoreForm, instrumentation: event.target.value })}
                placeholder="Instrumentation"
              />
              <input
                value={scoreForm.tags}
                onChange={(event) => setScoreForm({ ...scoreForm, tags: event.target.value })}
                placeholder="Tags, comma separated"
              />
              <textarea
                value={scoreForm.notes}
                onChange={(event) => setScoreForm({ ...scoreForm, notes: event.target.value })}
                placeholder="Notes"
                rows={3}
              />
              <button type="submit">Save score</button>
            </form>
          </details>

          <div className="hiddenInputs">
            <input ref={pdfImportRef} type="file" accept="application/pdf,image/*,.xml,.mxl" onChange={handleFileUpload} />
            <input ref={backupImportRef} type="file" accept="application/json" onChange={importBackup} />
            <input ref={audioImportRef} type="file" accept="audio/*" onChange={handleFileUpload} />
          </div>
        </aside>

        <section className="stagePanel">
          <div className="panelHeader stageHeader">
            <div>
              <p className="eyebrow">{readerBadge}</p>
              <h2>{selectedScore?.title ?? "Select a score"}</h2>
              <p>
                {selectedScore?.composer ?? "No score selected"} {selectedScore ? "· " + scorePageLabel : ""}
              </p>
            </div>
            <div className="stageActions">
              <button type="button" onClick={() => turnPage(-1)} disabled={!selectedScore}>
                Previous
              </button>
              <button type="button" onClick={() => turnPage(1)} disabled={!selectedScore}>
                Next
              </button>
              <button type="button" onClick={() => setState((current) => ({ ...current, performanceMode: true, activeMode: "performance" }))} disabled={!selectedScore}>
                Performance
              </button>
            </div>
          </div>

          {selectedScore ? (
            <>
              <div className={stageClasses}>
                <div className="pageTurnZone left" aria-hidden="true" onClick={() => turnPage(-1)} />
                <div className="pageTurnZone right" aria-hidden="true" onClick={() => turnPage(1)} />

                <div className="documentViewport">
                  {selectedScore.source?.kind === "pdf" && selectedScore.source?.dataUrl ? (
                    <iframe className="pdfFrame" src={selectedScore.source.dataUrl} title={selectedScore.title} />
                  ) : selectedScore.source?.kind === "image" && selectedScore.source?.dataUrl ? (
                    <img className="imageFrame" src={selectedScore.source.dataUrl} alt={selectedScore.title} />
                  ) : selectedScore.source?.kind === "musicxml" ? (
                    <div className="documentEmpty">
                      <span>MusicXML source imported</span>
                      <strong>{selectedScore.source.name}</strong>
                      <p>
                        Metadata and setlist handling are live now. Engraved rendering can be wired into a
                        later pass without changing the library model.
                      </p>
                    </div>
                  ) : (
                    <div className="documentEmpty">
                      <span>Reader workspace</span>
                      <strong>{selectedScore.title}</strong>
                      <p>{selectedScore.notes || "Add a PDF or image to fill this reader surface."}</p>
                    </div>
                  )}
                </div>

                <div className="stageFooter">
                  <div className="pageMeta">
                    <span>{selectedScore.pages} pages</span>
                    <span>{selectedScore.tags.join(" · ") || "No tags"}</span>
                    <span>{selectedScore.currentPage} / {selectedScore.pages}</span>
                  </div>
                  <div className="pageControls">
                    {DISPLAY_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={state.displayMode === option.value ? "chip active" : "chip"}
                        onClick={() => setState((current) => ({ ...current, displayMode: option.value }))}
                      >
                        {option.label}
                      </button>
                    ))}
                    <label className="toggleInline">
                      <input
                        type="checkbox"
                        checked={state.halfPageMode}
                        onChange={() =>
                          setState((current) => ({ ...current, halfPageMode: !current.halfPageMode }))
                        }
                      />
                      Half-page mode
                    </label>
                  </div>
                </div>
              </div>

              <div className="readerMetaGrid">
                <section className="readerCard">
                  <div className="panelHeader">
                    <div>
                      <h3>Bookmarks</h3>
                      <p>Tap a bookmark to jump the reader and stage.</p>
                    </div>
                  </div>
                  <ul className="bookmarkList">
                    {selectedScore.bookmarks.map((bookmark) => (
                      <li key={bookmark.id}>
                        <button
                          type="button"
                          className={bookmark.id === selectedBookmark?.id ? "bookmarkButton active" : "bookmarkButton"}
                          onClick={() => jumpToBookmark(bookmark)}
                        >
                          <strong>{bookmark.name}</strong>
                          <span>
                            {bookmark.kind === "item" ? "Item bookmark" : "Page bookmark"} · Pages {bookmark.startPage}
                            {bookmark.endPage !== bookmark.startPage ? `-${bookmark.endPage}` : ""}
                          </span>
                        </button>
                        <div className="bookmarkActions">
                          <button type="button" onClick={() => removeBookmark(bookmark.id)}>
                            Remove
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <form className="stack" onSubmit={addBookmark}>
                    <input
                      value={bookmarkForm.name}
                      onChange={(event) => setBookmarkForm({ ...bookmarkForm, name: event.target.value })}
                      placeholder="Bookmark name"
                    />
                    <div className="inlineControls">
                      <select
                        value={bookmarkForm.kind}
                        onChange={(event) => setBookmarkForm({ ...bookmarkForm, kind: event.target.value })}
                      >
                        <option value="page">Page bookmark</option>
                        <option value="item">Item bookmark</option>
                      </select>
                      <input
                        value={bookmarkForm.startPage}
                        onChange={(event) => setBookmarkForm({ ...bookmarkForm, startPage: event.target.value })}
                        type="number"
                        min="1"
                        placeholder="Start page"
                      />
                      <input
                        value={bookmarkForm.endPage}
                        onChange={(event) => setBookmarkForm({ ...bookmarkForm, endPage: event.target.value })}
                        type="number"
                        min="1"
                        placeholder="End page"
                      />
                    </div>
                    <button type="submit">Save bookmark</button>
                  </form>
                </section>

                <section className="readerCard">
                  <div className="panelHeader">
                    <div>
                      <h3>Annotations</h3>
                      <p>Persistent note, markup, and layer states for the current score.</p>
                    </div>
                  </div>

                  <div className="annotationPalette">
                    <div className="pillGroup">
                      {ANNOTATION_TOOLS.map((tool) => (
                        <button
                          key={tool.value}
                          type="button"
                          className={state.annotationTool === tool.value ? "chip active" : "chip"}
                          onClick={() => setAnnotationSetting("annotationTool", tool.value)}
                        >
                          {tool.label}
                        </button>
                      ))}
                    </div>
                    <div className="pillGroup">
                      {ANNOTATION_COLORS.map((color) => (
                        <button
                          key={color.value}
                          type="button"
                          className={state.annotationColor === color.value ? "chip active" : "chip"}
                          onClick={() => setAnnotationSetting("annotationColor", color.value)}
                        >
                          {color.label}
                        </button>
                      ))}
                    </div>
                    <div className="pillGroup">
                      {ANNOTATION_THICKNESSES.map((thickness) => (
                        <button
                          key={thickness.value}
                          type="button"
                          className={state.annotationThickness === thickness.value ? "chip active" : "chip"}
                          onClick={() => setAnnotationSetting("annotationThickness", thickness.value)}
                        >
                          {thickness.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <form className="stack" onSubmit={addAnnotation}>
                    <input
                      value={annotationForm.title}
                      onChange={(event) => setAnnotationForm({ ...annotationForm, title: event.target.value })}
                      placeholder="Annotation title"
                    />
                    <div className="inlineControls">
                      <input
                        value={annotationForm.page}
                        onChange={(event) => setAnnotationForm({ ...annotationForm, page: event.target.value })}
                        type="number"
                        min="1"
                        placeholder="Page"
                      />
                      <button type="submit">Add annotation</button>
                    </div>
                    <textarea
                      value={annotationForm.note}
                      onChange={(event) => setAnnotationForm({ ...annotationForm, note: event.target.value })}
                      placeholder="Annotation notes"
                      rows={3}
                    />
                  </form>

                  <ul className="bookmarkList">
                    {selectedScore.annotations.map((annotation) => (
                      <li key={annotation.id}>
                        <button
                          type="button"
                          className={annotation.id === selectedAnnotation?.id ? "bookmarkButton active" : "bookmarkButton"}
                          onClick={() =>
                            setState((current) => ({
                              ...current,
                              selectedAnnotationId: annotation.id,
                              activeMode: "annotation"
                            }))
                          }
                        >
                          <strong>{annotation.title}</strong>
                          <span>
                            {annotation.tool} · Page {annotation.page} · {annotation.color} · {annotation.thickness}
                          </span>
                          {annotation.note ? <span>{annotation.note}</span> : null}
                        </button>
                        <div className="bookmarkActions">
                          <button type="button" onClick={() => removeAnnotation(annotation.id)}>
                            Remove
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              </div>
            </>
          ) : (
            <div className="emptyStage">
              <h3>No score selected</h3>
              <p>Import a PDF, image, or MusicXML file to open the reader surface.</p>
            </div>
          )}
        </section>

        <aside className="rail rail--detail">
          {state.activeMode === "setlists" ? (
            <section className="detailStack">
              <div className="panelHeader">
                <div>
                  <h2>Setlists</h2>
                  <p>Sequence scores, jump to bookmarks, and launch performance mode.</p>
                </div>
              </div>

              <ul className="setlistList">
                {state.setlists.map((setlist) => (
                  <li key={setlist.id}>
                    <div className={setlist.id === selectedSetlist?.id ? "setlistCard active" : "setlistCard"}>
                      <button type="button" className="scoreRow" onClick={() => setState((current) => ({ ...current, selectedSetlistId: setlist.id, activeMode: "setlists" }))}>
                        <strong>{setlist.name}</strong>
                        <small>{setlist.itemIds.length} items</small>
                        {setlist.notes ? <small>{setlist.notes}</small> : null}
                      </button>
                      <div className="scoreActions">
                        <button type="button" onClick={() => startPerformanceFromSetlist(setlist.id)}>
                          Start performance
                        </button>
                        <button type="button" onClick={() => duplicateSetlist(setlist.id)}>
                          Duplicate
                        </button>
                        <button type="button" className="scoreDelete" onClick={() => removeSetlist(setlist.id)}>
                          Remove
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>

              <form className="stack" onSubmit={createSetlist}>
                <h3>New setlist</h3>
                <input
                  value={setlistForm.name}
                  onChange={(event) => setSetlistForm({ ...setlistForm, name: event.target.value })}
                  placeholder="Setlist name"
                />
                <textarea
                  value={setlistForm.notes}
                  onChange={(event) => setSetlistForm({ ...setlistForm, notes: event.target.value })}
                  placeholder="Setlist notes"
                  rows={3}
                />
                <button type="submit">Create setlist</button>
              </form>

              <div className="readerCard">
                <h3>{selectedSetlist?.name ?? "Select a setlist"}</h3>
                <ul className="setlistFlow">
                  {(selectedSetlist?.itemIds ?? []).map((itemId) => {
                    const resolved = resolveSetlistItem(state, itemId);
                    if (!resolved) {
                      return null;
                    }

                    if (resolved.type === "bookmark") {
                      return (
                        <li key={itemId}>
                          <button type="button" className="bookmarkButton" onClick={() => openSetlistItem(itemId)}>
                            <strong>{resolved.bookmark.name}</strong>
                            <span>{resolved.score.title} · bookmark</span>
                          </button>
                          <div className="bookmarkActions">
                            <button type="button" onClick={() => moveSetlistItem(itemId, -1)}>
                              Up
                            </button>
                            <button type="button" onClick={() => moveSetlistItem(itemId, 1)}>
                              Down
                            </button>
                            <button type="button" onClick={() => removeSetlistItem(itemId)}>
                              Remove
                            </button>
                          </div>
                        </li>
                      );
                    }

                    return (
                      <li key={itemId}>
                        <button type="button" className="bookmarkButton" onClick={() => openSetlistItem(itemId)}>
                          <strong>{resolved.score.title}</strong>
                          <span>{resolved.score.composer || "Unknown composer"} · {resolved.score.pages} pages</span>
                        </button>
                        <div className="bookmarkActions">
                          <button type="button" onClick={() => moveSetlistItem(itemId, -1)}>
                            Up
                          </button>
                          <button type="button" onClick={() => moveSetlistItem(itemId, 1)}>
                            Down
                          </button>
                          <button type="button" onClick={() => removeSetlistItem(itemId)}>
                            Remove
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
                {!selectedSetlist?.itemIds?.length ? <p className="mutedText">Add the current score or bookmark from the reader into the active setlist.</p> : null}
                <button type="button" onClick={addSelectionToSetlist} disabled={!selectedSetlist || (!selectedScore && !selectedBookmark)}>
                  Add selected score or bookmark
                </button>
              </div>
            </section>
          ) : (
            <section className="detailStack">
              <div className="panelHeader">
                <div>
                  <h2>Score details</h2>
                  <p>Metadata lives here so the reader stays clean.</p>
                </div>
              </div>

              {selectedScore ? (
                <>
                  <div className="readerCard">
                    <div className="scoreMetaHeader">
                      <div>
                        <strong>{selectedScore.title}</strong>
                        <p>{selectedScore.composer || "Unknown composer"}</p>
                      </div>
                      <button type="button" onClick={() => toggleFavorite(selectedScore.id)}>
                        {selectedScore.favorite ? "Unfavorite" : "Favorite"}
                      </button>
                    </div>
                    <div className="inlineControls">
                      <input
                        value={selectedScore.title}
                        onChange={(event) => updateScore(selectedScore.id, { title: event.target.value })}
                        placeholder="Title"
                      />
                      <input
                        value={selectedScore.composer}
                        onChange={(event) => updateScore(selectedScore.id, { composer: event.target.value })}
                        placeholder="Composer"
                      />
                    </div>
                    <div className="inlineControls">
                      <input
                        type="number"
                        min="1"
                        value={selectedScore.pages}
                        onChange={(event) => updateScore(selectedScore.id, { pages: Number(event.target.value) || 1 })}
                        placeholder="Pages"
                      />
                      <input
                        value={selectedScore.instrumentation}
                        onChange={(event) => updateScore(selectedScore.id, { instrumentation: event.target.value })}
                        placeholder="Instrumentation"
                      />
                    </div>
                    <input
                      value={selectedScore.difficulty}
                      onChange={(event) => updateScore(selectedScore.id, { difficulty: event.target.value })}
                      placeholder="Difficulty"
                    />
                    <input
                      value={selectedScore.tags.join(", ")}
                      onChange={(event) =>
                        updateScore(selectedScore.id, {
                          tags: event.target.value
                            .split(",")
                            .map((item) => item.trim())
                            .filter(Boolean)
                        })
                      }
                      placeholder="Tags, comma separated"
                    />
                    <textarea
                      rows={4}
                      value={selectedScore.notes}
                      onChange={(event) => updateScore(selectedScore.id, { notes: event.target.value })}
                      placeholder="Notes"
                    />
                  </div>

                  <div className="readerCard">
                    <h3>Audio tracks</h3>
                    <ul className="bookmarkList">
                      {(selectedScore.audioTracks ?? []).map((track) => (
                        <li key={track.id}>
                          <strong>{track.name}</strong>
                          <span>Attached audio</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              ) : (
                <div className="emptyStage">
                  <p>Select a score to edit its metadata.</p>
                </div>
              )}

              {state.activeMode === "performance" ? (
                <div className="readerCard performanceDock">
                  <div className="panelHeader">
                    <div>
                      <h3>Performance mode</h3>
                      <p>Minimal chrome with large page-turn targets.</p>
                    </div>
                  </div>
                  <div className="globalActions">
                    <button type="button" onClick={() => setState((current) => ({ ...current, performanceMode: !current.performanceMode }))}>
                      {state.performanceMode ? "Leave performance" : "Enter performance"}
                    </button>
                    <button type="button" onClick={() => setState((current) => ({ ...current, halfPageMode: !current.halfPageMode }))}>
                      Half-page {state.halfPageMode ? "on" : "off"}
                    </button>
                    <button type="button" onClick={() => setState((current) => ({ ...current, displayMode: "single" }))}>
                      Reset layout
                    </button>
                  </div>
                </div>
              ) : null}
            </section>
          )}
        </aside>
      </section>
    </main>
  );
}
