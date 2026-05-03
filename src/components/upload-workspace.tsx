"use client";

import Script from "next/script";
import { createElement, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  FileCheck2,
  KeyRound,
  LineChart,
  ReceiptText,
  Search,
  Upload,
  ImagePlus
} from "lucide-react";
import type { ReviewedBet } from "@/lib/types";

type Status = { type: "idle" | "loading" | "success" | "error"; message: string };

const editableFields: Array<keyof ReviewedBet> = [
  "siteCode",
  "siteName",
  "ticketId",
  "league",
  "marketType",
  "marketLine",
  "totalSide",
  "betType",
  "currency",
  "selectedTeam",
  "homeTeam",
  "awayTeam",
  "placedAt",
  "eventStartAt",
  "oddsDecimal",
  "stakeAmount",
  "payoutAmount",
  "winAmount",
  "confidence"
];

export function UploadWorkspace() {
  const [password, setPassword] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [bets, setBets] = useState<ReviewedBet[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<Status>({ type: "idle", message: "Upload screenshots to begin." });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedBets = useMemo(
    () => bets.filter((bet) => selectedIds.has(bet.id)),
    [bets, selectedIds]
  );

  async function extract() {
    if (!password) {
      setStatus({ type: "error", message: "Enter the app password first." });
      return;
    }
    if (files.length === 0) {
      setStatus({ type: "error", message: "Choose at least one screenshot." });
      return;
    }

    setStatus({ type: "loading", message: `Extracting ${files.length} screenshot(s)...` });
    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));

    const response = await fetch("/api/extract", {
      method: "POST",
      headers: { "x-app-password": password },
      body: formData
    });
    const payload = await response.json();

    if (!response.ok) {
      setStatus({ type: "error", message: payload.error ?? "Extraction failed." });
      return;
    }

    setBets(payload.bets);
    setSelectedIds(new Set(payload.bets.map((bet: ReviewedBet) => bet.id)));
    setStatus({ type: "success", message: `Extracted ${payload.bets.length} supported straight bet(s). Review before submitting.` });
  }

  async function submit() {
    if (selectedBets.length === 0) {
      setStatus({ type: "error", message: "Select at least one reviewed bet to submit." });
      return;
    }

    setStatus({ type: "loading", message: `Submitting ${selectedBets.length} reviewed bet(s) to Google Sheets...` });
    const response = await fetch("/api/submit", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-app-password": password
      },
      body: JSON.stringify({ bets: selectedBets })
    });
    const payload = await response.json();

    if (!response.ok) {
      setStatus({ type: "error", message: payload.error ?? "Submission failed." });
      return;
    }

    setStatus({ type: "success", message: "Submitted to Apps Script. Check the Raw Data and Matched Pairs sheets." });
  }

  function updateBet(id: string, field: keyof ReviewedBet, value: string) {
    setBets((current) =>
      current.map((bet) => {
        if (bet.id !== id) {
          return bet;
        }

        const numericFields: Array<keyof ReviewedBet> = [
          "oddsDecimal",
          "stakeAmount",
          "payoutAmount",
          "winAmount",
          "marketLine",
          "confidence"
        ];
        const nextValue = numericFields.includes(field)
          ? value.trim() === "" && field === "marketLine"
            ? null
            : Number(value)
          : value;

        return {
          ...bet,
          [field]: nextValue
        };
      })
    );
  }

  function setAllSelected(checked: boolean) {
    setSelectedIds(checked ? new Set(bets.map((bet) => bet.id)) : new Set());
  }

  function acceptFiles(fileList: FileList | null) {
    setFiles(Array.from(fileList ?? []));
  }

  return (
    <div className="appFrame">
      <Script
        src="https://unpkg.com/@lottiefiles/dotlottie-wc@0.9.10/dist/dotlottie-wc.js"
        type="module"
        strategy="afterInteractive"
      />
      <header className="topNav">
        <div className="topNavInner">
          <div className="brandArea">
            <span className="brand">Bakery Reports</span>
          </div>
        </div>
      </header>

      <main className="pageShell">
        <section className="pageTitle">
          <div>
            <h1>Bet Screenshot Ledger</h1>
            <p>Securely upload and extract data from your betting platform screenshots.</p>
          </div>
          <div className="statusArea">
            {status.type === "loading" ? (
              <div className="loadingAnimationSlot" aria-hidden="true">
                {createElement("dotlottie-wc", {
                  src: "https://lottie.host/bec33e46-c61b-4d6b-914c-46306b496f35/nJIqKsJPpF.lottie",
                  autoplay: true,
                  loop: true
                })}
              </div>
            ) : null}
            <div className={`statusPill ${status.type}`} role="status">
              {status.message}
            </div>
          </div>
        </section>

        <div className="workspaceGrid">
          <section className="leftColumn">
            <div className="card extractionCard">
              <div className="sectionHeading">
                <Upload size={24} />
                <h2>Extraction Details</h2>
              </div>

              <label className="fieldGroup">
                <span>App Password</span>
                <span className="inputShell">
                  <KeyRound size={20} />
                  <input
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    type="password"
                    autoComplete="current-password"
                    placeholder="Password"
                  />
                </span>
                <small>Use your unique bakery-reports app password for secure extraction.</small>
              </label>

              <div className="fieldGroup">
                <span>Screenshots</span>
                <button
                  type="button"
                  className="dropZone"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    acceptFiles(event.dataTransfer.files);
                  }}
                >
                  <span className="uploadBubble">
                    <ImagePlus size={32} />
                  </span>
                  <span className="dropTitle">{files.length > 0 ? `${files.length} file(s) selected` : "Choose Files"}</span>
                  <span className="dropText">
                    {files.length > 0 ? files.map((file) => file.name).join(", ") : "or drag and drop betting screenshots here"}
                  </span>
                  <span className="formatBadges">
                    <span>PNG</span>
                    <span>JPG</span>
                    <span>MAX 10MB</span>
                  </span>
                </button>
                <input
                  ref={fileInputRef}
                  className="hiddenFile"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(event) => acceptFiles(event.target.files)}
                />
              </div>

              <button className="primaryAction" onClick={extract} disabled={status.type === "loading"}>
                <LineChart size={20} />
                Extract Data
              </button>
            </div>

            <div className="guidelinesCard">
              <h3>Quick Guidelines</h3>
              <ul>
                <li>
                  <CheckCircle2 size={24} />
                  <span>Ensure bet IDs and odds are clearly visible.</span>
                </li>
                <li>
                  <CheckCircle2 size={24} />
                  <span>Avoid glare or obstructed text for better OCR accuracy.</span>
                </li>
              </ul>
            </div>
          </section>

          <section className="reviewColumn">
            <div className="card reviewCard">
              <div className="reviewHeader">
                <div className="sectionHeading">
                  <FileCheck2 size={24} />
                  <h2>Review Extracted Bets</h2>
                </div>
                <div className="reviewActions">
                  <span className="countBadge">
                    {selectedBets.length} of {bets.length} selected
                  </span>
                  <button className="submitButton" onClick={submit} disabled={status.type === "loading" || selectedBets.length === 0}>
                    Submit Selected
                  </button>
                </div>
              </div>

              {bets.length === 0 ? (
                <div className="emptyState">
                  <div className="emptyGraphic">
                    <div className="receiptCircle">
                      <ReceiptText size={72} />
                    </div>
                    <div className="searchTile">
                      <Search size={40} />
                    </div>
                  </div>
                  <div className="emptyCopy">
                    <h3>No Extractions Ready</h3>
                    <p>Upload your betting screenshots in the left panel to begin the data extraction process.</p>
                  </div>
                  <div className="ghostGrid" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              ) : (
                <div className="tableWrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Use</th>
                        <th>File</th>
                        {editableFields.map((field) => (
                          <th key={field}>{field}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {bets.map((bet) => (
                        <tr key={bet.id}>
                          <td>
                            <input
                              type="checkbox"
                              checked={selectedIds.has(bet.id)}
                              onChange={(event) => {
                                const next = new Set(selectedIds);
                                if (event.target.checked) {
                                  next.add(bet.id);
                                } else {
                                  next.delete(bet.id);
                                }
                                setSelectedIds(next);
                              }}
                            />
                          </td>
                          <td>{bet.sourceFile}</td>
                          {editableFields.map((field) => (
                            <td key={field}>
                              <input
                                value={String(bet[field] ?? "")}
                                onChange={(event) => updateBet(bet.id, field, event.target.value)}
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="reviewFooter">
                <span>Pending validation: {bets.length}</span>
                <div>
                  <button type="button" onClick={() => setAllSelected(true)} disabled={bets.length === 0}>
                    Select All
                  </button>
                  <span>|</span>
                  <button type="button" className="dangerText" onClick={() => setAllSelected(false)} disabled={bets.length === 0}>
                    Clear All
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>

      <footer className="footerBar">
        <span>© 2026 Bakery Reports. All rights reserved.</span>
        <nav aria-label="Footer">
          <a href="#">Privacy Policy</a>
          <a href="#">Terms of Service</a>
          <a href="#">API Documentation</a>
        </nav>
      </footer>
    </div>
  );
}
