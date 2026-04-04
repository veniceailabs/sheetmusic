"use client";

import { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "sheet-music-state-v1";
const THEME_KEY = "sheet-music-theme-v1";

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
      bookmarks: [
        { id: "bm-1", name: "Intro", startPage: 1, endPage: 1 },
        { id: "bm-2", name: "Coda", startPage: 5, endPage: 5 }
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
  theme: "light"
};

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function uid(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

export default function HomePage() {
  const [state, setState] = useState(INITIAL_STATE);
  const [isLoaded, setIsLoaded] = useState(false);
  const [query, setQuery] = useState("");
  const [performanceMode, setPerformanceMode] = useState(false);
  const [halfPageMode, setHalfPageMode] = useState(false);
  const [theme, setTheme] = useState("light");
  const [scoreForm, setScoreForm] = useState({
    title: "",
    composer: "",
    pages: "1",
    tags: "",
    notes: ""
  });
  const [setlistName, setSetlistName] = useState("");
  const [bookmarkForm, setBookmarkForm] = useState({
    name: "",
    startPage: "1",
    endPage: "1"
  });

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      setState(parsed);
      if (parsed?.theme) {
        setTheme(parsed.theme);
      }
    }
    const savedTheme = window.localStorage.getItem(THEME_KEY);
    if (savedTheme === "light" || savedTheme === "dark") {
      setTheme(savedTheme);
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, theme }));
  }, [isLoaded, state, theme]);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }
    window.localStorage.setItem(THEME_KEY, theme);
    setState((current) => ({ ...current, theme }));
    document.documentElement.dataset.theme = theme;
  }, [isLoaded, theme]);

  const selectedScore = state.scores.find((score) => score.id === state.selectedScoreId) ?? null;
  const selectedSetlist =
    state.setlists.find((setlist) => setlist.id === state.selectedSetlistId) ?? null;

  const filteredScores = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) {
      return state.scores;
    }

    return state.scores.filter((score) => {
      const haystack = [
        score.title,
        score.composer,
        score.notes,
        ...(score.tags ?? [])
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(value);
    });
  }, [query, state.scores]);

  function addScore(event) {
    event.preventDefault();

    const score = {
      id: uid("score"),
      title: scoreForm.title.trim(),
      composer: scoreForm.composer.trim(),
      pages: Number(scoreForm.pages) || 1,
      tags: scoreForm.tags
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      notes: scoreForm.notes.trim(),
      createdAt: new Date().toISOString(),
      pdf: null,
      bookmarks: []
    };

    if (!score.title) {
      return;
    }

    setState((current) => ({
      ...current,
      scores: [score, ...current.scores],
      selectedScoreId: score.id
    }));

    setScoreForm({
      title: "",
      composer: "",
      pages: "1",
      tags: "",
      notes: ""
    });
  }

  function uploadPdf(event) {
    const [file] = event.target.files ?? [];
    if (!file) {
      return;
    }

    if (file.type !== "application/pdf") {
      event.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : "";
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
        bookmarks: []
      };

      setState((current) => ({
        ...current,
        scores: [score, ...current.scores],
        selectedScoreId: score.id
      }));
    };
    reader.readAsDataURL(file);
    event.target.value = "";
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
      endPage: Number(bookmarkForm.endPage) || Number(bookmarkForm.startPage) || 1
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
      endPage: "1"
    });
  }

  function addSelectedScoreToSetlist() {
    if (!selectedScore || !selectedSetlist) {
      return;
    }

    setState((current) => ({
      ...current,
      setlists: current.setlists.map((setlist) => {
        if (setlist.id !== selectedSetlist.id || setlist.itemIds.includes(selectedScore.id)) {
          return setlist;
        }

        return {
          ...setlist,
          itemIds: [...setlist.itemIds, selectedScore.id]
        };
      })
    }));
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
        annotationCount: state.scores.reduce(
          (total, score) => total + (score.bookmarks?.length ?? 0),
          0
        )
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
        }
      } catch {
        // Ignore malformed files in the MVP.
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  }

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return (
    <main className={performanceMode ? "page performance" : "page"}>
      <section className="hero">
        <div>
          <p className="eyebrow">Sheet Music</p>
          <h1>Touch-first sheet music control built for library, rehearsal, and performance.</h1>
          <p className="lede">
            This MVP implements a local score library, searchable metadata, bookmarks, setlists,
            backup export/import, and a performance workspace with half-page mode.
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
              Upload PDF
              <input type="file" accept="application/pdf" onChange={uploadPdf} />
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
                <button
                  className={score.id === selectedScore?.id ? "scoreRow active" : "scoreRow"}
                  onClick={() =>
                    setState((current) => ({
                      ...current,
                      selectedScoreId: score.id
                    }))
                  }
                >
                  <span>{score.title}</span>
                  <small>
                    {score.composer || "Unknown composer"} · {score.pages} pages
                  </small>
                </button>
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
            <button onClick={addSelectedScoreToSetlist} disabled={!selectedScore || !selectedSetlist}>
              Add to setlist
            </button>
          </div>

          {selectedScore ? (
            <>
              <div className={halfPageMode ? "viewerCanvas halfPage" : "viewerCanvas"}>
                {selectedScore.pdf?.dataUrl ? (
                  <iframe
                    className="pdfFrame"
                    src={selectedScore.pdf.dataUrl}
                    title={selectedScore.title}
                  />
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
                        <strong>{bookmark.name}</strong>
                        <span>
                          Pages {bookmark.startPage}
                          {bookmark.endPage !== bookmark.startPage ? `-${bookmark.endPage}` : ""}
                        </span>
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
