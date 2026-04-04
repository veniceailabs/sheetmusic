"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "../lib/supabase-browser.js";

const STORAGE_KEY = "sheet-music-state-v2";
const THEME_KEY = "sheet-music-theme-v2";

const INITIAL_STATE = {
  scores: [
    {
      id: "score-1",
      title: "Clair de Lune",
      composer: "Claude Debussy",
      pages: 5,
      tags: ["Piano", "Impressionist"],
      notes: "Surface pen dynamics test piece.",
      createdAt: "2026-04-03T16:00:00.000Z",
      pdf: null,
      audioTracks: [],
      bookmarks: [
        { id: "bm-1", name: "Intro", startPage: 1, endPage: 1, kind: "page" },
        { id: "bm-2", name: "Coda", startPage: 5, endPage: 5, kind: "item" }
      ]
    }
  ],
  setlists: [
    {
      id: "setlist-1",
      name: "Recital Warmup",
      itemIds: ["score-1"]
    }
  ],
  selectedScoreId: "score-1",
  selectedSetlistId: "setlist-1",
  selectedBookmarkId: null,
  theme: "light",
  displayMode: "single"
};

function uid(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
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

export default function HomePage() {
  const [state, setState] = useState(INITIAL_STATE);
  const [isLoaded, setIsLoaded] = useState(false);
  const [query, setQuery] = useState("");
  const [performanceMode, setPerformanceMode] = useState(false);
  const [halfPageMode, setHalfPageMode] = useState(false);
  const [theme, setTheme] = useState("light");
  const [displayMode, setDisplayMode] = useState("single");
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
    notes: ""
  });
  const [bookmarkForm, setBookmarkForm] = useState({
    name: "",
    startPage: "1",
    endPage: "1",
    kind: "page"
  });
  const [setlistName, setSetlistName] = useState("");

  useEffect(() => {
    let cancelled = false;

    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed?.state) {
          setState(parsed.state);
          if (parsed.preferences?.theme) {
            setTheme(parsed.preferences.theme);
          }
          if (parsed.preferences?.displayMode) {
            setDisplayMode(parsed.preferences.displayMode);
          }
        } else {
          setState(parsed);
          if (parsed?.theme) {
            setTheme(parsed.theme);
          }
          if (parsed?.displayMode) {
            setDisplayMode(parsed.displayMode);
          }
        }
      } catch {
        // Ignore malformed cache.
      }
    }

    const savedTheme = window.localStorage.getItem(THEME_KEY);
    if (savedTheme === "light" || savedTheme === "dark") {
      setTheme(savedTheme);
    }

    async function loadRemoteState() {
      try {
        const response = await fetch("/api/library");
        if (!response.ok) {
          throw new Error(`Remote library request failed: ${response.status}`);
        }

        const payload = await response.json();
        if (!cancelled && payload?.state) {
          setState((current) => ({
            ...current,
            ...payload.state,
            theme: payload.state.theme ?? current.theme,
            displayMode: payload.state.displayMode ?? current.displayMode
          }));
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
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...state,
        theme,
        displayMode
      })
    );
    window.localStorage.setItem(THEME_KEY, theme);
  }, [isLoaded, state, theme, displayMode]);

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
            state: {
              ...state,
              theme,
              displayMode
            }
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
  }, [isLoaded, state, theme, displayMode]);

  const selectedScore = state.scores.find((score) => score.id === state.selectedScoreId) ?? null;
  const selectedSetlist =
    state.setlists.find((setlist) => setlist.id === state.selectedSetlistId) ?? null;
  const selectedBookmark =
    selectedScore?.bookmarks.find((bookmark) => bookmark.id === state.selectedBookmarkId) ?? null;

  const filteredScores = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) {
      return state.scores;
    }

    return state.scores.filter((score) => {
      const haystack = [score.title, score.composer, score.notes, ...(score.tags ?? [])]
        .join(" ")
        .toLowerCase();
      return haystack.includes(value);
    });
  }, [query, state.scores]);

  function addScore(event) {
    event.preventDefault();

    const title = scoreForm.title.trim();
    if (!title) {
      return;
    }

    const score = {
      id: uid("score"),
      title,
      composer: scoreForm.composer.trim(),
      pages: Number(scoreForm.pages) || 1,
      tags: scoreForm.tags
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      notes: scoreForm.notes.trim(),
      createdAt: new Date().toISOString(),
      pdf: null,
      audioTracks: [],
      bookmarks: []
    };

    setState((current) => ({
      ...current,
      scores: [score, ...current.scores],
      selectedScoreId: score.id,
      selectedBookmarkId: null
    }));

    setScoreForm({
      title: "",
      composer: "",
      pages: "1",
      tags: "",
      notes: ""
    });
  }

  async function addImportedFile(file) {
    if (file.type === "application/pdf") {
      const dataUrl = await readFileAsDataUrl(file);
      if (!dataUrl) {
        return;
      }

      const score = {
        id: uid("score"),
        title: file.name.replace(/\.pdf$/i, ""),
        composer: "",
        pages: 1,
        tags: ["PDF"],
        notes: `Uploaded PDF: ${file.name}`,
        createdAt: new Date().toISOString(),
        pdf: {
          name: file.name,
          dataUrl
        },
        audioTracks: [],
        bookmarks: []
      };

      setState((current) => ({
        ...current,
        scores: [score, ...current.scores],
        selectedScoreId: score.id,
        selectedBookmarkId: null
      }));
      return;
    }

    if (file.type.startsWith("audio/") && selectedScore) {
      const dataUrl = await readFileAsDataUrl(file);
      if (!dataUrl) {
        return;
      }

      const track = {
        id: uid("audio"),
        name: file.name,
        dataUrl
      };

      setState((current) => ({
        ...current,
        scores: current.scores.map((score) =>
          score.id === selectedScore.id
            ? { ...score, audioTracks: [...(score.audioTracks ?? []), track] }
            : score
        )
      }));
    }
  }

  function handleFileUpload(event) {
    const files = Array.from(event.target.files ?? []);
    for (const file of files) {
      void addImportedFile(file);
    }
    event.target.value = "";
  }

  function handleDrop(event) {
    event.preventDefault();
    for (const file of Array.from(event.dataTransfer.files ?? [])) {
      void addImportedFile(file);
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

  function addSetlist(event) {
    event.preventDefault();
    const name = setlistName.trim();
    if (!name) {
      return;
    }

    const next = {
      id: uid("setlist"),
      name,
      itemIds: []
    };

    setState((current) => ({
      ...current,
      setlists: [next, ...current.setlists],
      selectedSetlistId: next.id
    }));

    setSetlistName("");
  }

  function addBookmark(event) {
    event.preventDefault();
    if (!selectedScore || !bookmarkForm.name.trim()) {
      return;
    }

    const bookmark = {
      id: uid("bookmark"),
      name: bookmarkForm.name.trim(),
      startPage: Number(bookmarkForm.startPage) || 1,
      endPage: Number(bookmarkForm.endPage) || Number(bookmarkForm.startPage) || 1,
      kind: bookmarkForm.kind
    };

    setState((current) => ({
      ...current,
      scores: current.scores.map((score) =>
        score.id === selectedScore.id
          ? { ...score, bookmarks: [...score.bookmarks, bookmark] }
          : score
      )
    }));

    setBookmarkForm({
      name: "",
      startPage: "1",
      endPage: "1",
      kind: "page"
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

  function removeScore(scoreId) {
    setState((current) => {
      const nextScores = current.scores.filter((score) => score.id !== scoreId);
      const nextSelectedScore = current.selectedScoreId === scoreId ? nextScores[0]?.id ?? null : current.selectedScoreId;

      return {
        ...current,
        scores: nextScores,
        selectedScoreId: nextSelectedScore,
        selectedBookmarkId: null,
        setlists: current.setlists.map((setlist) => ({
          ...setlist,
          itemIds: setlist.itemIds.filter((itemId) => itemId !== scoreId)
        }))
      };
    });
  }

  function exportBackup() {
    downloadJson("sheet-music-backup.json", {
      formatVersion: "v1.0",
      createdAt: new Date().toISOString(),
      product: {
        name: "Sheet Music MVP",
        appVersion: "0.1.0"
      },
      library: {
        scoreCount: state.scores.length,
        setlistCount: state.setlists.length,
        annotationCount: state.scores.reduce((total, score) => total + (score.bookmarks?.length ?? 0), 0)
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
        if (parsed?.data?.scores && parsed?.data?.setlists) {
          setState(parsed.data);
        } else if (parsed?.scores && parsed?.setlists) {
          setState(parsed);
        }
      } catch {
        // Ignore malformed files.
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  }

  return (
    <main className={performanceMode ? "page performance" : "page"} onDrop={handleDrop} onDragOver={(event) => event.preventDefault()}>
      <section className="hero">
        <div>
          <p className="eyebrow">Sheet Music</p>
          <h1>Touch-first sheet music control built for library, rehearsal, and performance.</h1>
          <p className="lede">
            Local-first score management with Supabase sync, PDF and audio upload, setlists, bookmarks, and reader modes.
          </p>
        </div>

        <div className="heroCard">
          <div className="metric">
            <span>Scores</span>
            <strong>{state.scores.length}</strong>
          </div>
          <div className="metric">
            <span>Setlists</span>
            <strong>{state.setlists.length}</strong>
          </div>
          <div className="metric">
            <span>Cloud</span>
            <strong>{syncStatus}</strong>
          </div>
          <div className="authCard">
            {session?.user ? (
              <>
                <div>
                  <strong>{session.user.email ?? "Signed in"}</strong>
                  <p className="lede">Supabase session active.</p>
                </div>
                  <button type="button" onClick={signOut}>Sign out</button>
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
                  <button type="button" onClick={() => signInWithProvider("google")} disabled={authBusy}>
                    Google
                  </button>
                </div>
                {authMessage ? <p className="successText">{authMessage}</p> : null}
                {authError ? <p className="errorText">{authError}</p> : null}
              </form>
            )}
          </div>
          <div className="toggles">
            <label>
              <input
                type="checkbox"
                checked={theme === "dark"}
                onChange={() => setTheme((value) => (value === "dark" ? "light" : "dark"))}
              />
              Dark mode
            </label>
            <label>
              <span>Reader mode</span>
              <select value={displayMode} onChange={(event) => setDisplayMode(event.target.value)}>
                <option value="single">Single page</option>
                <option value="two-up">Two-up</option>
                <option value="split">Split view</option>
                <option value="continuous">Continuous</option>
              </select>
            </label>
            <label>
              <input
                type="checkbox"
                checked={performanceMode}
                onChange={() => setPerformanceMode((value) => !value)}
              />
              Performance mode
            </label>
            <label>
              <input
                type="checkbox"
                checked={halfPageMode}
                onChange={() => setHalfPageMode((value) => !value)}
              />
              Half-page mode
            </label>
          </div>
          <div className="actions">
            <button onClick={exportBackup}>Export backup</button>
            <label className="upload">
              Import backup
              <input type="file" accept="application/json" onChange={importBackup} />
            </label>
            <label className="upload">
              Upload PDF / audio
              <input type="file" accept="application/pdf,audio/*" onChange={handleFileUpload} />
            </label>
          </div>
        </div>
      </section>

      <section className="workspace">
        <aside className="panel">
          <div className="panelHeader">
            <h2>Library</h2>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search title, composer, tags"
            />
          </div>

          <ul className="scoreList">
            {filteredScores.map((score) => (
              <li key={score.id}>
                <div className="scoreItem">
                  <button
                    className={score.id === selectedScore?.id ? "scoreRow active" : "scoreRow"}
                    onClick={() =>
                      setState((current) => ({
                        ...current,
                        selectedScoreId: score.id,
                        selectedBookmarkId: null
                      }))
                    }
                  >
                    <span>{score.title}</span>
                    <small>
                      {score.composer || "Unknown composer"} · {score.pages} pages
                    </small>
                  </button>
                  <button type="button" className="scoreDelete" onClick={() => removeScore(score.id)}>
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <form className="stack" onSubmit={addScore}>
            <h3>Add score</h3>
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
            <input
              value={scoreForm.pages}
              onChange={(event) => setScoreForm({ ...scoreForm, pages: event.target.value })}
              type="number"
              min="1"
              placeholder="Pages"
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
        </aside>

        <section className="panel viewer">
          <div className="panelHeader">
            <div>
              <h2>{selectedScore?.title ?? "Select a score"}</h2>
              <p>{selectedScore?.composer ?? "No score selected"}</p>
            </div>
            <button onClick={addSelectionToSetlist} disabled={!selectedSetlist || (!selectedScore && !selectedBookmark)}>
              Add to setlist
            </button>
          </div>

          {selectedScore ? (
            <>
              <div className={`viewerCanvas ${halfPageMode ? "halfPage" : ""} ${displayMode}`}>
                {selectedScore.pdf?.dataUrl ? (
                  <iframe className="pdfFrame" src={selectedScore.pdf.dataUrl} title={selectedScore.title} />
                ) : (
                  <div className="pagePreview">
                    <span>Score preview</span>
                    <strong>{selectedScore.title}</strong>
                    <p>{selectedScore.notes || "No notes yet."}</p>
                  </div>
                )}
                <div className="pageMeta">
                  <span>{selectedScore.pages} pages</span>
                  <span>{selectedScore.tags.join(" · ") || "No tags"}</span>
                </div>
              </div>

              <div className="bookmarkGrid">
                <div>
                  <h3>Bookmarks</h3>
                  <ul className="bookmarkList">
                    {selectedScore.bookmarks.map((bookmark) => (
                      <li key={bookmark.id}>
                        <button
                          className={bookmark.id === selectedBookmark?.id ? "bookmarkButton active" : "bookmarkButton"}
                          onClick={() =>
                            setState((current) => ({
                              ...current,
                              selectedBookmarkId: bookmark.id
                            }))
                          }
                        >
                          <strong>{bookmark.name}</strong>
                          <span>
                            {bookmark.kind === "item" ? "Item bookmark" : "Page bookmark"} · Pages{" "}
                            {bookmark.startPage}
                            {bookmark.endPage !== bookmark.startPage ? `-${bookmark.endPage}` : ""}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>

                <form className="stack" onSubmit={addBookmark}>
                  <h3>Add bookmark</h3>
                  <input
                    value={bookmarkForm.name}
                    onChange={(event) =>
                      setBookmarkForm({ ...bookmarkForm, name: event.target.value })
                    }
                    placeholder="Bookmark name"
                  />
                  <select
                    value={bookmarkForm.kind}
                    onChange={(event) =>
                      setBookmarkForm({ ...bookmarkForm, kind: event.target.value })
                    }
                  >
                    <option value="page">Page bookmark</option>
                    <option value="item">Item bookmark</option>
                  </select>
                  <input
                    value={bookmarkForm.startPage}
                    onChange={(event) =>
                      setBookmarkForm({ ...bookmarkForm, startPage: event.target.value })
                    }
                    type="number"
                    min="1"
                    placeholder="Start page"
                  />
                  <input
                    value={bookmarkForm.endPage}
                    onChange={(event) =>
                      setBookmarkForm({ ...bookmarkForm, endPage: event.target.value })
                    }
                    type="number"
                    min="1"
                    placeholder="End page"
                  />
                  <button type="submit">Save bookmark</button>
                </form>
              </div>

              <div className="stack">
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
            <div className="emptyState">Choose a score to open the performance workspace.</div>
          )}
        </section>

        <aside className="panel">
          <div className="panelHeader">
            <h2>Setlists</h2>
          </div>

          <ul className="setlistList">
            {state.setlists.map((setlist) => (
              <li key={setlist.id}>
                <button
                  className={setlist.id === selectedSetlist?.id ? "scoreRow active" : "scoreRow"}
                  onClick={() =>
                    setState((current) => ({
                      ...current,
                      selectedSetlistId: setlist.id
                    }))
                  }
                >
                  <span>{setlist.name}</span>
                  <small>{setlist.itemIds.length} items</small>
                </button>
              </li>
            ))}
          </ul>

          <form className="stack" onSubmit={addSetlist}>
            <h3>New setlist</h3>
            <input
              value={setlistName}
              onChange={(event) => setSetlistName(event.target.value)}
              placeholder="Setlist name"
            />
            <button type="submit">Create setlist</button>
          </form>

          <div className="setlistDetails">
            <h3>{selectedSetlist?.name ?? "No setlist selected"}</h3>
            <ul className="bookmarkList">
              {(selectedSetlist?.itemIds ?? []).map((id) => {
                if (id.startsWith("bookmark:")) {
                  const bookmarkId = id.slice("bookmark:".length);
                  const bookmark = state.scores
                    .flatMap((entry) => entry.bookmarks)
                    .find((entry) => entry.id === bookmarkId);

                  if (!bookmark) {
                    return null;
                  }

                  return (
                    <li key={id}>
                      <strong>{bookmark.name}</strong>
                      <span>Item bookmark</span>
                    </li>
                  );
                }

                const score = state.scores.find((entry) => entry.id === id);
                if (!score) {
                  return null;
                }

                return (
                  <li key={id}>
                    <strong>{score.title}</strong>
                    <span>{score.composer || "Unknown composer"}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </aside>
      </section>
    </main>
  );
}
